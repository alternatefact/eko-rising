// The land of Warri: the western delta. A creek runs behind the beach the
// length of the coast, lagoons and channels cut the land into islands of
// forest and mangrove, and rivers come down from the north. The farmstead
// stands on dry ground with a lagoon to the south; forest closes in on the
// landward side, and the fence closes the ground between.

export const TERRAIN = {
  coastY: 0.92,
  beach: 0.025,
  creekY: 0.86,
  creekHalf: 1.0,
  lagoons: [
    { x: 0.46, y: 0.69, rx: 0.2, ry: 0.07 },
    { x: 0.86, y: 0.55, rx: 0.09, ry: 0.12 },
    { x: 0.1, y: 0.6, rx: 0.07, ry: 0.1 },
  ],
  channels: [{ x: 0.33, half: 1.3, y0: 0.72 }, { x: 0.72, half: 1.2, y0: 0.66 }],
  islands: [{ x: 0.52, y: 0.71, r: 0.022 }],
  rivers: [
    { from: [0.2, 0], to: [0.12, 0.52], fordEvery: 9, wide: true },
    { from: [0.86, 0], to: [0.86, 0.44], fordEvery: 8 },
  ],
  savanna: 0.08,
  hillLevel: 0.78,
  forestLevel: 0.5,
  ironClusters: 2,
  start: [0.45, 0.56],
};
