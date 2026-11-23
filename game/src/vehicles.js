// vehicles.js — everything with wheels in Vista Palmera: car types, an
// arcade physics step shared by everyone, a traffic brain that follows the
// road grid and keeps to the right lane, and a police brain that hunts the
// player. Brains produce the same {throttle, steer} input a player does.

import { TILE } from './config.js';
import { rectHitsSolid, T } from './world.js';

export const CAR_TYPES = {
  sedan: { label: 'Palmera Sedan', topSpeed: 265, accel: 210, colors: ['#d94f3d', '#3d7bd9', '#e8e2cf', '#57b06a', '#8d99ae', '#e0a458'] },
  taxi: { label: 'Sol Cab', topSpeed: 250, accel: 200, colors: ['#f7b731'] },
  sport: { label: 'Vireo GT', topSpeed: 360, accel: 300, colors: ['#ffcf3f', '#ff5d47', '#37e0c8', '#c86bff'] },
  van: { label: 'Cargo Van', topSpeed: 215, accel: 165, colors: ['#dfe6ee', '#9fb4c7', '#f2d16b'] },
  pickup: { label: 'Dune Pickup', topSpeed: 240, accel: 190, colors: ['#c96f2e', '#4f7d5a', '#707880'] },
  police: { label: 'PPD Interceptor', topSpeed: 330, accel: 285, colors: ['#f2f4f6'] },
};

export function makeCar(rng, type, x, y, angle, driver = 'traffic') {
  const spec = CAR_TYPES[type];
  return {
    type,
    spec,
    x, y, angle,
    speed: 0,
    color: type === 'police' ? spec.colors[0] : rng.pick(spec.colors),
    length: type === 'van' || type === 'pickup' ? 52 : 46,
    width: 23,
    driver, // 'traffic' | 'police' | 'player' | null (parked)
    hp: 100,
    steerVis: 0,
    stuckTimer: 0,
    reverseTimer: 0,
    honkTimer: 0,
    dead: false,
  };
}

/**
 * Advance one car by dt with the given input. Returns the impact speed if
 * the car hit something solid this step, else 0.
 */
export function stepCar(car, input, dt, world) {
  const { topSpeed, accel } = car.spec;
  const throttle = Math.max(-1, Math.min(1, input.throttle));
  const steer = Math.max(-1, Math.min(1, input.steer));
  car.steerVis = steer;
  car.braking = throttle < -0.05 || (throttle === 0 && Math.abs(car.speed) > 26);

  if (throttle > 0) {
    car.speed += accel * throttle * dt;
  } else if (throttle < 0) {
    // Braking when moving forward, reversing when nearly stopped.
    car.speed += (car.speed > 12 ? accel * 1.6 : accel * 0.55) * throttle * dt;
  }
  car.speed -= car.speed * 0.55 * dt; // drag and rolling resistance
  const maxReverse = topSpeed * 0.32;
  car.speed = Math.max(-maxReverse, Math.min(topSpeed, car.speed));
  if (throttle === 0 && Math.abs(car.speed) < 4) car.speed = 0;

  const speedRatio = Math.min(1, Math.abs(car.speed) / 120);
  const turnRate = 2.35 * speedRatio * (car.speed < 0 ? -1 : 1);
  car.angle += steer * turnRate * dt;

  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  const impact = Math.abs(car.speed);
  const halfL = car.length / 2;
  const halfW = car.width / 2;

  if (!rectHitsSolid(world, car.x + dx, car.y + dy, car.angle, halfL, halfW)) {
    car.x += dx;
    car.y += dy;
    return 0;
  }
  // Slide along whichever axis is free, else bounce to a stop.
  if (!rectHitsSolid(world, car.x + dx, car.y, car.angle, halfL, halfW)) {
    car.x += dx;
    car.speed *= 0.55;
    return impact * 0.5;
  }
  if (!rectHitsSolid(world, car.x, car.y + dy, car.angle, halfL, halfW)) {
    car.y += dy;
    car.speed *= 0.55;
    return impact * 0.5;
  }
  car.speed = -car.speed * 0.22;
  return impact;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function tileIsRoad(world, x, y) {
  const t = world.tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
  return t === T.ROAD || t === T.LOT;
}

/** Is anything solid (another car, the player) just ahead of this car? */
function blockedAhead(car, blockers, dist = 60) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const b of blockers) {
    const rx = b.x - car.x;
    const ry = b.y - car.y;
    const d = Math.hypot(rx, ry);
    if (d < dist && d > 1 && (rx * fx + ry * fy) / d > 0.55) return true;
  }
  return false;
}

/** Traffic: follow the roads, keep right, turn at junctions, don't tailgate. */
export function trafficInput(car, world, blockers, rng) {
  const dirX = Math.cos(car.angle);
  const dirY = Math.sin(car.angle);
  const rightX = -dirY;
  const rightY = dirX;
  const aheadX = car.x + dirX * 74;
  const aheadY = car.y + dirY * 74;

  let goalX;
  let goalY;
  if (tileIsRoad(world, aheadX + rightX * 9, aheadY + rightY * 9)) {
    goalX = aheadX + rightX * 9;
    goalY = aheadY + rightY * 9;
  } else {
    // Junction or dead end: pick a new cardinal heading that stays on road.
    const base = Math.round(car.angle / (Math.PI / 2)) * (Math.PI / 2);
    const options = rng.shuffled([0, Math.PI / 2, -Math.PI / 2, Math.PI]);
    let chosen = base + Math.PI; // U-turn is the last resort, listed first fallback
    for (const turn of options) {
      const a = base + turn;
      const px = car.x + Math.cos(a) * 70 - Math.sin(a) * 9;
      const py = car.y + Math.sin(a) * 70 + Math.cos(a) * 9;
      if (tileIsRoad(world, px, py)) { chosen = a; break; }
    }
    goalX = car.x + Math.cos(chosen) * 80 - Math.sin(chosen) * 9;
    goalY = car.y + Math.sin(chosen) * 80 + Math.cos(chosen) * 9;
  }

  const desired = Math.atan2(goalY - car.y, goalX - car.x);
  const diff = angleDiff(desired, car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  let throttle = Math.abs(diff) > 1.1 ? 0.22 : 0.72;
  if (blockedAhead(car, blockers)) throttle = car.speed > 30 ? -0.7 : 0;
  return { throttle, steer };
}

/** Police: steer at the target's near future position and keep coming. */
export function policeInput(car, target, dt) {
  if (car.reverseTimer > 0) {
    car.reverseTimer -= dt;
    return { throttle: -0.85, steer: car.steerVis >= 0 ? -1 : 1 };
  }
  const lead = Math.min(0.55, Math.hypot(target.x - car.x, target.y - car.y) / 700);
  const gx = target.x + (target.vx ?? 0) * lead;
  const gy = target.y + (target.vy ?? 0) * lead;
  const desired = Math.atan2(gy - car.y, gx - car.x);
  const diff = angleDiff(desired, car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2.6));
  const dist = Math.hypot(target.x - car.x, target.y - car.y);
  let throttle = 1;
  if (Math.abs(diff) > 2.4) throttle = 0.3;
  if (dist < 46 && target.inCar !== true) throttle = 0.25; // pull up beside a runner
  if (Math.abs(car.speed) < 6) {
    car.stuckTimer += dt;
    if (car.stuckTimer > 0.9) {
      car.stuckTimer = 0;
      car.reverseTimer = 0.65; // back out and come again
    }
  } else {
    car.stuckTimer = 0;
  }
  return { throttle, steer };
}
