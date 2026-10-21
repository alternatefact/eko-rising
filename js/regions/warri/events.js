// The history of the western delta, arriving as the town grows: the guided
// opening's stories in Itsekiri words, the prince from Benin who founded the
// kingdom, salt and fish for the Urhobo's palm oil, the Portuguese at the
// river mouth, the regatta, and the Oba of Benin's war fleet, come to bring
// the creek towns back under Benin. Breaking it wins Warri.

import { has, pop, unifiedCount, majorCount, many } from '../common.js';
import { openingEvents, greatHost, historyNote, warmer } from '../kit.js';
import { ITSEKIRI } from '../../cultures/itsekiri.js';

// The Oba of Benin's war fleet: Edo warriors with leather shields and brass
// helmets, and archers, landed from their canoes in the north.
const FLEET = greatHost({
  id: 'benin_fleet',
  def: {
    name: 'The Oba’s war fleet', people: 'Edo', strength: 5, temperament: 'bandit', major: false,
    leader: 'A war chief of the Oba of Benin', color: '#a3171b', huts: 8, side: 'north',
    loot: { cowries: 400, weapons: 30, cloth: 30 }, joiners: 0, raids: false, radius: 9,
    desc: 'The warriors of the Oba of Benin, landed from their war canoes and camped in the north round their war chief’s tent.',
  },
  army: (n) => {
    const bows = Math.round(n * 0.25);
    return { benin: n - bows, bowman: bows };
  },
  // The fleet takes longer to gather than an army on foot.
  min: 24,
  days: { defiant: 20, gifts: 30 },
  raid: { power: 'edo', types: ['benin', 'benin', 'bowman'], label: 'Benin war canoes', text: '🛶 Benin war canoes are landing warriors in the north!' },
  ally: { id: 'urhobo', ask: 'Ask the Urhobo to stand with us', types: [...many('warrior', 4), ...many('bowman', 2)], text: 'Urhobo warriors have come down from Agbarha to stand with you.' },
  seen: {
    title: 'The Oba’s war fleet',
    text: (st, n) => `War canoes crowd the river in the north, and the Oba of Benin’s warriors are camped on the bank: ${n} of them, with leather shields and brass helmets, round their war chief’s tent.`,
  },
  march: {
    title: 'Benin marches',
    text: (st, n) => `The drums on the river have stopped. ${n} warriors of Benin are on the march through the mangroves, coming for ${st.name}.`,
  },
  beaten: {
    title: 'The fleet goes home',
    text: (st) => `The last of the Oba’s warriors are back in their canoes and paddling north, and they will not come again this year. Word runs along every creek: ${st.name} stood against Benin, and won.\n\n🏆 This stage is won: Warri is yours.${historyNote('Warri was founded by a prince of Benin, and the two kingdoms were bound together for centuries; as Warri grew rich on the trade of the creeks it went its own way.')}`,
  },
  won: 'warriWon',
});

export const EVENTS = [
  ...openingEvents(ITSEKIRI, {
    intro: {
      title: 'The land among the creeks',
      text: (st) =>
        `${st.founder} and ${st.spouse} have paddled for days down the creeks of the delta with a cutlass, a hoe and a basket of plantain suckers. On a rise of dry ground among the mangroves they find a house of mud and thatch: empty, its owners long gone, its roof fallen in.\n\n“The walls still stand,” says ${st.founder}. “We will mend it, settle here, and build a community.”\n\nThe forest behind is a wall, the creeks before it are a road to everywhere, and the trees are all the wood you need. One day a kingdom of the waters could rule from here, and what it becomes is up to you.`,
    },
    here: 'here among the creeks',
    ahead: (st) => `From here, grow ${st.name} as you choose: more people, the Compound age, the clans and towns of the delta, and, one day, the ships at the river mouth.`,
  }),
  {
    id: 'harmattan',
    when: (st) => Math.floor(st.time.day / 4) % 3 === 1,
    title: 'The Harmattan',
    art: '🌫️',
    text: () => 'The dry wind from the Sahara reaches even the creeks: the mornings are cool and hazy and the plantains grow slowly until the rains return. Keep your stores full and your fishermen busy.',
    choices: [{ label: 'We will manage' }],
  },
  {
    id: 'ginuwa',
    when: (st) => st.time.day >= 12 && pop(st) >= 8,
    title: 'The prince from Benin',
    art: '🛶',
    text: (st) => `A fleet of canoes comes down the river: a young prince of Benin, Ginuwa, with seventy young men of the noblest families of the city and their servants. The Oba has sent him away from the court, and he is looking for land of his own.\n\n“Let us settle beside you,” he asks ${st.founder}. “Your town will be greater for it.”${historyNote('Ginuwa, a son of the Oba of Benin, founded the Itsekiri kingdom around 1480. His descendants have reigned as the Olu of Warri ever since.')}`,
    choices: [
      {
        label: 'Welcome him and his followers',
        hint: 'Five of his people come to live with you, and your town is proud.',
        apply: (st, api) => {
          st.flags.ginuwa = true;
          for (let k = 0; k < 5; k++) api.wanderer({ near: true, quiet: true });
          api.mood('A prince among us', 6, 8);
        },
      },
      { label: 'Give him land across the creek', hint: 'He settles on his own.' },
    ],
  },
  {
    id: 'creek_trade',
    repeat: 24,
    when: (st) => has(st, 'fisher') && st.time.day >= 20,
    title: 'Canoes for the Urhobo markets',
    art: '🛶',
    text: () => 'Traders are loading their canoes for the markets upriver, where the Urhobo pay in palm oil and cloth for the creek towns’ dried fish and salt.',
    choices: [
      {
        label: 'Send 20 fish (+20 palm oil, +🐚 30)',
        can: (st) => st.res.fish >= 20,
        apply: (st, api) => {
          st.res.fish -= 20;
          api.addRes('palmoil', 20);
          api.addRes('cowries', 30);
          warmer(st, 'urhobo', 5);
        },
      },
      {
        label: 'Send 10 salt (+🐚 90)',
        can: (st) => st.res.salt >= 10,
        apply: (st, api) => {
          st.res.salt -= 10;
          api.addRes('cowries', 90);
        },
      },
      { label: 'Not today' },
    ],
  },
  {
    id: 'portuguese_warri',
    when: (st) => st.era >= 1 && st.time.day >= 30,
    title: 'Ships at the river mouth',
    art: '⛵',
    text: () => `A ship with white sails lies at the river mouth, and a boat full of Portuguese traders comes up the creek. They have cloth, iron and beads, and want fish, salt and palm oil, and a friend in the creeks.${historyNote('the Portuguese traded in the western delta from the 1500s. Around 1600 a prince of Warri, Dom Domingos, was sent to study in Portugal, and came home with a Portuguese wife.')}`,
    choices: [
      {
        label: 'Trade with them',
        hint: 'Cloth, iron and money, and your people learn of the lands across the sea.',
        apply: (st, api) => {
          st.flags.metEuropeans = true;
          st.foreign.portuguese.trade = true;
          api.addRes('cloth', 20);
          api.addRes('iron', 10);
          api.addRes('cowries', 60);
        },
      },
      {
        label: 'Send a son of the town across the sea to study',
        hint: 'Your people learn of the lands across the sea, and are proud.',
        apply: (st, api) => {
          st.flags.metEuropeans = true;
          api.mood('Our son across the sea', 5, 8);
        },
      },
      { label: 'Send them away', hint: 'The creeks keep their own counsel.' },
    ],
  },
  {
    id: 'regatta',
    repeat: 36,
    when: (st) => has(st, 'fisher') && st.era >= 1 && st.time.day >= 24,
    title: 'The regatta',
    art: '🛶',
    text: (st) => `The young men of ${st.name} want a regatta: war canoes dressed in cloth and flags, racing on the creek to the drums, with the whole town on the banks.`,
    choices: [
      {
        label: 'Hold the regatta (🐚 60)',
        hint: '+15 happiness for eight days.',
        can: (st) => st.res.cowries >= 60,
        apply: (st, api) => {
          st.res.cowries -= 60;
          api.mood('The regatta', 15, 8);
          api.notify('🛶 The canoes race down the creek to the drums, and the whole town cheers.', 'good');
        },
      },
      { label: 'Not this year' },
    ],
  },
  {
    id: 'benin_claim',
    when: (st) => st.era >= 1 && pop(st) >= 16 && st.time.day >= 24,
    title: 'War canoes from Benin',
    art: '🥁',
    text: (st) => `Drums on the river: war canoes from Benin, and an envoy of the Oba wearing coral beads.\n\n“The creek towns belong to the Oba,” he says. “${st.name} will send its tribute of salt and fish to Benin, as all the waterside does. Refuse, and the Oba’s warriors will come for it.”`,
    choices: FLEET.choices({ defy: 'Warri bows to no one!', defyHint: 'War with Benin. Their war canoes will come first, then their host.' }),
  },
  ...FLEET.events,
  {
    id: 'warri_united',
    when: (st) => unifiedCount(st) >= majorCount(st),
    title: 'The creeks stand together',
    art: '🏆',
    text: (st) => `The Urhobo, the Isoko, the Ijaw towns and the Oba’s river post now stand with ${st.name}: by friendship, by tribute, or by the sword.\n\nThe western delta is one. More of Nigeria opens in a future update.`,
    choices: [{ label: 'Keep building', apply: (st) => (st.flags.warriUnited = true) }],
  },
];
