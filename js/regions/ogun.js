// Chapter two: Ogun State, opened by breaking the host of Benin in Lagos.
// The founders come north and start again from scratch, but with what they
// learned in Lagos (`inherits`): its buildings, crafts and ages. The land's
// history brings the challenges: the Alaafin's horsemen, the Ìjẹ̀bú gunmen,
// and the host of Dahomey. This file puts the chapter together from its
// parts in ogun/.

import { TERRAIN } from './ogun/terrain.js';
import { FOREIGN, FACTIONS, POIS } from './ogun/factions.js';
import { EVENTS } from './ogun/events.js';
import { OBJECTIVES } from './ogun/objectives.js';

export const OGUN = {
  id: 'ogun',
  name: 'Ogun',
  yo: 'Ògùn',
  width: 112,
  height: 84,
  defaultName: 'Ìbàrà',
  terrain: TERRAIN,

  // What the founders bring from Lagos: the age it reached, its crafts and
  // crops, the year and some money (sim legacyOf). A game started without a
  // record of it (a test, or an old browser) assumes a Lagos in the Compound
  // age, the least it takes to break the host of Benin.
  inherits: { from: 'lagos', fallback: { from: 'lagos', land: 'Lagos', era: 1, year: 1440, tech: [], purse: 0 } },

  // Who comes north with the founders, and what they carry: a new start.
  startKit: {
    res: { wood: 40, yam: 40, meat: 10 },
    settlers: 4,
    soldiers: { spearman: 4 },
    buildings: [],
  },

  foreign: FOREIGN,
  factions: FACTIONS,
  pois: POIS,
  events: EVENTS,
  story: [],
  objectives: OBJECTIVES,
};
