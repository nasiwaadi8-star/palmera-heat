// shots.js — screenshot staging. With ?shot=1..4 the game sets up one
// deterministic scene of Palmera Heat for its maker to capture: the title
// over the city, a job on foot, a drive down the avenue, and a full police
// chase. Input is locked so the scene holds while the picture is taken.

import { makeCar } from './vehicles.js';
import { circleHitsSolid, randomRoadPoint } from './world.js';

export function stageShot(game, n) {
  const world = game.world;
  const rng = game.rng;
  game.input.enabled = false;

  if (n === 1) {
    // Title screen over a beach-side vista of the city (HUD stays hidden).
    game.state = 'title';
    game.cam.x = 2950;
    game.cam.y = 1560;
    game.cam.zoom = 1.02;
    game.camFixed = true;
    seedTraffic(game, 2950, 1560, 6);
    return;
  }

  game.hudEl.classList.remove('hidden');
  game.hideOverlay();
  game.state = 'play';
  const L = world.locations;

  if (n === 2) {
    // On foot outside the diner, first job on the board, city alive around.
    // Stand on open pavement near the diner, just outside pickup range.
    const candidates = [[-96, 40], [-112, -30], [40, 112], [122, 20], [-60, -106], [96, -64]];
    for (const [ox, oy] of candidates) {
      const x = L.diner.x + ox;
      const y = L.diner.y + oy;
      if (!circleHitsSolid(world, x, y, 13)) {
        game.player.x = x;
        game.player.y = y;
        break;
      }
    }
    game.player.angle = Math.atan2(L.diner.y - game.player.y, L.diner.x - game.player.x);
    game.missions.cooldown = 0;
    game.missions.update(0.01); // starts FIRST RUN: marker beam at the diner
    seedTraffic(game, game.player.x, game.player.y, 4);
    seedPeds(game, game.player.x, game.player.y, 7);
    snapCam(game);
    return;
  }

  if (n === 3) {
    // Driving a Vireo GT down the avenue, traffic ahead, job marker up.
    const car = game.givePlayerCar('sport', 42 * 32 + 16, 30 * 32, Math.PI / 2);
    car.speed = 175;
    game.autopilot = true;
    game.missions.storyIndex = 1;
    game.missions.cooldown = 0;
    game.missions.update(0.01); // BORROWED WHEELS briefing
    seedTraffic(game, car.x, car.y + 420, 4);
    seedPeds(game, car.x, car.y, 5);
    snapCam(game);
    return;
  }

  if (n === 4) {
    // The chase: four stars, three interceptors, nowhere to hide.
    const car = game.givePlayerCar('sedan', 101 * 32 + 16, 60 * 32, -Math.PI / 2);
    car.speed = 225;
    car.color = '#d94f3d';
    game.autopilot = true;
    game.setWanted(4);
    for (let i = 0; i < 3; i++) {
      const cop = makeCar(rng, 'police', car.x + (i - 1) * 54, car.y + 120 + i * 62, -Math.PI / 2, 'police');
      cop.speed = 205;
      game.cars.push(cop);
    }
    game.missions.storyIndex = 2;
    game.missions.cooldown = 0;
    game.missions.update(0.01); // HEAT CHECK
    if (game.missions.active) {
      game.missions.active.stepIndex = 1; // the escape step: "Lose the heat"
      game.missions.active.timeLeft = null;
    }
    seedPeds(game, car.x, car.y, 4);
    snapCam(game);
  }
}

function snapCam(game) {
  game.cam.x = game.player.x;
  game.cam.y = game.player.y;
}

function seedTraffic(game, x, y, count) {
  for (let i = 0; i < count; i++) {
    const spot = randomRoadPoint(game.rng, game.world, x, y, 3, 15);
    if (!spot) continue;
    const angle = game.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const type = game.rng.pick(['sedan', 'sedan', 'taxi', 'van', 'pickup']);
    const car = makeCar(game.rng, type, spot.x, spot.y, angle, 'traffic');
    car.speed = game.rng.range(60, 110);
    game.cars.push(car);
  }
}

function seedPeds(game, x, y, count) {
  game.spawnPedsNear(x, y, count);
}

export const SHOT_COUNT = 4;
