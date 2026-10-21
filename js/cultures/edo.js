// The Edo culture pack (DESIGN.md, culture packs): the names, words and
// threats of the Benin start. Every name, title and greeting here still needs
// a check by a native speaker before release; local names for the ages are
// left out until then.

// Benin's newcomers: Edo villages first, then the Esan chiefdoms to the
// north-east, and the Urhobo and Itsekiri of the creeks to the south.
const ORIGINS = [
  {
    from: 'the old villages', people: 'Edo',
    male: ['Osaro', 'Osagie', 'Eghosa', 'Idahosa', 'Omoruyi', 'Efosa', 'Osayande', 'Ehigiator', 'Uyi', 'Ogbeide'],
    female: ['Ivie', 'Osasu', 'Eseosa', 'Imade', 'Ewere', 'Ofure', 'Osayuki', 'Isoken', 'Itohan'],
  },
  {
    from: 'Uromi', people: 'Esan',
    male: ['Okojie', 'Eromosele', 'Ojeifo', 'Ehimare'],
    female: ['Ehinome', 'Ehiaghe', 'Osemudiamen'],
  },
  {
    from: 'the Urhobo clans', people: 'Urhobo',
    male: ['Oghenekaro', 'Ejiro', 'Efe', 'Akpobome'],
    female: ['Ese', 'Rukevwe', 'Oghenetega', 'Onome'],
  },
  {
    from: 'Ode-Itsekiri', people: 'Itsekiri',
    male: ['Tosan', 'Oritsejafor', 'Ayiri', 'Omatsola'],
    female: ['Omawumi', 'Oritsemeyiwa', 'Toritseju'],
  },
];

export const EDO = {
  id: 'edo',
  name: 'Edo',
  defaults: { founder: 'Osaro', spouse: 'Ivie', settlement: 'Igodomigodo' },
  origins: ORIGINS,
  originWeights: [6, 3, 1, 1],
  // Red and white, the colours of the Oba's court, with indigo and earth.
  cloth: ['#b3261e', '#f2efe6', '#7a1f1f', '#1f3b73', '#d9c7a1', '#8a5a2b', '#c0392b', '#e8e2d0', '#2e4a7a', '#6b2d2d', '#a0703a'],
  greeting: 'Kóyo',
  ruler: 'Oba',
  eraNames: [],
  eraBlurbs: [
    'A man, his wife and a clearing in the great forest of the Edo.',
    'Your household becomes a family compound of red mud: long walls polished like stone, courtyards open to the rain, granaries, shrines and a market.',
    'A walled town with a palace and its guilds: bronze casters, ivory carvers, smiths and weavers, and a deep moat round it all.',
    'A great city of the forest, its walls and moats among the longest earthworks ever dug, trading pepper, ivory and cloth with the ships at Ughoton. And the question of empire comes to the gates.',
    'A modern city: storey buildings, hospitals, factories and banks. The naira replaces the old money.',
  ],
  eraArt: false,
  staple: { res: 'yam', name: 'Yam', icon: '🍠', farm: 'Yam Farm', farmYo: '', great: 'Great Yam Farm', greatDesc: 'Taller heaps and a yam barn.', desc: 'Yams grown on big heaps of earth with stakes for the vines. Fastest in the rainy season, slowest in the Harmattan.' },
  predator: 'leopard',
  festival: 'igue',
  // Local names for buildings: only those checked so far.
  words: { buildings: { stonewall: 'Iya' }, units: {} },
  // How your own soldiers look: Edo warriors with leather shields, brass
  // helmets and coral collars, as the bronze plaques show them.
  soldiers: { spearman: 'benin', archer: 'edo_bow' },

  opening: {
    founderLook: 'He wears the blue wrapper.',
    trees: 'A rainforest tree gives 12 planks, a savanna or shade tree 8.',
    hungry: 'the yams we carried are nearly gone',
    plant: '“Meat alone will not keep us. Let us clear ground and plant yams.”',
    plantTask: 'Plant a Yam Farm',
    sowing: 'heap the earth into mounds and plant the seed yams. Yams grow fastest in the rains, slowest in the Harmattan.',
    wall: '“The forest is a wall no leopard gets through. We close the gaps between the trees with a fence, and leave a gate.”',
    fenceHow: 'drag it from tree to tree across the open side.',
    safePlace: 'a safe place in the forest of the Edo',
    bush: 'the forest',
    end: '“When we came, there was nothing here but forest.”',
    tool: 'cutlass',
  },
};
