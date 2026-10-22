// The culture packs (DESIGN.md, culture packs). A region names its people's
// culture; the pack gives the names, words and threats, and the rules stay
// the same for everyone.

import { YORUBA } from './yoruba.js';
import { HAUSA } from './hausa.js';
import { EDO } from './edo.js';
import { IGBO } from './igbo.js';
import { ITSEKIRI } from './itsekiri.js';
import { RESOURCES } from '../data/resources.js';
import { BUILDINGS } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { ERAS } from '../data/eras.js';

export const CULTURES = { yoruba: YORUBA, hausa: HAUSA, edo: EDO, igbo: IGBO, itsekiri: ITSEKIRI };

// The beasts a culture's bush sends against the first farmers. They hunt the
// same way; only the name, the look and how they come change
// (sim/animals.js). Leopards hunt alone, so it is a mother with her grown
// cubs; crocodiles come up out of the creek.
const comeOut = (plural) => (n) => `A pack of ${n} ${plural} has come out of the bush!`;
export const PREDATORS = {
  wolf: { name: 'wolf', plural: 'wolves', icon: '🐺', came: comeOut('wolves') },
  hyena: { name: 'hyena', plural: 'hyenas', icon: '🐾', came: comeOut('hyenas') },
  leopard: { name: 'leopard', plural: 'leopards', icon: '🐆', came: (n) => `A leopard and her ${n - 1} grown cubs have come out of the forest!` },
  crocodile: { name: 'crocodile', plural: 'crocodiles', icon: '🐊', came: (n) => `${n} crocodiles have come up out of the creek!` },
};

export const cultureOf = (st) => CULTURES[st?.region?.culture] || YORUBA;

// The culture pack each people of the lands belongs to, where one exists, so
// that their allies can hire their elite unit. Peoples without a pack yet
// (Egun, Esan, Ika, Igala, Urhobo, Isoko, Ijaw, Fulani) lend none.
export const PEOPLE_CULTURE = {
  Awori: 'yoruba', Egba: 'yoruba', Ijebu: 'yoruba', Owu: 'yoruba', Remo: 'yoruba', Yewa: 'yoruba', Ilaje: 'yoruba', Owo: 'yoruba',
  Kano: 'hausa', Katsina: 'hausa', Zazzau: 'hausa', Rano: 'hausa', Daura: 'hausa',
  Edo: 'edo', Igbo: 'igbo', Itsekiri: 'itsekiri',
};
export const predatorOf = (st) => PREDATORS[cultureOf(st).predator] || PREDATORS.wolf;

// Every people any culture knows, for newcomers from a conquered village.
export const ALL_ORIGINS = Object.values(CULTURES).flatMap((c) => c.origins);

// The era's name in the people's own language.
export const eraName = (st, k) => cultureOf(st).eraNames[k] || '';
// What the age is like, in this land.
export const eraBlurb = (st, k) => cultureOf(st).eraBlurbs?.[k] || ERAS[k]?.blurb || '';

// The names the data files carry, as they are: their local words are
// Yoruba, since Èkó was built first.
const BASE = {
  buildings: Object.fromEntries(Object.entries(BUILDINGS).map(([id, d]) => [id, { name: d.name, yo: d.yo, ups: (d.upgrades || []).map((u) => u.yo) }])),
  units: Object.fromEntries(Object.entries(UNITS).map(([id, u]) => [id, u.yo])),
};

// Labels are set when a game starts or loads. A pack with `words` puts its
// own local names for buildings and soldiers in place of the Yoruba ones,
// and leaves out any it has none for. The staple is always the resource
// `yam` underneath; a culture shows it as its own crop.
export function applyCulture(culture = YORUBA) {
  const words = culture.words;
  for (const [id, d] of Object.entries(BUILDINGS)) {
    const base = BASE.buildings[id];
    const w = words?.buildings?.[id];
    d.name = (typeof w === 'object' && w.name) || base.name;
    d.yo = words ? (typeof w === 'object' ? w.yo : w) || '' : base.yo;
    (d.upgrades || []).forEach((u, k) => (u.yo = words ? '' : base.ups[k]));
  }
  for (const [id, u] of Object.entries(UNITS)) u.yo = words ? words.units?.[id] || '' : BASE.units[id];
  const s = culture.staple;
  Object.assign(RESOURCES.yam, { name: s.name, icon: s.icon });
  const farm = BUILDINGS.farm;
  Object.assign(farm, { name: s.farm, yo: s.farmYo, desc: s.desc });
  Object.assign(farm.upgrades[0], { name: s.great, desc: s.greatDesc });
}
