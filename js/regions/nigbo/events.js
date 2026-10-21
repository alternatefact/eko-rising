// The history of the northern Igbo country, arriving as the town grows: the
// guided opening's stories in Igbo words, the four market days, the priests
// of Nri, the New Yam festival, the bronzes in the earth, and the Aro war
// bands from the south, the land's first great host. The Nri priests can
// walk out between the armies and send part of it home. Breaking it wins
// the northern Igbo country.

import { has, pop, unifiedCount, majorCount, many } from '../common.js';
import { openingEvents, greatHost, historyNote, claimed, warmer } from '../kit.js';
import { removeUnit } from '../../sim/entities.js';
import { IGBO } from '../../cultures/igbo.js';

const DAYS = ['Eke', 'Orie', 'Afọ', 'Nkwọ'];

// The fighters the Aro hired from the Abam, Ohafia and Edda towns: matchet
// men, and gunmen with trade guns.
const ARO = greatHost({
  id: 'aro_host',
  def: {
    name: 'The Aro war bands', people: 'Aro', strength: 5, temperament: 'bandit', major: false,
    leader: 'An Aro war captain', color: '#5a1e1e', huts: 8, side: 'south',
    loot: { cowries: 400, weapons: 30, muskets: 6 }, joiners: 0, raids: false, radius: 9,
    desc: 'The war bands the Aro hired from the Abam, Ohafia and Edda towns, camped in the south round their captain’s tent: matchet men and gunmen.',
  },
  army: (n) => {
    const guns = Math.round(n * 0.22);
    return { aroraider: n - guns, arogun: guns };
  },
  min: 24,
  days: { defiant: 20, gifts: 30 },
  raid: { power: 'aro', types: ['aroraider', 'aroraider', 'arogun'], label: 'Aro war band', text: '⚔️ An Aro war band is coming up the paths from the south!' },
  ally: { id: 'nsukka', ask: 'Ask the Nsukka villages to stand with us', types: [...many('warrior', 4), ...many('bowman', 2)], text: 'Warriors of the Nsukka villages have come to stand with you.' },
  // The Nri priests walk out between the armies with their staffs, and a
  // third of the hired men will not fight against the peace of Nri.
  onMarch: (st) => {
    if (!st.flags.nriPeace) return;
    const host = st.units.filter((u) => u.owner === 'aro_host' && !u.dead);
    host.slice(0, Math.floor(host.length / 3)).forEach((u) => removeUnit(st, u));
    st.flags.nriWalked = true;
  },
  seen: {
    title: 'The Aro war bands',
    text: (st, n) => `Your hunters bring word from the south: the war bands the Aro have hired, ${n} strong, camped round their captain’s tent. Matchet men from the Abam and Ohafia towns, and gunmen with trade guns.`,
  },
  march: {
    title: 'The war bands march',
    text: (st, n) => `${st.flags.nriWalked ? 'The Nri priests walked out to meet the war bands with their staffs raised, and a third of the hired men turned for home. ' : ''}${n} fighters of the Aro war bands are on the march, coming for ${st.name}.`,
  },
  beaten: {
    title: 'The war bands are broken',
    text: (st) => `The last of the Aro’s hired fighters have gone back down the paths to the south, and they will not come again this year. Word runs from market to market: ${st.name} stood against the Aro, and won.\n\n🏆 This stage is won: the northern Igbo country is yours.${historyNote('the Aro, through their oracle at Arochukwu, built a trading network across Igboland from the late 1600s, and hired the warriors of the Abam, Ohafia and Edda towns to enforce it. Captives were the heart of that trade.')}`,
  },
  won: 'igboWon',
});

export const EVENTS = [
  ...openingEvents(IGBO, {
    intro: {
      title: 'Nnọọ: the land below the hills',
      text: (st) =>
        `${st.founder} and ${st.spouse} have walked for days with a machete, a hoe and a basket of seed yams, from the crowded villages under the hills to new land in the forest. In a clearing they find a house of red earth standing alone: empty, its owners long gone, its roof fallen in.\n\n“The walls still stand,” says ${st.founder}. “We will mend it, settle here, and build a community.”\n\nThe forest all around is a wall, and its trees are all the wood you need. Here no king rules: each town is governed by its elders and its people. One day this clearing could be a great market town, and what it becomes is up to you.`,
    },
    here: 'here below the hills',
    ahead: (st) => `From here, grow ${st.name} as you choose: more people, the Compound age, the village groups around you and the Igala kingdom beyond them. And keep an eye on the paths from the south.`,
  }),
  {
    id: 'harmattan',
    when: (st) => Math.floor(st.time.day / 4) % 3 === 1,
    title: 'The Harmattan',
    art: '🌫️',
    text: () => 'The dry wind blows down from the Sahara and the hills disappear in the dust. Yams grow slowly until the rains return. Keep your barns full.',
    choices: [{ label: 'We will manage' }],
  },
  {
    id: 'market_day',
    when: (st) => has(st, 'market'),
    title: 'The town’s market day',
    art: '🛍️',
    text: (st) => `The market is built, and the elders must choose its day. The week here has four days, Eke, Orie, Afọ and Nkwọ, and every town holds its market on one of them, so traders can walk from one market to the next.\n\nWhich day will be ${st.name}’s?`,
    choices: DAYS.map((d) => ({
      label: d,
      hint: 'Traders come from every town around: money, and pride.',
      apply: (st, api) => {
        st.flags.marketDay = d;
        api.addRes('cowries', 60);
        api.mood(`Market day: ${d}`, 4, 6);
        api.notify(`🛍️ ${st.name} holds its market on ${d} day. Children born on it may be named for it.`, 'good');
      },
    })),
  },
  {
    id: 'nri_visit',
    when: (st) => st.time.day >= 25 && pop(st) >= 10,
    title: 'The priests of Nri',
    art: '🪶',
    text: (st) => `Two men come up the path carrying long staffs, their faces marked with the ichi lines of Nri. They are priests of the Eze Nri, who walk from town to town to cleanse the land of abominations and settle feuds, with no army behind them but the respect of every town.${historyNote('the priest-kings of Nri held authority across much of Igboland for centuries, settling disputes and making peace without armies.')}`,
    choices: [
      {
        label: 'Welcome them, and give them gifts (🐚 40)',
        hint: 'Your people are reassured, and every town around hears of it.',
        can: (st) => st.res.cowries >= 40,
        apply: (st, api) => {
          st.res.cowries -= 40;
          st.flags.nriFriend = true;
          api.mood('The blessing of Nri', 6, 10);
          for (const f of st.factions) if (!f.host && f.temperament !== 'bandit') warmer(st, f.id, 6);
        },
      },
      { label: 'Thank them, and send them on their way' },
    ],
  },
  {
    id: 'iriji',
    repeat: 36,
    when: (st) => has(st, 'farm') && st.era >= 1 && st.time.day >= 24 && st.res.yam >= 40,
    title: 'Iri Ji, the New Yam festival',
    art: '🍠',
    text: (st) => `The new yams are ready. Before anyone eats them, ${st.name} must thank the earth for the harvest: the eldest man roasts the first yam and breaks it, and then the whole town feasts, dances and wrestles.`,
    choices: [
      {
        label: 'Hold the festival (40 yams)',
        hint: '+15 happiness for eight days.',
        can: (st) => st.res.yam >= 40,
        apply: (st, api) => {
          st.res.yam -= 40;
          api.mood('Iri Ji', 15, 8);
          api.notify('🍠 The first new yam is broken, and the whole town feasts and dances.', 'good');
        },
      },
      { label: 'Not this year' },
    ],
  },
  {
    id: 'bronzes',
    when: (st) => claimed(st, 'bronzes'),
    title: 'Bronzes in the earth',
    art: '🏺',
    text: () => `The bronzes your people found are like nothing anyone has made: a bowl shaped like a shell with a leopard on it, a vessel wrapped in bronze rope, a staff head, and beads by the thousand. The old people say they belonged to a great priest-king, long before anyone can remember.${historyNote('bronzes like these were found at Igbo-Ukwu in 1938. They were cast in the 800s or 900s, and are among the oldest and finest bronzes made in West Africa.')}`,
    choices: [{ label: 'Keep them safe' }],
  },
  {
    id: 'aro',
    when: (st) => st.era >= 1 && pop(st) >= 12 && st.time.day >= 18,
    title: 'Messengers of the Aro',
    art: '🥁',
    text: (st) => `Traders from the south come to ${st.name} with a warning that is also a threat. They speak for the Aro, whose oracle at Arochukwu every town consults, and whose hired fighters walk with them.\n\n“The oracle has noticed ${st.name},” they say. “Send gifts to the Aro, and your traders may use our roads. Refuse, and the war bands will come.”`,
    choices: [
      {
        label: 'Ask the Nri priests to walk between us (🐚 80)',
        hint: 'When the war bands march, the priests will meet them, and a third of the hired men will not fight against the peace of Nri.',
        can: (st) => st.res.cowries >= 80 && !!st.flags.nriFriend,
        apply: (st, api) => {
          st.res.cowries -= 80;
          st.flags.nriPeace = true;
          ARO.coming(st, api, false);
        },
      },
      ...ARO.choices({ defy: 'We send nothing!', defyHint: 'War with the Aro. A war band will come first, then their host.' }),
    ],
  },
  ...ARO.events,
  {
    id: 'igbo_united',
    when: (st) => unifiedCount(st) >= majorCount(st),
    title: 'The towns stand together',
    art: '🏆',
    text: (st) => `The Nsukka villages, the Udi towns, Ezza and the Igala now stand with ${st.name}: by friendship, by tribute, or by the sword.\n\nThe northern Igbo country is one. More of Nigeria opens in a future update.`,
    choices: [{ label: 'Keep building', apply: (st) => (st.flags.igboUnited = true) }],
  },
];
