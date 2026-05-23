import { SWITCH_R } from "../constants";
import type { GameState } from "../types";

export function drawSwitch(ctx: CanvasRenderingContext2D, state: GameState) {
  if (!state.hasSwitch) return;
  const { sw, switchOn, gameTime } = state;
  const swPulse = switchOn ? 1 : 0.72 + Math.sin(gameTime * 4.0) * 0.28;
  const swSize = SWITCH_R * 1.5;
  ctx.save();
  ctx.translate(sw.x, sw.y);
  ctx.rotate(Math.PI / 4);
  ctx.shadowBlur = switchOn ? 6 : 18 * swPulse;
  ctx.shadowColor = switchOn ? "#226644" : "#00ff88";
  ctx.fillStyle = switchOn ? "#1a3d2a" : "#00ff88";
  ctx.fillRect(-swSize / 2, -swSize / 2, swSize, swSize);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = switchOn ? "#264f36" : "#d9ffe8";
  ctx.strokeRect(-swSize / 2, -swSize / 2, swSize, swSize);
  if (!switchOn) {
    ctx.shadowBlur = 6 * swPulse;
    ctx.fillStyle = "#aaffcc";
    ctx.fillRect(
      -swSize * 0.28,
      -swSize * 0.28,
      swSize * 0.56,
      swSize * 0.56,
    );
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
  }
  ctx.restore();
  ctx.shadowBlur = 0;

  if (!switchOn) {
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(gameTime * 4.0) * 0.2;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#00ff88";
    ctx.fillStyle = "#aaffcc";
    ctx.fillText("activate", sw.x, sw.y - SWITCH_R - 4);
    ctx.restore();
  }
}
