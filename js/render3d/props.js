// Tools the 3D characters hold: hoes, axes, bows, spears, machetes, a chief's
// fly-whisk. Thin things like these do not survive turning a picture into a
// 3D model, so they are built here and put in the character's hand.
// Sizes are in metres (the characters are modelled about 1.75 m tall); the
// grip is at the origin and the handle runs along +Y.
//
// In the hand the handle points forward when the arm hangs; TILT turns each
// tool from there towards the fingers (down) or away from them (up), the way
// it is carried: blades hang forward and down, spears and paddles stand up.
const TILT = { whisk: 1.25, hoe: 0.85, axe: 0.85, hammer: 0.85, machete: 0.95, spear: -1.15, paddle: -1.2 };

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
