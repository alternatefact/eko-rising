// The title screen's map of Nigeria's old kingdoms, around 1600. Tap a
// kingdom (or its name) to see who ruled it, its people and what it is today;
// a home kingdom can be started from there. The rest are won later in the
// campaign, by alliance, tribute or war.
//
// This picker shades each kingdom by its part of the land (the sahel, the
// Middle Belt, the western and southern forests), to help a player find
// their way. The campaign map will colour each province by who holds it
// instead: pass it its own `fill`.

import { GEOMETRY } from '../campaign/geometry.js';
import { PROVINCES, PROVINCE, ELITE, project } from '../campaign/provinces.js';
import { REGIONS, LOCKED } from '../regions/index.js';

const AREA = { north: 'Northern kingdoms', middle: 'Middle Belt', west: 'Western kingdoms', south: 'Southern kingdoms' };
// Small provinces get a smaller name.
const SMALL = new Set(['eko', 'ijebu', 'egba', 'ife', 'ekiti', 'nri', 'aro', 'igbonorth']);
// Each part of the land has its colour, each kingdom a shade of it.
const HUE = { north: [40, 52, 60], middle: [24, 42, 52], west: [88, 34, 50], south: [145, 34, 40] };
export function areaShade(p) {
  const [h, s, l] = HUE[p.area];
  let n = 0;
  for (const c of p.id) n = (n * 31 + c.charCodeAt(0)) % 997;
  return `hsl(${h + ((n % 7) - 3) * 2}, ${s}%, ${l + ((n % 5) - 2) * 3}%)`;
}

// What a province is on the picker: 'play' (a home kingdom to start in),
// 'coming' (a home kingdom still to be built) or 'campaign' (won later).
export function provinceStatus(p) {
  if (p.start && REGIONS[p.start]) return 'play';
  if (p.start || p.coming) return 'coming';
  return 'campaign';
}

// A chapter that can be played in a campaign province once another chapter
// has opened it: Ogun, in Ẹ̀gbá and Ìjẹ̀bú, after the host of Benin is broken.
export function chapterOf(p, opened = new Set()) {
  return p.region && REGIONS[p.region] && (!LOCKED[p.region] || opened.has(p.region)) ? p.region : null;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Where a province's name goes: where its entry says; for a home kingdom,
// just above its capital; otherwise at the middle of its shape.
function nameAt(p) {
  if (p.labelAt) return p.labelAt;
  if (p.seat) {
    const [sx, sy] = project(...p.seat);
    return [sx, sy - 12];
  }
  return PROVINCE[p.id].label;
}

// Where its tag (PLAY, NEXT) goes: under the capital, or under the name.
function tagAt(p) {
  if (p.seat && !p.labelAt) {
    const [sx, sy] = project(...p.seat);
    return [sx, sy + 26];
  }
  const [x, y] = nameAt(p);
  return [x, y + (SMALL.has(p.id) ? 16 : 20)];
}

// The points a small province's tap zone is measured from: its name, its
// capital, the middle of its shape.
function tapPoints(p) {
  const pts = [nameAt(p), PROVINCE[p.id].label];
  if (p.seat) pts.push(project(...p.seat));
  return pts;
}

function mapSvg(selected, fill) {
  const G = GEOMETRY;
  let s = `<svg viewBox="0 0 ${G.width} ${G.height}" role="group" aria-label="Map of Nigeria's old kingdoms, around 1600">
    <defs>
      <linearGradient id="km-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3b4d"/><stop offset="1" stop-color="#16303f"/></linearGradient>
      <pattern id="km-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="rgba(40,26,10,0.18)" stroke-width="3"/></pattern>
    </defs>
    <rect width="${G.width}" height="${G.height}" fill="url(#km-sea)"/>
    <path d="${G.land}" class="km-land"/>`;
  // The kingdoms.
  for (const p of PROVINCES) {
    const g = PROVINCE[p.id];
    s += `<g class="km-prov km-${p.area} km-${provinceStatus(p)}${p.id === selected ? ' km-sel' : ''}" data-id="${p.id}" role="button" tabindex="0" aria-label="${esc(p.name)}">
      <path d="${g.path}" style="fill:${fill(p)}"/>${p.council ? `<path d="${g.path}" fill="url(#km-hatch)" class="km-council"/>` : ''}
    </g>`;
  }
  for (const l of G.lakes) s += `<path d="${l.path}" class="km-lake"/>`;
  for (const r of G.rivers) s += `<path d="${r.path}" class="km-river${r.major ? ' km-major' : ''}"/>`;
  s += `<path d="${G.nigeria}" class="km-outline"/>`;
  // Edges drawn after every shape, so no neighbour covers part of them: the
  // gold edge of each home kingdom to play, then the one under the pointer,
  // then the chosen one.
  for (const p of PROVINCES) if (provinceStatus(p) === 'play') s += `<path d="${PROVINCE[p.id].path}" class="km-play-edge"/>`;
  s += '<path class="km-hover-edge" d=""/>';
  if (selected && PROVINCE[selected]) s += `<path d="${PROVINCE[selected].path}" class="km-sel-edge"/>`;
  // Water by name.
  const [nx, ny] = project(5.05, 9.45);
  const [bx, by] = project(8.9, 8.05);
  const [cx, cy] = project(13.75, 13.55);
  const [gx, gy] = project(5.3, 4.35);
  s += `<text x="${nx}" y="${ny}" class="km-water" transform="rotate(32 ${nx} ${ny})">Niger</text>
    <text x="${bx}" y="${by}" class="km-water" transform="rotate(-24 ${bx} ${by})">Benue</text>
    <text x="${cx}" y="${cy}" class="km-water">L. Chad</text>
    <text x="${gx}" y="${gy}" class="km-water km-sea-name">Gulf of Guinea</text>`;
  // Names, home kingdoms' capitals and what can be played: each a tap
  // target for its province.
  for (const p of PROVINCES) {
    const st = provinceStatus(p);
    const [lx, ly] = nameAt(p);
    s += `<g class="km-label" data-id="${p.id}">`;
    if (p.seat) {
      const [sx, sy] = project(...p.seat);
      if (p.labelAt) s += `<line x1="${lx + 22}" y1="${ly - 18}" x2="${sx}" y2="${sy}" class="km-leader"/>`;
      s += `<circle cx="${sx}" cy="${sy}" r="6.5" class="km-seat"/>`;
    }
    s += `<text x="${lx}" y="${ly}" class="km-name${SMALL.has(p.id) ? ' km-small' : ''}${st === 'play' ? ' km-name-open' : ''}">${esc(p.short)}</text>`;
    const tag = st === 'play' ? 'PLAY' : st === 'coming' ? 'NEXT' : '';
    if (tag) {
      const [tx, ty] = tagAt(p);
      s += `<text x="${tx}" y="${ty}" class="km-tag km-tag-${st}">${tag}</text>`;
    }
    s += '</g>';
  }
  return `${s}</svg>`;
}

function infoHtml(p, opened) {
  const st = provinceStatus(p);
  const rows = [
    ['Ruler', p.holder],
    ['Culture', p.people],
    ['Today', p.today],
    ['Elite unit', ELITE[p.culture] || 'none yet'],
  ];
  if (p.overlord) rows.push(['Pays tribute to', PROVINCE[p.overlord].name]);
  let act;
  if (st === 'play') act = `<button class="btn primary" data-km="play" data-id="${p.id}">▶ Start in ${esc(p.short)}</button>`;
  else if (st === 'coming') act = '<span class="km-status">Coming in a later update</span>';
  else act = '<span class="km-status">Win it in the campaign</span>';
  // Ogun, once Èkó has opened it, is played here.
  const chapter = chapterOf(p, opened);
  if (chapter) act += `<button class="btn" data-km="chapter" data-id="${p.id}">▶ Play the ${esc(REGIONS[chapter].name)} chapter</button>`;
  return `<div class="km-card km-${p.area}"><div class="km-head"><b>${esc(p.name)}</b><span class="km-area">${AREA[p.area]}</span></div>
    <dl class="km-lines">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <div class="km-act">${act}</div></div>`;
}

const LEGEND = `<div class="km-legend" aria-label="Key">
  <span><i class="km-key-council"></i>Lands without kings</span>
  <span><i class="km-key-play">PLAY</i>Playable start</span>
  <span><i class="km-key-next">NEXT</i>Coming soon</span>
  <span><i class="km-key-seat"></i>Capital</span>
</div>`;

// Draws the map into `el` and the chosen kingdom's panel into `info`.
// `onSelect(id, status)` is called when a kingdom is chosen, `onPlay(province)`
// when its Start button is pressed, `onChapter(province)` for a chapter played
// there. `fill(province)` colours the kingdoms (by area here).
export function renderKingdoms(el, info, { selected = 'eko', opened = new Set(), fill = areaShade, onSelect, onPlay, onChapter } = {}) {
  let sel = selected;
  let svg = null;
  const draw = () => {
    el.innerHTML = `<div class="km-frame">${mapSvg(sel, fill)}${LEGEND}</div>`;
    svg = el.querySelector('svg');
    info.innerHTML = PROVINCE[sel] ? infoHtml(PROVINCE[sel], opened) : '';
  };
  const choose = (id) => {
    if (!PROVINCE[id]) return;
    sel = id;
    draw();
    onSelect?.(id, provinceStatus(PROVINCE[id]));
    // On a narrow screen the panel is under the map: bring it into view.
    const r = info.getBoundingClientRect?.();
    if (r && r.bottom > window.innerHeight) info.scrollIntoView({ block: 'end', behavior: 'smooth' });
  };
  // A point on the map, in map units.
  const toMap = (e) => {
    const m = svg?.getScreenCTM?.();
    if (!m) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(m.inverse());
  };
  // The small province whose tap zone a point is in, nearest first.
  const smallAt = (pt) => {
    let best = null;
    let bestD = Infinity;
    for (const p of PROVINCES) {
      if (!p.tap) continue;
      for (const [x, y] of tapPoints(p)) {
        const d = Math.hypot(pt.x - x, pt.y - y);
        if (d <= p.tap && d < bestD) {
          bestD = d;
          best = p.id;
        }
      }
    }
    return best;
  };
  // A name or tag is the province it names, and a small province's own shape
  // is that province. Near a small one, a tap on a big neighbour goes to the
  // small one; anywhere else, to the shape under the pointer.
  const target = (e) => {
    const label = e.target.closest('.km-label');
    if (label) return label.dataset.id;
    const shape = e.target.closest('.km-prov')?.dataset.id || null;
    if (shape && PROVINCE[shape].tap) return shape;
    const pt = toMap(e);
    return (pt && smallAt(pt)) || shape;
  };
  el.onclick = (e) => {
    const id = target(e);
    if (id) choose(id);
  };
  el.onpointermove = (e) => {
    const id = e.pointerType === 'mouse' ? target(e) : null;
    const edge = el.querySelector('.km-hover-edge');
    if (edge) edge.setAttribute('d', id && id !== sel ? PROVINCE[id].path : '');
    el.style.cursor = id ? 'pointer' : '';
  };
  el.onpointerleave = () => el.querySelector('.km-hover-edge')?.setAttribute('d', '');
  el.onkeydown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.id) {
      e.preventDefault();
      choose(e.target.dataset.id);
    }
  };
  info.onclick = (e) => {
    const b = e.target.closest('[data-km]');
    if (!b) return;
    if (b.dataset.km === 'play') onPlay?.(PROVINCE[b.dataset.id]);
    else if (b.dataset.km === 'chapter') onChapter?.(PROVINCE[b.dataset.id]);
  };
  draw();
  return { choose, get selected() { return sel; } };
}
