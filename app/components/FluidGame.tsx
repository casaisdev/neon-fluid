"use client";

import { useEffect, useRef, useCallback, useState, startTransition } from "react";
import {
  FluidSim,
  FLUID_DENSITY_MAX,
  FLUID_DENSITY_MIN,
  FLUID_VELOCITY_MAX,
  FLUID_VELOCITY_MIN,
  FORCE,
  IX,
  MOUSE_DENSITY_SCALE,
  MOUSE_FORCE_SCALE,
  MOUSE_SPEED_SOFTCAP,
  N,
  SOURCE,
} from "@/lib/fluid";
import { FluidGPU } from "@/lib/fluid-gpu";
import { FluidGPURenderer } from "@/lib/fluid-gl";
import { createGame } from "@/lib/game";
import type { FluidSplat } from "@/lib/game/types";
import { detectGPUTier, TIER_CONFIG } from "@/lib/gpu-tier";
import {
  createFluidSharedBuffers,
  CTRL_CMD, CTRL_READY, CMD_STEP,
} from "@/lib/fluid-shared";

const DEBUG = process.env.NODE_ENV === "development";

// GPU visual fluid tuning
const GPU_RADIUS  = 0.018;  // Gaussian radius in UV space (~9 cells at N=512)
const GPU_VEL_SCALE  = 1.0; // velocity multiplier relative to CPU splat units
const GPU_DENS_SCALE = 0.9; // density multiplier
const GPU_WORLD_SPLAT_SCALE = 2.0;
const MOUSE_HORIZONTAL_WAVE_SCALE = 0.58;
const MOUSE_UPWARD_WAVE_BIAS = 0.72;

const safeClamp = (v: number, lo: number, hi: number) => {
  if (!Number.isFinite(v)) return 0;
  return v < lo ? lo : v > hi ? hi : v;
};

const SOUND_PREF_KEY = "fluid-game-sound-enabled";

const getInitialSoundEnabled = () => {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SOUND_PREF_KEY) !== "off";
  } catch {
    return true;
  }
};

export default function FluidGame() {
  const [unsupportedDevice, setUnsupportedDevice] = useState<boolean | null>(null);
  const [webglError, setWebglError] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(getInitialSoundEnabled);
  const [gpuReady, setGpuReady] = useState(false);
  const initialSoundRef = useRef(soundEnabled);
  const fluidRef    = useRef<HTMLCanvasElement | null>(null);
  const gameRef     = useRef<HTMLCanvasElement | null>(null);
  const pauseBtnRef = useRef<HTMLButtonElement | null>(null);
  const exitBtnRef = useRef<HTMLButtonElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const gameApiRef  = useRef<{
    togglePause: () => void;
    exitToMenu: () => void;
    toggleAudio: (enabled: boolean) => void;
    handleUserActivation: () => void;
    handlePointerDown: () => void;
    getScreen: () => string;
  } | null>(null);

  const handlePauseClick = useCallback(() => {
    gameApiRef.current?.togglePause();
  }, []);
  const handleExitClick = useCallback(() => {
    gameApiRef.current?.exitToMenu();
  }, []);

  useEffect(() => {
    const detectUnsupported = () => {
      const smallViewport = window.innerWidth < 900;
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const noHover = window.matchMedia("(hover: none)").matches;
      setUnsupportedDevice(smallViewport || (coarsePointer && noHover));
    };

    detectUnsupported();
    window.addEventListener("resize", detectUnsupported);
    return () => window.removeEventListener("resize", detectUnsupported);
  }, []);

  useEffect(() => {
    if (unsupportedDevice !== false) return;
    const fluidCanvas = fluidRef.current;
    const gameCanvas  = gameRef.current;
    if (!fluidCanvas || !gameCanvas) return;

    let cancelled = false;

    const init = async () => {
      const tier = await detectGPUTier();
      if (cancelled) return;

      const { n, iterPressure } = TIER_CONFIG[tier];
      if (DEBUG) console.log(`[GPU tier] ${tier} — N=${n}, iterPressure=${iterPressure}`);

      // CPU fluid — game physics (runs in Web Worker)
      const { views: sharedViews, sabs } = createFluidSharedBuffers();
      const worker = new Worker(new URL("../../lib/fluid-worker.ts", import.meta.url), { type: "module" });
      worker.postMessage(sabs);
      worker.onerror = (e) => console.error("[fluid-worker]", e);
      const fluid = new FluidSim();

      // GPU fluid — visual simulation at tier-selected resolution
      let gpuFluid: FluidGPU;
      let gpuRenderer: FluidGPURenderer;
      try {
        gpuFluid = new FluidGPU(fluidCanvas, n, iterPressure);
        gpuRenderer = new FluidGPURenderer(gpuFluid);
      } catch (e) {
        console.error("FluidGPU init failed:", e);
        startTransition(() => setWebglError(true));
        return;
      }

      const game = createGame(fluid, gameCanvas, { audioEnabled: initialSoundRef.current });
      gameApiRef.current = game;
      game.bind();

      const rafHandle = { current: 0 };
      let last = 0;
      let fpsFrames = 0, fpsNext = 0;
      let mouseX = 0, mouseY = 0;
      let prevMouseX = 0, prevMouseY = 0;
      let mouseDown = false;

      const resize = () => {
        fluidCanvas.width  = window.innerWidth;
        fluidCanvas.height = window.innerHeight;
        game.resize();
      };

      const toGrid = (x: number, y: number) => ({
        i: Math.max(1, Math.min(N, Math.floor((x / fluidCanvas.width)  * N) + 1)),
        j: Math.max(1, Math.min(N, Math.floor((y / fluidCanvas.height) * N) + 1)),
      });

      const onMove  = (e: MouseEvent) => { prevMouseX = mouseX; prevMouseY = mouseY; mouseX = e.clientX; mouseY = e.clientY; };
      const onDown  = (e: MouseEvent) => {
        game.handleUserActivation();
        game.handlePointerDown();
        mouseDown = true;
        prevMouseX = mouseX = e.clientX;
        prevMouseY = mouseY = e.clientY;
      };
      const onUp    = () => { mouseDown = false; };

      const addGpuSplat = (splat: FluidSplat) => {
        const W = fluidCanvas.width;
        const H = fluidCanvas.height;
        gpuFluid.addForce(
          splat.x / W,
          1 - splat.y / H,
          safeClamp(
            splat.vx * GPU_WORLD_SPLAT_SCALE * GPU_VEL_SCALE,
            FLUID_VELOCITY_MIN,
            FLUID_VELOCITY_MAX,
          ),
          safeClamp(
            -splat.vy * GPU_WORLD_SPLAT_SCALE * GPU_VEL_SCALE,
            FLUID_VELOCITY_MIN,
            FLUID_VELOCITY_MAX,
          ),
          safeClamp(
            splat.density * GPU_WORLD_SPLAT_SCALE * GPU_DENS_SCALE,
            FLUID_DENSITY_MIN,
            FLUID_DENSITY_MAX,
          ),
          Math.max(GPU_RADIUS, splat.radius / N),
        );
      };

      const tick = (ts: number) => {
        if (!last) { last = ts; fpsNext = ts + 1000; }
        const dt = Math.min((ts - last) / 1000, 0.033);
        last = ts;
        const t0frame = DEBUG ? performance.now() : 0;
        if (DEBUG) {
          fpsFrames++;
          if (ts >= fpsNext) {
            console.log(`[FPS] ${fpsFrames}`);
            fpsFrames = 0;
            fpsNext = ts + 1000;
          }
        }

        // Collect last worker result if ready (non-blocking poll)
        if (Atomics.load(sharedViews.ctrl, CTRL_READY) === 1) {
          fluid.u.set(sharedViews.sharedUOut);
          fluid.v.set(sharedViews.sharedVOut);
          fluid.dens.set(sharedViews.sharedDensOut);
          Atomics.store(sharedViews.ctrl, CTRL_READY, 0);
        }

        const W = fluidCanvas.width;
        const H = fluidCanvas.height;

        // Clear per-frame force buffers
        fluid.u_prev.fill(0);
        fluid.v_prev.fill(0);
        fluid.dens_prev.fill(0);

        if (mouseDown) {
          const { i, j } = toGrid(mouseX, mouseY);

          // Mouse velocity in Stam units (grid cells / sec, where 1 cell = 1/N of domain)
          let fx = ((mouseX - prevMouseX) / W) * N;
          let fy = ((mouseY - prevMouseY) / H) * N;
          const spd = Math.hypot(fx, fy);
          if (spd > 0) {
            const ss = MOUSE_SPEED_SOFTCAP * Math.tanh(spd / MOUSE_SPEED_SOFTCAP);
            fx = (fx / spd) * ss;
            fy = (fy / spd) * ss;
          }

          const upwardBias = Math.min(
            MOUSE_SPEED_SOFTCAP * 0.45,
            Math.abs(fx) * MOUSE_UPWARD_WAVE_BIAS + Math.max(0, -fy) * 0.2,
          );
          const waveFx = fx * MOUSE_HORIZONTAL_WAVE_SCALE;
          const waveFy = fy - upwardBias;

          // ── CPU fluid (game physics, N=256) ──
          const R = 5;
          for (let dj = -R; dj <= R; dj++) {
            for (let di = -R; di <= R; di++) {
              if (di * di + dj * dj > R * R) continue;
              const ni = i + di, nj = j + dj;
              if (ni < 1 || ni > N || nj < 1 || nj > N) continue;
              const f = 1 - (di * di + dj * dj) / (R * R + 1);
              fluid.u_prev[IX(ni, nj)] += FORCE * MOUSE_FORCE_SCALE * waveFx * f;
              fluid.v_prev[IX(ni, nj)] += FORCE * MOUSE_FORCE_SCALE * waveFy * f;
              fluid.dens_prev[IX(ni, nj)] += SOURCE * MOUSE_DENSITY_SCALE * f;
            }
          }

          // ── GPU fluid (visuals, N=512) ──
          // The GPU splat adds directly to velocity (not as acceleration),
          // so scale by dt to match the per-frame increment the CPU sim would produce.
          const uvX = mouseX / W;
          const uvY = 1 - mouseY / H;
          gpuFluid.addForce(
            uvX, uvY,
            safeClamp(
              FORCE * MOUSE_FORCE_SCALE * waveFx * dt * GPU_VEL_SCALE,
              FLUID_VELOCITY_MIN,
              FLUID_VELOCITY_MAX,
            ),
            safeClamp(
              FORCE * MOUSE_FORCE_SCALE * -waveFy * dt * GPU_VEL_SCALE,
              FLUID_VELOCITY_MIN,
              FLUID_VELOCITY_MAX,
            ),
            safeClamp(
              SOURCE * MOUSE_DENSITY_SCALE * GPU_DENS_SCALE * dt,
              FLUID_DENSITY_MIN,
              FLUID_DENSITY_MAX,
            ),
            GPU_RADIUS,
          );
        }

        game.emitFluidForces(dt, addGpuSplat);
        fluid.clampState();

        // Send forces to worker and trigger step
        sharedViews.sharedUPrev.set(fluid.u_prev);
        sharedViews.sharedVPrev.set(fluid.v_prev);
        sharedViews.sharedDensPrev.set(fluid.dens_prev);
        sharedViews.dtBuf[0] = dt;
        Atomics.store(sharedViews.ctrl, CTRL_CMD, CMD_STEP);
        Atomics.notify(sharedViews.ctrl, CTRL_CMD);

        // GPU simulation + render
        const t0gpu = DEBUG ? performance.now() : 0;
        gpuFluid.step(dt);
        const dtGpu = DEBUG ? performance.now() - t0gpu : 0;

        const t0render = DEBUG ? performance.now() : 0;
        gpuRenderer.render(dt, W, H);
        const dtRender = DEBUG ? performance.now() - t0render : 0;

        // Game update + draw (on the overlay canvas)
        game.update(dt);
        game.draw(dt);

        // Sync pause button label + visibility
        const btn = pauseBtnRef.current;
        const exitBtn = exitBtnRef.current;
        if (btn) {
          const scr = game.getScreen();
          const active = scr === 'playing' || scr === 'paused';
          btn.style.display = active ? 'flex' : 'none';
          btn.textContent = scr === "paused" ? "CONTINUE" : "PAUSE";
        }
        if (exitBtn) {
          const scr = game.getScreen();
          exitBtn.style.display = scr === "paused" ? "flex" : "none";
        }
        prevMouseX = mouseX;
        prevMouseY = mouseY;
        if (DEBUG) {
          const dtFrame = performance.now() - t0frame;
          console.log(`[frame] total=${dtFrame.toFixed(1)}ms  gpu=${dtGpu.toFixed(1)}ms  render=${dtRender.toFixed(1)}ms`);
        }
        rafHandle.current = requestAnimationFrame(tick);
      };

      resize();
      window.addEventListener("resize",     resize);
      window.addEventListener("mousemove",  onMove);
      window.addEventListener("mousedown",  onDown);
      window.addEventListener("mouseup",    onUp);
      window.addEventListener("mouseleave", onUp);

      const onFirstKey = () => {
        game.handleUserActivation();
      };
      window.addEventListener("keydown", onFirstKey);

      setGpuReady(true);
      rafHandle.current = requestAnimationFrame(tick);

      cleanupRef.current = () => {
        worker.terminate();
        cancelAnimationFrame(rafHandle.current);
        window.removeEventListener("resize",     resize);
        window.removeEventListener("mousemove",  onMove);
        window.removeEventListener("mousedown",  onDown);
        window.removeEventListener("mouseup",    onUp);
        window.removeEventListener("mouseleave", onUp);
        window.removeEventListener("keydown",    onFirstKey);
        game.unbind();
      };
    };

    init();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [unsupportedDevice]);

  const handleAudioToggle = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      try {
        window.localStorage.setItem(SOUND_PREF_KEY, next ? "on" : "off");
      } catch {}
      if (!next) {
        gameApiRef.current?.toggleAudio(false);
      } else {
        gameApiRef.current?.handleUserActivation();
        gameApiRef.current?.toggleAudio(true);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    gameApiRef.current?.toggleAudio(soundEnabled);
  }, [soundEnabled]);

  if (unsupportedDevice === true || webglError) {
    return (
      <main
        className="stage"
        style={{
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background:
            "radial-gradient(120% 120% at 50% 20%, rgba(0,120,170,0.22), rgba(2,6,18,0.96))",
        }}
      >
        <div
          style={{
            maxWidth: 620,
            textAlign: "center",
            border: "1px solid rgba(0, 229, 255, 0.35)",
            background: "rgba(4, 12, 28, 0.72)",
            boxShadow: "0 0 24px rgba(0,229,255,0.22)",
            padding: "22px 24px",
            color: "#dff8ff",
            fontFamily: "monospace",
          }}
        >
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.45 }}>
            {unsupportedDevice
              ? "This game only works on desktop. Please play on a computer with keyboard and mouse."
              : "WebGL could not be initialized, so the visual fluid renderer is unavailable."}
          </p>
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "rgba(170,238,255,0.78)" }}>
            {unsupportedDevice
              ? "Keyboard and mouse required."
              : "Try enabling hardware acceleration, updating graphics drivers, and using the latest Chrome/Edge/Firefox."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="stage">
      {!gpuReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(2,6,18,0.92)",
            color: "rgba(0,229,255,0.7)",
            fontFamily: "monospace",
            fontSize: 14,
            letterSpacing: "0.08em",
            zIndex: 10,
          }}
        >
          INITIALIZING
        </div>
      )}
      <canvas ref={fluidRef} className="layer" />
      <canvas ref={gameRef}  className="layer game" />
      <button
        onClick={handleAudioToggle}
        style={{
          position: "absolute",
          top: 86,
          right: 18,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: soundEnabled ? "rgba(4, 12, 28, 0.72)" : "rgba(28, 8, 12, 0.72)",
          border: soundEnabled ? "1px solid rgba(0, 229, 255, 0.35)" : "1px solid rgba(255, 90, 120, 0.45)",
          color: soundEnabled ? "#aaeeff" : "#ffd3dc",
          fontFamily: "monospace",
          fontSize: 12,
          padding: "5px 11px",
          cursor: "pointer",
          letterSpacing: "0.04em",
          boxShadow: soundEnabled ? "0 0 12px rgba(0,229,255,0.2)" : "0 0 12px rgba(255,90,120,0.2)",
          userSelect: "none",
        }}
      >
        {soundEnabled ? "SOUND: ON" : "SOUND: OFF"}
      </button>
      <button
        ref={pauseBtnRef}
        onClick={handlePauseClick}
        style={{
          display: 'none',
          position: 'absolute',
          top: 14,
          right: 18,
          alignItems: 'center',
          gap: 6,
          background: 'rgba(4, 12, 28, 0.72)',
          border: '1px solid rgba(0, 229, 255, 0.35)',
          color: '#aaeeff',
          fontFamily: 'monospace',
          fontSize: 13,
          padding: '5px 13px',
          cursor: 'pointer',
          letterSpacing: '0.05em',
          boxShadow: '0 0 14px rgba(0,229,255,0.22)',
          userSelect: 'none',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0, 229, 255, 0.12)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,229,255,0.7)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(4, 12, 28, 0.72)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,229,255,0.35)';
        }}
      >
        PAUSE
      </button>
      <button
        ref={exitBtnRef}
        onClick={handleExitClick}
        style={{
          display: "none",
          position: "absolute",
          top: 50,
          right: 18,
          alignItems: "center",
          gap: 6,
          background: "rgba(28, 8, 12, 0.72)",
          border: "1px solid rgba(255, 90, 120, 0.45)",
          color: "#ffd3dc",
          fontFamily: "monospace",
          fontSize: 12,
          padding: "5px 11px",
          cursor: "pointer",
          letterSpacing: "0.04em",
          boxShadow: "0 0 12px rgba(255,90,120,0.2)",
          userSelect: "none",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255, 90, 120, 0.16)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255, 120, 150, 0.9)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(28, 8, 12, 0.72)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255, 90, 120, 0.45)";
        }}
      >
        EXIT GAME
      </button>
    </main>
  );
}
