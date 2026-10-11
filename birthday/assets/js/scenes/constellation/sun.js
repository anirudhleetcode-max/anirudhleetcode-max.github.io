// The film's sun (core/art.js sunEmblem), drawn by the constellation's golden
// thread as one closed line: a ring, and around it the emblem's sixteen rays, a long
// straight ray and a wavy flame ray in turn. Her photographs settle in a circle on
// the ring and condense into stars just inside it, where the emblem has its dotted
// inner ring.
//
// Normalised to unit diameter (long-ray tip to tip), centred at the origin, y up.
// u ∈ [0, 1) is periodic and runs clockwise from the top: with `cells` = m, the long
// rays' tips are at u = i / m (the first one straight up) and the flames' tips at
// u = (i + ½) / m. Each half-cell (tip to tip) is parameterised by its own arc length,
// so a thread sampled at any multiple of `period` (2m) points lands exactly on every tip.

const TAU = Math.PI * 2;

// the emblem's rays, in its own units (ray foot at x = 46, y > 0 = clockwise side)
const LONG = { foot: 46, tip: 97, half: 7.5 };
const FLAME_IN = [[46, -5], [56, -11], [61, 4], [69, 1], [75, -1], [79, -3], [86, 0]]; // foot → tip (counter-clockwise side)
const FLAME_OUT = [[86, 0], [79, 4], [74, 7], [67, 7], [58, 8], [55, -2], [46, 5]]; // tip → foot (clockwise side)
const FLAME_LEN = 86 - 46;
const LONG_LEN = LONG.tip - LONG.foot;

/** Cubic Bézier chain [p0, c1, c2, p1, c1, c2, p2 …] → sampled points (end points included once). */
function bezierChain(pts, per) {
  const out = [];
  for (let s = 0; s + 3 < pts.length; s += 3) {
    const [a, b, c, d] = [pts[s], pts[s + 1], pts[s + 2], pts[s + 3]];
    for (let i = s ? 1 : 0; i <= per; i++) {
      const t = i / per;
      const k = 1 - t;
      out.push([
        k * k * k * a[0] + 3 * k * k * t * b[0] + 3 * k * t * t * c[0] + t * t * t * d[0],
        k * k * k * a[1] + 3 * k * k * t * b[1] + 3 * k * t * t * c[1] + t * t * t * d[1],
      ]);
    }
  }
  return out;
}

/**
 * createSun({ cells, ring, flame, width, detail }) → { at(u, out, flare), ring(u, out, scale), rays,
 *   radius, length, ringLength, height, period }
 * `cells`: long rays (8, as on the emblem); a flame ray sits between each two. `ring`: the ring's radius
 * (of the unit diameter). `flame`: a flame's length against a long ray's. `width`: the rays' width against
 * the emblem's proportions.
 */
export function createSun({ cells = 8, ring = 0.28, flame = 0.78, width = 1, detail = 64 } = {}) {
  const m = Math.max(1, Math.round(cells));
  const R = ring;
  const LL = 0.5 - R; // a long ray, foot to tip
  const LF = LL * flame; // a flame ray
  const step = TAU / m; // one cell, built from a flame tip (φ = 0) through a long tip (φ = step / 2) to the next flame tip
  const wk = width;

  // a ray point (a = out from the ring, b = clockwise offset) about the axis at angle φa → polar [r, φ]
  const polar = (phiA, a, b, foot) => {
    const r0 = Math.sqrt(Math.max(1e-6, R * R - foot * foot)); // so the feet lie exactly on the ring
    const x = r0 + a;
    return [Math.hypot(x, b), phiA + Math.atan2(b, x)];
  };
  const flameIn = bezierChain(FLAME_IN, Math.ceil(detail / 3));
  const flameOut = bezierChain(FLAME_OUT, Math.ceil(detail / 3));
  const fs = LF / FLAME_LEN;
  const fFoot = 5 * fs * wk;
  const flamePt = ([x, y], phiA) => polar(phiA, (x - 46) * fs, y * fs * wk, fFoot);
  const lHalf = (LONG.half / LONG_LEN) * LL * wk;
  const longPt = (k, side, phiA) => polar(phiA, LL * k, side * lHalf * (1 - k), lHalf);
  const arc = (p0, p1) => {
    const pts = [];
    const steps = Math.max(2, Math.ceil(Math.abs(p1 - p0) / (TAU / 720)));
    for (let i = 0; i <= steps; i++) pts.push([R, p0 + ((p1 - p0) * i) / steps]);
    return pts;
  };
  const lineN = Math.ceil(detail * 0.8);

  // half-cell A: flame tip (φ = 0) → its clockwise side → the ring → a long ray's counter-clockwise side → its tip (φ = step/2)
  const A = [];
  flameOut.forEach((p) => A.push(flamePt(p, 0)));
  const phiL = step / 2;
  const footL = Math.atan2(lHalf, Math.sqrt(R * R - lHalf * lHalf));
  arc(A[A.length - 1][1], phiL - footL).slice(1).forEach((p) => A.push(p));
  for (let i = 1; i <= lineN; i++) A.push(longPt(i / lineN, -1, phiL));
  // half-cell B: the long tip → its clockwise side → the ring → the next flame's counter-clockwise side → its tip (φ = step)
  const B = [];
  for (let i = lineN; i >= 0; i--) B.push(longPt(i / lineN, 1, phiL));
  const firstIn = flamePt(flameIn[0], step);
  arc(B[B.length - 1][1], firstIn[1]).slice(1).forEach((p) => B.push(p));
  flameIn.slice(1).forEach((p) => B.push(flamePt(p, step)));

  // arc length of each half, for an even pace along the line
  const measure = (pts) => {
    const cum = new Float64Array(pts.length);
    for (let i = 1; i < pts.length; i++) {
      const [r0, p0] = pts[i - 1];
      const [r1, p1] = pts[i];
      cum[i] = cum[i - 1] + Math.hypot(r1 * Math.sin(p1) - r0 * Math.sin(p0), r1 * Math.cos(p1) - r0 * Math.cos(p0));
    }
    return cum;
  };
  const halves = [{ pts: A, cum: measure(A) }, { pts: B, cum: measure(B) }];
  const total = m * (halves[0].cum[A.length - 1] + halves[1].cum[B.length - 1]);

  // each ray's two sides, as u ranges: { foot0 (counter-clockwise foot), tip, foot1 (clockwise foot), long }
  const lenA = halves[0].cum[A.length - 1];
  const lenB = halves[1].cum[B.length - 1];
  const fracA = (i) => halves[0].cum[i] / lenA;
  const fracB = (i) => halves[1].cum[i] / lenB;
  const hu = 1 / (2 * m); // one half-cell, in u
  const flameFootA = fracA(flameOut.length - 1); // where the clockwise side of a flame meets the ring (half A)
  const longFootA = fracA(A.length - 1 - lineN); // where a long ray's counter-clockwise side leaves it (half A)
  const longFootB = fracB(lineN); // …its clockwise side returns to it (half B)
  const flameFootB = fracB(B.length - flameIn.length); // …and the next flame leaves it (half B)
  const rays = [];
  for (let j = 0; j < m; j++) {
    rays.push({ long: true, tip: j / m, foot0: j / m - (1 - longFootA) * hu, foot1: j / m + longFootB * hu });
    const tf = (j + 0.5) / m;
    rays.push({ long: false, tip: tf, foot0: tf - (1 - flameFootB) * hu, foot1: tf + flameFootA * hu });
  }

  /** The point of the sun at u (periodic). `flare` lengthens every ray by that fraction (the ring stays). */
  function at(u, out = { x: 0, y: 0 }, flare = 0) {
    const v = u + 0.5 / m; // (the cells are built from a flame tip; u = 0 is a long tip)
    const f = (v - Math.floor(v)) * 2 * m;
    const h = Math.min(2 * m - 1, Math.floor(f));
    const half = halves[h & 1];
    const { pts, cum } = half;
    const L = (f - h) * cum[pts.length - 1];
    let lo = 0;
    let hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= L) lo = mid; else hi = mid;
    }
    const seg = cum[hi] - cum[lo] || 1;
    const k = (L - cum[lo]) / seg;
    let r = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * k;
    const phi = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * k + ((h >> 1) - 0.5) * step;
    if (flare && r > R) r = R + (r - R) * (1 + flare);
    out.x = r * Math.sin(phi);
    out.y = r * Math.cos(phi);
    return out;
  }
  /** The ring's point at the angle of u, optionally scaled (the photographs settle on it, their stars a little inside). */
  function ringAt(u, out = { x: 0, y: 0 }, scale = 1) {
    const phi = u * TAU;
    out.x = R * scale * Math.sin(phi);
    out.y = R * scale * Math.cos(phi);
    return out;
  }
  return { at, ring: ringAt, rays, radius: R, length: total, ringLength: TAU * R, height: 1, period: 2 * m };
}

const dist = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)));
// Barry–Goldman pyramid for one coordinate (knots 0, t1, t2, t3)
function cr(a, b, c, d, t1, t2, t3, t) {
  const a1 = a + (b - a) * (t / t1);
  const a2 = b + (c - b) * ((t - t1) / (t2 - t1));
  const a3 = c + (d - c) * ((t - t2) / (t3 - t2));
  const b1 = a1 + (a2 - a1) * (t / t2);
  const b2 = a2 + (a3 - a2) * ((t - t1) / (t3 - t1));
  return b1 + (b2 - b1) * ((t - t1) / (t2 - t1));
}

/**
 * Periodic centripetal Catmull-Rom interpolation of values v[k] placed at u = (k + 0.5) / n (u periodic).
 * Centripetal (α = ½) never overshoots into little loops when neighbours are unevenly spaced.
 */
export function periodicInterp(values, u, out) {
  const n = values.length;
  if (!n) return out;
  if (n === 1) return out.copy(values[0]);
  const f = (u - Math.floor(u)) * n - 0.5;
  const i1 = Math.floor(f);
  const s = f - i1;
  const idx = (i) => ((i % n) + n) % n;
  const p0 = values[idx(i1 - 1)];
  const p1 = values[idx(i1)];
  const p2 = values[idx(i1 + 1)];
  const p3 = values[idx(i1 + 2)];
  const t1 = dist(p0, p1);
  const t2 = t1 + dist(p1, p2);
  const t3 = t2 + dist(p2, p3);
  const t = t1 + (t2 - t1) * s;
  out.set(cr(p0.x, p1.x, p2.x, p3.x, t1, t2, t3, t), cr(p0.y, p1.y, p2.y, p3.y, t1, t2, t3, t), cr(p0.z, p1.z, p2.z, p3.z, t1, t2, t3, t));
  return out;
}
