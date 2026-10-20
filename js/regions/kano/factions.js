// Who shares Kano with the player: the Hausa kingdoms around it, the Fulani
// herders, the robbers of the bush, the places worth finding, and the power
// beyond the land whose host comes in from the south (see events.js).

// Powers from beyond the land. The Jukun of Kwararafa, far to the south-east
// on the Benue, sent their armies north against the Hausa kingdoms.
export const FOREIGN = {
  kwararafa: { name: 'Kwararafa', color: '#5b2a14' },
};

export const FACTIONS = [
  {
    id: 'katsina', name: 'Katsina', people: 'Katsina', origin: 'Katsina', strength: 4, temperament: 'proud',
    leader: 'Sarkin Katsina', wants: { yam: 3, iron: 9, cloth: 13 }, offers: { horses: 70, salt: 8 },
    at: [0.12, 0.14], color: '#2f5d8a', garrison: { warrior: 8, bowman: 4, horseman: 2 },
    loot: { yam: 90, cowries: 220, horses: 2 }, tribute: { yam: 8, cowries: 14 }, joiners: 6,
    desc: 'The great trading city to the north-west, where the desert caravans end. Kano’s oldest rival: the two have fought over the trade roads for as long as anyone remembers.',
  },
  {
    id: 'zazzau', name: 'Zazzau', people: 'Zazzau', origin: 'Zazzau', strength: 5, temperament: 'warlike',
    leader: 'Sarkin Zazzau', wants: { salt: 10, cloth: 14, horses: 60 }, offers: { iron: 8, yam: 3, weapons: 18 },
    at: [0.2, 0.8], color: '#7a2e2e', garrison: { warrior: 9, bowman: 6, horseman: 3 },
    loot: { iron: 40, weapons: 12, cowries: 260 }, tribute: { iron: 2, cowries: 16 }, joiners: 7,
    desc: 'The southern Hausa kingdom behind its long earthen walls, rich in iron and captives from the lands beyond it. Its queen Amina is remembered as a great general.',
  },
  {
    id: 'rano', name: 'Rano', people: 'Rano', origin: 'Kano', strength: 2, temperament: 'friendly',
    leader: 'Sarkin Rano', wants: { meat: 3, iron: 8 }, offers: { yam: 3, cloth: 12 },
    at: [0.78, 0.72], color: '#3f8f5a', garrison: { warrior: 4, bowman: 2 },
    loot: { yam: 60, cloth: 10, cowries: 90 }, tribute: { yam: 6, cowries: 7 }, joiners: 4,
    desc: 'A small, old Hausa town of farmers and weavers south of Kano, friendly to neighbours who trade fairly.',
  },
  {
    id: 'daura', name: 'Daura', people: 'Daura', origin: 'Katsina', strength: 2, temperament: 'proud',
    leader: 'Sarkin Daura', wants: { yam: 3, salt: 9 }, offers: { cloth: 12, meat: 3 },
    at: [0.56, 0.06], color: '#8a6d2b', garrison: { warrior: 5, bowman: 2 },
    loot: { cloth: 20, cowries: 120 }, tribute: { cloth: 2, cowries: 9 }, joiners: 4,
    desc: 'The oldest of the Hausa towns, in the north, where Bayajidda killed the snake in the well. Small, but proud of it.',
  },
  {
    id: 'fulani', name: 'Fulani herders', people: 'Fulani', origin: 'Fulani', strength: 1, temperament: 'friendly', major: false,
    leader: 'Ardo Buba of the herders', wants: { yam: 3, salt: 8 }, offers: { meat: 3 },
    at: [0.9, 0.2], color: '#b9935a', garrison: { warrior: 3, bowman: 1 }, huts: 4,
    loot: { meat: 60, cowries: 40 }, tribute: { meat: 6 }, joiners: 3,
    desc: 'Cattle herders camped at the dry-season wells. They trade milk and meat for grain and salt.',
  },
  {
    id: 'bandits1', name: 'Bush bandits', people: 'Bandits', strength: 1, temperament: 'bandit', major: false,
    at: [0.2, 0.46], color: '#3b3b3b', garrison: { bandit: 4 }, huts: 3, style: 'camp', firstRaid: 200,
    loot: { cowries: 60, meat: 30, wood: 30 }, joiners: 0,
    desc: 'Outcasts who live by robbing farms.',
  },
  {
    id: 'bandits2', name: 'Desert-road raiders', people: 'Bandits', strength: 1, temperament: 'bandit', major: false,
    at: [0.9, 0.52], color: '#3b3b3b', garrison: { bandit: 4, bowman: 1 }, huts: 3, style: 'camp', firstRaid: 420,
    loot: { cowries: 90, salt: 10 }, joiners: 0,
    desc: 'Raiders who prey on the caravans.',
  },
];

export const POIS = [
  { kind: 'dala', at: [0.44, 0.3], name: 'Dala hill', text: 'You climb the hill Kano grew around. The old smiths dug iron here; from the top the whole plain lies open, and your people take heart.', reward: { happy: 6, reveal: 12 } },
  { kind: 'iron', at: [0.88, 0.47], name: 'Goron Dutse', text: 'The rocky hill in the east: slag heaps and clay furnaces, and iron ore. Build an iron mine in the Town era.', reward: { iron: 25, reveal: 6 }, revealsIron: true },
  { kind: 'dye', at: [0.34, 0.62], name: 'old indigo dye pits', text: 'Indigo dye pits dug deep in the ground, still full. Your people dye cloth the deep blue Kano is known for.', reward: { cloth: 20, cowries: 30 } },
  { kind: 'farm', at: [0.62, 0.3], name: 'an abandoned granary', text: 'Clay granaries on stone feet, still full of millet.', reward: { yam: 50 } },
  { kind: 'hunters', at: [0.1, 0.36], name: "a hunters' camp", text: 'Hunters of the bush share their meat and agree to join you.', reward: { meat: 25, strangers: 3 } },
  { kind: 'well', at: [0.7, 0.18], name: 'a caravan well', text: 'A deep well on the old caravan road, with a trader’s cache buried beside it.', reward: { cowries: 80, salt: 10 } },
];
