// "What Makes You, You" · movement 3 — NIVIN: one impossible photoshoot (imagined fan art).
//
// IDENTITY FIRST. This scene never generates, sculpts or stylizes a face. The owner's rule: in the
// fan-art photoshoot, Deepu must look unmistakably like Deepu and Nivin Pauly unmistakably like
// Nivin Pauly — and nothing in this project can make such an image. So the photograph in this
// scene is the OWNER'S OWN finished, identity-checked fan-art image (admin → Photos → Fan art, at
// most two), made elsewhere with a proper reference-based tool and checked against the real
// photographs (README → "The fan-art photoshoot"). Without one, this movement does not play at all
// (favourites.js `available`; main.js skips the chapter if nothing else is left).
//
// The image is shown EXACTLY as it was made: at its own shape (never cropped, never stretched), in
// an overlay drawn after the studio straight to the screen — no bloom, tone mapping, grading, fog,
// grain, vignette or particles over it — and once developed it is the image, untouched. Effects
// only ever touch the studio and the paper border around it.
//
// It is never presented as real: the clapperboard reads "A BIRTHDAY FANTASY · TAKE 1", the set is
// EMPTY (two tape marks, two empty director's chairs — her name and "Nivin Pauly"), and every print
// carries the handwritten caption (env.T.photoCaption, or the image's own) and a stamp on its border:
// "IMAGINED · FAN ART". No event, date, place, pass or post is ever named. Nothing romantic.
//
// Beats (≈32 s with one image, ≈40 s with two; reduced motion ≈26 s, soft fades, no strobe):
//   slate   from black: the clapperboard on an apple box in the dark studio; it claps; nivinIntro
//   lights  the studio lights come up; the camera rises over the two empty director's chairs
//   set     the set, ready and empty: two tape marks in the key light; the camera's screen lights;
//           nivinLines ('One impossible photoshoot.')
//   shot1   flash (shutter, flashPop, a short white bloom on the studio) — a print flies out of the
//           lens and develops from milky white into the image; then it is held, whole, large and
//           flat to the camera
//   shot2   (a second image only) a second flash, a second print beside the first, held the same way
//   after   nivinAfter ('Okay, this one had to exist.') over the print(s)
//   cards   the prints' borders glow into memory cards, the golden thread wraps them, they float up
//           and away toward the reveal; the veil closes. env.shared.fanPhotos = [{ texture, caption }].
// Contract: ./kit.js. Everything is made in build(); update() writes transforms, attributes and
// uniforms only. Dev: window.__LITTLE_DEV__ + ?at=<beat>[&hold=<sec>]; &fanart=test stands in two
// no-face test cards (a landscape and a portrait one, with a grid and a circle that would show any
// stretch or crop at a glance).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createStrand, PathSampler, createRig, rng, TAU, clamp, lerp, photoTexture, fanArtOf, devFanArt } from './kit.js';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);
// the beats (the second flash only with a second image)
const ORDER = ['slate', 'lights', 'set', 'shot1', 'shot2', 'after', 'cards'];
const NIGHT = '#05040c';
const BG = 0x06040b;

// the set (metres): the two marks face +Z, toward the photo camera on its tripod
const MARK_D = new THREE.Vector3(-0.36, 0, 0.03);
const MARK_N = new THREE.Vector3(0.38, 0, 0);
const SUBJ = new THREE.Vector3(0.01, 1.08, 0);          // where the photo camera aims
const TRIPOD_R = 3.0;                                    // the tripod's arc around the marks
const SHOT_ANG = [0, 0.5], SHOT_H = [1.36, 1.2];         // its two angles (rad about +Y) and lens heights
const KEY_AT = new THREE.Vector3(-1.85, 2.08, 1.6), KEY_AIM = new THREE.Vector3(-0.05, 1.2, 0);
const FILL_AT = new THREE.Vector3(2.1, 1.75, 1.75), FILL_AIM = new THREE.Vector3(0.1, 1.1, 0);
const RIM_AT = new THREE.Vector3(2.05, 1.95, -1.0), RIM_AIM = new THREE.Vector3(0.2, 1.3, 0);
const CHAIR_D = new THREE.Vector3(-0.62, 0, 4.75), CHAIR_N = new THREE.Vector3(0.62, 0, 4.75);
// the apple box (and the slate on it) stands in front of the gap between the two chairs: the opening
// shots look at the slate through that gap (from a little right of it, so the photo camera's tripod
// stands beside the slate, not behind it), and no chair is ever between the lens and the slate
const BOX_AT = new THREE.Vector3(-0.08, 0, 3.98);
const LAMP_AT = new THREE.Vector3(0.4, 2.9, 6.9), LAMP_AIM = new THREE.Vector3(-0.05, 0.5, 4.3);
const DECK_AT = new THREE.Vector3(0.04, 1.98, 1.72);     // where the prints hover
// the print: the owner's fan-art image at its OWN shape, in a white border with a deeper strip at
// the bottom for the handwritten caption and the "IMAGINED · FAN ART" stamp (canvas px, 1024 wide)
export const FW = 1024, BORDER = 56, STRIP = 262;
const IMG_MAX = 0.3; // the image's longer side on the print (metres)

// per-frame scratch: update() allocates nothing
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _e1 = new THREE.Euler();

// ------------------------------------------------------------------ canvas helpers (build time)
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d') }; }
/** Text that fits a width: shrinks the font until it does. */
function fitText(g, text, x, y, maxW, font, size, { min = 20 } = {}) {
  let s = size;
  g.font = font.replace('$', s);
  while (s > min && g.measureText(text).width > maxW) { s -= 2; g.font = font.replace('$', s); }
  g.fillText(text, x, y);
  return s;
}
function star4(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

/**
 * The print's paper for an image of this aspect (w / h): border, handwritten caption, the stamp.
 * The image window is left blank (the shader prints the image there, untouched). Returns the canvas
 * and the window's rectangle in UV space.
 */
export function paintFrame(R, caption, aspect) {
  const winW = FW - BORDER * 2, winH = Math.round(winW / aspect);
  const FH = BORDER + winH + STRIP;
  const IX0 = BORDER, IX1 = FW - BORDER, IY0 = BORDER, IY1 = BORDER + winH;
  const { c, g } = cnv(FW, FH);
  g.fillStyle = '#fbf6ec'; g.fillRect(0, 0, FW, FH);
  // paper tooth (the border only: the image window is painted over by the image)
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '120,100,80' : '255,255,255'},${0.02 + R() * 0.04})`; g.fillRect(R() * FW, R() * FH, 1 + R() * 2, 1 + R() * 2); }
  g.fillStyle = '#2a2230'; g.fillRect(IX0, IY0, IX1 - IX0, IY1 - IY0);
  g.strokeStyle = 'rgba(90,70,60,0.35)'; g.lineWidth = 3; g.strokeRect(IX0 - 2, IY0 - 2, IX1 - IX0 + 4, IY1 - IY0 + 4);
  // the caption, by hand
  if (caption) {
    g.fillStyle = '#3a2147'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.translate(FW * 0.5, IY1 + 82); g.rotate(-0.012);
    fitText(g, caption, 0, 0, 860, '600 $px "Caveat", cursive', 84, { min: 40 });
    g.restore();
  }
  // the stamp, always there: IMAGINED · FAN ART — never a real photograph
  g.save();
  g.translate(FW * 0.5, IY1 + 186); g.rotate(-0.02);
  g.strokeStyle = 'rgba(107,63,160,0.92)'; g.fillStyle = 'rgba(107,63,160,0.95)';
  g.lineWidth = 5; roundRect(g, -300, -46, 600, 92, 16); g.stroke();
  g.lineWidth = 2; roundRect(g, -290, -37, 580, 74, 10); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  try { g.letterSpacing = '5px'; } catch (e) { /* ignore */ }
  fitText(g, 'IMAGINED · FAN ART', 4, 3, 500, '700 $px "Cinzel", Georgia, serif', 46, { min: 30 });
  try { g.letterSpacing = '0px'; } catch (e) { /* ignore */ }
  star4(g, -268, 0, 12); star4(g, 268, 0, 12);
  g.restore();
  // (a few specks of ink texture in the stamp)
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + R() * 0.5})`; g.fillRect(FW * 0.5 - 290 + R() * 580, IY1 + 146 + R() * 80, 2 + R() * 3, 1 + R() * 2); }
  g.globalCompositeOperation = 'source-over';
  return { c, rect: new THREE.Vector4(IX0 / FW, 1 - IY1 / FH, IX1 / FW, 1 - IY0 / FH) };
}

/** Dev only: a no-face stand-in for the owner's fan art (a grid and a circle show any stretch or crop). */
function testCard(i) {
  const W = 1200, H = i ? 1500 : 860;
  const { c, g } = cnv(W, H);
  const gr = g.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, i ? '#33255e' : '#5e2f2a'); gr.addColorStop(1, i ? '#d29d58' : '#e3bd76');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 2;
  for (let x = 0; x <= W; x += 100) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y <= H; y += 100) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.strokeStyle = '#ffffff'; g.lineWidth = 10;
  g.beginPath(); g.arc(W / 2, H / 2, Math.min(W, H) * 0.32, 0, TAU); g.stroke();
  g.fillStyle = '#ffffff';
  for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) { g.beginPath(); g.arc(x, y, 60, 0, TAU); g.fill(); }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 84px Georgia, serif';
  g.fillText(`TEST FAN ART ${i + 1}`, W / 2, H / 2);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { texture, aspect: W / H, caption: '' };
}

/** The owner's fan-art images as textures, whole (never cropped); an image that fails is skipped. */
async function loadFanArt(env) {
  const out = [];
  for (const p of fanArtOf(env.ctx)) {
    try {
      const texture = await photoTexture(env.ctx, p, 2048);
      const img = texture.image;
      const w = img ? img.naturalWidth || img.width : 0, h = img ? img.naturalHeight || img.height : 0;
      if (!(w > 0 && h > 0)) { texture.dispose(); continue; }
      texture.anisotropy = 8;
      out.push({ texture, aspect: w / h, caption: p.caption || '' });
    } catch (e) { /* never replaced by anything else */ }
  }
  if (!out.length && devFanArt()) for (let i = 0; i < 2; i++) out.push(testCard(i));
  return out.slice(0, 2);
}

/** The clapperboard: slate face (top) + stripes (middle) + plain black (bottom). */
function paintSlate(R) {
  const { c, g } = cnv(1024, 1024);
  // slate face: 0..800
  const gr = g.createLinearGradient(0, 0, 0, 800);
  gr.addColorStop(0, '#17141c'); gr.addColorStop(1, '#0d0b11');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 800);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${R() * 0.025})`; g.fillRect(R() * 1024, R() * 800, 1 + R() * 3, 1 + R() * 3); }
  // chalk-smudged fields
  g.fillStyle = 'rgba(255,250,240,0.05)';
  for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(150 + R() * 720, 120 + R() * 560, 120 + R() * 120, 40 + R() * 40, R(), 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(255,244,224,0.9)'; g.lineWidth = 6;
  g.strokeRect(34, 34, 956, 732);
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(34, 330); g.lineTo(990, 330); g.stroke();
  g.beginPath(); g.moveTo(34, 610); g.lineTo(990, 610); g.stroke();
  g.beginPath(); g.moveTo(512, 610); g.lineTo(512, 766); g.stroke();
  // the title, printed
  g.fillStyle = '#fff4e0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  try { g.letterSpacing = '6px'; } catch (e) { /* ignore */ }
  fitText(g, 'A BIRTHDAY FANTASY', 512, 190, 900, '600 $px "Cinzel", Georgia, serif', 100, { min: 40 });
  try { g.letterSpacing = '0px'; } catch (e) { /* ignore */ }
  // the dot between the two, on the rule
  g.fillStyle = '#f4c463'; g.beginPath(); g.arc(512, 330, 13, 0, TAU); g.fill();
  g.fillStyle = '#0f0d13'; g.beginPath(); g.arc(512, 330, 6, 0, TAU); g.fill();
  // TAKE 1, by hand in chalk
  g.fillStyle = 'rgba(255,248,236,0.96)';
  g.save(); g.translate(512, 468); g.rotate(-0.02);
  fitText(g, 'TAKE 1', 0, 0, 760, '600 $px "Caveat", cursive', 190, { min: 60 });
  g.restore();
  g.strokeStyle = 'rgba(244,196,99,0.95)'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(330, 560); g.quadraticCurveTo(520, 586, 700, 552); g.stroke();
  // little doodled sparkles in the empty fields
  g.fillStyle = 'rgba(244,196,99,0.95)';
  star4(g, 270, 690, 22); star4(g, 330, 660, 12); star4(g, 760, 690, 18); star4(g, 700, 665, 10);
  // chalk grain over everything
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${0.08 + R() * 0.25})`; g.fillRect(R() * 1024, 60 + R() * 700, 1 + R() * 2, 1 + R() * 2); }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#0e0c12'; g.fillRect(0, 800, 1024, 224);
  // stripes: 820..966 (classic diagonal, cream and ink)
  g.save();
  g.beginPath(); g.rect(0, 820, 1024, 146); g.clip();
  g.fillStyle = '#f3ead8'; g.fillRect(0, 820, 1024, 146);
  g.fillStyle = '#16131b';
  const sw = 1024 / 7;
  for (let i = -2; i < 9; i++) { const x = i * sw; g.beginPath(); g.moveTo(x, 966); g.lineTo(x + sw * 0.5, 966); g.lineTo(x + sw * 0.5 + 146 * 0.7, 820); g.lineTo(x + 146 * 0.7, 820); g.closePath(); g.fill(); }
  g.restore();
  return c;
}

/** The director's chairs' canvases: [her name] / [Nivin Pauly] / plain fabric. */
function paintChairs(R, names) {
  const { c, g } = cnv(1024, 1024);
  const weave = (y0, h) => {
    g.fillStyle = '#3f1f5a'; g.fillRect(0, y0, 1024, h);
    for (let y = y0; y < y0 + h; y += 3) { g.fillStyle = `rgba(${R() < 0.5 ? '255,220,255' : '10,0,20'},${0.03 + R() * 0.05})`; g.fillRect(0, y, 1024, 1); }
    for (let x = 0; x < 1024; x += 3) { g.fillStyle = `rgba(${R() < 0.5 ? '255,220,255' : '10,0,20'},${0.02 + R() * 0.04})`; g.fillRect(x, y0, 1, h); }
  };
  names.forEach((name, k) => {
    const y0 = k * 384;
    weave(y0, 384);
    // stitched hems
    g.strokeStyle = 'rgba(255,236,200,0.5)'; g.lineWidth = 3; g.setLineDash([14, 10]);
    for (const y of [y0 + 26, y0 + 358]) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
    g.setLineDash([]);
    g.fillStyle = '#fff1d6'; g.textAlign = 'center'; g.textBaseline = 'middle';
    try { g.letterSpacing = '4px'; } catch (e) { /* ignore */ }
    fitText(g, name, 512, y0 + 178, 860, '600 $px "Cinzel", Georgia, serif', 150, { min: 50 });
    try { g.letterSpacing = '0px'; } catch (e) { /* ignore */ }
    g.strokeStyle = '#e9b04f'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(330, y0 + 286); g.lineTo(694, y0 + 286); g.stroke();
    g.fillStyle = '#f4c463'; star4(g, 306, y0 + 286, 16); star4(g, 718, y0 + 286, 16);
  });
  weave(768, 256);
  return c;
}

function paintWood(R) {
  const { c, g } = cnv(512, 512);
  g.fillStyle = '#c38b55'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const y = R() * 512, a = 0.04 + R() * 0.1;
    g.strokeStyle = `rgba(${R() < 0.6 ? '120,70,30' : '240,200,150'},${a})`; g.lineWidth = 1 + R() * 3;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 4 + (R() - 0.5) * 2);
    g.stroke();
  }
  return c;
}

function paintFloor(R) {
  const { c, g } = cnv(1024, 1024);
  g.fillStyle = '#231a20'; g.fillRect(0, 0, 1024, 1024);
  const pw = 128;
  for (let x = 0; x < 1024; x += pw) {
    const off = R() * 1024;
    for (let y = -1024; y < 1024; y += 512) {
      const yy = y + off;
      g.fillStyle = `rgba(${R() < 0.5 ? '60,40,40' : '20,12,16'},${0.25 + R() * 0.3})`; g.fillRect(x + 2, yy, pw - 4, 510);
      g.fillStyle = 'rgba(5,3,6,0.9)'; g.fillRect(x, yy, pw, 3);
    }
    g.fillStyle = 'rgba(5,3,6,0.9)'; g.fillRect(x, 0, 3, 1024);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(90,60,50,${0.05 + R() * 0.08})`; g.lineWidth = 1; const xx = x + 6 + R() * (pw - 12); g.beginPath(); g.moveTo(xx, 0); g.lineTo(xx + (R() - 0.5) * 8, 1024); g.stroke(); }
  }
  return c;
}

/** The paper sweep's albedo (a dusky violet) and its warm pool of light (emissive). */
function paintSweep(R) {
  const { c, g } = cnv(512, 512);
  g.fillStyle = '#4a3a6c'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) { const gr = g.createRadialGradient(R() * 512, R() * 512, 0, R() * 512, R() * 512, 40 + R() * 90); gr.addColorStop(0, `rgba(${R() < 0.5 ? '90,70,120' : '40,30,60'},0.12)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); }
  const { c: e, g: eg } = cnv(512, 512);
  eg.fillStyle = '#000'; eg.fillRect(0, 0, 512, 512);
  // (v = 1 − y/512; the pool sits on the wall behind the marks, v ≈ 0.63)
  eg.save(); eg.translate(256, 512 * (1 - 0.63)); eg.scale(1.25, 1);
  const gr = eg.createRadialGradient(0, 0, 0, 0, 0, 150);
  gr.addColorStop(0, 'rgba(255,196,150,1)'); gr.addColorStop(0.35, 'rgba(240,150,140,0.55)'); gr.addColorStop(0.7, 'rgba(150,90,170,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  eg.fillStyle = gr; eg.beginPath(); eg.arc(0, 0, 150, 0, TAU); eg.fill();
  eg.restore();
  return { map: c, glow: e };
}

// ------------------------------------------------------------------ geometry helpers
const nonIdx = (g) => (g.index ? g.toNonIndexed() : g);
/** Merge (all non-indexed), optionally with a constant vertex colour per part. */
function merge(parts, { colors = null } = {}) {
  const list = parts.map((p, i) => {
    const g = nonIdx(p);
    if (colors) {
      const col = colors[i] || [1, 1, 1];
      const n = g.getAttribute('position').count;
      const a = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { a[k * 3] = col[0]; a[k * 3 + 1] = col[1]; a[k * 3 + 2] = col[2]; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    }
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    return g;
  });
  const out = mergeGeometries(list);
  parts.forEach((p) => p.dispose());
  list.forEach((p) => p.dispose());
  return out;
}
/** A box from a to b (cross-section w × t). */
function slat(a, b, w, t) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.BoxGeometry(w, d.length(), t);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
/** A cylinder from a to b. */
function rod(a, b, r0, r1 = r0, seg = 10) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r1, r0, d.length(), seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
/** Remap a geometry's uv from [0,1]² into a rectangle of an atlas. */
function uvRect(g, u0, v0, u1, v1) {
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  return g;
}
/** A BoxGeometry whose six faces map to atlas rectangles (null → a fallback rectangle). */
function boxAtlas(w, h, d, faces, fallback) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    const r = faces[Math.floor(i / 4)] || fallback;
    uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]), r[1] + uv.getY(i) * (r[3] - r[1]));
  }
  return g;
}
/** A camera-aimed group's orientation: +Z toward the target. */
function aim(obj, from, to) { obj.position.copy(from); obj.lookAt(to); return obj; }
const tagWhich = (g, w) => {
  const n = g.getAttribute('position').count;
  g.setAttribute('aWhich', new THREE.BufferAttribute(new Float32Array(n).fill(w), 1));
  return g;
};

/** The seamless paper sweep (floor → cove → wall) with its roll on top. */
function sweepGeometry({ width = 7.4, front = 1.9, back = -1.25, r = 0.85, top = 4.25, nx = 18 } = {}) {
  const prof = [];
  for (let i = 0; i <= 10; i++) prof.push([lerp(front, back, i / 10), 0]);
  for (let i = 1; i <= 14; i++) { const a = -Math.PI / 2 - (i / 14) * (Math.PI / 2); prof.push([back + Math.cos(a) * r, r + Math.sin(a) * r]); }
  for (let i = 1; i <= 8; i++) prof.push([back - r, lerp(r, top, i / 8)]);
  const len = [0];
  for (let j = 1; j < prof.length; j++) len.push(len[j - 1] + Math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]));
  const total = len[len.length - 1];
  const pos = [], uv = [], idx = [];
  for (let j = 0; j < prof.length; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      pos.push((u - 0.5) * width, prof[j][1], prof[j][0]);
      uv.push(u, len[j] / total);
    }
  }
  for (let j = 0; j < prof.length - 1; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const roll = new THREE.CylinderGeometry(0.085, 0.085, width + 0.1, 20, 1);
  roll.rotateZ(Math.PI / 2); roll.translate(0, top + 0.05, back - r - 0.06);
  uvRect(roll, 0.4, 0.98, 0.6, 1);
  return merge([g, roll]);
}

// ------------------------------------------------------------------ shaders
export const CARD_VERT = /* glsl */`
  varying vec2 vUv; varying vec3 vNw; varying vec3 vVw;
  void main(){
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vNw = normalize(mat3(modelMatrix) * normal);
    vVw = cameraPosition - wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
export const CARD_FRAG = /* glsl */`
  uniform sampler2D uPhoto; uniform sampler2D uFrame;
  uniform vec4 uRect; uniform float uDevelop; uniform float uGlow; uniform float uLight; uniform float uFade;
  uniform vec3 uKeyDir; uniform float uSheen;
  varying vec2 vUv; varying vec3 vNw; varying vec3 vVw;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    vec3 N = normalize(vNw); vec3 V = normalize(vVw);
    if (!gl_FrontFacing) N = -N;
    vec2 q = (vUv - uRect.xy) / (uRect.zw - uRect.xy);
    float inside = gl_FrontFacing ? step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0) : 0.0;
    // the paper (and the back of the print): lit softly by the key, a little sheen as it turns,
    // and, at the end, the memory glow along its edges
    vec3 paper = gl_FrontFacing ? texture2D(uFrame, vUv).rgb : vec3(0.84, 0.8, 0.72) * (0.96 + 0.04 * hash(floor(vUv * 260.0)));
    float diff = 0.8 + 0.2 * max(dot(N, uKeyDir), 0.0);
    vec3 H = normalize(uKeyDir + V);
    paper = paper * uLight * diff + vec3(pow(max(dot(N, H), 0.0), 70.0) * uSheen);
    vec2 e = min(vUv, 1.0 - vUv);
    paper += vec3(1.0, 0.7, 0.3) * uGlow * (exp(-min(e.x, e.y) * 30.0) * 2.6 + 0.08);
    // the image: once developed, EXACTLY the owner's image — no light, grade, tint, vignette or glow.
    // (developing: from a milky sheet, the shadows first; at uDevelop = 1 it is the image, untouched)
    vec3 img = texture2D(uPhoto, clamp(q, 0.0, 1.0)).rgb;
    if (uDevelop < 0.999) {
      float l = dot(img, vec3(0.2126, 0.7152, 0.0722));
      float d = clamp((uDevelop - l * 0.25) / 0.75, 0.0, 1.0);
      d = d * d * (3.0 - 2.0 * d);
      vec3 milk = vec3(0.5, 0.52, 0.54) * (0.97 + 0.03 * hash(floor(q * 220.0)));
      img = mix(milk, img, d);
    }
    gl_FragColor = vec4(mix(paper, img, inside), uFade);
    #include <colorspace_fragment>
  }`;
// the lit faces of the softboxes, the flash head and the camera's screen: one draw for all of them
const PANEL_VERT = /* glsl */`
  attribute float aWhich;
  uniform float uL[6]; uniform vec3 uC[6];
  varying vec3 vCol; varying vec2 vUv; varying float vW;
  void main(){
    int i = int(aWhich + 0.5);
    vCol = uC[i] * uL[i]; vUv = uv; vW = aWhich;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const PANEL_FRAG = /* glsl */`
  varying vec3 vCol; varying vec2 vUv; varying float vW;
  void main(){
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float hot = 1.0 - 0.42 * r * r;
    vec3 base = vW > 3.5 ? vec3(0.01, 0.01, 0.016) : vec3(0.05, 0.048, 0.055);
    gl_FragColor = vec4(base + vCol * hot, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const BEAM_VERT = /* glsl */`
  attribute float aT; attribute float aW;
  uniform vec2 uLevel;
  varying float vT; varying float vA; varying vec3 vN; varying vec3 vV;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    vT = aT; vA = aW < 0.5 ? uLevel.x : uLevel.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const BEAM_FRAG = /* glsl */`
  varying float vT; varying float vA; varying vec3 vN; varying vec3 vV;
  void main(){
    float f = abs(dot(normalize(vN), normalize(vV)));
    float along = smoothstep(0.0, 0.18, vT) * (1.0 - smoothstep(0.45, 1.0, vT));
    vec3 c = vec3(1.0, 0.78, 0.52) * f * f * along * vA;
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const SPARK_VERT = /* glsl */`
  attribute vec3 aPos; attribute vec4 aCol; attribute vec3 aMisc;
  varying vec2 vUv; varying vec4 vCol; varying float vKind;
  void main(){
    vUv = uv - 0.5; vCol = aCol; vKind = aMisc.y;
    vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
    mv.xyz += normalize(-mv.xyz) * aMisc.x * 0.25;
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
    if (vKind > 0.5) {
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
  uniform float uTime;
  varying vec2 vUv; varying vec4 vCol; varying float vA;
  void main(){
    vUv = uv - 0.5; vCol = aCol;
    float seed = aMisc.y;
    vec3 p = aPos;
    p.x += sin(uTime * 0.09 + seed * 31.0) * 0.12;
    p.y += cos(uTime * 0.07 + seed * 17.0) * 0.1;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    mv.xy += position.xy * aMisc.x;
    vA = 0.8 + 0.2 * sin(uTime * (0.3 + seed) + seed * 40.0);
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
  uniform float uTime; uniform float uBright; uniform vec3 uKey; uniform vec3 uKeyAim;
  varying vec2 vUv; varying float vA;
  void main(){
    vUv = uv - 0.5;
    float s = aMisc.y;
    float w = mod(uTime * aMisc.z + s * 13.0, 3.0);
    vec3 p = aPos;
    p.y += w - 1.5;
    p.x += sin(uTime * 0.19 + s * 40.0) * 0.16;
    p.z += cos(uTime * 0.15 + s * 27.0) * 0.16;
    // brighter inside the key light's beam
    vec3 ax = normalize(uKeyAim - uKey);
    vec3 rel = p - uKey;
    float along = dot(rel, ax);
    float off = length(rel - ax * along);
    float beam = 0.35 + 1.4 * smoothstep(0.9 + along * 0.18, 0.2, off) * step(0.0, along);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    float near = smoothstep(1.6, 0.35, depth);
    mv.xy += position.xy * aMisc.x * (1.0 + near * 3.0);
    float k = w / 3.0;
    vA = smoothstep(0.0, 0.15, k) * smoothstep(1.0, 0.85, k) * smoothstep(0.1, 0.4, depth)
       * (0.55 + 0.45 * sin(uTime * (0.8 + s) + s * 50.0)) * mix(1.0, 0.3, near) * beam * uBright;
    gl_Position = projectionMatrix * mv;
  }`;
const DUST_FRAG = /* glsl */`
  varying vec2 vUv; varying float vA;
  void main(){
    float d = length(vUv) * 2.0;
    float a = exp(-d * d * 5.0) * (1.0 - smoothstep(0.8, 1.0, d));
    gl_FragColor = vec4(vec3(1.0, 0.78, 0.45) * a * vA, 1.0);
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

/** The golden thread's path around the print(s) (deck space: an ellipse rx × ry), then up and away. */
function wrapPath(rx, ry) {
  const pts = [new THREE.Vector3(-rx - 0.85, -ry - 1.0, 0.6), new THREE.Vector3(-rx - 0.35, -ry - 0.45, 0.38)];
  const turns = 1.55, n = 26, a0 = -2.35;
  for (let i = 0; i <= n; i++) {
    const k = i / n, a = a0 + k * turns * TAU, s = 1 + 0.05 * Math.sin(k * 11);
    pts.push(new THREE.Vector3(Math.cos(a) * rx * s, Math.sin(a) * ry * s + k * 0.12, Math.sin(a + 0.9) * 0.15));
  }
  const loopEnd = pts[pts.length - 1].clone();
  pts.push(new THREE.Vector3(0.2, ry + 0.5, -0.12), new THREE.Vector3(0.38, ry + 1.25, -0.5), new THREE.Vector3(0.55, ry + 2.6, -1.2));
  const path = new PathSampler(pts, { samples: 1600 });
  path.sLoop0 = path.closest(pts[2]);
  path.sLoop = path.closest(loopEnd);
  return path;
}

// ================================================================== build
export async function build(env) {
  const { tier, renderer } = env;
  const q = tier.quality;
  const reduced = !!tier.reduced;
  const shadows = !!tier.shadows;
  const envMap = env.envWarm;
  const dev = !!window.__LITTLE_DEV__;
  const R = rng(1205);
  const own = new Set();
  const keep = (x) => { own.add(x); return x; };
  const tex = (c, { srgb = true, repeat = 0 } = {}) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
    t.needsUpdate = true;
    return keep(t);
  };
  const PHYS_ONLY = ['clearcoat', 'clearcoatRoughness', 'sheen', 'sheenColor', 'sheenRoughness', 'iridescence', 'iridescenceIOR', 'specularIntensity'];
  const phys = (o) => {
    if (q >= 1) return keep(new THREE.MeshPhysicalMaterial({ envMap, ...o }));
    const p = { envMap, ...o };
    PHYS_ONLY.forEach((k) => delete p[k]);
    return keep(new THREE.MeshStandardMaterial(p));
  };
  const std = (o) => keep(new THREE.MeshStandardMaterial({ envMap, ...o }));
  const geo = (g) => keep(g);
  const mesh = (g, m, { cast = false, receive = true } = {}) => {
    const x = new THREE.Mesh(geo(g), m);
    x.castShadow = shadows && cast; x.receiveShadow = shadows && receive;
    return x;
  };

  // fonts for the slate, the chairs and the print (the shell already waited for Caveat)
  try {
    await Promise.race([
      Promise.all([document.fonts.load('600 80px "Cinzel"'), document.fonts.load('700 46px "Cinzel"'), document.fonts.load('600 84px "Caveat"')]),
      new Promise((r) => env.later(2.5, r)),
    ]);
  } catch (e) { /* ignore */ }
  env.guard();
  // the owner's fan-art image(s), loaded whole (each print keeps its image's own shape). None (an
  // image that will not load): nothing to show — never anything in its place.
  const shots = await loadFanArt(env);
  env.guard();
  if (!shots.length) {
    return { id: 'nivin', scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), exposure: 1, late: [], update() {}, resize() {}, async play() {}, dispose() {} };
  }
  shots.forEach((s) => { keep(s.texture); renderer.initTexture(s.texture); });
  // (the reveal prints the same images again, each with the same caption as here)
  env.shared.fanPhotos = shots.map((s) => ({ texture: s.texture, caption: s.caption }));

  // ---------------------------------------------------------------- world
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(0x07050d, 8, 26);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.03, 90);
  const rig = createRig(camera, { breath: 0.5 });

  // the paper sweep and the studio floor
  const sweepTex = paintSweep(R);
  const sweepMat = std({ map: tex(sweepTex.map), emissive: new THREE.Color(1, 1, 1), emissiveMap: tex(sweepTex.glow), emissiveIntensity: 0, roughness: 0.92, envMapIntensity: 0.15 });
  const sweep = mesh(sweepGeometry(), sweepMat);
  sweep.position.y = 0.002;
  scene.add(sweep);
  const floorMat = std({ map: tex(paintFloor(R), { repeat: 7 }), roughness: 0.55, metalness: 0, envMapIntensity: 0.35 });
  const floor = mesh(new THREE.PlaneGeometry(36, 36), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // tape marks on the paper: one gold, one lavender (little film-set "T"s at their feet)
  {
    const parts = [], cols = [];
    const tee = (p, col) => {
      const a = new THREE.PlaneGeometry(0.16, 0.026); a.rotateX(-Math.PI / 2); a.translate(p.x, 0.006, p.z + 0.2);
      const b = new THREE.PlaneGeometry(0.026, 0.11); b.rotateX(-Math.PI / 2); b.translate(p.x, 0.006, p.z + 0.2 + 0.068);
      parts.push(a, b); cols.push(col, col);
    };
    tee(MARK_D, [0.95, 0.72, 0.32]); tee(MARK_N, [0.66, 0.56, 0.86]);
    scene.add(mesh(merge(parts, { colors: cols }), std({ vertexColors: true, roughness: 0.6, envMapIntensity: 0.3 })));
  }

  // ---------------------------------------------------------------- lights & their hardware
  const fabric = phys({ color: 0x17151b, roughness: 0.86, sheen: 0.35, sheenColor: new THREE.Color('#5a5070'), sheenRoughness: 0.6, envMapIntensity: 0.4 });
  const metal = std({ color: 0xffffff, vertexColors: true, metalness: 0.75, roughness: 0.36, envMapIntensity: 1.1 });
  const DARK = [0.16, 0.155, 0.17], SILVER = [0.78, 0.78, 0.8];
  const panelU = {
    uL: { value: [0, 0, 0, 0, 0, 0] },
    uC: { value: [new THREE.Color(1.0, 0.93, 0.82), new THREE.Color(1.0, 0.95, 0.88), new THREE.Color(0.86, 0.88, 1.0), new THREE.Color(1, 1, 1), new THREE.Color(0.32, 0.36, 0.62), new THREE.Color(1, 0.3, 0.15)] },
  };
  const panelMat = keep(new THREE.ShaderMaterial({ uniforms: panelU, vertexShader: PANEL_VERT, fragmentShader: PANEL_FRAG, side: THREE.DoubleSide }));
  const staticMetal = [], staticMetalCol = [], fabricParts = [], panels = [];
  const _m = new THREE.Matrix4();
  /** A softbox on a stand, aimed: body (fabric), lit face (panel), stand (metal). */
  function softbox(at, aimAt, { kind, w, h, depth, which }) {
    const o = aim(new THREE.Object3D(), at, aimAt);
    o.updateMatrix();
    _m.copy(o.matrix);
    let body, face;
    if (kind === 'octa') {
      body = new THREE.CylinderGeometry(0.09, w, depth, 8, 1, true);
      body.rotateX(-Math.PI / 2); body.translate(0, 0, -depth / 2);
      face = new THREE.CircleGeometry(w * 0.985, 8, Math.PI / 2);
    } else {
      body = new THREE.CylinderGeometry(0.07, Math.SQRT1_2, depth, 4, 1, true, Math.PI / 4);
      body.rotateX(-Math.PI / 2); body.scale(w, h, 1); body.translate(0, 0, -depth / 2);
      face = new THREE.PlaneGeometry(w * Math.SQRT2 * 0.69, h * Math.SQRT2 * 0.69);
    }
    face.translate(0, 0, 0.004);
    const head = new THREE.CylinderGeometry(0.075, 0.075, 0.16, 14, 1); head.rotateX(Math.PI / 2); head.translate(0, 0, -depth - 0.07);
    fabricParts.push(body.applyMatrix4(_m));
    staticMetal.push(head.applyMatrix4(_m)); staticMetalCol.push(DARK);
    panels.push(tagWhich(face.applyMatrix4(_m), which));
    // the stand: under the light head, three legs, a short yoke
    const back = new THREE.Vector3(0, 0, -depth - 0.07).applyMatrix4(_m);
    const top = new THREE.Vector3(back.x, back.y - 0.09, back.z);
    staticMetal.push(rod(new THREE.Vector3(back.x, 0.42, back.z), top, 0.016, 0.013)); staticMetalCol.push(DARK);
    staticMetal.push(rod(top, back, 0.012)); staticMetalCol.push(SILVER);
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3 + 0.4;
      staticMetal.push(rod(new THREE.Vector3(back.x, 0.44, back.z), new THREE.Vector3(back.x + Math.cos(a) * 0.42, 0.012, back.z + Math.sin(a) * 0.42), 0.011)); staticMetalCol.push(DARK);
    }
    const knob = new THREE.SphereGeometry(0.022, 10, 8); knob.translate(back.x, 0.9, back.z); staticMetal.push(knob); staticMetalCol.push(SILVER);
    return o;
  }
  softbox(KEY_AT, KEY_AIM, { kind: 'octa', w: 0.6, depth: 0.5, which: 0 });
  softbox(FILL_AT, FILL_AIM, { kind: 'rect', w: 0.5, h: 0.68, depth: 0.42, which: 1 });
  softbox(RIM_AT, RIM_AIM, { kind: 'rect', w: 0.17, h: 0.82, depth: 0.25, which: 2 });
  // the sweep's stands and crossbar
  for (const sx of [-1, 1]) {
    staticMetal.push(rod(new THREE.Vector3(sx * 3.78, 0, -2.18), new THREE.Vector3(sx * 3.78, 4.4, -2.18), 0.02)); staticMetalCol.push(DARK);
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3; staticMetal.push(rod(new THREE.Vector3(sx * 3.78, 0.5, -2.18), new THREE.Vector3(sx * 3.78 + Math.cos(a) * 0.5, 0.01, -2.18 + Math.sin(a) * 0.5), 0.013)); staticMetalCol.push(DARK); }
  }
  // cables snaking off the set
  const cable = (pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.009, z))), 60, 0.009, 6, false);
  fabricParts.push(cable([[-1.7, 1.25], [-2.1, 1.9], [-2.6, 2.3], [-3.4, 2.1], [-4.6, 2.6]]));
  fabricParts.push(cable([[2.3, 1.45], [2.7, 2.1], [3.1, 2.6], [4.2, 2.9]]));
  fabricParts.push(cable([[0.12, 2.95], [0.6, 3.6], [1.4, 3.9], [2.6, 4.6], [4.0, 4.7]]));
  scene.add(mesh(merge(staticMetal, { colors: staticMetalCol }), metal, { cast: true }));
  const fabricMesh = mesh(merge(fabricParts), fabric, { cast: true });
  scene.add(fabricMesh);

  // the lights themselves
  const key = new THREE.SpotLight(0xffe6c8, 0, 0, 0.62, 0.95, 2);
  key.position.copy(KEY_AT).addScaledVector(_v1.subVectors(KEY_AT, KEY_AIM).normalize(), 0.15);
  key.target.position.copy(KEY_AIM);
  if (shadows) {
    key.castShadow = true;
    const ss = q === 2 ? 1024 : 512;
    key.shadow.mapSize.set(ss, ss);
    key.shadow.camera.near = 0.8; key.shadow.camera.far = 9;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    key.shadow.radius = 3;
  }
  const fill = new THREE.SpotLight(0xfff0e4, 0, 0, 0.7, 1, 2);
  fill.position.copy(FILL_AT); fill.target.position.copy(FILL_AIM);
  const rim = new THREE.SpotLight(0xc8c4ff, 0, 0, 0.5, 0.9, 2);
  rim.position.copy(RIM_AT); rim.target.position.copy(RIM_AIM);
  const lamp = new THREE.SpotLight(0xffc890, 0, 0, 0.36, 1, 2);   // a work light behind the chairs
  lamp.position.copy(LAMP_AT); lamp.target.position.copy(LAMP_AIM);
  const flash = new THREE.PointLight(0xf4f6ff, 0, 0, 2);
  const hemi = new THREE.HemisphereLight(0x6a5a9a, 0x1a1016, 0.1);
  scene.add(key, key.target, fill, fill.target, rim, rim.target, lamp, lamp.target, flash, hemi);

  // ---------------------------------------------------------------- the photo camera on its tripod
  const camBody = phys({ color: 0x1b1a20, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.8 });
  const glass = phys({ color: 0x07080d, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4, iridescence: q === 2 ? 1 : 0, iridescenceIOR: 1.6 });
  const goldMat = std({ color: 0xf0c060, metalness: 1, roughness: 0.2, envMapIntensity: 1.3 });
  const tripod = new THREE.Group();     // at the floor, under the camera
  const head = new THREE.Group();       // the camera body: +Z out of the lens
  const LEG_TOP = 1.02;
  {
    const legs = [], cols = [];
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3 + Math.PI / 2;
      const top = new THREE.Vector3(Math.cos(a) * 0.05, LEG_TOP, Math.sin(a) * 0.05);
      const mid = new THREE.Vector3(Math.cos(a) * 0.25, 0.5, Math.sin(a) * 0.25);
      const foot = new THREE.Vector3(Math.cos(a) * 0.46, 0.012, Math.sin(a) * 0.46);
      legs.push(rod(top, mid, 0.016, 0.015), rod(mid, foot, 0.011, 0.01));
      cols.push(DARK, DARK);
      const lock = new THREE.CylinderGeometry(0.019, 0.019, 0.035, 10); lock.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, _v1.subVectors(foot, top).normalize())); lock.translate(mid.x, mid.y, mid.z);
      legs.push(lock); cols.push(SILVER);
      legs.push(rod(new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(Math.cos(a) * 0.19, 0.62, Math.sin(a) * 0.19), 0.006)); cols.push(DARK);
    }
    const hub = new THREE.CylinderGeometry(0.06, 0.05, 0.06, 16); hub.translate(0, LEG_TOP, 0); legs.push(hub); cols.push(DARK);
    tripod.add(mesh(merge(legs, { colors: cols }), metal, { cast: true }));
  }
  const column = mesh(merge([rod(new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(0, 1.3, 0), 0.016), (() => { const g = new THREE.CylinderGeometry(0.035, 0.04, 0.05, 14); g.translate(0, 1.3, 0); return g; })()], { colors: [SILVER, DARK] }), metal, { cast: true });
  tripod.add(column);
  const LENS = new THREE.Vector3(0, 0, 0.135);       // the lens front (head space)
  const LED = new THREE.Vector3(-0.056, 0.035, -0.042); // the ready-light on the back
  const FLASH_FACE = new THREE.Vector3(0, 0.126, 0.034);
  const FLASH_BACK = new THREE.Vector3(0.022, 0.13, -0.028);
  {
    const body = [
      new RoundedBoxGeometry(0.15, 0.1, 0.075, 3, 0.012),
      (() => { const g = new RoundedBoxGeometry(0.036, 0.098, 0.052, 2, 0.013); g.translate(-0.062, -0.002, 0.018); return g; })(),
      (() => { const g = new RoundedBoxGeometry(0.056, 0.036, 0.055, 2, 0.01); g.translate(0, 0.062, -0.004); return g; })(),
      (() => { const g = new THREE.BoxGeometry(0.028, 0.03, 0.03); g.translate(0, 0.092, -0.006); return g; })(),
      (() => { const g = new RoundedBoxGeometry(0.078, 0.05, 0.062, 2, 0.01); g.translate(0, 0.126, 0.002); return g; })(),
      (() => { const g = new THREE.CylinderGeometry(0.037, 0.037, 0.072, 28, 1); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.074); return g; })(),
      (() => { const g = new THREE.CylinderGeometry(0.0385, 0.0385, 0.016, 28, 1); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.122); return g; })(),
      // the pan handle, toward the photographer
      rod(new THREE.Vector3(0.05, -0.05, -0.03), new THREE.Vector3(0.12, -0.13, -0.3), 0.009),
      (() => { const g = new THREE.CylinderGeometry(0.03, 0.035, 0.04, 14); g.translate(0, -0.07, 0); return g; })(),
    ];
    head.add(mesh(merge(body), camBody, { cast: true }));
    const ring = new THREE.TorusGeometry(0.0378, 0.0016, 6, 40); ring.translate(0, 0, 0.112);
    const mount = new THREE.CylinderGeometry(0.034, 0.034, 0.012, 28, 1); mount.rotateX(Math.PI / 2); mount.translate(0, 0, 0.042);
    head.add(mesh(merge([ring]), goldMat));
    head.add(mesh(merge([mount], { colors: [SILVER] }), metal));
    const lens = new THREE.SphereGeometry(0.052, 28, 8, 0, TAU, 0, 0.62);
    lens.rotateX(Math.PI / 2); lens.translate(0, 0, 0.13 - 0.052 * Math.cos(0.62));
    head.add(mesh(lens, glass));
    // the flash's lit face and the camera's screen (panel material)
    const fl = new THREE.PlaneGeometry(0.068, 0.04); fl.translate(FLASH_FACE.x, FLASH_FACE.y, FLASH_FACE.z);
    const lcd = new THREE.PlaneGeometry(0.092, 0.062); lcd.rotateY(Math.PI); lcd.translate(0.008, -0.004, -0.0385);
    head.add(new THREE.Mesh(geo(merge([tagWhich(fl, 3), tagWhich(lcd, 4)])), panelMat));
  }
  tripod.add(head);
  scene.add(tripod);

  // ---------------------------------------------------------------- director's chairs, apple box, clapperboard
  const wood = phys({ map: tex(paintWood(R)), roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.6 });
  const herName = (() => { const n = env.fill('{name}'); return n && !n.includes('{') ? n : 'Deepu'; })();
  const canvasMat = phys({ map: tex(paintChairs(R, [herName, 'Nivin Pauly'])), roughness: 0.82, sheen: 0.6, sheenColor: new THREE.Color('#b897e0'), sheenRoughness: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.3 });
  const woodParts = [], canvasParts = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  function chair(at, label, yaw) {
    _m.makeRotationY(yaw).setPosition(at);
    const W2 = 0.27, parts = [];
    for (const sx of [-1, 1]) {
      const x = sx * W2;
      parts.push(slat(V(x, 0.0, 0.2), V(x, 0.45, -0.19), 0.03, 0.022), slat(V(x, 0.0, -0.2), V(x, 0.45, 0.19), 0.03, 0.022));
      parts.push(slat(V(x, 0.45, -0.215), V(x, 0.45, 0.215), 0.034, 0.03), slat(V(x, 0.02, -0.21), V(x, 0.02, 0.21), 0.03, 0.03));
      parts.push(slat(V(x, 0.45, 0.19), V(x, 0.665, 0.19), 0.03, 0.03), slat(V(x, 0.43, -0.205), V(x, 0.97, -0.235), 0.03, 0.03));
      parts.push(slat(V(x, 0.675, -0.225), V(x, 0.675, 0.255), 0.062, 0.022));
    }
    for (const z of [0.205, -0.205]) parts.push(slat(V(-W2, 0.06, z), V(W2, 0.41, z), 0.022, 0.018), slat(V(W2, 0.06, z), V(-W2, 0.41, z), 0.022, 0.018));
    parts.forEach((p) => woodParts.push(p.applyMatrix4(_m)));
    // the seat (a slight sag) and the back band (both faces printed)
    const seat = new THREE.PlaneGeometry(0.52, 0.4, 8, 4);
    seat.rotateX(-Math.PI / 2);
    const sp = seat.getAttribute('position');
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i); sp.setY(i, 0.458 - 0.02 * (1 - (2 * x / 0.52) ** 2)); }
    uvRect(seat, 0.0, 0.02, 1.0, 0.23);
    const band = (back) => {
      const b = new THREE.PlaneGeometry(0.5, 0.19, 12, 1);
      const bp = b.getAttribute('position');
      // (both faces sag the same way, toward the back: a back face that bowed the other way crossed the
      // front one, whose reverse side — the name in mirror writing — then showed through mid-band)
      for (let i = 0; i < bp.count; i++) { const x = bp.getX(i); bp.setZ(i, (back ? 0.016 : -0.016) * (1 - (2 * x / 0.5) ** 2)); }
      if (back) b.rotateY(Math.PI);
      b.translate(0, 0.855, back ? -0.236 : -0.229);
      const v0 = label === 0 ? 0.625 : 0.25;
      return uvRect(b, 0.02, v0 + 0.01, 0.98, v0 + 0.365);
    };
    canvasParts.push(seat.applyMatrix4(_m), band(false).applyMatrix4(_m), band(true).applyMatrix4(_m));
  }
  chair(CHAIR_D, 0, Math.PI + 0.06);
  chair(CHAIR_N, 1, Math.PI - 0.05);
  // the apple box, and a little black case behind the slate
  const box = new RoundedBoxGeometry(0.51, 0.2, 0.3, 2, 0.008); box.rotateY(0.12); box.translate(BOX_AT.x, 0.1, BOX_AT.z);
  woodParts.push(box);
  const caseG = new RoundedBoxGeometry(0.36, 0.17, 0.14, 2, 0.016); caseG.rotateY(0.1); caseG.translate(BOX_AT.x + 0.03, 0.2 + 0.085, BOX_AT.z - 0.09);
  scene.add(mesh(merge([caseG]), camBody, { cast: true }));
  scene.add(mesh(merge(woodParts), wood, { cast: true }));
  scene.add(mesh(merge(canvasParts), canvasMat, { cast: true }));

  // the clapperboard: slate + bottom stick (one mesh) and the hinged top stick
  const slateMat = phys({ map: tex(paintSlate(R)), roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 0.7 });
  const SLATE_W = 0.3, SLATE_H = 0.22;
  const FACE = [0, 1 - 800 / 1024, 1, 1], STRIPE = [0, 1 - 966 / 1024, 1, 1 - 820 / 1024], STRIPE_R = [1, 1 - 966 / 1024, 0, 1 - 820 / 1024], INK = [0.02, 0.01, 0.05, 0.03];
  const slate = new THREE.Group();
  {
    const body = boxAtlas(SLATE_W, SLATE_H, 0.012, [null, null, null, null, FACE, null], INK); body.translate(0, SLATE_H / 2, 0);
    const stick = boxAtlas(SLATE_W, 0.036, 0.014, [null, null, null, null, STRIPE, null], INK); stick.translate(0, SLATE_H + 0.018, 0);
    const pin = new THREE.CylinderGeometry(0.008, 0.008, 0.03, 10); pin.rotateX(Math.PI / 2); pin.translate(-SLATE_W / 2 + 0.012, SLATE_H + 0.036, 0); uvRect(pin, INK[0], INK[1], INK[2], INK[3]);
    slate.add(mesh(merge([body, stick, pin]), slateMat, { cast: true }));
  }
  const arm = new THREE.Group();
  arm.position.set(-SLATE_W / 2, SLATE_H + 0.036, 0);
  {
    const s = boxAtlas(SLATE_W, 0.036, 0.014, [null, null, null, null, STRIPE_R, null], INK); s.translate(SLATE_W / 2, 0.018, 0.001);
    arm.add(mesh(s, slateMat, { cast: true }));
  }
  slate.add(arm);
  slate.position.set(BOX_AT.x - 0.01, 0.2, BOX_AT.z + 0.04);
  slate.rotation.set(-0.16, 0.1, 0.0);
  scene.add(slate);
  const SLATE_C = new THREE.Vector3(BOX_AT.x - 0.01, 0.2 + 0.13, BOX_AT.z + 0.0);

  // ---------------------------------------------------------------- the panels' mesh (lit faces)
  scene.add(new THREE.Mesh(geo(merge(panels)), panelMat));

  // ---------------------------------------------------------------- the key's beam (a soft volume of light)
  const beamU = { uLevel: { value: new THREE.Vector2(0, 0) } };
  const beamMat = keep(new THREE.ShaderMaterial({ uniforms: beamU, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  {
    const cone = (from, to, r0, r1, w) => {
      const L = from.distanceTo(to);
      const g = new THREE.CylinderGeometry(r1, r0, L, 28, 8, true);
      const p = g.getAttribute('position');
      const t = new Float32Array(p.count);
      for (let i = 0; i < p.count; i++) t[i] = 0.5 + p.getY(i) / L;
      g.setAttribute('aT', new THREE.BufferAttribute(t, 1));
      g.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(p.count).fill(w), 1));
      g.translate(0, L / 2, 0);
      const o = aim(new THREE.Object3D(), from, to);
      o.rotateX(Math.PI / 2);
      o.updateMatrix();
      g.applyMatrix4(o.matrix);
      return g;
    };
    const beams = new THREE.Mesh(geo(mergeGeometries([cone(KEY_AT, _v1.lerpVectors(KEY_AT, KEY_AIM, 1.2), 0.5, 1.0, 0), cone(RIM_AT, _v2.lerpVectors(RIM_AT, RIM_AIM, 1.1), 0.12, 0.6, 1)].map(nonIdx))), beamMat);
    beams.renderOrder = 6;
    beams.frustumCulled = false;
    scene.add(beams);
  }
  // ---------------------------------------------------------------- the prints (the owner's fan art)
  // They live in an overlay the shell draws after the studio, straight to the screen: no bloom, tone
  // mapping, grading, fog or particles over them — each image looks exactly as it was made.
  const overlay = new THREE.Scene();
  const keyDirU = new THREE.Vector3(-0.35, 0.8, 0.5).normalize();
  const deck = new THREE.Group();     // where the prints hover (faces the photographer's side)
  overlay.add(deck);
  const cards = shots.map((s, i) => {
    const f = paintFrame(R, env.fill(s.caption || env.T.photoCaption || ''), s.aspect);
    const frameTex = tex(f.c);
    renderer.initTexture(frameTex);
    const imgW = s.aspect >= 1 ? IMG_MAX : IMG_MAX * s.aspect;
    const w = (imgW * FW) / (FW - BORDER * 2), h = (w * f.c.height) / FW;
    const g = new THREE.PlaneGeometry(w, h, 10, 2);
    const pos = g.getAttribute('position');
    for (let k = 0; k < pos.count; k++) { const x = pos.getX(k) / (w / 2); pos.setZ(k, -0.003 * x * x); } // a barely-there curl
    g.computeVertexNormals();
    const u = {
      uPhoto: { value: s.texture }, uFrame: { value: frameTex }, uRect: { value: f.rect },
      uDevelop: { value: 0 }, uGlow: { value: 0 }, uLight: { value: 1.05 }, uFade: { value: 1 },
      uKeyDir: { value: keyDirU }, uSheen: { value: 0.35 },
    };
    const m = keep(new THREE.ShaderMaterial({ uniforms: u, vertexShader: CARD_VERT, fragmentShader: CARD_FRAG, side: THREE.DoubleSide, transparent: true, toneMapped: false }));
    const o = new THREE.Mesh(geo(g), m);
    o.renderOrder = 4;
    o.frustumCulled = false;
    deck.add(o);
    // k: 0…1 (born → in its slot), and the flight's start (deck space)
    return { mesh: o, u, w, h, k: 1, from: new THREE.Vector3(), fromE: new THREE.Euler(), s0: 0.25, spin: 0, bob: R() * TAU, slot: new THREE.Vector3(), slotRz: 0, i };
  });
  const N = cards.length;
  // the slots: side by side (two), or one in the middle
  {
    const gap = 0.03;
    if (N === 1) { cards[0].slot.set(0, 0, 0); cards[0].slotRz = 0; }
    else {
      cards[0].slot.set(-(cards[0].w / 2 + gap / 2), 0.012, 0); cards[0].slotRz = 0.035;
      cards[1].slot.set(cards[1].w / 2 + gap / 2, -0.012, 0.01); cards[1].slotRz = -0.03;
    }
  }
  /** The prints' box (deck space). */
  const printsBox = (list) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of list) {
      x0 = Math.min(x0, c.slot.x - c.w / 2); x1 = Math.max(x1, c.slot.x + c.w / 2);
      y0 = Math.min(y0, c.slot.y - c.h / 2); y1 = Math.max(y1, c.slot.y + c.h / 2);
    }
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: (x1 - x0) / 2, hh: (y1 - y0) / 2 };
  };

  // the golden thread (deck space), round the print(s)
  const all = printsBox(cards);
  const path = wrapPath(all.hw + 0.12, all.hh + 0.08);
  const strand = createStrand({ segments: [110, 150, 190][q] });
  const STRAND_OPTS = { wobble: 0.5 };
  strand.uniforms.uWidth.value = 0.32;
  deck.add(strand.mesh);
  const T = { s0: 0, s1: 0 };

  // ---------------------------------------------------------------- bokeh, dust, glows
  const bokehMat = keep(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBright: { value: 0.4 } },
    vertexShader: BOKEH_VERT, fragmentShader: BOKEH_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const nBok = [16, 26, 36][q];
  const bokeh = billboards(nBok, [['aPos', 3], ['aCol', 4], ['aMisc', 3]], bokehMat);
  keep(bokeh.geo);
  bokeh.mesh.renderOrder = -5;
  scene.add(bokeh.mesh);
  {
    const pal = [[1.0, 0.68, 0.36], [1.0, 0.8, 0.55], [1.0, 0.6, 0.45], [0.72, 0.62, 1.0], [1.0, 0.86, 0.66]];
    for (let i = 0; i < nBok; i++) {
      let p;
      if (i < nBok * 0.45) p = [-7 + R() * 14, 4.6 + R() * 1.2, -4 + R() * 12];          // lamps on the grid overhead
      else { const a = Math.PI * (0.55 + R() * 0.9) + (R() < 0.5 ? 0 : Math.PI), r = 8 + R() * 6; p = [Math.cos(a) * r, 0.6 + R() * 3.4, 1.5 + Math.sin(a) * r * 0.9]; }
      const col = pal[Math.floor(R() * pal.length)];
      bokeh.attrs.aPos.setXYZ(i, ...p);
      bokeh.attrs.aCol.setXYZW(i, col[0], col[1], col[2], 0.12 + R() * 0.22);
      bokeh.attrs.aMisc.setXYZ(i, 0.35 + R() * 0.9, R(), 0);
    }
  }
  const dustU = { uTime: { value: 0 }, uBright: { value: 0 }, uKey: { value: KEY_AT.clone() }, uKeyAim: { value: KEY_AIM.clone() } };
  const dustMat = keep(new THREE.ShaderMaterial({ uniforms: dustU, vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const nDust = reduced ? [50, 100, 160][q] : [90, 180, 300][q];
  const dust = billboards(nDust, [['aPos', 3], ['aMisc', 3]], dustMat);
  keep(dust.geo);
  dust.mesh.renderOrder = 5;
  scene.add(dust.mesh);
  for (let i = 0; i < nDust; i++) {
    let p;
    const k = i / nDust;
    if (k < 0.45) { const t = R(); _v1.lerpVectors(KEY_AT, KEY_AIM, 0.1 + t * 0.95); p = [_v1.x + (R() - 0.5) * 0.9, _v1.y + (R() - 0.5) * 0.9, _v1.z + (R() - 0.5) * 0.9]; }
    else if (k < 0.75) p = [-1.4 + R() * 2.8, 0.2 + R() * 2.4, -0.9 + R() * 2.4];
    else if (k < 0.88) p = [DECK_AT.x + (R() - 0.5) * 1.6, DECK_AT.y + (R() - 0.5) * 1.2, DECK_AT.z + (R() - 0.5) * 1.0];
    else p = [SLATE_C.x + (R() - 0.5) * 1.2, 0.3 + R() * 1.2, SLATE_C.z - 0.3 + (R() - 0.5) * 1.2];
    dust.attrs.aPos.setXYZ(i, ...p);
    dust.attrs.aMisc.setXYZ(i, 0.006 + R() * R() * 0.016, R(), 0.04 + R() * 0.07);
  }
  // glows: [ready LED, flash lamp, flash glare, key halo, fill halo, rim halo, thread head, card glints ×2, lens glint]
  const G_READY = 0, G_LAMP = 1, G_GLARE = 2, G_KEY = 3, G_FILL = 4, G_RIM = 5, G_HEAD = 6, G_CARD = 7, G_LENS = 9, NG = 10;
  const sparkMat = keep(new THREE.ShaderMaterial({ vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const sparks = billboards(NG, [['aPos', 3, true], ['aCol', 4, true], ['aMisc', 3, true]], sparkMat);
  keep(sparks.geo);
  sparks.mesh.renderOrder = 20;
  scene.add(sparks.mesh);
  const SA = sparks.attrs;
  const keyN = _v1.subVectors(KEY_AIM, KEY_AT).normalize().clone();
  const fillN = _v1.subVectors(FILL_AIM, FILL_AT).normalize().clone();
  const rimN = _v1.subVectors(RIM_AIM, RIM_AT).normalize().clone();

  // ---------------------------------------------------------------- state
  // W: the looks the choreography animates
  const W = {
    key: 0, fill: 0, rim: 0, back: 0, lamp: 0, hemi: 0.1, ready: 0, blink: 1, flash: 0, soft: 0, glare: 0, lcd: 0,
    dust: 0, bokeh: 0.5, beam: 0, exposure: 1, clap: 0, thread: 0, ring: 0, width: 0.32, head: 0, lensGlint: 0,
    glint0: 0, glint1: 0, deckLift: 0, deckBack: 0, deckScale: 1, sway: 1,
  };
  // the tripod (arc angle, lens height)
  const P = { ang: SHOT_ANG[0], h: SHOT_H[0] };
  const cam = { x: 0, y: 0, z: 0, az: 0, el: 0, lh: 0, lw: 0, fov: 32, lift: 0, breath: 0.5, dk: 0 };
  const lensW = new THREE.Vector3(), deckW = new THREE.Vector3(), deckBase = new THREE.Vector3().copy(DECK_AT);
  const DECK_YAW = 0.04; // the prints face the photographer's side of the set (+Z)
  const deckQ = new THREE.Quaternion().setFromAxisAngle(UP, DECK_YAW);
  const BEATS = N > 1 ? ORDER : ORDER.filter((b) => b !== 'shot2');
  let held = false, heldT = 0, fresh = 0;

  const api = {
    id: 'nivin', scene, camera, exposure: 1,
    // (threshold high enough that only the lit softbox faces, the flash and glints bloom)
    bloom: { strength: 0.5, radius: 0.55, threshold: 0.9 },
    late: [],
    overlay: { scene: overlay, late: [deck] },
    update, resize, play, dispose,
    dev: dev ? { beat: '', held: false, t0: performance.now(), W, cam, P, cards, T } : null,
  };

  // ---------------------------------------------------------------- per-frame
  function placeTripod() {
    tripod.position.set(Math.sin(P.ang) * TRIPOD_R, 0, Math.cos(P.ang) * TRIPOD_R);
    tripod.rotation.y = P.ang;
    column.position.y = P.h - 1.36;
    head.position.set(0, P.h, 0);
    tripod.updateMatrixWorld();
    head.lookAt(SUBJ);
    head.updateMatrixWorld();
    lensW.copy(LENS).applyMatrix4(head.matrixWorld);
  }

  function updateCards(dt, t) {
    deck.position.set(deckBase.x, deckBase.y + W.deckLift, deckBase.z - W.deckBack);
    deck.quaternion.copy(deckQ);
    deck.scale.setScalar(W.deckScale);
    let any = false;
    for (let i = 0; i < N; i++) {
      const c = cards[i], o = c.mesh;
      if (!o.visible) continue;
      any = true;
      const k = c.k, e = k * k * (3 - 2 * k);
      // the flight: from the lens to the slot, rising in a soft arc, turning to face us
      o.position.lerpVectors(c.from, c.slot, e);
      o.position.y += Math.sin(Math.PI * k) * 0.12;
      const bob = W.sway * (1 - 0.6 * W.thread);
      o.position.y += Math.sin(t * 0.9 + c.bob) * 0.006 * bob;
      o.position.x += Math.sin(t * 0.6 + c.bob * 2) * 0.003 * bob;
      _e1.set(lerp(c.fromE.x, 0, e), lerp(c.fromE.y, 0, e) + c.spin * (1 - e), lerp(c.fromE.z, c.slotRz, e) + Math.sin(t * 0.7 + c.bob) * 0.008 * bob);
      o.rotation.copy(_e1);
      o.scale.setScalar(lerp(c.s0, 1, Math.min(1, e * 1.15)));
    }
    // (no print on screen: the shell skips the overlay pass)
    overlay.visible = deck.visible && any;
  }

  function updateCamera(dt, t) {
    _v1.set(cam.x, cam.y, cam.z);
    if (cam.dk > 0.001) { deck.getWorldPosition(deckW); _v1.lerp(deckW, cam.dk); }
    const tv = Math.tan((cam.fov * DEG) / 2), th = tv * camera.aspect;
    const dist = Math.max(Math.exp(cam.lh) / tv, Math.exp(cam.lw) / th);
    const ce = Math.cos(cam.el);
    rig.pos.set(_v1.x + Math.sin(cam.az) * ce * dist, _v1.y + Math.sin(cam.el) * dist, _v1.z + Math.cos(cam.az) * ce * dist);
    rig.look.set(_v1.x, _v1.y - cam.lift * dist * tv, _v1.z);
    rig.fov = cam.fov;
    rig.breath = reduced ? 0 : cam.breath * Math.min(1, dist * 0.4);
    rig.apply(t);
    const near = clamp(dist * 0.03, 0.01, 0.08);
    if (Math.abs(camera.near - near) > near * 0.1) { camera.near = near; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }

  /** How much a lit face (normal n at p) faces the viewer: 0 from behind. */
  const facing = (p, n) => Math.max(0, _v4.subVectors(camera.position, p).normalize().dot(n));

  function writeSparks(t) {
    const blink = W.blink > 0.5 ? (Math.sin(t * 3.1) > -0.2 ? 1 : 0.12) : 1;
    _v1.copy(LED).applyMatrix4(head.matrixWorld);
    _v2.set(0, 0, -1).transformDirection(head.matrixWorld);
    SA.aPos.setXYZ(G_READY, _v1.x, _v1.y, _v1.z);
    SA.aCol.setXYZW(G_READY, 1.0, 0.22, 0.1, W.ready * blink * (0.25 + facing(_v1, _v2)) * 1.6);
    SA.aMisc.setXYZ(G_READY, 0.07, 0, 0);
    _v1.copy(FLASH_BACK).applyMatrix4(head.matrixWorld);
    SA.aPos.setXYZ(G_LAMP, _v1.x, _v1.y, _v1.z);
    SA.aCol.setXYZW(G_LAMP, 1.0, 0.62, 0.22, W.ready * (0.2 + facing(_v1, _v2)) * 0.9);
    SA.aMisc.setXYZ(G_LAMP, 0.045, 0, 0);
    _v1.copy(FLASH_FACE).applyMatrix4(head.matrixWorld);
    _v2.set(0, 0, 1).transformDirection(head.matrixWorld);
    const fg = W.glare * (0.15 + 0.85 * facing(_v1, _v2));
    SA.aPos.setXYZ(G_GLARE, _v1.x, _v1.y, _v1.z);
    SA.aCol.setXYZW(G_GLARE, 1.0, 0.97, 0.92, fg * 2.2);
    SA.aMisc.setXYZ(G_GLARE, 0.25 + 1.6 * W.glare, 1, 0.3);
    // halos over the lit faces (seen from the front only)
    SA.aPos.setXYZ(G_KEY, KEY_AT.x, KEY_AT.y, KEY_AT.z);
    SA.aCol.setXYZW(G_KEY, 1.0, 0.86, 0.7, W.key * facing(KEY_AT, keyN) * 0.5);
    SA.aMisc.setXYZ(G_KEY, 2.0, 0, 0);
    SA.aPos.setXYZ(G_FILL, FILL_AT.x, FILL_AT.y, FILL_AT.z);
    SA.aCol.setXYZW(G_FILL, 1.0, 0.9, 0.8, W.fill * facing(FILL_AT, fillN) * 0.4);
    SA.aMisc.setXYZ(G_FILL, 1.5, 0, 0);
    SA.aPos.setXYZ(G_RIM, RIM_AT.x, RIM_AT.y, RIM_AT.z);
    SA.aCol.setXYZW(G_RIM, 0.8, 0.82, 1.0, W.rim * facing(RIM_AT, rimN) * 0.45);
    SA.aMisc.setXYZ(G_RIM, 1.1, 0, 0);
    // the thread's head
    if (W.thread > 0.001) { path.at(T.s1, _v1); deck.localToWorld(_v1); } else _v1.set(0, -50, 0);
    SA.aPos.setXYZ(G_HEAD, _v1.x, _v1.y, _v1.z);
    SA.aCol.setXYZW(G_HEAD, 1.0, 0.82, 0.5, W.head * W.thread);
    SA.aMisc.setXYZ(G_HEAD, 0.3, 0, 0);
    // a glint just off each print's top corner as it settles (outside the image, on the paper's edge)
    for (let i = 0; i < 2; i++) {
      const c = cards[i];
      if (!c) { SA.aCol.setXYZW(G_CARD + i, 0, 0, 0, 0); continue; }
      const o = c.mesh, a = i === 0 ? W.glint0 : W.glint1;
      _v1.set(c.w * 0.5, c.h * 0.5, 0.004).applyMatrix4(o.matrixWorld);
      SA.aPos.setXYZ(G_CARD + i, _v1.x, _v1.y, _v1.z);
      SA.aCol.setXYZW(G_CARD + i, 1.0, 0.92, 0.75, o.visible && deck.visible ? a * 1.4 : 0);
      SA.aMisc.setXYZ(G_CARD + i, 0.16, 1, 0.2 + t * 0.3);
    }
    _v1.set(0.012, 0.012, 0.131).applyMatrix4(head.matrixWorld);
    SA.aPos.setXYZ(G_LENS, _v1.x, _v1.y, _v1.z);
    SA.aCol.setXYZW(G_LENS, 1.0, 0.95, 0.85, W.lensGlint * 1.2);
    SA.aMisc.setXYZ(G_LENS, 0.09, 1, 0.5);
    SA.aPos.needsUpdate = SA.aCol.needsUpdate = SA.aMisc.needsUpdate = true;
  }

  function update(dt, t) {
    if (held) {
      if (fresh <= 0) return;
      fresh--; t = heldT; dt = 0;
    }
    placeTripod();
    // the clapper's hinge (W.clap: 1 open … 0 shut)
    arm.rotation.z = W.clap * 0.52;
    updateCards(dt, t);
    updateCamera(dt, t);
    scene.updateMatrixWorld();
    overlay.updateMatrixWorld();
    // the thread
    strand.uniforms.uOpacity.value = W.thread;
    strand.uniforms.uRing.value = W.ring;
    strand.uniforms.uWidth.value = W.width;
    if (W.thread > 0.001) strand.update(path, T.s0, Math.max(T.s0 + 0.05, T.s1), t, STRAND_OPTS);
    strand.mesh.visible = W.thread > 0.001;
    writeSparks(t);
    // lights & air (the studio only: the prints are in the overlay, untouched by all of this)
    const fl = W.flash;
    key.intensity = 34 * W.key;
    fill.intensity = 10 * W.fill;
    rim.intensity = 30 * W.rim;
    lamp.intensity = 9 * W.lamp;
    flash.position.copy(FLASH_FACE).applyMatrix4(head.matrixWorld);
    flash.intensity = 60 * fl + 26 * W.soft;
    hemi.intensity = W.hemi;
    panelU.uL.value[0] = 3.2 * W.key; panelU.uL.value[1] = 2.2 * W.fill; panelU.uL.value[2] = 2.8 * W.rim;
    panelU.uL.value[3] = 0.05 + 9 * fl + 2 * W.soft; panelU.uL.value[4] = 0.25 + 0.6 * W.lcd;
    sweepMat.emissiveIntensity = 0.42 * W.back;
    beamU.uLevel.value.set(0.06 * W.beam * W.key, 0.05 * W.beam * W.rim);
    bokehMat.uniforms.uTime.value = t; bokehMat.uniforms.uBright.value = W.bokeh;
    dustU.uTime.value = t; dustU.uBright.value = W.dust;
    api.exposure = W.exposure;
  }

  function resize({ aspect }) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- shots
  const portrait = () => (env.size?.aspect ?? 1.6) < 0.8;
  const LN = Math.log;
  /**
   * A print framed whole, flat to the camera (straight down its normal), large, above the subtitle
   * band and clear of the progress dots: the image fills ~64% of the height (or 80–86% of the width).
   */
  function framePrints(list) {
    const b = printsBox(list);
    _v1.set(b.cx, b.cy, 0).applyQuaternion(deckQ).add(deckBase);
    return { x: _v1.x, y: _v1.y, z: _v1.z, az: DECK_YAW, el: 0, lh: LN(b.hh / 0.64), lw: LN(b.hw / (portrait() ? 0.86 : 0.8)), fov: 30, lift: 0.18, breath: 0.12, dk: 0 };
  }
  function shot(name) {
    const p = portrait();
    switch (name) {
      // (through the gap between the chairs; on a wide screen the slate sits high, clear of the words)
      case 'slate': return { x: SLATE_C.x, y: SLATE_C.y + 0.02, z: SLATE_C.z, az: 0.3, el: -0.05, lh: LN(p ? 0.2 : 0.24), lw: LN(0.205), fov: 30, lift: p ? -0.08 : 0.1, breath: 0.3, dk: 0 };
      case 'slate2': return { x: SLATE_C.x + 0.03, y: SLATE_C.y + 0.04, z: SLATE_C.z, az: 0.2, el: -0.02, lh: LN(p ? 0.25 : 0.27), lw: LN(0.25), fov: 30, lift: p ? -0.04 : 0.2, breath: 0.3 };
      case 'chairs': return { x: -0.05, y: 0.82, z: 4.6, az: 0.04, el: 0.2, lh: LN(0.55), lw: LN(p ? 0.98 : 1.0), fov: 32, lift: -0.1, breath: 0.4 };
      case 'establish': return { x: 0, y: 1.05, z: 2.2, az: 0.02, el: 0.12, lh: LN(1.45), lw: LN(p ? 1.25 : 2.2), fov: 34, lift: 0.02, breath: 0.6 };
      // the set, ready and empty: the two tape marks in the key light, the camera on its tripod
      // (over the photographer's shoulder: the camera's lit screen in front, the empty marks beyond)
      case 'set': return p
        ? { x: 0, y: 0.9, z: 1.6, az: 0.2, el: 0.12, lh: -0.1, lw: -0.6, fov: 32, lift: 0.06, breath: 0.5, dk: 0 }
        : { x: -0.06, y: 0.95, z: 1.35, az: 0.34, el: 0.13, lh: LN(0.85), lw: LN(1.45), fov: 30, lift: 0.05, breath: 0.5, dk: 0 };
      case 'hero0': return framePrints([cards[0]]);
      case 'hero1': return framePrints([cards[N > 1 ? 1 : 0]]);
      case 'pair': return framePrints(cards);
      case 'cards': { const f = framePrints(cards); return { ...f, lh: f.lh + 0.32, lw: f.lw + 0.32, y: f.y + 0.12, lift: 0.1, breath: 0.3, dk: 0.7 }; }
      case 'wide': return { x: 0, y: 1.6, z: 1.6, az: 0.08, el: 0.3, lh: LN(5.2), lw: LN(5.6), fov: 60, lift: 0, breath: 0, dk: 0 };
      default: return {};
    }
  }
  const applyShot = (name) => Object.assign(cam, { dk: 0, breath: 0.5 }, shot(name));

  /** A print is born at the lens (deck space), small and edge-on. */
  function bear(i) {
    const c = cards[i];
    deck.position.copy(deckBase); deck.quaternion.copy(deckQ); deck.scale.setScalar(1); deck.updateMatrixWorld();
    _v1.copy(LENS).applyMatrix4(head.matrixWorld);
    c.from.copy(deck.worldToLocal(_v1));
    c.fromE.set(-0.6, i === 0 ? 0.9 : -0.9, i === 0 ? 0.4 : -0.35);
    c.spin = i === 0 ? TAU : -TAU;
    c.k = 0; c.s0 = 0.2;
    c.mesh.visible = true;
    c.u.uDevelop.value = 0; c.u.uGlow.value = 0; c.u.uFade.value = 1;
  }

  // ---------------------------------------------------------------- choreography helpers
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
  const moveTo = (name, duration, ease = 'sine.inOut', extra = {}) => tw(cam, { ...shot(name), duration, ease, ...extra });
  const lines = (k) => (env.T[k] || []).map((l) => env.fill(l)).filter(Boolean);
  const say = (k, o = {}) => { const l = lines(k); return l.length ? env.narrate(l, { style: 'hand', ...o }) : wait(o.empty ?? 2.5); };

  /** Every knob where a beat begins (the dev jump; the warm-up). */
  function snap(beat) {
    const i = Math.max(0, ORDER.indexOf(beat));
    const lit = i >= 1 ? 1 : 0;
    Object.assign(W, {
      key: i >= 1 ? 1 : 0.12, fill: lit, rim: lit, back: lit, lamp: i >= 1 ? 0.55 : 1, hemi: i >= 1 ? 0.16 : 0.08, ready: 1, blink: 1, flash: 0, soft: 0, glare: 0, lcd: i >= 2 ? 1 : 0,
      dust: i >= 1 ? 1 : 0.35, bokeh: i >= 1 ? 0.8 : 0.5, beam: lit, exposure: 1, clap: i === 0 ? 1 : 0, thread: 0, ring: 0, width: 0.32, head: 0, lensGlint: 0,
      glint0: 0, glint1: 0, deckLift: 0, deckBack: 0, deckScale: 1, sway: 1,
    });
    P.ang = SHOT_ANG[0]; P.h = SHOT_H[0];
    T.s0 = 0; T.s1 = 0;
    // the prints already made by this beat, developed and in their slots
    cards.forEach((c, k) => {
      const has = k === 0 ? i >= ORDER.indexOf('shot2') : i >= ORDER.indexOf('after');
      c.mesh.visible = has; c.k = 1; c.s0 = 1; c.spin = 0; c.from.copy(c.slot); c.fromE.set(0, 0, c.slotRz);
      c.u.uDevelop.value = has ? 1 : 0; c.u.uGlow.value = 0; c.u.uFade.value = 1;
    });
    deck.visible = cards.some((c) => c.mesh.visible);
    const after = N > 1 ? 'pair' : 'hero0';
    applyShot({ slate: 'slate', lights: 'establish', set: 'set', shot1: 'set', shot2: 'hero0', after, cards: after }[ORDER[i]]);
  }

  // ---------------------------------------------------------------- the flash (on the studio only)
  function fire(dir) {
    env.sfx('shutter');
    if (reduced) {
      // a soft fade, no strobe: the studio's light swells gently and settles
      tw(W, { soft: 1, exposure: 1.1, duration: 0.5, ease: 'sine.inOut' });
      later(0.55, () => tw(W, { soft: 0, exposure: 1, duration: 0.9, ease: 'sine.inOut' }));
      return;
    }
    W.flash = 1; W.glare = 1; W.exposure = 1.45; W.ready = 0; W.lensGlint = 1;
    later(0.03, () => env.sfx('flashPop'));
    tw(W, { flash: 0, duration: 0.5, ease: 'power2.out' });
    tw(W, { glare: 0, lensGlint: 0, duration: 0.7, ease: 'power2.out' });
    tw(W, { exposure: 1, duration: 0.8, ease: 'power2.out' });
    tw(W, { ready: 1, duration: 0.3, delay: 2.4 });
    // the short white bloom of the flash
    dir.veil(0.32, { duration: 0.05, color: '#fff7ec', ease: 'power1.out' }).then(() => dir.veil(0, { duration: 0.55, ease: 'power2.out' })).catch(() => {});
  }
  /** The print flies out of the lens to its slot and develops into the image. */
  function print(i, { dur = 2.4 } = {}) {
    bear(i);
    const c = cards[i];
    tw(c, { k: 1, duration: dur, ease: 'power2.out' });
    tw(c.u.uDevelop, { value: 1, duration: 3.2, delay: 0.5, ease: 'sine.inOut' });
    later(dur * 0.7, () => tw(W, { [i === 0 ? 'glint0' : 'glint1']: 1, duration: 0.25, ease: 'sine.out', onComplete: () => tw(W, { [i === 0 ? 'glint0' : 'glint1']: 0, duration: 0.9 }) }));
  }

  // ---------------------------------------------------------------- the beats
  const beats = {
    // from black: the clapperboard in the dark studio; it claps; the words
    async slate(dir) {
      env.mood('hush');
      dir.veil(0, { duration: 1.8 });
      moveTo('slate2', 6.2, 'sine.inOut');
      tw(W, { lamp: 1, duration: 1.6, ease: 'sine.out' });
      tw(W, { key: 0.12, duration: 2.5, delay: 0.4 });
      // the clap: the stick snaps shut, a tiny bounce
      later(1.9, () => env.to(W, { clap: 0, duration: 0.17, ease: 'power3.in', onComplete: () => { env.sfx('tap'); env.to(W, { clap: 0.05, duration: 0.07, yoyo: true, repeat: 1, ease: 'sine.out' }); } }));
      await wait(2.5);
      const said = say('nivinIntro');
      said.catch(() => {});
      await wait(2.1);
      return { said };
    },
    // the lights come up; over the two empty chairs to the set
    async lights(dir, carry) {
      env.mood('festive');
      tw(W, { key: 1, duration: 1.2, ease: 'power2.out' });
      tw(W, { beam: 1, dust: 1, duration: 2.4 });
      tw(W, { fill: 1, duration: 1.0, delay: 0.7, ease: 'power2.out' });
      tw(W, { rim: 1, duration: 1.0, delay: 1.3, ease: 'power2.out' });
      tw(W, { back: 1, hemi: 0.16, bokeh: 0.8, duration: 1.6, delay: 1.7, ease: 'sine.inOut' });
      tw(W, { lamp: 0.55, duration: 2.5, delay: 2.5 });
      env.timeline().to(cam, { ...shot('chairs'), duration: 2.9, ease: 'power2.inOut', overwrite: 'auto' }).to(cam, { ...shot('establish'), duration: 2.8, ease: 'sine.inOut' });
      await wait(3.4);
      if (carry?.said) await carry.said;
      await wait(1.0);
    },
    // the set, ready and empty: the marks in the key light; the camera's screen lights; the words
    async set() {
      moveTo('set', 3.4, 'sine.inOut');
      tw(W, { lcd: 1, duration: 0.8, delay: 0.6 });
      W.blink = 0;
      await wait(1.0);
      await say('nivinLines');
      await wait(0.3);
    },
    // flash! a print flies out to us and develops; then it is held, whole and flat to the camera
    async shot1(dir) {
      fire(dir);
      await wait(0.35);
      deck.visible = true;
      for (const c of cards) c.mesh.visible = false;
      print(0);
      moveTo('hero0', 2.6, 'power2.inOut');
      later(2.9, () => env.sfx('chime'));
      await wait(3.8 + 3.2);
    },
    // a second flash (the studio behind the first print lights up), a second print beside it
    async shot2(dir) {
      W.blink = 0;
      moveTo('pair', 1.4, 'sine.inOut');
      await wait(0.6);
      fire(dir);
      await wait(0.35);
      print(1);
      // (a wide screen holds both prints large; a tall one frames the new print on its own)
      moveTo(portrait() ? 'hero1' : 'pair', 2.6, 'power2.inOut');
      later(3.0, () => env.sfx('chime'));
      await wait(3.8 + 3.2);
    },
    // the words, over the print(s)
    async after() {
      moveTo(N > 1 ? 'pair' : 'hero0', 2.2, 'sine.inOut');
      await wait(0.8);
      await say('nivinAfter');
      await wait(0.6);
    },
    // the borders glow into memory cards; the thread wraps them; they float up and away
    async cards(dir) {
      env.mood('wonder');
      moveTo('cards', 5.6, 'sine.inOut');
      cards.forEach((c, i) => tw(c.u.uGlow, { value: 1, duration: 1.4, delay: 0.2 * i, ease: 'sine.inOut' }));
      later(0.4, () => env.sfx('shimmer'));
      T.s0 = 0; T.s1 = 0.02;
      tw(W, { thread: 1, head: 1, duration: 0.6, ease: 'sine.out' });
      tw(T, { s1: path.sLoop, duration: 2.6, delay: 0.3, ease: 'sine.inOut' });
      tw(T, { s0: path.sLoop0 * 0.85, duration: 2.6, delay: 0.6, ease: 'sine.inOut' });
      later(2.9, () => env.sfx('chime'));
      // …and away
      later(3.0, () => {
        tw(W, { deckLift: 1.5, deckBack: 1.4, deckScale: 0.75, duration: 3.2, ease: 'power2.in' });
        tw(T, { s1: path.length, duration: 2.8, ease: 'power1.in' });
        env.sfx('whoosh');
      });
      await wait(4.9);
      await dir.veil(1, { duration: 1.0, color: NIGHT });
    },
  };

  async function playReduced(dir) {
    // the same story in a few calm shots joined by soft veil cuts; soft swells instead of flashes
    snap('slate'); W.clap = 0; W.key = 0.12;
    await wait(0.2);
    await dir.veil(0, { duration: 1.0 });
    env.sfx('tap');
    await say('nivinIntro');
    await dir.veil(1, { duration: 0.6 });
    snap('set'); cam.breath = 0;
    env.mood('festive');
    await wait(0.2);
    await dir.veil(0, { duration: 0.8 });
    await say('nivinLines');
    for (let i = 0; i < N; i++) {
      fire(dir);
      await wait(1.0);
      await dir.veil(1, { duration: 0.6 });
      deck.visible = true;
      cards.forEach((c, k) => {
        c.mesh.visible = k <= i; c.k = 1; c.s0 = 1; c.spin = 0; c.from.copy(c.slot); c.fromE.set(0, 0, c.slotRz);
        if (k === i) c.u.uDevelop.value = 0;
      });
      applyShot(`hero${i}`); cam.breath = 0;
      await wait(0.2);
      await dir.veil(0, { duration: 0.7 });
      env.to(cards[i].u.uDevelop, { value: 1, duration: 2.4, ease: 'sine.inOut' });
      later(1.8, () => env.sfx('chime'));
      await wait(2.6 + 3.0);
    }
    if (N > 1) {
      await dir.veil(1, { duration: 0.5 });
      applyShot('pair'); cam.breath = 0;
      await wait(0.2);
      await dir.veil(0, { duration: 0.6 });
    }
    await say('nivinAfter');
    env.mood('wonder');
    cards.forEach((c, i) => env.to(c.u.uGlow, { value: 1, duration: 1.4, delay: 0.2 * i }));
    W.sway = 0.2;
    T.s0 = 0; T.s1 = 0.02;
    tw(W, { thread: 1, head: 1, duration: 0.6 });
    tw(T, { s1: path.sLoop, duration: 2.8, ease: 'sine.inOut' });
    tw(T, { s0: path.sLoop0 * 0.85, duration: 2.8, delay: 0.3, ease: 'sine.inOut' });
    later(2.6, () => env.sfx('chime'));
    await wait(3.4);
    await dir.veil(1, { duration: 0.9, color: NIGHT });
  }

  async function play(dir) {
    const params = dev ? new URLSearchParams(location.search) : null;
    const at = params ? params.get('at') : null;
    const i0 = at && BEATS.includes(at) ? BEATS.indexOf(at) : 0;
    if (dev) {
      api.dev.beat = BEATS[i0]; api.dev.t0 = performance.now();
      const list = (params.get('holds') || params.get('hold') || '').split(',').map(parseFloat).filter((x) => x >= 0);
      list.forEach((h) => later((i0 > 0 ? 0.35 : 0) + h, () => { env.gsap.globalTimeline.pause(); held = true; heldT = env.time; fresh = 3; api.dev.held = true; api.dev.holdAt = h; }));
      api.dev.resume = () => { held = false; api.dev.held = false; env.gsap.globalTimeline.resume(); };
      api.dev.snap = snap; api.dev.shot = shot;
      api.dev.look = (o) => { Object.assign(cam, o); fresh = 3; };
    }
    if (reduced) { await playReduced(dir); if (dev) api.dev.beat = 'done'; return; }
    snap(BEATS[i0]);
    if (i0 > 0) { env.mood(BEATS[i0] === 'cards' ? 'wonder' : 'festive'); await dir.veil(0, { duration: 0.3 }); }
    let carry = null;
    for (let i = i0; i < BEATS.length; i++) {
      env.guard();
      if (dev) api.dev.beat = BEATS[i];
      carry = (await beats[BEATS[i]](dir, carry)) || null;
    }
    if (dev) api.dev.beat = 'done';
  }

  function dispose() {
    strand.dispose();
    key.shadow?.map?.dispose();
    for (const x of own) { try { x.dispose(); } catch (e) { /* ignore */ } }
    own.clear();
    scene.clear();
    overlay.clear();
  }

  // ---------------------------------------------------------------- the warm-up
  // every print, developed, with the thread, so the warm-up compiles and uploads all of it (the
  // overlay is warmed up by the shell for the screen, where it is drawn); play() starts from snap()
  snap('cards');
  for (const c of cards) { c.mesh.visible = true; c.u.uDevelop.value = 0.5; }
  deck.visible = true;
  W.thread = 1; W.head = 1; T.s1 = path.sLoop;
  applyShot('wide');
  update(1 / 60, 0);
  deck.visible = false;
  overlay.visible = true; // (compiled whole by the shell's warm-up; play() sets it per frame)
  return api;
}
