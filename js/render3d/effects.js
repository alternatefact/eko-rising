// Fire and smoke. Burning buildings throw up flames and thick black smoke;
// forges, cooking fires, garri pans, palm oil pits and factory chimneys
// breathe grey smoke. Particles are soft sprites that always face the camera.

import * as THREE from '../vendor/three.module.js';

const MAX = { fire: 500, smoke: 900 };

// Where each kind of building smokes from, in building-local tiles, and how thickly.
const CHIMNEYS = {
  campfire: [[1, 0.35, 1, 0.6]],
  blacksmith: [[1.55, 0.6, 1.45, 1]],
  garri: [[0.7, 0.9, 0.85, 0.7]],
  palmpress: [[0.6, 0.5, 1.5, 0.8]],
  factory: [[2.6, 2.05, 0.5, 1.4]],
  compound: [[1.9, 0.45, 1.2, 0.25]],
};

function spriteTexture(kind) {
  const n = 64;
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const g = c.getContext('2d');
  if (kind === 'fire') {
    // A teardrop of flame: white-yellow core fading to orange and then nothing.
    const grad = g.createRadialGradient(n / 2, n * 0.62, 0, n / 2, n * 0.55, n / 2);
    grad.addColorStop(0, 'rgba(255,250,220,1)');
    grad.addColorStop(0.25, 'rgba(255,200,80,0.95)');
    grad.addColorStop(0.55, 'rgba(240,110,30,0.6)');
    grad.addColorStop(1, 'rgba(200,40,10,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(n / 2, 2);
    g.bezierCurveTo(n * 0.85, n * 0.4, n * 0.95, n * 0.95, n / 2, n - 2);
    g.bezierCurveTo(n * 0.05, n * 0.95, n * 0.15, n * 0.4, n / 2, 2);
    g.fill();
  } else {
    // A soft, lumpy puff.
    for (let k = 0; k < 7; k++) {
      const x = n / 2 + Math.cos(k * 2.4) * n * 0.14;
      const y = n / 2 + Math.sin(k * 2.4) * n * 0.14;
      const grad = g.createRadialGradient(x, y, 0, x, y, n * 0.32);
      grad.addColorStop(0, 'rgba(255,255,255,0.5)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, n, n);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Cloud {
  constructor(scene, kind) {
    this.kind = kind;
    this.max = MAX[kind];
    this.n = 0;
    this.p = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.max * 3);
    this.size = new Float32Array(this.max);
    this.col = new Float32Array(this.max * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: spriteTexture(kind) }, uScale: { value: 30 } },
      vertexShader: `
        attribute float aSize;
        attribute vec4 aColor;
        uniform float uScale;
        varying vec4 vColor;
        void main() {
          vColor = aColor;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale;
        }`,
      fragmentShader: `
        uniform sampler2D map;
        varying vec4 vColor;
        void main() {
          vec4 t = texture2D(map, vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y));
          gl_FragColor = vec4(vColor.rgb * t.rgb, vColor.a * t.a);
          if (gl_FragColor.a < 0.01) discard;
        }`,
      transparent: true,
      depthWrite: false,
      blending: kind === 'fire' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = kind === 'fire' ? 3 : 2;
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, life, size, grow, color, alpha) {
    if (this.p.length >= this.max) return;
    this.p.push({ x, y, z, vx, vy, vz, t: 0, life, size, grow, color, alpha });
  }

  update(dt, wind) {
    let w = 0;
    for (let i = 0; i < this.p.length; i++) {
      const q = this.p[i];
      q.t += dt;
      if (q.t >= q.life) continue;
      q.x += (q.vx + wind.x * q.t) * dt;
      q.y += q.vy * dt;
      q.z += (q.vz + wind.z * q.t) * dt;
      q.vy *= 1 - dt * 0.4;
      this.p[w++] = q;
    }
    this.p.length = w;
    for (let i = 0; i < w; i++) {
      const q = this.p[i];
      const k = q.t / q.life;
      this.pos[i * 3] = q.x;
      this.pos[i * 3 + 1] = q.y;
      this.pos[i * 3 + 2] = q.z;
      this.size[i] = q.size * (1 + k * q.grow);
      // Fade in quickly, out slowly.
      const fade = Math.min(1, k * 6) * (1 - k);
      this.col[i * 4] = q.color.r;
      this.col[i * 4 + 1] = q.color.g;
      this.col[i * 4 + 2] = q.color.b;
      this.col[i * 4 + 3] = q.alpha * fade;
    }
    this.geo.setDrawRange(0, w);
    for (const a of ['position', 'aSize', 'aColor']) this.geo.attributes[a].needsUpdate = true;
  }

  dispose(scene) {
    scene.remove(this.points);
    this.geo.dispose();
    this.mat.dispose();
  }
}

const FIRE_COLORS = [new THREE.Color('#ffd27a'), new THREE.Color('#ff9a3c'), new THREE.Color('#ff7a2a')];
const BLACK = new THREE.Color('#2a2622');
const GREY = new THREE.Color('#bdb8b0');

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.fire = new Cloud(scene, 'fire');
    this.smoke = new Cloud(scene, 'smoke');
    this.acc = new Map();
  }

  dispose() {
    this.fire.dispose(this.scene);
    this.smoke.dispose(this.scene);
  }

  // Emit `rate` particles a second from a source, carrying fractions over.
  count(key, rate, dt) {
    const v = (this.acc.get(key) || 0) + rate * dt;
    const n = Math.floor(v);
    this.acc.set(key, v - n);
    return n;
  }

  update(dt, st, groundAt, inView, pxPerUnit, harmattan) {
    dt = Math.min(dt, 0.1);
    const wind = { x: harmattan ? 0.18 : 0.1, z: harmattan ? 0.1 : 0.05 };
    const R = Math.random;
    for (const b of st.buildings) {
      if (b.dead || b.built < 1) continue;
      const cx = b.x + b.w / 2;
      const cz = b.y + b.h / 2;
      if (!inView(cx, cz)) continue;
      const base = groundAt(cx, cz);
      // Burning: the worse the damage, the bigger the blaze.
      const hurt = b.maxHp ? 1 - b.hp / b.maxHp : 0;
      if (hurt > 0.35 && !b.wall) {
        const heat = Math.min(1, (hurt - 0.35) / 0.5);
        const area = b.w * b.h;
        for (let k = this.count(`f${b.id}`, (8 + heat * 26) * Math.sqrt(area), dt); k > 0; k--) {
          this.fire.emit(b.x + 0.15 + R() * (b.w - 0.3), base + 0.3 + R() * 0.5, b.y + 0.15 + R() * (b.h - 0.3), (R() - 0.5) * 0.15, 0.7 + R() * 0.6, (R() - 0.5) * 0.15, 0.5 + R() * 0.4, 0.35 + heat * 0.3, -0.5, FIRE_COLORS[(R() * 3) | 0], 0.9);
        }
        for (let k = this.count(`s${b.id}`, (4 + heat * 9) * Math.sqrt(area), dt); k > 0; k--) {
          this.smoke.emit(b.x + 0.2 + R() * (b.w - 0.4), base + 0.9 + R() * 0.4, b.y + 0.2 + R() * (b.h - 0.4), (R() - 0.5) * 0.1, 0.55 + R() * 0.35, (R() - 0.5) * 0.1, 3 + R() * 2, 0.45, 2.6, BLACK, 0.55);
        }
      }
      // Working chimneys and fires.
      const spots = CHIMNEYS[b.type];
      if (spots && (b.type === 'campfire' || b.type === 'compound' || (b.workers && b.workers.length) || b.type === 'factory')) {
        spots.forEach(([lx, ly, lz, rate], j) => {
          for (let k = this.count(`c${b.id}-${j}`, rate * 2.2, dt); k > 0; k--) {
            this.smoke.emit(b.x + lx + (R() - 0.5) * 0.05, base + ly, b.y + lz + (R() - 0.5) * 0.05, (R() - 0.5) * 0.05, 0.35 + R() * 0.2, (R() - 0.5) * 0.05, 2.6 + R() * 1.2, 0.18, 3, GREY, 0.42);
          }
        });
      }
    }
    // Villages under attack burn too.
    for (const f of st.factions) {
      if (!f.burning || f.burning < st.time.t) continue;
      if (!inView(f.x, f.y)) continue;
      const base = groundAt(f.x + 0.5, f.y + 0.5);
      for (let k = this.count(`v${f.id}`, 30, dt); k > 0; k--) {
        this.fire.emit(f.x + 0.5 + (R() - 0.5) * 4, base + 0.3, f.y + 0.5 + (R() - 0.5) * 3.4, 0, 0.8 + R() * 0.5, 0, 0.5 + R() * 0.3, 0.45, -0.5, FIRE_COLORS[(R() * 3) | 0], 0.9);
      }
    }
    this.fire.mat.uniforms.uScale.value = pxPerUnit;
    this.smoke.mat.uniforms.uScale.value = pxPerUnit;
    this.fire.update(dt, wind);
    this.smoke.update(dt, wind);
  }
}
