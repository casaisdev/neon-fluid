import { FluidSim, IX } from "../../fluid";
import type { GameAudio } from "../audio";
import {
  BARRIER_DAMAGE_RATE,
  BARRIER_FLUID_THRESHOLD,
  BARRIER_HIT_FLASH,
  BARRIER_SHARD_COUNT,
  PLAYER_R,
} from "../constants";
import { showTutorial, toGrid } from "../layout";
import type { GameState } from "../types";

export function updateBarriers(
  state: GameState,
  fluid: FluidSim,
  audio: GameAudio,
  dt: number,
) {
  const { player } = state;
  for (const bar of state.barriers) {
    bar.hitTimer = Math.max(0, bar.hitTimer - dt);
    if (bar.broken) continue;

    // Proximity tutorial: show when player is within 380px of an unbroken barrier
    const distToBar = Math.hypot(player.x - bar.x, player.y - bar.y);
    if (distToBar < 380) {
      showTutorial(
        state,
        "barrier",
        "Barrier ahead: click and drag nearby to build fluid pressure and break it.",
      );
    }

    const bi = toGrid(bar.x, state.W);
    const bj = toGrid(bar.y, state.H);
    const bidx = IX(bi, bj);
    const fluidSpeed = Math.hypot(fluid.u[bidx], fluid.v[bidx]);
    if (fluidSpeed > BARRIER_FLUID_THRESHOLD) {
      const dmg =
        (fluidSpeed - BARRIER_FLUID_THRESHOLD) * BARRIER_DAMAGE_RATE * dt;
      bar.health -= dmg;
      bar.hitTimer = BARRIER_HIT_FLASH;
      if (bar.health <= 0) {
        bar.health = 0;
        bar.broken = true;
        audio.barrierHitStop();
        audio.barrierBreak();
        const hw = bar.w / 2;
        const hh = bar.h / 2;
        for (let s = 0; s < BARRIER_SHARD_COUNT; s++) {
          const angle = (s / BARRIER_SHARD_COUNT) * Math.PI * 2;
          const spd = 80 + Math.random() * 260;
          state.shards.push({
            x: bar.x + (Math.random() - 0.5) * hw * 2,
            y: bar.y + (Math.random() - 0.5) * hh * 2,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 60,
            life: 0.55 + Math.random() * 0.35,
            size: 3 + Math.random() * 7,
            angle: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 14,
          });
        }
      } else {
        audio.barrierHitStart();
      }
    } else {
      audio.barrierHitStop();
    }

    // Solid collision: push player out of intact barrier
    const bLeft = bar.x - bar.w / 2;
    const bRight = bar.x + bar.w / 2;
    const bTop = bar.y - bar.h / 2;
    const bBot = bar.y + bar.h / 2;
    const overlapX =
      Math.min(player.x + PLAYER_R, bRight) -
      Math.max(player.x - PLAYER_R, bLeft);
    const overlapY =
      Math.min(player.y + PLAYER_R, bBot) -
      Math.max(player.y - PLAYER_R, bTop);
    if (overlapX > 0 && overlapY > 0) {
      audio.playerBarrierTouch();
      if (overlapX <= overlapY) {
        player.x += player.x < bar.x ? -overlapX : overlapX;
        player.vx = 0;
      } else {
        if (player.y < bar.y) {
          player.y -= overlapY;
          player.vy = 0;
          player.onGround = true;
        } else {
          player.y += overlapY;
          if (player.vy < 0) player.vy = 0;
        }
      }
    }
  }
}
