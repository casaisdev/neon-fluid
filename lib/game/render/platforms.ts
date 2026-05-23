import type { GameState } from "../types";

export function drawPlatforms(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const plat of state.platforms) {
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#7700cc";
    ctx.fillStyle = "rgba(55,0,130,0.65)";
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#bb55ff";
    ctx.fillStyle = "#bb55ff";
    ctx.fillRect(plat.x, plat.y, plat.w, 1.5);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#7feeff";
    ctx.fillRect(plat.x + 1, plat.y + 2.5, plat.w - 2, 0.9);
    ctx.fillRect(plat.x + 1, plat.y + plat.h - 2, 2.5, 1);
    ctx.fillRect(plat.x + plat.w - 3.5, plat.y + plat.h - 2, 2.5, 1);
    ctx.restore();
  }
}
