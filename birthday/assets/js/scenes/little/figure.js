// The stylized character of "What Makes You, You" — ONE module, used by the pani puri and the
// Manchuria scenes: a premium animated-film figurine of Deepu. A cartoon figurine of a real person,
// made with love by her best friend: dignified, cute, never mocked, never sexualised; not a
// photoreal face. (The fan-art photoshoot never uses a figure: it can only show the owner's own
// identity-checked fan-art image — no face of anyone is ever generated or stylized for it.)
//
// HER IDENTITY CUES (from her approved photos: hero, finale, story-2, story-5, name-deepu, hair-1,
// dance-5, letter-1): warm medium-light brown skin with a golden undertone (even-light cheek samples
// #c1886e #c38c73 #c58667 → albedo #c08467, never lightened); VERY long near-black hair with a warm
// brown sheen, straight with a soft wave toward the ends, a CENTER PART, worn loose — behind the
// shoulders with a front section falling over each shoulder; a soft oval face with full cheeks and a
// small rounded chin; large dark-brown almond eyes; dark, natural, softly arched brows; a small
// rounded nose; full lips with a natural rosy-brown tone and her usual gentle closed-lip smile. Her
// everyday clothes are printed kurtis (a wine-maroon floral one with puffed sleeves and a V neck is
// the one used here, in every scene) with cream leggings and soft gold-tan flats. No jewellery or
// features she doesn't have are invented.
//
//   const fig = createFigure(env, { quality })
//   fig.group                 THREE.Group — origin at the feet, +Z forward, ~1.6 units tall
//   fig.parts                 named joints: hips spine chest neck head jaw eyes browL browR mouth
//                             shoulderL/R (upper arm) elbowL/R (forearm) wristL/R (hand) handL/R (fingers)
//                             handSocketL/R hipL/R kneeL/R ankleL/R. A socket's frame: +Y along the
//                             fingers, +Z out of the palm, origin where a small held thing sits.
//   fig.materials             { skin, cloth, hair } (MeshPhysical on quality ≥ 1, MeshStandard on 0)
//   fig.update(dt, t)         every frame: breathing, weight shift, blinks, saccades, gaze, IK, hair
//   fig.lookAt(worldPos|null, speed = 4)            eyes lead, head and neck follow; null = idle gaze
//   fig.reach(side, worldPos|null, k = 1, speed=1)  side 'L'|'R': eased two-bone IK, the SOCKET goes to
//                                                    the point (elbow down/out, natural wrist); k blends
//   fig.hold(side, object3D|null, { snap, align })  parents to the hand socket (keeps its world pose,
//                                                    then settles into the palm); null releases it
//   fig.expression(name, k = 1)  'neutral' | 'smile' | 'delight' | 'surprise' | 'chew' | 'mouthOpen'
//   fig.blush(k)
//   fig.pose(name, k = 1, { seat, side })  'stand' | 'sit' (seat = seat-top height, default 0.43)
//                                           | 'lean' | 'photo' (side ±1 mirrors the turn)
//   fig.walk(k, speed)        bonus: an in-place walk cycle (move fig.group yourself at `speed` u/s)
//   fig.settle(sec)           snap every eased value to its target and let the hair come to rest
//   fig.mouthWorld(out), fig.socketWorld(side, out), fig.wind (0…1), fig.stats, fig.dispose()
//   fig.uniforms.fSkinFill    the skin's soft subsurface-like warmth (default 0.07)
// Budgets (measured): q2 40.0k / q1 25.7k / q0 15.6k triangles;
// 4 meshes = 4 draw calls, plus the skin and cloth in shadow passes (each with a depth material of
// its own, so the pass never switches program variants). The hair casts no shadow (it receives
// them). update() creates no objects, arrays or closures.
// How it's built: one skinned skin mesh (head with the face painted in its shader: eyes, brows,
// mouth, blush, beard), one skinned cloth mesh (with a 'sit' morph target so the garment lies on the
// lap), a sculpted hair cap on the head bone and one dynamic mesh for the hair (verlet chains with
// head / shoulder / back / face colliders; long hair = a lofted curtain + layered sub-locks).
// Everything (geometry, materials, textures) is created in createFigure(); call it from build().
import * as THREE from 'three';
import { clamp, lerp, damp, smooth, rng } from './kit.js';

const TAU = Math.PI * 2;
const XAXIS = new THREE.Vector3(1, 0, 0);
const YAXIS = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ skeleton
export const BONE_NAMES = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'jaw',
  'shoulderL', 'elbowL', 'wristL', 'handL', 'shoulderR', 'elbowR', 'wristR', 'handR',
  'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR'];
const B = {};
BONE_NAMES.forEach((n, i) => { B[n] = i; });
const PARENT = [-1, 0, 1, 2, 3, 4, 5, 3, 7, 8, 9, 3, 11, 12, 13, 1, 15, 16, 1, 18, 19];

// ------------------------------------------------------------------ the two characters
// Joint positions (figure space, bind pose: arms hanging straight down, identity rotations).
// Ring tables: [y, half-width, half-depth front, half-depth back, z-centre] — the body's lathe.
const DEEPU = {
  who: 'deepu',
  height: 1.6,
  J: {
    hips: [0, 0.86, 0], spine: [0, 0.985, -0.006], chest: [0, 1.11, -0.012], neck: [0, 1.262, -0.014],
    head: [0, 1.316, -0.01], jaw: [0, 1.406, -0.004],
    shoulder: [0.16, 1.212, -0.012], elbow: [0.163, 0.968, -0.016], wrist: [0.164, 0.745, -0.01], hand: [0.164, 0.685, -0.01],
    hip: [0.077, 0.838, 0], knee: [0.08, 0.456, 0.006], ankle: [0.082, 0.074, -0.016],
  },
  head: { R: 0.124, c: [0, 0.128, 0.018], width: 0.925, depth: 1.0, chin: 0.14, taper: 0.09, cheeks: 0.16, nose: 0.072, noseY: -0.36, lips: 0.03, back: 0.05, beard: 0, ears: false },
  // eye [x, y, half-width, half-height] · brow [x, y, thickness, arch] · mouth [y, half-width]
  face: { eye: [0.355, -0.12, 0.178, 0.128], brow: [0.37, 0.085, 1.5, 0.9], mouth: [-0.62, 0.185], iris: '#3f2416', ink: '#1a100c', lip: '#a35a52', blush: '#ff8f8f', baseBlush: 0.16, rest: 0.5, beard: 0 },
  skin: '#be876c', sheen: '#ffb39a',
  arm: { r: [0.046, 0.04, 0.0385, 0.0275] },
  leg: { r: [0.064, 0.05, 0.049, 0.031] },
  hand: 1.08,
  torso: [
    [0.40, 0.205, 0.142, 0.146, 0.0], [0.50, 0.192, 0.134, 0.138, 0.0], [0.62, 0.175, 0.124, 0.127, 0.0],
    [0.72, 0.160, 0.114, 0.118, -0.004], [0.80, 0.150, 0.103, 0.110, -0.006], [0.87, 0.143, 0.095, 0.102, -0.008],
    [0.93, 0.128, 0.086, 0.088, -0.008], [0.99, 0.114, 0.081, 0.077, -0.006], [1.05, 0.122, 0.089, 0.077, -0.004],
    [1.10, 0.137, 0.099, 0.080, -0.004], [1.15, 0.146, 0.095, 0.084, -0.008], [1.20, 0.150, 0.084, 0.084, -0.012],
    [1.232, 0.141, 0.072, 0.075, -0.014], [1.258, 0.113, 0.061, 0.064, -0.014], [1.279, 0.076, 0.053, 0.056, -0.012],
    [1.294, 0.058, 0.051, 0.054, -0.011],
  ],
  neck: [[1.31, 0.054, 0.05, 0.053, -0.011], [1.345, 0.0505, 0.047, 0.05, -0.009], [1.42, 0.049, 0.046, 0.049, -0.005]],
  hem: 0.40,
  top: 1.29,
  // the neckline: height of the garment's top edge at angle a = |θ| from the front
  neckline: (a) => (a < 0.6 ? lerp(1.135, 1.262, smooth(0, 0.6, a) ** 0.85) : lerp(1.262, 1.252, smooth(0.6, Math.PI, a))),
  outfit: 'kurti',
  hairStyle: 'long',
  hairColor: '#171110', hairTip: '#221714', hairSheen: '#4a3226',
};

// ------------------------------------------------------------------ poses
// Body numbers per pose (added to the bind pose): hips dx dy dz rx ry rz · spine rx ry rz · chest rx ry rz ·
// neck rx ry rz · head rx ry rz · ankle targets L x y z yaw · R x y z yaw · knee-out · finger curl.
const PN = 28;
const I_FOOTL = 18, I_FOOTR = 22, I_KNEE = 26, I_CURL = 27;
const POSES = ['stand', 'sit', 'lean', 'photo'];
function poseTable(S, name, seat, side) {
  const o = new Float32Array(PN);
  const fx = S.J.ankle[0] + 0.006, fy = S.J.ankle[1], hy = S.J.hips[1];
  const set = (i, ...v) => { v.forEach((x, k) => { o[i + k] = x; }); };
  if (name === 'stand') {
    set(0, 0, -0.004, 0, 0, 0, 0); set(9, -0.02, 0, 0); set(12, 0.03, 0, 0);
    set(I_FOOTL, fx, fy, 0.0, 0.1); set(I_FOOTR, -fx, fy, 0.0, -0.1); o[I_KNEE] = 0.2; o[I_CURL] = 0.28;
  } else if (name === 'sit') {
    const k = S.J.knee[1] - S.J.ankle[1];
    set(0, 0, seat + 0.064 - hy, -0.03, -0.04, 0, 0); set(6, 0.03, 0, 0); set(9, -0.01, 0, 0); set(12, 0.02, 0, 0); set(15, 0.02, 0, 0);
    const fz = Math.max(0.12, (S.J.hips[1] - S.J.knee[1]) - 0.06);
    set(I_FOOTL, fx + 0.016, Math.min(fy, seat + 0.03 - k + fy), fz, 0.12); set(I_FOOTR, -fx - 0.016, Math.min(fy, seat + 0.03 - k + fy), fz, -0.12);
    o[I_KNEE] = 0.25; o[I_CURL] = 0.2;
  } else if (name === 'lean') {
    set(0, 0, -0.008, -0.035, 0.03, 0, 0); set(6, 0.1, 0, 0); set(9, 0.12, 0, 0); set(12, -0.06, 0, 0); set(15, -0.1, 0, 0);
    set(I_FOOTL, fx, fy, 0.0, 0.1); set(I_FOOTR, -fx, fy, 0.0, -0.1); o[I_KNEE] = 0.2; o[I_CURL] = 0.3;
  } else if (name === 'photo') {
    set(0, 0.012 * side, -0.007, 0, 0, 0.26 * side, 0.035 * side); set(6, 0, -0.06 * side, -0.02 * side); set(9, -0.035, -0.1 * side, -0.01 * side);
    set(12, 0.02, -0.05 * side, 0.03 * side); set(15, 0.02, -0.07 * side, 0.07 * side);
    const a = side > 0 ? I_FOOTL : I_FOOTR, b = side > 0 ? I_FOOTR : I_FOOTL;
    set(a, side * (fx - 0.035), fy, 0.05, 0.45 * side); set(b, -side * (fx + 0.015), fy, -0.02, 0.28 * side);
    o[I_KNEE] = 0.2; o[I_CURL] = 0.5;
  }
  return o;
}
// Arm goals per pose, for the left arm (the right one mirrors x): mode 'hang' = relaxed under the shoulder
// (target relative to the shoulder, gravity-down), 'hips' = in the hips frame. Palm / pole: directions.
function armGoal(S, name, side, seat) {
  const sh = S.J.shoulder, hp = S.J.hips;
  const len = (S.J.shoulder[1] - S.J.wrist[1]) + 0.035 * S.hand;
  if (name === 'sit') return { mode: 'hips', t: [0.09, seat * 0 + 0.075, 0.2 + (S.J.hips[1] - 0.86) * 0.5], palm: [-0.25, -1, 0.1], pole: [0.7, -0.4, -0.8], curl: 0.2 };
  // a relaxed, easy stance: arms loose at the sides, elbows softly bent, hands a little forward
  if (name === 'photo' && S.photoArms === 'hang') return { mode: 'hang', t: [0.022, -((S.J.shoulder[1] - S.J.wrist[1]) - 0.005 * S.hand), 0.125], palm: [-1, 0.1, 0.05], pole: [0.3, -0.25, -1], curl: 0.5 };
  if (name === 'photo') {
    const L = side > 0;
    return { mode: 'hips', t: L ? [0.022, -0.08 + (sh[1] - 1.214) * 0.4, 0.13] : [0.026, -0.098 + (sh[1] - 1.214) * 0.4, 0.14], tR: L ? [-0.026, -0.098 + (sh[1] - 1.214) * 0.4, 0.14] : [-0.022, -0.08 + (sh[1] - 1.214) * 0.4, 0.13], palm: [-1, 0.15, -0.55], pole: [0.9, -0.45, -0.8], curl: 0.5 };
  }
  void hp;
  return { mode: 'hang', t: [0.032, -len, name === 'lean' ? 0.1 : 0.085], palm: [-1, 0.05, -0.15], pole: [0.35, -0.2, -1], curl: 0.3 };
}

// Face presets: open happy lower browY browIn smile mOpen mWide mRound jaw cheek puff
const EXPRS = ['neutral', 'smile', 'delight', 'surprise', 'chew', 'mouthOpen'];
const EX = {
  neutral: [1, 0, 0.12, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  smile: [0.86, 0, 0.5, 0.05, 0, 1, 0.16, 1.12, 0, 0.025, 0.14, 0],
  delight: [0, 1, 0.65, 0.2, 0.08, 1, 0.55, 1.18, 0, 0.085, 0.38, 0],
  surprise: [1.28, 0, 0, 0.55, 0.28, -0.15, 0.85, 0.9, 1, 0.12, 0.05, 0],
  chew: [0.9, 0, 0.32, 0.04, 0, 0.55, 0, 0.82, 0, 0, 0.16, 1],
  mouthOpen: [1.05, 0, 0.1, 0.2, 0.06, 0.15, 1, 0.92, 0.55, 0.24, 0.05, 0],
};
// the presets as rows in EXPRS order, and the per-frame accumulator (update() allocates nothing)
const EX_ROWS = EXPRS.map((n) => EX[n]);
const FACC = new Float32Array(12);

// ------------------------------------------------------------------ mesh building (build time only)
class Mesher {
  constructor() { this.p = []; this.n = []; this.uv = []; this.si = []; this.sw = []; this.f = []; this.c = []; this.t = []; this.ix = []; }
  get size() { return this.p.length / 3; }
}
// weight accumulator: up to 4 influences, normalised
const WT = {
  i: new Int32Array(8), w: new Float32Array(8), n: 0,
  reset() { this.n = 0; return this; },
  add(b, w) {
    if (!(w > 1e-4)) return this;
    for (let k = 0; k < this.n; k++) if (this.i[k] === b) { this.w[k] += w; return this; }
    if (this.n < 8) { this.i[this.n] = b; this.w[this.n] = w; this.n++; }
    return this;
  },
  push(M) {
    const idx = [0, 0, 0, 0], wt = [0, 0, 0, 0];
    const used = new Array(this.n).fill(false);
    let sum = 0;
    for (let s = 0; s < 4; s++) {
      let best = -1;
      for (let k = 0; k < this.n; k++) if (!used[k] && (best < 0 || this.w[k] > this.w[best])) best = k;
      if (best < 0) break;
      used[best] = true; idx[s] = this.i[best]; wt[s] = this.w[best]; sum += wt[s];
    }
    if (sum <= 0) { idx[0] = 0; wt[0] = 1; sum = 1; }
    M.si.push(...idx); M.sw.push(wt[0] / sum, wt[1] / sum, wt[2] / sum, wt[3] / sum);
  },
};

const _ga = new THREE.Vector3(), _gb = new THREE.Vector3(), _gc = new THREE.Vector3(), _gd = new THREE.Vector3();
const _gn = new THREE.Vector3(), _gi = new THREE.Vector3();
/**
 * A parametric surface (u around, v along) added to a mesher. o: { nu, nv, wrapU, pos(u,v,out),
 * inside(u,v,p,out) (a point inside, to orient normals), skin(p,u,v) → fills WT, uv(u,v,p) → [U,V],
 * face(p) → [4], color(p,u,v) → [3], tangent(p,u,v,n) → [3], keep(i,j) → bool }.
 */
function grid(M, o) {
  const base = M.size;
  const { nu, nv } = o;
  const e = 1e-3;
  const Ps = [], Ns = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      o.pos(u, v, _ga);
      const u0 = o.wrapU ? u - e : Math.max(0, u - e), u1 = o.wrapU ? u + e : Math.min(1, u + e);
      const v0 = Math.max(0, v - e), v1 = Math.min(1, v + e);
      o.pos(u1, v, _gb); o.pos(u0, v, _gc); _gb.sub(_gc);
      o.pos(u, v1, _gc); o.pos(u, v0, _gd); _gc.sub(_gd);
      _gn.crossVectors(_gb, _gc);
      o.inside(u, v, _ga, _gi);
      _gd.subVectors(_ga, _gi);
      if (_gn.lengthSq() < 1e-16) _gn.copy(_gd);
      _gn.normalize();
      if (_gn.dot(_gd) < 0) _gn.negate();
      M.p.push(_ga.x, _ga.y, _ga.z); M.n.push(_gn.x, _gn.y, _gn.z);
      Ps.push(_ga.x, _ga.y, _ga.z); Ns.push(_gn.x, _gn.y, _gn.z);
      const uv = o.uv ? o.uv(u, v, _ga) : [u, v];
      M.uv.push(uv[0], uv[1]);
      if (o.skin) { WT.reset(); o.skin(_ga, u, v); WT.push(M); }
      if (o.face) M.f.push(...o.face(_ga));
      if (o.color) M.c.push(...o.color(_ga, u, v));
      if (o.tangent) M.t.push(...o.tangent(_ga, u, v, _gn), 1);
    }
  }
  const row = nu + 1;
  const P = (k, out) => out.set(Ps[k * 3], Ps[k * 3 + 1], Ps[k * 3 + 2]);
  const tri = (a, b, c) => {
    P(a, _ga); P(b, _gb); P(c, _gc);
    _gb.sub(_ga); _gc.sub(_ga); _gn.crossVectors(_gb, _gc);
    if (_gn.lengthSq() < 1e-14) return;
    const nx = Ns[a * 3] + Ns[b * 3] + Ns[c * 3], ny = Ns[a * 3 + 1] + Ns[b * 3 + 1] + Ns[c * 3 + 1], nz = Ns[a * 3 + 2] + Ns[b * 3 + 2] + Ns[c * 3 + 2];
    if (_gn.x * nx + _gn.y * ny + _gn.z * nz >= 0) M.ix.push(base + a, base + b, base + c);
    else M.ix.push(base + a, base + c, base + b);
  };
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      if (o.keep && !o.keep(i, j)) continue;
      const a = j * row + i, b = a + 1, c = a + row + 1, d = a + row;
      tri(a, b, c); tri(a, c, d);
    }
  }
}

function toGeometry(M, { skinned = true, face = false, color = false, tangent = false } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(M.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(M.n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(M.uv, 2));
  if (skinned) {
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(M.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(M.sw, 4));
  }
  if (face) g.setAttribute('aFace', new THREE.Float32BufferAttribute(M.f, 4));
  if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(M.c, 3));
  if (tangent) g.setAttribute('tangent', new THREE.Float32BufferAttribute(M.t, 4));
  g.setIndex(M.ix);
  return g;
}

// ring table interpolation (Catmull-Rom over the rows)
const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
const RING = new Float64Array(5);
function ringAt(T, y) {
  const n = T.length;
  if (y <= T[0][0]) { for (let c = 0; c < 5; c++) RING[c] = T[0][c]; RING[0] = y; return RING; }
  if (y >= T[n - 1][0]) { for (let c = 0; c < 5; c++) RING[c] = T[n - 1][c]; RING[0] = y; return RING; }
  let k = 0;
  while (k < n - 2 && y > T[k + 1][0]) k++;
  const t = (y - T[k][0]) / (T[k + 1][0] - T[k][0]);
  const a = T[Math.max(0, k - 1)], b = T[k], c2 = T[k + 1], d = T[Math.min(n - 1, k + 2)];
  RING[0] = y;
  for (let c = 1; c < 5; c++) RING[c] = cr(a[c], b[c], c2[c], d[c], t);
  return RING;
}
function latheAt(T, theta, y, inset, out) {
  const R = ringAt(T, y);
  const c = Math.cos(theta), s = Math.sin(theta);
  const rz = lerp(R[3], R[2], smooth(-0.35, 0.35, c)) - inset;
  return out.set(s * (R[1] - inset), y, R[4] + c * rz);
}

/** A tapered capsule from a to b (radii ra → rb), optional per-t radius, caps, cross-section scale. */
function limb(M, a, b, ra, rb, o) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
  const d = new THREE.Vector3().subVectors(Bv, A);
  const L = d.length(); d.normalize();
  const ref = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const e1 = new THREE.Vector3().crossVectors(ref, d).normalize();
  if (o.flipE1) e1.negate();
  const e2 = new THREE.Vector3().crossVectors(d, e1).normalize();
  const capA = o.capA !== false, capB = o.capB !== false;
  const vA = capA ? 0.2 : 0, vB = capB ? 0.8 : 1;
  const sx = o.sx || 1, sz = o.sz || 1;
  const prof = (v, out) => { // out: [axial, radius]
    if (v < vA) { const ph = (v / vA - 1) * Math.PI / 2; out[0] = ra * Math.sin(ph); out[1] = ra * Math.cos(ph); return; }
    if (v > vB) { const ph = ((v - vB) / (1 - vB)) * Math.PI / 2; out[0] = L + rb * Math.sin(ph); out[1] = rb * Math.cos(ph); return; }
    const t = (v - vA) / Math.max(1e-6, vB - vA);
    out[0] = t * L; out[1] = o.radius ? o.radius(t) : lerp(ra, rb, t);
  };
  const pr = [0, 0];
  grid(M, {
    nu: o.nu || 16, nv: o.nv || 16, wrapU: true,
    pos(u, v, out) {
      prof(clamp(v, 0, 1), pr);
      const ps = u * TAU;
      let r = pr[1];
      if (o.ripple) r *= 1 + o.ripple(ps, clamp(v, 0, 1));
      out.copy(A).addScaledVector(d, pr[0]).addScaledVector(e1, Math.cos(ps) * r * sx).addScaledVector(e2, Math.sin(ps) * r * sz);
      if (o.post) o.post(out);
    },
    inside(u, v, p, out) { prof(clamp(v, 0, 1), pr); out.copy(A).addScaledVector(d, clamp(pr[0], 0, L)); if (o.post) o.post(out); },
    skin: o.skin, uv: o.uv ? (u, v, p) => o.uv(u, v, p) : null, face: o.face, color: o.color,
  });
}

/** A thin tube along a closed or open curve (trims, cuffs). curve(s, outP, outN) gives point + outward normal. */
function tube(M, curve, o) {
  const P = new THREE.Vector3(), N = new THREE.Vector3(), P2 = new THREE.Vector3(), T = new THREE.Vector3(), Bn = new THREE.Vector3();
  grid(M, {
    nu: o.m || 6, nv: o.n || 64, wrapU: true,
    pos(u, v, out) {
      const s = o.closed ? v : clamp(v, 0, 1);
      curve(s, P, N);
      curve(s + 1e-3, P2, Bn);
      T.subVectors(P2, P).normalize();
      Bn.crossVectors(T, N).normalize();
      N.crossVectors(Bn, T).normalize();
      const ps = u * TAU;
      out.copy(P).addScaledVector(N, Math.cos(ps) * o.r).addScaledVector(Bn, Math.sin(ps) * o.r * (o.flat || 1));
    },
    inside(u, v, p, out) { curve(o.closed ? v : clamp(v, 0, 1), out, N); },
    skin: o.skin, uv: o.uv,
  });
}

// ------------------------------------------------------------------ textures (canvas, build time)
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d') }; }
// atlas rows (v): print 0..800 px, trims/solids below
const ATLAS = { trim: 1 - 832 / 1024, legs: 1 - 896 / 1024, shoe: 1 - 944 / 1024, sole: 1 - 1008 / 1024, collar: 1 - 832 / 1024 };
const printV = (S, y) => 1 - (10 + ((S.top - y) / (S.top - S.hem + 0.01)) * 780) / 1024;

function paintKurti(R) {
  const { c, g } = canvas(1024, 1024);
  g.fillStyle = '#621b30'; g.fillRect(0, 0, 1024, 800);
  // a faint woven texture
  for (let y = 0; y < 800; y += 3) { g.fillStyle = `rgba(255,220,220,${0.015 + R() * 0.02})`; g.fillRect(0, y, 1024, 1); }
  const K = 0.63; // the bodice's v-density vs u-density: draw squashed so motifs look round on the body
  const wrap = (x, fn) => { fn(x); if (x < 80) fn(x + 1024); if (x > 944) fn(x - 1024); };
  const blossom = (x, y, s, petal, centre) => {
    g.save(); g.translate(x, y); g.scale(1, K); g.rotate(R() * TAU);
    g.fillStyle = petal;
    for (let i = 0; i < 5; i++) { g.rotate(TAU / 5); g.beginPath(); g.ellipse(0, -s * 0.48, s * 0.3, s * 0.46, 0, 0, TAU); g.fill(); }
    g.fillStyle = centre; g.beginPath(); g.arc(0, 0, s * 0.22, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,240,220,0.6)'; g.beginPath(); g.arc(-s * 0.06, -s * 0.06, s * 0.07, 0, TAU); g.fill();
    g.restore();
  };
  const leaf = (x, y, s, a, col) => {
    g.save(); g.translate(x, y); g.scale(1, K); g.rotate(a);
    g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.45, -s * 0.35, s, 0); g.quadraticCurveTo(s * 0.45, s * 0.35, 0, 0); g.fill();
    g.strokeStyle = 'rgba(60,20,20,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(s * 0.1, 0); g.lineTo(s * 0.85, 0); g.stroke();
    g.restore();
  };
  const cols = 15, rows = 18;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = ((i + (j % 2) * 0.5) / cols) * 1024 + (R() - 0.5) * 30;
      const y = 30 + (j / rows) * 760 + (R() - 0.5) * 20;
      const s = 15 + R() * 6;
      const pet = R() < 0.7 ? '#dcc2a4' : '#c98b90';
      const cen = pet === '#dcc2a4' ? '#b5646c' : '#e6d0b4';
      wrap(x, (xx) => {
        const a = R() * TAU;
        leaf(xx + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.35, s * 0.85, a, '#a8805a');
        leaf(xx + Math.cos(a + 2.4) * s * 0.55, y + Math.sin(a + 2.4) * s * 0.35, s * 0.7, a + 2.4, '#836544');
        blossom(xx, y, s, pet, cen);
      });
      // tiny buds between motifs
      const bx = x + 1024 / cols * 0.5, by = y + 760 / rows * 0.5;
      wrap(bx % 1024, (xx) => { g.fillStyle = R() < 0.5 ? '#c98f93' : '#d8c0a2'; g.beginPath(); g.ellipse(xx, by, 3, 3 * K, 0, 0, TAU); g.fill(); });
    }
  }
  // trims (cream-gold with tiny dots), leggings (cream knit), flats (gold-tan), soles
  g.fillStyle = '#e2c48c'; g.fillRect(0, 800, 1024, 64);
  for (let x = 4; x < 1024; x += 12) { g.fillStyle = '#b8894a'; g.beginPath(); g.arc(x, 832, 2.4, 0, TAU); g.fill(); }
  g.fillStyle = '#e6d6be'; g.fillRect(0, 864, 1024, 64);
  for (let x = 0; x < 1024; x += 4) { g.fillStyle = `rgba(150,120,90,${0.04 + R() * 0.04})`; g.fillRect(x, 864, 1, 64); }
  const sg = g.createLinearGradient(0, 928, 0, 992); sg.addColorStop(0, '#c99d5c'); sg.addColorStop(1, '#a87a3e');
  g.fillStyle = sg; g.fillRect(0, 928, 1024, 64);
  for (let x = 8; x < 1024; x += 22) { g.fillStyle = 'rgba(255,236,190,0.55)'; g.beginPath(); g.arc(x, 960, 3, 0, TAU); g.fill(); }
  g.fillStyle = '#4a3123'; g.fillRect(0, 992, 1024, 32);
  return c;
}

function paintJacket(R) {
  const { c, g } = canvas(1024, 1024);
  // u around the torso: front = 0.5; the shirt shows between the open jacket fronts
  g.fillStyle = '#bfa67c'; g.fillRect(0, 0, 1024, 800);
  for (let y = -1024; y < 800; y += 5) { g.strokeStyle = `rgba(90,70,40,${0.05 + R() * 0.03})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y + 1024); g.stroke(); }
  // shirt band (wider at the top: the open collar)
  const cx = 512;
  g.fillStyle = '#eef0f2';
  g.beginPath(); g.moveTo(cx - 52, 0); g.lineTo(cx + 52, 0); g.lineTo(cx + 34, 330); g.lineTo(cx + 30, 800); g.lineTo(cx - 30, 800); g.lineTo(cx - 34, 330); g.closePath(); g.fill();
  // a soft shadow under the jacket edges
  g.strokeStyle = 'rgba(60,45,25,0.35)'; g.lineWidth = 6;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 52, 0); g.lineTo(cx + s * 34, 330); g.lineTo(cx + s * 30, 800); g.stroke(); }
  // lapel lines
  g.strokeStyle = 'rgba(80,60,35,0.45)'; g.lineWidth = 3;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 52, 0); g.lineTo(cx + s * 110, 60); g.lineTo(cx + s * 40, 300); g.stroke(); }
  // shirt placket + buttons
  g.strokeStyle = 'rgba(150,160,170,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, 90); g.lineTo(cx, 800); g.stroke();
  for (let y = 150; y < 800; y += 120) { g.fillStyle = '#d7dadd'; g.beginPath(); g.arc(cx, y, 5, 0, TAU); g.fill(); }
  // pockets
  g.strokeStyle = 'rgba(80,60,35,0.22)'; g.lineWidth = 2;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 150 - 40, 600); g.lineTo(cx + s * 150 + 40, 600); g.stroke(); }
  // a hem band
  g.fillStyle = 'rgba(90,70,40,0.25)'; g.fillRect(0, 770, 1024, 30);
  // solids: shirt collar/cuffs (white) · trousers (navy) · shoes (brown) · soles
  g.fillStyle = '#eceff2'; g.fillRect(0, 800, 1024, 64);
  g.fillStyle = '#2b3450'; g.fillRect(0, 864, 1024, 64);
  for (let x = 0; x < 1024; x += 3) { g.fillStyle = `rgba(255,255,255,${0.02 + R() * 0.03})`; g.fillRect(x, 864, 1, 64); }
  const sg = g.createLinearGradient(0, 928, 0, 992); sg.addColorStop(0, '#6e4630'); sg.addColorStop(1, '#4e2f1e');
  g.fillStyle = sg; g.fillRect(0, 928, 1024, 64);
  g.fillStyle = '#2a1c14'; g.fillRect(0, 992, 1024, 32);
  return c;
}

function paintHair(R) {
  const { c, g } = canvas(128, 512);
  g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 260; i++) {
    const x = R() * 128, w = 0.6 + R() * 1.6, b = 165 + R() * 90;
    g.strokeStyle = `rgba(${b},${b},${b},${0.3 + R() * 0.45})`; g.lineWidth = w;
    g.beginPath();
    const ph = R() * TAU;
    for (let y = -8; y <= 520; y += 16) { const xx = x + Math.sin(y * 0.02 + ph) * 2.5; if (y < 0) g.moveTo(xx, y); else g.lineTo(xx, y); }
    g.stroke();
    // wrap horizontally
  }
  return c;
}

// ------------------------------------------------------------------ the face (skin shader patch)
const FACE_PARS = /* glsl */`
uniform vec4 fEyeL; uniform vec4 fEyeR; uniform vec4 fLook; uniform vec4 fBrow; uniform vec4 fMouth; uniform vec4 fMisc;
uniform vec4 fLayE; uniform vec4 fLayB; uniform vec4 fLayM;
uniform vec3 fIris; uniform vec3 fInk; uniform vec3 fLip; uniform vec3 fBlushC; uniform vec3 fBeardC;
uniform float fSkinFill;
varying vec4 vFace;
float fPx = 0.0; // one screen pixel in face units (features never get thinner than ~1 px)
float faceGloss = 0.0;
float faceMatte = 0.0;
float fFill(float d) { float w = max(fwidth(d), 1e-5) * 0.85; return 1.0 - smoothstep(-w, w, d); }
float fHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fNoise(vec2 p) {
  vec2 i = floor(p), u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), u.x), mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float ss(float a, float b, float x) { return a < b ? smoothstep(a, b, x) : 1.0 - smoothstep(b, a, x); }
// a full, groomed beard: the cheek line sweeps from the sideburns down to the mouth corners; a moustache
// whose ends droop to join it; a clean skin margin round the lips (mirrored in beardMaskJS for the sculpt)
float beardMask(vec3 f) {
  float ax = abs(f.x);
  float yb = mix(-0.62, -0.06, ss(0.34, 0.95, ax)) + 0.05 * ss(0.6, 0.95, ax) * ss(0.1, -0.3, f.z);
  float zb = mix(0.16, -0.3, ss(-0.5, -0.95, f.y));
  float m = ss(yb + 0.04, yb - 0.09, f.y) * ss(zb - 0.08, zb + 0.05, f.z);
  float W = fLayM.y;
  float u = ax / (W * 1.45);
  float yc = fLayM.x + 0.105 - 0.075 * u * u;
  float ht = 0.05 * (1.0 - 0.45 * u);
  float must = ss(ht + 0.02, ht - 0.015, abs(f.y - yc)) * ss(1.15, 0.9, u) * ss(0.15, 0.45, f.z);
  m = max(m, must);
  float lips = length(vec2(f.x / (W * 1.08), (f.y - fLayM.x + 0.01) / 0.085));
  return clamp(m * ss(0.9, 1.12, lips), 0.0, 1.0);
}
float lidTop(float x, float H, float W, float o1, float wide) {
  float e = max(1.0 - x * x, 0.0);
  float yOpen = H * pow(e, 0.5) + 0.09 * x * W + wide * H * 0.55 * e;
  float yClose = -H * 0.42 * pow(e, 0.8) + 0.04 * x * W;
  return mix(yClose, yOpen, o1);
}
vec3 faceEye(vec3 col, vec2 f, float s, vec4 E) {
  vec2 c = vec2(s * fLayE.x, fLayE.y);
  vec2 q = f - c; q.x *= s;
  float W = fLayE.z, H = fLayE.w;
  float x = q.x / W;
  float ax = clamp(x, -1.0, 1.0);
  float e = max(1.0 - ax * ax, 0.0);
  float open = clamp(E.x, 0.0, 1.5);
  float o1 = min(open, 1.0), wide = max(open - 1.0, 0.0);
  float happy = E.y;
  float yT = lidTop(ax, H, W, o1, wide);
  float yClose = -H * 0.42 * pow(e, 0.8) + 0.04 * ax * W;
  float yLow = -H * 0.8 * pow(e, 0.7) + E.z * H * 0.36 * e - wide * H * 0.12 * e;
  float yB = mix(yClose, yLow, o1);
  float inside = fFill(q.y - yT) * fFill(yB - q.y) * fFill(abs(q.x) - W) * (1.0 - happy) * smoothstep(0.0, 0.08, yT - yB);
  // sclera, a soft lid shadow, the iris (dark brown, lighter at the bottom), the pupil, two catchlights
  vec3 sclera = vec3(0.93, 0.885, 0.85) * (0.82 + 0.18 * e);
  sclera *= 1.0 - 0.32 * smoothstep(yT - 0.55 * H, yT + 0.05 * H, q.y);
  vec2 ic = c + fLook.xy + vec2(0.0, -0.06 * H);
  float ri = H * 0.84;
  vec2 iq = (f - ic) / ri;
  float rr = length(iq);
  vec3 irisC = mix(fIris * 0.42, fIris * 1.18, smoothstep(1.0, 0.25, rr));
  irisC = mix(irisC, fIris * 2.1, smoothstep(0.05, 0.85, -iq.y) * smoothstep(1.0, 0.45, rr) * 0.5);
  irisC = mix(irisC, vec3(0.02, 0.012, 0.01), fFill(rr - 0.44 * fLook.z));
  irisC *= 1.0 - 0.35 * smoothstep(yT - 0.5 * H, yT, q.y);
  vec3 eyeC = mix(sclera, irisC, fFill(rr - 1.0));
  vec2 h1 = c + vec2(-0.26 * W, 0.3 * H) + fLook.xy * 0.55;
  vec2 h2 = c + vec2(0.24 * W, -0.32 * H) + fLook.xy * 0.55;
  float hl = fFill(length(f - h1) - 0.17 * H) + 0.75 * fFill(length(f - h2) - 0.075 * H);
  eyeC = mix(eyeC, vec3(1.0, 0.98, 0.96), clamp(hl, 0.0, 1.0) * 0.95);
  col = mix(col, eyeC, inside);
  faceGloss = max(faceGloss, inside);
  // crease (a faint line above the lid) and the lower lash line
  float crease = fFill(abs(q.y - (yT + H * 0.46)) - H * 0.03) * fFill(abs(q.x) - W * 0.82) * o1 * (1.0 - happy);
  col = mix(col, col * 0.72, crease * 0.35);
  float low = fFill(abs(q.y - yB) - H * 0.035) * smoothstep(-0.7, 0.1, x) * fFill(abs(q.x) - W) * o1 * (1.0 - happy);
  col = mix(col, fInk, low * 0.45);
  // the upper lash line, thicker toward the outer corner, with a tiny flick
  float th = max(H * (0.15 + 0.12 * smoothstep(-0.3, 1.0, x)) * (1.0 - 0.3 * fMisc.w), fPx * 1.5);
  float lash = fFill(max(q.y - (yT + th * 0.85), (yT - th * 0.2) - q.y)) * fFill(abs(q.x) - W * 1.02);
  vec2 p0 = vec2(W * 0.86, lidTop(0.86, H, W, o1, wide) + th * 0.3);
  vec2 p1 = vec2(W * 1.14, lidTop(0.86, H, W, o1, wide) + H * (0.32 + 0.25 * (1.0 - o1)));
  vec2 pa = q - p0, ba = p1 - p0;
  float hseg = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float flick = fFill(length(pa - ba * hseg) - H * (0.09 - 0.07 * hseg));
  lash = max(lash, flick * 0.95 * (1.0 - fMisc.w)) * (1.0 - happy);
  // the delighted eye: a closed, upward crescent
  float yH = -H * 0.05 + H * 0.58 * pow(e, 0.85);
  float hap = fFill(abs(q.y - yH) - max(H * 0.14 * (0.55 + 0.45 * e), fPx * 0.9)) * fFill(abs(q.x) - W * 0.96) * happy;
  col = mix(col, fInk, max(lash, hap));
  return col;
}
vec3 faceBrow(vec3 col, vec2 f, float s, float raise, float inner) {
  vec2 c = vec2(s * fLayB.x, fLayB.y + raise);
  vec2 q = f - c; q.x *= s;
  float BW = fLayE.z * 1.06;
  float x = q.x / BW;
  float arch = 0.1 * fLayB.w * BW * (1.0 - (x - 0.2) * (x - 0.2));
  float lift = inner * 0.16 * BW * smoothstep(0.7, -1.0, x);
  float yc = arch + lift - 0.03 * BW * x;
  float th = max(BW * mix(0.17, 0.065, smoothstep(-1.0, 1.0, x)) * fLayB.z, fPx * 1.3);
  float m = fFill(abs(q.y - yc) - th * 0.5) * smoothstep(1.03, 0.8, x) * smoothstep(-1.1, -0.86, x);
  float hair = 0.82 + 0.18 * sin((q.x * 2.0 + q.y) * 260.0);
  return mix(col, fInk, m * 0.93 * hair);
}
vec3 faceMouth(vec3 col, vec2 f) {
  float smile = fMouth.x, open = fMouth.y, rnd = fMouth.w;
  float W = fLayM.y * fMouth.z * (1.0 - 0.42 * rnd);
  vec2 q = f - vec2(0.0, fLayM.x);
  float x = q.x / W;
  float ax = clamp(x, -1.0, 1.0);
  float e = max(1.0 - ax * ax, 0.0);
  float yl = W * (smile * 0.42 * ax * ax - smile * 0.1);
  float hT = open * W * (0.16 * pow(e, 0.5) * (1.0 - 0.5 * max(smile, 0.0)) + rnd * 0.38 * pow(e, 0.5));
  float hB = open * W * (0.5 * pow(e, 0.6) + rnd * 0.2 * pow(e, 0.5));
  float yT = yl + hT, yB = yl - hB;
  // lips: a soft lower lip, a subtle upper lip
  float lowLip = fFill(length(vec2(x * 0.92, (q.y - (yB - W * 0.13)) / (W * 0.24))) - 1.0);
  float upLip = fFill(length(vec2(x * 0.98, (q.y - (yT + W * 0.06)) / (W * 0.1))) - 1.0);
  col = mix(col, mix(col, fLip, 0.85), lowLip * 0.62 + upLip * 0.4);
  col += vec3(0.05, 0.035, 0.03) * fFill(length(vec2(x * 1.6 + 0.15, (q.y - (yB - W * 0.1)) / (W * 0.06))) - 1.0) * (1.0 - open);
  faceGloss = max(faceGloss, lowLip * 0.3);
  float inside = fFill(q.y - yT) * fFill(yB - q.y) * fFill(abs(x) - 1.0) * smoothstep(0.0, 0.08, open);
  float depth = clamp((yT - q.y) / max(yT - yB, 1e-4), 0.0, 1.0);
  vec3 mc = mix(vec3(0.22, 0.06, 0.07), vec3(0.68, 0.3, 0.3), smoothstep(0.5, 0.95, depth) * fFill(abs(x) - 0.75));
  float teeth = (1.0 - smoothstep(0.16, 0.3, depth)) * smoothstep(0.2, 0.45, open * (1.0 - rnd)) * fFill(abs(x) - 0.8);
  mc = mix(mc, vec3(0.93, 0.9, 0.86), teeth);
  col = mix(col, mc, inside);
  float line = fFill(abs(q.y - yl) - max(W * 0.062 * (0.4 + 0.6 * e), fPx * 0.75)) * fFill(abs(x) - 1.02) * (1.0 - smoothstep(0.04, 0.2, open));
  col = mix(col, fLip * 0.34, line * 0.95);
  return col;
}
vec3 faceAll(vec3 col) {
  if (vFace.w < 0.5) return col;
  vec2 f = vFace.xy;
  fPx = length(fwidth(f));
  // natural blush on the cheeks (more when she blushes or delights)
  for (int k = 0; k < 2; k++) {
    float s = k == 0 ? -1.0 : 1.0;
    vec2 bd = (f - vec2(s * 0.53, -0.43)) / vec2(0.21, 0.14);
    float b = exp(-dot(bd, bd) * 1.2) * smoothstep(0.1, 0.5, vFace.z);
    col *= mix(vec3(1.0), fBlushC, b * fMisc.x);
  }
  // under the nose: a soft shadow
  vec2 nq = (f - vec2(0.0, fMisc.z)) / vec2(0.09, 0.03);
  col *= 1.0 - 0.12 * exp(-dot(nq, nq)) * smoothstep(0.2, 0.6, vFace.z);
  if (vFace.z > 0.05) {
    col = faceEye(col, f, -1.0, fEyeR);
    col = faceEye(col, f, 1.0, fEyeL);
    col = faceBrow(col, f, -1.0, fBrow.y, fBrow.w);
    col = faceBrow(col, f, 1.0, fBrow.x, fBrow.z);
  }
  if (fMisc.w > 0.5) {
    // feathered edges: the threshold jitters per short vertical 'strand' cell; sparser at the edge
    float jit = (fNoise(f * vec2(34.0, 12.0)) - 0.5) * 0.05 + (fNoise(f * vec2(120.0, 30.0)) - 0.5) * 0.025;
    float bm = beardMask(vec3(f.x, f.y + jit, vFace.z));
    float n = fNoise(f * vec2(240.0, 52.0));
    vec3 bc = fBeardC * (0.72 + 0.45 * n) * mix(1.35, 0.9, bm);
    col = mix(col, bc, bm * 0.94);
    faceMatte = bm * 0.85;
  }
  if (vFace.z > 0.05) col = faceMouth(col, f);
  return col;
}
`;

function patchSkin(mat, U) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aFace;\nvarying vec4 vFace;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFace = aFace;');
    // soft-clay skin: a warm wrapped diffuse (light bleeds a little past the terminator, reddening
    // as it goes — a cheap stand-in for subsurface scattering)
    const wrap = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
      `float wrapNL = saturate( ( dot( geometryNormal, directLight.direction ) + 0.42 ) / 1.42 );
      vec3 sss = ( wrapNL - dotNL ) * vec3( 0.55, 0.26, 0.17 ) * directLight.color;
      reflectedLight.directDiffuse += ( irradiance + sss ) * BRDF_Lambert( material.diffuseColor );`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <lights_physical_pars_fragment>', wrap)
      .replace('#include <common>', '#include <common>\n' + FACE_PARS)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = faceAll(diffuseColor.rgb);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * fSkinFill * (1.0 - faceMatte) * (1.0 - faceGloss * 0.6);')
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
material.roughness = mix(material.roughness, 0.075, faceGloss);
material.roughness = mix(material.roughness, 0.92, faceMatte);
material.specularColor = mix(material.specularColor, vec3(0.05), faceGloss);
#ifdef USE_SHEEN
material.sheenColor *= 1.0 - faceGloss;
#endif`);
  };
  mat.customProgramCacheKey = () => 'little-figure-skin-v3';
}

// ------------------------------------------------------------------ scratch (update allocates nothing)
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3(), _v7 = new THREE.Vector3();
const _S = new THREE.Vector3(), _T = new THREE.Vector3(), _E = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3();
const _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _qU = new THREE.Quaternion(), _qH = new THREE.Quaternion();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _mb = new THREE.Matrix4();
const _e1 = new THREE.Euler(0, 0, 0, 'YXZ');

/** Two-bone IK in figure space (S root, T goal, pole = where the middle joint points). sgn −1 for arms
 *  (the forearm folds forward), +1 for legs (the shin folds back). Writes the upper bone's figure-space
 *  rotation to qOut and returns the bend angle. */
function solveTwoBone(S, T, L1, L2, pole, sgn, qOut) {
  _a.subVectors(T, S);
  let d = _a.length();
  if (d < 1e-6) { _a.set(0, -1, 0); d = 1e-6; } else _a.multiplyScalar(1 / d);
  d = clamp(d, Math.abs(L1 - L2) + 1e-4, (L1 + L2) * 0.9995);
  _b.copy(pole).addScaledVector(_a, -pole.dot(_a));
  if (_b.lengthSq() < 1e-10) _b.set(0, 0, 1).addScaledVector(_a, -_a.z);
  _b.normalize();
  const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _u.copy(_a).multiplyScalar(cosA).addScaledVector(_b, sinA);
  _E.copy(S).addScaledVector(_u, L1);
  _f.copy(S).addScaledVector(_a, d).sub(_E).normalize();
  _Y.copy(_u).negate();
  _Z.copy(_b).addScaledVector(_u, -_b.dot(_u)).normalize().multiplyScalar(sgn);
  _X.crossVectors(_Y, _Z);
  _mb.makeBasis(_X, _Y, _Z);
  qOut.setFromRotationMatrix(_mb);
  return Math.acos(clamp(_u.dot(_f), -1, 1));
}

// ------------------------------------------------------------------ createFigure
export function createFigure(env = {}, opts = {}) {
  const S = DEEPU; // (Deepu only: no other person is ever made as a figure)
  const tier = env.tier || {};
  const q = clamp(opts.quality ?? tier.quality ?? 2, 0, 2) | 0;
  const shadows = opts.shadows ?? !!(tier.shadows ?? q >= 1);
  const envMap = opts.envMap ?? env.envWarm ?? env.envMap ?? null;
  const R = rng(20);
  const own = [];
  const keep = (x) => { own.push(x); return x; };
  const J = S.J;
  const mir = (p, s) => [p[0] * s, p[1], p[2]];

  // ---------------------------------------------------------------- bones
  const group = new THREE.Group();
  group.name = 'figure-' + S.who;
  const bones = [];
  const bind = [];
  const bindPos = (name) => {
    switch (name) {
      case 'root': return [0, 0, 0];
      case 'shoulderL': return J.shoulder; case 'shoulderR': return mir(J.shoulder, -1);
      case 'elbowL': return J.elbow; case 'elbowR': return mir(J.elbow, -1);
      case 'wristL': return J.wrist; case 'wristR': return mir(J.wrist, -1);
      case 'handL': return J.hand; case 'handR': return mir(J.hand, -1);
      case 'hipL': return J.hip; case 'hipR': return mir(J.hip, -1);
      case 'kneeL': return J.knee; case 'kneeR': return mir(J.knee, -1);
      case 'ankleL': return J.ankle; case 'ankleR': return mir(J.ankle, -1);
      default: return J[name];
    }
  };
  BONE_NAMES.forEach((n, i) => {
    const b = new THREE.Bone();
    b.name = n;
    const p = bindPos(n);
    bind.push(new THREE.Vector3(...p));
    if (PARENT[i] < 0) { b.position.set(...p); group.add(b); }
    else { const pp = bind[PARENT[i]]; b.position.set(p[0] - pp.x, p[1] - pp.y, p[2] - pp.z); bones[PARENT[i]].add(b); }
    bones.push(b);
  });
  const restLocal = bones.map((b) => b.position.clone());
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();
  const L1a = bind[B.shoulderL].distanceTo(bind[B.elbowL]), L2a = bind[B.elbowL].distanceTo(bind[B.wristL]);
  const L1l = bind[B.hipL].distanceTo(bind[B.kneeL]), L2l = bind[B.kneeL].distanceTo(bind[B.ankleL]);

  // anchors
  const H = S.head, F = S.face, HR = H.R;
  const hc = new THREE.Vector3(...H.c);
  const anchor = (name, parent, x, y, z) => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); parent.add(o); return o; };
  const eyes = anchor('eyes', bones[B.head], hc.x, hc.y + F.eye[1] * HR, hc.z + HR * 0.92);
  const browL = anchor('browL', bones[B.head], hc.x + F.brow[0] * HR, hc.y + F.brow[1] * HR, hc.z + HR * 0.9);
  const browR = anchor('browR', bones[B.head], hc.x - F.brow[0] * HR, hc.y + F.brow[1] * HR, hc.z + HR * 0.9);
  const mouth = anchor('mouth', bones[B.head], hc.x, hc.y + F.mouth[0] * HR, hc.z + HR * 1.02);
  // sockets: in front of the palm at the finger roots; +Y along the fingers, +Z out of the palm
  const hs = S.hand;
  const socketL = anchor('handSocketL', bones[B.wristL], -0.022 * hs, -0.07 * hs, 0.006);
  const socketR = anchor('handSocketR', bones[B.wristR], 0.022 * hs, -0.07 * hs, 0.006);
  socketL.quaternion.setFromRotationMatrix(_mb.makeBasis(_X.set(0, 0, -1), _Y.set(0, -1, 0), _Z.set(-1, 0, 0)));
  socketR.quaternion.setFromRotationMatrix(_mb.makeBasis(_X.set(0, 0, 1), _Y.set(0, -1, 0), _Z.set(1, 0, 0)));

  // ---------------------------------------------------------------- geometry: skin
  const NU = [20, 24, 32][q], NV = [14, 18, 22][q];
  const skinM = new Mesher();
  const clothM = new Mesher();
  const noFace = () => [0, 0, 0, 0];
  const rigid = (b) => () => { WT.add(b, 1); };
  const blendY = (y, list) => { // list: [[y, bone], ...] ascending; linear blends between neighbours
    if (y <= list[0][0]) { WT.add(list[0][1], 1); return; }
    for (let k = 0; k < list.length - 1; k++) {
      const [y0, b0] = list[k], [y1, b1] = list[k + 1];
      if (y <= y1) { const t = smooth(y0, y1, y); WT.add(b0, 1 - t); WT.add(b1, t); return; }
    }
    WT.add(list[list.length - 1][1], 1);
  };
  const spineList = [[J.hips[1] + 0.03, B.hips], [J.spine[1] + 0.02, B.spine], [J.chest[1] - 0.04, B.spine], [J.chest[1] + 0.03, B.chest], [J.neck[1] + 0.01, B.chest], [J.neck[1] + 0.05, B.neck], [J.head[1] + 0.02, B.neck], [J.head[1] + 0.07, B.head]];

  // the head (with the face coordinates for the shader and the jaw weights)
  const headPoint = (dx, dy, dz, out, beardOn = true) => {
    const front = smooth(-0.25, 0.7, dz);
    let x = dx * H.width, y = dy, z = dz * H.depth;
    if (dy < 0) {
      const low = smooth(0, -1, dy);
      y = dy * (1 + H.chin * front * (0.55 + 0.45 * low));
      x *= 1 - H.taper * low * low * (0.45 + 0.55 * front);
      z *= 1 - 0.1 * low * (1 - front);
    }
    for (let s = -1; s <= 1; s += 2) {
      const d2 = (dx - 0.6 * s) ** 2 + (dy + 0.5) ** 2 + (dz - 0.6) ** 2;
      const gg = Math.exp(-d2 / 0.18) * H.cheeks;
      x += dx * gg; y += dy * gg * 0.4; z += dz * gg;
    }
    z -= 0.07 * smooth(0.5, 1.0, dz) * smooth(-0.9, 0.2, dy) * dz;
    const bk = Math.exp(-((dx * dx) + (dy - 0.25) ** 2 + (dz + 0.9) ** 2) / 0.3) * H.back;
    x += dx * bk; y += dy * bk; z += dz * bk;
    // nose (a soft bump with a gentle bridge) and lips
    const fr = smooth(0.25, 0.65, dz);
    const ny = y - H.noseY;
    const gn = Math.exp(-(x * x) / (0.075 * 0.075) - (ny * ny) / (0.1 * 0.1));
    const bridge = Math.exp(-(x * x) / (0.05 * 0.05)) * smooth(H.noseY, H.noseY + 0.1, y) * smooth(H.noseY + 0.42, H.noseY + 0.14, y);
    z += (H.nose * gn + H.nose * 0.22 * bridge) * fr;
    const my = y - F.mouth[0];
    z += H.lips * Math.exp(-(x * x) / (0.24 * 0.24) - (my * my) / (0.075 * 0.075)) * fr;
    out.set(x, y, z);
    if (H.beard && beardOn) {
      const bm = beardMaskJS(out.x, out.y, out.z);
      const L = out.length() || 1;
      out.multiplyScalar(1 + (H.beard * bm * bm * (3 - 2 * bm)) / L);
    }
    return out;
  };
  const beardMaskJS = (fx, fy, fz) => {
    const ax = Math.abs(fx);
    const yb = lerp(-0.62, -0.06, smooth(0.34, 0.95, ax)) + 0.05 * smooth(0.6, 0.95, ax) * smooth(0.1, -0.3, fz);
    const zb = lerp(0.16, -0.3, smooth(-0.5, -0.95, fy));
    let m = smooth(yb + 0.04, yb - 0.09, fy) * smooth(zb - 0.08, zb + 0.05, fz);
    const W = F.mouth[1], u = ax / (W * 1.45);
    const yc = F.mouth[0] + 0.105 - 0.075 * u * u, ht = 0.05 * (1 - 0.45 * u);
    const must = smooth(ht + 0.02, ht - 0.015, Math.abs(fy - yc)) * smooth(1.15, 0.9, u) * smooth(0.15, 0.45, fz);
    m = Math.max(m, must);
    const lips = Math.hypot(fx / (W * 1.08), (fy - F.mouth[0] + 0.01) / 0.085);
    return clamp(m * smooth(0.9, 1.12, lips), 0, 1);
  };
  const dirOf = (u, v, out) => { const th = lerp(0.015, Math.PI - 0.015, v), ph = (u - 0.5) * TAU; return out.set(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)); };
  const hb = bind[B.head];
  const _hd = new THREE.Vector3();
  const _hp = new THREE.Vector3();
  grid(skinM, {
    nu: [40, 52, 64][q], nv: [30, 40, 48][q], wrapU: true,
    pos(u, v, out) { dirOf(u, v, _hd); headPoint(_hd.x, _hd.y, _hd.z, out).multiplyScalar(HR).add(hc).add(hb); },
    inside(u, v, p, out) { out.copy(hc).add(hb); },
    skin(p) {
      const fx = (p.x - hb.x - hc.x) / HR, fy = (p.y - hb.y - hc.y) / HR, fz = (p.z - hb.z - hc.z) / HR;
      const jaw = smooth(F.mouth[0] + 0.02, F.mouth[0] - 0.14, fy) * smooth(-0.35, 0.25, fz) * (1 - 0.5 * smooth(0.7, 1.0, Math.abs(fx)));
      const nk = smooth(-0.85, -1.2, fy) * 0.6 * (1 - jaw);
      WT.add(B.jaw, jaw); WT.add(B.neck, nk); WT.add(B.head, 1 - jaw - nk);
    },
    face(p) { return [(p.x - hb.x - hc.x) / HR, (p.y - hb.y - hc.y) / HR, (p.z - hb.z - hc.z) / HR, 1]; },
  });
  if (H.beard) {
    // the painted beard mask uses the face coordinates of the surface before the beard's volume
    // (the head is the first part of the skin mesh, so its vertices start at 0)
    let k = 0;
    const nu = [40, 52, 64][q], nv = [30, 40, 48][q];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++, k++) {
      dirOf(i / nu, j / nv, _hd); headPoint(_hd.x, _hd.y, _hd.z, _hp, false);
      skinM.f[k * 4] = _hp.x; skinM.f[k * 4 + 1] = _hp.y; skinM.f[k * 4 + 2] = _hp.z;
    }
  }
  // Even, soft shading on the face (a figurine's face is lit like one smooth surface): blend the
  // face's normals toward a flattened, forward-facing field, so the jaw, chin and the area below the
  // mouth stay as warm as the cheeks instead of turning dark (which reads as a shadowy beard).
  {
    const nHead = ([40, 52, 64][q] + 1) * ([30, 40, 48][q] + 1);
    for (let k = 0; k < nHead; k++) {
      const fx = (skinM.p[k * 3] - hb.x - hc.x) / HR, fy = (skinM.p[k * 3 + 1] - hb.y - hc.y) / HR, fz = (skinM.p[k * 3 + 2] - hb.z - hc.z) / HR;
      let w = smooth(-0.15, 0.5, fz) * (1 - smooth(-0.95, -1.42, fy)) * (1 - 0.45 * smooth(0.55, 1.0, Math.abs(fx)));
      w *= H.beard ? 0.5 * (1 - beardMaskJS(fx, fy, fz)) : 0.62;
      if (w <= 0) continue;
      _gn.set(fx * 0.9, fy * 0.35 + 0.08, fz + 0.75).normalize();
      _gd.set(skinM.n[k * 3], skinM.n[k * 3 + 1], skinM.n[k * 3 + 2]).lerp(_gn, w).normalize();
      skinM.n[k * 3] = _gd.x; skinM.n[k * 3 + 1] = _gd.y; skinM.n[k * 3 + 2] = _gd.z;
    }
  }
  // ears (only when the hair leaves them visible)
  if (H.ears) {
    for (const s of [1, -1]) {
      const ex = s * HR * H.width * 0.97, ey = hb.y + hc.y - HR * 0.16, ez = hb.z + hc.z - HR * 0.05;
      limb(skinM, [ex, ey + 0.026, ez], [ex, ey - 0.024, ez + 0.004], 0.019, 0.015, {
        nu: 12, nv: 10, sx: 0.42, sz: 1.0, skin: rigid(B.head), face: noFace,
        post: (p) => { const k = (p.x - ex) * s; if (k < 0) p.x = ex + s * k * 0.3; },
      });
    }
  }
  // neck and the upper chest under the neckline
  // (one extra torso row below, so the skin's lathe matches the garment's exactly where they overlap)
  const chestNeck = S.torso.filter((r) => r[0] >= S.torso[S.torso.length - 1][0] - 0.27).concat(S.neck);
  const chestY0 = S.neckline(0) - 0.022;
  grid(skinM, {
    nu: NU + 8, nv: NV, wrapU: true,
    // the skin under the garment sits a little deeper toward its lower edge (never pokes through)
    pos(u, v, out) { const y = lerp(chestY0, S.neck[S.neck.length - 1][0], v); latheAt(chestNeck, (u - 0.5) * TAU, y, lerp(0.0035, 0.009, smooth(chestY0 + 0.06, chestY0, y)) * smooth(S.top + 0.01, S.top - 0.06, y), out); },
    inside(u, v, p, out) { out.set(0, p.y, ringAt(chestNeck, p.y)[4]); },
    skin(p) { blendY(p.y, spineList); },
    face: noFace,
  });
  // arms (her forearms and upper arms are skin, under the kurti's short sleeves)
  const AR = S.arm.r;
  for (const s of [1, -1]) {
    const sh = mir(J.shoulder, s), el = mir(J.elbow, s), wr = mir(J.wrist, s);
    const sb = s > 0 ? B.shoulderL : B.shoulderR, eb = s > 0 ? B.elbowL : B.elbowR, wb = s > 0 ? B.wristL : B.wristR, fb = s > 0 ? B.handL : B.handR;
    const armM = S.outfit === 'kurti' ? skinM : clothM;
    const armUV = S.outfit === 'kurti' ? null : (u, v, p) => [0.03 + u * 0.3, printV(S, p.y)];
    // ONE soft arm from shoulder to wrist (no seam at the elbow): the upper arm's gentle swell, the
    // forearm's, and skin weights blended over a few centimetres round the elbow. (In a jacket the
    // sleeve below is the arm: no hidden tube under it.)
    if (S.outfit === 'kurti') {
      const A0 = new THREE.Vector3(...sh), A1 = new THREE.Vector3(...wr);
      const LA = A0.distanceTo(A1), te = A0.distanceTo(new THREE.Vector3(...el)) / LA;
      const dA = new THREE.Vector3().subVectors(A1, A0).normalize();
      limb(armM, sh, wr, AR[0], AR[3], {
        nu: NU - 4, nv: NV + 8, sx: 0.93, sz: 1.05, face: noFace, uv: armUV,
        radius: (t) => {
          if (t < te) { const u = t / te; return lerp(AR[0], AR[1], u) * (1 + 0.07 * Math.sin(Math.PI * Math.min(1, u * 1.15))); }
          const u = (t - te) / (1 - te);
          return lerp(AR[1], AR[3], u) * (1 + 0.1 * Math.sin(Math.PI * Math.min(1, u * 1.6)) * smooth(0, 0.3, u) * (1 - u * 0.8));
        },
        skin: (p) => {
          const t = clamp(_gi.subVectors(p, A0).dot(dA) / LA, 0, 1);
          const w = smooth(te - 0.06, te + 0.06, t);
          WT.add(sb, 1 - w); WT.add(eb, w);
        },
      });
    }
    // the hand: a soft mitten (palm + fingers) and a separate thumb, palm facing the body
    const W0 = wr;
    const hp = (x, y, z) => [W0[0] + x * s * hs, W0[1] + y * hs, W0[2] + z * hs];
    const handOpt = (b) => ({ nu: 14, nv: 12, sx: 0.55, sz: 1.15, skin: rigid(b), face: noFace });
    limb(skinM, hp(0, -0.004, 0), hp(-0.001, -0.056, 0.002), 0.02 * 1, 0.0215, handOpt(wb));
    limb(skinM, hp(-0.002, -0.062, 0.002), hp(-0.004, -0.096, 0.0), 0.0195, 0.0145, handOpt(fb));
    limb(skinM, hp(-0.008, -0.02, 0.016), hp(-0.013, -0.05, 0.026), 0.0088, 0.0072, { nu: 10, nv: 10, skin: rigid(wb), face: noFace });
    if (S.outfit === 'jacket') {
      // shirt cuffs peeking out of the sleeves
      tube(clothM, (t, P, N) => { const a = t * TAU; P.set(wr[0] + Math.cos(a) * AR[3] * 1.06, wr[1] + 0.012, wr[2] + Math.sin(a) * AR[3] * 1.06); N.set(Math.cos(a), 0, Math.sin(a)); },
        { closed: true, n: 24, m: 6, r: 0.006, skin: rigid(eb), uv: (u, v) => [0.1 + v * 0.8, ATLAS.collar] });
    }
  }

  // ---------------------------------------------------------------- geometry: clothes
  const hemWeights = (p) => {
    const y = p.y;
    if (y >= J.hips[1] - 0.02) { blendY(y, spineList); return; }
    const t = smooth(J.hips[1] - 0.005, J.hips[1] - 0.1, y);
    const side = smooth(-0.045, 0.045, p.x);
    const sk = smooth(J.knee[1] + 0.025, J.knee[1] - 0.07, y) * 0.92; // a wide blend: the print stretches less over a bent knee
    WT.add(B.hips, 1 - t);
    WT.add(B.hipL, t * side * (1 - sk)); WT.add(B.hipR, t * (1 - side) * (1 - sk));
    WT.add(B.kneeL, t * side * sk); WT.add(B.kneeR, t * (1 - side) * sk);
  };
  const torsoTop = (th) => S.neckline(Math.abs(Math.atan2(Math.sin(th), Math.cos(th))));
  const hemAt = (th) => S.hem + (S.outfit === 'kurti' ? 0.075 * Math.abs(Math.sin(th)) ** 10 : 0);
  const garment0 = clothM.size;
  grid(clothM, {
    nu: [32, 44, 56][q], nv: [26, 36, 46][q], wrapU: true,
    pos(u, v, out) { const th = (u - 0.5) * TAU; latheAt(S.torso, th, lerp(hemAt(th), torsoTop(th), v), 0, out); },
    inside(u, v, p, out) { out.set(0, p.y, ringAt(S.torso, p.y)[4]); },
    skin: hemWeights,
    uv: (u, v, p) => [u, printV(S, p.y)],
  });
  // the neckline trim and the hem band
  const neckCurve = (t, P, N) => {
    const th = (t - 0.5) * TAU;
    latheAt(S.torso, th, torsoTop(th) - 0.002, 0, P);
    N.set(Math.sin(th), 0.45, Math.cos(th)).normalize();
  };
  tube(clothM, neckCurve, { closed: true, n: [48, 64, 96][q], m: 6, r: S.outfit === 'kurti' ? 0.0045 : 0.0052, flat: S.outfit === 'kurti' ? 1.4 : 2.2, skin: (p) => blendY(p.y, spineList), uv: (u, v) => [v, ATLAS.trim] });
  tube(clothM, (t, P, N) => { const th = (t - 0.5) * TAU; latheAt(S.torso, th, hemAt(th) + 0.006, -0.002, P); N.set(Math.sin(th), -0.2, Math.cos(th)).normalize(); },
    { closed: true, n: [40, 56, 72][q], m: 6, r: 0.006, skin: hemWeights, uv: (u, v) => [v, S.outfit === 'kurti' ? ATLAS.trim : 1 - 790 / 1024] });
  const garment1 = clothM.size; // the garment body + its trims end here (sleeves, legs and shoes follow)

  for (const s of [1, -1]) {
    const sh = mir(J.shoulder, s), el = mir(J.elbow, s), wr = mir(J.wrist, s);
    const sb = s > 0 ? B.shoulderL : B.shoulderR, eb = s > 0 ? B.elbowL : B.elbowR;
    if (S.outfit === 'kurti') {
      // a short puffed sleeve, gathered at the shoulder, with a cream cuff
      const top = [sh[0] + 0.004 * s, sh[1] + 0.036, sh[2]], end = [sh[0] + 0.002 * s, sh[1] - 0.15, sh[2] - 0.002];
      const prof = [0.06, 0.069, 0.066, 0.058, 0.0525];
      limb(clothM, top, end, 0.06, 0.0525, {
        nu: [20, 24, 28][q], nv: [12, 14, 18][q], capB: false,
        radius: (t) => { const k = t * 4, i = Math.min(3, Math.floor(k)); return lerp(prof[i], prof[i + 1], k - i); },
        ripple: (ps, v) => 0.035 * Math.sin(ps * 11) * smooth(0.95, 0.2, v) * smooth(0.0, 0.3, v),
        skin: rigid(sb), uv: (u, v, p) => [0.02 + u * 0.47, printV(S, p.y)],
      });
      tube(clothM, (t, P, N) => { const a = t * TAU; P.set(end[0] + Math.cos(a) * 0.0525, end[1], end[2] + Math.sin(a) * 0.0525); N.set(Math.cos(a), 0, Math.sin(a)); },
        { closed: true, n: 28, m: 6, r: 0.0055, skin: rigid(sb), uv: (u, v) => [v, ATLAS.trim] });
    } else {
      // one jacket sleeve over the whole arm (no seam at the elbow): weights blend round the elbow
      const A0 = new THREE.Vector3(sh[0] - 0.008 * s, sh[1] - 0.004, sh[2]), A1 = new THREE.Vector3(wr[0], wr[1] + 0.02, wr[2]);
      const LA = A0.distanceTo(A1), te = A0.distanceTo(new THREE.Vector3(...el)) / LA;
      const dA = new THREE.Vector3().subVectors(A1, A0).normalize();
      limb(clothM, A0.toArray(), A1.toArray(), 0.052, 0.037, {
        nu: NU, nv: NV + 8, capB: false, uv: (u, v, p) => [0.03 + u * 0.3, printV(S, p.y)],
        radius: (t) => (t < te ? lerp(0.052, 0.044, t / te) * (1 + 0.04 * Math.sin(Math.PI * t / te)) : lerp(0.044, 0.037, (t - te) / (1 - te))),
        skin: (p) => { const t = clamp(_gi.subVectors(p, A0).dot(dA) / LA, 0, 1), w = smooth(te - 0.07, te + 0.07, t); WT.add(sb, 1 - w); WT.add(eb, w); },
      });
    }
    // legs: (leggings / trousers) and shoes
    const hp2 = mir(J.hip, s), kn = mir(J.knee, s), an = mir(J.ankle, s);
    const hb2 = s > 0 ? B.hipL : B.hipR, kb = s > 0 ? B.kneeL : B.kneeR, ab = s > 0 ? B.ankleL : B.ankleR;
    const LR = S.leg.r;
    const legUV = (u, v) => [0.05 + u * 0.9, ATLAS.legs + (v - 0.5) * 0.02];
    // (the thigh is slimmer right at the hip joint — always under the garment — so when she sits the
    // folding kurti never shows the leg's rounded top through the lap)
    const thighTop = S.outfit === 'kurti' ? 0.5 : 0.85;
    limb(clothM, hp2, kn, LR[0] * thighTop, LR[1], { nu: NU, nv: NV, skin: rigid(hb2), uv: legUV, radius: (t) => lerp(LR[0], LR[1], t) * lerp(thighTop, 1, smooth(0, 0.24, t)) });
    limb(clothM, kn, an, LR[2], LR[3], { nu: NU, nv: NV, skin: rigid(kb), uv: legUV, radius: (t) => lerp(LR[2], LR[3], t) * (1 + 0.12 * Math.sin(Math.PI * Math.min(1, t * 1.8)) * (1 - t)) });
    const sw = 1;
    const az = an[2];
    limb(clothM, [an[0], 0.026 * sw, az - 0.03 * sw], [an[0] + 0.007 * s, 0.02 * sw, az + 0.118 * sw], 0.03 * sw, 0.019 * sw, {
      nu: NU, nv: NV, sx: 1.04, sz: 0.66, skin: rigid(ab),
      radius: (t) => sw * (0.03 + (0.019 - 0.03) * t ** 1.6) * (1 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.4))),
      post: (p) => { if (p.y < 0.003) p.y = 0.003; p.y += 0.004 * smooth(az + 0.08 * sw, az + 0.125 * sw, p.z) * (p.y > 0.008 ? 1 : 0.5); },
      uv: (u, v, p) => [0.05 + u * 0.9, p.y < 0.0075 * sw ? ATLAS.sole
        : (S.outfit === 'kurti' && p.y > 0.03 && p.z < az + 0.035 && p.z > az - 0.02 ? ATLAS.legs : ATLAS.shoe)],
    });
  }
  // ---------------------------------------------------------------- materials
  const PHYS_ONLY = ['clearcoat', 'clearcoatRoughness', 'sheen', 'sheenColor', 'sheenRoughness', 'sheenColorMap', 'anisotropy', 'anisotropyRotation', 'specularIntensity', 'specularColor'];
  const mat = (o) => {
    if (q >= 1) return keep(new THREE.MeshPhysicalMaterial({ envMap, ...o }));
    const p = { envMap, ...o };
    PHYS_ONLY.forEach((k) => delete p[k]);
    return keep(new THREE.MeshStandardMaterial(p));
  };
  const U = {
    fEyeL: { value: new THREE.Vector4(1, 0, 0, 1) }, fEyeR: { value: new THREE.Vector4(1, 0, 0, 1) },
    fLook: { value: new THREE.Vector4(0, 0, 1, 0) }, fBrow: { value: new THREE.Vector4() },
    fMouth: { value: new THREE.Vector4(F.rest, 0, 1, 0) }, fMisc: { value: new THREE.Vector4(F.baseBlush, 0, H.noseY - 0.07, F.beard) },
    fLayE: { value: new THREE.Vector4(F.eye[0], F.eye[1], F.eye[2], F.eye[3]) },
    fLayB: { value: new THREE.Vector4(F.brow[0], F.brow[1], F.brow[2], F.brow[3]) },
    fLayM: { value: new THREE.Vector4(F.mouth[0], F.mouth[1], 0, 0) },
    fIris: { value: new THREE.Color(F.iris) }, fInk: { value: new THREE.Color(F.ink) }, fLip: { value: new THREE.Color(F.lip) },
    fBlushC: { value: new THREE.Color(F.blush) }, fBeardC: { value: new THREE.Color(S.hairColor) },
    fSkinFill: { value: H.beard ? 0.035 : 0.07 }, // a soft subsurface-like warmth (scenes may tune it: fig.uniforms.fSkinFill)
  };
  const skinMat = mat({ color: new THREE.Color(S.skin), roughness: 0.5, metalness: 0, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(S.sheen), specularIntensity: 0.45, envMapIntensity: 0.5 });
  patchSkin(skinMat, U);
  const clothTex = keep(new THREE.CanvasTexture(S.outfit === 'kurti' ? paintKurti(R) : paintJacket(R)));
  clothTex.colorSpace = THREE.SRGBColorSpace; clothTex.anisotropy = 4; clothTex.wrapS = THREE.RepeatWrapping;
  const clothMat = mat({ map: clothTex, roughness: S.outfit === 'kurti' ? 0.72 : 0.82, metalness: 0, sheen: S.outfit === 'kurti' ? 1 : 0.5, sheenRoughness: 0.42, sheenColor: new THREE.Color(S.outfit === 'kurti' ? '#ffd9cf' : '#fff2dc'), sheenColorMap: clothTex, side: THREE.DoubleSide, envMapIntensity: 0.35 });
  const hairTex = keep(new THREE.CanvasTexture(paintHair(R)));
  hairTex.colorSpace = THREE.SRGBColorSpace; hairTex.wrapS = hairTex.wrapT = THREE.RepeatWrapping; hairTex.anisotropy = 4;
  const hairMat = mat({ map: hairTex, vertexColors: true, roughness: S.hairStyle === 'long' ? 0.4 : 0.56, metalness: 0, anisotropy: S.hairStyle === 'long' ? 0.6 : 0.35, anisotropyRotation: Math.PI / 2, specularIntensity: 0.5, specularColor: new THREE.Color('#d9b9a2'), sheen: S.hairStyle === 'long' ? 0.35 : 0.6, sheenRoughness: 0.45, sheenColor: new THREE.Color(S.hairSheen), side: THREE.DoubleSide, envMapIntensity: 0.4 });

  const skinGeo = keep(toGeometry(skinM, { face: true }));
  const clothGeo = keep(toGeometry(clothM));
  // The 'sit' morph (bind space, applied before skinning): below the hips the garment hugs the legs —
  // narrower, shallower — so when the thighs come forward it lies on her lap and drapes over the knees
  // instead of standing out like a cushion. Its influence follows the 'sit' pose weight.
  {
    const legHW = J.hip[0] + S.leg.r[0] + 0.014, legD = S.leg.r[0] + 0.016;
    const mp = new Float32Array(clothGeo.attributes.position.count * 3);
    for (let k = garment0; k < garment1; k++) {
      const x = clothM.p[k * 3], y = clothM.p[k * 3 + 1], z = clothM.p[k * 3 + 2];
      const t = smooth(J.hips[1] - 0.01, J.hips[1] - 0.15, y);
      if (t <= 0) continue;
      const R = ringAt(S.torso, y);
      const zc = R[4], hw = R[1], d = z > zc ? R[2] : R[3];
      const nx = x * lerp(1, Math.min(1, legHW / hw), t);
      // extra room at the two bends' corners (the hip crease, the top of the knee), where blended
      // skin weights fold the cloth inward
      const crease = 1 - smooth(J.hips[1] - 0.06, J.hips[1] - 0.22, y);
      const knee = smooth(J.knee[1] + 0.09, J.knee[1] + 0.01, y) * (1 - smooth(J.knee[1] - 0.01, J.knee[1] - 0.05, y));
      const dz = legD + (0.05 * crease + 0.035 * knee) * (z > zc ? 1 : 0.4);
      const nz = zc + (z - zc) * lerp(1, Math.min(1, dz / d), t);
      mp[k * 3] = nx - x; mp[k * 3 + 1] = 0.004 * t; mp[k * 3 + 2] = nz - z;
    }
    clothGeo.morphAttributes.position = [new THREE.Float32BufferAttribute(mp, 3)];
    clothGeo.morphTargetsRelative = true;
  }
  const skinMesh = new THREE.SkinnedMesh(skinGeo, skinMat);
  const clothMesh = new THREE.SkinnedMesh(clothGeo, clothMat);
  for (const m of [skinMesh, clothMesh]) {
    m.bind(skeleton, new THREE.Matrix4());
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, S.height * 0.5, 0.05), S.height * 0.78);
    m.castShadow = m.receiveShadow = shadows;
    // its own shadow-pass material: three's shared one would switch program variants (skinned,
    // skinned + morphed, the scene's plain and instanced casters) several times every frame
    m.customDepthMaterial = keep(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
    group.add(m);
  }
  skinMesh.name = 'figure-skin'; clothMesh.name = 'figure-cloth';

  // ---------------------------------------------------------------- hair: the cap (scalp volume)
  const hairCol = new THREE.Color(S.hairColor), tipCol = new THREE.Color(S.hairTip);
  const long = S.hairStyle === 'long';
  // the hairline: for each azimuth round the crown, how far down the hair reaches (polar angle from
  // the crown) — to the forehead's soft arch, down the sides of her face to the cheeks (Deepu, ears
  // covered), and to the nape at the back
  const inFace = (dx, dy, dz) => {
    if (dz < 0.04) return false;
    const e = long ? (dx / 0.78) ** 2 + ((dy + 0.33) / 0.85) ** 2
      : (dx / 0.8) ** 2 + ((dy + 0.3) / 0.86) ** 2 - 0.1 * Math.exp(-((Math.abs(dx) - 0.5) ** 2) / 0.02) * smooth(0.2, 0.5, dy);
    return e < 1;
  };
  const inEar = (dx, dy, dz) => !long && Math.abs(dx) > 0.7 && dy < 0.05 && dz > -0.32 && dz < 0.4;
  const NB = 240, thetaB = new Float32Array(NB + 1);
  for (let i = 0; i <= NB; i++) {
    const ph = (i / NB - 0.5) * TAU;
    let th = 0.02;
    for (; th < Math.PI * 0.9; th += 0.004) {
      const dx = Math.sin(th) * Math.sin(ph), dy = Math.cos(th), dz = Math.sin(th) * Math.cos(ph);
      if (inFace(dx, dy, dz) || inEar(dx, dy, dz) || dy < (long ? -0.6 : lerp(-0.44, -0.66, smooth(-0.1, -0.6, dz)))) break;
    }
    thetaB[i] = th;
  }
  for (let pass = 0; pass < 6; pass++) {
    const c = thetaB.slice();
    for (let i = 0; i <= NB; i++) thetaB[i] = (c[(i - 1 + NB) % NB] + 2 * c[i] + c[(i + 1) % NB]) / 4;
  }
  const thetaAt = (ph) => { const f = ((ph / TAU + 0.5) % 1 + 1) % 1 * NB, i = Math.floor(f); return lerp(thetaB[i], thetaB[Math.min(NB, i + 1)], f - i); };
  const capMask = (dx, dy, dz) => {
    const th = Math.acos(clamp(dy, -1, 1)), tb = thetaAt(Math.atan2(dx, dz));
    return smooth(tb + 0.01, tb - 0.12, th);
  };
  // (short hair) the swept coordinate and its wave clumps: shared by the volume, the colour and the flow
  const sweepOf = (dx, dy, dz) => dz * 0.85 - dx * 0.55 + dy * 0.2;
  const shortHair = (dx, dy, dz) => {
    const top = smooth(-0.2, 0.85, dy);
    const sw = sweepOf(dx, dy, dz);
    const clump = (0.5 + 0.5 * Math.sin(sw * 10.5 + Math.sin(dx * 7) * 0.9)) * (0.65 + 0.35 * Math.sin(dx * 13 + dz * 4 + 1.3));
    const quiff = 0.014 * smooth(0.25, 0.85, dz) * smooth(0.3, 0.85, dy) * smooth(0.55, -0.25, dx);
    const part = -0.007 * Math.exp(-((dx - 0.36) ** 2) / 0.003) * smooth(0.25, 0.6, dy) * smooth(-0.4, 0.2, dz);
    return 0.018 * top * (0.85 + 0.15 * dz) + 0.016 * clump * smooth(-0.1, 0.45, dy) + quiff + part;
  };
  const capThick = (dx, dy, dz) => {
    if (long) return 0.0115 + 0.007 * smooth(0.2, 1, dy) + 0.004 * smooth(0.0, -0.6, dz);
    // short, dark, wavy, a little tousled: a side part, volume swept up and over from it, rounded wave
    // clumps across the sweep (they also scallop the silhouette), close and neat at the sides
    return 0.009 + shortHair(dx, dy, dz);
  };
  const capM = new Mesher();
  const capNu = [48, 72, 96][q], capNv = [12, 16, 20][q];
  const _cn = new THREE.Vector3();
  grid(capM, {
    nu: capNu, nv: capNv, wrapU: true,
    pos(u, v, out) {
      const ph = (u - 0.5) * TAU, th = lerp(0.012, thetaAt(ph), v);
      _hd.set(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
      headPoint(_hd.x, _hd.y, _hd.z, out, false).multiplyScalar(HR);
      _cn.copy(out).normalize();
      // full volume over the head, rolling softly down onto the skin at the hairline
      const off = capThick(_hd.x, _hd.y, _hd.z) * (1 - 0.82 * smooth(0.78, 1, v) ** 1.3) - 0.0024 * smooth(0.9, 1, v);
      out.addScaledVector(_cn, off).add(hc);
    },
    inside(u, v, p, out) { out.copy(hc); },
    // the strands' flow: from the centre part down each side (long), swept back (short); the
    // texture's streaks run along v, the anisotropic highlight across them
    uv(u, v, p) {
      _hd.copy(p).sub(hc).normalize();
      if (!long) return [Math.atan2(_hd.x, _hd.y) * 2.2, Math.atan2(-_hd.z, Math.hypot(_hd.x, _hd.y)) * 1.4];
      const al = Math.atan2(_hd.z, _hd.y), be = Math.asin(clamp(_hd.x, -1, 1));
      return [al * 2.6, Math.abs(be) * 1.6];
    },
    color(p) {
      _hd.copy(p).sub(hc).normalize();
      const part = long ? smooth(0.013, 0.003, Math.abs(_hd.x)) * smooth(0.2, 0.42, _hd.y) * smooth(-0.3, 0.0, _hd.z) : 0;
      if (!long) {
        const sw = sweepOf(_hd.x, _hd.y, _hd.z), c = (0.5 + 0.5 * Math.sin(sw * 10.5 + Math.sin(_hd.x * 7) * 0.9)) * (0.65 + 0.35 * Math.sin(_hd.x * 13 + _hd.z * 4 + 1.3));
        const k = 0.5 + 0.85 * c;
        return [hairCol.r * k, hairCol.g * k, hairCol.b * k];
      }
      return [lerp(hairCol.r, 0.2, part * 0.32), lerp(hairCol.g, 0.13, part * 0.32), lerp(hairCol.b, 0.1, part * 0.32)];
    },
    tangent(p, u, v, n) {
      _hd.copy(p).sub(hc).normalize();
      if (long) {
        const al = Math.atan2(_hd.z, _hd.y), be = Math.asin(clamp(_hd.x, -1, 1)), sg = be >= 0 ? 1 : -1;
        _v1.set(Math.cos(be) * sg, -Math.abs(Math.sin(be)) * Math.cos(al), -Math.abs(Math.sin(be)) * Math.sin(al));
        if (_hd.z < -0.2) _v1.lerp(_v2.set(0, -1, 0), smooth(-0.2, -0.7, _hd.z));
      } else _v1.set(0.35, -0.25, -1);
      _v1.addScaledVector(n, -_v1.dot(n));
      if (_v1.lengthSq() < 1e-8) _v1.set(0, -1, 0);
      _v1.normalize();
      return [_v1.x, _v1.y, _v1.z];
    },
  });
  const capGeo = keep(toGeometry(capM, { skinned: false, color: true, tangent: true }));
  const capMesh = new THREE.Mesh(capGeo, hairMat);
  capMesh.name = 'figure-hair-cap';
  // the hair receives shadows but casts none (a hair shadow across her face reads as a smudge)
  capMesh.castShadow = false; capMesh.receiveShadow = shadows;
  bones[B.head].add(capMesh);

  // ---------------------------------------------------------------- hair: strands (verlet chains)
  // Long hair = a continuous CURTAIN lofted across a row of chains round the back of the head (no gaps,
  // a soft sheen, a natural line of tips) + a few separate layered RIBBONS on top (a front section
  // over each shoulder, side layers). Short hair = a sculpted cap + a few loose locks.
  // Chains per quality: 15 / 10 / 6.
  const strands = [], ribbons = [], curtain = [];
  const segs = long ? [4, 6, 8][q] : [2, 2, 3][q];
  const mkStrand = (o) => {
    const st = { segs, id: strands.length, front: false, side: 1, a: 1, off: 0.003, kind: 'ribbon', width: 0, lanes: [{ c: 0, w: 1, len: 1, lift: 0, tint: 1 }], ...o };
    strands.push(st); (st.kind === 'curtain' ? curtain : ribbons).push(st);
    return st;
  };
  if (long) {
    const partDir = (ph, side) => new THREE.Vector3(side * 0.035, Math.cos(ph), Math.sin(ph)).normalize();
    // sub-locks across a section: centre offset c and width w (fractions of the section), length,
    // lift off the section, brightness — so the edge of the hair is layered, never one flat card
    const LANES3 = [{ c: -0.36, w: 0.46, len: 0.9, lift: 0.002, tint: 0.9 }, { c: 0.02, w: 0.58, len: 1, lift: 0.007, tint: 1.04 }, { c: 0.38, w: 0.44, len: 0.83, lift: 0.003, tint: 0.96 }];
    const LANES2 = [{ c: -0.26, w: 0.6, len: 0.93, lift: 0.003, tint: 0.94 }, { c: 0.26, w: 0.58, len: 1, lift: 0.006, tint: 1.08 }];
    // (a front section over EACH shoulder, as in her photos — the right one a touch shorter and
    // lighter, in two sub-locks, never a mirror copy — on every tier; the side layers behind come
    // with quality)
    const RB = [
      { side: 1, a: 0, front: true, ph: 0.86, rel: [0.9, -0.32, 0.28], hang: 0.66, width: 0.09, off: 0.011, lanes: LANES3 },
      { side: -1, a: 0, front: true, ph: 0.84, rel: [-0.9, -0.34, 0.26], hang: 0.6, width: 0.086, off: 0.011, lanes: LANES2 },
      { side: -1, a: 0.1, ph: 0.8, rel: [-0.9, -0.42, -0.14], hang: 0.78, width: 0.094, off: 0.007, lanes: LANES2 },
      { side: 1, a: 0.35, ph: 0.35, rel: [0.84, -0.32, -0.42], hang: 0.86, width: 0.096, off: 0.008, lanes: LANES2 },
    ].slice(0, [2, 3, 4][q]);
    for (const r of RB) mkStrand({ ...r, rootDir: partDir(r.ph, r.side), relDir: new THREE.Vector3(...r.rel).normalize(), hang: r.hang * (0.98 + R() * 0.04) });
    const nC = [4, 7, 11][q];
    for (let i = 0; i < nC; i++) {
      const ps = lerp(-1.3, 1.3, i / (nC - 1));
      mkStrand({
        kind: 'curtain', side: ps < 0 ? -1 : 1, ps,
        rootDir: new THREE.Vector3(Math.sin(ps) * 0.62, 0.42, -Math.cos(ps) * 0.72).normalize(),
        relDir: new THREE.Vector3(Math.sin(ps) * 0.95, -0.36 - 0.14 * Math.cos(ps), -Math.cos(ps) * 0.9).normalize(),
        hang: lerp(0.84, 0.94, Math.cos(ps * 0.9) ** 2) * (0.99 + R() * 0.02), off: 0.0025,
      });
    }
  } else {
    const n = 0; // his short hair is the sculpted cap (no loose locks)
    for (let j = 0; j < n; j++) {
      const x0 = 0.18 + j * 0.16;
      mkStrand({ side: 1, a: 1, rootDir: new THREE.Vector3(x0 - 0.1, 0.9, 0.2).normalize(), relDir: new THREE.Vector3(x0 + 0.12, 0.62, 0.76).normalize(), hang: 0.045 + 0.012 * j, width: 0.036, off: 0.02 });
    }
  }
  const nRigid = long ? [6, 8, 10][q] : 5;
  const SUB = long ? 3 : 2;
  const NC = [5, 7, 7][q]; // columns across a lock (a rounded lens cross-section)
  const ROWS = nRigid + segs * SUB;
  let nParticles = 0;
  for (const st of strands) {
    st.p0 = nParticles; st.n = st.segs + 1; nParticles += st.n;
    st.rows = ROWS;
    // the rigid part over the scalp (head-local, relative to the head bone)
    st.rC = new Float32Array(nRigid * 3); st.rT = new Float32Array(nRigid * 3); st.rN = new Float32Array(nRigid * 3);
    // the path over the scalp: a spherical quadratic through a raised midpoint, so the front sections
    // follow the hairline over the temples instead of cutting across the forehead
    const mid = _v4.copy(st.rootDir).add(st.relDir).normalize();
    if (long) mid.y += 0.34 * (1 - st.a) ** 2;
    mid.normalize();
    const ctrl = _v5.copy(mid).multiplyScalar(2).addScaledVector(st.rootDir, -0.5).addScaledVector(st.relDir, -0.5);
    const pts = [];
    for (let k = 0; k < nRigid; k++) {
      const t = k / (nRigid - 1);
      _v1.copy(st.rootDir).multiplyScalar((1 - t) * (1 - t)).addScaledVector(ctrl, 2 * t * (1 - t)).addScaledVector(st.relDir, t * t).normalize();
      headPoint(_v1.x, _v1.y, _v1.z, _v2, false).multiplyScalar(HR);
      const m = capMask(_v1.x, _v1.y, _v1.z);
      _v3.copy(_v2).normalize();
      // tucked under the sleek cap over the crown, emerging toward the nape / behind the ears
      const off = long ? m * capThick(_v1.x, _v1.y, _v1.z) - 0.0035 + (st.off + 0.005) * smooth(0.4, 0.95, t)
        : Math.max(0.6, m) * capThick(_v1.x, _v1.y, _v1.z) + st.off - (1 - smooth(0, 0.3, t)) * 0.004;
      _v2.addScaledVector(_v3, off).add(hc);
      pts.push(_v2.clone());
      st.rN[k * 3] = _v3.x; st.rN[k * 3 + 1] = _v3.y; st.rN[k * 3 + 2] = _v3.z;
    }
    let rl = 0;
    for (let k = 0; k < nRigid; k++) {
      const p = pts[k];
      st.rC[k * 3] = p.x; st.rC[k * 3 + 1] = p.y; st.rC[k * 3 + 2] = p.z;
      const a2 = pts[Math.max(0, k - 1)], b2 = pts[Math.min(nRigid - 1, k + 1)];
      _v1.subVectors(b2, a2).normalize();
      st.rT[k * 3] = _v1.x; st.rT[k * 3 + 1] = _v1.y; st.rT[k * 3 + 2] = _v1.z;
      if (k) rl += p.distanceTo(pts[k - 1]);
    }
    st.rigidLen = rl;
    st.release = pts[nRigid - 1].clone();
    st.relT = new THREE.Vector3(st.rT[(nRigid - 1) * 3], st.rT[(nRigid - 1) * 3 + 1], st.rT[(nRigid - 1) * 3 + 2]);
    st.before = pts[nRigid - 2].clone();
    // segment lengths: shorter near the root (the drape over the shoulders needs the resolution)
    st.L = new Float32Array(st.segs);
    let wsum = 0;
    for (let i = 0; i < st.segs; i++) wsum += 0.55 + 0.45 * (i / Math.max(1, st.segs - 1));
    for (let i = 0; i < st.segs; i++) st.L[i] = (st.hang * (0.55 + 0.45 * (i / Math.max(1, st.segs - 1)))) / wsum;
    st.total = rl + st.hang;
    st.tint = 0.92 + R() * 0.16;
    st.phase = R() * TAU;
    st.sg = new Float32Array(ROWS);
    for (let r = 0; r < ROWS; r++) st.sg[r] = r < nRigid ? (r / (nRigid - 1)) * (rl / st.total) : (rl + st.hang * ((r - nRigid + 1) / (st.segs * SUB))) / st.total;
  }
  const HP = new Float32Array(nParticles * 3), HQ = new Float32Array(nParticles * 3);
  const GH = new Float32Array(nParticles * 3), GC = new Float32Array(nParticles * 3);
  const PK = new Float32Array(nParticles), PMIX = new Float32Array(nParticles), PRAD = new Float32Array(nParticles);
  for (const st of strands) {
    for (let i = 0; i < st.n; i++) {
      const s = i / st.segs;
      PK[st.p0 + i] = long ? 0.18 * (1 - s) ** 2.2 + 0.012 : 0.35 * (1 - s) + 0.08;
      PMIX[st.p0 + i] = long ? smooth(0.05, 0.45, s) : 0;
      // ribbons rest on top of the curtain: they keep a little further from the body
      PRAD[st.p0 + i] = st.kind === 'curtain' ? 0.008 : 0.008 + st.off * 0.4;
    }
  }
  // vertex blocks: ribbons (ROWS × NC each), then the curtain grid (ROWS × NCC)
  const nC = curtain.length;
  const SUBC = [2, 3, 3][q];
  const NCC = nC ? (nC - 1) * SUBC + 1 : 0;
  const nLanes = ribbons.reduce((n, st) => n + st.lanes.length, 0);
  const hairVerts = nLanes * ROWS * NC + ROWS * NCC;
  const hPos = new Float32Array(hairVerts * 3), hNor = new Float32Array(hairVerts * 3), hTan = new Float32Array(hairVerts * 4);
  const hUV = new Float32Array(hairVerts * 2), hCol = new Float32Array(hairVerts * 3);
  const hIdx = [];
  const tintAt = (k, sgv, tint) => {
    const tk = smooth(0.55, 1, sgv) * 0.6;
    hCol[k * 3] = lerp(hairCol.r, tipCol.r, tk) * tint; hCol[k * 3 + 1] = lerp(hairCol.g, tipCol.g, tk) * tint; hCol[k * 3 + 2] = lerp(hairCol.b, tipCol.b, tk) * tint;
    hTan[k * 4 + 3] = 1;
  };
  let laneV = 0;
  for (const st of ribbons) {
    st.lanes = st.lanes.map((l) => ({ ...l }));
    st.lanes.forEach((ln, li) => {
      ln.v0 = laneV; laneV += ROWS * NC;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < NC; c++) {
          const k = ln.v0 + r * NC + c, a = (c / (NC - 1)) * 2 - 1;
          hUV[k * 2] = (c / (NC - 1)) * 0.33 + li * 0.33;
          hUV[k * 2 + 1] = st.sg[r] * st.total * 3.2;
          // darker at a lock's edges (the soft occlusion between locks), brighter on its crown
          tintAt(k, st.sg[r], st.tint * ln.tint * (0.72 + 0.28 * (1 - a * a)));
          if (r < ROWS - 1 && c < NC - 1) { const a2 = k, b = k + 1, d = k + NC, e = k + NC + 1; hIdx.push(a2, d, b, b, d, e); }
        }
      }
    });
  }
  const CV0 = laneV;
  // the curtain's clumps: a gentle ripple across it (position + normal), so the light finds strands
  const CWs = new Float32Array(NCC), CWc = new Float32Array(NCC);
  for (let k = 0; k < NCC; k++) { const ph = k * 1.85 + R() * 0.9; CWs[k] = Math.sin(ph); CWc[k] = Math.cos(ph); }
  const CF = new Float32Array(NCC); // per-column length (a soft, uneven line of tips)
  const CHR = new Float32Array(Math.max(1, nC) * ROWS * 3);
  for (let k = 0; k < NCC; k++) {
    const onChain = k % SUBC === 0;
    CF[k] = onChain ? 1 - R() * 0.015 : 0.93 + R() * 0.05;
    const ci = Math.min(nC - 1, Math.floor(k / SUBC));
    const tint = 0.9 + R() * 0.2;
    for (let r = 0; r < ROWS; r++) {
      const kk = CV0 + r * NCC + k;
      const sgv = curtain[ci].sg[r];
      hUV[kk * 2] = (k / Math.max(1, NCC - 1)) * (NCC / 7);
      hUV[kk * 2 + 1] = sgv * curtain[ci].total * 3.2;
      tintAt(kk, sgv, tint);
      if (r < ROWS - 1 && k < NCC - 1) { const a = kk, b = kk + 1, d = kk + NCC, e = kk + NCC + 1; hIdx.push(a, d, b, b, d, e); }
    }
  }
  const hairGeo = keep(new THREE.BufferGeometry());
  const aPos = new THREE.BufferAttribute(hPos, 3).setUsage(THREE.DynamicDrawUsage);
  const aNor = new THREE.BufferAttribute(hNor, 3).setUsage(THREE.DynamicDrawUsage);
  const aTan = new THREE.BufferAttribute(hTan, 4).setUsage(THREE.DynamicDrawUsage);
  hairGeo.setAttribute('position', aPos); hairGeo.setAttribute('normal', aNor); hairGeo.setAttribute('tangent', aTan);
  hairGeo.setAttribute('uv', new THREE.BufferAttribute(hUV, 2)); hairGeo.setAttribute('color', new THREE.BufferAttribute(hCol, 3));
  hairGeo.setIndex(hIdx);
  hairGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, S.height * 0.55, 0), S.height * 0.75);
  const hairMesh = new THREE.Mesh(hairGeo, hairMat);
  hairMesh.name = 'figure-hair';
  hairMesh.castShadow = false; hairMesh.receiveShadow = shadows;
  if (hairVerts) group.add(hairMesh);

  // colliders (figure space, recomputed per frame from the bones): [boneA, ax, ay, az, boneB, bx, by, bz, r]
  const COL = [];
  const col = (ba, pa, bb, pb, r) => COL.push({ ba, pa: new THREE.Vector3(...pa), bb, pb: new THREE.Vector3(...pb), r });
  {
    const hcx = [hc.x, hc.y, hc.z];
    col(B.head, hcx, B.head, hcx, long ? HR * 1.0 + 0.008 : HR * 1.04 + 0.022);
    col(B.head, [0, hc.y - HR * 0.75, hc.z + HR * 0.15], B.head, [0, hc.y - HR * 0.75, hc.z + HR * 0.15], HR * 0.7);
    // a 'visor' in front of the face (stops above the chin): hair never swings across her face
    if (long) col(B.head, [0, hc.y - HR * 0.12, hc.z + HR * 0.5], B.head, [0, hc.y - HR * 0.12, hc.z + HR * 0.5], HR * 0.72);
    col(B.neck, [0, -0.05, 0], B.head, [0, 0.03, -0.01], long ? 0.064 : 0.05);
    col(B.shoulderL, [0, 0.0, 0], B.shoulderR, [0, 0.0, 0], long ? 0.066 : 0.07);
    if (long) {
      for (const s of [1, -1]) {
        const top = [s * 0.075, J.chest[1] + 0.07 - J.chest[1], -0.004];
        col(B.chest, top, B.hips, [s * 0.075, 0.0, 0.0], 0.084);
        col(s > 0 ? B.shoulderL : B.shoulderR, [0, 0, 0], s > 0 ? B.elbowL : B.elbowR, [0, 0, 0], 0.058);
        col(s > 0 ? B.elbowL : B.elbowR, [0, 0, 0], s > 0 ? B.wristL : B.wristR, [0, 0, 0], 0.034);
        col(s > 0 ? B.wristL : B.wristR, [0, -0.05, 0], s > 0 ? B.wristL : B.wristR, [0, -0.05, 0], 0.045);
        col(s > 0 ? B.hipL : B.hipR, [0, 0.02, 0], s > 0 ? B.kneeL : B.kneeR, [0, -0.02, 0], 0.125);
      }
      col(B.hips, [0, -0.03, 0.0], B.hips, [0, -0.03, 0.0], 0.112);
      col(B.chest, [-0.07, 0.06, -0.004], B.chest, [0.07, 0.06, -0.004], 0.08);
    }
  }
  const NCOL = COL.length;
  const CA = new Float32Array(NCOL * 3), CB = new Float32Array(NCOL * 3), CR = new Float32Array(NCOL);

  // ---------------------------------------------------------------- state
  const FM = bones.map(() => new THREE.Matrix4());
  const st = {
    t: 0,
    poseW: new Float32Array(4), poseT: new Float32Array(4), seat: 0.43, side: 1, poseRate: 3.2,
    exprW: new Float32Array(6), exprT: new Float32Array(6),
    blush: 0, blushT: 0,
    look: false, lookTarget: new THREE.Vector3(), lookSpeed: 4, yaw: 0, pitch: 0, eyeYaw: 0, eyePitch: 0,
    blinkT: 1.2, blinkP: -1, sacT: 0.8, sacX: 0, sacY: 0, sacCX: 0, sacCY: 0,
    walkK: 0, walkT: 0, walkSpeed: 0.6, walkPhase: 0,
    hairReady: false,
  };
  const P = new Float32Array(PN), PS = POSES.map((n) => poseTable(S, n, 0.43, 1));
  const AG = POSES.map((n) => armGoal(S, n, 1, 0.43));
  const arms = [0, 1].map((k) => ({
    side: k === 0 ? 1 : -1, sb: k === 0 ? B.shoulderL : B.shoulderR, eb: k === 0 ? B.elbowL : B.elbowR,
    wb: k === 0 ? B.wristL : B.wristR, fb: k === 0 ? B.handL : B.handR, socket: k === 0 ? socketL : socketR,
    k: 0, kT: 0, speed: 1, target: new THREE.Vector3(), has: false, sm: new THREE.Vector3(), vel: new THREE.Vector3(), init: false,
    socketFig: new THREE.Vector3(), held: null, heldParent: null, holdK: 0, holdT: 0, snap: true, align: false,
  }));
  const legs = [0, 1].map((k) => ({ side: k === 0 ? 1 : -1, hb: k === 0 ? B.hipL : B.hipR, kb: k === 0 ? B.kneeL : B.kneeR, ab: k === 0 ? B.ankleL : B.ankleR, fi: k === 0 ? I_FOOTL : I_FOOTR }));
  const tgt = new THREE.Vector3(), pole = new THREE.Vector3(), palm = new THREE.Vector3(), tmpT = new THREE.Vector3(), tmpN = new THREE.Vector3();
  const groupInv = new THREE.Matrix4();
  const headW = new THREE.Matrix4(), chestW = new THREE.Matrix4();
  const headWI = new THREE.Matrix4(), chestWI = new THREE.Matrix4();
  const wScale = { s: 1 };

  // ---------------------------------------------------------------- per-frame helpers
  const setLocalEuler = (bi, rx, ry, rz) => { bones[bi].quaternion.setFromEuler(_e1.set(rx, ry, rz, 'YXZ')); };
  const fmUpdate = (bi) => { const b = bones[bi]; b.updateMatrix(); if (PARENT[bi] < 0) FM[bi].copy(b.matrix); else FM[bi].multiplyMatrices(FM[PARENT[bi]], b.matrix); };
  const fmPos = (bi, out) => out.setFromMatrixPosition(FM[bi]);
  const fmQuat = (bi, out) => out.setFromRotationMatrix(FM[bi]);
  const toFig = (worldPos, out) => out.copy(worldPos).applyMatrix4(groupInv);

  function blendPose() {
    for (let i = 0; i < PN; i++) P[i] = PS[0][i];
    for (let p = 1; p < 4; p++) {
      const w = st.poseW[p];
      if (w < 1e-4) continue;
      const T = PS[p];
      for (let i = 0; i < PN; i++) P[i] += (T[i] - PS[0][i]) * w;
    }
  }

  // body avoidance for hand goals (figure space): push the goal out of the torso / skirt / head
  const skirtR = S.outfit === 'kurti' ? 0.112 : 0.085; // a flared kurti vs slim trousers
  function avoidBody(p, r) {
    for (let c = 0; c < 7; c++) {
      let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0, rr = 0;
      if (c === 0) { fmPos(B.chest, _v5); fmPos(B.hips, _v6); ax = _v5.x; ay = _v5.y + 0.06; az = _v5.z; bx = _v6.x; by = _v6.y; bz = _v6.z; rr = 0.1; }
      else if (c === 1 || c === 6) { const s = c === 1 ? 1 : -1; _v5.set(s * 0.06, -0.02, 0).applyMatrix4(FM[B.hips]); _v6.set(s * 0.06, -0.3, 0).applyMatrix4(FM[B.hips]); ax = _v5.x; ay = _v5.y; az = _v5.z; bx = _v6.x; by = _v6.y; bz = _v6.z; rr = skirtR; }
      else if (c === 2) { _v5.copy(hc).applyMatrix4(FM[B.head]); ax = bx = _v5.x; ay = by = _v5.y; az = bz = _v5.z; rr = HR * 1.02; }
      else if (c === 3 || c === 4) { const s = c === 3 ? 1 : -1; fmPos(B.chest, _v5); _v6.set(s * 0.075, 0.03, 0.0).applyMatrix4(FM[B.chest]); ax = bx = _v6.x; ay = by = _v6.y; az = bz = _v6.z; rr = 0.1; }
      else if (c === 5) { fmPos(B.hips, _v5); ax = bx = _v5.x; ay = by = _v5.y + 0.08; az = bz = _v5.z - 0.01; rr = 0.1; }
      const abx = bx - ax, aby = by - ay, abz = bz - az;
      const ll = abx * abx + aby * aby + abz * abz;
      const t = ll > 1e-9 ? clamp(((p.x - ax) * abx + (p.y - ay) * aby + (p.z - az) * abz) / ll, 0, 1) : 0;
      const cx = ax + abx * t, cy = ay + aby * t, cz = az + abz * t;
      let dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz), need = rr + r;
      if (d < need) {
        if (d < 1e-5) { dx = 0; dy = 0; dz = 1; } else { dx /= d; dy /= d; dz /= d; }
        p.set(cx + dx * need, cy + dy * need, cz + dz * need);
      }
    }
  }

  // hand orientation (figure space) from a finger direction and a palm normal
  function handBasis(arm, fdir, pn, out) {
    _Y.copy(fdir).negate();
    _X.copy(pn).addScaledVector(_Y, -pn.dot(_Y));
    if (_X.lengthSq() < 1e-8) _X.set(1, 0, 0).addScaledVector(_Y, -_Y.x);
    _X.normalize().multiplyScalar(arm.side > 0 ? -1 : 1);
    _Z.crossVectors(_X, _Y).normalize();
    _X.crossVectors(_Y, _Z);
    _mb.makeBasis(_X, _Y, _Z);
    return out.setFromRotationMatrix(_mb);
  }

  function solveArm(arm, goal, poleV, palmV, curl) {
    const side = arm.side;
    fmPos(arm.sb, _S);
    // two passes: the socket (not the wrist) goes to the goal
    tmpT.copy(goal);
    for (let pass = 0; pass < 2; pass++) {
      const theta = solveTwoBone(_S, tmpT, L1a, L2a, poleV, -1, _qU);
      // forearm direction = upper rotated by the bend
      _v1.set(0, -1, 0).applyAxisAngle(XAXIS, -theta).applyQuaternion(_qU); // forearm dir (figure)
      // fingers continue the forearm, folded a little toward the palm
      tmpN.copy(palmV).addScaledVector(_v1, -palmV.dot(_v1));
      if (tmpN.lengthSq() < 1e-8) tmpN.set(-side, 0, 0); else tmpN.normalize();
      _v2.copy(_v1).multiplyScalar(Math.cos(0.16)).addScaledVector(tmpN, Math.sin(0.16)).normalize();
      handBasis(arm, _v2, tmpN, _qH);
      // where is the socket for this wrist?
      _v3.copy(arm.socket.position).applyQuaternion(_qH);
      _v4.copy(_E).addScaledVector(_v1, L2a); // wrist
      if (pass === 0) tmpT.copy(goal).sub(_v3);
      else {
        // write bones: upper (local = chest⁻¹ · upper), forearm (hinge), hand (local = fore⁻¹ · hand)
        fmQuat(B.chest, _q1);
        bones[arm.sb].quaternion.copy(_q1.invert()).multiply(_qU);
        bones[arm.eb].quaternion.setFromAxisAngle(XAXIS, -theta);
        _q2.copy(_qU).multiply(bones[arm.eb].quaternion);
        bones[arm.wb].quaternion.copy(_q2.invert()).multiply(_qH);
        bones[arm.fb].quaternion.setFromAxisAngle(_v5.set(0, 0, 1), -side * curl * 1.1);
      }
    }
    fmUpdate(arm.sb); fmUpdate(arm.eb); fmUpdate(arm.wb); fmUpdate(arm.fb);
    arm.socketFig.copy(arm.socket.position).applyMatrix4(FM[arm.wb]);
  }

  // ---------------------------------------------------------------- the frame
  function update(dt, time) {
    dt = clamp(dt || 0, 0, 0.1);
    st.t += dt;
    const t = time ?? st.t;
    group.updateWorldMatrix(true, false);
    groupInv.copy(group.matrixWorld).invert();
    wScale.s = _v1.setFromMatrixColumn(group.matrixWorld, 0).length() || 1;

    // eased values
    for (let p = 1; p < 4; p++) st.poseW[p] = damp(st.poseW[p], st.poseT[p], st.poseRate, dt);
    for (let e = 0; e < 6; e++) st.exprW[e] = damp(st.exprW[e], st.exprT[e], 9, dt);
    st.blush = damp(st.blush, st.blushT, 5, dt);
    st.walkK = damp(st.walkK, st.walkT, 4, dt);
    const sitW = st.poseW[1], photoW = st.poseW[3];

    // blinks and saccades
    st.blinkT -= dt;
    if (st.blinkT <= 0) { st.blinkP = 0; st.blinkT = R() < 0.15 ? 0.32 : 2.2 + R() * 3.4; }
    let blink = 0;
    if (st.blinkP >= 0) {
      st.blinkP += dt;
      const bp = st.blinkP;
      blink = bp < 0.065 ? bp / 0.065 : clamp(1 - (bp - 0.085) / 0.12, 0, 1);
      if (bp > 0.21) st.blinkP = -1;
    }
    st.sacT -= dt;
    if (st.sacT <= 0) {
      st.sacT = 0.6 + R() * 1.9;
      const amp = st.look ? 0.05 : 0.14;
      st.sacX = (R() - 0.5) * 2 * amp; st.sacY = (R() - 0.5) * amp;
    }
    st.sacCX = damp(st.sacCX, st.sacX, 30, dt); st.sacCY = damp(st.sacCY, st.sacY, 30, dt);

    // body numbers: pose + idle (breathing, weight shift) + walk
    blendPose();
    const calm = 1 - 0.6 * photoW;
    const breath = Math.sin(t * TAU / 4.3);
    const sway = Math.sin(t * TAU / 7.7 + 0.6) * (1 - sitW) * calm;
    const wk = st.walkK, wph = st.walkPhase;
    if (wk > 1e-3) st.walkPhase += dt * TAU * (st.walkSpeed / 0.62);
    const ex = st.exprW;
    const delight = ex[2], surprise = ex[3], chew = ex[4];

    // hips
    const hb0 = restLocal[B.hips];
    bones[B.hips].position.set(hb0.x + P[0] + sway * 0.009, hb0.y + P[1] + Math.abs(Math.sin(wph)) * 0.012 * wk - 0.008 * wk, hb0.z + P[2]);
    setLocalEuler(B.hips, P[3] + 0.04 * wk, P[4] + Math.sin(wph) * 0.08 * wk, P[5] + sway * 0.02 + Math.cos(wph) * 0.025 * wk);
    fmUpdate(B.root); fmUpdate(B.hips);
    setLocalEuler(B.spine, P[6] + breath * 0.006, P[7] - Math.sin(wph) * 0.05 * wk, P[8] - sway * 0.012);
    fmUpdate(B.spine);
    setLocalEuler(B.chest, P[9] + breath * 0.014 - surprise * 0.04, P[10] - Math.sin(wph) * 0.05 * wk, P[11] - sway * 0.008 + Math.sin(t * 9) * 0.015 * delight);
    fmUpdate(B.chest);

    // gaze: target angles in the chest frame; eyes lead, the head follows
    let yawT = Math.sin(t * 0.21) * 0.06 * calm, pitchT = Math.sin(t * 0.17 + 1) * 0.03 * calm;
    fmPos(B.head, _v1); _v1.y += hc.y;
    if (st.look) {
      toFig(st.lookTarget, _v2).sub(_v1);
      fmQuat(B.chest, _q1).invert();
      _v2.applyQuaternion(_q1);
      yawT = clamp(Math.atan2(_v2.x, _v2.z), -1.15, 1.15);
      pitchT = clamp(Math.atan2(_v2.y, Math.hypot(_v2.x, _v2.z)), -0.62, 0.5);
    }
    const ls = st.lookSpeed;
    st.yaw = damp(st.yaw, yawT, ls, dt); st.pitch = damp(st.pitch, pitchT, ls, dt);
    st.eyeYaw = damp(st.eyeYaw, yawT + st.sacCX, 22, dt); st.eyePitch = damp(st.eyePitch, pitchT + st.sacCY, 22, dt);
    const nod = Math.sin(t * 0.53) * 0.012 * calm + chew * Math.sin(t * TAU * 2.2) * 0.012 - surprise * 0.05 + delight * 0.03;
    // looking down, the eyes do most of the work (the head bows only a little: calm, and the hair stays clear)
    const bp = st.pitch > 0 ? st.pitch * 0.9 : Math.max(st.pitch * 0.9, -0.36);
    setLocalEuler(B.neck, P[12] - bp * 0.38 + nod * 0.4, P[13] + st.yaw * 0.35, P[14]);
    fmUpdate(B.neck);
    setLocalEuler(B.head, P[15] - bp * 0.62 + nod, P[16] + st.yaw * 0.65 + Math.sin(t * 0.37) * 0.015 * calm, P[17] + delight * 0.06 * Math.sin(t * 5.5) + 0.03 * delight);
    fmUpdate(B.head);

    // face numbers
    let fo = 0, fh = 0, fl = 0, fby = 0, fbi = 0, fs = 0, fop = 0, fw = 0, fr = 0, fj = 0, fc = 0, fp = 0;
    {
      let wsum = 0;
      for (let e = 1; e < 6; e++) wsum += ex[e];
      const wn = Math.max(0, 1 - wsum);
      for (let c = 0; c < 12; c++) FACC[c] = EX_ROWS[0][c] * wn;
      for (let e = 1; e < 6; e++) if (ex[e] > 1e-4) { const row = EX_ROWS[e], w = ex[e]; for (let c = 0; c < 12; c++) FACC[c] += row[c] * w; }
      const norm = wn + wsum;
      if (norm > 1) for (let c = 0; c < 12; c++) FACC[c] /= norm;
      fo = FACC[0]; fh = FACC[1]; fl = FACC[2]; fby = FACC[3]; fbi = FACC[4]; fs = FACC[5];
      fop = FACC[6]; fw = FACC[7]; fr = FACC[8]; fj = FACC[9]; fc = FACC[10]; fp = FACC[11];
      fs += F.rest * wn;
    }
    const chewOsc = chew * (0.5 + 0.5 * Math.sin(t * TAU * 2.2));
    fj += chewOsc * 0.05;
    bones[B.jaw].quaternion.setFromAxisAngle(XAXIS, fj);
    fmUpdate(B.jaw);
    const open = fo * (1 - blink);
    U.fEyeL.value.set(open, fh, fl, 1); U.fEyeR.value.set(open, fh, fl, 1);
    const ey = clamp((st.eyeYaw - st.yaw * 0.85) / 0.7, -1, 1), ep = clamp((st.eyePitch - bp) / 0.5, -1, 1);
    U.fLook.value.set(ey * F.eye[2] * 0.36, ep * F.eye[3] * 0.32, 1 - 0.12 * surprise, 0);
    U.fBrow.value.set(fby * 0.09, fby * 0.09, fbi, fbi);
    U.fMouth.value.set(fs - chewOsc * 0.15, fop + chewOsc * 0.0, fw + chewOsc * 0.08, fr);
    U.fMisc.value.x = F.baseBlush + fc + st.blush * 0.85;
    U.fMisc.value.y = fp;
    clothMesh.morphTargetInfluences[0] = sitW;

    // legs: feet planted (pose targets) with the knees pointing forward
    for (let i_L = 0; i_L < legs.length; i_L++) {
      const L = legs[i_L];
      fmUpdate(L.hb);
      fmPos(L.hb, _S);
      const fi = L.fi;
      _T.set(P[fi], P[fi + 1], P[fi + 2]);
      if (wk > 1e-3) {
        const ph = wph + (L.side > 0 ? 0 : Math.PI);
        const sw2 = Math.sin(ph), lift = Math.max(0, Math.cos(ph));
        _T.z += sw2 * 0.13 * wk; _T.y += lift * 0.05 * wk;
      }
      fmQuat(B.hips, _q1);
      pole.set(L.side * P[I_KNEE] * 0.5, 0.15 * sitW, 1).applyQuaternion(_q1);
      const theta = solveTwoBone(_S, _T, L1l, L2l, pole, 1, _qU);
      // local = hips⁻¹ · upper
      fmQuat(B.hips, _q3);
      bones[L.hb].quaternion.copy(_q3.invert()).multiply(_qU);
      bones[L.kb].quaternion.setFromAxisAngle(XAXIS, theta);
      fmUpdate(L.hb); fmUpdate(L.kb);
      // the foot stays flat, turned by the pose's yaw
      fmQuat(L.kb, _q1).invert();
      _q2.setFromAxisAngle(YAXIS, P[fi + 3]);
      bones[L.ab].quaternion.copy(_q1).multiply(_q2);
      fmUpdate(L.ab);
    }

    // arms: pose goals → reach goals (eased) → body avoidance → IK
    for (let i_arm = 0; i_arm < arms.length; i_arm++) {
      const arm = arms[i_arm];
      const side = arm.side;
      fmPos(arm.sb, _v1);
      bones[arm.sb].position.y = restLocal[arm.sb].y + (breath + 1) * 0.0018 + delight * 0.008 * (0.5 + 0.5 * Math.sin(t * 11 + (side > 0 ? 0 : 1.6)));
      fmUpdate(arm.sb);
      fmPos(arm.sb, _v1);
      tgt.set(0, 0, 0); pole.set(0, 0, 0); palm.set(0, 0, 0);
      let curl = 0, wsum = 0;
      for (let p = 0; p < 4; p++) {
        const w = p === 0 ? 1 - (st.poseW[1] + st.poseW[2] + st.poseW[3]) : st.poseW[p];
        if (w < 1e-4) continue;
        const g = AG[p];
        let gt = g.t;
        if (g.tR && side < 0) gt = g.tR;
        const gx = g.tR ? gt[0] : gt[0] * side;
        if (g.mode === 'hang') {
          fmQuat(B.chest, _q1);
          _v2.set(gx, 0, gt[2]).applyQuaternion(_q1);
          _v2.y = gt[1];
          _v2.add(_v1);
          _v2.z += Math.sin(wph + (side > 0 ? Math.PI : 0)) * 0.07 * wk;
        } else {
          _v2.set(gx, gt[1], gt[2]).applyMatrix4(FM[B.hips]);
        }
        tgt.addScaledVector(_v2, w);
        fmQuat(B.chest, _q1);
        _v3.set(g.pole[0] * side, g.pole[1], g.pole[2]).applyQuaternion(_q1); pole.addScaledVector(_v3, w);
        _v3.set(g.palm[0] * side, g.palm[1], g.palm[2]).applyQuaternion(_q1); palm.addScaledVector(_v3, w);
        curl += g.curl * w; wsum += w;
      }
      if (wsum > 0) { tgt.divideScalar(wsum); curl /= wsum; }
      // reach: an eased (critically damped) goal; palm down for low goals, toward the face near the mouth
      arm.k = damp(arm.k, arm.kT, 5.5 * arm.speed, dt);
      if (arm.k > 1e-3 && arm.has) {
        toFig(arm.target, _v2);
        if (!arm.init) { arm.sm.copy(arm.socketFig.lengthSq() > 0 ? arm.socketFig : tgt); arm.vel.set(0, 0, 0); arm.init = true; }
        const w = 7.5 * arm.speed, e = Math.exp(-w * dt);
        for (let c = 0; c < 3; c++) {
          const x = arm.sm.getComponent(c), v = arm.vel.getComponent(c), g = _v2.getComponent(c);
          const y = x - g, tmp = (v + w * y) * dt;
          arm.sm.setComponent(c, g + (y + tmp) * e);
          arm.vel.setComponent(c, (v - w * tmp) * e);
        }
        const kk = arm.k * arm.k * (3 - 2 * arm.k);
        // palm / pole for the reach
        _v3.copy(hc).applyMatrix4(FM[B.head]);
        const hi = smooth(_v1.y - 0.16, _v3.y - 0.06, arm.sm.y);
        _v4.subVectors(_v3, arm.sm).normalize();
        fmQuat(B.chest, _q1);
        _v5.set(-0.35 * side, -1, 0.1).applyQuaternion(_q1).normalize();
        _v5.lerp(_v4, hi).normalize();
        _v6.set(0.85 * side, -1, -0.3 + 0.35 * hi).applyQuaternion(_q1).normalize();
        tgt.lerp(arm.sm, kk);
        palm.lerp(_v5, kk);
        pole.lerp(_v6, kk);
        curl = lerp(curl, 0.35, kk);
      } else if (arm.k <= 1e-3) arm.init = false;
      arm.holdK = damp(arm.holdK, arm.holdT, 8, dt);
      curl = lerp(curl, 0.9, arm.holdK);
      if (pole.lengthSq() < 1e-8) pole.set(side, -1, -1);
      pole.normalize(); palm.normalize();
      avoidBody(tgt, 0.03);
      solveArm(arm, tgt, pole, palm, curl);
    }

    // world matrices for skinning, anchors and held things
    group.updateMatrixWorld(true);
    for (let i_arm = 0; i_arm < arms.length; i_arm++) {
      const arm = arms[i_arm];
      const o = arm.held;
      if (!o) continue;
      if (arm.snap) { o.position.x = damp(o.position.x, 0, 10, dt); o.position.y = damp(o.position.y, 0, 10, dt); o.position.z = damp(o.position.z, 0, 10, dt); }
      if (arm.align) { _q1.identity(); o.quaternion.slerp(_q1, 1 - Math.exp(-10 * dt)); }
    }
    if (nParticles) { simulateHair(dt, t); writeHair(); }
  }

  // ---------------------------------------------------------------- hair simulation (world space)
  function colliders() {
    const s = wScale.s;
    for (let c = 0; c < NCOL; c++) {
      const C = COL[c];
      _v1.copy(C.pa).applyMatrix4(FM[C.ba]).applyMatrix4(group.matrixWorld);
      _v2.copy(C.pb).applyMatrix4(FM[C.bb]).applyMatrix4(group.matrixWorld);
      CA[c * 3] = _v1.x; CA[c * 3 + 1] = _v1.y; CA[c * 3 + 2] = _v1.z;
      CB[c * 3] = _v2.x; CB[c * 3 + 1] = _v2.y; CB[c * 3 + 2] = _v2.z;
      CR[c] = C.r * s;
    }
  }
  function collide(i, floorY) {
    let px = HP[i * 3], py = HP[i * 3 + 1], pz = HP[i * 3 + 2];
    const pr = PRAD[i] * wScale.s;
    let hit = false;
    for (let c = 0; c < NCOL; c++) {
      const ax = CA[c * 3], ay = CA[c * 3 + 1], az = CA[c * 3 + 2];
      const abx = CB[c * 3] - ax, aby = CB[c * 3 + 1] - ay, abz = CB[c * 3 + 2] - az;
      const ll = abx * abx + aby * aby + abz * abz;
      const tt = ll > 1e-10 ? clamp(((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / ll, 0, 1) : 0;
      const cx = ax + abx * tt, cy = ay + aby * tt, cz = az + abz * tt;
      let dx = px - cx, dy = py - cy, dz = pz - cz;
      const d2 = dx * dx + dy * dy + dz * dz, need = CR[c] + pr;
      if (d2 < need * need) {
        const d = Math.sqrt(d2);
        if (d < 1e-6) { dx = 0; dy = 0; dz = -1; } else { dx /= d; dy /= d; dz /= d; }
        px = cx + dx * need; py = cy + dy * need; pz = cz + dz * need; hit = true;
      }
    }
    if (py < floorY + pr) { py = floorY + pr; hit = true; }
    HP[i * 3] = px; HP[i * 3 + 1] = py; HP[i * 3 + 2] = pz;
    return hit;
  }
  const relW = new THREE.Vector3(), relTW = new THREE.Vector3(), combW = new THREE.Vector3(), combX = new THREE.Vector3();
  let comb = 0; // while settling: comb the front section forward and the rest back
  const headPrev = new THREE.Vector3(), headPrevI = new THREE.Matrix4(), jumpM = new THREE.Matrix4();
  function simulateHair(dt, t) {
    headW.multiplyMatrices(group.matrixWorld, FM[B.head]);
    chestW.multiplyMatrices(group.matrixWorld, FM[B.chest]);
    colliders();
    const s = wScale.s;
    // the floor / seat under the hair
    const sitW = st.poseW[1];
    _v1.set(0, lerp(0, st.seat + 0.004, smooth(0.3, 0.9, sitW)), 0).applyMatrix4(group.matrixWorld);
    const floorY = _v1.y;
    if (!st.hairReady) { st.hairReady = true; initHair(); }
    else {
      // a jump (a scene placed the figure somewhere else in one go, or a very slow frame): carry the
      // hair rigidly with the head instead of letting the chains whip across the gap
      _v1.setFromMatrixPosition(headW);
      const jump = _v1.distanceToSquared(headPrev) > (0.2 * s) * (0.2 * s);
      if (jump) {
        jumpM.multiplyMatrices(headW, headPrevI);
        const e = jumpM.elements;
        for (let i = 0; i < nParticles * 3; i += 3) {
          let x = HP[i], y = HP[i + 1], z = HP[i + 2];
          HP[i] = e[0] * x + e[4] * y + e[8] * z + e[12]; HP[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; HP[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
          x = HQ[i]; y = HQ[i + 1]; z = HQ[i + 2];
          HQ[i] = e[0] * x + e[4] * y + e[8] * z + e[12]; HQ[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; HQ[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        }
      }
    }
    headPrev.setFromMatrixPosition(headW);
    headPrevI.copy(headW).invert();
    if (dt <= 0) return;
    if (comb) { combW.set(0, 0, 1).transformDirection(group.matrixWorld); combX.set(1, 0, 0).transformDirection(group.matrixWorld); }
    const n = Math.min(4, Math.max(1, Math.ceil(dt / (1 / 60))));
    const h = dt / n;
    const g = -9.8 * s * h * h;
    const dampF = Math.pow(0.935, h * 60);
    const kScale = h * 60;
    const iters = q === 2 ? 3 : 2;
    const wind = fig.wind;
    for (let step = 0; step < n; step++) {
      for (let i_sd = 0; i_sd < strands.length; i_sd++) {
        const sd = strands[i_sd];
        const p0 = sd.p0;
        relW.copy(sd.release).applyMatrix4(headW);
        relTW.copy(sd.relT).transformDirection(headW);
        HP[p0 * 3] = relW.x; HP[p0 * 3 + 1] = relW.y; HP[p0 * 3 + 2] = relW.z;
        HQ[p0 * 3] = relW.x; HQ[p0 * 3 + 1] = relW.y; HQ[p0 * 3 + 2] = relW.z;
        for (let i = 1; i < sd.n; i++) {
          const k = (p0 + i) * 3;
          const x = HP[k], y = HP[k + 1], z = HP[k + 2];
          let vx = (x - HQ[k]) * dampF, vy = (y - HQ[k + 1]) * dampF, vz = (z - HQ[k + 2]) * dampF;
          HQ[k] = x; HQ[k + 1] = y; HQ[k + 2] = z;
          if (wind > 0) { const wv = wind * 0.00035 * s * kScale * (0.6 + 0.4 * Math.sin(t * 1.7 + sd.phase + i * 0.4)) * (i / sd.segs); vx += wv * 0.6; vz += wv; }
          let nx = x + vx, ny = y + vy + g, nz = z + vz;
          if (comb) {
            const out = sd.kind === 'curtain' ? Math.sin(sd.ps) : sd.side * 0.8;
            const cb = (sd.front ? 0.0012 : sd.kind === 'curtain' ? -0.0003 : -0.0008) * s * (i / sd.segs), cx = sd.front ? 0 : out * (sd.kind === 'curtain' ? 0.0007 : 0.0002) * s * (i / sd.segs);
            nx += combW.x * cb + combX.x * cx; ny += combW.y * cb + combX.y * cx; nz += combW.z * cb + combX.z * cx;
          }
          // shape goal: head space near the root, chest space toward the tips
          const gi = (p0 + i) * 3, mix = PMIX[p0 + i];
          _v2.set(GH[gi], GH[gi + 1], GH[gi + 2]).applyMatrix4(headW);
          _v3.set(GC[gi], GC[gi + 1], GC[gi + 2]).applyMatrix4(chestW);
          _v2.lerp(_v3, mix);
          const kk = Math.min(1, PK[p0 + i] * kScale);
          nx += (_v2.x - nx) * kk; ny += (_v2.y - ny) * kk; nz += (_v2.z - nz) * kk;
          HP[k] = nx; HP[k + 1] = ny; HP[k + 2] = nz;
        }
        // the first segment leaves the scalp along the scalp's direction
        {
          const k = (p0 + 1) * 3, L0 = sd.L[0] * s;
          const gx = relW.x + relTW.x * L0, gy = relW.y + relTW.y * L0, gz = relW.z + relTW.z * L0;
          const kk = Math.min(1, 0.55 * kScale);
          HP[k] += (gx - HP[k]) * kk; HP[k + 1] += (gy - HP[k + 1]) * kk; HP[k + 2] += (gz - HP[k + 2]) * kk;
        }
      }
      for (let it = 0; it < iters; it++) {
        for (let i_sd = 0; i_sd < strands.length; i_sd++) {
          const sd = strands[i_sd];
          const p0 = sd.p0;
          for (let i = 0; i < sd.segs; i++) {
            const a = (p0 + i) * 3, b = (p0 + i + 1) * 3;
            const dx = HP[b] - HP[a], dy = HP[b + 1] - HP[a + 1], dz = HP[b + 2] - HP[a + 2];
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
            const diff = (d - sd.L[i] * s) / d;
            if (i === 0) { HP[b] -= dx * diff; HP[b + 1] -= dy * diff; HP[b + 2] -= dz * diff; }
            else {
              HP[a] += dx * diff * 0.35; HP[a + 1] += dy * diff * 0.35; HP[a + 2] += dz * diff * 0.35;
              HP[b] -= dx * diff * 0.65; HP[b + 1] -= dy * diff * 0.65; HP[b + 2] -= dz * diff * 0.65;
            }
          }
          for (let i = 1; i < sd.n; i++) {
            const k = p0 + i;
            const bx = HP[k * 3], by = HP[k * 3 + 1], bz = HP[k * 3 + 2];
            if (collide(k, floorY)) {
              // friction: lose some of the velocity along the surface
              HQ[k * 3] += (bx - HQ[k * 3]) * 0.25;
              HQ[k * 3 + 1] += (by - HQ[k * 3 + 1]) * 0.25;
              HQ[k * 3 + 2] += (bz - HQ[k * 3 + 2]) * 0.25;
            }
          }
          // segment midpoints: keep the ribbon between particles out of the body too
          for (let i = 1; i < sd.segs; i++) {
            const a = (p0 + i) * 3, b = (p0 + i + 1) * 3;
            const mx = (HP[a] + HP[b]) * 0.5, my = (HP[a + 1] + HP[b + 1]) * 0.5, mz = (HP[a + 2] + HP[b + 2]) * 0.5;
            for (let c = 0; c < NCOL; c++) {
              const ax = CA[c * 3], ay = CA[c * 3 + 1], az = CA[c * 3 + 2];
              const abx = CB[c * 3] - ax, aby = CB[c * 3 + 1] - ay, abz = CB[c * 3 + 2] - az;
              const ll = abx * abx + aby * aby + abz * abz;
              const tt = ll > 1e-10 ? clamp(((mx - ax) * abx + (my - ay) * aby + (mz - az) * abz) / ll, 0, 1) : 0;
              const cx = ax + abx * tt, cy = ay + aby * tt, cz = az + abz * tt;
              const dx = mx - cx, dy = my - cy, dz = mz - cz;
              const d2 = dx * dx + dy * dy + dz * dz, need = CR[c] + PRAD[p0 + i] * s;
              if (d2 < need * need && d2 > 1e-12) {
                const d = Math.sqrt(d2), push = (need - d) / d;
                HP[a] += dx * push; HP[a + 1] += dy * push; HP[a + 2] += dz * push;
                HP[b] += dx * push; HP[b + 1] += dy * push; HP[b + 2] += dz * push;
              }
            }
          }
        }
      }
    }
  }
  function initHair() {
    // lay every strand from its release point (down the back, or over the shoulder in front), then
    // let it fall and settle against the body in the bind pose; the rest shape becomes the goal shape
    const s = wScale.s;
    for (let i_sd = 0; i_sd < strands.length; i_sd++) {
      const sd = strands[i_sd];
      relW.copy(sd.release).applyMatrix4(headW);
      relTW.copy(sd.relT).transformDirection(headW);
      _v1.copy(relW);
      if (sd.front) _v2.set(sd.side * 0.3, -1, 0.5).transformDirection(group.matrixWorld);
      else if (sd.kind === 'curtain') _v2.set(Math.sin(sd.ps) * 0.5, -1, -0.3).transformDirection(group.matrixWorld);
      else if (long) _v2.set(sd.side * 0.38, -1, -0.32).transformDirection(group.matrixWorld);
      else _v2.set(sd.side * 0.4, -0.6, 0.7).transformDirection(group.matrixWorld);
      for (let i = 0; i < sd.n; i++) {
        const k = (sd.p0 + i) * 3;
        if (i > 0) {
          const L = sd.L[i - 1] * s;
          _v3.copy(relTW).lerp(_v2, smooth(0, 2, i)).normalize();
          _v1.addScaledVector(_v3, L);
        }
        HP[k] = _v1.x; HP[k + 1] = _v1.y; HP[k + 2] = _v1.z;
        HQ[k] = _v1.x; HQ[k + 1] = _v1.y; HQ[k + 2] = _v1.z;
      }
    }
    // goals = current shape for the settle, then capture the settled shape
    captureGoals();
    const save = PK.slice();
    PK.fill(0.0);
    comb = 1;
    for (let i = 0; i < 150; i++) simulateHair(1 / 60, i / 60);
    comb = 0;
    PK.set(save);
    captureGoals();
  }
  function captureGoals() {
    headWI.copy(headW).invert(); chestWI.copy(chestW).invert();
    for (let i = 0; i < nParticles; i++) {
      _v1.set(HP[i * 3], HP[i * 3 + 1], HP[i * 3 + 2]);
      _v2.copy(_v1).applyMatrix4(headWI); GH[i * 3] = _v2.x; GH[i * 3 + 1] = _v2.y; GH[i * 3 + 2] = _v2.z;
      _v2.copy(_v1).applyMatrix4(chestWI); GC[i * 3] = _v2.x; GC[i * 3 + 1] = _v2.y; GC[i * 3 + 2] = _v2.z;
    }
  }

  // ---------------------------------------------------------------- hair ribbons (figure space)
  const CP = new Float32Array(16 * 3);
  const _axA = new THREE.Vector3(), _axB = new THREE.Vector3();
  const rowC = new THREE.Vector3(), rowT = new THREE.Vector3(), rowN = new THREE.Vector3(), relN = new THREE.Vector3();
  const RNx = new Float32Array(64 * 3);
  /** One sub-lock's row: a rounded lens across the lock, tapering to a soft point at its own tip.
   *  (Integer / object arguments only, arithmetic on locals: nothing is boxed per frame.) */
  function writeLane(sd, ln, r) {
    // a shorter sub-lock samples the section's curve (RCx / RTx / RNx) up to its own length
    const rig = r < nRigid;
    const rr = rig ? r : nRigid + (r - nRigid) * ln.len;
    const r0 = Math.min(ROWS - 1, Math.floor(rr)), r1 = Math.min(ROWS - 1, r0 + 1), f = rr - r0;
    const a0 = r0 * 3, a1 = r1 * 3;
    const cx0 = RCx[a0] + (RCx[a1] - RCx[a0]) * f, cy0 = RCx[a0 + 1] + (RCx[a1 + 1] - RCx[a0 + 1]) * f, cz0 = RCx[a0 + 2] + (RCx[a1 + 2] - RCx[a0 + 2]) * f;
    let tx = RTx[a0] + (RTx[a1] - RTx[a0]) * f, ty = RTx[a0 + 1] + (RTx[a1 + 1] - RTx[a0 + 1]) * f, tz = RTx[a0 + 2] + (RTx[a1 + 2] - RTx[a0 + 2]) * f;
    let nx = RNx[a0] + (RNx[a1] - RNx[a0]) * f, ny = RNx[a0 + 1] + (RNx[a1 + 1] - RNx[a0 + 1]) * f, nz = RNx[a0 + 2] + (RNx[a1 + 2] - RNx[a0 + 2]) * f;
    let l = 1 / (Math.sqrt(tx * tx + ty * ty + tz * tz) || 1); tx *= l; ty *= l; tz *= l;
    // the across direction S = T × N, then N = S × T (orthonormal frame)
    let sx = ty * nz - tz * ny, sy = tz * nx - tx * nz, sz = tx * ny - ty * nx;
    l = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (l < 1e-5) { sx = 1; sy = 0; sz = 0; } else { sx /= l; sy /= l; sz /= l; }
    nx = sy * tz - sz * ty; ny = sz * tx - sx * tz; nz = sx * ty - sy * tx;
    l = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1); nx *= l; ny *= l; nz *= l;
    // width / thickness along the lock
    const sgv = sd.sg[r], uf = rig ? 0 : (r - nRigid) / Math.max(1, ROWS - 1 - nRigid);
    const rf = sd.rigidLen / sd.total;
    let W;
    if (rig) { const k = clamp(sgv / (rf * 0.8), 0, 1); W = sd.width * (0.6 + 0.4 * k * k * (3 - 2 * k)); }
    else if (long) {
      const a = clamp(uf / 0.35, 0, 1), b = clamp((uf - 0.5) / 0.5, 0, 1), bs = b * b * (3 - 2 * b);
      W = sd.width * (1 + 0.28 * a * a * (3 - 2 * a)) * (1 - 0.93 * Math.pow(bs, 1.25));
    } else { const b = clamp((uf - 0.3) / 0.7, 0, 1); W = sd.width * (1 - 0.8 * b * b * (3 - 2 * b)); }
    const lw = W * ln.w;
    const cxo = W * ln.c * 0.5 * (rig ? 0.75 : 1 + 0.2 * uf);
    let grow = 1;
    if (rig) { const g = clamp((sgv / Math.max(rf, 1e-3) - 0.35) / 0.65, 0, 1); grow = g * g * (3 - 2 * g); }
    const th = (lw * 0.26 + 0.0015) * grow, lift = ln.lift * grow;
    const base = ln.v0 + r * NC;
    for (let c = 0; c < NC; c++) {
      const a = (c / (NC - 1)) * 2 - 1;
      const k = base + c;
      const off = cxo + a * lw * 0.5, h = lift + th * Math.sqrt(Math.max(0, 1 - a * a));
      hPos[k * 3] = cx0 + sx * off + nx * h;
      hPos[k * 3 + 1] = cy0 + sy * off + ny * h;
      hPos[k * 3 + 2] = cz0 + sz * off + nz * h;
      let mx = nx + sx * a * 1.1, my = ny + sy * a * 1.1, mz = nz + sz * a * 1.1;
      const ml = 1 / (Math.sqrt(mx * mx + my * my + mz * mz) || 1);
      mx *= ml; my *= ml; mz *= ml;
      hNor[k * 3] = mx; hNor[k * 3 + 1] = my; hNor[k * 3 + 2] = mz;
      hTan[k * 4] = tx; hTan[k * 4 + 1] = ty; hTan[k * 4 + 2] = tz;
    }
  }
  // the rows of one chain (figure space): the rigid part carried by the head, then a Catmull-Rom
  // curve through the simulated particles (continuous with the scalp at the release)
  const RCx = new Float32Array(64 * 3), RTx = new Float32Array(64 * 3);
  function computeRows(sd, HMf) {
    for (let r = 0; r < nRigid; r++) {
      _v1.set(sd.rC[r * 3], sd.rC[r * 3 + 1], sd.rC[r * 3 + 2]).applyMatrix4(HMf);
      RCx[r * 3] = _v1.x; RCx[r * 3 + 1] = _v1.y; RCx[r * 3 + 2] = _v1.z;
      _v1.set(sd.rT[r * 3], sd.rT[r * 3 + 1], sd.rT[r * 3 + 2]).transformDirection(HMf);
      RTx[r * 3] = _v1.x; RTx[r * 3 + 1] = _v1.y; RTx[r * 3 + 2] = _v1.z;
    }
    _v1.copy(sd.before).applyMatrix4(HMf);
    CP[0] = _v1.x; CP[1] = _v1.y; CP[2] = _v1.z;
    for (let i = 0; i < sd.n; i++) {
      const k = (sd.p0 + i) * 3;
      _v1.set(HP[k], HP[k + 1], HP[k + 2]).applyMatrix4(groupInv);
      CP[(i + 1) * 3] = _v1.x; CP[(i + 1) * 3 + 1] = _v1.y; CP[(i + 1) * 3 + 2] = _v1.z;
    }
    const m = sd.n + 1;
    for (let c = 0; c < 3; c++) CP[m * 3 + c] = 2 * CP[(m - 1) * 3 + c] - CP[(m - 2) * 3 + c];
    let r = nRigid;
    for (let i = 0; i < sd.segs; i++) {
      for (let sb = 1; sb <= SUB; sb++, r++) {
        const tt = sb / SUB;
        let dl = 0;
        for (let c = 0; c < 3; c++) {
          const p0 = CP[i * 3 + c], p1 = CP[(i + 1) * 3 + c], p2 = CP[(i + 2) * 3 + c], p3 = CP[(i + 3) * 3 + c];
          RCx[r * 3 + c] = 0.5 * (2 * p1 + (-p0 + p2) * tt + (2 * p0 - 5 * p1 + 4 * p2 - p3) * tt * tt + (-p0 + 3 * p1 - 3 * p2 + p3) * tt * tt * tt);
          const der = 0.5 * ((-p0 + p2) + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * tt + 3 * (-p0 + 3 * p1 - 3 * p2 + p3) * tt * tt);
          RTx[r * 3 + c] = der; dl += der * der;
        }
        dl = Math.sqrt(dl) || 1;
        RTx[r * 3] /= dl; RTx[r * 3 + 1] /= dl; RTx[r * 3 + 2] /= dl;
      }
    }
  }
  const outward = (p, out) => {
    // away from the body's axis (head centre → below the hips)
    _v2.subVectors(_axB, _axA);
    const tq = clamp(_v3.subVectors(p, _axA).dot(_v2) / _v2.lengthSq(), 0, 1);
    return out.subVectors(p, _v3.copy(_axA).addScaledVector(_v2, tq));
  };
  function writeHair() {
    const HMf = FM[B.head];
    _axA.copy(hc).applyMatrix4(HMf);
    fmPos(B.hips, _axB); _axB.y -= 0.1;
    // separate ribbons
    for (let i_sd = 0; i_sd < ribbons.length; i_sd++) {
      const sd = ribbons[i_sd];
      computeRows(sd, HMf);
      for (let r = 0; r < ROWS; r++) {
        rowC.set(RCx[r * 3], RCx[r * 3 + 1], RCx[r * 3 + 2]);
        rowT.set(RTx[r * 3], RTx[r * 3 + 1], RTx[r * 3 + 2]);
        if (r < nRigid) {
          rowN.set(sd.rN[r * 3], sd.rN[r * 3 + 1], sd.rN[r * 3 + 2]).transformDirection(HMf);
          if (r === nRigid - 1) relN.copy(rowN);
        } else {
          outward(rowC, rowN);
          if (sd.front && long) rowN.z += 0.04;
          rowN.normalize();
          rowN.lerp(relN, 1 - smooth(0, 0.22, (r - nRigid) / (sd.segs * SUB))).normalize();
        }
        RNx[r * 3] = rowN.x; RNx[r * 3 + 1] = rowN.y; RNx[r * 3 + 2] = rowN.z;
      }
      for (let i_ln = 0; i_ln < sd.lanes.length; i_ln++) {
        const ln = sd.lanes[i_ln];
        for (let r = 0; r < ROWS; r++) writeLane(sd, ln, r);
      }
    }
    if (nC) {
      // the curtain: chain rows, then a loft across them (Catmull-Rom across the chains), the tips
      // gathering into soft clumps at the ends
      for (let c = 0; c < nC; c++) {
        computeRows(curtain[c], HMf);
        const o = c * ROWS * 3;
        for (let k = 0; k < ROWS * 3; k++) CHR[o + k] = RCx[k];
      }
      for (let k = 0; k < NCC; k++) {
        const ci = Math.min(nC - 1, Math.floor(k / SUBC));
        const w0 = k === NCC - 1 ? 0 : (k % SUBC) / SUBC;
        const fk = CF[k];
        const c0 = Math.max(0, ci - 1), c2 = Math.min(nC - 1, ci + 1), c3 = Math.min(nC - 1, ci + 2);
        for (let r = 0; r < ROWS; r++) {
          const sgv = curtain[ci].sg[r];
          const tg = clamp((sgv - 0.72) / 0.28, 0, 1), w = w0 + ((w0 < 0.5 ? 0 : 1) - w0) * tg * tg * (3 - 2 * tg) * 0.55;
          const rr = r < nRigid ? r : nRigid + (r - nRigid) * fk;
          const r0 = Math.min(ROWS - 1, Math.floor(rr)), r1 = Math.min(ROWS - 1, r0 + 1), fr = rr - r0;
          const kk = CV0 + r * NCC + k;
          // (inlined: a Catmull-Rom across the four neighbouring chains, each sampled between two rows)
          const b0 = c0 * ROWS * 3, b1 = ci * ROWS * 3, b2 = c2 * ROWS * 3, b3 = c3 * ROWS * 3, ra = r0 * 3, rb = r1 * 3;
          const w2 = w * w, w3 = w2 * w;
          for (let c = 0; c < 3; c++) {
            const q0 = CHR[b0 + ra + c] + (CHR[b0 + rb + c] - CHR[b0 + ra + c]) * fr;
            const q1 = CHR[b1 + ra + c] + (CHR[b1 + rb + c] - CHR[b1 + ra + c]) * fr;
            const q2 = CHR[b2 + ra + c] + (CHR[b2 + rb + c] - CHR[b2 + ra + c]) * fr;
            const q3 = CHR[b3 + ra + c] + (CHR[b3 + rb + c] - CHR[b3 + ra + c]) * fr;
            hPos[kk * 3 + c] = 0.5 * (2 * q1 + (-q0 + q2) * w + (2 * q0 - 5 * q1 + 4 * q2 - q3) * w2 + (-q0 + 3 * q1 - 3 * q2 + q3) * w3);
          }
        }
      }
      // normals (across × along), oriented away from the body; tangents along the hair
      // (plain arithmetic on the buffers: this runs for every curtain vertex, every frame)
      const axX = _axA.x, axY = _axA.y, axZ = _axA.z;
      const adX = _axB.x - axX, adY = _axB.y - axY, adZ = _axB.z - axZ, adL = adX * adX + adY * adY + adZ * adZ || 1;
      for (let r = 0; r < ROWS; r++) {
        const ra = r > 0 ? r - 1 : 0, rb = r < ROWS - 1 ? r + 1 : ROWS - 1;
        const tilt = r < nRigid ? 0.12 : 0.4;
        for (let k = 0; k < NCC; k++) {
          const ka = k > 0 ? k - 1 : 0, kb = k < NCC - 1 ? k + 1 : NCC - 1;
          const kk = CV0 + r * NCC + k;
          const iA = (CV0 + ra * NCC + k) * 3, iB = (CV0 + rb * NCC + k) * 3;
          const iL = (CV0 + r * NCC + ka) * 3, iR = (CV0 + r * NCC + kb) * 3, iC = kk * 3;
          // along (tangent) and across
          let tx = hPos[iB] - hPos[iA], ty = hPos[iB + 1] - hPos[iA + 1], tz = hPos[iB + 2] - hPos[iA + 2];
          let sx = hPos[iR] - hPos[iL], sy = hPos[iR + 1] - hPos[iL + 1], sz = hPos[iR + 2] - hPos[iL + 2];
          let nx = sy * tz - sz * ty, ny = sz * tx - sx * tz, nz = sx * ty - sy * tx;
          // outward from the body's axis
          const px = hPos[iC], py = hPos[iC + 1], pz = hPos[iC + 2];
          let tq = ((px - axX) * adX + (py - axY) * adY + (pz - axZ) * adZ) / adL;
          tq = tq < 0 ? 0 : tq > 1 ? 1 : tq;
          const ox = px - (axX + adX * tq), oy = py - (axY + adY * tq), oz = pz - (axZ + adZ * tq);
          if (nx * ox + ny * oy + nz * oz < 0) { nx = -nx; ny = -ny; nz = -nz; }
          let nl = nx * nx + ny * ny + nz * nz;
          if (nl < 1e-14) { nx = ox; ny = oy; nz = oz; nl = nx * nx + ny * ny + nz * nz || 1; }
          nl = 1 / Math.sqrt(nl);
          // clump sheen: tilt the normal across the curtain with the ripple
          const sl = 1 / (Math.sqrt(sx * sx + sy * sy + sz * sz) || 1), tw = tilt * CWs[k];
          nx = nx * nl + sx * sl * tw; ny = ny * nl + sy * sl * tw; nz = nz * nl + sz * sl * tw;
          nl = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
          hNor[iC] = nx * nl; hNor[iC + 1] = ny * nl; hNor[iC + 2] = nz * nl;
          const tl = 1 / (Math.sqrt(tx * tx + ty * ty + tz * tz) || 1);
          hTan[kk * 4] = tx * tl; hTan[kk * 4 + 1] = ty * tl; hTan[kk * 4 + 2] = tz * tl;
        }
      }
      // and the matching ripple in depth (below the scalp only)
      for (let r = nRigid; r < ROWS; r++) {
        const g = 0.0024 * smooth(nRigid - 1, nRigid + 2, r);
        for (let k = 0; k < NCC; k++) {
          const kk = CV0 + r * NCC + k, b = g * (0.5 + 0.5 * CWc[k]);
          hPos[kk * 3] += hNor[kk * 3] * b; hPos[kk * 3 + 1] += hNor[kk * 3 + 1] * b; hPos[kk * 3 + 2] += hNor[kk * 3 + 2] * b;
        }
      }
    }
    aPos.needsUpdate = true; aNor.needsUpdate = true; aTan.needsUpdate = true;
  }

  // ---------------------------------------------------------------- public API
  const parts = {};
  BONE_NAMES.forEach((n, i) => { if (n !== 'root') parts[n] = bones[i]; });
  Object.assign(parts, { eyes, browL, browR, mouth, handSocketL: socketL, handSocketR: socketR });
  const sideOf = (side) => (side === 'R' || side === 'right' || side === -1 ? arms[1] : arms[0]);
  let triangles = 0;
  for (const g of [skinGeo, clothGeo, capGeo, hairGeo]) triangles += g.index ? g.index.count / 3 : 0;

  const fig = {
    who: S.who,
    height: S.height,
    group, parts, skeleton,
    materials: { skin: skinMat, cloth: clothMat, hair: hairMat },
    meshes: { skin: skinMesh, cloth: clothMesh, hairCap: capMesh, hair: hairMesh },
    uniforms: U,
    wind: 0,
    stats: { triangles, meshes: hairVerts ? 4 : 3, bones: bones.length, strands: strands.length, particles: nParticles, quality: q },
    update,
    lookAt(pos, speed = 4) {
      if (pos) { st.lookTarget.copy(pos); if (!st.look) st.blinkT = Math.min(st.blinkT, 0.05); st.look = true; } else st.look = false;
      st.lookSpeed = speed;
      return fig;
    },
    reach(side, pos, k = 1, speed = 1) {
      const a = sideOf(side);
      if (pos) { a.target.copy(pos); a.has = true; a.kT = clamp(k, 0, 1); } else a.kT = 0;
      a.speed = speed || 1;
      return fig;
    },
    hold(side, obj, o = {}) {
      const a = sideOf(side);
      if (a.held && a.held !== obj) {
        const prev = a.held;
        if (a.heldParent) a.heldParent.attach(prev); else a.socket.remove(prev);
        a.held = null; a.heldParent = null;
      }
      if (obj) {
        a.heldParent = obj.parent;
        group.updateMatrixWorld(true);
        if (o.snap === 'instant') { a.socket.add(obj); obj.position.set(0, 0, 0); }
        else a.socket.attach(obj);
        a.held = obj; a.snap = o.snap !== false; a.align = !!o.align;
        a.holdT = 1;
      } else a.holdT = 0;
      return fig;
    },
    expression(name, k = 1) {
      const e = EXPRS.indexOf(name);
      for (let i = 0; i < 6; i++) st.exprT[i] = 0;
      if (e > 0) st.exprT[e] = clamp(k, 0, 1);
      return fig;
    },
    blush(k) { st.blushT = clamp(k, 0, 1); return fig; },
    pose(name, k = 1, o = {}) {
      const p = POSES.indexOf(name);
      if (o.seat != null || o.side != null) {
        st.seat = o.seat ?? st.seat; st.side = o.side ?? st.side;
        for (let i = 1; i < 4; i++) { PS[i] = poseTable(S, POSES[i], st.seat, st.side); AG[i] = armGoal(S, POSES[i], st.side, st.seat); }
      }
      for (let i = 1; i < 4; i++) st.poseT[i] = 0;
      if (p > 0) st.poseT[p] = clamp(k, 0, 1);
      st.poseRate = o.rate ?? 3.2;
      return fig;
    },
    walk(k = 1, speed = 0.6) { st.walkT = clamp(k, 0, 1); st.walkSpeed = speed; return fig; },
    settle(sec = 1.2) {
      for (let i = 1; i < 4; i++) st.poseW[i] = st.poseT[i];
      for (let i = 0; i < 6; i++) st.exprW[i] = st.exprT[i];
      st.blush = st.blushT; st.walkK = st.walkT;
      for (const a of arms) { a.k = a.kT; a.holdK = a.holdT; if (a.has) { a.init = true; group.updateWorldMatrix(true, false); a.sm.copy(a.target).applyMatrix4(_m1.copy(group.matrixWorld).invert()); a.vel.set(0, 0, 0); } }
      update(0, st.t);
      if (st.look) { fmPos(B.head, _v1); }
      const n = Math.round(sec * 60);
      for (let i = 0; i < n; i++) update(1 / 60, st.t + 1 / 60);
      return fig;
    },
    mouthWorld(out) { group.updateMatrixWorld(true); return mouth.getWorldPosition(out); },
    socketWorld(side, out) { group.updateMatrixWorld(true); return sideOf(side).socket.getWorldPosition(out); },
    setShadows(cast = true, receive = cast) {
      for (const m of [skinMesh, clothMesh]) m.castShadow = cast;
      for (const m of [skinMesh, clothMesh, capMesh, hairMesh]) m.receiveShadow = receive;
      return fig;
    },
    dispose() {
      for (const a of arms) if (a.held) { if (a.heldParent) a.heldParent.attach(a.held); a.held = null; }
      group.removeFromParent();
      skeleton.dispose();
      own.forEach((x) => x.dispose && x.dispose());
      own.length = 0;
    },
  };
  // (dev only: the per-frame internals, for JIT / allocation checks in dev/figure.html)
  Object.defineProperty(fig, '_internals', { value: { update, simulateHair, writeHair, solveArm, avoidBody } });
  // first frame: pose the body and let the hair fall into place
  update(0, 0);
  return fig;
}

/**
 * A quick self-check (dev): builds each character at every quality, runs a few seconds of every
 * pose / expression / reach, and reports budgets and any NaN. Returns { ok, rows: [...] }.
 */
export function figureSelfTest(env = {}) {
  const rows = [];
  let ok = true;
  for (const who of ['deepu']) {
    for (const quality of [0, 1, 2]) {
      const f = createFigure({ ...env, tier: { quality, shadows: quality >= 1 } }, { who, quality });
      const target = new THREE.Vector3(0.1, 1.0, 0.35);
      const seq = [['pose', 'sit'], ['pose', 'photo'], ['pose', 'lean'], ['pose', 'stand']];
      let nan = false;
      for (const [, name] of seq) {
        f.pose(name, 1); f.expression(EXPRS[(rows.length + name.length) % 6], 1);
        f.reach('R', target, 1); f.lookAt(target);
        for (let i = 0; i < 90; i++) f.update(1 / 60, i / 60);
        f.group.traverse((o) => { if (o.isBone && !Number.isFinite(o.quaternion.x + o.position.y)) nan = true; });
      }
      const budget = quality === 2 ? 40000 : quality === 1 ? 30000 : 20000;
      const row = { who, quality, triangles: f.stats.triangles, meshes: f.stats.meshes, strands: f.stats.strands, nan, withinBudget: f.stats.triangles <= budget };
      if (nan || !row.withinBudget) ok = false;
      rows.push(row);
      f.dispose();
    }
  }
  return { ok, rows };
}
