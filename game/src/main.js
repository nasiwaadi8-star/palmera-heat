// Palmera Heat — round 2 recorded rewrite: this file is the game's heart — boot, the
// fixed-step loop and the whole simulation — while drawing lives in render.js.
// Palmera Heat: boot, the fixed-step loop, and the whole simulation — driving,
// walking, traffic, pedestrians, police and wanted level, combat, missions,
// the chop shop, stashes, saving. Drawing lives in render.js; staged
// screenshot scenes live in shots.js.
//
// ?seed=N fixes the city. ?shot=start|play|drive|chase (with &seed=N) stages a
// deterministic scene, paints it and sets window.__shotReady.
import { PLAYER_HEALTH, PLAYER_RADIUS, PLAYER_SPRINT, PLAYER_WALK, STEP, WANTED_COOL, WANTED_MAX } from './config.js';
import { createRandom } from './random.js';
import { createCity, collideBuildings, roadCenterX, roadCenterY } from './world.js';
import { CAR_KINDS, POLICE_KIND, driveStep, initTraffic, makeCar, policeStep, spawnParked, trafficStep } from './vehicles.js';
import { makeHostile, pedStep, setPedCity, spawnPedsAround } from './people.js';
import { SUV_KIND, createMissionManager } from './missions.js';
import { createInput, ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, ACTION_PUNCH, ACTION_SAVE } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_ENDING, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { clearSave, loadBest, loadSave, storeBest, storeSave } from './save.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();

export function createGame(gameSeed) {
  const rng = createRandom(gameSeed);
  const city = createCity(createRandom(gameSeed ^ 0x9e3779b9));
  setPedCity(city);
  const places = city.places;
  const cars = spawnParked(city, rng, 16);
  for (let i = 0; i < 13; i += 1) {
    const kind = CAR_KINDS[Math.floor(rng() * CAR_KINDS.length)];
    const car = makeCar(kind, 0, 0, 0);
    car.traffic = true;
    initTraffic(car, rng);
    cars.push(car);
  }
  const game = {
    rng, city, cars, cops: [], peds: [], hostiles: [], particles: [], tracers: [], floats: [],
    player: { x: places.safehouse.x + 30, y: places.safehouse.y + 30, r: PLAYER_RADIUS, angle: -Math.PI / 2, hp: PLAYER_HEALTH, cash: 120, inCar: null, fireTimer: 0, bust: 0, walkCycle: 0 },
    wanted: { stars: 0, cool: 0 },
    missions: createMissionManager(places),
    stashesFound: 0, stats: { earned: 0, stolen: 0 },
    dialog: [], dialogTimer: 0, toast: '', toastTimer: 0,
    danger: null, passenger: false, time: 0, screen: SCREEN_TITLE,
    cam: { x: places.safehouse.x, y: places.safehouse.y, zoom: 1 },
    overReason: '', endingShown: false, muted: false,
  };
  game.peds = spawnPedsAround(rng, game.player.x, game.player.y, 26, []);
  return game;
}

function announce(game, msg) { status.textContent = msg; }
function toast(game, msg, secs = 3) { game.toast = msg; game.toastTimer = secs; }
function floatText(game, x, y, text, color = '#ffc845') { game.floats.push({ x, y, text, color, life: 1.4 }); }
function addDialog(game, lines) { for (const [who, line] of lines) game.dialog.push({ who, line }); if (game.dialogTimer <= 0) game.dialogTimer = 3.8; }

function witnessed(game, x, y, range = 300) {
  for (const c of game.cops) if (Math.hypot(c.x - x, c.y - y) < range + 120) return true;
  for (const p of game.peds) if (!p.dead && Math.hypot(p.x - x, p.y - y) < range) return true;
  return false;
}
export function addWanted(game, n) {
  const before = game.wanted.stars;
  game.wanted.stars = Math.min(WANTED_MAX, game.wanted.stars + n);
  game.wanted.cool = 0;
  if (game.wanted.stars > before) audio.levelWanted();
}
function crime(game, n, x, y) { if (witnessed(game, x, y)) addWanted(game, n); game.danger = { x, y, t: 2.5 }; }

// ---------- missions ----------
function setupStep(game) {
  const s = game.missions.step;
  if (!s) return;
  const rng = game.rng;
  if (s.type === 'stealcar' && !s.carRef) {
    const kind = s.kind === 'SUV' ? SUV_KIND : CAR_KINDS.find((k) => k.name === s.kind) || CAR_KINDS[0];
    const car = makeCar(kind, s.near.x + 60, s.near.y + 70, Math.PI / 4);
    car.mission = true;
    game.cars.push(car);
    s.carRef = car;
  }
  if (s.type === 'shootout') {
    game.hostiles = [];
    for (let i = 0; i < s.count; i += 1) {
      const h = makeHostile(s.x - 90 + rng() * 200, s.y - 60 + rng() * 140, 'Lookout');
      game.hostiles.push(h);
    }
    game.missions.hostilesLeft = s.count;
  }
  if (s.type === 'checkpoints' && !s.pointsList) {
    s.pointsList = [];
    for (let i = 0; i < 5; i += 1) {
      s.pointsList.push({ x: roadCenterX(1 + Math.floor(rng() * 9)), y: roadCenterY(Math.floor(rng() * 8)) });
    }
    game.missions.checkpointIndex = 0;
    game.missions.checkpointTimer = s.eachSeconds;
  }
}
function completeMission(game) {
  const m = game.missions.current;
  game.player.cash += m.reward;
  game.stats.earned += m.reward;
  floatText(game, game.player.x, game.player.y - 30, `+$${m.reward} — ${m.title} complete!`);
  audio.success();
  addDialog(game, m.outro);
  game.missions.index += 1;
  game.missions.phase = 'offer';
  game.missions.stepIndex = 0;
  game.passenger = false;
  if (game.missions.index >= game.missions.list.length) {
    game.missions.storyDone = true;
    if (!game.endingShown) { game.endingShown = true; game.screen = SCREEN_ENDING; }
  }
  storeSave(game);
}
function advanceStep(game) {
  game.missions.stepIndex += 1;
  if (game.missions.stepIndex >= game.missions.current.steps.length) completeMission(game);
  else setupStep(game);
}
function missionStep(game, dt) {
  const M = game.missions;
  if (M.storyDone || !M.current) return;
  const p = game.player;
  if (M.phase === 'offer') {
    const t = M.target();
    if (t && Math.hypot(p.x - t.x, p.y - t.y) < 74) {
      M.phase = 'active'; M.stepIndex = 0;
      addDialog(game, M.current.intro);
      toast(game, `Mission: ${M.current.title}`, 3.5);
      setupStep(game);
    }
    return;
  }
  const s = M.step;
  if (!s) return;
  const inCar = !!p.inCar;
  switch (s.type) {
    case 'goto': if (Math.hypot(p.x - s.x, p.y - s.y) < s.r) advanceStep(game); break;
    case 'pickup': if (!inCar && Math.hypot(p.x - s.x, p.y - s.y) < s.r) { audio.pickup(); if (M.index === 1) addWanted(game, 2); advanceStep(game); } break;
    case 'pickupPassenger': if (inCar && Math.hypot(p.x - s.x, p.y - s.y) < s.r) { game.passenger = true; toast(game, 'Passenger aboard — drive carefully. Or don\'t.', 3); addWanted(game, 2); advanceStep(game); } break;
    case 'stealcar': if (inCar && p.inCar === s.carRef) { game.missions.activeCar = s.carRef; advanceStep(game); } break;
    case 'delivercar': if (inCar && p.inCar === game.missions.activeCar && Math.hypot(p.x - s.x, p.y - s.y) < s.r) advanceStep(game); break;
    case 'escape': if (game.wanted.stars === 0) advanceStep(game); break;
    case 'shootout': if (M.hostilesLeft <= 0) { addWanted(game, 2); advanceStep(game); } break;
    case 'checkpoints': {
      M.checkpointTimer -= dt;
      const t = s.pointsList[M.checkpointIndex];
      if (t && Math.hypot(p.x - t.x, p.y - t.y) < s.r) {
        audio.pickup(); M.checkpointIndex += 1; M.checkpointTimer = s.eachSeconds;
        if (M.checkpointIndex >= s.pointsList.length) { advanceStep(game); break; }
      }
      if (M.checkpointTimer <= 0) { toast(game, 'Out of time — the checkpoints reset.', 3); audio.fail(); M.checkpointIndex = 0; M.checkpointTimer = s.eachSeconds; }
      break;
    }
    default: break;
  }
}

// ---------- combat ----------
function shoot(game, tx, ty) {
  const p = game.player;
  const dx = tx - p.x; const dy = ty - p.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist; const uy = dy / dist;
  const range = 430;
  let bestT = range; let hitKind = null; let hitRef = null;
  function testCircle(e, r, kind) {
    const ex = e.x - p.x; const ey = e.y - p.y;
    const t = ex * ux + ey * uy;
    if (t < 0 || t > bestT) return;
    const perp = Math.abs(ex * uy - ey * ux);
    if (perp < r + 3) { bestT = t; hitKind = kind; hitRef = e; }
  }
  for (const h of game.hostiles) if (!h.dead) testCircle(h, h.r, 'hostile');
  for (const ped of game.peds) if (!ped.dead && !ped.inCar) testCircle(ped, ped.r, 'ped');
  for (const c of game.cops) testCircle(c, c.r, 'cop');
  const endX = p.x + ux * bestT; const endY = p.y + uy * bestT;
  game.tracers.push({ x1: p.x, y1: p.y - 6, x2: endX, y2: endY, life: 0.07 });
  audio.shot();
  game.danger = { x: p.x, y: p.y, t: 2.5 };
  if (hitKind === 'hostile') {
    hitRef.hp -= 1; hitRef.state = 'flee';
    game.particles.push({ x: endX, y: endY, vx: 0, vy: -30, life: 0.3, color: '#ef5350', size: 3 });
    if (hitRef.hp <= 0) { hitRef.dead = true; game.missions.hostilesLeft -= 1; floatText(game, endX, endY - 14, 'Lookout down', '#7dd069'); addWanted(game, witnessed(game, p.x, p.y) ? 1 : 0); }
  } else if (hitKind === 'ped') {
    hitRef.dead = true; crime(game, 2, p.x, p.y); toast(game, 'You shot a civilian!', 2.5);
  } else if (hitKind === 'cop') {
    hitRef.hp -= 12; crime(game, 1, p.x, p.y);
    if (hitRef.hp <= 0) { hitRef.dead = true; addWanted(game, 1); }
  }
}
function punch(game) {
  const p = game.player;
  let target = null; let best = 44;
  for (const e of [...game.hostiles, ...game.peds]) {
    if (e.dead || e.inCar) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < best) { best = d; target = e; }
  }
  audio.punch();
  if (target) {
    target.hp -= 1; target.state = 'flee';
    if (target.hp <= 0) { target.dead = true; if (target.hostile) { game.missions.hostilesLeft -= 1; } else crime(game, 1, p.x, p.y); }
  }
}
function damagePlayer(game, amount) {
  const p = game.player;
  if (p.inCar) { p.inCar.hp -= amount * 0.7; if (p.inCar.hp <= 0) { p.hp -= 20; p.inCar.hp = 8; } return; }
  p.hp -= amount;
  audio.hit();
}

// ---------- police ----------
function policeUpdate(game, dt) {
  const p = game.player;
  const stars = game.wanted.stars;
  const want = stars === 0 ? 0 : Math.min(5, stars + 1);
  game.cops = game.cops.filter((c) => !c.dead);
  if (game.cops.length < want) {
    const a = game.rng() * Math.PI * 2;
    const car = makeCar(POLICE_KIND, p.x + Math.cos(a) * 760, p.y + Math.sin(a) * 760, a);
    if (car.x > 30 && car.y > 30) game.cops.push(car);
  }
  if (game.cops.length > want) game.cops.splice(0, game.cops.length - want);
  let anySight = false;
  for (const cop of game.cops) {
    const dist = policeStep(cop, dt, p, game.city);
    if (dist < 400) anySight = true;
    if (dist < 44 && p.inCar) { damagePlayer(game, 6 * dt * 10 * 0.16); cop.speed *= 0.6; }
    if (!p.inCar && dist < 64) { p.bust += dt * 0.55; } 
    if (stars >= 3 && !p.inCar && dist < 250 && dist > 60) {
      cop.flash -= dt;
      if (cop.flash <= 0) { cop.flash = 0.9 + game.rng() * 0.5; game.tracers.push({ x1: cop.x, y1: cop.y, x2: p.x, y2: p.y, life: 0.07 }); damagePlayer(game, 3.5); }
    }
  }
  if (!p.inCar) { if (!game.cops.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 64)) p.bust = Math.max(0, p.bust - dt * 0.4); }
  else p.bust = 0;
  if (anySight) game.wanted.cool = 0;
  else if (stars > 0) {
    game.wanted.cool += dt;
    if (game.wanted.cool >= WANTED_COOL) { game.wanted.stars -= 1; game.wanted.cool = 0; if (game.wanted.stars === 0) toast(game, 'You lost the police.', 2.5); }
  }
  if (p.bust >= 1) { p.bust = 0; game.screen = SCREEN_BUSTED; audio.fail(); }
}

// ---------- the step ----------
export function stepGame(game, input, dt) {
  game.time += dt;
  const p = game.player;
  if (game.dialogTimer > 0) { game.dialogTimer -= dt; if (game.dialogTimer <= 0 && game.dialog.length) { game.dialog.shift(); game.dialogTimer = game.dialog.length ? 3.8 : 0; } }
  if (game.toastTimer > 0) game.toastTimer -= dt;
  if (game.danger) { game.danger.t -= dt; if (game.danger.t <= 0) game.danger = null; }

  const actions = input ? input.takeActions() : 0;
  if (actions & ACTION_SAVE) { storeSave(game); toast(game, 'Saved. (K saves any time; missions autosave too.)', 2.5); }

  // Player movement
  if (p.inCar) {
    const car = p.inCar;
    const axis = input ? input.axis() : { x: 0, y: 0 };
    const hitWall = driveStep(car, dt, { x: axis.x, y: axis.y, brake: input ? input.handbrake() : false }, game.city);
    if (hitWall && Math.abs(car.speed) > 150) audio.crash(Math.abs(car.speed) / 100);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    audio.setEngine(Math.abs(car.speed) / car.top);
    // Run-over check
    for (const ped of [...game.peds, ...game.hostiles]) {
      if (ped.dead || ped.inCar) continue;
      if (Math.abs(car.speed) > 70 && Math.hypot(ped.x - car.x, ped.y - car.y) < car.r + ped.r) {
        ped.dead = true;
        if (ped.hostile) game.missions.hostilesLeft -= 1; else { crime(game, 2, p.x, p.y); toast(game, 'You ran someone down!', 2.5); }
        audio.crash(2);
      }
    }
    // Car-to-car bumps
    for (const other of game.cars) {
      if (other === car || other.dead) continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < car.r + other.r && d > 0) { other.x += (other.x - car.x) / d * 4; other.y += (other.y - car.y) / d * 4; if (Math.abs(car.speed) > 160) { crime(game, 1, p.x, p.y); audio.crash(3); car.speed *= 0.7; } }
    }
  } else {
    const axis = input ? input.axis() : { x: 0, y: 0 };
    const speed = input && input.sprint() ? PLAYER_SPRINT : PLAYER_WALK;
    const len = Math.hypot(axis.x, axis.y) || 1;
    if (axis.x || axis.y) {
      p.angle = Math.atan2(axis.y, axis.x);
      p.walkCycle += dt * 10;
      const probe = { x: p.x + (axis.x / len) * speed * dt, y: p.y + (axis.y / len) * speed * dt, r: p.r };
      collideBuildings(game.city, probe);
      p.x = probe.x; p.y = probe.y;
    }
    audio.setEngine(0);
    // Shooting toward the mouse
    p.fireTimer -= dt;
    if (input && input.mouse.down && p.fireTimer <= 0) {
      p.fireTimer = 0.22;
      const w = screenToWorld(game, input.mouse.x, input.mouse.y);
      shoot(game, w.x, w.y);
    }
    if (actions & ACTION_PUNCH) punch(game);
    if (p.hp < PLAYER_HEALTH) p.hp = Math.min(PLAYER_HEALTH, p.hp + dt * 0.7);
  }

  // Interact: enter/exit cars, heal at hospital
  if (actions & ACTION_INTERACT) {
    if (p.inCar) {
      const car = p.inCar;
      car.playerDriven = false; p.inCar = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26; p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
      const probe = { x: p.x, y: p.y, r: p.r }; collideBuildings(game.city, probe); p.x = probe.x; p.y = probe.y;
      audio.door(); audio.setEngine(0);
    } else {
      const hosp = game.city.places.hospital;
      let done = false;
      if (Math.hypot(p.x - hosp.x, p.y - hosp.y) < 56 && p.hp < PLAYER_HEALTH && p.cash >= 40) {
        p.cash -= 40; p.hp = PLAYER_HEALTH; toast(game, 'St. Serena patched you up. -$40', 2.5); audio.cash(); done = true;
      }
      if (!done) {
        let bestCar = null; let best = 52;
        for (const car of game.cars) { if (car.dead) continue; const d = Math.hypot(car.x - p.x, car.y - p.y); if (d < best) { best = d; bestCar = car; } }
        if (bestCar) {
          if (bestCar.traffic) { bestCar.traffic = false; bestCar.stolen = true; game.stats.stolen += 1; crime(game, 1, p.x, p.y); }
          else if (!bestCar.stolen && !bestCar.mission) { bestCar.stolen = true; game.stats.stolen += 1; if (witnessed(game, p.x, p.y, 220)) addWanted(game, 1); }
          if (bestCar.mission) { bestCar.stolen = true; addWanted(game, 1); }
          bestCar.playerDriven = true; bestCar.speed = 0;
          p.inCar = bestCar; p.x = bestCar.x; p.y = bestCar.y;
          audio.door();
        }
      }
    }
  }

  // Traffic
  const obstacles = [...game.cars, ...game.cops];
  for (const car of game.cars) {
    if (car.dead || car.playerDriven) continue;
    if (Math.hypot(car.x - p.x, car.y - p.y) > 1500) continue;
    if (car.traffic) trafficStep(car, dt, game.rng, obstacles);
  }
  // Chop shop: a stolen, non-mission car delivered here is sold.
  if (p.inCar && p.inCar.stolen && !p.inCar.mission) {
    const cs = game.city.places.chopshop;
    if (Math.hypot(p.x - cs.x, p.y - cs.y) < 62 && Math.abs(p.inCar.speed) < 30) {
      const value = p.inCar.value;
      game.cars = game.cars.filter((c) => c !== p.inCar);
      p.inCar = null; p.cash += value; game.stats.earned += value;
      floatText(game, cs.x, cs.y - 20, `+$${value} — car fenced at Bruno's`);
      audio.cash();
    }
  }
  // Pedestrians keep the city alive near the player
  for (const ped of game.peds) pedStep(ped, dt, game.rng, game.danger);
  game.peds = game.peds.filter((ped) => !ped.dead || game.rng() < 0.5);
  if (game.peds.length < 22) game.peds.push(...spawnPedsAround(game.rng, p.x, p.y, 6, game.peds));
  // Hostiles shoot back
  for (const h of game.hostiles) {
    if (h.dead) continue;
    const d = Math.hypot(h.x - p.x, h.y - p.y);
    if (d < 330) {
      h.fireTimer -= dt;
      if (h.fireTimer <= 0) { h.fireTimer = 1.1 + game.rng() * 0.7; game.tracers.push({ x1: h.x, y1: h.y, x2: p.x, y2: p.y, life: 0.07 }); damagePlayer(game, p.inCar ? 1.2 : 3.2); }
    }
  }
  policeUpdate(game, dt);
  missionStep(game, dt);
  // Stashes
  for (const s of game.city.stashes) {
    if (s.taken) continue;
    if (Math.hypot(p.x - s.x, p.y - s.y) < 34) { s.taken = true; game.stashesFound += 1; p.cash += 100; game.stats.earned += 100; floatText(game, s.x, s.y - 16, '+$100 stash found'); audio.pickup(); }
  }
  // Particles / tracers / floats
  for (const pt of game.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
  game.particles = game.particles.filter((pt) => pt.life > 0);
  for (const t of game.tracers) t.life -= dt;
  game.tracers = game.tracers.filter((t) => t.life > 0);
  for (const f of game.floats) { f.y -= 26 * dt; f.life -= dt; }
  game.floats = game.floats.filter((f) => f.life > 0);
  audio.setSiren(game.cops.length > 0 && game.wanted.stars > 0, dt);
  // Camera
  const targetZoom = p.inCar ? Math.max(0.72, 0.92 - Math.abs(p.inCar.speed) / p.inCar.top * 0.18) : 1.05;
  game.cam.x += (p.x - game.cam.x) * Math.min(1, dt * 5);
  game.cam.y += (p.y - game.cam.y) * Math.min(1, dt * 5);
  game.cam.zoom += (targetZoom - game.cam.zoom) * Math.min(1, dt * 3);
  // Death
  if (p.hp <= 0) { game.screen = SCREEN_OVER; audio.fail(); }
}

export function screenToWorld(game, sx, sy) {
  return { x: game.cam.x + (sx - window.innerWidth / 2) / game.cam.zoom, y: game.cam.y + (sy - window.innerHeight / 2) / game.cam.zoom };
}

function applySave(game, save) {
  game.player.cash = save.cash;
  game.player.x = save.x; game.player.y = save.y;
  game.missions.index = Math.min(save.missionIndex || 0, game.missions.list.length - 1);
  game.missions.storyDone = !!save.storyDone;
  game.stats.earned = save.totalEarned || 0;
  for (let i = 0; i < (save.stashes || 0) && i < game.city.stashes.length; i += 1) game.city.stashes[i].taken = true;
  game.stashesFound = save.stashes || 0;
  toast(game, 'Save loaded. Welcome back to Vista Palmera.', 3);
}

function respawn(game, atHospital) {
  const place = atHospital ? game.city.places.hospital : game.city.places.safehouse;
  const p = game.player;
  if (p.inCar) { p.inCar.playerDriven = false; p.inCar = null; }
  p.x = place.x + 24; p.y = place.y + 30; p.hp = PLAYER_HEALTH; p.bust = 0;
  game.wanted.stars = 0; game.cops = [];
  game.screen = SCREEN_PLAY;
}

function runGame() {
  const game = createGame(seed);
  const renderer = createRenderer(canvas);
  const input = createInput(canvas);
  let best = loadBest();
  let accumulator = 0;
  let last = performance.now();
  const save = loadSave();
  let hasSave = !!save;

  canvas.addEventListener('pointerdown', () => { audio.unlock(); if (game.screen === SCREEN_TITLE) input.pressConfirm(); });

  function handleScreenActions() {
    const peek = input.takeActions();
    // Re-inject: stepGame also consumes actions; for menus we handle pause/confirm here first.
    if (game.screen === SCREEN_TITLE) {
      if (peek & ACTION_CONFIRM) {
        audio.unlock();
        if (hasSave) applySave(game, save);
        game.screen = SCREEN_PLAY;
        announce(game, 'Playing Palmera Heat.');
      }
    } else if (game.screen === SCREEN_PAUSED) {
      if (peek & (ACTION_PAUSE | ACTION_CONFIRM)) game.screen = SCREEN_PLAY;
    } else if (game.screen === SCREEN_PLAY) {
      if (peek & ACTION_PAUSE) { game.screen = SCREEN_PAUSED; return; }
      // Put the actions back for stepGame by stepping with a shim.
      pendingActions = peek;
      return;
    } else if (game.screen === SCREEN_BUSTED) {
      if (peek & ACTION_CONFIRM) { game.player.cash = Math.max(0, game.player.cash - 150); toast(game, 'Busted! The police took a $150 fine.', 3); respawn(game, false); }
    } else if (game.screen === SCREEN_OVER) {
      if (peek & ACTION_CONFIRM) { game.player.cash = Math.max(0, Math.floor(game.player.cash * 0.9)); toast(game, 'St. Serena patched you up. Hospital took 10% of your cash.', 3); respawn(game, true); }
    } else if (game.screen === SCREEN_ENDING) {
      if (peek & ACTION_CONFIRM) { game.screen = SCREEN_PLAY; toast(game, 'Story complete! Free roam unlocked — Vista Palmera is yours.', 4); }
    }
    pendingActions = 0;
  }
  let pendingActions = 0;
  const shimInput = {
    axis: () => input.axis(), sprint: () => input.sprint(), handbrake: () => input.handbrake(),
    mouse: input.mouse, takeActions: () => { const a = pendingActions; pendingActions = 0; return a; },
  };

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleScreenActions();
    if (game.screen === SCREEN_PLAY) {
      while (accumulator >= STEP) { stepGame(game, shimInput, STEP); accumulator -= STEP; if (game.screen !== SCREEN_PLAY) { accumulator = 0; break; } }
    } else if (game.screen === SCREEN_TITLE) {
      // Idle city backdrop behind the title: traffic and peds keep moving.
      while (accumulator >= STEP) {
        game.time += STEP;
        for (const car of game.cars) if (car.traffic) trafficStep(car, STEP, game.rng, game.cars);
        for (const ped of game.peds) pedStep(ped, STEP, game.rng, null);
        game.cam.x = game.city.places.tower.x + Math.cos(game.time * 0.05) * 260;
        game.cam.y = game.city.places.tower.y + Math.sin(game.time * 0.04) * 200;
        game.cam.zoom = 0.85;
        accumulator -= STEP;
      }
    } else accumulator = 0;
    if (game.player.cash > best) { best = game.player.cash; storeBest(best); }
    game.best = best;
    game.hasSave = hasSave;
    renderer.draw(game);
  }
  announce(game, 'Palmera Heat. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) {
  const game = createGame(seed);
  const renderer = createRenderer(canvas);
  stageShot(game, shot, (g, dt) => stepGame(g, null, dt));
  let painted = 0;
  function paint() {
    renderer.draw(game);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
} else runGame();
