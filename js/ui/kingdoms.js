// The title screen's map of Nigeria's old kingdoms, around 1600. Tap a
// kingdom to see who held it and what it is today; a home kingdom (or a
// chapter already opened) can be begun from there. The rest are won later in
// the campaign, by alliance, tribute or war.

import { GEOMETRY } from '../campaign/geometry.js';
import { PROVINCES, PROVINCE, project } from '../campaign/provinces.js';
import { REGIONS, LOCKED } from '../regions/index.js';

const AREA = { north: 'Northern kingdoms', middle: 'Middle Belt', west: 'Western kingdoms', south: 'Southern kingdoms' };
// Small provinces get a smaller name.
const SMALL = new Set(['eko', 'ijebu', 'egba', 'ife', 'ekiti', 'nri', 'aro', 'igbonorth']);
// Each part of the land has its colour (sahel, Middle Belt, western forest
// and savanna, southern forest and delta), each kingdom a shade of it.
const HUE = { north: [40, 52, 60], middle: [24, 42, 52], west: [88, 34, 50], south: [145, 34, 40] };
function shade(p) {
  const [h, s, l] = HUE[p.area];
  let n = 0;
  for (const c of p.id) n = (n * 31 + c.charCodeAt(0)) % 997;
  return `hsl(${h + ((n % 7) - 3) * 2}, ${s}%, ${l + ((n % 5) - 2) * 3}%)`;
}

// What can be done with a province now: 'play' (a home kingdom), 'chapter'
// (a chapter opened by winning another), 'locked' (a chapter still shut),
// 'coming' (a home kingdom still to be built) or 'campaign' (won later).
export function provinceStatus(p, opened = new Set()) {
  if (p.start && REGIONS[p.start]) return 'play';
  if (p.region) return LOCKED[p.region] && !opened.has(p.region) ? 'locked' : 'chapter';
  if (p.start || p.coming) return 'coming';
  return 'campaign';
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function mapSvg(selected, opened) {
  const G = GEOMETRY;
  let s = `<svg viewBox="0 0 ${G.width} ${G.height}" role="group" aria-label="Map of Nigeria's old kingdoms, around 1600">
    <defs>
      <linearGradient id="km-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3b4d"/><stop offset="1" stop-color="#16303f"/></linearGradient>
      <pattern id="km-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="rgba(40,26,10,0.18)" stroke-width="3"/></pattern>
    </defs>
    <rect width="${G.width}" height="${G.height}" fill="url(#km-sea)"/>
    <path d="${G.land}" class="km-land"/>`;
  for (const p of PROVINCES) {
    const g = PROVINCE[p.id];
    const st = provinceStatus(p, opened);
    s += `<g class="km-prov km-${p.area} km-${st}${p.id === selected ? ' km-sel' : ''}" data-id="${p.id}" role="button" tabindex="0" aria-label="${esc(p.name)}">
      <path d="${g.path}" style="fill:${shade(p)}"/>${p.council ? `<path d="${g.path}" fill="url(#km-hatch)" class="km-council"/>` : ''}
    </g>`;
  }
  for (const l of G.lakes) s += `<path d="${l.path}" class="km-lake"/>`;
  for (const r of G.rivers) s += `<path d="${r.path}" class="km-river${r.major ? ' km-major' : ''}"/>`;
  s += `<path d="${G.nigeria}" class="km-outline"/>`;
  // The selected province drawn again on top, so its whole edge shows.
  if (selected && PROVINCE[selected]) s += `<path d="${PROVINCE[selected].path}" class="km-sel-edge"/>`;
  // Water and rivers by name.
  const [nx, ny] = project(5.05, 9.45);
  const [bx, by] = project(8.9, 8.05);
  const [cx, cy] = project(13.75, 13.55);
  const [gx, gy] = project(5.3, 4.35);
  s += `<text x="${nx}" y="${ny}" class="km-water" transform="rotate(32 ${nx} ${ny})">Niger</text>
    <text x="${bx}" y="${by}" class="km-water" transform="rotate(-24 ${bx} ${by})">Benue</text>
    <text x="${cx}" y="${cy}" class="km-water">L. Chad</text>
    <text x="${gx}" y="${gy}" class="km-water km-sea-name">Gulf of Guinea</text>`;
  // Names, the capitals of home kingdoms, and what can be played.
  for (const p of PROVINCES) {
    const g = PROVINCE[p.id];
    const st = provinceStatus(p, opened);
    const [lx, ly] = p.labelAt || g.label;
    if (p.labelAt) s += `<line x1="${lx + 22}" y1="${ly - 18}" x2="${project(...p.seat)[0]}" y2="${project(...p.seat)[1]}" class="km-leader"/>`;
    if (p.seat) {
      const [sx, sy] = project(...p.seat);
      s += `<circle cx="${sx}" cy="${sy}" r="6" class="km-seat${st === 'play' ? ' km-seat-open' : ''}"/>`;
    }
    s += `<text x="${lx}" y="${ly}" class="km-name${SMALL.has(p.id) ? ' km-small' : ''}${st === 'play' || st === 'chapter' ? ' km-name-open' : ''}" data-id="${p.id}">${esc(p.short)}</text>`;
    const tag = st === 'play' ? 'PLAY' : st === 'coming' ? 'NEXT' : st === 'locked' ? '🔒' : st === 'chapter' && p.id === 'egba' ? 'PLAY' : '';
    if (tag) s += `<text x="${lx}" y="${ly + (SMALL.has(p.id) ? 16 : 20)}" class="km-tag km-tag-${st}" data-id="${p.id}">${tag}</text>`;
  }
  return `${s}</svg>`;
}

function infoHtml(p, opened) {
  const st = provinceStatus(p, opened);
  const region = REGIONS[p.start || p.region];
  const lines = [`<span>${esc(p.holder)}, around 1600</span>`, `<span>Today: ${esc(p.today)}</span>`];
  if (p.overlord) lines.push(`<span>Pays tribute to ${esc(PROVINCE[p.overlord].name)}</span>`);
  let act = '';
  if (st === 'play') act = `<button class="btn primary" data-km="play" data-id="${p.id}">▶ Begin in ${esc(p.short)}</button><p class="muted">A home kingdom: build it from a farmstead, beat its enemies, and one day face ${p.area === 'north' ? 'the armies that came across the desert, and then the British' : 'the invaders from beyond the sea'}.</p>`;
  else if (st === 'chapter') act = `<button class="btn primary" data-km="play" data-id="${p.id}">▶ Play the ${esc(region?.name || '')} chapter</button><p class="muted">Ìjẹ̀bú and the Ẹ̀gbá towns are Ogun State today. Start again there with what your people learned in Lagos.</p>`;
  else if (st === 'locked') act = `<p class="muted">🔒 ${esc(LOCKED[p.region])}</p>`;
  else if (st === 'coming') act = `<p class="muted">A home kingdom of its own${p.coming ? ' in a coming update' : ', coming next'}: its own people, clothing, enemies and story.</p>`;
  else act = `<p class="muted">${p.council ? 'No king here: elders’ councils. ' : ''}Won in the campaign, by alliance, tribute or war, once the map opens in the Town age (a coming update).</p>`;
  return `<div class="km-card km-${p.area}"><div class="km-head"><b>${esc(p.name)}</b><span class="km-area">${AREA[p.area]}</span></div>
    <div class="km-lines">${lines.join('')}</div>${act}</div>`;
}

const LEGEND = `<div class="km-legend"><span><i class="km-key-play"></i>Home kingdom: play</span><span><i class="km-key-next">NEXT</i>Coming</span><span><i class="km-key-council"></i>Elders’ councils</span><span><i class="km-key-seat"></i>Capital</span></div>`;

// Draws the map into `el` and the chosen kingdom's card into `info`.
// `onSelect(id)` is called when a kingdom is chosen, `onPlay(province)` when
// its Begin button is pressed.
export function renderKingdoms(el, info, { selected = 'eko', opened = new Set(), onSelect, onPlay } = {}) {
  let sel = selected;
  const draw = () => {
    el.innerHTML = mapSvg(sel, opened) + LEGEND;
    info.innerHTML = PROVINCE[sel] ? infoHtml(PROVINCE[sel], opened) : '';
  };
  const choose = (id) => {
    if (!PROVINCE[id]) return;
    sel = id;
    draw();
    onSelect?.(id, provinceStatus(PROVINCE[id], opened));
  };
  el.onclick = (e) => {
    const g = e.target.closest('[data-id]');
    if (g) choose(g.dataset.id);
  };
  el.onkeydown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.id) {
      e.preventDefault();
      choose(e.target.dataset.id);
    }
  };
  info.onclick = (e) => {
    const b = e.target.closest('[data-km="play"]');
    if (b) onPlay?.(PROVINCE[b.dataset.id]);
  };
  draw();
  return { choose, get selected() { return sel; } };
}
