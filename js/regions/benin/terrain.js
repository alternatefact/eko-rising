// The land of Benin: rainforest, flat and deep, with the Ogba river in the
// west and the Ikpoba in the east, and no sea: the creeks to the coast and
// the river port of Ughoton lie beyond the south-west edge. Forest rings the
// clearing nearly all the way round; the fence closes the one way out.

export const TERRAIN = {
  coastY: 2,
  beach: 0,
  creekY: 3,
  creekHalf: 0,
  lagoons: [{ x: 0.12, y: 0.86, rx: 0.08, ry: 0.06 }],
  channels: [],
  islands: [],
  rivers: [
    { from: [0.16, 0], to: [0.12, 0.86], fordEvery: 9, wide: true },
    { from: [0.82, 0], to: [0.78, 1], fordEvery: 8 },
  ],
  savanna: 0.12,
  hillLevel: 0.74,
  forestLevel: 0.48,
  ironClusters: 3,
  ringArc: 2.45,
  start: [0.48, 0.55],
};
