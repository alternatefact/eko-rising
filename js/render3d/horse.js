// Horses for the mounted soldiers. Each is a textured model made with
// Higgsfield from a side-view picture (art/people/horses/<name>.glb), which
// comes without bones. Here it is given a skeleton found from its own shape:
// the four legs are the columns of the lowest vertices, each with a hip and
// a knee; the neck and the tail swing at the front and back. Walk and gallop
// are worked out in code. Used by the sprite baker (tools/bake), which seats
// a rider on the saddle (seatRider).

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/three.module.js';
import { withFog } from './materials.js';

// `height`: from the ground to the ears, in tiles (a grown man is 0.82).
// `seat`: where the rider sits, as a share of the height above the ground and
// of the length forward of the middle.
export const HORSES = {
  // A light horse of the savanna, chestnut, with a woven saddle cloth.
  horse_light: { height: 0.86, seat: [0.6, 0.02] },
  // A war horse in quilted cotton armour, with tasselled bridle.
  horse_armour: { height: 0.92, seat: [0.62, 0.02] },
};

const BASE = 'art/people/horses';

// Where each part bends, as a share of the height.
const HIP = 0.46; // where the leg swings from, just inside the body
const KNEE = 0.26; // the knee in front, the hock behind
const BELLY = 0.38; // a leg owns what hangs below this, fading out above it
const NECK = 0.62; // the base of the neck
const LEGS = ['LF', 'RF', 'LH', 'RH'];

export class Horses {
  constructor() {
    this.loader = new GLTFLoader();
    this.models = new Map();
  }

  // The model, rigged, or null while it loads.
  model(name) {
    let m = this.models.get(name);
    if (m) return m.status === 'ready' ? m : null;
    m = { status: 'loading' };
    this.models.set(name, m);
    this.loader.load(
      `${BASE}/${name}.glb`,
      (gltf) => {
        try {
          Object.assign(m, rig(gltf.scene, HORSES[name]), { status: 'ready' });
        } catch (err) {
          console.error(`rigging ${name}:`, err);
          m.status = 'failed';
        }
      },
      undefined,
      () => (m.status = 'failed'),
    );
    return null;
  }

  // A horse to pose: { root, pose(gait, t) }. gait is 'idle', 'walk' or
  // 'gallop'; t runs from 0 to 1 over one stride.
  make(name) {
    const m = this.model(name);
    if (!m) return null;
    const bones = new Map();
    const root = new THREE.Bone();
    root.name = 'root';
    bones.set('root', root);
    for (const b of m.bones) {
      const bone = new THREE.Bone();
      bone.name = b.name;
      bone.position.fromArray(b.at);
      bones.get(b.parent).add(bone);
      bones.set(b.name, bone);
    }
    const order = ['root', ...m.bones.map((b) => b.name)];
    const skeleton = new THREE.Skeleton(order.map((n) => bones.get(n)));
    const mesh = new THREE.SkinnedMesh(m.geometry, m.material);
    mesh.add(root);
    mesh.updateMatrixWorld(true);
    mesh.bind(skeleton);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const group = new THREE.Group();
    group.add(mesh);
    const H = m.H;
    const pose = (gait, t) => {
      for (const b of bones.values()) b.rotation.set(0, 0, 0);
      root.position.set(0, 0, 0);
      let bob = 0;
      if (gait === 'walk' || gait === 'gallop') {
        const gallop = gait === 'gallop';
        // When each leg starts its stride: a walk steps one foot at a time,
        // a gallop lands the hind pair, then the front pair.
        const off = gallop ? { LH: 0, RH: 0.1, LF: 0.45, RF: 0.55 } : { LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 };
        const reach = gallop ? 0.45 : 0.28;
        const fold = gallop ? 1.3 : 0.8;
        const stance = gallop ? 0.45 : 0.62;
        for (const leg of LEGS) {
          const p = (t + off[leg]) % 1;
          let a;
          let k = 0;
          if (p < stance) a = -reach + (2 * reach * p) / stance;
          else {
            const s = (p - stance) / (1 - stance);
            a = reach - 2 * reach * s;
            k = Math.sin(Math.PI * s) * fold;
          }
          bones.get(`${leg}hip`).rotation.x = a;
          // Knees and hocks both fold the hoof back and up.
          bones.get(`${leg}knee`).rotation.x = k;
        }
        bob = gallop ? Math.abs(Math.sin(Math.PI * 2 * t)) * 0.05 * H : Math.abs(Math.sin(Math.PI * 4 * t)) * 0.012 * H;
        root.rotation.x = gallop ? Math.sin(Math.PI * 2 * t) * 0.07 : 0;
        bones.get('neck').rotation.x = gallop ? Math.sin(Math.PI * 2 * t + 1) * 0.16 : Math.sin(Math.PI * 4 * t) * 0.05;
        bones.get('tail').rotation.x = gallop ? 0.15 : 0.03;
        bones.get('tail').rotation.y = Math.sin(Math.PI * 2 * t) * 0.15;
      } else {
        bones.get('tail').rotation.y = Math.sin(Math.PI * 2 * t) * 0.12;
        bones.get('neck').rotation.x = Math.sin(Math.PI * 2 * t) * 0.03;
      }
      root.position.y = bob;
      mesh.updateMatrixWorld(true);
      return bob;
    };
    pose('idle', 0);
    // The rider goes on the root bone, so he rises and falls with the horse.
    return { root: group, mesh, pose, seat: m.seat, H, saddle: root };
  }
}

// --- Rigging -----------------------------------------------------------------------------

// Puts the model in the horse's own frame (facing +Z, hooves on the ground,
// the given height in tiles), finds its legs, neck and tail, and binds every
// vertex to them.
function rig(scene, def) {
  scene.updateMatrixWorld(true);
  let src = null;
  scene.traverse((o) => o.isMesh && !src && (src = o));
  const pos = src.geometry.getAttribute('position');
  const n = pos.count;
  const P = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(src.matrixWorld);
    P[i * 3] = v.x;
    P[i * 3 + 1] = v.y;
    P[i * 3 + 2] = v.z;
  }
  const box = (lo, hi) => {
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        lo[c] = Math.min(lo[c], P[i * 3 + c]);
        hi[c] = Math.max(hi[c], P[i * 3 + c]);
      }
    }
  };
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  box(lo, hi);
  // The long side is the horse's length; the head is the end that rises highest.
  const along = hi[0] - lo[0] > hi[2] - lo[2] ? 0 : 2;
  const L0 = hi[along] - lo[along];
  const top = (from, to) => {
    let y = -Infinity;
    for (let i = 0; i < n; i++) {
      const s = (P[i * 3 + along] - lo[along]) / L0;
      if (s >= from && s <= to) y = Math.max(y, P[i * 3 + 1]);
    }
    return y;
  };
  const headHigh = top(0.75, 1) > top(0, 0.25);
  const H0 = hi[1] - lo[1];
  const k = def.height / H0;
  const cx = (lo[0] + hi[0]) / 2;
  const cz = (lo[2] + hi[2]) / 2;
  for (let i = 0; i < n; i++) {
    const x = P[i * 3] - cx;
    const y = P[i * 3 + 1] - lo[1];
    const z = P[i * 3 + 2] - cz;
    // Turn the long axis to +Z with the head forward.
    let nx;
    let nz;
    if (along === 0) {
      nz = headHigh ? x : -x;
      nx = headHigh ? -z : z;
    } else {
      nz = headHigh ? z : -z;
      nx = headHigh ? x : -x;
    }
    P[i * 3] = nx * k;
    P[i * 3 + 1] = y * k;
    P[i * 3 + 2] = nz * k;
  }
  lo = [Infinity, Infinity, Infinity];
  hi = [-Infinity, -Infinity, -Infinity];
  box(lo, hi);
  const H = hi[1];
  const L = hi[2] - lo[2];

  // The legs: the lowest vertices fall into a front pair and a hind pair,
  // split where there is the widest gap along the body, and left and right.
  const low = [];
  for (let i = 0; i < n; i++) if (P[i * 3 + 1] < 0.22 * H) low.push(i);
  const zs = low.map((i) => P[i * 3 + 2]).sort((a, b) => a - b);
  let gap = 0;
  let cut = 0;
  for (let j = 1; j < zs.length; j++) {
    if (zs[j] - zs[j - 1] > gap) {
      gap = zs[j] - zs[j - 1];
      cut = (zs[j] + zs[j - 1]) / 2;
    }
  }
  // Each leg's middle, band by band up from the hoof to just under the
  // belly: a hind leg slopes back to the hock. Thin strands near the middle
  // (the tail) are left out.
  const BANDS = 8;
  const TOP = BELLY * H;
  const bandOf = (y) => Math.max(0, Math.min(BANDS - 1, Math.floor((y / TOP) * BANDS)));
  const cols = Object.fromEntries(LEGS.map((name) => [name, Array.from({ length: BANDS }, () => ({ x: 0, z: 0, n: 0 }))]));
  const legOf = (x, z) => `${x > 0 ? 'L' : 'R'}${z > cut ? 'F' : 'H'}`;
  for (let i = 0; i < n; i++) {
    const x = P[i * 3];
    const y = P[i * 3 + 1];
    const z = P[i * 3 + 2];
    if (y >= TOP || Math.abs(x) < 0.02 * L) continue;
    const c = cols[legOf(x, z)][bandOf(y)];
    c.x += x;
    c.z += z;
    c.n++;
  }
  for (const name of LEGS) {
    let last = null;
    for (const c of cols[name]) {
      if (c.n) {
        c.x /= c.n;
        c.z /= c.n;
        last = c;
      } else if (last) {
        c.x = last.x;
        c.z = last.z;
      }
    }
  }
  const colAt = (name, y) => cols[name][bandOf(Math.min(y, TOP - 1e-6))];
  const legs = Object.fromEntries(LEGS.map((name) => [name, cols[name][0]]));
  const front = (legs.LF.z + legs.RF.z) / 2;
  const hind = (legs.LH.z + legs.RH.z) / 2;

  // Bones, in the horse's frame (each position relative to its parent).
  const neckAt = [0, NECK * H, front + 0.06 * L];
  const tailAt = [0, 0.6 * H, lo[2] + 0.08 * L];
  const bones = [];
  for (const name of LEGS) {
    const hip = colAt(name, TOP);
    const knee = colAt(name, KNEE * H);
    bones.push({ name: `${name}hip`, parent: 'root', at: [hip.x, HIP * H, hip.z] });
    bones.push({ name: `${name}knee`, parent: `${name}hip`, at: [knee.x - hip.x, (KNEE - HIP) * H, knee.z - hip.z] });
  }
  bones.push({ name: 'neck', parent: 'root', at: neckAt });
  bones.push({ name: 'tail', parent: 'root', at: tailAt });
  const index = Object.fromEntries([['root', 0], ...bones.map((b, j) => [b.name, j + 1])]);

  // Weights: a leg owns what lies under the belly in its own narrow column,
  // the knee what lies below it; the tail is the thin strand behind the hind
  // legs; the neck owns the front of the body above the shoulder. Each blends
  // into the body near its joint.
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const ramp = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
  const rx = Math.max(0.045 * L, Math.abs(legs.LF.x - legs.RF.x) * 0.5);
  const rz = 0.075 * L;
  // The tail: the rearmost slab, behind the buttocks.
  const tailFrom = Math.min(hind - 0.05 * L, lo[2] + 0.07 * L);
  for (let i = 0; i < n; i++) {
    const x = P[i * 3];
    const y = P[i * 3 + 1];
    const z = P[i * 3 + 2];
    const w = [];
    let rest = 1;
    if (Math.abs(x) < 0.05 * L && z < tailFrom && y > 0.08 * H) {
      const tailW = ramp(-z, -tailFrom, -(tailFrom - 0.03 * L));
      if (tailW > 0) w.push([index.tail, tailW]);
      rest -= tailW;
    }
    // The nearest leg column, if this is under the belly and inside it.
    let best = null;
    let bd = Infinity;
    for (const name of LEGS) {
      const c = colAt(name, y);
      const d = Math.hypot((x - c.x) / rx, (z - c.z) / rz);
      if (d < bd) {
        bd = d;
        best = name;
      }
    }
    const legW = bd < 1 ? rest * (1 - ramp(y, (BELLY - 0.04) * H, (BELLY + 0.04) * H)) : 0;
    if (legW > 0) {
      const kneeW = 1 - ramp(y, (KNEE - 0.03) * H, (KNEE + 0.03) * H);
      w.push([index[`${best}knee`], legW * kneeW], [index[`${best}hip`], legW * (1 - kneeW)]);
    }
    rest -= legW;
    const neckW = rest * ramp(z, neckAt[2] - 0.04 * L, neckAt[2] + 0.06 * L) * ramp(y, (NECK - 0.12) * H, NECK * H);
    if (neckW > 0) w.push([index.neck, neckW]);
    rest -= neckW;
    if (rest > 0) w.push([0, rest]);
    w.sort((a, b) => b[1] - a[1]);
    let sum = 0;
    for (let j = 0; j < 4 && j < w.length; j++) sum += w[j][1];
    for (let j = 0; j < 4; j++) {
      skinIndex[i * 4 + j] = w[j] ? w[j][0] : 0;
      skinWeight[i * 4 + j] = w[j] ? w[j][1] / sum : 0;
    }
  }

  const geometry = src.geometry.clone();
  geometry.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geometry.deleteAttribute('normal');
  geometry.computeVertexNormals();
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const map = src.material.map || null;
  if (map) map.colorSpace = THREE.SRGBColorSpace;
  const material = withFog(new THREE.MeshLambertMaterial({ map }));
  const seat = [0, def.seat[0] * H, def.seat[1] * L];
  return { geometry, material, bones, H, L, seat };
}

// --- The rider ---------------------------------------------------------------------------

// The riding pose for a character on the shared skeleton: thighs forward and
// apart round the horse's barrel, shins hanging down. Returns the leg bones'
// local rotations, solved once from the character's resting pose, to set
// after each animation frame (with the hips held still), and how far the
// hips sit above the soles.
export function seatRider(body) {
  body.updateMatrixWorld(true);
  const bone = (name) => {
    let b = null;
    body.traverse((o) => o.isBone && o.name === name && (b = o));
    return b;
  };
  const hips = bone('Hips');
  const out = { hips, hipsQ: hips.quaternion.clone(), hipsP: hips.position.clone(), legs: [] };
  const wp = (o) => o.getWorldPosition(new THREE.Vector3());
  const lowest = () => {
    let y = Infinity;
    for (const s of ['LeftFoot', 'RightFoot']) {
      const f = bone(s);
      if (f) y = Math.min(y, wp(f).y);
    }
    return y;
  };
  const sole = lowest();
  const hipY = wp(hips).y;
  // Directions in the rider's own frame (+Z ahead, +X to his left).
  const want = {
    LeftUpLeg: new THREE.Vector3(0.42, -0.42, 0.8),
    LeftLeg: new THREE.Vector3(0.1, -0.97, -0.18),
    RightUpLeg: new THREE.Vector3(-0.42, -0.42, 0.8),
    RightLeg: new THREE.Vector3(-0.1, -0.97, -0.18),
  };
  const rootQ = body.getWorldQuaternion(new THREE.Quaternion());
  for (const [name, childName] of [['LeftUpLeg', 'LeftLeg'], ['LeftLeg', 'LeftFoot'], ['RightUpLeg', 'RightLeg'], ['RightLeg', 'RightFoot']]) {
    const b = bone(name);
    const c = bone(childName);
    if (!b || !c) continue;
    b.updateMatrixWorld(true);
    const from = wp(c).sub(wp(b)).normalize();
    const to = want[name].clone().normalize().applyQuaternion(rootQ);
    const turn = new THREE.Quaternion().setFromUnitVectors(from, to);
    const world = turn.multiply(b.getWorldQuaternion(new THREE.Quaternion()));
    const parent = b.parent.getWorldQuaternion(new THREE.Quaternion());
    b.quaternion.copy(parent.invert().multiply(world));
    b.updateMatrixWorld(true);
    out.legs.push([b, b.quaternion.clone()]);
  }
  out.hipHeight = hipY - sole;
  out.hipY = hipY;
  return out;
}

// After an animation frame: hold the hips and legs in the saddle.
export function holdSeat(seat) {
  seat.hips.quaternion.copy(seat.hipsQ);
  seat.hips.position.copy(seat.hipsP);
  for (const [b, q] of seat.legs) b.quaternion.copy(q);
}
