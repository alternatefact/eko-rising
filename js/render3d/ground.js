// The land and the water. The ground blends painted textures (grass, dry
// savanna, sand, forest floor, rock, mangrove mud and red earth) by terrain,
// and wears into bare earth where people live and walk. The water is shallow
// turquoise at the banks, deep blue further out, with foam along the shore.

import * as THREE from '../vendor/three.module.js';
import { T, isWater } from '../world/terrain.js';
import { FOW, withFog, artTexture, WIND, REAL } from './materials.js';
import { natureArt } from '../data/art.js';

export const WATER_Y = -0.15;
const SKIRT = 24; // land continues this far past the map edge

// Texture layers, in the order the shader reads them.
const LAYERS = [
  ['grass', '#4f8a2c'], ['savanna', '#b08a48'], ['sand', '#e0b878'], ['forest', '#3e3a1c'],
  ['rock', '#82705a'], ['mud', '#46342a'], ['earth', '#98462a'],
];
const EARTH = 6;

// How much of each layer a terrain type shows.
const MIX = {
  [T.GRASS]: [[0, 1]],
  [T.SAVANNA]: [[1, 1]],
  [T.SAND]: [[2, 1]],
  [T.FOREST]: [[3, 0.8], [0, 0.2]],
  [T.HILL]: [[4, 0.85], [1, 0.15]],
  [T.MANGROVE]: [[5, 0.75], [3, 0.25]],
  [T.FORD]: [[2, 0.6], [5, 0.4]],
  [T.LAGOON]: [[5, 0.55], [2, 0.45]],
  [T.RIVER]: [[5, 0.6], [2, 0.4]],
  [T.OCEAN]: [[2, 1]],
};

// Cheap value noise, shared by the ground and water shaders.
const NOISE = `
  float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float gNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
`;

export class Ground {
  constructor(scene, st, vh, mobile) {
    this.scene = scene;
    this.st = st;
    this.vh = vh;
    this.mobile = mobile;
    const n = st.W * st.H;
    this.base = new Float32Array(n * 8); // layer weights per tile (8 slots, 7 used)
    this.wear = new Float32Array(n); // 0..1 trodden earth per tile
    this.foot = new Float32Array(n); // footfall, decays slowly
    this.buildBase();
    this.buildMesh();
    this.buildWater();
  }

  dispose() {
    for (const m of [this.mesh, this.water]) {
      if (!m) continue;
      this.scene.remove(m);
      m.geometry.dispose();
    }
  }

  buildBase() {
    const st = this.st;
    for (let i = 0; i < st.W * st.H; i++) {
      for (const [layer, w] of MIX[st.terrain[i]] || MIX[T.GRASS]) this.base[i * 8 + layer] = w;
    }
  }

  // --- The land ------------------------------------------------------------------------

  buildMesh() {
    const st = this.st;
    const W = st.W;
    const H = st.H;
    // The grid runs SKIRT tiles past every edge, repeating the edge tiles.
    const GW = W + SKIRT * 2;
    const GH = H + SKIRT * 2;
    this.GW = GW;
    this.GH = GH;
    const count = (GW + 1) * (GH + 1);
    const pos = new Float32Array(count * 3);
    for (let gy = 0; gy <= GH; gy++) {
      for (let gx = 0; gx <= GW; gx++) {
        const k = gy * (GW + 1) + gx;
        const x = gx - SKIRT;
        const y = gy - SKIRT;
        const cx = Math.max(0, Math.min(W, x));
        const cy = Math.max(0, Math.min(H, y));
        const out = Math.max(cx - x, x - cx, cy - y, y - cy);
        let h = this.vh[cy * (W + 1) + cx];
        // Sea floor keeps falling away past the coast.
        if (out > 0 && h < 0) h -= Math.min(0.4, out * 0.05);
        pos[k * 3] = x;
        pos[k * 3 + 1] = h;
        pos[k * 3 + 2] = y;
      }
    }
    const idx = [];
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const a = y * (GW + 1) + x;
        const b = a + 1;
        const c = a + GW + 1;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.splatA = new THREE.BufferAttribute(new Float32Array(count * 4), 4);
    this.splatB = new THREE.BufferAttribute(new Float32Array(count * 4), 4);
    this.splatA.setUsage(THREE.DynamicDrawUsage);
    this.splatB.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('splatA', this.splatA);
    g.setAttribute('splatB', this.splatB);
    this.writeSplat();

    const maps = LAYERS.map(([name, color]) => artTexture(natureArt(name, REAL), color));
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    withFog(mat, (shader) => {
      maps.forEach((t, k) => (shader.uniforms[`gTex${k}`] = { value: t }));
      shader.uniforms.terrMap = FOW.terrMap;
      shader.uniforms.showTerr = FOW.showTerr;
      shader.vertexShader = 'attribute vec4 splatA;\nattribute vec4 splatB;\nvarying vec4 vSplatA;\nvarying vec4 vSplatB;\nvarying float vGroundY;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vSplatA = splatA;\n  vSplatB = splatB;\n  vGroundY = transformed.y;',
      );
      const samplers = maps.map((_, k) => `uniform sampler2D gTex${k};`).join('\n');
      shader.fragmentShader = `${samplers}\nuniform sampler2D terrMap;\nuniform float showTerr;\nvarying vec4 vSplatA;\nvarying vec4 vSplatB;\nvarying float vGroundY;\n${NOISE}\n` + shader.fragmentShader
        .replace('#include <map_fragment>', `
          {
            vec2 wp = vFowXZ;
            vec2 uv = wp / 3.0;
            // Ragged, natural edges between ground types.
            float edge = gNoise(wp * 1.7) - 0.5;
            float w[7];
            w[0] = vSplatA.x; w[1] = vSplatA.y; w[2] = vSplatA.z; w[3] = vSplatA.w;
            w[4] = vSplatB.x; w[5] = vSplatB.y; w[6] = vSplatB.z;
            vec3 col = vec3(0.0);
            float total = 0.0;
            ${maps.map((_, k) => `
            if (w[${k}] > 0.01) {
              vec3 c = texture2D(gTex${k}, uv${k === 2 ? ' * 0.8' : ''}).rgb;
              float h = dot(c, vec3(0.3, 0.5, 0.2));
              float ww = max(0.0, w[${k}] + edge * 0.35 * w[${k}] * (1.0 - w[${k}]) * 4.0);
              ww = pow(ww, 2.2) * (0.35 + h)${k === 6 ? ' * 1.6' : ''};
              col += c * ww;
              total += ww;
            }`).join('')}
            col /= max(total, 0.0001);
            // Big soft patches of lighter and darker ground hide the repeats.
            float macro = gNoise(wp * 0.11) * 0.6 + gNoise(wp * 0.37) * 0.4;
            col *= 0.84 + macro * 0.32;
            col = mix(col, col * vec3(1.08, 1.04, 0.86), smoothstep(0.55, 0.9, macro) * vSplatA.x);
            // Under the water the bed is dim and green-blue.
            float wet = smoothstep(${(WATER_Y + 0.02).toFixed(2)}, ${(WATER_Y - 0.25).toFixed(2)}, vGroundY);
            col = mix(col, col * vec3(0.35, 0.5, 0.5), wet);
            diffuseColor.rgb *= col;
          }`)
        .replace('#include <dithering_fragment>', `
          if (showTerr > 0.5) {
            vec4 terr = texture2D(terrMap, vFowXZ / fowSize);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.93, 0.55), terr.g * 0.22);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.85, 0.15, 0.1), terr.r * 0.32);
          }
          #include <dithering_fragment>`);
    });
    mat.customProgramCacheKey = () => 'ground-splat';
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
  }

  // Vertex weights: the average of the four tiles around each corner, with
  // trodden earth laid over the top.
  writeSplat() {
    const st = this.st;
    const W = st.W;
    const H = st.H;
    const A = this.splatA.array;
    const B = this.splatB.array;
    const w = new Float32Array(8);
    for (let gy = 0; gy <= this.GH; gy++) {
      for (let gx = 0; gx <= this.GW; gx++) {
        const x = gx - SKIRT;
        const y = gy - SKIRT;
        w.fill(0);
        let n = 0;
        let wear = 0;
        for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
          const tx = Math.max(0, Math.min(W - 1, x + dx));
          const ty = Math.max(0, Math.min(H - 1, y + dy));
          const i = ty * W + tx;
          for (let k = 0; k < 7; k++) w[k] += this.base[i * 8 + k];
          wear += this.wear[i];
          n++;
        }
        if (n) {
          for (let k = 0; k < 7; k++) w[k] /= n;
          wear /= n;
        }
        if (wear > 0) {
          for (let k = 0; k < 7; k++) w[k] *= 1 - wear;
          w[EARTH] += wear;
        }
        const v = gy * (this.GW + 1) + gx;
        A[v * 4] = w[0];
        A[v * 4 + 1] = w[1];
        A[v * 4 + 2] = w[2];
        A[v * 4 + 3] = w[3];
        B[v * 4] = w[4];
        B[v * 4 + 1] = w[5];
        B[v * 4 + 2] = w[6];
        B[v * 4 + 3] = 0;
      }
    }
    this.splatA.needsUpdate = true;
    this.splatB.needsUpdate = true;
  }

  // People wear paths into the ground where they walk often.
  addFootfall(x, y, amount) {
    const st = this.st;
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= st.W || ty >= st.H) return;
    this.foot[ty * st.W + tx] += amount;
  }

  // Recompute wear from buildings and footfall. Returns the tiles whose
  // grass should come or go.
  updateWear() {
    const st = this.st;
    const W = st.W;
    const yard = new Float32Array(W * st.H);
    for (const b of st.buildings) {
      if (b.dead || b.wall || b.gate || b.type === 'farm' || b.type === 'cassava') continue;
      const inner = b.type === 'campfire' || b.type === 'palace' || b.type === 'market' || b.type === 'compound' ? 0.95 : 0.85;
      for (let y = b.y - 1; y <= b.y + b.h; y++) {
        for (let x = b.x - 1; x <= b.x + b.w; x++) {
          if (x < 0 || y < 0 || x >= W || y >= st.H) continue;
          const inside = x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
          const i = y * W + x;
          yard[i] = Math.max(yard[i], inside ? inner : 0.62);
        }
      }
    }
    for (const f of st.factions) {
      if (!st.explored[f.y * W + f.x]) continue;
      const r = 3;
      for (let y = f.y - r; y <= f.y + r; y++) {
        for (let x = f.x - r; x <= f.x + r; x++) {
          if (x < 0 || y < 0 || x >= W || y >= st.H) continue;
          const d = Math.hypot(x - f.x, y - f.y);
          if (d <= r) yard[y * W + x] = Math.max(yard[y * W + x], 0.75 * (1 - d / (r + 1)) + 0.15);
        }
      }
    }
    const changed = [];
    let any = false;
    for (let i = 0; i < W * st.H; i++) {
      if (st.terrain[i] <= T.RIVER) continue; // water
      this.foot[i] *= 0.995;
      const path = Math.min(0.8, Math.max(0, (this.foot[i] - 3) / 25));
      const v = Math.max(yard[i], path);
      if (Math.abs(v - this.wear[i]) > 0.04) {
        if ((v > 0.35) !== (this.wear[i] > 0.35)) changed.push(i);
        this.wear[i] = v;
        any = true;
      }
    }
    if (any) this.writeSplat();
    return changed;
  }

  // --- The water ----------------------------------------------------------------------

  buildWater() {
    const st = this.st;
    const W = st.W;
    const H = st.H;
    // How deep the water is on each tile: sea, lagoon, river or ford.
    const DEPTH = { [T.OCEAN]: 1, [T.LAGOON]: 0.75, [T.RIVER]: 0.6, [T.FORD]: 0.22 };
    const hd = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const t = st.terrain[i];
      hd[i * 4] = Math.round((isWater(t) || t === T.FORD ? DEPTH[t] : 0) * 255);
      hd[i * 4 + 3] = 255;
    }
    this.heightTex = new THREE.DataTexture(hd, W, H, THREE.RGBAFormat);
    this.heightTex.magFilter = THREE.LinearFilter;
    this.heightTex.minFilter = THREE.LinearFilter;
    this.heightTex.needsUpdate = true;

    const g = new THREE.PlaneGeometry(W + SKIRT * 2, H + SKIRT * 2, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(W / 2, WATER_Y, H / 2);
    const mat = new THREE.MeshPhongMaterial({ color: '#ffffff', transparent: true, shininess: 120, specular: new THREE.Color('#8fb8bd') });
    withFog(mat, (shader) => {
      shader.uniforms.hMap = { value: this.heightTex };
      shader.uniforms.hSize = { value: new THREE.Vector2(W, H) };
      shader.uniforms.uTime = WIND.uTime;
      shader.fragmentShader = `uniform sampler2D hMap;\nuniform vec2 hSize;\nuniform float uTime;\n${NOISE}\n` + shader.fragmentShader
        .replace('#include <map_fragment>', `
          vec2 wp = vFowXZ;
          vec2 huv = wp / hSize;
          vec2 outside = max(vec2(0.0), max(-huv, huv - 1.0)) * hSize;
          float wet = texture2D(hMap, clamp(huv, 0.0, 1.0)).r;
          wet = min(1.0, wet + min(0.4, max(outside.x, outside.y) * 0.05) * step(0.5, wet));
          float depth = wet * 0.7 - 0.12;
          float r1 = gNoise(wp * 1.25 + vec2(uTime * 0.16, uTime * 0.09));
          float r2 = gNoise(wp * 2.9 - vec2(uTime * 0.11, -uTime * 0.19));
          float rip = r1 * 0.6 + r2 * 0.4;
          vec3 shallow = vec3(0.36, 0.74, 0.68);
          vec3 mid = vec3(0.13, 0.50, 0.58);
          vec3 deep = vec3(0.05, 0.25, 0.42);
          vec3 wc = mix(shallow, mid, smoothstep(0.0, 0.22, depth));
          wc = mix(wc, deep, smoothstep(0.25, 0.6, depth));
          wc *= 0.88 + rip * 0.24;
          // Foam: a bright lip at the bank and soft bands rolling in.
          float lip = 1.0 - smoothstep(-0.1, 0.02 + r2 * 0.04, depth);
          float bands = smoothstep(0.65, 0.9, sin(depth * 55.0 - uTime * 1.8 + r1 * 3.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.0, 0.18, depth));
          float foam = clamp(lip * 0.55 + bands * 0.3, 0.0, 1.0) * (0.45 + 0.55 * gNoise(wp * 7.0 + uTime * 0.4));
          wc = mix(wc, vec3(0.86, 0.94, 0.92), foam);
          diffuseColor.rgb = wc;
          diffuseColor.a = clamp(mix(0.6, 0.95, smoothstep(-0.05, 0.3, depth)) + foam * 0.3, 0.0, 1.0);
          float rx = sin(wp.x * 3.1 + uTime * 1.3 + r1 * 4.0) * 0.5 + sin(wp.y * 2.3 - uTime * 0.9) * 0.3;
          float rz = cos(wp.y * 2.9 + uTime * 1.1 + r2 * 4.0) * 0.5 + cos(wp.x * 2.1 + uTime * 0.7) * 0.3;
        `)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          normal = normalize(normal + (viewMatrix * vec4(rx * 0.12, 0.0, rz * 0.12, 0.0)).xyz);`);
    });
    mat.customProgramCacheKey = () => 'water-depth';
    this.water = new THREE.Mesh(g, mat);
    this.water.receiveShadow = true;
    this.water.renderOrder = 1;
    this.scene.add(this.water);
  }
}
