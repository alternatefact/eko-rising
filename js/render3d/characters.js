// Life-like 3D people made with Higgsfield: textured, rigged models
// (art/people/characters) animated with shared clips (art/people/clips).
// Every rig uses the same bone names, so one walk or tool swing drives
// everyone. Models and clips load on first use; until a model is ready the
// renderer keeps drawing the simple figures for that person.

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader, cloneSkinned } from '../vendor/three.module.js';
import { withFog, REAL } from './materials.js';
import { CHARACTERS, CLIPS } from '../data/people.js';
import { makeProp } from './props.js';

const BASE = 'art/people';
const HEIGHT = 0.82; // a grown man, in tiles: about as tall as a hut wall
const FADE = 0.22;
const FIST = 0.075; // from the wrist bone to the middle of a closed hand, in metres

// Where a held tool sits in a hand, in the hand bone's own space. Worked out
// from the model's resting pose: the handle runs through the fist along the
// line of the knuckles (pointing forward when the arms hang), and the tool's
// +Z side faces down the fingers.
function gripFor(template, side) {
  let hand = null;
  let fore = null;
  template.traverse((o) => {
    if (!o.isBone) return;
    if (o.name === `${side}Hand`) hand = o;
    if (o.name === `${side}ForeArm`) fore = o;
  });
  if (!hand || !fore) return null;
  const wrist = hand.getWorldPosition(new THREE.Vector3());
  const finger = wrist.clone().sub(fore.getWorldPosition(new THREE.Vector3())).normalize();
  const along = new THREE.Vector3(0, 0, 1).addScaledVector(finger, -finger.z).normalize();
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(along, finger), along, finger);
  const inv = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
  const scale = hand.getWorldScale(new THREE.Vector3()).x || 1;
  return {
    bone: hand.name,
    quaternion: inv.clone().multiply(new THREE.Quaternion().setFromRotationMatrix(basis)),
    position: finger.clone().multiplyScalar(FIST / scale).applyQuaternion(inv),
    scale: 1 / scale,
  };
}

export class Characters {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.scene = scene;
    this.loader = new GLTFLoader();
    this.models = new Map(); // type -> { status, template, scale, headName }
    this.clips = new Map(); // clip -> { status, clip }
    this.live = new Map(); // entity id -> instance
    this.spare = new Map(); // type -> [instance]
    this.seen = new Set();
    this.tmp = new THREE.Vector3();
  }

  dispose() {
    this.scene.remove(this.root);
  }

  // --- Loading ------------------------------------------------------------------------

  model(type) {
    let m = this.models.get(type);
    if (m) return m.status === 'ready' ? m : null;
    m = { status: 'loading' };
    this.models.set(type, m);
    this.loader.load(
      `${BASE}/characters/${type}.glb`,
      (gltf) => {
        const template = gltf.scene;
        let mesh = null;
        template.traverse((o) => {
          if (o.isSkinnedMesh || o.isMesh) {
            mesh = mesh || o;
            o.castShadow = true;
            o.receiveShadow = false;
            o.frustumCulled = false;
            const map = o.material.map || null;
            if (map) map.colorSpace = THREE.SRGBColorSpace;
            o.material = withFog(new THREE.MeshLambertMaterial({ map, color: REAL ? 0xffffff : 0xf2f2f2 }));
          }
        });
        // Measure standing height to scale every model to the same size.
        template.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(template);
        const h = Math.max(0.01, box.max.y - box.min.y);
        let headName = null;
        template.traverse((o) => {
          if (o.isBone && !headName && /^head$/i.test(o.name)) headName = o.name;
        });
        template.traverse((o) => {
          if (o.isBone && !headName && /head/i.test(o.name) && !/end|top/i.test(o.name)) headName = o.name;
        });
        const def = CHARACTERS[type] || {};
        const grip = def.prop ? gripFor(template, def.hand || 'Right') : null;
        Object.assign(m, { status: 'ready', template, scale: (HEIGHT * (def.height || 1)) / h, foot: box.min.y, headName, grip });
      },
      undefined,
      () => {
        m.status = 'failed';
      },
    );
    return null;
  }

  clip(name) {
    let c = this.clips.get(name);
    if (c) return c.status === 'ready' ? c.clip : null;
    c = { status: 'loading' };
    this.clips.set(name, c);
    const def = CLIPS[name];
    const src = def.from || name;
    const ready = (clip) => {
      c.clip = def.derive ? def.derive(clip) : clip;
      c.clip.name = name;
      c.status = 'ready';
    };
    if (def.from) {
      // Built from another clip once that one has loaded.
      const wait = () => {
        const base = this.clip(src);
        if (base) ready(base.clone());
        else if (this.clips.get(src)?.status !== 'failed') setTimeout(wait, 200);
        else c.status = 'failed';
      };
      wait();
      return null;
    }
    this.loader.load(
      `${BASE}/clips/${def.file}.glb`,
      (gltf) => {
        const clip = gltf.animations[0];
        if (!clip) {
          c.status = 'failed';
          return;
        }
        // Keep the character on the spot: the game moves people itself.
        for (const t of clip.tracks) {
          if (/\.position$/.test(t.name) && /hips/i.test(t.name)) {
            const v = t.values;
            for (let i = 0; i < v.length; i += 3) {
              v[i] = v[0];
              v[i + 2] = v[2];
            }
          }
        }
        ready(clip);
      },
      undefined,
      () => {
        c.status = 'failed';
      },
    );
    return null;
  }

  // --- Instances ----------------------------------------------------------------------

  instance(id, type) {
    let inst = this.live.get(id);
    if (inst && inst.type === type) return inst;
    if (inst) this.release(id, inst);
    const m = this.model(type);
    if (!m) return null;
    const pool = this.spare.get(type);
    inst = pool && pool.length ? pool.pop() : this.make(type, m);
    inst.root.visible = true;
    inst.current = null;
    this.live.set(id, inst);
    return inst;
  }

  make(type, m) {
    const root = new THREE.Group();
    const body = cloneSkinned(m.template);
    body.scale.setScalar(m.scale);
    body.position.y = -m.foot * m.scale;
    root.add(body);
    this.root.add(root);
    const mixer = new THREE.AnimationMixer(body);
    let head = null;
    if (m.headName) body.traverse((o) => o.name === m.headName && (head = o));
    const prop = m.grip && makeProp(CHARACTERS[type].prop);
    if (prop) {
      let hand = null;
      body.traverse((o) => o.name === m.grip.bone && (hand = o));
      if (hand) {
        prop.position.copy(m.grip.position);
        prop.quaternion.copy(m.grip.quaternion);
        prop.scale.setScalar(m.grip.scale);
        hand.add(prop);
      }
    }
    return { type, root, body, mixer, actions: new Map(), current: null, head };
  }

  release(id, inst) {
    inst.root.visible = false;
    this.live.delete(id);
    const pool = this.spare.get(inst.type) || [];
    if (pool.length < 40) pool.push(inst);
    else {
      this.root.remove(inst.root);
      inst.mixer.stopAllAction();
    }
    this.spare.set(inst.type, pool);
  }

  begin() {
    this.seen.clear();
  }

  // Draw one person. Returns the instance, or null if their model is not ready
  // (the caller then draws the simple figure instead).
  draw(id, type, anim, x, ground, y, heading, dt, rate = 1) {
    const inst = this.instance(id, type);
    if (!inst) return null;
    this.seen.add(id);
    inst.root.position.set(x, ground, y);
    inst.root.rotation.y = heading;
    const want = this.clip(anim) ? anim : this.clip('idle') ? 'idle' : null;
    if (want && want !== inst.current) {
      let action = inst.actions.get(want);
      if (!action) {
        action = inst.mixer.clipAction(this.clip(want));
        const def = CLIPS[want];
        if (def.once) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        inst.actions.set(want, action);
      }
      const prev = inst.current ? inst.actions.get(inst.current) : null;
      action.reset();
      action.play();
      // Start each person at a different point of the loop, so a crowd does not march in step.
      if (!CLIPS[want].once) action.time = ((id * 0.37) % 1) * action.getClip().duration;
      if (prev) prev.crossFadeTo(action, FADE, false);
      inst.current = want;
    }
    inst.mixer.update(dt * rate);
    return inst;
  }

  // Where the top of someone's head is, for loads carried on it.
  headTop(inst, out) {
    if (!inst.head) return null;
    inst.head.getWorldPosition(out);
    out.y += 0.06;
    return out;
  }

  end() {
    for (const [id, inst] of this.live) {
      if (!this.seen.has(id)) this.release(id, inst);
    }
  }
}
