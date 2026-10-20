// The map of Nigeria's old kingdoms (DESIGN.md, The Nigeria map): 28
// provinces from the kingdoms and peoples' lands of around 1600. The
// shapes are in geometry.js; this is who held each, what it is today, and
// where a game can start.
//
//   short   the name on the map
//   area    north, middle (the Middle Belt), west or south
//   holder  who held it, around 1600
//   today   the states it roughly covers now
//   council lands governed by councils of elders, not kings
//   overlord the province it paid tribute to
//   start   the region file a home kingdom plays (js/regions), when it has one
//   region  a chapter played here that is not a home start (Ogun)
//   culture the culture pack of its people, where there is one
//   seat    the capital, [longitude, latitude], marked on the map
//   labelAt where to put the name when the shape is too small for it
//   coming  a home kingdom still to be built, and in which milestone

import { GEOMETRY } from './geometry.js';

export const PROVINCES = [
  { id: 'kanem', name: 'Kanem-Bornu', short: 'Kanem-Bornu', area: 'north', holder: 'The Mai, at Ngazargamu', today: 'Borno, Yobe' },
  { id: 'kano', name: 'Kano', short: 'Kano', area: 'north', holder: 'The Sarki of Kano', today: 'Kano, Jigawa', culture: 'hausa', start: 'kano', seat: [8.52, 12.0] },
  { id: 'katsina', name: 'Katsina and Daura', short: 'Katsina', area: 'north', holder: 'The Sarki of Katsina', today: 'Katsina' },
  { id: 'zazzau', name: 'Zazzau', short: 'Zazzau', area: 'north', holder: 'The Sarki of Zazzau; Queen Amina in the 16th century', today: 'Kaduna, FCT' },
  { id: 'gobir', name: 'Gobir and Zamfara', short: 'Gobir', area: 'north', holder: 'The Sarkin Gobir and the Sarkin Zamfara', today: 'Sokoto, Zamfara' },
  { id: 'kebbi', name: 'Kebbi', short: 'Kebbi', area: 'north', holder: 'The Kanta of Kebbi', today: 'Kebbi' },
  { id: 'bauchi', name: 'Bauchi and Gombe lands', short: 'Bauchi', area: 'north', holder: 'Many peoples, no single ruler', today: 'Bauchi, Gombe', council: true },
  { id: 'upperbenue', name: 'Upper Benue lands', short: 'Upper Benue', area: 'north', holder: 'Many peoples, no single ruler', today: 'Adamawa', council: true },
  { id: 'nupe', name: 'Nupe', short: 'Nupe', area: 'middle', holder: 'The Etsu Nupe', today: 'Niger' },
  { id: 'borgu', name: 'Borgu', short: 'Borgu', area: 'middle', holder: 'The king of Bussa', today: 'West Niger, north Kwara' },
  { id: 'kwararafa', name: 'Kwararafa', short: 'Kwararafa', area: 'middle', holder: 'The Aku Uka of the Jukun, at Wukari', today: 'Taraba, Nasarawa' },
  { id: 'tiv', name: 'Tiv lands', short: 'Tiv', area: 'middle', holder: 'Elders’ councils', today: 'Benue', council: true },
  { id: 'plateau', name: 'Plateau lands', short: 'Plateau', area: 'middle', holder: 'Berom, Ngas and other peoples', today: 'Plateau', council: true },
  { id: 'igala', name: 'Igala', short: 'Igala', area: 'middle', holder: 'The Ata of Igala, at Idah', today: 'Kogi' },
  { id: 'oyo', name: 'Ọ̀yọ́', short: 'Ọ̀yọ́', area: 'west', holder: 'The Alaafin, at Ọ̀yọ́-Ilé', today: 'Oyo, south Kwara' },
  { id: 'ife', name: 'Ifẹ̀ and Ìjẹ̀ṣà', short: 'Ifẹ̀', area: 'west', holder: 'The Ooni of Ifẹ̀; the Owa Obokun at Ilesa', today: 'Osun' },
  { id: 'ekiti', name: 'Ekiti kingdoms', short: 'Ekiti', area: 'west', holder: 'The Ekiti kings', today: 'Ekiti' },
  { id: 'ondo', name: 'Ondo and Owo', short: 'Ondo', area: 'west', holder: 'The Olowo of Owo; the Osemawe of Ondo', today: 'Ondo' },
  { id: 'ijebu', name: 'Ìjẹ̀bú', short: 'Ìjẹ̀bú', area: 'west', holder: 'The Awùjalẹ̀, at Ìjẹ̀bú-Òde', today: 'East Ogun', culture: 'yoruba', region: 'ogun' },
  { id: 'egba', name: 'Ẹ̀gbá and Awori towns', short: 'Ẹ̀gbá', area: 'west', holder: 'Forest towns under Ọ̀yọ́’s sway', today: 'West Ogun', culture: 'yoruba', overlord: 'oyo', region: 'ogun' },
  { id: 'eko', name: 'Èkó', short: 'Èkó', area: 'west', holder: 'The Ọba of Èkó, paying tribute to Benin', today: 'Lagos', culture: 'yoruba', overlord: 'benin', start: 'lagos', seat: [3.4, 6.45], labelAt: [62, 668] },
  { id: 'benin', name: 'Benin', short: 'Benin', area: 'south', holder: 'The Oba of Benin', today: 'Edo', culture: 'edo', seat: [5.63, 6.34], coming: 4 },
  { id: 'warri', name: 'Warri, Urhobo and Isoko', short: 'Warri', area: 'south', holder: 'The Olu of Warri; Urhobo and Isoko clans', today: 'Delta' },
  { id: 'delta', name: 'Delta city-states', short: 'Delta', area: 'south', holder: 'The trading houses of Bonny, Kalabari, Nembe and Okrika', today: 'Rivers, Bayelsa' },
  { id: 'calabar', name: 'Old Calabar and Ibibio lands', short: 'Calabar', area: 'south', holder: 'Efik trading houses; Ibibio and Annang councils', today: 'Cross River, Akwa Ibom' },
  { id: 'nri', name: 'Nri and Onitsha', short: 'Nri', area: 'south', holder: 'The Eze Nri, a priest-king; the Obi of Onitsha', today: 'Anambra', culture: 'igbo', seat: [6.98, 6.13], coming: 4 },
  { id: 'aro', name: 'Aro lands', short: 'Aro', area: 'south', holder: 'The Aro, through their oracle at Arochukwu', today: 'Abia, Imo' },
  { id: 'igbonorth', name: 'Northern Igbo lands', short: 'N. Igbo', area: 'south', holder: 'Village councils', today: 'Enugu, Ebonyi', council: true },
];

export const PROVINCE = Object.fromEntries(PROVINCES.map((p) => [p.id, { ...p, ...GEOMETRY.provinces[p.id] }]));

// A longitude and latitude on the map.
export function project(lon, lat) {
  const p = GEOMETRY.projection;
  return [(lon - p.lon0) * p.k * p.scale, (p.lat1 - lat) * p.scale];
}
