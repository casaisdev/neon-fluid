import type { GameState } from "../types";

export function drawBoxes(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const box of state.boxes) {
    const bx = box.x - box.w / 2;
    const by = box.y - box.h / 2;
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ff6600";
    ctx.fillStyle = "rgba(100, 48, 0, 0.9)";
    ctx.fillRect(bx, by, box.w, box.h);
    // top edge highlight
    ctx.shadowBlur = 4;
    ctx.shadowColor = "#ffaa44";
    ctx.fillStyle = "#cc5500";
    ctx.fillRect(bx, by, box.w, 2.5);
    ctx.fillRect(bx, by, 2.5, box.h);
    // dark bottom/right edge
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(bx, by + box.h - 2.5, box.w, 2.5);
    ctx.fillRect(bx + box.w - 2.5, by, 2.5, box.h);
    // cross marks like a crate
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#884400";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(bx + 2, by + 2);
    ctx.lineTo(bx + box.w - 2, by + box.h - 2);
    ctx.moveTo(bx + box.w - 2, by + 2);
    ctx.lineTo(bx + 2, by + box.h - 2);
    ctx.stroke();
    ctx.restore();
  }
}
