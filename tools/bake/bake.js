// Bakes the game's 2D isometric sprites from its 3D models: every building
// (each level, in wood and in mud), trees, rocks and the red-mud pits, goods
// stacked on the storage floors and loads carried on the head, animals, and
// every person in every movement from five directions (the other three are
// mirror images). The camera is the game's fixed isometric view: looking
// from the south-east, 30 degrees down, so a tile is a 2:1 diamond.
//
// Open tools/bake/index.html from a local server (see tools/bake/run.mjs,
// which drives it and writes art/iso/). The page packs everything into
// sheets and hands them back as images plus a JSON index.

import * as THREE from '../../js/vendor/three.module.js';
import { buildingModel, villageModel, shipModel } from '../../js/render3d/models.js';
import { Flora } from '../../js/render3d/flora.js';
import { People } from '../../js/render3d/people.js';
import { Characters } from '../../js/render3d/characters.js';
import { Stocks } from '../../js/render3d/stocks.js';
import { makeProp, makeWear, WEAR_AT } from '../../js/render3d/props.js';
import { BUILDINGS } from '../../js/data/buildings.js';
import { CHARACTERS } from '../../js/data/people.js';
import { REGIONS } from '../../js/regions/index.js';
import { T, F } from '../../js/world/terrain.js';

// Pixels per world unit across the screen, at the scale sprites are stored
// (twice the game's zoom-1 size, so they stay sharp when zoomed in). A tile
// is then 128 x 64 pixels.
export const SCALE = 64 * Math.SQRT2;
const SUPER = 2; // rendered this much larger, then scaled down: smooth edges
const ELEV = Math.PI / 6;
const YAW = Math.PI / 4;
const SHEET = 2048;

const log = (s) => {
  document.getElementById('log').textContent += `\n${s}`;
};

// --- The studio -----------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const hemi = new THREE.HemisphereLight('#dff1ff', '#6b5236', 1.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0d6', 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(sun.target);
// The sun stands in the south-west, high up: light from the left of the
// screen, shadows falling back and to the right.
const SUN_DIR = new THREE.Vector3(-0.55, 1.25, 0.35).normalize();

// Shadows land on an invisible floor and are kept in the sprite.
const catcher = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.32 }));
catcher.receiveShadow = true;
catcher.position.y = 0.001;

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
camera.position.set(Math.cos(ELEV) * Math.sin(YAW), Math.sin(ELEV), Math.cos(ELEV) * Math.cos(YAW)).multiplyScalar(30);
camera.up.set(0, 1, 0);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld(true);
const VIEW = camera.matrixWorldInverse.clone();

function toView(p) {
  return p.clone().applyMatrix4(VIEW);
}

// --- Taking a picture ---------------------------------------------------------------

// Renders `object` (placed so that `origin` is its anchor) into a trimmed
// canvas. `box` overrides the measured bounds (skinned people), `shadow`
// keeps its shadow on the ground.
function shoot(object, { origin = new THREE.Vector3(), box = null, shadow = true, pad = 3 } = {}) {
  scene.add(object);
  object.updateMatrixWorld(true);
  const b = box ? box.clone() : new THREE.Box3().setFromObject(object);
  if (b.isEmpty()) {
    scene.remove(object);
    return null;
  }
  const pts = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new THREE.Vector3(x, y, z));
  if (shadow) {
    // Where the top of the object casts its shadow on the ground.
    for (const p of pts.slice()) {
      if (p.y <= 0.001) continue;
      const k = p.y / SUN_DIR.y;
      pts.push(new THREE.Vector3(p.x - SUN_DIR.x * k, 0, p.z - SUN_DIR.z * k));
    }
    scene.add(catcher);
    const c = b.getCenter(new THREE.Vector3());
    const r = b.getSize(new THREE.Vector3()).length() + 2;
    sun.target.position.set(c.x, 0, c.z);
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 30);
    const sc = sun.shadow.camera;
    sc.left = -r;
    sc.right = r;
    sc.top = r;
    sc.bottom = -r;
    sc.near = 1;
    sc.far = 80;
    sc.updateProjectionMatrix();
    sun.target.updateMatrixWorld();
  } else {
    sun.position.copy(SUN_DIR).multiplyScalar(30);
    sun.target.position.set(0, 0, 0);
  }
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    const v = toView(p);
    x0 = Math.min(x0, v.x);
    x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, v.y);
    y1 = Math.max(y1, v.y);
  }
  const p = pad / SCALE;
  x0 -= p;
  x1 += p;
  y0 -= p;
  y1 += p;
  const w = Math.max(1, Math.ceil((x1 - x0) * SCALE));
  const h = Math.max(1, Math.ceil((y1 - y0) * SCALE));
  x1 = x0 + w / SCALE;
  y0 = y1 - h / SCALE;
  camera.left = x0;
  camera.right = x1;
  camera.top = y1;
  camera.bottom = y0;
  camera.updateProjectionMatrix();
  renderer.setSize(w * SUPER, h * SUPER, false);
  renderer.render(scene, camera);
  scene.remove(object);
  scene.remove(catcher);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(renderer.domElement, 0, 0, w * SUPER, h * SUPER, 0, 0, w, h);
  const o = toView(origin);
  return trim({ canvas: out, ax: (o.x - x0) * SCALE, ay: (y1 - o.y) * SCALE });
}

// Cut away the empty border.
function trim(s) {
  const { canvas } = s;
  const g = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const data = g.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 3) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const c = document.createElement('canvas');
  c.width = x1 - x0 + 1;
  c.height = y1 - y0 + 1;
  c.getContext('2d').drawImage(canvas, -x0, -y0);
  return { canvas: c, ax: s.ax - x0, ay: s.ay - y0 };
}

// --- What to bake ---------------------------------------------------------------------

const sprites = new Map(); // key -> { canvas, ax, ay }
function keep(key, s) {
  if (s) sprites.set(key, s);
}

// Headings, as the 3D game turns a figure: 0 faces down the map (+z). The
// five baked directions, by where they point on screen.
export const DIRS = [
  { name: 'S', heading: Math.atan2(1, 1) }, // down the screen
  { name: 'SE', heading: Math.atan2(1, 0) }, // down and right
  { name: 'E', heading: Math.atan2(1, -1) }, // right
  { name: 'NE', heading: Math.atan2(0, -1) }, // up and right
  { name: 'N', heading: Math.atan2(-1, -1) }, // up
];

const fakeSt = (era = 0, flags = {}) => ({ era, flags, W: 1, H: 1 });

function eraVariants(type) {
  return { compound: [0, 3], gate: [0, 2], watchtower: [1, 2], palace: [1, 3] }[type] || [null];
}

function buildingVariants() {
  const out = [];
  for (const [type, def] of Object.entries(BUILDINGS)) {
    const levels = 1 + (def.upgrades?.length || 0);
    for (let level = 1; level <= levels; level++) {
      const muds = def.mudBricks ? [false, true] : [false];
      for (const mud of muds) {
        if (type === 'hut' && ((level === 1 && mud) || (level === 2 && !mud))) continue;
        if (type === 'hut' && level > 2 && !mud) continue;
        for (const era of eraVariants(type)) {
          const growths = def.job?.type === 'farm' ? [0, 0.35, 0.7, 1] : [null];
          for (const growth of growths) {
            let key = `b/${type}/${level}${mud ? 'm' : ''}`;
            if (era !== null) key += `/e${era}`;
            if (growth !== null) key += `/g${Math.round(growth * 100)}`;
            out.push({ key, type, level, mud, era: era ?? 1, growth: growth ?? 0.7, def });
          }
        }
      }
    }
  }
  return out;
}

// A model turned a quarter turn `r` times, the way the game turns its view
// (see js/render/iso.js), and set back on its footprint so that the corner
// at the top of the screen is again at the origin.
function turned(model, w, h, r) {
  if (!r) return model;
  const a = (-r * Math.PI) / 2;
  const c = Math.round(Math.cos(a));
  const s = Math.round(Math.sin(a));
  const xs = [];
  const zs = [];
  for (const [x, z] of [[0, 0], [w, 0], [0, h], [w, h]]) {
    xs.push(x * c + z * s);
    zs.push(-x * s + z * c);
  }
  model.rotation.y = a;
  model.position.set(-Math.min(...xs), 0, -Math.min(...zs));
  const g = new THREE.Group();
  g.add(model);
  return g;
}

function bakeBuildings(turns = [0]) {
  const NO = { l: false, r: false, u: false, d: false };
  for (const v of buildingVariants()) {
    if (v.def.line) continue;
    if (v.type === 'gate') continue;
    const b = { id: 3, type: v.type, w: v.def.w, h: v.def.h, level: v.level, mud: v.mud, built: 1, growth: v.growth, workers: [] };
    const port = v.type === 'port';
    const flagsList = port ? [{}, { frenchPact: true }, { britishPartner: true }] : [{}];
    for (const r of turns) {
      // Farm land looks the same from every side.
      if (r && v.def.job?.type === 'farm') continue;
      for (const flags of flagsList) {
        const st = fakeSt(v.era, flags);
        const g = buildingModel(b, st, NO);
        // Flames and flags move: the game draws flames itself.
        const flames = [];
        g.traverse((o) => o.userData.flame && flames.push(o));
        for (const o of flames) o.parent.remove(o);
        const key = port ? `${v.key}/${flags.frenchPact ? 'f' : flags.britishPartner ? 'b' : 'p'}` : v.key;
        keep(r ? `${key}@${r}` : key, shoot(turned(g, b.w, b.h, r)));
      }
    }
  }
  // The founders' house as they find it: a wreck, until it is mended.
  for (const r of turns) {
    const b = { id: 3, type: 'compound', w: 3, h: 3, level: 1, built: 1, wreck: true, workers: [] };
    keep(r ? `b/compound/wreck@${r}` : 'b/compound/wreck', shoot(turned(buildingModel(b, fakeSt(0), NO), 3, 3, r)));
  }
  if (turns[0] !== 0) return;
  // Fence and wall sections join their neighbours: one picture for each of
  // the sixteen ways they can.
  for (const type of ['palisade', 'stonewall']) {
    for (let m = 0; m < 16; m++) {
      const n = { l: !!(m & 1), r: !!(m & 2), u: !!(m & 4), d: !!(m & 8) };
      const b = { id: 3, type, w: 1, h: 1, level: 1, built: 1, workers: [] };
      keep(`w/${type}/${m}`, shoot(buildingModel(b, fakeSt(), n)));
    }
  }
  for (const era of [0, 2]) {
    for (const [dir, n] of [['h', { l: true, r: true, u: false, d: false }], ['v', { l: false, r: false, u: true, d: true }]]) {
      const b = { id: 3, type: 'gate', w: 1, h: 1, level: 1, built: 1, workers: [] };
      keep(`w/gate/${dir}/e${era}`, shoot(buildingModel(b, fakeSt(era), n)));
    }
  }
}

function bakeVillages() {
  const factions = [...Object.values(REGIONS).flatMap((r) => r.factions), { id: 'slavers', style: 'camp', huts: 3, color: '#222', x: 0, y: 0 }];
  for (const f of factions) {
    const def = { ...f, x: 10, y: 10, huts: f.huts || 3 + f.strength * 2, style: f.style || 'village' };
    const g = villageModel(def, f.color);
    const flames = [];
    g.traverse((o) => o.userData.flame && flames.push(o));
    for (const o of flames) o.parent.remove(o);
    keep(`v/${f.id}`, shoot(g));
  }
  for (const [power, color] of Object.entries({ portuguese: '#c9a227', french: '#2c5aa0', british: '#b22234', merchant: '#999999' })) {
    for (const [dir, ry] of [['a', 0], ['b', Math.PI / 2]]) {
      const g = shipModel(color, power);
      g.rotation.y = ry;
      keep(`ship/${power}/${dir}`, shoot(g, { shadow: false }));
    }
  }
}

// --- Plants, rocks and the red-mud pits --------------------------------------------------

function bakeFlora() {
  const flora = new Flora(new THREE.Scene(), { W: 1, H: 1, seed: 1, terrain: new Uint8Array(1), trees: new Uint8Array(1), feature: new Uint8Array(1), amount: new Uint16Array(1), occ: new Int32Array(1) }, () => 0, false);
  const part = (kind, s, ry, tint = '#ffffff', sy = s, lean = 0) => {
    const m = new THREE.InstancedMesh(flora.templates[kind], flora.kinds[kind].mat, 1);
    const M = new THREE.Matrix4().compose(new THREE.Vector3(), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, ry, 0)), new THREE.Vector3(s, sy, s));
    m.setMatrixAt(0, M);
    m.setColorAt(0, new THREE.Color(tint));
    m.castShadow = true;
    if (flora.kinds[kind].depth) m.customDepthMaterial = flora.kinds[kind].depth;
    return m;
  };
  const group = (...parts) => {
    const g = new THREE.Group();
    for (const p of parts) g.add(p);
    return g;
  };
  // Rainforest trees, big and close-packed.
  const tints = ['#d0e6b8', '#e4f0c8', '#f4f8d8'];
  for (let k = 0; k < 6; k++) {
    const s = 1.25 + (k % 3) * 0.12;
    const ry = k * 1.7;
    keep(`f/forest/${k}`, shoot(group(part('trunk', s, ry), part(k % 2 ? 'crownB' : 'crownA', s, ry, tints[k % 3]))));
  }
  for (let k = 0; k < 4; k++) {
    const s = 0.95 + (k % 2) * 0.15;
    keep(`f/grass/${k}`, shoot(group(part('trunk', s, k * 2.1), part(k % 2 ? 'crownA' : 'crownB', s, k * 2.1, tints[(k + 1) % 3]))));
  }
  for (let k = 0; k < 4; k++) {
    const s = 0.95 + (k % 2) * 0.2;
    keep(`f/savanna/${k}`, shoot(group(part('savTrunk', s, k * 1.9, '#ffffff', s * 1.1), part('savCrown', s, k * 1.9, k % 2 ? '#c2c27a' : '#b4b86e', s * 1.1))));
  }
  for (let k = 0; k < 3; k++) {
    const s = 1 + k * 0.12;
    keep(`f/mangrove/${k}`, shoot(group(part('roots', s, k * 2.3), part('mangroveCrown', s, k * 2.3, '#7f9a72'))));
  }
  for (let k = 0; k < 3; k++) {
    const s = 1.3 + k * 0.15;
    const lean = (k - 1) * 0.1;
    keep(`f/palm/${k}`, shoot(group(part('palmTrunk', s, k * 2, '#ffffff', s, lean), part('palmCrown', s, k * 2, k % 2 ? '#e8f4d0' : '#ffffff', s, lean))));
    keep(`f/palmfruit/${k}`, shoot(group(part('palmTrunk', s, k * 2, '#ffffff', s, lean), part('palmCrown', s, k * 2, k % 2 ? '#e8f4d0' : '#ffffff', s, lean), part('palmFruit', s, k * 2, '#ffffff', s, lean))));
  }
  for (let k = 0; k < 4; k++) {
    const s = 0.8 + k * 0.18;
    keep(`f/bush/${k}`, shoot(group(part('bush', s, k * 1.3, k % 2 ? '#d8ecbf' : '#ffffff')), { shadow: true }));
  }
  for (let k = 0; k < 3; k++) {
    keep(`f/rock/${k}`, shoot(group(part('rocks', 1 + k * 0.2, k * 2))));
    keep(`f/iron/${k}`, shoot(group(part('rocks', 1 + k * 0.2, k * 2, '#c98a6a'))));
  }

  // A felled tree lying where it fell, the planks cut from one, and a stump.
  // Plain materials here: the forest's own shaders expect instanced trees.
  const barkPlain = new THREE.MeshLambertMaterial({ color: '#6e4d33' });
  const cut = new THREE.MeshLambertMaterial({ color: '#d9b98a' });
  const stumpMesh = (x, z) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.15, 9), barkPlain);
    m.position.set(x, 0.075, z);
    m.castShadow = true;
    g.add(m);
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.084, 12).rotateX(-Math.PI / 2), cut);
    top.position.set(x, 0.151, z);
    g.add(top);
    return g;
  };
  for (const [dir, ry] of [['a', 0.35], ['b', -0.35 + Math.PI / 2]]) {
    const g = new THREE.Group();
    g.add(stumpMesh(-0.55, 0));
    // The whole tree, turned on its side, its crown resting on the ground.
    const tree = group(part('trunk', 1.05, 0.4), part('crownA', 1.05, 0.4, tints[1]));
    tree.rotation.z = -Math.PI / 2 + 0.06;
    tree.position.set(-0.45, 0.32, 0);
    g.add(tree);
    g.rotation.y = ry;
    keep(`f/log/${dir}`, shoot(g));
    // Sawn up: the stump, a stack of planks and the leftover branches.
    const sawn = new THREE.Group();
    sawn.add(stumpMesh(-0.3, 0));
    const plankMat = new THREE.MeshLambertMaterial({ color: '#c9a06c' });
    for (let k = 0; k < 6; k++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.1), plankMat);
      p.position.set(0.2, 0.016 + Math.floor(k / 2) * 0.032, (k % 2) * 0.11 - 0.05);
      p.rotation.y = Math.floor(k / 2) % 2 ? 0.05 : -0.04;
      p.castShadow = true;
      sawn.add(p);
    }
    const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.5, 5).rotateZ(Math.PI / 2), barkPlain);
    twig.position.set(0.15, 0.03, 0.3);
    twig.rotation.y = 0.6;
    sawn.add(twig);
    sawn.rotation.y = ry;
    keep(`f/planks/${dir}`, shoot(sawn));
  }
  keep('f/stump', shoot(stumpMesh(0, 0)));
}

// --- Stores on the floors, and loads on the head ---------------------------------------

const GOODS = ['wood', 'bricks', 'stone', 'yam', 'cassava', 'garri', 'fish', 'meat', 'palmoil', 'iron', 'weapons', 'salt', 'cloth'];

function bakeStocks() {
  const root = new THREE.Group();
  const stocks = new Stocks(root);
  for (const r of GOODS) {
    for (let n = 2; n <= 20; n += 2) {
      for (const p of Object.values(stocks.pools)) p.begin();
      stocks.spot(r, { x: 0, y: 0.02, z: 0 }, n, n);
      for (const p of Object.values(stocks.pools)) p.end();
      keep(`s/${r}/${n}`, shoot(stocks.root, { shadow: true }));
    }
  }
}

function bakeLoads() {
  const root = new THREE.Group();
  const people = new People(root);
  for (const r of [...GOODS, 'other']) {
    DIRS.forEach((d, k) => {
      people.begin();
      people.loadAt(r, 0, 0, 0, d.heading);
      people.end();
      keep(`l/${r}/${k}`, shoot(root, { shadow: false, pad: 2 }));
    });
  }
}

// --- Animals --------------------------------------------------------------------------

function bakeAnimals() {
  const root = new THREE.Group();
  const people = new People(root);
  const box = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 0.75, 0.5));
  const anim = (type, name, frames, period, moving, phase) => {
    DIRS.forEach((d, k) => {
      for (let f = 0; f < frames; f++) {
        const a = { id: 0, type, phase, carcass: name === 'dead' };
        people.headings.set(0, d.heading);
        a.hx = 0;
        a.hy = 0;
        people.begin();
        people.animal(a, 0, 0, 0, (f / frames) * period, moving);
        people.end();
        keep(`a/${type}/${name}/${k}/${f}`, shoot(root, { box, shadow: true, pad: 2 }));
      }
    });
  };
  for (const type of ['antelope', 'pig']) {
    anim(type, 'idle', 1, 1, false);
    anim(type, 'walk', 6, (Math.PI * 2) / 12, true);
    anim(type, 'dead', 1, 1, false);
  }
  anim('wolf', 'idle', 1, 1, false, 'hunt');
  anim('wolf', 'run', 6, (Math.PI * 2) / (12 * 1.7), true, 'hunt');
  anim('wolf', 'bite', 4, (Math.PI * 2) / 9, false, 'maul');
  anim('wolf', 'dead', 1, 1, false);
  anim('hyena', 'idle', 1, 1, false, 'hunt');
  anim('hyena', 'run', 6, (Math.PI * 2) / (12 * 1.6), true, 'hunt');
  anim('hyena', 'bite', 4, (Math.PI * 2) / 9, false, 'maul');
  anim('hyena', 'dead', 1, 1, false);
  for (const type of ['leopard', 'crocodile']) {
    anim(type, 'idle', 1, 1, false, 'hunt');
    anim(type, 'run', 6, (Math.PI * 2) / (12 * 1.7), true, 'hunt');
    anim(type, 'bite', 4, (Math.PI * 2) / 9, false, 'maul');
    anim(type, 'dead', 1, 1, false);
  }
}

// --- People ----------------------------------------------------------------------------

// Who can look like what: a model, the tool in hand, and the movements.
export const LOOKS = {
  founder: { model: 'founder', anims: ['idle', 'walk', 'carry'] },
  founder_axe: { model: 'founder', prop: 'axe', anims: ['swing', 'idle'] },
  founder_hammer: { model: 'founder', prop: 'hammer', anims: ['swing'] },
  wife: { model: 'wife', anims: ['idle', 'womanwalk'] },
  woman: { model: 'woman', prop: null, anims: ['idle', 'womanwalk', 'womancarry'] },
  woman_axe: { model: 'woman', prop: 'axe', anims: ['idle', 'womanwalk', 'swing'] },
  woman_hoe: { model: 'woman', prop: 'hoe', anims: ['idle', 'womanwalk', 'pull'] },
  woman_bow: { model: 'woman', prop: 'bow', hand: 'Left', anims: ['idle', 'womanwalk', 'bow'] },
  woman_hammer: { model: 'woman', prop: 'hammer', anims: ['idle', 'womanwalk', 'swing'] },
  farmer: { model: 'farmer', anims: ['idle', 'walk', 'pull', 'carry'] },
  woodcutter: { model: 'woodcutter', anims: ['idle', 'walk', 'swing', 'carry'] },
  hunter: { model: 'hunter', anims: ['idle', 'walk', 'bow', 'carry'] },
  fisher: { model: 'fisher', anims: ['idle', 'walk', 'pull', 'carry'] },
  labourer: { model: 'labourer', anims: ['idle', 'walk', 'pull', 'swing', 'carry'] },
  builder: { model: 'labourer', prop: 'hammer', anims: ['idle', 'walk', 'swing'] },
  spearman: { model: 'spearman', anims: ['idle', 'spearwalk', 'slash'] },
  // A warrior of Benin as the bronze plaques show him: red cloth, a leather
  // war shield, a brass war cap and a collar of coral beads.
  benin: { model: 'spearman', extra: { prop: 'shield', hand: 'Left' }, dye: { from: [55, 185], to: 357 }, wear: ['helmet', 'collar'], anims: ['idle', 'spearwalk', 'slash'] },
  edo_bow: { model: 'spearman', prop: 'bow', hand: 'Left', dye: { from: [55, 185], to: 357 }, wear: ['helmet'], anims: ['idle', 'walk', 'bow'] },
  // Each people's own soldiers (the culture pack's `soldiers`), and their
  // enemies'. The spearman's cloth is the one that dyes cleanly, so archers
  // are the spearman with a bow, aiming as a hunter draws.
  // Hausa: indigo robes, a white turban and a round hide shield; archers in white.
  hausa_spear: { model: 'spearman', extra: { prop: 'hideshield', hand: 'Left' }, dye: { from: [55, 185], to: 225, s: 0.55, l: 0.34 }, wear: ['turban'], anims: ['idle', 'spearwalk', 'slash'] },
  hausa_bow: { model: 'spearman', prop: 'bow', hand: 'Left', dye: { from: [55, 185], to: 40, s: 0.06, l: 0.95 }, wear: ['turban'], anims: ['idle', 'walk', 'bow'] },
  // Igbo: rust-red cloth and a red head-tie with an eagle feather.
  igbo_spear: { model: 'spearman', dye: { from: [55, 185], to: 12, s: 0.62, l: 0.4 }, wear: ['headtie'], anims: ['idle', 'spearwalk', 'slash'] },
  igbo_bow: { model: 'spearman', prop: 'bow', hand: 'Left', dye: { from: [55, 185], to: 12, s: 0.62, l: 0.4 }, wear: ['headtie'], anims: ['idle', 'walk', 'bow'] },
  // Itsekiri: wrappers of wine red and a white head-wrap, cutlass in hand.
  itsekiri_spear: { model: 'spearman', prop: 'machete', dye: { from: [55, 185], to: 345, s: 0.55, l: 0.3 }, wear: ['wrap'], anims: ['idle', 'walk', 'slash'] },
  itsekiri_bow: { model: 'spearman', prop: 'bow', hand: 'Left', dye: { from: [55, 185], to: 345, s: 0.55, l: 0.3 }, wear: ['wrap'], anims: ['idle', 'walk', 'bow'] },
  // The Igala host: deep indigo, dark turbans and hide shields.
  igala: { model: 'spearman', extra: { prop: 'hideshield', hand: 'Left' }, dye: { from: [55, 185], to: 245, s: 0.5, l: 0.26 }, wear: ['darkturban'], anims: ['idle', 'spearwalk', 'slash'] },
  // Kwararafa: brown and red cloth and hide shields.
  jukun: { model: 'spearman', extra: { prop: 'hideshield', hand: 'Left' }, dye: { from: [55, 185], to: 18, s: 0.55, l: 0.3 }, anims: ['idle', 'spearwalk', 'slash'] },
  // The Aro's hired war bands: dark cloth and red caps, matchets and trade guns.
  aro: { model: 'spearman', prop: 'machete', dye: { from: [55, 185], to: 20, s: 0.2, l: 0.16 }, wear: ['redcap'], anims: ['idle', 'walk', 'slash'] },
  aro_gun: { model: 'spearman', prop: 'musket', hand: 'Left', dye: { from: [55, 185], to: 20, s: 0.2, l: 0.16 }, wear: ['redcap'], anims: ['idle', 'walk', 'bow'] },
  bandit: { model: 'bandit', anims: ['idle', 'walk', 'slash'] },
  // Dahomey's women soldiers. The swordswoman in her own blue-and-white
  // striped tunic; the musketeer the same woman with her stripes dyed red
  // and a musket, aiming as a hunter draws a bow.
  agojie: { model: 'agojie', prop: 'machete', anims: ['idle', 'walk', 'slash'] },
  agojie_gun: { model: 'agojie', prop: 'musket', hand: 'Left', dye: { from: [190, 250], to: 2 }, anims: ['idle', 'walk', 'bow'] },
};
const FRAMES = { idle: 4 };

async function until(fn, what) {
  for (let k = 0; k < 600; k++) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`timed out loading ${what}`);
}

async function bakePeople(only) {
  const chars = new Characters(new THREE.Scene());
  const box = new THREE.Box3(new THREE.Vector3(-0.45, 0, -0.45), new THREE.Vector3(0.45, 1.05, 0.45));
  const meta = {};
  for (const [look, def] of Object.entries(LOOKS)) {
    if (only && !only.includes(look)) continue;
    const m = await until(() => chars.model(def.model), def.model);
    const inst = chars.make(def.model, m);
    // Swap the tool in hand for this look.
    if (def.prop !== undefined || def.hand) {
      // Anything hung on a bone that is not itself a bone is the tool in hand.
      const bones = [];
      inst.body.traverse((o) => o.isBone && bones.push(o));
      for (const bone of bones) for (const child of [...bone.children]) if (!child.isBone) bone.remove(child);
      if (def.prop) {
        const grip = gripFor(m.template, def.hand || 'Right');
        const prop = makeProp(def.prop);
        let hand = null;
        inst.body.traverse((o) => o.name === grip.bone && (hand = o));
        if (hand) {
          prop.position.copy(grip.position);
          prop.quaternion.copy(grip.quaternion);
          prop.scale.setScalar(grip.scale);
          hand.add(prop);
        }
      }
    }
    // Cloth dyed another colour: every pixel of the texture whose hue falls
    // in `from` takes the hue `to` (skin and leather keep theirs), and with
    // `s` and `l` that saturation and lightness (white cloth, deep indigo).
    // Several dyes apply in turn.
    if (def.dye) {
      inst.body.traverse((o) => {
        if (!o.isMesh || !o.material?.map) return;
        o.material = o.material.clone();
        for (const d of [].concat(def.dye)) o.material.map = dyed(o.material.map, d);
      });
    }
    // A second thing in the other hand, kept with the first.
    if (def.extra) {
      const grip = gripFor(m.template, def.extra.hand);
      const prop = makeProp(def.extra.prop);
      let hand = null;
      inst.body.traverse((o) => o.name === grip.bone && (hand = o));
      if (hand && prop) {
        prop.position.copy(grip.position);
        prop.quaternion.copy(grip.quaternion);
        prop.scale.setScalar(grip.scale);
        hand.add(prop);
      }
    }
    // Things worn on the head and round the neck.
    for (const kind of def.wear || []) {
      const place = wearFor(m.template, WEAR_AT[kind] || 'head');
      const thing = makeWear(kind);
      let bone = null;
      inst.body.traverse((o) => o.name === place.bone && (bone = o));
      if (bone && thing) {
        thing.position.copy(place.position);
        thing.quaternion.copy(place.quaternion);
        thing.scale.setScalar(place.scale);
        bone.add(thing);
      }
    }
    // Where the top of the head is, for loads.
    meta[look] = { height: (CHARACTERS[def.model]?.height || 1) * 0.82 };
    for (const anim of def.anims) {
      const clip = await until(() => chars.clip(anim), anim);
      const action = inst.mixer.clipAction(clip);
      inst.mixer.stopAllAction();
      action.reset();
      action.play();
      const frames = FRAMES[anim] || 8;
      for (let k = 0; k < DIRS.length; k++) {
        inst.root.rotation.y = DIRS[k].heading;
        for (let f = 0; f < frames; f++) {
          action.time = (f / frames) * clip.duration;
          inst.mixer.update(0);
          inst.root.updateMatrixWorld(true);
          keep(`c/${look}/${anim}/${k}/${f}`, shoot(inst.root, { box, shadow: false, pad: 2 }));
        }
      }
      log(`  ${look} ${anim}`);
    }
  }
  return meta;
}

const dyedCache = new Map();
function dyed(map, { from, to, s: S, l: L }) {
  const key = `${map.uuid}:${from}:${to}:${S}:${L}`;
  if (dyedCache.has(key)) return dyedCache.get(key);
  const img = map.image;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255;
    const gg = d[i + 1] / 255;
    const b = d[i + 2] / 255;
    const max = Math.max(r, gg, b);
    const min = Math.min(r, gg, b);
    const l = (max + min) / 2;
    const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    if (s < 0.12) continue;
    let h = 0;
    if (max === r) h = ((gg - b) / (max - min)) % 6;
    else if (max === gg) h = (b - r) / (max - min) + 2;
    else h = (r - gg) / (max - min) + 4;
    h = (h * 60 + 360) % 360;
    if (h < from[0] || h > from[1]) continue;
    // The new hue, a little brighter and richer (dyed cloth is bright).
    const [nr, ng, nb] = hsl(to, S ?? Math.min(1, s * 1.35), L !== undefined ? Math.min(0.95, L * (0.7 + l * 0.6)) : Math.min(0.62, l * 1.4 + 0.05));
    d[i] = nr;
    d[i + 1] = ng;
    d[i + 2] = nb;
  }
  g.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = map.flipY;
  tex.colorSpace = map.colorSpace;
  tex.wrapS = map.wrapS;
  tex.wrapT = map.wrapT;
  tex.channel = map.channel;
  dyedCache.set(key, tex);
  return tex;
}

function hsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

// Where a thing is worn: on the head, its origin at the top of the skull,
// facing the way the face looks; round the neck, at the base of the neck.
// Sized for a head about 0.2 m tall.
function wearFor(template, at) {
  const bones = {};
  template.traverse((o) => o.isBone && (bones[o.name] = o));
  const head = bones.Head;
  const neck = bones.neck || head;
  const P = (b) => b.getWorldPosition(new THREE.Vector3());
  const hp = P(head);
  const tp = bones.head_end ? P(bones.head_end) : hp.clone().add(new THREE.Vector3(0, 0.2, 0));
  const np = P(neck);
  const up = (at === 'neck' ? hp.clone().sub(np) : tp.clone().sub(hp)).normalize();
  const fwd = bones.headfront ? P(bones.headfront).sub(hp) : new THREE.Vector3(0, 0, 1);
  fwd.addScaledVector(up, -fwd.dot(up)).normalize();
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, fwd), up, fwd);
  const bone = at === 'neck' ? neck : head;
  bone.updateWorldMatrix(true, false);
  const inv = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
  const size = tp.distanceTo(hp) / 0.2;
  const scale = bone.getWorldScale(new THREE.Vector3()).x || 1;
  return {
    bone: bone.name,
    position: bone.worldToLocal((at === 'neck' ? np : tp).clone()),
    quaternion: inv.multiply(new THREE.Quaternion().setFromRotationMatrix(basis)),
    scale: size / scale,
  };
}

// Where a tool sits in a hand (as js/render3d/characters.js works it out).
function gripFor(template, side) {
  let hand = null;
  let fore = null;
  template.traverse((o) => {
    if (!o.isBone) return;
    if (o.name === `${side}Hand`) hand = o;
    if (o.name === `${side}ForeArm`) fore = o;
  });
  const wrist = hand.getWorldPosition(new THREE.Vector3());
  const finger = wrist.clone().sub(fore.getWorldPosition(new THREE.Vector3())).normalize();
  const along = new THREE.Vector3(0, 0, 1).addScaledVector(finger, -finger.z).normalize();
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(along, finger), along, finger);
  const inv = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
  const scale = hand.getWorldScale(new THREE.Vector3()).x || 1;
  return {
    bone: hand.name,
    quaternion: inv.clone().multiply(new THREE.Quaternion().setFromRotationMatrix(basis)),
    position: finger.clone().multiplyScalar(0.075 / scale).applyQuaternion(inv),
    scale: 1 / scale,
  };
}

// --- Packing ----------------------------------------------------------------------------

function pack(keys) {
  const list = keys.map((key) => ({ key, ...sprites.get(key), w: sprites.get(key).canvas.width, h: sprites.get(key).canvas.height }));
  list.sort((a, b) => b.h - a.h || b.w - a.w);
  const sheets = [];
  let sheet = null;
  const index = {};
  const newSheet = () => {
    const c = document.createElement('canvas');
    c.width = SHEET;
    c.height = SHEET;
    sheet = { canvas: c, g: c.getContext('2d'), x: 1, y: 1, row: 0 };
    sheets.push(sheet);
  };
  newSheet();
  for (const s of list) {
    if (s.w > SHEET - 2 || s.h > SHEET - 2) throw new Error(`${s.key} is too big (${s.w}x${s.h})`);
    if (sheet.x + s.w + 1 > SHEET) {
      sheet.x = 1;
      sheet.y += sheet.row + 1;
      sheet.row = 0;
    }
    if (sheet.y + s.h + 1 > SHEET) newSheet();
    sheet.g.drawImage(s.canvas, sheet.x, sheet.y);
    index[s.key] = [sheets.length - 1, sheet.x, sheet.y, s.w, s.h, Math.round(s.ax * 10) / 10, Math.round(s.ay * 10) / 10];
    sheet.x += s.w + 1;
    sheet.row = Math.max(sheet.row, s.h);
  }
  // Crop the last sheet to what it uses.
  const last = sheets[sheets.length - 1];
  const usedH = Math.min(SHEET, last.y + last.row + 1);
  if (usedH < SHEET) {
    const c = document.createElement('canvas');
    c.width = SHEET;
    c.height = usedH;
    c.getContext('2d').drawImage(last.canvas, 0, 0);
    last.canvas = c;
  }
  return { sheets: sheets.map((s) => s.canvas), index };
}

// --- Run ----------------------------------------------------------------------------------

window.bakeAll = async (only) => {
  const t0 = performance.now();
  // Let textures load before anything is photographed.
  const warm = new THREE.Group();
  warm.add(buildingModel({ id: 1, type: 'hut', w: 2, h: 2, level: 1, built: 1, workers: [] }, fakeSt(), {}));
  bakeFlora();
  await new Promise((r) => setTimeout(r, 2500));
  sprites.clear();
  const parts = only || ['buildings', 'villages', 'flora', 'stocks', 'loads', 'animals', 'people'];
  // A test bake of a few looks: 'people:benin,igbo_spear'.
  const someLooks = parts.find((p) => p.startsWith('people:'))?.slice(7).split(',');
  let people = {};
  for (const p of parts) {
    log(`baking ${p}…`);
    if (p === 'buildings') {
      bakeBuildings();
      bakeBuildings([1, 2, 3]);
    }
    if (p === 'villages') bakeVillages();
    if (p === 'flora') bakeFlora();
    if (p === 'stocks') bakeStocks();
    if (p === 'loads') bakeLoads();
    if (p === 'animals') bakeAnimals();
    if (p === 'people' || p.startsWith('people:')) people = await bakePeople(someLooks);
  }
  // Buildings from the other three sides go on sheets of their own, which
  // the game loads only when the view is first turned.
  const keys = [...sprites.keys()];
  const base = pack(keys.filter((k) => !k.includes('@')));
  const rest = pack(keys.filter((k) => k.includes('@')));
  const sheets = [...base.sheets, ...rest.sheets];
  const index = { ...base.index };
  for (const [k, v] of Object.entries(rest.index)) index[k] = [v[0] + base.sheets.length, ...v.slice(1)];
  log(`${sprites.size} sprites on ${sheets.length} sheets (${rest.sheets.length} for turned views) in ${Math.round(performance.now() - t0)} ms`);
  for (const c of sheets) {
    c.className = 'sheet';
    document.body.appendChild(c);
  }
  window.baked = {
    meta: { scale: SCALE, tile: [128, 64], lazyFrom: base.sheets.length, dirs: DIRS.map((d) => d.name), looks: Object.fromEntries(Object.entries(LOOKS).map(([k, v]) => [k, { anims: v.anims, frames: Object.fromEntries(v.anims.map((a) => [a, FRAMES[a] || 8])), height: people[k]?.height || 0.82 }])) },
    index,
    sheets: sheets.map((c) => c.toDataURL('image/webp', 0.9)),
  };
  return { sprites: sprites.size, sheets: sheets.length };
};

log('ready');
window.bakeReady = true;
export { T, F };
