import type { GameState } from "../types";

export function drawHazards(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const spike of state.spikes) {
    const toothCount = Math.max(1, Math.ceil(spike.w / 14));
    const toothW = spike.w / toothCount;

    ctx.save();
    ctx.fillStyle = "rgba(255, 70, 105, 0.92)";
    ctx.strokeStyle = "rgba(255, 210, 220, 0.9)";
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(255, 70, 105, 0.65)";

    for (let i = 0; i < toothCount; i++) {
      const x = spike.x + i * toothW;
      ctx.beginPath();
      ctx.moveTo(x, spike.y + spike.h);
      ctx.lineTo(x + toothW * 0.5, spike.y);
      ctx.lineTo(x + toothW, spike.y + spike.h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}
