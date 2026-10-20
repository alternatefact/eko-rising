// The land of Kano: dry savanna with thorn trees, no sea. The Jakara stream
// runs down in the east to the Kano river in the south; Dala hill stands to
// the north and Goron Dutse to the east, both with rock to quarry. With no
// water near, thorn woodland rings the clearing nearly all the way round,
// and the fence closes the one way out.

export const TERRAIN = {
  coastY: 2,
  beach: 0,
  creekY: 3,
  creekHalf: 0,
  lagoons: [],
  channels: [],
  islands: [],
  rivers: [
    { from: [0.76, 0], to: [0.72, 0.86], fordEvery: 7 },
    { from: [0, 0.9], to: [1, 0.84], fordEvery: 8, wide: true },
  ],
  savanna: 1.1,
  // Dense woodland only where the ground is wettest.
  woodMoist: 0.8,
  hillLevel: 0.66,
  forestLevel: 0.9,
  ironClusters: 4,
  ring: 'savanna',
  ringArc: 2.45,
  hills: [
    { x: 0.44, y: 0.22, r: 3.4 },
    { x: 0.88, y: 0.4, r: 2.8 },
  ],
  start: [0.45, 0.56],
};
