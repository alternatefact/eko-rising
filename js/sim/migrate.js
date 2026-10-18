// Saves carry the version of their shape. Each step below upgrades a save by
// one version, so a save made by any game since version 4 still loads. When
// the shape of the game state changes, raise SAVE_VERSION and add the step
// that brings the previous version up to it (see DESIGN.md).

import { BUILDINGS, buildWork } from '../data/buildings.js';

export const SAVE_VERSION = 5;

// The oldest save that can still be upgraded.
const OLDEST = 4;

const STEPS = {
  // 4 → 5. Every building carries its building-site fields. Saves from
  // before builders have none: anything still going up there is finished by
  // the builders now.
  4(data) {
    for (const b of data.buildings) {
      if (b.rising !== undefined) continue;
      b.rising = b.built < 1;
      b.work = buildWork(BUILDINGS[b.type]);
      b.builders = [];
      b.haul = {};
      b.got = 0;
      b.need = 0;
    }
  },
};

// Brings saved data up to SAVE_VERSION in place. Returns the version it was
// saved with.
export function migrate(data) {
  const from = data.version;
  if (!Number.isInteger(from) || from < OLDEST) throw new Error('This save is from a much older version of the game and cannot be opened. Please start a new game.');
  if (from > SAVE_VERSION) throw new Error('This save is from a newer version of the game. Reload the page to get the latest version, then open it again.');
  while (data.version < SAVE_VERSION) {
    STEPS[data.version](data);
    data.version++;
  }
  return from;
}
