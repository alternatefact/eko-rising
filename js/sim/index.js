// The simulation's front door: start a game, advance it, and the commands
// the interface can issue. Nothing here touches the DOM, so the whole game
// can run headless in a test.

import { REGIONS } from '../regions/index.js';
import { generateWorld, reachable } from '../world/generate.js';
import { T, F, WALK, TREE, isWater, treePlanks } from '../world/terrain.js';
import { Rng } from '../core/rng.js';
import { BUILDINGS, nextUpgrade, costOf, mudBricksFor, materialsOf, buildWork } from '../data/buildings.js';
import { ERAS } from '../data/eras.js';
import { UNITS } from '../data/units.js';
import { ORIGINS } from '../data/names.js';
import { FOOD, GOODS } from '../data/resources.js';
import { createBuilding, createCitizen, createUnit, removeBuilding, cleanup, notify } from './entities.js';
import { goTo } from './move.js';
import { computeTerritory, computeVisibility, revealAround, adjacentToWater, fenceGaps } from './world.js';
import {
  DAY, capacity, canAfford, spend, dailyUpkeep, updateHappiness, updateMigration, population,
  hasBuilding, trade as marketTrade, invite, addMood,
} from './economy.js';
import {
  assignJobs, assignBuilders, houseHomeless, updateCitizen, dailyCitizens, assignTo, assignBuilder as builderOrder,
  orderTree as treeOrder, orderWalk as walkOrder,
} from './citizens.js';
import { updateStory, tutSignal } from './story.js';
import { updateAnimal, spawnAnimals, replenishAnimals } from './animals.js';
import { updateUnit, updateTowers, updateTraining, updateShips, updateExpeditions, train as trainUnit, isHostileOwner } from './military.js';
import { initFaction, updateFactions, dailyFactions, updatePois, diplomacy } from './factions.js';
import { checkEvents, objectives, chooseEvent as choose, advanceEra as advance, proclaim as proclaimNation } from './events.js';
import { SAVE_VERSION, migrate } from './migrate.js';
import { updatePort, dailyTrade, expireAllies, hire as hireFighter, barter as barterWith, sellToShip, buyFromShip } from './trade.js';

export const STEP = 0.05;

// Game seconds per real second at "1×": the world moves at a walking pace.
export const PACE = 0.6;

// --- New game -----------------------------------------------------------------

export function newGame(opts = {}) {
  const region = REGIONS[opts.region || 'lagos'];
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const world = generateWorld(region, seed);
  const n = world.W * world.H;
  const st = {
    version: SAVE_VERSION,
    regionId: region.id,
    region,
    seed,
    W: world.W,
    H: world.H,
    terrain: world.terrain,
    trees: world.trees,
    felled: new Uint8Array(n),
    feature: world.feature,
    amount: world.amount,
    occ: new Int32Array(n),
    explored: new Uint8Array(n),
    visible: new Uint8Array(n),
    territory: new Uint8Array(n),
    reach: world.reach,
    start: world.start,
    arrival: world.arrival,
    mudPit: world.mudPit,
    rng: new Rng(seed ^ 0x9e3779b9),
    time: { t: 0, day: 0, dayT: 0, year: ERAS[0].year },
    era: 0,
    res: { ...Object.fromEntries([...FOOD, ...GOODS].map((k) => [k, 0])), yam: 24, cowries: 50 },
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
    dirty: { territory: true, jobs: true, cleanup: false, reach: false, build: false },
    changedTiles: [],
    territoryVersion: 0,
    fogVersion: 0,
    visVersion: 0,
    timers: { sec: 0, vis: 0, animals: 0 },
    animalTarget: Math.floor(n / 230),
    gameOver: null,
  };
  for (const [k, v] of Object.entries(region.foreign)) st.foreign[k] = { name: v.name, color: v.color, hostile: false, trade: false };

  // Home: an abandoned house in a clearing, a swept storage floor in front
  // of it with what the couple carried here, and a fire for those who come
  // after them.
  const sx = world.start.x;
  const sy = world.start.y;
  const compound = createBuilding(st, 'compound', sx - 1, sy - 1, { instant: true });
  // In Lagos the house is a wreck: the roof has fallen in and a wall is down.
  // Its old roof timbers lie stacked on the floor, enough to mend it.
  if (region.wreckedStart) {
    compound.wrecked = true;
    compound.hp = Math.round(compound.maxHp * 0.3);
    for (const [k, v] of Object.entries(BUILDINGS.compound.wreckCost)) st.res[k] += v;
  }
  const floorSpot = [[sx - 1, sy + 3], [sx, sy + 3], [sx + 3, sy], [sx - 4, sy], [sx - 1, sy - 4]].map(([x, y]) => ({ x, y })).find((p) => footprintOk(st, 'stockpile', p.x, p.y, true).ok)
    || findSpot(st, 'stockpile', sx, sy, 3, 6) || { x: sx - 1, y: sy + 3 };
  createBuilding(st, 'stockpile', floorSpot.x, floorSpot.y, { instant: true });
  const fireSpot = findSpot(st, 'campfire', sx, sy, 4, 6) || findSpot(st, 'campfire', sx, sy, 3, 8) || { x: sx - 5, y: sy + 3 };
  createBuilding(st, 'campfire', fireSpot.x, fireSpot.y, { instant: true });

  // Just the two of them, walking in up the path. Strangers come later (see
  // the region's story).
  const awori = ORIGINS[0];
  const way = world.arrival.length ? world.arrival[Math.min(world.arrival.length - 1, 9)] : sy * st.W + sx;
  const ax = way % st.W;
  const ay = Math.floor(way / st.W);
  const founder = createCitizen(st, ax, ay, { origin: awori, female: false, name: st.founder, stranger: false, state: 'movein', special: 'founder', cloth: '#2f4a8a' });
  const spouse = createCitizen(st, ax, ay, { origin: awori, female: true, name: st.spouse, stranger: false, state: 'movein', special: 'spouse', cloth: '#c0392b' });
  for (const c of [founder, spouse]) {
    c.home = compound.id;
    compound.residents.push(c.id);
  }
  spouse.x -= 0.6;
  goTo(st, founder, sx + 0.5, sy + 2.5, { max: 4000 });
  goTo(st, spouse, sx - 0.5, sy + 2.5, { max: 4000 });
  st.flags.opening = true;
  st.tut = { i: 0, entered: false, t: 0 };

  region.factions.forEach((def, k) => initFaction(st, def, world.factionSpots[k]));
  region.pois.forEach((p, k) => {
    st.pois.push({ id: k + 1, kind: p.kind, name: p.name, text: p.text, reward: p.reward, x: world.poiSpots[k].x, y: world.poiSpots[k].y, found: false, claimed: false });
  });

  spawnAnimals(st, st.animalTarget, 13);
  // No guide: a player who knows the game (or a land with no guided start)
  // builds whatever they think matters first.
  if (opts.guide === false || !region.story?.length) freeStart(st, region, compound);
  st.cap = capacity(st);
  computeTerritory(st);
  st.dirty.territory = false;
  revealAround(st, sx, sy, 10);
  for (const i of world.arrival.slice(0, 10)) revealAround(st, i % st.W, Math.floor(i / st.W), 3);
  computeVisibility(st);
  st.mods.push({ label: 'A fresh start on new land', v: 8, until: 30 });
  updateStory(st);
  if (st.flags.freeStart && region.events.some((e) => e.id === `${region.id}_intro`)) st.eventQueue.splice(0, st.eventQueue.length, { id: `${region.id}_intro` });
  st.objCurrent = objectives(st).map((o) => o.id);
  return st;
}

// A start without the guide: some planks and food to begin with, two
// newcomers walking in to the fire, and whatever else the land's start kit
// brings (settlers, soldiers, houses already standing).
function freeStart(st, region, home) {
  st.tut.done = true;
  st.flags.openingDone = true;
  st.flags.freeStart = true;
  st.migrateT = 30;
  const kit = region.startKit || { res: { wood: 30, yam: 16 }, settlers: 2 };
  for (const [k, v] of Object.entries(kit.res || {})) st.res[k] = (st.res[k] || 0) + v;
  if (kit.era) st.era = kit.era;
  const sx = st.start.x;
  const sy = st.start.y;
  for (const type of kit.buildings || []) {
    const spot = type === 'stockpile'
      ? findSpot(st, type, sx, sy + 3, 1, 4)
      : findSpot(st, type, sx, sy, 4, 9);
    if (spot) {
      const b = createBuilding(st, type, spot.x, spot.y, { instant: true });
      if (st.flags.mud && BUILDINGS[type].mudBricks) b.mud = true;
    }
  }
  const way = st.arrival?.length ? st.arrival[Math.min(st.arrival.length - 1, 6)] : sy * st.W + sx;
  for (let k = 0; k < (kit.settlers || 0); k++) {
    const c = createCitizen(st, way % st.W, Math.floor(way / st.W), { stranger: false, state: 'arrive', female: k % 3 === 1 });
    c.x += st.rng.range(-1, 1);
    c.y += st.rng.range(-1, 1);
  }
  for (const [type, n] of Object.entries(kit.soldiers || {})) {
    for (let k = 0; k < n; k++) {
      const x = sx - 2 + (k % 4);
      const y = sy + 5 + Math.floor(k / 4);
      createUnit(st, type, x, y, 'player', { order: { t: 'guard', x: x + 0.5, y: y + 0.5 } });
    }
  }
  if (home.wrecked) notify(st, '🏚️ The house is a wreck: nobody can sleep in it. Tap it and press 🔨 Repair: the old roof timbers on the storage floor are enough to mend it.', 'bad', { x: home.x + 1.5, y: home.y + 1.5 });
  st.dirty.jobs = true;
  st.dirty.build = true;
}

// Things that happen when a building is finished.
function onBuilt(st, b) {
  const def = BUILDINGS[b.type];
  // A new house brings two newcomers to live in it, once the story is past
  // its opening.
  if (b.owner === 'player' && def.housing && b.type !== 'compound' && st.flags.openingDone) invite(st, 2, b);
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

  // Builders put buildings up (see citizens.js); here the town takes note
  // when one is finished.
  for (const b of st.buildings) {
    if (b.dead) continue;
    if (b.built < 1 && b.owner !== 'player') b.built = Math.min(1, b.built + dt / 10);
    if (b.rising && b.built >= 1) {
      b.rising = false;
      b.built = 1;
      st.dirty.jobs = true;
      st.dirty.build = true;
      st.dirty.territory = true;
      st.cap = capacity(st);
      onBuilt(st, b);
    }
  }

  st.timers.sec += dt;
  if (st.timers.sec >= 1) {
    st.timers.sec -= 1;
    everySecond(st);
  }
  if (st.dirty.jobs) assignJobs(st);
  if (st.dirty.build) assignBuilders(st);

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
  if (st.dirty.reach) {
    st.dirty.reach = false;
    st.reach = reachable(st.terrain, st.W, st.H, st.start.x, st.start.y, st.trees, st.felled);
  }
  computeThreats(st);
  // Soldiers near a hospital are patched up.
  const hospital = st.buildings.find((b) => b.type === 'hospital' && b.owner === 'player' && !b.dead && b.built >= 1);
  if (hospital) {
    for (const u of st.units) {
      if (u.owner === 'player' && !u.dead && u.hp < u.maxHp && Math.hypot(u.x - hospital.x - 1.5, u.y - hospital.y - 1.5) < 7) u.hp = Math.min(u.maxHp, u.hp + 4);
    }
  }
  houseHomeless(st);
  st.dirty.jobs = true;
  st.dirty.build = true;
  updatePort(st);
  expireAllies(st);
  updateFactions(st, 1);
  updatePois(st);
  updateExpeditions(st);
  checkEvents(st);
  updateStory(st);
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
      // Outposts (a brick shed by a far-off pit) may go on land nobody holds.
      if (!ignoreTerritory && st.territory[i] !== 1 && !(def.outpost && st.territory[i] === 0)) {
        return { ok: false, reason: st.territory[i] === 2 ? 'That land belongs to another people.' : 'Outside your territory. Expand with a palace, towers or war camps.' };
      }
      if (st.occ[i]) return { ok: false, reason: 'Something is already built there.' };
      const t = st.terrain[i];
      if (isWater(t) || t === T.FORD) return { ok: false, reason: 'You cannot build on water.' };
      // Stakes can be driven into the swamp; nothing else stands there but jetties.
      if (t === T.MANGROVE && def.place !== 'shore' && !def.wall && !def.gate) return { ok: false, reason: 'Too swampy. Only jetties, canoe yards and fences go in the mangroves.' };
      if (st.feature[i] === F.ROCK || st.feature[i] === F.IRON) return { ok: false, reason: 'Rock is in the way.' };
      if (st.feature[i] === F.CLAY) return { ok: false, reason: 'A red-mud pit is in the way. Build beside it.' };
      if (st.trees[i] > 0) return { ok: false, reason: st.felled[i] ? 'Planks are still lying there. Let the woodcutters finish.' : 'Trees are in the way. Have them cut down first.' };
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
  if (def.place === 'clay' && near(F.CLAY, def.near) < 2) return { ok: false, reason: 'Must be built beside a red-mud pit.' };
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
  if (!canAfford(st, costOf(st, type))) return { ok: false, reason: 'Not enough resources.', fits: true };
  return { ok: true };
}

// A good place for a building, for the guide to point at: near the house,
// and near what the building needs (trees for a wood shed, game for a
// hunter, the red mud for a brick shed, open water for a jetty). Fences go
// where the fence is still open.
export function suggestPlace(st, type) {
  const def = BUILDINGS[type];
  if (!def) return null;
  if (def.wall || def.gate) {
    const g = fenceGaps(st).gaps[0];
    return g ? { x: g.x, y: g.y } : null;
  }
  const home = st.buildings.find((b) => b.type === 'compound' && b.owner === 'player' && !b.dead);
  if (!home) return null;
  const hx = home.x + 1.5;
  const hy = home.y + 1.5;
  let ax = hx;
  let ay = hy;
  if (type === 'brickyard' && st.mudPit) {
    ax = st.mudPit.x + 0.5;
    ay = st.mudPit.y + 0.5;
  }
  if (type === 'stockpile') {
    const floor = st.buildings.find((b) => b.type === 'stockpile' && b.owner === 'player' && !b.dead);
    if (floor) {
      ax = floor.x + 1;
      ay = floor.y + 1;
    }
  }
  const herd = type === 'hunter' ? st.animals.filter((a) => !a.dead && !a.carcass && a.type !== 'wolf') : [];
  const around = (x, y, r, pred) => {
    let n = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx >= 0 && ty >= 0 && tx < st.W && ty < st.H && pred(ty * st.W + tx)) n++;
      }
    }
    return n;
  };
  let best = null;
  let bestScore = -Infinity;
  const R = type === 'brickyard' ? 8 : 14;
  for (let y = Math.floor(ay) - R; y <= Math.floor(ay) + R; y++) {
    for (let x = Math.floor(ax) - R; x <= Math.floor(ax) + R; x++) {
      if (!canPlace(st, type, x, y).ok) continue;
      const cx = x + def.w / 2;
      const cy = y + def.h / 2;
      let score = -Math.hypot(cx - ax, cy - ay);
      if (type === 'woodcutter') score += around(x + 1, y + 1, 4, (i) => st.trees[i] > 0 && !st.felled[i]) * 0.6;
      if (type === 'hunter' && herd.length) score -= Math.min(...herd.map((a) => Math.hypot(a.x - cx, a.y - cy))) * 0.8;
      if (type === 'fisher') score += around(x + 1, y + 1, 3, (i) => isWater(st.terrain[i])) * 0.3;
      // Leave room around the house: not right up against it.
      if (type !== 'stockpile' && Math.hypot(cx - hx, cy - hy) < 3.2) score -= 6;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

export function placeBuilding(st, type, x, y) {
  const can = canPlace(st, type, x, y);
  if (!can.ok) return can;
  const cost = costOf(st, type);
  spend(st, cost);
  const b = createBuilding(st, type, x, y);
  setMaterials(b, cost);
  // Fence stakes are cut and dragged along the line as it is marked out:
  // the builders go straight from one section to the next.
  if (BUILDINGS[type].wall || BUILDINGS[type].gate) {
    b.got = b.need;
    b.haul = {};
  }
  st.dirty.build = true;
  // After the kingdom upgrade, new houses and sheds go up in mud.
  if (st.flags.mud && BUILDINGS[type].mudBricks) {
    b.mud = true;
    if (type === 'hut') b.level = 2;
  }
  st.stats.built = (st.stats.built || 0) + 1;
  return { ok: true, building: b };
}

// What the builders must carry over before they can start.
function setMaterials(b, cost) {
  b.haul = materialsOf(cost);
  b.need = Object.values(b.haul).reduce((a, v) => a + v, 0);
  b.got = 0;
  b.mat = Object.keys(b.haul)[0] || null;
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
  // Half of what it cost comes back (all of it, if it was never finished).
  const cost = b.mud && BUILDINGS[b.type].mudCost ? BUILDINGS[b.type].mudCost : BUILDINGS[b.type].cost;
  const back = [];
  for (const [k, v] of Object.entries(cost)) {
    if (k === 'food') continue;
    const n = Math.floor(v * (b.built >= 1 ? 0.5 : 1));
    st.res[k] += n;
    if (n) back.push(`${n} ${k === 'wood' ? 'planks' : k}`);
  }
  removeBuilding(st, b);
  return { ok: true, back };
}

// --- Moving sheds and farm land -----------------------------------------------------

export function canMove(st, id, x, y) {
  const b = st.byId.get(id);
  if (!b || b.dead || b.owner !== 'player') return { ok: false, reason: 'Nothing to move.' };
  if (!BUILDINGS[b.type].movable) return { ok: false, reason: 'Only sheds and farm land can be moved. Pull this down and build again instead.' };
  const own = [];
  for (let dy = 0; dy < b.h; dy++) {
    for (let dx = 0; dx < b.w; dx++) {
      const i = (b.y + dy) * st.W + b.x + dx;
      if (st.occ[i] === b.id) {
        st.occ[i] = 0;
        own.push(i);
      }
    }
  }
  const r = footprintOk(st, b.type, x, y, false);
  for (const i of own) st.occ[i] = b.id;
  return r;
}

export function moveBuilding(st, id, x, y) {
  const can = canMove(st, id, x, y);
  if (!can.ok) return can;
  const b = st.byId.get(id);
  for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) {
    const i = (b.y + dy) * st.W + b.x + dx;
    if (st.occ[i] === b.id) st.occ[i] = 0;
  }
  b.x = x;
  b.y = y;
  const def = BUILDINGS[b.type];
  for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) {
    const i = (y + dy) * st.W + x + dx;
    st.occ[i] = b.id;
    if (st.terrain[i] === T.FOREST || (def.flat && st.terrain[i] === T.SAVANNA)) st.terrain[i] = T.GRASS;
    if (st.feature[i] === F.PALM || st.feature[i] === F.PATH) st.feature[i] = F.NONE;
    st.changedTiles.push(i);
  }
  // A moved farm is planted again; the workers follow.
  if (def.job?.type === 'farm') b.growth = 0;
  b.meat = 0;
  for (const cid of b.workers) {
    const c = st.byId.get(cid);
    if (!c || c.dead) continue;
    c.site = null;
    c.src = -1;
    c.carcass = null;
    if (c.prey) {
      const a = st.byId.get(c.prey);
      if (a) a.reserved = 0;
      c.prey = 0;
    }
    if (!c.carry) {
      c.state = 'towork';
      c.path = null;
    }
  }
  st.dirty.territory = true;
  st.dirty.jobs = true;
  notify(st, `🚚 The ${def.name.toLowerCase()} has been moved.`, 'info', { x: x + b.w / 2, y: y + b.h / 2 });
  return { ok: true };
}

// --- Workers and the founder -----------------------------------------------------------

// Send one of your people to work at a building.
export function assignWorker(st, cid, bid) {
  return assignTo(st, st.byId.get(cid), st.byId.get(bid));
}

// Send one of your people to help put up a building.
export function assignBuilder(st, cid, bid) {
  return builderOrder(st, st.byId.get(cid), st.byId.get(bid));
}

// Soldiers either hold their ground (fighting only what comes within reach
// of their spears) or go for any enemy, tent or hut that comes near.
export function setStance(st, ids, stance) {
  let n = 0;
  for (const id of ids) {
    const u = st.byId.get(id);
    if (!u || u.dead || u.owner !== 'player') continue;
    u.stance = stance === 'hold' ? 'hold' : 'engage';
    if (u.stance === 'hold' && u.order?.t === 'guard') {
      u.order = { t: 'guard', x: u.x, y: u.y };
      u.path = null;
    }
    n++;
  }
  return n;
}

// Send the founder (or a woodcutter) to fell the tree on tile i.
export function orderTree(st, cid, i) {
  const r = treeOrder(st, st.byId.get(cid), i);
  if (r.ok) signal(st, 'tree', cid);
  return r;
}

// Send the founder somewhere on the map.
export function orderWalk(st, cid, x, y) {
  return walkOrder(st, st.byId.get(cid), x, y);
}

// The interface tells the story what the player has done (selected someone,
// opened a menu), and the guide moves on at once.
export function signal(st, kind, v) {
  tutSignal(st, kind, v);
  if (!st.eventQueue.length) updateStory(st);
}

// What a tree on tile i gives.
export function treeInfo(st, i) {
  if (!(st.trees[i] > 0)) return null;
  const kind = { [T.FOREST]: 'Rainforest tree', [T.SAVANNA]: 'Savanna tree', [T.GRASS]: 'Shade tree', [T.MANGROVE]: 'Mangrove' }[st.terrain[i]] || 'Tree';
  return { kind, planks: st.trees[i], full: treePlanks(st.terrain[i]), felled: st.felled[i] === TREE.FELLED };
}

// --- The kingdom upgrade: rebuild in mud ---------------------------------------------------

export function mudUpgradeCost(st) {
  let n = 0;
  for (const b of st.buildings) if (b.owner === 'player' && !b.dead && b.built >= 1 && !b.mud) n += mudBricksFor(b);
  return n;
}

export function mudUpgrade(st) {
  if (st.flags.mud) return { ok: false, reason: 'Your houses are already built of mud.' };
  const cost = mudUpgradeCost(st);
  if (st.res.bricks < cost) return { ok: false, reason: `Not enough mud bricks: you need ${cost}.` };
  st.res.bricks -= cost;
  st.flags.mud = true;
  for (const b of st.buildings) {
    if (b.owner !== 'player' || b.dead || b.built < 1 || !mudBricksFor(b)) continue;
    b.mud = true;
    b.maxHp = Math.round(b.maxHp * 1.6);
    b.hp = b.maxHp;
    if (b.type === 'hut' && (b.level || 1) < 2) b.level = 2;
  }
  st.cap = capacity(st);
  st.dirty.jobs = true;
  addMood(st, 'Houses of red mud', 8, 8);
  notify(st, '🧱 The whole settlement is rebuilt in red mud: stronger walls, and every house now sleeps four.', 'good');
  tutSignal(st, 'mud', 1);
  return { ok: true };
}

// Pull down every fence, wall and gate section along a line.
export function demolishLine(st, x0, y0, x1, y1) {
  let n = 0;
  for (const [x, y] of lineTiles(x0, y0, x1, y1)) {
    if (x < 0 || y < 0 || x >= st.W || y >= st.H) continue;
    const b = st.byId.get(st.occ[y * st.W + x]);
    if (b && !b.dead && (b.wall || b.gate) && demolish(st, b.id).ok) n++;
  }
  return n;
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

// --- Repairs -----------------------------------------------------------------------

// What mending a damaged building takes: a share of what it cost, as much as
// it has lost. The wrecked house the founders find needs the old timbers
// lying in its yard.
export function repairCost(st, b) {
  const def = BUILDINGS[b.type];
  if (b.wrecked) return { ...def.wreckCost };
  const lost = Math.max(0, 1 - b.hp / b.maxHp);
  const base = materialsOf((b.mud && def.mudCost) || def.repairBase || def.cost);
  if (!Object.keys(base).length) base.wood = 6;
  const out = {};
  for (const [k, v] of Object.entries(base)) {
    const n = Math.ceil(v * lost * 0.6);
    if (n > 0) out[k] = n;
  }
  return out;
}

export function canRepair(st, b) {
  if (!b || b.dead || b.owner !== 'player' || b.built < 1) return { ok: false, reason: 'Only your own finished buildings can be repaired.' };
  const def = BUILDINGS[b.type];
  if (def.invulnerable) return { ok: false, reason: 'Nothing to mend.' };
  if (b.repairing) return { ok: false, reason: 'It is already being repaired.' };
  if (b.hp >= b.maxHp && !b.wrecked) return { ok: false, reason: 'It needs no repairs.' };
  const cost = repairCost(st, b);
  if (!canAfford(st, cost)) {
    const short = Object.entries(cost).filter(([k, v]) => (st.res[k] || 0) < v).map(([k, v]) => `${v - Math.floor(st.res[k] || 0)} more ${k === 'wood' ? 'planks' : k}`);
    return { ok: false, reason: `Not enough to mend it: you need ${short.join(' and ')}.`, cost };
  }
  return { ok: true, cost };
}

// Start mending a damaged building. The materials leave the stores now; the
// builders carry them over and do the work (`by`, if given, goes himself).
export function repair(st, id, by) {
  const b = st.byId.get(id);
  const can = canRepair(st, b);
  if (!can.ok) return can;
  spend(st, can.cost);
  const def = BUILDINGS[b.type];
  const lost = b.maxHp - b.hp;
  const work = b.wrecked ? def.wreckWork || 30 : Math.max(6, buildWork(def) * (lost / b.maxHp) * 0.6);
  b.repairing = true;
  b.haul = { ...can.cost };
  b.need = Object.values(can.cost).reduce((a, v) => a + v, 0);
  b.got = 0;
  b.fixRate = lost / work;
  b.builders = [];
  b.blockedT = undefined;
  const c = by ? st.byId.get(by) : null;
  let who = null;
  if (c && !c.dead && c.kind === 'citizen' && builderOrder(st, c, b).ok) who = c.name;
  st.dirty.build = true;
  tutSignal(st, 'repair', b.id);
  return { ok: true, cost: can.cost, by: who };
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

// Where the army gathers: new soldiers walk there from the training ground,
// and the whole army can be called to it. Pass null to clear it.
export function setRally(st, x, y) {
  if (x === null || x === undefined) {
    st.rally = null;
    return { ok: true };
  }
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 1 || ty < 1 || tx >= st.W - 1 || ty >= st.H - 1) return { ok: false, reason: 'Pick a place on the map.' };
  const i = ty * st.W + tx;
  if (!st.explored[i]) return { ok: false, reason: 'Nobody has seen that place yet. Pick somewhere you have explored.' };
  if (!WALK[st.terrain[i]] || !st.reach[i]) return { ok: false, reason: 'Your soldiers cannot stand there. Pick open ground.' };
  const b = st.byId.get(st.occ[i]);
  if (b && !b.dead && !b.gate) return { ok: false, reason: 'Pick open ground, not a building.' };
  st.rally = { x: tx + 0.5, y: ty + 0.5 };
  return { ok: true };
}

// Call soldiers to the gathering point (all of them when no ids are given).
export function gatherArmy(st, ids) {
  if (!st.rally) return { ok: false, reason: 'Set a gathering point first.' };
  const list = ids || st.units.filter((u) => u.owner === 'player' && !u.dead).map((u) => u.id);
  const n = orderMove(st, list, st.rally.x, st.rally.y, false);
  return n ? { ok: true, n } : { ok: false, reason: 'You have no soldiers yet.' };
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
  if (up.flag && !st.flags[up.flag]) return { ok: false, reason: 'Needs the kingdom upgrade to mud first.', up };
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
  b.rising = true;
  b.builders = [];
  setMaterials(b, can.up.cost);
  st.dirty.jobs = true;
  st.dirty.build = true;
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

const TYPED = ['terrain', 'trees', 'felled', 'feature', 'amount', 'occ', 'explored'];

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

const CTOR = { terrain: Uint8Array, trees: Uint8Array, felled: Uint8Array, feature: Uint8Array, amount: Uint16Array, occ: Int32Array, explored: Uint8Array };

export function deserialize(json) {
  const data = JSON.parse(json);
  if (!data || typeof data !== 'object' || !('regionId' in data) || !('version' in data)) throw new Error('There is no saved game in it.');
  const region = REGIONS[data.regionId];
  if (!region) throw new Error('This save is from a land this version of the game does not have.');
  migrate(data);
  const st = { ...data };
  delete st.arrays;
  delete st.rngState;
  st.region = region;
  for (const k of TYPED) st[k] = fromB64(data.arrays[k], CTOR[k]);
  const n = st.W * st.H;
  st.visible = new Uint8Array(n);
  st.territory = new Uint8Array(n);
  st.reach = reachable(st.terrain, st.W, st.H, st.start.x, st.start.y, st.trees, st.felled);
  st.rng = new Rng(0);
  st.rng.s = data.rngState >>> 0;
  st.fx = [];
  st.threats = [];
  st.changedTiles = [];
  st.byId = new Map();
  for (const list of [st.buildings, st.citizens, st.units, st.animals]) for (const e of list) st.byId.set(e.id, e);
  st.factionMap = {};
  for (const f of st.factions) st.factionMap[f.id] = f;
  st.dirty = { territory: false, jobs: false, cleanup: false, reach: false, build: true };
  st.territoryVersion = 0;
  st.fogVersion = 0;
  st.visVersion = 0;
  computeTerritory(st);
  computeVisibility(st);
  computeThreats(st);
  st.cap = capacity(st);
  return st;
}

export { BUILDINGS, UNITS, ERAS, population, hasBuilding, WALK, fenceGaps, SAVE_VERSION };
export { currentStep, stepText, storyRunning } from './story.js';
