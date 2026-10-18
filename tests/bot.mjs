// A simple scripted player used by the tests: it builds an economy, raises
// money and an army, explores, makes trade deals, subdues the weakest kingdom
// it can, answers every event with its first affordable choice, trades with
// merchant ships, and advances ages when it can. It is not clever, but it
// exercises every system.

import * as sim from '../js/sim/index.js';
import { F, isWater } from '../js/world/terrain.js';
import { factionPower } from '../js/sim/factions.js';
import { armyPower } from '../js/sim/military.js';
import { stat } from '../js/data/buildings.js';

const BUILD_ORDER = [
  ['woodcutter', 'trees'],
  ['farm', 'home'],
  ['hunter', 'home'],
  ['woodcutter', 'trees'],
  ['hut', 'home'],
  ['fisher', 'water'],
  ['stockpile', 'home'],
  ['hut', 'home'],
  ['woodcutter', 'trees'],
  ['brickyard', 'clay'],
  ['hut', 'home'],
  ['stockpile', 'home'],
  ['farm', 'home'],
  ['hut', 'home'],
];

export function makeBot(st) {
  return { st, step: 0, tries: 0, log: [], scoutTargets: null, war: null };
}

function spots(near, radius) {
  const out = [];
  for (let y = near.y - radius; y <= near.y + radius; y++) {
    for (let x = near.x - radius; x <= near.x + radius; x++) out.push([x, y]);
  }
  return out;
}

function score(st, x, y, pref, home) {
  const d = Math.hypot(x - home.x, y - home.y);
  if (pref === 'home') return d;
  let n = 0;
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const i = (y + dy) * st.W + x + dx;
      if (i < 0 || i >= st.terrain.length) continue;
      if (pref === 'trees' && st.trees[i] > 0) n++;
      if (pref === 'water' && isWater(st.terrain[i])) n++;
      if (pref === 'rock' && st.feature[i] === F.ROCK) n++;
      if (pref === 'palm' && st.feature[i] === F.PALM) n++;
      if (pref === 'clay' && st.feature[i] === F.CLAY) n++;
    }
  }
  return -n + d * 0.4;
}

function seat(st) {
  return st.buildings.find((b) => b.type === 'palace' && !b.dead) || st.buildings.find((b) => b.type === 'compound');
}

export function place(st, type, pref = 'home') {
  const home = seat(st);
  const c = { x: home.x + 1, y: home.y + 1 };
  let best = null;
  let bestS = Infinity;
  for (const [x, y] of spots(c, 22)) {
    if (!sim.canPlace(st, type, x, y).ok) continue;
    const s = score(st, x, y, pref, c);
    if (s < bestS) {
      bestS = s;
      best = [x, y];
    }
  }
  if (!best) return false;
  return sim.placeBuilding(st, type, best[0], best[1]).ok;
}

const count = (st, type) => st.buildings.filter((b) => b.type === type && !b.dead && b.owner === 'player').length;
const built = (st, type) => st.buildings.find((b) => b.type === type && !b.dead && b.owner === 'player' && b.built >= 1);
const army = (st) => st.units.filter((u) => u.owner === 'player' && !u.dead && u.type !== 'scout' && !u.ally);

function answerEvents(bot) {
  const st = bot.st;
  while (st.eventQueue.length) {
    const entry = st.eventQueue[0];
    const ev = st.region.events.find((e) => e.id === entry.id);
    let pick = 0;
    if (ev) {
      const k = ev.choices.findIndex((c) => !c.can || c.can(st));
      pick = Math.max(0, k);
    } else if (entry.id === 'meet') {
      pick = 1; // propose trade
    }
    bot.log.push(`${st.time.year} d${st.time.day}: event ${entry.id}${entry.fid ? `:${entry.fid}` : ''} -> ${pick}`);
    sim.chooseEvent(st, pick);
  }
}

function explore(bot) {
  const st = bot.st;
  const scout = st.units.find((u) => u.owner === 'player' && u.type === 'scout' && !u.dead);
  if (!scout) {
    const where = built(st, 'warcamp') || built(st, 'compound');
    if (where && st.res.cowries > 30) sim.train(st, where.id, 'scout');
    return;
  }
  if (!bot.scoutTargets) bot.scoutTargets = st.factions.filter((f) => f.temperament !== 'bandit').map((f) => ({ x: f.x + 0.5, y: f.y + 4 }));
  if (scout.order.t === 'guard' && bot.scoutTargets.length) {
    const t = bot.scoutTargets.shift();
    sim.orderMove(st, [scout.id], t.x, t.y, false);
  }
}

function diplomacy(bot) {
  const st = bot.st;
  for (const f of st.factions) {
    if (!f.discovered || f.temperament === 'bandit' || f.status === 'hostile' || f.status === 'conquered') continue;
    if (!f.trade && f.status !== 'allied') {
      if (f.relation < 20 && st.res.cowries > 120) sim.diplo(st, f.id, 'gift');
      sim.diplo(st, f.id, 'trade');
    }
  }
}

// Subdue the weakest kingdom in reach: by threat if strong enough, else by force.
function subdue(bot) {
  const st = bot.st;
  if (st.era < 1) return;
  const need = (st.era + 1 <= 4 ? [0, 0, 1, 2, 3][st.era + 1] : 3) || 0;
  const have = st.factions.filter((f) => f.temperament !== 'bandit' && (f.status === 'conquered' || f.status === 'vassal')).length;
  if (have >= need && !bot.war) return;
  const targets = st.factions
    .filter((f) => f.discovered && f.temperament !== 'bandit' && !['conquered', 'vassal', 'allied'].includes(f.status))
    .sort((a, b) => factionPower(st, a) - factionPower(st, b));
  if (!targets.length) return;
  const f = bot.war ? st.factionMap[bot.war] : targets[0];
  if (!f || f.status === 'conquered' || f.status === 'vassal') {
    bot.war = null;
    const home = seat(st);
    sim.orderMove(st, army(st).map((u) => u.id), home.x + 1, home.y + home.h + 2, false);
    return;
  }
  if (!bot.war && armyPower(st) >= factionPower(st, f) * 1.4) {
    sim.diplo(st, f.id, 'demand');
    if (f.status === 'vassal') return;
  }
  const troops = army(st);
  if (troops.length >= 10 && armyPower(st) >= factionPower(st, f) * 1.1) {
    if (f.status !== 'hostile') sim.diplo(st, f.id, 'war');
    bot.war = f.id;
    const idle = troops.filter((u) => u.order.t === 'guard');
    if (idle.length) sim.orderMove(st, idle.map((u) => u.id), f.x + 0.5, f.y + 0.5, true);
  }
}

function trade(bot) {
  const st = bot.st;
  if (st.harbour.ship) {
    for (const r of ['palmoil', 'garri', 'fish', 'cassava', 'wood']) if (st.res[r] > 20) sim.shipSell(st, r, Math.floor(st.res[r] - 15));
    for (const item of ['tools', 'nets', 'muskets', 'salt', 'cloth']) if (st.res.cowries > 400) sim.shipBuy(st, item, 10);
  }
  for (const f of st.factions) {
    if (!f.trade && f.status !== 'allied' && f.status !== 'vassal') continue;
    for (const r of Object.keys(f.wants || {})) if (st.res[r] > 25) sim.barter(st, f.id, r, 10, true);
  }
  if (count(st, 'market')) {
    for (const r of ['wood', 'palmoil', 'fish', 'yam', 'garri']) if (st.res[r] > st.cap.goods * 0.8) sim.trade(st, r, 10, false);
  }
}

export function botTick(bot) {
  const st = bot.st;
  answerEvents(bot);
  // Anything damaged is mended as soon as there is the material for it.
  for (const b of st.buildings) {
    if (b.owner === 'player' && !b.dead && b.built >= 1 && !b.repairing && (b.wrecked || b.hp < b.maxHp * 0.7)) sim.repair(st, b.id);
  }
  // Planks keep everything going. Nobody leaves a job by themselves, so when
  // every wood shed stands empty, planks run short and there is food enough,
  // someone is moved from the food to the axe, as a player would.
  const foodNow = st.res.yam + st.res.fish + st.res.meat + st.res.garri;
  const sheds = st.buildings.filter((b) => b.type === 'woodcutter' && b.owner === 'player' && !b.dead && b.built >= 1 && !b.paused);
  if (st.res.wood < 15 && foodNow > sim.population(st) * 4 && sheds.length && sheds.every((b) => !b.workers.length)) {
    const shed = sheds[0];
    const from = shed && st.citizens.find((c) => !c.dead && !c.special && ['farm', 'hunter', 'fisher'].includes(st.byId.get(c.job)?.type));
    if (from) sim.assignWorker(st, from.id, shed.id);
  }

  if (bot.step < BUILD_ORDER.length) {
    const [type, pref] = BUILD_ORDER[bot.step];
    // Skip a step that keeps failing (no suitable land) rather than stall.
    if (place(st, type, pref) || ++bot.tries > 20) {
      bot.step++;
      bot.tries = 0;
    }
    return;
  }

  const pop = sim.population(st);
  // Keep a couple of beds free: each new house brings newcomers.
  const free = st.buildings.reduce((n, b) => {
    const cap = b.built >= 1 && sim.BUILDINGS[b.type].housing ? stat(b, 'housing') : 0;
    return n + Math.max(0, cap - b.residents.length);
  }, 0);
  const homeless = st.citizens.filter((c) => !c.dead && !c.stranger && !c.home).length;
  if (free - homeless < 2) {
    const busy = st.buildings.some((b) => b.type === 'hut' && b.built < 1);
    const hut = !busy && st.buildings.find((b) => b.type === 'hut' && !b.dead && b.built >= 1 && sim.canUpgrade(st, b.id).ok);
    if (hut) sim.upgradeBuilding(st, hut.id);
    else if (!busy) place(st, 'hut');
  }
  if (!st.flags.mud && st.res.bricks >= sim.mudUpgradeCost(st)) sim.mudUpgrade(st);
  const food = st.res.yam + st.res.fish + st.res.meat + st.res.garri;
  if (food < pop * 3 && count(st, 'farm') < 2 + pop / 5) place(st, 'farm');
  if (count(st, 'woodcutter') < 3 + Math.floor(pop / 8)) place(st, 'woodcutter', 'trees');
  if (count(st, 'brickyard') < 1 + Math.floor(pop / 15)) place(st, 'brickyard', 'clay');
  if (count(st, 'hunter') < 1 + Math.floor(pop / 15)) place(st, 'hunter', 'home');
  const full = Math.max(st.res.wood, st.res.bricks) >= st.cap.goods - 5 || food >= st.cap.food - 5;
  if (full && st.era < 1 && count(st, 'stockpile') < 6) place(st, 'stockpile');
  if (st.res.wood >= st.cap.goods - 5 && count(st, 'storehouse') < 4) place(st, 'storehouse');
  if (food >= st.cap.food - 5 && count(st, 'granary') < 4) place(st, 'granary');

  if (!count(st, 'warcamp') && st.res.cowries >= 50) place(st, 'warcamp');
  explore(bot);
  diplomacy(bot);

  if (st.era >= 1) {
    for (const [type, pref] of [['quarry', 'rock'], ['market', 'home'], ['shrine', 'home'], ['well', 'home'], ['palmpress', 'palm'], ['watchtower', 'home']]) {
      if (!count(st, type)) place(st, type, pref);
    }
    if (st.flags.cassava) for (const [type, pref] of [['cassava', 'home'], ['garri', 'home']]) if (!count(st, type)) place(st, type, pref);
    if (!count(st, 'palace') && st.res.wood >= 140 && st.res.bricks >= 80 && st.res.stone >= 30 && st.res.cowries >= 150) place(st, 'palace');
  }
  const wc = built(st, 'warcamp');
  if (wc && pop > 10) {
    const want = st.era >= 2 && st.res.weapons >= 2 ? 'swordsman' : st.res.muskets >= 1 ? 'musketeer' : 'spearman';
    sim.train(st, wc.id, want);
    if (st.res.cowries > 60) sim.train(st, wc.id, st.era >= 1 ? 'archer' : 'spearman');
  }
  subdue(bot);
  if (st.era >= 2) {
    for (const [type, pref] of [['canoeyard', 'water'], ['ironmine', 'home'], ['blacksmith', 'home'], ['port', 'water']]) {
      if (!count(st, type)) place(st, type, pref);
    }
    if (count(st, 'quarry') < 3) place(st, 'quarry', 'rock');
  }
  if (st.era >= 3) {
    for (const [type, pref] of [['school', 'home'], ['assembly', 'home'], ['fort', 'home']]) if (!count(st, type)) place(st, type, pref);
  }
  if (st.era >= 4) {
    for (const [type, pref] of [['hospital', 'home'], ['bank', 'home'], ['factory', 'home']]) if (!count(st, type)) place(st, type, pref);
  }
  trade(bot);
  sim.advanceEra(st);
}

export function run(st, seconds, bot = makeBot(st)) {
  const steps = Math.round(seconds / sim.STEP);
  for (let i = 0; i < steps; i++) {
    if (st.eventQueue.length || i % 100 === 0) botTick(bot);
    sim.tick(st, sim.STEP);
    if (st.gameOver) break;
  }
  return bot;
}
