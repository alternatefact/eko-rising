// Plays the guided opening the way a player would: does what each step of
// the guide asks, and answers story pop-ups with their first choice. Used by
// the tests and by the browser playthrough.

import * as sim from '../js/sim/index.js';
import { place } from './bot.mjs';
import { isWater, treeBlocks, WALK } from '../js/world/terrain.js';
import { fenced } from '../js/regions/lagos.js';

const building = (st, type) => st.buildings.find((b) => b.type === type && b.owner === 'player' && !b.dead);
const founderOf = (st) => st.citizens.find((c) => c.special === 'founder' && !c.dead);

// The nearest tree to (x, y) a person can get to.
function treeNear(st, x, y) {
  let best = -1;
  let bestD = Infinity;
  for (let dy = -14; dy <= 14; dy++) {
    for (let dx = -14; dx <= 14; dx++) {
      const tx = Math.floor(x) + dx;
      const ty = Math.floor(y) + dy;
      if (tx < 0 || ty < 0 || tx >= st.W || ty >= st.H) continue;
      const i = ty * st.W + tx;
      if (!(st.trees[i] > 0) || st.occ[i]) continue;
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  return best;
}

// A fence around the ground within `r` of the house: every open tile just
// outside it gets a section, one of them a gate.
export function fenceHome(st, r = 7.5) {
  const home = building(st, 'compound');
  const cx = home.x + 1;
  const cy = home.y + 1;
  const W = st.W;
  const open = (i) => WALK[st.terrain[i]] > 0 && !treeBlocks(st.trees, st.felled, st.terrain, i);
  const inside = new Set([cy * W + cx]);
  const queue = [cy * W + cx];
  const ring = new Set();
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      if (inside.has(j) || ring.has(j) || !open(j)) continue;
      const b = st.byId.get(st.occ[j]);
      if (b && (b.wall || b.gate)) continue;
      const d = Math.hypot((j % W) - cx, Math.floor(j / W) - cy);
      // A building in the way is taken inside: the fence goes round it.
      if (d > r && !b) ring.add(j);
      else {
        inside.add(j);
        queue.push(j);
      }
    }
  }
  // One gate for every stretch of open ground outside, so nobody working
  // out there is shut out; gates go up first.
  const tiles = [...ring];
  const region = new Map();
  let regions = 0;
  for (const t of tiles) {
    for (const j of [t - 1, t + 1, t - W, t + W]) {
      if (inside.has(j) || ring.has(j) || region.has(j) || !open(j)) continue;
      const id = ++regions;
      const q = [j];
      region.set(j, id);
      for (let k = 0; k < q.length && q.length < 3000; k++) {
        for (const n of [q[k] - 1, q[k] + 1, q[k] - W, q[k] + W]) {
          if (inside.has(n) || ring.has(n) || region.has(n) || !open(n)) continue;
          if (Math.hypot((n % W) - cx, Math.floor(n / W) - cy) > r + 14) continue;
          const b = st.byId.get(st.occ[n]);
          if (b && (b.wall || b.gate)) continue;
          region.set(n, id);
          q.push(n);
        }
      }
    }
  }
  const gates = new Set();
  const gated = new Set();
  // Gates already placed (built or still going up) count.
  for (const b of st.buildings) {
    if (b.dead || !b.gate || b.owner !== 'player') continue;
    const g = b.y * W + b.x;
    for (const j of [g - 1, g + 1, g - W, g + W]) if (region.has(j)) gated.add(region.get(j));
  }
  for (const t of [...tiles].sort((a, b) => (st.feature[b] === 5) - (st.feature[a] === 5))) {
    for (const j of [t - 1, t + 1, t - W, t + W]) {
      const id = region.get(j);
      if (id && !gated.has(id)) {
        gated.add(id);
        gates.add(t);
      }
    }
  }
  const order = [...tiles].sort((a, b) => gates.has(b) - gates.has(a));
  const out = { placed: 0, failed: [] };
  for (const i of order) {
    const r2 = sim.placeBuilding(st, gates.has(i) ? 'gate' : 'palisade', i % W, Math.floor(i / W));
    if (r2.ok) out.placed++;
    else out.failed.push(`${i % W},${Math.floor(i / W)}: ${r2.reason}`);
  }
  return out;
}

export function makeStoryBot(st) {
  return { st, log: [], did: {} };
}

// One look at the guide: do what it asks, if it can be done now.
export function storyAct(bot) {
  const st = bot.st;
  while (st.eventQueue.length) {
    bot.log.push(`d${st.time.day} t${Math.round(st.time.t)}: event ${st.eventQueue[0].id}`);
    sim.chooseEvent(st, 0);
  }
  const step = sim.currentStep(st);
  if (!step) return null;
  const f = founderOf(st);
  const once = (key, fn) => {
    if (bot.did[key]) return;
    if (fn() !== false) bot.did[key] = true;
  };
  switch (step.id) {
    case 'select':
      sim.signal(st, 'select', f.id);
      break;
    case 'chop':
      once('chop', () => {
        const h = building(st, 'compound');
        const i = treeNear(st, h.x + 1, h.y + 1);
        const r = sim.orderTree(st, f.id, i);
        bot.log.push(`chop ${i}: ${r.ok ? 'ok' : r.reason}`);
        return r.ok;
      });
      break;
    case 'woodshed':
      once('woodshed', () => place(st, 'woodcutter', 'trees'));
      break;
    case 'antelope':
      once('hunter', () => place(st, 'hunter', 'home'));
      break;
    case 'fire':
      once('hut1', () => place(st, 'hut', 'home'));
      break;
    case 'farm':
      once('farm', () => place(st, 'farm', 'home'));
      break;
    case 'fence':
      // As the guide suggests: a second wood shed, and the hunter sent to it.
      if (!bot.did.shed2 && st.res.wood >= 6) {
        bot.did.shed2 = place(st, 'woodcutter', 'trees');
      }
      if (bot.did.shed2 && !bot.did.hunterMoved) {
        const shed = st.buildings.find((b) => b.type === 'woodcutter' && !b.dead && b.built >= 1 && !b.workers.length);
        const hunter = st.citizens.find((c) => !c.dead && st.byId.get(c.job)?.type === 'hunter');
        if (shed && hunter) {
          const r = sim.assignWorker(st, hunter.id, shed.id);
          bot.log.push(`hunter to the second shed: ${r.ok ? 'ok' : r.reason}`);
          bot.did.hunterMoved = true;
        }
      }
      // Section by section, as the planks come in.
      if (st.time.t - (bot.fenceT || 0) > 6 && st.res.wood >= 8) {
        bot.fenceT = st.time.t;
        const r = fenceHome(st);
        if (r.placed) bot.log.push(`fence: ${r.placed} placed, ${r.failed.length} not ${r.failed.slice(0, 2).join('; ')}`);
      }
      break;
    case 'settle':
    case 'recover':
      if (st.res.wood >= 14 && st.buildings.filter((b) => b.type === 'hut' && !b.dead).length < 4) place(st, 'hut', 'home');
      if (step.id === 'recover' && st.res.wood >= 20 && st.buildings.filter((b) => b.type === 'farm' && !b.dead).length < 2) place(st, 'farm', 'home');
      break;
    case 'guardhouse':
      once('guard', () => place(st, 'warcamp', 'home'));
      break;
    case 'soldiers': {
      const g = building(st, 'warcamp');
      const have = st.units.filter((u) => u.owner === 'player' && u.type === 'spearman' && !u.dead).length + g.queue.length;
      if (have < 5) sim.train(st, g.id, 'spearman');
      break;
    }
    case 'camp': {
      const fac = st.factionMap.bandits1;
      const army = st.units.filter((u) => u.owner === 'player' && !u.dead).map((u) => u.id);
      if (st.time.t - (bot.campT || 0) > 8) {
        bot.campT = st.time.t;
        sim.orderMove(st, army, fac.x + 0.5, fac.y + 0.5, true);
      }
      break;
    }
    case 'mudpit':
      once('walk', () => sim.orderWalk(st, f.id, st.mudPit.x + 0.5, st.mudPit.y + 0.5).ok);
      break;
    case 'brickshed':
      once('brickshed', () => place(st, 'brickyard', 'clay') || placeNear(st, 'brickyard', st.mudPit));
      break;
    case 'bricks':
      if (st.res.bricks >= st.cap.goods - 2 && st.res.wood >= 6) place(st, 'stockpile', 'home');
      break;
    case 'upgrade':
      sim.mudUpgrade(st);
      break;
    default:
  }
  return step.id;
}

function placeNear(st, type, at) {
  for (let r = 1; r < 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (sim.placeBuilding(st, type, at.x + dx, at.y + dy).ok) return true;
      }
    }
  }
  return false;
}

// Plays until the story ends or time runs out. Returns the steps seen, with
// the game time each was reached.
export function playStory(st, seconds = 24 * 120, onStep) {
  const bot = makeStoryBot(st);
  const seen = [];
  let last = null;
  for (let k = 0; k < seconds / sim.STEP; k++) {
    if (k % 10 === 0) {
      const id = storyAct(bot);
      if (id !== last) {
        seen.push({ id, t: Math.round(st.time.t), day: st.time.day });
        onStep?.(id, st);
        last = id;
      }
      if (!id) break;
    }
    sim.tick(st);
    if (st.gameOver) break;
  }
  return { seen, bot };
}
