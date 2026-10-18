// Low-poly cartoon models for every building, village and ship, built from
// simple shapes with cel-shaded, textured materials. Models are in
// building-local tiles: x across, z down the map, y up; one tile is one unit.

import * as THREE from '../vendor/three.module.js';
import { toon } from './materials.js';

const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

const C = {
  thatch: () => toon('#d8b46a', { map: 'thatch' }),
  mud: () => toon('#c47a4c', { map: 'mud' }),
  mudDark: () => toon('#8f4f2e', { map: 'mud' }),
  rammed: () => toon('#d0703f', { map: 'mud' }),
  plaster: () => toon('#ffffff', { map: 'plaster' }),
  zinc: () => toon('#ffffff', { map: 'zinc' }),
  planks: () => toon('#ffffff', { map: 'planks' }),
  soil: () => toon('#ffffff', { map: 'soil' }),
  stone: () => toon('#ffffff', { map: 'stone' }),
  dark: () => toon('#2b1a10'),
  wood: () => toon('#7a5230'),
  leaf: () => toon('#4f9a36'),
  leafDark: () => toon('#2f6b2a'),
  earth: () => toon('#b88a5c'),
  red: () => toon('#b5532f'),
  white: () => toon('#f4f1ea'),
  glass: () => toon('#7fb3c9'),
  iron: () => toon('#4b4b4b'),
};

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const box = (w, h, d) => geo(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, s = 12) => geo(`cyl${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const cone = (r, h, s = 14) => geo(`cone${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const ball = (r, d = 1) => geo(`ball${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));

// A triangular-prism roof running along x, `w` long, `d` deep and `h` tall.
function prism(w, d, h) {
  return geo(`prism${w},${d},${h}`, () => {
    const g = new THREE.BufferGeometry();
    const x0 = -w / 2;
    const x1 = w / 2;
    const z0 = -d / 2;
    const z1 = d / 2;
    const v = [
      [x0, 0, z0], [x1, 0, z0], [x1, h, 0], [x0, h, 0],
      [x0, 0, z1], [x1, 0, z1], [x1, h, 0], [x0, h, 0],
      [x0, 0, z0], [x0, h, 0], [x0, 0, z1],
      [x1, 0, z0], [x1, 0, z1], [x1, h, 0],
    ];
    const pos = [];
    const uv = [];
    const quad = (a, b, c, d2) => {
      pos.push(...a, ...b, ...c, ...a, ...c, ...d2);
      uv.push(0, 0, w, 0, w, 1, 0, 0, w, 1, 0, 1);
    };
    quad(v[0], v[3], v[2], v[1]);
    quad(v[4], v[5], v[6], v[7]);
    pos.push(...v[8], ...v[10], ...v[9], ...v[11], ...v[13], ...v[12]);
    uv.push(0, 0, 1, 0, 0.5, 1, 0, 0, 0.5, 1, 1, 0);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  });
}

// --- Pieces ---------------------------------------------------------------------

// Earth walls carry their texture at a fixed size in the world, so a long
// wall shows the same grain of laterite all along instead of one stretched image.
const WALL_UV = 1.4;
function earthBox(group, w, h, d, x, y, z, m = C.rammed()) {
  const b = mesh(box(w, h, d), m, x, y, z);
  b.userData.boxUV = WALL_UV;
  group.add(b);
  return b;
}

// A thick laterite wall from (x0,z0) to (x1,z1): battered (wider at the
// foot), rounded on top and capped with a ridge of thatch against the rain,
// as on the old town walls (odi) of Yorubaland.
function earthWall(group, x0, z0, x1, z1, h = 0.95, t = 0.5) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const g = new THREE.BoxGeometry(len, h, t, 4, 2, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = (y + h / 2) / h; // 0 at the foot, 1 at the top
    p.setZ(i, p.getZ(i) * (1 - k * 0.32));
    // A little sag and swell so it looks hand-built.
    p.setY(i, y + (k > 0.9 ? Math.sin(p.getX(i) * 7.3 + x0 * 3 + z0) * 0.025 : 0));
  }
  g.computeVertexNormals();
  const ang = Math.atan2(z1 - z0, x1 - x0);
  const wall = mesh(g, C.rammed(), (x0 + x1) / 2, h / 2, (z0 + z1) / 2);
  wall.rotation.y = -ang;
  wall.userData.boxUV = WALL_UV;
  group.add(wall);
  const cap = mesh(prism(len + 0.06, t * 0.85, 0.16), C.thatch(), (x0 + x1) / 2, h - 0.02, (z0 + z1) / 2);
  cap.rotation.y = -ang;
  group.add(cap);
}

// A round mud bastion with a conical thatched roof: a lookout post at the
// corners and ends of an earth wall.
function bastion(group, x, z, r, h) {
  const body = mesh(cyl(r * 0.9, r, h, 16), C.rammed(), x, h / 2, z);
  body.userData.uvScale = [Math.PI * 2 * r * WALL_UV, h * WALL_UV];
  group.add(body);
  // Open lookout under the eaves, held up by four posts.
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    group.add(mesh(cyl(0.025, 0.03, 0.32, 5), C.wood(), x + Math.cos(a) * r * 0.78, h + 0.16, z + Math.sin(a) * r * 0.78));
  }
  group.add(mesh(cyl(r * 0.92, r * 0.92, 0.05, 16), C.planks(), x, h + 0.02, z));
  group.add(mesh(cone(r * 1.25, r * 1.05, 16), C.thatch(), x, h + 0.32 + r * 0.5, z));
  group.add(mesh(cyl(r * 0.05, r * 0.1, r * 0.25, 5), C.wood(), x, h + 0.32 + r * 1.08, z));
  // Loopholes for archers.
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.6;
    const hole = mesh(box(0.05, 0.12, 0.04), C.dark(), x + Math.cos(a) * r * 0.97, h * 0.62, z + Math.sin(a) * r * 0.97);
    hole.rotation.y = -a + Math.PI / 2;
    group.add(hole);
  }
}

// A wooden cannon carriage with an imported iron gun.
function cannon(group, x, z, ang, y = 0) {
  const c = new THREE.Group();
  c.add(mesh(box(0.22, 0.08, 0.3), C.wood(), 0, y + 0.08, 0));
  for (const dx of [-0.12, 0.12]) {
    const wheel = mesh(cyl(0.08, 0.08, 0.03, 10), C.wood(), dx, y + 0.08, 0.06);
    wheel.rotation.z = Math.PI / 2;
    c.add(wheel);
  }
  const barrel = mesh(cyl(0.035, 0.05, 0.42, 8), C.iron(), 0, y + 0.17, -0.08);
  barrel.rotation.x = Math.PI / 2 - 0.08;
  c.add(barrel);
  c.position.set(x, 0, z);
  c.rotation.y = ang;
  group.add(c);
}

// A doorway: a dark opening in a wooden frame, facing +z.
function door(group, x, y0, z, w, h, frame = C.wood()) {
  group.add(mesh(box(w, h, 0.05), C.dark(), x, y0 + h / 2, z));
  for (const dx of [-1, 1]) group.add(mesh(box(0.035, h + 0.03, 0.06), frame, x + dx * (w / 2 + 0.015), y0 + h / 2, z + 0.01));
  group.add(mesh(box(w + 0.1, 0.04, 0.07), frame, x, y0 + h + 0.02, z + 0.01));
}

// A small window with open wooden shutters, facing +z.
function windowAt(group, x, y, z, size, shutter = C.wood(), glass = C.dark()) {
  group.add(mesh(box(size, size * 0.85, 0.05), glass, x, y, z));
  group.add(mesh(box(size + 0.06, 0.03, 0.06), shutter, x, y - size * 0.45, z + 0.01));
  for (const dx of [-1, 1]) {
    const sh = mesh(box(size * 0.5, size * 0.85, 0.025), shutter, x + dx * size * 0.62, y, z + 0.05);
    sh.rotation.y = dx * 0.6;
    group.add(sh);
  }
}

// A round hut: raised plinth, mud wall, thick layered thatch tied at the top.
function roundHut(group, cx, cz, r, opts = {}) {
  const wallH = r * 0.78;
  group.add(mesh(cyl(r * 1.0, r * 1.06, 0.06, 16), C.mudDark(), cx, 0.03, cz));
  group.add(mesh(cyl(r * 0.92, r * 0.97, wallH, 16), opts.wall || C.mud(), cx, 0.04 + wallH / 2, cz));
  const roof = opts.roof || C.thatch();
  const tier = (rad, h, base) => group.add(mesh(cone(rad, h, 18), roof, cx, base + h / 2, cz));
  tier(r * 1.42, r * 0.55, wallH - r * 0.06);
  tier(r * 1.1, r * 0.62, wallH + r * 0.2);
  tier(r * 0.66, r * 0.6, wallH + r * 0.52);
  group.add(mesh(cyl(r * 0.05, r * 0.12, r * 0.28, 6), C.wood(), cx, wallH + r * 1.18, cz));
  door(group, cx, 0.05, cz + r * 0.93, r * 0.4, wallH * 0.72);
  return group;
}

// A rectangular house with a raised plinth, overhanging gable roof, ridge
// beam, framed door and shuttered windows; optionally a front verandah.
function gableHouse(group, cx, cz, w, d, wallH, opts = {}) {
  const wallM = opts.wall || C.mud();
  const roofM = opts.roof || C.thatch();
  group.add(mesh(box(w + 0.08, 0.07, d + 0.08), opts.plinth || C.mudDark(), cx, 0.035, cz));
  group.add(mesh(box(w, wallH, d), wallM, cx, 0.05 + wallH / 2, cz));
  const roofH = d * 0.45;
  group.add(mesh(prism(w + 0.3, d + 0.4, roofH), roofM, cx, wallH + 0.04, cz));
  group.add(mesh(box(w + 0.34, 0.05, 0.08), opts.ridge || C.wood(), cx, wallH + roofH + 0.05, cz));
  const front = cz + d / 2 + 0.01;
  door(group, cx, 0.07, front, Math.min(0.28, w * 0.2), wallH * 0.7, opts.frame);
  if (w >= 1.1 && opts.windows !== false) {
    for (const dx of [-1, 1]) windowAt(group, cx + dx * w * 0.3, 0.05 + wallH * 0.58, front, 0.17, opts.shutter, opts.glass);
  }
  if (opts.verandah) {
    // Posts carrying a lean-to roof along the front.
    const depth = 0.34;
    const posts = Math.max(2, Math.round(w / 0.5));
    for (let k = 0; k < posts; k++) {
      const x = cx - w / 2 + 0.06 + (k * (w - 0.12)) / (posts - 1);
      group.add(mesh(cyl(0.028, 0.032, wallH * 0.85, 6), opts.post || C.wood(), x, wallH * 0.425 + 0.05, front + depth));
    }
    const lean = mesh(box(w + 0.1, 0.035, depth + 0.2), roofM, cx, wallH * 0.9 + 0.06, front + depth / 2);
    lean.rotation.x = 0.28;
    group.add(lean);
    group.add(mesh(box(w + 0.06, 0.05, depth + 0.1), opts.plinth || C.mudDark(), cx, 0.025, front + depth / 2));
  }
  return group;
}

// Everyday things around a home: water pots, a mortar for pounding yam,
// firewood and a stool. Chosen by the building's id so they stay put.
function homeProps(group, b, w, d) {
  const id = b.id || 1;
  const spots = [[0.18, d - 0.2], [w - 0.2, d - 0.18], [w - 0.18, 0.2], [0.2, 0.22]];
  const pick = (k) => spots[(id + k) % spots.length];
  {
    const [x, z] = pick(0);
    g2(group, 'pot', x, z);
    g2(group, 'pot', x + 0.13, z - 0.06, 0.75);
  }
  {
    const [x, z] = pick(1);
    if (id % 3 === 0) {
      for (let k = 0; k < 3; k++) {
        const log = mesh(cyl(0.035, 0.035, 0.4, 6), C.wood(), x, 0.04 + Math.floor(k / 2) * 0.06, z + (k % 2) * 0.07 - 0.035 + (k === 2 ? 0.035 : 0));
        log.rotation.z = Math.PI / 2;
        group.add(log);
      }
    } else {
      g2(group, 'mortar', x, z);
    }
  }
  if (id % 2 === 0) {
    const [x, z] = pick(2);
    group.add(mesh(cyl(0.07, 0.06, 0.1, 8), C.wood(), x, 0.05, z));
  }
}

function g2(group, kind, x, z, s = 1) {
  if (kind === 'pot') {
    group.add(mesh(ball(0.075 * s, 1), toon('#9c5a33'), x, 0.07 * s, z));
    group.add(mesh(cyl(0.035 * s, 0.045 * s, 0.05 * s, 8), toon('#8a4d2b'), x, 0.15 * s, z));
  } else if (kind === 'mortar') {
    group.add(mesh(cyl(0.08, 0.06, 0.16, 8), toon('#6d4c2f'), x, 0.08, z));
    const pestle = mesh(cyl(0.015, 0.015, 0.42, 5), toon('#c49a6c'), x + 0.02, 0.3, z);
    pestle.rotation.z = 0.15;
    group.add(pestle);
  }
}

function flag(group, x, z, color, h = 1.4) {
  group.add(mesh(cyl(0.025, 0.03, h, 6), C.wood(), x, h / 2, z));
  const cloth = mesh(box(0.42, 0.26, 0.02), toon(color), x + 0.22, h - 0.15, z);
  cloth.userData.flag = true;
  group.add(cloth);
}

// A tent of patched hides on a frame of poles: a ridge running along x, the
// door flap at the front.
function hideTent(group, cx, cz, w, d, h, turn, colors = ['#6d5a43', '#7e6a4e', '#5e4c38']) {
  const t = new THREE.Group();
  const hides = colors.map((c) => toon(c));
  const roof = mesh(prism(w, d, h), hides[0], 0, 0, 0);
  t.add(roof);
  // Patches of different hides on the slopes.
  for (const [x, side, k] of [[-w * 0.22, 1, 1], [w * 0.2, -1, 2], [w * 0.05, 1, 2]]) {
    const patch = mesh(box(w * 0.28, 0.012, d * 0.3), hides[k], x, h * 0.42, side * d * 0.2);
    patch.rotation.x = side * Math.atan2(h, d / 2);
    t.add(patch);
  }
  // Pole ends crossing over the ridge, at both ends.
  for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) {
    for (const lean of [-0.35, 0.35]) {
      const pole = mesh(cyl(0.014, 0.018, h + 0.28, 5), C.wood(), x, (h + 0.28) / 2, 0);
      pole.rotation.x = lean;
      t.add(pole);
    }
  }
  // A dark doorway in the front end.
  const door = mesh(box(0.02, h * 0.55, d * 0.28), C.dark(), w / 2 + 0.005, h * 0.27, 0);
  t.add(door);
  t.rotation.y = turn;
  t.position.set(cx, 0, cz);
  group.add(t);
}

// Yards are drawn by the ground itself (worn earth around buildings).
function earthPad() {}

// A Nigerian yam heap: a tall mound of loose earth with a stake for the vine.
function yamHeap(group, x, z, growth) {
  group.add(mesh(cone(0.27, 0.4, 9), toon('#9a6234', { map: 'soil' }), x, 0.2, z));
  const h = 0.25 + growth * 0.55;
  group.add(mesh(cyl(0.014, 0.018, h + 0.1, 5), C.wood(), x + 0.03, 0.3 + h / 2, z));
  if (growth < 0.08) return;
  const leaves = 1 + Math.floor(growth * 3);
  for (let k = 0; k < leaves; k++) {
    const ly = 0.36 + (h * (k + 1)) / (leaves + 0.6);
    group.add(mesh(ball(0.055 + growth * 0.025, 0), growth > 0.95 ? C.leafDark() : C.leaf(), x + (k % 2 ? 0.07 : -0.01), ly, z + (k % 2 ? 0 : 0.04)));
  }
}

function cassavaPlant(group, x, z, growth) {
  const h = 0.15 + growth * 0.55;
  group.add(mesh(cyl(0.018, 0.022, h, 5), toon('#9c7a55'), x, 0.12 + h / 2, z));
  if (growth < 0.1) return;
  // Palmate leaves: a fan of thin blades at the top.
  const leaf = geo('cassavaLeaf', () => new THREE.ConeGeometry(0.03, 0.22, 4));
  for (let k = 0; k < 5; k++) {
    const m = mesh(leaf, C.leaf(), x, 0.12 + h, z);
    m.rotation.z = Math.PI / 2.6;
    m.rotation.y = (k / 5) * Math.PI * 2;
    m.translateY(0.1 * (0.6 + growth * 0.6));
    m.scale.setScalar(0.6 + growth * 0.7);
    group.add(m);
  }
}

// --- Buildings ---------------------------------------------------------------------

// A mud house fallen into ruin: walls standing open to the sky, bare rafters
// where the roof was, one end broken down to a stump, and a scrap of thatch
// still hanging on. `gap` is the end that has fallen ('left' or 'right').
function ruin(group, cx, cz, w, d, wallH, opts = {}) {
  const wallM = C.mud();
  const t = 0.07;
  const s = opts.gap === 'left' ? -1 : 1;
  group.add(mesh(box(w + 0.08, 0.07, d + 0.08), C.mudDark(), cx, 0.035, cz));
  group.add(mesh(box(w - 0.12, 0.02, d - 0.12), toon('#4a3322'), cx, 0.075, cz));
  // The back wall, cut short at the broken end.
  const back = w * 0.78;
  group.add(mesh(box(back, wallH, t), wallM, cx - (s * (w - back)) / 2, 0.05 + wallH / 2, cz - d / 2 + t / 2));
  // The front wall, with its doorway.
  group.add(mesh(box(w * 0.85, wallH * 0.92, t), wallM, cx - (s * w * 0.15) / 2, 0.05 + (wallH * 0.92) / 2, cz + d / 2 - t / 2));
  door(group, cx - s * w * 0.15, 0.07, cz + d / 2 + 0.01, 0.24, wallH * 0.66);
  // The standing end, and the broken one: a jagged stump.
  group.add(mesh(box(t, wallH, d), wallM, cx - (s * (w - t)) / 2, 0.05 + wallH / 2, cz));
  [0.3, 0.12, 0.42, 0.2].forEach((k, i) => {
    const hh = wallH * k;
    group.add(mesh(box(t, hh, d / 4), wallM, cx + (s * (w - t)) / 2, 0.05 + hh / 2, cz - d / 2 + d / 8 + (i * d) / 4));
  });
  // Bare rafters where the roof was, fewer toward the broken end.
  const roofH = d * 0.45;
  const lean = Math.atan2(roofH, d / 2);
  const len = Math.hypot(d / 2, roofH) + 0.12;
  const n = Math.max(3, Math.round(w / 0.42));
  for (let k = 0; k < n; k++) {
    const f = k / (n - 1);
    if (s * (f - 0.5) > 0.22) continue;
    const x = cx - w / 2 + 0.12 + f * (w - 0.24);
    for (const side of [-1, 1]) {
      if ((k + (side > 0 ? 1 : 0)) % 3 === 2) continue;
      const r = mesh(box(0.035, 0.035, len), C.wood(), x, wallH + 0.05 + roofH / 2, cz + (side * d) / 4);
      r.rotation.x = side * lean;
      group.add(r);
    }
  }
  // The ridge pole, snapped: one half still up, the other down in the room.
  group.add(mesh(box(w * 0.55, 0.05, 0.05), C.wood(), cx - (s * w * 0.2), wallH + roofH + 0.03, cz));
  const fallen = mesh(box(w * 0.5, 0.05, 0.05), C.wood(), cx + (s * w * 0.27), wallH * 0.62, cz + 0.05);
  fallen.rotation.z = s * -0.62;
  group.add(fallen);
  // A scrap of thatch still on the good end.
  if (opts.thatch) {
    const keep = mesh(prism(w * opts.thatch, d + 0.38, roofH), C.thatch(), cx - (s * w * (1 - opts.thatch)) / 2, wallH + 0.04, cz);
    group.add(keep);
  }
  return group;
}

// The house as the founders find it: the roofs fallen in, a wall down,
// thatch and old timbers lying about the yard, weeds coming up.
function wreckedCompound(g) {
  earthPad(g, 3, 3);
  ruin(g, 1.5, 0.45, 2.8, 0.8, 0.55, { gap: 'right', thatch: 0.42 });
  ruin(g, 1.5, 2.55, 2.8, 0.8, 0.55, { gap: 'left' });
  const wing = ruin(new THREE.Group(), 0, 0, 1.4, 0.7, 0.5, { gap: 'right', thatch: 0.5 });
  wing.rotation.y = Math.PI / 2;
  wing.position.set(0.4, 0, 1.5);
  g.add(wing);
  // The far wing has all but fallen: low wall stumps.
  for (const [x, z, w, d, hh] of [[2.6, 1.5, 0.07, 1.3, 0.2], [2.85, 1.5, 0.07, 1.3, 0.12], [2.72, 0.88, 0.32, 0.07, 0.16]]) {
    g.add(mesh(box(w, hh, d), C.mud(), x, 0.05 + hh / 2, z));
  }
  // What came down, lying in the yard. A fixed pattern, so it never changes.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const [x, z, r] of [[2.35, 0.95, 0.24], [0.95, 1.6, 0.2], [2.2, 2.05, 0.22], [2.75, 2.35, 0.16]]) {
    const heap = mesh(ball(r, 1), C.thatch(), x, 0.04, z);
    heap.scale.set(1.4, 0.32, 1);
    heap.rotation.y = rnd() * Math.PI;
    g.add(heap);
  }
  for (let k = 0; k < 7; k++) {
    const p = mesh(box(0.42 + rnd() * 0.2, 0.03, 0.06), C.wood(), 0.9 + rnd() * 1.4, 0.04 + (k % 2) * 0.02, 1.0 + rnd() * 1.0);
    p.rotation.y = rnd() * Math.PI;
    p.rotation.z = (rnd() - 0.5) * 0.25;
    g.add(p);
  }
  for (let k = 0; k < 6; k++) {
    const lump = mesh(box(0.1 + rnd() * 0.06, 0.06, 0.09), C.mudDark(), 2.8 + rnd() * 0.25, 0.04, 0.9 + rnd() * 1.2);
    lump.rotation.y = rnd() * Math.PI;
    g.add(lump);
  }
  // Weeds along the walls, and the courtyard well gone dry.
  for (let k = 0; k < 12; k++) {
    const x = 0.25 + rnd() * 2.6;
    const z = [0.95, 2.05, 0.15, 2.9][k % 4] + (rnd() - 0.5) * 0.12;
    for (let j = 0; j < 3; j++) {
      const h = 0.08 + rnd() * 0.08;
      const blade = mesh(cone(0.025, h, 4), j ? C.leafDark() : toon('#6f8f3a'), x + (rnd() - 0.5) * 0.08, 0.05 + h / 2, z + (rnd() - 0.5) * 0.08);
      blade.rotation.z = (rnd() - 0.5) * 0.6;
      g.add(blade);
    }
  }
  g.add(mesh(cyl(0.18, 0.18, 0.04, 12), toon('#5c4a36'), 1.5, 0.05, 1.5));
  g2(g, 'mortar', 1.1, 1.75);
  const pot = mesh(ball(0.075, 1), toon('#9c5a33'), 1.95, 0.05, 1.75);
  pot.scale.y = 0.6;
  pot.rotation.z = 1.2;
  g.add(pot);
}

const BUILD = {
  compound(g, b, st) {
    if (b.wreck) {
      wreckedCompound(g);
      return;
    }
    earthPad(g, 3, 3);
    const big = (b.level || 1) >= 2;
    const roofOpts = { roof: st.era >= 3 ? C.zinc() : C.thatch(), wall: C.mud(), windows: false };
    gableHouse(g, 1.5, 0.45, 2.8, 0.8, 0.55, roofOpts);
    gableHouse(g, 1.5, 2.55, 2.8, 0.8, 0.55, { ...roofOpts, windows: true });
    // Verandah posts around the courtyard.
    for (const [x, z] of [[0.95, 1.0], [2.05, 1.0], [0.95, 2.0], [2.05, 2.0], [1.5, 1.0], [1.5, 2.0]]) g.add(mesh(cyl(0.025, 0.03, 0.5, 6), C.wood(), x, 0.27, z));
    g2(g, 'mortar', 1.1, 1.75);
    g2(g, 'pot', 1.95, 1.75);
    const side = gableHouse(new THREE.Group(), 0, 0, 1.4, 0.7, 0.55, roofOpts);
    side.rotation.y = Math.PI / 2;
    side.position.set(0.4, 0, 1.5);
    g.add(side);
    const side2 = side.clone();
    side2.position.set(2.6, 0, 1.5);
    g.add(side2);
    g.add(mesh(cyl(0.18, 0.18, 0.04, 12), toon('#5b8fa3'), 1.5, 0.05, 1.5));
    g.add(mesh(cyl(0.08, 0.1, 0.18, 8), toon('#6d4c2f'), 1.9, 0.09, 1.2));
    if (big) gableHouse(g, 3.4, 1.5, 0.7, 1.2, 0.5, roofOpts);
    flag(g, 2.75, 0.2, '#1f8f4e');
  },

  campfire(g) {
    earthPad(g, 2, 2);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.add(mesh(ball(0.07, 0), toon('#8c8c8c'), 1 + Math.cos(a) * 0.32, 0.05, 1 + Math.sin(a) * 0.32));
    }
    const log = mesh(cyl(0.05, 0.05, 0.6, 6), C.wood(), 1, 0.08, 1);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = 0.6;
    g.add(log);
    const log2 = log.clone();
    log2.rotation.y = -0.6;
    g.add(log2);
    const fire = mesh(cone(0.18, 0.45, 7), toon('#f39c12', { emissive: '#f39c12' }), 1, 0.3, 1);
    fire.userData.flame = true;
    fire.castShadow = false;
    g.add(fire);
    const inner = mesh(cone(0.1, 0.3, 6), toon('#ffe066', { emissive: '#ffe066' }), 1, 0.22, 1);
    inner.userData.flame = true;
    inner.castShadow = false;
    g.add(inner);
    for (const [x, z] of [[0.35, 1.6], [1.6, 1.65]]) g.add(mesh(box(0.45, 0.03, 0.25), C.thatch(), x, 0.02, z));
  },

  hut(g, b) {
    earthPad(g, 2, 2);
    const lvl = b.level || 1;
    if (lvl === 1) {
      // A plank house: sawn boards on a timber sill under a thatched gable roof.
      gableHouse(g, 1, 0.9, 1.4, 1.0, 0.62, { wall: C.planks(), plinth: C.wood(), windows: true, shutter: C.wood() });
      for (const x of [0.32, 1.68]) for (const z of [0.42, 1.38]) g.add(mesh(box(0.06, 0.66, 0.06), C.wood(), x, 0.35, z));
    } else if (lvl === 2) {
      // Mud-brick house with a thatched verandah.
      gableHouse(g, 1, 0.85, 1.5, 1.05, 0.7, { wall: C.mud(), roof: C.thatch(), verandah: true });
    } else if (lvl === 3) {
      // Zinc-roof bungalow: plastered walls, blue shutters, white pillars.
      gableHouse(g, 1, 0.85, 1.6, 1.1, 0.75, {
        wall: C.plaster(), roof: C.zinc(), verandah: true, plinth: toon('#9a8f80'), post: C.white(),
        shutter: toon('#2d6db5'), frame: toon('#2d6db5'), ridge: toon('#7d868b'),
      });
      g.add(mesh(box(0.5, 0.05, 0.16), toon('#9a8f80'), 1, 0.025, 1.85));
    } else {
      // A modern storey building: two floors, balcony with railing, parapet
      // and a water tank on the roof.
      const wallM = C.plaster();
      const trim = toon('#d7cfc0');
      g.add(mesh(box(1.66, 0.08, 1.46), toon('#9a8f80'), 1, 0.04, 1));
      g.add(mesh(box(1.6, 1.6, 1.4), wallM, 1, 0.84, 1));
      g.add(mesh(box(1.7, 0.08, 1.5), trim, 1, 1.66, 1));
      for (const [x, z, w, d] of [[1, 0.27, 1.7, 0.06], [1, 1.73, 1.7, 0.06], [0.17, 1, 0.06, 1.5], [1.83, 1, 0.06, 1.5]]) g.add(mesh(box(w, 0.14, d), trim, x, 1.77, z));
      g.add(mesh(box(1.7, 0.06, 0.42), trim, 1, 0.9, 1.9));
      for (let k = 0; k < 7; k++) g.add(mesh(box(0.025, 0.2, 0.025), C.iron(), 0.2 + k * 0.27, 1.03, 2.09));
      g.add(mesh(box(1.66, 0.03, 0.03), C.iron(), 1, 1.13, 2.09));
      for (const y of [0.5, 1.28]) {
        for (const x of [0.55, 1.45]) {
          g.add(mesh(box(0.34, 0.34, 0.04), C.glass(), x, y, 1.71));
          g.add(mesh(box(0.42, 0.05, 0.06), trim, x, y - 0.2, 1.72));
        }
      }
      door(g, 1, 0.08, 1.71, 0.26, 0.5, toon('#5a3a20'));
      g.add(mesh(cyl(0.18, 0.18, 0.3, 10), toon('#2d6db5'), 1.45, 1.9, 0.6));
    }
    homeProps(g, b, 2, 2);
  },

  farm(g, b) {
    g.add(mesh(box(2.9, 0.06, 2.9), C.soil(), 1.5, 0.03, 1.5));
    const n = (b.level || 1) >= 2 ? 5 : 4;
    const step = 2.6 / n;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) yamHeap(g, 0.2 + step / 2 + c * step, 0.2 + step / 2 + r * step, b.growth || 0);
    }
    fence(g, 3, 3);
    if ((b.growth || 0) >= 1) {
      for (let k = 0; k < 3; k++) g.add(mesh(ball(0.1, 0), toon('#8b5a2b'), 2.5 + k * 0.12, 0.08, 2.7));
    }
  },

  cassava(g, b) {
    g.add(mesh(box(2.9, 0.05, 2.9), C.soil(), 1.5, 0.025, 1.5));
    const rows = (b.level || 1) >= 2 ? 5 : 4;
    const ridge = geo('ridge', () => {
      const r = new THREE.CylinderGeometry(0.16, 0.16, 2.6, 8, 1, false, 0, Math.PI);
      r.rotateZ(Math.PI / 2);
      return r;
    });
    for (let k = 0; k < rows; k++) {
      const z = 0.35 + (k * 2.3) / (rows - 1);
      g.add(mesh(ridge, C.soil(), 1.5, 0.05, z));
      for (let j = 0; j < 5; j++) cassavaPlant(g, 0.4 + j * 0.55, z, b.growth || 0);
    }
    fence(g, 3, 3);
  },

  garri(g, b) {
    earthPad(g, 2, 2);
    // Open shed on posts, frying pans over a fire, and sacks of garri.
    for (const [x, z] of [[0.3, 0.3], [1.7, 0.3], [0.3, 1.4], [1.7, 1.4]]) g.add(mesh(cyl(0.04, 0.04, 0.8, 6), C.wood(), x, 0.4, z));
    const roof = mesh(prism(1.7, 1.4, 0.4), C.thatch(), 1, 0.8, 0.85);
    g.add(roof);
    g.add(mesh(cyl(0.32, 0.25, 0.12, 14), C.iron(), 0.7, 0.32, 0.85));
    g.add(mesh(cyl(0.3, 0.3, 0.02, 14), toon('#efe0b8'), 0.7, 0.39, 0.85));
    g.add(mesh(cyl(0.18, 0.24, 0.26, 8), C.mudDark(), 0.7, 0.13, 0.85));
    g.add(mesh(cone(0.12, 0.2, 6), toon('#f39c12', { emissive: '#e67e22' }), 0.7, 0.1, 1.15));
    for (let k = 0; k < 3; k++) g.add(mesh(cyl(0.12, 0.14, 0.3, 8), toon('#e9dcc0'), 1.3 + (k % 2) * 0.25, 0.15, 1.2 + Math.floor(k / 2) * 0.28));
    g.add(mesh(ball(0.12, 0), toon('#a87b4f'), 1.4, 0.1, 0.5));
  },

  woodcutter(g, b) {
    earthPad(g, 2, 2);
    gableHouse(g, 0.75, 0.75, 1.1, 0.9, 0.5, b.mud ? { windows: false } : { windows: false, wall: C.planks(), plinth: C.wood() });
    // Logs waiting to be split.
    const log = cyl(0.09, 0.09, 0.7, 8);
    for (let k = 0; k < 3; k++) {
      const m = mesh(log, C.wood(), 1.6, 0.09 + (k === 2 ? 0.15 : 0), 0.35 + (k === 2 ? 0.1 : k * 0.2));
      m.rotation.x = Math.PI / 2;
      g.add(m);
    }
    // A sawing trestle with a log on it, and split planks stacked beside it.
    for (const [x, z] of [[0.95, 1.45], [0.95, 1.85], [1.55, 1.45], [1.55, 1.85]]) {
      const leg = mesh(cyl(0.02, 0.02, 0.36, 4), C.wood(), x, 0.16, z);
      leg.rotation.z = x < 1.2 ? 0.25 : -0.25;
      g.add(leg);
    }
    const onTrestle = mesh(cyl(0.07, 0.07, 0.95, 7), toon('#9a6b3f'), 1.25, 0.34, 1.65);
    onTrestle.rotation.z = Math.PI / 2;
    g.add(onTrestle);
    const plank = box(0.62, 0.03, 0.1);
    for (let k = 0; k < 6; k++) g.add(mesh(plank, toon('#c49a6c'), 0.45 + (k % 2) * 0.02, 0.02 + Math.floor(k / 2) * 0.032, 1.42 + (k % 2) * 0.12));
    g.add(mesh(cyl(0.14, 0.16, 0.18, 10), toon('#b98b5a'), 0.35, 0.09, 1.85));
  },

  // Brickmaker's yard: a shade over the mixing pit, wooden moulds, rows of
  // red bricks drying in the sun, and a water pot.
  brickyard(g) {
    earthPad(g, 2, 2);
    for (const [x, z] of [[0.15, 0.15], [1.05, 0.15], [0.15, 0.95], [1.05, 0.95]]) g.add(mesh(cyl(0.03, 0.035, 0.62, 6), C.wood(), x, 0.31, z));
    g.add(mesh(prism(1.1, 1.0, 0.3), C.thatch(), 0.6, 0.6, 0.55));
    g.add(mesh(cyl(0.34, 0.3, 0.05, 14), toon('#6e3420'), 0.6, 0.03, 0.55));
    g.add(mesh(cyl(0.26, 0.26, 0.02, 14), toon('#4c2416'), 0.6, 0.06, 0.55));
    const brick = box(0.15, 0.065, 0.08);
    const dry = toon('#b8643a', { map: 'mud' });
    const fresh = toon('#8e4426', { map: 'mud' });
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        g.add(mesh(brick, r < 2 ? dry : fresh, 0.18 + c * 0.2, 0.035, 1.25 + r * 0.17));
      }
    }
    // A small stack of finished bricks.
    for (let k = 0; k < 9; k++) {
      const m = mesh(brick, dry, 1.55 + (k % 3) * 0.0, 0.035 + Math.floor(k / 3) * 0.068, 0.3 + (k % 3) * 0.09);
      m.rotation.y = Math.floor(k / 3) % 2 ? Math.PI / 2 : 0;
      g.add(m);
    }
    for (const [x, z] of [[1.45, 0.95], [1.75, 0.95]]) {
      for (const [w, d, dx, dz] of [[0.2, 0.02, 0, -0.05], [0.2, 0.02, 0, 0.05], [0.02, 0.12, -0.1, 0], [0.02, 0.12, 0.1, 0]]) g.add(mesh(box(w, 0.05, d), C.wood(), x + dx, 0.03, z + dz));
    }
    g.add(mesh(cyl(0.11, 0.08, 0.22, 10), toon('#7a4a2a'), 1.75, 0.11, 0.25));
  },

  // A floor of laid mud bricks in front of the compound. What is stored on it
  // is drawn separately (render3d/stocks.js), because it changes all the time.
  stockpile(g, b) {
    if (!b.mud) {
      // Swept, beaten earth edged with planks laid on their sides.
      g.add(mesh(box(1.96, 0.04, 1.96), toon('#c9ab80', { map: 'soil' }), 1, 0.02, 1));
      const edge = C.planks();
      for (const [w, d, x, z] of [[2, 0.08, 1, 0.04], [2, 0.08, 1, 1.96], [0.08, 2, 0.04, 1], [0.08, 2, 1.96, 1]]) g.add(mesh(box(w, 0.09, d), edge, x, 0.045, z));
      for (const [x, z] of [[0.04, 0.04], [1.96, 0.04], [0.04, 1.96], [1.96, 1.96]]) g.add(mesh(cyl(0.05, 0.05, 0.16, 6), C.wood(), x, 0.08, z));
      return;
    }
    const a = toon('#b8683f', { map: 'mud' });
    const b2 = toon('#c87c4e', { map: 'mud' });
    const brick = box(0.3, 0.07, 0.15);
    // A bed of mortar under the bricks shows in the joints.
    g.add(mesh(box(1.96, 0.05, 1.96), toon('#7a4a2e', { map: 'mud' }), 1, 0.025, 1));
    for (let r = 0; r < 12; r++) {
      const off = r % 2 ? 0.15 : 0;
      for (let c = -1; c < 7; c++) {
        const x = 0.15 + c * 0.31 + off;
        if (x < 0.1 || x > 1.9) continue;
        g.add(mesh(brick, (r * 7 + c * 3) % 5 === 0 ? b2 : a, x, 0.035, 0.09 + r * 0.153));
      }
    }
    // A border of bricks on edge.
    for (const [w, d, x, z] of [[2, 0.07, 1, 0.02], [2, 0.07, 1, 1.98], [0.07, 2, 0.02, 1], [0.07, 2, 1.98, 1]]) g.add(mesh(box(w, 0.1, d), b2, x, 0.05, z));
  },

  hunter(g, b) {
    earthPad(g, 2, 2);
    if (b.mud) roundHut(g, 0.7, 0.75, 0.5);
    else gableHouse(g, 0.75, 0.7, 1.1, 0.85, 0.5, { windows: false, wall: C.planks(), plinth: C.wood() });
    // A butchering block and a hide stretched to dry.
    g.add(mesh(cyl(0.16, 0.18, 0.2, 10), toon('#8a5a36'), 0.45, 0.1, 1.6));
    for (const x of [1.3, 1.8]) g.add(mesh(cyl(0.03, 0.03, 0.7, 5), C.wood(), x, 0.35, 1.4));
    g.add(mesh(box(0.55, 0.02, 0.02), C.wood(), 1.55, 0.68, 1.4));
    g.add(mesh(box(0.4, 0.42, 0.02), toon('#c8a06a'), 1.55, 0.45, 1.41));
  },

  fisher(g) {
    g.add(mesh(box(1.9, 0.08, 1.9), C.planks(), 1, 0.06, 1));
    for (const [x, z] of [[0.1, 0.1], [1.9, 0.1], [0.1, 1.9], [1.9, 1.9]]) g.add(mesh(cyl(0.05, 0.05, 0.5, 6), C.wood(), x, -0.1, z));
    const canoe = mesh(geo('canoe', () => new THREE.CapsuleGeometry(0.16, 1.1, 4, 8)), toon('#6b4226'), 1, 0.2, 1.65);
    canoe.rotation.z = Math.PI / 2;
    canoe.scale.set(1, 1, 0.55);
    g.add(canoe);
    for (let k = 0; k < 3; k++) g.add(mesh(cyl(0.02, 0.02, 0.6, 4), C.wood(), 0.4 + k * 0.35, 0.4, 0.5));
    g.add(mesh(box(0.8, 0.3, 0.02), toon('#e6e6dc', { transparent: true, opacity: 0.7 }), 0.75, 0.5, 0.5));
  },

  storehouse(g, b) {
    earthPad(g, 2, 2);
    const stone = (b.level || 1) >= 2;
    gableHouse(g, 1, 0.95, 1.7, 1.3, 0.75, { wall: stone ? C.stone() : C.mud(), roof: stone ? C.zinc() : C.thatch() });
    for (let k = 0; k < 3; k++) g.add(mesh(cyl(0.1, 0.12, 0.25, 8), toon('#d8c49a'), 0.4 + k * 0.25, 0.12, 1.8));
  },

  granary(g, b) {
    earthPad(g, 2, 2);
    const spots = (b.level || 1) >= 2 ? [[0.5, 0.5], [1.5, 0.5], [0.5, 1.5], [1.5, 1.5]] : [[0.55, 0.6], [1.45, 0.6], [1, 1.4]];
    for (const [x, z] of spots) {
      for (const dx of [-0.18, 0.18]) g.add(mesh(cyl(0.03, 0.03, 0.25, 5), C.wood(), x + dx, 0.12, z));
      g.add(mesh(cyl(0.28, 0.3, 0.45, 12), C.mud(), x, 0.47, z));
      g.add(mesh(cone(0.38, 0.4, 12), C.thatch(), x, 0.89, z));
    }
  },

  palisade(g, b, st, n) {
    wall(g, n, false);
  },

  stonewall(g, b, st, n) {
    wall(g, n, true);
  },

  gate(g, b, st, n) {
    const horiz = n.l || n.r || !(n.u || n.d);
    const inner = new THREE.Group();
    if (st.era >= 2) {
      // Bodè: two mud piers joined by a thatched roof over the passage.
      for (const x of [0.11, 0.89]) earthBox(inner, 0.24, 1.0, 0.7, x, 0.5, 0);
      inner.add(mesh(box(1.04, 0.12, 0.74), C.wood(), 0.5, 1.04, 0));
      const roof = mesh(prism(1.2, 0.95, 0.42), C.thatch(), 0.5, 1.1, 0);
      roof.rotation.y = Math.PI / 2;
      inner.add(roof);
      inner.add(mesh(box(0.56, 0.86, 0.06), C.planks(), 0.5, 0.43, 0.02));
      for (const y of [0.22, 0.68]) inner.add(mesh(box(0.58, 0.05, 0.08), C.wood(), 0.5, y, 0.05));
    } else {
      inner.add(mesh(cyl(0.08, 0.09, 1.15, 7), C.wood(), 0.06, 0.575, 0));
      inner.add(mesh(cyl(0.08, 0.09, 1.15, 7), C.wood(), 0.94, 0.575, 0));
      inner.add(mesh(box(1.1, 0.09, 0.16), C.wood(), 0.5, 1.12, 0));
      const lintel = mesh(prism(1.25, 0.45, 0.2), C.thatch(), 0.5, 1.16, 0);
      lintel.rotation.y = Math.PI / 2;
      inner.add(lintel);
      inner.add(mesh(box(0.8, 0.75, 0.06), C.planks(), 0.5, 0.42, 0));
    }
    if (horiz) inner.position.set(0, 0, 0.5);
    else {
      inner.rotation.y = Math.PI / 2;
      inner.position.set(0.5, 0, 1);
    }
    g.add(inner);
  },

  well(g) {
    g.add(mesh(cyl(0.38, 0.4, 0.3, 14), C.stone(), 0.5, 0.15, 0.5));
    g.add(mesh(cyl(0.28, 0.28, 0.02, 14), toon('#2f6f8a'), 0.5, 0.29, 0.5));
    for (const x of [0.18, 0.82]) g.add(mesh(cyl(0.025, 0.025, 0.55, 5), C.wood(), x, 0.45, 0.5));
    g.add(mesh(box(0.7, 0.04, 0.04), C.wood(), 0.5, 0.72, 0.5));
  },

  shrine(g) {
    earthPad(g, 2, 2);
    roundHut(g, 0.7, 1.1, 0.45, { wall: C.white() });
    g.add(mesh(cyl(0.09, 0.12, 0.9, 7), C.wood(), 1.45, 0.45, 0.6));
    g.add(mesh(ball(0.5, 1), C.leafDark(), 1.45, 1.05, 0.6));
    g.add(mesh(ball(0.32, 1), C.leaf(), 1.3, 1.25, 0.5));
    g.add(mesh(box(0.5, 0.04, 0.2), C.white(), 0.7, 0.03, 1.75));
    for (let k = 0; k < 5; k++) g.add(mesh(ball(0.035, 0), toon(k % 2 ? '#ffffff' : '#c0392b'), 0.5 + k * 0.1, 0.07, 1.75));
  },

  market(g, b) {
    earthPad(g, 3, 3);
    const lvl = b.level || 1;
    const cols = ['#e74c3c', '#f1c40f', '#27ae60', '#2980b9', '#e67e22', '#8e44ad'];
    if (lvl >= 3) {
      g.add(mesh(box(2.6, 0.9, 1.4), C.plaster(), 1.5, 0.45, 1));
      g.add(mesh(box(2.7, 0.08, 1.5), toon('#c0392b'), 1.5, 0.93, 1));
      for (let k = 0; k < 4; k++) g.add(mesh(box(0.45, 0.45, 0.03), C.glass(), 0.6 + k * 0.6, 0.4, 1.72));
    }
    const stalls = lvl >= 2 ? 8 : 6;
    for (let k = 0; k < stalls; k++) {
      const x = 0.5 + (k % 4) * 0.68;
      const z = lvl >= 3 ? 2.4 : 0.6 + Math.floor(k / (stalls / 2)) * 1.4;
      g.add(mesh(box(0.45, 0.25, 0.3), C.wood(), x, 0.12, z + 0.1));
      for (let j = 0; j < 3; j++) g.add(mesh(ball(0.05, 0), toon(['#f39c12', '#c0392b', '#27ae60'][(j + k) % 3]), x - 0.12 + j * 0.12, 0.28, z + 0.1));
      g.add(mesh(cyl(0.02, 0.02, 0.6, 4), C.wood(), x, 0.3, z));
      g.add(mesh(cone(0.36, 0.22, 8), toon(cols[k % cols.length]), x, 0.68, z));
    }
  },

  quarry(g) {
    g.add(mesh(box(1.9, 0.08, 1.9), toon('#8f877b'), 1, 0.02, 1));
    g.add(mesh(box(1.3, 0.1, 1.3), toon('#655e54'), 1, 0.05, 1));
    for (let k = 0; k < 5; k++) g.add(mesh(box(0.28, 0.2, 0.2), C.stone(), 0.3 + k * 0.35, 0.1, 1.8));
    g.add(mesh(ball(0.3, 0), toon('#9a9387'), 1.6, 0.25, 0.4));
  },

  palmpress(g) {
    earthPad(g, 2, 2);
    roundHut(g, 0.6, 0.6, 0.42);
    // The pounding pit and boiling drum of a local palm oil making area.
    g.add(mesh(cyl(0.38, 0.32, 0.12, 14), C.mudDark(), 1.35, 0.06, 1.25));
    g.add(mesh(cyl(0.3, 0.3, 0.02, 14), toon('#d35400'), 1.35, 0.13, 1.25));
    g.add(mesh(cyl(0.18, 0.18, 0.35, 10), C.iron(), 0.6, 0.25, 1.5));
    g.add(mesh(cone(0.1, 0.16, 6), toon('#f39c12', { emissive: '#e67e22' }), 0.6, 0.06, 1.72));
    for (let k = 0; k < 8; k++) g.add(mesh(ball(0.06, 0), toon(k % 2 ? '#c0392b' : '#e67e22'), 1.55 + (k % 4) * 0.1, 0.06, 0.45 + Math.floor(k / 4) * 0.1));
  },

  watchtower(g, b, st) {
    const big = st.era >= 2;
    const base = big ? 0.9 : 0;
    if (big) {
      const foot = mesh(cyl(0.62, 0.72, base, 14), C.rammed(), 1, base / 2, 1);
      foot.userData.uvScale = [Math.PI * 2 * 0.7 * WALL_UV, base * WALL_UV];
      g.add(foot);
      door(g, 1, 0.02, 1.68, 0.24, 0.5);
    }
    // Four leaning posts braced with cross-ties, a plank platform with a rail.
    const legH = big ? 1.0 : 1.7;
    for (const [x, z] of [[0.5, 0.5], [1.5, 0.5], [0.5, 1.5], [1.5, 1.5]]) {
      const leg = mesh(cyl(0.05, 0.065, legH, 7), C.wood(), x, base + legH / 2, z);
      leg.rotation.x = (z < 1 ? 1 : -1) * 0.05;
      leg.rotation.z = (x < 1 ? -1 : 1) * 0.05;
      g.add(leg);
    }
    for (const y of [base + legH * 0.35, base + legH * 0.7]) {
      for (const [x0, z0, x1, z1] of [[0.5, 0.5, 1.5, 0.5], [0.5, 1.5, 1.5, 1.5], [0.5, 0.5, 0.5, 1.5], [1.5, 0.5, 1.5, 1.5]]) {
        const tie = mesh(cyl(0.02, 0.02, 1.0, 4), C.wood(), (x0 + x1) / 2, y, (z0 + z1) / 2);
        if (z0 === z1) tie.rotation.z = Math.PI / 2;
        else tie.rotation.x = Math.PI / 2;
        g.add(tie);
      }
    }
    const top = base + legH;
    g.add(mesh(box(1.35, 0.08, 1.35), C.planks(), 1, top, 1));
    for (const [x, z, w, d] of [[1, 0.36, 1.3, 0.04], [1, 1.64, 1.3, 0.04], [0.36, 1, 0.04, 1.3], [1.64, 1, 0.04, 1.3]]) g.add(mesh(box(w, 0.28, d), C.planks(), x, top + 0.18, z));
    for (const [x, z] of [[0.38, 0.38], [1.62, 0.38], [0.38, 1.62], [1.62, 1.62]]) g.add(mesh(cyl(0.025, 0.025, 0.55, 5), C.wood(), x, top + 0.28, z));
    g.add(mesh(cone(1.05, 0.62, 12), C.thatch(), 1, top + 0.85, 1));
    g.add(mesh(cyl(0.03, 0.06, 0.18, 5), C.wood(), 1, top + 1.2, 1));
    flag(g, 1.62, 0.38, '#1f8f4e', top + 1.25);
  },

  // Bandit tents: hides stretched over a frame of poles, the pole ends
  // sticking out at the top.
  tent(g) {
    hideTent(g, 0.5, 0.5, 0.86, 0.8, 0.62, 0.35);
    const sack = mesh(ball(0.08, 1), toon('#8c7a55'), 0.86, 0.07, 0.86);
    sack.scale.set(1, 0.8, 1);
    g.add(sack);
  },

  // The Oba's host: war tents of red and white cloth.
  edotent(g) {
    hideTent(g, 0.5, 0.5, 0.86, 0.8, 0.66, 0.35, ['#b3241f', '#efe6d2', '#8e1a17']);
    const shield = mesh(ball(0.12, 1), toon('#7a3a1a'), 0.86, 0.13, 0.84);
    shield.scale.set(0.35, 1.3, 1);
    g.add(shield);
  },

  edochief(g) {
    hideTent(g, 1, 0.95, 1.55, 1.4, 1.0, 0.0, ['#efe6d2', '#b3241f', '#c9a227']);
    // The war drums before it, and the banner of Benin.
    for (const [x, z, r] of [[1.55, 1.7, 0.13], [1.8, 1.45, 0.1]]) {
      g.add(mesh(cyl(r, r * 0.8, r * 2.4, 10), toon('#6b3a1e'), x, r * 1.2, z));
      g.add(mesh(cyl(r * 1.02, r * 1.02, 0.02, 10), toon('#d9c7a2'), x, r * 2.4 + 0.01, z));
    }
    flag(g, 0.3, 0.3, '#a3171b', 1.8);
    flag(g, 1.8, 0.25, '#efe6d2', 1.4);
  },

  chieftent(g) {
    hideTent(g, 1, 0.95, 1.5, 1.35, 0.95, 0.0);
    // Stolen goods heaped by the door, and the bandits' black flag.
    for (const [x, z, c] of [[1.55, 1.75, '#8c7a55'], [1.72, 1.6, '#7a6a4a'], [1.35, 1.82, '#9a8760']]) {
      const sack = mesh(ball(0.1, 1), toon(c), x, 0.09, z);
      sack.scale.set(1, 0.85, 1);
      g.add(sack);
    }
    g.add(mesh(box(0.22, 0.16, 0.16), C.wood(), 0.45, 0.08, 1.75));
    flag(g, 0.3, 0.3, '#1d1d1d', 1.5);
  },

  warcamp(g, b) {
    earthPad(g, 3, 3);
    ring(g, 1.5, 1.5, 1.4, 22, C.wood(), 0.5);
    if ((b.level || 1) >= 2) gableHouse(g, 1.5, 0.85, 2.2, 0.85, 0.6, { wall: C.mud(), roof: C.zinc() });
    else if (b.mud) gableHouse(g, 1.5, 0.85, 2.2, 0.85, 0.6, { wall: C.mud(), verandah: true });
    // The guard house: a long barracks of planks with a verandah.
    else gableHouse(g, 1.5, 0.85, 2.2, 0.85, 0.6, { wall: C.planks(), plinth: C.wood(), verandah: true });
    for (let k = 0; k < 6; k++) {
      const s = mesh(cyl(0.015, 0.015, 0.8, 4), C.wood(), 1 + k * 0.18, 0.4, 2.2);
      s.rotation.x = -0.15;
      g.add(s);
      g.add(mesh(cone(0.03, 0.1, 4), toon('#c0c6c9'), 1 + k * 0.18, 0.84, 2.14));
    }
    // Training dummies.
    for (const x of [0.8, 2.2]) {
      g.add(mesh(cyl(0.03, 0.03, 0.6, 5), C.wood(), x, 0.3, 2.3));
      g.add(mesh(ball(0.1, 0), C.thatch(), x, 0.62, 2.3));
    }
    flag(g, 1.5, 1.5, '#1f8f4e', 1.8);
  },

  palace(g, b, st) {
    earthPad(g, 4, 5.4);
    const modern = (b.level || 1) >= 2;
    const wallM = modern ? C.plaster() : toon('#a65a35', { map: 'mud' });
    const roofM = modern ? toon('#b5532f') : st.era >= 3 ? C.zinc() : C.thatch();
    gableHouse(g, 2, 0.5, 3.8, 0.9, 0.85, { wall: wallM, roof: roofM });
    gableHouse(g, 2, 3.5, 3.8, 0.9, 0.85, { wall: wallM, roof: roofM });
    for (const x of [0.45, 3.55]) {
      const side = gableHouse(new THREE.Group(), 0, 0, 2.1, 0.85, 0.85, { wall: wallM, roof: roofM });
      side.rotation.y = Math.PI / 2;
      side.position.set(x, 0, 2);
      g.add(side);
    }
    g.add(mesh(cyl(0.3, 0.3, 0.04, 14), toon('#5b8fa3'), 2, 0.05, 2));
    // Carved veranda posts at the gate.
    for (let k = 0; k < 4; k++) g.add(mesh(cyl(0.05, 0.06, 0.9, 6), toon('#5a3a20'), 1.4 + k * 0.4, 0.45, 4.05));
    if (modern) {
      g.add(mesh(box(1.2, 1.4, 1), C.plaster(), 2, 0.7, 2));
      g.add(mesh(cyl(0.45, 0.45, 0.3, 16), toon('#0d6b3a'), 2, 1.55, 2));
    }
    // The town square in front, with its shade tree.
    const square = mesh(cyl(1, 1, 0.03, 24), toon('#c49a6c'), 2, 0.015, 5);
    square.scale.set(1.9, 1, 0.6);
    square.castShadow = false;
    g.add(square);
    g.add(mesh(cyl(0.08, 0.12, 0.8, 7), C.wood(), 0.5, 0.4, 5));
    g.add(mesh(ball(0.6, 1), C.leafDark(), 0.5, 1.05, 5));
    flag(g, 0.3, 0.2, '#1f8f4e', 2);
    flag(g, 3.7, 0.2, '#f1c40f', 2);
  },

  ironmine(g) {
    g.add(mesh(ball(0.95, 0), toon('#7d6a58'), 1, 0.1, 0.9));
    g.add(mesh(box(0.7, 0.6, 0.1), C.dark(), 1, 0.35, 1.72));
    for (const x of [0.62, 1.38]) g.add(mesh(box(0.08, 0.7, 0.08), C.wood(), x, 0.35, 1.78));
    g.add(mesh(box(0.9, 0.08, 0.1), C.wood(), 1, 0.72, 1.78));
    g.add(mesh(box(0.35, 0.18, 0.25), C.iron(), 1.6, 0.12, 1.75));
  },

  blacksmith(g) {
    earthPad(g, 2, 2);
    gableHouse(g, 0.8, 0.8, 1.3, 1, 0.6, { windows: false });
    g.add(mesh(cone(0.3, 0.6, 10), C.mudDark(), 1.55, 0.3, 1.45));
    const glow = mesh(ball(0.1, 0), toon('#ff8c1a', { emissive: '#ff6a00' }), 1.55, 0.2, 1.72);
    glow.userData.flame = true;
    g.add(glow);
    g.add(mesh(box(0.25, 0.15, 0.12), C.iron(), 0.6, 0.2, 1.65));
  },

  canoeyard(g) {
    g.add(mesh(box(1.9, 0.04, 1.9), toon('#d9c290'), 1, 0.02, 1));
    for (let k = 0; k < 3; k++) {
      const c = mesh(geo('canoe', () => new THREE.CapsuleGeometry(0.16, 1.1, 4, 8)), toon('#6b4226'), 1, 0.12, 0.45 + k * 0.5);
      c.rotation.z = Math.PI / 2;
      c.rotation.y = -0.1 + k * 0.1;
      c.scale.set(1, 1, 0.55);
      g.add(c);
    }
  },

  port(g, b, st) {
    g.add(mesh(box(2.9, 0.1, 2.9), C.planks(), 1.5, 0.08, 1.5));
    gableHouse(g, 1.1, 1, 1.8, 1.2, 0.8, { wall: C.plaster(), roof: toon('#c25b35', { map: 'tiles' }) });
    for (let k = 0; k < 4; k++) g.add(mesh(cyl(0.13, 0.13, 0.32, 10), toon('#8b5a2b'), 2.3 + (k % 2) * 0.3, 0.26, 0.6 + Math.floor(k / 2) * 0.35));
    for (let k = 0; k < 3; k++) g.add(mesh(box(0.28, 0.28, 0.28), C.planks(), 0.6 + k * 0.35, 0.24, 2.4));
    // A simple crane for unloading.
    g.add(mesh(box(0.08, 1.3, 0.08), C.wood(), 2.5, 0.75, 2.2));
    const arm = mesh(box(0.9, 0.06, 0.06), C.wood(), 2.2, 1.35, 2.2);
    g.add(arm);
    const partner = st.flags.britishPartner || st.flags.colonized ? '#b22234' : st.flags.frenchPact ? '#2c5aa0' : '#c9a227';
    flag(g, 0.3, 0.3, partner, 1.7);
  },

  fort(g) {
    earthPad(g, 3, 3);
    const H = 0.9;
    earthWall(g, 0.3, 0.22, 2.7, 0.22, H);
    earthWall(g, 0.22, 0.3, 0.22, 2.7, H);
    earthWall(g, 2.78, 0.3, 2.78, 2.7, H);
    earthWall(g, 0.3, 2.78, 1.2, 2.78, H);
    earthWall(g, 1.8, 2.78, 2.7, 2.78, H);
    for (const [x, z] of [[0.25, 0.25], [2.75, 0.25], [0.25, 2.75], [2.75, 2.75]]) bastion(g, x, z, 0.36, 1.05);
    // Gatehouse over the entrance.
    for (const x of [1.13, 1.87]) earthBox(g, 0.2, 1.0, 0.6, x, 0.5, 2.78);
    const roof = mesh(prism(0.95, 0.85, 0.36), C.thatch(), 1.5, 1.02, 2.78);
    roof.rotation.y = Math.PI / 2;
    g.add(roof);
    g.add(mesh(box(0.54, 0.82, 0.05), C.planks(), 1.5, 0.41, 3.02));
    // The war chief's house in the yard.
    gableHouse(g, 1.5, 1.25, 1.3, 0.85, 0.6, { verandah: true });
    // Imported cannon behind the walls.
    cannon(g, 1.0, 0.62, 0);
    cannon(g, 2.0, 0.62, 0);
    cannon(g, 0.62, 2.1, Math.PI / 2);
    cannon(g, 2.38, 2.1, -Math.PI / 2);
    g2(g, 'pot', 2.3, 2.4);
    flag(g, 2.75, 0.25, '#1f8f4e', 2.3);
  },

  school(g) {
    earthPad(g, 3, 2);
    gableHouse(g, 1.5, 0.9, 2.7, 1.1, 0.8, { wall: C.plaster(), roof: C.zinc() });
    for (let k = 0; k < 4; k++) g.add(mesh(box(0.3, 0.3, 0.04), C.glass(), 0.5 + k * 0.65, 0.48, 1.47));
    flag(g, 2.8, 1.7, '#1f8f4e', 1.6);
  },

  assembly(g) {
    earthPad(g, 3, 3);
    g.add(mesh(box(2.6, 1, 2.2), C.white(), 1.5, 0.5, 1.4));
    for (let k = 0; k < 6; k++) g.add(mesh(cyl(0.07, 0.07, 1, 8), toon('#e6dfcf'), 0.35 + k * 0.46, 0.5, 2.6));
    g.add(mesh(box(2.8, 0.1, 0.5), toon('#e6dfcf'), 1.5, 1.05, 2.6));
    const dome = mesh(geo('dome', () => new THREE.SphereGeometry(0.75, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), toon('#1a8a4f'), 1.5, 1, 1.4);
    g.add(dome);
    nigeriaFlag(g, 1.5, 0.3);
  },

  hospital(g) {
    earthPad(g, 3, 3);
    g.add(mesh(box(2.6, 1.2, 1.6), C.white(), 1.5, 0.6, 1.2));
    g.add(mesh(box(2.7, 0.08, 1.7), toon('#cfd8dc'), 1.5, 1.24, 1.2));
    for (let k = 0; k < 4; k++) g.add(mesh(box(0.35, 0.3, 0.04), C.glass(), 0.5 + k * 0.65, 0.7, 2.02));
    g.add(mesh(box(0.5, 0.15, 0.05), toon('#1a8a4f'), 1.5, 1.05, 2.03));
    g.add(mesh(box(0.15, 0.5, 0.05), toon('#1a8a4f'), 1.5, 1.05, 2.04));
  },

  factory(g) {
    earthPad(g, 3, 3, '#8f877b');
    g.add(mesh(box(2.4, 1, 1.8), toon('#9aa3a8', { map: 'zinc' }), 1.4, 0.5, 1.4));
    for (let k = 0; k < 3; k++) g.add(mesh(prism(0.75, 1.8, 0.3), C.zinc(), 0.65 + k * 0.75, 1, 1.4));
    g.add(mesh(cyl(0.16, 0.2, 2, 10), toon('#8a4b32'), 2.6, 1, 0.5));
    g.add(mesh(box(0.6, 0.6, 0.04), C.dark(), 1.4, 0.3, 2.31));
    for (let k = 0; k < 4; k++) g.add(mesh(box(0.28, 0.28, 0.28), C.planks(), 0.4 + k * 0.32, 0.14, 2.7));
  },

  bank(g) {
    earthPad(g, 2, 2);
    g.add(mesh(box(1.7, 1.1, 1.4), toon('#e9e4d8'), 1, 0.55, 0.95));
    for (let k = 0; k < 4; k++) g.add(mesh(cyl(0.06, 0.06, 1, 8), C.white(), 0.4 + k * 0.4, 0.5, 1.72));
    g.add(mesh(prism(1.8, 0.6, 0.3), toon('#e9e4d8'), 1, 1.1, 1.72));
    g.add(mesh(box(0.4, 0.5, 0.04), toon('#3b2a1a'), 1, 0.25, 1.66));
  },
};

function fence(g, w, d) {
  const stake = cyl(0.02, 0.025, 0.28, 4);
  for (let x = 0.1; x < w; x += 0.35) {
    g.add(mesh(stake, C.wood(), x, 0.14, 0.05));
    g.add(mesh(stake, C.wood(), x, 0.14, d - 0.05));
  }
  for (let z = 0.4; z < d - 0.2; z += 0.35) {
    g.add(mesh(stake, C.wood(), 0.05, 0.14, z));
    g.add(mesh(stake, C.wood(), w - 0.05, 0.14, z));
  }
}

function ring(g, cx, cz, r, n, mat, h) {
  const stake = cyl(0.04, 0.05, h, 5);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    g.add(mesh(stake, mat, cx + Math.cos(a) * r, h / 2, cz + Math.sin(a) * r));
  }
}

function wall(g, n, earth) {
  const arms = [['l', [0, 0.5]], ['r', [1, 0.5]], ['u', [0.5, 0]], ['d', [0.5, 1]]].filter(([k]) => n[k]);
  const straight = (n.l && n.r && !n.u && !n.d) || (n.u && n.d && !n.l && !n.r);
  if (earth) {
    const H = 0.95;
    for (const [, [x, z]] of arms) earthWall(g, 0.5, 0.5, x, z, H);
    if (!arms.length) earthWall(g, 0.15, 0.5, 0.85, 0.5, H);
    // Corners, junctions and ends get a thatched lookout post.
    if (!straight) bastion(g, 0.5, 0.5, 0.4, 1.12);
    return;
  }
  // Wooden fence: bundles of four or five sharpened stakes lashed together
  // with rope, set close in a line and tied to two rails.
  const spots = [[0.5, 0.5]];
  for (const [, [x, z]] of arms) spots.push([0.5 + (x - 0.5) * 0.5, 0.5 + (z - 0.5) * 0.5]);
  if (spots.length === 1) spots.push([0.25, 0.5], [0.75, 0.5]);
  const rope = toon('#c8a46a');
  for (const [x, z] of spots) {
    const seed = Math.sin(x * 91 + z * 57) * 0.5 + 0.5;
    const n = seed > 0.5 ? 5 : 4;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + seed;
      const sx = x + Math.cos(a) * 0.075;
      const sz = z + Math.sin(a) * 0.075;
      const h = 0.78 + ((Math.sin((sx + sz) * 113) * 0.5 + 0.5) * 0.28);
      const r = 0.042 + (k % 2) * 0.008;
      g.add(mesh(cyl(r, r * 1.08, h, 6), C.wood(), sx, h / 2, sz));
      g.add(mesh(cone(r, 0.14, 6), C.wood(), sx, h + 0.07, sz));
    }
    for (const y of [0.24, 0.6]) g.add(mesh(cyl(0.125, 0.125, 0.05, 10), rope, x, y, z));
  }
  for (const [, [x, z]] of arms) {
    for (const y of [0.3, 0.62]) {
      const rail = mesh(cyl(0.022, 0.022, 0.55, 5), C.wood(), (0.5 + x) / 2, y, (0.5 + z) / 2);
      if (z === 0.5) rail.rotation.z = Math.PI / 2;
      else rail.rotation.x = Math.PI / 2;
      g.add(rail);
    }
  }
}

function nigeriaFlag(g, x, z) {
  g.add(mesh(cyl(0.03, 0.03, 2.2, 6), C.wood(), x, 1.1, z));
  for (let k = 0; k < 3; k++) g.add(mesh(box(0.2, 0.36, 0.02), toon(k === 1 ? '#ffffff' : '#008751'), x + 0.12 + k * 0.2, 2, z));
}

// Bake a model's many small meshes into one mesh per material, so a whole
// building costs a handful of draw calls. Animated parts (flames, flags) stay
// separate.
export function mergeModel(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  const keep = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.flame || o.userData.flag) {
      keep.push(o);
      return;
    }
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(o);
  });
  const out = new THREE.Group();
  for (const [material, meshes] of buckets) {
    const pos = [];
    const nor = [];
    const uv = [];
    for (const m of meshes) {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      if (m.userData.uvScale && g.attributes.uv) {
        const [su, sv] = m.userData.uvScale;
        const a = g.attributes.uv.array;
        for (let i = 0; i < a.length; i += 2) {
          a[i] *= su;
          a[i + 1] *= sv;
        }
      }
      g.applyMatrix4(m.matrixWorld);
      const p = g.attributes.position.array;
      const n = g.attributes.normal ? g.attributes.normal.array : new Float32Array(p.length);
      let t = g.attributes.uv ? g.attributes.uv.array : new Float32Array((p.length / 3) * 2);
      if (m.userData.boxUV) {
        // Project the texture onto each face from its main axis, in world units.
        const k = m.userData.boxUV;
        t = new Float32Array((p.length / 3) * 2);
        for (let i = 0; i < p.length / 3; i += 3) {
          const ax = Math.abs(n[i * 3]);
          const ay = Math.abs(n[i * 3 + 1]);
          const az = Math.abs(n[i * 3 + 2]);
          for (let j = i; j < i + 3; j++) {
            const x = p[j * 3];
            const y = p[j * 3 + 1];
            const z = p[j * 3 + 2];
            const [u, v] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [x, z] : [x, y];
            t[j * 2] = u * k;
            t[j * 2 + 1] = v * k;
          }
        }
      }
      for (let i = 0; i < p.length; i++) pos.push(p[i]);
      for (let i = 0; i < n.length; i++) nor.push(n[i]);
      for (let i = 0; i < t.length; i++) uv.push(t[i]);
      g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const mm = new THREE.Mesh(merged, material);
    mm.userData.merged = true;
    mm.castShadow = true;
    mm.receiveShadow = true;
    out.add(mm);
  }
  for (const o of keep) {
    const c = o.clone();
    o.matrixWorld.decompose(c.position, c.quaternion, c.scale);
    c.userData = o.userData;
    out.add(c);
  }
  return out;
}

export function disposeModel(group) {
  group.traverse((o) => {
    if (o.userData.merged) o.geometry.dispose();
  });
}

export function buildingModel(b, st, neighbours) {
  const g = new THREE.Group();
  const fn = BUILD[b.type];
  if (fn) fn(g, b, st, neighbours || { l: false, r: false, u: false, d: false });
  else g.add(mesh(box(b.w, 0.6, b.h), C.mud(), b.w / 2, 0.3, b.h / 2));
  return g;
}

// --- Villages of other peoples ---------------------------------------------------

export function villageModel(f, color) {
  const g = new THREE.Group();
  const pad = mesh(cyl(1, 1, 0.03, 28), toon('#b88a5c'), 0, 0.015, 0);
  pad.scale.set(4, 1, 3.4);
  pad.castShadow = false;
  g.add(pad);
  if (f.style === 'camp') {
    for (let k = 0; k < f.huts; k++) {
      const a = (k / f.huts) * Math.PI * 2;
      const tent = mesh(cone(0.5, 0.7, 4), toon('#6d5a43'), Math.cos(a) * 2, 0.35, Math.sin(a) * 1.7);
      tent.rotation.y = Math.PI / 4;
      g.add(tent);
    }
    g.add(mesh(cone(0.18, 0.4, 7), toon('#f39c12', { emissive: '#e67e22' }), 0, 0.2, 0.3));
  } else {
    for (let k = 0; k < f.huts; k++) {
      const a = (k / f.huts) * Math.PI * 2 + ((f.x * 13 + k * 7) % 10) * 0.05;
      const r = 1.6 + ((k * 37 + f.y) % 10) * 0.12;
      roundHut(g, Math.cos(a) * r, Math.sin(a) * r * 0.85, 0.42);
    }
    roundHut(g, 0, -0.2, 0.6, { roof: toon(color, { map: 'thatch' }) });
  }
  ring(g, 0, 0, 3.6, 46, toon('#6b4226'), 0.55);
  const fl = new THREE.Group();
  flag(fl, 0.9, 0.9, color, 2.2);
  g.add(fl);
  return g;
}

// --- Ships -------------------------------------------------------------------------

export function shipModel(color, power) {
  const g = new THREE.Group();
  const hull = mesh(geo('hull', () => new THREE.CapsuleGeometry(0.55, 2.4, 4, 10)), toon('#5b3a1f'), 0, 0.15, 0);
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(0.7, 1, 1);
  g.add(hull);
  g.add(mesh(box(2.6, 0.12, 0.8), C.planks(), 0, 0.45, 0));
  const sail = (x, h, w) => {
    g.add(mesh(cyl(0.04, 0.05, h, 6), C.wood(), x, 0.45 + h / 2, 0));
    const s = mesh(box(0.04, h * 0.6, w), toon('#f2ece0'), x + 0.05, 0.55 + h * 0.55, 0);
    g.add(s);
    if (power === 'portuguese') {
      g.add(mesh(box(0.05, h * 0.35, 0.08), toon('#c0392b'), x + 0.08, 0.55 + h * 0.55, 0));
      g.add(mesh(box(0.05, 0.08, w * 0.45), toon('#c0392b'), x + 0.08, 0.55 + h * 0.6, 0));
    }
  };
  sail(-0.7, 1.6, 1.2);
  sail(0.4, 2, 1.4);
  sail(1.2, 1.1, 0.8);
  const fl = new THREE.Group();
  flag(fl, 0.4, 0, color, 2.8);
  fl.position.y = 0.4;
  g.add(fl);
  return g;
}
