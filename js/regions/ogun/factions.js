// Who shares Ogun with the player: the peoples of the land, the robbers on
// its roads, the places worth finding, and the powers beyond it whose
// fighters come in from the edges of the map (see events.js).

// Powers from beyond the land. Their riders come in from the far side of the
// map and go back the way they came.
export const FOREIGN = {
  oyo: { name: 'Ọ̀yọ́', color: '#9c3b1b' },
};

export const FACTIONS = [
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
];

export const POIS = [
  { kind: 'olumo', at: [0.63, 0.1], name: 'Olúmọ Rock', text: 'You climb the great granite rock the Ẹ̀gbá sheltered under. From the top you see the whole land, and your people take heart.', reward: { happy: 6, reveal: 12 } },
  { kind: 'dye', at: [0.47, 0.26], name: 'the adire dye pits', text: 'Indigo dye pits, still full. Your people dye cloth in the adire way.', reward: { cloth: 20, cowries: 30 } },
  { kind: 'shrine', at: [0.5, 0.58], name: 'the shrine of Yemọja on the Ogun river', text: 'The river goddess’s shrine. The priests bless your people.', reward: { happy: 5, cowries: 30 } },
  { kind: 'kola', at: [0.84, 0.48], name: 'a kola-nut farm', text: 'Kola trees in rows, the nuts ready to pick. Worth a fortune in the north.', reward: { cowries: 90 } },
  { kind: 'iron', at: [0.3, 0.18], name: 'old iron workings', text: 'Slag heaps and clay furnaces: iron ore lies here. Build an iron mine in the Town era.', reward: { iron: 25, reveal: 6 }, revealsIron: true },
  { kind: 'hunters', at: [0.18, 0.5], name: "a hunters' camp", text: 'Ọdẹ hunters share their meat and agree to join you.', reward: { meat: 25, strangers: 3 } },
  { kind: 'farm', at: [0.34, 0.78], name: 'an abandoned farmstead', text: 'Old yam barns, still full.', reward: { yam: 50 } },
];
