// The simulation's front door: start a game, advance it, and the commands
// the interface can issue. Nothing here touches the DOM, so the whole game
// can run headless in a test.

import { REGIONS } from '../regions/index.js';
import { generateWorld, reachable } from '../world/generate.js';
import { T, F, WALK, isWater } from '../world/terrain.js';
import { Rng } from '../core/rng.js';
import { BUILDINGS, nextUpgrade } from '../data/buildings.js';
import { ERAS } from '../data/eras.js';
import { UNITS } from '../data/units.js';
import { ORIGINS } from '../data/names.js';
import { FOOD, GOODS } from '../data/resources.js';
import { createBuilding, createCitizen, removeBuilding, cleanup, notify } from './entities.js';
import { computeTerritory, computeVisibility, revealAround, adjacentToWater } from './world.js';
import {
  DAY, capacity, canAfford, spend, dailyUpkeep, updateHappiness, updateMigration, population,
  hasBuilding, trade as marketTrade,
} from './economy.js';
import { assignJobs, houseStrangers, updateCitizen, dailyCitizens } from './citizens.js';
import { updateAnimal, spawnAnimals, replenishAnimals } from './animals.js';
import { updateUnit, updateTowers, updateTraining, updateShips, updateExpeditions, train as trainUnit, isHostileOwner } from './military.js';
import { initFaction, updateFactions, dailyFactions, updatePois, diplomacy } from './factions.js';
import { checkEvents, objectives, chooseEvent as choose, advanceEra as advance, proclaim as proclaimNation } from './events.js';
import { updatePort, dailyTrade, expireAllies, hire as hireFighter, barter as barterWith, sellToShip, buyFromShip } from './trade.js';

export const STEP = 0.05;

// --- New game -----------------------------------------------------------------

export function newGame(opts = {}) {
  const region = REGIONS[opts.region || 'lagos'];
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const world = generateWorld(region, seed);
  const n = world.W * world.H;
  const st = {
    version: 2,
    regionId: region.id,
    region,
    seed,
    W: world.W,
    H: world.H,
    terrain: world.terrain,
    trees: world.trees,
    feature: world.feature,
    amount: world.amount,
    occ: new Int32Array(n),
    explored: new Uint8Array(n),
    visible: new Uint8Array(n),
    territory: new Uint8Array(n),
    reach: world.reach,
    start: world.start,
    rng: new Rng(seed ^ 0x9e3779b9),
    time: { t: 0, day: 0, dayT: 0, year: ERAS[0].year },
    era: 0,
    res: { ...Object.fromEntries([...FOOD, ...GOODS].map((k) => [k, 0])), yam: 30, wood: 40, cowries: 50 },
    harbour: { ship: null, next: 0, sailing: false },
    tech: {},
    luxury: {},
    marketSold: {},
    cap: { food: 0, goods: 0 },
    buildings: [],
    citizens: [],
    units: [],
    animals: [],
    factions: [],
    factionMap: {},
    pois: [],
    ships: [],
    expeditions: [],
    threats: [],
    fx: [],
    log: [],
    throttle: {},
    eventQueue: [],
    fired: {},
    scheduled: [],
    objDone: {},
    objCurrent: [],
    flags: {},
    foreign: {},
    mods: [],
    bonusHappy: 0,
    happy: 60,
    happyTarget: 60,
    moodT: 0,
    migrateT: 25,
    tax: 1,
    rations: 2,
    hungry: false,
    starveDays: 0,
    foodLow: false,
    stats: {
      explored: 0, oceanSeen: 0, arrived: 0, housed: 0, trained: 0, lost: 0, slain: 0, met: 0, conquered: 0, pois: 0, lastTax: 0,
      made: Object.fromEntries([...FOOD, ...GOODS].map((k) => [k, 0])),
    },
    name: (opts.name || region.defaultName).slice(0, 24),
    founder: (opts.founder || 'Àdìó').slice(0, 20),
    spouse: (opts.spouse || 'Àdùkẹ́').slice(0, 20),
    nextId: 1,
    byId: new Map(),
    dirty: { territory: true, jobs: true, cleanup: false },
    changedTiles: [],
    territoryVersion: 0,
    fogVersion: 0,
    visVersion: 0,
    timers: { sec: 0, vis: 0, animals: 0 },
    animalTarget: Math.floor(n / 230),
    gameOver: null,
  };
  for (const [k, v] of Object.entries(region.foreign)) st.foreign[k] = { name: v.name, color: v.color, hostile: false, trade: false };

  // Home: the compound, a yam field beside it, and the strangers' fire.
  const sx = world.start.x;
  const sy = world.start.y;
  const compound = createBuilding(st, 'compound', sx - 1, sy - 1, { instant: true });
  const farmSpot = findSpot(st, 'farm', sx, sy, 3, 7) || { x: sx + 2, y: sy - 1 };
  const farm = createBuilding(st, 'farm', farmSpot.x, farmSpot.y, { instant: true });
  farm.growth = 0.45;
  const fireSpot = findSpot(st, 'campfire', sx, sy, 6, 10) || { x: sx - 6, y: sy + 3 };
  createBuilding(st, 'campfire', fireSpot.x, fireSpot.y, { instant: true });

  const awori = ORIGINS[0];
  const founder = createCitizen(st, sx, sy + 1, { origin: awori, female: false, name: st.founder, stranger: false, state: 'idle', special: 'founder', cloth: '#2f4a8a' });
  const spouse = createCitizen(st, sx, sy + 1, { origin: awori, female: true, name: st.spouse, stranger: false, state: 'idle', special: 'spouse', cloth: '#c0392b' });
  for (const c of [founder, spouse]) {
    c.home = compound.id;
    compound.residents.push(c.id);
  }
  // The founder is already at work in the field; the wife waits for the
  // player's first building.
  founder.job = farm.id;
  farm.workers.push(founder.id);
  founder.state = 'towork';

  // Someone has already heard about the new farm.
  createCitizen(st, fireSpot.x, fireSpot.y + 2, { state: 'wait' });

  region.factions.forEach((def, k) => initFaction(st, def, world.factionSpots[k]));
  region.pois.forEach((p, k) => {
    st.pois.push({ id: k + 1, kind: p.kind, name: p.name, text: p.text, reward: p.reward, x: world.poiSpots[k].x, y: world.poiSpots[k].y, found: false, claimed: false });
  });

  spawnAnimals(st, st.animalTarget, 9);
  st.cap = capacity(st);
  computeTerritory(st);
  st.dirty.territory = false;
  revealAround(st, sx, sy, 11);
  computeVisibility(st);
  st.mods.push({ label: 'A fresh start on new land', v: 8, until: 30 });
  st.eventQueue.push({ id: 'intro' });
  st.objCurrent = objectives(st).map((o) => o.id);
  return st;
}

function findSpot(st, type, cx, cy, minR, maxR) {
  for (let r = minR; r <= maxR; r++) {
    for (let k = 0; k < 40; k++) {
      const a = st.rng.range(0, Math.PI * 2);
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      if (footprintOk(st, type, x, y, true).ok) return { x, y };
    }
  }
  return null;
}

// --- The loop ------------------------------------------------------------------

export function tick(st, dt = STEP) {
  if (st.gameOver || st.eventQueue.length) return;
  st.time.t += dt;
  st.time.dayT += dt;
  if (st.time.dayT >= DAY) {
    st.time.dayT -= DAY;
    st.time.day++;
    if (st.time.day % 12 === 0) st.time.year++;
    newDay(st);
  }

  for (const b of st.buildings) {
    if (b.built < 1 && !b.dead) {
      b.built += dt / b.buildTime;
      if (b.built >= 1) {
        b.built = 1;
        st.dirty.jobs = true;
        st.dirty.territory = true;
        st.cap = capacity(st);
      }
    }
  }

  st.timers.sec += dt;
  if (st.timers.sec >= 1) {
    st.timers.sec -= 1;
    everySecond(st);
  }
  if (st.dirty.jobs) assignJobs(st);

  st.timers.vis += dt;
  if (st.timers.vis >= 0.4) {
    st.timers.vis = 0;
    computeVisibility(st);
  }

  for (const c of st.citizens) if (!c.dead) updateCitizen(st, c, dt);
  for (const a of st.animals) if (!a.dead) updateAnimal(st, a, dt);
  for (const u of st.units) if (!u.dead) updateUnit(st, u, dt);
  updateTowers(st, dt);
  updateTraining(st, dt);
  updateShips(st, dt);
  updateHappiness(st, dt);
  updateMigration(st, dt);

  for (const f of st.fx) f.t += dt;
  if (st.fx.length) st.fx = st.fx.filter((f) => f.t < f.dur + 0.15);

  if (st.dirty.territory) {
    st.dirty.territory = false;
    computeTerritory(st);
  }
  cleanup(st);
}

// Where hostile fighters are, so townsfolk know when to run.
function computeThreats(st) {
  st.threats = [];
  for (const u of st.units) {
    if (u.dead || !isHostileOwner(st, 'player', u.owner)) continue;
    const i = Math.floor(u.y) * st.W + Math.floor(u.x);
    if (st.territory[i] === 1 || st.explored[i]) st.threats.push({ x: u.x, y: u.y });
  }
}

function everySecond(st) {
  st.cap = capacity(st);
  computeThreats(st);
  for (const b of st.buildings) {
    if (b.owner === 'player' && b.built >= 1 && b.hp < b.maxHp && st.time.t - (b.hitT || 0) > 12) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.02);
  }
  // Soldiers near a hospital are patched up.
  const hospital = st.buildings.find((b) => b.type === 'hospital' && b.owner === 'player' && !b.dead && b.built >= 1);
  if (hospital) {
    for (const u of st.units) {
      if (u.owner === 'player' && !u.dead && u.hp < u.maxHp && Math.hypot(u.x - hospital.x - 1.5, u.y - hospital.y - 1.5) < 7) u.hp = Math.min(u.maxHp, u.hp + 4);
    }
  }
  houseStrangers(st);
  st.dirty.jobs = true;
  updatePort(st);
  expireAllies(st);
  updateFactions(st, 1);
  updatePois(st);
  updateExpeditions(st);
  checkEvents(st);
  st.objCurrent = objectives(st).map((o) => o.id);
  st.timers.animals += 1;
  if (st.timers.animals >= 20) {
    st.timers.animals = 0;
    replenishAnimals(st);
  }
  checkDefeat(st);
}

function newDay(st) {
  dailyUpkeep(st);
  dailyCitizens(st);
  dailyFactions(st);
  dailyTrade(st);
}

function checkDefeat(st) {
  if (st.gameOver) return;
  const seat = st.buildings.some((b) => (b.type === 'compound' || b.type === 'palace') && !b.dead);
  if (!seat) {
    st.gameOver = { victory: false, reason: 'Your compound has been burned to the ground.' };
    return;
  }
  if (population(st) === 0 && !st.citizens.some((c) => !c.dead)) {
    st.gameOver = { victory: false, reason: 'Everyone has left. The land is empty again.' };
  }
}

// --- Building placement ------------------------------------------------------------

function footprintOk(st, type, x, y, ignoreTerritory) {
  const def = BUILDINGS[type];
  const W = st.W;
  let shore = false;
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 1 || ty < 1 || tx >= W - 1 || ty >= st.H - 1) return { ok: false, reason: 'Too close to the edge of the map.' };
      const i = ty * W + tx;
      if (!st.explored[i] && !ignoreTerritory) return { ok: false, reason: 'You have not explored there.' };
      if (!ignoreTerritory && st.territory[i] !== 1) {
        return { ok: false, reason: st.territory[i] === 2 ? 'That land belongs to another people.' : 'Outside your territory. Expand with a palace, towers or war camps.' };
      }
      if (st.occ[i]) return { ok: false, reason: 'Something is already built there.' };
      const t = st.terrain[i];
      if (isWater(t) || t === T.FORD) return { ok: false, reason: 'You cannot build on water.' };
      if (t === T.MANGROVE && def.place !== 'shore') return { ok: false, reason: 'Too swampy. Only jetties and canoe yards sit in the mangroves.' };
      if (st.feature[i] === F.ROCK || st.feature[i] === F.IRON) return { ok: false, reason: 'Rock is in the way.' };
      if (def.place === 'fertile' && !(t === T.GRASS || t === T.SAVANNA || t === T.FOREST)) return { ok: false, reason: 'Yams need fertile soil.' };
      if (adjacentToWater(st, i)) shore = true;
    }
  }
  if (def.place === 'shore' && !shore) return { ok: false, reason: 'Must be built at the water’s edge.' };
  const cx = Math.floor(x + def.w / 2);
  const cy = Math.floor(y + def.h / 2);
  const near = (feat, r) => {
    let n = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const tx = cx + dx;
        const ty = cy + dy;
        if (tx < 0 || ty < 0 || tx >= W || ty >= st.H) continue;
        if (st.feature[ty * W + tx] === feat) n++;
      }
    }
    return n;
  };
  if (def.place === 'rock' && !near(F.ROCK, def.near)) return { ok: false, reason: 'Must be near rocky outcrops.' };
  if (def.place === 'iron' && !near(F.IRON, def.near)) return { ok: false, reason: 'Must be built on an iron deposit your scouts found.' };
  if (def.place === 'palm' && near(F.PALM, def.near) < 3) return { ok: false, reason: 'Needs a grove of palm trees nearby.' };
  return { ok: true };
}

export function buildLocked(st, type) {
  const def = BUILDINGS[type];
  if (!def || def.buildable === false) return 'Cannot be built.';
  if ((def.era || 0) > st.era) return `Unlocks in the ${ERAS[def.era].name} era.`;
  if (def.requires === 'europeanTrade' && !st.flags.europeanTrade) return 'Needs trade with the ships from across the sea.';
  if (def.unique && st.buildings.some((b) => b.type === type && b.owner === 'player' && !b.dead)) return 'You can only build one.';
  return null;
}

export function canPlace(st, type, x, y) {
  const locked = buildLocked(st, type);
  if (locked) return { ok: false, reason: locked };
  const fp = footprintOk(st, type, x, y, false);
  if (!fp.ok) return fp;
  if (!canAfford(st, BUILDINGS[type].cost)) return { ok: false, reason: 'Not enough resources.', fits: true };
  return { ok: true };
}

export function placeBuilding(st, type, x, y) {
  const can = canPlace(st, type, x, y);
  if (!can.ok) return can;
  spend(st, BUILDINGS[type].cost);
  const b = createBuilding(st, type, x, y);
  st.stats.built = (st.stats.built || 0) + 1;
  return { ok: true, building: b };
}

export function lineTiles(x0, y0, x1, y1) {
  const out = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 200; guard++) {
    out.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    // Step one axis at a time so walls stay closed (no diagonal gaps).
    if (e2 >= dy && x !== x1) {
      err += dy;
      x += sx;
    } else if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}

export function placeLine(st, type, x0, y0, x1, y1) {
  let placed = 0;
  let reason = null;
  for (const [x, y] of lineTiles(x0, y0, x1, y1)) {
    const r = placeBuilding(st, type, x, y);
    if (r.ok) placed++;
    else if (!reason && !(r.reason || '').startsWith('Something')) reason = r.reason;
  }
  return { ok: placed > 0, placed, reason };
}

export function demolish(st, id) {
  const b = st.byId.get(id);
  if (!b || b.owner !== 'player') return { ok: false };
  if (b.type === 'compound' || b.type === 'campfire') return { ok: false, reason: 'This cannot be pulled down.' };
  const cost = BUILDINGS[b.type].cost;
  for (const [k, v] of Object.entries(cost)) if (k !== 'food') st.res[k] += Math.floor(v * (b.built >= 1 ? 0.4 : 1));
  removeBuilding(st, b);
  return { ok: true };
}

export function setPriority(st, id, p) {
  const b = st.byId.get(id);
  if (!b) return;
  b.priority = Math.max(0, Math.min(2, p));
  st.dirty.jobs = true;
}

export function togglePause(st, id) {
  const b = st.byId.get(id);
  if (!b) return;
  b.paused = !b.paused;
  if (b.paused) {
    for (const cid of [...b.workers]) {
      const c = st.byId.get(cid);
      if (c) {
        b.workers = b.workers.filter((w) => w !== c.id);
        c.job = 0;
        c.carry = null;
        c.state = 'idle';
        c.path = null;
      }
    }
  }
  st.dirty.jobs = true;
}

// --- Orders ------------------------------------------------------------------------

export function orderMove(st, ids, tx, ty, fight = true) {
  const units = ids.map((id) => st.byId.get(id)).filter((u) => u && !u.dead && u.owner === 'player');
  const cols = Math.ceil(Math.sqrt(units.length));
  units.forEach((u, k) => {
    const ox = (k % cols) - (cols - 1) / 2;
    const oy = Math.floor(k / cols) - (cols - 1) / 2;
    u.order = { t: fight && u.type !== 'scout' ? 'amove' : 'move', x: tx + ox * 0.9, y: ty + oy * 0.9 };
    u.path = null;
  });
  return units.length;
}

export function orderAttack(st, ids, targetId) {
  const target = st.byId.get(targetId);
  if (!target) return { ok: false };
  const f = st.factionMap[target.owner];
  if (f && (f.status === 'allied' || f.status === 'vassal')) {
    return { ok: false, reason: `The ${f.name} are bound to you. Break the bond from the Peoples panel first.` };
  }
  for (const id of ids) {
    const u = st.byId.get(id);
    if (!u || u.dead || u.owner !== 'player') continue;
    u.order = { t: 'attack', target: targetId };
    u.path = null;
  }
  return { ok: true };
}

export function train(st, buildingId, type) {
  const b = st.byId.get(buildingId);
  if (!b) return { ok: false };
  return trainUnit(st, b, type);
}

export function setTax(st, v) {
  st.tax = Math.max(0, Math.min(3, v));
}

export function setRations(st, v) {
  st.rations = Math.max(0, Math.min(3, v));
}

// Grow a building to its next level: a hut into a mud-brick house, and so on.
export function canUpgrade(st, id) {
  const b = st.byId.get(id);
  if (!b || b.owner !== 'player' || b.dead) return { ok: false };
  const up = nextUpgrade(b);
  if (!up) return { ok: false, reason: 'Fully upgraded.' };
  if (b.built < 1) return { ok: false, reason: 'Still being built.' };
  if (up.era > st.era) return { ok: false, reason: `Needs the ${ERAS[up.era].name} age.`, up };
  if (!canAfford(st, up.cost)) return { ok: false, reason: 'Not enough resources.', up };
  return { ok: true, up };
}

export function upgradeBuilding(st, id) {
  const can = canUpgrade(st, id);
  if (!can.ok) return can;
  const b = st.byId.get(id);
  spend(st, can.up.cost);
  b.level = (b.level || 1) + 1;
  b.maxHp = Math.round(b.maxHp * 1.5);
  b.hp = b.maxHp;
  b.built = 0.6;
  st.dirty.jobs = true;
  st.stats.upgrades = (st.stats.upgrades || 0) + 1;
  notify(st, `🏗️ Upgrading to ${can.up.name}.`, 'good', { x: b.x + b.w / 2, y: b.y + b.h / 2 });
  return { ok: true };
}

export const hire = hireFighter;
export const barter = barterWith;
export const shipSell = sellToShip;
export const shipBuy = buyFromShip;
export const trade = marketTrade;
export const diplo = diplomacy;
export const chooseEvent = choose;
export const advanceEra = advance;
export const proclaim = proclaimNation;

// --- Saving -------------------------------------------------------------------------

const TYPED = ['terrain', 'trees', 'feature', 'amount', 'occ', 'explored'];

function toB64(arr) {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(str, Ctor) {
  const s = atob(str);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Ctor(bytes.buffer);
}

export function serialize(st) {
  // Derived or display-only fields are rebuilt on load.
  const skip = new Set(['region', 'byId', 'factionMap', 'fx', 'reach', 'visible', 'territory', 'rng', 'changedTiles', 'threats', 'dirty', 'territoryVersion', 'fogVersion', 'visVersion', ...TYPED]);
  const out = {};
  for (const [k, v] of Object.entries(st)) if (!skip.has(k)) out[k] = v;
  out.rngState = st.rng.s;
  out.arrays = Object.fromEntries(TYPED.map((k) => [k, toB64(st[k])]));
  return JSON.stringify(out);
}

const CTOR = { terrain: Uint8Array, trees: Uint8Array, feature: Uint8Array, amount: Uint16Array, occ: Int32Array, explored: Uint8Array };

export function deserialize(json) {
  const data = JSON.parse(json);
  const region = REGIONS[data.regionId];
  if (!region || data.version !== 2) throw new Error('This save is from an older version of the game. Please start a new game.');
  const st = { ...data };
  delete st.arrays;
  delete st.rngState;
  st.region = region;
  for (const k of TYPED) st[k] = fromB64(data.arrays[k], CTOR[k]);
  const n = st.W * st.H;
  st.visible = new Uint8Array(n);
  st.territory = new Uint8Array(n);
  st.reach = reachable(st.terrain, st.W, st.H, st.start.x, st.start.y);
  st.rng = new Rng(0);
  st.rng.s = data.rngState >>> 0;
  st.fx = [];
  st.threats = [];
  st.changedTiles = [];
  st.byId = new Map();
  for (const list of [st.buildings, st.citizens, st.units, st.animals]) for (const e of list) st.byId.set(e.id, e);
  st.factionMap = {};
  for (const f of st.factions) st.factionMap[f.id] = f;
  st.dirty = { territory: false, jobs: false, cleanup: false };
  st.territoryVersion = 0;
  st.fogVersion = 0;
  st.visVersion = 0;
  computeTerritory(st);
  computeVisibility(st);
  computeThreats(st);
  st.cap = capacity(st);
  return st;
}

export { BUILDINGS, UNITS, ERAS, population, hasBuilding, WALK };
