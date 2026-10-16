// Headless tests for Eko Rising's simulation. Run with:
//   npm test   (or: node --test tests/*.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as sim from '../js/sim/index.js';
import { WALK, isWater } from '../js/world/terrain.js';
import { createUnit } from '../js/sim/entities.js';
import { findPath } from '../js/world/path.js';
import { eventDef } from '../js/sim/events.js';
import { makeBot, run, place } from './bot.mjs';

function fresh(seed = 4242) {
  const st = sim.newGame({ seed });
  sim.chooseEvent(st, 0); // the intro
  return st;
}

function advance(st, seconds, answer = 0) {
  const steps = Math.round(seconds / sim.STEP);
  for (let i = 0; i < steps; i++) {
    while (st.eventQueue.length) sim.chooseEvent(st, answer);
    sim.tick(st);
  }
}

test('the same seed builds the same land', () => {
  const a = sim.newGame({ seed: 77 });
  const b = sim.newGame({ seed: 77 });
  assert.deepEqual(a.start, b.start);
  assert.equal(Buffer.from(a.terrain).toString('base64'), Buffer.from(b.terrain).toString('base64'));
  const c = sim.newGame({ seed: 78 });
  assert.notEqual(Buffer.from(a.terrain).toString('base64'), Buffer.from(c.terrain).toString('base64'));
});

test('every people and the home are on reachable dry land', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const st = sim.newGame({ seed });
    const home = st.buildings.find((b) => b.type === 'compound');
    for (const f of st.factions) {
      assert.ok(WALK[st.terrain[f.y * st.W + f.x]] > 0, `${f.id} sits on water (seed ${seed})`);
      const path = findPath(st, home.x, home.y + 3, f.x, f.y, { max: 20000 });
      assert.ok(path, `${f.id} unreachable on foot (seed ${seed})`);
    }
  }
});

test('the start has water for fishing and rock for a quarry within reach', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const st = sim.newGame({ seed });
    let water = Infinity;
    let rock = Infinity;
    for (let i = 0; i < st.terrain.length; i++) {
      const d = Math.hypot((i % st.W) - st.start.x, Math.floor(i / st.W) - st.start.y);
      if (isWater(st.terrain[i]) && st.terrain[i] !== 0) water = Math.min(water, d);
      if (st.feature[i] === 2) rock = Math.min(rock, d);
    }
    assert.ok(water <= 10, `water ${water} tiles away (seed ${seed})`);
    assert.ok(rock <= 14, `rock ${rock} tiles away (seed ${seed})`);
  }
});

test('a new game starts as a farmer and his wife, with one stranger waiting', () => {
  const st = sim.newGame({ seed: 9 });
  const family = st.citizens.filter((c) => !c.stranger);
  assert.equal(family.length, 2);
  assert.deepEqual(family.map((c) => c.special).sort(), ['founder', 'spouse']);
  assert.equal(st.citizens.filter((c) => c.stranger).length, 1);
  assert.deepEqual(st.buildings.map((b) => b.type).sort(), ['campfire', 'compound', 'farm']);
  assert.equal(st.eventQueue[0].id, 'intro');
});

test('strangers move into a new hut and go to work', () => {
  const st = fresh(11);
  assert.ok(place(st, 'woodcutter', 'trees'), 'woodcutter placed');
  assert.ok(place(st, 'hut'), 'hut placed');
  advance(st, 90);
  const working = st.citizens.filter((c) => !c.stranger && c.job);
  assert.ok(working.length >= 2, `only ${working.length} working`);
  const hut = st.buildings.find((b) => b.type === 'hut');
  assert.ok(hut.residents.length >= 1, 'someone moved into the hut');
  assert.ok(st.stats.made.wood > 0, 'wood was cut and stored');
});

test('workers leave low-priority jobs for high-priority ones', () => {
  const st = fresh(12);
  st.migrateT = 1e9;
  place(st, 'woodcutter', 'trees');
  advance(st, 3);
  // Only the founder (farm) and his wife (woodcutter) remain: no one is idle.
  for (const c of st.citizens) {
    if (!c.special) c.dead = true;
  }
  st.dirty.cleanup = true;
  advance(st, 3);
  const cutter = st.buildings.find((b) => b.type === 'woodcutter');
  assert.equal(cutter.workers.length, 1);
  assert.ok(place(st, 'hunter', 'trees'));
  const lodge = st.buildings.find((b) => b.type === 'hunter');
  advance(st, 15);
  assert.equal(lodge.workers.length, 0, 'equal priority: nobody is pulled away');
  sim.setPriority(st, lodge.id, 2);
  advance(st, 2);
  assert.equal(lodge.workers.length, 1, 'high priority: someone moved to the lodge');
  const farm = st.buildings.find((b) => b.type === 'farm');
  assert.equal(cutter.workers.length + farm.workers.length, 1, 'and left their old job');
});

test('hunger and heavy taxes drive people away', () => {
  const st = fresh(13);
  st.res.yam = 0;
  st.buildings.filter((b) => b.type === 'farm').forEach((b) => (b.paused = true));
  sim.setTax(st, 3);
  st.mods = [];
  advance(st, 24 * 12);
  assert.ok(st.happy < 35, `happiness ${st.happy}`);
});

test('placement rules: no building on water, in fog, or outside territory', () => {
  const st = fresh(14);
  let water = -1;
  for (let i = 0; i < st.terrain.length; i++) if (isWater(st.terrain[i]) && st.territory[i] === 1) water = i;
  if (water >= 0) assert.equal(sim.canPlace(st, 'hut', water % st.W, Math.floor(water / st.W)).ok, false);
  assert.equal(sim.canPlace(st, 'hut', 2, 2).ok, false);
  assert.match(sim.canPlace(st, 'palace', st.start.x + 3, st.start.y + 3).reason, /era/);
});

test('walls block your walkers but raiders hack through them', () => {
  const st = fresh(15);
  st.res.wood = 500;
  const home = st.buildings.find((b) => b.type === 'compound');
  const y = home.y + 5;
  const r = sim.placeLine(st, 'palisade', home.x - 4, y, home.x + 6, y);
  assert.ok(r.placed >= 5);
  advance(st, 20);
  const wallTile = st.buildings.find((b) => b.type === 'palisade');
  const i = wallTile.y * st.W + wallTile.x;
  assert.equal(st.occ[i], wallTile.id);
  const cost = (enemy) => findPath(st, wallTile.x, wallTile.y - 1, wallTile.x, wallTile.y + 1, { enemy, max: 50 });
  assert.ok(cost(true), 'raiders path through the wall');
});

test('a war band raids, the compound shoots back, and the town survives', () => {
  const st = fresh(16);
  const home = st.buildings.find((b) => b.type === 'compound');
  const f = st.factionMap.bandits1;
  const { launchWarBand } = awaitImport();
  launchWarBand(st, f.id, { x: home.x - 8, y: home.y }, ['bandit', 'bandit', 'bandit'], { label: 'test band' });
  advance(st, 120);
  assert.ok(!st.gameOver, 'the compound survived');
  const raiders = st.units.filter((u) => u.owner === f.id && !u.home);
  assert.ok(raiders.length < 3, 'some raiders were shot or left');
});

test('conquering a village takes its wealth and its people join you', () => {
  const st = fresh(17);
  const f = st.factionMap.bandits1;
  // Wipe the garrison and stand in the camp.
  st.units.filter((u) => u.owner === f.id).forEach((u) => (u.dead = true));
  st.dirty.cleanup = true;
  createUnit(st, 'spearman', f.x, f.y, 'player');
  const cowries = st.res.cowries;
  advance(st, 8);
  assert.equal(f.status, 'conquered');
  assert.ok(st.res.cowries > cowries, 'plunder taken');
});

test('gifts win friendship and friendship becomes an alliance', () => {
  const st = fresh(18);
  const f = st.factionMap.awori;
  st.res.cowries = 1000;
  for (let k = 0; k < 4; k++) sim.diplo(st, f.id, 'gift');
  const r = sim.diplo(st, f.id, 'ally');
  assert.ok(r.ok, r.reason);
  assert.equal(f.status, 'allied');
});

test('a weak player cannot frighten a mighty people into tribute', () => {
  const st = fresh(19);
  const r = sim.diplo(st, 'egba', 'demand');
  assert.equal(r.ok, false);
  assert.notEqual(st.factionMap.egba.status, 'vassal');
});

test('beating a foreign landing triggers the follow-up story', () => {
  const st = fresh(20);
  st.foreign.portuguese.hostile = true;
  const { launchWarBand } = awaitImport();
  const home = st.buildings.find((b) => b.type === 'compound');
  const ids = launchWarBand(st, 'portuguese', { x: home.x + 5, y: home.y + 5 }, ['soldado'], { onDefeat: 'portuguese_beaten' });
  for (const id of ids) st.byId.get(id).hp = 0.1;
  for (let k = 0; k < 6; k++) createUnit(st, 'spearman', home.x + 5, home.y + 4, 'player');
  for (let i = 0; i < 400 && !st.eventQueue.length; i++) sim.tick(st);
  assert.equal(st.eventQueue[0]?.id, 'portuguese_beaten');
});

test('advancing an era needs people and pays its cost', () => {
  const st = fresh(21);
  assert.equal(sim.advanceEra(st), false);
  st.res.wood = 200;
  st.res.yam = 50;
  for (let k = 0; k < 8; k++) createUnit(st, 'spearman', st.start.x, st.start.y + 3, 'player');
  st.cap.food = 999;
  assert.equal(sim.advanceEra(st), true);
  assert.equal(st.era, 1);
  assert.equal(st.res.wood, 140);
  // The new age is announced with its own pop-up.
  const entry = st.eventQueue.at(-1);
  assert.deepEqual(entry, { id: 'age', era: 1 });
  const ev = eventDef(st, entry);
  assert.match(ev.title, /Compound/);
  sim.chooseEvent(st, 0);
  assert.equal(st.eventQueue.length, 0);
});

test('save and load keep the whole state', () => {
  const st = fresh(22);
  const bot = makeBot(st);
  run(st, 240, bot);
  const json = sim.serialize(st);
  const back = sim.deserialize(json);
  assert.equal(back.citizens.length, st.citizens.length);
  assert.equal(back.buildings.length, st.buildings.length);
  assert.deepEqual(back.res, st.res);
  assert.equal(back.rng.s, st.rng.s);
  // Both copies carry on identically.
  for (let i = 0; i < 400; i++) {
    sim.tick(st);
    sim.tick(back);
  }
  assert.equal(sim.serialize(back), sim.serialize(st));
});

test('a scripted player can grow a town through the eras without errors', () => {
  const st = fresh(23);
  const bot = makeBot(st);
  run(st, 60 * 40, bot);
  assert.ok(!st.gameOver, st.gameOver?.reason);
  assert.ok(st.era >= 2, `stuck in era ${st.era}`);
  assert.ok(sim.population(st) >= 30, `population ${sim.population(st)}`);
  assert.ok(st.flags.metEuropeans, 'the Portuguese arrived');
});

test('your own soldiers need a Training Ground and money; the compound only trains scouts', () => {
  const st = fresh(30);
  const compound = st.buildings.find((b) => b.type === 'compound');
  assert.equal(sim.train(st, compound.id, 'spearman').ok, false);
  st.res.cowries = 0;
  assert.match(sim.train(st, compound.id, 'scout').reason, /money/);
  st.res.cowries = 200;
  st.res.wood = 200;
  assert.ok(place(st, 'warcamp'));
  advance(st, 15);
  const camp = st.buildings.find((b) => b.type === 'warcamp');
  const before = st.res.cowries;
  assert.ok(sim.train(st, camp.id, 'spearman').ok);
  assert.equal(st.res.cowries, before - 12);
});

test('mercenaries are hired for money, paid daily, and leave when unpaid', () => {
  const st = fresh(31);
  const compound = st.buildings.find((b) => b.type === 'compound');
  st.res.cowries = 50;
  const r = sim.hire(st, compound.id, 'hire_spear');
  assert.ok(r.ok, r.reason);
  assert.equal(st.res.cowries, 5);
  assert.equal(st.units.filter((u) => u.owner === 'player' && u.wage).length, 1);
  st.res.cowries = 0;
  st.tax = 0;
  advance(st, 30);
  assert.equal(st.units.filter((u) => u.owner === 'player' && u.wage && !u.dead).length, 0, 'the unpaid spearman walked away');
});

test('no Town age without subduing a kingdom', () => {
  const st = fresh(32);
  st.era = 1;
  for (let k = 0; k < 20; k++) createUnit(st, 'spearman', st.start.x, st.start.y + 3, 'player');
  st.res.wood = 999;
  st.res.stone = 999;
  st.res.cowries = 999;
  assert.ok(place(st, 'palace'));
  advance(st, 30);
  assert.equal(sim.advanceEra(st), false);
  st.factionMap.ilaje.status = 'vassal';
  assert.equal(sim.advanceEra(st), true);
  assert.equal(st.era, 2);
  assert.ok(st.flags.cassava, 'cassava spreads with the Town age');
});

test('merchant ships dock at the port, buy palm oil and sell tools', () => {
  const st = fresh(33);
  st.era = 2;
  st.flags.europeanTrade = true;
  st.foreign.portuguese.trade = true;
  st.res.wood = 500;
  st.res.stone = 500;
  st.res.cowries = 500;
  assert.ok(place(st, 'port', 'water'), 'port placed');
  for (let i = 0; i < 20 * 120 && !st.harbour.ship; i++) {
    while (st.eventQueue.length) sim.chooseEvent(st, 0);
    sim.tick(st);
  }
  assert.ok(st.harbour.ship, 'a ship docked');
  st.res.palmoil = 30;
  const before = st.res.cowries;
  assert.ok(sim.shipSell(st, 'palmoil', 30).ok);
  assert.ok(st.res.cowries > before + 150);
  st.res.cowries = 1000;
  assert.ok(sim.shipBuy(st, 'tools', 1).ok);
  assert.ok(st.tech.tools);
});

test('kingdoms trade only after an agreement, which needs a market and goodwill', () => {
  const st = fresh(34);
  const f = st.factionMap.awori;
  st.res.fish = 100;
  assert.equal(sim.barter(st, f.id, 'fish', 10, true).ok, false);
  assert.match(sim.diplo(st, f.id, 'trade').reason, /Market/);
  st.era = 1;
  st.res.wood = 200;
  st.res.cowries = 200;
  assert.ok(place(st, 'market'));
  advance(st, 20);
  f.relation = 25;
  assert.ok(sim.diplo(st, f.id, 'trade').ok);
  const cash = st.res.cowries;
  const sold = sim.barter(st, f.id, 'fish', 100, true);
  assert.ok(sold.ok);
  assert.ok(sold.n < 100, 'a kingdom only needs so much at a time');
  assert.equal(st.res.cowries, cash + sold.n * f.wants.fish);
});

test('the local market only buys so much of a good each day', () => {
  const st = fresh(35);
  st.era = 1;
  st.res.wood = 300;
  st.res.cowries = 200;
  assert.ok(place(st, 'market'));
  advance(st, 20);
  st.res.wood = 300;
  const a = sim.trade(st, 'wood', 100, false);
  assert.ok(a.ok);
  assert.ok(a.n < 100);
  assert.equal(sim.trade(st, 'wood', 10, false).ok, false);
});

test('a hut upgrades to a mud-brick house that takes more people', () => {
  const st = fresh(36);
  st.era = 1;
  st.res.wood = 100;
  st.res.stone = 50;
  st.res.cowries = 100;
  assert.ok(place(st, 'hut'));
  advance(st, 15);
  const hut = st.buildings.find((b) => b.type === 'hut');
  assert.ok(sim.upgradeBuilding(st, hut.id).ok);
  assert.equal(hut.level, 2);
  advance(st, 15);
  const { stat } = awaitData();
  assert.equal(stat(hut, 'housing'), 6);
  assert.equal(sim.upgradeBuilding(st, hut.id).ok, false, 'zinc roofs wait for the Port City age');
});

test('an ally lends warriors who go home again', () => {
  const st = fresh(37);
  const f = st.factionMap.awori;
  f.status = 'allied';
  assert.ok(sim.diplo(st, f.id, 'help').ok);
  const lent = st.units.filter((u) => u.ally === f.id);
  assert.ok(lent.length >= 3);
  assert.equal(sim.diplo(st, f.id, 'help').ok, false, 'not again so soon');
  advance(st, 24 * 11);
  assert.equal(st.units.filter((u) => u.ally === f.id && !u.dead).length, 0);
});

test('the money changes name with the ages', () => {
  const st = fresh(38);
  const { money } = awaitRes();
  assert.equal(money(st).name, 'Cowries');
  st.era = 3;
  assert.equal(money(st).name, 'Pounds');
  st.era = 4;
  assert.equal(money(st).name, 'Naira');
});

import * as buildingsData from '../js/data/buildings.js';
import * as resourcesData from '../js/data/resources.js';
function awaitData() {
  return buildingsData;
}
function awaitRes() {
  return resourcesData;
}

// The military helpers live in their own module; importing it lazily keeps
// the test list above readable.
import * as military from '../js/sim/military.js';
function awaitImport() {
  return military;
}
