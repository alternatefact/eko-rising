// Everything on screen that isn't the map: resource bar, goals, messages,
// the build bar, the side panel and story pop-ups.

import { BUILDINGS, CATEGORIES, stat, levelName, nextUpgrade, costOf, buildCrew } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { ERAS } from '../data/eras.js';
import { RESOURCES, FOOD, costText, money } from '../data/resources.js';
import {
  canAfford, totalFood, population, housingCap, armySize, armyCap, strangers, residents, season, fireCap,
  happinessFactors, RATIONS, TAXES, priceOf, TRADEABLE, hasBuilding, wagesDue, hireOptions, marketDemand,
} from '../sim/economy.js';
import { citizenStatus, jobless, siteStage, freeBuilders, storageHeldUp } from '../sim/citizens.js';
import { canTrain, armyPower } from '../sim/military.js';
import { STRENGTH, garrisonAlive, factionPower, giftCost, unified, majors, subdued } from '../sim/factions.js';
import { eventDef, eraRequirements, proclaimRequirements } from '../sim/events.js';
import { canBarter, barterRoom, importName, importIcon, UPGRADE_ITEMS } from '../sim/trade.js';
import { buildLocked, canUpgrade, currentStep, stepText, storyRunning, mudUpgradeCost, suggestPlace, canRepair, repairCost } from '../sim/index.js';
import { STATES, NEXT_UP, LOCKED } from '../regions/index.js';
import { storyArt, leaderArt, ageArt, sceneArt } from '../data/art.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const stars = (n) => `${'★'.repeat(n)}<span style="opacity:.3">${'★'.repeat(5 - n)}</span>`;
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.floor(n)}`);

const ICONS = {
  compound: '🏠', hut: '🛖', farm: '🍠', cassava: '🌿', garri: '🥣', woodcutter: '🪓', hunter: '🏹', fisher: '🎣',
  storehouse: '📦', granary: '🌾', palisade: '🪵', gate: '🚪', well: '💧', shrine: '🕯️', market: '🛍️', quarry: '⛏️',
  watchtower: '🗼', warcamp: '⚔️', palace: '👑', palmpress: '🌴', ironmine: '⚒️', blacksmith: '🔨', canoeyard: '🛶',
  stonewall: '🧱', port: '⚓', fort: '🛡️', school: '🏫', assembly: '🏛️', campfire: '🔥', hospital: '🏥', factory: '🏭',
  bank: '🏦', brickyard: '🧱', stockpile: '🧺',
};
const UNIT_ICON = { scout: '👁️', spearman: '🔱', archer: '🏹', swordsman: '🗡️', horseman: '🐎', musketeer: '💥', bowman: '🏹' };
// Goods that only show in the top bar once you have some (or reach the age they matter in).
const TOP_GOODS = [
  ['wood', 0], ['bricks', 0], ['stone', 1], ['cassava', 1], ['palmoil', 1], ['iron', 2], ['weapons', 2],
  ['salt', 9], ['cloth', 9], ['muskets', 9], ['horses', 9], ['cannon', 9],
];

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
      if (e.target.closest('button[data-tool="demolish"]')) {
        if (this.game.mode.demolish) this.game.cancelBuild();
        else this.game.startDemolish();
        this.renderBuild(true);
        return;
      }
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
      if (e.target.closest('[data-guide="show"]')) {
        this.game.showPoint();
        return;
      }
      if (e.target.closest('[data-guide="toggle"]')) {
        this.collapsedGoals = !this.collapsedGoals;
        this.renderGoals(true);
        return;
      }
      if (e.target.closest('h3')) {
        this.collapsedGoals = !this.collapsedGoals;
        this.renderGoals(true);
      }
    });
    $('#modal').addEventListener('click', (e) => this.onModalClick(e));
    $('#place-ok').addEventListener('click', () => this.game.confirmPlace());
    $('#mud-btn').addEventListener('click', () => {
      if (this.panel?.kind === 'mud') this.closePanel();
      else this.openPanel('mud');
    });
    $('#place-cancel').addEventListener('click', () => this.game.cancelBuild());
    if (window.innerWidth < 760) {
      this.collapsedGoals = true;
    }
  }

  // Build-bar pictures come from the renderer's sprite sheets once they load.
  makeThumbs() {}

  // --- Periodic refresh ----------------------------------------------------

  update() {
    const st = this.st;
    this.renderTop();
    this.renderGoals();
    this.renderFeed();
    this.renderBuild();
    this.renderModal();
    this.renderAlert();
    this.game.feedback?.check();
    if (this.panel) this.renderPanel();
    $('#speed-btn').innerHTML = this.game.paused ? '▶<span>Paused</span>' : `⏩<span>${this.game.speed}×</span>`;
    $('#speed-btn').classList.toggle('on', this.game.paused);
    const eraBtn = document.querySelector('[data-panel="era"]');
    const req = eraRequirements(st);
    eraBtn.classList.toggle('alert', !!req && req.reqs.every((r) => r.met));
    // The kingdom upgrade, once there are mud bricks to build with.
    const mud = $('#mud-btn');
    mud.hidden = !!st.flags.mud || !(st.res.bricks >= 1 || st.buildings.some((b) => b.type === 'brickyard' && !b.dead));
    mud.classList.toggle('alert', !mud.hidden && st.res.bricks >= mudUpgradeCost(st));
    this.highlight();
  }

  // Point at what the guide is talking about. A card in the build bar or a
  // button gets the yellow arrow over the page; something on the map gets
  // the renderer's arrow. While a building is being placed, the arrow shows
  // a good spot for it (or the next gap in the fence).
  highlight() {
    const st = this.st;
    const g = this.game;
    const step = currentStep(st);
    let pt = step?.point ? (() => {
      try {
        return step.point(st);
      } catch (err) {
        return null;
      }
    })() : null;
    // Some steps need something selected first: the soldiers, or the founder.
    if (pt?.select === 'army' && !g.myUnits().length) pt = { ui: '#army-btn' };
    else if (typeof pt?.select === 'number' && !g.view.selected.has(pt.select)) pt = { id: pt.select };
    const key = `${step?.id}|${pt?.build || ''}|${pt?.ui || ''}`;
    if (key !== this.lastHighlight) {
      this.lastHighlight = key;
      this.arrowScrolled = null;
      if (pt?.build) {
        const cat = BUILDINGS[pt.build]?.cat;
        // Open the right tab once, so the card is in sight.
        if (cat && this.tab !== cat && this.tabFor !== key) {
          this.tab = cat;
          this.tabFor = key;
          this.renderBuild(true);
          const bar = $('#buildbar');
          if (bar.classList.contains('collapsed')) {
            bar.classList.remove('collapsed');
            document.getElementById('app').classList.remove('build-collapsed');
          }
        }
      }
    }
    document.querySelectorAll('.pulse').forEach((el) => el.classList.remove('pulse'));
    const placing = g.mode.build || g.mode.demolish || g.mode.move;
    let el = null;
    let map = null;
    if (pt?.build) {
      const cat = BUILDINGS[pt.build]?.cat;
      if (g.mode.build === pt.build) {
        if (this.suggestFor !== pt.build || st.time.t - (this.suggestT || 0) > 1.5 || st.time.t < this.suggestT) {
          this.suggestFor = pt.build;
          this.suggestT = st.time.t;
          this.suggestAt = suggestPlace(st, pt.build);
        }
        const s = this.suggestAt;
        const def = BUILDINGS[pt.build];
        if (s) map = { x: s.x + def.w / 2, y: s.y + def.h / 2 };
      } else if (!placing) {
        document.querySelector(`.bcard[data-type="${pt.build}"]`)?.classList.add('pulse');
        if (this.tab !== cat) document.querySelector(`#build-tabs [data-tab="${cat}"]`)?.classList.add('pulse');
        el = $('#buildbar').classList.contains('collapsed') ? '#build-toggle' : this.tab !== cat ? `#build-tabs [data-tab="${cat}"]` : `.bcard[data-type="${pt.build}"]`;
      }
    } else if (pt?.ui && shown(document.querySelector(pt.ui))) {
      document.querySelector(pt.ui).classList.add('pulse');
      el = pt.ui;
    } else if (pt && (pt.id || pt.x !== undefined)) {
      map = pt;
    }
    this.arrowAt = el;
    g.view.pointTarget = map;
  }

  // The yellow arrow over a button or card, kept in place every frame.
  placeArrow() {
    const a = this.arrowEl || (this.arrowEl = $('#guide-arrow'));
    const el = this.arrowAt && document.getElementById('modal').hidden ? document.querySelector(this.arrowAt) : null;
    if (!el || !shown(el)) {
      a.hidden = true;
      return;
    }
    // A card scrolled out of sight in the build bar: bring it in.
    if (el.classList.contains('bcard') && this.arrowScrolled !== this.arrowAt) {
      this.arrowScrolled = this.arrowAt;
      el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
    const r = el.getBoundingClientRect();
    // Covered by a panel: no arrow until it is in sight again.
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 12));
    if (top && !el.contains(top) && !top.contains(el)) {
      a.hidden = true;
      return;
    }
    // Up in the top bar, the arrow points up at it from below.
    const up = r.top < 120;
    a.classList.toggle('up', up);
    a.style.left = `${Math.round(r.left + r.width / 2)}px`;
    a.style.top = `${Math.round(up ? r.bottom : r.top)}px`;
    a.hidden = false;
  }

  // The buttons that turn the view and thin the trees.
  mapTools() {
    $('#trees-btn').classList.toggle('on', !!this.game.renderer.seeThrough);
  }

  renderTop() {
    const st = this.st;
    $('#town-name').textContent = st.name;
    $('#era-chip').textContent = `${ERAS[st.era].name} · ${ERAS[st.era].yo}`;
    const cap = st.cap;
    const food = totalFood(st);
    const chips = [];
    // Money, people and mood first: they matter most and stay visible on small screens.
    const m = money(st);
    const wages = wagesDue(st);
    chips.push(`<span class="res money ${wages > st.res.cowries ? 'low' : ''}" title="${m.name}${wages ? ` — hired fighters cost ${wages} a day` : ''}">${m.icon} ${fmt(st.res.cowries)}</span>`);
    const pop = residents(st).length;
    const waiting = strangers(st).length;
    chips.push(`<span class="res" title="Residents / homes">👥 ${pop}<small>/${housingCap(st)}</small></span>`);
    if (waiting) chips.push(`<span class="res" title="People at the fire with no work (room for ${fireCap(st)})">🔥 ${waiting}</span>`);
    chips.push(`<span class="res" title="Soldiers / army limit">🛡️ ${armySize(st)}<small>/${armyCap(st)}</small></span>`);
    const h = Math.round(st.happy);
    const face = h >= 70 ? '😄' : h >= 50 ? '🙂' : h >= 35 ? '😐' : '😠';
    const trend = st.happyTarget > st.happy + 0.5 ? '▲' : st.happyTarget < st.happy - 0.5 ? '▼' : '';
    chips.push(`<span class="res ${h < 35 ? 'low' : ''}" title="Happiness — above 50 strangers come, below 35 people leave">${face} ${h}${trend}</span>`);
    chips.push(`<span class="res ${food >= cap.food - 1 ? 'full' : food < population(st) * 2 ? 'low' : ''}" title="Food stored / granary space">🍽️ ${fmt(food)}<small>/${fmt(cap.food)}</small></span>`);
    for (const k of FOOD) {
      if (st.res[k] < 1 && k !== 'yam' && !(k === 'garri' && st.flags.cassava)) continue;
      chips.push(`<span class="res" title="${RESOURCES[k].name}">${RESOURCES[k].icon} ${fmt(st.res[k])}</span>`);
    }
    for (const [k, era] of TOP_GOODS) {
      if (st.res[k] < 1 && st.era < era) continue;
      if (k === 'cassava' && !st.flags.cassava && st.res[k] < 1) continue;
      chips.push(`<span class="res ${st.res[k] >= cap.goods - 1 ? 'full' : ''}" title="${RESOURCES[k].name} (storehouse space ${cap.goods})">${RESOURCES[k].icon} ${fmt(st.res[k])}</span>`);
    }
    const html = chips.join('');
    if (html !== this.lastTop) {
      $('#resources').innerHTML = html;
      this.lastTop = html;
    }
    const s = season(st);
    $('#date').innerHTML = `${s.name}<br><b>${st.time.year}</b> · day ${st.time.day + 1}`;
  }

  // A clear warning when the stores are full and workers are held up, with a
  // button to build more room.
  renderAlert() {
    const st = this.st;
    const g = this.game;
    const el = $('#alert');
    const held = storageHeldUp(st);
    const busy = g.mode.build || g.mode.demolish || g.mode.move || g.mode.rally;
    const show = !!held && !busy && !(this.alertHiddenUntil > st.time.t) && !st.eventQueue.length;
    document.getElementById('app').classList.toggle('alerting', show);
    if (!show) {
      el.hidden = true;
      this.lastAlert = '';
      return;
    }
    const names = [...(held.food ? ['food'] : []), ...held.goods.map((r) => (r === 'wood' ? 'planks' : RESOURCES[r].name.toLowerCase()))];
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0] || 'more';
    const type = this.storeFor(held);
    const floor = type === 'stockpile';
    const market = held.goods.length && st.buildings.some((b) => b.type === 'market' && b.owner === 'player' && !b.dead && b.built >= 1);
    const html = `<span class="alert-text"><b>📦 ${floor ? 'The storage floor is full' : 'Your stores are full'}</b>: no room for ${esc(list)}. ${held.n > 1 ? `${held.n} workers are` : 'One worker is'} waiting at work with ${held.n > 1 ? 'their loads' : 'a load'}.${market ? ' Or sell some at the market.' : ''}</span>
      <button class="btn primary" data-a="build" data-t="${type}">🔨 Build ${floor ? 'another' : 'a'} ${esc(BUILDINGS[type].name)}</button>
      <button class="btn" data-a="hide" aria-label="Hide this for now" title="Hide this for now">✕</button>`;
    if (html !== this.lastAlert) {
      el.innerHTML = html;
      this.lastAlert = html;
      el.onclick = (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.a === 'build') g.startBuild(b.dataset.t);
        else this.alertHiddenUntil = this.st.time.t + 90;
        this.renderAlert();
      };
    }
    el.hidden = false;
  }

  // The building that makes the most room for what is held up.
  storeFor(held) {
    const st = this.st;
    const want = held.food && !held.goods.length ? 'granary' : !held.food && held.goods.length ? 'storehouse' : null;
    return want && !buildLocked(st, want) ? want : 'stockpile';
  }

  renderGoals(force) {
    const st = this.st;
    if (storyRunning(st)) {
      this.renderGuide(force);
      return;
    }
    const goals = st.objCurrent.map((id) => st.region.objectives.find((o) => o.id === id)).filter(Boolean);
    const key = goals.map((g) => g.id).join() + this.collapsedGoals;
    if (key === this.lastGoals && !force) return;
    this.lastGoals = key;
    const el = $('#objectives');
    el.classList.toggle('collapsed', this.collapsedGoals);
    el.classList.remove('guiding');
    this.lastGuide = null;
    el.hidden = !goals.length;
    el.innerHTML = `<h3><span>🎯 Goals</span><span>${this.collapsedGoals ? '▸' : '▾'}</span></h3>${goals
      .map((g) => `<div class="goal"><b>${esc(g.text)}</b><span>${esc(g.hint)}</span></div>`)
      .join('')}`;
  }

  // The guide: who is speaking, what they say, and the one thing to do now.
  renderGuide(force) {
    const st = this.st;
    const step = currentStep(st);
    const el = $('#objectives');
    if (!step) {
      el.hidden = true;
      return;
    }
    const steps = st.region.story;
    const who = step.who === 'founder' ? st.founder : step.who === 'spouse' ? st.spouse : 'Guide';
    const face = step.who === 'founder' ? '👨🏾' : step.who === 'spouse' ? '👩🏾' : '🧭';
    const say = stepText(st, step, 'say');
    const task = stepText(st, step, 'task');
    const hint = stepText(st, step, 'hint');
    const html = `<div class="guide who-${step.who || 'guide'}">
      <div class="guide-head"><span class="face">${face}</span><b>${esc(who)}</b><span class="step">${st.tut.i + 1}/${steps.length}</span><button class="mini" data-guide="toggle" aria-label="${this.collapsedGoals ? 'Show' : 'Hide'} the guide">${this.collapsedGoals ? '▸' : '▾'}</button></div>
      <p class="say">${esc(say)}</p>
      <div class="task"><span class="tick">▶</span><b>${esc(task)}</b>${step.point ? '<button class="showme" data-guide="show" title="Show me">📍</button>' : ''}</div>
      ${this.collapsedGoals || !hint ? '' : `<p class="hint">${esc(hint)}</p>`}
    </div>`;
    if (html === this.lastGuide && !force) return;
    this.lastGuide = html;
    this.lastGoals = null;
    el.hidden = false;
    el.classList.add('guiding');
    el.classList.remove('collapsed');
    el.innerHTML = html;
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
    const sig = `${this.tab}|${st.era}|${st.flags.mud}|${Object.entries(st.res).map(([k, v]) => Math.floor(v / 5)).join()}|${this.game.mode.build}|${this.game.mode.demolish}|${st.flags.europeanTrade}|${st.buildings.length}`;
    if (sig === this.lastBuild && !force) return;
    this.lastBuild = sig;
    $('#build-tabs').innerHTML =
      CATEGORIES.map((c) => `<button data-tab="${c.id}" class="${c.id === this.tab ? 'on' : ''}">${c.icon} ${c.name}</button>`).join('') +
      `<button data-tool="demolish" class="tool ${this.game.mode.demolish ? 'on' : ''}" title="Pull down buildings and fence sections (Delete removes the selected building)">🔨 Pull down</button>`;
    const items = Object.entries(BUILDINGS).filter(([, d]) => d.cat === this.tab && d.buildable !== false);
    $('#build-items').innerHTML = items
      .map(([type, d]) => {
        const locked = buildLocked(st, type);
        const cost = costOf(st, type);
        const poor = !canAfford(st, cost);
        const cls = ['bcard', locked ? 'locked' : '', poor ? 'poor' : '', this.game.mode.build === type ? 'on' : ''].join(' ');
        const natural = !cost.cowries;
        const tip = `${d.name} (${d.yo}) — ${d.desc}${natural ? '\n🌿 Built from natural materials — no money needed.' : `\n${money(st).icon} Needs money.`}${locked ? `\n🔒 ${locked}` : ''}`;
        return `<div class="${cls}" data-type="${type}" title="${esc(tip)}" role="button" tabindex="0">
          <img src="${this.thumbs[type]}" alt="" />
          <span class="nm">${locked ? '🔒 ' : ''}${esc(d.name)}</span>
          <span class="cost">${costText(cost, st) || 'free'}</span>
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
      modal.classList.remove('over-map');
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
    const key = `${entry.id}-${entry.fid || entry.era || ''}-${st.eventQueue.length}-${Math.floor(st.res.cowries)}`;
    if (key === this.modalKey) return;
    this.modalKey = key;
    const ev = eventDef(st, entry);
    if (!ev) {
      st.eventQueue.shift();
      return;
    }
    const text = typeof ev.text === 'function' ? ev.text(st) : ev.text;
    const art = ev.art === 'meet' ? '🤝' : ev.art || '📜';
    const portrait = entry.id === 'meet' ? leaderArt(st.factionMap[entry.fid]) : null;
    const img = portrait || (entry.id === 'age' ? ageArt(entry.era) : storyArt(entry.id));
    modal.hidden = false;
    // Something to see on the map (the host of Benin): the words sit low,
    // over a clear view of it.
    modal.classList.toggle('over-map', !!entry.at);
    modal.innerHTML = `<div class="event" role="dialog" aria-modal="true">
      ${this.artHtml(img, art, ev.color, !!portrait)}
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

  // A painted picture, or the emoji art if there is none (or it fails to load).
  artHtml(img, emoji, color, portrait) {
    const bg = color ? ` style="background:radial-gradient(circle at 50% 120%, ${color}, transparent 65%), linear-gradient(180deg,#23356b,#3a2414)"` : '';
    const cls = ['art', img ? 'painted' : '', portrait ? 'portrait' : ''].join(' ');
    return `<div class="${cls}"${bg}>${img ? `<img src="${img}" alt="" onerror="this.parentNode.classList.remove('painted');this.remove()" />` : ''}<span>${emoji}</span></div>`;
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
    const chapter = st.region.id === 'ogun' ? 'Chapter two — Ogun —' : `Chapter one — ${esc(st.region.name)} —`;
    const next = st.region.id === 'ogun' ? 'The road on to Oyo and Edo opens in a future update.' : st.flags.ogunOpen ? 'The road north is open: Ogun State waits for you on the map of Nigeria.' : 'Break the host of Benin to open Ogun State, the next land to explore.';
    return `<div class="event end">${this.artHtml(sceneArt('end_victory'), '🇳🇬')}
      <div class="body"><h2>The New Nigeria</h2>
      <div class="text">In the year ${st.time.year}, in the House of Assembly at ${esc(st.name)}, every people of the land speaks with one voice. What began as ${esc(st.founder)} and ${esc(st.spouse)}'s ${st.region.id === 'ogun' ? 'camp on the road north' : 'yam farm by the lagoon'} is now the heart of a new nation.\n\n${chapter} is complete. ${unified(st).length} peoples united, ${population(st)} people in your city, ${st.stats.conquered} villages conquered, ${st.stats.trained} soldiers trained.\n\n${next}</div>
      <div class="choices"><button class="choice" data-end="continue"><b>Keep building</b><span>Your city is yours to grow.</span></button>
      <button class="choice" data-end="feedback"><b>💬 Tell us what you thought</b><span>A few words help us make the next chapter better.</span></button>
      <button class="choice" data-end="title"><b>Back to the map of Nigeria</b></button></div>
      <p class="owner">Eko Rising — an original game by alternatefact Studios.</p></div></div>`;
  }

  defeatHtml() {
    const st = this.st;
    return `<div class="event end">${this.artHtml(sceneArt('end_defeat'), '🕯️')}<div class="body"><h2>The fire goes out</h2>
      <div class="text">${esc(st.gameOver.reason)}\n\nYou lasted until ${st.time.year}. Every great city has fallen and risen again.</div>
      <div class="choices"><button class="choice" data-end="restart"><b>Try again on a new map</b><span>With the guide, step by step.</span></button>
      <button class="choice" data-end="restart-free"><b>Start again without the guide</b><span>A new map; build whatever you think matters first.</span></button>
      <button class="choice" data-end="load"><b>Load a saved game</b></button>
      <button class="choice" data-end="feedback"><b>💬 Tell us what happened</b><span>Too hard? Something unfair or broken? We want to know.</span></button>
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
      case 'saves':
        html = `${this.head(p.data === 'load' ? '📂 Load a game' : '💾 Save the game', esc(st.name))}${this.savesHtml(true, p.data)}`;
        break;
      case 'mud':
        html = this.mudHtml();
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
    const lvl = b.level || 1;
    const cur = lvl > 1 ? def.upgrades[lvl - 2] : null;
    let h = this.head(`${ICONS[b.type] || ''} ${esc(levelName(b))}`, `${esc(cur?.yo || def.yo)}${def.upgrades ? ` · level ${lvl} of ${def.upgrades.length + 1}` : ''}`);
    h += `<p class="muted">${esc(cur?.desc ? `${cur.desc} ${def.desc}` : def.desc)}</p>`;
    if (b.built < 1 && b.owner === 'player') {
      h += this.siteHtml(b);
      if (def.workers) h += `<p class="muted">Once it stands, ${def.workers > 1 ? `${def.workers} people` : 'one person'} from the fire will work here.</p>`;
      h += `<h4></h4><div class="row"><button class="btn danger" data-act="demolish">Cancel</button></div><p class="muted">Cancelling gives back everything it cost.</p>`;
      return h;
    }
    // Damaged: what mending it takes, first, where it is seen. A wreck is
    // good for nothing else until it is mended.
    const hurt = b.owner === 'player' && !def.invulnerable && (b.repairing || b.wrecked || b.hp < b.maxHp);
    if (hurt) {
      h += this.repairHtml(b);
      if (b.wrecked) return h;
    } else if (!def.invulnerable) h += `<h4>Condition</h4><div class="bar"><i style="width:${Math.round((b.hp / b.maxHp) * 100)}%;background:${b.hp / b.maxHp > 0.5 ? '' : '#e2574c'}"></i></div>`;
    if (def.job?.type === 'farm') h += `<h4>${b.type === 'cassava' ? 'Cassava' : 'Yams'}</h4><div class="bar"><i style="width:${Math.round(b.growth * 100)}%;background:#7bbf3f"></i></div><p class="muted">${season(st).name}: crops grow at ×${season(st).farm}.</p>`;
    if (def.workers) {
      h += `<h4>Workers ${b.workers.length}/${def.workers}</h4><div class="list">`;
      for (const id of b.workers) {
        const c = st.byId.get(id);
        if (c) h += `<div class="item click" data-act="citizen" data-id="${c.id}"><span>${esc(c.name)}</span><span class="muted">${esc(citizenStatus(st, c))}</span></div>`;
      }
      if (!b.workers.length) h += `<div class="item"><span class="muted">${b.paused ? 'Paused.' : 'Nobody yet. Whoever sits by the fire comes to work here; or tap one of your people and then this building.'}</span></div>`;
      h += '</div>';
      // People at the fire who could come and work here.
      const free = b.built >= 1 && b.workers.length < def.workers ? jobless(st) : [];
      if (free.length) {
        h += `<h4>At the fire, free to work</h4><div class="list">`;
        for (const c of free.slice(0, 6)) h += `<div class="item"><span>${esc(c.name)}</span><button class="btn primary" data-act="assign" data-c="${c.id}">Send here</button></div>`;
        h += '</div>';
      }
      h += '<h4>Priority</h4><div class="seg">';
      ['Low', 'Normal', 'High'].forEach((n, k) => {
        h += `<button class="btn ${b.priority === k ? 'on' : ''}" data-act="prio" data-v="${k}">${n}</button>`;
      });
      h += `<button class="btn ${b.paused ? 'on' : ''}" data-act="pause">${b.paused ? '▶ Resume' : '⏸ Pause'}</button></div>`;
      h += '<p class="muted">People sitting at the fire go to the highest-priority work first. Nobody leaves a job by themselves: to move someone, tap them and then the place you want them.</p>';
    }
    if (def.housing) {
      h += `<h4>Residents ${b.residents.length}/${stat(b, 'housing')}</h4><div class="list">`;
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
      const s = stat(b, 'storage');
      h += `<h4>Storage</h4><p class="muted">Adds room for ${s.food ? `${Math.round(s.food)} food` : ''}${s.food && s.goods ? ' and ' : ''}${s.goods ? `${Math.round(s.goods)} of each good` : ''}.</p>`;
      if (b.type === 'stockpile') {
        const held = Object.keys(RESOURCES).filter((k) => RESOURCES[k].kind !== 'money' && st.res[k] >= 1);
        h += `<p>${held.length ? `Stacked on your floors: ${held.map((k) => `${RESOURCES[k].icon} ${Math.floor(st.res[k])}`).join(' · ')}` : 'Nothing is stacked here yet.'}</p>`;
      }
    }
    if (def.job?.type === 'craft' && b.built >= 1) {
      const ins = Object.entries(def.job.inputs).map(([r, n]) => `${RESOURCES[r].icon} ${n} ${RESOURCES[r].name.toLowerCase()}`).join(' + ');
      h += `<h4>Makes</h4><p class="muted">${ins} → ${RESOURCES[def.job.product].icon} ${def.job.yield} ${RESOURCES[def.job.product].name.toLowerCase()}${def.job.cash ? ` and ${money(st).icon} ${def.job.cash}` : ''}.</p>`;
    }
    if (def.trains && b.built >= 1) {
      h += `<h4>Train (army ${armySize(st)}/${armyCap(st)})</h4><div class="list">`;
      for (const type of def.trains) {
        const u = UNITS[type];
        const can = canTrain(st, b, type);
        if ((u.era || 0) > st.era + 1) continue;
        h += `<div class="item"><span>${UNIT_ICON[type]} <b>${esc(u.name)}</b> <span class="muted">${esc(u.yo)}</span><br><span class="muted">${costText(u.cost, st)}</span>${can.ok ? '' : `<br><span class="muted warn">${esc(can.reason)}</span>`}</span>
          <button class="btn ${can.ok ? 'primary' : ''}" data-act="train" data-type="${type}" ${can.ok ? '' : `disabled title="${esc(can.reason)}"`}>Train</button></div>`;
      }
      h += '</div>';
      if (b.queue.length) {
        const u = UNITS[b.queue[0]];
        h += `<p>In training: ${b.queue.map((q) => UNIT_ICON[q]).join(' ')} <span class="muted">${b.trainStatus ? esc(b.trainStatus) : `${Math.min(100, Math.round((b.trainT / u.train) * 100))}%`}</span></p>`;
      }
      h += '<p class="muted">Each recruit is a person: a stranger from the fire, or an idle resident.</p>';
      h += this.rallyHtml(true);
    }
    if (def.hires && b.built >= 1) h += this.hireHtml();
    if (b.type === 'market' && b.built >= 1) h += this.marketHtml();
    if (b.type === 'port' && b.built >= 1) h += this.portHtml();
    if (b.owner === 'player') h += this.upgradeHtml(b);
    if (def.tower) h += `<p class="muted">Shoots enemies within ${def.tower.range} tiles.</p>`;
    if (b.owner === 'player' && b.type !== 'compound' && b.type !== 'campfire') {
      h += '<h4></h4><div class="row">';
      if (def.movable) h += '<button class="btn" data-act="move">🚚 Move</button>';
      h += `<button class="btn danger" data-act="demolish">Pull down</button></div>`;
      h += `<p class="muted">${def.movable ? 'Sheds and farm land can be moved. ' : ''}Pulling down gives back half of what it cost.</p>`;
    }
    return h;
  }

  // Damage and mending: what it takes, who is doing it, how far along.
  repairHtml(b) {
    const st = this.st;
    const g = this.game;
    const pct = Math.round((b.hp / b.maxHp) * 100);
    let h = `<h4>🔨 ${b.repairing ? 'Being repaired' : b.wrecked ? 'Wrecked' : 'Damaged'} · ${pct}%</h4><div class="bar"><i style="width:${pct}%;background:${b.repairing ? '#f2b84b' : pct > 50 ? '' : '#e2574c'}"></i></div>`;
    if (b.repairing) {
      const stage = siteStage(b);
      h += `<p>${esc(stage.name)}${b.got < b.need ? ` (${Math.floor(b.got)} of ${b.need} brought)` : ''}.</p><div class="list">`;
      const crew = (b.builders || []).map((id) => st.byId.get(id)).filter((c) => c && !c.dead);
      for (const c of crew) h += `<div class="item click" data-act="citizen" data-id="${c.id}"><span>${esc(c.name)}</span><span class="muted">${esc(citizenStatus(st, c))}</span></div>`;
      if (!crew.length) h += `<div class="item"><span class="muted">Nobody is free to mend it. Whoever sits by the fire comes, or ${esc(st.founder)} when he has nothing else to do. Or tap one of your people, then this building.</span></div>`;
      return `${h}</div>`;
    }
    const can = canRepair(st, b);
    const cost = can.cost || repairCost(st, b);
    const by = g.repairBy ? st.byId.get(g.repairBy) : null;
    const who = by && !by.dead && by.special !== 'spouse' ? by : null;
    if (b.wrecked) h += '<p>The roof has fallen in and a wall is down. Nobody can sleep here until it is mended.</p>';
    h += `<p class="muted">Mending it takes ${costText(cost, st)}${b.wrecked ? ', the old roof timbers stacked on the storage floor' : ''}. ${who ? `${esc(who.name)} will do it.` : 'Whoever is free will do it.'}</p>`;
    h += `<div class="row"><button class="btn ${can.ok ? 'primary' : ''} big" data-act="repair" ${can.ok ? '' : `disabled title="${esc(can.reason)}"`}>🔨 Repair</button></div>`;
    if (!can.ok) h += `<p class="muted warn">${esc(can.reason)}</p>`;
    return h;
  }

  // A building going up: what stage it is at, who is building it, and what
  // the player can do if nobody is.
  siteHtml(b) {
    const st = this.st;
    const def = BUILDINGS[b.type];
    const stage = siteStage(b);
    const mat = b.mat === 'bricks' ? 'mud bricks' : b.mat === 'wood' || !b.mat ? 'planks' : b.mat;
    let h = `<h4>Being built · ${esc(stage.name)}</h4>`;
    if (b.got < b.need) h += `<div class="bar"><i style="width:${Math.round((b.got / b.need) * 100)}%;background:#b07a43"></i></div><p class="muted">${b.got} of ${b.need} ${mat} carried over from the stores.</p>`;
    else h += `<div class="bar"><i style="width:${Math.round(b.built * 100)}%;background:#f0b429"></i></div>`;
    const crew = (b.builders || []).map((id) => st.byId.get(id)).filter((c) => c && !c.dead);
    h += `<h4>Builders ${crew.length}/${buildCrew(def)}</h4><div class="list">`;
    for (const c of crew) h += `<div class="item click" data-act="citizen" data-id="${c.id}"><span>${esc(c.name)}</span><span class="muted">${esc(citizenStatus(st, c))}</span></div>`;
    if (!crew.length) {
      const free = freeBuilders(st).length;
      h += `<div class="item"><span class="muted">${free ? 'Someone from the fire is on the way.' : `Nobody is free to build. Whoever sits by the fire builds, and ${esc(st.founder)} when he has nothing else to do. Or tap one of your workers and then this building: they help, then go back to work.`}</span></div>`;
    }
    h += '</div>';
    return h;
  }

  upgradeHtml(b) {
    const st = this.st;
    const up = nextUpgrade(b);
    if (!up) return '';
    const can = canUpgrade(st, b.id);
    const effects = [];
    if (up.housing) effects.push(`homes for ${up.housing}`);
    if (up.storage) effects.push(`×${up.storage} storage`);
    if (up.yield) effects.push(`×${up.yield} harvest`);
    if (up.army) effects.push(`+${up.army} army size`);
    if (up.happiness) effects.push(`+${up.happiness} happiness`);
    if (up.price) effects.push('better market prices');
    return `<h4>Upgrade</h4><div class="item upgrade"><span><b>${esc(up.name)}</b>${up.yo ? ` <span class="muted">${esc(up.yo)}</span>` : ''}<br>
      <span class="muted">${esc(up.desc || '')}${effects.length ? ` (${effects.join(', ')})` : ''}</span><br>
      <span class="muted">${costText(up.cost, st)}${up.era > st.era ? ` · 🔒 ${esc(ERAS[up.era].name)} age` : ''}</span></span>
      <button class="btn ${can.ok ? 'primary' : ''}" data-act="upgrade" ${can.ok ? '' : `disabled title="${esc(can.reason || '')}"`}>Upgrade</button></div>`;
  }

  hireHtml() {
    const st = this.st;
    const m = money(st);
    let h = `<h4>Hire fighters (army ${armySize(st)}/${armyCap(st)})</h4><div class="list">`;
    for (const o of hireOptions(st)) {
      const u = UNITS[o.unit];
      const locked = o.era > st.era;
      const ok = !locked && st.res.cowries >= o.cost && armySize(st) < armyCap(st);
      h += `<div class="item"><span>${UNIT_ICON[o.unit] || '⚔️'} <b>${esc(o.name)}</b><br><span class="muted">${m.icon} ${o.cost} now, then ${m.icon} ${o.wage} a day · ${u.hp}♥ ${u.atk}⚔</span>${locked ? `<br><span class="muted">🔒 ${esc(ERAS[o.era].name)} age</span>` : ''}</span>
        <button class="btn ${ok ? 'primary' : ''}" data-act="hire" data-id="${o.id}" ${ok ? '' : 'disabled'}>Hire</button></div>`;
    }
    const wages = wagesDue(st);
    h += `</div><p class="muted">Hired fighters come at once, but want wages every morning${wages ? ` (now ${m.icon} ${wages} a day)` : ''}. Unpaid, they walk away. Build a Training Ground to train your own.</p>`;
    return h;
  }

  marketHtml() {
    const st = this.st;
    const m = money(st);
    let h = '<h4>Trade (lots of 10)</h4><div class="trade">';
    for (const r of TRADEABLE) {
      if (RESOURCES[r].imported && st.res[r] < 1) continue;
      if (r === 'weapons' && st.era < 2) continue;
      if ((r === 'iron' || r === 'palmoil' || r === 'cassava' || r === 'garri') && st.era < 1) continue;
      const left = marketDemand(st, r);
      const imp = RESOURCES[r].imported;
      h += `<span>${RESOURCES[r].icon}</span><span>${RESOURCES[r].name} <span class="muted">${fmt(st.res[r])}</span></span>
        <button class="btn" data-act="sell" data-r="${r}" title="Sell for ${priceOf(st, r, false)} each · buyers want ${left} more today" ${left ? '' : 'disabled'}>Sell +${priceOf(st, r, false) * Math.min(10, left || 10)}</button>
        ${imp ? '<span class="muted">ships only</span>' : `<button class="btn" data-act="buy" data-r="${r}" title="Buy for ${priceOf(st, r, true)} each">Buy −${priceOf(st, r, true) * 10}</button>`}`;
    }
    return `${h}</div><p class="muted">Local buyers only want so much each day. Prices in ${m.name.toLowerCase()}. For bigger sales, make trade agreements with other kingdoms or sell to merchant ships at a port.</p>`;
  }

  portHtml() {
    const st = this.st;
    const m = money(st);
    const ship = st.harbour.ship;
    if (!ship) {
      const status = st.harbour.sailing
        ? 'A merchant ship is on its way.'
        : Object.values(st.foreign).some((f) => f.trade && !f.hostile)
          ? `The next merchant ship is due around day ${Math.max(st.time.day, st.harbour.next || 0) + 1}.`
          : 'No foreign merchants trade with you yet. Make peace with a foreign power to open the sea trade.';
      return `<h4>⚓ Harbour</h4><img class="scene" src="${sceneArt('harbour')}" alt="" onerror="this.remove()" /><p class="muted">${status} Ships buy palm oil, garri and fish, and sell muskets, cloth, salt, horses, cannon and tools.</p>`;
    }
    const who = st.foreign[ship.power]?.name || ship.power;
    let h = `<h4>⛵ ${esc(who)} merchant ship · sails on day ${ship.until + 1}</h4><img class="scene" src="${sceneArt('harbour')}" alt="" onerror="this.remove()" /><p class="muted">They buy (lots of 10):</p><div class="trade">`;
    for (const [r, price] of Object.entries(ship.buys)) {
      h += `<span>${RESOURCES[r].icon}</span><span>${RESOURCES[r].name} <span class="muted">${fmt(st.res[r])}</span></span>
        <button class="btn" data-act="shipsell" data-r="${r}" ${st.res[r] >= 1 ? '' : 'disabled'}>Sell +${price * 10}</button><span class="muted">${m.icon} ${price} each</span>`;
    }
    h += '</div><p class="muted">They sell:</p><div class="list">';
    for (const [k, o] of Object.entries(ship.sells)) {
      const once = !!UPGRADE_ITEMS[k];
      const qty = once ? 1 : Math.min(o.stock, k === 'muskets' || k === 'horses' || k === 'cannon' ? 1 : 10);
      const ok = o.stock > 0 && st.res.cowries >= o.price * qty;
      h += `<div class="item"><span>${importIcon(k)} <b>${esc(importName(k))}</b> <span class="muted">${once ? '' : `${o.stock} left`}</span><br><span class="muted">${once ? esc(UPGRADE_ITEMS[k].desc) : `${m.icon} ${o.price} each`}</span></span>
        <button class="btn ${ok ? 'primary' : ''}" data-act="shipbuy" data-r="${k}" data-n="${qty}" ${ok ? '' : 'disabled'}>Buy${qty > 1 ? ` ${qty}` : ''} −${o.price * qty}</button></div>`;
    }
    return `${h}</div>`;
  }

  citizenHtml(c) {
    const st = this.st;
    const job = c.job ? st.byId.get(c.job) : null;
    const home = c.home ? st.byId.get(c.home) : null;
    let h = this.head(`${c.female ? '👩🏾' : '👨🏾'} ${esc(c.name)}`, `${esc(c.people)} · from ${esc(c.from)}`);
    if (c.special === 'founder') h += '<p>The founder of this settlement. He takes no job: he walks from workplace to workplace, and people working near him work faster. When nobody else is free, he builds.</p>';
    if (c.special === 'spouse') h += `<p>Wife of ${esc(st.founder)}, co-founder of ${esc(st.name)}.</p>`;
    h += `<div class="kv"><span>Doing</span><b>${esc(citizenStatus(st, c))}</b>
      <span>Works at</span><b>${job ? esc(BUILDINGS[job.type].name) : c.stranger ? '—' : 'No job yet'}</b>
      <span>Lives in</span><b>${home ? esc(BUILDINGS[home.type].name) : 'Homeless'}</b>
      ${c.carry ? `<span>Carrying</span><b>${RESOURCES[c.carry.r].icon} ${Math.round(c.carry.n)}</b>` : ''}</div>`;
    if (job) h += `<h4></h4><button class="btn" data-act="building" data-id="${job.id}">Go to workplace</button>`;
    const cutter = job && BUILDINGS[job.type].job?.source === 'tree';
    if (c.special === 'founder') h += '<p class="tip">👉 Tap a tree and he will fell it and carry the planks home. Tap a building site and he will help build it. Tap the ground to send him there.</p>';
    else if (cutter) h += '<p class="tip">👉 Tap a tree: it becomes his new place of work, and he fells the trees around it. Tap another workplace to move him there.</p>';
    else if (!c.special && !c.stranger) {
      h += '<p class="tip">👉 Tap a workplace on the map to send them to work there, or a building site to have them help build it.</p>';
      const open = st.buildings.filter((b) => b.owner === 'player' && !b.dead && b.built >= 1 && BUILDINGS[b.type].workers && b.id !== c.job && b.workers.length < BUILDINGS[b.type].workers);
      if (open.length) {
        h += '<h4>Places that need hands</h4><div class="list">';
        for (const b of open.slice(0, 6)) h += `<div class="item"><span>${ICONS[b.type] || ''} ${esc(levelName(b))} <span class="muted">${b.workers.length}/${BUILDINGS[b.type].workers}</span></span><button class="btn primary" data-act="sendto" data-b="${b.id}" data-c="${c.id}">Send</button></div>`;
        h += '</div>';
      }
    }
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
    const plural = (name, n) => (n > 1 ? (name.endsWith('man') ? `${name.slice(0, -3)}men` : `${name}s`) : name);
    let h = this.head(`🛡️ ${units.length} selected`, Object.entries(counts).map(([t, n]) => `${n} ${plural(UNITS[t].name.toLowerCase(), n)}`).join(', '));
    h += '<p class="muted wide-only">Tap the ground to march. Tap an enemy, a tent or a village to attack. Unexplored places with a ❓ hide rewards.</p><div class="list wide-only">';
    for (const u of units.slice(0, 12)) {
      h += `<div class="item"><span>${UNIT_ICON[u.type] || ''} ${esc(u.name || UNITS[u.type].name)}</span><span class="muted">${Math.ceil(u.hp)}/${u.maxHp} ♥</span></div>`;
    }
    const hold = units.every((u) => u.stance === 'hold');
    const engage = units.every((u) => u.stance !== 'hold');
    h += `</div><h4>When enemies come near</h4><div class="seg"><button class="btn ${hold ? 'on' : ''}" data-act="stance" data-v="hold">✋ Stand your ground</button><button class="btn ${engage ? 'on' : ''}" data-act="stance" data-v="engage">⚔️ Fight any close by</button></div>`;
    h += `<p class="muted wide-only">${hold ? 'They stay where you put them and fight only what comes within reach of their spears.' : engage ? 'They go for any enemy within a few steps, and set fire to enemy tents they pass.' : 'Some stand their ground, some fight any close by.'}</p>`;
    h += `<div class="row"><button class="btn" data-act="halt">⏹ Stop here</button><button class="btn" data-act="home">🏠 Return home</button><button class="btn" data-act="deselect">Deselect</button></div>`;
    h += this.rallyHtml();
    h += `<p class="muted wide-only">Army strength: ${armyPower(st)}. On a phone, press ⬚ Select at the top and drag a box round the soldiers you want.</p>`;
    h += '<p class="muted narrow-only">Tap the ground to march, or a bandit, tent or village to attack.</p>';
    return h;
  }

  // The army's gathering point: where new soldiers walk to, and where the
  // whole army can be called.
  rallyHtml(camp) {
    const st = this.st;
    let h = '<h4>🚩 Gathering point</h4>';
    h += `<p class="muted">${st.rally ? `New soldiers walk to the flag${camp ? '' : ', and you can call the army there'}.` : 'Choose a place on the map where your army gathers. New soldiers will walk there.'}</p>`;
    h += `<div class="row"><button class="btn" data-act="rally">🚩 ${st.rally ? 'Move the flag' : 'Set the gathering point'}</button>`;
    if (st.rally && !camp) h += '<button class="btn primary" data-act="gather">Go to the flag</button>';
    if (st.rally) h += `<button class="btn" data-act="goto" data-x="${st.rally.x}" data-y="${st.rally.y}">📍 Show</button><button class="btn" data-act="rallyclear" title="Take the flag down" aria-label="Take the flag down">✕</button>`;
    return `${h}</div>`;
  }

  factionHtml(f) {
    const st = this.st;
    if (!f) return '';
    const alive = garrisonAlive(st, f).length;
    let h = this.head(esc(f.name), `${stars(f.strength)} ${STRENGTH[f.strength]} · <span class="status ${f.status}">${f.status}</span>`);
    const face = leaderArt(f);
    if (f.leader || face) h += `<div class="leader">${face ? `<img src="${face}" alt="" />` : ''}<span class="muted">${f.leader ? `Ruled by <b>${esc(f.leader)}</b>` : esc(f.people)}</span></div>`;
    h += `<p>${esc(f.desc)}</p>`;
    h += this.factionBody(f, alive);
    return h;
  }

  factionBody(f, alive) {
    const st = this.st;
    const m = money(st);
    let h = `<div class="kv"><span>Relations</span><b class="${f.relation >= 0 ? 'pos' : 'neg'}">${Math.round(f.relation)}</b>
      <span>Their warriors</span><b>${alive}</b>
      <span>Their strength</span><b>${factionPower(st, f)}</b>
      <span>Your army</span><b>${armyPower(st)}</b>
      ${f.temperament !== 'bandit' ? `<span>Trade</span><b class="${canBarter(f) ? 'pos' : ''}">${f.status === 'conquered' ? 'Tribute' : canBarter(f) ? 'Open' : 'None'}</b>` : ''}</div>`;
    if (f.status === 'conquered') return `${h}<p class="muted">Conquered: their stores were yours to take, and they pay a little tribute every day. An agreement would have earned more over time.</p>`;
    if (f.host) {
      const left = st.units.filter((u) => u.owner === f.id && !u.dead).length;
      return `${h}<p>${f.beaten ? 'Broken: not one of them is left to fight.' : `${left} warriors of Benin. ${f.marching ? 'They are marching on you!' : 'They wait in their camp, and will march on you when they are ready.'} Defeat every one of them to break the host.`}</p>`;
    }
    if (f.temperament === 'bandit') return `${h}<p class="muted">There is no talking to them. Destroy their warriors and stand in their camp to take it.</p>`;
    const gift = giftCost(st, f);
    const hasMarket = hasBuilding(st, 'market');
    h += `<h4>Diplomacy</h4><div class="seg">
      <button class="btn" data-act="diplo" data-f="${f.id}" data-a="gift" ${st.res.cowries >= gift ? '' : 'disabled'}>🎁 Gift (${m.icon} ${gift})</button>
      ${!f.trade && f.status !== 'hostile' && f.status !== 'allied' ? `<button class="btn" data-act="diplo" data-f="${f.id}" data-a="trade" ${hasMarket ? '' : 'title="Build a Market first"'}>📜 Trade agreement</button>` : ''}
      ${f.status !== 'allied' && f.status !== 'hostile' && f.status !== 'vassal' ? `<button class="btn" data-act="diplo" data-f="${f.id}" data-a="ally">🤝 Propose alliance</button>` : ''}
      ${f.status === 'allied' ? `<button class="btn" data-act="diplo" data-f="${f.id}" data-a="help" ${f.helpReady > st.time.day ? `disabled title="Ready on day ${f.helpReady + 1}"` : ''}>🛡️ Ask for warriors</button>` : ''}
      ${f.status !== 'allied' && f.status !== 'vassal' ? `<button class="btn" data-act="diplo" data-f="${f.id}" data-a="demand">👑 Demand tribute</button>` : ''}
      ${f.status !== 'hostile' ? `<button class="btn danger" data-act="diplo" data-f="${f.id}" data-a="war">⚔️ Declare war</button>` : ''}
    </div>`;
    if (canBarter(f)) h += this.barterHtml(f);
    h += `<p class="muted">${
      f.status === 'hostile'
        ? 'At war. Send gifts to make peace, or defeat every warrior and stand in their village to conquer it.'
        : f.status === 'allied'
          ? 'Your allies. Their caravans bring money each day, and they will send warriors when you ask.'
          : f.status === 'vassal'
            ? 'They pay you tribute each day.'
            : `${f.trade ? 'Your trade route brings a little money each day. ' : `A trade agreement needs a Market and relations of 20. `}Alliance needs relations of ${f.temperament === 'friendly' ? 35 : 55}${f.temperament === 'warlike' ? ' and real strength' : ''}. Tribute needs an army about 1.4× stronger than theirs.`
    }</p>`;
    h += `<button class="btn" data-act="goto" data-x="${f.x}" data-y="${f.y}">📍 Show on map</button>`;
    return h;
  }

  barterHtml(f) {
    const st = this.st;
    const m = money(st);
    let h = '<h4>Barter (lots of 10)</h4><div class="trade">';
    for (const [r, price] of Object.entries(f.wants || {})) {
      const room = barterRoom(st, f, r);
      const n = Math.min(10, room, Math.floor(st.res[r]));
      h += `<span>${RESOURCES[r].icon}</span><span>They want ${RESOURCES[r].name.toLowerCase()} <span class="muted">· you have ${fmt(st.res[r])}</span></span>
        <button class="btn" data-act="barter" data-f="${f.id}" data-r="${r}" data-sell="1" ${n > 0 ? '' : `disabled title="${room ? 'You have none' : 'They have enough for now'}"`}>Sell +${price * Math.max(n, 1)}</button><span class="muted">${m.icon} ${price} each</span>`;
    }
    for (const [r, price] of Object.entries(f.offers || {})) {
      const ok = st.res.cowries >= price;
      h += `<span>${RESOURCES[r].icon}</span><span>They sell ${RESOURCES[r].name.toLowerCase()}</span>
        <button class="btn" data-act="barter" data-f="${f.id}" data-r="${r}" ${ok ? '' : 'disabled'}>Buy −${price * (r === 'horses' ? 1 : 10)}</button><span class="muted">${m.icon} ${price} each</span>`;
    }
    return `${h}</div>`;
  }

  peoplesHtml() {
    const st = this.st;
    const known = st.factions.filter((f) => f.discovered);
    let h = this.head('🤝 Peoples of the land', `${unified(st).length} of ${majors(st).length} major peoples united`);
    if (!known.length) h += '<p class="muted">You have met no one yet. Train a scout at your compound and explore.</p>';
    for (const f of known) {
      const alive = garrisonAlive(st, f).length;
      const face = leaderArt(f);
      h += `<div class="people-card" style="--c:${f.color}"><div class="panel-head">${face ? `<img class="face" src="${face}" alt="" />` : ''}<div class="grow"><b>${esc(f.name)}</b>${f.major ? '' : ' <span class="muted">(minor)</span>'}<div class="muted">${stars(f.strength)} ${STRENGTH[f.strength]} · <span class="status ${f.status}">${f.status}</span></div></div></div>${this.factionBody(f, alive)}</div>`;
    }
    const hidden = st.factions.filter((f) => !f.discovered && f.major).length;
    if (hidden) h += `<p class="muted">${hidden} more major ${hidden > 1 ? 'peoples are' : 'people is'} out there, still unknown.</p>`;
    return h;
  }

  eraHtml() {
    const st = this.st;
    const era = ERAS[st.era];
    let h = this.head(`🌅 ${era.name} era`, `${era.yo} · ${st.time.year}`);
    const now = ageArt(st.era);
    if (now) h += `<img class="scene" src="${now}" alt="" onerror="this.remove()" />`;
    h += `<p>${esc(era.blurb)}</p>`;
    const r = eraRequirements(st);
    if (r) {
      const next = ageArt(st.era + 1);
      h += `<h4>Next: ${esc(r.next.name)} (${esc(r.next.yo)})</h4>${next ? `<img class="scene small" src="${next}" alt="" onerror="this.remove()" />` : ''}<p class="muted">${esc(r.next.blurb)}</p>`;
      for (const q of r.reqs) h += `<div class="req ${q.met ? 'met' : ''}"><span>${q.met ? '✅' : '⬜'}</span><span>${esc(q.text)}${q.cost ? ` — ${costText(q.cost, st)}` : ''}${q.have !== undefined ? ` (now ${q.have})` : ''}</span></div>`;
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
    const m = money(st);
    h += `</div><p class="muted">${TAXES[st.tax].per} ${m.name.toLowerCase()} per resident per day.</p>`;
    const wages = wagesDue(st);
    const routes = st.factions.filter((f) => f.trade || f.status === 'allied').filter((f) => f.status !== 'hostile' && f.status !== 'conquered').length;
    h += `<h4>Treasury ${m.icon} ${fmt(st.res.cowries)}</h4><div class="kv">
      <span>Taxes (last day)</span><b class="pos">+${Math.round(st.stats.lastTax || 0)}</b>
      <span>Trade routes (${routes})</span><b class="pos">+${Math.round(st.stats.tradeIncome || 0)}</b>
      ${st.stats.lastInterest ? `<span>Bank interest</span><b class="pos">+${Math.round(st.stats.lastInterest)}</b>` : ''}
      <span>Wages for hired fighters</span><b class="${wages ? 'neg' : ''}">${wages ? `−${wages}` : '0'}</b>
      <span>Earned from sales so far</span><b>${fmt(st.stats.earned || 0)}</b></div>
      <p class="muted">Sell surplus at the market, to kingdoms you trade with, and to merchant ships at a port. Money pays for new buildings, upgrades, soldiers and hired fighters.</p>`;
    const lux = ['salt', 'cloth'].filter((k) => st.luxury[k]);
    if (st.era >= 1) h += `<p class="muted">Luxuries: ${lux.length ? lux.map((k) => `${RESOURCES[k].icon} ${RESOURCES[k].name.toLowerCase()}`).join(', ') : 'none'} — salt and cloth from the ships make people happier while they last.</p>`;
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

  mudHtml() {
    const st = this.st;
    const cost = mudUpgradeCost(st);
    const ok = st.res.bricks >= cost && !st.flags.mud;
    return `${this.head('🧱 Kingdom upgrade', 'Rebuild in mud · Ilé Amọ̀')}
      <p>Rebuild every house, shed, floor and the guard house in red mud bricks, all at once. Mud walls stand up far better to fire and to bandits, and every plank house becomes a mud house that sleeps four.</p>
      <div class="kv"><span>Bricks needed</span><b>🧱 ${cost}</b><span>Bricks you have</span><b>🧱 ${Math.floor(st.res.bricks)}</b></div>
      <h4></h4><button class="btn primary big" data-act="mud" ${ok ? '' : 'disabled'}>Rebuild in mud</button>
      <p class="muted">Fences stay wooden: rebuild them as mud walls later, section by section.</p>`;
  }

  menuHtml() {
    const g = this.game;
    return `${this.head('☰ Menu', `Map seed ${this.st.seed}`)}
      <div class="list">
        <button class="btn primary" data-act="saves" data-mode="save">💾 Save game</button>
        <button class="btn primary" data-act="saves" data-mode="load">📂 Load game</button>
        <button class="btn" data-act="territory">${g.view.showTerritory ? '🗺️ Hide' : '🗺️ Show'} building land</button>
      </div>
      <div class="list">
        <button class="btn" data-act="log">📜 Message history</button>
        <button class="btn" data-act="feedback">💬 Send feedback</button>
        <button class="btn" data-act="title">🏠 Title screen</button>
      </div>
      <p class="muted">The game also saves itself every minute. Keys: WASD/arrows scroll, +/− zoom, Space pause, 1–3 speed, G select army, Esc cancel, H go home. Tap one of your people, then a tree or a workplace, to give orders.</p>
      <p class="owner">Eko Rising is an original game by <a href="https://alternatefactstudios.com/">alternatefact Studios</a>. © 2026 alternatefact Studios. All rights reserved.</p>
      ${this.panel?.data === 'log' ? `<h4>History</h4><div class="list">${this.st.log.slice().reverse().map((m) => `<div class="item"><span>${esc(m.text)}</span><span class="muted">d${m.day + 1}</span></div>`).join('')}</div>` : ''}`;
  }

  // The saved games: the autosave and three slots, and files.
  savesHtml(inGame, mode = 'save') {
    const loading = mode === 'load';
    const ago = (t) => {
      if (!t) return '';
      const m = Math.round((Date.now() - t) / 60000);
      return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 60 * 24 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString();
    };
    let h = '<div class="list saves">';
    for (const { slot, save } of this.game.saves()) {
      const m = save?.meta;
      const what = m ? `${esc(m.town || '?')} · day ${(m.day || 0) + 1}${m.era ? ` · ${esc(m.era)}` : ''}${m.pop ? ` · ${m.pop} people` : ''}` : 'Empty';
      h += `<div class="item"><span><b>${slot === 'auto' ? 'Autosave' : `Slot ${slot}`}</b><br><span class="muted">${what}${m?.savedAt ? ` · ${ago(m.savedAt)}` : ''}</span></span><span class="row">`;
      if (inGame && !loading && slot !== 'auto') h += `<button class="btn primary" data-act="slotsave" data-slot="${slot}">Save here</button>`;
      if (save) h += `<button class="btn ${loading || !inGame ? 'primary' : ''}" data-act="slotload" data-slot="${slot}">Load</button>`;
      if (save && slot !== 'auto') h += `<button class="btn" data-act="slotdel" data-slot="${slot}" title="Delete this save" aria-label="Delete">✕</button>`;
      h += '</span></div>';
    }
    h += '</div><h4>Files</h4><div class="row">';
    if (inGame && !loading) h += '<button class="btn" data-act="savefile">⬇ Save to a file</button>';
    h += '<button class="btn" data-act="openfile">⬆ Open a save file</button></div>';
    if (loading) h += `<p class="muted">Loading a slot replaces the game you are playing; it is kept in the autosave first. To save instead, use 💾 at the top.</p>`;
    h += `<p class="muted">${inGame ? 'The game saves itself in the autosave every minute. Ctrl+S saves in slot 1. ' : ''}Saves stay in this browser: save to a file to keep a game safe, or to carry on on another device.</p>`;
    return h;
  }

  // The saved games from the title screen, before a game is running.
  showSaves() {
    if (this.st) {
      this.openPanel('saves');
      return;
    }
    const box = $('#title-saves');
    box.hidden = !box.hidden;
    box.innerHTML = this.savesHtml(false);
    if (!box.dataset.bound) {
      box.dataset.bound = '1';
      box.addEventListener('click', (e) => {
        const el = e.target.closest('[data-act]');
        if (el && !el.disabled) this.savesAction(el.dataset.act, el.dataset.slot);
      });
    }
  }

  savesAction(act, slot) {
    const g = this.game;
    switch (act) {
      case 'slotsave':
        g.save(slot);
        break;
      case 'slotload':
        // Whatever is being played now is kept in the autosave first.
        if (this.st && slot !== 'auto') g.save('auto');
        g.load(slot);
        return true;
      case 'slotdel':
        g.deleteSave(slot);
        break;
      case 'savefile':
        g.exportSave();
        break;
      case 'openfile':
        $('#save-file').click();
        break;
      default:
        return false;
    }
    const box = $('#title-saves');
    if (!this.st && box && !box.hidden) box.innerHTML = this.savesHtml(false);
    this.lastPanelHtml = '';
    return true;
  }

  onPanelClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const g = this.game;
    const st = this.st;
    const act = el.dataset.act;
    const sel = this.panel?.kind === 'building' ? this.panel.data : null;
    if (['slotsave', 'slotload', 'slotdel', 'savefile', 'openfile'].includes(act)) {
      this.savesAction(act, el.dataset.slot);
      if (act !== 'slotload') this.renderPanel();
      return;
    }
    switch (act) {
      case 'saves':
        this.openPanel('saves', el.dataset.mode || 'save');
        return;
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
      case 'repair': {
        const r = g.cmd('repair', sel, g.repairBy || null);
        if (r && !r.ok) this.toast(r.reason);
        else if (r?.ok) this.toast(r.by ? `🔨 ${r.by} goes to mend it.` : '🔨 Whoever is free will come and mend it.');
        g.repairBy = null;
        break;
      }
      case 'upgrade': {
        const r = g.cmd('upgradeBuilding', sel);
        if (r && !r.ok && r.reason) this.toast(r.reason);
        break;
      }
      case 'hire': {
        const r = g.cmd('hire', sel, el.dataset.id);
        if (r && !r.ok && r.reason) this.toast(r.reason);
        break;
      }
      case 'shipsell':
      case 'shipbuy': {
        const r = act === 'shipsell' ? g.cmd('shipSell', el.dataset.r, 10) : g.cmd('shipBuy', el.dataset.r, +el.dataset.n || 1);
        if (r && !r.ok && r.reason) this.toast(r.reason);
        break;
      }
      case 'barter': {
        const selling = el.dataset.sell === '1';
        const r = g.cmd('barter', el.dataset.f, el.dataset.r, el.dataset.r === 'horses' && !selling ? 1 : 10, selling);
        if (r && !r.ok && r.reason) this.toast(r.reason);
        break;
      }
      case 'assign': {
        const r = g.cmd('assignWorker', +el.dataset.c, sel);
        if (r && !r.ok) this.toast(r.reason);
        break;
      }
      case 'sendto': {
        const r = g.cmd('assignWorker', +el.dataset.c, +el.dataset.b);
        if (r && !r.ok) this.toast(r.reason);
        break;
      }
      case 'move':
        g.startMove(sel);
        return;
      case 'mud': {
        const r = g.cmd('mudUpgrade');
        if (r && !r.ok) this.toast(r.reason);
        else this.closePanel();
        return;
      }
      case 'goto':
        g.centerOn(+el.dataset.x, +el.dataset.y);
        return;
      case 'halt':
        g.haltSelected();
        break;
      case 'stance':
        g.setStance(el.dataset.v);
        break;
      case 'home':
        g.sendSelectedHome();
        break;
      case 'rally':
        g.startRally();
        return;
      case 'gather':
        g.gatherSelected();
        break;
      case 'rallyclear':
        g.cmd('setRally', null);
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
        g.save('1');
        break;
      case 'territory':
        g.view.showTerritory = !g.view.showTerritory;
        break;
      case 'log':
        this.panel.data = this.panel.data === 'log' ? null : 'log';
        break;
      case 'title':
        g.toTitle();
        return;
      case 'feedback':
        this.closePanel();
        g.feedback.open('menu');
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

  placeBar(show, msg, ok, okLabel = '✓ Place') {
    const bar = $('#placebar');
    bar.hidden = !show;
    if (!show) return;
    $('#place-msg').textContent = msg;
    $('#place-ok').hidden = !ok;
    $('#place-ok').textContent = okLabel;
  }
}

// --- Title screen map ---------------------------------------------------------------

export function renderNigeria(el, onPick, opened = new Set()) {
  const S = 46;
  const G = 4;
  let svg = `<svg viewBox="0 0 ${8 * (S + G)} ${7 * (S + G)}" role="img" aria-label="Map of Nigeria's states">`;
  for (const [name, col, row, id] of STATES) {
    const x = col * (S + G);
    const y = row * (S + G);
    // A state with a chapter is open, unless it has to be won first.
    const locked = !!id && !!LOCKED[id] && !opened.has(id);
    const open = !!id && !locked;
    const soon = NEXT_UP.includes(name) || locked;
    const fill = open ? '#f2b84b' : soon ? 'rgba(242,184,75,0.22)' : 'rgba(255,255,255,0.07)';
    svg += `<g class="st ${open ? 'open' : ''}" data-id="${id || ''}" data-name="${name}">
      <title>${name}${open ? ' — play now' : locked ? ` — ${LOCKED[id]}` : soon ? ' — coming next' : ' — coming in a future update'}</title>
      <rect x="${x}" y="${y}" width="${S}" height="${S}" rx="8" fill="${fill}" stroke="${open ? '#fff3c4' : 'rgba(255,255,255,0.15)'}" />
      <text x="${x + S / 2}" y="${y + S / 2 + 1}" text-anchor="middle" dominant-baseline="middle" font-size="${name.length > 8 ? 7.5 : 9}" font-weight="700" fill="${open ? '#2a1a05' : 'rgba(255,255,255,0.6)'}">${name}</text>
      ${open ? `<text x="${x + S / 2}" y="${y + S - 7}" text-anchor="middle" font-size="7" font-weight="800" fill="#2a1a05">PLAY</text>` : locked ? `<text x="${x + S / 2}" y="${y + S - 7}" text-anchor="middle" font-size="7" fill="rgba(255,236,190,0.85)">🔒</text>` : soon ? `<text x="${x + S / 2}" y="${y + S - 7}" text-anchor="middle" font-size="6.5" fill="rgba(255,236,190,0.8)">NEXT</text>` : ''}
    </g>`;
  }
  svg += '</svg>';
  el.innerHTML = svg;
  el.onclick = (e) => {
    const g = e.target.closest('.st');
    if (g && g.dataset.id) onPick(g.dataset.id);
  };
}

// Is this element on screen (not hidden, not collapsed away)?
function shown(el) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
}

