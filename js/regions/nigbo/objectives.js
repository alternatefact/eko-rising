// The northern Igbo country's goals, shown at the top left once the guided
// opening is over. Some only appear once the story reaches them (`when`).

import { has, count, pop, unifiedCount, majorCount } from '../common.js';

export const OBJECTIVES = [
  { id: 'pop8', text: 'Grow to 16 people', hint: 'Keep people fed and happy and more will come. Each new house brings two.', done: (st) => pop(st) >= 16 },
  { id: 'scout', text: 'Explore the land with a scout', hint: 'Select your compound and train a scout. Then tap the map to send them along the paths.', done: (st) => st.stats.explored >= 1800, reward: { cowries: 20 } },
  { id: 'era1', text: 'Advance to the Compound age', hint: 'Open the Era panel (🌅) at the top.', done: (st) => st.era >= 1, reward: { cowries: 30 } },
  { id: 'market', text: 'Build a market and choose its day', hint: 'Eke, Orie, Afọ or Nkwọ: traders walk from one market to the next.', when: (st) => st.era >= 1, done: (st) => !!st.flags.marketDay, reward: { cowries: 30 } },
  { id: 'store', text: 'Build a Storehouse and a Granary', hint: 'Room beyond the storage floors, and shorter walks for your workers.', when: (st) => st.era >= 1, done: (st) => has(st, 'storehouse') && has(st, 'granary') },
  { id: 'mudwall', text: 'Rebuild part of your fence as a mud wall', hint: 'Pull down a few fence sections (🔨 Pull down) and build a Mud Wall in their place. Mud walls are far tougher.', when: (st) => st.era >= 1, done: (st) => count(st, 'stonewall') >= 4 },
  { id: 'tradeagree', text: 'Make a trade agreement with a town', hint: 'Trade brings money every day, and they buy what they lack. Meet a people with a scout, then use the Peoples panel (🤝).', done: (st) => st.factions.some((f) => f.trade || f.status === 'allied') },
  { id: 'aro', text: 'Break the Aro war bands', hint: 'They gather in the south and march when they are ready. Walls, soldiers and friends, or the priests of Nri: or carry the war to their camp.', when: (st) => !!st.factionMap.aro_host, done: (st) => !!st.flags.igboWon || !!st.factionMap.aro_host?.beaten, reward: { cowries: 150 } },
  { id: 'subdue1', text: 'Bring a town under your rule', hint: 'Conquer one, or frighten it into paying tribute. No town grows past the Compound age without it.', done: (st) => st.factions.some((f) => f.temperament !== 'bandit' && (f.status === 'conquered' || f.status === 'vassal')) },
  { id: 'palace', text: 'Build the assembly house and become a Town', hint: 'Then advance to the Town age.', done: (st) => st.era >= 2 },
  { id: 'all', text: 'Unite the northern Igbo country', hint: 'The Nsukka villages, the Udi towns, Ezza and the Igala share this land with you: ally with them, or rule them.', done: (st) => unifiedCount(st) >= majorCount(st) },
];
