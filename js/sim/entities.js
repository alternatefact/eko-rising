// Creating and removing the things that live on the map, plus the message log.

import { BUILDINGS } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { ORIGINS, ORIGIN_WEIGHTS } from '../data/names.js';
import { T, F } from '../world/terrain.js';

export function newId(st) {
  return st.nextId++;
}

export function notify(st, text, kind = 'info', at = null) {
  const entry = { id: newId(st), day: st.time.day, text, kind };
  if (at) {
    entry.x = at.x;
    entry.y = at.y;
  }
  st.log.push(entry);
  if (st.log.length > 80) st.log.shift();
  return entry;
}

// Throttled variant for messages that could otherwise repeat every tick.
export function notifyOnce(st, key, seconds, text, kind, at) {
  const now = st.time.t;
  if (st.throttle[key] && now - st.throttle[key] < seconds) return;
  st.throttle[key] = now;
  notify(st, text, kind, at);
}

// --- Buildings ------------------------------------------------------------

export function createBuilding(st, type, x, y, opts = {}) {
  const def = BUILDINGS[type];
  const b = {
    id: newId(st),
    kind: 'building',
    type,
    owner: opts.owner || 'player',
    x,
    y,
    w: def.w,
    h: def.h,
    hp: def.hp,
    maxHp: def.hp,
    built: opts.instant ? 1 : 0,
    buildTime: 3 + def.w * def.h * 0.7,
    workers: [],
    residents: [],
    priority: 1,
    paused: false,
    growth: 0,
    queue: [],
    trainT: 0,
    craftT: 0,
    cd: 0,
    wall: !!def.wall,
    gate: !!def.gate,
  };
  st.buildings.push(b);
  st.byId.set(b.id, b);
  for (let dy = 0; dy < b.h; dy++) {
    for (let dx = 0; dx < b.w; dx++) {
      const i = (y + dy) * st.W + x + dx;
      st.occ[i] = b.id;
      if (st.trees[i]) {
        st.trees[i] = 0;
        markTile(st, i);
      }
      if (st.terrain[i] === T.FOREST || (def.flat && st.terrain[i] === T.SAVANNA)) {
        st.terrain[i] = T.GRASS;
        markTile(st, i);
      }
      if (st.feature[i] === F.PALM) {
        st.feature[i] = F.NONE;
        markTile(st, i);
      }
    }
  }
  st.dirty.territory = true;
  st.dirty.jobs = true;
  return b;
}

export function removeBuilding(st, b) {
  if (b.dead) return;
  b.dead = true;
  for (let dy = 0; dy < b.h; dy++) {
    for (let dx = 0; dx < b.w; dx++) {
      const i = (b.y + dy) * st.W + b.x + dx;
      if (st.occ[i] === b.id) st.occ[i] = 0;
    }
  }
  for (const id of b.workers) {
    const c = st.byId.get(id);
    if (c) releaseFromJob(st, c);
  }
  for (const id of b.residents) {
    const c = st.byId.get(id);
    if (c) {
      c.home = 0;
      c.stranger = true;
      c.state = 'arrive';
      c.path = null;
      c.homelessDays = 0;
      if (c.job) releaseFromJob(st, c);
    }
  }
  b.workers = [];
  b.residents = [];
  st.dirty.territory = true;
  st.dirty.jobs = true;
  st.dirty.cleanup = true;
}

export function markTile(st, i) {
  st.changedTiles.push(i);
}

export function releaseFromJob(st, c) {
  const b = st.byId.get(c.job);
  if (b) b.workers = b.workers.filter((id) => id !== c.id);
  c.job = 0;
  c.carry = null;
  c.state = 'idle';
  c.path = null;
  c.timer = 0;
  if (c.prey) {
    const a = st.byId.get(c.prey);
    if (a) a.reserved = 0;
    c.prey = 0;
  }
  st.dirty.jobs = true;
}

// --- People -----------------------------------------------------------------

export function pickOrigin(st) {
  const total = ORIGIN_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = st.rng.next() * total;
  for (let k = 0; k < ORIGINS.length; k++) {
    r -= ORIGIN_WEIGHTS[k];
    if (r <= 0) return ORIGINS[k];
  }
  return ORIGINS[0];
}

const CLOTH = ['#2f4a8a', '#1f3b73', '#c0392b', '#e6a417', '#2e8b57', '#8e44ad', '#d35400', '#16a085', '#b03a2e', '#f1c40f', '#6c3483'];

export function createCitizen(st, x, y, opts = {}) {
  const origin = opts.origin || pickOrigin(st);
  const female = opts.female ?? st.rng.chance(0.5);
  const name = opts.name || st.rng.pick(female ? origin.female : origin.male);
  const c = {
    id: newId(st),
    kind: 'citizen',
    owner: 'player',
    name,
    female,
    from: origin.from,
    people: origin.people,
    x: x + 0.5,
    y: y + 0.5,
    px: x + 0.5,
    py: y + 0.5,
    hp: 30,
    maxHp: 30,
    state: opts.state || 'arrive',
    stranger: opts.stranger ?? true,
    home: 0,
    job: 0,
    carry: null,
    path: null,
    pi: 0,
    timer: 0,
    fails: 0,
    cloth: opts.cloth || st.rng.pick(CLOTH),
    wrap: st.rng.pick(CLOTH),
    ox: st.rng.range(-0.22, 0.22),
    oy: st.rng.range(-0.22, 0.22),
    homelessDays: 0,
    special: opts.special || null,
  };
  st.citizens.push(c);
  st.byId.set(c.id, c);
  return c;
}

export function removeCitizen(st, c) {
  if (c.dead) return;
  c.dead = true;
  if (c.job) releaseFromJob(st, c);
  if (c.home) {
    const h = st.byId.get(c.home);
    if (h) h.residents = h.residents.filter((id) => id !== c.id);
  }
  st.dirty.cleanup = true;
  st.dirty.jobs = true;
}

// --- Units ------------------------------------------------------------------

export function createUnit(st, type, x, y, owner, opts = {}) {
  const def = UNITS[type];
  const u = {
    id: newId(st),
    kind: 'unit',
    type,
    owner,
    x: x + 0.5,
    y: y + 0.5,
    px: x + 0.5,
    py: y + 0.5,
    hp: def.hp,
    maxHp: def.hp,
    vision: def.vision,
    cd: 0,
    path: null,
    pi: 0,
    order: opts.order || { t: 'guard', x: x + 0.5, y: y + 0.5 },
    home: opts.home || null,
    leash: opts.leash || 0,
    aggro: opts.aggro || (owner === 'player' ? 5 : 6),
    scanT: st.rng.next() * 0.5,
    repathT: 0,
    ox: st.rng.range(-0.18, 0.18),
    oy: st.rng.range(-0.18, 0.18),
    name: opts.name || null,
    raidStart: st.time.t,
    cloth: opts.cloth || null,
  };
  st.units.push(u);
  st.byId.set(u.id, u);
  return u;
}

export function removeUnit(st, u) {
  if (u.dead) return;
  u.dead = true;
  st.dirty.cleanup = true;
}

// --- Animals ----------------------------------------------------------------

export function createAnimal(st, x, y, type) {
  const a = {
    id: newId(st),
    kind: 'animal',
    type,
    x: x + 0.5,
    y: y + 0.5,
    px: x + 0.5,
    py: y + 0.5,
    hp: 1,
    path: null,
    pi: 0,
    wanderT: st.rng.range(1, 6),
    reserved: 0,
    carcass: false,
    rotT: 0,
    facing: 1,
  };
  st.animals.push(a);
  st.byId.set(a.id, a);
  return a;
}

export function cleanup(st) {
  if (!st.dirty.cleanup) return;
  st.dirty.cleanup = false;
  const keep = (list) => {
    const out = [];
    for (const e of list) {
      if (e.dead) st.byId.delete(e.id);
      else out.push(e);
    }
    return out;
  };
  st.buildings = keep(st.buildings);
  st.citizens = keep(st.citizens);
  st.units = keep(st.units);
  st.animals = keep(st.animals);
}
