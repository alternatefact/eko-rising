// Kano's goals, shown at the top left once the guided opening is over. Some
// only appear once the story reaches them (`when`).

import { has, count, pop, unifiedCount, majorCount } from '../common.js';

const claimed = (st, kind) => st.pois.some((p) => p.kind === kind && p.claimed);

export const OBJECTIVES = [
  { id: 'pop8', text: 'Grow to 16 people', hint: 'Keep people fed and happy and more will come. Each new house brings two.', done: (st) => pop(st) >= 16 },
  { id: 'scout', text: 'Explore the land with a scout', hint: 'Select your compound and train a scout. Then tap the map to send them along the paths.', done: (st) => st.stats.explored >= 1800, reward: { cowries: 20 } },
  { id: 'dala', text: 'Climb Dala hill', hint: 'It stands to the north. Send a scout or a soldier to the top.', done: (st) => claimed(st, 'dala'), reward: { cowries: 30 } },
  { id: 'era1', text: 'Advance to the Compound age', hint: 'Open the Era panel (🌅) at the top.', done: (st) => st.era >= 1, reward: { cowries: 30 } },
  { id: 'store', text: 'Build a Storehouse and a Granary', hint: 'Room beyond the storage floors, and shorter walks for your workers.', when: (st) => st.era >= 1, done: (st) => has(st, 'storehouse') && has(st, 'granary') },
  { id: 'mudwall', text: 'Raise a mud wall, as Amina did', hint: 'Pull down a few fence sections (🔨 Pull down) and build a Mud Wall in their place. Mud walls are far tougher.', when: (st) => st.era >= 1, done: (st) => count(st, 'stonewall') >= 4 },
  { id: 'horses', text: 'Buy horses from a desert caravan', hint: 'The caravans come once you reach the Compound age. Horses make horsemen, and the Durbar.', when: (st) => st.era >= 1, done: (st) => st.res.horses >= 1 || st.units.some((u) => u.owner === 'player' && u.type === 'horseman') },
  { id: 'tradeagree', text: 'Make a trade agreement with a kingdom', hint: 'Trade brings money every day, and they buy what they lack. Meet a people with a scout, then use the Peoples panel (🤝).', done: (st) => st.factions.some((f) => f.trade || f.status === 'allied') },
  { id: 'kwararafa', text: 'Break the host of Kwararafa', hint: 'They gather in the south and march when they are ready. Walls, soldiers and friends: or carry the war to their camp.', when: (st) => !!st.factionMap.kwararafa_host, done: (st) => !!st.flags.kanoWon || !!st.factionMap.kwararafa_host?.beaten, reward: { cowries: 150 } },
  { id: 'subdue1', text: 'Subdue a kingdom', hint: 'Conquer one, or frighten it into paying tribute. No town grows past the Compound age without it.', done: (st) => st.factions.some((f) => f.temperament !== 'bandit' && (f.status === 'conquered' || f.status === 'vassal')) },
  { id: 'palace', text: 'Build the Gidan Sarki and become a Town', hint: 'Then advance to the Town age.', done: (st) => st.era >= 2 },
  { id: 'all', text: 'Unite the Hausa kingdoms', hint: 'Katsina, Zazzau, Rano and Daura share this land with you: ally with them, or rule them.', done: (st) => unifiedCount(st) >= majorCount(st) },
];
