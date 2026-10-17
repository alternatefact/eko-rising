// The land under everything: painted from life-like ground textures, seen
// from straight above in chunks of 16 x 16 tiles, and drawn turned and
// squashed into the isometric view. Each kind of ground fades into the next;
// footpaths and the trodden earth around buildings show as bare soil.

import { T, F, isWater } from '../world/terrain.js';
import { hash2 } from '../core/rng.js';
import { GROUND } from './palette.js';
import { BUILDINGS } from '../data/buildings.js';

export const CHUNK = 16;
const P = 32; // pixels per tile in a chunk
const N = CHUNK + 2; // a tile of margin all round, so edges blend across chunks
const REPEAT = 3; // tiles per repeat of a ground texture
const MAX_CHUNKS = 48;

// Kinds of ground, painted bottom to top.
const LAYERS = [
  { id: 'water', color: true },
  { id: 'sand', tex: 'sand' },
  { id: 'grass', tex: 'grass' },
  { id: 'savanna', tex: 'savanna' },
  { id: 'forest', tex: 'forest' },
  { id: 'rock', tex: 'rock' },
  { id: 'swamp', tex: 'mud', tint: 'rgba(48,70,30,0.45)' },
  { id: 'clay', tex: 'mud', tint: 'rgba(140,44,18,0.55)' },
  { id: 'earth', tex: 'earth' },
];

function layerOf(st, i) {
  const t = st.terrain[i];
  if (isWater(t)) return 'water';
  if (st.feature[i] === F.CLAY) return 'clay';
  switch (t) {
    case T.SAND:
    case T.FORD:
      return 'sand';
    case T.GRASS:
      return 'grass';
    case T.SAVANNA:
      return 'savanna';
    case T.FOREST:
      return 'forest';
    case T.HILL:
      return 'rock';
    case T.MANGROVE:
      return 'swamp';
    default:
      return 'grass';
  }
}

export class Ground {
  constructor() {
    this.tex = {};
    this.chunks = new Map();
    this.ready = false;
  }

  async load() {
    const names = ['grass', 'forest', 'savanna', 'sand', 'earth', 'mud', 'rock'];
    const imgs = await Promise.all(names.map((n) => loadImage(`art/real/ground/${n}.webp`).catch(() => null)));
    names.forEach((n, k) => (this.tex[n] = imgs[k]));
    this.ready = true;
  }

  attach(st) {
    this.st = st;
    this.chunks.clear();
    this.wear = new Float32Array(st.W * st.H);
    this.footprints = new Map();
    this.updateWear(true);
  }

  // Trodden earth around buildings, recomputed when buildings change.
  updateWear(force) {
    const st = this.st;
    let changed = force;
    const seen = new Set();
    for (const b of st.buildings) {
      if (b.dead) continue;
      seen.add(b.id);
      const key = `${b.x},${b.y},${b.w},${b.h}`;
      if (this.footprints.get(b.id) !== key) {
        this.footprints.set(b.id, key);
        changed = true;
      }
    }
    for (const id of [...this.footprints.keys()]) {
      if (!seen.has(id)) {
        this.footprints.delete(id);
        changed = true;
      }
    }
    if (!changed) return;
    const old = this.wear;
    const wear = new Float32Array(st.W * st.H);
    for (const b of st.buildings) {
      if (b.dead || b.owner !== 'player') continue;
      const def = BUILDINGS[b.type];
      if (def.wall || def.gate || b.type === 'farm' || b.type === 'cassava' || b.type === 'fisher') continue;
      for (let y = b.y - 1; y <= b.y + b.h; y++) {
        for (let x = b.x - 1; x <= b.x + b.w; x++) {
          if (x < 0 || y < 0 || x >= st.W || y >= st.H) continue;
          const inside = x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
          const i = y * st.W + x;
          wear[i] = Math.max(wear[i], inside ? 0.95 : 0.55);
        }
      }
    }
    this.wear = wear;
    if (force) return;
    for (let i = 0; i < wear.length; i++) if (wear[i] !== old[i]) this.touch(i);
  }

  touch(i) {
    const W = this.st.W;
    const x = i % W;
    const y = (i / W) | 0;
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      this.chunks.delete(`${Math.floor((x + dx) / CHUNK)},${Math.floor((y + dy) / CHUNK)}`);
    }
  }

  chunk(cx, cy) {
    const key = `${cx},${cy}`;
    let c = this.chunks.get(key);
    if (c) {
      // Most recently used last.
      this.chunks.delete(key);
      this.chunks.set(key, c);
      return c;
    }
    c = document.createElement('canvas');
    c.width = CHUNK * P;
    c.height = CHUNK * P;
    this.paint(c.getContext('2d'), cx, cy);
    this.chunks.set(key, c);
    if (this.chunks.size > MAX_CHUNKS) this.chunks.delete(this.chunks.keys().next().value);
    return c;
  }

  paint(g, cx, cy) {
    const st = this.st;
    const W = st.W;
    const x0 = cx * CHUNK - 1;
    const y0 = cy * CHUNK - 1;
    const tile = (x, y) => Math.max(0, Math.min(st.H - 1, y)) * W + Math.max(0, Math.min(W - 1, x));
    const masks = {};
    for (const L of LAYERS) masks[L.id] = null;
    const mask = (id) => {
      if (!masks[id]) {
        const m = document.createElement('canvas');
        m.width = N;
        m.height = N;
        masks[id] = { canvas: m, g: m.getContext('2d'), img: m.getContext('2d').createImageData(N, N), any: false };
      }
      return masks[id];
    };
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = tile(x0 + x, y0 + y);
        const set = (id, a) => {
          const m = mask(id);
          m.img.data[(y * N + x) * 4 + 3] = Math.max(m.img.data[(y * N + x) * 4 + 3], a);
          m.any = true;
        };
        const id = layerOf(st, i);
        set(id, 255);
        if (id === 'water') {
          // Water colour: deep sea, lagoon, river.
          const m = mask('water');
          const [r, gg, b] = hexRgb(GROUND[st.terrain[i]][0]);
          const o = (y * N + x) * 4;
          m.img.data[o] = r;
          m.img.data[o + 1] = gg;
          m.img.data[o + 2] = b;
        }
        const worn = Math.max(st.feature[i] === F.PATH ? 0.85 : 0, this.wear[i] || 0);
        if (worn > 0 && id !== 'water') set('earth', Math.round(worn * 255));
      }
    }
    const big = document.createElement('canvas');
    big.width = N * P;
    big.height = N * P;
    const bg = big.getContext('2d');
    g.fillStyle = GROUND[T.GRASS][0];
    g.fillRect(0, 0, CHUNK * P, CHUNK * P);
    for (const L of LAYERS) {
      const m = masks[L.id];
      if (!m || !m.any) continue;
      m.g.putImageData(m.img, 0, 0);
      bg.globalCompositeOperation = 'copy';
      bg.imageSmoothingEnabled = true;
      bg.imageSmoothingQuality = 'high';
      // Each tile's mask sits at its centre, so the blend runs tile to tile.
      bg.drawImage(m.canvas, 0, 0, N, N, 0, 0, N * P, N * P);
      if (L.color) {
        bg.globalCompositeOperation = 'source-over';
      } else {
        bg.globalCompositeOperation = 'source-in';
        const img = this.tex[L.tex];
        if (img) {
          const pat = bg.createPattern(img, 'repeat');
          const k = (REPEAT * P) / img.width;
          pat.setTransform(new DOMMatrix().translate(-((x0 * P) % (REPEAT * P)), -((y0 * P) % (REPEAT * P))).scale(k));
          bg.fillStyle = pat;
        } else {
          bg.fillStyle = GROUND[T.GRASS][0];
        }
        bg.fillRect(0, 0, N * P, N * P);
        if (L.tint) {
          bg.globalCompositeOperation = 'source-atop';
          bg.fillStyle = L.tint;
          bg.fillRect(0, 0, N * P, N * P);
        }
      }
      g.drawImage(big, P, P, CHUNK * P, CHUNK * P, 0, 0, CHUNK * P, CHUNK * P);
    }
    // Red-mud pits: wet and dark in the middle, lumps of dug mud around.
    for (let y = 1; y < N - 1; y++) {
      for (let x = 1; x < N - 1; x++) {
        const tx = x0 + x;
        const ty = y0 + y;
        const i = tile(tx, ty);
        if (st.feature[i] !== F.CLAY) continue;
        const h = hash2(tx, ty, 9);
        const cx = (x - 0.5) * P + (h - 0.5) * 8;
        const cy = (y - 0.5) * P + (hash2(ty, tx, 9) - 0.5) * 8;
        const grad = g.createRadialGradient(cx, cy, 2, cx, cy, P * 0.62);
        grad.addColorStop(0, 'rgba(58,22,10,0.85)');
        grad.addColorStop(0.6, 'rgba(96,36,16,0.55)');
        grad.addColorStop(1, 'rgba(120,50,22,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(cx, cy, P * 0.62, P * 0.5, h * 3, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(150,70,35,0.9)';
        for (let k = 0; k < 3; k++) {
          const a = h * 6 + k * 2.1;
          g.beginPath();
          g.arc(cx + Math.cos(a) * P * 0.45, cy + Math.sin(a) * P * 0.38, 2.5 + k, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // Light and shade in blotches, so the ground never looks stamped out.
    for (let y = 1; y < N - 1; y++) {
      for (let x = 1; x < N - 1; x++) {
        const tx = x0 + x;
        const ty = y0 + y;
        const i = tile(tx, ty);
        if (isWater(st.terrain[i])) continue;
        const h = hash2(tx, ty, st.seed + 17);
        g.fillStyle = h < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,240,200,0.05)';
        g.beginPath();
        g.arc((x - 1 + hash2(tx, ty, 5)) * P, (y - 1 + hash2(ty, tx, 6)) * P, P * (0.4 + h * 0.5), 0, Math.PI * 2);
        g.fill();
      }
    }
  }
}

function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
