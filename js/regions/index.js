// The campaign map. Lagos is chapter one; every other state is a chapter
// still to be written. To open one, add its region file and set `region`.

import { LAGOS } from './lagos.js';

export const REGIONS = { lagos: LAGOS };

// A tile cartogram of Nigeria's 36 states and the FCT: [name, column, row].
export const STATES = [
  ['Sokoto', 1, 0], ['Katsina', 3, 0], ['Kano', 4, 0], ['Jigawa', 5, 0], ['Yobe', 6, 0], ['Borno', 7, 0],
  ['Kebbi', 0, 1], ['Zamfara', 2, 1], ['Kaduna', 3, 1], ['Bauchi', 5, 1], ['Gombe', 6, 1], ['Adamawa', 7, 1],
  ['Niger', 1, 2], ['FCT', 3, 2], ['Nasarawa', 4, 2], ['Plateau', 5, 2], ['Taraba', 6, 2],
  ['Oyo', 0, 3], ['Kwara', 1, 3], ['Ekiti', 2, 3], ['Kogi', 3, 3], ['Enugu', 4, 3], ['Benue', 5, 3],
  ['Ogun', 0, 4], ['Osun', 1, 4], ['Ondo', 2, 4], ['Edo', 3, 4], ['Anambra', 4, 4], ['Ebonyi', 5, 4], ['Cross River', 6, 4],
  ['Lagos', 0, 5, 'lagos'], ['Delta', 3, 5], ['Imo', 4, 5], ['Abia', 5, 5], ['Akwa Ibom', 6, 5],
  ['Bayelsa', 3, 6], ['Rivers', 4, 6],
];

// Chapters planned next, shown as "coming soon" on the map.
export const NEXT_UP = ['Ogun', 'Oyo', 'Edo'];
