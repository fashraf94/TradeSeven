// src/components/AgentForm/engine/engine.js
//
// The agent form runtime, ported from the design's af3-engine.js (docs/design/agent-identity-v2/
// af3-standalone.js.txt:318-401). One WebGL renderer feeds every agent canvas on the page: each view renders
// into a scissored corner of the shared GL canvas and is copied onto its own 2D canvas. What the port changed
// (Phase 0 report docs/audits/20261028_PHASE0_AGENT_IDENTITY.md §4):
//   - nothing happens at load. The renderer, environment, scene and lights are made on the first mount and
//     reference-counted; at zero views every form, the glow texture, the icosahedron cache, the environment,
//     the bloom canvases and passes and the renderer are disposed, the IntersectionObserver is disconnected,
//     the visibility listener is removed and the frame loop stops;
//   - no globals, no window events, no media query: reduced motion, bloom, rate and the draw path arrive as
//     view options; the clock, frames, observer and document arrive in the platform;
//   - WebGL context loss: every view of that context shows its still (a stillT frame cached on a 2D canvas
//     at mount); on restore the environment is rebuilt, the target is cleared with alpha and drawing resumes;
//   - no frame-cost self-downgrade (ruling R-S7-2): the design's 5 ms round-robin budget, its "under 100 px
//     every third frame" and its "under 60 px never animate" rules are gone. Every visible live view draws on
//     every frame its rate allows — 'live' every frame, 'half' every other frame (on purpose), 'still' once —
//     and nothing measured ever changes that;
//   - each view's spec is mutable (mood, stage, allegiance change without a remount), with an equip tween;
//   - a direct path: one view drawing straight into its own WebGL canvas, with no copy;
//   - a per-view error guard (the design's draw() try/catch, af3-standalone.js.txt:381): a pose or render that
//     throws drops that view to 'unavailable' and the loop goes on for every other view (review SR-2);
//   - build S1: a swap between forms, played (the new set's 900 ms equip; a set coming off before bare Shadow
//     shows), with the size tweened across it (ruling R5); a paused view, which holds its frame and keeps the loop
//     off for it (the hub's lifetime ruling R-S7-5: it pauses while the deploy ceremony covers the page); and the
//     cached still drawn at where the view is headed (the settled fit), not at a tween's first frame;
//   - build S2: the response (ruling R19): `respond(part)` brightens the armor, the core or the whole form on S7's
//     timing, on the view's own clock, which stands still with the loop, so a response behind the deploy ceremony
//     plays when the page is back; a view that does not animate takes S7's 420 ms flash instead, owed while paused.
//     And a swap asked for while a view is paused starts its tween when the view resumes (ruling R23).

import * as THREE from 'three';
import { STATES, PALETTES, FRAME_SCALE, RESPONSE_FLASH_LIFT, RESPONSE_FLASH_MS, RESPONSE_MS, RESPONSE_PARTS, clamp, frameScale, frameShift, responseLift, stillT, viewT0, startTween, tweenFit, swapScale, swapShift } from './vocab.js';
import { fadeMaterial, glowTexture } from './core.js';
import { resetIcosaCache } from './armor.js';
import { buildForm, poseForm, formKey, disposeForm, formResources } from './form.js';
import { createBloomKit, bloomBufferSize } from './bloom.js';
import * as glPlatform from './glPlatform.js';

/** The shared renderer's drawing buffer side (af3-standalone.js.txt:321). */
export const GL = 1024;
export const RATES = Object.freeze(['live', 'half', 'still']);
export const PATHS = Object.freeze(['shared', 'direct']);

/** The platform defaults: the browser's own clock, frames, observer and document. */
export function browserPlatform() {
  return {
    createRenderer: glPlatform.createRenderer,
    createEnvironment: glPlatform.createEnvironment,
    hasMultiDraw: glPlatform.hasMultiDraw,
    gpuName: glPlatform.gpuName,
    createCanvas: () => document.createElement('canvas'),
    requestFrame: (cb) => requestAnimationFrame(cb),
    cancelFrame: (id) => cancelAnimationFrame(id),
    now: () => performance.now(),
    // Read when the engine starts (its first mount after zero views), not when the module loads.
    get IntersectionObserver() { return typeof IntersectionObserver === 'function' ? IntersectionObserver : null; },
    get doc() { return document; },
  };
}

/** Canvas pixel ratio for a view (af3-standalone.js.txt:391): up to 3 under 100 px, else up to 2. */
const canvasDpr = (dpr, size) => Math.min(dpr || 1, size < 100 ? 3 : 2);
/** Render resolution for a view (af3-standalone.js.txt:359): up to 3 under 90 px, else up to 2. */
const renderRes = (dpr, size) => clamp(Math.round(size * Math.min(dpr || 1, size < 90 ? 3 : 2)), 48, GL);

const DEFAULT_SPEC = Object.freeze({ kind: 'none', core: 0, armor: 0, state: 'idle', pal: 'teal', size: 200, seed: 1, face: 1, zoom: 1, brain: true, turn: 0 });
const DEFAULT_OPTIONS = Object.freeze({ path: 'shared', bloom: 'filter', batched: false, rate: 'live', reducedMotion: false, dpr: 1, paused: false });

function normSpec(spec) {
  const s = { ...DEFAULT_SPEC, ...spec };
  if (!STATES[s.state]) s.state = 'idle';
  if (!PALETTES.includes(s.pal)) s.pal = 'teal';
  return s;
}
function normOptions(o) {
  const x = { ...DEFAULT_OPTIONS, ...o };
  if (!['shared', 'direct'].includes(x.path)) x.path = 'shared';
  if (!['filter', 'css', 'webgl', 'off'].includes(x.bloom)) x.bloom = 'filter';
  if (!RATES.includes(x.rate)) x.rate = 'live';
  x.batched = !!x.batched; x.reducedMotion = !!x.reducedMotion; x.paused = !!x.paused;
  return x;
}

/**
 * Create an engine. `platform` overrides the browser defaults (tests pass stand-ins). The engine holds no
 * GPU object until its first mount.
 */
export function createAgentFormEngine(platform = {}) {
  const P = Object.defineProperties(browserPlatform(), Object.getOwnPropertyDescriptors(platform));
  const views = new Set(), frameListeners = new Set();
  let shared = null, sharedFailed = false, io = null, listening = false, raf = 0, frameNo = 0, T0 = 0, nextId = 1, theme = null, resumed = true;
  const counters = { lost: 0, restored: 0, contexts: 0, builds: 0, failed: 0 };

  // ── render contexts ──
  function createContext(canvas, size) {
    const renderer = P.createRenderer({ canvas, size });
    counters.contexts += 1;
    let envTarget;
    try { envTarget = P.createEnvironment(renderer, theme.studio); } catch (e) { renderer.dispose(); renderer.forceContextLoss(); throw e; }
    const C = {
      renderer, theme, direct: !!canvas, size, lost: false, views: new Set(), forms: new Map(), refs: new Map(), cur: null, curForm: null,
      envTarget, env: envTarget.texture, glow: glowTexture(P.createCanvas), fadeMat: fadeMaterial(), bloom: null,
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(30, 1, .1, 40), lights: [],
    };
    C.scene.fog = new THREE.Fog(new THREE.Color(theme.fog), 4, 7.8);
    const key = new THREE.DirectionalLight(new THREE.Color(theme.lights.key), 2.6); key.position.set(-2.4, 3.2, 2.6);
    const rim = new THREE.DirectionalLight(new THREE.Color(theme.lights.rim), 1.1); rim.position.set(2.4, 1.2, -3);
    const hemi = new THREE.HemisphereLight(new THREE.Color(theme.lights.sky), new THREE.Color(theme.lights.ground), .55);
    C.lights.push(key, rim, hemi); C.scene.add(key, rim, hemi);
    C.bloom = createBloomKit(P.createCanvas, renderer);
    C.shared = new Set([C.env, C.glow, C.fadeMat]);
    // Sorts keyed on build-local order, never three's global ids (form.js: build order). One form is in the
    // scene at a time, so its order map is the only one a sort consults.
    const ord = (o) => (C.curForm ? C.curForm.order.get(o) ?? 0 : 0);
    renderer.setOpaqueSort((a, b) => a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || ord(a.material) - ord(b.material) || a.z - b.z || ord(a.object) - ord(b.object));
    renderer.setTransparentSort((a, b) => a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || b.z - a.z || ord(a.object) - ord(b.object));
    C.onLost = () => onContextLost(C); C.onRestored = () => onContextRestored(C);
    renderer.domElement.addEventListener('webglcontextlost', C.onLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', C.onRestored, false);
    return C;
  }

  function contextResources(C) {
    const forms = [...C.forms.values()].map((F) => formResources(F, C.shared));
    return { renderer: C.renderer, envTarget: C.envTarget, glow: C.glow, fadeMat: C.fadeMat, bloom: C.bloom.resources(), forms };
  }

  function disposeContext(C) {
    for (const F of C.forms.values()) disposeForm(F, C.shared);
    C.forms.clear(); C.refs.clear();
    C.scene.clear(); C.cur = null; C.curForm = null;
    for (const l of C.lights) l.dispose();
    C.glow.dispose(); C.glow.image.width = C.glow.image.height = 0;
    C.fadeMat.dispose(); C.envTarget.dispose(); C.bloom.dispose();
    C.renderer.domElement.removeEventListener('webglcontextlost', C.onLost, false);
    C.renderer.domElement.removeEventListener('webglcontextrestored', C.onRestored, false);
    C.renderer.dispose(); C.renderer.forceContextLoss();
    C.views.clear();
  }

  /** A form for a spec in context C, built on first use and reference-counted by the views drawing it. */
  function acquireForm(C, spec) {
    const key = formKey(spec);
    let F = C.forms.get(key);
    if (!F) { F = buildForm(spec, C); C.forms.set(key, F); C.refs.set(key, 0); counters.builds += 1; }
    C.refs.set(key, C.refs.get(key) + 1);
    return F;
  }
  function releaseForm(C, key) {
    if (!C.forms.has(key)) return;
    const n = C.refs.get(key) - 1;
    if (n > 0) { C.refs.set(key, n); return; }
    const F = C.forms.get(key);
    if (C.cur === F.group) { C.scene.remove(F.group); C.cur = null; C.curForm = null; }
    disposeForm(F, C.shared); C.forms.delete(key); C.refs.delete(key);
  }

  // ── context loss ──
  function onContextLost(C) {
    C.lost = true; counters.lost += 1;
    for (const v of C.views) setStatus(v, 'lost');
  }
  function onContextRestored(C) {
    C.lost = false; counters.restored += 1;
    // The environment lived only on the GPU (a PMREM render target): rebuild it and point every plate at it.
    C.envTarget.dispose(); C.envTarget = P.createEnvironment(C.renderer, theme.studio); C.env = C.envTarget.texture;
    C.shared = new Set([C.env, C.glow, C.fadeMat]);
    for (const F of C.forms.values()) { F.mat.envMap = C.env; F.mat.needsUpdate = true; }
    // Clear the whole target with alpha before anything draws again (no black square).
    const r = C.renderer; r.setRenderTarget(null); r.setClearColor(0x000000, 0); r.setScissorTest(false); r.setViewport(0, 0, C.size, C.size); r.clear(true, true, true);
    for (const v of C.views) { v.stillDirty = true; setStatus(v, 'live'); drawNow(v); }
    resumed = true; kick();
  }

  // ── views ──
  function setStatus(v, status) {
    if (v.status === status) return;
    v.status = status;
    if (v.cb.onStatus) v.cb.onStatus(status, { still: v.stillReady });
  }
  const animates = (v) => v.status === 'live' && !v.opts.reducedMotion && v.opts.rate !== 'still';
  /** A still's flash is running: the loop stays on until it has shown for its 420 ms. */
  const flashing = (v) => !!(v.response && v.response.flash && v.response.start !== null);
  const pal = (v) => theme.palettes[v.spec.pal] || theme.palettes.teal;

  function sizeCanvases(v) {
    const { size } = v.spec, dpr = canvasDpr(v.opts.dpr, size);
    if (v.ctx.direct) {
      const res = renderRes(v.opts.dpr, size);
      v.ctx.renderer.setSize(res, res, false); v.ctx.size = res;
      v.els.canvas.style.width = v.els.canvas.style.height = `${size}px`;
    } else {
      v.els.canvas.width = Math.round(size * dpr); v.els.canvas.height = v.els.canvas.width;
      v.ctx2d = v.els.canvas.getContext('2d'); v.ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (v.els.stillCanvas) {
      v.els.stillCanvas.width = Math.round(size * dpr); v.els.stillCanvas.height = v.els.stillCanvas.width;
      v.stillCtx = v.els.stillCanvas.getContext('2d'); v.stillCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (v.ctx.direct) {
      const flip = v.spec.face < 0 ? 'scaleX(-1)' : '';
      v.els.canvas.style.transform = flip; if (v.els.overlay) v.els.overlay.style.transform = flip;
    }
  }

  /** The spec a frame draws: the view's spec with the tween's fit at clock reading `ms` (and, mid-swap, its scale). */
  function frameSpec(v, ms) {
    if (v.tween && v.tween.heldAt === null) {
      const { fit, done } = tweenFit(v.tween, ms);
      v.fit = fit;
      if (done) { v.tween = null; settleSwap(v); }
    }
    const spec = { ...v.spec, fit: v.fit, unfit: v.unfit, batched: v.opts.batched };
    if (v.swap) { spec.scale = swapScale(v.swap, v.fit); spec.shift = swapShift(v.swap, v.fit); }
    if (v.response) spec.response = { part: v.response.part, lift: v.response.flash ? RESPONSE_FLASH_LIFT : responseLift(v.response.age) };
    return spec;
  }

  /** A paused view's tween waits: its clock is rebased when the view resumes, so it plays whole, with its smoothing. */
  function holdTween(v, ms) { if (v.tween && v.tween.heldAt === null) v.tween.heldAt = ms; }
  function releaseTween(v, ms) {
    if (!v.tween || v.tween.heldAt === null) return;
    v.tween.start += ms - v.tween.heldAt; v.tween.heldAt = null;
  }

  /** A drawn frame of a response: its clock moves only with the frames drawn, as Shadow's does (ShadowCanvas.jsx). */
  function stepResponse(v, ts) {
    const r = v.response;
    if (!r || r.flash) return;
    r.age += r.last === null ? 16 : Math.min(50, ts - r.last);
    r.last = ts;
    if (r.age >= RESPONSE_MS) v.response = null;
  }
  /** The still's flash shows now; it ends in the loop, once its 420 ms have gone. */
  function startFlash(v) { v.response.start = P.now(); drawNow(v); kick(); }
  function endFlash(v) { if (flashing(v) && P.now() - v.response.start >= RESPONSE_FLASH_MS) { v.response = null; drawNow(v); } }

  /** The spec the cached still draws: the form where the view is headed — a tween's end fit, the form's own scale. */
  function settledSpec(v) {
    const fit = v.tween ? (v.tween.on ? 1 : 0) : v.fit, unfit = v.tween ? !v.tween.on : v.unfit;
    return { ...v.spec, fit, unfit, batched: v.opts.batched };
  }

  /**
   * A swap is over (its tween ended, or the view stopped animating): a set that came off leaves bare Shadow, worn
   * as bare Shadow is at rest, and the form draws at its own scale again. The still is redrawn for the new form.
   */
  function settleSwap(v) {
    if (!v.swap) return;
    if (v.swap.kind) { v.spec = normSpec({ ...v.spec, kind: v.swap.kind }); v.fit = 1; v.unfit = false; v.stillDirty = true; }
    v.swap = null;
  }

  /** Render view v at time t into its live canvas ('live') or its still canvas ('still'). Returns draw calls. */
  function drawView(v, spec, t, into) {
    const C = v.ctx; // never lost here: the loop, drawNow and restore each check first
    const key = formKey(spec);
    if (v.formKey !== key) { if (v.formKey) releaseForm(C, v.formKey); acquireForm(C, spec); v.formKey = key; }
    const F = C.forms.get(key), size = spec.size, small = size < 90, palette = pal(v), S = STATES[spec.state] || STATES.idle;
    const res = C.direct ? C.size : renderRes(v.opts.dpr, size);
    poseForm(F, spec, t, C, palette);
    if (into === 'live') { v.drawnScale = F.group.scale.x; v.drawnShift = Number.isFinite(spec.shift) ? spec.shift : frameShift(spec.kind); }
    if (C.cur !== F.group) { if (C.cur) C.scene.remove(C.cur); C.scene.add(F.group); C.cur = F.group; C.curForm = F; }
    const r = C.renderer;
    if (C.direct) { r.setScissorTest(false); r.setViewport(0, 0, res, res); }
    else { r.setScissorTest(true); r.setViewport(0, 0, res, res); r.setScissor(0, 0, res, res); }
    r.clear(true, true, false); r.render(C.scene, C.camera);
    let calls = r.info.render.calls;
    const bloomOn = !small && size >= 160 && v.opts.bloom !== 'off', strength = clamp(.65 * S.bright * (S.bloom > 1 ? 1.3 : 1), 0, 1);
    if (bloomOn && v.opts.bloom === 'webgl') calls += C.bloom.webgl(res, size, strength, !C.direct);
    const src = r.domElement, sy = C.direct ? 0 : GL - res, mirror = spec.face < 0;
    if (into === 'still' || !C.direct) {
      const ctx = into === 'still' ? v.stillCtx : v.ctx2d;
      if (ctx) {
        ctx.clearRect(0, 0, size, size); ctx.save(); if (mirror) { ctx.translate(size, 0); ctx.scale(-1, 1); }
        ctx.drawImage(src, 0, sy, res, res, 0, 0, size, size);
        // The design's bloom into the 2D target. A still never takes the CSS glow: the overlay belongs to
        // the live frame, and a still is shown exactly when the live frame is not.
        if (bloomOn && v.opts.bloom === 'filter') C.bloom.filter(ctx, src, 0, sy, res, size, strength);
        ctx.restore();
      }
    }
    if (into === 'live') {
      const o = v.els.overlay, wantOverlay = bloomOn && o && (v.opts.bloom === 'css' || (C.direct && v.opts.bloom === 'filter'));
      if (wantOverlay) {
        const bs = bloomBufferSize(size);
        if (o.width !== bs) { o.width = o.height = bs; v.octx = null; }
        if (!v.octx) v.octx = o.getContext('2d');
        const css = C.bloom.overlay(v.octx, src, 0, sy, res, size, mirror && !C.direct, v.opts.bloom === 'filter');
        const st = { display: '', opacity: String(+strength.toFixed(3)), filter: css.cssBlur };
        for (const k of Object.keys(st)) if (o.style[k] !== st[k]) o.style[k] = st[k];
      } else if (o && o.style.display !== 'none') o.style.display = 'none';
    }
    if (into === 'still') v.stillReady = true;
    return calls;
  }

  /** Draw a view now, outside the loop: its still canvas when stale, then its live canvas (the still frame when it does not animate). */
  function drawNow(v) {
    if (v.status !== 'live' || v.ctx.lost) return 0;
    const ms = P.now(), spec = frameSpec(v, ms);
    let calls = 0;
    try {
      if (v.stillDirty) { const st = settledSpec(v); calls += drawView(v, st, stillT(st), 'still'); v.stillDirty = false; }
      calls += drawView(v, spec, animates(v) ? v.t0 + (ms - T0) / 1000 : stillT(spec), 'live');
    } catch (error) { failView(v, error); }
    return calls;
  }

  /**
   * A view whose pose or render threw. The design's draw() caught and logged these per view
   * (af3-standalone.js.txt:381); the port's loop had no guard, so one throw left `raf` at 0 with kick() never
   * reached, and every view froze with status 'live' (review SR-2). Now the view drops to 'unavailable' (the
   * wrapper shows its cached still, or the fallback still) and the loop goes on for every other view.
   */
  function failView(v, error) {
    counters.failed += 1;
    if (v.cb.onError) v.cb.onError(error);
    setStatus(v, 'unavailable');
  }

  // ── the frame loop ──
  function frame(ts) {
    raf = 0;
    if (P.doc.hidden) { resumed = true; return; }
    frameNo += 1;
    let drew = 0, calls = 0;
    const c0 = P.now();
    for (const v of views) {
      endFlash(v);
      if (!animates(v) || !v.vis || v.opts.paused || v.ctx.lost) continue;
      if (v.opts.rate === 'half' && (frameNo & 1)) continue;
      stepResponse(v, ts);
      const spec = frameSpec(v, ts);
      try {
        if (v.stillDirty) { const st = settledSpec(v); calls += drawView(v, st, stillT(st), 'still'); v.stillDirty = false; }
        calls += drawView(v, spec, v.t0 + (ts - T0) / 1000, 'live');
        drew += 1;
      } catch (error) { failView(v, error); }
    }
    const cost = P.now() - c0;
    if (drew) {
      const sample = { t: ts, cost, calls, views: drew, resumed };
      resumed = false;
      for (const fn of frameListeners) fn(sample);
    }
    kick();
  }
  function kick() {
    if (raf || P.doc.hidden) return;
    for (const v of views) if ((animates(v) && !v.opts.paused) || flashing(v)) { raf = P.requestFrame(frame); return; }
    resumed = true;
  }
  function stopLoop() { if (raf) { P.cancelFrame(raf); raf = 0; } resumed = true; }

  function onVisibility() { if (P.doc.hidden) stopLoop(); else kick(); }
  function onIntersect(entries) {
    for (const e of entries) { const v = byElement.get(e.target); if (v) v.vis = e.isIntersecting; }
    kick();
  }
  const byElement = new Map();

  function setup(th) {
    theme = th; T0 = P.now(); frameNo = 0; resumed = true;
    io = P.IntersectionObserver ? new P.IntersectionObserver(onIntersect, { threshold: 0 }) : null;
    P.doc.addEventListener('visibilitychange', onVisibility); listening = true;
  }
  function teardown() {
    stopLoop();
    if (io) { io.disconnect(); io = null; }
    if (listening) { P.doc.removeEventListener('visibilitychange', onVisibility); listening = false; }
    if (shared) { disposeContext(shared); shared = null; }
    sharedFailed = false;
    resetIcosaCache();
    theme = null; byElement.clear();
  }

  /**
   * Mount a view. `els` = { canvas, stillCanvas?, overlay?, box? }: on the shared path `canvas` is a 2D
   * canvas the engine copies into; on the direct path it is the WebGL canvas itself. `cb.onStatus(status,
   * { still })` hears 'live', 'lost' and 'unavailable'; `cb.onError(error)` hears a pose or render that threw (the
   * view is then 'unavailable'). Returns the view handle.
   */
  function mount(els, spec, options, cb = {}, th) {
    if (!views.size) setup(th);
    const opts = normOptions(options), s = normSpec(spec);
    const v = { id: nextId++, els, spec: s, opts, cb, vis: true, t0: viewT0(s), tween: null, swap: null, response: null, drawnScale: null, drawnShift: null, fit: s.fit == null ? 1 : s.fit, unfit: !!s.unfit, status: 'pending', stillReady: false, stillDirty: true, formKey: null, ctx: null, ctx2d: null, stillCtx: null, octx: null };
    views.add(v);
    const target = els.box || els.canvas;
    byElement.set(target, v); if (io) io.observe(target);
    try {
      if (opts.path === 'direct') {
        // The direct path draws into a canvas of its own, made here inside the wrapper's slot: a canvas keeps
        // its one WebGL context for life, and this one is force-lost at unmount, so it is never reused.
        const canvas = P.createCanvas(); canvas.style.display = 'block';
        if (els.slot) els.slot.appendChild(canvas);
        v.els = { ...els, canvas }; v.directCanvas = canvas;
        v.ctx = createContext(canvas, renderRes(opts.dpr, s.size));
      } else {
        if (!shared && !sharedFailed) shared = createContext(null, GL);
        if (!shared) throw new Error('shared renderer unavailable');
        v.ctx = shared;
      }
    } catch {
      if (opts.path !== 'direct') sharedFailed = true;
      v.ctx = null; setStatus(v, 'unavailable');
      return handle(v);
    }
    v.ctx.views.add(v);
    sizeCanvases(v);
    setStatus(v, 'live');
    drawNow(v);
    kick();
    return handle(v);
  }

  function handle(v) {
    return {
      id: v.id,
      get status() { return v.status; },
      get fit() { return v.fit; },
      /** The form drawn now (mid-swap to bare Shadow, the set still coming off), and the scale its last live frame drew at. */
      get kind() { return v.spec.kind; },
      get scale() { return v.drawnScale; },
      /** Change mood, stage, allegiance, size … without a remount. */
      update(patch) {
        if (!views.has(v)) return;
        if (v.swap && patch && patch.kind !== undefined) {
          // A swap in flight: the kind it is headed for is no change; any other kind ends it, at once.
          if (patch.kind === (v.swap.kind || v.spec.kind)) { patch = { ...patch }; delete patch.kind; } else { v.tween = null; v.swap = null; v.fit = 1; v.unfit = false; }
        }
        const prev = v.spec; v.spec = normSpec({ ...prev, ...patch });
        if (!v.ctx) return;
        if (v.spec.size !== prev.size || v.spec.face !== prev.face) sizeCanvases(v);
        v.stillDirty = true;
        if (!animates(v)) drawNow(v);
        kick();
      },
      /** Change bloom, rate, batching, reduced motion or the pixel ratio (the path is fixed at mount). */
      setOptions(patch) {
        if (!views.has(v)) return;
        const prev = v.opts; v.opts = normOptions({ ...prev, ...patch, path: prev.path });
        if (!v.ctx) return;
        if (v.opts.dpr !== prev.dpr) sizeCanvases(v);
        if (v.opts.paused && !prev.paused) holdTween(v, P.now());
        if (!v.opts.paused && prev.paused) releaseTween(v, P.now());
        // A running response ends with the motion that carried it: no later frame would finish it, and it would stay lit.
        if (v.response && !v.response.flash && !animates(v)) v.response = null;
        if (!animates(v)) { if (v.tween) { v.fit = v.tween.on ? 1 : 0; v.tween = null; } settleSwap(v); drawNow(v); }
        // A flash is the still's: a view that animates again drops one still owed (S7's review T-13), and a release pays it.
        if (v.response && v.response.flash && animates(v)) v.response = null;
        else if (v.response && v.response.flash && v.response.start === null && !v.opts.paused) startFlash(v);
        if (v.opts.bloom !== prev.bloom || v.opts.batched !== prev.batched) v.stillDirty = true;
        resumed = true; kick();
      },
      /**
       * Change the form and play the change (build S1). A new set suits up from nothing on the board's 900 ms equip;
       * a change to bare Shadow takes the set off on the 700 ms unequip, then shows Shadow; the same set again (a
       * change reversed mid-way) suits up from where its plates are. The scale runs from the one last drawn to the
       * new form's across the tween (ruling R5), so there is no size step at the first frame. Under reduced motion,
       * at the still rate, or with no live context, it is update(): the new form at once, its still redrawn. On a
       * paused view the tween is set up and waits; it starts when the view resumes (ruling R23).
       */
      swap(patch) {
        if (!views.has(v)) return;
        const target = normSpec({ ...v.spec, ...patch }).kind, headed = v.swap && v.swap.kind ? v.swap.kind : v.spec.kind;
        if (!v.ctx || !animates(v) || target === headed) {
          if (target !== headed) { v.tween = null; v.swap = null; v.fit = 1; v.unfit = false; }
          this.update(patch);
          return;
        }
        const prev = v.spec, from = Number.isFinite(v.drawnScale) ? v.drawnScale : frameScale(prev.kind), now = P.now();
        const shiftFrom = Number.isFinite(v.drawnShift) ? v.drawnShift : frameShift(prev.kind), shiftTo = frameShift(target);
        const rest = { ...patch }; delete rest.kind;
        if (target === 'none') {
          v.spec = normSpec({ ...prev, ...rest }); v.unfit = true; v.tween = startTween(false, now, v.fit);
          v.swap = { on: false, fit0: v.fit, from, to: FRAME_SCALE.none, shiftFrom, shiftTo, kind: 'none' };
        } else if (target === prev.kind) {
          v.spec = normSpec({ ...prev, ...rest }); v.unfit = false; v.tween = startTween(true, now, v.fit);
          v.swap = { on: true, fit0: v.fit, from, to: frameScale(target), shiftFrom, shiftTo, kind: null };
        } else {
          v.spec = normSpec({ ...prev, ...patch }); v.fit = 0; v.unfit = false; v.tween = startTween(true, now, 0);
          v.swap = { on: true, fit0: 0, from, to: frameScale(target), shiftFrom, shiftTo, kind: null };
        }
        if (v.opts.paused) holdTween(v, now);
        if (v.spec.size !== prev.size || v.spec.face !== prev.face) sizeCanvases(v);
        v.stillDirty = true;
        kick();
      },
      /**
       * Brighten a part of the form, S7's response: `part` is 'armor', 'core' or anything else for the whole form. A view
       * that animates plays it on its own clock, held while the view does not draw. One that does not takes the flash,
       * owed while paused and paid on release. A new response replaces one running, as a new bloom restarts today's.
       */
      respond(part) {
        if (!views.has(v) || !v.ctx || v.status !== 'live') return;
        v.response = { part: RESPONSE_PARTS.includes(part) ? part : 'all', flash: !animates(v), age: 0, last: null, start: null };
        if (!v.response.flash) { kick(); return; }
        if (!v.opts.paused) startFlash(v);
      },
      /** Play the equip (true) or unequip (false) tween: 900 ms / 700 ms on the board's keys; a still under reduced motion. */
      equip(on) {
        if (!views.has(v)) return;
        v.unfit = !on; v.swap = null;
        if (!v.ctx || !animates(v)) { v.tween = null; v.fit = on ? 1 : 0; if (v.ctx) drawNow(v); return; }
        v.tween = startTween(on, P.now(), v.fit);
        kick();
      },
      unmount() { unmountView(v); },
    };
  }

  function unmountView(v) {
    if (!views.has(v)) return;
    views.delete(v);
    const target = v.els.box || v.els.canvas;
    byElement.delete(target); if (io) io.unobserve(target);
    const C = v.ctx;
    if (C) {
      C.views.delete(v);
      if (v.formKey && !C.direct) releaseForm(C, v.formKey);
      if (C.direct) disposeContext(C);
    }
    // Release the view's 2D backing stores now (iOS caps total canvas memory).
    for (const el of [v.els.stillCanvas, v.els.overlay, C ? v.els.canvas : null]) if (el) { el.width = 0; el.height = 0; }
    if (v.directCanvas) v.directCanvas.remove();
    if (!views.size) teardown();
    else kick();
  }

  return {
    mount,
    /** Hear every drawn frame: { t, cost (ms, the whole loop body: renders and copies), calls, views, resumed }. */
    onFrame(fn) { frameListeners.add(fn); return () => frameListeners.delete(fn); },
    /** What the lab's readout line reports, and what the teardown tests inspect. */
    info() {
      const r = shared ? shared.renderer : null;
      return {
        views: views.size, contexts: (shared ? 1 : 0) + [...views].filter((v) => v.ctx && v.ctx.direct).length, forms: shared ? shared.forms.size : 0,
        multiDraw: r ? P.hasMultiDraw(r) : null, gpu: r ? P.gpuName(r) : '', looping: raf !== 0, paused: [...views].filter((v) => v.opts.paused).length, listening, observing: io !== null,
        lost: counters.lost, restored: counters.restored, contextsCreated: counters.contexts, formsBuilt: counters.builds, failed: counters.failed, unavailable: sharedFailed,
      };
    },
    /** Every live GPU and canvas resource (the teardown manifest's census at peak). */
    resources() {
      const out = [];
      if (shared) out.push(contextResources(shared));
      for (const v of views) if (v.ctx && v.ctx.direct) out.push(contextResources(v.ctx));
      return out;
    },
    /** Every live renderer (the shared one, then each direct view's), for the lab's loss test (WEBGL_lose_context). */
    renderers() {
      const out = shared ? [shared.renderer] : [];
      for (const v of views) if (v.ctx && v.ctx.direct) out.push(v.ctx.renderer);
      return out;
    },
  };
}
