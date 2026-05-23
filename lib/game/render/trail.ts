import { PLAYER_R, TRAIL_LIFE } from "../constants";
import type { GameState } from "../types";

export function drawTrail(ctx: CanvasRenderingContext2D, state: GameState) {
  const { vx, vy } = state.player;
  const speed = Math.sqrt(vx * vx + vy * vy);
  const tailAngle = speed > 1 ? Math.atan2(-vy, -vx) : 0; // point opposite to velocity

  for (let i = state.trail.length - 1; i >= 0; i--) {
    const tp = state.trail[i];
    const t = tp.life / TRAIL_LIFE;
    const baseR = PLAYER_R * (0.9 - (1 - t) * 0.16);
    const rx = baseR * (1 + t * 1.2); // elongated along tail direction
    const ry = baseR * 0.55;

    ctx.save();
    ctx.globalAlpha = 0.025 + t * 0.16;
    ctx.shadowBlur = 12 * t;
    ctx.shadowColor = "#00e5ff";
    ctx.fillStyle = "#00e5ff";
    ctx.translate(tp.x, tp.y);
    ctx.rotate(tailAngle);
    ctx.scale(rx / ry, 1);
    ctx.beginPath();
    ctx.arc(0, 0, ry, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
