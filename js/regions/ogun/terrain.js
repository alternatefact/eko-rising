// Ogun's land: inland country, the Ogun and Yewa rivers running south
// through forest, savanna in the north, and the granite hills round Olúmọ
// Rock where the Ẹ̀gbá built Abẹ́òkúta. No sea: the land runs off every edge.

export const TERRAIN = {
  coastY: 2,
  beach: 0,
  creekY: 3,
  creekHalf: 0,
  lagoons: [{ x: 0.36, y: 0.3, rx: 0.05, ry: 0.035 }],
  channels: [],
  islands: [],
  rivers: [
    { from: [0.6, 0], to: [0.54, 1], fordEvery: 9, wide: true },
    { from: [0.13, 0], to: [0.19, 1], fordEvery: 8 },
    { from: [0.36, 0.32], to: [0.56, 0.5], fordEvery: 7 },
  ],
  savanna: 0.36,
  hillLevel: 0.63,
  forestLevel: 0.55,
  ironClusters: 4,
  start: [0.42, 0.64],
  // An old red-mud pit just off the path, a short walk from the farmstead.
  mudPitAt: [10, 15, 12],
};
