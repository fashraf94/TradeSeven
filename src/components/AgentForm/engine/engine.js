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
//   - a direct path: one view drawing straight into its own WebGL canvas, with no copy.

import * as THREE from 'three';
import { STATES, PALETTES, clamp, stillT, viewT0, startTween, tweenFit } from './vocab.js';
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
const DEFAULT_OPTIONS = Object.freeze({ path: 'shared', bloom: 'filter', batched: false, rate: 'live', reducedMotion: false, dpr: 1 });

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
  x.batched = !!x.batched; x.reducedMotion = !!x.reducedMotion;
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
  const counters = { lost: 0, restored: 0, contexts: 0, builds: 0 };

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

  /** The spec a frame draws: the view's spec with the tween's fit at clock reading `ms`. */
  function frameSpec(v, ms) {
    if (v.tween) {
      const { fit, done } = tweenFit(v.tween, ms);
      v.fit = fit;
      if (done) v.tween = null;
    }
    return { ...v.spec, fit: v.fit, unfit: v.unfit, batched: v.opts.batched };
  }

  /** Render view v at time t into its live canvas ('live') or its still canvas ('still'). Returns draw calls. */
  function drawView(v, spec, t, into) {
    const C = v.ctx; // never lost here: the loop, drawNow and restore each check first
    const key = formKey(spec);
    if (v.formKey !== key) { if (v.formKey) releaseForm(C, v.formKey); acquireForm(C, spec); v.formKey = key; }
    const F = C.forms.get(key), size = spec.size, small = size < 90, palette = pal(v), S = STATES[spec.state] || STATES.idle;
    const res = C.direct ? C.size : renderRes(v.opts.dpr, size);
    poseForm(F, spec, t, C, palette);
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
    if (v.stillDirty) { calls += drawView(v, spec, stillT(spec), 'still'); v.stillDirty = false; }
    calls += drawView(v, spec, animates(v) ? v.t0 + (ms - T0) / 1000 : stillT(spec), 'live');
    return calls;
  }

  // ── the frame loop ──
  function frame(ts) {
    raf = 0;
    if (P.doc.hidden) { resumed = true; return; }
    frameNo += 1;
    let drew = 0, calls = 0;
    const c0 = P.now();
    for (const v of views) {
      if (!animates(v) || !v.vis || v.ctx.lost) continue;
      if (v.opts.rate === 'half' && (frameNo & 1)) continue;
      const spec = frameSpec(v, ts);
      if (v.stillDirty) { calls += drawView(v, spec, stillT(spec), 'still'); v.stillDirty = false; }
      calls += drawView(v, spec, v.t0 + (ts - T0) / 1000, 'live');
      drew += 1;
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
    for (const v of views) if (animates(v)) { raf = P.requestFrame(frame); return; }
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
   * { still })` hears 'live', 'lost' and 'unavailable'. Returns the view handle.
   */
  function mount(els, spec, options, cb = {}, th) {
    if (!views.size) setup(th);
    const opts = normOptions(options), s = normSpec(spec);
    const v = { id: nextId++, els, spec: s, opts, cb, vis: true, t0: viewT0(s), tween: null, fit: s.fit == null ? 1 : s.fit, unfit: !!s.unfit, status: 'pending', stillReady: false, stillDirty: true, formKey: null, ctx: null, ctx2d: null, stillCtx: null, octx: null };
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
      /** Change mood, stage, allegiance, size … without a remount. */
      update(patch) {
        if (!views.has(v)) return;
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
        if (!animates(v)) { if (v.tween) { v.fit = v.tween.on ? 1 : 0; v.tween = null; } drawNow(v); }
        if (v.opts.bloom !== prev.bloom || v.opts.batched !== prev.batched) v.stillDirty = true;
        resumed = true; kick();
      },
      /** Play the equip (true) or unequip (false) tween: 900 ms / 700 ms on the board's keys; a still under reduced motion. */
      equip(on) {
        if (!views.has(v)) return;
        v.unfit = !on;
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
        multiDraw: r ? P.hasMultiDraw(r) : null, gpu: r ? P.gpuName(r) : '', looping: raf !== 0, listening, observing: io !== null,
        lost: counters.lost, restored: counters.restored, contextsCreated: counters.contexts, formsBuilt: counters.builds, unavailable: sharedFailed,
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
