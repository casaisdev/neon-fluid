import type { GameState } from "../types";

export function drawGoal(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.goal.done) return;
  const { goal, gameTime, hasGate, gateOpenProgress } = state;
  const pulse = 0.78 + Math.sin(gameTime * 3.2) * 0.22;
  ctx.shadowBlur = 30 * pulse;
  ctx.shadowColor = "#ffd700";
  ctx.fillStyle = "#ffe44d";
  ctx.beginPath();
  ctx.arc(goal.x, goal.y, goal.r * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff0a6";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(goal.x, goal.y, goal.r * 1.05, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#fffdf2";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(goal.x, goal.y, goal.r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  const hintA = 0.45 + Math.sin(gameTime * 3.2) * 0.2;
  ctx.save();
  ctx.globalAlpha = hintA;
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#ffd700";
  ctx.fillStyle = "#ffe88a";
  const orbHint =
    !hasGate || gateOpenProgress >= 1
      ? "reach the orb"
      : "open the gate first";
  ctx.fillText(orbHint, goal.x, goal.y - goal.r * pulse - 6);
  ctx.restore();
}
