// src/components/AgentForm/engine/bloom.js
//
// The glow over a form at 160 px and up: the design's cheap bloom (af3-standalone.js.txt:350-356) and the
// two alternatives the lab compares on iOS, where CanvasRenderingContext2D.filter is disabled (Safari
// 18.0–26.3) and the design's version draws an unblurred quarter-size copy instead of a glow.
//   'filter' — the design's: a quarter-size copy, blurred with ctx.filter, added with 'lighter'.
//   'css'    — the same quarter-size copy on an overlay canvas the browser blurs (CSS filter) and adds
//              (mix-blend-mode: plus-lighter) over the form.
//   'webgl'  — the blur in WebGL: the form's pixels copied to a texture, two separable Gaussian passes at
//              quarter size, added back into the same framebuffer region before the copy.
//   'off'    — none.
// All three use the design's size and radius: a quarter-size buffer (bs) and a blur of max(1.5, 0.07·bs)
// pixels at that size, at strength clamp(0.65 · bright · (bloom > 1 ? 1.3 : 1), 0, 1).

import * as THREE from 'three';

export const BLOOM_MODES = Object.freeze(['filter', 'css', 'webgl', 'off']);
export const bloomBufferSize = (size) => Math.max(16, Math.round(size / 4));
export const bloomSigma = (bs) => Math.max(1.5, bs * .07);

/** The per-context bloom resources: 2D scratch canvases by buffer size, and the WebGL passes. */
export function createBloomKit(createCanvas, renderer) {
  const scratch = new Map();
  let gl = null;
  function canvases(bs) {
    let b = scratch.get(bs);
    if (!b) { const A = createCanvas(), B = createCanvas(); A.width = A.height = B.width = B.height = bs; b = { A, B, a: A.getContext('2d'), b: B.getContext('2d') }; scratch.set(bs, b); }
    return b;
  }
  return {
    /** The design's bloom, into `ctx` (already transformed for the view). `src` region: (sx, sy, res, res). */
    filter(ctx, src, sx, sy, res, size, strength) {
      const bs = bloomBufferSize(size), b = canvases(bs);
      b.a.clearRect(0, 0, bs, bs); b.a.drawImage(src, sx, sy, res, res, 0, 0, bs, bs);
      b.b.clearRect(0, 0, bs, bs); b.b.filter = `blur(${bloomSigma(bs)}px)`; b.b.drawImage(b.A, 0, 0); b.b.filter = 'none';
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = strength; ctx.drawImage(b.B, 0, 0, size, size); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    },
    /**
     * The overlay canvas for 'css' (the browser blurs it) or 'filter' on the direct path (blurred here with
     * ctx.filter, as the design's). Draws the quarter-size copy; returns the CSS the overlay should carry.
     */
    overlay(octx, src, sx, sy, res, size, mirror, blurHere) {
      const bs = bloomBufferSize(size), sigma = bloomSigma(bs);
      octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, bs, bs);
      if (mirror) octx.setTransform(-1, 0, 0, 1, bs, 0);
      if (blurHere) { const b = canvases(bs); b.a.clearRect(0, 0, bs, bs); b.a.drawImage(src, sx, sy, res, res, 0, 0, bs, bs); octx.filter = `blur(${sigma}px)`; octx.drawImage(b.A, 0, 0); octx.filter = 'none'; }
      else octx.drawImage(src, sx, sy, res, res, 0, 0, bs, bs);
      octx.setTransform(1, 0, 0, 1, 0, 0);
      return { bs, cssBlur: blurHere ? 'none' : `blur(${(sigma * size / bs).toFixed(2)}px)` };
    },
    /** The WebGL bloom on the region (0, 0, res, res) of the current framebuffer. Returns the draw calls it made. */
    webgl(res, size, strength, scissor) {
      if (!gl) gl = createWebglPasses(renderer);
      return gl.run(res, size, strength, scissor);
    },
    /** Every resource, for the teardown manifest. */
    resources() {
      const canvasesOut = []; for (const b of scratch.values()) canvasesOut.push(b.A, b.B);
      return { canvases: canvasesOut, gl: gl ? gl.resources() : { geometries: [], materials: [], targets: [], textures: [] } };
    },
    dispose() {
      for (const b of scratch.values()) { b.A.width = b.A.height = 0; b.B.width = b.B.height = 0; }
      scratch.clear();
      if (gl) gl.dispose();
      gl = null;
    },
  };
}

const VERT = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BLUR_FRAG = `uniform sampler2D tSrc;
uniform vec2 uStep;
uniform float uW[25];
uniform int uR;
varying vec2 vUv;
void main() {
  vec4 acc = texture2D(tSrc, vUv) * uW[0];
  for (int i = 1; i < 25; i++) {
    if (i > uR) break;
    acc += (texture2D(tSrc, vUv + uStep * float(i)) + texture2D(tSrc, vUv - uStep * float(i))) * uW[i];
  }
  gl_FragColor = acc;
}`;
const ADD_FRAG = 'uniform sampler2D tSrc;\nuniform float uStrength;\nvarying vec2 vUv;\nvoid main() { gl_FragColor = texture2D(tSrc, vUv) * uStrength; }';

/** Normalised one-sided Gaussian weights (index 0 is the centre) for sigma, radius capped at 24. */
export function gaussianWeights(sigma) {
  const R = Math.min(24, Math.ceil(sigma * 3)), w = new Array(25).fill(0);
  let sum = 0;
  for (let i = 0; i <= R; i += 1) { w[i] = Math.exp(-(i * i) / (2 * sigma * sigma)); sum += i ? 2 * w[i] : w[i]; }
  for (let i = 0; i <= R; i += 1) w[i] /= sum;
  return { R, w };
}

function createWebglPasses(renderer) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), geometry = new THREE.PlaneGeometry(2, 2);
  const blur = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BLUR_FRAG, uniforms: { tSrc: { value: null }, uStep: { value: new THREE.Vector2() }, uW: { value: new Array(25).fill(0) }, uR: { value: 0 } }, depthTest: false, depthWrite: false });
  const add = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: ADD_FRAG, uniforms: { tSrc: { value: null }, uStrength: { value: 1 } }, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, premultipliedAlpha: true });
  const quad = new THREE.Mesh(geometry, blur), scene = new THREE.Scene(); quad.frustumCulled = false; scene.add(quad);
  const copies = new Map(), targets = new Map(), at = new THREE.Vector2(0, 0);
  const target = (bs) => { let t = targets.get(bs); if (!t) { t = [0, 1].map(() => new THREE.WebGLRenderTarget(bs, bs, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter })); targets.set(bs, t); } return t; };
  const copy = (res) => { let c = copies.get(res); if (!c) { c = new THREE.FramebufferTexture(res, res); c.minFilter = c.magFilter = THREE.LinearFilter; copies.set(res, c); } return c; };
  return {
    run(res, size, strength, scissor) {
      const bs = bloomBufferSize(size), { R, w } = gaussianWeights(bloomSigma(bs)), [ta, tb] = target(bs), src = copy(res);
      renderer.copyFramebufferToTexture(src, at);
      renderer.setScissorTest(false);
      quad.material = blur; blur.uniforms.uW.value = w; blur.uniforms.uR.value = R;
      blur.uniforms.tSrc.value = src; blur.uniforms.uStep.value.set(1 / bs, 0); renderer.setRenderTarget(ta); renderer.render(scene, camera);
      blur.uniforms.tSrc.value = ta.texture; blur.uniforms.uStep.value.set(0, 1 / bs); renderer.setRenderTarget(tb); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.setViewport(0, 0, res, res);
      if (scissor) { renderer.setScissorTest(true); renderer.setScissor(0, 0, res, res); }
      quad.material = add; add.uniforms.tSrc.value = tb.texture; add.uniforms.uStrength.value = strength; renderer.render(scene, camera);
      return 3;
    },
    resources() {
      return { geometries: [geometry], materials: [blur, add], targets: [...targets.values()].flat(), textures: [...copies.values()] };
    },
    dispose() {
      geometry.dispose(); blur.dispose(); add.dispose();
      for (const pair of targets.values()) for (const t of pair) t.dispose();
      for (const c of copies.values()) c.dispose();
      targets.clear(); copies.clear();
    },
  };
}
