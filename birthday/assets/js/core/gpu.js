// GPU readiness for the film's WebGL chapters (three.js).
//
// prewarm(): before a chapter is seen, compile every shader program it will ever use — for the
// pipeline it really draws through — and push its textures and buffers to the GPU, so no
// first-use stall can land in the middle of an interaction. Two details matter (measured on the
// cake, docs/ARCHITECTURE.md "GPU warm-up"):
//   · objects that only appear later (a knife, a cut slice, a plate) are hidden at warm-up, and
//     three.js skips hidden objects — so they are shown for the warm-up and hidden again;
//   · a composer (bloom) draws the scene into a render target, which needs different program
//     variants (linear output, no tone mapping) from drawing to the screen — so the compile runs
//     with the composer's target bound.
// Where the browser supports parallel shader compilation the compile happens off the main
// thread (renderer.compileAsync); one real frame then uploads textures, buffers and shadow maps.
// Call it while the chapter is still veiled: the warm-up frame is never meant to be seen.
//
// createFrameGovernor(): a one-time quality check while a chapter is still veiled. If frames are
// slow at this pixel ratio, the resolution steps down (at most twice) — before anything is
// visible, never mid-scene — so a slower GPU gets a smooth film rather than a sharp, juddery one.
// It never goes below minRatio: a ratio already at the floor cannot step, so a caller that wants a
// 1× screen to have a fallback gives it a floor below 1 (the 3D chapters' high tier: 0.75).

export async function prewarm({ renderer, scene, camera, composer = null, show = [], signal = null } = {}) {
  const hidden = show.filter((o) => o && o.visible === false);
  hidden.forEach((o) => { o.visible = true; });
  try {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(composer ? composer.renderTarget1 : null);
    let pending = null;
    // (without the parallel-compile extension compileAsync gains nothing and three.js logs a warning)
    const parallel = !!(renderer.compileAsync && renderer.extensions?.has?.('KHR_parallel_shader_compile'));
    try {
      pending = parallel ? renderer.compileAsync(scene, camera) : (renderer.compile(scene, camera), null);
    } finally {
      renderer.setRenderTarget(prev);
    }
    if (pending) await pending;
    if (signal && signal.aborted) return false;
    // one real frame through the real pipeline: textures, buffers, shadow maps, post passes — with
    // frustum culling off, so what the warm-up camera cannot see is uploaded too
    const culled = [];
    scene.traverseVisible((o) => { if (o.frustumCulled && (o.isMesh || o.isPoints || o.isLine || o.isSprite)) { o.frustumCulled = false; culled.push(o); } });
    try {
      if (composer) composer.render(0);
      else renderer.render(scene, camera);
    } finally {
      culled.forEach((o) => { o.frustumCulled = true; });
    }
    return true;
  } finally {
    hidden.forEach((o) => { o.visible = false; });
  }
}

export function createFrameGovernor({ minRatio = 1, slowMs = 24, frames = 24, maxSteps = 2 } = {}) {
  let samples = [];
  let last = 0;
  let steps = 0;
  return {
    /** Call once per rendered frame while veiled. Returns a lower pixel ratio when a step-down is due. */
    sample(now, ratio) {
      if (last) samples.push(now - last);
      last = now;
      if (samples.length < frames) return null;
      const sorted = samples.slice().sort((a, b) => a - b);
      samples = [];
      const median = sorted[sorted.length >> 1];
      if (median <= slowMs || ratio <= minRatio + 0.01 || steps >= maxSteps) return null;
      steps++;
      return Math.max(minRatio, Math.round(ratio * 0.75 * 100) / 100);
    },
    /** Frames after a resize are not representative: start counting again. */
    restart() { samples = []; last = 0; },
    get steps() { return steps; },
  };
}
