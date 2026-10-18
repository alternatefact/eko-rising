// Map queries the simulation leans on: neighbourhood searches, territory,
// and what the player can currently see.

import { T, F, WALK, isWater, isLand, treeBlocks } from '../world/terrain.js';
import { BUILDINGS } from '../data/buildings.js';

// Tile offsets within radius 24, nearest first, for "find the closest X".
export const OFFSETS = (() => {
  const out = [];
  const R = 24;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= R) out.push([dx, dy, d]);
    }
  }
  out.sort((a, b) => a[2] - b[2]);
  return out;
})();

const circles = new Map();
function circle(r) {
  if (!circles.has(r)) circles.set(r, OFFSETS.filter((o) => o[2] <= r + 0.3));
  return circles.get(r);
}

// Returns the closest matching tile index to (cx, cy), or -1. With
// `spread` > 1 it picks at random among the first few hits so that several
// workers don't all converge on the same tree.
export function findNear(st, cx, cy, radius, pred, spread = 1) {
  const W = st.W;
  const H = st.H;
  const hits = [];
  for (const [dx, dy, d] of OFFSETS) {
    if (d > radius) break;
    const x = cx + dx;
    const y = cy + dy;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * W + x;
    if (pred(i)) {
      hits.push(i);
      if (hits.length >= spread) break;
    }
  }
  if (!hits.length) return -1;
  return hits[Math.floor(st.rng.next() * hits.length)];
}

export function centerOf(b) {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

export function distToRect(px, py, b) {
  const dx = Math.max(b.x - px, 0, px - (b.x + b.w));
  const dy = Math.max(b.y - py, 0, py - (b.y + b.h));
  return Math.hypot(dx, dy);
}

export function adjacentToWater(st, i) {
  const W = st.W;
  const x = i % W;
  const y = (i / W) | 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= st.H) continue;
      if (isWater(st.terrain[ny * W + nx])) return true;
    }
  }
  return false;
}

// --- Territory --------------------------------------------------------
// 1 = yours, 2 = another people's land. You may only build on your own.

export function influenceOf(st, b) {
  const def = BUILDINGS[b.type];
  if (!def.influence) return 0;
  if (b.type === 'compound' || b.type === 'palace') return def.influence + st.era * 2;
  return def.influence;
}

export function computeTerritory(st) {
  const W = st.W;
  const H = st.H;
  const terr = st.territory;
  terr.fill(0);
  const paint = (cx, cy, r, v, overwrite) => {
    for (const [dx, dy, d] of circle(Math.min(24, r))) {
      const x = Math.floor(cx + dx);
      const y = Math.floor(cy + dy);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (overwrite || terr[i] === 0) terr[i] = v;
    }
  };
  for (const f of st.factions) {
    if (f.status === 'conquered' || f.status === 'vassal') continue;
    paint(f.x + 0.5, f.y + 0.5, f.radius, 2, true);
  }
  for (const b of st.buildings) {
    if (b.owner !== 'player') continue;
    const r = influenceOf(st, b);
    if (r) paint(b.x + b.w / 2, b.y + b.h / 2, r, 1, false);
  }
  for (const f of st.factions) {
    if (f.status === 'conquered' || f.status === 'vassal') paint(f.x + 0.5, f.y + 0.5, 8, 1, true);
  }
  st.territoryVersion++;
}

// --- Vision ---------------------------------------------------------------

export function computeVisibility(st) {
  const W = st.W;
  const H = st.H;
  const vis = st.visible;
  const exp = st.explored;
  vis.fill(0);
  let fresh = 0;
  const see = (cx, cy, r) => {
    const ix = Math.floor(cx);
    const iy = Math.floor(cy);
    for (const [dx, dy] of circle(r)) {
      const x = ix + dx;
      const y = iy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      vis[i] = 1;
      if (!exp[i]) {
        exp[i] = 1;
        fresh++;
        if (st.terrain[i] === T.OCEAN) st.stats.oceanSeen++;
      }
    }
  };
  for (const b of st.buildings) {
    if (b.owner !== 'player') continue;
    const def = BUILDINGS[b.type];
    see(b.x + b.w / 2, b.y + b.h / 2, def.vision || 4 + Math.max(b.w, b.h) / 2);
  }
  for (const c of st.citizens) if (!c.stranger) see(c.x, c.y, 3);
  for (const u of st.units) if (u.owner === 'player') see(u.x, u.y, u.vision);
  for (const f of st.factions) if (f.status === 'conquered' || f.status === 'vassal' || f.status === 'allied') see(f.x + 0.5, f.y + 0.5, 5);
  // Places the story lets you watch for a while (a lookout's view).
  if (st.vistas?.length) {
    st.vistas = st.vistas.filter((v) => st.time.t < v.until);
    for (const v of st.vistas) see(v.x, v.y, v.r);
  }
  if (fresh) {
    st.stats.explored += fresh;
    st.fogVersion++;
  }
  st.visVersion++;
}

// Let the player watch a place for a while (a lookout's view), from now:
// the game stands still while a story message is open.
export function addVista(st, x, y, r, seconds) {
  st.vistas = [...(st.vistas || []), { x, y, r, until: st.time.t + seconds }];
  computeVisibility(st);
}

export function revealAround(st, cx, cy, r) {
  for (const [dx, dy] of circle(r)) {
    const x = Math.floor(cx) + dx;
    const y = Math.floor(cy) + dy;
    if (x < 0 || y < 0 || x >= st.W || y >= st.H) continue;
    const i = y * st.W + x;
    if (!st.explored[i]) {
      st.explored[i] = 1;
      st.stats.explored++;
    }
  }
  st.fogVersion++;
}

// A land tile next to water, close to `near`, reachable on foot from home.
// Used for foreign landings and ship anchorages.
export function findLanding(st, nx, ny, minDist, prefer) {
  let best = -1;
  let bestD = Infinity;
  const W = st.W;
  for (let i = 0; i < st.terrain.length; i++) {
    if (!st.reach[i] || !isLand(st.terrain[i]) || st.occ[i]) continue;
    if (!adjacentToWater(st, i)) continue;
    const x = i % W;
    const y = (i / W) | 0;
    const d = Math.hypot(x - nx, y - ny);
    if (d < minDist) continue;
    let score = d;
    if (prefer === 'west') score += x * 0.6;
    if (prefer === 'south') score -= y * 0.4;
    if (score < bestD) {
      bestD = score;
      best = i;
    }
  }
  return best;
}

export function isPalm(st, i) {
  return st.feature[i] === F.PALM;
}

// --- Gaps in the fence -------------------------------------------------------------

// Where a wolf or a raider could still get in: walk out from the house
// through open ground (fences, gates, water and standing trees stop it) and
// see where it gets out. Each way out is marked at its narrowest point, best
// of all right beside a fence section; then that spot is treated as closed
// and the search goes again, so a wide opening shows as a row of marks.
// Sections still being built count as closed.
export function fenceGaps(st, max = 12) {
  const home = st.buildings.find((b) => b.type === 'compound' && b.owner === 'player' && !b.dead);
  if (!home) return { closed: false, gaps: [] };
  const W = st.W;
  const H = st.H;
  const cx = home.x + 1;
  const cy = home.y + 1;
  const R = 24;
  const fence = (i) => {
    const b = st.byId.get(st.occ[i]);
    return !!b && !b.dead && b.owner === 'player' && (b.wall || b.gate);
  };
  const extra = new Set();
  const solid = (i) => extra.has(i) || fence(i) || WALK[st.terrain[i]] === 0 || treeBlocks(st.trees, st.felled, st.terrain, i);
  const dist = (i) => Math.hypot((i % W) - cx, Math.floor(i / W) - cy);
  // How far out the fence runs, where there is one.
  let ring = 0;
  let n = 0;
  for (let y = cy - R; y <= cy + R; y++) {
    for (let x = cx - R; x <= cx + R; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (fence(i)) {
        ring += dist(i);
        n++;
      }
    }
  }
  ring = n ? ring / n : 7.5;
  const gaps = [];
  const start = cy * W + cx;
  for (let k = 0; k < max; k++) {
    const prev = new Map([[start, -1]]);
    const queue = [start];
    let out = -1;
    for (let q = 0; q < queue.length && out < 0; q++) {
      const i = queue[q];
      const x = i % W;
      const y = (i / W) | 0;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
        const j = ny * W + nx;
        if (prev.has(j) || solid(j)) continue;
        prev.set(j, i);
        if (Math.max(Math.abs(nx - cx), Math.abs(ny - cy)) > R) {
          out = j;
          break;
        }
        queue.push(j);
      }
    }
    if (out < 0) break;
    // The narrowest point along the way out.
    let best = -1;
    let bestScore = -Infinity;
    for (let i = out; i !== -1; i = prev.get(i)) {
      const d = dist(i);
      if (d < 3 || d > ring + 9) continue;
      const x = i % W;
      const y = (i / W) | 0;
      let shut = 0;
      let byFence = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const j = (y + dy) * W + x + dx;
          if (solid(j)) shut++;
          if (fence(j)) byFence = true;
        }
      }
      const score = shut * 10 + (byFence ? 15 : 0) - Math.abs(d - ring) * 2;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) break;
    gaps.push({ x: best % W, y: Math.floor(best / W) });
    extra.add(best);
  }
  return { closed: gaps.length === 0, gaps };
}

