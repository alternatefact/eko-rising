// Kano, the northern home kingdom (DESIGN.md, milestone 2): the same guided
// opening as Èkó in Hausa words, with hyenas for the wolves, then the Hausa
// kingdoms, the desert caravans and the host of Kwararafa.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as sim from '../js/sim/index.js';
import { damage } from '../js/sim/military.js';
import { BUILDINGS } from '../js/data/buildings.js';
import { RESOURCES } from '../js/data/resources.js';
import { UNITS } from '../js/data/units.js';
import { HAUSA } from '../js/cultures/hausa.js';
import { YORUBA } from '../js/cultures/yoruba.js';
import { eraName } from '../js/cultures/index.js';
import { PROVINCES, PROVINCE } from '../js/campaign/provinces.js';
import { GEOMETRY } from '../js/campaign/geometry.js';
import { provinceStatus } from '../js/ui/kingdoms.js';
import { makeBot, botTick } from './bot.mjs';
import { playStory, makeStoryBot, storyAct } from './story.mjs';

// A Kano game a little way in, with the opening skipped.
function kano(seed = 31) {
  const st = sim.newGame({ region: 'kano', seed, guide: false });
  while (st.eventQueue.length) sim.chooseEvent(st, 0);
  st.res.cowries = 400;
  return st;
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
const hausaNames = new Set(HAUSA.origins.flatMap((o) => [...o.male, ...o.female]));

test('the map of the old kingdoms: 28 provinces, Èkó and Kano to play, Nri and Benin next', () => {
  assert.equal(PROVINCES.length, 28);
  for (const p of PROVINCES) {
    assert.ok(GEOMETRY.provinces[p.id]?.path, `${p.id} has a shape`);
    assert.ok(PROVINCE[p.id].neighbours.length > 0, `${p.id} has neighbours`);
  }
  assert.equal(provinceStatus(PROVINCE.eko), 'play');
  assert.equal(provinceStatus(PROVINCE.kano), 'play');
  assert.equal(provinceStatus(PROVINCE.nri), 'coming');
  assert.equal(provinceStatus(PROVINCE.benin), 'coming');
  assert.equal(provinceStatus(PROVINCE.egba), 'locked');
  assert.equal(provinceStatus(PROVINCE.egba, new Set(['ogun'])), 'chapter');
  assert.equal(provinceStatus(PROVINCE.kanem), 'campaign');
  assert.ok(PROVINCE.kano.neighbours.includes('katsina') && PROVINCE.kano.neighbours.includes('zazzau'));
});

test('a Kano game is Hausa: names, words, millet and the ages', () => {
  const st = sim.newGame({ region: 'kano', seed: 9 });
  assert.equal(st.founder, 'Garba');
  assert.equal(st.spouse, 'Hauwa');
  assert.equal(st.name, 'Dala');
  for (const c of st.citizens) assert.equal(c.people, 'Kano');
  assert.equal(RESOURCES.yam.name, 'Millet');
  assert.equal(BUILDINGS.farm.name, 'Millet Farm');
  assert.equal(BUILDINGS.palace.yo, 'Gidan Sarki');
  assert.equal(BUILDINGS.hut.yo, 'Bukka');
  assert.equal(BUILDINGS.woodcutter.yo, '', 'no Yoruba words in Kano');
  assert.equal(UNITS.horseman.yo, 'Ɗan doki');
  assert.equal(eraName(st, 0), 'Gona');
  assert.equal(eraName(st, 3), 'Birni');
  // No sea, and the clearing ringed by thorn woodland, not rainforest.
  assert.ok(!st.terrain.some((t) => t === 0), 'no ocean');
  // Back in Èkó, everything is called what it was.
  const lagos = sim.newGame({ seed: 9 });
  assert.equal(lagos.founder, 'Àdìó');
  assert.equal(RESOURCES.yam.name, 'Yam');
  assert.equal(BUILDINGS.farm.name, 'Yam Farm');
  assert.equal(BUILDINGS.hut.yo, 'Ilé Pákó');
  assert.equal(eraName(lagos, 0), YORUBA.eraNames[0]);
  // A Kano save loads as Kano.
  const again = sim.deserialize(sim.serialize(st));
  assert.equal(again.regionId, 'kano');
  assert.equal(BUILDINGS.farm.name, 'Millet Farm');
  sim.newGame({ seed: 1 });
});

test('the guided opening plays in Kano in Hausa words, with hyenas for the wolves', () => {
  const st = sim.newGame({ region: 'kano', seed: 4242 });
  const said = [];
  const pack = new Set();
  const { seen, bot } = playStory(st, 24 * 90, (id) => {
    for (const a of st.animals) if (a.phase) pack.add(a.type);
    const step = sim.currentStep(st);
    if (step) said.push([step.say, step.task, step.hint].map((v) => (typeof v === 'function' ? v(st) : v)).join(' '));
  });
  assert.ok(!st.gameOver, st.gameOver?.reason);
  const ids = seen.map((s) => s.id);
  assert.deepEqual(ids, ['arrive', 'mender', 'pickhouse', 'repair', 'mending', 'select', 'chop', 'planks', 'stack', 'strangers', 'woodshed', 'cutters', 'antelope', 'hunt', 'fire', 'farm', 'farming', 'wolves', 'fence', 'settle', 'bandits', 'recover', 'guardhouse', 'soldiers', 'camp', 'mudpit', 'brickshed', 'bricks', 'upgrade', 'end', null], bot.log.slice(-6).join('\n'));
  assert.ok(st.tut.done && st.flags.mud && st.flags.openingDone);
  // The pack was hyenas; the farmers fell, the woodcutter and hunter fought back.
  assert.deepEqual([...pack], ['hyena']);
  assert.equal(st.story.victims.length, 2);
  assert.deepEqual(st.story.heroes.map((h) => h.tool).sort(), ['axe', 'bow']);
  const text = said.join(' ');
  assert.match(text, /Hyenas!/);
  assert.match(text, /millet/);
  assert.match(text, /Millet Farm/);
  assert.doesNotMatch(text, /[Ww]olf|[Ww]olves|yams|lagoon/);
  // Everyone who came is from the Hausa lands and their neighbours.
  for (const c of st.citizens.filter((x) => !x.dead)) assert.ok(hausaNames.has(c.name) || c.special, `${c.name} of the ${c.people}`);
});

test('the Kwararafa host gathers in the south and marches; Zazzau comes to help, and breaking it wins Kano', () => {
  const st = kano(44);
  st.era = 1;
  const zazzau = st.factionMap.zazzau;
  zazzau.relation = 60;
  st.eventQueue.push({ id: 'kwararafa' });
  sim.chooseEvent(st, 1); // ask Zazzau
  assert.ok(st.flags.zazzauAid);
  assert.ok(until(st, 'kwararafa_host_seen', 10), 'they gather');
  const f = st.factionMap.kwararafa_host;
  const host = () => band(st, f.id);
  assert.ok(f.y > (st.H * 2) / 3 - 1, 'in the south');
  assert.ok(host().length >= 30, `${host().length} warriors`);
  assert.ok(['jukun', 'bowman', 'jukunrider'].every((t) => host().some((u) => u.type === t)), 'spearmen, archers and horsemen');
  sim.chooseEvent(st, 0);
  assert.ok(until(st, 'kwararafa_march_seen', 24), 'they march');
  assert.ok(f.marching);
  assert.ok(st.units.some((u) => u.ally === 'zazzau' && !u.dead), 'Zazzau comes');
  sim.chooseEvent(st, 0);
  kill(st, host());
  for (let k = 0; k < 40 && !f.beaten; k++) sim.tick(st);
  assert.ok(f.beaten);
  assert.ok(until(st, 'kwararafa_beaten', 1));
  sim.chooseEvent(st, 0);
  assert.ok(st.flags.kanoWon);
});

test('defying Kwararafa brings its riders up from the south before the host', () => {
  const st = kano(45);
  st.era = 1;
  st.eventQueue.push({ id: 'kwararafa' });
  sim.chooseEvent(st, 2);
  for (let k = 0; k < (24 * 3) / sim.STEP; k++) {
    while (st.eventQueue.length) sim.chooseEvent(st, 0);
    sim.tick(st);
  }
  const riders = st.units.filter((u) => u.owner === 'kwararafa' && u.type === 'jukunrider');
  assert.ok(riders.length >= 2, 'riders came');
  assert.ok(riders.every((u) => u.y > st.H / 2 || u.dead), 'from the south');
});

test('a player can play Kano from the first day to breaking Kwararafa', () => {
  const st = sim.newGame({ region: 'kano', seed: 104 });
  const story = makeStoryBot(st);
  const bot = makeBot(st);
  const seen = new Set();
  for (let i = 0; st.time.day < 180 && !st.gameOver && !st.flags.kanoWon; i++) {
    for (const e of st.eventQueue) seen.add(e.id);
    if (sim.storyRunning(st)) {
      if (i % 10 === 0) storyAct(story);
    } else if (st.eventQueue.length || i % 100 === 0) botTick(bot);
    sim.tick(st);
  }
  assert.ok(!st.gameOver, st.gameOver?.reason);
  for (const id of ['intro', 'wolves_slain', 'chapter_one', 'sarki', 'amina', 'caravan', 'kwararafa', 'kwararafa_host_seen', 'kwararafa_march_seen', 'kwararafa_beaten']) {
    assert.ok(seen.has(id), `the story reached ${id}`);
  }
  assert.ok(st.flags.kanoWon, `Kano won by day ${st.time.day}`);
});
