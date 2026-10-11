// "The Little Things", movement 1 — KEYCHAINS (her cute side).
//
// A miniature world of cute keychains hanging from the golden thread in warm haze: four brass
// split rings (a two-turn helix wire), each with a jump ring and a short gold chain to its charms —
// a puffy enamel star, a sleepy cloud, a mochi blob, the film's lantern (plum paper, gold frame, a
// warm glow inside), a clear sun coin with the film's gold sun, an enamel watermelon slice, a clear
// '20' tag with a gold edge, and the hero: a tiny clear-green soda bottle with bubbles inside.
// Every charm is procedural geometry with its own material (clearcoat enamel, plush sheen, glass and
// acrylic that transmit on the high tier), hung as a damped two-axis pendulum with a yaw spring,
// integrated with real dt in fixed substeps (position-based, so a moving pivot drives it naturally).
//
// Beats (≈33 s; reduced motion ≈19 s with veil cuts):
//   K1 darkness → a keyring turns into view in extreme close-up; light catches its coils (jingle)
//   K2 macro push down the chain; the foreground bokeh melts away; focus lands on the lantern
//   K3 the golden thread enters and passes through the ring; the keychain starts to swing
//   K4 pull back + controlled orbit: the whole collection along the thread, at different depths
//   K5 the words (env.T.keychainLines, handwriting) over the reveal
//   K6 the thread draws the hero charm (the soda bottle) forward; it turns to camera; a warm glow
//   K7 the thread shoots away from it into the dark, the camera follows; veil to black → sprite
// Dev: window.__LITTLE_DEV__ + ?at=k1..k7 starts at that beat.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStrand, PathSampler, createRig, rng, TAU, clamp, lerp, damp } from './kit.js';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const ONE = new THREE.Vector3(1, 1, 1);
const GRAV = 6.0;        // this miniature world's gravity (units/s²): unhurried, toy-like swings
const STEP = 1 / 120;    // physics substep (s)
const BEATS = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7'];
const GOLD = 0xf0c060;

// per-frame scratch: update() allocates nothing
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _d = new THREE.Vector3();
const _h0 = new THREE.Vector3(), _h1 = new THREE.Vector3(), _h2 = new THREE.Vector3(), _h3 = new THREE.Vector3();
const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3(), _s3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// ------------------------------------------------------------------ canvas helpers
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d') }; }

let SUN = null;
/** The film's sun (core/art.js sunEmblem): 8 long rays, 8 flame rays, a ring, a dotted inner ring. */
function paintSun(g, x, y, radius, { fill = '#fff', line = '#8a8a8a', center = '#fff' } = {}) {
  const P = SUN || (SUN = {
    long: new Path2D('M46 -7.5 L97 0 L46 7.5 Z'),
    flame: new Path2D('M46 -5 C56 -11 61 4 69 1 C75 -1 79 -3 86 0 C79 4 74 7 67 7 C58 8 55 -2 46 5 Z'),
    inner: new Path2D('M14 -4 L30 0 L14 4 Z'),
  });
  g.save();
  g.translate(x, y); g.scale(radius / 100, radius / 100);
  g.fillStyle = fill;
  for (let i = 0; i < 16; i++) { g.save(); g.rotate((i * TAU) / 16); g.fill(i % 2 ? P.flame : P.long); g.restore(); }
  g.strokeStyle = fill; g.lineWidth = 3.5;
  g.beginPath(); g.arc(0, 0, 42, 0, TAU); g.stroke();
  g.beginPath(); g.arc(0, 0, 36, 0, TAU); g.fill();
  g.strokeStyle = line; g.lineWidth = 2; g.setLineDash([2.5, 3.5]);
  g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.stroke(); g.setLineDash([]);
  g.fillStyle = line;
  for (let i = 0; i < 8; i++) { g.save(); g.rotate(((i * 45 + 22.5) * Math.PI) / 180); g.fill(P.inner); g.restore(); }
  g.fillStyle = center; g.strokeStyle = line; g.lineWidth = 1.6;
  g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill(); g.stroke();
  g.restore();
}

/** A tiny four-point sparkle (printed on the '20' tag). */
function paintSparkle(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}

/**
 * The colour + face texture of a puffy charm: left half = front (with the face), right half = back.
 * A charm point (x, y) maps to canvas px (128 + x·S, 128 − y·S) on the front, S = 128 / E.
 */
function faceCanvas({ E, base, hi, edge, face }) {
  const { c, g } = cnv(512, 256);
  for (let half = 0; half < 2; half++) {
    const cx = half ? 384 : 128;
    const gr = g.createRadialGradient(cx - 18, 104, 6, cx, 128, 170);
    gr.addColorStop(0, hi); gr.addColorStop(0.5, base); gr.addColorStop(1, edge);
    g.fillStyle = gr; g.fillRect(half * 256, 0, 256, 256);
  }
  const S = 128 / E;
  if (face) face(g, (x) => 128 + x * S, (y) => 128 - y * S, S);
  return c;
}
const INK = '#3a2147';
function dotEyes(g, X, Y, S, x, y, r) {
  for (const sx of [-1, 1]) {
    g.fillStyle = INK;
    g.beginPath(); g.ellipse(X(sx * x), Y(y), r * S, r * S * 1.18, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath(); g.arc(X(sx * x) - r * S * 0.32, Y(y) - r * S * 0.38, r * S * 0.34, 0, TAU); g.fill();
  }
}
function sleepyEyes(g, X, Y, S, x, y, w) {
  g.strokeStyle = INK; g.lineCap = 'round'; g.lineWidth = Math.max(2, w * S * 0.28);
  for (const sx of [-1, 1]) { g.beginPath(); g.arc(X(sx * x), Y(y) - w * S * 0.35, w * S * 0.6, 0.18 * Math.PI, 0.82 * Math.PI); g.stroke(); }
}
function cheeks(g, X, Y, S, x, y, r, col = '255,143,184') {
  for (const sx of [-1, 1]) {
    const gr = g.createRadialGradient(X(sx * x), Y(y), 0, X(sx * x), Y(y), r * S);
    gr.addColorStop(0, `rgba(${col},0.75)`); gr.addColorStop(0.6, `rgba(${col},0.4)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(X(sx * x), Y(y), r * S, 0, TAU); g.fill();
  }
}
function smile(g, X, Y, S, y, w) {
  g.strokeStyle = INK; g.lineCap = 'round'; g.lineWidth = Math.max(2, w * S * 0.22);
  g.beginPath(); g.arc(X(0), Y(y) - w * S * 0.5, w * S * 0.62, 0.22 * Math.PI, 0.78 * Math.PI); g.stroke();
}
function catMouth(g, X, Y, S, y, w) {
  g.strokeStyle = INK; g.lineCap = 'round'; g.lineWidth = Math.max(2, w * S * 0.2);
  for (const sx of [-1, 1]) { g.beginPath(); g.arc(X(sx * w * 0.5), Y(y) - w * S * 0.25, w * S * 0.5, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); }
}

// ------------------------------------------------------------------ geometry helpers
/** r(φ) sampled into a table and smoothed (soft creases), linearly interpolated. */
function polarTable(fn, n = 720, blur = 0) {
  let a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = fn((i / n) * TAU);
  for (let p = 0; p < blur; p++) {
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) b[i] = (a[(i - 1 + n) % n] + 2 * a[i] + a[(i + 1) % n]) * 0.25;
    a = b;
  }
  return (phi) => {
    let f = ((((phi / TAU) % 1) + 1) % 1) * n;
    const i = Math.floor(f) % n;
    f -= Math.floor(f);
    return a[i] + (a[(i + 1) % n] - a[i]) * f;
  };
}

/**
 * An inflated ("puffy") charm: a star-shaped outline r(φ) blown up into a soft pillow with a
 * superellipse cross-section. Analytic-ish normals (finite differences of the surface), planar UVs
 * (front → left half of the texture, back → right half).
 */
function puffyGeometry(rOf, { h, E, segU = 128, segV = 24, n = 2.4, thick = null, deform = null }) {
  const e = 2 / n;
  const surf = (u, v, out) => {
    const phi = u * TAU, al = v * Math.PI;
    const s = Math.sin(al), c = Math.cos(al);
    const t = Math.pow(Math.abs(s), e);
    const zf = Math.sign(c) * Math.pow(Math.abs(c), e);
    const r = rOf(phi);
    // (thickness may vary with the outline, faded in from the centre so the middle stays round)
    out.set(Math.cos(phi) * r * t, Math.sin(phi) * r * t, h * zf * (thick ? 1 + (thick(r) - 1) * t * t : 1));
    if (deform) deform(out);
    return out;
  };
  const half = Math.max(2, segV >> 1);
  const pos = [], nor = [], uvs = [], idx = [];
  const P = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), D = new THREE.Vector3(), N = new THREE.Vector3();
  const eps = 1e-4;
  for (let side = 0; side < 2; side++) {
    const base = pos.length / 3;
    for (let j = 0; j <= half; j++) {
      const v = side ? 0.5 + (j / half) * 0.5 : (j / half) * 0.5;
      const vv = clamp(v, 2e-3, 1 - 2e-3);
      for (let i = 0; i <= segU; i++) {
        const u = i / segU;
        surf(u, v, P);
        surf(u + eps, vv, A); surf(u - eps, vv, B); A.sub(B);
        surf(u, Math.min(1, vv + eps), C); surf(u, Math.max(0, vv - eps), D); C.sub(D);
        N.crossVectors(A, C);
        if (N.lengthSq() < 1e-24) N.set(0, 0, v < 0.5 ? 1 : -1);
        N.normalize();
        if (N.x * P.x + N.y * P.y + N.z * P.z < 0) N.negate();
        pos.push(P.x, P.y, P.z); nor.push(N.x, N.y, N.z);
        uvs.push(side ? 0.75 - P.x / (4 * E) : 0.25 + P.x / (4 * E), 0.5 + P.y / (2 * E));
      }
    }
    // winding: make the faces front-facing outward
    const ja = half >> 1, ia = segU >> 3;
    const a0 = base + ja * (segU + 1) + ia, b0 = a0 + segU + 1;
    const pa = new THREE.Vector3().fromArray(pos, a0 * 3), pb = new THREE.Vector3().fromArray(pos, b0 * 3), pc = new THREE.Vector3().fromArray(pos, (a0 + 1) * 3);
    const fn = new THREE.Vector3().crossVectors(pb.sub(pa), pc.sub(pa));
    const flip = fn.dot(new THREE.Vector3().fromArray(nor, a0 * 3)) < 0;
    for (let j = 0; j < half; j++) {
      for (let i = 0; i < segU; i++) {
        const a = base + j * (segU + 1) + i, b = a + segU + 1;
        if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1);
        else idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

/** Planar (x, y) UVs for extrusions: walls and bevels take the colour of the outline they sit on. */
function planarUV(cx, cy, E) {
  const uv = (x, y) => new THREE.Vector2(0.5 + (x - cx) / (2 * E), 0.5 + (y - cy) / (2 * E));
  return {
    generateTopUV(geometry, v, a, b, c) { return [uv(v[a * 3], v[a * 3 + 1]), uv(v[b * 3], v[b * 3 + 1]), uv(v[c * 3], v[c * 3 + 1])]; },
    generateSideWallUV(geometry, v, a, b, c, d) { return [uv(v[a * 3], v[a * 3 + 1]), uv(v[b * 3], v[b * 3 + 1]), uv(v[c * 3], v[c * 3 + 1]), uv(v[d * 3], v[d * 3 + 1])]; },
  };
}

/** A lathe from a smooth profile resampled evenly by arc length (so v ∝ length along it). */
function smoothLathe(points, { samples = 48, segs = 40, tension = 0.5 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal', tension);
  const pts = curve.getSpacedPoints(samples).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  return new THREE.LatheGeometry(pts, segs);
}

/** The split ring: a two-turn helix of round wire, tapered to rounded ends, the outer end sprung. */
class HelixCurve extends THREE.Curve {
  constructor(R, pitch, turns) { super(); this.R = R; this.pitch = pitch; this.turns = turns; }
  getPoint(t, out = new THREE.Vector3()) {
    const th = Math.PI / 2 + 0.55 + t * this.turns * TAU;
    const lift = 1 - Math.min(1, (1 - t) / 0.07);      // the outer end springs away a hair
    const z = (t * this.turns - this.turns / 2) * this.pitch + lift * lift * this.pitch * 0.35;
    return out.set(Math.cos(th) * this.R, Math.sin(th) * this.R, z);
  }
}
function splitRingGeometry({ R, r, pitch, turns = 1.9, segs = 220, radial = 12 }) {
  const curve = new HelixCurve(R, pitch, turns);
  const geo = new THREE.TubeGeometry(curve, segs, r, radial, false);
  // rounded, slightly pointed ends (no open tube mouths at macro distance)
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal');
  const len = curve.getLength(), cap = r * 1.4;
  const C = new THREE.Vector3(), T = new THREE.Vector3(), O = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, e = Math.min(t, 1 - t) * len;
    if (e >= cap) continue;
    curve.getPointAt(t, C); curve.getTangentAt(t, T);
    if (t < 0.5) T.negate();
    const k = 1 - e / cap, f = Math.sqrt(Math.max(0, 1 - k * k));
    for (let j = 0; j <= radial; j++) {
      const vi = i * (radial + 1) + j;
      O.fromBufferAttribute(pos, vi).sub(C);
      const rr = O.length() || 1;
      O.divideScalar(rr);
      pos.setXYZ(vi, C.x + O.x * r * f, C.y + O.y * r * f, C.z + O.z * r * f);
      N.copy(O).multiplyScalar(f).addScaledVector(T, k).normalize();
      nor.setXYZ(vi, N.x, N.y, N.z);
    }
  }
  pos.needsUpdate = nor.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
}

// ------------------------------------------------------------------ the pendulum
/**
 * A damped spherical pendulum (position-based: a moving pivot drags it naturally) + a yaw spring.
 * The damping acts on the swing relative to the pivot (a joint damper, not air drag), so a charm
 * carried along by the thread follows it without trailing, and only its swing dies away.
 */
class Pend {
  constructor(L, c = 1) {
    this.L = L; this.c = c;
    this.pivot = new THREE.Vector3(); this.from = new THREE.Vector3(); this.to = new THREE.Vector3();
    this.pp = new THREE.Vector3(); this.pvel = new THREE.Vector3();
    this.bob = new THREE.Vector3(); this.prev = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.dir = new THREE.Vector3(0, -1, 0);
    this.q = new THREE.Quaternion();
    this.base = 0; this.yaw = 0; this.yawV = 0; this.yawT = 0; this.yawK = 3; this.yawC = 1.4;
    this.r = 0.2; this.wind = 1; this.ph = 0;
  }
  place(p) {
    this.pivot.copy(p); this.from.copy(p); this.to.copy(p); this.pp.copy(p); this.pvel.set(0, 0, 0);
    this.bob.set(p.x, p.y - this.L, p.z); this.prev.copy(this.bob); this.vel.set(0, 0, 0); this.dir.set(0, -1, 0);
    this.yaw = this.yawT; this.yawV = 0;
  }
  /** Call after moving the pivot for this substep: its velocity feeds the joint damper. */
  track(h) { this.pvel.subVectors(this.pivot, this.pp).divideScalar(h); this.pp.copy(this.pivot); }
  predict(h, ax, az) {
    const v = this.vel, pv = this.pvel;
    v.x += ax * h; v.y -= GRAV * h; v.z += az * h;
    const k = Math.exp(-this.c * h);
    v.set(pv.x + (v.x - pv.x) * k, pv.y + (v.y - pv.y) * k, pv.z + (v.z - pv.z) * k);
    this.prev.copy(this.bob);
    this.bob.addScaledVector(v, h);
    this.yawV += (-(this.yaw - this.yawT) * this.yawK - this.yawV * this.yawC) * h;
    this.yaw += this.yawV * h;
  }
  constrain() {
    _d.subVectors(this.bob, this.pivot);
    const l = _d.length() || 1e-6;
    this.bob.copy(this.pivot).addScaledVector(_d, this.L / l);
  }
  finish(h) {
    this.vel.subVectors(this.bob, this.prev).divideScalar(h);
    this.dir.subVectors(this.bob, this.pivot).normalize();
    _q1.setFromUnitVectors(DOWN, this.dir);
    _q2.setFromAxisAngle(UP, this.base + this.yaw);
    this.q.copy(_q1).multiply(_q2);
  }
}

/** The closest points (c1 on p1–q1, c2 on p2–q2) of two segments (Ericson, Real-Time Collision Detection 5.1.9). */
function closestOnSegments(p1, q1, p2, q2, c1, c2) {
  _s1.subVectors(q1, p1); _s2.subVectors(q2, p2); _s3.subVectors(p1, p2);
  const a = _s1.dot(_s1), e = _s2.dot(_s2), f = _s2.dot(_s3);
  let s = 0, t = 0;
  if (a <= 1e-9 && e <= 1e-9) { s = t = 0; }
  else if (a <= 1e-9) { t = clamp(f / e, 0, 1); }
  else {
    const c = _s1.dot(_s3);
    if (e <= 1e-9) { s = clamp(-c / a, 0, 1); }
    else {
      const b = _s1.dot(_s2), den = a * e - b * b;
      s = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  c1.copy(p1).addScaledVector(_s1, s); c2.copy(p2).addScaledVector(_s2, t);
}

/** The thread's path, morphing from its resting arc (A) to the arc that draws the hero forward (B). */
class ThreadPath {
  constructor(A, B, ancA, ancB) {
    Object.assign(this, { A, B, ancA, ancB, k: 0, length: A.length });
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._t = new THREE.Vector3();
  }
  mapB(s) {
    const a = this.ancA, b = this.ancB;
    let i = 0;
    while (i < a.length - 2 && s > a[i + 1]) i++;
    return b[i] + (b[i + 1] - b[i]) * ((s - a[i]) / (a[i + 1] - a[i]));
  }
  at(s, out) {
    this.A.at(s, this._a);
    if (this.k <= 0) return out.copy(this._a);
    this.B.at(this.mapB(s), this._b);
    return out.lerpVectors(this._a, this._b, this.k);
  }
  tangent(s, out) {
    this.at(s + 0.02, out);
    this.at(s - 0.02, this._t);
    return out.sub(this._t).normalize();
  }
}

// ------------------------------------------------------------------ shaders
const SPARK_VERT = /* glsl */`
  attribute vec3 aPos; attribute vec4 aCol; attribute vec3 aMisc;
  varying vec2 vUv; varying vec4 vCol; varying float vKind;
  void main(){
    vUv = uv - 0.5; vCol = aCol; vKind = aMisc.y;
    vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
    // a glint (kind 1) or an overlay glow (kind 2) sits in front of its surface, never inside it
    float pull = (aMisc.y > 0.5) ? 0.3 : 0.0;
    mv.xyz += normalize(-mv.xyz) * aMisc.x * pull;
    float c = cos(aMisc.z), s = sin(aMisc.z);
    vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
    mv.xy += q * aMisc.x * step(0.0005, aCol.a);
    gl_Position = projectionMatrix * mv;
  }`;
const SPARK_FRAG = /* glsl */`
  varying vec2 vUv; varying vec4 vCol; varying float vKind;
  void main(){
    float d = length(vUv) * 2.0;
    float a;
    if (vKind > 0.5 && vKind < 1.5) {
      vec2 p = abs(vUv) * 2.0;
      float rays = exp(-p.x * 34.0) * exp(-p.y * 3.2) + exp(-p.y * 34.0) * exp(-p.x * 3.2);
      vec2 r = abs(vec2(vUv.x + vUv.y, vUv.x - vUv.y)) * 1.414;
      rays += 0.35 * (exp(-r.x * 40.0) * exp(-r.y * 7.0) + exp(-r.y * 40.0) * exp(-r.x * 7.0));
      a = exp(-d * d * 30.0) * 1.6 + exp(-d * d * 6.0) * 0.25 + rays;
    } else {
      a = exp(-d * d * 4.5) * 0.85 + exp(-d * d * 22.0) * 0.6;
    }
    a *= 1.0 - smoothstep(0.85, 1.0, d);
    gl_FragColor = vec4(vCol.rgb * vCol.a * a, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const BOKEH_VERT = /* glsl */`
  attribute vec3 aPos; attribute vec4 aCol; attribute vec3 aMisc;
  uniform float uTime; uniform float uFront;
  varying vec2 vUv; varying vec4 vCol; varying float vA;
  void main(){
    vUv = uv - 0.5; vCol = aCol;
    float seed = aMisc.y;
    bool front = aMisc.z > 0.5;
    vec3 p = aPos;
    p.x += sin(uTime * 0.11 + seed * 31.0) * (front ? 0.02 : 0.25);
    p.y += cos(uTime * 0.09 + seed * 17.0) * (front ? 0.02 : 0.2);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = aMisc.x * (front ? 1.0 + (1.0 - uFront) * 1.6 : 1.0);
    mv.xy += position.xy * size;
    vA = (front ? uFront : 1.0) * (0.78 + 0.22 * sin(uTime * (0.4 + seed) + seed * 40.0));
    gl_Position = projectionMatrix * mv;
  }`;
const BOKEH_FRAG = /* glsl */`
  uniform float uBright;
  varying vec2 vUv; varying vec4 vCol; varying float vA;
  void main(){
    float d = length(vUv) * 2.0;
    float disc = 1.0 - smoothstep(0.78, 1.0, d);
    float rim = smoothstep(0.62, 0.9, d) * disc * 0.35;
    float a = disc * 0.5 + rim + exp(-d * d * 3.0) * 0.12;
    gl_FragColor = vec4(vCol.rgb * a * vCol.a * vA * uBright, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const DUST_VERT = /* glsl */`
  attribute vec3 aPos; attribute vec3 aMisc;
  uniform float uTime; uniform float uBright;
  varying vec2 vUv; varying float vA;
  void main(){
    vUv = uv - 0.5;
    float s = aMisc.y;
    float w = mod(uTime * aMisc.z + s * 13.0, 4.0);
    vec3 p = aPos;
    p.y += w - 2.0;
    p.x += sin(uTime * 0.21 + s * 40.0) * 0.18;
    p.z += cos(uTime * 0.17 + s * 27.0) * 0.18;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    float near = smoothstep(2.2, 0.5, depth);
    mv.xy += position.xy * aMisc.x * (1.0 + near * 3.0);
    float k = w / 4.0;
    vA = smoothstep(0.0, 0.15, k) * smoothstep(1.0, 0.85, k) * smoothstep(0.12, 0.45, depth)
       * (0.55 + 0.45 * sin(uTime * (0.8 + s) + s * 50.0)) * mix(1.0, 0.3, near) * uBright;
    gl_Position = projectionMatrix * mv;
  }`;
const DUST_FRAG = /* glsl */`
  varying vec2 vUv; varying float vA;
  void main(){
    float d = length(vUv) * 2.0;
    float a = exp(-d * d * 5.0) * (1.0 - smoothstep(0.8, 1.0, d));
    gl_FragColor = vec4(vec3(1.0, 0.76, 0.46) * a * vA, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = /* glsl */`
  uniform float uHaze; uniform vec3 uHazeDir;
  varying vec3 vDir;
  void main(){
    vec3 d = normalize(vDir);
    float y = d.y;
    vec3 top = vec3(0.0026, 0.0014, 0.0058);
    vec3 mid = vec3(0.0105, 0.0042, 0.021);
    vec3 col = mix(mid, top, smoothstep(-0.1, 0.75, y));
    col = mix(col, vec3(0.0016, 0.001, 0.0026), smoothstep(-0.05, -0.6, y));
    float h = max(0.0, dot(d, uHazeDir));
    col += vec3(0.05, 0.022, 0.009) * pow(h, 6.0) * uHaze;
    col += vec3(0.016, 0.007, 0.014) * pow(h, 1.6) * uHaze;
    col *= 0.35 + 0.65 * uHaze;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** One instanced billboard draw (quad per instance) with the given per-instance attributes. */
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
  const envMap = env.envWarm;
  const R = rng(20);
  const own = new Set();
  const keep = (x) => { own.add(x); return x; };
  const tex = (c, { srgb = true } = {}) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return keep(t);
  };
  const PHYS_ONLY = ['clearcoat', 'clearcoatRoughness', 'sheen', 'sheenColor', 'sheenRoughness', 'transmission', 'thickness', 'ior', 'attenuationColor', 'attenuationDistance', 'specularIntensity'];
  const phys = (o) => {
    if (q >= 1) return keep(new THREE.MeshPhysicalMaterial({ envMap, ...o }));
    const p = { envMap, ...o };
    PHYS_ONLY.forEach((k) => delete p[k]);
    return keep(new THREE.MeshStandardMaterial(p));
  };
  const geo = (g) => keep(g);
  const shadows = !!tier.shadows;
  const segU = [72, 96, 120][q], segV = [14, 18, 22][q];

  // ---------------------------------------------------------------- world
  const scene = new THREE.Scene();
  // the haze: thick while the first keyring turns in the dark (only it shows), lifting for the reveal
  scene.fog = new THREE.Fog(0x0e0818, 9, 34);
  const fogDark = new THREE.Color(0x0d0717), fogWarm = new THREE.Color(0x1a0d24);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.02, 160);
  const rig = createRig(camera, { breath: 0.6 });

  const sky = new THREE.Mesh(geo(new THREE.SphereGeometry(90, 24, 12)), keep(new THREE.ShaderMaterial({
    uniforms: { uHaze: { value: 0.15 }, uHazeDir: { value: new THREE.Vector3(0.18, 0.1, -1).normalize() } },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
  })));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  // materials shared across the collection
  const gold = keep(new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.17, envMap, envMapIntensity: 1.25 }));
  const brass = keep(new THREE.MeshStandardMaterial({ color: 0xe8b25a, metalness: 1, roughness: 0.14, envMap, envMapIntensity: 1.35 }));
  const silver = keep(new THREE.MeshStandardMaterial({ color: 0xf0f2f7, metalness: 1, roughness: 0.3, envMap, envMapIntensity: 1.8 }));
  const clearMat = (o = {}) => (q === 2
    ? keep(new THREE.MeshPhysicalMaterial({ envMap, color: 0xffffff, transmission: 1, thickness: 0.05, roughness: 0.06, ior: 1.49, specularIntensity: 1, envMapIntensity: 1.3, ...o }))
    // (no transmission below the high tier: a pale, faintly lit clear plastic instead)
    : phys({ color: 0xffffff, emissive: new THREE.Color('#6a5878'), emissiveIntensity: 0.35, transparent: true, opacity: 0.2, depthWrite: false, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.2 }));

  // ---------------------------------------------------------------- the charms
  const charmDefs = [];

  // 1 · puffy star — glossy yellow enamel with a face
  function makeStar() {
    // a five-point star polygon (inner radius ½), its tips and valleys rounded by blurring r(φ)
    const Ro = 0.3, ri = 0.5;
    const p0x = Ro, p1x = ri * Ro * Math.cos(Math.PI / 5), p1y = ri * Ro * Math.sin(Math.PI / 5);
    const rOf = polarTable((phi) => {
      let a = ((((phi - Math.PI / 2) % (TAU / 5)) + TAU / 5) % (TAU / 5));
      if (a > TAU / 10) a = TAU / 5 - a;
      const dx = p1x - p0x, dy = p1y;
      return (p0x * dy) / (Math.cos(a) * dy - Math.sin(a) * dx);
    }, 720, 150);
    const g = geo(puffyGeometry(rOf, { h: 0.08, E: 0.3, segU: segU + 24, segV, n: 2.3, thick: (r) => 0.72 + 0.28 * ((Ro * ri) / r) }));
    const map = tex(faceCanvas({
      E: 0.3, base: '#ffc93c', hi: '#ffe48a', edge: '#f0a417',
      face: (g2, X, Y, S) => { cheeks(g2, X, Y, S, 0.1, -0.03, 0.03); dotEyes(g2, X, Y, S, 0.052, 0.012, 0.016); smile(g2, X, Y, S, -0.022, 0.03); },
    }));
    const mat = phys({ map, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.85 });
    const body = new THREE.Group();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = shadows;
    body.add(m);
    return { body, hangY: Ro - 0.04, centerY: 0, r: 0.21, links: 1, wind: 1.2,
      anchors: [{ p: [0.19, 0.06, 0.07], n: [0.45, 0.35, 0.82], size: 0.11, sharp: 60 }] };
  }

  // 2 · sleepy cloud — soft white with a lavender plush sheen
  function makeCloud() {
    const circ = [[0, 0.02, 0.15], [-0.15, -0.03, 0.11], [0.16, -0.025, 0.115], [-0.07, 0.09, 0.11], [0.075, 0.1, 0.12], [-0.245, -0.06, 0.07], [0.255, -0.055, 0.07]];
    const rOf = polarTable((phi) => {
      const dx = Math.cos(phi), dy = Math.sin(phi);
      let best = 0.05;
      for (const [cx, cy, rr] of circ) {
        const b = dx * cx + dy * cy, disc = b * b - (cx * cx + cy * cy - rr * rr);
        if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc));
      }
      if (dy < -1e-3) best = Math.min(best, -0.11 / dy);
      return best;
    }, 900, 8);
    const g = geo(puffyGeometry(rOf, { h: 0.095, E: 0.34, segU, segV, n: 2.2 }));
    const map = tex(faceCanvas({
      E: 0.34, base: '#f6f2ff', hi: '#ffffff', edge: '#d2c3f4',
      face: (g2, X, Y, S) => { cheeks(g2, X, Y, S, 0.12, -0.035, 0.032, '255,160,196'); sleepyEyes(g2, X, Y, S, 0.065, 0.012, 0.03); smile(g2, X, Y, S, -0.032, 0.022); },
    }));
    const mat = phys({ map, roughness: 0.82, sheen: 1, sheenColor: new THREE.Color('#cbb6ff'), sheenRoughness: 0.45, envMapIntensity: 0.55 });
    const body = new THREE.Group();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = shadows;
    body.add(m);
    return { body, hangY: 0.165, centerY: 0, r: 0.2, links: 5, wind: 1.4, anchors: [],
      tick(dt, t) { const s = Math.sin(t * 1.15 + 0.6); m.scale.set(1 + s * 0.012, 1 + s * 0.022, 1 + s * 0.03); } };
  }

  // 3 · mochi blob — pink, plush, a little squishy
  function makeMochi() {
    const g = geo(puffyGeometry(() => 0.2, { h: 0.15, E: 0.26, segU, segV, n: 2.0, deform: (p) => { p.x *= 1.08; if (p.y < 0) p.y *= 0.82; } }));
    const map = tex(faceCanvas({
      E: 0.26, base: '#ffc0d4', hi: '#ffe6ee', edge: '#f294b4',
      face: (g2, X, Y, S) => { cheeks(g2, X, Y, S, 0.098, -0.022, 0.032, '255,120,165'); dotEyes(g2, X, Y, S, 0.052, 0.022, 0.014); catMouth(g2, X, Y, S, -0.012, 0.024); },
    }));
    const mat = phys({ map, roughness: 0.62, sheen: 0.9, sheenColor: new THREE.Color('#fff0f6'), sheenRoughness: 0.35, clearcoat: 0.15, clearcoatRoughness: 0.4, envMapIntensity: 0.6 });
    const body = new THREE.Group();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = shadows;
    m.position.y = -0.16;
    body.add(m);
    let sq = 0, sqV = 0;
    return { body, hangY: 0.03, centerY: -0.16, r: 0.18, links: 3, wind: 1.1, anchors: [],
      tick(dt, t, C) {
        // squash & stretch, kicked by how fast it swings
        const sp = Math.min(1.5, C.vel.length());
        sqV += (-sq * 60 - sqV * 6 + sp * Math.sin(t * 7.0) * 2.5) * dt;
        sq += sqV * dt;
        const s = clamp(sq, -0.06, 0.06) + Math.sin(t * 1.6) * 0.008;
        m.scale.set(1 + s, 1 - s, 1 + s * 0.6);
      } };
  }

  // 4 · the film's lantern — plum paper, gold frame, a warm glow inside, the sun printed on it
  function makeLantern() {
    const prof = [[0.0, -0.285], [0.1, -0.286], [0.15, -0.28], [0.175, -0.2], [0.205, -0.06], [0.225, 0.08], [0.222, 0.19], [0.19, 0.262], [0.12, 0.302], [0.0, 0.315]];
    const lg = smoothLathe(prof, { samples: 36, segs: [24, 30, 36][q] });
    lg.rotateY(-Math.PI / 2);
    geo(lg);
    // paper: plum with soft fibres + the sun in gold on both faces
    const W = 512, H = 256;
    const { c: pc, g: pg } = cnv(W, H);
    const pgr = pg.createLinearGradient(0, 0, 0, H);
    pgr.addColorStop(0, '#3b1a57'); pgr.addColorStop(0.35, '#6b3fa0'); pgr.addColorStop(0.8, '#7d4fb8'); pgr.addColorStop(1, '#4b2470');
    pg.fillStyle = pgr; pg.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { pg.strokeStyle = `rgba(${R() < 0.5 ? '190,150,230' : '40,10,60'},${0.05 + R() * 0.07})`; pg.lineWidth = 0.6 + R(); const x = R() * W, y = R() * H; pg.beginPath(); pg.moveTo(x, y); pg.lineTo(x + (R() - 0.5) * 12, y + 10 + R() * 30); pg.stroke(); }
    for (const u of [0.25, 0.75]) paintSun(pg, u * W, H * 0.47, 54, { fill: '#e9b04f', line: '#8a5a1c', center: '#ffe3a3' });
    // glow through the paper: warmer low down, the printed sun and the seams block a little light
    const { c: ec, g: eg } = cnv(W, H);
    const egr = eg.createLinearGradient(0, 0, 0, H);
    egr.addColorStop(0, '#0a0402'); egr.addColorStop(0.3, '#3a1a0a'); egr.addColorStop(0.62, '#b8642c'); egr.addColorStop(0.9, '#ffb060'); egr.addColorStop(1, '#4a220c');
    eg.fillStyle = egr; eg.fillRect(0, 0, W, H);
    for (const u of [0.25, 0.75]) paintSun(eg, u * W, H * 0.47, 54, { fill: 'rgba(60,24,8,0.75)', line: 'rgba(30,10,4,0.9)', center: 'rgba(255,220,160,1)' });
    for (const u of [0.125, 0.375, 0.625, 0.875]) { eg.fillStyle = 'rgba(20,6,2,0.6)'; eg.fillRect(u * W - 3, 0, 6, H); }
    const map = tex(pc), emissiveMap = tex(ec);
    const paper = phys({ map, emissive: new THREE.Color('#ff9a48'), emissiveMap, emissiveIntensity: 0.2, roughness: 0.78, sheen: 0.6, sheenColor: new THREE.Color('#d6a6ff'), sheenRoughness: 0.6, envMapIntensity: 0.35 });
    // the gold frame: bottom & top bands, four ribs between the printed suns, a crown with a loop
    const parts = [];
    const band = (r, y, tube) => { const t = new THREE.TorusGeometry(r, tube, 8, 40); t.rotateX(Math.PI / 2); t.translate(0, y, 0); return t; };
    parts.push(band(0.153, -0.272, 0.013), band(0.214, 0.215, 0.011), band(0.178, -0.19, 0.006));
    const ribPts = [[0.158, -0.272], [0.18, -0.2], [0.21, -0.06], [0.232, 0.08], [0.229, 0.19], [0.2, 0.258]];
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const curve = new THREE.CatmullRomCurve3(ribPts.map(([r, y]) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r)));
      parts.push(new THREE.TubeGeometry(curve, 24, 0.0065, 6, false));
    }
    const crown = new THREE.CylinderGeometry(0.06, 0.095, 0.06, 24, 1); crown.translate(0, 0.33, 0); parts.push(crown);
    const knob = new THREE.SphereGeometry(0.03, 14, 10); knob.translate(0, 0.37, 0); parts.push(knob);
    const frame = geo(mergeGeometries(parts.map((p) => p.toNonIndexed())));
    parts.forEach((p) => p.dispose());
    const body = new THREE.Group();
    const pm = new THREE.Mesh(lg, paper), fm = new THREE.Mesh(frame, gold);
    pm.castShadow = pm.receiveShadow = fm.castShadow = shadows;
    fm.receiveShadow = shadows;
    body.add(pm, fm);
    body.position.y = 0;
    const light = new THREE.PointLight(0xffa24d, 0, 2.4, 2);
    light.position.set(0, -0.2, 0.05);
    body.add(light);
    return { body, hangY: 0.385, centerY: 0, r: 0.2, links: 8, wind: 0.9, paper, light,
      anchors: [{ p: [0.13, 0.215, 0.16], n: [0.45, 0.55, 0.7], size: 0.1, sharp: 70 }, { p: [-0.1, -0.272, 0.12], n: [-0.4, -0.2, 0.9], size: 0.07, sharp: 70 }] };
  }

  // 5 · the sun coin — a clear acrylic disc with the film's sun printed in gold inside
  function makeCoin() {
    const Rc = 0.215, th = 0.024;
    const prof = [[0, -th], [Rc - 0.02, -th], [Rc - 0.006, -th + 0.006], [Rc, 0], [Rc - 0.006, th - 0.006], [Rc - 0.02, th], [0, th]].map(([x, y]) => new THREE.Vector2(x, y));
    const dg = new THREE.LatheGeometry(prof, [36, 48, 56][q]);
    dg.rotateX(Math.PI / 2);
    geo(dg);
    const { c, g } = cnv(512, 512);
    paintSun(g, 256, 256, 236, { fill: '#ffffff', line: '#7a7a7a', center: '#ffffff' });
    g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(256, 256, 246, 0, TAU); g.stroke();
    const print = keep(new THREE.MeshStandardMaterial({ color: 0xf4c463, map: tex(c), alphaTest: 0.5, metalness: 1, roughness: 0.28, envMap, envMapIntensity: 1.3, side: THREE.DoubleSide }));
    const acrylic = clearMat({ thickness: 0.05 });
    const body = new THREE.Group();
    const disc = new THREE.Mesh(dg, acrylic);
    const pr = new THREE.Mesh(geo(new THREE.PlaneGeometry(Rc * 1.88, Rc * 1.88)), print);
    pr.receiveShadow = shadows;
    disc.renderOrder = 2;
    body.add(pr, disc);
    return { body, hangY: Rc - 0.02, centerY: 0, r: 0.18, links: 3, wind: 1.0,
      anchors: [{ p: [0.13, 0.13, th], n: [0.2, 0.25, 1], size: 0.12, sharp: 90 }, { p: [-0.2, -0.05, 0], n: [-0.95, -0.2, 0.25], size: 0.07, sharp: 50 }] };
  }

  // 6 · watermelon slice — enamel bands in a gold cloisonné rim, dark seeds
  function makeMelon() {
    const Rm = 0.36, half = 0.86, cy = -0.19, E = 0.24;
    const sh = new THREE.Shape();
    const a0 = -Math.PI / 2 - half, a1 = -Math.PI / 2 + half;
    sh.moveTo(0, 0);
    sh.lineTo(Math.cos(a0) * Rm, Math.sin(a0) * Rm);
    sh.absarc(0, 0, Rm, a0, a1, false);
    sh.lineTo(0, 0);
    const hole = new THREE.Path(); hole.absarc(0, -0.068, 0.022, 0, TAU, true); sh.holes.push(hole);
    const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.013, bevelSegments: 4, curveSegments: 40, UVGenerator: planarUV(0, cy, E) });
    eg.translate(0, 0, -0.02);
    eg.computeVertexNormals();
    geo(eg);
    const S = 512 / (2 * E);
    const X = (x) => (0.5 + x / (2 * E)) * 512, Y = (y) => (0.5 - (y - cy) / (2 * E)) * 512;
    const paint = (g, enamel) => {
      g.fillStyle = enamel ? '#e8b24e' : '#fff'; g.fillRect(0, 0, 512, 512);
      g.save();
      g.beginPath(); g.moveTo(X(0), Y(0)); g.arc(X(0), Y(0), (Rm - 0.012) * S, -a1, -a0, false); g.closePath(); // (canvas y is flipped)
      g.clip();
      const ring = (r, col) => { g.fillStyle = col; g.beginPath(); g.arc(X(0), Y(0), r * S, 0, TAU); g.fill(); };
      if (enamel) {
        ring(Rm, '#4f7040'); ring(Rm - 0.024, '#7ea862'); ring(Rm - 0.045, '#9fc47a'); ring(Rm - 0.062, '#f4f2d4');
        const fl = g.createRadialGradient(X(0), Y(0), 0, X(0), Y(0), (Rm - 0.07) * S);
        fl.addColorStop(0, '#ff8a98'); fl.addColorStop(0.55, '#ff5c74'); fl.addColorStop(1, '#f2455f');
        g.fillStyle = fl; g.beginPath(); g.arc(X(0), Y(0), (Rm - 0.075) * S, 0, TAU); g.fill();
        // seeds
        const seeds = [[-0.32, 0.17], [0.0, 0.2], [0.32, 0.17], [-0.6, 0.235], [-0.16, 0.25], [0.16, 0.25], [0.6, 0.235], [-0.45, 0.13], [0.45, 0.13]];
        for (const [a, r] of seeds) {
          const ang = -Math.PI / 2 + a, x = Math.cos(ang) * r, y = Math.sin(ang) * r;
          g.save(); g.translate(X(x), Y(y)); g.rotate(-ang - Math.PI / 2);
          g.fillStyle = '#2a1412'; g.beginPath(); g.ellipse(0, 0, 0.0085 * S, 0.016 * S, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(-0.003 * S, -0.005 * S, 0.0025 * S, 0.005 * S, 0, 0, TAU); g.fill();
          g.restore();
        }
      } else {
        ring(Rm, '#000');
      }
      // a fine gold cell line between flesh and rind
      g.strokeStyle = enamel ? '#e8b24e' : '#fff'; g.lineWidth = 0.007 * S;
      g.beginPath(); g.arc(X(0), Y(0), (Rm - 0.07) * S, 0, TAU); g.stroke();
      g.restore();
      // gold around the hole
      g.fillStyle = enamel ? '#e8b24e' : '#fff'; g.beginPath(); g.arc(X(0), Y(-0.068), 0.036 * S, 0, TAU); g.fill();
    };
    const { c: mc, g: mg } = cnv(512, 512); paint(mg, true);
    const { c: kc, g: kg } = cnv(512, 512); paint(kg, false);
    const metal = tex(kc, { srgb: false });
    const mat = phys({ map: tex(mc), metalness: 1, metalnessMap: metal, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.0 });
    const body = new THREE.Group();
    const m = new THREE.Mesh(eg, mat);
    m.castShadow = m.receiveShadow = shadows;
    body.add(m);
    return { body, hangY: -0.068, centerY: -0.22, r: 0.2, links: 3, wind: 1.1,
      anchors: [{ p: [0.12, -0.2, 0.04], n: [0.3, 0.2, 1], size: 0.1, sharp: 70 }, { p: [-0.2, -0.27, 0.0], n: [-0.6, -0.65, 0.4], size: 0.07, sharp: 60 }] };
  }

  // 7 · the hero: a tiny clear-green soda bottle, silver cap, pale fizzy liquid with bubbles
  function makeBottle() {
    const prof = [[0, -0.41], [0.09, -0.41], [0.122, -0.402], [0.134, -0.385], [0.138, -0.34], [0.138, -0.02], [0.134, 0.05], [0.118, 0.12], [0.088, 0.19], [0.062, 0.25], [0.052, 0.3], [0.05, 0.345], [0.057, 0.358], [0.058, 0.374], [0.05, 0.384], [0, 0.386]];
    const bg = geo(smoothLathe(prof, { samples: 56, segs: [36, 48, 60][q], tension: 0.2 }));
    {
      // twelve soft flutes round the lower body (generic soda glass), the lathe seam kept smooth
      const bp = bg.getAttribute('position');
      for (let i = 0; i < bp.count; i++) {
        const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i), r = Math.hypot(x, z);
        if (r < 1e-4) continue;
        const band = clamp((y + 0.37) / 0.05, 0, 1) * clamp((0.0 - y) / 0.06, 0, 1);
        const k = 1 + 0.03 * band * Math.pow(Math.max(0, Math.cos(Math.atan2(z, x) * 12)), 2);
        bp.setXYZ(i, x * k, y, z * k);
      }
      bg.computeVertexNormals();
      const bn = bg.getAttribute('normal'), cols = bp.count / (bg.parameters.segments + 1);
      for (let j = 0; j < cols; j++) {
        const a = j, b = bg.parameters.segments * cols + j;
        const nx = bn.getX(a) + bn.getX(b), ny = bn.getY(a) + bn.getY(b), nz = bn.getZ(a) + bn.getZ(b), l = Math.hypot(nx, ny, nz) || 1;
        bn.setXYZ(a, nx / l, ny / l, nz / l); bn.setXYZ(b, nx / l, ny / l, nz / l);
      }
    }
    const liq = [[0, -0.392], [0.1, -0.392], [0.121, -0.37], [0.124, -0.3], [0.124, -0.02], [0.12, 0.05], [0.104, 0.12], [0.08, 0.17], [0, 0.17]];
    const lg = geo(smoothLathe(liq, { samples: 30, segs: [18, 24, 30][q], tension: 0.2 }));
    const glass = q === 2
      ? keep(new THREE.MeshPhysicalMaterial({ envMap, color: 0xc8f5d2, transmission: 1, thickness: 0.07, roughness: 0.04, ior: 1.5, attenuationColor: new THREE.Color('#2f9e5a'), attenuationDistance: 0.32, specularIntensity: 1, clearcoat: 0.4, clearcoatRoughness: 0.04, envMapIntensity: 1.4, depthWrite: false }))
      : phys({ color: 0x57c97f, transparent: true, opacity: 0.42, depthWrite: false, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.0 });
    const liquid = phys({ color: 0xc4ec9e, emissive: new THREE.Color('#a6e88c'), emissiveIntensity: 0.1, roughness: 0.14, clearcoat: 0.8, clearcoatRoughness: 0.05, envMapIntensity: 0.8 });
    // crown cap with crimped skirt
    const cg = new THREE.CylinderGeometry(0.066, 0.07, 0.05, 42, 2);
    const cp = cg.getAttribute('position');
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i), z = cp.getZ(i), y = cp.getY(i);
      const r = Math.hypot(x, z);
      if (r < 0.05) continue;
      const a = Math.atan2(z, x), k = 1 + 0.07 * Math.max(0, Math.cos(a * 21)) * smoothY(y);
      cp.setXYZ(i, x * k, y, z * k);
    }
    function smoothY(y) { return clamp((0.025 - y) / 0.04, 0, 1); }
    cg.computeVertexNormals();
    cg.translate(0, 0.395, 0);
    geo(cg);
    const body = new THREE.Group();
    const lm = new THREE.Mesh(lg, liquid), gm = new THREE.Mesh(bg, glass), cm = new THREE.Mesh(cg, silver);
    gm.renderOrder = 2;
    cm.castShadow = shadows; cm.receiveShadow = shadows; lm.receiveShadow = shadows;
    body.add(lm, gm, cm);
    // bubbles inside (one instanced draw)
    const nB = [12, 22, 34][q];
    const bubbleMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color('#f2ffe8'), emissiveIntensity: 0.5, roughness: 0.15, envMap, envMapIntensity: 1.2 }));
    const bubbles = keep(new THREE.InstancedMesh(geo(new THREE.SphereGeometry(1, 8, 6)), bubbleMat, nB));
    bubbles.frustumCulled = false;
    bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // (the liquid is an opaque core so the transmissive glass can show it: bubbles rise along the wall)
    const bub = Array.from({ length: nB }, () => ({ a: R() * TAU, ph: R(), sp: 0.06 + R() * 0.08, s: 0.0045 + R() * 0.0065, w: R() * TAU }));
    body.add(bubbles);
    return { body, hangY: 0.43, centerY: -0.02, r: 0.2, links: 4, wind: 0.8, hero: true,
      anchors: [{ p: [0.085, 0.16, 0.1], n: [0.45, 0.45, 0.78], size: 0.12, sharp: 50 }, { p: [-0.1, -0.12, 0.1], n: [-0.6, 0.05, 0.8], size: 0.1, sharp: 70 }, { p: [0.03, 0.4, 0.06], n: [0.3, 0.7, 0.65], size: 0.06, sharp: 40 }],
      tick(dt, t) {
        const fizz = 1 + W.fizz * 1.6;
        for (let i = 0; i < nB; i++) {
          const b = bub[i];
          const k = (b.ph + t * b.sp * fizz) % 1;
          const y = -0.35 + k * 0.5;
          const rl = (y < 0.03 ? 0.124 : 0.124 - (y - 0.03) * 0.31) + 0.007;
          const a = b.a + Math.sin(t * 1.3 + b.w) * 0.05;
          const s = b.s * (k < 0.06 ? k / 0.06 : k > 0.94 ? (1 - k) / 0.06 : 1);
          _m1.makeScale(s, s, s).setPosition(Math.sin(a) * rl, y, Math.cos(a) * rl);
          bubbles.setMatrixAt(i, _m1);
        }
        bubbles.instanceMatrix.needsUpdate = true;
        liquid.emissiveIntensity = 0.1 + W.hero * 0.22;
      } };
  }

  // 8 · the clear '20' tag — acrylic, a gold edge, the number and tiny stars printed in gold
  function makeTag() {
    const hw = 0.215, hh = 0.155, rr = 0.06;
    const sh = new THREE.Shape();
    sh.moveTo(-hw + rr, -hh); sh.lineTo(hw - rr, -hh); sh.quadraticCurveTo(hw, -hh, hw, -hh + rr);
    sh.lineTo(hw, hh - rr); sh.quadraticCurveTo(hw, hh, hw - rr, hh); sh.lineTo(-hw + rr, hh);
    sh.quadraticCurveTo(-hw, hh, -hw, hh - rr); sh.lineTo(-hw, -hh + rr); sh.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
    const outline = sh.getSpacedPoints(96);
    const hole = new THREE.Path(); hole.absarc(0, hh - 0.045, 0.02, 0, TAU, true); sh.holes.push(hole);
    const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.026, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 3, curveSegments: 16 });
    eg.translate(0, 0, -0.013);
    geo(eg);
    const rim = geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline.slice(0, -1).map((p) => new THREE.Vector3(p.x, p.y, 0)), true), 140, 0.016, 8, true));
    const { c, g } = cnv(512, 384);
    const sx = 512 / (hw * 2 * 0.95);
    g.fillStyle = '#fff';
    const num = env.fill('{age}');
    const label = /^\d{1,3}$/.test(num) ? num : '20';
    g.font = 'italic 600 250px "Cormorant Garamond", Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, 256, 222);
    for (const [x, y, r] of [[78, 92, 22], [438, 118, 16], [92, 300, 13], [422, 286, 24], [340, 330, 10], [170, 70, 9]]) paintSparkle(g, x, y, r);
    g.strokeStyle = '#fff'; g.lineWidth = 6;
    g.beginPath(); g.arc(256, 384 - (hh - 0.045 + hh * 0.95) * sx, 0.034 * sx, 0, TAU); g.stroke();
    const print = keep(new THREE.MeshStandardMaterial({ color: 0xf4c463, map: tex(c), alphaTest: 0.5, metalness: 1, roughness: 0.26, envMap, envMapIntensity: 1.3 }));
    const body = new THREE.Group();
    // printed on both faces, so it reads the right way round from either side
    const pf = new THREE.PlaneGeometry(hw * 2 * 0.95, hw * 2 * 0.95 * 0.75), pb = pf.clone();
    pf.translate(0, 0, 0.0015); pb.rotateY(Math.PI); pb.translate(0, 0, -0.0015);
    const pr = new THREE.Mesh(geo(mergeGeometries([pf, pb])), print);
    pf.dispose(); pb.dispose();
    pr.receiveShadow = shadows;
    const slab = new THREE.Mesh(eg, clearMat({ thickness: 0.04 }));
    slab.renderOrder = 2;
    const rm = new THREE.Mesh(rim, gold);
    rm.castShadow = rm.receiveShadow = shadows;
    body.add(pr, slab, rm);
    return { body, hangY: hh - 0.045, centerY: 0, r: 0.18, links: 5, wind: 1.2,
      anchors: [{ p: [hw - 0.02, hh - 0.02, 0.015], n: [0.55, 0.55, 0.62], size: 0.1, sharp: 60 }, { p: [-0.05, -0.02, 0.022], n: [0, 0.1, 1], size: 0.12, sharp: 110 }] };
  }

  // ring layout: R1 (the close-up ring) · R2 · R3 · R4 = the hero's ring. R1's three are big for its
  // ring, so they have fixed places (a = the angle round the ring from its lowest point): the lantern
  // at the bottom on a longer chain, the star and the coin high on either side on short ones, their
  // lower edges above the lantern's shoulders (the low tier, without the star, keeps the same places).
  // A pair shares the lower half of its ring.
  const ALL = [
    { id: 'star', ring: 0, a: -1.15, make: makeStar, low: false },
    { id: 'lantern', ring: 0, a: 0, make: makeLantern, low: true },
    { id: 'coin', ring: 0, a: 1.15, make: makeCoin, low: true },
    { id: 'cloud', ring: 1, make: makeCloud, low: false },
    { id: 'mochi', ring: 1, make: makeMochi, low: true },
    { id: 'melon', ring: 2, make: makeMelon, low: true },
    { id: 'tag', ring: 2, make: makeTag, low: true },
    { id: 'bottle', ring: 3, make: makeBottle, low: true },
  ].filter((d) => q > 0 || d.low);
  for (const d of ALL) charmDefs.push({ ...d, ...d.make() });
  // what keeps the charms on a ring apart: each one's hull, a capsule about its centre in its own frame
  // — [axis, offset along y, half-length, radius] — that holds all of its shape (fitted to the meshes),
  // so a hard swing can press one charm against another but never sink it in
  const HULL = {
    star: ['y', 0, 0, 0.27], lantern: ['y', 0.03, 0.13, 0.243], coin: ['y', 0, 0, 0.22],
    cloud: ['x', 0.04, 0.19, 0.185], mochi: ['x', 0.02, 0.04, 0.19], melon: ['x', 0.04, 0.1, 0.2], tag: ['x', 0, 0.11, 0.185],
  };

  // ---------------------------------------------------------------- the thread
  const CONTACT = [new THREE.Vector3(-1.7, 2.15, 0.6), new THREE.Vector3(-0.3, 1.8, -1.0), new THREE.Vector3(1.3, 2.2, -2.6), new THREE.Vector3(2.8, 1.75, -4.4)];
  const HERO_AT = new THREE.Vector3(0.55, 2.2, 2.3);
  const before = [new THREE.Vector3(-7.4, 3.8, 5.6), new THREE.Vector3(-4.9, 2.95, 3.4), new THREE.Vector3(-3.1, 2.4, 1.8)];
  const mid = [new THREE.Vector3(-1.0, 2.1, -0.2), new THREE.Vector3(0.5, 2.17, -1.8), new THREE.Vector3(2.05, 2.15, -3.5)];
  const afterA = [new THREE.Vector3(3.8, 1.95, -5.6), new THREE.Vector3(5.4, 2.6, -8.6), new THREE.Vector3(8.0, 3.8, -13.0)];
  const ptsA = [...before, CONTACT[0], mid[0], CONTACT[1], mid[1], CONTACT[2], mid[2], CONTACT[3], ...afterA];
  const ptsB = [...before, CONTACT[0], mid[0], CONTACT[1], mid[1], CONTACT[2], new THREE.Vector3(0.3, 2.6, 0.1), HERO_AT,
    new THREE.Vector3(1.65, 2.35, 2.0), new THREE.Vector3(3.6, 2.9, 1.1), new THREE.Vector3(8.0, 4.2, -1.6), new THREE.Vector3(14.0, 6.5, -6.0)];
  const pathA = new PathSampler(ptsA, { samples: 2600 });
  const pathB = new PathSampler(ptsB, { samples: 2600 });
  const sRing = CONTACT.map((p) => pathA.closest(p));
  const sH = pathB.closest(HERO_AT);
  const ancA = [0, sRing[0], sRing[1], sRing[2], sRing[3], pathA.length];
  const ancB = [0, pathB.closest(CONTACT[0]), pathB.closest(CONTACT[1]), pathB.closest(CONTACT[2]), sH, pathB.length];
  const thread = new ThreadPath(pathA, pathB, ancA, ancB);
  const strand = createStrand({ segments: [120, 160, 200][q] });
  strand.uniforms.uWidth.value = 0.35;
  scene.add(strand.mesh);
  const sRest = pathA.length - 0.02;
  const STRAND_OPTS = { wobble: 0.6 };
  const T = { s0: 0, s1: 0 };

  // ---------------------------------------------------------------- rings, chains, pendulums
  const RING_R = 0.31, WIRE = 0.021, PITCH = 0.046, HANG = 0.281;
  const ringGeo = geo(splitRingGeometry({ R: RING_R, r: WIRE, pitch: PITCH, segs: [110, 150, 180][q], radial: [8, 9, 10][q] }));
  ringGeo.translate(0, -HANG, 0);
  const rings = CONTACT.map((p, i) => {
    const P = new Pend(0.46, 0.95);
    P.yawK = 2.0; P.yawC = 1.1; P.ph = i * 1.7;
    if (i === 3) P.c = 2.4;   // the hero's ring is drawn a long way: keep it composed
    const tng = pathA.tangent(sRing[i], new THREE.Vector3());
    P.base = Math.atan2(tng.x, tng.z);
    P.place(p);
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(ringGeo, brass);
    mesh.castShadow = mesh.receiveShadow = shadows;
    group.add(mesh);
    scene.add(group);
    return { P, group, i, charms: [], tugged: false, yawOff: 0, s: sRing[i], tng, base0: P.base };
  });

  // chain instances: jump ring + links + eyelet per charm
  const torus = geo(new THREE.TorusGeometry(1, 0.24, 6, [12, 14, 16][q]));
  const linkLocal = [];
  const WIDE_AZ = 0.05;   // the audience direction the charms face by default
  const charms = charmDefs.map((d, n) => {
    const ring = rings[d.ring];
    const k = ring.charms.length;
    const count = charmDefs.filter((c) => c.ring === d.ring).length;
    const a = d.a ?? (k - (count - 1) / 2) * 1.7;
    const coil = (k % 2 ? -1 : 1) * PITCH * 0.5;
    const attach = new THREE.Vector3(Math.sin(a) * RING_R, -HANG - Math.cos(a) * RING_R, coil);
    // chain layout in the charm frame (hanging along −y)
    const mats = [];
    const push = (y, rotY, sx, sy) => { const m = new THREE.Matrix4().makeRotationY(rotY); m.multiply(new THREE.Matrix4().makeScale(sx, sy, sx)); m.setPosition(0, y, 0); mats.push(m); };
    push(-0.008, Math.PI / 2, 0.036, 0.036);
    let y = -0.06;
    for (let l = 0; l < d.links; l++) { push(y, l % 2 ? Math.PI / 2 : 0, 0.021, 0.032); y -= 0.052; }
    const eyeY = y + 0.004;
    push(eyeY, d.links % 2 ? Math.PI / 2 : 0, 0.024, 0.024);
    const L = -(eyeY - d.hangY + d.centerY);
    const P = new Pend(L, 1.05);
    P.wind = d.wind; P.ph = n * 2.3 + 0.7;
    P.yawK = d.hero ? 2.6 : 2.2 + R() * 1.2; P.yawC = 1.0;
    if (d.hero) P.c = 2.4;
    P.base = WIDE_AZ + (R() - 0.5) * 0.7;
    const pivotG = new THREE.Group();
    d.body.position.y = eyeY - d.hangY;
    pivotG.add(d.body);
    scene.add(pivotG);
    const [hx, hy, hl, hr] = HULL[d.id] || ['y', 0, 0, d.r];
    const hull = { a: new THREE.Vector3(hx === 'x' ? -hl : 0, hx === 'x' ? hy : hy - hl, 0), b: new THREE.Vector3(hx === 'x' ? hl : 0, hx === 'x' ? hy : hy + hl, 0), r: hr };
    const C = { ...d, ring, attach, P, hull, pivotG, mats, first: linkLocal.length, idle: R() * TAU, spin: d.id === 'coin' ? 0.9 : 0.42 };
    mats.forEach((m) => linkLocal.push(m));
    ring.charms.push(C);
    return C;
  });
  // (an instanced draw needs its own program variant: sharing `gold` with the lantern's frame and the
  // tag's rim — or the shadow pass's one depth material with every plain caster — would make three.js
  // rebuild the program's state several times a frame, flipping between the two)
  const links = new THREE.InstancedMesh(torus, keep(gold.clone()), linkLocal.length);
  links.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  links.frustumCulled = false;
  links.castShadow = shadows;
  if (shadows) links.customDepthMaterial = keep(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  links.receiveShadow = shadows;
  scene.add(links);
  const byId = Object.fromEntries(charms.map((c) => [c.id, c]));
  const lantern = byId.lantern, hero = byId.bottle;

  // place every pendulum at rest (charms that would overlap hanging straight down already apart)
  function settleAll() {
    rings.forEach((rg) => {
      thread.at(rg.s, _v1);
      rg.P.yawT = rg.yawOff; rg.P.place(_v1); rg.P.finish(1);
      const cs = rg.charms;
      cs.forEach((C) => { _v2.copy(C.attach).applyQuaternion(rg.P.q).add(rg.P.pivot); C.P.place(_v2); C.P.finish(1); });
      for (let it = 0; it < 12 && cs.length > 1; it++) {
        keepApart(cs);
        cs.forEach((C) => { C.P.constrain(); C.P.prev.copy(C.P.bob); C.P.finish(1); });
      }
    });
  }

  /** Charms on one ring pressed apart where their hulls overlap (positions only: the solver's velocities follow). */
  function keepApart(cs) {
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const A = cs[i], B = cs[j];
        _h0.copy(A.hull.a).applyQuaternion(A.P.q).add(A.P.bob); _h1.copy(A.hull.b).applyQuaternion(A.P.q).add(A.P.bob);
        _h2.copy(B.hull.a).applyQuaternion(B.P.q).add(B.P.bob); _h3.copy(B.hull.b).applyQuaternion(B.P.q).add(B.P.bob);
        closestOnSegments(_h0, _h1, _h2, _h3, _pa, _pb);
        _d.subVectors(_pb, _pa);
        const gap = _d.length(), min = A.hull.r + B.hull.r;
        if (gap >= min) continue;
        let len = gap;
        if (len < 1e-6) { _d.subVectors(B.P.bob, A.P.bob); len = _d.length(); if (len < 1e-6) { _d.set(1, 0, 0); len = 1; } }
        _d.multiplyScalar(((min - gap) * 0.5) / len);
        A.P.bob.sub(_d); B.P.bob.add(_d);
      }
    }
  }

  // ---------------------------------------------------------------- lights
  const keyDir = new THREE.Vector3(-0.5, 0.72, 0.48).normalize();
  const focus = new THREE.Vector3(0.5, 1.2, -1.6);
  const key = new THREE.DirectionalLight(0xffd2a0, 0);
  key.position.copy(focus).addScaledVector(keyDir, 16);
  key.target.position.copy(focus);
  if (shadows) {
    key.castShadow = true;
    const ss = q === 2 ? 1024 : 512;
    key.shadow.mapSize.set(ss, ss);
    const cam = key.shadow.camera;
    cam.left = -6.2; cam.right = 6.2; cam.top = 5.2; cam.bottom = -5.2; cam.near = 6; cam.far = 28;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.018;
  }
  const rim = new THREE.DirectionalLight(0x8ea2ff, 0);
  rim.position.set(3.5, 5, -12);
  rim.target.position.copy(focus);
  const hemi = new THREE.HemisphereLight(0x6a58a0, 0x1c0d12, 0.12);
  const heroLight = new THREE.PointLight(0xffc06a, 0, 2.6, 2);
  scene.add(key, key.target, rim, rim.target, hemi, heroLight);

  // ---------------------------------------------------------------- bokeh, dust, sparks
  const bokehMat = keep(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBright: { value: 0.4 }, uFront: { value: 1 } },
    vertexShader: BOKEH_VERT, fragmentShader: BOKEH_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  // (reduced motion: fewer drifting lights and motes)
  const nBack = Math.round([20, 32, 46][q] * (reduced ? 0.6 : 1)), nFront = [6, 8, 10][q];
  const bokeh = billboards(nBack + nFront, [['aPos', 3], ['aCol', 4], ['aMisc', 3]], bokehMat);
  keep(bokeh.geo);
  bokeh.mesh.renderOrder = -5;
  scene.add(bokeh.mesh);
  const pal = [[1.0, 0.72, 0.38], [1.0, 0.6, 0.28], [1.0, 0.62, 0.72], [0.7, 0.6, 1.0], [1.0, 0.86, 0.62]];
  const AZ1 = -0.12;  // the close-up's viewing azimuth on ring 1 (a 3/4 view of its face)
  for (let i = 0; i < nBack + nFront; i++) {
    const front = i >= nBack;
    let p;
    if (!front) {
      const az = Math.PI + (R() - 0.5) * 4.6, r = 13 + R() * 11;
      p = [focus.x + Math.sin(az) * r, -2 + R() * 9.5, focus.z + Math.cos(az) * r];
    } else {
      const d = 0.32 + R() * 0.5, side = (R() - 0.5) * 0.9, up = (R() - 0.35) * 0.55;
      const ax = Math.sin(AZ1), az = Math.cos(AZ1);
      p = [CONTACT[0].x + ax * d + az * side, CONTACT[0].y - 0.18 + up, CONTACT[0].z + az * d - ax * side];
    }
    const col = pal[Math.floor(R() * pal.length)];
    bokeh.attrs.aPos.setXYZ(i, ...p);
    bokeh.attrs.aCol.setXYZW(i, col[0], col[1], col[2], front ? 0.16 + R() * 0.16 : 0.08 + R() * 0.2);
    bokeh.attrs.aMisc.setXYZ(i, front ? 0.07 + R() * 0.1 : 0.7 + R() * 1.6, R(), front ? 1 : 0);
  }

  const dustMat = keep(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBright: { value: 0.3 } },
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  const nDust = Math.round([90, 180, 300][q] * (reduced ? 0.6 : 1));
  const dust = billboards(nDust, [['aPos', 3], ['aMisc', 3]], dustMat);
  keep(dust.geo);
  dust.mesh.renderOrder = 5;
  scene.add(dust.mesh);
  for (let i = 0; i < nDust; i++) {
    let p;
    if (i < nDust * 0.25) { const a = R() * TAU, r = 0.2 + R() * 1.3; p = [CONTACT[0].x + Math.cos(a) * r, CONTACT[0].y - 0.6 + (R() - 0.5) * 1.6, CONTACT[0].z + Math.sin(a) * r]; }
    else if (i < nDust * 0.4) { const a = R() * TAU, r = 0.2 + R() * 1.6; p = [HERO_AT.x + Math.cos(a) * r, HERO_AT.y - 1.0 + (R() - 0.5) * 1.8, HERO_AT.z + Math.sin(a) * r]; }
    else p = [-5 + R() * 12, -0.5 + R() * 4.5, -9 + R() * 13];
    dust.attrs.aPos.setXYZ(i, ...p);
    dust.attrs.aMisc.setXYZ(i, 0.008 + R() * R() * 0.02, R(), 0.04 + R() * 0.07);
  }

  // sparks: glints that flash when a surface turns into the key light; halos; fizz; the thread's head
  const glints = [];
  rings.forEach((rg) => {
    for (const [th, nz] of [[2.05, 0.35], [-0.35, 0.25], [3.6, 0.3]]) {
      const p = new THREE.Vector3(Math.cos(th) * (RING_R + WIRE * 0.9), -HANG + Math.sin(th) * (RING_R + WIRE * 0.9), PITCH * 0.5);
      glints.push({ obj: rg.group, p, n: new THREE.Vector3(Math.cos(th), Math.sin(th), nz).normalize(), size: 0.075, sharp: 55, ring: rg.i });
    }
  });
  charms.forEach((C) => C.anchors.forEach((a) => glints.push({ obj: C.body, p: new THREE.Vector3(...a.p), n: new THREE.Vector3(...a.n).normalize(), size: a.size, sharp: a.sharp, ring: -1 })));
  const nFizz = [5, 7, 9][q];
  const fizz = Array.from({ length: nFizz }, () => ({ da: (R() - 0.5) * 1.3, y: -0.3 + R() * 0.42, w: 3 + R() * 4, ph: R() * TAU, size: 0.045 + R() * 0.04 }));
  const SP_LANTERN = glints.length, SP_HERO = SP_LANTERN + 1, SP_HERO2 = SP_LANTERN + 2, SP_HEAD = SP_LANTERN + 3, SP_FIZZ = SP_LANTERN + 4;
  const nSpark = SP_FIZZ + nFizz;
  const sparkMat = keep(new THREE.ShaderMaterial({ vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const sparks = billboards(nSpark, [['aPos', 3, true], ['aCol', 4, true], ['aMisc', 3, true]], sparkMat);
  keep(sparks.geo);
  sparks.mesh.renderOrder = 20;
  scene.add(sparks.mesh);
  const SA = sparks.attrs;

  // ---------------------------------------------------------------- state
  // W: the looks the choreography animates (lights, haze, focus, thread, glows)
  const W = { key: 0, haze: 0.15, fog: 0, hold: 0, front: 1, lantern: 0, thread: 0, ring: 0, width: 0.35, head: 0, hero: 0, fizz: 0, breeze: 0, motes: 0.25, bokeh: 0.35, face: 0, sway: 1, exposure: 1 };
  const cam = { x: 0, y: 0, z: 0, az: 0, el: 0.1, lh: 0, lw: 0, fov: 34, lift: 0.1, tk: 0, hk: 0, breath: 0.6 };
  const track = new THREE.Vector3(), head = new THREE.Vector3(), headSm = new THREE.Vector3();
  let trackInit = false;
  let jingleArmed = false;

  const api = {
    id: 'keychains', scene, camera, exposure: 1,
    bloom: { strength: 0.55, radius: 0.5, threshold: 0.8 },
    late: [],
    update, resize, play, dispose,
  };
  if (window.__LITTLE_DEV__) api.dbg = { W, cam, T, thread, rings, charms, renderer: env.renderer };

  // ---------------------------------------------------------------- per-frame
  function stepPhysics(dt, t) {
    // (a frame with no time in it — a coarse clock can repeat a timestamp — has nothing to step:
    // velocities are Δ/h, and h = 0 would turn every charm into NaN for good)
    if (!(dt > 0)) return;
    const n = Math.min(12, Math.max(1, Math.ceil(dt / STEP)));
    const h = dt / n;
    const b = W.breeze;
    for (let r = 0; r < rings.length; r++) {
      const rg = rings[r], P = rg.P;
      P.from.copy(P.pivot);
      thread.at(rg.s, P.to);
      P.to.y += Math.sin(t * 1.7 + r * 1.3) * 0.006 * b;
      P.yawT = rg.yawOff + W.sway * 0.2 * Math.sin(t * 0.17 + r * 1.9);
      if (r === 3) {   // the hero's ring turns with the thread as it is drawn forward, then to the camera
        thread.tangent(rg.s, _v3);
        P.base = rg.base0 + angDiff(rg.base0, Math.atan2(_v3.x, _v3.z)) * thread.k;
        if (W.face > 0) {
          const want = Math.atan2(camera.position.x - P.pivot.x, camera.position.z - P.pivot.z) + 0.5 - P.base;
          P.yawT = lerp(P.yawT, P.yaw + angDiff(P.yaw, want), W.face * 0.85);
        }
      }
    }
    for (let c = 0; c < charms.length; c++) {
      const C = charms[c], P = C.P;
      let tgt = Math.sin(t * (0.19 + (C.idle % 1) * 0.1) + C.idle) * C.spin * W.sway;
      if (C.hero && W.face > 0) {
        const want = Math.atan2(camera.position.x - P.bob.x, camera.position.z - P.bob.z) - P.base;
        tgt = lerp(tgt, P.yaw + angDiff(P.yaw, want), W.face);
      }
      P.yawT = tgt;
    }
    // while the thread draws the hero forward its keychain is carried nearly upright (a soft hold
    // toward hanging straight down), so it arrives composed and only then sways
    const hold = W.hold > 0 ? 1 - Math.exp(-7 * W.hold * h) : 0;
    for (let s = 1; s <= n; s++) {
      const f = s / n;
      for (let r = 0; r < rings.length; r++) {
        const P = rings[r].P, cs = rings[r].charms;
        P.pivot.lerpVectors(P.from, P.to, f);
        P.track(h);
        const wx = b * (0.32 * Math.sin(t * 0.53 + P.ph) + 0.16 * Math.sin(t * 1.37 + P.ph * 2));
        const wz = b * (0.26 * Math.sin(t * 0.41 + 1 + P.ph) + 0.13 * Math.sin(t * 1.1 + P.ph));
        P.predict(h, wx, wz);
        if (hold && r === 3) holdUpright(P, hold);
        P.constrain(); P.finish(h);
        for (let i = 0; i < cs.length; i++) {
          const C = cs[i];
          C.P.pivot.copy(C.attach).applyQuaternion(P.q).add(P.pivot);
          C.P.track(h);
          C.P.predict(h, wx * C.P.wind, wz * C.P.wind);
          if (hold && C.hero) holdUpright(C.P, hold);
        }
        // charms on one ring press each other apart instead of passing through (twice: a push from
        // one neighbour can move a charm into the other)
        if (cs.length > 1) { keepApart(cs); for (let i = 0; i < cs.length; i++) cs[i].P.constrain(); keepApart(cs); }
        for (let i = 0; i < cs.length; i++) { cs[i].P.constrain(); cs[i].P.finish(h); }
      }
    }
  }

  function holdUpright(P, k) {
    _d.set(P.pivot.x, P.pivot.y - P.L, P.pivot.z);
    P.bob.lerp(_d, k);
  }

  function writeTransforms() {
    for (let r = 0; r < rings.length; r++) { const rg = rings[r]; rg.group.position.copy(rg.P.pivot); rg.group.quaternion.copy(rg.P.q); }
    for (let c = 0; c < charms.length; c++) {
      const C = charms[c];
      C.pivotG.position.copy(C.P.pivot);
      C.pivotG.quaternion.copy(C.P.q);
      _m1.compose(C.P.pivot, C.P.q, ONE);
      for (let k = 0; k < C.mats.length; k++) { _m2.multiplyMatrices(_m1, C.mats[k]); links.setMatrixAt(C.first + k, _m2); }
    }
    links.instanceMatrix.needsUpdate = true;
  }

  function updateCamera(dt, t) {
    if (hero) {
      _v1.copy(hero.P.bob);
      if (!trackInit) { track.copy(_v1); trackInit = true; }
      track.x = damp(track.x, _v1.x, 3.2, dt); track.y = damp(track.y, _v1.y, 3.2, dt); track.z = damp(track.z, _v1.z, 3.2, dt);
    }
    thread.at(T.s1, head);
    headSm.x = damp(headSm.x, head.x, 5, dt); headSm.y = damp(headSm.y, head.y, 5, dt); headSm.z = damp(headSm.z, head.z, 5, dt);
    _v1.set(cam.x, cam.y, cam.z).lerp(track, cam.tk).lerp(headSm, cam.hk);
    const tv = Math.tan((cam.fov * DEG) / 2), th = tv * camera.aspect;
    const dist = Math.max(Math.exp(cam.lh) / tv, Math.exp(cam.lw) / th);
    const ce = Math.cos(cam.el);
    rig.pos.set(_v1.x + Math.sin(cam.az) * ce * dist, _v1.y + Math.sin(cam.el) * dist, _v1.z + Math.cos(cam.az) * ce * dist);
    rig.look.set(_v1.x, _v1.y - cam.lift * dist * tv, _v1.z);
    rig.fov = cam.fov;
    rig.breath = reduced ? 0 : cam.breath * dist * 0.14;
    rig.apply(t);
    camera.updateMatrixWorld();
  }

  function writeSparks(t) {
    _v3.copy(key.position).sub(key.target.position).normalize();     // to the light
    const kl = W.key;
    let ringPeak = 0;
    for (let i = 0; i < glints.length; i++) {
      const g = glints[i];
      _v1.copy(g.p).applyMatrix4(g.obj.matrixWorld);
      _v2.copy(g.n).transformDirection(g.obj.matrixWorld);
      _d.copy(camera.position).sub(_v1).normalize().add(_v3).normalize();   // half vector
      const s = Math.max(0, _v2.dot(_d));
      const a = Math.pow(s, g.sharp) * kl * 2.2;
      if (g.ring === 0) ringPeak = Math.max(ringPeak, a);
      SA.aPos.setXYZ(i, _v1.x, _v1.y, _v1.z);
      SA.aCol.setXYZW(i, 1.0, 0.9, 0.72, a);
      SA.aMisc.setXYZ(i, g.size * (0.75 + 0.25 * Math.min(1, a)), 1, 0.3 + a * 0.25);
    }
    if (jingleArmed && ringPeak > 0.55) { jingleArmed = false; env.sfx('jingle'); env.later(0.25, () => env.sfx('shimmer')); }
    // lantern halo (flickering)
    const fl = 0.9 + 0.06 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 13.1 + 1.2);
    if (lantern) {
      lantern.body.getWorldPosition(_v1);
      SA.aPos.setXYZ(SP_LANTERN, _v1.x, _v1.y - 0.04, _v1.z);
      SA.aCol.setXYZW(SP_LANTERN, 1.0, 0.62, 0.3, W.lantern * fl * 0.6);
      SA.aMisc.setXYZ(SP_LANTERN, 0.8, 0, 0);
      lantern.paper.emissiveIntensity = 0.08 + W.lantern * 0.75 * fl;
      lantern.light.intensity = W.lantern * 0.9 * fl;
    } else SA.aCol.setW(SP_LANTERN, 0);
    if (hero) {
      _v1.set(0, hero.centerY, 0).applyMatrix4(hero.body.matrixWorld);
      heroLight.position.copy(_v1).addScaledVector(UP, 0.32);
      heroLight.intensity = W.hero * 0.55;
      SA.aPos.setXYZ(SP_HERO, _v1.x, _v1.y, _v1.z);
      SA.aCol.setXYZW(SP_HERO, 1.0, 0.72, 0.38, W.hero * 0.55);   // a warm aura behind it
      SA.aMisc.setXYZ(SP_HERO, 1.15, 0, 0);
      SA.aPos.setXYZ(SP_HERO2, _v1.x, _v1.y - 0.05, _v1.z);
      SA.aCol.setXYZW(SP_HERO2, 1.0, 0.86, 0.55, W.hero * 0.22);  // a small warm core inside
      SA.aMisc.setXYZ(SP_HERO2, 0.26, 2, 0);
      _m1.copy(hero.body.matrixWorld).invert();
      _v2.copy(camera.position).applyMatrix4(_m1);
      const a0 = Math.atan2(_v2.x, _v2.z);
      for (let i = 0; i < nFizz; i++) {
        const f = fizz[i];
        const rl = (f.y < 0.03 ? 0.124 : 0.124 - (f.y - 0.03) * 0.31) + 0.01;
        _v1.set(Math.sin(a0 + f.da) * rl, f.y, Math.cos(a0 + f.da) * rl).applyMatrix4(hero.body.matrixWorld);
        const tw = Math.pow(Math.max(0, Math.sin(t * f.w + f.ph)), 6);
        SA.aPos.setXYZ(SP_FIZZ + i, _v1.x, _v1.y, _v1.z);
        SA.aCol.setXYZW(SP_FIZZ + i, 0.95, 1.0, 0.85, W.fizz * tw * 1.4);
        SA.aMisc.setXYZ(SP_FIZZ + i, f.size, 1, t * 0.4 + f.ph);
      }
    }
    // the thread's head
    SA.aPos.setXYZ(SP_HEAD, head.x, head.y, head.z);
    SA.aCol.setXYZW(SP_HEAD, 1.0, 0.82, 0.5, W.head * W.thread);
    SA.aMisc.setXYZ(SP_HEAD, 0.34, 0, 0);
    SA.aPos.needsUpdate = SA.aCol.needsUpdate = SA.aMisc.needsUpdate = true;
  }

  function update(dt, t) {
    // the head passing a ring catches it: a tug, a swing, a jingle
    for (let r = 0; r < rings.length; r++) {
      const rg = rings[r];
      if (!rg.tugged && W.thread > 0.3 && T.s1 >= rg.s) {
        rg.tugged = true;
        thread.tangent(rg.s, _v1);
        const k = reduced ? 0.12 : rg.i === 0 ? 1.0 : 0.65;
        rg.P.vel.addScaledVector(_v1, k * 0.9);
        rg.P.yawV += k * 0.9;
        rg.charms.forEach((C) => { C.P.vel.addScaledVector(_v1, k * 0.5); C.P.yawV -= k * 0.6; });
        if (rg.i === 0) env.sfx('jingle');
      }
    }
    stepPhysics(dt, t);
    writeTransforms();
    for (let c = 0; c < charms.length; c++) if (charms[c].tick) charms[c].tick(dt, t, charms[c].P);
    updateCamera(dt, t);
    scene.updateMatrixWorld();
    // thread
    strand.uniforms.uOpacity.value = W.thread;
    strand.uniforms.uRing.value = W.ring;
    strand.uniforms.uWidth.value = W.width;
    if (W.thread > 0.001) strand.update(thread, T.s0, Math.max(T.s0 + 0.05, T.s1), t, STRAND_OPTS);
    writeSparks(t);
    // lights & air
    key.intensity = 2.7 * W.key;
    rim.intensity = 1.5 * (0.3 + 0.7 * W.key);
    hemi.intensity = 0.1 + 0.32 * W.key;
    sky.material.uniforms.uHaze.value = W.haze;
    scene.fog.near = lerp(0.95, 9, W.fog);
    scene.fog.far = lerp(2.7, 34, W.fog * W.fog);
    scene.fog.color.copy(fogDark).lerp(fogWarm, W.haze);
    bokehMat.uniforms.uTime.value = t; bokehMat.uniforms.uBright.value = W.bokeh; bokehMat.uniforms.uFront.value = W.front;
    dustMat.uniforms.uTime.value = t; dustMat.uniforms.uBright.value = W.motes;
    api.exposure = W.exposure;
  }

  function resize({ aspect }) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- shots
  const portrait = () => (env.size?.aspect ?? 1.6) < 0.8;
  const LN = Math.log;
  const ringTop = () => _v1.copy(rings[0].P.pivot).add(_v2.set(0, -0.12, 0));
  /**
   * A wide shot that holds the whole collection inside the safe frame — clear of the progress dots
   * at the top and the subtitle band at the bottom — for this screen's aspect (beat starts only).
   */
  function fitWide(az, el, fov, { xm = 0.9, ylo = -0.5, yhi = 0.74 } = {}) {
    const pts = [];
    rings.forEach((rg) => pts.push([rg.P.pivot.x, rg.P.pivot.y + 0.05, rg.P.pivot.z, 0.12]));
    charms.forEach((C) => pts.push([C.P.bob.x, C.P.bob.y, C.P.bob.z, C.r * 1.5]));
    const tv = Math.tan((fov * DEG) / 2), th = tv * camera.aspect;
    const ce = Math.cos(el);
    const dirv = new THREE.Vector3(Math.sin(az) * ce, Math.sin(el), Math.cos(az) * ce);
    const fwd = dirv.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    const upv = new THREE.Vector3().crossVectors(right, fwd);
    const S = new THREE.Vector3();
    pts.forEach((p) => S.add(new THREE.Vector3(p[0], p[1], p[2])));
    S.divideScalar(pts.length);
    const hy = (yhi - ylo) / 2, rel = new THREE.Vector3(), camP = new THREE.Vector3();
    const box = (d) => {
      camP.copy(S).addScaledVector(dirv, d);
      const b = [Infinity, -Infinity, Infinity, -Infinity, Infinity];
      for (const p of pts) {
        rel.set(p[0], p[1], p[2]).sub(camP);
        const z = rel.dot(fwd), x = rel.dot(right), y = rel.dot(upv);
        b[4] = Math.min(b[4], z);
        if (z < 0.2) continue;
        b[0] = Math.min(b[0], (x - p[3]) / (z * th)); b[1] = Math.max(b[1], (x + p[3]) / (z * th));
        b[2] = Math.min(b[2], (y - p[3]) / (z * tv)); b[3] = Math.max(b[3], (y + p[3]) / (z * tv));
      }
      return b;
    };
    let d = 10;
    for (let it = 0; it < 4; it++) {
      let lo = 1, hi = 80;
      for (let k = 0; k < 30; k++) {
        const m = (lo + hi) / 2, b = box(m);
        if (b[4] > 0.3 && b[0] >= -xm && b[1] <= xm && b[2] >= -hy && b[3] <= hy) hi = m; else lo = m;
      }
      d = hi;
      const b = box(d);
      S.addScaledVector(right, ((b[0] + b[1]) / 2) * d * th).addScaledVector(upv, ((b[2] + b[3]) / 2) * d * tv);
    }
    return { x: S.x, y: S.y, z: S.z, az, el, fov, lh: Math.log(d * tv), lw: Math.log(d * th), lift: (ylo + yhi) / 2 };
  }
  function shot(name) {
    const p = portrait();
    switch (name) {
      case 'k1': { const v = ringTop(); return { x: v.x, y: v.y, z: v.z, az: AZ1 - 0.2, el: 0.12, lh: LN(0.2), lw: LN(p ? 0.17 : 0.2), fov: 30, lift: 0.04, tk: 0, hk: 0, breath: 0.35 }; }
      case 'k1b': { const v = ringTop(); return { x: v.x, y: v.y, z: v.z, az: AZ1 - 0.02, el: 0.1, lh: LN(0.25), lw: LN(p ? 0.21 : 0.25), fov: 30, lift: 0.04 }; }
      case 'k2': { const c = lantern || charms[0]; _v1.set(0, c.centerY, 0).applyMatrix4(c.body.matrixWorld); return { x: _v1.x, y: _v1.y + 0.04, z: _v1.z, az: AZ1 + 0.06, el: 0.03, lh: LN(0.47), lw: LN(p ? 0.34 : 0.47), fov: 28, lift: 0.06 }; }
      case 'k3': { const v = rings[0].P.pivot; return { x: v.x + 0.05, y: v.y - 0.6, z: v.z, az: AZ1 + 0.3, el: 0.07, lh: LN(0.88), lw: LN(p ? 0.62 : 0.88), fov: 30, lift: 0.0, breath: 0.45 }; }
      case 'k4': return { ...fitWide(p ? -0.46 : 0.3, 0.17, 34), breath: 1 };
      case 'k4b': return fitWide(p ? -0.3 : 0.06, 0.13, 34);
      // the whole hero keychain: its ring on the thread above, the bottle below
      case 'k6': { const v = heroRest(); return { x: v.x, y: v.y + 0.5, z: v.z, tk: 0.3, hk: 0, az: p ? -0.2 : -0.32, el: 0.02, lh: LN(p ? 1.1 : 0.94), lw: LN(p ? 0.56 : 0.9), fov: 30, lift: p ? 0.02 : 0.06, breath: 0.5 }; }
      case 'k7': return { hk: 0.36, az: p ? -0.3 : -0.42, el: 0.04, lh: LN(1.5), lw: LN(1.5), fov: 32, lift: 0.0 };
      default: return {};
    }
  }
  // where the hero bottle comes to rest once the thread has drawn it forward
  const heroRest = () => _v1.set(HERO_AT.x, HERO_AT.y - HANG - RING_R - (hero ? hero.P.L : 0.7), HERO_AT.z);
  const applyShot = (name) => Object.assign(cam, shot(name));
  const moveTo = (name, duration, ease = 'sine.inOut', extra = {}) => env.to(cam, { ...shot(name), duration, ease, overwrite: 'auto', ...extra });

  // the look at the start of a beat (also what a dev jump lands on)
  function stateAt(beat) {
    const i = Math.max(0, BEATS.indexOf(beat));
    Object.assign(W, {
      key: i >= 1 ? 1 : 0, haze: i >= 1 ? 1 : 0.15, fog: i >= 3 ? 1 : i >= 2 ? 0.35 : 0, front: i >= 2 ? 0 : 1, lantern: i >= 2 ? 1 : 0,
      thread: i >= 3 ? 1 : 0, ring: i >= 4 ? 1 : 0, width: i >= 4 ? 0.48 : 0.35, head: i >= 3 && i < 4 ? 1 : 0,
      hero: i >= 6 ? 1 : 0, fizz: i >= 6 ? 1 : 0, face: i >= 6 ? 1 : 0, breeze: i >= 3 ? 1 : 0,
      ...(i >= 6 ? { head: 0.55, ring: 0.85, width: 0.34 } : {}),
      motes: i >= 1 ? 1 : 0.25, bokeh: i >= 1 ? 1 : 0.35,
    });
    rings[0].yawOff = i >= 1 ? 0 : -0.95;   // (edge-on to the first close-up)
    T.s0 = 0;
    T.s1 = i >= 6 ? sRing[3] + 0.3 : i >= 4 ? sRest : i >= 3 ? sRing[0] + 0.55 : sRing[0] - 2.6;
    thread.k = i >= 6 ? 1 : 0;
    rings.forEach((rg) => { rg.tugged = T.s1 >= rg.s && W.thread > 0.3; });
    settleAll();
    trackInit = false;
    applyShot(['k1', 'k1b', 'k2', 'k3', 'k4b', 'k4b', 'k6'][i]);
    if (i >= 5) cam.az += 0.1;
  }

  // ---------------------------------------------------------------- choreography
  async function k1(dir) {
    stateAt('k1');
    jingleArmed = true;
    dir.veil(0, { duration: 2.6, color: '#05040c' });
    env.to(rings[0], { yawOff: 0, duration: 5.6, ease: 'sine.inOut' });
    env.to(W, { key: 1, duration: 3.4, delay: 0.7, ease: 'sine.inOut' });
    env.to(W, { haze: 1, motes: 1, bokeh: 1, duration: 4.5, ease: 'sine.inOut' });
    moveTo('k1b', 5.0);
    env.later(3.6, () => { if (jingleArmed) { jingleArmed = false; env.sfx('jingle'); env.sfx('shimmer'); } });
    await env.wait(4.7);
  }
  async function k2() {
    jingleArmed = false;
    moveTo('k2', 4.2);
    env.to(W, { front: 0, duration: 2.6, delay: 0.5, ease: 'sine.inOut' });
    env.to(W, { fog: 0.35, duration: 4.0, ease: 'sine.inOut' });
    env.to(W, { lantern: 1, duration: 2.6, delay: 1.0, ease: 'sine.inOut' });
    await env.wait(4.0);
  }
  async function k3() {
    T.s1 = Math.min(T.s1, sRing[0] - 2.6);
    env.to(W, { thread: 1, head: 1, duration: 0.8, ease: 'sine.out' });
    env.to(T, { s1: sRing[0] + 0.55, duration: 2.7, ease: 'sine.inOut' });
    env.to(W, { breeze: 1, duration: 3, delay: 1.8 });
    env.to(W, { fog: 1, duration: 5.5, delay: 0.6, ease: 'sine.inOut' });
    moveTo('k3', 3.8, 'sine.inOut');
    await env.wait(3.6);
  }
  async function k4() {
    env.to(T, { s1: sRest, duration: 6.5, ease: 'power1.inOut' });
    env.to(W, { ring: 1, head: 0, width: 0.48, duration: 2.6, delay: 4.2, ease: 'sine.inOut' });
    env.timeline().to(cam, { ...shot('k4'), duration: 4.6, ease: 'power2.inOut' }).to(cam, { ...shot('k4b'), duration: 6.5, ease: 'sine.inOut' });
    await env.wait(3.4);
  }
  async function k5() {
    const lines = (env.T.keychainLines || []).map((l) => env.fill(l)).filter(Boolean);
    env.to(cam, { az: '+=0.16', duration: 16, delay: 7.5, ease: 'sine.inOut' });
    if (lines.length) await env.narrate(lines, { style: 'hand' });
    else await env.wait(4);
  }
  async function k6() {
    W.hold = 1;
    env.to(thread, { k: 1, duration: 4.2, ease: 'sine.inOut' });
    env.to(W, { hold: 0, duration: 1.4, delay: 4.0, ease: 'sine.inOut' });
    env.to(T, { s1: sRing[3] + 0.3, duration: 4.2, ease: 'sine.inOut' });
    env.to(W, { head: 0.55, ring: 0.85, width: 0.34, duration: 1.6, delay: 2.0, ease: 'sine.inOut' });
    moveTo('k6', 4.4, 'power2.inOut');
    env.to(W, { face: 1, duration: 1.8, delay: 3.0, ease: 'sine.inOut' });
    env.to(W, { hero: 1, duration: 1.5, delay: 3.4, ease: 'sine.inOut' });
    env.to(W, { fizz: 1, duration: 1.0, delay: 3.8, ease: 'sine.out' });
    env.later(3.8, () => env.sfx('sparkle'));
    await env.wait(6.0);
  }
  async function k7(dir) {
    env.to(W, { ring: 0, head: 1, duration: 0.6, ease: 'sine.out' });
    env.to(T, { s1: pathA.length, duration: 2.4, ease: 'power2.in' });
    env.to(T, { s0: sRing[2], duration: 2.4, ease: 'power2.in' });
    moveTo('k7', 2.0, 'power2.in');
    env.to(W, { hero: 0.4, fizz: 0, duration: 1.6 });
    env.later(0.2, () => env.sfx('whoosh'));
    await env.wait(1.5);
    await dir.veil(1, { duration: 0.8, color: '#05040c' });
  }
  const BEAT_FN = { k1, k2, k3, k4, k5, k6, k7 };

  async function playReduced(dir, at) {
    // the same story in three gentle shots joined by soft veil cuts; nothing swings beyond a settle
    const calm = () => { W.breeze = 0; W.sway = 0.15; cam.breath = 0; };
    const lines = (env.T.keychainLines || []).map((l) => env.fill(l)).filter(Boolean);
    const start = at === 'k6' || at === 'k7' ? 2 : at && BEATS.indexOf(at) >= 3 ? 1 : 0;
    if (start === 0) {
      // the keyring, the lantern, the thread already through the ring
      stateAt('k4');
      calm();
      W.head = 0;
      W.front = 0.6;
      dir.veil(0, { duration: 1.2, color: '#05040c' });
      env.to(W, { front: 0, duration: 2.4, ease: 'sine.inOut' });
      await env.wait(1.1);
      env.sfx('jingle');
      await env.wait(1.6);
      await dir.veil(1, { duration: 0.6 });
    }
    if (start <= 1) {
      // the whole collection on the thread, while the words play
      stateAt('k5');
      calm();
      env.to(cam, { az: '+=0.05', duration: 14, ease: 'sine.inOut' });
      await env.wait(0.2);
      await dir.veil(0, { duration: 0.7 });
      if (lines.length) await env.narrate(lines, { style: 'hand' });
      else await env.wait(3);
      await dir.veil(1, { duration: 0.6 });
    }
    // the hero, drawn close, glowing
    stateAt('k7');
    calm();
    await env.wait(0.25);
    await dir.veil(0, { duration: 0.7 });
    env.sfx('sparkle');
    await env.wait(2.2);
    await dir.veil(1, { duration: 0.8, color: '#05040c' });
  }

  async function play(dir) {
    env.mood('wonder');
    const at = window.__LITTLE_DEV__ ? new URLSearchParams(location.search).get('at') : null;
    if (reduced) return playReduced(dir, at);
    let i = Math.max(0, BEATS.indexOf(at));
    if (i > 0) { stateAt(BEATS[i]); dir.veil(0, { duration: 0.5 }); }
    for (; i < BEATS.length; i++) await BEAT_FN[BEATS[i]](dir);
  }

  function dispose() {
    strand.dispose();
    links.dispose();
    key.shadow?.dispose();
    for (const x of own) { try { x.dispose(); } catch (e) { /* ignore */ } }
    own.clear();
    scene.clear();
  }

  // ---------------------------------------------------------------- initial pose (for the warm-up)
  stateAt('k1');
  // the warm-up sees the whole collection (every program, the shadow & transmission passes)
  Object.assign(cam, shot('k4b'));
  update(1 / 60, 0);
  stateAt('k1');
  return api;
}
