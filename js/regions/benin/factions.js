// Who shares the Edo forest with the player: the towns and chiefdoms around
// the city, the river port, the robbers of the forest, the places worth
// finding, and the powers beyond the land: the Igala kingdom across the
// Niger, whose host comes from the east, and the Portuguese (see events.js).

export const FOREIGN = {
  igala: { name: 'Igala', color: '#3d2b6b' },
  portuguese: { name: 'Portuguese', color: '#c9a227' },
};

export const FACTIONS = [
  {
    id: 'udo', name: 'Udo', people: 'Edo', origin: 'Edo', strength: 3, temperament: 'proud',
    leader: 'The Ezomo of Udo', wants: { iron: 9, cloth: 13 }, offers: { yam: 3, palmoil: 6 },
    at: [0.16, 0.36], color: '#8b3a2b', garrison: { warrior: 7, bowman: 4 },
    loot: { yam: 90, palmoil: 30, cowries: 200 }, tribute: { yam: 8, cowries: 12 }, joiners: 5,
    desc: 'An old Edo town to the west, as proud as the city and its rival for the forest’s trade.',
  },
  {
    id: 'esan', name: 'Esan chiefdoms', people: 'Esan', origin: 'Esan', strength: 3, temperament: 'friendly',
    leader: 'The Onojie of Uromi', wants: { salt: 9, iron: 8 }, offers: { yam: 3, cloth: 12 },
    at: [0.72, 0.12], color: '#3f8f5a', garrison: { warrior: 6, bowman: 3 },
    loot: { yam: 80, cloth: 20, cowries: 150 }, tribute: { yam: 6, cowries: 9 }, joiners: 5,
    desc: 'The chiefdoms of the Esan to the north-east, each under its Onojie: farmers of the open woodland, close kin to the Edo.',
  },
  {
    id: 'owo', name: 'Owo', people: 'Owo', strength: 4, temperament: 'proud',
    leader: 'The Olowo of Owo', wants: { palmoil: 7, salt: 9, cloth: 13 }, offers: { iron: 8, weapons: 18 },
    at: [0.1, 0.1], color: '#6d3fa0', garrison: { warrior: 8, bowman: 5 },
    loot: { iron: 30, weapons: 10, cowries: 220 }, tribute: { iron: 2, cowries: 14 }, joiners: 4,
    desc: 'A Yoruba kingdom to the north-west whose carvers and courtiers learned much from Benin, and whose warriors are famous.',
  },
  {
    id: 'ika', name: 'Ika of Agbor', people: 'Ika', strength: 2, temperament: 'friendly',
    leader: 'The Dein of Agbor', wants: { fish: 3, iron: 8 }, offers: { yam: 3, palmoil: 6 },
    at: [0.92, 0.58], color: '#c2873a', garrison: { warrior: 4, bowman: 2 },
    loot: { yam: 60, palmoil: 30, cowries: 80 }, tribute: { yam: 6, cowries: 6 }, joiners: 4,
    desc: 'Farming towns to the east on the road to the Niger, under the Dein of Agbor.',
  },
  {
    id: 'ughoton', name: 'Ughoton river port', people: 'Edo', origin: 'Edo', strength: 1, temperament: 'friendly', major: false,
    leader: 'The headman of Ughoton', wants: { yam: 3, wood: 3 }, offers: { fish: 3, salt: 8 },
    at: [0.2, 0.84], color: '#2a7f9e', garrison: { warrior: 3 }, huts: 4,
    loot: { fish: 60, cowries: 40 }, tribute: { fish: 6 }, joiners: 3,
    desc: 'Fishermen and boatmen at the landing on the creek to the sea, where traders from the coast tie up.',
  },
  {
    id: 'bandits1', name: 'Forest bandits', people: 'Bandits', strength: 1, temperament: 'bandit', major: false,
    at: [0.28, 0.48], color: '#3b3b3b', garrison: { bandit: 4 }, huts: 3, style: 'camp', firstRaid: 200,
    loot: { cowries: 60, meat: 30, wood: 30 }, joiners: 0,
    desc: 'Outcasts who live by robbing farms.',
  },
  {
    id: 'bandits2', name: 'Road robbers', people: 'Bandits', strength: 1, temperament: 'bandit', major: false,
    at: [0.6, 0.86], color: '#3b3b3b', garrison: { bandit: 4, bowman: 1 }, huts: 3, style: 'camp', firstRaid: 420,
    loot: { cowries: 90, weapons: 4 }, joiners: 0,
    desc: 'Robbers who prey on the traders’ paths.',
  },
];

export const POIS = [
  { kind: 'shrine', at: [0.58, 0.3], name: 'the shrine of Olokun by the river', text: 'The shrine of Olokun, the god of the waters and of wealth. The priestesses bless your people.', reward: { happy: 6, cowries: 30 } },
  { kind: 'iron', at: [0.36, 0.16], name: 'old iron workings', text: 'Slag heaps and clay furnaces: iron ore lies here. Build an iron mine in the Town era.', reward: { iron: 25, reveal: 6 }, revealsIron: true },
  { kind: 'farm', at: [0.66, 0.66], name: 'an abandoned farmstead', text: 'Old yam barns, still full.', reward: { yam: 50 } },
  { kind: 'hunters', at: [0.4, 0.82], name: "a hunters' camp", text: 'Hunters of the forest share their meat and agree to join you.', reward: { meat: 25, strangers: 3 } },
  { kind: 'ivory', at: [0.86, 0.3], name: 'an elephant’s tusks', text: 'An old elephant died here long ago. Its ivory is worth a fortune to the carvers.', reward: { cowries: 90 } },
  { kind: 'brass', at: [0.3, 0.68], name: 'a caster’s abandoned workshop', text: 'Clay moulds, wax and a heap of old brass: a bronze caster worked here once.', reward: { cowries: 60, iron: 10 } },
];
