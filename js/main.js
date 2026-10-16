// Boots the game: title screen, the frame loop, and the controller that
// connects input and interface to the simulation.

import * as sim from './sim/index.js';
import { BUILDINGS } from './data/buildings.js';
import { Renderer } from './render/renderer.js';
import { Minimap } from './render/minimap.js';
import { Hud, renderNigeria } from './ui/hud.js';
import { bindInput } from './ui/input.js';

const SAVE_KEY = 'eko-rising:save:v1';
const MAX_STEPS = 12;

const storage = {
  get() {
    try {
      return localStorage.getItem(SAVE_KEY);
    } catch (err) {
      return null;
    }
  },
  set(v) {
    try {
      localStorage.setItem(SAVE_KEY, v);
      return true;
    } catch (err) {
      return false;
    }
  },
};

class Game {
  constructor() {
    this.canvas = document.getElementById('world');
    this.renderer = new Renderer(this.canvas);
    this.minimap = new Minimap(document.getElementById('minimap'));
    this.hud = new Hud(this);
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
    const home = st.buildings.find((b) => b.type === 'palace' && !b.dead) || st.buildings.find((b) => b.type === 'compound');
    this.renderer.cam.zoom = window.innerWidth < 760 ? 1.05 : 1.35;
    this.renderer.centerOn(home ? home.x + home.w / 2 : st.start.x, home ? home.y + home.h / 2 + 1 : st.start.y);
    document.getElementById('title').hidden = true;
    this.paused = false;
    this.hud.update();
  }

  newGame(opts) {
    this.start(sim.newGame({ region: 'lagos', ...opts }));
    this.save(false);
  }

  hasSave() {
    return !!storage.get();
  }

  save(manual) {
    if (!this.st) return;
    const ok = storage.set(sim.serialize(this.st));
    if (manual) this.hud.toast(ok ? '💾 Game saved.' : 'Could not save — your browser is blocking storage.');
  }

  load() {
    const raw = storage.get();
    if (!raw) return;
    try {
      this.start(sim.deserialize(raw));
      this.hud.toast('📂 Game loaded.');
    } catch (err) {
      this.hud.toast(`Could not load the save: ${err.message}`);
    }
  }

  toTitle() {
    this.save(false);
    this.st = null;
    this.hud.closePanel();
    document.getElementById('modal').hidden = true;
    showTitle(this);
  }

  // --- Loop -------------------------------------------------------------------------

  loop(now) {
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    if (this.st) {
      this.keys?.update(dt);
      if (!this.paused) {
        this.acc += dt * this.speed;
        let steps = 0;
        while (this.acc >= sim.STEP && steps < MAX_STEPS) {
          sim.tick(this.st, sim.STEP);
          this.acc -= sim.STEP;
          steps++;
        }
        if (steps >= MAX_STEPS) this.acc = 0;
      }
      this.pruneSelection();
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
        if (!this.st.gameOver) this.save(false);
      }
    }
    requestAnimationFrame((t) => this.loop(t));
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
    } else if (kind === 'restart') {
      this.newGame({ founder: this.st.founder, spouse: this.st.spouse, name: this.st.region.defaultName });
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

  pan(dx, dy) {
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
    const home = this.st.buildings.find((b) => b.type === 'palace' && !b.dead) || this.st.buildings.find((b) => b.type === 'compound' && !b.dead);
    if (home) this.centerOn(home.x + home.w / 2, home.y + home.h / 2);
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

  cancelBuild() {
    this.mode = { build: null, line: false, wallStart: null, ghostAt: null };
    this.view.ghost = null;
    this.view.showTerritory = false;
    this.canvas.classList.remove('building');
    this.hud.placeBar(false);
    this.hud.lastBuild = null;
  }

  footprintAt(sx, sy) {
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
    if (BUILDINGS[type].unique) this.cancelBuild();
    this.hud.lastBuild = null;
    return true;
  }

  confirmPlace() {
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
    if (this.mode.build) this.cancelBuild();
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

  myUnits() {
    return [...this.view.selected].map((id) => this.st.byId.get(id)).filter((u) => u && !u.dead && u.kind === 'unit' && u.owner === 'player');
  }

  tap(sx, sy, info) {
    if (!this.st || this.st.eventQueue.length) return;
    if (this.mode.build) {
      if (info.button === 2) this.cancelBuild();
      else this.buildTap(sx, sy, info);
      return;
    }
    const p = this.renderer.screenToTile(sx, sy);
    const hit = this.pick(p.x, p.y);
    const army = this.myUnits();

    if (hit?.kind === 'unit' && hit.owner === 'player' && info.button !== 2) {
      if (!info.shift) this.view.selected.clear();
      this.view.selected.add(hit.id);
      this.view.selectedFaction = null;
      this.hud.openPanel('units');
      return;
    }
    if (army.length && !(hit?.kind === 'building' && info.button !== 2) && !(hit?.kind === 'citizen' && info.button !== 2)) {
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
      this.hud.openPanel('citizen', hit.id);
    } else if (hit.kind === 'building') {
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
    if (hit?.kind === 'unit' && hit.owner !== 'player') {
      const r = sim.orderAttack(this.st, ids, hit.id);
      if (!r.ok && r.reason) this.hud.toast(r.reason);
      else this.view.order = { x: hit.x, y: hit.y, at: performance.now(), attack: true };
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

  boxSelect(x0, y0, x1, y1, add) {
    const a = this.renderer.screenToTile(Math.min(x0, x1), Math.min(y0, y1));
    const b = this.renderer.screenToTile(Math.max(x0, x1), Math.max(y0, y1));
    if (!add) this.view.selected.clear();
    for (const u of this.st.units) {
      if (u.dead || u.owner !== 'player') continue;
      if (u.x >= a.x && u.x <= b.x && u.y >= a.y && u.y <= b.y) this.view.selected.add(u.id);
    }
    if (this.myUnits().length) this.hud.openPanel('units');
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

  sendSelectedHome() {
    const home = this.st.buildings.find((b) => b.type === 'palace' && !b.dead) || this.st.buildings.find((b) => b.type === 'compound' && !b.dead);
    if (!home) return;
    sim.orderMove(this.st, this.myUnits().map((u) => u.id), home.x + home.w / 2, home.y + home.h + 1.5, false);
  }
}

// --- Title screen ---------------------------------------------------------------------

function showTitle(game) {
  const title = document.getElementById('title');
  title.hidden = false;
  document.getElementById('ng-continue').hidden = !game.hasSave();
}

function readNewGameForm() {
  const val = (id) => document.getElementById(id).value.trim();
  const seedRaw = val('ng-seed');
  const seed = seedRaw ? Math.abs(parseInt(seedRaw.replace(/\D/g, ''), 10) || hashString(seedRaw)) : undefined;
  return { founder: val('ng-founder') || 'Àdìó', spouse: val('ng-spouse') || 'Àdùkẹ́', name: val('ng-name') || 'Èkó', seed };
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function boot() {
  const game = new Game();
  window.ekoRising = game;
  game.hud.mount();
  game.keys = bindInput(game, game.canvas, game.minimap);
  window.addEventListener('resize', () => {
    game.renderer.resize();
    if (game.st) game.renderer.clampCam();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.st && !game.st.gameOver) game.save(false);
  });
  document.getElementById('speed-btn').addEventListener('click', () => game.cycleSpeed());
  document.getElementById('army-btn').addEventListener('click', () => game.selectArmy());
  document.getElementById('ng-start').addEventListener('click', () => game.newGame(readNewGameForm()));
  document.getElementById('ng-continue').addEventListener('click', () => game.load());
  renderNigeria(document.getElementById('nigeria'), () => game.newGame(readNewGameForm()));
  showTitle(game);
  requestAnimationFrame((t) => game.loop(t));
}

boot();
