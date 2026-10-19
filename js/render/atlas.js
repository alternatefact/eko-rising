// The baked sprite sheets (art/iso, made by tools/bake): every building,
// tree, animal and person, seen from the game's fixed isometric angle.
// Sprites are stored at twice the zoom-1 size; a half-size copy of each
// sheet is made on load so zoomed-out views stay smooth. Buildings seen from
// the other three sides sit on sheets of their own, loaded the first time the
// view is turned.

const BASE = 'art/iso/';

export class Atlas {
  constructor() {
    this.ready = false;
    this.meta = null;
    this.full = [];
    this.half = [];
    this.read = [];
  }

  async load() {
    const res = await fetch(`${BASE}sprites.json`);
    this.meta = await res.json();
    this.sprites = this.meta.sprites;
    const n = this.meta.sheets.length;
    this.first = this.meta.lazyFrom ?? n;
    this.full = new Array(n).fill(null);
    this.half = new Array(n).fill(null);
    await Promise.all(this.meta.sheets.slice(0, this.first).map((name, k) => this.loadSheet(k)));
    this.ready = true;
    return this;
  }

  async loadSheet(k) {
    const img = await loadImage(BASE + this.meta.sheets[k]);
    const c = document.createElement('canvas');
    c.width = Math.ceil(img.width / 2);
    c.height = Math.ceil(img.height / 2);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    this.full[k] = img;
    this.half[k] = c;
  }

  // The sheets not loaded at the start: buildings from the other sides.
  loadLazy() {
    if (this.lazy || !this.meta) return this.lazy;
    const ks = [];
    for (let k = this.first; k < this.meta.sheets.length; k++) ks.push(k);
    this.lazy = Promise.all(ks.map((k) => this.loadSheet(k).catch(() => null)));
    return this.lazy;
  }

  has(key) {
    return !!this.sprites?.[key];
  }

  // Is the sheet with this sprite on it loaded?
  loaded(key) {
    const s = this.sprites?.[key];
    return !!s && !!this.full[s[0]];
  }

  // Draw sprite `key` with its anchor at (x, y) on screen, at game zoom
  // `zoom` (sprites are stored at zoom 2), optionally mirrored left to right
  // and washed with a `tint` colour (a stand-in look for people who have no
  // model of their own yet). Returns the screen box it covers.
  draw(ctx, key, x, y, zoom, mirror = false, tint = null) {
    const s = this.sprites[key];
    if (!s) return null;
    let [sheet, sx, sy, w, h, ax, ay] = s;
    if (!this.full[sheet]) return null;
    const k = zoom / 2;
    const half = zoom <= 1;
    let img = half ? this.half[sheet] : this.full[sheet];
    let f = half ? 0.5 : 1;
    if (tint) {
      img = this.tinted(key, half, tint);
      sx = 0;
      sy = 0;
      f = half ? 0.5 : 1;
    }
    const dw = w * k;
    const dh = h * k;
    const top = y - ay * k;
    if (mirror) {
      ctx.save();
      ctx.translate(x, top);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx * f, sy * f, w * f, h * f, -ax * k, 0, dw, dh);
      ctx.restore();
      return { left: x - (w - ax) * k, top, w: dw, h: dh };
    }
    ctx.drawImage(img, sx * f, sy * f, w * f, h * f, x - ax * k, top, dw, dh);
    return { left: x - ax * k, top, w: dw, h: dh };
  }

  // A sprite washed with a colour, cut out of its sheet once and kept.
  tinted(key, half, tint) {
    this.tints = this.tints || new Map();
    const id = `${key}|${half ? 'h' : 'f'}|${tint}`;
    let c = this.tints.get(id);
    if (c) return c;
    const [sheet, sx, sy, w, h] = this.sprites[key];
    const f = half ? 0.5 : 1;
    const img = half ? this.half[sheet] : this.full[sheet];
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * f));
    c.height = Math.max(1, Math.ceil(h * f));
    const g = c.getContext('2d');
    g.drawImage(img, sx * f, sy * f, w * f, h * f, 0, 0, w * f, h * f);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = tint;
    g.fillRect(0, 0, c.width, c.height);
    this.tints.set(id, c);
    return c;
  }

  // The screen box a sprite would cover, without drawing it.
  box(key, x, y, zoom, mirror = false) {
    const s = this.sprites[key];
    if (!s) return null;
    const [, , , w, h, ax, ay] = s;
    const k = zoom / 2;
    return { left: mirror ? x - (w - ax) * k : x - ax * k, top: y - ay * k, w: w * k, h: h * k };
  }

  // Is the sprite solid at screen point (px, py), when drawn at (x, y)?
  solidAt(key, x, y, zoom, mirror, px, py) {
    const s = this.sprites[key];
    if (!s) return false;
    const [sheet, sx, sy, w, h, ax, ay] = s;
    if (!this.full[sheet]) return false;
    const k = zoom / 2;
    let u = (px - x) / k;
    if (mirror) u = -u;
    const lx = Math.floor(u + ax);
    const ly = Math.floor((py - y) / k + ay);
    if (lx < 0 || ly < 0 || lx >= w || ly >= h) return false;
    if (!this.read[sheet]) {
      const c = document.createElement('canvas');
      const img = this.full[sheet];
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      this.read[sheet] = g;
    }
    return this.read[sheet].getImageData(sx + lx, sy + ly, 1, 1).data[3] > 40;
  }

  // A picture of one sprite fitted into a size x size square, for the build bar.
  thumbnail(key, size = 96) {
    const s = this.sprites[key];
    if (!s) return null;
    const [sheet, sx, sy, w, h] = s;
    if (!this.full[sheet]) return null;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    const k = Math.min((size - 6) / w, (size - 6) / h);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(this.full[sheet], sx, sy, w, h, (size - w * k) / 2, (size - h * k) / 2, w * k, h * k);
    return c.toDataURL();
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}
