// The Yoruba culture pack (DESIGN.md, culture packs): the names, words and
// threats of Èkó and the Ogun chapter. The rules are the same for every
// people; only what things are called, and what comes out of the bush,
// changes.

// Èkó has always drawn newcomers from everywhere, so strangers carry the
// names of where they left. The first is the founders' own people.
const ORIGINS = [
  {
    from: 'Ìsẹ́rí', people: 'Awori',
    male: ['Àdìó', 'Ògúnlẹ́yẹ', 'Akíndé', 'Ọlálẹ́yẹ', 'Àjàní', 'Ṣọ̀tọ́'],
    female: ['Àdùkẹ́', 'Àbẹ̀kẹ́', 'Àníkẹ́', 'Àrìnpé', 'Fáṣọlá'],
  },
  {
    from: 'Ìjẹ̀bú', people: 'Ijebu',
    male: ['Adébáyọ̀', 'Ọdẹ́tọ́lá', 'Kúnlé', 'Fẹ̀mí', 'Dàpọ̀'],
    female: ['Fúnmi', 'Tòpẹ́', 'Bọ́lá', 'Yẹ́túndé', 'Mọ́jísọ́lá'],
  },
  {
    from: 'Ẹ̀gbá', people: 'Egba',
    male: ['Babátúndé', 'Ṣọlá', 'Olúwasẹ́gun', 'Bísí', 'Ayọ̀'],
    female: ['Kẹ́hìndé', 'Táíwò', 'Ìbùkún', 'Yẹ́misí', 'Ọlájùmọ̀kẹ́'],
  },
  {
    from: 'Àgbádárìgì', people: 'Egun',
    male: ['Sẹ̀wànù', 'Hùnpẹ̀', 'Tọ̀fá', 'Gbẹ̀nàgàn'],
    female: ['Mẹ̀hùnù', 'Ahọ̀sí', 'Dọ̀ssà'],
  },
  {
    from: 'the creeks', people: 'Ijaw',
    male: ['Tàrí', 'Ẹ̀bìkẹ́', 'Pẹ́rẹ́', 'Tímì'],
    female: ['Ẹ̀bíerè', 'Préyè', 'Ọ̀yíntà'],
  },
  {
    from: 'Ìbìnú', people: 'Edo',
    male: ['Òsàrọ̀', 'Ìmàsúẹ̀n', 'Ẹ̀hì', 'Ìwínósà'],
    female: ['Ìvíè', 'Òsàsè', 'Ẹ̀ghọ̀sà'],
  },
  {
    from: 'Ọ̀yọ́', people: 'Oyo',
    male: ['Àlàó', 'Àkànbí', 'Tèmídayọ̀', 'Ìdòwú'],
    female: ['Àyìnkẹ́', 'Fọláké', 'Tìtí', 'Ṣadé'],
  },
];

export const YORUBA = {
  id: 'yoruba',
  name: 'Yoruba',
  defaults: { founder: 'Àdìó', spouse: 'Àdùkẹ́', settlement: 'Èkó' },
  origins: ORIGINS,
  originWeights: [5, 3, 2, 2, 1, 1, 2],
  // Wrapper colours for the people who come.
  cloth: ['#2f4a8a', '#1f3b73', '#c0392b', '#e6a417', '#2e8b57', '#8e44ad', '#d35400', '#16a085', '#b03a2e', '#f1c40f', '#6c3483'],
  greeting: 'Ẹ káàbọ̀',
  ruler: 'Ọba',
  eraNames: ['Oko', 'Agbo-ilé', 'Ìlú', 'Èbúté', 'Ìlú Ńlá'],
  // The staple keeps the resource id `yam`; only its name and icon change.
  staple: { res: 'yam', name: 'Yam', icon: '🍠', farm: 'Yam Farm', farmYo: 'Oko Iṣu', great: 'Great Yam Farm', greatDesc: 'Taller heaps and a yam barn.', desc: 'Yams grown the Nigerian way, on big heaps of earth with stakes for the vines. Fastest in the rainy season, slowest in the Harmattan.' },
  // The brief swaps the wolves for a leopard once there is a model for it.
  predator: 'wolf',
  festival: 'eyo',

  // The guided opening's words (regions/opening.js). The steps are the same
  // everywhere; only these change.
  opening: {
    founderLook: 'He wears the blue wrapper.',
    trees: 'A rainforest tree gives 12 planks, a savanna or shade tree 8, a mangrove 6.',
    hungry: 'the yams we carried are nearly gone',
    plant: '“Meat alone will not keep us. Let us clear ground and plant yams.”',
    plantTask: 'Plant a Yam Farm',
    sowing: 'heap the earth into mounds and plant the seed yams. Yams grow fastest in the rains, slowest in the Harmattan.',
    wall: '“The forest is a wall no wolf gets through. We close the gaps between the trees with a fence, and leave a gate.”',
    fenceHow: 'drag it from tree to tree, or down to the water.',
    safePlace: 'a safe place by the lagoon',
    bush: 'the forest',
    end: '“When we came, there was nothing here but trees.”',
  },
};
