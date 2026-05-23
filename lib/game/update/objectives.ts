import { FluidSim } from "../../fluid";
import type { GameAudio } from "../audio";
import {
  GATE_OPEN_DURATION,
  PLAYER_R,
  WIN_ADVANCE_DELAY,
} from "../constants";
import type { InputAPI } from "../input";
import { LEVEL_COUNT } from "../levels";
import { loadLevel } from "../layout";
import type { GameState } from "../types";
import { triggerSwitchSplat } from "./fluid";

/** Returns true when the caller should early-return from update. */
export function processWinAdvance(
  state: GameState,
  input: InputAPI,
): boolean {
  if (!state.goal.done || state.winTime === null) return false;
  const elapsed = performance.now() / 1000 - state.winTime;
  if (!state.allLevelsComplete && elapsed >= WIN_ADVANCE_DELAY) {
    if (state.currentLevel < LEVEL_COUNT - 1) {
      loadLevel(state, state.currentLevel + 1);
    }
  }
  state.jumpWasDown = input.doJump();
  return true;
}

export function updateSwitch(
  state: GameState,
  fluid: FluidSim,
  audio: GameAudio,
) {
  if (
    state.hasSwitch &&
    !state.switchOn &&
    Math.hypot(state.player.x - state.sw.x, state.player.y - state.sw.y)
      < PLAYER_R + state.sw.r
  ) {
    state.switchOn = true;
    if (!state.switchSoundPlayed) {
      audio.switchOn();
      state.switchSoundPlayed = true;
    }
    triggerSwitchSplat(state, fluid);
  }
}

export function updateGate(state: GameState, audio: GameAudio, dt: number) {
  const prevGateProgress = state.gateOpenProgress;
  if (state.hasGate && state.switchOn && state.gateOpenProgress < 1) {
    state.gateOpenProgress = Math.min(
      1,
      state.gateOpenProgress + dt / GATE_OPEN_DURATION,
    );
    if (
      prevGateProgress < 1 &&
      state.gateOpenProgress >= 1 &&
      !state.gateSoundPlayed
    ) {
      audio.gateOpen();
      state.gateSoundPlayed = true;
    }
  }

  if (state.hasGate && state.gateOpenProgress < 1) {
    const { player, gate } = state;
    const inY =
      player.y + PLAYER_R > gate.y && player.y - PLAYER_R < gate.y + gate.h;
    if (
      inY &&
      player.x + PLAYER_R > gate.x &&
      player.x - PLAYER_R < gate.x + gate.w
    ) {
      const fromLeft = player.x < gate.x + gate.w / 2;
      player.x = fromLeft ? gate.x - PLAYER_R : gate.x + gate.w + PLAYER_R;
      player.vx = 0;
    }
  }
}

export function checkGoal(state: GameState, audio: GameAudio) {
  if (state.goal.done) return;
  if (state.hasGate && state.gateOpenProgress < 1) return;
  const { player, goal } = state;
  if (
    Math.hypot(player.x - goal.x, player.y - goal.y) <
    PLAYER_R + goal.r + 4
  ) {
    goal.done = true;
    state.winTime = performance.now() / 1000;
    const earned = state.currentLevel + 1;
    if (earned > state.highestLevel) {
      state.highestLevel = earned;
      try { localStorage.setItem('neonFluid_level', String(earned)); } catch {}
    }
    const isFinalLevel = state.currentLevel === LEVEL_COUNT - 1;
    if (!isFinalLevel && !state.goalSoundPlayed) {
      audio.goal();
      state.goalSoundPlayed = true;
    }
    if (isFinalLevel) {
      state.allLevelsComplete = true;
      if (!state.finalClearPlayed) {
        audio.complete();
        state.finalClearPlayed = true;
      }
    }
  }
}
