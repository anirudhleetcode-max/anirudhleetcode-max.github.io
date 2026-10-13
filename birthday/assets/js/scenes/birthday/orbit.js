// The last beat of the birthday chapter: her chosen photographs come back and drift
// in a slow, soft swirl around the title — up to three tilted rings, depth-sorted
// (the near side passes below the title, larger and brighter; the far side above,
// smaller and dimmer). Photos fade whenever they would cross the words on screen,
// so the title and the final lines always stay clean. Plain DOM (crisp photos,
// object-position focal points, alt text); one transform + opacity write per frame.
// Then they gather into a heart around the title (heart(), state.heart 0 → 1): the
// photographs themselves are the heart's outline — two round lobes, the dip between them
// and the point below — placed along the classic heart curve, evenly by arc length.
import { TAU, clamp, lerp, sstep } from './util.js';

/** The heart curve, t ∈ [0, 2π): x = 16 sin³t, y = −(13 cos t − 5 cos 2t − 2 cos 3t − cos 4t)
 *  (screen y grows downwards: the dip is at t = 0, the point at t = π). Bounds x ±16, y −12…17. */
const heartXY = (t) => [16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))];
const HEART = { x0: -16, x1: 16, y0: -12, y1: 17 };
/** n points evenly spaced along the outline (by arc length), the first at the bottom point — so the
 *  point always holds a photograph (and for an even count the dip too) and the shape stays symmetric. */
export function heartPoints(n) {
  const M = 720;
  const pts = [];
  let len = 0;
  for (let i = 0; i <= M; i++) {
    const t = (i / M) * TAU;
    const p = heartXY(t);
    // the curve plunges into the dip between the lobes and straight back out: count that stretch
    // short, so the spacing steps across the dip and the two photos either side of it don't touch
    const dip = Math.min(t, TAU - t);
    const wgt = 1 - 0.8 * Math.exp(-((dip / 0.5) ** 2));
    if (i) len += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) * wgt;
    pts.push([p[0], p[1], len]);
  }
  const out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const want = ((k / n + 0.5) % 1) * len; // from the point (t = π, half-way round)
    j = 0;
    while (j < M - 1 && pts[j + 1][2] < want) j++;
    const a = pts[j];
    const b = pts[Math.min(M, j + 1)];
    const f = b[2] > a[2] ? (want - a[2]) / (b[2] - a[2]) : 0;
    out.push({ x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f) });
  }
  return { points: out, length: len };
}

// a photograph's scale on the far pass (above the title) and the near pass (below it)
const FAR = 0.58;
const NEAR = 1.08;

const RINGS = {
  // on a phone the title is nearly as wide as the screen: the rings are wider than the
  // frame, so photos pass above and below it and swing out past the edges at the sides
  portrait: [
    { rx: 0.52, ry: 0.235, size: 0.86, speed: 1 },
    { rx: 0.64, ry: 0.305, size: 1, speed: 0.74 },
    { rx: 0.76, ry: 0.375, size: 1.1, speed: 0.56 },
  ],
  landscape: [
    { rx: 0.25, ry: 0.255, size: 0.84, speed: 1 },
    { rx: 0.35, ry: 0.35, size: 1, speed: 0.74 },
    { rx: 0.45, ry: 0.44, size: 1.1, speed: 0.56 },
  ],
};

/**
 * createOrbit(container, photos, { device }) →
 *   { layout({ W, H, cx, cy }), update(time, dt), show({ stagger }), set({ alpha, spread, speed }), zones(rects), destroy() }
 */
export function createOrbit(container, photos, { device = {} } = {}) {
  const reduced = !!device.reducedMotion;
  const ringCount = photos.length <= 9 ? 1 : photos.length <= 22 ? 2 : 3;
  const items = photos.map((photo, i) => {
    const fig = document.createElement('figure');
    fig.className = 'bd-ph';
    const img = document.createElement('img');
    img.alt = photo.alt || photo.caption || photo.label || 'A photograph of her';
    img.decoding = 'async';
    img.draggable = false;
    img.src = photo.thumbUrl || photo.url;
    img.style.objectPosition = photo.objectPosition || '50% 40%';
    fig.appendChild(img);
    container.appendChild(fig);
    return { photo, fig, ring: i % ringCount, k: 0, ratio: clamp(Number(photo.ratio) || 1, 0.55, 1.8), appear: 0, w: 0, h: 0, theta: 0, last: '', slot: i, hx: 0, hy: 0, hs: 1 };
  });
  // spread each ring's photos evenly around it, rings offset from each other
  for (let r = 0; r < ringCount; r++) {
    const ring = items.filter((it) => it.ring === r);
    ring.forEach((it, k) => { it.theta = (k / ring.length) * TAU + r * 0.9 + 0.35; });
  }

  const st = { W: 0, H: 0, cx: 0, cy: 0, alpha: 1, spread: 1, speed: 1, rings: RINGS.portrait, base: 80, zones: [], phase: 0, heart: 0, time: 0, floor: 1 };
  // the heart's golden thread (decorative), behind the photographs
  const SVGNS = 'http://www.w3.org/2000/svg';
  const thread = { svg: document.createElementNS(SVGNS, 'svg'), path: document.createElementNS(SVGNS, 'path'), len: 0 };
  thread.svg.setAttribute('class', 'bd-heart');
  thread.svg.setAttribute('aria-hidden', 'true');
  thread.svg.setAttribute('preserveAspectRatio', 'none');
  thread.svg.appendChild(thread.path);
  container.prepend(thread.svg);
  const shape = heartPoints(items.length);

  /** `clear` = half the size of the title block (px): the rings pass above and below it. */
  function layout({ W, H, cx, cy, clear = null }) {
    st.clear = clear;
    st.W = W;
    st.H = H;
    st.cx = cx;
    st.cy = cy;
    const portrait = H >= W * 1.05;
    // a photo about a fifth of the short side (smaller when there are many)
    const crowd = items.length > 24 ? 0.86 : items.length > 14 ? 0.93 : 1;
    st.base = clamp(Math.min(W, H) * (portrait ? 0.215 : 0.135) * crowd, 58, 150);
    st.rings = (portrait ? RINGS.portrait : RINGS.landscape).map((R, k) => {
      if (!clear) return R;
      // tall titles (tablets): open the rings up so the near and far passes clear it
      const half = (st.base * R.size) / 2;
      const need = (clear.hh + half * 1.08 + 10) / H + k * 0.06;
      return { ...R, ry: clamp(Math.max(R.ry, need), R.ry, 0.47) };
    });
    for (const it of items) {
      const s = st.base * st.rings[it.ring].size;
      it.w = Math.round(s * Math.sqrt(it.ratio));
      it.h = Math.round(s / Math.sqrt(it.ratio));
      it.fig.style.width = `${it.w}px`;
      it.fig.style.height = `${it.h}px`;
      it.fig.style.marginLeft = `${-it.w / 2}px`;
      it.fig.style.marginTop = `${-it.h / 2}px`;
    }
    // The whole turn stays inside the frame. On wide screens the title sits high, and the far
    // half of a ring (above it) used to rise past the top edge. Like a ring seen in perspective,
    // each half gets its own height: the far half rises only to a top safe area (clear of the
    // progress dots), the near half sinks only to a bottom one; a half that already fits keeps
    // its designed height. update() blends the halves smoothly (no kink at the sides).
    const margin = Math.max(28, H * 0.04);
    st.rings = st.rings.map((R, k) => {
      const tallest = Math.max(0, ...items.filter((it) => it.ring === k).map((it) => it.h));
      const ryDown = clamp(Math.min(R.ry, (H - cy - (tallest * NEAR) / 2 - margin) / H), R.ry * 0.5, R.ry);
      const ryUp = clamp(Math.min(R.ry, (cy - (tallest * FAR) / 2 - margin) / H), ryDown * 0.5, R.ry);
      // y = cy + (ryMid·d + ryBend·d²)·H for depth d ∈ [-1, 1]: −ryUp at the top, +ryDown at the
      // bottom, monotonic and smooth in between (ryUp ≥ ryDown / 2 keeps it monotonic)
      return { ...R, ryUp, ryDown, ryMid: (ryUp + ryDown) / 2, ryBend: (ryDown - ryUp) / 2 };
    });
    layoutHeart();
  }

  /** The heart fills the frame, centred (clear of the progress dots at the top): the photographs
   *  are its outline, each sized to its share of the curve with a little air between them, and a
   *  fine golden thread runs along the curve behind them so the shape reads at any photo count.
   *  (While it forms the title steps back — birthday.js dims it — so nothing has to dodge the words.) */
  function layoutHeart() {
    const { W, H } = st;
    if (!W || !H || !items.length) return;
    const n = items.length;
    const top = Math.max(44, H * 0.07);
    const bottom = Math.max(18, H * 0.035);
    const side = Math.max(10, W * 0.03);
    let tile = st.base;
    let k = 1;
    let ky = 1;
    for (let pass = 0; pass < 3; pass++) {
      k = (W - 2 * side - tile) / (HEART.x1 - HEART.x0);
      // on a tall screen the heart may stand a little taller than its usual proportions (up to 1.3×)
      ky = Math.min(k * 1.3, (H - top - bottom - tile) / (HEART.y1 - HEART.y0));
      k = Math.min(k, ky);
      tile = clamp((shape.length * (k + ky) / 2) / n * 0.72, 30, st.base * 1.25);
    }
    const oy = (top + H - bottom) / 2 - ((HEART.y0 + HEART.y1) / 2) * ky; // the heart's box centred
    st.heartBox = { k: ky, tile, oy };
    for (const it of items) {
      const pt = shape.points[it.slot];
      it.hx = st.cx + pt.x * k;
      it.hy = oy + pt.y * ky;
      it.hs = tile / Math.max(it.w, it.h, 1);
    }
    // the golden thread
    let d = '';
    let len = 0;
    let px = 0;
    let py = 0;
    for (let i = 0; i <= 160; i++) {
      const [x, y] = heartXY((i / 160) * TAU);
      const sx = st.cx + x * k;
      const sy = oy + y * ky;
      if (i) len += Math.hypot(sx - px, sy - py);
      px = sx;
      py = sy;
      d += `${i ? 'L' : 'M'}${sx.toFixed(1)} ${sy.toFixed(1)}`;
    }
    thread.path.setAttribute('d', `${d}Z`);
    thread.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    thread.len = len;
    thread.path.style.strokeDasharray = `${thread.len.toFixed(1)}`;
  }

  /** Give each photograph the heart slot nearest to where it is now (by angle round the centre),
   *  so they gather without crossing paths. Called as the heart begins. */
  function assignHeart() {
    const now = items.map((it) => {
      const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(it.fig.style.transform || '');
      const x = m ? Number(m[1]) : st.cx;
      const y = m ? Number(m[2]) : st.cy;
      return { it, a: Math.atan2(y - st.cy, x - st.cx) };
    }).sort((p, q) => p.a - q.a);
    const slots = shape.points.map((p, i) => ({ i, a: Math.atan2(p.y + 2, p.x) })).sort((p, q) => p.a - q.a);
    // rotate the matching to the offset that moves the photos least
    let best = 0;
    let bestCost = Infinity;
    for (let off = 0; off < slots.length; off++) {
      let c = 0;
      now.forEach((p, k) => { const d = Math.abs(p.a - slots[(k + off) % slots.length].a); c += Math.min(d, TAU - d); });
      if (c < bestCost) { bestCost = c; best = off; }
    }
    now.forEach((p, k) => { p.it.slot = slots[(k + best) % slots.length].i; });
    layoutHeart();
  }

  /** Screen rects ({x0, y0, x1, y1}) the photos must not cover. */
  function zones(rects) { st.zones = (rects || []).filter(Boolean); }

  function maskAt(x, y, hw, hh) {
    let m = 1;
    for (const z of st.zones) {
      const dx = Math.max(z.x0 - (x + hw), (x - hw) - z.x1, 0);
      const dy = Math.max(z.y0 - (y + hh), (y - hh) - z.y1, 0);
      const d = Math.hypot(dx, dy);
      m = Math.min(m, lerp(z.floor ?? 0.1, 1, sstep(0, 34, d)));
    }
    return m;
  }

  const omega = (TAU / 92) * (reduced ? 0.25 : 1);
  function update(time, dt) {
    if (thread.len) {
      thread.path.style.strokeDashoffset = (thread.len * (1 - st.heart)).toFixed(1);
      thread.svg.style.opacity = (Math.min(1, st.heart * 1.4) * st.alpha * 0.85).toFixed(3);
    }
    st.phase += dt * omega * st.speed * (1 - st.heart);
    st.time += dt;
    const hk = st.heart * st.heart * (3 - 2 * st.heart); // eased
    const breathe = reduced ? 1 : 1 + 0.018 * Math.sin(st.time * 1.6) * hk;
    for (const it of items) {
      const R = st.rings[it.ring];
      const th = it.theta + st.phase * R.speed;
      const depth = Math.sin(th); // +1 near (below the title), -1 far (above it)
      const near = (depth + 1) / 2;
      const sp = st.spread * lerp(0.9, 1, it.appear);
      // the ring position, then (as the heart forms) the heart slot
      const rx = st.cx + Math.cos(th) * R.rx * st.W * sp;
      const ry = st.cy + ((R.ryMid ?? R.ry) * depth + (R.ryBend ?? 0) * depth * depth) * st.H * sp;
      const hcy = st.heartBox ? st.heartBox.oy + 2.5 * st.heartBox.k : st.cy; // the heart's own middle (breathes about it)
      const x = lerp(rx, st.cx + (it.hx - st.cx) * breathe, hk);
      const y = lerp(ry, hcy + (it.hy - hcy) * breathe, hk);
      const s = lerp(lerp(FAR, NEAR, near), it.hs, hk) * lerp(0.55, 1, it.appear);
      // (layout() keeps the turn inside the frame; on a frame too small for that, a photo still
      // fades out softly before the top or bottom edge could cut it flat. The side swings past
      // the frame on phones are intended.)
      const hh = (it.h * s) / 2;
      const edge = Math.min(y - hh, st.H - (y + hh));
      // (formed, the heart may lie over the dimmed title: `floor` says how much of a photo stays where
      // it meets the words — 1 while the heart has the screen, low again when the words come back)
      const mask = Math.max(maskAt(x, y, (it.w * s) / 2, hh), st.floor * hk);
      const a = lerp(lerp(0.6, 1, near), 1, hk) * mask * sstep(-hh * 0.5, 28, edge) * st.alpha * it.appear;
      it.fig.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
      it.fig.style.opacity = a.toFixed(3);
      const z = String(hk > 0.5 ? 100 + it.slot : 100 + Math.round(depth * 60));
      if (z !== it.last) { it.fig.style.zIndex = z; it.last = z; }
      it.fig.style.visibility = a < 0.004 ? 'hidden' : 'visible';
    }
  }

  /** Bring them back one by one (front ones first). */
  /** Reveal the photographs in film order. `slowing`: quick at first, the last ones take their time. */
  function show({ stagger = 0.09, duration = 1.6, slowing = false } = {}) {
    const g = window.gsap;
    const n = items.length;
    const span = stagger * Math.max(0, n - 1) * (slowing ? 1.6 : 1);
    const at = (k) => (reduced ? k * stagger * 0.5 : slowing ? span * (k / Math.max(1, n - 1)) ** 1.6 : k * stagger);
    items.forEach((it, k) => g.to(it, { appear: 1, duration: reduced ? 1.2 : duration * (slowing ? 1 + k / Math.max(1, n - 1) : 1), delay: at(k), ease: 'power2.out' }));
    return at(n - 1) + duration * (slowing ? 2 : 1);
  }

  /** The ring gathers into a heart around the title (resolves when it has settled). */
  function heart({ duration = 3.4 } = {}) {
    assignHeart();
    return new Promise((r) => window.gsap.to(st, { heart: 1, duration: reduced ? 1.6 : duration, ease: 'sine.inOut', onComplete: r }));
  }

  function set(o = {}) {
    for (const k of ['alpha', 'spread', 'speed', 'floor']) if (o[k] != null) st[k] = o[k];
  }

  function destroy() {
    const g = window.gsap;
    g.killTweensOf(st);
    thread.svg.remove();
    for (const it of items) { g.killTweensOf(it); it.fig.remove(); }
    items.length = 0;
  }

  return { layout, update, show, heart, set, zones, destroy, state: st, get count() { return items.length; }, get arrived() { return items.every((it) => it.appear >= 1); } };
}
