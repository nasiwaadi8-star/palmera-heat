// config.js — Palmera Heat's constants: the shape of Vista Palmera, its
// sun-soaked palette, and the tuning numbers every other system reads.

export const TILE = 32;
export const WORLD_W = 120; // tiles across
export const WORLD_H = 90; // tiles down
export const WORLD_PX_W = WORLD_W * TILE;
export const WORLD_PX_H = WORLD_H * TILE;

export const CITY_SEED = 20261123;
export const STORAGE_KEY = 'palmera-heat-save-v1';

export const PALETTE = {
  water: '#1d7fa8',
  waterLight: '#2ea6c8',
  sand: '#ecd49b',
  sandDark: '#dfc084',
  grass: '#6db457',
  park: '#57a047',
  road: '#3b4046',
  roadEdge: '#2f3338',
  lane: '#e8e2cf',
  sidewalk: '#cfc8b8',
  sidewalkEdge: '#b3ab99',
  lot: '#565b60',
  pier: '#9a7b58',
  buildingWalls: ['#e2725b', '#e88ca0', '#5bc0c8', '#f2c14e', '#8f7fd4', '#7fc97f', '#f0956a', '#64a8dd'],
  buildingRoofs: ['#b34a38', '#c06a7d', '#3f9299', '#c79a35', '#6d5db0', '#5da85d', '#c4734d', '#4a82b5'],
  palmTrunk: '#8a6a45',
  palmLeaf: '#3f9e4d',
  playerShirt: '#ff7847',
  playerSkin: '#a06a42',
  pedShirts: ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#e84393', '#f5f0e6', '#16a085', '#d35400'],
};

export const TUNING = {
  playerSpeed: 178, // px/s on foot
  playerSprint: 1.55,
  playerRadius: 11,
  playerMaxHp: 100,
  punchRange: 40,
  punchCooldown: 0.38,
  enterCarRange: 52,
  trafficCount: 14,
  pedCount: 16,
  parkedCount: 16,
  cameraLerp: 5.2,
  // Crime meter points that buy each wanted star (index = stars - 1).
  wantedThresholds: [12, 30, 55, 85, 120],
  wantedDecayDelay: 5.5, // unseen seconds before a star drops
  bustRadius: 74,
  bustSeconds: 2.4,
  policePerStar: [0, 1, 2, 3, 4, 6],
  policeSpawnDelay: 1.6, // seconds between interceptor call-outs
  saveEverySeconds: 10,
};
