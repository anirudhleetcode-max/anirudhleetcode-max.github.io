// "What Makes You, You" · movement 2 — manchuria: warm, savoury, cosy.
//
// A small kitchen at night, lit like a home: an enamel pendant over a little round table, a
// warm light under the range hood, a soft blue-orange burner glow (no big flames), a window of
// out-of-focus city lights. A dark carbon-steel wok: crisp, bumpy Manchurian balls in a glossy
// dark sauce (animated normals, slow sauce bubbles), capsicum, onion petals, spring-onion and
// chili rings, steam. Beats (≈25 s — the brief: quality over length; reduced motion ≈23 s with
// veil cuts and still frames):
//   wok    the veil opens on a slow push into the wok: sizzle, steam, the sauce moving
//   toss   one gentle toss (keyed arcs, never physics chaos) — whoosh, sizzle
//   leap   a second toss: ONE ball leaps out; the camera follows it in slow motion to a ceramic
//          bowl on the table, where it lands on the heap (plate)
//   bowl   the sauce glistens, steam rises, spring-onion rings drift down; a slow move round it
//   notice the camera rises: the stylized Deepu (./figure.js) is sitting at the table; she
//          notices, smiles, takes the chopsticks and picks up that very ball
//   bite   she eats it — chew — and delights (eyes in happy crescents, a little sparkle)
//   savour she is already going for one more, and glances at us, caught (env.T.manchuriaLines,
//          if any, are said here)
//   thread the golden thread rises out of the steam, curls and leads on; the veil closes (black)
// A playful fantasy of a food she loves — never a memory, never an event, no brand, no
// restaurant. Contract: ./kit.js. Every material, mesh and texture is made in build(); update()
// writes transforms, attributes and uniforms only (nothing allocated per frame).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStrand, PathSampler, createRig, glowSprite, glowTexture, rng, TAU, clamp, smooth, lerp, damp } from './kit.js';
import { createFigure } from './figure.js';

const DEG = Math.PI / 180;
const BEATS = ['wok', 'toss', 'leap', 'bowl', 'notice', 'bite', 'savour', 'thread'];
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ the set (metres; the figure is 1.6 tall)
const BR = 0.0175;                                  // a Manchurian ball's radius
const TH = 0.7;                                     // table top
const TABLE = V(0.12, 0, 0);
const TR = 0.36;
const SEAT = 0.45;                                  // stool top
const SEAT_AT = V(0.12, 0, -0.6);                   // her feet origin, facing +Z
const MAT_H = 0.004;                                // the woven placemat
const BOWL_AT = V(0.11, TH + MAT_H, -0.13);
const COUNTER = { x0: -1.62, x1: -0.38, z0: -0.98, z1: -0.4, top: 0.88 };
const PT = COUNTER.top + 0.012;                     // the cooktop plate's top
const GT = PT + 0.034;                              // the grate's top
const WR = 0.165, WD = 0.082, WT = 0.0025;          // wok: rim radius, depth, wall
const WRS = (WR * WR + WD * WD) / (2 * WD);         // the radius of its round bottom
const wokY = (r) => WRS - Math.sqrt(Math.max(0, WRS * WRS - r * r)); // inner surface height
const WOK_AT = V(-0.6, GT - (wokY(0.055) - WT), -0.68);
const WOK_YAW = -0.62;                              // (the long handle points to the front-left)
const SAUCE_H = 0.014;                              // the sauce pool's depth in the wok
const LAMP = V(0.12, 1.5, -0.14);                   // the pendant's bulb
const WIN = { x0: -0.26, x1: 0.56, y0: 1.0, y1: 1.86, z: -0.995 };
const BOWL_IN = [[0.0885, 0.054], [0.084, 0.044], [0.077, 0.034], [0.067, 0.025], [0.055, 0.018], [0.04, 0.0142], [0.02, 0.0125], [0.0, 0.012]];

// ------------------------------------------------------------------ shaders
const NOISE_GLSL = /* glsl */`
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }`;

// steam: soft noisy puffs born at up to three sources (the wok, the bowl, a piece held up), rising,
// widening, drifting with a breath of air; one instanced draw, simulated on the GPU
const STEAM_VERT = /* glsl */`
  attribute vec4 aSeed; // seed, source, size, rate
  uniform float uTime; uniform vec3 uSrc0; uniform vec3 uSrc1; uniform vec3 uSrc2; uniform vec3 uOn;
  uniform vec3 uSpread; uniform vec3 uRise; uniform vec3 uWind;
  varying vec2 vUv; varying float vA; varying float vSeed; varying float vLife;
  void main(){
    float s = aSeed.x, src = aSeed.y;
    vec3 base = src < 0.5 ? uSrc0 : (src < 1.5 ? uSrc1 : uSrc2);
    float on = src < 0.5 ? uOn.x : (src < 1.5 ? uOn.y : uOn.z);
    float spread = src < 0.5 ? uSpread.x : (src < 1.5 ? uSpread.y : uSpread.z);
    float rise = src < 0.5 ? uRise.x : (src < 1.5 ? uRise.y : uRise.z);
    float life = fract(uTime * aSeed.w + s * 7.31);
    float ang = s * 61.0;
    vec3 p = base + vec3(cos(ang), 0.0, sin(ang)) * spread * (0.25 + 0.75 * fract(s * 13.7)) * (0.7 + 0.6 * life);
    p.y += life * rise;
    p.x += sin(life * 4.0 + s * 20.0 + uTime * 0.7) * 0.18 * rise * life + uWind.x * life * life;
    p.z += cos(life * 3.3 + s * 11.0 + uTime * 0.6) * 0.18 * rise * life + uWind.z * life * life;
    p.y += uWind.y * life * life;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = aSeed.z * mix(0.45, 1.7, life) * (0.6 + 0.4 * on);
    float rot = s * 6.2831 + life * (fract(s * 3.1) - 0.5) * 2.4;
    float c = cos(rot), si = sin(rot);
    mv.xy += mat2(c, -si, si, c) * position.xy * size;
    vA = on * smoothstep(0.0, 0.2, life) * (1.0 - smoothstep(0.4, 1.0, life)) * smoothstep(0.04, 0.22, -mv.z);
    vUv = uv; vSeed = s; vLife = life;
    gl_Position = projectionMatrix * mv;
  }`;
const STEAM_FRAG = /* glsl */`
  uniform float uTime; uniform vec3 uCol; uniform float uAlpha;
  varying vec2 vUv; varying float vA; varying float vSeed; varying float vLife;
  ${NOISE_GLSL}
  void main(){
    vec2 p = vUv - 0.5;
    float d = length(p) * 2.0;
    float n = fbm(p * 3.2 + vSeed * 17.0 + vec2(0.0, -uTime * 0.12) + vLife * 0.8);
    float a = (1.0 - smoothstep(0.2, 1.0, d)) * smoothstep(0.4, 0.88, n + 0.22 * (1.0 - d));
    a = clamp(a, 0.0, 1.0) * vA * uAlpha;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uCol, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// the burner: little blue tongues with warm tips, round a ring under the wok
const FLAME_VERT = /* glsl */`
  attribute vec2 aF; // angle, seed
  uniform float uTime; uniform vec3 uC; uniform float uR; uniform float uOn;
  varying vec2 vUv; varying float vSeed;
  void main(){
    float a = aF.x, s = aF.y;
    vec3 base = uC + vec3(cos(a) * uR, 0.0, sin(a) * uR);
    float fl = 0.82 + 0.12 * sin(uTime * 23.0 + s * 40.0) + 0.07 * sin(uTime * 37.0 + s * 13.0);
    float h = 0.021 * fl * (0.5 + 0.5 * uOn);
    vec3 outw = vec3(cos(a), 0.0, sin(a));
    vec2 q = position.xy + vec2(0.0, 0.5);
    vec3 wp = base + vec3(0.0, 1.0, 0.0) * q.y * h + outw * q.y * q.y * 0.007;
    vec4 mv = modelViewMatrix * vec4(wp, 1.0);
    vec3 up = normalize((modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    vec3 side = normalize(cross(up, vec3(0.0, 0.0, 1.0)) + vec3(1e-4, 0.0, 0.0));
    mv.xyz += side * position.x * 0.0085 * (1.0 - 0.6 * q.y);
    vUv = q; vSeed = s;
    gl_Position = projectionMatrix * mv;
  }`;
const FLAME_FRAG = /* glsl */`
  uniform float uOn;
  varying vec2 vUv; varying float vSeed;
  void main(){
    float x = (vUv.x - 0.5) * 2.0, y = vUv.y;
    float w = 1.0 - smoothstep(0.0, 1.0, abs(x) / max(0.05, pow(1.0 - y, 0.65)));
    float body = w * smoothstep(0.0, 0.12, y) * (1.0 - smoothstep(0.55, 1.0, y));
    vec3 col = mix(vec3(0.12, 0.3, 1.0), vec3(0.55, 0.75, 1.0), w * (1.0 - y));
    col = mix(col, vec3(1.0, 0.55, 0.18), smoothstep(0.55, 0.95, y) * (0.4 + 0.6 * fract(vSeed * 7.0)));
    gl_FragColor = vec4(col * body * 1.6 * uOn, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// out-of-focus lights: soft discs with a faint brighter rim (fake depth of field)
const BOKEH_VERT = /* glsl */`
  attribute vec3 aPos; attribute vec4 aCol; attribute vec3 aMisc;
  uniform float uTime; uniform float uFront; uniform float uBack;
  varying vec2 vUv; varying vec4 vCol; varying float vA;
  void main(){
    vUv = uv - 0.5; vCol = aCol;
    float seed = aMisc.y;
    bool front = aMisc.z > 0.5;
    vec3 p = aPos;
    p.x += sin(uTime * 0.13 + seed * 31.0) * (front ? 0.006 : 0.01);
    p.y += cos(uTime * 0.11 + seed * 17.0) * (front ? 0.006 : 0.01);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    mv.xy += position.xy * aMisc.x;
    vA = (front ? uFront * smoothstep(0.05, 0.16, -mv.z) * (1.0 - smoothstep(0.7, 1.2, -mv.z)) : uBack) * (0.8 + 0.2 * sin(uTime * (0.4 + seed) + seed * 40.0));
    gl_Position = projectionMatrix * mv;
  }`;
const BOKEH_FRAG = /* glsl */`
  varying vec2 vUv; varying vec4 vCol; varying float vA;
  void main(){
    float d = length(vUv) * 2.0;
    float disc = 1.0 - smoothstep(0.8, 1.0, d);
    float rim = smoothstep(0.6, 0.92, d) * disc * 0.3;
    float a = disc * 0.5 + rim + exp(-d * d * 3.0) * 0.1;
    gl_FragColor = vec4(vCol.rgb * a * vCol.a * vA, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// dust in the pendant's light
const MOTE_VERT = /* glsl */`
  attribute vec3 aPos; attribute vec3 aMisc;
  uniform float uTime; uniform float uBright; uniform vec3 uLamp;
  varying vec2 vUv; varying float vA;
  void main(){
    vUv = uv - 0.5;
    float s = aMisc.y;
    float w = mod(uTime * aMisc.z + s * 13.0, 1.0);
    vec3 p = aPos;
    p.y += (w - 0.5) * 0.35;
    p.x += sin(uTime * 0.21 + s * 40.0) * 0.05;
    p.z += cos(uTime * 0.17 + s * 27.0) * 0.05;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    mv.xy += position.xy * aMisc.x * (1.0 + smoothstep(0.6, 0.15, depth) * 2.0);
    // brightest in the pendant's cone
    vec2 dl = p.xz - uLamp.xz;
    float cone = 1.0 - smoothstep(0.0, 0.45 * (uLamp.y - p.y + 0.15), length(dl));
    vA = smoothstep(0.0, 0.2, w) * smoothstep(1.0, 0.8, w) * smoothstep(0.12, 0.4, depth) * (0.5 + 0.5 * sin(uTime * (0.8 + s) + s * 50.0)) * cone * uBright;
    gl_Position = projectionMatrix * mv;
  }`;
const MOTE_FRAG = /* glsl */`
  varying vec2 vUv; varying float vA;
  void main(){
    float d = length(vUv) * 2.0;
    float a = exp(-d * d * 5.0) * (1.0 - smoothstep(0.8, 1.0, d));
    gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * a * vA, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// ------------------------------------------------------------------ build-time helpers
function hash3(i, j, k, s) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1442695041) ^ Math.imul(s + 1, 2654435761);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** 3D value noise in −1…1 (build time only). */
function vnoise(x, y, z, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  let v = 0;
  for (let c = 0; c < 8; c++) {
    const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
    v += hash3(ix + dx, iy + dy, iz + dz, s) * (dx ? ux : 1 - ux) * (dy ? uy : 1 - uy) * (dz ? uz : 1 - uz);
  }
  return v * 2 - 1;
}
/** Periodic 2D value noise in 0…1 on a `per`-cell lattice (tileable canvas textures). */
function pnoise(x, y, per, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const m = (a) => ((a % per) + per) % per;
  const a = hash3(m(ix), m(iy), 0, s), b = hash3(m(ix + 1), m(iy), 0, s), c = hash3(m(ix), m(iy + 1), 0, s), d = hash3(m(ix + 1), m(iy + 1), 0, s);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { srgb = true, aniso = 4, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.needsUpdate = true;
  return t;
}
const col = (s) => new THREE.Color(s);

/**
 * A surface of revolution with analytic normals and arc-length v. P: [[r, y]…] — the outward side
 * is on the right of travel (as THREE.LatheGeometry). vcol(j, v) → [r, g, b(, a)] per profile point.
 */
function revolve(P, segs, vcol = null) {
  const n = P.length, cols = segs + 1;
  const pos = new Float32Array(n * cols * 3), nor = new Float32Array(n * cols * 3), uv = new Float32Array(n * cols * 2);
  const L = [0];
  for (let j = 1; j < n; j++) L.push(L[j - 1] + Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]));
  const total = L[n - 1] || 1;
  let cArr = null, cSize = 0;
  for (let j = 0; j < n; j++) {
    const a = P[Math.max(0, j - 1)], b = P[Math.min(n - 1, j + 1)];
    let tr = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tr, ty) || 1; tr /= tl; ty /= tl;
    const c = vcol ? vcol(j, L[j] / total) : null;
    if (c && !cArr) { cSize = c.length; cArr = new Float32Array(n * cols * cSize); }
    for (let i = 0; i <= segs; i++) {
      const th = (i / segs) * TAU, s = Math.sin(th), co = Math.cos(th);
      const v = j * cols + i;
      pos[v * 3] = P[j][0] * s; pos[v * 3 + 1] = P[j][1]; pos[v * 3 + 2] = P[j][0] * co;
      nor[v * 3] = ty * s; nor[v * 3 + 1] = -tr; nor[v * 3 + 2] = ty * co;
      uv[v * 2] = i / segs; uv[v * 2 + 1] = L[j] / total;
      if (c) for (let k = 0; k < cSize; k++) cArr[v * cSize + k] = c[k];
    }
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < segs; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (cArr) g.setAttribute('color', new THREE.BufferAttribute(cArr, cSize));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** A crisp, lumpy fried ball coated in glossy sauce: displaced sphere, analytic normals, cavity colours. */
function ballGeometry(nu, nv, seed) {
  const g = new THREE.SphereGeometry(1, nu, nv);
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const f = (x, y, z) => {
    const a = vnoise(x * 1.1 + 3.1, y * 1.1, z * 1.1, seed) * 0.14;
    const b = (1 - Math.abs(vnoise(x * 3.1, y * 3.1 + 7.3, z * 3.1, seed + 1))) * 0.1 - 0.05;
    const c = vnoise(x * 7.5, y * 7.5, z * 7.5 + 5.2, seed + 2) * 0.026;
    return 1 + a + b + c;
  };
  const n = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), q = new THREE.Vector3();
  const base = col('#3d1709'), deep = col('#140502'), crisp = col('#6e3212'), herb = col('#3d6a1c'), c = new THREE.Color();
  const e = 0.012;
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(pos, i).normalize();
    t1.set(0, 1, 0).cross(n); if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0).cross(n); t1.normalize();
    t2.crossVectors(n, t1).normalize();
    const d0 = f(n.x, n.y, n.z);
    p0.copy(n).multiplyScalar(d0);
    q.copy(n).addScaledVector(t1, e).normalize(); p1.copy(q).multiplyScalar(f(q.x, q.y, q.z));
    q.copy(n).addScaledVector(t2, e).normalize(); p2.copy(q).multiplyScalar(f(q.x, q.y, q.z));
    p1.sub(p0); p2.sub(p0);
    q.crossVectors(p1, p2).normalize();
    if (q.dot(n) < 0) q.negate();
    pos.setXYZ(i, p0.x * BR, p0.y * BR, p0.z * BR);
    nor.setXYZ(i, q.x, q.y, q.z);
    // hollows hold the dark sauce; the crags are crisper and catch a warmer brown
    const cav = clamp((d0 - 1) / 0.1, -1, 1);
    c.copy(base).lerp(cav < 0 ? deep : crisp, Math.abs(cav) * (cav < 0 ? 0.8 : 0.55));
    const fleck = hash3(Math.floor(n.x * 40), Math.floor(n.y * 40), Math.floor(n.z * 40), seed + 9);
    if (fleck > 0.986) c.lerp(herb, 0.7);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeBoundingSphere();
  return g;
}

/** A fine crisp-batter grain as a tangent-space normal map (tileable). */
function grainNormalMap(size = 256) {
  const c = cnv(size, size), g = c.getContext('2d');
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, a = 0.55, f = 8;
    for (let o = 0; o < 4; o++) { v += (1 - Math.abs(pnoise(x / size * f, y / size * f, f, o + 3) * 2 - 1)) * a; a *= 0.5; f *= 2; }
    h[y * size + x] = v;
  }
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hx = h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)];
    const hy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x];
    let nx = -hx * 2.2, ny = -hy * 2.2, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const k = (y * size + x) * 4;
    img.data[k] = (nx * 0.5 + 0.5) * 255; img.data[k + 1] = (ny * 0.5 + 0.5) * 255; img.data[k + 2] = (nz * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** One instanced billboard draw (a quad per instance) with the given per-instance attributes. */
function billboards(count, attrs, material) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  const out = {};
  for (const [name, size] of attrs) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(count * size), size);
    geo.setAttribute(name, a);
    out[name] = a;
  }
  geo.instanceCount = count;
  quad.dispose();
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return { mesh, geo, attrs: out };
}

/** The bowl's inner surface as a polyline: the closest point to (r, y) and its outward normal. */
function bowlContact(r, y, out) {
  let best = Infinity;
  for (let k = 0; k < BOWL_IN.length - 1; k++) {
    const [ar, ay] = BOWL_IN[k], [br, by] = BOWL_IN[k + 1];
    const dr = br - ar, dy = by - ay, ll = dr * dr + dy * dy;
    const t = clamp(((r - ar) * dr + (y - ay) * dy) / ll, 0, 1);
    const cr = ar + dr * t, cy = ay + dy * t;
    const d = Math.hypot(r - cr, y - cy);
    if (d < best) { best = d; out[0] = cr; out[1] = cy; }
  }
  return best;
}

// ================================================================== build
export async function build(env) {
  const { tier } = env;
  const q = tier.quality;
  const hi = q === 2, low = q === 0;
  const reduced = !!tier.reduced;
  const shadows = !!tier.shadows;
  const dev = !!window.__LITTLE_DEV__;
  const aniso = Math.min(hi ? 8 : 4, env.renderer.capabilities.getMaxAnisotropy());
  const envMap = env.envWarm;
  const R = rng(37);
  const owned = [];
  const own = (x) => { owned.push(x); return x; };
  const late = [];

  // physical materials; the low tier gets their standard cousins (no clearcoat / sheen work)
  const PHYS_ONLY = ['clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'sheenColor', 'specularIntensity', 'specularColor', 'ior', 'iridescence', 'anisotropy'];
  const PM = (o) => {
    if (!low) return own(new THREE.MeshPhysicalMaterial({ envMap, ...o }));
    const s = { envMap, ...o };
    PHYS_ONLY.forEach((k) => delete s[k]);
    return own(new THREE.MeshStandardMaterial(s));
  };
  const SM = (o) => own(new THREE.MeshStandardMaterial({ envMap, ...o }));

  const scene = new THREE.Scene();
  scene.background = col('#080504');
  const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 30);
  // (the warm-up frame sees the whole set, so every buffer and texture is on the GPU before play)
  camera.position.set(1.3, 1.9, 2.6);
  camera.lookAt(-0.35, 0.85, -0.45);
  camera.fov = 52; camera.updateProjectionMatrix();
  const rig = createRig(camera, { breath: reduced ? 0.25 : 0.7 });
  rig.pos.copy(camera.position);

  // ---------------------------------------------------------------- lights (a fixed set: no recompiles)
  const key = new THREE.SpotLight(0xffc48a, 0, 4.5, 1.02, 0.72, 2);
  key.position.copy(LAMP).add(V(0, -0.01, 0));
  key.target.position.set(0.12, TH, -0.24);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(hi ? 1024 : 512, hi ? 1024 : 512);
    key.shadow.camera.near = 0.08; key.shadow.camera.far = 2.4;
    key.shadow.bias = -0.0006; key.shadow.normalBias = 0.012; key.shadow.radius = 3;
  }
  const hood = new THREE.SpotLight(0xffd6a8, 0, 2.2, 0.5, 0.85, 2);
  hood.position.set(WOK_AT.x - 0.04, 1.62, WOK_AT.z - 0.06);
  hood.target.position.copy(WOK_AT);
  const burner = new THREE.PointLight(0xff8a4a, 0, 0.55, 2);
  burner.position.set(WOK_AT.x, PT + 0.006, WOK_AT.z);
  const rim = new THREE.DirectionalLight(0x8aa4ff, 0);
  rim.position.set(0.4, 1.95, -1.7);
  rim.target.position.set(0.12, 1.0, -0.55);
  const hemi = new THREE.HemisphereLight(0x5a4434, 0x170c07, 0);
  scene.add(key, key.target, hood, hood.target, burner, rim, rim.target, hemi);
  const LI = { key: 3.2, hood: 2.0, burner: 0.7, rim: 1.5, hemi: 0.42 };

  // ---------------------------------------------------------------- painted textures
  // the back wall: warm plaster, a backsplash of hand-made cream tiles behind the counter
  const WALL = { x0: -1.7, x1: 1.6, h: 2.4 };
  const wallW = WALL.x1 - WALL.x0;
  const wallTex = (() => {
    const W = 1024, H = 768, c = cnv(W, H), g = c.getContext('2d');
    const ppm = W / wallW, vy = (y) => H - (y / WALL.h) * H, ux = (x) => (x - WALL.x0) * ppm;
    g.fillStyle = '#3c4b44'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { // limewash mottling
      const x = R() * W, y = R() * H, r = 6 + R() * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.03 + R() * 0.05;
      gr.addColorStop(0, R() < 0.5 ? `rgba(110,128,112,${a})` : `rgba(24,34,30,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // tiles (10 cm, glazed cream with a few sage ones), behind the counter
    const tx0 = ux(-1.7), tx1 = ux(-0.3), ty0 = vy(1.5), ty1 = vy(COUNTER.top);
    const ts = 0.1 * ppm;
    g.fillStyle = '#5e5044'; g.fillRect(tx0, ty0, tx1 - tx0, ty1 - ty0);
    for (let y = ty1 - ts; y > ty0 - ts * 0.5; y -= ts) {
      for (let x = tx0; x < tx1; x += ts) {
        const sage = R() < 0.12;
        const l = 0.9 + R() * 0.1;
        const base = sage ? [110, 132, 108] : [176, 160, 136];
        g.fillStyle = `rgb(${base[0] * l | 0},${base[1] * l | 0},${base[2] * l | 0})`;
        const h = Math.min(ts - 2, ty1 - y);
        g.fillRect(x + 1.2, Math.max(ty0, y + 1.2), ts - 2.4, h - 1.2);
        const gr = g.createLinearGradient(x, y, x + ts, y + ts);
        gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
        g.fillStyle = gr; g.fillRect(x + 1.2, Math.max(ty0, y + 1.2), ts - 2.4, h - 1.2);
      }
    }
    // a soft shadow line under the window sill and a darker skirting
    g.fillStyle = 'rgba(30,16,10,0.6)'; g.fillRect(0, vy(0.1), W, H - vy(0.1));
    return tex(c, { aniso });
  })();
  const wallRough = (() => {
    const W = 256, H = 192, c = cnv(W, H), g = c.getContext('2d');
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, W, H);
    const ppm = W / wallW;
    g.fillStyle = '#5a5a5a';
    g.fillRect(0, H - (1.5 / WALL.h) * H, (1.4) * ppm, ((1.5 - COUNTER.top) / WALL.h) * H);
    return tex(c, { srgb: false });
  })();
  const plasterTex = (() => {
    const S = 256, c = cnv(S, S), g = c.getContext('2d');
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = pnoise(x / S * 6, y / S * 6, 6, 1) * 0.6 + pnoise(x / S * 24, y / S * 24, 24, 2) * 0.4;
      const k = (y * S + x) * 4, l = 0.85 + n * 0.25;
      img.data[k] = 60 * l; img.data[k + 1] = 75 * l; img.data[k + 2] = 68 * l; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return tex(c, { repeat: [3, 3] });
  })();
  const floorTex = (() => {
    const S = 512, c = cnv(S, S), g = c.getContext('2d');
    const rows = 4, pw = S / rows;
    for (let r = 0; r < rows; r++) {
      const seam = (r % 2 ? 0.35 : 0.8) * S;
      for (let part = 0; part < 2; part++) {
        const l = 0.82 + R() * 0.22;
        g.fillStyle = `rgb(${92 * l | 0},${56 * l | 0},${36 * l | 0})`;
        const y0 = part ? seam : seam - S;
        g.fillRect(r * pw, y0, pw, S); g.fillRect(r * pw, y0 + S, pw, S);
      }
      for (let i = 0; i < 70; i++) { // grain
        const x = r * pw + R() * pw;
        g.strokeStyle = `rgba(${R() < 0.5 ? '40,22,12' : '150,100,64'},${0.05 + R() * 0.08})`;
        g.lineWidth = 0.6 + R() * 1.4;
        g.beginPath(); g.moveTo(x, 0);
        for (let y = 0; y <= S; y += 32) g.lineTo(x + Math.sin(y * 0.02 + i) * 2.2, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(20,10,6,0.85)'; g.fillRect(r * pw, 0, 1.6, S);
      g.fillRect(r * pw, seam - 1, pw, 1.6);
    }
    return tex(c, { aniso, repeat: [10, 10] });
  })();
  /** Warm oak (table, stool) or a darker rosewood (the wok's handle). */
  const woodTex = (dark) => {
    const S = 512, c = cnv(S, S), g = c.getContext('2d');
    g.fillStyle = dark ? '#3b2116' : '#9a6a42'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 160; i++) {
      const y = R() * S, a = 0.04 + R() * 0.1;
      g.strokeStyle = R() < 0.55 ? `rgba(${dark ? '20,8,4' : '70,40,20'},${a})` : `rgba(${dark ? '110,60,36' : '200,150,100'},${a})`;
      g.lineWidth = 0.8 + R() * 2.6;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= S; x += 16) g.lineTo(x, y + Math.sin(x * 0.012 + i * 0.7) * 5 + Math.sin(x * 0.05 + i) * 1.2);
      g.stroke();
    }
    return tex(c, { aniso, repeat: [1, 1] });
  };
  const oakTex = woodTex(false), roseTex = woodTex(true);
  const graniteTex = (() => {
    const S = 512, c = cnv(S, S), g = c.getContext('2d');
    g.fillStyle = '#1a1716'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) {
      const x = R() * S, y = R() * S, r = 0.5 + R() * R() * 2.6;
      const t = R();
      g.fillStyle = t < 0.55 ? `rgba(58,52,48,${0.4 + R() * 0.4})` : t < 0.9 ? `rgba(12,10,10,0.7)` : `rgba(120,108,96,${0.15 + R() * 0.25})`;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    return tex(c, { aniso, repeat: [2.4, 1.2] });
  })();
  const cabinetTex = (() => {
    const W = 512, H = 256, c = cnv(W, H), g = c.getContext('2d');
    g.fillStyle = '#34463f'; g.fillRect(0, 0, W, H);
    const doors = 3, dw = W / doors;
    for (let d = 0; d < doors; d++) {
      const x = d * dw;
      g.strokeStyle = 'rgba(10,18,15,0.7)'; g.lineWidth = 3; g.strokeRect(x + 4, 6, dw - 8, H - 12);
      g.strokeStyle = 'rgba(120,150,138,0.25)'; g.lineWidth = 2; g.strokeRect(x + 22, 26, dw - 44, H - 52);
      g.strokeStyle = 'rgba(8,14,12,0.45)'; g.lineWidth = 2; g.strokeRect(x + 25, 29, dw - 50, H - 58);
      g.fillStyle = '#b8935a'; g.beginPath(); g.arc(x + (d % 2 ? 36 : dw - 36), H * 0.42, 5, 0, TAU); g.fill();
    }
    return tex(c, { aniso });
  })();
  // the wok: brushed circular scratches (u runs round the wok) and a heat-tinted patina in v
  const wokScratch = (() => {
    const W = 512, H = 64, c = cnv(W, H), g = c.getContext('2d');
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 700; i++) {
      const y = R() * H, x = R() * W, l = 30 + R() * 260;
      g.strokeStyle = R() < 0.5 ? `rgba(255,255,255,${0.08 + R() * 0.2})` : `rgba(40,40,40,${0.08 + R() * 0.18})`;
      g.lineWidth = 0.5 + R();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (R() - 0.5) * 1.5); g.stroke();
    }
    return tex(c, { srgb: false, repeat: [3, 6] });
  })();
  const speckTex = (() => {
    const S = 256, c = cnv(S, S), g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(${R() < 0.7 ? '90,70,50' : '60,50,60'},${0.15 + R() * 0.45})`;
      g.beginPath(); g.arc(R() * S, R() * S, 0.4 + R() * R() * 1.6, 0, TAU); g.fill();
    }
    return tex(c, { repeat: [6, 3] });
  })();
  const matTex = (() => { // a round woven jute placemat (radial weave, as the cap's uv is planar)
    const S = 512, c = cnv(S, S), g = c.getContext('2d');
    g.fillStyle = '#9c7a4e'; g.fillRect(0, 0, S, S);
    const cx = S / 2;
    for (let r = 4; r < cx; r += 7) {
      g.strokeStyle = `rgba(${R() < 0.5 ? '60,42,24' : '196,160,110'},${0.35 + R() * 0.3})`;
      g.lineWidth = 3.2;
      g.setLineDash([9 + R() * 3, 4]); g.lineDashOffset = R() * 20;
      g.beginPath(); g.arc(cx, cx, r, 0, TAU); g.stroke();
    }
    g.setLineDash([]);
    g.strokeStyle = 'rgba(70,46,26,0.8)'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cx, cx - 6, 0, TAU); g.stroke();
    return tex(c, { aniso });
  })();
  const nightTex = (() => { // the window: out-of-focus city lights in a deep blue night
    const W = 512, H = 512, c = cnv(W, H), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#060a1c'); gr.addColorStop(0.55, '#0d1838'); gr.addColorStop(1, '#1d2550');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const pal = ['255,190,120', '255,214,160', '150,180,255', '255,150,110', '220,230,255'];
    for (let i = 0; i < 46; i++) {
      const x = R() * W, y = H * (0.45 + R() * 0.55), r = 8 + R() * 26, p = pal[(R() * pal.length) | 0];
      const gg = g.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, `rgba(${p},${0.35 + R() * 0.3})`); gg.addColorStop(0.75, `rgba(${p},${0.18 + R() * 0.15})`); gg.addColorStop(1, `rgba(${p},0)`);
      g.fillStyle = gg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    return tex(c, {});
  })();
  const grainTex = tex(grainNormalMap(256), { srgb: false, repeat: [3, 2] });
  [wallTex, wallRough, plasterTex, floorTex, oakTex, roseTex, graniteTex, cabinetTex, wokScratch, speckTex, matTex, nightTex, grainTex].forEach(own);

  // ---------------------------------------------------------------- the room
  const floorMat = SM({ map: floorTex, roughness: 0.62, metalness: 0, envMapIntensity: 0.25 });
  const floor = new THREE.Mesh(own(new THREE.PlaneGeometry(6, 6)), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0.6);
  floor.receiveShadow = shadows;
  const wallMat = SM({ map: wallTex, roughnessMap: wallRough, roughness: 1, metalness: 0, envMapIntensity: 0.35 });
  const backWall = new THREE.Mesh(own(new THREE.PlaneGeometry(wallW, WALL.h)), wallMat);
  backWall.position.set((WALL.x0 + WALL.x1) / 2, WALL.h / 2, -1.0);
  backWall.receiveShadow = shadows;
  const plasterMat = SM({ map: plasterTex, roughness: 0.92, metalness: 0, envMapIntensity: 0.2 });
  const sideGeo = own(new THREE.PlaneGeometry(2.8, WALL.h));
  const leftWall = new THREE.Mesh(sideGeo, plasterMat);
  leftWall.rotation.y = Math.PI / 2; leftWall.position.set(WALL.x0, WALL.h / 2, 0.4);
  const rightWall = new THREE.Mesh(sideGeo, plasterMat);
  rightWall.rotation.y = -Math.PI / 2; rightWall.position.set(WALL.x1, WALL.h / 2, 0.4);
  scene.add(floor, backWall, leftWall, rightWall);

  // the window behind her: the night as a glowing pane, a painted frame with a cross bar
  const glassMat = own(new THREE.MeshBasicMaterial({ map: nightTex, color: col('#ffffff').multiplyScalar(1.25) }));
  const winW = WIN.x1 - WIN.x0, winH = WIN.y1 - WIN.y0;
  const glass = new THREE.Mesh(own(new THREE.PlaneGeometry(winW, winH)), glassMat);
  glass.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, WIN.z);
  const frameMat = SM({ color: col('#d9cbb4'), roughness: 0.55, envMapIntensity: 0.4 });
  const frameGeo = own((() => {
    const parts = [];
    const bar = (w, h, d, x, y, z) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); parts.push(b); };
    const cx = (WIN.x0 + WIN.x1) / 2, cy = (WIN.y0 + WIN.y1) / 2, z = WIN.z + 0.02;
    bar(winW + 0.08, 0.045, 0.05, cx, WIN.y1 + 0.02, z); bar(winW + 0.12, 0.05, 0.11, cx, WIN.y0 - 0.02, z + 0.02);
    bar(0.045, winH + 0.04, 0.05, WIN.x0 - 0.02, cy, z); bar(0.045, winH + 0.04, 0.05, WIN.x1 + 0.02, cy, z);
    bar(0.022, winH, 0.03, cx, cy, z - 0.005); bar(winW, 0.022, 0.03, cx, cy + 0.08, z - 0.005);
    const m = mergeGeometries(parts); parts.forEach((p) => p.dispose()); return m;
  })());
  const frame = new THREE.Mesh(frameGeo, frameMat);
  scene.add(glass, frame);

  // ---------------------------------------------------------------- the counter, cooktop, hood, shelf
  const cabinetMat = SM({ map: cabinetTex, roughness: 0.55, envMapIntensity: 0.35 });
  const cw = COUNTER.x1 - COUNTER.x0, cd = COUNTER.z1 - COUNTER.z0;
  const cabinet = new THREE.Mesh(own(new THREE.BoxGeometry(cw, COUNTER.top - 0.04, cd - 0.02)), cabinetMat);
  cabinet.position.set((COUNTER.x0 + COUNTER.x1) / 2, (COUNTER.top - 0.04) / 2, (COUNTER.z0 + COUNTER.z1) / 2 - 0.01);
  const topMat = PM({ map: graniteTex, roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.18, envMapIntensity: 0.7 });
  const counterTop = new THREE.Mesh(own(new THREE.BoxGeometry(cw + 0.04, 0.04, cd + 0.03)), topMat);
  counterTop.position.set((COUNTER.x0 + COUNTER.x1) / 2, COUNTER.top - 0.02, (COUNTER.z0 + COUNTER.z1) / 2 + 0.005);
  counterTop.receiveShadow = shadows;
  const steelMat = SM({ color: col('#a9a6a2'), metalness: 1, roughness: 0.3, roughnessMap: wokScratch, envMapIntensity: 1.0 });
  const plateMat = PM({ color: col('#0c0b0c'), roughness: 0.24, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.08, envMapIntensity: 0.16 });
  const plate = new THREE.Mesh(own(new THREE.BoxGeometry(0.66, 0.012, 0.46)), plateMat);
  plate.position.set(-0.82, COUNTER.top + 0.006, -0.69);
  const BURNERS = [[WOK_AT.x, WOK_AT.z], [-1.03, -0.7]];
  const ironMat = SM({ color: col('#1e1c1b'), metalness: 0.55, roughness: 0.55, envMapIntensity: 0.6 });
  const grateGeo = own((() => {
    const parts = [];
    for (const [bx, bz] of BURNERS) {
      const ring = new THREE.TorusGeometry(0.11, 0.0055, 6, 40); ring.rotateX(Math.PI / 2); ring.translate(bx, GT - 0.006, bz); parts.push(ring);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4;
        const arm = new THREE.BoxGeometry(0.075, 0.009, 0.011); arm.translate(0.0825, GT - 0.0045, 0); arm.rotateY(a); arm.translate(bx, 0, bz); parts.push(arm);
        const leg = new THREE.BoxGeometry(0.012, GT - PT, 0.012); leg.translate(0.115, PT + (GT - PT) / 2, 0); leg.rotateY(a); leg.translate(bx, 0, bz); parts.push(leg);
      }
    }
    const m = mergeGeometries(parts); parts.forEach((p) => p.dispose()); return m;
  })());
  const grate = new THREE.Mesh(grateGeo, ironMat);
  grate.castShadow = false;
  const brassMat = SM({ color: col('#6b5236'), metalness: 0.8, roughness: 0.42, envMapIntensity: 0.7 });
  const capGeo = own((() => {
    const parts = [];
    for (const [bx, bz] of BURNERS) { const cp = new THREE.CylinderGeometry(0.029, 0.033, 0.012, 24); cp.translate(bx, PT + 0.006, bz); parts.push(cp); }
    for (let k = 0; k < 3; k++) { const kn = new THREE.CylinderGeometry(0.014, 0.016, 0.018, 16); kn.rotateX(Math.PI / 2); kn.translate(-1.05 + k * 0.1, COUNTER.top + 0.006, -0.455); parts.push(kn); }
    const m = mergeGeometries(parts); parts.forEach((p) => p.dispose()); return m;
  })());
  const caps = new THREE.Mesh(capGeo, brassMat);
  const hoodMat = SM({ color: col('#2b2a2a'), metalness: 0.9, roughness: 0.36, roughnessMap: wokScratch, envMapIntensity: 0.8 });
  const hoodBox = new THREE.Mesh(own(new THREE.BoxGeometry(0.72, 0.2, 0.44)), hoodMat);
  hoodBox.position.set(-0.72, 1.74, -0.78);
  const hoodStripMat = own(new THREE.MeshBasicMaterial({ color: col('#ffd2a0').multiplyScalar(2.2) }));
  const hoodStrip = new THREE.Mesh(own(new THREE.PlaneGeometry(0.5, 0.04)), hoodStripMat);
  hoodStrip.rotation.x = Math.PI / 2; hoodStrip.position.set(-0.72, 1.638, -0.74);
  const shelfMat = SM({ map: oakTex, roughness: 0.6, envMapIntensity: 0.3 });
  const shelf = new THREE.Mesh(own(new THREE.BoxGeometry(0.5, 0.025, 0.17)), shelfMat);
  shelf.position.set(-1.36, 1.48, -0.905);
  // spice jars: glass jars of colour, wooden lids (two instanced draws)
  const JARS = [['#d9a21b', 0.1], ['#9e2418', 0.085], ['#6b4a2b', 0.11], ['#e3d6be', 0.095], ['#5f7a33', 0.08]];
  const jarMat = PM({ roughness: 0.25, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.0 });
  const jars = new THREE.InstancedMesh(own(new THREE.CylinderGeometry(0.034, 0.034, 1, 20)), jarMat, JARS.length);
  // (instanced, the lids need their own copy of the shelf's oak: one material drawn both ways switches
  // program variants every frame)
  const lids = new THREE.InstancedMesh(own(new THREE.CylinderGeometry(0.036, 0.036, 0.022, 20)), own(shelfMat.clone()), JARS.length);
  {
    const m = new THREE.Matrix4(), c = new THREE.Color();
    JARS.forEach(([cs, h], i) => {
      const x = -1.56 + i * 0.095;
      m.makeScale(1, h, 1).setPosition(x, 1.4925 + h / 2, -0.9); jars.setMatrixAt(i, m); jars.setColorAt(i, c.set(cs));
      m.makeTranslation(x, 1.4925 + h + 0.011, -0.9); lids.setMatrixAt(i, m);
    });
  }
  scene.add(cabinet, counterTop, plate, grate, caps, hoodBox, hoodStrip, shelf, jars, lids);

  // the burner: tongues of flame, a soft halo, a warm glow on the steel
  const nFlame = [14, 18, 24][q];
  const flameMat = own(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uC: { value: V(WOK_AT.x, PT + 0.011, WOK_AT.z) }, uR: { value: 0.032 }, uOn: { value: 1 } },
    vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const flames = billboards(nFlame, [['aF', 2]], flameMat);
  own(flames.geo);
  for (let i = 0; i < nFlame; i++) flames.attrs.aF.setXY(i, (i / nFlame) * TAU, R());
  flames.mesh.renderOrder = 8;
  const burnerGlow = glowSprite(0x6f8cff, 0.34, { opacity: 0.35 });
  burnerGlow.position.set(WOK_AT.x, PT + 0.012, WOK_AT.z);
  const burnerWarm = glowSprite(0xff9a50, 0.2, { opacity: 0.3 });
  burnerWarm.position.set(WOK_AT.x, PT + 0.02, WOK_AT.z);
  own(burnerGlow.material); own(burnerWarm.material);
  // the glow of the flame on the black glass round the wok
  const poolMat = own(new THREE.MeshBasicMaterial({ map: glowTexture(), color: col('#ff8a3c').multiplyScalar(0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const pool = new THREE.Mesh(own(new THREE.PlaneGeometry(0.5, 0.5)), poolMat);
  pool.rotation.x = -Math.PI / 2; pool.position.set(WOK_AT.x, PT + 0.0015, WOK_AT.z);
  pool.renderOrder = 3;
  scene.add(flames.mesh, burnerGlow, burnerWarm, pool);

  // ---------------------------------------------------------------- the wok
  const wokG = new THREE.Group();
  wokG.position.copy(WOK_AT); wokG.rotation.y = WOK_YAW;
  const wokPivot = new THREE.Group(); // (the toss moves and tilts this)
  wokG.add(wokPivot);
  scene.add(wokG);
  const wokProfile = (() => {
    const P = [];
    const nO = [16, 22, 28][q];
    for (let i = 0; i <= nO; i++) { const r = (i / nO) * WR; P.push([r, wokY(r) - WT]); }
    const rr = 0.0032;
    for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI * 1.5; P.push([WR + Math.cos(a) * rr, WD - WT + rr + Math.sin(a) * rr]); }
    for (let i = nO; i >= 0; i--) { const r = (i / nO) * (WR - rr); P.push([r, wokY(r)]); }
    P[P.length - 1][0] = 0.0001;
    return P;
  })();
  const nOut = [16, 22, 28][q] + 1;
  const wokGeo = own(revolve(wokProfile, [48, 64, 80][q], (j) => {
    // heat tint under it (blue-violet → bronze → dark), bright steel at the rim, a seasoned black inside
    if (j < nOut) {
      const t = j / nOut;
      const c = new THREE.Color().lerpColors(col('#3c4270'), col('#7a5532'), smooth(0.05, 0.3, t)).lerp(col('#2a2624'), smooth(0.28, 0.6, t));
      return [c.r, c.g, c.b];
    }
    if (j < nOut + 9) { const c = col('#6d6a66'); return [c.r, c.g, c.b]; }
    const t = (j - nOut - 9) / nOut;
    const c = new THREE.Color().lerpColors(col('#2c2420'), col('#110d0b'), smooth(0.0, 0.3, t)).lerp(col('#1f1510'), smooth(0.7, 1.0, t) * 0.6);
    return [c.r, c.g, c.b];
  }));
  const wokMat = PM({ vertexColors: true, metalness: 0.4, roughness: 0.44, roughnessMap: wokScratch, envMapIntensity: 0.6 });
  const wokMesh = new THREE.Mesh(wokGeo, wokMat);
  wokMesh.castShadow = shadows;
  wokPivot.add(wokMesh);
  // the long wooden handle (toward local +Z, rising a little) and the small helper loop opposite
  const handleMat = PM({ map: roseTex, roughness: 0.48, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.3, envMapIntensity: 0.6 });
  const handleGeo = own(new THREE.CylinderGeometry(0.0125, 0.0145, 0.17, 14));
  handleGeo.rotateX(Math.PI / 2 - 0.2); handleGeo.translate(0, WD + 0.045, WR + 0.135);
  const handle = new THREE.Mesh(handleGeo, handleMat);
  const sockGeo = own((() => {
    const a = new THREE.CylinderGeometry(0.011, 0.012, 0.075, 12); a.rotateX(Math.PI / 2 - 0.2); a.translate(0, WD + 0.016, WR + 0.03);
    const b = new THREE.TorusGeometry(0.024, 0.0035, 6, 18, Math.PI); b.rotateX(-Math.PI / 2); b.rotateX(-0.22); b.translate(0, WD - 0.001, -WR + 0.002);
    const m = mergeGeometries([a, b]); a.dispose(); b.dispose(); return m;
  })());
  const sock = new THREE.Mesh(sockGeo, steelMat);
  wokPivot.add(handle, sock);

  // the sauce: a glossy dark sheet whose normals move (slow swirls, little bubbles that ring out)
  const sauceU = { uSauceT: { value: 0 }, uSauceAmp: { value: 0.32 }, uBub: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -9, 0, 0)) } };
  const sauceMat = PM({ vertexColors: true, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, specularIntensity: 0.9, envMapIntensity: 1.25, transparent: true });
  sauceMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, sauceU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    const pert = /* glsl */`
      {
        vec2 sp = vSP.xz * 70.0; float st = uSauceT;
        vec2 gd = vec2(cos(sp.x * 1.7 + st * 1.1 + sin(sp.y * 1.3 - st * 0.6)), cos(sp.y * 1.9 - st * 0.9 + sin(sp.x * 1.1 + st * 0.7))) * 0.6
                + vec2(cos(sp.x * 3.9 - sp.y * 1.2 + st * 1.7), cos(sp.y * 4.3 + sp.x * 0.9 - st * 1.5)) * 0.25;
        for (int i = 0; i < 4; i++) {
          vec4 b = uBub[i];
          vec2 dd = vSP.xz - b.xz; float dl = length(dd) + 1e-5;
          float ph = fract(st * 0.55 + b.w);
          float rr = ph * 0.022;
          float ring = sin((dl - rr) * 520.0) * exp(-pow((dl - rr) / 0.006, 2.0)) * (1.0 - ph) * step(abs(vSP.y - b.y), 0.03);
          gd += dd / dl * ring * 2.2;
        }
        PERT_TARGET = normalize(PERT_TARGET + (viewMatrix * vec4(gd.x, 0.0, gd.y, 0.0)).xyz * uSauceAmp);
      }`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSP;\nuniform float uSauceT;\nuniform float uSauceAmp;\nuniform vec4 uBub[4];')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + pert.replace(/PERT_TARGET/g, 'normal'))
      // (clearcoatNormal exists only on the physical material — the low tier uses the standard one)
      .replace('#include <clearcoat_normal_fragment_maps>', '#include <clearcoat_normal_fragment_maps>\n#ifdef USE_CLEARCOAT\n' + pert.replace(/PERT_TARGET/g, 'clearcoatNormal') + '\n#endif');
  };
  sauceMat.customProgramCacheKey = () => 'manchuria-sauce';
  const sauceRGB = col('#3a1408');
  const wokSauceGeo = own((() => {
    const rs = Math.sqrt(2 * WRS * SAUCE_H - SAUCE_H * SAUCE_H);
    const P = [];
    const top = 0.122;
    for (let i = 0; i <= 10; i++) { const r = lerp(top, rs + 0.004, i / 10); P.push([r, wokY(r) + 0.0012 + 0.0016 * (i / 10)]); }
    for (let i = 1; i <= 12; i++) { const r = lerp(rs, 0, i / 12); P.push([r, SAUCE_H + 0.0012 * Math.sin((i / 12) * Math.PI / 2)]); }
    P[P.length - 1][0] = 0.0001;
    return revolve(P, [40, 56, 72][q], (j) => [sauceRGB.r, sauceRGB.g, sauceRGB.b, j < 11 ? smooth(0, 9, j) * 0.92 : 1]);
  })());
  const wokSauce = new THREE.Mesh(wokSauceGeo, sauceMat);
  wokSauce.renderOrder = 2;
  wokPivot.add(wokSauce);

  // ---------------------------------------------------------------- the food (shared geometry + materials)
  const ballGeo = own(ballGeometry([22, 30, 38][q], [16, 22, 28][q], 5));
  const ballMat = PM({ vertexColors: true, roughness: 0.55, metalness: 0, normalMap: grainTex, normalScale: new THREE.Vector2(0.5, 0.5), clearcoat: 1, clearcoatRoughness: 0.1, specularIntensity: 0.6, envMapIntensity: 1.0, sheen: 0.15, sheenRoughness: 0.5, sheenColor: col('#a84a22') });
  const ballMatI = own(ballMat.clone());   // (the instanced heaps: their own program variant — the hero and the picked piece are plain meshes)
  // capsicum squares (a gently curved plate), onion petals (a curved shell), rings (spring onion, chili)
  const capsGeo = own((() => {
    const g = new THREE.BoxGeometry(0.02, 0.0045, 0.017, 4, 1, 4);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - 18 * p.getX(i) * p.getX(i));
    g.computeVertexNormals();
    return g;
  })());
  const onionGeo = own((() => {
    const g = new THREE.BoxGeometry(0.024, 0.0032, 0.011, 8, 1, 1);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - 40 * p.getX(i) * p.getX(i));
    g.computeVertexNormals();
    return g;
  })());
  const ringGeo = own(new THREE.TorusGeometry(0.005, 0.00105, 6, 16));
  const vegMat = PM({ roughness: 0.32, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.9, side: THREE.DoubleSide });
  const CAPS = ['#3f7d22', '#4f8f2a', '#5b9a30', '#b4251a', '#c8361f'];
  const ONION = ['#f2e9e4', '#ead9dc', '#f6f0e8', '#dcc4cc'];
  const RINGS = ['#7fb24a', '#9fcd65', '#6aa23c', '#e3eecb', '#c2271d', '#b3201a'];

  // ---- the wok's contents: items with a rest place (radius, angle on the round bottom) and a toss
  const nWB = [10, 13, 15][q], nWC = [6, 8, 10][q], nWO = [4, 6, 7][q], nWR = [8, 11, 14][q];
  const wokBalls = new THREE.InstancedMesh(ballGeo, ballMatI, nWB);
  const wokCaps = new THREE.InstancedMesh(capsGeo, vegMat, nWC);
  const wokOnion = new THREE.InstancedMesh(onionGeo, vegMat, nWO);
  const wokRings = new THREE.InstancedMesh(ringGeo, vegMat, nWR);
  for (const m of [wokBalls, wokCaps, wokOnion, wokRings]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = false; wokPivot.add(m); }
  const N_ITEMS = nWB + nWC + nWO + nWR;
  const IT = {
    kind: new Uint8Array(N_ITEMS), idx: new Uint16Array(N_ITEMS),
    r: new Float32Array(N_ITEMS), a: new Float32Array(N_ITEMS), y: new Float32Array(N_ITEMS),
    rx: new Float32Array(N_ITEMS), ry: new Float32Array(N_ITEMS), rz: new Float32Array(N_ITEMS), s: new Float32Array(N_ITEMS),
    delay: new Float32Array(N_ITEMS), h: new Float32Array(N_ITEMS), fl: new Float32Array(N_ITEMS), da: new Float32Array(N_ITEMS),
    spin: new Float32Array(N_ITEMS), sx: new Float32Array(N_ITEMS), sz: new Float32Array(N_ITEMS),
  };
  const HERO = 0; // (the ball that leaps: the first one, near the middle)
  {
    let k = 0;
    const balls = [];
    for (let i = 0; i < nWB; i++, k++) {
      const r = i === HERO ? 0.012 : 0.03 + 0.072 * Math.sqrt((i + 0.3) / nWB), a = i * 2.39996 + (R() - 0.5) * 0.4;
      IT.kind[k] = 0; IT.idx[k] = i; IT.r[k] = r; IT.a[k] = a;
      IT.y[k] = Math.max(wokY(r) + BR * 0.95, SAUCE_H + BR * 0.55);
      IT.rx[k] = R() * TAU; IT.ry[k] = R() * TAU; IT.rz[k] = R() * TAU; IT.s[k] = 0.92 + R() * 0.16;
      balls.push([Math.cos(a) * r, IT.y[k], Math.sin(a) * r]);
    }
    const restOn = (r, a, lift) => { // on the bottom, or on a ball beneath
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      let y = wokY(r) + lift;
      for (const b of balls) { const d = Math.hypot(x - b[0], z - b[2]); if (d < BR * 1.05) y = Math.max(y, b[1] + Math.sqrt(Math.max(0, (BR * 1.05) ** 2 - d * d)) + lift * 0.6); }
      return y;
    };
    const veg = (n, kind, lift, rMax) => {
      for (let i = 0; i < n; i++, k++) {
        const r = 0.02 + rMax * Math.sqrt(R()), a = R() * TAU;
        IT.kind[k] = kind; IT.idx[k] = i; IT.r[k] = r; IT.a[k] = a; IT.y[k] = restOn(r, a, lift);
        IT.rx[k] = (R() - 0.5) * 0.9; IT.ry[k] = R() * TAU; IT.rz[k] = (R() - 0.5) * 0.9; IT.s[k] = 0.85 + R() * 0.3;
        if (kind === 3) IT.rx[k] = Math.PI / 2 + (R() - 0.5) * 0.5;
      }
    };
    veg(nWC, 1, 0.003, 0.1); veg(nWO, 2, 0.006, 0.1); veg(nWR, 3, 0.003, 0.11);
    const c = new THREE.Color();
    for (let i = 0; i < nWC; i++) wokCaps.setColorAt(i, c.set(CAPS[(R() * CAPS.length) | 0]));
    for (let i = 0; i < nWO; i++) wokOnion.setColorAt(i, c.set(ONION[(R() * ONION.length) | 0]));
    for (let i = 0; i < nWR; i++) wokRings.setColorAt(i, c.set(RINGS[(R() * RINGS.length) | 0]));
  }
  /** New random arcs for the next toss (build time and between tosses — no allocation). */
  function planToss(strength) {
    const shuffle = (R() - 0.5) * 0.9;
    for (let k = 0; k < N_ITEMS; k++) {
      const out = IT.r[k] / 0.11;
      IT.delay[k] = 0.27 + 0.05 * R() + 0.05 * out;
      IT.h[k] = (0.03 + 0.035 * R()) * strength * (IT.kind[k] === 0 ? 1 : 1.2);
      IT.fl[k] = 0.4 + 0.12 * R();
      IT.da[k] = shuffle + (R() - 0.5) * 0.35;
      IT.spin[k] = (R() - 0.5) * 5 * strength;
      IT.sx[k] = (R() - 0.5) * 0.012; IT.sz[k] = 0.02 + R() * 0.02; // (toward the handle, the way food comes back)
    }
  }
  function commitToss() { for (let k = 0; k < N_ITEMS; k++) { IT.a[k] += IT.da[k]; IT.rx[k] += IT.spin[k] * 0.5; IT.rz[k] += IT.spin[k] * 0.3; } }
  planToss(0.7);

  // the hero ball: its own mesh (it leaves the wok)
  const hero = new THREE.Mesh(ballGeo, ballMat);
  hero.castShadow = shadows;
  scene.add(hero);
  const heroGlint = glowSprite(0xfff1d8, 0.05, { star: true, opacity: 0 });
  own(heroGlint.material);
  heroGlint.visible = false; late.push(heroGlint);
  scene.add(heroGlint);

  // ---------------------------------------------------------------- the table, the bowl, the chopsticks, the stool
  const oakMat = PM({ map: oakTex, roughness: 0.45, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.3, envMapIntensity: 0.28 });
  const tableTop = new THREE.Mesh(own(new THREE.CylinderGeometry(TR, TR - 0.006, 0.032, [48, 64, 80][q])), oakMat);
  tableTop.position.set(TABLE.x, TH - 0.016, TABLE.z);
  tableTop.castShadow = shadows; tableTop.receiveShadow = shadows;
  const pedestalGeo = own((() => {
    const a = new THREE.CylinderGeometry(0.032, 0.04, TH - 0.06, 20); a.translate(0, (TH - 0.06) / 2 + 0.028, 0);
    const b = new THREE.CylinderGeometry(0.15, 0.17, 0.028, 32); b.translate(0, 0.014, 0);
    const m = mergeGeometries([a, b]); a.dispose(); b.dispose(); return m;
  })());
  const pedestal = new THREE.Mesh(pedestalGeo, oakMat);
  pedestal.position.set(TABLE.x, 0, TABLE.z);
  const stoolGeo = own((() => {
    const parts = [];
    const seat = new THREE.CylinderGeometry(0.17, 0.165, 0.04, 32); seat.translate(0, SEAT - 0.02, 0); parts.push(seat);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      const leg = new THREE.CylinderGeometry(0.014, 0.017, SEAT - 0.03, 10);
      leg.translate(0, (SEAT - 0.03) / 2, 0); leg.rotateZ(-0.08); leg.translate(0.115, 0, 0); leg.rotateY(a); parts.push(leg);
    }
    const ring = new THREE.TorusGeometry(0.12, 0.008, 6, 28); ring.rotateX(Math.PI / 2); ring.translate(0, 0.16, 0); parts.push(ring);
    const m = mergeGeometries(parts); parts.forEach((p) => p.dispose()); return m;
  })());
  const stool = new THREE.Mesh(stoolGeo, oakMat);
  stool.position.set(SEAT_AT.x, 0, SEAT_AT.z - 0.03);
  stool.castShadow = shadows;
  const matMat = SM({ map: matTex, roughness: 0.85, metalness: 0, envMapIntensity: 0.2 });
  const placemat = new THREE.Mesh(own(new THREE.CylinderGeometry(0.15, 0.15, MAT_H, 48)), matMat);
  placemat.position.set(BOWL_AT.x, TH + MAT_H / 2, BOWL_AT.z);
  placemat.receiveShadow = shadows;
  scene.add(tableTop, pedestal, stool, placemat);

  // the bowl: cream stoneware, an indigo band below a dark iron rim, a fine speckle
  const bowlG = new THREE.Group();
  bowlG.position.copy(BOWL_AT);
  scene.add(bowlG);
  const bowlProfile = [[0.0001, 0.006], [0.03, 0.006], [0.033, 0.002], [0.036, 0.0], [0.044, 0.0], [0.047, 0.004], [0.06, 0.011], [0.072, 0.019], [0.082, 0.029], [0.089, 0.039], [0.093, 0.049], [0.0945, 0.0555],
    [0.0944, 0.0578], [0.0928, 0.0594], [0.0906, 0.0592], [0.0892, 0.0572], ...BOWL_IN];
  const bowlGeo = own(revolve(bowlProfile, [48, 64, 80][q], (j) => {
    const cream = col('#efe4d0'), indigo = col('#2e3f7a'), iron = col('#5a3a26');
    let c = cream;
    if (j >= 8 && j <= 11) c = new THREE.Color().lerpColors(cream, indigo, smooth(7.5, 9.5, j));
    else if (j >= 12 && j <= 15) c = iron;
    else if (j === 16) c = new THREE.Color().lerpColors(iron, cream, 0.6);
    return [c.r, c.g, c.b];
  }));
  const bowlMat = PM({ vertexColors: true, map: speckTex, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9 });
  const bowl = new THREE.Mesh(bowlGeo, bowlMat);
  bowl.castShadow = shadows; bowl.receiveShadow = shadows;
  bowlG.add(bowl);
  const bowlSauceGeo = own((() => {
    const lvl = 0.031, P = [];
    const rl = 0.0715;
    P.push([rl + 0.003, lvl + 0.0018]);
    for (let i = 0; i <= 10; i++) P.push([lerp(rl, 0.0001, i / 10), lvl]);
    return revolve(P, [32, 48, 56][q], () => [sauceRGB.r, sauceRGB.g, sauceRGB.b, 1]);
  })());
  const bowlSauce = new THREE.Mesh(bowlSauceGeo, sauceMat);
  bowlSauce.renderOrder = 2;
  bowlG.add(bowlSauce);

  // the heap: drop the balls into the bowl and let them settle (build time, deterministic)
  const nBB = [14, 17, 20][q];
  const heap = [];
  {
    const P = [];
    for (let i = 0; i <= nBB; i++) { const a = R() * TAU, r = i === nBB ? 0 : R() * 0.055; P.push([Math.cos(a) * r, 0.04 + i * 0.03, Math.sin(a) * r]); }
    const cp = [0, 0];
    for (let it = 0; it < 500; it++) {
      for (const p of P) p[1] -= 0.0012;
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
          const a = P[i], b = P[j];
          const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz), need = BR * 1.94;
          if (d < need && d > 1e-6) {
            const k = (need - d) / d * 0.5;
            // (a little friction: sideways corrections count half, so the heap keeps a mound)
            a[0] -= dx * k * 0.5; a[1] -= dy * k; a[2] -= dz * k * 0.5; b[0] += dx * k * 0.5; b[1] += dy * k; b[2] += dz * k * 0.5;
          }
        }
        for (const p of P) {
          const r = Math.hypot(p[0], p[2]);
          const d = bowlContact(r, p[1], cp);
          const inside = p[1] > cp[1] || r < cp[0];
          if (d < BR || !inside) {
            const nr = r - cp[0], ny = p[1] - cp[1], nl = Math.hypot(nr, ny) || 1;
            const sgn = inside ? 1 : -1;
            const tr = cp[0] + (nr / nl) * BR * sgn, ty = cp[1] + (ny / nl) * BR * sgn;
            const s = r > 1e-6 ? tr / r : 0;
            p[0] *= s; p[2] *= s; p[1] = ty;
          }
        }
      }
    }
    for (let i = 0; i < nBB; i++) heap.push(V(...P[i]));
    heap.heroRest = V(...P[nBB]);
    heap.heroRest.y += 0.002;
  }
  const HERO_REST = heap.heroRest; // (bowl space)
  const bowlBalls = new THREE.InstancedMesh(ballGeo, ballMatI, nBB);
  bowlBalls.castShadow = shadows; bowlBalls.receiveShadow = shadows;
  // (its own shadow-pass material too: three's shared one would switch variants between this
  // instanced caster, the plain ones and her skinned meshes every frame)
  bowlBalls.customDepthMaterial = own(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  {
    const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
    heap.forEach((p, i) => { qq.setFromEuler(e.set(R() * TAU, R() * TAU, R() * TAU)); s.set(0.9 + R() * 0.16, 0.9 + R() * 0.16, 0.9 + R() * 0.16); m.compose(p, qq, s); bowlBalls.setMatrixAt(i, m); });
  }
  bowlG.add(bowlBalls);
  // veg tucked into the heap, and the spring-onion garnish that drifts down later
  const topBalls = heap.map((p, i) => [p.y, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => heap[i]);
  const nBC = [4, 5, 6][q], nBO = [2, 3, 3][q], nBR = [4, 5, 6][q], nG = reduced ? 7 : [8, 11, 13][q];
  const bowlCaps = new THREE.InstancedMesh(capsGeo, vegMat, nBC);
  const bowlOnion = new THREE.InstancedMesh(onionGeo, vegMat, nBO);
  const bowlRings = new THREE.InstancedMesh(ringGeo, vegMat, nBR + nG);
  bowlRings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bowlRings.frustumCulled = false;
  const GAR = { start: [], end: [], q0: [], q1: [], delay: new Float32Array(nG), sway: new Float32Array(nG) };
  {
    const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
    const up = V(0, 1, 0);
    const onTop = (k, lift, out, nrm) => { // a point on the upper surface of one of the top balls
      const b = topBalls[k % Math.min(topBalls.length, 8)];
      const a = R() * TAU, el = 0.35 + R() * 0.9;
      nrm.set(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      return out.copy(b).addScaledVector(nrm, BR + lift);
    };
    const place = (mesh, i, k, lift, base, scale, colors, flat = 0.6) => {
      onTop(k, lift, p, n);
      n.lerp(up, flat).normalize();
      qq.setFromUnitVectors(up, n).multiply(new THREE.Quaternion().setFromEuler(e.set(base, R() * TAU, 0, 'YXZ')));
      s.setScalar(scale * (0.85 + R() * 0.3));
      m.compose(p, qq, s); mesh.setMatrixAt(i, m);
      if (colors) mesh.setColorAt(i, c.set(colors[(R() * colors.length) | 0]));
    };
    for (let i = 0; i < nBC; i++) place(bowlCaps, i, i + 1, -0.0035, 0, 0.85, CAPS, 0.7);
    for (let i = 0; i < nBO; i++) place(bowlOnion, i, i + 3, -0.003, 0, 0.8, ONION, 0.75);
    for (let i = 0; i < nBR; i++) place(bowlRings, i, i + 2, 0.0006, Math.PI / 2, 1, RINGS, 0.3);
    // the garnish: from above the bowl, each to a resting place on the heap (never on the hero's spot)
    for (let g = 0; g < nG; g++) {
      const i = nBR + g;
      let tries = 0;
      do { onTop(g + 1, 0.0008, p, n); tries++; } while (p.distanceTo(HERO_REST) < BR * 1.6 && tries < 12);
      GAR.end.push(p.clone());
      GAR.q1.push(new THREE.Quaternion().setFromUnitVectors(up, n).multiply(new THREE.Quaternion().setFromEuler(e.set(Math.PI / 2, R() * TAU, 0, 'YXZ'))));
      GAR.start.push(V(p.x * 0.6 + (R() - 0.5) * 0.05, 0.2 + R() * 0.14, p.z * 0.6 + (R() - 0.5) * 0.05));
      GAR.q0.push(new THREE.Quaternion().setFromEuler(e.set(R() * TAU, R() * TAU, R() * TAU)));
      GAR.delay[g] = (g / nG) * 1.5 + R() * 0.25; GAR.sway[g] = R() * TAU;
      bowlRings.setColorAt(i, c.set(R() < 0.75 ? RINGS[(R() * 3) | 0] : RINGS[3]));
      m.makeScale(0, 0, 0); bowlRings.setMatrixAt(i, m);
    }
  }
  bowlG.add(bowlCaps, bowlOnion, bowlRings);
  const heapGlint = glowSprite(0xfff3dc, 0.05, { star: true, opacity: 0 });
  own(heapGlint.material);
  heapGlint.position.copy(topBalls[1]).add(V(-0.006, BR * 0.96, 0.008)).add(BOWL_AT);
  heapGlint.visible = false; late.push(heapGlint);
  scene.add(heapGlint);

  // chopsticks (light bamboo): a grip at the origin, +Y toward the tips; the second one pivots to pinch
  const TIP = 0.152;
  const chopMat = PM({ color: col('#d2ad78'), roughness: 0.45, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.6 });
  const stickGeo = own(new THREE.CylinderGeometry(0.0021, 0.0036, 0.215, 8));
  stickGeo.translate(0, 0.0425 + 0.0025, 0);
  const chop = new THREE.Group();
  const chopInner = new THREE.Group(); // (a fixed tilt of the pair in the hand)
  chop.add(chopInner);
  const stickA = new THREE.Mesh(stickGeo, chopMat);
  stickA.position.x = 0.0032;
  const stickB = new THREE.Mesh(stickGeo, chopMat);
  stickB.position.x = -0.0032;
  stickA.castShadow = stickB.castShadow = shadows;
  chopInner.add(stickA, stickB);
  const pickBall = new THREE.Mesh(ballGeo, ballMat);
  pickBall.position.set(-0.0135, TIP - 0.007, 0); // (gripped between the open tips)
  pickBall.visible = false; late.push(pickBall);
  chopInner.add(pickBall);
  const tipLocal = pickBall.position.clone(); // (the point the hand steers: where a held piece sits)
  // at rest on a little ceramic rest at her right hand, the tips toward the bowl
  const restAt = V(-0.04, TH, -0.2);
  const restMat = PM({ color: col('#f1ebe0'), roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.8 });
  const restGeo = own(new THREE.CapsuleGeometry(0.007, 0.03, 4, 10));
  restGeo.rotateZ(Math.PI / 2);
  const chopRest = new THREE.Mesh(restGeo, restMat);
  chopRest.position.copy(restAt).add(V(0, 0.006, 0));
  chopRest.rotation.y = -0.25;
  scene.add(chopRest);
  const CHOP_REST = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  {
    const dir = V(0.42, 0, 1).normalize();
    const zAx = V(0, 1, 0), xAx = new THREE.Vector3().crossVectors(dir, zAx).normalize();
    const mtx = new THREE.Matrix4().makeBasis(xAx, dir, new THREE.Vector3().crossVectors(xAx, dir));
    CHOP_REST.quat.setFromRotationMatrix(mtx);
    CHOP_REST.pos.copy(restAt).addScaledVector(dir, -0.085).add(V(0, 0.0092, 0));
    // (the pair rests across the rest: the grip end on the table, the tips lifted)
    CHOP_REST.quat.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), 0.085));
  }
  chop.position.copy(CHOP_REST.pos); chop.quaternion.copy(CHOP_REST.quat);
  scene.add(chop);

  // ---------------------------------------------------------------- the pendant lamp
  const shadeMat = PM({ vertexColors: true, roughness: 0.32, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.6, emissive: col('#ffb870'), emissiveIntensity: 1, emissiveMap: null });
  const shadeProfile = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; shadeProfile.push([0.012 + 0.128 * Math.pow(t, 1.6), 0.125 - 0.146 * Math.sin(t * Math.PI / 2)]); }
  shadeProfile.push([0.1435, -0.0255], [0.148, -0.0245]);
  for (let i = 14; i >= 0; i--) { const t = i / 14; shadeProfile.push([0.016 + 0.13 * Math.pow(t, 1.6), 0.13 - 0.15 * Math.sin(t * Math.PI / 2)]); }
  const shadeGeo = own(revolve(shadeProfile, [32, 40, 48][q], (j) => {
    const c = j <= 14 ? col('#fff1dc') : col('#2f4a3e');
    return [c.r, c.g, c.b];
  }));
  // (the inside glows: emissive only where the vertex colour is the pale lining)
  shadeMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= smoothstep(0.5, 0.8, vColor.r) * 0.55;\n#endif');
  };
  shadeMat.customProgramCacheKey = () => 'manchuria-shade';
  const shade = new THREE.Mesh(shadeGeo, shadeMat);
  shade.position.copy(LAMP).add(V(0, 0.02, 0));
  const bulbMat = own(new THREE.MeshBasicMaterial({ color: col('#ffe2b0').multiplyScalar(3.2) }));
  const bulb = new THREE.Mesh(own(new THREE.SphereGeometry(0.03, 20, 14)), bulbMat);
  bulb.position.copy(LAMP);
  const cordMat = SM({ color: col('#1a1412'), roughness: 0.6 });
  const cord = new THREE.Mesh(own(new THREE.CylinderGeometry(0.0035, 0.0035, 2.4 - LAMP.y - 0.15, 6)), cordMat);
  cord.position.set(LAMP.x, (2.4 + LAMP.y + 0.15) / 2, LAMP.z);
  const lampGlow = glowSprite(0xffc27a, 0.5, { opacity: 0.45 });
  own(lampGlow.material);
  lampGlow.position.copy(LAMP).add(V(0, -0.03, 0));
  scene.add(shade, bulb, cord, lampGlow);

  // ---------------------------------------------------------------- Deepu (the shared figure)
  const fig = createFigure(env, { who: 'deepu', quality: q });
  fig.group.position.copy(SEAT_AT);
  scene.add(fig.group);
  const REST_L = V(0.27, TH + 0.012, -0.29), REST_R = V(0.0, TH + 0.012, -0.33);
  fig.pose('sit', 1, { seat: SEAT });
  fig.reach('L', null, 0);
  fig.reach('R', null, 0);
  const LOOK_STOVE = V(-0.7, 1.0, -0.4);
  fig.lookAt(LOOK_STOVE, 3);
  fig.settle(2.2);

  // ---------------------------------------------------------------- particles
  // steam (three sources: wok, bowl, a piece held up)
  const nSW = [14, 26, 36][q], nSB = [12, 22, 30][q], nSP = [5, 7, 9][q];
  const nSteam = nSW + nSB + nSP;
  const steamMat = own(new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uSrc0: { value: V(WOK_AT.x, WOK_AT.y + 0.03, WOK_AT.z) }, uSrc1: { value: BOWL_AT.clone().add(V(0, 0.07, 0)) }, uSrc2: { value: new THREE.Vector3() },
      uOn: { value: new THREE.Vector3(0, 0, 0) }, uSpread: { value: V(0.09, 0.05, 0.008) }, uRise: { value: V(0.3, 0.2, 0.08) },
      uWind: { value: new THREE.Vector3() }, uCol: { value: col('#fff1e2').multiplyScalar(1.1) }, uAlpha: { value: 0.2 },
    },
    vertexShader: STEAM_VERT, fragmentShader: STEAM_FRAG, transparent: true, depthWrite: false,
  }));
  const steam = billboards(nSteam, [['aSeed', 4]], steamMat);
  own(steam.geo);
  for (let i = 0; i < nSteam; i++) {
    const src = i < nSW ? 0 : i < nSW + nSB ? 1 : 2;
    steam.attrs.aSeed.setXYZW(i, R(), src, src === 0 ? 0.07 + R() * 0.06 : src === 1 ? 0.045 + R() * 0.035 : 0.025 + R() * 0.015, src === 2 ? 0.5 + R() * 0.3 : 0.16 + R() * 0.1);
  }
  steam.mesh.renderOrder = 12;
  scene.add(steam.mesh);

  // bokeh: the far ones (out-of-focus lights by the window and the shelf), a few near ones for macros
  const nBack = [10, 16, 22][q], nFront = low ? 0 : [0, 6, 9][q];
  const bokehMat = own(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFront: { value: 0 }, uBack: { value: 1 } },
    vertexShader: BOKEH_VERT, fragmentShader: BOKEH_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const bokeh = billboards(nBack + nFront, [['aPos', 3], ['aCol', 4], ['aMisc', 3]], bokehMat);
  own(bokeh.geo);
  {
    const warm = [[1.0, 0.7, 0.38], [1.0, 0.62, 0.3], [1.0, 0.82, 0.55]], cool = [[0.55, 0.65, 1.0], [0.75, 0.82, 1.0]];
    for (let i = 0; i < nBack + nFront; i++) {
      const front = i >= nBack;
      let p, c;
      if (!front) {
        if (i % 3 === 0) { p = [lerp(-1.6, -1.1, R()), 1.5 + R() * 0.3, -0.86]; c = warm[(R() * 3) | 0]; } // by the jars
        else { p = [lerp(WIN.x0 + 0.05, WIN.x1 - 0.05, R()), lerp(WIN.y0 + 0.05, WIN.y0 + 0.45, R()), WIN.z + 0.02]; c = R() < 0.55 ? warm[(R() * 3) | 0] : cool[(R() * 2) | 0]; }
      } else if (i % 2) { // near the bowl's orbit
        const a = -0.6 + R() * 1.4, r = 0.24 + R() * 0.12;
        p = [BOWL_AT.x + Math.sin(a) * r, TH + 0.04 + R() * 0.1, BOWL_AT.z + Math.cos(a) * r];
        c = warm[(R() * 3) | 0];
      } else { // between the wok and its close-up
        const a = WOK_YAW + 1.2 + (R() - 0.5) * 0.9, r = 0.22 + R() * 0.1;
        p = [WOK_AT.x + Math.sin(a) * r * 1.3, WOK_AT.y + 0.06 + R() * 0.12, WOK_AT.z + Math.cos(a) * r];
        c = warm[(R() * 3) | 0];
      }
      bokeh.attrs.aPos.setXYZ(i, ...p);
      bokeh.attrs.aCol.setXYZW(i, c[0], c[1], c[2], front ? 0.08 + R() * 0.08 : 0.18 + R() * 0.3);
      bokeh.attrs.aMisc.setXYZ(i, front ? 0.016 + R() * 0.02 : 0.025 + R() * 0.045, R(), front ? 1 : 0);
    }
  }
  bokeh.mesh.renderOrder = 6;
  scene.add(bokeh.mesh);

  const nMote = [40, 80, 120][q];
  const moteMat = own(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBright: { value: 0.7 }, uLamp: { value: LAMP } },
    vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const motes = billboards(nMote, [['aPos', 3], ['aMisc', 3]], moteMat);
  own(motes.geo);
  for (let i = 0; i < nMote; i++) {
    const a = R() * TAU, r = Math.sqrt(R()) * 0.45;
    motes.attrs.aPos.setXYZ(i, LAMP.x + Math.cos(a) * r, TH + 0.12 + R() * 0.62, LAMP.z + Math.sin(a) * r);
    motes.attrs.aMisc.setXYZ(i, 0.0025 + R() * R() * 0.004, R(), 0.03 + R() * 0.05);
  }
  motes.mesh.renderOrder = 7;
  scene.add(motes.mesh);

  // her little sparkle of delight
  const sparkle = glowSprite(0xffe7b0, 0.08, { star: true, opacity: 0 });
  own(sparkle.material);
  sparkle.visible = false; late.push(sparkle);
  scene.add(sparkle);

  // ---------------------------------------------------------------- the golden thread (out of the steam)
  const strand = createStrand({ segments: low ? 90 : 150 });
  const STRAND_OPTS = { wobble: reduced ? 0.4 : 1 };
  strand.mesh.visible = false; late.push(strand.mesh);
  scene.add(strand.mesh);
  const threadPath = (() => {
    const c = BOWL_AT.clone().add(V(0, 0.06, 0));
    const pts = [];
    for (let i = 0; i <= 10; i++) { // a slow curl up through the steam
      const t = i / 10, a = t * TAU * 1.3 + 0.6, r = 0.012 + 0.03 * t;
      pts.push(V(c.x + Math.cos(a) * r, c.y + t * 0.24, c.z + Math.sin(a) * r));
    }
    pts.push(V(c.x + 0.12, c.y + 0.36, c.z - 0.06), V(c.x + 0.27, c.y + 0.5, c.z - 0.28), V(c.x + 0.3, c.y + 0.64, c.z - 0.56),
      V(c.x + 0.2, c.y + 0.74, c.z - 0.8), V(c.x + 0.12, c.y + 0.82, c.z - 1.02), V(c.x + 0.08, c.y + 0.9, c.z - 1.5));
    return new PathSampler(pts, { samples: 900 });
  })();

  // ---------------------------------------------------------------- state
  // S: everything the choreography animates; C: the camera (a subject to frame from an angle)
  const S = {
    key: 0, hood: 0, burner: 0, rim: 0, hemi: 0, window: 0, lamp: 0, flame: 1, exposure: 1,
    wokSteam: 0, bowlSteam: 0, pickSteam: 0, steamA: 0.2, bokehF: 0, bokehB: 1, motes: 0.7,
    toss: 0, tossK: 0, leap: -1, land: 0, track: 0, heroInBowl: 0, garnish: 0, glint: 0, heapGlint: 0,
    strand: 0, head: 0, len: 0.55, breath: reduced ? 0.25 : 0.7, sauceAmp: 0.32, wind: 0, sparkle: 0, pinch: 0.01, bite: 1, lookThread: 0,
  };
  const C = { tx: 0, ty: 1, tz: 0, az: 0, el: 0.3, fov: 30, hw: 0.3, hh: 0.2, lift: 0, trackK: 0 };
  const LIGHT_ON = { key: 1, hood: 1, burner: 1, rim: 1, hemi: 1, window: 1, lamp: 1 };
  let portrait = false;
  let time = 0, frozen = false, frozenT = 0;
  // the right hand: 0 free (lap) · 1 the socket to posR · 2 the chopstick tips to posR · 3 the tips to the mouth.
  // While it holds the chopsticks the pair points (D, world) from a natural approach — beside the
  // shoulder when picking, below and to the side of the mouth when eating (eat 0…1) — to the target.
  const G = { modeR: 0, kR: 1, posR: REST_R.clone(), D: V(0.3, -0.5, 0.8).normalize(), eat: 0, eatT: 0 };
  const UP = V(0, 1, 0);
  let lookMode = 0; // 0 fixed (as set) · 1 the held piece · 2 the thread's head · 3 the camera

  // the shots (subject centre, viewing azimuth/elevation, half-size to fit); portrait framings differ
  const shots = {
    wokWide: () => ({ tx: WOK_AT.x, ty: WOK_AT.y + 0.05, tz: WOK_AT.z, az: 0.98, el: 0.48, fov: 30, hw: portrait ? 0.24 : 0.36, hh: portrait ? 0.3 : 0.2, lift: 0.0 }),
    wok: () => ({ tx: WOK_AT.x, ty: WOK_AT.y + 0.045, tz: WOK_AT.z, az: 0.74, el: portrait ? 0.82 : 0.6, fov: 30, hw: portrait ? 0.16 : 0.22, hh: portrait ? 0.2 : 0.125, lift: 0 }),
    toss: () => ({ tx: WOK_AT.x, ty: WOK_AT.y + 0.07, tz: WOK_AT.z, az: 0.66, el: portrait ? 0.7 : 0.5, fov: 30, hw: portrait ? 0.18 : 0.25, hh: portrait ? 0.24 : 0.15, lift: 0 }),
    bowl: () => ({ tx: BOWL_AT.x, ty: BOWL_AT.y + 0.055, tz: BOWL_AT.z, az: 1.02, el: 0.62, fov: 30, hw: portrait ? 0.11 : 0.15, hh: portrait ? 0.15 : 0.105, lift: 0 }),
    bowlEnd: () => ({ tx: BOWL_AT.x, ty: BOWL_AT.y + 0.05, tz: BOWL_AT.z, az: reduced ? 0.85 : 0.5, el: 0.5, fov: 30, hw: portrait ? 0.11 : 0.16, hh: portrait ? 0.16 : 0.11, lift: 0 }),
    reveal: () => ({ tx: 0.12, ty: 0.94, tz: -0.36, az: -0.2, el: 0.17, fov: 30, hw: portrait ? 0.3 : 0.44, hh: portrait ? 0.5 : 0.31, lift: portrait ? 0.12 : 0.04 }),
    pick: () => ({ tx: 0.11, ty: 0.92, tz: -0.36, az: -0.12, el: 0.24, fov: 30, hw: portrait ? 0.24 : 0.36, hh: portrait ? 0.42 : 0.26, lift: portrait ? 0.1 : 0.02 }),
    bite: () => ({ tx: 0.11, ty: 1.06, tz: -0.52, az: -0.26, el: 0.1, fov: 30, hw: portrait ? 0.17 : 0.3, hh: portrait ? 0.32 : 0.21, lift: portrait ? 0.12 : 0.04 }),
    follow: () => ({ az: 0.8, el: 0.24, fov: 30, hw: portrait ? 0.13 : 0.2, hh: portrait ? 0.2 : 0.13, lift: 0 }),
    her: () => ({ tx: 0.12, ty: 0.98, tz: -0.42, az: -0.06, el: 0.14, fov: 30, hw: portrait ? 0.2 : 0.32, hh: portrait ? 0.36 : 0.23, lift: portrait ? 0.15 : 0.06 }),
    thread: () => ({ tx: 0.18, ty: 1.14, tz: -0.5, az: -0.3, el: 0.08, fov: 30, hw: portrait ? 0.32 : 0.52, hh: portrait ? 0.58 : 0.36, lift: 0 }),
  };

  // ---------------------------------------------------------------- per-frame
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _tg = new THREE.Vector3();
  const trackP = new THREE.Vector3(), trackSm = new THREE.Vector3();
  let trackInit = false;
  const leapA = new THREE.Vector3(), leapB = new THREE.Vector3(), leapC = new THREE.Vector3();
  const heroW = new THREE.Vector3(), mouthW = new THREE.Vector3(), headQ = new THREE.Quaternion(), headPos = new THREE.Vector3();
  const tipW = new THREE.Vector3();
  const bump = (p, a, b) => (p <= a || p >= b ? 0 : Math.sin(Math.PI * (p - a) / (b - a)));

  const socketR = fig.parts.handSocketR;
  /** The pair's world orientation (into _q): +Y along D, the spread axis level. */
  function setChopWorld(D) {
    _v2.crossVectors(D, UP);
    if (_v2.lengthSq() < 1e-6) _v2.set(1, 0, 0);
    _v2.normalize();
    _v3.crossVectors(_v2, D);
    _m.makeBasis(_v2, D, _v3);
    return _q.setFromRotationMatrix(_m);
  }

  function writeWok(t) {
    const p = S.toss, k = S.tossK;
    // the wok: a push away from the handle, a quick pull back with the far lip flicking up
    wokPivot.position.set(0, 0.012 * bump(p, 0.24, 0.5) * k, (-0.026 * bump(p, 0, 0.3) + 0.014 * bump(p, 0.26, 0.5)) * k);
    wokPivot.rotation.x = -0.15 * bump(p, 0.24, 0.48) * k;
    wokPivot.updateMatrixWorld(true);
    for (let i = 0; i < N_ITEMS; i++) {
      const u = clamp((p - IT.delay[i]) / IT.fl[i], 0, 1);
      const air = 4 * u * (1 - u) * (p > 0 ? 1 : 0);
      const su = smooth(0, 1, u);
      const a = IT.a[i] + IT.da[i] * su;
      const r = IT.r[i];
      _p.set(Math.cos(a) * r + IT.sx[i] * air, IT.y[i] + IT.h[i] * air * k, Math.sin(a) * r);
      _p.z += IT.sz[i] * Math.sin(Math.PI * u) * k;
      // (a small wobble while it sizzles)
      _p.y += Math.sin(t * 9 + i * 1.7) * 0.0006 * (IT.kind[i] === 0 ? 1 : 0.5);
      const sp = IT.spin[i] * su;
      _e.set(IT.rx[i] + sp * 0.5, IT.ry[i] + sp, IT.rz[i] + sp * 0.3, 'YXZ');
      _q.setFromEuler(_e);
      _s.setScalar(IT.s[i]);
      const kind = IT.kind[i], idx = IT.idx[i];
      if (kind === 0 && idx === HERO) {
        if (S.leap < 0) { _m.compose(_p, _q, _s); hero.matrix.multiplyMatrices(wokPivot.matrixWorld, _m); }
        _s.setScalar(0);
      }
      _m.compose(_p, _q, _s);
      (kind === 0 ? wokBalls : kind === 1 ? wokCaps : kind === 2 ? wokOnion : wokRings).setMatrixAt(idx, _m);
    }
    wokBalls.instanceMatrix.needsUpdate = wokCaps.instanceMatrix.needsUpdate = wokOnion.instanceMatrix.needsUpdate = wokRings.instanceMatrix.needsUpdate = true;
  }

  function writeHero(t) {
    if (S.leap < 0) { hero.matrix.decompose(hero.position, hero.quaternion, hero.scale); return; }
    if (S.heroInBowl) {
      hero.position.copy(HERO_REST).add(BOWL_AT);
      const u = S.land;
      hero.position.y += 0.009 * Math.abs(Math.sin(u * Math.PI * 2.2)) * (1 - u) * (1 - u);
      const sq = 1 - 0.14 * (1 - smooth(0, 0.18, u)) * (u > 0 ? 1 : 0);
      hero.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    } else {
      const s = S.leap, a = 1 - s;
      hero.position.set(a * a * leapA.x + 2 * a * s * leapC.x + s * s * leapB.x, a * a * leapA.y + 2 * a * s * leapC.y + s * s * leapB.y, a * a * leapA.z + 2 * a * s * leapC.z + s * s * leapB.z);
      hero.rotation.set(s * 5.2, s * 3.1, s * 1.4);
      hero.scale.setScalar(1);
    }
  }

  function writeGarnish(t) {
    const tt = S.garnish * 2.8;
    for (let g = 0; g < nG; g++) {
      const u = clamp((tt - GAR.delay[g]) / 1.25, 0, 1);
      if (u <= 0) { _m.makeScale(0, 0, 0); bowlRings.setMatrixAt(nBR + g, _m); continue; }
      const e = 1 - (1 - u) * (1 - u);
      _p.lerpVectors(GAR.start[g], GAR.end[g], e);
      const sw = (1 - e) * 0.018;
      _p.x += Math.sin(u * 7 + GAR.sway[g]) * sw; _p.z += Math.cos(u * 5.3 + GAR.sway[g]) * sw;
      _q.slerpQuaternions(GAR.q0[g], GAR.q1[g], smooth(0.2, 1, u));
      _s.setScalar(smooth(0, 0.12, u));
      _m.compose(_p, _q, _s);
      bowlRings.setMatrixAt(nBR + g, _m);
    }
    bowlRings.instanceMatrix.needsUpdate = true;
  }

  function camFrame(t) {
    const th = Math.tan((C.fov * DEG) / 2);
    const Rr = Math.max(C.hh / th, C.hw / (th * camera.aspect));
    _tg.set(C.tx, C.ty, C.tz);
    if (C.trackK > 0) {
      if (!trackInit) { trackSm.copy(trackP); trackInit = true; }
      _tg.lerp(trackSm, C.trackK);
    } else trackInit = false;
    const ce = Math.cos(C.el);
    rig.pos.set(_tg.x + Rr * Math.sin(C.az) * ce, _tg.y + Rr * Math.sin(C.el), _tg.z + Rr * Math.cos(C.az) * ce);
    rig.look.copy(_tg); rig.look.y -= C.lift * C.hh;
    rig.fov = C.fov;
    rig.breath = S.breath * clamp(Rr / 1.3, 0.2, 1);
    rig.apply(t);
  }

  function update(dt, t) {
    if (frozen) { dt = 0; t = frozenT; } else time = t;
    // lights
    key.intensity = LI.key * S.key; hood.intensity = LI.hood * S.hood; rim.intensity = LI.rim * S.rim; hemi.intensity = LI.hemi * S.hemi;
    burner.intensity = LI.burner * S.burner * (0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7.3));
    glassMat.color.setScalar(1.25 * S.window);
    bulbMat.color.setRGB(3.2 * S.lamp, 2.65 * S.lamp, 2.0 * S.lamp);
    lampGlow.material.opacity = 0.45 * S.lamp;
    shadeMat.emissiveIntensity = S.lamp;
    hoodStripMat.color.setRGB(2.2 * S.hood, 1.8 * S.hood, 1.4 * S.hood);
    flameMat.uniforms.uTime.value = t; flameMat.uniforms.uOn.value = S.flame;
    burnerGlow.material.opacity = 0.35 * S.flame; burnerWarm.material.opacity = 0.28 * S.flame;
    api.exposure = S.exposure;

    // the wok and its contents
    wokG.updateMatrixWorld(true);
    writeWok(t);
    writeHero(t);
    if (S.garnish > 0) writeGarnish(t);
    // the sauce: slow swirls; four bubbles in the wok's pool (world positions for the shader)
    sauceU.uSauceT.value = t; sauceU.uSauceAmp.value = S.sauceAmp;
    for (let i = 0; i < 4; i++) {
      const a = i * 1.9 + 0.4, r = 0.018 + i * 0.012;
      _v.set(Math.cos(a) * r, SAUCE_H, Math.sin(a) * r).applyMatrix4(wokPivot.matrixWorld);
      sauceU.uBub.value[i].set(_v.x, _v.y, _v.z, i * 0.27);
    }
    // glints that slide over the glossy food
    heroGlint.visible = S.glint > 0.01 && hero.visible;
    if (heroGlint.visible) {
      heroGlint.position.copy(hero.position).add(_v.set(-0.007, BR * 0.92, 0.006));
      const tw = 0.65 + 0.35 * Math.sin(t * 2.3);
      heroGlint.material.opacity = S.glint * tw * 0.8; heroGlint.scale.setScalar(0.02 + 0.018 * tw * S.glint);
    }
    heapGlint.visible = S.heapGlint > 0.01;
    if (heapGlint.visible) { const tw = 0.55 + 0.45 * Math.sin(t * 1.7 + 1); heapGlint.material.opacity = S.heapGlint * tw * 0.8; heapGlint.scale.setScalar(0.02 + 0.018 * tw); }

    // the figure: the right hand's goal (socket / chopstick tips / the mouth), gaze
    if (G.modeR >= 2) {
      fig.mouthWorld(mouthW);
      if (G.modeR === 3) {
        fig.parts.head.getWorldQuaternion(headQ);
        _v2.set(0, -0.006, 0.012).applyQuaternion(headQ);
        G.posR.copy(mouthW).add(_v2);
      }
      G.eat = damp(G.eat, G.eatT, 5, dt);
      fig.parts.shoulderR.getWorldPosition(_v2).add(_v3.set(0.0, 0.2, 0.08));
      _v3.copy(mouthW).add(_v.set(-0.09, -0.15, 0.07));
      _v2.lerp(_v3, G.eat);
      _v.subVectors(G.posR, _v2).normalize();
      G.D.lerp(_v, 1 - Math.exp(-8 * dt)).normalize();
      setChopWorld(G.D);
      // the grip (the socket) goes where the tips reach the target
      _v3.copy(tipLocal).applyQuaternion(_q);
      _v2.copy(G.posR).sub(_v3);
      fig.reach('R', _v2, G.kR, 1.15);
    } else if (G.modeR === 1) fig.reach('R', G.posR, G.kR, 1);
    else fig.reach('R', null, 0);
    if (lookMode === 1) { pickBall.getWorldPosition(_v); fig.lookAt(_v, 6); }
    else if (lookMode === 2) { threadPath.at(Math.max(0.05, S.head - 0.05), _v); fig.lookAt(_v, 3); }
    else if (lookMode === 3) fig.lookAt(camera.position, 4);
    fig.update(dt, t);
    if (G.modeR >= 2) { // (in the hand: the pair's orientation relative to the socket, after the solve)
      socketR.getWorldQuaternion(_q2).invert();
      chop.quaternion.copy(_q2).multiply(_q);
    }
    // the pinch (the second chopstick turns about the grip), the piece being eaten
    stickB.rotation.z = S.pinch;
    pickBall.scale.setScalar(S.bite);
    if (pickBall.visible && S.bite < 0.02) pickBall.visible = false;

    // particles
    steamMat.uniforms.uTime.value = t;
    _v.set(S.wokSteam, S.bowlSteam, S.pickSteam);
    steamMat.uniforms.uOn.value.copy(_v);
    steamMat.uniforms.uAlpha.value = S.steamA;
    steamMat.uniforms.uSrc0.value.set(0, 0.035, 0).applyMatrix4(wokPivot.matrixWorld);
    if (pickBall.visible) pickBall.getWorldPosition(steamMat.uniforms.uSrc2.value);
    steamMat.uniforms.uWind.value.set(S.wind * -0.05, S.wind * 0.02, S.wind * 0.05);
    bokehMat.uniforms.uTime.value = t; bokehMat.uniforms.uFront.value = S.bokehF; bokehMat.uniforms.uBack.value = S.bokehB;
    moteMat.uniforms.uTime.value = t; moteMat.uniforms.uBright.value = S.motes * S.lamp;
    sparkle.visible = S.sparkle > 0.01;
    if (sparkle.visible) {
      fig.parts.head.getWorldPosition(headPos);
      fig.parts.head.getWorldQuaternion(headQ);
      sparkle.position.copy(headPos).add(_v.set(0.11, 0.2, 0.08).applyQuaternion(headQ));
      sparkle.material.opacity = S.sparkle * 0.9; sparkle.scale.setScalar(0.035 + 0.04 * S.sparkle);
      sparkle.material.rotation = t * 0.6;
    }

    // the thread
    strand.mesh.visible = S.strand > 0.01;
    if (strand.mesh.visible) {
      strand.uniforms.uOpacity.value = S.strand;
      strand.update(threadPath, Math.max(0, S.head - S.len), Math.max(0.001, S.head), t, STRAND_OPTS);
    }

    // the camera (following a moving subject when asked)
    if (C.trackK > 0) {
      if (S.leap >= 0) trackP.copy(hero.position);
      else threadPath.at(Math.min(threadPath.length, Math.max(0, S.head - 0.1)), trackP);
      trackSm.x = damp(trackSm.x, trackP.x, 11, dt); trackSm.y = damp(trackSm.y, trackP.y, 11, dt); trackSm.z = damp(trackSm.z, trackP.z, 11, dt);
    }
    camFrame(t);
    void heroW;
  }

  function resize({ aspect }) {
    camera.aspect = aspect;
    portrait = aspect < 0.8;
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- the beats
  // (dev only: ?at=bite&hold=1.2 freezes the movement 1.2 s into that beat, for screenshots)
  let held = false;
  const wait = async (sec) => { await env.wait(sec); while (held) await env.wait(0.5); };
  const later = (sec, fn) => env.later(sec, () => { if (!held) fn(); });
  const tw = (target, vars) => env.to(target, { overwrite: 'auto', ...vars });
  const camTo = (shot, vars) => tw(C, { ...shot, ...vars });
  const linesOf = (k) => (env.T[k] || []).map((l) => env.fill(l)).filter(Boolean);

  function toss(strength, dur) {
    planToss(strength);
    S.toss = 0; S.tossK = strength;
    env.sfx('whoosh', { volume: 0.35 });
    later(dur * 0.42, () => env.sfx('sizzle', { duration: 1.2, volume: 0.7 }));
    return new Promise((res) => tw(S, { toss: 1, duration: dur, ease: 'none', onComplete: () => { commitToss(); S.toss = 0; res(); } }));
  }

  /** Put the hand, the chopsticks and the piece where a beat begins (dev jump and clean starts). */
  function placeHands(stage) {
    // stage: 0 resting · 1 chopsticks in hand · 2 holding the piece · 3 piece eaten
    fig.hold('R', null);
    if (stage === 0) {
      scene.add(chop); chop.position.copy(CHOP_REST.pos); chop.quaternion.copy(CHOP_REST.quat);
      G.modeR = 0; G.posR.copy(REST_R);
      fig.reach('L', null, 0);
    } else {
      fig.reach('L', REST_L, 1, 1);
      fig.hold('R', chop, { snap: 'instant', align: false });
      G.modeR = 2; G.eat = G.eatT = 0;
      G.posR.copy(BOWL_AT).add(stage === 2 ? V(-0.02, 0.12, -0.1) : V(-0.07, 0.12, -0.1));
      fig.parts.shoulderR.getWorldPosition(_v2).add(_v3.set(0.0, 0.2, 0.08));
      G.D.subVectors(G.posR, _v2).normalize();
      setChopWorld(G.D);
      _v3.copy(tipLocal).applyQuaternion(_q);
      fig.reach('R', _v2.copy(G.posR).sub(_v3), 1, 1);
      fig.settle(0.4);
      socketR.getWorldQuaternion(_q2).invert();
      chop.quaternion.copy(_q2).multiply(_q);
    }
    pickBall.visible = stage === 2; S.bite = 1; S.pinch = stage === 2 ? 0.185 : 0.01;
    lookMode = 0;
  }

  function snap(b) {
    const i = BEATS.indexOf(b);
    Object.assign(S, LIGHT_ON, { flame: 1, exposure: 1, wokSteam: 0.85, bowlSteam: 0, pickSteam: 0, steamA: 0.2, bokehF: 0, bokehB: 1, motes: i >= 4 ? 0.7 : 0,
      toss: 0, tossK: 0, leap: -1, land: 0, heroInBowl: 0, garnish: 0, glint: 0.6, heapGlint: 0, strand: 0, head: 0, sauceAmp: 0.32, wind: 0, sparkle: 0, lookThread: 0, breath: reduced ? 0.25 : 0.7 });
    C.trackK = 0;
    hero.matrixAutoUpdate = true; hero.visible = true;
    fig.expression('neutral'); fig.blush(0);
    fig.lookAt(LOOK_STOVE, 3);
    placeHands(i >= 6 ? 3 : i === 5 ? 2 : 0);
    if (i <= 0) Object.assign(C, shots.wokWide());
    if (i === 1) Object.assign(C, shots.wok());
    if (i === 2) Object.assign(C, shots.toss());
    if (i >= 3) {
      S.leap = 1; S.heroInBowl = 1; S.land = 1; S.garnish = i >= 4 ? 1 : 0; S.bowlSteam = 1; S.wokSteam = 0.5;
      Object.assign(C, shots.bowl());
    }
    if (i >= 4) { Object.assign(C, shots.reveal()); S.heapGlint = 0; }
    if (i >= 5) { Object.assign(C, shots.pick()); hero.visible = false; fig.expression('smile', 0.8); fig.lookAt(BOWL_AT, 4); lookMode = 1; }
    if (i >= 6) { Object.assign(C, shots.bite()); fig.expression('delight', reduced ? 0.7 : 1); fig.blush(0.4); lookMode = 0; fig.lookAt(camera.position, 3); }
    if (i >= 7) { Object.assign(C, shots.her()); fig.expression('smile', 0.9); fig.blush(0.45); }
    if (i >= 5) fig.settle(0.8);
    writeGarnish(0);
  }

  const beats = {
    // the veil opens on a slow push into the wok: sizzle, steam, the sauce moving
    async wok(dir) {
      env.mood('tender');
      Object.assign(S, { key: 0.5, hood: 0.4, burner: 0.6, rim: 0.4, hemi: 0.5, window: 0.6, lamp: 0.6 });
      Object.assign(C, shots.wokWide());
      tw(S, { ...LIGHT_ON, duration: reduced ? 1.4 : 2.4, ease: 'sine.inOut' });
      const v = dir.veil(0, { duration: reduced ? 1.0 : 1.4, ease: 'sine.inOut' });
      later(0.3, () => env.sfx('sizzle', { duration: 2.4, volume: 0.8 }));
      tw(S, { wokSteam: 1, duration: 1.8 });
      tw(S, { glint: 0.7, duration: 1.4, delay: 0.8 });
      if (!reduced) {
        camTo(shots.wok(), { duration: 3.8, ease: 'sine.inOut' });
        tw(S, { bokehF: 0.8, duration: 2.0 });
      } else camTo({ az: C.az - 0.08 }, { duration: 3, ease: 'sine.inOut' });
      await v;
      await wait(reduced ? 1.8 : 1.3);
    },
    // one gentle toss
    async toss() {
      if (!reduced) camTo(shots.toss(), { duration: 1.4, ease: 'sine.inOut' });
      await wait(0.2);
      await toss(reduced ? 0.55 : 0.8, 1.05);
      await wait(0.25);
    },
    // a second toss: ONE ball leaps out, the camera follows it to the bowl on the table
    async leap(dir) {
      if (reduced) {
        await dir.veil(1, { duration: 0.45 });
        Object.assign(C, shots.bowl()); S.bokehF = 0;
        S.bowlSteam = 1; S.wokSteam = 0.5;
        // (a short drop from just above the bowl instead of the long flight)
        leapB.copy(HERO_REST).add(BOWL_AT); leapA.copy(leapB).add(V(0, 0.09, 0)); leapC.copy(leapA);
        S.leap = 0; hero.matrixAutoUpdate = true;
        const v = dir.veil(0, { duration: 0.6 });
        await v;
        await new Promise((res) => tw(S, { leap: 1, duration: 0.45, ease: 'power2.in', onComplete: res }));
        S.heroInBowl = 1; S.land = 0; env.sfx('plate', { volume: 0.8 });
        tw(S, { land: 1, duration: 0.6, ease: 'none' });
        await wait(0.7);
        return;
      }
      planToss(1);
      S.toss = 0; S.tossK = 1;
      env.sfx('whoosh', { volume: 0.4 });
      tw(S, { toss: 1, duration: 1.05, ease: 'none', onComplete: () => { commitToss(); S.toss = 0; } });
      await wait(0.3);
      // the hero leaves with the others, then keeps going: a slow arc to the bowl
      leapA.copy(hero.position);
      leapB.copy(HERO_REST).add(BOWL_AT);
      leapC.lerpVectors(leapA, leapB, 0.5).add(V(0, 0.34, 0));
      S.leap = 0; hero.matrixAutoUpdate = true;
      trackP.copy(leapA); trackInit = false;
      tw(C, { trackK: 1, duration: 0.5, ease: 'sine.out' });
      const b = shots.bowl();
      camTo(shots.follow(), { duration: 1.2, ease: 'sine.inOut' });
      later(1.2, () => camTo({ az: b.az, el: b.el, tx: b.tx, ty: b.ty, tz: b.tz }, { duration: 1.5, ease: 'sine.inOut' }));
      tw(S, { bokehF: 0, glint: 1, duration: 1.0 });
      later(0.5, () => env.sfx('whoosh', { volume: 0.25 }));
      await new Promise((res) => tw(S, { leap: 1, duration: 2.1, ease: 'power1.inOut', onComplete: res }));
      S.heroInBowl = 1; S.land = 0;
      env.sfx('plate', { volume: 0.8 });
      tw(S, { land: 1, duration: 0.7, ease: 'none' });
      tw(S, { bowlSteam: 1, wokSteam: 0.5, duration: 1.2 });
      tw(C, { trackK: 0, duration: 1.0, ease: 'sine.inOut' });
      camTo({ hw: b.hw, hh: b.hh }, { duration: 1.2, ease: 'sine.inOut' });
      await wait(0.7);
    },
    // the sauce glistens, steam rises, spring-onion rings drift down; a slow move round the bowl
    async bowl() {
      tw(S, { heapGlint: 1, glint: 1, sauceAmp: 0.38, duration: 1.0 });
      tw(S, { garnish: 1, duration: reduced ? 2.2 : 2.4, ease: 'none' });
      tw(S, { bokehF: 0.7, duration: 1.2 });
      if (!reduced) camTo(shots.bowlEnd(), { duration: 3.6, ease: 'sine.inOut' });
      await wait(reduced ? 2.2 : 2.5);
    },
    // the camera rises: she is at the table; she notices, smiles, takes the chopsticks, picks it up
    async notice(dir) {
      if (reduced) {
        await dir.veil(1, { duration: 0.45 });
        Object.assign(C, shots.reveal()); S.bokehF = 0; S.heapGlint = 0.5; S.motes = 0.5;
        dir.veil(0, { duration: 0.6 });
      } else {
        camTo(shots.reveal(), { duration: 2.6, ease: 'sine.inOut' });
        tw(S, { bokehF: 0, heapGlint: 0.5, duration: 1.2 });
        tw(S, { motes: 0.7, duration: 2.0 });
      }
      await wait(reduced ? 0.5 : 0.8);
      // she notices
      fig.lookAt(BOWL_AT.clone().add(V(0, 0.05, 0)), 5);
      fig.expression('surprise', 0.45);
      await wait(0.4);
      fig.expression('smile', 1);
      fig.blush(0.25);
      fig.reach('L', REST_L, 1, 0.7); // (she leans in, a hand on the table)
      await wait(reduced ? 0.5 : 0.65);
      // takes the chopsticks
      G.modeR = 1; G.posR.copy(CHOP_REST.pos).add(V(0, 0.012, 0));
      if (!reduced) camTo(shots.pick(), { duration: 2.6, ease: 'sine.inOut' });
      await wait(0.85);
      fig.hold('R', chop, { snap: true, align: false });
      // (from here the hand steers the tips; the pair turns smoothly from where it lay)
      chop.updateWorldMatrix(true, false);
      G.D.set(0, 1, 0).transformDirection(chop.matrixWorld);
      tipW.copy(tipLocal).applyMatrix4(chop.matrixWorld);
      G.modeR = 2; G.eat = G.eatT = 0;
      G.posR.copy(tipW);
      await wait(0.25);
      // tips above the piece, open
      const above = hero.position.clone().add(V(0.004, 0.05, 0.0));
      tw(G.posR, { x: above.x, y: above.y, z: above.z, duration: 0.7, ease: 'sine.inOut' });
      tw(S, { pinch: 0.27, duration: 0.45, delay: 0.25 });
      await wait(0.8);
      // down onto it, close
      const at = hero.position.clone();
      tw(G.posR, { x: at.x, y: at.y, z: at.z, duration: 0.45, ease: 'sine.out' });
      await wait(0.5);
      tw(S, { pinch: 0.185, duration: 0.18 });
      await wait(0.16);
      hero.visible = false; pickBall.visible = true; S.bite = 1;
      lookMode = 1;
      S.glint = 0;
      tw(S, { pickSteam: 1, duration: 0.6 });
      const lift = at.clone().add(V(-0.02, 0.07, -0.05));
      tw(G.posR, { x: lift.x, y: lift.y, z: lift.z, duration: 0.6, ease: 'sine.inOut' });
      await wait(0.55);
    },
    // she eats it, chews, delights
    async bite() {
      if (!reduced) camTo(shots.bite(), { duration: 2.2, ease: 'sine.inOut' });
      G.eatT = 1;
      // to just in front of her mouth, mouth opening
      fig.mouthWorld(mouthW);
      const front = mouthW.clone().add(V(-0.012, -0.03, 0.09));
      tw(G.posR, { x: front.x, y: front.y, z: front.z, duration: 0.9, ease: 'sine.inOut' });
      later(0.5, () => fig.expression('mouthOpen', 0.75));
      await wait(0.95);
      G.modeR = 3;
      await wait(0.38);
      // the bite
      tw(S, { bite: 0, pickSteam: 0, duration: 0.16, ease: 'power2.in' });
      fig.expression('chew', 1);
      lookMode = 0; fig.lookAt(camera.position.clone().lerp(BOWL_AT, 0.6), 2.5);
      await wait(0.2);
      G.modeR = 2; G.eatT = 0;
      const down = BOWL_AT.clone().add(V(-0.07, 0.12, -0.1));
      tw(G.posR, { x: down.x, y: down.y, z: down.z, duration: 0.9, ease: 'sine.inOut' });
      tw(S, { pinch: 0.02, duration: 0.3 });
      await wait(1.0);
      // delight
      fig.expression('delight', reduced ? 0.7 : 1);
      fig.blush(0.45);
      env.sfx('sparkle', { volume: 0.45 });
      tw(S, { sparkle: 1, duration: 0.25, ease: 'power2.out', onComplete: () => tw(S, { sparkle: 0, duration: 0.9, delay: 0.25, ease: 'sine.in' }) });
      await wait(reduced ? 1.4 : 1.8);
    },
    // she is already going for one more — caught, she glances at us
    async savour(dir) {
      const lines = linesOf('manchuriaLines');
      if (reduced) await wait(0.2);
      // one more… (the heap catches the light as she reaches for it)
      fig.expression('smile', 1);
      fig.lookAt(BOWL_AT.clone().add(V(0, 0.04, 0)), 4);
      const hover = BOWL_AT.clone().add(V(-0.01, 0.075, 0.0));
      tw(G.posR, { x: hover.x, y: hover.y, z: hover.z, duration: 1.0, ease: 'sine.inOut' });
      tw(S, { pinch: 0.25, duration: 0.5, delay: 0.5 });
      tw(S, { heapGlint: 1, sauceAmp: 0.42, duration: 1.2 });
      if (!reduced) {
        camTo(shots.her(), { duration: 1.8, ease: 'sine.inOut' });
        tw(S, { bokehF: 0, duration: 1.2 });
      }
      await wait(reduced ? 1.0 : 1.3);
      // …caught: a glance at us, a playful smile
      lookMode = 3;
      fig.expression('smile', 1);
      fig.blush(0.55);
      later(0.5, () => { if (!reduced) { fig.expression('delight', 0.55); later(0.7, () => fig.expression('smile', 1)); } });
      const said = lines.length ? env.narrate(lines, { position: 'bottom' }) : Promise.resolve();
      await wait(reduced ? 1.3 : 1.6);
      await said;
      void dir;
    },
    // the golden thread rises out of the steam, curls and leads on; the veil closes
    async thread(dir) {
      env.mood('wonder');
      env.sfx('shimmer', { volume: 0.5 });
      lookMode = 2;
      S.head = 0; S.len = 0.5;
      tw(S, { strand: 1, duration: 0.5 });
      tw(S, { bowlSteam: 1.3, duration: 0.8 });
      const T = reduced ? 2.8 : 3.3;
      tw(S, { head: threadPath.length + S.len, duration: T, ease: 'sine.inOut' });
      if (!reduced) {
        camTo(shots.thread(), { duration: 1.8, ease: 'sine.inOut' });
        later(1.4, () => { trackInit = false; tw(C, { trackK: 0.35, duration: 1.8, ease: 'sine.inOut' }); });
      }
      later(T * 0.45, () => fig.expression('delight', reduced ? 0.6 : 0.85));
      await wait(T * 0.72);
      await dir.veil(1, { duration: reduced ? 0.8 : 1.0, color: '#05040c', ease: 'sine.in' });
      tw(S, { strand: 0, duration: 0.2 });
    },
  };

  async function play(dir) {
    const params = dev ? new URLSearchParams(location.search) : null;
    const at = params ? params.get('at') : null;
    const i0 = at && BEATS.includes(at) ? BEATS.indexOf(at) : 0;
    snap(BEATS[i0]);
    if (dev) {
      api.dev.t0 = performance.now(); api.dev.beat = BEATS[i0];
      const hold = parseFloat(params.get('hold'));
      if (hold >= 0) {
        env.later((i0 > 0 ? 0.3 : 0) + hold, () => {
          env.gsap.globalTimeline.pause(); held = true; frozenT = time; fig.settle(0.6); frozen = true; api.dev.held = true;
        });
      }
    }
    if (i0 > 0) { env.mood('tender'); await dir.veil(0, { duration: 0.3 }); }
    for (let i = i0; i < BEATS.length; i++) {
      env.guard();
      if (dev) { api.dev.beat = BEATS[i]; api.dev.beatT0 = performance.now(); }
      await beats[BEATS[i]](dir);
    }
    if (dev) api.dev.beat = 'done';
  }

  const api = {
    id: 'manchuria', scene, camera,
    exposure: 1,
    bloom: { strength: 0.42, radius: 0.55, threshold: 0.92 },
    late,
    update, resize, play,
    dispose() {
      fig.dispose();
      strand.dispose();
      key.dispose(); hood.dispose(); burner.dispose(); rim.dispose(); hemi.dispose();
      for (const m of [wokBalls, wokCaps, wokOnion, wokRings, bowlBalls, bowlCaps, bowlOnion, bowlRings, jars, lids]) m.dispose();
      for (const o of owned) o.dispose?.();
    },
    dev: dev ? { beat: '', t0: 0, beatT0: 0, held: false, fig, S, C, G, counts: { N_ITEMS, nBB, nSteam, nMote, nBack, nFront, nG } } : null,
  };
  return api;
}
