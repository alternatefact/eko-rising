// Money from trade. Merchant ships dock at your port to buy palm oil, garri
// and fish and to sell what the land cannot make; kingdoms you have an
// agreement with buy what they lack and sell what they have; and money buys
// fighters — hired by the day, or lent by an ally.

import { RESOURCES } from '../data/resources.js';
import { BUILDINGS } from '../data/buildings.js';
import { UNITS, HIRES } from '../data/units.js';
import { createUnit, notify, notifyOnce } from './entities.js';
import { addRes, roomFor, armySize, armyCap, DAY } from './economy.js';
import { sendShip } from './military.js';

// What each foreign power's merchants buy (price paid per unit) and sell
// ([price, stock]). `tools` and `nets` are one-time improvements.
export const SHIP_TRADE = {
  portuguese: {
    buys: { palmoil: 8, garri: 6, fish: 3, yam: 3, wood: 3 },
    sells: { muskets: [34, 6], iron: [8, 30], salt: [6, 40], cloth: [10, 30], horses: [65, 2], tools: [160], nets: [110] },
  },
  french: {
    buys: { palmoil: 10, garri: 6, fish: 4, cassava: 2 },
    sells: { muskets: [30, 8], cloth: [9, 40], salt: [6, 30], cannon: [125, 2], tools: [150] },
  },
  british: {
    buys: { palmoil: 12, garri: 7, cassava: 3, fish: 4, wood: 3 },
    sells: { muskets: [28, 10], cannon: [105, 3], iron: [6, 40], salt: [5, 50], cloth: [8, 50], tools: [140], nets: [95] },
  },
};

export const UPGRADE_ITEMS = {
  tools: { name: 'Iron hoes & cutlasses', icon: '🪓', desc: 'Your farmers, woodcutters and miners work a quarter faster.' },
  nets: { name: 'Fishing nets', icon: '🕸️', desc: 'Fishermen land half as much again.' },
};

function port(st) {
  return st.buildings.find((b) => b.type === 'port' && b.owner === 'player' && !b.dead && b.built >= 1);
}

function partners(st) {
  return Object.keys(SHIP_TRADE).filter((p) => st.foreign[p] && st.foreign[p].trade && !st.foreign[p].hostile);
}

// --- Merchant ships ---------------------------------------------------------------

export function updatePort(st) {
  const p = port(st);
  const harbour = st.harbour;
  if (harbour.ship && st.time.day >= harbour.ship.until) {
    notify(st, `⛵ The ${st.foreign[harbour.ship.power].name} merchant ship has sailed.`, 'info');
    harbour.ship = null;
    harbour.next = st.time.day + st.rng.int(5, 8);
  }
  if (!p || harbour.ship || harbour.sailing || st.time.day < harbour.next) return;
  const list = partners(st);
  if (!list.length) return;
  const power = st.rng.pick(list);
  const ship = sendShip(st, power, 'merchant', { near: { x: p.x + 1, y: p.y + 1 }, minDist: 0 });
  if (!ship) {
    harbour.next = st.time.day + 3;
    return;
  }
  harbour.sailing = true;
  notifyOnce(st, 'merchant-sighted', 10, `⛵ A ${st.foreign[power].name} merchant ship is sailing for your port.`, 'info', { x: p.x, y: p.y });
}

// Called by the ship when it drops anchor.
export function merchantArrives(st, power) {
  const t = SHIP_TRADE[power];
  const jitter = () => st.rng.range(0.85, 1.15);
  const buys = {};
  for (const [k, v] of Object.entries(t.buys)) buys[k] = Math.max(1, Math.round(v * jitter() * (st.era >= 3 ? 1.15 : 1)));
  const sells = {};
  for (const [k, [price, stock]] of Object.entries(t.sells)) {
    if (k === 'cannon' && st.era < 3) continue;
    if ((k === 'tools' || k === 'nets') && st.tech[k]) continue;
    sells[k] = { price: Math.round(price * jitter()), stock: stock ?? 1 };
  }
  st.harbour.sailing = false;
  st.harbour.ship = { power, until: st.time.day + 3, buys, sells };
  st.stats.ships = (st.stats.ships || 0) + 1;
  const p = port(st);
  notify(st, `⚓ A ${st.foreign[power].name} merchant ship has docked at your port! It trades for 3 days — open the Port to sell and buy.`, 'good', p ? { x: p.x + 1, y: p.y + 1 } : null);
}

export function sellToShip(st, res, qty) {
  const ship = st.harbour.ship;
  if (!ship) return { ok: false, reason: 'No ship in port.' };
  const price = ship.buys[res];
  if (!price) return { ok: false, reason: 'They are not buying that.' };
  const n = Math.min(qty, Math.floor(st.res[res]));
  if (n <= 0) return { ok: false, reason: 'You have none to sell.' };
  st.res[res] -= n;
  st.res.cowries += price * n;
  st.stats.earned = (st.stats.earned || 0) + price * n;
  st.stats.shipSales = (st.stats.shipSales || 0) + 1;
  return { ok: true, n, earned: price * n };
}

export function buyFromShip(st, item, qty) {
  const ship = st.harbour.ship;
  if (!ship) return { ok: false, reason: 'No ship in port.' };
  const offer = ship.sells[item];
  if (!offer || offer.stock <= 0) return { ok: false, reason: 'Sold out.' };
  if (UPGRADE_ITEMS[item]) {
    if (st.res.cowries < offer.price) return { ok: false, reason: 'Not enough money.' };
    st.res.cowries -= offer.price;
    st.tech[item] = true;
    offer.stock = 0;
    notify(st, `🛠️ ${UPGRADE_ITEMS[item].name} bought. ${UPGRADE_ITEMS[item].desc}`, 'good');
    return { ok: true, n: 1 };
  }
  const n = Math.min(qty, offer.stock, Math.floor(roomFor(st, item)));
  if (n <= 0) return { ok: false, reason: 'No room in your storehouses.' };
  if (st.res.cowries < offer.price * n) return { ok: false, reason: 'Not enough money.' };
  st.res.cowries -= offer.price * n;
  st.res[item] += n;
  offer.stock -= n;
  return { ok: true, n };
}

// --- Trade with kingdoms --------------------------------------------------------------

export function canBarter(f) {
  return f.status === 'allied' || f.status === 'vassal' || (f.trade && f.status !== 'hostile');
}

// Each kingdom only needs so much of anything; demand refills every few days.
function demandLeft(st, f, res) {
  if (!f.demand || st.time.day >= f.demandReset) {
    f.demand = {};
    f.demandReset = st.time.day + 5;
  }
  if (f.demand[res] === undefined) f.demand[res] = 5 + f.strength * 3;
  return f.demand[res];
}

// How much more of a good they will take before the next refill (no side effects).
export function barterRoom(st, f, res) {
  if (!f.demand || st.time.day >= f.demandReset || f.demand[res] === undefined) return 5 + f.strength * 3;
  return f.demand[res];
}

export function barter(st, fid, res, qty, selling) {
  const f = st.factionMap[fid];
  if (!f || !canBarter(f)) return { ok: false, reason: 'Make a trade agreement first.' };
  if (selling) {
    const price = f.wants?.[res];
    if (!price) return { ok: false, reason: 'They do not need that.' };
    const n = Math.min(qty, Math.floor(st.res[res]), demandLeft(st, f, res));
    if (n <= 0) return { ok: false, reason: st.res[res] < 1 ? 'You have none.' : 'They have enough for now. Come back in a few days.' };
    st.res[res] -= n;
    st.res.cowries += price * n;
    f.demand[res] -= n;
    f.relation = Math.min(100, f.relation + 1);
    st.stats.earned = (st.stats.earned || 0) + price * n;
    return { ok: true, n };
  }
  const price = f.offers?.[res];
  if (!price) return { ok: false, reason: 'They do not sell that.' };
  const n = Math.min(qty, Math.floor(roomFor(st, res)));
  if (n <= 0) return { ok: false, reason: 'No room to store it.' };
  if (st.res.cowries < price * n) return { ok: false, reason: 'Not enough money.' };
  st.res.cowries -= price * n;
  addRes(st, res, n);
  return { ok: true, n };
}

// Trade routes pay a little every day and slowly build trust.
export function dailyTrade(st) {
  let income = 0;
  for (const f of st.factions) {
    if (f.status === 'hostile' || f.status === 'conquered') continue;
    if (!f.trade && f.status !== 'allied') continue;
    // A trickle: the real money is in selling them what they need.
    income += 1 + Math.ceil(f.strength / 2) + (f.status === 'allied' ? 2 : 0);
    if (f.relation < 60) f.relation += 1;
  }
  if (income) st.res.cowries += income;
  st.stats.tradeIncome = income;
}

// --- Fighters for money ---------------------------------------------------------------

export function hire(st, buildingId, hireId) {
  const b = st.byId.get(buildingId);
  const h = HIRES.find((x) => x.id === hireId);
  if (!b || !h || !BUILDINGS[b.type].hires) return { ok: false, reason: 'You cannot hire here.' };
  if (b.wrecked) return { ok: false, reason: 'Mend the house first.' };
  if (h.era > st.era) return { ok: false, reason: 'Not available in this age yet.' };
  if (armySize(st) >= armyCap(st)) return { ok: false, reason: 'Your army is at its limit. Build a Training Ground.' };
  if (st.res.cowries < h.cost) return { ok: false, reason: 'Not enough money.' };
  st.res.cowries -= h.cost;
  const x = Math.floor(b.x + b.w / 2);
  const y = Math.floor(b.y + b.h);
  const u = createUnit(st, h.unit, x, y, 'player', { name: h.name, order: { t: 'move', x: x + st.rng.range(-1.5, 1.5), y: y + 1.5 } });
  u.wage = h.wage;
  u.hired = true;
  st.stats.hired = (st.stats.hired || 0) + 1;
  notifyOnce(st, `hired-${h.id}`, 3, `💰 A ${h.name.toLowerCase()} has joined you for ${h.cost}, and will want ${h.wage} a day.`, 'good', u);
  return { ok: true, unit: u };
}

// An ally sends warriors to fight beside you for a few minutes.
export function askForWarriors(st, fid) {
  const f = st.factionMap[fid];
  if (!f || f.status !== 'allied') return { ok: false, reason: 'Only allies will send warriors.' };
  if (f.helpReady > st.time.day) return { ok: false, reason: `They sent warriors recently. Ask again on day ${f.helpReady + 1}.` };
  const types = Object.keys(f.garrison).filter((t) => UNITS[t]);
  const n = 2 + f.strength;
  const home = st.buildings.find((b) => b.type === 'palace' && !b.dead) || st.buildings.find((b) => b.type === 'compound' && !b.dead);
  const tx = home ? home.x + home.w / 2 : st.start.x;
  const ty = home ? home.y + home.h + 2 : st.start.y;
  for (let k = 0; k < n; k++) {
    const u = createUnit(st, st.rng.pick(types), f.x, f.y, 'player', { name: `${f.people} warrior`, order: { t: 'amove', x: tx + st.rng.range(-2, 2), y: ty + st.rng.range(-1, 2) }, cloth: f.color });
    u.ally = f.id;
    u.expires = st.time.t + DAY * 10;
  }
  f.helpReady = st.time.day + 12;
  f.relation -= 5;
  notify(st, `🤝 ${f.leader || `The ${f.name}`} sends ${n} warriors to fight beside you for ten days.`, 'good', { x: f.x, y: f.y });
  return { ok: true };
}

export function expireAllies(st) {
  for (const u of st.units) {
    if (u.ally && !u.dead && st.time.t >= u.expires) {
      u.dead = true;
      st.dirty.cleanup = true;
      notifyOnce(st, `allies-home-${u.ally}`, 30, `🏠 The ${st.factionMap[u.ally]?.people || 'allied'} warriors have gone home.`, 'info');
    }
  }
}

export function importName(k) {
  return UPGRADE_ITEMS[k]?.name || RESOURCES[k]?.name || k;
}

export function importIcon(k) {
  return UPGRADE_ITEMS[k]?.icon || RESOURCES[k]?.icon || '';
}
