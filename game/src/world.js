// world.js — Vista Palmera itself: a seeded procedural city on a tile grid.
// Avenues and streets carve blocks; blocks become pastel buildings, one
// park and two parking lots; the east edge runs down a sandy beach to the
// sea, with a pier and the marina. Also the collision and spawn queries
// every other system uses.

import { PALETTE, TILE, WORLD_H, WORLD_W } from './config.js';
import { Rng } from './random.js';

export const T = {
  GRASS: 0,
  ROAD: 1,
  SIDEWALK: 2,
  BUILDING: 3,
  SAND: 4,
  WATER: 5,
  PARK: 6,
  LOT: 7,
  PIER: 8,
};

const AVENUES = [10, 26, 42, 58, 74, 90]; // vertical road centre columns
const STREETS = [10, 24, 38, 52, 66, 80]; // horizontal road centre rows
const COAST_ROAD_X = 101; // Palmera Boulevard, along the beach
const SAND_X = 104; // first sand column
const WATER_X = 114; // first water column

export function buildWorld(seed) {
  const rng = new Rng(seed);
  const grid = new Uint8Array(WORLD_W * WORLD_H);
  const at = (x, y) => grid[y * WORLD_W + x];
  const set = (x, y, v) => { grid[y * WORLD_W + x] = v; };

  // Streets run west to the coast road; avenues run the full height.
  for (const cx of [...AVENUES, COAST_ROAD_X]) {
    for (let y = 0; y < WORLD_H; y++) {
      for (let dx = -1; dx <= 1; dx++) set(cx + dx, y, T.ROAD);
    }
  }
  for (const cy of STREETS) {
    for (let x = 0; x <= COAST_ROAD_X + 1; x++) {
      for (let dy = -1; dy <= 1; dy++) set(x, cy + dy, T.ROAD);
    }
  }

  // Beach and sea.
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = SAND_X; x < WORLD_W; x++) set(x, y, x >= WATER_X ? T.WATER : T.SAND);
  }
  // The marina pier reaches into the water at the middle street.
  for (let x = WATER_X; x < WORLD_W; x++) {
    for (let y = 51; y <= 53; y++) set(x, y, T.PIER);
  }

  // Blocks: the rectangles of land between road bands.
  const xBands = blockBands([...AVENUES, COAST_ROAD_X], WORLD_W);
  const yBands = blockBands(STREETS, WORLD_H);
  const buildings = [];
  const lots = [];
  let parkBlock = null;

  for (const [bx0, bx1] of xBands) {
    for (const [by0, by1] of yBands) {
      if (bx0 >= SAND_X) continue; // beach, no blocks
      const isPark = bx0 === 44 && by0 === 26;
      const isLot = (bx0 === 12 && by0 === 12) || (bx0 === 60 && by0 === 68);
      if (isPark) {
        parkBlock = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
        for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) set(x, y, T.PARK);
        continue;
      }
      if (isLot) {
        lots.push({ x0: bx0, y0: by0, x1: bx1, y1: by1 });
        for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) set(x, y, T.LOT);
        continue;
      }
      fillBlockWithBuildings(rng, grid, buildings, bx0, by0, bx1, by1);
    }
  }

  // Sidewalks: any open tile touching a road becomes pavement.
  for (let y = 1; y < WORLD_H - 1; y++) {
    for (let x = 1; x < WORLD_W - 1; x++) {
      if (at(x, y) !== T.GRASS) continue;
      if (at(x - 1, y) === T.ROAD || at(x + 1, y) === T.ROAD
        || at(x, y - 1) === T.ROAD || at(x, y + 1) === T.ROAD) {
        set(x, y, T.SIDEWALK);
      }
    }
  }
  // A promenade between the coast road and the sand.
  for (let y = 0; y < WORLD_H; y++) {
    if (at(103, y) === T.SAND) set(103, y, T.SIDEWALK);
  }

  const props = scatterProps(rng, grid, parkBlock);
  const locations = placeLocations(grid);

  return {
    grid,
    buildings,
    lots,
    props,
    locations,
    avenues: AVENUES,
    streets: STREETS,
    coastRoadX: COAST_ROAD_X,
    sandX: SAND_X,
    waterX: WATER_X,
    tileAt(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return T.WATER;
      return grid[ty * WORLD_W + tx];
    },
  };
}

/** Land bands between 3-wide roads whose centres are given. */
function blockBands(centres, size) {
  const bands = [];
  let start = 2;
  for (const c of centres) {
    if (c - 2 >= start) bands.push([start, c - 2]);
    start = c + 2;
  }
  if (start <= size - 3) bands.push([start, size - 3]);
  return bands;
}

function fillBlockWithBuildings(rng, grid, buildings, bx0, by0, bx1, by1) {
  const set = (x, y, v) => { grid[y * WORLD_W + x] = v; };
  let x = bx0;
  while (x <= bx1) {
    const w = Math.min(rng.int(4, 6), bx1 - x + 1);
    if (bx1 - x + 1 - w === 1) { x++; continue; } // avoid a 1-wide sliver
    let y = by0;
    while (y <= by1) {
      const d = Math.min(rng.int(4, 5), by1 - y + 1);
      if (by1 - y + 1 - d === 1) { y++; continue; }
      const colorIdx = rng.int(0, PALETTE.buildingWalls.length - 1);
      const floors = rng.int(1, 4);
      buildings.push({
        x: x * TILE, y: y * TILE, w: w * TILE, h: d * TILE,
        color: PALETTE.buildingWalls[colorIdx],
        roof: PALETTE.buildingRoofs[colorIdx],
        floors,
      });
      for (let ty = y; ty < y + d; ty++) for (let tx = x; tx < x + w; tx++) set(tx, ty, T.BUILDING);
      y += d + 1; // 1-tile alley between plots
    }
    x += w + 1;
  }
}

function scatterProps(rng, grid, parkBlock) {
  const props = [];
  const at = (x, y) => grid[y * WORLD_W + x];
  // Palms along the beach and the promenade.
  for (let y = 3; y < WORLD_H - 2; y += 2) {
    if (at(105, y) === T.SAND && rng.chance(0.6)) {
      props.push({ kind: 'palm', x: 105 * TILE + 16, y: y * TILE + 16, s: rng.range(0.85, 1.25) });
    }
    if (at(110, y) === T.SAND && rng.chance(0.35)) {
      props.push({ kind: 'palm', x: 110 * TILE + 16, y: y * TILE + 16, s: rng.range(0.8, 1.15) });
    }
    if (at(108, y) === T.SAND && rng.chance(0.3)) {
      props.push({ kind: 'umbrella', x: 108 * TILE + 16, y: y * TILE + 16, s: rng.range(0.9, 1.2) });
    }
    if (at(103, y) === T.SIDEWALK && rng.chance(0.4)) {
      props.push({ kind: 'lamp', x: 103 * TILE + 16, y: y * TILE + 16, s: 1 });
    }
  }
  // Palms and benches in the park.
  if (parkBlock) {
    for (let i = 0; i < 14; i++) {
      const tx = rng.int(parkBlock.x0 + 1, parkBlock.x1 - 1);
      const ty = rng.int(parkBlock.y0 + 1, parkBlock.y1 - 1);
      props.push({ kind: rng.chance(0.7) ? 'palm' : 'bench', x: tx * TILE + 16, y: ty * TILE + 16, s: rng.range(0.9, 1.2) });
    }
  }
  // Street lamps at intersection corners.
  for (const ax of [...AVENUES, COAST_ROAD_X]) {
    for (const sy of STREETS) {
      props.push({ kind: 'lamp', x: (ax - 2) * TILE + 8, y: (sy - 2) * TILE + 8, s: 1 });
      props.push({ kind: 'lamp', x: (ax + 2) * TILE + 24, y: (sy + 2) * TILE + 24, s: 1 });
    }
  }
  return props;
}

function placeLocations(grid) {
  const wanted = [
    ['motel', 'Palmera Sands Motel', 13, 13],
    ['diner', "Dona Rosa's Diner", 29, 13],
    ['warehouse', 'Portside Warehouse', 45, 69],
    ['garage', "Tito's Garage", 61, 41],
    ['hideout', "Rafi's Hideout", 93, 13],
    ['marina', 'Marina del Sol', 111, 52],
  ];
  const locations = {};
  for (const [id, name, tx, ty] of wanted) {
    const spot = nearestWalkable(grid, tx, ty);
    locations[id] = { id, name, x: spot.x * TILE + TILE / 2, y: spot.y * TILE + TILE / 2 };
  }
  return locations;
}

/** Nearest non-solid tile to (tx, ty), searching outward in rings. */
export function nearestWalkable(grid, tx, ty) {
  for (let r = 0; r < 30; r++) {
    for (let y = ty - r; y <= ty + r; y++) {
      for (let x = tx - r; x <= tx + r; x++) {
        if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) continue;
        const t = grid[y * WORLD_W + x];
        if (t !== T.BUILDING && t !== T.WATER) return { x, y };
      }
    }
  }
  return { x: tx, y: ty };
}

/** Is the tile at pixel (x, y) solid for a body of the given kind? */
export function tileSolidAt(world, x, y) {
  const t = world.tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
  return t === T.BUILDING || t === T.WATER;
}

/** Does a circle at (x, y) overlap any solid tile? */
export function circleHitsSolid(world, x, y, r) {
  const pts = [
    [x, y], [x - r, y], [x + r, y], [x, y - r], [x, y + r],
    [x - r * 0.7, y - r * 0.7], [x + r * 0.7, y - r * 0.7],
    [x - r * 0.7, y + r * 0.7], [x + r * 0.7, y + r * 0.7],
  ];
  return pts.some(([px, py]) => tileSolidAt(world, px, py));
}

/** Does a rotated rectangle (a car) overlap any solid tile? */
export function rectHitsSolid(world, x, y, angle, halfL, halfW) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const local = [
    [halfL, halfW], [halfL, -halfW], [-halfL, halfW], [-halfL, -halfW],
    [halfL, 0], [-halfL, 0], [0, halfW], [0, -halfW], [0, 0],
  ];
  return local.some(([lx, ly]) => tileSolidAt(world, x + lx * c - ly * s, y + lx * s + ly * c));
}

/** Random road tile within a ring around (cx, cy); returns pixel centre. */
export function randomRoadPoint(rng, world, cx, cy, minTiles, maxTiles) {
  for (let tries = 0; tries < 60; tries++) {
    const tx = Math.floor(cx / TILE) + rng.int(-maxTiles, maxTiles);
    const ty = Math.floor(cy / TILE) + rng.int(-maxTiles, maxTiles);
    if (tx < 1 || ty < 1 || tx >= WORLD_W - 1 || ty >= WORLD_H - 1) continue;
    const dist = Math.hypot(tx - cx / TILE, ty - cy / TILE);
    if (dist < minTiles) continue;
    if (world.tileAt(tx, ty) === T.ROAD) return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }
  return null;
}

/** Random sidewalk or park tile near a point; returns pixel centre. */
export function randomWalkPoint(rng, world, cx, cy, maxTiles) {
  for (let tries = 0; tries < 60; tries++) {
    const tx = Math.floor(cx / TILE) + rng.int(-maxTiles, maxTiles);
    const ty = Math.floor(cy / TILE) + rng.int(-maxTiles, maxTiles);
    if (tx < 1 || ty < 1 || tx >= WORLD_W - 1 || ty >= WORLD_H - 1) continue;
    const t = world.tileAt(tx, ty);
    if (t === T.SIDEWALK || t === T.PARK || t === T.PIER || t === T.SAND) {
      return { x: tx * TILE + rng.range(6, TILE - 6), y: ty * TILE + rng.range(6, TILE - 6) };
    }
  }
  return null;
}
