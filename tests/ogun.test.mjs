// Ogun, chapter two: the founders start again from scratch with what they
// learned in Lagos, and the land's history brings its own fighters: Ọ̀yọ́
// horsemen, Ìjẹ̀bú gunmen, and the host of Dahomey with its Agojie.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as sim from '../js/sim/index.js';
import { eraRequirements } from '../js/sim/events.js';
import { damage } from '../js/sim/military.js';
import { createUnit } from '../js/sim/entities.js';
import { makeBot, botTick } from './bot.mjs';

const LAGOS_TOWN = { from: 'lagos', land: 'Lagos', town: 'Èkó', era: 2, year: 1475, tech: ['tools'], cassava: true, metEuropeans: true, purse: 120 };

// An Ogun game a little way in, with the welcome answered.
function ogun(seed = 31, legacy = LAGOS_TOWN) {
  const st = sim.newGame({ region: 'ogun', seed, guide: false, legacy });
  while (st.eventQueue.length) sim.chooseEvent(st, 0);
  st.res.cowries = 400;
  return st;
}

function advance(st, seconds, answer = 0) {
  const steps = Math.round(seconds / sim.STEP);
  for (let i = 0; i < steps; i++) {
    while (st.eventQueue.length) sim.chooseEvent(st, answer);
    sim.tick(st);
  }
}

// Plays on until `id` is the story pop-up waiting, without answering it.
function until(st, id, days) {
  const end = st.time.day + days;
  while (st.time.day < end && st.eventQueue[0]?.id !== id) {
    while (st.eventQueue.length && st.eventQueue[0].id !== id) sim.chooseEvent(st, 0);
    if (st.eventQueue[0]?.id === id) break;
    sim.tick(st);
  }
  return st.eventQueue[0]?.id === id;
}

const band = (st, owner) => st.units.filter((u) => u.owner === owner && !u.dead);
const kill = (st, list) => list.forEach((u) => damage(st, null, u, 1e6));

test('Ogun starts from scratch, with what the founders learned in Lagos', () => {
  const st = sim.newGame({ region: 'ogun', seed: 31, guide: false, legacy: LAGOS_TOWN });
  assert.equal(st.era, 0, 'a new town, in the first age');
  assert.equal(sim.knownEra(st), 2, 'but it knows the Town age of Lagos');
  assert.deepEqual(st.buildings.filter((b) => b.owner === 'player').map((b) => b.type).sort(), ['campfire', 'compound', 'stockpile'], 'nothing else standing');
  assert.equal(st.units.filter((u) => u.owner === 'player' && u.type === 'spearman').length, 4, 'the spearmen who came north');
  st.res.wood = 500;
  st.res.stone = 500;
  st.res.cowries = 500;
  assert.equal(sim.buildLocked(st, 'palace'), null, 'a palace can be built from the first day');
  assert.equal(sim.buildLocked(st, 'blacksmith'), null, 'and a blacksmith, from the Town age');
  assert.match(sim.buildLocked(st, 'school') || '', /Port City/, 'but not what Lagos never reached');
  assert.ok(st.tech.tools && st.flags.cassava && st.flags.metEuropeans, 'tools, cassava and the Europeans');
  assert.equal(st.time.year, 1475, 'the calendar runs on from Lagos');
  assert.equal(st.res.cowries, 500);
  assert.ok(st.eventQueue.some((e) => e.id === 'ogun_intro'));
  sim.chooseEvent(st, 0);
  assert.ok(st.explored[st.mudPit.y * st.W + st.mudPit.x], 'they know where the red mud is');
  assert.ok(Math.hypot(st.mudPit.x - st.start.x, st.mudPit.y - st.start.y) < 18, 'a short walk from home');
});

test('an age reached in Lagos comes quicker in Ogun; one it never reached does not', () => {
  const st = ogun();
  let r = eraRequirements(st);
  assert.ok(r.reqs.some((q) => /reached this age in Lagos/.test(q.text)));
  assert.ok(r.reqs.some((q) => q.text === 'Population 5'), 'fewer people: 5 instead of 8');
  assert.deepEqual(r.cost, { wood: 30, bricks: 20, food: 20, cowries: 10 }, 'half the cost');
  Object.assign(st.res, { wood: 30, bricks: 20, yam: 20, cowries: 10 });
  assert.ok(sim.advanceEra(st));
  assert.equal(st.era, 1);
  assert.equal(st.res.wood + st.res.bricks + st.res.cowries, 0, 'paid half');
  st.era = 2;
  r = eraRequirements(st);
  assert.ok(!r.reqs.some((q) => /reached this age/.test(q.text)), 'the Port City age is new');
  assert.ok(r.reqs.some((q) => q.text === 'Population 40'));
});

test('without a record from Lagos, Ogun assumes a Lagos in the Compound age', () => {
  const st = sim.newGame({ region: 'ogun', seed: 8, guide: false });
  assert.equal(st.legacy.era, 1);
  assert.equal(sim.knownEra(st), 1);
  assert.equal(sim.newGame({ seed: 8 }).legacy, null, 'Lagos inherits nothing');
});

test('what a town has learned is recorded, and only grows', () => {
  const st = sim.newGame({ seed: 12 });
  st.era = 2;
  st.tech.nets = true;
  st.flags.cassava = true;
  st.res.cowries = 2000;
  const a = sim.legacyOf(st);
  assert.equal(a.from, 'lagos');
  assert.equal(a.era, 2);
  assert.deepEqual(a.tech, ['nets']);
  assert.equal(a.purse, 300, 'some of the money, not all');
  const b = sim.mergeLegacy(a, { ...a, era: 1, tech: ['tools'], cassava: false, purse: 50 });
  assert.equal(b.era, 2);
  assert.deepEqual(b.tech, ['nets', 'tools']);
  assert.ok(b.cassava);
  assert.equal(b.purse, 300);
});

test('Ogun’s fighters each fight their own way', () => {
  const U = sim.UNITS;
  assert.ok(U.oyorider.speed > U.horseman.speed, 'Ọ̀yọ́ horsemen are the fastest riders');
  assert.ok(U.ijebugun.ranged && U.dahomey.ranged, 'gunmen and musketeers shoot');
  assert.ok(U.agojie.speed > U.benin.speed && U.agojie.atk > U.benin.atk, 'the Agojie are quicker and fiercer than the Oba’s warriors');
});

test('refusing the Alaafin’s ilari brings Ọ̀yọ́ horsemen out of the north; then Lísàbí comes', () => {
  const st = ogun();
  st.eventQueue.push({ id: 'oyo_ilari' });
  sim.chooseEvent(st, 1); // send them away
  assert.ok(st.flags.oyoDefied);
  assert.ok(until(st, 'oyo_raid_seen', 8), 'the horsemen come');
  const riders = band(st, 'oyo');
  assert.ok(riders.length >= 2 && riders.every((u) => u.type === 'oyorider'));
  assert.ok(riders.every((u) => u.origin.y < st.H / 3), 'from the north');
  sim.chooseEvent(st, 0);
  kill(st, riders);
  assert.ok(until(st, 'oyo_raid_over', 2));
  sim.chooseEvent(st, 0);
  assert.ok(until(st, 'lisabi', 4), 'Lísàbí comes to the fire');
});

test('paying the tribute keeps Ọ̀yọ́ away, until Lísàbí asks you to stand with the Ẹ̀gbá', () => {
  const st = ogun();
  st.eventQueue.push({ id: 'oyo_ilari' });
  sim.chooseEvent(st, 0);
  assert.equal(st.res.cowries, 360);
  assert.ok(until(st, 'oyo_tribute', 14), 'the ilari come back');
  sim.chooseEvent(st, 0);
  assert.equal(band(st, 'oyo').length, 0, 'no horsemen while you pay');
  assert.ok(until(st, 'lisabi', 5));
  const before = st.factionMap.egba.relation;
  sim.chooseEvent(st, 0); // stand with Lísàbí
  assert.ok(st.factionMap.egba.relation >= before + 30, 'the Ẹ̀gbá warm to you');
  assert.ok(!st.scheduled.some((s) => s.id === 'oyo_tribute'), 'no more tribute');
  assert.ok(until(st, 'oyo_punish_seen', 12), 'the Alaafin sends his army');
  assert.ok(band(st, 'oyo').some((u) => u.type === 'bowman'));
  assert.ok(st.units.filter((u) => u.ally === 'egba' && !u.dead).length >= 4, 'and Ẹ̀gbá warriors come to fight beside you');
  sim.chooseEvent(st, 0);
  kill(st, band(st, 'oyo'));
  assert.ok(until(st, 'oyo_free', 2));
  sim.chooseEvent(st, 0);
  assert.ok(st.flags.oyoFree);
});

test('forcing the Ìjẹ̀bú road brings their gunmen; story bands come one at a time', () => {
  const st = ogun();
  // An Ọ̀yọ́ horseman still out in the field, far away.
  const rider = createUnit(st, 'oyorider', 5, 5, 'oyo', { order: { t: 'guard', x: 5.5, y: 5.5 } });
  st.expeditions.push({ owner: 'oyo', ids: [rider.id], label: 'Ọ̀yọ́ raid' });
  st.eventQueue.push({ id: 'ijebu_road' });
  sim.chooseEvent(st, 2); // force the road
  assert.equal(st.factionMap.ijebuode.status, 'hostile');
  advance(st, 24 * 4.5, 0);
  assert.equal(band(st, 'ijebuode').filter((u) => u.type === 'ijebugun').length, 0, 'not while the horsemen are still out');
  kill(st, [rider]);
  assert.ok(until(st, 'ijebu_raid_seen', 6), 'then the gunmen come');
  assert.equal(band(st, 'ijebuode').filter((u) => u.type === 'ijebugun' && u.order?.t === 'raid').length, 4);
});

test('the host of Dahomey gathers in the west and marches; friends come to help, and breaking it wins Ogun', () => {
  const st = ogun(44);
  st.era = 1;
  const egba = st.factionMap.egba;
  egba.status = 'allied';
  egba.relation = 80;
  st.flags.tinubu = true;
  st.eventQueue.push({ id: 'dahomey_word' });
  sim.chooseEvent(st, 2); // ask the Ẹ̀gbá
  assert.ok(st.flags.egbaAid);
  assert.ok(until(st, 'dahomey_host_seen', 8), 'they gather');
  const f = st.factionMap.dahomey_host;
  const host = () => band(st, f.id);
  assert.ok(f.x < st.W / 3, 'in the west');
  assert.ok(host().length >= 18, `${host().length} warriors`);
  assert.ok(host().some((u) => u.type === 'agojie') && host().some((u) => u.type === 'dahomey'), 'Agojie swordswomen and musketeers');
  assert.ok(host().every((u) => ['agojie', 'dahomey'].includes(u.type)), 'every one of them a woman of the Agojie');
  assert.ok(st.buildings.some((b) => b.owner === f.id && !b.dead), 'their camp');
  sim.chooseEvent(st, 0);
  const march = st.scheduled.find((s) => s.id === 'dahomey_march');
  assert.ok(march && march.day - st.time.day >= 12, 'time to prepare');
  assert.ok(until(st, 'dahomey_march_seen', 20), 'they march');
  assert.ok(f.marching);
  assert.ok(st.units.some((u) => u.ally === 'egba' && !u.dead), 'the Ẹ̀gbá come');
  assert.equal(st.units.filter((u) => u.ally === 'tinubu' && u.type === 'musketeer' && !u.dead).length, 3, 'and Madam Tinúbú’s gunmen');
  sim.chooseEvent(st, 0);
  kill(st, host());
  for (let k = 0; k < 40 && !f.beaten; k++) sim.tick(st);
  assert.ok(f.beaten);
  assert.equal(st.eventQueue[0]?.id, 'dahomey_beaten');
  sim.chooseEvent(st, 0);
  assert.ok(st.flags.ogunWon);
});

test('gifts to the west buy more time before Dahomey marches', () => {
  const days = (choice) => {
    const st = ogun(45);
    st.era = 1;
    st.eventQueue.push({ id: 'dahomey_word' });
    sim.chooseEvent(st, choice);
    advance(st, 24 * 11);
    return st.scheduled.find((s) => s.id === 'dahomey_march').day;
  };
  assert.ok(days(1) > days(0));
});

test('a player can play Ogun from the first day to breaking Dahomey', () => {
  const st = sim.newGame({ region: 'ogun', seed: 103, guide: false });
  const bot = makeBot(st);
  const seen = new Set();
  for (let i = 0; st.time.day < 160 && !st.gameOver && !st.flags.ogunWon; i++) {
    for (const e of st.eventQueue) seen.add(e.id);
    if (st.eventQueue.length || i % 100 === 0) botTick(bot);
    sim.tick(st);
  }
  assert.ok(!st.gameOver, st.gameOver?.reason);
  for (const id of ['ogun_intro', 'kidnappers', 'oyo_ilari', 'lisabi', 'ijebu_road', 'owu_refugees', 'abeokuta', 'tinubu', 'dahomey_word', 'dahomey_host_seen', 'dahomey_march_seen', 'dahomey_beaten']) {
    assert.ok(seen.has(id), `the story reached ${id}`);
  }
  assert.ok(st.flags.ogunWon, `Ogun won by day ${st.time.day}`);
  assert.ok(st.era >= 2, 'the Town age, quicker the second time');
});
