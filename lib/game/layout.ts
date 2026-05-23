import { N } from "../fluid";
import {
  AMBIENT_COUNT, AMBIENT_LIFE,
  BARRIER_MAX_HEALTH,
  BLOWER_BURST_DURATION,
  BLOWER_DENSITY,
  BLOWER_FORCE,
  BLOWER_INTERVAL_MAX,
  BLOWER_INTERVAL_MIN,
  BLOWER_RADIUS,
  BOX_H, BOX_W,
  GATE_H, GATE_W,
  ENEMY_R, GOAL_R, PLATFORM_H,
  PLAYER_R, SPIKE_H, SWITCH_R,
  clamp,
} from "./constants";
import { LEVEL_COUNT, getLevel } from "./levels";
import type { GameState, Player } from "./types";

function clampLevelIndex(levelIndex: number) {
  return clamp(Math.floor(levelIndex) || 0, 0, LEVEL_COUNT - 1);
}

const HIGHEST_LEVEL_KEY = 'neonFluid_level';
const CONTINUE_LEVEL_KEY = 'neonFluid_continueLevel';

function readStoredLevel(key: string, fallback: number) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : Number(raw);
  } catch {
    return fallback;
  }
}

function hasStoredContinue() {
  try {
    return localStorage.getItem(CONTINUE_LEVEL_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveContinueLevel(state: GameState, levelIndex: number) {
  state.continueLevel = clampLevelIndex(levelIndex);
  state.hasContinue = true;
  try { localStorage.setItem(CONTINUE_LEVEL_KEY, String(state.continueLevel)); } catch {}
}

export function showTutorial(state: GameState, key: string, msg: string) {
  if (state.tutorialShown[key]) return;
  state.tutorialShown[key] = true;
  state.tutorialMsg = msg;
  state.tutorialMsgStart = performance.now() / 1000;
}

export function toGrid(val: number, size: number): number {
  return clamp(Math.floor((val / size) * N) + 1, 1, N);
}

export function createInitialState(): GameState {
  const highestLevel = clampLevelIndex(readStoredLevel(HIGHEST_LEVEL_KEY, 0));
  const storedContinue = hasStoredContinue();
  return {
    W: 0, H: 0,
    screen: 'menu',
    highestLevel,
    continueLevel: clampLevelIndex(readStoredLevel(CONTINUE_LEVEL_KEY, highestLevel)),
    hasContinue: storedContinue || highestLevel > 0,
    menuTime: performance.now() / 1000,
    menuSelectedItem: 0,
    levelSelectItem: 0,
    pauseSelectedItem: 0,
    tutorialMsg: null,
    tutorialMsgStart: 0,
    tutorialShown: {},
    player: { x: 0, y: 0, vx: 0, vy: 0, onGround: false },
    platforms: [],
    movingPlatforms: [],
    spikes: [],
    enemies: [],
    boxes: [],
    barriers: [],
    blowers: [],
    goal: { x: 0, y: 0, r: GOAL_R, done: false },
    sw: { x: 0, y: 0, r: SWITCH_R },
    gate: { x: 0, y: 0, w: GATE_W, h: GATE_H },
    hasSwitch: false,
    hasGate: false,
    switchOn: false,
    gateOpenProgress: 0,
    shards: [],
    sparks: [],
    trail: [],
    ambientParticles: [],
    currentLevel: 0,
    allLevelsComplete: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    jumpWasDown: false,
    cloudDoubleJumpUsed: false,
    inHelperCloud: false,
    helperCloudGraceTimer: 0,
    helperCloudJumpBufferTimer: 0,
    squashTimer: 0,
    jumpGlowTimer: 0,
    winTime: null,
    fellTime: null,
    levelTitleTime: null,
    gameTime: 0,
    hintStart: performance.now() / 1000,
    switchSoundPlayed: false,
    gateSoundPlayed: false,
    goalSoundPlayed: false,
    finalClearPlayed: false,
  };
}

export function buildLayout(state: GameState) {
  const { W, H } = state;
  state.currentLevel = clampLevelIndex(state.currentLevel);
  const level = getLevel(state.currentLevel);

  state.platforms.length = 0;
  for (const p of level.platforms) {
    state.platforms.push({ x: W * p.x, y: H * p.y, w: W * p.w, h: PLATFORM_H });
  }

  state.movingPlatforms.length = 0;
  if (level.movingPlatforms) {
    for (const mp of level.movingPlatforms) {
      const x = W * mp.x;
      const y = H * mp.y;
      state.movingPlatforms.push({
        x,
        y,
        w: W * mp.w,
        h: PLATFORM_H,
        initX: x,
        initY: y,
        prevX: x,
        prevY: y,
        dx: 0,
        dy: 0,
        axis: mp.axis,
        distance: (mp.axis === "x" ? W : H) * mp.distance,
        speed: mp.speed,
        dir: 1,
      });
    }
  }

  state.spikes.length = 0;
  if (level.spikes) {
    for (const spike of level.spikes) {
      state.spikes.push({
        x: W * spike.x,
        y: H * spike.y - SPIKE_H,
        w: W * spike.w,
        h: SPIKE_H,
      });
    }
  }

  state.enemies.length = 0;
  if (level.enemies) {
    for (const enemy of level.enemies) {
      const ex = W * enemy.x;
      const ey = H * enemy.y - ENEMY_R;
      state.enemies.push({
        x: ex,
        y: ey,
        initX: ex,
        initY: ey,
        patrolDistance: W * enemy.patrolDistance,
        speed: enemy.speed,
        dir: 1,
        r: ENEMY_R,
      });
    }
  }

  state.goal.x = W * level.goal.x;
  state.goal.y = H * level.goal.y;

  state.hasSwitch = Boolean(level.switch);
  if (level.switch) {
    state.sw.x = W * level.switch.x;
    state.sw.y = H * level.switch.y - SWITCH_R;
  }

  state.hasGate = Boolean(level.gate);
  if (level.gate) {
    state.gate.x = W * level.gate.x;
    state.gate.y = H * level.gate.y;
    state.gate.w = level.gate.w > 0 ? W * level.gate.w : GATE_W;
    state.gate.h = level.gate.h > 0 ? H * level.gate.h : GATE_H;
  } else {
    state.gate.w = GATE_W;
    state.gate.h = GATE_H;
  }

  state.boxes.length = 0;
  if (level.boxes) {
    for (const bd of level.boxes) {
      const bx = W * bd.x;
      const by = H * bd.y - BOX_H / 2;
      state.boxes.push({
        x: bx, y: by,
        vx: 0, vy: 0,
        w: BOX_W, h: BOX_H,
        onGround: false,
        initX: bx, initY: by,
        lastFluidU: 0,
        lastFluidV: 0,
        fluidTapCooldown: 0,
      });
    }
  }

  state.barriers.length = 0;
  if (level.barriers) {
    for (const bd of level.barriers) {
      state.barriers.push({
        x: W * bd.x,
        y: H * bd.y,
        w: W * bd.w,
        h: H * bd.h,
        health: BARRIER_MAX_HEALTH,
        maxHealth: BARRIER_MAX_HEALTH,
        broken: false,
        hitTimer: 0,
        initHealth: BARRIER_MAX_HEALTH,
      });
    }
  }

  state.blowers.length = 0;
  if (level.blowers) {
    for (const bd of level.blowers) {
      const intervalMin = bd.intervalMin ?? BLOWER_INTERVAL_MIN;
      const intervalMax = bd.intervalMax ?? BLOWER_INTERVAL_MAX;
      const hasDirection = bd.dirX !== undefined || bd.dirY !== undefined;
      const dirX = bd.dirX ?? 0;
      const dirY = bd.dirY ?? 1;
      const dirLen = Math.hypot(dirX, dirY) || 1;
      state.blowers.push({
        x: W * bd.x,
        y: H * bd.y,
        radius: bd.radius ?? BLOWER_RADIUS,
        strength: bd.strength ?? BLOWER_FORCE,
        density: bd.density ?? BLOWER_DENSITY,
        intervalMin,
        intervalMax,
        burstDuration: bd.burstDuration ?? BLOWER_BURST_DURATION,
        cooldown: intervalMin + Math.random() * (intervalMax - intervalMin),
        fireTimer: bd.burstDuration ?? BLOWER_BURST_DURATION,
        aimX: dirX / dirLen,
        aimY: dirY / dirLen,
        tracksPlayer: !hasDirection,
      });
    }
  }
}

export function makePlayer(state: GameState): Player {
  state.currentLevel = clampLevelIndex(state.currentLevel);
  const spawn = getLevel(state.currentLevel).spawn;
  return {
    x: state.W * spawn.x,
    y: state.H * spawn.y - PLAYER_R,
    vx: 0,
    vy: 0,
    onGround: false,
  };
}

export function reset(
  state: GameState,
  opts: { fell?: boolean; showTitle?: boolean } = {},
) {
  if (opts.fell) {
    state.fellTime = performance.now() / 1000;
  }
  state.allLevelsComplete = false;
  if (opts.showTitle) {
    state.levelTitleTime = performance.now() / 1000;
  }
  state.player = makePlayer(state);
  state.goal.done = false;
  state.winTime = null;
  state.switchOn = false;
  state.gateOpenProgress = 0;
  state.trail.length = 0;
  state.cloudDoubleJumpUsed = false;
  state.inHelperCloud = false;
  state.helperCloudGraceTimer = 0;
  state.helperCloudJumpBufferTimer = 0;
  state.switchSoundPlayed = false;
  state.gateSoundPlayed = false;
  state.goalSoundPlayed = false;
  state.finalClearPlayed = false;
  for (const box of state.boxes) {
    box.x = box.initX;
    box.y = box.initY;
    box.vx = 0;
    box.vy = 0;
    box.onGround = false;
    box.lastFluidU = 0;
    box.lastFluidV = 0;
    box.fluidTapCooldown = 0;
  }
  for (const platform of state.movingPlatforms) {
    platform.x = platform.initX;
    platform.y = platform.initY;
    platform.prevX = platform.initX;
    platform.prevY = platform.initY;
    platform.dx = 0;
    platform.dy = 0;
    platform.dir = 1;
  }
  for (const enemy of state.enemies) {
    enemy.x = enemy.initX;
    enemy.y = enemy.initY;
    enemy.dir = 1;
  }
  for (const bar of state.barriers) {
    bar.health = bar.initHealth;
    bar.broken = false;
    bar.hitTimer = 0;
  }
  state.shards.length = 0;
  state.tutorialMsg = null;
}

export function loadLevel(state: GameState, levelIndex: number) {
  state.currentLevel = clampLevelIndex(levelIndex);
  state.allLevelsComplete = false;
  buildLayout(state);
  reset(state, { showTitle: true });

  const level = getLevel(state.currentLevel);
  if (state.currentLevel === 0) {
    showTutorial(state, 'move', 'Move: WASD or arrows   Jump: SPACE or W');
  } else if (state.currentLevel === 4) {
    showTutorial(state, 'mouse-climb-handcrafted', "Can't reach? Use mouse waves to climb");
  } else if (state.currentLevel >= 10 && state.currentLevel <= 14) {
    showTutorial(state, `mouse-climb-${state.currentLevel}`, 'Use mouse waves to climb');
  } else if (level.boxes?.length && !state.tutorialShown['box']) {
    showTutorial(state, 'box', 'Click and drag to push boxes with fluid waves');
  } else if (level.switch && !state.tutorialShown['switch']) {
    showTutorial(state, 'switch', 'Reach the green switch to open the gate');
  } else if (level.blowers?.length && !state.tutorialShown['cloud']) {
    showTutorial(state, 'cloud', 'Use the fluid jet to cross the gap');
  }
}

export function resize(state: GameState, gameCanvas: HTMLCanvasElement) {
  state.W = window.innerWidth;
  state.H = window.innerHeight;
  gameCanvas.width = state.W;
  gameCanvas.height = state.H;
  buildLayout(state);
  state.player.x = clamp(state.player.x, PLAYER_R, state.W - PLAYER_R);
  state.player.y = clamp(state.player.y, PLAYER_R, state.H - PLAYER_R);
  if (state.ambientParticles.length === 0) {
    for (let i = 0; i < AMBIENT_COUNT; i++) {
      state.ambientParticles.push({
        x: Math.random() * state.W,
        y: Math.random() * state.H,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: Math.random() * AMBIENT_LIFE,
        hue: Math.random() < 0.5 ? 0 : 1,
      });
    }
  }
}
