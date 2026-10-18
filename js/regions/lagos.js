// Chapter one: Lagos (Èkó). The land, its peoples, and the history that
// washes up on its shore — arriving when the player's choices bring it.
//
// The chapter is in parts under regions/lagos/: the terrain template, the
// peoples and places, the events, the guided opening and the goals. To add
// another state, give it the same shape. See regions/index.js.

import { TERRAIN } from './lagos/terrain.js';
import { FOREIGN, FACTIONS, POIS } from './lagos/factions.js';
import { EVENTS } from './lagos/events.js';
import { STORY } from './lagos/story.js';
import { OBJECTIVES } from './lagos/objectives.js';

export { fenceState, fenced } from './lagos/story.js';

export const LAGOS = {
  id: 'lagos',
  name: 'Lagos',
  yo: 'Èkó',
  width: 112,
  height: 84,
  defaultName: 'Èkó',
  // The founders find the house wrecked, and mend it first.
  wreckedStart: true,

  terrain: TERRAIN,
  foreign: FOREIGN,
  factions: FACTIONS,
  pois: POIS,
  events: EVENTS,
  story: STORY,
  objectives: OBJECTIVES,
};
