// Animated 3D people, soldiers and animals, drawn with instancing so that
// hundreds of them cost a few draw calls. Each body part is one
// InstancedMesh; every frame we pose each figure and write its parts.

import * as THREE from '../vendor/three.module.js';
import { toonInstanced, toonInstancedMap, artTexture, REAL } from './materials.js';

// Life-like figures are smaller beside their houses, as in the classic city-builder games.
const SIZE = REAL ? 1.65 : 2.0;
import { SKIN, CARRY, FOREIGN_COAT } from '../render/palette.js';

export class Pool {
  constructor(scene, geometry, key, capacity = 256, shadow = true, material = null) {
    this.scene = scene;
    this.geometry = geometry;
    this.material = material || toonInstanced(key);
    this.shadow = shadow;
    this.make(capacity);
  }

  make(capacity) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.dispose();
    }
    this.capacity = capacity;
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = this.shadow;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.count = 0;
    this.scene.add(this.mesh);
  }

  begin() {
    this.n = 0;
  }

  add(matrix, color) {
    if (this.n >= this.capacity) this.make(this.capacity * 2);
    this.mesh.setMatrixAt(this.n, matrix);
    this.mesh.setColorAt(this.n, color);
    this.n++;
  }

  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// Geometries with their pivot where the part hinges.
function limb(r1, r2, len, end = 0) {
  const g = new THREE.CylinderGeometry(r1, r2, len, 7);
  g.translate(0, -len / 2, 0);
  if (!end) return g;
  // A rounded hand or foot at the end.
  const b = new THREE.SphereGeometry(end, 7, 5);
  b.translate(0, -len, end * 0.3);
  return merge([g, b]);
}

function merge(list) {
  const pos = [];
  const nor = [];
  const uv = [];
  for (const src of list) {
    const g = src.index ? src.toNonIndexed() : src;
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    uv.push(...(g.attributes.uv ? g.attributes.uv.array : new Float32Array((g.attributes.position.count) * 2)));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

// Ankara print for wrappers, head-ties and some shirts, tinted per person.
let cloth = null;
function clothMaterial() {
  if (!cloth) {
    const t = artTexture('art/tex/ankara.webp', '#d0d0d0');
    t.repeat.set(2, 2);
    cloth = toonInstancedMap('ankara', t);
  }
  return cloth;
}

const colorCache = new Map();
function col(hex) {
  if (!colorCache.has(hex)) colorCache.set(hex, new THREE.Color(hex));
  return colorCache.get(hex);
}

const PLAYER_COLOR = '#1f8f4e';
const HOSTILE_COLOR = '#c0392b';

export class People {
  constructor(scene) {
    const P = (geo, key, cap, shadow, mat) => new Pool(scene, geo, key, cap, shadow, mat);
    const print = clothMaterial();
    this.pools = {
      leg: P(limb(0.024, 0.02, 0.14, 0.022), 'leg', 512),
      arm: P(limb(0.02, 0.017, 0.13, 0.02), 'arm', 512),
      body: P(new THREE.CapsuleGeometry(0.068, 0.11, 4, 12), 'body', 256),
      bodyP: P(new THREE.CapsuleGeometry(0.068, 0.11, 4, 12), 'bodyP', 256, true, print),
      skirt: P(new THREE.ConeGeometry(0.1, 0.17, 12, 1, true), 'skirt', 256, true, print),
      head: P(new THREE.IcosahedronGeometry(0.064, 2), 'head', 256),
      eye: P(new THREE.SphereGeometry(0.012, 6, 5), 'eye', 512, false),
      pupil: P(new THREE.SphereGeometry(0.0065, 5, 4), 'pupil', 512, false),
      gele: P(new THREE.IcosahedronGeometry(0.075, 2), 'gele', 128, true, print),
      cap: P(new THREE.CylinderGeometry(0.05, 0.058, 0.045, 8), 'cap', 256),
      hat: P(new THREE.CylinderGeometry(0.052, 0.05, 0.1, 8), 'hat', 128),
      load: P(new THREE.BoxGeometry(0.2, 0.06, 0.12), 'load', 128),
      tuber: P(new THREE.IcosahedronGeometry(0.06, 0), 'tuber', 256),
      pot: P(new THREE.CylinderGeometry(0.05, 0.07, 0.09, 8), 'pot', 64),
      shield: P(new THREE.CylinderGeometry(0.085, 0.085, 0.018, 10), 'shield', 128),
      shaft: P(limb(0.01, 0.01, 0.55), 'shaft', 256),
      tip: P(new THREE.ConeGeometry(0.02, 0.07, 5), 'tip', 256),
      blade: P(new THREE.BoxGeometry(0.018, 0.22, 0.008), 'blade', 64),
      bow: P(new THREE.TorusGeometry(0.13, 0.008, 4, 10, Math.PI), 'bow', 64),
      gun: P(new THREE.BoxGeometry(0.022, 0.022, 0.42), 'gun', 128),
      ring: P(new THREE.RingGeometry(0.11, 0.15, 16).rotateX(-Math.PI / 2), 'ring', 256, false),
      horse: P(new THREE.CapsuleGeometry(0.085, 0.26, 3, 8), 'horse', 64),
      horseHead: P(new THREE.BoxGeometry(0.07, 0.13, 0.08), 'horsehead', 64),
      horseLeg: P(limb(0.02, 0.017, 0.2), 'horseleg', 256),
      beast: P(new THREE.CapsuleGeometry(0.06, 0.15, 3, 8), 'beast', 128),
      beastHead: P(new THREE.IcosahedronGeometry(0.045, 0), 'beasthead', 128),
      beastLeg: P(limb(0.012, 0.01, 0.13), 'beastleg', 512),
      horn: P(new THREE.ConeGeometry(0.008, 0.09, 4), 'horn', 256),
      selRing: P(new THREE.RingGeometry(0.2, 0.25, 24).rotateX(-Math.PI / 2), 'sel', 64, false),
    };
    this.m = new THREE.Matrix4();
    this.base = new THREE.Matrix4();
    this.local = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3(1, 1, 1);
    this.headings = new Map();
  }

  begin() {
    for (const p of Object.values(this.pools)) p.begin();
  }

  end() {
    for (const p of Object.values(this.pools)) p.end();
  }

  // Pose = position, heading (radians, 0 faces down the map), uniform scale.
  setBase(x, y, z, heading, scale = 1) {
    this.q.setFromAxisAngle(this.v.set(0, 1, 0), heading);
    this.base.compose(this.v.set(x, y, z), this.q, this.s.set(scale, scale, scale));
  }

  part(pool, color, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    this.e.set(rx, ry, rz);
    this.q.setFromEuler(this.e);
    this.local.compose(this.v.set(x, y, z), this.q, this.s.set(sx, sy, sz));
    this.m.multiplyMatrices(this.base, this.local);
    this.pools[pool].add(this.m, col(color));
  }

  heading(e, x, y, faceX, faceY) {
    let h = this.headings.get(e.id);
    const dx = faceX ?? x - (e.hx ?? x);
    const dy = faceY ?? y - (e.hy ?? y);
    if (Math.abs(dx) + Math.abs(dy) > 0.002) {
      const target = Math.atan2(dx, dy);
      if (h === undefined) h = target;
      let d = target - h;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      h += d * 0.25;
    }
    if (h === undefined) h = 0;
    this.headings.set(e.id, h);
    e.hx = x;
    e.hy = y;
    return h;
  }

  citizen(c, x, y, ground, t, moving, opts) {
    const h = this.heading(c, x, y);
    const p = t * 9 + c.id;
    const walk = moving ? Math.sin(p) : 0;
    const bob = moving ? Math.abs(Math.sin(p)) * 0.012 : 0;
    this.setBase(x, ground + bob, y, h, SIZE);
    const skin = SKIN[c.id % SKIN.length];
    const carrying = !!c.carry;
    // Legs and arms swing in opposite phase.
    this.part('leg', '#3b2a1a', -0.035, 0.15, 0, walk * 0.6);
    this.part('leg', '#3b2a1a', 0.035, 0.15, 0, -walk * 0.6);
    if (c.female) {
      this.part('skirt', c.cloth, 0, 0.13, 0);
      this.part('bodyP', c.wrap, 0, 0.27, 0, 0, 0, 0, 0.9, 0.75, 0.85);
    } else {
      this.part(c.id % 3 === 0 ? 'bodyP' : 'body', c.cloth, 0, 0.25, 0);
    }
    const armSwing = carrying ? -2.8 : -walk * 0.5;
    const work = opts.tool ? Math.sin(t * 8 + c.id) * 0.7 - 0.9 : 0;
    this.part('arm', c.female ? c.wrap : c.cloth, -0.085, 0.32, 0, armSwing, 0, -0.15);
    this.part('arm', c.female ? c.wrap : c.cloth, 0.085, 0.32, 0, carrying ? armSwing : opts.tool ? work : walk * 0.5, 0, 0.15);
    this.part('head', skin, 0, 0.4, 0);
    this.eyes(0.4);
    if (c.female) this.part('gele', c.wrap, 0, 0.455, -0.012, 0.25, 0, 0, 1.15, 0.55, 1.0);
    else this.part('cap', c.wrap, 0.008, 0.46, 0, 0, 0, 0.25);
    if (carrying) this.load(c.carry.r, 0.5);
  }

  // Two dark eyes on the front of the head.
  eyes(y) {
    if (REAL) return;
    for (const x of [-0.024, 0.024]) {
      this.part('eye', '#f6f1e6', x, y + 0.01, 0.054, 0, 0, 0, 1, 1.15, 0.7);
      this.part('pupil', '#1a1210', x * 0.92, y + 0.009, 0.064);
    }
  }

  // The coloured ring under a soldier, showing whose side they are on.
  ring(x, ground, y, color) {
    this.setBase(x, ground, y, 0, SIZE);
    this.part('ring', color, 0, 0.01, 0);
  }

  // A load carried on the head of a life-like character.
  loadAt(r, x, y, z, heading) {
    this.setBase(x, y, z, heading, SIZE * 0.9);
    this.load(r, 0.03);
  }

  load(r, y) {
    const color = CARRY[r] || '#c8a06a';
    if (r === 'wood') {
      this.part('load', '#7a5230', 0, y, 0, 0, 0.4, 0, 1.1, 1, 0.9);
      this.part('load', '#8b6239', 0, y + 0.05, 0, 0, -0.3, 0, 1, 1, 0.8);
    } else if (r === 'yam' || r === 'cassava' || r === 'garri') {
      this.part('pot', r === 'garri' ? '#e9dcc0' : '#a0703a', 0, y, 0, 0, 0, 0, 1.3, 0.7, 1.3);
      this.part('tuber', r === 'cassava' ? '#a87b4f' : '#7a4a20', -0.02, y + 0.05, 0);
      this.part('tuber', r === 'cassava' ? '#c49a6c' : '#8b5a2b', 0.04, y + 0.05, 0.02);
    } else if (r === 'palmoil') {
      this.part('pot', '#5a3a20', 0, y, 0);
      this.part('pot', '#e2621b', 0, y + 0.04, 0, 0, 0, 0, 0.9, 0.15, 0.9);
    } else if (r === 'fish') {
      this.part('pot', '#8b6239', 0, y, 0, 0, 0, 0, 1.3, 0.5, 1.3);
      this.part('tuber', '#c9d3da', 0, y + 0.04, 0, 0, 0, 0, 1.6, 0.5, 0.7);
    } else {
      this.part('load', color, 0, y, 0, 0, 0, 0, 0.8, 1.4, 0.9);
    }
  }

  soldier(u, x, y, ground, t, moving, ownerColor, opts) {
    let fx;
    let fy;
    if (opts.target) {
      fx = opts.target.x - x;
      fy = opts.target.y - y;
    }
    const h = this.heading(u, x, y, fx, fy);
    const p = t * 10 + u.id;
    const walk = moving ? Math.sin(p) : 0;
    const swing = opts.swing || 0;
    const mounted = u.type === 'horseman';
    this.setBase(x, ground + (moving ? Math.abs(Math.sin(p)) * 0.01 : 0), y, h, SIZE);
    this.part('ring', ownerColor, 0, 0.01, 0);
    let lift = 0;
    if (mounted) {
      lift = 0.2;
      this.part('horse', '#6b4226', 0, 0.24, 0, Math.PI / 2);
      this.part('horseHead', '#5a3a20', 0, 0.36, 0.2, -0.5);
      for (const [lx, lz, ph] of [[-0.05, 0.12, 0], [0.05, 0.12, Math.PI], [-0.05, -0.12, Math.PI], [0.05, -0.12, 0]]) {
        this.part('horseLeg', '#4a2c1a', lx, 0.2, lz, moving ? Math.sin(p * 1.3 + ph) * 0.7 : 0);
      }
    } else {
      this.part('leg', '#2b1f15', -0.035, 0.15, 0, walk * 0.6);
      this.part('leg', '#2b1f15', 0.035, 0.15, 0, -walk * 0.6);
    }
    const foreign = ['soldado', 'french', 'marine'].includes(u.type);
    const coat = FOREIGN_COAT[u.type] || (u.type === 'edo' ? '#b8860b' : u.type === 'slaver' ? '#3b3b3b' : u.type === 'bandit' ? '#5d4e3a' : u.cloth || '#efe6d2');
    this.part('body', coat, 0, 0.25 + lift, 0);
    this.part('head', foreign ? '#e8c3a0' : SKIN[u.id % SKIN.length], 0, 0.4 + lift, 0);
    this.eyes(0.4 + lift);
    if (u.type === 'marine') this.part('hat', '#111111', 0, 0.48 + lift, 0, 0, 0, 0, 1, 1.1, 1);
    else if (u.type === 'soldado') this.part('gele', '#9aa0a6', 0, 0.45 + lift, 0, 0, 0, 0, 1, 0.55, 1);
    else if (u.type === 'french') this.part('hat', '#1d3b70', 0, 0.47 + lift, 0, 0, 0, Math.PI / 2, 0.6, 1, 1.8);
    else if (u.type === 'edo') this.part('cap', '#c0392b', 0, 0.465 + lift, 0, 0, 0, 0, 1, 1.4, 1);
    else this.part('cap', ownerColor, 0, 0.46 + lift, 0, 0, 0, 0.15);

    const strike = Math.sin(Math.min(1, swing) * Math.PI);
    this.part('arm', coat, -0.085, 0.32 + lift, 0, -walk * 0.4 - 0.3, 0, -0.15);
    this.part('arm', coat, 0.085, 0.32 + lift, 0, -0.9 - strike * 0.9, 0, 0.12);
    switch (u.type) {
      case 'archer':
      case 'bowman':
        this.part('bow', '#6b4b2a', -0.1, 0.3 + lift, 0.1, 0, Math.PI / 2, Math.PI / 2);
        break;
      case 'musketeer':
      case 'soldado':
      case 'french':
      case 'marine':
        this.part('gun', '#3b2a1a', 0.07, 0.27 + lift, 0.14 + strike * 0.03, -0.25);
        break;
      case 'swordsman':
      case 'edo':
        this.part('blade', '#c0c6c9', 0.11, 0.25 + lift, 0.12, 0.9 + strike * 1.2);
        break;
      case 'scout':
        break;
      default:
        // A spear, held upright, thrust forward when striking.
        this.part('shaft', '#6b4b2a', 0.11, 0.62 + lift, 0.04 + strike * 0.12, 0.12 + strike * 1.1);
        this.part('tip', '#b8bec2', 0.11, 0.66 + lift, 0.05 + strike * 0.14, 0.12 + strike * 1.1);
    }
    if (['spearman', 'swordsman', 'warrior', 'edo', 'bandit', 'slaver'].includes(u.type) || (mounted && !foreign)) {
      this.part('shield', u.type === 'edo' ? '#8b5a2b' : '#a0703a', -0.12, 0.27 + lift, 0.03, 0, 0, Math.PI / 2);
    }
  }

  animal(a, x, y, ground, t, moving) {
    const h = this.heading(a, x, y);
    const p = t * 12 + a.id;
    this.setBase(x, ground, y, h, 1.7);
    if (a.carcass) {
      this.part('beast', a.type === 'pig' ? '#4b3b33' : '#a57b4c', 0, 0.06, 0, Math.PI / 2, 0, Math.PI / 2);
      return;
    }
    const pig = a.type === 'pig';
    const body = pig ? '#4b3b33' : '#b5874f';
    this.part('beast', body, 0, pig ? 0.13 : 0.17, 0, Math.PI / 2, 0, 0, pig ? 1.15 : 1, 1, pig ? 1 : 0.85);
    this.part('beastHead', pig ? '#3e302a' : '#a57b4c', 0, pig ? 0.14 : 0.26, pig ? 0.15 : 0.14);
    for (const [lx, lz, ph] of [[-0.035, 0.07, 0], [0.035, 0.07, Math.PI], [-0.035, -0.07, Math.PI], [0.035, -0.07, 0]]) {
      this.part('beastLeg', '#4a2c1a', lx, pig ? 0.1 : 0.14, lz, moving ? Math.sin(p + ph) * 0.6 : 0, 0, 0, 1, pig ? 0.75 : 1, 1);
    }
    if (!pig) {
      this.part('horn', '#2b1f15', -0.02, 0.32, 0.12, -0.3);
      this.part('horn', '#2b1f15', 0.02, 0.32, 0.12, -0.3);
    }
  }

  selection(x, y, ground, r, color) {
    this.setBase(x, ground + 0.02, y, 0, r);
    this.part('selRing', color, 0, 0, 0);
  }
}

export { PLAYER_COLOR, HOSTILE_COLOR };
