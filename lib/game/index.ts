import { FluidSim } from "../fluid";
import { GameAudio } from "./audio";
import { createInput } from "./input";
import { LEVEL_COUNT } from "./levels";
import {
  createInitialState,
  loadLevel,
  reset,
  resize,
  saveContinueLevel,
} from "./layout";
import { drawScene } from "./render";
import { updateBarriers } from "./update/barriers";
import { updateBoxes, resolveBoxBoxCollisions, resolvePlayerBoxPush } from "./update/boxes";
import { updateEnemies } from "./update/enemies";
import { applyFluidToPlayer, emitLevelWinds, updateBlowers } from "./update/fluid";
import { updateHazards } from "./update/hazards";
import { updateMovingPlatforms } from "./update/moving-platforms";
import {
  checkGoal,
  processWinAdvance,
  updateGate,
  updateSwitch,
} from "./update/objectives";
import {
  updateAmbient,
  updateShards,
  updateSparks,
  updateTrail,
} from "./update/particles";
import { clampAndCheckFall, updatePlayer } from "./update/player";
import type { FluidSplatSink } from "./types";

export function createGame(
  fluid: FluidSim,
  gameCanvas: HTMLCanvasElement,
  opts?: { audioEnabled?: boolean },
) {
  const maybeGctx = gameCanvas.getContext("2d");
  if (!maybeGctx) {
    throw new Error("2D context not available for game canvas");
  }
  const gctx: CanvasRenderingContext2D = maybeGctx;

  const audio = new GameAudio();
  if (opts?.audioEnabled === false) {
    audio.setEnabled(false);
  }
  const state = createInitialState();
  const isLevelUnlocked = (level: number) => level < state.highestLevel;
  const startPlayingLevel = (level: number) => {
    loadLevel(state, level);
    saveContinueLevel(state, state.currentLevel);
    state.screen = 'playing';
    state.hintStart = performance.now() / 1000;
    audio.levelStart();
    audio.ambientDroneOff();
    audio.startLevelMusic(level);
  };
  const syncAudioForScreen = () => {
    if (!audio.isEnabled()) return;
    if (state.screen === "menu" || state.screen === "level-select") {
      audio.ambientDroneOn();
      return;
    }
    if (state.screen === "playing" || state.screen === "paused") {
      audio.ambientDroneOff();
      audio.startLevelMusic(state.currentLevel);
      return;
    }
    audio.ambientDroneOff();
  };
  const input = createInput(audio, {
    onResetKey: () => reset(state, { showTitle: true }),
    onRestartAll: () => {
      state.screen = 'menu';
      state.menuTime = performance.now() / 1000;
      state.menuSelectedItem = 0;
      state.levelSelectItem = 0;
      audio.stopLevelMusic();
      audio.ambientDroneOn();
    },
    isAllLevelsComplete: () => state.allLevelsComplete,
    onPauseKey: () => {
      if (state.screen === 'playing') {
        state.screen = 'paused';
        state.pauseSelectedItem = 0;
        audio.pause();
      } else if (state.screen === 'paused') {
        state.screen = 'playing';
        audio.resume();
      }
    },
    onPauseMenuUp: () => {
      if (state.screen !== "paused") return;
      state.pauseSelectedItem = (state.pauseSelectedItem + 2) % 3;
    },
    onPauseMenuDown: () => {
      if (state.screen !== "paused") return;
      state.pauseSelectedItem = (state.pauseSelectedItem + 1) % 3;
    },
    onPauseMenuConfirm: () => {
      if (state.screen !== "paused") return;
      if (state.pauseSelectedItem === 0) {
        state.screen = "playing";
        audio.resume();
      } else if (state.pauseSelectedItem === 1) {
        reset(state, { showTitle: true });
        state.screen = "playing";
        state.hintStart = performance.now() / 1000;
        audio.resume();
      } else {
        state.screen = "menu";
        state.menuTime = performance.now() / 1000;
        state.menuSelectedItem = 0;
        state.levelSelectItem = 0;
        state.pauseSelectedItem = 0;
        audio.stopLevelMusic();
        audio.ambientDroneOn();
      }
    },
    onMenuUp: () => {
      audio.ambientDroneOn();
      if (state.screen === 'level-select') {
        const count = LEVEL_COUNT;
        state.levelSelectItem = (state.levelSelectItem - 1 + count) % count;
        return;
      }
      const count = state.hasContinue ? (state.highestLevel > 0 ? 4 : 3) : 2;
      state.menuSelectedItem = (state.menuSelectedItem - 1 + count) % count;
    },
    onMenuDown: () => {
      audio.ambientDroneOn();
      if (state.screen === 'level-select') {
        const count = LEVEL_COUNT;
        state.levelSelectItem = (state.levelSelectItem + 1) % count;
        return;
      }
      const count = state.hasContinue ? (state.highestLevel > 0 ? 4 : 3) : 2;
      state.menuSelectedItem = (state.menuSelectedItem + 1) % count;
    },
    onMenuConfirm: () => {
      if (state.screen === 'level-select') {
        if (!isLevelUnlocked(state.levelSelectItem)) {
          return false;
        }
        startPlayingLevel(state.levelSelectItem);
        return;
      }
      const sel = state.menuSelectedItem;
      if (state.hasContinue) {
        if (sel === 0) { startPlayingLevel(state.continueLevel); }
        else if (sel === 1 && state.highestLevel > 0) {
          state.levelSelectItem = Math.max(0, state.highestLevel - 1);
          state.screen = 'level-select';
          state.menuTime = performance.now() / 1000;
        }
        else if (sel === (state.highestLevel > 0 ? 2 : 1)) { saveContinueLevel(state, 0); startPlayingLevel(0); }
        else { state.screen = 'instructions'; audio.ambientDroneOff(); }
      } else {
        if (sel === 0) { startPlayingLevel(0); }
        else { state.screen = 'instructions'; audio.ambientDroneOff(); }
      }
    },
    onMenuBack: () => {
      if (state.screen === 'level-select') {
        state.screen = 'menu';
        state.menuTime = performance.now() / 1000;
        audio.ambientDroneOn();
      }
    },
    onInstructionsKey: () => {
      state.screen = 'instructions';
      audio.stopLevelMusic();
      audio.ambientDroneOff();
    },
    onInstructionsBack: () => {
      state.screen = 'menu';
      state.menuSelectedItem = 0;
      state.levelSelectItem = 0;
      audio.ambientDroneOn();
    },
    getScreen: () => state.screen,
  });

  function update(dt: number) {
    updateAmbient(state, dt);

    if (state.screen !== 'playing') return;

    const prevLevel = state.currentLevel;
    const advanced = processWinAdvance(state, input);
      if (advanced) {
      if (state.screen === 'playing' && state.currentLevel !== prevLevel) {
        saveContinueLevel(state, state.currentLevel);
        audio.levelStart();
        audio.startLevelMusic(state.currentLevel);
      }
      return;
    }

    updateMovingPlatforms(state, dt);

    applyFluidToPlayer(state, fluid, dt);
    updatePlayer(state, input, audio, dt);
    updateSparks(state, dt);

    updateSwitch(state, fluid, audio);
    updateGate(state, audio, dt);

    updateBarriers(state, fluid, audio, dt);
    updateShards(state, dt);

    clampAndCheckFall(state, audio);
    if (updateHazards(state, audio)) return;
    if (updateEnemies(state, audio, dt)) return;
    checkGoal(state, audio);

    state.jumpWasDown = input.doJump();

    updateBoxes(state, fluid, audio, dt);
    resolveBoxBoxCollisions(state, audio);
    resolvePlayerBoxPush(state);

    updateTrail(state, dt);
  }

  function emitFluidForces(dt: number, onSplat?: FluidSplatSink) {
    emitLevelWinds(state, fluid, dt, onSplat);
    updateBlowers(state, fluid, audio, dt, onSplat);
  }

  function draw(dt: number) {
    drawScene(gctx, state, dt);
  }

  function doResize() {
    resize(state, gameCanvas);
  }

  doResize();

  return {
    resize: doResize,
    emitFluidForces,
    update,
    draw,
    getScreen: () => state.screen,
    handleUserActivation: () => {
      audio.unlock();
      if (state.screen === "menu" || state.screen === "level-select") {
        audio.startMenuAmbience();
      }
    },
    handlePointerDown: () => {
      audio.unlock();
      if (state.screen === "menu" || state.screen === "level-select") {
        audio.startMenuAmbience();
      }
    },
    toggleAudio: (enabled: boolean) => {
      audio.setEnabled(enabled);
      if (!enabled) return;
      audio.unlock();
      syncAudioForScreen();
    },
    exitToMenu: () => {
      state.screen = "menu";
      state.menuTime = performance.now() / 1000;
      state.menuSelectedItem = 0;
      state.levelSelectItem = 0;
      state.pauseSelectedItem = 0;
      audio.stopLevelMusic();
      audio.ambientDroneOn();
    },
    togglePause: () => {
      if (state.screen === 'playing') {
        state.screen = 'paused';
        state.pauseSelectedItem = 0;
        audio.pause();
      } else if (state.screen === 'paused') {
        state.screen = 'playing';
        audio.resume();
      }
    },
    bind() {
      window.addEventListener("keydown", input.onKeyDown);
      window.addEventListener("keyup", input.onKeyUp);
    },
    unbind() {
      window.removeEventListener("keydown", input.onKeyDown);
      window.removeEventListener("keyup", input.onKeyUp);
    },
  };
}
