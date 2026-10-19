// Saves keep loading as the game changes: a real save made before Naija
// Rising (save version 4) is upgraded and plays on, and saves the game cannot
// read are refused with a message that says why.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

import * as sim from '../js/sim/index.js';
import { makeStoryBot, storyAct } from './story.mjs';

// A Lagos game 29 days in, partway through the guided opening, saved by the
// game as it was before the rename (Eko Rising, save version 4).
const v4 = () => gunzipSync(readFileSync(new URL('./fixtures/save-v4-lagos.json.gz', import.meta.url))).toString();

test('a version 4 save (from Eko Rising) loads, is upgraded, and plays on', () => {
  const raw = JSON.parse(v4());
  assert.equal(raw.version, 4);
  const st = sim.deserialize(v4());
  assert.equal(st.version, sim.SAVE_VERSION);
  assert.equal(st.name, raw.name);
  assert.equal(st.time.day, raw.time.day);
  assert.equal(st.buildings.length, raw.buildings.length);
  assert.equal(st.tut.i, raw.tut.i, 'the guide is where it was');
  assert.equal(st.legacy, null, 'a Lagos game from before carries nothing from another land');
  // Ten more days, the guide played as a player would.
  const bot = makeStoryBot(st);
  const end = st.time.day + 10;
  for (let i = 0; st.time.day < end && i < 200000; i++) {
    if (i % 10 === 0) storyAct(bot);
    sim.tick(st);
  }
  assert.equal(st.time.day, end, 'time went on');
  assert.ok(st.tut.i > raw.tut.i, 'the guide moved on');
  // It saves in the new version, and that loads too.
  assert.equal(JSON.parse(sim.serialize(st)).version, sim.SAVE_VERSION);
  assert.equal(sim.deserialize(sim.serialize(st)).time.day, end);
});

test('a version 4 save from before builders gets its building-site fields', () => {
  const raw = JSON.parse(v4());
  for (const b of raw.buildings) {
    for (const k of ['rising', 'work', 'builders', 'haul', 'got', 'need']) delete b[k];
  }
  const st = sim.deserialize(JSON.stringify(raw));
  for (const b of st.buildings) {
    assert.equal(typeof b.rising, 'boolean');
    assert.ok(b.work > 0 && Array.isArray(b.builders) && b.got === 0 && b.need === 0);
  }
  sim.tick(st);
});

test('an Ogun game keeps what its founders learned in Lagos through a save', () => {
  const legacy = { from: 'lagos', land: 'Lagos', town: 'Èkó', era: 2, year: 1475, tech: ['tools'], cassava: true, metEuropeans: false, purse: 60 };
  const st = sim.deserialize(sim.serialize(sim.newGame({ region: 'ogun', seed: 3, guide: false, legacy })));
  assert.deepEqual(st.legacy, legacy);
  assert.equal(sim.knownEra(st), 2);
});

test('saves the game cannot read are refused with a clear message', () => {
  const raw = JSON.parse(v4());
  assert.throws(() => sim.deserialize(JSON.stringify({ ...raw, version: 3 })), /much older version/);
  assert.throws(() => sim.deserialize(JSON.stringify({ ...raw, version: sim.SAVE_VERSION + 1 })), /newer version/);
  assert.throws(() => sim.deserialize(JSON.stringify({ ...raw, regionId: 'atlantis' })), /land/);
  assert.throws(() => sim.deserialize('{"hello":1}'), /no saved game/);
  assert.throws(() => sim.deserialize('[]'), /no saved game/);
});
