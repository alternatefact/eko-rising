// Boots the game: title screen, the frame loop, and the controller that
// connects input and interface to the simulation.

import * as sim from './sim/index.js';
import { BUILDINGS } from './data/buildings.js';
import { REGIONS } from './regions/index.js';
import { IsoRenderer } from './render/iso.js';
import { Minimap } from './render/minimap.js';
import { Hud, renderNigeria } from './ui/hud.js';
import { bindInput } from './ui/input.js';
import { Feedback, noteError } from './ui/feedback.js';

const MAX_STEPS = 12;

// Saved games live in the browser: an autosave, kept up to date every
// minute, and three slots the player saves into. A game can also be saved to
// a file and opened again from one, on this device or another.
const OLD_SAVE = 'eko-rising:save:v2';
export const SLOTS = ['auto', '1', '2', '3', 'lagos'];
const UNLOCKED = 'eko-rising:unlocked';

// States opened by winning another (kept across games).
export function unlocked() {
  try {
    return new Set(JSON.parse(storage.get(UNLOCKED) || '[]'));
  } catch (err) {
    return new Set();
  }
}

// What each land's founders learned there, carried to the next land they
// settle (sim.legacyOf): { lagos: {...} }. Kept across games, and only grows.
const LEGACY = 'eko-rising:legacy';

function legacyFor(from) {
  try {
    return JSON.parse(storage.get(LEGACY) || '{}')[from] || null;
  } catch (err) {
    return null;
  }
}

function recordLegacy(st) {
  let all = {};
  try {
    all = JSON.parse(storage.get(LEGACY) || '{}');
  } catch (err) {
    all = {};
  }
  all[st.regionId] = sim.mergeLegacy(all[st.regionId], sim.legacyOf(st));
  storage.set(LEGACY, JSON.stringify(all));
}

function unlock(id) {
  const s = unlocked();
  s.add(id);
  storage.set(UNLOCKED, JSON.stringify([...s]));
}
const slotKey = (slot) => `eko-rising:slot:${slot}`;

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  },
  set(key, v) {
    try {
      localStorage.setItem(key, v);
      return true;
    } catch (err) {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      // Nothing to do: storage is blocked.
    }
  },
};

function saveMeta(st) {
  return {
    town: st.name,
    founder: st.founder,
    day: st.time.day,
    year: st.time.year,
    era: sim.ERAS[st.era].name,
    pop: sim.population(st),
    savedAt: Date.now(),
  };
}

// What is in a slot: { meta, data } or null.
function readSlot(slot) {
  const raw = storage.get(slotKey(slot));
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }
  // Saves from before there were slots count as the autosave.
  if (slot === 'auto') {
    const old = storage.get(OLD_SAVE);
    if (old) {
      try {
        const d = JSON.parse(old);
        return { meta: { town: d.name, founder: d.founder, day: d.time?.day, year: d.time?.year, savedAt: 0 }, data: old };
      } catch (err) {
        return null;
      }
    }
  }
  return null;
}

class Game {
  constructor() {
    this.canvas = document.getElementById('world');
    this.renderer = null;
    this.minimap = new Minimap(document.getElementById('minimap'));
    this.hud = new Hud(this);
    this.feedback = new Feedback(this);
    this.view = { selected: new Set(), selectedFaction: null, ghost: null, box: null, order: null, showTerritory: false };
    this.mode = { build: null, line: false, wallStart: null, ghostAt: null };
    this.speed = 1;
    this.paused = false;
    this.st = null;
    this.acc = 0;
    this.last = performance.now();
    this.hudT = 0;
    this.saveT = 0;
    this.frame = 0;
    this.hoverAt = null;
  }

  // --- Life cycle -------------------------------------------------------------

  start(st) {
    this.st = st;
    this.renderer.attach(st);
    this.minimap.attach(st);
    this.renderer.resize();
    this.view.selected.clear();
    this.view.selectedFaction = null;
    this.cancelBuild();
    this.hud.shownMsgs = new Set(st.log.map((m) => m.id));
    this.hud.closePanel();
    this.hud.modalKey = null;
    // A loaded game opens on the village, not wherever the guide last looked.
    this.storyStep = sim.currentStep(st)?.id || null;
    const home = st.buildings.find((b) => b.type === 'palace' && !b.dead) || st.buildings.find((b) => b.type === 'compound');
    this.renderer.cam.zoom = window.innerWidth < 760 ? 1.05 : 1.45;
    this.renderer.centerOn(home ? home.x + home.w / 2 : st.start.x, home ? home.y + home.h / 2 + 1 : st.start.y);
    document.getElementById('title').hidden = true;
    this.paused = false;
    this.hud.update();
  }

  newGame(opts) {
    const o = { region: 'lagos', ...opts };
    if (!o.name) delete o.name;
    // A land settled from another starts with what was learned there.
    const from = REGIONS[o.region]?.inherits?.from;
    if (from && !o.legacy) o.legacy = legacyFor(from) || undefined;
    this.start(sim.newGame(o));
    this.save('auto');
  }

  // --- Saving ---------------------------------------------------------------------

  saves() {
    return SLOTS.map((slot) => ({ slot, save: readSlot(slot) }));
  }

  hasSave() {
    return this.saves().some((s) => s.save);
  }

  // The most recent save in any slot.
  latestSlot() {
    let best = null;
    for (const { slot, save } of this.saves()) if (save && (!best || (save.meta?.savedAt || 0) > (best.save.meta?.savedAt || 0))) best = { slot, save };
    return best?.slot || null;
  }

  // Save into a slot ('auto', '1', '2', '3'). Said out loud unless it is the
  // autosave.
  save(slot = 'auto') {
    if (!this.st) return false;
    // A land whose next land is open keeps a record of what it has learned.
    if (this.st.flags.ogunOpen) recordLegacy(this.st);
    const ok = storage.set(slotKey(slot), JSON.stringify({ meta: saveMeta(this.st), data: sim.serialize(this.st) }));
    if (slot !== 'auto') {
      this.hud.toast(ok ? `💾 Saved in ${slotName(slot)}: ${this.st.name}, day ${this.st.time.day + 1}.` : '💾 This browser will not let the game save here. Use “Save to a file” instead.');
      this.hud.lastPanelHtml = '';
    }
    return ok;
  }

  load(slot = this.latestSlot()) {
    const s = slot && readSlot(slot);
    if (!s) return;
    try {
      this.start(sim.deserialize(s.data));
      this.hud.toast(`📂 ${slotName(slot)} loaded: ${this.st.name}, day ${this.st.time.day + 1}.`);
    } catch (err) {
      this.hud.toast(`Could not load the save: ${err.message}`);
    }
  }

  deleteSave(slot) {
    storage.remove(slotKey(slot));
    if (slot === 'auto') storage.remove(OLD_SAVE);
    this.hud.lastPanelHtml = '';
  }

  // Save the game to a file the player keeps.
  async exportSave() {
    if (!this.st) return;
    const text = JSON.stringify({ game: 'eko-rising', meta: saveMeta(this.st), data: sim.serialize(this.st) });
    // Plain letters in the file name: Èkó becomes eko.
    const town = this.st.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const filename = `naija-rising-${town || 'town'}-day-${this.st.time.day + 1}.json`;
    // Inside claude.ai the page asks the viewer to accept the file.
    const downloads = window.claude?.use ? await window.claude.use('downloads').catch(() => null) : null;
    if (downloads) {
      try {
        await downloads.save({ filename, data: text });
        this.hud.toast('💾 Saved to a file.');
      } catch (err) {
        if (err?.code !== 'declined') this.hud.toast('This view cannot save files. Save in a slot instead.');
      }
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.hud.toast('💾 Saved to a file. Open it again from the Save menu, here or on another device.');
  }

  // Open a game saved to a file.
  async importSave(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const d = JSON.parse(text);
      const data = d.game === 'eko-rising' ? d.data : text;
      this.start(sim.deserialize(data));
      this.save('auto');
      this.hud.toast(`📂 Opened ${file.name}: ${this.st.name}, day ${this.st.time.day + 1}.`);
    } catch (err) {
      this.hud.toast(`That file is not a Naija Rising save${err?.message ? ` (${err.message})` : ''}.`);
    }
  }

  toTitle() {
    this.save('auto');
    this.st = null;
    this.hud.closePanel();
    document.getElementById('modal').hidden = true;
    showTitle(this);
  }

  // --- Loop -------------------------------------------------------------------------

  loop(now) {
    // The next frame is asked for first, so one bad frame can never stop the game.
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    try {
      this.frameStep(dt);
    } catch (err) {
      if (!this.frameError) console.error(err);
      if (this.frameError?.message !== err?.message) noteError(err);
      this.frameError = err;
      // Most likely the camera is somewhere it should not be: back home.
      if (!Number.isFinite(this.renderer.cam.x) || !Number.isFinite(this.renderer.cam.y) || !Number.isFinite(this.renderer.cam.zoom)) this.goHome();
    }
  }

  frameStep(dt) {
    if (this.st) {
      this.keys?.update(dt);
      if (!this.paused) {
        this.acc += dt * this.speed * sim.PACE;
        let steps = 0;
        while (this.acc >= sim.STEP && steps < MAX_STEPS) {
          sim.tick(this.st, sim.STEP);
          this.acc -= sim.STEP;
          steps++;
        }
        if (steps >= MAX_STEPS) this.acc = 0;
      }
      this.pruneSelection();
      this.updateGaps(dt);
      this.view.point = this.pointFrom(this.view.pointTarget);
      this.followStory();
      this.followEvent();
      this.checkChapter();
      this.hud.placeArrow();
      this.renderer.timeScale = this.paused || this.st.eventQueue.length ? 0 : this.speed * sim.PACE;
      this.renderer.draw(this.paused ? 1 : Math.min(1, this.acc / sim.STEP), this.view);
      if (this.frame++ % 6 === 0) this.minimap.draw(this.renderer);
      this.hudT += dt;
      if (this.hudT > 0.25) {
        this.hudT = 0;
        this.hud.update();
      }
      this.saveT += dt;
      if (this.saveT > 60) {
        this.saveT = 0;
        if (!this.st.gameOver) this.save('auto');
      }
    }
  }

  // When the story moves to a step that happens somewhere (strangers on the
  // path, wolves out of the bush), the camera goes to look.
  followStory() {
    const step = sim.currentStep(this.st);
    const id = step?.id || null;
    if (id === this.storyStep) return;
    this.storyStep = id;
    if (!step?.focus) return;
    let pt = null;
    try {
      pt = this.pointFrom(step.point?.(this.st));
    } catch (err) {
      pt = null;
    }
    if (pt) this.centerOn(pt.x, pt.y);
  }

  // A story event that happens somewhere (the host of Benin gathering, its
  // march): the camera goes to look before the words come up.
  followEvent() {
    const entry = this.st.eventQueue[0];
    if (!entry?.at || this.eventFocus === entry) return;
    this.eventFocus = entry;
    this.renderer.cam.zoom = Math.min(this.renderer.cam.zoom, window.innerWidth < 760 ? 0.8 : 0.95);
    this.centerOn(entry.at.x, entry.at.y);
    // The words come up at the bottom, so the sight sits in the upper part of the screen.
    const r = this.renderer;
    const below = r.screenToTile(r.w / 2, r.h / 2 + r.h * 0.17);
    this.centerOn(below.x, below.y);
  }

  // Beating the host of Benin opens Ogun State, and may take you there.
  checkChapter() {
    const st = this.st;
    if (st.flags.ogunOpen && !this.ogunNoted) {
      this.ogunNoted = true;
      unlock('ogun');
      recordLegacy(st);
      renderNigeria(document.getElementById('nigeria'), (id) => this.pickRegion(id), unlocked());
    }
    if (st.flags.goOgun) {
      st.flags.goOgun = false;
      // Lagos is kept in a save of its own.
      storage.set(slotKey('lagos'), JSON.stringify({ meta: saveMeta(st), data: sim.serialize(st) }));
      recordLegacy(st);
      this.newGame({ region: 'ogun', founder: st.founder, spouse: st.spouse, guide: false, legacy: legacyFor(st.regionId) });
      this.hud.toast('🌄 The road north to Ogun State. Your Lagos game is kept in Saved games.');
    }
  }

  // A state on the map of Nigeria was picked on the title screen.
  pickRegion(id) {
    if (id !== 'lagos' && !unlocked().has(id)) {
      this.hud.toast('🔒 Ogun State opens when you defeat the host of Benin in Lagos.');
      return;
    }
    const opts = readNewGameForm();
    this.newGame({ ...opts, region: id, ...(id !== 'lagos' ? { guide: false, name: undefined } : {}) });
  }

  // The guide's "show me": centre on what it is pointing at.
  showPoint() {
    if (this.view.point) this.centerOn(this.view.point.x, this.view.point.y);
    else this.hud.toast('Look at the building bar at the bottom: the card to use is lit up.');
  }

  // Where the guide's arrow goes this frame.
  pointFrom(pt) {
    if (!pt || !this.st) return null;
    if (pt.id) {
      const e = this.st.byId.get(pt.id);
      if (!e || e.dead || e.hidden) return null;
      if (e.kind === 'building') return { x: e.x + e.w / 2, y: e.y + e.h / 2, z: 1.5 };
      return { x: e.x, y: e.y, z: e.kind === 'animal' ? 0.8 : 1.25 };
    }
    // A card in the build bar or a button is not a place on the map.
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return null;
    return { x: pt.x, y: pt.y, z: pt.tree ? 1.7 : 0.5, ring: !pt.tree };
  }

  pruneSelection() {
    for (const id of this.view.selected) {
      const e = this.st.byId.get(id);
      if (!e || e.dead) this.view.selected.delete(id);
    }
  }

  // --- Commands ---------------------------------------------------------------------

  cmd(name, ...args) {
    const fn = sim[name];
    if (!fn) return null;
    const r = fn(this.st, ...args);
    this.hud.lastPanelHtml = '';
    return r;
  }

  choose(index) {
    sim.chooseEvent(this.st, index);
    this.hud.lastPanelHtml = '';
  }

  endAction(kind) {
    if (kind === 'continue') {
      this.st.gameOver = null;
      this.hud.modalKey = null;
      document.getElementById('modal').hidden = true;
    } else if (kind === 'load') {
      // The game is lost: nothing left to read in it, so no message covers the saves.
      this.st.gameOver = null;
      this.st.eventQueue.length = 0;
      this.hud.modalKey = null;
      document.getElementById('modal').hidden = true;
      this.paused = true;
      this.hud.openPanel('saves', 'load');
    } else if (kind === 'feedback') {
      this.feedback.open(this.st?.gameOver?.victory ? 'victory screen' : 'defeat screen');
    } else if (kind === 'restart' || kind === 'restart-free') {
      // Starting over after losing everything: with the guide, or without it.
      this.newGame({ region: this.st.regionId, founder: this.st.founder, spouse: this.st.spouse, name: this.st.region.defaultName, ...(kind === 'restart-free' ? { guide: false } : {}) });
    } else {
      this.toTitle();
    }
  }

  togglePause() {
    this.paused = !this.paused;
    this.hud.update();
  }

  setSpeed(n) {
    this.speed = n;
    this.paused = false;
    this.hud.update();
  }

  cycleSpeed() {
    if (this.paused) {
      this.paused = false;
      this.speed = 1;
    } else if (this.speed < 3) {
      this.speed++;
    } else {
      this.paused = true;
    }
    this.hud.update();
  }

  // --- Camera -----------------------------------------------------------------------

  // Turn the view a quarter turn, to see behind trees and buildings.
  turnView(dir) {
    if (!this.st) return;
    this.renderer.turn(dir);
    const names = ['from the south-east', 'from the south-west', 'from the north-west', 'from the north-east'];
    this.hud.toast(`🧭 Looking ${names[this.renderer.rot]}.`);
    this.hud.mapTools();
  }

  // Trees see-through, to check behind them.
  toggleTrees() {
    this.renderer.seeThrough = !this.renderer.seeThrough;
    this.hud.mapTools();
  }

  // Where the fence is still open: shown while building fences, when a
  // fence section is selected, and while the guide asks for a fence.
  updateGaps(dt) {
    const st = this.st;
    const type = this.mode.build;
    const sel = [...this.view.selected].map((id) => st.byId.get(id)).find((e) => e?.kind === 'building');
    const want = type === 'palisade' || type === 'gate' || type === 'stonewall' || (this.mode.demolish && this.mode.line) || sel?.wall || sel?.gate || sim.currentStep(st)?.id === 'fence';
    if (!want) {
      this.view.gaps = null;
      return;
    }
    this.gapsT = (this.gapsT || 0) - dt;
    if (this.view.gaps && this.gapsT > 0 && this.gapsFor === st.buildings.length) return;
    this.gapsT = 0.6;
    this.gapsFor = st.buildings.length;
    this.view.gaps = sim.fenceGaps(st).gaps;
  }

  pan(dx, dy) {
    if (this.renderer.panBy) {
      this.renderer.panBy(dx, dy);
      return;
    }
    const s = this.renderer.scale;
    this.renderer.cam.x -= dx / s;
    this.renderer.cam.y -= dy / s;
    this.renderer.clampCam();
  }

  zoom(f, sx, sy) {
    this.renderer.zoomAt(f, sx, sy);
  }

  centerOn(x, y) {
    this.renderer.centerOn(x, y);
  }

  goHome() {
    if (!this.st) return;
    const home = this.st.buildings.find((b) => b.type === 'palace' && !b.dead) || this.st.buildings.find((b) => b.type === 'compound' && !b.dead);
    if (home) this.centerOn(home.x + home.w / 2, home.y + home.h / 2);
    else this.centerOn(this.st.start.x, this.st.start.y);
    if (!Number.isFinite(this.renderer.cam.zoom)) this.renderer.cam.zoom = 1.2;
  }

  // --- Building -----------------------------------------------------------------------

  startBuild(type) {
    this.clearSelection();
    this.hud.closePanel();
    this.mode = { build: type, line: !!BUILDINGS[type].line, wallStart: null, ghostAt: null };
    this.view.showTerritory = true;
    this.canvas.classList.add('building');
    const def = BUILDINGS[type];
    this.hud.placeBar(true, def.line ? `${def.name}: tap where the wall starts, then where it ends.` : `${def.name}: tap the map to place it.`, false);
    if (this.hoverAt) this.hover(this.hoverAt.x, this.hoverAt.y);
  }

  // Pull-down mode: tap a building or fence section to remove it, or drag
  // along a fence to pull down a whole stretch, then build anew in its place.
  startDemolish() {
    this.clearSelection();
    this.hud.closePanel();
    this.mode = { build: null, demolish: true, line: true, wallStart: null, ghostAt: null };
    this.view.showTerritory = false;
    this.canvas.classList.add('building');
    this.hud.placeBar(true, 'Pull down: tap a building or a fence section, or drag along a fence. You get back part of what it cost.', false, '✓ Pull down');
    if (this.hoverAt) this.hover(this.hoverAt.x, this.hoverAt.y);
  }

  demolishTargets(at, end) {
    const st = this.st;
    const out = [];
    const add = (x, y, wallsOnly) => {
      if (x < 0 || y < 0 || x >= st.W || y >= st.H) return;
      const b = st.byId.get(st.occ[y * st.W + x]);
      if (!b || b.dead || b.owner !== 'player' || b.type === 'compound' || b.type === 'campfire') return;
      if (wallsOnly && !(b.wall || b.gate)) return;
      if (!out.includes(b)) out.push(b);
    };
    if (end) for (const [x, y] of sim.lineTiles(at.x, at.y, end.x, end.y)) add(x, y, true);
    else add(at.x, at.y, false);
    return out;
  }

  demolishGhost(targets) {
    this.view.ghost = targets.length
      ? { demolish: true, ids: targets.map((b) => b.id), type: null, w: 1, h: 1, tiles: targets.flatMap((b) => Array.from({ length: b.w * b.h }, (_, k) => ({ x: b.x + (k % b.w), y: b.y + Math.floor(k / b.w), ok: false }))) }
      : null;
  }

  demolishTap(at, info) {
    const [b] = this.demolishTargets(at);
    if (!b) {
      this.hud.toast('Nothing of yours to pull down there.');
      return;
    }
    const pull = () => {
      const r = sim.demolish(this.st, b.id);
      if (!r.ok) this.hud.toast(r.reason || 'That cannot be pulled down.');
      this.mode.ghostAt = null;
      this.view.ghost = null;
      this.hud.placeBar(true, 'Pulled down. Tap or drag for more, or ✕ when you are done.', false);
    };
    if (info?.mouse) {
      pull();
      return;
    }
    // On touch, the first tap marks it and the button (or a second tap) confirms.
    const g = this.mode.ghostAt;
    if (g && g.x === at.x && g.y === at.y) {
      pull();
      return;
    }
    this.mode.ghostAt = at;
    this.mode.pending = pull;
    this.demolishGhost([b]);
    this.hud.placeBar(true, `Pull down the ${BUILDINGS[b.type].name.toLowerCase()}?`, true, '✓ Pull down');
  }

  // Move a shed or farm: its outline follows the pointer until tapped down.
  startMove(id) {
    const b = this.st.byId.get(id);
    if (!b || !BUILDINGS[b.type].movable) return;
    this.clearSelection();
    this.hud.closePanel();
    this.mode = { build: null, move: id, line: false, wallStart: null, ghostAt: null };
    this.view.showTerritory = true;
    this.canvas.classList.add('building');
    this.hud.placeBar(true, `Move the ${BUILDINGS[b.type].name.toLowerCase()}: tap where it should go.`, false, '✓ Move here');
    if (this.hoverAt) this.hover(this.hoverAt.x, this.hoverAt.y);
  }

  moveGhost(at) {
    const b = this.st.byId.get(this.mode.move);
    if (!b) return;
    this.view.ghost = { type: b.type, w: b.w, h: b.h, tiles: [{ x: at.x, y: at.y, ok: sim.canMove(this.st, b.id, at.x, at.y).ok }] };
  }

  moveTap(at, info) {
    const b = this.st.byId.get(this.mode.move);
    if (!b) {
      this.cancelBuild();
      return;
    }
    const doMove = () => {
      const r = sim.moveBuilding(this.st, b.id, at.x, at.y);
      if (!r.ok) {
        this.hud.toast(r.reason);
        return;
      }
      this.cancelBuild();
      this.selectEntity(b.id);
    };
    const g = this.mode.ghostAt;
    if (info?.mouse || (g && g.x === at.x && g.y === at.y)) {
      doMove();
      return;
    }
    this.mode.ghostAt = at;
    this.mode.pending = doMove;
    this.moveGhost(at);
    const can = sim.canMove(this.st, b.id, at.x, at.y);
    this.hud.placeBar(true, can.ok ? 'Move it here?' : can.reason, can.ok, '✓ Move here');
  }

  cancelBuild() {
    this.mode = { build: null, demolish: false, line: false, wallStart: null, ghostAt: null };
    this.view.ghost = null;
    this.view.showTerritory = false;
    this.canvas.classList.remove('building');
    this.hud.placeBar(false);
    this.hud.lastBuild = null;
  }

  footprintAt(sx, sy) {
    if (this.mode.move) {
      const b = this.st.byId.get(this.mode.move);
      const p = this.renderer.screenToTile(sx, sy);
      return { x: Math.floor(p.x - (b?.w || 1) / 2 + 0.5), y: Math.floor(p.y - (b?.h || 1) / 2 + 0.5) };
    }
    if (this.mode.demolish) {
      const p = this.renderer.screenToTile(sx, sy);
      return { x: Math.floor(p.x), y: Math.floor(p.y) };
    }
    const def = BUILDINGS[this.mode.build];
    const p = this.renderer.screenToTile(sx, sy);
    return { x: Math.floor(p.x - def.w / 2 + 0.5), y: Math.floor(p.y - def.h / 2 + 0.5) };
  }

  setGhost(tiles) {
    const type = this.mode.build;
    const def = BUILDINGS[type];
    this.view.ghost = {
      type,
      w: def.w,
      h: def.h,
      tiles: tiles.map(([x, y]) => ({ x, y, ok: sim.canPlace(this.st, type, x, y).ok })),
    };
  }

  hover(sx, sy) {
    this.hoverAt = { x: sx, y: sy };
    if (this.mode.move && this.st) {
      if (!this.mode.ghostAt) this.moveGhost(this.footprintAt(sx, sy));
      return;
    }
    if (this.mode.demolish && this.st) {
      const at = this.footprintAt(sx, sy);
      if (!this.mode.ghostAt) this.demolishGhost(this.demolishTargets(this.mode.wallStart || at, this.mode.wallStart ? at : null));
      return;
    }
    if (!this.mode.build || !this.st) return;
    const at = this.footprintAt(sx, sy);
    if (this.mode.line && this.mode.wallStart) {
      this.setGhost(sim.lineTiles(this.mode.wallStart.x, this.mode.wallStart.y, at.x, at.y));
    } else if (!this.mode.ghostAt) {
      this.setGhost([[at.x, at.y]]);
    }
  }

  placeAt(x, y) {
    const type = this.mode.build;
    const r = sim.placeBuilding(this.st, type, x, y);
    if (!r.ok) {
      this.hud.toast(r.reason);
      return false;
    }
    // In the guided opening each pick from the build bar places one, so a
    // new player does not dot the clearing with copies by clicking on.
    const guided = sim.storyRunning(this.st);
    if (BUILDINGS[type].unique || guided) this.cancelBuild();
    if (guided) this.hud.toast(`🔨 ${BUILDINGS[type].name} marked out. Your people will carry the materials over and build it.`);
    this.hud.lastBuild = null;
    return true;
  }

  confirmPlace() {
    if (this.mode.demolish || this.mode.move) {
      this.mode.pending?.();
      this.mode.pending = null;
      return;
    }
    if (!this.mode.ghostAt) return;
    const { x, y } = this.mode.ghostAt;
    if (this.placeAt(x, y) && this.mode.build) {
      this.mode.ghostAt = null;
      this.view.ghost = null;
      this.hud.placeBar(true, 'Placed! Tap to place another, or ✕ when you are done.', false);
    }
  }

  buildTap(sx, sy, info) {
    const at = this.footprintAt(sx, sy);
    if (this.mode.move) {
      this.moveTap(at, info);
      return;
    }
    if (this.mode.demolish) {
      this.demolishTap(at, info);
      return;
    }
    if (this.mode.line) {
      this.wallTap(at);
      return;
    }
    if (info.mouse) {
      this.placeAt(at.x, at.y);
      this.hover(sx, sy);
      return;
    }
    // On touch, the first tap previews and the button (or a second tap on
    // the same spot) confirms.
    const g = this.mode.ghostAt;
    if (g && g.x === at.x && g.y === at.y) {
      this.confirmPlace();
      return;
    }
    this.mode.ghostAt = at;
    this.setGhost([[at.x, at.y]]);
    const can = sim.canPlace(this.st, this.mode.build, at.x, at.y);
    this.hud.placeBar(true, can.ok ? `Place the ${BUILDINGS[this.mode.build].name.toLowerCase()} here?` : can.reason, can.ok);
  }

  wallTap(at) {
    if (this.mode.demolish) {
      const s = this.mode.wallStart || at;
      const n = sim.demolishLine(this.st, s.x, s.y, at.x, at.y);
      this.mode.wallStart = null;
      this.view.ghost = null;
      this.hud.toast(n ? `Pulled down ${n} section${n > 1 ? 's' : ''}.` : 'No fence there to pull down.');
      return;
    }
    if (!this.mode.wallStart) {
      this.mode.wallStart = at;
      this.setGhost([[at.x, at.y]]);
      this.hud.placeBar(true, 'Now tap where the wall ends.', false);
      return;
    }
    const s = this.mode.wallStart;
    const r = sim.placeLine(this.st, this.mode.build, s.x, s.y, at.x, at.y);
    if (!r.ok && r.reason) this.hud.toast(r.reason);
    else if (r.reason) this.hud.toast(`Built ${r.placed}. ${r.reason}`);
    this.mode.wallStart = null;
    this.view.ghost = null;
    this.hud.placeBar(true, 'Tap where the next wall starts, or ✕ when you are done.', false);
  }

  wallPress(sx, sy) {
    if (!this.mode.wallStart) {
      this.mode.wallStart = this.footprintAt(sx, sy);
      this.mode.pressed = true;
    }
  }

  wallRelease(sx, sy, moved) {
    if (this.mode.demolish && !moved) {
      this.mode.wallStart = null;
      this.mode.pressed = false;
      this.demolishTap(this.footprintAt(sx, sy), { mouse: true });
      return;
    }
    if (moved && this.mode.wallStart) {
      this.wallTap(this.footprintAt(sx, sy));
    } else if (this.mode.pressed) {
      this.mode.pressed = false;
      this.hud.placeBar(true, 'Now click where the wall ends (or drag).', false);
    } else {
      this.wallTap(this.footprintAt(sx, sy));
    }
    this.mode.pressed = false;
  }

  demolishSelected() {
    for (const id of this.view.selected) {
      const e = this.st.byId.get(id);
      if (e?.kind === 'building') {
        sim.demolish(this.st, id);
        this.clearSelection();
        this.hud.closePanel();
        return;
      }
    }
  }

  escape() {
    if (this.mode.build || this.mode.demolish || this.mode.move || this.mode.rally) this.cancelBuild();
    else if (this.view.selected.size || this.hud.panel) {
      this.clearSelection();
      this.hud.closePanel();
    }
  }

  // --- Selection and orders -------------------------------------------------------------

  pick(tx, ty) {
    const st = this.st;
    const seen = (x, y) => st.visible[Math.floor(y) * st.W + Math.floor(x)];
    let best = null;
    let bestD = 0.75;
    for (const u of st.units) {
      if (u.dead || (u.owner !== 'player' && !seen(u.x, u.y))) continue;
      const d = Math.hypot(u.x + u.ox - tx, u.y + u.oy - 0.25 - ty);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    if (best) return best;
    bestD = 0.55;
    for (const c of st.citizens) {
      if (c.dead || !seen(c.x, c.y)) continue;
      const d = Math.hypot(c.x + c.ox - tx, c.y + c.oy - 0.3 - ty);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) return best;
    const ix = Math.floor(tx);
    const iy = Math.floor(ty);
    if (ix >= 0 && iy >= 0 && ix < st.W && iy < st.H) {
      const b = st.byId.get(st.occ[iy * st.W + ix]);
      if (b && !b.dead) return b;
      if (!st.explored[iy * st.W + ix]) return null;
    }
    for (const f of st.factions) {
      if (st.explored[f.y * st.W + f.x] && Math.hypot(f.x + 0.5 - tx, f.y + 0.5 - ty) < 3.6) return { kind: 'faction', f };
    }
    for (const p of st.pois) {
      if (p.found && !p.claimed && Math.hypot(p.x + 0.5 - tx, p.y + 0.5 - ty) < 1.2) return { kind: 'poi', p };
    }
    return null;
  }

  enemyBuildingNear(x, y, r) {
    const st = this.st;
    let best = null;
    let bestD = r;
    for (const b of st.buildings) {
      if (b.dead || b.owner === 'player' || !st.explored[Math.floor(b.y) * st.W + Math.floor(b.x)]) continue;
      const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
      const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  selectedCitizen() {
    if (this.view.selected.size !== 1) return null;
    const e = this.st.byId.get([...this.view.selected][0]);
    return e && !e.dead && e.kind === 'citizen' ? e : null;
  }

  myUnits() {
    return [...this.view.selected].map((id) => this.st.byId.get(id)).filter((u) => u && !u.dead && u.kind === 'unit' && u.owner === 'player');
  }

  tap(sx, sy, info) {
    if (!this.st || this.st.eventQueue.length) return;
    if (this.mode.rally) {
      if (info.button === 2) this.cancelBuild();
      else this.rallyTap(sx, sy);
      return;
    }
    if (this.mode.build || this.mode.demolish || this.mode.move) {
      if (info.button === 2) this.cancelBuild();
      else this.buildTap(sx, sy, info);
      return;
    }
    const p = this.renderer.screenToTile(sx, sy);
    let hit = this.renderer.pickScreen?.(sx, sy) || this.pick(p.x, p.y);
    const army = this.myUnits();
    // With soldiers selected, trees are just ground to march to, and a tap
    // near an enemy tent (even one behind the trees) is an order to burn it.
    if (army.length && (!hit || hit.kind === 'tree' || hit.kind === 'faction')) {
      const tent = this.enemyBuildingNear(p.x, p.y, 1.3);
      if (tent) hit = tent;
      else if (hit?.kind === 'tree') hit = null;
    }

    // Orders for one of your people: a tree to fell, a workplace, a place to go.
    const who = this.selectedCitizen();
    if (who) {
      if (hit?.kind === 'tree') {
        const r = sim.orderTree(this.st, who.id, hit.i);
        if (r.ok) {
          this.view.order = { x: hit.x, y: hit.y, at: performance.now() };
          this.hud.toast(`🪓 ${who.name} is going to fell that tree.`);
        } else this.hud.toast(r.reason);
        return;
      }
      // A damaged building: it opens, with them ready to mend it.
      const def = hit?.kind === 'building' ? BUILDINGS[hit.type] : null;
      if (def && hit.owner === 'player' && hit.built >= 1 && !hit.repairing && (hit.wrecked || hit.hp < hit.maxHp) && !def.invulnerable && who.special !== 'spouse') {
        this.repairBy = who.id;
        this.view.selected.clear();
        this.view.selected.add(hit.id);
        this.view.selectedFaction = null;
        this.hud.openPanel('building', hit.id);
        sim.signal(this.st, 'pickrepair', hit.id);
        return;
      }
      if (hit?.kind === 'building' && hit.owner === 'player' && (hit.built < 1 || hit.repairing) && who.special !== 'spouse') {
        const r = sim.assignBuilder(this.st, who.id, hit.id);
        if (r.ok) {
          this.view.order = { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2, at: performance.now() };
          if (!r.same) this.hud.toast(`🔨 ${who.name} is going to ${hit.repairing ? 'help mend' : 'help build'} the ${def.name.toLowerCase()}.`);
        } else this.hud.toast(r.reason);
        return;
      }
      if (hit?.kind === 'building' && !who.special && hit.owner === 'player' && BUILDINGS[hit.type].workers && hit.id !== who.job) {
        const r = sim.assignWorker(this.st, who.id, hit.id);
        if (r.ok) this.view.order = { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2, at: performance.now() };
        else this.hud.toast(r.reason);
        return;
      }
      if (who.special === 'founder' && (!hit || hit.kind === 'faction' || hit.kind === 'poi' || info.button === 2)) {
        const r = sim.orderWalk(this.st, who.id, p.x, p.y);
        if (r.ok) this.view.order = { x: p.x, y: p.y, at: performance.now() };
        else this.hud.toast(r.reason);
        return;
      }
    }
    if (hit?.kind === 'tree' && info.button !== 2) {
      const t = sim.treeInfo(this.st, hit.i);
      if (t) this.hud.toast(`🌳 ${t.kind}: ${t.felled ? `felled, ${t.planks} planks left to cut` : `${t.full} planks`}. Tap ${this.st.founder} or a woodcutter first, then the tree, to have it felled.`);
      this.view.selected.clear();
      this.hud.closePanel();
      return;
    }

    if (hit?.kind === 'unit' && hit.owner === 'player' && info.button !== 2) {
      // In select mode (or with shift) a tap adds a soldier, or takes them out.
      const adding = info.shift || this.selecting;
      if (!adding) this.view.selected.clear();
      if (adding && this.view.selected.has(hit.id)) this.view.selected.delete(hit.id);
      else this.view.selected.add(hit.id);
      this.view.selectedFaction = null;
      if (this.myUnits().length) this.hud.openPanel('units');
      else this.hud.closePanel();
      return;
    }
    const enemyBuilding = hit?.kind === 'building' && hit.owner !== 'player';
    if (army.length && (enemyBuilding || !(hit?.kind === 'building' && info.button !== 2)) && !(hit?.kind === 'citizen' && info.button !== 2)) {
      this.command(army, hit, p);
      return;
    }
    if (info.button === 2) return;
    this.view.selected.clear();
    this.view.selectedFaction = null;
    if (!hit) {
      this.hud.closePanel();
      return;
    }
    if (hit.kind === 'unit') {
      this.view.selected.add(hit.id);
      this.hud.openPanel('units');
    } else if (hit.kind === 'citizen') {
      this.view.selected.add(hit.id);
      sim.signal(this.st, 'select', hit.id);
      this.hud.openPanel('citizen', hit.id);
    } else if (hit.kind === 'building') {
      this.repairBy = null;
      this.view.selected.add(hit.id);
      this.hud.openPanel('building', hit.id);
    } else if (hit.kind === 'faction') {
      this.view.selectedFaction = hit.f.id;
      this.hud.openPanel('faction', hit.f.id);
    } else if (hit.kind === 'poi') {
      this.hud.toast(`❓ ${hit.p.name} — send a scout or soldier here to find out more.`);
    }
  }

  command(army, hit, p) {
    const ids = army.map((u) => u.id);
    if ((hit?.kind === 'unit' || hit?.kind === 'building') && hit.owner !== 'player') {
      const r = sim.orderAttack(this.st, ids, hit.id);
      if (!r.ok && r.reason) this.hud.toast(r.reason);
      else this.view.order = { x: hit.kind === 'building' ? hit.x + hit.w / 2 : hit.x, y: hit.kind === 'building' ? hit.y + hit.h / 2 : hit.y, at: performance.now(), attack: true };
      return;
    }
    let tx = p.x;
    let ty = p.y;
    if (hit?.kind === 'faction') {
      const f = hit.f;
      tx = f.x + 0.5;
      ty = f.y + 0.5;
      if (f.status === 'neutral') this.hud.toast(`Your soldiers march to the ${f.name}. They will not fight unless you declare war (tap the village).`);
      if (f.status === 'allied' || f.status === 'vassal') this.hud.toast(`Visiting your friends, the ${f.name}.`);
    } else if (hit?.kind === 'poi') {
      tx = hit.p.x + 0.5;
      ty = hit.p.y + 0.5;
    }
    sim.orderMove(this.st, ids, tx, ty, true);
    this.view.order = { x: tx, y: ty, at: performance.now(), attack: hit?.kind === 'faction' && hit.f.status === 'hostile' };
  }

  // Select mode, for phones: drag a box round your soldiers instead of
  // moving the map; taps add soldiers or take them out.
  toggleSelecting(on = !this.selecting) {
    this.selecting = on;
    document.getElementById('select-btn')?.classList.toggle('on', on);
    this.canvas.classList.toggle('selecting', on);
    if (on) this.hud.toast('⬚ Drag a box round your soldiers. Tap a soldier to add or remove them. Press ⬚ again to move the map.');
  }

  boxSelect(x0, y0, x1, y1, add) {
    // Test each soldier where it is drawn on screen, so this works however the view is turned.
    const [l, r] = [Math.min(x0, x1), Math.max(x0, x1)];
    const [t, b] = [Math.min(y0, y1), Math.max(y0, y1)];
    if (!add) this.view.selected.clear();
    for (const u of this.st.units) {
      if (u.dead || u.owner !== 'player') continue;
      const s = this.renderer.tileToScreen(u.x, u.y, this.renderer.standAt ? this.renderer.standAt(u.x, u.y) + 0.4 : 0);
      if (s.x >= l && s.x <= r && s.y >= t && s.y <= b) this.view.selected.add(u.id);
    }
    if (this.myUnits().length) {
      this.hud.openPanel('units');
      // One box and done: the next tap gives the order.
      if (this.selecting) this.toggleSelecting(false);
    } else if (this.selecting) this.hud.toast('No soldiers of yours in that box.');
  }

  setStance(stance) {
    const ids = this.myUnits().map((u) => u.id);
    const n = sim.setStance(this.st, ids, stance);
    if (n) this.hud.toast(stance === 'hold' ? `✋ ${n > 1 ? 'They' : 'He'} will stand ${n > 1 ? 'their' : 'his'} ground and fight only what comes within reach.` : `⚔️ ${n > 1 ? 'They' : 'He'} will go for any enemy, tent or hut that comes near.`);
  }

  selectArmy() {
    if (!this.st) return;
    this.cancelBuild();
    this.view.selected.clear();
    this.view.selectedFaction = null;
    const army = this.st.units.filter((u) => u.owner === 'player' && !u.dead);
    if (!army.length) {
      this.hud.toast('You have no soldiers yet. Train a scout at your compound, or build a War Camp.');
      return;
    }
    for (const u of army) this.view.selected.add(u.id);
    this.hud.openPanel('units');
  }

  selectEntity(id) {
    const e = this.st.byId.get(id);
    if (!e) return;
    this.view.selected.clear();
    this.view.selected.add(id);
    if (e.kind === 'citizen') sim.signal(this.st, 'select', id);
    this.centerOn(e.kind === 'building' ? e.x + e.w / 2 : e.x, e.kind === 'building' ? e.y + e.h / 2 : e.y);
    this.hud.openPanel(e.kind === 'building' ? 'building' : e.kind === 'citizen' ? 'citizen' : 'units', id);
  }

  clearSelection() {
    this.view.selected.clear();
    this.view.selectedFaction = null;
  }

  haltSelected() {
    for (const u of this.myUnits()) {
      u.order = { t: 'guard', x: u.x, y: u.y };
      u.path = null;
    }
  }

  // Pick the place where the army gathers.
  startRally() {
    if (!this.st) return;
    this.cancelBuild();
    this.mode = { build: null, rally: true, line: false, wallStart: null, ghostAt: null };
    this.canvas.classList.add('building');
    if (window.innerWidth < 760) this.hud.closePanel();
    this.hud.placeBar(true, '🚩 Tap the place where your army should gather.', false);
  }

  rallyTap(sx, sy) {
    const p = this.renderer.screenToTile(sx, sy);
    const r = sim.setRally(this.st, p.x, p.y);
    if (!r.ok) {
      this.hud.toast(r.reason);
      return;
    }
    this.cancelBuild();
    this.view.order = { x: this.st.rally.x, y: this.st.rally.y, at: performance.now() };
    this.hud.toast('🚩 Gathering point set. New soldiers walk here from the training ground. Press 🚩 Gather in the army panel to call everyone.');
    if (this.myUnits().length) this.hud.openPanel('units');
    this.hud.lastPanelHtml = '';
  }

  // Send the selected soldiers (or, with none selected, the whole army) to the gathering point.
  gatherSelected() {
    const ids = this.myUnits().map((u) => u.id);
    const r = sim.gatherArmy(this.st, ids.length ? ids : null);
    if (!r.ok) {
      this.hud.toast(r.reason);
      return;
    }
    this.view.order = { x: this.st.rally.x, y: this.st.rally.y, at: performance.now() };
    this.hud.toast(`🚩 ${r.n > 1 ? `${r.n} soldiers are` : 'One soldier is'} marching to the gathering point.`);
  }

  sendSelectedHome() {
    const home = this.st.buildings.find((b) => b.type === 'palace' && !b.dead) || this.st.buildings.find((b) => b.type === 'compound' && !b.dead);
    if (!home) return;
    sim.orderMove(this.st, this.myUnits().map((u) => u.id), home.x + home.w / 2, home.y + home.h + 1.5, false);
  }
}

// --- Title screen ---------------------------------------------------------------------

export function slotName(slot) {
  return slot === 'auto' ? 'the autosave' : slot === 'lagos' ? 'your Lagos game' : `slot ${slot}`;
}

function showTitle(game) {
  const title = document.getElementById('title');
  title.hidden = false;
  const latest = game.latestSlot();
  const btn = document.getElementById('ng-continue');
  btn.hidden = !latest;
  const meta = latest && game.saves().find((s) => s.slot === latest)?.save?.meta;
  btn.textContent = meta?.town ? `Continue: ${meta.town}, day ${(meta.day || 0) + 1}` : 'Continue';
  document.getElementById('title-saves').hidden = true;
}

function readNewGameForm() {
  const val = (id) => document.getElementById(id).value.trim();
  const seedRaw = val('ng-seed');
  const seed = seedRaw ? Math.abs(parseInt(seedRaw.replace(/\D/g, ''), 10) || hashString(seedRaw)) : undefined;
  const guide = document.getElementById('ng-guide')?.checked !== false;
  return { founder: val('ng-founder') || 'Àdìó', spouse: val('ng-spouse') || 'Àdùkẹ́', name: val('ng-name') || 'Èkó', seed, ...(guide ? {} : { guide: false }) };
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// The isometric view draws from baked sprite sheets: load them (and the
// ground textures) before the first game starts.
async function makeRenderer(game) {
  game.renderer = new IsoRenderer(game.canvas);
  const start = document.getElementById('ng-start');
  const label = start.textContent;
  start.disabled = true;
  start.textContent = 'Loading…';
  try {
    await game.renderer.load();
    const types = Object.entries(BUILDINGS).filter(([, d]) => d.buildable !== false);
    game.hud.thumbs = { ...game.hud.thumbs, ...game.renderer.thumbnails(types) };
  } catch (err) {
    console.error(err);
    game.hud.toast('Some pictures could not be loaded. Check your connection and reload.');
  }
  start.disabled = false;
  start.textContent = label;
}

async function boot() {
  const game = new Game();
  window.ekoRising = game;
  game.hud.mount();
  const ready = makeRenderer(game);
  game.renderer.resize();
  game.keys = bindInput(game, game.canvas, game.minimap);
  window.addEventListener('resize', () => {
    game.renderer.resize();
    if (game.st) game.renderer.clampCam();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.st && !game.st.gameOver) game.save('auto');
  });
  document.getElementById('speed-btn').addEventListener('click', () => game.cycleSpeed());
  document.getElementById('army-btn').addEventListener('click', () => game.selectArmy());
  document.getElementById('turn-left').addEventListener('click', () => game.turnView(-1));
  document.getElementById('turn-right').addEventListener('click', () => game.turnView(1));
  document.getElementById('trees-btn').addEventListener('click', () => game.toggleTrees());
  document.getElementById('home-btn').addEventListener('click', () => game.goHome());
  document.getElementById('select-btn').addEventListener('click', () => game.toggleSelecting());
  document.getElementById('ng-start').addEventListener('click', () => game.newGame(readNewGameForm()));
  document.getElementById('ng-continue').addEventListener('click', () => ready.then(() => game.load()));
  document.getElementById('ng-saves').addEventListener('click', () => ready.then(() => game.hud.showSaves()));
  document.getElementById('ng-feedback').addEventListener('click', () => game.feedback.open('title screen'));
  document.getElementById('save-file').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    ready.then(() => game.importSave(file));
  });
  renderNigeria(document.getElementById('nigeria'), (id) => ready.then(() => game.pickRegion(id)), unlocked());
  showTitle(game);
  requestAnimationFrame((t) => game.loop(t));
  await ready;
}

boot();
