// Drawing only: the city, cars, people, effects, the HUD with its minimap, and the
// menu panels for each screen. Warm sunset palette, long building shadows, a beach
// and the sea — Vista Palmera at golden hour, every frame.
import { CELL, CITY_H, CITY_W, FONT, PALETTE, ROAD, SEA_X, WANTED_MAX, WORLD_H, WORLD_W } from './config.js';
import { roadCenterX, roadCenterY } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_ENDING = 'ending';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 1280; let H = 800;
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * ratio); canvas.height = Math.round(H * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function text(value, x, y, size, color, align = 'left', weight = 600) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawWorld(game) {
    const cam = game.cam;
    const vw = W / cam.zoom; const vh = H / cam.zoom;
    const x0 = cam.x - vw / 2 - 60; const y0 = cam.y - vh / 2 - 60;
    const x1 = cam.x + vw / 2 + 60; const y1 = cam.y + vh / 2 + 60;
    // Base: grass, then sand and sea in the east.
    ctx.fillStyle = PALETTE.grass; ctx.fillRect(x0, y0, vw + 120, vh + 120);
    ctx.fillStyle = PALETTE.sand; ctx.fillRect(SEA_X, y0, 150, vh + 120);
    const grad = ctx.createLinearGradient(SEA_X + 130, 0, WORLD_W, 0);
    grad.addColorStop(0, PALETTE.water); grad.addColorStop(1, PALETTE.waterDeep);
    ctx.fillStyle = grad; ctx.fillRect(SEA_X + 130, y0, WORLD_W - SEA_X, vh + 120);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let y = 40; y < WORLD_H; y += 130) ctx.fillRect(SEA_X + 180 + ((y * 7) % 120), y, 60, 4);
    // Roads
    ctx.fillStyle = PALETTE.asphalt;
    for (let i = 0; i <= 10; i += 1) ctx.fillRect(i * CELL, 0, ROAD, CITY_H);
    for (let j = 0; j <= 8; j += 1) ctx.fillRect(0, j * CELL, CITY_W, ROAD);
    ctx.fillRect(CITY_W, 0, SEA_X - CITY_W + 40, CITY_H); // coastal avenue
    ctx.strokeStyle = PALETTE.lane; ctx.lineWidth = 3; ctx.setLineDash([22, 18]);
    ctx.beginPath();
    for (let i = 0; i <= 10; i += 1) { ctx.moveTo(roadCenterX(i), 0); ctx.lineTo(roadCenterX(i), CITY_H); }
    for (let j = 0; j <= 8; j += 1) { ctx.moveTo(0, roadCenterY(j)); ctx.lineTo(CITY_W, roadCenterY(j)); }
    ctx.stroke(); ctx.setLineDash([]);
    // Parks and lots
    for (const park of game.city.parks) {
      ctx.fillStyle = PALETTE.grassDark; ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = '#5d8a43';
      for (let i = 0; i < 5; i += 1) { ctx.beginPath(); ctx.arc(park.x + 30 + ((i * 53) % 160), park.y + 30 + ((i * 71) % 160), 16, 0, 7); ctx.fill(); }
    }
    for (const lot of game.city.lots) { ctx.fillStyle = '#9a917e'; ctx.fillRect(lot.x, lot.y, lot.w, lot.h); }
    // Sidewalk blocks base
    ctx.fillStyle = PALETTE.sidewalk;
    for (let cx = 0; cx < 10; cx += 1) for (let cy = 0; cy < 8; cy += 1) ctx.fillRect(cx * CELL + ROAD - 6, cy * CELL + ROAD - 6, 216 + 12, 216 + 12);
    for (const park of game.city.parks) { ctx.fillStyle = PALETTE.grassDark; ctx.fillRect(park.x - 4, park.y - 4, park.w + 8, park.h + 8); }
    for (const lot of game.city.lots) { ctx.fillStyle = '#9a917e'; ctx.fillRect(lot.x - 4, lot.y - 4, lot.w + 8, lot.h + 8); }
    // Buildings with sunset shadows
    for (const b of game.city.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      ctx.fillStyle = PALETTE.roofShadow; ctx.fillRect(b.x + b.tall * 0.35, b.y + b.tall * 0.22, b.w, b.h);
      ctx.fillStyle = b.wall; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof; ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      ctx.fillStyle = 'rgba(90,70,50,0.35)';
      ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.3, b.w * 0.4, b.h * 0.4);
      if (b.name) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 4); }
    }
    // Palms
    for (const palm of game.city.palms) {
      if (palm.x < x0 || palm.x > x1 || palm.y < y0 || palm.y > y1) continue;
      ctx.strokeStyle = '#7a5c3e'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.lineTo(palm.x + 4, palm.y - 10); ctx.stroke();
      ctx.fillStyle = '#3e8914';
      for (let i = 0; i < 5; i += 1) { const a = (i / 5) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(palm.x + 4 + Math.cos(a) * 9, palm.y - 12 + Math.sin(a) * 5, 10, 4, a, 0, 7); ctx.fill(); }
    }
    // Stashes
    for (const s of game.city.stashes) {
      if (s.taken) continue;
      ctx.fillStyle = '#212121'; ctx.fillRect(s.x - 8, s.y - 6, 16, 12);
      ctx.fillStyle = PALETTE.gold; ctx.fillRect(s.x - 8, s.y - 2, 16, 3);
    }
    // Place labels
    ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center';
    for (const key of Object.keys(game.city.places)) {
      const place = game.city.places[key];
      if (place.x < x0 || place.x > x1 || place.y < y0 || place.y > y1) continue;
      ctx.fillStyle = 'rgba(20,24,30,0.55)';
      const w = ctx.measureText(place.name).width + 14;
      ctx.fillRect(place.x - w / 2, place.y - 34, w, 20);
      ctx.fillStyle = '#ffe9a8'; ctx.fillText(place.name, place.x, place.y - 20);
    }
    // Mission marker: a golden beacon
    const target = game.missions.target();
    if (target && game.screen === SCREEN_PLAY) {
      const pulse = 6 + Math.sin(game.time * 5) * 2;
      ctx.fillStyle = 'rgba(255,200,69,0.20)';
      ctx.fillRect(target.x - 10, target.y - 320, 20, 320);
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath(); ctx.arc(target.x, target.y, 20 + pulse, 0, 7); ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(target.x, target.y, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#1d2126'; ctx.font = `900 15px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('!', target.x, target.y + 5);
    }
  }

  function drawCar(car, game) {
    ctx.save();
    ctx.translate(car.x, car.y); ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(30,25,18,0.3)'; roundRect(-22 + 3, -12 + 4, 46, 25, 7); ctx.fill();
    ctx.fillStyle = car.hp < 40 ? '#555' : car.color; roundRect(-23, -13, 46, 26, 7); ctx.fill();
    if (car.police) { ctx.fillStyle = '#263238'; ctx.fillRect(-4, -13, 16, 26); ctx.fillStyle = (Math.floor(game.time * 4) % 2) ? '#ef5350' : '#57a8ff'; ctx.fillRect(-1, -4, 7, 8); }
    ctx.fillStyle = '#bfe9f5'; roundRect(2, -10, 10, 20, 3); ctx.fill();
    ctx.fillStyle = '#8fc7d9'; roundRect(-16, -10, 7, 20, 3); ctx.fill();
    ctx.fillStyle = '#14181d';
    for (const [wx, wy] of [[-15, -14], [13, -14], [-15, 11], [13, 11]]) ctx.fillRect(wx, wy, 8, 4);
    if (car.mission) { ctx.fillStyle = PALETTE.gold; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill(); }
    ctx.restore();
    if (car === game.player.inCar) { /* player drawn by the car itself */ }
  }
  function drawPerson(x, y, angle, shirt, isPlayer, walkCycle, name) {
    ctx.fillStyle = 'rgba(30,25,18,0.3)';
    ctx.beginPath(); ctx.ellipse(x + 3, y + 4, 9, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2c79b';
    ctx.beginPath(); ctx.arc(x + Math.cos(angle) * 3, y + Math.sin(angle) * 3, 5, 0, 7); ctx.fill();
    if (isPlayer) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 13 + Math.sin(walkCycle) * 1, 0, 7); ctx.stroke(); }
    if (name) { ctx.fillStyle = '#37474f'; ctx.font = `700 9px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(name, x, y - 14); }
  }

  function drawEntities(game) {
    for (const car of game.cars) if (!car.dead) drawCar(car, game);
    for (const cop of game.cops) if (!cop.dead) drawCar(cop, game);
    for (const ped of game.peds) if (!ped.dead && !ped.inCar) drawPerson(ped.x, ped.y, ped.angle, ped.shirt, false, 0, ped.hail ? '!' : '');
    for (const h of game.hostiles) if (!h.dead) drawPerson(h.x, h.y, h.angle, h.shirt, false, 0, 'Lookout');
    const p = game.player;
    if (!p.inCar) drawPerson(p.x, p.y, p.angle, '#ff5964', true, p.walkCycle, '');
    // Tracers, particles, floats
    ctx.strokeStyle = 'rgba(255,240,170,0.9)'; ctx.lineWidth = 2;
    for (const t of game.tracers) { ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke(); }
    for (const pt of game.particles) { ctx.fillStyle = pt.color; ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size); }
    ctx.font = `800 15px ${FONT}`; ctx.textAlign = 'center';
    for (const f of game.floats) { ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
  }

  function drawMinimap(game) {
    const mw = 208; const mh = 156; const mx = W - mw - 16; const my = H - mh - 16;
    const sx = mw / WORLD_W; const sy = mh / 2360;
    ctx.fillStyle = 'rgba(14,20,26,0.82)'; roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
    ctx.fillStyle = '#5d8a4a'; ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = PALETTE.water; ctx.fillRect(mx + SEA_X * sx, my, mw, mh);
    ctx.strokeStyle = '#d8d2c0'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 10; i += 1) { ctx.moveTo(mx + roadCenterX(i) * sx, my); ctx.lineTo(mx + roadCenterX(i) * sx, my + mh); }
    for (let j = 0; j <= 8; j += 1) { ctx.moveTo(mx, my + roadCenterY(j) * sy); ctx.lineTo(mx + mw, my + roadCenterY(j) * sy); }
    ctx.stroke();
    const dot = (x, y, color, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(mx + x * sx, my + y * sy, r, 0, 7); ctx.fill(); };
    for (const cop of game.cops) dot(cop.x, cop.y, (Math.floor(game.time * 4) % 2) ? '#ef5350' : '#57a8ff', 3);
    const target = game.missions.target();
    if (target) dot(target.x, target.y, PALETTE.gold, 4.5);
    const p = game.player;
    ctx.save(); ctx.translate(mx + p.x * sx, my + p.y * sy); ctx.rotate(p.angle);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4.5); ctx.lineTo(-5, 4.5); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.stroke();
  }

  function drawHud(game) {
    const p = game.player;
    // Health + cash, top-left
    ctx.fillStyle = 'rgba(14,20,26,0.72)'; roundRect(14, 12, 252, 62, 8); ctx.fill();
    ctx.fillStyle = '#3a4149'; roundRect(24, 22, 170, 13, 6); ctx.fill();
    ctx.fillStyle = p.hp > 30 ? PALETTE.green : PALETTE.red; roundRect(24, 22, 170 * Math.max(0, p.hp) / 100, 13, 6); ctx.fill();
    text('RAFI SOLANO', 24, 56, 13, '#ffe9a8');
    text(`$${p.cash}`, 258, 58, 24, PALETTE.gold, 'right', 800);
    // Wanted stars, top-right
    let stars = '';
    for (let i = 0; i < WANTED_MAX; i += 1) stars += i < game.wanted.stars ? '★' : '☆';
    ctx.font = `900 30px ${FONT}`; ctx.textAlign = 'right';
    ctx.fillStyle = game.wanted.stars ? '#ffd54f' : 'rgba(255,255,255,0.35)';
    ctx.fillText(stars, W - 18, 44);
    if (game.wanted.stars) text('PALMERA POLICE', W - 18, 66, 11, '#ffcdd2', 'right', 700);
    // Objective panel
    const M = game.missions;
    const title = M.storyDone ? 'FREE ROAM' : (M.phase === 'offer' ? `Next job: ${M.current.title}` : M.current.title);
    const objective = M.objectiveText();
    ctx.fillStyle = 'rgba(14,20,26,0.72)'; roundRect(14, 84, 430, 58, 8); ctx.fill();
    text(title.toUpperCase(), 24, 106, 13, PALETTE.gold);
    ctx.font = `600 14px ${FONT}`; ctx.fillStyle = '#fdf6e3'; ctx.textAlign = 'left';
    const shown = objective.length > 58 ? `${objective.slice(0, 57)}…` : objective;
    ctx.fillText(shown, 24, 130);
    const target = M.target();
    if (target) text(`${Math.round(Math.hypot(p.x - target.x, p.y - target.y))} m`, 434, 130, 13, '#ffe9a8', 'right', 700);
    if (M.step && M.step.type === 'checkpoints') text(`⏱ ${Math.ceil(M.checkpointTimer)}s — checkpoint ${M.checkpointIndex + 1}/5`, 24, 162, 15, '#ffd54f');
    // Speed / prompts / bust meter
    if (p.inCar) text(`${Math.abs(Math.round(p.inCar.speed * 0.36))} km/h`, 18, H - 18, 26, '#fff', 'left', 800);
    if (p.bust > 0.03) {
      ctx.fillStyle = 'rgba(14,20,26,0.8)'; roundRect(W / 2 - 130, 84, 260, 30, 8); ctx.fill();
      ctx.fillStyle = PALETTE.red; roundRect(W / 2 - 122, 92, 244 * Math.min(1, p.bust), 14, 6); ctx.fill();
      text('BUSTED?', W / 2, 76, 18, '#ffcdd2', 'center', 900);
    }
    let prompt = '';
    if (!p.inCar) {
      let nearCar = false;
      for (const car of game.cars) if (!car.dead && Math.hypot(car.x - p.x, car.y - p.y) < 52) nearCar = true;
      const hosp = game.city.places.hospital;
      if (nearCar) prompt = 'E — Get in the car';
      else if (Math.hypot(p.x - hosp.x, p.y - hosp.y) < 56 && p.hp < 100) prompt = 'E — Heal at St. Serena ($40)';
      else prompt = 'WASD move · Shift sprint · Mouse aim, click shoot · F punch · E enter car';
    } else prompt = 'WASD drive · Space handbrake · E get out · K save';
    text(prompt, W / 2, H - 16, 14, 'rgba(255,255,255,0.85)', 'center', 600);
    // Dialog subtitle
    const line = game.dialog[0];
    if (line && game.dialogTimer > 0) {
      ctx.fillStyle = 'rgba(10,12,16,0.85)';
      const w = Math.min(W - 120, 760);
      roundRect((W - w) / 2, H - 108, w, 52, 8); ctx.fill();
      text(`${line.who}:`, (W - w) / 2 + 16, H - 84, 14, PALETTE.gold);
      ctx.font = `600 15px ${FONT}`; ctx.fillStyle = '#fdf6e3'; ctx.textAlign = 'left';
      const words = line.line.length > 78 ? `${line.line.slice(0, 77)}…` : line.line;
      ctx.fillText(words, (W - w) / 2 + 16, H - 62);
    }
    if (game.toastTimer > 0 && game.toast) {
      ctx.font = `800 19px ${FONT}`; ctx.textAlign = 'center';
      const w = ctx.measureText(game.toast).width + 36;
      ctx.fillStyle = 'rgba(10,12,16,0.85)'; roundRect((W - w) / 2, 120, w, 38, 8); ctx.fill();
      ctx.fillStyle = '#ffe9a8'; ctx.fillText(game.toast, W / 2, 147);
    }
    drawMinimap(game);
  }

  function panel(title, subtitle, lines, prompt, accent = PALETTE.gold) {
    ctx.fillStyle = 'rgba(12,16,22,0.62)'; ctx.fillRect(0, 0, W, H);
    const w = 680; const h = 150 + lines.length * 27 + 70;
    const x = (W - w) / 2; const y = (H - h) / 2;
    ctx.fillStyle = PALETTE.panel; roundRect(x, y, w, h, 14); ctx.fill();
    ctx.fillStyle = accent; ctx.fillRect(x, y, w, 6);
    text(title, W / 2, y + 72, 46, '#fff', 'center', 900);
    if (subtitle) text(subtitle, W / 2, y + 100, 16, '#ffe9a8', 'center', 600);
    lines.forEach((line, i) => text(line, W / 2, y + 140 + i * 27, 15.5, '#d7dde6', 'center', 500));
    text(prompt, W / 2, y + h - 26, 17, accent, 'center', 800);
  }

  function draw(game) {
    ctx.fillStyle = '#17303e'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(game.cam.zoom, game.cam.zoom); ctx.translate(-game.cam.x, -game.cam.y);
    drawWorld(game);
    drawEntities(game);
    ctx.restore();
    // Golden-hour vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, 'rgba(255,170,60,0.05)'); v.addColorStop(1, 'rgba(30,10,40,0.28)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

    if (game.screen === SCREEN_TITLE) {
      panel('PALMERA HEAT', 'An open-world crime story in Vista Palmera', [
        'Rafi Solano owes the Serpientes a fortune. He has one week, one city,',
        'and the fastest hands on the bay to drive his way out of debt.',
        '',
        'Explore on foot and by car · Steal cars · Run missions',
        'Outrun the police · Fight · Save your story',
        'WASD move/drive · E enter car · Mouse aim + click to shoot · F punch',
        'Shift sprint · Space handbrake · P pause · K save · M mute',
        game.hasSave ? 'A save game is waiting for you.' : 'No save yet — your story starts fresh.',
      ], game.hasSave ? 'Press ENTER — continue your story' : 'Press ENTER — start the story');
      return;
    }
    drawHud(game);
    if (game.screen === SCREEN_PAUSED) panel('PAUSED', 'Vista Palmera waits for no one. Almost.', ['Your progress is saved at every mission.', 'Press K in game to save at any time.'], 'Press P or ENTER — back to the streets');
    else if (game.screen === SCREEN_BUSTED) panel('BUSTED', 'The Palmera Police got their driver.', ['You wake up at the garage, $150 lighter,', 'and the streets have forgotten your face. For now.'], 'Press ENTER — pay the fine and walk free', PALETTE.blue);
    else if (game.screen === SCREEN_OVER) panel('WASTED', 'St. Serena did everything they could.', ['You lose 10% of your cash to the hospital bill,', 'but Vista Palmera still needs its wheelman.'], 'Press ENTER — leave the hospital', PALETTE.red);
    else if (game.screen === SCREEN_ENDING) panel('DEBT PAID', 'Palmera Heat — story complete', ['Marisol sails at dawn. Lina keeps the garage. Bruno keeps the secrets.', 'Rafi Solano keeps Vista Palmera.', '', `Total earned on the streets: $${game.stats.earned}`], 'Press ENTER — free roam, the city is yours', PALETTE.green);
  }

  return { draw };
}
