import {
  GRAVITY,
  PLAYER_R,
  SPARK_COUNT, SPARK_LIFE, SPARK_SPEED,
  TRAIL_LIFE, TRAIL_MAX,
} from "../constants";
import type { GameState } from "../types";

export function updateAmbient(state: GameState, dt: number) {
  for (const p of state.ambientParticles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life += dt;
    p.x += Math.sin(p.life * 0.4 + p.y * 0.01) * 0.02;
    p.y += Math.cos(p.life * 0.35 + p.x * 0.01) * 0.02;
    if (p.x < -20) p.x = state.W + 20;
    if (p.x > state.W + 20) p.x = -20;
    if (p.y < -20) p.y = state.H + 20;
    if (p.y > state.H + 20) p.y = -20;
  }
}

export function spawnLandSparks(state: GameState) {
  for (let i = 0; i < SPARK_COUNT; i++) {
    const angle = Math.PI + (Math.random() - 0.5) * Math.PI * 0.65;
    const spd = (0.4 + Math.random() * 0.6) * SPARK_SPEED;
    state.sparks.push({
      x: state.player.x,
      y: state.player.y + PLAYER_R,
      vx: Math.cos(angle) * spd + state.player.vx * 0.25,
      vy: Math.sin(angle) * spd,
      life: SPARK_LIFE * (0.7 + Math.random() * 0.3),
    });
  }
}

export function updateSparks(state: GameState, dt: number) {
  const sparks = state.sparks;
  for (let i = sparks.length - 1; i >= 0; i--) {
    sparks[i].x += sparks[i].vx * dt;
    sparks[i].y += sparks[i].vy * dt;
    sparks[i].vy += GRAVITY * 0.6 * dt;
    sparks[i].life -= dt;
    if (sparks[i].life <= 0) sparks.splice(i, 1);
  }
}

export function updateShards(state: GameState, dt: number) {
  const shards = state.shards;
  for (let i = shards.length - 1; i >= 0; i--) {
    shards[i].x += shards[i].vx * dt;
    shards[i].y += shards[i].vy * dt;
    shards[i].vy += GRAVITY * 0.7 * dt;
    shards[i].vx *= 0.985;
    shards[i].angle += shards[i].spin * dt;
    shards[i].life -= dt;
    if (shards[i].life <= 0) shards.splice(i, 1);
  }
}

export function updateTrail(state: GameState, dt: number) {
  state.trail.unshift({ x: state.player.x, y: state.player.y, life: TRAIL_LIFE });
  if (state.trail.length > TRAIL_MAX) state.trail.length = TRAIL_MAX;
  for (let i = state.trail.length - 1; i >= 0; i--) {
    state.trail[i].life -= dt;
    if (state.trail[i].life <= 0) state.trail.splice(i, 1);
  }
}
