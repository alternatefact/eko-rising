// Builds a region's land from its template: coastline, coastal creek, lagoons,
// islands, rivers with fords, then forests, savanna and hills from noise.
// Resources follow the land: trees in forest and mangrove, palms by the
// water, rock and iron in the hills. What a player can make depends on what
// they find.
//
// Standing trees are walls: the home clearing sits inside a ring of forest,
// open toward the water, and footpaths worn through the bush join it to the
// other peoples, the places worth finding and the red-mud pit the founders
// passed on their way in.

import { Rng, fbm, hash2 } from '../core/rng.js';
import { T, F, WALK, isWater, treePlanks } from './terrain.js';

export function generateWorld(region, seed) {
  const W = region.width;
  const H = region.height;
  const rng = new Rng(seed ^ 0x51ed);
  const tp = region.terrain;
  const n = W * H;
  const terrain = new Uint8Array(n);
  const trees = new Uint8Array(n);
  const feature = new Uint8Array(n);
  const amount = new Uint16Array(n);
  const idx = (x, y) => y * W + x;

  // --- Water bodies and land cover -------------------------------------
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W;
      const ny = y / H;
      const coast = tp.coastY + (fbm(nx * 7, 3.3, seed + 1, 3) - 0.5) * 0.05;
      let t;
      if (ny > coast) {
        t = T.OCEAN;
      } else if (ny > coast - tp.beach) {
        t = T.SAND;
      } else {
        t = landCover(nx, ny, seed, tp);
      }

      // The creek that runs behind the barrier beach the length of the coast.
      const creekY = tp.creekY + (fbm(nx * 5, 9.1, seed + 2, 3) - 0.5) * 0.04;
      if (t !== T.OCEAN && Math.abs(ny - creekY) < tp.creekHalf / H) t = T.LAGOON;

      for (const l of tp.lagoons) {
        const dx = (nx - l.x) / l.rx;
        const dy = (ny - l.y) / l.ry;
        const wob = (fbm(nx * 9, ny * 9, seed + 3, 3) - 0.5) * 0.7;
        if (dx * dx + dy * dy + wob < 1 && t !== T.OCEAN) t = T.LAGOON;
      }

      // The harbour mouth joining the lagoon to the sea.
      for (const ch of tp.channels) {
        if (Math.abs(nx - ch.x) < ch.half / W && ny > ch.y0 && ny <= coast + 0.01) t = ny > coast ? T.OCEAN : T.LAGOON;
      }

      for (const is of tp.islands) {
        const dx = (nx - is.x) * W;
        const dy = (ny - is.y) * H;
        const r = is.r * W * (0.85 + fbm(nx * 11, ny * 11, seed + 4, 2) * 0.3);
        if (dx * dx + dy * dy < r * r) t = dx * dx + dy * dy < (r - 1.4) * (r - 1.4) ? T.GRASS : T.SAND;
      }

      terrain[idx(x, y)] = t;
    }
  }

  // Hills the template names (Dala and Goron Dutse at Kano): rock to quarry.
  for (const hl of tp.hills || []) {
    const cx = hl.x * W;
    const cy = hl.y * H;
    for (let y = Math.max(0, Math.floor(cy - hl.r - 2)); y <= Math.min(H - 1, Math.ceil(cy + hl.r + 2)); y++) {
      for (let x = Math.max(0, Math.floor(cx - hl.r - 2)); x <= Math.min(W - 1, Math.ceil(cx + hl.r + 2)); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + (fbm(x * 0.4, y * 0.4, seed + 61, 2) - 0.5) * 1.6;
        if (d <= hl.r && terrain[idx(x, y)] !== T.OCEAN) terrain[idx(x, y)] = T.HILL;
      }
    }
  }

  // --- Rivers -----------------------------------------------------------
  for (const rv of tp.rivers) carveRiver(terrain, W, H, rv, rng);

  // --- Mangrove fringes around inland water ----------------------------
  const nearInland = distanceField(W, H, (i) => terrain[i] === T.LAGOON || terrain[i] === T.RIVER, 3);
  for (let i = 0; i < n; i++) {
    const t = terrain[i];
    if (t === T.GRASS || t === T.FOREST || t === T.SAND) {
      const d = nearInland[i];
      const x = i % W;
      const y = (i / W) | 0;
      const m = hash2(x, y, seed + 9);
      if ((d === 1 && m < 0.55) || (d === 2 && m < 0.18)) terrain[i] = T.MANGROVE;
    }
  }

  // --- Resources --------------------------------------------------------
  const nearCoast = distanceField(W, H, (i) => isWater(terrain[i]), 7);
  for (let i = 0; i < n; i++) {
    const t = terrain[i];
    const x = i % W;
    const y = (i / W) | 0;
    const r = hash2(x, y, seed + 21);
    if (t === T.FOREST) trees[i] = treePlanks(t);
    else if (t === T.MANGROVE) trees[i] = r < 0.7 ? treePlanks(t) : 0;
    else if (t === T.SAVANNA) trees[i] = r < 0.16 ? treePlanks(t) : 0;
    else if (t === T.GRASS) trees[i] = r < 0.07 ? treePlanks(t) : 0;

    if (trees[i] === 0 && (t === T.SAND || t === T.GRASS) && nearCoast[i] > 0 && nearCoast[i] <= 6) {
      const p = t === T.SAND ? 0.22 : 0.1;
      if (hash2(x, y, seed + 22) < p) {
        feature[i] = F.PALM;
        amount[i] = 12;
      }
    }
    if (t === T.HILL && hash2(x, y, seed + 23) < 0.38) {
      feature[i] = F.ROCK;
      amount[i] = 60 + Math.floor(hash2(x, y, seed + 24) * 80);
    }
  }

  // Iron lies in a few hill clusters, plus wherever the template promises it.
  const hills = [];
  for (let i = 0; i < n; i++) if (terrain[i] === T.HILL) hills.push(i);
  const ironSeeds = [];
  for (let k = 0; k < tp.ironClusters && hills.length; k++) ironSeeds.push(rng.pick(hills));
  for (const p of region.pois) {
    if (p.revealsIron) ironSeeds.push(nearestTile(terrain, W, H, Math.floor(p.at[0] * W), Math.floor(p.at[1] * H), (t) => !isWater(t)));
  }
  for (const s of ironSeeds) {
    const sx = s % W;
    const sy = (s / W) | 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = sx + dx;
        const y = sy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = idx(x, y);
        if (isWater(terrain[i]) || dx * dx + dy * dy > 5 || !rng.chance(0.55)) continue;
        if (terrain[i] !== T.HILL) terrain[i] = T.HILL;
        trees[i] = 0;
        feature[i] = F.IRON;
        amount[i] = 80 + rng.int(0, 70);
      }
    }
  }

  // --- The player's starting land --------------------------------------
  // An abandoned house in a clearing. Forest closes in on the landward
  // side, a natural wall; toward the water the land is open, and that is
  // where a fence will be needed. A few lone trees stand near the house.
  const start = findStart(terrain, W, H, tp.start, rng);
  let wx = 0;
  let wy = 0;
  for (let dy = -12; dy <= 12; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      const x = start.x + dx;
      const y = start.y + dy;
      if (x < 0 || y < 0 || x >= W || y >= H || (!dx && !dy) || !isWater(terrain[idx(x, y)])) continue;
      const d2 = dx * dx + dy * dy;
      wx += dx / d2;
      wy += dy / d2;
    }
  }
  const waterAng = wx || wy ? Math.atan2(wy, wx) : rng.range(0, Math.PI * 2);
  const forestAng = waterAng + Math.PI;
  // What closes in round the clearing: rainforest, or (`ring: 'savanna'`)
  // thorn woodland, every tile a tree; and how far round it goes (`ringArc`,
  // radians either side of the landward way: on dry land with no water to
  // close the rest, nearly all the way).
  const ringT = tp.ring === 'savanna' ? T.SAVANNA : T.FOREST;
  const arc = tp.ringArc ?? 1.75;
  for (let dy = -21; dy <= 21; dy++) {
    for (let dx = -21; dx <= 21; dx++) {
      const x = start.x + dx;
      const y = start.y + dy;
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      const i = idx(x, y);
      if (isWater(terrain[i])) continue;
      const d = Math.hypot(dx, dy);
      let diff = Math.abs(Math.atan2(dy, dx) - forestAng) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      const wob = fbm(x * 0.35, y * 0.35, seed + 41, 2);
      // Room enough for a village: the open ground runs 11 to 13 tiles out.
      const inner = 11 + wob * 2;
      const outer = 16 + wob * 3.5;
      if (d <= inner) {
        terrain[i] = T.GRASS;
        trees[i] = 0;
        feature[i] = F.NONE;
      } else if (d <= outer && diff < arc + (wob - 0.5) * 0.4) {
        terrain[i] = ringT;
        trees[i] = treePlanks(ringT);
        feature[i] = F.NONE;
      } else if (d <= outer + 1 && diff < 2.25) {
        // The forest thins out into savanna toward the water.
        terrain[i] = T.SAVANNA;
        trees[i] = hash2(x, y, seed + 43) < 0.42 ? treePlanks(T.SAVANNA) : 0;
        feature[i] = F.NONE;
      } else if (d <= outer + 1 && (terrain[i] === T.FOREST || terrain[i] === T.HILL)) {
        terrain[i] = T.GRASS;
        trees[i] = hash2(x, y, seed + 44) < 0.08 ? treePlanks(T.GRASS) : 0;
        feature[i] = F.NONE;
      }
    }
  }
  // Lone trees near the house, on the forest side, for the first planks.
  let lone = 0;
  for (let k = 0; k < 80 && lone < 4; k++) {
    const a = forestAng + rng.range(-1.3, 1.3);
    const r = rng.range(4.2, 6.4);
    const x = Math.round(start.x + 0.5 + Math.cos(a) * r);
    const y = Math.round(start.y + 0.5 + Math.sin(a) * r);
    const i = idx(x, y);
    if (isWater(terrain[i]) || trees[i]) continue;
    // Never in front of the house, where the storage floor goes.
    if (x - start.x >= -2 && y - start.y >= 1 && x - start.x <= 3) continue;
    let near = false;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (trees[idx(x + ox, y + oy)]) near = true;
    if (near) continue;
    terrain[i] = lone === 0 ? ringT : T.SAVANNA;
    trees[i] = treePlanks(terrain[i]);
    lone++;
  }

  // A rocky outcrop within a short walk, so every start can quarry stone.
  for (let k = 0; k < 40; k++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(19, 23);
    const ox = Math.round(start.x + Math.cos(a) * r);
    const oy = Math.round(start.y + Math.sin(a) * r);
    if (ox < 3 || oy < 3 || ox >= W - 3 || oy >= H - 3 || isWater(terrain[idx(ox, oy)])) continue;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const i = idx(ox + dx, oy + dy);
        if (isWater(terrain[i]) || dx * dx + dy * dy > 5) continue;
        terrain[i] = T.HILL;
        trees[i] = 0;
        if (rng.chance(0.6)) {
          feature[i] = F.ROCK;
          amount[i] = 90 + rng.int(0, 60);
        } else {
          feature[i] = F.NONE;
        }
      }
    }
    break;
  }

  // Red mud for bricks: one pit a short walk from home, and more along the
  // river banks and lagoon shores where clay settles.
  const clayPit = (cx, cy, r) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
        const i = idx(x, y);
        const t = terrain[i];
        if (isWater(t) || t === T.HILL || t === T.MANGROVE || feature[i] === F.IRON) continue;
        if (dx * dx + dy * dy > r * r + 1 || (dx * dx + dy * dy > 2 && !rng.chance(0.7))) continue;
        if (t === T.FOREST || t === T.SAVANNA) terrain[i] = T.GRASS;
        trees[i] = 0;
        feature[i] = F.CLAY;
        amount[i] = 140 + rng.int(0, 100);
      }
    }
  };
  for (let i = 0; i < n; i++) {
    const t = terrain[i];
    if ((t !== T.GRASS && t !== T.SAVANNA) || nearCoast[i] < 1 || nearCoast[i] > 2 || feature[i]) continue;
    const x = i % W;
    const y = (i / W) | 0;
    if (hash2(x, y, seed + 31) < 0.012 && Math.hypot(x - start.x, y - start.y) > 18) clayPit(x, y, rng.int(1, 2));
  }

  // Everything that matters must be reachable on foot from home (once a
  // path is worn to it).
  const walkable = reachable(terrain, W, H, start.x, start.y);
  const snap = (fx, fy, clear = 2) => {
    const tx = Math.floor(fx * W);
    const ty = Math.floor(fy * H);
    return nearestTile(terrain, W, H, tx, ty, (t, i) => walkable[i] && clearAround(terrain, W, H, i, clear));
  };

  const factionSpots = region.factions.map((f) => {
    const i = snap(f.at[0], f.at[1], 2);
    // Clear the village ground so its huts sit on open earth.
    const fx = i % W;
    const fy = (i / W) | 0;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const x = fx + dx;
        const y = fy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H || dx * dx + dy * dy > 10) continue;
        const j = idx(x, y);
        if (isWater(terrain[j])) continue;
        if (terrain[j] === T.FOREST || terrain[j] === T.MANGROVE) terrain[j] = T.GRASS;
        trees[j] = 0;
        if (feature[j] !== F.IRON) feature[j] = F.NONE;
      }
    }
    return { x: fx, y: fy };
  });

  const poiSpots = region.pois.map((p) => {
    // Some sites sit across water on purpose: canoes are part of the story.
    const i = p.water
      ? nearestTile(terrain, W, H, Math.floor(p.at[0] * W), Math.floor(p.at[1] * H), (t) => !isWater(t))
      : snap(p.at[0], p.at[1], 0);
    return { x: i % W, y: (i / W) | 0 };
  });

  // --- Footpaths --------------------------------------------------------
  // Paths fan out from home along the easiest ground: to every people, to
  // every place worth finding, and the way the founders came in, from the
  // north. Trees along them are long gone.
  const from = paths(terrain, trees, W, H, start.x, start.y);
  const trail = (tx, ty) => {
    let i = idx(tx, ty);
    if (from.cost[i] === Infinity) return [];
    const out = [];
    while (i >= 0 && i !== from.start) {
      out.push(i);
      i = from.prev[i];
    }
    return out.reverse();
  };
  const wear = (tiles) => {
    for (const i of tiles) {
      for (const j of [i, i + 1]) {
        if (j % W === 0 || isWater(terrain[j])) continue;
        trees[j] = 0;
        if (terrain[j] === T.FOREST) terrain[j] = T.GRASS;
        if (feature[j] === F.NONE && j !== idx(start.x, start.y)) feature[j] = F.PATH;
      }
    }
  };
  for (const f of factionSpots) wear(trail(f.x, f.y));
  for (const [k, p] of poiSpots.entries()) if (!region.pois[k].water) wear(trail(p.x, p.y));
  // The way in: from the north edge, or the nearest land to it.
  let gate = -1;
  for (let r = 0; r < W && gate < 0; r++) {
    for (const x of [start.x - r, start.x + r]) {
      for (let y = 1; y < 6 && gate < 0; y++) {
        if (x > 0 && x < W - 1 && from.cost[idx(x, y)] < Infinity) gate = idx(x, y);
      }
    }
  }
  const arrival = gate >= 0 ? trail(gate % W, (gate / W) | 0) : [];
  wear(arrival);

  // The red-mud pit they passed on the way in: beside the path, well
  // outside the clearing, where nobody will see it until they go back
  // (`mudPitAt` [nearest, farthest, otherwise] sets how far, in tiles).
  const [pitNear, pitFar, pitElse] = tp.mudPitAt || [20, 28, 21];
  let mudPit = null;
  for (let k = 0; k < arrival.length && !mudPit; k++) {
    const i = arrival[k];
    const px = i % W;
    const py = (i / W) | 0;
    const d = Math.hypot(px - start.x, py - start.y);
    if (d < pitNear || d > pitFar) continue;
    for (const [ox, oy] of [[3, 0], [-3, 0], [0, 3], [0, -3], [3, 2], [-3, -2]]) {
      const cx = px + ox;
      const cy = py + oy;
      if (cx < 4 || cy < 4 || cx >= W - 4 || cy >= H - 4) continue;
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) {
        for (let dx = -1; dx <= 1 && ok; dx++) {
          const j = idx(cx + dx, cy + dy);
          if (isWater(terrain[j]) || terrain[j] === T.HILL || terrain[j] === T.MANGROVE || feature[j] === F.PATH) ok = false;
        }
      }
      if (!ok) continue;
      clayPit(cx, cy, 2);
      // Clear the ground between the path and the pit.
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const j = idx(cx + dx, cy + dy);
          if (dx * dx + dy * dy > 10 || isWater(terrain[j])) continue;
          trees[j] = 0;
          if (terrain[j] === T.FOREST) terrain[j] = T.GRASS;
        }
      }
      mudPit = { x: cx, y: cy };
      break;
    }
  }
  if (!mudPit) {
    // No path long enough: any open ground at that distance will do.
    for (let k = 0; k < 200 && !mudPit; k++) {
      const a = rng.range(0, Math.PI * 2);
      const cx = Math.round(start.x + Math.cos(a) * pitElse);
      const cy = Math.round(start.y + Math.sin(a) * pitElse);
      if (cx < 4 || cy < 4 || cx >= W - 4 || cy >= H - 4 || isWater(terrain[idx(cx, cy)]) || from.cost[idx(cx, cy)] === Infinity) continue;
      clayPit(cx, cy, 2);
      wear(trail(cx, cy));
      mudPit = { x: cx, y: cy };
    }
  }

  const reach = reachable(terrain, W, H, start.x, start.y, trees);
  return { W, H, terrain, trees, feature, amount, start, factionSpots, poiSpots, reach, arrival, mudPit };
}

// Cheapest ways out from home over open ground (4-way steps, so a path is
// never pinched shut between two trees). Trees cost the most to go through.
function paths(terrain, trees, W, H, sx, sy) {
  const n = W * H;
  const cost = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const start = sy * W + sx;
  cost[start] = 0;
  // A small binary heap keyed on cost.
  const heap = [];
  const push = (i) => {
    heap.push(i);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (cost[heap[p]] <= cost[heap[k]]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && cost[heap[l]] < cost[heap[m]]) m = l;
        if (r < heap.length && cost[heap[r]] < cost[heap[m]]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  const done = new Uint8Array(n);
  push(start);
  while (heap.length) {
    const i = pop();
    if (done[i]) continue;
    done[i] = 1;
    const x = i % W;
    const y = (i / W) | 0;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
      const j = ny * W + nx;
      const t = terrain[j];
      if (WALK[t] === 0) continue;
      let c = 1 / WALK[t];
      if (trees[j]) c += 7;
      const g = cost[i] + c;
      if (g < cost[j]) {
        cost[j] = g;
        prev[j] = i;
        push(j);
      }
    }
  }
  return { cost, prev, start };
}

function landCover(nx, ny, seed, tp) {
  const elev = fbm(nx * 6, ny * 6, seed + 7, 4);
  const moist = fbm(nx * 4.5 + 20, ny * 4.5, seed + 13, 4) + ny * 0.1;
  const savLine = tp.savanna + (fbm(nx * 4, 1.7, seed + 17, 3) - 0.5) * 0.12;
  if (elev > tp.hillLevel && ny < 0.72) return T.HILL;
  if (ny < savLine) return moist > (tp.woodMoist ?? 0.7) ? T.FOREST : T.SAVANNA;
  if (moist > tp.forestLevel) return T.FOREST;
  return T.GRASS;
}

function carveRiver(terrain, W, H, rv, rng) {
  let x = rv.from[0] * W;
  let y = rv.from[1] * H;
  const tx = rv.to[0] * W;
  const ty = rv.to[1] * H;
  let wander = 0;
  let step = 0;
  for (let guard = 0; guard < 600; guard++) {
    const dx = tx - x;
    const dy = ty - y;
    const d = Math.hypot(dx, dy);
    if (d < 1) break;
    wander += rng.range(-0.35, 0.35);
    wander *= 0.9;
    const a = Math.atan2(dy, dx) + wander;
    x += Math.cos(a) * 0.7;
    y += Math.sin(a) * 0.7;
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
    const i = iy * W + ix;
    if (terrain[i] === T.LAGOON || terrain[i] === T.OCEAN) break;
    step++;
    // A ford every so often keeps the land on both banks joined.
    const ford = step % rv.fordEvery < 3;
    terrain[i] = ford ? T.FORD : T.RIVER;
    if (rv.wide && ix + 1 < W && !ford && terrain[i + 1] !== T.LAGOON) terrain[i + 1] = T.RIVER;
  }
}

// Chebyshev distance (in tiles) to the nearest tile matching `pred`, up to `max`.
function distanceField(W, H, pred, max) {
  const n = W * H;
  const d = new Uint8Array(n);
  let frontier = [];
  for (let i = 0; i < n; i++) if (pred(i)) frontier.push(i);
  const seen = new Uint8Array(n);
  for (const i of frontier) seen[i] = 1;
  for (let k = 1; k <= max && frontier.length; k++) {
    const next = [];
    for (const i of frontier) {
      const x = i % W;
      const y = (i / W) | 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (seen[j]) continue;
          seen[j] = 1;
          d[j] = k;
          next.push(j);
        }
      }
    }
    frontier = next;
  }
  return d;
}

function findStart(terrain, W, H, at, rng) {
  const cx = Math.floor(at[0] * W);
  const cy = Math.floor(at[1] * H);
  let best = -1;
  let bestScore = -Infinity;
  for (let r = 0; r < 14; r++) {
    for (let k = 0; k < 24; k++) {
      const x = cx + rng.int(-r, r);
      const y = cy + rng.int(-r, r);
      if (x < 8 || y < 8 || x >= W - 8 || y >= H - 8) continue;
      let land = 0;
      let water = 0;
      let hill = 0;
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          const t = terrain[(y + dy) * W + x + dx];
          if (isWater(t)) water++;
          else land++;
          if (t === T.HILL || t === T.MANGROVE) hill++;
        }
      }
      let nearest = 99;
      for (let dy = -9; dy <= 9; dy++) {
        for (let dx = -9; dx <= 9; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && isWater(terrain[yy * W + xx]) && terrain[yy * W + xx] !== T.OCEAN) {
            nearest = Math.min(nearest, Math.max(Math.abs(dx), Math.abs(dy)));
          }
        }
      }
      // Fishing water should sit inside the first territory, but not on the doorstep.
      const waterScore = nearest <= 7 ? 30 - Math.abs(nearest - 6) * 2 : -40;
      const score = land - water * 4 - hill * 2 + waterScore - r * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = y * W + x;
      }
    }
  }
  return { x: best % W, y: (best / W) | 0 };
}

// Every tile a person on foot can get to from (sx, sy). With `trees`,
// standing trees are walls; `felled` marks the cut ones.
export function reachable(terrain, W, H, sx, sy, trees, felled) {
  const seen = new Uint8Array(W * H);
  const stack = [sy * W + sx];
  seen[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % W;
    const y = (i / W) | 0;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (seen[j] || WALK[terrain[j]] === 0) continue;
      if (trees && trees[j] && !(felled && felled[j])) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return seen;
}

function clearAround(terrain, W, H, i, r) {
  const x = i % W;
  const y = (i / W) | 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) return false;
      if (isWater(terrain[ny * W + nx])) return false;
    }
  }
  return true;
}

function nearestTile(terrain, W, H, tx, ty, ok) {
  tx = Math.max(0, Math.min(W - 1, tx));
  ty = Math.max(0, Math.min(H - 1, ty));
  for (let r = 0; r < Math.max(W, H); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = tx + dx;
        const y = ty + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        if (ok(terrain[i], i)) return i;
      }
    }
  }
  return ty * W + tx;
}
