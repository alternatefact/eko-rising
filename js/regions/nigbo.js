// A home land of the south-east: the northern Igbo country, governed by its
// elders and village councils, not by kings. The same guided opening as Èkó
// in Igbo words, then the land's own history: the four market days, the
// priests of Nri, the New Yam festival, the bronzes in the earth, and the Aro
// war bands. Its parts are in nigbo/.

import { TERRAIN } from './nigbo/terrain.js';
import { FOREIGN, FACTIONS, POIS } from './nigbo/factions.js';
import { EVENTS } from './nigbo/events.js';
import { STORY } from './nigbo/story.js';
import { OBJECTIVES } from './nigbo/objectives.js';

export const NIGBO = {
  id: 'nigbo',
  name: 'Northern Igbo',
  yo: 'Igbo',
  culture: 'igbo',
  width: 112,
  height: 84,
  defaultName: 'Umunwankwo',
  wreckedStart: true,

  terrain: TERRAIN,
  foreign: FOREIGN,
  factions: FACTIONS,
  pois: POIS,
  events: EVENTS,
  story: STORY,
  objectives: OBJECTIVES,
};
