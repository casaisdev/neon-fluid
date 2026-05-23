export type Platform = { x: number; y: number; w: number; h: number };
export type MovingPlatform = {
  x: number;
  y: number;
  w: number;
  h: number;
  initX: number;
  initY: number;
  prevX: number;
  prevY: number;
  dx: number;
  dy: number;
  axis: "x" | "y";
  distance: number;
  speed: number;
  dir: -1 | 1;
};
export type Spike = { x: number; y: number; w: number; h: number };
export type Enemy = {
  x: number;
  y: number;
  initX: number;
  initY: number;
  patrolDistance: number;
  speed: number;
  dir: -1 | 1;
  r: number;
};
export type Goal = { x: number; y: number; r: number; done: boolean };
export type SwitchNode = { x: number; y: number; r: number };
export type Gate = { x: number; y: number; w: number; h: number };

export type LevelPlatformDef = { x: number; y: number; w: number };
export type MovingPlatformDef = {
  x: number;
  y: number;
  w: number;
  axis: "x" | "y";
  distance: number;
  speed: number;
};
export type SpikeDef = { x: number; y: number; w: number };
export type EnemyDef = { x: number; y: number; patrolDistance: number; speed: number };
export type SpawnDef = { x: number; y: number };
export type PointDef = { x: number; y: number };
export type GateDef = { x: number; y: number; w: number; h: number };
export type WindDef = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  strength: number;
};
export type BlowerDef = {
  x: number;
  y: number;
  dirX?: number;
  dirY?: number;
  radius?: number;
  strength?: number;
  density?: number;
  intervalMin?: number;
  intervalMax?: number;
  burstDuration?: number;
};
export type FluidSplat = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  density: number;
  radius: number;
};
export type FluidSplatSink = (splat: FluidSplat) => void;
export type BoxDef = { x: number; y: number };
export type BarrierDef = { x: number; y: number; w: number; h: number };
export type LevelDef = {
  platforms: LevelPlatformDef[];
  spawn: SpawnDef;
  goal: PointDef;
  movingPlatforms?: MovingPlatformDef[];
  switch?: PointDef;
  gate?: GateDef;
  winds?: WindDef[];
  blowers?: BlowerDef[];
  boxes?: BoxDef[];
  barriers?: BarrierDef[];
  spikes?: SpikeDef[];
  enemies?: EnemyDef[];
};

export type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
};

export type Box = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  initX: number;
  initY: number;
  lastFluidU: number;
  lastFluidV: number;
  fluidTapCooldown: number;
};

export type Barrier = {
  x: number; y: number; w: number; h: number;
  health: number; maxHealth: number;
  broken: boolean; hitTimer: number;
  initHealth: number;
};

export type Blower = {
  x: number;
  y: number;
  radius: number;
  strength: number;
  density: number;
  intervalMin: number;
  intervalMax: number;
  burstDuration: number;
  cooldown: number;
  fireTimer: number;
  aimX: number;
  aimY: number;
  tracksPlayer: boolean;
};

export type ShardParticle = {
  x: number; y: number; vx: number; vy: number;
  life: number; size: number; angle: number; spin: number;
};
export type Spark = { x: number; y: number; vx: number; vy: number; life: number };
export type TrailPoint = { x: number; y: number; life: number };
export type AmbientParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: 0 | 1;
};

export type GameState = {
  W: number; H: number;
  screen: 'menu' | 'level-select' | 'instructions' | 'playing' | 'paused';
  highestLevel: number;
  continueLevel: number;
  hasContinue: boolean;
  menuTime: number;
  menuSelectedItem: number;
  levelSelectItem: number;
  pauseSelectedItem: number;
  tutorialMsg: string | null;
  tutorialMsgStart: number;
  tutorialShown: Record<string, boolean>;
  player: Player;
  platforms: Platform[];
  movingPlatforms: MovingPlatform[];
  spikes: Spike[];
  enemies: Enemy[];
  boxes: Box[];
  barriers: Barrier[];
  blowers: Blower[];
  goal: Goal;
  sw: SwitchNode;
  gate: Gate;
  hasSwitch: boolean;
  hasGate: boolean;
  switchOn: boolean;
  gateOpenProgress: number;
  shards: ShardParticle[];
  sparks: Spark[];
  trail: TrailPoint[];
  ambientParticles: AmbientParticle[];
  currentLevel: number;
  allLevelsComplete: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  jumpWasDown: boolean;
  cloudDoubleJumpUsed: boolean;
  inHelperCloud: boolean;
  helperCloudGraceTimer: number;
  helperCloudJumpBufferTimer: number;
  squashTimer: number;
  jumpGlowTimer: number;
  winTime: number | null;
  fellTime: number | null;
  levelTitleTime: number | null;
  gameTime: number;
  hintStart: number;
  switchSoundPlayed: boolean;
  gateSoundPlayed: boolean;
  goalSoundPlayed: boolean;
  finalClearPlayed: boolean;
};
