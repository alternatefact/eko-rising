// The 3D cartoon view of the world. Same interface as the 2D renderer
// (camera in tile units, screenToTile, draw...), so the rest of the game does
// not care which one is running.
//
// World axes: x runs east like tile x, z runs south like tile y, y is up.

import * as THREE from '../vendor/three.module.js';
import { T } from '../world/terrain.js';
import { hash2 } from '../core/rng.js';
import { PLAYER, ENEMY } from '../render/palette.js';
import { BUILDINGS } from '../data/buildings.js';
import { season } from '../sim/economy.js';
import { isHostileOwner } from '../sim/military.js';
import { FOW, toon, toonInstanced, WIND, REAL } from './materials.js';
import { Ground, WATER_Y } from './ground.js';
import { Flora } from './flora.js';
import { Effects } from './effects.js';
import { Stocks } from './stocks.js';
import { Characters } from './characters.js';
import { citizenLook, unitLook } from '../data/people.js';
import { buildingModel, villageModel, shipModel, mergeModel, disposeModel } from './models.js';
import { People, Pool } from './people.js';

const HEIGHT = {
  [T.OCEAN]: -0.75, [T.LAGOON]: -0.45, [T.RIVER]: -0.4, [T.FORD]: -0.1, [T.SAND]: 0.03,
  [T.MANGROVE]: -0.02, [T.GRASS]: 0.06, [T.FOREST]: 0.08, [T.SAVANNA]: 0.07, [T.HILL]: 0.45,
};
// The view: an isometric corner view like the classic city-builder games,
// looking from the south-east, tilted down about 35 degrees, no perspective.
const ELEV = 0.62;
const YAW = Math.PI / 4;
const VIEW = 12; // half the view height in world units at zoom 1

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (err) {
    return false;
  }
}

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.mobile = window.matchMedia?.('(pointer: coarse)').matches;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: !this.mobile, powerPreference: 'high-performance' });
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = REAL ? 1.3 : 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0c1016');
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 400);
    this.cam = { x: 0, y: 0, zoom: 1.3 };
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.tmp = new THREE.Vector3();
    this.ndc = new THREE.Vector2();

    this.hemi = new THREE.HemisphereLight('#dff1ff', '#6b5236', REAL ? 1.7 : 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d6', REAL ? 2.5 : 2.1);
    this.sun.castShadow = true;
    const res = this.mobile ? 1024 : 2048;
    this.sun.shadow.mapSize.set(res, res);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // A 2D layer above the 3D view for health bars and the selection box.
    this.overlay = document.createElement('canvas');
    this.overlay.className = 'overlay';
    canvas.insertAdjacentElement('afterend', this.overlay);
    this.octx = this.overlay.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
  }

  // --- Setup for a game -----------------------------------------------------------

  attach(st) {
    this.st = st;
    for (const obj of [this.borderLines, this.dynRoot]) {
      if (obj) this.scene.remove(obj);
    }
    this.ground?.dispose();
    this.flora?.dispose();
    this.effects?.dispose();
    this.stocks?.dispose();
    this.characters?.dispose();
    this.people?.pools && Object.values(this.people.pools).forEach((p) => this.scene.remove(p.mesh));
    this.buildingObjs = new Map();
    this.villageObjs = new Map();
    this.shipObjs = new Map();
    this.poiObjs = new Map();
    this.dynRoot = new THREE.Group();
    this.scene.add(this.dynRoot);

    this.buildHeights();
    this.ground = new Ground(this.scene, st, this.vh, this.mobile);
    this.fogTex = new THREE.DataTexture(new Uint8Array(st.W * st.H * 4), st.W, st.H, THREE.RGBAFormat);
    this.fogTex.magFilter = THREE.LinearFilter;
    this.fogTex.minFilter = THREE.LinearFilter;
    FOW.fowMap.value = this.fogTex;
    FOW.fowSize.value.set(st.W, st.H);
    this.terrTex = new THREE.DataTexture(new Uint8Array(st.W * st.H * 4), st.W, st.H, THREE.RGBAFormat);
    this.terrTex.magFilter = THREE.NearestFilter;
    FOW.terrMap.value = this.terrTex;
    this.fogVersion = -1;
    this.terrVersion = -1;
    this.ground.updateWear();
    this.flora = new Flora(this.scene, st, (x, y) => this.groundAt(x, y), this.mobile);
    this.flora.update(this.ground.wear, Infinity);
    this.wearAt = 0;
    this.effects = new Effects(this.scene);
    this.stocks = new Stocks(this.dynRoot);
    this.characters = new Characters(this.scene);
    this.timeScale = 1;
    this.people = new People(this.dynRoot);
    this.fx = {
      arrow: new Pool(this.dynRoot, new THREE.CylinderGeometry(0.008, 0.008, 0.35, 4).rotateX(Math.PI / 2), 'arrow', 64, false),
      ball: new Pool(this.dynRoot, new THREE.IcosahedronGeometry(0.07, 0), 'ball', 32, false),
      flash: new Pool(this.dynRoot, new THREE.IcosahedronGeometry(0.06, 0), 'flash', 32, false),
      tile: new Pool(this.dynRoot, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), 'tile', 64, false),
      poi: new Pool(this.dynRoot, new THREE.OctahedronGeometry(0.22, 0), 'poi', 16, true),
    };
    this.circle = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, k) => new THREE.Vector3(Math.cos((k / 64) * Math.PI * 2), 0, Math.sin((k / 64) * Math.PI * 2)))),
      new THREE.LineBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.6 }),
    );
    this.circle.visible = false;
    this.dynRoot.add(this.circle);
    this.borderVersion = -1;
    this.ghostType = null;
  }

  buildHeights() {
    const st = this.st;
    const W = st.W;
    const H = st.H;
    const tileH = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const t = st.terrain[i];
      let h = HEIGHT[t];
      if (t === T.HILL) h += hash2(i % W, (i / W) | 0, st.seed + 3) * 0.35;
      tileH[i] = h;
    }
    const vh = new Float32Array((W + 1) * (H + 1));
    for (let y = 0; y <= H; y++) {
      for (let x = 0; x <= W; x++) {
        let sum = 0;
        let n = 0;
        let low = Infinity;
        for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
          const tx = x + dx;
          const ty = y + dy;
          if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
          const v = tileH[ty * W + tx];
          sum += v;
          low = Math.min(low, v);
          n++;
        }
        // Lean toward the lowest neighbour so water edges read as banks.
        vh[y * (W + 1) + x] = n ? sum / n * 0.6 + low * 0.4 : 0;
      }
    }
    this.vh = vh;
  }

  groundAt(x, y) {
    const W = this.st.W;
    const H = this.st.H;
    x = Math.max(0, Math.min(W - 0.001, x));
    y = Math.max(0, Math.min(H - 0.001, y));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const v = this.vh;
    const r = W + 1;
    const a = v[y0 * r + x0];
    const b = v[y0 * r + x0 + 1];
    const c = v[(y0 + 1) * r + x0];
    const d = v[(y0 + 1) * r + x0 + 1];
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  }

  // Ground height under a walker: never below the water surface.
  standAt(x, y) {
    return Math.max(WATER_Y - 0.05, this.groundAt(x, y));
  }

  // --- Camera ------------------------------------------------------------------------

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(w, h, false);
    this.overlay.width = Math.round(w * dpr);
    this.overlay.height = Math.round(h * dpr);
    this.overlay.style.width = `${w}px`;
    this.overlay.style.height = `${h}px`;
    this.aspect = w / Math.max(1, h);
    this.dpr = dpr;
    this.w = w;
    this.h = h;
    if (this.st) this.updateCamera();
  }

  get scale() {
    return this.h / ((2 * VIEW) / this.cam.zoom) || 32 * this.cam.zoom;
  }

  // What is under a point on screen: a person or soldier near it, else the
  // building drawn there. Null means "look at the ground instead".
  pickScreen(sx, sy) {
    const st = this.st;
    const px = this.scale;
    const seen = (x, y) => st.visible[Math.floor(y) * st.W + Math.floor(x)];
    let best = null;
    let bestD = Math.max(12, px * 0.42);
    const test = (e, h) => {
      const p = this.tileToScreen(e.x + (e.ox || 0), e.y + (e.oy || 0), this.standAt(e.x, e.y) + h);
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    };
    for (const u of st.units) {
      if (u.dead || (u.owner !== 'player' && !seen(u.x, u.y))) continue;
      test(u, u.type === 'horseman' ? 0.6 : 0.45);
    }
    if (best) return best;
    for (const c of st.citizens) {
      if (c.dead || c.hidden || !seen(c.x, c.y)) continue;
      test(c, 0.45);
    }
    if (best) return best;
    this.ndc.set((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const meshes = [];
    for (const [, o] of this.buildingObjs) o.group.traverse((m) => m.isMesh && meshes.push(m));
    const hit = this.ray.intersectObjects(meshes, false)[0];
    if (hit) {
      let o = hit.object;
      while (o && o.userData.bid === undefined) o = o.parent;
      const b = o && st.byId.get(o.userData.bid);
      if (b && !b.dead) return b;
    }
    return null;
  }

  updateCamera() {
    const half = VIEW / this.cam.zoom;
    const aspect = this.aspect || 1;
    const c = this.camera;
    c.left = -half * aspect;
    c.right = half * aspect;
    c.top = half;
    c.bottom = -half;
    const dist = 80;
    c.position.set(
      this.cam.x + Math.sin(YAW) * Math.cos(ELEV) * dist,
      Math.sin(ELEV) * dist,
      this.cam.y + Math.cos(YAW) * Math.cos(ELEV) * dist,
    );
    c.lookAt(this.cam.x, 0, this.cam.y);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    // The shadow box covers what is on screen, stretched along the view.
    const s = Math.max(half * aspect, half / Math.sin(ELEV)) * 1.15;
    const sh = this.sun.shadow.camera;
    sh.left = -s;
    sh.right = s;
    sh.top = s;
    sh.bottom = -s;
    sh.near = 1;
    sh.far = 160;
    sh.updateProjectionMatrix();
    // Sun from the upper left of the screen (the west), shadows to the lower right.
    this.sun.position.set(this.cam.x - 26, 34, this.cam.y - 4);
    this.sun.target.position.set(this.cam.x, 0, this.cam.y);
    this.sun.target.updateMatrixWorld();
  }

  clampCam() {
    const st = this.st;
    this.cam.x = Math.max(0, Math.min(st.W, this.cam.x));
    this.cam.y = Math.max(-2, Math.min(st.H + 2, this.cam.y));
    this.updateCamera();
  }

  screenToTile(sx, sy) {
    this.ndc.set((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.ray.ray.intersectPlane(this.plane, this.tmp);
    if (!hit) return { x: this.cam.x, y: this.cam.y - 40 };
    return { x: hit.x, y: hit.z };
  }

  tileToScreen(tx, ty, h = 0) {
    this.tmp.set(tx, h, ty).project(this.camera);
    return { x: ((this.tmp.x + 1) / 2) * this.w, y: ((1 - this.tmp.y) / 2) * this.h };
  }

  centerOn(x, y) {
    this.cam.x = x;
    this.cam.y = y;
    this.clampCam();
  }

  panBy(dx, dy) {
    const a = this.screenToTile(this.w / 2, this.h / 2);
    const b = this.screenToTile(this.w / 2 - dx, this.h / 2 - dy);
    this.cam.x += b.x - a.x;
    this.cam.y += b.y - a.y;
    this.clampCam();
  }

  zoomAt(factor, sx, sy) {
    const before = this.screenToTile(sx, sy);
    this.cam.zoom = Math.max(0.45, Math.min(3.4, this.cam.zoom * factor));
    this.updateCamera();
    const after = this.screenToTile(sx, sy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.clampCam();
  }

  // --- Per-frame syncing --------------------------------------------------------------

  updateFog() {
    const st = this.st;
    if (this.fogVersion !== st.visVersion) {
      this.fogVersion = st.visVersion;
      const d = this.fogTex.image.data;
      for (let i = 0; i < st.W * st.H; i++) d[i * 4] = !st.explored[i] ? 0 : st.visible[i] ? 255 : 140;
      this.fogTex.needsUpdate = true;
    }
    if (this.terrVersion !== st.territoryVersion) {
      this.terrVersion = st.territoryVersion;
      const d = this.terrTex.image.data;
      for (let i = 0; i < st.W * st.H; i++) {
        const v = st.territory[i];
        d[i * 4] = v === 2 && st.explored[i] ? 255 : 0;
        d[i * 4 + 1] = v === 1 ? 255 : 0;
      }
      this.terrTex.needsUpdate = true;
      this.buildBorders();
    }
  }

  buildBorders() {
    const st = this.st;
    if (this.borderLines) this.scene.remove(this.borderLines);
    const pts = [];
    const W = st.W;
    const add = (x0, y0, x1, y1) => {
      pts.push(x0, Math.max(WATER_Y, this.groundAt(x0, y0)) + 0.06, y0, x1, Math.max(WATER_Y, this.groundAt(x1, y1)) + 0.06, y1);
    };
    for (let y = 0; y < st.H; y++) {
      for (let x = 0; x < W; x++) {
        if (st.territory[y * W + x] !== 1) continue;
        if (x + 1 >= W || st.territory[y * W + x + 1] !== 1) add(x + 1, y, x + 1, y + 1);
        if (x === 0 || st.territory[y * W + x - 1] !== 1) add(x, y, x, y + 1);
        if (y + 1 >= st.H || st.territory[(y + 1) * W + x] !== 1) add(x, y + 1, x + 1, y + 1);
        if (y === 0 || st.territory[(y - 1) * W + x] !== 1) add(x, y, x + 1, y);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.borderLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#ffeeb0', transparent: true, opacity: 0.55 }));
    this.scene.add(this.borderLines);
  }

  // Felled trees and new buildings rebuild their patch of plants; worn
  // ground is recomputed every couple of seconds.
  takeTileChanges() {
    const st = this.st;
    if (st.changedTiles.length) {
      for (const i of st.changedTiles) this.flora.touch(i);
      st.changedTiles.length = 0;
    }
    const now = performance.now();
    if (now >= this.wearAt) {
      this.wearAt = now + 2000;
      for (const i of this.ground.updateWear()) this.flora.touch(i);
    }
    this.flora.update(this.ground.wear, 3);
    this.flora.showGrass(this.cam.zoom >= 0.9);
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

  syncBuildings(t) {
    const st = this.st;
    const seen = new Set();
    for (const b of st.buildings) {
      if (b.dead) continue;
      seen.add(b.id);
      const n = b.wall || b.gate ? this.wallNeighbours(b) : null;
      const growth = b.type === 'farm' || b.type === 'cassava' ? Math.round((b.growth || 0) * 5) : 0;
      const key = `${b.type}|${b.level || 1}|${st.era >= 3}|${growth}|${n ? `${+n.l}${+n.r}${+n.u}${+n.d}` : ''}|${b.type === 'port' ? `${st.flags.britishPartner}${st.flags.colonized}${st.flags.frenchPact}` : ''}`;
      let o = this.buildingObjs.get(b.id);
      if (!o) this.flora.touchRect(b.x - 1, b.y - 1, b.x + b.w, b.y + b.h);
      if (!o || o.key !== key) {
        if (o) {
          this.dynRoot.remove(o.group);
          disposeModel(o.group);
        }
        const group = mergeModel(buildingModel(b, st, n));
        group.userData.bid = b.id;
        const flames = [];
        const flags = [];
        group.traverse((m) => {
          if (m.userData.flame) flames.push(m);
          if (m.userData.flag) flags.push(m);
        });
        o = { group, key, flames, flags };
        this.buildingObjs.set(b.id, o);
        this.dynRoot.add(group);
      }
      const gy = Math.max(WATER_Y, this.groundAt(b.x + b.w / 2, b.y + b.h / 2));
      o.group.position.set(b.x, b.type === 'fisher' || b.type === 'port' ? Math.max(gy, WATER_Y + 0.02) : gy, b.y);
      o.group.scale.y = b.built < 1 ? 0.15 + b.built * 0.85 : 1;
      for (const f of o.flames) f.scale.y = 1 + Math.sin(t * 13 + b.id) * 0.18;
      for (const f of o.flags) f.rotation.y = Math.sin(t * 3 + b.id) * 0.25;
    }
    for (const [id, o] of this.buildingObjs) {
      if (!seen.has(id)) {
        const p = o.group.position;
        this.flora.touchRect(p.x - 1, p.z - 1, p.x + 4, p.z + 4);
        this.dynRoot.remove(o.group);
        disposeModel(o.group);
        this.buildingObjs.delete(id);
      }
    }
  }

  syncVillages(t) {
    const st = this.st;
    for (const f of st.factions) {
      const known = st.explored[f.y * st.W + f.x];
      let o = this.villageObjs.get(f.id);
      const color = f.status === 'conquered' || f.status === 'vassal' ? PLAYER : f.color;
      const key = `${color}|${known}`;
      if (!o || o.key !== key) {
        if (o) {
          this.dynRoot.remove(o.group);
          disposeModel(o.group);
        }
        const group = mergeModel(villageModel(f, color));
        group.position.set(f.x + 0.5, this.groundAt(f.x + 0.5, f.y + 0.5), f.y + 0.5);
        const flags = [];
        group.traverse((m) => m.userData.flag && flags.push(m));
        o = { group, key, flags };
        this.villageObjs.set(f.id, o);
        this.dynRoot.add(group);
      }
      for (const fl of o.flags) fl.rotation.y = Math.sin(t * 3 + f.x) * 0.25;
    }
  }

  syncShips(alpha, t) {
    const st = this.st;
    const seen = new Set();
    for (const s of st.ships) {
      seen.add(s.id);
      let o = this.shipObjs.get(s.id);
      if (!o) {
        const group = shipModel(st.foreign[s.power]?.color || '#999', s.power);
        o = { group, heading: 0 };
        this.shipObjs.set(s.id, o);
        this.dynRoot.add(group);
      }
      const x = s.px + (s.x - s.px) * alpha;
      const y = s.py + (s.y - s.py) * alpha;
      const dx = s.x - s.px;
      const dy = s.y - s.py;
      if (Math.abs(dx) + Math.abs(dy) > 0.001) o.heading = Math.atan2(-dy, dx);
      o.group.position.set(x, WATER_Y + Math.sin(t * 1.5 + s.id) * 0.03, y);
      o.group.rotation.set(Math.sin(t * 1.2 + s.id) * 0.04, o.heading, 0);
    }
    for (const [id, o] of this.shipObjs) {
      if (!seen.has(id)) {
        this.dynRoot.remove(o.group);
        this.shipObjs.delete(id);
      }
    }
  }

  // --- Frame ---------------------------------------------------------------------------

  draw(alpha, view) {
    const st = this.st;
    const t = performance.now() / 1000;
    const dt = this.lastT ? Math.min(0.1, t - this.lastT) : 0;
    this.lastT = t;
    this.takeTileChanges();
    this.updateFog();
    FOW.showTerr.value = view.showTerritory ? 1 : 0;
    WIND.uTime.value = t;

    // Season: the Harmattan turns the light hazy and gold.
    const s = season(st);
    const harmattan = s.name === 'Harmattan';
    this.scene.background.set(harmattan ? '#2a2318' : '#0c1016');
    this.sun.color.set(harmattan ? '#ffd9a0' : '#fff0d6');
    this.hemi.color.set(harmattan ? '#f3d9b0' : '#dff1ff');
    WIND.uStrength.value = harmattan ? 1.6 : 1;

    this.syncBuildings(t);
    this.stocks.update(st, (x, y) => this.groundAt(x, y));
    this.syncVillages(t);
    this.syncShips(alpha, t);

    const ppl = this.people;
    ppl.begin();
    const chars = this.characters;
    chars.begin();
    const rate = this.timeScale ?? 1;
    // Life-like people are skinned and animated one by one; past this many on
    // screen the rest fall back to the simple figures.
    let budget = this.mobile ? 90 : 220;
    const head = this.tmp2 || (this.tmp2 = new THREE.Vector3());
    const seenTile = (x, y) => st.visible[Math.floor(y) * st.W + Math.floor(x)];
    const view3 = this.visibleRect();
    const inView = (x, y) => x > view3.x0 && x < view3.x1 && y > view3.y0 && y < view3.y1;

    for (const a of st.animals) {
      const x = a.px + (a.x - a.px) * alpha;
      const y = a.py + (a.y - a.py) * alpha;
      if (!inView(x, y) || !seenTile(x, y)) continue;
      ppl.animal(a, x, y, this.standAt(x, y), t, !!a.path);
    }
    for (const c of st.citizens) {
      if (c.hidden) continue;
      if (c.path) this.ground.addFootfall(c.x, c.y, dt);
      const x = c.px + (c.x - c.px) * alpha + c.ox;
      const y = c.py + (c.y - c.py) * alpha + c.oy;
      if (!inView(x, y) || !seenTile(x, y)) continue;
      const job = c.job ? st.byId.get(c.job) : null;
      const ground = this.standAt(x, y);
      if (budget > 0) {
        const look = citizenLook(st, c, job, !!c.path);
        const h = ppl.heading(c, x, y);
        const inst = chars.draw(c.id, look.type, look.anim, x, ground, y, h, dt, rate);
        if (inst) {
          budget--;
          if (c.carry && chars.headTop(inst, head)) ppl.loadAt(c.carry.r, head.x, head.y, head.z, h);
          if (view.selected.has(c.id)) ppl.selection(x, y, ground, 1, '#ffe066');
          continue;
        }
        // Not ready yet: undo the heading step so the simple figure turns smoothly too.
        c.hx = undefined;
      }
      const tool = (c.state === 'gather' && job && job.type !== 'fisher') || (c.state === 'farm' && !c.path) || c.state === 'craft';
      ppl.citizen(c, x, y, ground, t, !!c.path, { tool });
      if (view.selected.has(c.id)) ppl.selection(x, y, this.standAt(x, y), 1, '#ffe066');
    }
    for (const u of st.units) {
      const x = u.px + (u.x - u.px) * alpha + u.ox;
      const y = u.py + (u.y - u.py) * alpha + u.oy;
      if (!inView(x, y)) continue;
      if (u.owner !== 'player' && !seenTile(x, y)) continue;
      const hostile = isHostileOwner(st, 'player', u.owner);
      const color = u.owner === 'player' ? (u.ally ? st.factionMap[u.ally]?.color || PLAYER : PLAYER) : hostile ? ENEMY : st.factionMap[u.owner]?.color || st.foreign[u.owner]?.color || '#888888';
      const target = u.order.target ? st.byId.get(u.order.target) : null;
      const swing = u.swingT ? (st.time.t - u.swingT) / 0.3 : 2;
      const tgt = target ? { x: target.kind === 'building' ? target.x + target.w / 2 : target.x, y: target.kind === 'building' ? target.y + target.h / 2 : target.y } : null;
      const ground = this.standAt(x, y);
      const look = budget > 0 ? unitLook(st, u, !!u.path, swing < 2.5) : null;
      if (look && chars.model(look.type)) {
        const h = ppl.heading(u, x, y, tgt ? tgt.x - x : undefined, tgt ? tgt.y - y : undefined);
        if (chars.draw(u.id, look.type, look.anim, x, ground, y, h, dt, rate)) {
          budget--;
          ppl.ring(x, ground, y, color);
          if (view.selected.has(u.id)) ppl.selection(x, y, ground, 1.3, '#ffe066');
          continue;
        }
      }
      ppl.soldier(u, x, y, ground, t, !!u.path, color, { swing: swing < 1 ? swing : 0, target: tgt });
      if (view.selected.has(u.id)) ppl.selection(x, y, this.standAt(x, y), 1.3, '#ffe066');
    }
    if (view.selectedFaction) {
      const f = st.factionMap[view.selectedFaction];
      if (f) ppl.selection(f.x + 0.5, f.y + 0.5, this.groundAt(f.x + 0.5, f.y + 0.5), f.radius * 4, '#ffe066');
    }
    for (const id of view.selected) {
      const b = st.byId.get(id);
      if (b && b.kind === 'building') ppl.selection(b.x + b.w / 2, b.y + b.h / 2, this.groundAt(b.x + b.w / 2, b.y + b.h / 2), Math.max(b.w, b.h) * 2.4, '#ffe066');
    }
    if (view.order) {
      const k = (performance.now() - view.order.at) / 600;
      if (k < 1) ppl.selection(view.order.x, view.order.y, this.groundAt(view.order.x, view.order.y), 0.6 + k * 2, view.order.attack ? '#e74c3c' : '#ffe066');
    }
    ppl.end();
    chars.end();

    this.drawFx(t);
    this.effects.update(dt, st, (x, y) => this.groundAt(x, y), (x, y) => inView(x, y) && st.explored[Math.floor(y) * st.W + Math.floor(x)], this.scale * this.dpr, harmattan);
    this.drawGhost(view, t);
    this.updateCamera();
    this.gl.render(this.scene, this.camera);
    this.drawOverlay(view, alpha, harmattan);
  }

  visibleRect() {
    const a = this.screenToTile(0, 0);
    const b = this.screenToTile(this.w, 0);
    const c = this.screenToTile(0, this.h);
    const d = this.screenToTile(this.w, this.h);
    return {
      x0: Math.min(a.x, b.x, c.x, d.x) - 2,
      x1: Math.max(a.x, b.x, c.x, d.x) + 2,
      y0: Math.min(a.y, b.y, c.y, d.y) - 3,
      y1: Math.max(a.y, b.y, c.y, d.y) + 2,
    };
  }

  drawFx(t) {
    const st = this.st;
    const F2 = this.fx;
    for (const p of Object.values(F2)) p.begin();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    const c = new THREE.Color();
    for (const f of st.fx) {
      const k = Math.min(1, f.t / f.dur);
      const x = f.x0 + (f.x1 - f.x0) * k;
      const y = f.y0 + (f.y1 - f.y0) * k;
      const h = this.standAt(x, y) + 0.35 + Math.sin(k * Math.PI) * (f.kind === 'ball' ? 1.4 : f.kind === 'arrow' ? 0.5 : 0);
      if (f.kind === 'shot') {
        if (f.t < 0.1) F2.flash.add(m.compose(v.set(f.x0, this.standAt(f.x0, f.y0) + 0.35, f.y0), q.identity(), s.set(1, 1, 1)), c.set('#fff2b0'));
        continue;
      }
      if (f.t > f.dur) {
        if (f.kind === 'ball') F2.flash.add(m.compose(v.set(f.x1, this.standAt(f.x1, f.y1) + 0.1, f.y1), q.identity(), s.setScalar(3 * (1 - (f.t - f.dur) / 0.15))), c.set('#ff9c40'));
        continue;
      }
      if (f.kind === 'ball') {
        F2.ball.add(m.compose(v.set(x, h, y), q.identity(), s.set(1, 1, 1)), c.set('#151515'));
      } else {
        const ang = Math.atan2(f.x1 - f.x0, f.y1 - f.y0);
        q.setFromAxisAngle(v.set(0, 1, 0), ang);
        F2.arrow.add(m.compose(v.set(x, h, y), q, s.set(1, 1, 1)), c.set('#3b2a1a'));
      }
    }
    for (const p of st.pois) {
      if (!p.found || p.claimed) continue;
      q.setFromAxisAngle(v.set(0, 1, 0), t * 1.5 + p.id);
      F2.poi.add(m.compose(v.set(p.x + 0.5, this.groundAt(p.x + 0.5, p.y + 0.5) + 0.6 + Math.sin(t * 3 + p.id) * 0.1, p.y + 0.5), q, s.set(1, 1.3, 1)), c.set('#f6c343'));
    }
    for (const p of Object.values(F2)) {
      if (p !== F2.tile) p.end();
    }
  }

  // In pull-down mode, a translucent red box over each building that would go.
  drawDemolish(ids) {
    if (!this.demoRoot) {
      this.demoRoot = new THREE.Group();
      this.dynRoot.add(this.demoRoot);
      this.demoGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      this.demoMat = new THREE.MeshBasicMaterial({ color: '#e74c3c', transparent: true, opacity: 0.38, depthWrite: false });
    }
    const boxes = this.demoRoot.children;
    let n = 0;
    for (const id of ids || []) {
      const b = this.st.byId.get(id);
      const o = this.buildingObjs.get(id);
      if (!b || !o) continue;
      if (!o.height) o.height = Math.max(0.3, new THREE.Box3().setFromObject(o.group).max.y - o.group.position.y);
      const m = boxes[n] || this.demoRoot.add(new THREE.Mesh(this.demoGeo, this.demoMat)).children[n];
      m.visible = true;
      m.position.set(b.x + b.w / 2, o.group.position.y, b.y + b.h / 2);
      m.scale.set(b.w + 0.06, o.height + 0.08, b.h + 0.06);
      m.renderOrder = 5;
      n++;
    }
    for (let k = n; k < boxes.length; k++) boxes[k].visible = false;
  }

  drawGhost(view, t) {
    const st = this.st;
    const tiles = this.fx.tile;
    const g = view.ghost;
    this.circle.visible = false;
    if (!g) {
      if (this.ghost) this.ghost.visible = false;
      this.drawDemolish(null);
      tiles.end();
      return;
    }
    const c = new THREE.Color();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (const tile of g.tiles) {
      const gy = Math.max(WATER_Y, this.groundAt(tile.x + g.w / 2, tile.y + g.h / 2)) + 0.04;
      tiles.add(m.compose(v.set(tile.x + g.w / 2, gy, tile.y + g.h / 2), q.identity(), s.set(g.w, 1, g.h)), c.set(tile.ok ? '#2ecc71' : '#e74c3c'));
    }
    tiles.end();
    this.drawDemolish(g.demolish ? g.ids : null);
    if (g.demolish) {
      if (this.ghost) this.ghost.visible = false;
      return;
    }
    if (this.ghostType !== g.type) {
      if (this.ghost) this.dynRoot.remove(this.ghost);
      const def = BUILDINGS[g.type];
      this.ghost = buildingModel({ type: g.type, w: def.w, h: def.h, built: 1, growth: 0.6, id: 0, level: 1 }, st, { l: true, r: true, u: false, d: false });
      this.ghost.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.transparent = true;
          o.material.opacity = 0.6;
          o.castShadow = false;
        }
      });
      this.ghostType = g.type;
      this.dynRoot.add(this.ghost);
    }
    const first = g.tiles[g.tiles.length - 1];
    this.ghost.visible = g.tiles.length === 1;
    if (first) {
      this.ghost.position.set(first.x, Math.max(WATER_Y, this.groundAt(first.x + g.w / 2, first.y + g.h / 2)) + 0.02, first.y);
      const def = BUILDINGS[g.type];
      const radius = def.tower?.range || def.job?.radius;
      if (radius && g.tiles.length === 1) {
        this.circle.visible = true;
        this.circle.position.set(first.x + g.w / 2, this.groundAt(first.x + g.w / 2, first.y + g.h / 2) + 0.08, first.y + g.h / 2);
        this.circle.scale.setScalar(radius);
      }
    }
  }

  drawOverlay(view, alpha, harmattan) {
    const st = this.st;
    const g = this.octx;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    if (harmattan) {
      g.fillStyle = 'rgba(214,170,110,0.13)';
      g.fillRect(0, 0, this.w, this.h);
    }
    const bar = (x, y, h, frac, width) => {
      const p = this.tileToScreen(x, y, h);
      if (p.x < -40 || p.y < -40 || p.x > this.w + 40 || p.y > this.h + 40) return;
      const w = width * this.cam.zoom;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(p.x - w / 2, p.y, w, 4);
      g.fillStyle = frac > 0.5 ? '#2ecc71' : frac > 0.25 ? '#f1c40f' : '#e74c3c';
      g.fillRect(p.x - w / 2, p.y, w * Math.max(0, frac), 4);
    };
    for (const u of st.units) {
      if (u.dead || (u.hp >= u.maxHp && !view.selected.has(u.id))) continue;
      const x = u.px + (u.x - u.px) * alpha;
      const y = u.py + (u.y - u.py) * alpha;
      if (u.owner !== 'player' && !st.visible[Math.floor(y) * st.W + Math.floor(x)]) continue;
      bar(x, y, this.standAt(x, y) + (u.type === 'horseman' ? 1.35 : 1.0), u.hp / u.maxHp, 22);
    }
    for (const b of st.buildings) {
      if (b.dead || b.built < 1 || b.hp >= b.maxHp) continue;
      bar(b.x + b.w / 2, b.y + b.h / 2, 1.4, b.hp / b.maxHp, 16 * b.w);
    }
    if (view.box) {
      const { x0, y0, x1, y1 } = view.box;
      g.fillStyle = 'rgba(255,224,102,0.12)';
      g.strokeStyle = 'rgba(255,224,102,0.8)';
      g.lineWidth = 1;
      g.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      g.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
  }

  // --- Thumbnails for the build bar ----------------------------------------------------

  static thumbnails(types, st) {
    const size = 112;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    gl.setSize(size, size, false);
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#7a5a3a', 1.6));
    const sun = new THREE.DirectionalLight('#fff0d6', 2.2);
    sun.position.set(-4, 8, 5);
    scene.add(sun);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const out = {};
    for (const [type, def] of types) {
      const fake = { type, w: def.w, h: def.h, built: 1, growth: 0.7, id: 3, level: 1 };
      const g = buildingModel(fake, st, def.line ? { l: true, r: true, u: false, d: false } : null);
      const box = new THREE.Box3().setFromObject(g);
      const center = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() / 2;
      scene.add(g);
      const d = radius / Math.sin((30 * Math.PI) / 360) * 0.9;
      cam.position.set(center.x + d * 0.45, center.y + d * 0.7, center.z + d * 0.6);
      cam.lookAt(center);
      gl.render(scene, cam);
      out[type] = canvas.toDataURL();
      scene.remove(g);
    }
    gl.dispose();
    return out;
  }
}

export { toon, toonInstanced };
