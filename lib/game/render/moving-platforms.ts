import type { GameState } from "../types";

export function drawMovingPlatforms(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const platform of state.movingPlatforms) {
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = "rgba(110, 255, 210, 0.45)";
    ctx.fillStyle = "rgba(32, 190, 160, 0.72)";
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(210, 255, 246, 0.75)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(platform.x + 0.5, platform.y + 0.5, platform.w - 1, platform.h - 1);

    ctx.fillStyle = "rgba(210, 255, 246, 0.55)";
    const midY = platform.y + platform.h / 2;
    ctx.fillRect(platform.x + 6, midY - 1, Math.max(0, platform.w - 12), 2);
    ctx.restore();
  }
}
