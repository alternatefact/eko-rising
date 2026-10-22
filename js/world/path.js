// A* over the tile grid. Paths are arrays of tile indices, start excluded.
//
// Options:
//   canoe   lagoon and river tiles are passable (the town owns a canoe yard)
//   creeks  lagoon, river and mangrove are as easy as dry land (war canoes)
//   enemy   the walker is hostile to the player: walls and gates are passable
//           at a high cost, because the walker will smash through them
//   naval   only water is passable (ships)
//   within  stop at any tile whose centre is this close to the target
//   partial if the target cannot be reached, return the path to the closest
//           tile found instead of null
//   max     node expansion budget
//
// Standing trees block everyone: a forest is a wall until it is cut.

import { T, WALK, CANOE_SPEED, TREE } from './terrain.js';

let cache = null;

function buffers(n) {
  if (!cache || cache.n !== n) {
    cache = {
      n,
      g: new Float32Array(n),
      parent: new Int32Array(n),
      stamp: new Uint32Array(n),
      closed: new Uint32Array(n),
      gen: 0,
      heap: new Int32Array(n * 2),
      f: new Float32Array(n),
    };
  }
  cache.gen++;
  if (cache.gen === 0xffffffff) {
    cache.stamp.fill(0);
    cache.closed.fill(0);
    cache.gen = 1;
  }
  return cache;
}

export function tileCost(st, i, opts) {
  const t = st.terrain[i];
  if (opts.naval) return t === T.OCEAN || t === T.LAGOON || t === T.RIVER ? 1 : Infinity;
  let w = WALK[t];
  if (opts.creeks && (t === T.LAGOON || t === T.RIVER || t === T.MANGROVE)) w = 1;
  else if (w === 0) {
    if (opts.canoe && (t === T.LAGOON || t === T.RIVER)) w = CANOE_SPEED;
    else return Infinity;
  }
  if (st.trees[i] && st.felled[i] === TREE.STANDING) return Infinity;
  let c = 1 / w;
  const bid = st.occ[i];
  if (bid) {
    const b = st.byId.get(bid);
    if (b && b.owner === 'player' && (b.wall || b.gate)) {
      if (opts.enemy) c += 10;
      else if (b.wall) return Infinity;
    }
  }
  return c;
}

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

export function findPath(st, sx, sy, tx, ty, opts = {}) {
  const W = st.W;
  const H = st.H;
  sx = Math.max(0, Math.min(W - 1, sx | 0));
  sy = Math.max(0, Math.min(H - 1, sy | 0));
  tx = Math.max(0, Math.min(W - 1, tx | 0));
  ty = Math.max(0, Math.min(H - 1, ty | 0));
  const start = sy * W + sx;
  const goal = ty * W + tx;
  let within = opts.within || 0;
  if (!within && tileCost(st, goal, opts) === Infinity) within = 1.5;
  const tcx = tx + 0.5;
  const tcy = ty + 0.5;
  const reached = (i) => {
    if (i === goal) return true;
    if (!within) return false;
    const x = (i % W) + 0.5;
    const y = ((i / W) | 0) + 0.5;
    return (x - tcx) * (x - tcx) + (y - tcy) * (y - tcy) <= within * within;
  };
  if (reached(start)) return [];

  const b = buffers(W * H);
  const { g, parent, stamp, closed, heap, f } = b;
  const gen = b.gen;
  const max = opts.max || 9000;
  const hw = 1.15;
  const heur = (i) => {
    const dx = Math.abs((i % W) - tx);
    const dy = Math.abs(((i / W) | 0) - ty);
    return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * hw;
  };

  let size = 0;
  const push = (i) => {
    let k = size++;
    heap[k] = i;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (f[heap[p]] <= f[heap[k]]) break;
      const tmp = heap[p];
      heap[p] = heap[k];
      heap[k] = tmp;
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    heap[0] = heap[--size];
    let k = 0;
    for (;;) {
      const l = k * 2 + 1;
      const r = l + 1;
      let m = k;
      if (l < size && f[heap[l]] < f[heap[m]]) m = l;
      if (r < size && f[heap[r]] < f[heap[m]]) m = r;
      if (m === k) break;
      const tmp = heap[m];
      heap[m] = heap[k];
      heap[k] = tmp;
      k = m;
    }
    return top;
  };

  stamp[start] = gen;
  g[start] = 0;
  parent[start] = -1;
  f[start] = heur(start);
  push(start);

  let best = start;
  let bestH = heur(start);
  let expanded = 0;
  let found = -1;

  while (size > 0 && size < heap.length - 8) {
    const cur = pop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    if (reached(cur)) {
      found = cur;
      break;
    }
    if (++expanded > max) break;
    const cx = cur % W;
    const cy = (cur / W) | 0;
    for (const [ox, oy, len] of DIRS) {
      const nx = cx + ox;
      const ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (closed[ni] === gen) continue;
      let c = tileCost(st, ni, opts);
      if (c === Infinity) {
        // Let the walker step onto an impassable goal's edge only via `within`.
        continue;
      }
      if (ox && oy) {
        if (tileCost(st, cy * W + nx, opts) === Infinity || tileCost(st, ny * W + cx, opts) === Infinity) continue;
      }
      const ng = g[cur] + c * len;
      if (stamp[ni] !== gen || ng < g[ni]) {
        stamp[ni] = gen;
        g[ni] = ng;
        parent[ni] = cur;
        const h = heur(ni);
        f[ni] = ng + h;
        if (h < bestH) {
          bestH = h;
          best = ni;
        }
        push(ni);
      }
    }
  }

  let end = found;
  if (end < 0) {
    if (!opts.partial || best === start) return null;
    end = best;
  }
  const out = [];
  for (let i = end; i !== start && i >= 0; i = parent[i]) out.push(i);
  out.reverse();
  return out;
}
