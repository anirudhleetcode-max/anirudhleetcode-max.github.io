// "What Makes You, You" · movement 1 — PANI PURI: bright, playful, evening street-food joy.
//
// An original street-food stall at dusk — a playful fantasy of something she loves, never a memory:
// a varnished wooden counter with a steel trim and a hand-painted front, a striped canopy on four
// poles, one warm bare bulb, two strings of little lights and a dusk sky over soft far rooftops. On
// the counter: a stainless-steel pot of mint-green pani (a few boondi and mint leaves floating) with
// its ladle, five small steel bowls (glossy tamarind chutney, green chutney, the potato-chickpea
// filling, chopped onion, sev), a basket heaped with whole puris, and a steel plate of six pani puris —
// each a thin, golden, blistered, hollow shell (a displaced sphere with a cracked-open top, its inner
// wall and broken edge modelled, blisters in a normal map) holding potato, chickpeas, sev, coriander
// and a sheen of pani. The stylized Deepu (./figure.js — the chapter's one character) comes to the
// counter and eats one, delighted.
//
// Beats (≈25 s — the brief: polished rather than long; reduced motion ≈25 s in four still shots
// joined by veil cuts):
//   macro    from black: a low macro of one puri, the bulb's light raking across its crisp shell
//   pour     a ladle tips a thin stream of pani into it; it fills and glints (splash) — she is
//            readied off-frame meanwhile, so her entrance costs nothing on screen
//   enter    pull back over the counter (the plate, the chutneys, the pot) as she walks in behind
//            it, stops, notices the plate
//   reach    she leans in, reaches, picks it up (plate)
//   bite     close: she eats it whole (crunch) — a few crumbs and droplets
//   delight  happy crescent eyes, a little shoulder wiggle, a tiny sparkle
//   wide     the whole stall at dusk; the words (env.T.panipuriLines) begin and carry on over…
//   portal   a drop of pani falls to the plate; its ripple becomes a golden ring, the golden thread
//            rises out of it and the camera follows; the veil closes warm (#ffe3a3) → manchuria
// Contract: ./kit.js. Everything is built in build(); update() writes transforms, attributes and
// uniforms only. Dev: window.__LITTLE_DEV__ + ?at=<beat>[&hold=<sec>] starts at that beat (and
// freezes the frame <sec> seconds into it, for screenshots).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStrand, PathSampler, createRig, glowTexture, rng, TAU, clamp, lerp, damp, smooth } from './kit.js';
import { createFigure } from './figure.js';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const ZAX = new THREE.Vector3(0, 0, 1);
const BEATS = ['macro', 'pour', 'enter', 'reach', 'bite', 'delight', 'wide', 'portal'];
const SHOT_OF = ['macro', 'pour', 'medium', 'reach', 'bite', 'delight', 'wide', 'portal']; // (each beat's opening shot)
const CT = 0.96;                     // the counter's top
const PR = 0.024;                    // a puri's radius (a real one is ≈ 4.5–5 cm across)
const PSQ = 0.86;                    // …a little squat
const PBASE = 0.74;                  // its flat base, as a fraction of PR below the centre
const PLATE = new THREE.Vector3(0, CT, -0.05);
const PFLOOR = CT + 0.0034;          // the plate's floor
const PCY = PFLOOR + PBASE * PR;     // a puri's centre height on the plate
const RING = 0.057;                  // the six sit in a ring on the plate
const GRIP = 0.027;                  // a held puri's centre, out of the palm
const FIG_AT = new THREE.Vector3(-0.03, 0, -0.42);
const ENTER_X = -1.25;               // where her walk in begins (off-frame)
const POT = new THREE.Vector3(-0.6, CT, -0.1);
const POT_PANI = 0.152;              // the pani's level in the pot
const BULB = new THREE.Vector3(0.12, 1.97, 0.06);
const BOWLS = [[0.2, 0.07], [0.31, 0.05], [0.25, -0.05], [0.36, -0.08], [0.22, -0.17]];
const BASKET = new THREE.Vector3(0.62, CT, -0.08);
const WARM_VEIL = '#ffe3a3';

// per-frame scratch: update() allocates nothing
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const _s1 = new THREE.Vector3();
const _e1 = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const STRAND_OPTS = { wobble: 0.25 };
const SPK_OFFS = [[0.15, 0.1], [-0.13, 0.13], [0.17, -0.04]]; // the delight sparkles round her head (camera right / up)

// ------------------------------------------------------------------ canvas painting (build time)
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d') }; }

/**
 * A puri's skin: colour + height, equirectangular (u around, v from the crown down). The top half of
 * the canvas is the outer shell, the bottom half its inner wall (paler, matte; the broken edge palest).
 */
function paintPuri(W, H, seed) {
  const R = rng(seed);
  const col = cnv(W, H), hgt = cnv(W, H);
  const g = col.g, h = hgt.g;
  const H2 = H / 2, k = W / 1024;
  let gr = g.createLinearGradient(0, 0, 0, H2);
  gr.addColorStop(0, '#ecca86'); gr.addColorStop(0.3, '#e2b86e'); gr.addColorStop(0.65, '#d7a95f'); gr.addColorStop(1, '#c4914c');
  g.fillStyle = gr; g.fillRect(0, 0, W, H2);
  gr = g.createLinearGradient(0, H2, 0, H);
  gr.addColorStop(0, '#f7dfaa'); gr.addColorStop(0.05, '#f0d093'); gr.addColorStop(0.2, '#e6bf78'); gr.addColorStop(1, '#d5a45c');
  g.fillStyle = gr; g.fillRect(0, H2, W, H2);
  h.fillStyle = 'rgb(128,128,128)'; h.fillRect(0, 0, W, H);
  const wrap = (x, fn) => { fn(x); if (x < W * 0.12) fn(x + W); if (x > W * 0.88) fn(x - W); };
  // (equirect: a round spot on the shell is 2/sinθ times wider than tall on the canvas)
  const stretch = (y0, y) => Math.min(5, 2 / Math.max(0.28, Math.sin(((y - y0) / H2) * Math.PI)));
  const spot = (ctx, x, y, sx, r, stops) => {
    wrap(x, (xx) => {
      ctx.save(); ctx.translate(xx, y); ctx.scale(sx, 1);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      for (const [o, c] of stops) rg.addColorStop(o, c);
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.restore();
    });
  };
  const gauss = (c, a) => [[0, `rgba(${c},${a})`], [0.25, `rgba(${c},${a * 0.78})`], [0.5, `rgba(${c},${a * 0.37})`], [0.75, `rgba(${c},${a * 0.1})`], [1, `rgba(${c},0)`]];
  // browning: soft golden-brown clouds (more toward the base, where it sat in the oil longest)
  for (let i = 0; i < 90; i++) {
    const y = H2 * (0.08 + Math.pow(R(), 0.55) * 0.92), r = (8 + R() * 30) * k;
    spot(g, R() * W, y, stretch(0, y), r, gauss(R() < 0.7 ? '168,92,30' : '132,64,20', 0.16 + R() * 0.26));
  }
  // pale, puffed patches where the dough is thinnest
  for (let i = 0; i < 40; i++) {
    const y = H2 * (0.06 + R() * 0.6), r = (10 + R() * 24) * k;
    spot(g, R() * W, y, stretch(0, y), r, gauss('252,232,180', 0.14 + R() * 0.18));
  }
  // the bubbly surface: soft raised blisters of crisp dough (a little paler on top), large and small
  for (let i = 0; i < 1500; i++) {
    const big = R() < 0.1;
    const y = H2 * (0.04 + R() * 0.94), x = R() * W, r = (big ? 6 + R() * 7 : 2 + R() * 4) * k, sx = stretch(0, y);
    spot(h, x, y, sx, r, gauss('255,255,255', big ? 0.3 + R() * 0.2 : 0.18 + R() * 0.24));
    if (R() < 0.6) spot(g, x - r * 0.12 * sx, y - r * 0.15, sx, r * 0.85, gauss(R() < 0.75 ? '250,222,160' : '176,104,40', 0.1 + R() * 0.16));
  }
  // low undulations
  for (let i = 0; i < 40; i++) {
    const y = H2 * (0.1 + R() * 0.9), r = (18 + R() * 40) * k;
    spot(h, R() * W, y, stretch(0, y), r, gauss(R() < 0.5 ? '255,255,255' : '0,0,0', 0.1));
  }
  // fine grain in the height (crispness)
  for (let i = 0; i < 9000; i++) {
    h.fillStyle = R() < 0.5 ? `rgba(255,255,255,${0.03 + R() * 0.04})` : `rgba(0,0,0,${0.03 + R() * 0.04})`;
    h.fillRect(R() * W, R() * H2, 1.5 * k, 1.5 * k);
  }
  // inner wall: faint bubbles, streaks of translucent dough
  for (let i = 0; i < 90; i++) {
    const y = H2 + H2 * (0.08 + R() * 0.9), r = (3 + R() * 9) * k, sx = stretch(H2, y);
    spot(g, R() * W, y, sx, r, [[0, `rgba(250,232,186,${0.2 + R() * 0.25})`], [1, 'rgba(250,232,186,0)']]);
    spot(h, R() * W, y, sx, r, [[0, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']]);
  }
  // fine speckle (toasted flecks, flour)
  for (let i = 0; i < 2600; i++) {
    const inner = R() < 0.25;
    const y = inner ? H2 + R() * H2 : R() * H2;
    g.fillStyle = R() < 0.55 ? `rgba(120,62,20,${0.08 + R() * 0.2})` : `rgba(255,236,190,${0.1 + R() * 0.2})`;
    g.fillRect(R() * W, y, (1 + R() * 1.4) * k * 1.4, (0.8 + R() * 0.8) * k);
  }
  // the broken edge (a band at the top of the inner half): pale, flaky
  g.fillStyle = '#f8e3b2'; g.fillRect(0, H2, W, 6 * k);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(205,150,80,${0.2 + R() * 0.3})`; g.fillRect(R() * W, H2 + R() * 6 * k, 2 + R() * 6, 1 + R() * 2); }
  return { color: col.c, height: hgt.c };
}

/** A tangent-space normal map from a height canvas (CPU Sobel, once). */
function normalMapFrom(hc, strength) {
  const W = hc.width, H = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, W, H).data;
  const out = cnv(W, H);
  const img = out.g.createImageData(W, H);
  const d = img.data;
  const hv = (x, y) => src[((((y + H) % H) * W) + ((x + W) % W)) * 4];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = ((hv(x + 1, y) - hv(x - 1, y)) / 255) * strength;
      const dy = ((hv(x, y + 1) - hv(x, y - 1)) / 255) * strength;
      // (canvas y runs down, the texture's v runs up)
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * W + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }
  out.g.putImageData(img, 0, 0);
  return out.c;
}

/** Varnished counter planks running along x, three across its depth. */
function paintWood(W, H, seed) {
  const R = rng(seed);
  const { c, g } = cnv(W, H);
  const rows = 3, rh = H / rows;
  const tones = ['#7a4626', '#6c3d22', '#80502c'];
  for (let r = 0; r < rows; r++) {
    const gr = g.createLinearGradient(0, r * rh, 0, (r + 1) * rh);
    gr.addColorStop(0, tones[r]); gr.addColorStop(0.5, '#75442a'); gr.addColorStop(1, tones[(r + 1) % 3]);
    g.fillStyle = gr; g.fillRect(0, r * rh, W, rh);
    for (let k = 0; k < 46; k++) {
      const y0 = r * rh + R() * rh, amp = 1 + R() * 4, f = 0.004 + R() * 0.01, ph = R() * TAU;
      g.strokeStyle = R() < 0.7 ? `rgba(48,22,10,${0.1 + R() * 0.22})` : `rgba(214,150,96,${0.06 + R() * 0.1})`;
      g.lineWidth = 0.6 + R() * 1.8;
      g.beginPath();
      for (let x = 0; x <= W; x += 8) { const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph * 2) * amp * 0.3; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
    // a knot or two
    for (let n = 0; n < 2; n++) {
      const kx = R() * W, ky = r * rh + rh * (0.3 + R() * 0.4);
      for (let i = 6; i > 0; i--) { g.strokeStyle = `rgba(50,22,10,${0.08 + i * 0.03})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(kx, ky, i * 5, i * 1.7, 0, 0, TAU); g.stroke(); }
    }
    g.fillStyle = 'rgba(30,12,6,0.55)'; g.fillRect(0, (r + 1) * rh - 2, W, 2);
  }
  // wear: lighter where hands and plates go
  const gw = g.createRadialGradient(W * 0.5, H * 0.55, 10, W * 0.5, H * 0.55, W * 0.4);
  gw.addColorStop(0, 'rgba(230,170,110,0.13)'); gw.addColorStop(1, 'rgba(230,170,110,0)');
  g.fillStyle = gw; g.fillRect(0, 0, W, H);
  return c;
}

/** The cart's hand-painted front: warm wooden planks under a teal band of simple folk motifs. */
function paintPanel(W, H, seed) {
  const R = rng(seed);
  const { c, g } = cnv(W, H);
  const n = 8, pw = W / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = ['#8a5634', '#7e4c2d', '#935e38', '#83512f'][i % 4]; g.fillRect(i * pw, 0, pw, H);
    for (let k = 0; k < 24; k++) {
      const x0 = i * pw + R() * pw, amp = 1 + R() * 3, f = 0.01 + R() * 0.02, ph = R() * TAU;
      g.strokeStyle = `rgba(50,24,10,${0.08 + R() * 0.16})`; g.lineWidth = 0.8 + R() * 1.4;
      g.beginPath();
      for (let y = 0; y <= H; y += 8) { const x = x0 + Math.sin(y * f + ph) * amp; if (y === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(25,10,4,0.6)'; g.fillRect(i * pw, 0, 2.5, H);
  }
  // the painted band (top ≈ 22 %)
  const b0 = H * 0.05, b1 = H * 0.25;
  g.fillStyle = '#2d6b66'; g.fillRect(0, b0, W, b1 - b0);
  g.fillStyle = '#e9a43c'; g.fillRect(0, b0, W, 5); g.fillRect(0, b1 - 5, W, 5);
  const mid = (b0 + b1) / 2, dh = (b1 - b0) * 0.3;
  for (let x = 16; x < W; x += 32) {
    g.fillStyle = '#e9a43c';
    g.beginPath(); g.moveTo(x, mid - dh); g.lineTo(x + 9, mid); g.lineTo(x, mid + dh); g.lineTo(x - 9, mid); g.closePath(); g.fill();
    g.fillStyle = '#f3e3c4';
    g.beginPath(); g.arc(x + 16, mid, 3.2, 0, TAU); g.fill();
    g.beginPath(); g.arc(x, mid, 2.2, 0, TAU); g.fill();
  }
  // chips in the paint
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(140,90,52,${0.4 + R() * 0.4})`; g.fillRect(R() * W, b0 + R() * (b1 - b0), 2 + R() * 7, 1 + R() * 3); }
  // the lower edge: darker with wear
  const gb = g.createLinearGradient(0, H * 0.8, 0, H);
  gb.addColorStop(0, 'rgba(20,8,4,0)'); gb.addColorStop(1, 'rgba(20,8,4,0.55)');
  g.fillStyle = gb; g.fillRect(0, H * 0.8, W, H * 0.2);
  return c;
}

/** Canopy cloth: teal and cream stripes (rows 0–75 %), the valance band in saffron below. */
function paintCanopy(W, H, seed) {
  const R = rng(seed);
  const { c, g } = cnv(W, H);
  const top = Math.round(H * 0.75), n = 10, sw = W / n;
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#efe0c2' : '#2c6e69'; g.fillRect(i * sw, 0, sw + 1, top); }
  g.fillStyle = '#e39a3b'; g.fillRect(0, top, W, H - top);
  g.strokeStyle = '#f6e8cc'; g.lineWidth = 2.5;
  g.beginPath();
  for (let x = 0; x <= W; x += 4) { const y = top + (H - top) * (0.5 + 0.22 * Math.sin((x / W) * TAU * 16)); if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
  g.fillStyle = '#7a2e3a'; g.fillRect(0, top, W, 2);
  // weave
  for (let i = 0; i < 2200; i++) { g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'; g.fillRect(R() * W, R() * H, 1 + R() * 3, 1); }
  return c;
}

/** Straw weave for the basket. */
function paintWeave(W, H) {
  const { c, g } = cnv(W, H);
  g.fillStyle = '#5e3f1c'; g.fillRect(0, 0, W, H);
  const s = W / 16;
  for (let j = 0; j < 16; j++) {
    for (let i = 0; i < 16; i++) {
      const hor = (i + j) % 2 === 0;
      const gr = hor ? g.createLinearGradient(0, j * s, 0, j * s + s) : g.createLinearGradient(i * s, 0, i * s + s, 0);
      gr.addColorStop(0, '#9c7038'); gr.addColorStop(0.5, '#d5aa64'); gr.addColorStop(1, '#a07338');
      g.fillStyle = gr; g.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
    }
  }
  return c;
}

/** Soft ripples on a liquid's surface (a height field for a normal map). */
function paintRipples(S, seed) {
  const R = rng(seed);
  const { c, g } = cnv(S, S);
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {
    const x = R() * S, y = R() * S, r = 10 + R() * 40;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      const rg = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      const a = 0.1 + R() * 0.12, col = R() < 0.5 ? '255,255,255' : '0,0,0';
      rg.addColorStop(0, `rgba(${col},${a})`); rg.addColorStop(0.5, `rgba(${col},${a * 0.4})`); rg.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = rg; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  }
  return c;
}

/** Turned-steel roughness: fine concentric rings along a lathe's profile (green channel). */
function paintRings(seed) {
  const R = rng(seed);
  const { c, g } = cnv(4, 256);
  for (let y = 0; y < 256; y++) { const v = Math.round(150 + R() * 105); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, 4, 1); }
  return c;
}

// ------------------------------------------------------------------ geometry (build time)
const smax = (a, b, k) => { const h = clamp(0.5 + (0.5 * (a - b)) / k, 0, 1); return lerp(b, a, h) + k * h * (1 - h); };

/** A puri's shape: an irregular squat hollow sphere with a flat base and a cracked-open crown. */
function puriShape(R0, seed) {
  const R = rng(seed);
  const a = Array.from({ length: 9 }, () => R() * TAU);
  const cracks = [0, 1].map(() => ({ p: R() * TAU, w: 0.05 + R() * 0.06, d: 0.12 + R() * 0.2 }));
  const bump = (th, ph) => 0.032 * Math.sin(2 * ph + a[0]) * Math.sin(th) + 0.018 * Math.sin(3 * ph + a[1]) * Math.sin(2 * th + a[2]) + 0.01 * Math.sin(5 * ph + a[3]) * Math.sin(th);
  return {
    edge(ph) {
      let e = 0.62 + 0.06 * Math.sin(2 * ph + a[4]) + 0.035 * Math.sin(3 * ph + a[5]) + 0.02 * Math.sin(7 * ph + a[6]);
      e += 0.026 * Math.pow(Math.abs(Math.sin(11 * ph + a[7])), 5) + 0.012 * Math.sin(23 * ph + a[8]);
      for (const c of cracks) { let d = (((ph - c.p) % TAU) + TAU) % TAU; if (d > Math.PI) d -= TAU; e += c.d * Math.exp(-((d / c.w) ** 2)); }
      return e;
    },
    point(th, ph, out) {
      const b = bump(th, ph);
      const s = Math.sin(th), c = Math.cos(th);
      const y = smax(c * R0 * PSQ * (1 + b * 0.5), -PBASE * R0, 0.25 * R0);
      return out.set(Math.sin(ph) * s * R0 * (1 + b), y, Math.cos(ph) * s * R0 * (1 + b));
    },
  };
}

/**
 * A puri: outer shell (+ inner wall and broken rim when it is cracked open), analytic normals,
 * UVs into paintPuri's two halves. Centre at the origin, opening up (+y).
 */
function puriGeometry({ R0 = PR, segU = 48, segV = 20, hole = true, seed = 1, thick = 0.0011 }) {
  const S = puriShape(R0, seed);
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3(), T = new THREE.Vector3();
  const eps = 1e-4, k = 1 - thick / R0;
  const layer = (inner) => {
    const base = pos.length / 3;
    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      for (let i = 0; i <= segU; i++) {
        const u = i / segU, ph = u * TAU;
        const t0 = hole ? S.edge(ph) : 0;
        const th = lerp(t0, Math.PI, v);
        S.point(th, ph, P);
        S.point(Math.min(Math.PI, th + eps), ph, A); S.point(Math.max(0, th - eps), ph, T); A.sub(T);
        S.point(th, ph + eps, B); S.point(th, ph - eps, T); B.sub(T);
        N.crossVectors(B, A);
        if (N.lengthSq() < 1e-24) N.set(0, th < 1.5 ? 1 : -1, 0);
        N.normalize();
        if (N.dot(P) < 0) N.negate();
        if (inner) { P.multiplyScalar(k); N.negate(); }
        pos.push(P.x, P.y, P.z); nor.push(N.x, N.y, N.z);
        uv.push(u, inner ? 0.5 - (th / Math.PI) * 0.5 : 1 - (th / Math.PI) * 0.5);
      }
    }
    for (let j = 0; j < segV; j++) {
      for (let i = 0; i < segU; i++) {
        const a = base + j * (segU + 1) + i, b = a + segU + 1;
        if (inner) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  };
  layer(false);
  if (hole) {
    layer(true);
    const base = pos.length / 3;
    for (let i = 0; i <= segU; i++) {
      const u = i / segU, ph = u * TAU, th = S.edge(ph);
      S.point(th, ph, P);
      N.set(P.x, 0, P.z).normalize().multiplyScalar(0.45); N.y = 1; N.normalize();
      pos.push(P.x, P.y, P.z); nor.push(N.x, N.y, N.z); uv.push(u, 0.497);
      P.multiplyScalar(k);
      pos.push(P.x, P.y, P.z); nor.push(N.x, N.y, N.z); uv.push(u, 0.492);
    }
    for (let i = 0; i < segU; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return { geo: g, shape: S };
}

/** Colour every vertex of a geometry (optionally speckled by a function of its position). */
function paint(geo, hex, vary = 0) {
  const base = new THREE.Color(hex);
  const n = geo.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  const p = geo.getAttribute('position');
  for (let i = 0; i < n; i++) {
    const f = 1 + vary * (Math.sin(p.getX(i) * 2900 + p.getZ(i) * 1700) * 0.5 + Math.sin(p.getY(i) * 3300) * 0.5);
    col[i * 3] = base.r * f; col[i * 3 + 1] = base.g * f; col[i * 3 + 2] = base.b * f;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.deleteAttribute('uv');
  return geo;
}

/** Little pieces of food, as merged vertex-coloured geometry (sizes in metres: a puri is ≈ 5 cm). */
function foodPieces(R, q) {
  const parts = [];
  const hi = q >= 1;
  const place = (g, x, y, z, rx, ry, rz) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); parts.push(g); return g; };
  // a rounded, slightly irregular cube (a superellipsoid): a potato chunk, a bit of onion
  const lump = (sx, sy, sz, squ = 0.55) => {
    const g = new THREE.SphereGeometry(1, hi ? 9 : 6, hi ? 7 : 4);
    const p = g.getAttribute('position');
    const ph = R() * TAU;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      x = Math.sign(x) * Math.pow(Math.abs(x), squ); y = Math.sign(y) * Math.pow(Math.abs(y), squ); z = Math.sign(z) * Math.pow(Math.abs(z), squ);
      const w = 1 + 0.14 * Math.sin(x * 3.1 + ph) * Math.sin(y * 2.7 + ph * 2) + 0.08 * Math.sin(z * 4.3 + ph);
      p.setXYZ(i, x * sx * w, y * sy * w, z * sz * w);
    }
    g.computeVertexNormals();
    return g;
  };
  // a coriander leaf: a flat, three-lobed, toothed blade with a soft cup and a midrib
  const leafGeo = (s) => {
    const n = hi ? 18 : 10;
    const g = new THREE.CircleGeometry(1, n);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y);
      if (r < 1e-6) continue;
      const a = Math.atan2(y, x);
      const lobe = 0.62 + 0.38 * Math.abs(Math.cos(1.5 * (a - Math.PI / 2))) - 0.07 * Math.abs(Math.sin(4.5 * a));
      p.setXYZ(i, x * lobe, y * lobe, 0.18 * r * r);
    }
    g.scale(s, s, s);
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  };
  return {
    parts,
    potato(x, y, z, s = 1) { const g = paint(lump(0.0031 * s, 0.0026 * s, 0.0034 * s), R() < 0.5 ? '#ecd690' : '#e2c477', 0.07); return place(g, x, y, z, R() * 3, R() * 3, R() * 3); },
    chana(x, y, z, s = 1) {
      const g = new THREE.SphereGeometry(0.0029 * s, hi ? 10 : 6, hi ? 8 : 5);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) { const py = p.getY(i); p.setY(i, py * (1 + 0.32 * Math.max(0, py / (0.0029 * s)) ** 4)); }
      g.computeVertexNormals();
      return place(paint(g, R() < 0.35 ? '#93623a' : '#c99f66', 0.05), x, y, z, R() * 3, R() * 3, R() * 3);
    },
    sev(x, y, z, len, yaw, tilt = 0) {
      // a crisp gram-flour noodle: thin, a little bent
      const g = new THREE.CylinderGeometry(0.00036, 0.00036, len, 4, 3, false);
      const p = g.getAttribute('position'), bend = (R() - 0.5) * 0.25;
      for (let i = 0; i < p.count; i++) { const t = p.getY(i) / len; p.setX(i, p.getX(i) + bend * len * (t * t - 0.25)); }
      g.computeVertexNormals();
      g.rotateZ(Math.PI / 2);
      return place(paint(g, R() < 0.5 ? '#f3c24f' : '#e9ae3a', 0.08), x, y, z, 0, yaw, tilt);
    },
    leaf(x, y, z, s = 1) { return place(paint(leafGeo(0.0028 * s), R() < 0.5 ? '#4f9a2c' : '#3f8724', 0.08), x, y, z, (R() - 0.5) * 0.7, R() * TAU, (R() - 0.5) * 0.7); },
    onion(x, y, z, s = 1) { const g = paint(lump(0.0013 * s, 0.0009 * s, 0.0016 * s, 0.4), R() < 0.5 ? '#f4e4ea' : '#e2bccb', 0.05); return place(g, x, y, z, R() * 3, R() * 3, R() * 3); },
    drop(x, y, z, s = 1) { const g = new THREE.SphereGeometry(0.0018 * s, hi ? 10 : 6, hi ? 6 : 4); g.scale(1, 0.45, 1); return place(paint(g, '#4a1a0a', 0), x, y, z, 0, 0, 0); },
    boondi(x, y, z) { const g = new THREE.SphereGeometry(0.0034, hi ? 8 : 6, hi ? 6 : 4); return place(paint(g, R() < 0.5 ? '#d99a3c' : '#c98630', 0.1), x, y, z, 0, 0, 0); },
    mint(x, y, z) { return place(paint(leafGeo(0.006), '#3a7a26', 0.1), x, y, z, 0, R() * TAU, 0); },
    merge() { const m = mergeGeometries(parts, false); parts.forEach((g) => g.dispose()); return m; },
  };
}

/** What's inside a puri: potato, chickpeas, a little onion, sev, coriander, a drop of tamarind (puri-local). */
function fillingGeometry(seed, q) {
  const R = rng(seed);
  const F = foodPieces(R, q);
  const hi = q >= 1;
  const scatter = (rMax, y0, y1, n, fn) => { for (let i = 0; i < n; i++) { const a = R() * TAU, r = Math.sqrt(R()) * rMax; fn(Math.cos(a) * r, lerp(y0, y1, R()), Math.sin(a) * r, a); } };
  // the spiced potato mash it all sits on: a lumpy mound, pale yellow flecked with masala
  {
    const g = new THREE.SphereGeometry(1, hi ? 18 : 10, hi ? 10 : 6);
    const p = g.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    const base = new THREE.Color('#e3c27a'), fleck = new THREE.Color('#b0542a'), herb = new THREE.Color('#4d8a2c'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const w = 1 + 0.16 * Math.sin(x * 7.1 + z * 3.3) * Math.sin(z * 6.3 + y * 2.1) + 0.08 * Math.sin(x * 13 + y * 11);
      p.setXYZ(i, x * 0.5 * PR * w, y * 0.2 * PR * w + 0.32 * PR, z * 0.5 * PR * w);
      const hsh = Math.abs(Math.sin(x * 91.7 + y * 47.3 + z * 13.1) * 43758.5) % 1;
      c.copy(base).multiplyScalar(0.92 + 0.12 * Math.sin(x * 17 + z * 9));
      if (hsh > 0.82) c.lerp(fleck, 0.75); else if (hsh < 0.06) c.lerp(herb, 0.8);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    F.parts.push(g);
  }
  scatter(0.36 * PR, 0.38 * PR, 0.5 * PR, hi ? 10 : 6, (x, y, z) => F.potato(x, y, z, 0.8 + R() * 0.3));
  scatter(0.36 * PR, 0.36 * PR, 0.5 * PR, hi ? 5 : 3, (x, y, z) => F.chana(x, y, z));
  scatter(0.36 * PR, 0.44 * PR, 0.56 * PR, hi ? 10 : 4, (x, y, z) => F.onion(x, y, z));
  scatter(0.34 * PR, 0.5 * PR, 0.64 * PR, hi ? 24 : 12, (x, y, z, a) => F.sev(x, y, z, 0.003 + R() * 0.005, a + R() * 2, (R() - 0.5) * 0.6));
  scatter(0.3 * PR, 0.58 * PR, 0.68 * PR, hi ? 5 : 3, (x, y, z) => F.leaf(x, y, z, 0.8 + R() * 0.45));
  scatter(0.22 * PR, 0.56 * PR, 0.62 * PR, hi ? 3 : 2, (x, y, z) => F.drop(x, y, z, 0.8 + R() * 0.5));
  return F.merge();
}

/** A lathe from [radius, y] pairs. */
function lathe(pts, segs) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs); }

// ------------------------------------------------------------------ shaders
const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = /* glsl */`
  uniform float uDusk; uniform float uBlur;
  varying vec3 vDir;
  float hash(float n){ return fract(sin(n) * 43758.5453); }
  void main(){
    vec3 d = normalize(vDir);
    float y = d.y;
    float az = atan(d.x, d.z);
    // dusk: an orange band at the horizon, rose, violet, deep indigo overhead
    vec3 col = mix(vec3(0.95, 0.46, 0.2), vec3(0.42, 0.17, 0.28), smoothstep(0.0, 0.1, y));
    col = mix(col, vec3(0.13, 0.08, 0.24), smoothstep(0.07, 0.3, y));
    col = mix(col, vec3(0.025, 0.03, 0.09), smoothstep(0.26, 0.85, y));
    // the last of the sunset, low behind the stall
    float sun = max(0.0, dot(d, normalize(vec3(-0.5, 0.03, -1.0))));
    col += vec3(1.0, 0.52, 0.2) * pow(sun, 12.0) * 0.55 * smoothstep(0.4, -0.02, y);
    col = mix(col, vec3(0.008, 0.006, 0.01), smoothstep(-0.005, -0.08, y));
    // the far street: flat-topped blocks (a water tank here and there), out of focus — every edge,
    // the tops and the sides, blurred by the same amount — with warm windows and lit shop fronts
    // at street level, hazed toward the sky's colour so they never read as hard cut-outs
    float u = az * 9.0;
    float cell = floor(u);
    float f = fract(u);
    float h = 0.025 + 0.06 * hash(cell + 3.0);
    float soft = mix(0.004, 0.02, uBlur);
    float e = mix(0.06, 0.2, uBlur);                // (the side edges' blur, in cells: about the tops')
    float tank = step(0.72, hash(cell + 11.0)) * smoothstep(0.3 - e * 0.5, 0.3 + e * 0.5, f) * smoothstep(0.42 + e * 0.5, 0.42 - e * 0.5, f) * 0.012;
    float sil = 1.0 - smoothstep(h + tank - soft, h + tank + soft, y);
    // across a side edge: a box blur of this block's coverage with its neighbour's
    float silL = 1.0 - smoothstep(0.025 + 0.06 * hash(cell + 2.0) - soft, 0.025 + 0.06 * hash(cell + 2.0) + soft, y);
    float silR = 1.0 - smoothstep(0.025 + 0.06 * hash(cell + 4.0) - soft, 0.025 + 0.06 * hash(cell + 4.0) + soft, y);
    float wL = 0.5 * smoothstep(e, 0.0, f), wR = 0.5 * smoothstep(1.0 - e, 1.0, f);
    sil = sil * (1.0 - wL - wR) + silL * wL + silR * wR;
    vec3 bcol = vec3(0.016, 0.011, 0.02) + vec3(0.05, 0.02, 0.01) * smoothstep(0.05, -0.02, y);
    bcol = mix(bcol, col * 0.6, mix(0.12, 0.3, uBlur) * smoothstep(-0.03, 0.07, y));
    vec2 gq = vec2(u * 6.0, y * 70.0);
    vec2 gi = floor(gq);
    vec2 gf = fract(gq) - 0.5;
    float lit = step(0.86, hash(gi.x * 13.1 + gi.y * 71.7));
    float win = lit * smoothstep(0.45, mix(0.2, 0.0, uBlur), length(gf * vec2(1.0, 1.4))) * step(-0.1, y) * smoothstep(h - 0.008 + soft, h - 0.008 - soft, y);
    // (out of focus, the windows' light spreads: dimmer points over a warm wash)
    bcol += vec3(1.0, 0.6, 0.28) * (win * mix(0.45, 0.16, uBlur) + 0.035 * uBlur * step(-0.1, y));
    float shop = step(0.35, hash(cell + 21.0)) * smoothstep(0.02, 0.2, f) * smoothstep(0.98, 0.8, f);
    bcol += mix(vec3(1.0, 0.55, 0.22), vec3(1.0, 0.75, 0.45), hash(cell + 5.0)) * shop * exp(-pow((y + 0.045) / 0.02, 2.0)) * 0.35;
    col = mix(col, bcol, sil);
    col *= uDusk * 0.62;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const BOKEH_VERT = /* glsl */`
  attribute vec3 aPos; attribute vec4 aCol; attribute vec2 aMisc;
  uniform float uTime; uniform float uDefocus;
  varying vec2 vUv; varying vec4 vCol; varying float vA;
  void main(){
    vUv = uv - 0.5; vCol = aCol;
    vec3 p = aPos;
    p.x += sin(uTime * 0.13 + aMisc.y * 31.0) * 0.05;
    p.y += cos(uTime * 0.11 + aMisc.y * 17.0) * 0.04;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = aMisc.x * (1.0 + uDefocus * 1.6);
    mv.xy += position.xy * size;
    vA = (0.82 + 0.18 * sin(uTime * (0.5 + aMisc.y) + aMisc.y * 40.0)) / (1.0 + uDefocus * 1.2);
    gl_Position = projectionMatrix * mv;
  }`;
const BOKEH_FRAG = /* glsl */`
  uniform float uBright;
  varying vec2 vUv; varying vec4 vCol; varying float vA;
  void main(){
    float d = length(vUv) * 2.0;
    float disc = 1.0 - smoothstep(0.8, 1.0, d);
    float rim = smoothstep(0.6, 0.92, d) * disc * 0.4;
    float a = disc * 0.5 + rim + exp(-d * d * 3.0) * 0.1;
    gl_FragColor = vec4(vCol.rgb * a * vCol.a * vA * uBright, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const MOTE_VERT = /* glsl */`
  attribute vec3 aPos; attribute vec3 aMisc;
  uniform float uTime; uniform float uBright;
  varying vec2 vUv; varying float vA;
  void main(){
    vUv = uv - 0.5;
    float s = aMisc.y;
    float w = mod(uTime * aMisc.z + s * 13.0, 1.0);
    vec3 p = aPos;
    p.y += (w - 0.5) * 0.5;
    p.x += sin(uTime * 0.23 + s * 40.0) * 0.06;
    p.z += cos(uTime * 0.19 + s * 27.0) * 0.06;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    float near = smoothstep(0.35, 0.06, depth);
    mv.xy += position.xy * aMisc.x * (1.0 + near * 5.0);
    vA = smoothstep(0.0, 0.2, w) * smoothstep(1.0, 0.8, w) * smoothstep(0.02, 0.08, depth)
       * (0.55 + 0.45 * sin(uTime * (0.9 + s) + s * 50.0)) * mix(1.0, 0.25, near) * uBright;
    gl_Position = projectionMatrix * mv;
  }`;
const MOTE_FRAG = /* glsl */`
  varying vec2 vUv; varying float vA;
  void main(){
    float d = length(vUv) * 2.0;
    float a = exp(-d * d * 5.0) * (1.0 - smoothstep(0.8, 1.0, d));
    gl_FragColor = vec4(vec3(1.0, 0.74, 0.42) * a * vA, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const SPARK_VERT = /* glsl */`
  attribute vec3 aPos; attribute vec4 aCol; attribute vec3 aMisc;
  varying vec2 vUv; varying vec4 vCol; varying float vKind;
  void main(){
    vUv = uv - 0.5; vCol = aCol; vKind = aMisc.y;
    vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
    // kinds (aMisc.y): 0 a soft halo · 0.5 a soft glow lying over a surface · 1 a glint (rays)
    // a glint sits just in front of its surface, never inside it
    mv.xyz += normalize(-mv.xyz) * aMisc.x * 0.3 * step(0.75, aMisc.y);
    // a glow over a surface (the portal's bloom on the plate, the thread's head rising out of it) is
    // slid toward the eye along its own rays, its size with it: it looks exactly the same, but the
    // plate it lies on can no longer cut a straight line through it
    float k = 1.0 - step(0.25, aMisc.y) * step(aMisc.y, 0.75) * min(0.7, aMisc.x * 0.45 / max(1e-4, length(mv.xyz)));
    mv.xyz *= k;
    float c = cos(aMisc.z), s = sin(aMisc.z);
    vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
    mv.xy += q * aMisc.x * k * step(0.0005, aCol.a);
    gl_Position = projectionMatrix * mv;
  }`;
const SPARK_FRAG = /* glsl */`
  varying vec2 vUv; varying vec4 vCol; varying float vKind;
  void main(){
    float d = length(vUv) * 2.0;
    float a;
    if (vKind > 0.75) {
      vec2 p = abs(vUv) * 2.0;
      float rays = exp(-p.x * 30.0) * exp(-p.y * 3.4) + exp(-p.y * 30.0) * exp(-p.x * 3.4);
      vec2 r = abs(vec2(vUv.x + vUv.y, vUv.x - vUv.y)) * 1.414;
      rays += 0.3 * (exp(-r.x * 40.0) * exp(-r.y * 7.0) + exp(-r.y * 40.0) * exp(-r.x * 7.0));
      a = exp(-d * d * 30.0) * 1.5 + exp(-d * d * 6.0) * 0.22 + rays;
    } else {
      a = exp(-d * d * 4.5) * 0.8 + exp(-d * d * 24.0) * 0.5;
    }
    a *= 1.0 - smoothstep(0.85, 1.0, d);
    gl_FragColor = vec4(vCol.rgb * vCol.a * a, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
// the pani stream: a thin open tube from the ladle's lip, its head falling and its tail following
const STREAM_VERT = /* glsl */`
  uniform float uTime;
  varying float vA; varying vec3 vN; varying vec3 vV;
  void main(){
    vA = 1.0 - uv.y;
    vec3 p = position;
    float thin = mix(1.0, 0.6, vA) * (1.0 + 0.14 * sin(vA * 38.0 - uTime * 24.0));
    p.xz *= thin;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const STREAM_FRAG = /* glsl */`
  uniform float uHead; uniform float uTail; uniform float uTime; uniform vec3 uColor;
  varying float vA; varying vec3 vN; varying vec3 vV;
  void main(){
    if (vA > uHead || vA < uTail) discard;
    float f = 1.0 - abs(dot(normalize(vN), vV));
    float streak = 0.5 + 0.5 * sin(vA * 80.0 - uTime * 36.0 + vN.x * 5.0);
    vec3 col = uColor * (0.45 + 0.55 * f) + vec3(1.0, 0.97, 0.9) * (pow(f, 4.0) * 0.8 + streak * pow(f, 2.0) * 0.25);
    float a = (0.55 + 0.4 * f) * smoothstep(uHead, uHead - 0.04, vA) * smoothstep(uTail, uTail + 0.04, vA);
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
// the ripple that becomes a golden ring (additive, lying on the plate)
const PORTAL_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PORTAL_FRAG = /* glsl */`
  uniform float uTime; uniform float uRipple; uniform float uRippleA; uniform float uGold; uniform float uPortal;
  varying vec2 vUv;
  void main(){
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float ang = atan(p.y, p.x);
    float r1 = uRipple, r2 = max(0.0, uRipple - 0.2) * 0.95;
    float ring = exp(-pow((d - r1) / 0.032, 2.0)) + 0.5 * exp(-pow((d - r2) / 0.028, 2.0));
    ring *= uRippleA;
    vec3 gold = vec3(1.0, 0.7, 0.3);
    vec3 col = mix(vec3(0.7, 0.85, 0.7) * 0.5, gold * 2.4, uGold) * ring;
    float pr = 0.62;
    float band = exp(-pow((d - pr) / 0.045, 2.0)) * (0.85 + 0.15 * sin(ang * 9.0 - uTime * 3.0));
    float swirl = 0.6 + 0.4 * sin(ang * 5.0 + d * 14.0 - uTime * 2.6);
    float inner = smoothstep(pr + 0.02, 0.0, d) * (0.3 + 0.32 * swirl);
    float halo = exp(-pow(max(0.0, d - pr) / 0.16, 2.0)) * 0.3;
    col += gold * uPortal * (band * 2.6 + inner * 0.55 + halo * 0.6); // (a gold ring over a softly lit inside — never a white disc)
    col *= 1.0 - smoothstep(0.9, 1.0, d);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/**
 * The stall's reflections: a pre-filtered environment of this place — the canopy's warm, dim
 * underside overhead, the dusk sky round the horizon, the dark street below, and one small, very
 * bright warm bulb (the highlight steel and pani catch).
 */
function makeStallEnv(renderer) {
  const sc = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
  const pos = dome.geometry.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const C = (y) => {
    if (y > 0.32) return [0.13, 0.1, 0.085];                                  // the canopy, lit from below
    if (y > 0.12) { const k = (y - 0.12) / 0.2; return [lerp(0.3, 0.2, k), lerp(0.16, 0.15, k), lerp(0.3, 0.12, k)]; }
    if (y > -0.02) { const k = (y + 0.02) / 0.14; return [lerp(0.85, 0.3, k), lerp(0.42, 0.16, k), lerp(0.22, 0.3, k)]; } // dusk band
    return [0.05, 0.035, 0.035];                                              // the street
  };
  for (let i = 0; i < pos.count; i++) { const c = C(pos.getY(i) / 40); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  dome.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sc.add(dome);
  const panel = (w, h, rgb, p) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), side: THREE.DoubleSide }));
    m.position.set(...p); m.lookAt(0, 0, 0); sc.add(m);
  };
  panel(1.3, 1.5, [11, 7, 3.6], [2.5, 16, 6]);        // the bulb
  panel(30, 2, [1.6, 1.0, 0.55], [0, 9, 24]);          // the string lights along the front
  panel(26, 1.6, [1.0, 0.62, 0.36], [0, 11, -22]);     // …and along the back
  panel(14, 6, [0.9, 0.48, 0.24], [-14, 3, -26]);      // the warm street glow behind
  panel(10, 4, [0.28, 0.46, 0.5], [22, 4, -10]);       // a cool shop light far to the side
  panel(30, 6, [0.32, 0.2, 0.12], [0, -6, 20]);        // the counter and the cart's front, warm wood
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(sc, 0.03);
  pmrem.dispose();
  sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt;
}

/** One instanced billboard draw (a quad per instance) with the given per-instance attributes. */
function billboards(count, attrs, material) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  const out = {};
  for (const [name, size, dynamic] of attrs) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(count * size), size);
    if (dynamic) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(name, a);
    out[name] = a;
  }
  geo.instanceCount = count;
  quad.dispose();
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return { mesh, geo, attrs: out };
}

// ================================================================== build
export async function build(env) {
  const { tier } = env;
  const q = tier.quality;
  const reduced = !!tier.reduced;
  const shadows = !!tier.shadows;
  const envRT = makeStallEnv(env.renderer);
  const envMap = envRT.texture;
  const dev = !!window.__LITTLE_DEV__;
  const R = rng(311);
  const own = new Set();
  const keep = (x) => { own.add(x); return x; };
  const geo = (g) => keep(g);
  const tex = (c, { srgb = true, wrap = false } = {}) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return keep(t);
  };
  const PHYS_ONLY = ['clearcoat', 'clearcoatRoughness', 'clearcoatNormalMap', 'clearcoatNormalScale', 'sheen', 'sheenColor', 'sheenRoughness', 'transmission', 'thickness', 'ior', 'specularIntensity'];
  const phys = (o) => {
    if (q >= 1) return keep(new THREE.MeshPhysicalMaterial({ envMap, ...o }));
    const p = { envMap, ...o };
    PHYS_ONLY.forEach((k) => delete p[k]);
    return keep(new THREE.MeshStandardMaterial(p));
  };
  const shade = (m, cast = true, receive = true) => { m.castShadow = cast && shadows; m.receiveShadow = receive && shadows; return m; };
  const late = [];

  // ---------------------------------------------------------------- world
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0e0a10, 3, 13);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.004, 90);
  const rig = createRig(camera, { breath: 0.5 });

  const skyMat = keep(new THREE.ShaderMaterial({ uniforms: { uDusk: { value: 1 }, uBlur: { value: 1 } }, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }));
  const sky = new THREE.Mesh(geo(new THREE.SphereGeometry(45, 40, 20)), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  const ground = new THREE.Mesh(geo(new THREE.CircleGeometry(15, 48).rotateX(-Math.PI / 2)), keep(new THREE.MeshStandardMaterial({ color: '#2a2224', roughness: 0.9, envMap, envMapIntensity: 0.2 })));
  shade(ground, false, true);
  scene.add(ground);

  // ---------------------------------------------------------------- textures
  const TW = q === 0 ? 512 : 1024;
  const puriSkin = paintPuri(TW, TW / 2, 7);
  const puriMap = tex(puriSkin.color, { wrap: true });
  const puriNormal = tex(normalMapFrom(puriSkin.height, q === 0 ? 1.3 : 1.9), { srgb: false, wrap: true });
  const woodTex = tex(paintWood(1024, 256, 3));
  const panelTex = tex(paintPanel(512, 512, 5));
  const canopyTex = tex(paintCanopy(512, 128, 9));
  const weaveTex = tex(paintWeave(256, 256), { wrap: true });
  weaveTex.repeat.set(6, 2);
  const ringsTex = tex(paintRings(13), { srgb: false, wrap: true });
  const rippleTex = tex(normalMapFrom(paintRipples(256, 21), 2.2), { srgb: false, wrap: true });
  rippleTex.repeat.set(3, 3);

  // ---------------------------------------------------------------- materials
  const steel = (o = {}) => keep(new THREE.MeshStandardMaterial({ color: '#cdd2d9', metalness: 1, roughness: 0.24, roughnessMap: ringsTex, envMap, envMapIntensity: 1.0, ...o }));
  const steelMat = steel();
  const steelMatI = steel();                       // (the instanced bowls: their own program variant)
  const woodMat = phys({ map: woodTex, roughness: 0.5, clearcoat: 0.28, clearcoatRoughness: 0.36, envMapIntensity: 0.38 });
  const panelMat = phys({ map: panelTex, roughness: 0.78, envMapIntensity: 0.3 });
  const poleMat = keep(new THREE.MeshStandardMaterial({ color: '#2b3e3a', metalness: 0.55, roughness: 0.42, envMap, envMapIntensity: 0.6 }));
  const canopyMat = keep(new THREE.MeshStandardMaterial({ map: canopyTex, side: THREE.DoubleSide, roughness: 0.92, envMap, envMapIntensity: 0.25 }));
  const wireMat = keep(new THREE.MeshStandardMaterial({ color: '#1c1514', roughness: 0.55, metalness: 0.2 }));
  const bulbMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 3.3, 1.6) }));
  const stringMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const shellMat = phys({
    map: puriMap, normalMap: puriNormal, normalScale: new THREE.Vector2(1, 1), roughness: 0.56,
    // (a thin film of oil: a clearcoat that follows the blisters, so light catches the crisp bumps)
    clearcoat: 0.32, clearcoatRoughness: 0.3, clearcoatNormalMap: puriNormal, clearcoatNormalScale: new THREE.Vector2(0.8, 0.8),
    sheen: 0.35, sheenColor: new THREE.Color('#ffd796'), sheenRoughness: 0.5, envMapIntensity: 0.6,
  });
  const fillMat = phys({ vertexColors: true, roughness: 0.48, clearcoat: 0.55, clearcoatRoughness: 0.22, envMapIntensity: 0.6 });
  const foodMat = phys({ vertexColors: true, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.55 });
  const paniProps = { color: '#4e8a33', transparent: true, opacity: 0.62, roughness: 0.05, metalness: 0, normalMap: rippleTex, normalScale: new THREE.Vector2(0.3, 0.3), clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.0, depthWrite: false, emissive: new THREE.Color('#2c5a1c'), emissiveIntensity: 0.35 };
  const paniInMat = phys({ ...paniProps });         // (instanced: inside the puris)
  const paniMat = phys({ ...paniProps });           // the pot, the ladle, the little pool on the plate
  const tamarindMat = phys({ color: '#4a1d0c', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 });
  const greenMat = phys({ color: '#3f7427', roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.9 });
  const basketMat = keep(new THREE.MeshStandardMaterial({ map: weaveTex, roughness: 0.82, envMap, envMapIntensity: 0.3 }));
  const aoMat = keep(new THREE.MeshBasicMaterial({ color: 0x000000, map: glowTexture(), transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  const wheelMat = phys({ vertexColors: true, roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.5, envMapIntensity: 0.4 });
  const bitsMat = phys({ roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.8 });
  // the shadow pass: three's one shared depth material would switch program variants between the
  // instanced casters (with and without instance colours) and the plain ones several times a frame —
  // each variant gets its own (the figure's skinned meshes have theirs, in ./figure.js)
  const depthOf = () => keep(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  const depthInst = depthOf(), depthInstCol = depthOf();
  const dropMat = phys({ color: '#a6d98a', transparent: true, opacity: 0.82, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4, emissive: new THREE.Color('#2a4d1d'), emissiveIntensity: 0.5, depthWrite: false });

  // ---------------------------------------------------------------- the stall
  // the counter: a varnished wooden top with a steel trim, the cart's painted front below
  const top = new THREE.Mesh(geo(new THREE.BoxGeometry(1.96, 0.045, 0.57)), woodMat);
  top.position.set(0, CT - 0.0225, 0.025);
  shade(top, true, true);
  const trim = new THREE.Mesh(geo(new THREE.BoxGeometry(1.972, 0.016, 0.012)), steelMat);
  trim.position.set(0, CT - 0.012, 0.316);
  const BODY0 = 0.36;   // the cart's body rides above its wheels
  const body = new THREE.Mesh(geo(new THREE.BoxGeometry(1.9, CT - 0.045 - BODY0, 0.5)), panelMat);
  body.position.set(0, (CT - 0.045 + BODY0) / 2, 0.02);
  shade(body, true, true);
  scene.add(top, trim, body);
  {
    // two big spoked wheels on the front (and their twins behind), an axle bar between them
    const parts = [];
    const WR = 0.29;
    for (const x of [-0.62, 0.62]) {
      for (const z of [0.3, -0.26]) {
        const tyre = new THREE.TorusGeometry(WR - 0.012, 0.014, 8, 40); tyre.translate(x, WR, z); parts.push(paint(tyre, '#1e1714'));
        const fel = new THREE.TorusGeometry(WR - 0.04, 0.017, 6, 40); fel.scale(1, 1, 0.8); fel.translate(x, WR, z); parts.push(paint(fel, '#2c6e69', 0.03));
        const hub = new THREE.CylinderGeometry(0.035, 0.035, 0.05, 16); hub.rotateX(Math.PI / 2); hub.translate(x, WR, z); parts.push(paint(hub, '#e39a3b'));
        for (let k = 0; k < 10; k++) {
          const sp = new THREE.CylinderGeometry(0.0085, 0.011, WR - 0.06, 6);
          sp.translate(0, (WR - 0.06) / 2 + 0.02, 0); sp.rotateZ((k * TAU) / 10); sp.translate(x, WR, z);
          parts.push(paint(sp, '#e39a3b', 0.04));
        }
      }
      const axle = new THREE.CylinderGeometry(0.014, 0.014, 0.6, 8); axle.rotateX(Math.PI / 2); axle.translate(x, WR, 0.02); parts.push(paint(axle, '#1e1714'));
    }
    const wheels = new THREE.Mesh(geo(mergeGeometries(parts, false)), wheelMat);
    parts.forEach((g) => g.dispose());
    shade(wheels, true, true);
    scene.add(wheels);
  }

  // the canopy (cloth on four poles, a scalloped valance at the front)
  const CAN = { x: 1.12, z0: -0.95, z1: 0.55, y0: 2.3, y1: 2.12 };
  const canY = (x, z) => lerp(CAN.y0, CAN.y1, (z - CAN.z0) / (CAN.z1 - CAN.z0)) - 0.035 * Math.sin((Math.PI * (x + CAN.x)) / (2 * CAN.x)) * Math.sin((Math.PI * (z - CAN.z0)) / (CAN.z1 - CAN.z0));
  {
    const pg = new THREE.PlaneGeometry(2 * CAN.x, CAN.z1 - CAN.z0, 16, 8);
    pg.rotateX(-Math.PI / 2);
    const p = pg.getAttribute('position'), uv = pg.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i) + (CAN.z0 + CAN.z1) / 2;
      p.setXYZ(i, x, canY(x, z), z);
      uv.setXY(i, (x + CAN.x) / (2 * CAN.x), 0.25 + 0.75 * (1 - (z - CAN.z0) / (CAN.z1 - CAN.z0)));
    }
    pg.computeVertexNormals();
    // valance
    const N = 176, pos = [], uvs = [], ix = [];
    for (let i = 0; i <= N; i++) {
      const x = lerp(-CAN.x, CAN.x, i / N);
      const yt = canY(x, CAN.z1), drop = 0.1 + 0.035 * (1 - Math.abs(Math.sin((Math.PI * (x + CAN.x)) / 0.14)) ** 0.6);
      pos.push(x, yt, CAN.z1, x, yt - drop, CAN.z1 + 0.004);
      uvs.push(i / N, 0.25, i / N, 0.0);
      if (i < N) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    }
    const vg = new THREE.BufferGeometry();
    vg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    vg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    vg.setIndex(ix);
    vg.computeVertexNormals();
    const cg = geo(mergeGeometries([pg, vg], false));
    pg.dispose(); vg.dispose();
    const canopy = new THREE.Mesh(cg, canopyMat);
    scene.add(canopy);
  }
  {
    const poles = [];
    for (const [x, z] of [[-1.04, 0.42], [1.04, 0.42], [-1.04, -0.9], [1.04, -0.9]]) {
      const h = canY(x * 0.99, z) + 0.01;
      const c = new THREE.CylinderGeometry(0.017, 0.019, h, 12, 1);
      c.translate(x, h / 2, z);
      poles.push(c);
    }
    const pm = new THREE.Mesh(geo(mergeGeometries(poles, false)), poleMat);
    poles.forEach((c) => c.dispose());
    shade(pm, false, true);
    scene.add(pm);
  }

  // the bulb: a bare warm bulb on a short flex
  {
    const yTop = canY(BULB.x, BULB.z);
    const wire = new THREE.CylinderGeometry(0.0022, 0.0022, yTop - BULB.y - 0.05, 6, 1);
    wire.translate(BULB.x, (yTop + BULB.y + 0.05) / 2, BULB.z);
    const sock = new THREE.CylinderGeometry(0.013, 0.015, 0.036, 16, 1);
    sock.translate(BULB.x, BULB.y + 0.04, BULB.z);
    const wm = new THREE.Mesh(geo(mergeGeometries([wire, sock], false)), wireMat);
    wire.dispose(); sock.dispose();
    const bg = new THREE.SphereGeometry(0.03, 20, 14);
    bg.scale(1, 1.18, 1);
    const bulb = new THREE.Mesh(geo(bg), bulbMat);
    bulb.position.copy(BULB);
    scene.add(wm, bulb);
  }

  // string lights: one along the valance, one along the back
  const strings = [];
  {
    const nF = [10, 13, 15][q], nB = [0, 9, 12][q];
    const lines = [];
    const sag = (x, y0, z, s) => new THREE.Vector3(x, y0 - s * (1 - (x / CAN.x) ** 2), z);
    const addLine = (n, y0, z, s) => {
      if (!n) return;
      const pts = [];
      for (let i = 0; i <= 24; i++) pts.push(sag(lerp(-CAN.x, CAN.x, i / 24), y0, z, s));
      lines.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.0022, 4, false));
      for (let i = 0; i < n; i++) { const p = sag(lerp(-CAN.x + 0.08, CAN.x - 0.08, (i + 0.5) / n), y0, z, s); p.y -= 0.022; strings.push(p); }
    };
    addLine(nF, CAN.y1 - 0.13, CAN.z1 + 0.012, 0.08);
    addLine(nB, CAN.y0 - 0.05, CAN.z0 + 0.05, 0.1);
    const lm = new THREE.Mesh(geo(mergeGeometries(lines, false)), wireMat);
    lines.forEach((l) => l.dispose());
    scene.add(lm);
  }
  const STRING_COLS = [[3.4, 2.5, 1.4], [3.6, 1.9, 0.7], [3.2, 1.4, 1.7], [3.4, 2.5, 1.4], [1.8, 3.0, 1.3], [3.6, 1.9, 0.7]];
  const stringIM = new THREE.InstancedMesh(geo(new THREE.SphereGeometry(0.0125, 10, 8).scale(1, 1.25, 1)), stringMat, strings.length);
  strings.forEach((p, i) => {
    stringIM.setMatrixAt(i, _m1.makeTranslation(p.x, p.y, p.z));
    const c = STRING_COLS[i % STRING_COLS.length];
    stringIM.setColorAt(i, new THREE.Color(c[0], c[1], c[2]));
  });
  scene.add(stringIM);

  // ---------------------------------------------------------------- the plate and its puris
  const PS = [32, 48, 64][q];
  const plate = new THREE.Mesh(geo(lathe([[0, 0], [0.085, 0], [0.092, 0.001], [0.099, 0.0055], [0.104, 0.0105], [0.1068, 0.0135], [0.1068, 0.0152], [0.1046, 0.0157], [0.1022, 0.0128], [0.095, 0.006], [0.088, 0.0036], [0.083, 0.0034], [0, 0.0034]], PS)), steelMat);
  plate.position.copy(PLATE);
  shade(plate, true, true);
  scene.add(plate);

  const segU = [30, 42, 56][q], segV = [12, 16, 22][q];
  const shell = puriGeometry({ segU, segV, seed: 5 });
  geo(shell.geo);
  const whole = puriGeometry({ segU: [18, 24, 30][q], segV: [9, 11, 14][q], hole: false, seed: 8 });
  geo(whole.geo);
  const fillGeo = geo(fillingGeometry(17, q));
  const discGeo = geo(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2));

  const shellsIM = new THREE.InstancedMesh(shell.geo, shellMat, 6);
  const fillIM = new THREE.InstancedMesh(fillGeo, fillMat, 6);
  const paniIM = new THREE.InstancedMesh(discGeo, paniInMat, 6);
  for (const m of [shellsIM, fillIM, paniIM]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; }
  shade(shellsIM, true, true);
  shellsIM.customDepthMaterial = depthInstCol;
  shade(fillIM, false, true);
  paniIM.renderOrder = 2;
  scene.add(shellsIM, fillIM, paniIM);
  const puriAt = [];
  const HERO_Q = new THREE.Quaternion();
  for (let i = 0; i < 6; i++) {
    const a = (3 * Math.PI) / 4 + (i * TAU) / 6;
    const p = new THREE.Vector3(PLATE.x + Math.cos(a) * RING, PCY, PLATE.z + Math.sin(a) * RING);
    const qy = new THREE.Quaternion().setFromAxisAngle(UP, R() * TAU);
    const s = 0.94 + R() * 0.1;
    if (i === 0) { qy.setFromAxisAngle(UP, 2.2); HERO_Q.copy(qy); }
    const m = new THREE.Matrix4().compose(p, qy, new THREE.Vector3(s, s, s));
    puriAt.push({ p, m, s });
    shellsIM.setMatrixAt(i, m);
    fillIM.setMatrixAt(i, m);
    const yl = 0.42 * PR, rr = PR * Math.sqrt(1 - (yl / (PSQ * PR)) ** 2) * 0.86;
    paniIM.setMatrixAt(i, _m2.multiplyMatrices(m, _m1.makeScale(rr, 1, rr).setPosition(0, yl, 0)));
    shellsIM.setColorAt(i, new THREE.Color().setScalar(0.95 + R() * 0.08));
  }
  const HERO_REST = puriAt[0].p.clone();
  const SPOT = new THREE.Vector3(HERO_REST.x, PFLOOR, HERO_REST.z);

  // ---------------------------------------------------------------- the pot, the ladle, the bowls, the basket
  const PT = [24, 36, 48][q];
  const pot = new THREE.Mesh(geo(lathe([
    [0, 0], [0.07, 0], [0.082, 0.003], [0.1, 0.02], [0.118, 0.05], [0.128, 0.085], [0.127, 0.11], [0.12, 0.14], [0.106, 0.17], [0.098, 0.19], [0.098, 0.2],
    [0.103, 0.208], [0.108, 0.214], [0.107, 0.2195], [0.1012, 0.2195], [0.0962, 0.213],
    [0.0942, 0.2], [0.0942, 0.19], [0.102, 0.17], [0.1157, 0.14], [0.1232, 0.11], [0.1242, 0.085], [0.1142, 0.05], [0.0962, 0.022], [0.0792, 0.006], [0, 0.0035],
  ], PT)), steelMat);
  pot.position.copy(POT);
  shade(pot, true, true);
  const potPani = new THREE.Mesh(discGeo, paniMat);
  potPani.position.set(POT.x, POT.y + POT_PANI, POT.z);
  potPani.scale.set(0.11, 1, 0.11);
  potPani.renderOrder = 2;
  scene.add(pot, potPani);

  // the ladle: pivot at its pouring lip; the cup to +x, the handle rising beyond it
  const ladle = new THREE.Group();
  {
    const cup = lathe([[0, -0.024], [0.012, -0.0225], [0.021, -0.017], [0.027, -0.009], [0.0295, -0.002], [0.03, 0], [0.0302, 0.0012], [0.0288, 0.0014], [0.0283, 0], [0.0278, -0.002], [0.0256, -0.0085], [0.0198, -0.0155], [0.0115, -0.0205], [0, -0.022]], [20, 28, 36][q]);
    cup.scale(0.75, 0.75, 0.75);
    cup.translate(0.0225, 0, 0);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.044, 0.0, 0), new THREE.Vector3(0.062, 0.018, 0), new THREE.Vector3(0.1, 0.085, 0), new THREE.Vector3(0.135, 0.15, 0), new THREE.Vector3(0.148, 0.172, 0), new THREE.Vector3(0.142, 0.186, 0)]);
    const handle = new THREE.TubeGeometry(curve, 40, 0.0042, 8, false);
    const lg = mergeGeometries([cup, handle], false);
    cup.dispose(); handle.dispose();
    const lm = new THREE.Mesh(geo(lg), steelMat);
    shade(lm, true, true);
    ladle.add(lm);
  }
  const ladlePani = new THREE.Mesh(discGeo, paniMat);
  ladlePani.position.set(0.0225, -0.0045, 0);
  ladlePani.scale.set(0.018, 1, 0.018);
  ladlePani.renderOrder = 2;
  ladle.add(ladlePani);
  scene.add(ladle);
  const LADLE_REST_P = new THREE.Vector3(POT.x + 0.041, POT.y + 0.135, POT.z + 0.041);
  const LADLE_REST_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 2.36, 0));
  const LADLE_POUR_P = HERO_REST.clone().add(new THREE.Vector3(0.002, 0.062, 0.0));
  const LADLE_POUR_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 1.9, 0));
  const TILT = 1.02;

  // bowls (instanced steel) and what's in them
  const bowlGeo = geo(lathe([[0, 0], [0.03, 0], [0.034, 0.002], [0.04, 0.01], [0.044, 0.022], [0.046, 0.03], [0.0465, 0.032], [0.045, 0.0326], [0.0435, 0.031], [0.0415, 0.022], [0.0372, 0.012], [0.0302, 0.0062], [0, 0.0046]], [24, 32, 40][q]));
  const bowlsIM = new THREE.InstancedMesh(bowlGeo, steelMatI, BOWLS.length);
  BOWLS.forEach(([x, z], i) => bowlsIM.setMatrixAt(i, _m1.makeRotationY(R() * TAU).setPosition(x, CT, z)));
  shade(bowlsIM, true, true);
  bowlsIM.customDepthMaterial = depthInst;
  scene.add(bowlsIM);
  const chutney = (mat, [x, z], y) => {
    const g = new THREE.CircleGeometry(0.0395, 32).rotateX(-Math.PI / 2);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const px = p.getX(i), pz = p.getZ(i); p.setY(i, 0.0012 * Math.sin(px * 160 + pz * 90) * Math.sin(pz * 140) * (1 - (Math.hypot(px, pz) / 0.04) ** 2)); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(geo(g), mat);
    m.position.set(x, CT + y, z);
    m.receiveShadow = shadows;
    scene.add(m);
    return m;
  };
  chutney(tamarindMat, BOWLS[0], 0.024);
  chutney(greenMat, BOWLS[2], 0.0235);

  // every heap of food on the counter is one vertex-coloured mesh: the filling, the onion, the sev,
  // and the boondi and mint leaves floating in the pot
  {
    const F = foodPieces(R, q);
    const mound = ([x, z], h, rad, n, fn) => {
      for (let i = 0; i < n; i++) {
        const a = R() * TAU, r = Math.sqrt(R()) * rad;
        const y = CT + 0.012 + h * (1 - (r / rad) ** 2) * (0.6 + 0.4 * R());
        fn(x + Math.cos(a) * r, y, z + Math.sin(a) * r, a);
      }
    };
    mound(BOWLS[1], 0.022, 0.033, [20, 34, 46][q], (x, y, z) => F.potato(x, y, z, 1.15 + R() * 0.3));
    mound(BOWLS[1], 0.024, 0.026, [5, 8, 12][q], (x, y, z) => F.chana(x, y + 0.002, z, 1.05));
    mound(BOWLS[1], 0.026, 0.02, [3, 4, 6][q], (x, y, z) => F.leaf(x, y + 0.004, z, 1.3));
    mound(BOWLS[3], 0.018, 0.034, [40, 64, 90][q], (x, y, z) => F.onion(x, y, z, 1.7));
    mound(BOWLS[3], 0.02, 0.02, [2, 3, 4][q], (x, y, z) => F.leaf(x, y + 0.003, z, 1.2));
    mound(BOWLS[4], 0.024, 0.035, [60, 100, 140][q], (x, y, z, a) => F.sev(x, y, z, 0.01 + R() * 0.012, a * 2 + R() * 3, (R() - 0.5) * 0.9));
    for (let i = 0; i < [8, 12, 16][q]; i++) { const a = R() * TAU, r = Math.sqrt(R()) * 0.085; F.boondi(POT.x + Math.cos(a) * r, POT.y + POT_PANI - 0.001, POT.z + Math.sin(a) * r); }
    for (let i = 0; i < 5; i++) { const a = R() * TAU, r = Math.sqrt(R()) * 0.08; F.mint(POT.x + Math.cos(a) * r, POT.y + POT_PANI + 0.0006, POT.z + Math.sin(a) * r); }
    const fm = new THREE.Mesh(geo(F.merge()), foodMat);
    shade(fm, false, true);
    scene.add(fm);
  }

  // a basket heaped with whole puris
  const basket = new THREE.Mesh(geo(lathe([[0, 0], [0.12, 0], [0.14, 0.01], [0.153, 0.04], [0.158, 0.058], [0.156, 0.063], [0.15, 0.06], [0.146, 0.044], [0.133, 0.015], [0, 0.012]], [28, 36, 48][q])), basketMat);
  basket.position.copy(BASKET);
  shade(basket, true, true);
  scene.add(basket);
  const heap = [];
  {
    const add = (r, a, y, tilt) => heap.push([BASKET.x + Math.cos(a) * r, CT + y, BASKET.z + Math.sin(a) * r, tilt]);
    add(0, 0, 0.032, 0.2);
    for (let i = 0; i < 6; i++) add(0.052, (i * TAU) / 6 + 0.3, 0.032, 0.35);
    if (q >= 1) for (let i = 0; i < 9; i++) add(0.105, (i * TAU) / 9, 0.046, 0.6);
    for (let i = 0; i < (q >= 1 ? 6 : 2); i++) add(0.03 + 0.03 * (i % 2), (i * TAU) / 6 + 0.8, 0.07, 0.4);
    if (q === 2) for (let i = 0; i < 3; i++) add(0.018, (i * TAU) / 3 + 0.2, 0.104, 0.3);
  }
  const heapIM = new THREE.InstancedMesh(whole.geo, shellMat, heap.length);
  heap.forEach(([x, y, z, tilt], i) => {
    _e1.set((R() - 0.5) * tilt * 2, R() * TAU, (R() - 0.5) * tilt * 2);
    const s = 0.92 + R() * 0.12;
    heapIM.setMatrixAt(i, _m1.compose(_v1.set(x, y, z), _q1.setFromEuler(_e1), _s1.set(s, s, s)));
    heapIM.setColorAt(i, new THREE.Color().setScalar(0.93 + R() * 0.1));
  });
  shade(heapIM, true, true);
  heapIM.customDepthMaterial = depthInstCol;
  scene.add(heapIM);

  // soft contact shadows (they ground everything, and are all the low tier has)
  const aoList = [[PLATE.x, CT, PLATE.z, 0.25, 0.9], [POT.x, CT, POT.z, 0.33, 1], [BASKET.x, CT, BASKET.z, 0.37, 0.9], ...BOWLS.map(([x, z]) => [x, CT, z, 0.115, 0.85]),
    ...puriAt.map(({ p }) => [p.x, PFLOOR, p.z, 0.07, 0.75])];
  const AO_HERO = aoList.length - 6;
  const aoIM = new THREE.InstancedMesh(geo(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), aoMat, aoList.length);
  aoIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  aoIM.frustumCulled = false;
  aoIM.renderOrder = 1;
  const aoM = aoList.map(([x, y, z, s]) => new THREE.Matrix4().makeScale(s, 1, s).setPosition(x, y + 0.0004, z));
  aoM.forEach((m, i) => aoIM.setMatrixAt(i, m));
  aoIM.setColorAt(0, new THREE.Color(1, 1, 1));
  aoList.forEach((a, i) => aoIM.setColorAt(i, new THREE.Color().setScalar(a[4])));
  scene.add(aoIM);

  // the little pool of pani left where the eaten puri sat (the drop lands in it)
  const puddle = new THREE.Mesh(discGeo, paniMat);
  puddle.position.set(SPOT.x, PFLOOR + 0.0005, SPOT.z);
  puddle.scale.set(0.016, 1, 0.013);
  puddle.renderOrder = 2;
  puddle.visible = false;
  scene.add(puddle); late.push(puddle);

  // ---------------------------------------------------------------- her (the chapter's figure)
  const fig = createFigure(env, { who: 'deepu', quality: q, envMap });
  fig.group.position.copy(FIG_AT);
  scene.add(fig.group);
  late.push(fig.group);
  const grip = new THREE.Object3D();        // what her hand "holds" (the finger curl); the puri follows it
  scene.add(grip);
  const LEFT_REST = new THREE.Vector3(FIG_AT.x + 0.2, CT + 0.014, -0.225);
  const LIFT = new THREE.Vector3(FIG_AT.x - 0.07, 1.31, FIG_AT.z + 0.2);

  // ---------------------------------------------------------------- the pour, the bits, the drop, the ring
  const streamU = { uHead: { value: 0 }, uTail: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color('#9ccf72') } };
  const streamGeo = geo(new THREE.CylinderGeometry(1, 1, 1, 10, 24, true).translate(0, -0.5, 0));
  const stream = new THREE.Mesh(streamGeo, keep(new THREE.ShaderMaterial({ uniforms: streamU, vertexShader: STREAM_VERT, fragmentShader: STREAM_FRAG, transparent: true, depthWrite: false })));
  stream.renderOrder = 3;
  stream.frustumCulled = false;
  stream.visible = false;
  scene.add(stream); late.push(stream);

  // crumbs and droplets: one instanced draw, simulated on the CPU
  const NB = [18, 26, 34][q];
  const bits = new THREE.InstancedMesh(geo(new THREE.SphereGeometry(1, 8, 6)), bitsMat, NB);
  bits.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bits.frustumCulled = false;
  const B = { p: new Float32Array(NB * 3), v: new Float32Array(NB * 3), r: new Float32Array(NB * 3), life: new Float32Array(NB), max: new Float32Array(NB), size: new Float32Array(NB), kind: new Uint8Array(NB), land: new Uint8Array(NB) };
  const CRUMB = [new THREE.Color('#dca450'), new THREE.Color('#c8893a'), new THREE.Color('#ecc678')], DROPC = new THREE.Color('#a8dc8c');
  for (let i = 0; i < NB; i++) { bits.setMatrixAt(i, ZERO); bits.setColorAt(i, CRUMB[i % 3]); }
  scene.add(bits);

  const drop = new THREE.Mesh(geo(new THREE.SphereGeometry(1, 16, 12)), dropMat);
  drop.scale.set(0.0032, 0.0043, 0.0032);
  drop.renderOrder = 3;
  drop.visible = false;
  scene.add(drop); late.push(drop);

  const portalU = { uTime: { value: 0 }, uRipple: { value: 0 }, uRippleA: { value: 0 }, uGold: { value: 0 }, uPortal: { value: 0 } };
  const portal = new THREE.Mesh(geo(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), keep(new THREE.ShaderMaterial({ uniforms: portalU, vertexShader: PORTAL_VERT, fragmentShader: PORTAL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  portal.position.set(SPOT.x, PFLOOR + 0.0012, SPOT.z);
  portal.scale.setScalar(0.11);
  portal.renderOrder = 6;
  portal.visible = false;
  scene.add(portal); late.push(portal);

  // the golden thread, out of the ring and away
  const threadPts = [
    [0, 0.002, 0], [0, 0.04, 0], [0.03, 0.1, 0.02], [-0.012, 0.17, 0.06], [0.06, 0.26, 0.1], [0.18, 0.42, 0.22],
  ].map(([x, y, z]) => new THREE.Vector3(SPOT.x + x, SPOT.y + y, SPOT.z + z))
    .concat([new THREE.Vector3(0.45, CT + 0.7, 0.55), new THREE.Vector3(0.95, CT + 1.15, 1.25), new THREE.Vector3(1.8, CT + 1.8, 2.4), new THREE.Vector3(3.0, CT + 2.6, 3.8)]);
  const path = new PathSampler(threadPts, { samples: 1600 });
  const strand = createStrand({ segments: [90, 120, 150][q] });
  strand.mesh.visible = false;
  scene.add(strand.mesh); late.push(strand.mesh);
  const TH = { s0: 0, s1: 0 };

  // ---------------------------------------------------------------- lights
  const key = new THREE.SpotLight(0xffd2a6, 0, 0, 0.98, 0.85, 2);
  key.position.copy(BULB);
  key.target.position.set(0, CT, -0.16);
  if (shadows) {
    key.castShadow = true;
    const ss = q === 2 ? 1024 : 512;
    key.shadow.mapSize.set(ss, ss);
    key.shadow.camera.near = 0.2;
    key.shadow.camera.far = 3.2;
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.006;
    key.shadow.radius = 3;
  }
  const glow = new THREE.PointLight(0xffb26a, 0, 0, 2);
  glow.position.copy(BULB);
  const rim = new THREE.DirectionalLight(0x8e9cff, 0);
  rim.position.set(-1.4, 2.6, -3.6);
  rim.target.position.set(0, 1, 0);
  const hemi = new THREE.HemisphereLight(0x8a7a9c, 0x2e1c14, 0.36);
  scene.add(key, key.target, glow, rim, rim.target, hemi);

  // ---------------------------------------------------------------- bokeh, motes, sparks
  const bokehMat = keep(new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uDefocus: { value: 0 }, uBright: { value: 1 } }, vertexShader: BOKEH_VERT, fragmentShader: BOKEH_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const nBok = [26, 40, 56][q];
  const bokeh = billboards(nBok, [['aPos', 3], ['aCol', 4], ['aMisc', 2]], bokehMat);
  keep(bokeh.geo);
  bokeh.mesh.renderOrder = -5;
  scene.add(bokeh.mesh);
  // the evening market behind the stall, out of focus: other stalls' festoons and lamps, shop glows
  const BPAL = [[1.0, 0.62, 0.26], [1.0, 0.5, 0.18], [1.0, 0.76, 0.42], [1.0, 0.45, 0.42], [0.45, 0.8, 0.62], [1.0, 0.68, 0.3]];
  for (let i = 0; i < nBok; i++) {
    const kind = R();
    let x, y, z;
    if (kind < 0.45) { x = (R() - 0.5) * 12; z = -3 - R() * 7; y = 1.9 + R() * 1.1 + Math.sin(x * 1.3) * 0.15; }   // festoons
    else if (kind < 0.75) { x = (R() - 0.5) * 12; z = -2.6 - R() * 7; y = 1.0 + R() * 1.0; }                    // stall lamps
    else if (kind < 0.9) { x = (R() - 0.5) * 10; z = -2.4 - R() * 5; y = 0.25 + R() * 0.8; }                     // low glows
    else { x = (R() < 0.5 ? -1 : 1) * (2.4 + R() * 3); z = -1 + R() * 3; y = 0.8 + R() * 2; }                   // to the sides
    const c = BPAL[Math.floor(R() * BPAL.length)];
    bokeh.attrs.aPos.setXYZ(i, x, y, z);
    bokeh.attrs.aCol.setXYZW(i, c[0], c[1], c[2], 0.12 + R() * 0.2);
    bokeh.attrs.aMisc.setXY(i, 0.14 + R() * 0.32, R());
  }

  const moteMat = keep(new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uBright: { value: 1 } }, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const nMote = reduced ? [40, 80, 120][q] : [90, 180, 300][q];
  const motes = billboards(nMote, [['aPos', 3], ['aMisc', 3]], moteMat);
  keep(motes.geo);
  motes.mesh.renderOrder = 8;
  scene.add(motes.mesh);
  for (let i = 0; i < nMote; i++) {
    const near = i < nMote * 0.3;   // (a share of them near the plate, for the macro shots)
    const p = near ? [HERO_REST.x + (R() - 0.5) * 0.4, CT + 0.03 + R() * 0.3, HERO_REST.z + (R() - 0.3) * 0.4] : [-0.8 + R() * 1.7, CT + R() * 1.0, -0.6 + R() * 1.1];
    motes.attrs.aPos.setXYZ(i, ...p);
    motes.attrs.aMisc.setXYZ(i, near ? 0.0012 + R() * 0.0018 : 0.003 + R() * R() * 0.006, R(), 0.015 + R() * 0.035);
  }

  // sparks: glints that flash when a surface turns into the bulb's light, halos round the lights,
  // the delight sparkles, the thread's head, the portal's bloom
  const glints = [];
  {
    for (const [th, ph] of [[1.0, 0.5], [1.15, 2.6], [0.95, 4.4], [1.35, 1.6]]) {
      const p = shell.shape.point(th, ph, new THREE.Vector3());
      glints.push({ obj: 'hero', p, n: p.clone().normalize(), size: 0.0075, sharp: 90, gain: 1.6 });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.4;
      glints.push({ obj: null, p: new THREE.Vector3(PLATE.x + Math.cos(a) * 0.1062, PLATE.y + 0.0148, PLATE.z + Math.sin(a) * 0.1062), n: new THREE.Vector3(Math.cos(a) * 0.6, 0.8, Math.sin(a) * 0.6).normalize(), size: 0.008, sharp: 90, gain: 0.9 });
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 1.1;
      glints.push({ obj: null, p: new THREE.Vector3(POT.x + Math.cos(a) * 0.109, POT.y + 0.218, POT.z + Math.sin(a) * 0.109), n: new THREE.Vector3(Math.cos(a) * 0.55, 0.83, Math.sin(a) * 0.55).normalize(), size: 0.012, sharp: 70, gain: 0.9 });
    }
    glints.push({ obj: ladle, p: new THREE.Vector3(0.0225, -0.0135, 0.009), n: new THREE.Vector3(0, -0.4, 0.9).normalize(), size: 0.005, sharp: 60, gain: 1.0 });
  }
  const SP_BULB = glints.length, SP_STR = SP_BULB + 1, SP_SPK = SP_STR + strings.length, SP_HEAD = SP_SPK + 3, SP_PORTAL = SP_HEAD + 1, SP_DROP = SP_PORTAL + 1;
  const nSpark = SP_DROP + 1;
  const sparkMat = keep(new THREE.ShaderMaterial({ vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const sparks = billboards(nSpark, [['aPos', 3, true], ['aCol', 4, true], ['aMisc', 3, true]], sparkMat);
  keep(sparks.geo);
  sparks.mesh.renderOrder = 20;
  scene.add(sparks.mesh);
  const SA = sparks.attrs;
  // (the halos never move: write them once)
  SA.aPos.setXYZ(SP_BULB, BULB.x, BULB.y, BULB.z);
  strings.forEach((p, i) => { SA.aPos.setXYZ(SP_STR + i, p.x, p.y, p.z); const c = STRING_COLS[i % STRING_COLS.length]; SA.aCol.setXYZW(SP_STR + i, c[0] / 3.6, c[1] / 3.6, c[2] / 3.6, 0); SA.aMisc.setXYZ(SP_STR + i, 0.075, 0, 0); });

  // ---------------------------------------------------------------- state
  // W: the looks and actions the choreography animates
  const W = {
    key: 1, sky: 1, blur: 1, defocus: 0.5, bokeh: 1, motes: 1, glints: 1, halos: 1, exposure: 1,
    pani: 0, ladle: 0, tilt: 0, cup: 1, stream: 0, tail: 0,
    heroOn: 1, carry: 0, bite: 0, tiltMouth: 0, lookHero: 0, puddle: 0,
    fx: FIG_AT.x, yaw: 0, shimmy: 0, spA: 0, spB: 0, spC: 0,
    drop: -1, ripple: 0, rippleA: 0, gold: 0, portal: 0, thread: 0, width: 0.05, head: 0,
  };
  const cam = { x: 0, y: 1, z: 0, az: 0, el: 0.1, lh: 0, lw: 0, fov: 32, lift: 0, breath: 0.4, fk: 0, hk: 0, oy: 0 };
  const faceSm = new THREE.Vector3(), headSm = new THREE.Vector3(), head = new THREE.Vector3();
  let faceInit = false, headInit = false;
  let held = false, heldT = 0, fresh = 0;   // (dev holds: a frozen frame, drawn `fresh` more times)
  const heroM = new THREE.Matrix4();
  const heroPos = new THREE.Vector3().copy(HERO_REST);

  const api = {
    id: 'panipuri', scene, camera, exposure: 1,
    // (threshold high enough that only the bulbs, the string lights, glints and the thread glow)
    bloom: { strength: 0.55, radius: 0.55, threshold: 0.92 },
    late,
    update, resize, play, dispose,
    dev: dev ? { beat: '', held: false, W, cam, fig, counts: { nBok, nMote, NB, heap: heap.length, strings: strings.length } } : null,
  };

  // ---------------------------------------------------------------- per-frame
  function emit(kind, at, n, spd) {
    for (let k = 0, i = 0; i < NB && k < n; i++) {
      if (B.life[i] > 0) continue;
      k++;
      B.kind[i] = kind; B.land[i] = 0;
      B.p[i * 3] = at.x + (R() - 0.5) * 0.01; B.p[i * 3 + 1] = at.y + (R() - 0.5) * 0.006; B.p[i * 3 + 2] = at.z + (R() - 0.5) * 0.01;
      const a = R() * TAU, s = spd * (0.4 + R() * 0.8);
      B.v[i * 3] = Math.cos(a) * s * 0.6; B.v[i * 3 + 1] = spd * (0.4 + R() * 0.9); B.v[i * 3 + 2] = Math.sin(a) * s * 0.6 + (kind === 2 ? 0 : spd * 0.8);
      B.r[i * 3] = R() * TAU; B.r[i * 3 + 1] = R() * TAU; B.r[i * 3 + 2] = R() * TAU;
      B.max[i] = B.life[i] = kind === 2 ? 0.35 + R() * 0.2 : 1.2 + R() * 0.8;
      B.size[i] = kind === 0 ? 0.0018 + R() * 0.0022 : kind === 1 ? 0.0015 + R() * 0.0012 : 0.0009 + R() * 0.0008;
      bits.setColorAt(i, kind === 0 ? CRUMB[i % 3] : DROPC);
    }
    if (bits.instanceColor) bits.instanceColor.needsUpdate = true;
  }

  function stepBits(dt) {
    const g = 4.2;
    for (let i = 0; i < NB; i++) {
      if (B.life[i] <= 0) continue;
      B.life[i] -= dt;
      if (B.life[i] <= 0) { bits.setMatrixAt(i, ZERO); continue; }
      const k = i * 3;
      if (!B.land[i]) {
        B.v[k + 1] -= g * dt;
        B.p[k] += B.v[k] * dt; B.p[k + 1] += B.v[k + 1] * dt; B.p[k + 2] += B.v[k + 2] * dt;
        B.r[k] += dt * 9; B.r[k + 1] += dt * 7;
        // crumbs that reach the counter top stay there a moment
        const floor = B.kind[i] === 2 ? SPOT.y + 0.0005 : CT + B.size[i] * 0.4;
        if (B.p[k + 1] < floor && (B.kind[i] === 2 || (B.p[k + 2] > -0.25 && B.p[k + 2] < 0.31))) { B.p[k + 1] = floor; B.land[i] = 1; }
      }
      const f = Math.min(1, B.life[i] / 0.3) * (B.kind[i] === 2 ? 1 : 1);
      const s = B.size[i] * f;
      _e1.set(B.r[k], B.r[k + 1], B.r[k + 2]);
      _s1.set(s, B.kind[i] === 0 ? s * 0.45 : s, B.kind[i] === 0 ? s * 0.8 : s);
      bits.setMatrixAt(i, _m1.compose(_v1.set(B.p[k], B.p[k + 1], B.p[k + 2]), _q1.setFromEuler(_e1), _s1));
    }
    bits.instanceMatrix.needsUpdate = true;
  }

  function placeHero() {
    if (W.heroOn < 0.5) {
      shellsIM.setMatrixAt(0, ZERO); fillIM.setMatrixAt(0, ZERO); paniIM.setMatrixAt(0, ZERO);
      aoIM.setMatrixAt(AO_HERO, ZERO);
    } else {
      heroPos.copy(HERO_REST);
      if (W.carry > 0) {
        _v1.set(0, 0, GRIP).applyMatrix4(fig.parts.handSocketR.matrixWorld);
        heroPos.lerp(_v1, W.carry);
      }
      _q1.copy(HERO_Q);
      let s = puriAt[0].s;
      if (W.carry > 0 || W.bite > 0) {
        _v2.setFromMatrixPosition(fig.parts.mouth.matrixWorld);
        _v3.set(Math.sin(fig.group.rotation.y), 0, Math.cos(fig.group.rotation.y));
        if (W.bite > 0) { _v4.copy(_v2).addScaledVector(_v3, 0.004); heroPos.lerp(_v4, smooth(0, 1, W.bite)); s *= 1 - 0.75 * W.bite; }
        // tip the opening toward her mouth as it comes up
        _v4.copy(_v2).sub(heroPos); _v4.y = 0;
        if (_v4.lengthSq() > 1e-8) {
          _v4.normalize();
          _v5.copy(UP).addScaledVector(_v4, 1.1 * W.tiltMouth).normalize();
          _q1.premultiply(_q2.setFromUnitVectors(UP, _v5));
        }
      }
      heroM.compose(heroPos, _q1, _s1.set(s, s, s));
      shellsIM.setMatrixAt(0, heroM); fillIM.setMatrixAt(0, heroM);
      const yl = lerp(0.12, 0.5, W.pani) * PR, rr = PR * Math.sqrt(1 - (yl / (PSQ * PR)) ** 2) * 0.86 * clamp(W.pani * 4, 0, 1);
      if (rr > 1e-5) paniIM.setMatrixAt(0, _m2.multiplyMatrices(heroM, _m1.makeScale(rr, 1, rr).setPosition(0, yl, 0))); else paniIM.setMatrixAt(0, ZERO);
      const ao = 1 - clamp(W.carry * 3, 0, 1);
      if (ao > 0.01) aoIM.setMatrixAt(AO_HERO, _m1.copy(aoM[AO_HERO]).scale(_s1.set(ao, 1, ao)).setPosition(SPOT.x, PFLOOR + 0.0004, SPOT.z)); else aoIM.setMatrixAt(AO_HERO, ZERO);
    }
    shellsIM.instanceMatrix.needsUpdate = true; fillIM.instanceMatrix.needsUpdate = true; paniIM.instanceMatrix.needsUpdate = true;
    aoIM.instanceMatrix.needsUpdate = true;
  }

  function placeLadle() {
    const k = W.ladle;
    ladle.position.lerpVectors(LADLE_REST_P, LADLE_POUR_P, smooth(0, 1, k));
    ladle.position.y += Math.sin(Math.PI * k) * 0.2;
    ladle.quaternion.slerpQuaternions(LADLE_REST_Q, LADLE_POUR_Q, smooth(0.1, 0.8, k));
    ladle.quaternion.multiply(_q1.setFromAxisAngle(ZAX, W.tilt * TILT));
    ladlePani.scale.set(0.018 * W.cup, 1, 0.018 * W.cup);
    ladlePani.visible = W.cup > 0.05;
  }

  function updateStream(t) {
    stream.visible = W.stream > 0.001 && W.tail < 0.999;
    if (!stream.visible) return;
    const yTop = ladle.position.y - 0.001;
    const ySurf = HERO_REST.y + lerp(0.12, 0.5, W.pani) * PR;
    stream.position.set(ladle.position.x, yTop, ladle.position.z);
    stream.scale.set(0.00175, Math.max(0.005, yTop - ySurf), 0.00175);
    streamU.uHead.value = W.stream; streamU.uTail.value = W.tail; streamU.uTime.value = t;
  }

  function updateCamera(dt, t) {
    _v1.set(cam.x, cam.y, cam.z);
    if (cam.fk > 0.001) {
      _v2.setFromMatrixPosition(fig.parts.eyes.matrixWorld);
      if (!faceInit) { faceSm.copy(_v2); faceInit = true; }
      faceSm.x = damp(faceSm.x, _v2.x, 4, dt); faceSm.y = damp(faceSm.y, _v2.y, 4, dt); faceSm.z = damp(faceSm.z, _v2.z, 4, dt);
      _v1.lerp(faceSm, cam.fk);
    } else faceInit = false;
    if (cam.hk > 0.001) {
      if (!headInit) { headSm.copy(head); headInit = true; }
      headSm.x = damp(headSm.x, head.x, 6, dt); headSm.y = damp(headSm.y, head.y, 6, dt); headSm.z = damp(headSm.z, head.z, 6, dt);
      _v1.lerp(headSm, cam.hk);
    } else headInit = false;
    _v1.y += cam.oy;
    const tv = Math.tan((cam.fov * DEG) / 2), th = tv * camera.aspect;
    const dist = Math.max(Math.exp(cam.lh) / tv, Math.exp(cam.lw) / th);
    const ce = Math.cos(cam.el);
    rig.pos.set(_v1.x + Math.sin(cam.az) * ce * dist, _v1.y + Math.sin(cam.el) * dist, _v1.z + Math.cos(cam.az) * ce * dist);
    rig.look.set(_v1.x, _v1.y - cam.lift * dist * tv, _v1.z);
    rig.fov = cam.fov;
    rig.breath = reduced ? 0 : cam.breath * Math.min(1, dist * 0.5);
    rig.apply(t);
    const near = clamp(dist * 0.035, 0.003, 0.06);
    if (Math.abs(camera.near - near) > near * 0.08) { camera.near = near; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }

  function writeSparks(t) {
    const gl = W.glints * W.key;
    for (let i = 0; i < glints.length; i++) {
      const G = glints[i];
      if (G.obj === 'hero') {
        if (W.heroOn < 0.5) { SA.aCol.setW(i, 0); continue; }
        _v1.copy(G.p).applyMatrix4(heroM);
        _v2.copy(G.n).transformDirection(heroM);
      } else if (G.obj) {
        _v1.copy(G.p).applyMatrix4(G.obj.matrixWorld);
        _v2.copy(G.n).transformDirection(G.obj.matrixWorld);
      } else { _v1.copy(G.p); _v2.copy(G.n); }
      _v3.copy(BULB).sub(_v1).normalize();
      _v4.copy(camera.position).sub(_v1).normalize().add(_v3).normalize();
      const a = Math.pow(Math.max(0, _v2.dot(_v4)), G.sharp) * gl * G.gain;
      SA.aPos.setXYZ(i, _v1.x, _v1.y, _v1.z);
      SA.aCol.setXYZW(i, 1.0, 0.9, 0.72, a);
      SA.aMisc.setXYZ(i, G.size * (0.7 + 0.3 * Math.min(1, a)), 1, 0.2 + a * 0.2);
    }
    // halos: the bulb (a slow, tiny filament flicker) and the string lights
    const fl = 0.94 + 0.04 * Math.sin(t * 7.1) + 0.02 * Math.sin(t * 13.3 + 1.1);
    SA.aCol.setXYZW(SP_BULB, 1.0, 0.7, 0.38, 0.75 * W.halos * fl);
    SA.aMisc.setXYZ(SP_BULB, 0.5, 0, 0);
    for (let i = 0; i < strings.length; i++) SA.aCol.setW(SP_STR + i, W.halos * (0.55 + 0.1 * Math.sin(t * 1.3 + i * 2.1)));
    // the delight sparkles, round her head
    if (fig.group.visible && (W.spA + W.spB + W.spC) > 0.001) {
      _v1.setFromMatrixPosition(fig.parts.eyes.matrixWorld);
      _v2.setFromMatrixColumn(camera.matrixWorld, 0);
      _v3.setFromMatrixColumn(camera.matrixWorld, 1);
      for (let k = 0; k < 3; k++) {
        const e = k === 0 ? W.spA : k === 1 ? W.spB : W.spC;
        _v4.copy(_v1).addScaledVector(_v2, SPK_OFFS[k][0]).addScaledVector(_v3, SPK_OFFS[k][1]);
        SA.aPos.setXYZ(SP_SPK + k, _v4.x, _v4.y, _v4.z);
        SA.aCol.setXYZW(SP_SPK + k, 1.0, 0.86, 0.6, Math.sin(Math.PI * clamp(e, 0, 1)) * 1.4);
        SA.aMisc.setXYZ(SP_SPK + k, 0.05 + 0.03 * Math.sin(Math.PI * clamp(e, 0, 1)), 1, t * 0.8 + k);
      }
    } else for (let k = 0; k < 3; k++) SA.aCol.setW(SP_SPK + k, 0);
    // the thread's head; the portal's bloom (both glows over the plate: kind 0.5); the falling drop's glint
    SA.aPos.setXYZ(SP_HEAD, head.x, head.y, head.z);
    SA.aCol.setXYZW(SP_HEAD, 1.0, 0.8, 0.48, W.head * W.thread);
    SA.aMisc.setXYZ(SP_HEAD, 0.05 + W.width * 0.5, 0.5, 0);
    SA.aPos.setXYZ(SP_PORTAL, SPOT.x, SPOT.y + 0.006, SPOT.z);
    // (gold, not a white-out: the ring under it carries the brightness)
    SA.aCol.setXYZW(SP_PORTAL, 1.0, 0.66, 0.3, W.portal * 0.32);
    SA.aMisc.setXYZ(SP_PORTAL, 0.12, 0.5, 0);
    if (drop.visible) {
      SA.aPos.setXYZ(SP_DROP, drop.position.x - 0.001, drop.position.y + 0.0015, drop.position.z + 0.002);
      SA.aCol.setXYZW(SP_DROP, 1.0, 0.95, 0.85, 0.9);
      SA.aMisc.setXYZ(SP_DROP, 0.012, 1, 0.3);
    } else SA.aCol.setW(SP_DROP, 0);
    SA.aPos.needsUpdate = SA.aCol.needsUpdate = SA.aMisc.needsUpdate = true;
  }

  function update(dt, t) {
    if (held) {
      if (fresh <= 0) return;
      fresh--; t = heldT; dt = 0;
    }
    if (fig.group.visible) {
      fig.group.position.x = W.fx;
      fig.group.rotation.y = W.yaw + W.shimmy * Math.sin(t * 15.5) * 0.065;
      if (W.lookHero > 0) fig.lookAt(heroPos, 6);
      fig.update(dt, t);
    }
    placeHero();
    placeLadle();
    updateStream(t);
    stepBits(dt);
    // the drop, the ripple and the ring
    drop.visible = W.drop >= 0;
    if (drop.visible) drop.position.set(SPOT.x, SPOT.y + 0.003 + W.drop, SPOT.z);
    puddle.visible = W.puddle > 0.01;
    portal.visible = W.rippleA > 0.001 || W.portal > 0.001;
    portalU.uTime.value = t; portalU.uRipple.value = W.ripple; portalU.uRippleA.value = W.rippleA; portalU.uGold.value = W.gold; portalU.uPortal.value = W.portal;
    // the thread
    strand.mesh.visible = W.thread > 0.001;
    if (strand.mesh.visible) {
      strand.uniforms.uOpacity.value = W.thread;
      strand.uniforms.uWidth.value = W.width;
      strand.update(path, TH.s0, Math.max(TH.s0 + 0.01, TH.s1), t, STRAND_OPTS);
    }
    path.at(TH.s1, head);
    updateCamera(dt, t);
    writeSparks(t);
    // lights & air
    key.intensity = 3.4 * W.key;
    glow.intensity = 1.3 * (0.35 + 0.65 * W.key);
    rim.intensity = 1.1 * (0.4 + 0.6 * W.key);
    skyMat.uniforms.uDusk.value = W.sky;
    skyMat.uniforms.uBlur.value = W.blur;
    bokehMat.uniforms.uTime.value = t; bokehMat.uniforms.uDefocus.value = W.defocus; bokehMat.uniforms.uBright.value = W.bokeh;
    moteMat.uniforms.uTime.value = t; moteMat.uniforms.uBright.value = W.motes;
    api.exposure = W.exposure;
  }

  function resize({ aspect }) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- shots
  const portrait = () => (env.size?.aspect ?? 1.6) < 0.8;
  const LN = Math.log;
  function shot(name) {
    const p = portrait();
    const H = HERO_REST;
    switch (name) {
      case 'macro': return { x: H.x, y: H.y + 0.002, z: H.z, az: -0.62, el: 0.07, lh: LN(0.036), lw: LN(p ? 0.034 : 0.056), fov: 30, lift: 0.02, breath: 0.4, fk: 0, hk: 0, oy: 0 };
      case 'macro2': return { x: H.x, y: H.y + 0.003, z: H.z, az: -0.42, el: 0.12, lh: LN(0.031), lw: LN(p ? 0.03 : 0.048), fov: 30, lift: 0.02 };
      case 'orbit': return { x: H.x, y: H.y + 0.01, z: H.z, az: 0.32, el: 0.95, lh: LN(0.034), lw: LN(p ? 0.032 : 0.05), fov: 30, lift: 0.0 };
      case 'pour': return { x: H.x, y: H.y + 0.03, z: H.z, az: 0.3, el: 0.42, lh: LN(0.052), lw: LN(p ? 0.042 : 0.056), fov: 30, lift: 0.0, breath: 0.4 };
      case 'medium': return { x: -0.02, y: 1.22, z: -0.2, az: 0.08, el: 0.14, lh: LN(0.46), lw: LN(p ? 0.4 : 0.72), fov: 32, lift: 0.06, breath: 0.6, fk: 0, hk: 0, oy: 0 };
      case 'reach': return { x: -0.05, y: 1.2, z: -0.22, az: -0.32, el: 0.18, lh: LN(0.37), lw: LN(p ? 0.3 : 0.5), fov: 32, lift: 0.05, breath: 0.5 };
      case 'bite': return { x: -0.05, y: 1.14, z: -0.2, az: -0.62, el: 0.05, lh: LN(0.12), lw: LN(p ? 0.12 : 0.16), fov: 30, lift: 0.0, fk: 1, oy: -0.025, breath: 0.35 };
      case 'delight': return { az: -0.22, el: 0.06, lh: LN(0.2), lw: LN(p ? 0.17 : 0.3), fov: 30, lift: 0.0, fk: 1, oy: -0.06, breath: 0.4 };
      case 'wide': return { x: 0, y: 1.32, z: -0.1, az: 0.2, el: 0.16, lh: LN(0.92), lw: LN(p ? 0.82 : 1.25), fov: 34, lift: 0.08, fk: 0, hk: 0, oy: 0, breath: 1 };
      case 'portal': return { x: SPOT.x, y: SPOT.y, z: SPOT.z, az: 0.25, el: 1.0, lh: LN(0.055), lw: LN(p ? 0.045 : 0.06), fov: 32, lift: 0.0, fk: 0, hk: 0, oy: 0, breath: 0.3 };
      case 'follow': return { az: 0.55, el: 0.3, lh: LN(0.16), lw: LN(0.16), fov: 34, lift: 0.0, hk: 1, breath: 0.3 };
      default: return {};
    }
  }
  const applyShot = (name) => Object.assign(cam, { fk: 0, hk: 0, oy: 0, breath: 0.5 }, shot(name));
  const moveTo = (name, duration, ease = 'sine.inOut', extra = {}) => tw(cam, { ...shot(name), duration, ease, ...extra });

  // ---------------------------------------------------------------- choreography helpers
  // (dev only: ?at=<beat>&hold=1.2 freezes the movement 1.2 s into that beat, for screenshots)
  // (waits and cues run on the tweens' clock, so a dev hold freezes everything and resumes exactly)
  const clock = {};
  const wait = (sec) => new Promise((res, rej) => {
    const sig = env.ctx?.signal;
    const abort = () => rej(new DOMException('Scene exited', 'AbortError'));
    if (sig?.aborted) { abort(); return; }
    sig?.addEventListener('abort', abort, { once: true });
    env.to(clock, { duration: sec, onComplete: () => { sig?.removeEventListener('abort', abort); res(); } });
  });
  const later = (sec, fn) => env.to(clock, { duration: sec, onComplete: fn });
  const tw = (target, vars) => env.to(target, { overwrite: 'auto', ...vars });
  const mouthApproach = (out) => {
    out.setFromMatrixPosition(fig.parts.mouth.matrixWorld);
    _v5.set(Math.sin(fig.group.rotation.y), 0, Math.cos(fig.group.rotation.y));
    return out.addScaledVector(_v5, 0.082).add(_v4.set(-0.006, -0.018, 0));
  };
  const reachTarget = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  let said = null;   // (the words begun in 'wide', still on screen as the portal begins)

  /** Put every knob where a beat begins (the dev jump; the reduced-motion cuts). */
  function snap(beat) {
    const i = Math.max(0, BEATS.indexOf(beat));
    const b = BEATS[i];
    const at = (name) => i >= BEATS.indexOf(name); // (this beat or a later one)
    const holding = b === 'bite';                  // (the puri in her hand, lifted)
    Object.assign(W, {
      key: 1, sky: 1, blur: i <= 1 || b === 'portal' ? 1 : 0.6, defocus: i <= 1 ? 0.55 : b === 'portal' ? 0.3 : 0.1, bokeh: 1, motes: 1, glints: 1, halos: 1, exposure: 1,
      pani: at('enter') ? 1 : 0, ladle: 0, tilt: 0, cup: 1, stream: 0, tail: 0,
      heroOn: at('delight') ? 0 : 1, carry: holding ? 1 : 0, bite: 0, tiltMouth: holding ? 0.35 : 0, lookHero: holding ? 1 : 0, puddle: at('bite') ? 1 : 0,
      fx: b === 'enter' ? ENTER_X : FIG_AT.x, yaw: b === 'enter' ? Math.PI / 2 : 0, shimmy: 0, spA: 0, spB: 0, spC: 0,
      drop: -1, ripple: 0, rippleA: 0, gold: 0, portal: 0, thread: 0, width: 0.05, head: 0,
    });
    TH.s0 = 0; TH.s1 = 0;
    for (let k = 0; k < NB; k++) { B.life[k] = 0; bits.setMatrixAt(k, ZERO); }
    const on = at('enter');
    fig.group.visible = on;
    if (on) {
      const leaning = b === 'reach' || holding;
      fig.group.position.set(W.fx, 0, FIG_AT.z);
      fig.group.rotation.y = W.yaw;
      fig.walk(0);
      fig.pose(leaning ? 'lean' : 'stand', leaning ? 0.8 : 1);
      fig.expression(b === 'delight' ? 'delight' : at('reach') ? 'smile' : 'neutral', 1);
      fig.blush(at('delight') ? 0.6 : at('reach') ? 0.25 : 0);
      fig.reach('L', at('reach') ? LEFT_REST : null, 1, 0.8);
      fig.hold('R', holding ? grip : null);
      if (holding) fig.reach('R', LIFT, 1, 1); else fig.reach('R', null, 0);
      if (b === 'reach') fig.lookAt(HERO_REST, 5);
      else if (b === 'wide') { const s = shot('wide'); camLook.set(s.x + Math.sin(s.az) * 4, s.y + 0.6, s.z + Math.cos(s.az) * 4); fig.lookAt(camLook, 3); }
      else if (b === 'portal') fig.lookAt(SPOT, 4);
      else fig.lookAt(null);
      fig.settle(0.8);
    }
    applyShot(SHOT_OF[i]);
    faceInit = headInit = false;
  }

  /** She waits just off-frame, readied (pose, gaze, hands) while the camera is close on the food: her
   *  hair comes to rest over those frames, so the entrance needs no burst of settling on screen. */
  function readyEntrance() {
    fig.group.visible = true;
    W.fx = ENTER_X; W.yaw = Math.PI / 2;
    fig.group.position.x = W.fx; fig.group.rotation.y = W.yaw;
    fig.pose('stand', 1); fig.expression('neutral'); fig.blush(0); fig.lookAt(null);
    fig.reach('L', null, 0); fig.reach('R', null, 0); fig.hold('R', null);
    fig.walk(0);
    fig.settle(0);   // (snaps the eased values: one update, no hair steps)
  }

  // ---------------------------------------------------------------- the beats
  const beats = {
    // from black: a low macro of the puri, the bulb's light raking across its crisp shell
    async macro(dir) {
      env.mood('festive');
      W.key = 0.25; W.halos = 0.4; W.bokeh = 0.5; W.motes = 0.3;
      dir.veil(0, { duration: 1.8, color: '#05040c' });
      tw(W, { key: 1, duration: 2.0, delay: 0.3, ease: 'sine.inOut' });
      tw(W, { halos: 1, bokeh: 1, motes: 1, duration: 2.4, delay: 0.2, ease: 'sine.inOut' });
      tw(W, { defocus: 0.45, duration: 2.6 });
      moveTo('macro2', 3.4, 'sine.inOut');
      later(1.3, () => env.sfx('shimmer', { volume: 0.5 }));
      await wait(2.6);
    },
    // a ladle tips a thin stream of pani in; it fills and glints (the camera rises over the opening)
    async pour() {
      readyEntrance();
      moveTo('pour', 1.8, 'sine.inOut');
      tw(W, { ladle: 1, duration: 1.15, ease: 'sine.inOut' });
      await wait(1.1);
      tw(W, { tilt: 1, duration: 0.45, ease: 'sine.inOut' });
      await wait(0.38);
      tw(W, { stream: 1, duration: 0.16, ease: 'power2.in' });
      env.sfx('splash');
      tw(W, { pani: 1, duration: 1.3, delay: 0.12, ease: 'sine.out' });
      tw(W, { cup: 0.35, duration: 1.4, ease: 'none' });
      const splashAt = _v5.set(HERO_REST.x, HERO_REST.y + 0.3 * PR, HERO_REST.z).clone();
      for (let k = 0; k < 4; k++) later(0.2 + k * 0.28, () => { splashAt.y = HERO_REST.y + lerp(0.12, 0.5, W.pani) * PR; emit(2, splashAt, 2, 0.32); });
      await wait(1.42);
      tw(W, { tail: 1, duration: 0.2, ease: 'power1.in' });
      tw(W, { tilt: 0, duration: 0.45, ease: 'sine.inOut' });
      await wait(0.4);
      W.stream = 0; W.tail = 0;
      tw(W, { ladle: 0, duration: 1.2, ease: 'sine.inOut' });
      await wait(0.25);
    },
    // pull back over the counter (the plate, the chutneys, the pot) as she walks in behind it,
    // stops, notices the plate
    async enter() {
      if (!fig.group.visible || W.fx !== ENTER_X) readyEntrance();   // (a dev jump straight here)
      moveTo('medium', 2.4, 'power2.inOut');
      tw(W, { defocus: 0.1, blur: 0.6, duration: 2.2 });
      later(0.9, () => { W.cup = 1; env.sfx('tap', { volume: 0.5 }); });   // (the ladle back in the pot)
      fig.walk(1, 0.6);
      tw(W, { fx: FIG_AT.x, duration: 2.1, delay: 0.1, ease: 'sine.out' });
      tw(W, { yaw: 0, duration: 0.8, delay: 1.5, ease: 'sine.inOut' });
      later(1.85, () => fig.walk(0));
      later(2.2, () => { fig.lookAt(HERO_REST, 5); fig.expression('surprise', 0.65); });
      later(2.6, () => { fig.expression('smile', 1); fig.blush(0.25); fig.reach('L', LEFT_REST, 1, 0.7); });
      await wait(3.0);
    },
    // she leans in, reaches, picks it up
    async reach() {
      moveTo('reach', 2.3, 'sine.inOut');
      fig.pose('lean', 0.8);
      reachTarget.copy(HERO_REST).add(_v1.set(0.002, GRIP - 0.003, 0.004));
      fig.reach('R', reachTarget, 1, 1.05);
      await wait(0.95);
      fig.hold('R', grip);
      tw(W, { carry: 1, duration: 0.32, ease: 'sine.inOut' });
      W.puddle = 1;
      env.sfx('plate', { volume: 0.6 });
      await wait(0.3);
      W.lookHero = 1;
      fig.reach('R', LIFT, 1, 0.85);
      tw(W, { tiltMouth: 0.35, duration: 0.8, ease: 'sine.inOut' });
      await wait(1.05);
    },
    // close: she eats it whole — crunch, a few crumbs and droplets
    async bite() {
      moveTo('bite', 1.3, 'power2.inOut');
      fig.reach('R', mouthApproach(reachTarget), 1, 0.95);
      tw(W, { tiltMouth: 0.7, duration: 0.9, ease: 'sine.inOut' });
      later(0.55, () => fig.expression('mouthOpen', 1));
      await wait(1.05);
      tw(W, { bite: 1, duration: 0.2, ease: 'power2.in' });
      await wait(0.2);
      W.heroOn = 0; W.lookHero = 0;
      env.sfx('crunch');
      _v1.setFromMatrixPosition(fig.parts.mouth.matrixWorld);
      _v1.z += 0.012; _v1.y -= 0.006;
      emit(0, _v1, [6, 9, 12][q], 0.28);
      emit(1, _v1, [3, 4, 6][q], 0.22);
      fig.expression('chew', 1);
      fig.blush(0.4);
      fig.hold('R', null);
      fig.reach('R', null, 0, 0.8);
      fig.lookAt(null);
      await wait(1.3);
    },
    // happy crescent eyes, a little shoulder wiggle, a tiny sparkle
    async delight() {
      fig.expression('delight', 1);
      fig.blush(0.7);
      moveTo('delight', 2.6, 'sine.inOut');
      if (!reduced) tw(W, { keyframes: [{ shimmy: 1, duration: 0.3 }, { shimmy: 1, duration: 0.7 }, { shimmy: 0, duration: 0.5 }], ease: 'sine.inOut' });
      later(0.35, () => env.sfx('sparkle'));
      tw(W, { spA: 1, duration: 0.9, delay: 0.3, ease: 'sine.inOut' });
      tw(W, { spB: 1, duration: 0.9, delay: 0.55, ease: 'sine.inOut' });
      tw(W, { spC: 1, duration: 0.9, delay: 0.8, ease: 'sine.inOut' });
      await wait(2.4);
    },
    // the whole stall at dusk; the words begin here and stay up over the portal's first moments
    // (the movement never ends before they are done)
    async wide() {
      moveTo('wide', 2.6, 'power2.inOut');
      tw(W, { blur: 0.5, defocus: 0.05, duration: 2.4 });
      const s = shot('wide');
      camLook.set(s.x + Math.sin(s.az) * 4, s.y + 0.6, s.z + Math.cos(s.az) * 4);
      later(1.0, () => fig.lookAt(camLook, 3));
      const lines = (env.T.panipuriLines || []).map((l) => env.fill(l)).filter(Boolean);
      await wait(0.7);
      // (a scene that exits mid-line rejects this; the beats' own waits carry the abort)
      said = lines.length ? env.narrate(lines, { style: 'hand', position: 'bottom' }).catch(() => {}) : null;
      await wait(2.5);
    },
    // a drop of pani falls; its ripple becomes a golden ring; the thread rises; warm veil
    async portal(dir) {
      if (!reduced) {
        moveTo('portal', 1.6, 'power2.inOut');
        tw(W, { blur: 1, defocus: 0.4, duration: 1.6 });
        fig.lookAt(SPOT, 4);
        await wait(1.15);
      }
      W.drop = 0.2;
      tw(W, { drop: 0, duration: 0.5, ease: 'power2.in' });
      await wait(0.5);
      W.drop = -1;
      env.sfx('tap', { volume: 0.7 });
      _v1.copy(SPOT); _v1.y += 0.002;
      emit(2, _v1, 5, 0.3);
      W.rippleA = 1;
      tw(W, { ripple: 0.62, duration: 0.9, ease: 'power1.out' });
      tw(W, { gold: 1, duration: 0.7, delay: 0.35, ease: 'sine.inOut' });
      tw(W, { portal: 1, duration: 0.9, delay: 0.6, ease: 'sine.inOut' });
      tw(W, { rippleA: 0, duration: 0.8, delay: 1.0 });
      later(0.6, () => env.sfx('shimmer'));
      later(0.5, () => { fig.expression('surprise', 0.6); });
      later(1.3, () => { fig.expression('delight', 1); });
      await wait(1.1);
      // the thread rises out of the ring; the camera follows it up and away
      W.head = 1; W.width = 0.045;
      tw(W, { thread: 1, duration: 0.4 });
      const T = reduced ? 2.2 : 2.9;
      tw(TH, { s1: path.length, duration: T, ease: 'power1.in' });
      tw(TH, { s0: path.length * 0.35, duration: T, delay: 0.5, ease: 'power1.in' });
      tw(W, { width: 0.4, duration: T, ease: 'power1.in' });
      later(0.2, () => env.sfx('whoosh'));
      if (!reduced) {
        tw(cam, { hk: 1, duration: 0.9, ease: 'sine.inOut' });
        tw(cam, { az: 0.55, el: 0.3, lh: LN(0.16), lw: LN(0.16), fov: 34, duration: 1.4, ease: 'sine.inOut' });
        tw(cam, { lh: LN(0.09), lw: LN(0.09), duration: 1.4, delay: 1.4, ease: 'power1.in' });
      }
      await wait(T - 0.85);
      if (said) await said;   // (only a long owner-written line is still up by now)
      said = null;
      tw(W, { exposure: 1.25, duration: 0.9 });
      await dir.veil(1, { duration: 0.9, color: WARM_VEIL });
    },
  };

  async function playReduced(dir, at) {
    // the same story in four gentle shots joined by soft veil cuts
    const i0 = Math.max(0, BEATS.indexOf(at));
    if (i0 <= BEATS.indexOf('pour')) {
      snap('macro');
      applyShot('orbit');   // (looking down into its opening)
      W.pani = 0; W.defocus = 0.45;
      env.mood('festive');
      await dir.veil(0, { duration: 1.0, color: '#05040c' });
      await wait(0.5);
      await beats.pour();
      await wait(0.6);
      await dir.veil(1, { duration: 0.5 });
    }
    if (i0 <= BEATS.indexOf('delight')) {
      snap('reach');
      fig.pose('stand', 1); fig.settle(0.3);
      fig.lookAt(HERO_REST, 5);
      await wait(0.2);
      await dir.veil(0, { duration: 0.6 });
      await wait(0.4);
      // the reach and the bite in one calm shot (no camera moves)
      fig.pose('lean', 0.8);
      reachTarget.copy(HERO_REST).add(_v1.set(0.002, GRIP - 0.003, 0.004));
      fig.reach('R', reachTarget, 1, 1.05);
      await wait(0.95);
      fig.hold('R', grip);
      tw(W, { carry: 1, duration: 0.32, ease: 'sine.inOut' });
      W.puddle = 1;
      env.sfx('plate', { volume: 0.6 });
      await wait(0.3);
      W.lookHero = 1;
      fig.reach('R', mouthApproach(reachTarget), 1, 0.85);
      tw(W, { tiltMouth: 0.7, duration: 1.0, ease: 'sine.inOut' });
      later(0.7, () => fig.expression('mouthOpen', 1));
      await wait(1.2);
      tw(W, { bite: 1, duration: 0.2, ease: 'power2.in' });
      await wait(0.2);
      W.heroOn = 0; W.lookHero = 0;
      env.sfx('crunch');
      _v1.setFromMatrixPosition(fig.parts.mouth.matrixWorld); _v1.z += 0.012;
      emit(0, _v1, 5, 0.22);
      fig.expression('chew', 1);
      fig.hold('R', null); fig.reach('R', null, 0, 0.8); fig.lookAt(null);
      await wait(1.0);
      fig.expression('delight', 1); fig.blush(0.7);
      env.sfx('sparkle');
      tw(W, { spA: 1, duration: 0.9, ease: 'sine.inOut' });
      tw(W, { spB: 1, duration: 0.9, delay: 0.25, ease: 'sine.inOut' });
      tw(W, { spC: 1, duration: 0.9, delay: 0.5, ease: 'sine.inOut' });
      await wait(1.6);
      await dir.veil(1, { duration: 0.5 });
    }
    if (i0 <= BEATS.indexOf('wide')) {
      snap('wide');
      fig.expression('smile', 1); fig.blush(0.5);
      await wait(0.2);
      await dir.veil(0, { duration: 0.6 });
      const lines = (env.T.panipuriLines || []).map((l) => env.fill(l)).filter(Boolean);
      if (lines.length) await env.narrate(lines, { style: 'hand', position: 'bottom' });
      else await wait(2.4);
      await dir.veil(1, { duration: 0.5 });
    }
    snap('portal');
    fig.expression('smile', 1);
    await wait(0.2);
    await dir.veil(0, { duration: 0.5 });
    await wait(0.3);
    await beats.portal(dir);
  }

  async function play(dir) {
    const params = dev ? new URLSearchParams(location.search) : null;
    const at = params ? params.get('at') : null;
    const i0 = at && BEATS.includes(at) ? BEATS.indexOf(at) : 0;
    if (dev) {
      api.dev.beat = BEATS[i0];
      // ?hold=1.2 → freeze 1.2 s into the beat; ?holds=1,4.5,9 → freeze at each (s from the start);
      // dev.resume() continues
      const list = (params.get('holds') || params.get('hold') || '').split(',').map(parseFloat).filter((x) => x >= 0);
      list.forEach((h) => later((i0 > 0 ? 0.35 : 0) + h, () => { env.gsap.globalTimeline.pause(); held = true; heldT = env.time; fresh = 3; api.dev.held = true; api.dev.holdAt = h; }));
      api.dev.resume = () => { held = false; api.dev.held = false; env.gsap.globalTimeline.resume(); };
      // a still of any beat's opening state, with overrides: dev.show('wide', { W: {…}, cam: {…} })
      api.dev.show = (beat, o = {}) => {
        env.gsap.globalTimeline.pause(); held = true; api.dev.held = true; heldT = env.time;
        snap(beat);
        Object.assign(W, o.W || {}); Object.assign(cam, o.cam || {});
        if (o.fig) o.fig(fig, api.dev);
        fresh = 3;
      };
      api.dev.snap = snap; api.dev.shot = shot;
    }
    api.restore();
    if (reduced) { await playReduced(dir, at); if (dev) api.dev.beat = 'done'; return; }
    snap(BEATS[i0]);
    if (i0 > 0) { env.mood('festive'); await dir.veil(0, { duration: 0.3 }); }
    for (let i = i0; i < BEATS.length; i++) {
      env.guard();
      if (dev) api.dev.beat = BEATS[i];
      await beats[BEATS[i]](dir);
    }
    if (dev) api.dev.beat = 'done';
  }

  function dispose() {
    strand.dispose();
    fig.dispose();
    envRT.dispose();
    for (const m of [shellsIM, fillIM, paniIM, heapIM, bowlsIM, stringIM, aoIM, bits]) m.dispose();
    key.shadow?.map?.dispose();
    for (const x of own) { try { x.dispose(); } catch (e) { /* ignore */ } }
    own.clear();
    scene.clear();
  }

  // ---------------------------------------------------------------- the warm-up pose
  // (everything visible, from a wide shot, so the shell's warm-up compiles and uploads it all)
  snap('wide');
  W.thread = 0.001; W.drop = 0.1; W.puddle = 1; W.rippleA = 0.001; W.stream = 0.5;
  fig.group.visible = true;
  update(1 / 60, 0);
  stream.visible = true; drop.visible = true; portal.visible = true; strand.mesh.visible = true;
  // …and the opening's state only when play() begins: the shell warms the movement up in THIS pose
  // (a wide shot with everything shown), so nothing is first drawn — and uploaded — mid-scene
  api.restore = () => { snap('macro'); fig.group.visible = false; update(0, 0); };
  return api;
}
