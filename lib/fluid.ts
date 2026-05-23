// Stable Fluids -- Jos Stam, "Real-Time Fluid Dynamics for Games" (2003)

export const N = 256;
const ITER = 12;
const VISC = 1e-7;
const DIFF = 1e-7;
export const FORCE = 1000;
export const SOURCE = 30;
export const IDLE_DELAY = 1.2;
export const IDLE_MOUSE_EPSILON = 1.2;
export const MOUSE_FORCE_SCALE = 1.4;
export const MOUSE_DENSITY_SCALE = 1.2;
export const MOUSE_SPEED_SOFTCAP = 2.7;
const VELOCITY_DAMPING = 0.990;
const DENSITY_DECAY = 0.980;
export const IDLE_STRENGTH = 0.25;
export const FLUID_DENSITY_MIN = 0;
export const FLUID_DENSITY_MAX = 1;
export const FLUID_VELOCITY_MIN = -10;
export const FLUID_VELOCITY_MAX = 10;

const SIZE = (N + 2) * (N + 2);

export function IX(i: number, j: number): number {
  return i + (N + 2) * j;
}

function safeClamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < lo ? lo : v > hi ? hi : v;
}

function safeFinite(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

export class FluidSim {
  u: Float32Array;
  v: Float32Array;
  u_prev: Float32Array;
  v_prev: Float32Array;
  dens: Float32Array;
  dens_prev: Float32Array;

  private _p: Float32Array;
  private _div: Float32Array;
  private _curl: Float32Array;

  vorticityEpsilon = 0.2;

  constructor() {
    this.u = new Float32Array(SIZE);
    this.v = new Float32Array(SIZE);
    this.u_prev = new Float32Array(SIZE);
    this.v_prev = new Float32Array(SIZE);
    this.dens = new Float32Array(SIZE);
    this.dens_prev = new Float32Array(SIZE);
    this._p = new Float32Array(SIZE);
    this._div = new Float32Array(SIZE);
    this._curl = new Float32Array(SIZE);
  }

  private set_bnd(b: number, x: Float32Array) {
    for (let i = 1; i <= N; i++) {
      x[IX(0, i)] = b === 1 ? -x[IX(1, i)] : x[IX(1, i)];
      x[IX(N + 1, i)] = b === 1 ? -x[IX(N, i)] : x[IX(N, i)];
      x[IX(i, 0)] = b === 2 ? -x[IX(i, 1)] : x[IX(i, 1)];
      x[IX(i, N + 1)] = b === 2 ? -x[IX(i, N)] : x[IX(i, N)];
    }
    x[IX(0, 0)] = 0.5 * (x[IX(1, 0)] + x[IX(0, 1)]);
    x[IX(0, N + 1)] = 0.5 * (x[IX(1, N + 1)] + x[IX(0, N)]);
    x[IX(N + 1, 0)] = 0.5 * (x[IX(N, 0)] + x[IX(N + 1, 1)]);
    x[IX(N + 1, N + 1)] = 0.5 * (x[IX(N, N + 1)] + x[IX(N + 1, N)]);
  }

  private lin_solve(
    b: number,
    x: Float32Array,
    x0: Float32Array,
    a: number,
    c: number,
  ) {
    const cInv = 1.0 / c;
    for (let iter = 0; iter < ITER; iter++) {
      for (let j = 1; j <= N; j++) {
        for (let i = 1; i <= N; i++) {
          x[IX(i, j)] =
            (x0[IX(i, j)] +
              a *
                (x[IX(i - 1, j)] +
                  x[IX(i + 1, j)] +
                  x[IX(i, j - 1)] +
                  x[IX(i, j + 1)])) *
            cInv;
        }
      }
      this.set_bnd(b, x);
    }
  }

  private diffuse(
    b: number,
    x: Float32Array,
    x0: Float32Array,
    diff: number,
    dt: number,
  ) {
    const a = dt * diff * N * N;
    this.lin_solve(b, x, x0, a, 1 + 4 * a);
  }

  private project(
    u: Float32Array,
    v: Float32Array,
    p: Float32Array,
    div: Float32Array,
  ) {
    const h = 1.0 / N;
    for (let j = 1; j <= N; j++) {
      for (let i = 1; i <= N; i++) {
        div[IX(i, j)] =
          -0.5 *
          h *
          (u[IX(i + 1, j)] -
            u[IX(i - 1, j)] +
            v[IX(i, j + 1)] -
            v[IX(i, j - 1)]);
        p[IX(i, j)] = 0;
      }
    }
    this.set_bnd(0, div);
    this.set_bnd(0, p);
    this.lin_solve(0, p, div, 1, 4);
    for (let j = 1; j <= N; j++) {
      for (let i = 1; i <= N; i++) {
        u[IX(i, j)] -= (0.5 * (p[IX(i + 1, j)] - p[IX(i - 1, j)])) / h;
        v[IX(i, j)] -= (0.5 * (p[IX(i, j + 1)] - p[IX(i, j - 1)])) / h;
      }
    }
    this.set_bnd(1, u);
    this.set_bnd(2, v);
  }

  private advect(
    b: number,
    d: Float32Array,
    d0: Float32Array,
    u0: Float32Array,
    v0: Float32Array,
    dt: number,
  ) {
    const dt0 = dt * N;
    for (let j = 1; j <= N; j++) {
      for (let i = 1; i <= N; i++) {
        let x = i - dt0 * u0[IX(i, j)];
        let y = j - dt0 * v0[IX(i, j)];
        if (x < 0.5) x = 0.5;
        if (x > N + 0.5) x = N + 0.5;
        if (y < 0.5) y = 0.5;
        if (y > N + 0.5) y = N + 0.5;
        const i0 = Math.floor(x),
          i1 = i0 + 1;
        const j0 = Math.floor(y),
          j1 = j0 + 1;
        const s1 = x - i0,
          s0 = 1 - s1;
        const t1 = y - j0,
          t0 = 1 - t1;
        d[IX(i, j)] =
          s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j1)]) +
          s1 * (t0 * d0[IX(i1, j0)] + t1 * d0[IX(i1, j1)]);
      }
    }
    this.set_bnd(b, d);
  }

  private vorticityConfinement(dt: number) {
    const eps = this.vorticityEpsilon;
    const h = 1.0 / N;
    const curl = this._curl;

    // compute scalar curl (z-component of vorticity): âˆ‚v/âˆ‚x - âˆ‚u/âˆ‚y
    for (let j = 1; j <= N; j++) {
      for (let i = 1; i <= N; i++) {
        curl[IX(i, j)] =
          0.5 * (this.v[IX(i + 1, j)] - this.v[IX(i - 1, j)]) / h -
          0.5 * (this.u[IX(i, j + 1)] - this.u[IX(i, j - 1)]) / h;
      }
    }

    // apply confinement force: f = eps * h * (NÌ‚ Ã— Ï‰Â·áº‘)
    // NÌ‚ = normalize(grad |Ï‰|), cross with Ï‰Â·áº‘ gives 2D force
    for (let j = 1; j <= N; j++) {
      for (let i = 1; i <= N; i++) {
        // gradient of |curl|
        const nx = 0.5 * (Math.abs(curl[IX(i + 1, j)]) - Math.abs(curl[IX(i - 1, j)])) / h;
        const ny = 0.5 * (Math.abs(curl[IX(i, j + 1)]) - Math.abs(curl[IX(i, j - 1)])) / h;
        const len = Math.sqrt(nx * nx + ny * ny) + 1e-5;
        const nnx = nx / len;
        const nny = ny / len;
        const w = curl[IX(i, j)];
        if (this.dens[IX(i, j)] < 0.05) continue;
        // (NÌ‚ Ã— Ï‰Â·áº‘): fx = nny*w, fy = -nnx*w
        this.u[IX(i, j)] += eps * h * nny * w * dt;
        this.v[IX(i, j)] -= eps * h * nnx * w * dt;
      }
    }
  }

  vel_step(dt: number) {
    for (let i = 0; i < SIZE; i++) {
      this.u[i] += dt * this.u_prev[i];
      this.v[i] += dt * this.v_prev[i];
    }
    [this.u, this.u_prev] = [this.u_prev, this.u];
    [this.v, this.v_prev] = [this.v_prev, this.v];
    this.diffuse(1, this.u, this.u_prev, VISC, dt);
    this.diffuse(2, this.v, this.v_prev, VISC, dt);
    this.project(this.u, this.v, this._p, this._div);
    [this.u, this.u_prev] = [this.u_prev, this.u];
    [this.v, this.v_prev] = [this.v_prev, this.v];
    this.advect(1, this.u, this.u_prev, this.u_prev, this.v_prev, dt);
    this.advect(2, this.v, this.v_prev, this.u_prev, this.v_prev, dt);
    this.project(this.u, this.v, this._p, this._div);
    this.vorticityConfinement(dt);
    this.clampState();
  }

  dens_step(dt: number) {
    for (let i = 0; i < SIZE; i++) {
      this.dens[i] += dt * this.dens_prev[i];
    }
    [this.dens, this.dens_prev] = [this.dens_prev, this.dens];
    this.diffuse(0, this.dens, this.dens_prev, DIFF, dt);
    [this.dens, this.dens_prev] = [this.dens_prev, this.dens];
    this.advect(0, this.dens, this.dens_prev, this.u, this.v, dt);
    for (let i = 0; i < SIZE; i++) {
      if (this.dens[i] < 0.02) this.dens[i] = 0.0;
    }
    this.clampState();
  }

  applyVelocityDamping() {
    for (let i = 0; i < SIZE; i++) {
      this.u[i] *= VELOCITY_DAMPING;
      this.v[i] *= VELOCITY_DAMPING;
    }
    this.clampState();
  }

  applyDensityDecay() {
    for (let i = 0; i < SIZE; i++) {
      this.dens[i] *= DENSITY_DECAY;
    }
    this.clampState();
  }

  clampState() {
    for (let i = 0; i < SIZE; i++) {
      this.u[i] = safeClamp(this.u[i], FLUID_VELOCITY_MIN, FLUID_VELOCITY_MAX);
      this.v[i] = safeClamp(this.v[i], FLUID_VELOCITY_MIN, FLUID_VELOCITY_MAX);
      this.u_prev[i] = safeFinite(this.u_prev[i]);
      this.v_prev[i] = safeFinite(this.v_prev[i]);
      this.dens[i] = safeClamp(this.dens[i], FLUID_DENSITY_MIN, FLUID_DENSITY_MAX);
      this.dens_prev[i] = safeFinite(this.dens_prev[i]);
    }
  }

  splat(
    ci: number,
    cj: number,
    fx: number,
    fy: number,
    density: number,
    radius: number,
  ) {
    for (let dj = -radius; dj <= radius; dj++) {
      for (let di = -radius; di <= radius; di++) {
        if (di * di + dj * dj > radius * radius) continue;
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 1 || ni > N || nj < 1 || nj > N) continue;
        const falloff = 1 - (di * di + dj * dj) / (radius * radius + 1);
        this.u_prev[IX(ni, nj)] += fx * falloff;
        this.v_prev[IX(ni, nj)] += fy * falloff;
        this.dens_prev[IX(ni, nj)] += density * falloff;
      }
    }
  }
}

