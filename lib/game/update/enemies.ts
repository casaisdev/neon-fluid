import type { GameAudio } from "../audio";
import { PLAYER_R } from "../constants";
import { reset } from "../layout";
import type { GameState } from "../types";

export function updateEnemies(state: GameState, audio: GameAudio, dt: number) {
  for (const enemy of state.enemies) {
    enemy.x += enemy.dir * enemy.speed * dt;
    const left = enemy.initX - enemy.patrolDistance;
    const right = enemy.initX + enemy.patrolDistance;
    if (enemy.x < left) {
      enemy.x = left;
      enemy.dir = 1;
    } else if (enemy.x > right) {
      enemy.x = right;
      enemy.dir = -1;
    }

    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const hitR = PLAYER_R + enemy.r;
    if (dx * dx + dy * dy > hitR * hitR) continue;

    audio.fall();
    reset(state, { fell: true });
    return true;
  }
  return false;
}
