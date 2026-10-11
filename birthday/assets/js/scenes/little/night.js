// "The Little Things" · movement 3 — night: her nostalgic side, and the chapter's last movement.
//
// Inspired by the *feeling* of Twinkling Watermelon — youth, friendship, music, time, ordinary days
// becoming precious — and copying nothing from it (no scene, character, place, shot, artwork or
// music). An original quiet street at night: low buildings with warm windows, sodium street lamps
// with pools of light and soft halos, utility poles and sagging wires against an indigo sky of stars
// and soft clouds, the town's glow far away, a damp road that catches every light, a little fog.
// One small neon sign on a wall: a watermelon slice and a music note in pink and green tubes (no
// words). By a bench under a lantern: an acoustic guitar, a cassette with a handwritten label
// (T.cassette, '' = a plain label), wired headphones and a small slice of watermelon on a plate.
//
//   n1  the warm veil opens on darkness: the warm light drifts away down the street — one far lamp
//   n2  the camera moves forward; the lamps come on one by one toward us; the street appears
//   n3  fireflies drift through the air
//   n4  the bench: the lantern comes on — the guitar and her things in warm light; the neon flickers on
//   n5  a strum: a ring of light travels out through the street, the fireflies brighten
//   n6  the camera follows the ring down the street
//   n7  glowing memory points appear along the way
//   n8  each lights in turn: its real photo, a polaroid that develops, and the owner's own words
//   n9  the golden thread runs from the guitar through every memory
//   n10 the camera rises (crane up): the whole street
//   n11 the memory trail glows; the closing lines, in handwriting
//   n12 the thread rises into the night sky — held there, the veil open (the shell offers "Keep going")
//
// The memories are the owner's (env.memories): their words verbatim, one of their own linked photos
// each. Nothing is invented and no image of her is made up. Contract: ./kit.js. Every material,
// mesh and texture is made in build(); update() only writes transforms, attributes and uniforms.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createStrand, PathSampler, createRig, textTexture, photoTexture, rng, TAU, clamp, smooth, lerp } from './kit.js';
import { readsRomantic } from '../../shared/model.js';

const DEG = Math.PI / 180;
const CUT = '#05040c'; // the colour of a soft cut (the veil may still be the Sprite's warm gold)
const BEATS = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10', 'n11', 'n12'];

// ------------------------------------------------------------------ the street (metres)
// The road runs along −z; the bench is on the right-hand pavement (+x), facing the road.
const ROAD = 3.4;         // half the carriageway
const CURB = 0.14;        // pavement height
const FACE = 5.7;         // building fronts at x = ±FACE
const Z0 = 34, Z1 = -100; // the street's extent
const BENCH = { x: 5.0, z: 0.7, len: 1.7 };
const SEAT = CURB + 0.45;
const LANTERN = new THREE.Vector3(4.38, CURB + 3.0, 2.15); // the bench's lantern — the key light
const LAMP_H = 5.0;
const LAMPS = [9, -5.5, -15.5, -25.5, -35.5, -45.5, -55.5, -65.5].map((z, i) => {
  const s = i % 2 ? 1 : -1;
  const x = s * (ROAD + 0.42);
  return { s, x, z, head: new THREE.Vector3(x - s * 1.08, CURB + LAMP_H - 0.08, z) };
});
const FAR = LAMPS.length - 1; // the one distant light of the opening
const POLES = [17, 3.5, -12.8, -29.5, -40.5, -57, -73, -89];
const NEON = { x: FACE - 0.05, y: CURB + 1.9, z: BENCH.z + 0.08 };
const CARD_W = 0.88, CARD_H = 1.06, CARD_TOP = 0.16, PHOTO = 0.76;
// analytic light sources every surface shader shares: 0–7 street lamps, 8 the lantern,
// 9/10 the neon's pink and green, 11… the memories
const NL = 16, L_LANTERN = 8, L_PINK = 9, L_GREEN = 10, L_MEM = 11;
const SODIUM = [1.0, 0.52, 0.2], LANTERN_C = [1.0, 0.62, 0.3], PINK = [1.0, 0.28, 0.62], GREEN = [0.3, 1.0, 0.5], GOLD = [1.0, 0.72, 0.36];
// photos whose own words suggest romance are passed over when the memory has another one (shared/model.js)

// ------------------------------------------------------------------ small helpers
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c, { srgb = true, aniso = 4, wrap = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}
/** Draw something that may cross a tiling texture's edge on every side it crosses. */
function wrapped(W, H, x, y, r, fn) {
  for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) if (x + dx + r > 0 && x + dx - r < W && y + dy + r > 0 && y + dy - r < H) fn(x + dx, y + dy);
}
const hash1 = (n) => { const x = Math.sin(n * 12.9898 + 4.1414) * 43758.5453; return x - Math.floor(x); };

/** Non-indexed, with uv (and a vertex colour) — so any of them merge together. */
function prep(g, color = null) {
  const h = g.index ? g.toNonIndexed() : g;
  if (h !== g) g.dispose();
  const n = h.attributes.position.count;
  if (!h.attributes.normal) h.computeVertexNormals();
  if (!h.attributes.uv) h.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (color != null) {
    const c = color.isColor ? color : new THREE.Color(color);
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    h.setAttribute('color', new THREE.BufferAttribute(a, 3));
  }
  for (const k of Object.keys(h.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) h.deleteAttribute(k);
  h.clearGroups();
  return h;
}
function merge(list) { const m = mergeGeometries(list, false); for (const g of list) g.dispose(); return m; }
/** World-space box-mapped UVs (metres × k): up-facing (x, z), sides (z or x, y). */
function worldUV(g, k = 1) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, p.getX(i) * k, p.getZ(i) * k);
    else if (ax >= az) uv.setXY(i, p.getZ(i) * k, p.getY(i) * k);
    else uv.setXY(i, p.getX(i) * k, p.getY(i) * k);
  }
  return g;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cyl = (rt, rb, h, seg, x, y, z) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y, z);
/** A thin cylinder from a to b. */
function rod(a, b, r, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg, 1);
  const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1));
  return g.applyMatrix4(m);
}
/** A sagging wire between two points (a parabola is a catenary's twin at these sags). */
function wire(a, b, sag, r = 0.013) {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0))); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 4, false);
}

// ------------------------------------------------------------------ painted textures
function paintAsphalt(S, R) {
  const c = cnv(S, S), g = c.getContext('2d'), k = S / 1024;
  g.fillStyle = '#27272c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    const x = R() * S, y = R() * S, r = S * (0.04 + R() * 0.16), light = R() < 0.5;
    wrapped(S, S, x, y, r, (px, py) => {
      const gr = g.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, light ? 'rgba(78,76,84,0.17)' : 'rgba(6,6,10,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 30; d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.05; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < S * 3; i++) {
    const x = R() * S, y = R() * S, r = (0.5 + R() * R() * 2.2) * k;
    g.fillStyle = R() < 0.55 ? `rgba(150,146,150,${0.12 + R() * 0.28})` : `rgba(4,4,6,${0.3 + R() * 0.4})`;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  g.lineCap = 'round';
  for (let j = 0; j < 9; j++) { // cracks and tar seams
    let x = S * (0.1 + R() * 0.8), y = S * (0.1 + R() * 0.8), a = R() * TAU;
    g.strokeStyle = `rgba(6,6,8,${0.45 + R() * 0.35})`; g.lineWidth = (0.8 + R() * 1.6) * k;
    g.beginPath(); g.moveTo(x, y);
    const n = 6 + Math.floor(R() * 14);
    for (let i = 0; i < n; i++) { a += (R() - 0.5) * 0.9; x += Math.cos(a) * S * 0.012; y += Math.sin(a) * S * 0.012; g.lineTo(x, y); }
    g.stroke();
  }
  return c;
}

/** Roughness (green channel): damp asphalt, with smoother puddles. */
function paintWet(S, R) {
  const c = cnv(S, S), g = c.getContext('2d');
  g.fillStyle = 'rgb(150,150,150)'; g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 11; i++) {
    const cx = R() * S, cy = R() * S, base = S * (0.03 + R() * 0.07);
    for (let j = 0; j < 6; j++) {
      const x = cx + (R() - 0.5) * base * 2.4, y = cy + (R() - 0.5) * base * 1.3, r = base * (0.45 + R() * 0.7);
      wrapped(S, S, x, y, r, (px, py) => {
        const gr = g.createRadialGradient(px, py, 0, px, py, r);
        gr.addColorStop(0, 'rgba(22,22,22,0.95)'); gr.addColorStop(0.55, 'rgba(34,34,34,0.8)'); gr.addColorStop(1, 'rgba(150,150,150,0)');
        g.fillStyle = gr; g.fillRect(px - r, py - r, r * 2, r * 2);
      });
    }
  }
  return c;
}

/** Square paving slabs, 4 × 4 per tile (the tile is 2 m). */
function paintPaving(S, R) {
  const c = cnv(S, S), g = c.getContext('2d'), n = 4, t = S / n;
  g.fillStyle = '#3c3a3a'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = 128 + Math.floor((R() - 0.5) * 34), w = v + Math.floor((R() - 0.5) * 8);
      g.fillStyle = `rgb(${v},${w - 4},${w - 8})`;
      g.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
      const gr = g.createLinearGradient(i * t, j * t, i * t + t, j * t + t);
      gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.1)');
      g.fillStyle = gr; g.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
    }
  }
  for (let i = 0; i < S * 6; i++) {
    g.fillStyle = R() < 0.5 ? `rgba(255,250,240,${R() * 0.1})` : `rgba(0,0,0,${R() * 0.18})`;
    g.fillRect(R() * S, R() * S, 1.5, 1.5);
  }
  for (let i = 0; i < 5; i++) { // old stains
    const x = R() * S, y = R() * S, r = t * (0.2 + R() * 0.5);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(20,16,14,0.22)'); gr.addColorStop(1, 'rgba(20,16,14,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

/** Painted plaster (neutral: the vertex colour gives each building its own). */
function paintPlaster(S, R) {
  const c = cnv(S, S), g = c.getContext('2d');
  g.fillStyle = '#c4beb6'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const x = R() * S, y = R() * S, r = S * (0.05 + R() * 0.18), light = R() < 0.5;
    wrapped(S, S, x, y, r, (px, py) => {
      const gr = g.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, light ? 'rgba(255,250,240,0.12)' : 'rgba(60,50,45,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  for (let i = 0; i < 14; i++) { // faint rain streaks from sills and ledges (soft at the sides)
    const x = R() * S, y = R() * S * 0.8, w = 14 + R() * 30, h = S * (0.1 + R() * 0.25);
    const a = 0.035 + R() * 0.05;
    for (let k = 0; k < w; k += 2) {
      const f = Math.sin((k / w) * Math.PI);
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, `rgba(50,42,38,${(a * f).toFixed(3)})`); gr.addColorStop(1, 'rgba(50,42,38,0)');
      g.fillStyle = gr; g.fillRect(x + k, y, 2, h);
    }
  }
  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 16; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  return c;
}

/** Wood with its grain along u. */
function paintWood(W, H, R, { base, dark, light, lines = 70, knots = 2 }) {
  const c = cnv(W, H), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < lines; i++) {
    const y0 = R() * H, amp = 2 + R() * 6, f = 0.004 + R() * 0.01, ph = R() * TAU;
    g.strokeStyle = R() < 0.6 ? dark : light;
    g.globalAlpha = 0.12 + R() * 0.3;
    g.lineWidth = 0.6 + R() * 2.2;
    g.beginPath();
    for (let x = 0; x <= W; x += 8) { const y = y0 + Math.sin(x * f + ph) * amp; x === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < knots; i++) {
    const x = R() * W, y = R() * H, r = 4 + R() * 8;
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.5);
    gr.addColorStop(0, dark); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.5; g.fillStyle = gr; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); g.globalAlpha = 1;
  }
  return c;
}

/**
 * Windows atlas, 4 × 2 cells: 0 curtains · 1 blinds · 2 a plant on the sill · 3 a cool room
 * (a television) · 4 dark (a little sky in the glass) · 5 a pendant lamp and shelves · 6 a
 * shop's window · 7 a half-closed shutter with light underneath. Alpha = glass (the frame is 0).
 */
function paintWindows(R) {
  const CW = 256, c = cnv(CW * 4, CW * 2), g = c.getContext('2d');
  const cell = (k, fn) => {
    g.save();
    g.translate((k % 4) * CW, (1 - Math.floor(k / 4)) * CW); // (flipY: atlas row 0 is the canvas's lower half)
    g.beginPath(); g.rect(0, 0, CW, CW); g.clip();
    fn();
    g.restore();
  };
  const room = (top, bot) => { const gr = g.createLinearGradient(0, 0, 0, CW); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, CW, CW); };
  const glow = (x, y, r, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,220,170,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
  const sil = 'rgba(46,26,16,0.86)';
  const frame = (bar = 14, mullions = 1) => {
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    g.fillRect(0, 0, CW, bar); g.fillRect(0, CW - bar * 1.3, CW, bar * 1.3); g.fillRect(0, 0, bar, CW); g.fillRect(CW - bar, 0, bar, CW);
    for (let i = 1; i <= mullions; i++) g.fillRect((CW * i) / (mullions + 1) - bar * 0.4, 0, bar * 0.8, CW);
    g.restore();
    // a soft inner shadow along the frame (reads as depth)
    g.save();
    g.globalCompositeOperation = 'source-atop';
    const sh = g.createLinearGradient(0, bar, 0, bar + 34);
    sh.addColorStop(0, 'rgba(30,16,10,0.45)'); sh.addColorStop(1, 'rgba(30,16,10,0)');
    g.fillStyle = sh; g.fillRect(0, bar, CW, 34);
    g.restore();
  };
  cell(0, () => { // curtains
    room('#ffe9c4', '#e2aa70'); glow(128, 80, 120, 'rgba(255,240,200,0.9)');
    for (const [x0, x1] of [[10, 98], [158, 246]]) {
      g.fillStyle = '#f0d4a0'; g.fillRect(x0, 0, x1 - x0, CW);
      for (let x = x0; x < x1; x += 11) { g.fillStyle = `rgba(150,96,50,${0.12 + R() * 0.16})`; g.fillRect(x, 0, 4 + R() * 3, CW); }
    }
    frame();
  });
  cell(1, () => { // blinds
    room('#ffdcae', '#e8ab6c'); glow(90, 150, 140, 'rgba(255,236,190,0.7)');
    for (let y = 8; y < CW; y += 12) { g.fillStyle = 'rgba(120,70,32,0.5)'; g.fillRect(0, y, CW, 3); g.fillStyle = 'rgba(255,245,220,0.35)'; g.fillRect(0, y + 3, CW, 1); }
    frame();
  });
  cell(2, () => { // a plant on the sill
    room('#ffe6bc', '#d99c60'); glow(170, 70, 130, 'rgba(255,238,200,0.85)');
    g.fillStyle = sil; g.fillRect(0, CW - 46, CW, 14);
    g.beginPath(); g.moveTo(48, CW - 46); g.lineTo(96, CW - 46); g.lineTo(90, CW - 84); g.lineTo(54, CW - 84); g.closePath(); g.fill();
    for (let i = 0; i < 9; i++) {
      g.save(); g.translate(72, CW - 84); g.rotate(-1.4 + i * 0.35); g.beginPath(); g.ellipse(0, -34 - R() * 16, 9, 30, 0, 0, TAU); g.fill(); g.restore();
    }
    frame();
  });
  cell(3, () => { // a cool room, a television's light
    room('#d6e4ff', '#8aa2d8'); glow(150, 140, 120, 'rgba(235,245,255,0.8)');
    g.fillStyle = 'rgba(20,24,44,0.85)'; g.fillRect(0, CW - 70, CW, 70); g.beginPath(); g.ellipse(70, CW - 70, 70, 26, 0, Math.PI, TAU); g.fill();
    frame();
  });
  cell(4, () => { // dark glass
    room('#1d2438', '#0c1120');
    g.fillStyle = 'rgba(140,160,220,0.14)';
    g.beginPath(); g.moveTo(40, 0); g.lineTo(110, 0); g.lineTo(30, CW); g.lineTo(-40, CW); g.closePath(); g.fill();
    frame();
  });
  cell(5, () => { // a pendant lamp and a bookshelf
    room('#ffdfb4', '#c98d56');
    g.strokeStyle = 'rgba(40,24,14,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(110, 0); g.lineTo(110, 70); g.stroke();
    glow(110, 96, 110, 'rgba(255,246,214,0.95)');
    g.fillStyle = '#fff3d4'; g.beginPath(); g.moveTo(92, 70); g.lineTo(128, 70); g.lineTo(140, 92); g.lineTo(80, 92); g.closePath(); g.fill();
    g.fillStyle = sil; g.fillRect(176, 60, 70, 8); g.fillRect(176, 120, 70, 8); g.fillRect(176, 180, 70, 8);
    for (let s = 0; s < 3; s++) for (let x = 180; x < 240; x += 7 + R() * 5) { g.fillStyle = `rgba(${60 + R() * 80},${30 + R() * 40},${20 + R() * 30},0.85)`; g.fillRect(x, 60 * (s + 1) - 26 - R() * 8, 5 + R() * 3, 26 + R() * 8); }
    frame();
  });
  cell(6, () => { // a small shop's window: shelves of jars and boxes (no lettering anywhere)
    room('#fff1d2', '#e9b375'); glow(128, 60, 170, 'rgba(255,250,230,0.9)');
    const cols = ['#c75a4a', '#4f8f7a', '#e2c26a', '#8c6bb0', '#e8e0cc', '#6fa0c8', '#d98a3a'];
    for (let s = 0; s < 3; s++) {
      const y = 70 + s * 58;
      g.fillStyle = sil; g.fillRect(0, y, CW, 6);
      for (let x = 6; x < CW - 10; x += 9 + R() * 9) { g.fillStyle = cols[Math.floor(R() * cols.length)]; const h = 18 + R() * 22; g.fillRect(x, y - h, 6 + R() * 8, h); }
    }
    g.fillStyle = 'rgba(60,34,20,0.9)'; g.fillRect(0, CW - 46, CW, 46);
    frame(10, 2);
  });
  cell(7, () => { // a shutter, half down, light beneath it
    room('#ffd9a0', '#f0b066');
    g.fillStyle = '#8f8e96'; g.fillRect(0, 0, CW, CW * 0.62);
    for (let y = 0; y < CW * 0.62; y += 9) { g.fillStyle = 'rgba(40,40,48,0.5)'; g.fillRect(0, y, CW, 2); g.fillStyle = 'rgba(230,230,240,0.25)'; g.fillRect(0, y + 2, CW, 1); }
    g.fillStyle = 'rgba(30,30,36,0.9)'; g.fillRect(0, CW * 0.62 - 6, CW, 8);
    g.fillStyle = sil; g.fillRect(0, CW - 30, CW, 30);
    frame(10, 0);
    // the shutter is not glass: half alpha marks it as a solid, unlit surface
    g.save(); g.beginPath(); g.rect(0, 0, CW, CW * 0.62); g.clip(); g.globalCompositeOperation = 'destination-in'; g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, CW, CW * 0.62); g.restore();
  });
  return c;
}

/** A distant town's silhouette for the horizon ring (alpha = blocks; red = the masts' lights). */
function paintSkyline(R) {
  const W = 1024, H = 256, c = cnv(W, H), g = c.getContext('2d');
  let x = 0;
  while (x < W) {
    const w = 14 + R() * 46, tall = R() < 0.1;
    const h = tall ? 110 + R() * 90 : 26 + R() * 64;
    g.fillStyle = '#0a0918'; g.fillRect(x, H - h, w + 1, h);
    for (let wy = H - h + 6; wy < H - 4; wy += 7) for (let wx = x + 3; wx < x + w - 3; wx += 6) {
      if (R() < 0.17) { g.fillStyle = R() < 0.8 ? `rgba(255,${190 + R() * 50},${120 + R() * 60},1)` : 'rgba(210,225,255,1)'; g.fillRect(wx, wy, 2, 2); }
    }
    if (tall) { g.fillStyle = '#0a0918'; g.fillRect(x + w / 2 - 1, H - h - 26, 2, 26); g.fillStyle = '#ff2010'; g.fillRect(x + w / 2 - 2, H - h - 28, 4, 4); }
    x += w + (R() < 0.3 ? R() * 18 : 0);
  }
  return c;
}

/** Awning cloth: pale stripes (the vertex colour gives the second colour). */
function paintAwning() {
  const c = cnv(128, 32), g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#f3ead8'; g.fillRect(i * 16, 0, 16, 32); }
  return c;
}

/** Polaroid paper. */
function paintPaper(R) {
  const S = 256, c = cnv(S, S), g = c.getContext('2d');
  g.fillStyle = '#f6f1e6'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) { g.fillStyle = R() < 0.5 ? `rgba(120,100,70,${R() * 0.05})` : `rgba(255,255,255,${R() * 0.25})`; g.fillRect(R() * S, R() * S, 1 + R() * 2, 1); }
  const v = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(120,96,60,0.12)');
  g.fillStyle = v; g.fillRect(0, 0, S, S);
  return c;
}

// the neon sign's tubes, in the sign's plane (metres): a watermelon slice and a music note
function neonPaths() {
  const arc = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * (i / n); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  const cx = -0.19, cy = 0.07;
  const flesh = arc(cx, cy, 0.185, Math.PI, TAU, 36);
  flesh.push([cx + 0.09, cy], [cx, cy], [cx - 0.09, cy]);
  const rind = arc(cx, cy, 0.25, Math.PI, TAU, 44);
  const seed = (x, y, a) => Array.from({ length: 17 }, (_, i) => {
    const t = (i / 16) * TAU, px = 0.013 * Math.sin(t) * Math.sin(t / 2), py = 0.02 * Math.cos(t);
    return [x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)];
  });
  const head = Array.from({ length: 33 }, (_, i) => {
    const t = (i / 32) * TAU, px = 0.058 * Math.cos(t), py = 0.04 * Math.sin(t), a = 0.38;
    return [0.24 + px * Math.cos(a) - py * Math.sin(a), -0.12 + px * Math.sin(a) + py * Math.cos(a)];
  });
  const stem = [[0.29, -0.1], [0.29, 0.06], [0.29, 0.24]];
  const flag = [[0.29, 0.24], [0.305, 0.19], [0.36, 0.155], [0.405, 0.1], [0.395, 0.03]];
  return {
    pink: [{ pts: flesh, closed: true }, { pts: head, closed: true }, { pts: stem, closed: false }, { pts: flag, closed: false }],
    green: [{ pts: rind, closed: false }, { pts: seed(cx - 0.085, cy - 0.075, 0.5), closed: true }, { pts: seed(cx, cy - 0.11, 0), closed: true }, { pts: seed(cx + 0.085, cy - 0.075, -0.5), closed: true }],
  };
}
function paintNeonGlow(paths) {
  const W = 512, H = 320, c = cnv(W, H), g = c.getContext('2d'), k = 320; // px per metre; the plane is 1.6 × 1.0
  const P = (p) => [W / 2 + p[0] * k, H / 2 - p[1] * k];
  const stroke = (list, col, blur, width, alpha) => {
    g.save(); g.shadowColor = col; g.shadowBlur = blur; g.strokeStyle = col; g.globalAlpha = alpha; g.lineWidth = width; g.lineJoin = g.lineCap = 'round';
    for (const { pts, closed } of list) { g.beginPath(); pts.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); if (closed) g.closePath(); g.stroke(); }
    g.restore();
  };
  for (const [blur, width, alpha] of [[60, 18, 0.35], [26, 10, 0.5], [10, 5, 0.6]]) {
    stroke(paths.pink, 'rgb(255,90,170)', blur, width, alpha);
    stroke(paths.green, 'rgb(90,255,150)', blur, width, alpha);
  }
  return c;
}

/** The guitar's spruce top: a warm sunburst, the rosette, a tortoiseshell guard, cream binding. */
function paintSpruce(outline, R) {
  const W = 512, H = 666, c = cnv(W, H), g = c.getContext('2d');
  const X = (x) => (x / 0.4 + 0.5) * W, Y = (y) => (1 - (y / 0.52 + 0.5)) * H;
  const sb = g.createRadialGradient(X(0), Y(-0.04), 20, X(0), Y(-0.02), W * 0.62);
  sb.addColorStop(0, '#f2cf8e'); sb.addColorStop(0.55, '#e0a55c'); sb.addColorStop(0.82, '#a85f2a'); sb.addColorStop(1, '#4a2410');
  g.fillStyle = sb; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 150; i++) { // fine straight grain along the length
    const x = R() * W;
    g.strokeStyle = `rgba(120,70,30,${0.05 + R() * 0.12})`; g.lineWidth = 0.6 + R() * 1.4;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (R() - 0.5) * 6, H); g.stroke();
  }
  // the rosette
  const hx = X(0), hy = Y(0.115), hr = 0.043 / 0.4 * W;
  for (const [r, col, w] of [[1.42, '#2b170c', 3], [1.33, '#f3e2bd', 2], [1.24, '#2b170c', 6], [1.15, '#f3e2bd', 1.5], [1.1, '#3a2012', 2]]) {
    g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(hx, hy, hr * r, 0, TAU); g.stroke();
  }
  for (let i = 0; i < 72; i++) { const a = (i / 72) * TAU; g.fillStyle = i % 2 ? '#c98f4a' : '#5a2f16'; g.beginPath(); g.arc(hx + Math.cos(a) * hr * 1.24, hy + Math.sin(a) * hr * 1.24, 1.6, 0, TAU); g.fill(); }
  // the guard
  g.save();
  g.beginPath(); g.moveTo(X(0.03), Y(0.06)); g.bezierCurveTo(X(0.06), Y(0.02), X(0.13), Y(0.0), X(0.135), Y(0.06)); g.bezierCurveTo(X(0.14), Y(0.12), X(0.1), Y(0.16), X(0.055), Y(0.15));
  g.arc(hx, hy, hr * 1.5, -0.35, 0.85, false); g.closePath();
  g.fillStyle = '#3a1a0c'; g.fill(); g.clip();
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${150 + R() * 60},${70 + R() * 30},20,${0.2 + R() * 0.3})`; g.beginPath(); g.ellipse(X(0.03) + R() * 60, Y(0.15) + R() * 70, 3 + R() * 9, 2 + R() * 5, R() * 3, 0, TAU); g.fill(); }
  g.restore();
  // the binding round the edge
  g.beginPath(); outline.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y)))); g.closePath();
  g.strokeStyle = '#2a1308'; g.lineWidth = 9; g.stroke();
  g.strokeStyle = '#f0dfba'; g.lineWidth = 4; g.stroke();
  return c;
}

/** Rosewood fretboard with pearl dots (u across, v from the sound hole up to the nut). */
function paintFretboard(R, frets, y0, y1) {
  const W = 64, H = 1024, c = cnv(W, H), g = c.getContext('2d');
  g.fillStyle = '#2e1b12'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '90,50,30' : '15,8,5'},${0.2 + R() * 0.3})`; g.fillRect(R() * W, 0, 1 + R() * 2, H); }
  const V = (y) => (1 - (y - y0) / (y1 - y0)) * H;
  const dot = (y, x = W / 2) => { g.fillStyle = '#efe8dc'; g.beginPath(); g.arc(x, V(y), 4.5, 0, TAU); g.fill(); };
  for (const n of [3, 5, 7, 9, 15, 17]) if (frets[n] && frets[n - 1]) dot((frets[n] + frets[n - 1]) / 2);
  if (frets[12] && frets[11]) { const y = (frets[12] + frets[11]) / 2; dot(y, W * 0.3); dot(y, W * 0.7); }
  return c;
}

/** A cassette's face, seen from above: smoky shell, a paper label in her words, the reels. */
function paintCassette(word, R) {
  const W = 640, H = 410, c = cnv(W, H), g = c.getContext('2d');
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  g.fillStyle = '#26222e'; g.fillRect(0, 0, W, H);
  const sh = g.createLinearGradient(0, 0, W, H); sh.addColorStop(0, 'rgba(255,255,255,0.08)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0.05)');
  g.fillStyle = sh; g.fillRect(0, 0, W, H);
  // the label
  rr(34, 30, W - 68, H * 0.66, 14); g.fillStyle = '#f4e8cf'; g.fill();
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(140,110,70,${R() * 0.06})`; g.fillRect(34 + R() * (W - 68), 30 + R() * H * 0.66, 2, 1); }
  // two thin stripes in watermelon colours
  g.fillStyle = '#f2a7c3'; g.fillRect(34, 30 + H * 0.66 - 44, W - 68, 9);
  g.fillStyle = '#9fc47a'; g.fillRect(34, 30 + H * 0.66 - 31, W - 68, 9);
  // ruled writing lines
  g.strokeStyle = 'rgba(120,100,140,0.25)'; g.lineWidth = 1.5;
  for (const y of [92, 128]) { g.beginPath(); g.moveTo(60, y); g.lineTo(W - 60, y); g.stroke(); }
  if (word) {
    const t = textTexture(word, { font: '600 120px "Caveat", cursive', color: '#3a2147', pad: 12 });
    const s = Math.min((W - 120) / t.canvas.width, 96 / t.canvas.height);
    g.save(); g.translate(W / 2, 98); g.rotate(-1.5 * DEG);
    g.drawImage(t.canvas, (-t.canvas.width * s) / 2, (-t.canvas.height * s) / 2, t.canvas.width * s, t.canvas.height * s);
    g.restore();
    t.texture.dispose();
  }
  // the window with the reels
  const wy = 150, wh = 92;
  rr(150, wy, W - 300, wh, 20); g.fillStyle = '#17131c'; g.fill();
  const reel = (x, tape) => {
    g.fillStyle = '#3a2416'; g.beginPath(); g.arc(x, wy + wh / 2, tape, 0, TAU); g.fill();
    g.fillStyle = '#f2eee6'; g.beginPath(); g.arc(x, wy + wh / 2, 22, 0, TAU); g.fill();
    g.fillStyle = '#17131c'; g.beginPath(); g.arc(x, wy + wh / 2, 12, 0, TAU); g.fill();
    g.fillStyle = '#f2eee6'; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.fillRect(x + Math.cos(a) * 10 - 2, wy + wh / 2 + Math.sin(a) * 10 - 2, 4, 4); }
  };
  reel(232, 40); reel(W - 232, 28);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(160, wy + 8, W - 320, 6);
  // the lower edge: the head opening and the screws
  g.fillStyle = '#1b1820'; g.beginPath(); g.moveTo(120, H); g.lineTo(150, H - 70); g.lineTo(W - 150, H - 70); g.lineTo(W - 120, H); g.closePath(); g.fill();
  for (const x of [200, 260, W / 2, W - 260, W - 200]) { g.fillStyle = '#0c0a10'; g.beginPath(); g.arc(x, H - 34, 7, 0, TAU); g.fill(); }
  for (const [x, y] of [[18, 18], [W - 18, 18], [18, H - 18], [W - 18, H - 18], [W / 2, 18]]) { g.fillStyle = '#8c8794'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); g.fillStyle = '#3b3842'; g.fillRect(x - 4, y - 1, 8, 2); }
  return c;
}

/** A watermelon slice's cut face: rind, the pale band, red flesh, seeds (centre = the tip). */
function paintMelon(R) {
  const S = 512, c = cnv(S, S), g = c.getContext('2d'), h = S / 2;
  g.translate(h, h);
  g.fillStyle = '#2f6b2a'; g.beginPath(); g.arc(0, 0, h, 0, TAU); g.fill();
  g.fillStyle = '#9cc46f'; g.beginPath(); g.arc(0, 0, h * 0.95, 0, TAU); g.fill();
  const band = g.createRadialGradient(0, 0, h * 0.76, 0, 0, h * 0.92);
  band.addColorStop(0, '#f7a0a4'); band.addColorStop(0.35, '#f8eedb'); band.addColorStop(1, '#e6efc8');
  g.fillStyle = band; g.beginPath(); g.arc(0, 0, h * 0.92, 0, TAU); g.fill();
  const fl = g.createRadialGradient(0, 0, 0, 0, 0, h * 0.8);
  fl.addColorStop(0, '#ff4b5f'); fl.addColorStop(0.7, '#f23a52'); fl.addColorStop(1, '#f77d86');
  g.fillStyle = fl; g.beginPath(); g.arc(0, 0, h * 0.8, 0, TAU); g.fill();
  for (let i = 0; i < 260; i++) { // juicy grain, radiating
    const a = R() * TAU, r0 = R() * h * 0.7, l = 10 + R() * 30;
    g.strokeStyle = `rgba(255,${200 + R() * 55},${200 + R() * 55},${0.06 + R() * 0.12})`; g.lineWidth = 1 + R() * 2;
    g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * (r0 + l), Math.sin(a) * (r0 + l)); g.stroke();
  }
  for (let i = 0; i < 26; i++) { // seeds in a ring, pointing at the centre
    const a = (i / 26) * TAU + (R() - 0.5) * 0.12, r = h * (0.48 + (R() - 0.5) * 0.12);
    g.save(); g.translate(Math.cos(a) * r, Math.sin(a) * r); g.rotate(a + Math.PI / 2);
    g.fillStyle = '#1c120e'; g.beginPath(); g.moveTo(0, -11); g.quadraticCurveTo(8, 2, 0, 9); g.quadraticCurveTo(-8, 2, 0, -11); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(-1.5, 1, 1.6, 3, 0, 0, TAU); g.fill();
    g.restore();
  }
  return c;
}
function paintRind(R) {
  const c = cnv(256, 64), g = c.getContext('2d');
  g.fillStyle = '#245a22'; g.fillRect(0, 0, 256, 64);
  for (let x = 0; x < 256; x += 22) {
    g.fillStyle = '#4f8f3c';
    g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= 64; y += 8) g.lineTo(x + 6 + Math.sin(y * 0.3 + x) * 4 + R() * 2, y);
    for (let y = 64; y >= 0; y -= 8) g.lineTo(x + 13 + Math.sin(y * 0.3 + x) * 4 + R() * 2, y);
    g.fill();
  }
  return c;
}

// ------------------------------------------------------------------ shaders
const TONE = /* glsl */`
  #include <tonemapping_fragment>
  #include <colorspace_fragment>`;

const NOISE = /* glsl */`
  float nHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(nHash(i), nHash(i + vec2(1.0, 0.0)), u.x), mix(nHash(i + vec2(0.0, 1.0)), nHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vNoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
  // soft clouds over the town: 0 clear … 1 cloud (direction d, time t)
  float cloudAt(vec3 d, float t) {
    vec2 q = d.xz / (max(d.y, 0.0) + 0.16) * 0.55 + vec2(t * 0.006, t * 0.002);
    return smoothstep(0.47, 0.8, fbm(q)) * smoothstep(0.02, 0.2, d.y);
  }`;

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = /* glsl */`
  uniform float uTime; uniform float uBright; uniform float uWarm; uniform float uCloud;
  varying vec3 vDir;
  ${NOISE}
  void main() {
    vec3 d = normalize(vDir);
    float y = d.y;
    vec3 col = mix(vec3(0.03, 0.022, 0.056), vec3(0.008, 0.011, 0.046), smoothstep(0.0, 0.22, y));
    col = mix(col, vec3(0.0032, 0.0038, 0.018), smoothstep(0.2, 0.9, y));
    // the town's warm glow low on the horizon, strongest far down the street (−z)
    float toward = 0.4 + 0.6 * (1.0 - smoothstep(-0.9, 0.3, d.z));
    float glow = exp(-max(y, 0.0) * 7.0) * toward;
    col += vec3(0.085, 0.036, 0.016) * glow * uWarm;
    // soft clouds, lit from beneath by the town
    float c = cloudAt(d, uTime) * uCloud;
    vec3 cc = mix(vec3(0.026, 0.026, 0.066), vec3(0.11, 0.06, 0.07), clamp(glow * 1.5 + 0.1, 0.0, 1.0) * uWarm);
    col = mix(col, cc, c * 0.85);
    col = mix(col, vec3(0.006, 0.005, 0.012), 1.0 - smoothstep(-0.1, 0.0, y));
    gl_FragColor = vec4(col * uBright, 1.0);
    ${TONE}
  }`;

const STAR_VERT = /* glsl */`
  attribute vec4 aStar; // pixel size, seed, warmth, -
  uniform float uTime; uniform float uBright; uniform float uPR; uniform float uCloud;
  varying float vA; varying vec3 vCol;
  ${NOISE}
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vec3 d = normalize(position);
    float tw = 0.62 + 0.38 * sin(uTime * (0.7 + aStar.y * 2.6) + aStar.y * 60.0);
    gl_PointSize = aStar.x * uPR;
    vA = uBright * tw * smoothstep(0.03, 0.24, d.y) * (1.0 - 0.85 * cloudAt(d, uTime) * uCloud);
    vCol = mix(vec3(0.74, 0.82, 1.0), vec3(1.0, 0.86, 0.68), aStar.z);
  }`;
const STAR_FRAG = /* glsl */`
  varying float vA; varying vec3 vCol;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    float a = (exp(-r2 * 5.0) + exp(-r2 * 30.0)) * clamp(1.0 - r2, 0.0, 1.0);
    gl_FragColor = vec4(vCol * a * vA, 1.0);
    ${TONE}
  }`;

const PLAIN_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKYLINE_FRAG = /* glsl */`
  uniform sampler2D uMap; uniform float uBright; uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    if (t.a < 0.5) discard;
    vec3 col = mix(vec3(0.012, 0.009, 0.024), vec3(0.003, 0.003, 0.01), smoothstep(0.0, 0.5, vUv.y));
    float haze = smoothstep(0.08, 0.42, vUv.y);
    float mast = step(0.6, t.r) * step(t.g, 0.3);
    float blink = mix(1.0, step(0.55, fract(uTime * 0.5 + vUv.x * 13.0)), mast);
    col += t.rgb * 0.7 * blink * haze;
    gl_FragColor = vec4(col * uBright, 1.0);
    ${TONE}
  }`;

const POINT_VERT = /* glsl */`
  attribute vec4 aPt; // pixel size, seed, hue, -
  uniform float uTime; uniform float uBright; uniform float uPR;
  varying float vA; varying vec3 vCol;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aPt.x * uPR;
    vA = uBright * (0.7 + 0.3 * sin(uTime * (0.4 + aPt.y) + aPt.y * 40.0));
    vCol = aPt.z < 0.7 ? mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.82, 0.55), aPt.z / 0.7) : vec3(0.7, 0.85, 1.0);
  }`;

const WIN_VERT = /* glsl */`
  attribute vec4 aWin; // atlas cell, brightness, switch-on threshold, warmth (< 0: a cool room)
  varying vec2 vUv; varying vec4 vWin;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv; vWin = aWin;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const WIN_FRAG = /* glsl */`
  uniform sampler2D uAtlas; uniform float uOn; uniform float uTime;
  varying vec2 vUv; varying vec4 vWin;
  #include <fog_pars_fragment>
  void main() {
    float k = floor(vWin.x + 0.5), row = floor((k + 0.5) / 4.0);
    vec2 cell = vec2(k - row * 4.0, row); // (rounded: an interpolated index must not flicker between cells)
    vec4 t = texture2D(uAtlas, (cell + clamp(vUv, 0.01, 0.99)) / vec2(4.0, 2.0));
    float on = smoothstep(vWin.z, vWin.z + 0.07, uOn) * vWin.y;
    float cool = step(vWin.w, 0.0);
    float flick = 1.0 + cool * 0.2 * sin(uTime * 6.3 + vWin.z * 40.0) * sin(uTime * 2.1 + vWin.z * 13.0);
    vec3 tint = mix(vec3(1.0, 0.82, 0.6), vec3(0.42, 0.55, 0.85), cool);
    vec3 lit = t.rgb * tint * (1.9 * abs(vWin.w) + 0.35) * on * flick;
    vec3 glass = t.rgb * mix(0.03, 0.45, step(vWin.y, 0.001)) + lit;
    vec3 col = mix(vec3(0.006, 0.005, 0.008), t.rgb * 0.05, smoothstep(0.2, 0.45, t.a)); // frame · a shutter
    col = mix(col, glass, smoothstep(0.6, 0.9, t.a));
    gl_FragColor = vec4(col, 1.0);
    ${TONE}
    #include <fog_fragment>
  }`;

// one instanced draw for every glow: lamp halos, hot bulbs, star glints, the memories' light
const GLOW_VERT = /* glsl */`
  attribute vec3 aPos; attribute vec3 aCol; attribute vec4 aMisc; attribute float aI; // misc: size, kind, fog, seed
  uniform float uTime; uniform float uFogD;
  varying vec2 vUv; varying vec3 vCol; varying float vKind; varying float vA;
  void main() {
    vUv = uv; vKind = aMisc.y; vCol = aCol;
    vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
    float tw = 1.0 + 0.07 * sin(uTime * (1.1 + aMisc.w * 2.0) + aMisc.w * 30.0);
    mv.xy += position.xy * aMisc.x * (vKind > 0.5 && vKind < 1.5 ? tw : 1.0);
    gl_Position = projectionMatrix * mv;
    float fd = uFogD * aMisc.z * (-mv.z);
    vA = aI * exp(-fd * fd) * tw;
    if (aI < 1e-4) gl_Position = vec4(0.0, 0.0, -2.0, 1.0); // (off: no fill at all)
  }`;
const GLOW_FRAG = /* glsl */`
  varying vec2 vUv; varying vec3 vCol; varying float vKind; varying float vA;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r2 = dot(p, p);
    float a;
    if (vKind < 0.5) a = exp(-r2 * 5.0) * 0.8 + exp(-r2 * 24.0) * 0.4;
    else if (vKind < 1.5) {
      float rays = exp(-abs(p.x) * 30.0) * exp(-p.y * p.y * 2.5) + exp(-abs(p.y) * 30.0) * exp(-p.x * p.x * 2.5);
      a = rays * 0.8 + exp(-r2 * 34.0) * 1.1;
    } else a = exp(-r2 * 40.0) * 1.6 + exp(-r2 * 8.0) * 0.2;
    a *= clamp(1.0 - r2, 0.0, 1.0);
    gl_FragColor = vec4(vCol * a * vA, 1.0);
    ${TONE}
  }`;

const CONE_VERT = /* glsl */`
  attribute float aI;
  varying vec3 vN; varying vec3 vW; varying float vH; varying float vI; varying float vDepth;
  void main() {
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vW = w.xyz; vH = uv.y; vI = aI;
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vec4 mv = viewMatrix * w;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const CONE_FRAG = /* glsl */`
  uniform vec3 uCol; uniform float uFogD;
  varying vec3 vN; varying vec3 vW; varying float vH; varying float vI; varying float vDepth;
  void main() {
    vec3 v = normalize(cameraPosition - vW);
    float facing = abs(dot(normalize(vN), v));
    float body = pow(facing, 2.4);
    float vert = smoothstep(0.0, 0.75, vH) * (1.0 - smoothstep(0.9, 1.0, vH));
    float fd = uFogD * vDepth;
    gl_FragColor = vec4(uCol * body * vert * vI * exp(-fd * fd) * smoothstep(0.5, 3.0, vDepth), 1.0);
    ${TONE}
  }`;

// fireflies: soft warm-green motes that blink slowly and brighten as the music's ring passes
const MOTE_VERT = /* glsl */`
  attribute vec3 aPos; attribute vec4 aMisc; // size, seed, hue, speed
  uniform float uTime; uniform float uBright; uniform float uFogD; uniform vec4 uPulse; uniform float uPulseI;
  varying vec2 vUv; varying float vA; varying vec3 vCol; varying float vSoft;
  void main() {
    vUv = uv;
    float s = aMisc.y * 61.0;
    vec3 p = aPos;
    p.x += sin(uTime * 0.23 * aMisc.w + s) * 0.45 + sin(uTime * 0.61 + s * 1.7) * 0.1;
    p.y += sin(uTime * 0.19 * aMisc.w + s * 2.3) * 0.32;
    p.z += cos(uTime * 0.17 * aMisc.w + s * 1.3) * 0.45;
    float blink = pow(0.5 + 0.5 * sin(uTime * (0.6 + aMisc.w * 0.6) + s * 3.0), 3.0);
    float pd = abs(length(p - uPulse.xyz) - uPulse.w);
    float boost = 1.0 + uPulseI * 3.0 * exp(-pd * pd * 0.3);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    vSoft = 1.0 - smoothstep(0.35, 1.6, depth); // near the lens: a big soft out-of-focus disc
    mv.xy += position.xy * aMisc.x * (0.8 + 0.4 * blink) * (1.0 + vSoft * 5.0);
    gl_Position = projectionMatrix * mv;
    float fd = uFogD * depth;
    vA = (0.2 + 0.8 * blink) * uBright * boost * exp(-fd * fd) * smoothstep(0.12, 0.3, depth) / (1.0 + vSoft * 14.0);
    vCol = mix(vec3(0.78, 1.0, 0.42), vec3(1.0, 0.76, 0.38), aMisc.z);
  }`;
const MOTE_FRAG = /* glsl */`
  varying vec2 vUv; varying float vA; varying vec3 vCol; varying float vSoft;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = mix(exp(-d * d * 7.0) + exp(-d * d * 40.0) * 0.9, (1.0 - smoothstep(0.75, 1.0, d)) * 0.6, vSoft);
    a *= clamp(1.0 - d * d, 0.0, 1.0);
    gl_FragColor = vec4(vCol * a * vA * 1.6, 1.0);
    ${TONE}
  }`;

// a few tiny watermelon-seed-shaped glints tumbling slowly through the light
const SEED_VERT = /* glsl */`
  attribute vec3 aPos; attribute vec4 aMisc; // size, seed, spin, -
  uniform float uTime; uniform float uBright; uniform float uFogD;
  varying vec2 vUv; varying float vA; varying float vRot; varying float vFlash;
  void main() {
    vUv = uv;
    float s = aMisc.y * 47.0;
    vec3 p = aPos + vec3(sin(uTime * 0.13 + s) * 0.6, sin(uTime * 0.11 + s * 1.3) * 0.25 + mod(uTime * 0.03 + aMisc.y * 2.0, 2.0) - 1.0, cos(uTime * 0.09 + s) * 0.6);
    vRot = uTime * aMisc.z + s;
    vFlash = pow(max(0.0, sin(uTime * 0.9 * aMisc.z + s * 2.0)), 24.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    mv.xy += position.xy * aMisc.x * (1.0 + vFlash * 1.5);
    gl_Position = projectionMatrix * mv;
    float fd = uFogD * (-mv.z);
    vA = uBright * exp(-fd * fd);
  }`;
const SEED_FRAG = /* glsl */`
  varying vec2 vUv; varying float vA; varying float vRot; varying float vFlash;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float c = cos(vRot), s = sin(vRot);
    vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * 1.6;
    float y = clamp(q.y, -1.0, 1.0);
    float w = 0.5 * sqrt(max(0.0, 1.0 - y * y)) * (1.0 - 0.45 * (y * 0.5 + 0.5));
    float e = w - abs(q.x);
    float inside = step(abs(q.y), 1.0) * smoothstep(0.0, 0.05, e);
    float rim = inside * (1.0 - smoothstep(0.0, 0.16, e));
    float a = rim * 0.9 + inside * 0.12 + vFlash * exp(-dot(p, p) * 6.0) * 1.2;
    gl_FragColor = vec4(vec3(1.0, 0.8, 0.45) * a * vA, 1.0);
    ${TONE}
  }`;

// a real photo on a polaroid that develops as the memory lights
const PHOTO_FRAG = /* glsl */`
  uniform sampler2D uMap; uniform float uDev; uniform float uGlow;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(uMap, vUv).rgb;
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float k = smoothstep(0.0, 1.0, uDev * 1.4 - lum * 0.4);
    vec3 col = mix(vec3(0.3, 0.32, 0.36), c, k);
    vec2 q = vUv - 0.5;
    col *= 1.0 - dot(q, q) * 0.3;
    gl_FragColor = vec4(col * uGlow, 1.0);
    ${TONE}
  }`;

// The light every surface shares (patched into the standard materials): the street lamps, the
// lantern, the neon and the memories as soft analytic lights, and the music's travelling ring.
const FIELD_PARS = /* glsl */`
  uniform vec4 uFP[${NL}]; // position, range
  uniform vec4 uFC[${NL}]; // colour × intensity, hood (0 all round … 1 a lamp's downward light)
  uniform vec4 uPulse;     // centre, radius
  uniform vec4 uPulseC;    // colour × intensity, width
  varying vec3 vFieldW;
  vec3 pulseLight(vec3 P) {
    float pd = abs(length(P - uPulse.xyz) - uPulse.w);
    return uPulseC.rgb * exp(-pd * pd / (uPulseC.w * uPulseC.w));
  }
  vec3 fieldLight(vec3 P, vec3 N) {
    vec3 sum = vec3(0.0);
    for (int i = 0; i < ${NL}; i++) {
      vec4 c = uFC[i];
      if (c.r + c.g + c.b < 1e-4) continue;
      vec3 L = uFP[i].xyz - P;
      float d2 = dot(L, L);
      vec3 l = L * inversesqrt(d2);
      float win = clamp(1.0 - d2 / (uFP[i].w * uFP[i].w), 0.0, 1.0);
      float hood = mix(1.0, smoothstep(0.3, 0.92, l.y), c.w);
      sum += c.rgb * max(dot(N, l), 0.0) * hood * win * win / (1.0 + d2);
    }
    return sum + pulseLight(P);
  }`;
// the damp road: every light's reflection drawn out into a soft vertical streak
const WET_PARS = /* glsl */`
  vec3 wetGlints(vec3 P) {
    vec3 V = normalize(P - cameraPosition);
    vec3 Rt = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 Up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 sum = vec3(0.0);
    for (int i = 0; i < ${NL}; i++) {
      vec4 c = uFC[i];
      if (c.r + c.g + c.b < 1e-4) continue;
      vec3 M = vec3(uFP[i].x, -uFP[i].y, uFP[i].z);
      vec3 dd = V - normalize(M - cameraPosition);
      float h = dot(dd, Rt), v = dot(dd, Up);
      sum += c.rgb * (exp(-h * h * 2600.0 - v * v * 26.0) + 0.6 * exp(-h * h * 9000.0 - v * v * 60.0));
    }
    return sum;
  }`;

// ------------------------------------------------------------------ the movement
export async function build(env) {
  const { tier } = env;
  const q = tier.quality;
  const hi = q === 2;
  const reduced = !!tier.reduced;
  const dev = !!window.__LITTLE_DEV__;
  const aniso = Math.min(hi ? 8 : 4, env.renderer.capabilities.getMaxAnisotropy());
  const envMap = env.envNight;
  const owned = [];
  const own = (x) => { owned.push(x); return x; };
  const late = [];
  const R = rng(20070103);

  const scene = new THREE.Scene();
  const FOG_D = 0.024;
  scene.fog = new THREE.FogExp2(new THREE.Color().setRGB(0.0042, 0.0034, 0.0135), FOG_D);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 420);
  camera.position.set(0.2, 1.7, 15);
  const rig = createRig(camera, { breath: reduced ? 0.3 : 1 });

  // ---------------------------------------------------------------- real lights (a fixed set: no recompiles)
  const HEMI_I = 0.4, MOON_I = 0.32, KEY_I = 13;
  const hemi = new THREE.HemisphereLight(0x3d4282, 0x140d16, 0);
  const moon = new THREE.DirectionalLight(0xa4b4ff, 0);
  moon.position.set(-16, 22, -26); moon.target.position.set(4, 0, 1);
  const key = new THREE.SpotLight(0xffaa5e, 0, 8.5, 0.82, 0.8, 1.7);
  key.position.set(LANTERN.x, LANTERN.y - 0.06, LANTERN.z);
  key.target.position.set(BENCH.x - 0.35, CURB + 0.3, BENCH.z - 0.3);
  if (tier.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(hi ? 1024 : 512, hi ? 1024 : 512);
    key.shadow.camera.near = 0.3; key.shadow.camera.far = 7;
    key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
  }
  scene.add(hemi, moon, moon.target, key, key.target);

  // the shared analytic lights
  const FP = Array.from({ length: NL }, () => new THREE.Vector4(0, -50, 0, 1));
  const FC = Array.from({ length: NL }, () => new THREE.Vector4(0, 0, 0, 0));
  const PULSE = new THREE.Vector4(0, -50, 0, 0), PULSEC = new THREE.Vector4(0, 0, 0, 1.4);
  const FIELD_U = { uFP: { value: FP }, uFC: { value: FC }, uPulse: { value: PULSE }, uPulseC: { value: PULSEC } };
  /** Light a standard material with the shared lights too ('road': also lane paint and wet streaks). */
  const addField = (mat, kind = 'surface') => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, FIELD_U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFieldW;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          { vec4 fw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            fw = instanceMatrix * fw;
          #endif
            vFieldW = (modelMatrix * fw).xyz; }`);
      let fs = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${FIELD_PARS}\n${kind === 'road' ? WET_PARS : ''}`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          reflectedLight.directDiffuse += fieldLight(vFieldW, normalize((vec4(normal, 0.0) * viewMatrix).xyz)) * BRDF_Lambert(material.diffuseColor);
          totalEmissiveRadiance += pulseLight(vFieldW) * 0.035;`);
      if (kind === 'road') {
        fs = fs
          .replace('#include <map_fragment>', `#include <map_fragment>
            { // worn lane paint: a dashed centre line, the edge lines, a crossing near the start
              float ax = abs(vFieldW.x), wear = 0.55 + 0.45 * fract(sin(dot(floor(vFieldW.xz * 9.0), vec2(12.9898, 78.233))) * 43758.5);
              float dash = (1.0 - smoothstep(0.05, 0.07, ax)) * step(fract(vFieldW.z / 7.0), 0.52);
              float edge = 1.0 - smoothstep(0.045, 0.065, abs(ax - ${(ROAD - 0.32).toFixed(2)}));
              float zebra = step(fract(vFieldW.x / 1.1 + 0.25), 0.5) * step(abs(vFieldW.z - 11.8), 1.6) * step(ax, ${(ROAD - 0.6).toFixed(2)});
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.48, 0.44), max(max(dash, edge), zebra) * wear * 0.9);
            }`)
          .replace('#include <opaque_fragment>', `{
              float wet = 1.0 - smoothstep(0.12, 0.62, roughnessFactor);
              vec3 Vw = normalize(vFieldW - cameraPosition);
              float fres = 0.25 + 0.75 * pow(1.0 + Vw.y, 5.0);
              outgoingLight += wetGlints(vFieldW) * (0.0016 + 0.005 * wet) * fres;
            }
            #include <opaque_fragment>`);
      }
      sh.fragmentShader = fs;
    };
    mat.customProgramCacheKey = () => `night-field-${kind}`;
    return mat;
  };
  const envMats = []; // [material, its env intensity]: the reflections only come up with the street's light
  const envReg = (m) => { envMats.push([m, m.envMapIntensity]); return m; };
  const PHYS_ONLY = ['clearcoat', 'clearcoatRoughness', 'sheen', 'sheenColor', 'sheenRoughness', 'specularIntensity', 'specularColor', 'ior', 'iridescence'];
  const phys = (o, field = true) => {
    let m;
    if (q === 0) { const s = { ...o }; for (const k of PHYS_ONLY) delete s[k]; m = new THREE.MeshStandardMaterial({ envMap, envMapIntensity: 0.45, ...s }); }
    else m = new THREE.MeshPhysicalMaterial({ envMap, envMapIntensity: 0.45, ...o });
    own(m); envReg(m);
    return field ? addField(m) : m;
  };
  const std = (o, field = true) => { const m = envReg(own(new THREE.MeshStandardMaterial({ envMap, envMapIntensity: 0.35, ...o }))); return field ? addField(m) : m; };

  // ---------------------------------------------------------------- the sky (follows the camera)
  const skyGroup = new THREE.Group();
  scene.add(skyGroup);
  const skyMat = own(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBright: { value: 0 }, uWarm: { value: 1 }, uCloud: { value: 1 } },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
  }));
  const sky = new THREE.Mesh(own(new THREE.SphereGeometry(200, 48, 24)), skyMat);
  sky.renderOrder = -20;
  skyGroup.add(sky);
  let starMat = null, cityMat = null, stringMat = null;
  // (budgets grow with the tier, q: 0 low … 2 high; reduced motion draws fewer of everything that twinkles or drifts)
  const STARS = [380, 650, 900][q] * (reduced ? 0.7 : 1) | 0;
  {
    const pos = new Float32Array(STARS * 3), a = new Float32Array(STARS * 4);
    for (let i = 0; i < STARS; i++) {
      const u = R(), y = 0.04 + Math.pow(u, 0.8) * 0.96, ang = R() * TAU, r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(ang) * r * 180, y * 180, Math.sin(ang) * r * 180], i * 3);
      const big = R() < 0.06;
      a.set([big ? 3.8 + R() * 2.4 : 1.8 + R() * 1.8, R(), R() < 0.3 ? R() : 0, 0], i * 4);
    }
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aStar', new THREE.BufferAttribute(a, 4));
    starMat = own(new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBright: { value: 0 }, uPR: { value: 1 }, uCloud: { value: 1 } },
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    const stars = new THREE.Points(g, starMat);
    stars.renderOrder = -18;
    skyGroup.add(stars);
  }
  // the town far away: a ring of silhouettes on the horizon, and its lights
  const farGroup = new THREE.Group();
  scene.add(farGroup);
  const skylineTex = own(canvasTex(paintSkyline(R), { wrap: true, aniso }));
  const skylineMat = own(new THREE.ShaderMaterial({
    uniforms: { uMap: { value: skylineTex }, uBright: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = vec2(uv.x * 3.0, uv.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: SKYLINE_FRAG, side: THREE.BackSide,
  }));
  const skyline = new THREE.Mesh(own(new THREE.CylinderGeometry(150, 150, 16, 96, 1, true)), skylineMat);
  skyline.position.y = 6.2;
  skyline.renderOrder = -17;
  farGroup.add(skyline);
  const CITY = [110, 180, 260][q] * (reduced ? 0.7 : 1) | 0;
  {
    const pos = new Float32Array(CITY * 3), a = new Float32Array(CITY * 4);
    for (let i = 0; i < CITY; i++) {
      const ang = (R() < 0.6 ? -Math.PI / 2 : Math.PI / 2) + (R() - 0.5) * 2.2, r = 140;
      pos.set([Math.cos(ang) * r, -1 + Math.pow(R(), 2.2) * 9, Math.sin(ang) * r], i * 3);
      a.set([1.4 + R() * 2.4, R(), R(), 0], i * 4);
    }
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPt', new THREE.BufferAttribute(a, 4));
    cityMat = own(new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uBright: { value: 0 }, uPR: { value: 1 } },
      vertexShader: POINT_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    const city = new THREE.Points(g, cityMat);
    city.renderOrder = -16;
    farGroup.add(city);
  }

  // ---------------------------------------------------------------- the road and the pavements
  const asphalt = own(canvasTex(paintAsphalt(hi ? 1024 : 512, R), { wrap: true, aniso }));
  asphalt.repeat.set(1 / 7, 1 / 7);
  const wetTex = own(canvasTex(paintWet(512, R), { srgb: false, wrap: true, aniso }));
  wetTex.repeat.set(1 / 19, 1 / 19);
  const roadMat = addField(envReg(own(new THREE.MeshStandardMaterial({ map: asphalt, roughnessMap: wetTex, roughness: 1.15, metalness: 0, envMap, envMapIntensity: 0.32 }))), 'road');
  const roadGeo = own(new THREE.PlaneGeometry(ROAD * 2 + 0.3, Z0 - Z1, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, (Z0 + Z1) / 2));
  worldUV(roadGeo);
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.receiveShadow = tier.shadows;
  scene.add(road);

  const paving = own(canvasTex(paintPaving(512, R), { wrap: true, aniso }));
  paving.repeat.set(1 / 2, 1 / 2);
  const walkMat = std({ map: paving, vertexColors: true, roughness: 0.82, envMapIntensity: 0.1 });
  {
    const parts = [];
    const L = Z0 - Z1, zc = (Z0 + Z1) / 2;
    for (const s of [-1, 1]) {
      parts.push(prep(box(FACE - ROAD + 0.3, CURB, L, s * (ROAD + (FACE - ROAD + 0.3) / 2), CURB / 2, zc), 0xffffff));
      parts.push(prep(box(0.17, CURB + 0.006, L, s * (ROAD + 0.085), (CURB + 0.006) / 2, zc), new THREE.Color(1.25, 1.22, 1.18)));
    }
    const g = own(merge(parts));
    worldUV(g, 1);
    const walk = new THREE.Mesh(g, walkMat);
    walk.receiveShadow = tier.shadows;
    scene.add(walk);
  }

  // ---------------------------------------------------------------- the buildings
  const plaster = own(canvasTex(paintPlaster(512, R), { wrap: true, aniso }));
  plaster.repeat.set(1 / 3, 1 / 3);
  const houseMat = std({ map: plaster, vertexColors: true, roughness: 0.9, envMapIntensity: 0.09 });
  const PALETTE = ['#6f6175', '#596579', '#7b6d5f', '#5f6f63', '#7a625f', '#6b6b74', '#7f7468', '#6a5a66', '#5a6a70'].map((h) => new THREE.Color(h));
  const FLOOR_H = 3.1;
  const blocks = [];
  for (const s of [-1, 1]) {
    let z = Z0;
    const fill = (zEnd) => {
      while (z > zEnd + 0.5) {
        let w = 5.5 + R() * 4.5;
        if (z - w < zEnd + 3) w = z - zEnd;
        const gap = R() < 0.25 && z - w - 1.2 > zEnd ? 1.1 : 0;
        blocks.push({ s, zA: z, zB: z - w, floors: R() < 0.3 ? 3 : R() < 0.9 ? 2 : 1, shop: R() < 0.42, col: PALETTE[Math.floor(R() * PALETTE.length)].clone().multiplyScalar(0.92 + R() * 0.16) });
        if (gap) blocks.push({ s, zA: z - w, zB: z - w - gap, floors: 2, recess: true, col: PALETTE[Math.floor(R() * PALETTE.length)].clone().multiplyScalar(0.55) });
        z -= w + gap;
      }
    };
    if (s > 0) {
      fill(5.4);
      blocks.push({ s, zA: 5.4, zB: -3.6, floors: 2, shop: false, bench: true, col: new THREE.Color('#7b6a63') });
      z = -3.6;
    }
    fill(Z1);
  }
  const winInst = []; // [x, y, z, w, h, cell, bright, threshold, warmth, rotY]
  const awnings = [];
  {
    const parts = [];
    for (const b of blocks) {
      const { s } = b, w = b.zA - b.zB, zc = (b.zA + b.zB) / 2;
      const h = b.floors * FLOOR_H + 0.55, D = 9;
      const xf = s * FACE;
      const tone = (k) => b.col.clone().multiplyScalar(k);
      if (b.recess) { parts.push(prep(box(6, h, w + 0.3, s * (FACE + 2.6 + 3), h / 2, zc), b.col)); continue; } // the back of a narrow alley
      parts.push(prep(box(D, h, w, s * (FACE + D / 2), h / 2, zc), b.col));
      if (b.bench) { // a drainpipe and a meter box on the wall behind the bench
        parts.push(prep(cyl(0.045, 0.045, h - 0.1, 10, xf - s * 0.07, (h - 0.1) / 2, -2.85), new THREE.Color(0.3, 0.31, 0.33)));
        for (const y of [1.0, 3.2, 5.4]) parts.push(prep(box(0.1, 0.04, 0.12, xf - s * 0.05, y, -2.85), new THREE.Color(0.2, 0.2, 0.22)));
        parts.push(prep(box(0.16, 0.46, 0.34, xf - s * 0.08, CURB + 1.55, 3.15), new THREE.Color(0.5, 0.51, 0.53)));
      }
      parts.push(prep(box(D + 0.26, 0.16, w + 0.14, s * (FACE + D / 2 - 0.13), h + 0.08, zc), tone(1.18)));
      for (let f = 1; f < b.floors; f++) parts.push(prep(box(0.14, 0.12, w, xf - s * 0.07, f * FLOOR_H + 0.12, zc), tone(1.12)));
      // windows, balconies, air-conditioners
      for (let f = 0; f < b.floors; f++) {
        const n = Math.max(1, Math.floor((w - 1.0) / 2.6));
        for (let k = 0; k < n; k++) {
          const z = zc + ((k + 0.5) / n - 0.5) * (w - 1.4);
          if (b.bench && f === 0 && z > -1.9 && z < 3.3) continue;
          if (f === 0 && b.shop) continue;
          const lit = R();
          const cell = lit < 0.17 ? 4 : lit < 0.27 ? 3 : [0, 1, 2, 5][Math.floor(R() * 4)];
          const warmth = cell === 3 ? -(0.55 + R() * 0.3) : 0.55 + R() * 0.45;
          const y = f * FLOOR_H + (f === 0 ? 1.65 : 1.75);
          winInst.push([xf - s * 0.012, y, z, 1.12, 1.32, cell, cell === 4 ? 0 : 1, R(), warmth]);
          parts.push(prep(box(0.16, 0.07, 1.3, xf - s * 0.07, y - 0.72, z), tone(1.2)));
          if (f > 0 && R() < 0.22) parts.push(prep(box(0.34, 0.5, 0.78, xf - s * 0.2, y - 1.1, z + (R() < 0.5 ? -0.75 : 0.75)), new THREE.Color(0.55, 0.55, 0.58)));
          if (f > 0 && w > 7 && R() < 0.16) {
            parts.push(prep(box(0.8, 0.1, 1.9, xf - s * 0.4, f * FLOOR_H + 0.75, z), tone(1.1)));
            parts.push(prep(box(0.04, 0.05, 1.9, xf - s * 0.78, f * FLOOR_H + 1.72, z), new THREE.Color(0.12, 0.11, 0.12)));
            for (let j = 0; j < 8; j++) parts.push(prep(box(0.025, 0.95, 0.025, xf - s * 0.78, f * FLOOR_H + 1.25, z - 0.92 + j * 0.263), new THREE.Color(0.12, 0.11, 0.12)));
          }
        }
      }
      if (b.shop) {
        const sw = Math.min(3.4, w - 2.4);
        const z0 = zc + 0.55;
        winInst.push([xf - s * 0.012, CURB + 1.28, z0, sw, 2.0, 6, 1, R(), 0.9]);
        winInst.push([xf - s * 0.012, CURB + 1.12, z0 - sw / 2 - 0.75, 1.15, 2.2, 7, 1, R(), 0.8]);
        parts.push(prep(box(0.14, 0.5, sw + 1.8, xf - s * 0.07, CURB + 2.62, z0 - 0.4), R() < 0.5 ? new THREE.Color(0.85, 0.78, 0.66) : new THREE.Color(0.28, 0.45, 0.42)));
        awnings.push({ s, z: z0 - 0.3, w: sw + 1.2, col: [new THREE.Color(0.3, 0.55, 0.45), new THREE.Color(0.72, 0.3, 0.36), new THREE.Color(0.32, 0.4, 0.62)][Math.floor(R() * 3)] });
      }
      // the roof: a water tank, a stair hut, an aerial
      const rx = () => s * (FACE + 1.5 + R() * (D - 3));
      const rz = () => zc + (R() - 0.5) * (w - 2.2);
      if (R() < 0.55) {
        const x = rx(), z = rz();
        parts.push(prep(cyl(0.55, 0.55, 1.05, 14, x, h + 0.75, z), new THREE.Color(0.55, 0.56, 0.6)));
        for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) parts.push(prep(box(0.06, 0.3, 0.06, x + dx, h + 0.15, z + dz), new THREE.Color(0.2, 0.2, 0.22)));
      }
      if (R() < 0.35) parts.push(prep(box(2.2, 2.3, 2.4, rx(), h + 1.15, rz()), tone(0.92)));
      if (R() < 0.4) { const x = rx(), z = rz(); parts.push(prep(cyl(0.025, 0.03, 2.4, 5, x, h + 1.2, z), new THREE.Color(0.15, 0.15, 0.17))); parts.push(prep(box(0.9, 0.03, 0.03, x, h + 2.1, z), new THREE.Color(0.15, 0.15, 0.17))); }
    }
    const g = own(merge(parts));
    worldUV(g, 1);
    const houses = new THREE.Mesh(g, houseMat);
    houses.receiveShadow = tier.shadows;
    scene.add(houses);
  }
  // the windows: one instanced draw, the light painted on a canvas atlas
  const winTex = own(canvasTex(paintWindows(R), { aniso }));
  const winMat = own(new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uAtlas: { value: null }, uOn: { value: 0 }, uTime: { value: 0 } }]),
    vertexShader: WIN_VERT, fragmentShader: WIN_FRAG, fog: true,
  }));
  winMat.uniforms.uAtlas.value = winTex;
  {
    const n = winInst.length;
    const g = own(new THREE.PlaneGeometry(1, 1));
    const a = new Float32Array(n * 4);
    const wins = new THREE.InstancedMesh(g, winMat, n);
    const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    winInst.forEach(([x, y, z, w, h, cell, bright, th, warm], i) => {
      qt.setFromAxisAngle(new THREE.Vector3(0, 1, 0), x > 0 ? -Math.PI / 2 : Math.PI / 2);
      m.compose(p.set(x, y, z), qt, sc.set(w, h, 1));
      wins.setMatrixAt(i, m);
      a.set([cell, bright * (0.7 + R() * 0.3), 0.05 + th * 0.9, warm], i * 4);
    });
    g.setAttribute('aWin', new THREE.InstancedBufferAttribute(a, 4));
    scene.add(wins);
  }
  // awnings over the shops
  if (awnings.length) {
    const tex = own(canvasTex(paintAwning(), { wrap: true, aniso }));
    const mat = std({ map: tex, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.08 });
    const parts = [];
    for (const a of awnings) {
      const top = CURB + 3.25, drop = 0.42, depth = 1.15;
      const pl = new THREE.PlaneGeometry(a.w, Math.hypot(depth, drop), 1, 1);
      pl.rotateX(-Math.PI / 2 + Math.atan2(drop, depth));
      pl.rotateY(a.s > 0 ? -Math.PI / 2 : Math.PI / 2);
      pl.translate(a.s * (FACE - depth / 2), top - drop / 2, a.z);
      const uv = pl.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * a.w * 2.2);
      parts.push(prep(pl, a.col));
      const val = new THREE.PlaneGeometry(a.w, 0.24).rotateY(a.s > 0 ? -Math.PI / 2 : Math.PI / 2).translate(a.s * (FACE - depth), top - drop - 0.12, a.z);
      const uv2 = val.attributes.uv; for (let i = 0; i < uv2.count; i++) uv2.setX(i, uv2.getX(i) * a.w * 2.2);
      parts.push(prep(val, a.col));
    }
    scene.add(new THREE.Mesh(own(merge(parts)), mat));
  }

  // ---------------------------------------------------------------- street lamps, the lantern
  const metalMat = std({ color: 0x2f3a3a, roughness: 0.42, metalness: 0.75, envMapIntensity: 0.8 });
  {
    const parts = [];
    for (const L of LAMPS) {
      const { x, z, s } = L;
      parts.push(prep(cyl(0.15, 0.17, 0.42, 14, x, CURB + 0.21, z)));
      parts.push(prep(cyl(0.055, 0.075, LAMP_H - 0.4, 12, x, CURB + 0.4 + (LAMP_H - 0.4) / 2 - 0.15, z)));
      const arm = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, CURB + LAMP_H - 0.45, z), new THREE.Vector3(x, CURB + LAMP_H + 0.12, z), new THREE.Vector3(L.head.x + s * 0.14, L.head.y + 0.16, z));
      parts.push(prep(new THREE.TubeGeometry(arm, 16, 0.034, 8, false)));
      parts.push(prep(cyl(0.085, 0.22, 0.13, 20, L.head.x, L.head.y + 0.1, z)));
      parts.push(prep(cyl(0.03, 0.08, 0.07, 12, L.head.x, L.head.y + 0.2, z)));
    }
    // the lantern by the bench: a slim post, a little glass house with a cap
    const { x, y, z } = LANTERN;
    parts.push(prep(cyl(0.11, 0.13, 0.36, 14, x, CURB + 0.18, z)));
    parts.push(prep(new THREE.TorusGeometry(0.075, 0.018, 8, 18).rotateX(Math.PI / 2).translate(x, CURB + 0.42, z)));
    parts.push(prep(cyl(0.04, 0.05, y - 0.22 - CURB, 12, x, CURB + (y - 0.22 - CURB) / 2, z)));
    parts.push(prep(cyl(0.11, 0.08, 0.04, 16, x, y - 0.2, z)));
    for (const [dx, dz] of [[-0.085, -0.085], [0.085, -0.085], [-0.085, 0.085], [0.085, 0.085]]) parts.push(prep(box(0.014, 0.36, 0.014, x + dx, y - 0.02, z + dz)));
    parts.push(prep(new THREE.ConeGeometry(0.16, 0.13, 4, 1).rotateY(Math.PI / 4).translate(x, y + 0.22, z)));
    parts.push(prep(new THREE.SphereGeometry(0.028, 10, 8).translate(x, y + 0.31, z)));
    const lamps = new THREE.Mesh(own(merge(parts)), metalMat);
    scene.add(lamps);
  }
  // the lamps' glass: bright, its brightness per lamp (instance colour)
  const bulbMat = own(new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }));
  const bulbs = new THREE.InstancedMesh(own(new THREE.SphereGeometry(1, 18, 10)), bulbMat, LAMPS.length + 1);
  {
    const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3();
    LAMPS.forEach((L, i) => { bulbs.setMatrixAt(i, m.compose(L.head.clone().add(new THREE.Vector3(0, 0.035, 0)), qt, sc.set(0.16, 0.045, 0.16))); bulbs.setColorAt(i, new THREE.Color(0, 0, 0)); });
    bulbs.setMatrixAt(LAMPS.length, m.compose(LANTERN, qt, sc.set(0.062, 0.13, 0.062)));
    bulbs.setColorAt(LAMPS.length, new THREE.Color(0, 0, 0));
    scene.add(bulbs);
  }
  // soft shafts of light under the lamps (the fog catching it)
  const coneMat = own(new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(1.0, 0.6, 0.28).multiplyScalar(0.06) }, uFogD: { value: FOG_D * 0.7 } },
    vertexShader: CONE_VERT, fragmentShader: CONE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true,
  }));
  const coneI = new Float32Array(LAMPS.length + 1);
  const coneGeo = own(new THREE.CylinderGeometry(0.12, 2.0, LAMP_H - 0.1, 28, 1, true).translate(0, -(LAMP_H - 0.1) / 2, 0));
  const coneIA = new THREE.InstancedBufferAttribute(coneI, 1).setUsage(THREE.DynamicDrawUsage);
  coneGeo.setAttribute('aI', coneIA);
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, LAMPS.length + 1);
  {
    const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    LAMPS.forEach((L, i) => cones.setMatrixAt(i, m.compose(L.head, qt, sc.set(1, 1, 1))));
    cones.setMatrixAt(LAMPS.length, m.compose(new THREE.Vector3(LANTERN.x, LANTERN.y - 0.15, LANTERN.z), qt, sc.set(0.7, (LANTERN.y - 0.15 - CURB) / (LAMP_H - 0.1), 0.7)));
    cones.renderOrder = 6;
    scene.add(cones);
  }

  // ---------------------------------------------------------------- utility poles and wires
  {
    const parts = [], wires = [];
    const px = -(ROAD + 0.32);
    const tops = [];
    for (const z of POLES) {
      parts.push(prep(cyl(0.11, 0.15, 9.2, 10, px, 4.6, z), new THREE.Color(0.3, 0.3, 0.32)));
      parts.push(prep(box(2.0, 0.12, 0.12, px, 8.6, z), new THREE.Color(0.18, 0.17, 0.18)));
      parts.push(prep(box(1.3, 0.1, 0.1, px + 0.15, 7.6, z), new THREE.Color(0.18, 0.17, 0.18)));
      for (const dx of [-0.85, 0, 0.85]) parts.push(prep(cyl(0.035, 0.045, 0.14, 8, px + dx, 8.73, z), new THREE.Color(0.75, 0.75, 0.72)));
      for (const dx of [-0.4, 0.7]) parts.push(prep(cyl(0.03, 0.04, 0.12, 8, px + dx, 7.71, z), new THREE.Color(0.75, 0.75, 0.72)));
      if (z === -27 || z === 3.5) parts.push(prep(cyl(0.27, 0.27, 0.85, 12, px - 0.42, 6.5, z), new THREE.Color(0.42, 0.44, 0.45)));
      tops.push(z);
    }
    const ends = [Z0 + 6, ...tops, Z1 - 6];
    for (let i = 0; i < ends.length - 1; i++) {
      const za = ends[i], zb = ends[i + 1];
      for (const [dx, y, sag] of [[-0.85, 8.78, 0.42], [0, 8.78, 0.36], [0.85, 8.78, 0.45], [-0.4, 7.75, 0.6], [0.7, 7.75, 0.52]]) {
        wires.push(wire(new THREE.Vector3(px + dx, y, za), new THREE.Vector3(px + dx, y, zb), sag + R() * 0.12, 0.012));
      }
    }
    // service wires across the street to the houses opposite, and a few into this side's walls
    tops.forEach((z, i) => {
      if (i % 2 === 0) wires.push(wire(new THREE.Vector3(px + 0.7, 7.7, z), new THREE.Vector3(FACE + 0.02, 5.6 + R(), z + (R() - 0.5) * 6), 0.85 + R() * 0.4, 0.011));
      if (i % 3 === 1) wires.push(wire(new THREE.Vector3(px + 0.7, 7.7, z), new THREE.Vector3(FACE + 0.02, 6.2, z - 4 - R() * 3), 1.0, 0.011));
      if (i % 2 === 1) wires.push(wire(new THREE.Vector3(px - 0.8, 7.7, z), new THREE.Vector3(-FACE - 0.02, 5.4 + R(), z + 2), 0.35, 0.011));
    });
    scene.add(new THREE.Mesh(own(merge(parts)), std({ vertexColors: true, roughness: 0.85, envMapIntensity: 0.08 })));
    const wireMat = own(new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.004, 0.0035, 0.007), fog: true }));
    scene.add(new THREE.Mesh(own(merge(wires.map((w) => prep(w)))), wireMat));
  }

  // ---------------------------------------------------------------- the neon sign
  const NP = neonPaths();
  const neon = new THREE.Group();
  neon.position.set(NEON.x, NEON.y, NEON.z);
  neon.rotation.y = -Math.PI / 2;
  scene.add(neon);
  const neonPink = own(new THREE.MeshBasicMaterial({ color: 0x000000, fog: true }));
  const neonGreen = own(new THREE.MeshBasicMaterial({ color: 0x000000, fog: true }));
  const tubes = (list) => own(merge(list.map(({ pts, closed }) => prep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], 0)), closed, 'centripetal'), Math.max(12, pts.length * 2), 0.0105, 8, closed)))));
  neon.add(new THREE.Mesh(tubes(NP.pink), neonPink), new THREE.Mesh(tubes(NP.green), neonGreen));
  {
    const sh = new THREE.Shape();
    const w = 1.04, h = 0.6, r = 0.06, x0 = -0.51, y0 = -0.27;
    sh.moveTo(x0 + r, y0); sh.lineTo(x0 + w - r, y0); sh.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); sh.lineTo(x0 + w, y0 + h - r); sh.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
    sh.lineTo(x0 + r, y0 + h); sh.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r); sh.lineTo(x0, y0 + r); sh.quadraticCurveTo(x0, y0, x0 + r, y0);
    const g = own(new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 }).translate(0, 0, -0.035));
    const plate = new THREE.Mesh(g, phys({ color: 0x0c0a10, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.0 }));
    neon.add(plate);
  }
  const neonGlowTex = own(canvasTex(paintNeonGlow(NP), { aniso }));
  const neonGlowMat = own(new THREE.MeshBasicMaterial({ map: neonGlowTex, color: 0x000000, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
  const neonGlow = new THREE.Mesh(own(new THREE.PlaneGeometry(1.6, 1.0)), neonGlowMat);
  neonGlow.position.z = -0.018;
  neonGlow.renderOrder = 8;
  neon.add(neonGlow);
  neon.updateMatrixWorld(true);
  const neonPinkAt = neon.localToWorld(new THREE.Vector3(0.12, -0.02, 0.35));
  const neonGreenAt = neon.localToWorld(new THREE.Vector3(-0.2, -0.04, 0.35));

  // ---------------------------------------------------------------- the bench
  const benchG = new THREE.Group();
  benchG.position.set(BENCH.x, CURB, BENCH.z);
  scene.add(benchG);
  const woodTex = own(canvasTex(paintWood(512, 128, R, { base: '#8a5a34', dark: '#4a2a14', light: '#c08a58', lines: 60 }), { wrap: true, aniso }));
  woodTex.repeat.set(1 / 1.7, 4);
  const benchWood = phys({ map: woodTex, roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.45, envMapIntensity: 0.35 });
  const ironMat = std({ color: 0x1b1d20, roughness: 0.5, metalness: 0.7, envMapIntensity: 0.7 });
  {
    const slats = [];
    const L = BENCH.len;
    const slatUV = (g) => { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) + L / 2, (p.getX(i) + p.getY(i)) * 4 + 0.5); return g; };
    for (const x of [-0.165, -0.055, 0.055, 0.165]) slats.push(prep(slatUV(new RoundedBoxGeometry(0.092, 0.032, L, 2, 0.01)).translate(x, 0.435, 0)));
    const tilt = 13 * DEG;
    for (const t of [0.2, 0.52, 0.84]) {
      const g = slatUV(new RoundedBoxGeometry(0.03, 0.095, L, 2, 0.01)).rotateZ(-tilt);
      slats.push(prep(g.translate(0.215 + t * 0.4 * Math.sin(tilt) + 0.02, 0.56 + t * 0.4 * Math.cos(tilt), 0)));
    }
    const wood = new THREE.Mesh(own(merge(slats)), benchWood);
    wood.castShadow = wood.receiveShadow = tier.shadows;
    benchG.add(wood);
    const iron = [];
    const tube = (pts, r = 0.017) => prep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0))), 24, r, 8, false));
    for (const z of [-L / 2 + 0.12, L / 2 - 0.12]) {
      const frame = [
        tube([[-0.23, 0.0], [-0.2, 0.18], [-0.21, 0.42]]),
        tube([[-0.24, 0.415], [0.0, 0.405], [0.24, 0.415]], 0.014),
        tube([[0.25, 0.0], [0.21, 0.22], [0.215, 0.44], [0.27, 0.7], [0.33, 0.94]]),
        tube([[0.235, 0.6], [0.05, 0.64], [-0.17, 0.62], [-0.25, 0.56], [-0.22, 0.5]], 0.015),
        tube([[-0.21, 0.42], [-0.22, 0.5]], 0.014),
      ];
      for (const f of frame) iron.push(f.translate(0, 0, z));
    }
    const ironM = new THREE.Mesh(own(merge(iron)), ironMat);
    ironM.castShadow = ironM.receiveShadow = tier.shadows;
    benchG.add(ironM);
  }

  // ---------------------------------------------------------------- the guitar
  const guitar = new THREE.Group();
  const gLean = new THREE.Group();
  const gYaw = new THREE.Group();
  gYaw.position.set(4.66, CURB, BENCH.z - 0.68);
  gYaw.rotation.y = 24 * DEG;
  gLean.rotation.z = -15 * DEG;
  guitar.rotation.y = -Math.PI / 2;
  guitar.position.set(0, 0.255, 0.0);
  gYaw.add(gLean); gLean.add(guitar);
  scene.add(gYaw);
  const ZT = 0.096; // the top's surface (local z)
  const NUT = 0.585, SADDLE = -0.06, SCALE = NUT - SADDLE;
  const FRETS = [];
  for (let n = 0; n <= 20; n++) FRETS.push(NUT - SCALE * (1 - Math.pow(2, -n / 12)));
  {
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.255);
    sh.bezierCurveTo(0.11, -0.255, 0.19, -0.205, 0.19, -0.115);
    sh.bezierCurveTo(0.19, -0.03, 0.124, -0.005, 0.124, 0.04);
    sh.bezierCurveTo(0.124, 0.085, 0.146, 0.095, 0.146, 0.15);
    sh.bezierCurveTo(0.146, 0.21, 0.085, 0.235, 0, 0.235);
    sh.bezierCurveTo(-0.085, 0.235, -0.146, 0.21, -0.146, 0.15);
    sh.bezierCurveTo(-0.146, 0.095, -0.124, 0.085, -0.124, 0.04);
    sh.bezierCurveTo(-0.124, -0.005, -0.19, -0.03, -0.19, -0.115);
    sh.bezierCurveTo(-0.19, -0.205, -0.11, -0.255, 0, -0.255);
    const outline = sh.getPoints(40);
    const hole = new THREE.Path(); hole.absarc(0, 0.115, 0.043, 0, TAU, true);
    sh.holes.push(hole);
    const bodyGeo = own(new THREE.ExtrudeGeometry(sh, { depth: 0.088, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.0035, bevelSegments: 3, curveSegments: 36 }).translate(0, 0, 0.004));
    const topTex = own(canvasTex(paintSpruce(outline, R), { aniso }));
    topTex.repeat.set(1 / 0.4, 1 / 0.52); topTex.offset.set(0.5, 0.5);
    const mahog = own(canvasTex(paintWood(256, 256, R, { base: '#6a2c14', dark: '#2e1007', light: '#a5532a', lines: 50, knots: 0 }), { wrap: true, aniso }));
    mahog.repeat.set(6, 6);
    const topMat = phys({ map: topTex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.7 });
    const sideMat = phys({ map: mahog, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.7 });
    const body = new THREE.Mesh(bodyGeo, [topMat, sideMat]);
    const inside = new THREE.Mesh(own(new THREE.CircleGeometry(0.05, 24).translate(0, 0.115, 0.02)), std({ color: 0x0b0604, roughness: 1 }, false));
    const darkWood = std({ color: 0x2a160e, roughness: 0.55 });
    const bone = std({ color: 0xefe5d0, roughness: 0.4 });
    const bridge = new THREE.Mesh(own(merge([prep(box(0.15, 0.028, 0.009, 0, SADDLE - 0.012, ZT + 0.0045)), prep(box(0.02, 0.02, 0.006, -0.083, SADDLE - 0.012, ZT + 0.003)), prep(box(0.02, 0.02, 0.006, 0.083, SADDLE - 0.012, ZT + 0.003))])), darkWood);
    const bones = new THREE.Mesh(own(merge([prep(box(0.075, 0.003, 0.005, 0, SADDLE, ZT + 0.0105)), prep(box(0.046, 0.004, 0.006, 0, NUT, ZT + 0.0105))])), bone);
    // neck, fretboard, frets, headstock
    const neckMat = phys({ map: mahog, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.3 });
    const neckG = new THREE.CylinderGeometry(0.025, 0.022, NUT - 0.205, 14, 1).scale(1, 1, 0.75).translate(0, (NUT + 0.205) / 2, ZT - 0.006);
    const hs = new THREE.Shape();
    hs.moveTo(-0.025, 0); hs.lineTo(-0.038, 0.12); hs.quadraticCurveTo(-0.042, 0.178, -0.02, 0.182); hs.quadraticCurveTo(0, 0.172, 0.02, 0.182); hs.quadraticCurveTo(0.042, 0.178, 0.038, 0.12); hs.lineTo(0.025, 0); hs.lineTo(-0.025, 0);
    const head = new THREE.ExtrudeGeometry(hs, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
    const hsM = new THREE.Matrix4().makeRotationX(-14 * DEG).setPosition(0, NUT + 0.004, ZT - 0.006);
    head.translate(0, 0, -0.014).applyMatrix4(hsM);
    const neck = new THREE.Mesh(own(merge([prep(neckG), prep(head)])), neckMat);
    const y0 = 0.165;
    const fbTex = own(canvasTex(paintFretboard(R, FRETS, y0, NUT), { aniso }));
    const fb = new THREE.BoxGeometry(0.052, NUT - y0, 0.007).translate(0, (NUT + y0) / 2, ZT + 0.0045);
    { const p = fb.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * lerp(1.0, 0.86, (p.getY(i) - y0) / (NUT - y0))); }
    const fretboard = new THREE.Mesh(own(fb), std({ map: fbTex, roughness: 0.7 }));
    const fretParts = [];
    for (let n = 1; n < FRETS.length; n++) if (FRETS[n] > y0 + 0.004) fretParts.push(prep(box(0.052 * lerp(1.0, 0.86, (FRETS[n] - y0) / (NUT - y0)), 0.0022, 0.0018, 0, FRETS[n], ZT + 0.0085)));
    // tuners: posts on the face, buttons at the sides
    for (let k = 0; k < 3; k++) for (const sx of [-1, 1]) {
      const local = new THREE.Vector3(sx * 0.024, 0.045 + k * 0.045, 0.014);
      const p = local.applyMatrix4(hsM);
      fretParts.push(prep(new THREE.CylinderGeometry(0.0045, 0.0045, 0.016, 8).rotateX(Math.PI / 2).applyMatrix4(new THREE.Matrix4().makeRotationX(-14 * DEG)).translate(p.x, p.y, p.z)));
      const b = new THREE.Vector3(sx * 0.052, 0.045 + k * 0.045, -0.007).applyMatrix4(hsM);
      fretParts.push(prep(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10).rotateZ(Math.PI / 2).translate(b.x, b.y, b.z)));
      fretParts.push(prep(new THREE.CylinderGeometry(0.0025, 0.0025, 0.012, 6).rotateZ(Math.PI / 2).translate(b.x - sx * 0.008, b.y, b.z)));
    }
    const chrome = std({ color: 0xd8d8de, roughness: 0.22, metalness: 1, envMapIntensity: 1.1 });
    const frets = new THREE.Mesh(own(merge(fretParts)), chrome);
    // six strings, bronze, from the saddle to the nut
    const strings = [];
    const rs = [0.00095, 0.00085, 0.00075, 0.00062, 0.0005, 0.00045];
    for (let i = 0; i < 6; i++) strings.push(prep(rod(new THREE.Vector3(-0.027 + i * 0.0108, SADDLE, ZT + 0.0128), new THREE.Vector3(-0.0185 + i * 0.0074, NUT, ZT + 0.0118), rs[i], 5)));
    stringMat = std({ color: 0xd4ad72, roughness: 0.3, metalness: 1, envMapIntensity: 1.1, emissive: 0xffc070, emissiveIntensity: 0 });
    const strs = new THREE.Mesh(own(merge(strings)), stringMat);
    guitar.add(body, inside, bridge, bones, neck, fretboard, frets, strs);
    for (const o of [body, bridge, neck, fretboard, frets]) { o.castShadow = tier.shadows; o.receiveShadow = tier.shadows; }
  }
  scene.updateMatrixWorld(true);
  const soundHole = guitar.localToWorld(new THREE.Vector3(0, 0.115, ZT + 0.03));

  // ---------------------------------------------------------------- her things on the seat
  const props = new THREE.Group();
  props.position.set(BENCH.x, SEAT + 0.017, BENCH.z);
  scene.add(props);
  const PS = 1.2; // (a touch larger than life, so they read from the street)
  {
    // a slice of watermelon on a plate
    const plateG = new THREE.LatheGeometry([[0, 0.0015], [0.06, 0.0015], [0.062, 0], [0.072, 0], [0.074, 0.003], [0.09, 0.008], [0.106, 0.016], [0.113, 0.0195], [0.115, 0.0185], [0.108, 0.0135], [0.09, 0.0055], [0.07, 0.0035], [0, 0.0035]].map(([r, y]) => new THREE.Vector2(r, y)).reverse(), 40);
    const plate = new THREE.Mesh(own(plateG), phys({ color: 0xcfc6b6, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.6 }));
    const melon = new THREE.Group();
    const RM = 0.105, TH = 0.03, A0 = -Math.PI / 2 - 58 * DEG, A1 = -Math.PI / 2 + 58 * DEG;
    const face = new THREE.Shape(); face.moveTo(0, 0); face.absarc(0, 0, RM, A0, A1, false); face.lineTo(0, 0);
    const faceTex = own(canvasTex(paintMelon(R), { aniso }));
    const fG = (z, flip) => { const g = new THREE.ShapeGeometry(face, 24); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * RM) + 0.5, p.getY(i) / (2 * RM) + 0.5); if (flip) g.rotateY(Math.PI); return g.translate(0, 0, z); };
    const cutSide = (a) => { const g = new THREE.PlaneGeometry(RM, TH); g.translate(RM / 2, 0, 0); g.rotateX(Math.PI / 2); g.rotateZ(a); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + 0.499 * uv.getX(i), 0.5); return g; };
    const flesh = merge([prep(fG(TH / 2, false)), prep(fG(-TH / 2, true)), prep(cutSide(A0)), prep(cutSide(A1))]);
    const rindTex = own(canvasTex(paintRind(R), { wrap: true, aniso }));
    const rindG = new THREE.CylinderGeometry(RM, RM, TH, 24, 1, true, A0 + Math.PI / 2, A1 - A0).rotateX(Math.PI / 2);
    const fleshM = new THREE.Mesh(own(flesh), phys({ map: faceTex, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25, side: THREE.DoubleSide }));
    const rindM = new THREE.Mesh(own(rindG), phys({ map: rindTex, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.2, side: THREE.DoubleSide }));
    melon.add(fleshM, rindM);
    melon.position.set(0, RM + 0.004, 0);
    melon.rotation.y = 0.25;
    const plateG2 = new THREE.Group(); plateG2.add(plate, melon);
    plateG2.position.set(-0.045, 0, -0.33); plateG2.scale.setScalar(PS);
    props.add(plateG2);
    for (const o of [plate, fleshM, rindM]) { o.castShadow = o.receiveShadow = tier.shadows; }
  }
  {
    // the cassette, its handwritten label
    const word = env.fill(env.T.cassette || '');
    const caseTex = own(canvasTex(paintCassette(word, R), { aniso }));
    const shell = new THREE.Mesh(own(new RoundedBoxGeometry(0.1, 0.0125, 0.064, 2, 0.0022)), phys({ color: 0x1f1b25, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.9 }));
    const faceM = new THREE.Mesh(own(new THREE.PlaneGeometry(0.098, 0.062).rotateX(-Math.PI / 2).translate(0, 0.0064, 0)), phys({ map: caseTex, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
    const cas = new THREE.Group(); cas.add(shell, faceM);
    cas.rotation.y = -Math.PI / 2 + 0.22;
    cas.position.set(-0.07, 0.0063 * PS, 0.12); cas.scale.setScalar(PS);
    props.add(cas);
    shell.castShadow = shell.receiveShadow = tier.shadows;
    // wired headphones: the band, the cups, a cable curling over to the cassette
    const hp = new THREE.Group();
    const bandPts = []; { const c = new THREE.EllipseCurve(0, 0, 0.085, 0.075, 0, Math.PI, false); for (let i = 0; i <= 24; i++) { const p = c.getPoint(i / 24); bandPts.push(new THREE.Vector3(p.x, 0.035, -p.y)); } }
    const bandG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bandPts), 32, 0.0065, 8, false);
    const cups = [];
    const pads = [];
    for (const sx of [-1, 1]) {
      cups.push(prep(cyl(0.034, 0.036, 0.022, 20, sx * 0.085, 0.024, 0)));
      cups.push(prep(box(0.012, 0.03, 0.01, sx * 0.085, 0.04, 0)));
      pads.push(prep(new THREE.TorusGeometry(0.03, 0.0095, 10, 20).rotateX(Math.PI / 2).translate(sx * 0.085, 0.0095, 0)));
      pads.push(prep(cyl(0.024, 0.024, 0.006, 16, sx * 0.085, 0.006, 0)));
    }
    const hpMetal = std({ color: 0xc9c6cc, roughness: 0.3, metalness: 1, envMapIntensity: 1 });
    const hpPlastic = phys({ color: 0xf1ead8, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    const hpPads = phys({ color: 0xe8803a, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xffc08a), sheenRoughness: 0.5 });
    const bandM = new THREE.Mesh(own(bandG), hpMetal);
    const cupsM = new THREE.Mesh(own(merge(cups)), hpPlastic);
    const padsM = new THREE.Mesh(own(merge(pads)), hpPads);
    const cable = new THREE.CatmullRomCurve3([[-0.09, 0.012, 0.03], [-0.13, 0.004, 0.06], [-0.16, 0.003, 0.0], [-0.12, 0.003, -0.07], [-0.05, 0.003, -0.1], [0.0, 0.003, -0.15], [-0.04, 0.003, -0.22], [-0.11, 0.003, -0.24], [-0.15, 0.003, -0.3]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const cableG = merge([prep(new THREE.TubeGeometry(cable, 80, 0.0022, 6, false)), prep(cyl(0.0035, 0.0035, 0.025, 8, 0, 0, 0).rotateX(Math.PI / 2).translate(-0.15, 0.004, -0.315)), prep(cyl(0.0016, 0.0016, 0.018, 6, 0, 0, 0).rotateX(Math.PI / 2).translate(-0.15, 0.004, -0.335))]);
    const cableM = new THREE.Mesh(own(cableG), std({ color: 0x202024, roughness: 0.5, metalness: 0.2 }));
    hp.add(bandM, cupsM, padsM, cableM);
    hp.position.set(0.02, 0, 0.52); hp.rotation.y = -0.5; hp.scale.setScalar(PS);
    props.add(hp);
    for (const o of [bandM, cupsM, padsM, cableM]) { o.castShadow = o.receiveShadow = tier.shadows; }
  }

  // ---------------------------------------------------------------- the memories (the owner's own)
  const memories = (env.memories || []).filter((m) => m && (m.text || (m.photos && m.photos.length))).slice(0, 10);
  const NM = memories.length;
  const dz = NM <= 4 ? 8 : Math.max(4.5, 30 / Math.max(1, NM - 1));
  const paperTex = own(canvasTex(paintPaper(R), { aniso }));
  const paperMat = std({ map: paperTex, roughness: 0.85, emissive: 0xfff0d6, emissiveIntensity: 0.16, envMapIntensity: 0.25 });
  const cardGeo = own(new THREE.BoxGeometry(CARD_W, CARD_H, 0.006).translate(0, -CARD_TOP - CARD_H / 2, 0));
  const photoGeo = own(new THREE.PlaneGeometry(PHOTO, PHOTO).translate(0, -CARD_TOP - 0.06 - PHOTO / 2, 0.0036));
  const pickPhoto = (m) => {
    const list = (m.photos || []).filter((p) => p && !p.isPlaceholder);
    const ok = list.filter((p) => !readsRomantic(p));
    const pool = ok.length ? ok : list;
    return pool.find((p) => p.featured) || pool[0] || null;
  };
  const loaded = await Promise.all(memories.map(async (m) => {
    const photo = pickPhoto(m);
    if (!photo) return null;
    try {
      const t = await photoTexture(env.ctx, photo, 640);
      const img = t.image;
      t.dispose();
      if (!img || !(img.naturalWidth || img.width)) return null;
      // a square from the photo (a polaroid's window), centred on its focal point, at most 640 px
      const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, s = Math.min(W, H);
      const fx = photo.focal && Number.isFinite(photo.focal.x) ? photo.focal.x : 0.5, fy = photo.focal && Number.isFinite(photo.focal.y) ? photo.focal.y : 0.45;
      const size = Math.min(640, s);
      const c = cnv(size, size);
      c.getContext('2d').drawImage(img, clamp(fx * W - s / 2, 0, W - s), clamp(fy * H - s / 2, 0, H - s), s, s, 0, 0, size, size);
      return { tex: own(canvasTex(c, { aniso })), alt: photo.alt || '' };
    } catch (e) { return null; }
  }));
  env.guard();
  const mems = memories.map((m, i) => {
    const side = i % 2 ? 1 : -1;
    const orb = new THREE.Vector3(side * 1.45, 3.0 + Math.min(i, 5) * 0.1, -8.5 - i * dz);
    const k = { a: 0, lit: 0, open: 0, dev: 0, flash: 0 };
    const rec = { text: m.text || '', side, orb, base: orb.clone(), k, card: null, yaw: 0, photoMat: null, s: 0, passed: false, center: orb.clone().add(new THREE.Vector3(0, -CARD_TOP - CARD_H / 2, 0)) };
    const ld = loaded[i];
    if (ld) {
      const g = new THREE.Group();
      g.position.copy(orb);
      const pm = own(new THREE.ShaderMaterial({ uniforms: { uMap: { value: ld.tex }, uDev: { value: 0 }, uGlow: { value: 1.15 } }, vertexShader: PLAIN_VERT, fragmentShader: PHOTO_FRAG }));
      const pivot = new THREE.Group();
      pivot.add(new THREE.Mesh(cardGeo, paperMat), new THREE.Mesh(photoGeo, pm));
      g.add(pivot);
      g.visible = false;
      scene.add(g);
      late.push(g);
      rec.card = g; rec.pivot = pivot; rec.photoMat = pm;
    }
    return rec;
  });

  // ---------------------------------------------------------------- glows (one instanced draw)
  const G = []; // { p: Vector3 (live), col, size, kind 0 halo · 1 star · 2 hot, fog }
  const glow = (p, col, size, kind, fog = 1) => { G.push({ p, col, size, kind, fog }); return G.length - 1; };
  const lampHalo = [], lampHot = [];
  LAMPS.forEach((L) => {
    const p = L.head.clone().add(new THREE.Vector3(0, -0.12, 0));
    lampHalo.push(glow(p, SODIUM, 2.6, 0, 0.55));
    lampHot.push(glow(L.head.clone().add(new THREE.Vector3(0, -0.02, 0)), [1.0, 0.75, 0.45], 0.55, 2, 0.4));
  });
  const lanternHalo = glow(LANTERN.clone(), LANTERN_C, 1.5, 0, 0.6);
  const lanternHot = glow(LANTERN.clone(), [1.0, 0.8, 0.55], 0.3, 2, 0.6);
  const neonHaloP = glow(neonPinkAt.clone(), PINK, 1.5, 0, 0.8);
  const neonHaloG = glow(neonGreenAt.clone(), GREEN, 1.2, 0, 0.8);
  const introP = new THREE.Vector3(), introHalo = glow(introP, [1.0, 0.6, 0.28], 1.1, 0, 0.3), introHot = glow(introP, [1.0, 0.85, 0.6], 0.28, 2, 0.3);
  const holeGlint = glow(soundHole.clone(), [1.0, 0.85, 0.55], 0.5, 1, 0.5);
  const memGlow = mems.map((m) => ({
    halo: glow(m.orb.clone(), GOLD, 1.5, 0, 0.45),
    star: glow(m.orb, [1.0, 0.86, 0.6], 1.15, 1, 0.45),
    hot: glow(m.orb, [1.0, 0.9, 0.72], 0.18, 2, 0.5),
    back: glow(new THREE.Vector3(), [1.0, 0.7, 0.4], 2.6, 0, 0.5),
  }));
  const NG = G.length;
  const gPos = new Float32Array(NG * 3), gCol = new Float32Array(NG * 3), gMisc = new Float32Array(NG * 4), gI = new Float32Array(NG);
  G.forEach((e, i) => { gCol.set(e.col, i * 3); gMisc.set([e.size, e.kind, e.fog, R()], i * 4); gPos.set([e.p.x, e.p.y, e.p.z], i * 3); });
  const glowGeo = own(new THREE.InstancedBufferGeometry());
  {
    const quad = new THREE.PlaneGeometry(1, 1);
    glowGeo.index = quad.index;
    glowGeo.setAttribute('position', quad.getAttribute('position'));
    glowGeo.setAttribute('uv', quad.getAttribute('uv'));
    quad.dispose();
  }
  const gPosA = new THREE.InstancedBufferAttribute(gPos, 3).setUsage(THREE.DynamicDrawUsage);
  const gIA = new THREE.InstancedBufferAttribute(gI, 1).setUsage(THREE.DynamicDrawUsage);
  glowGeo.setAttribute('aPos', gPosA);
  glowGeo.setAttribute('aCol', new THREE.InstancedBufferAttribute(gCol, 3));
  glowGeo.setAttribute('aMisc', new THREE.InstancedBufferAttribute(gMisc, 4));
  glowGeo.setAttribute('aI', gIA);
  glowGeo.instanceCount = NG;
  const glowMat = own(new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uFogD: { value: FOG_D } }, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const glows = new THREE.Mesh(glowGeo, glowMat);
  glows.renderOrder = 12;
  glows.userData.unbounded = true; // (its bounds are one unit quad's: never culled)
  scene.add(glows);

  // ---------------------------------------------------------------- fireflies and seed glints
  const MOTES = [90, 180, 300][q] * (reduced ? 0.7 : 1) | 0;
  const PULSE_U = { value: PULSE };
  const instQuad = (n) => {
    const g = own(new THREE.InstancedBufferGeometry());
    const quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    g.setAttribute('uv', quad.getAttribute('uv'));
    quad.dispose();
    g.instanceCount = n;
    return g;
  };
  const moteMat = own(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBright: { value: 0 }, uFogD: { value: FOG_D }, uPulse: PULSE_U, uPulseI: { value: 0 } },
    vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  {
    const g = instQuad(MOTES);
    const p = new Float32Array(MOTES * 3), a = new Float32Array(MOTES * 4);
    for (let i = 0; i < MOTES; i++) {
      const nearBench = R() < 0.22;
      const x = nearBench ? 2.2 + R() * 3.3 : (R() - 0.5) * 10.6;
      const z = nearBench ? -1.8 + R() * 4.8 : 14 - R() * 58;
      p.set([x, 0.35 + R() * 4.2, z], i * 3);
      a.set([0.035 + R() * R() * 0.07, R(), R() < 0.55 ? R() * 0.3 : 0.6 + R() * 0.4, 0.6 + R() * 0.9], i * 4);
    }
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(p, 3));
    g.setAttribute('aMisc', new THREE.InstancedBufferAttribute(a, 4));
    const motes = new THREE.Mesh(g, moteMat);
    motes.renderOrder = 14;
    motes.userData.unbounded = true;
    scene.add(motes);
  }
  const SEEDS = [8, 16, 26][q] * (reduced ? 0.7 : 1) | 0;
  const seedMat = own(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBright: { value: 0 }, uFogD: { value: FOG_D } },
    vertexShader: SEED_VERT, fragmentShader: SEED_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  {
    const g = instQuad(SEEDS);
    const p = new Float32Array(SEEDS * 3), a = new Float32Array(SEEDS * 4);
    for (let i = 0; i < SEEDS; i++) {
      p.set([i < SEEDS * 0.5 ? 3.0 + R() * 2.4 : (R() - 0.5) * 7, 0.9 + R() * 2.6, i < SEEDS * 0.5 ? -1.5 + R() * 4 : 4 - R() * 34], i * 3);
      a.set([0.045 + R() * 0.03, R(), (R() < 0.5 ? -1 : 1) * (0.3 + R() * 0.6), 0], i * 4);
    }
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(p, 3));
    g.setAttribute('aMisc', new THREE.InstancedBufferAttribute(a, 4));
    const seeds = new THREE.Mesh(g, seedMat);
    seeds.renderOrder = 13;
    seeds.userData.unbounded = true;
    scene.add(seeds);
  }

  // ---------------------------------------------------------------- the golden thread
  const pathPts = [soundHole.clone(), soundHole.clone().add(new THREE.Vector3(-0.7, 0.75, -0.25)), new THREE.Vector3(1.6, 2.5, -2.4)];
  mems.forEach((m, i) => {
    if (i > 0) { const a = mems[i - 1].orb; pathPts.push(new THREE.Vector3(0, (a.y + m.orb.y) / 2 + 0.55, (a.z + m.orb.z) / 2)); }
    pathPts.push(m.orb.clone());
  });
  const lastOrb = mems.length ? mems[mems.length - 1].orb : new THREE.Vector3(0, 3.0, -20);
  const zEnd = lastOrb.z;
  pathPts.push(new THREE.Vector3(lastOrb.x * 0.4, lastOrb.y + 1.4, zEnd - 6), new THREE.Vector3(0.2, 6.5, zEnd - 14), new THREE.Vector3(-0.3, 12.5, zEnd - 22), new THREE.Vector3(0.0, 20, zEnd - 28));
  const path = new PathSampler(pathPts, { samples: 2400 });
  for (const m of mems) m.s = path.closest(m.orb);
  const sLast = mems.length ? mems[mems.length - 1].s : path.length * 0.45;
  const strand = createStrand({ segments: [170, 220, 260][q] });
  const STRAND_OPTS = { wobble: reduced ? 0.25 : 0.5 };
  strand.mesh.visible = false;
  scene.add(strand.mesh);
  late.push(strand.mesh);

  // ---------------------------------------------------------------- frustum culling off for the warm-up
  // (so the shell's warm-up frame draws — and uploads — everything; on again at the first update)
  const culled = [];
  scene.traverse((o) => { if ((o.isMesh || o.isPoints) && o.frustumCulled) { o.frustumCulled = false; if (!o.userData.unbounded) culled.push(o); } });
  let warmed = false;
  for (const t of owned) if (t && t.isTexture) env.renderer.initTexture(t);

  // ---------------------------------------------------------------- knobs (tweened by play, read by update)
  const S = {
    sky: 0, stars: 0, cloud: 1, warm: 0.4, windows: 0, neon: 0, lantern: 0, key: 0, moon: 0, hemi: 0,
    motes: 0, moteBoost: 1, seeds: 0, pulseR: 0, pulseI: 0, strings: 0,
    env: 0, intro: 0, introT: 0, strand: 0, head: 0, ring: 0, width: 1, trail: 0, exposure: 1, breath: 1, rise: 0,
  };
  const lampK = LAMPS.map(() => ({ v: 0 }));
  const C = { px: 0.2, py: 1.7, pz: 15, lx: 0.4, ly: 2.4, lz: -60, fov: 42 };
  const fit = { portrait: false, aspect: 1.6, fov: 42 };
  const refit = (size) => {
    const aspect = (size && size.aspect) || 1.6;
    fit.aspect = aspect; fit.portrait = aspect < 0.8;
    fit.fov = fit.portrait ? 58 : aspect < 1.25 ? 50 : 42;
  };
  refit(env.size);
  const P = fit;
  const shots = {
    start: () => ({ px: 0.2, py: 1.65, pz: 15.5, lx: 0.5, ly: 2.6, lz: -60, fov: P.fov }),
    street: () => ({ px: 0.45, py: 1.6, pz: 8.6, lx: 0.6, ly: 2.25, lz: -40, fov: P.fov }),
    drift: () => ({ px: 1.0, py: 1.55, pz: 6.0, lx: 2.4, ly: 1.75, lz: -6, fov: P.fov }),
    bench: () => (P.portrait
      ? { px: 2.75, py: 1.42, pz: -2.15, lx: 5.0, ly: 1.05, lz: 0.85, fov: P.fov }
      : { px: 1.6, py: 1.5, pz: 2.35, lx: 5.0, ly: 1.3, lz: 0.62, fov: P.fov }),
    close: () => (P.portrait
      ? { px: 3.4, py: 1.3, pz: -0.68, lx: 5.0, ly: 0.68, lz: 0.68, fov: P.fov }
      : { px: 3.75, py: 1.14, pz: 1.12, lx: 4.95, ly: 0.64, lz: 0.78, fov: P.fov }),
    follow: () => ({ px: 1.3, py: 1.75, pz: 1.2, lx: -0.3, ly: 2.35, lz: -18, fov: P.fov }),
    along: () => ({ px: 0.7, py: 2.0, pz: -1.0, lx: -0.4, ly: 2.55, lz: -22, fov: P.fov }),
    mem: (i) => {
      const m = mems[i], c = m.center;
      const tanH = Math.tan((P.fov * DEG) / 2);
      let d = CARD_H / ((P.portrait ? 0.36 : 0.44) * 2 * tanH);
      d = Math.max(d, CARD_W / (0.66 * 2 * tanH * P.aspect));
      const off = 0.1 * 2 * d * tanH; // (the card sits a little above the middle, clear of the words)
      return { px: c.x - m.side * d * 0.3, py: c.y - 0.1, pz: c.z + d * 0.95, lx: c.x - m.side * 0.1, ly: c.y - off, lz: c.z, fov: P.fov };
    },
    crane: () => ({ px: 0.2, py: 4.4, pz: zEnd + 13, lx: 0.0, ly: 2.6, lz: zEnd - 8, fov: P.fov }),
    wide: () => (P.portrait
      ? { px: -0.6, py: 8.6, pz: 16, lx: 0.2, ly: 2.6, lz: zEnd - 6, fov: P.fov }
      : { px: -0.6, py: 8.0, pz: 14, lx: 0.2, ly: 3.0, lz: zEnd - 6, fov: P.fov }),
    up: () => (P.portrait
      ? { px: -0.6, py: 9.0, pz: 16, lx: 0.1, ly: 4.6, lz: zEnd - 8, fov: P.fov }
      : { px: -0.6, py: 8.3, pz: 14, lx: 0.1, ly: 4.0, lz: zEnd - 8, fov: P.fov }),
  };
  let lastShot = shots.start, camTween = null;

  // ---------------------------------------------------------------- the frame loop
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const _c = new THREE.Color();
  let time = 0;
  function setField(i, p, range, col, k, hood) {
    FP[i].set(p.x, p.y, p.z, range);
    FC[i].set(col[0] * k, col[1] * k, col[2] * k, hood);
  }
  const LAMP_I = 150, LANTERN_I = 6, NEON_I = 7, MEM_I = 9;
  const flick = (t, i, rate = 22) => hash1(Math.floor(t * rate) + i * 17.3);

  function update(dt, t) {
    time = t;
    if (!warmed) { warmed = true; for (const o of culled) o.frustumCulled = true; }
    // camera
    rig.pos.set(C.px, C.py, C.pz);
    rig.look.set(C.lx, C.ly, C.lz);
    rig.fov = C.fov;
    rig.breath = S.breath;
    rig.apply(t);
    camera.updateMatrixWorld();
    skyGroup.position.copy(camera.position);
    farGroup.position.set(camera.position.x, 0, camera.position.z);

    // sky
    skyMat.uniforms.uTime.value = t; skyMat.uniforms.uBright.value = S.sky; skyMat.uniforms.uWarm.value = S.warm;
    starMat.uniforms.uTime.value = t; starMat.uniforms.uBright.value = S.stars; starMat.uniforms.uPR.value = env.renderer.getPixelRatio();
    skylineMat.uniforms.uBright.value = S.sky; skylineMat.uniforms.uTime.value = t;
    cityMat.uniforms.uTime.value = t; cityMat.uniforms.uBright.value = S.sky; cityMat.uniforms.uPR.value = env.renderer.getPixelRatio();
    hemi.intensity = HEMI_I * S.hemi;
    for (let i = 0; i < envMats.length; i++) envMats[i][0].envMapIntensity = envMats[i][1] * S.env;
    moon.intensity = MOON_I * S.moon;
    winMat.uniforms.uOn.value = S.windows; winMat.uniforms.uTime.value = t;

    // the music's ring
    const pr = S.pulseR, pi = S.pulseI;
    PULSE.set(soundHole.x, CURB + 0.6, soundHole.z, pr);
    // (it leaves the guitar softly — it must not flash the things on the bench white — and swells as it travels)
    const ringFade = pi * (1 - smooth(22, 48, pr)) * (0.12 + 0.88 * smooth(0.4, 4.5, pr));
    PULSEC.set(1.0 * ringFade * 4, 0.7 * ringFade * 4, 0.38 * ringFade * 4, 0.45 + pr * 0.03);

    // street lamps (a sodium lamp flickers as it warms up; the ring makes each one flare as it passes)
    for (let i = 0; i < LAMPS.length; i++) {
      const L = LAMPS[i], v = lampK[i].v;
      let on = v;
      if (v > 0.002 && v < 0.995) on = v * (0.35 + 0.65 * flick(t, i));
      const dx = L.x - soundHole.x, dzz = L.z - soundHole.z;
      const dd = Math.sqrt(dx * dx + dzz * dzz) - pr;
      const lvl = on * (1 + pi * 0.9 * Math.exp(-dd * dd / 10));
      setField(i, L.head, 15, SODIUM, LAMP_I * lvl, 1);
      FP[i].y -= 0.1;
      gI[lampHalo[i]] = lvl * 0.55;
      gI[lampHot[i]] = lvl * 1.4;
      bulbs.setColorAt(i, _c.setRGB(4.2 * lvl, 2.5 * lvl, 1.1 * lvl));
      coneI[i] = lvl;
    }
    // the lantern and the key light it stands for
    {
      const v = S.lantern;
      const on = v > 0.002 && v < 0.995 ? v * (0.45 + 0.55 * flick(t, 9, 18)) : v;
      key.intensity = KEY_I * S.key * (on > 0 ? on / Math.max(v, 1e-3) : 0) * (0.98 + 0.02 * Math.sin(t * 13));
      setField(L_LANTERN, LANTERN, 9, LANTERN_C, LANTERN_I * on, 0.35);
      gI[lanternHalo] = on * 0.75; gI[lanternHot] = on * 1.3;
      bulbs.setColorAt(LAMPS.length, _c.setRGB(4.5 * on, 2.9 * on, 1.4 * on));
      coneI[LAMPS.length] = on * 0.7;
    }
    bulbs.instanceColor.needsUpdate = true;
    coneIA.needsUpdate = true;
    // the neon
    {
      const v = S.neon;
      const n = v > 0.002 && v < 0.995 ? v * (flick(t, 3, 26) > 0.35 ? 1 : 0.08) : v;
      const buzz = 0.97 + 0.03 * Math.sin(t * 50);
      neonPink.color.setRGB(3.6 * n * buzz, 0.7 * n * buzz, 1.7 * n * buzz);
      neonGreen.color.setRGB(0.7 * n, 3.2 * n, 1.2 * n);
      neonGlowMat.color.setRGB(1.5 * n, 1.5 * n, 1.5 * n);
      setField(L_PINK, neonPinkAt, 4.5, PINK, NEON_I * n, 0);
      setField(L_GREEN, neonGreenAt, 4.0, GREEN, NEON_I * 0.7 * n, 0);
      gI[neonHaloP] = n * 0.18; gI[neonHaloG] = n * 0.14;
    }
    // the guitar's strings catch the light on the strum
    stringMat.emissiveIntensity = S.strings * 1.6;
    gI[holeGlint] = S.strings * 0.9;

    // the opening's warm light, drifting away to become the far lamp
    if (S.intro > 0.001) {
      _a.set(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(1.6).add(camera.position);
      introP.lerpVectors(_a, LAMPS[FAR].head, S.introT);
    }
    gI[introHalo] = S.intro * (1.2 - S.introT * 0.6);
    gI[introHot] = S.intro * 1.2;

    // memories
    for (let i = 0; i < mems.length; i++) {
      const m = mems[i], k = m.k;
      m.orb.set(m.base.x, m.base.y + Math.sin(t * 0.8 + i * 1.7) * 0.03 * (reduced ? 0.3 : 1), m.base.z);
      const breathe = 0.85 + 0.15 * Math.sin(t * 1.6 + i * 1.3);
      const mg = memGlow[i];
      // (once its polaroid hangs from it, the point quietens: the photo is the light now)
      const quiet = 1 - 0.7 * Math.min(1, k.open) * (1 - S.trail);
      gI[mg.halo] = (k.a * 0.55 * breathe + k.lit * 0.25 + k.flash * 0.6 + S.trail * 0.2) * quiet;
      gI[mg.star] = (k.a * 0.7 * breathe + k.lit * 0.1 + k.flash * 0.6) * (1 - 0.4 * S.trail) * quiet;
      gI[mg.hot] = (k.a * 0.9 + k.lit * 0.2) * (0.5 + 0.5 * quiet);
      _b.set(camera.position.x - m.orb.x, camera.position.y - m.orb.y, camera.position.z - m.orb.z).normalize();
      G[mg.halo].p.copy(m.orb).addScaledVector(_b, -0.12);
      if (i < NL - L_MEM) setField(L_MEM + i, m.orb, 7, GOLD, MEM_I * (k.a * 0.1 + k.lit * 0.6 + k.flash * 0.7 + S.trail * 0.25), 0);
      if (m.card) {
        const open = k.open;
        m.card.visible = open > 0.001;
        gI[mg.back] = 0;
        if (m.card.visible) {
          m.card.position.copy(m.orb);
          // the card turns gently to face whoever looks at it, and sways a little on its light
          const want = Math.atan2(camera.position.x - m.orb.x, camera.position.z - m.orb.z);
          let dy = want - m.yaw; dy -= Math.round(dy / TAU) * TAU;
          m.yaw = open < 0.05 ? want : m.yaw + dy * (1 - Math.exp(-2.2 * dt));
          m.card.rotation.y = m.yaw;
          m.pivot.rotation.x = (1 - Math.min(1, open)) * -1.25;
          m.pivot.rotation.z = Math.sin(t * 0.7 + i * 2.1) * 0.025 * (reduced ? 0.3 : 1);
          const sc = Math.max(0.001, Math.min(1.08, open));
          m.pivot.scale.set(sc, sc, 1);
          m.photoMat.uniforms.uDev.value = k.dev;
          m.photoMat.uniforms.uGlow.value = 1.12 + k.flash * 0.25 + S.trail * 0.08;
          _b.set(camera.position.x - m.center.x, 0, camera.position.z - m.center.z).normalize();
          gI[mg.back] = Math.min(1, open) * (0.16 + k.flash * 0.2 + S.trail * 0.14);
          G[mg.back].p.set(m.orb.x - _b.x * 0.12, m.orb.y - CARD_TOP - CARD_H * 0.45, m.orb.z - _b.z * 0.12);
        }
      }
    }
    // the glows' positions (the ones that move) and brightness
    for (let i = 0; i < NG; i++) { const p = G[i].p; gPos[i * 3] = p.x; gPos[i * 3 + 1] = p.y; gPos[i * 3 + 2] = p.z; }
    gPosA.needsUpdate = true;
    gIA.needsUpdate = true;
    glowMat.uniforms.uTime.value = t;

    // fireflies, seeds
    moteMat.uniforms.uTime.value = t; moteMat.uniforms.uBright.value = S.motes * S.moteBoost; moteMat.uniforms.uPulseI.value = ringFade;
    seedMat.uniforms.uTime.value = t; seedMat.uniforms.uBright.value = S.seeds;

    // the thread
    strand.mesh.visible = S.strand > 0.001;
    if (strand.mesh.visible) {
      strand.uniforms.uOpacity.value = S.strand;
      strand.uniforms.uRing.value = S.ring;
      strand.uniforms.uWidth.value = S.width;
      strand.update(path, 0, Math.max(0.05, Math.min(path.length, S.head)), t, STRAND_OPTS);
    }
    api.exposure = S.exposure;
  }

  // ---------------------------------------------------------------- the beats
  // (dev only: ?at=n8&hold=1.5 freezes the movement 1.5 s into that beat, for screenshots)
  let held = false;
  const wait = async (sec) => { await env.wait(sec); while (held) await env.wait(0.5); };
  const later = (sec, fn) => env.later(sec, () => { if (!held) fn(); });
  const tw = (target, vars) => env.to(target, { overwrite: 'auto', ...vars });
  const camTo = (fn, vars, ...args) => {
    lastShot = () => fn(...args);
    camTween = tw(C, { ...fn(...args), ...vars });
    return camTween;
  };
  const camSet = (fn, ...args) => { lastShot = () => fn(...args); Object.assign(C, fn(...args)); };
  const lampOn = (i, d = 0.9) => tw(lampK[i], { v: 1, duration: d, ease: 'power1.in' });
  const nightLines = () => (env.T.nightLines || []).map((l) => env.fill(l)).filter(Boolean);
  const est = (text) => Math.max(2.4, 1 + String(text).split(/\s+/).length * 0.36) + 1.1;
  let saying = null; // the closing lines, while they play
  let lastSaid = Promise.resolve(); // the last memory's words, while they finish
  /** A memory's light swells for a moment (in real time, whatever the frame rate). */
  const flash = (m, v) => { m.k.flash = v; tw(m.k, { flash: 0, duration: 1.6, ease: 'sine.out' }); };
  // the film's 2D golden dust drifts over every chapter: here it thins to almost nothing (the dark
  // must read as dark, and the street has its own fireflies); the next chapter sets its own
  const dust = (o) => { try { env.ctx.fx?.dust?.(o); } catch (e) { /* ignore */ } };

  /** Every knob where a beat begins (the dev jump; and n1's clean start). */
  function snap(b) {
    const i = BEATS.indexOf(b);
    Object.assign(S, { env: 0, sky: 0, stars: 0, cloud: 1, warm: 0.4, windows: 0, neon: 0, lantern: 0, key: 0, moon: 0, hemi: 0, motes: 0, moteBoost: 1, seeds: 0, pulseR: 0, pulseI: 0, strings: 0, intro: 0, introT: 0, strand: 0, head: 0, ring: 0, width: 1, trail: 0, exposure: 1, breath: reduced ? 0.3 : 1, rise: 0 });
    for (const l of lampK) l.v = 0;
    for (const m of mems) { Object.assign(m.k, { a: 0, lit: 0, open: 0, dev: 0, flash: 0 }); m.passed = false; }
    camSet(shots.start);
    const lit = { env: 1, sky: 1, stars: 1, windows: 1.1, warm: 1, moon: 1, hemi: 1 };
    if (i >= 1) lampK[FAR].v = 1;
    if (i >= 2) { for (const l of lampK) l.v = 1; Object.assign(S, lit); camSet(shots.street); }
    if (i >= 3) { S.motes = 1; camSet(shots.drift); }
    if (i >= 4) { Object.assign(S, { lantern: 1, key: 1, neon: 1, seeds: 1 }); camSet(shots.close); }
    if (i >= 5) { S.moteBoost = 1.5; camSet(shots.bench); }
    if (i >= 6) camSet(shots.follow);
    if (i >= 7) { for (const m of mems) m.k.a = 1; camSet(shots.along); }
    if (i >= 8) { for (const m of mems) Object.assign(m.k, { lit: 1, open: 1, dev: 1 }); if (mems.length) camSet(shots.mem, mems.length - 1); }
    if (i >= 9) { Object.assign(S, { strand: 1, head: sLast + 0.3 }); for (const m of mems) m.passed = true; camSet(shots.crane); }
    if (i >= 10) camSet(shots.wide);
    if (i >= 11) Object.assign(S, { ring: 0.85, width: 1.4, trail: 1, stars: 1.6 });
    for (const m of mems) if (m.card) m.card.visible = m.k.open > 0.001;
  }

  const beats = {
    // N1 — from the warm veil (or black): darkness; the warm light drifts off down the street and
    // becomes one tiny distant lamp
    async n1(dir) {
      env.mood('tender');
      env.sfx('nightAir');
      dust({ density: 0.03, alpha: 0.3, speed: 0.4 });
      Object.assign(S, { intro: 1, introT: 0, sky: 0.05, exposure: 1 });
      const v = dir.veil(0, { duration: 1.6, ease: 'sine.inOut' });
      tw(S, { introT: 1, duration: reduced ? 1.8 : 2.8, ease: 'power2.inOut' });
      tw(S, { sky: 0.18, duration: 3 });
      later(reduced ? 1.4 : 2.3, () => { lampOn(FAR, 0.6); tw(S, { intro: 0, duration: 0.7 }); });
      await v;
      await wait(reduced ? 0.4 : 0.8);
    },
    // N2 — the camera moves slowly forward; the lamps come on one by one, toward us
    async n2() {
      const D = reduced ? 3.0 : 5.0;
      if (!reduced) camTo(shots.street, { duration: D, ease: 'sine.inOut' });
      for (let i = FAR - 1, k = 0; i >= 0; i--, k++) later((reduced ? 0.25 : 0.4) + k * (reduced ? 0.28 : 0.5), () => lampOn(i));
      tw(S, { sky: 1, warm: 1, duration: D * 0.9, ease: 'sine.inOut' });
      tw(S, { stars: 1, duration: D, delay: D * 0.2 });
      tw(S, { hemi: 1, moon: 1, env: 1, duration: D * 0.8, delay: D * 0.1 });
      tw(S, { windows: 1.1, duration: D * 0.95, delay: D * 0.15, ease: 'sine.in' });
      await wait(D * 0.8);
    },
    // N3 — fireflies drift through the air
    async n3() {
      tw(S, { motes: 1, duration: 2.4 });
      dust({ density: 0.1, alpha: 0.45, speed: 0.4 });
      if (!reduced) camTo(shots.drift, { duration: 2.6, ease: 'sine.inOut' });
      await wait(reduced ? 0.8 : 1.2);
    },
    // N4 — the bench: the lantern comes on — the guitar and her things in warm light; then the neon
    async n4(dir) {
      if (reduced) {
        await dir.veil(1, { duration: 0.4, color: CUT });
        camSet(shots.bench);
        dir.veil(0, { duration: 0.6 });
      } else camTo(shots.bench, { duration: 2.8, ease: 'power2.inOut' });
      later(reduced ? 0.5 : 1.3, () => {
        tw(S, { lantern: 1, duration: 0.9, ease: 'power1.in' });
        tw(S, { key: 1, duration: 1.2, ease: 'sine.out' });
      });
      later(reduced ? 1.4 : 2.4, () => tw(S, { neon: 1, duration: 1.0, ease: 'none' }));
      later(reduced ? 1.6 : 2.6, () => tw(S, { seeds: 1, duration: 2 }));
      await wait(reduced ? 2.0 : 3.0);
      if (!reduced) {
        camTo(shots.close, { duration: 2.8, ease: 'sine.inOut' });
        await wait(1.8);
      }
    },
    // N5 — a strum: a ring of light travels out through the street; the fireflies brighten
    async n5() {
      env.sfx('strum');
      tw(S, { strings: 1, duration: 0.12, onComplete: () => tw(S, { strings: 0, duration: 1.4, ease: 'sine.out' }) });
      S.pulseR = 0.2; S.pulseI = 1;
      tw(S, { pulseR: 48, duration: reduced ? 3.6 : 5.0, ease: 'power1.in' });
      tw(S, { moteBoost: 1.5, duration: 1.6 });
      if (!reduced) camTo(shots.bench, { duration: 2.2, ease: 'sine.inOut' });
      await wait(reduced ? 1.0 : 1.4);
    },
    // N6 — the camera follows the ring down the street
    async n6(dir) {
      if (reduced) {
        await wait(0.6);
        await dir.veil(1, { duration: 0.4, color: CUT });
        camSet(shots.along);
        dir.veil(0, { duration: 0.6 });
        await wait(0.3);
        return;
      }
      camTo(shots.follow, { duration: 2.8, ease: 'power2.inOut' });
      await wait(1.8);
    },
    // N7 — glowing memory points appear along the way
    async n7() {
      mems.forEach((m, i) => later(i * 0.4, () => tw(m.k, { a: 1, duration: 0.9, ease: 'sine.out' })));
      if (mems.length) env.sfx('sparkle', { volume: 0.5 });
      tw(S, { pulseI: 0, duration: 1.5 });
      if (!reduced) camTo(shots.along, { duration: 2.8, ease: 'sine.inOut' });
      await wait(reduced ? 1.0 : 1.2 + mems.length * 0.1);
    },
    // N8 — each memory lights in turn: its real photo develops on a polaroid; the owner's words
    async n8(dir) {
      let said = Promise.resolve();
      for (let i = 0; i < mems.length; i++) {
        const m = mems[i];
        // to the memory (a matched move; with reduced motion, a soft cut)
        if (reduced) {
          await dir.veil(1, { duration: 0.35, color: CUT }); camSet(shots.mem, i); dir.veil(0, { duration: 0.5 });
          await Promise.all([said, wait(0.5)]);
        } else {
          camTo(shots.mem, { duration: i === 0 ? 2.5 : 2.3, ease: 'power2.inOut' }, i);
          await Promise.all([said, wait(i === 0 ? 1.7 : 1.5)]);
        }
        // it lights; the polaroid unfolds from the light and develops
        env.sfx(i % 2 ? 'shimmer' : 'chime', { volume: 0.6 });
        flash(m, 1);
        tw(m.k, { lit: 1, duration: 0.6, ease: 'sine.out' });
        if (m.card) {
          tw(m.k, { open: 1, duration: reduced ? 0.6 : 1.1, delay: 0.15, ease: reduced ? 'sine.out' : 'back.out(1.3)' });
          tw(m.k, { dev: 1, duration: reduced ? 1.6 : 3.0, delay: 0.4, ease: 'sine.inOut' });
        }
        await wait(0.5);
        said = m.text ? env.narrate(m.text, { position: 'bottom' }) : wait(1.6);
        said.catch(() => {});
        // the next move (after the last one: the thread) begins while the words are still fading
        const w = wait(Math.max(1.2, est(m.text) - (reduced ? 1.2 : 1.7)));
        w.catch(() => {});
        await Promise.race([said, w]);
      }
      lastSaid = said;
    },
    // N9 — the golden thread: from the guitar, through every memory
    async n9() {
      S.head = 0.05; S.ring = 0; S.width = 1.15;
      tw(S, { strand: 1, duration: 0.4 });
      // (each memory flares as the thread reaches it)
      tw(S, { head: sLast + 0.3, duration: reduced ? 3.2 : 4.4, ease: 'sine.inOut', onUpdate: () => { for (const m of mems) if (!m.passed && S.head >= m.s) { m.passed = true; flash(m, 0.9); } } });
      if (!reduced) camTo(shots.crane, { duration: 3.4, ease: 'power2.inOut' });
      await Promise.all([wait(reduced ? 1.6 : 2.2), lastSaid]);
    },
    // N10 — the camera rises: the whole street, the trail along it
    async n10(dir) {
      env.mood('soar');
      if (reduced) {
        await wait(1.4);
        await dir.veil(1, { duration: 0.4, color: CUT });
        camSet(shots.wide);
        dir.veil(0, { duration: 0.7 });
        await wait(0.6);
        return;
      }
      camTo(shots.wide, { duration: 4.4, ease: 'power2.inOut' });
      tw(S, { width: 1.25, duration: 4 });
      await wait(1.8);
    },
    // N11 — the trail glows; the closing lines, in handwriting, with pauses
    async n11() {
      tw(S, { ring: 0.85, trail: 1, width: 1.4, duration: 2.0, ease: 'sine.inOut' });
      tw(S, { stars: 1.6, duration: 3 });
      env.sfx('shimmer', { volume: 0.5 });
      const lines = nightLines();
      saying = lines.length ? env.narrate(lines, { style: 'hand', position: 'bottom', gap: 0.75 }) : wait(2.0);
      saying.catch(() => {});
      await wait(lines.length ? 2.2 : 1.0);
    },
    // N12 — the thread rises into the night sky; held there
    async n12() {
      tw(S, { head: path.length, duration: reduced ? 3.6 : 6.0, ease: 'sine.inOut' });
      if (!reduced) camTo(shots.up, { duration: 6.0, ease: 'sine.inOut' });
      if (saying) await saying;
      await wait(reduced ? 0.8 : 1.6);
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
      if (hold >= 0) env.later((i0 > 0 ? 0.3 : 0) + hold, () => { env.gsap.globalTimeline.pause(); held = true; api.dev.held = true; });
    }
    if (i0 > 0) { env.mood(i0 >= 9 ? 'soar' : 'tender'); dust(i0 >= 2 ? { density: 0.1, alpha: 0.45, speed: 0.4 } : { density: 0.03, alpha: 0.3 }); await dir.veil(0, { duration: 0.3 }); }
    for (let i = i0; i < BEATS.length; i++) {
      env.guard();
      if (dev) { api.dev.beat = BEATS[i]; api.dev.beatT0 = performance.now(); }
      await beats[BEATS[i]](dir);
    }
    if (dev) api.dev.beat = 'done';
  }

  const api = {
    id: 'night', scene, camera,
    exposure: 1,
    bloom: { strength: 0.7, radius: 0.6, threshold: 0.75 },
    late,
    update,
    resize(size) {
      camera.aspect = size.aspect;
      refit(size);
      if (!camTween || !camTween.isActive()) Object.assign(C, lastShot());
      else C.fov = P.fov;
      camera.updateProjectionMatrix();
    },
    play,
    dispose() {
      strand.dispose();
      key.dispose(); moon.dispose(); hemi.dispose();
      bulbs.dispose(); cones.dispose();
      for (const o of owned) o.dispose?.();
    },
    dev: dev ? { beat: '', t0: 0, beatT0: 0, held: false, counts: { STARS, MOTES, SEEDS, CITY, windows: winInst.length, memories: NM, glows: NG }, get time() { return time; }, S, C, mems, neonPink, gI } : null,
  };
  return api;
}
