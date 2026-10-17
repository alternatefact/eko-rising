// Tile vocabulary shared by the generator, the simulation and the renderer.

export const TILE = 32; // world pixels per tile at zoom 1

export const T = {
  OCEAN: 0,
  LAGOON: 1,
  RIVER: 2,
  SAND: 3,
  MANGROVE: 4,
  GRASS: 5,
  FOREST: 6,
  SAVANNA: 7,
  HILL: 8,
  FORD: 9,
};

export const TERRAIN_INFO = {
  [T.OCEAN]: { name: 'Atlantic Ocean', water: true, deep: true },
  [T.LAGOON]: { name: 'Lagoon', water: true },
  [T.RIVER]: { name: 'River', water: true },
  [T.SAND]: { name: 'Beach sand' },
  [T.MANGROVE]: { name: 'Mangrove swamp' },
  [T.GRASS]: { name: 'Fertile grassland', fertile: true },
  [T.FOREST]: { name: 'Rainforest', fertile: true },
  [T.SAVANNA]: { name: 'Savanna', fertile: true },
  [T.HILL]: { name: 'Rocky hills' },
  [T.FORD]: { name: 'River ford' },
};

// Walking speed multiplier per terrain; 0 means a person on foot cannot enter.
export const WALK = {
  [T.OCEAN]: 0,
  [T.LAGOON]: 0,
  [T.RIVER]: 0,
  [T.SAND]: 0.9,
  [T.MANGROVE]: 0.5,
  [T.GRASS]: 1,
  [T.FOREST]: 0.75,
  [T.SAVANNA]: 1,
  [T.HILL]: 0.65,
  [T.FORD]: 0.55,
};

// Speed on lagoon and river water once the town has canoes.
export const CANOE_SPEED = 0.85;

export const F = {
  NONE: 0,
  PALM: 1,
  ROCK: 2,
  IRON: 3,
  CLAY: 4, // a pit of red mud for bricks
  PATH: 5, // a footpath worn through the bush
};

// Planks a tree gives, by the land it grows on: a great rainforest tree, a
// savanna or grassland tree, a mangrove.
export const TREE_PLANKS = { [T.FOREST]: 12, [T.SAVANNA]: 8, [T.GRASS]: 8, [T.MANGROVE]: 6, [T.SAND]: 6, [T.HILL]: 6 };
export const treePlanks = (t) => TREE_PLANKS[t] || 8;

// What stands on a tile with planks in it (see sim: trees, felled).
export const TREE = { STANDING: 0, FELLED: 1, STUMP: 2 };

// Standing trees are walls: nobody walks through a forest, or a thicket of
// mangrove roots, until it is cut.
export const treeBlocks = (trees, felled, terrain, i) => trees[i] > 0 && felled[i] === TREE.STANDING;

export const isWater = (t) => t === T.OCEAN || t === T.LAGOON || t === T.RIVER;
export const isInlandWater = (t) => t === T.LAGOON || t === T.RIVER;
export const isLand = (t) => !isWater(t);
