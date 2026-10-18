// Chapter two: Ogun State, opened by breaking the host of Benin in Lagos.
// Inland country: the Ogun and Yewa rivers running south through forest,
// savanna in the north, and the granite hills round Olúmọ Rock where the
// Ẹ̀gbá built Abẹ́òkúta. There is no guided start here: the founders come
// north with a band of settlers and spearmen and choose for themselves.

const has = (st, type) => st.buildings.some((b) => b.type === type && b.owner === 'player' && b.built >= 1 && !b.dead);
const pop = (st) => st.citizens.filter((c) => !c.stranger && !c.dead).length + st.units.filter((u) => u.owner === 'player' && !u.dead).length;
const unifiedCount = (st) => st.factions.filter((f) => f.major && ['allied', 'vassal', 'conquered'].includes(f.status)).length;
const majorCount = (st) => st.factions.filter((f) => f.major).length;
const claimed = (st, kind) => st.pois.some((p) => p.kind === kind && p.claimed);

export const OGUN = {
  id: 'ogun',
  name: 'Ogun',
  yo: 'Ògùn',
  width: 112,
  height: 84,
  defaultName: 'Ìbàrà',

  terrain: {
    // No sea: the land runs off every edge.
    coastY: 2,
    beach: 0,
    creekY: 3,
    creekHalf: 0,
    lagoons: [{ x: 0.36, y: 0.3, rx: 0.05, ry: 0.035 }],
    channels: [],
    islands: [],
    rivers: [
      { from: [0.6, 0], to: [0.54, 1], fordEvery: 9, wide: true },
      { from: [0.13, 0], to: [0.19, 1], fordEvery: 8 },
      { from: [0.36, 0.32], to: [0.56, 0.5], fordEvery: 7 },
    ],
    savanna: 0.36,
    hillLevel: 0.63,
    forestLevel: 0.55,
    ironClusters: 4,
    start: [0.42, 0.64],
  },

  // Who comes north with the founders, and what they carry.
  startKit: {
    era: 1,
    res: { wood: 80, yam: 60, meat: 20, cowries: 200 },
    settlers: 6,
    soldiers: { spearman: 6 },
    buildings: ['warcamp', 'hut', 'hut', 'stockpile'],
  },

  foreign: {},

  factions: [
    {
      id: 'egba', name: 'Ẹ̀gbá of Abẹ́òkúta', people: 'Egba', origin: 'Egba', strength: 5, temperament: 'warlike',
      leader: 'Alákẹ́ of Ẹ̀gbáland, under Olúmọ Rock', wants: { salt: 10, cloth: 14, fish: 4 }, offers: { yam: 3, iron: 8, horses: 70 },
      at: [0.58, 0.17], color: '#8b3a2b', garrison: { warrior: 9, bowman: 6, horseman: 3 },
      loot: { yam: 120, iron: 40, weapons: 12, cowries: 260 }, tribute: { yam: 10, cowries: 16 }, joiners: 7,
      desc: 'The Ẹ̀gbá towns gathered under the shelter of Olúmọ Rock: Abẹ́òkúta, "under the rock". Proud, quick to arms, and the strongest people of the land.',
    },
    {
      id: 'owu', name: 'Ọ̀wu', people: 'Owu', origin: 'Egba', strength: 3, temperament: 'proud',
      leader: 'Olówu of Ọ̀wu', wants: { palmoil: 7, salt: 9 }, offers: { cloth: 12, yam: 3 },
      at: [0.4, 0.07], color: '#7a5a2a', garrison: { warrior: 6, bowman: 3 },
      loot: { cloth: 30, yam: 60, cowries: 140 }, tribute: { cloth: 2, cowries: 9 }, joiners: 5,
      desc: 'An old and famous town of weavers and warriors in the northern savanna.',
    },
    {
      id: 'ijebuode', name: 'Ìjẹ̀bú of Ìjẹ̀bú-Òde', people: 'Ijebu', origin: 'Ijebu', strength: 4, temperament: 'proud',
      leader: 'Awùjalẹ̀ of Ìjẹ̀bú-Òde', wants: { iron: 9, weapons: 20, yam: 3 }, offers: { cloth: 13, palmoil: 6 },
      at: [0.87, 0.64], color: '#6d3fa0', garrison: { warrior: 8, bowman: 5 },
      loot: { cloth: 40, palmoil: 40, cowries: 220 }, tribute: { palmoil: 4, cowries: 14 }, joiners: 6,
      desc: 'Rich traders who hold the roads between the coast and the interior, and do not let strangers pass for free.',
    },
    {
      id: 'remo', name: 'Rẹ́mọ of Ṣágámù', people: 'Remo', origin: 'Ijebu', strength: 2, temperament: 'friendly',
      leader: 'Akárígbò of Rẹ́mọ', wants: { fish: 3, iron: 8 }, offers: { palmoil: 6, garri: 6 },
      at: [0.74, 0.86], color: '#2e8b57', garrison: { warrior: 4, bowman: 2 },
      loot: { palmoil: 40, cowries: 90 }, tribute: { palmoil: 3, cowries: 8 }, joiners: 4,
      desc: 'Kola-nut farmers and traders of the south-east, friendly to newcomers who trade fairly.',
    },
    {
      id: 'yewa', name: 'Yewa of Ìlarò', people: 'Yewa', origin: 'Egun', strength: 2, temperament: 'friendly',
      leader: 'Olú of Ìlarò', wants: { yam: 3, cloth: 13 }, offers: { fish: 3, salt: 8 },
      at: [0.08, 0.72], color: '#c2873a', garrison: { warrior: 4, bowman: 2 },
      loot: { fish: 50, salt: 10, cowries: 80 }, tribute: { fish: 6, cowries: 6 }, joiners: 4,
      desc: 'Farmers and fishers along the Yewa river in the west, on the road to the coast.',
    },
    {
      id: 'bandits_n', name: 'Highway robbers', people: 'Bandits', strength: 1, temperament: 'bandit', major: false,
      at: [0.26, 0.4], color: '#3b3b3b', garrison: { bandit: 5 }, huts: 3, style: 'camp', firstRaid: 260,
      loot: { cowries: 80, cloth: 10 }, joiners: 0,
      desc: 'Robbers who prey on the trade roads.',
    },
    {
      id: 'bandits_e', name: 'Forest raiders', people: 'Bandits', strength: 1, temperament: 'bandit', major: false,
      at: [0.8, 0.32], color: '#3b3b3b', garrison: { bandit: 4, bowman: 1 }, huts: 3, style: 'camp', firstRaid: 480,
      loot: { cowries: 90, weapons: 4 }, joiners: 0,
      desc: 'Raiders who hide in the eastern forest.',
    },
  ],

  pois: [
    { kind: 'olumo', at: [0.63, 0.1], name: 'Olúmọ Rock', text: 'You climb the great granite rock the Ẹ̀gbá sheltered under. From the top you see the whole land, and your people take heart.', reward: { happy: 6, reveal: 12 } },
    { kind: 'dye', at: [0.47, 0.26], name: 'the adire dye pits', text: 'Indigo dye pits, still full. Your people dye cloth in the adire way.', reward: { cloth: 20, cowries: 30 } },
    { kind: 'shrine', at: [0.5, 0.58], name: 'the shrine of Yemọja on the Ogun river', text: 'The river goddess’s shrine. The priests bless your people.', reward: { happy: 5, cowries: 30 } },
    { kind: 'kola', at: [0.84, 0.48], name: 'a kola-nut farm', text: 'Kola trees in rows, the nuts ready to pick. Worth a fortune in the north.', reward: { cowries: 90 } },
    { kind: 'iron', at: [0.3, 0.18], name: 'old iron workings', text: 'Slag heaps and clay furnaces: iron ore lies here. Build an iron mine in the Town era.', reward: { iron: 25, reveal: 6 }, revealsIron: true },
    { kind: 'hunters', at: [0.18, 0.5], name: "a hunters' camp", text: 'Ọdẹ hunters share their meat and agree to join you.', reward: { meat: 25, strangers: 3 } },
    { kind: 'farm', at: [0.34, 0.78], name: 'an abandoned farmstead', text: 'Old yam barns, still full.', reward: { yam: 50 } },
  ],

  events: [
    {
      id: 'ogun_intro',
      story: true,
      title: 'The road north',
      art: '🌄',
      text: (st) =>
        `${st.founder} and ${st.spouse} have come north from the lagoon with settlers and spearmen who stood against Benin. Before them lies Ogun: forest and river, savanna, and the grey granite hills round Olúmọ Rock.\n\nHere there is no one to guide you. Build what you think matters first, find the peoples of the land, and make ${st.name} their equal.`,
      choices: [{ label: 'Let us begin', hint: 'Goals appear at the top left.' }],
    },
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
      when: (st) => has(st, 'market') && st.time.day >= 18,
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
  ],

  story: [],

  objectives: [
    { id: 'scout', text: 'Explore the land with a scout', hint: 'Train a scout at your compound and send it along the paths.', done: (st) => st.stats.explored >= 1800, reward: { cowries: 20 } },
    { id: 'olumo', text: 'Climb Olúmọ Rock', hint: 'It stands in the north, above the Ẹ̀gbá towns. Send a scout or soldier to it.', done: (st) => claimed(st, 'olumo'), reward: { cowries: 40 } },
    { id: 'pop20', text: 'Grow to 20 people', hint: 'Fed, happy people with beds bring newcomers. Each new house brings two.', done: (st) => pop(st) >= 20 },
    { id: 'meetegba', text: 'Meet the Ẹ̀gbá of Abẹ́òkúta', hint: 'Their towns lie under Olúmọ Rock in the north.', done: (st) => !!st.factionMap.egba?.discovered },
    { id: 'tradeagree', text: 'Make a trade agreement', hint: 'Build a market, send gifts, then open trade from the Peoples panel (🤝).', done: (st) => st.factions.some((f) => f.trade || f.status === 'allied') },
    { id: 'subdue1', text: 'Subdue a kingdom', hint: 'Conquer one, or frighten it into paying tribute.', done: (st) => st.factions.some((f) => f.temperament !== 'bandit' && (f.status === 'conquered' || f.status === 'vassal')) },
    { id: 'unite', text: 'Unite every people of Ogun', hint: 'Five peoples share this land: ally with them, or rule them.', done: (st) => unifiedCount(st) >= majorCount(st) },
  ],
};
