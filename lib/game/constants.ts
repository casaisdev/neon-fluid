// Player physics
export const GRAVITY = 900;
export const JUMP_VEL = -490;
export const MOVE_ACCEL = 1150;
export const MAX_HSPEED = 420;
export const GROUND_FRIC = 0.78;
export const AIR_FRIC = 0.98;
export const PLAYER_R = 10;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER_TIME = 0.12;
export const FALL_GRAVITY_MULT = 2.0;
export const JUMP_CUT_MULT = 3.5;

// Fluid coupling
export const WIND_SCALE = 500;
export const PLAYER_FLUID_SAMPLE_RADIUS = 0.85;
export const HELPER_CLOUD_DOUBLE_JUMP_THRESHOLD = -0.025;
export const HELPER_CLOUD_DOUBLE_JUMP_VEL = -700;
export const PLAYER_FLUID_VEL = 120;
export const PLAYER_FLUID_DENS = 25;
export const SPLAT_R = 2;

// Switch / gate / goal / level transitions
export const SWITCH_R = 13;
export const GATE_W = 10;
export const GATE_H = 72;
export const GATE_OPEN_DURATION = 0.65;
export const WIN_ADVANCE_DELAY = 1.1;
export const LEVEL_TITLE_DURATION = 1.8;
export const LEVEL_TITLE_FADE_IN = 0.45;
export const LEVEL_TITLE_HOLD = 0.8;
export const PLATFORM_H = 14;
export const GOAL_R = 10;
export const SPIKE_H = 18;
export const ENEMY_R = 12;

// Boxes
export const BOX_W = 24;
export const BOX_H = 26;
export const BOX_FLUID_SCALE = 750;
export const BOX_FLUID_SPEED_REF = 2.5; // quadratic coupling: force = scale*(speed/ref)
export const BOX_GROUND_FRIC = 0.65;
export const BOX_AIR_FRIC = 0.975;
export const BOX_MAX_HSPEED = 620;
export const BOX_MAX_VSPEED = 1400;
export const BOX_GRAVITY_MULT = 1.6;    // boxes fall faster than player
export const BOX_BOUNCE = 0.12;         // restitution on platform landing

// Barriers
export const BARRIER_MAX_HEALTH = 3;
export const BARRIER_FLUID_THRESHOLD = 0.18;
export const BARRIER_DAMAGE_RATE = 3.2;
export const BARRIER_HIT_FLASH = 0.12;
export const BARRIER_SHARD_COUNT = 14;

// Blowers
export const BLOWER_INTERVAL_MIN = 2.0;
export const BLOWER_INTERVAL_MAX = 3.0;
export const BLOWER_BURST_DURATION = 0.45;
export const BLOWER_FORCE = 68;
export const BLOWER_DENSITY = 42;
export const BLOWER_RADIUS = 8;
export const BLOWER_NOZZLE_R = 15;

// Particles / juice
export const SQUASH_DURATION = 0.14;
export const JUMP_GLOW_DURATION = 0.22;
export const SPARK_COUNT = 7;
export const SPARK_LIFE = 0.28;
export const SPARK_SPEED = 140;
export const HINT_FADE_IN_END = 1.0;
export const HINT_FADE_OUT_START = 3.5;
export const HINT_FADE_OUT_END = 5.5;
export const FELL_FLASH_DURATION = 0.6;
export const HUD_LEFT = 18;
export const HUD_TOP = 22;
export const TRAIL_MAX = 6;
export const TRAIL_LIFE = 0.18;
export const AMBIENT_COUNT = 7;
export const AMBIENT_LIFE = 8.5;

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;
