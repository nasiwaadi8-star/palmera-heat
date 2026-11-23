// people.js — the pedestrians of Vista Palmera: they stroll the sidewalks,
// the park and the beach, pick a new corner when they arrive, and run for
// their lives when the city's crime comes too close.

import { PALETTE } from './config.js';
import { circleHitsSolid, randomWalkPoint } from './world.js';

export function makePed(rng, x, y) {
  return {
    x, y,
    angle: rng.angle(),
    speed: 0,
    walkSpeed: rng.range(38, 68),
    state: 'walk', // 'walk' | 'flee' | 'down'
    tx: x, ty: y,
    waitTimer: rng.range(0, 2),
    downTimer: 0,
    phase: rng.range(0, Math.PI * 2), // walk-cycle swing
    shirt: rng.pick(PALETTE.pedShirts),
    pants: rng.pick(['#2c3e50', '#7f5539', '#e8e2cf', '#34495e', '#935116']),
    skin: rng.pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']),
  };
}

export function knockDown(ped) {
  if (ped.state !== 'down') {
    ped.state = 'down';
    ped.downTimer = 2.4;
    ped.speed = 0;
  }
}

/**
 * Move one pedestrian. `threat` is {x, y} of something scary nearby (a
 * speeding car, a fight) or null. Movement slides along walls.
 */
export function updatePed(ped, dt, world, rng, threat) {
  ped.phase += dt * (2 + Math.abs(ped.speed) * 0.09);

  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) ped.state = 'flee';
    return;
  }

  const threatDist = threat ? Math.hypot(threat.x - ped.x, threat.y - ped.y) : Infinity;
  if (threatDist < 170) ped.state = 'flee';
  else if (ped.state === 'flee' && threatDist > 260) ped.state = 'walk';

  let moveX = 0;
  let moveY = 0;
  let speed = 0;

  if (ped.state === 'flee' && threat) {
    const away = Math.atan2(ped.y - threat.y, ped.x - threat.x);
    moveX = Math.cos(away);
    moveY = Math.sin(away);
    speed = 152;
    ped.angle = turnToward(ped.angle, away, dt * 10);
  } else {
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8 || ped.waitTimer > 4) {
      const spot = randomWalkPoint(rng, world, ped.x, ped.y, 9);
      if (spot) { ped.tx = spot.x; ped.ty = spot.y; }
      ped.waitTimer = 0;
    } else {
      moveX = dx / dist;
      moveY = dy / dist;
      speed = ped.walkSpeed;
      ped.angle = turnToward(ped.angle, Math.atan2(dy, dx), dt * 8);
    }
    ped.waitTimer += dt;
  }

  ped.speed = speed;
  if (speed === 0) return;
  const nx = ped.x + moveX * speed * dt;
  const ny = ped.y + moveY * speed * dt;
  if (!circleHitsSolid(world, nx, ny, 9)) {
    ped.x = nx;
    ped.y = ny;
  } else if (!circleHitsSolid(world, nx, ped.y, 9)) {
    ped.x = nx;
  } else if (!circleHitsSolid(world, ped.x, ny, 9)) {
    ped.y = ny;
  } else if (ped.state === 'walk') {
    ped.waitTimer = 99; // bumped into a wall: pick a new target next tick
  }
}

function turnToward(angle, target, maxStep) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return angle + Math.max(-maxStep, Math.min(maxStep, diff));
}
