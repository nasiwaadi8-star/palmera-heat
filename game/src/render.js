// render.js — everything Palmera Heat draws: the tiled city (roads with
// lane dashes, beaches with animated water, pastel buildings lifted into
// fake 3D), palms and lamps, cars, people, the mission light beam, particles
// and skid marks, plus the minimap. Pure canvas, no images.

import { PALETTE, TILE, WORLD_H, WORLD_PX_H, WORLD_PX_W, WORLD_W } from './config.js';
import { tileHash } from './random.js';
import { T } from './world.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.mapBase = null;
    this.vignette = null;
  }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    const grad = this.ctx.createRadialGradient(
      this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.45,
      this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(20,10,0,0.20)');
    this.vignette = grad;
  }

  draw(game) {
    const { ctx } = this;
    const cam = game.cam;
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    const view = {
      x0: cam.x - this.w / 2 / cam.zoom - 40,
      y0: cam.y - this.h / 2 / cam.zoom - 40,
      x1: cam.x + this.w / 2 / cam.zoom + 40,
      y1: cam.y + this.h / 2 / cam.zoom + 40,
    };
    this.drawGround(game, view);
    this.drawMarker(game);
    this.drawSkids(game);
    this.drawProps(game, view);
    this.drawBuildings(game, view);
    for (const car of game.cars) this.drawCar(game, car);
    for (const ped of game.peds) this.drawPed(ped);
    if (game.player.mode === 'foot') this.drawPlayer(game);
    this.drawParticles(game);

    ctx.restore();
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  drawGround(game, view) {
    const { ctx } = this;
    const world = game.world;
    const tx0 = Math.max(0, Math.floor(view.x0 / TILE));
    const ty0 = Math.max(0, Math.floor(view.y0 / TILE));
    const tx1 = Math.min(WORLD_W - 1, Math.floor(view.x1 / TILE));
    const ty1 = Math.min(WORLD_H - 1, Math.floor(view.y1 / TILE));
    const wave = Math.floor(game.time * 1.4);

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = world.tileAt(tx, ty);
        const x = tx * TILE;
        const y = ty * TILE;
        switch (t) {
          case T.WATER: {
            ctx.fillStyle = tileHash(tx, ty, 3) > 0.5 ? PALETTE.water : '#1a739e';
            ctx.fillRect(x, y, TILE, TILE);
            if (tileHash(tx, ty, wave) > 0.9) {
              ctx.fillStyle = PALETTE.waterLight;
              ctx.fillRect(x + 5, y + 14, 20, 3);
            }
            break;
          }
          case T.SAND:
            ctx.fillStyle = tileHash(tx, ty, 1) > 0.5 ? PALETTE.sand : PALETTE.sandDark;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = 'rgba(160,128,72,0.5)';
            ctx.fillRect(x + tileHash(tx, ty, 5) * 24, y + tileHash(tx, ty, 6) * 24, 3, 3);
            break;
          case T.GRASS:
            ctx.fillStyle = tileHash(tx, ty, 2) > 0.5 ? PALETTE.grass : '#64a84e';
            ctx.fillRect(x, y, TILE, TILE);
            break;
          case T.PARK:
            ctx.fillStyle = tileHash(tx, ty, 2) > 0.5 ? PALETTE.park : '#4f9440';
            ctx.fillRect(x, y, TILE, TILE);
            break;
          case T.ROAD: {
            ctx.fillStyle = PALETTE.road;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = PALETTE.lane;
            const up = world.tileAt(tx, ty - 1) === T.ROAD;
            const down = world.tileAt(tx, ty + 1) === T.ROAD;
            const left = world.tileAt(tx - 1, ty) === T.ROAD;
            const right = world.tileAt(tx + 1, ty) === T.ROAD;
            // Lane dashes down the middle column/row of each 3-wide road.
            if (up && down && !left && !right && tx % 3 === 2 && ty % 2 === 0) {
              ctx.fillRect(x + 14, y + 3, 4, 12);
            }
            if (left && right && !up && !down && ty % 3 === 2 && tx % 2 === 0) {
              ctx.fillRect(x + 3, y + 14, 12, 4);
            }
            break;
          }
          case T.SIDEWALK:
            ctx.fillStyle = PALETTE.sidewalk;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.strokeStyle = PALETTE.sidewalkEdge;
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
            break;
          case T.LOT:
            ctx.fillStyle = PALETTE.lot;
            ctx.fillRect(x, y, TILE, TILE);
            if (tx % 2 === 0) {
              ctx.fillStyle = 'rgba(255,255,255,0.35)';
              ctx.fillRect(x + 15, y + 2, 2, TILE - 4);
            }
            break;
          case T.PIER:
            ctx.fillStyle = PALETTE.pier;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = 'rgba(70,50,28,0.55)';
            ctx.fillRect(x, y + 10, TILE, 2);
            ctx.fillRect(x, y + 22, TILE, 2);
            break;
          case T.BUILDING:
            ctx.fillStyle = '#a89e88'; // plaza concrete under the buildings
            ctx.fillRect(x, y, TILE, TILE);
            break;
          default:
            ctx.fillStyle = PALETTE.grass;
            ctx.fillRect(x, y, TILE, TILE);
        }
      }
    }
  }

  drawMarker(game) {
    const marker = game.missions ? game.missions.marker() : null;
    if (!marker || game.state !== 'play') return;
    const { ctx } = this;
    const pulse = 0.65 + Math.sin(game.time * 5) * 0.35;
    const grad = ctx.createLinearGradient(0, marker.y - 300, 0, marker.y);
    grad.addColorStop(0, 'rgba(255,217,77,0)');
    grad.addColorStop(1, `rgba(255,217,77,${0.34 * pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(marker.x - 13, marker.y - 300, 26, 300);
    ctx.strokeStyle = `rgba(255,217,77,${0.85 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 20 + Math.sin(game.time * 5) * 4, 0, Math.PI * 2);
    ctx.stroke();
    const bob = Math.sin(game.time * 4) * 5;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(marker.x, marker.y - 34 + bob);
    ctx.lineTo(marker.x - 10, marker.y - 50 + bob);
    ctx.lineTo(marker.x + 10, marker.y - 50 + bob);
    ctx.closePath();
    ctx.fill();
  }

  drawSkids(game) {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(20,20,20,1)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const s of game.skids) {
      ctx.globalAlpha = s.alpha * 0.4;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawProps(game, view) {
    const { ctx } = this;
    for (const p of game.world.props) {
      if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
      if (p.kind === 'palm') {
        ctx.strokeStyle = PALETTE.palmTrunk;
        ctx.lineWidth = 4 * p.s;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 3, p.y - 6);
        ctx.stroke();
        ctx.strokeStyle = PALETTE.palmLeaf;
        ctx.lineWidth = 3 * p.s;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + p.x * 0.01;
          ctx.beginPath();
          ctx.moveTo(p.x + 3, p.y - 6);
          ctx.quadraticCurveTo(
            p.x + 3 + Math.cos(a) * 11 * p.s, p.y - 12 * p.s,
            p.x + 3 + Math.cos(a) * 17 * p.s, p.y - 3 * p.s,
          );
          ctx.stroke();
        }
      } else if (p.kind === 'lamp') {
        ctx.fillStyle = '#5a6068';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'bench') {
        ctx.fillStyle = '#8a6a45';
        ctx.fillRect(p.x - 9, p.y - 3, 18, 6);
      } else if (p.kind === 'umbrella') {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.beginPath();
        ctx.ellipse(p.x + 3, p.y + 4, 13 * p.s, 9 * p.s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ['#ff6b57', '#ffd94d', '#37e0c8'][Math.floor(tileHash(p.x, p.y, 7) * 3)];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12 * p.s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.4 * p.s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawBuildings(game, view) {
    const { ctx } = this;
    for (const b of game.world.buildings) {
      if (b.x + b.w < view.x0 || b.x > view.x1 || b.y + b.h < view.y0 || b.y > view.y1) continue;
      const lift = 6 + b.floors * 6;
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      ctx.fillStyle = shade(b.color, -34);
      ctx.fillRect(b.x, b.y - lift, b.w, b.h + lift);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 3, b.y - lift + 3, b.w - 6, b.h - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(b.x + 3, b.y - lift + 3, b.w - 6, 3);
      // Roof clutter: an AC box or two, placed by the building's own hash.
      const h1 = tileHash(Math.floor(b.x / TILE), Math.floor(b.y / TILE), 9);
      ctx.fillStyle = 'rgba(60,60,66,0.6)';
      if (b.w > 130) ctx.fillRect(b.x + 14 + h1 * 40, b.y - lift + 12, 20, 14);
      if (b.h > 130) ctx.fillRect(b.x + b.w - 38, b.y - lift + 30 + h1 * 30, 16, 12);
    }
  }

  drawCar(game, car) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const L = car.length;
    const W = car.width;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(ctx, -L / 2 + 3, -W / 2 + 5, L, W, 7);
    ctx.fill();
    // Wheels (front pair turns with the steering).
    ctx.fillStyle = '#15181c';
    const wy = W / 2 - 1;
    for (const [wx, front] of [[L / 2 - 11, true], [-L / 2 + 11, false]]) {
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(wx, s * wy);
        if (front) ctx.rotate(car.steerVis * 0.42);
        ctx.fillRect(-5, -2.5, 10, 5);
        ctx.restore();
      }
    }
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -L / 2, -W / 2, L, W, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (car.type === 'police') {
      ctx.fillStyle = '#20242a';
      ctx.fillRect(-L * 0.08, -W / 2, L * 0.3, W);
      const flash = Math.floor(game.time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#5a0f0c';
      ctx.fillRect(-4, -W / 2 + 3, 8, 6);
      ctx.fillStyle = flash ? '#0f2a5a' : '#2e7bff';
      ctx.fillRect(-4, W / 2 - 9, 8, 6);
    }
    if (car.type === 'taxi') {
      ctx.fillStyle = '#fff6d8';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = '#20242a';
      ctx.fillRect(-5, -1, 10, 2);
    }
    if (car.type === 'sport') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(-L / 2 + 1, -W / 2 + 2, 5, W - 4); // rear spoiler
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(-L / 2 + 8, -2, L - 16, 4); // racing stripe
    }
    // Cabin glass.
    ctx.fillStyle = 'rgba(18,32,42,0.88)';
    roundRect(ctx, -L * 0.14, -W * 0.36, L * 0.34, W * 0.72, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,220,255,0.35)';
    ctx.fillRect(L * 0.13, -W * 0.36, 3, W * 0.72); // windshield shine
    // Headlights, and tail lights that flare under braking.
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(L / 2 - 2, -W / 2 + 3, 3, 5);
    ctx.fillRect(L / 2 - 2, W / 2 - 8, 3, 5);
    ctx.fillStyle = car.braking ? '#ff2d20' : 'rgba(200,40,32,0.55)';
    ctx.fillRect(-L / 2 - 1, -W / 2 + 3, 3, 5);
    ctx.fillRect(-L / 2 - 1, W / 2 - 8, 3, 5);
    ctx.restore();

    if (car.hp < 45) {
      ctx.fillStyle = `rgba(90,90,90,${0.35 + Math.sin(game.time * 9 + car.x) * 0.12})`;
      ctx.beginPath();
      ctx.arc(car.x + Math.cos(car.angle) * L * 0.4, car.y + Math.sin(car.angle) * L * 0.4, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPed(ped) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (ped.state === 'down') {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = ped.shirt;
      roundRect(ctx, -11, -5, 22, 10, 5);
      ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath();
      ctx.arc(14, 0, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const swing = ped.speed > 4 ? Math.sin(ped.phase) * 5 : 0;
    ctx.strokeStyle = ped.pants;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ped.angle + 0.5) * swing, Math.sin(ped.angle + 0.5) * swing + 4);
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ped.angle - 0.5) * -swing, Math.sin(ped.angle - 0.5) * -swing + 4);
    ctx.stroke();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 3.4, Math.sin(ped.angle) * 3.4, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPlayer(game) {
    const p = game.player;
    const { ctx } = this;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    const swing = p.speed > 4 ? Math.sin(p.phase) * 6 : 0;
    ctx.strokeStyle = '#243447';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(p.angle + 0.5) * swing, Math.sin(p.angle + 0.5) * swing + 5);
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(p.angle - 0.5) * -swing, Math.sin(p.angle - 0.5) * -swing + 5);
    ctx.stroke();
    if (p.punchTimer > 0) {
      ctx.strokeStyle = PALETTE.playerSkin;
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(p.angle) * 17, Math.sin(p.angle) * 17);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.playerShirt;
    ctx.beginPath();
    ctx.arc(0, 0, 8.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = PALETTE.playerSkin;
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawParticles(game) {
    const { ctx } = this;
    for (const pt of game.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** The minimap: a pre-rendered city plan plus live blips. */
  drawMinimap(mmCtx, game) {
    if (!this.mapBase) this.buildMapBase(game.world);
    mmCtx.drawImage(this.mapBase, 0, 0);
    const sx = 192 / WORLD_PX_W;
    const sy = 144 / WORLD_PX_H;
    const dot = (x, y, r, color) => {
      mmCtx.fillStyle = color;
      mmCtx.beginPath();
      mmCtx.arc(x * sx, y * sy, r, 0, Math.PI * 2);
      mmCtx.fill();
    };
    for (const car of game.cars) {
      if (car.type === 'police') {
        dot(car.x, car.y, 3, Math.floor(game.time * 6) % 2 ? '#ff3b30' : '#2e7bff');
      } else if (car.driver === 'traffic') {
        dot(car.x, car.y, 1.6, 'rgba(230,230,230,0.8)');
      }
    }
    const marker = game.missions ? game.missions.marker() : null;
    if (marker) {
      const r = 3.6 + Math.sin(game.time * 5) * 1.1;
      dot(marker.x, marker.y, r, '#ffd94d');
    }
    const p = game.player;
    dot(p.x, p.y, 3.4, '#ffffff');
    mmCtx.strokeStyle = '#ffffff';
    mmCtx.lineWidth = 1.6;
    mmCtx.beginPath();
    mmCtx.moveTo(p.x * sx, p.y * sy);
    mmCtx.lineTo((p.x + Math.cos(p.angle) * 130) * sx, (p.y + Math.sin(p.angle) * 130) * sy);
    mmCtx.stroke();
  }

  buildMapBase(world) {
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 144;
    const g = c.getContext('2d');
    const sx = 192 / WORLD_W;
    const sy = 144 / WORLD_H;
    g.fillStyle = PALETTE.water;
    g.fillRect(0, 0, 192, 144);
    for (let ty = 0; ty < WORLD_H; ty++) {
      for (let tx = 0; tx < WORLD_W; tx++) {
        const t = world.tileAt(tx, ty);
        if (t === T.WATER) continue;
        g.fillStyle = t === T.ROAD || t === T.LOT ? '#565d66'
          : t === T.SAND || t === T.PIER ? PALETTE.sand
            : t === T.BUILDING ? '#7a7264'
              : t === T.PARK ? PALETTE.park
                : PALETTE.grass;
        g.fillRect(tx * sx, ty * sy, sx + 0.6, sy + 0.6);
      }
    }
    this.mapBase = c;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Lighten (positive amt) or darken a #rrggbb colour. */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}
