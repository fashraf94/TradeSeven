// src/components/AgentForm/engine/glPlatform.js
//
// The only module that creates GPU objects directly: the WebGL renderer and the studio environment. The
// engine reaches them through its platform (engine.js createAgentFormEngine), so the Node and jsdom tests
// swap this module for a recording stand-in (src/components/AgentForm/engine/__mocks__/glPlatform.js) and
// run the real engine without a GPU.

import * as THREE from 'three';

/**
 * A renderer configured as the design's (af3-standalone.js.txt:322-324). `canvas` is the view's own canvas
 * on the direct path, or absent for the shared renderer (three makes an offscreen canvas). `size` is the
 * drawing buffer's side in pixels. Throws when the browser cannot create a WebGL context.
 */
export function createRenderer({ canvas = null, size }) {
  const renderer = new THREE.WebGLRenderer({ ...(canvas ? { canvas } : {}), antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  renderer.setSize(size, size, false); renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0); renderer.autoClear = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

/**
 * The small studio the plates reflect: cool softboxes for the brushed-metal reflections
 * (af3-standalone.js.txt:326-331), prefiltered once. Returns the PMREM render target (its `.texture` is the
 * envMap); the studio scene is disposed as soon as it has been captured. `studio` holds the token colours.
 */
export function createEnvironment(renderer, studio) {
  const sc = new THREE.Scene(), made = [];
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); made.push(geo, mat); sc.add(m); return m; };
  add(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(studio.box), side: THREE.BackSide }));
  const panel = (w, h, x, y, z, col, k) => { const m = add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); };
  panel(4, 3, -4, 3.5, 2, studio.key, 7); panel(3, 2, 4, 2, -3, studio.fill, 3.5); panel(5, 1, 0, 4.8, -1, studio.top, 3); panel(3, 3, 2, -3, 3, studio.under, 1.4);
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(sc, .04); pm.dispose();
  for (const r of made) r.dispose();
  return rt;
}

/** Whether batched meshes draw in one call here (WEBGL_multi_draw); without it three issues one per instance. */
export function hasMultiDraw(renderer) {
  return !!(renderer.extensions && renderer.extensions.has('WEBGL_multi_draw'));
}

/** The GPU's name where the browser exposes it (the lab's reading line), or ''. */
export function gpuName(renderer) {
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch {
    return '';
  }
}
