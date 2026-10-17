// Walking along paths. Positions are in tile units; tile (x, y) has its
// centre at (x + 0.5, y + 0.5).

import { findPath } from '../world/path.js';
import { WALK, CANOE_SPEED, T, treeBlocks } from '../world/terrain.js';

export function pathOpts(st, e, extra) {
  const enemy = e.owner && e.owner !== 'player';
  return { canoe: e.owner === 'player' && st.flags.canoes, enemy, ...extra };
}

// Sets a path toward (tx, ty). Returns false if no route exists.
export function goTo(st, e, tx, ty, extra = {}) {
  const path = findPath(st, Math.floor(e.x), Math.floor(e.y), Math.floor(tx), Math.floor(ty), pathOpts(st, e, extra));
  if (!path) {
    e.path = null;
    return false;
  }
  e.path = path;
  e.pi = 0;
  return true;
}

export function speedAt(st, x, y) {
  const i = Math.floor(y) * st.W + Math.floor(x);
  const t = st.terrain[i];
  const w = WALK[t];
  if (w === 0) return t === T.OCEAN ? 0.3 : CANOE_SPEED;
  return w;
}

// Advances `e` along its path. Returns true when the path is finished (or
// there is none). `blocked(i)` may veto stepping onto tile i, in which case
// the walker stops and the caller decides what to do.
export function stepMove(st, e, dt, speed, blocked) {
  if (!e.path || e.pi >= e.path.length) {
    e.path = null;
    return true;
  }
  let budget = speed * speedAt(st, e.x, e.y) * dt;
  while (budget > 0 && e.path && e.pi < e.path.length) {
    const next = e.path[e.pi];
    if (blocked && blocked(next)) {
      e.blockedBy = next;
      return false;
    }
    const nx = (next % st.W) + 0.5;
    const ny = Math.floor(next / st.W) + 0.5;
    const dx = nx - e.x;
    const dy = ny - e.y;
    const d = Math.hypot(dx, dy);
    if (dx) e.facing = dx > 0 ? 1 : -1;
    if (d <= budget) {
      e.x = nx;
      e.y = ny;
      budget -= d;
      e.pi++;
    } else {
      e.x += (dx / d) * budget;
      e.y += (dy / d) * budget;
      budget = 0;
    }
  }
  e.blockedBy = -1;
  if (e.pi >= e.path.length) {
    e.path = null;
    return true;
  }
  return false;
}

// Short stroll to a random passable tile near (ax, ay).
export function wander(st, e, ax, ay, r) {
  for (let k = 0; k < 6; k++) {
    const x = Math.floor(ax + st.rng.range(-r, r));
    const y = Math.floor(ay + st.rng.range(-r, r));
    if (x < 0 || y < 0 || x >= st.W || y >= st.H) continue;
    const i = y * st.W + x;
    if (WALK[st.terrain[i]] === 0 || treeBlocks(st.trees, st.felled, st.terrain, i)) continue;
    if (goTo(st, e, x, y, { max: 600 })) return true;
  }
  return false;
}
