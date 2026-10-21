// The Igbo culture pack (DESIGN.md, culture packs): the names, words and
// threats of the Northern Igbo start, a land of village councils, not kings.
// Every name, title and greeting here still needs a check by a native
// speaker before release.

// Newcomers: from the Udi hills, the Nsukka villages, Abakaliki, the smiths
// of Awka, and the Igala kingdom to the north-west.
const ORIGINS = [
  {
    from: 'the Udi hills', people: 'Igbo',
    male: ['Nwankwo', 'Chukwuemeka', 'Ifeanyi', 'Ugochukwu', 'Obinna'],
    female: ['Adaeze', 'Chiamaka', 'Adaku', 'Nkechi', 'Ngozi'],
  },
  {
    from: 'Nsukka', people: 'Igbo',
    male: ['Ugwu', 'Odo', 'Ezema', 'Onah'],
    female: ['Nneka', 'Ogechi', 'Chinwe', 'Uloma'],
  },
  {
    from: 'Abakaliki', people: 'Igbo',
    male: ['Nwali', 'Nweke', 'Nwafor', 'Ogbonna'],
    female: ['Nwogo', 'Nnenna', 'Uzoamaka'],
  },
  {
    from: 'Awka', people: 'Igbo',
    male: ['Okeke', 'Okafor', 'Okoye', 'Obiora', 'Nnamdi'],
    female: ['Ifeoma', 'Obiageli', 'Ebele'],
  },
  {
    from: 'Idah', people: 'Igala',
    male: ['Agada', 'Ameh', 'Ocheja', 'Ojonugwa'],
    female: ['Ojoma', 'Ene', 'Ufedo'],
  },
];

export const IGBO = {
  id: 'igbo',
  name: 'Igbo',
  defaults: { founder: 'Nwankwo', spouse: 'Adaeze', settlement: 'Umunwankwo' },
  origins: ORIGINS,
  originWeights: [5, 3, 2, 2, 1],
  // Akwete and indigo: deep red, gold, blue and white.
  cloth: ['#b3261e', '#e0b03a', '#1f3b73', '#f2efe6', '#2e8b57', '#6b2d2d', '#d35400', '#14213d', '#8e44ad', '#c0392b', '#d9c7a1'],
  greeting: 'Nnọọ',
  ruler: 'Eze',
  // Farm, the head's house, town, big town. The modern city's name waits
  // for a speaker's check.
  eraNames: ['Ugbo', 'Obi', 'Obodo', 'Obodo Ukwu'],
  eraBlurbs: [
    'A man, his wife and a clearing below the hills.',
    'Your household becomes a family compound: the head’s obi at the gate, red-earth walls, a yam barn, a shrine and a market on the town’s own day.',
    'A town of many compounds that rules itself: the elders and the age grades meet in the square, and smiths, weavers and traders fill the market.',
    'A great market town whose traders reach the coast and the Niger, and whose name is known in every village. And the question of empire comes to the gates.',
    'A modern city: storey buildings, hospitals, factories and banks. The naira replaces the old money.',
  ],
  eraArt: false,
  staple: { res: 'yam', name: 'Yam', icon: '🍠', farm: 'Yam Farm', farmYo: 'Ugbo Ji', great: 'Great Yam Farm', greatDesc: 'Taller heaps and an ọba ji, a yam barn of lashed poles.', desc: 'Yam, the king of crops, grown on big heaps of earth with stakes for the vines. Fastest in the rainy season, slowest in the Harmattan.' },
  predator: 'leopard',
  festival: 'iriji',
  words: { buildings: { market: 'Ahịa', granary: 'Ọba', school: 'Ụlọ Akwụkwọ', hospital: 'Ụlọ Ọgwụ' }, units: { archer: 'Onye ụta' } },
  // Your own warriors: red head-ties with an eagle feather.
  soldiers: { spearman: 'igbo_spear', archer: 'igbo_bow' },

  opening: {
    founderLook: 'He wears the blue wrapper.',
    trees: 'A rainforest tree gives 12 planks, a savanna tree 8.',
    hungry: 'the yams we carried are nearly gone',
    plant: '“Meat alone will not keep us. Let us clear ground and plant yams.”',
    plantTask: 'Plant a Yam Farm',
    sowing: 'heap the earth into mounds and plant the seed yams, the king of crops. Yams grow fastest in the rains, slowest in the Harmattan.',
    wall: '“The forest is a wall no leopard gets through. We close the gaps between the trees with a fence, and leave a gate.”',
    fenceHow: 'drag it from tree to tree across the open side.',
    safePlace: 'a safe place below the hills',
    bush: 'the forest',
    end: '“When we came, there was nothing here but forest and hills.”',
    tool: 'machete',
  },
};
