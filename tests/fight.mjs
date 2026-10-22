// A headless battlefield for weighing soldiers against each other: two
// groups worth the same, on open grass, march at each other and fight to the
// last man. Used by tests/elite.test.mjs. A recruit is worth 100 here: by
// the Town age money comes easily, but people and places in the army do not.
import * as sim from '../js/sim/index.js';
import { UNITS } from '../js/data/units.js';
import { RESOURCES } from '../js/data/resources.js';
import { createUnit, createBuilding } from '../js/sim/entities.js';
import { T, TREE } from '../js/world/terrain.js';

// What a soldier costs: his arms at market prices (food at 2), and the
// recruit himself, since soldiers are people and the army has a cap.
export const HEAD = 100;
export function worth(type) {
  const cost = UNITS[type].cost || {};
  return HEAD + Object.entries(cost).reduce((n, [k, v]) => n + v * (k === 'cowries' ? 1 : k === 'food' ? 2 : RESOURCES[k]?.price || 2), 0);
}

// A field of grass `w` by `h` tiles. With `creek`, a lagoon runs down the
// middle of it and on across the whole land, so there is no way round.
function field(st, w, h, creek) {
  const x0 = 4;
  const y0 = 4;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = y * st.W + x;
      st.terrain[i] = T.GRASS;
      st.trees[i] = 0;
      st.felled[i] = TREE.STANDING;
      st.occ[i] = 0;
    }
  }
  if (creek) {
    for (let y = 0; y < st.H; y++) {
      for (let x = x0 + w / 2 - 2; x < x0 + w / 2 + 2; x++) {
        const i = y * st.W + x;
        st.terrain[i] = T.LAGOON;
        st.trees[i] = 0;
        st.occ[i] = 0;
      }
    }
  }
  return { x0, y0 };
}

// Fights `a` (yours) against `b` (theirs), each a budget's worth, and says
// who is left standing: 'a', 'b' or 'draw'.
// `walls` puts a stretch of your palisade beside where the armies meet;
// `creek` runs a lagoon down the middle of the field.
export function battle(a, b, { budget = 900, seed = 1, creek = false, walls = false } = {}) {
  const st = sim.newGame({ seed, guide: false });
  while (st.eventQueue.length) sim.chooseEvent(st, 0);
  // Nobody else on the map, and no time passing for anything but the fight.
  st.units.length = 0;
  st.animals && (st.animals.length = 0);
  for (const f of st.factions) f.status = f.id === st.factions[0].id ? 'hostile' : 'neutral';
  const foe = st.factions[0];
  foe.noRaids = true;
  const { x0, y0 } = field(st, 30, 14, creek);
  if (walls) for (let x = x0 + 9; x < x0 + 21; x++) createBuilding(st, 'palisade', x, y0 + 4, { instant: true });
  st.dirty.reach = true;
  const side = (type, owner, x) => {
    const n = Math.max(1, Math.round(budget / worth(type)));
    return Array.from({ length: n }, (_, k) => {
      const u = createUnit(st, type, x + (k % 3), y0 + 2 + Math.floor(k / 3) * 1.2, owner, { order: { t: 'amove', x: x0 + 15, y: y0 + 7 } });
      u.aggro = 30;
      u.home = null;
      return u;
    });
  };
  const A = side(a, 'player', x0 + 1);
  const B = side(b, foe.id, x0 + 26);
  for (const u of B) u.order = { t: 'amove', x: x0 + 15, y: y0 + 7 };
  const alive = (g) => g.filter((u) => !u.dead).length;
  for (let k = 0; k < 4000 && alive(A) && alive(B); k++) {
    // Keep both sides coming at each other.
    if (k % 50 === 0) {
      for (const u of A) if (!u.dead && !u.order.target) u.order = { t: 'amove', x: x0 + 26, y: y0 + 7 };
      for (const u of B) if (!u.dead && !u.order.target) u.order = { t: 'amove', x: x0 + 2, y: y0 + 7 };
    }
    while (st.eventQueue.length) sim.chooseEvent(st, 0);
    sim.tick(st);
  }
  const la = alive(A);
  const lb = alive(B);
  return { winner: la && !lb ? 'a' : lb && !la ? 'b' : 'draw', left: [la, lb], sizes: [A.length, B.length] };
}
