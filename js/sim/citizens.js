// What your people do all day. Strangers walk in and wait at the fire (or
// the town square). Free beds pull them into homes; free jobs pull residents
// to work. Each job is a little loop: walk out, gather, bring it back, carry
// it to the nearest store.

import { BUILDINGS, STORAGE_FOR, stat } from '../data/buildings.js';
import { RESOURCES, FOOD } from '../data/resources.js';
import { F, T, WALK, isWater } from '../world/terrain.js';
import { findNear, adjacentToWater } from './world.js';
import { goTo, stepMove, wander } from './move.js';
import { notify, notifyOnce, releaseFromJob, removeCitizen, markTile } from './entities.js';
import { addRes, roomFor, gatheringPoint, season, totalFood, population, DAY } from './economy.js';

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

export function houseStrangers(st) {
  // Guests (newcomers the story introduces) wait to be welcomed first.
  const waiting = st.citizens.filter((c) => c.stranger && !c.dead && !c.guest && (c.state === 'wait' || c.state === 'arrive'));
  if (!waiting.length) return;
  for (const b of st.buildings) {
    if (b.owner !== 'player' || b.built < 1 || b.dead) continue;
    const cap = BUILDINGS[b.type].housing ? stat(b, 'housing') : 0;
    if (b.residents.length >= cap || !waiting.length) continue;
    // Nearest waiting stranger takes the bed.
    const p = at(b);
    let best = 0;
    let bestD = Infinity;
    waiting.forEach((c, k) => {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    const c = waiting.splice(best, 1)[0];
    c.stranger = false;
    c.home = b.id;
    c.homelessDays = 0;
    b.residents.push(c.id);
    c.state = 'movein';
    walkTo(st, c, p.x, p.y);
    st.dirty.jobs = true;
    if (st.stats.housed++ < 6 || st.rng.chance(0.3)) {
      notify(st, `🏠 ${c.name} moved into the ${BUILDINGS[b.type].name.toLowerCase()}.`, 'good', c);
    }
  }
}

// A newcomer the household has welcomed moves into the compound.
export function takeIn(st, c) {
  const home = st.buildings.find((b) => b.type === 'compound' && b.owner === 'player' && !b.dead);
  if (!c || c.dead || !home) return;
  c.guest = false;
  c.stranger = false;
  c.home = home.id;
  c.homelessDays = 0;
  if (!home.residents.includes(c.id)) home.residents.push(c.id);
  c.state = 'movein';
  const p = at(home);
  walkTo(st, c, p.x, p.y);
  st.dirty.jobs = true;
}

// --- Jobs ------------------------------------------------------------------

function isFoodJob(b) {
  const job = BUILDINGS[b.type].job;
  return job && RESOURCES[job.product]?.kind === 'food';
}

// Player priority (0 low, 1 normal, 2 high), plus a nudge toward food when
// stores run low (or once the household has gone hungry). Workers leave
// lower-priority work to fill higher.
export function effPriority(st, b) {
  let p = b.priority * 2;
  if (isFoodJob(b) && (st.foodLow || st.flags.feedFirst)) p += 1;
  return p;
}

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

  // The founder and his wife run the household; everyone else works.
  const idle = st.citizens.filter((c) => !c.stranger && !c.dead && !c.job && !c.special && (c.state === 'idle' || c.state === 'movein'));
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
    while (s.free > 0) {
      let worker = null;
      if (idle.length) {
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
        worker = idle.splice(k, 1)[0];
      } else {
        worker = poach(st, s.pri, s.b);
        if (!worker) break;
      }
      startJob(st, worker, s.b);
      s.free--;
    }
  }
}

// Someone working at a lower-priority building leaves for this one.
function poach(st, pri, target) {
  let from = null;
  let low = pri;
  for (const b of st.buildings) {
    if (b.owner !== 'player' || b.dead || !b.workers.length || b === target) continue;
    const p = effPriority(st, b);
    if (p < low) {
      low = p;
      from = b;
    }
  }
  if (!from) return null;
  const c = st.byId.get(from.workers[from.workers.length - 1]);
  // Nobody is called away in the middle of fighting for their life.
  if (!c || c.state === 'fight' || c.state === 'attacked') return null;
  notifyOnce(
    st,
    `poach-${target.type}`,
    20,
    `🔁 ${c.name} left the ${BUILDINGS[from.type].name.toLowerCase()} to work at the ${BUILDINGS[target.type].name.toLowerCase()}.`,
    'info',
    c,
  );
  releaseFromJob(st, c);
  return c;
}

function startJob(st, c, b) {
  c.job = b.id;
  b.workers.push(c.id);
  c.state = 'towork';
  c.carry = null;
  c.timer = 0;
  const p = at(b);
  walkTo(st, c, p.x, p.y);
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
  }
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

function findSource(st, b, job) {
  const p = at(b);
  return findNear(st, Math.floor(p.x), Math.floor(p.y), job.radius, sourcePred(st, job.source), job.source === 'water' ? 4 : 3);
}

function takeFromSource(st, i, job) {
  if (job.source === 'tree') {
    const n = Math.min(job.yield, st.trees[i]);
    st.trees[i] -= n;
    if (st.trees[i] === 0) {
      if (st.terrain[i] === T.FOREST) st.terrain[i] = T.GRASS;
      markTile(st, i);
    } else if (st.trees[i] % 10 < n) {
      markTile(st, i);
    }
    return n;
  }
  if (job.source === 'water') return Math.round(job.yield * (st.tech.nets ? 1.5 : 1));
  const n = Math.min(job.yield, st.amount[i]);
  st.amount[i] -= n;
  if (st.amount[i] === 0 && job.source !== 'palm') {
    st.feature[i] = F.NONE;
    markTile(st, i);
  }
  return n;
}

const SOURCE_NAME = { tree: 'trees', rock: 'rock', iron: 'iron ore', palm: 'ripe palm trees', water: 'open water', clay: 'red mud' };

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

export function resume(st, c) {
  c.hidden = false;
  c.path = null;
  if (c.stranger) c.state = 'arrive';
  else if (!c.job) c.state = 'idle';
  else if (c.carry) headToStore(st, c);
  else {
    c.state = 'towork';
    const job = st.byId.get(c.job);
    if (job) walkTo(st, c, job.x + job.w / 2, job.y + job.h / 2);
  }
}

export function updateCitizen(st, c, dt) {
  c.px = c.x;
  c.py = c.y;
  const speed = c.carry ? CARRY_SPEED : WALK_SPEED;
  const job = c.job ? st.byId.get(c.job) : null;
  if (c.job && (!job || job.dead)) {
    releaseFromJob(st, c);
    return;
  }
  const def = job ? BUILDINGS[job.type].job : null;

  if (c.special) {
    if (c.job) {
      releaseFromJob(st, c);
      return;
    }
    if (c.special === 'founder' && (c.state === 'idle' || c.state === 'movein')) {
      c.state = 'supervise';
      c.timer = 0;
    }
  }

  // Townsfolk run for cover when a war band comes near.
  if (st.threats.length && c.state !== 'flee' && c.state !== 'hide' && c.state !== 'leave') {
    c.threatT = (c.threatT || 0) - dt;
    if (c.threatT <= 0) {
      c.threatT = 0.5;
      if (nearThreat(st, c, 6)) {
        const shelter = shelterFor(st, c);
        if (shelter) {
          if (c.prey) {
            const a = st.byId.get(c.prey);
            if (a) a.reserved = 0;
            c.prey = 0;
          }
          c.state = 'flee';
          walkTo(st, c, shelter.x + shelter.w / 2, shelter.y + shelter.h / 2);
          return;
        }
      }
    }
  }

  switch (c.state) {
    case 'supervise':
      supervise(st, c, dt);
      return;
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
        if (nearThreat(st, c, 8)) c.timer = 3;
        else resume(st, c);
      }
      return;
    }

    case 'arrive': {
      const gp = gatheringPoint(st);
      if (!c.path) {
        if (Math.hypot(c.x - gp.x, c.y - gp.y) < 3) {
          c.state = 'wait';
          c.timer = st.rng.range(1, 4);
        } else if (!walkTo(st, c, gp.x + st.rng.range(-1.5, 1.5), gp.y + st.rng.range(-1, 1.5), { max: 6000 })) {
          if (c.fails > 3) removeCitizen(st, c);
        }
        return;
      }
      stepMove(st, c, dt, WALK_SPEED);
      return;
    }

    case 'wait': {
      if (c.path) {
        stepMove(st, c, dt, WALK_SPEED * 0.6);
        return;
      }
      c.timer -= dt;
      if (c.timer <= 0) {
        c.timer = st.rng.range(4, 10);
        const gp = gatheringPoint(st);
        if (Math.hypot(c.x - gp.x, c.y - gp.y) > 6) c.state = 'arrive';
        else wander(st, c, gp.x, gp.y, 2.5);
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
      if (c.path) {
        stepMove(st, c, dt, WALK_SPEED * 0.6);
        return;
      }
      c.timer -= dt;
      if (c.timer <= 0) {
        c.timer = st.rng.range(5, 12);
        const home = st.byId.get(c.home);
        const gp = gatheringPoint(st);
        const anchor = gp.town ? gp : home ? at(home) : gp;
        wander(st, c, anchor.x, anchor.y, 3);
      }
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
      c.timer -= dt;
      if (c.timer > 0) return;
      const src = findSource(st, job, def);
      if (src < 0) {
        c.status = `No ${SOURCE_NAME[def.source]} nearby`;
        notifyOnce(st, `nosrc-${job.id}`, 90, `🔎 The ${BUILDINGS[job.type].name.toLowerCase()} has no ${SOURCE_NAME[def.source]} in reach.`, 'bad', at(job));
        c.timer = 5;
        return;
      }
      c.status = '';
      c.src = src;
      c.state = 'tosource';
      if (!walkTo(st, c, src % st.W, Math.floor(src / st.W), { within: def.source === 'tree' ? 1.5 : 0 })) {
        c.state = 'seek';
        c.timer = 2;
      }
      return;
    }
    case 'tosource': {
      if (stepMove(st, c, dt, speed)) {
        if (!sourcePred(st, def.source)(c.src)) {
          c.state = 'seek';
          c.timer = 0.2;
          return;
        }
        c.state = 'gather';
        // Imported iron tools speed up every hand that cuts, digs or picks.
        c.timer = (def.work * (st.tech.tools && def.source !== 'water' ? 0.75 : 1)) / (supervised(st, c) ? SUPERVISE_BONUS : 1);
      }
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

    // --- hunting ---
    case 'stalk': {
      const prey = st.byId.get(c.prey);
      if (!prey || prey.dead) {
        c.prey = 0;
        c.state = 'hunt';
        c.timer = 0.5;
        return;
      }
      const d = Math.hypot(prey.x - c.x, prey.y - c.y);
      if (d < 4.5) {
        c.state = 'shoot';
        c.timer = 1.2;
        c.path = null;
        return;
      }
      c.timer -= dt;
      if (!c.path || c.timer <= 0) {
        c.timer = 2;
        if (!walkTo(st, c, prey.x, prey.y, { within: 3 })) {
          prey.reserved = 0;
          c.prey = 0;
          c.state = 'hunt';
          c.timer = 3;
          return;
        }
      }
      stepMove(st, c, dt, WALK_SPEED * 1.1);
      return;
    }
    case 'hunt': {
      c.timer -= dt;
      if (c.timer > 0) return;
      const lodge = at(job);
      let best = null;
      let bestD = def.radius;
      for (const a of st.animals) {
        if (a.dead || a.carcass || a.type === 'wolf' || (a.reserved && a.reserved !== c.id)) continue;
        const d = Math.hypot(a.x - lodge.x, a.y - lodge.y);
        if (d < bestD) {
          bestD = d;
          best = a;
        }
      }
      if (!best) {
        c.status = 'No game nearby';
        notifyOnce(st, `nogame-${job.id}`, 90, '🦌 Your hunter can find no game. Build lodges near forest and savanna.', 'bad', lodge);
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
    case 'shoot': {
      c.timer -= dt;
      if (c.timer > 0) return;
      const prey = st.byId.get(c.prey);
      if (!prey || prey.dead) {
        c.state = 'hunt';
        return;
      }
      st.fx.push({ kind: 'arrow', x0: c.x, y0: c.y, x1: prey.x, y1: prey.y, t: 0, dur: 0.35 });
      prey.carcass = true;
      prey.path = null;
      c.state = 'tocarcass';
      walkTo(st, c, prey.x, prey.y, { within: 1 });
      return;
    }
    case 'tocarcass': {
      if (stepMove(st, c, dt, WALK_SPEED)) {
        c.state = 'butcher';
        c.timer = def.work + 1;
      }
      return;
    }
    case 'butcher': {
      c.timer -= dt;
      if (c.timer > 0) return;
      const prey = st.byId.get(c.prey);
      if (prey) {
        prey.dead = true;
        st.dirty.cleanup = true;
      }
      c.prey = 0;
      c.carry = { r: def.product, n: def.yield };
      c.state = 'return';
      const p = at(job);
      if (!walkTo(st, c, p.x, p.y)) headToStore(st, c);
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
      c.state = 'hunt';
      c.timer = 0;
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
  if (def.type === 'gather') {
    c.state = 'seek';
    c.timer = 0;
  } else {
    c.state = 'towork';
    const p = at(job);
    walkTo(st, c, p.x, p.y);
  }
}

// --- Homeless residents and the strangers who give up ---------------------------

export function dailyCitizens(st) {
  for (const c of st.citizens) {
    if (c.dead || !c.stranger || c.state === 'leave') continue;
    c.homelessDays++;
    // Strangers who wait too long for a home move on.
    if (c.homelessDays > 6 && st.rng.chance(0.35)) {
      c.state = 'leave';
      const a = st.rng.range(0, Math.PI * 2);
      if (!goTo(st, c, c.x + Math.cos(a) * 24, c.y + Math.sin(a) * 24, { partial: true, max: 3000 })) removeCitizen(st, c);
      notifyOnce(st, 'gaveup', DAY, `🚶 ${c.name} grew tired of waiting for a home and moved on. Build more huts.`, 'bad');
    }
  }
}

export function citizenStatus(st, c) {
  if (c.status) return c.status;
  const job = c.job ? st.byId.get(c.job) : null;
  const s = {
    arrive: 'Walking to the fire',
    wait: gatheringPoint(st).town ? 'Waiting in the town square for a home' : 'Waiting at the fire for a home',
    movein: 'Moving into a new home',
    idle: c.special === 'spouse' ? 'Keeping the household' : 'Looking for work',
    attacked: 'Attacked by a wolf!',
    fight: 'Fighting off a wolf!',
    leave: 'Leaving for good',
    towork: `Going to the ${job ? BUILDINGS[job.type].name.toLowerCase() : 'work'}`,
    stuck: 'Cannot find a way',
    seek: 'Looking for a source',
    tosource: 'Heading out',
    gather: job?.type === 'brickyard' ? 'Digging red mud' : job?.type === 'woodcutter' ? 'Felling a tree' : 'Working',
    return: 'Bringing it back',
    process: job?.type === 'woodcutter' ? 'Splitting logs into planks' : job?.type === 'brickyard' ? 'Moulding mud bricks' : 'Preparing goods',
    tostore: `Carrying ${c.carry ? RESOURCES[c.carry.r].name.toLowerCase() : 'it'} to the ${job && st.byId.get(c.storeId)?.type === 'stockpile' ? 'storage floor' : 'store'}`,
    storewait: 'Waiting for storage space',
    farm: 'Tending the yam mounds',
    harvest: 'Harvesting',
    hunt: 'Searching for game',
    stalk: 'Stalking game',
    shoot: 'Taking aim',
    tocarcass: 'Fetching the kill',
    butcher: 'Butchering',
    craft: 'Forging',
    tend: 'Keeping the shrine',
    flee: 'Running for cover!',
    supervise: (() => {
      const b = c.inspect ? st.byId.get(c.inspect) : null;
      return b && !b.dead ? `Inspecting the ${BUILDINGS[b.type].name.toLowerCase()}` : 'Walking the town';
    })(),
    hide: 'Hiding from raiders',
  };
  return s[c.state] || c.state;
}

export { FOOD };
