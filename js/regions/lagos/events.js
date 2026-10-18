// The history of Lagos, arriving when the player's choices bring it: story
// pop-ups, choices and what follows from them (see sim/events.js).

import { BUILDINGS } from '../../data/buildings.js';
import { armyPower } from '../../sim/military.js';
import { has, pop, unifiedCount, majorCount, many, guests, his, building, home } from './common.js';

// The host the Oba sends against a town that defies him (or only buys time
// with gifts): fifty warriors who gather at the far end of the land, and
// march when they are ready. Beating them wins Lagos and opens the road to
// Ogun State.
const BENIN_HOST = {
  id: 'benin_host', name: 'The Oba’s host', people: 'Edo', origin: 'Edo', strength: 5, temperament: 'bandit', major: false,
  leader: 'Ìyásẹ̀ Ẹ̀dọ́rẹ̀, war chief of the Oba of Benin', color: '#a3171b', garrison: { benin: 42, bowman: 8 }, huts: 8,
  loot: { cowries: 400, weapons: 30, iron: 30 }, joiners: 0, raids: false, radius: 9,
  desc: 'Fifty warriors of Benin in war dress, with leather shields, drums and the red cloth of the Oba, camped round their war chief’s tent.',
};

// Days from the host gathering to its march: gifts buy more time.
const MARCH_DAYS = { refused: 16, gifts: 26 };

function hostComing(st, api, gifts) {
  if (st.factionMap.benin_host || st.flags.hostPlanned) return;
  st.flags.hostPlanned = true;
  st.flags.hostGifts = !!gifts;
  // A few days of small raids first (or of quiet, after gifts); then the host.
  api.schedule('benin_host', gifts ? 3 : 4);
}

function finishOpening(st, api) {
  if (st.flags.openingDone) return;
  st.flags.openingDone = true;
  st.flags.feedFirst = false;
  st.migrateT = 10;
  api.notify('🔥 Word spreads of a safe settlement by the lagoon. Newcomers will come and sit by the fire: give them work and beds.', 'good');
}

function resolveForeign(st) {
  if (st.flags.britishPartner || st.flags.britishRepelled || st.flags.independent) st.flags.foreignResolved = true;
}

function welcomePortuguese(st, api) {
  st.flags.metEuropeans = true;
  st.flags.europeanTrade = true;
  st.foreign.portuguese.trade = true;
  st.foreign.portuguese.hostile = false;
  st.flags.cassava = true;
  api.addRes('iron', 15);
  api.schedule('lagos_name', 2);
  if (!st.fired.atlantic) api.schedule('atlantic', 8);
  api.notify(`⚓ Trade with the Portuguese has begun. They brought cassava cuttings from across the ocean — plant Cassava Farms and build Garri Houses. Once you are a Town, build a ${BUILDINGS.port.name} so their merchant ships can dock.`, 'good');
}

export const EVENTS = [
  {
    id: 'intro',
    story: true,
    title: 'Ẹ káàbọ̀ — the land by the lagoon',
    art: '🌅',
    text: (st) =>
      `${st.founder} and ${st.spouse} have walked for days, south from Ìsẹ́rí, with a cutlass, a hoe and a basket of seed yams. Where the forest meets the great lagoon they find a house standing alone in a wide clearing: empty, its owners long gone, its roof fallen in.\n\n“The walls still stand,” says ${st.founder}. “We will mend it, settle here, and build a community.”\n\nThe forest all around is a wall, and the trees are all the wood you need. One day this could be the greatest city in Africa — and what it becomes is up to you.`,
    choices: [{ label: 'Settle here', hint: 'Take it one step at a time: the guide at the top left shows what to do next.' }],
  },
  {
    id: 'welcome',
    story: true,
    title: 'Strangers at the door',
    art: '👋',
    text: (st) => {
      const who = guests(st);
      const intro = who.map((c) => `${c.name}, a ${c.female ? 'woman' : 'man'} of the ${c.people} from ${c.from}`).join(', and ');
      return `${who.length === 1 ? 'A traveller has' : 'Two travellers have'} come up the path: ${intro}. They are looking for a place to live.\n\n${st.founder} puts down his cutlass and goes out to meet them. “Welcome, strangers, to our household. My wife and I are building a community here in Eko. Will you join us?”\n\n“Yes,” ${who.length === 1 ? 'comes the answer' : 'they answer together'}. “We will.”`;
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
    art: '🐺',
    text: (st) => {
      const s = st.story || {};
      const dead = (s.victims || []).map((v) => v.name);
      const heroes = (s.heroes || []).map((h) => `${h.name} killed ${h.kills === 1 ? 'one' : h.kills === 2 ? 'two' : h.kills} with ${his(h.female)} ${h.tool || 'bare hands'}`);
      return `${dead.length ? `${dead.join(' and ')} ${dead.length > 1 ? 'are' : 'is'} dead, taken by the wolves in the field.` : 'The wolves are dead.'} ${heroes.length ? `${heroes.join('; ')}.` : ''}\n\nThat night ${st.founder} and ${st.spouse} come out of the house and sit by the fire. “We have lost our own,” he says. “The forest is a wall no wolf gets through. We will close the gaps between the trees with a fence, and leave a gate for ourselves.”`;
    },
    choices: [{ label: 'Build a fence', hint: 'Trees are a natural wall. Fence the open ground between them, and the water does the rest.', apply: (st) => (st.flags.needFence = true) }],
  },
  {
    id: 'settled',
    story: true,
    title: 'Safe behind the fence',
    art: '🛡️',
    text: (st) =>
      `The last stake is lashed in place and the gate swings shut. For the first time since they came, ${st.founder} and ${st.spouse} sleep through the night.\n\nWord travels along the paths: there is a safe place by the lagoon. Newcomers will come and sit by the fire, up to five at a time. Each new Plank House brings two more. Put them to work.\n\nBut keep them fed and give them beds: hungry or sleeping in the open, people grumble — and then they leave.`,
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
      const stolen = Object.entries(s.stolen || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k === 'wood' ? 'planks' : k === 'cowries' ? 'cowries' : k}`);
      return `The bandits broke through the fence${dead.length ? `, killed ${dead.join(' and ')}` : ''}${stolen.length ? ` and carried off ${stolen.slice(0, 5).join(', ')}` : ''}. Then they were gone, back into the bush to their camp in the far corner of the forest.\n\n${st.founder} walks the broken fence with ${st.spouse}. “They are four, and they will come again,” he says. “We need a guard house and men to match them. And stronger houses. But first, we must fill the stores again.”`;
    },
    choices: [{ label: 'We will be ready', apply: (st) => (st.flags.raided = true) }],
  },
  {
    id: 'chapter_one',
    story: true,
    title: 'A town of red mud',
    art: '🧱',
    text: (st) =>
      `Where a single empty house once stood in a clearing, there is now a settlement of red-mud houses behind a fence, with a guard house, sheds, a farm and a fire where newcomers sit.\n\n“When we came,” says ${st.spouse}, “there was nothing here but trees.”\n\nThe guided opening is over. From here, grow ${st.name} as you choose: more people, the Compound age, the peoples of the land — and, one day, the ships from across the sea.`,
    choices: [{ label: 'Onward', hint: 'Goals now appear at the top left.' }],
  },
  {
    id: 'harmattan',
    when: (st) => Math.floor(st.time.day / 4) % 3 === 1,
    title: 'The Harmattan',
    art: '🌫️',
    text: () => 'A dry, dusty wind blows down from the Sahara and the sun turns pale. Yams grow slowly until the rains return. Keep your granaries full and your fishermen and hunters busy.',
    choices: [{ label: 'We will manage' }],
  },
  {
    id: 'benin',
    when: (st) => st.era >= 1 && pop(st) >= 12 && st.time.day >= 18 && st.factionMap.edo?.status !== 'conquered',
    title: 'War canoes from Benin',
    art: '🥁',
    text: () =>
      "Drums echo across the water. Edo war canoes beach below your compound, and an envoy of the Oba of Benin steps ashore wearing coral beads.\n\n'The Oba's warriors camp on this lagoon,' he says. 'Eko — our war camp — and every farm around it owes him allegiance.'",
    choices: [
      {
        label: 'Swear allegiance to the Oba',
        hint: 'Benin becomes your ally. You pay a small tribute every day.',
        apply: (st, api) => {
          const f = st.factionMap.edo;
          f.status = 'allied';
          f.relation = 70;
          st.flags.beninTribute = true;
          st.dirty.territory = true;
          api.notify('🤝 You are now under the protection of the Oba of Benin.', 'good');
        },
      },
      {
        label: 'Send rich gifts, but bow to no one (🐚 60)',
        hint: 'Buys time, not peace.',
        can: (st) => st.res.cowries >= 60,
        apply: (st, api) => {
          st.res.cowries -= 60;
          st.factionMap.edo.relation += 18;
          api.notify('🎁 The envoy accepts your gifts and paddles away.', 'info');
          hostComing(st, api, true);
        },
      },
      {
        label: 'Èkó bows to no one!',
        hint: 'War with the Edo War Camp. They are mighty.',
        apply: (st, api) => {
          api.war('edo');
          api.mood('Defiance', 4, 4);
          hostComing(st, api, false);
        },
      },
    ],
  },
  {
    id: 'benin_again',
    title: "The Oba's envoy returns",
    art: '🥁',
    text: () => 'The Edo envoy is back, with more war canoes this time. The Oba is losing patience.',
    choices: [
      {
        label: 'Swear allegiance to the Oba',
        apply: (st, api) => {
          const f = st.factionMap.edo;
          f.status = 'allied';
          f.relation = 70;
          st.flags.beninTribute = true;
          st.dirty.territory = true;
          api.notify('🤝 You are now under the protection of the Oba of Benin.', 'good');
        },
      },
      {
        label: 'More gifts (🐚 100)',
        can: (st) => st.res.cowries >= 100,
        apply: (st, api) => {
          st.res.cowries -= 100;
          st.factionMap.edo.relation += 20;
          api.notify('🎁 The Oba accepts your gifts. For now.', 'info');
          hostComing(st, api, true);
        },
      },
      {
        label: 'Refuse',
        hint: 'War with the Edo War Camp.',
        apply: (st, api) => {
          api.war('edo');
          hostComing(st, api, false);
        },
      },
    ],
  },
  {
    id: 'benin_host',
    silent: true,
    apply: (st, api) => {
      if (st.factionMap.benin_host) return;
      const f = api.host(BENIN_HOST);
      if (!f) return;
      f.onBeaten = 'benin_beaten';
      // The march: a timer nobody sees.
      api.schedule('benin_march', st.flags.hostGifts ? MARCH_DAYS.gifts : MARCH_DAYS.refused);
      api.queue('benin_host_seen', { at: { x: f.x + 0.5, y: f.y + 4 } });
    },
  },
  {
    id: 'benin_host_seen',
    title: 'The host of Benin',
    art: '🥁',
    text: (st) =>
      `From the tallest palm, your lookout sees it at the far end of the land: the Oba's host. Fifty warriors in war dress, with leather shields and the red cloth of Benin, drawn up in ranks before their war chief's tent.\n\n${st.flags.hostGifts ? 'Your gifts bought time, but not peace: they are gathering all the same.' : `They have come to punish ${st.name} for its defiance.`} They will march when they are ready.\n\nBuild houses, grow, train soldiers: then carry the war to their camp, or wait for them behind your walls.`,
    choices: [{ label: 'We will be ready', hint: '⌂ beside the map brings you back to the village.' }],
  },
  {
    id: 'benin_march',
    silent: true,
    apply: (st, api) => {
      const f = st.factionMap.benin_host;
      if (!f || f.beaten) return;
      const n = api.march('benin_host');
      if (!n) return;
      const u = st.units.find((x) => x.owner === 'benin_host' && !x.dead);
      api.vista(u.x, u.y, 8, 40);
      api.queue('benin_march_seen', { at: { x: u.x, y: u.y } });
    },
  },
  {
    id: 'benin_march_seen',
    title: 'The drums have stopped',
    art: '⚔️',
    text: (st) => {
      const n = st.units.filter((u) => u.owner === 'benin_host' && !u.dead).length;
      return `The war drums of Benin have fallen silent. The host is on the march: ${n} warriors, coming for ${st.name}.\n\nMan the fence, gather your soldiers, and hold.`;
    },
    choices: [{ label: 'To arms!' }],
  },
  {
    id: 'benin_beaten',
    title: 'The host of Benin is broken',
    art: '🏆',
    text: (st) =>
      `The last warriors of the Oba's host lie in the dust, and the drums of Benin are silent on this lagoon. Word runs up every path: ${st.name} stood against Benin, and won.\n\n🏆 This stage is won: Lagos is yours.\n\n🔓 Ogun State is now open for you to explore: the Ẹ̀gbá under Olúmọ Rock, the Ọ̀wu, the Ìjẹ̀bú of Ìjẹ̀bú-Òde and the Rẹ́mọ.`,
    choices: [
      { label: 'Set out for Ogun State', hint: 'A new land to explore. Your Lagos game is kept in its own save.', apply: (st) => { st.flags.beninBeaten = true; st.flags.ogunOpen = true; st.flags.goOgun = true; } },
      { label: 'Stay and keep building Lagos', hint: 'Ogun State waits for you on the map of Nigeria.', apply: (st) => { st.flags.beninBeaten = true; st.flags.ogunOpen = true; } },
    ],
  },
  {
    id: 'sails',
    silent: true,
    when: (st) => st.time.day >= 30 && (st.era >= 2 || (st.era >= 1 && st.stats.oceanSeen >= 25)),
    apply: (st, api) => {
      api.ship('portuguese', 'envoy', { event: 'portuguese' });
      api.notify('⛵ Strange white sails on the horizon, coming toward the lagoon!', 'info');
    },
  },
  {
    id: 'portuguese',
    title: 'Men from the sea',
    art: '⛵',
    text: () =>
      "A ship with great white sails painted with red crosses anchors off your shore. Pale, bearded men wade in — Portuguese, from a land far to the north. Their captain offers iron bars, cloth and brass manillas, and asks for ivory, pepper and palm oil.\n\nThey have already named your lagoon 'Lago de Curamo'.",
    choices: [
      { label: 'Welcome them and trade', hint: 'Iron as a gift, and cassava. Their ships will trade at your port.', apply: welcomePortuguese },
      {
        label: 'Send them back to their ship',
        hint: 'They will return.',
        apply: (st, api) => {
          st.flags.metEuropeans = true;
          api.schedule('portuguese_return', 20);
          api.notify('🚫 The Portuguese sail away, for now.', 'info');
        },
      },
      {
        label: 'Seize their cargo!',
        hint: 'Their soldiers carry firearms. Have spearmen and archers ready.',
        apply: (st, api) => {
          st.flags.metEuropeans = true;
          st.foreign.portuguese.hostile = true;
          api.landing('portuguese', many('soldado', 5), { onDefeat: 'portuguese_beaten', minDist: 9 });
        },
      },
    ],
  },
  {
    id: 'portuguese_return',
    title: 'The Portuguese return',
    art: '⛵',
    text: () => 'The Portuguese are back, with two ships and more guns. They will trade — or they will take.',
    choices: [
      { label: 'Trade with them', apply: welcomePortuguese },
      {
        label: 'Drive them into the sea',
        apply: (st, api) => {
          st.foreign.portuguese.hostile = true;
          api.landing('portuguese', many('soldado', 7), { onDefeat: 'portuguese_beaten', minDist: 9 });
        },
      },
    ],
  },
  {
    id: 'portuguese_beaten',
    title: 'The Portuguese are beaten',
    art: '🏆',
    text: () => 'The landing party is broken. Survivors scramble back to their boats, leaving muskets, blades and iron behind.',
    choices: [
      {
        label: 'Let them come back — as guests, on our terms',
        hint: 'Trade resumes. Unlocks the Trading Post.',
        apply: (st, api) => {
          st.foreign.portuguese.hostile = false;
          api.addRes('weapons', 8);
          welcomePortuguese(st, api);
        },
      },
      {
        label: 'Never again',
        apply: (st, api) => {
          st.foreign.portuguese.hostile = false;
          st.flags.portugueseBanned = true;
          api.addRes('weapons', 8);
          api.addRes('iron', 20);
          api.mood('Victory at the shore', 8, 6);
        },
      },
    ],
  },
  {
    id: 'lagos_name',
    title: "What's in a name?",
    art: '📜',
    text: (st) => `The Portuguese have started calling your town "Lagos", after the lagoons. Their maps will carry the name across the world. Your elders grumble that it already has one: ${st.name}.`,
    choices: [
      { label: (st) => `Keep the name ${st.name}` },
      { label: 'Call it Lagos', apply: (st) => (st.name = 'Lagos') },
      { label: 'Èkó to us, Lagos to them', apply: (st) => (st.name = 'Èkó (Lagos)') },
    ],
  },
  {
    id: 'atlantic',
    title: 'The Atlantic trade',
    art: '⛓️',
    text: () =>
      'More ships come now, and not all of them want palm oil. Slavers anchor along the coast and pay well for captives, and some chiefs have begun to sell people.\n\nYour elders say: a village that sells its neighbours will one day be sold itself.',
    choices: [
      {
        label: 'Forbid it. No one is sold from our land.',
        hint: 'Your people are proud of you. A slavers’ barracoon appears on the coast — free its captives and they will join you.',
        apply: (st, api) => {
          st.flags.abolition = true;
          api.mood('We stand for freedom', 8, 20);
          const f = api.faction(
            {
              id: 'slavers', name: "Slavers' barracoon", people: 'Slavers', strength: 2, temperament: 'bandit', major: false,
              color: '#222', garrison: { slaver: 5, bowman: 1 }, huts: 3, style: 'camp', raids: false,
              loot: { cowries: 140, weapons: 6, iron: 10 }, joiners: 8,
              desc: 'A stockade where captives are held for the ships.',
            },
            [0.3, 0.79],
          );
          api.notify(`⛓️ Slavers hold captives in a barracoon by the creek. Free them!`, 'war', { x: f.x, y: f.y });
        },
      },
      {
        label: 'Look away and trade only in palm oil',
        hint: 'Your people feel the shame of it.',
        apply: (st, api) => api.mood('Shame of silence', -5, 15),
      },
    ],
  },
  {
    id: 'french',
    silent: true,
    when: (st) => st.flags.metEuropeans && (st.era >= 3 || (st.era >= 2 && st.time.day >= 70)),
    apply: (st, api) => {
      api.ship('french', 'envoy', { event: 'french_envoy', prefer: 'west' });
      api.notify('⛵ A French ship is sailing in from Porto-Novo in the west.', 'info');
    },
  },
  {
    id: 'french_envoy',
    title: 'The French from Porto-Novo',
    art: '⛵',
    text: () => 'French traders from Porto-Novo, west along the coast, want a treaty: your palm oil for French goods — and no British ships in your harbour.',
    choices: [
      {
        label: 'Sign the trade pact',
        hint: '+8 cowries a day. The British will not like it.',
        apply: (st, api) => {
          st.flags.frenchPact = true;
          st.flags.metEuropeans = true;
          st.foreign.french.trade = true;
          api.notify('🖋️ A pact with France. Palm oil flows west.', 'good');
        },
      },
      {
        label: 'Refuse',
        hint: 'The French may try to force the issue.',
        apply: (st, api) => {
          st.foreign.french.hostile = true;
          api.landing('french', many('french', 6), { onDefeat: 'french_beaten', prefer: 'west', minDist: 10 });
        },
      },
      { label: 'Promise to think on it', apply: (st, api) => api.schedule('french_envoy', 25) },
    ],
  },
  {
    id: 'french_beaten',
    title: 'The French withdraw',
    art: '🏆',
    text: () => 'The French landing has failed. Their ship turns back toward Porto-Novo.',
    choices: [
      {
        label: 'Good riddance',
        apply: (st, api) => {
          st.foreign.french.hostile = false;
          st.flags.frenchBeaten = true;
          api.addRes('weapons', 6);
          api.mood('The French beaten', 6, 6);
        },
      },
    ],
  },
  {
    id: 'consul',
    silent: true,
    when: (st) => st.era >= 3 && st.time.day >= (st.flags.era3Day ?? 1e9) + 5,
    apply: (st, api) => {
      api.ship('british', 'envoy', { event: 'british' });
      api.notify('🚢 A British warship is steaming toward your harbour.', 'war');
    },
  },
  {
    id: 'british',
    title: 'The British Consul',
    art: '🚢',
    text: () =>
      "A warship of the Royal Navy drops anchor with her guns run out. The British consul comes ashore with a treaty.\n\n'Her Majesty's government will protect your trade and end the slave trade on this coast,' he says, 'in return for the cession of the port to the Crown.'\n\nIn the history you know, Lagos was bombarded in 1851 and ceded in 1861. This time, the choice is yours.",
    choices: [
      {
        label: 'Sign the Treaty of Cession',
        hint: 'Peace and trade, but foreign rule: −6 happiness and a quarter of your taxes go to the Crown — until you win independence.',
        apply: (st, api) => {
          st.flags.colonized = true;
          st.flags.europeanTrade = true;
          st.foreign.british.trade = true;
          api.notify('🖋️ The treaty is signed. The Union Jack flies over the harbour. Unite the land and build an Assembly to win independence.', 'bad');
        },
      },
      {
        label: 'Refuse. This land is ours.',
        hint: 'Expect a bombardment and a landing of Royal Marines.',
        apply: (st, api) => {
          st.foreign.british.hostile = true;
          api.ship('british', 'landing', { troops: many('marine', 8), bombard: 3, onDefeat: 'british_wave2', label: 'British landing party', minDist: 8 });
          api.notify('💥 The consul storms back to his ship. The guns are turning toward the town!', 'war');
        },
      },
      {
        label: 'Negotiate as equals',
        hint: 'Needs 3 united peoples and an army strength of 500.',
        can: (st) => unifiedCount(st) >= 3 && armyPower(st) >= 500,
        apply: (st, api) => {
          st.flags.britishPartner = true;
          st.flags.europeanTrade = true;
          st.foreign.british.trade = true;
          resolveForeign(st);
          api.mood('Respected as equals', 8, 8);
          api.notify('🤝 The British agree to trade as equals. No flag but yours flies here.', 'good');
        },
      },
    ],
  },
  {
    id: 'british_wave2',
    title: 'They will be back',
    art: '🚢',
    text: () => 'The marines are beaten back to their boats. But the consul sends word: a far larger force is coming.',
    choices: [
      {
        label: 'Let them come',
        apply: (st, api) => {
          api.ship('british', 'landing', { troops: many('marine', 12), bombard: 4, onDefeat: 'british_peace', label: 'British expedition', minDist: 8 });
        },
      },
      {
        label: 'Sign the treaty after all',
        apply: (st, api) => {
          st.foreign.british.hostile = false;
          st.flags.colonized = true;
          st.flags.europeanTrade = true;
          api.notify('🖋️ The treaty is signed. Unite the land and build an Assembly to win independence.', 'bad');
        },
      },
    ],
  },
  {
    id: 'british_peace',
    title: 'An empire sues for peace',
    art: '🏆',
    text: () => 'The second expedition has failed. The Royal Navy withdraws, and the consul asks — politely, this time — whether you will trade.',
    choices: [
      {
        label: 'Trade with them as equals',
        apply: (st, api) => {
          st.foreign.british.hostile = false;
          st.flags.britishRepelled = true;
          st.flags.britishPartner = true;
          st.flags.europeanTrade = true;
          resolveForeign(st);
          api.mood('We defeated an empire', 12, 10);
        },
      },
    ],
  },
  {
    id: 'independence',
    when: (st) => st.flags.colonized && !st.flags.independent && has(st, 'assembly') && unifiedCount(st) >= majorCount(st),
    title: 'Independence',
    art: '🇳🇬',
    text: () =>
      'Every people of the land now sends voices to your House of Assembly, and together they demand freedom from the Crown.\n\nIn the history you know, Nigeria became independent on 1 October 1960. How will it come here?',
    choices: [
      {
        label: 'Negotiate independence (🐚 300)',
        can: (st) => st.res.cowries >= 300,
        apply: (st, api) => {
          st.res.cowries -= 300;
          st.flags.independent = true;
          resolveForeign(st);
          api.mood('Independence!', 15, 12);
          api.notify('🇳🇬 Independence is won at the conference table!', 'good');
        },
      },
      {
        label: 'Rise up!',
        hint: 'Defeat the colonial garrison.',
        apply: (st, api) => {
          st.foreign.british.hostile = true;
          api.landing('british', many('marine', 10), { onDefeat: 'independence_won', minDist: 6 });
        },
      },
    ],
  },
  {
    id: 'independence_won',
    title: 'Free!',
    art: '🇳🇬',
    text: () => 'The colonial garrison has surrendered. The Union Jack comes down.',
    choices: [
      {
        label: 'Raise our own flag',
        apply: (st, api) => {
          st.foreign.british.hostile = false;
          st.flags.independent = true;
          resolveForeign(st);
          api.mood('Independence!', 15, 12);
        },
      },
    ],
  },
  {
    id: 'eyo',
    repeat: 36,
    when: (st) => has(st, 'palace') && has(st, 'shrine') && st.time.day >= 20,
    title: 'The Eyo festival',
    art: '🎭',
    text: () =>
      'The Adámú Òrìṣà play: the Eyo masquerades, all in white, wish to parade through the town with their staffs and wide hats. The whole town will turn out — but such a festival is not cheap.',
    choices: [
      {
        label: 'Hold the festival (🐚 60)',
        hint: '+15 happiness for eight days.',
        can: (st) => st.res.cowries >= 60,
        apply: (st, api) => {
          st.res.cowries -= 60;
          api.mood('Eyo festival', 15, 8);
          api.notify('🎭 The Eyo masquerades fill the streets in white!', 'good');
        },
      },
      { label: 'Not this year' },
    ],
  },
  {
    id: 'caravan',
    repeat: 30,
    when: (st) => has(st, 'market') && st.time.day >= 24,
    title: 'Traders from Kano',
    art: '🐪',
    text: () => 'A caravan of Hausa traders has walked all the way from Kano with leather, kola nuts and fine iron. They are hungry for palm oil and cowries.',
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
        label: 'Buy 2 horses (🐚 120)',
        hint: 'For horsemen at the Training Ground.',
        can: (st) => st.res.cowries >= 120 && st.era >= 2,
        apply: (st, api) => {
          st.res.cowries -= 120;
          api.addRes('horses', 2);
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
];
