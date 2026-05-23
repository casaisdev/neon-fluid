export type GPUTier = "high" | "medium" | "low";

export interface TierConfig {
  n: number;
  iterPressure: number;
}

export const TIER_CONFIG: Record<GPUTier, TierConfig> = {
  high:   { n: 512, iterPressure: 40 },
  medium: { n: 256, iterPressure: 25 },
  low:    { n: 128, iterPressure: 15 },
};

const BENCH_N    = 256;
const BENCH_ITER = 30;

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv=aPos*0.5+0.5; gl_Position=vec4(aPos,0,1); }`;

const FRAG_JACOBI = `#version 300 es
precision highp float;
uniform sampler2D uPress;
uniform sampler2D uDiv;
in vec2 vUv;
out vec4 o;
void main(){
  const float h=1.0/${BENCH_N}.0;
  float pL=texture(uPress,vUv-vec2(h,0)).r;
  float pR=texture(uPress,vUv+vec2(h,0)).r;
  float pB=texture(uPress,vUv-vec2(0,h)).r;
  float pT=texture(uPress,vUv+vec2(0,h)).r;
  float d =texture(uDiv,vUv).r;
  o=vec4((pL+pR+pB+pT+d)*0.25,0,0,1);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? "shader compile error");
  return s;
}

function makeFBO(gl: WebGL2RenderingContext): { fbo: WebGLFramebuffer; tex: WebGLTexture } {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, BENCH_N, BENCH_N, 0, gl.RED, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}

export async function detectGPUTier(): Promise<GPUTier> {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  canvas.style.display = "none";
  document.body.appendChild(canvas);

  try {
    const gl = canvas.getContext("webgl2");
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
      return "low";
    }

    // Build quad VAO
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // Compile Jacobi program
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_JACOBI);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(prog) ?? "link error");
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // Allocate ping-pong FBOs for pressure + a static divergence FBO
    let fbo0: { fbo: WebGLFramebuffer; tex: WebGLTexture } | null = null;
    let fbo1: { fbo: WebGLFramebuffer; tex: WebGLTexture } | null = null;
    let divFBO: { fbo: WebGLFramebuffer; tex: WebGLTexture } | null = null;

    try {
      fbo0 = makeFBO(gl);
      fbo1 = makeFBO(gl);
      divFBO = makeFBO(gl); // static zero-filled divergence input

      gl.useProgram(prog);
      gl.viewport(0, 0, BENCH_N, BENCH_N);

      const pressLoc = gl.getUniformLocation(prog, "uPress");
      const divLoc   = gl.getUniformLocation(prog, "uDiv");
      if (pressLoc === null || divLoc === null)
        throw new Error("benchmark uniform not found");

      // Warm-up pass (driver lazy-initialises pipelines on first draw)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo1.fbo);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbo0.tex); gl.uniform1i(pressLoc, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, divFBO.tex); gl.uniform1i(divLoc, 1);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.finish();

      // Timed benchmark — uDiv stays bound to divFBO (static), uPress ping-pongs
      let pi = 0;
      const fbos = [fbo0, fbo1];
      const t0 = performance.now();
      for (let k = 0; k < BENCH_ITER; k++) {
        const dst = 1 - pi;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[dst].fbo);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbos[pi].tex); gl.uniform1i(pressLoc, 0);
        // divFBO stays on TEXTURE1, no need to rebind
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        pi = dst;
      }
      gl.finish();
      const elapsed = performance.now() - t0;
      if (process.env.NODE_ENV === "development") console.log(`[GPU benchmark] elapsed=${elapsed.toFixed(3)}ms`);

      // Calibration: 30 passes at N=256 extrapolates to 80 passes at N=512
      // via factor ×10.67. So elapsed < 0.3ms → real cost < ~3.2ms (high tier limit).
      if (elapsed < 0.3)  return "high";
      if (elapsed < 15)   return "medium";
      return "low";

    } finally {
      gl.bindVertexArray(null);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(prog);
      if (fbo0)   { gl.deleteTexture(fbo0.tex);   gl.deleteFramebuffer(fbo0.fbo); }
      if (fbo1)   { gl.deleteTexture(fbo1.tex);   gl.deleteFramebuffer(fbo1.fbo); }
      if (divFBO) { gl.deleteTexture(divFBO.tex); gl.deleteFramebuffer(divFBO.fbo); }
    }

  } catch {
    return "low";
  } finally {
    canvas.remove();
  }
}
