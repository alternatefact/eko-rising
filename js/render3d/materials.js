// Materials for the 3D world: cel-shaded "toon" surfaces, hand-painted
// textures (thatch, laterite, zinc, plaster, planks, farm soil), and a shared
// fog-of-war that every surface samples so unexplored land stays dark.

import * as THREE from '../vendor/three.module.js';
import { textureArt } from '../data/art.js';
import { graphicsStyle } from '../ui/settings.js';

// Life-like look (smooth light, photographic textures) or the cartoon look
// (stepped toon light, painted textures). Chosen once when the game loads.
export const REAL = typeof window !== 'undefined' && graphicsStyle() === 'real';

// Shared fog-of-war uniforms. The texture is W×H, red channel: 1 = visible,
// ~0.55 = explored but out of sight, 0 = never seen.
function white() {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
}

export const FOW = {
  fowMap: { value: white() },
  fowSize: { value: new THREE.Vector2(1, 1) },
  // Building-land overlay: 1 = yours, 2 = another people's. Shown while placing.
  terrMap: { value: white() },
  showTerr: { value: 0 },
};

const VERT_HEAD = 'varying vec2 vFowXZ;\n';
const VERT_BODY = `
  vec4 fowWP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    fowWP = instanceMatrix * fowWP;
  #endif
  fowWP = modelMatrix * fowWP;
  vFowXZ = fowWP.xz;
`;
const FRAG_HEAD = 'uniform sampler2D fowMap;\nuniform vec2 fowSize;\nvarying vec2 vFowXZ;\n';
const FRAG_BODY = `
  float fowV = texture2D(fowMap, vFowXZ / fowSize).r;
  gl_FragColor.rgb = mix(vec3(0.035, 0.045, 0.06), gl_FragColor.rgb, smoothstep(0.02, 0.98, fowV));
`;

export function withFog(material, extra) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.fowMap = FOW.fowMap;
    shader.uniforms.fowSize = FOW.fowSize;
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = FRAG_HEAD + shader.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${FRAG_BODY}`);
    if (extra) extra(shader);
  };
  material.customProgramCacheKey = () => `fow${extra ? '-x' : ''}`;
  return material;
}

let gradient = null;
function toonGradient() {
  if (!gradient) {
    const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
    gradient = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

const cache = new Map();

// A material in one colour, optionally textured: cel-shaded for the cartoon
// look, smoothly lit for the realistic one. Cached by key.
export function toon(color, opts = {}) {
  const key = `${color}|${opts.map || ''}|${opts.emissive || ''}|${opts.transparent ? opts.opacity : ''}|${opts.side || ''}`;
  if (cache.has(key)) return cache.get(key);
  const tint = new THREE.Color(color);
  // Photographic textures carry their own colour; tints only nudge them.
  if (REAL && opts.map) tint.lerp(new THREE.Color('#ffffff'), 0.65);
  const params = {
    color: tint,
    map: opts.map ? texture(opts.map) : null,
    emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: opts.emissive ? 1 : 0,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side === 'double' ? THREE.DoubleSide : THREE.FrontSide,
  };
  const m = REAL ? new THREE.MeshLambertMaterial(params) : new THREE.MeshToonMaterial({ ...params, gradientMap: toonGradient() });
  withFog(m);
  cache.set(key, m);
  return m;
}

// White material for instanced meshes that colour each instance.
export function toonInstanced(key) {
  const k = `inst|${key}`;
  if (cache.has(k)) return cache.get(k);
  const m = REAL ? new THREE.MeshLambertMaterial({ color: 0xffffff }) : new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonGradient() });
  withFog(m);
  cache.set(k, m);
  return m;
}

// Instanced material with a texture (e.g. patterned cloth), tinted per instance.
export function toonInstancedMap(key, map) {
  const k = `instmap|${key}`;
  if (cache.has(k)) return cache.get(k);
  const m = REAL ? new THREE.MeshLambertMaterial({ color: 0xffffff, map }) : new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonGradient(), map });
  withFog(m);
  m.customProgramCacheKey = () => 'fow-map';
  cache.set(k, m);
  return m;
}

// --- Hand-painted textures ------------------------------------------------------

const textures = new Map();

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

const PAINTERS = {
  thatch(g, n, r) {
    g.fillStyle = '#c9a35b';
    g.fillRect(0, 0, n, n);
    for (let k = 0; k < 900; k++) {
      const x = r() * n;
      const y = r() * n;
      const len = 6 + r() * 16;
      g.strokeStyle = r() < 0.5 ? 'rgba(120,85,35,0.45)' : 'rgba(240,210,140,0.55)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 3, y + len);
      g.stroke();
    }
    for (let y = 0; y < n; y += 16) {
      g.fillStyle = 'rgba(90,60,20,0.25)';
      g.fillRect(0, y, n, 2);
    }
  },
  mud(g, n, r) {
    g.fillStyle = '#a5603a';
    g.fillRect(0, 0, n, n);
    for (let k = 0; k < 500; k++) {
      g.fillStyle = r() < 0.5 ? 'rgba(130,70,40,0.35)' : 'rgba(200,130,85,0.3)';
      const s = 2 + r() * 6;
      g.fillRect(r() * n, r() * n, s, s * 0.7);
    }
    g.strokeStyle = 'rgba(80,40,20,0.35)';
    for (let k = 0; k < 10; k++) {
      let x = r() * n;
      let y = r() * n;
      g.beginPath();
      g.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        x += (r() - 0.5) * 18;
        y += r() * 12;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  },
  zinc(g, n, r) {
    for (let x = 0; x < n; x += 8) {
      const grad = g.createLinearGradient(x, 0, x + 8, 0);
      grad.addColorStop(0, '#9aa3a8');
      grad.addColorStop(0.5, '#dfe5e8');
      grad.addColorStop(1, '#9aa3a8');
      g.fillStyle = grad;
      g.fillRect(x, 0, 8, n);
    }
    for (let k = 0; k < 12; k++) {
      g.fillStyle = `rgba(160,82,45,${0.15 + r() * 0.25})`;
      g.beginPath();
      g.ellipse(r() * n, r() * n, 4 + r() * 14, 3 + r() * 8, 0, 0, Math.PI * 2);
      g.fill();
    }
  },
  plaster(g, n, r) {
    g.fillStyle = '#efe6d2';
    g.fillRect(0, 0, n, n);
    for (let k = 0; k < 400; k++) {
      g.fillStyle = r() < 0.5 ? 'rgba(200,185,160,0.25)' : 'rgba(255,255,255,0.3)';
      g.fillRect(r() * n, r() * n, 3, 3);
    }
    g.fillStyle = 'rgba(165,96,58,0.35)';
    g.fillRect(0, n - 10, n, 10);
  },
  planks(g, n, r) {
    g.fillStyle = '#8b5a2b';
    g.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y += 16) {
      g.fillStyle = r() < 0.5 ? '#7a4e25' : '#946233';
      g.fillRect(0, y + 1, n, 14);
      g.strokeStyle = 'rgba(50,30,10,0.4)';
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        const x = r() * n;
        g.moveTo(x, y + 3);
        g.lineTo(x + 20, y + 3 + r() * 8);
        g.stroke();
      }
    }
  },
  soil(g, n, r) {
    g.fillStyle = '#7a4a28';
    g.fillRect(0, 0, n, n);
    for (let k = 0; k < 700; k++) {
      g.fillStyle = r() < 0.5 ? 'rgba(60,35,15,0.45)' : 'rgba(150,100,60,0.4)';
      const s = 1 + r() * 4;
      g.beginPath();
      g.arc(r() * n, r() * n, s, 0, Math.PI * 2);
      g.fill();
    }
  },
  cloth(g, n, r) {
    // Àdìrẹ-like indigo pattern for awnings and banners.
    g.fillStyle = '#23356b';
    g.fillRect(0, 0, n, n);
    g.strokeStyle = 'rgba(220,230,255,0.6)';
    g.lineWidth = 3;
    for (let y = 8; y < n; y += 32) {
      for (let x = 8; x < n; x += 32) {
        g.beginPath();
        g.arc(x + 8, y + 8, 7, 0, Math.PI * 2);
        g.stroke();
      }
    }
  },
  tiles(g, n, r) {
    g.fillStyle = '#b5532f';
    g.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y += 16) {
      for (let x = (y / 16) % 2 ? 0 : 8; x < n; x += 16) {
        g.fillStyle = r() < 0.5 ? '#c7643a' : '#a04a2a';
        g.fillRect(x + 1, y + 1, 14, 14);
      }
    }
  },
  stone(g, n, r) {
    g.fillStyle = '#a39b8f';
    g.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y += 20) {
      for (let x = (y / 20) % 2 ? 0 : 16; x < n; x += 32) {
        g.fillStyle = r() < 0.5 ? '#b4ad9f' : '#958d82';
        g.fillRect(x + 1, y + 1, 30, 18);
      }
    }
  },
};

export function texture(name) {
  if (textures.has(name)) return textures.get(name);
  const n = 128;
  const c = canvas(n);
  PAINTERS[name](c.getContext('2d'), n, rand(name.length * 7919));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  textures.set(name, t);
  // Swap in the painted (or life-like) texture from art/ once it has loaded.
  const url = textureArt(name, REAL);
  if (url && typeof Image !== 'undefined') {
    const img = new Image();
    img.onload = () => {
      // The GPU copy was sized for the placeholder; drop it so it is rebuilt.
      t.dispose();
      t.image = img;
      t.needsUpdate = true;
    };
    img.src = url;
  }
  return t;
}

// --- Painted textures that tile across the world -------------------------------

// A repeating texture from art/, shown as a flat colour until the image arrives.
export function artTexture(path, fallback = '#808080', { repeat = true } = {}) {
  const key = `art|${path}`;
  if (textures.has(key)) return textures.get(key);
  const c = canvas(4);
  const g = c.getContext('2d');
  g.fillStyle = fallback;
  g.fillRect(0, 0, 4, 4);
  const t = new THREE.CanvasTexture(c);
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.onload = () => {
      // The GPU copy was sized for the placeholder; drop it so it is rebuilt.
      t.dispose();
      t.image = img;
      t.needsUpdate = true;
    };
    img.src = path;
  }
  textures.set(key, t);
  return t;
}

// --- Wind ---------------------------------------------------------------------------

// Grass, leaves and fronds sway together. `aSway` (0 at the root, 1 at the
// tip) says how far each vertex may move.
export const WIND = { uTime: { value: 0 }, uStrength: { value: 1 } };

export const SWAY_VERTEX = `
  {
    vec2 swayAt = vec2(0.0);
    #ifdef USE_INSTANCING
      swayAt = instanceMatrix[3].xz;
    #endif
    float ph = uTime * 1.5 + swayAt.x * 0.37 + swayAt.y * 0.23;
    float sw = (sin(ph) * 0.65 + sin(ph * 2.31 + 1.7) * 0.35) * aSway * uStrength;
    vec3 wind = vec3(sw * 0.06, 0.0, sw * 0.035);
    #ifdef USE_INSTANCING
      // Undo the plant's own turn so every plant bends the same way.
      mat3 im = mat3(instanceMatrix);
      transformed += transpose(im) * wind / max(dot(im[0], im[0]), 0.0001);
    #else
      transformed += wind;
    #endif
  }
`;

export function withSway(shader) {
  shader.uniforms.uTime = WIND.uTime;
  shader.uniforms.uStrength = WIND.uStrength;
  shader.vertexShader = 'attribute float aSway;\nuniform float uTime;\nuniform float uStrength;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${SWAY_VERTEX}`);
}
