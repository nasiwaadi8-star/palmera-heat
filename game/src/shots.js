// Deterministic screenshot scenes behind ?shot=start|play|drive|chase (with &seed=N).
// Each one arranges the real game state — the actual player, cars, pedestrians,
// police and mission HUD — steps the real simulation forward a little, and leaves
// the frame for main.js to paint. Same seed, same frame, every time.
import { POLICE_KIND, initTraffic, makeCar, trafficStep } from './vehicles.js';
import { pedStep, spawnPedsAround } from './people.js';
import { roadCenterX } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function settle(game, steps, stepFn) {
  for (let i = 0; i < steps; i += 1) stepFn(game, 1 / 60);
}
function enterCar(game, car) {
  car.playerDriven = true; car.traffic = false;
  game.player.inCar = car; game.player.x = car.x; game.player.y = car.y;
}

export function stageShot(game, name, stepFn) {
  const places = game.city.places;
  const p = game.player;
  if (name === 'play') {
    game.screen = SCREEN_PLAY;
    game.missions.index = 1;
    game.missions.phase = 'offer';
    p.x = roadCenterX(4) + 16; p.y = places.market.y + 130; p.angle = -0.6;
    game.peds.push(...spawnPedsAround(game.rng, p.x, p.y, 14, game.peds));
    p.cash = 320;
    game.cam.x = p.x; game.cam.y = p.y; game.cam.zoom = 1.05;
    game.dialog = [{ who: 'Bruno', line: 'A package waits at the Mercado. Take it to Marisol at the marina. Fast.' }];
    game.dialogTimer = 99;
    settle(game, 80, stepFn);
    game.dialogTimer = 99;
    return;
  }
  if (name === 'drive') {
    game.screen = SCREEN_PLAY;
    game.missions.phase = 'offer';
    const car = game.cars.find((c) => c.kindName === 'Coupe') || game.cars[0];
    car.x = roadCenterX(10) + 14; car.y = places.marina.y + 120; car.angle = -Math.PI / 2; car.speed = 230;
    enterCar(game, car);
    p.cash = 540;
    game.cam.x = car.x; game.cam.y = car.y;
    settle(game, 55, stepFn);
    return;
  }
  if (name === 'chase') {
    game.screen = SCREEN_PLAY;
    game.missions.index = 2;
    game.missions.phase = 'active';
    game.missions.stepIndex = 1;
    const car = game.cars.find((c) => c.kindName === 'Roadster') || game.cars[1] || game.cars[0];
    car.x = places.tower.x + 40; car.y = places.tower.y + 190; car.angle = Math.PI / 2; car.speed = 210;
    car.stolen = true;
    enterCar(game, car);
    game.passenger = true;
    p.cash = 890;
    game.wanted.stars = 4;
    for (let i = 0; i < 3; i += 1) {
      const cop = makeCar(POLICE_KIND, car.x - 90 - i * 70, car.y + 120 + i * 36, Math.PI / 2);
      cop.speed = 190;
      game.cops.push(cop);
    }
    game.cam.x = car.x; game.cam.y = car.y;
    settle(game, 45, stepFn);
    game.wanted.stars = 4;
    return;
  }
  // start (and anything else): the title over a living downtown backdrop.
  game.screen = SCREEN_TITLE;
  game.cam.x = places.tower.x; game.cam.y = places.tower.y; game.cam.zoom = 0.85;
  for (let i = 0; i < 150; i += 1) {
    for (const car of game.cars) if (car.traffic) trafficStep(car, 1 / 60, game.rng, game.cars);
    for (const ped of game.peds) pedStep(ped, 1 / 60, game.rng, null);
  }
  game.hasSave = false;
}
export { initTraffic };
