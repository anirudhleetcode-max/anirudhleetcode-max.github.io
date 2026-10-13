// The Keepsake Box: little things to open after the film, each in its own room (assets/js/keepsakes/<id>.js).
// A dialog over the chapter behind it, like the album: ✕ or Escape closes it, Tab stays inside, focus returns
// to where it was. Inside a room, Escape, “Back to the box” or the browser's Back return to the box.
//
// Which rooms are there, and their words: shared/keepsakes.js (nothing personal is ever made up: a room that
// needs the owner's own words stays out of the box until they are written).
//
// A room module:  export default { open(api, el) → cleanup? }   (see roomApi() below for `api`)
//   • build everything inside `el`; listen for keys on elements inside it, never on window
//   • stop everything (timers, frames, sounds) when api.signal aborts or in the cleanup it returns
//   • honour api.reduced (no drifting, no flying: things simply appear)
import { esc } from './art.js';
import { KEEPSAKE_ROOMS, KEEPSAKE_TEXT, wordsFor, playingRooms, roomInfo, writtenItems, writtenMemories, metCards, memoryTitle, quizQuestions, monthDoors, localDay } from '../shared/keepsakes.js';
import { SECRETS } from './eggs.js';

/* ---------------- colour worlds (this browser only) ---------------- */
export const WORLDS = [
  { id: 'night', label: 'Night' },
  { id: 'paper', label: 'Paper' },
  { id: 'dawn', label: 'Dawn' },
  { id: 'garden', label: 'Garden' },
];
const WORLD_KEY = 'deepu-box-world';
const readWorld = () => { try { const v = localStorage.getItem(WORLD_KEY); return WORLDS.some((w) => w.id === v) ? v : 'night'; } catch { return 'night'; } };
const writeWorld = (v) => { try { if (v === 'night') localStorage.removeItem(WORLD_KEY); else localStorage.setItem(WORLD_KEY, v); } catch { /* storage unavailable */ } };

/* ---------------- styles, loaded with the box (never on the film's first paint) ---------------- */
const loadedCss = new Map();
function loadCss(name) {
  if (loadedCss.has(name)) return loadedCss.get(name);
  const p = new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL(`../../css/keepsakes/${name}.css`, import.meta.url).href;
    const done = () => resolve();
    link.addEventListener('load', done, { once: true });
    link.addEventListener('error', done, { once: true }); // a missing sheet never holds the room back
    setTimeout(done, 2500);
    document.head.appendChild(link);
  });
  loadedCss.set(name, p);
  return p;
}

/* ---------------- the little icons on the room tiles (stroke drawings, no fills to theme) ---------------- */
const ICONS = {
  book: '<path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"/><path d="M12 6v13.5"/>',
  star: '<path d="M12 3.5l2.4 5.2 5.6.6-4.2 3.8 1.2 5.5L12 15.8l-5 2.8 1.2-5.5L4 9.3l5.6-.6z"/>',
  heartless: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  lantern: '<path d="M9 4h6M10 4v2M14 4v2"/><path d="M7.5 9c0-1.7 2-3 4.5-3s4.5 1.3 4.5 3v6c0 1.7-2 3-4.5 3s-4.5-1.3-4.5-3z"/><path d="M10 18v2h4v-2"/><path d="M12 10.5c-.9 1-.9 2.2 0 3 .9-.8.9-2 0-3z"/>',
  flower: '<circle cx="12" cy="10" r="2"/><path d="M12 8c-1-2.6.2-4.5 0-4.5S13 5.4 12 8zM14 10c2.6-1 4.5.2 4.5 0S16.6 11 14 10zM12 12c1 2.6-.2 4.5 0 4.5S11 14.6 12 12zM10 10c-2.6 1-4.5-.2-4.5 0S7.4 9 10 10z"/><path d="M12 16.5V21M12 19c1.5-1.4 3-1.6 4-1"/>',
  wall: '<rect x="3.5" y="4" width="7" height="7" rx="1"/><rect x="13.5" y="4" width="7" height="5" rx="1"/><rect x="3.5" y="13" width="7" height="7" rx="1"/><rect x="13.5" y="11" width="7" height="9" rx="1"/>',
  note: '<path d="M6 3.5h9l3 3v14H6z"/><path d="M15 3.5v3h3M9 11h6M9 14h6M9 17h4"/>',
  pin: '<path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5c0 2.5 1.2 4 3.3 4.4M16 6h3c0 2.5-1.2 4-3.3 4.4M12 13v3.5M9 20h6M10 16.5h4V20h-4z"/>',
  file: '<path d="M4 7h6l2 2h8v10H4z"/><path d="M4 7V5h5l2 2"/><circle cx="14.5" cy="14" r="2.3"/><path d="M16.2 15.7L18 17.5"/>',
  question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6"/><path d="M12 16.8v.2"/>',
  door: '<path d="M6 21V5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 5v16"/><path d="M4 21h16"/><circle cx="14.6" cy="12.5" r=".8"/>',
  envelope: '<rect x="3.5" y="6" width="17" height="12" rx="1.5"/><path d="M4 7l8 6 8-6"/>',
  wave: '<path d="M4 12h1.5M7.5 8.5v7M10.5 5.5v13M13.5 8v8M16.5 10v4M19.5 11.2v1.6"/>',
  ticket: '<path d="M3.5 8a2 2 0 0 0 0 4v4h17v-4a2 2 0 0 1 0-4V4h-17z" transform="translate(0 2)"/><path d="M14 6v12" stroke-dasharray="1.6 1.8"/>',
  feather: '<path d="M19 5c-6 0-11 5-11 11v3"/><path d="M19 5c0 6-4.5 10-10 10M8 19l-3 2"/><path d="M12.5 8.5l2 2M10.6 11.4l2 2"/>',
  key: '<circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H20M17 12v3M19.5 12v2"/>',
};
const iconSvg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.star}</svg>`;

/** The rooms' code (each one lazy-loaded the first time it opens). */
const ROOM_CODE = {
  scrapbook: () => import('../keepsakes/scrapbook.js'),
  stars: () => import('../keepsakes/stars.js'),
  comfort: () => import('../keepsakes/comfort.js'),
  wish: () => import('../keepsakes/wish.js'),
  flower: () => import('../keepsakes/flower.js'),
  appreciation: () => import('../keepsakes/appreciation.js'),
  remember: () => import('../keepsakes/remember.js'),
  reminders: () => import('../keepsakes/reminders.js'),
  awards: () => import('../keepsakes/awards.js'),
  lore: () => import('../keepsakes/lore.js'),
  quiz: () => import('../keepsakes/quiz.js'),
  months: () => import('../keepsakes/months.js'),
  letters: () => import('../keepsakes/letters.js'),
  voice: () => import('../keepsakes/voice.js'),
  coupon: () => import('../keepsakes/coupon.js'),
  shy: () => import('../keepsakes/shy.js'),
  secret: () => import('../keepsakes/secret.js'),
};

/** Today, for the doors and the dated letters (a preview link may say `&today=YYYY-MM-DD` to test a date). */
function today(preview) {
  if (preview) {
    try { const d = localDay(new URLSearchParams(location.search).get('today')); if (d) return d; } catch { /* ignore */ }
  }
  return new Date();
}

/**
 * Open the box. ctx: the chapter's ctx (main.js makeCtx). Options:
 *   room     — open straight into this room (a preview link's &box=<room>)
 *   onClose  — the box closed itself (✕, Escape): main.js takes its history entry back
 *   step     — { push(), pop() }: a room is a history step (the browser's Back returns to the box)
 * Returns { close({fromHistory}), back() → true when a room was open and is now closed, el }.
 */
export function openKeepsakes(ctx, { room = null, onClose = null, step = null } = {}) {
  const { gsap, audio } = ctx;
  const site = ctx.site;
  const reduced = !!(ctx.device && ctx.device.reducedMotion);
  const preview = !!ctx.preview;
  const fill = (s) => String(ctx.fill(String(s ?? '')) || '').trim();
  const box = wordsFor(site, 'box');
  const rooms = playingRooms(site);
  const opener = document.activeElement;
  const ac = new AbortController();
  const onAbort = () => close({ fromHistory: true, quiet: true });
  ctx.signal.addEventListener('abort', onAbort, { once: true });

  const wrap = document.createElement('div');
  wrap.className = 'ks';
  wrap.dataset.world = readWorld();
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-labelledby', 'ks-title');
  wrap.tabIndex = -1;
  const worldChips = WORLDS.map((w) => `<button type="button" class="ks-world" data-world="${w.id}" aria-pressed="false"><i aria-hidden="true"></i>${esc(w.label)}</button>`).join('');
  wrap.innerHTML = `
    <div class="ks-panel" tabindex="-1">
      <div class="ks-head">
        <button type="button" class="ks-back" hidden><span aria-hidden="true">‹</span> ${esc(fill(box.back) || KEEPSAKE_TEXT.box.back)}</button>
        <div class="ks-titles">
          <p class="ks-kicker">${esc(fill(box.kicker))}</p>
          <h2 class="ks-title" id="ks-title">${esc(fill(box.title) || KEEPSAKE_TEXT.box.title)}</h2>
        </div>
        <button type="button" class="ks-close" aria-label="Close the keepsake box">✕</button>
      </div>
      <div class="ks-home">
        ${box.intro ? `<p class="ks-intro">${esc(fill(box.intro))}</p>` : ''}
        <ul class="ks-grid" role="list">
          ${rooms.map((r) => `<li><button type="button" class="ks-tile" data-room="${r.id}"><span class="ks-ic">${iconSvg(r.icon)}</span><span class="ks-tile-text"><span class="ks-tile-title">${esc(fill(wordsFor(site, r.id).title) || r.title)}</span><span class="ks-tile-line">${esc(r.line)}</span></span></button></li>`).join('')}
        </ul>
        <div class="ks-settings">
          <div class="ks-set" role="group" aria-labelledby="ks-world-label">
            <p class="ks-set-label" id="ks-world-label">Colour world <span class="ks-set-note">(this device only)</span></p>
            <div class="ks-worlds">${worldChips}<button type="button" class="ks-world-reset">Reset</button></div>
          </div>
          <div class="ks-set ks-sound" role="group" aria-labelledby="ks-sound-label">
            <p class="ks-set-label" id="ks-sound-label">Sound</p>
            <div class="ks-sound-row">
              <button type="button" class="ks-sound-btn"></button>
              <label class="ks-vol-wrap"><span class="sr-only">Volume</span><input type="range" class="ks-vol" min="0" max="100" step="5"></label>
              <span class="ks-sound-status" aria-live="polite"></span>
            </div>
          </div>
        </div>
      </div>
      <div class="ks-room-host" hidden></div>
      <p class="ks-live sr-only" aria-live="polite"></p>
    </div>`;
  document.getElementById('ui').appendChild(wrap);
  const panel = wrap.querySelector('.ks-panel');
  const home = wrap.querySelector('.ks-home');
  const host = wrap.querySelector('.ks-room-host');
  const backBtn = wrap.querySelector('.ks-back');
  const titleEl = wrap.querySelector('.ks-title');
  const kickerEl = wrap.querySelector('.ks-kicker');
  const live = wrap.querySelector('.ks-live');
  const announce = (msg) => { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); };
  // the sticky head covers the top of the panel's scroll area: anything scrolled into view (a control Tab lands
  // on, a room's own scrollIntoView) stops below it, never under it
  const headEl = wrap.querySelector('.ks-head');
  const padForHead = () => { panel.style.scrollPaddingTop = `${Math.ceil(headEl.offsetHeight) + 8}px`; };
  padForHead();
  const headRO = typeof ResizeObserver === 'function' ? new ResizeObserver(padForHead) : null;
  if (headRO) headRO.observe(headEl);

  // the box's own styles arrive with it: it fades in once they are here
  gsap.set(wrap, { opacity: 0 });
  loadCss('box').then(() => {
    if (closed) return;
    gsap.to(wrap, { opacity: 1, duration: reduced ? 0.2 : 0.5 });
    if (!reduced && !room) gsap.from(wrap.querySelectorAll('.ks-tile'), { opacity: 0, y: 16, duration: 0.6, stagger: 0.03, ease: 'power3.out', delay: 0.1 });
  });
  audio.sfx('pageTurn');

  /* ---- colour world ---- */
  const syncWorld = () => wrap.querySelectorAll('.ks-world').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.world === wrap.dataset.world)));
  syncWorld();
  wrap.querySelector('.ks-worlds').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const w = b.classList.contains('ks-world-reset') ? 'night' : b.dataset.world;
    wrap.dataset.world = w;
    writeWorld(w);
    syncWorld();
    announce(`Colour world: ${WORLDS.find((x) => x.id === w).label}`);
  });

  /* ---- sound: never starts by itself; volume and mute are remembered on this device ---- */
  const sound = ctx.sound;
  const soundBtn = wrap.querySelector('.ks-sound-btn');
  const vol = wrap.querySelector('.ks-vol');
  const status = wrap.querySelector('.ks-sound-status');
  const syncSound = () => {
    const started = sound.started;
    const muted = sound.muted;
    vol.value = String(Math.round(sound.volume * 100));
    vol.disabled = !started || muted;
    vol.setAttribute('aria-valuetext', `${vol.value} percent`);
    soundBtn.textContent = !started ? '▶ Play the music' : muted ? 'Sound off · turn on' : 'Sound on · turn off';
    soundBtn.dataset.state = !started ? 'off' : muted ? 'muted' : 'on';
    soundBtn.setAttribute('aria-pressed', String(started && !muted));
    const said = !started ? 'Off until you press play' : muted ? 'Muted' : `${vol.value}%`;
    if (status.textContent !== said) status.textContent = said; // (a live region: only real changes are read out)
  };
  // the button does what it said when she pressed it (a tap can start the film's sound on its way down)
  soundBtn.addEventListener('click', async () => {
    const was = soundBtn.dataset.state;
    if (was === 'off') await sound.start();
    else if ((was === 'muted') === sound.muted) sound.toggleMute();
    syncSound();
  });
  vol.addEventListener('input', () => { sound.setVolume(Number(vol.value) / 100); syncSound(); });
  syncSound();

  /* ---- rooms ---- */
  let current = null; // { id, cleanup, ac }
  let opening = 0;
  const roomApi = (id, rac) => {
    const words = wordsFor(site, id);
    const api = {
      id,
      site,
      text: words,
      /** The room's words, filled ({name}…); '' when the owner's line still needs an unwritten memory. */
      t: (key) => fill(words[key] != null ? words[key] : (KEEPSAKE_TEXT[id] || {})[key]),
      /** A list of lines, filled, empty ones left out. */
      list: (key) => (Array.isArray(words[key]) ? words[key] : []).map((s) => (typeof s === 'string' ? fill(s) : '')).filter(Boolean),
      fill,
      esc,
      gsap,
      audio,
      reduced,
      device: ctx.device,
      preview,
      signal: rac.signal,
      wait: (s) => new Promise((resolve, reject) => {
        if (rac.signal.aborted) { reject(new DOMException('room closed', 'AbortError')); return; }
        const tm = setTimeout(resolve, s * 1000);
        rac.signal.addEventListener('abort', () => { clearTimeout(tm); reject(new DOMException('room closed', 'AbortError')); }, { once: true });
      }),
      now: () => today(preview),
      photo: (pid) => { const p = ctx.photo(pid); return p && !p.isPlaceholder ? p : null; },
      photos: (chapter) => ctx.photos(chapter).filter((p) => !p.isPlaceholder),
      realPhotos: () => ctx.realPhotos(),
      photoSrc: ctx.photoSrc,
      /** Her memories with words (How it began): [{ id, kind, when, title, text, name, photos: [photo] }]. */
      memories: () => writtenMemories(site).map((m) => ({
        id: m.id, kind: m.kind || 'moment', when: fill(m.when), title: fill(m.title), text: fill(m.text), name: fill(memoryTitle(m)),
        photos: ctx.photos('story').filter((p) => !p.isPlaceholder && p.memory === m.id),
      })),
      metCards: () => metCards(site),
      items: () => writtenItems(site, id),
      quiz: () => quizQuestions(site),
      doors: () => monthDoors(site),
      localDay,
      media: (key) => ctx.media(key),
      eggs: ctx.eggs,
      secrets: SECRETS,
      herName: (site.her && site.her.name) || '',
      nicknames: (Array.isArray(site.her?.nicknames) ? site.her.nicknames : []).filter((n) => typeof n === 'string' && n.trim()),
      daysAlive: () => ctx.daysAlive(),
      announce,
      back: () => closeRoom(),
      setTitle: (s) => { titleEl.textContent = s; },
    };
    return api;
  };

  async function openRoom(id, { pushStep = true } = {}) {
    if (closed || !ROOM_CODE[id] || !rooms.some((r) => r.id === id)) return;
    const my = ++opening;
    let mod;
    try {
      // a room that didn't arrive is asked for again at a fresh address (a browser remembers a failed module
      // for the page's lifetime, so the same address would fail at once — the same rule as the film's chapters)
      const code = () => ROOM_CODE[id]().catch(() => import(new URL(`../keepsakes/${id}.js?retry=${Date.now()}`, import.meta.url).href)
        .then((m) => { ROOM_CODE[id] = () => Promise.resolve(m); return m; }));
      [mod] = await Promise.all([code(), loadCss(id)]);
    } catch (err) {
      console.warn('[keepsakes] a room did not arrive', id, err);
      if (my === opening && !closed) announce('That one didn’t open. The connection may have dropped; try again in a moment.');
      return;
    }
    if (my !== opening || closed) return;
    if (current) closeRoom({ fromHistory: true, silent: true });
    const rac = new AbortController();
    host.replaceChildren();
    const el = document.createElement('div');
    el.className = `ks-room ks-room-${id}`;
    host.appendChild(el);
    home.hidden = true;
    host.hidden = false;
    backBtn.hidden = false;
    wrap.classList.add('in-room');
    const info = roomInfo(id);
    titleEl.textContent = fill(wordsFor(site, id).title) || info.title;
    kickerEl.textContent = fill(box.title) || KEEPSAKE_TEXT.box.title;
    panel.scrollTop = 0;
    let cleanup = null;
    current = { id, ac: rac, cleanup: null };
    if (pushStep && step) step.push();
    current.stepped = !!(pushStep && step);
    try {
      cleanup = (mod.default || mod).open(roomApi(id, rac), el);
    } catch (err) {
      console.error('[keepsakes] room failed', id, err);
      el.innerHTML = '<p class="ks-empty">This one didn’t open properly. Try another for now.</p>';
    }
    current.cleanup = typeof cleanup === 'function' ? cleanup : null;
    if (!reduced) gsap.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
    audio.sfx('tap');
    // focus: the room's own first control, else its first heading, else the Back button
    setTimeout(() => {
      if (!current || current.id !== id) return;
      const f = el.querySelector('[data-autofocus]') || backBtn;
      f.focus({ preventScroll: true });
    }, 60);
  }

  /** Back to the box. fromHistory: the browser's Back already took the step's history entry. */
  function closeRoom({ fromHistory = false, silent = false } = {}) {
    if (!current) return false;
    const { id, ac: rac, cleanup, stepped } = current;
    current = null;
    rac.abort();
    try { cleanup && cleanup(); } catch (err) { console.warn('[keepsakes] cleanup', err); }
    if (stepped && !fromHistory && step) step.pop();
    if (silent) return true;
    host.replaceChildren();
    host.hidden = true;
    home.hidden = false;
    backBtn.hidden = true;
    wrap.classList.remove('in-room');
    titleEl.textContent = fill(box.title) || KEEPSAKE_TEXT.box.title;
    kickerEl.textContent = fill(box.kicker);
    syncSound();
    const tile = wrap.querySelector(`.ks-tile[data-room="${id}"]`);
    if (tile) tile.focus({ preventScroll: true });
    return true;
  }

  wrap.addEventListener('click', (e) => {
    const tile = e.target.closest('.ks-tile');
    if (tile) { openRoom(tile.dataset.room); return; }
    if (e.target.closest('.ks-back')) { closeRoom(); return; }
    if (e.target.closest('.ks-close')) { close(); return; }
    if (e.target === wrap) close(); // a tap on the dim space around the panel
  });

  /* ---- keys: inside the box, nothing reaches the film behind it ---- */
  const focusables = () => [...wrap.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')]
    .filter((x) => !x.disabled && !x.closest('[hidden]') && x.getClientRects().length);
  const onBoxKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (e.target.closest && e.target.closest('[data-own-escape]')) return; // a room's own open thing (a photo) closes first
      // focus elsewhere (the header's Back or ✕) while a room's inner layer is open: that layer still closes first
      const inner = current && [...host.querySelectorAll('[data-own-escape]')].find((x) => x.getClientRects().length && !x.closest('[hidden]'));
      if (inner) { inner.focus({ preventScroll: true }); inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return; }
      if (current) closeRoom(); else close();
      return;
    }
    if (e.key === 'Tab') {
      const f = focusables();
      if (f.length) {
        const a = document.activeElement;
        let i = f.indexOf(a);
        // focus on something that isn't a tab stop (a room's heading, the panel itself): Tab goes on from
        // where it is in the page, to the next (or previous) control after it — not back to the first one
        if (i < 0 && a && wrap.contains(a)) {
          const after = f.findIndex((x) => a.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
          const target = e.shiftKey ? (after < 0 ? f[f.length - 1] : f[after - 1] || f[f.length - 1]) : (after < 0 ? f[0] : f[after]);
          e.preventDefault();
          target.focus();
        } else if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
      }
    }
    // M still mutes from anywhere but a text box; nothing else reaches the film's own keys
    const typing = e.target.closest && e.target.closest('input[type="text"], input:not([type]), textarea, [contenteditable="true"]');
    if ((e.key === 'm' || e.key === 'M') && !typing) { setTimeout(syncSound, 0); return; }
    e.stopPropagation();
  };
  wrap.addEventListener('keydown', onBoxKey);
  // a key pressed while focus is outside the box (a tap on empty space): back inside, never the film's Continue
  const onStray = (e) => {
    if (closed || wrap.contains(e.target)) return;
    if (['Enter', ' ', 'Spacebar', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Escape', 'Tab'].includes(e.key)) {
      e.stopPropagation();
      e.preventDefault();
      if (e.key === 'Escape') { if (current) closeRoom(); else close(); return; }
      (current ? backBtn : wrap.querySelector('.ks-close')).focus({ preventScroll: true });
    }
  };
  window.addEventListener('keydown', onStray, true);

  let closed = false;
  function close({ fromHistory = false, quiet = false } = {}) {
    if (closed) return;
    // a room still open: its history step goes with the box (main.js takes the entries back)
    const hadStep = !!(current && current.stepped);
    if (current) closeRoom({ fromHistory: true, silent: true });
    closed = true;
    ac.abort();
    ctx.signal.removeEventListener('abort', onAbort);
    window.removeEventListener('keydown', onStray, true);
    if (headRO) headRO.disconnect();
    if (quiet) { wrap.remove(); return; }
    gsap.to(wrap, { opacity: 0, duration: reduced ? 0.15 : 0.4, onComplete: () => wrap.remove() });
    if (opener && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
    if (!fromHistory && onClose) onClose({ steps: hadStep ? 2 : 1 });
  }

  setTimeout(() => { if (!closed && !room) (wrap.querySelector('.ks-tile') || wrap.querySelector('.ks-close')).focus({ preventScroll: true }); }, 60);
  if (room) openRoom(room);

  return {
    close,
    /** The browser's Back while a room is open: back to the box (true); false when the box itself should close. */
    back: () => (current ? closeRoom({ fromHistory: true }) : false),
    open: (id) => openRoom(id),
    get room() { return current ? current.id : null; },
    el: wrap,
  };
}

export { KEEPSAKE_ROOMS };
