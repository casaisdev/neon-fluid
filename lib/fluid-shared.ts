import { N } from "./fluid";

export const SIZE = (N + 2) * (N + 2);

// ctrl indices
export const CTRL_CMD   = 0; // 0=idle, 1=step
export const CTRL_READY = 1; // worker sets to 1 when output ready; main resets to 0 after reading
export const CMD_IDLE   = 0;
export const CMD_STEP   = 1;

export interface FluidSharedBuffers {
  ctrl:          Int32Array;
  dtBuf:         Float32Array;
  sharedUPrev:   Float32Array;
  sharedVPrev:   Float32Array;
  sharedDensPrev: Float32Array;
  sharedUOut:    Float32Array;
  sharedVOut:    Float32Array;
  sharedDensOut: Float32Array;
}

export interface FluidSharedSABs {
  ctrlSAB:       SharedArrayBuffer;
  dtSAB:         SharedArrayBuffer;
  uPrevSAB:      SharedArrayBuffer;
  vPrevSAB:      SharedArrayBuffer;
  densPrevSAB:   SharedArrayBuffer;
  uOutSAB:       SharedArrayBuffer;
  vOutSAB:       SharedArrayBuffer;
  densOutSAB:    SharedArrayBuffer;
}

export function createFluidSharedBuffers(): { views: FluidSharedBuffers; sabs: FluidSharedSABs } {
  const byteLen = SIZE * Float32Array.BYTES_PER_ELEMENT;

  const ctrlSAB     = new SharedArrayBuffer(2 * Int32Array.BYTES_PER_ELEMENT);
  const dtSAB       = new SharedArrayBuffer(1 * Float32Array.BYTES_PER_ELEMENT);
  const uPrevSAB    = new SharedArrayBuffer(byteLen);
  const vPrevSAB    = new SharedArrayBuffer(byteLen);
  const densPrevSAB = new SharedArrayBuffer(byteLen);
  const uOutSAB     = new SharedArrayBuffer(byteLen);
  const vOutSAB     = new SharedArrayBuffer(byteLen);
  const densOutSAB  = new SharedArrayBuffer(byteLen);

  return {
    views: {
      ctrl:           new Int32Array(ctrlSAB),
      dtBuf:          new Float32Array(dtSAB),
      sharedUPrev:    new Float32Array(uPrevSAB),
      sharedVPrev:    new Float32Array(vPrevSAB),
      sharedDensPrev: new Float32Array(densPrevSAB),
      sharedUOut:     new Float32Array(uOutSAB),
      sharedVOut:     new Float32Array(vOutSAB),
      sharedDensOut:  new Float32Array(densOutSAB),
    },
    sabs: { ctrlSAB, dtSAB, uPrevSAB, vPrevSAB, densPrevSAB, uOutSAB, vOutSAB, densOutSAB },
  };
}
