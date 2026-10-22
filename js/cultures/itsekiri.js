// The Itsekiri culture pack (DESIGN.md, culture packs): the names, words and
// threats of the Warri start, in the creeks of the western delta. Every
// name, title and greeting here still needs a check by a native speaker
// before release; the greeting is in English and the ages have no local
// names until then.

// Warri's newcomers: Itsekiri towns first, then the Urhobo clans inland, the
// Ijaw fishing towns of the creeks, and Benin to the north.
const ORIGINS = [
  {
    from: 'Ode-Itsekiri', people: 'Itsekiri',
    male: ['Tosan', 'Oritsejafor', 'Ayiri', 'Omatsola', 'Toju'],
    female: ['Omawumi', 'Oritsemeyiwa', 'Eyituoyo', 'Toritseju'],
  },
  {
    from: 'the Urhobo clans', people: 'Urhobo',
    male: ['Oghenekaro', 'Ejiro', 'Efe', 'Akpobome'],
    female: ['Ese', 'Rukevwe', 'Oghenetega', 'Onome'],
  },
  {
    from: 'the creeks', people: 'Ijaw',
    male: ['Tari', 'Pere', 'Timi', 'Ebi'],
    female: ['Ebiere', 'Preye', 'Tamara'],
  },
  {
    from: 'Benin', people: 'Edo',
    male: ['Osaro', 'Osagie', 'Efosa', 'Uyi'],
    female: ['Ivie', 'Osasu', 'Imade'],
  },
];

export const ITSEKIRI = {
  id: 'itsekiri',
  name: 'Itsekiri',
  defaults: { founder: 'Tosan', spouse: 'Omawumi', settlement: 'Ijala' },
  origins: ORIGINS,
  originWeights: [5, 3, 2, 1],
  // White shirts and wrappers of wine, gold and blue.
  cloth: ['#f2efe6', '#7a1f2b', '#d4a017', '#1f3b73', '#e8e2d0', '#2e8b57', '#16a085', '#6c3483', '#b03a2e', '#3d5a80', '#d9c7a1'],
  greeting: 'Welcome',
  ruler: 'Olu',
  eraNames: [],
  eraBlurbs: [
    'A man, his wife and a patch of dry land among the creeks.',
    'Your household becomes a family compound on the waterside, with canoe landings, fish-smoking racks, salt pans and a market.',
    'A town of the creeks with a palace for its Olu, war canoes, and traders who carry salt and fish to every market upriver.',
    'A great port of the delta, whose canoes and traders reach Benin, the Urhobo markets and the ships at the river mouth. And the question of empire comes to the waterside.',
    'A modern city: storey buildings, hospitals, factories and banks. The naira replaces the old money.',
  ],
  eraArt: false,
  staple: { res: 'yam', name: 'Plantain', icon: '🍌', farm: 'Plantain Farm', farmYo: '', great: 'Great Plantain Farm', greatDesc: 'More suckers, and racks to ripen the bunches.', desc: 'Plantain suckers planted in rows in the rich soil by the creeks, the bunches cut green and roasted on the fire. Fastest in the rainy season.' },
  predator: 'crocodile',
  festival: 'regatta',
  words: { buildings: {}, units: {} },
  // Your own fighters: canoe warriors in white head-wraps with cutlasses.
  soldiers: { spearman: 'itsekiri_spear', archer: 'itsekiri_bow' },
  // The elite unit only this people trains (DESIGN.md, Elite units).
  elite: 'canoegun',
  // The old man who knew the land before the founder came, and advises him
  // (DESIGN.md, The adviser). His three faces are art/adviser_itsekiri_*.webp.
  adviser: {
    name: 'Pa Omatsola',
    portraits: { calm: 'adviser_itsekiri_calm', pleased: 'adviser_itsekiri_pleased', worried: 'adviser_itsekiri_worried' },
    // Proverbs come only from a native speaker who has checked them (DESIGN.md,
    // The adviser); until then he closes with none.
    proverbs: [],
  },

  opening: {
    founderLook: 'He wears the blue wrapper.',
    trees: 'A rainforest tree gives 12 planks, a mangrove 6.',
    hungry: 'the plantains we carried are nearly gone',
    plant: '“Meat alone will not keep us. Let us clear ground and plant plantain.”',
    plantTask: 'Plant a Plantain Farm',
    sowing: 'clear the undergrowth and plant the plantain suckers in rows. Plantains grow fastest in the rains, slowest in the Harmattan.',
    wall: '“The forest and the creeks hem us in. We close the open ground between them with a fence, and leave a gate.”',
    fenceHow: 'drag it from tree to tree, or down to the water.',
    safePlace: 'a safe place among the creeks',
    bush: 'the mangroves',
    end: '“When we came, there was nothing here but mangrove and water.”',
    tool: 'cutlass',
  },
};
