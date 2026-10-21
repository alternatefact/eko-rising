// Who shares the northern Igbo country with the player: the village groups
// of Nsukka, the Udi hills and Abakaliki, the Igala kingdom to the
// north-west, the priests of Nri, the robbers of the forest, the places
// worth finding, and the Aro to the south, whose war bands are the land's
// first great host (see events.js).

export const FOREIGN = {
  aro: { name: 'Aro', color: '#5a1e1e' },
};

export const FACTIONS = [
  {
    id: 'nsukka', name: 'Nsukka villages', people: 'Igbo', origin: 'Igbo', strength: 3, temperament: 'friendly',
    leader: 'The elders of the Nsukka villages', wants: { salt: 9, cloth: 13 }, offers: { yam: 3, iron: 8 },
    at: [0.34, 0.08], color: '#3f8f5a', garrison: { warrior: 6, bowman: 3 },
    loot: { yam: 90, iron: 20, cowries: 140 }, tribute: { yam: 8, cowries: 8 }, joiners: 5,
    desc: 'Village groups of the open woodland in the north, ruled by their elders and age grades, famous for their iron smelters.',
  },
  {
    id: 'udi', name: 'Udi hill towns', people: 'Igbo', origin: 'Igbo', strength: 2, temperament: 'proud',
    leader: 'The elders of the Udi towns', wants: { yam: 3, salt: 9 }, offers: { cloth: 12, palmoil: 6 },
    at: [0.08, 0.5], color: '#8a6d2b', garrison: { warrior: 5, bowman: 2 },
    loot: { cloth: 20, palmoil: 30, cowries: 110 }, tribute: { palmoil: 3, cowries: 7 }, joiners: 4,
    desc: 'Towns of the escarpment in the west, who farm the hillsides and trade with the plains below.',
  },
  {
    id: 'ezza', name: 'Ezza of Abakaliki', people: 'Igbo', origin: 'Igbo', strength: 4, temperament: 'proud',
    leader: 'The elders of Ezza', wants: { iron: 9, salt: 9 }, offers: { yam: 3, salt: 8 },
    at: [0.94, 0.66], color: '#7a2e2e', garrison: { warrior: 8, bowman: 4 },
    loot: { yam: 120, salt: 20, cowries: 180 }, tribute: { yam: 10, cowries: 10 }, joiners: 6,
    desc: 'Great yam farmers of the east beyond the Ebonyi river, near the salt lakes of Abakaliki, and fierce in their own defence.',
  },
  {
    id: 'igala', name: 'Igala of Idah', people: 'Igala', origin: 'Igala', strength: 4, temperament: 'proud',
    leader: 'The Attah of Igala’s governor', wants: { yam: 3, cloth: 13, palmoil: 7 }, offers: { horses: 70, weapons: 18 },
    at: [0.06, 0.06], color: '#3d2b6b', garrison: { igala: 6, bowman: 4, igalarider: 2 },
    loot: { weapons: 12, horses: 2, cowries: 220 }, tribute: { cowries: 14 }, joiners: 3,
    desc: 'The kingdom of the Attah of Igala, across the north-west, whose governors held sway over the Nsukka villages for a time.',
  },
  {
    id: 'nri', name: 'Nri priests', people: 'Igbo', origin: 'Igbo', strength: 1, temperament: 'friendly', major: false,
    leader: 'A priest of the Eze Nri', wants: { yam: 3, cloth: 13 }, offers: { salt: 8 },
    at: [0.18, 0.86], color: '#e0b03a', garrison: { warrior: 2 }, huts: 3,
    loot: { cowries: 40 }, tribute: { cowries: 4 }, joiners: 2,
    desc: 'A household of the priests of Nri, who walk from town to town with their staffs, cleansing the land and settling feuds without armies.',
  },
  {
    id: 'bandits1', name: 'Forest bandits', people: 'Bandits', strength: 1, temperament: 'bandit', major: false,
    at: [0.32, 0.5], color: '#3b3b3b', garrison: { bandit: 4 }, huts: 3, style: 'camp', firstRaid: 200,
    loot: { cowries: 60, meat: 30, wood: 30 }, joiners: 0,
    desc: 'Outcasts who live by robbing farms.',
  },
  {
    id: 'bandits2', name: 'Road robbers', people: 'Bandits', strength: 1, temperament: 'bandit', major: false,
    at: [0.66, 0.88], color: '#3b3b3b', garrison: { bandit: 4, bowman: 1 }, huts: 3, style: 'camp', firstRaid: 420,
    loot: { cowries: 90, weapons: 4 }, joiners: 0,
    desc: 'Robbers who prey on the market roads.',
  },
];

export const POIS = [
  { kind: 'iron', at: [0.36, 0.22], name: 'the old furnaces of Lejja', text: 'Hundreds of slag blocks lie in the village square: iron was smelted here long before anyone can remember. The ore is still in the hills. Build an iron mine in the Town era.', reward: { iron: 30, reveal: 6 }, revealsIron: true },
  { kind: 'bronzes', at: [0.12, 0.72], name: 'bronzes in the earth', text: 'Digging a cistern, a farmer strikes metal: bronze bowls, a shell of bronze, a staff head, beads by the thousand, made with a skill nobody has seen. Your people are amazed.', reward: { happy: 6, cowries: 90 } },
  { kind: 'shrine', at: [0.64, 0.3], name: 'the shrine of Ani', text: 'A shrine of Ani, the earth, who owns the land and its morals. The priest blesses your people and your farms.', reward: { happy: 5, yam: 30 } },
  { kind: 'farm', at: [0.7, 0.66], name: 'an abandoned farmstead', text: 'Old yam barns, still full.', reward: { yam: 50 } },
  { kind: 'hunters', at: [0.84, 0.3], name: "a hunters' camp", text: 'Hunters of the forest share their meat and agree to join you.', reward: { meat: 25, strangers: 3 } },
  { kind: 'salt', at: [0.96, 0.82], name: 'the salt lakes', text: 'Brine springs where the women boil salt, as they have for centuries. They share some with you.', reward: { salt: 20, cowries: 20 } },
];
