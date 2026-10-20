// The history of Kano, arriving as the town grows: the guided opening's
// stories in Hausa words, the dry wind, the Hausa kingdoms around you (proud
// Katsina, Queen Amina of Zazzau), the caravans from across the desert that
// bring horses early, the Durbar, Rumfa's market, and the host of Kwararafa
// from the south, the first great army to break (see sim/events.js).

import { BUILDINGS } from '../../data/buildings.js';
import { has, pop, unifiedCount, majorCount, many, guests, his } from '../common.js';
import { HAUSA } from '../../cultures/hausa.js';

const historyNote = (text) => `\n\nIn the history you know, ${text}`;

const claimed = (st, kind) => st.pois.some((p) => p.kind === kind && p.claimed);
const friends = (st, id) => {
  const f = st.factionMap[id];
  return !!f && (f.status === 'allied' || (f.status !== 'hostile' && f.relation >= 40));
};
const atPeace = (st, id) => {
  const f = st.factionMap[id];
  return !!f && f.status !== 'conquered' && f.status !== 'hostile';
};
const warmer = (st, id, n) => {
  const f = st.factionMap[id];
  if (f) f.relation = Math.max(-100, Math.min(100, f.relation + n));
};

// The host the Aku Uka of the Jukun sends north: spearmen, archers and
// horsemen of Kwararafa. It gathers in the south and marches when it is
// ready; breaking it wins Kano. Its size answers the town it has heard of.
const KWARARAFA_HOST = {
  id: 'kwararafa_host', name: 'The Kwararafa host', people: 'Jukun', strength: 5, temperament: 'bandit', major: false,
  leader: 'A war chief of the Aku Uka of the Jukun', color: '#5b2a14', huts: 8, side: 'south',
  loot: { cowries: 400, weapons: 30, iron: 30, horses: 4 }, joiners: 0, raids: false, radius: 9,
  desc: 'The army of the Jukun of Kwararafa, camped in the south round their war chief’s tent: spearmen with hide shields, archers, and horsemen.',
};

// Days from the host gathering to its march: gifts to the Aku buy more time.
const MARCH_DAYS = { refused: 16, gifts: 26 };

function hostGarrison(st, api) {
  // About as strong as your own army and towers: never fewer than 30,
  // never more than the fifty Benin sends against Èkó.
  const n = Math.max(30, Math.min(50, Math.round((api.power() * 1.2) / 85)));
  const riders = Math.round(n * 0.18);
  const bows = Math.round(n * 0.25);
  return { jukun: n - riders - bows, bowman: bows, jukunrider: riders };
}

function hostComing(st, api, gifts) {
  if (st.factionMap.kwararafa_host || st.flags.hostPlanned) return;
  st.flags.hostPlanned = true;
  st.flags.hostGifts = !!gifts;
  // Defiance brings a few riders first; gifts a few quiet days.
  if (!gifts) api.schedule('kwararafa_raid', 2);
  api.schedule('kwararafa_host', gifts ? 4 : 6);
}

function finishOpening(st, api) {
  if (st.flags.openingDone) return;
  st.flags.openingDone = true;
  st.flags.feedFirst = false;
  st.migrateT = 10;
  api.notify('🔥 Word spreads of a safe settlement under Dala hill. Newcomers will come and sit by the fire: give them work and beds.', 'good');
}

export const EVENTS = [
  // --- The guided opening's stories ------------------------------------------
  {
    id: 'intro',
    story: true,
    title: `${HAUSA.greeting}: the land under Dala hill`,
    art: '🌅',
    text: (st) =>
      `${st.founder} and ${st.spouse} have walked for days across the dry plain with an axe, a hoe and a sack of millet seed. Below a lone hill, where the smiths of old dug iron from the rock, they find a mud house standing alone in a clearing of thorn trees: empty, its owners long gone, its roof fallen in.\n\n“The walls still stand,” says ${st.founder}. “We will mend it, settle here, and build a community.”\n\nThe thorn woodland all around is a wall, and its trees are all the wood you need. One day this could be the greatest market city of the savanna, and what it becomes is up to you.`,
    choices: [{ label: 'Settle here', hint: 'Take it one step at a time: the guide at the top left shows what to do next.' }],
  },
  {
    id: 'welcome',
    story: true,
    title: 'Strangers at the door',
    art: '👋',
    text: (st) => {
      const who = guests(st);
      const intro = who.map((c) => `${c.name}, a ${c.female ? 'woman' : 'man'} of ${c.people === 'Kano' ? 'the Kano country' : `the ${c.people}`} from ${c.from}`).join(', and ');
      return `${who.length === 1 ? 'A traveller has' : 'Two travellers have'} come up the path: ${intro}. They are looking for a place to live.\n\n${st.founder} puts down his axe and goes out to meet them. “${HAUSA.greeting}, strangers. My wife and I are building a community here under Dala hill. Will you join us?”\n\n“Yes,” ${who.length === 1 ? 'comes the answer' : 'they answer together'}. “We will.”`;
    },
    choices: [
      {
        label: 'Welcome them home',
        hint: 'The house sleeps five: the two of you and three more. They sit by the fire until there is work for them.',
        apply: (st, api) => {
          api.welcome(guests(st).map((c) => c.id));
          st.flags.welcomed = true;
        },
      },
    ],
  },
  {
    id: 'wolves_slain',
    story: true,
    title: 'A fence around us',
    art: '🐾',
    text: (st) => {
      const s = st.story || {};
      const dead = (s.victims || []).map((v) => v.name);
      const heroes = (s.heroes || []).map((h) => `${h.name} killed ${h.kills === 1 ? 'one' : h.kills === 2 ? 'two' : h.kills} with ${his(h.female)} ${h.tool || 'bare hands'}`);
      return `${dead.length ? `${dead.join(' and ')} ${dead.length > 1 ? 'are' : 'is'} dead, dragged down by the hyenas in the field.` : 'The hyenas are dead.'} ${heroes.length ? `${heroes.join('; ')}.` : ''}\n\nThat night ${st.founder} and ${st.spouse} come out of the house and sit by the fire. “We have lost our own,” he says. “The thorn trees are a wall no hyena gets through. We will close the gaps between them with a fence, and leave a gate for ourselves.”`;
    },
    choices: [{ label: 'Build a fence', hint: 'Trees are a natural wall. Fence the open ground between them, and leave a gate.', apply: (st) => (st.flags.needFence = true) }],
  },
  {
    id: 'settled',
    story: true,
    title: 'Safe behind the fence',
    art: '🛡️',
    text: (st) =>
      `The last stake is lashed in place and the gate swings shut. For the first time since they came, ${st.founder} and ${st.spouse} sleep through the night.\n\nWord travels along the paths: there is a safe place under Dala hill. Newcomers will come and sit by the fire, up to five at a time. Each new Plank House brings two more. Put them to work.\n\nBut keep them fed and give them beds: hungry or sleeping in the open, people grumble, and then they leave.`,
    choices: [{ label: 'Let them come', apply: (st, api) => finishOpening(st, api) }],
  },
  {
    id: 'bandits_gone',
    story: true,
    title: 'Bandits!',
    art: '🏴',
    text: (st) => {
      const s = st.story || {};
      const dead = s.raidDead || [];
      const stolen = Object.entries(s.stolen || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k === 'wood' ? 'planks' : k === 'yam' ? 'millet' : k}`);
      return `The bandits broke through the fence${dead.length ? `, killed ${dead.join(' and ')}` : ''}${stolen.length ? ` and carried off ${stolen.slice(0, 5).join(', ')}` : ''}. Then they were gone, back to their camp out in the bush.\n\n${st.founder} walks the broken fence with ${st.spouse}. “They are four, and they will come again,” he says. “We need a guard house and men to match them. And stronger houses. But first, we must fill the stores again.”`;
    },
    choices: [{ label: 'We will be ready', apply: (st) => (st.flags.raided = true) }],
  },
  {
    id: 'chapter_one',
    story: true,
    title: 'A town of red mud',
    art: '🧱',
    text: (st) =>
      `Where a single empty house once stood among the thorn trees, there is now a settlement of red-mud houses behind a fence, with a guard house, sheds, a millet farm and a fire where newcomers sit.\n\n“When we came,” says ${st.spouse}, “there was nothing here but grass and thorn trees.”\n\nThe guided opening is over. From here, grow ${st.name} as you choose: more people, the Compound age, the Hausa kingdoms around you, and the caravans from across the desert.`,
    choices: [{ label: 'Onward', hint: 'Goals now appear at the top left.' }],
  },

  // --- The land and its seasons ---------------------------------------------
  {
    id: 'harmattan',
    when: (st) => Math.floor(st.time.day / 4) % 3 === 1,
    title: 'The Harmattan',
    art: '🌫️',
    text: () => 'The dry wind blows down from the Sahara and the sun turns pale behind the dust. Millet grows slowly until the rains return. Keep your granaries full and your hunters busy.',
    choices: [{ label: 'We will manage' }],
  },
  {
    id: 'dala',
    when: (st) => claimed(st, 'dala'),
    title: 'Dala hill',
    art: '⛰️',
    text: (st) =>
      `From the top of Dala hill the plain lies open: ${st.name} below, the Jakara stream shining, Goron Dutse to the east, and the smoke of farms as far as the eye can see. The old people say the first smiths of Kano lived up here, and that the city will always grow around this hill.${historyNote('the Kano Chronicle names Bagauda as the first king of Kano, around the year 1000, and Kano’s walls were later built to take in both Dala and Goron Dutse.')}`,
    choices: [{ label: 'Onward' }],
  },
  {
    id: 'sarki',
    when: (st) => st.era >= 1 && pop(st) >= 14,
    title: 'The first Sarki',
    art: '👑',
    text: (st) =>
      `The heads of the families gather under the great tree in the market place. ${st.name} has grown into a town of compounds, and a town needs a ruler.\n\nThey turn to ${st.founder}. “You mended the first house, and you fenced the first field. Be our Sarki.”${historyNote('Kano’s rulers have been called Sarki since its first kings, and the title is still held today.')}`,
    choices: [{ label: `Hail the ${HAUSA.ruler}`, hint: 'Your people are proud of their town.', apply: (st, api) => api.mood('A Sarki of our own', 6, 8) }],
  },

  // --- The Hausa kingdoms around you -------------------------------------------
  {
    id: 'katsina_wells',
    when: (st) => st.time.day >= 30 && pop(st) >= 12 && atPeace(st, 'katsina'),
    title: 'Katsina at the wells',
    art: '🐎',
    text: (st) =>
      `Horsemen from Katsina have watered their horses at your wells and let them graze in your millet. Their leader laughs when ${st.founder}’s men complain: “The wells are for everyone. Katsina was a city when ${st.name} was a hut.”`,
    choices: [
      {
        label: 'Share the wells, and offer them a meal',
        hint: 'Katsina warms to you. The millet is gone.',
        apply: (st, api) => {
          st.res.yam = Math.max(0, st.res.yam - 15);
          warmer(st, 'katsina', 20);
          api.notify('🤝 The Katsina riders eat with you, and ride home speaking well of you.', 'good');
        },
      },
      {
        label: 'Drive them off the fields',
        hint: 'Your people cheer. Katsina will not forget.',
        apply: (st, api) => {
          warmer(st, 'katsina', -30);
          api.mood('We stood up to Katsina', 4, 5);
        },
      },
    ],
  },
  {
    id: 'amina',
    when: (st) => st.era >= 1 && pop(st) >= 14 && st.time.day >= 40 && atPeace(st, 'zazzau'),
    title: 'A messenger from Queen Amina',
    art: '👑',
    text: (st) =>
      `A rider comes up from the south in the colours of Zazzau. Amina, the warrior queen of Zazzau, has heard of ${st.name}.\n\n“My queen builds walls round every camp her army makes,” he says, “and her army has never been beaten. She offers ${st.name} her friendship. Or she will offer it to Katsina instead.”${historyNote('Amina of Zazzau led its armies in the 16th century. The long earthen walls of the Hausa towns are still called ganuwar Amina, Amina’s walls.')}`,
    choices: [
      {
        label: 'Send gifts and accept her friendship (🐚 50)',
        hint: 'Zazzau warms to you. Her builders show yours how to raise earthen walls.',
        can: (st) => st.res.cowries >= 50,
        apply: (st, api) => {
          st.res.cowries -= 50;
          warmer(st, 'zazzau', 35);
          st.flags.aminaFriend = true;
          api.notify(`🧱 Amina’s builders show yours how she raises her walls: build a ${BUILDINGS.stonewall.name} once you reach the Compound age.`, 'good');
        },
      },
      {
        label: 'Kano answers to no queen',
        hint: 'Zazzau cools toward you. Your people are proud.',
        apply: (st, api) => {
          warmer(st, 'zazzau', -25);
          api.mood('We answer to no one', 3, 4);
        },
      },
    ],
  },

  // --- The desert caravans: Kano's ships, so horses come early ---------------
  {
    id: 'caravan',
    repeat: 24,
    when: (st) => st.era >= 1 && st.time.day >= 16 && (has(st, 'market') || pop(st) >= 16),
    title: 'A caravan from across the desert',
    art: '🐪',
    text: () => 'A long line of camels comes in from the north: traders who have crossed the Sahara from the cities of the Maghreb, with horses, salt in slabs, cloth and books. They want millet, leather and cowries.',
    choices: [
      {
        label: 'Buy 2 horses (🐚 110)',
        hint: 'Horsemen need them. Here they come early, long before any ship.',
        can: (st) => st.res.cowries >= 110,
        apply: (st, api) => {
          st.res.cowries -= 110;
          api.addRes('horses', 2);
        },
      },
      {
        label: 'Buy 10 salt (🐚 50)',
        can: (st) => st.res.cowries >= 50,
        apply: (st, api) => {
          st.res.cowries -= 50;
          api.addRes('salt', 10);
        },
      },
      {
        label: 'Sell 30 millet (+🐚 90)',
        can: (st) => st.res.yam >= 30,
        apply: (st) => {
          st.res.yam -= 30;
          st.res.cowries += 90;
        },
      },
      { label: 'Not today' },
    ],
  },
  {
    id: 'durbar',
    repeat: 36,
    when: (st) => has(st, 'warcamp') && st.era >= 1 && st.time.day >= 30 && st.res.horses >= 2,
    title: 'The Durbar',
    art: '🐎',
    text: (st) =>
      `The festival is coming, and the horsemen of ${st.name} want to ride the Durbar: to charge in their brightest robes and quilted armour up to ${st.founder}’s house, and stop dead before him with their lances raised. Every town around will hear of it.`,
    choices: [
      {
        label: 'Hold the Durbar (🐚 60)',
        hint: '+15 happiness for eight days, and the neighbours are impressed.',
        can: (st) => st.res.cowries >= 60,
        apply: (st, api) => {
          st.res.cowries -= 60;
          api.mood('The Durbar', 15, 8);
          for (const id of ['katsina', 'zazzau', 'rano', 'daura']) warmer(st, id, 5);
          api.notify('🐎 The horsemen thunder past in a cloud of dust and colour. The whole town cheers.', 'good');
        },
      },
      { label: 'Not this year' },
    ],
  },
  {
    id: 'rumfa',
    when: (st) => st.era >= 2 && has(st, 'market') && has(st, 'palace'),
    title: 'The Kurmi market',
    art: '🏺',
    text: (st) =>
      `${st.name}’s market has outgrown its square. The traders ask ${st.founder} for a great market of its own, where the caravans can unload and every craft has its row: dyers, smiths, weavers, leatherworkers.${historyNote('Muhammad Rumfa, Sarki of Kano from 1463 to 1499, extended the city walls and opened the Kurmi market. It still trades today.')}`,
    choices: [
      {
        label: 'Open the great market (🐚 80)',
        hint: 'Traders pour in: +200 money over the first season, and your people are proud.',
        can: (st) => st.res.cowries >= 80,
        apply: (st, api) => {
          st.res.cowries -= 80;
          api.addRes('cowries', 280);
          api.mood('The great market', 6, 10);
        },
      },
      { label: 'Not yet' },
    ],
  },

  // --- The host of Kwararafa ----------------------------------------------------
  {
    id: 'kwararafa',
    when: (st) => st.era >= 1 && pop(st) >= 12 && st.time.day >= 18,
    title: 'Riders from Kwararafa',
    art: '🥁',
    text: (st) =>
      `Riders come up from the south with drums: messengers of the Aku Uka, king of the Jukun of Kwararafa, far away on the Benue.\n\n“The Aku Uka has heard of ${st.name},” their leader says. “Every town between here and the river sends him gifts. Send yours, or his army will come and take them.”${historyNote('the Jukun of Kwararafa raided deep into the Hausa lands in the 17th century, and more than once their armies reached Kano.')}`,
    choices: [
      {
        label: 'Send rich gifts, but bow to no one (🐚 60)',
        hint: 'Buys time, not peace.',
        can: (st) => st.res.cowries >= 60,
        apply: (st, api) => {
          st.res.cowries -= 60;
          api.notify('🎁 The riders take your gifts and turn south again.', 'info');
          hostComing(st, api, true);
        },
      },
      {
        label: 'Ask Zazzau to stand with us',
        hint: 'If Zazzau is your friend, her warriors will come when the host marches.',
        can: (st) => friends(st, 'zazzau'),
        apply: (st, api) => {
          st.flags.zazzauAid = true;
          hostComing(st, api, false);
        },
      },
      {
        label: 'We pay no tribute!',
        hint: 'War with Kwararafa. Their riders will come first, then their host.',
        apply: (st, api) => {
          api.mood('Defiance', 4, 4);
          hostComing(st, api, false);
        },
      },
    ],
  },
  {
    id: 'kwararafa_raid',
    silent: true,
    apply: (st, api) => {
      const ids = api.border('kwararafa', ['jukunrider', 'jukunrider', 'jukun'], { side: 'south', steal: true, patience: 90, label: 'Kwararafa riders' });
      const u = ids.length && st.byId.get(ids[0]);
      if (u) api.notify('🐎 Kwararafa riders are coming up from the south!', 'war', u);
    },
  },
  {
    id: 'kwararafa_host',
    silent: true,
    apply: (st, api) => {
      if (st.factionMap.kwararafa_host) return;
      const f = api.host({ ...KWARARAFA_HOST, garrison: hostGarrison(st, api) });
      if (!f) return;
      f.onBeaten = 'kwararafa_beaten';
      api.schedule('kwararafa_march', st.flags.hostGifts ? MARCH_DAYS.gifts : MARCH_DAYS.refused);
      api.queue('kwararafa_host_seen', { at: { x: f.x + 0.5, y: f.y + 4 } });
    },
  },
  {
    id: 'kwararafa_host_seen',
    title: 'The host of Kwararafa',
    art: '🥁',
    text: (st) => {
      const n = st.units.filter((u) => u.owner === 'kwararafa_host' && !u.dead).length;
      return `From the top of the hill, your lookout sees their fires in the south: the army of Kwararafa, ${n} strong, camped round their war chief’s tent. Spearmen with hide shields, archers, and horsemen.\n\n${st.flags.hostGifts ? 'Your gifts bought time, but not peace: they are gathering all the same.' : `They have come to punish ${st.name} for its defiance.`} They will march when they are ready.\n\nBuild houses, grow, train soldiers: then carry the war to their camp, or wait for them behind your walls.`;
    },
    choices: [{ label: 'We will be ready', hint: '⌂ beside the map brings you back to the town.' }],
  },
  {
    id: 'kwararafa_march',
    silent: true,
    apply: (st, api) => {
      const f = st.factionMap.kwararafa_host;
      if (!f || f.beaten) return;
      if (!api.march('kwararafa_host')) return;
      if (st.flags.zazzauAid && atPeace(st, 'zazzau')) api.lend('zazzau', [...many('warrior', 4), ...many('bowman', 2)], 10);
      const u = st.units.find((x) => x.owner === 'kwararafa_host' && !x.dead);
      api.vista(u.x, u.y, 8, 40);
      api.queue('kwararafa_march_seen', { at: { x: u.x, y: u.y } });
    },
  },
  {
    id: 'kwararafa_march_seen',
    title: 'The drums have stopped',
    art: '⚔️',
    text: (st) => {
      const n = st.units.filter((u) => u.owner === 'kwararafa_host' && !u.dead).length;
      const help = st.flags.zazzauAid && atPeace(st, 'zazzau') ? '\n\nWarriors of Zazzau have come up from the south to stand with you.' : '';
      return `The war drums of Kwararafa have fallen silent. The host is on the march: ${n} warriors, coming for ${st.name}.${help}\n\nMan the fence, gather your soldiers, and hold.`;
    },
    choices: [{ label: 'To arms!' }],
  },
  {
    id: 'kwararafa_beaten',
    title: 'Kwararafa is broken',
    art: '🏆',
    text: (st) =>
      `The last warriors of Kwararafa are gone, and the drums of the Jukun are silent on the plain. Word runs along every caravan road: ${st.name} stood against Kwararafa, and won.\n\n🏆 This stage is won: Kano is yours.`,
    choices: [{ label: 'Keep building', hint: 'More of Nigeria opens in a future update: the Hausa kingdoms, and the map of the old kingdoms.', apply: (st) => (st.flags.kanoWon = true) }],
  },
  {
    id: 'kano_united',
    when: (st) => unifiedCount(st) >= majorCount(st),
    title: 'The Hausa kingdoms stand together',
    art: '🏆',
    text: (st) => `Katsina, Zazzau, Rano and Daura now stand with ${st.name}: by friendship, by tribute, or by the sword.\n\nKano is one. More of Nigeria opens in a future update.`,
    choices: [{ label: 'Keep building', apply: (st) => (st.flags.kanoUnited = true) }],
  },
];
