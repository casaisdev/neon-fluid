import {
  FELL_FLASH_DURATION,
  HINT_FADE_IN_END,
  HINT_FADE_OUT_END,
  HINT_FADE_OUT_START,
  HUD_LEFT,
  HUD_TOP,
  LEVEL_TITLE_DURATION,
  LEVEL_TITLE_FADE_IN,
  LEVEL_TITLE_HOLD,
} from "../constants";
import { LEVEL_COUNT } from "../levels";
import type { GameState } from "../types";

let _hudGrad: CanvasGradient | null = null;

// Build a wave Y value: slow swell + mid chop + fine ripple
function waveY(x: number, W: number, now: number, speed: number, ampA: number, ampB: number, ampC: number): number {
  const u = x / W;
  return (
    Math.sin(u * Math.PI * 2.3  + now * speed)        * ampA +
    Math.sin(u * Math.PI * 5.1  - now * speed * 0.61) * ampB +
    Math.sin(u * Math.PI * 9.7  + now * speed * 0.38) * ampC
  );
}

export function drawMenuScreen(ctx: CanvasRenderingContext2D, state: GameState) {
  const { W, H, highestLevel, hasContinue, continueLevel, menuSelectedItem } = state;
  const now = performance.now() / 1000;
  const t   = now - state.menuTime;
  const cx  = W / 2;

  // ── Layout ────────────────────────────────────────────────────────
  const fSz    = Math.round(Math.min(64, H * 0.083));
  const titleY1 = H * 0.27;
  const titleY2 = titleY1 + fSz * 1.14;
  const subY    = titleY2 + fSz * 0.74;
  const sepY    = subY + 20;

  const items: string[] = hasContinue
    ? highestLevel > 0
      ? [`CONTINUE LEVEL ${continueLevel + 1}`, "LEVEL SELECT", "NEW GAME", "INSTRUCTIONS"]
      : [`CONTINUE LEVEL ${continueLevel + 1}`, "NEW GAME", "INSTRUCTIONS"]
    : ["START", "INSTRUCTIONS"];
  const ITEM_H = Math.round(Math.min(40, Math.max(30, H * 0.048)));
  const menuY0 = sepY + 28;

  ctx.save();

  // ── Background ────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,   "#01030d");
  bg.addColorStop(0.6, "#020610");
  bg.addColorStop(1,   "#000912");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Bokeh particles (deterministic, golden-ratio spacing) ─────────
  const PHI = 2.6180339;
  for (let p = 0; p < 22; p++) {
    const s  = p * PHI;
    const bx = ((s * 0.137) % 0.90 + 0.05) * W;
    const by = ((s * 0.239) % 0.68) * H;
    const dx = Math.sin(now * (0.030 + (s % 0.04)) + s) * 15;
    const dy = Math.cos(now * (0.025 + (s % 0.03)) + s * 0.8) * 9;
    const r  = 1.1 + (s % 2.6);
    const a  = 0.05 + 0.09 * Math.abs(Math.sin(now * 0.4 + s));
    const cols = ["0,200,255", "60,80,235", "160,40,250"];
    const col  = cols[p % 3];
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowBlur  = r * 4;
    ctx.shadowColor = `rgba(${col},0.9)`;
    ctx.fillStyle   = `rgba(${col},1)`;
    ctx.beginPath();
    ctx.arc(bx + dx, by + dy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Ambient glow behind title ──────────────────────────────────────
  const ag = ctx.createRadialGradient(cx, titleY1 + fSz, 0, cx, titleY1 + fSz, W * 0.5);
  ag.addColorStop(0,   "rgba(0,60,128,0.11)");
  ag.addColorStop(0.5, "rgba(0,25,70,0.04)");
  ag.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.fillStyle = ag;
  ctx.fillRect(0, 0, W, H);

  // ── Scanlines ─────────────────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = 0.016;
  ctx.fillStyle   = "#000";
  for (let sy = 0; sy < H; sy += 3) ctx.fillRect(0, sy, W, 1);
  ctx.restore();

  // ── Water layers (back → front, 5 layers) ─────────────────────────
  const w0 = H * 0.25;
  const wl = [
    { dY: w0,        spd:.22, aA:30, aB:11, aC:5,   fill:"rgba(10,30,85,1)",  cr:"0,155,225", bA:.18, cA:.22 },
    { dY: w0 * .71,  spd:.30, aA:23, aB: 9, aC:4,   fill:"rgba(0, 40,95,1)",  cr:"0,200,255", bA:.26, cA:.32 },
    { dY: w0 * .44,  spd:.39, aA:18, aB: 7, aC:3,   fill:"rgba(0, 28,70,1)",  cr:"0,215,255", bA:.35, cA:.41 },
    { dY: w0 * .22,  spd:.49, aA:13, aB: 5, aC:2.5, fill:"rgba(0, 17,48,1)",  cr:"0,185,245", bA:.60, cA:.50 },
    { dY: w0 * .075, spd:.60, aA: 7, aB: 3, aC:1.5, fill:"rgba(0, 10,28,1)",  cr:"0,150,225", bA:.92, cA:.36 },
  ];
  for (const l of wl) {
    const baseY = H - l.dY;
    // body fill
    ctx.save();
    ctx.globalAlpha = l.bA;
    ctx.fillStyle   = l.fill;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 3) ctx.lineTo(x, baseY + waveY(x, W, now, l.spd, l.aA, l.aB, l.aC));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.restore();
    // crest glow (wide)
    ctx.save();
    ctx.globalAlpha = l.cA * 0.50;
    ctx.lineWidth   = 4;
    ctx.strokeStyle = `rgba(${l.cr},1)`;
    ctx.shadowBlur  = 14; ctx.shadowColor = `rgba(${l.cr},1)`;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 3) {
      const y = baseY + waveY(x, W, now, l.spd, l.aA, l.aB, l.aC);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    // crest sharp line
    ctx.save();
    ctx.globalAlpha = l.cA * 0.88;
    ctx.lineWidth   = 1;
    ctx.strokeStyle = `rgba(${l.cr},1)`;
    ctx.shadowBlur  = 3; ctx.shadowColor = `rgba(${l.cr},0.5)`;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 3) {
      const y = baseY + waveY(x, W, now, l.spd, l.aA, l.aB, l.aC);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ── Corner bracket frame ───────────────────────────────────────────
  const brkPad = Math.min(200, W * 0.18);
  const brkT   = titleY1 - fSz * 0.6;
  const brkB   = menuY0 + items.length * ITEM_H + 18;
  const brkX   = cx - brkPad;
  const brkR   = cx + brkPad;
  const bL     = 14;
  ctx.save();
  ctx.strokeStyle = "rgba(0,200,255,0.16)";
  ctx.lineWidth   = 1.5;
  ctx.shadowBlur  = 3; ctx.shadowColor = "rgba(0,200,255,0.25)";
  ctx.beginPath(); ctx.moveTo(brkX, brkT + bL);  ctx.lineTo(brkX, brkT);  ctx.lineTo(brkX + bL, brkT);  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(brkR - bL, brkT);  ctx.lineTo(brkR, brkT);  ctx.lineTo(brkR, brkT + bL);  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(brkX, brkB - bL);  ctx.lineTo(brkX, brkB);  ctx.lineTo(brkX + bL, brkB);  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(brkR - bL, brkB);  ctx.lineTo(brkR, brkB);  ctx.lineTo(brkR, brkB - bL);  ctx.stroke();
  ctx.restore();

  // ── Title: "NEON" (cyan, three-layer glow) ─────────────────────────
  const breathe = 0.88 + 0.12 * Math.sin(t * 0.68);
  ctx.save();
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.font         = `bold ${fSz}px 'Orbitron', monospace`;
  ctx.shadowBlur   = 55 * breathe; ctx.shadowColor = "rgba(0,205,255,0.55)";
  ctx.fillStyle    = "#0090b8"; ctx.globalAlpha = 0.28;
  ctx.fillText("NEON", cx, titleY1);
  ctx.shadowBlur   = 22 * breathe; ctx.shadowColor = "rgba(0,205,255,0.55)";
  ctx.fillStyle    = "#0090b8"; ctx.globalAlpha = 1;
  ctx.fillText("NEON", cx, titleY1);
  ctx.shadowBlur   = 0;
  ctx.fillStyle    = "#cef5ff"; ctx.globalAlpha = 0.93;
  ctx.fillText("NEON", cx, titleY1);
  ctx.restore();

  // ── Title: "FLUID" (gold, three-layer glow) ────────────────────────
  ctx.save();
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.font         = `bold ${fSz}px 'Orbitron', monospace`;
  ctx.shadowBlur   = 55 * breathe; ctx.shadowColor = "rgba(255,150,0,0.55)";
  ctx.fillStyle    = "#b07800"; ctx.globalAlpha = 0.28;
  ctx.fillText("FLUID", cx, titleY2);
  ctx.shadowBlur   = 22 * breathe; ctx.shadowColor = "rgba(255,150,0,0.55)";
  ctx.fillStyle    = "#b07800"; ctx.globalAlpha = 1;
  ctx.fillText("FLUID", cx, titleY2);
  ctx.shadowBlur   = 0;
  ctx.fillStyle    = "#ffedb0"; ctx.globalAlpha = 0.93;
  ctx.fillText("FLUID", cx, titleY2);
  ctx.restore();

  // ── Subtitle ──────────────────────────────────────────────────────
  ctx.save();
  ctx.font         = `11px 'Share Tech Mono', monospace`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha  = 0.40;
  ctx.fillStyle    = "#58a0c0";
  ctx.fillText("", cx, subY);
  ctx.restore();

  // ── Separator: gradient arms + center diamond ──────────────────────
  const aLen = Math.min(130, W * 0.10);
  ctx.save();
  const g1 = ctx.createLinearGradient(cx - aLen - 10, 0, cx - 10, 0);
  g1.addColorStop(0, "rgba(0,200,255,0)"); g1.addColorStop(1, "rgba(0,200,255,0.26)");
  ctx.strokeStyle = g1; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - aLen - 10, sepY); ctx.lineTo(cx - 10, sepY); ctx.stroke();
  const g2 = ctx.createLinearGradient(cx + 10, 0, cx + aLen + 10, 0);
  g2.addColorStop(0, "rgba(0,200,255,0.26)"); g2.addColorStop(1, "rgba(0,200,255,0)");
  ctx.strokeStyle = g2;
  ctx.beginPath(); ctx.moveTo(cx + 10, sepY); ctx.lineTo(cx + aLen + 10, sepY); ctx.stroke();
  ctx.save();
  ctx.translate(cx, sepY); ctx.rotate(Math.PI / 4);
  ctx.shadowBlur = 8; ctx.shadowColor = "#00c8f0";
  ctx.fillStyle  = "rgba(0,200,255,0.6)";
  ctx.fillRect(-3, -3, 6, 6);
  ctx.restore();
  ctx.restore();

  // ── Menu items ────────────────────────────────────────────────────
  for (let i = 0; i < items.length; i++) {
    const iy  = menuY0 + i * ITEM_H;
    const sel = i === menuSelectedItem;
    const sb  = 0.88 + 0.12 * Math.sin(t * 2.2);

    if (sel) {
      const pillW = Math.min(320, W * 0.30);
      ctx.save();
      ctx.globalAlpha = 0.09;
      ctx.fillStyle   = "#00e5ff";
      ctx.fillRect(cx - pillW / 2, iy - 14, pillW, 28);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha  = sb;
      ctx.fillStyle    = "#00c8f0";
      ctx.shadowBlur   = 8; ctx.shadowColor = "#00c8f0";
      ctx.font         = `bold 15px monospace`;
      ctx.textAlign    = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("›", cx - Math.min(162, W * 0.14), iy);
      ctx.restore();

      ctx.save();
      ctx.font         = `bold 14px 'Share Tech Mono', monospace`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur   = 16 * sb; ctx.shadowColor = "rgba(0,210,250,0.7)";
      ctx.fillStyle    = "#fff";
      ctx.fillText(items[i], cx, iy);
      ctx.restore();
    } else {
      ctx.save();
      ctx.font         = `13px 'Share Tech Mono', monospace`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle    = "rgba(65,125,162,0.36)";
      ctx.fillText(items[i], cx, iy);
      ctx.restore();
    }
  }

  // ── Nav hint ──────────────────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha  = 0.22;
  ctx.font         = `12px monospace`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle    = "#90c8d8";
  ctx.fillText("UP/DOWN navigate    ENTER confirm", cx, menuY0 + items.length * ITEM_H + 20);
  ctx.restore();

  ctx.restore();
}

export function drawLevelSelectScreen(
  ctx: CanvasRenderingContext2D,
  state: GameState,
) {
  const { W, H, highestLevel, levelSelectItem } = state;
  const now = performance.now() / 1000;
  const t = now - state.menuTime;
  const cx = W / 2;

  ctx.save();
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#01030d");
  bg.addColorStop(1, "#000912");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 38px monospace";
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#00e5ff";
  ctx.fillStyle = "#dffbff";
  ctx.fillText("LEVEL SELECT", cx, H * 0.2);

  ctx.shadowBlur = 0;
  ctx.font = "13px monospace";
  ctx.fillStyle = "rgba(170,238,255,0.7)";
  ctx.fillText("Locked levels are shown dimmed", cx, H * 0.25);

  const listTop = H * 0.33;
  const rowH = 34;
  const visible = Math.min(8, LEVEL_COUNT);
  const start = Math.max(0, Math.min(levelSelectItem - Math.floor(visible / 2), LEVEL_COUNT - visible));
  const end = Math.min(LEVEL_COUNT, start + visible);
  for (let i = start; i < end; i++) {
    const y = listTop + (i - start) * rowH;
    const sel = i === levelSelectItem;
    const locked = i >= highestLevel;
    if (sel) {
      ctx.fillStyle = locked ? "rgba(255,90,110,0.1)" : "rgba(0,229,255,0.16)";
      ctx.fillRect(cx - 160, y - 14, 320, 28);
      ctx.shadowBlur = 12;
      ctx.shadowColor = locked ? "#ff6680" : "#00e5ff";
      ctx.fillStyle = locked ? "rgba(255,180,190,0.72)" : "#ffffff";
      ctx.font = "bold 16px monospace";
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = locked ? "rgba(120,150,165,0.28)" : "rgba(170,238,255,0.6)";
      ctx.font = "14px monospace";
    }
    ctx.fillText(locked ? `LEVEL ${i + 1}  LOCK` : `LEVEL ${i + 1}`, cx, y);
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(144,200,216,0.7)";
  ctx.font = "12px monospace";
  ctx.fillText("UP/DOWN navigate    ENTER play    ESC back", cx, H * 0.86 + Math.sin(t * 2.2) * 1.2);
  ctx.restore();
}

export function drawInstructionsScreen(ctx: CanvasRenderingContext2D, state: GameState) {
  const { W, H } = state;
  const now = performance.now() / 1000;
  const t = now - state.menuTime;
  const cx = W / 2;

  ctx.save();

  // Dark overlay
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = "rgba(2, 6, 18, 0.94)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // Panel background
  const pw = Math.min(520, W - 48);
  const ph = 340;
  const px = cx - pw / 2;
  const py = H / 2 - ph / 2;
  ctx.fillStyle = "rgba(4, 12, 28, 0.7)";
  ctx.shadowBlur = 30;
  ctx.shadowColor = "rgba(0,229,255,0.3)";
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = "rgba(0,229,255,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  ctx.shadowBlur = 0;

  // Title
  ctx.font = "bold 32px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowBlur = 28;
  ctx.shadowColor = "#ffd700";
  ctx.fillStyle = "#ffd700";
  ctx.fillText("CONTROLS", cx, py + 22);

  // Controls list
  const controls: [string, string][] = [
    ["WASD / Arrow keys", "move and jump"],
    ["SPACE / W", "jump"],
    ["click + drag", "push boxes, break barriers"],
    ["R", "reset level"],
    ["P / ESC", "open pause menu"],
  ];
  ctx.font = "14px monospace";
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#00e5ff";
  const labelX = cx - 20;
  const valueX = cx + 20;
  let lineY = py + 76;
  for (const [key, desc] of controls) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#00e5ff";
    ctx.fillText(key, labelX, lineY);
    ctx.textAlign = "left";
    ctx.fillStyle = "#aaeeff";
    ctx.fillText(desc, valueX, lineY);
    lineY += 26;
  }

  // Separator
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(0,229,255,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 24, lineY + 6);
  ctx.lineTo(px + pw - 24, lineY + 6);
  ctx.stroke();

  // Objective
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "center";
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#ffd700";
  ctx.fillStyle = "#ffd700";
  ctx.fillText("OBJECTIVE", cx, lineY + 20);
  ctx.font = "13px monospace";
  ctx.shadowColor = "#aaeeff";
  ctx.fillStyle = "#aaeeff";
  ctx.fillText("reach the glowing orb at the end of each level", cx, lineY + 42);

  // Back prompt — pulsing
  const pulse = 0.6 + 0.4 * Math.sin(t * 2.2);
  ctx.globalAlpha = pulse;
  ctx.font = "14px monospace";
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#00e5ff";
  ctx.fillStyle = "#00e5ff";
  ctx.fillText("[ ANY KEY ]  BACK", cx, py + ph - 28);
  ctx.globalAlpha = 1;

  ctx.restore();
}

export function drawPauseOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
  const { W, H } = state;
  const now = performance.now() / 1000;
  const cx = W / 2;
  const cy = H / 2;

  ctx.save();

  // Dark overlay
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  ctx.font = "bold 52px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 30;
  ctx.shadowColor = "#00e5ff";
  ctx.fillStyle = "#aaeeff";
  ctx.fillText("PAUSE", cx, cy - 72);

  const items = ["CONTINUE", "RESET LEVEL", "EXIT GAME"];
  for (let i = 0; i < items.length; i++) {
    const y = cy - 8 + i * 32;
    const sel = i === state.pauseSelectedItem;
    if (sel) {
      const pulse = 0.75 + 0.25 * Math.sin(now * 3.2);
      ctx.globalAlpha = pulse;
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#00e5ff";
      ctx.fillStyle = "#00e5ff";
      ctx.font = "bold 20px monospace";
    } else {
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 5;
      ctx.shadowColor = "#aaeeff";
      ctx.fillStyle = "rgba(170,238,255,0.55)";
      ctx.font = "15px monospace";
    }
    ctx.fillText(items[i], cx, y);
  }

  ctx.globalAlpha = 1;
  ctx.font = "12px monospace";
  ctx.shadowBlur = 6;
  ctx.shadowColor = "#aaeeff";
  ctx.fillStyle = "rgba(170,238,255,0.62)";
  ctx.fillText("UP/DOWN navigate    ENTER select    P/ESC continue", cx, cy + 104);

  ctx.restore();
}

export function drawControlHint(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  now: number,
) {
  const elapsed = now - state.hintStart;
  let hintAlpha = 0;
  if (elapsed < HINT_FADE_IN_END) {
    hintAlpha = elapsed / HINT_FADE_IN_END;
  } else if (elapsed < HINT_FADE_OUT_START) {
    hintAlpha = 1;
  } else if (elapsed < HINT_FADE_OUT_END) {
    hintAlpha =
      1 -
      (elapsed - HINT_FADE_OUT_START) /
        (HINT_FADE_OUT_END - HINT_FADE_OUT_START);
  }

  if (hintAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = hintAlpha * 0.72;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#00e5ff";
    ctx.fillStyle = "#aaeeff";
    ctx.fillText(
      "WASD / arrows: move   space / W: jump   click+drag: push boxes & break barriers   R: reset",
      state.W / 2,
      state.H - 18,
    );
    ctx.restore();
  }
}

export function drawFellFlash(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  now: number,
) {
  if (state.fellTime === null) return;
  const age = now - state.fellTime;
  if (age < FELL_FLASH_DURATION) {
    const t = age / FELL_FLASH_DURATION;
    const flashAlpha = (1 - t) * 0.38;
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = "#ff1040";
    ctx.fillRect(0, 0, state.W, state.H);
    ctx.restore();
  } else {
    state.fellTime = null;
  }
}

export function drawWinBanner(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.winTime === null) return;
  const winElapsed = performance.now() / 1000 - state.winTime;
  const alpha = Math.min(winElapsed * 1.5, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 50;
  ctx.shadowColor = "#ffd700";
  ctx.fillStyle = "#ffd700";
  ctx.font = "bold 52px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    state.allLevelsComplete ? "ALL LEVELS CLEARED" : "LEVEL COMPLETE",
    state.W / 2,
    state.H / 2 - 34,
  );
  ctx.shadowBlur = 16;
  ctx.shadowColor = "#fff";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "22px monospace";
  ctx.fillText(
    state.allLevelsComplete
      ? "Press Enter to return to menu"
      : "Loading next level...",
    state.W / 2,
    state.H / 2 + 30,
  );
  ctx.restore();
}

export function drawHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  const total = LEVEL_COUNT;
  const current = state.currentLevel;
  const barW = 130;
  const boxH = 46;

  ctx.save();
  ctx.globalAlpha = 0.82;

  // Panel background
  ctx.fillStyle = "rgba(4, 12, 28, 0.65)";
  ctx.shadowBlur = 14;
  ctx.shadowColor = "rgba(0,229,255,0.4)";
  ctx.fillRect(HUD_LEFT - 8, HUD_TOP - 8, barW + 16, boxH);
  ctx.strokeStyle = "rgba(0,229,255,0.28)";
  ctx.lineWidth = 1;
  ctx.strokeRect(HUD_LEFT - 7.5, HUD_TOP - 7.5, barW + 15, boxH - 1);

  // Level label
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#00e5ff";
  ctx.fillStyle = "#aaeeff";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`LEVEL ${current + 1}`, HUD_LEFT, HUD_TOP);

  // Level counter right-aligned
  ctx.shadowBlur = 4;
  ctx.fillStyle = "rgba(170,238,255,0.5)";
  ctx.font = "11px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`/ ${total}`, HUD_LEFT + barW, HUD_TOP + 1);

  // Progress bar track
  const barY = HUD_TOP + 20;
  const barH = 5;
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(0,229,255,0.12)";
  ctx.fillRect(HUD_LEFT, barY, barW, barH);

  // Progress bar fill (proportional to current level)
  const progress = (current + 1) / total;
  const fillW = Math.round(barW * progress);
  if (!_hudGrad) {
    _hudGrad = ctx.createLinearGradient(HUD_LEFT, 0, HUD_LEFT + barW, 0);
    _hudGrad.addColorStop(0, "#00e5ff");
    _hudGrad.addColorStop(1, "#cc00ff");
  }
  ctx.shadowBlur = 6;
  ctx.shadowColor = "#00e5ff";
  ctx.fillStyle = _hudGrad;
  ctx.fillRect(HUD_LEFT, barY, fillW, barH);

  // Level tick marks
  ctx.shadowBlur = 0;
  for (let i = 1; i < total; i++) {
    const tx = HUD_LEFT + Math.round(barW * (i / total));
    ctx.fillStyle = "rgba(2, 8, 22, 0.8)";
    ctx.fillRect(tx - 1, barY, 2, barH);
  }

  // Dot marker at current position
  const dotX = HUD_LEFT + fillW;
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#00e5ff";
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(dotX, barY + barH / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawTutorialHint(ctx: CanvasRenderingContext2D, state: GameState, now: number) {
  if (!state.tutorialMsg) return;

  const DURATION = 5.5;
  const FADE_IN = 0.4;
  const FADE_OUT = 1.3;
  const elapsed = now - state.tutorialMsgStart;

  if (elapsed >= DURATION) {
    state.tutorialMsg = null;
    return;
  }

  let alpha = 1;
  if (elapsed < FADE_IN) {
    alpha = elapsed / FADE_IN;
  } else if (elapsed > DURATION - FADE_OUT) {
    alpha = (DURATION - elapsed) / FADE_OUT;
  }

  const cx = state.W / 2;
  const cy = state.H * 0.74;

  ctx.save();

  ctx.font = "15px monospace";
  const tw = ctx.measureText(state.tutorialMsg).width;
  const pw = tw + 44;
  const ph = 38;

  ctx.globalAlpha = alpha * 0.92;
  ctx.fillStyle = "rgba(2, 6, 18, 0.85)";
  ctx.shadowBlur = 24;
  ctx.shadowColor = "rgba(255, 220, 50, 0.45)";
  ctx.fillRect(cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.strokeStyle = "rgba(255, 220, 50, 0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - pw / 2 + 0.5, cy - ph / 2 + 0.5, pw - 1, ph - 1);

  ctx.shadowBlur = 16;
  ctx.shadowColor = "#ffe866";
  ctx.fillStyle = "#ffe866";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.tutorialMsg, cx, cy);

  ctx.restore();
}

export function drawLevelTitle(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  now: number,
) {
  if (state.levelTitleTime === null) return;
  const titleElapsed = now - state.levelTitleTime;
  if (titleElapsed < LEVEL_TITLE_DURATION) {
    let titleAlpha = 0;
    if (titleElapsed < LEVEL_TITLE_FADE_IN) {
      titleAlpha = titleElapsed / LEVEL_TITLE_FADE_IN;
    } else if (titleElapsed < LEVEL_TITLE_FADE_IN + LEVEL_TITLE_HOLD) {
      titleAlpha = 1;
    } else {
      const fadeOutElapsed =
        titleElapsed - (LEVEL_TITLE_FADE_IN + LEVEL_TITLE_HOLD);
      const fadeOutDuration =
        LEVEL_TITLE_DURATION - (LEVEL_TITLE_FADE_IN + LEVEL_TITLE_HOLD);
      titleAlpha = 1 - fadeOutElapsed / fadeOutDuration;
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, titleAlpha);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 44px monospace";
    ctx.shadowBlur = 30;
    ctx.shadowColor = "#00e5ff";
    ctx.fillStyle = "#e6fbff";
    ctx.fillText(`LEVEL ${state.currentLevel + 1}`, state.W / 2, state.H / 2 - 34);
    ctx.restore();
  } else {
    state.levelTitleTime = null;
  }
}



