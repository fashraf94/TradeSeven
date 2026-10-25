// src/components/CommandCenter/__fixtures__/shadowCanvasKit.js
//
// Command Center hub, slice S7 — the test kit for Shadow's canvas (ShadowCanvas.jsx). Tests only; nothing in
// src/ imports it. It lives apart from hubTestKit.js so its frame, observer and listener stand-ins are their own
// registered allowance (commandCenterHub.mount.guard.test.js), not an addition to the layout kit's.

import { act } from 'react';

/**
 * Slice S7 — what jsdom lacks for Shadow's canvas (ShadowCanvas.jsx), for TESTS ONLY:
 *   - a 2D context that records what is drawn, one per canvas element (`getContext`), or `null` / a throw by `context`;
 *   - a controllable requestAnimationFrame / cancelAnimationFrame (a frame runs only when `tick` asks);
 *   - an IntersectionObserver that `intersect` fires, with each instance's state kept;
 *   - `document.hidden` with the visibilitychange event (`setHidden`), and a count of visibilitychange listeners
 *     added and removed.
 * `restore` puts every global back. The log of a context: `frames` — one entry per clearRect, each with the strokes
 * and arcs drawn since — plus `strokeStyles`, `arcs` (cx, cy, r) and the `setTransform` calls.
 */
export function installFakeCanvas({ context = 'ok' } = {}) {
  const state = { context, now: 1000 };
  const contexts = [];
  const observers = [];
  const raf = { queue: [], id: 0, requested: 0, cancelled: 0 };
  const listeners = { added: 0, removed: 0 };
  const originals = {
    getContext: HTMLCanvasElement.prototype.getContext,
    raf: globalThis.requestAnimationFrame,
    caf: globalThis.cancelAnimationFrame,
    io: globalThis.IntersectionObserver,
    add: document.addEventListener,
    remove: document.removeEventListener,
    hidden: Object.getOwnPropertyDescriptor(Document.prototype, 'hidden'),
    dpr: window.devicePixelRatio,
  };

  const makeContext = () => {
    const log = { frames: [], strokeStyles: [], arcs: [], setTransform: [], gradients: 0 };
    let frame = null;
    const ctx = {
      lineCap: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '',
      clearRect() { frame = { strokes: 0, arcs: 0 }; log.frames.push(frame); },
      fillRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      fill() {},
      arc(x, y, r) { log.arcs.push([x, y, r]); if (frame) frame.arcs += 1; },
      stroke() { log.strokeStyles.push(ctx.strokeStyle); if (frame) frame.strokes += 1; },
      createRadialGradient() { log.gradients += 1; return { addColorStop() {} }; },
      setTransform(...args) { log.setTransform.push(args); },
    };
    return { ctx, log };
  };

  const byCanvas = new WeakMap();
  HTMLCanvasElement.prototype.getContext = function getContext() {
    if (state.context === 'throw') throw new Error('getContext blew up');
    if (state.context === 'null') return null;
    if (!byCanvas.has(this)) {
      const made = makeContext();
      byCanvas.set(this, made);
      contexts.push(made);
    }
    return byCanvas.get(this).ctx;
  };

  globalThis.requestAnimationFrame = (cb) => { raf.id += 1; raf.requested += 1; raf.queue.push({ id: raf.id, cb }); return raf.id; };
  globalThis.cancelAnimationFrame = (id) => { raf.cancelled += 1; raf.queue = raf.queue.filter((f) => f.id !== id); };

  class FakeIntersectionObserver {
    constructor(callback, options) { this.callback = callback; this.options = options; this.targets = new Set(); this.disconnected = false; observers.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); this.disconnected = true; }
  }
  globalThis.IntersectionObserver = FakeIntersectionObserver;

  let hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.addEventListener = function addEventListener(type, ...rest) {
    if (type === 'visibilitychange') listeners.added += 1;
    return originals.add.call(this, type, ...rest);
  };
  document.removeEventListener = function removeEventListener(type, ...rest) {
    if (type === 'visibilitychange') listeners.removed += 1;
    return originals.remove.call(this, type, ...rest);
  };

  return {
    state,
    contexts,
    observers,
    listeners,
    raf,
    /** The one canvas context (most tests draw one Shadow). */
    get ctx() { return contexts[contexts.length - 1]?.ctx ?? null; },
    get log() { return contexts[contexts.length - 1]?.log ?? null; },
    /** Run every queued frame once, `ms` after the last tick, inside act so React commits. */
    tick(ms = 16) {
      state.now += ms;
      const due = raf.queue;
      raf.queue = [];
      act(() => { for (const f of due) f.cb(state.now); });
      return due.length;
    },
    /** An entry for EVERY observer, disconnected ones too — an engine that delivers what was queued before disconnect(). */
    intersectStale(isIntersecting) {
      act(() => { for (const o of observers) o.callback([{ isIntersecting }], o); });
    },
    /** One delivery with several entries, oldest first: the latest is the box's state. */
    intersectBatch(states) {
      act(() => { for (const o of observers.filter((x) => !x.disconnected)) o.callback(states.map((isIntersecting) => ({ isIntersecting })), o); });
    },
    /** Tell the live observers the box is on screen (true) or off it (false). */
    intersect(isIntersecting) {
      act(() => { for (const o of observers.filter((x) => !x.disconnected)) o.callback([{ isIntersecting }], o); });
    },
    setHidden(value) {
      hidden = value;
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    },
    setDpr(value) { Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value }); },
    restore() {
      HTMLCanvasElement.prototype.getContext = originals.getContext;
      globalThis.requestAnimationFrame = originals.raf;
      globalThis.cancelAnimationFrame = originals.caf;
      if (originals.io === undefined) delete globalThis.IntersectionObserver; else globalThis.IntersectionObserver = originals.io;
      document.addEventListener = originals.add;
      document.removeEventListener = originals.remove;
      if (originals.hidden) Object.defineProperty(document, 'hidden', originals.hidden); else delete document.hidden;
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: originals.dpr });
    },
  };
}
