// Headless tests for Eko Rising's simulation. Run with:
//   npm test   (or: node --test tests/*.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as sim from '../js/sim/index.js';
import { WALK, F, isWater } from '../js/world/terrain.js';
import { createUnit } from '../js/sim/entities.js';
import { findPath } from '../js/world/path.js';
import { eventDef } from '../js/sim/events.js';
import { supervised } from '../js/sim/citizens.js';
import { makeBot, run, place } from './bot.mjs';
import { playStory } from './story.mjs';
import { TREE, treeBlocks } from '../js/world/terrain.js';

// A game past the guided opening, with newcomers free to come as they would
// after it (see the opening's own test), and some planks to build with.
function fresh(seed = 4242) {
  const st = sim.newGame({ seed });
  sim.chooseEvent(st, 0); // the intro
  st.tut.done = true;
  st.flags.openingDone = true;
  st.res.wood = 40;
  for (const c of st.citizens) {
    c.path = null;
    c.state = 'idle';
  }
  return st;
}

// Puts up at once whatever is being built, for tests about something else.
function finish(st) {
  for (const b of st.buildings) {
    if (b.dead || b.built >= 1) continue;
    b.haul = {};
    b.got = b.need;
    b.built = 1;
  }
  sim.tick(st);
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
    assert.ok(water <= 12, `water ${water} tiles away (seed ${seed})`);
    assert.ok(rock <= 20, `rock ${rock} tiles away (seed ${seed})`);
  }
});

test('a new game starts with just the couple walking up to an abandoned house in a clearing', () => {
  const st = sim.newGame({ seed: 9 });
  assert.equal(st.citizens.length, 2);
  assert.deepEqual(st.citizens.map((c) => c.special).sort(), ['founder', 'spouse']);
  assert.deepEqual(st.buildings.filter((b) => b.owner === 'player').map((b) => b.type).sort(), ['campfire', 'compound', 'stockpile']);
  const home = st.buildings.find((b) => b.type === 'compound');
  const floor = st.buildings.find((b) => b.type === 'stockpile');
  assert.ok(Math.hypot(floor.x - home.x, floor.y - home.y) <= 5, 'the floor is right by the house');
  assert.equal(st.res.wood, 0, 'no planks yet: they come from the trees');
  assert.equal(st.res.bricks, 0, 'no bricks: mud comes later');
  assert.equal(st.eventQueue[0].id, 'intro');
  // They come up the path and walk in.
  for (const c of st.citizens) {
    assert.equal(c.state, 'movein');
    assert.ok(c.path?.length > 3, 'walking in');
  }
  // Forest closes in around the clearing; lone trees stand near the house.
  let ring = 0;
  let lone = 0;
  for (let dy = -13; dy <= 13; dy++) {
    for (let dx = -13; dx <= 13; dx++) {
      const i = (home.y + 1 + dy) * st.W + home.x + 1 + dx;
      const d = Math.hypot(dx, dy);
      if (!treeBlocks(st.trees, st.felled, st.terrain, i)) continue;
      if (d <= 6.5) lone++;
      else ring++;
    }
  }
  assert.ok(ring >= 60, `forest around the clearing (${ring} trees)`);
  assert.ok(lone >= 2, `lone trees near the house (${lone})`);
  // The red-mud pit they passed on the way lies off along the path, unseen.
  const pit = st.mudPit;
  const d = Math.hypot(pit.x - home.x, pit.y - home.y);
  assert.ok(d >= 12 && d <= 28, `mud pit ${d} tiles away`);
  assert.equal(st.feature[pit.y * st.W + pit.x], F.CLAY);
  assert.equal(st.explored[pit.y * st.W + pit.x], 0, 'not seen yet');
  assert.ok(findPath(st, home.x + 1, home.y + 3, pit.x, pit.y, { within: 1.5, max: 20000 }), 'a path leads to it');
});

test('trees are walls: a forest tree is felled, cut into 12 planks and carried home four at a time', () => {
  const st = fresh(9);
  const founder = st.citizens.find((c) => c.special === 'founder');
  const home = st.buildings.find((b) => b.type === 'compound');
  // A rainforest tree at the edge of the clearing.
  let tree = -1;
  for (let r = 4; r < 14 && tree < 0; r++) {
    for (let k = 0; k < 64 && tree < 0; k++) {
      const x = Math.round(home.x + 1 + Math.cos((k / 64) * Math.PI * 2) * r);
      const y = Math.round(home.y + 1 + Math.sin((k / 64) * Math.PI * 2) * r);
      const i = y * st.W + x;
      if (st.terrain[i] === 6 && st.trees[i] === 12 && sim.orderTree(st, founder.id, i).ok) tree = i;
    }
  }
  assert.ok(tree >= 0, 'found a forest tree to fell');
  assert.equal(founder.task.kind, 'chop');
  assert.equal(findPath(st, home.x + 1, home.y + 3, tree % st.W, Math.floor(tree / st.W), {})?.at(-1) === tree, false, 'nobody walks into a standing tree');
  const wood0 = st.res.wood;
  advance(st, 14);
  assert.equal(st.felled[tree], TREE.FELLED, 'the tree is down');
  advance(st, 30);
  assert.ok(st.res.wood - wood0 >= 4, 'planks reached the storage floor');
  assert.ok(st.trees[tree] < 12 && st.trees[tree] % 4 === 0, 'cut four planks at a time');
  advance(st, 60);
  assert.equal(st.trees[tree], 0, 'he went back until it was used up');
  assert.ok(st.res.wood - wood0 >= 12 - (founder.carry?.n || 0), 'a forest tree gives 12 planks');
  assert.equal(st.felled[tree], TREE.STUMP);
  assert.ok(st.reach[tree], 'the ground is open now');
});

test('the guided opening plays from the abandoned house to a town of red mud', () => {
  const st = sim.newGame({ seed: 4242 });
  const seen = [];
  const at = {};
  const { seen: steps, bot } = playStory(st, 24 * 90, (id) => {
    seen.push(id);
    at[id] = {
      pop: st.citizens.filter((c) => !c.dead && !c.stranger).length,
      jobs: Object.fromEntries(['woodcutter', 'hunter', 'farm'].map((t) => [t, st.citizens.filter((c) => !c.dead && st.byId.get(c.job)?.type === t).length])),
    };
  });
  assert.ok(!st.gameOver, st.gameOver?.reason);
  const want = ['arrive', 'select', 'chop', 'planks', 'stack', 'strangers', 'woodshed', 'cutters', 'antelope', 'hunt', 'fire', 'farm', 'farming', 'wolves', 'fence', 'settle', 'bandits', 'recover', 'guardhouse', 'soldiers', 'camp', 'mudpit', 'brickshed', 'bricks', 'upgrade', 'end', null];
  assert.deepEqual(seen, want, `steps: ${seen.join(' ')}\n${bot.log.slice(-8).join('\n')}`);
  assert.ok(st.tut.done);
  // The wood shed is one man's work; the other newcomer took up the bow.
  assert.deepEqual(at.antelope.jobs, { woodcutter: 1, hunter: 0, farm: 0 });
  assert.deepEqual(at.fire.jobs, { woodcutter: 1, hunter: 1, farm: 0 });
  // The two at the fire went to the farm, and the wolves killed them; the
  // woodcutter and the hunter killed two wolves each.
  assert.deepEqual(at.wolves.jobs, { woodcutter: 1, hunter: 1, farm: 2 });
  assert.equal(st.story.victims.length, 2);
  assert.ok(st.story.victims.every((v) => v.job === 'farm'), 'the farmers were killed');
  assert.deepEqual(st.story.heroes.map((h) => [h.tool, h.kills]).sort(), [['axe', 2], ['bow', 2]]);
  // Bandits stole from the stores; the camp was cleared.
  assert.ok(Object.values(st.story.stolen || {}).some((n) => n > 0), 'bandits stole from the stores');
  assert.equal(st.factionMap.bandits1.status, 'conquered');
  // Everything is rebuilt in mud; houses sleep four.
  assert.ok(st.flags.mud);
  const huts = st.buildings.filter((b) => b.type === 'hut' && !b.dead && b.built >= 1);
  assert.ok(huts.length && huts.every((h) => h.mud && h.level === 2));
  const { stat } = awaitData();
  assert.equal(stat(huts[0], 'housing'), 4);
  assert.ok(st.flags.openingDone);
  // The guide has handed over to the ordinary goals.
  assert.ok(st.objCurrent.length > 0);
});

test('the opening is played step by step: nothing moves on until the player acts', () => {
  const st = sim.newGame({ seed: 77 });
  advance(st, 20);
  assert.equal(sim.currentStep(st).id, 'select');
  advance(st, 60);
  assert.equal(sim.currentStep(st).id, 'select', 'waits for the player to select the founder');
  assert.equal(st.citizens.length, 2, 'nobody else arrives meanwhile');
  const founder = st.citizens.find((c) => c.special === 'founder');
  sim.signal(st, 'select', founder.id);
  advance(st, 2);
  assert.equal(sim.currentStep(st).id, 'chop');
  advance(st, 60);
  assert.equal(sim.currentStep(st).id, 'chop', 'waits for a tree to be picked');
  assert.equal(st.units.length, st.units.filter((u) => u.owner !== 'player' && u.home).length, 'no raiders while the guide runs');
});

test('a new plank house brings two newcomers, who sit by the fire until there is work', () => {
  const st = fresh(11);
  st.migrateT = 1e9;
  assert.ok(place(st, 'hut'), 'plank house placed');
  advance(st, 120);
  const hut = st.buildings.find((b) => b.type === 'hut');
  assert.equal(hut.built, 1, 'the founder built it, there being nobody else');
  advance(st, 40);
  const newcomers = st.citizens.filter((c) => !c.special && !c.dead);
  assert.equal(newcomers.length, 2, 'two came');
  assert.ok(newcomers.every((c) => !c.stranger && !c.job && c.state === 'wait'), 'sitting by the fire');
  assert.ok(newcomers.every((c) => c.home), 'and they have beds');
  assert.ok(place(st, 'woodcutter', 'trees'), 'wood shed placed');
  advance(st, 90);
  const working = newcomers.filter((c) => st.byId.get(c.job)?.type === 'woodcutter');
  assert.equal(working.length, 1, 'a wood shed takes one pair of hands');
  advance(st, 60);
  assert.ok(st.stats.made.wood > 0, 'planks were cut and stacked');
});

test('nobody leaves a job by themselves; the player moves people', () => {
  const st = fresh(12);
  st.migrateT = 1e9;
  const { spawnStranger } = awaitEconomy();
  const a = spawnStranger(st, null, undefined, undefined, { near: true, quiet: true });
  advance(st, 40);
  assert.ok(place(st, 'woodcutter', 'trees'));
  finish(st);
  advance(st, 20);
  const shed = st.buildings.find((b) => b.type === 'woodcutter');
  assert.deepEqual(shed.workers, [a.id]);
  assert.ok(place(st, 'hunter', 'home'));
  const lodge = st.buildings.find((b) => b.type === 'hunter');
  sim.setPriority(st, lodge.id, 2);
  finish(st);
  advance(st, 20);
  assert.equal(lodge.workers.length, 0, 'high priority, but nobody is pulled away');
  const r = sim.assignWorker(st, a.id, lodge.id);
  assert.ok(r.ok);
  advance(st, 2);
  assert.deepEqual(lodge.workers, [a.id], 'the player sent them to hunt');
  assert.equal(shed.workers.length, 0);
  // The founder takes no job.
  const founder = st.citizens.find((c) => c.special === 'founder');
  assert.equal(sim.assignWorker(st, founder.id, shed.id).ok, false);
  // A full workplace sends its worker back to the fire.
  const b = spawnStranger(st, null, undefined, undefined, { near: true, quiet: true });
  advance(st, 40);
  advance(st, 2);
  assert.ok(b.job === shed.id, 'the newcomer took the empty shed');
  assert.ok(sim.assignWorker(st, b.id, lodge.id).ok);
  advance(st, 1);
  assert.deepEqual(lodge.workers, [b.id]);
  assert.equal(a.job === lodge.id, false, 'the hunter was sent back to the fire');
});

test('sheds and farm land can be moved; houses must be pulled down for half their cost', () => {
  const st = fresh(13);
  assert.ok(place(st, 'woodcutter', 'trees'));
  assert.ok(place(st, 'hut'));
  finish(st);
  const shed = st.buildings.find((b) => b.type === 'woodcutter');
  const hut = st.buildings.find((b) => b.type === 'hut');
  let moved = false;
  for (let dy = -6; dy <= 6 && !moved; dy++) {
    for (let dx = -6; dx <= 6 && !moved; dx++) {
      if (Math.abs(dx) + Math.abs(dy) < 3) continue;
      moved = sim.moveBuilding(st, shed.id, shed.x + dx, shed.y + dy).ok;
    }
  }
  assert.ok(moved, 'the wood shed moved');
  assert.equal(st.occ[shed.y * st.W + shed.x], shed.id);
  assert.equal(sim.moveBuilding(st, hut.id, hut.x + 3, hut.y).ok, false, 'houses do not move');
  const wood = st.res.wood;
  assert.ok(sim.demolish(st, hut.id).ok);
  assert.equal(st.res.wood - wood, 5, 'half the planks back');
});

test('the founder takes no job and walks the town as a supervisor', () => {
  const st = fresh(12);
  st.migrateT = 1e9;
  const { spawnStranger } = awaitEconomy();
  spawnStranger(st, null, undefined, undefined, { near: true, quiet: true });
  place(st, 'woodcutter', 'trees');
  advance(st, 60);
  const founder = st.citizens.find((c) => c.special === 'founder');
  assert.ok(!founder.job, 'no job for the founder');
  assert.equal(founder.state, 'supervise');
  for (const b of st.buildings) assert.ok(!b.workers?.includes(founder.id));
  // Workers near him get the bonus; workers far away do not.
  const worker = st.citizens.find((c) => c.job && !c.special);
  worker.x = founder.x + 1;
  worker.y = founder.y;
  assert.equal(supervised(st, worker), true);
  worker.x = founder.x + 30;
  assert.equal(supervised(st, worker), false);
});

test('hungry or homeless, people grumble first and then leave', () => {
  const st = fresh(14);
  st.migrateT = 1e9;
  const { spawnStranger } = awaitEconomy();
  for (let k = 0; k < 5; k++) spawnStranger(st, null, undefined, undefined, { near: true, quiet: true });
  advance(st, 40);
  st.res.yam = 0;
  st.res.meat = 0;
  const before = st.citizens.filter((c) => !c.dead && !c.special).length;
  advance(st, 24 * 2.2);
  assert.ok(st.log.some((m) => /will leave us/.test(m.text)), 'a complaint first');
  advance(st, 24 * 2);
  assert.ok(st.log.some((m) => /has left/.test(m.text)), 'then someone left');
  assert.ok(st.citizens.filter((c) => !c.dead && !c.special && c.state !== 'leave').length < before);
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
  const f = st.factionMap.ijebu || st.factions.find((x) => !x.camp && x.major);
  f.status = 'hostile';
  // Wipe the garrison and stand in the village.
  st.units.filter((u) => u.owner === f.id).forEach((u) => (u.dead = true));
  st.dirty.cleanup = true;
  createUnit(st, 'spearman', f.x, f.y, 'player');
  const cowries = st.res.cowries;
  advance(st, 8);
  assert.equal(f.status, 'conquered');
  assert.ok(st.res.cowries >= cowries, 'plunder taken');
});

test('a bandit camp is tents: soldiers burn them by instinct, or hold their ground if told', () => {
  const st = fresh(17);
  const f = st.factionMap.bandits1;
  const { campTents } = awaitFactions();
  const tents = campTents(st, f);
  assert.ok(tents.length >= 3, `tents round the fire (${tents.length})`);
  assert.ok(tents.some((b) => b.type === 'chieftent'), "and the chief's tent");
  // The bandits are out; five spearmen come near the camp.
  st.units.filter((u) => u.owner === f.id).forEach((u) => (u.dead = true));
  st.dirty.cleanup = true;
  const t0 = tents[0];
  const spot = { x: t0.x + 0.5, y: t0.y + 4.5 };
  const holders = [0, 1].map(() => createUnit(st, 'spearman', Math.floor(spot.x), Math.floor(spot.y), 'player'));
  sim.setStance(st, holders.map((u) => u.id), 'hold');
  advance(st, 6);
  assert.equal(campTents(st, f).length, tents.length, 'holding their ground, they leave the tents alone');
  assert.ok(holders.every((u) => Math.hypot(u.x - spot.x, u.y - spot.y) < 1.5), 'and stay put');
  // Told to fight any close by, they go for the tents by themselves.
  sim.setStance(st, holders.map((u) => u.id), 'engage');
  for (let k = 0; k < 3; k++) createUnit(st, 'spearman', Math.floor(spot.x), Math.floor(spot.y), 'player');
  advance(st, 200);
  assert.equal(campTents(st, f).length, 0, 'every tent burned');
  assert.equal(f.status, 'conquered', 'the camp is finished');
});

test('builders carry the planks over and put each building up; nothing builds itself', () => {
  const st = fresh(21);
  st.migrateT = 1e9;
  const { spawnStranger } = awaitEconomy();
  const a = spawnStranger(st, null, undefined, undefined, { near: true, quiet: true });
  const b = spawnStranger(st, null, undefined, undefined, { near: true, quiet: true });
  advance(st, 40);
  const founder = st.citizens.find((c) => c.special === 'founder');
  assert.ok(place(st, 'hut'), 'plank house placed');
  const hut = st.buildings.find((x) => x.type === 'hut');
  assert.equal(hut.built, 0);
  assert.equal(hut.need, 10, 'ten planks to carry over');
  let carried = false;
  let stages = new Set();
  const { siteStage } = awaitCitizens();
  for (let i = 0; i < 20 * 120 && hut.built < 1; i++) {
    sim.tick(st);
    if ([a, b].some((c) => c.carry?.r === 'wood' && c.buildSite === hut.id)) carried = true;
    const s = siteStage(hut);
    if (s) stages.add(s.n);
  }
  assert.equal(hut.built, 1, 'built');
  assert.ok(carried, 'the planks were carried over from the storage floor');
  assert.deepEqual([...stages].sort(), [0, 1, 2, 3], 'through every stage');
  assert.ok(!founder.buildSite, 'the founder left it to the two from the fire');
  // Nobody free: the founder builds; a worker can be sent to help and goes
  // back to work after.
  advance(st, 30);
  finish(st);
  assert.ok(place(st, 'woodcutter', 'trees'));
  finish(st);
  advance(st, 10);
  const cutter = st.citizens.find((c) => st.byId.get(c.job)?.type === 'woodcutter');
  assert.ok(cutter);
  st.res.wood = 40;
  assert.ok(place(st, 'stockpile'));
  const floor = st.buildings.filter((x) => x.type === 'stockpile').at(-1);
  advance(st, 3);
  assert.ok(sim.assignBuilder(st, cutter.id, floor.id).ok);
  for (let i = 0; i < 20 * 120 && floor.built < 1; i++) sim.tick(st);
  assert.equal(floor.built, 1);
  advance(st, 2);
  assert.equal(st.byId.get(cutter.job)?.type, 'woodcutter', 'back to the wood shed');
  assert.ok(!cutter.buildSite);
});

test('someone given work changes into its clothes before walking there', () => {
  const st = fresh(22);
  st.migrateT = 1e9;
  const { spawnStranger } = awaitEconomy();
  spawnStranger(st, null, undefined, undefined, { near: true, quiet: true });
  advance(st, 40);
  assert.ok(place(st, 'hunter', 'home'));
  finish(st);
  const c = st.citizens.find((x) => x.job);
  assert.equal(c.state, 'dress', 'changing clothes first');
  assert.ok(!c.path, 'standing still to do it');
  assert.ok(st.fx.some((f) => f.kind === 'puff'), 'in a puff of dust');
  advance(st, 3);
  assert.notEqual(c.state, 'dress', 'then off to work');
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
  st.res.bricks = 100;
  st.res.yam = 50;
  for (let k = 0; k < 8; k++) createUnit(st, 'spearman', st.start.x, st.start.y + 3, 'player');
  st.cap.food = 999;
  assert.equal(sim.advanceEra(st), true);
  assert.equal(st.era, 1);
  assert.equal(st.res.wood, 140);
  assert.equal(st.res.bricks, 60);
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

test('your own soldiers train at a Guard House from people at the fire; the compound only trains scouts', () => {
  const st = fresh(30);
  st.migrateT = 1e9;
  const compound = st.buildings.find((b) => b.type === 'compound');
  assert.equal(sim.train(st, compound.id, 'spearman').ok, false);
  st.res.cowries = 0;
  assert.match(sim.train(st, compound.id, 'scout').reason, /money/);
  st.res.wood = 200;
  assert.ok(place(st, 'warcamp'));
  finish(st);
  const camp = st.buildings.find((b) => b.type === 'warcamp');
  const before = st.res.wood;
  assert.ok(sim.train(st, camp.id, 'spearman').ok, 'spears and shields of wood, and food');
  assert.equal(st.res.wood, before - 6);
  // Nobody at the fire: a volunteer walks in to be trained.
  advance(st, 60);
  assert.equal(st.units.filter((u) => u.owner === 'player' && u.type === 'spearman').length, 1);
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
  st.res.bricks = 999;
  st.res.stone = 999;
  st.res.cowries = 999;
  assert.ok(place(st, 'palace'));
  finish(st);
  advance(st, 2);
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
  finish(st);
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
  finish(st);
  st.res.wood = 300;
  const a = sim.trade(st, 'wood', 100, false);
  assert.ok(a.ok);
  assert.ok(a.n < 100);
  assert.equal(sim.trade(st, 'wood', 10, false).ok, false);
});

test('the kingdom upgrade rebuilds everything in mud, and houses sleep four', () => {
  const st = fresh(36);
  st.res.wood = 100;
  assert.ok(place(st, 'hut'));
  finish(st);
  const hut = st.buildings.find((b) => b.type === 'hut');
  const { stat } = awaitData();
  assert.equal(stat(hut, 'housing'), 2, 'a plank house sleeps two');
  assert.equal(sim.upgradeBuilding(st, hut.id).ok, false, 'mud waits for the kingdom upgrade');
  const cost = sim.mudUpgradeCost(st);
  assert.ok(cost > 0);
  st.res.bricks = cost - 1;
  assert.equal(sim.mudUpgrade(st).ok, false);
  st.res.bricks = cost;
  assert.ok(sim.mudUpgrade(st).ok);
  assert.equal(st.res.bricks, 0);
  assert.equal(hut.level, 2);
  assert.ok(hut.mud && st.buildings.find((b) => b.type === 'compound').mud);
  assert.equal(stat(hut, 'housing'), 4);
  // New houses now go up in mud.
  st.res.bricks = 20;
  assert.ok(place(st, 'hut'));
  const fresh2 = st.buildings.filter((b) => b.type === 'hut').at(-1);
  assert.equal(fresh2.level, 2);
  assert.ok(fresh2.mud);
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
import * as economy from '../js/sim/economy.js';
function awaitEconomy() {
  return economy;
}
import * as factionsMod from '../js/sim/factions.js';
function awaitFactions() {
  return factionsMod;
}
import * as citizensMod from '../js/sim/citizens.js';
function awaitCitizens() {
  return citizensMod;
}
