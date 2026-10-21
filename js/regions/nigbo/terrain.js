// The land of the northern Igbo: farmland and forest, open woodland in the
// north round Nsukka, the hills of the Udi and Nsukka uplands in the west,
// and the Ebonyi river in the east. No sea. Forest rings the clearing nearly
// all the way round; the fence closes the one way out.

export const TERRAIN = {
  coastY: 2,
  beach: 0,
  creekY: 3,
  creekHalf: 0,
  lagoons: [],
  channels: [],
  islands: [],
  rivers: [{ from: [0.9, 0], to: [0.86, 1], fordEvery: 8 }],
  savanna: 0.36,
  hillLevel: 0.65,
  forestLevel: 0.55,
  ironClusters: 4,
  hills: [
    { x: 0.2, y: 0.32, r: 3.2 },
    { x: 0.28, y: 0.18, r: 2.6 },
  ],
  ringArc: 2.45,
  start: [0.52, 0.56],
};
