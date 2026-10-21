// A home kingdom of the delta: Warri, the Itsekiri kingdom of the creeks.
// The same guided opening as Èkó in Itsekiri words, then the land's own
// history: the prince from Benin, trade with the Urhobo, the Portuguese, the
// regatta, and the Oba of Benin's war fleet. Its parts are in warri/.

import { TERRAIN } from './warri/terrain.js';
import { FOREIGN, FACTIONS, POIS } from './warri/factions.js';
import { EVENTS } from './warri/events.js';
import { STORY } from './warri/story.js';
import { OBJECTIVES } from './warri/objectives.js';

export const WARRI = {
  id: 'warri',
  name: 'Warri',
  yo: 'Iwere',
  culture: 'itsekiri',
  width: 112,
  height: 84,
  defaultName: 'Ijala',
  wreckedStart: true,

  terrain: TERRAIN,
  foreign: FOREIGN,
  factions: FACTIONS,
  pois: POIS,
  events: EVENTS,
  story: STORY,
  objectives: OBJECTIVES,
};
