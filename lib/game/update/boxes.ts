import { FluidSim, IX } from "../../fluid";
import type { GameAudio } from "../audio";
import {
  BOX_AIR_FRIC,
  BOX_BOUNCE,
  BOX_FLUID_SCALE,
  BOX_GRAVITY_MULT,
  BOX_GROUND_FRIC,
  BOX_MAX_HSPEED,
  BOX_MAX_VSPEED,
  GRAVITY,
  PLAYER_R,
  clamp,
} from "../constants";
import { toGrid } from "../layout";
import type { Box, GameState } from "../types";

const BOX_FLUID_RESPONSE_BOOST = 0.68;
const BOX_FLUID_EFFECTIVE_SPEED_REF = 2.25;
const BOX_FLUID_TAP_COOLDOWN = 0.16;
const BOX_FLUID_TAP_DELTA_THRESHOLD = 0.32;
const BOX_FLUID_TAP_IMPULSE_X = 145;
const BOX_FLUID_TAP_IMPULSE_Y = 42;

function sampleBoxFluid(state: GameState, fluid: FluidSim, box: Box) {
  const samples = [
    { x: 0, y: 0, w: 1.5 },
    { x: -box.w * 0.48, y: 0, w: 1.25 },
    { x: box.w * 0.48, y: 0, w: 1.25 },
    { x: -box.w * 0.48, y: -box.h * 0.35, w: 0.8 },
    { x: box.w * 0.48, y: -box.h * 0.35, w: 0.8 },
    { x: -box.w * 0.48, y: box.h * 0.35, w: 0.9 },
    { x: box.w * 0.48, y: box.h * 0.35, w: 0.9 },
  ];

  let totalWeight = 0;
  let u = 0;
  let v = 0;
  for (const sample of samples) {
    const gi = toGrid(box.x + sample.x, state.W);
    const gj = toGrid(box.y + sample.y, state.H);
    const idx = IX(gi, gj);
    u += fluid.u[idx] * sample.w;
    v += fluid.v[idx] * sample.w;
    totalWeight += sample.w;
  }

  return {
    u: u / totalWeight,
    v: v / totalWeight,
  };
}

export function updateBoxes(
  state: GameState,
  fluid: FluidSim,
  audio: GameAudio,
  dt: number,
) {
  for (const box of state.boxes) {
    const { u: fu, v: fv } = sampleBoxFluid(state, fluid, box);
    const fluidSpeed = Math.hypot(fu, fv);
    box.fluidTapCooldown = Math.max(0, box.fluidTapCooldown - dt);
    if (fluidSpeed > 0) {
      const scale =
        BOX_FLUID_SCALE *
        BOX_FLUID_RESPONSE_BOOST *
        (fluidSpeed / BOX_FLUID_EFFECTIVE_SPEED_REF);
      box.vx += fu * scale * dt;
      box.vy += fv * scale * dt;
    }

    const deltaU = fu - box.lastFluidU;
    const deltaV = fv - box.lastFluidV;
    const deltaSpeed = Math.hypot(deltaU, deltaV);
    if (
      box.fluidTapCooldown <= 0 &&
      deltaSpeed >= BOX_FLUID_TAP_DELTA_THRESHOLD &&
      Math.abs(deltaU) > Math.abs(deltaV) * 0.45
    ) {
      const dir = Math.sign(deltaU) || Math.sign(fu) || 1;
      const strength = Math.min(1, deltaSpeed / 1.25);
      box.vx += dir * BOX_FLUID_TAP_IMPULSE_X * strength;
      box.vy += Math.min(0, deltaV) * BOX_FLUID_TAP_IMPULSE_Y * strength;
      box.fluidTapCooldown = BOX_FLUID_TAP_COOLDOWN;
    }
    box.lastFluidU = fu;
    box.lastFluidV = fv;

    // Heavy gravity — boxes feel massive, fall fast
    const grav = box.vy > 0
      ? GRAVITY * BOX_GRAVITY_MULT * 1.5
      : GRAVITY * BOX_GRAVITY_MULT;
    box.vy += grav * dt;

    box.vx *= box.onGround ? BOX_GROUND_FRIC : BOX_AIR_FRIC;
    box.vx = clamp(box.vx, -BOX_MAX_HSPEED, BOX_MAX_HSPEED);
    box.vy = clamp(box.vy, -BOX_MAX_VSPEED, BOX_MAX_VSPEED);

    const prevBoxBottom = box.y + box.h / 2;
    box.x += box.vx * dt;
    box.y += box.vy * dt;

    box.onGround = false;
    const bLeft = box.x - box.w / 2;
    const bRight = box.x + box.w / 2;
    const bBottom = box.y + box.h / 2;

    for (const plat of state.platforms) {
      const inX = bRight > plat.x + 1 && bLeft < plat.x + plat.w - 1;
      if (!inX) continue;
      if (prevBoxBottom <= plat.y + 2 && bBottom >= plat.y && box.vy >= 0) {
        const prevVy = box.vy;
        box.y = plat.y - box.h / 2;
        const rebound = Math.abs(box.vy) * BOX_BOUNCE;
        box.vy = rebound > 45 ? -rebound : 0;
        box.onGround = true;
        audio.boxLand(Math.abs(prevVy));
      }
    }

    if (box.x - box.w / 2 < 0) {
      box.x = box.w / 2;
      box.vx = Math.abs(box.vx) * 0.25;
    }
    if (box.x + box.w / 2 > state.W) {
      box.x = state.W - box.w / 2;
      box.vx = -Math.abs(box.vx) * 0.25;
    }

    if (box.y > state.H + 120) {
      box.x = box.initX;
      box.y = box.initY;
      box.vx = 0;
      box.vy = 0;
      box.onGround = false;
      box.lastFluidU = 0;
      box.lastFluidV = 0;
      box.fluidTapCooldown = 0;
    }
  }
}

export function resolveBoxBoxCollisions(state: GameState, audio: GameAudio) {
  const boxes = state.boxes;
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      const ba = boxes[a];
      const bb = boxes[b];
      const dx = bb.x - ba.x;
      const dy = bb.y - ba.y;
      const overlapX = (ba.w + bb.w) / 2 - Math.abs(dx);
      const overlapY = (ba.h + bb.h) / 2 - Math.abs(dy);
      if (overlapX <= 0 || overlapY <= 0) continue;

      if (overlapX < overlapY) {
        // Horizontal: separate and exchange momentum with restitution
        const push = overlapX / 2;
        const nx = Math.sign(dx);
        ba.x -= nx * push;
        bb.x += nx * push;

        // Equal-mass impulse (e=0.55 partial restitution — satisfying thunk)
        const vRel = (bb.vx - ba.vx) * nx;
        if (vRel < 0) {
          const j = (1 + 0.55) * vRel / 2;
          ba.vx += j * nx;
          bb.vx -= j * nx;
          audio.boxBoxCollide(Math.abs(vRel));
        }
      } else {
        // Vertical: stacking with momentum transfer
        if (dy < 0) {
          // bb is above ba — bb lands on ba
          bb.y = ba.y - ba.h / 2 - bb.h / 2;
          if (bb.vy > ba.vy) {
            const impact = bb.vy - ba.vy;
            ba.vy += impact * 0.2; // lower box gets nudged down
            bb.vy = ba.vy;         // upper box rides lower box
          }
          bb.onGround = true;
        } else {
          // ba is above bb — ba lands on bb
          ba.y = bb.y - bb.h / 2 - ba.h / 2;
          if (ba.vy > bb.vy) {
            const impact = ba.vy - bb.vy;
            bb.vy += impact * 0.2;
            ba.vy = bb.vy;
          }
          ba.onGround = true;
        }
      }
    }
  }
}

export function resolvePlayerBoxPush(state: GameState) {
  const { player } = state;
  for (const box of state.boxes) {
    const dx = box.x - player.x;
    const dy = box.y - player.y;
    const overlapX = box.w / 2 + PLAYER_R - Math.abs(dx);
    const overlapY = box.h / 2 + PLAYER_R - Math.abs(dy);
    if (overlapX <= 0 || overlapY <= 0) continue;

    if (overlapX < overlapY) {
      // Horizontal: box gets shoved by player
      box.x += Math.sign(dx) * overlapX;
      box.vx += player.vx * 0.55;
    } else if (dy > 0) {
      // Box below player: player lands on top, box slides and moves
      if (player.vy >= -20) {
        const impactVy = player.vy;
        player.y = box.y - box.h / 2 - PLAYER_R;
        player.vy = 0;
        player.onGround = true;
        // Landing: horizontal momentum makes box slide, downward impact gives it a shove
        box.vx += player.vx * 0.4;
        box.vy += Math.max(0, impactVy) * 0.2;
      }
    } else {
      // Box above player: head-bump sends box upward
      box.y = player.y - PLAYER_R - box.h / 2;
      if (player.vy < 0) {
        box.vy = Math.min(box.vy, player.vy * 0.4);
      }
    }
  }
}
