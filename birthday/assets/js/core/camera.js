// The virtual camera of the 2D chapters. Layers that declare a depth (class `cam-layer`, inline
// `--depth`) shift against a smoothed pointer on a desktop, so the world has parallax depth: far
// layers barely move, near ones a little more (at most `range` px × depth).
//
// Cheap by construction (measured: tests/e2e/motion.cjs, docs/ARCHITECTURE.md "Motion language"):
// it writes only the individual `translate` property of the few depth layers, and while it is
// active those layers are composited (will-change), so a camera move is a compositor move: no
// repaint, and no style recalculation of the rest of the chapter. `translate` composes with each
// layer's own transform animations. The rAF loop runs only while the camera is settling.
//
// It never moves text and never needs hover: on touch screens, with reduced motion or on
// low-power devices it does nothing (and touches nothing).
//   const cam = attachCamera(el, { device, range: 12 });  …  cam.offset() → { x, y } px;  cam.destroy();

export function attachCamera(root, { device = {}, range = 12 } = {}) {
  const fine = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!root || device.reducedMotion || device.tier === 'low' || !fine) return { active: false, offset: () => ({ x: 0, y: 0 }), destroy() {} };
  let tx = 0;
  let ty = 0;
  let x = 0;
  let y = 0;
  let raf = 0;
  let last = 0;
  let layers = [];
  let checked = -Infinity;
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  // the chapter builds its layers over time: look again at most once a second
  const refresh = () => {
    layers = [...root.querySelectorAll('.cam-layer')].map((el) => ({ el, depth: parseFloat(el.style.getPropertyValue('--depth')) || 0 }));
    for (const l of layers) l.el.style.willChange = 'translate';
  };
  const onMove = (e) => {
    if (e.timeStamp - checked > 1000) { checked = e.timeStamp; refresh(); }
    if (!layers.length) return; // chapters without depth layers (the 3D ones have their own cameras) cost nothing
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    tx = Math.max(-1, Math.min(1, (e.clientX / w - 0.5) * 2));
    ty = Math.max(-1, Math.min(1, (e.clientY / h - 0.5) * 2));
    kick();
  };
  const onLeave = () => { tx = 0; ty = 0; kick(); };
  function tick(t) {
    const dt = last ? Math.min(0.25, (t - last) / 1000) : 1 / 60; // real time: same feel on slow devices (stable: k < 1)
    last = t;
    const k = 1 - Math.exp(-dt * 2.6); // a heavy camera: it eases after the pointer, never snaps
    x += (tx - x) * k;
    y += (ty - y) * k;
    const cx = x * range;
    const cy = y * range * 0.6;
    for (const l of layers) {
      if (l.el.isConnected) l.el.style.translate = `${(-cx * l.depth).toFixed(2)}px ${(-cy * l.depth).toFixed(2)}px`;
    }
    if (Math.abs(tx - x) + Math.abs(ty - y) > 0.002) raf = requestAnimationFrame(tick);
    else { raf = 0; last = 0; }
  }
  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  return {
    active: true,
    offset: () => ({ x: Math.round(x * range * 100) / 100, y: Math.round(y * range * 0.6 * 100) / 100 }),
    destroy() {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
      raf = 0;
      for (const l of layers) { l.el.style.removeProperty('translate'); l.el.style.removeProperty('will-change'); }
      layers = [];
    },
  };
}
