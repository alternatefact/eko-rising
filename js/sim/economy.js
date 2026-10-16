// Stocks, storage, food, taxes, happiness and the flow of strangers.

import { RESOURCES, FOOD, GOODS } from '../data/resources.js';
import { BUILDINGS, stat } from '../data/buildings.js';
import { HIRES } from '../data/units.js';
import { F, WALK } from '../world/terrain.js';
import { createCitizen, notify, notifyOnce, removeCitizen } from './entities.js';
import { goTo } from './move.js';

export const DAY = 24; // seconds of game time per day
export const DAYS_PER_SEASON = 4;
export const SEASONS = [
  { name: 'Rainy season', yo: 'Ìgbà Òjò', farm: 1.35, tint: null },
  { name: 'Harmattan', yo: 'Ìgbà Ọyẹ́', farm: 0.6, tint: 'rgba(214,170,110,0.16)' },
  { name: 'Dry season', yo: 'Ìgbà Ẹ̀ẹ̀rùn', farm: 1, tint: 'rgba(255,214,140,0.06)' },
];
export const RATIONS = [
  { name: 'None', eat: 0, mood: -20 },
  { name: 'Half', eat: 0.5, mood: -8 },
  { name: 'Normal', eat: 1, mood: 0 },
  { name: 'Feast', eat: 1.5, mood: 8 },
];
export const TAXES = [
  { name: 'None', per: 0, mood: 8 },
  { name: 'Low', per: 0.5, mood: 0 },
  { name: 'Fair', per: 1, mood: -8 },
  { name: 'Heavy', per: 1.6, mood: -16 },
];

export function season(st) {
  return SEASONS[Math.floor(st.time.day / DAYS_PER_SEASON) % SEASONS.length];
}

// --- Storage ----------------------------------------------------------------

export function capacity(st) {
  let food = 0;
  let goods = 0;
  for (const b of st.buildings) {
    if (b.owner !== 'player' || b.built < 1) continue;
    const s = stat(b, 'storage');
    if (!s) continue;
    food += s.food || 0;
    goods += s.goods || 0;
  }
  return { food, goods };
}

export function totalFood(st) {
  return FOOD.reduce((a, k) => a + st.res[k], 0);
}

export function roomFor(st, res) {
  const kind = RESOURCES[res].kind;
  if (kind === 'money') return Infinity;
  const cap = st.cap;
  if (kind === 'food') return Math.max(0, cap.food - totalFood(st));
  return Math.max(0, cap.goods - st.res[res]);
}

// Adds what fits; returns the amount actually stored.
export function addRes(st, res, n) {
  const fit = Math.min(n, roomFor(st, res));
  st.res[res] += fit;
  if (fit > 0 && st.stats.made[res] !== undefined) st.stats.made[res] += fit;
  return fit;
}

export function canAfford(st, cost) {
  for (const [k, v] of Object.entries(cost)) {
    if (k === 'food') {
      if (totalFood(st) < v) return false;
    } else if (st.res[k] < v) return false;
  }
  return true;
}

export function spend(st, cost) {
  if (!canAfford(st, cost)) return false;
  for (const [k, v] of Object.entries(cost)) {
    if (k === 'food') takeFood(st, v);
    else st.res[k] -= v;
  }
  return true;
}

// Takes food evenly from whatever is in stock. Returns how much was found.
export function takeFood(st, amount) {
  let left = amount;
  for (let pass = 0; pass < 4 && left > 1e-6; pass++) {
    const avail = FOOD.filter((k) => st.res[k] > 1e-6);
    if (!avail.length) break;
    const share = left / avail.length;
    for (const k of avail) {
      const t = Math.min(share, st.res[k]);
      st.res[k] -= t;
      left -= t;
    }
  }
  return amount - left;
}

// --- Who lives here ----------------------------------------------------------

export function residents(st) {
  return st.citizens.filter((c) => !c.stranger && !c.dead);
}

export function strangers(st) {
  return st.citizens.filter((c) => c.stranger && !c.dead && c.state !== 'leave');
}

export function housingCap(st) {
  let n = 0;
  for (const b of st.buildings) {
    if (b.owner === 'player' && b.built >= 1 && BUILDINGS[b.type].housing) n += stat(b, 'housing');
  }
  return n;
}

// Warriors lent by allies are guests: they don't count against your army.
export function armySize(st) {
  return st.units.filter((u) => u.owner === 'player' && !u.dead && !u.ally).length;
}

export function armyCap(st) {
  let n = 4;
  for (const b of st.buildings) if (b.owner === 'player' && b.built >= 1 && BUILDINGS[b.type].army) n += stat(b, 'army');
  return n;
}

export function population(st) {
  return residents(st).length + armySize(st);
}

export function hasBuilding(st, type, built = true) {
  return st.buildings.some((b) => b.type === type && b.owner === 'player' && !b.dead && (!built || b.built >= 1));
}

export function countBuilding(st, type) {
  return st.buildings.filter((b) => b.type === type && b.owner === 'player' && !b.dead && b.built >= 1).length;
}

// Where strangers wait: the palace square once you are a town, otherwise the
// campfire outside the compound.
export function gatheringPoint(st) {
  const palace = st.buildings.find((b) => b.type === 'palace' && b.built >= 1 && !b.dead);
  if (palace) return { x: palace.x + palace.w / 2, y: palace.y + palace.h + 1.5, town: true };
  const fire = st.buildings.find((b) => b.type === 'campfire' && !b.dead);
  if (fire) return { x: fire.x + 1, y: fire.y + 1, town: false };
  return { x: st.start.x + 0.5, y: st.start.y + 3.5, town: false };
}

// --- Daily accounting ----------------------------------------------------------

export function dailyUpkeep(st) {
  const mouths = population(st);
  const ration = RATIONS[st.rations];
  const want = mouths * ration.eat;
  const got = want > 0 ? takeFood(st, want) : 0;
  st.hungry = want > 0 && got < want - 0.01;
  if (st.hungry) {
    st.starveDays++;
    notifyOnce(st, 'hungry', DAY * 2, '🍽️ Your people are going hungry. Build farms, hunters or fishing jetties.', 'bad');
  } else {
    st.starveDays = 0;
  }

  const tax = TAXES[st.tax].per * residents(st).length;
  let income = tax;
  if (st.flags.colonized && !st.flags.independent) income *= 0.75;
  st.res.cowries += income;
  st.stats.lastTax = income;

  if (st.flags.beninTribute && st.res.cowries > 0) {
    const due = Math.min(st.res.cowries, 3 + st.era * 2);
    st.res.cowries -= due;
  }
  if (st.flags.frenchPact) st.res.cowries += 8;
  if (st.flags.britishPartner) st.res.cowries += 10;

  // Money makes money.
  const interest = hasBuilding(st, 'bank') && st.res.cowries > 0 ? Math.min(60, st.res.cowries * 0.01) : 0;
  st.res.cowries += interest;
  st.stats.lastInterest = interest;

  payWages(st);

  // Salt and cloth are used up a little every day; while they last, people are glad of them.
  const need = Math.max(1, Math.ceil(population(st) / 25));
  for (const k of ['salt', 'cloth']) {
    st.luxury[k] = st.res[k] >= need;
    if (st.luxury[k]) st.res[k] -= need;
  }

  // Palm trees bear fruit again.
  for (let i = 0; i < st.feature.length; i++) {
    if (st.feature[i] === F.PALM && st.amount[i] < 12) st.amount[i] = Math.min(12, st.amount[i] + 3);
  }

  st.mods = st.mods.filter((m) => m.until > st.time.day);
  st.marketSold = {};
}

// --- Happiness -----------------------------------------------------------------

export function happinessFactors(st) {
  const out = [];
  const food = totalFood(st);
  const ration = RATIONS[st.rations];
  if (st.hungry || (food < 1 && population(st) > 0)) out.push({ label: 'No food', v: -20 });
  else out.push({ label: `Rations: ${ration.name}`, v: ration.mood });
  const kinds = FOOD.filter((k) => st.res[k] >= 1).length;
  if (kinds > 1) out.push({ label: 'Varied diet', v: (kinds - 1) * 4 });
  out.push({ label: `Tax: ${TAXES[st.tax].name}`, v: TAXES[st.tax].mood });

  if (st.luxury.salt) out.push({ label: 'Salt in every pot', v: 4 });
  if (st.luxury.cloth) out.push({ label: 'Fine cloth', v: 4 });
  const tended = st.buildings.filter((b) => b.type === 'shrine' && b.built >= 1 && b.workers.some((id) => st.byId.get(id)?.state === 'tend')).length;
  if (tended) out.push({ label: 'Shrines', v: Math.min(3, tended) * 6 });
  const wells = countBuilding(st, 'well');
  if (wells) out.push({ label: 'Wells', v: Math.min(3, wells) * 2 });
  for (const t of ['market', 'palace', 'school', 'assembly', 'hospital']) {
    const b = st.buildings.find((x) => x.type === t && x.owner === 'player' && !x.dead && x.built >= 1);
    if (b) out.push({ label: BUILDINGS[t].name, v: stat(b, 'happiness') });
  }
  if (st.bonusHappy) out.push({ label: 'Blessings found', v: st.bonusHappy });
  if (st.flags.colonized && !st.flags.independent) out.push({ label: 'Foreign rule', v: -6 });
  if (st.flags.beninTribute) out.push({ label: 'Tribute to Benin', v: -2 });
  const homeless = strangers(st).length;
  if (homeless > 6) out.push({ label: 'Crowded campfire', v: -Math.min(8, homeless - 6) });
  for (const m of st.mods) out.push({ label: m.label, v: m.v });
  return out;
}

export function updateHappiness(st, dt) {
  st.moodT -= dt;
  if (st.moodT > 0) return;
  st.moodT = 2;
  const factors = happinessFactors(st);
  const target = Math.max(0, Math.min(100, 50 + factors.reduce((a, f) => a + f.v, 0)));
  st.happyTarget = target;
  if (st.happy < target) st.happy = Math.min(target, st.happy + 1);
  else if (st.happy > target) st.happy = Math.max(target, st.happy - 1);
}

export function addMood(st, label, v, days) {
  const m = st.mods.find((x) => x.label === label);
  if (m) {
    m.v = Math.max(-15, Math.min(15, m.v + v));
    m.until = Math.max(m.until, st.time.day + days);
    return;
  }
  st.mods.push({ label, v, until: st.time.day + days });
}

// --- Strangers arriving and leaving -----------------------------------------------

export function updateMigration(st, dt) {
  st.migrateT -= dt;
  if (st.migrateT > 0) return;
  const h = st.happy;
  const waiting = strangers(st).length;
  const cap = 4 + st.era * 3;
  const school = (hasBuilding(st, 'school') ? 0.75 : 1) * (hasBuilding(st, 'hospital') ? 0.8 : 1);
  st.migrateT = Math.max(9, 42 - (h - 50) * 0.7) * school;

  if (h >= 50 && waiting < cap && !st.gameOver) {
    spawnStranger(st);
  } else if (h < 35 || st.starveDays >= 2) {
    st.migrateT = Math.max(12, 10 + h * 0.5);
    const pool = residents(st).filter((c) => c.state !== 'leave' && !c.special);
    if (!pool.length) return;
    const jobless = pool.filter((c) => !c.job);
    const who = jobless.length ? st.rng.pick(jobless) : st.rng.pick(pool);
    sendAway(st, who);
    notify(st, `😞 ${who.name} has packed up and left ${st.name}. Your people are unhappy.`, 'bad', who);
  }
}

export function spawnStranger(st, origin, nearX, nearY) {
  const gp = gatheringPoint(st);
  const cx = nearX ?? gp.x;
  const cy = nearY ?? gp.y;
  let spot = -1;
  for (let k = 0; k < 30 && spot < 0; k++) {
    const a = st.rng.range(0, Math.PI * 2);
    const r = nearX !== undefined ? st.rng.range(0, 2) : st.rng.range(16, 24);
    const x = Math.floor(cx + Math.cos(a) * r);
    const y = Math.floor(cy + Math.sin(a) * r);
    if (x < 1 || y < 1 || x >= st.W - 1 || y >= st.H - 1) continue;
    const i = y * st.W + x;
    if (!st.reach[i] || WALK[st.terrain[i]] === 0) continue;
    spot = i;
  }
  if (spot < 0) return null;
  const c = createCitizen(st, spot % st.W, Math.floor(spot / st.W), { origin, stranger: true, state: 'arrive' });
  st.stats.arrived++;
  if (st.stats.arrived <= 3 || st.rng.chance(0.35)) {
    notify(st, `👋 ${c.name}, ${c.female ? 'a woman' : 'a man'} of the ${c.people} from ${c.from}, is coming to ${st.name}.`, 'good', c);
  }
  return c;
}

export function sendAway(st, c) {
  if (c.job) {
    const b = st.byId.get(c.job);
    if (b) b.workers = b.workers.filter((id) => id !== c.id);
    c.job = 0;
  }
  if (c.home) {
    const h = st.byId.get(c.home);
    if (h) h.residents = h.residents.filter((id) => id !== c.id);
    c.home = 0;
  }
  c.stranger = true;
  c.carry = null;
  c.state = 'leave';
  const a = st.rng.range(0, Math.PI * 2);
  const tx = Math.max(1, Math.min(st.W - 2, c.x + Math.cos(a) * 26));
  const ty = Math.max(1, Math.min(st.H - 2, c.y + Math.sin(a) * 26));
  if (!goTo(st, c, tx, ty, { partial: true, max: 3000 })) removeCitizen(st, c);
  st.dirty.jobs = true;
}

// --- Hired fighters -------------------------------------------------------------

export function wagesDue(st) {
  return st.units.reduce((n, u) => n + (u.owner === 'player' && !u.dead && u.wage ? u.wage : 0), 0);
}

// Mercenaries are paid every morning. Those who go unpaid walk away.
function payWages(st) {
  const hired = st.units.filter((u) => u.owner === 'player' && !u.dead && u.wage);
  if (!hired.length) return;
  for (const u of hired) {
    if (st.res.cowries >= u.wage) {
      st.res.cowries -= u.wage;
    } else {
      u.dead = true;
      st.dirty.cleanup = true;
      notifyOnce(st, 'deserted', DAY, `💸 Unpaid, your hired ${u.name ? `fighter ${u.name}` : 'fighters'} walked away. Keep money in the treasury for wages.`, 'bad', u);
    }
  }
}

export function hireOptions(st) {
  return HIRES.filter((h) => h.era <= st.era + 1);
}

// --- Market ----------------------------------------------------------------------

export function marketLevel(st) {
  const m = st.buildings.find((b) => b.type === 'market' && b.owner === 'player' && !b.dead && b.built >= 1);
  return m ? stat(m, 'price') : 0;
}

export function priceOf(st, res, buying) {
  const base = RESOURCES[res].price;
  const level = marketLevel(st) || 1;
  return buying ? Math.ceil((base * 2) / level) : Math.max(1, Math.round(base * level));
}

// Local buyers only want so much of each good a day; big sales go to the
// ships and to other kingdoms.
export function marketDemand(st, res) {
  const level = st.buildings.find((b) => b.type === 'market' && b.owner === 'player' && !b.dead)?.level || 1;
  const cap = 10 + level * 10;
  const sold = st.marketSold[res] || 0;
  return Math.max(0, cap - sold);
}

export function trade(st, res, qty, buying) {
  if (!hasBuilding(st, 'market')) return { ok: false, reason: 'Build a market first.' };
  if (buying && RESOURCES[res].imported) return { ok: false, reason: 'Only the ships at your port sell that.' };
  const unit = priceOf(st, res, buying);
  if (buying) {
    const room = roomFor(st, res);
    const n = Math.min(qty, room);
    if (n <= 0) return { ok: false, reason: 'No room to store it.' };
    if (st.res.cowries < unit * n) return { ok: false, reason: 'Not enough money.' };
    st.res.cowries -= unit * n;
    st.res[res] += n;
    return { ok: true, n };
  }
  const n = Math.min(qty, Math.floor(st.res[res]), marketDemand(st, res));
  if (n <= 0) return { ok: false, reason: st.res[res] < 1 ? 'Nothing to sell.' : `Nobody else at the market wants ${RESOURCES[res].name.toLowerCase()} today. Sell to a kingdom or a ship.` };
  st.res[res] -= n;
  st.res.cowries += unit * n;
  st.marketSold[res] = (st.marketSold[res] || 0) + n;
  st.stats.earned = (st.stats.earned || 0) + unit * n;
  return { ok: true, n };
}

export const TRADEABLE = [...FOOD, ...GOODS];
