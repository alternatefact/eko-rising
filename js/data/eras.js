// The ages of your settlement. History supplies the backdrop; the player sets
// the pace. Each era's year is only a floor: the calendar jumps forward to it
// when you advance, and otherwise ticks on from wherever you are.

export const ERAS = [
  {
    name: 'Farmstead', yo: 'Oko', year: 1400,
    blurb: 'A man, his wife and a patch of land by the lagoon.',
  },
  {
    name: 'Compound', yo: 'Agbo-ilé', year: 1440,
    req: { pop: 8 }, cost: { wood: 60, food: 40 },
    blurb: 'Your household becomes a lineage compound. Walls, shrines, markets and war camps.',
  },
  {
    name: 'Town', yo: 'Ìlú', year: 1472,
    req: { pop: 20, building: 'palace' }, cost: { cowries: 80 },
    blurb: 'A town with a palace and a square. Iron, palm oil and canoes. Ships will come.',
  },
  {
    name: 'Port City', yo: 'Èbúté', year: 1800,
    req: { pop: 40, buildings: ['market', 'canoeyard'], flag: 'metEuropeans' }, cost: { wood: 150, stone: 120, cowries: 250 },
    blurb: 'A great port of the Atlantic coast. Forts, schools, and the question of empire.',
  },
];
