// Who shares Lagos with the player: the foreign powers that come by sea,
// the peoples and kingdoms of the land, and places worth finding.

export const FOREIGN = {
  portuguese: { name: 'Portuguese', color: '#c9a227' },
  french: { name: 'French', color: '#2c5aa0' },
  british: { name: 'British', color: '#b22234' },
};

export const FACTIONS = [
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
];

export const POIS = [
  { kind: 'farm', at: [0.33, 0.47], name: 'an abandoned farmstead', text: 'Old yam barns, still full.', reward: { yam: 40 } },
  { kind: 'grove', at: [0.56, 0.43], name: 'a sacred grove', text: 'The elders bless the grove of the òrìṣà. Your people are heartened.', reward: { happy: 4 } },
  { kind: 'iron', at: [0.6, 0.16], name: 'old iron workings', text: 'Slag heaps and clay furnaces: iron ore lies here. Build an iron mine in the Town era.', reward: { iron: 25, reveal: 6 }, revealsIron: true },
  { kind: 'wreck', at: [0.36, 0.855], name: 'a shipwreck on the beach', water: true, text: 'A broken foreign hull. You salvage cowries and blades.', reward: { cowries: 90, weapons: 6 } },
  { kind: 'hunters', at: [0.14, 0.3], name: "a hunters' camp", text: 'Ọdẹ hunters share their meat and agree to join you.', reward: { meat: 25, strangers: 3 } },
  { kind: 'shrine', at: [0.56, 0.725], name: 'the shrine of Olókun', water: true, text: 'The sea god’s shrine on the island. Your people rejoice.', reward: { happy: 6, cowries: 40 } },
  { kind: 'cache', at: [0.86, 0.2], name: 'a kola-nut cache', text: 'A trader’s hidden kola nuts, worth a fortune.', reward: { cowries: 80 } },
];
