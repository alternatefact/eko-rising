// The game's view: a fixed 2D isometric picture of the world, drawn from the
// baked sprite sheets (see tools/bake). The camera looks from the south-east
// and never turns; a tile is a 64 x 32 diamond at zoom 1. Ground first, then
// everything that stands on it from the back to the front, then fog of war
// and the markers the interface needs.
//
// The camera works in tile units: cam.x, cam.y is the tile at the centre of
// the screen.

import { T, F, TREE, isWater, treePlanks } from '../world/terrain.js';
import { hash2 } from '../core/rng.js';
import { Atlas } from './atlas.js';
import { Ground, CHUNK } from './ground.js';
import { PLAYER, ENEMY } from './palette.js';
import { BUILDINGS } from '../data/buildings.js';
import { season } from '../sim/economy.js';
import { isHostileOwner } from '../sim/military.js';

const HW = 32; // half a tile's width at zoom 1
const HH = 16; // half its height
const ZH = 39.19; // pixels per tile of height at zoom 1 (30 degrees down)
const ZOOM = [0.45, 2];

// Which model and tool each kind of work shows (see tools/bake LOOKS).
const MALE_LOOK = { farm: 'farmer', cassava: 'farmer', woodcutter: 'woodcutter', hunter: 'hunter', fisher: 'fisher', canoeyard: 'fisher' };
const FEMALE_LOOK = { woodcutter: 'woman_axe', farm: 'woman_hoe', cassava: 'woman_hoe', hunter: 'woman_bow' };
const WORK_ANIM = { farm: 'pull', cassava: 'pull', woodcutter: 'swing', brickyard: 'pull', quarry: 'swing', ironmine: 'swing', blacksmith: 'swing', hunter: 'bow', palmpress: 'pull', garri: 'pull', fisher: 'pull' };
const WORKING = new Set(['fell', 'saw', 'gather', 'farm', 'harvest', 'craft', 'process', 'butcher', 'shoot', 'tend']);
const UNIT_LOOK = { bandit: 'bandit', slaver: 'bandit', archer: 'hunter', bowman: 'hunter' };

// Eight screen directions (0 = right, going clockwise) to a baked direction
// and whether it is mirrored. Baked: 0 down, 1 down-right, 2 right, 3 up-right, 4 up.
const SECTOR = [[2, false], [1, false], [0, false], [1, true], [2, true], [3, true], [4, false], [3, false]];

function sectorOf(dx, dy) {
  const sx = dx - dy;
  const sy = (dx + dy) / 2;
  const a = Math.atan2(sy, sx);
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}

export class IsoRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, zoom: 1.3 };
    this.atlas = new Atlas();
    this.ground = new Ground();
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
    this.timeScale = 1;
    this.facing = new Map();
    this.hits = [];
    this.borderVersion = -1;
    this.borders = [];
  }

  async load() {
    await Promise.all([this.atlas.load(), this.ground.load()]);
  }

  attach(st) {
    this.st = st;
    this.ground.attach(st);
    this.fog = document.createElement('canvas');
    this.fog.width = st.W;
    this.fog.height = st.H;
    this.fogVersion = -1;
    this.borderVersion = -1;
    this.facing.clear();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.dpr = dpr;
  }

  // Screen pixels per tile along the ground, for code that pans by pixels.
  get scale() {
    return HW * this.cam.zoom;
  }

  clampCam() {
    if (!this.st) return;
    this.cam.x = Math.max(0, Math.min(this.st.W, this.cam.x));
    this.cam.y = Math.max(0, Math.min(this.st.H, this.cam.y));
  }

  // --- Projection ------------------------------------------------------------------

  tileToScreen(tx, ty, z = 0) {
    const k = this.cam.zoom;
    return {
      x: (tx - ty - (this.cam.x - this.cam.y)) * HW * k + this.w / 2,
      y: (tx + ty - (this.cam.x + this.cam.y)) * HH * k + this.h / 2 - z * ZH * k,
    };
  }

  screenToTile(sx, sy) {
    const k = this.cam.zoom;
    const u = (sx - this.w / 2) / (HW * k);
    const v = (sy - this.h / 2) / (HH * k);
    return { x: this.cam.x + (u + v) / 2, y: this.cam.y + (v - u) / 2 };
  }

  standAt() {
    return 0;
  }

  centerOn(x, y) {
    this.cam.x = x;
    this.cam.y = y;
    this.clampCam();
  }

  zoomAt(factor, sx, sy) {
    const before = this.screenToTile(sx, sy);
    this.cam.zoom = Math.max(ZOOM[0], Math.min(ZOOM[1], this.cam.zoom * factor));
    const after = this.screenToTile(sx, sy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.clampCam();
  }

  panBy(dx, dy) {
    const k = this.cam.zoom;
    const u = -dx / (HW * k);
    const v = -dy / (HH * k);
    this.cam.x += (u + v) / 2;
    this.cam.y += (v - u) / 2;
    this.clampCam();
  }

  // --- Frame ----------------------------------------------------------------------

  draw(alpha, view) {
    const st = this.st;
    if (!st || !this.atlas.ready) return;
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const t = performance.now() / 1000;
    this.t = t;
    if (st.changedTiles.length) {
      for (const i of st.changedTiles) this.ground.touch(i);
      st.changedTiles.length = 0;
    }
    this.ground.updateWear(false);
    this.updateFog();
    this.updateBorders();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0c1016';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.imageSmoothingEnabled = true;

    // The tiles on screen, with room for tall things standing below the edge.
    const corners = [[0, -40], [this.w, -40], [0, this.h + 260 * z], [this.w, this.h + 260 * z]].map(([x, y]) => this.screenToTile(x, y));
    const minX = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.x))) - 1);
    const maxX = Math.min(st.W - 1, Math.ceil(Math.max(...corners.map((c) => c.x))) + 1);
    const minY = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.y))) - 1);
    const maxY = Math.min(st.H - 1, Math.ceil(Math.max(...corners.map((c) => c.y))) + 1);
    const onScreen = (sx, sy, pad = 80) => sx > -pad * z && sx < this.w + pad * z && sy > -pad * z && sy < this.h + 300 * z;

    // --- Ground ---
    const ox = this.w / 2 - (this.cam.x - this.cam.y) * HW * z;
    const oy = this.h / 2 - (this.cam.x + this.cam.y) * HH * z;
    const P = 32;
    for (let cy = Math.floor(minY / CHUNK); cy <= Math.floor(maxY / CHUNK); cy++) {
      for (let cx = Math.floor(minX / CHUNK); cx <= Math.floor(maxX / CHUNK); cx++) {
        const e = (cx - cy) * CHUNK * HW * z + ox;
        const f = (cx + cy) * CHUNK * HH * z + oy;
        // Skip chunks entirely off screen.
        const span = CHUNK * HW * z;
        if (e + span < 0 || e - span > this.w || f > this.h || f + CHUNK * 2 * HH * z < 0) continue;
        if (!this.ground.ready) continue;
        const c = this.ground.chunk(cx, cy);
        ctx.setTransform(this.dpr * (HW * z) / P, this.dpr * (HH * z) / P, -this.dpr * (HW * z) / P, this.dpr * (HH * z) / P, this.dpr * e, this.dpr * f);
        ctx.drawImage(c, 0, 0, c.width, c.height, -0.6, -0.6, c.width + 1.2, c.height + 1.2);
      }
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawWater(ctx, minX, minY, maxX, maxY, t);
    this.drawBorders(ctx);
    if (view.showTerritory) this.drawTerritory(ctx, minX, minY, maxX, maxY);

    // --- Things standing on the ground, back to front ---
    const items = [];
    const seen = (x, y) => st.visible[Math.floor(y) * st.W + Math.floor(x)];
    const explored = (x, y) => st.explored[Math.floor(y) * st.W + Math.floor(x)];
    const hits = [];
    const add = (depth, draw) => items.push({ depth, draw });
    const falling = new Map();
    for (const f of st.fx) if (f.kind === 'treefall') falling.set(Math.floor(f.y0) * st.W + Math.floor(f.x0), f);

    // Trees, palms, rocks and bushes.
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const i = y * st.W + x;
        if (!st.explored[i]) continue;
        const trees = st.trees[i];
        const f = st.feature[i];
        const tt = st.terrain[i];
        const jx = (hash2(x, y, 11) - 0.5) * 0.3;
        const jy = (hash2(x, y, 12) - 0.5) * 0.3;
        const p = this.tileToScreen(x + 0.5 + jx, y + 0.5 + jy);
        if (!onScreen(p.x, p.y)) continue;
        const depth = x + y + 1;
        if (trees > 0 && st.felled[i] === TREE.STANDING && !st.occ[i]) {
          const key = treeKey(tt, x, y);
          const fall = falling.get(i);
          add(depth, () => {
            if (fall) this.drawFalling(ctx, key, p, fall);
            else this.atlas.draw(ctx, key, p.x, p.y, z);
          });
          hits.push({ key, x: p.x, y: p.y, depth, target: { kind: 'tree', i, x: x + 0.5, y: y + 0.5 } });
          continue;
        }
        if (trees > 0 && st.felled[i] === TREE.FELLED) {
          const full = trees >= treePlanks(tt);
          const fall = falling.get(i);
          const key = `f/${full ? 'log' : 'planks'}/${(x * 7 + y) % 2 ? 'a' : 'b'}`;
          if (!fall) add(depth - 0.3, () => this.atlas.draw(ctx, key, p.x, p.y, z));
          else add(depth, () => this.drawFalling(ctx, treeKey(tt, x, y), p, fall));
          hits.push({ key, x: p.x, y: p.y, depth: depth - 0.3, target: { kind: 'tree', i, x: x + 0.5, y: y + 0.5 } });
          continue;
        }
        if (st.felled[i] === TREE.STUMP && !st.occ[i]) {
          add(depth - 0.5, () => this.atlas.draw(ctx, 'f/stump', p.x, p.y, z));
        }
        if (f === F.PALM && !st.occ[i]) {
          const key = `f/${st.amount[i] >= 4 ? 'palmfruit' : 'palm'}/${(x + y * 3) % 3}`;
          add(depth, () => this.atlas.draw(ctx, key, p.x, p.y, z));
        } else if ((f === F.ROCK || f === F.IRON) && !st.occ[i]) {
          const key = `f/${f === F.IRON ? 'iron' : 'rock'}/${(x * 3 + y) % 3}`;
          add(depth - 0.2, () => this.atlas.draw(ctx, key, p.x, p.y, z));
        } else if (!trees && !st.occ[i] && f === F.NONE && (tt === T.GRASS || tt === T.SAVANNA || tt === T.FOREST) && (this.ground.wear[i] || 0) < 0.3) {
          const chance = tt === T.FOREST ? 0.4 : tt === T.GRASS ? 0.06 : 0.04;
          if (hash2(x, y, 23) < chance) add(depth - 0.4, () => this.atlas.draw(ctx, `f/bush/${(x + y) % 4}`, p.x, p.y, z * 0.85));
        }
      }
    }

    // Buildings and what is stored on the floors.
    const stacks = this.stackSpots();
    for (const b of st.buildings) {
      if (b.dead || b.x > maxX + 2 || b.y > maxY + 2 || b.x + b.w < minX - 2 || b.y + b.h < minY - 2) continue;
      if (!explored(b.x + b.w / 2, b.y + b.h / 2)) continue;
      const key = this.buildingKey(b);
      const p = this.tileToScreen(b.x, b.y);
      const depth = b.x + b.w / 2 + b.y + b.h / 2 + (BUILDINGS[b.type].flat ? -b.w : 0);
      const sel = view.selected.has(b.id);
      add(depth, () => {
        if (sel) this.diamond(ctx, b.x, b.y, b.w, b.h, 'rgba(255,224,102,0.35)', '#ffe066');
        if (b.built < 1) this.drawConstruction(ctx, key, p, b);
        else this.atlas.draw(ctx, key, p.x, p.y, z);
        if (b.type === 'campfire') this.drawFlames(ctx, b.x + 1, b.y + 1, 0.12, t, 1);
        if (b.hp < b.maxHp && b.built >= 1 && !BUILDINGS[b.type].invulnerable) {
          const top = this.tileToScreen(b.x + b.w / 2, b.y + b.h / 2, 1.3);
          this.hpBar(ctx, top.x, top.y, b.hp / b.maxHp, 40 * z);
        }
        if (b.hitT && st.time.t - b.hitT < 0.3) this.diamond(ctx, b.x, b.y, b.w, b.h, 'rgba(255,120,60,0.3)');
      });
      hits.push({ key, x: p.x, y: p.y, depth, target: b, built: b.built });
    }
    for (const s of stacks) {
      const p = this.tileToScreen(s.x, s.y);
      add(s.x + s.y - 0.4, () => this.atlas.draw(ctx, s.key, p.x, p.y, z));
    }

    // Other peoples' villages, ships and places to find.
    for (const f of st.factions) {
      if (!st.explored[f.y * st.W + f.x]) continue;
      const p = this.tileToScreen(f.x + 0.5, f.y + 0.5);
      if (!onScreen(p.x, p.y, 300)) continue;
      const key = `v/${f.id}`;
      const sel = view.selectedFaction === f.id;
      add(f.x + f.y + 1, () => {
        if (sel) this.ellipse(ctx, f.x + 0.5, f.y + 0.5, f.radius, 'rgba(255,224,102,0.8)');
        this.atlas.draw(ctx, key, p.x, p.y, z);
        if (f.burning && st.time.t < f.burning) this.drawFlames(ctx, f.x + 0.5, f.y + 0.5, 0.6, t, 3);
      });
      hits.push({ key, x: p.x, y: p.y, depth: f.x + f.y + 1, target: { kind: 'faction', f } });
    }
    for (const sh of st.ships) {
      const x = sh.px + (sh.x - sh.px) * alpha;
      const y = sh.py + (sh.y - sh.py) * alpha;
      const p = this.tileToScreen(x, y, -0.1);
      if (!onScreen(p.x, p.y, 200)) continue;
      const dir = Math.abs(sh.x - sh.px) >= Math.abs(sh.y - sh.py) ? 'a' : 'b';
      const key = `ship/${['portuguese', 'french', 'british'].includes(sh.power) ? sh.power : 'merchant'}/${dir}`;
      add(x + y, () => this.atlas.draw(ctx, key, p.x, p.y + Math.sin(t * 1.4 + sh.id) * 1.5 * z, z));
    }
    for (const poi of st.pois) {
      if (!poi.found || poi.claimed) continue;
      const p = this.tileToScreen(poi.x + 0.5, poi.y + 0.5);
      add(poi.x + poi.y + 1, () => this.drawPoi(ctx, p, t));
    }

    // Animals.
    for (const a of st.animals) {
      if (a.dead) continue;
      const x = a.px + (a.x - a.px) * alpha;
      const y = a.py + (a.y - a.py) * alpha;
      if (!seen(x, y)) continue;
      const p = this.tileToScreen(x, y);
      if (!onScreen(p.x, p.y)) continue;
      const [dir, mirror] = this.dirFor(a, x - a.px, y - a.py);
      let anim = a.carcass ? 'dead' : a.path ? (a.type === 'wolf' ? 'run' : 'walk') : 'idle';
      if (a.type === 'wolf' && !a.carcass && (a.phase === 'maul' || a.phase === 'fight')) anim = 'bite';
      const frames = { walk: 6, run: 6, bite: 4 }[anim] || 1;
      const fps = anim === 'run' ? 14 : anim === 'bite' ? 8 : 9;
      const key = `a/${a.type}/${anim}/${dir}/${Math.floor(t * fps + a.id * 0.37) % frames}`;
      add(x + y, () => {
        this.shadow(ctx, p.x, p.y, a.type === 'wolf' ? 9 : 8);
        this.atlas.draw(ctx, key, p.x, p.y, z, mirror);
        if (a.hitT && st.time.t - a.hitT < 0.25 && !a.carcass) this.flash(ctx, p.x, p.y - 8 * z);
      });
      hits.push({ key, x: p.x, y: p.y, depth: x + y, target: a, small: true, mirror });
    }

    // People.
    for (const c of st.citizens) {
      if (c.hidden || c.dead) continue;
      const x = c.px + (c.x - c.px) * alpha + c.ox * 0.6;
      const y = c.py + (c.y - c.py) * alpha + c.oy * 0.6;
      if (!seen(x, y)) continue;
      const p = this.tileToScreen(x, y);
      if (!onScreen(p.x, p.y)) continue;
      const job = c.job ? st.byId.get(c.job) : null;
      const moving = !!c.path && (Math.abs(c.x - c.px) + Math.abs(c.y - c.py) > 1e-4);
      const look = this.citizenLook(c, job, moving);
      const face = this.faceOf(c, job);
      const [dir, mirror] = this.dirFor(c, face ? face.x - x : x - c.px, face ? face.y - y : y - c.py, !!face);
      const key = this.frameKey(look, dir, t, c.id);
      const sel = view.selected.has(c.id);
      add(x + y, () => {
        if (sel) this.ellipse(ctx, x, y, 0.32, '#ffe066');
        this.shadow(ctx, p.x, p.y, 7);
        this.atlas.draw(ctx, key, p.x, p.y, z, mirror);
        const head = (this.atlas.meta.looks[look.look]?.height || 0.82) + 0.02;
        if (c.carry) {
          const lp = this.tileToScreen(x, y, head);
          this.atlas.draw(ctx, `l/${this.atlas.has(`l/${c.carry.r}/0`) ? c.carry.r : 'other'}/${dir}`, lp.x, lp.y, z, mirror);
        } else if (c.carcass) {
          const lp = this.tileToScreen(x, y, head - 0.2);
          this.atlas.draw(ctx, `a/${c.carcass}/dead/${dir}/0`, lp.x, lp.y, z * 0.85, mirror);
        }
        if (c.hp < c.maxHp && (c.state === 'attacked' || c.state === 'fight')) {
          const top = this.tileToScreen(x, y, head + 0.25);
          this.hpBar(ctx, top.x, top.y, c.hp / c.maxHp, 22 * z);
        }
      });
      hits.push({ key, x: p.x, y: p.y, depth: x + y, target: c, small: true, mirror });
    }

    // Soldiers.
    for (const u of st.units) {
      if (u.dead) continue;
      const x = u.px + (u.x - u.px) * alpha + u.ox * 0.6;
      const y = u.py + (u.y - u.py) * alpha + u.oy * 0.6;
      if (u.owner !== 'player' && !seen(x, y)) continue;
      const p = this.tileToScreen(x, y);
      if (!onScreen(p.x, p.y)) continue;
      const moving = !!u.path && (Math.abs(u.x - u.px) + Math.abs(u.y - u.py) > 1e-4);
      const target = u.order?.target ? st.byId.get(u.order.target) : null;
      const striking = u.swingT && st.time.t - u.swingT < 0.45;
      const lookName = UNIT_LOOK[u.type] || 'spearman';
      const anims = this.atlas.meta.looks[lookName].anims;
      const anim = striking ? (anims.includes('bow') ? 'bow' : 'slash') : moving ? (anims.includes('spearwalk') ? 'spearwalk' : 'walk') : 'idle';
      const tx = target ? (target.kind === 'building' ? target.x + target.w / 2 : target.x) : null;
      const ty = target ? (target.kind === 'building' ? target.y + target.h / 2 : target.y) : null;
      const [dir, mirror] = this.dirFor(u, striking && target ? tx - x : x - u.px, striking && target ? ty - y : y - u.py, striking && !!target);
      const key = this.frameKey({ look: lookName, anim }, dir, t, u.id);
      const color = u.owner === 'player' ? PLAYER : isHostileOwner(st, 'player', u.owner) ? ENEMY : st.factionMap[u.owner]?.color || st.foreign[u.owner]?.color || '#888';
      const sel = view.selected.has(u.id);
      add(x + y, () => {
        if (sel) this.ellipse(ctx, x, y, 0.38, '#ffe066');
        this.teamMark(ctx, p.x, p.y, color);
        this.atlas.draw(ctx, key, p.x, p.y, z, mirror);
        if (u.hp < u.maxHp || sel) {
          const top = this.tileToScreen(x, y, 1.0);
          this.hpBar(ctx, top.x, top.y, u.hp / u.maxHp, 24 * z);
        }
      });
      hits.push({ key, x: p.x, y: p.y, depth: x + y, target: u, small: true, mirror });
    }

    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw();
    hits.sort((a, b) => a.depth - b.depth);
    this.hits = hits;

    // Arrows, shots and cannon balls.
    for (const f of st.fx) this.drawFx(ctx, f);

    if (view.ghost) this.drawGhost(ctx, view.ghost);
    if (view.order) {
      const k = (performance.now() - view.order.at) / 600;
      if (k < 1) this.ellipse(ctx, view.order.x, view.order.y, 0.2 + k * 0.5, view.order.attack ? `rgba(231,76,60,${1 - k})` : `rgba(255,224,102,${1 - k})`);
    }

    // Fog of war over everything.
    ctx.setTransform(this.dpr * HW * z, this.dpr * HH * z, -this.dpr * HW * z, this.dpr * HH * z, this.dpr * ox, this.dpr * oy);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fog, 0, 0, st.W, st.H);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const tint = season(st).tint;
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (view.point) this.drawPointer(ctx, view.point, t);
    if (view.box) {
      const { x0, y0, x1, y1 } = view.box;
      ctx.fillStyle = 'rgba(255,224,102,0.12)';
      ctx.strokeStyle = 'rgba(255,224,102,0.8)';
      ctx.lineWidth = 1;
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
  }

  // --- Choosing pictures ------------------------------------------------------------

  buildingKey(b) {
    const st = this.st || { era: 0, flags: {} };
    const def = BUILDINGS[b.type];
    if (def.wall) return `w/${b.type}/${this.wallMask(b)}`;
    if (def.gate) {
      const n = this.wallMask(b);
      return `w/gate/${n & 12 && !(n & 3) ? 'v' : 'h'}/e${st.era >= 2 ? 2 : 0}`;
    }
    const level = b.level || 1;
    let key = `b/${b.type}/${level}${b.mud && def.mudBricks && !(b.type === 'hut' && level !== 2 && level < 3) ? 'm' : ''}`;
    if (b.type === 'hut') key = `b/hut/${level}${level >= 2 ? 'm' : ''}`;
    const eras = { compound: [0, 3], gate: [0, 2], watchtower: [1, 2], palace: [1, 3] }[b.type];
    if (eras) key += `/e${st.era >= eras[1] ? eras[1] : eras[0]}`;
    if (def.job?.type === 'farm') {
      const g = b.growth || 0;
      key += `/g${g >= 1 ? 100 : g >= 0.6 ? 70 : g >= 0.25 ? 35 : 0}`;
    }
    if (b.type === 'port') key += `/${st.flags.britishPartner || st.flags.colonized ? 'b' : st.flags.frenchPact ? 'f' : 'p'}`;
    if (!this.atlas.has(key)) key = `b/${b.type}/1${eras ? `/e${eras[0]}` : ''}${def.job?.type === 'farm' ? '/g70' : ''}`;
    return key;
  }

  wallMask(b) {
    const st = this.st;
    const isWall = (x, y) => {
      if (x < 0 || y < 0 || x >= st.W || y >= st.H) return false;
      const o = st.byId.get(st.occ[y * st.W + x]);
      return !!o && !o.dead && (o.wall || o.gate);
    };
    return (isWall(b.x - 1, b.y) ? 1 : 0) | (isWall(b.x + 1, b.y) ? 2 : 0) | (isWall(b.x, b.y - 1) ? 4 : 0) | (isWall(b.x, b.y + 1) ? 8 : 0);
  }

  citizenLook(c, job, moving) {
    const type = job?.type;
    const working = WORKING.has(c.state) && !moving;
    const fighting = c.state === 'fight';
    // Someone with a load keeps their hands up to it, walking or not.
    const still = !moving;
    if (c.special === 'founder') {
      if (c.carry) return { look: 'founder', anim: 'carry', still };
      if ((c.state === 'fell' || c.state === 'saw') && !moving) return { look: 'founder_axe', anim: 'swing' };
      return { look: 'founder', anim: moving ? 'strut' : 'idle' };
    }
    if (c.special === 'spouse') return { look: 'wife', anim: moving ? 'womanwalk' : 'idle' };
    if (c.female) {
      if (c.carry) return { look: 'woman', anim: 'womancarry', still };
      const look = FEMALE_LOOK[type] || 'woman';
      const anims = this.atlas.meta.looks[look].anims;
      if ((working || fighting) && anims.includes(WORK_ANIM[type])) return { look, anim: WORK_ANIM[type] };
      if (fighting) return { look, anim: anims.includes('swing') ? 'swing' : 'idle' };
      return { look, anim: moving ? 'womanwalk' : 'idle' };
    }
    const look = MALE_LOOK[type] || 'labourer';
    const anims = this.atlas.meta.looks[look].anims;
    if (c.carry) return { look, anim: 'carry', still };
    if ((working || fighting) && anims.includes(WORK_ANIM[type])) return { look, anim: WORK_ANIM[type] };
    if (fighting) return { look, anim: anims.includes('swing') ? 'swing' : 'idle' };
    if (c.carcass && moving) return { look, anim: 'carry' };
    return { look, anim: moving ? 'walk' : 'idle' };
  }

  // What someone at work turns to face: the tree, the prey, the wolf.
  faceOf(c, job) {
    const st = this.st;
    if ((c.state === 'fell' || c.state === 'saw') && c.src >= 0) return { x: (c.src % st.W) + 0.5, y: Math.floor(c.src / st.W) + 0.5 };
    if (c.state === 'shoot' && c.prey) {
      const a = st.byId.get(c.prey);
      if (a) return a;
    }
    if (c.state === 'fight' || c.state === 'attacked') {
      const w = st.animals.find((a) => a.type === 'wolf' && !a.dead && !a.carcass && a.target === c.id);
      if (w) return w;
    }
    return null;
  }

  dirFor(e, dx, dy, force = false) {
    let s = this.facing.get(e.id);
    if (force || Math.abs(dx) + Math.abs(dy) > 0.002) s = sectorOf(dx, dy);
    if (s === undefined) s = 2;
    this.facing.set(e.id, s);
    return SECTOR[s];
  }

  frameKey({ look, anim, still }, dir, t, id) {
    const L = this.atlas.meta.looks[look];
    if (!L || !L.anims.includes(anim)) anim = 'idle';
    if (still) return `c/${look}/${anim}/${dir}/0`;
    const frames = L?.frames[anim] || 1;
    const fps = anim === 'idle' ? 3 : anim === 'swing' || anim === 'pull' || anim === 'slash' ? 9 : 11;
    return `c/${look}/${anim}/${dir}/${Math.floor(t * fps + id * 0.61) % frames}`;
  }

  // Goods on the storage floors: each floor tile holds one heap of up to 20.
  stackSpots() {
    const st = this.st;
    const order = ['wood', 'bricks', 'stone', 'yam', 'cassava', 'garri', 'fish', 'meat', 'palmoil', 'iron', 'weapons', 'salt', 'cloth'];
    const floors = st.buildings.filter((b) => b.type === 'stockpile' && b.owner === 'player' && !b.dead && b.built >= 1).sort((a, b) => a.id - b.id);
    const spots = [];
    for (const b of floors) for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) spots.push({ x: b.x + dx + 0.5, y: b.y + dy + 0.5 });
    const out = [];
    let s = 0;
    for (const r of order) {
      let n = Math.floor(st.res[r] || 0);
      while (n > 0 && s < spots.length) {
        const take = Math.min(n, 20);
        const shown = Math.max(2, Math.min(20, Math.ceil(take / 2) * 2));
        out.push({ ...spots[s], key: `s/${r}/${shown}` });
        n -= take;
        s++;
      }
    }
    return out;
  }

  // --- Picking ------------------------------------------------------------------------

  // What is under a point on the screen: the front-most thing drawn there.
  pickScreen(sx, sy) {
    const z = this.cam.zoom;
    for (let k = this.hits.length - 1; k >= 0; k--) {
      const h = this.hits[k];
      if (h.small) {
        const box = this.atlas.box(h.key, h.x, h.y, z, h.mirror);
        if (box && sx >= box.left - 4 && sx <= box.left + box.w + 4 && sy >= box.top - 4 && sy <= box.top + box.h + 2) return h.target;
        continue;
      }
      if (this.atlas.solidAt(h.key, h.x, h.y, z, h.mirror, sx, sy)) return h.target;
    }
    // Nothing standing there: the ground (a building's floor, say).
    const p = this.screenToTile(sx, sy);
    const st = this.st;
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    if (x < 0 || y < 0 || x >= st.W || y >= st.H) return null;
    const b = st.byId.get(st.occ[y * st.W + x]);
    if (b && !b.dead) return b;
    return null;
  }

  // --- Drawing helpers ------------------------------------------------------------------

  diamond(ctx, x, y, w, h, fill, stroke) {
    const a = this.tileToScreen(x, y);
    const b = this.tileToScreen(x + w, y);
    const c = this.tileToScreen(x + w, y + h);
    const d = this.tileToScreen(x, y + h);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  ellipse(ctx, x, y, r, color, fill) {
    const p = this.tileToScreen(x, y);
    const z = this.cam.zoom;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * HW * z * Math.SQRT2, r * HH * z * Math.SQRT2, 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  shadow(ctx, x, y, r) {
    const z = this.cam.zoom;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y, r * z, r * 0.5 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  teamMark(ctx, x, y, color) {
    const z = this.cam.zoom;
    ctx.beginPath();
    ctx.ellipse(x, y, 9 * z, 4.5 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  hpBar(ctx, x, y, frac, w) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
    ctx.fillStyle = frac > 0.5 ? '#2ecc71' : frac > 0.25 ? '#f1c40f' : '#e74c3c';
    ctx.fillRect(x - w / 2, y, w * Math.max(0, frac), 3);
  }

  flash(ctx, x, y) {
    ctx.fillStyle = 'rgba(255,80,60,0.6)';
    ctx.beginPath();
    ctx.arc(x, y, 4 * this.cam.zoom, 0, Math.PI * 2);
    ctx.fill();
  }

  // A building going up: its foundations, then the walls rising behind
  // scaffold poles.
  drawConstruction(ctx, key, p, b) {
    const z = this.cam.zoom;
    this.diamond(ctx, b.x, b.y, b.w, b.h, 'rgba(120,85,50,0.45)', 'rgba(90,60,30,0.8)');
    const box = this.atlas.box(key, p.x, p.y, z);
    if (box) {
      const k = Math.max(0, Math.min(1, b.built));
      const bottom = box.top + box.h;
      const cut = bottom - box.h * k;
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.left - 2, cut, box.w + 4, bottom - cut + 2);
      ctx.clip();
      ctx.globalAlpha = 0.9;
      this.atlas.draw(ctx, key, p.x, p.y, z);
      ctx.restore();
    }
    ctx.strokeStyle = '#7a5634';
    ctx.lineWidth = Math.max(1, 2 * z);
    for (const [dx, dy] of [[0, 0], [b.w, 0], [b.w, b.h], [0, b.h]]) {
      const a = this.tileToScreen(b.x + dx, b.y + dy);
      const top = this.tileToScreen(b.x + dx, b.y + dy, 0.9);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
    }
  }

  // A tree going over, pivoting on its foot away from the axe.
  drawFalling(ctx, key, p, f) {
    const k = Math.min(1, f.t / f.dur);
    const away = (f.x0 - f.x1) - (f.y0 - f.y1);
    const ang = (away >= 0 ? 1 : -1) * Math.min(1.45, k * k * 1.6);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    this.atlas.draw(ctx, key, 0, 0, this.cam.zoom);
    ctx.restore();
  }

  drawFlames(ctx, x, y, r, t, n) {
    const z = this.cam.zoom;
    for (let k = 0; k < n; k++) {
      const p = this.tileToScreen(x + (k - (n - 1) / 2) * r, y + Math.sin(k * 2.1) * r * 0.5);
      const flick = 0.75 + Math.sin(t * 13 + k * 3) * 0.15 + Math.sin(t * 21 + k) * 0.1;
      const h = 22 * z * flick * (n > 1 ? 1.4 : 1);
      const w = 8 * z;
      const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y - h);
      g.addColorStop(0, 'rgba(255,240,150,0.95)');
      g.addColorStop(0.45, 'rgba(255,150,30,0.85)');
      g.addColorStop(1, 'rgba(200,40,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(p.x - w, p.y);
      ctx.quadraticCurveTo(p.x - w * 0.6, p.y - h * 0.5, p.x + Math.sin(t * 9 + k) * 3 * z, p.y - h);
      ctx.quadraticCurveTo(p.x + w * 0.6, p.y - h * 0.5, p.x + w, p.y);
      ctx.closePath();
      ctx.fill();
      // Smoke drifting up.
      for (let j = 0; j < 3; j++) {
        const ph = (t * 0.35 + j / 3 + k * 0.2) % 1;
        ctx.fillStyle = `rgba(120,120,120,${0.25 * (1 - ph)})`;
        ctx.beginPath();
        ctx.arc(p.x + ph * 14 * z + Math.sin(t + j) * 3 * z, p.y - h - ph * 40 * z, (4 + ph * 10) * z, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawFx(ctx, f) {
    const z = this.cam.zoom;
    const k = Math.min(1, f.t / f.dur);
    if (f.kind === 'treefall') return;
    const a = this.tileToScreen(f.x0, f.y0, 0.5);
    const b = this.tileToScreen(f.x1, f.y1, 0.3);
    const x = a.x + (b.x - a.x) * k;
    const lift = Math.sin(k * Math.PI) * (f.kind === 'ball' ? 30 : 12) * z;
    const y = a.y + (b.y - a.y) * k - lift;
    if (f.kind === 'arrow') {
      const ang = Math.atan2(b.y - a.y - Math.cos(k * Math.PI) * 12 * z * -1, b.x - a.x);
      ctx.strokeStyle = '#3b2a1a';
      ctx.lineWidth = Math.max(1, 1.2 * z);
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(ang) * 8 * z, y - Math.sin(ang) * 8 * z);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (f.kind === 'ball') {
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(x, y, 3 * z, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.kind === 'shot') {
      ctx.strokeStyle = `rgba(255,230,150,${1 - k})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  drawPoi(ctx, p, t) {
    const z = this.cam.zoom;
    const bob = Math.sin(t * 3) * 3 * z;
    ctx.fillStyle = 'rgba(255,224,102,0.9)';
    ctx.strokeStyle = '#3a2a10';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 26 * z + bob, 9 * z, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3a2a10';
    ctx.font = `bold ${Math.round(12 * z)}px Manrope, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', p.x, p.y - 26 * z + bob + 1);
  }

  // The guide's arrow over what it is talking about; at the screen's edge if
  // that is out of sight.
  drawPointer(ctx, pt, t) {
    const p = this.tileToScreen(pt.x, pt.y, pt.z ?? 1.2);
    const bob = Math.sin(t * 5) * 6;
    // Keep clear of the guide (top left) and the build bar (bottom).
    const guide = document.getElementById('objectives');
    const gr = guide && !guide.hidden ? guide.getBoundingClientRect() : null;
    const left = gr && gr.right < this.w * 0.6 ? gr.right + 24 : 34;
    const top = 90;
    const right = this.w - 34;
    const bottom = this.h - (this.w < 760 ? 120 : 190);
    const inside = p.x > 34 && p.x < right && p.y > top - 40 && p.y < this.h - 30;
    ctx.save();
    if (inside) {
      ctx.translate(p.x, p.y - 18 + bob);
    } else {
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      const a = Math.atan2(p.y - cy, p.x - cx);
      const rx = (right - left) / 2;
      const ry = (bottom - top) / 2;
      const k = Math.min(rx / Math.abs(Math.cos(a) || 1e-6), ry / Math.abs(Math.sin(a) || 1e-6));
      ctx.translate(cx + Math.cos(a) * k, cy + Math.sin(a) * k);
      ctx.rotate(a - Math.PI / 2);
    }
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(-13, -4);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-5, -22);
    ctx.lineTo(5, -22);
    ctx.lineTo(5, -4);
    ctx.lineTo(13, -4);
    ctx.closePath();
    ctx.fillStyle = '#ffd34d';
    ctx.strokeStyle = '#3a2405';
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (inside && pt.ring) this.ellipse(this.ctx, pt.x, pt.y, 0.55 + Math.sin(t * 5) * 0.08, 'rgba(255,211,77,0.9)');
  }

  drawGhost(ctx, g) {
    const z = this.cam.zoom;
    for (const tile of g.tiles) this.diamond(ctx, tile.x, tile.y, g.w, g.h, tile.ok ? 'rgba(46,204,113,0.38)' : 'rgba(231,76,60,0.42)', tile.ok ? 'rgba(46,204,113,0.9)' : 'rgba(231,76,60,0.9)');
    if (g.demolish) {
      for (const id of g.ids || []) {
        const b = this.st.byId.get(id);
        if (b) this.diamond(ctx, b.x, b.y, b.w, b.h, 'rgba(231,76,60,0.35)', '#e74c3c');
      }
      return;
    }
    if (g.tiles.length === 1 && g.type) {
      const tile = g.tiles[0];
      const def = BUILDINGS[g.type];
      const fake = { type: g.type, w: g.w, h: g.h, level: this.st.flags.mud && g.type === 'hut' ? 2 : 1, mud: !!this.st.flags.mud && !!def.mudBricks, growth: 0.7, x: tile.x, y: tile.y };
      const key = def.wall ? `w/${g.type}/3` : def.gate ? `w/gate/h/e${this.st.era >= 2 ? 2 : 0}` : this.buildingKey(fake);
      const p = this.tileToScreen(tile.x, tile.y);
      ctx.globalAlpha = 0.7;
      this.atlas.draw(ctx, key, p.x, p.y, z);
      ctx.globalAlpha = 1;
      const radius = def.tower?.range || def.job?.radius;
      if (radius && radius < 30) this.ellipse(ctx, tile.x + g.w / 2, tile.y + g.h / 2, radius / Math.SQRT2, 'rgba(255,255,255,0.45)');
    }
  }

  drawWater(ctx, minX, minY, maxX, maxY, t) {
    const st = this.st;
    const z = this.cam.zoom;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(1, 1.2 * z);
    ctx.beginPath();
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const i = y * st.W + x;
        if (!isWater(st.terrain[i]) || !st.explored[i]) continue;
        const h = hash2(x, y, 5);
        if (h > 0.55) continue;
        const ph = (t * 0.25 + h * 3) % 1;
        const p = this.tileToScreen(x + 0.2 + h, y + ph);
        const len = 9 * z * Math.sin(ph * Math.PI);
        ctx.moveTo(p.x - len, p.y);
        ctx.lineTo(p.x + len, p.y);
      }
    }
    ctx.stroke();
  }

  updateFog() {
    const st = this.st;
    if (this.fogVersion === st.visVersion) return;
    this.fogVersion = st.visVersion;
    const g = this.fog.getContext('2d');
    const img = g.createImageData(st.W, st.H);
    const d = img.data;
    for (let i = 0; i < st.W * st.H; i++) {
      d[i * 4] = 10;
      d[i * 4 + 1] = 13;
      d[i * 4 + 2] = 18;
      d[i * 4 + 3] = !st.explored[i] ? 255 : st.visible[i] ? 0 : 80;
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
        if (st.territory[y * W + x] !== 1) continue;
        if (x + 1 >= W || st.territory[y * W + x + 1] !== 1) out.push([x + 1, y, x + 1, y + 1]);
        if (x === 0 || st.territory[y * W + x - 1] !== 1) out.push([x, y, x, y + 1]);
        if (y + 1 >= st.H || st.territory[(y + 1) * W + x] !== 1) out.push([x, y + 1, x + 1, y + 1]);
        if (y === 0 || st.territory[(y - 1) * W + x] !== 1) out.push([x, y, x + 1, y]);
      }
    }
    this.borders = out;
  }

  drawBorders(ctx) {
    if (!this.borders.length) return;
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of this.borders) {
      const a = this.tileToScreen(x0, y0);
      const b = this.tileToScreen(x1, y1);
      if ((a.x < -50 && b.x < -50) || (a.x > this.w + 50 && b.x > this.w + 50) || (a.y < -50 && b.y < -50) || (a.y > this.h + 50 && b.y > this.h + 50)) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.strokeStyle = 'rgba(255,236,170,0.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawTerritory(ctx, minX, minY, maxX, maxY) {
    const st = this.st;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const v = st.territory[y * st.W + x];
        if (v === 2 && st.explored[y * st.W + x]) this.diamond(ctx, x, y, 1, 1, 'rgba(192,57,43,0.18)');
        else if (v === 1) this.diamond(ctx, x, y, 1, 1, 'rgba(255,236,170,0.07)');
      }
    }
  }

  // Pictures for the build bar.
  thumbnails(types) {
    const out = {};
    for (const [type, def] of types) {
      const key = def.wall ? `w/${type}/3` : def.gate ? 'w/gate/h/e0' : this.buildingKey({ type, level: 1, mud: false, growth: 0.7, w: def.w, h: def.h, x: 0, y: 0 });
      const url = this.atlas.thumbnail(key);
      if (url) out[type] = url;
    }
    return out;
  }
}

function treeKey(t, x, y) {
  const h = Math.floor(hash2(x, y, 31) * 97);
  switch (t) {
    case T.FOREST:
      return `f/forest/${h % 6}`;
    case T.SAVANNA:
      return `f/savanna/${h % 4}`;
    case T.MANGROVE:
      return `f/mangrove/${h % 3}`;
    default:
      return `f/grass/${h % 4}`;
  }
}
