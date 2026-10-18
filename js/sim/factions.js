// The other peoples of the land. Each has a village, a garrison, a temper,
// and a relationship with you. Befriend them, make them pay tribute, or
// conquer them — but some are strong enough to wipe out a careless army.

import { createUnit, createBuilding, notify, markTile } from './entities.js';
import { BUILDINGS } from '../data/buildings.js';
import { T, WALK, TREE, isWater, treeBlocks } from '../world/terrain.js';
import { armyPower, launchWarBand, declareWar } from './military.js';
import { addRes, addMood, spawnStranger } from './economy.js';
import { revealAround, addVista } from './world.js';
import { askForWarriors } from './trade.js';
import { unitPower } from '../data/units.js';
import { ORIGINS } from '../data/names.js';

export const STRENGTH = ['', 'Weak', 'Modest', 'Strong', 'Formidable', 'Mighty'];
const START_REL = { friendly: 20, proud: 0, warlike: -10, bandit: -100 };
const BASE_REL = { friendly: 25, proud: 5, warlike: -40, bandit: -100 };

export function initFaction(st, def, spot) {
  const f = {
    id: def.id,
    name: def.name,
    people: def.people,
    strength: def.strength,
    temperament: def.temperament,
    major: def.major !== false,
    x: spot.x,
    y: spot.y,
    radius: def.radius || 4 + def.strength,
    color: def.color,
    relation: START_REL[def.temperament] ?? 0,
    status: def.temperament === 'bandit' ? 'hostile' : 'neutral',
    discovered: false,
    garrison: def.garrison,
    loot: def.loot || {},
    tribute: def.tribute || {},
    joiners: def.joiners || 0,
    desc: def.desc,
    huts: def.huts || 3 + def.strength * 2,
    raidT: def.firstRaid || 300,
    regenT: 40,
    capT: 0,
    gifts: 0,
    style: def.style || 'village',
    raids: def.raids !== false,
    origin: def.origin,
    leader: def.leader || null,
    wants: def.wants || {},
    offers: def.offers || {},
    trade: false,
    helpReady: 0,
  };
  st.factions.push(f);
  st.factionMap[f.id] = f;
  if (f.style === 'camp' || f.style === 'host') pitchTents(st, f);
  spawnGarrison(st, f);
  return f;
}

// A bandit camp: the chief's tent and a ring of smaller ones around a fire.
function pitchTents(st, f) {
  f.camp = true;
  const free = (x, y, w, h) => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 1 || ty < 1 || tx >= st.W - 1 || ty >= st.H - 1) return false;
        const i = ty * st.W + tx;
        if (st.occ[i] || isWater(st.terrain[i])) return false;
      }
    }
    return true;
  };
  const place = (type, x, y) => {
    const def = BUILDINGS[type];
    if (!free(x, y, def.w, def.h)) return null;
    return createBuilding(st, type, x, y, { instant: true, owner: f.id });
  };
  const host = f.style === 'host';
  let chief = null;
  for (const [dx, dy] of [[-1, -3], [-3, -1], [1, -3], [-3, 1], [1, 1]]) {
    chief = place(host ? 'edochief' : 'chieftent', f.x + dx, f.y + dy);
    if (chief) break;
  }
  const n = Math.max(3, f.huts || 3);
  let made = chief ? 1 : 0;
  for (let k = 0; k < 24 && made < n + 1; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.4 + Math.floor(k / 8) * 0.35;
    const r = (host ? 3.2 : 2.6) + Math.floor(k / 8) * 0.9;
    if (place(host ? 'edotent' : 'tent', Math.round(f.x + Math.cos(a) * r), Math.round(f.y + Math.sin(a) * r))) made++;
  }
}

// --- A host gathering for war ------------------------------------------------------

// The far end of the land from home that can be walked to, clear of other
// peoples and the water: where a great army can gather unseen.
function farSpot(st) {
  const home = st.buildings.find((b) => b.type === 'compound' && b.owner === 'player' && !b.dead);
  const sx = home ? home.x + 1 : st.start.x;
  const sy = home ? home.y + 1 : st.start.y;
  const W = st.W;
  const dist = new Int32Array(W * st.H).fill(-1);
  const start = sy * W + sx;
  dist[start] = 0;
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % W;
    const y = (i / W) | 0;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= st.H - 1) continue;
      const j = ny * W + nx;
      if (dist[j] >= 0 || WALK[st.terrain[j]] === 0 || treeBlocks(st.trees, st.felled, st.terrain, j)) continue;
      dist[j] = dist[i] + 1;
      queue.push(j);
    }
  }
  let best = null;
  let bestScore = -Infinity;
  for (const i of queue) {
    const x = i % W;
    const y = (i / W) | 0;
    if (x < 7 || y < 7 || x >= W - 7 || y >= st.H - 7) continue;
    if (st.factions.some((f) => Math.hypot(f.x - x, f.y - y) < 11)) continue;
    let wet = false;
    for (let dy = -4; dy <= 4 && !wet; dy++) for (let dx = -4; dx <= 4 && !wet; dx++) if (isWater(st.terrain[(y + dy) * W + x + dx])) wet = true;
    if (wet) continue;
    const score = dist[i] + Math.hypot(x - sx, y - sy) * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = { x, y };
    }
  }
  return best;
}

// The host gathers at the far end of the land: war tents round the war
// chief's, and the warriors drawn up in ranks in front of them. They do not
// raid; they wait until they are sent (marchHost).
export function gatherHost(st, def) {
  const spot = farSpot(st);
  if (!spot) return null;
  // Ground cleared for the camp.
  for (let dy = -6; dy <= 8; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      const x = spot.x + dx;
      const y = spot.y + dy;
      if (x < 1 || y < 1 || x >= st.W - 1 || y >= st.H - 1 || dx * dx + dy * dy > 49) continue;
      const i = y * st.W + x;
      if (st.trees[i] > 0) {
        st.trees[i] = 0;
        st.felled[i] = TREE.STUMP;
        markTile(st, i);
      }
      if (st.terrain[i] === T.FOREST) {
        st.terrain[i] = T.GRASS;
        markTile(st, i);
      }
    }
  }
  st.dirty.reach = true;
  const f = initFaction(st, { ...def, style: 'host' }, spot);
  f.host = true;
  f.status = 'hostile';
  f.relation = -100;
  f.raids = false;
  f.discovered = true;
  st.stats.met++;
  st.dirty.territory = true;
  revealAround(st, spot.x, spot.y + 2, 11);
  // The lookout's view of them, for a while.
  addVista(st, spot.x + 0.5, spot.y + 2.5, 11, 120);
  return f;
}

// The host sets out: every warrior marches on the town.
export function marchHost(st, f) {
  if (!f || f.beaten) return 0;
  let n = 0;
  for (const u of st.units) {
    if (u.dead || u.owner !== f.id) continue;
    u.origin = { x: f.x + 0.5, y: f.y + 0.5 };
    u.home = null;
    u.leash = 0;
    u.host = true;
    u.order = { t: 'raid' };
    u.raidStart = st.time.t;
    u.patience = 1e9;
    u.path = null;
    n++;
  }
  f.marching = true;
  return n;
}

export function campTents(st, f) {
  return st.buildings.filter((b) => b.owner === f.id && !b.dead && BUILDINGS[b.type].camp);
}

function garrisonList(f) {
  const out = [];
  for (const [type, n] of Object.entries(f.garrison)) for (let k = 0; k < n; k++) out.push(type);
  return out;
}

function spawnGarrison(st, f) {
  if (f.style === 'host') {
    // Drawn up in ranks of ten in front of the tents.
    garrisonList(f).forEach((type, k) => {
      const col = k % 10;
      const row = Math.floor(k / 10);
      let x = f.x - 5 + col;
      let y = f.y + 4 + row;
      if (WALK[st.terrain[y * st.W + x]] === 0 || st.occ[y * st.W + x]) {
        x = f.x + (k % 5) - 2;
        y = f.y + 4;
      }
      const home = { x: x + 0.5, y: y + 0.5 };
      createUnit(st, type, x, y, f.id, { home, leash: 14, aggro: 7, order: { t: 'guard', x: home.x, y: home.y } });
    });
    return;
  }
  for (const type of garrisonList(f)) spawnDefender(st, f, type);
}

function spawnDefender(st, f, type) {
  const a = st.rng.range(0, Math.PI * 2);
  const r = st.rng.range(0.5, 2.5);
  const x = Math.floor(f.x + Math.cos(a) * r);
  const y = Math.floor(f.y + Math.sin(a) * r);
  const home = { x: x + 0.5, y: y + 0.5 };
  return createUnit(st, type, x, y, f.id, { home, leash: 11 + f.strength, aggro: 6 + f.strength * 0.5, order: { t: 'guard', x: home.x, y: home.y } });
}

export function garrisonAlive(st, f) {
  return st.units.filter((u) => u.owner === f.id && !u.dead && u.home);
}

export function factionPower(st, f) {
  let p = 0;
  for (const u of st.units) if (u.owner === f.id && !u.dead) p += unitPower(u.type);
  return p + f.strength * 40;
}

// Kingdoms brought under your rule, by the sword or by fear of it. Bandit
// camps are not kingdoms and don't count.
export function subdued(st) {
  return st.factions.filter((f) => f.temperament !== 'bandit' && (f.status === 'conquered' || f.status === 'vassal'));
}

export function unified(st) {
  return st.factions.filter((f) => f.major && ['allied', 'vassal', 'conquered'].includes(f.status));
}

export function majors(st) {
  return st.factions.filter((f) => f.major);
}

// --- Per-second update ------------------------------------------------------------

export function updateFactions(st, dt) {
  for (const f of st.factions) {
    if (!f.discovered) {
      const i = f.y * st.W + f.x;
      if (st.visible[i]) discover(st, f);
    }
    if (f.status === 'conquered') continue;

    // A host that has lost every warrior is broken.
    if (f.host) {
      if (!f.beaten && !st.units.some((u) => u.owner === f.id && !u.dead)) {
        f.beaten = true;
        conquer(st, f);
        if (f.onBeaten) st.eventQueue.push({ id: f.onBeaten });
      }
      continue;
    }

    // Garrisons recover slowly unless the village has fallen.
    const alive = garrisonAlive(st, f);
    const want = garrisonList(f);
    if (alive.length < want.length) {
      f.regenT -= dt;
      if (f.regenT <= 0) {
        f.regenT = 45 - f.strength * 3;
        const have = {};
        for (const u of alive) have[u.type] = (have[u.type] || 0) + 1;
        const missing = want.find((t) => {
          have[t] = (have[t] || 0) - 1;
          return have[t] < 0;
        });
        if (missing) spawnDefender(st, f, missing);
      }
    }

    // Capture: no defenders left and your soldiers stand in the village. A
    // camp falls only when its tents are burned (see military.js).
    if (f.camp) {
      f.capT = 0;
    } else if (f.status !== 'allied' && f.status !== 'vassal' && alive.length === 0) {
      const here = st.units.some((u) => u.owner === 'player' && !u.dead && Math.hypot(u.x - f.x - 0.5, u.y - f.y - 0.5) < 3.5);
      f.capT = here ? f.capT + dt : 0;
      if (f.capT >= 5) conquer(st, f);
    } else {
      f.capT = 0;
    }

    // Hostile peoples send war bands, once they know where you are; never
    // while the opening story is still being told.
    if (st.tut && !st.tut.done) continue;
    if (f.status === 'hostile' && (f.discovered || f.temperament === 'bandit' || st.era >= 2)) {
      if (f.temperament === 'bandit' && !(st.era >= 1 && st.time.day >= 20) && st.time.day < 45) continue;
      if (!f.raids) continue;
      f.raidT -= dt;
      if (f.raidT <= 0) {
        // Never two war bands at once from the wild: give the town a breather.
        if (st.time.t - (st.lastRaid || -1e9) < 150) {
          f.raidT = 30;
          continue;
        }
        f.raidT = st.rng.range(300, 460) - f.strength * 10;
        st.lastRaid = st.time.t;
        raid(st, f);
      }
    }
  }
}

function raid(st, f) {
  const types = garrisonList(f);
  let size;
  if (f.temperament === 'bandit') size = Math.min(7, 2 + Math.floor(st.time.day / 25));
  else size = Math.min(16, 2 + f.strength + Math.floor(st.era * 1.5) + Math.floor(st.time.day / 45));
  const band = [];
  for (let k = 0; k < size; k++) band.push(st.rng.pick(types));
  launchWarBand(st, f.id, { x: f.x + 0.5, y: f.y + 0.5 }, band, { label: `${f.name} war band` });
  notify(st, `⚔️ A war band of the ${f.name} (${size} fighters) is marching on ${st.name}!`, 'war', { x: f.x, y: f.y });
}

function discover(st, f) {
  f.discovered = true;
  st.stats.met++;
  if (f.temperament === 'bandit') {
    notify(st, f.raids ? `🏴 You have found the ${f.name}. They will raid you until you wipe them out.` : `⛓️ You have found the ${f.name}.`, 'war', { x: f.x, y: f.y });
  } else if (f.status === 'allied' || f.status === 'vassal') {
    notify(st, `🤝 Your scouts reach the ${f.name}, your allies.`, 'good', { x: f.x, y: f.y });
  } else {
    st.eventQueue.push({ id: 'meet', fid: f.id });
  }
}

export function conquer(st, f) {
  f.status = 'conquered';
  f.relation = 0;
  f.capT = 0;
  f.burning = st.time.t + 20; // the village burns for a while after it falls
  const got = [];
  for (const [k, v] of Object.entries(f.loot)) {
    const n = Math.floor(addRes(st, k, v));
    if (n > 0) got.push(`${n} ${k}`);
  }
  // Their people come to live with you.
  const origin = ORIGINS.find((o) => o.people === f.origin) || null;
  for (let k = 0; k < f.joiners; k++) spawnStranger(st, origin, f.x + 0.5, f.y + 0.5);
  for (const g of st.factions) {
    if (g === f || !g.major || g.status === 'conquered') continue;
    g.relation += g.temperament === 'friendly' ? -8 : g.temperament === 'warlike' ? 5 : -4;
  }
  st.dirty.territory = true;
  st.stats.conquered++;
  addMood(st, `Victory over the ${f.people}`, 6, 6);
  notify(
    st,
    `🏆 You have conquered the ${f.name}!${got.length ? ` Plunder: ${got.join(', ')}.` : ''}${f.joiners ? ` ${f.joiners} of their people will join you.` : ''}`,
    'good',
    { x: f.x, y: f.y },
  );
}

// --- Daily relations -----------------------------------------------------------------

export function dailyFactions(st) {
  for (const f of st.factions) {
    // A sacked kingdom pays little; a willing partner pays every day.
    if (f.status === 'conquered') {
      collect(st, f.tribute, 0.4);
      continue;
    }
    const base = BASE_REL[f.temperament] ?? 0;
    if (f.status !== 'hostile' || f.temperament !== 'bandit') {
      if (f.relation < base) f.relation = Math.min(base, f.relation + 1);
      else if (f.relation > base && f.status !== 'allied' && f.status !== 'vassal') f.relation = Math.max(base, f.relation - 1);
    }
    if (f.status === 'neutral' && f.relation <= -38 && f.discovered) {
      declareWar(st, f, false);
      notify(st, `🔥 The ${f.name} have lost patience with you and taken up arms.`, 'war', { x: f.x, y: f.y });
    }
    if (f.status === 'vassal') collect(st, f.tribute, 1);
  }
}

function collect(st, bundle, mult) {
  for (const [k, v] of Object.entries(bundle)) addRes(st, k, Math.round(v * mult));
}

// --- Diplomacy ------------------------------------------------------------------------

export function giftCost(st, f) {
  return 30 + st.era * 20 + (f ? f.gifts * 15 : 0);
}

export function diplomacy(st, fid, action) {
  const f = st.factionMap[fid];
  if (!f) return { ok: false, reason: 'Unknown people.' };
  if (f.status === 'conquered') return { ok: false, reason: 'They already answer to you.' };
  const mine = armyPower(st);
  const theirs = factionPower(st, f);
  switch (action) {
    case 'gift': {
      const cost = giftCost(st, f);
      if (st.res.cowries < cost) return { ok: false, reason: `A worthy gift costs ${cost}.` };
      st.res.cowries -= cost;
      const gain = Math.max(4, Math.round(16 * Math.pow(0.82, f.gifts)));
      f.gifts++;
      f.relation = Math.min(100, f.relation + gain);
      if (f.status === 'hostile' && f.relation > -15 && f.temperament !== 'bandit') {
        f.status = 'neutral';
        notify(st, `🕊️ The ${f.name} accept your gifts and lay down their spears.`, 'good', { x: f.x, y: f.y });
      } else {
        notify(st, `🎁 The ${f.name} accept your gift. Relations +${gain}.`, 'good', { x: f.x, y: f.y });
      }
      return { ok: true };
    }
    case 'ally': {
      if (f.status === 'hostile') return { ok: false, reason: 'Make peace first.' };
      const need = f.temperament === 'friendly' ? 35 : 55;
      const strongEnough = f.temperament !== 'warlike' || mine >= theirs * 0.7;
      if (f.relation >= need && strongEnough) {
        f.status = 'allied';
        f.relation = Math.max(f.relation, 70);
        st.dirty.territory = true;
        addMood(st, `Alliance with the ${f.people}`, 5, 5);
        notify(st, `🤝 The ${f.name} are now your allies! They will trade with you and stand with your cause.`, 'good', { x: f.x, y: f.y });
        return { ok: true };
      }
      f.relation -= 3;
      const why = f.relation < need ? `They do not trust you enough yet (need ${need}).` : 'They respect only strength. Grow your army.';
      notify(st, `🙅 The ${f.name} refuse an alliance. ${why}`, 'bad', { x: f.x, y: f.y });
      return { ok: false, reason: why };
    }
    case 'demand': {
      if (f.status === 'allied') return { ok: false, reason: 'They are your allies.' };
      if (mine >= theirs * 1.4) {
        f.status = 'vassal';
        f.relation = Math.max(f.relation, 0);
        st.dirty.territory = true;
        notify(st, `👑 Seeing your strength, the ${f.name} agree to pay you tribute.`, 'good', { x: f.x, y: f.y });
        return { ok: true };
      }
      f.relation -= 25;
      notify(st, `😠 The ${f.name} laugh at your demand. Your army is not strong enough to frighten them.`, 'bad', { x: f.x, y: f.y });
      if (f.relation <= -38 && f.status !== 'hostile') declareWar(st, f, false);
      return { ok: false, reason: 'Not strong enough.' };
    }
    case 'war': {
      f.trade = false;
      declareWar(st, f, false);
      return { ok: true };
    }
    case 'trade': {
      if (f.status === 'hostile') return { ok: false, reason: 'Make peace first.' };
      if (f.trade) return { ok: false, reason: 'You already trade with them.' };
      if (!st.buildings.some((b) => b.type === 'market' && b.owner === 'player' && !b.dead && b.built >= 1)) {
        return { ok: false, reason: 'Build a Market first — their traders need somewhere to sell.' };
      }
      if (f.relation < 20) {
        notify(st, `🙅 ${f.leader || `The ${f.name}`} will not open a trade route with strangers. Send gifts first (need relations 20).`, 'bad', { x: f.x, y: f.y });
        return { ok: false, reason: 'They need relations of 20 to trade.' };
      }
      f.trade = true;
      notify(st, `🤝 A trade agreement with the ${f.name}! Their caravans bring money every day, and you can sell them what they need.`, 'good', { x: f.x, y: f.y });
      return { ok: true };
    }
    case 'help':
      return askForWarriors(st, fid);
    default:
      return { ok: false, reason: 'Unknown action.' };
  }
}

// --- Places to explore --------------------------------------------------------------

export function updatePois(st) {
  for (const p of st.pois) {
    if (p.claimed) continue;
    const i = p.y * st.W + p.x;
    if (!p.found && st.explored[i]) {
      p.found = true;
      notify(st, `❓ Your people spotted ${p.name}. Send a scout or soldier to investigate.`, 'info', p);
    }
    if (!p.found) continue;
    const u = st.units.find((v) => v.owner === 'player' && !v.dead && Math.hypot(v.x - p.x - 0.5, v.y - p.y - 0.5) < 1.8);
    if (u) claimPoi(st, p);
  }
}

function claimPoi(st, p) {
  p.claimed = true;
  const r = p.reward || {};
  const got = [];
  for (const k of ['yam', 'garri', 'fish', 'meat', 'wood', 'bricks', 'stone', 'iron', 'palmoil', 'weapons', 'salt', 'cloth', 'cowries']) {
    if (r[k]) {
      const n = Math.floor(addRes(st, k, r[k]));
      if (n) got.push(`${n} ${k}`);
    }
  }
  if (r.happy) {
    st.bonusHappy += r.happy;
    got.push(`+${r.happy} happiness for good`);
  }
  if (r.strangers) {
    for (let k = 0; k < r.strangers; k++) spawnStranger(st, null, p.x + 0.5, p.y + 0.5);
    got.push(`${r.strangers} people will join you`);
  }
  if (r.reveal) revealAround(st, p.x, p.y, r.reveal);
  st.stats.pois++;
  notify(st, `✨ ${p.name}: ${p.text}${got.length ? ` (${got.join(', ')})` : ''}`, 'good', p);
}
