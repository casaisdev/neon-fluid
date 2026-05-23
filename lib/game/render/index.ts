import type { GameState } from "../types";
import { drawAmbient } from "./ambient";
import { drawBarriers } from "./barriers";
import { drawBlowers } from "./blowers";
import { drawBoxes } from "./boxes";
import { drawEnemies } from "./enemies";
import { drawGate } from "./gate";
import { drawGoal } from "./goal";
import { drawHazards } from "./hazards";
import { drawMovingPlatforms } from "./moving-platforms";
import {
  drawControlHint,
  drawFellFlash,
  drawHUD,
  drawInstructionsScreen,
  drawLevelSelectScreen,
  drawLevelTitle,
  drawMenuScreen,
  drawPauseOverlay,
  drawTutorialHint,
  drawWinBanner,
} from "./overlays";
import { drawPlatforms } from "./platforms";
import { drawPlayer } from "./player";
import { drawShards } from "./shards";
import { drawSparks } from "./sparks";
import { drawSwitch } from "./switch";
import { drawTrail } from "./trail";

export function drawScene(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  dt: number,
) {
  state.gameTime += dt;
  ctx.clearRect(0, 0, state.W, state.H);

  drawAmbient(ctx, state);

  if (state.screen === 'menu') {
    drawMenuScreen(ctx, state);
    return;
  }

  if (state.screen === 'level-select') {
    drawLevelSelectScreen(ctx, state);
    return;
  }

  if (state.screen === 'instructions') {
    drawInstructionsScreen(ctx, state);
    return;
  }

  // 'playing' or 'paused' — draw full game scene
  drawShards(ctx, state);
  drawBarriers(ctx, state);
  drawBoxes(ctx, state);
  drawPlatforms(ctx, state);
  drawMovingPlatforms(ctx, state);
  drawHazards(ctx, state);
  drawEnemies(ctx, state);
  drawBlowers(ctx, state);
  drawSwitch(ctx, state);
  drawGate(ctx, state);
  drawGoal(ctx, state);
  drawSparks(ctx, state);
  drawTrail(ctx, state);
  drawPlayer(ctx, state);

  const now = performance.now() / 1000;
  drawControlHint(ctx, state, now);
  drawTutorialHint(ctx, state, now);
  drawFellFlash(ctx, state, now);
  drawWinBanner(ctx, state);
  drawHUD(ctx, state);
  drawLevelTitle(ctx, state, now);

  if (state.screen === 'paused') {
    drawPauseOverlay(ctx, state);
  }
}
