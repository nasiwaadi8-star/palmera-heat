// main.js — Palmera Heat's game loop and the systems that tie the city
// together: the player on foot and behind the wheel, traffic and police,
// crime and the wanted level, busted/wasted, the HUD, saving, and the
// screenshot staging hook (?shot=1..4).

import { CITY_SEED, TUNING } from './config.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { MissionManager } from './missions.js';
import { knockDown, makePed, updatePed } from './people.js';
import { Rng } from './random.js';
import { Renderer } from './render.js';
import { clearSave, loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';
import { makeCar, policeInput, stepCar, trafficInput } from './vehicles.js';
import {
  buildWorld, circleHitsSolid, randomRoadPoint, randomWalkPoint,
} from './world.js';

const canvas = document.getElementById('game');
const mmCanvas = document.getElementById('minimap');
const mmCtx = mmCanvas.getContext('2d');
const el = (id) => document.getElementById(id);

const game = {
  world: buildWorld(CITY_SEED),
  rng: new Rng(CITY_SEED ^ 0x9e3779b9),
  input: new Input(canvas),
  sound: new Sound(),
  renderer: new Renderer(canvas),
  state: 'title', // 'title' | 'play' | 'pause' | 'down'
  downKind: null, // 'busted' | 'wasted'
  time: 0,
  cars: [],
  peds: [],
  particles: [],
  skids: [],
  player: null,
  missions: null,
  money: 0,
  wanted: 0,
  crimeMeter: 0,
  unseenTimer: 0,
  bustMeter: 0,
  missionCar: null,
  lastSkid: null, // last rear-wheel positions, so skid marks join up
  autopilot: false,
  camFixed: false,
  cam: { x: 0, y: 0, zoom: 1 },
  spawnTimer: 0,
  saveTimer: 0,
  hudEl: el('hud'),
  toastUntil: 0,
  bannerUntil: 0,
  lastStars: -1,
  lastObjective: '',
  lastMoney: -1,
};

game.player = freshPlayer(game.world.locations.motel);
const saved = loadSave();
if (saved) {
  game.money = saved.money;
  if (saved.x !== null && !circleHitsSolid(game.world, saved.x, saved.y, 12)) {
    game.player.x = saved.x;
    game.player.y = saved.y;
  }
}
game.missions = new MissionManager(game, saved?.storyIndex ?? 0, saved?.errandsDone ?? 0);
game.cam.x = game.player.x;
game.cam.y = game.player.y;

// Methods the mission manager and the shot stager call back into.
game.toast = toast;
game.banner = banner;
game.addMoney = (n) => { game.money += n; };
game.setWanted = setWanted;
game.saveProgress = saveProgress;
game.spawnMissionCar = spawnMissionCar;
game.clearMissionCar = clearMissionCar;
game.hideOverlay = hideOverlay;
game.givePlayerCar = givePlayerCar;
game.spawnPedsNear = spawnPedsNear;

function freshPlayer(loc) {
  return {
    x: loc.x + 30, y: loc.y + 26, angle: 0.6,
    vx: 0, vy: 0, speed: 0, phase: 0,
    mode: 'foot', car: null,
    hp: TUNING.playerMaxHp,
    punchTimer: 0, punchCooldown: 0,
  };
}

/* ---------------- spawning ---------------- */

function spawnParkedCars() {
  const rng = game.rng;
  for (const lot of game.world.lots) {
    const count = rng.int(5, 7);
    for (let i = 0; i < count; i++) {
      const tx = rng.int(lot.x0 + 1, lot.x1 - 1);
      const ty = rng.int(lot.y0 + 1, lot.y1 - 1);
      const type = rng.pick(['sedan', 'sedan', 'van', 'pickup', 'sport', 'taxi']);
      const car = makeCar(rng, type, tx * 32 + 16, ty * 32 + 16, rng.pick([0, Math.PI]), null);
      game.cars.push(car);
    }
  }
}

function spawnTrafficCar() {
  const spot = randomRoadPoint(game.rng, game.world, game.player.x, game.player.y, 15, 27);
  if (!spot) return;
  const type = game.rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'van', 'pickup', 'sport']);
  const angle = game.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  const car = makeCar(game.rng, type, spot.x, spot.y, angle, 'traffic');
  car.speed = game.rng.range(50, 100);
  game.cars.push(car);
}

function spawnPoliceCar() {
  const spot = randomRoadPoint(game.rng, game.world, game.player.x, game.player.y, 17, 24);
  if (!spot) return;
  const angle = Math.atan2(game.player.y - spot.y, game.player.x - spot.x);
  const car = makeCar(game.rng, 'police', spot.x, spot.y, angle, 'police');
  car.speed = 120;
  game.cars.push(car);
}

function spawnPedsNear(x, y, count) {
  for (let i = 0; i < count; i++) {
    const spot = randomWalkPoint(game.rng, game.world, x, y, 16);
    if (spot) game.peds.push(makePed(game.rng, spot.x, spot.y));
  }
}

function spawnMissionCar() {
  clearMissionCar();
  const loc = game.world.locations.warehouse;
  const spot = randomRoadPoint(game.rng, game.world, loc.x, loc.y, 1, 4) ?? { x: loc.x, y: loc.y };
  const car = makeCar(game.rng, 'sport', spot.x, spot.y, 0, null);
  car.color = '#ffcf3f'; // the yellow Vireo GT Tito wants
  game.cars.push(car);
  game.missionCar = car;
}

function clearMissionCar() {
  if (!game.missionCar) return;
  if (game.player.car !== game.missionCar) {
    game.cars = game.cars.filter((c) => c !== game.missionCar);
  }
  game.missionCar = null;
}

function givePlayerCar(type, x, y, angle) {
  const car = makeCar(game.rng, type, x, y, angle, 'player');
  game.cars.push(car);
  game.player.mode = 'car';
  game.player.car = car;
  game.player.x = x;
  game.player.y = y;
  return car;
}

/* ---------------- crime and the law ---------------- */

function isWitnessed(x, y) {
  for (const car of game.cars) {
    if (car.driver === 'police' && Math.hypot(car.x - x, car.y - y) < 470) return true;
  }
  for (const ped of game.peds) {
    if (ped.state !== 'down' && Math.hypot(ped.x - x, ped.y - y) < 300) return true;
  }
  return false;
}

function crime(points, x, y) {
  const seen = isWitnessed(x, y);
  game.crimeMeter += seen ? points : points * 0.25;
  const level = TUNING.wantedThresholds.filter((t) => game.crimeMeter >= t).length;
  if (level > game.wanted) {
    game.wanted = level;
    if (level > 0) game.sound.blip();
  }
}

function setWanted(n) {
  if (n > game.wanted) game.wanted = n;
  const floor = n > 0 ? TUNING.wantedThresholds[n - 1] + 5 : 0;
  game.crimeMeter = Math.max(game.crimeMeter, floor);
}

function playerSeenByPolice() {
  const p = game.player;
  for (const car of game.cars) {
    if (car.driver === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < 430) return true;
  }
  return false;
}

function updateLaw(dt) {
  const p = game.player;
  // Keep the police fleet matched to the wanted level.
  const want = TUNING.policePerStar[game.wanted];
  const cops = game.cars.filter((c) => c.driver === 'police');
  game.spawnTimer -= dt;
  if (cops.length < want && game.spawnTimer <= 0) {
    spawnPoliceCar();
    game.spawnTimer = TUNING.policeSpawnDelay;
  }
  if (game.wanted === 0) {
    for (const cop of cops) cop.driver = 'traffic'; // they give up and roll off
    game.crimeMeter = Math.max(0, game.crimeMeter - dt * 4);
    game.bustMeter = 0;
    return;
  }
  // Decay: stay unseen and the stars fall, one at a time.
  if (playerSeenByPolice()) {
    game.unseenTimer = 0;
  } else {
    game.unseenTimer += dt;
    if (game.unseenTimer > TUNING.wantedDecayDelay) {
      game.unseenTimer = 0;
      game.wanted -= 1;
      game.crimeMeter = game.wanted > 0 ? TUNING.wantedThresholds[game.wanted - 1] - 1 : 0;
      if (game.wanted === 0) toast('You lost the heat.');
    }
  }
  // Busted: a cop close by while you are slow corners you.
  const speed = p.mode === 'car' ? Math.abs(p.car.speed) : p.speed;
  let nearest = Infinity;
  for (const cop of cops) nearest = Math.min(nearest, Math.hypot(cop.x - p.x, cop.y - p.y));
  if (nearest < TUNING.bustRadius && speed < 34) {
    game.bustMeter += dt;
    if (game.bustMeter >= TUNING.bustSeconds) return playerDown('busted');
  } else {
    game.bustMeter = Math.max(0, game.bustMeter - dt * 1.6);
  }
}

function playerDown(kind) {
  game.state = 'down';
  game.downKind = kind;
  const fine = Math.min(game.money, kind === 'busted' ? 150 : 120);
  game.money -= fine;
  game.wanted = 0;
  game.crimeMeter = 0;
  game.bustMeter = 0;
  game.missions.onPlayerDown();
  game.sound.setEngine(false);
  game.sound.setSiren(false);
  game.sound.sting(false);
  if (kind === 'busted') {
    showOverlay('BUSTED', `The Palmera PD got you. $${fine} in fines and fees, and your name in their book.`, 'Press ENTER to walk out of the station');
  } else {
    showOverlay('WASTED', `You woke up at Palmera General. $${fine} for the ambulance and the stitches.`, 'Press ENTER to check yourself out');
  }
  saveProgress();
}

function respawn() {
  const motel = game.world.locations.motel;
  if (game.player.car) {
    game.player.car.driver = null;
    game.player.car = null;
  }
  game.player = freshPlayer(motel);
  game.cars = game.cars.filter((c) => c.driver !== 'police');
  hideOverlay();
  game.state = 'play';
}

/* ---------------- player ---------------- */

function updatePlayerOnFoot(dt) {
  const p = game.player;
  const input = game.input;
  const axis = input.axis();
  const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const moving = axis.x !== 0 || axis.y !== 0;
  const speed = moving ? TUNING.playerSpeed * (sprint ? TUNING.playerSprint : 1) : 0;
  p.speed = speed;
  const oldX = p.x;
  const oldY = p.y;

  if (moving) {
    const len = Math.hypot(axis.x, axis.y);
    const dx = (axis.x / len) * speed * dt;
    const dy = (axis.y / len) * speed * dt;
    if (!circleHitsSolid(game.world, p.x + dx, p.y, TUNING.playerRadius)) p.x += dx;
    if (!circleHitsSolid(game.world, p.x, p.y + dy, TUNING.playerRadius)) p.y += dy;
    p.angle = Math.atan2(axis.y, axis.x);
    p.phase += dt * speed * 0.055;
  }
  p.vx = dt > 0 ? (p.x - oldX) / dt : 0;
  p.vy = dt > 0 ? (p.y - oldY) / dt : 0;

  p.punchTimer = Math.max(0, p.punchTimer - dt);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  const clicked = input.mouse.clicked;
  if (clicked) {
    const wx = game.cam.x + (input.mouse.x - game.renderer.w / 2) / game.cam.zoom;
    const wy = game.cam.y + (input.mouse.y - game.renderer.h / 2) / game.cam.zoom;
    p.angle = Math.atan2(wy - p.y, wx - p.x);
  }
  if ((input.wasPressed('Space') || clicked) && p.punchCooldown <= 0) punch();

  if (input.wasPressed('KeyE')) tryEnterCar();
}

function punch() {
  const p = game.player;
  p.punchTimer = 0.18;
  p.punchCooldown = TUNING.punchCooldown;
  game.sound.punch();
  const hx = p.x + Math.cos(p.angle) * 30;
  const hy = p.y + Math.sin(p.angle) * 30;
  for (const ped of game.peds) {
    if (ped.state !== 'down' && Math.hypot(ped.x - hx, ped.y - hy) < 30) {
      knockDown(ped);
      burst(hx, hy, 6, '#d8cfb8', 90);
      crime(15, p.x, p.y);
      toast('Assault! People saw that.');
      return;
    }
  }
  for (const car of game.cars) {
    if (car !== p.car && Math.hypot(car.x - hx, car.y - hy) < 42) {
      car.hp -= 7;
      game.sound.crash(0.4);
      burst(hx, hy, 5, '#ffd94d', 110);
      crime(8, p.x, p.y);
      return;
    }
  }
}

function tryEnterCar() {
  const p = game.player;
  let best = null;
  let bestDist = TUNING.enterCarRange;
  for (const car of game.cars) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestDist) { best = car; bestDist = d; }
  }
  if (!best) return;
  if (best.driver === 'traffic') {
    // Yank the driver out; they run, and everyone sees it.
    spawnPedAt(best.x, best.y, true);
    crime(18, p.x, p.y);
    toast('Carjacked! Keep moving.');
  } else if (best.type === 'police') {
    crime(30, p.x, p.y);
    toast("Stealing a police interceptor. Bold.");
  } else if (best.driver === null) {
    crime(10, p.x, p.y);
  }
  best.driver = 'player';
  p.mode = 'car';
  p.car = best;
  game.sound.door();
}

function exitCar() {
  const p = game.player;
  const car = p.car;
  if (!car) return;
  car.driver = null;
  // Step out on whichever side is not inside a building or the sea.
  for (const sideSign of [1, -1, 2, -2]) {
    const a = car.angle + Math.sign(sideSign) * (Math.PI / 2);
    const nx = car.x + Math.cos(a) * 16 * Math.abs(sideSign);
    const ny = car.y + Math.sin(a) * 16 * Math.abs(sideSign);
    if (!circleHitsSolid(game.world, nx, ny, TUNING.playerRadius)) {
      p.x = nx;
      p.y = ny;
      break;
    }
  }
  p.mode = 'foot';
  p.car = null;
  game.sound.door();
  game.sound.setEngine(false);
}

function spawnPedAt(x, y, fleeing) {
  const ped = makePed(game.rng, x, y);
  if (fleeing) ped.state = 'flee';
  game.peds.push(ped);
}

function updatePlayerDriving(dt) {
  const p = game.player;
  const car = p.car;
  const input = game.autopilot
    ? trafficInput(car, game.world, allBlockers(), game.rng)
    : game.input.carAxis();
  if (!game.autopilot && game.input.isDown('Space') && car.speed > 20) {
    input.throttle = -1; // handbrake-ish hard stop on Space while driving
  }
  const impact = stepCar(car, input, dt, game.world);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.vx = Math.cos(car.angle) * car.speed;
  p.vy = Math.sin(car.angle) * car.speed;
  p.speed = Math.abs(car.speed);

  if (impact > 120) {
    game.sound.crash(Math.min(1, impact / 300));
    car.hp -= impact * 0.05;
    burst(car.x + Math.cos(car.angle) * car.length / 2, car.y + Math.sin(car.angle) * car.length / 2, 8, '#ffd94d', 150);
    if (impact > 190) crime(6, car.x, car.y);
    shake(impact / 60);
  }
  // Skid marks when cornering hard at speed: join last frame's rear
  // wheels to this frame's, one segment per tyre.
  if (Math.abs(car.speed) > 150 && Math.abs(input.steer) > 0.55) {
    const bx = car.x - Math.cos(car.angle) * car.length * 0.32;
    const by = car.y - Math.sin(car.angle) * car.length * 0.32;
    const px = -Math.sin(car.angle) * car.width * 0.36;
    const py = Math.cos(car.angle) * car.width * 0.36;
    const wheels = [{ x: bx + px, y: by + py }, { x: bx - px, y: by - py }];
    if (game.lastSkid) {
      for (let i = 0; i < 2; i++) {
        game.skids.push({ x1: game.lastSkid[i].x, y1: game.lastSkid[i].y, x2: wheels[i].x, y2: wheels[i].y, alpha: 1 });
      }
      if (game.skids.length > 260) game.skids.splice(0, game.skids.length - 260);
    }
    game.lastSkid = wheels;
  } else {
    game.lastSkid = null;
  }
  if (!game.autopilot && game.input.wasPressed('KeyH')) game.sound.horn();
  if (!game.autopilot && game.input.wasPressed('KeyE') && Math.abs(car.speed) < 24) exitCar();
}

/* ---------------- world population ---------------- */

function allBlockers() {
  const pts = game.cars.map((c) => ({ x: c.x, y: c.y }));
  pts.push({ x: game.player.x, y: game.player.y });
  for (const ped of game.peds) pts.push({ x: ped.x, y: ped.y });
  return pts;
}

/** Where the city's population is centred: the player, or the camera while
 * the title screen pans the bay (so the title vista stays alive). */
function populationAnchor() {
  return game.state === 'title' ? game.cam : game.player;
}

function updateTraffic(dt) {
  const p = game.player;
  const anchor = populationAnchor();
  const blockers = allBlockers();
  let trafficCount = 0;
  game.cars = game.cars.filter((car) => {
    if (car.driver === 'traffic') {
      trafficCount += 1;
      const d = Math.hypot(car.x - anchor.x, car.y - anchor.y);
      if (d > 1250 && car !== game.missionCar) return false;
    }
    if (car.driver === 'police') {
      const d = Math.hypot(car.x - anchor.x, car.y - anchor.y);
      if (d > 1500) return false;
    }
    return true;
  });
  if (trafficCount < TUNING.trafficCount && game.rng.chance(0.3)) spawnTrafficCar();

  for (const car of game.cars) {
    if (car.driver === 'traffic') {
      const input = trafficInput(car, game.world, blockers.filter((b) => b.x !== car.x || b.y !== car.y), game.rng);
      const impact = stepCar(car, input, dt, game.world);
      if (impact > 160) {
        car.hp -= impact * 0.04;
        if (Math.hypot(car.x - p.x, car.y - p.y) < 320) game.sound.crash(0.5);
      }
      // Stuck behind the player? Lean on the horn, like a local.
      car.honkTimer -= dt;
      const toPlayer = Math.hypot(p.x - car.x, p.y - car.y);
      if (car.honkTimer <= 0 && Math.abs(car.speed) < 14 && toPlayer > 30 && toPlayer < 95
        && ((p.x - car.x) * Math.cos(car.angle) + (p.y - car.y) * Math.sin(car.angle)) / toPlayer > 0.5) {
        game.sound.horn();
        car.honkTimer = game.rng.range(5, 11);
      }
    } else if (car.driver === 'police') {
      const target = { x: p.x, y: p.y, vx: p.vx, vy: p.vy, inCar: p.mode === 'car' };
      const impact = stepCar(car, policeInput(car, target, dt), dt, game.world);
      if (impact > 200) car.hp -= impact * 0.03;
    }
  }
}

function updateCarCollisions(dt) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = (a.length + b.length) * 0.36;
      if (d === 0 || d >= min) continue;
      const nx = dx / d;
      const ny = dy / d;
      const push = (min - d) / 2;
      if (!circleHitsSolid(game.world, a.x - nx * push, a.y - ny * push, 14)) { a.x -= nx * push; a.y -= ny * push; }
      if (!circleHitsSolid(game.world, b.x + nx * push, b.y + ny * push, 14)) { b.x += nx * push; b.y += ny * push; }
      const rel = Math.abs(a.speed - b.speed);
      const avg = (a.speed + b.speed) / 2;
      a.speed = avg * 0.7;
      b.speed = avg * 0.7;
      if (rel > 60) {
        a.hp -= rel * 0.05;
        b.hp -= rel * 0.05;
        if (Math.hypot(a.x - game.player.x, a.y - game.player.y) < 340) game.sound.crash(Math.min(1, rel / 260));
        if (game.player.car === a || game.player.car === b) {
          crime(7, game.player.x, game.player.y);
          shake(rel / 50);
        }
      }
    }
  }
  void dt;
}

function updatePeds(dt) {
  const p = game.player;
  const anchor = populationAnchor();
  game.peds = game.peds.filter((ped) => Math.hypot(ped.x - anchor.x, ped.y - anchor.y) < 950);
  if (game.peds.length < TUNING.pedCount && game.rng.chance(0.25)) {
    spawnPedsNear(p.x, p.y, 1);
  }
  // The scariest thing near each pedestrian: a fast car, or a running fight.
  for (const ped of game.peds) {
    let threat = null;
    let best = 150;
    for (const car of game.cars) {
      if (Math.abs(car.speed) < 55) continue;
      const d = Math.hypot(car.x - ped.x, car.y - ped.y);
      if (d < best) { best = d; threat = car; }
    }
    updatePed(ped, dt, game.world, game.rng, threat);
    // Stepped into the road at the wrong moment.
    for (const car of game.cars) {
      if (ped.state === 'down' || Math.abs(car.speed) < 45) continue;
      if (Math.hypot(car.x - ped.x, car.y - ped.y) < 24) {
        knockDown(ped);
        car.speed *= 0.82;
        burst(ped.x, ped.y, 7, '#d8cfb8', 100);
        if (car === p.car || car.driver === 'player') {
          crime(25, p.x, p.y);
          p.hp -= 2;
          toast('You hit a pedestrian!');
          game.sound.crash(0.7);
        }
        break;
      }
    }
  }
}

/* ---------------- effects, HUD, overlays ---------------- */

let shakeAmp = 0;
function shake(n) { shakeAmp = Math.min(9, Math.max(shakeAmp, n)); }

function burst(x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = game.rng.range(0, Math.PI * 2);
    const s = game.rng.range(speed * 0.3, speed);
    game.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: game.rng.range(0.3, 0.7), maxLife: 0.7,
      color, size: game.rng.range(1.6, 3.4),
    });
  }
}

function toast(text) {
  const t = el('toast');
  t.textContent = text;
  t.classList.remove('hidden');
  game.toastUntil = performance.now() + 3400;
}

function banner(title, sub) {
  el('banner-title').textContent = title;
  el('banner-sub').textContent = sub;
  el('banner').classList.remove('hidden');
  game.bannerUntil = performance.now() + 3600;
}

function showOverlay(title, sub, action) {
  el('overlay-title').textContent = title;
  el('overlay-sub').textContent = sub;
  el('overlay-action').textContent = action;
  el('overlay').classList.remove('hidden');
}

function hideOverlay() {
  el('overlay').classList.add('hidden');
}

function updateHud() {
  const now = performance.now();
  el('toast').classList.toggle('hidden', now > game.toastUntil);
  el('banner').classList.toggle('hidden', now > game.bannerUntil);

  if (game.money !== game.lastMoney) {
    game.lastMoney = game.money;
    el('hud-money').textContent = `$${game.money}`;
  }
  el('hud-health-fill').style.width = `${Math.max(0, game.player.hp)}%`;

  if (game.wanted !== game.lastStars) {
    game.lastStars = game.wanted;
    let html = '';
    for (let i = 0; i < 5; i++) html += `<span class="${i < game.wanted ? '' : 'off'}">★</span>`;
    el('hud-stars').innerHTML = html;
  }
  let objective = game.missions.objectiveText();
  const marker = game.missions.marker();
  if (marker && game.state === 'play') {
    const d = Math.hypot(marker.x - game.player.x, marker.y - game.player.y);
    objective += ` · ${Math.round(d / 10)}m`;
  }
  if (game.bustMeter > 0.25) objective = 'THE POLICE ARE CLOSING IN — MOVE!';
  if (objective !== game.lastObjective) {
    game.lastObjective = objective;
    el('hud-objective').textContent = objective;
  }
}

function saveProgress() {
  writeSave({
    money: game.money,
    storyIndex: game.missions.storyIndex,
    errandsDone: game.missions.errandsDone,
    x: Math.round(game.player.x),
    y: Math.round(game.player.y),
  });
}

/* ---------------- the loop ---------------- */

function update(dt) {
  game.time += dt;
  const p = game.player;

  if (game.state === 'title') {
    // Slow pan across the bay while the title is up.
    if (!game.camFixed) {
      game.cam.x = 2400 + Math.sin(game.time * 0.05) * 700;
      game.cam.y = 1500 + Math.cos(game.time * 0.037) * 420;
    }
    updateTraffic(dt);
    updatePeds(dt);
    return;
  }
  if (game.state !== 'play') return;

  game.missions.update(dt);

  if (p.mode === 'foot') updatePlayerOnFoot(dt);
  else updatePlayerDriving(dt);

  // Tito quietly collects the Vireo once the theft job is history.
  if (game.missionCar && game.missions.storyIndex >= 2 && p.car !== game.missionCar) {
    clearMissionCar();
  }

  updateTraffic(dt);
  updateCarCollisions(dt);
  updatePeds(dt);
  updateLaw(dt);

  // Health creeps back when life is calm.
  if (game.wanted === 0 && p.hp < TUNING.playerMaxHp) {
    p.hp = Math.min(TUNING.playerMaxHp, p.hp + dt * 2.2);
  }
  if (p.hp <= 0) return playerDown('wasted');

  // Camera: follow with a little lead in the direction of travel.
  const lead = p.mode === 'car' ? 0.34 : 0.12;
  const tx = p.x + p.vx * lead;
  const ty = p.y + p.vy * lead;
  const k = 1 - Math.exp(-TUNING.cameraLerp * dt);
  game.cam.x += (tx - game.cam.x) * k;
  game.cam.y += (ty - game.cam.y) * k;
  const targetZoom = p.mode === 'car' ? 0.94 - Math.min(0.16, Math.abs(p.car.speed) / 2400) : 1.0;
  game.cam.zoom += (targetZoom - game.cam.zoom) * (1 - Math.exp(-2.4 * dt));
  if (shakeAmp > 0.1) {
    game.cam.x += game.rng.range(-shakeAmp, shakeAmp);
    game.cam.y += game.rng.range(-shakeAmp, shakeAmp);
    shakeAmp *= Math.exp(-7 * dt);
  }

  // Particles and skid fade.
  for (const pt of game.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
  }
  game.particles = game.particles.filter((pt) => pt.life > 0);
  for (const s of game.skids) {
    s.alpha -= dt * 0.03; // segments stay where they were laid, slowly fading
  }
  game.skids = game.skids.filter((s) => s.alpha > 0.05);

  // Sound follows the action.
  game.sound.setEngine(p.mode === 'car', Math.abs(p.car?.speed ?? 0) / 330);
  let copNear = false;
  for (const car of game.cars) {
    if (car.driver === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < 520) { copNear = true; break; }
  }
  game.sound.setSiren(game.wanted > 0 && copNear);

  game.saveTimer -= dt;
  if (game.saveTimer <= 0) {
    game.saveTimer = TUNING.saveEverySeconds;
    saveProgress();
  }
}

function handleKeys() {
  const input = game.input;
  if (input.pressedEdges.size > 0 || input.mouse.clicked) game.sound.ensure();
  if (input.wasPressed('KeyM')) {
    toast(game.sound.toggleMute() ? 'Sound off' : 'Sound on');
  }
  if (game.state === 'title' && input.wasPressed('Enter')) {
    hideOverlay();
    game.hudEl.classList.remove('hidden');
    game.state = 'play';
    game.sound.ensure();
    game.sound.blip();
  } else if (game.state === 'down' && input.wasPressed('Enter')) {
    respawn();
  } else if (game.state === 'play' && (input.wasPressed('KeyP') || input.wasPressed('Escape'))) {
    game.state = 'pause';
    showOverlay('PAUSED', 'Vista Palmera waits for no one. Well — just this once, it waits for you.', 'Press P to keep playing');
    game.sound.setEngine(false);
    game.sound.setSiren(false);
  } else if (game.state === 'pause' && (input.wasPressed('KeyP') || input.wasPressed('Escape') || input.wasPressed('Enter'))) {
    hideOverlay();
    game.state = 'play';
  }
  if (input.wasPressed('KeyR') && input.isDown('ShiftLeft') && game.state === 'title') {
    clearSave(); // hidden fresh-start on the title screen
  }
}

let lastStamp = 0;
function frame(stamp) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, lastStamp ? (stamp - lastStamp) / 1000 : 0.016);
  lastStamp = stamp;
  handleKeys();
  update(dt);
  game.renderer.draw(game);
  if (game.state !== 'title') game.renderer.drawMinimap(mmCtx, game);
  updateHud();
  game.input.endFrame();
  if (!document.body.dataset.boot) document.body.dataset.boot = 'ok';
}

function boot() {
  game.renderer.resize();
  window.addEventListener('resize', () => game.renderer.resize());
  window.addEventListener('error', (e) => { document.body.dataset.boot = `error: ${e.message}`; });
  spawnParkedCars();
  spawnPedsNear(game.player.x, game.player.y, TUNING.pedCount);
  for (let i = 0; i < TUNING.trafficCount; i++) spawnTrafficCar();

  const shot = Number(new URLSearchParams(window.location.search).get('shot'));
  if (shot >= 1 && shot <= 4) stageShot(game, shot);

  requestAnimationFrame(frame);
}

window.__game = game;
boot();
