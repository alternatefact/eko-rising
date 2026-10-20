// A home kingdom of the north: Kano, the Hausa city that grew round Dala
// hill (DESIGN.md, the four starting cultures). The same guided opening as
// Èkó in Hausa words, then the land's own history: the Hausa kingdoms
// around it, the desert caravans and the Durbar, and the host of Kwararafa
// from the south. Its parts are in kano/.

import { TERRAIN } from './kano/terrain.js';
import { FOREIGN, FACTIONS, POIS } from './kano/factions.js';
import { EVENTS } from './kano/events.js';
import { STORY } from './kano/story.js';
import { OBJECTIVES } from './kano/objectives.js';

export const KANO = {
  id: 'kano',
  name: 'Kano',
  yo: 'Kano',
  culture: 'hausa',
  width: 112,
  height: 84,
  defaultName: 'Dala',
  // As at Èkó, the founders find the house wrecked, and mend it first.
  wreckedStart: true,

  terrain: TERRAIN,
  foreign: FOREIGN,
  factions: FACTIONS,
  pois: POIS,
  events: EVENTS,
  story: STORY,
  objectives: OBJECTIVES,
};
