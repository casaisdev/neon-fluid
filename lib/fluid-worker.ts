/// <reference lib="webworker" />

import { FluidSim } from "./fluid";
import {
  CTRL_CMD, CTRL_READY, CMD_IDLE, CMD_STEP,
  FluidSharedBuffers, FluidSharedSABs,
} from "./fluid-shared";

let sim: FluidSim;
let shared: FluidSharedBuffers;

function runLoop() {
  while (true) {
    // Block until ctrl[CTRL_CMD] !== CMD_IDLE (i.e. main sets it to CMD_STEP)
    Atomics.wait(shared.ctrl, CTRL_CMD, CMD_IDLE);

    // Confirm it's a step request (not a spurious wakeup)
    if (Atomics.load(shared.ctrl, CTRL_CMD) !== CMD_STEP) continue;

    const dt = shared.dtBuf[0];

    // Copy force inputs into sim (u_prev/v_prev/dens_prev are force accumulators)
    sim.u_prev.set(shared.sharedUPrev);
    sim.v_prev.set(shared.sharedVPrev);
    sim.dens_prev.set(shared.sharedDensPrev);

    // Run full CPU step (same order as original main-thread code)
    sim.vel_step(dt);
    sim.applyVelocityDamping();
    sim.dens_step(dt);
    sim.applyDensityDecay();

    // Copy results to shared output buffers
    // Note: after vel_step/dens_step the swap pattern means sim.u/v/dens
    // hold the current state — sim.u_prev/dens_prev are scratch from the swap.
    shared.sharedUOut.set(sim.u);
    shared.sharedVOut.set(sim.v);
    shared.sharedDensOut.set(sim.dens);

    // Signal output ready, then go back to idle
    Atomics.store(shared.ctrl, CTRL_READY, 1);
    Atomics.store(shared.ctrl, CTRL_CMD, CMD_IDLE);
    // No notify needed — main polls CTRL_READY each frame, doesn't Atomics.wait
  }
}

self.addEventListener("message", (e: MessageEvent) => {
  if (sim) return;  // guard against double-init (React StrictMode)
  const sabs = e.data as FluidSharedSABs;

  shared = {
    ctrl:           new Int32Array(sabs.ctrlSAB),
    dtBuf:          new Float32Array(sabs.dtSAB),
    sharedUPrev:    new Float32Array(sabs.uPrevSAB),
    sharedVPrev:    new Float32Array(sabs.vPrevSAB),
    sharedDensPrev: new Float32Array(sabs.densPrevSAB),
    sharedUOut:     new Float32Array(sabs.uOutSAB),
    sharedVOut:     new Float32Array(sabs.vOutSAB),
    sharedDensOut:  new Float32Array(sabs.densOutSAB),
  };

  sim = new FluidSim();
  runLoop();
});
