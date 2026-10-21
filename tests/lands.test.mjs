// Benin, Warri and the northern Igbo country: home kingdoms like Èkó and
// Kano, each in its people's words, with its own predator, soldiers and
// history, and a first great host to break.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as sim from '../js/sim/index.js';
import { damage } from '../js/sim/military.js';
import { eventDef } from '../js/sim/events.js';
import { RESOURCES } from '../js/data/resources.js';
import { CULTURES } from '../js/cultures/index.js';
import { makeBot, botTick } from './bot.mjs';
import { playStory, makeStoryBot, storyAct } from './story.mjs';

const LANDS = [
  { region: 'benin', culture: 'edo', founder: 'Osaro', spouse: 'Ivie', town: 'Igodomigodo', staple: 'Yam', beast: 'leopard', host: 'igala_host', side: 'east', types: ['igala', 'bowman', 'igalarider'], won: 'edoWon', word: 'idah', play: [107, true] },
  { region: 'warri', culture: 'itsekiri', founder: 'Tosan', spouse: 'Omawumi', town: 'Ijala', staple: 'Plantain', beast: 'crocodile', host: 'benin_fleet', side: 'north', types: ['benin', 'bowman'], won: 'warriWon', word: 'benin_claim', play: [105, false] },
  { region: 'nigbo', culture: 'igbo', founder: 'Nwankwo', spouse: 'Adaeze', town: 'Umunwankwo', staple: 'Yam', beast: 'leopard', host: 'aro_host', side: 'south', types: ['aroraider', 'arogun'], won: 'igboWon', word: 'aro', play: [106, false] },
];

function land(region, seed = 31) {
  const st = sim.newGame({ region, seed, guide: false });
  while (st.eventQueue.length) answer(st);
  st.res.cowries = 400;
  // Nobody to defend it: the robbers' camps keep to themselves.
  for (const f of st.factions) if (f.temperament === 'bandit') f.raids = false;
  return st;
}

// Answers the pop-up waiting with its first choice that can be made.
function answer(st) {
  const ev = eventDef(st, st.eventQueue[0]);
  const k = ev?.choices ? ev.choices.findIndex((c) => !c.can || c.can(st)) : 0;
  sim.chooseEvent(st, Math.max(0, k));
}

// Plays on until `id` is the story pop-up waiting, without answering it.
function until(st, id, days) {
  const end = st.time.day + days;
  while (st.time.day < end && st.eventQueue[0]?.id !== id && !st.gameOver) {
    while (st.eventQueue.length && st.eventQueue[0].id !== id) answer(st);
    if (st.eventQueue[0]?.id === id) break;
    sim.tick(st);
  }
  return st.eventQueue[0]?.id === id;
}

const band = (st, owner) => st.units.filter((u) => u.owner === owner && !u.dead);

for (const L of LANDS) {
  test(`${L.region}: its people's names and words`, () => {
    const st = sim.newGame({ region: L.region, seed: 9 });
    assert.equal(st.founder, L.founder);
    assert.equal(st.spouse, L.spouse);
    assert.equal(st.name, L.town);
    assert.equal(RESOURCES.yam.name, L.staple);
    const names = new Set(CULTURES[L.culture].origins.flatMap((o) => [...o.male, ...o.female]));
    for (const c of st.citizens) assert.ok(names.has(c.name), c.name);
    sim.newGame({ seed: 1 });
  });

  test(`${L.region}: the guided opening plays in its own words, with ${L.beast}s`, () => {
    const st = sim.newGame({ region: L.region, seed: 4242 });
    const pack = new Set();
    const said = [];
    const { seen, bot } = playStory(st, 24 * 90, () => {
      for (const a of st.animals) if (a.phase) pack.add(a.type);
      const step = sim.currentStep(st);
      if (step) said.push([step.say, step.task, step.hint].map((v) => (typeof v === 'function' ? v(st) : v)).join(' '));
    });
    assert.ok(!st.gameOver, st.gameOver?.reason);
    assert.equal(seen.length, 31, `${seen.map((s) => s.id).join(' ')}\n${bot.log.slice(-6).join('\n')}`);
    assert.ok(st.tut.done && st.flags.mud && st.flags.openingDone);
    assert.deepEqual([...pack], [L.beast]);
    assert.equal(st.story.victims.length, 2);
    const text = said.join(' ');
    assert.doesNotMatch(text, /[Ww]olf|[Ww]olves|[Hh]yena|Millet|Dala/);
  });

  test(`${L.region}: its host gathers in the ${L.side}, marches, and breaking it wins the land`, () => {
    const st = land(L.region, 44);
    st.era = 1;
    st.eventQueue.push({ id: L.word });
    // Gifts: no riders first, and more time before the march.
    const choice = eventDef(st, st.eventQueue[0]).choices.findIndex((c) => /^Send rich gifts/.test(c.label));
    sim.chooseEvent(st, choice);
    assert.ok(until(st, `${L.host}_seen`, 10), 'they gather');
    const f = st.factionMap[L.host];
    const host = () => band(st, f.id);
    if (L.side === 'east') assert.ok(f.x > (st.W * 2) / 3 - 1);
    if (L.side === 'north') assert.ok(f.y < st.H / 3 + 1);
    if (L.side === 'south') assert.ok(f.y > (st.H * 2) / 3 - 1);
    assert.ok(host().length >= 24, `${host().length} warriors`);
    assert.ok(L.types.every((t) => host().some((u) => u.type === t)), `${L.types.join(', ')}`);
    sim.chooseEvent(st, 0);
    assert.ok(until(st, `${L.host}_march_seen`, 40), `they march (${st.gameOver?.reason || 'standing'})`);
    sim.chooseEvent(st, 0);
    host().forEach((u) => damage(st, null, u, 1e6));
    for (let k = 0; k < 40 && !f.beaten; k++) sim.tick(st);
    assert.ok(f.beaten);
    assert.ok(until(st, `${L.host}_beaten`, 1));
    sim.chooseEvent(st, 0);
    assert.ok(st.flags[L.won]);
  });

  test(`${L.region}: a player can play from the first day to breaking the host`, () => {
    const [seed, guide] = L.play;
    const st = sim.newGame({ region: L.region, seed, ...(guide ? {} : { guide: false }) });
    const story = makeStoryBot(st);
    const bot = makeBot(st);
    for (let i = 0; st.time.day < 180 && !st.gameOver && !st.flags[L.won]; i++) {
      if (sim.storyRunning(st)) {
        if (i % 10 === 0) storyAct(story);
      } else if (st.eventQueue.length || i % 100 === 0) botTick(bot);
      sim.tick(st);
    }
    assert.ok(!st.gameOver, st.gameOver?.reason);
    assert.ok(st.flags[L.won], `won by day ${st.time.day}`);
  });
}

test('Benin: Queen Mother Idia brings her own warriors when the Igala march', () => {
  const st = land('benin', 45);
  st.era = 1;
  st.eventQueue.push({ id: 'idah' });
  sim.chooseEvent(st, 2);
  assert.ok(until(st, 'igala_host_seen', 10));
  sim.chooseEvent(st, 0);
  assert.ok(until(st, 'idia', 3), 'Idia comes');
  sim.chooseEvent(st, 0);
  assert.ok(until(st, 'igala_host_march_seen', 40));
  assert.equal(st.units.filter((u) => u.ally === 'idia' && !u.dead).length, 6);
});

test('Northern Igbo: the Nri priests send a third of the Aro war bands home', () => {
  const st = land('nigbo', 46);
  st.era = 1;
  st.flags.nriFriend = true;
  st.eventQueue.push({ id: 'aro' });
  sim.chooseEvent(st, 0);
  assert.ok(st.flags.nriPeace);
  assert.ok(until(st, 'aro_host_seen', 10));
  const before = band(st, 'aro_host').length;
  sim.chooseEvent(st, 0);
  assert.ok(until(st, 'aro_host_march_seen', 40));
  assert.equal(band(st, 'aro_host').length, before - Math.floor(before / 3));
  assert.match(eventDef(st, st.eventQueue[0]).text(st), /Nri priests/);
});

test('Warri: the Urhobo come to stand with you when Benin’s fleet marches', () => {
  const st = land('warri', 47);
  st.era = 1;
  st.factionMap.urhobo.relation = 60;
  st.eventQueue.push({ id: 'benin_claim' });
  const ask = eventDef(st, st.eventQueue[0]).choices.findIndex((c) => /Urhobo/.test(c.label));
  sim.chooseEvent(st, ask);
  assert.ok(until(st, 'benin_fleet_seen', 10));
  sim.chooseEvent(st, 0);
  assert.ok(until(st, 'benin_fleet_march_seen', 40));
  assert.ok(st.units.some((u) => u.ally === 'urhobo' && !u.dead));
});
