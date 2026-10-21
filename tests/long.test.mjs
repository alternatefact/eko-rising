// Every start played for 200 game days on a fixed seed, by the scripted
// players: the guided opening first where there is one, then the town player.
// Any error fails the test, and so does a state that has gone wrong (a person
// nowhere, a number that is not a number, two things with one id), checked
// every game day. The game must also save and load at the end.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as sim from '../js/sim/index.js';
import { makeBot, botTick } from './bot.mjs';
import { makeStoryBot, storyAct } from './story.mjs';

const DAYS = 200;

const STARTS = [
  { name: 'Lagos, with the guide', opts: { seed: 101 } },
  { name: 'Lagos, without the guide', opts: { seed: 102, guide: false } },
  { name: 'Ogun', opts: { region: 'ogun', seed: 103, guide: false } },
  { name: 'Kano, with the guide', opts: { region: 'kano', seed: 104 } },
  { name: 'Benin, with the guide', opts: { region: 'benin', seed: 104 } },
  { name: 'Warri, with the guide', opts: { region: 'warri', seed: 104 } },
  { name: 'Northern Igbo, with the guide', opts: { region: 'nigbo', seed: 104 } },
];

function check(st, when) {
  const at = `${when}, day ${st.time.day}`;
  assert.ok(Number.isFinite(st.time.t) && Number.isFinite(st.happy), `${at}: time or mood is not a number`);
  for (const [k, v] of Object.entries(st.res)) assert.ok(Number.isFinite(v), `${at}: ${k} is ${v}`);
  const ids = new Set();
  for (const list of [st.buildings, st.citizens, st.units, st.animals]) {
    for (const e of list) {
      assert.ok(!ids.has(e.id), `${at}: two things share id ${e.id}`);
      ids.add(e.id);
      if (e.dead) continue;
      assert.equal(st.byId.get(e.id), e, `${at}: ${e.kind} ${e.id} is not in the index`);
      if (e.kind === 'building') {
        assert.ok(Number.isFinite(e.hp) && e.hp <= e.maxHp + 1e-6, `${at}: ${e.type} ${e.id} has ${e.hp}/${e.maxHp} hp`);
        continue;
      }
      assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), `${at}: ${e.kind} ${e.id} is at ${e.x},${e.y}`);
      assert.ok(e.x >= 0 && e.y >= 0 && e.x <= st.W && e.y <= st.H, `${at}: ${e.kind} ${e.id} is off the map at ${e.x},${e.y}`);
    }
  }
}

for (const start of STARTS) {
  test(`${start.name}: 200 days on a fixed seed without an error`, () => {
    const st = sim.newGame(start.opts);
    const story = makeStoryBot(st);
    const bot = makeBot(st);
    let lastDay = -1;
    for (let i = 0; st.time.day < DAYS && !st.gameOver; i++) {
      assert.ok(i < 2e6, 'the game stopped moving');
      // The guided opening is played as the guide asks; after it, the town player.
      if (sim.storyRunning(st)) {
        if (i % 10 === 0) storyAct(story);
      } else if (st.eventQueue.length || i % 100 === 0) {
        botTick(bot);
      }
      sim.tick(st);
      if (st.time.day !== lastDay) {
        lastDay = st.time.day;
        check(st, start.name);
      }
    }
    assert.ok(!st.gameOver, `${start.name}: the game ended on day ${st.time.day}: ${st.gameOver?.reason}`);
    assert.equal(st.time.day, DAYS);
    const again = sim.deserialize(sim.serialize(st));
    assert.equal(again.time.day, DAYS);
    check(again, `${start.name}, saved and loaded`);
  });
}
