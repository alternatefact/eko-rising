// Questions the Ogun events and goals ask about the town and the land.

export { has, pop, unifiedCount, majorCount, many, building } from '../lagos/common.js';

export const claimed = (st, kind) => st.pois.some((p) => p.kind === kind && p.claimed);

// A people of the land that still stands on its own: not conquered, and not
// at war with you.
export const atPeace = (st, id) => {
  const f = st.factionMap[id];
  return !!f && f.status !== 'conquered' && f.status !== 'hostile';
};

// A people of the land who are your friends: allied, or nearly.
export const friends = (st, id) => {
  const f = st.factionMap[id];
  return !!f && (f.status === 'allied' || (f.status !== 'hostile' && f.relation >= 40));
};

export const warmer = (st, id, n) => {
  const f = st.factionMap[id];
  if (f) f.relation = Math.max(-100, Math.min(100, f.relation + n));
};
