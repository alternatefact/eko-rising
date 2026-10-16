// The ages of your settlement. History supplies the backdrop; the player sets
// the pace. Each era's year is only a floor: the calendar jumps forward to it
// when you advance, and otherwise ticks on from wherever you are.
//
// A new age needs a great expansion — people, buildings and a heap of
// resources and money — and, from the Town age on, kingdoms brought under
// your rule. A settlement that has subdued no one stays small.

export const ERAS = [
  {
    name: 'Farmstead', yo: 'Oko', year: 1400,
    blurb: 'A man, his wife and a patch of land by the lagoon.',
  },
  {
    name: 'Compound', yo: 'Agbo-ilé', year: 1440,
    req: { pop: 8 }, cost: { wood: 60, food: 40, cowries: 20 },
    blurb: 'Your household becomes a lineage compound. Mud-brick houses, shrines, markets, palm oil and — once the ships bring it — cassava and garri.',
  },
  {
    name: 'Town', yo: 'Ìlú', year: 1472,
    req: { pop: 20, building: 'palace', subdued: 1 }, cost: { stone: 40, cowries: 120 },
    blurb: 'A town with a palace and a square. Iron, blacksmiths, canoes, horsemen and a port where the ships trade.',
  },
  {
    name: 'Port City', yo: 'Èbúté', year: 1800,
    req: { pop: 40, buildings: ['market', 'canoeyard'], flag: 'metEuropeans', subdued: 2 }, cost: { wood: 150, stone: 120, cowries: 350 },
    blurb: 'A great port of the Atlantic coast. Zinc roofs, forts with cannon, schools, and the question of empire.',
  },
  {
    name: 'Metropolis', yo: 'Ìlú Ńlá', year: 1960,
    req: { pop: 70, buildings: ['port', 'school'], subdued: 3 }, cost: { stone: 250, iron: 80, cowries: 1200 },
    blurb: 'A modern city: storey buildings, hospitals, factories and banks. The naira replaces the old money.',
  },
];
