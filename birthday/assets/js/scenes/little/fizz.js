// "The Little Things" · movement 2 — sprite: her playful side.
//
// From the dark the golden thread arrives; one bubble rises… another… then dozens. The camera
// drifts through them to a macro of cold condensation on green glass, then pulls back: a cold,
// clear-green soda bottle — an original design (a turned silhouette with a band of raised
// "bubble" glass, a few slim ridges on the shoulder, a pale sage screw cap, a kraft-paper tag tied
// at the neck with her word on it in handwriting), a lime wheel at its foot on a dark glossy
// surface. A slow hero orbit while the line plays; the cap twists off — pssh — and a
// burst of bubbles fills the screen; the thread weaves through them and leaves upward; one bubble
// catches the golden light, a warm memory glowing inside it, and drifts close until the frame is
// warm gold: the hand-off to the night street (a warm '#ffe3a3' veil).
//
// No logo, no brand lettering, no ad composition: the only word is the owner's tag (T.spriteTag,
// '' = no tag). Contract: ./kit.js. Every material, mesh and texture is made in build(); update()
// only writes transforms, attributes and uniforms.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createStrand, PathSampler, createRig, glowSprite, glowTexture, textTexture, rng, TAU, clamp, smooth, lerp } from './kit.js';

const DEG = Math.PI / 180;
const TOP = 2.34; // the bottle's mouth
const FILL = 1.62; // the liquid's level (high in the shoulder)
const WALL = 0.016; // glass thickness
const KNOT_Y = 2.06; // where the tag's string is tied round the neck
const TAG = { th: 0.32, y: 1.07, w: 0.3, h: 0.15, tilt: -9 * DEG };
// the silhouette: a straight body, then one long soda-bottle shoulder into a slim neck
const SH0 = 0.95, SH1 = 1.98, R0 = 0.305, RN = 0.118;
const BEATS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];

// ------------------------------------------------------------------ the bottle's silhouette
/** Outer radius at height y: body · shoulder · neck · bead · threaded finish (the base and the lip are explicit). */
function outerR(y) {
  if (y <= SH0) return R0 + 0.003 * Math.sin(Math.PI * clamp((y - 0.066) / (SH0 - 0.066), 0, 1));
  if (y <= SH1) {
    const t = Math.pow((y - SH0) / (SH1 - SH0), 0.85);
    const s = t * t * t * (t * (t * 6 - 15) + 10);
    return R0 + (RN - R0) * s;
  }
  if (y <= 2.105) return RN - 0.005 * (y - SH1) / (2.105 - SH1);
  if (y <= 2.155) { const b = (y - 2.13) / 0.025; return 0.113 + 0.016 * Math.sqrt(Math.max(0, 1 - b * b)); }
  return 0.1145 + 0.006 * Math.exp(-(((y - 2.215) / 0.009) ** 2)) + 0.006 * Math.exp(-(((y - 2.268) / 0.009) ** 2));
}
const slopeR = (y) => (outerR(y + 0.003) - outerR(y - 0.003)) / 0.006;

function bottleProfile(k) {
  const P = [[0, 0.045], [0.07, 0.042], [0.14, 0.031], [0.2, 0.015], [0.236, 0.005], [0.256, 0.0006], [0.273, 0.0032], [0.288, 0.011], [0.298, 0.024], [0.303, 0.042], [0.305, 0.066]];
  let y = 0.09;
  while (y < 2.305) {
    P.push([outerR(y), y]);
    y += (y < 0.93 ? 0.034 : y < 2.0 ? 0.016 : y < 2.1 ? 0.02 : 0.0058) * k;
  }
  P.push([outerR(2.305), 2.305]);
  for (const p of [[0.1148, 2.315], [0.1138, 2.326], [0.11, 2.334], [0.103, 2.3392], [0.096, 2.338], [0.0905, 2.333], [0.0878, 2.324], [0.0868, 2.3], [0.0868, 2.22], [0.088, 2.16]]) P.push(p);
  return P;
}

function liquidProfile(k) {
  const P = [[0, 0.075], [0.16, 0.075], [0.25, 0.077], [0.279, 0.087]];
  let y = 0.1;
  while (y < FILL) { P.push([outerR(y) - WALL, y]); y += (y < 0.93 ? 0.05 : 0.018) * k; }
  const rw = outerR(FILL + 0.007) - WALL, rf = outerR(FILL) - WALL;
  // the meniscus: the liquid climbs the glass a little, then a gentle concave surface
  P.push([rf, FILL - 0.002], [rw, FILL + 0.007], [rw - 0.008, FILL + 0.0022], [rf * 0.7, FILL + 0.0004], [rf * 0.35, FILL], [0, FILL]);
  return P;
}

/**
 * A surface of revolution with analytic normals. P: [[r, y]…] (any direction: the normal is on
 * the left of travel), disp(θ, y) → [dr, d(dr)/dθ] for knurling. u = θ / 2π, v = y / TOP.
 */
function revolve(P, segs, disp = null) {
  const n = P.length, cols = segs + 1;
  const pos = new Float32Array(n * cols * 3), nor = new Float32Array(n * cols * 3), uv = new Float32Array(n * cols * 2);
  for (let j = 0; j < n; j++) {
    const a = P[Math.max(0, j - 1)], b = P[Math.min(n - 1, j + 1)];
    let tr = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tr, ty) || 1; tr /= tl; ty /= tl;
    const nr = ty, ny = -tr;
    for (let i = 0; i <= segs; i++) {
      const th = (i / segs) * TAU, s = Math.sin(th), c = Math.cos(th);
      let r = P[j][0], nx = nr * s, nz = nr * c, nyy = ny;
      if (disp && r > 0.01) {
        const d = disp(th, P[j][1]);
        if (d) {
          r += d[0];
          const k = (d[1] / r) * nr; // tilt along the tangent θ̂ = (cos, 0, −sin)
          nx -= k * c; nz += k * s;
          const l = Math.hypot(nx, nyy, nz) || 1; nx /= l; nyy /= l; nz /= l;
        }
      }
      const v = j * cols + i;
      pos[v * 3] = r * s; pos[v * 3 + 1] = P[j][1]; pos[v * 3 + 2] = r * c;
      nor[v * 3] = nx; nor[v * 3 + 1] = nyy; nor[v * 3 + 2] = nz;
      uv[v * 2] = i / segs; uv[v * 2 + 1] = P[j][1] / TOP;
    }
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------------ painted textures
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/** A kraft-paper gift tag (clipped corners, a punched hole) with her word in handwriting. */
function tagTexture(word, aniso) {
  const W = 512, H = 256, c = canvas(W, H), g = c.getContext('2d');
  const R = rng(31);
  const shape = () => {
    g.beginPath();
    g.moveTo(74, 8); g.lineTo(W - 22, 8); g.quadraticCurveTo(W - 8, 8, W - 8, 22);
    g.lineTo(W - 8, H - 22); g.quadraticCurveTo(W - 8, H - 8, W - 22, H - 8);
    g.lineTo(74, H - 8); g.lineTo(8, H - 70); g.lineTo(8, 70); g.closePath();
  };
  g.save(); shape(); g.clip();
  g.fillStyle = '#c49c68'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { // paper fibres
    const x = R() * W, y = R() * H, l = 4 + R() * 16, a = (R() - 0.5) * 0.9;
    g.strokeStyle = R() < 0.5 ? `rgba(92,60,28,${0.05 + R() * 0.1})` : `rgba(240,215,170,${0.06 + R() * 0.12})`;
    g.lineWidth = 0.6 + R() * 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const v = g.createRadialGradient(W * 0.55, H * 0.5, H * 0.3, W * 0.55, H * 0.5, W * 0.62);
  v.addColorStop(0, 'rgba(255,240,210,0.10)'); v.addColorStop(1, 'rgba(70,40,15,0.30)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.restore();
  g.save(); shape(); g.strokeStyle = 'rgba(90,58,26,0.45)'; g.lineWidth = 3; g.stroke(); g.restore();
  // the reinforcement ring and the hole
  g.strokeStyle = 'rgba(236,212,168,0.95)'; g.lineWidth = 10; g.beginPath(); g.arc(46, H / 2, 20, 0, TAU); g.stroke();
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(46, H / 2, 13, 0, TAU); g.fill();
  g.globalCompositeOperation = 'source-over';
  if (word) {
    const t = textTexture(word, { font: '600 120px "Caveat", cursive', color: '#3a2147', pad: 16 });
    const s = Math.min(380 / t.canvas.width, 210 / t.canvas.height, 1.5);
    g.save(); g.translate(292, H / 2 + 4); g.rotate(-4 * DEG);
    g.globalAlpha = 0.92;
    g.drawImage(t.canvas, (-t.canvas.width * s) / 2, (-t.canvas.height * s) / 2, t.canvas.width * s, t.canvas.height * s);
    g.restore();
    t.texture.dispose();
  }
  return tex(c, { aniso });
}

/** A lime wheel's face: rind, pith, ten juicy segments. */
function limeTexture(size) {
  const c = canvas(size, size), g = c.getContext('2d');
  const R = rng(5), h = size / 2;
  g.translate(h, h);
  const rind = g.createRadialGradient(0, 0, h * 0.86, 0, 0, h);
  rind.addColorStop(0, '#7aa83a'); rind.addColorStop(0.45, '#3f7a22'); rind.addColorStop(1, '#2a5616');
  g.fillStyle = rind; g.beginPath(); g.arc(0, 0, h, 0, TAU); g.fill();
  g.fillStyle = '#eef2cf'; g.beginPath(); g.arc(0, 0, h * 0.9, 0, TAU); g.fill();
  const n = 10, rIn = h * 0.855;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU + 0.04, a1 = ((i + 1) / n) * TAU - 0.04, am = (a0 + a1) / 2;
    const gr = g.createRadialGradient(0, 0, h * 0.06, 0, 0, rIn);
    gr.addColorStop(0, '#edf4bd'); gr.addColorStop(0.3, '#cfe486'); gr.addColorStop(1, '#a6cc55');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(Math.cos(am) * h * 0.08, Math.sin(am) * h * 0.08); g.arc(0, 0, rIn, a0, a1); g.closePath(); g.fill();
    for (let k = 0; k < 60; k++) { // juice vesicles
      const a = a0 + 0.03 + (a1 - a0 - 0.06) * R(), r = h * (0.14 + 0.66 * R()), l = h * (0.04 + R() * 0.07);
      g.strokeStyle = `rgba(255,255,225,${0.12 + R() * 0.22})`; g.lineWidth = 1 + R() * 2.4;
      g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a) * (r + l), Math.sin(a) * (r + l)); g.stroke();
    }
  }
  g.fillStyle = '#f3f6da'; g.beginPath(); g.arc(0, 0, h * 0.07, 0, TAU); g.fill();
  return tex(c);
}

/** The glossy floor's opacity: thinner near the bottle, so its reflection fades with distance. */
function floorAlphaTexture() {
  const S = 256, c = canvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgb(196,196,196)'); gr.addColorStop(0.06, 'rgb(212,212,212)'); gr.addColorStop(0.16, 'rgb(250,250,250)'); gr.addColorStop(1, 'rgb(255,255,255)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c, { srgb: false, aniso: 1 });
}

// ------------------------------------------------------------------ shaders
const TONE = /* glsl */`
  #include <tonemapping_fragment>
  #include <colorspace_fragment>`;

// the glass: slim ridges on the shoulder, a band of raised bubble glass (procedural normals), and
// soft-box reflections that slide over them as the camera moves; a fresnel rim on lower tiers
const GLASS_HEAD = /* glsl */`
  varying vec3 vLoc; varying vec3 vTanV;
  uniform vec2 uRidge; uniform float uKeyAz; uniform float uRimAz; uniform vec3 uKeyCol; uniform vec3 uRimCol; uniform vec3 uTopCol;
  uniform float uStrip; uniform float uEdge;
  float gHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float gAng(float a, float b) { float d = a - b; return atan(sin(d), cos(d)); }`;
const GLASS_NORMAL = /* glsl */`
  {
    float th = atan(vLoc.x, vLoc.z);
    float yy = vLoc.y;
    float rr = max(length(vLoc.xz), 0.05);
    vec3 Tg = normalize(vTanV - dot(vTanV, normal) * normal);
    vec3 Bg = cross(normal, Tg);
    vec2 tilt = vec2(0.0);
    float ra = uRidge.x * smoothstep(0.98, 1.14, yy) * (1.0 - smoothstep(1.7, 1.92, yy));
    float cr = 0.5 + 0.5 * cos(8.0 * th);
    tilt.x += ra * 16.0 * cr * cr * cr * sin(8.0 * th) / rr;
    float band = smoothstep(0.15, 0.22, yy) * (1.0 - smoothstep(0.72, 0.8, yy));
    if (band > 0.001) {
      float cw = 6.2831853 / 31.0;
      float rowf = floor((yy - 0.12) / 0.052 - 0.5);
      vec2 acc = vec2(0.0);
      for (int k = 0; k < 2; k++) {
        float jr = rowf + float(k);
        float off = mod(jr, 2.0) * 0.5;
        float cy = 0.12 + (jr + 0.5) * 0.052;
        float ci = floor(th / cw - off + 0.5);
        for (int m = -1; m <= 1; m++) {
          float cc = ci + float(m);
          float h = gHash(vec2(mod(cc, 31.0), jr));
          float rad = 0.016 + 0.011 * h;
          vec2 dv = vec2(gAng(th, (cc + off) * cw) * rr, yy - cy);
          float dd = length(dv) / rad;
          acc += dv / (rad * 1.45) * (1.0 - smoothstep(0.75, 1.0, dd)) * step(0.14, h);
        }
      }
      tilt += acc * band * uRidge.y;
    }
    normal = normalize(normal + tilt.x * Tg + tilt.y * Bg);
  }`;
const GLASS_OUT = /* glsl */`
  {
    // (a pin-point highlight on a ridge can be hundreds of times brighter than the glass around
    // it; bloom smears such pixels into square halos — keep the glint, cap the spike)
    outgoingLight = min(outgoingLight, vec3(2.4));
    vec3 Rw = inverseTransformDirection(reflect(-geometryViewDir, normal), viewMatrix);
    float fres = pow(1.0 - saturate(dot(normal, geometryViewDir)), 2.5);
    float az = atan(Rw.x, Rw.z);
    float s1 = (1.0 - smoothstep(0.05, 0.22, abs(gAng(az, uKeyAz)))) * smoothstep(-0.6, 0.0, Rw.y) * (1.0 - smoothstep(0.35, 0.9, Rw.y));
    float s2 = (1.0 - smoothstep(0.06, 0.34, abs(gAng(az, uRimAz)))) * smoothstep(-0.55, 0.15, Rw.y) * (1.0 - smoothstep(0.4, 0.95, Rw.y));
    float s3 = smoothstep(0.72, 0.95, Rw.y);
    vec3 strip = (uKeyCol * s1 + uRimCol * s2 + uTopCol * s3) * uStrip * (0.3 + 0.7 * fres);
    outgoingLight += strip;
    #ifndef USE_TRANSMISSION
    diffuseColor.a = clamp(diffuseColor.a + fres * uEdge + dot(strip, vec3(0.3, 0.59, 0.11)) * 0.8, 0.0, 1.0);
    #endif
  }`;
function patchGlass(mat, U) {
  mat.onBeforeCompile = (sh) => {
    for (const k of Object.keys(U)) sh.uniforms[k] = U[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc;\nvarying vec3 vTanV;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position;\n{ float thL = atan(position.x, position.z); vTanV = normalize(normalMatrix * vec3(cos(thL), 0.0, -sin(thL))); }');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLASS_HEAD}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${GLASS_NORMAL}`)
      .replace('#include <opaque_fragment>', `${GLASS_OUT}\n#include <opaque_fragment>`);
  };
}

// the lemon-lime inside: fake translucency (dark core, luminous edges, light focused by the
// cylinder), a bright meniscus, and bubbles streaming up — each fragment looks along its own ray
// past a few vertical streams, so the streams have true parallax as the camera moves
const LIQUID_VERT = /* glsl */`
  varying vec3 vLoc; varying vec3 vW; varying vec3 vN; varying vec3 vCam;
  void main() {
    vLoc = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const LIQUID_FRAG = /* glsl */`
  uniform float uLight; uniform float uTime; uniform float uFizz; uniform float uStreams;
  uniform vec3 uKeyPos; uniform vec3 uRimPos; uniform float uKeyI; uniform float uRimI; uniform float uWarmI; uniform vec3 uWarmPos;
  varying vec3 vLoc; varying vec3 vW; varying vec3 vN; varying vec3 vCam;
  float h1(float n) { return fract(sin(n * 91.3458) * 47453.5453); }
  float rIn(float y) {
    if (y <= SH0) return R0 - WALL;
    float t = pow(clamp((y - SH0) / (SH1 - SH0), 0.0, 1.0), 0.85);
    float s = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
    return mix(R0, RN, s) - WALL;
  }
  void main() {
    vec3 N = normalize(vN);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(cameraPosition - vW);
    float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);
    float top = smoothstep(0.55, 0.9, N.y) * step(FILL - 0.01, vLoc.y);
    float edge = pow(1.0 - ndv, 1.5);
    vec3 deep = vec3(0.004, 0.028, 0.011);
    vec3 body = vec3(0.045, 0.2, 0.075);
    vec3 lime = vec3(0.62, 0.95, 0.38);
    vec3 mint = vec3(0.55, 1.0, 0.72);
    vec3 col = mix(deep, body, edge * 0.8);
    vec3 Lk = normalize(uKeyPos - vW);
    float side = dot(normalize(N.xz + vec2(1e-4)), -normalize(Lk.xz + vec2(1e-4)));
    col += lime * smoothstep(0.3, 0.85, side) * (1.0 - edge * 0.5) * 0.2 * uKeyI;
    vec3 Lr = normalize(uRimPos - vW);
    float back = pow(clamp(dot(-V, Lr) * 0.5 + 0.5, 0.0, 1.0), 4.0);
    col += mint * (pow(edge, 2.2) * 0.75 + back * edge * 0.3) * uRimI;
    vec3 Lw = normalize(uWarmPos - vW);
    col += vec3(1.0, 0.72, 0.38) * pow(clamp(dot(N, Lw), 0.0, 1.0), 3.0) * edge * 0.25 * uWarmI;
    col += lime * 0.05 * (1.0 - smoothstep(0.08, 0.4, vLoc.y)) * (0.4 + uKeyI);
    float men = smoothstep(FILL - 0.022, FILL + 0.003, vLoc.y) * (1.0 - top);
    col += vec3(0.75, 1.0, 0.85) * men * (0.35 + 0.7 * uKeyI);
    col = mix(col, vec3(0.3, 0.58, 0.38) * (0.2 + pow(1.0 - ndv, 2.0) * 1.3) * (0.5 + 0.5 * uKeyI), top);
    // fizz foam on the surface once it's open
    col += vec3(0.8, 1.0, 0.85) * top * uFizz * 0.35;
    // the streams
    vec3 ro = vLoc;
    vec3 rd = normalize(vLoc - vCam);
    float bub = 0.0;
    vec2 dxz = rd.xz;
    float dd = max(dot(dxz, dxz), 1e-4);
    for (int i = 0; i < 24; i++) {
      float fi = float(i);
      if (fi >= uStreams) break;
      float a = h1(fi + 1.0), b = h1(fi + 7.3), c = h1(fi + 13.1);
      float ang = a * 6.2831853 + fi * 2.4;
      vec2 S0 = vec2(sin(ang), cos(ang)) * (0.03 + 0.21 * sqrt(b));
      float tq = dot(S0 - ro.xz, dxz) / dd;
      float yq = ro.y + tq * rd.y;
      vec2 S = S0 * clamp(rIn(yq) / (R0 - WALL), 0.0, 1.0);
      tq = dot(S - ro.xz, dxz) / dd;
      if (tq < 0.0) continue;
      yq = ro.y + tq * rd.y;
      float y0 = 0.09 + 0.08 * c;
      if (yq < y0 || yq > FILL - 0.003) continue;
      float speed = (0.1 + 0.13 * b) * (1.0 + uFizz * 2.0);
      float spacing = (0.05 + 0.06 * c) * (1.0 - uFizz * 0.45);
      float ph = fract(uTime * speed / spacing + a * 7.0);
      float n = floor((yq - y0) / spacing - ph + 0.5);
      float yc = y0 + (n + ph) * spacing;
      vec3 C = vec3(S.x + 0.005 * sin(yc * 23.0 + fi), yc, S.y + 0.005 * cos(yc * 19.0 + fi * 1.7));
      vec3 v = C - ro;
      float tc = dot(v, rd);
      if (tc < 0.0) continue;
      float d2 = dot(v, v) - tc * tc;
      float r = (0.004 + 0.004 * a) * (0.75 + 0.6 * clamp((yc - y0) / 1.4, 0.0, 1.0)) * (1.0 + uFizz * 0.35);
      if (d2 > r * r) continue;
      float q = sqrt(d2) / r;
      vec3 p = -(v - tc * rd) / r;
      vec3 sd = normalize(Lk - rd * dot(Lk, rd));
      vec3 e = p - sd * 0.5;
      bub += (smoothstep(0.5, 0.93, q) * 0.75 + exp(-dot(e, e) * 30.0) * 1.3) * exp(-tc * 1.8);
    }
    col += vec3(0.82, 1.0, 0.88) * bub * (0.45 + 0.55 * uKeyI);
    col *= uLight;
    gl_FragColor = vec4(col, 1.0);
    ${TONE}
  }`;

// condensation: each drop is a flat quad on the glass whose fragment shader shades a little
// dome (dark lensing edge, bright crescent opposite the light, sharp highlights)
const DROP_VERT = /* glsl */`
  uniform float uPx;
  varying vec2 vQ; varying vec3 vW; varying vec3 vX; varying vec3 vY; varying vec3 vZ; varying float vFade;
  void main() {
    vQ = position.xy;
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vW = w.xyz;
    mat3 m = mat3(modelMatrix) * mat3(instanceMatrix);
    vX = normalize(m[0]); vY = normalize(m[1]); vZ = normalize(m[2]);
    vec4 mv = viewMatrix * w;
    // a drop smaller than a pixel would only sparkle: let it fade into the glass
    vFade = smoothstep(0.45, 1.3, length(m[0]) * uPx / max(-mv.z, 0.01));
    gl_Position = projectionMatrix * mv;
  }`;
const DROP_FRAG = /* glsl */`
  uniform vec3 uKeyPos; uniform vec3 uRimPos; uniform vec3 uWarmPos;
  uniform float uKeyI; uniform float uRimI; uniform float uWarmI; uniform float uLight; uniform float uA;
  varying vec2 vQ; varying vec3 vW; varying vec3 vX; varying vec3 vY; varying vec3 vZ; varying float vFade;
  void main() {
    float r2 = dot(vQ, vQ);
    if (r2 > 1.0) discard;
    float rr = sqrt(r2);
    vec3 nl = normalize(vec3(vQ * 0.95, sqrt(1.0 - r2) * 0.7));
    vec3 N = normalize(vX * nl.x + vY * nl.y + vZ * nl.z);
    vec3 V = normalize(cameraPosition - vW);
    vec3 Rf = reflect(-V, N);
    vec3 L = normalize(uKeyPos - vW), L2 = normalize(uRimPos - vW), L3 = normalize(uWarmPos - vW);
    // (sharp but not too hot: thousands of drops each blooming would haze the whole frame)
    float spec = min(1.3, pow(max(dot(Rf, L), 0.0), 140.0) * 1.7 * uKeyI + pow(max(dot(Rf, L2), 0.0), 70.0) * 0.9 * uRimI + pow(max(dot(Rf, L3), 0.0), 60.0) * 0.7 * uWarmI);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 Lt = L - vZ * dot(L, vZ);
    vec2 lt = vec2(dot(Lt, vX), dot(Lt, vY));
    float cres = smoothstep(0.1, 0.9, dot(vQ / max(rr, 1e-3), -normalize(lt + vec2(1e-4)))) * smoothstep(0.3, 0.85, rr) * (1.0 - smoothstep(0.88, 1.0, rr));
    float envR = smoothstep(-0.1, 0.8, Rf.y);
    vec3 body = vec3(0.6, 1.0, 0.72) * cres * 0.3 * (0.35 + uKeyI) + vec3(0.75, 0.92, 1.0) * envR * fres * 0.22;
    float edgeA = smoothstep(0.5, 0.97, rr);
    float k = uA * vFade;
    float a = (0.08 + edgeA * 0.62) * k;
    vec3 col = body * uLight * k + vec3(1.0, 0.98, 0.94) * spec * uLight * k * (1.0 - smoothstep(0.96, 1.0, rr));
    gl_FragColor = vec4(col, a);
    ${TONE}
  }`;

// the bubbles: one instanced draw; sharp ones have a thin bright rim and a specular dot, ones
// far from focus open into soft bokeh discs; the golden thread warms the ones it passes
const BUBBLE_VERT = /* glsl */`
  attribute vec4 aPS; attribute vec4 aFx;
  uniform float uFocus; uniform float uAperture; uniform float uTanHalf; uniform float uNear; uniform float uFar;
  uniform vec3 uHead; uniform float uHeadOn;
  varying vec2 vUv; varying float vA; varying float vBlur; varying float vPop; varying float vWarm; varying float vSeed;
  void main() {
    vUv = uv;
    vec4 mv = viewMatrix * vec4(aPS.xyz, 1.0);
    float depth = max(-mv.z, 0.001);
    float pop = aFx.y;
    float r = aPS.w * (1.0 + pop * 0.5);
    float coc = min(uAperture * abs(1.0 / uFocus - 1.0 / depth), 0.2) * depth * uTanHalf;
    float R = sqrt(r * r + coc * coc);
    vBlur = clamp(coc / (r + coc + 1e-5) * 1.6 - 0.2, 0.0, 1.0);
    float energy = clamp(pow(r / R, 1.5), 0.07, 1.0);
    float a = aFx.x * energy;
    a *= smoothstep(uNear, uNear * 3.0, depth) * (1.0 - smoothstep(uFar * 0.55, uFar, depth));
    vec3 dh = aPS.xyz - uHead;
    vWarm = clamp(max(aFx.w, uHeadOn * exp(-dot(dh, dh) * 5.0)), 0.0, 1.0);
    vA = a; vPop = pop; vSeed = aFx.z;
    mv.xy += position.xy * 2.0 * R;
    gl_Position = projectionMatrix * mv;
  }`;
const BUBBLE_FRAG = /* glsl */`
  uniform float uGain;
  varying vec2 vUv; varying float vA; varying float vBlur; varying float vPop; varying float vWarm; varying float vSeed;
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float d = length(q);
    if (d > 1.0) discard;
    float rimW = mix(0.17, 0.05, vPop);
    float rim = smoothstep(1.0 - rimW - 0.12, 1.0 - rimW * 0.35, d) * (1.0 - smoothstep(0.965, 1.0, d));
    float body = 0.03 + 0.1 * smoothstep(0.35, 0.98, d);
    vec2 so = vec2(-0.36 + 0.08 * (vSeed - 0.5), 0.4);
    vec2 s1 = q - so;
    float spec = exp(-dot(s1, s1) * 75.0);
    vec2 s2 = q - vec2(0.42, -0.42);
    float spec2 = exp(-dot(s2, s2) * 170.0) * 0.45;
    float cres = smoothstep(0.55, 0.95, d) * max(0.0, dot(q / max(d, 1e-3), vec2(0.6, -0.8)));
    vec3 cool = vec3(0.84, 1.0, 0.92);
    vec3 lime = vec3(0.5, 0.95, 0.45);
    vec3 sharp = cool * (rim * 0.8 + (spec * 2.0 + spec2) * (1.0 - vPop)) + lime * (body + cres * 0.4);
    float disc = 1.0 - smoothstep(0.82, 1.0, d);
    float ring = smoothstep(0.5, 0.96, d) * disc;
    vec3 soft = mix(lime, cool, 0.6) * (disc * 0.22 + ring * 0.42);
    vec3 col = mix(sharp, soft, smoothstep(0.1, 0.8, vBlur));
    vec3 gold = vec3(1.0, 0.7, 0.3);
    col = mix(col, (col + 0.12 * disc) * gold * 1.9, vWarm);
    gl_FragColor = vec4(col * vA * uGain, 1.0);
    ${TONE}
  }`;

// tiny glowing motes (gold in the thread's wake, faint mint specks in the dark)
const MOTE_VERT = /* glsl */`
  attribute vec3 aPos; attribute vec3 aData;
  varying vec2 vUv; varying float vA; varying float vHue;
  void main() {
    vUv = uv; vA = aData.y; vHue = aData.z;
    vec4 mv = viewMatrix * vec4(aPos, 1.0);
    mv.xy += position.xy * aData.x;
    gl_Position = projectionMatrix * mv;
  }`;
const MOTE_FRAG = /* glsl */`
  varying vec2 vUv; varying float vA; varying float vHue;
  void main() {
    vec2 q = vUv - 0.5;
    float d = length(q) * 2.0;
    float core = exp(-d * d * 16.0), halo = exp(-d * d * 4.0) * 0.3;
    vec3 col = mix(vec3(1.0, 0.76, 0.38), vec3(0.62, 1.0, 0.78), vHue);
    gl_FragColor = vec4(col * (core * 1.5 + halo) * vA, 1.0);
    ${TONE}
  }`;

// the memory bubble's skin: a thin film, a warm glow once it has caught the thread's light
const MEM_VERT = /* glsl */`
  varying vec3 vN; varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const MEM_FRAG = /* glsl */`
  uniform float uGlow; uniform float uA; uniform float uTime; uniform vec3 uKeyPos;
  varying vec3 vN; varying vec3 vW;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    if (dot(N, V) < 0.0) N = -N;
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 2.6);
    float ph = fres * 2.4 + N.y * 1.2 + uTime * 0.2;
    vec3 film = 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.67) + ph));
    film = mix(vec3(0.86, 1.0, 0.92), film, 0.35);
    float rim = smoothstep(0.55, 0.95, 1.0 - ndv);
    vec3 col = film * (fres * 0.3 + rim * 0.16);
    vec3 Rf = reflect(-V, N);
    col += vec3(1.0) * pow(max(dot(Rf, normalize(uKeyPos - vW)), 0.0), 160.0) * 1.8;
    col += vec3(1.0, 0.7, 0.32) * (0.03 + fres * 0.38 + rim * 0.08) * uGlow;
    gl_FragColor = vec4(col * uA, 1.0);
    ${TONE}
  }`;

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = /* glsl */`
  uniform float uBright; uniform float uGreen;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float y = d.y;
    vec3 base = vec3(0.0032, 0.0018, 0.0062);
    vec3 col = base;
    // a deep plum glow high behind the bottle, a breath of cool green inside it
    float g = pow(max(dot(d, normalize(vec3(0.0, 0.32, -1.0))), 0.0), 5.0);
    col += vec3(0.018, 0.007, 0.03) * g;
    col += vec3(0.002, 0.012, 0.007) * pow(max(dot(d, normalize(vec3(0.0, 0.25, -1.0))), 0.0), 14.0) * uGreen;
    // warm lantern haze far to one side, violet to the other
    col += vec3(0.03, 0.016, 0.004) * pow(max(dot(d, normalize(vec3(-1.0, 0.22, -0.5))), 0.0), 12.0);
    col += vec3(0.01, 0.004, 0.018) * pow(max(dot(d, normalize(vec3(1.0, 0.3, 0.3))), 0.0), 4.0);
    // no horizon line: everything sinks to near-black toward and below eye level
    col = mix(base * 0.6, col, smoothstep(-0.12, 0.12, y));
    gl_FragColor = vec4(col * uBright, 1.0);
    ${TONE}
  }`;

// light through the green glass, gathered on the floor beside the bottle
const CAUSTIC_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const CAUSTIC_FRAG = /* glsl */`
  uniform float uTime; uniform float uI;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float m = (1.0 - smoothstep(0.35, 1.0, length(p))) * smoothstep(-1.0, -0.55, p.x);
    vec2 q = p * vec2(2.2, 3.4);
    float t = uTime;
    float c = 0.55 + 0.45 * sin(q.x * 1.3 + sin(q.y * 1.7 + t * 0.5) * 1.2 + t * 0.3) * sin(q.y * 1.5 + sin(q.x * 1.1 - t * 0.4) - t * 0.25);
    c *= 1.0 - smoothstep(0.0, 1.0, length(p));
    gl_FragColor = vec4(vec3(0.42, 1.0, 0.5) * c * m * uI, 1.0);
    ${TONE}
  }`;

// ------------------------------------------------------------------ the movement
export async function build(env) {
  const { tier } = env;
  const q = tier.quality;
  const hi = q === 2;
  const reduced = !!tier.reduced;
  const dev = !!window.__LITTLE_DEV__;
  const aniso = Math.min(hi ? 8 : 4, env.renderer.capabilities.getMaxAnisotropy());
  const owned = [];
  const own = (x) => { owned.push(x); return x; };
  const late = [];
  const envMap = env.envWarm;

  const scene = new THREE.Scene();
  const fogCol = new THREE.Color().setRGB(0.002, 0.0011, 0.0038);
  scene.fog = new THREE.Fog(fogCol, 9, 26);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.02, 90);
  camera.position.set(0, 1.5, 9);
  const rig = createRig(camera, { breath: reduced ? 0.3 : 1 });

  // ---------------------------------------------------------------- lights (fixed count: no recompiles)
  const LP = { key: new THREE.Vector3(-3.6, 4.6, 1.2), rim: new THREE.Vector3(2.7, 1.9, -3.8), warm: new THREE.Vector3(4.2, 1.6, 0.4) };
  const KEY_I = 70, RIM_I = 135, WARM_I = 22, HEMI_I = 0.35;
  const key = new THREE.SpotLight(0xdff1ff, 0, 0, 0.42, 0.9, 1.2);
  key.position.copy(LP.key); key.target.position.set(0, 0.9, 0);
  if (tier.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(hi ? 1024 : 512, hi ? 1024 : 512);
    key.shadow.camera.near = 3; key.shadow.camera.far = 11;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  }
  // (its range ends just past the bottle: a backlight that reached the glossy floor in front of
  // the bottle came straight back at the lens as a big sheen)
  const rim = new THREE.SpotLight(0xa8ffc8, 0, 5.9, 0.34, 0.7, 1.2);
  rim.position.copy(LP.rim); rim.target.position.set(0, 1.35, 0);
  const warm = new THREE.PointLight(0xffb347, 0, 0, 2);
  warm.position.copy(LP.warm);
  const hemi = new THREE.HemisphereLight(0x3a2c5c, 0x0b0614, 0);
  scene.add(key, key.target, rim, rim.target, warm, hemi);
  const keyAz = Math.atan2(LP.key.x, LP.key.z), rimAz = Math.atan2(LP.rim.x, LP.rim.z);

  // ---------------------------------------------------------------- the night behind
  const skyMat = own(new THREE.ShaderMaterial({ uniforms: { uBright: { value: 0.1 }, uGreen: { value: 0 } }, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false }));
  const sky = new THREE.Mesh(own(new THREE.SphereGeometry(40, 32, 16)), skyMat);
  sky.renderOrder = -20; sky.frustumCulled = false;
  scene.add(sky);

  // a dark glossy surface; the mirrored bottle shows faintly through it (a soft reflection)
  const floorMat = own(new THREE.MeshPhysicalMaterial({
    color: 0x0a0710, roughness: 0.55, metalness: 0, specularIntensity: 0.08, clearcoat: 0.15, clearcoatRoughness: 0.22, envMap, envMapIntensity: 0.2,
    transparent: true, opacity: q === 0 ? 1 : 0.94, alphaMap: q === 0 ? null : own(floorAlphaTexture()),
  }));
  // a pool of light round the bottle that falls away into the night (no horizon line)
  floorMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFP = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFP;')
      .replace('#include <opaque_fragment>', 'float fallF = 1.0 - smoothstep(1.4, 6.5, length(vFP));\noutgoingLight *= fallF;\ndiffuseColor.a = mix(1.0, diffuseColor.a, fallF);\n#include <opaque_fragment>');
  };
  const floor = new THREE.Mesh(own(new THREE.CircleGeometry(16, 72)), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = -1;
  floor.receiveShadow = tier.shadows;
  scene.add(floor);
  const shadowMat = own(new THREE.MeshBasicMaterial({ color: 0x000000, map: glowTexture(), transparent: true, opacity: 0.8, depthWrite: false }));
  const contact = new THREE.Mesh(own(new THREE.PlaneGeometry(1.5, 1.5)), shadowMat);
  contact.rotation.x = -Math.PI / 2; contact.position.y = 0.002; contact.renderOrder = 0;
  scene.add(contact);
  const causticMat = own(new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uI: { value: 0 } }, vertexShader: CAUSTIC_VERT, fragmentShader: CAUSTIC_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const caustic = new THREE.Mesh(own(new THREE.PlaneGeometry(1.0, 0.75)), causticMat);
  {
    const a = keyAz + Math.PI;
    caustic.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a - Math.PI / 2));
    caustic.position.set(Math.sin(a) * 0.6, 0.004, Math.cos(a) * 0.6);
  }
  caustic.renderOrder = 1;
  scene.add(caustic);

  // ---------------------------------------------------------------- the bottle
  const bottle = new THREE.Group();
  scene.add(bottle);
  const glassU = {
    uRidge: { value: new THREE.Vector2(0.011, 0.6) }, uKeyAz: { value: keyAz }, uRimAz: { value: rimAz },
    uKeyCol: { value: new THREE.Color(0.9, 0.97, 1.0) }, uRimCol: { value: new THREE.Color(0.45, 1.0, 0.62) }, uTopCol: { value: new THREE.Color(0.75, 0.85, 0.95) },
    uStrip: { value: 0 }, uEdge: { value: 0.5 },
  };
  const glassBase = { color: 0x0b3a1b, metalness: 0, roughness: 0.07, ior: 1.5, specularIntensity: 0.6, envMap, envMapIntensity: 1.1, transparent: true, opacity: 0.1, depthWrite: false };
  // One glass on every tier: transparent, env-lit, a fresnel rim and the soft-box strips. (Transmission
  // was tried on the high tier: it refracted the paper tag into the shoulder and washed the liquid
  // out against the dark night — this reads as colder, clearer glass.)
  const glassBack = own(new THREE.MeshPhysicalMaterial({ ...glassBase, side: THREE.BackSide }));
  const glassFront = own(new THREE.MeshPhysicalMaterial({ ...glassBase, side: THREE.FrontSide }));
  patchGlass(glassBack, glassU);
  patchGlass(glassFront, glassU);
  const segs = [64, 80, 100][q];
  const glassGeo = own(revolve(bottleProfile([1.6, 1.15, 1][q]), segs));
  const glassLo = q > 0 ? own(revolve(bottleProfile(1.9), 48)) : glassGeo; // (the faint reflection needs less)
  const front = new THREE.Mesh(glassGeo, glassFront);
  front.renderOrder = 6;
  bottle.add(front);
  const back = new THREE.Mesh(glassGeo, glassBack);
  back.renderOrder = 3;
  bottle.add(back);

  const liquidMat = own(new THREE.ShaderMaterial({
    uniforms: {
      uLight: { value: 0 }, uTime: { value: 0 }, uFizz: { value: 0 }, uStreams: { value: [8, 13, 18][q] },
      uKeyPos: { value: LP.key }, uRimPos: { value: LP.rim }, uWarmPos: { value: LP.warm }, uKeyI: { value: 0 }, uRimI: { value: 0 }, uWarmI: { value: 0 },
    },
    defines: { FILL: FILL.toFixed(4), WALL: WALL.toFixed(4), SH0: SH0.toFixed(4), SH1: SH1.toFixed(4), R0: R0.toFixed(4), RN: RN.toFixed(4) },
    vertexShader: LIQUID_VERT, fragmentShader: LIQUID_FRAG,
  }));
  const liquidGeo = own(revolve(liquidProfile([1.5, 1.15, 1][q]), [48, 56, 72][q]));
  const liquid = new THREE.Mesh(liquidGeo, liquidMat);
  bottle.add(liquid);

  // the cap: pale sage aluminium, knurled; the tamper band stays on the neck when it twists off
  const capMat = own(new THREE.MeshPhysicalMaterial({ color: 0x93c7a3, metalness: 1, roughness: 0.28, clearcoat: hi ? 0.6 : 0, clearcoatRoughness: 0.2, envMap, envMapIntensity: 1.3 }));
  const knurls = q === 0 ? 36 : 48;
  const capGeo = own(revolve(
    [[0.1205, 2.172], [0.1285, 2.175], [0.1295, 2.184], [0.1295, 2.24], [0.1295, 2.29], [0.1295, 2.322], [0.1288, 2.336], [0.1255, 2.347], [0.119, 2.354], [0.109, 2.357], [0.094, 2.3575], [0.09, 2.359], [0.045, 2.3598], [0, 2.36]],
    knurls * 4,
    (th, y) => (y > 2.182 && y < 2.325 ? [0.0026 * (0.5 + 0.5 * Math.cos(knurls * th)) ** 2, -0.0026 * (0.5 + 0.5 * Math.cos(knurls * th)) * knurls * Math.sin(knurls * th)] : null),
  ));
  const CAP_Y = 2.265; // the cap's own centre: it twists and tumbles about this point
  const cap = new THREE.Group();
  const capMesh = new THREE.Mesh(capGeo, capMat);
  capMesh.position.y = -CAP_Y;
  capMesh.castShadow = tier.shadows;
  cap.add(capMesh);
  bottle.add(cap);
  const bandGeo = own(new THREE.TorusGeometry(0.1195, 0.0065, 8, 64));
  const band = new THREE.Mesh(bandGeo, capMat);
  band.rotation.x = Math.PI / 2; band.position.y = 2.164;
  bottle.add(band);

  // condensation
  const dropBase = Math.round([700, 1500, 2600][q] * (reduced ? 0.8 : 1));
  const dropN = dropBase + [0, 600, 1100][q];
  const dropMat = own(new THREE.ShaderMaterial({
    uniforms: { uKeyPos: { value: LP.key }, uRimPos: { value: LP.rim }, uWarmPos: { value: LP.warm }, uKeyI: { value: 0 }, uRimI: { value: 0 }, uWarmI: { value: 0 }, uLight: { value: 0 }, uA: { value: 1 }, uPx: { value: 1000 } },
    vertexShader: DROP_VERT, fragmentShader: DROP_FRAG, transparent: true, depthWrite: false, premultipliedAlpha: true,
  }));
  const drops = new THREE.InstancedMesh(own(new THREE.PlaneGeometry(2, 2)), dropMat, dropN);
  drops.renderOrder = 7;
  drops.frustumCulled = false;
  {
    const Rr = rng(77);
    const m = new THREE.Matrix4(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), P = new THREE.Vector3(), Sc = new THREE.Vector3(), Qt = new THREE.Quaternion();
    for (let i = 0; i < dropN; i++) {
      let th, y;
      const u = Rr();
      const mistDrop = i >= dropBase;
      if (mistDrop) { th = -1.8 + Rr() * 1.2; y = 0.6 + Rr() * 0.52; } // fine mist on the macro's stretch
      else if (u < 0.16) { th = -1.7 + Rr() * 1.0; y = 0.66 + Rr() * 0.42; } // the macro shot's stretch of glass
      else if (u < 0.93) { th = (Rr() - 0.5) * TAU; y = 0.12 + Math.pow(Rr(), 0.85) * (FILL - 0.15); } // the cold, filled part
      else { th = (Rr() - 0.5) * TAU; y = FILL + Rr() * 0.32; } // a few above the liquid
      // not under the tag
      const dth = Math.atan2(Math.sin(th - TAG.th), Math.cos(th - TAG.th));
      if (Math.abs(dth) < 0.5 && Math.abs(y - TAG.y) < 0.09) y -= 0.22;
      const r = outerR(y), sl = slopeR(y);
      const s = Math.sin(th), c = Math.cos(th);
      Z.set(s, -sl, c).normalize();
      Y.set(sl * s, 1, sl * c).normalize();
      X.crossVectors(Y, Z).normalize();
      P.set(r * s, y, r * c).addScaledVector(Z, 0.0012);
      let size = 0.003 + 0.01 * Math.pow(Rr(), 3.2);
      if (Rr() < 0.05) size += 0.006 + Rr() * 0.012;
      if (mistDrop) size = 0.0011 + 0.0019 * Rr();
      const elong = size > 0.012 ? 1 + Rr() * 0.45 : 1 + Rr() * 0.12;
      m.makeBasis(X, Y, Z);
      Qt.setFromRotationMatrix(m);
      Sc.set(size, size * elong, 1);
      m.compose(P, Qt, Sc);
      drops.setMatrixAt(i, m);
    }
    drops.instanceMatrix.needsUpdate = true;
  }
  bottle.add(drops);

  // the paper tag tied at the neck (her word, lowercase, in handwriting) — or none at all
  const word = String(env.fill(env.T.spriteTag || '') || '').trim().toLowerCase();
  if (word) {
    const tagTex = own(tagTexture(word, aniso));
    const tagBackTex = own(tagTexture('', aniso));
    const geo = own(new THREE.PlaneGeometry(TAG.w, TAG.h, 18, 8));
    const p = geo.getAttribute('position');
    const ca = Math.cos(TAG.tilt), sa = Math.sin(TAG.tilt);
    // paper, not a sticker: part-way between lying flat and wrapping round the glass, so its
    // ends lift a little off the curve
    const c0r = outerR(TAG.y) + 0.005, sl0 = slopeR(TAG.y);
    const tT = new THREE.Vector3(Math.cos(TAG.th), 0, -Math.sin(TAG.th));
    const tU = new THREE.Vector3(sl0 * Math.sin(TAG.th), 1, sl0 * Math.cos(TAG.th)).normalize();
    const tC = new THREE.Vector3(Math.sin(TAG.th) * c0r, TAG.y, Math.cos(TAG.th) * c0r);
    const flat = new THREE.Vector3();
    const toSurface = (x, y, out, lift = 0) => {
      const xr = x * ca - y * sa, yr = x * sa + y * ca;
      const ys = TAG.y + yr;
      const r = outerR(ys) + 0.005 + lift;
      const th = TAG.th + xr / r;
      out.set(Math.sin(th) * r, ys, Math.cos(th) * r);
      flat.copy(tC).addScaledVector(tT, xr).addScaledVector(tU, yr);
      return out.lerp(flat, 0.4);
    };
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { toSurface(p.getX(i), p.getY(i), v); p.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals();
    const tm = own(new THREE.MeshStandardMaterial({ map: tagTex, alphaTest: 0.5, roughness: 0.85, metalness: 0, side: THREE.FrontSide }));
    const bm = own(new THREE.MeshStandardMaterial({ map: tagBackTex, alphaTest: 0.5, roughness: 0.9, metalness: 0, side: THREE.BackSide }));
    const tagFront = new THREE.Mesh(geo, tm);
    const tagBack = new THREE.Mesh(geo, bm);
    tagFront.castShadow = tagBack.castShadow = tier.shadows;
    bottle.add(tagFront, tagBack);
    // the string: once round the neck, then down the shoulder to the tag's hole
    const hole = toSurface(-TAG.w / 2 + (46 / 512) * TAG.w, 0, new THREE.Vector3(), 0.002);
    const pts = [];
    const thK = TAG.th - 0.42, rN = outerR(KNOT_Y) + 0.0045;
    for (let k = 0; k <= 18; k++) { const a = thK + (k / 18) * TAU; pts.push(new THREE.Vector3(Math.sin(a) * rN, KNOT_Y + 0.004 * Math.sin(k * 0.9), Math.cos(a) * rN)); }
    const holeTh = Math.atan2(hole.x, hole.z);
    for (let k = 1; k <= 4; k++) {
      const t = k / 5, y = lerp(KNOT_Y, hole.y + 0.012, t), a = lerp(thK, holeTh, t);
      const r = outerR(y) + 0.006 + 0.008 * Math.sin(Math.PI * t);
      pts.push(new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r));
    }
    pts.push(hole.clone(), hole.clone().add(new THREE.Vector3(0.006, -0.03, 0.004)));
    const strG = own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 220, 0.0042, 6, false));
    const strM = own(new THREE.MeshStandardMaterial({ color: 0xd8c39a, roughness: 0.92, metalness: 0 }));
    const str = new THREE.Mesh(strG, strM);
    str.castShadow = tier.shadows;
    bottle.add(str);
  }

  // a lime wheel leaning on the bottle
  const limeTex = own(limeTexture(q === 0 ? 256 : 512));
  const rindMat = own(new THREE.MeshPhysicalMaterial({ color: 0x3f7f28, roughness: 0.45, clearcoat: q ? 0.5 : 0, clearcoatRoughness: 0.3, envMap, envMapIntensity: 0.8 }));
  const fleshMat = own(new THREE.MeshPhysicalMaterial({ map: limeTex, color: 0x9caf86, roughness: 0.5, clearcoat: q ? 0.4 : 0, clearcoatRoughness: 0.18, emissive: 0x9fcf5a, emissiveMap: limeTex, emissiveIntensity: 0.05, envMap, envMapIntensity: 0.5 }));
  const limeGeo = own(new THREE.CylinderGeometry(0.19, 0.19, 0.045, 48, 1));
  const lime = new THREE.Mesh(limeGeo, [rindMat, fleshMat, fleshMat]);
  {
    const phi = -0.78, beta = 24 * DEG, d = 0.305 + 0.19 * Math.sin(beta) + 0.035;
    const axis = new THREE.Vector3(Math.sin(phi) * Math.cos(beta), Math.sin(beta), Math.cos(phi) * Math.cos(beta));
    lime.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    lime.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4));
    lime.position.set(Math.sin(phi) * d, 0.19 * Math.cos(beta) + 0.0225 * Math.sin(beta) + 0.002, Math.cos(phi) * d);
  }
  lime.castShadow = lime.receiveShadow = tier.shadows;
  scene.add(lime);

  // a few ice cubes on the near side: the bottle's own glass (the same two programs — nothing new to
  // compile), clear and cool instead of green, lit by the same soft-box strips; each with a smaller
  // cube turned inside it, the cloudy fractured heart real ice has. One mesh per face side.
  const iceU = { ...glassU, uRidge: { value: new THREE.Vector2(0, 0) } };
  const iceBase = { ...glassBase, color: 0x8fb8c8, opacity: 0.07, envMapIntensity: 1.3 };
  const iceFrontMat = own(new THREE.MeshPhysicalMaterial({ ...iceBase, side: THREE.FrontSide }));
  const iceBackMat = own(new THREE.MeshPhysicalMaterial({ ...iceBase, side: THREE.BackSide }));
  patchGlass(iceFrontMat, iceU);
  patchGlass(iceBackMat, iceU);
  let iceGeo;
  {
    const parts = [];
    const cube = (sz, x, z, yaw, { lean = 0, sq = 0.9 } = {}) => {
      for (const [k, turn] of [[1, 0], [0.56, 0.7]]) {
        const g = new RoundedBoxGeometry(sz * k, sz * sq * k, sz * 0.95 * k, 2, sz * k * 0.16);
        g.rotateX(turn * 0.6); g.rotateZ(turn * 0.9 + lean); g.rotateY(yaw + turn);
        g.translate(x, (sz * sq) / 2 + Math.abs(Math.sin(lean)) * sz * 0.35 + 0.002, z);
        parts.push(g);
      }
    };
    cube(0.19, 0.27, 0.53, 0.45);
    cube(0.16, 0.53, 0.29, 1.15, { sq: 0.86 });
    cube(0.13, 0.05, 0.74, -0.3, { lean: 0.22, sq: 0.92 });
    iceGeo = own(mergeGeometries(parts));
    parts.forEach((g) => g.dispose());
  }
  // (drawn after the bottle's glass: the cubes stand between it and the camera)
  const iceBack = new THREE.Mesh(iceGeo, iceBackMat); iceBack.renderOrder = 7;
  const iceFront = new THREE.Mesh(iceGeo, iceFrontMat); iceFront.renderOrder = 8;
  scene.add(iceBack, iceFront);

  // the mirrored scene under the glossy floor (not on the low tier)
  let mirror = null, mCap = null;
  if (q > 0) {
    mirror = new THREE.Group();
    mirror.scale.y = -1;
    const mf = new THREE.Mesh(glassLo, glassFront); mf.renderOrder = -4;
    const ml = new THREE.Mesh(liquidGeo, liquidMat);
    mirror.add(mf, ml);
    const mb = new THREE.Mesh(glassLo, glassBack); mb.renderOrder = -6; mirror.add(mb);
    mCap = new THREE.Group();
    const mCapMesh = new THREE.Mesh(capGeo, capMat);
    mCapMesh.position.y = -CAP_Y;
    mCap.add(mCapMesh);
    const mBand = new THREE.Mesh(bandGeo, capMat); mBand.rotation.x = Math.PI / 2; mBand.position.y = 2.164;
    const mLime = new THREE.Mesh(limeGeo, [rindMat, fleshMat, fleshMat]);
    mLime.position.copy(lime.position); mLime.quaternion.copy(lime.quaternion);
    const mIceB = new THREE.Mesh(iceGeo, iceBackMat); mIceB.renderOrder = -6;
    const mIceF = new THREE.Mesh(iceGeo, iceFrontMat); mIceF.renderOrder = -4;
    mirror.add(mCap, mBand, mLime, mIceB, mIceF);
    scene.add(mirror);
  }

  // ---------------------------------------------------------------- the bubbles (one draw call)
  const POOL = Math.round([180, 400, 700][q] * (reduced ? 0.7 : 1));
  const FIELD_N = Math.round(POOL * 0.56);
  const bGeo = own(new THREE.InstancedBufferGeometry());
  {
    const quad = new THREE.PlaneGeometry(1, 1);
    bGeo.index = quad.index;
    bGeo.setAttribute('position', quad.getAttribute('position'));
    bGeo.setAttribute('uv', quad.getAttribute('uv'));
    quad.dispose();
  }
  const aPS = new THREE.InstancedBufferAttribute(new Float32Array(POOL * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aFx = new THREE.InstancedBufferAttribute(new Float32Array(POOL * 4), 4).setUsage(THREE.DynamicDrawUsage);
  bGeo.setAttribute('aPS', aPS); bGeo.setAttribute('aFx', aFx);
  bGeo.instanceCount = 0;
  const bU = {
    uFocus: { value: 4.5 }, uAperture: { value: 0.06 }, uTanHalf: { value: 0.35 }, uNear: { value: 0.05 }, uFar: { value: 26 },
    uHead: { value: new THREE.Vector3(0, -50, 0) }, uHeadOn: { value: 0 }, uGain: { value: 1 },
  };
  const bMat = own(new THREE.ShaderMaterial({ uniforms: bU, vertexShader: BUBBLE_VERT, fragmentShader: BUBBLE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const bubbles = new THREE.Mesh(bGeo, bMat);
  bubbles.frustumCulled = false; bubbles.renderOrder = 30;
  scene.add(bubbles);
  // bubble state (struct of arrays). mode: 0 dead · 1 field · 2 burst · 3 popping · 4 fading
  const B = {
    x: new Float32Array(POOL), y: new Float32Array(POOL), z: new Float32Array(POOL), vx: new Float32Array(POOL), vy: new Float32Array(POOL), vz: new Float32Array(POOL),
    size: new Float32Array(POOL), age: new Float32Array(POOL), life: new Float32Array(POOL), t: new Float32Array(POOL), seed: new Float32Array(POOL),
    wf: new Float32Array(POOL), wa: new Float32Array(POOL), warm: new Float32Array(POOL), mode: new Uint8Array(POOL), bottom: new Uint8Array(POOL),
  };
  const V = { x0: -2.4, x1: 2.4, y0: 0.05, y1: 3.4, z0: -2.5, z1: 9.8, excl: 1.0 };
  const VOL = {
    tunnel: { x0: -1.6, x1: 1.6, y0: 0.05, y1: 3.3, z0: -1.5, z1: 8.4, excl: 1.0 },
    hero: { x0: -3.4, x1: 3.4, y0: 0.05, y1: 3.9, z0: -6, z1: 2.4, excl: 0.6 },
    top: { x0: -1.8, x1: 1.8, y0: 1.5, y1: 5.2, z0: -1.8, z1: 1.8, excl: 0.35 },
  };
  const setVol = (v) => Object.assign(V, v);
  const Rb = rng(2027);
  let burstCursor = 0;

  // ---------------------------------------------------------------- motes
  const MOTES = Math.round([90, 180, 300][q] * (reduced ? 0.6 : 1));
  const mGeo = own(new THREE.InstancedBufferGeometry());
  {
    const quad = new THREE.PlaneGeometry(1, 1);
    mGeo.index = quad.index;
    mGeo.setAttribute('position', quad.getAttribute('position'));
    mGeo.setAttribute('uv', quad.getAttribute('uv'));
    quad.dispose();
  }
  const mPos = new THREE.InstancedBufferAttribute(new Float32Array(MOTES * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const mData = new THREE.InstancedBufferAttribute(new Float32Array(MOTES * 3), 3).setUsage(THREE.DynamicDrawUsage);
  mGeo.setAttribute('aPos', mPos); mGeo.setAttribute('aData', mData);
  mGeo.instanceCount = 0;
  const motesMat = own(new THREE.ShaderMaterial({ vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const motes = new THREE.Mesh(mGeo, motesMat);
  motes.frustumCulled = false; motes.renderOrder = 31;
  scene.add(motes);
  const M = { x: new Float32Array(MOTES), y: new Float32Array(MOTES), z: new Float32Array(MOTES), vx: new Float32Array(MOTES), vy: new Float32Array(MOTES), vz: new Float32Array(MOTES), age: new Float32Array(MOTES), life: new Float32Array(MOTES), size: new Float32Array(MOTES), hue: new Float32Array(MOTES), tw: new Float32Array(MOTES) };
  let moteCursor = 0;
  const Rm = rng(909);
  const emitMote = (x, y, z, { spread = 0.12, size = 0.03, life = 1.4, hue = 0, up = 0.05 } = {}) => {
    const i = moteCursor; moteCursor = (moteCursor + 1) % MOTES;
    M.x[i] = x; M.y[i] = y; M.z[i] = z;
    M.vx[i] = (Rm() - 0.5) * spread; M.vy[i] = (Rm() - 0.3) * spread + up; M.vz[i] = (Rm() - 0.5) * spread;
    M.age[i] = 0; M.life[i] = life * (0.6 + Rm() * 0.8); M.size[i] = size * (0.5 + Rm() * 0.9); M.hue[i] = hue; M.tw[i] = Rm() * 20;
  };

  // ---------------------------------------------------------------- the golden thread
  const strand = createStrand({ segments: [90, 130, 160][q] });
  const STRAND_OPTS = { wobble: 1 };
  strand.mesh.visible = false;
  scene.add(strand.mesh);
  late.push(strand.mesh);
  const headGlow = glowSprite(0xffd890, 0.32);
  headGlow.visible = false; headGlow.renderOrder = 32;
  scene.add(headGlow); late.push(headGlow);
  // S1: across the dark in front of the camera, a loop past the first bubbles, then away into the
  // depth (it never runs straight at the lens: a ribbon seen end-on degenerates)
  const pathA = new PathSampler([
    [-2.2, 0.7, 6.6], [-0.9, 1.0, 6.3], [0.1, 1.35, 6.0], [0.55, 1.75, 5.6], [0.3, 2.15, 5.1], [-0.3, 2.05, 4.7],
    [-0.45, 1.6, 4.3], [0.0, 1.25, 3.8], [0.45, 1.35, 3.1], [0.55, 1.9, 2.0], [0.2, 2.8, 0.0], [-0.3, 3.8, -2.5],
  ].map((p) => new THREE.Vector3(...p)), { samples: 1400 });
  // S7: weaving through the bubbles above the open bottle, then away upward. Built in the frame of
  // the camera's azimuth at that moment (right, up, toward the camera).
  const AZ7 = reduced ? -0.1 : 0.95;
  const frame7 = (x, y, z) => new THREE.Vector3(x * Math.cos(AZ7) + z * Math.sin(AZ7), y, -x * Math.sin(AZ7) + z * Math.cos(AZ7));
  const pathB = new PathSampler([
    [1.8, 2.25, 0.25], [0.55, 2.48, 0.35], [-0.24, 2.7, 0.08], [0.26, 2.93, -0.18], [0.02, 3.18, 0.42], [-0.3, 3.4, 0.22],
    [0.18, 3.6, -0.08], [0.04, 3.98, 0.14], [-0.1, 4.6, 0.08], [0.0, 5.6, 0.0], [0.0, 7.2, 0.0],
  ].map(([x, y, z]) => frame7(x, y, z)), { samples: 1400 });
  const MEM_AT = frame7(0.02, 3.18, 0.42);
  const memS = pathB.closest(MEM_AT);

  // ---------------------------------------------------------------- the memory bubble
  const memU = { uGlow: { value: 0 }, uA: { value: 1 }, uTime: { value: 0 }, uKeyPos: { value: LP.key } };
  const memMat = own(new THREE.ShaderMaterial({ uniforms: memU, vertexShader: MEM_VERT, fragmentShader: MEM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  const mem = new THREE.Group();
  const memShell = new THREE.Mesh(own(new THREE.SphereGeometry(1, 40, 28)), memMat);
  memShell.renderOrder = 33;
  mem.add(memShell);
  // inside: a soft warm light, a little row of far-off lamps, a faint pink-and-green glint
  const memInner = [];
  const addIn = (s, x, y, z, base) => { s.position.set(x, y, z); s.renderOrder = 34; s.material.opacity = 0; mem.add(s); memInner.push([s, base]); };
  addIn(glowSprite(0xffb85c, 1.15), 0, -0.05, 0, 0.32);
  for (let i = 0; i < 5; i++) { const t = i / 4 - 0.5; addIn(glowSprite(0xffd28c, 0.17 + 0.03 * (1 - Math.abs(t))), t * 0.9, -0.22 + 0.07 * Math.cos(t * 2.4), -0.3 + Math.abs(t) * 0.2, 0.95); }
  addIn(glowSprite(0xff8fb8, 0.4, { star: true }), -0.28, 0.12, 0.25, 0.6);
  addIn(glowSprite(0x9fc47a, 0.32, { star: true }), 0.3, 0.2, 0.1, 0.55);
  mem.visible = false;
  scene.add(mem); late.push(mem);

  // ---------------------------------------------------------------- glints, mist
  const glintA = glowSprite(0xf2fff6, 0.32, { star: true }); // the shoulder catching the key light
  const glintB = glowSprite(0xffffff, 0.2, { star: true }); // the cap
  const mist = glowSprite(0xdcffe8, 0.2, { opacity: 0 }); // the breath of cold air when it opens
  for (const s of [glintA, glintB, mist]) { s.visible = false; s.renderOrder = 40; scene.add(s); late.push(s); }
  if (hi) { glintA.material.color.multiplyScalar(2.2); glintB.material.color.multiplyScalar(2.2); headGlow.material.color.multiplyScalar(1.6); } // (HDR: they bloom)
  const sprites = [headGlow, glintA, glintB, mist, ...memInner.map(([s]) => s)];

  // ---------------------------------------------------------------- materials that take the env light
  const envMats = [[glassFront, 1.1], [capMat, 1.3], [floorMat, 0.2], [rindMat, 0.8], [fleshMat, 0.5]];
  envMats.push([glassBack, 1.1]);

  // ---------------------------------------------------------------- knobs (tweened by play, read by update)
  const S = {
    key: 0, rim: 0, warm: 0, env: 0, bg: 0.1, lit: 0, green: 0, caustic: 0,
    field: 0, gain: 0.9, focus: 4.6, aperture: 0.06, near: 0.12,
    strand: 0, head: 0, len: 2.2, path: 0, headOn: 0, motes: 0, specks: 0, burst: 0, burstAz: 0,
    fizz: 0, drops: 1, exposure: 1, breath: 1,
    twist: 0, lift: 0, glintA: 0, glintB: 0, mist: 0,
    mem: 0, memA: 0, memR: 0.075, popSfx: 0,
  };
  const C = { az: 0, R: 9.5, y: 1.55, lookR: 0, lookY: 1.4, lookDaz: 0, fov: 40, roll: 0 };
  const memP = new THREE.Vector3().copy(MEM_AT);
  const fit = { fov: 34, heroD: 7, lookY: 1.1, el: 0.1, neckD: 2.6, portrait: false, aspect: 1.6 };
  const refit = (size) => {
    const aspect = (size && size.aspect) || 1.6, portrait = aspect < 0.8;
    fit.aspect = aspect; fit.portrait = portrait;
    fit.fov = portrait ? 38 : aspect < 1.25 ? 32 : 27;
    const tanH = Math.tan((fit.fov * DEG) / 2);
    const visH = Math.max(TOP / (portrait ? 0.57 : 0.6), 1.95 / aspect);
    fit.heroD = visH / 2 / tanH;
    fit.lookY = 1.17 - visH * 0.055;
    fit.neckD = (portrait ? 0.8 : 0.72) / tanH;
  };
  refit(env.size);
  const hero = (az, k = 1) => { const d = fit.heroD * k; return { az, R: d * Math.cos(fit.el), y: fit.lookY + d * Math.sin(fit.el), lookR: 0, lookY: fit.lookY, lookDaz: 0, fov: fit.fov }; };
  const tunnel = () => ({ az: 0, R: 9.5, y: 1.55, lookR: 0, lookY: 1.4, lookDaz: 0, fov: fit.fov + 4 });
  const MACRO_AZ = reduced ? -1.2 : -1.38, MACRO_END = reduced ? -1.06 : -0.98;
  const macro = (az) => ({ az, R: 0.79, y: 0.9, lookR: 0.305, lookY: 0.86, lookDaz: 0, fov: 30 });
  const neck = (az) => { const d = fit.neckD; return { az, R: d * Math.cos(0.1), y: 2.25 + d * Math.sin(0.1), lookR: 0, lookY: 2.25, lookDaz: 0, fov: fit.fov }; };
  const above = (az) => { const d = 1.08 / Math.tan((fit.fov * DEG) / 2); return { az, R: d * Math.cos(0.05), y: 3.0 + d * Math.sin(0.05), lookR: 0, lookY: 3.0, lookDaz: 0, fov: fit.fov }; };
  const LIGHT = {
    dark: { key: 0, rim: 0, warm: 0, env: 0, bg: 0.1, lit: 0, green: 0, caustic: 0 },
    macro: { key: 0.6, rim: 0.9, warm: 0.35, env: 0.55, bg: 0.6, lit: 0.8, green: 0.6, caustic: 0.4 },
    full: { key: 1, rim: 1, warm: 1, env: 1, bg: 1, lit: 1, green: 1, caustic: 1 },
  };

  // ---------------------------------------------------------------- cap physics + bottle wobble
  const capFly = { on: false, t: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3() };
  const wob = { x: 0, z: 0, vx: 0, vz: 0 };
  const releaseCap = () => {
    capFly.on = true; capFly.t = 0;
    capFly.p.set(0, CAP_Y + S.lift, 0);
    const side = reduced ? 0.7 : 1.25, back = 0.35; // (right of frame, a little away from the camera)
    capFly.v.set(Math.cos(C.az) * side - Math.sin(C.az) * back, reduced ? 2.2 : 3.0, -Math.sin(C.az) * side - Math.cos(C.az) * back);
    capFly.r.set(0, cap.rotation.y, 0);
    capFly.w.set(reduced ? 2 : 5, reduced ? 3 : 9, reduced ? 1.5 : -4);
    const k = reduced ? 0.25 : 1;
    wob.vx += 0.11 * k; wob.vz -= 0.07 * k;
  };

  // ---------------------------------------------------------------- helpers for the beats
  const spawnField = (i, fresh) => {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 12; k++) {
      x = lerp(V.x0, V.x1, Rb()); z = lerp(V.z0, V.z1, Rb());
      y = fresh ? lerp(V.y0, V.y1, Rb()) : V.y0 + Rb() * 0.35;
      if (x * x + z * z < V.excl * V.excl && y < 2.6) continue;
      const dx = x - camera.position.x, dy = y - camera.position.y, dz = z - camera.position.z;
      if (dx * dx + dy * dy + dz * dz < 0.25) continue;
      break;
    }
    B.x[i] = x; B.y[i] = y; B.z[i] = z; B.vx[i] = 0; B.vy[i] = 0; B.vz[i] = 0;
    B.size[i] = 0.012 + 0.06 * Math.pow(Rb(), 2.4);
    B.age[i] = 0; B.life[i] = 5 + Rb() * 6; B.t[i] = 0; B.seed[i] = Rb();
    B.wf[i] = 1.2 + Rb() * 1.6; B.wa[i] = 0.01 + B.size[i] * 1.2; B.warm[i] = Rb() < 0.08 ? 0.35 : 0;
    B.mode[i] = 1;
  };
  const placeBubble = (i, x, y, z, size) => {
    B.x[i] = x; B.y[i] = y; B.z[i] = z; B.vx[i] = 0; B.vy[i] = 0.02; B.vz[i] = 0;
    B.size[i] = size; B.age[i] = 0; B.life[i] = 12; B.t[i] = 0; B.seed[i] = Rb(); B.wf[i] = 1.5; B.wa[i] = 0.015; B.warm[i] = 0; B.mode[i] = 1;
  };
  const MOUTH = new THREE.Vector3(0, TOP + 0.01, 0);
  const emitBurst = (n) => {
    const ca = Math.sin(S.burstAz), cz = Math.cos(S.burstAz);
    for (let k = 0; k < n; k++) {
      let i = -1;
      for (let j = 0; j < POOL; j++) { const c = (burstCursor + j) % POOL; if (B.mode[c] === 0) { i = c; break; } }
      if (i < 0) return; // (all in use: never steal a live bubble)
      burstCursor = (i + 1) % POOL;
      const a = Rb() * TAU, s = 0.25 + Rb() * 0.75, toward = 0.4 + Rb() * 1.6;
      B.x[i] = MOUTH.x + (Rb() - 0.5) * 0.05; B.y[i] = MOUTH.y + Rb() * 0.03; B.z[i] = MOUTH.z + (Rb() - 0.5) * 0.05;
      B.vx[i] = Math.cos(a) * s + ca * toward; B.vy[i] = 1.0 + Rb() * 1.6; B.vz[i] = Math.sin(a) * s + cz * toward;
      B.size[i] = 0.01 + 0.06 * Math.pow(Rb(), 2);
      B.age[i] = 0; B.life[i] = 2.2 + Rb() * 2.4; B.t[i] = 0; B.seed[i] = Rb(); B.wf[i] = 2 + Rb() * 2; B.wa[i] = 0.02; B.warm[i] = 0;
      B.mode[i] = 2;
    }
  };

  // ---------------------------------------------------------------- per-frame (no allocation)
  const _v = new THREE.Vector3(), _h = new THREE.Vector3(), _n = new THREE.Vector3(), _l = new THREE.Vector3(), _c = new THREE.Vector3(), _fwd = new THREE.Vector3();
  let burstAcc = 0, popCool = 3, time = 0, specksAcc = 0, pxH = 800;
  const WAKE = { spread: 0.16, size: 0.035, life: 1.5, hue: 0 }; // (a mote in the thread's wake)
  const SPECK = { spread: 0.04, size: 0.012, life: 2.6, hue: 1, up: 0.03 }; // (a speck in the dark; .size varies)
  let activePath = pathA;

  function updateBubbles(dt, t) {
    const target = Math.min(FIELD_N, Math.floor(S.field));
    const camX = camera.position.x, camY = camera.position.y, camZ = camera.position.z;
    const pa = aPS.array, fa = aFx.array;
    let n = 0;
    popCool -= dt;
    // burst emission
    if (S.burst > 0) {
      burstAcc += S.burst * dt;
      const k = Math.floor(burstAcc);
      if (k > 0) { burstAcc -= k; emitBurst(k); }
    }
    for (let i = 0; i < POOL; i++) {
      let m = B.mode[i];
      if (i < FIELD_N) {
        if (m === 0 && i < target) { spawnField(i, !B.bottom[i]); B.bottom[i] = 0; m = 1; }
        else if (m === 1 && i >= target) { B.mode[i] = m = 4; B.t[i] = 0; }
      }
      if (m === 0) continue;
      B.age[i] += dt;
      const sz = B.size[i];
      const rise = 0.11 + sz * 3.6;
      let alpha = 1, pop = 0;
      if (m === 1) {
        B.vy[i] += (rise - B.vy[i]) * (1 - Math.exp(-1.4 * dt));
        B.y[i] += B.vy[i] * dt;
        alpha = smooth(0, 0.7, B.age[i]);
        if (B.y[i] > V.y1 || B.age[i] > B.life[i]) {
          B.bottom[i] = 1;
          if (Rb() < 0.35) { B.mode[i] = 3; B.t[i] = 0; } else { B.mode[i] = 4; B.t[i] = 0; }
        }
      } else if (m === 2) {
        const dr = Math.exp(-1.9 * dt);
        B.vx[i] *= dr; B.vz[i] *= dr;
        B.vy[i] += (rise * 1.4 - B.vy[i]) * (1 - Math.exp(-1.2 * dt));
        B.x[i] += B.vx[i] * dt; B.y[i] += B.vy[i] * dt; B.z[i] += B.vz[i] * dt;
        alpha = smooth(0, 0.12, B.age[i]);
        if (B.age[i] > B.life[i]) { B.mode[i] = Rb() < 0.5 ? 3 : 4; B.t[i] = 0; }
      } else if (m === 3) {
        B.t[i] += dt;
        pop = B.t[i] / 0.16;
        alpha = 1 - pop;
        if (pop >= 1) { B.mode[i] = 0; continue; }
        if (S.popSfx > 0 && popCool <= 0 && B.t[i] <= dt) {
          const dx = B.x[i] - camX, dy = B.y[i] - camY, dz = B.z[i] - camZ;
          if (dx * dx + dy * dy + dz * dz < 6) { env.sfx('pop'); popCool = 2.6 + Rb() * 2; }
        }
      } else if (m === 4) {
        B.t[i] += dt;
        alpha = 1 - B.t[i] / 0.55;
        B.y[i] += rise * dt;
        if (alpha <= 0) { B.mode[i] = 0; continue; }
      }
      const w = Math.sin(t * B.wf[i] + B.seed[i] * TAU) * B.wa[i];
      const w2 = Math.cos(t * B.wf[i] * 0.8 + B.seed[i] * 9) * B.wa[i] * 0.7;
      pa[n * 4] = B.x[i] + w; pa[n * 4 + 1] = B.y[i]; pa[n * 4 + 2] = B.z[i] + w2; pa[n * 4 + 3] = sz;
      fa[n * 4] = alpha * (0.55 + 0.45 * B.seed[i]); fa[n * 4 + 1] = pop; fa[n * 4 + 2] = B.seed[i]; fa[n * 4 + 3] = B.warm[i];
      n++;
    }
    bGeo.instanceCount = n;
    if (n) { aPS.needsUpdate = true; aFx.needsUpdate = true; }
  }

  function updateMotes(dt, t) {
    // emit in the thread's wake, and a few faint specks in the dark in front of the camera
    if (S.motes > 0 && S.strand > 0.05 && S.head < activePath.length) {
      activePath.at(S.head, _v);
      const k = Math.min(4, Math.round(S.motes * 40 * dt + Rm() * 0.6));
      for (let j = 0; j < k; j++) emitMote(_v.x, _v.y, _v.z, WAKE);
    }
    if (S.specks > 0) {
      specksAcc += S.specks * 14 * dt;
      _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
      while (specksAcc >= 1) {
        specksAcc -= 1;
        const d = 1.5 + Rm() * 6;
        _v.copy(camera.position).addScaledVector(_fwd, d);
        const x = _v.x + (Rm() - 0.5) * d * 0.9, y = _v.y + (Rm() - 0.5) * d * 0.8, z = _v.z + (Rm() - 0.5) * 1.5;
        SPECK.size = 0.012 + Rm() * 0.01;
        emitMote(x, y, z, SPECK);
      }
    }
    const pa = mPos.array, da = mData.array;
    let n = 0;
    for (let i = 0; i < MOTES; i++) {
      if (M.life[i] <= 0) continue;
      M.age[i] += dt;
      if (M.age[i] >= M.life[i]) { M.life[i] = 0; continue; }
      const k = Math.exp(-1.3 * dt);
      M.vx[i] *= k; M.vy[i] *= k; M.vz[i] *= k;
      M.x[i] += M.vx[i] * dt; M.y[i] += M.vy[i] * dt; M.z[i] += M.vz[i] * dt;
      const f = M.age[i] / M.life[i];
      const tw = 0.6 + 0.4 * Math.sin(t * 12 + M.tw[i]);
      pa[n * 3] = M.x[i]; pa[n * 3 + 1] = M.y[i]; pa[n * 3 + 2] = M.z[i];
      da[n * 3] = M.size[i] * (1 - f * 0.4); da[n * 3 + 1] = Math.min(1, f * 6) * (1 - f) * tw; da[n * 3 + 2] = M.hue[i];
      n++;
    }
    mGeo.instanceCount = n;
    if (n) { mPos.needsUpdate = true; mData.needsUpdate = true; }
  }

  /** Put the shoulder glint where the key light's highlight really is (for this camera). */
  function placeGlint() {
    _l.copy(LP.key).normalize();
    _v.copy(camera.position).normalize();
    _h.copy(_l).add(_v).normalize();
    const th = Math.atan2(_h.x, _h.z);
    let best = -2, by = 1.3;
    for (let y = 1.12; y <= 1.8; y += 0.04) {
      const sl = slopeR(y);
      _n.set(Math.sin(th), -sl, Math.cos(th)).normalize();
      const d = _n.dot(_h);
      if (d > best) { best = d; by = y; }
    }
    const r = outerR(by) + 0.004;
    glintA.position.set(Math.sin(th) * r, by, Math.cos(th) * r);
  }

  function update(dt, t) {
    if (held) { dt = 0; t = heldT; }
    time = t;
    // camera
    rig.pos.set(Math.sin(C.az) * C.R, C.y, Math.cos(C.az) * C.R);
    rig.look.set(Math.sin(C.az + C.lookDaz) * C.lookR, C.lookY, Math.cos(C.az + C.lookDaz) * C.lookR);
    rig.fov = C.fov; rig.roll = C.roll; rig.breath = S.breath;
    rig.apply(t);
    camera.updateMatrixWorld();

    // light
    key.intensity = KEY_I * S.key; rim.intensity = RIM_I * S.rim; warm.intensity = WARM_I * S.warm; hemi.intensity = HEMI_I * S.env;
    for (let k = 0; k < envMats.length; k++) envMats[k][0].envMapIntensity = envMats[k][1] * S.env;
    skyMat.uniforms.uBright.value = S.bg; skyMat.uniforms.uGreen.value = S.green;
    scene.fog.color.copy(fogCol).multiplyScalar(S.bg);
    glassU.uStrip.value = 0.62 * Math.max(S.key, S.rim * 0.8);
    glassU.uEdge.value = 0.12 + 0.4 * S.lit;
    const lu = liquidMat.uniforms;
    lu.uLight.value = S.lit; lu.uTime.value = t; lu.uFizz.value = S.fizz; lu.uKeyI.value = S.key; lu.uRimI.value = S.rim; lu.uWarmI.value = S.warm;
    const du = dropMat.uniforms;
    du.uPx.value = pxH * 0.5 / Math.tan((camera.fov * DEG) / 2);
    du.uLight.value = S.lit; du.uKeyI.value = S.key; du.uRimI.value = S.rim; du.uWarmI.value = S.warm; du.uA.value = S.drops;
    causticMat.uniforms.uTime.value = t; causticMat.uniforms.uI.value = 0.075 * S.caustic;
    shadowMat.opacity = 0.35 + 0.45 * S.lit;
    fleshMat.emissiveIntensity = 0.05 * S.lit;

    // the bottle's little wobble when the cap pops (a damped spring, sub-stepped)
    const steps = Math.max(1, Math.ceil(dt * 120));
    const h = dt / steps, kS = 150, cS = reduced ? 22 : 7;
    for (let s = 0; s < steps; s++) {
      wob.vx += (-kS * wob.x - cS * wob.vx) * h; wob.vz += (-kS * wob.z - cS * wob.vz) * h;
      wob.x += wob.vx * h; wob.z += wob.vz * h;
    }
    bottle.rotation.set(wob.x, 0, wob.z);

    // the cap: twisting off, then a little flight
    if (!capFly.on) {
      cap.position.set(0, CAP_Y + S.lift, 0);
      cap.rotation.set(0, S.twist, 0);
    } else {
      capFly.t += dt;
      const sub = Math.max(1, Math.ceil(dt * 120)), hh = dt / sub;
      for (let s = 0; s < sub; s++) {
        capFly.v.y -= 4.2 * hh;
        capFly.p.addScaledVector(capFly.v, hh);
        capFly.r.x += capFly.w.x * hh; capFly.r.y += capFly.w.y * hh; capFly.r.z += capFly.w.z * hh;
      }
      cap.position.copy(capFly.p); cap.rotation.copy(capFly.r);
      if (capFly.t > 2.2) cap.visible = false;
    }
    if (mCap) { mCap.position.copy(cap.position); mCap.rotation.copy(cap.rotation); mCap.visible = cap.visible; }

    // bubbles, motes
    bU.uFocus.value = Math.max(0.05, S.focus); bU.uAperture.value = S.aperture; bU.uNear.value = S.near; bU.uGain.value = S.gain;
    bU.uTanHalf.value = Math.tan((camera.fov * DEG) / 2);
    updateBubbles(dt, t);
    updateMotes(dt, t);

    // the thread
    const path = S.path ? pathB : pathA;
    activePath = path;
    const on = S.strand > 0.002 && S.head - S.len < path.length;
    strand.mesh.visible = headGlow.visible = on;
    if (on) {
      const s1 = Math.min(S.head, path.length), s0 = Math.max(0, S.head - S.len);
      strand.update(path, s0, Math.max(s0 + 0.02, s1), t, STRAND_OPTS);
      strand.uniforms.uOpacity.value = S.strand;
      path.at(s1, _c);
      headGlow.position.copy(_c);
      headGlow.material.opacity = S.strand * (S.head < path.length ? 0.9 : 0);
      bU.uHead.value.copy(_c);
    }
    bU.uHeadOn.value = on ? S.headOn : 0;

    // the memory bubble
    if (mem.visible) {
      mem.position.copy(memP);
      mem.scale.setScalar(S.memR);
      memU.uGlow.value = S.mem; memU.uTime.value = t; memU.uA.value = S.memA;
      // as it swells past the lens only its warm light remains (the little lamps would loom)
      const near = 1 - smooth(0.15, 0.3, S.memR);
      for (let k = 0; k < memInner.length; k++) memInner[k][0].material.opacity = memInner[k][1] * S.mem * S.memA * (k === 0 ? 1 : near);
    }

    // glints & the cold breath
    glintA.visible = S.glintA > 0.01;
    if (glintA.visible) { placeGlint(); glintA.material.opacity = S.glintA; glintA.scale.setScalar(0.12 + 0.28 * S.glintA); }
    glintB.visible = S.glintB > 0.01 && cap.visible;
    if (glintB.visible) {
      _v.set(-0.09, 2.352 - CAP_Y, 0.09).applyEuler(cap.rotation).add(cap.position);
      glintB.position.copy(_v);
      glintB.material.opacity = S.glintB; glintB.scale.setScalar(0.08 + 0.16 * S.glintB);
    }
    mist.visible = S.mist > 0.01;
    if (mist.visible) { mist.position.set(0, TOP + 0.06 + (1 - S.mist) * 0.25, 0); mist.material.opacity = S.mist * 0.55; mist.scale.setScalar(0.25 + (1 - S.mist) * 0.7); }

    api.exposure = S.exposure;
  }

  // ---------------------------------------------------------------- the beats
  // (dev only: ?at=s3&hold=1.2 freezes the movement 1.2 s into that beat, for screenshots)
  let held = false, heldT = 0;
  const wait = async (sec) => { await env.wait(sec); while (held) await env.wait(0.5); };
  const later = (sec, fn) => env.later(sec, () => { if (!held) fn(); });
  const tw = (target, vars) => env.to(target, { overwrite: 'auto', ...vars });
  const camTo = (c, vars) => tw(C, { ...c, ...vars });
  const lightTo = (l, vars) => tw(S, { ...l, ...vars });

  /** Put every knob where a beat begins (used by the dev jump, and to start s1 cleanly). */
  function snap(b) {
    const i = BEATS.indexOf(b);
    Object.assign(S, LIGHT.dark, { field: 0, strand: 0, head: 0, path: 0, headOn: 0, motes: 0, specks: 0, burst: 0, fizz: 0, twist: 0, lift: 0, glintA: 0, glintB: 0, mist: 0, mem: 0, memA: 0, memR: 0.075, exposure: 1, gain: 1, popSfx: 0, breath: reduced ? 0.3 : 1 });
    capFly.on = false; cap.visible = true;
    mem.visible = false; memP.copy(MEM_AT);
    for (let k = 0; k < POOL; k++) B.mode[k] = 0;
    setVol(i >= 6 ? VOL.top : i >= 4 ? VOL.hero : VOL.tunnel);
    Object.assign(S, { focus: 4.6, aperture: 0.06 });
    if (i <= 1) Object.assign(C, tunnel());
    if (i === 1) { Object.assign(S, { field: 60, bg: 0.15, specks: 0.4 }); }
    if (i === 2) { Object.assign(C, macro(MACRO_AZ)); Object.assign(S, LIGHT.macro, { field: 40, focus: 0.47, aperture: 0.02, breath: 0.25 }); }
    if (i === 3) { Object.assign(C, macro(MACRO_END)); Object.assign(S, LIGHT.macro, { field: 40, focus: 0.47, aperture: 0.02, breath: 0.25 }); }
    if (i >= 4) Object.assign(S, LIGHT.full, { field: 70, focus: fit.heroD, aperture: 0.16 });
    if (i === 4) Object.assign(C, hero(reduced ? -0.25 : -0.4));
    if (i === 5) Object.assign(C, hero(reduced ? -0.1 : 0.95));
    if (i >= 6) {
      Object.assign(C, above(AZ7));
      Object.assign(S, { field: 80, focus: C.R, aperture: 0.08, fizz: 0.6 });
      capFly.on = true; cap.visible = false;
      S.burstAz = C.az; emitBurst(Math.round(POOL * 0.25));
      mem.visible = true; S.memA = 1;
    }
    if (i === 7) { Object.assign(S, { mem: 1, memR: 0.09 }); }
  }

  const beats = {
    // S1 — from black: the thread through the dark; one bubble… another… dozens; the veil opens
    async s1(dir) {
      env.mood('festive');
      S.gain = 1.25;
      const veil = dir.veil(0, { duration: reduced ? 1.2 : 2.6, ease: 'sine.inOut' });
      S.path = 0; S.head = 0; S.len = 2.2;
      tw(S, { strand: 1, duration: 0.6 });
      tw(S, { head: pathA.length + S.len, duration: reduced ? 2.4 : 4.2, ease: 'sine.in' });
      tw(S, { motes: 1, specks: 0.5, duration: 1.0, delay: 0.3 });
      tw(S, { bg: 0.16, duration: 3 });
      const d = reduced ? 0.5 : 1;
      S.headOn = 0.7; // (bubbles near the thread's head catch its gold)
      later(1.2 * d, () => { placeBubble(0, 0.08, 0.72, 6.9, 0.075); B.vy[0] = 0.15; S.field = Math.max(S.field, 1); });
      later(2.0 * d, () => { placeBubble(1, -0.3, 0.95, 6.2, 0.055); S.field = Math.max(S.field, 2); });
      later(2.7 * d, () => { tw(S, { field: 72, duration: 1.2, ease: 'power1.in' }); env.sfx('fizz'); });
      await wait(reduced ? 1.9 : 3.7);
      await veil;
    },
    // S2 — the camera drifts forward through them; the bottle's rim light finds it in the dark
    async s2(dir) {
      if (reduced) {
        await dir.veil(1, { duration: 0.45 });
        snap('s3');
        return;
      }
      tw(S, { motes: 0, duration: 1.2 });
      tw(S, { gain: 1, headOn: 0, duration: 1.6 });
      tw(S, { field: FIELD_N, duration: 1.4 });
      // push straight in through them, curving round the bottle only at the very end
      const mc = macro(MACRO_AZ);
      // a few bubbles placed just off the camera's real way in (its eases evaluated ahead), so they
      // slide past the lens
      const eIO = env.gsap.parseEase('power2.inOut'), eIn = env.gsap.parseEase('power2.in');
      const c0 = { ...C };
      [0.18, 0.3, 0.42, 0.53, 0.63].forEach((f, k) => {
        const a = lerp(c0.az, mc.az, eIn(f + 0.05)), r = lerp(c0.R, mc.R, eIO(f + 0.05)), y = lerp(c0.y, mc.y, eIO(f + 0.05));
        const side = (k % 2 ? 1 : -1) * (0.13 + 0.05 * k);
        placeBubble(2 + k, Math.sin(a) * r + Math.cos(a) * side, y - 0.25 - 0.1 * (k % 3), Math.cos(a) * r - Math.sin(a) * side, 0.028 + 0.012 * (k % 3));
      });
      camTo({ R: mc.R, y: mc.y, lookR: mc.lookR, lookY: mc.lookY, fov: mc.fov }, { duration: 3.6, ease: 'power2.inOut' });
      tw(C, { az: mc.az, duration: 3.6, ease: 'power2.in' });
      tw(S, { focus: 0.47, duration: 3.6, ease: 'power2.inOut' });
      tw(S, { aperture: 0.12, duration: 1.2 });
      later(2.6, () => tw(S, { aperture: 0.03, duration: 1.0 }));
      tw(S, { breath: 0.25, duration: 3.6 });
      lightTo({ rim: 0.9, green: 0.6, bg: 0.6, lit: 0.55 }, { duration: 2.6, ease: 'sine.inOut' });
      lightTo({ key: 0.6, warm: 0.35, env: 0.55, lit: 0.8, caustic: 0.4 }, { duration: 2.4, delay: 1.2, ease: 'sine.inOut' });
      S.popSfx = 1;
      later(3.0, () => { tw(S, { field: 40, duration: 0.8 }); });
      await wait(3.5);
    },
    // S3 — macro: cold condensation on green glass, the camera sliding across the surface
    async s3(dir) {
      S.popSfx = 0; S.specks = 0;
      if (reduced) {
        tw(S, { field: 34, duration: 0.5 });
        const v = dir.veil(0, { duration: 0.6 });
        camTo({ az: MACRO_END, y: 0.86, lookY: 0.84 }, { duration: 2.6, ease: 'sine.inOut' });
        await v;
        await wait(1.1);
        return;
      }
      camTo({ az: MACRO_END, y: 0.8, lookY: 0.8 }, { duration: 3.2, ease: 'sine.inOut' });
      await wait(2.8);
    },
    // S4 — pull back: the bottle, cold and glinting, bubbles streaming inside
    async s4(dir) {
      setVol(VOL.hero);
      tw(S, { field: 70, duration: 1.5 });
      if (reduced) {
        await dir.veil(1, { duration: 0.45 });
        Object.assign(C, hero(-0.25));
        Object.assign(S, LIGHT.full, { focus: fit.heroD, aperture: 0.16, breath: 0.3 });
        const v = dir.veil(0, { duration: 0.7 });
        later(0.5, () => { env.sfx('clink'); tw(S, { glintA: 1, duration: 0.25, yoyo: true, repeat: 1, repeatDelay: 0.3 }); });
        await v;
        await wait(0.35);
        return;
      }
      camTo(hero(-0.4), { duration: 2.9, ease: 'power2.inOut' });
      tw(S, { focus: fit.heroD, aperture: 0.16, breath: 1, duration: 2.9, ease: 'power2.inOut' });
      lightTo(LIGHT.full, { duration: 2.4, ease: 'sine.inOut' });
      later(1.9, () => {
        env.sfx('clink');
        tw(S, { glintA: 1, duration: 0.28, ease: 'power2.out', onComplete: () => tw(S, { glintA: 0, duration: 0.7, ease: 'sine.in' }) });
      });
      await wait(2.8);
    },
    // S5 — the hero orbit, light sliding along the ridges; her line
    async s5() {
      const lines = (env.T.spriteLines || []).map((l) => env.fill(l)).filter(Boolean);
      const est = lines.reduce((a, l) => a + Math.max(2.4, 1 + l.split(/\s+/).length * 0.36) + 1.4, 0);
      const D = clamp(est + 1.0, reduced ? 3.4 : 5.2, 14);
      camTo({ az: reduced ? -0.1 : 0.95 }, { duration: D, ease: 'sine.inOut' });
      S.popSfx = reduced ? 0 : 1;
      await wait(0.5);
      const said = lines.length ? env.narrate(lines, { position: 'bottom' }) : Promise.resolve();
      await said;
      await wait(Math.max(0, D - 0.5 - est - 0.4));
    },
    // S6 — the cap twists off (pssh), a burst of bubbles fills the screen
    async s6() {
      S.popSfx = 0;
      if (!reduced) {
        camTo(neck(0.95), { duration: 1.5, ease: 'power2.inOut' });  // the cap, centre frame
        tw(S, { focus: fit.neckD, aperture: 0.08, duration: 1.5 });
      }
      tw(S, { glintB: 1, duration: 0.4, delay: reduced ? 0.1 : 0.9 });
      await wait(reduced ? 0.3 : 1.1);
      // two turns and a little lift on the thread
      tw(S, { twist: -TAU * (reduced ? 0.8 : 1.3), lift: 0.022, duration: reduced ? 0.8 : 1.05, ease: 'power1.in' });
      await wait(reduced ? 0.8 : 1.05);
      tw(S, { glintB: 0, duration: 0.2 });
      releaseCap();
      env.sfx('pssh');
      S.burstAz = C.az;
      S.mist = 1; tw(S, { mist: 0, duration: 1.4, ease: 'power1.out' });
      tw(S, { fizz: 1, duration: 0.5 });
      S.burst = reduced ? POOL * 0.35 : POOL * 0.75;
      tw(S, { burst: 0, duration: reduced ? 1.2 : 1.8, ease: 'power1.in' });
      setVol(VOL.top);
      // (and a fresh fizz fills the frame: new bubbles appear all through it, the near ones big and soft)
      tw(S, { field: reduced ? FIELD_N * 0.6 : FIELD_N, duration: 0.35, ease: 'power2.out', delay: 0.05 });
      later(0.3, () => env.sfx('fizz'));
      if (!reduced) {
        // follow the bubbles up and back: the frame the thread will weave through
        const a = above(0.95);
        camTo(a, { duration: 2.6, ease: 'power2.inOut' });
        tw(S, { aperture: 0.08, focus: a.R, duration: 2.6 });
      }
      await wait(reduced ? 0.9 : 1.75);
      tw(S, { fizz: 0.6, duration: 2 });
    },
    // S7 — the golden thread weaves through the bubbles, then away upward
    async s7(dir) {
      if (reduced) {
        // (a quiet cut to the frame above the bottle instead of a camera move)
        await dir.veil(1, { duration: 0.4 });
        capFly.t = 99; // (it has flown off)
        Object.assign(C, above(AZ7));
        Object.assign(S, { focus: C.R, aperture: 0.08 });
        setVol(VOL.top);
        dir.veil(0, { duration: 0.6 });
      }
      S.path = 1; S.head = 0; S.len = 2.0;
      mem.visible = true; S.memA = 0; S.mem = 0; S.memR = 0.075;
      tw(S, { memA: 1, duration: 0.6 });
      tw(S, { strand: 1, headOn: 1, duration: 0.5 });
      tw(S, { motes: 0.7, duration: 0.5 });
      const T = reduced ? 2.1 : 3.0;
      tw(S, { head: pathB.length + S.len, duration: T, ease: 'sine.inOut' });
      // when it passes through one bubble, that bubble keeps the light
      const tHit = (Math.acos(1 - 2 * clamp(memS / (pathB.length + S.len), 0, 1)) / Math.PI) * T; // (sine.inOut, inverted)
      later(tHit, () => {
        env.sfx('sparkle');
        tw(S, { mem: 1, memR: 0.085, duration: 0.8, ease: 'sine.out' });
      });
      if (!reduced) camTo({ y: C.y + 0.15, lookY: C.lookY + 0.15 }, { duration: 3.4, ease: 'sine.inOut' });
      await wait(reduced ? 1.4 : 2.4);
      tw(S, { motes: 0, duration: 0.6 });
    },
    // S8 — the bubble with the memory drifts to the centre and grows toward the camera: warm gold
    async s8(dir) {
      tw(S, { headOn: 0, duration: 0.8 });
      _fwd.copy(rig.look).sub(rig.pos).normalize();
      const centre = rig.pos.clone().addScaledVector(_fwd, 1.7);
      const close = rig.pos.clone().addScaledVector(_fwd, 0.12);
      tw(memP, { x: centre.x, y: centre.y, z: centre.z, duration: reduced ? 1.0 : 1.3, ease: 'sine.inOut' });
      tw(S, { memR: 0.11, focus: 1.7, duration: reduced ? 1.0 : 1.3, ease: 'sine.inOut' });
      tw(S, { field: 30, duration: 1.5 });
      await wait(reduced ? 0.6 : 1.15);
      tw(memP, { x: close.x, y: close.y, z: close.z, duration: reduced ? 1.2 : 1.5, ease: 'power2.in' });
      tw(S, { memR: 0.55, mem: 2.6, exposure: 1.3, gain: 0.25, duration: reduced ? 1.2 : 1.5, ease: 'power2.in' });
      await wait(reduced ? 0.5 : 0.75);
      await dir.veil(1, { duration: 0.9, color: '#ffe3a3' });
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
      if (hold >= 0) env.later((i0 > 0 ? 0.3 : 0) + hold, () => { env.gsap.globalTimeline.pause(); held = true; heldT = time; api.dev.held = true; });
    }
    if (i0 > 0) { env.mood('festive'); await dir.veil(0, { duration: 0.3 }); }
    for (let i = i0; i < BEATS.length; i++) {
      env.guard();
      if (dev) { api.dev.beat = BEATS[i]; api.dev.beatT0 = performance.now(); }
      await beats[BEATS[i]](dir);
    }
    if (dev) api.dev.beat = 'done';
  }

  const api = {
    id: 'sprite', scene, camera,
    exposure: 1,
    // (threshold above the brief's ≈0.85: at 0.85 the lime, the liquid's rim and ~3,700 droplet
    // highlights all bloomed into a green haze; at 1.25 only true highlights glow — the glass strip,
    // glints, the thread, the bubbles' specular dots)
    bloom: { strength: 0.45, radius: 0.55, threshold: 1.25 },
    late,
    update,
    resize(size) {
      camera.aspect = size.aspect;
      pxH = size.h * env.renderer.getPixelRatio();
      refit(size);
      C.fov = clamp(C.fov, 20, 60);
      camera.updateProjectionMatrix();
    },
    play,
    dispose() {
      strand.dispose();
      key.dispose(); rim.dispose(); warm.dispose(); hemi.dispose(); // (the key's shadow map)
      for (const s of sprites) s.material.dispose();
      drops.dispose();
      for (const o of owned) o.dispose?.();
    },
    dev: dev ? { beat: '', t0: 0, beatT0: 0, held: false, counts: { POOL, FIELD_N, MOTES, dropN }, get time() { return time; } } : null,
  };
  return api;
}
