// Elite units (DESIGN.md, milestone 3): each people trains its own from the
// Town age, hires others' from allies, and each fights in its own way. No
// soldier wins every fight.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as sim from '../js/sim/index.js';
import { UNITS, ELITES } from '../js/data/units.js';
import { CULTURES } from '../js/cultures/index.js';
import { canTrain, damage, afloat } from '../js/sim/military.js';
import { hireOptions } from '../js/sim/economy.js';
import { createUnit, createBuilding } from '../js/sim/entities.js';
import { tileCost } from '../js/world/path.js';
import { pathOpts } from '../js/sim/move.js';
import { T } from '../js/world/terrain.js';
import { battle } from './fight.mjs';

const ELITE_OF = { lagos: 'eso', kano: 'lifidi', nigbo: 'abam', benin: 'leopardguard', warri: 'canoegun' };

// A town in the Town age with everything an elite costs, and a Guard House.
function town(region, seed = 5) {
  const st = sim.newGame({ region, seed, guide: false });
  while (st.eventQueue.length) sim.chooseEvent(st, 0);
  st.era = 2;
  Object.assign(st.res, { cowries: 2000, horses: 10, weapons: 40, cloth: 40, iron: 40, wood: 300, yam: 300 });
  const home = st.buildings.find((b) => b.type === 'compound');
  home.wrecked = false;
  const gh = createBuilding(st, 'warcamp', home.x + 6, home.y + 6, { instant: true });
  return { st, gh };
}

test('each people trains its own elite from the Town age, and no other', () => {
  for (const [region, mine] of Object.entries(ELITE_OF)) {
    const { st, gh } = town(region);
    assert.equal(CULTURES[st.region.culture].elite, mine, region);
    assert.ok(canTrain(st, gh, mine).ok, `${region} trains ${mine}: ${canTrain(st, gh, mine).reason}`);
    for (const other of ELITES.filter((e) => e !== mine)) {
      const r = canTrain(st, gh, other);
      assert.ok(!r.ok && r.foreign, `${region} cannot train ${other}`);
    }
    // Not before the Town age.
    st.era = 1;
    if (st.legacy) st.legacy.era = 0;
    assert.ok(!canTrain(st, gh, mine).ok, `${region}: not in the Compound age`);
    st.era = 2;
    // Trained, he takes the field.
    sim.train(st, gh.id, mine);
    for (let k = 0; k < 24 * 60 && !st.units.some((u) => u.type === mine); k++) {
      while (st.eventQueue.length) sim.chooseEvent(st, 0);
      sim.tick(st);
    }
    assert.ok(st.units.some((u) => u.owner === 'player' && u.type === mine), `${region} fields a ${mine}`);
  }
});

test('allies of another people lend their elite for a wage', () => {
  // Warri's neighbours: the Oba's river post is Edo, and lends Leopard Guards.
  const { st, gh } = town('warri');
  assert.ok(!hireOptions(st).some((h) => h.unit === 'leopardguard'), 'not while they are only neighbours');
  st.factionMap.edopost.status = 'allied';
  const h = hireOptions(st).find((o) => o.unit === 'leopardguard');
  assert.ok(h && h.from && h.wage > 0, 'Leopard Guards for hire');
  // Your own elite is trained, never hired.
  assert.ok(!hireOptions(st).some((o) => o.unit === 'canoegun'));
  const home = st.buildings.find((b) => b.type === 'compound');
  const r = sim.hire(st, home.id, h.id);
  assert.ok(r.ok, r.reason);
  assert.equal(r.unit.type, 'leopardguard');
  assert.equal(r.unit.wage, h.wage);
  // In Benin, the Yoruba of Owo lend Ẹ̀ṣọ́ riders once conquered.
  const b = town('benin').st;
  b.factionMap.owo.status = 'conquered';
  assert.ok(hireOptions(b).some((o) => o.unit === 'eso'));
  assert.ok(gh);
});

test('canoe men wade the creeks and are hard to hit afloat; a Leopard Guard steadies his neighbours; an Abam blow catches two', () => {
  const { st } = town('warri', 7);
  const foe = st.factions.find((f) => f.temperament !== 'bandit');
  foe.status = 'hostile';
  const home = st.buildings.find((b) => b.type === 'compound');
  const at = (dx, dy) => [home.x + dx, home.y + dy];
  // On the water, arrows and shot do half to a canoe man.
  let water = -1;
  for (let i = 0; i < st.W * st.H && water < 0; i++) if (st.terrain[i] === T.LAGOON) water = i;
  const boat = createUnit(st, 'canoegun', water % st.W, Math.floor(water / st.W), 'player');
  assert.ok(afloat(st, boat));
  const archer = createUnit(st, 'bowman', ...at(-6, -6), foe.id);
  damage(st, archer, boat, 10);
  assert.equal(boat.maxHp - boat.hp, 5);
  // He crosses water that stops a spearman, as fast as dry land.
  const spear = createUnit(st, 'spearman', ...at(-6, -5), 'player');
  assert.equal(tileCost(st, water, pathOpts(st, boat)), 1);
  assert.equal(tileCost(st, water, pathOpts(st, spear)), Infinity);
  // A Leopard Guard steadies the soldier beside him.
  const guard = createUnit(st, 'leopardguard', ...at(-4, -4), 'player');
  const near = createUnit(st, 'spearman', ...at(-4, -3), 'player');
  const far = createUnit(st, 'spearman', ...at(8, 8), 'player');
  damage(st, archer, near, 10);
  damage(st, archer, far, 10);
  assert.equal(Math.round((near.maxHp - near.hp) * 100), 850);
  assert.equal(far.maxHp - far.hp, 10);
  assert.ok(guard);
  // The Abam's great sword catches the enemy beside the one he strikes.
  const abam = createUnit(st, 'abam', ...at(10, -6), 'player');
  const e1 = createUnit(st, 'warrior', ...at(11, -6), foe.id);
  const e2 = createUnit(st, 'warrior', ...at(11, -5), foe.id);
  for (const e of [e1, e2]) e.order = { t: 'guard', x: e.x, y: e.y };
  abam.order = { t: 'attack', target: e1.id, x: e1.x, y: e1.y };
  for (let k = 0; k < 40 && e1.hp === e1.maxHp; k++) sim.tick(st);
  assert.ok(e1.hp < e1.maxHp, 'he struck');
  assert.ok(e2.hp < e2.maxHp, 'and the blow caught the one beside');
});

test('no soldier wins every fight', () => {
  const types = ['spearman', 'archer', 'swordsman', 'horseman', 'musketeer', ...ELITES];
  const beats = Object.fromEntries(types.map((t) => [t, []]));
  for (const a of types) {
    for (const b of types) {
      if (a >= b) continue;
      let score = 0;
      for (const seed of [1, 2]) {
        const r1 = battle(a, b, { seed });
        const r2 = battle(b, a, { seed });
        score += (r1.winner === 'a') - (r1.winner === 'b') + (r2.winner === 'b') - (r2.winner === 'a');
      }
      if (score > 0) beats[a].push(b);
      if (score < 0) beats[b].push(a);
    }
  }
  const table = types.map((t) => `${t} beats ${beats[t].join(', ') || 'nobody'}`).join('\n');
  for (const t of types) assert.ok(beats[t].length < types.length - 1, `${t} wins every fight:\n${table}`);
  // Every elite is worth its place: it beats several, and something beats it.
  for (const e of ELITES) assert.ok(beats[e].length >= 2, `${e} beats too few:\n${table}`);
  // The rock, paper and scissors the brief asks for.
  assert.ok(beats.lifidi.includes('abam'), `Lifidi breaks the Abam:\n${table}`);
  assert.ok(beats.abam.includes('swordsman'), table);
  assert.ok(beats.canoegun.includes('lifidi'), `guns stop heavy horse:\n${table}`);
  assert.ok(beats.eso.includes('canoegun') && beats.eso.includes('archer'), `Ẹ̀ṣọ́ hunts gunmen and archers:\n${table}`);
});

test('by your walls the Leopard Guard holds what beats him in the open', () => {
  const score = (a, b, opts) => [1, 2, 3].reduce((n, seed) => {
    const r = battle(a, b, { seed, ...opts });
    return n + (r.winner === 'a') - (r.winner === 'b');
  }, 0);
  assert.ok(score('leopardguard', 'abam', {}) < 0, 'Abam beats him in the open');
  assert.ok(score('leopardguard', 'abam', { walls: true }) > 0, 'by the walls he holds');
  assert.ok(score('swordsman', 'abam', { walls: true }) < 0, 'the walls alone do not do it');
});

test('every elite has its own picture, and every rider a horse', async () => {
  const { CHARACTERS } = await import('../js/data/people.js');
  const { existsSync } = await import('node:fs');
  for (const e of ELITES) {
    assert.ok(CHARACTERS[e], `${e} has a model`);
    assert.ok(existsSync(new URL(`../art/people/characters/${e}.glb`, import.meta.url)), `${e}.glb`);
    assert.ok(UNITS[e].desc && UNITS[e].culture && UNITS[e].elite);
  }
  for (const h of ['horse_light', 'horse_armour']) assert.ok(existsSync(new URL(`../art/people/horses/${h}.glb`, import.meta.url)), h);
});
