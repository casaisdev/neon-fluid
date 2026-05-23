import type { LevelDef } from "./types";

export const CONTROLLED = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "Space",
  "KeyR",
  "Enter",
]);

const helperCloud = (
  x: number,
  y: number,
  strength = 240,
): NonNullable<LevelDef["blowers"]>[number] => ({
  x,
  y,
  dirX: 0,
  dirY: -1,
  strength: strength * 0.72,
  density: 24,
  radius: 6,
  intervalMin: 2.4,
  intervalMax: 3.2,
  burstDuration: 0.72,
});

export const LEVELS: LevelDef[] = [
  {
    // Level 1: basic climb, no assists.
    platforms: [
      { x: 0.05, y: 0.8, w: 0.18 },
      { x: 0.28, y: 0.71, w: 0.15 },
      { x: 0.48, y: 0.62, w: 0.15 },
      { x: 0.68, y: 0.53, w: 0.15 },
      { x: 0.84, y: 0.44, w: 0.11 },
    ],
    spawn: { x: 0.11, y: 0.8 },
    goal: { x: 0.89, y: 0.38 },
  },
  {
    // Level 2: boxes appear, jumps are still readable.
    platforms: [
      { x: 0.04, y: 0.82, w: 0.18 },
      { x: 0.27, y: 0.72, w: 0.14 },
      { x: 0.47, y: 0.63, w: 0.14 },
      { x: 0.67, y: 0.53, w: 0.14 },
      { x: 0.84, y: 0.43, w: 0.12 },
    ],
    spawn: { x: 0.1, y: 0.82 },
    goal: { x: 0.9, y: 0.37 },
    movingPlatforms: [
      { x: 0.18, y: 0.78, w: 0.08, axis: "x", distance: 0.055, speed: 55 },
      { x: 0.78, y: 0.52, w: 0.07, axis: "y", distance: 0.055, speed: 45 },
    ],
    boxes: [
      { x: 0.34, y: 0.72 },
      { x: 0.54, y: 0.63 },
    ],
    spikes: [
      { x: 0.76, y: 0.53, w: 0.05 },
    ],
  },
  {
    // Level 3: first barrier, solved with mouse waves.
    platforms: [
      { x: 0.05, y: 0.82, w: 0.17 },
      { x: 0.28, y: 0.72, w: 0.14 },
      { x: 0.48, y: 0.62, w: 0.14 },
      { x: 0.68, y: 0.51, w: 0.14 },
      { x: 0.84, y: 0.4, w: 0.12 },
    ],
    spawn: { x: 0.1, y: 0.82 },
    goal: { x: 0.9, y: 0.34 },
    barriers: [
      { x: 0.43, y: 0.69, w: 0.038, h: 0.28 },
    ],
    enemies: [
      { x: 0.58, y: 0.62, patrolDistance: 0.07, speed: 70 },
    ],
  },
  {
    // Level 4: switch and gate before the route gets wider.
    platforms: [
      { x: 0.04, y: 0.82, w: 0.16 },
      { x: 0.24, y: 0.72, w: 0.13 },
      { x: 0.42, y: 0.62, w: 0.13 },
      { x: 0.6, y: 0.51, w: 0.13 },
      { x: 0.8, y: 0.4, w: 0.15 },
    ],
    spawn: { x: 0.09, y: 0.82 },
    switch: { x: 0.48, y: 0.62 },
    gate: { x: 0.85, y: 0.4 - 0.1, w: 0.0, h: 0.1 },
    goal: { x: 0.9, y: 0.4 - 0.03 },
    boxes: [
      { x: 0.305, y: 0.72 },
    ],
  },
  {
    // Level 5: first pure mouse-wave climb lesson (no helper cloud).
    platforms: [
      { x: 0.04, y: 0.82, w: 0.22 },
      { x: 0.53, y: 0.56, w: 0.24 },
      { x: 0.79, y: 0.45, w: 0.15 },
      { x: 0.89, y: 0.36, w: 0.1 },
    ],
    spawn: { x: 0.1, y: 0.82 },
    goal: { x: 0.93, y: 0.3 },
  },
  {
    // Level 6: cloud jump followed by controlled box landings.
    platforms: [
      { x: 0.03, y: 0.84, w: 0.16 },
      { x: 0.54, y: 0.65, w: 0.1 },
      { x: 0.6, y: 0.58, w: 0.12 },
      { x: 0.76, y: 0.49, w: 0.12 },
      { x: 0.89, y: 0.39, w: 0.09 },
    ],
    spawn: { x: 0.09, y: 0.84 },
    goal: { x: 0.93, y: 0.33 },
    blowers: [
      helperCloud(0.36, 0.9, 335),
    ],
    boxes: [
      { x: 0.49, y: 0.65 },
      { x: 0.66, y: 0.58 },
    ],
  },
  {
    // Level 7: barrier pressure after a cloud-assisted gap.
    platforms: [
      { x: 0.04, y: 0.84, w: 0.15 },
      { x: 0.5, y: 0.65, w: 0.1 },
      { x: 0.56, y: 0.55, w: 0.12 },
      { x: 0.73, y: 0.45, w: 0.12 },
      { x: 0.88, y: 0.34, w: 0.1 },
    ],
    spawn: { x: 0.09, y: 0.84 },
    goal: { x: 0.92, y: 0.28 },
    blowers: [
      helperCloud(0.33, 0.9, 340),
    ],
    barriers: [
      { x: 0.53, y: 0.6, w: 0.04, h: 0.28 },
    ],
  },
  {
    // Level 8: switch route with one mandatory cloud crossing.
    platforms: [
      { x: 0.03, y: 0.84, w: 0.15 },
      { x: 0.22, y: 0.74, w: 0.11 },
      { x: 0.39, y: 0.64, w: 0.09 },
      { x: 0.73, y: 0.48, w: 0.12 },
      { x: 0.87, y: 0.37, w: 0.1 },
    ],
    spawn: { x: 0.08, y: 0.84 },
    switch: { x: 0.48, y: 0.64 },
    gate: { x: 0.9, y: 0.37 - 0.1, w: 0.0, h: 0.1 },
    goal: { x: 0.93, y: 0.31 },
    blowers: [
      helperCloud(0.58, 0.85, 345),
    ],
  },
  {
    // Level 9: clouds, boxes, and wind share the same route.
    platforms: [
      { x: 0.03, y: 0.86, w: 0.14 },
      { x: 0.36, y: 0.7, w: 0.095 },
      { x: 0.49, y: 0.6, w: 0.1 },
      { x: 0.66, y: 0.48, w: 0.1 },
      { x: 0.84, y: 0.36, w: 0.12 },
    ],
    spawn: { x: 0.08, y: 0.86 },
    goal: { x: 0.9, y: 0.3 },
    blowers: [
      helperCloud(0.25, 0.91, 335),
    ],
    boxes: [
      { x: 0.54, y: 0.6 },
      { x: 0.71, y: 0.48 },
    ],
  },
  {
    // Level 10: two required cloud jumps plus switch, gate, and barriers.
    platforms: [
      { x: 0.04, y: 0.87, w: 0.13 },
      { x: 0.34, y: 0.7, w: 0.09 },
      { x: 0.49, y: 0.58, w: 0.1 },
      { x: 0.77, y: 0.4, w: 0.1 },
      { x: 0.89, y: 0.28, w: 0.09 },
    ],
    spawn: { x: 0.085, y: 0.87 },
    switch: { x: 0.54, y: 0.58 },
    gate: { x: 0.915, y: 0.28 - 0.105, w: 0.0, h: 0.105 },
    goal: { x: 0.93, y: 0.22 },
    blowers: [
      helperCloud(0.24, 0.92, 340),
      helperCloud(0.66, 0.79, 345),
    ],
    barriers: [
      { x: 0.46, y: 0.64, w: 0.04, h: 0.26 },
      { x: 0.73, y: 0.48, w: 0.04, h: 0.3 },
    ],
  },
];

import { generateLevel } from './generate';

export const LEVEL_COUNT = 100;

export function getLevel(index: number) {
  return index < LEVELS.length ? LEVELS[index] : generateLevel(index);
}
