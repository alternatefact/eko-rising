// The history of Ogun, arriving as the town grows: kidnappers on the roads,
// the Alaafin's tax-men and Lísàbí's rising against them, the Ìjẹ̀bú and the
// roads they hold, the refugees of Ọ̀wu, Abẹ́òkúta under the rock, a trader
// from Lagos, and last the host of Dahomey. Each brings its own fighters (see
// data/units.js): Ọ̀yọ́ horsemen, Ìjẹ̀bú gunmen, and Dahomey's Agojie and
// musketeers. The town here starts from scratch, but with what its founders
// learned in Lagos (see the region's `inherits` and sim/economy.js knownEra).

import { has, pop, unifiedCount, majorCount, many, claimed, atPeace, friends, warmer } from './common.js';

// The army the King of Dahomey sends east: his women soldiers, the Agojie,
// with musketeers and bowmen. It gathers in the west and marches when it is
// ready; breaking it wins Ogun. Its size answers the town it has heard of.
const DAHOMEY_HOST = {
  id: 'dahomey_host', name: 'The host of Dahomey', people: 'Dahomey', origin: 'Egun', strength: 5, temperament: 'bandit', major: false,
  leader: 'A war chief of the King of Dahomey', color: '#1c2860', huts: 8, side: 'west',
  loot: { cowries: 400, weapons: 30, muskets: 10 }, joiners: 0, raids: false, radius: 9,
  desc: 'The King of Dahomey’s army, camped in the west: the Agojie, his women soldiers, in blue and white, with musketeers and bowmen round their war chief’s tent.',
};

// Days from the host gathering to its march: gifts to the west buy more time.
const MARCH_DAYS = { ready: 16, gifts: 24 };

// What the ilari ask each time they come.
const TRIBUTE = 40;

function dahomeyGarrison(st, api) {
  // About as strong as your own army and towers, never fewer than 18.
  const n = Math.max(18, Math.min(40, Math.round((api.power() * 1.1) / 90)));
  const agojie = Math.round(n * 0.45);
  const bowmen = Math.round(n * 0.15);
  return { agojie, dahomey: n - agojie - bowmen, bowman: bowmen };
}

// Ọ̀yọ́ sends horsemen to match the town it means to punish: between `min`
// and `max` riders, about `share` of your army's strength (a horseman is worth
// about 132; see unitPower).
const riders = (api, share, min, max) => Math.max(min, Math.min(max, Math.round((api.power() * share) / 132)));

// The bands the story sends. One at a time: a second waits a few days while
// the first is still in the field.
const BANDS = ['kidnappers', 'Ọ̀yọ́ raid', 'Ọ̀yọ́ army', 'Ìjẹ̀bú war band'];
const bandOut = (st) => st.expeditions.some((e) => !e.done && BANDS.includes(e.label) && e.ids.some((id) => st.byId.get(id) && !st.byId.get(id).dead));
const later = (st, api, id) => {
  if (!bandOut(st)) return false;
  api.schedule(id, 3);
  return true;
};

const historyNote = (text) => `\n\nIn the history you know, ${text}`;

export const EVENTS = [
  {
    id: 'ogun_intro',
    story: true,
    title: 'The road north',
    art: '🌄',
    text: (st) => {
      const l = st.legacy || {};
      const from = l.town ? `${l.town} in ${l.land || 'Lagos'}` : 'Lagos';
      return `${st.founder} and ${st.spouse} have come north from ${from} with a few families and the spearmen who stood against Benin. Before them lies Ogun: forest and river, savanna, and the grey granite hills round Olúmọ Rock. In a clearing stands an empty farmstead: a house, a swept floor, a cold fire.\n\nHere you start again from nothing, but not from nothing you know. Everything your people learned to build in ${l.land || 'Lagos'} they can build here from the first day, and the ages you reached there come quicker the second time.\n\nThis land has its own powers: the Alaafin of Ọ̀yọ́ in the north, whose horsemen collect his tribute; the Ìjẹ̀bú, who hold the roads; the Ẹ̀gbá under Olúmọ Rock. And beyond the western rivers, the King of Dahomey.`;
    },
    choices: [
      {
        label: 'Let us begin',
        hint: 'Build what you think matters first. Goals appear at the top left.',
        apply: (st, api) => {
          // They know what red mud is for: they passed a pit of it on the way in.
          if (!st.mudPit) return;
          api.reveal(st.mudPit.x, st.mudPit.y, 4);
          api.notify('🧱 On the way in, your people passed a pit of red mud. Build a Mud Brick Shed beside it: bricks take you to the Compound age.', 'good', { x: st.mudPit.x + 0.5, y: st.mudPit.y + 0.5 });
        },
      },
    ],
  },

  // --- Kidnappers on the roads ------------------------------------------------
  {
    id: 'kidnap_raid',
    silent: true,
    when: (st) => st.time.day >= 8 && pop(st) >= 8 && !!st.factionMap.bandits_n && st.factionMap.bandits_n.status !== 'conquered',
    apply: (st, api) => {
      const ids = api.raid('bandits_n', ['slaver', 'slaver', 'bandit'], { steal: true, patience: 110, label: 'kidnappers', onDefeat: 'kidnappers_gone' });
      const u = ids.length && st.byId.get(ids[0]);
      if (u) api.queue('kidnappers', { at: { x: u.x, y: u.y } });
    },
  },
  {
    id: 'kidnappers',
    title: 'Kidnappers on the farm paths',
    art: '⛓️',
    text: (st) =>
      `At dusk, men from the robbers’ camp in the west come creeping down the farm paths toward ${st.name}. They are kidnappers: they seize people working alone in the fields and sell them on to the slave dealers of the coast.\n\nKeep your people close, and send your spearmen out to meet them.`,
    choices: [{ label: 'Guard the paths' }],
  },
  {
    id: 'kidnappers_gone',
    title: 'The kidnappers are driven off',
    art: '🔥',
    text: () => 'The kidnappers are driven off: the ones still standing have run back into the bush, to their camp in the west. As long as it stands, no path is safe after dark. Burn it, and the roads are yours.',
    choices: [{ label: 'We will deal with them' }],
  },

  // --- The Alaafin's ilari, and Lísàbí ----------------------------------------
  {
    id: 'oyo_ilari',
    when: (st) => st.time.day >= 15 && pop(st) >= 10,
    title: 'The Alaafin’s ilari',
    art: '👑',
    text: (st) =>
      `Two men ride in from the north with an escort of horsemen: ilari, messengers of the Alaafin of Ọ̀yọ́, one side of their heads shaved and their names carried as titles.\n\n“Every town in this land pays tribute to the Alaafin,” says the elder. “${st.name} will pay ${TRIBUTE} cowries now, and again whenever we come. Refuse, and his horsemen will collect it in their own way.”`,
    choices: [
      {
        label: `Pay the tribute (🐚 ${TRIBUTE})`,
        hint: 'Peace with Ọ̀yọ́, for now. They will be back.',
        can: (st) => st.res.cowries >= TRIBUTE,
        apply: (st, api) => {
          st.res.cowries -= TRIBUTE;
          st.flags.oyoPaid = 1;
          api.schedule('oyo_tribute', 12);
          api.notify('👑 The ilari take the cowries and ride back north.', 'info');
        },
      },
      {
        label: 'Send them away',
        hint: 'Ọ̀yọ́ horsemen are fast and strike hard. Have spearmen and archers ready.',
        apply: (st, api) => {
          st.flags.oyoDefied = true;
          api.mood('We pay no one', 3, 4);
          api.schedule('oyo_raid', 5);
        },
      },
    ],
  },
  {
    id: 'oyo_tribute',
    title: 'The ilari return',
    art: '👑',
    text: (st) => `The Alaafin’s ilari are back for his tribute: ${TRIBUTE} cowries, as before.${st.flags.oyoPaid >= 2 ? '\n\nAt the edge of the crowd, the Ẹ̀gbá farmers who have come to market watch them with hard faces.' : ''}`,
    choices: [
      {
        label: `Pay again (🐚 ${TRIBUTE})`,
        can: (st) => st.res.cowries >= TRIBUTE,
        apply: (st, api) => {
          st.res.cowries -= TRIBUTE;
          st.flags.oyoPaid = (st.flags.oyoPaid || 0) + 1;
          if (st.flags.oyoPaid >= 2 && !st.flags.lisabiAsked) {
            st.flags.lisabiAsked = true;
            api.schedule('lisabi', 3);
          }
          if (!st.flags.oyoFree) api.schedule('oyo_tribute', 12);
        },
      },
      {
        label: 'Pay no more',
        hint: 'The Alaafin’s horsemen will come for it.',
        apply: (st, api) => {
          st.flags.oyoDefied = true;
          api.schedule('oyo_raid', 4);
        },
      },
    ],
  },
  {
    id: 'oyo_raid',
    silent: true,
    apply: (st, api) => {
      if (later(st, api, 'oyo_raid')) return;
      const ids = api.border('oyo', many('oyorider', riders(api, 0.6, 2, 3)), { side: 'north', steal: true, patience: 130, label: 'Ọ̀yọ́ raid', onDefeat: 'oyo_raid_over' });
      const u = ids.length && st.byId.get(ids[0]);
      if (!u) return;
      api.vista(u.x, u.y, 7, 30);
      api.queue('oyo_raid_seen', { at: { x: u.x, y: u.y } });
    },
  },
  {
    id: 'oyo_raid_seen',
    title: 'Horsemen from the north!',
    art: '🐎',
    text: (st) => `Dust on the savanna road: Ọ̀yọ́ horsemen, riding hard for ${st.name}. They have come for the Alaafin’s tribute, and they will take it from your stores.\n\nThey are fast and they hit hard. Fight them near your houses, where the compound’s archers can help.`,
    choices: [{ label: 'To arms!' }],
  },
  {
    id: 'oyo_raid_over',
    title: 'The horsemen are gone',
    art: '🐎',
    text: (st) => `The Ọ̀yọ́ riders have gone back up the savanna road. ${st.name} has shown the Alaafin it will not pay.\n\nThat evening a farmer from the Ẹ̀gbá towns comes to the fire, asking to speak to ${st.founder}.`,
    choices: [
      {
        label: 'Hear him',
        apply: (st, api) => {
          if (!st.flags.lisabiAsked) {
            st.flags.lisabiAsked = true;
            api.schedule('lisabi', 2);
          }
        },
      },
    ],
  },
  {
    id: 'lisabi',
    title: 'Lísàbí of the Aro',
    art: '🌾',
    text: (st) =>
      `His name is Lísàbí, a farmer of the Ẹ̀gbá. He leads an Aro, a society of farmers who work each other’s fields in turn, and in secret he has made it an army.\n\n“The Alaafin’s ilari strip our towns bare,” he says. “On the day we choose, every Aro in the Ẹ̀gbá land will rise and the ilari will be gone. Stand with us, and when the Alaafin sends his horsemen to punish us, the Ẹ̀gbá will stand with ${st.name}.”${historyNote('around 1775 Lísàbí led the Ẹ̀gbá to throw off the rule of Ọ̀yọ́. He is still remembered as the father of Ẹ̀gbá freedom.')}`,
    choices: [
      {
        label: 'Stand with Lísàbí',
        hint: 'The Ẹ̀gbá become your friends. Ọ̀yọ́ will send a bigger force to punish you both.',
        apply: (st, api) => {
          st.flags.lisabi = true;
          st.flags.oyoDefied = true;
          st.scheduled = st.scheduled.filter((s) => s.id !== 'oyo_tribute');
          warmer(st, 'egba', 40);
          api.mood('The Aro rises', 5, 5);
          api.schedule('oyo_punish', 10);
          api.notify('🌾 The Ẹ̀gbá rise against the ilari. When Ọ̀yọ́’s horsemen come, the Ẹ̀gbá will fight beside you.', 'good');
        },
      },
      {
        label: 'Keep out of it',
        hint: 'The Ẹ̀gbá will not forget it.',
        apply: (st) => {
          warmer(st, 'egba', -15);
        },
      },
    ],
  },
  {
    id: 'oyo_punish',
    silent: true,
    apply: (st, api) => {
      if (later(st, api, 'oyo_punish')) return;
      const n = riders(api, 0.8, 3, 6);
      const ids = api.border('oyo', [...many('oyorider', n), ...many('bowman', n >= 5 ? 3 : 2)], { side: 'north', patience: 200, label: 'Ọ̀yọ́ army', onDefeat: 'oyo_free' });
      const u = ids.length && st.byId.get(ids[0]);
      if (!u) return;
      if (atPeace(st, 'egba')) api.lend('egba', many('warrior', 4), 8);
      api.vista(u.x, u.y, 8, 40);
      api.queue('oyo_punish_seen', { at: { x: u.x, y: u.y } });
    },
  },
  {
    id: 'oyo_punish_seen',
    title: 'The Alaafin’s punishment',
    art: '🐎',
    text: (st) => `The Alaafin has sent his horsemen and bowmen to punish the towns that killed his ilari, and ${st.name} is first on their road.${atPeace(st, 'egba') ? '\n\nẸ̀gbá warriors have come down from the rock to stand with you.' : ''}`,
    choices: [{ label: 'To arms!' }],
  },
  {
    id: 'oyo_free',
    title: 'Free of Ọ̀yọ́',
    art: '🏆',
    text: (st) => `The Alaafin’s army has gone back north, and his ilari will not come again. No town in this land pays Ọ̀yọ́ now.\n\nIn the Ẹ̀gbá towns they sing of Lísàbí, and of ${st.name}.`,
    choices: [
      {
        label: 'Onward',
        apply: (st, api) => {
          st.flags.oyoFree = true;
          st.scheduled = st.scheduled.filter((s) => s.id !== 'oyo_tribute');
          api.mood('Free of Ọ̀yọ́', 6, 6);
          warmer(st, 'egba', 15);
        },
      },
    ],
  },

  // --- The Ìjẹ̀bú and their roads ----------------------------------------------
  {
    id: 'ijebu_road',
    when: (st) => st.time.day >= 30 && (has(st, 'market') || st.time.day >= 40) && atPeace(st, 'ijebuode') && !['allied', 'vassal'].includes(st.factionMap.ijebuode.status),
    title: 'The Ìjẹ̀bú close the road',
    art: '🚧',
    text: () =>
      `Your traders come home with their loads still on their heads. Ìjẹ̀bú toll-men have closed the road east: nobody passes to the markets of the coast without paying the Awùjalẹ̀ of Ìjẹ̀bú-Òde.\n\nThe Ìjẹ̀bú buy guns on the coast, and they know how to use them.${historyNote('the Ìjẹ̀bú held the roads between Lagos and the interior for centuries. When they closed them to British traders in 1892, the British sent an army against them.')}`,
    choices: [
      {
        label: 'Pay the toll (🐚 30)',
        can: (st) => st.res.cowries >= 30,
        apply: (st, api) => {
          st.res.cowries -= 30;
          warmer(st, 'ijebuode', 10);
          api.notify('🚧 The toll is paid and the road is open again.', 'info');
        },
      },
      {
        label: 'Send gifts to the Awùjalẹ̀ (🐚 80)',
        hint: 'A friend of Ìjẹ̀bú-Òde pays no toll.',
        can: (st) => st.res.cowries >= 80,
        apply: (st, api) => {
          st.res.cowries -= 80;
          warmer(st, 'ijebuode', 30);
          api.notify('🎁 The Awùjalẹ̀ accepts your gifts. Your traders pass freely.', 'good');
        },
      },
      {
        label: 'Force the road',
        hint: 'War with Ìjẹ̀bú-Òde. Their gunmen will come.',
        apply: (st, api) => {
          api.war('ijebuode');
          api.schedule('ijebu_raid', 4);
        },
      },
    ],
  },
  {
    id: 'ijebu_raid',
    silent: true,
    apply: (st, api) => {
      if (later(st, api, 'ijebu_raid')) return;
      const ids = api.raid('ijebuode', [...many('ijebugun', 4), ...many('warrior', 3)], { patience: 160, label: 'Ìjẹ̀bú war band', onDefeat: 'ijebu_raid_over' });
      const u = ids.length && st.byId.get(ids[0]);
      if (u) api.queue('ijebu_raid_seen', { at: { x: u.x, y: u.y } });
    },
  },
  {
    id: 'ijebu_raid_seen',
    title: 'Ìjẹ̀bú gunmen',
    art: '💥',
    text: (st) => `Gunfire in the forest to the east. The Awùjalẹ̀’s gunmen are coming for ${st.name}, firing from the cover of the trees.\n\nGuns reach far but load slowly: close with them fast.`,
    choices: [{ label: 'To arms!' }],
  },
  {
    id: 'ijebu_raid_over',
    title: 'The road is open',
    art: '🛤️',
    text: () => 'The Ìjẹ̀bú war band has gone back to Ìjẹ̀bú-Òde. The road east is open, for now, though the Awùjalẹ̀ is still your enemy. Make peace with him from the Peoples panel (🤝), or bring him down.',
    choices: [{ label: 'Onward' }],
  },

  // --- The refugees of Ọ̀wu ---------------------------------------------------
  {
    id: 'owu_refugees',
    when: (st) => st.time.day >= 45 && pop(st) >= 14,
    title: 'Refugees from Ọ̀wu',
    art: '🧺',
    text: (st) =>
      `Families are walking down the northern paths with all they own on their heads: people of the Ọ̀wu farms, driven out by war. Five of them stop at ${st.name}’s fire and ask for a place to stay.${historyNote('Ọ̀wu fell around the 1820s after a long siege. Its people scattered, and many of them later settled at Abẹ́òkúta.')}`,
    choices: [
      {
        label: 'Take them in',
        hint: 'Five more people to feed and house.',
        apply: (st, api) => {
          for (let k = 0; k < 5; k++) api.wanderer({ near: true, quiet: true, female: k % 2 === 1 });
          api.mood('We took in the people of Ọ̀wu', 3, 5);
        },
      },
      {
        label: 'Feed them, and send them on to the Ẹ̀gbá (30 yams)',
        can: (st) => st.res.yam >= 30,
        apply: (st) => {
          st.res.yam -= 30;
          warmer(st, 'egba', 12);
        },
      },
    ],
  },

  // --- Abẹ́òkúta under the rock -----------------------------------------------
  {
    id: 'abeokuta',
    when: (st) => st.time.day >= 55 && atPeace(st, 'egba'),
    title: 'Abẹ́òkúta: under the rock',
    art: '⛰️',
    text: (st) =>
      `The Ẹ̀gbá towns have gathered at the foot of Olúmọ Rock, behind one long wall, and named their new town Abẹ́òkúta: “under the rock”. Their leader, Ṣódẹkẹ́, sends word to ${st.name}.\n\n“The rock shelters all of us,” his messenger says. “Stand with Abẹ́òkúta, and Abẹ́òkúta will stand with you.”${historyNote('the Ẹ̀gbá founded Abẹ́òkúta around 1830, led by Ṣódẹkẹ́. It became one of the great cities of the land.')}`,
    choices: [
      {
        label: 'Stand with Abẹ́òkúta',
        hint: 'An alliance, if the Ẹ̀gbá trust you enough.',
        apply: (st, api) => {
          const f = st.factionMap.egba;
          warmer(st, 'egba', 20);
          if (f.relation >= 55 || st.flags.lisabi) {
            f.status = 'allied';
            f.relation = Math.max(f.relation, 70);
            st.dirty.territory = true;
            api.notify('🤝 Abẹ́òkúta and your town are allies. Ask them for warriors from the Peoples panel (🤝).', 'good');
          } else {
            api.notify('🤝 The Ẹ̀gbá are glad of your friendship, but do not trust you enough for an alliance yet. Send gifts.', 'info');
          }
        },
      },
      { label: 'Go our own way' },
    ],
  },

  // --- A trader from Lagos ---------------------------------------------------
  {
    id: 'tinubu',
    when: (st) => st.time.day >= 62 && has(st, 'market'),
    title: 'A trader from Lagos',
    art: '🧂',
    text: (st) =>
      `A caravan of porters comes up from the coast, led by a woman who gives orders like a chief: Èfúnróyè Tinúbú, a trader of Lagos, dealing in salt, cloth and guns.\n\n“I hear ${st.name} grows,” she says. “A growing town needs salt, and one day it will need guns. Be my friend, and when war comes to your gate, my porters will come too.”${historyNote('Madam Tinúbú, driven out of Lagos in 1856, made her home in Abẹ́òkúta. She kept its defenders supplied when Dahomey attacked in 1864, and became its Ìyálóde, the first lady of the town.')}`,
    choices: [
      {
        label: 'Make her a friend of the town (🐚 50)',
        hint: 'When the great war comes, she sends gunmen and supplies.',
        can: (st) => st.res.cowries >= 50,
        apply: (st, api) => {
          st.res.cowries -= 50;
          st.flags.tinubu = true;
          api.addRes('salt', 10);
          api.notify('🧂 Madam Tinúbú leaves you salt as a gift, and her promise.', 'good');
        },
      },
      {
        label: 'Buy salt and cloth (20 palm oil)',
        can: (st) => st.res.palmoil >= 20,
        apply: (st, api) => {
          st.res.palmoil -= 20;
          api.addRes('salt', 12);
          api.addRes('cloth', 12);
        },
      },
      { label: 'Not now' },
    ],
  },

  // --- The host of Dahomey ---------------------------------------------------
  {
    id: 'dahomey_word',
    when: (st) => st.time.day >= 75 && pop(st) >= 18 && st.era >= 1,
    title: 'Word from the west',
    art: '🥁',
    text: () =>
      'Yewa fishermen come up the river with news. The King of Dahomey is gathering his army to march east, for captives and for glory. At its heart are the Agojie, his women soldiers, who fear nothing.\n\nThey are coming this way.',
    choices: [
      {
        label: 'Strengthen the walls and train soldiers',
        hint: 'They will gather in the west, and march when they are ready.',
        apply: (st, api) => api.schedule('dahomey_host', 6),
      },
      {
        label: 'Send gifts west to slow them (🐚 120)',
        hint: 'More time before they march.',
        can: (st) => st.res.cowries >= 120,
        apply: (st, api) => {
          st.res.cowries -= 120;
          st.flags.dahomeyGifts = true;
          api.schedule('dahomey_host', 10);
        },
      },
      {
        label: 'Ask the Ẹ̀gbá to stand with us',
        hint: 'If they are your friends, their warriors will come when Dahomey marches.',
        can: (st) => friends(st, 'egba'),
        apply: (st, api) => {
          st.flags.egbaAid = true;
          api.schedule('dahomey_host', 6);
        },
      },
    ],
  },
  {
    id: 'dahomey_host',
    silent: true,
    apply: (st, api) => {
      if (st.factionMap.dahomey_host) return;
      const f = api.host({ ...DAHOMEY_HOST, garrison: dahomeyGarrison(st, api) });
      if (!f) return;
      f.onBeaten = 'dahomey_beaten';
      api.schedule('dahomey_march', st.flags.dahomeyGifts ? MARCH_DAYS.gifts : MARCH_DAYS.ready);
      api.queue('dahomey_host_seen', { at: { x: f.x + 0.5, y: f.y + 4 } });
    },
  },
  {
    id: 'dahomey_host_seen',
    title: 'The host of Dahomey',
    art: '🥁',
    text: (st) => {
      const n = st.units.filter((u) => u.owner === 'dahomey_host' && !u.dead).length;
      const agojie = st.units.filter((u) => u.owner === 'dahomey_host' && u.type === 'agojie' && !u.dead).length;
      return `Your lookouts see their fires in the west: the King of Dahomey’s army, ${n} strong, camped round their war chief’s tent. ${agojie} of them are Agojie, women soldiers in blue and white, with blades and muskets.\n\nThey will march when they are ready. Build walls and towers, train soldiers, and call your friends: or carry the war to their camp.`;
    },
    choices: [{ label: 'We will be ready', hint: '⌂ beside the map brings you back to the town.' }],
  },
  {
    id: 'dahomey_march',
    silent: true,
    apply: (st, api) => {
      const f = st.factionMap.dahomey_host;
      if (!f || f.beaten) return;
      if (!api.march('dahomey_host')) return;
      if (st.flags.egbaAid && atPeace(st, 'egba')) api.lend('egba', [...many('warrior', 4), ...many('bowman', 2)], 10);
      if (st.flags.tinubu) {
        api.lend('tinubu', many('musketeer', 3), 10, { name: 'Tinúbú’s gunman', color: '#c9a227' });
        api.addRes('yam', 40);
        api.addRes('weapons', 6);
      }
      const u = st.units.find((x) => x.owner === 'dahomey_host' && !x.dead);
      api.vista(u.x, u.y, 8, 40);
      api.queue('dahomey_march_seen', { at: { x: u.x, y: u.y } });
    },
  },
  {
    id: 'dahomey_march_seen',
    title: 'Dahomey marches',
    art: '⚔️',
    text: (st) => {
      const n = st.units.filter((u) => u.owner === 'dahomey_host' && !u.dead).length;
      const help = [st.flags.egbaAid && atPeace(st, 'egba') ? 'Ẹ̀gbá warriors have come to stand with you' : '', st.flags.tinubu ? 'Madam Tinúbú’s porters bring food, blades and three gunmen' : ''].filter(Boolean);
      return `The war drums of Dahomey have stopped. ${n} warriors are on the march for ${st.name}, the Agojie at their head.${help.length ? `\n\n${help.join('. ')}.` : ''}\n\nMan the walls, and hold.`;
    },
    choices: [{ label: 'To arms!' }],
  },
  {
    id: 'dahomey_beaten',
    title: 'Dahomey is broken',
    art: '🏆',
    text: (st) =>
      `The last of the King of Dahomey’s army is gone, and the Agojie will not come back this year. Word runs along every road in the land: ${st.name} stood against Dahomey, and won.\n\n🏆 This stage is won: Ogun is yours.${historyNote('the Ẹ̀gbá held the walls of Abẹ́òkúta against Dahomey in 1851, and again in 1864.')}`,
    choices: [{ label: 'Keep building', hint: 'More of Nigeria opens in a future update.', apply: (st) => (st.flags.ogunWon = true) }],
  },

  // --- The land and its seasons ---------------------------------------------
  {
    id: 'harmattan',
    when: (st) => Math.floor(st.time.day / 4) % 3 === 1,
    title: 'The Harmattan',
    art: '🌫️',
    text: () => 'The dry wind blows down from the Sahara and the sun turns pale. Crops grow slowly until the rains return. Keep your stores full.',
    choices: [{ label: 'We will manage' }],
  },
  {
    id: 'olumo',
    when: (st) => claimed(st, 'olumo'),
    title: 'Under the rock',
    art: '⛰️',
    text: () => 'From the top of Olúmọ Rock the land lies open: the Ẹ̀gbá towns at its foot, the Ogun river shining to the south, and the smoke of a dozen villages. Whoever holds the friendship of the Ẹ̀gbá holds this country.',
    choices: [{ label: 'Onward' }],
  },
  {
    id: 'caravan',
    repeat: 30,
    // Ọ̀yọ́'s traders stay away while its horsemen are at war with you.
    when: (st) => has(st, 'market') && st.time.day >= 18 && (!st.flags.oyoDefied || st.flags.oyoFree),
    title: 'Traders from Ọ̀yọ́',
    art: '🐪',
    text: () => 'A caravan has come down the savanna road from Ọ̀yọ́ with horses, iron and leather. They want palm oil and cowries.',
    choices: [
      {
        label: 'Sell 20 palm oil (+🐚 150)',
        can: (st) => st.res.palmoil >= 20,
        apply: (st) => {
          st.res.palmoil -= 20;
          st.res.cowries += 150;
        },
      },
      {
        label: 'Buy 15 iron (🐚 80)',
        can: (st) => st.res.cowries >= 80,
        apply: (st, api) => {
          st.res.cowries -= 80;
          api.addRes('iron', 15);
        },
      },
      { label: 'Not today' },
    ],
  },
  {
    id: 'ogun_united',
    when: (st) => unifiedCount(st) >= majorCount(st),
    title: 'Ogun is one',
    art: '🏆',
    text: (st) => `Every people of Ogun now stands with ${st.name}: by friendship, by tribute, or by the sword.\n\nChapter two is complete. More of Nigeria opens in a future update.`,
    choices: [{ label: 'Keep building', apply: (st) => (st.flags.ogunUnited = true) }],
  },
];
