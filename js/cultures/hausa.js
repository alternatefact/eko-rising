// The Hausa culture pack (DESIGN.md, culture packs): the names, words and
// threats of Kano. Every name, title and greeting here still needs a check
// by a native speaker before release.

// Kano's newcomers: from the city's own wards and farms first, then the
// other Hausa towns, Borno to the east and the Fulani herders.
const ORIGINS = [
  {
    from: 'Dala', people: 'Kano',
    male: ['Garba', 'Musa', 'Bello', 'Sani', 'Usman', 'Yusuf', 'Haruna', 'Danjuma', 'Shehu', 'Aliyu'],
    female: ['Hauwa', 'Amina', 'Zainab', 'Hadiza', 'Binta', 'Rakiya', 'Maimuna', 'Larai', 'Hafsat', 'Aisha'],
  },
  {
    from: 'Katsina', people: 'Katsina',
    male: ['Tanko', 'Audu', 'Gambo', 'Dauda', 'Lawal'],
    female: ['Ladi', 'Talatu', 'Asabe', 'Kande', 'Tani'],
  },
  {
    from: 'Zazzau', people: 'Zazzau',
    male: ['Dogo', 'Bawa', 'Iro', 'Maigari'],
    female: ['Delu', 'Jummai', 'Lami', 'Mairo'],
  },
  {
    from: 'Borno', people: 'Kanuri',
    male: ['Bukar', 'Modu', 'Kyari', 'Lawan'],
    female: ['Yagana', 'Falmata', 'Kellu', 'Fatima'],
  },
  {
    from: 'the grazing lands', people: 'Fulani',
    male: ['Buba', 'Hamman', 'Sule', 'Jibrin'],
    female: ['Adama', 'Asta', 'Kaltume', 'Inna'],
  },
];

export const HAUSA = {
  id: 'hausa',
  name: 'Hausa',
  defaults: { founder: 'Garba', spouse: 'Hauwa', settlement: 'Dala' },
  origins: ORIGINS,
  originWeights: [6, 3, 2, 1, 1],
  // Robes of white, indigo and the deep dyes of the Kofar Mata pits.
  cloth: ['#f2efe6', '#1f2f5c', '#2b3f7a', '#e8e2d0', '#6b2d2d', '#3d5a80', '#d9c7a1', '#14213d', '#8a5a2b', '#4a6fa5', '#b9b4a6'],
  greeting: 'Sannu da zuwa',
  ruler: 'Sarki',
  eraNames: ['Gona', 'Gida', 'Gari', 'Birni', 'Babban Birni'],
  // The ages as they look here (the shared ones are Èkó's), and no Èkó
  // paintings of them.
  eraBlurbs: [
    'A man, his wife and a patch of land under Dala hill.',
    'Your household becomes a family compound of red mud: courtyards behind walls, granaries on stone feet, wells, a market under the trees, and horses from the desert caravans.',
    'A town with a Sarki’s palace and earthen walls. Iron and smiths, dyers and weavers, horsemen, and the caravans of the Sahara at your market.',
    'A great walled city of the savanna at the end of the desert roads, whose cloth and leather are sold from the Mediterranean to the forest coast. And the question of empire comes to the gates.',
    'A modern city: storey buildings, hospitals, factories and banks. The naira replaces the old money.',
  ],
  eraArt: false,
  staple: { res: 'yam', name: 'Millet', icon: '🌾', farm: 'Millet Farm', farmYo: 'Gonar Gero', great: 'Great Millet Farm', greatDesc: 'Wider fields and a granary of clay.', desc: 'Millet sown in rows in the sandy soil when the first rains come, and cut when the heads are heavy. Fastest in the rainy season; in the Harmattan the fields lie bare.' },
  predator: 'hyena',
  festival: 'durbar',
  // Your own soldiers: indigo robes and white turbans, hide shields.
  soldiers: { spearman: 'hausa_spear', archer: 'hausa_bow' },
  // Local names for buildings and soldiers (the data files carry Yoruba
  // ones). Anything not listed shows no local name.
  words: {
    buildings: {
      compound: 'Gida', hut: 'Bukka', granary: 'Rumbu', market: 'Kasuwa', well: 'Rijiya',
      palisade: 'Shinge', gate: 'Kofa', stonewall: 'Ganuwa', blacksmith: 'Makera', school: 'Makaranta', hospital: 'Asibiti',
      palace: { name: 'Gidan Sarki (Palace)', yo: 'Gidan Sarki' },
    },
    units: { spearman: 'Mai mashi', archer: 'Maharbi', swordsman: 'Mai takobi', horseman: 'Ɗan doki', musketeer: 'Mai bindiga' },
  },

  opening: {
    founderLook: 'He wears the blue robe.',
    trees: 'A savanna tree gives 8 planks; the tall trees along the river 12.',
    hungry: 'the millet we carried is nearly gone',
    plant: '“Meat alone will not keep us. Let us clear ground and sow millet.”',
    plantTask: 'Sow a Millet Farm',
    sowing: 'hoe the sandy ground and sow the millet in rows. Millet grows fastest in the rains, slowest in the Harmattan.',
    wall: '“The thorn trees are a wall no hyena gets through. We close the gaps between them with a fence, and leave a gate.”',
    fenceHow: 'drag it from tree to tree across the open side.',
    safePlace: 'a safe place under Dala hill',
    bush: 'the bush',
    end: '“When we came, there was nothing here but grass and thorn trees.”',
  },
};
