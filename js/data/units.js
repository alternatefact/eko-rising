// Fighters. Your own soldiers are trained at a Training Ground from people
// (a waiting stranger or an idle resident) and cost money for arms and drill.
// Mercenaries are hired for money alone, need no training ground, and draw a
// daily wage. The rest are fielded by other peoples and the foreign powers.

export const UNITS = {
  scout: {
    name: 'Scout', yo: 'Amí', era: 0, hp: 40, atk: 3, range: 1.2, cd: 1, speed: 3.4, vision: 9,
    cost: { food: 10, cowries: 10 }, train: 6,
    desc: 'Fast and far-sighted. Explores the land; flees rather than fights.',
  },
  spearman: {
    name: 'Spearman', yo: 'Ọlọ́kọ̀', era: 0, hp: 70, atk: 8, range: 1.2, cd: 1, speed: 2.2, vision: 5,
    cost: { wood: 6, food: 8 }, train: 8,
    desc: 'A spear cut from the forest and a shield of hide: cheap, sturdy and brave. The backbone of an early war band.',
  },
  archer: {
    name: 'Archer', yo: 'Tafàtafà', era: 1, hp: 45, atk: 7, range: 5, cd: 1.3, speed: 2.2, vision: 6, ranged: true,
    cost: { wood: 12, cowries: 18 }, train: 9,
    desc: 'Looses arrows from behind the spears.',
  },
  swordsman: {
    name: 'Swordsman', yo: 'Jagunjagun', era: 2, hp: 125, atk: 14, range: 1.2, cd: 1, speed: 2, vision: 5,
    cost: { weapons: 2, cowries: 25 }, train: 11,
    desc: 'Iron-armed warrior. Needs weapons from the blacksmith.',
  },
  horseman: {
    name: 'Horseman', yo: 'Ẹlẹ́ṣin', mounted: true, era: 2, hp: 140, atk: 15, range: 1.3, cd: 1.1, speed: 3.2, vision: 7,
    cost: { horses: 1, weapons: 1, cowries: 40 }, train: 12,
    desc: 'Fast, hard-hitting cavalry. Needs a horse, bought from ships or the Kano caravans.',
  },
  musketeer: {
    name: 'Musketeer', yo: 'Agbébọn', era: 2, hp: 95, atk: 24, range: 6, cd: 2.4, speed: 1.9, vision: 6, ranged: true,
    cost: { muskets: 1, cowries: 40 }, train: 13, requires: 'port',
    desc: 'Fires an imported musket. Buy muskets from the ships at your port.',
  },

  // Elite units (DESIGN.md, Elite units): one for each people, trained at the
  // Guard House from the Town age by that people alone, and hired from allied
  // peoples of another. Each fights in its own way:
  //   vs      attack multiplied against 'foot' (soldiers on foot, not
  //           archers or gunmen), 'mounted', 'ranged' or 'folk' (townsfolk
  //           and carriers)
  //   tires   weaker after six seconds in one melee
  //   turn    a beat to wheel round before striking a new target
  //   cleave  each blow also strikes the enemy beside the target, at this share
  //   walls   stronger and harder to hurt near your walls, towers and palace;
  //           steadies your soldiers near him
  //   creeks  crosses lagoons, rivers and mangroves like dry land; arrows and
  //           shots do half on the water
  // The numbers start from the brief's and were tuned with tests/elite.test.mjs
  // so that each has something it beats and something that beats it.
  eso: {
    name: 'Ẹ̀ṣọ́ Rider', culture: 'yoruba', elite: true, mounted: true, era: 2, hp: 135, atk: 14, range: 1.3, cd: 1, speed: 3.9, vision: 8,
    cost: { horses: 1, weapons: 1, cowries: 45 }, train: 12, vs: { ranged: 3.5, folk: 1.8 }, tires: true,
    desc: 'A light rider of Ọ̀yọ́: fast, he hunts down archers, gunmen and carriers. He tires in a long melee.',
  },
  lifidi: {
    name: 'Lifidi Horseman', culture: 'hausa', elite: true, mounted: true, era: 2, hp: 250, atk: 20, range: 1.4, cd: 1.2, speed: 2.7, vision: 7,
    cost: { horses: 1, weapons: 2, cloth: 4, cowries: 70 }, train: 14, vs: { foot: 2 }, turn: 0.8,
    desc: 'Heavy cavalry, horse and rider in quilted cotton armour: he breaks spear lines, but is slow to turn and costly.',
  },
  abam: {
    name: 'Abam Warrior', culture: 'igbo', elite: true, era: 2, hp: 200, atk: 20, range: 1.2, cd: 1.5, speed: 1.8, vision: 5,
    cost: { weapons: 2, food: 20, cowries: 50 }, train: 12, cleave: 0.7,
    desc: 'A huge fighter with a heavy two-handed sword: slow, and each blow also strikes the enemy beside the target.',
  },
  leopardguard: {
    name: 'Leopard Guard', culture: 'edo', elite: true, era: 2, hp: 170, atk: 16, range: 1.2, cd: 1, speed: 2.1, vision: 6,
    cost: { weapons: 2, iron: 4, cowries: 55 }, train: 12, walls: true,
    desc: 'The Oba’s palace guard: stronger near your walls, towers and palace, and the soldiers beside him stand firmer.',
  },
  canoegun: {
    name: 'War-Canoe Gunman', culture: 'itsekiri', elite: true, era: 2, hp: 100, atk: 22, range: 6, cd: 2.3, speed: 2.4, vision: 7, ranged: true,
    cost: { weapons: 1, wood: 12, cowries: 60 }, train: 12, vs: { mounted: 1.5 }, creeks: true,
    desc: 'The Olu’s canoe men fire trade guns from the water: they cross creeks, lagoons and mangroves as fast as dry land, are hard to hit afloat, and their guns scare horses.',
  },

  // Fielded by other peoples and powers.
  bandit: { name: 'Bandit', hp: 42, atk: 6, range: 1.2, cd: 1, speed: 2.4, vision: 6 },
  warrior: { name: 'Warrior', hp: 75, atk: 9, range: 1.2, cd: 1, speed: 2.2, vision: 6 },
  bowman: { name: 'Bowman', hp: 48, atk: 7, range: 5, cd: 1.3, speed: 2.2, vision: 6, ranged: true },
  edo: { name: 'Edo Warrior', hp: 130, atk: 14, range: 1.2, cd: 1, speed: 2.1, vision: 6 },
  soldado: { name: 'Portuguese Soldier', hp: 95, atk: 18, range: 5, cd: 2.2, speed: 1.9, vision: 6, ranged: true },
  french: { name: 'French Soldier', hp: 105, atk: 21, range: 6, cd: 2.3, speed: 1.9, vision: 6, ranged: true },
  marine: { name: 'Royal Marine', hp: 115, atk: 23, range: 6, cd: 2.3, speed: 1.9, vision: 6, ranged: true },
  slaver: { name: 'Slaver', hp: 60, atk: 8, range: 1.2, cd: 1, speed: 2.1, vision: 6 },
  // The Oba's host: spearmen in war dress with leather shields.
  benin: { name: 'Benin Warrior', hp: 78, atk: 8.5, range: 1.2, cd: 1, speed: 2.1, vision: 6 },
  // Ogun's enemies. The Alaafin of Ọ̀yọ́'s horsemen ride down out of the
  // savanna, strike and are gone.
  oyorider: { name: 'Ọ̀yọ́ Horseman', mounted: true, hp: 110, atk: 12, range: 1.3, cd: 1, speed: 3.5, vision: 7 },
  // The Ìjẹ̀bú bought guns on the coast early, and fire from cover.
  ijebugun: { name: 'Ìjẹ̀bú Gunman', hp: 70, atk: 15, range: 5.5, cd: 2.2, speed: 2, vision: 6, ranged: true },
  // Dahomey's army is its women soldiers, the Agojie: swordswomen, fast,
  // fierce and hard to break, and musketeers.
  agojie: { name: 'Agojie', hp: 105, atk: 13, range: 1.2, cd: 0.9, speed: 2.6, vision: 6 },
  dahomey: { name: 'Agojie Musketeer', hp: 80, atk: 16, range: 5.5, cd: 2.3, speed: 2, vision: 6, ranged: true },
  // Kano's enemy: the Jukun of Kwararafa, spearmen with hide shields and
  // horsemen, come north from the Benue.
  jukun: { name: 'Kwararafa Warrior', hp: 80, atk: 9, range: 1.2, cd: 1, speed: 2.2, vision: 6 },
  jukunrider: { name: 'Kwararafa Horseman', mounted: true, hp: 110, atk: 12, range: 1.3, cd: 1, speed: 3.4, vision: 7 },
  // Benin's enemy: the army of the Attah of Igala, from Idah on the Niger.
  igala: { name: 'Igala Warrior', hp: 80, atk: 9, range: 1.2, cd: 1, speed: 2.2, vision: 6 },
  igalarider: { name: 'Igala Horseman', mounted: true, hp: 110, atk: 12, range: 1.3, cd: 1, speed: 3.4, vision: 7 },
  // Northern Igbo's enemy: the warriors the Aro hired from the Abam, Ohafia
  // and Edda towns, with matchets, and later with trade guns.
  aroraider: { name: 'Aro War Band Fighter', hp: 80, atk: 9, range: 1.2, cd: 1, speed: 2.3, vision: 6 },
  arogun: { name: 'Aro Gunman', hp: 65, atk: 13, range: 5, cd: 2.3, speed: 2, vision: 6, ranged: true },
};

export const PLAYER_UNITS = ['scout', 'spearman', 'archer', 'swordsman', 'horseman', 'musketeer'];
export const ELITES = ['eso', 'lifidi', 'abam', 'leopardguard', 'canoegun'];

// Fighters for hire, paid up front and then every day. If the treasury runs
// dry they walk away.
export const HIRES = [
  { id: 'hire_spear', unit: 'spearman', name: 'Hired spearman', era: 0, cost: 45, wage: 2 },
  { id: 'hire_bow', unit: 'bowman', name: 'Hired bowman', era: 1, cost: 55, wage: 2 },
  { id: 'hire_horse', unit: 'horseman', name: 'Hausa horseman', era: 2, cost: 140, wage: 4 },
  { id: 'hire_gun', unit: 'musketeer', name: 'Dane-gun man', era: 3, cost: 160, wage: 5 },
];

export function unitPower(type) {
  const u = UNITS[type];
  return Math.round((u.hp * u.atk) / (u.cd * 10));
}
