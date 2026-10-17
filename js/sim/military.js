// Fighting: soldiers, war bands, towers, foreign landings and ships.

import { UNITS, unitPower } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { ERAS } from '../data/eras.js';
import { merchantArrives } from './trade.js';
import { createUnit, notify, notifyOnce, removeUnit, removeBuilding, removeCitizen } from './entities.js';
import { goTo, stepMove } from './move.js';
import { findPath } from '../world/path.js';
import { distToRect, findLanding } from './world.js';
import { spend, canAfford, armySize, armyCap, addMood, spawnStranger, DAY } from './economy.js';
import { conquer } from './factions.js';

// --- Who fights whom -----------------------------------------------------------

export function isHostileOwner(st, a, b) {
  if (a === b) return false;
  if (a !== 'player' && b !== 'player') return false;
  const other = a === 'player' ? b : a;
  const f = st.factionMap[other];
  if (f) return f.status === 'hostile';
  const fp = st.foreign[other];
  if (fp) return !!fp.hostile;
  return false;
}

function radiusOf(e) {
  return e.kind === 'building' ? 0 : 0.35;
}

function distTo(u, e) {
  if (e.kind === 'building') return distToRect(u.x, u.y, e);
  return Math.hypot(e.x - u.x, e.y - u.y);
}

// How near an enemy must come before your soldiers go for it by instinct,
// and before they turn on an enemy tent or hut they are passing.
export const ENGAGE = 6.5;
const ENGAGE_BUILDING = 5;

function findTarget(st, u, r, fromX, fromY) {
  const ox = fromX ?? u.x;
  const oy = fromY ?? u.y;
  let best = null;
  let bestD = r;
  for (const v of st.units) {
    if (v.dead || !isHostileOwner(st, u.owner, v.owner)) continue;
    const d = Math.hypot(v.x - ox, v.y - oy);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  if (!best && u.owner === 'player') {
    // No fighters about: the tents and huts of an enemy camp.
    let bd = Math.min(r, u.stance === 'hold' ? r : ENGAGE_BUILDING);
    for (const b of st.buildings) {
      if (b.dead || b.owner === 'player' || !isHostileOwner(st, u.owner, b.owner) || BUILDINGS[b.type].invulnerable) continue;
      const d = distToRect(ox, oy, b);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
  }
  if (u.owner !== 'player') {
    // War bands also cut down townsfolk caught in the open.
    for (const c of st.citizens) {
      if (c.dead || c.stranger || c.hidden) continue;
      const d = Math.hypot(c.x - ox, c.y - oy);
      if (d < Math.min(bestD, 3)) {
        bestD = d;
        best = c;
      }
    }
  }
  return best;
}

// An enemy inside your territory within marching distance of this guard post.
function findIntruder(st, u) {
  let best = null;
  let bestD = 16;
  for (const v of st.units) {
    if (v.dead || !isHostileOwner(st, u.owner, v.owner)) continue;
    if (st.territory[Math.floor(v.y) * st.W + Math.floor(v.x)] !== 1) continue;
    const d = Math.hypot(v.x - u.order.x, v.y - u.order.y);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

function nearestPlayerBuilding(st, u) {
  let best = null;
  let bestD = Infinity;
  for (const b of st.buildings) {
    if (b.owner !== 'player' || b.dead || BUILDINGS[b.type].invulnerable) continue;
    // Thieves make for the stores.
    if (u.steal && b.type !== 'stockpile' && b.type !== 'storehouse' && b.type !== 'granary') continue;
    let d = distToRect(u.x, u.y, b);
    if (b.wall) d += 6; // walls only when they are in the way
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

// --- Damage ---------------------------------------------------------------------

export function damage(st, attacker, target, amount) {
  target.hp -= amount;
  target.hitT = st.time.t;
  if (target.kind === 'unit' && target.owner !== 'player' && attacker?.owner === 'player') {
    // Striking a people you were not at war with starts one.
    const f = st.factionMap[target.owner];
    if (f && f.status !== 'hostile') declareWar(st, f, true);
  }
  if (target.hp > 0) return;
  if (target.kind === 'unit') {
    removeUnit(st, target);
    if (target.owner === 'player') {
      st.stats.lost++;
      notifyOnce(st, 'fallen', 8, `⚰️ ${UNITS[target.type].name}${target.name ? ` ${target.name}` : ''} has fallen in battle.`, 'war', target);
      addMood(st, 'Mourning the fallen', -2, 2);
    } else {
      st.stats.slain++;
    }
  } else if (target.kind === 'citizen') {
    removeCitizen(st, target);
    st.story = st.story || {};
    (st.story.raidDead = st.story.raidDead || []).push(target.name);
    notifyOnce(st, 'killed', 6, `⚰️ ${target.name} was killed by raiders.`, 'war', target);
    addMood(st, 'Townsfolk killed', -3, 3);
  } else if (target.kind === 'building') {
    const at = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
    if (target.owner !== 'player') {
      // An enemy tent burns.
      removeBuilding(st, target);
      st.fx.push({ kind: 'blaze', x0: at.x, y0: at.y, x1: at.x, y1: at.y, t: 0, dur: 16, r: Math.max(target.w, target.h) * 0.35 });
      const f = st.factionMap[target.owner];
      if (f) campLost(st, f, target);
      return;
    }
    notify(st, `🔥 Your ${BUILDINGS[target.type].name.toLowerCase()} was destroyed!`, 'war', at);
    removeBuilding(st, target);
    if (attacker && attacker.kind === 'unit' && attacker.owner !== 'player') plunder(st, attacker);
  }
}

// Bandits who reach the stores fill their sacks: between them, about half
// of everything, and some of the money.
const STEAL = ['yam', 'garri', 'fish', 'meat', 'wood', 'bricks', 'stone', 'iron', 'palmoil', 'weapons'];
function steal(st, u) {
  const share = 0.16;
  const got = [];
  for (const k of STEAL) {
    const n = Math.floor((st.res[k] || 0) * share);
    if (n <= 0) continue;
    st.res[k] -= n;
    got.push([k, n]);
  }
  const cw = Math.floor(st.res.cowries * share);
  st.res.cowries -= cw;
  u.plunder = 2;
  u.loot = got;
  st.story = st.story || {};
  const all = (st.story.stolen = st.story.stolen || {});
  for (const [k, n] of got) all[k] = (all[k] || 0) + n;
  if (cw) all.cowries = (all.cowries || 0) + cw;
  notifyOnce(st, 'steal', 8, `💰 Bandits are carrying off your stores${got.length ? `: ${got.slice(0, 4).map(([k, n]) => `${n} ${k === 'wood' ? 'planks' : k}`).join(', ')}` : ''}!`, 'war', u);
}

// A raider who burns a building carries off some of your stores.
function plunder(st, u) {
  u.plunder = (u.plunder || 0) + 1;
  const goods = ['yam', 'fish', 'meat', 'wood', 'bricks', 'stone', 'iron', 'palmoil', 'weapons'].filter((k) => st.res[k] >= 5);
  const k = goods.length ? st.rng.pick(goods) : null;
  const took = k ? Math.min(st.res[k], 10 + st.rng.int(0, 15)) : 0;
  if (k) st.res[k] -= took;
  const cw = Math.min(st.res.cowries, 5 + st.rng.int(0, 15));
  st.res.cowries -= cw;
  if (took || cw) notifyOnce(st, 'plunder', 10, `💰 Raiders are carrying off your stores${k ? ` (${Math.round(took)} ${k})` : ''}${cw ? ` and ${Math.round(cw)} cowries` : ''}!`, 'war', u);
}

// A tent of a bandit camp has burned. When the last one goes, the camp is
// finished: whoever is left of the bandits runs off into the bush.
function campLost(st, f, tent) {
  const left = st.buildings.filter((b) => b.owner === f.id && !b.dead && BUILDINGS[b.type].camp).length;
  if (left > 0) {
    notifyOnce(st, `tent-${f.id}`, 6, `🔥 A tent of the ${f.name} goes up in flames. ${left} left.`, 'good', { x: tent.x + tent.w / 2, y: tent.y + tent.h / 2 });
    return;
  }
  const edge = { x: f.x < st.W / 2 ? 1 : st.W - 2, y: f.y < st.H / 2 ? 1 : st.H - 2 };
  let fled = 0;
  for (const u of st.units) {
    if (u.dead || u.owner !== f.id) continue;
    u.home = null;
    u.origin = edge;
    u.despawnHome = true;
    u.order = { t: 'retreat' };
    u.path = null;
    fled++;
  }
  if (fled) notify(st, `🏃 With their camp in flames, the last of the ${f.name} run off into the bush.`, 'good', { x: f.x, y: f.y });
  conquer(st, f);
}

export function declareWar(st, f, provoked) {
  if (f.status === 'hostile') return;
  const wasAlly = f.status === 'allied' || f.status === 'vassal';
  f.status = 'hostile';
  f.relation = Math.min(f.relation, -70);
  f.raidT = 160 + st.rng.range(0, 120);
  notify(st, provoked ? `⚔️ You attacked the ${f.name}. They are now at war with you!` : `⚔️ War with the ${f.name}!`, 'war', { x: f.x, y: f.y });
  if (wasAlly) {
    for (const g of st.factions) if (g !== f && g.major) g.relation -= 12;
  }
}

function attack(st, u, target) {
  const def = UNITS[u.type];
  u.cd = def.cd * st.rng.range(0.9, 1.1);
  const tx = target.kind === 'building' ? target.x + target.w / 2 : target.x;
  const ty = target.kind === 'building' ? target.y + target.h / 2 : target.y;
  if (tx !== u.x) u.facing = tx > u.x ? 1 : -1;
  u.swingT = st.time.t;
  if (def.ranged) {
    const musket = u.type === 'musketeer' || def.atk >= 18;
    st.fx.push({ kind: musket ? 'shot' : 'arrow', x0: u.x, y0: u.y, x1: tx, y1: ty, t: 0, dur: musket ? 0.12 : 0.35 });
  }
  let dmg = def.atk * st.rng.range(0.8, 1.2);
  // Spears and arrows are poor tools for knocking down mud walls.
  if (target.kind === 'building') dmg *= def.ranged ? 0.3 : 0.55;
  damage(st, u, target, dmg);
}

// --- Unit brain ------------------------------------------------------------------

export function updateUnit(st, u, dt) {
  u.px = u.x;
  u.py = u.y;
  if (u.dead) return;
  const def = UNITS[u.type];
  u.cd -= dt;
  u.scanT -= dt;
  u.repathT -= dt;
  const enemy = u.owner !== 'player';
  const ord = u.order;

  // Wounded garrison troops at home slowly heal.
  if (u.home && ord.t === 'guard' && u.hp < u.maxHp && Math.hypot(u.x - u.home.x, u.y - u.home.y) < 3) u.hp = Math.min(u.maxHp, u.hp + dt * 2);

  let target = ord.target ? st.byId.get(ord.target) : null;
  if (target && (target.dead || target.hp <= 0)) {
    target = null;
    ord.target = 0;
    u.path = null;
    if (ord.t === 'attack') u.order = { t: 'guard', x: u.x, y: u.y };
  }
  // Raiders who have grabbed their plunder head home.
  if (ord.t === 'raid' && u.plunder >= 2) {
    u.order = { t: 'retreat' };
    u.path = null;
    return;
  }

  // Forced marches ignore enemies; everyone else keeps an eye out. Your
  // soldiers holding their ground fight only what comes within reach.
  const hold = u.owner === 'player' && u.stance === 'hold';
  if (!target && ord.t !== 'move' && ord.t !== 'retreat' && u.scanT <= 0) {
    u.scanT = 0.4;
    if (u.home) {
      target = findTarget(st, u, u.aggro, u.home.x, u.home.y);
    } else if (hold) {
      target = findTarget(st, u, def.range + 0.8);
    } else {
      target = findTarget(st, u, ord.t === 'raid' ? 5 : u.owner === 'player' ? ENGAGE : u.aggro);
      if (!target && u.owner === 'player' && ord.t === 'guard') target = findIntruder(st, u);
    }
    if (target) ord.target = target.id;
  }

  if (ord.t === 'raid' && !target) {
    if (st.time.t - u.raidStart > (u.patience || 130)) {
      u.order = { t: 'retreat' };
      return;
    }
    const b = nearestPlayerBuilding(st, u);
    if (!b) {
      u.order = { t: 'retreat' };
      return;
    }
    ord.target = b.id;
    target = b;
  }

  if (target) {
    // Garrison troops don't chase beyond their leash.
    if (u.home && Math.hypot(u.x - u.home.x, u.y - u.home.y) > u.leash) {
      ord.target = 0;
      u.order = { t: 'guard', x: u.home.x, y: u.home.y };
      u.path = null;
      goTo(st, u, u.home.x, u.home.y);
      return;
    }
    const d = distTo(u, target);
    // Holding: let it go once it is out of reach, unless you ordered the attack.
    if (hold && ord.t !== 'attack' && d > def.range + radiusOf(target) + 0.8) {
      ord.target = 0;
      target = null;
      u.path = null;
      return;
    }
    if (d <= def.range + radiusOf(target)) {
      u.path = null;
      if (u.steal && ord.t === 'raid' && target.kind === 'building' && !u.plunder) {
        steal(st, u);
        return;
      }
      if (u.cd <= 0) attack(st, u, target);
      return;
    }
    const tx = target.kind === 'building' ? target.x + target.w / 2 : target.x;
    const ty = target.kind === 'building' ? target.y + target.h / 2 : target.y;
    if (!u.path || u.repathT <= 0) {
      u.repathT = 1 + st.rng.next();
      const within = target.kind === 'building' ? Math.max(target.w, target.h) / 2 + def.range * 0.7 : Math.max(0.5, def.range * 0.8);
      if (!goTo(st, u, tx, ty, { within, partial: enemy, max: 5000 })) {
        if (ord.t === 'attack') u.order = { t: 'guard', x: u.x, y: u.y };
        ord.target = 0;
        return;
      }
    }
    moveUnit(st, u, dt, def);
    return;
  }

  switch (ord.t) {
    // 'amove' marches but fights whatever it meets; 'move' ignores enemies.
    case 'amove':
    case 'move': {
      if (!u.path && Math.hypot(u.x - ord.x, u.y - ord.y) > 1.2) {
        if (!goTo(st, u, ord.x, ord.y, { partial: true })) {
          u.order = { t: 'guard', x: u.x, y: u.y };
          return;
        }
      }
      if (moveUnit(st, u, dt, def)) u.order = { t: 'guard', x: u.x, y: u.y };
      return;
    }
    case 'guard': {
      if (u.path) {
        moveUnit(st, u, dt, def);
        return;
      }
      if (Math.hypot(u.x - ord.x, u.y - ord.y) > 2.5 && u.repathT <= 0) {
        u.repathT = 2;
        goTo(st, u, ord.x, ord.y, { partial: true });
      }
      return;
    }
    case 'retreat': {
      const home = u.home || u.origin;
      if (!home) {
        removeUnit(st, u);
        return;
      }
      if (!u.path) {
        if (Math.hypot(u.x - home.x, u.y - home.y) < 2 || !goTo(st, u, home.x, home.y, { partial: true })) {
          if (u.despawnHome) removeUnit(st, u);
          else u.order = { t: 'guard', x: u.x, y: u.y };
          return;
        }
      }
      if (moveUnit(st, u, dt, def) && u.despawnHome) removeUnit(st, u);
      return;
    }
    default:
      u.order = { t: 'guard', x: u.x, y: u.y };
  }
}

// Steps along the path; hostile walkers hack at walls that block the way.
function moveUnit(st, u, dt, def) {
  const enemy = u.owner !== 'player';
  const blocked = enemy
    ? (i) => {
        const id = st.occ[i];
        if (!id) return false;
        const b = st.byId.get(id);
        return b && b.owner === 'player' && (b.wall || b.gate);
      }
    : null;
  const done = stepMove(st, u, dt, def.speed, blocked);
  if (enemy && u.blockedBy >= 0) {
    const b = st.byId.get(st.occ[u.blockedBy]);
    if (b && !b.dead) {
      u.order.target = b.id;
      if (u.cd <= 0) attack(st, u, b);
    }
  }
  return done;
}

// --- Towers -------------------------------------------------------------------------

export function updateTowers(st, dt) {
  for (const b of st.buildings) {
    const tw = BUILDINGS[b.type].tower;
    if (!tw || b.dead || b.built < 1 || b.owner !== 'player') continue;
    b.cd -= dt;
    if (b.cd > 0) continue;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    let best = null;
    let bestD = tw.range;
    for (const u of st.units) {
      if (u.dead || !isHostileOwner(st, 'player', u.owner)) continue;
      const d = Math.hypot(u.x - cx, u.y - cy);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    if (!best) continue;
    b.cd = tw.cd;
    st.fx.push({ kind: tw.cannon ? 'ball' : 'arrow', x0: cx, y0: cy - 1, x1: best.x, y1: best.y, t: 0, dur: tw.cannon ? 0.5 : 0.35 });
    damage(st, b, best, tw.dmg * st.rng.range(0.85, 1.15));
  }
}

// --- Training -----------------------------------------------------------------------

export function canTrain(st, b, type) {
  const def = UNITS[type];
  if (!BUILDINGS[b.type].trains?.includes(type)) return { ok: false, reason: 'Not trained here.' };
  if ((def.era || 0) > st.era) return { ok: false, reason: `Needs the ${ERAS[def.era].name} age.` };
  if (def.requires && !st.buildings.some((x) => x.type === def.requires && x.built >= 1 && !x.dead)) {
    return { ok: false, reason: `Needs a ${BUILDINGS[def.requires].name}.` };
  }
  const queued = st.buildings.reduce((n, x) => n + x.queue.length, 0);
  if (armySize(st) + queued >= armyCap(st)) return { ok: false, reason: 'Army is at its limit. Build or upgrade a Training Ground.' };
  if (!canAfford(st, def.cost)) {
    const short = Object.entries(def.cost).filter(([k, v]) => (k === 'food' ? false : st.res[k] < v)).map(([k]) => (k === 'cowries' ? 'money' : k));
    return { ok: false, reason: short.length ? `Not enough ${short.join(' and ')}.` : 'Not enough food.' };
  }
  return { ok: true };
}

export function train(st, b, type) {
  const can = canTrain(st, b, type);
  if (!can.ok) return can;
  spend(st, UNITS[type].cost);
  b.queue.push(type);
  return { ok: true };
}

// Recruits come from those sitting at the fire with no work.
function findRecruit(st) {
  const free = st.citizens.filter((c) => !c.dead && !c.stranger && !c.guest && !c.job && !c.special && (c.state === 'wait' || c.state === 'arrive' || c.state === 'idle' || c.state === 'movein'));
  return free.find((c) => c.volunteer) || free[0] || null;
}

export function updateTraining(st, dt) {
  for (const b of st.buildings) {
    if (!b.queue.length || b.dead || b.built < 1) continue;
    const type = b.queue[0];
    const def = UNITS[type];
    b.trainT += dt;
    if (b.trainT < def.train) {
      b.trainStatus = '';
      continue;
    }
    const recruit = findRecruit(st);
    if (!recruit) {
      // Nobody free at the fire: a volunteer walks in from the villages around.
      const coming = b.volunteer && st.byId.get(b.volunteer);
      if (!coming || coming.dead) {
        const v = spawnStranger(st, null, undefined, undefined, { near: true, quiet: true });
        if (v) {
          b.volunteer = v.id;
          v.volunteer = true;
          notifyOnce(st, 'volunteer', 20, `🛡️ Nobody at the fire is free to train, so ${v.name} is coming from the villages around to join the guard.`, 'info', v);
        }
      }
      b.trainStatus = 'Waiting for a recruit: a volunteer is on the way.';
      continue;
    }
    b.volunteer = 0;
    b.queue.shift();
    b.trainT = 0;
    b.trainStatus = '';
    const name = recruit.name;
    removeCitizen(st, recruit);
    const rally = b.rally || { x: b.x + b.w / 2 + st.rng.range(-1.5, 1.5), y: b.y + b.h + 1 + st.rng.range(0, 1.5) };
    const u = createUnit(st, type, Math.floor(b.x + b.w / 2), Math.floor(b.y + b.h), 'player', { name, order: { t: 'move', x: rally.x, y: rally.y } });
    st.stats.trained++;
    notifyOnce(st, `trained-${type}`, 4, `🛡️ ${name} has become a ${def.name.toLowerCase()}.`, 'good', u);
  }
}

export function armyPower(st, owner = 'player') {
  let p = 0;
  for (const u of st.units) if (u.owner === owner && !u.dead) p += unitPower(u.type);
  if (owner === 'player') {
    for (const b of st.buildings) {
      if (b.owner !== 'player' || b.dead || b.built < 1) continue;
      if (b.type === 'watchtower') p += 25;
      if (b.type === 'fort') p += 120;
    }
  }
  return p;
}

// --- War bands and landings ---------------------------------------------------------

export function launchWarBand(st, owner, origin, types, opts = {}) {
  const ids = [];
  for (const type of types) {
    const ox = Math.max(1, Math.min(st.W - 2, Math.floor(origin.x + st.rng.range(-1.5, 1.5))));
    const oy = Math.max(1, Math.min(st.H - 2, Math.floor(origin.y + st.rng.range(-1.5, 1.5))));
    const u = createUnit(st, type, ox, oy, owner, { order: { t: 'raid' }, aggro: 5 });
    u.origin = { x: origin.x, y: origin.y };
    u.despawnHome = true;
    u.raidStart = st.time.t;
    if (opts.steal) u.steal = true;
    if (opts.patience) u.patience = opts.patience;
    ids.push(u.id);
  }
  st.expeditions.push({ owner, ids, onDefeat: opts.onDefeat || null, label: opts.label || '' });
  return ids;
}

export function updateExpeditions(st) {
  for (const ex of st.expeditions) {
    if (ex.done) continue;
    const alive = ex.ids.filter((id) => {
      const u = st.byId.get(id);
      return u && !u.dead;
    });
    if (alive.length) continue;
    ex.done = true;
    const killed = ex.ids.length;
    if (ex.onDefeat) {
      st.eventQueue.push({ id: ex.onDefeat });
    } else if (killed && ex.label) {
      notify(st, `🏆 The ${ex.label} has been driven off.`, 'good');
    }
  }
  st.expeditions = st.expeditions.filter((e) => !e.done);
}

// --- Ships -------------------------------------------------------------------------

export function sendShip(st, power, purpose, payload = {}) {
  const home = st.buildings.find((b) => b.type === 'compound' || b.type === 'palace');
  const nx = home ? home.x : st.start.x;
  const ny = home ? home.y : st.start.y;
  const prefer = payload.prefer || 'south';
  const landing = payload.near
    ? findLanding(st, payload.near.x, payload.near.y, 0, null)
    : findLanding(st, nx, ny, payload.minDist ?? 12, prefer);
  if (landing < 0) return null;
  const lx = landing % st.W;
  const ly = Math.floor(landing / st.W);

  // Anchor on the water tile next to the landing.
  let anchor = -1;
  for (let dy = -1; dy <= 1 && anchor < 0; dy++) {
    for (let dx = -1; dx <= 1 && anchor < 0; dx++) {
      const x = lx + dx;
      const y = ly + dy;
      if (x < 0 || y < 0 || x >= st.W || y >= st.H) continue;
      const t = st.terrain[y * st.W + x];
      if (t <= 2) anchor = y * st.W + x;
    }
  }
  if (anchor < 0) anchor = landing;
  const sx = prefer === 'west' ? 1 : st.rng.int(Math.floor(st.W * 0.2), Math.floor(st.W * 0.8));
  const sy = st.H - 2;
  const path = findPath(st, sx, sy, anchor % st.W, Math.floor(anchor / st.W), { naval: true, max: 20000 });
  const ship = {
    id: st.nextId++,
    kind: 'ship',
    power,
    purpose,
    payload,
    x: sx + 0.5,
    y: sy + 0.5,
    px: sx + 0.5,
    py: sy + 0.5,
    path: path || [],
    pi: 0,
    land: { x: lx, y: ly },
    state: 'arrive',
    start: { x: sx, y: sy },
    facing: 1,
  };
  st.ships.push(ship);
  return ship;
}

export function updateShips(st, dt) {
  for (const s of st.ships) {
    s.px = s.x;
    s.py = s.y;
    if (s.state === 'arrive' || s.state === 'leave') {
      const done = stepShip(st, s, dt);
      if (!done) continue;
      if (s.state === 'leave') {
        s.dead = true;
        continue;
      }
      s.state = 'anchored';
      s.timer = 20;
      arrive(st, s);
    } else if (s.state === 'anchored') {
      s.timer -= dt;
      if (s.timer <= 0) {
        s.state = 'leave';
        s.path = (s.path || []).slice(0, s.pi).reverse();
        s.pi = 0;
      }
    }
  }
  st.ships = st.ships.filter((s) => !s.dead);
}

function stepShip(st, s, dt) {
  if (!s.path || s.pi >= s.path.length) return true;
  let budget = 3.2 * dt;
  while (budget > 0 && s.pi < s.path.length) {
    const n = s.path[s.pi];
    const nx = (n % st.W) + 0.5;
    const ny = Math.floor(n / st.W) + 0.5;
    const dx = nx - s.x;
    const dy = ny - s.y;
    const d = Math.hypot(dx, dy);
    if (dx) s.facing = dx > 0 ? 1 : -1;
    if (d <= budget) {
      s.x = nx;
      s.y = ny;
      budget -= d;
      s.pi++;
    } else {
      s.x += (dx / d) * budget;
      s.y += (dy / d) * budget;
      budget = 0;
    }
  }
  return s.pi >= s.path.length;
}

function arrive(st, s) {
  const land = s.land;
  if (s.purpose === 'envoy') {
    st.eventQueue.push({ id: s.payload.event });
    s.timer = 30;
  } else if (s.purpose === 'merchant') {
    merchantArrives(st, s.power);
    s.timer = DAY * 3;
  } else if (s.purpose === 'landing') {
    if (s.payload.bombard) bombard(st, s, s.payload.bombard);
    launchWarBand(st, s.power, land, s.payload.troops, { onDefeat: s.payload.onDefeat, label: s.payload.label });
    notify(st, `⚓ ${st.foreign[s.power]?.name || 'Foreign'} soldiers are landing!`, 'war', land);
  }
}

function bombard(st, s, n) {
  const targets = st.buildings
    .filter((b) => b.owner === 'player' && !b.dead && !BUILDINGS[b.type].invulnerable)
    .map((b) => ({ b, d: Math.hypot(b.x - s.x, b.y - s.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n);
  for (const { b } of targets) {
    st.fx.push({ kind: 'ball', x0: s.x, y0: s.y, x1: b.x + b.w / 2, y1: b.y + b.h / 2, t: 0, dur: 0.8 });
    damage(st, null, b, b.maxHp * 0.6);
  }
  if (targets.length) notify(st, '💥 Warship cannon fire is pounding your town!', 'war', s.land);
}
