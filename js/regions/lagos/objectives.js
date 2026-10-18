// The goals shown once the guided opening is over.

import { has, count, pop, unifiedCount, majorCount } from './common.js';

export const OBJECTIVES = [
  { id: 'pop8', text: 'Grow to 16 people', hint: 'Keep people fed and happy and more will come. Each new house brings two.', done: (st) => pop(st) >= 16 },
  { id: 'scout', text: 'Explore the land with a scout', hint: 'Select your compound and train a scout. Then tap the map to send them along the paths.', done: (st) => st.stats.explored >= 1800, reward: { cowries: 20 } },
  { id: 'era1', text: 'Advance to the Compound age', hint: 'Open the Era panel (🌅) at the top.', done: (st) => st.era >= 1, reward: { cowries: 30 } },
  { id: 'store', text: 'Build a Storehouse and a Granary', hint: 'Room beyond the storage floors, and shorter walks for your workers.', when: (st) => st.era >= 1, done: (st) => has(st, 'storehouse') && has(st, 'granary') },
  { id: 'mudwall', text: 'Rebuild part of your fence as a mud wall', hint: 'Pull down a few fence sections (🔨 Pull down) and build a Mud Wall in their place. Mud walls are far tougher.', when: (st) => st.era >= 1, done: (st) => count(st, 'stonewall') >= 4 },
  { id: 'tradeagree', text: 'Make a trade agreement with a kingdom', hint: 'Trade brings money every day, and they buy what they lack. Meet a people with a scout, then use the Peoples panel (🤝).', done: (st) => st.factions.some((f) => f.trade || f.status === 'allied') },
  { id: 'subdue1', text: 'Subdue a kingdom', hint: 'Conquer one, or frighten it into paying tribute. No town grows past the Compound age without it.', done: (st) => st.factions.some((f) => f.temperament !== 'bandit' && (f.status === 'conquered' || f.status === 'vassal')) },
  { id: 'palace', text: 'Build the Ààfin and become a Town', hint: 'Then advance to the Town age.', done: (st) => st.era >= 2 },
  { id: 'garri', text: 'Make garri', hint: 'Plant a Cassava Farm and build a Garri House. Garri feeds your people and sells well.', done: (st) => (st.stats.made.garri || 0) > 0 },
  { id: 'ship', text: 'Sell goods to a merchant ship', hint: 'Build a Port. Ships dock every few days to buy palm oil, garri and fish — and sell muskets, cannon, tools and more.', done: (st) => (st.stats.shipSales || 0) > 0 },
  { id: 'port', text: 'Become a Port City', hint: 'Subdue two kingdoms, trade with the ships, build a market and a canoe yard.', done: (st) => st.era >= 3 },
  { id: 'foreign', text: 'Settle the question of the Europeans', hint: 'Treaty, partnership or war — your call.', done: (st) => !!st.flags.foreignResolved },
  { id: 'metro', text: 'Reach the Metropolis age', hint: 'Subdue three kingdoms, build a port and a school, and gather a fortune.', done: (st) => st.era >= 4 },
  { id: 'all', text: 'Unite every major people of Lagos', hint: 'Five peoples share this land with you — ally with them, or rule them.', done: (st) => unifiedCount(st) >= majorCount(st) },
  { id: 'nigeria', text: 'Proclaim The New Nigeria', hint: 'Build the House of Assembly, then proclaim it from the Era panel.', done: (st) => !!st.flags.proclaimed },
];
