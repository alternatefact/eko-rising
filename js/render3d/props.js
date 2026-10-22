// Tools the 3D characters hold: hoes, axes, bows, spears, machetes, muskets,
// a chief's fly-whisk. Thin things like these do not survive turning a picture into a
// 3D model, so they are built here and put in the character's hand.
// Sizes are in metres (the characters are modelled about 1.75 m tall); the
// grip is at the origin and the handle runs along +Y.
//
// In the hand the handle points forward when the arm hangs; TILT turns each
// tool from there towards the fingers (down) or away from them (up), the way
// it is carried: blades hang forward and down, spears and paddles stand up.
const TILT = { whisk: 1.25, hoe: 0.85, axe: 0.85, hammer: 0.85, machete: 0.95, greatsword: 0.75, spear: -1.15, paddle: -1.2, musket: 1.25 };

import * as THREE from '../vendor/three.module.js';
import { withFog } from './materials.js';

const mats = new Map();
function mat(color) {
  if (!mats.has(color)) mats.set(color, withFog(new THREE.MeshLambertMaterial({ color })));
  return mats.get(color);
}
const WOOD = '#7a5634';
const DARK_WOOD = '#4e3522';
const IRON = '#8d8f91';
const BLADE = '#b9bcbe';

function rod(length, radius, color, from = -length / 2) {
  const g = new THREE.CylinderGeometry(radius * 0.85, radius, length, 6);
  g.translate(0, from + length / 2, 0);
  return new THREE.Mesh(g, mat(color));
}

function box(w, h, d, color, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return new THREE.Mesh(g, mat(color));
}

const BUILD = {
  // The irùkẹ̀rẹ̀ a chief carries: a short handle and a horsetail.
  whisk() {
    const g = new THREE.Group();
    g.add(rod(0.24, 0.018, DARK_WOOD, -0.08));
    const tail = new THREE.ConeGeometry(0.07, 0.42, 8);
    tail.rotateX(Math.PI);
    tail.translate(0, 0.16 + 0.21, 0);
    g.add(new THREE.Mesh(tail, mat('#ece4d2')));
    return g;
  },
  // A short-handled West African hoe with a broad iron blade.
  hoe() {
    const g = new THREE.Group();
    g.add(rod(0.72, 0.018, WOOD, -0.18));
    g.add(box(0.2, 0.025, 0.16, IRON, 0, 0.52, 0.08));
    return g;
  },
  axe() {
    const g = new THREE.Group();
    g.add(rod(0.7, 0.018, WOOD, -0.12));
    g.add(box(0.03, 0.12, 0.16, IRON, 0, 0.5, 0.06));
    g.add(box(0.012, 0.15, 0.04, BLADE, 0, 0.5, 0.15));
    return g;
  },
  hammer() {
    const g = new THREE.Group();
    g.add(rod(0.42, 0.016, WOOD, -0.1));
    g.add(box(0.07, 0.07, 0.17, IRON, 0, 0.3, 0));
    return g;
  },
  // A bow held at its middle, the string to one side.
  bow() {
    const g = new THREE.Group();
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.62, 0), new THREE.Vector3(0, 0, -0.32), new THREE.Vector3(0, 0.62, 0));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.014, 5), mat(DARK_WOOD)));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1.24, 3), mat('#d8d0bc')));
    return g;
  },
  spear() {
    const g = new THREE.Group();
    g.add(rod(1.85, 0.016, WOOD, -0.7));
    const tip = new THREE.ConeGeometry(0.035, 0.24, 4);
    tip.translate(0, 1.15 + 0.12, 0);
    g.add(new THREE.Mesh(tip, mat(BLADE)));
    return g;
  },
  // A cutlass: a short wooden grip and a long, slightly widening blade.
  machete() {
    const g = new THREE.Group();
    g.add(rod(0.13, 0.017, DARK_WOOD, -0.05));
    const blade = new THREE.BoxGeometry(0.008, 0.48, 0.05);
    blade.translate(0, 0.08 + 0.24, 0.008);
    g.add(new THREE.Mesh(blade, mat(BLADE)));
    return g;
  },
  // The Abam warrior's sword: a long grip for two hands and a heavy, broad
  // iron blade.
  greatsword() {
    const g = new THREE.Group();
    g.add(rod(0.24, 0.018, DARK_WOOD, -0.12));
    g.add(box(0.03, 0.03, 0.16, IRON, 0, 0.12, 0));
    const blade = new THREE.BoxGeometry(0.012, 0.78, 0.085);
    blade.translate(0, 0.135 + 0.39, 0);
    g.add(new THREE.Mesh(blade, mat(BLADE)));
    return g;
  },
  // A tall leather war shield, held by its grip: red with a pale rim and a
  // dark boss, the way the Oba's warriors carried them.
  shield() {
    const g = new THREE.Group();
    // Upright beside the arm: tall along the fingers (z), wide along the
    // forearm (y), its face turned out to the side (x).
    const face = new THREE.SphereGeometry(0.2, 12, 8);
    face.scale(0.18, 1, 1.55);
    face.translate(0.05, 0, 0.04);
    g.add(new THREE.Mesh(face, mat('#9e2a1c')));
    const rim = new THREE.TorusGeometry(0.2, 0.012, 4, 16);
    rim.rotateY(Math.PI / 2);
    rim.scale(1, 1, 1.55);
    rim.translate(0.06, 0, 0.04);
    g.add(new THREE.Mesh(rim, mat('#e9dcc0')));
    const boss = new THREE.SphereGeometry(0.035, 8, 6);
    boss.translate(0.095, 0, 0.04);
    g.add(new THREE.Mesh(boss, mat('#3a2414')));
    return g;
  },
  // A round shield of hide, cream and brown with a dark rim, as the
  // fighters of the savanna carried them.
  hideshield() {
    const g = new THREE.Group();
    const face = new THREE.SphereGeometry(0.21, 12, 8);
    face.scale(0.16, 1, 1);
    face.translate(0.05, 0, 0.03);
    g.add(new THREE.Mesh(face, mat('#c9ad7c')));
    const band = new THREE.TorusGeometry(0.12, 0.02, 4, 16);
    band.rotateY(Math.PI / 2);
    band.translate(0.07, 0, 0.03);
    g.add(new THREE.Mesh(band, mat('#7a5634')));
    const rim = new THREE.TorusGeometry(0.21, 0.014, 4, 18);
    rim.rotateY(Math.PI / 2);
    rim.translate(0.06, 0, 0.03);
    g.add(new THREE.Mesh(rim, mat('#3a2414')));
    return g;
  },
  // A long flintlock trade musket (a "Dane gun"), held by the forestock: the
  // iron barrel runs on past the fingers, the wooden stock back to the
  // shoulder.
  musket() {
    const g = new THREE.Group();
    g.add(rod(1.15, 0.013, '#3b3d40', -0.3));
    g.add(rod(0.85, 0.022, WOOD, -0.45));
    const butt = new THREE.BoxGeometry(0.035, 0.24, 0.1);
    butt.translate(0, -0.5, -0.03);
    g.add(new THREE.Mesh(butt, mat(DARK_WOOD)));
    g.add(box(0.03, 0.05, 0.03, IRON, 0, -0.18, 0.03));
    return g;
  },
  // A canoe paddle with a leaf-shaped blade.
  paddle() {
    const g = new THREE.Group();
    g.add(rod(1.1, 0.017, WOOD, -0.25));
    const blade = new THREE.SphereGeometry(0.1, 8, 6);
    blade.scale(1, 2.3, 0.18);
    blade.translate(0, -0.25 - 0.2, 0);
    g.add(new THREE.Mesh(blade, mat(WOOD)));
    return g;
  },
};

// What a character wears on the head or round the neck, built here for the
// same reason as the tools. Head things are built with the top of the head at
// the origin, +Y up and +Z the way the face looks, for a head about 0.2 m
// tall; neck things with the base of the neck at the origin.
const WEAR = {
  // The close brass war cap of the Edo bronze plaques, with a raised crest.
  helmet: () => {
    const g = new THREE.Group();
    const dome = new THREE.SphereGeometry(0.105, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56);
    dome.scale(1, 0.95, 1.08);
    dome.translate(0, -0.088, -0.005);
    g.add(new THREE.Mesh(dome, mat('#b58a3a')));
    g.add(box(0.024, 0.035, 0.17, '#8c6526', 0, 0.012, -0.01));
    const rim = new THREE.TorusGeometry(0.1, 0.009, 4, 20);
    rim.rotateX(Math.PI / 2);
    rim.scale(1, 1.08, 1);
    rim.translate(0, -0.07, -0.005);
    g.add(new THREE.Mesh(rim, mat('#8c6526')));
    return g;
  },
  // The high collar of coral beads Edo chiefs and warriors wore, ring on ring.
  collar: () => {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const ring = new THREE.TorusGeometry(0.068 + k * 0.002, 0.012, 5, 16);
      ring.rotateX(Math.PI / 2);
      ring.translate(0, 0.01 + k * 0.02, 0);
      g.add(new THREE.Mesh(ring, mat(k % 2 ? '#d2452c' : '#a8301f')));
    }
    return g;
  },
  // A white turban wound round a cap.
  turban: (color = '#efeadc', band = '#dcd5c2') => {
    const g = new THREE.Group();
    const cap = new THREE.SphereGeometry(0.1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
    cap.translate(0, -0.06, 0);
    g.add(new THREE.Mesh(cap, mat(color)));
    for (let k = 0; k < 2; k++) {
      const wrap = new THREE.TorusGeometry(0.097 - k * 0.008, 0.026, 6, 18);
      wrap.rotateX(Math.PI / 2 + (k ? 0.18 : -0.12));
      wrap.translate(0, -0.06 + k * 0.026, 0);
      g.add(new THREE.Mesh(wrap, mat(k ? color : band)));
    }
    return g;
  },
  darkturban: () => WEAR.turban('#2b3557', '#1d2541'),
  // A red head-tie with an eagle feather standing up at the back: the
  // feather is the honour of a warrior.
  headtie: () => {
    const g = new THREE.Group();
    const tie = new THREE.TorusGeometry(0.098, 0.022, 6, 18);
    tie.rotateX(Math.PI / 2);
    tie.translate(0, -0.06, 0);
    g.add(new THREE.Mesh(tie, mat('#b3261e')));
    const knot = new THREE.SphereGeometry(0.03, 6, 5);
    knot.translate(0, -0.055, -0.1);
    g.add(new THREE.Mesh(knot, mat('#9e1f18')));
    const quill = new THREE.ConeGeometry(0.016, 0.2, 5);
    quill.translate(0, 0.1, 0);
    const feather = new THREE.Mesh(quill, mat('#efe7d8'));
    feather.position.set(0, -0.04, -0.09);
    feather.rotation.x = -0.4;
    g.add(feather);
    const tip = new THREE.ConeGeometry(0.012, 0.06, 5);
    tip.translate(0, 0.2, 0);
    const dark = new THREE.Mesh(tip, mat('#2a2018'));
    dark.position.copy(feather.position);
    dark.rotation.copy(feather.rotation);
    g.add(dark);
    return g;
  },
  // A white cloth wound low round the head.
  wrap: () => {
    const g = new THREE.Group();
    const wrap = new THREE.TorusGeometry(0.1, 0.028, 6, 18);
    wrap.rotateX(Math.PI / 2);
    wrap.translate(0, -0.065, 0);
    g.add(new THREE.Mesh(wrap, mat('#efeadc')));
    const tail = new THREE.BoxGeometry(0.05, 0.12, 0.012);
    tail.translate(0.06, -0.13, -0.08);
    g.add(new THREE.Mesh(tail, mat('#e4dccb')));
    return g;
  },
  // A small red cap.
  redcap: () => {
    const g = new THREE.Group();
    const cap = new THREE.SphereGeometry(0.1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.42);
    cap.translate(0, -0.075, 0);
    g.add(new THREE.Mesh(cap, mat('#8e1b16')));
    const band = new THREE.TorusGeometry(0.095, 0.012, 4, 18);
    band.rotateX(Math.PI / 2);
    band.translate(0, -0.075, 0);
    g.add(new THREE.Mesh(band, mat('#2a1a12')));
    return g;
  },
};
// Where each is worn.
export const WEAR_AT = { collar: 'neck' };

// A fresh copy of something worn.
export function makeWear(kind) {
  if (!WEAR[kind]) return null;
  const g = WEAR[kind]();
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

const made = new Map();

// A fresh copy of a prop (geometry and materials are shared).
export function makeProp(kind) {
  if (!BUILD[kind]) return null;
  if (!made.has(kind)) {
    const tool = BUILD[kind]();
    tool.rotation.x = TILT[kind] || 0;
    tool.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    const g = new THREE.Group();
    g.add(tool);
    made.set(kind, g);
  }
  return made.get(kind).clone();
}
