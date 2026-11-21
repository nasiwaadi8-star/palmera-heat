// Palmera Heat — round 2 recorded rewrite: tune the city or the chase here; everything
// else in the game reads these numbers, so one constant changes the whole feel.
// World and gameplay constants for Palmera Heat, an original open-world crime game
// set in the fictional sun-soaked coastal city of Vista Palmera. You play Rafi Solano,
// a wheelman who owes money to the wrong people and has one week to drive his way out.

export const GAME_TITLE = 'PALMERA HEAT';
export const GAME_SUBTITLE = 'One driver. One city. One last score.';
export const CITY_NAME = 'Vista Palmera';
export const HERO_NAME = 'Rafi Solano';

export const SAVE_KEY = 'palmera-heat-save-v1';
export const BEST_KEY = 'palmera-heat-best-v1';

// The city is a grid: blocks of BLOCK px separated by roads of ROAD px, with the sea
// along the eastern edge. All sizes are world pixels.
export const BLOCK = 216;
export const ROAD = 64;
export const CELL = BLOCK + ROAD;
export const COLS = 10;
export const ROWS = 8;
export const CITY_W = COLS * CELL + ROAD;
export const CITY_H = ROWS * CELL + ROAD;
export const SEA_X = CITY_W + 30;
export const WORLD_W = SEA_X + 560;
export const WORLD_H = CITY_H;

export const STEP = 1 / 60;

export const PLAYER_RADIUS = 11;
export const PLAYER_WALK = 150;
export const PLAYER_SPRINT = 232;
export const PLAYER_HEALTH = 100;

export const WANTED_MAX = 5;
// Seconds out of police sight needed to shake off one star.
export const WANTED_COOL = 8;

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const PALETTE = {
  grass: '#79a85b',
  grassDark: '#6d9c52',
  sand: '#ecd39a',
  water: '#2e7fa8',
  waterDeep: '#256b91',
  asphalt: '#41454e',
  asphaltDark: '#383c44',
  lane: '#e9cd72',
  sidewalk: '#cfc4ae',
  curb: '#b3a78e',
  plaza: '#d9c9a3',
  roofShadow: 'rgba(40,30,20,0.28)',
  text: '#fdf6e3',
  dark: '#1d2126',
  gold: '#ffc845',
  red: '#ef5350',
  blue: '#57a8ff',
  green: '#7dd069',
  panel: 'rgba(18,22,28,0.88)',
};
