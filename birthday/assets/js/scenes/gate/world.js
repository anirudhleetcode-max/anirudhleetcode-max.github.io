// The countdown's little world: things on the lantern lake that are there to be found and played with
// while she waits — never in the way of the countdown, never noisy, never endless.
//
//   hearts       a few soft hearts drifting in the sky; a tap pops one into sparkles, and now and
//                then a popped heart leaves a short note (gate.hearts in the messages, or the defaults)
//   butterflies  two glowing moon-butterflies on bounded loops by the shore; a tap sends one off in a
//                spiral of sparkles (it comes back); the first one ever tapped carries a secret
//   fireflies    a pooled handful of warm lights low over the water, drawn toward her pointer
//   gift         a little gift floating on the water: a tap → a wiggle, the lid lifts, warm light and
//                a note (gate.gift); it closes again (tap again, ✕ or Escape)
//   cupcake      one candle on a lily pad: a tap blows it out (it relights by itself); at midnight it
//                glows with the lanterns. Tap only — no microphone here, ever.
//   secrets      four small discoveries (the wish star, the heart constellation, the butterfly's note,
//                saying hi to her), remembered on this device; ✦ shows how many are found and the hints
//   her          (gate/girl.js) Deepu's figurine on the jetty — she glances toward what is tapped and
//                smiles at discoveries
//   sound        one button: the first tap unlocks the film's own audio engine for the little effects
//                (the music waits for the film; nothing ever plays by itself); then it mutes and unmutes it
//
// Everything is a real <button> (keyboard and screen readers reach it), effects come from fixed pools,
// one requestAnimationFrame loop drives the moving parts (paused while the tab is hidden), and
// dispose() removes every node, listener, timer and tween.
import { esc } from '../../core/art.js';
import { createGirl } from './girl.js';

const STORE = 'deepu-gate-secrets';
const HINT = 'deepu-gate-hinted';
const SECRETS = ['star', 'constellation', 'butterfly', 'hello'];
const DEFAULT_HEARTS = [
  'A little happiness, just for you.',
  'You make ordinary days feel special.',
  'A tiny reminder that you’re appreciated.',
  'Here’s another reason to smile.',
  'A little sparkle for your day.',
];
const NOTES = {
  star: 'You found the wish star. Make a good one; it keeps until midnight.',
  constellation: 'Five little stars, one little heart. The sky is practising for your birthday.',
  butterfly: 'The butterfly says: almost there. It has been counting too.',
  hello: 'She says hi. She’s been waiting here with the lanterns.',
};
const HINTS = {
  star: 'One star up there is a little brighter than the rest.',
  constellation: 'Some faint stars want to be joined into a shape.',
  butterfly: 'The glowing butterflies are shy, but friendly.',
  hello: 'Say hi to the girl on the jetty (more than once).',
};
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: fine */ } },
};

const HEART_PATH = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.2 0 3.6 1.2 5.4 3.1 1.8-1.9 3.2-3.1 5.4-3.1 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z';
const heartSVG = (id) => `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="gwh-${id}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffe8ef"/><stop offset=".45" stop-color="#ffb4c6"/><stop offset="1" stop-color="#e8789a"/></radialGradient></defs><path d="${HEART_PATH}" fill="url(#gwh-${id})"/><path d="M7 7.6c-1.4.3-2.3 1.6-2.1 3" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.1" stroke-linecap="round"/></svg>`;
const butterflySVG = (hue) => `<svg viewBox="0 0 40 30" aria-hidden="true"><g class="gw-wings" style="--h:${hue}"><path class="gw-wl" d="M20 15 C12 2 2 2 3 10 C4 16 12 17 20 15 Z M20 15 C13 19 6 24 9 27 C12 29 17 22 20 15 Z"/><path class="gw-wr" d="M20 15 C28 2 38 2 37 10 C36 16 28 17 20 15 Z M20 15 C27 19 34 24 31 27 C28 29 23 22 20 15 Z"/></g><path d="M20 9 L20 22" stroke="#3a2a55" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const giftSVG = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs><linearGradient id="gwg-box" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c7a4"/><stop offset="1" stop-color="#d88a6c"/></linearGradient>
  <linearGradient id="gwg-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9bd"/><stop offset="1" stop-color="#e79c7c"/></linearGradient>
  <radialGradient id="gwg-glow"><stop offset="0" stop-color="#fff3cf"/><stop offset=".5" stop-color="#ffcf7c" stop-opacity=".6"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs>
  <ellipse class="gw-gift-light" cx="32" cy="30" rx="26" ry="20" fill="url(#gwg-glow)" opacity="0"/>
  <rect x="12" y="30" width="40" height="26" rx="3" fill="url(#gwg-box)"/>
  <rect x="29" y="30" width="6" height="26" fill="#b98ee0"/>
  <g class="gw-lid"><rect x="9" y="22" width="46" height="10" rx="3" fill="url(#gwg-lid)"/><rect x="29" y="22" width="6" height="10" fill="#c9a2ef"/>
  <g class="gw-bow"><path d="M32 22 C24 12 16 16 22 21 C25 23 30 22 32 22 Z" fill="#c9a2ef"/><path d="M32 22 C40 12 48 16 42 21 C39 23 34 22 32 22 Z" fill="#b98ee0"/><circle cx="32" cy="21.5" r="2.6" fill="#e3c8ff"/></g></g>
</svg>`;
const cupcakeSVG = `<svg viewBox="0 0 64 72" aria-hidden="true">
  <defs><radialGradient id="gwc-flame" cx="50%" cy="65%" r="60%"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#ffe7a0"/><stop offset="1" stop-color="#ff9d3d" stop-opacity="0"/></radialGradient>
  <radialGradient id="gwc-halo"><stop offset="0" stop-color="#ffd890" stop-opacity=".55"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="32" cy="66" rx="28" ry="5" fill="#2f5a46" opacity=".85"/><path d="M8 66 Q32 58 56 66" fill="#3f7a5c" opacity=".7"/>
  <path d="M16 44 L48 44 L44 64 L20 64 Z" fill="#c9a2ef"/><path d="M22 44 L24 64 M32 44 L32 64 M42 44 L40 64" stroke="#a983d6" stroke-width="1.4"/>
  <path d="M13 45 C11 36 20 31 26 33 C28 27 38 27 40 33 C47 31 54 37 51 45 Z" fill="#fff1e6"/>
  <circle cx="22" cy="39" r="1.3" fill="#ff9bb5"/><circle cx="35" cy="35" r="1.3" fill="#9fd3ff"/><circle cx="43" cy="40" r="1.3" fill="#ffd36b"/><circle cx="29" cy="41" r="1.2" fill="#b98ee0"/>
  <rect x="30.5" y="18" width="3" height="14" rx="1.2" fill="#ffe3a3"/><path d="M30.5 21 L33.5 19 M30.5 25 L33.5 23 M30.5 29 L33.5 27" stroke="#f39bb3" stroke-width="1"/>
  <circle class="gw-cup-halo" cx="32" cy="12" r="14" fill="url(#gwc-halo)"/>
  <ellipse class="gw-cup-flame" cx="32" cy="12" rx="4" ry="7" fill="url(#gwc-flame)"/>
  <path class="gw-cup-smoke" d="M32 16 C30 10 35 8 32 2" stroke="#d7d0ea" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0"/>
</svg>`;
const starSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 L14.2 9.8 L22.5 12 L14.2 14.2 L12 22.5 L9.8 14.2 L1.5 12 L9.8 9.8 Z" fill="currentColor"/></svg>';

/**
 * createWorld(el, ctx, { world, lanternBox }) → { pulse(), midnight(), dispose() }
 *   world       the nightscape (W, H, hy = horizon y)
 *   lanternBox  the main lantern's node (the girl watches it; the constellation keeps clear of it)
 */
export function createWorld(el, ctx, { world, lanternBox }) {
  const { gsap, fx, device } = ctx;
  const reduced = !!device.reducedMotion;
  const mobile = !!device.mobile;
  const t = ctx.text.gate || {};
  const heartNotes = (Array.isArray(t.hearts) ? t.hearts : []).map((s) => (typeof s === 'string' ? ctx.fill(s) : '')).filter((s) => s.trim());
  const notes = heartNotes.length ? heartNotes : DEFAULT_HEARTS;
  const giftNote = ctx.fill(typeof t.gift === 'string' && t.gift.trim() ? t.gift : 'An early hello from your birthday. The real one opens at midnight, 3 January.');
  const sfx = (name, o) => { try { ctx.audio.sfx(name, o); } catch { /* sound is optional */ } };
  const tweens = [];
  const timers = [];
  const offs = [];
  // (the page may stay open for hours: finished tweens and fired timers are let go as it goes)
  const tw = (x) => {
    if (tweens.length > 120) { const live = tweens.filter((k) => k && k.isActive()); tweens.length = 0; tweens.push(...live); }
    tweens.push(x);
    return x;
  };
  const later = (fn, ms) => {
    const id = setTimeout(() => { const i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1); fn(); }, ms);
    timers.push(id);
    return id;
  };
  const on = (node, ev, fn, o) => { node.addEventListener(ev, fn, o); offs.push(() => node.removeEventListener(ev, fn, o)); };
  let disposed = false;
  let midnightDone = false;
  let girl = null; // her figurine (gate/girl.js), once it has arrived

  const root = document.createElement('div');
  root.className = 'gw';
  root.innerHTML = `
    <canvas class="gw-flies" aria-hidden="true"></canvas>
    <div class="gw-sky"></div>
    <div class="gw-jetty"><button type="button" class="gw-hello" aria-label="Say hi to the girl on the jetty" hidden></button></div>
    <button type="button" class="gw-gift" aria-label="A little gift floating on the lake: open it">${giftSVG}</button>
    <button type="button" class="gw-cup" aria-label="A cupcake with one candle: blow it out">${cupcakeSVG}</button>
    <div class="gw-note" role="status" aria-live="polite" hidden><p></p><button type="button" class="gw-note-x" aria-label="Close the note">✕</button></div>
    <div class="gw-bar">
      <button type="button" class="gw-help" aria-label="Little secrets: hints and how many you have found" aria-expanded="false"><span aria-hidden="true">✦</span><b class="gw-count"></b></button>
      <button type="button" class="gw-sound" aria-pressed="false"><span aria-hidden="true">♪</span><span class="gw-sound-l">Sound</span></button>
    </div>
    <div class="gw-panel" hidden role="dialog" aria-label="Little secrets"><p class="gw-panel-t">Take a little look around. Some things here have surprises.</p><ul></ul><button type="button" class="gw-panel-x">Close</button></div>`;
  el.appendChild(root);
  const sky = root.querySelector('.gw-sky');
  const flies = root.querySelector('.gw-flies');
  const jetty = root.querySelector('.gw-jetty');
  const hello = root.querySelector('.gw-hello');
  const gift = root.querySelector('.gw-gift');
  const cup = root.querySelector('.gw-cup');
  const note = root.querySelector('.gw-note');
  const noteP = note.querySelector('p');
  const help = root.querySelector('.gw-help');
  const countEl = root.querySelector('.gw-count');
  const soundBtn = root.querySelector('.gw-sound');
  const panel = root.querySelector('.gw-panel');

  /* ---------------------------------------------------------------- notes (one at a time) */
  let noteTimer = 0;
  const say = (text, { hold = 5200 } = {}) => {
    clearTimeout(noteTimer);
    noteP.textContent = text;
    note.hidden = false;
    tw(gsap.fromTo(note, { opacity: 0, y: reduced ? 0 : 8 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }));
    noteTimer = later(hideNote, hold);
  };
  function hideNote() {
    if (note.hidden) return;
    tw(gsap.to(note, { opacity: 0, duration: 0.35, onComplete: () => { note.hidden = true; } }));
  }
  on(note.querySelector('.gw-note-x'), 'click', hideNote);

  /* ---------------------------------------------------------------- secrets */
  const found = new Set((store.get(STORE, []) || []).filter((k) => SECRETS.includes(k)));
  // (saying hi needs her: on a device that cannot show the figure, that secret is simply not there)
  const avail = () => SECRETS.filter((k) => k !== 'hello' || girl);
  const nFound = () => avail().filter((k) => found.has(k)).length;
  const showCount = () => { countEl.textContent = nFound() ? `${nFound()}/${avail().length}` : ''; };
  showCount();
  const discover = (key) => {
    const fresh = !found.has(key);
    found.add(key);
    store.set(STORE, [...found]);
    showCount();
    say(fresh ? `${NOTES[key]}  ✦ ${nFound()} of ${avail().length} little secrets` : NOTES[key], { hold: 6500 });
    girl?.react('delight');
    sfx('magic');
    tw(gsap.fromTo(help, { scale: 1 }, { scale: reduced ? 1 : 1.18, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.out' }));
  };
  const renderPanel = () => {
    panel.querySelector('ul').innerHTML = avail().map((k) => `<li class="${found.has(k) ? 'is-found' : ''}"><span aria-hidden="true">${found.has(k) ? '✦' : '·'}</span> ${esc(found.has(k) ? NOTES[k] : HINTS[k])}</li>`).join('');
  };
  const togglePanel = (open = panel.hidden) => {
    if (open) { renderPanel(); panel.hidden = false; tw(gsap.fromTo(panel, { opacity: 0, y: reduced ? 0 : 10 }, { opacity: 1, y: 0, duration: 0.35 })); panel.querySelector('.gw-panel-x').focus({ preventScroll: true }); } else { panel.hidden = true; help.focus({ preventScroll: true }); }
    help.setAttribute('aria-expanded', String(!panel.hidden));
  };
  on(help, 'click', () => togglePanel());
  on(panel.querySelector('.gw-panel-x'), 'click', () => togglePanel(false));

  // first visit: one gentle line, gone by itself
  if (!store.get(HINT, false)) {
    store.set(HINT, true);
    later(() => say('Take a little look around. Some things here have surprises.', { hold: 6000 }), reduced ? 2500 : 5200);
  }

  /* ---------------------------------------------------------------- sound: the film's own audio */
  // Only the little effects (pops, chimes) of the one audio engine: the film's music waits for the film,
  // and nothing plays before her tap. The first tap unlocks the engine; later taps mute and unmute it
  // (the same remembered mute the film uses).
  let soundOn = false;
  const syncSound = () => {
    const onNow = soundOn && !ctx.sound.muted;
    soundBtn.setAttribute('aria-pressed', String(onNow));
    soundBtn.querySelector('.gw-sound-l').textContent = onNow ? 'Sounds on' : 'Sounds';
    soundBtn.setAttribute('aria-label', onNow ? 'Little sounds are on: turn them off' : 'Turn on the little sounds');
  };
  syncSound();
  on(soundBtn, 'click', async () => {
    if (!soundOn) {
      soundOn = true;
      try { await ctx.audio.unlock(); } catch { /* sound is optional */ }
      if (ctx.sound.muted) ctx.sound.toggleMute();
      sfx('chime');
    } else ctx.sound.toggleMute();
    syncSound();
  });
  /* ---------------------------------------------------------------- layout */
  let L = { W: 0, H: 0, hy: 0, portrait: true };
  const place = (node, x, y) => { node.style.left = `${x}px`; node.style.top = `${y}px`; };
  function layout() {
    const W = world.W;
    const H = world.H;
    const hy = world.hy;
    const portrait = H > W;
    L = { W, H, hy, portrait };
    flies.width = Math.round(W * Math.min(1.5, window.devicePixelRatio || 1));
    flies.height = Math.round(H * Math.min(1.5, window.devicePixelRatio || 1));
    // her jetty: bottom centre, between the near lanterns of the arc
    const jh = portrait ? Math.min(H * 0.27, W * 0.62) : Math.min(H * 0.36, 300);
    const jw = jh * 0.72;
    jetty.style.width = `${jw}px`;
    jetty.style.height = `${jh}px`;
    place(jetty, W / 2 - jw / 2, H - jh);
    // the gift floats left of her, the cupcake rests right of her, both just above the water's edge
    const s = Math.max(52, Math.min(portrait ? W * 0.16 : H * 0.11, 84));
    for (const [node, side] of [[gift, -1], [cup, 1]]) {
      node.style.width = `${s}px`;
      node.style.height = `${s * (node === cup ? 1.12 : 1)}px`;
      const x = W / 2 + side * (jw / 2 + s * (portrait ? 0.25 : 0.55)) - s / 2;
      const hgt = s * (node === cup ? 1.12 : 1);
      // above the little bar at the bottom (44 px buttons + margins), whatever the screen
      const y = Math.min(H - s * (node === cup ? 1.25 : 1.6) - (portrait ? H * 0.025 : H * 0.04), H - 70 - hgt);
      place(node, Math.max(8, Math.min(W - s - 8, x)), y);
    }
    layoutSky();
  }

  /* ---------------------------------------------------------------- hearts */
  // anchors (fractions of the sky band between the countdown and the horizon), clear of the lantern
  const ANCHORS = [[0.12, 0.25], [0.86, 0.22], [0.2, 0.72], [0.8, 0.68], [0.08, 0.5], [0.92, 0.48], [0.3, 0.92], [0.7, 0.9]];
  const nHearts = mobile ? 4 : 5;
  const hearts = [];
  let popped = 0;
  const skyBand = () => {
    const count = el.querySelector('.gate-copy');
    const top = count ? count.getBoundingClientRect().bottom - el.getBoundingClientRect().top + 16 : L.H * 0.3;
    return { top, bottom: Math.max(top + 80, L.hy - 20) };
  };
  function makeHeart(i) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gw-heart';
    b.setAttribute('aria-label', 'A floating heart: pop it');
    b.innerHTML = heartSVG(i);
    sky.appendChild(b);
    const h = { b, anchor: i % ANCHORS.length, size: 26 + ((i * 7) % 14), phase: i * 1.7, x: 0, y: 0, ox: 0, oy: 0, alive: true };
    on(b, 'click', (e) => popHeart(h, e));
    hearts.push(h);
    return h;
  }
  function placeHeart(h) {
    const band = skyBand();
    const [fx0, fy0] = ANCHORS[h.anchor];
    h.x = fx0 * L.W;
    h.y = band.top + fy0 * (band.bottom - band.top);
    // keep clear of the big lantern
    const lr = lanternBox.getBoundingClientRect();
    if (h.x > lr.left - 40 && h.x < lr.right + 40 && h.y > lr.top - 40 && h.y < lr.bottom + 40) h.x = h.x < L.W / 2 ? lr.left - 50 : lr.right + 50;
    h.x = Math.max(24, Math.min(L.W - 24, h.x));
    const size = mobile ? Math.max(30, h.size) : h.size + 6;
    h.b.style.width = `${size}px`;
    h.b.style.height = `${size}px`;
    h.b.style.marginLeft = `${-size / 2}px`;
    h.b.style.marginTop = `${-size / 2}px`;
  }
  function popHeart(h, e) {
    if (!h.alive) return;
    h.alive = false;
    const r = h.b.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    fx.sparkle(cx, cy, reduced ? 6 : 14, { spread: 46, pink: true });
    sfx('pop');
    girl?.look(cx, cy);
    girl?.react('smile');
    tw(gsap.to(h.b, { scale: reduced ? 1 : 1.35, opacity: 0, duration: 0.3, ease: 'power2.out', onComplete: () => { h.b.hidden = true; } }));
    popped++;
    if (popped % 2 === 1 && !midnightDone) say(notes[Math.floor(popped / 2) % notes.length]);
    // it comes back later, somewhere else in the sky
    later(() => {
      if (disposed) return;
      h.anchor = (h.anchor + 3) % ANCHORS.length;
      placeHeart(h);
      h.b.hidden = false;
      h.alive = true;
      tw(gsap.fromTo(h.b, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out' }));
    }, 9000 + Math.random() * 6000);
    if (e) e.stopPropagation();
  }
  for (let i = 0; i < nHearts; i++) makeHeart(i);

  /* ---------------------------------------------------------------- the wish star and the heart constellation */
  const wish = document.createElement('button');
  wish.type = 'button';
  wish.className = 'gw-wish';
  wish.setAttribute('aria-label', 'A star that looks a little brighter than the others');
  wish.innerHTML = starSVG;
  sky.appendChild(wish);
  on(wish, 'click', () => {
    const r = wish.getBoundingClientRect();
    fx.sparkle(r.left + r.width / 2, r.top + r.height / 2, reduced ? 8 : 20, { spread: 60 });
    tw(gsap.fromTo(wish, { scale: 1 }, { scale: reduced ? 1 : 1.6, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.out' }));
    girl?.look(r.left, r.top);
    discover('star');
  });
  // five faint stars on a little heart (top, two shoulders, two sides of the point… and the point)
  const CON = [[0.5, 0.28], [0.22, 0], [0, 0.32], [0.5, 1], [1, 0.32], [0.78, 0]];
  const conStars = CON.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gw-con';
    b.setAttribute('aria-label', `A faint star (${i + 1} of ${CON.length})`);
    b.innerHTML = starSVG;
    sky.appendChild(b);
    return b;
  });
  const conLine = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  conLine.setAttribute('class', 'gw-con-line');
  conLine.setAttribute('aria-hidden', 'true');
  sky.appendChild(conLine);
  const lit = new Set();
  conStars.forEach((b, i) => on(b, 'click', () => {
    if (lit.has(i)) return;
    lit.add(i);
    b.classList.add('is-lit');
    sfx('sparkle', { volume: 0.5 });
    if (lit.size === CON.length) {
      conLine.classList.add('is-on');
      const r = conLine.getBoundingClientRect();
      fx.sparkle(r.left + r.width / 2, r.top + r.height / 2, reduced ? 8 : 22, { spread: 70, pink: true });
      discover('constellation');
      // it fades back after a while so it can be found again on another day
      later(() => { lit.clear(); conStars.forEach((s) => s.classList.remove('is-lit')); conLine.classList.remove('is-on'); }, 14000);
    }
  }));
  function layoutSky() {
    const band = skyBand();
    hearts.forEach(placeHeart);
    // the wish star: high on the right, just under the top edge
    place(wish, L.W * (L.portrait ? 0.84 : 0.9), Math.max(56, L.H * 0.08));
    // the constellation: in the sky beside the big lantern, on the side with more room
    const lr = lanternBox.getBoundingClientRect();
    const size = L.portrait ? Math.min(96, L.W * 0.24) : Math.min(140, L.H * 0.18);
    const left = lr.left - el.getBoundingClientRect().left;
    const cx = left > L.W - lr.right ? Math.max(size * 0.6, left / 2) : Math.min(L.W - size * 0.6, (lr.right + L.W) / 2);
    const cy = Math.min(band.bottom - size * 0.6, Math.max(band.top + size * 0.6, (band.top + band.bottom) / 2 + size * 0.2));
    const pts = CON.map(([u, v]) => [cx - size / 2 + u * size, cy - size / 2 + v * size]);
    conStars.forEach((b, i) => place(b, pts[i][0], pts[i][1]));
    conLine.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);
    const order = [0, 1, 2, 3, 4, 5, 0];
    conLine.innerHTML = `<path d="${order.map((k, j) => `${j ? 'L' : 'M'}${pts[k][0].toFixed(1)} ${pts[k][1].toFixed(1)}`).join('')}"/>`;
  }

  /* ---------------------------------------------------------------- the gift */
  let giftBusy = false;
  let giftOpen = false;
  const lid = gift.querySelector('.gw-lid');
  const glow = gift.querySelector('.gw-gift-light');
  const openGift = () => {
    if (giftBusy) return;
    giftBusy = true;
    const r = gift.getBoundingClientRect();
    girl?.look(r.left + r.width / 2, r.top);
    const tl = gsap.timeline({ onComplete: () => { giftBusy = false; giftOpen = true; } });
    tw(tl);
    if (!reduced) tl.to(gift, { rotation: -6, duration: 0.09, yoyo: true, repeat: 3, ease: 'sine.inOut', transformOrigin: '50% 90%' }).set(gift, { rotation: 0 });
    tl.to(lid, { y: -14, rotation: -14, duration: reduced ? 0.2 : 0.45, ease: 'back.out(2)', svgOrigin: '12 30' })
      .to(glow, { opacity: 1, duration: 0.5 }, '<')
      .add(() => {
        fx.sparkle(r.left + r.width / 2, r.top + r.height * 0.3, reduced ? 8 : 18, { spread: 50, pink: true });
        sfx('magic');
        girl?.react('delight');
        say(giftNote, { hold: 9000 });
      });
    gift.setAttribute('aria-label', 'The gift is open: close it');
  };
  const closeGift = () => {
    if (giftBusy || !giftOpen) return;
    giftBusy = true;
    tw(gsap.timeline({ onComplete: () => { giftBusy = false; giftOpen = false; } })
      .to(glow, { opacity: 0, duration: 0.4 })
      .to(lid, { y: 0, rotation: 0, duration: reduced ? 0.2 : 0.5, ease: 'power2.inOut', svgOrigin: '12 30' }, '<'));
    gift.setAttribute('aria-label', 'A little gift floating on the lake: open it');
    hideNote();
  };
  on(gift, 'click', () => (giftOpen ? closeGift() : openGift()));
  on(gift, 'pointerenter', () => { if (!reduced && !giftBusy && !giftOpen) tw(gsap.fromTo(gift.querySelector('.gw-bow'), { rotation: 0 }, { rotation: 8, duration: 0.18, yoyo: true, repeat: 1, svgOrigin: '32 22' })); });

  /* ---------------------------------------------------------------- the cupcake candle */
  const flame = cup.querySelector('.gw-cup-flame');
  const halo = cup.querySelector('.gw-cup-halo');
  const smoke = cup.querySelector('.gw-cup-smoke');
  let candleOut = false;
  on(cup, 'click', () => {
    if (candleOut) return;
    candleOut = true;
    const r = cup.getBoundingClientRect();
    girl?.look(r.left + r.width / 2, r.top);
    sfx('candleOut');
    tw(gsap.to([flame, halo], { opacity: 0, scale: 0.4, svgOrigin: '32 14', duration: 0.25, ease: 'power2.in' }));
    tw(gsap.fromTo(smoke, { opacity: 0.8, y: 0 }, { opacity: 0, y: -8, duration: 1.6, ease: 'sine.out' }));
    cup.setAttribute('aria-label', 'The candle is out (it will relight)');
    later(() => {
      if (disposed) return;
      tw(gsap.to([flame, halo], { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out', svgOrigin: '32 14' }));
      fx.sparkle(r.left + r.width / 2, r.top + r.height * 0.15, 4, { spread: 14 });
      candleOut = false;
      cup.setAttribute('aria-label', 'A cupcake with one candle: blow it out');
    }, 2600);
  });

  /* ---------------------------------------------------------------- saying hi to her */
  let hiTaps = 0;
  on(hello, 'click', (e) => {
    girl?.look(e.clientX || 0, (e.clientY || 0) + 60);
    girl?.react(hiTaps % 2 ? 'smile' : 'surprise');
    hiTaps++;
    if (hiTaps === 3) discover('hello');
  });

  /* ---------------------------------------------------------------- butterflies */
  const nFly = reduced ? 1 : 2;
  const flyers = Array.from({ length: nFly }, (_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gw-fly';
    b.setAttribute('aria-label', 'A glowing butterfly');
    b.innerHTML = butterflySVG(i ? 285 : 195);
    root.appendChild(b);
    const f = { b, i, away: 0, x: 0, y: 0 };
    on(b, 'click', () => {
      if (f.away) return;
      const r = b.getBoundingClientRect();
      fx.sparkle(r.left + r.width / 2, r.top + r.height / 2, reduced ? 4 : 10, { spread: 30 });
      sfx('shimmer', { volume: 0.5 });
      girl?.look(r.left, r.top);
      f.away = performance.now();
      if (!found.has('butterfly')) discover('butterfly');
    });
    return f;
  });

  /* ---------------------------------------------------------------- fireflies (one canvas, a fixed pool) */
  const g2 = flies.getContext('2d');
  const nFire = reduced ? 6 : mobile ? 10 : 18;
  const fire = Array.from({ length: nFire }, (_, i) => ({ u: (i * 0.618) % 1, v: 0.55 + ((i * 0.37) % 0.42), ph: i * 1.3, sp: 0.4 + ((i * 0.29) % 0.5), x: 0, y: 0 }));
  let px = -1e4;
  let py = -1e4;
  on(el, 'pointermove', (e) => { const r = el.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top; }, { passive: true });

  /* ---------------------------------------------------------------- one loop for everything that moves */
  let raf = 0;
  let last = performance.now();
  let time = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (document.hidden) { last = now; return; }
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    time += dt * (reduced ? 0.25 : 1);
    const { W, H, hy } = L;
    // hearts: a slow float; on a pointer that comes close, they lean gently away
    for (const h of hearts) {
      if (!h.alive) continue;
      const fx0 = Math.sin(time * 0.5 + h.phase) * (reduced ? 2 : 10);
      const fy0 = Math.cos(time * 0.4 + h.phase * 1.3) * (reduced ? 2 : 8);
      const dx = h.x - px;
      const dy = h.y - py;
      const d = Math.hypot(dx, dy);
      const push = d < 110 && !reduced ? (1 - d / 110) * 22 : 0;
      h.ox += ((push ? (dx / d) * push : 0) - h.ox) * 0.08;
      h.oy += ((push ? (dy / d) * push : 0) - h.oy) * 0.08;
      h.b.style.transform = `translate3d(${(h.x + fx0 + h.ox).toFixed(1)}px, ${(h.y + fy0 + h.oy).toFixed(1)}px, 0) rotate(${(Math.sin(time * 0.6 + h.phase) * 8).toFixed(1)}deg)`;
    }
    // butterflies: figure-of-eight loops around the jetty, inside the frame; a tapped one spirals up and away
    const jr = jetty.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const jx = jr.left - er.left + jr.width / 2;
    const jy = jr.top - er.top + jr.height * 0.35;
    for (const f of flyers) {
      let x;
      let y;
      if (reduced) {
        x = jx + (f.i ? 1 : -1) * jr.width * 0.42;
        y = jy - jr.height * 0.1;
      } else {
        const s = time * (0.45 + f.i * 0.12) + f.i * 2.4;
        x = jx + Math.sin(s) * jr.width * (0.75 + f.i * 0.15);
        y = jy - jr.height * 0.25 + Math.sin(s * 2) * jr.height * 0.18;
      }
      if (f.away) {
        const k = (now - f.away) / 1000;
        if (k > 9) f.away = 0;
        else {
          const out = Math.min(1, k / 1.6) * (k < 6 ? 1 : Math.max(0, 1 - (k - 6) / 3));
          x += Math.sin(k * 5) * 30 * out + out * W * 0.25 * (f.i ? 1 : -1);
          y -= out * H * 0.3;
        }
      }
      x = Math.max(16, Math.min(W - 16, x));
      y = Math.max(hy * 0.6, Math.min(H - 16, y));
      f.b.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
    // fireflies: low over the water, a slow wander, drawn softly toward a nearby pointer
    const sc = flies.width / Math.max(1, W);
    g2.clearRect(0, 0, flies.width, flies.height);
    for (const p of fire) {
      const bx = p.u * W + Math.sin(time * p.sp + p.ph) * 26;
      const by = hy + (H - hy) * (p.v - 0.5) + Math.cos(time * p.sp * 0.8 + p.ph) * 14;
      const dx = px - bx;
      const dy = py - by;
      const d = Math.hypot(dx, dy);
      const pull = d < 160 && !reduced ? (1 - d / 160) * 0.35 : 0;
      p.x = bx + dx * pull;
      p.y = by + dy * pull;
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 2.1 + p.ph * 3));
      const r = 7 * sc;
      const grd = g2.createRadialGradient(p.x * sc, p.y * sc, 0, p.x * sc, p.y * sc, r);
      grd.addColorStop(0, `rgba(255,236,170,${(0.9 * a).toFixed(3)})`);
      grd.addColorStop(0.35, `rgba(255,190,90,${(0.35 * a).toFixed(3)})`);
      grd.addColorStop(1, 'rgba(255,170,70,0)');
      g2.fillStyle = grd;
      g2.beginPath();
      g2.arc(p.x * sc, p.y * sc, r, 0, Math.PI * 2);
      g2.fill();
    }
  };

  /* ---------------------------------------------------------------- start */
  layout();
  const onResize = () => { cancelAnimationFrame(rzId); rzId = requestAnimationFrame(layout); };
  let rzId = 0;
  on(window, 'resize', onResize);
  on(window, 'keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!panel.hidden) togglePanel(false);
    else if (giftOpen) closeGift();
    else hideNote();
  });
  raf = requestAnimationFrame(loop);
  tw(gsap.fromTo([...sky.children, gift, cup, ...flyers.map((f) => f.b), root.querySelector('.gw-bar')], { opacity: 0 }, { opacity: 1, duration: reduced ? 0.6 : 1.6, stagger: reduced ? 0 : 0.06, delay: reduced ? 0.6 : 2.2, ease: 'sine.out' }));
  if (!reduced) tw(gsap.to(gift, { y: -5, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' }));

  // her figurine: after the countdown is up and settled (never before), and only when the device can
  const ac = new AbortController();
  // (building her takes a moment of main-thread work, so it waits until the entrance has played and the
  // browser is idle — the countdown's own animation is never the one that stutters)
  let idleId = 0;
  const idle = (fn) => { if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(fn, { timeout: 2500 }); else fn(); };
  later(() => idle(() => {
    if (disposed) return;
    createGirl(jetty, { device, signal: ac.signal }).then((gl) => {
      if (disposed || !gl) { gl?.dispose(); return; }
      girl = gl;
      hello.hidden = false;
      showCount();
      tw(gsap.fromTo(gl.canvas, { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'sine.out' }));
      if (midnightDone) { const r = lanternBox.getBoundingClientRect(); gl.midnight(r.left + r.width / 2, r.top + r.height / 2); }
    }).catch((err) => console.warn('[gate] figure', err));
  }), reduced ? 1500 : 4400);

  return {
    /** a minute went by: the countdown's glass breathes once */
    pulse(countEl) {
      if (reduced || !countEl) return;
      tw(gsap.fromTo(countEl, { '--pulse': 0 }, { '--pulse': 1, duration: 0.6, yoyo: true, repeat: 1, ease: 'sine.inOut' }));
    },
    /** midnight: she looks up and reaches for the lantern, the candle glows, the hearts burst */
    midnight() {
      if (midnightDone) return;
      midnightDone = true;
      hideNote();
      panel.hidden = true;
      help.setAttribute('aria-expanded', 'false');
      const r = lanternBox.getBoundingClientRect();
      girl?.midnight(r.left + r.width / 2, r.top + r.height / 2);
      cup.classList.add('is-midnight');
      if (candleOut) tw(gsap.to([flame, halo], { opacity: 1, scale: 1, duration: 0.6, svgOrigin: '32 14' }));
      hearts.forEach((h, i) => later(() => { if (h.alive) popHeart(h); }, 300 + i * 180));
    },
    get girl() { return girl; },
    dispose() {
      disposed = true;
      ac.abort();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(rzId);
      if (idleId && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      clearTimeout(noteTimer);
      timers.forEach(clearTimeout);
      offs.forEach((f) => f());
      tweens.forEach((x) => x && x.kill());
      girl?.dispose();
      girl = null;
      root.remove();
    },
  };
}
