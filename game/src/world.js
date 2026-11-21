// Palmera Heat — round 2 recorded rewrite: the city is data and geometry only — the same
// seeded layout drives the game, the collisions and the minimap.
// Vista Palmera itself: a seeded grid city of pastel blocks, parks and parking lots,
// a beach and the sea to the east, named landmarks, and the collision/road helpers
// every other system uses. Pure data and geometry — no drawing, no browser.
import { BLOCK, CELL, CITY_H, CITY_W, COLS, ROAD, ROWS, SEA_X, WORLD_H, WORLD_W } from './config.js';

export function roadCenterX(i) { return i * CELL + ROAD / 2; }
export function roadCenterY(j) { return j * CELL + ROAD / 2; }
export function isOnRoad(x, y) {
  if (x > CITY_W || y > CITY_H) return x > CITY_W; // the coastal strip counts as road
  const mx = x % CELL; const my = y % CELL;
  return mx < ROAD || my < ROAD;
}
export function isWater(x, y) { return x > SEA_X + 130; }
export function clampWorld(p, r) {
  p.x = Math.min(WORLD_W - r, Math.max(r, p.x));
  p.y = Math.min(WORLD_H - r, Math.max(r, p.y));
}

const ROOFS = ['#e8b4a0', '#dfc39a', '#cfe0d8', '#e6d7f0', '#f2e3b3', '#bcd6ea', '#eec9c0', '#d5e8b0', '#f5f0e1', '#c9d8c5'];
const WALLS = ['#c98f6f', '#bfa87e', '#9fb8ad', '#b3a4cc', '#cbb877', '#93b4cc', '#c99a90', '#a9c184'];

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const lots = [];
  const palms = [];
  for (let cx = 0; cx < COLS; cx += 1) {
    for (let cy = 0; cy < ROWS; cy += 1) {
      const bx = cx * CELL + ROAD; const by = cy * CELL + ROAD;
      const roll = random();
      if (roll < 0.14) { parks.push({ x: bx, y: by, w: BLOCK, h: BLOCK }); continue; }
      if (roll < 0.24) { lots.push({ x: bx, y: by, w: BLOCK, h: BLOCK }); continue; }
      const n = 1 + Math.floor(random() * 3);
      for (let k = 0; k < n; k += 1) {
        const w = 62 + random() * 60; const h = 62 + random() * 60;
        const x = bx + 8 + random() * Math.max(10, BLOCK - w - 16);
        const y = by + 8 + random() * Math.max(10, BLOCK - h - 16);
        buildings.push({
          x, y, w, h,
          roof: ROOFS[Math.floor(random() * ROOFS.length)],
          wall: WALLS[Math.floor(random() * WALLS.length)],
          tall: 14 + random() * 40,
          name: '',
        });
      }
      if (random() < 0.6) palms.push({ x: bx + 10 + random() * 30, y: by + BLOCK - 14 });
    }
  }
  // Beach palms along the sand.
  for (let y = 60; y < CITY_H; y += 90 + random() * 60) palms.push({ x: SEA_X + 30 + random() * 50, y });

  function landmark(name, cx, cy, color) {
    const x = roadCenterX(cx); const y = roadCenterY(cy);
    const b = { x: x - 52, y: y - 118, w: 104, h: 84, roof: color, wall: color, tall: 60, name };
    buildings.push(b);
    return { name, x, y: y + 6 };
  }
  const places = {
    safehouse: { name: "Rafi's Garage", x: roadCenterX(1), y: roadCenterY(7) - 40 },
    workshop: landmark("Lina's Workshop", 2, 6, '#8ecae6'),
    market: landmark('Mercado Serena', 4, 3, '#ffb703'),
    tower: landmark('Palmera Crown Tower', 5, 2, '#cdb4db'),
    marina: { name: 'Marina Serena', x: SEA_X + 60, y: roadCenterY(4) },
    hospital: landmark('St. Serena Hospital', 7, 5, '#f1fa8c'),
    station: landmark('Palmera Police HQ', 6, 4, '#90a4ae'),
    impound: landmark('Police Impound', 7, 4, '#a1887f'),
    chopshop: { name: "Bruno's Chop Shop", x: roadCenterX(8), y: roadCenterY(1) - 40 },
  };
  // Hidden cash stashes in alleys and parks.
  const stashes = [];
  for (let i = 0; i < 10; i += 1) {
    stashes.push({ x: 120 + random() * (CITY_W - 240), y: 120 + random() * (CITY_H - 240), taken: false });
  }
  return { buildings, parks, lots, palms, places, stashes };
}

/** Push a circle (entity with x, y, r) out of every building; returns true if it hit one. */
export function collideBuildings(city, e) {
  let hit = false;
  for (const b of city.buildings) {
    if (e.x + e.r < b.x || e.x - e.r > b.x + b.w || e.y + e.r < b.y || e.y - e.r > b.y + b.h) continue;
    const dxl = e.x + e.r - b.x; const dxr = b.x + b.w - (e.x - e.r);
    const dyt = e.y + e.r - b.y; const dyb = b.y + b.h - (e.y - e.r);
    const m = Math.min(dxl, dxr, dyt, dyb);
    if (m === dxl) e.x = b.x - e.r; else if (m === dxr) e.x = b.x + b.w + e.r;
    else if (m === dyt) e.y = b.y - e.r; else e.y = b.y + b.h + e.r;
    hit = true;
  }
  if (isWater(e.x, e.y)) { e.x = SEA_X + 130 - e.r; hit = true; }
  clampWorld(e, e.r);
  return hit;
}
