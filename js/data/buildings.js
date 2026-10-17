// Every structure the player can raise. Placement rules:
//   land    any dry, explored tile inside your territory
//   fertile grassland, savanna or rainforest (forest is cleared, slash-and-burn)
//   shore   dry footprint touching lagoon, river or sea
//   rock / iron / palm   needs that resource within `near` tiles
// Job types drive the worker state machines in sim/citizens.js.
//
// The first buildings are wood alone: planks cut from the trees around the
// house. Mud bricks come later, as an upgrade: once there is a brick shed by
// a red-mud pit, the kingdom upgrade rebuilds every house and shed in mud
// (`mud` marks a building that has been rebuilt; `mudCost` is what a new one
// costs after that). Stone comes later still. Anything grander needs money as
// well, which comes from taxes, trade with other kingdoms and selling to the
// ships at the port.
//
// Each workplace has room for a set number of workers. Free hands at the
// campfire fill new workplaces by themselves; otherwise the player moves
// someone. Sheds and farm land can be moved; houses and anything bigger must
// be pulled down (half the cost comes back) and built again.
//
// Early on, everything your people bring home is stacked on storage floors
// in front of the compound. Storehouses and granaries come with the Compound
// age.
//
// `upgrades` lists the levels a building can grow through, each with its own
// age, cost and effect: a hut becomes a mud-brick house, then a zinc-roof
// bungalow, then a storey building.

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
    cost: {}, hp: 1200, housing: 5, influence: 11, mudBricks: 6,
    unique: true, buildable: false, trains: ['scout'], hires: true, tower: { range: 5.5, dmg: 5, cd: 1.5 },
    upgrades: [
      { name: 'Extended Compound', era: 1, cost: { wood: 30, bricks: 25, cowries: 20 }, housing: 8, desc: 'More rooms around a second courtyard.' },
    ],
    desc: 'The abandoned house the founders settled in. It sleeps five: the founder, his wife and three more. Trains scouts; hire fighters here for money. If it falls, your story ends.',
  },
  campfire: {
    name: 'Strangers’ Campfire', yo: 'Iná Àlejò', cat: 'town', era: 0, w: 2, h: 2,
    cost: {}, hp: 9999, buildable: false, invulnerable: true,
    desc: 'People with no work sit by the fire. Early on it holds five at most: give them work and they go to it. Newcomers come to the fire first.',
  },
  hut: {
    name: 'Plank House', yo: 'Ilé Pákó', cat: 'housing', era: 0, w: 2, h: 2,
    cost: { wood: 10 }, mudCost: { wood: 4, bricks: 6 }, mudBricks: 4, hp: 90, housing: 2, place: 'land',
    upgrades: [
      { name: 'Mud House', yo: 'Ilé Amọ̀', era: 0, flag: 'mud', cost: { bricks: 6 }, housing: 4, desc: 'Walls of red mud bricks under a thatched roof.' },
      { name: 'Zinc-roof Bungalow', yo: 'Ilé Páànù', era: 3, cost: { stone: 15, iron: 4, cowries: 40 }, housing: 9, desc: 'Plastered walls and a shining corrugated-zinc roof.' },
      { name: 'Storey Building', yo: 'Ilé Alájà', era: 4, cost: { stone: 30, iron: 10, cowries: 120 }, housing: 14, desc: 'A modern two-storey block with balconies.' },
    ],
    desc: 'Walls of sawn planks under a thatch roof: a home for two. Once it stands, two newcomers come to live in it and wait at the fire for work. The kingdom upgrade rebuilds it in mud for four.',
  },
  farm: {
    name: 'Yam Farm', yo: 'Oko Iṣu', cat: 'food', era: 0, w: 3, h: 3,
    cost: { wood: 5 }, hp: 60, workers: 2, place: 'fertile', flat: true, movable: true,
    job: { type: 'farm', grow: 38, yield: 12, product: 'yam' },
    upgrades: [{ name: 'Great Yam Farm', era: 1, cost: { wood: 10, cowries: 10 }, yield: 1.5, desc: 'Taller heaps and a yam barn.' }],
    desc: 'Yams grown the Nigerian way, on big heaps of earth with stakes for the vines. Fastest in the rainy season, slowest in the Harmattan.',
  },
  cassava: {
    name: 'Cassava Farm', yo: 'Oko Ẹ̀gẹ́', cat: 'food', era: 1, w: 3, h: 3, requires: 'cassava',
    cost: { wood: 6 }, hp: 60, workers: 1, place: 'fertile', flat: true,
    job: { type: 'farm', grow: 46, yield: 16, product: 'cassava' },
    upgrades: [{ name: 'Great Cassava Farm', era: 2, cost: { wood: 10, cowries: 15 }, yield: 1.5, desc: 'Longer ridges, more stems.' }],
    desc: 'Cassava stems planted on long ridges. Hardy in any season. Raw cassava must be processed into garri at a Garri House.',
  },
  garri: {
    name: 'Garri House', yo: 'Ilé Gààrí', cat: 'food', era: 1, w: 2, h: 2, requires: 'cassava',
    cost: { wood: 15, bricks: 6 }, hp: 90, workers: 2, place: 'land',
    job: { type: 'craft', inputs: { cassava: 4 }, work: 9, yield: 4, product: 'garri' },
    desc: 'Women peel, grate, press and fry cassava into garri — food that keeps for months and sells well to ships and kingdoms.',
  },
  woodcutter: {
    name: 'Wood Shed', yo: 'Ilé Agégi', cat: 'industry', era: 0, w: 2, h: 2,
    cost: { wood: 6 }, mudBricks: 2, hp: 70, workers: 1, place: 'land', needs: 'tree', movable: true,
    job: { type: 'gather', source: 'tree', radius: 24, work: 6, saw: 3, yield: 4, product: 'wood' },
    desc: 'A one-man shed. The woodcutter fells the trees closest to it, cuts each one into planks where it falls and carries them, four at a time, to the storage floor. When the trees nearby are gone he moves on to the next nearest. A forest tree gives 12 planks, a savanna or grassland tree 8, a mangrove 6. Tap a woodcutter, then a tree, to choose where he cuts. More wood? Build another shed.',
  },
  brickyard: {
    name: 'Mud Brick Shed', yo: 'Ibi Amọ̀', cat: 'industry', era: 0, w: 2, h: 2,
    cost: { wood: 8 }, mudBricks: 2, hp: 70, workers: 2, place: 'clay', near: 6, movable: true, outpost: true, influence: 4,
    job: { type: 'gather', source: 'clay', radius: 10, work: 6, yield: 4, process: 4, product: 'bricks' },
    desc: 'Built of planks beside a red-mud pit. Red mud is dug, trodden with water and pressed into wooden moulds, and the blocks dry in the sun. Enough bricks and the kingdom upgrade rebuilds every house and shed in mud.',
  },
  stockpile: {
    name: 'Storage Floor', cat: 'industry', era: 0, w: 2, h: 2,
    cost: { wood: 6 }, mudBricks: 1, hp: 80, storage: { food: 60, goods: 60 }, place: 'land', flat: true,
    desc: 'A swept floor edged with planks where your people stack what they bring home: planks, meat, yams and the rest. Build more floors beside it as your stores grow. Storehouses and granaries come with the Compound age.',
  },
  hunter: {
    name: "Hunter's Shed", yo: 'Ilé Ọdẹ', cat: 'food', era: 0, w: 2, h: 2,
    cost: { wood: 8 }, mudBricks: 2, hp: 70, workers: 1, place: 'land', movable: true,
    job: { type: 'hunt', radius: 26, work: 5, carry: 5, product: 'meat' },
    desc: 'The hunter stalks antelope and bush pig, brings each kill home on his shoulders, butchers it at the shed and carries the meat to the storage floor. An antelope gives 10 meat, a bush pig 8.',
  },
  fisher: {
    name: 'Fishing Jetty', yo: 'Èbúté Apẹja', cat: 'food', era: 0, w: 2, h: 2,
    cost: { wood: 10 }, hp: 70, workers: 1, place: 'shore',
    job: { type: 'gather', source: 'water', radius: 6, work: 8, yield: 6, process: 1, product: 'fish' },
    desc: 'Casts nets in the lagoon. Must touch water.',
  },
  storehouse: {
    name: 'Storehouse', yo: 'Abà', cat: 'industry', era: 1, w: 2, h: 2,
    cost: { wood: 12, bricks: 15 }, hp: 120, storage: { goods: 150 }, place: 'land',
    upgrades: [{ name: 'Stone Warehouse', era: 2, cost: { stone: 15, cowries: 20 }, storage: 2, desc: 'Twice the room.' }],
    desc: 'Holds wood, mud bricks, stone, cassava, palm oil, iron and imports. Workers carry goods to the nearest store.',
  },
  granary: {
    name: 'Granary', yo: 'Àká', cat: 'food', era: 1, w: 2, h: 2,
    cost: { wood: 10, bricks: 15 }, hp: 120, storage: { food: 150 }, place: 'land',
    upgrades: [{ name: 'Great Granary', era: 2, cost: { stone: 15, cowries: 20 }, storage: 2, desc: 'Twice the room.' }],
    desc: 'Raised barns that keep yam, garri, fish and meat. Food is carried to the nearest one.',
  },
  palisade: {
    name: 'Wooden Fence', yo: 'Odi Igi', cat: 'military', era: 0, w: 1, h: 1,
    cost: { wood: 2 }, hp: 160, place: 'land', wall: true, line: true,
    desc: 'Four or five sharpened stakes lashed together with rope, section by section. Drag to build a line between the trees: the forest is a wall of its own. Beasts and raiders must break through. Later you can pull sections down and rebuild them as a mud wall.',
  },
  gate: {
    name: 'Town Gate', yo: 'Bodè', cat: 'military', era: 0, w: 1, h: 1,
    cost: { wood: 6 }, hp: 260, place: 'land', gate: true,
    desc: 'Heavy wooden doors under a thatched roof. Your people pass; enemies must break it down. From the Town age it becomes a mud gatehouse.',
  },
  warcamp: {
    name: 'Guard House', yo: 'Ilé Ẹ̀ṣọ́', cat: 'military', era: 0, w: 3, h: 3,
    cost: { wood: 40 }, mudBricks: 6, hp: 260, place: 'land', influence: 5, army: 10,
    trains: ['scout', 'spearman', 'archer', 'swordsman', 'horseman', 'musketeer'],
    upgrades: [{ name: 'Barracks', era: 2, cost: { stone: 30, cowries: 80 }, army: 10, desc: 'Room for ten more soldiers.' }],
    desc: 'A plank barracks where your own people are trained and housed as guards. Recruits come from those sitting at the fire; if nobody is free, a volunteer walks in from the villages around. +10 army size.',
  },
  well: {
    name: 'Well', yo: 'Kànga', cat: 'town', era: 1, w: 1, h: 1,
    cost: { wood: 5, stone: 4 }, hp: 60, place: 'land', happiness: 2,
    desc: 'Clean water. +2 happiness (up to three wells count).',
  },
  shrine: {
    name: 'Shrine', yo: 'Ojúbọ', cat: 'town', era: 1, w: 2, h: 2,
    cost: { wood: 10, bricks: 10, cowries: 20 }, hp: 90, workers: 1, place: 'land', happiness: 6,
    job: { type: 'tend' },
    desc: 'A babaláwo keeps the shrine. +6 happiness while tended (up to three shrines).',
  },
  market: {
    name: 'Market', yo: 'Ọjà', cat: 'town', era: 1, w: 3, h: 3,
    cost: { wood: 30, cowries: 30 }, hp: 140, place: 'land', happiness: 4, unique: true,
    upgrades: [
      { name: 'Great Market', yo: 'Ọjà Ńlá', era: 3, cost: { stone: 40, cowries: 150 }, happiness: 4, price: 1.15, desc: 'Traders from every town. Better prices.' },
      { name: 'Shopping Plaza', era: 4, cost: { stone: 60, iron: 20, cowries: 300 }, happiness: 4, price: 1.15, desc: 'Shops, banks and buses.' },
    ],
    desc: 'Sell your goods for money and buy what you lack. Busy markets lift spirits: +4 happiness.',
  },
  quarry: {
    name: 'Stone Quarry', yo: 'Ibi Òkúta', cat: 'industry', era: 1, w: 2, h: 2,
    cost: { wood: 20 }, hp: 100, workers: 2, place: 'rock', near: 5,
    job: { type: 'gather', source: 'rock', radius: 7, work: 9, yield: 4, process: 2, product: 'stone' },
    desc: 'Cuts stone from rocky hills. Must be built near rocks.',
  },
  palmpress: {
    name: 'Palm Oil Mill', yo: 'Ibi Epo', cat: 'industry', era: 1, w: 2, h: 2,
    cost: { wood: 20, bricks: 5 }, hp: 100, workers: 2, place: 'palm', near: 8,
    job: { type: 'gather', source: 'palm', radius: 10, work: 6, yield: 4, process: 4, product: 'palmoil' },
    desc: 'A local palm oil making area: palm fruit is pounded in pits and boiled into red oil, the great trade good of the coast. Needs palm trees nearby.',
  },
  watchtower: {
    name: 'Watchtower', yo: 'Ilé Ìṣọ́', cat: 'military', era: 1, w: 2, h: 2,
    cost: { wood: 25, stone: 6, cowries: 15 }, hp: 260, place: 'land', influence: 5, vision: 9,
    tower: { range: 7, dmg: 7, cd: 1.4 },
    desc: 'A tall wooden lookout with a thatched roof. Archers shoot raiders in range and see far.',
  },
  palace: {
    name: 'Ààfin (Palace)', yo: 'Ààfin', cat: 'town', era: 1, w: 4, h: 4,
    cost: { wood: 140, bricks: 80, stone: 30, cowries: 150 }, hp: 900, housing: 6,
    storage: { food: 100, goods: 100 }, influence: 15, place: 'land', unique: true, happiness: 4, hires: true,
    tower: { range: 7, dmg: 9, cd: 1.5 },
    upgrades: [{ name: 'Government House', era: 4, cost: { stone: 100, iron: 30, cowries: 500 }, happiness: 6, housing: 12, desc: 'The seat of a modern state.' }],
    desc: 'Seat of your rule. Turns your compound into a Town: strangers now gather in the town square. Hire fighters here. Required for the Town age.',
  },
  ironmine: {
    name: 'Iron Mine', yo: 'Ibi Irin', cat: 'industry', era: 2, w: 2, h: 2,
    cost: { wood: 30, stone: 10, cowries: 30 }, hp: 140, workers: 2, place: 'iron', near: 4,
    job: { type: 'gather', source: 'iron', radius: 6, work: 11, yield: 3, process: 3, product: 'iron' },
    desc: 'Digs iron ore. Only where scouts have found iron.',
  },
  blacksmith: {
    name: 'Blacksmith', yo: 'Alágbẹ̀dẹ', cat: 'industry', era: 2, w: 2, h: 2,
    cost: { wood: 30, stone: 15, cowries: 40 }, hp: 140, workers: 1, place: 'land',
    job: { type: 'craft', inputs: { iron: 2, wood: 1 }, work: 12, yield: 1, product: 'weapons' },
    desc: 'Ogun’s craft: forges iron and wood into weapons for swordsmen and horsemen.',
  },
  canoeyard: {
    name: 'Canoe Yard', yo: 'Ibi Ọkọ̀', cat: 'industry', era: 2, w: 2, h: 2,
    cost: { wood: 45, cowries: 40 }, hp: 120, place: 'shore', unique: true,
    desc: 'Dugout canoes. Your people and soldiers can now cross the lagoon and rivers.',
  },
  stonewall: {
    name: 'Mud Wall', yo: 'Odi Amọ̀', cat: 'military', era: 1, w: 1, h: 1,
    cost: { bricks: 4 }, hp: 520, place: 'land', wall: true, line: true,
    desc: 'A thick wall of red mud bricks capped with thatch, like the old town walls of Yorubaland and Sungbo’s Eredo. Corners get lookout posts. Much tougher than a wooden fence: pull fence sections down and rebuild them in mud.',
  },
  port: {
    name: 'Port', yo: 'Èbúté', cat: 'town', era: 2, w: 3, h: 3,
    cost: { wood: 40, stone: 30, cowries: 100 }, hp: 260, place: 'shore', unique: true, requires: 'europeanTrade',
    desc: 'Merchant ships dock here every few days. Sell palm oil, garri and fish for money; buy muskets, cannon, salt, cloth, horses, iron tools and fishing nets.',
  },
  fort: {
    name: 'Earthwork Fort', yo: 'Ilé Olódi', cat: 'military', era: 3, w: 3, h: 3,
    cost: { stone: 80, cannon: 2, cowries: 120 }, hp: 900, place: 'land', influence: 6, vision: 10,
    tower: { range: 9, dmg: 26, cd: 3.2, cannon: true },
    desc: 'Mud ramparts and thatched bastions around a war chief’s house, with imported cannon behind the walls. Shatters raiding parties.',
  },
  school: {
    name: 'School', yo: 'Ilé Ìwé', cat: 'town', era: 3, w: 3, h: 2,
    cost: { wood: 40, stone: 40, cowries: 150 }, hp: 200, place: 'land', happiness: 6, unique: true,
    desc: 'Learning for every child. +6 happiness and strangers arrive faster.',
  },
  assembly: {
    name: 'House of Assembly', yo: 'Ilé Aṣòfin', cat: 'town', era: 3, w: 3, h: 3,
    cost: { wood: 80, stone: 120, cowries: 400 }, hp: 900, place: 'land', unique: true, happiness: 4,
    desc: 'Where all the peoples you have united speak as one. Required to proclaim The New Nigeria.',
  },
  hospital: {
    name: 'Hospital', yo: 'Ilé Ìwòsàn', cat: 'town', era: 4, w: 3, h: 3,
    cost: { stone: 80, iron: 20, cowries: 300 }, hp: 400, place: 'land', happiness: 6, unique: true,
    desc: 'Doctors and nurses. +6 happiness, strangers arrive faster, and soldiers nearby heal.',
  },
  factory: {
    name: 'Factory', yo: 'Ilé Iṣẹ́', cat: 'industry', era: 4, w: 3, h: 3,
    cost: { stone: 60, iron: 30, cowries: 250 }, hp: 400, workers: 4, place: 'land',
    job: { type: 'craft', inputs: { cassava: 6, palmoil: 2 }, work: 10, yield: 10, product: 'garri', cash: 25 },
    desc: 'Machines process cassava into packaged garri and export palm products: food for the city and money for every batch.',
  },
  // A bandit camp: hide tents around a fire, not built by you but burned by
  // your soldiers. When every tent is gone the bandits are finished.
  tent: {
    name: 'Bandit Tent', cat: 'military', era: 0, w: 1, h: 1,
    cost: {}, hp: 90, buildable: false, camp: true,
    desc: 'Hides stretched over poles. Bandits sleep here between raids. Burn every tent and the camp is gone for good.',
  },
  chieftent: {
    name: 'Bandit Chief’s Tent', cat: 'military', era: 0, w: 2, h: 2,
    cost: {}, hp: 170, buildable: false, camp: true,
    desc: 'The biggest tent, where the bandit chief keeps what they have stolen. Burn every tent and the camp is gone for good.',
  },
  bank: {
    name: 'Bank', yo: 'Ilé Ìfowópamọ́', cat: 'town', era: 4, w: 2, h: 2,
    cost: { stone: 50, iron: 10, cowries: 400 }, hp: 300, place: 'land', unique: true,
    desc: 'Money makes money: your treasury earns 1% interest a day (up to 60 a day).',
  },
};

// Putting a building up: the labour it takes (seconds of one builder's
// work), how many builders can work on it at once, and the materials they
// carry over from the stores first.
export function buildWork(def) {
  if (def.wall) return 4;
  if (def.gate) return 12;
  return Math.round((def.flat ? 4 : 9) * def.w * def.h + 8);
}

export function buildCrew(def) {
  if (def.wall || def.gate) return 1;
  return def.w * def.h >= 9 ? 3 : 2;
}

export const MATERIALS = ['wood', 'bricks', 'stone', 'iron'];

export function materialsOf(cost) {
  const out = {};
  for (const k of MATERIALS) if (cost?.[k] > 0) out[k] = cost[k];
  return out;
}

// Bricks the kingdom upgrade needs to rebuild a building in mud.
export function mudBricksFor(b) {
  return BUILDINGS[b.type].mudBricks || 0;
}

// What a new building costs now: after the kingdom upgrade, houses go up in
// mud straight away.
export function costOf(st, type) {
  const def = BUILDINGS[type];
  return st.flags.mud && def.mudCost ? def.mudCost : def.cost;
}

export const STORAGE_FOR = { food: ['stockpile', 'granary', 'palace'], goods: ['stockpile', 'storehouse', 'palace'] };

// What a building can do at its current level: base values with every
// upgrade it has taken applied on top.
export function stat(b, key) {
  const def = BUILDINGS[b.type];
  let v = def[key];
  const ups = def.upgrades || [];
  for (let k = 0; k < (b.level || 1) - 1 && k < ups.length; k++) {
    const u = ups[k];
    if (key === 'housing' && u.housing) v = u.housing;
    if (key === 'happiness' && u.happiness) v = (v || 0) + u.happiness;
    if (key === 'army' && u.army) v = (v || 0) + u.army;
    if (key === 'storage' && u.storage) v = { food: (v.food || 0) * u.storage, goods: (v.goods || 0) * u.storage };
    if (key === 'yield' && u.yield) v = (v || 1) * u.yield;
    if (key === 'price' && u.price) v = (v || 1) * u.price;
  }
  if ((key === 'yield' || key === 'price') && v === undefined) return 1;
  return v;
}

export function levelName(b) {
  const def = BUILDINGS[b.type];
  const lvl = b.level || 1;
  return lvl > 1 && def.upgrades?.[lvl - 2] ? def.upgrades[lvl - 2].name : def.name;
}

export function nextUpgrade(b) {
  const def = BUILDINGS[b.type];
  return def.upgrades?.[(b.level || 1) - 1] || null;
}
