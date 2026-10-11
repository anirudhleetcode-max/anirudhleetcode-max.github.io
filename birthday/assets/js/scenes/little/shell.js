// The engine of the film's 3D "movement" chapters ("The Little Things", "What Makes You, You"):
// one renderer, one loop (driven by the gsap ticker, so tweens are updated before each frame is
// drawn), one veil for the cuts between movements, and — while the chapter card plays — every
// program, texture and buffer of every movement warmed up (core/gpu.js), so no movement begins
// with a stall. That heavy work waits until the incoming transition has finished its reveal (so the
// reveal keeps every frame) and the card's title is still; the card is held until it is done.
// A chapter is a list of movements (contract at the top of ./kit.js); each can be switched off in
// the admin (Theme) and previewed alone (…?preview&scene=<chapter>&part=<movement>).
import * as THREE from 'three';
import { prewarm, createFrameGovernor } from '../../core/gpu.js';
import { makeEnvironment, memoriesWithPhotos, disposeShared, clamp } from './kit.js';
import { memoriesOf } from '../../shared/model.js';

const isAbort = (e) => e && (e.name === 'AbortError' || e === 'abort');
const abortErr = () => new DOMException('Scene exited', 'AbortError');
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/**
 * Which of a chapter's movements play: admin → Theme switches (all on unless switched off), and a
 * movement's own `available(ctx)` (e.g. the photoshoot plays only once its fan-art image exists).
 */
export function enabledMovements(settings, movements, ctx = null) {
  const theme = (settings && settings.theme) || {};
  return movements.filter((m) => (!m.toggle || theme[m.toggle] !== false) && (!m.available || !ctx || m.available(ctx))).map((m) => m.id);
}

/**
 * A 3D chapter made of movements. cfg: { id, title, text (default words), optional (keys an owner
 * may clear on purpose), movements: [{ id, toggle, available(ctx), label, load }], next: { x, y, kind, color } }.
 * Returns the scene module ({ id, title, enter, exit }) main.js expects.
 */
export function createChapter(cfg) {
  let live = null;
  return {
    id: cfg.id,
    title: cfg.title,
    async enter(ctx, el) {
      if (live) live.destroy();
      const s = new Chapter3D(ctx, el, cfg);
      live = s;
      try {
        // the incoming transition reveals the closed veil; nothing heavy runs until that reveal is over
        s.mount();
        if (ctx.revealed) await ctx.revealed;
        s.guard();
        await s.prepare();
        await s.run();
      } catch (e) {
        if (isAbort(e) || s.dead) return;
        throw e;
      }
    },
    async exit() {
      const s = live;
      live = null;
      if (s) s.destroy();
    },
  };
}

class Chapter3D {
  constructor(ctx, el, cfg) {
    this.ctx = ctx;
    this.el = el;
    this.cfg = cfg;
    this.gsap = ctx.gsap || window.gsap;
    const DEF = cfg.text || {};
    const t = ctx.text?.[cfg.id] || {};
    this.T = { ...DEF };
    for (const k of Object.keys(DEF)) {
      const v = t[k];
      if (Array.isArray(DEF[k])) { if (Array.isArray(v) && v.filter(Boolean).length) this.T[k] = v.filter(Boolean); }
      else if (v != null && v !== '') this.T[k] = v;
    }
    // (an owner may clear a tag / label on purpose: an empty string means "none")
    for (const k of cfg.optional || []) if (t[k] === '') this.T[k] = '';
    const dev = ctx.device || {};
    this.tier = dev.tier || (dev.lowPower ? 'low' : dev.mobile ? 'mid' : 'high');
    this.low = this.tier === 'low' || !!dev.lowPower;
    this.mobile = !!dev.mobile;
    this.reduced = !!dev.reducedMotion;
    this.quality = this.low ? 0 : this.tier === 'mid' ? 1 : 2;
    this.dead = false;
    this.ac = new AbortController();
    this.tweens = new Set();
    this.timers = new Set();
    this.time = 0;
    this.frames = 0;
    this.phase = 'init';
    this.movements = [];
    this.active = null;
    this.onTick = () => this.tick(performance.now());
    const params = new URLSearchParams(location.search);
    this.devPr = window.__LITTLE_DEV__ ? +params.get('pr') || 0 : 0;
    // preview only: play a single movement (…?preview&scene=<chapter>&part=<movement>)
    this.part = params.has('preview') ? params.get('part') : null;
    if (window.__LITTLE_DEV__) window.__little = this;
  }

  // ---------------------------------------------------------------- tracked helpers
  get signal() { return this.ctx.signal; }
  guard() { if (this.dead || this.signal?.aborted) throw abortErr(); }
  to(target, vars) { const t = this.gsap.to(target, vars); this.tweens.add(t); return t; }
  timeline(vars) { const t = this.gsap.timeline(vars); this.tweens.add(t); return t; }
  later(sec, fn) {
    const id = setTimeout(() => { this.timers.delete(id); if (!this.dead) fn(); }, sec * 1000);
    this.timers.add(id);
    return id;
  }
  async wait(sec) {
    if (this.ctx.wait) await this.ctx.wait(sec);
    else await new Promise((res) => this.later(sec, res));
    this.guard();
  }
  sfx(name, opts) { try { this.ctx.audio?.sfx?.(name, opts); } catch (e) { /* ignore */ } }
  mood(m) { try { this.ctx.audio?.setMood?.(m); } catch (e) { /* ignore */ } }
  fill(str) { try { return this.ctx.fill ? this.ctx.fill(str) : String(str ?? ''); } catch (e) { return String(str ?? ''); } }
  async narrate(lines, opts) {
    if (this.ctx.ui?.narrate) await this.ctx.ui.narrate(lines, opts);
    this.guard();
  }

  // ---------------------------------------------------------------- setup
  /** The canvas and the closed veil: what the incoming transition reveals, before anything is built. */
  mount() {
    const root = document.createElement('div');
    root.className = 'lth-root';
    const canvas = document.createElement('canvas');
    canvas.className = 'lth-gl';
    // what the canvas shows, in words (updated per movement)
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', this.cfg.title);
    const veil = document.createElement('div');
    veil.className = 'lth-veil';
    root.append(canvas, veil);
    this.el.appendChild(root);
    Object.assign(this, { root, canvas, veilEl: veil });
    this.veilState = { a: 1, color: '#05040c' };
  }

  /**
   * Every movement built and warmed up behind the chapter card: the card comes in while the light
   * work runs (fonts, code), the heavy work starts once its title is still (a long task would stall a
   * title still coming in), and the card is held until every movement is ready and the frame governor
   * has had a look. A ?part= preview has no card.
   */
  async prepare() {
    const ui = this.ctx.ui;
    this.phase = 'card'; // (the frame governor samples while the card is up)
    if (this.part || !ui?.chapterCard) return this.setup(null);
    let onShown;
    const shown = new Promise((r) => { onShown = r; });
    const ready = this.setup(shown);
    const card = ui.chapterCard(this.T.kicker, this.T.title, { until: ready.then(() => this.settle(), () => {}), onShown });
    card.catch(() => onShown()); // (a card cut short must not leave the warm-up waiting)
    // (a failed setup lets the card finish first: the error never lands under a card still playing)
    try { await ready; } catch (e) { await card.catch(() => {}); throw e; }
    await card;
  }

  /** Resolves once the frame governor has sampled one full window of veiled frames (at most 1.5 s). */
  settle() {
    if (!this.governor) return Promise.resolve();
    return new Promise((res) => {
      this.settling = { at: this.frames + 25, res };
      this.later(1.5, res);
    });
  }

  async setup(shown = null) {
    // the movements this film plays: their code loads while the card comes in
    const site = this.ctx.site || {};
    const MOVEMENTS = this.cfg.movements;
    let ids = enabledMovements(site.settings, MOVEMENTS, this.ctx);
    if (this.part && MOVEMENTS.some((m) => m.id === this.part)) {
      const def = MOVEMENTS.find((m) => m.id === this.part);
      ids = !def.available || def.available(this.ctx) ? [this.part] : [];
    }
    const defs = MOVEMENTS.filter((def) => ids.includes(def.id));
    const code = Promise.all(defs.map((def) => def.load()));
    code.catch(() => {}); // (awaited below)

    // fonts for the hand-written tag and label textures
    try {
      await Promise.race([Promise.all([document.fonts.load('600 120px "Caveat"'), document.fonts.load('italic 500 40px "Cormorant Garamond"')]), new Promise((r) => setTimeout(r, 2500))]);
    } catch (e) { /* ignore */ }
    this.guard();

    let post = null;
    if (this.quality === 2) {
      try {
        const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
          import('three/addons/postprocessing/EffectComposer.js'),
          import('three/addons/postprocessing/RenderPass.js'),
          import('three/addons/postprocessing/UnrealBloomPass.js'),
          import('three/addons/postprocessing/OutputPass.js'),
        ]);
        post = { EffectComposer, RenderPass, UnrealBloomPass, OutputPass };
      } catch (e) { post = null; }
      this.guard();
    }
    const mods = await code;
    this.guard();
    // the heavy part (renderer, environments, builders, warm-up: long tasks) once the card's title is still
    if (shown) await shown;
    this.guard();
    const { canvas } = this;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.low && !post, alpha: false, stencil: false, powerPreference: 'high-performance' });
    this.renderer = renderer;
    renderer.setPixelRatio(this.pixelRatio());
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(0x05040c, 1);
    if (this.quality >= 1) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    // (the environments are made on first use, by a builder: only the night needs the night one —
    // a chapter without it never pays for its PMREM; the builders run before the warm-up, so what
    // they ask for is warm before anything plays)
    this.envWarm = null; this.envNight = null;
    if (post) {
      const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
      const composer = new post.EffectComposer(renderer, rt);
      this.renderPass = new post.RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
      composer.addPass(this.renderPass);
      this.bloom = new post.UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.6, 0.85);
      composer.addPass(this.bloom);
      composer.addPass(new post.OutputPass());
      this.composer = composer;
    }

    const env = this.makeEnv(site);
    this.env = env;
    for (const [i, def] of defs.entries()) {
      const m = await mods[i].build(env);
      this.guard();
      m.id = m.id || def.id;
      m.label = m.label || def.label || '';
      this.movements.push(m);
      await nextFrame(); // (a frame between builders: the page stays responsive)
      this.guard();
    }

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.root);
    window.addEventListener('resize', this.onResize = () => this.resize(), { signal: this.ac.signal });

    // warm every movement up behind the veil (each through the pipeline it will be drawn with)
    for (const m of this.movements) {
      this.useMovement(m);
      try {
        await prewarm({ renderer, scene: m.scene, camera: m.camera, composer: m.post === false ? null : this.composer, show: m.late || [], signal: this.signal });
        // an overlay is drawn straight to the screen, after the composer: warm it up for that target
        if (m.overlay) await prewarm({ renderer, scene: m.overlay.scene, camera: m.overlay.camera || m.camera, composer: null, show: m.overlay.late || [], signal: this.signal });
      } catch (e) { /* the lazy path still works */ }
      this.guard();
      await nextFrame();
      this.guard();
    }
    this.useMovement(this.movements[0] || null);
    // (a desktop at 1× (a 1366×768 laptop) has no room above the floor of 1: there the high tier, with
    // its bloom, transmission and shadows, may step down to 0.75 — once — if frames are slow)
    const floor = this.quality === 2 && (window.devicePixelRatio || 1) <= 1 ? 0.75 : 1;
    this.governor = this.devPr ? null : createFrameGovernor({ minRatio: floor });
    this.last = performance.now();
    this.gsap.ticker.add(this.onTick);
  }

  makeEnv(site) {
    const self = this;
    const memories = memoriesWithPhotos(this.ctx, memoriesOf(site));
    return {
      THREE, gsap: this.gsap, renderer: this.renderer, ctx: this.ctx,
      tier: { quality: this.quality, low: this.low, mobile: this.mobile, reduced: this.reduced, shadows: this.quality >= 1 },
      get envMap() { return self.environment('warm'); },
      get envWarm() { return self.environment('warm'); },
      get envNight() { return self.environment('night'); },
      T: this.T, memories,
      shared: {}, // hand-offs between this chapter's movements (e.g. a texture one makes and a later one shows)
      get size() { return self.size; },
      wait: (s) => this.wait(s), to: (t, v) => this.to(t, v), timeline: (v) => this.timeline(v), later: (s, f) => this.later(s, f),
      guard: () => this.guard(), sfx: (n, o) => this.sfx(n, o), mood: (m) => this.mood(m),
      narrate: (l, o) => this.narrate(l, o), fill: (s) => this.fill(s),
      get time() { return self.time; },
    };
  }

  /** A pre-filtered environment ('warm' | 'night'), made the first time a builder asks for it. */
  environment(preset) {
    const k = preset === 'night' ? 'envNight' : 'envWarm';
    if (!this[k]) {
      this.guard(); // (never a PMREM for a chapter that has already gone)
      this[k] = makeEnvironment(this.renderer, preset);
    }
    return this[k].texture;
  }

  useMovement(m) {
    this.active = m;
    if (!m) return;
    if (m.label) this.canvas.setAttribute('aria-label', m.label);
    if (this.renderPass) { this.renderPass.scene = m.scene; this.renderPass.camera = m.camera; }
    this.applyBloom(m);
  }

  applyBloom(m) {
    if (!this.bloom || !m) return;
    const b = m.bloom || {};
    this.bloom.strength = b.strength ?? 0.5;
    this.bloom.radius = b.radius ?? 0.6;
    this.bloom.threshold = b.threshold ?? 0.85;
  }

  pixelRatio() {
    if (this.devPr) return this.devPr;
    const cap = this.low ? 1.25 : this.quality === 1 ? 1.75 : 2;
    return Math.min(window.devicePixelRatio || 1, cap, this.prLimit || Infinity);
  }

  resize() {
    if (this.dead) return;
    const w = Math.max(1, this.root.clientWidth), h = Math.max(1, this.root.clientHeight);
    const pr = this.pixelRatio();
    if (this.renderer.getPixelRatio() !== pr) this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); }
    const aspect = w / h;
    this.size = { w, h, aspect, portrait: aspect < 0.8 };
    for (const m of this.movements) { try { m.resize(this.size); } catch (e) { console.warn('[little] resize', e); } }
  }

  // ---------------------------------------------------------------- the director's veil
  veil(opacity, { duration = 1, color = null, ease = 'sine.inOut' } = {}) {
    if (color) this.veilEl.style.background = color;
    const v = this.veilState;
    return new Promise((res) => {
      this.to(v, { a: opacity, duration: this.reduced ? Math.min(duration, 0.8) : duration, ease, overwrite: 'auto', onUpdate: () => { this.veilEl.style.opacity = v.a.toFixed(3); }, onComplete: res });
    });
  }

  // ---------------------------------------------------------------- loop
  tick(now) {
    if (this.dead) return;
    const rawDt = clamp((now - this.last) / 1000, 0, 0.25);
    const dt = Math.min(rawDt, 0.1);
    this.last = now;
    this.time += dt;
    this.frames++;
    // while the chapter card plays over the closed veil: is this GPU smooth at this resolution?
    if (this.governor && this.phase === 'card' && this.veilState.a >= 0.999) {
      const pr = this.governor.sample(now, this.renderer.getPixelRatio());
      if (pr) {
        this.prLimit = pr; this.resize(); this.governor.restart();
        // (a step down inside the settle window: one more window, so the new ratio can be confirmed)
        if (this.settling && !this.settling.extended) { this.settling.at = this.frames + 25; this.settling.extended = true; }
      }
      if (this.settling && this.frames >= this.settling.at) { this.settling.res(); this.settling = null; }
    }
    const m = this.active;
    if (!m) return;
    try { m.update(dt, this.time); } catch (e) { console.warn('[little] update', e); }
    this.renderer.toneMappingExposure = m.exposure ?? 1;
    // (a movement with post: false is drawn straight to the screen: no bloom over it)
    if (this.composer && m.post !== false) this.composer.render(dt);
    else this.renderer.render(m.scene, m.camera);
    // a movement's overlay (e.g. a print that must look exactly like its image): drawn last, straight
    // to the screen — no bloom, no tone mapping, no grading — over a cleared depth buffer
    const o = m.overlay;
    if (o && o.scene.visible) {
      const r = this.renderer;
      r.autoClear = false;
      r.clearDepth();
      r.render(o.scene, o.camera || m.camera);
      r.autoClear = true;
    }
  }

  // ---------------------------------------------------------------- flow
  async run() {
    const { ctx, T } = this;
    // (the chapter card has played by now, over the warm-up: prepare())
    this.guard();
    this.governor = null;
    const dir = { veil: (a, o) => this.veil(a, o) };
    for (const m of this.movements) {
      this.useMovement(m);
      this.phase = m.id;
      await m.play(dir);
      this.guard();
    }
    this.phase = 'done';
    if (ctx.ui?.waitContinue) await ctx.ui.waitContinue(this.fill(T.continue || 'Keep going'));
    this.guard();
    const { w, h } = this.size;
    const n = this.cfg.next || {};
    ctx.next?.({ x: Math.round(w * (n.x ?? 0.5)), y: Math.round(h * (n.y ?? 0.3)), color: n.color || '#ffd98a', kind: n.kind || 'dust' });
  }

  // ---------------------------------------------------------------- teardown
  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.gsap?.ticker.remove(this.onTick);
    this.ac.abort();
    this.ro?.disconnect();
    this.timers.forEach((id) => clearTimeout(id));
    this.timers.clear();
    this.tweens.forEach((t) => { try { t.kill(); } catch (e) { /* ignore */ } });
    this.tweens.clear();
    for (const m of this.movements) { try { m.dispose(); } catch (e) { /* ignore */ } }
    this.movements = [];
    this.active = null;
    this.envWarm?.dispose(); this.envNight?.dispose();
    disposeShared();
    if (this.composer) {
      this.composer.passes.forEach((p) => p.dispose?.());
      this.composer.renderTarget1?.dispose(); this.composer.renderTarget2?.dispose();
      this.composer.dispose?.();
      this.composer = null;
    }
    if (this.renderer) {
      this.renderer.renderLists?.dispose();
      this.renderer.dispose();
      try { this.renderer.forceContextLoss(); } catch (e) { /* ignore */ }
      this.renderer = null;
    }
    this.root?.remove();
    if (window.__little === this) delete window.__little;
  }
}
