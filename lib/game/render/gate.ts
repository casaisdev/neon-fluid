import type { GameState } from "../types";

export function drawGate(ctx: CanvasRenderingContext2D, state: GameState) {
  if (!state.hasGate || state.gateOpenProgress >= 1) return;
  const { gate, gameTime, gateOpenProgress } = state;
  const ga = 1 - gateOpenProgress;
  const flicker = 0.78 + Math.sin(gameTime * 11) * 0.22;
  ctx.save();
  ctx.globalAlpha = ga * flicker;
  ctx.shadowBlur = 14;
  ctx.shadowColor = "#ff2266";
  ctx.fillStyle = "#ff2266";
  ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
  ctx.shadowBlur = 4;
  ctx.fillStyle = "#ffd0dc";
  ctx.fillRect(gate.x + gate.w * 0.22, gate.y, gate.w * 0.56, gate.h);
  ctx.strokeStyle = "#7a102f";
  ctx.lineWidth = 1;
  ctx.strokeRect(gate.x, gate.y, gate.w, gate.h);
  ctx.restore();

  const ticks = 4;
  for (let k = 0; k < ticks; k++) {
    const ty = gate.y + ((k + 0.5) / ticks) * gate.h;
    ctx.save();
    ctx.globalAlpha = ga * 0.4;
    ctx.fillStyle = "#ff88aa";
    ctx.fillRect(gate.x - 4, ty - 0.75, gate.w + 8, 1.5);
    ctx.restore();
  }
}
