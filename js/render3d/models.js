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

const BUILD = {
  compound(g, b, st) {
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
      roundHut(g, 1, 0.95, 0.62);
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

  woodcutter(g) {
    earthPad(g, 2, 2);
    gableHouse(g, 0.75, 0.75, 1.1, 0.9, 0.5, { windows: false });
    const log = cyl(0.1, 0.1, 0.8, 8);
    for (let k = 0; k < 5; k++) {
      const m = mesh(log, C.wood(), 1.45 + (k % 3) * 0.02, 0.1 + Math.floor(k / 3) * 0.18, 1.2 + (k % 3) * 0.2);
      m.rotation.z = Math.PI / 2;
      g.add(m);
    }
    g.add(mesh(cyl(0.14, 0.16, 0.18, 10), toon('#b98b5a'), 0.5, 0.09, 1.55));
  },

  hunter(g) {
    earthPad(g, 2, 2);
    roundHut(g, 0.7, 0.75, 0.5);
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
    inner.add(mesh(box(0.1, 0.9, 0.12), C.wood(), 0.05, 0.45, 0));
    inner.add(mesh(box(0.1, 0.9, 0.12), C.wood(), 0.95, 0.45, 0));
    inner.add(mesh(box(0.8, 0.55, 0.06), C.planks(), 0.5, 0.35, 0));
    inner.add(mesh(box(1, 0.08, 0.14), C.wood(), 0.5, 0.88, 0));
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

  watchtower(g) {
    for (const [x, z] of [[0.45, 0.45], [1.55, 0.45], [0.45, 1.55], [1.55, 1.55]]) {
      const leg = mesh(cyl(0.05, 0.06, 1.7, 6), C.wood(), x, 0.85, z);
      leg.rotation.x = (z < 1 ? 1 : -1) * 0.06;
      leg.rotation.z = (x < 1 ? -1 : 1) * 0.06;
      g.add(leg);
    }
    g.add(mesh(box(1.4, 0.4, 1.4), C.planks(), 1, 1.75, 1));
    g.add(mesh(cone(1.05, 0.6, 4), C.thatch(), 1, 2.25, 1));
    flag(g, 1.6, 0.5, '#1f8f4e', 2.6);
  },

  warcamp(g, b) {
    earthPad(g, 3, 3);
    ring(g, 1.5, 1.5, 1.4, 22, C.wood(), 0.5);
    roundHut(g, 0.9, 0.9, 0.42);
    if ((b.level || 1) >= 2) gableHouse(g, 2.1, 0.9, 1.2, 0.8, 0.55, { wall: C.stone(), roof: C.zinc() });
    else roundHut(g, 2.1, 1, 0.42);
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
    gableHouse(g, 1.1, 1, 1.8, 1.2, 0.8, { wall: C.plaster(), roof: C.red() });
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
    const wallM = C.stone();
    for (const [x, z, w, d] of [[1.5, 0.2, 2.9, 0.4], [1.5, 2.8, 2.9, 0.4], [0.2, 1.5, 0.4, 2.9], [2.8, 1.5, 0.4, 2.9]]) g.add(mesh(box(w, 0.8, d), wallM, x, 0.4, z));
    for (const [x, z] of [[0.2, 0.2], [2.8, 0.2], [0.2, 2.8], [2.8, 2.8]]) g.add(mesh(cyl(0.35, 0.4, 1, 8), wallM, x, 0.5, z));
    g.add(mesh(box(1.4, 0.6, 1.4), toon('#b4ad9f'), 1.5, 0.3, 1.5));
    for (const [x, z, r] of [[1.5, 0.05, 0], [2.95, 1.5, Math.PI / 2], [0.05, 1.5, -Math.PI / 2]]) {
      const c = mesh(cyl(0.06, 0.08, 0.6, 8), C.iron(), x, 0.85, z);
      c.rotation.x = Math.PI / 2;
      c.rotation.z = r;
      g.add(c);
    }
    flag(g, 1.5, 1.5, '#1f8f4e', 2);
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

function wall(g, n, stone) {
  const m = stone ? C.stone() : C.wood();
  const h = stone ? 0.7 : 0.75;
  if (stone) {
    g.add(mesh(box(0.42, h + 0.1, 0.42), m, 0.5, (h + 0.1) / 2, 0.5));
    if (n.l) g.add(mesh(box(0.5, h, 0.32), m, 0.25, h / 2, 0.5));
    if (n.r) g.add(mesh(box(0.5, h, 0.32), m, 0.75, h / 2, 0.5));
    if (n.u) g.add(mesh(box(0.32, h, 0.5), m, 0.5, h / 2, 0.25));
    if (n.d) g.add(mesh(box(0.32, h, 0.5), m, 0.5, h / 2, 0.75));
    return;
  }
  const stake = cyl(0.06, 0.07, h, 6);
  const tip = cone(0.07, 0.15, 6);
  const spots = [[0.5, 0.5]];
  if (n.l) spots.push([0.15, 0.5], [0.32, 0.5]);
  if (n.r) spots.push([0.68, 0.5], [0.85, 0.5]);
  if (n.u) spots.push([0.5, 0.15], [0.5, 0.32]);
  if (n.d) spots.push([0.5, 0.68], [0.5, 0.85]);
  if (spots.length === 1) spots.push([0.32, 0.5], [0.68, 0.5]);
  for (const [x, z] of spots) {
    g.add(mesh(stake, m, x, h / 2, z));
    g.add(mesh(tip, m, x, h + 0.07, z));
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
      g.applyMatrix4(m.matrixWorld);
      const p = g.attributes.position.array;
      const n = g.attributes.normal ? g.attributes.normal.array : new Float32Array(p.length);
      const t = g.attributes.uv ? g.attributes.uv.array : new Float32Array((p.length / 3) * 2);
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
