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
    name: 'Horseman', yo: 'Ẹlẹ́ṣin', era: 2, hp: 140, atk: 15, range: 1.3, cd: 1.1, speed: 3.2, vision: 7,
    cost: { horses: 1, weapons: 1, cowries: 40 }, train: 12,
    desc: 'Fast, hard-hitting cavalry. Needs a horse, bought from ships or the Kano caravans.',
  },
  musketeer: {
    name: 'Musketeer', yo: 'Agbébọn', era: 2, hp: 95, atk: 24, range: 6, cd: 2.4, speed: 1.9, vision: 6, ranged: true,
    cost: { muskets: 1, cowries: 40 }, train: 13, requires: 'port',
    desc: 'Fires an imported musket. Buy muskets from the ships at your port.',
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
};

export const PLAYER_UNITS = ['scout', 'spearman', 'archer', 'swordsman', 'horseman', 'musketeer'];

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
