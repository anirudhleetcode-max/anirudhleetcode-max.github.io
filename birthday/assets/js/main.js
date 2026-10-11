// The projector: loads the story, runs chapters in order, and hands every
// chapter a shared `ctx` (photos, words, audio, effects, subtitles…).
// See docs/ARCHITECTURE.md for the full contract.
import { loadSite, preload, pickSrc } from './core/data.js';
import { createFX } from './core/fx.js';
import { createUI, sleep } from './core/ui.js';
import { transition } from './core/transitions.js';
import { createEggs } from './core/eggs.js';
import { fillText, personalValues } from './shared/model.js';
import { setRibbonGlow } from './core/ribbon.js';
import { registerEases } from './core/motion.js';
import { attachCamera } from './core/camera.js';

// The film never needs the admin's GitHub token. A preview tab the admin opens starts with a copy of the
// admin tab's sessionStorage (where a token "not remembered on this device" lives), and that copy would
// outlive the admin tab and "Forget token": drop it here, before anything else runs.
try { sessionStorage.removeItem('deepu-admin-token'); } catch { /* storage unavailable */ }

/** The fan-art photoshoot plays only with the owner's own finished image (never a generated face). */
const hasFanArt = (store) => store.photos('fanart').some((p) => !p.isPlaceholder) || (!!window.__LITTLE_DEV__ && /[?&]fanart=test\b/.test(location.search));

const params = new URLSearchParams(location.search);
const PREVIEW = params.has('preview') || params.has('draft');
const DRAFT = params.has('draft');
const START_AT = params.get('scene');

const gsap = window.gsap;
gsap.registerPlugin(CustomEase, DrawSVGPlugin, MotionPathPlugin, SplitText, Physics2DPlugin);
CustomEase.create('film', '0.65,0,0.35,1');
CustomEase.create('drift', '0.25,0.1,0.25,1');
registerEases(CustomEase); // 'cine' and 'settle' (core/motion.js)

/* ---------------- device & quality ---------------- */
const ua = navigator.userAgent;
const coarse = matchMedia('(pointer: coarse)').matches;
const mobile = coarse || /Android|iPhone|iPad|iPod/i.test(ua);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('reduced');
const lowPower = params.has('low') || (mobile && ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3));
const device = {
  mobile,
  lowPower,
  reducedMotion,
  /** 'low' | 'mid' | 'high' — scale particles, shadows, post effects by this. */
  tier: lowPower ? 'low' : mobile ? 'mid' : 'high',
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  get portrait() { return window.innerHeight > window.innerWidth; },
};
const root = document.documentElement;
root.classList.toggle('is-mobile', mobile);
root.classList.toggle('low-power', lowPower);
root.classList.toggle('reduced-motion', reducedMotion);
if (reducedMotion) gsap.globalTimeline.timeScale(1); // scenes shorten their own motion

/* ---------------- chapters (story order) ----------------
   via   — the film transition INTO this chapter (see core/transitions.js)
   grade — the whole-film colour grade while this chapter plays
   mood  — suggested music mood on entry (chapters may refine it)          */
/** About how wide a festival card is on this screen (the same rule as dance.js's card layout). */
// the letter's pinned polaroids: sizes="(max-width: 700px) 42vw, 240px" (scenes/letter.js)
const letterSlot = (w) => (w <= 700 ? w * 0.42 : 240);
const danceSlot = (w, h) => (h > w ? Math.min(w * 0.37, h * 0.19, 230) : Math.min(w * 0.135, h * 0.23, 260));

const CHAPTERS = [
  { id: 'invite', title: 'The Invitation', load: () => import('./scenes/invite.js'), nav: false, via: 'fade', grade: 'night' },
  { id: 'prologue', title: 'Once Upon a Deepu', load: () => import('./scenes/prologue.js'), via: 'lantern', grade: 'dawn', preload: ['prologue'] },
  { id: 'tower', title: 'A Tower Full of You', load: () => import('./scenes/tower.js'), via: 'sun', grade: 'day', preload: ['tower'] },
  { id: 'story', title: 'How It Began', load: () => import('./scenes/story.js'), via: 'ribbon', grade: 'day', preload: ['story'], slot: (w, h) => Math.min(w, h) * 0.5 },
  { id: 'hair', title: 'The Golden Thread', load: () => import('./scenes/hair.js'), via: 'glow', grade: 'sunset', preload: ['hair'], slot: (w, h) => (h >= w ? w * 0.56 : w * 0.18) },
  { id: 'names', title: 'A Legend of Many Names', load: () => import('./scenes/names.js'), via: 'ember', grade: 'sunset', preload: ['names'] },
  { id: 'dance', title: 'Somewhere Between Chaos and Magic', load: () => import('./scenes/dance.js'), via: 'petals', grade: 'twilight', preload: ['dance'], slot: danceSlot },
  { id: 'lanterns', title: 'The Night of Lanterns', load: () => import('./scenes/lanterns.js'), via: 'lantern', grade: 'night', preload: ['lanterns'] },
  { id: 'letter', title: 'A Letter You Were Supposed to Read', load: () => import('./scenes/letter.js'), via: 'ember', grade: 'candle', preload: ['letter'], slot: letterSlot },
  // three of the little things she loves, as 3D moments (each switchable in admin → Theme)
  { id: 'little', title: 'The Little Things', load: () => import('./scenes/little.js'), via: 'dust', grade: 'night', preload: ['story'], slot: () => 640, when: (s) => ['keychains', 'sprite', 'twinklingWatermelon'].some((k) => s.site?.settings?.theme?.[k] !== false) },
  // the rest of her favourite things (pani puri, Manchuria, a fan-art photoshoot), then everything together
  // (the photoshoot needs the owner's finished fan-art image: Photos → Fan art; dev tests: &fanart=test)
  { id: 'favourites', title: 'What Makes You, You', load: () => import('./scenes/favourites.js'), via: 'ribbon', grade: 'sunset', preload: ['story', 'finale', 'fanart'], slot: () => 640, when: (s) => ['panipuri', 'manchuria'].some((k) => s.site?.settings?.theme?.[k] !== false) || (s.site?.settings?.theme?.nivin !== false && hasFanArt(s)) },
  // her favourite things lead up to the twenty candles
  // (the ember carries the golden thread's light from the spiral of her favourite things to the cake)
  { id: 'cake', title: 'Twenty Candles', load: () => import('./scenes/cake.js'), via: 'ember', grade: 'candle' },
  { id: 'video', title: 'A Little Message', load: () => import('./scenes/video.js'), via: 'fade', grade: 'candle', when: (s) => !!s.media.video },
  { id: 'constellation', title: 'Every Little Piece of You', load: () => import('./scenes/constellation.js'), via: 'dust', grade: 'deep', preload: ['finale', 'album'] },
  { id: 'birthday', title: 'The Last Lantern', load: () => import('./scenes/birthday.js'), via: 'none', grade: 'golden' },
  { id: 'hug', title: 'The Friendship Trail', load: () => import('./scenes/hug.js'), via: 'ember', grade: 'golden' },
  { id: 'credits', title: 'Credits', load: () => import('./scenes/credits.js'), via: 'lantern', grade: 'deep' },
];

// the chapters with a "Chapter …" card, in film order (their numbers follow the chapters switched on)
const NUMBERED = new Set(['tower', 'story', 'hair', 'names', 'dance', 'lanterns', 'letter', 'little', 'favourites', 'cake', 'constellation']);
/** A chapter's name for the progress dots and screen readers: the owner's title (Messages), else the built-in one. */
const chapterName = (def) => {
  const own = app.fill && app.store ? String(app.fill(String(app.store.text?.[def.id]?.title || ''))).trim() : '';
  return own || def.title || def.id;
};

/* ---------------- grain texture ---------------- */
function makeGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 180;
  const g = c.getContext('2d');
  const img = g.createImageData(180, 180);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  document.getElementById('grain').style.backgroundImage = `url(${c.toDataURL()})`;
}

/* ---------------- audio (with a silent fallback) ---------------- */
async function makeAudio(musicUrl) {
  try {
    const mod = await import('./core/audio.js');
    return mod.createAudio({ musicUrl });
  } catch (err) {
    console.warn('[audio] unavailable', err);
    const noop = () => {};
    return {
      unlock: async () => {}, startTheme: noop, setMood: noop, duck: noop, happyBirthday: async () => {}, endHappyBirthday: noop,
      sfx: noop, toggleMute: () => true, muted: true, setVolume: noop, context: null, stop: noop,
    };
  }
}

/* ---------------- app ---------------- */
const app = {
  store: null,
  audio: null,
  fx: null,
  ui: null,
  eggs: null,
  list: [],
  index: -1,
  current: null,
  seen: new Set(),
  busy: false,
  lbTarget: '0px',
  curtainClosed: false,
  handoff: null,
};

function letterbox(on) {
  const v = on === true ? (device.portrait ? '5.5vh' : '9vh') : on ? String(on) : '0px';
  app.lbTarget = v;
  if (!app.curtainClosed) root.style.setProperty('--lb', v);
}

/** The whole-film colour grade: night → dawn → day → sunset → twilight → night → candle → deep → golden. */
function setGrade(name) {
  const el = document.getElementById('grade');
  el.dataset.grade = name || 'night';
}

function preloadChapter(def) {
  if (!def || !def.preload) return;
  // chapters that show photos small fetch the copy their slot will actually use (`slot`: CSS px)
  const slot = def.slot ? def.slot(window.innerWidth, window.innerHeight) : 0;
  for (const ch of def.preload) for (const p of app.store.photos(ch)) preload(slot ? pickSrc(p, slot) : p.url);
}

function buildProgress() {
  const nav = document.getElementById('progress');
  nav.innerHTML = '';
  // On a phone, fifteen dots can't each be a comfortable touch target (that would take ~600 px),
  // so there they're only a quiet progress indicator. With a mouse or keyboard, a seen dot is a
  // button that jumps back to its chapter.
  const indicator = device.mobile;
  nav.classList.toggle('is-indicator', indicator);
  if (indicator) nav.setAttribute('aria-hidden', 'true');
  app.list.forEach((def, i) => {
    if (def.nav === false) return;
    if (indicator) {
      const d = document.createElement('i');
      d.dataset.i = i;
      nav.appendChild(d);
      return;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.i = i;
    b.setAttribute('aria-label', chapterName(def));
    b.title = chapterName(def);
    b.disabled = true;
    b.addEventListener('click', () => {
      if (!b.disabled && i !== app.index && !app.busy) goTo(i);
    });
    nav.appendChild(b);
  });
}

function updateProgress() {
  const nav = document.getElementById('progress');
  nav.classList.toggle('on', app.index > 0 && app.list[app.index]?.nav !== false);
  nav.querySelectorAll('[data-i]').forEach((b) => {
    const i = Number(b.dataset.i);
    b.classList.toggle('now', i === app.index);
    b.classList.toggle('seen', app.seen.has(i));
    if (b.tagName === 'BUTTON') b.disabled = !app.seen.has(i);
    if (i === app.index) b.setAttribute('aria-current', 'step');
    else b.removeAttribute('aria-current');
  });
}

function makeCtx(def, ac, incoming) {
  const { store, audio, fx, ui, eggs } = app;
  let nexted = false;
  const ctx = {
    id: def.id,
    title: def.title,
    site: store.site,
    text: store.text,
    store,
    // photos — always data-driven; never hard-code ids in chapters
    photos: (chapter, opts) => store.photos(chapter, opts),
    chapter: (name) => store.photos(name),
    photo: (id) => store.photo(id),
    role: (role) => store.role(role),
    featured: () => store.featured(),
    heroHair: () => store.heroHair(),
    extras: () => store.extras(),
    allPhotos: () => store.all(),
    realPhotos: () => store.real(),
    media: (key) => store.mediaUrl(key),
    daysAlive: (when) => store.daysAlive(when),
    /** Replace {name} {nick1} {nick2} {creator} {photoCount} {days} {age} (+ the owner's memories) in owner-written text; '' = leave the line out. */
    fill: (str) => app.fill(str),
    preload,
    /** The copy of a photo a slot `cssWidth` px wide will load (thumbnail or full). */
    photoSrc: (p, cssWidth) => pickSrc(p, cssWidth),
    gsap,
    audio,
    fx,
    ui,
    eggs,
    device,
    theme: store.site.settings.theme || {},
    signal: ac.signal,
    /** Where the previous chapter's light ended ({x, y, color, kind, from}) — for seamless 'none' transitions. */
    incoming: incoming || null,
    wait: (s) => sleep(s, ac.signal),
    letterbox,
    grade: setGrade,
    /** Tell the next transition where the light should come from (continuity). */
    handoff(info) { app.handoff = { ...(info || {}), from: def.id }; },
    next(info) {
      if (nexted || ac.signal.aborted) return;
      nexted = true;
      if (info) ctx.handoff(info);
      goTo(app.index + 1);
    },
    restart() { goTo(app.list.findIndex((c) => c.id === 'prologue')); },
    immersive: requestImmersive,
    startSound: () => app.startSound(),
  };
  ctx.openGallery = async (opts) => (await import('./scenes/gallery.js')).openGallery(ctx, opts);
  return ctx;
}

async function goTo(index, { instant = false } = {}) {
  if (index < 0 || index >= app.list.length || app.busy) return;
  app.busy = true;
  const def = app.list[index];
  let mod;
  try {
    mod = (await def.load()).default;
  } catch (err) {
    console.error(`[scene] failed to load ${def.id}`, err);
    app.busy = false;
    if (index + 1 < app.list.length) return goTo(index + 1, { instant });
    return;
  }

  const handoff = app.handoff;
  app.handoff = null;
  // ctx.revealed: resolves once the incoming transition has finished revealing the chapter (at once for an
  // instant or 'none' swap) — a chapter with heavy work (the 3D chapters' warm-up) holds it until then
  let onRevealed;
  const revealed = new Promise((r) => { onRevealed = r; });
  const swap = async () => {
    const prev = app.current;
    if (prev) {
      prev.ac.abort();
      prev.cam?.destroy();
      try { await prev.mod.exit?.(); } catch (e) { console.warn(e); }
      // nothing a chapter did to the music outlives it: a song still playing ends, a held duck lets go
      try { app.audio.endHappyBirthday?.(); app.audio.duck(1, 0); } catch { /* sound is optional */ }
      gsap.killTweensOf([prev.el, ...prev.el.querySelectorAll('*')]);
      prev.el.remove();
    }
    app.ui.reset();
    app.fx.clear();
    letterbox(false);
    setGrade(def.grade);
    const el = document.createElement('section');
    el.className = `scene scene-${def.id}`;
    el.setAttribute('aria-label', chapterName(def));
    document.getElementById('stage').appendChild(el);
    const ac = new AbortController();
    const ctx = makeCtx(def, ac, handoff);
    ctx.revealed = revealed;
    app.ui.setSignal(ac.signal);
    // the virtual camera: layers tagged .cam-layer get pointer parallax (desktop only)
    const cam = attachCamera(el, { device });
    app.current = { def, mod, el, ac, ctx, cam };
    app.index = index;
    app.seen.add(index);
    updateProgress();
    Promise.resolve()
      .then(() => mod.enter(ctx, el))
      .catch(async (err) => {
        if (err?.name === 'AbortError' || ac.signal.aborted) return;
        console.error(`[scene ${def.id}]`, err);
        // a chapter that breaks must never strand her: offer the way on to the next one
        try { await app.ui.waitContinue('Continue'); } catch { return; }
        ctx.next();
      });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await sleep(0.25);
    preloadChapter(app.list[index + 1]);
  };

  // the owner can switch the decorative golden ribbon off (admin → Theme)
  const via = def.via === 'ribbon' && app.store.site.settings.theme?.ribbon === false ? 'glow' : def.via;
  if (instant || via === 'none') {
    onRevealed();
    await swap();
  } else {
    if (via === 'curtain') app.curtainClosed = true;
    await transition(via || 'fade', async () => {
      await swap();
      app.curtainClosed = false;
    }, { get letterbox() { return app.lbTarget; }, handoff, to: def.id, device, audio: app.audio });
    if (via === 'curtain') root.style.setProperty('--lb', app.lbTarget);
    onRevealed();
  }
  app.busy = false;
}

let wakeLock = null;
async function requestImmersive() {
  try {
    if (device.mobile && root.requestFullscreen && !document.fullscreenElement) {
      await root.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch { /* not supported (iOS) — fine */ }
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && wakeLock?.released) {
          try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* ignore */ }
        }
      });
    }
  } catch { /* ignore */ }
}

function setupMute() {
  const btn = document.getElementById('mute');
  const sync = () => {
    btn.classList.toggle('muted', !!app.audio.muted);
    btn.setAttribute('aria-label', app.audio.muted ? 'Play music' : 'Mute music');
    btn.setAttribute('aria-pressed', app.audio.muted ? 'true' : 'false');
  };
  btn.addEventListener('click', () => { app.audio.toggleMute(); sync(); });
  sync();
  app.showMute = () => { btn.hidden = false; gsap.fromTo(btn, { opacity: 0 }, { opacity: 0.7, duration: 1 }); sync(); };
}

/** Type her name anywhere for a little secret. */
function setupKeyboardSecret() {
  let typed = '';
  const word = String(app.store.site.her?.name || 'deepu').toLowerCase().replace(/\s+/g, '');
  window.addEventListener('keydown', (e) => {
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-word.length);
    if (typed === word) {
      app.eggs.found('keyboard', `You typed the magic word. The sky noticed.`);
      const { W, H } = app.fx.size;
      for (let i = 0; i < 4; i++) setTimeout(() => app.fx.firework({ x: W * (0.2 + 0.2 * i), y: H * 0.25 }), i * 260);
    }
  });
}

function isLocked(site) {
  const lock = site.settings && site.settings.lock;
  if (!lock || !lock.enabled || PREVIEW) return false;
  const at = Date.parse(lock.unlockAt);
  return Number.isFinite(at) && Date.now() < at;
}

/** A photo that fails to load (moved, renamed, slow network) shows a soft golden frame, never a broken-image icon. */
const PHOTO_FALLBACK = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150"><defs><radialGradient id="g" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#7a4a78"/><stop offset="1" stop-color="#2c1736"/></radialGradient></defs><rect width="120" height="150" fill="url(#g)"/><circle cx="60" cy="62" r="13" fill="#f4c463" opacity=".85"/><g stroke="#f4c463" stroke-width="2" stroke-linecap="round" opacity=".55"><path d="M60 38v-8M60 94v8M36 62h-8M84 62h8M43 45l-6-6M77 45l6-6M43 79l-6 6M77 79l6 6"/></g></svg>')}`;
function guardImages() {
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.removeAttribute('srcset');
    img.src = PHOTO_FALLBACK;
    console.warn('[film] a photo could not be loaded:', img.currentSrc || '');
  }, true);
}

async function boot() {
  makeGrain();
  guardImages();
  try {
    app.store = await loadSite({ draft: DRAFT });
  } catch (err) {
    console.error(err);
    document.querySelector('.boot-text').textContent = 'Something went wrong loading the story. Please refresh.';
    return;
  }
  const { store } = app;
  const site = store.site;
  document.title = `For ${site.her?.name || 'you'}`;
  const theme = site.settings.theme || {};
  // the owner's Theme choices: a calmer film for everyone, and the golden thread's glow
  if (theme.calm && !device.reducedMotion) { device.reducedMotion = true; root.classList.add('reduced-motion'); }
  setRibbonGlow(theme.threadGlow ?? 1);
  root.style.setProperty('--grain', String(0.075 * (theme.grain ?? 0.6) / 0.6));

  app.audio = await makeAudio(store.mediaUrl('music'));
  app.fx = createFX({ dustCanvas: document.getElementById('dust'), fxCanvas: document.getElementById('fx'), device, density: theme.particles ?? 1 });
  app.ui = createUI({ audio: app.audio, reducedMotion: device.reducedMotion });
  app.eggs = createEggs({ audio: app.audio, fx: app.fx });
  // development only: the motion debug overlay, for preview links with &debug
  if (PREVIEW && params.has('debug')) import('./core/debug.js').then((m) => m.startDebug(app, device)).catch(() => {});
  const nick = (site.her?.nicknames || []).map((n) => String(n || '').trim()).filter(Boolean);
  const tokens = {
    name: site.her?.name || '',
    nick1: nick[1] || nick[0] || site.her?.name || '',
    nick2: nick[2] || nick[1] || site.her?.name || '',
    creator: site.from?.name || '',
    photoCount: String(store.real().length || store.all().length),
    days: store.daysAlive().toLocaleString('en-IN'),
    age: String(new Date(site.settings?.lock?.unlockAt || Date.now()).getFullYear() - Number(String(site.her?.birthDate || '2007').slice(0, 4))),
  };
  // a line that needs one of the owner's memories, not written yet, is left out ('' — or the [LABEL] in the
  // draft preview, so the owner can spot it; "Preview published" shows exactly what she will see)
  const personal = personalValues(site);
  app.fill = (str) => fillText(str, tokens, personal, { preview: DRAFT });
  app.ui.setFill(app.fill);
  // "Chapter Five" → the real position among the numbered chapters that are switched on
  const NUM = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
  app.ui.setKicker((kicker) => {
    const m = /^Chapter (\w+)/.exec(kicker);
    if (!m || !NUM.includes(m[1])) return kicker;
    const numbered = app.list.filter((c) => NUMBERED.has(c.id));
    const i = numbered.findIndex((c) => c.id === app.list[app.index]?.id);
    return i >= 0 && NUM[i + 1] ? kicker.replace(m[1], NUM[i + 1]) : kicker;
  });
  app.list = CHAPTERS.filter((c) => (!c.when || c.when(store)) && store.chapterEnabled(c.id));
  setupMute();
  setupKeyboardSecret();
  buildProgress();

  // fonts matter for the very first frame
  try { await Promise.race([document.fonts.ready, sleep(2.5)]); } catch { /* ignore */ }
  preloadChapter(app.list[1]);

  const bootEl = document.getElementById('boot');
  bootEl.classList.add('gone');
  setTimeout(() => bootEl.remove(), 1400);

  if (isLocked(site)) {
    const gate = { id: 'gate', title: 'Countdown', load: () => import('./scenes/gate.js'), nav: false, via: 'fade', grade: 'night' };
    app.list = [gate, ...app.list];
    buildProgress();
    return goTo(0, { instant: true });
  }

  if (START_AT && PREVIEW) {
    const i = app.list.findIndex((c) => c.id === START_AT);
    if (i > 0) {
      // jumping straight in (testing): unlock audio on first tap
      window.addEventListener('pointerdown', () => { app.startSound(); }, { once: true });
      return goTo(i, { instant: true });
    }
  }
  return goTo(0, { instant: true });
}

// exposed for the invite scene (first gesture unlocks sound) and for debugging
window.__film = app;
app.startSound = async () => {
  if (app.soundStarted) return;
  app.soundStarted = true;
  await app.audio.unlock();
  app.audio.startTheme();
  app.showMute && app.showMute();
};

boot();
