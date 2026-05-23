import type { FluidSim } from "./fluid";
import { N, IX } from "./fluid";
import type { FluidGPU } from "./fluid-gpu";

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG_RENDER = `#version 300 es
precision highp float;
uniform sampler2D uDens;
uniform sampler2D uVel;
uniform sampler2D uPrev;
uniform float uHue;
uniform float uTime;
uniform float uDecay;
in vec2 vUv;
out vec4 fragCol;

vec3 hsl2rgb(float h, float s, float l) {
  vec3 r = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (r - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

void main() {
  float dens = texture(uDens, vUv).r;
  vec2  vel  = texture(uVel,  vUv).rg;
  float spd  = length(vel);

  float p = 1.0 / ${N}.0;

  // Vorticity (curl) from velocity gradient — tints swirling regions
  float curl = (
    texture(uVel, vUv + vec2(p, 0.0)).g - texture(uVel, vUv - vec2(p, 0.0)).g -
    texture(uVel, vUv + vec2(0.0, p)).r + texture(uVel, vUv - vec2(0.0, p)).r
  ) * 0.5;

  // Linear scale then power curve — matches the CPU renderer that was working.
  // No smoothstep: that crushes mid-range densities to black/white with no
  // in-between, killing the ambient color variation.
  float d = clamp(dens * 1.45, 0.0, 1.0);
  float glow = pow(d, 0.55);

  // Two-ring bloom: wide samples give a soft glow aura around fluid bodies
  float ws1 = 4.0 * p;
  float ws2 = 8.0 * p;
  float db1 = (texture(uDens, vUv + vec2(ws1, 0.0)).r +
               texture(uDens, vUv - vec2(ws1, 0.0)).r +
               texture(uDens, vUv + vec2(0.0, ws1)).r +
               texture(uDens, vUv - vec2(0.0, ws1)).r) * 0.25;
  float db2 = (texture(uDens, vUv + vec2(ws2, 0.0)).r +
               texture(uDens, vUv - vec2(ws2, 0.0)).r +
               texture(uDens, vUv + vec2(0.0, ws2)).r +
               texture(uDens, vUv - vec2(0.0, ws2)).r) * 0.25;
  float dBloom = clamp((db1 * 0.6 + db2 * 0.4) * 1.45, 0.0, 1.0);
  float glB = pow(dBloom, 0.55) * 0.55;

  vec2 np = vUv - 0.5;
  float wave = sin(np.x * 13.0 + uTime * 1.7)
             + cos(np.y * 11.0 - uTime * 1.2)
             + sin((np.x - np.y) * 9.0 + uTime * 0.8);

  float hue = mod(uHue + spd * 80.0 + wave * 24.0 + d * 95.0 + curl * 38.0, 360.0) / 360.0;
  float sat = max(0.12, 0.98 - max(0.0, glow - 0.72) * 2.4);

  // Sharp core
  vec3 core = hsl2rgb(hue, sat, 0.06 + glow * 0.88);
  core = vec3(
    min(1.0, core.r * (0.2 + glow * 1.35)),
    min(1.0, core.g * (0.2 + glow * 1.30)),
    min(1.0, core.b * (0.28 + glow * 1.52))
  );

  // Soft glow halo
  vec3 bloom = hsl2rgb(hue, sat, 0.06 + glB * 0.6);
  bloom *= vec3(0.2 + glB * 0.9, 0.2 + glB * 0.85, 0.28 + glB * 1.0);

  vec3 fluid = clamp(core + bloom * 0.45, 0.0, 1.0);

  // Compose with decayed history for trail effect
  vec3 prev = texture(uPrev, vUv).rgb * uDecay;
  fragCol = vec4(max(fluid, prev), 1.0);
}`;

const FRAG_BLIT = `#version 300 es
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 fragCol;
void main() { fragCol = texture(uTex, vUv); }`;

export class FluidGLRenderer {
  private gl: WebGL2RenderingContext;

  private renderProg: WebGLProgram;
  private blitProg: WebGLProgram;
  private vao: WebGLVertexArrayObject;

  private densTex: WebGLTexture;
  private velTex: WebGLTexture;

  private pingpong: [WebGLFramebuffer, WebGLFramebuffer] = [null!, null!];
  private ppTex: [WebGLTexture, WebGLTexture] = [null!, null!];
  private ppIdx = 0;
  private ppW = 0;
  private ppH = 0;

  private densArr = new Float32Array(N * N);
  private velArr = new Float32Array(N * N * 2);

  private globalHue = 200;
  private visualTime = 0;

  // Cached uniform locations
  private rLoc: Record<string, WebGLUniformLocation> = {};
  private bLoc: Record<string, WebGLUniformLocation> = {};

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL2 not supported");
    this.gl = gl;

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    this.renderProg = this.mkProg(VERT, FRAG_RENDER);
    this.blitProg = this.mkProg(VERT, FRAG_BLIT);
    this.vao = this.mkQuad();

    this.densTex = this.mkTex(N, N, gl.R16F, gl.RED);
    this.velTex = this.mkTex(N, N, gl.RG16F, gl.RG);

    for (const name of ["uDens", "uVel", "uPrev", "uHue", "uTime", "uDecay"]) {
      this.rLoc[name] = gl.getUniformLocation(this.renderProg, name)!;
    }
    this.bLoc["uTex"] = gl.getUniformLocation(this.blitProg, "uTex")!;
  }

  private mkProg(vert: string, frag: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, vert);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p) ?? "link error");
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return p;
  }

  private mkQuad(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private mkTex(
    w: number,
    h: number,
    internalFmt: number,
    fmt: number,
    type?: number,
  ): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFmt, w, h, 0, fmt, type ?? gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  private mkFBO(w: number, h: number): [WebGLFramebuffer, WebGLTexture] {
    const gl = this.gl;
    // RGBA8 requires UNSIGNED_BYTE — FLOAT is an invalid combination and
    // produces an incomplete framebuffer that silently discards all draws.
    const tex = this.mkTex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return [fbo, tex];
  }

  private ensurePP(w: number, h: number) {
    if (w === this.ppW && h === this.ppH) return;
    const gl = this.gl;
    if (this.ppW > 0) {
      gl.deleteFramebuffer(this.pingpong[0]);
      gl.deleteFramebuffer(this.pingpong[1]);
      gl.deleteTexture(this.ppTex[0]);
      gl.deleteTexture(this.ppTex[1]);
    }
    const [fbo0, tex0] = this.mkFBO(w, h);
    const [fbo1, tex1] = this.mkFBO(w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.pingpong = [fbo0, fbo1];
    this.ppTex = [tex0, tex1];
    this.ppW = w;
    this.ppH = h;
  }

  private uploadFluid(fluid: FluidSim) {
    const gl = this.gl;
    const da = this.densArr;
    const va = this.velArr;
    for (let j = 1; j <= N; j++) {
      for (let i = 1; i <= N; i++) {
        // WebGL texImage2D row 0 = UV V=0 = canvas bottom, but j=1 is game-world
        // top (screen y=0). Flip Y so grid top aligns with canvas top.
        const flat = (N - j) * N + (i - 1);
        const idx = IX(i, j);
        da[flat] = fluid.dens[idx];
        va[flat * 2] = fluid.u[idx];
        va[flat * 2 + 1] = fluid.v[idx];
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, this.densTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, N, gl.RED, gl.FLOAT, da);
    gl.bindTexture(gl.TEXTURE_2D, this.velTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, N, gl.RG, gl.FLOAT, va);
  }

  render(fluid: FluidSim, dt: number, w: number, h: number) {
    const gl = this.gl;
    this.globalHue = (this.globalHue + 0.24) % 360;
    this.visualTime += dt;

    this.ensurePP(w, h);
    this.uploadFluid(fluid);

    const cur = this.ppIdx;
    const prev = 1 - cur;

    // Pass 1: render fluid + compose with previous history → current FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pingpong[cur]);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.renderProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.densTex);
    gl.uniform1i(this.rLoc.uDens, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.velTex);
    gl.uniform1i(this.rLoc.uVel, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.ppTex[prev]);
    gl.uniform1i(this.rLoc.uPrev, 2);

    gl.uniform1f(this.rLoc.uHue, this.globalHue);
    gl.uniform1f(this.rLoc.uTime, this.visualTime);
    gl.uniform1f(this.rLoc.uDecay, 0.925);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Pass 2: blit current FBO to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.blitProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.ppTex[cur]);
    gl.uniform1i(this.bLoc.uTex, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);

    this.ppIdx = prev;
  }
}

// ─── GPU render shaders (moved from fluid-gpu.ts) ────────────────────────────

// Primary fluid render — density/velocity/curl → rich HSL colour
const FRAG_GPU_RENDER = `#version 300 es
precision highp float;
uniform sampler2D uDens;
uniform sampler2D uVel;
uniform sampler2D uCurl;
uniform float uHue;
uniform float uTime;
in vec2 vUv;
out vec4 o;

vec3 hsl2rgb(float h,float s,float l){
  vec3 r=clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0,0.0,1.0);
  return l+s*(r-0.5)*(1.0-abs(2.0*l-1.0));
}

void main(){
  float dens=texture(uDens,vUv).r;
  vec2  vel =texture(uVel, vUv).rg;
  float curl=texture(uCurl,vUv).r;
  float spd =length(vel);

  float d=clamp(dens*1.6,0.0,1.0);
  float g=pow(d,0.5);

  // Multi-sample bloom seed (wide glow)
  const float N=${512}.0;
  float p=1.0/N;
  float w1=5.0*p, w2=12.0*p;
  float b1=(texture(uDens,vUv+vec2(w1,0)).r+texture(uDens,vUv-vec2(w1,0)).r+
            texture(uDens,vUv+vec2(0,w1)).r+texture(uDens,vUv-vec2(0,w1)).r)*0.25;
  float b2=(texture(uDens,vUv+vec2(w2,0)).r+texture(uDens,vUv-vec2(w2,0)).r+
            texture(uDens,vUv+vec2(0,w2)).r+texture(uDens,vUv-vec2(0,w2)).r)*0.25;
  float bloom=pow(clamp((b1*0.55+b2*0.45)*1.7,0.0,1.0),0.5)*0.62;

  // Animated hue wave
  vec2 np=vUv-0.5;
  float wave=sin(np.x*14.0+uTime*1.8)
            +cos(np.y*11.0-uTime*1.3)
            +sin((np.x-np.y)*9.0+uTime*0.9);

  float hue=mod(uHue/360.0+spd*0.055+wave*0.022+d*0.10+curl*0.018,1.0);
  float sat=max(0.08,0.98-max(0.0,g-0.70)*2.6);

  vec3 core=hsl2rgb(hue,sat,0.05+g*0.92);
  core=vec3(
    min(1.0,core.r*(0.18+g*1.40)),
    min(1.0,core.g*(0.18+g*1.34)),
    min(1.0,core.b*(0.25+g*1.58))
  );
  vec3 halo=hsl2rgb(hue,sat,0.05+bloom*0.65);
  halo*=vec3(0.18+bloom*0.95,0.18+bloom*0.90,0.25+bloom*1.05);
  o=vec4(clamp(core+halo*0.50,0.0,1.0),1.0);
}`;

// Separable 9-tap Gaussian blur (uDir = (1/w,0) H or (0,1/h) V)
const FRAG_GPU_BLUR = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uDir;
in vec2 vUv;
out vec4 o;
const float W[5]=float[](0.22703,0.19459,0.12162,0.05405,0.01621);
void main(){
  vec3 c=texture(uTex,vUv).rgb*W[0];
  for(int i=1;i<5;i++){
    vec2 off=float(i)*uDir;
    c+=(texture(uTex,vUv+off).rgb+texture(uTex,vUv-off).rgb)*W[i];
  }
  o=vec4(c,1);
}`;

// Bright-pass: extract highlights for bloom
const FRAG_GPU_BRIGHT = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform float uThresh;
in vec2 vUv;
out vec4 o;
void main(){
  vec3 c=texture(uTex,vUv).rgb;
  float lum=dot(c,vec3(0.2126,0.7152,0.0722));
  float knee=max(0.0,lum-uThresh);
  o=vec4(c*(knee/(lum+0.0001)),1);
}`;

// Composite: fluid + bloom + trail history, with ACES tone map
const FRAG_GPU_COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uFluid;
uniform sampler2D uBloom;
uniform sampler2D uPrev;
uniform float uDecay;
in vec2 vUv;
out vec4 o;
void main(){
  vec3 fluid=texture(uFluid,vUv).rgb;
  vec3 bloom=texture(uBloom,vUv).rgb;
  vec3 prev =texture(uPrev, vUv).rgb*uDecay;
  vec3 c=fluid+bloom*0.85;
  // ACES filmic
  vec3 num=c*(c+0.0245786)-0.000090537;
  vec3 den=c*(0.983729*c+0.4329510)+0.238081;
  vec3 tm=clamp(num/den,0.0,1.0);
  o=vec4(max(tm,prev),1);
}`;

// ─── FluidGPURenderer ────────────────────────────────────────────────────────

type RFBO = { fbo: WebGLFramebuffer; tex: WebGLTexture };

export class FluidGPURenderer {
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;

  private renderProg: WebGLProgram;
  private blurProg: WebGLProgram;
  private brightProg: WebGLProgram;
  private compositeProg: WebGLProgram;
  private blitProg: WebGLProgram;

  private renderFBO: RFBO | null = null;
  private bloomH: RFBO | null = null;
  private bloomV: RFBO | null = null;
  private hist: [RFBO, RFBO] | null = null;
  private hi = 0;
  private ppW = 0;
  private ppH = 0;

  private globalHue = 200;
  private t = 0;

  constructor(private sim: FluidGPU) {
    this.gl = sim.context;
    this.vao = sim.vaoRef;
    this.renderProg    = this.mkProg(FRAG_GPU_RENDER);
    this.blurProg      = this.mkProg(FRAG_GPU_BLUR);
    this.brightProg    = this.mkProg(FRAG_GPU_BRIGHT);
    this.compositeProg = this.mkProg(FRAG_GPU_COMPOSITE);
    this.blitProg      = this.mkProg(FRAG_BLIT);
  }

  render(dt: number, w: number, h: number) {
    this.globalHue = (this.globalHue + 0.22) % 360;
    this.t += dt;
    this.ensureScreenFBOs(w, h);
    const gl = this.gl;

    // Pass 1 — primary fluid colour → renderFBO (full res)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.renderFBO!.fbo);
    gl.viewport(0, 0, w, h);
    this.draw(this.renderProg, (p) => {
      this.t2(0, this.sim.getDensTex(), p, "uDens");
      this.t2(1, this.sim.getVelTex(),  p, "uVel");
      this.t2(2, this.sim.getCurlTex(), p, "uCurl");
      this.u1f(p, "uHue",  this.globalHue);
      this.u1f(p, "uTime", this.t);
    });

    // Pass 2 — bright-pass at half res
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomH!.fbo);
    gl.viewport(0, 0, hw, hh);
    this.draw(this.brightProg, (p) => {
      this.t2(0, this.renderFBO!.tex, p, "uTex");
      this.u1f(p, "uThresh", 0.28);
    });

    // Pass 3 — horizontal Gaussian
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomV!.fbo);
    gl.viewport(0, 0, hw, hh);
    this.draw(this.blurProg, (p) => {
      this.t2(0, this.bloomH!.tex, p, "uTex");
      this.u2f(p, "uDir", 0.45 / hw, 0);
    });

    // Pass 4 — vertical Gaussian (back into bloomH for composite)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomH!.fbo);
    gl.viewport(0, 0, hw, hh);
    this.draw(this.blurProg, (p) => {
      this.t2(0, this.bloomV!.tex, p, "uTex");
      this.u2f(p, "uDir", 0, 0.45 / hh);
    });

    // Pass 5 — composite (fluid + bloom + history trail) → hist[hi]
    const cur = this.hi, prv = 1 - cur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.hist![cur].fbo);
    gl.viewport(0, 0, w, h);
    this.draw(this.compositeProg, (p) => {
      this.t2(0, this.renderFBO!.tex,  p, "uFluid");
      this.t2(1, this.bloomH!.tex,     p, "uBloom");
      this.t2(2, this.hist![prv].tex,  p, "uPrev");
      this.u1f(p, "uDecay", 0.930);
    });

    // Pass 6 — blit to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    this.draw(this.blitProg, (p) => this.t2(0, this.hist![cur].tex, p, "uTex"));

    this.hi = prv;
  }

  private ensureScreenFBOs(w: number, h: number) {
    if (w === this.ppW && h === this.ppH) return;
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    this.renderFBO = this.mkRgbaFBO(w, h);
    this.bloomH    = this.mkRgbaFBO(hw, hh);
    this.bloomV    = this.mkRgbaFBO(hw, hh);
    this.hist      = [this.mkRgbaFBO(w, h), this.mkRgbaFBO(w, h)];
    this.ppW = w; this.ppH = h;
  }

  private mkRgbaFBO(w: number, h: number): RFBO {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex };
  }

  private mkProg(fragSrc: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    const p = gl.createProgram()!;
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p) ?? "link error");
    gl.deleteShader(vs); gl.deleteShader(fs);
    return p;
  }

  private draw(prog: WebGLProgram, setup: (p: WebGLProgram) => void) {
    const gl = this.gl;
    gl.useProgram(prog);
    setup(prog);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  private t2(unit: number, tex: WebGLTexture, prog: WebGLProgram, name: string) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }

  private u1f(prog: WebGLProgram, n: string, v: number) {
    this.gl.uniform1f(this.gl.getUniformLocation(prog, n), v);
  }

  private u2f(prog: WebGLProgram, n: string, x: number, y: number) {
    this.gl.uniform2f(this.gl.getUniformLocation(prog, n), x, y);
  }
}
