// What lies on the storage floors, stacked the way it is brought home:
// planks laid crosswise, mud bricks in neat courses, heaps of yams, baskets
// of fish, pots of palm oil. Every floor tile is one spot; each good takes as
// many spots as its amount needs, in a fixed order, so the stacks grow and
// shrink as goods come and go. Rebuilt only when the stores change.

import * as THREE from '../vendor/three.module.js';
import { Pool } from './people.js';

const PER_SPOT = 20;
const ORDER = ['wood', 'bricks', 'stone', 'yam', 'cassava', 'garri', 'fish', 'meat', 'palmoil', 'iron', 'weapons', 'salt', 'cloth'];

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const V = new THREE.Vector3();
const S = new THREE.Vector3();
const colors = new Map();
const col = (hex) => {
  if (!colors.has(hex)) colors.set(hex, new THREE.Color(hex));
  return colors.get(hex);
};

// A small repeatable jitter, so heaps look heaped but never flicker.
function jit(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s) - 0.5;
}

export class Stocks {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    const P = (geo, key) => new Pool(this.root, geo, key, 128, true);
    this.pools = {
      plank: P(new THREE.BoxGeometry(0.44, 0.032, 0.09), 'stk-plank'),
      brick: P(new THREE.BoxGeometry(0.15, 0.06, 0.075), 'stk-brick'),
      block: P(new THREE.BoxGeometry(0.17, 0.11, 0.13), 'stk-block'),
      tuber: P(new THREE.IcosahedronGeometry(0.05, 0), 'stk-tuber'),
      basket: P(new THREE.CylinderGeometry(0.1, 0.075, 0.1, 10), 'stk-basket'),
      sack: P(new THREE.SphereGeometry(0.085, 8, 6), 'stk-sack'),
    };
    this.key = '';
  }

  dispose() {
    this.scene.remove(this.root);
  }

  put(pool, x, y, z, ry, sx, sy, sz, color) {
    E.set(0, ry, 0);
    Q.setFromEuler(E);
    M.compose(V.set(x, y, z), Q, S.set(sx, sy, sz));
    this.pools[pool].add(M, col(color));
  }

  update(st, groundAt) {
    const floors = st.buildings.filter((b) => b.type === 'stockpile' && b.owner === 'player' && !b.dead && b.built >= 1);
    const key = `${floors.map((b) => `${b.id}:${b.x},${b.y}`).join(';')}|${ORDER.map((r) => Math.floor(st.res[r] || 0)).join(',')}`;
    if (key === this.key) return;
    this.key = key;
    for (const p of Object.values(this.pools)) p.begin();
    const spots = [];
    for (const b of floors) {
      const y = groundAt(b.x + b.w / 2, b.y + b.h / 2) + 0.07;
      for (let dz = 0; dz < b.h; dz++) for (let dx = 0; dx < b.w; dx++) spots.push({ x: b.x + dx + 0.5, y, z: b.y + dz + 0.5 });
    }
    let s = 0;
    for (const r of ORDER) {
      let n = Math.floor(st.res[r] || 0);
      while (n > 0 && s < spots.length) {
        const take = Math.min(n, PER_SPOT);
        this.spot(r, spots[s], take, s);
        n -= take;
        s++;
      }
    }
    for (const p of Object.values(this.pools)) p.end();
  }

  spot(r, p, n, k) {
    switch (r) {
      case 'wood': {
        // Planks in courses of four, each course laid across the one below.
        for (let i = 0; i < n; i++) {
          const layer = Math.floor(i / 4);
          const j = i % 4;
          const across = layer % 2 === 1;
          const off = (j - 1.5) * 0.105;
          this.put('plank', p.x + (across ? off : 0), p.y + 0.016 + layer * 0.034, p.z + (across ? 0 : off), across ? Math.PI / 2 : 0, 1, 1, 1, (i + layer) % 3 ? '#c9a06c' : '#b88a57');
        }
        return;
      }
      case 'bricks': {
        // Courses of six, turned a quarter each course, like a builder's stack.
        for (let i = 0; i < n; i++) {
          const layer = Math.floor(i / 6);
          const j = i % 6;
          const turned = layer % 2 === 1;
          const a = (j % 2) - 0.5;
          const b = Math.floor(j / 2) - 1;
          const lx = turned ? b * 0.08 : a * 0.155;
          const lz = turned ? a * 0.155 : b * 0.08;
          this.put('brick', p.x + lx, p.y + 0.03 + layer * 0.061, p.z + lz, turned ? Math.PI / 2 : 0, 1, 1, 1, (i * 7) % 5 === 0 ? '#9c4a2a' : '#b55d34');
        }
        return;
      }
      case 'stone':
      case 'iron': {
        const blocks = Math.ceil(n / 2);
        for (let i = 0; i < blocks; i++) {
          const layer = Math.floor(i / 4);
          const j = i % 4;
          this.put('block', p.x + ((j % 2) - 0.5) * 0.18, p.y + 0.055 + layer * 0.11, p.z + (Math.floor(j / 2) - 0.5) * 0.14, jit(i, k) * 0.2, 1, 1, 1, r === 'iron' ? '#5b4a42' : '#a7a197');
        }
        return;
      }
      case 'yam':
      case 'cassava': {
        // A heap: a wide bottom layer, narrower ones on top.
        const rows = [16, 9, 4, 1];
        let i = 0;
        for (let layer = 0; layer < rows.length && i < n; layer++) {
          const side = Math.sqrt(rows[layer]);
          for (let j = 0; j < rows[layer] && i < n; j++, i++) {
            const lx = ((j % side) - (side - 1) / 2) * 0.1 + jit(i, 1) * 0.03;
            const lz = (Math.floor(j / side) - (side - 1) / 2) * 0.1 + jit(1, i) * 0.03;
            const color = r === 'cassava' ? (i % 2 ? '#a87b4f' : '#c49a6c') : i % 3 ? '#7a4a20' : '#8b5a2b';
            this.put('tuber', p.x + lx, p.y + 0.035 + layer * 0.06, p.z + lz, jit(i, 7) * 3, r === 'cassava' ? 2 : 1.6, 0.8, 0.85, color);
          }
        }
        return;
      }
      case 'fish':
      case 'garri':
      case 'meat':
      case 'palmoil':
      case 'salt':
      case 'cloth':
      case 'weapons': {
        const items = Math.ceil(n / 4);
        for (let i = 0; i < items; i++) {
          const layer = Math.floor(i / 4);
          const lx = ((i % 2) - 0.5) * 0.22;
          const lz = (Math.floor((i % 4) / 2) - 0.5) * 0.22;
          const y = p.y + layer * 0.1;
          if (r === 'fish') {
            this.put('basket', p.x + lx, y + 0.05, p.z + lz, 0, 1, 1, 1, '#9b7348');
            this.put('tuber', p.x + lx, y + 0.1, p.z + lz, jit(i, 3) * 3, 1.8, 0.6, 0.9, '#c9d3da');
          } else if (r === 'palmoil') {
            this.put('sack', p.x + lx, y + 0.07, p.z + lz, 0, 0.9, 1, 0.9, '#5a3a20');
            this.put('basket', p.x + lx, y + 0.13, p.z + lz, 0, 0.55, 0.15, 0.55, '#e2621b');
          } else if (r === 'weapons') {
            this.put('plank', p.x + lx * 0.5, y + 0.02, p.z + lz, 0, 0.8, 0.6, 0.5, '#7f8c8d');
          } else {
            const tint = { garri: '#efe3c4', meat: '#9c3b2c', salt: '#f4f4ee', cloth: '#2f4a8a' }[r];
            this.put('sack', p.x + lx, y + 0.075, p.z + lz, jit(i, 9), 1, 0.85, 1, tint);
          }
        }
        return;
      }
      default:
    }
  }
}
