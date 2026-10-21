// A home kingdom of the south: Benin, the Edo kingdom of the forest
// (DESIGN.md, the four starting cultures). The same guided opening as Èkó in
// Edo words, then the land's own history: walls and moats, the Portuguese at
// Ughoton, the bronze casters, Igue, and the host of the Igala kingdom from
// Idah. Its parts are in benin/.

import { TERRAIN } from './benin/terrain.js';
import { FOREIGN, FACTIONS, POIS } from './benin/factions.js';
import { EVENTS } from './benin/events.js';
import { STORY } from './benin/story.js';
import { OBJECTIVES } from './benin/objectives.js';

export const BENIN = {
  id: 'benin',
  name: 'Benin',
  yo: 'Ẹdo',
  culture: 'edo',
  width: 112,
  height: 84,
  defaultName: 'Igodomigodo',
  wreckedStart: true,

  terrain: TERRAIN,
  foreign: FOREIGN,
  factions: FACTIONS,
  pois: POIS,
  events: EVENTS,
  story: STORY,
  objectives: OBJECTIVES,
};
