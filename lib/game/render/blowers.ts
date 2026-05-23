import { BLOWER_NOZZLE_R } from "../constants";
import type { GameState } from "../types";

export function drawBlowers(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const blower of state.blowers) {
    const firing = blower.fireTimer > 0;
    const burstProgress = firing ? blower.fireTimer / blower.burstDuration : 0;
    const idlePulse = 0.55 + Math.sin(state.gameTime * 4.2) * 0.18;
    const firePulse = firing ? 1 + Math.sin(state.gameTime * 34) * 0.18 : idlePulse;
    const r = BLOWER_NOZZLE_R * (firing ? 1.1 + (1 - burstProgress) * 0.14 : 1);
    const ax = blower.aimX;
    const ay = blower.aimY;
    const nx = -ay;
    const ny = ax;

    ctx.save();

    if (firing) {
      const upwardBeam = ay < -0.6;
      const beamLen = Math.min(state.W, state.H) * (upwardBeam ? 0.58 : 0.46);
      const startX = blower.x + ax * r * 0.95;
      const startY = blower.y + ay * r * 0.95;
      const endX = startX + ax * beamLen;
      const endY = startY + ay * beamLen;
      const width = (upwardBeam ? 2.4 : 7) + Math.sin(state.gameTime * 42) * (upwardBeam ? 0.35 : 1.5);

      const grad = ctx.createLinearGradient(startX, startY, endX, endY);
      grad.addColorStop(0, "rgba(235, 255, 252, 0.74)");
      grad.addColorStop(0.55, upwardBeam ? "rgba(154, 255, 225, 0.52)" : "rgba(109, 255, 212, 0.42)");
      grad.addColorStop(1, "rgba(109, 255, 212, 0)");

      if (!upwardBeam) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(startX + nx * width * 0.35, startY + ny * width * 0.35);
        ctx.lineTo(startX - nx * width * 0.35, startY - ny * width * 0.35);
        ctx.lineTo(endX - nx * width * 0.9, endY - ny * width * 0.9);
        ctx.lineTo(endX + nx * width * 0.9, endY + ny * width * 0.9);
        ctx.closePath();
        ctx.fill();
      }

      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = "rgba(232, 255, 250, 0.82)";
      ctx.lineWidth = 1.6;
      const streamCount = upwardBeam ? 0 : 3;
      const streamMid = (streamCount - 1) / 2;
      for (let i = 0; i < streamCount; i++) {
        const offset = (i - streamMid) * width * 0.42;
        const phase = state.gameTime * 18 + i * 1.7;
        ctx.beginPath();
        ctx.moveTo(startX + nx * offset, startY + ny * offset);
        ctx.bezierCurveTo(
          startX + ax * beamLen * 0.28 + nx * (offset + Math.sin(phase) * 2.5),
          startY + ay * beamLen * 0.28 + ny * (offset + Math.sin(phase) * 2.5),
          startX + ax * beamLen * 0.62 + nx * (offset - Math.cos(phase) * 3),
          startY + ay * beamLen * 0.62 + ny * (offset - Math.cos(phase) * 3),
          endX + nx * offset,
          endY + ny * offset,
        );
        ctx.stroke();
      }

      if (upwardBeam) {
        ctx.globalAlpha = 0.36;
        ctx.strokeStyle = "rgba(154, 255, 225, 0.88)";
        ctx.lineWidth = 1.15;
        for (let k = 0; k < 5; k++) {
          const t = (state.gameTime * 2.2 + k * 0.2) % 1;
          const cx = startX + ax * beamLen * t;
          const cy = startY + ay * beamLen * t;
          const side = width * (0.22 + t * 0.2);
          const h = 6 + t * 17;
          ctx.beginPath();
          ctx.ellipse(cx, cy, side, h, Math.atan2(ay, ax) + Math.PI / 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    ctx.translate(blower.x, blower.y);

    ctx.shadowBlur = firing ? 34 * firePulse : 15 * idlePulse;
    ctx.shadowColor = firing ? "#d9fff4" : "#78ffd6";
    ctx.fillStyle = firing ? "rgba(226, 255, 246, 0.98)" : "rgba(166, 235, 218, 0.9)";

    const cloudPuffs = [
      { x: -r * 1.1, y: r * 0.05, sx: 0.82, sy: 0.62 },
      { x: -r * 0.48, y: -r * 0.3, sx: 0.98, sy: 0.8 },
      { x: r * 0.18, y: -r * 0.42, sx: 1.12, sy: 0.9 },
      { x: r * 0.98, y: r * 0.02, sx: 0.78, sy: 0.6 },
      { x: -r * 0.02, y: r * 0.28, sx: 1.34, sy: 0.62 },
    ];

    for (let i = 0; i < cloudPuffs.length; i++) {
      const puff = cloudPuffs[i];
      const breathe = 1 + Math.sin(state.gameTime * 3.8 + i * 1.25) * 0.045;
      const bob = Math.sin(state.gameTime * 4.7 + i * 0.9) * r * 0.04;
      ctx.beginPath();
      ctx.ellipse(
        puff.x,
        puff.y + bob,
        r * puff.sx * breathe,
        r * puff.sy * breathe,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(18, 45, 48, 0.82)";
    ctx.beginPath();
    ctx.arc(-r * 0.38, -r * 0.1, 2.3, 0, Math.PI * 2);
    ctx.arc(r * 0.38, -r * 0.1, 2.3, 0, Math.PI * 2);
    ctx.fill();

    const mouthX = ax * r * 0.45;
    const mouthY = ay * r * 0.45;
    ctx.shadowBlur = firing ? 14 : 5;
    ctx.shadowColor = "#d9fff4";
    ctx.fillStyle = "#053326";
    ctx.beginPath();
    ctx.ellipse(mouthX, mouthY, r * 0.34, r * 0.2, Math.atan2(ay, ax), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
