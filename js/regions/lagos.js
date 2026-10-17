// Chapter one: Lagos (Èkó). The land, its peoples, and the history that
// washes up on its shore — arriving when the player's choices bring it.
//
// To add another state, copy this file's shape: terrain template, peoples,
// places, events and goals. See regions/index.js.

import { BUILDINGS } from '../data/buildings.js';
import { armyPower } from '../sim/military.js';
import { totalFood } from '../sim/economy.js';

const has = (st, type) => st.buildings.some((b) => b.type === type && b.owner === 'player' && b.built >= 1 && !b.dead);
const count = (st, type) => st.buildings.filter((b) => b.type === type && b.owner === 'player' && b.built >= 1 && !b.dead).length;
const pop = (st) => st.citizens.filter((c) => !c.stranger && !c.dead).length + st.units.filter((u) => u.owner === 'player' && !u.dead).length;
const unifiedCount = (st) => st.factions.filter((f) => f.major && ['allied', 'vassal', 'conquered'].includes(f.status)).length;
const majorCount = (st) => st.factions.filter((f) => f.major).length;
const many = (type, n) => Array.from({ length: n }, () => type);

// --- The opening: a household of two becomes a community -----------------------

const guests = (st) => (st.flags.wanderers || []).map((id) => st.byId.get(id)).filter((c) => c && !c.dead);
const his = (female) => (female ? 'her' : 'his');

// Is the compound closed in by fences, gates and water? A walk outward from
// the compound must not get far.
export function fenced(st) {
  const home = st.buildings.find((b) => b.type === 'compound' && !b.dead);
  if (!home) return false;
  const cx = home.x + 1;
  const cy = home.y + 1;
  const W = st.W;
  const seen = new Uint8Array(W * st.H);
  const queue = [cy * W + cx];
  seen[queue[0]] = 1;
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    const x = i % W;
    const y = (i / W) | 0;
    if (x <= 0 || y <= 0 || x >= W - 1 || y >= st.H - 1 || Math.max(Math.abs(x - cx), Math.abs(y - cy)) > 22 || queue.length > 2500) return false;
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      if (seen[j]) continue;
      seen[j] = 1;
      const b = st.byId.get(st.occ[j]);
      if (b && !b.dead && b.owner === 'player' && (b.wall || b.gate) && b.built >= 1) continue;
      const t = st.terrain[j];
      if (t === 0 || t === 1 || t === 2) continue; // ocean, lagoon, river
      queue.push(j);
    }
  }
  return true;
}

function finishOpening(st, api) {
  if (st.flags.openingDone) return;
  st.flags.openingDone = true;
  st.flags.feedFirst = false;
  st.migrateT = 12;
  api.notify('🔥 Word spreads of a safe household by the lagoon. More strangers will come and wait by the fire: build huts for them.', 'good');
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

export const LAGOS = {
  id: 'lagos',
  name: 'Lagos',
  yo: 'Èkó',
  width: 112,
  height: 84,
  defaultName: 'Èkó',

  terrain: {
    coastY: 0.885,
    beach: 0.035,
    creekY: 0.818,
    creekHalf: 0.95,
    lagoons: [
      { x: 0.66, y: 0.675, rx: 0.22, ry: 0.085 },
      { x: 0.9, y: 0.745, rx: 0.085, ry: 0.05 },
    ],
    channels: [{ x: 0.535, half: 1.3, y0: 0.7 }],
    islands: [{ x: 0.56, y: 0.725, r: 0.026 }],
    rivers: [
      { from: [0.34, 0], to: [0.47, 0.62], fordEvery: 9, wide: true },
      { from: [0.79, 0], to: [0.74, 0.6], fordEvery: 8 },
    ],
    savanna: 0.2,
    hillLevel: 0.69,
    forestLevel: 0.57,
    ironClusters: 3,
    start: [0.4, 0.56],
  },

  foreign: {
    portuguese: { name: 'Portuguese', color: '#c9a227' },
    french: { name: 'French', color: '#2c5aa0' },
    british: { name: 'British', color: '#b22234' },
  },

  factions: [
    {
      id: 'awori', name: 'Awori of Ọ̀tà', people: 'Awori', origin: 'Awori', strength: 2, temperament: 'friendly',
      leader: 'Ọlọ́ta Olúwọlé of Ọ̀tà', wants: { fish: 4, iron: 9, salt: 9 }, offers: { yam: 3, wood: 3 },
      at: [0.27, 0.24], color: '#3f8f5a', garrison: { warrior: 4, bowman: 2 },
      loot: { yam: 60, wood: 40, cowries: 80 }, tribute: { yam: 6, cowries: 6 }, joiners: 4,
      desc: 'Your Awori kin, farmers and hunters of the forest at Ọ̀tà. Like you, they trace their line to Olófin, who led the Awori south to the lagoon.',
    },
    {
      id: 'egun', name: 'Egun of Àgbádárìgì', people: 'Egun', origin: 'Egun', strength: 3, temperament: 'proud',
      leader: 'Akran Gbẹ̀nù of Àgbádárìgì', wants: { yam: 3, garri: 7, cloth: 13 }, offers: { fish: 3, salt: 8 },
      at: [0.08, 0.62], color: '#c2873a', garrison: { warrior: 6, bowman: 4 },
      loot: { fish: 80, palmoil: 30, cowries: 150 }, tribute: { fish: 6, cowries: 9 }, joiners: 5,
      desc: 'Fishermen and traders of the western creeks at Badagry. Shrewd, independent and well connected all along the coast.',
    },
    {
      id: 'egba', name: 'Ẹ̀gbá of Abẹ́òkúta', people: 'Egba', origin: 'Egba', strength: 5, temperament: 'warlike',
      leader: 'Alákẹ́ Adéṣínà of the Ẹ̀gbá', wants: { salt: 10, cloth: 14, muskets: 45 }, offers: { horses: 70, yam: 3, iron: 8 },
      at: [0.45, 0.06], color: '#8b3a2b', garrison: { warrior: 9, bowman: 6, horseman: 4 },
      loot: { yam: 120, iron: 40, weapons: 12, cowries: 260 }, tribute: { yam: 10, cowries: 16 }, joiners: 7,
      desc: 'Hardened warriors from the rocky north, under the shelter of Olúmọ Rock. Their war bands can wipe out a careless army in minutes.',
    },
    {
      id: 'ijebu', name: 'Ìjẹ̀bú of Ẹ̀pẹ́', people: 'Ijebu', origin: 'Ijebu', strength: 4, temperament: 'proud',
      leader: 'Awùjalẹ̀ Adémúyìwá of Ìjẹ̀bú', wants: { iron: 9, weapons: 20, palmoil: 7 }, offers: { garri: 6, cloth: 13 },
      at: [0.9, 0.42], color: '#6d3fa0', garrison: { warrior: 8, bowman: 5, edo: 2 },
      loot: { yam: 80, palmoil: 40, cowries: 220 }, tribute: { palmoil: 4, cowries: 14 }, joiners: 6,
      desc: 'Masters of the eastern lagoon trade routes. Rich, disciplined, and wary of upstarts on their waters.',
    },
    {
      id: 'edo', name: 'Edo War Camp', people: 'Edo', origin: 'Edo', strength: 5, temperament: 'proud',
      leader: 'Ìyásẹ̀ Òsàrọ̀, war chief of the Oba of Benin', wants: { palmoil: 7, salt: 10, fish: 3 }, offers: { weapons: 18, iron: 8 },
      at: [0.76, 0.56], color: '#b8860b', garrison: { edo: 9, bowman: 5 },
      loot: { iron: 40, weapons: 10, cowries: 240 }, tribute: { cowries: 18 }, joiners: 4,
      desc: 'An outpost of the great Benin Kingdom on the lagoon. The Edo call this whole country "Eko" — the war camp.',
    },
    {
      id: 'ilaje', name: 'Ìlàjẹ fishing village', people: 'Ilaje', strength: 1, temperament: 'friendly', major: false,
      leader: 'Olú Ẹ̀bìkẹ́ of the Ìlàjẹ', wants: { yam: 3, wood: 3 }, offers: { fish: 3 },
      at: [0.96, 0.64], color: '#2a7f9e', garrison: { warrior: 3 }, huts: 4,
      loot: { fish: 60, cowries: 40 }, tribute: { fish: 6 }, joiners: 3,
      desc: 'A small, peaceful fishing village at the eastern end of the lagoon.',
    },
    {
      id: 'bandits1', name: 'Forest bandits', people: 'Bandits', strength: 1, temperament: 'bandit', major: false,
      at: [0.19, 0.45], color: '#3b3b3b', garrison: { bandit: 4 }, huts: 3, style: 'camp', firstRaid: 200,
      loot: { cowries: 60, meat: 30, wood: 30 }, joiners: 0,
      desc: 'Outcasts who live by robbing farms.',
    },
    {
      id: 'bandits2', name: 'Savanna raiders', people: 'Bandits', strength: 1, temperament: 'bandit', major: false,
      at: [0.64, 0.28], color: '#3b3b3b', garrison: { bandit: 4, bowman: 1 }, huts: 3, style: 'camp', firstRaid: 420,
      loot: { cowries: 90, weapons: 4 }, joiners: 0,
      desc: 'Raiders who prey on the trade paths.',
    },
  ],

  pois: [
    { kind: 'farm', at: [0.33, 0.47], name: 'an abandoned farmstead', text: 'Old yam barns, still full.', reward: { yam: 40 } },
    { kind: 'grove', at: [0.56, 0.43], name: 'a sacred grove', text: 'The elders bless the grove of the òrìṣà. Your people are heartened.', reward: { happy: 4 } },
    { kind: 'iron', at: [0.6, 0.16], name: 'old iron workings', text: 'Slag heaps and clay furnaces: iron ore lies here. Build an iron mine in the Town era.', reward: { iron: 25, reveal: 6 }, revealsIron: true },
    { kind: 'wreck', at: [0.36, 0.855], name: 'a shipwreck on the beach', water: true, text: 'A broken foreign hull. You salvage cowries and blades.', reward: { cowries: 90, weapons: 6 } },
    { kind: 'hunters', at: [0.14, 0.3], name: "a hunters' camp", text: 'Ọdẹ hunters share their meat and agree to join you.', reward: { meat: 25, strangers: 3 } },
    { kind: 'shrine', at: [0.56, 0.725], name: 'the shrine of Olókun', water: true, text: 'The sea god’s shrine on the island. Your people rejoice.', reward: { happy: 6, cowries: 40 } },
    { kind: 'cache', at: [0.86, 0.2], name: 'a kola-nut cache', text: 'A trader’s hidden kola nuts, worth a fortune.', reward: { cowries: 80 } },
  ],

  events: [
    {
      id: 'intro',
      title: 'Ẹ káàbọ̀ — the land by the lagoon',
      art: '🌅',
      text: (st) =>
        `${st.founder} and ${st.spouse} have walked south from Ìsẹ́rí with a hoe, a cutlass and a basket of seed yams. Here, where the forest meets the great lagoon, the soil is dark and the fish are plenty.\n\nThey have raised a compound, and laid a floor of mud bricks in front of it where everything they gather will be stacked. Red mud for bricks lies a short walk away, and the trees give wood. Every house, floor and fence is built from the two.\n\nFor now it is just the two of them. One day this could be the greatest city in Africa — and what it becomes is up to you.`,
      choices: [{ label: 'Begin', hint: 'Someone is already coming up the path.' }],
    },
    {
      id: 'wanderers',
      silent: true,
      when: (st) => !!st.flags.opening && st.time.t >= 5,
      apply: (st, api) => {
        const a = api.wanderer({ female: true, calling: 'brickyard', guest: true, near: true, quiet: true });
        const b = api.wanderer({ female: false, calling: 'woodcutter', guest: true, near: true, quiet: true });
        st.flags.wanderers = [a, b].filter(Boolean).map((c) => c.id);
        st.flags.wanderersT = st.time.t;
        if (a || b) api.notify('🚶 Two travellers are coming up the path towards your compound.', 'good', a || b);
      },
    },
    {
      id: 'welcome',
      when: (st) => !!st.flags.wanderers?.length && (guests(st).every((c) => c.state === 'wait') || st.time.t - st.flags.wanderersT > 40),
      title: 'Strangers at the gate',
      art: '👋',
      text: (st) => {
        const [a, b] = guests(st);
        const who = [a, b].filter(Boolean);
        const intro = who.map((c) => `${c.name}, a ${c.female ? 'woman' : 'man'} of the ${c.people} from ${c.from}`).join(', and ');
        const trades = who.map((c) => `${c.name} ${c.calling === 'brickyard' ? `has moulded mud bricks since ${c.female ? 'she was a girl' : 'he was a boy'}` : 'cuts wood'}`).join('; ');
        return `${who.length === 1 ? 'A traveller has' : 'Two travellers have'} come up the path to your compound: ${intro}. ${trades}.\n\n${st.founder} goes out to meet them. “Welcome, strangers, to our household. My wife and I are building a community here in Eko. Will you join us?”\n\n“Yes,” ${who.length === 1 ? 'comes the answer' : 'they answer together'}. “We will.”`;
      },
      choices: [
        {
          label: 'Welcome them home',
          hint: 'They move into your compound. Build a Brickmaker’s Yard by the red mud and a Woodcutter’s Hut by the trees, and they will go to work.',
          apply: (st, api) => {
            api.welcome(guests(st).map((c) => c.id));
            st.flags.welcomed = true;
          },
        },
      ],
    },
    {
      id: 'hunger',
      when: (st) => !!st.flags.welcomed && !has(st, 'farm') && (st.time.day >= 2 || totalFood(st) < pop(st) * 3),
      title: 'An empty pot',
      art: '🍲',
      text: (st) =>
        `${st.spouse} sets down an empty cooking pot in front of ${st.founder}.\n\n“The yams we carried here are nearly gone,” she says. “We cannot eat bricks and planks. Someone must plant a farm, or this whole household will go hungry.”`,
      choices: [
        {
          label: 'Plant a yam farm',
          hint: 'Build a Yam Farm on good soil. With nobody free, one of your workers will leave their work for it: food comes first.',
          apply: (st) => {
            st.flags.feedFirst = true;
            st.dirty.jobs = true;
          },
        },
      ],
    },
    {
      // The first danger: a wolf out of the bush, once the yard, the woodcutter
      // and the farm have gathered enough for a new hut and food for everyone.
      id: 'wolf',
      silent: true,
      when: (st) => {
        if (!st.flags.welcomed || st.flags.wolfSent) return false;
        // Gathered since the start, not the stock they arrived with: enough
        // wood and bricks for a hut, and a first harvest in.
        const made = st.stats.made;
        const ready = has(st, 'brickyard') && has(st, 'woodcutter') && has(st, 'farm') && made.wood + made.bricks >= 18 && made.yam >= 12;
        const late = st.time.day >= 9 && has(st, 'brickyard');
        return (ready || late) && st.citizens.some((c) => !c.dead && !c.stranger && !c.special && c.job);
      },
      apply: (st, api) => {
        if (api.wolf()) st.flags.wolfSent = true;
        else delete st.fired.wolf;
      },
    },
    {
      id: 'wolf_slain',
      title: 'A fence around us',
      art: '🐺',
      text: (st) => {
        const s = st.story || {};
        const where = s.victimJob === 'brickyard' ? 'at the red-mud pit' : 'while at work';
        return `${s.victimName || 'One of your people'} is dead, taken by the wolf ${where}. ${s.heroName || 'Another'} stood ${his(s.heroFemale)} ground and killed the beast${s.heroTool ? ` with ${his(s.heroFemale)} ${s.heroTool}` : ''}.\n\nThat night ${st.founder} sits by the fire with ${st.spouse}. “We have lost one of our own,” he says. “There are wolves in this bush, and worse than wolves. We must build a fence around us to protect ourselves.”`;
      },
      choices: [
        {
          label: 'Build a fence',
          hint: 'Every section of wooden fence needs wood. Put more hands to woodcutting.',
          apply: (st) => {
            st.flags.needFence = true;
            st.flags.wanderer3At = st.time.t + 10;
          },
        },
      ],
    },
    {
      id: 'wanderer3',
      silent: true,
      when: (st) => !!st.flags.needFence && st.time.t >= st.flags.wanderer3At,
      apply: (st, api) => {
        const c = api.wanderer({ female: false, calling: 'woodcutter', near: true, quiet: true });
        if (c) api.notify(`👋 ${c.name}, a man of the ${c.people} from ${c.from}, heard of your household and has come to join you. He cuts wood.`, 'good', c);
      },
    },
    {
      // If the player never finishes the fence, the town still opens up.
      id: 'opening_end',
      silent: true,
      when: (st) => !!st.flags.opening && !st.flags.openingDone && st.time.day >= 30,
      apply: (st, api) => finishOpening(st, api),
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
          hint: 'Keeps the peace for now. They will ask again.',
          can: (st) => st.res.cowries >= 60,
          apply: (st, api) => {
            st.res.cowries -= 60;
            st.factionMap.edo.relation += 18;
            api.schedule('benin_again', 30);
            api.notify('🎁 The envoy accepts your gifts and paddles away.', 'info');
          },
        },
        {
          label: 'Èkó bows to no one!',
          hint: 'War with the Edo War Camp. They are mighty.',
          apply: (st, api) => {
            api.war('edo');
            api.mood('Defiance', 4, 4);
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
          },
        },
        { label: 'Refuse', hint: 'War with the Edo War Camp.', apply: (st, api) => api.war('edo') },
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
  ],

  objectives: [
    { id: 'yard', text: 'Build a Brickmaker’s Yard', hint: 'Put it beside the red-mud pit near home (Industry tab). A newcomer will dig the mud and mould it into bricks, which are stacked on your storage floor.', when: (st) => !!st.flags.welcomed, done: (st) => has(st, 'brickyard') },
    { id: 'wood', text: 'Build a Woodcutter’s Hut', hint: 'At the edge of the trees. Logs are split into planks and stacked on your storage floor. Every building needs wood and mud bricks.', when: (st) => !!st.flags.welcomed, done: (st) => has(st, 'woodcutter') },
    { id: 'farm', text: 'Plant a yam farm', hint: 'The yams you brought will not last. With nobody free, one of your workers will leave their work for the farm: food comes first.', when: (st) => !!st.flags.welcomed && (st.fired.hunger !== undefined || st.time.day >= 1), done: (st) => has(st, 'farm'), reward: { yam: 6 } },
    { id: 'wood2', text: 'Build a second Woodcutter’s Hut', hint: 'A fence takes a lot of wood. With two huts, two people can cut it.', when: (st) => !!st.flags.needFence, done: (st) => count(st, 'woodcutter') >= 2 },
    { id: 'fence', text: 'Fence in your home', hint: 'Choose the Wooden Fence (Defence tab) and drag it all the way around your compound with no gaps. Add a Town Gate so your people can get out to work. Each section needs 3 wood.', when: (st) => !!st.flags.needFence, done: (st) => fenced(st), then: (st, api) => finishOpening(st, api), reward: { yam: 10 } },
    { id: 'floor', text: 'Expand your storage floor', hint: 'Build another Storage Floor beside the first (Industry tab), so there is room to stack more.', when: (st) => !!st.flags.welcomed, done: (st) => count(st, 'stockpile') >= 2 },
    { id: 'hut', text: 'Build a hut', hint: 'Gather 8 wood and 10 mud bricks for a home of its own: newcomers need somewhere to sleep.', when: (st) => !!st.flags.welcomed, done: (st) => has(st, 'hut') },
    { id: 'food2', text: 'Add fish or meat to the diet', hint: 'Build a Fishing Jetty by the water or a Hunter’s Lodge near the forest.', when: (st) => !!st.flags.welcomed, done: (st) => has(st, 'fisher') || has(st, 'hunter') },
    { id: 'pop8', text: 'Grow to 8 people', hint: 'Keep people fed and happy and more will come. Build huts for them.', when: (st) => !!st.flags.openingDone, done: (st) => pop(st) >= 8 },
    { id: 'army', text: 'Raise 3 fighters', hint: 'Hire fighters at your compound for money, or build a Training Ground and train your own people (cheaper, but it costs money to build).', when: (st) => !!st.flags.openingDone, done: (st) => st.units.filter((u) => u.owner === 'player' && u.type !== 'scout' && !u.dead).length >= 3 },
    { id: 'scout', text: 'Explore the land with a scout', hint: 'Select your compound and train a scout. Then tap the map to send them.', when: (st) => !!st.flags.openingDone, done: (st) => st.stats.explored >= 1800, reward: { cowries: 20 } },
    { id: 'era1', text: 'Advance to the Compound age', hint: 'Open the Era panel (🌅) at the top.', when: (st) => !!st.flags.openingDone, done: (st) => st.era >= 1, reward: { cowries: 30 } },
    { id: 'store', text: 'Build a Storehouse and a Granary', hint: 'Room beyond the storage floors, and shorter walks for your workers.', when: (st) => st.era >= 1, done: (st) => has(st, 'storehouse') && has(st, 'granary') },
    { id: 'mudwall', text: 'Rebuild part of your fence as a mud wall', hint: 'Pull down a few fence sections (🔨 Pull down) and build a Mud Wall in their place. Mud walls are far tougher.', when: (st) => st.era >= 1, done: (st) => count(st, 'stonewall') >= 4 },
    { id: 'upgrade', text: 'Upgrade a hut into a mud-brick house', hint: 'Select a hut and tap Upgrade. More people fit in.', done: (st) => st.buildings.some((b) => b.type === 'hut' && (b.level || 1) >= 2 && !b.dead) },
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
  ],
};
