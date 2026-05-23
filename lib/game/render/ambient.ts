import type { GameState } from "../types";

export function drawAmbient(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const p of state.ambientParticles) {
    const t = 0.5 + 0.5 * Math.sin((p.life + p.x * 0.003) * 0.7);
    ctx.save();
    ctx.globalAlpha = 0.03 + t * 0.05;
    ctx.fillStyle = p.hue === 0 ? "#00e5ff" : "#b36dff";
    ctx.shadowBlur = 4;
    ctx.shadowColor = p.hue === 0 ? "#00e5ff" : "#b36dff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.2 + t * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
