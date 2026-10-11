// Chapter — "Every Little Piece of You" (the constellation).
//
// Dark space. Her photographs float at many depths, softly lit prints drifting
// and turning. They drift toward each other; golden motes begin to pass between
// them, and the golden thread travels from photograph to photograph until the
// whole collection is linked. The thread draws the film's sun (the emblem of the
// lanterns and the wax seal): the prints settle in a circle on its ring while the
// thread radiates out of it as rays, they condense into stars, and the sun pulses
// twice with warm light. Then the sun gathers all its light into a single golden
// point at its centre, on a black screen — where the next chapter begins (the music
// plays on into it). Her final photograph is kept for the birthday chapter: alone, in
// real silence, after the 7,305 days and just before her title (birthday.js).
//
// Secret: among the background stars, a tiny constellation shaped like the first
// letter of her name (constellation/secret.js).
import * as THREE from 'three';
import { buildAtlas, createCards } from './constellation/cards.js';
import { createSun, periodicInterp } from './constellation/sun.js';
import { createThread } from './constellation/thread.js';
import { createRays } from './constellation/rays.js';
import { createSky } from './constellation/sky.js';
import { createSecret } from './constellation/secret.js';

const FALLBACK = {
  kicker: 'Chapter Eleven',
  title: 'Every Little Piece of You',
  lines: ['On their own, they’re just moments.', 'Connect them, and look what they were making all along.'],
};
// the final montage: a chosen handful, not every photograph (the full reel lives in the extras)
const CAP = { high: 14, mid: 13, low: 12 };
const D0 = 10; // camera distance to the sun's plane once everything settles
const GATHER = 1.45; // gathering, the photographs first come together on a looser circle around the sun-to-be…
const STAR = 0.76; // …settle on its ring, and condense into stars a little inside it (the emblem's dotted ring)

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const ease5 = (k) => k * k * k * (k * (k * 6 - 15) + 10);
const sine = (k) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(k, 0, 1));
const rnd = (a, b) => a + Math.random() * (b - a);

/** Her photographs for the sky: real ones when there are enough, every featured one, the rest evenly sampled under the cap — in film order. */
function pickPhotos(ctx, tier, reveal) {
  const real = ctx.realPhotos();
  const base = real.length >= 8 ? real : ctx.allPhotos();
  const extras = real.length >= 8 ? ctx.extras() : [];
  const seen = new Set();
  const all = [...base, ...extras].filter((p) => p && (p.thumbUrl || p.url) && !seen.has(p.id) && seen.add(p.id));
  const pool = all.length > 1 && reveal ? all.filter((p) => p.id !== reveal.id) : all;
  const cap = CAP[tier] || CAP.mid;
  const feat = pool.filter((p) => p.featured).slice(0, cap);
  const rest = pool.filter((p) => !p.featured);
  const room = cap - feat.length;
  let pick = rest;
  if (rest.length > room) {
    pick = [];
    for (let i = 0; i < room; i++) pick.push(rest[Math.floor(((i + 0.5) * rest.length) / room)]);
  }
  const chosen = new Set([...feat, ...pick]);
  return pool.filter((p) => chosen.has(p));
}

function createChapter(ctx, el) {
  const { gsap, ui, audio, fx, device } = ctx;
  const T = { ...FALLBACK, ...(ctx.text.constellation || {}) };
  const lines = (Array.isArray(T.lines) ? T.lines : FALLBACK.lines).filter(Boolean);
  const reduced = !!device.reducedMotion;
  const tier = device.tier || 'high';
  const low = tier === 'low';
  const revealPhoto = ctx.role('reveal'); // the film's final photograph: not in the montage (the birthday chapter shows it alone)
  const photos = pickPhotos(ctx, tier, revealPhoto);
  const n = photos.length;

  const listeners = [];
  const on = (t, type, fn, o) => { t.addEventListener(type, fn, o); listeners.push([t, type, fn, o]); };
  const tweens = [];
  const aborted = () => new DOMException('aborted', 'AbortError');
  /** an abortable gsap tween (resolves on complete, rejects when the chapter exits) */
  function tween(target, vars) {
    return new Promise((resolve, reject) => {
      if (ctx.signal.aborted) return reject(aborted());
      const tw = gsap.to(target, { ...vars, onComplete: resolve });
      tweens.push(tw);
      ctx.signal.addEventListener('abort', () => { tw.kill(); reject(aborted()); }, { once: true });
    });
  }

  el.innerHTML = `
    <canvas class="gl" aria-hidden="true"></canvas>
    <div class="cn-bloom" aria-hidden="true"></div>
    <div class="cn-veil" aria-hidden="true"></div>
    <div class="cn-point" aria-hidden="true"></div>`;
  const canvas = el.querySelector('canvas');
  const bloom = el.querySelector('.cn-bloom');
  const veil = el.querySelector('.cn-veil');
  const point = el.querySelector('.cn-point');

  /* ---------------- renderer, camera ---------------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance' });
  const pr = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 2);
  renderer.setPixelRatio(pr);
  renderer.setClearColor(0x04030b, 1);
  renderer.toneMapping = THREE.NoToneMapping; // our shaders write display colours; her photos stay exactly as they are
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  camera.position.set(0, 0, D0);
  const world = new THREE.Group(); // the photographs, the motes and the thread
  scene.add(world);

  const sun = createSun(); // eight long rays and eight flames around a ring, as on the emblem
  const sky = createSky({ device });
  scene.add(sky.nebula, sky.group);
  const secret = createSecret({
    name: ctx.site.her && ctx.site.her.name,
    device,
    host: el,
    onFound: () => {
      ctx.eggs.found('constellation', 'Someone hid your initial in the stars. (It was me.)');
      audio.sfx('chime');
    },
  });
  scene.add(secret.group);

  const flowM = n ? (low ? 34 : tier === 'mid' ? 72 : 110) : 0;
  const sparkM = n ? (low ? 12 : tier === 'mid' ? 24 : 36) : 0;
  const cards = n ? createCards({ count: n, device, motes: flowM + sparkM }) : null;
  if (cards) world.add(cards.group);
  // (a multiple of the sun's period, so the thread's samples land exactly on every ray's tip)
  const segs = sun.period * Math.ceil((low ? 384 : tier === 'mid' ? 512 : 640) / sun.period);
  const thread = n ? createThread({ segments: segs, width: 0.034, device }) : null;
  if (thread) world.add(thread.mesh);
  const rays = n ? createRays({ sun, device }) : null; // the warm light inside the sun's rays
  if (rays) world.add(rays.mesh);

  /* ---------------- layout ---------------- */
  const view = { W: 1, H: 1, portrait: true, tanH: 0.5, aspect: 1, pr, hh: 5, hw: 3 };
  const sunC = new THREE.Vector3();
  let sunW = 3; // the sun's diameter, ray tip to ray tip
  let baseS = 1;
  let slotS = 0.5;
  let gatherS = 0.6;
  let LOOSE = 1.12;
  let LOOSE_Y = 1.1;
  function fit() {
    const W = el.clientWidth || window.innerWidth;
    const H = el.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    const portrait = H > W * 1.05;
    camera.aspect = W / H;
    camera.fov = portrait ? (W / H < 0.56 ? 54 : 50) : 40;
    camera.updateProjectionMatrix();
    const tanH = Math.tan((camera.fov * Math.PI) / 360);
    const hh = D0 * tanH;
    const hw = hh * camera.aspect;
    Object.assign(view, { W, H, portrait, tanH, aspect: camera.aspect, hh, hw });
    // a smaller sun when there are only a few photographs
    const few = n >= 8 ? 1 : 0.62 + (0.38 * Math.max(0, n - 1)) / 7;
    sunW = Math.min(2 * hw * (portrait ? 0.86 : 0.72), (2 * hh * (portrait ? 0.5 : 0.66)) / sun.height) * few;
    sunC.set(0, hh * (portrait ? 0.07 : 0.05), 0);
    LOOSE = portrait ? 1.08 : 1.24;
    LOOSE_Y = portrait ? 1.24 : 0.98;
    baseS = portrait ? 2 * hw * 0.24 : 2 * hh * 0.16;
    // gathered, they sit on a loose ring larger than the sun's; on its ring, at their places
    const spacing = (sun.ringLength * sunW) / Math.max(1, n);
    gatherS = clamp(spacing * GATHER * LOOSE * (portrait ? 0.86 : 0.9), baseS * 0.26, baseS * 0.56);
    slotS = clamp(spacing * 0.92, baseS * 0.2, baseS * 0.6);
    gatherS = Math.max(gatherS, slotS * 1.04);
    if (cards) cards.setPixelRatio(pr);
    sky.setPixelRatio(pr);
    secret.layout(view);
    const px = (sunW / (2 * hw)) * W;
    const bs = px * 1.9;
    Object.assign(bloom.style, { width: `${bs}px`, height: `${bs}px`, left: `${W / 2 - bs / 2}px`, top: `${H / 2 - (sunC.y / hh) * (H / 2) - bs / 2}px` });
  }

  /* ---------------- the photographs ---------------- */
  // scattered through the dark at many depths (best-candidate sampling, so they never clump),
  // featured ones nearer and larger
  const items = [];
  const placed = [];
  const landscape = (el.clientWidth || window.innerWidth) > (el.clientHeight || window.innerHeight) * 1.05;
  photos.forEach((p, k) => {
    let best = null;
    for (let c = 0; c < 26; c++) {
      const sx = rnd(-0.9, 0.9);
      const sy = rnd(landscape ? -0.64 : -0.52, 0.86);
      let d = Infinity;
      for (const q of placed) d = Math.min(d, Math.hypot((sx - q[0]) * 1.2, sy - q[1]));
      if (!best || d > best.d) best = { sx, sy, d };
    }
    placed.push([best.sx, best.sy]);
    let z = p.featured ? rnd(-1.5, 2.4) : 1.6 - 17.5 * Math.pow(Math.random(), 0.85);
    if (best.sy < (landscape ? -0.42 : -0.28) && z > -4) z = rnd(-10, -4); // nothing big near the subtitles
    items.push({
      photo: p,
      k,
      featured: !!p.featured,
      r: clamp(Number(p.ratio) || 1, 0.5, 2),
      sx: best.sx,
      sy: best.sy,
      z,
      vx: reduced ? 0 : rnd(-1, 1) * 0.0055,
      vy: reduced ? 0 : rnd(-1, 1) * 0.0035,
      sizeK: p.featured ? 1.22 : rnd(0.82, 1.12),
      rot: {
        bz: rnd(-0.12, 0.12), ax: rnd(0.05, 0.14), ay: rnd(0.16, 0.42), az: rnd(0.03, 0.08),
        fx: rnd(0.11, 0.2), fy: rnd(0.07, 0.15), fz: rnd(0.05, 0.12), px: rnd(0, 6.28), py: rnd(0, 6.28), pz: rnd(0, 6.28),
      },
      u: 0,
      appearAt: Infinity,
      passAt: -1,
      seed: Math.random(),
      rect: null,
      ready: 0,
      pos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      w: 1,
      h: 1,
      opacity: 0,
      lit: 0,
      light: 0,
      star: { size: 0, alpha: 0, twinkle: 1 },
      anchor: new THREE.Vector3(),
    });
  });
  // order them around the sun by angle (clockwise from the top), so the thread circles instead of zig-zagging
  const byAngle = [...items].sort((a, b) => Math.atan2(a.sx * 1.2, a.sy - 0.08) - Math.atan2(b.sx * 1.2, b.sy - 0.08));
  // with only a few photos, the thread also passes through a few points of a loose circle between them
  const q = n ? Math.max(1, Math.ceil(12 / n)) : 1;
  const m = n * q;
  byAngle.forEach((it, rank) => { it.u = (rank * q + 0.5) / m; it.rank = rank; });
  const anchors = Array.from({ length: m }, () => new THREE.Vector3());

  /* ---------------- state (tweened by the script, read every frame) ---------------- */
  const S = { push: 0, gather: 0, motes: 0, thread: 0, sun: 0, star: 0, glow: 0, bloom: 0, atlas: 0, collapse: 0 };
  const pulses = [];
  let flare = 0; // how far the rays reach out beyond their length, as the sun pulses
  const dd = (u) => 2 * Math.min(u - Math.floor(u), 1 - (u - Math.floor(u))); // 0 at the top of the sun, 1 at its foot
  const hkU = (u) => ease5(clamp(S.sun * 1.6 - 0.6 * dd(u), 0, 1));
  const lightU = (u) => sine(clamp(S.star * 1.5 - 0.5 * dd(u), 0, 1));
  const settleU = (u) => hkU(u) ** 2;

  const h2 = { x: 0, y: 0 };
  /** the sun's line at u: its ring and rays (the rays reach out by `fl` as it pulses) */
  function sunAt(u, out, z = 0, fl = 0) {
    sun.at(u, h2, fl);
    return out.set(sunC.x + h2.x * sunW, sunC.y + h2.y * sunW, z);
  }
  /** the sun's ring at the angle of u, scaled (the photographs' places) */
  function ringAt(u, out, scale = 1, z = 0, sy = 1) {
    sun.ring(u, h2, scale);
    return out.set(sunC.x + h2.x * sunW, sunC.y + h2.y * sunW * sy, z);
  }
  const hp = new THREE.Vector3();
  function curve(u, out) {
    if (!m) return sunAt(u, out, 0, flare);
    periodicInterp(anchors, u, out);
    const k = hkU(u);
    if (k > 0) out.lerp(sunAt(u, hp, 0, flare), k);
    return out;
  }
  const envFn = (u) => {
    const e = Math.abs(Math.sin((Math.PI * (u * m - 0.5)) / q));
    return lerp(Math.pow(e, 0.7), 0.3, hkU(u));
  };

  let t = 0; // the chapter's own clock (ambient motion)
  /** the sun's warm pulses: a soft swell of light, then a long glow out (0 … 1) */
  const pulseEnv = () => {
    const now = performance.now() / 1000;
    let b = 0;
    const swell = (x) => (x < 0 ? 0 : x < 0.32 ? Math.sin((Math.PI / 2) * (x / 0.32)) ** 2 : Math.exp(-(x - 0.32) / 0.75));
    for (const t0 of pulses) b = Math.max(b, swell(now - t0));
    return b;
  };

  const pS = new THREE.Vector3();
  const pL = new THREE.Vector3();
  const pG = new THREE.Vector3();
  const pH = new THREE.Vector3();
  const eul = new THREE.Euler();
  const qId = new THREE.Quaternion();
  let threadZ = -0.3;
  /** the point on the thread plane that sits exactly behind p on screen (k → 1: p itself, for the sun) */
  function toThreadPlane(p, out, k) {
    const c = camera.position;
    const f = (c.z - threadZ) / Math.max(0.1, c.z - p.z);
    const x = c.x + (p.x - c.x) * f;
    const y = c.y + (p.y - c.y) * f;
    return out.set(lerp(x, p.x, k), lerp(y, p.y, k), lerp(threadZ, p.z - 0.05, k));
  }
  function updateItems(pulse) {
    const { tanH, aspect } = view;
    const g = sine(S.gather);
    const rt = reduced ? 0 : t;
    for (const it of items) {
      // drifting in the dark
      const dist = D0 - it.z;
      pS.set((it.sx + it.vx * t) * dist * tanH * aspect * 0.94, (it.sy + it.vy * t) * dist * tanH * 0.94, it.z);
      // …toward each other: onto a loose ring around where the sun will be, out of the depths
      // (each keeps some of its depth, placed so that it still lands on the ring on screen)
      const zG = it.z * 0.2;
      const kz = (D0 - zG) / D0;
      ringAt(it.u, pL, GATHER * LOOSE * (1 + (it.seed - 0.5) * 0.12), 0, LOOSE_Y);
      pL.set(pL.x * kz + Math.sin(t * 0.4 + it.seed * 9) * 0.05, pL.y * kz + Math.cos(t * 0.33 + it.seed * 7) * 0.05, zG);
      pG.set(it.sx * (D0 - zG) * tanH * aspect * 0.94, it.sy * (D0 - zG) * tanH * 0.94, zG);
      pL.lerp(pG, 0.12);
      it.pos.lerpVectors(pS, pL, g);
      // …onto the sun's ring (and, as a star, a little inside it)
      const hk = hkU(it.u);
      const light = lightU(it.u);
      if (hk > 0) {
        // as it turns to light it slips behind the thread (a fading print must not hide the glow)
        ringAt(it.u, pH, lerp(1, STAR, smooth(0.2, 0.9, light)), 0.05 - 0.35 * smooth(0.45, 0.85, light));
        it.pos.lerp(pH, hk);
      }
      // a slow turn, settling to face us
      const R = it.rot;
      const amp = (1 - 0.5 * g) * (reduced ? 0.35 : 1);
      eul.set(
        R.ax * Math.sin(rt * R.fx + R.px) * amp,
        R.ay * Math.sin(rt * R.fy + R.py) * amp,
        (R.bz + R.az * Math.sin(rt * R.fz + R.pz)) * amp,
      );
      it.quat.setFromEuler(eul).slerp(qId, hk);
      // size: a little smaller as they gather, then the size of their place on the ring, then a star
      let s = baseS * it.sizeK;
      s = lerp(s, gatherS * (it.featured ? 1.15 : 1), g);
      s = lerp(s, slotS * (it.featured ? 1.12 : 1), hk);
      s *= 1 - 0.8 * smooth(0, 0.85, light);
      const sq = Math.sqrt(it.r);
      it.w = s * sq;
      it.h = s / sq;
      it.opacity = smooth(it.appearAt, it.appearAt + (reduced ? 1 : 2), t) * S.atlas * (it.ready ? 1 : 0); // an image that never loaded stays a star only
      // the thread touches it
      if (it.passAt < 0 && thread && thread.head >= it.u) it.passAt = t;
      const since = it.passAt < 0 ? -1 : t - it.passAt;
      it.lit = since < 0 ? 0 : smooth(0, 0.35, since) * (0.5 + 0.5 * Math.exp(-since / 1.6)) * (1 - 0.5 * hk);
      it.light = light;
      const st = it.star;
      st.alpha = smooth(0.25, 0.8, light) * (0.92 + 0.4 * pulse);
      st.size = (low ? 28 : 34) * (it.featured ? 1.2 : 1) * (0.7 + 0.3 * light) * (1 + 0.3 * pulse);
    }
    // the thread runs on a plane just behind every print, meeting each one behind its centre (along the
    // camera ray), so it shows between the photographs and never crosses her face
    let zMin = 0;
    for (const it of items) if (it.opacity > 0.01) zMin = Math.min(zMin, it.pos.z);
    threadZ = zMin - 0.3;
    for (const it of items) {
      toThreadPlane(it.pos, it.anchor, hkU(it.u));
    }
    // the thread's anchors in ring order (plus a few points of a loose circle when there are only a few photos)
    for (const it of items) anchors[it.rank * q].copy(it.anchor);
    if (q > 1) {
      for (let r = 0; r < n; r++) {
        const a = anchors[r * q];
        const b = anchors[((r + 1) % n) * q];
        for (let j = 1; j < q; j++) {
          const u = (r * q + j + 0.5) / m;
          ringAt(u, pL, GATHER * LOOSE, 0, LOOSE_Y);
          toThreadPlane(pL, pL, 0);
          anchors[r * q + j].lerpVectors(a, b, j / q).lerp(pL, 0.6);
        }
      }
    }
  }

  // motes: golden particles drifting photo → photo along the thread, and sparks shed by its head
  const flow = Array.from({ length: flowM }, (_, i) => ({ a: i / Math.max(1, flowM) + rnd(0, 0.01), v: rnd(0.016, 0.03), ph: rnd(0, 6.28), s: rnd(2.6, 4.6) }));
  const sparks = Array.from({ length: sparkM }, () => ({ life: 1, dur: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 3 }));
  let sparkAcc = 0;
  let sparkI = 0;
  const headP = new THREE.Vector3();
  const moteOut = { a: 0, s: 0 };
  function updateMotes(dt, pulse) {
    if (!cards) return;
    const head = thread ? thread.head : 0;
    const drawing = head > 0.001 && head < 1;
    if (drawing) {
      curve(Math.min(head, 0.9999), headP);
      sparkAcc += dt * (low ? 12 : 22);
      while (sparkAcc >= 1 && sparkM) {
        sparkAcc -= 1;
        const sp = sparks[sparkI++ % sparkM];
        sp.life = 0;
        sp.dur = rnd(0.8, 1.6);
        sp.p.copy(headP);
        sp.v.set(rnd(-1, 1), rnd(-1.2, 0.7), rnd(-1, 1)).multiplyScalar(0.22);
        sp.s = rnd(2.4, 4);
      }
    }
    for (const sp of sparks) {
      if (sp.life >= 1) continue;
      sp.life += dt / sp.dur;
      sp.v.multiplyScalar(1 - dt * 1.2);
      sp.p.addScaledVector(sp.v, dt);
    }
    const R = moteOut;
    cards.writeMotes((i, out) => {
      if (i < flowM) {
        if (S.motes < 0.002) { out.set(0, 0, 0); R.a = 0; R.s = 0; return R; }
        const f = flow[i];
        const u = (((f.a + f.v * t) % 1) + 1) % 1;
        curve(u, out);
        const hk = hkU(u);
        const j = 0.07 * (1 - 0.65 * hk);
        out.x += Math.sin(t * 1.3 + f.ph) * j;
        out.y += Math.cos(t * 1.1 + f.ph * 1.7) * j;
        out.z += Math.sin(t * 0.9 + f.ph * 2.3) * j;
        const ahead = u <= head ? 1 : 0.28;
        const tw = 0.6 + 0.4 * Math.sin(t * 2.6 + f.ph * 5);
        R.a = S.motes * ahead * tw * (1 + 0.6 * pulse);
        R.s = f.s * (1 + 0.35 * pulse);
        return R;
      }
      const sp = sparks[i - flowM];
      if (!sp || sp.life >= 1) { out.set(0, 0, 0); R.a = 0; R.s = 0; return R; }
      out.copy(sp.p);
      R.a = Math.pow(1 - sp.life, 1.5) * 0.9;
      R.s = sp.s;
      return R;
    });
  }

  /* ---------------- the loop ---------------- */
  let raf = 0;
  let running = true;
  let glOn = true;
  let lastNow = 0;
  const look = new THREE.Vector3();
  let lastBloom = '';
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = lastNow ? Math.min(0.2, (now - lastNow) / 1000) : 0.016;
    lastNow = now;
    t += dt;
    if (!glOn) return;
    const pulse = pulseEnv();
    // the sun's pulses: every ray reaches a little further out and glows warmer (the ring stays still)
    flare = pulse * (reduced ? 0.05 : 0.14);
    // camera: a slow push-in through the dark with a little sway; settles square to the sun
    const settle = sine(S.sun);
    const drift = reduced ? 0 : 1 - settle;
    const D = reduced ? D0 : lerp(11.8, D0, sine(S.push));
    camera.position.set(Math.sin(t * 0.071) * 0.42 * drift, Math.sin(t * 0.053 + 1.3) * 0.26 * drift, D);
    look.set(camera.position.x * 0.3, camera.position.y * 0.3, 0);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    // at the very end the whole sun draws in toward its centre, into a single point of light
    const ck = 1 - 0.985 * S.collapse * S.collapse;
    world.scale.setScalar(ck);
    world.position.copy(sunC).multiplyScalar(1 - ck);
    if (n) {
      updateItems(pulse);
      cards.write(items, camera);
      cards.setTime(t);
      cards.setHalo(1 + 0.6 * S.glow);
      thread.setOpacity(S.thread > 0 ? 1 : 0);
      if (S.thread > 0) {
        thread.setWidth(lerp(0.05, 0.036, S.sun) * Math.max(1, (camera.position.z - threadZ) / D0));
        thread.set(curve, envFn);
      }
      thread.setHead(S.thread >= 1 ? 1.02 : S.thread);
      thread.setBright(lerp(1.15, 0.9, S.sun) + 0.45 * S.glow + 0.8 * pulse);
      thread.setHalo(0.45 + 0.9 * S.glow + 1.3 * pulse);
      thread.setSwell(1 + 0.3 * S.glow + 0.25 * pulse);
      thread.setGlowWidth(lerp(9, 5, S.sun)); // a slimmer glow once it is the sun, so its rays stay crisp
      thread.update(t, dt);
      rays.update(curve, settleU, smooth(0.5, 1, S.sun) * (0.5 + 0.3 * S.glow + 0.55 * pulse));
      updateMotes(dt, pulse);
    }
    const bo = clamp(S.bloom * 0.55 + pulse * 0.45 * S.bloom, 0, 1).toFixed(3);
    if (bo !== lastBloom) { bloom.style.opacity = bo; lastBloom = bo; }
    sky.update(t, camera);
    secret.update(t, camera);
    renderer.render(scene, camera);
  }

  fit();
  on(window, 'resize', fit);
  raf = requestAnimationFrame(frame);

  /* ---------------- the script ---------------- */
  async function play() {
    ctx.letterbox(true);
    fx.dust({ density: 0.05, alpha: 0.45, speed: 0.4 });
    audio.setMood('quiet');
    gsap.set(veil, { opacity: 1 });
    tweens.push(gsap.to(veil, { opacity: 0, duration: reduced ? 1.2 : 3, ease: 'sine.inOut' }));
    // the prints are drawn into one atlas while the title plays
    const maxTex = renderer.capabilities.maxTextureSize || 4096;
    const atlasP = n
      ? buildAtlas(photos, { cell: low ? 240 : tier === 'mid' ? 384 : 448, maxSize: Math.min(maxTex, low ? 2048 : 4096), preload: ctx.preload, timeout: 8 })
        .then((a) => {
          if (!running) { a.texture.dispose(); return; }
          cards.setAtlas(a.texture);
          photos.forEach((p, k) => { items[k].rect = a.rects[k]; items[k].ready = a.rects[k].ok ? 1 : 0; });
          gsap.to(S, { atlas: 1, duration: 0.8 });
        })
        .catch((err) => console.warn('[constellation] atlas', err))
      : Promise.resolve();

    await ctx.wait(reduced ? 0.4 : 1.1);
    await ui.chapterCard(T.kicker, T.title);
    secret.show(reduced ? 1 : 3);

    const half = Math.ceil(lines.length / 2);
    const first = lines.slice(0, half);
    const second = lines.slice(half);

    if (n) {
      await Promise.race([atlasP, ctx.wait(6)]);
      audio.setMood('tender');
      // they appear one by one out of the dark, in the order the film showed them:
      // quick at first, then slower and slower, so the last ones get time to be seen
      const order = items;
      const spread = reduced ? 1.2 : Math.min(9, 3 + n * 0.4);
      order.forEach((it, i) => { it.appearAt = t + 0.2 + (i / Math.max(1, n - 1)) ** 1.8 * spread + rnd(0, 0.12); });
      const lastIn = Math.max(...order.map((it) => it.appearAt));
      if (window.__CN_DEV__) { // tests only
        window.__cn = { montage: order.map((it) => ({ id: it.photo.id, at: it.appearAt - t })), reveal: revealPhoto ? revealPhoto.id : null };
        Object.defineProperties(window.__cn, { state: { value: S }, pulses: { value: pulses } }); // live, and left out when __cn is read whole
        window.__cnShape = shapeOnScreen;
        window.__cnPixels = pixelsOnScreen;
      }
      tweens.push(gsap.to(S, { push: 1, duration: reduced ? 1 : 26, ease: 'none' }));
      await ctx.wait(reduced ? 0.6 : 1.4);
      await ui.narrate(first, { position: 'bottom' });
      await ctx.wait(reduced ? 0.2 : 1.2);
      // the last photographs get their moment before anything moves (capped, should the clock stall)
      for (let k = 0; !reduced && t < lastIn + 0.9 && k < 60; k++) await ctx.wait(0.1);

      // they begin moving toward each other; golden motes start to pass between them
      audio.setMood('wonder');
      const gatherP = tween(S, { gather: 1, duration: reduced ? 3.2 : 8.5, ease: 'none' });
      tweens.push(gsap.to(S, { motes: 0.75, duration: reduced ? 1.5 : 3.5, delay: reduced ? 0.3 : 1, ease: 'sine.inOut' }));
      await ctx.wait(reduced ? 1 : 2.6);

      // the golden thread travels from photograph to photograph
      audio.sfx('shimmer');
      const threadP = tween(S, { thread: 1, duration: reduced ? 4.2 : Math.min(11, 7.5 + n * 0.06), ease: 'sine.inOut' });
      const narrateP = (async () => {
        await ctx.wait(reduced ? 0.5 : 2);
        if (second.length) await ui.narrate(second, { position: 'bottom' });
      })();
      await Promise.all([gatherP, threadP, narrateP]);

      // …and draws the film's sun: the photographs settle in a circle on its ring, the rays radiate out
      audio.sfx('swell');
      tweens.push(gsap.to(S, { motes: 1, bloom: 0.25, duration: 3 }));
      await tween(S, { sun: 1, duration: reduced ? 2.4 : 4.6, ease: 'none' });

      // …and become a constellation
      audio.sfx('magic');
      tweens.push(gsap.to(S, { glow: 1, bloom: 0.55, duration: reduced ? 1.4 : 2.6, ease: 'sine.inOut' }));
      await tween(S, { star: 1, duration: reduced ? 1.6 : 3, ease: 'none' });
      await ctx.wait(reduced ? 0.3 : 0.7);

      // the sun pulses twice: warm light through every ray (a low chime, then a higher one with a shimmer)
      for (let b = 0; b < 2; b++) {
        audio.sfx('chime', { note: b ? 'F6' : 'C6' });
        if (b) audio.sfx('shimmer', { volume: 0.5 });
        pulses.push(performance.now() / 1000 + 0.01);
        await ctx.wait(1.5);
      }
      await ctx.wait(reduced ? 0.6 : 1.2);
    } else {
      // no photographs at all: the words, the stars, and then the golden point
      await ctx.wait(0.8);
      await ui.narrate(lines, { position: 'bottom' });
      await ctx.wait(0.6);
    }

    await ui.waitContinue('Continue');

    // the sun gathers all its light into a single golden point at its centre, on a black screen
    // (the music plays on: the silence, her final photograph and her title come after the 7,305 days)
    audio.sfx('shimmer');
    secret.hide(reduced ? 0.8 : 1.8);
    fx.dust({ density: 0, alpha: 0 });
    fx.trail(false); // nothing but the point on the last frame (restored on exit)
    const pt = sunOnScreen();
    Object.assign(point.style, { left: `${pt.x - pt.left}px`, top: `${pt.y - pt.top}px` });
    if (!reduced) tweens.push(gsap.to(S, { collapse: 1, glow: 1, bloom: 0, duration: 2.6, ease: 'sine.in' }));
    tweens.push(gsap.fromTo(point, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: reduced ? 1.1 : 1.0, delay: reduced ? 0.6 : 2.6, ease: 'sine.out' })); // (lit as the black closes)
    // (the veil follows the draw-in a moment later, so the sun is seen gathering, not just fading)
    await tween(veil, { opacity: 1, duration: reduced ? 1.4 : 2.6, delay: reduced ? 0 : 0.8, ease: 'power2.in' });
    glOn = false;
    canvas.style.visibility = 'hidden';
    ctx.letterbox(false);
    fx.clear();
    await ctx.wait(0.8);
    ctx.next({ kind: 'point', x: pt.x, y: pt.y, color: '#ffd98a' });
  }

  /** where the sun's centre is on screen (client css px), and the chapter's own top-left */
  function sunOnScreen() {
    const r = el.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    const v = sunC.clone().project(camera);
    return { x: Math.round(c.left + ((v.x + 1) / 2) * c.width), y: Math.round(c.top + ((1 - v.y) / 2) * c.height), left: r.left, top: r.top };
  }

  /** tests only: where the photographs and the sun's line are on screen right now (css px) */
  function shapeOnScreen() {
    const r = canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    const px = (p) => {
      v.copy(p).applyMatrix4(world.matrixWorld).project(camera);
      return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
    };
    const o = new THREE.Vector3();
    const line = [];
    for (let j = 0; j < segs; j++) line.push(px(curve(j / segs, o)));
    const state = Object.fromEntries(Object.keys(S).filter((k) => typeof S[k] === 'number').map((k) => [k, S[k]]));
    return { center: px(sunC), photos: items.map((it) => px(it.pos)), line, period: sun.period, flare, state };
  }

  /** tests only: draw the current frame and read the canvas around each css-px point → { max, mean } rgb (a (2r+1)² block) */
  function pixelsOnScreen(points, r = 1) {
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const b = canvas.getBoundingClientRect();
    const k = canvas.width / b.width;
    const side = 2 * r + 1;
    const buf = new Uint8Array(side * side * 4);
    return points.map(([x, y]) => {
      const X = Math.round((x - b.left) * k) - r;
      const Y = Math.round(canvas.height - (y - b.top) * k) - r;
      gl.readPixels(X, Y, side, side, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let max = [0, 0, 0];
      const sum = [0, 0, 0];
      for (let i = 0; i < side * side; i++) {
        const c = [buf[i * 4], buf[i * 4 + 1], buf[i * 4 + 2]];
        sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2];
        if (c[0] + c[1] + c[2] > max[0] + max[1] + max[2]) max = c;
      }
      return { max, mean: sum.map((v) => Math.round(v / (side * side))) };
    });
  }

  function dispose() {
    running = false;
    if (window.__cnShape === shapeOnScreen) delete window.__cnShape;
    if (window.__cnPixels === pixelsOnScreen) delete window.__cnPixels;
    fx.trail(true);
    cancelAnimationFrame(raf);
    listeners.forEach(([tg, type, fn, o]) => tg.removeEventListener(type, fn, o));
    listeners.length = 0;
    tweens.forEach((tw) => tw && tw.kill && tw.kill());
    tweens.length = 0;
    gsap.killTweensOf(S);
    gsap.killTweensOf([veil, bloom, point]);
    secret.dispose();
    if (thread) thread.dispose();
    if (rays) rays.dispose();
    if (cards) cards.dispose();
    sky.dispose();
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { play, dispose };
}

export default {
  id: 'constellation',
  title: 'Every Little Piece of You',
  async enter(ctx, el) {
    const ch = createChapter(ctx, el);
    this._ch = ch;
    await ch.play();
  },
  async exit() {
    const ch = this._ch;
    this._ch = null;
    if (ch) ch.dispose();
  },
};
