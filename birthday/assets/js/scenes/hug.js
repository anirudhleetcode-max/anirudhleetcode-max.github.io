// The Friendship Trail — the last chapter before the credits (its internal id stays 'hug' so
// saved words keep working). Platonic by design: this film is from her best friend.
//
// The light that bloomed at the end of the birthday chapter becomes the golden thread: it curls
// out of the bloom and lays a gentle trail across the screen through one small light per real
// memory (a tiny glyph by its kind — a knot, beads, a bus window, little notes — never their
// words), and stops just short of a last glowing point. Two cards stand side by side, shoulder
// to shoulder, both turned toward the trail's end: a real photo of her, and a hand-drawn card from
// her best friend (a keyring with three charms from The Little Things) — or, when the owner has
// one, a real photo of the two of them. A little keychain charm hangs from each card and swings.
// One tap (or Enter / Space) lights the last point, and it lights itself after a while: the light
// runs back along the trail lighting every memory, the charms jingle, a few clear-gold bubbles
// fizz up behind the cards and the scene turns warm. Then the closing lines, and the credits.
//
// Words: messages.json → "hug" (title, intro, hint, herCaption, meCaption, lines, final,
// replyLabel, replyMessage), each with a built-in fallback. Animation is transform / opacity only;
// every tween, timer and listener is tracked and removed in exit().
import { createRibbon, ribbonPaths, sampleSpline } from '../core/ribbon.js';
import { esc, sunEmblem, memoryGlyphSVG, charmSVG, keyringSketchSVG } from '../core/art.js';
import { memoriesOf, readsRomantic } from '../shared/model.js';

const DEFAULTS = {
  intro: ['This isn’t the end of the story.'],
  hint: 'Tap the last light',
  herCaption: '{name}',
  meCaption: '{creator}',
  lines: ['Some memories become chapters.', 'Some people become part of the story.', 'And some friends make ordinary days better.', 'Twenty years of {nick1}. One very special friendship.'],
  final: 'Happy 20th, {nick1}.',
  replyLabel: 'Reply on WhatsApp',
  replyMessage: 'I watched the whole thing. You’re ridiculous. Best friends at twenty: confirmed. ✋',
};
const KINDS = new Set(['beginning', 'daily', 'journey', 'sharing']);
const LIGHT = 64; // the last point's button (px): a comfortable touch target
const SAMPLES = 720;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);

/** Owner text with a built-in fallback: a missing or empty value plays the default. */
function words(T, key) {
  const v = T[key];
  if (Array.isArray(DEFAULTS[key])) {
    const list = Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim()) : [];
    return list.length ? list : DEFAULTS[key];
  }
  return typeof v === 'string' && v.trim() ? v : DEFAULTS[key];
}

/**
 * Where everything sits on this screen (px in the chapter's box): the trail clears the opening
 * line at the top, the cards sit between the trail and the subtitle band at the bottom.
 */
function geometry(W, H, count, reply) {
  const portrait = H > W;
  const band = (portrait ? 0.055 : 0.09) * H + 0.09 * H; // letterbox + #subtitles offset (main.css)
  const sub = clamp(0.054 * W, 21, 38); // .sub-line
  const big = clamp(0.08 * W, 28, 58); // .sub-line.big
  const topText = band + (portrait ? 2 : 1) * 1.32 * sub;
  const bottomText = H - band - (W >= 760 ? 1 : 2) * 1.32 * big - 10;
  const g = portrait
    ? { x0: 0.075, x1: 0.17, x2: 0.69, xf: 0.835, amp: 0.011, rise: 0.03, sag: 0.014 }
    : { x0: 0.115, x1: 0.215, x2: 0.655, xf: 0.775, amp: 0.014, rise: 0.034, sag: 0.018 };
  const y = Math.max(topText + (portrait ? 0.055 : 0.04) * H, (portrait ? 0.265 : 0.27) * H);
  // a gentle wave that rises a little toward the last point (the story goes on)
  const yAt = (fx) => y + g.amp * H * Math.sin(fx * Math.PI * 2.3 + 0.4) - g.rise * H * Math.max(0, (fx - g.x1) / (g.xf - g.x1)) ** 2;
  const span = (g.x2 - g.x1) * W;
  const m = Math.round(clamp(count > 1 ? (span / (count - 1)) * 0.72 : 40, 18, portrait ? 32 : 40));
  const lights = [];
  for (let i = 0; i < count; i++) {
    const fx = count === 1 ? (g.x1 + g.x2) / 2 : g.x1 + ((g.x2 - g.x1) * i) / (count - 1);
    lights.push({ x: fx * W, y: yAt(fx) });
  }
  const start = { x: g.x0 * W, y: yAt(g.x0) + 0.008 * H };
  const fin = { x: g.xf * W, y: yAt(g.xf) - 0.014 * H };
  // where the ember transition bloomed (core/transitions.js): the thread starts in that light
  const ember = { x: W * 0.5, y: H * (portrait ? 0.45 : 0.48) };
  // …and curls out to the left, coming round to where the trail begins
  const swoop = portrait
    ? [ember, { x: W * 0.3, y: H * 0.468 }, { x: W * 0.1, y: H * 0.42 }, { x: W * 0.042, y: H * 0.35 }]
    : [ember, { x: W * 0.33, y: H * 0.51 }, { x: W * 0.15, y: H * 0.46 }, { x: W * 0.082, y: H * 0.375 }];
  const mids = count ? lights : [0.38, 0.6].map((t) => { const fx = g.x1 + (g.x2 - g.x1) * t; return { x: fx * W, y: yAt(fx) }; });
  const pts = [...swoop, ...ribbonPaths.through([start, ...mids, fin], { sag: g.sag * H })];

  // arc-length samples of the very spline the ribbon draws, so fractions match its head
  const dense = sampleSpline(pts, SAMPLES);
  let L = 0;
  for (let i = 1; i < dense.length; i++) L += Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y);
  let from = 0;
  const frac = (p) => {
    let best = from;
    let bd = Infinity;
    for (let i = from; i < dense.length; i++) {
      const d = (dense[i].x - p.x) ** 2 + (dense[i].y - p.y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    from = best;
    return best / (dense.length - 1);
  };
  const f = { start: frac(start), lights: lights.map(frac), fin: 1 };
  f.stop = Math.max(f.lights[f.lights.length - 1] || f.start, 1 - (LIGHT * 0.5 + 6) / Math.max(L, 1));
  f.trail = L * (1 - f.start); // px of trail proper (start → last point)

  // the cards: as large as fits between the trail and the subtitles (charms hang below them);
  // on a phone the width is the limit, so the windows are a little taller (4:5)
  const ratio = portrait ? 1.25 : 1;
  const top = y + g.amp * H + g.sag * H + m / 2 + (portrait ? 0.03 : 0.022) * H;
  const bottom = bottomText - (reply ? 60 : 0);
  const avail = Math.max(120, bottom - top);
  const k = 0.21 + 0.86 * ratio + 0.28 + 0.14; // padding + window + charms + caption, per px of width
  const cw = Math.round(clamp(Math.min(W * (portrait ? 0.41 : 0.22), avail / k), 104, 330));
  const cap = Math.round(clamp(cw * 0.125, 16, 30));
  const cardH = (0.21 + 0.86 * ratio) * cw + 1.1 * cap; // .polaroid: 7% padding + window + caption
  const stackH = cardH + 0.28 * cw + (reply ? 60 : 0); // + the charms + the reply button
  const cardsTop = top + Math.max(0, (avail + (reply ? 60 : 0) - stackH) * (portrait ? 0.5 : 0.4));
  const gap = Math.round(clamp(cw * 0.075, 9, 20));
  return { W, H, portrait, ratio, ember, pts, dense, L, f, lights, start, fin, m, cw, cap, cardH, cardsTop, gap, topText };
}

export default {
  id: 'hug',
  title: 'The Friendship Trail',
  async enter(ctx, el) {
    const { gsap, ui, audio, fx, device } = ctx;
    const T = ctx.text.hug || {};
    const reduced = !!device.reducedMotion;
    const low = device.tier === 'low' || !!device.lowPower;
    const signal = ctx.signal;
    const fill = (s) => ctx.fill(s);

    /* ---------------- bookkeeping: every tween, timer and listener is released in exit() */
    const tweens = new Set();
    const cleanups = [];
    const ac = new AbortController();
    this.cleanup = cleanups;
    cleanups.push(() => ac.abort());
    cleanups.push(() => { tweens.forEach((t) => t.kill()); tweens.clear(); });
    const track = (t) => { tweens.add(t); return t; };
    const tw = (target, vars) => track(gsap.to(target, vars));
    const twFrom = (target, a, b) => track(gsap.fromTo(target, a, b));
    const later = (s, fn) => track(gsap.delayedCall(s, fn));
    const on = (target, type, fn, opts = {}) => target.addEventListener(type, fn, { ...opts, signal: ac.signal });
    const aborted = () => new DOMException('aborted', 'AbortError');
    /** A tween you can await; it rejects (and stops) when the chapter is left. */
    const play = (target, vars) => new Promise((resolve, reject) => {
      if (signal.aborted) { reject(aborted()); return; }
      const stop = () => { t.kill(); reject(aborted()); };
      const t = tw(target, { ...vars, onComplete: () => { signal.removeEventListener('abort', stop); resolve(); } });
      signal.addEventListener('abort', stop, { once: true });
    });
    const untilAbort = (p) => new Promise((resolve, reject) => {
      if (signal.aborted) { reject(aborted()); return; }
      const stop = () => reject(aborted());
      signal.addEventListener('abort', stop, { once: true });
      p.then((v) => { signal.removeEventListener('abort', stop); resolve(v); }, reject);
    });

    /* ---------------- the people and the memories (real data only) */
    const pool = ctx.featured();
    const real = pool.filter((p) => !p.isPlaceholder);
    const featured = real.length ? real : pool;
    // her card: one of her own story photos — never one whose words read as romantic (roses, hearts):
    // this is the best-friend card. A featured one first, then any story photo, then any featured one.
    const story = ctx.allPhotos().filter((p) => p.chapter === 'story' && !p.isPlaceholder && !readsRomantic(p));
    const her = featured.find((p) => p.chapter === 'story' && !readsRomantic(p))
      || story[0]
      || featured.find((p) => !p.role && !p.heroHair && !readsRomantic(p))
      || featured.find((p) => p.memory === 'journeys')
      || ctx.role('reveal');
    const together = ctx.role('together'); // a real photo of the two of them, if the owner marked one
    const allPhotos = ctx.allPhotos();
    const memories = memoriesOf(ctx.site)
      .filter((m) => String(fill(m.text || '')).trim() || allPhotos.some((p) => p.memory === m.id && !p.isPlaceholder))
      .slice(0, 9);
    const phone = String(ctx.site.settings?.whatsapp || '').replace(/[^\d]/g, '');
    const replyText = fill(words(T, 'replyMessage'));

    /* ---------------- markup */
    const glyph = (m, cls) => memoryGlyphSVG(KINDS.has(m.kind) ? m.kind : 'moment', { className: cls });
    const photo = (p, alt) => {
      const sizes = '(max-width: 700px) 40vw, 300px';
      return `<img alt="${esc(alt)}" src="${esc(p.url)}"${p.srcset ? ` srcset="${esc(p.srcset)}" sizes="${sizes}"` : ''} style="object-position:${esc(p.objectPosition)}" decoding="async">`;
    };
    const herCap = fill(words(T, 'herCaption'));
    const meCap = together ? fill('{name} & her best friend') : fill(words(T, 'meCaption'));
    const bubbleCount = reduced ? 6 : low ? 12 : 22;
    const bubbles = Array.from({ length: bubbleCount }, (_, i) => {
      const s = (6 + ((i * 7) % 9) * (reduced ? 1 : 1.35)).toFixed(1);
      return `<i class="ft-bubble" style="--s:${s}px;--w:${(0.9 + ((i * 5) % 7) * 0.12).toFixed(2)}s"><b></b></i>`;
    }).join('');

    el.innerHTML = `
      <div class="ft-sky cam-layer" style="--depth:.18" aria-hidden="true"></div>
      <div class="ft-warm" aria-hidden="true"></div>
      <div class="ft-bloom" aria-hidden="true"></div>
      <div class="ft-fizz cam-layer" style="--depth:.55" aria-hidden="true">${bubbles}</div>
      <div class="ft-trail cam-layer" style="--depth:.35">
        ${memories.map((m) => `
          <div class="ft-mem" aria-hidden="true">
            <i class="ft-mem-halo"></i><i class="ft-mem-disc"></i><i class="ft-mem-lit"></i>
            ${glyph(m, 'g-dim')}${glyph(m, 'g-lit')}
          </div>`).join('')}
        <i class="ft-runner" aria-hidden="true"></i>
        <button type="button" class="ft-light" aria-label="Light the last point on the trail" disabled>
          <span class="ft-light-halo"></span>
          <span class="ft-light-sun">${sunEmblem({ glow: false })}</span>
          <span class="ft-light-ring"></span>
          <span class="ft-light-core"></span>
        </button>
        <p class="ft-hint" aria-hidden="true">${esc(fill(words(T, 'hint')))}</p>
      </div>
      <div class="ft-stage cam-layer" style="--depth:.6">
        <div class="ft-pair">
          <div class="ft-slot">
            <figure class="polaroid ft-card ft-her">
              <div class="ph">${photo(her, her.alt)}<i class="ft-develop"></i></div>
              <figcaption class="cap">${esc(herCap)}</figcaption>
              <i class="ft-gloss" aria-hidden="true"><i class="ft-sheen"></i></i>
              <i class="ft-eyelet" aria-hidden="true"></i>
              <span class="ft-charm" aria-hidden="true">${charmSVG({ kind: 'sun' })}</span>
            </figure>
          </div>
          <div class="ft-slot">
            <figure class="polaroid ft-card ft-me${together ? ' is-photo' : ''}">
              ${together
                ? `<div class="ph">${photo(together, together.alt)}<i class="ft-develop"></i></div>`
                : `<div class="ph ft-sketch" role="img" aria-label="A drawing of a keyring with three little charms: a tiny lantern, a mini soda bottle and a watermelon slice">${keyringSketchSVG({ tall: el.clientHeight > el.clientWidth })}</div>`}
              <figcaption class="cap">${esc(meCap)}</figcaption>
              <i class="ft-gloss" aria-hidden="true"><i class="ft-sheen"></i></i>
              <i class="ft-eyelet" aria-hidden="true"></i>
              <span class="ft-charm" aria-hidden="true">${charmSVG({ kind: 'lantern' })}</span>
            </figure>
          </div>
        </div>
        ${phone ? `<a class="btn-ghost ft-reply" target="_blank" rel="noopener" href="https://wa.me/${phone}${replyText ? `?text=${encodeURIComponent(replyText)}` : ''}">${esc(fill(words(T, 'replyLabel')))}</a>` : ''}
      </div>`;

    const $ = (s) => el.querySelector(s);
    const $$ = (s) => [...el.querySelectorAll(s)];
    const trailEl = $('.ft-trail');
    const memEls = $$('.ft-mem');
    const runner = $('.ft-runner');
    const light = $('.ft-light');
    const hint = $('.ft-hint');
    const bloom = $('.ft-bloom');
    const warm = $('.ft-warm');
    const stage = $('.ft-stage');
    const pair = $('.ft-pair');
    const slots = $$('.ft-slot');
    const charms = $$('.ft-charm');
    const fizz = $('.ft-fizz');
    const bubbleEls = $$('.ft-bubble');
    const reply = $('.ft-reply');

    gsap.set([...memEls, light, hint, ...slots, runner, ...bubbleEls], { autoAlpha: 0 });
    if (reply) gsap.set(reply, { autoAlpha: 0 });
    if (memEls.length) gsap.set(memEls, { scale: 0.3 });
    gsap.set(light, { scale: 0.4 });
    gsap.set($('.ft-light-sun'), { autoAlpha: 0, scale: 0.3 });

    /* ---------------- layout (and again whenever the screen changes) */
    let G = null;
    let rib = null;
    let staticPath = null;
    const state = { head: 0, start: 0, done: false, lit: false };
    const pointAt = (f) => {
      const d = G.dense;
      const x = clamp(f, 0, 1) * (d.length - 1);
      const i = Math.min(d.length - 2, Math.floor(x));
      const t = x - i;
      return { x: d[i].x + (d[i + 1].x - d[i].x) * t, y: d[i].y + (d[i + 1].y - d[i].y) * t };
    };
    function layout() {
      const W = el.clientWidth || window.innerWidth;
      const H = el.clientHeight || window.innerHeight;
      G = geometry(W, H, memories.length, !!reply);
      el.style.setProperty('--cw', `${G.cw}px`);
      el.style.setProperty('--gap', `${G.gap}px`);
      el.style.setProperty('--cap', `${G.cap}px`);
      el.style.setProperty('--m', `${G.m}px`);
      el.style.setProperty('--ph-ratio', G.portrait ? '4 / 5' : '1');
      warm.style.setProperty('--fx', `${((G.fin.x / W) * 100).toFixed(1)}%`);
      warm.style.setProperty('--fy', `${((G.fin.y / H) * 100).toFixed(1)}%`);
      stage.style.top = `${Math.round(G.cardsTop)}px`;
      memEls.forEach((n, i) => gsap.set(n, { x: G.lights[i].x, y: G.lights[i].y }));
      gsap.set(light, { x: G.fin.x, y: G.fin.y });
      gsap.set(bloom, { x: G.ember.x, y: G.ember.y });
      // the hint sits just above the last point, kept on screen
      const hw = hint.offsetWidth || 160;
      gsap.set(hint, { x: clamp(G.fin.x, hw / 2 + 16, W - hw / 2 - 16), y: G.fin.y - LIGHT * 0.5 - 18, xPercent: -50, yPercent: -50 });
      if (rib) {
        rib.setPath(G.pts);
        rib.set({ head: state.lit ? 1 : state.done ? G.f.stop : state.head, start: state.start ? G.f.start : 0 });
      }
      if (staticPath) staticPath.setAttribute('d', pathD());
      fitCaptions();
    }
    // a long caption (e.g. "{name} & her best friend") shrinks to stay on one line, so both cards keep one height
    function fitCaptions() {
      for (const c of $$('.ft-card .cap')) {
        c.style.fontSize = '';
        let size = G.cap;
        while (c.scrollWidth > c.clientWidth + 1 && size > 12) c.style.fontSize = `${--size}px`;
      }
    }
    const pathD = () => {
      const a = Math.floor(G.f.start * (G.dense.length - 1));
      return G.dense.slice(a).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    };

    layout();
    if (document.fonts && document.fonts.load) document.fonts.load(`${G.cap}px Caveat`).then(() => { if (!signal.aborted && G) fitCaptions(); }, () => {});
    if (ctx.theme.ribbon !== false) {
      rib = createRibbon(trailEl, {
        strands: low ? 3 : 4, width: G.portrait ? 1.7 : 2, glow: 0.95, tail: 0.2, device, zIndex: 0,
        onResize: () => layout(),
      });
      cleanups.push(() => rib && rib.destroy());
      rib.setPath(G.pts);
      rib.set({ head: 0, start: 0 });
    } else {
      // the golden ribbon is switched off (admin → Theme): a quiet gold line instead
      trailEl.insertAdjacentHTML('afterbegin', `<svg class="ft-path" aria-hidden="true"><path d="${pathD()}"/></svg>`);
      staticPath = trailEl.querySelector('.ft-path path');
      gsap.set(staticPath.parentNode, { autoAlpha: 0 });
      on(window, 'resize', () => layout());
    }

    /* ---------------- the keychain charms: damped pendulums with a faint breeze (still for reduced motion) */
    const swing = charms.map((n, i) => ({ n, th: 0, w: 0, ph: i * 1.7 }));
    const kick = (i, v) => { if (!reduced && swing[i]) swing[i].w += v; };
    if (!reduced) {
      const K = (2 * Math.PI / 1.15) ** 2; // ~1.15 s swing
      const C = 2 * 0.11 * Math.sqrt(K); // light damping
      let last = gsap.ticker.time;
      const tick = () => {
        const now = gsap.ticker.time;
        let dt = Math.min(0.1, Math.max(0, now - last));
        last = now;
        const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
        dt /= steps;
        for (const s of swing) {
          for (let k = 0; k < steps; k++) {
            const breeze = 34 * Math.sin(now * 1.9 + s.ph) + 18 * Math.sin(now * 3.1 + s.ph * 2.3);
            s.w += (-K * s.th - C * s.w + breeze) * dt;
            s.th += s.w * dt;
          }
          s.n.style.transform = `rotate(${s.th.toFixed(2)}deg)`;
        }
      };
      gsap.ticker.add(tick);
      cleanups.push(() => gsap.ticker.remove(tick));
    }

    /* ---------------- start: the light becomes the thread */
    ctx.letterbox(true);
    audio.setMood('tender');
    fx.dust({ density: 0.3 });
    if (her) ctx.preload(ctx.photoSrc(her, G.cw));
    if (together) ctx.preload(ctx.photoSrc(together, G.cw));
    twFrom(bloom, { autoAlpha: 1, scale: 1 }, { autoAlpha: 0, scale: reduced ? 1 : 0.35, duration: reduced ? 1.2 : 2.2, delay: reduced ? 0.2 : 0.5, ease: 'sine.inOut' });
    const intro = ui.narrate(words(T, 'intro'), { position: 'top', hold: 2.4 });
    intro.catch(() => {}); // awaited below; never an unhandled rejection when the chapter is left early
    await ctx.wait(reduced ? 0.25 : 0.5);
    audio.sfx('shimmer');

    let caught = 0;
    const catchLight = (i) => {
      const n = memEls[i];
      if (reduced) tw(n, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'sine.out' });
      else {
        tw(n, { autoAlpha: 1, scale: 1, duration: 0.9, ease: 'back.out(2.4)' });
        twFrom(n.querySelector('.ft-mem-halo'), { opacity: 0.9, scale: 0.6 }, { opacity: 0.22, scale: 1, duration: 1.4, ease: 'sine.out' });
        fx.sparkle(G.lights[i].x, G.lights[i].y, low ? 2 : 4, { spread: 12 });
      }
    };
    const riseCards = () => {
      slots.forEach((s, i) => {
        if (reduced) tw(s, { autoAlpha: 1, duration: 0.9, delay: i * 0.2, ease: 'sine.inOut' });
        else twFrom(s, { autoAlpha: 0, y: 46 }, { autoAlpha: 1, y: 0, duration: 1.5, delay: i * 0.24, ease: 'power3.out' });
        const dev = s.querySelector('.ft-develop');
        if (dev) tw(dev, { opacity: 0, duration: reduced ? 1.2 : 2.6, delay: 0.45 + i * 0.24, ease: 'sine.inOut' });
        const sketch = s.querySelector('.ft-sketch svg');
        if (sketch) twFrom(sketch, { opacity: 0 }, { opacity: 1, duration: reduced ? 1 : 1.8, delay: 0.5 + i * 0.24, ease: 'sine.inOut' });
        later(0.7 + i * 0.24, () => kick(i, 46));
      });
    };

    if (reduced) {
      // crossfades: the whole trail appears in one breath
      state.head = G.f.stop;
      state.start = 1;
      if (rib) { rib.set({ head: G.f.stop, start: G.f.start, alpha: 0 }); rib.fade(1, 1.2); }
      if (staticPath) tw(staticPath.parentNode, { autoAlpha: 1, duration: 1.2 });
      memEls.forEach((_, i) => later(0.3 + i * 0.12, () => catchLight(i)));
      later(0.5, riseCards);
      await ctx.wait(1.3);
    } else {
      const head = { f: 0 };
      const D = clamp(G.L / 360, 3.4, 5.2);
      if (!rib) {
        if (staticPath) tw(staticPath.parentNode, { autoAlpha: 1, duration: D * 0.8, delay: D * 0.2 });
        tw(runner, { autoAlpha: 1, duration: 0.4 });
      }
      later(D * 0.6, riseCards);
      await play(head, {
        f: G.f.stop, duration: D, ease: 'sine.inOut',
        onUpdate() {
          state.head = head.f;
          if (rib) rib.set({ head: head.f });
          else { const p = pointAt(head.f); runner.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`; }
          while (caught < G.f.lights.length && head.f >= G.f.lights[caught] - 0.003) catchLight(caught++);
          // once the thread is on its way, the curl out of the bloom withdraws into the trail
          if (!state.start && head.f > G.f.start + 0.12) {
            state.start = 1;
            if (rib) rib.tween('start', G.f.start, 1.9, 'sine.inOut');
          }
        },
      });
      if (!rib) tw(runner, { autoAlpha: 0, duration: 0.5 });
    }
    while (caught < memEls.length) catchLight(caught++);
    state.done = true;

    /* ---------------- the last point */
    const halo = light.querySelector('.ft-light-halo');
    await play(light, { autoAlpha: 1, scale: 1, duration: reduced ? 0.7 : 1.1, ease: reduced ? 'sine.out' : 'back.out(1.8)' });
    const breathe = reduced ? null : twFrom(halo, { scale: 0.92, opacity: 0.55 }, { scale: 1.16, opacity: 0.95, duration: 1.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    await intro;

    let litResolve;
    const lit = new Promise((r) => (litResolve = r));
    const lightUp = () => {
      if (state.lit) return;
      state.lit = true;
      light.disabled = true;
      // one short buzz (only once the page has had a tap: browsers refuse it before, with a warning)
      try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(20); } catch { /* not supported */ }
      litResolve();
    };
    on(light, 'click', lightUp);
    light.disabled = false;
    tw(hint, { autoAlpha: 1, duration: 0.9, ease: 'sine.inOut' });
    try { light.focus({ preventScroll: true }); } catch { /* ignore */ }
    later(reduced ? 6 : 10, lightUp); // she doesn't have to: it lights itself
    await untilAbort(lit);

    /* ---------------- lit: the light runs back along the trail, everything warms */
    if (breathe) breathe.kill();
    light.classList.add('is-lit');
    audio.sfx('chime');
    tw(hint, { autoAlpha: 0, duration: 0.5, overwrite: 'auto' });
    const core = light.querySelector('.ft-light-core');
    const sun = light.querySelector('.ft-light-sun');
    tw(sun, { autoAlpha: 1, scale: 1, duration: reduced ? 1 : 1.4, ease: reduced ? 'sine.out' : 'back.out(1.5)' });
    tw(halo, { scale: 1.45, opacity: 1, duration: 0.8, ease: 'sine.out', overwrite: 'auto' });
    if (!reduced) {
      twFrom(core, { scale: 1 }, { scale: 1.55, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 1 });
      twFrom(light.querySelector('.ft-light-ring'), { scale: 1, opacity: 0.9 }, { scale: 2.8, opacity: 0, duration: 1.3, ease: 'power2.out' });
      tw(sun.firstElementChild, { rotation: 360, duration: 80, repeat: -1, ease: 'none', transformOrigin: '50% 50%' });
      fx.sparkle(G.fin.x, G.fin.y, low ? 12 : 24, { spread: 46 });
      if (rib) rib.draw({ from: G.f.stop, to: 1, duration: 0.45, ease: 'power2.out' });
    } else if (rib) rib.set({ head: 1 });
    tw(warm, { autoAlpha: 1, duration: reduced ? 1.4 : 2.8, ease: 'sine.inOut' });
    pair.classList.add('is-lit');
    fx.dust({ density: 0.55 });
    if (rib) { rib.tween('glow', 1.35, 2.4); rib.tween('width', (G.portrait ? 1.7 : 2) * 1.15, 2.4); }
    later(0.15, () => { audio.sfx('jingle'); kick(0, 120); kick(1, -105); });
    later(reduced ? 0.4 : 0.7, () => startFizz());

    const lightMem = (i) => {
      const n = memEls[i];
      const d = reduced ? 0.6 : 0.45;
      tw(n.querySelector('.ft-mem-lit'), { opacity: 1, duration: d });
      tw(n.querySelector('.g-lit'), { opacity: 1, duration: d });
      tw(n.querySelector('.g-dim'), { opacity: 0, duration: d });
      tw(n.querySelector('.ft-mem-halo'), { opacity: 1, scale: 1.15, duration: d + 0.3 });
      if (!reduced) {
        twFrom(n, { scale: 1 }, { scale: 1.3, duration: 0.22, yoyo: true, repeat: 1, ease: 'power2.out' });
        fx.sparkle(G.lights[i].x, G.lights[i].y, low ? 3 : Math.max(3, 9 - memEls.length), { spread: 20 });
      }
    };
    if (reduced) {
      memEls.forEach((_, k) => later(0.2 + (memEls.length - 1 - k) * 0.14, () => lightMem(k)));
      await ctx.wait(0.4 + memEls.length * 0.14 + 0.6);
    } else {
      const run = { f: 1 };
      let next = memEls.length - 1;
      const dur = clamp(G.f.trail / 240, 1.8, 3);
      runner.style.transform = `translate3d(${G.fin.x}px, ${G.fin.y}px, 0)`;
      tw(runner, { autoAlpha: 1, duration: 0.25, delay: 0.3 });
      await play(run, {
        f: G.f.start, duration: dur, delay: 0.3, ease: 'sine.inOut',
        onUpdate() {
          const p = pointAt(run.f);
          runner.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
          while (next >= 0 && run.f <= G.f.lights[next] + 0.002) lightMem(next--);
        },
      });
      while (next >= 0) lightMem(next--);
      tw(runner, { autoAlpha: 0, duration: 0.6 });
      if (rib) rib.flow(true);
      // a warm light passes over both cards; the memory lights keep breathing
      $$('.ft-sheen').forEach((s, i) => {
        twFrom(s, { xPercent: -110 }, { xPercent: 110, duration: 1.5, delay: i * 0.22, ease: 'sine.inOut' });
        twFrom(s, { opacity: 0 }, { opacity: 1, duration: 0.75, delay: i * 0.22, yoyo: true, repeat: 1, ease: 'sine.inOut' });
      });
      if (memEls.length) tw(memEls.map((n) => n.querySelector('.ft-mem-halo')), { opacity: 0.55, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: { each: 0.35, from: 'end' } });
      await ctx.wait(0.8);
    }

    /* ---------------- the words */
    await ui.narrate(words(T, 'lines'), { position: 'bottom', hold: 2.4, gap: 0.6 });
    const final = words(T, 'final');
    if (fill(final)) {
      ui.say(final, { style: 'big', position: 'bottom' });
      audio.duck(0.75, 4);
    }
    await ctx.wait(reduced ? 1 : 2);
    if (reply) {
      tw(reply, { autoAlpha: 1, duration: 0.9, ease: 'sine.inOut' });
      on(reply, 'click', () => audio.sfx('chime'));
    }
    await ui.waitContinue('Roll the credits');
    // the trail's last light rises as the credits' first lantern (it kindles in place from here)
    const lr = light.getBoundingClientRect();
    ctx.next(lr.width ? { kind: 'lantern', x: lr.left + lr.width / 2, y: lr.top + lr.height / 2, color: '#ffd98a' } : undefined);

    /* ---------------- fizz: a few clear-gold bubbles rise behind the cards */
    function startFizz() {
      fizz.classList.add('is-on');
      audio.sfx('fizz');
      const r = pair.getBoundingClientRect();
      const host = el.getBoundingClientRect();
      const left = r.left - host.left;
      const top = r.top - host.top;
      bubbleEls.forEach((b, i) => {
        const spread = G.portrait ? 0.04 : 0.16;
        const x = left + rand(-spread, 1 + spread) * r.width;
        const y = top + rand(0.04, 0.32) * G.cardH;
        if (reduced) {
          // still bubbles that glow and fade in place
          gsap.set(b, { x: left + ((i + rand(0.15, 0.85)) / bubbleEls.length) * r.width, y: top - rand(0.15, 0.7) * (top - G.start.y), scale: 1 });
          tw(b, { autoAlpha: 0.85, duration: 1.2, delay: i * 0.25, yoyo: true, repeat: -1, repeatDelay: 1.6, ease: 'sine.inOut' });
          return;
        }
        const rise = rand(0.75, 1.05) * (y - G.start.y);
        const d = rand(2.2, 3.6);
        const tl = track(gsap.timeline({ delay: i * 0.13 + rand(0, 0.35), repeat: -1, repeatDelay: rand(0.3, 2.4) }));
        tl.fromTo(b, { x, y, scale: rand(0.5, 0.8), autoAlpha: 0 }, { y: y - rise, x: x + rand(-14, 14), scale: rand(0.9, 1.15), duration: d, ease: 'power1.in' }, 0)
          .to(b, { autoAlpha: rand(0.75, 1), duration: 0.35, ease: 'sine.out' }, d * 0.12)
          .to(b, { autoAlpha: 0, duration: 0.55, ease: 'sine.in' }, d - 0.55);
      });
    }
  },
  async exit() {
    (this.cleanup || []).splice(0).forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    this.cleanup = [];
  },
};
