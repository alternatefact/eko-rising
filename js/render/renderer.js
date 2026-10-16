// Draws the world: cached terrain chunks, then everything that moves, then
// fog of war and overlays. The camera works in tile units.

import { TILE, T, F, isWater } from '../world/terrain.js';
import { hash2 } from '../core/rng.js';
import { GROUND, PLAYER, ENEMY } from './palette.js';
import { drawBuilding, drawVillage, drawPerson, drawSoldier, drawAnimal, drawShip, drawPoi, drawProjectile } from './sprites.js';
import { BUILDINGS } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { season } from '../sim/economy.js';
import { isHostileOwner } from '../sim/military.js';

if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const rr = Math.min(typeof r === 'number' ? r : 0, w / 2, h / 2);
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
  };
}

const CHUNK = 16;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, zoom: 1.3 };
    this.chunks = new Map();
    this.fogCanvas = null;
    this.fogVersion = -1;
    this.borderVersion = -1;
    this.borders = [];
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
  }

  attach(st) {
    this.st = st;
    this.chunks.clear();
    this.fogVersion = -1;
    this.borderVersion = -1;
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = st.W;
    this.fogCanvas.height = st.H;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr;
    this.w = w;
    this.h = h;
  }

  get scale() {
    return TILE * this.cam.zoom;
  }

  clampCam() {
    const st = this.st;
    const s = this.scale;
    const halfW = this.w / 2 / s;
    const halfH = this.h / 2 / s;
    this.cam.x = Math.max(Math.min(halfW, st.W / 2), Math.min(st.W - Math.min(halfW, st.W / 2), this.cam.x));
    this.cam.y = Math.max(Math.min(halfH, st.H / 2), Math.min(st.H - Math.min(halfH, st.H / 2), this.cam.y));
  }

  screenToTile(sx, sy) {
    const s = this.scale;
    return { x: this.cam.x + (sx - this.w / 2) / s, y: this.cam.y + (sy - this.h / 2) / s };
  }

  tileToScreen(tx, ty) {
    const s = this.scale;
    return { x: (tx - this.cam.x) * s + this.w / 2, y: (ty - this.cam.y) * s + this.h / 2 };
  }

  centerOn(x, y) {
    this.cam.x = x;
    this.cam.y = y;
    this.clampCam();
  }

  zoomAt(factor, sx, sy) {
    const before = this.screenToTile(sx, sy);
    this.cam.zoom = Math.max(0.45, Math.min(2.6, this.cam.zoom * factor));
    const after = this.screenToTile(sx, sy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.clampCam();
  }

  // --- Terrain chunks ------------------------------------------------------

  invalidateTiles(list) {
    for (const i of list) {
      const x = i % this.st.W;
      const y = Math.floor(i / this.st.W);
      // A tree's canopy spills into the neighbouring chunk, so redraw those too.
      for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const cx = Math.floor((x + dx) / CHUNK);
        const cy = Math.floor((y + dy) / CHUNK);
        this.chunks.delete(`${cx},${cy}`);
      }
    }
  }

  chunk(cx, cy) {
    const key = `${cx},${cy}`;
    let c = this.chunks.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = CHUNK * TILE;
      c.height = CHUNK * TILE;
      this.paintChunk(c.getContext('2d'), cx, cy);
      this.chunks.set(key, c);
    }
    return c;
  }

  paintChunk(g, cx, cy) {
    const st = this.st;
    const W = st.W;
    const H = st.H;
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    const seed = st.seed;
    const tiles = [];
    for (let y = y0 - 1; y <= y0 + CHUNK; y++) {
      for (let x = x0 - 1; x <= x0 + CHUNK; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        tiles.push([x, y, y * W + x]);
      }
    }
    const px = (x) => (x - x0) * TILE;
    const py = (y) => (y - y0) * TILE;

    // Base colour.
    for (const [x, y, i] of tiles) {
      const pal = GROUND[st.terrain[i]];
      g.fillStyle = pal[0];
      g.fillRect(px(x), py(y), TILE, TILE);
    }
    // Soft blotches that break up the grid.
    for (const [x, y, i] of tiles) {
      const t = st.terrain[i];
      const pal = GROUND[t];
      for (let k = 0; k < 4; k++) {
        const hx = hash2(x * 4 + k, y, seed + 31);
        const hy = hash2(x, y * 4 + k, seed + 37);
        const r = 6 + hash2(x + k, y - k, seed + 41) * 10;
        g.fillStyle = pal[1 + (k % 2)];
        g.globalAlpha = isWater(t) ? 0.35 : 0.55;
        g.beginPath();
        g.arc(px(x) + hx * TILE, py(y) + hy * TILE, r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      // Tufts and specks.
      if (t === T.GRASS || t === T.SAVANNA) {
        g.strokeStyle = t === T.GRASS ? 'rgba(60,100,30,0.55)' : 'rgba(140,120,50,0.7)';
        g.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const gx = px(x) + hash2(x, y + k * 7, seed + 51) * TILE;
          const gy = py(y) + hash2(x + k * 7, y, seed + 53) * TILE;
          g.beginPath();
          g.moveTo(gx, gy);
          g.lineTo(gx - 1.5, gy - 4);
          g.moveTo(gx + 1.5, gy);
          g.lineTo(gx + 2.5, gy - 4);
          g.stroke();
        }
      } else if (t === T.SAND) {
        g.fillStyle = 'rgba(160,130,80,0.35)';
        for (let k = 0; k < 4; k++) g.fillRect(px(x) + hash2(x, y + k, seed + 61) * TILE, py(y) + hash2(x + k, y, seed + 63) * TILE, 1.5, 1.5);
      } else if (t === T.HILL) {
        g.fillStyle = 'rgba(110,90,70,0.35)';
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.arc(px(x) + hash2(x, y + k, seed + 71) * TILE, py(y) + hash2(x + k, y, seed + 73) * TILE, 2 + k, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // Shallows and foam where water meets land.
    for (const [x, y, i] of tiles) {
      if (!isWater(st.terrain[i])) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || isWater(st.terrain[ny * W + nx])) continue;
        const gx = px(x) + (dx > 0 ? TILE - 9 : 0);
        const gy = py(y) + (dy > 0 ? TILE - 9 : 0);
        const gw = dx ? 9 : TILE;
        const gh = dy ? 9 : TILE;
        const grad = g.createLinearGradient(gx + (dx < 0 ? 9 : 0), gy + (dy < 0 ? 9 : 0), gx + (dx > 0 ? 9 : 0), gy + (dy > 0 ? 9 : 0));
        grad.addColorStop(0, 'rgba(160,220,215,0)');
        grad.addColorStop(1, 'rgba(190,235,225,0.55)');
        g.fillStyle = grad;
        g.fillRect(gx, gy, gw, gh);
      }
    }
    // Trees, palms and rocks.
    for (const [x, y, i] of tiles) {
      const t = st.terrain[i];
      const trees = st.trees[i];
      const f = st.feature[i];
      const bx = px(x);
      const by = py(y);
      if (trees > 0) {
        if (t === T.MANGROVE) drawMangrove(g, bx, by, x, y, seed);
        else if (t === T.SAVANNA) drawAcacia(g, bx, by, x, y, seed);
        else {
          const n = trees > 40 ? 3 : trees > 18 ? 2 : 1;
          for (let k = 0; k < n; k++) drawCanopy(g, bx + 6 + hash2(x + k, y, seed + 81) * 20, by + 6 + hash2(x, y + k, seed + 83) * 18, 7 + hash2(x - k, y, seed + 85) * 4, k);
        }
      }
      if (f === F.PALM) drawPalm(g, bx + 16, by + 20, st.amount[i] >= 4, hash2(x, y, seed + 91));
      else if (f === F.ROCK) drawRocks(g, bx, by, x, y, seed, '#958d82', '#b9b2a6');
      else if (f === F.IRON) drawRocks(g, bx, by, x, y, seed, '#7d4a33', '#a8694a');
    }
  }

  // --- Fog -------------------------------------------------------------------

  updateFog() {
    const st = this.st;
    if (this.fogVersion === st.visVersion) return;
    this.fogVersion = st.visVersion;
    const g = this.fogCanvas.getContext('2d');
    const img = g.createImageData(st.W, st.H);
    const d = img.data;
    for (let i = 0; i < st.W * st.H; i++) {
      d[i * 4] = 12;
      d[i * 4 + 1] = 16;
      d[i * 4 + 2] = 22;
      d[i * 4 + 3] = !st.explored[i] ? 255 : st.visible[i] ? 0 : 92;
    }
    g.putImageData(img, 0, 0);
  }

  updateBorders() {
    const st = this.st;
    if (this.borderVersion === st.territoryVersion) return;
    this.borderVersion = st.territoryVersion;
    const out = [];
    const W = st.W;
    for (let y = 0; y < st.H; y++) {
      for (let x = 0; x < W; x++) {
        const v = st.territory[y * W + x];
        if (v !== 1) continue;
        if (x + 1 >= W || st.territory[y * W + x + 1] !== 1) out.push([x + 1, y, x + 1, y + 1]);
        if (x === 0 || st.territory[y * W + x - 1] !== 1) out.push([x, y, x, y + 1]);
        if (y + 1 >= st.H || st.territory[(y + 1) * W + x] !== 1) out.push([x, y + 1, x + 1, y + 1]);
        if (y === 0 || st.territory[(y - 1) * W + x] !== 1) out.push([x, y, x + 1, y]);
      }
    }
    this.borders = out;
  }

  // --- Frame ------------------------------------------------------------------

  draw(alpha, view) {
    const st = this.st;
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    if (st.changedTiles.length) {
      this.invalidateTiles(st.changedTiles);
      st.changedTiles.length = 0;
    }
    this.updateFog();
    this.updateBorders();

    const s = this.scale;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0c1016';
    ctx.fillRect(0, 0, this.w, this.h);

    const tl = this.screenToTile(0, 0);
    const br = this.screenToTile(this.w, this.h);
    const minX = Math.max(0, Math.floor(tl.x) - 1);
    const minY = Math.max(0, Math.floor(tl.y) - 1);
    const maxX = Math.min(st.W - 1, Math.ceil(br.x) + 1);
    const maxY = Math.min(st.H - 1, Math.ceil(br.y) + 1);

    // World transform: 1 unit = 1 tile.
    const ox = this.w / 2 - this.cam.x * s;
    const oy = this.h / 2 - this.cam.y * s;
    ctx.setTransform(this.dpr * s, 0, 0, this.dpr * s, this.dpr * ox, this.dpr * oy);
    ctx.imageSmoothingEnabled = true;

    for (let cy = Math.floor(minY / CHUNK); cy <= Math.floor(maxY / CHUNK); cy++) {
      for (let cx = Math.floor(minX / CHUNK); cx <= Math.floor(maxX / CHUNK); cx++) {
        ctx.drawImage(this.chunk(cx, cy), cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
      }
    }

    // Moving glints on visible water.
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const i = y * st.W + x;
        if (!isWater(st.terrain[i]) || !st.explored[i]) continue;
        const h = hash2(x, y, 5);
        const ph = (t * 0.35 + h) % 1;
        const wx = x + 0.2 + h * 0.5 + Math.sin(t * 0.8 + h * 6) * 0.08;
        const wy = y + ph;
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + 0.28, wy);
      }
    }
    ctx.stroke();

    // Territory border.
    if (this.borders.length) {
      ctx.beginPath();
      for (const [x0, y0, x1, y1] of this.borders) {
        if (x1 < minX || x0 > maxX + 1 || y1 < minY || y0 > maxY + 1) continue;
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
      ctx.strokeStyle = 'rgba(255,236,170,0.55)';
      ctx.lineWidth = 0.07;
      ctx.setLineDash([0.25, 0.18]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (view.showTerritory) this.drawBuildOverlay(ctx, minX, minY, maxX, maxY);

    // --- Sprites, back to front ---
    const items = [];
    const inView = (x, y, pad = 3) => x > minX - pad && x < maxX + pad && y > minY - pad && y < maxY + pad;
    const seen = (x, y) => st.visible[Math.floor(y) * st.W + Math.floor(x)];

    for (const sh of st.ships) {
      const x = sh.px + (sh.x - sh.px) * alpha;
      const y = sh.py + (sh.y - sh.py) * alpha;
      if (inView(x, y, 4)) items.push({ y: y - 2, draw: () => this.sprite(ctx, x, y, () => drawShip(ctx, sh, t, st.foreign[sh.power]?.color || '#999')) });
    }
    for (const f of st.factions) {
      if (!st.explored[f.y * st.W + f.x] || !inView(f.x, f.y, 5)) continue;
      const color = f.status === 'conquered' || f.status === 'vassal' ? PLAYER : f.color;
      items.push({ y: f.y + 0.5, draw: () => this.sprite(ctx, f.x + 0.5, f.y + 0.5, () => drawVillage(ctx, f, t, color)) });
    }
    for (const b of st.buildings) {
      if (b.dead || !inView(b.x + b.w / 2, b.y + b.h / 2, b.w + 2)) continue;
      const n = b.wall || b.gate ? this.wallNeighbours(b) : null;
      items.push({
        y: b.y + b.h - (b.type === 'farm' ? 3 : 0.1),
        draw: () => {
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.scale(1 / TILE, 1 / TILE);
          drawBuilding(ctx, b, t, st, n);
          ctx.restore();
          if (b.hp < b.maxHp && b.built >= 1) this.hpBar(ctx, b.x + b.w / 2, b.y - 0.25, b.hp / b.maxHp, b.w * 0.7);
          if (b.hitT && st.time.t - b.hitT < 0.3) {
            ctx.fillStyle = 'rgba(255,120,60,0.25)';
            ctx.fillRect(b.x, b.y, b.w, b.h);
          }
        },
      });
    }
    for (const p of st.pois) {
      if (!p.found || p.claimed || !inView(p.x, p.y)) continue;
      items.push({ y: p.y + 0.5, draw: () => this.sprite(ctx, p.x + 0.5, p.y + 0.6, () => drawPoi(ctx, p, t)) });
    }
    for (const a of st.animals) {
      const x = a.px + (a.x - a.px) * alpha;
      const y = a.py + (a.y - a.py) * alpha;
      if (!inView(x, y) || !seen(x, y)) continue;
      const moving = !!a.path;
      items.push({ y, draw: () => this.sprite(ctx, x, y + 0.2, () => drawAnimal(ctx, a, t, moving)) });
    }
    for (const c of st.citizens) {
      if (c.hidden) continue;
      const x = c.px + (c.x - c.px) * alpha + c.ox;
      const y = c.py + (c.y - c.py) * alpha + c.oy;
      if (!inView(x, y) || !seen(x, y)) continue;
      const moving = !!c.path;
      const tool = c.state === 'gather' && c.job && st.byId.get(c.job)?.type === 'woodcutter' ? 'axe' : c.state === 'farm' && !moving ? 'hoe' : null;
      const sel = view.selected.has(c.id);
      items.push({
        y,
        draw: () => {
          if (sel) this.ring(ctx, x, y + 0.15, 0.32, '#ffe066');
          this.sprite(ctx, x, y + 0.2, () => drawPerson(ctx, c, t, moving, { tool }));
        },
      });
    }
    for (const u of st.units) {
      const x = u.px + (u.x - u.px) * alpha + u.ox;
      const y = u.py + (u.y - u.py) * alpha + u.oy;
      if (!inView(x, y)) continue;
      if (u.owner !== 'player' && !seen(x, y)) continue;
      const moving = !!u.path;
      const color = u.owner === 'player' ? PLAYER : isHostileOwner(st, 'player', u.owner) ? ENEMY : st.factionMap[u.owner]?.color || st.foreign[u.owner]?.color || '#888';
      const sel = view.selected.has(u.id);
      const swing = u.swingT ? (st.time.t - u.swingT) / 0.3 : 2;
      items.push({
        y,
        draw: () => {
          if (sel) this.ring(ctx, x, y + 0.15, 0.42, '#ffe066');
          this.sprite(ctx, x, y + 0.2, () => drawSoldier(ctx, u, t, moving, color, { swing: swing < 1 ? swing : 0 }));
          if (u.hp < u.maxHp || sel) this.hpBar(ctx, x, y - 0.75, u.hp / u.maxHp, 0.7);
        },
      });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // Projectiles.
    ctx.save();
    ctx.scale(1 / TILE, 1 / TILE);
    for (const f of st.fx) drawProjectile(ctx, f);
    ctx.restore();

    // Selected building outline.
    for (const id of view.selected) {
      const b = st.byId.get(id);
      if (!b || b.kind !== 'building') continue;
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 0.08;
      ctx.setLineDash([0.3, 0.15]);
      ctx.strokeRect(b.x + 0.05, b.y + 0.05, b.w - 0.1, b.h - 0.1);
      ctx.setLineDash([]);
      const tw = BUILDINGS[b.type].tower;
      if (tw) {
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, tw.range, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,224,102,0.35)';
        ctx.stroke();
      }
    }
    if (view.selectedFaction) {
      const f = st.factionMap[view.selectedFaction];
      if (f) this.ring(ctx, f.x + 0.5, f.y + 0.5, f.radius, 'rgba(255,224,102,0.7)');
    }

    if (view.ghost) this.drawGhost(ctx, view.ghost, t);
    if (view.order) {
      const k = (performance.now() - view.order.at) / 600;
      if (k < 1) this.ring(ctx, view.order.x, view.order.y, 0.2 + k * 0.5, view.order.attack ? `rgba(231,76,60,${1 - k})` : `rgba(255,224,102,${1 - k})`);
    }

    // Fog of war over everything.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fogCanvas, 0, 0, st.W, st.H);

    // Season haze.
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const tint = season(st).tint;
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (view.box) {
      const { x0, y0, x1, y1 } = view.box;
      ctx.fillStyle = 'rgba(255,224,102,0.12)';
      ctx.strokeStyle = 'rgba(255,224,102,0.8)';
      ctx.lineWidth = 1;
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
  }

  sprite(ctx, x, y, fn) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 / TILE, 1 / TILE);
    fn();
    ctx.restore();
  }

  ring(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.06;
    ctx.stroke();
  }

  hpBar(ctx, x, y, frac, w) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - w / 2, y, w, 0.1);
    ctx.fillStyle = frac > 0.5 ? '#2ecc71' : frac > 0.25 ? '#f1c40f' : '#e74c3c';
    ctx.fillRect(x - w / 2, y, w * Math.max(0, frac), 0.1);
  }

  wallNeighbours(b) {
    const st = this.st;
    const isWall = (x, y) => {
      if (x < 0 || y < 0 || x >= st.W || y >= st.H) return false;
      const o = st.byId.get(st.occ[y * st.W + x]);
      return !!o && (o.wall || o.gate);
    };
    return { l: isWall(b.x - 1, b.y), r: isWall(b.x + 1, b.y), u: isWall(b.x, b.y - 1), d: isWall(b.x, b.y + 1) };
  }

  drawBuildOverlay(ctx, minX, minY, maxX, maxY) {
    const st = this.st;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const v = st.territory[y * st.W + x];
        if (v === 2 && st.explored[y * st.W + x]) {
          ctx.fillStyle = 'rgba(192,57,43,0.18)';
          ctx.fillRect(x, y, 1, 1);
        } else if (v === 1) {
          ctx.fillStyle = 'rgba(255,236,170,0.06)';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  drawGhost(ctx, g, t) {
    const st = this.st;
    for (const tile of g.tiles) {
      ctx.fillStyle = tile.ok ? 'rgba(46,204,113,0.35)' : 'rgba(231,76,60,0.4)';
      ctx.fillRect(tile.x, tile.y, g.w, g.h);
    }
    if (g.tiles.length === 1) {
      const tile = g.tiles[0];
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.translate(tile.x, tile.y);
      ctx.scale(1 / TILE, 1 / TILE);
      drawBuilding(ctx, { type: g.type, w: g.w, h: g.h, built: 1, growth: 0.5, id: 0, workers: [] }, t, st, { l: false, r: false, u: false, d: false });
      ctx.restore();
      const def = BUILDINGS[g.type];
      const job = def.job;
      const radius = def.tower?.range || (job && job.radius);
      if (radius) {
        ctx.beginPath();
        ctx.arc(tile.x + g.w / 2, tile.y + g.h / 2, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 0.06;
        ctx.setLineDash([0.3, 0.2]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}

// --- Vegetation --------------------------------------------------------------------

function drawCanopy(g, x, y, r, k) {
  g.fillStyle = 'rgba(20,30,10,0.3)';
  g.beginPath();
  g.ellipse(x + 3, y + r * 0.7, r, r * 0.45, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = k % 2 ? '#2f5f2a' : '#2a5526';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = k % 2 ? '#3f7a35' : '#3a7232';
  g.beginPath();
  g.arc(x - r * 0.25, y - r * 0.3, r * 0.65, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(140,200,90,0.25)';
  g.beginPath();
  g.arc(x - r * 0.4, y - r * 0.45, r * 0.3, 0, Math.PI * 2);
  g.fill();
}

function drawAcacia(g, bx, by, x, y, seed) {
  const cx = bx + 10 + hash2(x, y, seed + 87) * 12;
  const cy = by + 12 + hash2(y, x, seed + 89) * 10;
  g.strokeStyle = '#5a3a20';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(cx, cy + 6);
  g.lineTo(cx, cy - 2);
  g.stroke();
  g.fillStyle = 'rgba(40,30,10,0.25)';
  g.beginPath();
  g.ellipse(cx + 3, cy + 6, 10, 3, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#6b7d34';
  g.beginPath();
  g.ellipse(cx, cy - 4, 11, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#7f9440';
  g.beginPath();
  g.ellipse(cx - 2, cy - 6, 7, 3, 0, 0, Math.PI * 2);
  g.fill();
}

function drawMangrove(g, bx, by, x, y, seed) {
  for (let k = 0; k < 2; k++) {
    const cx = bx + 8 + hash2(x + k, y, seed + 93) * 16;
    const cy = by + 10 + hash2(x, y + k, seed + 95) * 14;
    g.strokeStyle = '#4a3624';
    g.lineWidth = 1;
    for (let r = -1; r <= 1; r++) {
      g.beginPath();
      g.moveTo(cx, cy);
      g.quadraticCurveTo(cx + r * 4, cy + 2, cx + r * 6, cy + 7);
      g.stroke();
    }
    g.fillStyle = '#2f5233';
    g.beginPath();
    g.arc(cx, cy - 2, 6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3d6a40';
    g.beginPath();
    g.arc(cx - 1.5, cy - 3.5, 3.5, 0, Math.PI * 2);
    g.fill();
  }
}

function drawPalm(g, x, y, fruit, h) {
  g.fillStyle = 'rgba(20,30,10,0.25)';
  g.beginPath();
  g.ellipse(x + 6, y + 6, 10, 3, 0, 0, Math.PI * 2);
  g.fill();
  const lean = (h - 0.5) * 8;
  g.strokeStyle = '#7a5a35';
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(x, y + 6);
  g.quadraticCurveTo(x + lean * 0.3, y - 4, x + lean, y - 12);
  g.stroke();
  const tx = x + lean;
  const ty = y - 12;
  g.strokeStyle = '#3c8a3a';
  g.lineWidth = 2;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + h;
    g.beginPath();
    g.moveTo(tx, ty);
    g.quadraticCurveTo(tx + Math.cos(a) * 7, ty + Math.sin(a) * 5 - 4, tx + Math.cos(a) * 12, ty + Math.sin(a) * 7 + 1);
    g.stroke();
  }
  if (fruit) {
    g.fillStyle = '#d35400';
    g.beginPath();
    g.arc(tx, ty + 2, 2.6, 0, Math.PI * 2);
    g.fill();
  }
}

function drawRocks(g, bx, by, x, y, seed, base, light) {
  for (let k = 0; k < 3; k++) {
    const cx = bx + 6 + hash2(x + k, y, seed + 97) * 20;
    const cy = by + 8 + hash2(x, y + k, seed + 99) * 18;
    const r = 4 + hash2(x - k, y + k, seed + 101) * 4;
    g.fillStyle = 'rgba(30,20,10,0.25)';
    g.beginPath();
    g.ellipse(cx + 2, cy + r * 0.6, r, r * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = base;
    g.beginPath();
    g.moveTo(cx - r, cy + r * 0.4);
    g.lineTo(cx - r * 0.6, cy - r * 0.7);
    g.lineTo(cx + r * 0.3, cy - r);
    g.lineTo(cx + r, cy - r * 0.1);
    g.lineTo(cx + r * 0.7, cy + r * 0.5);
    g.closePath();
    g.fill();
    g.fillStyle = light;
    g.beginPath();
    g.moveTo(cx - r * 0.6, cy - r * 0.7);
    g.lineTo(cx + r * 0.3, cy - r);
    g.lineTo(cx + r * 0.1, cy - r * 0.2);
    g.closePath();
    g.fill();
  }
}

export { UNITS };
