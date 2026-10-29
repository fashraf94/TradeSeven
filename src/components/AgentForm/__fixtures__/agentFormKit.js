// src/components/AgentForm/__fixtures__/agentFormKit.js
//
// Build S0 — the test kit for the agent form engine and its wrapper, for TESTS ONLY (nothing in src/ imports
// it). jsdom has no WebGL, no 2D canvas, no frames and no observers, so this supplies:
//   - a 2D context per canvas that records what is drawn (clearRect, drawImage, filter, composite);
//   - a controllable requestAnimationFrame / cancelAnimationFrame and clock (a frame runs only when `tick` asks);
//   - an IntersectionObserver whose instances the test can fire, and document visibility;
//   - a renderer stand-in (`fakeRenderer`) that records every call the engine makes on a WebGL renderer;
//   - a DISPOSE CENSUS: three.js numbers every geometry, material and texture it creates from global counters,
//     so the ids created between `census.open()` and `census.close()` are exactly what the code under test
//     made. The census counts each object's dispose() calls, so "every one of them disposed exactly once" is
//     complete by construction — a resource the engine forgot is an id with no dispose, whatever made it.

import * as THREE from 'three';

export function installCanvasKit() {
  const state = { now: 1000, hidden: false };
  const contexts = [];
  const raf = { queue: [], id: 0, requested: 0, cancelled: 0 };
  const observers = [];
  const listeners = { added: 0, removed: 0 };
  const originals = {
    getContext: HTMLCanvasElement.prototype.getContext,
    raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame, io: globalThis.IntersectionObserver,
    add: document.addEventListener, remove: document.removeEventListener, hidden: Object.getOwnPropertyDescriptor(Document.prototype, 'hidden'),
    perfNow: performance.now,
  };

  const makeContext = (canvas) => {
    const log = { clears: 0, draws: [], filters: [], composites: [], transforms: 0 };
    const ctx = {
      canvas, filter: 'none', globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '',
      clearRect() { log.clears += 1; }, fillRect() {}, save() {}, restore() {}, translate() {}, scale() {},
      setTransform() { log.transforms += 1; },
      drawImage(src, ...args) { log.draws.push({ src, args, filter: ctx.filter, alpha: ctx.globalAlpha, op: ctx.globalCompositeOperation }); if (ctx.filter !== 'none') log.filters.push(ctx.filter); if (ctx.globalCompositeOperation !== 'source-over') log.composites.push(ctx.globalCompositeOperation); },
      createRadialGradient() { return { addColorStop() {} }; },
      getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
    };
    return { ctx, log };
  };
  const byCanvas = new WeakMap();
  HTMLCanvasElement.prototype.getContext = function getContext(type) {
    if (type !== '2d') return null;
    if (!byCanvas.has(this)) { const made = makeContext(this); byCanvas.set(this, made); contexts.push(made); }
    return byCanvas.get(this).ctx;
  };
  globalThis.requestAnimationFrame = (cb) => { raf.id += 1; raf.requested += 1; raf.queue.push({ id: raf.id, cb }); return raf.id; };
  globalThis.cancelAnimationFrame = (id) => { raf.cancelled += 1; raf.queue = raf.queue.filter((f) => f.id !== id); };
  performance.now = () => state.now;

  class FakeIntersectionObserver {
    constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = 0; observers.push(this); }
    observe(t) { this.targets.add(t); }
    unobserve(t) { this.targets.delete(t); }
    disconnect() { this.targets.clear(); this.disconnected += 1; }
  }
  globalThis.IntersectionObserver = FakeIntersectionObserver;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => state.hidden });
  document.addEventListener = function addEventListener(type, ...rest) { if (type === 'visibilitychange') listeners.added += 1; return originals.add.call(this, type, ...rest); };
  document.removeEventListener = function removeEventListener(type, ...rest) { if (type === 'visibilitychange') listeners.removed += 1; return originals.remove.call(this, type, ...rest); };

  return {
    state, contexts, raf, observers, listeners,
    logOf(canvas) { return byCanvas.get(canvas)?.log ?? null; },
    /** Run every queued frame once, `ms` after the last tick. `wrap` (e.g. React's act) wraps the callbacks. */
    tick(ms = 16, wrap = (f) => f()) { state.now += ms; const due = raf.queue; raf.queue = []; wrap(() => { for (const f of due) f.cb(state.now); }); return due.length; },
    setHidden(value) { state.hidden = value; document.dispatchEvent(new Event('visibilitychange')); },
    platform() { return { now: () => state.now, requestFrame: (cb) => globalThis.requestAnimationFrame(cb), cancelFrame: (id) => globalThis.cancelAnimationFrame(id), IntersectionObserver: FakeIntersectionObserver, doc: document, createCanvas: () => document.createElement('canvas') }; },
    restore() {
      HTMLCanvasElement.prototype.getContext = originals.getContext;
      globalThis.requestAnimationFrame = originals.raf; globalThis.cancelAnimationFrame = originals.caf;
      if (originals.io === undefined) delete globalThis.IntersectionObserver; else globalThis.IntersectionObserver = originals.io;
      document.addEventListener = originals.add; document.removeEventListener = originals.remove;
      if (originals.hidden) Object.defineProperty(document, 'hidden', originals.hidden); else delete document.hidden;
      performance.now = originals.perfNow;
    },
  };
}

/**
 * A stand-in for THREE.WebGLRenderer: records each call; `render` counts the visible drawables it was handed
 * (info.render.calls) and remembers the scene's objects. Its canvas fires 'webglcontextlost'/'restored' when the
 * test dispatches them.
 */
export function fakeRenderer({ canvas = null, size = 1024 } = {}, record = []) {
  const domElement = canvas || document.createElement('canvas');
  domElement.width = size; domElement.height = size;
  const listeners = { added: [], removed: [] };
  const addEL = domElement.addEventListener.bind(domElement), rmEL = domElement.removeEventListener.bind(domElement);
  domElement.addEventListener = (type, fn, o) => { listeners.added.push(type); addEL(type, fn, o); };
  domElement.removeEventListener = (type, fn, o) => { listeners.removed.push(type); rmEL(type, fn, o); };
  const r = {
    domElement, listeners, record, info: { render: { calls: 0 } }, extensions: { has: (n) => n === 'WEBGL_multi_draw' },
    renders: 0, lastScene: null, clears: [], clearColors: [],
    setSize(w, h) { domElement.width = w; domElement.height = h; record.push('setSize'); },
    setPixelRatio() {}, setClearColor(c, a) { r.clearColors.push([c, a]); },
    setScissorTest() {}, setViewport() {}, setScissor() {}, setRenderTarget() {}, copyFramebufferToTexture() {},
    setOpaqueSort(f) { r.opaqueSort = f; }, setTransparentSort(f) { r.transparentSort = f; },
    clear(...a) { r.clears.push(a); },
    render(scene) {
      r.renders += 1; r.lastScene = scene; let n = 0;
      scene.traverseVisible((o) => { if (o.isMesh || o.isLine || o.isSprite || o.isPoints) n += 1; });
      r.info.render.calls = n;
    },
    getContext() { return { getExtension: () => null, getParameter: () => 'fake GPU', RENDERER: 0 }; },
    dispose() { record.push('dispose'); }, forceContextLoss() { record.push('forceContextLoss'); },
  };
  return r;
}

/** Platform pieces for createAgentFormEngine that make fake renderers and a fake studio (a plain render target). */
export function fakeGlPlatform(made = { renderers: [], environments: [] }) {
  return {
    made,
    createRenderer(opts) { const r = fakeRenderer(opts); made.renderers.push(r); return r; },
    createEnvironment() { const rt = new THREE.WebGLRenderTarget(4, 4); made.environments.push(rt); return rt; },
    hasMultiDraw: () => true, gpuName: () => 'fake GPU',
  };
}

/**
 * The dispose census (see the header). Every three.js geometry, material, texture and render target assigns a
 * property in its constructor (`name`, or `isRenderTarget`); a setter on the prototype records each one made
 * while the census is open, and a wrapped dispose() counts each release. `report()` lists every recorded
 * object by class with its dispose count. Textures a render target owns are released by that target.
 */
export function disposeCensus() {
  const made = [], counts = new Map();
  let open = false;
  const hooks = [[THREE.BufferGeometry.prototype, 'name'], [THREE.Material.prototype, 'name'], [THREE.Texture.prototype, 'name'], [THREE.RenderTarget.prototype, 'isRenderTarget']];
  for (const [proto, prop] of hooks) {
    Object.defineProperty(proto, prop, {
      configurable: true,
      get() { return undefined; },
      set(v) { Object.defineProperty(this, prop, { value: v, writable: true, enumerable: true, configurable: true }); if (open) made.push(this); },
    });
  }
  const protos = [THREE.BufferGeometry.prototype, THREE.Material.prototype, THREE.Texture.prototype, THREE.RenderTarget.prototype];
  const saved = protos.map((p) => p.dispose);
  protos.forEach((p, i) => { p.dispose = function dispose(...a) { counts.set(this, (counts.get(this) || 0) + 1); return saved[i].apply(this, a); }; });
  // three's shared sprite geometry is made by the first Sprite ever constructed and never disposed: make it before opening.
  new THREE.Sprite();
  const kind = (o) => (o.isRenderTarget ? 'target' : o.isBufferGeometry ? 'geometry' : o.isMaterial ? 'material' : 'texture');
  return {
    made, counts,
    open() { made.length = 0; counts.clear(); open = true; },
    close() { open = false; },
    /** By class: how many were made, and the ones whose dispose count is not exactly one (owned textures excluded). */
    report() {
      const out = { geometry: { made: 0, bad: [] }, material: { made: 0, bad: [] }, texture: { made: 0, bad: [] }, target: { made: 0, bad: [] } };
      // A render target's textures are released by the target. three's RenderTarget constructor also makes a
      // template texture it only clones from (same source); that one is three's own garbage, not the engine's.
      const targetSources = new Set(made.filter((o) => o.isRenderTarget).flatMap((t) => t.textures.map((x) => x.source)));
      for (const o of new Set(made)) {
        if (o.isTexture && (o.isRenderTargetTexture || targetSources.has(o.source))) continue;
        const k = kind(o), n = counts.get(o) || 0;
        out[k].made += 1;
        if (n !== 1) out[k].bad.push(`${o.type || o.constructor.name}#${o.id ?? ''} disposed ${n}×`);
      }
      return out;
    },
    restore() {
      protos.forEach((p, i) => { p.dispose = saved[i]; });
      for (const [proto, prop] of hooks) delete proto[prop];
    },
  };
}
