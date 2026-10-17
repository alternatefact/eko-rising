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
// A guided story, one step at a time (see sim/story.js): the couple settle in
// an abandoned house; the founder fells the first tree; strangers come and a
// wood shed goes up; antelope and a hunter; a plank house and a farm; wolves;
// a fence between the trees; bandits and a guard house; the red-mud pit and
// the kingdom rebuilt in mud.

const founderOf = (st) => st.citizens.find((c) => c.special === 'founder' && !c.dead);
const spouseOf = (st) => st.citizens.find((c) => c.special === 'spouse' && !c.dead);
const guests = (st) => (st.flags.wanderers || []).map((id) => st.byId.get(id)).filter((c) => c && !c.dead);
const his = (female) => (female ? 'her' : 'his');
const building = (st, type) => st.buildings.find((b) => b.type === type && b.owner === 'player' && !b.dead);
const workersOf = (st, type) => st.citizens.filter((c) => !c.dead && st.byId.get(c.job)?.type === type);
const names = (list) => list.map((c) => c.name).join(' and ');
// Bricks the kingdom upgrade needs for everything standing now.
const mudCost = (st) => st.buildings.reduce((n, b) => n + (b.owner === 'player' && !b.dead && b.built >= 1 && !b.mud ? BUILDINGS[b.type].mudBricks || 0 : 0), 0);
const near = (c, x, y, r) => c && Math.hypot(c.x - x, c.y - y) <= r;
const homeAt = (st) => {
  const h = building(st, 'compound');
  return h ? { x: h.x + 1.5, y: h.y + 1.5 } : { x: st.start.x + 0.5, y: st.start.y + 0.5 };
};

// The standing tree nearest the house that someone can get to.
function treeNearHome(st) {
  const p = homeAt(st);
  let best = -1;
  let bestD = Infinity;
  for (let dy = -12; dy <= 12; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      const x = Math.floor(p.x) + dx;
      const y = Math.floor(p.y) + dy;
      if (x < 0 || y < 0 || x >= st.W || y >= st.H) continue;
      const i = y * st.W + x;
      if (!(st.trees[i] > 0) || st.felled[i] || st.occ[i]) continue;
      const d = Math.hypot(dx, dy);
      if (d < bestD && st.explored[i]) {
        bestD = d;
        best = i;
      }
    }
  }
  return best < 0 ? null : { x: (best % st.W) + 0.5, y: Math.floor(best / st.W) + 0.5, tree: true };
}

// Is the home closed in? A walk outward from the compound must not get far:
// fences, gates, standing trees and water stop it. It must take in the
// storage floor, have room inside, and a gate to get out by.
export function fenceState(st) {
  const home = building(st, 'compound');
  if (!home) return { closed: false };
  const cx = home.x + 1;
  const cy = home.y + 1;
  const W = st.W;
  const seen = new Uint8Array(W * st.H);
  const queue = [cy * W + cx];
  seen[queue[0]] = 1;
  let gate = false;
  let sections = 0;
  const walls = new Set();
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    const x = i % W;
    const y = (i / W) | 0;
    if (x <= 0 || y <= 0 || x >= W - 1 || y >= st.H - 1 || Math.max(Math.abs(x - cx), Math.abs(y - cy)) > 24 || queue.length > 2500) return { closed: false };
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      if (seen[j]) continue;
      const b = st.byId.get(st.occ[j]);
      if (b && !b.dead && b.owner === 'player' && (b.wall || b.gate) && b.built >= 1) {
        if (b.gate) gate = true;
        else if (!walls.has(b.id)) {
          walls.add(b.id);
          sections++;
        }
        continue;
      }
      seen[j] = 1;
      const t = st.terrain[j];
      if (t === 0 || t === 1 || t === 2) continue; // ocean, lagoon, river
      if (st.trees[j] > 0 && !st.felled[j]) continue; // standing trees
      queue.push(j);
    }
  }
  const floor = building(st, 'stockpile');
  const floorIn = !floor || seen[floor.y * W + floor.x];
  return { closed: true, area: queue.length, gate, sections, floorIn };
}

export function fenced(st) {
  const f = fenceState(st);
  return f.closed && f.gate && f.area >= 40 && f.floorIn;
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
      story: true,
      title: 'Ẹ káàbọ̀ — the land by the lagoon',
      art: '🌅',
      text: (st) =>
        `${st.founder} and ${st.spouse} have walked for days, south from Ìsẹ́rí, with a cutlass, a hoe and a basket of seed yams. Where the forest meets the great lagoon they find a house standing alone in a clearing: empty, its owners long gone.\n\n“Let’s settle in the abandoned house,” says ${st.founder}. “Let’s build a community here.”\n\nThe forest all around is a wall, and the trees are all the wood you need. One day this could be the greatest city in Africa — and what it becomes is up to you.`,
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

  // The guided opening, one step at a time (see sim/story.js). `who` is
  // whose face shows: 'founder', 'spouse' or 'guide'.
  story: [
    {
      id: 'arrive',
      enter: (st, api) => api.queue('intro'),
      who: 'founder',
      say: (st) => `“Let’s settle in this abandoned house, ${st.spouse}. Let’s build a community here.”`,
      task: 'Watch them walk up to the house',
      hint: 'Drag the map to look around. Scroll or pinch to zoom.',
      point: (st) => founderOf(st) && { id: founderOf(st).id },
      min: 3,
      done: (st) => founderOf(st)?.state !== 'movein',
    },
    {
      id: 'select',
      who: 'guide',
      say: (st) => `Everything here starts with wood, and wood starts with a tree. ${st.founder} will cut the first one himself.`,
      task: (st) => `Click ${st.founder} to select him`,
      hint: 'He wears the blue wrapper. The arrow shows where he is.',
      point: (st) => founderOf(st) && { id: founderOf(st).id },
      done: (st) => st.tut.sig.select === founderOf(st)?.id || founderOf(st)?.task?.kind === 'chop',
    },
    {
      id: 'chop',
      who: 'founder',
      say: '“That tree will give us our first planks.”',
      task: (st) => `With ${st.founder} selected, click a tree near the house`,
      hint: 'A rainforest tree gives 12 planks, a savanna or shade tree 8, a mangrove 6. He fells it, then cuts it into planks where it lies.',
      point: (st) => treeNearHome(st),
      done: (st) => founderOf(st)?.task?.kind === 'chop',
    },
    {
      id: 'planks',
      who: 'guide',
      say: (st) => `${st.founder} is felling the tree. When it is down he cuts it into planks where it lies, and carries them home, four at a time.`,
      task: 'Watch him bring the first planks to the storage floor',
      hint: 'The storage floor is the swept ground in front of the house. Everything your people bring home is stacked there.',
      point: (st) => founderOf(st) && { id: founderOf(st).id },
      done: (st) => st.stats.made.wood >= 4,
    },
    {
      id: 'stack',
      who: 'guide',
      say: 'There: planks stacked on the storage floor. He goes back to the same tree until it is used up, then on to the next nearest.',
      task: 'Gather 12 planks',
      hint: (st) => `Planks so far: ${Math.floor(st.res.wood)}. Tap a tree any time to see how many planks are left in it.`,
      point: (st) => building(st, 'stockpile') && { id: building(st, 'stockpile').id },
      done: (st) => st.res.wood >= 12,
    },
    {
      id: 'strangers',
      focus: true,
      enter: (st, api) => {
        const a = api.wanderer({ female: false, calling: 'woodcutter', guest: true, near: true, quiet: true });
        const b = api.wanderer({ female: true, calling: 'woodcutter', guest: true, near: true, quiet: true });
        st.flags.wanderers = [a, b].filter(Boolean).map((c) => c.id);
        if (a || b) api.notify('🚶 Two travellers are coming up the path.', 'good', a || b);
      },
      who: 'spouse',
      say: (st) => `“${st.founder}, look: two people are coming up the path.”`,
      task: 'Wait for the travellers to reach the house',
      point: (st) => guests(st)[0] && { id: guests(st)[0].id },
      done: (st, api) => {
        if (!guests(st).length || guests(st).every((c) => c.state === 'wait') || st.time.t - st.tut.t > 45) {
          if (!st.flags.welcomeAsked) {
            st.flags.welcomeAsked = true;
            api.queue('welcome');
          }
          return st.flags.welcomed;
        }
        return false;
      },
    },
    {
      id: 'woodshed',
      who: 'founder',
      say: '“The house sleeps five: the two of us and three more. We need no new house yet. What we need is wood.”',
      task: 'Build a Wood Shed by the forest',
      hint: 'Open 🔨 Build → Industry and pick the Wood Shed (6 planks). Place it near the trees: its woodcutters fell the trees closest to the shed first, then the next nearest.',
      point: () => ({ build: 'woodcutter' }),
      done: (st) => !!building(st, 'woodcutter') && building(st, 'woodcutter').built >= 1,
    },
    {
      id: 'cutters',
      enter: (st) => (st.tut.wood0 = st.stats.made.wood),
      who: 'guide',
      say: (st) => {
        const w = workersOf(st, 'woodcutter')[0];
        const idle = guests(st).concat(st.citizens.filter((c) => (st.flags.wanderers || []).includes(c.id))).find((c) => c && !c.dead && !c.job);
        return `${w ? w.name : 'One of them'} has taken up the axe at the shed${idle ? `; ${idle.name} sits by the fire, because a wood shed takes one pair of hands` : ''}. Every tree cleared opens more ground to build on — and, one day, the way through the forest to other peoples.`;
      },
      task: 'Let the woodcutter bring in 8 planks',
      hint: (st) => `Brought in so far: ${Math.max(0, Math.floor(st.stats.made.wood - (st.tut.wood0 || 0)))} of 8. Tap the woodcutter to follow what he is doing.`,
      point: (st) => building(st, 'woodcutter') && { id: building(st, 'woodcutter').id },
      min: 15,
      done: (st) => st.stats.made.wood - (st.tut.wood0 || 0) >= 8,
    },
    {
      id: 'antelope',
      focus: true,
      enter: (st, api) => {
        const herd = api.herd(3);
        st.flags.herd = herd.map((a) => a.id);
      },
      who: 'spouse',
      say: (st) => `“${st.founder}, the yams we carried are nearly gone. But look — antelope are grazing just past the house. A hunter could feed us.”`,
      task: 'Build a Hunter’s Shed near the antelope',
      hint: '🔨 Build → Food → Hunter’s Shed (8 planks). Whoever sits by the fire will take it on, change into hunting clothes and take up the bow.',
      point: (st) => {
        const a = (st.flags.herd || []).map((id) => st.byId.get(id)).find((x) => x && !x.dead);
        return building(st, 'hunter') ? { id: building(st, 'hunter').id } : a ? { id: a.id } : { build: 'hunter' };
      },
      done: (st) => !!building(st, 'hunter') && building(st, 'hunter').built >= 1,
      exit: (st, api) => {
        // Nobody free? Then the woodcutter goes: food comes first.
        const shed = building(st, 'hunter');
        if (shed && !shed.workers.length && !st.citizens.some((c) => !c.dead && !c.special && !c.job && !c.stranger)) {
          const c = api.reassign('woodcutter', shed);
          if (c) api.notify(`🏹 ${c.name} puts down the axe, changes into hunting clothes and takes up the bow.`, 'good', c);
        }
      },
    },
    {
      id: 'hunt',
      who: 'guide',
      say: (st) => {
        const h = workersOf(st, 'hunter')[0];
        return `${h ? h.name : 'The hunter'} stalks the herd and shoots. The kill is carried home on the shoulders, butchered at the shed, and the meat goes to the storage floor. An antelope gives 10 meat, a bush pig 8.`;
      },
      task: 'Bring home the first meat',
      point: (st) => workersOf(st, 'hunter')[0] && { id: workersOf(st, 'hunter')[0].id },
      done: (st) => st.stats.made.meat >= 5,
    },
    {
      id: 'fire',
      enter: (st, api) => {
        const a = api.wanderer({ near: true, quiet: true });
        const b = api.wanderer({ near: true, quiet: true, female: !a?.female });
        st.flags.firePair = [a, b].filter(Boolean).map((c) => c.id);
        if (a || b) api.notify(`👋 ${names([a, b].filter(Boolean))} have come to join you. They sit by the fire: there is no work for them yet.`, 'good', a || b);
      },
      who: 'spouse',
      say: '“Two more have come. They are sitting by the fire with nothing to do — and the house is full.”',
      task: 'Build a Plank House',
      hint: '🔨 Build → Homes → Plank House (10 planks). It sleeps two. Mud bricks come later: for now we build in wood.',
      point: () => ({ build: 'hut' }),
      done: (st) => st.buildings.some((b) => b.type === 'hut' && b.owner === 'player' && !b.dead && b.built >= 1),
    },
    {
      id: 'farm',
      who: 'founder',
      say: '“Meat alone will not keep us. Let us clear ground and plant yams.”',
      task: 'Plant a Yam Farm',
      hint: '🔨 Build → Food → Yam Farm (5 planks), on open ground. The two by the fire will go and work it. Each workplace takes its own hands: when nobody at the fire is free, tap a worker and then the place you want them.',
      point: () => ({ build: 'farm' }),
      done: (st) => !!building(st, 'farm') && building(st, 'farm').built >= 1,
    },
    {
      id: 'farming',
      who: 'guide',
      say: (st) => {
        const f = workersOf(st, 'farm');
        return `${f.length ? names(f) : 'The farmers'} heap the earth into mounds and plant the seed yams. Yams grow fastest in the rains, slowest in the Harmattan.`;
      },
      task: 'Let the farmers get to work',
      point: (st) => building(st, 'farm') && { id: building(st, 'farm').id },
      min: 25,
      done: (st) => workersOf(st, 'farm').some((c) => c.state === 'farm'),
    },
    {
      id: 'wolves',
      focus: true,
      enter: (st, api) => {
        st.flags.packSent = !!api.pack(4);
      },
      who: 'spouse',
      say: (st) => `“Wolves! ${st.founder}, get inside!”`,
      task: 'Wolves are attacking!',
      hint: 'There is nothing to do but watch. The woodcutter has his axe, and the hunter his bow.',
      point: (st) => {
        const w = st.animals.find((a) => a.type === 'wolf' && !a.dead && !a.carcass);
        return w && { id: w.id };
      },
      done: (st, api) => {
        if (!st.flags.packSent) st.flags.packSent = !!api.pack(4);
        return !!st.flags.wolvesSlain && st.flags.needFence;
      },
    },
    {
      id: 'fence',
      who: 'founder',
      say: '“The forest is a wall no wolf gets through. We close the gaps between the trees with a fence, and leave a gate.”',
      task: 'Fence in your home, with a gate',
      hint: (st) => {
        const f = fenceState(st);
        const state = !f.closed ? 'Not closed yet: there is still a way out between the trees.' : !f.gate ? 'Closed in! Now put a Gate in the fence so your people can get out.' : !f.floorIn ? 'The storage floor is outside the fence.' : f.area < 40 ? 'Too small: fence in more ground.' : '';
        return `🔨 Build → Defence → Wooden Fence (2 planks a section): drag it from tree to tree, or down to the water. ${state} Short of wood? Tap the hunter, then the Wood Shed, to make him a woodcutter — or build a second shed. Tap a woodcutter and then a tree to choose where he cuts.`;
      },
      point: (st) => (fenceState(st).closed && !fenceState(st).gate ? { build: 'gate' } : { build: 'palisade' }),
      done: (st) => fenced(st),
    },
    {
      id: 'settle',
      enter: (st, api) => {
        api.queue('settled');
        // Newcomers to take the places of the dead.
        const lost = (st.story?.victims || []).length || 2;
        const come = [];
        for (let k = 0; k < lost; k++) {
          const c = api.wanderer({ near: true, quiet: true, calling: 'farm' });
          if (c) come.push(c);
        }
        if (come.length) api.notify(`👋 ${names(come)} heard there is a safe place by the lagoon, and have come to take the places of those we lost.`, 'good', come[0]);
      },
      who: 'spouse',
      say: '“New people are arriving at the fire. Let us put them to work: the more hands, the faster we grow.”',
      task: 'Grow to 9 people',
      hint: 'Newcomers come while everyone is fed and happy and there are beds. Each new Plank House brings two. Put people to work: a new workplace takes whoever is at the fire.',
      point: (st) => building(st, 'campfire') && { id: building(st, 'campfire').id },
      done: (st) => pop(st) >= 9 || (st.time.t - st.tut.t > 24 * 8 && pop(st) >= 6),
    },
    {
      id: 'bandits',
      focus: true,
      enter: (st, api) => {
        st.story = { ...(st.story || {}), raidDead: [], stolen: {} };
        const ids = api.raid('bandits1', ['bandit', 'bandit', 'bandit', 'bandit'], { steal: true, patience: 110, label: 'bandit raid', onDefeat: 'bandits_gone' });
        st.flags.raidSent = ids.length > 0;
        if (ids.length) api.notify('🏴 Bandits are coming out of the forest along the path!', 'war', st.byId.get(ids[0]));
      },
      who: 'founder',
      say: '“Bandits! Everyone inside!”',
      task: 'Bandits are raiding the settlement',
      hint: 'Your people run indoors. Watch what the bandits do.',
      point: (st) => {
        const u = st.units.find((x) => x.owner === 'bandits1' && !x.dead && x.order?.t !== 'guard');
        return u && { id: u.id };
      },
      done: (st) => !!st.flags.raided || !st.flags.raidSent,
    },
    {
      id: 'recover',
      who: 'founder',
      say: '“First we fill the stores again. Then we build a guard house.”',
      task: 'Refill the stores: 30 food and 40 planks',
      hint: (st) => `Food ${Math.floor(totalFood(st))} of 30, planks ${Math.floor(st.res.wood)} of 40. A second farm or wood shed helps. If the storage floor is full, build another beside it (Industry).`,
      done: (st) => totalFood(st) >= 30 && st.res.wood >= 40,
    },
    {
      id: 'guardhouse',
      who: 'founder',
      say: '“A guard house, where our own men train and live.”',
      task: 'Build a Guard House',
      hint: '🔨 Build → Defence → Guard House (40 planks).',
      point: () => ({ build: 'warcamp' }),
      done: (st) => !!building(st, 'warcamp') && building(st, 'warcamp').built >= 1,
    },
    {
      id: 'soldiers',
      who: 'guide',
      say: 'Spearmen are trained from people sitting by the fire. If nobody is free, a volunteer walks in from the villages around.',
      task: 'Train 5 spearmen',
      hint: (st) => `Select the Guard House and press Train. Each spearman costs 6 planks and 8 food. Spearmen: ${st.units.filter((u) => u.owner === 'player' && u.type === 'spearman' && !u.dead).length} of 5.`,
      point: (st) => building(st, 'warcamp') && { id: building(st, 'warcamp').id },
      done: (st) => st.units.filter((u) => u.owner === 'player' && u.type === 'spearman' && !u.dead).length >= 5,
    },
    {
      id: 'camp',
      focus: true,
      enter: (st, api) => {
        const f = st.factionMap.bandits1;
        if (f) api.reveal(f.x, f.y, 4);
      },
      who: 'founder',
      say: '“Their camp is in the far corner of the forest. Four of them. Go and clear it.”',
      task: 'Clear the bandit camp',
      hint: 'Press 🛡️ Army at the top to select your soldiers, then tap the bandit camp to attack it.',
      point: (st) => st.factionMap.bandits1 && { x: st.factionMap.bandits1.x + 0.5, y: st.factionMap.bandits1.y + 0.5 },
      done: (st) => !st.factionMap.bandits1 || st.factionMap.bandits1.status === 'conquered',
    },
    {
      id: 'mudpit',
      focus: true,
      who: 'founder',
      say: (st) => `“On our way here we passed a pit of red mud. With mud we can make bricks, and build houses no bandit can burn so easily. Let me go and find it again.”`,
      task: (st) => `Click ${st.founder}, then click the marked place to send him there`,
      hint: 'It is off along the path you came in by. With him selected, tap anywhere on the ground to send him there.',
      point: (st) => st.mudPit && { x: st.mudPit.x + 0.5, y: st.mudPit.y + 0.5 },
      done: (st, api) => {
        const f = founderOf(st);
        if (!st.mudPit || near(f, st.mudPit.x + 0.5, st.mudPit.y + 0.5, 3.5)) {
          if (st.mudPit) api.reveal(st.mudPit.x, st.mudPit.y, 4);
          return true;
        }
        return false;
      },
    },
    {
      id: 'brickshed',
      focus: true,
      who: 'founder',
      say: '“Here it is: red mud, as much as we will ever need.”',
      task: 'Build a Mud Brick Shed beside the red mud',
      hint: '🔨 Build → Industry → Mud Brick Shed (8 planks). The shed itself is wood; its workers dig the mud, press it into moulds and dry the bricks in the sun.',
      point: (st) => (building(st, 'brickyard') ? { id: building(st, 'brickyard').id } : { build: 'brickyard' }),
      done: (st) => !!building(st, 'brickyard') && building(st, 'brickyard').built >= 1,
    },
    {
      id: 'bricks',
      who: 'guide',
      say: 'With enough mud bricks, every house and shed can be rebuilt in mud at once: the kingdom upgrade.',
      task: (st) => `Make ${mudCost(st)} mud bricks`,
      hint: (st) => `Bricks: ${Math.floor(st.res.bricks)} of ${mudCost(st)}. Two people can work the brick shed. If the storage floor fills up, build another beside it.`,
      point: (st) => building(st, 'brickyard') && { id: building(st, 'brickyard').id },
      done: (st) => st.res.bricks >= mudCost(st),
    },
    {
      id: 'upgrade',
      who: 'founder',
      say: '“Enough bricks. Let us rebuild everything in mud.”',
      task: 'Press 🧱 Kingdom upgrade at the top',
      hint: 'Every house and shed is rebuilt in red mud at once: tougher, and each house sleeps four instead of two.',
      point: () => ({ ui: '#mud-btn' }),
      done: (st) => !!st.flags.mud,
    },
    {
      id: 'end',
      enter: (st, api) => api.queue('chapter_one'),
      who: 'spouse',
      say: '“When we came, there was nothing here but trees.”',
      task: 'The opening is complete',
      done: () => true,
    },
  ],

  objectives: [
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
  ],
};
