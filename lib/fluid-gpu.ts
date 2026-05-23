// Full GPU Stam fluid simulation — "Real-Time Fluid Dynamics for Games" (2003)
// Simulation runs entirely at n×n on the GPU via WebGL2.
// n and iterPressure are chosen at runtime by detectGPUTier().

const VORT_EPS    = 0.38;
const VEL_DAMP    = 0.9985;
const DENS_DECAY  = 0.982;
const DENSITY_MIN = 0;
const DENSITY_MAX = 1;
const VELOCITY_MIN = -10;
const VELOCITY_MAX = 10;

function safeClamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < lo ? lo : v > hi ? hi : v;
}

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){
  vUv = aPos*0.5+0.5;
  gl_Position = vec4(aPos,0.0,1.0);
}`;

function buildShaders(n: number) {
  const FRAG_ADVECT = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform sampler2D uVel;
uniform float uDt;
uniform float uDissipation;
in vec2 vUv;
out vec4 o;
void main(){
  const float N=${n}.0;
  vec2 vel=texture(uVel,vUv).rg;
  vec2 pos=clamp(vUv-vel*uDt, 0.5/N, 1.0-0.5/N);
  o=texture(uField,pos)*uDissipation;
}`;

  const FRAG_JACOBI = `#version 300 es
precision highp float;
uniform sampler2D uPress;
uniform sampler2D uDiv;
in vec2 vUv;
out vec4 o;
void main(){
  const float h=1.0/${n}.0;
  float pL=texture(uPress,vUv-vec2(h,0)).r;
  float pR=texture(uPress,vUv+vec2(h,0)).r;
  float pB=texture(uPress,vUv-vec2(0,h)).r;
  float pT=texture(uPress,vUv+vec2(0,h)).r;
  float d =texture(uDiv,  vUv).r;
  o=vec4((pL+pR+pB+pT+d)*0.25,0,0,1);
}`;

  const FRAG_DIVERGENCE = `#version 300 es
precision highp float;
uniform sampler2D uVel;
in vec2 vUv;
out vec4 o;
void main(){
  const float h=1.0/${n}.0;
  float uR=texture(uVel,vUv+vec2(h,0)).r;
  float uL=texture(uVel,vUv-vec2(h,0)).r;
  float vT=texture(uVel,vUv+vec2(0,h)).g;
  float vB=texture(uVel,vUv-vec2(0,h)).g;
  o=vec4(-0.5*h*((uR-uL)+(vT-vB)),0,0,1);
}`;

  const FRAG_GRAD_SUB = `#version 300 es
precision highp float;
uniform sampler2D uVel;
uniform sampler2D uPress;
in vec2 vUv;
out vec4 o;
void main(){
  const float h=1.0/${n}.0;
  vec2 vel=texture(uVel,vUv).rg;
  float pR=texture(uPress,vUv+vec2(h,0)).r;
  float pL=texture(uPress,vUv-vec2(h,0)).r;
  float pT=texture(uPress,vUv+vec2(0,h)).r;
  float pB=texture(uPress,vUv-vec2(0,h)).r;
  vel-=vec2(pR-pL,pT-pB)*(0.5/h);
  o=vec4(vel,0,1);
}`;

  const FRAG_CURL = `#version 300 es
precision highp float;
uniform sampler2D uVel;
in vec2 vUv;
out vec4 o;
void main(){
  const float h=1.0/${n}.0;
  float vR=texture(uVel,vUv+vec2(h,0)).g;
  float vL=texture(uVel,vUv-vec2(h,0)).g;
  float uT=texture(uVel,vUv+vec2(0,h)).r;
  float uB=texture(uVel,vUv-vec2(0,h)).r;
  o=vec4((vR-vL-uT+uB)*0.5/h,0,0,1);
}`;

  const FRAG_VORTICITY = `#version 300 es
precision highp float;
uniform sampler2D uVel;
uniform sampler2D uCurl;
uniform float uEps;
uniform float uDt;
uniform float uDamp;
in vec2 vUv;
out vec4 o;
void main(){
  const float h=1.0/${n}.0;
  float cC=texture(uCurl,vUv).r;
  float cR=abs(texture(uCurl,vUv+vec2(h,0)).r);
  float cL=abs(texture(uCurl,vUv-vec2(h,0)).r);
  float cT=abs(texture(uCurl,vUv+vec2(0,h)).r);
  float cB=abs(texture(uCurl,vUv-vec2(0,h)).r);
  float nx=(cR-cL)*0.5/h, ny=(cT-cB)*0.5/h;
  float len=sqrt(nx*nx+ny*ny)+1e-5;
  nx/=len; ny/=len;
  vec2 vel=texture(uVel,vUv).rg;
  vel.x+=uEps*h*ny*cC*uDt;
  vel.y-=uEps*h*nx*cC*uDt;
  vel*=uDamp;
  o=vec4(vel,0,1);
}`;

  const FRAG_SPLAT_VEL = `#version 300 es
precision highp float;
uniform sampler2D uVel;
uniform vec2 uPt;
uniform vec2 uForce;
uniform float uRad;
in vec2 vUv;
out vec4 o;
void main(){
  vec2 d=vUv-uPt;
  float w=exp(-dot(d,d)/(uRad*uRad));
  o=vec4(texture(uVel,vUv).rg+uForce*w,0,1);
}`;

  const FRAG_SPLAT_DENS = `#version 300 es
precision highp float;
uniform sampler2D uDens;
uniform vec2 uPt;
uniform float uAmt;
uniform float uRad;
in vec2 vUv;
out vec4 o;
void main(){
  vec2 d=vUv-uPt;
  float w=exp(-dot(d,d)/(uRad*uRad));
  o=vec4(texture(uDens,vUv).r+uAmt*w,0,0,1);
}`;

  const FRAG_CLAMP_VEL = `#version 300 es
precision highp float;
uniform sampler2D uVel;
in vec2 vUv;
out vec4 o;
float clean(float x){
  if (isnan(x) || isinf(x)) return 0.0;
  return clamp(x, -10.0, 10.0);
}
void main(){
  vec2 vel=texture(uVel,vUv).rg;
  o=vec4(clean(vel.x), clean(vel.y), 0, 1);
}`;

  const FRAG_CLAMP_DENS = `#version 300 es
precision highp float;
uniform sampler2D uDens;
in vec2 vUv;
out vec4 o;
float clean(float x){
  if (isnan(x) || isinf(x)) return 0.0;
  return clamp(x, 0.0, 1.0);
}
void main(){
  o=vec4(clean(texture(uDens,vUv).r), 0, 0, 1);
}`;

  return {
    FRAG_ADVECT, FRAG_JACOBI, FRAG_DIVERGENCE, FRAG_GRAD_SUB,
    FRAG_CURL, FRAG_VORTICITY, FRAG_SPLAT_VEL, FRAG_SPLAT_DENS,
    FRAG_CLAMP_VEL, FRAG_CLAMP_DENS,
  };
}

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface FBO { fbo: WebGLFramebuffer; tex: WebGLTexture }
type Ping2 = [FBO, FBO];

// ─── CLASS ───────────────────────────────────────────────────────────────────

export class FluidGPU {
  private gl: WebGL2RenderingContext;
  private vao!: WebGLVertexArrayObject;

  // Simulation ping-pong FBOs (n × n)
  private vel!:  Ping2;  // RG16F — velocity (u,v)
  private dens!: Ping2;  // R16F  — density
  private pres!: Ping2;  // R16F  — pressure
  private divFBO!:  FBO; // R16F  — divergence
  private curlFBO!: FBO; // R16F  — curl

  // Read-index trackers for ping-pong
  private vi = 0; // current "read" index for vel
  private di = 0; // current "read" index for dens
  private pi = 0; // current "read" index for pressure

  private progs!: {
    advect: WebGLProgram; jacobi: WebGLProgram; div: WebGLProgram;
    gradSub: WebGLProgram; curl: WebGLProgram; vort: WebGLProgram;
    splatV: WebGLProgram; splatD: WebGLProgram;
    clampV: WebGLProgram; clampD: WebGLProgram;
  };

  private pendingSplats: { x:number; y:number; vx:number; vy:number; dens:number; r:number }[] = [];

  private n: number;
  private iterPressure: number;

  constructor(canvas: HTMLCanvasElement, n: number, iterPressure: number) {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL2 not supported");
    this.gl = gl;
    this.n = n;
    this.iterPressure = iterPressure;
    if (!gl.getExtension("EXT_color_buffer_float"))
      throw new Error("EXT_color_buffer_float required");
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    this.vao = this.mkQuad();
    this.buildProgs();
    this.initSim();
  }

  // ── Public getters for FluidGPURenderer ──────────────────────────────────────

  get context(): WebGL2RenderingContext { return this.gl; }
  get vaoRef(): WebGLVertexArrayObject { return this.vao; }
  getVelTex(): WebGLTexture { return this.vel[this.vi].tex; }
  getDensTex(): WebGLTexture { return this.dens[this.di].tex; }
  getCurlTex(): WebGLTexture { return this.curlFBO.tex; }

  // ── Public API ───────────────────────────────────────────────────────────────

  /** Queue a Gaussian force + density injection at UV position (x,y).
   *  vx,vy are in Stam velocity units (grid cells/sec where 1 cell = 1/N of domain). */
  addForce(x: number, y: number, vx: number, vy: number, density: number, radiusUV: number) {
    this.pendingSplats.push({
      x: safeClamp(x, 0, 1),
      y: safeClamp(y, 0, 1),
      vx: safeClamp(vx, VELOCITY_MIN, VELOCITY_MAX),
      vy: safeClamp(vy, VELOCITY_MIN, VELOCITY_MAX),
      dens: safeClamp(density, DENSITY_MIN, DENSITY_MAX),
      r: safeClamp(radiusUV, 0, 1),
    });
  }

  /** Full simulation step: vel_step + dens_step (Stam 2003 order). */
  step(dt: number) {
    // 1. Add external forces (Gaussian splats)
    for (const s of this.pendingSplats) {
      this.doSplatVel(s.x, s.y, s.vx, s.vy, s.r);
      this.doSplatDens(s.x, s.y, s.dens, s.r);
    }
    this.pendingSplats.length = 0;
    this.clampFields();

    // 2. Vel step — matches Stam's vel_step order:
    //    add forces (done above) → [diffuse, skip] → project → advect → project → vorticity
    this.project();               // first projection (divergence-free)
    this.doAdvectVel(dt);         // semi-Lagrangian advect velocity
    this.project();               // second projection
    this.doVorticity(dt);         // vorticity confinement + damping

    // 3. Dens step — add sources (done above) → [diffuse, skip] → advect
    this.doAdvectDens(dt);        // semi-Lagrangian advect density
    this.clampFields();
  }

  // ── Simulation internals ─────────────────────────────────────────────────────

  private doAdvectVel(dt: number) {
    // Advect velocity using itself as the velocity field
    const dst = 1 - this.vi;
    this.bindFBO(this.vel[dst].fbo);
    this.use("advect", (p) => {
      this.t2(0, this.vel[this.vi].tex, p, "uField");
      this.t2(1, this.vel[this.vi].tex, p, "uVel");
      this.u1f(p, "uDt",          dt);
      this.u1f(p, "uDissipation", 1.0);
    });
    this.vi = dst;
  }

  private doAdvectDens(dt: number) {
    const dst = 1 - this.di;
    this.bindFBO(this.dens[dst].fbo);
    this.use("advect", (p) => {
      this.t2(0, this.dens[this.di].tex, p, "uField");
      this.t2(1, this.vel[this.vi].tex,  p, "uVel");
      this.u1f(p, "uDt",          dt);
      this.u1f(p, "uDissipation", DENS_DECAY);
    });
    this.di = dst;
  }

  private project() {
    const gl = this.gl;

    // Compute divergence
    this.bindFBO(this.divFBO.fbo);
    this.use("div", (p) => this.t2(0, this.vel[this.vi].tex, p, "uVel"));

    // Clear pressure ping-pong
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pres[i].fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    this.pi = 0;

    // Jacobi iterations
    for (let k = 0; k < this.iterPressure; k++) {
      const dst = 1 - this.pi;
      this.bindFBO(this.pres[dst].fbo);
      this.use("jacobi", (p) => {
        this.t2(0, this.pres[this.pi].tex, p, "uPress");
        this.t2(1, this.divFBO.tex,        p, "uDiv");
      });
      this.pi = dst;
    }

    // Gradient subtract → new div-free velocity
    const dst = 1 - this.vi;
    this.bindFBO(this.vel[dst].fbo);
    this.use("gradSub", (p) => {
      this.t2(0, this.vel[this.vi].tex,  p, "uVel");
      this.t2(1, this.pres[this.pi].tex, p, "uPress");
    });
    this.vi = dst;
  }

  private doVorticity(dt: number) {
    // Compute curl
    this.bindFBO(this.curlFBO.fbo);
    this.use("curl", (p) => this.t2(0, this.vel[this.vi].tex, p, "uVel"));

    // Apply vorticity confinement + damping
    const dst = 1 - this.vi;
    this.bindFBO(this.vel[dst].fbo);
    this.use("vort", (p) => {
      this.t2(0, this.vel[this.vi].tex, p, "uVel");
      this.t2(1, this.curlFBO.tex,      p, "uCurl");
      this.u1f(p, "uEps",  VORT_EPS);
      this.u1f(p, "uDt",   dt);
      this.u1f(p, "uDamp", VEL_DAMP);
    });
    this.vi = dst;
  }

  private doSplatVel(x: number, y: number, vx: number, vy: number, r: number) {
    const dst = 1 - this.vi;
    this.bindFBO(this.vel[dst].fbo);
    this.use("splatV", (p) => {
      this.t2(0, this.vel[this.vi].tex, p, "uVel");
      this.u2f(p, "uPt",    x, y);
      this.u2f(p, "uForce", vx, vy);
      this.u1f(p, "uRad",   r);
    });
    this.vi = dst;
  }

  private doSplatDens(x: number, y: number, amt: number, r: number) {
    const dst = 1 - this.di;
    this.bindFBO(this.dens[dst].fbo);
    this.use("splatD", (p) => {
      this.t2(0, this.dens[this.di].tex, p, "uDens");
      this.u2f(p, "uPt",  x, y);
      this.u1f(p, "uAmt", amt);
      this.u1f(p, "uRad", r);
    });
    this.di = dst;
  }

  private clampFields() {
    let dst = 1 - this.vi;
    this.bindFBO(this.vel[dst].fbo);
    this.use("clampV", (p) => this.t2(0, this.vel[this.vi].tex, p, "uVel"));
    this.vi = dst;

    dst = 1 - this.di;
    this.bindFBO(this.dens[dst].fbo);
    this.use("clampD", (p) => this.t2(0, this.dens[this.di].tex, p, "uDens"));
    this.di = dst;
  }

  // ── WebGL helpers ─────────────────────────────────────────────────────────────

  private bindFBO(fbo: WebGLFramebuffer) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, this.n, this.n);
  }

  private use(name: keyof typeof this.progs, setup: (p: WebGLProgram) => void) {
    const gl = this.gl;
    const p = this.progs[name];
    gl.useProgram(p);
    setup(p);
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

  // ── Initialisation ────────────────────────────────────────────────────────────

  private buildProgs() {
    const s = buildShaders(this.n);
    const c = (fs: string) => this.mkProg(fs);
    this.progs = {
      advect: c(s.FRAG_ADVECT),     jacobi:  c(s.FRAG_JACOBI),
      div:    c(s.FRAG_DIVERGENCE), gradSub: c(s.FRAG_GRAD_SUB),
      curl:   c(s.FRAG_CURL),       vort:    c(s.FRAG_VORTICITY),
      splatV: c(s.FRAG_SPLAT_VEL),  splatD:  c(s.FRAG_SPLAT_DENS),
      clampV: c(s.FRAG_CLAMP_VEL),  clampD:  c(s.FRAG_CLAMP_DENS),
    };
  }

  private initSim() {
    const N = this.n;
    const m2 = (rg: boolean): Ping2 => [this.mkSimFBO(N, N, rg), this.mkSimFBO(N, N, rg)];
    this.vel  = m2(true);   // RG16F
    this.dens = m2(false);  // R16F
    this.pres = m2(false);  // R16F
    this.divFBO  = this.mkSimFBO(N, N, false);
    this.curlFBO = this.mkSimFBO(N, N, false);
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

  private mkQuad(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private mkSimFBO(w: number, h: number, rg: boolean): FBO {
    const gl = this.gl;
    const intFmt = rg ? gl.RG16F : gl.R16F;
    const fmt    = rg ? gl.RG    : gl.RED;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, intFmt, w, h, 0, fmt, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex };
  }
}
