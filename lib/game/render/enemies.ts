import type { GameState } from "../types";

export function drawEnemies(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const enemy of state.enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(255, 80, 180, 0.7)";
    ctx.fillStyle = "rgba(255, 75, 165, 0.92)";
    ctx.beginPath();
    ctx.arc(0, 0, enemy.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(20, 4, 24, 0.9)";
    ctx.beginPath();
    ctx.arc(enemy.r * 0.32 * enemy.dir, -enemy.r * 0.18, enemy.r * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 230, 250, 0.9)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-enemy.r * 0.55, enemy.r * 0.35);
    ctx.lineTo(enemy.r * 0.55, enemy.r * 0.35);
    ctx.stroke();

    ctx.restore();
  }
}
