// Trees, palms, mangroves, bushes, rocks and grass. The map is cut into
// chunks; each chunk draws every plant of a kind in one instanced batch, so
// only the chunks on screen cost anything and a felled tree only rebuilds
// its own chunk. Leaves, fronds and grass sway in the wind.

import * as THREE from '../vendor/three.module.js';
import { T, F } from '../world/terrain.js';
import { hash2 } from '../core/rng.js';
import { withFog, withSway, artTexture, REAL } from './materials.js';
import { natureArt } from '../data/art.js';

const CHUNK = 16;

// --- Building template geometries ---------------------------------------------------

// Collects triangles from simple shapes into one geometry with colours,
// texture coordinates and a sway weight per vertex.
class Shape {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.sway = [];
  }

  // `opts.normal(p)` may supply smooth normals; `opts.uv(p, n)` texture
  // coordinates; `opts.color(p)` a colour; `opts.sway(p)` a sway weight.
  add(geometry, matrix, opts = {}) {
    const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const uv = g.attributes.uv;
    const v = new THREE.Vector3();
    const nv = new THREE.Vector3();
    const c = new THREE.Color();
    // Box-project the texture per triangle (`opts.box` = repeats per unit),
    // so it never stretches into streaks down the sides.
    const tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const fn = new THREE.Vector3();
    let axis = 1;
    for (let i = 0; i < p.count; i++) {
      if (opts.box && i % 3 === 0) {
        for (let j = 0; j < 3; j++) {
          tri[j].fromBufferAttribute(p, i + j);
          if (opts.displace) opts.displace(tri[j]);
        }
        fn.subVectors(tri[1], tri[0]).cross(new THREE.Vector3().subVectors(tri[2], tri[0]));
        const ax = Math.abs(fn.x);
        const ay = Math.abs(fn.y);
        const az = Math.abs(fn.z);
        axis = ax > ay && ax > az ? 0 : ay > az ? 1 : 2;
      }
      v.fromBufferAttribute(p, i);
      if (opts.displace) opts.displace(v);
      nv.fromBufferAttribute(n, i);
      if (opts.normal) opts.normal(v, nv);
      this.pos.push(v.x, v.y, v.z);
      this.nor.push(nv.x, nv.y, nv.z);
      if (opts.box) {
        const k = opts.box;
        if (axis === 0) this.uv.push(v.z * k, v.y * k);
        else if (axis === 1) this.uv.push(v.x * k, v.z * k);
        else this.uv.push(v.x * k, v.y * k);
      } else if (opts.uv) {
        const [a, b] = opts.uv(v, nv, i);
        this.uv.push(a, b);
      } else if (uv) {
        this.uv.push(uv.getX(i), uv.getY(i));
      } else {
        this.uv.push(0, 0);
      }
      if (opts.color) opts.color(v, c, nv);
      else c.set(opts.tint || '#ffffff');
      this.col.push(c.r, c.g, c.b);
      this.sway.push(opts.sway ? opts.sway(v) : 0);
    }
    g.dispose();
    return this;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sway, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const V = new THREE.Vector3();
const S = new THREE.Vector3();
function mat(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  E.set(rx, ry, rz);
  Q.setFromEuler(E);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), Q, new THREE.Vector3(sx, sy, sz));
}

function rnd(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A lumpy noise for organic shapes, stable for a given point.
function lump(v, amp, f = 6.1) {
  const n = Math.sin(v.x * f + v.y * 3.7) * Math.cos(v.z * f - v.y * 2.3) + Math.sin((v.x + v.z) * f * 0.6);
  return 1 + n * amp;
}

// A puffy canopy: several lumpy balls, each shaded like a sphere, darker
// underneath. Planar texture coordinates let the leaf texture repeat.
function canopy(shape, blobs, opts = {}) {
  const ball = new THREE.IcosahedronGeometry(1, opts.detail ?? 1);
  const top = Math.max(...blobs.map((b) => b[1] + b[3]));
  const bottom = Math.min(...blobs.map((b) => b[1] - b[3]));
  for (const [x, y, z, r] of blobs) {
    const center = new THREE.Vector3(x, y, z);
    shape.add(ball, mat(x, y, z, 0, 0, 0, r, r * (opts.squash || 1), r), {
      displace: (v) => {
        const d = v.clone().sub(center);
        v.copy(center).add(d.multiplyScalar(lump(v, 0.09)));
      },
      normal: (v, n) => n.copy(v).sub(center).normalize(),
      box: 1.1,
      color: (v, c) => {
        const k = (v.y - bottom) / Math.max(0.01, top - bottom);
        c.setRGB(0.55 + k * 0.5, 0.6 + k * 0.45, 0.5 + k * 0.4);
      },
      sway: (v) => Math.max(0, v.y - bottom * 0.5) * 0.9,
    });
  }
}

// A life-like crown: photographic leaf clusters on cards set around a dome,
// each lit as if it were part of one round crown.
function cardCrown(shape, { center, radius, cards, squash = 1, size = 1, flat = 0, seed = 1 }) {
  const r = rnd(seed);
  const c = new THREE.Vector3(...center);
  const plane = new THREE.PlaneGeometry(1, 1);
  for (let k = 0; k < cards; k++) {
    // Spread over the upper part of a sphere, most cards near the top.
    const u = r() * Math.PI * 2;
    const v = Math.acos(1 - r() * 1.55);
    const dir = new THREE.Vector3(Math.sin(v) * Math.cos(u), Math.cos(v) * squash, Math.sin(v) * Math.sin(u)).normalize();
    const pos = c.clone().add(dir.clone().multiplyScalar(radius * (0.55 + r() * 0.3)));
    const s = radius * size * (0.95 + r() * 0.5);
    // Face outward, tipped toward the sky for flat crowns, with a random twist.
    const face = dir.clone().lerp(new THREE.Vector3(0, 1, 0), flat).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), face);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), r() * Math.PI * 2));
    const m = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(s, s, s));
    const top = c.y + radius * squash;
    const bottom = c.y - radius * squash;
    shape.add(plane, m, {
      normal: (p, n) => n.copy(p).sub(c).normalize().lerp(new THREE.Vector3(0, 1, 0), 0.25).normalize(),
      color: (p, col) => {
        const t = Math.min(1, Math.max(0, (p.y - bottom) / Math.max(0.01, top - bottom)));
        col.setRGB(0.62 + t * 0.45, 0.62 + t * 0.45, 0.6 + t * 0.4);
      },
      sway: (p) => Math.max(0, p.y - bottom * 0.5) * 0.9,
    });
  }
}

function trunk(shape, h, r0, r1, branches = 2, seed = 1) {
  const r = rnd(seed);
  const barkUv = (v, n) => [Math.atan2(n.x, n.z) / Math.PI + 1, v.y * 2.2];
  const bark = { uv: barkUv, color: (v, c) => c.setRGB(0.75 + v.y * 0.2, 0.75 + v.y * 0.2, 0.75 + v.y * 0.2), sway: (v) => v.y * 0.15 };
  shape.add(new THREE.CylinderGeometry(r1, r0, h, 6, 2).translate(0, h / 2, 0), new THREE.Matrix4(), {
    ...bark,
    displace: (v) => {
      v.x += Math.sin(v.y * 4 + seed) * 0.02;
      v.z += Math.cos(v.y * 3 + seed) * 0.02;
    },
  });
  // Root flare at the base.
  shape.add(new THREE.CylinderGeometry(r0, r0 * 1.9, 0.12, 7).translate(0, 0.06, 0), new THREE.Matrix4(), bark);
  for (let k = 0; k < branches; k++) {
    const a = r() * Math.PI * 2;
    const len = h * (0.35 + r() * 0.2);
    shape.add(
      new THREE.CylinderGeometry(r1 * 0.45, r1 * 0.8, len, 5).translate(0, len / 2, 0),
      mat(0, h * (0.55 + r() * 0.3), 0, Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9),
      bark,
    );
  }
}

// One palm frond: a long strip bent down under its own weight, with the
// frond image (stem along the strip) cut out by alpha.
function frond(shape, angle, droop, len, lift = 0.25) {
  const seg = 7;
  const w = len * 0.42;
  const g = new THREE.PlaneGeometry(w, len, 1, seg);
  g.translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = y / len;
    // Arc out and down; a slight V-fold across the width.
    const out = Math.sin(t * Math.PI * 0.5 + lift) * len * 0.92;
    const up = Math.cos(t * Math.PI * 0.5 * droop + lift * 0.5) * len * 0.35 - t * t * len * droop * 0.55;
    p.setXYZ(i, p.getX(i), up, out + 0);
    p.setY(i, up + Math.abs(p.getX(i)) * 0.25);
  }
  g.computeVertexNormals();
  shape.add(g, mat(0, 0, 0, 0, angle, 0), {
    color: (v, c) => c.setRGB(0.85, 0.95, 0.8),
    sway: (v) => Math.min(1.4, Math.hypot(v.x, v.z) * 1.3),
    normal: (v, n) => n.set(0, 1, 0),
  });
}

function buildTemplates(mobile) {
  return REAL ? realTemplates(mobile) : cartoonTemplates(mobile);
}

function realTemplates(mobile) {
  const T2 = {};
  const n = (k) => Math.max(5, Math.round(k * (mobile ? 0.6 : 1)));
  T2.trunk = new Shape();
  trunk(T2.trunk, 0.8, 0.065, 0.045, 3, 3);
  T2.crownA = new Shape();
  cardCrown(T2.crownA, { center: [0, 1.0, 0], radius: 0.48, cards: n(16), seed: 4 });
  T2.crownB = new Shape();
  cardCrown(T2.crownB, { center: [0, 1.08, 0], radius: 0.42, cards: n(14), squash: 1.2, seed: 8 });
  T2.savTrunk = new Shape();
  trunk(T2.savTrunk, 0.72, 0.05, 0.035, 3, 7);
  T2.savCrown = new Shape();
  cardCrown(T2.savCrown, { center: [0, 0.82, 0], radius: 0.62, cards: n(11), squash: 0.3, flat: 0.75, size: 1.05, seed: 6 });
  T2.roots = new Shape();
  {
    const r = rnd(11);
    trunk(T2.roots, 0.35, 0.05, 0.045, 0, 5);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + r() * 0.5;
      T2.roots.add(new THREE.TorusGeometry(0.2, 0.014, 3, 6, Math.PI * 0.75), mat(Math.cos(a) * 0.17, 0.02, Math.sin(a) * 0.17, 0, -a + Math.PI / 2, 0), {
        uv: (v) => [v.x * 3, v.y * 3],
        color: (v, c) => c.setRGB(0.7, 0.66, 0.6),
      });
    }
  }
  T2.mangroveCrown = new Shape();
  cardCrown(T2.mangroveCrown, { center: [0, 0.58, 0], radius: 0.4, cards: n(12), squash: 0.7, seed: 9 });
  T2.bush = new Shape();
  cardCrown(T2.bush, { center: [0, 0.16, 0], radius: 0.24, cards: n(6), size: 1.3, seed: 2 });
  T2.palmTrunk = cartoonPalmTrunk();
  T2.palmCrown = palmCrown();
  T2.palmFruit = palmFruit();
  T2.rocks = rocks();
  T2.grass = grassTuft();
  const out = {};
  for (const [k, s] of Object.entries(T2)) out[k] = s.geometry();
  return out;
}

function cartoonTemplates(mobile) {
  const T2 = {};
  const detail = mobile ? 0 : 1;
  // Rainforest trees: a bark trunk and a big puffy crown (two variants).
  T2.trunk = new Shape();
  trunk(T2.trunk, 0.75, 0.07, 0.05, 2, 3);
  T2.crownA = new Shape();
  canopy(T2.crownA, [[0, 0.95, 0, 0.38], [0.24, 0.82, 0.1, 0.28], [-0.21, 0.86, -0.08, 0.29], [0.04, 1.2, -0.04, 0.27]], { detail });
  T2.crownB = new Shape();
  canopy(T2.crownB, [[0, 1.0, 0, 0.32], [0.16, 1.26, 0.04, 0.24], [-0.16, 0.92, 0.12, 0.26], [0.1, 0.86, -0.18, 0.24]], { detail });
  // Savanna tree: thin trunk, flat spreading crown.
  T2.savTrunk = new Shape();
  trunk(T2.savTrunk, 0.7, 0.05, 0.035, 3, 7);
  T2.savCrown = new Shape();
  canopy(T2.savCrown, [[0, 0.82, 0, 0.42], [0.32, 0.78, 0.1, 0.3], [-0.3, 0.8, -0.12, 0.3], [0.05, 0.86, 0.3, 0.26]], { squash: 0.38, detail });
  // Mangrove: arching stilt roots under a low dark crown.
  T2.roots = new Shape();
  {
    const r = rnd(11);
    trunk(T2.roots, 0.35, 0.05, 0.045, 0, 5);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + r() * 0.5;
      const arc = new THREE.TorusGeometry(0.2, 0.014, 3, 6, Math.PI * 0.75);
      T2.roots.add(arc, mat(Math.cos(a) * 0.17, 0.02, Math.sin(a) * 0.17, 0, -a + Math.PI / 2, 0), {
        uv: (v) => [v.x * 3, v.y * 3],
        color: (v, c) => c.setRGB(0.7, 0.66, 0.6),
      });
    }
  }
  T2.mangroveCrown = new Shape();
  canopy(T2.mangroveCrown, [[0, 0.55, 0, 0.3], [0.22, 0.5, 0.05, 0.22], [-0.2, 0.52, -0.06, 0.23], [0.02, 0.62, 0.22, 0.2]], { squash: 0.75, detail });
  // Bush.
  T2.bush = new Shape();
  canopy(T2.bush, [[0, 0.14, 0, 0.17], [0.13, 0.1, 0.05, 0.12], [-0.11, 0.11, -0.04, 0.13]], { detail: 0 });
  T2.palmTrunk = cartoonPalmTrunk();
  T2.palmCrown = palmCrown();
  T2.palmFruit = palmFruit();
  T2.rocks = rocks();
  T2.grass = grassTuft();
  const out = {};
  for (const [k, s] of Object.entries(T2)) out[k] = s.geometry();
  return out;
}

// Oil palm: ringed, slightly curved trunk; a crown of drooping fronds.
function cartoonPalmTrunk() {
  const shape = new Shape();
  {
    const h = 1.05;
    const g = new THREE.CylinderGeometry(0.045, 0.06, h, 8, 10).translate(0, h / 2, 0);
    shape.add(g, new THREE.Matrix4(), {
      displace: (v) => {
        const t = v.y / h;
        v.x += t * t * 0.12;
        const ring = 1 + 0.18 * Math.abs(Math.sin(v.y * 34));
        v.x *= ring;
        v.z *= ring;
      },
      uv: (v, n) => [Math.atan2(n.x, n.z) / Math.PI + 1, v.y * 2.5],
      color: (v, c) => c.setRGB(0.85, 0.78, 0.66),
      sway: (v) => (v.y / h) * 0.35,
    });
  }
  return shape;
}

function palmCrown() {
  const shape = new Shape();
  {
    const r = rnd(5);
    const top = new THREE.Vector3(0.12, 1.05, 0);
    const crown = new Shape();
    for (let k = 0; k < 11; k++) frond(crown, (k / 11) * Math.PI * 2 + r() * 0.3, 0.9 + r() * 0.5, 0.55 + r() * 0.15, 0.1 + r() * 0.4);
    for (let k = 0; k < 3; k++) frond(crown, r() * Math.PI * 2, 0.2, 0.42, 1.0);
    const g = crown.geometry();
    g.translate(top.x, top.y, top.z);
    shape.add(g, new THREE.Matrix4(), {
      color: (v, c) => c.setRGB(0.85, 0.95, 0.8),
      sway: (v) => Math.min(1.6, Math.hypot(v.x - top.x, v.z - top.z) * 1.6 + 0.2),
      normal: (v, n) => n.set(0, 1, 0),
    });
  }
  return shape;
}

function palmFruit() {
  const shape = new Shape();
  {
    const ball = new THREE.IcosahedronGeometry(0.035, 0);
    const r = rnd(9);
    for (let k = 0; k < 5; k++) {
      const a = r() * Math.PI * 2;
      shape.add(ball, mat(0.12 + Math.cos(a) * 0.05, 0.98 + r() * 0.05, Math.sin(a) * 0.05), {
        color: (v, c) => c.set(k % 3 ? '#c0392b' : '#e67e22'),
      });
    }
  }
  return shape;
}

// A cluster of three weathered rocks.
function rocks() {
  const shape = new Shape();
  {
    const r = rnd(3);
    for (let k = 0; k < 3; k++) {
      const s = 0.13 + r() * 0.1;
      const c = new THREE.Vector3((r() - 0.5) * 0.5, s * 0.35, (r() - 0.5) * 0.5);
      shape.add(new THREE.DodecahedronGeometry(1, 0), mat(c.x, c.y, c.z, r(), r() * 3, r(), s * (1.1 + r() * 0.4), s * 0.75, s), {
        displace: (v) => v.multiplyScalar(1 + (lump(v, 0.12, 9) - 1)),
        box: 2.2,
        color: (v, cc) => {
          const k2 = Math.min(1, Math.max(0, (v.y + 0.05) / 0.3));
          cc.setRGB(0.65 + k2 * 0.4, 0.65 + k2 * 0.4, 0.62 + k2 * 0.4);
        },
      });
    }
  }
  return shape;
}

// A grass tuft: thin blades, dark at the root and light at the tip.
function grassTuft() {
  const shape = new Shape();
  {
    const r = rnd(21);
    for (let k = 0; k < 7; k++) {
      const a = r() * Math.PI * 2;
      const h = 0.11 + r() * 0.12;
      const lean = 0.25 + r() * 0.35;
      const ox = Math.cos(a) * 0.05 * r();
      const oz = Math.sin(a) * 0.05 * r();
      const tri = new THREE.BufferGeometry();
      tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.014, 0, 0, 0.014, 0, 0, 0, h, 0], 3));
      tri.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
      shape.add(tri, mat(ox, 0, oz, lean * Math.cos(a), a, lean * Math.sin(a)), {
        color: (v, c) => {
          const t = Math.min(1, v.y / 0.2);
          c.setRGB(0.55 + t * 0.6, 0.6 + t * 0.55, 0.45 + t * 0.4);
        },
        sway: (v) => Math.min(1, v.y / 0.18) ** 2 * 1.6,
      });
    }
  }
  return shape;
}

// --- Materials ------------------------------------------------------------------------

let gradient = null;
function toonGradient() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

function swayToon(map, opts = {}) {
  const params = {
    color: '#ffffff',
    vertexColors: true,
    map,
    alphaTest: opts.alphaTest || 0,
    side: opts.double ? THREE.DoubleSide : THREE.FrontSide,
  };
  const m = REAL ? new THREE.MeshLambertMaterial(params) : new THREE.MeshToonMaterial({ ...params, gradientMap: toonGradient() });
  withFog(m, (shader) => {
    withSway(shader);
    if (opts.double) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);');
  });
  m.customProgramCacheKey = () => `flora-${opts.key}`;
  return m;
}

function grassMaterial() {
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide });
  withFog(m, (shader) => {
    withSway(shader);
    // Blades are lit like the ground beneath them, from either side.
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);');
  });
  m.customProgramCacheKey = () => 'flora-grass';
  return m;
}

// Which material and shadow behaviour each template uses.
function kinds() {
  const art = (name, color, opts) => artTexture(natureArt(name, REAL), color, opts);
  const bark = swayToon(art('bark', '#6b5440'), { key: 'bark' });
  const frondTex = art('frond', '#3c7a32', { repeat: false });
  const fronds = swayToon(frondTex, { key: 'frond', alphaTest: 0.45, double: true });
  const plain = swayToon(null, { key: 'plain' });
  const rock = swayToon(art('rock', '#8a7c68'), { key: 'rock' });
  const depth = (t) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.45 });
  const frondDepth = depth(frondTex);
  const grass = grassMaterial();
  // Crowns: leaf-cluster cards for the realistic look, a leafy texture on round crowns for the cartoon one.
  let leaves;
  let acacia;
  let bush;
  let crownDepth = null;
  let acaciaDepth = null;
  let bushDepth = null;
  if (REAL) {
    const lt = art('leafcluster', '#3f6a2e', { repeat: false });
    const at = art('acacia', '#6b7a3a', { repeat: false });
    const bt = art('bush', '#3f6a2e', { repeat: false });
    leaves = swayToon(lt, { key: 'leafcard', alphaTest: 0.5, double: true });
    acacia = swayToon(at, { key: 'acaciacard', alphaTest: 0.45, double: true });
    bush = swayToon(bt, { key: 'bushcard', alphaTest: 0.5, double: true });
    crownDepth = depth(lt);
    acaciaDepth = depth(at);
    bushDepth = depth(bt);
  } else {
    leaves = swayToon(artTexture('art/tex/leaves.webp', '#3f7a2e'), { key: 'leaves' });
    acacia = leaves;
    bush = leaves;
  }
  return {
    trunk: { mat: bark, shadow: true },
    crownA: { mat: leaves, shadow: true, depth: crownDepth },
    crownB: { mat: leaves, shadow: true, depth: crownDepth },
    savTrunk: { mat: bark, shadow: true },
    savCrown: { mat: acacia, shadow: true, depth: acaciaDepth },
    roots: { mat: bark, shadow: true },
    mangroveCrown: { mat: leaves, shadow: true, depth: crownDepth },
    bush: { mat: bush, shadow: true, depth: bushDepth },
    palmTrunk: { mat: bark, shadow: true },
    palmCrown: { mat: fronds, shadow: true, depth: frondDepth },
    palmFruit: { mat: plain, shadow: false },
    rocks: { mat: rock, shadow: true },
    grass: { mat: grass, shadow: false },
  };
}

// --- The flora of the whole map -------------------------------------------------------

export class Flora {
  constructor(scene, st, groundAt, mobile) {
    this.scene = scene;
    this.st = st;
    this.groundAt = groundAt;
    this.mobile = mobile;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.templates = buildTemplates(mobile);
    this.kinds = kinds();
    this.cw = Math.ceil(st.W / CHUNK);
    this.ch = Math.ceil(st.H / CHUNK);
    this.chunks = new Array(this.cw * this.ch).fill(null);
    this.dirty = new Set();
    for (let k = 0; k < this.chunks.length; k++) this.dirty.add(k);
    this.noGrass = null;
  }

  // Grass is too small to see from far away; skip drawing it then.
  showGrass(on) {
    if (this.grassOn === on) return;
    this.grassOn = on;
    for (const c of this.chunks) if (c) for (const m of c) if (m.userData.grass) m.visible = on;
  }

  dispose() {
    this.scene.remove(this.root);
    for (const c of this.chunks) if (c) for (const m of c) m.dispose();
    for (const g of Object.values(this.templates)) g.dispose();
  }

  // Tiles changed (a tree felled, a building raised): rebuild their chunks.
  touch(i) {
    const x = i % this.st.W;
    const y = (i / this.st.W) | 0;
    this.dirty.add(Math.floor(y / CHUNK) * this.cw + Math.floor(x / CHUNK));
  }

  touchRect(x0, y0, x1, y1) {
    for (let cy = Math.max(0, Math.floor(y0 / CHUNK)); cy <= Math.min(this.ch - 1, Math.floor(y1 / CHUNK)); cy++) {
      for (let cx = Math.max(0, Math.floor(x0 / CHUNK)); cx <= Math.min(this.cw - 1, Math.floor(x1 / CHUNK)); cx++) this.dirty.add(cy * this.cw + cx);
    }
  }

  // Rebuild a few dirty chunks per frame so nothing stutters.
  update(wear, budget = 6) {
    let n = 0;
    for (const k of this.dirty) {
      this.dirty.delete(k);
      this.buildChunk(k, wear);
      if (++n >= budget) break;
    }
  }

  buildChunk(k, wear) {
    const st = this.st;
    const W = st.W;
    const cx = (k % this.cw) * CHUNK;
    const cy = Math.floor(k / this.cw) * CHUNK;
    const lists = {};
    const color = new THREE.Color();
    const put = (kind, x, y, z, ry, sx, sy = sx, sz = sx, tint = '#ffffff', rx = 0, rz = 0) => {
      E.set(rx, ry, rz);
      Q.setFromEuler(E);
      M.compose(V.set(x, y, z), Q, S.set(sx, sy, sz));
      (lists[kind] ||= []).push(M.clone(), color.set(tint).clone());
    };
    const seed = st.seed;
    const grassPer = this.mobile ? { [T.GRASS]: 2, [T.SAVANNA]: 2, [T.FOREST]: 1, [T.SAND]: 0.15, [T.HILL]: 0.5 } : { [T.GRASS]: 5, [T.SAVANNA]: 4, [T.FOREST]: 1.5, [T.SAND]: 0.3, [T.HILL]: 1 };
    for (let y = cy; y < Math.min(st.H, cy + CHUNK); y++) {
      for (let x = cx; x < Math.min(W, cx + CHUNK); x++) {
        const i = y * W + x;
        const t = st.terrain[i];
        const trees = st.trees[i];
        const f = st.feature[i];
        const h = (a, b) => hash2(x + a, y + b, seed + 81 + a * 7);
        if (trees > 0) {
          // Deep in the forest one big crown hides everything under it.
          const deep = t === T.FOREST && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => {
            const j2 = (y + dy) * W + x + dx;
            return x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < st.H && st.trees[j2] > 0;
          });
          const n = t === T.FOREST && trees > 30 && !deep ? 2 : 1;
          for (let j = 0; j < n; j++) {
            const tx = x + 0.2 + h(j, 1) * 0.6;
            const ty = y + 0.2 + h(1, j) * 0.6;
            const gy = this.groundAt(tx, ty);
            const sc = (deep ? 1.35 : t === T.FOREST ? 1.05 : 0.85) + h(j, 3) * 0.5;
            const ry = h(j, 4) * 6.28;
            const shade = h(j, 5);
            if (t === T.SAVANNA) {
              put('savTrunk', tx, gy, ty, ry, sc, sc * 1.1);
              put('savCrown', tx, gy, ty, ry, sc, sc * 1.1, sc, shade < 0.5 ? '#c2c27a' : '#b4b86e');
            } else if (t === T.MANGROVE) {
              put('roots', tx, gy, ty, ry, sc);
              put('mangroveCrown', tx, gy, ty, ry, sc, sc, sc, '#7f9a72');
            } else {
              if (!deep) put('trunk', tx, gy, ty, ry, sc);
              const tint = shade < 0.33 ? '#d0e6b8' : shade < 0.66 ? '#e4f0c8' : '#f4f8d8';
              put(shade < 0.5 ? 'crownA' : 'crownB', tx, gy, ty, ry, sc, sc, sc, tint);
            }
          }
        }
        if (f === F.PALM) {
          const tx = x + 0.5;
          const ty = y + 0.5;
          const gy = this.groundAt(tx, ty);
          const ry = h(9, 9) * 6.28;
          const sc = 1.25 + h(8, 8) * 0.4;
          const lean = (h(7, 7) - 0.5) * 0.25;
          put('palmTrunk', tx, gy, ty, ry, sc, sc, sc, '#ffffff', lean);
          put('palmCrown', tx, gy, ty, ry, sc, sc, sc, h(6, 6) < 0.5 ? '#ffffff' : '#e8f4d0', lean);
          if (st.amount[i] >= 4) put('palmFruit', tx, gy, ty, ry, sc, sc, sc, '#ffffff', lean);
        } else if (f === F.ROCK || f === F.IRON) {
          const tx = x + 0.5;
          const ty = y + 0.5;
          const sc = 0.9 + h(2, 9) * 0.5;
          put('rocks', tx, this.groundAt(tx, ty), ty, h(3, 9) * 6.28, sc, sc, sc, f === F.IRON ? '#c98a6a' : '#ffffff');
        }
        // Bushes at forest edges and scattered over the grass.
        const occupied = st.occ[i] !== 0;
        const worn = wear ? wear[i] > 0.35 : false;
        if (!occupied && !worn && !trees && f !== F.PALM && (t === T.GRASS || t === T.FOREST || t === T.SAVANNA)) {
          const chance = t === T.FOREST ? 0.5 : t === T.GRASS ? 0.07 : 0.04;
          if (h(5, 2) < chance) {
            const bx = x + 0.2 + h(6, 2) * 0.6;
            const by = y + 0.2 + h(2, 6) * 0.6;
            const sc = 0.7 + h(4, 2) * 0.7;
            put('bush', bx, this.groundAt(bx, by), by, h(3, 2) * 6.28, sc, sc, sc, t === T.SAVANNA ? '#d6d08a' : h(1, 2) < 0.5 ? '#ffffff' : '#d8ecbf');
          }
        }
        // Grass tufts.
        const per = grassPer[t] || 0;
        if (per > 0 && !occupied && !worn) {
          const count = Math.floor(per) + (h(11, 3) < per % 1 ? 1 : 0);
          for (let j = 0; j < count; j++) {
            const gx = x + h(j, 13);
            const gz = y + h(13, j);
            const sc = 0.75 + h(j, 17) * 0.6;
            let tint;
            if (t === T.SAVANNA || t === T.HILL) tint = h(j, 19) < 0.5 ? '#c9b46a' : '#b5a35a';
            else if (t === T.SAND) tint = '#a9b46a';
            else tint = h(j, 19) < 0.33 ? '#6f9b3c' : h(j, 19) < 0.66 ? '#5e8c33' : '#84ad48';
            put('grass', gx, this.groundAt(gx, gz), gz, h(j, 23) * 6.28, sc, t === T.SAVANNA ? sc * 1.5 : sc, sc, tint);
          }
        }
      }
    }
    // Replace the chunk's meshes.
    if (this.chunks[k]) {
      for (const m of this.chunks[k]) {
        this.root.remove(m);
        m.dispose();
      }
    }
    const meshes = [];
    for (const [kind, list] of Object.entries(lists)) {
      const n = list.length / 2;
      const info = this.kinds[kind];
      const mesh = new THREE.InstancedMesh(this.templates[kind], info.mat, n);
      for (let j = 0; j < n; j++) {
        mesh.setMatrixAt(j, list[j * 2]);
        mesh.setColorAt(j, list[j * 2 + 1]);
      }
      mesh.castShadow = info.shadow;
      mesh.receiveShadow = true;
      if (info.depth) mesh.customDepthMaterial = info.depth;
      mesh.computeBoundingSphere();
      if (kind === 'grass') {
        mesh.userData.grass = true;
        mesh.visible = this.grassOn !== false;
      }
      this.root.add(mesh);
      meshes.push(mesh);
    }
    this.chunks[k] = meshes;
  }
}
