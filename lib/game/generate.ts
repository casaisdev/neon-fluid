import { GRAVITY, GOAL_R, JUMP_VEL, MAX_HSPEED } from './constants';
import type { LevelDef } from './types';

const REF_W = 800;
const REF_H = 600;
const T_AIR = (2 * Math.abs(JUMP_VEL)) / GRAVITY;
const MAX_JUMP_DX = (MAX_HSPEED * T_AIR) / REF_W;
const MAX_JUMP_DY = (JUMP_VEL * JUMP_VEL) / (2 * GRAVITY * REF_H);

export function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateLevel(levelIndex: number): LevelDef {
  const rand = mulberry32(levelIndex);
  const d = Math.min(1, Math.max(0, (levelIndex - 10) / 90));

  const platformCount = 5 + Math.floor(d * 4);
  const platformW = 0.14 - d * 0.06;

  const platforms: Array<{ x: number; y: number; w: number }> = [];
  let cx = 0.08;
  let cy = 0.82;
  platforms.push({ x: cx, y: cy, w: 0.16 });

  for (let i = 1; i < platformCount; i++) {
    let dx = 0, dy = 0;
    let attempts = 0;
    do {
      dx = (rand() < 0.15 ? -1 : 1) * (0.08 + rand() * 0.22);
      dy = -(0.05 + rand() * 0.14);
      attempts++;
    } while (attempts < 5 && (Math.abs(dx) > MAX_JUMP_DX || -dy > MAX_JUMP_DY));

    const sign = dx < 0 ? -1 : 1;
    dx = sign * Math.min(Math.abs(dx), MAX_JUMP_DX * 0.9);
    dy = Math.max(dy, -MAX_JUMP_DY * 0.9);

    cx = Math.max(0.08, Math.min(cx + dx, 0.92 - platformW));
    cy = Math.max(cy + dy, 0.08);
    platforms.push({ x: cx, y: cy, w: platformW });
  }

  const last = platforms[platforms.length - 1];
  const def: LevelDef = {
    platforms,
    spawn: { x: platforms[0].x + 0.04, y: platforms[0].y },
    goal: { x: last.x + last.w * 0.4, y: last.y - GOAL_R / REF_H },
  };

  // Moving platforms (d >= 0) — replace static platform with moving one
  if (rand() < 0.3 + d * 0.2 && platforms.length > 3) {
    const pi = 1 + Math.floor(rand() * (platforms.length - 2));
    const p = platforms[pi];
    def.movingPlatforms = [{
      x: p.x + p.w / 2, y: p.y,
      w: p.w * 0.7,
      axis: rand() < 0.5 ? 'x' : 'y',
      distance: 0.04 + rand() * 0.04,
      speed: 40 + rand() * 30,
    }];
    platforms.splice(pi, 1);
  }

  // Boxes (d >= 0)
  if (platforms.length > 1) {
    const pi = 1 + Math.floor(rand() * Math.max(1, platforms.length - 2));
    const p = platforms[pi];
    def.boxes = [{ x: p.x + p.w * 0.5, y: p.y - 0.01 }];
  }

  // Enemies (d >= 0.25)
  if (d >= 0.25 && rand() < 0.3 + (d - 0.25) * 0.5 && platforms.length > 2) {
    const pi = 1 + Math.floor(rand() * (platforms.length - 2));
    const p = platforms[pi];
    def.enemies = [{ x: p.x + p.w * 0.5, y: p.y, patrolDistance: p.w * 0.4, speed: 50 + rand() * 40 }];
    if (d >= 0.75 && rand() < 0.4 && platforms.length > 3) {
      const pi2 = pi + 1 + Math.floor(rand() * Math.max(1, platforms.length - pi - 2));
      if (pi2 < platforms.length - 1) {
        const p2 = platforms[pi2];
        def.enemies.push({ x: p2.x + p2.w * 0.5, y: p2.y, patrolDistance: p2.w * 0.4, speed: 60 + rand() * 50 });
      }
    }
  }

  // Blowers (early generated levels keep the cloud mechanic visible)
  if (d < 0.25 || rand() < 0.3 + Math.max(0, d - 0.25) * 0.3) {
    def.blowers = [{
      x: 0.3 + rand() * 0.4, y: 0.95,
      dirX: 0, dirY: -1,
      strength: 240 + rand() * 120,
      density: 20, radius: 5,
      intervalMin: 2.0, intervalMax: 3.5, burstDuration: 0.6,
    }];
  }

  // Barriers (d >= 0.5)
  if (d >= 0.5 && rand() < 0.3 + (d - 0.5) * 0.5 && platforms.length > 3) {
    const pi = 1 + Math.floor(rand() * (platforms.length - 2));
    const p = platforms[pi];
    def.barriers = [{ x: p.x - 0.02, y: p.y - 0.2, w: 0.035, h: 0.2 }];
  }

  // Spikes (d >= 0.5)
  if (d >= 0.5 && rand() < 0.25 + (d - 0.5) * 0.4 && platforms.length > 1) {
    const pi = 1 + Math.floor(rand() * (platforms.length - 1));
    const p = platforms[pi];
    def.spikes = [{ x: p.x + p.w * 0.6, y: p.y, w: p.w * 0.25 }];
  }

  // Switch + gate (d >= 0.75)
  if (d >= 0.75 && rand() < 0.4 && platforms.length >= 4) {
    const midIdx = Math.floor(platforms.length / 2);
    const mid = platforms[midIdx];
    def.switch = { x: mid.x + mid.w * 0.5, y: mid.y };
    def.gate = { x: last.x + last.w * 0.8, y: last.y - 0.1, w: 0, h: 0.1 };
  }

  return def;
}
