import type { GameAudio } from "../audio";
import { PLAYER_R } from "../constants";
import { reset } from "../layout";
import type { GameState } from "../types";

function playerOverlapsRect(
  state: GameState,
  rect: { x: number; y: number; w: number; h: number },
) {
  const px = state.player.x;
  const py = state.player.y;
  const closestX = Math.max(rect.x, Math.min(px, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(py, rect.y + rect.h));
  const dx = px - closestX;
  const dy = py - closestY;
  return dx * dx + dy * dy <= PLAYER_R * PLAYER_R;
}

export function updateHazards(state: GameState, audio: GameAudio) {
  for (const spike of state.spikes) {
    if (!playerOverlapsRect(state, spike)) continue;
    audio.fall();
    reset(state, { fell: true });
    return true;
  }
  return false;
}
