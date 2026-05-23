import type { GameState } from "../types";

export function drawBarriers(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const bar of state.barriers) {
    if (bar.broken) continue;
    const bx = bar.x - bar.w / 2;
    const by = bar.y - bar.h / 2;
    const hp = bar.health / bar.maxHealth;
    const isHit = bar.hitTimer > 0;
    const pulse = 0.7 + Math.sin(state.gameTime * 7) * 0.3;

    ctx.save();
    // outer glow
    ctx.shadowBlur = isHit ? 28 : 14 * pulse;
    ctx.shadowColor = isHit ? "#ffffff" : "#cc00ff";
    ctx.globalAlpha = 0.85;
    const r = Math.round(120 + (1 - hp) * 80);
    const g = Math.round(0 + hp * 40);
    const b = Math.round(200 + hp * 55);
    ctx.fillStyle = isHit ? "#ffffff" : `rgb(${r},${g},${b})`;
    ctx.fillRect(bx, by, bar.w, bar.h);

    // inner crystal highlight
    if (!isHit) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.35 * pulse;
      ctx.fillStyle = "#f0d0ff";
      ctx.fillRect(bx + 2, by + 2, bar.w * 0.3, bar.h - 4);
      // diagonal shimmer
      ctx.globalAlpha = 0.12 * pulse;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(bx + bar.w * 0.15, by + 4);
      ctx.lineTo(bx + bar.w * 0.55, by + 4);
      ctx.lineTo(bx + bar.w * 0.35, by + bar.h - 4);
      ctx.lineTo(bx + bar.w * 0.05, by + bar.h - 4);
      ctx.closePath();
      ctx.fill();
    }

    // crack overlay based on damage
    if (hp < 0.99 && !isHit) {
      const crackAlpha = (1 - hp) * 0.9;
      ctx.globalAlpha = crackAlpha;
      ctx.strokeStyle = "#330044";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const cx = bar.x; const cy = bar.y;
      ctx.moveTo(cx, by + 4);
      ctx.lineTo(cx - bar.w * 0.2, cy - bar.h * 0.1);
      ctx.lineTo(cx + bar.w * 0.3, cy + bar.h * 0.05);
      ctx.moveTo(cx - bar.w * 0.1, cy);
      ctx.lineTo(cx + bar.w * 0.25, cy + bar.h * 0.35);
      if (hp < 0.5) {
        ctx.moveTo(cx + bar.w * 0.1, by + 6);
        ctx.lineTo(cx - bar.w * 0.3, cy - bar.h * 0.25);
        ctx.lineTo(cx, cy + bar.h * 0.2);
      }
      ctx.stroke();
    }

    // health bar
    ctx.globalAlpha = 0.7;
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(bx, by - 8, bar.w, 4);
    ctx.fillStyle = hp > 0.5 ? "#aa44ff" : hp > 0.25 ? "#ff88ff" : "#ff2299";
    ctx.fillRect(bx, by - 8, bar.w * hp, 4);

    // label
    ctx.globalAlpha = 0.6 + Math.sin(state.gameTime * 3) * 0.25;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#ffccff";
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#cc00ff";
    ctx.fillText("BREAK IT", bar.x, by - 11);

    ctx.restore();
  }
}
