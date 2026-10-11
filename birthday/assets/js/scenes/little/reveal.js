// "What Makes You, You" · movement 4 — REVEAL: everything that makes her, her, on the golden thread.
//
// The payoff of the two 3D chapters. Out of the dark, the golden thread climbs a slow spiral, and as
// its head passes, each little thing lights up and floats beside it: a keyring with its charms, a
// fizzy green bottle, a watermelon slice, a plate of pani puri, a bowl of Manchurian with its steam,
// the fan-art prints (only when the owner has made one: env.shared.fanPhotos, stamped "IMAGINED · FAN
// ART"), and her real photographs as real prints (her featured photos). The camera follows the
// thread up, then pulls far back until the whole spiral is a little constellation of lights;
// env.T.revealLines, by hand: "It’s the little things that make a person who they are." / "And
// I remember every one of them." It resolves on that wide shot with the veil OPEN (the shell then
// offers "Keep going", and the film's curtain opens on the twenty candles).
// No list, no "she likes" words: the things speak for themselves.
//
// Prints are never graded: this movement draws straight to the screen (post: false — no bloom pass)
// and the print material is not tone-mapped, so a photo — and above all the owner's fan art —
// looks exactly as it is. Real photos have a plain white border; fan art keeps its stamp, so
// fiction never passes as a memory.
//
// Beats (≈30 s; reduced motion ≈24 s: no close-ups, a calm medium shot, the same reveal):
//   rise    0.0  the veil opens on the first light; the thread's head climbs; each thing appears as it
//                passes (sparkle), the camera following a little behind and further out
//   back   ≈13   the camera pulls far back and up: the whole spiral, a constellation; revealLines
//   hold         the wide shot, slowly turning, until the words have been read
// Contract: ./kit.js. Everything is made in build(); update() writes transforms, attributes and
// uniforms only. Dev: window.__LITTLE_DEV__ + ?at=back[&hold=<sec>].
import * as THREE from 'three';
import { createStrand, PathSampler, createRig, rng, TAU, lerp, damp, glowSprite, photoTexture } from './kit.js';
import { paintFrame, CARD_VERT, CARD_FRAG, FW, BORDER } from './nivin.js';

const BG = 0x0b0714;
// the spiral (metres): radius, height, turns
const R0 = 0.78, H = 3.3, TURNS = 1.75, A0 = -Math.PI * 0.62;
const OUT = 0.24;   // how far outside the thread each thing floats
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();

/** A point of the spiral at u (0…1) and its angle round the axis. */
function helix(u, out = new THREE.Vector3()) {
  const a = A0 + u * TURNS * TAU;
  const r = R0 * (1 - 0.18 * u);
  return out.set(Math.cos(a) * r, 0.15 + u * H, Math.sin(a) * r);
}
const helixAngle = (u) => A0 + u * TURNS * TAU;
/** Overshoot ease for a thing popping into place. */
const backOut = (k) => { const c = 1.6; const x = k - 1; return 1 + (c + 1) * x * x * x + c * x * x; };

function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d') }; }

/** A real photograph's print: a plain white border, a little paper tooth (no caption, no stamp). */
function paintPrint(R, aspect) {
  const B = 44;
  const winW = 512 - B * 2, winH = Math.round(winW / aspect);
  const W = 512, Hh = B + winH + B * 1.8;
  const { c, g } = cnv(W, Math.round(Hh));
  g.fillStyle = '#fbf7ef'; g.fillRect(0, 0, W, c.height);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '120,100,80' : '255,255,255'},${0.02 + R() * 0.04})`; g.fillRect(R() * W, R() * c.height, 1 + R() * 2, 1 + R() * 2); }
  g.fillStyle = '#2a2230'; g.fillRect(B, B, winW, winH);
  return { c, rect: new THREE.Vector4(B / W, 1 - (B + winH) / c.height, (W - B) / W, 1 - B / c.height) };
}

/** Watermelon flesh, rind and seeds, painted for the slice's faces (shape coordinates ±r). */
function paintMelon(R) {
  const { c, g } = cnv(256, 256);
  const cx = 128, cy = 128, r = 124;
  g.fillStyle = '#2f6d34'; g.fillRect(0, 0, 256, 256);
  const bands = [[1, '#3f8a3e'], [0.94, '#9fc47a'], [0.88, '#f1f0d8'], [0.84, '#f0657a'], [0.6, '#ff6f82']];
  for (const [k, col] of bands) { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r * k, 0, TAU); g.fill(); }
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * 0.84);
  gr.addColorStop(0, 'rgba(255,120,140,0.9)'); gr.addColorStop(1, 'rgba(230,70,95,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r * 0.84, 0, TAU); g.fill();
  for (let i = 0; i < 26; i++) {
    const a = R() * TAU, d = r * (0.3 + R() * 0.42);
    g.save(); g.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d); g.rotate(a);
    g.fillStyle = '#1c1210'; g.beginPath(); g.ellipse(0, 0, 4.2, 2.4, 0, 0, TAU); g.fill();
    g.restore();
  }
  return c;
}

/** Golden, blistered puri shell. */
function paintPuri(R) {
  const { c, g } = cnv(256, 128);
  g.fillStyle = '#d99a48'; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 260; i++) {
    const x = R() * 256, y = R() * 128, s = 2 + R() * 7;
    g.fillStyle = R() < 0.6 ? `rgba(240,190,110,${0.3 + R() * 0.4})` : `rgba(160,90,30,${0.2 + R() * 0.3})`;
    g.beginPath(); g.ellipse(x, y, s, s * 0.7, R() * 3, 0, TAU); g.fill();
  }
  return c;
}

/** The filling seen through a puri's broken top: potato, chickpeas, coriander, a sheen of pani. */
function paintFilling(R) {
  const { c, g } = cnv(128, 128);
  g.fillStyle = '#6b4a22'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(240,200,110,${0.6 + R() * 0.4})`; g.beginPath(); g.arc(R() * 128, R() * 128, 5 + R() * 7, 0, TAU); g.fill(); }
  for (let i = 0; i < 20; i++) { g.fillStyle = '#c99a52'; g.beginPath(); g.arc(R() * 128, R() * 128, 4 + R() * 2, 0, TAU); g.fill(); }
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(60,150,60,${0.7 + R() * 0.3})`; g.fillRect(R() * 128, R() * 128, 3 + R() * 4, 2 + R() * 2); }
  return c;
}

/** A displaced sphere (blistered puri, bumpy Manchurian ball): deterministic noise. */
function lumpy(geo, R, amp) {
  const p = geo.getAttribute('position');
  const seeds = Array.from({ length: 9 }, () => [R() * 6 - 3, R() * 6 - 3, R() * 6 - 3, 3 + R() * 6]);
  for (let i = 0; i < p.count; i++) {
    _v1.fromBufferAttribute(p, i);
    const n = _v1.clone().normalize();
    let d = 0;
    for (const [a, b, cc, f] of seeds) d += Math.sin(n.x * f + a) * Math.sin(n.y * f + b) * Math.sin(n.z * f + cc);
    _v1.addScaledVector(n, (d / seeds.length) * amp * _v1.length());
    p.setXYZ(i, _v1.x, _v1.y, _v1.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// ================================================================== build
export async function build(env) {
  const { tier } = env;
  const q = tier.quality;
  const reduced = !!tier.reduced;
  const envMap = env.envWarm;
  const dev = !!window.__LITTLE_DEV__;
  const R = rng(2027);
  const own = new Set();
  const keep = (x) => { own.add(x); return x; };
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return keep(t); };
  const phys = (o) => keep(q >= 1 ? new THREE.MeshPhysicalMaterial({ envMap, ...o }) : new THREE.MeshStandardMaterial((({ clearcoat, clearcoatRoughness, sheen, sheenColor, sheenRoughness, transmission, thickness, ior, ...rest }) => ({ envMap, ...rest }))(o)));
  const std = (o) => keep(new THREE.MeshStandardMaterial({ envMap, ...o }));
  const geo = (g) => keep(g);

  // ---------------------------------------------------------------- the space
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(0x0b0714, 0.06);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 120);
  const rig = createRig(camera, { breath: 0.6 });
  scene.add(new THREE.HemisphereLight(0x8f78c8, 0x24121c, 0.55));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.4);
  key.position.set(3, 6, 5);
  const rim = new THREE.DirectionalLight(0x9ab0ff, 1.2);
  rim.position.set(-4, 3, -5);
  const warm = new THREE.PointLight(0xffc27a, 6, 9, 2);
  warm.position.set(0, H * 0.5, 0);
  scene.add(key, rim, warm);

  // the far stars (they become the constellation's sky as the camera pulls back)
  const nStars = Math.round([260, 420, 600][q] * (reduced ? 0.6 : 1)); // (reduced motion: fewer twinkling stars)
  const starGeo = geo(new THREE.BufferGeometry());
  {
    const pos = new Float32Array(nStars * 3), tw = new Float32Array(nStars);
    for (let i = 0; i < nStars; i++) {
      const a = R() * TAU, y = -6 + R() * 18, r = 14 + R() * 22;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r;
      tw[i] = R();
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('aTw', new THREE.BufferAttribute(tw, 1));
  }
  const starU = { uTime: { value: 0 }, uBright: { value: 0.3 } };
  const stars = new THREE.Points(starGeo, keep(new THREE.ShaderMaterial({
    uniforms: starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aTw; uniform float uTime; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vA = 0.55 + 0.45 * sin(uTime * (0.6 + aTw) + aTw * 40.0);
        gl_PointSize = (1.4 + aTw * 2.2) * (300.0 / -mv.z) * 0.08 + 1.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uBright; varying float vA;
      void main(){
        vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d));
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * a * vA * uBright, 1.0);
      }`,
  })));
  stars.frustumCulled = false;
  scene.add(stars);

  // ---------------------------------------------------------------- the little things
  const gold = phys({ color: 0xf0c060, metalness: 1, roughness: 0.22, envMapIntensity: 1.4 });
  const things = []; // { group, base: scale, kind }
  const add = (group, kind, size) => { things.push({ group, kind, size }); scene.add(group); return group; };

  // 1 · a keyring with its charms (split ring, chain, a puffy star, a watermelon charm, a little bottle)
  {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(geo(new THREE.TorusGeometry(0.065, 0.0065, 10, 48)), gold);
    ring.position.y = 0.11;
    g.add(ring);
    const linkG = geo(new THREE.TorusGeometry(0.011, 0.0026, 6, 16));
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(linkG, gold); l.position.set(0, 0.04 - i * 0.017, 0); l.rotation.y = i % 2 ? Math.PI / 2 : 0; g.add(l); }
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.022 : 0.05; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const starM = new THREE.Mesh(geo(new THREE.ExtrudeGeometry(star, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3 })), phys({ color: 0xffcf3a, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
    starM.position.set(-0.03, -0.05, -0.01);
    starM.rotation.z = 0.25;
    g.add(starM);
    const charmBottle = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.014, 0.05, 4, 12)), phys({ color: 0x4fae6a, roughness: 0.08, transparent: true, opacity: 0.85, clearcoat: 1 }));
    charmBottle.position.set(0.045, -0.04, 0.0);
    g.add(charmBottle);
    add(g, 'keyring', 1.7);
  }

  // 2 · a fizzy green bottle (no label, no logo) with bubbles rising inside
  const bubbles = { mesh: null, n: 0, y: null, x: null, z: null, v: null };
  {
    const g = new THREE.Group();
    const prof = [[0, 0], [0.042, 0], [0.046, 0.008], [0.047, 0.11], [0.045, 0.13], [0.03, 0.17], [0.017, 0.2], [0.016, 0.235], [0.018, 0.24], [0.0, 0.24]];
    const glassG = geo(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 36));
    const glass = new THREE.Mesh(glassG, phys({ color: 0x3f9a5c, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.5, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.8, depthWrite: false }));
    glass.renderOrder = 2;
    const liqG = geo(new THREE.LatheGeometry([[0, 0.006], [0.04, 0.006], [0.042, 0.12], [0.028, 0.16], [0.0, 0.16]].map(([x, y]) => new THREE.Vector2(x, y)), 28));
    const liquid = new THREE.Mesh(liqG, std({ color: 0xc9e88a, roughness: 0.15, transparent: true, opacity: 0.55, emissive: new THREE.Color(0x3a5a10), emissiveIntensity: 0.35, depthWrite: false }));
    liquid.renderOrder = 1;
    const cap = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.019, 0.019, 0.022, 20)), std({ color: 0xc8d6c0, metalness: 0.85, roughness: 0.3 }));
    cap.position.y = 0.251;
    g.add(liquid, glass, cap);
    const n = Math.round([10, 18, 26][q] * (reduced ? 0.6 : 1));
    const bg = geo(new THREE.SphereGeometry(0.0035, 6, 4));
    const bm = new THREE.InstancedMesh(bg, std({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.8, emissive: new THREE.Color(0xeaffd0), emissiveIntensity: 0.4 }), n);
    bubbles.mesh = bm; bubbles.n = n;
    bubbles.y = new Float32Array(n); bubbles.x = new Float32Array(n); bubbles.z = new Float32Array(n); bubbles.v = new Float32Array(n);
    for (let i = 0; i < n; i++) { const a = R() * TAU, r = R() * 0.03; bubbles.x[i] = Math.cos(a) * r; bubbles.z[i] = Math.sin(a) * r; bubbles.y[i] = 0.01 + R() * 0.14; bubbles.v[i] = 0.02 + R() * 0.04; }
    g.add(bm);
    g.position.y = -0.12;
    const holder = new THREE.Group(); holder.add(g);
    add(holder, 'bottle', 1.8);
  }

  // 3 · a watermelon slice
  {
    const r = 0.13;
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.absarc(0, 0, r, Math.PI * 0.18, Math.PI * 0.82, false); sh.lineTo(0, 0);
    const g = geo(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 28 }));
    g.translate(0, -r * 0.55, -0.015);
    const melonTex = tex(paintMelon(R));
    melonTex.repeat.set(1 / (2 * r), 1 / (2 * r)); melonTex.offset.set(0.5, 0.5 + (r * 0.55) / (2 * r));
    const face = phys({ map: melonTex, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    const side = phys({ color: 0xee5a6e, roughness: 0.4 });
    const m = new THREE.Mesh(g, [face, side]);
    // the rind along the arc
    const arc = new THREE.CatmullRomCurve3(Array.from({ length: 24 }, (_, i) => { const a = Math.PI * (0.18 + (0.64 * i) / 23); return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r - r * 0.55, 0); }));
    const rind = new THREE.Mesh(geo(new THREE.TubeGeometry(arc, 40, 0.019, 8, false)), phys({ color: 0x3d7f3c, roughness: 0.45, clearcoat: 0.4 }));
    const grp = new THREE.Group(); grp.add(m, rind);
    add(grp, 'melon', 1.55);
  }

  // 4 · a plate of pani puri
  {
    const grp = new THREE.Group();
    const plate = new THREE.Mesh(geo(new THREE.LatheGeometry([[0, 0], [0.12, 0], [0.135, 0.012], [0.145, 0.016], [0.14, 0.018], [0.118, 0.006], [0, 0.006]].map(([x, y]) => new THREE.Vector2(x, y)), 48)), std({ color: 0xdfe3e8, metalness: 1, roughness: 0.22, envMapIntensity: 1.3 }));
    grp.add(plate);
    const shell = phys({ map: tex(paintPuri(R)), roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 });
    const fill = std({ map: tex(paintFilling(R)), roughness: 0.3 });
    const puriG = geo(lumpy(new THREE.SphereGeometry(0.03, 20, 14, 0, TAU, 0.42, Math.PI - 0.42), R, 0.05));
    const fillG = geo(new THREE.CircleGeometry(0.0125, 18));
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.3, d = i === n - 1 ? 0 : 0.065;
      const p = new THREE.Mesh(puriG, shell);
      const x = i === n - 1 ? 0 : Math.cos(a) * d, z = i === n - 1 ? 0 : Math.sin(a) * d;
      p.position.set(x, 0.033, z);
      p.scale.set(1, 0.86, 1);
      p.rotation.set((R() - 0.5) * 0.25, R() * TAU, (R() - 0.5) * 0.25);
      const f = new THREE.Mesh(fillG, fill);
      f.rotation.x = -Math.PI / 2;
      f.position.set(0, 0.026, 0);
      p.add(f);
      grp.add(p);
    }
    add(grp, 'panipuri', 1.7);
  }

  // 5 · a bowl of Manchurian, with its steam
  const steam = [];
  {
    const grp = new THREE.Group();
    const bowlG = geo(new THREE.LatheGeometry([[0, 0], [0.05, 0], [0.056, 0.006], [0.1, 0.05], [0.112, 0.075], [0.106, 0.077], [0.093, 0.052], [0.05, 0.014], [0, 0.014]].map(([x, y]) => new THREE.Vector2(x, y)), 48));
    grp.add(new THREE.Mesh(bowlG, phys({ color: 0xf3ead8, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 })));
    const sauce = new THREE.Mesh(geo(new THREE.CircleGeometry(0.09, 32)), phys({ color: 0x5a2410, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }));
    sauce.rotation.x = -Math.PI / 2; sauce.position.y = 0.055;
    grp.add(sauce);
    const ballG = geo(lumpy(new THREE.IcosahedronGeometry(0.021, 2), R, 0.16));
    const ballM = phys({ color: 0x6a2c12, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.15 });
    const spots = [[0, 0.075, 0], [0.04, 0.068, 0.02], [-0.035, 0.068, 0.03], [0.02, 0.066, -0.04], [-0.03, 0.067, -0.03], [0.045, 0.064, -0.015]];
    for (const [x, y, z] of spots) { const b = new THREE.Mesh(ballG, ballM); b.position.set(x, y, z); b.rotation.set(R() * 3, R() * 3, R() * 3); grp.add(b); }
    const onionG = geo(new THREE.TorusGeometry(0.008, 0.0025, 6, 14));
    const onionM = phys({ color: 0x6fbf4a, roughness: 0.4 });
    for (let i = 0; i < 7; i++) { const o = new THREE.Mesh(onionG, onionM); const a = R() * TAU, d = R() * 0.06; o.position.set(Math.cos(a) * d, 0.09 + R() * 0.01, Math.sin(a) * d); o.rotation.set(R() * 3, R() * 3, 0); grp.add(o); }
    for (let i = 0; i < [2, 3, 4][q]; i++) {
      const s = glowSprite(0xfff1e0, 0.12, { opacity: 0 });
      s.material.blending = THREE.NormalBlending;
      s.position.set((R() - 0.5) * 0.06, 0.12, (R() - 0.5) * 0.06);
      keep(s.material);
      grp.add(s);
      steam.push({ s, ph: R() });
    }
    add(grp, 'manchuria', 1.75);
  }

  // 6 · the prints: the owner's fan art (if any, stamped) and her real featured photographs
  const prints = [];
  const keyDirU = new THREE.Vector3(-0.35, 0.8, 0.5).normalize();
  const printMat = (map, frame, rect) => keep(new THREE.ShaderMaterial({
    uniforms: {
      uPhoto: { value: map }, uFrame: { value: frame }, uRect: { value: rect }, uDevelop: { value: 1 }, uGlow: { value: 0 },
      uLight: { value: 1.0 }, uFade: { value: 1 }, uKeyDir: { value: keyDirU }, uSheen: { value: 0.2 },
    },
    vertexShader: CARD_VERT, fragmentShader: CARD_FRAG, side: THREE.DoubleSide, transparent: true, toneMapped: false,
  }));
  const printMesh = (w, h, m) => { const o = new THREE.Mesh(geo(new THREE.PlaneGeometry(w, h)), m); o.renderOrder = 3; return o; };
  for (const { texture: t, caption } of (env.shared && env.shared.fanPhotos) || []) {
    const img = t.image || {};
    const iw = img.naturalWidth || img.width || 4, ih = img.naturalHeight || img.height || 3;
    const aspect = iw / ih;
    // (the same caption as the photoshoot's print: the image's own, else the chapter's)
    const f = paintFrame(R, env.fill(caption || env.T.photoCaption || ''), aspect);
    const w = (aspect >= 1 ? 0.3 : 0.3 * aspect) * FW / (FW - BORDER * 2), h = (w * f.c.height) / FW;
    const m = printMat(t, tex(f.c), f.rect);
    const g = new THREE.Group(); g.add(printMesh(w, h, m));
    prints.push({ group: g, mat: m, kind: 'fanart' });
  }
  const featured = (env.ctx.featured ? env.ctx.featured() : []).filter((p) => p && !p.isPlaceholder && p.url);
  const extra = (env.ctx.realPhotos ? env.ctx.realPhotos() : []).filter((p) => p && p.url && !featured.includes(p));
  const photos = [...featured, ...extra].slice(0, [5, 6, 8][q]);
  for (const p of photos) {
    let t;
    try { t = keep(await photoTexture(env.ctx, p, 360)); } catch (e) { continue; }
    env.guard();
    const img = t.image || {};
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!(iw > 0 && ih > 0)) continue;
    const aspect = iw / ih;
    const f = paintPrint(R, aspect);
    const w = aspect >= 1 ? 0.3 : 0.3 * aspect + 0.03, h = (w * f.c.height) / 512;
    const m = printMat(t, tex(f.c), f.rect);
    const g = new THREE.Group(); g.add(printMesh(w, h, m));
    prints.push({ group: g, mat: m, kind: 'photo' });
  }
  for (const pr of prints) add(pr.group, pr.kind, 1.2);

  // ---------------------------------------------------------------- along the spiral
  const N = things.length;
  // the five objects first, then the fan art, then her photographs, evenly up the spiral
  const us = things.map((_, i) => 0.05 + (0.9 * i) / Math.max(1, N - 1));
  const pathPts = [];
  for (let i = 0; i <= 90; i++) pathPts.push(helix(i / 90, new THREE.Vector3()));
  pathPts.unshift(helix(0).clone().add(_v1.set(-0.6, -1.4, 0.8)));
  pathPts.push(helix(1).clone().add(_v1.set(0.2, 0.8, -0.2)), new THREE.Vector3(0.1, H + 2.4, -0.6));
  const path = new PathSampler(pathPts, { samples: 2000 });
  const strand = createStrand({ segments: [140, 200, 260][q] });
  const STRAND_OPTS = { wobble: 0.6 };
  strand.uniforms.uWidth.value = 0.34;
  scene.add(strand.mesh);
  const head = glowSprite(0xffd890, 0.5, { opacity: 0 });
  keep(head.material);
  scene.add(head);
  things.forEach((t, i) => {
    const u = us[i];
    const a = helixAngle(u);
    helix(u, _v2);
    t.u = u; t.a = a;
    t.s = path.closest(_v2);
    t.home = new THREE.Vector3(_v2.x + Math.cos(a) * OUT, _v2.y + (i % 2 ? 0.05 : -0.05), _v2.z + Math.sin(a) * OUT);
    t.group.position.copy(t.home);
    t.ph = R() * TAU;
    t.glow = glowSprite(t.kind === 'photo' || t.kind === 'fanart' ? 0xffd9a0 : 0xffc890, 0.75, { opacity: 0 });
    keep(t.glow.material);
    t.glow.position.copy(t.home);
    scene.add(t.glow);
    t.k = 0; // 0 hidden … 1 here
  });

  // ---------------------------------------------------------------- state
  const W = { s1: 0, thread: 0, stars: 0.3, glow: 0, wide: 0, spin: 0 };
  const C = { ang: helixAngle(us[0]) + 0.42, r: 2.35, hy: things[0].home.y, up: 0.22, lookR: 0.7 };
  let held = false, heldT = 0, fresh = 0, lastPop = -1;

  /**
   * The wide shot for this screen: the whole spiral (and the things round it) between the progress
   * dots and the subtitle band — it fills NDC y −0.5…0.88, so the words never sit on it.
   */
  const WIDE_LIFT = 0.19;
  function wideDist() {
    const tv = Math.tan((camera.fov * Math.PI) / 360), th = tv * camera.aspect;
    const hh = (H * 0.5 + 0.45) / 0.69, hw = (R0 + OUT + 0.4) / 0.9;
    return Math.max(hh / tv, hw / th);
  }

  const api = {
    id: 'reveal', scene, camera, exposure: 1,
    post: false, // straight to the screen: the prints (and any fan art) are never put through bloom
    late: [],
    update, resize, play, dispose,
    dev: dev ? { W, C, things, held: false } : null,
  };

  function update(dt, t) {
    if (held) {
      if (fresh <= 0) return;
      fresh--; t = heldT; dt = 0;
    }
    // the thread and its head
    const s1 = W.s1;
    strand.uniforms.uOpacity.value = W.thread;
    if (W.thread > 0.001) strand.update(path, Math.max(0, s1 - path.length), Math.max(0.05, s1), t, STRAND_OPTS);
    strand.mesh.visible = W.thread > 0.001;
    path.at(s1, _v1);
    head.position.copy(_v1);
    head.material.opacity = W.thread * (1 - W.wide * 0.7);
    // each thing appears as the head passes it, then floats and turns gently
    for (let i = 0; i < N; i++) {
      const th = things[i];
      const target = s1 >= th.s - 0.02 ? 1 : 0;
      if (target && th.k === 0 && i !== lastPop) { lastPop = i; onPop(th, i); }
      th.k = target ? Math.min(1, th.k + dt / 0.75) : 0;
      const e = th.k > 0 ? backOut(th.k) : 0;
      const g = th.group;
      g.scale.setScalar(Math.max(1e-4, e * th.size));
      g.position.set(th.home.x, th.home.y + Math.sin(t * 0.8 + th.ph) * 0.02, th.home.z);
      // prints always turn to the camera (a print is never seen from its back); the objects turn slowly
      const card = th.kind === 'photo' || th.kind === 'fanart';
      const yaw = card
        ? Math.atan2(camera.position.x - th.home.x, camera.position.z - th.home.z) + Math.sin(t * 0.35 + th.ph) * 0.08
        : -th.a + Math.PI / 2 + Math.sin(t * 0.35 + th.ph) * 0.25 + W.spin * 0.6 + t * 0.15;
      g.rotation.set(Math.sin(t * 0.5 + th.ph) * (card ? 0.03 : 0.06), yaw, Math.sin(t * 0.4 + th.ph * 2) * (card ? 0.03 : 0.05));
      th.glow.material.opacity = th.k * (0.14 + 0.5 * W.glow) * (0.85 + 0.15 * Math.sin(t * 1.3 + th.ph));
      th.glow.scale.setScalar(0.5 + 0.9 * W.glow);
    }
    // the bottle's bubbles
    if (bubbles.mesh) {
      for (let i = 0; i < bubbles.n; i++) {
        bubbles.y[i] += bubbles.v[i] * dt;
        if (bubbles.y[i] > 0.155) bubbles.y[i] = 0.012;
        _v2.set(bubbles.x[i] + Math.sin(t * 3 + i) * 0.002, bubbles.y[i], bubbles.z[i]);
        _q1.identity();
        _m.compose(_v2, _q1, _v3.setScalar(0.6 + 0.4 * ((i * 7) % 5) / 5));
        bubbles.mesh.setMatrixAt(i, _m);
      }
      bubbles.mesh.instanceMatrix.needsUpdate = true;
    }
    // the steam over the Manchurian
    for (const st of steam) {
      const k = (t * 0.22 + st.ph) % 1;
      st.s.position.y = 0.1 + k * 0.22;
      st.s.material.opacity = Math.sin(Math.PI * k) * 0.22;
      st.s.scale.setScalar(0.08 + k * 0.16);
    }
    starU.uTime.value = t; starU.uBright.value = W.stars;
    // the camera: outside the spiral, a little ahead of the head, looking at the thing just lit;
    // then far back and up to the whole spiral (the constellation)
    const headAng = Math.atan2(_v1.z, _v1.x);
    if (dt > 0) { C.ang += Math.atan2(Math.sin(headAng + 0.42 - C.ang), Math.cos(headAng + 0.42 - C.ang)) * (1 - Math.exp(-(reduced ? 0.8 : 1.6) * dt)); }
    C.hy = dt > 0 ? damp(C.hy, _v1.y, 1.6, dt) : C.hy;
    const ang = C.ang + W.spin;
    const r = lerp(C.r, wideDist(), W.wide);
    const y = lerp(C.hy + C.up, H * 0.5 + 0.4, W.wide);
    rig.pos.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
    // (looking at a point between the head and the axis: the thing just lit sits near the centre)
    const lk = (1 - W.wide) * C.lookR;
    // (wide: looking below the spiral's middle lifts it clear of the words at the bottom)
    const wideLook = H * 0.5 + 0.15 - WIDE_LIFT * wideDist() * Math.tan((camera.fov * Math.PI) / 360);
    rig.look.set(Math.cos(headAng) * lk * (1 - W.wide), lerp(C.hy, wideLook, W.wide), Math.sin(headAng) * lk * (1 - W.wide));
    rig.breath = reduced ? 0 : 0.6;
    rig.apply(t);
    camera.updateMatrixWorld();
  }

  function onPop(th, i) {
    if (!th) return;
    env.sfx(th.kind === 'photo' ? (i % 2 ? 'sparkle' : 'chime') : th.kind === 'fanart' ? 'shimmer' : 'sparkle', { volume: 0.5 });
  }

  function resize({ aspect }) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- choreography helpers
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
  const lines = (k) => (env.T[k] || []).map((l) => env.fill(l)).filter(Boolean);
  const say = (k, o = {}) => { const l = lines(k); return l.length ? env.narrate(l, { style: 'hand', ...o }) : wait(o.empty ?? 3); };
  const sEnd = () => things[N - 1].s + 0.25;

  async function play(dir) {
    const params = dev ? new URLSearchParams(location.search) : null;
    const at = params ? params.get('at') : null;
    if (dev) {
      const list = (params.get('holds') || params.get('hold') || '').split(',').map(parseFloat).filter((x) => x >= 0);
      list.forEach((h) => later(h, () => { env.gsap.globalTimeline.pause(); held = true; heldT = env.time; fresh = 3; api.dev.held = true; }));
    }
    env.mood('wonder');
    const climb = reduced ? 7.5 : 12.5;
    if (at === 'back') {
      W.s1 = sEnd(); W.thread = 1; W.stars = 0.6;
      things.forEach((t) => { t.k = 1; }); lastPop = N - 1;
      dir.veil(0, { duration: 0.3 });
    } else {
      if (reduced) Object.assign(C, { r: 3.4, up: 0.4, lookR: 0.3 });
      W.s1 = Math.max(0, things[0].s - 0.35);
      dir.veil(0, { duration: reduced ? 0.9 : 1.6 });
      tw(W, { thread: 1, duration: 0.8 });
      env.sfx('jingle', { volume: 0.6 });
      await wait(0.5);
      // the climb: the head runs up the spiral, the things appearing one by one
      tw(W, { s1: sEnd(), duration: climb, ease: 'sine.inOut' });
      tw(C, { r: reduced ? 3.8 : 2.9, up: 0.35, duration: climb, ease: 'sine.inOut' });
      tw(W, { stars: 0.55, duration: climb });
      await wait(climb * 0.92);
    }
    // the pull-back: the whole spiral, a little constellation; the words
    env.sfx('swell', { volume: 0.5 });
    tw(W, { wide: 1, duration: reduced ? 4 : 6.5, ease: 'sine.inOut' });
    tw(W, { glow: 1, stars: 1, duration: 5 });
    tw(W, { spin: reduced ? 0.25 : 0.7, duration: 22, ease: 'sine.out' });
    await wait(reduced ? 1.8 : 3.0);
    await say('revealLines');
    await wait(2.2);
    // (the shell now offers "Keep going" over this held wide shot; the veil stays open — next, the cake)
  }

  function dispose() {
    strand.dispose();
    for (const x of own) { try { x.dispose(); } catch (e) { /* ignore */ } }
    own.clear();
    scene.clear();
  }

  // ---------------------------------------------------------------- the warm-up
  // every thing at full size, the thread drawn, the wide shot: compiles and uploads all of it
  things.forEach((t) => { t.k = 1; });
  W.s1 = sEnd(); W.thread = 1; W.wide = 1; W.glow = 1;
  update(1 / 60, 0);
  things.forEach((t) => { t.k = 0; });
  Object.assign(W, { s1: 0, thread: 0, wide: 0, glow: 0, stars: 0.3, spin: 0 });
  lastPop = -1;
  return api;
}

const _m = new THREE.Matrix4();
