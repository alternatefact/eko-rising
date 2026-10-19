// Ogun's goals, shown at the top left a few at a time. Some only appear once
// the story reaches them (`when`).

import { pop, unifiedCount, majorCount, claimed } from './common.js';

export const OBJECTIVES = [
  { id: 'compound', text: 'Reach the Compound age', hint: 'Your people did it in Lagos and know the way: here it needs fewer people and half the cost. Open 🌅 Era at the top.', done: (st) => st.era >= 1, reward: { cowries: 30 } },
  { id: 'scout', text: 'Explore the land with a scout', hint: 'Train a scout at your compound and send it along the paths.', done: (st) => st.stats.explored >= 1800, reward: { cowries: 20 } },
  { id: 'kidnappers', text: 'Burn the kidnappers’ camp', hint: 'It lies in the west. Gather your soldiers (🛡️ Army) and tap the camp: they set the tents alight.', when: (st) => st.fired.kidnappers !== undefined, done: (st) => !st.factionMap.bandits_n || st.factionMap.bandits_n.status === 'conquered', reward: { cowries: 40 } },
  { id: 'olumo', text: 'Climb Olúmọ Rock', hint: 'It stands in the north, above the Ẹ̀gbá towns. Send a scout or soldier to it.', done: (st) => claimed(st, 'olumo'), reward: { cowries: 40 } },
  { id: 'pop20', text: 'Grow to 20 people', hint: 'Fed, happy people with beds bring newcomers. Each new house brings two.', done: (st) => pop(st) >= 20 },
  { id: 'meetegba', text: 'Meet the Ẹ̀gbá of Abẹ́òkúta', hint: 'Their towns lie under Olúmọ Rock in the north.', done: (st) => !!st.factionMap.egba?.discovered },
  { id: 'tradeagree', text: 'Make a trade agreement', hint: 'Build a market, send gifts, then open trade from the Peoples panel (🤝).', done: (st) => st.factions.some((f) => f.trade || f.status === 'allied') },
  { id: 'subdue1', text: 'Subdue a kingdom', hint: 'Conquer one, or frighten it into paying tribute.', done: (st) => st.factions.some((f) => f.temperament !== 'bandit' && (f.status === 'conquered' || f.status === 'vassal')) },
  { id: 'dahomey', text: 'Break the host of Dahomey', hint: 'They gather in the west and march when they are ready. Walls, towers, soldiers and friends: or carry the war to their camp.', when: (st) => !!st.factionMap.dahomey_host, done: (st) => !!st.flags.ogunWon || !!st.factionMap.dahomey_host?.beaten, reward: { cowries: 150 } },
  { id: 'unite', text: 'Unite every people of Ogun', hint: 'Five peoples share this land: ally with them, or rule them.', done: (st) => unifiedCount(st) >= majorCount(st) },
];
