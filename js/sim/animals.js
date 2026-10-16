// Antelope and bush pig roam the forest and savanna. Hunters thin them out;
// they drift back in from the wild over time.

import { T } from '../world/terrain.js';
import { createAnimal } from './entities.js';
import { stepMove, wander } from './move.js';

const HABITAT = new Set([T.FOREST, T.SAVANNA, T.GRASS]);

export function updateAnimal(st, a, dt) {
  a.px = a.x;
  a.py = a.y;
  if (a.carcass) {
    a.rotT += dt;
    if (a.rotT > 90 && !a.reserved) a.dead = true;
    return;
  }
  if (a.path) {
    stepMove(st, a, dt, a.type === 'pig' ? 1.1 : 1.4);
    return;
  }
  a.wanderT -= dt;
  if (a.wanderT <= 0) {
    a.wanderT = st.rng.range(3, 9);
    wander(st, a, a.x, a.y, 4);
  }
}

export function spawnAnimals(st, count, minDistFromHome) {
  let made = 0;
  for (let k = 0; k < count * 30 && made < count; k++) {
    const x = st.rng.int(1, st.W - 2);
    const y = st.rng.int(1, st.H - 2);
    const i = y * st.W + x;
    if (!st.reach[i] || !HABITAT.has(st.terrain[i]) || st.occ[i]) continue;
    if (Math.hypot(x - st.start.x, y - st.start.y) < minDistFromHome) continue;
    if (st.terrain[i] === T.GRASS && !st.rng.chance(0.3)) continue;
    const herd = st.rng.int(1, 3);
    const type = st.terrain[i] === T.SAVANNA || st.rng.chance(0.6) ? 'antelope' : 'pig';
    for (let h = 0; h < herd && made < count; h++) {
      createAnimal(st, x, y, type);
      made++;
    }
  }
}

export function replenishAnimals(st) {
  const alive = st.animals.filter((a) => !a.dead && !a.carcass).length;
  if (alive < st.animalTarget) spawnAnimals(st, 2, 14);
}
