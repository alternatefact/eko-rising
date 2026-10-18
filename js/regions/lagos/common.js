// Questions the Lagos events, guided opening and goals ask about the town.

import { BUILDINGS } from '../../data/buildings.js';

export const has = (st, type) => st.buildings.some((b) => b.type === type && b.owner === 'player' && b.built >= 1 && !b.dead);
export const count = (st, type) => st.buildings.filter((b) => b.type === type && b.owner === 'player' && b.built >= 1 && !b.dead).length;
export const pop = (st) => st.citizens.filter((c) => !c.stranger && !c.dead).length + st.units.filter((u) => u.owner === 'player' && !u.dead).length;
export const unifiedCount = (st) => st.factions.filter((f) => f.major && ['allied', 'vassal', 'conquered'].includes(f.status)).length;
export const majorCount = (st) => st.factions.filter((f) => f.major).length;
export const many = (type, n) => Array.from({ length: n }, () => type);
export const founderOf = (st) => st.citizens.find((c) => c.special === 'founder' && !c.dead);
export const spouseOf = (st) => st.citizens.find((c) => c.special === 'spouse' && !c.dead);
export const guests = (st) => (st.flags.wanderers || []).map((id) => st.byId.get(id)).filter((c) => c && !c.dead);
export const his = (female) => (female ? 'her' : 'his');
export const building = (st, type) => st.buildings.find((b) => b.type === type && b.owner === 'player' && !b.dead);
export const home = (st) => building(st, 'compound');
export const workersOf = (st, type) => st.citizens.filter((c) => !c.dead && st.byId.get(c.job)?.type === type);
export const names = (list) => list.map((c) => c.name).join(' and ');

// Bricks the kingdom upgrade needs for everything standing now.
export const mudCost = (st) => st.buildings.reduce((n, b) => n + (b.owner === 'player' && !b.dead && b.built >= 1 && !b.mud ? BUILDINGS[b.type].mudBricks || 0 : 0), 0);
export const near = (c, x, y, r) => c && Math.hypot(c.x - x, c.y - y) <= r;
