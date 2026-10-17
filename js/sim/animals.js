// Antelope and bush pig roam the forest and savanna. Hunters thin them out;
// they drift back in from the wild over time.
//
// The first danger the household meets is not raiders but a beast: an
// African wolf (the golden wolf of the Nigerian savanna) comes out of the
// bush, kills whoever is working the red-mud pit, and turns on the next
// person it finds, who fights back and kills it.

import { T, WALK } from '../world/terrain.js';
import { createAnimal, notify, removeCitizen } from './entities.js';
import { goTo, stepMove, wander } from './move.js';
import { addMood } from './economy.js';
import { resume } from './citizens.js';
import { BUILDINGS } from '../data/buildings.js';

const HABITAT = new Set([T.FOREST, T.SAVANNA, T.GRASS]);

const WOLF = { hp: 30, speed: 2.9, bite: 12, biteEvery: 0.6, axe: 11, bare: 8, swingEvery: 0.9 };
// What a worker has in hand to fight with.
const TOOL = { woodcutter: 'axe', farm: 'hoe', cassava: 'hoe', brickyard: 'digging stick', hunter: 'spear', fisher: 'paddle', quarry: 'pick' };

export function updateAnimal(st, a, dt) {
  a.px = a.x;
  a.py = a.y;
  if (a.carcass) {
    a.rotT += dt;
    if (a.rotT > 90 && !a.reserved) a.dead = true;
    return;
  }
  if (a.type === 'wolf') {
    updateWolf(st, a, dt);
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
  const alive = st.animals.filter((a) => !a.dead && !a.carcass && a.type !== 'wolf').length;
  if (alive < st.animalTarget) spawnAnimals(st, 2, 14);
}

// --- The wolf --------------------------------------------------------------------

const out = (c) => c && !c.dead && !c.stranger && !c.hidden;
const he = (c) => (c.female ? 'she' : 'he');
const his = (c) => (c.female ? 'her' : 'his');

// The mud maker: whoever works the brickmaker's yard, or the brickmaker by
// trade wherever she works now; failing that, any worker out in the open.
function pickVictim(st) {
  for (const b of st.buildings) {
    if (b.type !== 'brickyard' || b.dead) continue;
    const c = st.byId.get(b.workers[0]);
    if (out(c)) return c;
  }
  const byTrade = st.citizens.find((c) => out(c) && !c.special && c.calling === 'brickyard');
  if (byTrade) return byTrade;
  const workers = st.citizens.filter((c) => out(c) && !c.special && c.job);
  return workers.length ? st.rng.pick(workers) : null;
}

// A woodcutter, axe in hand, if there is one (at work or by trade);
// otherwise the nearest grown-up.
function pickDefender(st, w) {
  const alive = st.citizens.filter((c) => out(c) && c.id !== st.story?.victim);
  const workers = alive.filter((c) => !c.special);
  let cutters = workers.filter((c) => st.byId.get(c.job)?.type === 'woodcutter');
  if (!cutters.length) cutters = workers.filter((c) => c.calling === 'woodcutter');
  const pool = cutters.length ? cutters : workers.length ? workers : alive;
  let best = null;
  let bestD = Infinity;
  for (const c of pool) {
    const d = Math.hypot(c.x - w.x, c.y - w.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function spawnWolf(st) {
  const victim = pickVictim(st);
  if (!victim) return null;
  let spot = -1;
  for (let k = 0; k < 80 && spot < 0; k++) {
    const a = st.rng.range(0, Math.PI * 2);
    const r = st.rng.range(12, 18);
    const x = Math.floor(victim.x + Math.cos(a) * r);
    const y = Math.floor(victim.y + Math.sin(a) * r);
    if (x < 1 || y < 1 || x >= st.W - 1 || y >= st.H - 1) continue;
    const i = y * st.W + x;
    if (!st.reach[i] || WALK[st.terrain[i]] === 0 || st.occ[i]) continue;
    // Out of the bush if possible.
    if (k < 50 && st.terrain[i] !== T.FOREST && st.terrain[i] !== T.SAVANNA) continue;
    spot = i;
  }
  if (spot < 0) return null;
  const w = createAnimal(st, spot % st.W, Math.floor(spot / st.W), 'wolf');
  Object.assign(w, { hp: WOLF.hp, maxHp: WOLF.hp, target: victim.id, phase: 'hunt', repathT: 0, biteT: 0, swingT: 0 });
  st.story = { ...(st.story || {}), wolf: w.id, victim: victim.id, victimName: victim.name, victimFemale: victim.female };
  const job = st.byId.get(victim.job);
  const where = job?.type === 'brickyard' ? 'the red-mud pit' : job ? `the ${BUILDINGS[job.type].name.toLowerCase()}` : victim.name;
  notify(st, `🐺 An African wolf has come out of the bush! It is heading for ${where}.`, 'war', w);
  return w;
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

function updateWolf(st, w, dt) {
  const target = st.byId.get(w.target);
  if (!target || target.dead || target.hidden || target.stranger) {
    // The prey got away or is gone: go after someone else.
    const next = w.phase === 'hunt' || w.phase === 'maul' ? pickVictim(st) : pickDefender(st, w);
    if (!next) {
      w.path = null;
      return;
    }
    if (w.phase === 'maul') w.phase = 'hunt';
    if (w.phase === 'fight') w.phase = 'hunt2';
    w.target = next.id;
    if (w.phase === 'hunt') st.story.victim = next.id;
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
      w.x += (target.x - w.x) * Math.min(1, dt * 4) * 0.5;
      w.y += (target.y - w.y) * Math.min(1, dt * 4) * 0.5;
      w.biteT -= dt;
      if (w.biteT > 0) return;
      w.biteT = WOLF.biteEvery;
      target.hp -= WOLF.bite;
      if (target.hp > 0) return;
      const job = st.byId.get(target.job);
      const trade = job && BUILDINGS[job.type] ? ` at the ${BUILDINGS[job.type].name.toLowerCase()}` : '';
      Object.assign(st.story, { victim: target.id, victimName: target.name, victimFemale: target.female, victimJob: job?.type || null });
      removeCitizen(st, target);
      notify(st, `⚰️ ${target.name} was killed by the wolf${trade}.`, 'war', target);
      addMood(st, `Mourning ${target.name}`, -6, 3);
      const d = pickDefender(st, w);
      w.phase = 'hunt2';
      w.target = d ? d.id : 0;
      // What they have in hand when the wolf turns on them.
      w.tool = d ? TOOL[st.byId.get(d.job)?.type] || (d.calling === 'woodcutter' ? 'axe' : null) : null;
      return;
    }
    case 'hunt2': {
      if (chase(st, w, target, dt) < 0.8) {
        w.phase = 'fight';
        w.path = null;
        w.biteT = 0.3;
        w.swingT = 0.5;
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
      w.swingT -= dt;
      if (w.swingT > 0) return;
      w.swingT = WOLF.swingEvery;
      const tool = w.tool !== undefined ? w.tool : TOOL[st.byId.get(target.job)?.type] || null;
      const axe = tool === 'axe';
      w.hp -= axe ? WOLF.axe : WOLF.bare;
      w.hitT = st.time.t;
      if (w.hp > 0) return;
      w.carcass = true;
      w.rotT = 0;
      w.path = null;
      resume(st, target);
      Object.assign(st.story, { hero: target.id, heroName: target.name, heroFemale: target.female, heroTool: tool });
      st.flags.wolfSlain = true;
      notify(st, `🪓 ${target.name} killed the wolf${tool ? ` with ${his(target)} ${tool}` : ''}! ${he(target)[0].toUpperCase()}${he(target).slice(1)} is hurt but alive.`, 'good', target);
      st.eventQueue.push({ id: 'wolf_slain' });
      return;
    }
    default:
      w.phase = 'hunt';
  }
}
