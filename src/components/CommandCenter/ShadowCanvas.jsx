// src/components/CommandCenter/ShadowCanvas.jsx
//
// Command Center hub, slice S7 — Shadow, moving: the design's canvas Shadow
// (ff-shadow.jsx) as the second form of the ONE swappable Shadow (ruling
// R-S1-1; spec V1.2 §10). Same props contract as ShadowStill — size, tier,
// status, selectedArea, reducedMotion, boxRef — inside the same fixed
// `size × size` box, so nothing outside reads a filament point: the area
// controls, the dotted connector and the status line keep anchoring to the box.
//
// IT DRAWS THE STILL, NOT A CANVAS, when (ruling R-S7-1):
//   - motion is reduced (the hub's one `reducedMotion`, not a second media query);
//   - `getContext('2d')` returns nothing or throws, or a token does not resolve
//     (the canvas then hands over for good: the box swaps to the still);
//   - the phone's constant says so (hub/hubFlags.js PHONE_SHADOW → `stillOnly`).
// The still reads "still" on every one of those routes (R-S7-4).
//
// WHAT MOVES (R-S7-3), from hub/shadowCanvas.js:
//   - ambient, the default: the design's traveling signals and small strand
//     flares, drawn from `random` (injected: a test passes a seeded one);
//   - processing, only while the hub passes status 'processing' (a hub-started
//     deployment submitting);
//   - the response bloom, only when the hub's two triggers move (hub/shadowBloom.js:
//     a new area selection, an attempt's created terminal once per attempt id).
//     Under the still it is the design's brief flash, FLASH_MS long, whose
//     timeout is cleared on unmount; one that arrives while the root ceremony
//     covers the page is owed and shown when the page is back.
//
// LIFETIME (R-S7-5): the frame loop stops when the document is hidden, when the
// box is offscreen (IntersectionObserver) and while `paused` (the hub passes it
// while the root deploy ceremony covers the page); it resumes on return. A size
// change, a tier change and an unmount each cancel the frame, disconnect the
// observer and remove the visibility listener; the flash's timeout clears on
// its own cleanup. A response asked for while the loop is stopped is kept on
// Shadow's own clock, which stands still with the loop, and plays when it
// resumes. No tier is picked or changed here: the hub gives one (shadowTierFor).
//
// Colours are the three tokens the still reads, as computed hexes (readToken).

import React, { useEffect, useRef, useState } from 'react';
import { readToken } from '../../theme/cssTokens';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { seedBloom, stepBloom } from './hub/shadowBloom';
import { createFx, createShadowRig, drawShadow, fitFx, shadowColors, stepFx, triggerBloom } from './hub/shadowCanvas';
import ShadowStill from './ShadowStill';

/** The reduced-motion response: the still's brief lift, the design's 420 ms. */
export const FLASH_MS = 420;

/** The state word the still carries on every fallback route. */
const STILL = 'still';

export default function ShadowCanvas({
  size,
  tier = 'mid',
  status = 'ambient',
  selectedArea = null,
  reducedMotion = false,
  boxRef,
  areaEvent = 0,
  createdAttemptId = null,
  paused = false,
  stillOnly = false,
  random = Math.random,
}) {
  const sel = selectedArea === 0 || selectedArea === 1 || selectedArea === 2 ? selectedArea : null;
  const processing = status === 'processing';
  const [failed, setFailed] = useState(false);
  // The still's flash: 0 is off, anything else is the running one (a new number restarts its 420 ms).
  const [flash, setFlash] = useState(0);
  const still = reducedMotion || stillOnly || failed;

  // The response's memo, stepped while rendering (no effect): a trigger already there at mount is the past.
  const [bloom, setBloom] = useState(() => seedBloom({ areaEvent, createdAttemptId }));
  const nextBloom = stepBloom(bloom, { areaEvent, createdAttemptId });
  if (nextBloom !== bloom) setBloom(nextBloom);

  const canvasRef = useRef(null);
  const fxRef = useRef(null);
  if (fxRef.current === null) fxRef.current = createFx();
  const clockRef = useRef(0);
  const syncRef = useRef(null);
  const liveRef = useRef({});
  liveRef.current = { sel, processing, paused, random, still };

  useEffect(() => {
    if (still) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    // No 2D interface at all is "unavailable" without asking: an engine without it (jsdom, say) is not asked for a
    // context it would only complain about. Anywhere it exists, `getContext` returning nothing or throwing is the same answer.
    let ctx = null;
    if (typeof CanvasRenderingContext2D === 'function') {
      try {
        ctx = canvas.getContext('2d');
      } catch {
        ctx = null;
      }
    }
    const colors = shadowColors(readToken('teal'), readToken('teal-2'), readToken('white'));
    if (!ctx || !colors) {
      setFailed(true);
      return undefined;
    }
    const rig = createShadowRig(tier);
    const dpr = Math.min(window.devicePixelRatio || 1, rig.canvasCfg.dpr);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fx = fxRef.current;
    fitFx(fx, rig.strands.length);

    let raf = 0;
    let last = 0;
    let running = false;
    let visible = true;
    // A disposed run never starts again: an observer entry queued before disconnect() may still be delivered by an
    // engine that does not drop it, and must not revive this run's loop (review B-2).
    let disposed = false;
    const drawNow = (t) => {
      const P = liveRef.current;
      drawShadow(ctx, size, t, rig, { sel: P.sel, processing: P.processing }, fx, colors);
    };
    const frame = (now) => {
      raf = 0;
      if (!running) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      const P = liveRef.current;
      const speed = P.processing ? 1.6 : 1;
      clockRef.current += dt * speed;
      stepFx(fx, { t: clockRef.current, dt, speed, processing: P.processing, sel: P.sel, strands: rig.strands }, P.random);
      drawNow(clockRef.current);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (running || disposed) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const sync = () => {
      if (visible && !document.hidden && !liveRef.current.paused) start();
      else stop();
    };
    syncRef.current = sync;
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
        if (disposed) return;
        visible = entries[entries.length - 1].isIntersecting;
        sync();
      }, { threshold: 0 })
      : null;
    if (observer) observer.observe(canvas);
    document.addEventListener('visibilitychange', sync);
    drawNow(clockRef.current);
    sync();
    return () => {
      disposed = true;
      stop();
      if (observer) observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      syncRef.current = null;
    };
  }, [size, tier, still]);

  // The still's flash is OWED while the ceremony covers the page and paid when it releases, as the canvas's own clock
  // holds a bloom until the loop runs again: a response that arrives behind the ceremony is seen on return (review A-3).
  // The debt is the still's: when the route is the canvas the response is answered on its clock, so the debt is dropped
  // rather than paid at some later release (review T-13).
  const owedFlashRef = useRef(false);
  const flushFlashRef = useRef(null);
  flushFlashRef.current = () => {
    if (!owedFlashRef.current) return;
    if (!liveRef.current.still) {
      owedFlashRef.current = false;
      return;
    }
    if (liveRef.current.paused) return;
    owedFlashRef.current = false;
    setFlash((n) => n + 1);
  };

  // The ceremony (or any cover the hub names) pausing or releasing the loop, with no restart of the canvas. A debt exists
  // only while the page is covered, so a release is the one moment it is settled, paid by the still and dropped by the canvas.
  useEffect(() => {
    if (syncRef.current) syncRef.current();
    flushFlashRef.current();
  }, [paused]);

  // The response: a bloom on the canvas's clock, or the still's brief flash.
  const answeredRef = useRef(bloom.key);
  useEffect(() => {
    if (answeredRef.current === bloom.key) return;
    answeredRef.current = bloom.key;
    if (liveRef.current.still) {
      owedFlashRef.current = true;
      flushFlashRef.current();
    } else {
      triggerBloom(fxRef.current, clockRef.current);
    }
  }, [bloom.key]);

  useEffect(() => {
    if (!flash) return undefined;
    const id = setTimeout(() => setFlash(0), FLASH_MS);
    return () => clearTimeout(id);
  }, [flash]);

  if (still) {
    return (
      <ShadowStill
        size={size}
        tier={tier}
        status={STILL}
        selectedArea={sel}
        reducedMotion={reducedMotion}
        flash={flash > 0}
        boxRef={boxRef}
      />
    );
  }

  const state = COPY.shadow.states[processing ? 'processing' : 'ambient'];
  const areaName = sel == null ? null : COPY.areas.names[sel];
  return (
    <div
      ref={boxRef}
      data-shadow-box=""
      data-shadow-status={state}
      data-shadow-reduced-motion="false"
      data-shadow-canvas=""
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={COPY.shadow.imageLabel(state, areaName)}
        style={{ display: 'block', width: size, height: size }}
      />
    </div>
  );
}
