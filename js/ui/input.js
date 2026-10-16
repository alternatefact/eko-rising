// Mouse, touch and keyboard. Translates gestures into calls on the game
// controller: pan, zoom, tap, box-select, wall dragging.

const DRAG_PX = 7;

export function bindInput(game, canvas, minimap) {
  const pointers = new Map();
  let gesture = null; // { kind: 'pan'|'box'|'pinch'|'wall'|'tap', ... }

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, { ...p, sx: p.x, sy: p.y });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      gesture = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      return;
    }
    if (pointers.size > 2) return;
    const mouse = e.pointerType === 'mouse';
    if (mouse && e.button === 1) {
      gesture = { kind: 'pan', mouse, button: 1, moved: true };
      return;
    }
    if (game.mode.line && mouse && e.button === 0) {
      gesture = { kind: 'wall', mouse, start: { ...p }, moved: false };
      game.wallPress(p.x, p.y);
      return;
    }
    gesture = { kind: 'tap', mouse, button: e.button, shift: e.shiftKey, start: { ...p }, moved: false };
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (e.pointerType === 'mouse' && !pointers.size) {
      game.hover(p.x, p.y);
      return;
    }
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    prev.x = p.x;
    prev.y = p.y;
    if (!gesture) return;

    if (gesture.kind === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      if (gesture.dist > 0) game.zoom(dist / gesture.dist, cx, cy);
      game.pan(cx - gesture.cx, cy - gesture.cy);
      gesture.dist = dist;
      gesture.cx = cx;
      gesture.cy = cy;
      return;
    }
    if (gesture.kind === 'wall') {
      if (Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > DRAG_PX) gesture.moved = true;
      game.hover(p.x, p.y);
      return;
    }
    if (gesture.kind === 'tap') {
      if (Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > DRAG_PX) {
        gesture.moved = true;
        if (gesture.mouse && (gesture.shift || gesture.button === 2) && gesture.button !== 1) {
          gesture.kind = 'box';
          game.view.box = { x0: gesture.start.x, y0: gesture.start.y, x1: p.x, y1: p.y };
        } else {
          gesture.kind = 'pan';
          game.pan(p.x - gesture.start.x, p.y - gesture.start.y);
        }
      }
      if (gesture.mouse) game.hover(p.x, p.y);
      return;
    }
    if (gesture.kind === 'pan') {
      game.pan(dx, dy);
      return;
    }
    if (gesture.kind === 'box') {
      game.view.box.x1 = p.x;
      game.view.box.y1 = p.y;
    }
  });

  const end = (e) => {
    const p = local(e);
    pointers.delete(e.pointerId);
    if (!gesture) return;
    if (gesture.kind === 'pinch') {
      if (pointers.size === 0) gesture = null;
      else gesture = { kind: 'pan', moved: true };
      return;
    }
    if (pointers.size) return;
    const g = gesture;
    gesture = null;
    if (e.type === 'pointercancel') {
      game.view.box = null;
      return;
    }
    if (g.kind === 'tap' && !g.moved) {
      game.tap(p.x, p.y, { button: g.button, shift: g.shift, mouse: g.mouse });
    } else if (g.kind === 'box') {
      const b = game.view.box;
      game.view.box = null;
      game.boxSelect(b.x0, b.y0, b.x1, b.y1, g.shift);
    } else if (g.kind === 'wall') {
      game.wallRelease(p.x, p.y, g.moved);
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = local(e);
      const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
      game.zoom(f, p.x, p.y);
    },
    { passive: false },
  );

  // Minimap: tap or drag to look somewhere else.
  let miniDrag = false;
  const miniGo = (e) => {
    const t = minimap.toTile(e.clientX, e.clientY);
    game.centerOn(t.x, t.y);
  };
  minimap.canvas.addEventListener('pointerdown', (e) => {
    miniDrag = true;
    minimap.canvas.setPointerCapture(e.pointerId);
    miniGo(e);
  });
  minimap.canvas.addEventListener('pointermove', (e) => miniDrag && miniGo(e));
  minimap.canvas.addEventListener('pointerup', () => (miniDrag = false));

  // Keyboard.
  const held = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
      held.add(k);
      e.preventDefault();
    }
    if (k === ' ') {
      e.preventDefault();
      game.togglePause();
    }
    if (k === '1' || k === '2' || k === '3') game.setSpeed(+k);
    if (k === 'escape') game.escape();
    if (k === '+' || k === '=') game.zoom(1.2, game.renderer.w / 2, game.renderer.h / 2);
    if (k === '-' || k === '_') game.zoom(1 / 1.2, game.renderer.w / 2, game.renderer.h / 2);
    if (k === 'h') game.goHome();
    if (k === 'g') game.selectArmy();
    if (k === 'delete' || k === 'backspace') game.demolishSelected();
  });
  window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => held.clear());

  return {
    update(dt) {
      if (!held.size) return;
      let dx = 0;
      let dy = 0;
      if (held.has('arrowleft') || held.has('a')) dx -= 1;
      if (held.has('arrowright') || held.has('d')) dx += 1;
      if (held.has('arrowup') || held.has('w')) dy -= 1;
      if (held.has('arrowdown') || held.has('s')) dy += 1;
      const speed = 700 * dt;
      game.pan(-dx * speed, -dy * speed);
    },
  };
}
