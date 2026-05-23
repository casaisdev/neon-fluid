import type { GameAudio } from "./audio";
import { CONTROLLED } from "./levels";
import type { GameState } from "./types";

export type InputAPI = {
  keys: Record<string, boolean>;
  goLeft: () => boolean;
  goRight: () => boolean;
  doJump: () => boolean;
  onKeyDown: (e: KeyboardEvent) => void;
  onKeyUp: (e: KeyboardEvent) => void;
};

export type InputCallbacks = {
  onResetKey: () => void;
  onRestartAll: () => void;
  isAllLevelsComplete: () => boolean;
  onPauseKey: () => void;
  onPauseMenuUp: () => void;
  onPauseMenuDown: () => void;
  onPauseMenuConfirm: () => void;
  onMenuUp: () => void;
  onMenuDown: () => void;
  onMenuConfirm: () => boolean | void;
  onMenuBack: () => void;
  onInstructionsKey: () => void;
  onInstructionsBack: () => void;
  getScreen: () => GameState['screen'];
};

export function createInput(audio: GameAudio, cbs: InputCallbacks): InputAPI {
  const keys: Record<string, boolean> = {};

  const goLeft = () => Boolean(keys.ArrowLeft || keys.KeyA);
  const goRight = () => Boolean(keys.ArrowRight || keys.KeyD);
  const doJump = () => Boolean(keys.ArrowUp || keys.KeyW || keys.Space);

  const onKeyDown = (e: KeyboardEvent) => {
    audio.unlock();
    if (CONTROLLED.has(e.code)) {
      e.preventDefault();
    }
    keys[e.code] = true;

    const screen = cbs.getScreen();

    if (screen === 'instructions') {
      cbs.onInstructionsBack();
      return;
    }

    if (screen === 'menu' || screen === 'level-select') {
      audio.startMenuAmbience();
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        cbs.onMenuUp();
        audio.menuNavigate();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        cbs.onMenuDown();
        audio.menuNavigate();
      } else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        const confirmed = cbs.onMenuConfirm();
        if (confirmed === false) audio.menuDenied();
        else audio.menuConfirm();
      } else if (
        screen === 'level-select' &&
        (e.code === 'Escape' || e.code === 'Backspace')
      ) {
        e.preventDefault();
        cbs.onMenuBack();
      }
      return;
    }

    if (screen === "paused") {
      if (e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        cbs.onPauseMenuUp();
        audio.menuNavigate();
      } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        cbs.onPauseMenuDown();
        audio.menuNavigate();
      } else if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        cbs.onPauseMenuConfirm();
        audio.menuConfirm();
      } else if (e.code === "KeyP" || e.code === "Escape") {
        e.preventDefault();
        cbs.onPauseKey();
      }
      return;
    }

    // playing only
    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      cbs.onPauseKey();
      return;
    }
    if (e.code === 'KeyR') {
      cbs.onResetKey();
    } else if (e.code === 'Enter' && cbs.isAllLevelsComplete()) {
      cbs.onRestartAll();
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  return { keys, goLeft, goRight, doJump, onKeyDown, onKeyUp };
}
