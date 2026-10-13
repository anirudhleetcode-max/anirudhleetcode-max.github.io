// The countdown's little companion: Deepu's own figurine (scenes/little/figure.js — the same figure as
// "What Makes You, You", her long loose hair in one silky mass) standing at the end of a small jetty
// on the lantern lake, seen from behind, watching the big lantern and waiting for midnight with her.
//
// Optional by design: it is loaded after the countdown is already on screen (the countdown never waits
// for it), only on devices that can afford a second WebGL canvas (tier ≠ 'low'), and any failure —
// no WebGL, a lost context, a module that does not arrive — simply leaves the lake without her.
//
//   const girl = await createGirl(host, { device, signal })   → null when she cannot be shown
//   girl.look(clientX, clientY)   she turns her head toward a point on the screen (eyes lead)
//   girl.react(kind)              'smile' | 'delight' | 'surprise' — a short expression, then back
//   girl.midnight(clientX, clientY)  she looks up and reaches toward the lantern, delighted
//   girl.dispose()                stops the loop, frees every GPU resource, removes the canvas
//
// One render loop (paused while the tab is hidden), ~30 fps on phones, nothing allocated per frame.

export async function createGirl(host, { device = {}, signal = null } = {}) {
  if (device.tier === 'low') return null;
  let THREE;
  let figMod;
  let kit;
  try {
    [THREE, figMod, kit] = await Promise.all([import('three'), import('../little/figure.js'), import('../little/kit.js')]);
  } catch (err) {
    console.warn('[gate] the figure did not load', err);
    return null;
  }
  if (signal && signal.aborted) return null;

  const canvas = document.createElement('canvas');
  canvas.className = 'gw-girl-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: device.tier === 'high', stencil: false, powerPreference: 'low-power' });
  } catch (err) {
    console.warn('[gate] no WebGL for the figure', err);
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const q = device.tier === 'high' ? 1 : 0;
  let env = null;
  try { env = kit.makeEnvironment(renderer, 'night'); } catch { env = null; } // (a PMREM render target)
  const fig = figMod.createFigure({ tier: { quality: q, shadows: false } }, { quality: q, shadows: false, envMap: env ? env.texture : null });
  scene.add(fig.group);
  fig.pose('stand', 1);

  // the jetty under her feet: a few warm planks running out into the water, seen end-on
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3226, roughness: 0.85, metalness: 0 });
  const plankGeo = new THREE.BoxGeometry(0.22, 0.05, 1.9);
  const planks = new THREE.Group();
  for (let i = -2; i <= 2; i++) {
    const p = new THREE.Mesh(plankGeo, wood);
    p.position.set(i * 0.235, -0.03, 0.55);
    p.rotation.y = (i % 2) * 0.01;
    planks.add(p);
  }
  const postGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.7, 10);
  for (const x of [-0.62, 0.62]) {
    const post = new THREE.Mesh(postGeo, wood);
    post.position.set(x, -0.25, -0.35);
    planks.add(post);
  }
  scene.add(planks);

  // night lighting that matches the lake: a cool moon from above, the big lantern's warm glow ahead
  // of her (she is lit from the front, the side we glimpse when she turns), a lilac rim behind
  scene.add(new THREE.HemisphereLight(0x8d86c9, 0x1b1230, 0.9));
  const moon = new THREE.DirectionalLight(0xc8c4ff, 0.9);
  moon.position.set(-1.5, 3, 2);
  scene.add(moon);
  const lantern = new THREE.PointLight(0xffb35c, 2.2, 8, 1.6);
  lantern.position.set(0, 2.6, -3.2);
  scene.add(lantern);
  const rim = new THREE.DirectionalLight(0xe6b8ff, 0.7);
  rim.position.set(1.2, 1.6, 2.5);
  scene.add(rim);

  // the camera stands behind her on the shore, a little low, looking out across the lake past her
  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 30);
  camera.position.set(0.6, 1.35, 5.4);
  const aim = new THREE.Vector3(0, 0.78, 0);
  camera.lookAt(aim);
  fig.group.rotation.y = Math.PI; // she faces the lake (away from us)

  const mobile = !!device.mobile;
  const reduced = !!device.reducedMotion;
  const ndc = new THREE.Vector3();
  const look = new THREE.Vector3();
  let w = 0;
  let h = 0;
  const resize = () => {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    w = r.width;
    h = r.height;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // idle life: the figure itself breathes, blinks and lets its hair settle (fig.update); on top of that
  // she now and then glances somewhere new — the big lantern, the far lanterns, back again
  const gazes = [[0, 2.4, -6], [-1.6, 0.8, -4], [1.7, 0.9, -4], [0, 1.9, -6]];
  let gazeAt = 0;
  let gazeIdx = 0;
  let exprUntil = 0;
  let midnightOn = false;
  fig.lookAt(look.set(...gazes[0]), 2);
  fig.settle(1.2);

  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let t = 0;
  let alive = true;
  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; canvas.style.opacity = '0'; });
  const frameDt = mobile ? 1 / 30 : 1 / 60;
  const loop = (now) => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (document.hidden || lost) { last = now; return; }
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); // (a frame stamped before 'last' counts as 0)
    last = now;
    acc += dt;
    if (acc < frameDt * 0.92) return;
    const step = Math.min(acc, 0.1);
    acc = 0;
    t += step;
    if (!midnightOn && t > gazeAt) {
      gazeIdx = (gazeIdx + 1) % gazes.length;
      fig.lookAt(look.set(...gazes[gazeIdx]), reduced ? 1.2 : 1.8);
      gazeAt = t + 5 + (gazeIdx % 2) * 3;
    }
    if (exprUntil && t > exprUntil) { fig.expression('neutral', 1); exprUntil = 0; }
    fig.update(step, t);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  /** screen point → a world point in front of her, at the lake's depth */
  const toWorld = (cx, cy, depth = 4) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / Math.max(1, r.width)) * 2 - 1, -(((cy - r.top) / Math.max(1, r.height)) * 2 - 1), 0.5).unproject(camera);
    ndc.sub(camera.position).normalize();
    return look.copy(camera.position).addScaledVector(ndc, depth + 3);
  };

  return {
    canvas,
    look(cx, cy) {
      if (!alive || midnightOn) return;
      fig.lookAt(toWorld(cx, cy), reduced ? 2 : 4);
      gazeAt = t + 3.5;
    },
    react(kind = 'smile') {
      if (!alive) return;
      fig.expression(kind, 1);
      exprUntil = t + (kind === 'delight' ? 2.2 : 1.6);
    },
    midnight(cx, cy) {
      if (!alive) return;
      midnightOn = true;
      const p = toWorld(cx, cy, 5);
      fig.lookAt(p, 2.5);
      fig.expression('delight', 1);
      exprUntil = 0;
      // her right hand rises toward the lantern (eased IK), then settles a little lower
      fig.reach('R', look.set(0.28, 1.55, -0.55), 0.85, reduced ? 2 : 1);
    },
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      try { fig.dispose(); } catch { /* ignore */ }
      plankGeo.dispose();
      postGeo.dispose();
      wood.dispose();
      try { env?.dispose(); } catch { /* ignore */ }
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* ignore */ }
      canvas.remove();
    },
  };
}
