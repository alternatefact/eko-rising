// Story events, objectives, era advancement and the end of the chapter.
// Region files supply the actual events; this module runs them.

import { ERAS } from '../data/eras.js';
import { BUILDINGS } from '../data/buildings.js';
import { notify } from './entities.js';
import { canAfford, spend, population, hasBuilding, addRes, addMood, spawnStranger } from './economy.js';
import { diplomacy, giftCost, unified, majors, subdued, STRENGTH, initFaction } from './factions.js';
import { sendShip, launchWarBand, armyPower, declareWar } from './military.js';
import { findLanding } from './world.js';
import { spawnPack, herdNear } from './animals.js';
import { takeIn, assignTo } from './citizens.js';
import { revealAround } from './world.js';
import { DAY } from './economy.js';

// Helpers handed to region event code, so regions never reach into internals.
export function makeApi(st) {
  return {
    notify: (text, kind, at) => notify(st, text, kind, at),
    addRes: (k, n) => addRes(st, k, n),
    mood: (label, v, days) => addMood(st, label, v, days),
    schedule: (id, days) => st.scheduled.push({ id, day: st.time.day + days }),
    queue: (id, data = {}) => st.eventQueue.push({ id, ...data }),
    ship: (power, purpose, payload) => sendShip(st, power, purpose, payload),
    landing: (power, troops, opts = {}) => {
      const home = st.buildings.find((b) => b.type === 'palace' || b.type === 'compound');
      const i = findLanding(st, home ? home.x : st.start.x, home ? home.y : st.start.y, opts.minDist ?? 12, opts.prefer);
      if (i < 0) return;
      const at = { x: (i % st.W) + 0.5, y: Math.floor(i / st.W) + 0.5 };
      launchWarBand(st, power, at, troops, opts);
      notify(st, `⚓ ${st.foreign[power]?.name || ''} soldiers have come ashore!`, 'war', at);
    },
    strangers: (n, nearX, nearY) => {
      for (let k = 0; k < n; k++) spawnStranger(st, null, nearX, nearY);
    },
    // One newcomer walking in from the bush: { female, calling, guest, near, quiet }.
    wanderer: (opts) => spawnStranger(st, null, undefined, undefined, opts),
    // A pack of wolves out of the bush (see animals.js).
    pack: (n) => spawnPack(st, n),
    // Antelope grazing near the house.
    herd: (n) => herdNear(st, n),
    welcome: (ids) => ids.forEach((id) => takeIn(st, st.byId.get(id))),
    reveal: (x, y, r) => revealAround(st, x, y, r),
    // Move someone from one kind of workplace to a building.
    reassign: (fromType, to) => {
      const c = st.citizens.find((p) => !p.dead && !p.special && st.byId.get(p.job)?.type === fromType && !p.carry);
      const any = c || st.citizens.find((p) => !p.dead && !p.special && st.byId.get(p.job)?.type === fromType);
      return any ? assignTo(st, any, to).ok && any : null;
    },
    // A band of raiders from a people's camp; `steal` makes for the stores.
    raid: (fid, types, opts = {}) => {
      const f = st.factionMap[fid];
      if (!f) return [];
      return launchWarBand(st, fid, { x: f.x + 0.5, y: f.y + 0.5 }, types, opts);
    },
    faction: (def, at) => {
      const i = findLanding(st, at[0] * st.W, at[1] * st.H, 0, null);
      const spot = i >= 0 ? { x: i % st.W, y: Math.floor(i / st.W) } : { x: Math.floor(at[0] * st.W), y: Math.floor(at[1] * st.H) };
      const f = initFaction(st, def, spot);
      st.dirty.territory = true;
      return f;
    },
    war: (fid) => st.factionMap[fid] && declareWar(st, st.factionMap[fid], false),
    power: () => armyPower(st),
    unifiedCount: () => unified(st).length,
    majorsCount: () => majors(st).length,
    has: (type) => hasBuilding(st, type),
    pop: () => population(st),
  };
}

// --- Event engine --------------------------------------------------------------------

export function eventDef(st, entry) {
  if (entry.id === 'meet') return meetEvent(st, st.factionMap[entry.fid]);
  if (entry.id === 'age') return ageEvent(st, entry.era);
  return st.region.events.find((e) => e.id === entry.id) || null;
}

export function checkEvents(st) {
  const api = makeApi(st);
  // While the guided opening runs, only it decides what happens.
  const guided = st.tut && !st.tut.done;
  for (const ev of st.region.events) {
    if (!ev.when || (guided && !ev.story)) continue;
    // Repeating events (festivals, caravans) may come back after `repeat` days.
    const last = st.fired[ev.id];
    if (last !== undefined && (!ev.repeat || st.time.day - last < ev.repeat)) continue;
    let ok = false;
    try {
      ok = ev.when(st, api);
    } catch (err) {
      ok = false;
    }
    if (!ok) continue;
    st.fired[ev.id] = st.time.day;
    if (ev.silent) ev.apply(st, api);
    else st.eventQueue.push({ id: ev.id });
  }
  const due = st.scheduled.filter((s) => s.day <= st.time.day);
  if (due.length) {
    st.scheduled = st.scheduled.filter((s) => s.day > st.time.day);
    for (const s of due) {
      const ev = st.region.events.find((e) => e.id === s.id);
      if (!ev) continue;
      if (ev.silent) ev.apply(st, api);
      else st.eventQueue.push({ id: s.id });
    }
  }
}

export function chooseEvent(st, index) {
  const entry = st.eventQueue[0];
  if (!entry) return;
  const ev = eventDef(st, entry);
  st.eventQueue.shift();
  if (!ev) return;
  const choice = ev.choices[index];
  if (!choice) return;
  if (choice.can && !choice.can(st)) {
    st.eventQueue.unshift(entry);
    return;
  }
  choice.apply?.(st, makeApi(st), entry);
}

// Shown when the town enters a new age.
function ageEvent(st, era) {
  const e = ERAS[era];
  if (!e) return null;
  const unlocks = Object.values(BUILDINGS).filter((d) => d.era === era && d.buildable !== false).map((d) => d.name);
  return {
    id: 'age',
    title: `A new age: ${e.name} (${e.yo})`,
    art: '🌅',
    text: () => `${st.name} has grown into something new.\n\n${e.blurb}${unlocks.length ? `\n\nYou can now build: ${unlocks.join(', ')}.` : ''}`,
    choices: [{ label: 'Onward' }],
  };
}

// The generic "you have met a people" event.
function meetEvent(st, f) {
  if (!f) return null;
  const gift = giftCost(st, f);
  const temper = { friendly: 'They seem warm and curious.', proud: 'They are proud and watchful.', warlike: 'Their warriors watch you with open hostility.' }[f.temperament] || '';
  return {
    id: 'meet',
    title: `You meet the ${f.name}`,
    art: 'meet',
    color: f.color,
    text: () => `${f.leader ? `${f.leader} receives your messengers.\n\n` : ''}${f.desc}\n\nStrength: ${'★'.repeat(f.strength)}${'☆'.repeat(5 - f.strength)} ${STRENGTH[f.strength]}. ${temper}`,
    choices: [
      {
        label: `Send gifts (🐚 ${gift})`,
        hint: 'Relations improve. Enough goodwill and they may ally with you.',
        can: (s) => s.res.cowries >= gift,
        apply: (s) => diplomacy(s, f.id, 'gift'),
      },
      {
        label: 'Propose a trade agreement',
        hint: 'Once you have a Market: their caravans bring a little money every day, and they will buy what they lack.',
        apply: (s) => {
          if (f.relation < 10) f.relation += f.temperament === 'friendly' ? 10 : 4;
          diplomacy(s, f.id, 'trade');
        },
      },
      {
        label: 'Greet them as kin',
        hint: f.temperament === 'friendly' ? 'They will warm to you.' : 'A small start.',
        apply: (s) => {
          f.relation += f.temperament === 'friendly' ? 12 : 4;
          notify(s, `🤲 You exchange greetings with the ${f.name}.`, 'info', { x: f.x, y: f.y });
        },
      },
      {
        label: 'Demand they submit',
        hint: 'Works only if your army is clearly stronger. Otherwise it insults them.',
        apply: (s) => diplomacy(s, f.id, 'demand'),
      },
      { label: 'Leave them be', hint: 'Deal with them later from the Peoples panel.' },
    ],
  };
}

// --- Era advancement ---------------------------------------------------------------------

export function eraRequirements(st) {
  const next = ERAS[st.era + 1];
  if (!next) return null;
  const out = [];
  const req = next.req || {};
  if (req.pop) out.push({ text: `Population ${req.pop}`, met: population(st) >= req.pop, have: population(st) });
  if (req.building) out.push({ text: `Build the ${BUILDINGS[req.building].name}`, met: hasBuilding(st, req.building) });
  for (const b of req.buildings || []) out.push({ text: `Build a ${BUILDINGS[b].name}`, met: hasBuilding(st, b) });
  if (req.flag === 'metEuropeans') out.push({ text: 'Make contact with the ships from across the sea', met: !!st.flags.metEuropeans });
  if (req.subdued) {
    const n = subdued(st).length;
    out.push({ text: `Subdue ${req.subdued} kingdom${req.subdued > 1 ? 's' : ''} — conquer them or make them pay tribute`, met: n >= req.subdued, have: n });
  }
  out.push({ text: 'Pay the cost', met: canAfford(st, next.cost || {}), cost: next.cost });
  return { next, reqs: out };
}

export function advanceEra(st) {
  const r = eraRequirements(st);
  if (!r || !r.reqs.every((q) => q.met)) return false;
  spend(st, r.next.cost || {});
  st.era++;
  st.time.year = Math.max(st.time.year, r.next.year);
  st.flags[`era${st.era}Day`] = st.time.day;
  if (st.era >= 2 && !st.flags.cassava) {
    st.flags.cassava = true;
    notify(st, '🌿 Cassava cuttings have spread along the coast. You can now plant Cassava Farms and build Garri Houses.', 'good');
  }
  st.dirty.territory = true;
  addMood(st, `A new age: ${r.next.name}`, 8, 4);
  notify(st, `🌅 ${st.name} enters the ${r.next.name} era (${r.next.yo}). ${r.next.blurb}`, 'good');
  st.eventQueue.push({ id: 'age', era: st.era });
  return true;
}

// --- The New Nigeria ---------------------------------------------------------------------

export function proclaimRequirements(st) {
  const all = majors(st);
  const u = unified(st);
  return [
    { text: 'Reach the Metropolis age', met: st.era >= 4 },
    { text: `Unite every major people of ${st.region.name} (${u.length}/${all.length}) — by alliance, tribute or conquest`, met: u.length >= all.length },
    { text: 'Settle the question of the Europeans', met: !!st.flags.foreignResolved },
    { text: 'Build the House of Assembly', met: hasBuilding(st, 'assembly') },
  ];
}

export function proclaim(st) {
  if (!proclaimRequirements(st).every((r) => r.met)) return false;
  st.flags.proclaimed = true;
  st.gameOver = { victory: true, day: st.time.day, year: st.time.year };
  notify(st, '🇳🇬 The New Nigeria is proclaimed!', 'good');
  return true;
}

// --- Objectives -----------------------------------------------------------------------------

export function objectives(st) {
  const list = st.region.objectives;
  const out = [];
  // The guide gives the goals until the opening is over.
  if (st.tut && !st.tut.done) return out;
  for (const o of list) {
    if (st.objDone[o.id]) continue;
    // Some goals only appear once the story reaches them.
    if (o.when && !o.when(st)) continue;
    let done = false;
    try {
      done = o.done(st);
    } catch (err) {
      done = false;
    }
    if (done) {
      st.objDone[o.id] = true;
      if (o.reward) {
        for (const [k, v] of Object.entries(o.reward)) addRes(st, k, v);
      }
      notify(st, `✅ Goal complete: ${o.text}${o.reward ? ` (reward: ${Object.entries(o.reward).map(([k, v]) => `${v} ${k}`).join(', ')})` : ''}`, 'good');
      o.then?.(st, makeApi(st));
      continue;
    }
    out.push(o);
    if (out.length >= 3) break;
  }
  return out;
}

export { DAY };
