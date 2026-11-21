// Palmera Heat — round 2 recorded rewrite: pedestrians are the city feeling alive — they
// stroll, flee danger, and (as lookouts) shoot back.
// People of Vista Palmera: pedestrians who stroll the sidewalks and flee trouble,
// taxi hailers, and the marina lookouts who shoot back during the story. Everyone is
// a small circle with a heading; the game (main.js) owns combat resolution.
import { CELL, ROAD } from './config.js';
import { collideBuildings, isOnRoad } from './world.js';

const SHIRTS = ['#ff8fa3', '#ffd166', '#8ecae6', '#95d5b2', '#f9c74f', '#c8b6ff', '#ffafcc', '#a7c957'];

let pedSeq = 1;
export function makePed(random, x, y) {
  return {
    id: pedSeq++, x, y, r: 9, angle: random() * Math.PI * 2,
    shirt: SHIRTS[Math.floor(random() * SHIRTS.length)],
    speed: 42 + random() * 30, state: 'walk', tx: x, ty: y, wait: 0,
    hostile: false, hp: 3, fireTimer: 0, hail: false, dead: false, inCar: false,
  };
}

export function spawnPedsAround(random, cx, cy, count, existing) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard < count * 30) {
    guard += 1;
    const x = cx + (random() - 0.5) * 1500;
    const y = cy + (random() - 0.5) * 1100;
    if (x < 30 || y < 30 || isOnRoad(x, y)) continue;
    const p = makePed(random, x, y);
    if (!existing.some((o) => Math.hypot(o.x - x, o.y - y) < 26)) peds.push(p);
  }
  return peds;
}

function pickStrollTarget(ped, random) {
  // Stroll to a nearby sidewalk point: just inside a block edge.
  const bx = Math.floor(ped.x / CELL) * CELL; const by = Math.floor(ped.y / CELL) * CELL;
  ped.tx = bx + ROAD + 8 + random() * 190;
  ped.ty = by + ROAD + 8 + random() * 190;
}

export function pedStep(ped, dt, random, danger) {
  if (ped.dead || ped.inCar) return;
  let speed = ped.speed;
  if (danger && Math.hypot(danger.x - ped.x, danger.y - ped.y) < 190) ped.state = 'flee';
  if (ped.state === 'flee') {
    const dx = ped.x - danger.x; const dy = ped.y - danger.y;
    const d = Math.hypot(dx, dy) || 1;
    ped.tx = ped.x + (dx / d) * 200; ped.ty = ped.y + (dy / d) * 200;
    speed = 128;
    if (d > 260) ped.state = 'walk';
  }
  const dx = ped.tx - ped.x; const dy = ped.ty - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) { pickStrollTarget(ped, random); return; }
  ped.angle = Math.atan2(dy, dx);
  const probe = { x: ped.x + Math.cos(ped.angle) * speed * dt, y: ped.y + Math.sin(ped.angle) * speed * dt, r: ped.r };
  collideBuildings({ buildings: pedCity.buildings, }, probe);
  ped.x = probe.x; ped.y = probe.y;
}
// The city is set once by main.js so pedestrians collide with the same buildings.
const pedCity = { buildings: [] };
export function setPedCity(city) { pedCity.buildings = city.buildings; }

export function makeHostile(x, y, name) {
  const ped = makePed(Math.random, x, y);
  ped.hostile = true; ped.name = name; ped.shirt = '#37474f'; ped.speed = 30;
  return ped;
}
