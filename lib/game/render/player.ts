import { JUMP_GLOW_DURATION, MAX_HSPEED, PLAYER_R, SQUASH_DURATION } from "../constants";
import type { GameState } from "../types";

const N_BLOB = 8;
const IDLE_FREQ = 1.4 * Math.PI * 2; // rad/s
const IDLE_AMP = 1.5; // px
const STRETCH_MAX = 3; // px at MAX_HSPEED

export function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState) {
  const { player, squashTimer, jumpGlowTimer, gameTime } = state;

  const jumpGlow = jumpGlowTimer > 0 ? (jumpGlowTimer / JUMP_GLOW_DURATION) * 22 : 0;
  const sq = squashTimer > 0
    ? Math.sin((squashTimer / SQUASH_DURATION) * Math.PI) * 0.32
    : 0;

  const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
  const speedNorm = Math.min(speed / MAX_HSPEED, 1);
  const sf = speedNorm * STRETCH_MAX / PLAYER_R;

  let vDirX = 0, vDirY = 0;
  if (speed > 1) { vDirX = player.vx / speed; vDirY = player.vy / speed; }

  // Build 8 displaced blob control points
  const pts: [number, number][] = [];
  for (let i = 0; i < N_BLOB; i++) {
    const angle = (i / N_BLOB) * Math.PI * 2;
    const cx = Math.cos(angle) * PLAYER_R;
    const cy = Math.sin(angle) * PLAYER_R;

    let px: number, py: number;
    if (speed > 1) {
      // Decompose radial position along/perp to velocity and apply stretch
      const along = cx * vDirX + cy * vDirY;
      const perp  = cx * (-vDirY) + cy * vDirX;
      px = along * (1 + sf) * vDirX + perp * (1 - sf * 0.4) * (-vDirY);
      py = along * (1 + sf) * vDirY + perp * (1 - sf * 0.4) * vDirX;
    } else {
      px = cx;
      py = cy;
    }

    // Idle breath: subtle radial oscillation per point
    const breath = Math.sin(gameTime * IDLE_FREQ + angle) * IDLE_AMP;
    px += Math.cos(angle) * breath;
    py += Math.sin(angle) * breath;

    pts.push([px, py]);
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.scale(1 + sq, 1 - sq * 0.55); // squash on landing

  ctx.shadowBlur = 28 + jumpGlow;
  ctx.shadowColor = "#00e5ff";
  ctx.fillStyle = "#00e5ff";

  // Draw closed Catmull-Rom bezier through blob points
  ctx.beginPath();
  const n = pts.length;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    // Catmull-Rom → cubic bezier: cp = p ± (next - prev) / 6
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
  }
  ctx.closePath();
  ctx.fill();

  // Eye highlight — offset toward velocity direction
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  const eyeX = vDirX * 3 * speedNorm;
  const eyeY = vDirY * 3 * speedNorm;
  const eyeRY = PLAYER_R * 0.4;
  const eyeRX = eyeRY + speedNorm * 2;

  ctx.save();
  ctx.translate(eyeX, eyeY);
  if (speed > 20) ctx.rotate(Math.atan2(vDirY, vDirX));
  ctx.scale(eyeRX / eyeRY, 1);
  ctx.beginPath();
  ctx.arc(0, 0, eyeRY, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
  ctx.shadowBlur = 0;
}
