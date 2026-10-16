// Everything on screen that isn't the map: resource bar, goals, messages,
// the build bar, the side panel and story pop-ups.

import { BUILDINGS, CATEGORIES } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { ERAS } from '../data/eras.js';
import { RESOURCES, FOOD, costText } from '../data/resources.js';
import { drawBuilding } from '../render/sprites.js';
import {
  canAfford, totalFood, population, housingCap, armySize, armyCap, strangers, residents, season,
  happinessFactors, RATIONS, TAXES, priceOf, TRADEABLE, hasBuilding,
} from '../sim/economy.js';
import { citizenStatus } from '../sim/citizens.js';
import { canTrain, armyPower } from '../sim/military.js';
import { STRENGTH, garrisonAlive, factionPower, giftCost, unified, majors } from '../sim/factions.js';
import { eventDef, eraRequirements, proclaimRequirements } from '../sim/events.js';
import { buildLocked } from '../sim/index.js';
import { STATES, NEXT_UP } from '../regions/index.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.floor(n)}`);

const ICONS = {
  compound: '🏠', hut: '🛖', house: '🏘️', farm: '🍠', woodcutter: '🪓', hunter: '🏹', fisher: '🎣', storehouse: '📦',
  granary: '🌾', palisade: '🪵', gate: '🚪', well: '💧', shrine: '🕯️', market: '🛍️', quarry: '⛏️', watchtower: '🗼',
  warcamp: '⚔️', palace: '👑', palmpress: '🌴', ironmine: '⚒️', blacksmith: '🔨', canoeyard: '🛶', stonewall: '🧱',
  tradingpost: '⚓', fort: '🏰', school: '🏫', assembly: '🏛️', campfire: '🔥',
};
const UNIT_ICON = { scout: '👁️', spearman: '🔱', archer: '🏹', swordsman: '🗡️', musketeer: '💥' };

export class Hud {
  constructor(game) {
    this.game = game;
    this.tab = 'housing';
    this.panel = null;
    this.shownMsgs = new Set();
    this.thumbs = {};
    this.lastPanelHtml = '';
    this.collapsedGoals = false;
  }

  get st() {
    return this.game.st;
  }

  mount() {
    this.makeThumbs();
    $('#build-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      this.tab = b.dataset.tab;
      this.renderBuild(true);
    });
    $('#build-items').addEventListener('click', (e) => {
      const card = e.target.closest('.bcard');
      if (!card) return;
      const type = card.dataset.type;
      const locked = buildLocked(this.st, type);
      if (locked) {
        this.toast(locked);
        return;
      }
      if (this.game.mode.build === type) this.game.cancelBuild();
      else this.game.startBuild(type);
      this.renderBuild(true);
    });
    $('#build-toggle').addEventListener('click', () => {
      const bar = $('#buildbar');
      bar.classList.toggle('collapsed');
      document.getElementById('app').classList.toggle('build-collapsed', bar.classList.contains('collapsed'));
    });
    document.querySelectorAll('[data-panel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.panel;
        if (this.panel?.kind === kind) this.closePanel();
        else this.openPanel(kind);
      });
    });
    $('#panel').addEventListener('click', (e) => this.onPanelClick(e));
    $('#feed').addEventListener('click', (e) => {
      const m = e.target.closest('.msg[data-x]');
      if (m) this.game.centerOn(+m.dataset.x, +m.dataset.y);
    });
    $('#objectives').addEventListener('click', (e) => {
      if (e.target.closest('h3')) {
        this.collapsedGoals = !this.collapsedGoals;
        this.renderGoals(true);
      }
    });
    $('#modal').addEventListener('click', (e) => this.onModalClick(e));
    $('#place-ok').addEventListener('click', () => this.game.confirmPlace());
    $('#place-cancel').addEventListener('click', () => this.game.cancelBuild());
    if (window.innerWidth < 760) {
      this.collapsedGoals = true;
    }
  }

  makeThumbs() {
    const fake = { era: 0, flags: {} };
    for (const [type, def] of Object.entries(BUILDINGS)) {
      const c = document.createElement('canvas');
      const size = 96;
      c.width = size;
      c.height = size;
      const g = c.getContext('2d');
      const px = Math.max(def.w, def.h) * 32;
      const k = (size - 8) / (px + (type === 'palace' ? 40 : 16));
      g.translate(size / 2 - (def.w * 32 * k) / 2, size / 2 - (def.h * 32 * k) / 2 + (type === 'palace' ? -10 : 4));
      g.scale(k, k);
      const n = def.line ? { l: true, r: true, u: false, d: false } : { l: false, r: false, u: false, d: false };
      try {
        drawBuilding(g, { type, w: def.w, h: def.h, built: 1, growth: 0.7, id: 3, workers: [] }, 0.5, fake, n);
      } catch (err) {
        // A missing sprite only costs the thumbnail.
      }
      this.thumbs[type] = c.toDataURL();
    }
  }

  // --- Periodic refresh ----------------------------------------------------

  update() {
    const st = this.st;
    this.renderTop();
    this.renderGoals();
    this.renderFeed();
    this.renderBuild();
    this.renderModal();
    if (this.panel) this.renderPanel();
    $('#speed-btn').innerHTML = this.game.paused ? '▶<span>Paused</span>' : `⏩<span>${this.game.speed}×</span>`;
    $('#speed-btn').classList.toggle('on', this.game.paused);
    const eraBtn = document.querySelector('[data-panel="era"]');
    const req = eraRequirements(st);
    eraBtn.classList.toggle('alert', !!req && req.reqs.every((r) => r.met));
  }

  renderTop() {
    const st = this.st;
    $('#town-name').textContent = st.name;
    $('#era-chip').textContent = `${ERAS[st.era].name} · ${ERAS[st.era].yo}`;
    const cap = st.cap;
    const food = totalFood(st);
    const chips = [];
    for (const k of FOOD) {
      if (st.res[k] < 1 && k !== 'yam') continue;
      chips.push(`<span class="res" title="${RESOURCES[k].name}">${RESOURCES[k].icon} ${fmt(st.res[k])}</span>`);
    }
    chips.push(`<span class="res ${food >= cap.food - 1 ? 'full' : food < population(st) * 2 ? 'low' : ''}" title="Food stored / granary space">🍽️ ${fmt(food)}<small>/${fmt(cap.food)}</small></span>`);
    for (const k of ['wood', 'stone', 'iron', 'palmoil', 'weapons']) {
      if (k !== 'wood' && st.res[k] < 1 && st.era < 1 && k !== 'stone') continue;
      if ((k === 'iron' || k === 'palmoil' || k === 'weapons') && st.res[k] < 1 && st.era < 2) continue;
      chips.push(`<span class="res ${st.res[k] >= cap.goods - 1 ? 'full' : ''}" title="${RESOURCES[k].name} (storehouse space ${cap.goods})">${RESOURCES[k].icon} ${fmt(st.res[k])}</span>`);
    }
    chips.push(`<span class="res" title="Cowries">🐚 ${fmt(st.res.cowries)}</span>`);
    const pop = residents(st).length;
    const waiting = strangers(st).length;
    chips.push(`<span class="res" title="Residents / homes">👥 ${pop}<small>/${housingCap(st)}</small></span>`);
    if (waiting) chips.push(`<span class="res" title="Strangers waiting for a home">🔥 ${waiting}</span>`);
    chips.push(`<span class="res" title="Soldiers / army limit">🛡️ ${armySize(st)}<small>/${armyCap(st)}</small></span>`);
    const h = Math.round(st.happy);
    const face = h >= 70 ? '😄' : h >= 50 ? '🙂' : h >= 35 ? '😐' : '😠';
    const trend = st.happyTarget > st.happy + 0.5 ? '▲' : st.happyTarget < st.happy - 0.5 ? '▼' : '';
    chips.push(`<span class="res ${h < 35 ? 'low' : ''}" title="Happiness — above 50 strangers come, below 35 people leave">${face} ${h}${trend}</span>`);
    const html = chips.join('');
    if (html !== this.lastTop) {
      $('#resources').innerHTML = html;
      this.lastTop = html;
    }
    const s = season(st);
    $('#date').innerHTML = `${s.name}<br><b>${st.time.year}</b> · day ${st.time.day + 1}`;
  }

  renderGoals(force) {
    const st = this.st;
    const goals = st.objCurrent.map((id) => st.region.objectives.find((o) => o.id === id)).filter(Boolean);
    const key = goals.map((g) => g.id).join() + this.collapsedGoals;
    if (key === this.lastGoals && !force) return;
    this.lastGoals = key;
    const el = $('#objectives');
    el.classList.toggle('collapsed', this.collapsedGoals);
    el.hidden = !goals.length;
    el.innerHTML = `<h3><span>🎯 Goals</span><span>${this.collapsedGoals ? '▸' : '▾'}</span></h3>${goals
      .map((g) => `<div class="goal"><b>${esc(g.text)}</b><span>${esc(g.hint)}</span></div>`)
      .join('')}`;
  }

  renderFeed() {
    const st = this.st;
    const feed = $('#feed');
    const now = performance.now();
    for (const m of st.log.slice(-6)) {
      if (this.shownMsgs.has(m.id)) continue;
      this.shownMsgs.add(m.id);
      const el = document.createElement('div');
      el.className = `msg ${m.kind}`;
      el.textContent = m.text;
      if (m.x !== undefined) {
        el.dataset.x = m.x;
        el.dataset.y = m.y;
        el.title = 'Show me';
      }
      el.dataset.born = now;
      feed.appendChild(el);
    }
    const kids = [...feed.children];
    kids.forEach((el, k) => {
      const age = now - +el.dataset.born;
      const life = el.classList.contains('war') ? 16000 : 10000;
      if (age > life + 900 || k < kids.length - 5) el.remove();
      else if (age > life) el.classList.add('fade');
    });
  }

  renderBuild(force) {
    const st = this.st;
    const sig = `${this.tab}|${st.era}|${Object.entries(st.res).map(([k, v]) => Math.floor(v / 5)).join()}|${this.game.mode.build}|${st.flags.europeanTrade}|${st.buildings.length}`;
    if (sig === this.lastBuild && !force) return;
    this.lastBuild = sig;
    $('#build-tabs').innerHTML = CATEGORIES.map((c) => `<button data-tab="${c.id}" class="${c.id === this.tab ? 'on' : ''}">${c.icon} ${c.name}</button>`).join('');
    const items = Object.entries(BUILDINGS).filter(([, d]) => d.cat === this.tab && d.buildable !== false);
    $('#build-items').innerHTML = items
      .map(([type, d]) => {
        const locked = buildLocked(st, type);
        const poor = !canAfford(st, d.cost);
        const cls = ['bcard', locked ? 'locked' : '', poor ? 'poor' : '', this.game.mode.build === type ? 'on' : ''].join(' ');
        const tip = `${d.name} (${d.yo}) — ${d.desc}${locked ? `\n🔒 ${locked}` : ''}`;
        return `<div class="${cls}" data-type="${type}" title="${esc(tip)}" role="button" tabindex="0">
          <img src="${this.thumbs[type]}" alt="" />
          <span class="nm">${locked ? '🔒 ' : ''}${esc(d.name)}</span>
          <span class="cost">${costText(d.cost) || 'free'}</span>
        </div>`;
      })
      .join('');
  }

  // --- Story pop-ups ---------------------------------------------------------

  renderModal() {
    const st = this.st;
    const modal = $('#modal');
    if (st.gameOver) {
      const key = `end-${st.gameOver.victory}`;
      if (this.modalKey === key) return;
      this.modalKey = key;
      modal.hidden = false;
      modal.innerHTML = st.gameOver.victory ? this.victoryHtml() : this.defeatHtml();
      return;
    }
    const entry = st.eventQueue[0];
    if (!entry) {
      if (!modal.hidden) {
        modal.hidden = true;
        modal.innerHTML = '';
        this.modalKey = null;
      }
      return;
    }
    const key = `${entry.id}-${entry.fid || ''}-${st.eventQueue.length}-${Math.floor(st.res.cowries)}`;
    if (key === this.modalKey) return;
    this.modalKey = key;
    const ev = eventDef(st, entry);
    if (!ev) {
      st.eventQueue.shift();
      return;
    }
    const text = typeof ev.text === 'function' ? ev.text(st) : ev.text;
    const art = ev.art === 'meet' ? '🤝' : ev.art || '📜';
    modal.hidden = false;
    modal.innerHTML = `<div class="event" role="dialog" aria-modal="true">
      <div class="art" ${ev.color ? `style="background:radial-gradient(circle at 50% 120%, ${ev.color}, transparent 65%), linear-gradient(180deg,#23356b,#3a2414)"` : ''}>${art}</div>
      <div class="body">
        <h2>${esc(ev.title)}</h2>
        <div class="text">${esc(text)}</div>
        <div class="choices">${ev.choices
          .map((c, k) => {
            const label = typeof c.label === 'function' ? c.label(st) : c.label;
            const ok = !c.can || c.can(st);
            return `<button class="choice" data-choice="${k}" ${ok ? '' : 'disabled'}><b>${esc(label)}</b>${c.hint ? `<span>${esc(c.hint)}</span>` : ''}</button>`;
          })
          .join('')}</div>
      </div></div>`;
  }

  onModalClick(e) {
    const c = e.target.closest('[data-choice]');
    if (c) {
      this.game.choose(+c.dataset.choice);
      this.modalKey = null;
      this.renderModal();
      return;
    }
    const a = e.target.closest('[data-end]');
    if (a) this.game.endAction(a.dataset.end);
  }

  victoryHtml() {
    const st = this.st;
    return `<div class="event end"><div class="art" style="background:linear-gradient(90deg,#008751 0 33%,#fff 33% 66%,#008751 66%)">🇳🇬</div>
      <div class="body"><h2>The New Nigeria</h2>
      <div class="text">In the year ${st.time.year}, in the House of Assembly at ${esc(st.name)}, every people of the land speaks with one voice. What began as ${esc(st.founder)} and ${esc(st.spouse)}'s yam farm by the lagoon is now the heart of a new nation.\n\nChapter one — Lagos — is complete. ${unified(st).length} peoples united, ${population(st)} people in your city, ${st.stats.conquered} villages conquered, ${st.stats.trained} soldiers trained.\n\nThe road north to Ogun, Oyo and beyond opens in a future update.</div>
      <div class="choices"><button class="choice" data-end="continue"><b>Keep building</b><span>Your city is yours to grow.</span></button>
      <button class="choice" data-end="title"><b>Back to the map of Nigeria</b></button></div></div></div>`;
  }

  defeatHtml() {
    const st = this.st;
    return `<div class="event end"><div class="art">🕯️</div><div class="body"><h2>The fire goes out</h2>
      <div class="text">${esc(st.gameOver.reason)}\n\nYou lasted until ${st.time.year}. Every great city has fallen and risen again.</div>
      <div class="choices"><button class="choice" data-end="restart"><b>Try again on a new map</b></button>
      <button class="choice" data-end="title"><b>Back to the title</b></button></div></div></div>`;
  }

  // --- Side panel -----------------------------------------------------------------

  openPanel(kind, data) {
    this.panel = { kind, data };
    document.querySelectorAll('[data-panel]').forEach((b) => b.classList.toggle('on', b.dataset.panel === kind));
    this.lastPanelHtml = '';
    this.renderPanel();
  }

  closePanel() {
    this.panel = null;
    $('#panel').hidden = true;
    document.querySelectorAll('[data-panel]').forEach((b) => b.classList.remove('on'));
  }

  renderPanel() {
    const st = this.st;
    const p = this.panel;
    let html = '';
    switch (p.kind) {
      case 'building': {
        const b = st.byId.get(p.data);
        if (!b || b.dead) return this.closePanel();
        html = this.buildingHtml(b);
        break;
      }
      case 'citizen': {
        const c = st.byId.get(p.data);
        if (!c || c.dead) return this.closePanel();
        html = this.citizenHtml(c);
        break;
      }
      case 'units': {
        const units = [...this.game.view.selected].map((id) => st.byId.get(id)).filter((u) => u && !u.dead && u.kind === 'unit');
        if (!units.length) return this.closePanel();
        html = this.unitsHtml(units);
        break;
      }
      case 'faction':
        html = this.factionHtml(st.factionMap[p.data]);
        break;
      case 'era':
        html = this.eraHtml();
        break;
      case 'peoples':
        html = this.peoplesHtml();
        break;
      case 'kingdom':
        html = this.kingdomHtml();
        break;
      case 'menu':
        html = this.menuHtml();
        break;
      default:
        return this.closePanel();
    }
    const el = $('#panel');
    el.hidden = false;
    if (html !== this.lastPanelHtml) {
      const scroll = el.scrollTop;
      el.innerHTML = html;
      el.scrollTop = scroll;
      this.lastPanelHtml = html;
    }
  }

  head(title, sub) {
    return `<div class="panel-head"><div><h2>${title}</h2>${sub ? `<div class="yo">${sub}</div>` : ''}</div><button class="close" data-act="close" aria-label="Close">✕</button></div>`;
  }

  buildingHtml(b) {
    const st = this.st;
    const def = BUILDINGS[b.type];
    let h = this.head(`${ICONS[b.type] || ''} ${esc(def.name)}`, esc(def.yo));
    h += `<p class="muted">${esc(def.desc)}</p>`;
    if (b.built < 1) {
      h += `<h4>Building</h4><div class="bar"><i style="width:${Math.round(b.built * 100)}%"></i></div>`;
    }
    if (!def.invulnerable) h += `<h4>Condition</h4><div class="bar"><i style="width:${Math.round((b.hp / b.maxHp) * 100)}%;background:${b.hp / b.maxHp > 0.5 ? '' : '#e2574c'}"></i></div>`;
    if (b.type === 'farm') h += `<h4>Yams</h4><div class="bar"><i style="width:${Math.round(b.growth * 100)}%;background:#7bbf3f"></i></div><p class="muted">${season(st).name}: crops grow at ×${season(st).farm}.</p>`;
    if (def.workers) {
      h += `<h4>Workers ${b.workers.length}/${def.workers}</h4><div class="list">`;
      for (const id of b.workers) {
        const c = st.byId.get(id);
        if (c) h += `<div class="item click" data-act="citizen" data-id="${c.id}"><span>${esc(c.name)}</span><span class="muted">${esc(citizenStatus(st, c))}</span></div>`;
      }
      if (!b.workers.length) h += `<div class="item"><span class="muted">${b.paused ? 'Paused.' : 'Nobody yet — waiting for an idle resident. Build huts so strangers move in.'}</span></div>`;
      h += '</div><h4>Priority</h4><div class="seg">';
      ['Low', 'Normal', 'High'].forEach((n, k) => {
        h += `<button class="btn ${b.priority === k ? 'on' : ''}" data-act="prio" data-v="${k}">${n}</button>`;
      });
      h += `<button class="btn ${b.paused ? 'on' : ''}" data-act="pause">${b.paused ? '▶ Resume' : '⏸ Pause'}</button></div>`;
      h += '<p class="muted">Workers leave lower-priority jobs to fill higher ones. Food jobs get a boost when the granary runs low.</p>';
    }
    if (def.housing) {
      h += `<h4>Residents ${b.residents.length}/${def.housing}</h4><div class="list">`;
      for (const id of b.residents) {
        const c = st.byId.get(id);
        if (c) h += `<div class="item click" data-act="citizen" data-id="${c.id}"><span>${esc(c.name)} <span class="muted">· ${esc(c.people)}</span></span><span class="muted">${c.job ? esc(BUILDINGS[st.byId.get(c.job)?.type]?.name || '') : 'no job'}</span></div>`;
      }
      h += '</div>';
    }
    if (b.type === 'campfire' || (b.type === 'palace' && b.built >= 1)) {
      const w = strangers(st);
      h += `<h4>Waiting for a home (${w.length})</h4><div class="list">${w.map((c) => `<div class="item"><span>${esc(c.name)}</span><span class="muted">${esc(c.people)}, from ${esc(c.from)}</span></div>`).join('') || '<div class="item muted">No one is waiting.</div>'}</div>`;
    }
    if (def.storage) {
      h += `<h4>Storage</h4><p class="muted">Adds room for ${def.storage.food ? `${def.storage.food} food` : ''}${def.storage.food && def.storage.goods ? ' and ' : ''}${def.storage.goods ? `${def.storage.goods} of each good` : ''}.</p>`;
    }
    if (def.trains && b.built >= 1) {
      h += `<h4>Train (army ${armySize(st)}/${armyCap(st)})</h4><div class="list">`;
      for (const type of def.trains) {
        const u = UNITS[type];
        const can = canTrain(st, b, type);
        if ((u.era || 0) > st.era + 1) continue;
        h += `<div class="item"><span>${UNIT_ICON[type]} <b>${esc(u.name)}</b> <span class="muted">${esc(u.yo)}</span><br><span class="muted">${costText(u.cost)}</span></span>
          <button class="btn ${can.ok ? 'primary' : ''}" data-act="train" data-type="${type}" ${can.ok ? '' : `disabled title="${esc(can.reason)}"`}>Train</button></div>`;
      }
      h += '</div>';
      if (b.queue.length) {
        const u = UNITS[b.queue[0]];
        h += `<p>In training: ${b.queue.map((q) => UNIT_ICON[q]).join(' ')} <span class="muted">${b.trainStatus ? esc(b.trainStatus) : `${Math.min(100, Math.round((b.trainT / u.train) * 100))}%`}</span></p>`;
      }
      h += '<p class="muted">Each recruit is a person: a stranger from the fire, or an idle resident.</p>';
    }
    if (b.type === 'market' && b.built >= 1) h += this.marketHtml();
    if (def.tower) h += `<p class="muted">Shoots enemies within ${def.tower.range} tiles.</p>`;
    if (b.type !== 'compound' && b.type !== 'campfire') h += `<h4></h4><button class="btn danger" data-act="demolish">Pull down</button>`;
    return h;
  }

  marketHtml() {
    const st = this.st;
    let h = '<h4>Trade (lots of 10)</h4><div class="trade">';
    for (const r of TRADEABLE) {
      if (r === 'weapons' && st.era < 2) continue;
      if ((r === 'iron' || r === 'palmoil') && st.era < 1) continue;
      h += `<span>${RESOURCES[r].icon}</span><span>${RESOURCES[r].name} <span class="muted">${fmt(st.res[r])}</span></span>
        <button class="btn" data-act="sell" data-r="${r}" title="Sell for ${priceOf(st, r, false)} each">Sell +${priceOf(st, r, false) * 10}</button>
        <button class="btn" data-act="buy" data-r="${r}" title="Buy for ${priceOf(st, r, true)} each">Buy −${priceOf(st, r, true) * 10}</button>`;
    }
    return `${h}</div>`;
  }

  citizenHtml(c) {
    const st = this.st;
    const job = c.job ? st.byId.get(c.job) : null;
    const home = c.home ? st.byId.get(c.home) : null;
    let h = this.head(`${c.female ? '👩🏾' : '👨🏾'} ${esc(c.name)}`, `${esc(c.people)} · from ${esc(c.from)}`);
    if (c.special === 'founder') h += '<p>The founder of this settlement.</p>';
    if (c.special === 'spouse') h += `<p>Wife of ${esc(st.founder)}, co-founder of ${esc(st.name)}.</p>`;
    h += `<div class="kv"><span>Doing</span><b>${esc(citizenStatus(st, c))}</b>
      <span>Works at</span><b>${job ? esc(BUILDINGS[job.type].name) : c.stranger ? '—' : 'No job yet'}</b>
      <span>Lives in</span><b>${home ? esc(BUILDINGS[home.type].name) : 'Homeless'}</b>
      ${c.carry ? `<span>Carrying</span><b>${RESOURCES[c.carry.r].icon} ${Math.round(c.carry.n)}</b>` : ''}</div>`;
    if (job) h += `<h4></h4><button class="btn" data-act="building" data-id="${job.id}">Go to workplace</button>`;
    return h;
  }

  unitsHtml(units) {
    const st = this.st;
    const mine = units[0].owner === 'player';
    if (!mine) {
      const u = units[0];
      const def = UNITS[u.type];
      const owner = st.factionMap[u.owner]?.name || st.foreign[u.owner]?.name || u.owner;
      return `${this.head(esc(def.name), esc(owner))}<div class="kv"><span>Health</span><b>${Math.ceil(u.hp)}/${u.maxHp}</b><span>Attack</span><b>${def.atk}${def.ranged ? ' (ranged)' : ''}</b></div>`;
    }
    const counts = {};
    for (const u of units) counts[u.type] = (counts[u.type] || 0) + 1;
    let h = this.head(`🛡️ ${units.length} selected`, Object.entries(counts).map(([t, n]) => `${n} ${UNITS[t].name.toLowerCase()}${n > 1 ? 's' : ''}`).join(', '));
    h += '<p class="muted">Tap the ground to march. Tap an enemy or a village to attack. Unexplored places with a ❓ hide rewards.</p><div class="list">';
    for (const u of units.slice(0, 12)) {
      h += `<div class="item"><span>${UNIT_ICON[u.type] || ''} ${esc(u.name || UNITS[u.type].name)}</span><span class="muted">${Math.ceil(u.hp)}/${u.maxHp} ♥</span></div>`;
    }
    h += `</div><h4></h4><div class="row"><button class="btn" data-act="halt">✋ Hold here</button><button class="btn" data-act="home">🏠 Return home</button><button class="btn" data-act="deselect">Deselect</button></div>`;
    h += `<p class="muted">Army strength: ${armyPower(st)}</p>`;
    return h;
  }

  factionHtml(f) {
    const st = this.st;
    if (!f) return '';
    const alive = garrisonAlive(st, f).length;
    let h = this.head(esc(f.name), `${'★'.repeat(f.strength)}${'☆'.repeat(5 - f.strength)} ${STRENGTH[f.strength]} · <span class="status ${f.status}">${f.status}</span>`);
    h += `<p>${esc(f.desc)}</p>`;
    h += this.factionBody(f, alive);
    return h;
  }

  factionBody(f, alive) {
    const st = this.st;
    let h = `<div class="kv"><span>Relations</span><b class="${f.relation >= 0 ? 'pos' : 'neg'}">${Math.round(f.relation)}</b>
      <span>Their warriors</span><b>${alive}</b>
      <span>Their strength</span><b>${factionPower(st, f)}</b>
      <span>Your army</span><b>${armyPower(st)}</b></div>`;
    if (f.status === 'conquered') return `${h}<p class="muted">They pay you tribute every day.</p>`;
    if (f.temperament === 'bandit') return `${h}<p class="muted">There is no talking to them. Destroy their warriors and stand in their camp to take it.</p>`;
    const gift = giftCost(st, f);
    h += `<h4>Diplomacy</h4><div class="seg">
      <button class="btn" data-act="diplo" data-f="${f.id}" data-a="gift" ${st.res.cowries >= gift ? '' : 'disabled'}>🎁 Gift (🐚 ${gift})</button>
      ${f.status !== 'allied' && f.status !== 'hostile' && f.status !== 'vassal' ? `<button class="btn" data-act="diplo" data-f="${f.id}" data-a="ally">🤝 Propose alliance</button>` : ''}
      ${f.status !== 'allied' && f.status !== 'vassal' ? `<button class="btn" data-act="diplo" data-f="${f.id}" data-a="demand">👑 Demand tribute</button>` : ''}
      ${f.status !== 'hostile' ? `<button class="btn danger" data-act="diplo" data-f="${f.id}" data-a="war">⚔️ Declare war</button>` : ''}
    </div>`;
    h += `<p class="muted">${
      f.status === 'hostile'
        ? 'At war. Send gifts to make peace, or defeat every warrior and stand in their village to conquer it.'
        : f.status === 'allied'
          ? 'Your allies. They trade with you each day.'
          : f.status === 'vassal'
            ? 'They pay you tribute each day.'
            : `Alliance needs relations of ${f.temperament === 'friendly' ? 35 : 55}${f.temperament === 'warlike' ? ' and real strength' : ''}. Tribute needs an army about 1.4× stronger than theirs.`
    }</p>`;
    h += `<button class="btn" data-act="goto" data-x="${f.x}" data-y="${f.y}">📍 Show on map</button>`;
    return h;
  }

  peoplesHtml() {
    const st = this.st;
    const known = st.factions.filter((f) => f.discovered);
    let h = this.head('🤝 Peoples of the land', `${unified(st).length} of ${majors(st).length} major peoples united`);
    if (!known.length) h += '<p class="muted">You have met no one yet. Train a scout at your compound and explore.</p>';
    for (const f of known) {
      const alive = garrisonAlive(st, f).length;
      h += `<div class="people-card" style="--c:${f.color}"><div class="panel-head"><div><b>${esc(f.name)}</b>${f.major ? '' : ' <span class="muted">(minor)</span>'}<div class="muted">${'★'.repeat(f.strength)} ${STRENGTH[f.strength]} · <span class="status ${f.status}">${f.status}</span></div></div></div>${this.factionBody(f, alive)}</div>`;
    }
    const hidden = st.factions.filter((f) => !f.discovered && f.major).length;
    if (hidden) h += `<p class="muted">${hidden} more major ${hidden > 1 ? 'peoples are' : 'people is'} out there, still unknown.</p>`;
    return h;
  }

  eraHtml() {
    const st = this.st;
    const era = ERAS[st.era];
    let h = this.head(`🌅 ${era.name} era`, `${era.yo} · ${st.time.year}`);
    h += `<p>${esc(era.blurb)}</p>`;
    const r = eraRequirements(st);
    if (r) {
      h += `<h4>Next: ${esc(r.next.name)} (${esc(r.next.yo)})</h4><p class="muted">${esc(r.next.blurb)}</p>`;
      for (const q of r.reqs) h += `<div class="req ${q.met ? 'met' : ''}"><span>${q.met ? '✅' : '⬜'}</span><span>${esc(q.text)}${q.cost ? ` — ${costText(q.cost)}` : ''}${q.have !== undefined ? ` (now ${q.have})` : ''}</span></div>`;
      const ok = r.reqs.every((q) => q.met);
      h += `<h4></h4><button class="btn primary big" data-act="advance" ${ok ? '' : 'disabled'}>Advance to the ${esc(r.next.name)} era</button>`;
      const unlocks = Object.values(BUILDINGS).filter((d) => d.era === st.era + 1 && d.buildable !== false).map((d) => d.name);
      if (unlocks.length) h += `<p class="muted">Unlocks: ${esc(unlocks.join(', '))}.</p>`;
    }
    h += '<h4>🇳🇬 The New Nigeria</h4>';
    const reqs = proclaimRequirements(st);
    for (const q of reqs) h += `<div class="req ${q.met ? 'met' : ''}"><span>${q.met ? '✅' : '⬜'}</span><span>${esc(q.text)}</span></div>`;
    h += `<button class="btn primary big" data-act="proclaim" ${reqs.every((q) => q.met) ? '' : 'disabled'}>Proclaim The New Nigeria</button>`;
    return h;
  }

  kingdomHtml() {
    const st = this.st;
    let h = this.head('⚖️ Rule', `${population(st)} people · happiness ${Math.round(st.happy)} → ${Math.round(st.happyTarget)}`);
    h += '<h4>Food rations</h4><div class="seg">';
    RATIONS.forEach((r, k) => (h += `<button class="btn ${st.rations === k ? 'on' : ''}" data-act="rations" data-v="${k}">${r.name}</button>`));
    h += `</div><p class="muted">Your people eat ${RATIONS[st.rations].eat} food each per day. ${Math.floor(totalFood(st))} food in store.</p>`;
    h += '<h4>Taxes</h4><div class="seg">';
    TAXES.forEach((t, k) => (h += `<button class="btn ${st.tax === k ? 'on' : ''}" data-act="tax" data-v="${k}">${t.name}</button>`));
    h += `</div><p class="muted">${TAXES[st.tax].per} cowries per resident per day. Last day: +${Math.round(st.stats.lastTax)} 🐚.</p>`;
    h += '<h4>Happiness</h4><div class="kv">';
    for (const f of happinessFactors(st)) {
      if (!f.v) continue;
      h += `<span>${esc(f.label)}</span><b class="${f.v > 0 ? 'pos' : 'neg'}">${f.v > 0 ? '+' : ''}${f.v}</b>`;
    }
    h += '</div><p class="muted">Above 50, strangers come to live with you. Below 35, people start to leave.</p>';
    const jobs = {};
    for (const b of st.buildings) {
      const d = BUILDINGS[b.type];
      if (!d.workers || b.owner !== 'player' || b.built < 1) continue;
      jobs[b.type] = jobs[b.type] || { have: 0, want: 0 };
      jobs[b.type].have += b.workers.length;
      jobs[b.type].want += b.paused ? 0 : d.workers;
    }
    const idle = residents(st).filter((c) => !c.job).length;
    h += `<h4>Labour</h4><div class="kv">${Object.entries(jobs)
      .map(([t, j]) => `<span>${ICONS[t] || ''} ${esc(BUILDINGS[t].name)}</span><b class="${j.have < j.want ? 'neg' : ''}">${j.have}/${j.want}</b>`)
      .join('')}<span>Idle residents</span><b>${idle}</b><span>Strangers waiting</span><b>${strangers(st).length}</b></div>`;
    return h;
  }

  menuHtml() {
    const g = this.game;
    return `${this.head('☰ Menu', `Map seed ${this.st.seed}`)}
      <div class="list">
        <button class="btn" data-act="save">💾 Save game</button>
        <button class="btn" data-act="load" ${g.hasSave() ? '' : 'disabled'}>📂 Load last save</button>
        <button class="btn" data-act="territory">${g.view.showTerritory ? '🗺️ Hide' : '🗺️ Show'} building land</button>
        <button class="btn" data-act="log">📜 Message history</button>
        <button class="btn" data-act="title">🏠 Title screen</button>
      </div>
      <p class="muted">The game also saves itself every minute. Keys: WASD/arrows scroll, +/− zoom, Space pause, 1–3 speed, G select army, Esc cancel, H go home.</p>
      ${this.panel?.data === 'log' ? `<h4>History</h4><div class="list">${this.st.log.slice().reverse().map((m) => `<div class="item"><span>${esc(m.text)}</span><span class="muted">d${m.day + 1}</span></div>`).join('')}</div>` : ''}`;
  }

  onPanelClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const g = this.game;
    const st = this.st;
    const act = el.dataset.act;
    const sel = this.panel?.kind === 'building' ? this.panel.data : null;
    switch (act) {
      case 'close':
        this.closePanel();
        g.clearSelection();
        return;
      case 'citizen':
        g.selectEntity(+el.dataset.id);
        return;
      case 'building':
        g.selectEntity(+el.dataset.id);
        return;
      case 'prio':
        g.cmd('setPriority', sel, +el.dataset.v);
        break;
      case 'pause':
        g.cmd('togglePause', sel);
        break;
      case 'demolish':
        g.cmd('demolish', sel);
        this.closePanel();
        g.clearSelection();
        return;
      case 'train': {
        const r = g.cmd('train', sel, el.dataset.type);
        if (r && !r.ok) this.toast(r.reason);
        break;
      }
      case 'sell':
      case 'buy': {
        const r = g.cmd('trade', el.dataset.r, 10, act === 'buy');
        if (r && !r.ok) this.toast(r.reason);
        break;
      }
      case 'diplo': {
        const r = g.cmd('diplo', el.dataset.f, el.dataset.a);
        if (r && !r.ok && r.reason) this.toast(r.reason);
        break;
      }
      case 'goto':
        g.centerOn(+el.dataset.x, +el.dataset.y);
        return;
      case 'halt':
        g.haltSelected();
        break;
      case 'home':
        g.sendSelectedHome();
        break;
      case 'deselect':
        g.clearSelection();
        this.closePanel();
        return;
      case 'advance':
        g.cmd('advanceEra');
        break;
      case 'proclaim':
        g.cmd('proclaim');
        break;
      case 'rations':
        g.cmd('setRations', +el.dataset.v);
        break;
      case 'tax':
        g.cmd('setTax', +el.dataset.v);
        break;
      case 'save':
        g.save(true);
        break;
      case 'load':
        g.load();
        return;
      case 'territory':
        g.view.showTerritory = !g.view.showTerritory;
        break;
      case 'log':
        this.panel.data = this.panel.data === 'log' ? null : 'log';
        break;
      case 'title':
        g.toTitle();
        return;
      default:
    }
    this.lastPanelHtml = '';
    this.renderPanel();
    this.renderTop();
  }

  toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => (el.hidden = true), 2600);
  }

  placeBar(show, msg, ok) {
    const bar = $('#placebar');
    bar.hidden = !show;
    if (!show) return;
    $('#place-msg').textContent = msg;
    $('#place-ok').hidden = !ok;
  }
}

// --- Title screen map ---------------------------------------------------------------

export function renderNigeria(el, onPick) {
  const S = 46;
  const G = 4;
  let svg = `<svg viewBox="0 0 ${8 * (S + G)} ${7 * (S + G)}" role="img" aria-label="Map of Nigeria's states">`;
  for (const [name, col, row, id] of STATES) {
    const x = col * (S + G);
    const y = row * (S + G);
    const open = !!id;
    const soon = NEXT_UP.includes(name);
    const fill = open ? '#f2b84b' : soon ? 'rgba(242,184,75,0.22)' : 'rgba(255,255,255,0.07)';
    svg += `<g class="st ${open ? 'open' : ''}" data-id="${id || ''}" data-name="${name}">
      <title>${name}${open ? ' — play now' : soon ? ' — coming next' : ' — coming in a future update'}</title>
      <rect x="${x}" y="${y}" width="${S}" height="${S}" rx="8" fill="${fill}" stroke="${open ? '#fff3c4' : 'rgba(255,255,255,0.15)'}" />
      <text x="${x + S / 2}" y="${y + S / 2 + 1}" text-anchor="middle" dominant-baseline="middle" font-size="${name.length > 8 ? 7.5 : 9}" font-weight="700" fill="${open ? '#2a1a05' : 'rgba(255,255,255,0.6)'}">${name}</text>
      ${open ? `<text x="${x + S / 2}" y="${y + S - 7}" text-anchor="middle" font-size="7" font-weight="800" fill="#2a1a05">PLAY</text>` : soon ? `<text x="${x + S / 2}" y="${y + S - 7}" text-anchor="middle" font-size="6.5" fill="rgba(255,236,190,0.8)">NEXT</text>` : ''}
    </g>`;
  }
  svg += '</svg>';
  el.innerHTML = svg;
  el.addEventListener('click', (e) => {
    const g = e.target.closest('.st');
    if (g && g.dataset.id) onPick(g.dataset.id);
  });
}
