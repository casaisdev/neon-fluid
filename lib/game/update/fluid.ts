import { FluidSim, IX, N } from "../../fluid";
import type { GameAudio } from "../audio";
import {
  HELPER_CLOUD_DOUBLE_JUMP_THRESHOLD,
  PLAYER_FLUID_SAMPLE_RADIUS,
  PLAYER_R,
  WIND_SCALE,
  clamp,
} from "../constants";
import { getLevel } from "../levels";
import { showTutorial, toGrid } from "../layout";
import type { FluidSplatSink, GameState } from "../types";

function nextBlowerCooldown(intervalMin: number, intervalMax: number) {
  return intervalMin + Math.random() * (intervalMax - intervalMin);
}

function constrainCloudColumn(state: GameState, fluid: FluidSim, blower: GameState["blowers"][number]) {
  const scale = Math.min(state.W, state.H);
  const halfWidthPx = Math.max(blower.radius * 2.2, scale * 0.018);
  const fenceWidthPx = Math.max(blower.radius * 1.2, scale * 0.01);
  const columnTopPx = blower.y + blower.aimY * scale * 0.24;
  const topY = Math.min(blower.y, columnTopPx);
  const bottomY = Math.max(blower.y, columnTopPx);
  const leftInner = blower.x - halfWidthPx;
  const rightInner = blower.x + halfWidthPx;
  const leftOuter = leftInner - fenceWidthPx;
  const rightOuter = rightInner + fenceWidthPx;

  const giMin = toGrid(leftOuter, state.W);
  const giMax = toGrid(rightOuter, state.W);
  const gjMin = toGrid(topY, state.H);
  const gjMax = toGrid(bottomY, state.H);

  for (let gj = gjMin; gj <= gjMax; gj++) {
    for (let gi = giMin; gi <= giMax; gi++) {
      const x = ((gi - 0.5) / N) * state.W;
      const outsideLeft = x < leftInner;
      const outsideRight = x > rightInner;
      if (!outsideLeft && !outsideRight) continue;

      const wallDist = outsideLeft ? leftInner - x : x - rightInner;
      const wallMix = clamp(wallDist / fenceWidthPx, 0, 1);
      const idx = IX(gi, gj);
      const lateralDamp = 1 - wallMix * 0.92;
      const densityDamp = 1 - wallMix * 0.55;

      fluid.u[idx] *= lateralDamp;
      fluid.u_prev[idx] *= lateralDamp;
      fluid.dens[idx] *= densityDamp;
      fluid.dens_prev[idx] *= densityDamp;
    }
  }
}

function isPlayerInActiveHelperCloud(state: GameState) {
  const scale = Math.min(state.W, state.H);
  for (const blower of state.blowers) {
    if (blower.aimY >= -0.6) continue;

    const halfWidthPx = Math.max(PLAYER_R * 6.5, scale * 0.09);
    const columnTopPx = blower.y + blower.aimY * scale * 0.5;
    const topY = Math.min(blower.y, columnTopPx) - PLAYER_R * 1.5;
    const bottomY = Math.max(blower.y, columnTopPx) + PLAYER_R * 5.5;
    if (
      Math.abs(state.player.x - blower.x) <= halfWidthPx &&
      state.player.y >= topY &&
      state.player.y <= bottomY
    ) {
      return true;
    }
  }
  return false;
}

export function emitLevelWinds(
  state: GameState,
  fluid: FluidSim,
  dt: number,
  onSplat?: FluidSplatSink,
) {
  const levelWinds = getLevel(state.currentLevel).winds;
  if (!levelWinds || levelWinds.length === 0) return;
  for (const wind of levelWinds) {
    const x = wind.x * state.W;
    const y = wind.y * state.H;
    const vx = wind.vx * dt;
    const vy = wind.vy * dt;
    const density = wind.strength * dt;
    fluid.splat(
      toGrid(x, state.W),
      toGrid(y, state.H),
      vx,
      vy,
      density,
      wind.radius,
    );
    onSplat?.({ x, y, vx, vy, density, radius: wind.radius });
  }
}

export function updateBlowers(
  state: GameState,
  fluid: FluidSim,
  audio: GameAudio,
  dt: number,
  onSplat?: FluidSplatSink,
) {
  for (const blower of state.blowers) {
    blower.cooldown -= dt;
    if (blower.fireTimer <= 0 && blower.cooldown <= 0) {
      if (blower.tracksPlayer) {
        const dx = state.player.x - blower.x;
        const dy = state.player.y - blower.y;
        const len = Math.hypot(dx, dy) || 1;
        blower.aimX = dx / len;
        blower.aimY = dy / len;
      }
      blower.fireTimer = blower.burstDuration;
      blower.cooldown = nextBlowerCooldown(blower.intervalMin, blower.intervalMax);
      audio.blowerFire();
    }

    if (blower.fireTimer <= 0) continue;
    blower.fireTimer = Math.max(0, blower.fireTimer - dt);

const isMostlyUpward = blower.aimY < -0.6;
    const column = blower.tracksPlayer
      ? [{ offset: 0, weight: 1 }]
      : isMostlyUpward
        ? [
            { offset: 0, weight: 1 },
            { offset: Math.min(state.W, state.H) * 0.02, weight: 1 },
            { offset: Math.min(state.W, state.H) * 0.04, weight: 0.96 },
            { offset: Math.min(state.W, state.H) * 0.06, weight: 0.86 },
            { offset: Math.min(state.W, state.H) * 0.08, weight: 0.7 },
            { offset: Math.min(state.W, state.H) * 0.1, weight: 0.48 },
          ]
        : [
          { offset: 0, weight: 1 },
          { offset: Math.min(state.W, state.H) * 0.04, weight: 0.92 },
          { offset: Math.min(state.W, state.H) * 0.08, weight: 0.78 },
          { offset: Math.min(state.W, state.H) * 0.12, weight: 0.54 },
        ];

    for (const segment of column) {
      const x = blower.x + blower.aimX * segment.offset;
      const y = blower.y + blower.aimY * segment.offset;
      const sideDampen = isMostlyUpward ? 0.005 : 1;
      const upBoost = isMostlyUpward ? 4.65 : 1;
      const vx = blower.aimX * blower.strength * segment.weight * dt * sideDampen;
      const vy = blower.aimY * blower.strength * segment.weight * dt * upBoost;
      const density = blower.density * segment.weight * dt * (isMostlyUpward ? 1.25 : 1);
      fluid.splat(
        toGrid(x, state.W),
        toGrid(y, state.H),
        vx,
        vy,
        density,
        isMostlyUpward ? Math.max(2, Math.floor(blower.radius * 0.68)) : blower.radius,
      );
      onSplat?.({
        x,
        y,
        vx,
        vy,
        density,
        radius: isMostlyUpward ? Math.max(2, Math.floor(blower.radius * 0.68)) : blower.radius,
      });
    }

    if (isMostlyUpward) {
      constrainCloudColumn(state, fluid, blower);
    }
  }
}

export function triggerSwitchSplat(state: GameState, fluid: FluidSim) {
  const gi = toGrid(state.sw.x, state.W);
  const gj = toGrid(state.sw.y, state.H);
  for (let dj = -3; dj <= 3; dj++) {
    for (let di = -3; di <= 3; di++) {
      if (di * di + dj * dj > 9) continue;
      const ni = clamp(gi + di, 1, N);
      const nj = clamp(gj + dj, 1, N);
      const f = 1 - (di * di + dj * dj) / 10;
      fluid.dens[IX(ni, nj)] += 90 * f;
      fluid.u[IX(ni, nj)] += di * 3 * f;
      fluid.v[IX(ni, nj)] += dj * 3 * f;
    }
  }
}

export function applyFluidToPlayer(state: GameState, fluid: FluidSim, dt: number) {
  const sampleRadius = PLAYER_R * PLAYER_FLUID_SAMPLE_RADIUS;
  const samples = [
    { x: 0, y: 0, w: 1.5 },
    { x: -sampleRadius, y: 0, w: 1 },
    { x: sampleRadius, y: 0, w: 1 },
    { x: 0, y: -sampleRadius, w: 1 },
    { x: 0, y: sampleRadius, w: 1 },
    { x: -sampleRadius * 0.7, y: -sampleRadius * 0.7, w: 0.65 },
    { x: sampleRadius * 0.7, y: -sampleRadius * 0.7, w: 0.65 },
    { x: -sampleRadius * 0.7, y: sampleRadius * 0.7, w: 0.65 },
    { x: sampleRadius * 0.7, y: sampleRadius * 0.7, w: 0.65 },
  ];

  let totalWeight = 0;
  let u = 0;
  let v = 0;
  for (const sample of samples) {
    const gi = toGrid(state.player.x + sample.x, state.W);
    const gj = toGrid(state.player.y + sample.y, state.H);
    const idx = IX(gi, gj);
    u += fluid.u[idx] * sample.w;
    v += fluid.v[idx] * sample.w;
    totalWeight += sample.w;
  }

  const avgU = u / totalWeight;
  const avgV = v / totalWeight;
  const cloudSpatialHit = isPlayerInActiveHelperCloud(state);
  const inCloudNow =
    avgV < HELPER_CLOUD_DOUBLE_JUMP_THRESHOLD || cloudSpatialHit;
  if (inCloudNow) {
    state.helperCloudGraceTimer = 0.26;
  } else {
    state.helperCloudGraceTimer = Math.max(0, state.helperCloudGraceTimer - dt);
  }
  state.inHelperCloud = inCloudNow || state.helperCloudGraceTimer > 0;
  state.helperCloudJumpBufferTimer = state.inHelperCloud
    ? Math.max(state.helperCloudJumpBufferTimer, 0.1)
    : state.helperCloudJumpBufferTimer;
  if (state.inHelperCloud) {
    showTutorial(
      state,
      "cloud-jump",
      "Cloud lift active: press Jump again in mid-air for a second jump.",
    );
  }
  if (state.player.onGround || !state.inHelperCloud) {
    state.cloudDoubleJumpUsed = false;
  }

  const inLift = state.inHelperCloud && avgV < 0;
  const sideScale = inLift ? 0.25 : 1;
  state.player.vx += avgU * WIND_SCALE * dt * sideScale;
  state.player.vy += avgV * WIND_SCALE * dt;
  if (inLift) {
    const lift = Math.min(3.2, -avgV);
    state.player.vy -= lift * WIND_SCALE * dt * 5.2;
    const liftMix = Math.min(1, lift * 2.6);
    const liftTargetVy = -340;
    if (state.player.vy > liftTargetVy) {
      state.player.vy += (liftTargetVy - state.player.vy) * Math.min(1, dt * 7.2 * liftMix);
    }
  }
}
