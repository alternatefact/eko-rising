// Antelope and bush pig roam the forest and savanna. Hunters thin them out;
// they drift back in from the wild over time.
//
// The first danger the household meets is not raiders but beasts: a pack of
// the land's predators comes out of the bush (in Lagos, African wolves, the
// golden wolf of the Nigerian savanna; in Kano, spotted hyenas), kills the
// farmers in the field and turns on the woodcutter and the hunter, who fight
// back and kill them.

import { T, WALK, treeBlocks } from '../world/terrain.js';
import { createAnimal, notify, removeCitizen } from './entities.js';
import { goTo, stepMove, wander } from './move.js';
import { addMood } from './economy.js';
import { resume, hideIndoors } from './citizens.js';
import { BUILDINGS } from '../data/buildings.js';
import { PREDATORS } from '../cultures/index.js';

const HABITAT = new Set([T.FOREST, T.SAVANNA, T.GRASS]);

// A beast of the pack, whichever kind it is: they all hunt the same way.
export const isBeast = (a) => !!PREDATORS[a.type];

const WOLF = { hp: 30, speed: 2.9, bite: 12, biteEvery: 0.6, axe: 11, bare: 8, swingEvery: 0.9 };
// What a worker has in hand to fight with.
const TOOL = { woodcutter: 'axe', farm: 'hoe', cassava: 'hoe', brickyard: 'digging stick', hunter: 'bow', fisher: 'paddle', quarry: 'pick' };

export function updateAnimal(st, a, dt) {
  a.px = a.x;
  a.py = a.y;
  if (a.carcass) {
    a.rotT += dt;
    if (a.rotT > 90 && !a.reserved) a.dead = true;
    return;
  }
  if (isBeast(a)) {
    updateWolf(st, a, dt);
    return;
  }
  if (a.path) {
    // A wounded animal bolts.
    stepMove(st, a, dt, (a.type === 'pig' ? 1.1 : 1.4) * (a.fleeT > 0 ? 2.2 : 1));
    if (a.fleeT > 0) a.fleeT -= dt;
    return;
  }
  a.wanderT -= dt;
  if (a.wanderT <= 0) {
    a.wanderT = st.rng.range(3, 9);
    if (a.graze) wander(st, a, a.graze.x, a.graze.y, 2.5);
    else wander(st, a, a.x, a.y, 4);
  }
}

export function spawnAnimals(st, count, minDistFromHome) {
  let made = 0;
  for (let k = 0; k < count * 30 && made < count; k++) {
    const x = st.rng.int(1, st.W - 2);
    const y = st.rng.int(1, st.H - 2);
    const i = y * st.W + x;
    if (!st.reach[i] || !HABITAT.has(st.terrain[i]) || st.occ[i] || treeBlocks(st.trees, st.felled, st.terrain, i)) continue;
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

// A few antelope grazing within sight of the house, on open ground.
export function herdNear(st, n, rMin = 6, rMax = 11) {
  const home = st.buildings.find((b) => b.type === 'compound' && !b.dead);
  const cx = home ? home.x + 1.5 : st.start.x;
  const cy = home ? home.y + 1.5 : st.start.y;
  for (let k = 0; k < 300; k++) {
    const a = st.rng.range(0, Math.PI * 2);
    const r = st.rng.range(rMin, rMax);
    const x = Math.floor(cx + Math.cos(a) * r);
    const y = Math.floor(cy + Math.sin(a) * r);
    if (x < 2 || y < 2 || x >= st.W - 2 || y >= st.H - 2) continue;
    const i = y * st.W + x;
    if (!st.reach[i] || WALK[st.terrain[i]] < 0.8 || st.occ[i] || treeBlocks(st.trees, st.felled, st.terrain, i)) continue;
    const out = [];
    for (let h = 0; h < n; h++) out.push(createAnimal(st, x, y, 'antelope'));
    for (const a2 of out) {
      a2.x += st.rng.range(-0.8, 0.8);
      a2.y += st.rng.range(-0.8, 0.8);
      a2.graze = { x: x + 0.5, y: y + 0.5 };
    }
    return out;
  }
  return [];
}

export function replenishAnimals(st) {
  const game = st.animals.filter((a) => !a.dead && !a.carcass && !isBeast(a));
  if (game.length < st.animalTarget) spawnAnimals(st, 2, 14);
  // Herds drift back to the grassland around the settlement, too.
  const home = st.buildings.find((b) => b.type === 'compound' && !b.dead);
  if (!home) return;
  const near = game.filter((a) => Math.hypot(a.x - home.x, a.y - home.y) < 26).length;
  if (near < 4 && st.rng.chance(0.5)) herdNear(st, st.rng.int(2, 3), 13, 24);
}

// --- Wolves ---------------------------------------------------------------------

const out = (c) => c && !c.dead && !c.stranger && !c.hidden;
const he = (c) => (c.female ? 'she' : 'he');
const his = (c) => (c.female ? 'her' : 'his');
const jobType = (st, c) => st.byId.get(c?.job)?.type;
const workersAt = (st, type) => st.citizens.filter((c) => out(c) && !c.special && jobType(st, c) === type);

// Who stands their ground with what: an axe, a bow, a hoe...
function toolOf(st, c) {
  return TOOL[jobType(st, c)] || (c.calling === 'woodcutter' ? 'axe' : null);
}

// Anyone out in the open the pack could fall on instead.
function anyWorker(st, not = []) {
  const pool = st.citizens.filter((c) => out(c) && !c.special && !not.includes(c.id));
  const workers = pool.filter((c) => c.job);
  const list = workers.length ? workers : pool;
  return list.length ? st.rng.pick(list) : null;
}

function wolfSpot(st, near) {
  for (let k = 0; k < 120; k++) {
    const a = st.rng.range(0, Math.PI * 2);
    const r = st.rng.range(9, 15);
    const x = Math.floor(near.x + Math.cos(a) * r);
    const y = Math.floor(near.y + Math.sin(a) * r);
    if (x < 1 || y < 1 || x >= st.W - 1 || y >= st.H - 1) continue;
    const i = y * st.W + x;
    if (!st.reach[i] || WALK[st.terrain[i]] === 0 || st.occ[i] || treeBlocks(st.trees, st.felled, st.terrain, i)) continue;
    return i;
  }
  return -1;
}

// A pack of wolves (or hyenas: `type`) out of the bush. They fall on the
// farmers in the field; then two turn on the woodcutter and two on the
// hunter, who fight back and kill them. The founder and his wife shut
// themselves in the house.
export function spawnPack(st, n = 4, type = 'wolf') {
  const farmers = workersAt(st, 'farm');
  const victims = farmers.slice(0, 2);
  while (victims.length < 2) {
    const c = anyWorker(st, victims.map((v) => v.id));
    if (!c || victims.includes(c)) break;
    victims.push(c);
  }
  if (!victims.length) return null;
  const taken = victims.map((v) => v.id);
  const cutter = workersAt(st, 'woodcutter').find((c) => !taken.includes(c.id)) || anyWorker(st, taken);
  const hunter = workersAt(st, 'hunter').find((c) => !taken.includes(c.id) && c !== cutter) || cutter;
  const defenders = [cutter, hunter];
  const spot = wolfSpot(st, victims[0]);
  if (spot < 0) return null;
  const ids = [];
  for (let k = 0; k < n; k++) {
    const pair = Math.floor(k / 2) % 2;
    const ox = (spot % st.W) + (k % 2);
    const oy = Math.floor(spot / st.W) + pair;
    const w = createAnimal(st, ox, oy, type);
    Object.assign(w, {
      hp: WOLF.hp, maxHp: WOLF.hp, phase: 'hunt', repathT: 0, biteT: 0,
      target: (victims[pair] || victims[0]).id, next: defenders[pair]?.id || 0,
    });
    ids.push(w.id);
  }
  st.story = { ...(st.story || {}), pack: ids, victims: [], heroes: [] };
  for (const c of st.citizens) if (c.special && !c.dead) hideIndoors(st, c, 'wolves');
  const job = st.byId.get(victims[0].job);
  const where = job ? `the ${BUILDINGS[job.type].name.toLowerCase()}` : victims[0].name;
  const P = PREDATORS[type];
  notify(st, `${P.icon} A pack of ${n} ${P.plural} has come out of the bush! They are running at ${where}.`, 'war', st.byId.get(ids[0]));
  return ids;
}

function chase(st, w, c, dt) {
  w.repathT -= dt;
  if (!w.path || w.repathT <= 0) {
    w.repathT = 0.5;
    if (!goTo(st, w, c.x, c.y, { within: 0.4, max: 4000 })) goTo(st, w, c.x, c.y, { within: 0.4, max: 4000, partial: true });
  }
  stepMove(st, w, dt, WOLF.speed);
  return Math.hypot(c.x - w.x, c.y - w.y);
}

const alive = (a) => a && !a.dead && !a.carcass;

// The wolves after one person, nearest first: the defender deals with the
// front one.
function wolvesOn(st, c) {
  return st.animals.filter((a) => isBeast(a) && alive(a) && a.target === c.id && (a.phase === 'hunt2' || a.phase === 'fight'));
}

function isFront(st, w, c) {
  let best = null;
  let bestD = Infinity;
  for (const a of wolvesOn(st, c)) {
    const d = Math.hypot(a.x - c.x, a.y - c.y);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best === w;
}

function turnOn(st, w, next) {
  w.phase = 'hunt2';
  w.target = next ? next.id : 0;
  w.path = null;
  w.repathT = 0;
}

function updateWolf(st, w, dt) {
  const target = st.byId.get(w.target);
  if (!target || target.dead || target.hidden || target.stranger) {
    // The prey is dead or got away: on to whoever is next.
    const next = st.byId.get(w.next);
    if (next && out(next)) {
      w.next = 0;
      turnOn(st, w, next);
    } else {
      const c = anyWorker(st);
      if (!c) {
        w.path = null;
        return;
      }
      w.target = c.id;
      if (w.phase === 'maul') w.phase = 'hunt';
      if (w.phase === 'fight') w.phase = 'hunt2';
    }
    return;
  }

  switch (w.phase) {
    case 'hunt': {
      if (chase(st, w, target, dt) < 0.8) {
        w.phase = 'maul';
        w.path = null;
        w.biteT = 0;
        target.state = 'attacked';
        target.path = null;
        target.carry = null;
      }
      return;
    }
    case 'maul': {
      target.state = 'attacked';
      w.x += (target.x - w.x) * Math.min(1, dt * 4) * 0.5;
      w.y += (target.y - w.y) * Math.min(1, dt * 4) * 0.5;
      w.biteT -= dt;
      if (w.biteT > 0) return;
      w.biteT = WOLF.biteEvery;
      target.hp -= WOLF.bite;
      target.hitT = st.time.t;
      if (target.hp > 0) return;
      const job = st.byId.get(target.job);
      const trade = job && BUILDINGS[job.type] ? ` at the ${BUILDINGS[job.type].name.toLowerCase()}` : '';
      st.story = st.story || {};
      (st.story.victims = st.story.victims || []).push({ name: target.name, female: target.female, job: job?.type || null });
      removeCitizen(st, target);
      notify(st, `⚰️ ${target.name} was killed by the ${PREDATORS[w.type].plural}${trade}.`, 'war', target);
      addMood(st, `Mourning ${target.name}`, -6, 3);
      const next = st.byId.get(w.next);
      w.next = 0;
      turnOn(st, w, next && out(next) ? next : anyWorker(st));
      return;
    }
    case 'hunt2': {
      const d = chase(st, w, target, dt);
      // A bowman shoots before they close.
      if (toolOf(st, target) === 'bow' && d < 5.5) defend(st, target, w, dt, d);
      if (w.dead || w.carcass) return;
      if (d < 0.8) {
        w.phase = 'fight';
        w.path = null;
        w.biteT = 0.3;
        target.state = 'fight';
        target.path = null;
        target.facing = w.x > target.x ? 1 : -1;
      }
      return;
    }
    case 'fight': {
      target.state = 'fight';
      w.biteT -= dt;
      if (w.biteT <= 0) {
        w.biteT = WOLF.biteEvery * 1.4;
        // Bitten and torn, but standing.
        target.hp = Math.max(8, target.hp - 5);
        target.hitT = st.time.t;
      }
      defend(st, target, w, dt, Math.hypot(w.x - target.x, w.y - target.y));
      return;
    }
    default:
      w.phase = 'hunt';
  }
}

// The defender strikes at the wolf in front: arrows from a bow, blows from
// an axe or whatever is in hand.
function defend(st, c, w, dt, d) {
  if (!isFront(st, w, c)) return;
  const tool = toolOf(st, c);
  const bow = tool === 'bow';
  if (!bow && d > 1) return;
  c.state = 'fight';
  c.path = null;
  c.facing = w.x > c.x ? 1 : -1;
  c.strikeT = (c.strikeT ?? 0.4) - dt;
  if (c.strikeT > 0) return;
  c.strikeT = bow ? 1 : WOLF.swingEvery;
  c.swingT = st.time.t;
  if (bow) st.fx.push({ kind: 'arrow', x0: c.x, y0: c.y, x1: w.x, y1: w.y, t: 0, dur: 0.3 });
  w.hp -= bow ? 12 : tool === 'axe' ? WOLF.axe : WOLF.bare;
  w.hitT = st.time.t;
  if (w.hp > 0) return;
  w.carcass = true;
  w.rotT = 0;
  w.path = null;
  st.story = st.story || {};
  const heroes = (st.story.heroes = st.story.heroes || []);
  const h = heroes.find((x) => x.id === c.id);
  if (h) h.kills++;
  else heroes.push({ id: c.id, name: c.name, female: c.female, tool, kills: 1 });
  notify(st, `${bow ? '🏹' : '🪓'} ${c.name} killed a ${PREDATORS[w.type].name}${tool ? ` with ${his(c)} ${tool}` : ''}!`, 'good', c);
  if (!wolvesOn(st, c).length && !st.animals.some((a) => isBeast(a) && alive(a) && a.target === c.id)) {
    c.strikeT = 0.4;
    resume(st, c);
  }
  // The last of the pack.
  if (!st.animals.some((a) => isBeast(a) && alive(a))) {
    st.flags.wolvesSlain = true;
    for (const p of st.citizens) if (p.special && !p.dead && p.hideFor === 'wolves') resume(st, p);
    st.eventQueue.push({ id: 'wolves_slain' });
  }
}
