// Shared pieces for "The Little Things" (scenes/little.js) — the chapter where three of the
// little things she loves become three 3D moments on the golden thread: a keyring of cute
// charms (keychains), a cold fizzy green bottle (Sprite), and a warm night street of music and
// memories (inspired by — never copied from — Twinkling Watermelon).
//
// THE MOVEMENT CONTRACT. Each movement module (little/keychains.js, little/fizz.js,
// little/night.js) exports `async function build(env)` returning:
//   {
//     id,                          // 'keychains' | 'sprite' | 'night'
//     scene, camera,               // its own world (lights, fog, background) and lens
//     exposure: 1,                 // tone-mapping exposure while it plays (may be animated)
//     bloom: { strength, radius, threshold },  // used on the high tier only (bloom composer)
//     post: false,                 // optional: draw straight to the screen, never through the bloom
//                                  // composer (e.g. a movement showing fan art that must stay untouched)
//     late: [],                    // Object3Ds hidden at first and shown later: warmed up at setup
//     overlay: { scene, camera? }, // optional: drawn last, straight to the screen (no bloom, no tone
//                                  // mapping) — for things that must look exactly like their image
//     update(dt, t),               // every frame while it is the active movement
//     resize({ w, h, aspect, portrait }),      // reframe for the screen (called for every movement)
//     async play(dir),             // the choreography; resolves when it hands off to the next one
//     dispose(),                   // free geometries, materials, textures it created
//   }
// `env` (built once by the shell) gives every movement the same tools:
//   THREE, gsap, renderer, ctx (the film ctx: text, fill, audio, fx, ui, photos, …),
//   tier { quality 0|1|2, low, mobile, reduced, shadows }, envMap (a PMREM texture),
//   T (this chapter's words, defaults merged with messages.json → "little"), size {w,h,aspect,portrait},
//   wait(sec), to(target, vars), timeline(vars), later(sec, fn), guard(), sfx(name, opts), mood(m),
//   narrate(lines, opts), fill(str), memories (the owner's real memories + their linked photos).
//   wait/to/timeline/later are tracked by the shell and torn down when the chapter ends; a
//   movement must never keep its own requestAnimationFrame loop or untracked timers.
// `dir` (the director) is the shell's control of the frame: dir.veil(opacity, { duration, color })
// fades the full-screen veil (black by default) and resolves when done. The chapter begins
// veiled; a movement reveals itself and, at its end, covers (or hands off) for the next one.
//
// Rules every movement follows: original art only (no logos, no copied characters, scenes,
// artwork or music); no invented memories; only the platonic best-friend tone; transform /
// opacity / uniforms in the loop, nothing allocated per frame; counts scaled by tier; reduced
// motion keeps the objects and the story with gentler, shorter camera work.
import * as THREE from 'three';
import { radialTexture, starTexture, rng } from '../cake/textures.js';
export { createStrand, PathSampler } from '../cake/strand.js';
export { rng };

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, k) => a + (b - a) * k;
/** Frame-rate independent exponential approach (lambda: 1/s). */
export const damp = (cur, target, lambda, dt) => target + (cur - target) * Math.exp(-lambda * dt);

/**
 * A pre-filtered environment for reflections, from a small procedural "studio".
 * preset: 'warm' (soft golden key, cool rim — charms, glass) or 'night' (sodium lamps, indigo sky).
 */
export function makeEnvironment(renderer, preset = 'warm') {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
  const pos = dome.geometry.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const top = preset === 'night' ? [0.05, 0.06, 0.16] : [0.16, 0.1, 0.22];
  const mid = preset === 'night' ? [0.12, 0.08, 0.14] : [0.36, 0.2, 0.18];
  const bot = preset === 'night' ? [0.03, 0.025, 0.04] : [0.08, 0.05, 0.06];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 40;
    const k = y > 0 ? y : -y;
    const a = y > 0 ? top : bot;
    for (let c = 0; c < 3; c++) col[i * 3 + c] = mid[c] + (a[c] - mid[c]) * Math.pow(k, 0.6);
  }
  dome.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  env.add(dome);
  const panel = (w, h, rgb, p, look = new THREE.Vector3(0, 0, 0)) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), side: THREE.DoubleSide }));
    m.position.copy(p); m.lookAt(look); env.add(m);
  };
  if (preset === 'night') {
    panel(10, 4, [2.4, 1.3, 0.55], new THREE.Vector3(-8, 9, 10));       // a sodium street lamp
    panel(6, 3, [1.8, 0.9, 0.45], new THREE.Vector3(12, 5, -6));
    panel(16, 8, [0.35, 0.42, 1.1], new THREE.Vector3(10, 10, -16));     // the indigo sky
    panel(5, 2, [1.6, 0.35, 0.45], new THREE.Vector3(-14, 3, -8));       // a warm red-pink sign
    panel(5, 2, [0.4, 1.3, 0.6], new THREE.Vector3(15, 2.5, 6));         // a green glow
  } else {
    panel(18, 8, [2.8, 1.75, 0.9], new THREE.Vector3(-6, 10, 16));       // warm soft key
    panel(10, 4, [1.5, 0.95, 0.5], new THREE.Vector3(12, 4, 12));
    panel(40, 4, [1.2, 0.75, 0.4], new THREE.Vector3(0, 1.5, 22), new THREE.Vector3(0, 1.5, 0));
    panel(14, 10, [0.45, 0.55, 1.3], new THREE.Vector3(14, 8, -16));     // cool rim
    panel(8, 8, [0.6, 1.2, 0.8], new THREE.Vector3(-16, 5, -8));         // a hint of fresh green
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.04);
  pmrem.dispose();
  env.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt;
}

let sharedGlow = null;
let sharedStar = null;
/** One soft radial glow texture / one 4-point star texture, shared by every movement. */
export function glowTexture() { return sharedGlow || (sharedGlow = radialTexture({ size: 128, inner: 'rgba(255,255,255,1)', mid: 'rgba(255,255,255,0.3)', outer: 'rgba(255,255,255,0)', midStop: 0.3 })); }
export function glintTexture() { return sharedStar || (sharedStar = starTexture(128)); }
export function disposeShared() { sharedGlow?.dispose(); sharedStar?.dispose(); sharedGlow = sharedStar = null; }

/** An additive glow / glint billboard (a halo round a lamp, a sparkle on metal). */
export function glowSprite(color = 0xffe2a0, size = 0.5, { star = false, opacity = 1 } = {}) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: star ? glintTexture() : glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity }));
  s.scale.setScalar(size);
  return s;
}

/**
 * Words drawn onto a canvas texture (a paper tag, a cassette label): handwriting by default.
 * Uses the page's loaded fonts (Caveat for handwriting). Returns { texture, aspect }.
 */
export function textTexture(text, { font = '600 120px "Caveat", cursive', color = '#3a2147', bg = null, pad = 40, width = 0, height = 0 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font;
  const m = g.measureText(text || ' ');
  const size = parseFloat(String(font).match(/(\d+)px/)?.[1] || 120);
  c.width = width || Math.ceil(m.width + pad * 2);
  c.height = height || Math.ceil(size * 1.5 + pad);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  g.font = font;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text || '', c.width / 2, c.height / 2 + size * 0.05);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, aspect: c.width / c.height, canvas: c };
}

/** A real photo as a texture (the display copy a slot `cssWidth` wide would load). */
export async function photoTexture(ctx, photo, cssWidth = 512) {
  const src = ctx.photoSrc ? ctx.photoSrc(photo, cssWidth) : photo.url;
  const img = await ctx.preload(src);
  const texture = new THREE.Texture(img);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** The owner's finished fan-art images (admin → Photos → Fan art), at most two, in order. */
export const fanArtOf = (ctx) => ((ctx && ctx.photos ? ctx.photos('fanart') : []) || []).filter((p) => p && !p.isPlaceholder && p.url).slice(0, 2);
/** Dev only (tests, screenshots): …&fanart=test stands in no-face test cards for the fan-art image. */
export const devFanArt = () => !!window.__LITTLE_DEV__ && /[?&]fanart=test\b/.test(location.search);

/**
 * A camera rig: position, look-at target, field of view and a gentle hand-held breath.
 * Tween rig.pos / rig.look / rig.fov with env.to(...); call rig.apply(t) once per frame.
 */
export function createRig(camera, { breath = 1 } = {}) {
  const rig = {
    pos: camera.position.clone(),
    look: new THREE.Vector3(),
    fov: camera.fov,
    roll: 0,
    breath,
    apply(t) {
      const b = rig.breath;
      camera.position.set(
        rig.pos.x + Math.sin(t * 0.37) * 0.012 * b,
        rig.pos.y + Math.sin(t * 0.29 + 1.3) * 0.009 * b,
        rig.pos.z + Math.sin(t * 0.23 + 2.1) * 0.008 * b,
      );
      camera.up.set(Math.sin(rig.roll), Math.cos(rig.roll), 0);
      camera.lookAt(rig.look);
      if (Math.abs(camera.fov - rig.fov) > 1e-4) { camera.fov = rig.fov; camera.updateProjectionMatrix(); }
    },
  };
  return rig;
}

/**
 * The owner's real memories with their linked photos (the "How it began" chapter's data):
 * [{ id, kind, text, photos: [photo…] }] in film order. Nothing here is invented.
 */
export function memoriesWithPhotos(ctx, memories) {
  const story = (ctx.photos ? ctx.photos('story') : []).filter((p) => !p.isPlaceholder);
  return memories
    .map((m) => ({ id: m.id, kind: m.kind, text: ctx.fill ? ctx.fill(m.text || '') : (m.text || ''), photos: story.filter((p) => p.memory === m.id) }))
    .filter((m) => m.text || m.photos.length);
}
