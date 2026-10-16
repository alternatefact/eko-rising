// Every structure the player can raise. Placement rules:
//   land    any dry, explored tile inside your territory
//   fertile grassland, savanna or rainforest (forest is cleared, slash-and-burn)
//   shore   dry footprint touching lagoon, river or sea
//   rock / iron / palm   needs that resource within `near` tiles
// Job types drive the worker state machines in sim/citizens.js.

export const CATEGORIES = [
  { id: 'housing', name: 'Homes', icon: '🛖' },
  { id: 'food', name: 'Food', icon: '🍠' },
  { id: 'industry', name: 'Industry', icon: '🪓' },
  { id: 'town', name: 'Town', icon: '🏛️' },
  { id: 'military', name: 'Defence', icon: '🛡️' },
];

export const BUILDINGS = {
  compound: {
    name: "Founder's Compound", yo: 'Ilé Baálé', cat: 'town', era: 0, w: 3, h: 3,
    cost: {}, hp: 1200, housing: 4, storage: { food: 60, goods: 60 }, influence: 9,
    unique: true, buildable: false, trains: ['scout', 'spearman'], tower: { range: 5.5, dmg: 5, cd: 1.5 },
    desc: 'Where it all began. Stores a little of everything, houses your family, and trains scouts and spearmen. Your family shoots at raiders from the walls. If it falls, your story ends.',
  },
  campfire: {
    name: 'Strangers’ Campfire', yo: 'Iná Àlejò', cat: 'town', era: 0, w: 2, h: 2,
    cost: {}, hp: 9999, buildable: false, invulnerable: true,
    desc: 'Newcomers wait here for a home. Build huts and they will move in and take up work.',
  },
  hut: {
    name: 'Hut', yo: 'Ahéré', cat: 'housing', era: 0, w: 2, h: 2,
    cost: { wood: 10 }, hp: 90, housing: 4, place: 'land',
    desc: 'A mud-walled hut with a thatch roof. Four strangers can move in and start working.',
  },
  farm: {
    name: 'Yam Farm', yo: 'Oko Iṣu', cat: 'food', era: 0, w: 3, h: 3,
    cost: { wood: 6 }, hp: 60, workers: 1, place: 'fertile', flat: true,
    job: { type: 'farm', grow: 38, yield: 12, product: 'yam' },
    desc: 'Mounds of yam. Grows fastest in the rainy season, slowest in the Harmattan. Needs fertile land.',
  },
  woodcutter: {
    name: "Woodcutter's Camp", yo: 'Agégi', cat: 'industry', era: 0, w: 2, h: 2,
    cost: { wood: 4 }, hp: 70, workers: 1, place: 'land', needs: 'tree',
    job: { type: 'gather', source: 'tree', radius: 12, work: 6, yield: 5, process: 2, product: 'wood' },
    desc: 'Fells trees nearby. Build it at the forest edge, close to a storehouse.',
  },
  hunter: {
    name: "Hunter's Lodge", yo: 'Ilé Ọdẹ', cat: 'food', era: 0, w: 2, h: 2,
    cost: { wood: 8 }, hp: 70, workers: 1, place: 'land',
    job: { type: 'hunt', radius: 18, work: 2, yield: 8, process: 2, product: 'meat' },
    desc: 'A hunter stalks antelope and bush pig in the forest and savanna.',
  },
  fisher: {
    name: 'Fishing Jetty', yo: 'Èbúté Apẹja', cat: 'food', era: 0, w: 2, h: 2,
    cost: { wood: 10 }, hp: 70, workers: 1, place: 'shore',
    job: { type: 'gather', source: 'water', radius: 6, work: 8, yield: 6, process: 1, product: 'fish' },
    desc: 'Casts nets in the lagoon. Must touch water.',
  },
  storehouse: {
    name: 'Storehouse', yo: 'Abà', cat: 'industry', era: 0, w: 2, h: 2,
    cost: { wood: 15 }, hp: 120, storage: { goods: 150 }, place: 'land',
    desc: 'Holds wood, stone, iron, palm oil and weapons. Workers carry goods to the nearest one.',
  },
  granary: {
    name: 'Granary', yo: 'Àká', cat: 'food', era: 0, w: 2, h: 2,
    cost: { wood: 15 }, hp: 120, storage: { food: 150 }, place: 'land',
    desc: 'Raised barns that keep yam, fish and meat. Food is carried to the nearest one.',
  },
  palisade: {
    name: 'Palisade Wall', yo: 'Odi Igi', cat: 'military', era: 0, w: 1, h: 1,
    cost: { wood: 2 }, hp: 160, place: 'land', wall: true, line: true,
    desc: 'Sharpened stakes. Drag to build a line. Raiders must hack through it.',
  },
  gate: {
    name: 'Gate', yo: 'Ẹnu Odi', cat: 'military', era: 0, w: 1, h: 1,
    cost: { wood: 6 }, hp: 260, place: 'land', gate: true,
    desc: 'Your people pass, enemies must break it down.',
  },
  well: {
    name: 'Well', yo: 'Kànga', cat: 'town', era: 1, w: 1, h: 1,
    cost: { wood: 5, stone: 4 }, hp: 60, place: 'land', happiness: 2,
    desc: 'Clean water. +2 happiness (up to three wells count).',
  },
  shrine: {
    name: 'Shrine', yo: 'Ojúbọ', cat: 'town', era: 1, w: 2, h: 2,
    cost: { wood: 15, cowries: 20 }, hp: 90, workers: 1, place: 'land', happiness: 6,
    job: { type: 'tend' },
    desc: 'A babaláwo keeps the shrine. +6 happiness while tended (up to three shrines).',
  },
  market: {
    name: 'Market', yo: 'Ọjà', cat: 'town', era: 1, w: 3, h: 3,
    cost: { wood: 30 }, hp: 140, place: 'land', happiness: 4, unique: true,
    desc: 'Buy and sell goods for cowries. Busy markets lift spirits: +4 happiness.',
  },
  quarry: {
    name: 'Stone Quarry', yo: 'Ibi Òkúta', cat: 'industry', era: 1, w: 2, h: 2,
    cost: { wood: 20 }, hp: 100, workers: 2, place: 'rock', near: 5,
    job: { type: 'gather', source: 'rock', radius: 7, work: 9, yield: 4, process: 2, product: 'stone' },
    desc: 'Cuts stone from rocky hills. Must be built near rocks.',
  },
  watchtower: {
    name: 'Watchtower', yo: 'Ilé Ìṣọ́', cat: 'military', era: 1, w: 2, h: 2,
    cost: { wood: 25, stone: 6 }, hp: 260, place: 'land', influence: 5, vision: 9,
    tower: { range: 7, dmg: 7, cd: 1.4 },
    desc: 'Lookouts with bows shoot raiders in range and see far.',
  },
  warcamp: {
    name: 'War Camp', yo: 'Àgọ́ Ogun', cat: 'military', era: 1, w: 3, h: 3,
    cost: { wood: 40, cowries: 20 }, hp: 260, place: 'land', influence: 5, army: 10,
    trains: ['scout', 'spearman', 'archer', 'swordsman', 'musketeer'],
    desc: 'Arms your people. Recruits come from strangers at the fire first, then from idle residents. +10 army size.',
  },
  palace: {
    name: 'Ààfin (Palace)', yo: 'Ààfin', cat: 'town', era: 1, w: 4, h: 4,
    cost: { wood: 140, stone: 50, cowries: 100 }, hp: 900, housing: 6,
    storage: { food: 100, goods: 100 }, influence: 15, place: 'land', unique: true, happiness: 4,
    tower: { range: 7, dmg: 9, cd: 1.5 },
    desc: 'Seat of your rule. Turns your compound into a Town: strangers now gather in the town square. Required for the Town era.',
  },
  house: {
    name: 'Family House', yo: 'Ilé', cat: 'housing', era: 2, w: 2, h: 2,
    cost: { wood: 18, stone: 10 }, hp: 180, housing: 8, place: 'land',
    desc: 'A larger rectangular house with a courtyard. Eight people can live here.',
  },
  palmpress: {
    name: 'Palm Oil Press', yo: 'Ibi Epo', cat: 'industry', era: 2, w: 2, h: 2,
    cost: { wood: 25, stone: 5 }, hp: 100, workers: 2, place: 'palm', near: 8,
    job: { type: 'gather', source: 'palm', radius: 10, work: 6, yield: 4, process: 4, product: 'palmoil' },
    desc: 'Harvests palm fruit and presses red oil, the great trade good of the coast. Needs palm trees nearby.',
  },
  ironmine: {
    name: 'Iron Mine', yo: 'Ibi Irin', cat: 'industry', era: 2, w: 2, h: 2,
    cost: { wood: 30, stone: 10 }, hp: 140, workers: 2, place: 'iron', near: 4,
    job: { type: 'gather', source: 'iron', radius: 6, work: 11, yield: 3, process: 3, product: 'iron' },
    desc: 'Digs iron ore. Only where scouts have found iron.',
  },
  blacksmith: {
    name: 'Blacksmith', yo: 'Alágbẹ̀dẹ', cat: 'industry', era: 2, w: 2, h: 2,
    cost: { wood: 30, stone: 15 }, hp: 140, workers: 1, place: 'land',
    job: { type: 'craft', inputs: { iron: 2, wood: 1 }, work: 12, yield: 1, product: 'weapons' },
    desc: 'Ogun’s craft: forges iron and wood into weapons for swordsmen and musketeers.',
  },
  canoeyard: {
    name: 'Canoe Yard', yo: 'Ibi Ọkọ̀', cat: 'industry', era: 2, w: 2, h: 2,
    cost: { wood: 45 }, hp: 120, place: 'shore', unique: true,
    desc: 'Dugout canoes. Your people and soldiers can now cross the lagoon and rivers.',
  },
  stonewall: {
    name: 'Stone Wall', yo: 'Odi Òkúta', cat: 'military', era: 2, w: 1, h: 1,
    cost: { stone: 3 }, hp: 520, place: 'land', wall: true, line: true,
    desc: 'Laterite and stone. Much tougher than a palisade.',
  },
  tradingpost: {
    name: 'Trading Post', yo: 'Ilé Ọjà Òyìnbó', cat: 'town', era: 2, w: 3, h: 3,
    cost: { wood: 40, stone: 30 }, hp: 260, place: 'shore', unique: true, requires: 'europeanTrade',
    desc: 'Where European ships trade. Palm oil sells for more, and iron and weapons can be bought. Unlocks musketeers.',
  },
  fort: {
    name: 'Coastal Fort', yo: 'Ilé Olódi', cat: 'military', era: 3, w: 3, h: 3,
    cost: { stone: 80, iron: 20, cowries: 60 }, hp: 900, place: 'land', influence: 6, vision: 10,
    tower: { range: 9, dmg: 26, cd: 3.2, cannon: true },
    desc: 'Stone bastions with cannon. Shatters raiding parties.',
  },
  school: {
    name: 'School', yo: 'Ilé Ìwé', cat: 'town', era: 3, w: 3, h: 2,
    cost: { wood: 40, stone: 40, cowries: 80 }, hp: 200, place: 'land', happiness: 6, unique: true,
    desc: 'Learning for every child. +6 happiness and strangers arrive faster.',
  },
  assembly: {
    name: 'House of Assembly', yo: 'Ilé Aṣòfin', cat: 'town', era: 3, w: 3, h: 3,
    cost: { wood: 80, stone: 120, cowries: 300 }, hp: 900, place: 'land', unique: true, happiness: 4,
    desc: 'Where all the peoples you have united speak as one. Required to proclaim The New Nigeria.',
  },
};

export const STORAGE_FOR = { food: ['granary', 'compound', 'palace'], goods: ['storehouse', 'compound', 'palace'] };
