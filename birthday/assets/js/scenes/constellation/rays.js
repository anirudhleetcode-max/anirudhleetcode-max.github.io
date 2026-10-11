// The light inside the sun's rays: the space between the two sides of every ray
// the golden thread draws is filled with a soft warm glow, brightest at its foot
// and along its middle, fading to its tip and its edges, so the line-drawn sun
// reads like the film's solid emblem. It follows the thread exactly (it is built
// from the same curve each frame) and only shows where the thread has settled
// into the sun. No post-processing.
import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute vec2 aRay;      // along (0 foot … 1 tip), across (-1 … 1)
  attribute float aShow;    // how settled the thread is here (0 … 1)
  attribute float aLong;    // 1 long ray, 0 flame
  varying vec2 vRay;
  varying float vShow;
  varying float vLong;
  void main() {
    vRay = aRay;
    vShow = aShow;
    vLong = aLong;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vRay;
  varying float vShow;
  varying float vLong;
  void main() {
    float along = vRay.x;
    float across = 1.0 - vRay.y * vRay.y;
    float a = pow(max(across, 0.0), 0.8) * (1.0 - 0.72 * along) * (1.0 - smoothstep(0.86, 1.0, along) * 0.6);
    a *= vShow * uOpacity * mix(0.85, 1.0, vLong);
    vec3 col = mix(vec3(1.0, 0.8, 0.46), vec3(0.98, 0.56, 0.2), smoothstep(0.0, 0.9, along));
    // light that also veils the night behind it a little, so the rays read gold (not grey) over the blue
    gl_FragColor = vec4(col * a, a * 0.7);
  }
`;

/**
 * createRays({ sun, device }) → { mesh, update(curve, settle, opacity), dispose() }
 * `curve(u, outVector3)` is the thread's loop (the same one it is drawn along); `settle(u)` → 0..1 how far
 * the thread has become the sun at u.
 */
export function createRays({ sun, device = {} }) {
  const K = device.tier === 'low' ? 12 : 20; // samples along each side of a ray
  const rays = sun.rays;
  const V = rays.length * 2 * (K + 1);
  const pos = new Float32Array(V * 3);
  const ray = new Float32Array(V * 2);
  const show = new Float32Array(V);
  const long = new Float32Array(V);
  const us = new Float32Array(V);
  const index = [];
  rays.forEach((r, i) => {
    for (let k = 0; k <= K; k++) {
      const s = k / K;
      const v = (i * (K + 1) + k) * 2;
      us[v] = r.foot0 + (r.tip - r.foot0) * s; // the counter-clockwise side, foot → tip
      us[v + 1] = r.foot1 + (r.tip - r.foot1) * s; // the clockwise side, foot → tip
      ray[v * 2] = ray[(v + 1) * 2] = s;
      ray[v * 2 + 1] = -1;
      ray[(v + 1) * 2 + 1] = 1;
      long[v] = long[v + 1] = r.long ? 1 : 0;
      if (k < K) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  });
  const geo = new THREE.BufferGeometry();
  const posA = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const showA = new THREE.BufferAttribute(show, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posA);
  geo.setAttribute('aRay', new THREE.BufferAttribute(ray, 2));
  geo.setAttribute('aShow', showA);
  geo.setAttribute('aLong', new THREE.BufferAttribute(long, 1));
  geo.setIndex(index);
  const U = { uOpacity: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending, premultipliedAlpha: true, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2.5; // after the prints (so a print in front hides it), before their halos and the thread
  mesh.visible = false;
  const p = new THREE.Vector3();

  return {
    mesh,
    /** Rebuild the rays from the thread's curve (only while they show). */
    update(curve, settle, opacity) {
      U.uOpacity.value = opacity;
      mesh.visible = opacity > 0.002;
      if (!mesh.visible) return;
      for (let v = 0; v < V; v++) {
        curve(us[v], p);
        pos[v * 3] = p.x; pos[v * 3 + 1] = p.y; pos[v * 3 + 2] = p.z - 0.01;
        show[v] = settle(us[v]);
      }
      posA.needsUpdate = showA.needsUpdate = true;
    },
    dispose() {
      mesh.parent && mesh.parent.remove(mesh);
      geo.dispose();
      mat.dispose();
    },
  };
}
