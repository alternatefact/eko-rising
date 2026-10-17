// What your people do all day. Newcomers walk in to the fire (or the town
// square) and join you. Free beds take in anyone sleeping out; free places
// at work take anyone sitting by the fire. Each job is a little loop: walk
// out, gather, bring it back, carry it to the nearest store. Woodcutters
// fell a tree, cut it into planks where it lies and carry them home four at
// a time; hunters carry the kill home, butcher it and carry the meat.

import { BUILDINGS, STORAGE_FOR, stat, levelName, buildCrew } from '../data/buildings.js';
import { RESOURCES, FOOD } from '../data/resources.js';
import { F, T, WALK, TREE, isWater, treeBlocks } from '../world/terrain.js';
import { findPath } from '../world/path.js';
import { findNear, adjacentToWater } from './world.js';
import { goTo, stepMove, wander } from './move.js';
import { notify, notifyOnce, releaseFromJob, removeCitizen, markTile, leaveSite } from './entities.js';
import { addRes, roomFor, gatheringPoint, season, totalFood, population, sendAway } from './economy.js';

const WALK_SPEED = 2.1;
const CARRY_SPEED = 1.7;

const at = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

// --- The founder supervises -------------------------------------------------------

// The founder takes no job: he walks from workplace to workplace, and people
// working within a few tiles of him work faster.
const SUPERVISE_RANGE = 4;
export const SUPERVISE_BONUS = 1.15;
const founderCache = new WeakMap();

function founderOf(st) {
  let f = founderCache.get(st);
  if (!f || f.t !== Math.floor(st.time.t)) {
    const c = st.citizens.find((x) => x.special === 'founder' && !x.dead && !x.hidden);
    f = { t: Math.floor(st.time.t), c };
    founderCache.set(st, f);
  }
  return f.c;
}

export function supervised(st, c) {
  const f = founderOf(st);
  return !!f && f !== c && f.state === 'supervise' && Math.abs(f.x - c.x) + Math.abs(f.y - c.y) <= SUPERVISE_RANGE;
}

function supervise(st, c, dt) {
  if (c.path) {
    stepMove(st, c, dt, WALK_SPEED * 0.8);
    return;
  }
  c.timer -= dt;
  if (c.timer > 0) return;
  c.timer = st.rng.range(7, 13);
  // Visit a workplace with people at it; otherwise stroll near home.
  const places = st.buildings.filter((b) => b.owner === 'player' && !b.dead && b.built >= 1 && b.workers?.length);
  const b = places.length ? st.rng.pick(places) : null;
  if (b) {
    c.inspect = b.id;
    const p = at(b);
    walkTo(st, c, p.x + st.rng.range(-1, 1), p.y + b.h / 2 + 0.6);
  } else {
    c.inspect = 0;
    const gp = gatheringPoint(st);
    wander(st, c, gp.x, gp.y, 4);
  }
}

function walkTo(st, c, x, y, extra) {
  if (goTo(st, c, x, y, extra)) {
    c.fails = 0;
    return true;
  }
  c.fails++;
  return false;
}

// --- Homes ---------------------------------------------------------------

// Anyone without a bed takes a free one. Newcomers the story introduces
// wait to be welcomed first.
export function houseHomeless(st) {
  const homeless = st.citizens.filter((c) => !c.dead && !c.stranger && !c.guest && !c.home && c.state !== 'leave');
  if (!homeless.length) return;
  for (const b of st.buildings) {
    if (b.owner !== 'player' || b.built < 1 || b.dead || !BUILDINGS[b.type].housing) continue;
    const cap = stat(b, 'housing');
    while (b.residents.length < cap && homeless.length) {
      const c = homeless.shift();
      c.home = b.id;
      c.homelessDays = 0;
      b.residents.push(c.id);
      if (st.stats.housed++ < 6 || st.rng.chance(0.3)) {
        notify(st, `🏠 ${c.name} now sleeps in the ${levelName(b).toLowerCase()}.`, 'good', c);
      }
    }
  }
}

// A newcomer the household has welcomed joins it, sleeps in the compound
// if there is room, and sits by the fire until there is work.
export function takeIn(st, c) {
  if (!c || c.dead) return;
  c.guest = false;
  c.stranger = false;
  c.homelessDays = 0;
  const home = st.buildings.find((b) => b.type === 'compound' && b.owner === 'player' && !b.dead);
  if (home && home.residents.length < stat(home, 'housing') && !c.home) {
    c.home = home.id;
    home.residents.push(c.id);
  }
  c.state = 'arrive';
  c.path = null;
  st.dirty.jobs = true;
}

// --- Jobs ------------------------------------------------------------------

function isFoodJob(b) {
  const job = BUILDINGS[b.type].job;
  return job && RESOURCES[job.product]?.kind === 'food';
}

// Player priority (0 low, 1 normal, 2 high), plus a nudge toward food when
// stores run low (or once the household has gone hungry). Free hands go to
// the highest first.
export function effPriority(st, b) {
  let p = b.priority * 2;
  if (isFoodJob(b) && (st.foodLow || st.flags.feedFirst)) p += 1;
  return p;
}

// People with nothing to do: they sit by the fire.
export function jobless(st) {
  return st.citizens.filter((c) => !c.dead && !c.stranger && !c.guest && !c.special && !c.job && (c.state === 'wait' || c.state === 'arrive' || c.state === 'idle' || c.state === 'movein'));
}

// Free hands fill free places at work. Nobody leaves one job for another by
// themselves: moving a worker is the player's call (see assignTo).
export function assignJobs(st) {
  st.dirty.jobs = false;
  const pop = population(st);
  st.foodLow = totalFood(st) < Math.max(10, pop * 2.5);

  const slots = [];
  for (const b of st.buildings) {
    if (b.owner !== 'player' || b.dead || b.built < 1 || b.paused) continue;
    const want = BUILDINGS[b.type].workers || 0;
    if (b.workers.length < want) slots.push({ b, free: want - b.workers.length, pri: effPriority(st, b) });
  }
  if (!slots.length) return;
  slots.sort((a, b) => b.pri - a.pri || a.b.id - b.b.id);

  const idle = jobless(st);
  if (!idle.length) return;
  // Someone who knows a trade takes that work first, if it is waiting and
  // nothing more urgent is.
  const top = slots[0].pri;
  for (let j = idle.length - 1; j >= 0; j--) {
    const c = idle[j];
    const s = c.calling && slots.find((x) => x.free > 0 && x.b.type === c.calling && x.pri >= top);
    if (!s) continue;
    idle.splice(j, 1);
    startJob(st, c, s.b);
    s.free--;
  }
  for (const s of slots) {
    const p = at(s.b);
    while (s.free > 0 && idle.length) {
      // Someone who already knows the trade goes first, then whoever is nearest.
      let k = 0;
      let bestD = Infinity;
      idle.forEach((c, j) => {
        const d = Math.hypot(c.x - p.x, c.y - p.y) - (c.calling === s.b.type ? 1000 : 0);
        if (d < bestD) {
          bestD = d;
          k = j;
        }
      });
      startJob(st, idle.splice(k, 1)[0], s.b);
      s.free--;
    }
  }
}

// The player sends someone to work somewhere. If the place is full, its
// newest worker goes back to the fire.
export function assignTo(st, c, b) {
  if (!c || c.dead || c.kind !== 'citizen') return { ok: false, reason: 'Pick one of your people first.' };
  if (c.special) return { ok: false, reason: `${c.name} runs the household and takes no job.` };
  if (c.stranger || c.guest) return { ok: false, reason: `${c.name} has not joined you yet.` };
  if (!b || b.dead || b.owner !== 'player') return { ok: false, reason: 'That is not one of your workplaces.' };
  const def = BUILDINGS[b.type];
  if (!def.workers) return { ok: false, reason: `Nobody works at the ${def.name.toLowerCase()}.` };
  if (b.built < 1) return { ok: false, reason: `The ${def.name.toLowerCase()} is still being built.` };
  if (c.job === b.id) return { ok: true, same: true };
  const from = c.job ? st.byId.get(c.job)?.type || null : null;
  let bumped = null;
  if (b.workers.length >= def.workers) {
    bumped = st.byId.get(b.workers[b.workers.length - 1]);
    if (bumped) releaseFromJob(st, bumped);
  }
  if (c.job) releaseFromJob(st, c);
  c.site = null;
  c.src = -1;
  b.paused = false;
  startJob(st, c, b, from);
  notify(st, `🔁 ${c.name} now works at the ${def.name.toLowerCase()}.${bumped ? ` ${bumped.name} goes back to the fire.` : ''}`, 'info', c);
  return { ok: true, bumped };
}

// Taking up work: first they change into the clothes of the trade, there
// and then, and only then set off for the workplace.
export const DRESS_TIME = 2.6;

function startJob(st, c, b, from = null) {
  leaveSite(st, c);
  c.dressFrom = from;
  c.job = b.id;
  b.workers.push(c.id);
  c.carry = null;
  c.carcass = null;
  c.src = -1;
  c.path = null;
  c.state = 'dress';
  c.timer = DRESS_TIME;
  st.fx.push({ kind: 'puff', x0: c.x, y0: c.y, x1: c.x, y1: c.y, t: -0.9, dur: 1.1 });
}

// --- Orders for one person ----------------------------------------------------

// The founder (or a woodcutter) is sent to fell a particular tree. The
// founder keeps at it, tree after tree; a woodcutter makes that spot his new
// place of work and fells the trees around it.
export const CHOP = { type: 'gather', source: 'tree', radius: 10, work: 7, saw: 3.5, yield: 4, product: 'wood' };

export function orderTree(st, c, i) {
  if (!c || c.dead || c.kind !== 'citizen') return { ok: false, reason: 'Pick one of your people first.' };
  if (!(st.trees[i] > 0)) return { ok: false, reason: 'There is no tree there.' };
  const job = c.job ? st.byId.get(c.job) : null;
  const cutter = job && BUILDINGS[job.type].job?.source === 'tree';
  if (c.special !== 'founder' && !cutter) {
    return { ok: false, reason: `${c.name} is not a woodcutter. Send ${c.female ? 'her' : 'him'} to a Wood Shed first, then pick a tree.` };
  }
  if (!approachable(st, i) || !findPath(st, Math.floor(c.x), Math.floor(c.y), i % st.W, Math.floor(i / st.W), { within: 1.5, max: 6000 })) {
    return { ok: false, reason: 'Nobody can get to that tree yet. Pick one at the edge of the forest.' };
  }
  const site = { x: (i % st.W) + 0.5, y: Math.floor(i / st.W) + 0.5 };
  leaveSite(st, c);
  if (c.state === 'dress' || BUILD_STATES.has(c.state)) c.state = 'idle';
  // Whoever was cutting it leaves it to them.
  for (const o of st.citizens) if (o !== c && o.src === i) o.src = -1;
  if (c.special === 'founder') c.task = { kind: 'chop', site };
  else c.site = site;
  c.src = i;
  c.hidden = false;
  if (c.carry) headToStore(st, c);
  else goToSource(st, c);
  return { ok: true };
}

// The founder walks somewhere: to look at a place, say.
export function orderWalk(st, c, x, y) {
  if (!c || c.dead || c.special !== 'founder') return { ok: false, reason: 'Only the founder goes where you send him. Workers go where their work is.' };
  if (!goTo(st, c, x, y, { within: 0.8, max: 8000 }) && !goTo(st, c, x, y, { within: 0.8, max: 8000, partial: true })) {
    return { ok: false, reason: 'He cannot find a way there.' };
  }
  leaveSite(st, c);
  c.task = { kind: 'go', x, y };
  c.state = 'goto';
  c.carry = null;
  c.hidden = false;
  return { ok: true };
}

function endTask(st, c) {
  c.task = null;
  c.src = -1;
  c.path = null;
  c.state = 'idle';
  c.timer = 0;
}

// --- Building sites --------------------------------------------------------------

// Nothing goes up by itself. Builders (anyone sitting by the fire, and the
// founder when he has nothing else to do) walk to the stores, carry the
// planks over a load at a time, and then put the building up.
const LOAD = 8;
export const BUILD_STATES = new Set(['fetch', 'tosite', 'build']);

export function freeBuilders(st) {
  const out = jobless(st).filter((c) => c.state !== 'movein');
  const f = st.citizens.find((x) => x.special === 'founder' && !x.dead);
  if (f && !f.task && !f.buildSite && !f.hidden && (f.state === 'supervise' || f.state === 'idle')) out.push(f);
  return out;
}

export function buildingSites(st) {
  return st.buildings.filter((b) => b.owner === 'player' && !b.dead && b.built < 1);
}

export function assignBuilders(st) {
  st.dirty.build = false;
  const list = buildingSites(st);
  if (!list.length) return;
  const open = [];
  for (const b of list) {
    b.builders = (b.builders || []).filter((id) => {
      const c = st.byId.get(id);
      return c && !c.dead && c.buildSite === b.id;
    });
    if (st.time.t - (b.blockedT ?? -1e9) < 20) continue;
    if (b.builders.length < buildCrew(BUILDINGS[b.type])) open.push(b);
  }
  const free = freeBuilders(st);
  // Pair up builders and sites, nearest first: a builder finishing one
  // fence section moves on to the next one along. The founder goes only when
  // nobody else is free; older sites come a little before newer ones.
  while (free.length && open.length) {
    let best = null;
    let bestD = Infinity;
    for (const c of free) {
      for (const b of open) {
        const p = at(b);
        const d = Math.hypot(c.x - p.x, c.y - p.y) + (c.special ? 60 : 0) + (b.id - open[0].id) * 0.02;
        if (d < bestD) {
          bestD = d;
          best = [c, b];
        }
      }
    }
    const [c, b] = best;
    free.splice(free.indexOf(c), 1);
    startBuild(st, c, b);
    if (b.builders.length >= buildCrew(BUILDINGS[b.type])) open.splice(open.indexOf(b), 1);
  }
}

// The player sends someone to help on a building site. Workers keep their
// place at work and go back to it when the building is finished.
export function assignBuilder(st, c, b) {
  if (!c || c.dead || c.kind !== 'citizen') return { ok: false, reason: 'Pick one of your people first.' };
  if (c.stranger || c.guest) return { ok: false, reason: `${c.name} has not joined you yet.` };
  if (c.special === 'spouse') return { ok: false, reason: `${c.name} keeps the house.` };
  if (!b || b.dead || b.owner !== 'player' || b.built >= 1) return { ok: false, reason: 'That is not a building site.' };
  if (c.buildSite === b.id) return { ok: true, same: true };
  leaveSite(st, c);
  if (c.special === 'founder') c.task = null;
  // Whatever was in their hands is put down at the stores on the way.
  if (c.carry) addRes(st, c.carry.r, c.carry.n);
  c.carry = null;
  if (c.carcass) {
    const job = st.byId.get(c.job);
    if (job) job.meat = (job.meat || 0) + (MEAT[c.carcass] || 8);
    c.carcass = null;
  }
  if (c.prey) {
    const a = st.byId.get(c.prey);
    if (a) a.reserved = 0;
    c.prey = 0;
  }
  c.hidden = false;
  startBuild(st, c, b);
  notify(st, `🔨 ${c.name} goes to help build the ${BUILDINGS[b.type].name.toLowerCase()}.`, 'info', c);
  return { ok: true };
}

function startBuild(st, c, b) {
  c.buildSite = b.id;
  if (!b.builders.includes(c.id)) b.builders.push(c.id);
  c.inspect = 0;
  c.path = null;
  c.timer = 0;
  c.status = '';
  nextBuildStep(st, c, b);
}

const haulLeft = (b) => Object.keys(b.haul || {}).find((k) => b.haul[k] > 0);
const loadFor = (b) => Math.max(LOAD, Math.ceil((b.need || 0) / 6));

// Materials still to fetch? To the stores. Otherwise, to the site.
function nextBuildStep(st, c, b) {
  const r = haulLeft(b);
  if (r) {
    const store = findStore(st, r, c.x, c.y);
    if (store && walkTo(st, c, at(store).x, at(store).y)) {
      c.state = 'fetch';
      c.storeId = store.id;
      return;
    }
    // No store to fetch from: they make do with what is to hand.
    b.got += b.haul[r];
    b.haul[r] = 0;
    nextBuildStep(st, c, b);
    return;
  }
  c.state = 'tosite';
  goToSite(st, c, b);
}

function goToSite(st, c, b) {
  const p = at(b);
  const within = Math.max(b.w, b.h) / 2 + 0.9;
  if (walkTo(st, c, p.x, p.y, { within }) || walkTo(st, c, p.x, p.y, { within, partial: true })) return;
  b.blockedT = st.time.t;
  notifyOnce(st, `site-${b.id}`, 60, `🚧 Nobody can get to the ${BUILDINGS[b.type].name.toLowerCase()} to build it.`, 'bad', p);
  leaveSite(st, c);
  afterBuild(st, c);
}

// Back to what they were doing before.
function afterBuild(st, c) {
  c.status = '';
  c.path = null;
  if (c.carry?.site) c.carry = null;
  if (c.special === 'founder') {
    c.state = 'supervise';
    c.timer = 1;
  } else if (c.job && st.byId.get(c.job)) {
    c.state = 'towork';
    const job = st.byId.get(c.job);
    walkTo(st, c, at(job).x, at(job).y);
  } else {
    c.state = 'idle';
  }
  st.dirty.jobs = true;
  st.dirty.build = true;
}

function finishSite(st, b) {
  b.built = 1;
  for (const id of b.builders) {
    const c = st.byId.get(id);
    if (!c || c.dead || c.buildSite !== b.id) continue;
    c.buildSite = 0;
    afterBuild(st, c);
  }
  b.builders = [];
}

function updateBuilder(st, c, dt) {
  const b = c.buildSite ? st.byId.get(c.buildSite) : null;
  if (!b || b.dead || b.built >= 1) {
    leaveSite(st, c);
    afterBuild(st, c);
    return;
  }
  switch (c.state) {
    case 'fetch': {
      if (!stepMove(st, c, dt, WALK_SPEED)) return;
      const r = haulLeft(b);
      if (r) {
        const n = Math.min(b.haul[r], loadFor(b));
        b.haul[r] -= n;
        c.carry = { r, n, site: b.id };
      }
      c.state = 'tosite';
      goToSite(st, c, b);
      return;
    }
    case 'tosite': {
      if (!stepMove(st, c, dt, c.carry ? CARRY_SPEED : WALK_SPEED)) return;
      if (c.carry?.site === b.id) {
        b.got += c.carry.n;
        c.carry = null;
      }
      if (haulLeft(b)) {
        nextBuildStep(st, c, b);
        return;
      }
      c.state = 'build';
      c.timer = 0;
      return;
    }
    case 'build': {
      if (b.got < b.need) {
        c.status = 'Waiting for the materials';
        return;
      }
      c.status = '';
      b.built += (dt / b.work) * (supervised(st, c) ? SUPERVISE_BONUS : 1) * (st.tech.tools ? 1.25 : 1);
      if (b.built >= 1) finishSite(st, b);
      return;
    }
  }
}

// What stage a building site has reached.
export function siteStage(b) {
  if (b.built >= 1) return null;
  if (b.got < b.need) return { n: 0, name: 'Bringing the materials' };
  if (b.built < 0.3) return { n: 1, name: BUILDINGS[b.type].flat ? 'Marking out the ground' : 'Putting up the frame' };
  if (b.built < 0.8) return { n: 2, name: BUILDINGS[b.type].flat ? 'Clearing and laying out' : 'Raising the walls' };
  return { n: 3, name: BUILDINGS[b.type].flat ? 'Finishing off' : 'Putting on the roof' };
}

// --- Stores -----------------------------------------------------------------

function findStore(st, res, x, y) {
  const kind = RESOURCES[res].kind;
  const types = STORAGE_FOR[kind] || [];
  let best = null;
  let bestD = Infinity;
  for (const b of st.buildings) {
    if (b.owner !== 'player' || b.dead || b.built < 1 || !types.includes(b.type)) continue;
    const p = at(b);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function headToStore(st, c) {
  const store = findStore(st, c.carry.r, c.x, c.y);
  if (!store) {
    c.state = 'storewait';
    c.timer = 3;
    notifyOnce(st, `nostore-${RESOURCES[c.carry.r].kind}`, 30, `📦 Nowhere to store ${RESOURCES[c.carry.r].name.toLowerCase()}. Build a ${st.era < 1 ? 'Storage Floor' : RESOURCES[c.carry.r].kind === 'food' ? 'granary' : 'storehouse'}.`, 'bad');
    return;
  }
  c.storeId = store.id;
  c.state = 'tostore';
  const p = at(store);
  if (!walkTo(st, c, p.x, p.y)) {
    c.state = 'storewait';
    c.timer = 3;
    if (c.fails > 3) {
      c.status = 'Shut out: no way back to the stores';
      notifyOnce(st, `shut-${c.id}`, 60, `🚧 ${c.name} cannot get back to the stores. Put a gate in the fence where ${c.female ? 'she' : 'he'} can get through.`, 'bad', c);
    }
    return;
  }
  c.status = '';
}

function deliver(st, c) {
  const room = roomFor(st, c.carry.r);
  if (room < 1) {
    c.state = 'storewait';
    c.timer = 3;
    const kind = RESOURCES[c.carry.r].kind;
    const what = RESOURCES[c.carry.r].name.toLowerCase();
    if (st.era < 1) notifyOnce(st, `full-${kind}`, 150, `📦 No room left for ${what} on your storage floor. Build another Storage Floor beside it.`, 'bad');
    else notifyOnce(st, `full-${kind}`, 150, `📦 Your ${kind === 'food' ? 'granaries are' : 'storehouses are'} full. Build another ${kind === 'food' ? 'granary' : 'storehouse'} or storage floor${kind === 'food' ? '' : ', or sell at the market'}.`, 'bad');
    return false;
  }
  const n = addRes(st, c.carry.r, c.carry.n);
  c.carry.n -= n;
  if (c.carry.n <= 0.01) c.carry = null;
  return !c.carry;
}

// --- Resource sources ----------------------------------------------------------

// Somewhere next to tile i a person can stand.
export function approachable(st, i) {
  const W = st.W;
  const x = i % W;
  const y = (i / W) | 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= st.H) continue;
      const j = ny * W + nx;
      if (WALK[st.terrain[j]] === 0 || treeBlocks(st.trees, st.felled, st.terrain, j)) continue;
      const b = st.occ[j] && st.byId.get(st.occ[j]);
      if (b && b.wall) continue;
      return true;
    }
  }
  return false;
}

function sourcePred(st, kind) {
  switch (kind) {
    case 'tree':
      return (i) => st.trees[i] > 0 && !st.occ[i];
    case 'rock':
      return (i) => st.feature[i] === F.ROCK && st.amount[i] > 0;
    case 'iron':
      return (i) => st.feature[i] === F.IRON && st.amount[i] > 0;
    case 'palm':
      return (i) => st.feature[i] === F.PALM && st.amount[i] >= 4;
    case 'clay':
      return (i) => st.feature[i] === F.CLAY && st.amount[i] > 0;
    case 'water':
      return (i) => WALK[st.terrain[i]] > 0 && !isWater(st.terrain[i]) && adjacentToWater(st, i) && !(st.occ[i] && st.byId.get(st.occ[i])?.wall);
    default:
      return () => false;
  }
}

// Where this person's work is centred: a spot the player chose, else their
// workplace.
function anchorOf(st, c, job) {
  if (c.site) return c.site;
  if (c.task?.site) return c.task.site;
  return job ? at(job) : { x: c.x, y: c.y };
}

function findSource(st, c, job, def) {
  const p = anchorOf(st, c, job);
  if (def.source === 'tree') {
    // The nearest tree nobody else is cutting, that can be got at from open
    // ground: the forest is cleared from its edge inward.
    const claimed = new Set();
    for (const o of st.citizens) if (o !== c && !o.dead && o.src >= 0 && (o.job || o.task)) claimed.add(o.src);
    const ok = sourcePred(st, 'tree');
    const bad = c.badSrc && st.time.t - c.badT < 30 ? c.badSrc : -1;
    return findNear(st, Math.floor(p.x), Math.floor(p.y), def.radius, (i) => ok(i) && i !== bad && !claimed.has(i) && approachable(st, i), 1);
  }
  return findNear(st, Math.floor(p.x), Math.floor(p.y), def.radius, sourcePred(st, def.source), def.source === 'water' ? 4 : 3);
}

function takeFromSource(st, i, job) {
  if (job.source === 'water') return Math.round(job.yield * (st.tech.nets ? 1.5 : 1));
  const n = Math.min(job.yield, st.amount[i]);
  st.amount[i] -= n;
  if (st.amount[i] === 0 && job.source !== 'palm') {
    st.feature[i] = F.NONE;
    markTile(st, i);
  }
  return n;
}

// Cut up to `n` planks from a felled tree. When it is used up only a stump
// is left, and the forest floor becomes open ground.
function sawPlanks(st, i, n) {
  const got = Math.min(n, st.trees[i]);
  st.trees[i] -= got;
  if (st.trees[i] === 0) {
    st.felled[i] = TREE.STUMP;
    if (st.terrain[i] === T.FOREST) st.terrain[i] = T.GRASS;
    st.dirty.reach = true;
  }
  markTile(st, i);
  return got;
}

function goToSource(st, c) {
  const i = c.src;
  c.state = 'tosource';
  if (!walkTo(st, c, i % st.W, Math.floor(i / st.W), { within: 1.5 })) {
    c.badSrc = i;
    c.badT = st.time.t;
    c.src = -1;
    c.state = 'seek';
    c.timer = 1;
  }
}

// Whose clothes someone puts on for each kind of work.
const TRADE = { woodcutter: "a woodcutter's", hunter: "a hunter's", farm: "a farmer's", cassava: "a farmer's", brickyard: "a brickmaker's", fisher: "a fisherman's", canoeyard: "a boatbuilder's", quarry: "a quarryman's", ironmine: "a miner's", blacksmith: "a smith's", palmpress: 'oil-pressing', garri: 'garri-making', shrine: "a priest's", market: "a trader's" };

const SOURCE_NAME = { tree: 'trees', rock: 'rock', iron: 'iron ore', palm: 'ripe palm trees', water: 'open water', clay: 'red mud' };

// Meat in each kind of animal.
export const MEAT = { antelope: 10, pig: 8 };

// --- The update ---------------------------------------------------------------

function nearThreat(st, c, r) {
  for (const t of st.threats) if (Math.abs(t.x - c.x) < r && Math.abs(t.y - c.y) < r && Math.hypot(t.x - c.x, t.y - c.y) < r) return true;
  return false;
}

function shelterFor(st, c) {
  const home = st.byId.get(c.home);
  if (home && !home.dead) return home;
  let best = null;
  let bestD = Infinity;
  for (const b of st.buildings) {
    if (b.dead || b.owner !== 'player' || b.built < 1 || !(b.type === 'compound' || b.type === 'palace' || BUILDINGS[b.type].housing)) continue;
    const d = Math.hypot(b.x + b.w / 2 - c.x, b.y + b.h / 2 - c.y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

// Run indoors and stay there until `until` says it is safe.
export function hideIndoors(st, c, until) {
  const shelter = shelterFor(st, c);
  if (!shelter || c.dead) return;
  if (c.prey) {
    const a = st.byId.get(c.prey);
    if (a) a.reserved = 0;
    c.prey = 0;
  }
  c.state = 'flee';
  c.hideFor = until || null;
  walkTo(st, c, shelter.x + shelter.w / 2, shelter.y + shelter.h / 2);
}

export function resume(st, c) {
  c.hidden = false;
  c.path = null;
  c.hideFor = null;
  const site = c.buildSite ? st.byId.get(c.buildSite) : null;
  if (site && !site.dead && site.built < 1) {
    if (c.carry?.site) {
      c.state = 'tosite';
      goToSite(st, c, site);
    } else nextBuildStep(st, c, site);
    return;
  }
  if (c.stranger) c.state = 'arrive';
  else if (c.task?.kind === 'chop') {
    if (c.carry) headToStore(st, c);
    else if (c.src >= 0 && st.trees[c.src] > 0) goToSource(st, c);
    else {
      c.state = 'seek';
      c.timer = 0;
    }
  } else if (c.task?.kind === 'go') {
    if (!goTo(st, c, c.task.x, c.task.y, { within: 0.8, partial: true })) endTask(st, c);
    else c.state = 'goto';
  } else if (!c.job) c.state = 'idle';
  else if (c.carcass) {
    const job = st.byId.get(c.job);
    c.state = 'haul';
    if (job) walkTo(st, c, job.x + job.w / 2, job.y + job.h / 2);
  } else if (c.carry) headToStore(st, c);
  else {
    c.state = 'towork';
    const job = st.byId.get(c.job);
    if (job) walkTo(st, c, job.x + job.w / 2, job.y + job.h / 2);
  }
}

const workTime = (st, c, def, t) => (t * (st.tech.tools && def.source !== 'water' ? 0.75 : 1)) / (supervised(st, c) ? SUPERVISE_BONUS : 1);

export function updateCitizen(st, c, dt) {
  c.px = c.x;
  c.py = c.y;
  const speed = c.carry || c.carcass ? CARRY_SPEED : WALK_SPEED;
  const job = c.job ? st.byId.get(c.job) : null;
  if (c.job && (!job || job.dead)) {
    releaseFromJob(st, c);
    return;
  }
  const def = job ? BUILDINGS[job.type].job : c.task?.kind === 'chop' ? CHOP : null;

  if (c.special) {
    if (c.job) {
      releaseFromJob(st, c);
      return;
    }
    if (c.special === 'founder' && !c.task && (c.state === 'idle' || c.state === 'movein')) {
      c.state = 'supervise';
      c.timer = 0;
    }
  }

  // Townsfolk run for cover when a war band comes near.
  if (st.threats.length && c.state !== 'flee' && c.state !== 'hide' && c.state !== 'leave') {
    c.threatT = (c.threatT || 0) - dt;
    if (c.threatT <= 0) {
      c.threatT = 0.5;
      if (nearThreat(st, c, 6) && shelterFor(st, c)) {
        hideIndoors(st, c);
        return;
      }
    }
  }

  if (BUILD_STATES.has(c.state)) {
    updateBuilder(st, c, dt);
    return;
  }

  switch (c.state) {
    case 'supervise':
      supervise(st, c, dt);
      return;
    // Changing into work clothes before setting off.
    case 'dress': {
      c.timer -= dt;
      if (c.timer > 0) return;
      if (!job) {
        c.state = 'idle';
        return;
      }
      c.state = 'towork';
      walkTo(st, c, at(job).x, at(job).y);
      return;
    }
    // Caught by a wild animal (see sim/animals.js): frozen in place, or
    // standing to fight it off. The animal ends the struggle either way.
    case 'attacked':
    case 'fight':
      c.path = null;
      return;
    case 'flee': {
      if (stepMove(st, c, dt, WALK_SPEED * 1.25)) {
        c.state = 'hide';
        c.hidden = true;
        c.timer = 6;
      }
      return;
    }
    case 'hide': {
      c.timer -= dt;
      if (c.timer <= 0) {
        if (nearThreat(st, c, 8) || (c.hideFor === 'wolves' && st.animals.some((a) => a.type === 'wolf' && !a.dead && !a.carcass))) c.timer = 3;
        else resume(st, c);
      }
      return;
    }

    // Walking to the fire: newcomers, and anyone with no work.
    case 'arrive': {
      const gp = gatheringPoint(st);
      if (!c.path) {
        if (Math.hypot(c.x - gp.x, c.y - gp.y) < 3) {
          c.state = 'wait';
          c.timer = st.rng.range(1, 4);
          if (c.stranger && !c.guest) {
            // Arrived: one of us now.
            c.stranger = false;
            st.dirty.jobs = true;
          }
        } else if (!walkTo(st, c, gp.x + st.rng.range(-1.5, 1.5), gp.y + st.rng.range(-1, 1.5), { max: 6000 })) {
          if (c.fails > 3) {
            if (c.stranger) removeCitizen(st, c);
            else {
              c.state = 'wait';
              c.timer = 5;
            }
          }
        }
        return;
      }
      stepMove(st, c, dt, WALK_SPEED);
      return;
    }

    // Sitting by the fire.
    case 'wait': {
      if (c.path) {
        stepMove(st, c, dt, WALK_SPEED * 0.6);
        return;
      }
      c.timer -= dt;
      if (c.timer <= 0) {
        c.timer = st.rng.range(6, 14);
        const gp = gatheringPoint(st);
        if (Math.hypot(c.x - gp.x, c.y - gp.y) > 5) c.state = 'arrive';
        else if (st.rng.chance(0.35)) wander(st, c, gp.x, gp.y, 2);
      }
      return;
    }

    case 'movein': {
      if (stepMove(st, c, dt, WALK_SPEED)) {
        c.state = 'idle';
        c.timer = 1;
        st.dirty.jobs = true;
      }
      return;
    }

    case 'idle': {
      // The founder's wife keeps the house; anyone else with no work goes
      // and sits by the fire.
      if (c.special === 'spouse') {
        if (c.path) {
          stepMove(st, c, dt, WALK_SPEED * 0.6);
          return;
        }
        c.timer -= dt;
        if (c.timer <= 0) {
          c.timer = st.rng.range(5, 12);
          const home = st.byId.get(c.home);
          const p = home ? at(home) : gatheringPoint(st);
          wander(st, c, p.x, p.y + (home ? home.h / 2 + 0.8 : 0), 1.6);
        }
        return;
      }
      if (c.special) return;
      c.state = 'arrive';
      c.path = null;
      return;
    }

    case 'goto': {
      if (stepMove(st, c, dt, WALK_SPEED)) endTask(st, c);
      return;
    }

    case 'leave': {
      if (stepMove(st, c, dt, WALK_SPEED)) removeCitizen(st, c);
      return;
    }

    case 'towork': {
      if (c.path) {
        stepMove(st, c, dt, speed);
        return;
      }
      const p = at(job);
      if (Math.hypot(c.x - p.x, c.y - p.y) > 2.2) {
        if (!walkTo(st, c, p.x, p.y)) {
          c.timer = 2;
          c.state = 'stuck';
        }
        return;
      }
      beginWork(st, c, job, def);
      return;
    }

    case 'stuck': {
      c.timer -= dt;
      if (c.timer <= 0) {
        if (c.fails > 4) {
          notifyOnce(st, `stuck-${job?.id}`, 60, `🚧 ${c.name} can't reach the ${BUILDINGS[job.type].name.toLowerCase()}.`, 'bad', job ? at(job) : c);
          releaseFromJob(st, c);
          if (job) job.paused = true;
          return;
        }
        c.state = 'towork';
      }
      return;
    }

    // --- gathering loop ---
    case 'seek': {
      if (!def) {
        c.state = 'idle';
        return;
      }
      c.timer -= dt;
      if (c.timer > 0) return;
      const src = findSource(st, c, job, def);
      if (src < 0) {
        if (!job) {
          // The founder has cut every tree around: back to the household.
          endTask(st, c);
          return;
        }
        c.status = `No ${SOURCE_NAME[def.source]} nearby`;
        notifyOnce(st, `nosrc-${job.id}`, 90, `🔎 The ${BUILDINGS[job.type].name.toLowerCase()} has no ${SOURCE_NAME[def.source]} in reach.${def.source === 'tree' ? ' Move it closer to the forest, or tap a woodcutter and then a tree.' : ''}`, 'bad', at(job));
        c.timer = 5;
        return;
      }
      c.status = '';
      c.src = src;
      if (def.source === 'tree') {
        goToSource(st, c);
        return;
      }
      c.state = 'tosource';
      if (!walkTo(st, c, src % st.W, Math.floor(src / st.W), { within: 0 })) {
        c.state = 'seek';
        c.timer = 2;
      }
      return;
    }
    case 'tosource': {
      if (stepMove(st, c, dt, speed)) {
        if (c.src < 0 || !sourcePred(st, def.source)(c.src)) {
          c.state = 'seek';
          c.timer = 0.2;
          return;
        }
        const tx = (c.src % st.W) + 0.5;
        if (tx !== c.x) c.facing = tx > c.x ? 1 : -1;
        if (def.source === 'tree') {
          // A standing tree is felled first; a fallen one is cut up.
          const standing = st.felled[c.src] === TREE.STANDING;
          c.state = standing ? 'fell' : 'saw';
          c.timer = workTime(st, c, def, standing ? def.work : def.saw);
          return;
        }
        c.state = 'gather';
        // Imported iron tools speed up every hand that cuts, digs or picks.
        c.timer = workTime(st, c, def, def.work);
      }
      return;
    }
    case 'fell': {
      c.timer -= dt;
      if (c.timer > 0) return;
      if (!(st.trees[c.src] > 0)) {
        c.state = 'seek';
        return;
      }
      if (st.felled[c.src] === TREE.STANDING) {
        st.felled[c.src] = TREE.FELLED;
        st.dirty.reach = true;
        markTile(st, c.src);
        st.fx.push({ kind: 'treefall', x0: (c.src % st.W) + 0.5, y0: Math.floor(c.src / st.W) + 0.5, x1: c.x, y1: c.y, t: 0, dur: 1.1 });
        st.stats.felled = (st.stats.felled || 0) + 1;
      }
      c.state = 'saw';
      c.timer = workTime(st, c, def, def.saw);
      return;
    }
    case 'saw': {
      c.timer -= dt;
      if (c.timer > 0) return;
      const n = sawPlanks(st, c.src, def.yield);
      if (n <= 0) {
        c.state = 'seek';
        return;
      }
      c.carry = { r: 'wood', n };
      headToStore(st, c);
      return;
    }
    case 'gather': {
      c.timer -= dt;
      if (c.timer > 0) return;
      const n = takeFromSource(st, c.src, def);
      if (n <= 0) {
        c.state = 'seek';
        return;
      }
      c.carry = { r: def.product, n };
      c.state = 'return';
      const p = at(job);
      if (!walkTo(st, c, p.x, p.y)) headToStore(st, c);
      return;
    }
    case 'return': {
      if (stepMove(st, c, dt, CARRY_SPEED)) {
        c.state = 'process';
        c.timer = def.process || 0.5;
      }
      return;
    }
    case 'process': {
      c.timer -= dt;
      if (c.timer <= 0) headToStore(st, c);
      return;
    }
    case 'tostore': {
      if (stepMove(st, c, dt, CARRY_SPEED)) {
        if (deliver(st, c)) afterDelivery(st, c, job, def);
      }
      return;
    }
    case 'storewait': {
      c.timer -= dt;
      if (c.timer <= 0) {
        if (!c.carry) {
          afterDelivery(st, c, job, def);
          return;
        }
        const store = st.byId.get(c.storeId);
        if (store && !store.dead && Math.hypot(c.x - at(store).x, c.y - at(store).y) < 2.5) {
          if (deliver(st, c)) afterDelivery(st, c, job, def);
        } else {
          headToStore(st, c);
        }
      }
      return;
    }

    // --- farming ---
    case 'farm': {
      if (c.path) {
        stepMove(st, c, dt, WALK_SPEED * 0.5);
      } else {
        c.timer -= dt;
        if (c.timer <= 0) {
          c.timer = st.rng.range(2, 4);
          const fx = job.x + st.rng.int(0, job.w - 1);
          const fy = job.y + st.rng.int(0, job.h - 1);
          goTo(st, c, fx, fy, { max: 200 });
        }
      }
      // Cassava shrugs off the Harmattan far better than yam does.
      const sf = season(st).farm;
      const seasonal = def.product === 'cassava' ? 0.75 + 0.25 * sf : sf;
      job.growth += (dt / def.grow) * seasonal * (st.tech.tools ? 1.25 : 1) * (supervised(st, c) ? SUPERVISE_BONUS : 1);
      if (job.growth >= 1) {
        job.growth = 1;
        c.state = 'harvest';
        c.timer = 3;
        c.path = null;
      }
      return;
    }
    case 'harvest': {
      c.timer -= dt;
      if (c.timer > 0) return;
      job.growth = 0;
      c.carry = { r: def.product, n: Math.round(def.yield * stat(job, 'yield')) };
      headToStore(st, c);
      return;
    }

    // --- hunting: stalk, shoot, carry the kill home, butcher, carry the meat ---
    case 'hunt': {
      c.timer -= dt;
      if (c.timer > 0) return;
      const lodge = at(job);
      let best = null;
      let bestD = def.radius;
      for (const a of st.animals) {
        if (a.dead || a.carcass || a.type === 'wolf' || (a.reserved && a.reserved !== c.id) || st.time.t - (a.unreachT ?? -1e9) < 60) continue;
        const d = Math.hypot(a.x - lodge.x, a.y - lodge.y);
        if (d < bestD) {
          bestD = d;
          best = a;
        }
      }
      if (!best) {
        c.status = 'No game nearby';
        notifyOnce(st, `nogame-${job.id}`, 90, '🦌 Your hunter can find no game. Move the Hunter’s Shed nearer open grassland, where antelope graze.', 'bad', lodge);
        c.timer = 6;
        return;
      }
      c.status = '';
      best.reserved = c.id;
      c.prey = best.id;
      c.state = 'stalk';
      c.timer = 0;
      return;
    }
    case 'stalk': {
      const prey = st.byId.get(c.prey);
      if (!prey || prey.dead) {
        c.prey = 0;
        c.state = 'hunt';
        c.timer = 0.5;
        return;
      }
      if (prey.carcass) {
        c.state = 'tocarcass';
        walkTo(st, c, prey.x, prey.y, { within: 0.8 });
        return;
      }
      const d = Math.hypot(prey.x - c.x, prey.y - c.y);
      if (d < 4.5) {
        c.state = 'shoot';
        c.timer = 1.1;
        c.path = null;
        c.facing = prey.x > c.x ? 1 : -1;
        return;
      }
      c.timer -= dt;
      if (!c.path || c.timer <= 0) {
        c.timer = 2;
        if (!walkTo(st, c, prey.x, prey.y, { within: 3 })) {
          prey.reserved = 0;
          prey.unreachT = st.time.t;
          c.prey = 0;
          c.state = 'hunt';
          c.timer = 3;
          return;
        }
      }
      stepMove(st, c, dt, WALK_SPEED * 1.1);
      return;
    }
    case 'shoot': {
      c.timer -= dt;
      if (c.timer > 0) return;
      const prey = st.byId.get(c.prey);
      if (!prey || prey.dead) {
        c.state = 'hunt';
        return;
      }
      c.facing = prey.x > c.x ? 1 : -1;
      st.fx.push({ kind: 'arrow', x0: c.x, y0: c.y, x1: prey.x, y1: prey.y, t: 0, dur: 0.35 });
      prey.hp -= 1;
      prey.hitT = st.time.t;
      if (prey.hp > 0) {
        // Hit, it bolts: after it.
        const a = Math.atan2(prey.y - c.y, prey.x - c.x);
        wander(st, prey, prey.x + Math.cos(a) * 3, prey.y + Math.sin(a) * 3, 1.5);
        prey.fleeT = 2;
        c.state = 'stalk';
        c.timer = 0.6;
        return;
      }
      prey.carcass = true;
      prey.path = null;
      prey.rotT = 0;
      c.state = 'tocarcass';
      walkTo(st, c, prey.x, prey.y, { within: 0.8 });
      return;
    }
    case 'tocarcass': {
      if (stepMove(st, c, dt, WALK_SPEED)) {
        const prey = st.byId.get(c.prey);
        if (prey && !prey.dead) {
          // On to his shoulders and home.
          prey.dead = true;
          st.dirty.cleanup = true;
          c.carcass = prey.type;
        }
        c.prey = 0;
        if (!c.carcass) {
          c.state = 'hunt';
          return;
        }
        c.state = 'haul';
        const p = at(job);
        if (!walkTo(st, c, p.x, p.y + job.h / 2 + 0.3)) walkTo(st, c, p.x, p.y);
      }
      return;
    }
    case 'haul': {
      if (stepMove(st, c, dt, CARRY_SPEED * 0.85)) {
        c.state = 'butcher';
        c.timer = workTime(st, c, def, def.work);
      }
      return;
    }
    case 'butcher': {
      c.timer -= dt;
      if (c.timer > 0) return;
      job.meat = (job.meat || 0) + (MEAT[c.carcass] || 8);
      c.carcass = null;
      packMeat(st, c, job, def);
      return;
    }

    // --- crafting ---
    case 'craft': {
      if (job.craftT <= 0) {
        if (!Object.entries(def.inputs).every(([k, v]) => st.res[k] >= v)) {
          c.status = `Needs ${Object.keys(def.inputs).join(' and ')}`;
          c.timer -= dt;
          return;
        }
        if (roomFor(st, def.product) < def.yield) {
          c.status = 'Storehouse full';
          return;
        }
        for (const [k, v] of Object.entries(def.inputs)) st.res[k] -= v;
        job.craftT = def.work;
        c.status = '';
      }
      job.craftT -= dt * (supervised(st, c) ? SUPERVISE_BONUS : 1);
      if (job.craftT <= 0) {
        job.craftT = 0;
        // Factories also export part of each batch for cash.
        if (def.cash) {
          st.res.cowries += def.cash;
          st.stats.earned = (st.stats.earned || 0) + def.cash;
        }
        c.carry = { r: def.product, n: def.yield };
        headToStore(st, c);
      }
      return;
    }

    // --- shrine keeping ---
    case 'tend': {
      if (c.path) {
        stepMove(st, c, dt, WALK_SPEED * 0.4);
        return;
      }
      c.timer -= dt;
      if (c.timer <= 0) {
        c.timer = st.rng.range(3, 7);
        goTo(st, c, job.x + st.rng.int(0, job.w - 1), job.y + st.rng.int(0, job.h - 1), { max: 200 });
      }
      return;
    }

    default:
      c.state = c.stranger ? 'arrive' : 'idle';
  }
}

// Meat cut at the hunter's shed goes to the store a load at a time.
function packMeat(st, c, job, def) {
  const n = Math.min(def.carry || 5, job.meat || 0);
  if (n <= 0) {
    c.state = 'hunt';
    c.timer = 1;
    return;
  }
  job.meat -= n;
  c.carry = { r: 'meat', n };
  headToStore(st, c);
}

function beginWork(st, c, job, def) {
  c.status = '';
  switch (def.type) {
    case 'gather':
      c.state = 'seek';
      c.timer = 0;
      break;
    case 'farm':
      c.state = 'farm';
      c.timer = 0;
      break;
    case 'hunt':
      if (job.meat > 0) packMeat(st, c, job, def);
      else {
        c.state = 'hunt';
        c.timer = 0;
      }
      break;
    case 'craft':
      c.state = 'craft';
      c.timer = 0;
      break;
    case 'tend':
      c.state = 'tend';
      c.timer = 0;
      break;
    default:
      c.state = 'idle';
  }
}

function afterDelivery(st, c, job, def) {
  if (!def) {
    c.state = 'idle';
    return;
  }
  if (def.type === 'gather') {
    if (def.source === 'tree') {
      // Back to the same tree until it is used up, then the next nearest.
      if (c.src >= 0 && st.trees[c.src] > 0) {
        goToSource(st, c);
        return;
      }
      c.src = -1;
      // Once there is a wood shed, the founder leaves the felling to others.
      if (!job && st.buildings.some((b) => b.type === 'woodcutter' && b.owner === 'player' && !b.dead && b.built >= 1)) {
        endTask(st, c);
        return;
      }
    }
    c.state = 'seek';
    c.timer = 0;
  } else {
    c.state = 'towork';
    const p = at(job);
    walkTo(st, c, p.x, p.y);
  }
}

// --- People who give up ------------------------------------------------------------

const where = (st, c) => {
  const job = c.job ? st.byId.get(c.job) : null;
  return job ? `at the ${BUILDINGS[job.type].name.toLowerCase()}` : 'by the fire';
};

// Hungry or sleeping in the open, people grumble first and then go. Each
// morning the founder hears who is thinking of leaving; if nothing changes
// by the next, that person packs up.
export function dailyCitizens(st) {
  if (st.flags.opening && !st.flags.openingDone) return;
  const members = st.citizens.filter((c) => !c.dead && !c.stranger && !c.special && c.state !== 'leave');
  const homeless = members.filter((c) => !c.home);
  for (const c of members) c.homelessDays = c.home ? 0 : (c.homelessDays || 0) + 1;
  const hungry = st.hungry || st.starveDays > 0;
  const crowded = homeless.some((c) => c.homelessDays >= 2);
  const reason = hungry ? 'food' : crowded ? 'houses' : st.happy < 30 ? 'mood' : null;
  const he = (c) => (c.female ? 'she' : 'he');
  const w = st.leaving ? st.byId.get(st.leaving.id) : null;
  if (!reason) {
    if (w && !w.dead) notify(st, `🙂 ${w.name} has decided to stay.`, 'good', w);
    st.leaving = null;
    return;
  }
  if (w && !w.dead && w.state !== 'leave' && st.time.day > st.leaving.day) {
    const why = st.leaving.reason === 'mood' ? 'because nobody here is happy' : `because of a shortage of ${st.leaving.reason === 'food' ? 'food' : 'houses'}`;
    notify(st, `🚶 ${st.founder}: “${w.name} has left ${where(st, w)} ${why}.”`, 'bad', w);
    sendAway(st, w);
    st.leaving = null;
    return;
  }
  if (w && !w.dead && w.state !== 'leave') return;
  const pool = reason === 'houses' ? homeless.filter((c) => c.homelessDays >= 2) : members;
  if (!pool.length) return;
  const workers = pool.filter((c) => c.job);
  const c = st.rng.pick(workers.length ? workers : pool);
  st.leaving = { id: c.id, reason, day: st.time.day };
  const complaint = reason === 'food' ? 'there is not enough to eat' : reason === 'houses' ? `${he(c)} has no house to sleep in` : 'nobody here is happy';
  notify(st, `🗣️ ${st.founder}: “${c.name} ${where(st, c)} says ${complaint}. If nothing changes, ${he(c)} will leave us.”`, 'bad', c);
}

export function citizenStatus(st, c) {
  if (c.status) return c.status;
  const job = c.job ? st.byId.get(c.job) : null;
  const s = {
    arrive: c.stranger ? 'Coming to join you' : 'Going to sit by the fire',
    wait: c.guest ? 'Waiting to be welcomed' : 'Sitting by the fire: no work',
    movein: 'Moving into a new home',
    idle: c.special === 'spouse' ? 'Keeping the house' : 'Looking for work',
    attacked: 'Attacked by a wolf!',
    fight: 'Fighting off a wolf!',
    leave: 'Leaving for good',
    goto: 'Walking',
    towork: `Going to the ${job ? BUILDINGS[job.type].name.toLowerCase() : 'work'}`,
    stuck: 'Cannot find a way',
    seek: 'Looking for a source',
    tosource: c.carry ? 'Going back' : 'Heading out',
    fell: 'Felling a tree',
    saw: 'Cutting planks',
    gather: job?.type === 'brickyard' ? 'Digging red mud' : 'Working',
    return: 'Bringing it back',
    process: job?.type === 'brickyard' ? 'Moulding mud bricks' : 'Preparing goods',
    tostore: `Carrying ${c.carry ? `${Math.round(c.carry.n)} ${c.carry.r === 'wood' ? 'planks' : RESOURCES[c.carry.r].name.toLowerCase()}` : 'it'} to the ${st.byId.get(c.storeId)?.type === 'stockpile' ? 'storage floor' : 'store'}`,
    storewait: 'Waiting for storage space',
    farm: 'Tending the yam mounds',
    harvest: 'Harvesting',
    hunt: 'Searching for game',
    stalk: 'Stalking game',
    shoot: 'Taking aim',
    tocarcass: 'Fetching the kill',
    haul: `Carrying ${c.carcass === 'pig' ? 'a bush pig' : 'an antelope'} home`,
    butcher: 'Butchering',
    craft: 'Forging',
    tend: 'Keeping the shrine',
    flee: 'Running for cover!',
    supervise: (() => {
      const b = c.inspect ? st.byId.get(c.inspect) : null;
      return b && !b.dead ? `Inspecting the ${BUILDINGS[b.type].name.toLowerCase()}` : 'Walking the town';
    })(),
    hide: 'Hiding indoors',
    dress: `Changing into ${TRADE[job?.type] || 'work'} clothes`,
    fetch: (() => {
      const b = st.byId.get(c.buildSite);
      return `Fetching ${b?.mat === 'bricks' ? 'mud bricks' : b?.mat || 'planks'} for the ${b ? BUILDINGS[b.type].name.toLowerCase() : 'building'}`;
    })(),
    tosite: (() => {
      const b = st.byId.get(c.buildSite);
      const what = b ? BUILDINGS[b.type].name.toLowerCase() : 'building';
      return c.carry ? `Carrying ${Math.round(c.carry.n)} ${c.carry.r === 'wood' ? 'planks' : c.carry.r} to the ${what}` : `Going to build the ${what}`;
    })(),
    build: (() => {
      const b = st.byId.get(c.buildSite);
      return `Building the ${b ? BUILDINGS[b.type].name.toLowerCase() : 'house'}`;
    })(),
  };
  return s[c.state] || c.state;
}

export { FOOD };
