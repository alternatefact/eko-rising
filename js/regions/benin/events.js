// The history of the Edo forest, arriving as the town grows: the guided
// opening's stories in Edo words, the walls and moats of Ewuare's time, the
// Portuguese at Ughoton, the bronze casters, the Igue festival, proud Udo,
// and the host of the Igala kingdom from Idah, which Queen Mother Idia helped
// to break. Breaking it wins Benin.

import { has, pop, unifiedCount, majorCount, many } from '../common.js';
import { openingEvents, greatHost, historyNote, atPeace, warmer } from '../kit.js';
import { EDO } from '../../cultures/edo.js';

// The army of the Attah of Igala: spearmen, archers and horsemen from Idah,
// across the Niger in the east.
const IGALA = greatHost({
  id: 'igala_host',
  def: {
    name: 'The Igala host', people: 'Igala', strength: 5, temperament: 'bandit', major: false,
    leader: 'A war chief of the Attah of Igala', color: '#3d2b6b', huts: 8, side: 'east',
    loot: { cowries: 400, weapons: 30, iron: 30, horses: 3 }, joiners: 0, raids: false, radius: 9,
    desc: 'The army of the Attah of Igala, camped in the east round their war chief’s tent: spearmen with hide shields, archers, and horsemen from Idah.',
  },
  army: (n) => {
    const riders = Math.round(n * 0.18);
    const bows = Math.round(n * 0.25);
    return { igala: n - riders - bows, bowman: bows, igalarider: riders };
  },
  days: { defiant: 16, gifts: 26 },
  raid: { power: 'igala', types: ['igalarider', 'igalarider', 'igala'], label: 'Igala riders', text: '🐎 Igala horsemen are riding in from the east!' },
  ally: { id: 'esan', ask: 'Ask the Esan chiefs to stand with us', types: [...many('warrior', 4), ...many('bowman', 2)], text: 'Esan warriors have come down from the north-east to stand with you.' },
  onMarch: (st, api) => {
    if (st.flags.idia) api.lend('idia', [...many('warrior', 4), ...many('bowman', 2)], 10, { name: 'Idia’s warrior', color: '#b3261e' });
  },
  seen: {
    title: 'The host of Igala',
    text: (st, n) => `Your lookouts see their fires in the east: the army of the Attah of Igala, ${n} strong, camped round their war chief’s tent. Spearmen with hide shields, archers, and horsemen.`,
  },
  march: {
    title: 'The Igala march',
    text: (st, n) => `The war drums of Idah have fallen silent. ${n} warriors of the Igala are on the march, coming for ${st.name}.${st.flags.idia ? '\n\nIdia walks at the head of her own warriors, as she promised.' : ''}`,
  },
  beaten: {
    title: 'Idah is broken',
    text: (st) => `The last of the Igala army has gone back across the Niger, and the drums of Idah are silent. Word runs along every forest path: ${st.name} stood against the Attah of Igala, and won.\n\n🏆 This stage is won: Benin is yours.${historyNote('Benin defeated the Igala in the Idah war around 1515, under Oba Esigie. His mother Idia raised an army of her own for it, and was the first to be made Iyoba, Queen Mother.')}`,
  },
  won: 'edoWon',
});

export const EVENTS = [
  ...openingEvents(EDO, {
    intro: {
      title: 'Kóyo: the forest of the Edo',
      text: (st) =>
        `${st.founder} and ${st.spouse} have walked for days through the great forest, with a cutlass, a hoe and a basket of seed yams. Between the Ogba and the Ikpoba rivers they find a house of red mud standing alone in a clearing: empty, its owners long gone, its roof fallen in.\n\n“The walls still stand,” says ${st.founder}. “We will mend it, settle here, and build a community.”\n\nThe forest all around is a wall, and its trees are all the wood you need. The old people call this land Igodomigodo. One day a city of walls and moats, bronze and ivory could stand here, and what it becomes is up to you.`,
    },
    here: 'here in the forest',
    ahead: (st) => `From here, grow ${st.name} as you choose: more people, the Compound age, the towns and chiefdoms around you, and, one day, strangers from the sea.`,
  }),
  {
    id: 'harmattan',
    when: (st) => Math.floor(st.time.day / 4) % 3 === 1,
    title: 'The Harmattan',
    art: '🌫️',
    text: () => 'Even here in the forest the dry wind from the Sahara turns the sun pale and the leaves dusty. Yams grow slowly until the rains return. Keep your barns full.',
    choices: [{ label: 'We will manage' }],
  },
  {
    id: 'ewuare',
    when: (st) => st.era >= 1 && pop(st) >= 14,
    title: 'Walls and moats',
    art: '🧱',
    text: (st) => `The elders of ${st.name} want a moat dug all round the town, deeper than a man, with the earth thrown up into a wall behind it. “No army crosses an iya,” they say. “Our grandfathers’ villages each had one.”${historyNote('Oba Ewuare the Great, around 1440 to 1473, rebuilt Benin City inside walls and moats. The earthworks of the Edo lands, the iya, were among the largest ever dug by hand.')}`,
    choices: [
      {
        label: 'Dig the moat (🐚 40)',
        hint: 'The earth dug out makes bricks, and your people take heart. Build Mud Walls (Iya) along it.',
        can: (st) => st.res.cowries >= 40,
        apply: (st, api) => {
          st.res.cowries -= 40;
          api.addRes('bricks', 50);
          api.mood('The town’s moat', 6, 8);
        },
      },
      { label: 'Not yet' },
    ],
  },
  {
    id: 'portuguese_benin',
    when: (st) => st.era >= 1 && st.time.day >= 35,
    title: 'Strangers at Ughoton',
    art: '⛵',
    text: () => `Boatmen come up the creek from Ughoton with news: a ship with white sails has anchored at the river mouth, and men with pale skin and iron helmets have come ashore. They want pepper and ivory, and they have brass, cloth and coral beads to trade.${historyNote('the Portuguese reached Benin around 1485, the first Europeans the Edo had met. The Oba sent an ambassador back with them to Lisbon.')}`,
    choices: [
      {
        label: 'Trade pepper and ivory for brass and cloth',
        hint: 'Brass, cloth and money, and your people learn of the lands across the sea.',
        apply: (st, api) => {
          st.flags.metEuropeans = true;
          st.foreign.portuguese.trade = true;
          api.addRes('cloth', 20);
          api.addRes('iron', 10);
          api.addRes('cowries', 60);
          api.notify('⛵ The traders at Ughoton exchange pepper and ivory for brass manillas, cloth and coral.', 'good');
        },
      },
      {
        label: 'Send an envoy back across the sea with them',
        hint: 'Your people learn of the lands across the sea, and are proud.',
        apply: (st, api) => {
          st.flags.metEuropeans = true;
          api.mood('Our envoy crosses the sea', 5, 8);
        },
      },
      { label: 'Send them away', hint: 'The forest keeps its own counsel.' },
    ],
  },
  {
    id: 'bronze_guild',
    when: (st) => st.era >= 2 && has(st, 'market'),
    title: 'The casters of Igun Street',
    art: '🛡️',
    text: (st) => `The bronze casters ask ${st.founder} for a street of their own, where they can keep their furnaces, their wax and their secrets, and work only for ${st.name}: heads of the ancestors, plaques of warriors and chiefs, bells and leopards.${historyNote('the guild of bronze casters, Igun Eronmwon, has worked on its own street in Benin City for centuries. Its plaques and heads are what the world calls the Benin Bronzes.')}`,
    choices: [
      {
        label: 'Give the guild its street (🐚 80)',
        hint: 'Their work is wanted everywhere: money, and pride.',
        can: (st) => st.res.cowries >= 80,
        apply: (st, api) => {
          st.res.cowries -= 80;
          api.addRes('cowries', 280);
          api.mood('Igun Street', 6, 10);
        },
      },
      { label: 'Not yet' },
    ],
  },
  {
    id: 'igue',
    repeat: 36,
    when: (st) => has(st, 'shrine') && st.era >= 1 && st.time.day >= 24,
    title: 'Igue',
    art: '🎉',
    text: (st) => `The year is ending, and the people of ${st.name} want to keep Igue: to bless their heads and their households, chase out the bad of the old year, and dance in the new.`,
    choices: [
      {
        label: 'Keep Igue (🐚 60)',
        hint: '+15 happiness for eight days.',
        can: (st) => st.res.cowries >= 60,
        apply: (st, api) => {
          st.res.cowries -= 60;
          api.mood('Igue', 15, 8);
          api.notify('🎉 Igue: every household is blessed, and the town dances into the new year.', 'good');
        },
      },
      { label: 'Not this year' },
    ],
  },
  {
    id: 'udo',
    when: (st) => st.time.day >= 45 && pop(st) >= 14 && atPeace(st, 'udo'),
    title: 'Proud Udo',
    art: '⚔️',
    text: (st) => `Udo’s chief sends word that the forest trade is Udo’s, and that ${st.name}’s traders will pay to pass through his lands.${historyNote('Udo, the old rival of Benin City, rose against Oba Esigie in the early 1500s and was brought back under the city.')}`,
    choices: [
      {
        label: 'Send gifts and talk (🐚 40)',
        hint: 'Udo warms to you.',
        can: (st) => st.res.cowries >= 40,
        apply: (st, api) => {
          st.res.cowries -= 40;
          warmer(st, 'udo', 25);
        },
      },
      {
        label: 'Our traders pay no one',
        hint: 'War with Udo.',
        apply: (st, api) => api.war('udo'),
      },
    ],
  },
  {
    id: 'idah',
    when: (st) => st.era >= 1 && pop(st) >= 12 && st.time.day >= 18,
    title: 'Messengers from Idah',
    art: '🥁',
    text: (st) => `Riders come out of the east with drums: messengers of the Attah of Igala, from Idah on the Niger.\n\n“The Attah has heard of ${st.name},” their leader says. “The lands this side of the Niger send him gifts. Send yours, or his army will come for them.”`,
    choices: IGALA.choices({ defy: 'The Edo bow to no one!', defyHint: 'War with the Igala. Their riders will come first, then their host.' }),
  },
  ...IGALA.events,
  {
    id: 'idia',
    when: (st) => !!st.factionMap.igala_host && !st.factionMap.igala_host.beaten && !st.factionMap.igala_host.marching,
    title: 'Idia',
    art: '👑',
    text: (st) => `A woman comes to ${st.founder}’s house with her own guards: Idia, the mother of a great family of the town, known in every village for her wisdom and her medicine.\n\n“I will not sit at home while the Igala come,” she says. “Let me raise warriors of my own, and walk with them.”${historyNote('Idia, mother of Oba Esigie, raised an army and went with it to the Idah war around 1515. The ivory mask of her face is one of the best-known works of African art.')}`,
    choices: [
      { label: 'Let Idia lead her warriors', hint: 'Six warriors stand with you when the Igala march.', apply: (st) => (st.flags.idia = true) },
      { label: 'Thank her, and keep her safe' },
    ],
  },
  {
    id: 'edo_united',
    when: (st) => unifiedCount(st) >= majorCount(st),
    title: 'The forest stands together',
    art: '🏆',
    text: (st) => `Udo, the Esan chiefdoms, Owo and Agbor now stand with ${st.name}: by friendship, by tribute, or by the sword.\n\nThe Edo lands are one. More of Nigeria opens in a future update.`,
    choices: [{ label: 'Keep building', apply: (st) => (st.flags.edoUnited = true) }],
  },
];
