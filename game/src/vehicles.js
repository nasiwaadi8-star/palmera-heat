// Palmera Heat — round 2 recorded rewrite: traffic, the player's driving and the police
// chase all share this one car model — only the steering input differs.
// Cars: parked cars you can steal, traffic that follows the road grid in lanes, and
// the arcade driving model for whichever car the player is sitting in. Police cars
// are cars too — main.js steers them with the chase logic in policeStep below.
import { CELL, COLS, ROAD, ROWS } from './config.js';
import { collideBuildings, roadCenterX, roadCenterY } from './world.js';

export const CAR_KINDS = [
  { name: 'Coupe', color: '#2ec4b6', top: 330, accel: 260, grip: 5.2, value: 260 },
  { name: 'Sedan', color: '#e76f51', top: 285, accel: 210, grip: 4.6, value: 150 },
  { name: 'Hatch', color: '#f4a261', top: 265, accel: 200, grip: 4.8, value: 110 },
  { name: 'Pickup', color: '#6a994e', top: 270, accel: 205, grip: 4.2, value: 170 },
  { name: 'Van', color: '#bc6c25', top: 240, accel: 175, grip: 3.8, value: 140 },
  { name: 'Roadster', color: '#e63946', top: 370, accel: 300, grip: 5.6, value: 420 },
  { name: 'Taxi', color: '#ffd60a', top: 280, accel: 210, grip: 4.6, value: 130 },
];
export const POLICE_KIND = { name: 'Patrol Cruiser', color: '#e8eef4', top: 345, accel: 265, grip: 5.0, value: 0 };

let carSeq = 1;
export function makeCar(kind, x, y, angle) {
  return {
    id: carSeq++, kindName: kind.name, color: kind.color, top: kind.top, accel: kind.accel,
    grip: kind.grip, value: kind.value, x, y, angle, speed: 0, r: 17, hp: 100,
    police: kind === POLICE_KIND, playerDriven: false, driver: null, stolen: false,
    mission: false, dead: false, flash: 0,
    // traffic route state: current and target intersection indices
    gx: 0, gy: 0, tx: 0, ty: 0, cruise: 120 + Math.random() * 60,
  };
}

export function spawnParked(city, random, count) {
  const cars = [];
  for (const lot of city.lots) {
    const n = 1 + Math.floor(random() * 3);
    for (let i = 0; i < n && cars.length < count; i += 1) {
      const kind = CAR_KINDS[Math.floor(random() * CAR_KINDS.length)];
      cars.push(makeCar(kind, lot.x + 30 + i * 52, lot.y + 40 + random() * 100, Math.PI / 2));
    }
  }
  while (cars.length < count) {
    const kind = CAR_KINDS[Math.floor(random() * CAR_KINDS.length)];
    const i = Math.floor(random() * (COLS + 1)); const j = Math.floor(random() * ROWS);
    cars.push(makeCar(kind, roadCenterX(i) + 20, roadCenterY(j) + 60 + random() * 300, 0));
  }
  return cars;
}

function lanePoint(i, j, dir) {
  // Right-hand traffic: offset 15 px to the right of the road centre for the heading.
  const cx = roadCenterX(i); const cy = roadCenterY(j);
  return { x: cx + dir.y * 15, y: cy - dir.x * 15 };
}

export function initTraffic(car, random) {
  car.gx = Math.round(Math.random() * COLS); car.gy = Math.round(Math.random() * ROWS);
  pickNext(car, random, true);
  const p = lanePoint(car.gx, car.gy, dirTo(car));
  car.x = p.x; car.y = p.y;
  car.angle = Math.atan2(dirTo(car).y, dirTo(car).x);
}
function dirTo(car) {
  return { x: Math.sign(car.tx - car.gx), y: Math.sign(car.ty - car.gy) };
}
function pickNext(car, random, first) {
  const dirs = [];
  if (car.gx < COLS) dirs.push([1, 0]);
  if (car.gx > 0) dirs.push([-1, 0]);
  if (car.gy < ROWS) dirs.push([0, 1]);
  if (car.gy > 0) dirs.push([0, -1]);
  const back = first ? null : { x: -Math.sign(car.tx - car.gx), y: -Math.sign(car.ty - car.gy) };
  const options = dirs.filter(([x, y]) => !back || x !== back.x || y !== back.y);
  const pick = options[Math.floor(random() * options.length)] || dirs[0];
  car.tx = car.gx + pick[0]; car.ty = car.gy + pick[1];
}

/** Advance one traffic car along its lane toward its target intersection. */
export function trafficStep(car, dt, random, obstacles) {
  const dir = dirTo(car);
  const target = lanePoint(car.tx, car.ty, dir);
  const dx = target.x - car.x; const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  let want = car.cruise;
  for (const o of obstacles) {
    const ox = o.x - car.x; const oy = o.y - car.y;
    const ahead = ox * dir.x + oy * dir.y;
    const side = Math.abs(ox * dir.y - oy * dir.x);
    if (ahead > 0 && ahead < 78 && side < 26 && o !== car) want = Math.min(want, ahead < 40 ? 0 : car.cruise * 0.4);
  }
  car.speed += Math.sign(want - car.speed) * Math.min(Math.abs(want - car.speed), 190 * dt);
  car.angle = Math.atan2(dir.y, dir.x);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (dist < 12) { car.gx = car.tx; car.gy = car.ty; pickNext(car, random, false); }
}

/** Arcade driving for the player's car. input: {x: steer -1..1, y: throttle -1..1}. */
export function driveStep(car, dt, input, city) {
  const throttle = -input.y;
  if (throttle > 0) car.speed += car.accel * dt * (car.speed < 0 ? 2.2 : 1);
  else if (throttle < 0) car.speed -= car.accel * 0.75 * dt * (car.speed > 0 ? 2.2 : 1);
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 60 * dt);
  if (input.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 420 * dt);
  car.speed = Math.max(-car.top * 0.38, Math.min(car.top, car.speed));
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 90);
  car.angle += input.x * car.grip * 0.42 * steerAuthority * dt * (car.speed < 0 ? -1 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const probe = { x: nx, y: ny, r: car.r };
  const hit = collideBuildings(city, probe);
  if (hit && Math.abs(car.speed) > 120) car.hp -= 4;
  if (hit) car.speed *= 0.45;
  car.x = probe.x; car.y = probe.y;
  return hit;
}

/** Police chase steering: seek the player, sliding along buildings. */
export function policeStep(car, dt, target, city) {
  const dx = target.x - car.x; const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
  const top = car.top * (dist > 320 ? 1.05 : 0.82);
  car.speed += Math.sign(top - car.speed) * Math.min(Math.abs(top - car.speed), 320 * dt);
  const probe = { x: car.x + Math.cos(car.angle) * car.speed * dt, y: car.y + Math.sin(car.angle) * car.speed * dt, r: car.r };
  if (collideBuildings(city, probe)) car.speed *= 0.5;
  car.x = probe.x; car.y = probe.y;
  return dist;
}
export { CELL, ROAD };
