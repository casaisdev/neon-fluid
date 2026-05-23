import type { GameState } from "../types";

export function drawShards(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const s of state.shards) {
    const t = s.life / 0.9;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 1.6) * 0.9;
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.shadowBlur = 8 * t;
    ctx.shadowColor = "#cc44ff";
    ctx.fillStyle = t > 0.5 ? "#e8aaff" : "#9900cc";
    ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size * 0.45);
    ctx.restore();
  }
}
