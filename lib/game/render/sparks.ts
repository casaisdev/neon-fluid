import { SPARK_LIFE } from "../constants";
import type { GameState } from "../types";

export function drawSparks(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const s of state.sparks) {
    const t = 1 - s.life / SPARK_LIFE;
    const alpha = 1 - t;
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#00e5ff";
    ctx.fillStyle = "#aaf0ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.2 * (1 - t * 0.6), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
