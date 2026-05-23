import type { GameState } from "../types";

export function updateMovingPlatforms(state: GameState, dt: number) {
  for (const platform of state.movingPlatforms) {
    platform.prevX = platform.x;
    platform.prevY = platform.y;

    if (platform.axis === "x") {
      platform.x += platform.dir * platform.speed * dt;
      const left = platform.initX - platform.distance;
      const right = platform.initX + platform.distance;
      if (platform.x < left) {
        platform.x = left;
        platform.dir = 1;
      } else if (platform.x > right) {
        platform.x = right;
        platform.dir = -1;
      }
    } else {
      platform.y += platform.dir * platform.speed * dt;
      const top = platform.initY - platform.distance;
      const bottom = platform.initY + platform.distance;
      if (platform.y < top) {
        platform.y = top;
        platform.dir = 1;
      } else if (platform.y > bottom) {
        platform.y = bottom;
        platform.dir = -1;
      }
    }

    platform.dx = platform.x - platform.prevX;
    platform.dy = platform.y - platform.prevY;
  }
}
