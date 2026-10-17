// The guided opening: a list of steps (the region's `story`), taken one at a
// time. Each step can open with something happening (`enter`), says who is
// talking and what they say, gives the player one thing to do (`task`, with a
// `hint` on how) and something to point at, and waits until `done`. Nothing
// moves on until the player has done what was asked, so the opening goes at
// the player's pace.
//
// Steps are plain data in the region file:
//   { id, enter(st, api), who, say, task, hint, point(st), done(st, api), min }
// `say`, `task` and `hint` may be functions of the state. `point` returns
// { id } for a person, building or animal, { x, y } for a place on the map,
// or { build: type } for a card in the build bar. `min` is the least time,
// in seconds, a step stays up.

import { makeApi } from './events.js';

export function storySteps(st) {
  return st.region.story || [];
}

export function currentStep(st) {
  if (!st.tut || st.tut.done) return null;
  return storySteps(st)[st.tut.i] || null;
}

export function storyRunning(st) {
  return !!st.tut && !st.tut.done && storySteps(st).length > 0;
}

export function updateStory(st) {
  const steps = storySteps(st);
  if (!st.tut || st.tut.done) return;
  if (!steps.length) {
    st.tut.done = true;
    return;
  }
  const api = makeApi(st);
  for (let guard = 0; guard < 4; guard++) {
    const s = steps[st.tut.i];
    if (!s) {
      st.tut.done = true;
      return;
    }
    if (!st.tut.entered) {
      st.tut.entered = true;
      st.tut.t = st.time.t;
      st.tut.sig = {};
      s.enter?.(st, api);
    }
    // A story pop-up is open: wait for the player to answer it.
    if (st.eventQueue.length) return;
    if (st.time.t - st.tut.t < (s.min || 0)) return;
    let ok = false;
    try {
      ok = s.done(st, api);
    } catch (err) {
      ok = false;
    }
    if (!ok) return;
    s.exit?.(st, api);
    st.tut.i++;
    st.tut.entered = false;
  }
}

// The interface reports what the player did (selected someone, gave an
// order) so steps that wait for it can move on.
export function tutSignal(st, kind, v = true) {
  if (!st.tut || st.tut.done) return;
  st.tut.sig = st.tut.sig || {};
  st.tut.sig[kind] = v;
}

// Text fields may be functions of the state.
export function stepText(st, s, key) {
  const v = s?.[key];
  return typeof v === 'function' ? v(st) : v || '';
}
