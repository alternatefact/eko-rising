// The land of Lagos: the template the map generator builds it from
// (see world/generate.js): lagoon, creeks and islands, rivers, forest and
// savanna, and where the founders' house stands.

export const TERRAIN = {
  coastY: 0.885,
  beach: 0.035,
  creekY: 0.818,
  creekHalf: 0.95,
  lagoons: [
    { x: 0.66, y: 0.675, rx: 0.22, ry: 0.085 },
    { x: 0.9, y: 0.745, rx: 0.085, ry: 0.05 },
  ],
  channels: [{ x: 0.535, half: 1.3, y0: 0.7 }],
  islands: [{ x: 0.56, y: 0.725, r: 0.026 }],
  rivers: [
    { from: [0.34, 0], to: [0.47, 0.62], fordEvery: 9, wide: true },
    { from: [0.79, 0], to: [0.74, 0.6], fordEvery: 8 },
  ],
  savanna: 0.2,
  hillLevel: 0.69,
  forestLevel: 0.57,
  ironClusters: 3,
  start: [0.4, 0.56],
};
