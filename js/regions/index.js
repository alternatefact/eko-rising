// The lands a game can be played in. A home kingdom on the map of Nigeria
// (js/campaign/provinces.js) names its region with `start`; a chapter opened
// by winning another (Ogun) with `region`. To open one, add its region file
// here and point its province at it.

import { LAGOS } from './lagos.js';
import { OGUN } from './ogun.js';
import { KANO } from './kano.js';

export const REGIONS = { lagos: LAGOS, ogun: OGUN, kano: KANO };

// Chapters that open only when another is won: Ogun, by breaking the host of
// Benin in Lagos.
export const LOCKED = { ogun: 'Break the host of Benin in Èkó to open the Ogun chapter here.' };
