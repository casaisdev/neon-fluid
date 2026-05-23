import type { GameAudio } from "../audio";
import {
  AIR_FRIC,
  COYOTE_TIME,
  FALL_GRAVITY_MULT,
  GRAVITY,
  GROUND_FRIC,
  HELPER_CLOUD_DOUBLE_JUMP_VEL,
  JUMP_BUFFER_TIME,
  JUMP_CUT_MULT,
  JUMP_GLOW_DURATION,
  JUMP_VEL,
  MAX_HSPEED,
  MOVE_ACCEL,
  PLAYER_R,
  SQUASH_DURATION,
  clamp,
} from "../constants";
import type { InputAPI } from "../input";
import { reset } from "../layout";
import { spawnLandSparks } from "./particles";
import type { GameState, Platform } from "../types";

const HELPER_CLOUD_JUMP_BUFFER = 0.16;

function landOnPlatform(
  state: GameState,
  plat: Platform,
  prevY: number,
  dx = 0,
  prevPlatY = plat.y,
) {
  const { player } = state;
  const inX =
    player.x + PLAYER_R > plat.x && player.x - PLAYER_R < plat.x + plat.w;
  if (!inX) return false;
  const prevBottom = prevY + PLAYER_R;
  const bottom = player.y + PLAYER_R;
  if (prevBottom <= prevPlatY + 1 && bottom >= plat.y && player.vy >= 0) {
    player.y = plat.y - PLAYER_R;
    player.x += dx;
    player.vy = 0;
    player.onGround = true;
    return true;
  }
  return false;
}

export function updatePlayer(
  state: GameState,
  input: InputAPI,
  audio: GameAudio,
  dt: number,
) {
  const { player } = state;
  const wasOnGround = player.onGround;

  if (input.goRight()) player.vx += MOVE_ACCEL * dt;
  if (input.goLeft()) player.vx -= MOVE_ACCEL * dt;
  if (!input.goLeft() && !input.goRight()) {
    player.vx *= player.onGround ? GROUND_FRIC : AIR_FRIC;
  }
  player.vx = clamp(player.vx, -MAX_HSPEED, MAX_HSPEED);

  if (player.onGround) state.coyoteTimer = COYOTE_TIME;
  else state.coyoteTimer = Math.max(0, state.coyoteTimer - dt);

  const jumpPressed = input.doJump() && !state.jumpWasDown;
  if (jumpPressed) state.jumpBufferTimer = JUMP_BUFFER_TIME;
  else state.jumpBufferTimer = Math.max(0, state.jumpBufferTimer - dt);
  state.helperCloudJumpBufferTimer = Math.max(0, state.helperCloudJumpBufferTimer - dt);

  let grav = GRAVITY;
  if (player.vy > 0) grav = GRAVITY * FALL_GRAVITY_MULT;
  else if (player.vy < 0 && !input.doJump()) grav = GRAVITY * JUMP_CUT_MULT;
  player.vy += grav * dt;

  const prevY = player.y;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  player.onGround = false;
  for (const plat of state.platforms) {
    landOnPlatform(state, plat, prevY);
  }
  for (const plat of state.movingPlatforms) {
    landOnPlatform(state, plat, prevY, plat.dx, plat.prevY);
  }

  if (!wasOnGround && player.onGround) {
    state.squashTimer = SQUASH_DURATION;
    spawnLandSparks(state);
    audio.land();
  }

  if (state.jumpBufferTimer > 0 && (state.coyoteTimer > 0 || player.onGround)) {
    player.vy = JUMP_VEL;
    player.onGround = false;
    state.coyoteTimer = 0;
    state.jumpBufferTimer = 0;
    state.cloudDoubleJumpUsed = false;
    state.helperCloudJumpBufferTimer = 0;
    state.jumpGlowTimer = JUMP_GLOW_DURATION;
    audio.jump();
  } else if (
    jumpPressed &&
    (state.inHelperCloud || state.helperCloudGraceTimer > 0) &&
    !player.onGround &&
    !state.cloudDoubleJumpUsed
  ) {
    state.helperCloudJumpBufferTimer = HELPER_CLOUD_JUMP_BUFFER;
  }

  if (
    state.helperCloudJumpBufferTimer > 0 &&
    (state.inHelperCloud || state.helperCloudGraceTimer > 0) &&
    !player.onGround &&
    !state.cloudDoubleJumpUsed
  ) {
    player.vy = Math.min(player.vy - 40, HELPER_CLOUD_DOUBLE_JUMP_VEL);
    state.cloudDoubleJumpUsed = true;
    state.helperCloudJumpBufferTimer = 0;
    state.jumpBufferTimer = 0;
    state.jumpGlowTimer = JUMP_GLOW_DURATION;
    audio.jump();
  }

  state.squashTimer = Math.max(0, state.squashTimer - dt);
  state.jumpGlowTimer = Math.max(0, state.jumpGlowTimer - dt);
}

export function clampAndCheckFall(state: GameState, audio: GameAudio) {
  state.player.x = clamp(state.player.x, PLAYER_R, state.W - PLAYER_R);
  if (state.player.y > state.H + 80) {
    audio.fall();
    reset(state, { fell: true });
  }
}
