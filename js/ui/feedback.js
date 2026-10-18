// Feedback from players: a short form (a star rating and three optional
// answers) sent to the studio by the website's server, with a little context
// the game gathers itself and shows the player. The game asks for it now and
// then at a natural pause (the end of the guided opening, a chapter won, a
// long session), each only once, and not at all for a week after someone has
// written. Where there is no server to send to, the player can copy the
// message and email it instead.

import { ERAS, population, currentStep } from '../sim/index.js';

export const GAME_VERSION = '2026.10.18';
const KEY = 'eko-rising:feedback';
const STUDIO_EMAIL = 'Alternatefact2@gmail.com';
const ASK_AFTER_MINUTES = 25;
const QUIET_DAYS = 7;
const STARS = ['Not for me', 'Needs work', 'It is all right', 'Good', 'Love it'];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The last few errors the game hit, to go with a bug report.
const errors = [];
export function noteError(e) {
  const msg = String(e?.message || e || '').slice(0, 140);
  if (!msg || errors[errors.length - 1] === msg) return;
  errors.push(msg);
  if (errors.length > 3) errors.shift();
}
window.addEventListener('error', (e) => noteError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => noteError(e.reason));

// The website's server takes the feedback; another host can point elsewhere
// with <meta name="eko-feedback-url">.
function endpoint() {
  return document.querySelector('meta[name="eko-feedback-url"]')?.content || '/api/game-feedback';
}

function remembered() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch (err) {
    return {};
  }
}

function remember(v) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...remembered(), ...v }));
  } catch (err) {
    // Storage is blocked: the game will simply ask again another time.
  }
}

export class Feedback {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('feedback');
    this.askEl = document.getElementById('feedback-ask');
    this.started = performance.now();
    this.askedNow = false;
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('submit', (e) => {
      e.preventDefault();
      this.send();
    });
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
    this.askEl.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.fb === 'open') this.open(this.askWhy || 'asked');
      else this.hideAsk();
    });
  }

  // What the game was doing, sent along with the feedback (and listed for
  // the player under "Also sent with it").
  context(where) {
    const g = this.game;
    const st = g.st;
    const c = {
      version: GAME_VERSION,
      where,
      screen: `${innerWidth}x${innerHeight}@${Math.round(devicePixelRatio * 10) / 10}`,
      touch: matchMedia('(pointer: coarse)').matches ? 'yes' : 'no',
      browser: navigator.userAgent.slice(0, 180),
      played: `${Math.max(1, Math.round((performance.now() - this.started) / 60000))} min this session`,
    };
    if (st) {
      c.land = st.region?.name || st.regionId;
      c.day = String(st.time.day + 1);
      c.age = ERAS[st.era]?.name || String(st.era);
      c.people = String(population(st));
      c.guide = st.tut && !st.tut.done ? `step ${st.tut.i + 1}: ${currentStep(st)?.id || '?'}` : st.flags.freeStart ? 'started without it' : 'finished';
      c.speed = g.paused && !this.pausedHere ? 'paused' : `${g.speed}x`;
      if (st.gameOver) c.ended = st.gameOver.victory ? 'won' : `lost: ${st.gameOver.reason || ''}`;
    }
    if (errors.length) c.errors = errors.join(' | ');
    return c;
  }

  open(where = 'menu') {
    this.where = where;
    this.hideAsk();
    this.rating = 0;
    // The world waits while they write.
    this.pausedHere = !!this.game.st && !this.game.paused;
    if (this.pausedHere) this.game.paused = true;
    this.renderForm();
    this.el.hidden = false;
    if (!matchMedia('(pointer: coarse)').matches) this.el.querySelector('.fb-star')?.focus();
  }

  close() {
    this.el.hidden = true;
    this.el.innerHTML = '';
    if (this.pausedHere && this.game.st) this.game.paused = false;
    this.pausedHere = false;
  }

  renderForm() {
    const ctx = this.context(this.where);
    const stars = STARS.map((label, k) => `<button type="button" class="fb-star" data-star="${k + 1}" aria-label="${k + 1} of 5: ${esc(label)}" aria-pressed="false">★</button>`).join('');
    this.el.innerHTML = `<div class="fb-card" role="dialog" aria-modal="true" aria-labelledby="fb-title">
      <div class="panel-head"><h2 id="fb-title">💬 Tell us what you think</h2><button type="button" class="close" data-fb="close" aria-label="Close">✕</button></div>
      <p class="muted">Your message goes straight to the alternatefact Studios team. A few words help us make Eko Rising better.</p>
      <form novalidate>
        <div class="fb-rate"><span class="fb-q">How are you enjoying it?</span><div class="fb-stars" role="group" aria-label="Rating">${stars}</div><span class="fb-star-label muted"></span></div>
        <label class="fb-field"><span class="fb-q">What did you enjoy?</span><textarea name="liked" rows="2" maxlength="2000"></textarea></label>
        <label class="fb-field"><span class="fb-q">What was confusing, too hard or broken?</span><textarea name="problems" rows="3" maxlength="2000"></textarea></label>
        <label class="fb-field"><span class="fb-q">What would you like to see next?</span><textarea name="wish" rows="2" maxlength="2000"></textarea></label>
        <label class="fb-field"><span class="fb-q">Your email, if you would like a reply <small class="muted">(optional)</small></span><input name="email" type="email" maxlength="120" autocomplete="email" inputmode="email" /></label>
        <input name="website" class="fb-hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <details class="fb-ctx"><summary>Also sent with it</summary>
          <p class="muted">So we can find what you found: the game's version, where you are in the game, your screen and browser, and any error the game hit. Nothing else.</p>
          <dl>${Object.entries(ctx).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        </details>
        <p class="fb-status" role="status" aria-live="polite"></p>
        <div class="row"><button type="submit" class="btn primary big" data-fb="send">Send feedback</button><button type="button" class="btn big" data-fb="close">Not now</button></div>
      </form>
    </div>`;
  }

  onClick(e) {
    // A tap on the dimmed background closes the form only when nothing is written.
    if (e.target === this.el) {
      if (!this.written()) this.close();
      return;
    }
    const star = e.target.closest('.fb-star');
    if (star) {
      this.rating = +star.dataset.star;
      this.el.querySelectorAll('.fb-star').forEach((s) => {
        const on = +s.dataset.star <= this.rating;
        s.classList.toggle('on', on);
        s.setAttribute('aria-pressed', String(+s.dataset.star === this.rating));
      });
      this.el.querySelector('.fb-star-label').textContent = STARS[this.rating - 1];
      return;
    }
    const b = e.target.closest('[data-fb]');
    if (!b) return;
    if (b.dataset.fb === 'close') this.close();
    if (b.dataset.fb === 'copy') this.copy();
  }

  written() {
    const f = this.el.querySelector('form');
    return !!f && ['liked', 'problems', 'wish'].some((n) => f.elements[n].value.trim());
  }

  status(text, bad) {
    const s = this.el.querySelector('.fb-status');
    if (!s) return;
    s.textContent = text;
    s.classList.toggle('bad', !!bad);
  }

  async send() {
    const f = this.el.querySelector('form');
    if (!f || this.sending) return;
    const v = (n) => f.elements[n].value.trim();
    const data = {
      game: 'eko-rising',
      rating: this.rating || null,
      liked: v('liked'),
      problems: v('problems'),
      wish: v('wish'),
      email: v('email') || null,
      context: this.context(this.where),
      website: f.elements.website.value,
    };
    if (!data.rating && !data.liked && !data.problems && !data.wish) {
      this.status('Pick a star rating or write a few words first.', true);
      return;
    }
    if (data.email && !f.elements.email.checkValidity()) {
      this.status('That email address does not look right. Fix it, or leave it empty.', true);
      return;
    }
    this.sending = true;
    const btn = f.querySelector('[data-fb="send"]');
    btn.disabled = true;
    this.status('Sending…');
    try {
      const r = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (r.ok) {
        remember({ sentAt: Date.now() });
        this.thanks();
        return;
      }
      const body = await r.json().catch(() => null);
      if (r.status === 429) this.status('You have sent a lot just now. Please try again in a few minutes.', true);
      else if (r.status === 400 && typeof body?.detail === 'string') this.status(body.detail, true);
      else if (r.status === 422 && Array.isArray(body?.detail)) this.status(`Please check the form: ${String(body.detail[0]?.msg || '').replace(/^Value error, /, '')}`, true);
      else throw new Error(`HTTP ${r.status}`);
    } catch (err) {
      this.fallback(data);
      return;
    } finally {
      this.sending = false;
      if (btn.isConnected) btn.disabled = false;
    }
  }

  thanks() {
    this.el.querySelector('.fb-card').innerHTML = `<div class="panel-head"><h2>🙏 Thank you!</h2><button type="button" class="close" data-fb="close" aria-label="Close">✕</button></div>
      <p>Your feedback is on its way to the alternatefact Studios team. We read every message.</p>
      <div class="row"><button type="button" class="btn primary big" data-fb="close">Back to the game</button></div>`;
  }

  // No server to send to (offline, or the game is played somewhere else):
  // the message, ready to copy into an email.
  fallback(data) {
    const answers = [
      data.liked && `Enjoyed: ${data.liked}`,
      data.problems && `Confusing, too hard or broken: ${data.problems}`,
      data.wish && `Would like next: ${data.wish}`,
    ].filter(Boolean);
    const lines = [
      `Eko Rising feedback${data.rating ? `: ${'★'.repeat(data.rating)}${'☆'.repeat(5 - data.rating)}` : ''}`,
      ...answers,
      '',
      ...Object.entries(data.context).map(([k, v]) => `${k}: ${v}`),
    ];
    this.fallbackText = lines.join('\n');
    this.el.querySelector('.fb-card').innerHTML = `<div class="panel-head"><h2>📮 Could not send it from here</h2><button type="button" class="close" data-fb="close" aria-label="Close">✕</button></div>
      <p>Please copy your message and email it to us at <b class="fb-email">${esc(STUDIO_EMAIL)}</b>. Nothing you wrote is lost.</p>
      <textarea class="fb-copy" rows="8" readonly>${esc(this.fallbackText)}</textarea>
      <p class="fb-status" role="status" aria-live="polite"></p>
      <div class="row"><button type="button" class="btn primary big" data-fb="copy">📋 Copy the message</button><button type="button" class="btn big" data-fb="close">Close</button></div>`;
  }

  copy() {
    const box = this.el.querySelector('.fb-copy');
    const done = () => this.status(`Copied. Paste it into an email to ${STUDIO_EMAIL}.`);
    const select = () => {
      box.focus();
      box.select();
      this.status('Selected: copy it with your device, then email it to us.');
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(this.fallbackText).then(done, select);
    else select();
  }

  // --- Asking, now and then --------------------------------------------------------

  // Called with the game's regular refresh: once a session at most, at a
  // natural pause, each reason only once ever.
  check() {
    const g = this.game;
    const st = g.st;
    if (!st) return;
    if (st !== this.lastSt) {
      // A game just started or loaded: only what happens from now on counts.
      this.lastSt = st;
      this.before = { opening: !!st.flags.openingDone, chapter: !!(st.flags.beninBeaten || st.flags.ogunUnited) };
    }
    if (this.askedNow || !this.el.hidden || st.eventQueue.length || st.gameOver || g.mode?.build || document.getElementById('app').classList.contains('alerting')) return;
    const saved = remembered();
    if (saved.sentAt && Date.now() - saved.sentAt < QUIET_DAYS * 864e5) return;
    const asked = new Set(saved.asked || []);
    let why = null;
    if (!this.before.opening && st.flags.openingDone && !st.flags.freeStart && !asked.has('opening')) why = 'opening';
    else if (!this.before.chapter && (st.flags.beninBeaten || st.flags.ogunUnited) && !asked.has('chapter')) why = 'chapter';
    else if (performance.now() - this.started > ASK_AFTER_MINUTES * 60000 && !asked.has('time')) why = 'time';
    if (!why) return;
    this.askedNow = true;
    remember({ asked: [...asked, why] });
    this.ask(why);
  }

  ask(why) {
    this.askWhy = `asked: ${why}`;
    const text = {
      opening: 'You have made it through the opening. How was it? A few words help us a lot.',
      chapter: 'A chapter won! Tell us what you thought of it.',
      time: 'Enjoying Eko Rising? Tell us what you think: two minutes helps us a lot.',
    }[why];
    this.askEl.innerHTML = `<span>🙏 ${esc(text)}</span><button type="button" class="btn primary" data-fb="open">💬 Give feedback</button><button type="button" class="btn" data-fb="later" aria-label="Not now">Not now</button>`;
    this.askEl.hidden = false;
    clearTimeout(this.askT);
    this.askT = setTimeout(() => this.hideAsk(), 45000);
  }

  hideAsk() {
    this.askEl.hidden = true;
    clearTimeout(this.askT);
  }
}
