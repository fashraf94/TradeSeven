// @vitest-environment jsdom
//
// src/screens/battleView/LandingWash.test.jsx
//
// Review finding F1 (Phase A adversarial review): the wash must play once per
// CHECK, not once per mount. A bare `done` boolean played the first landing
// and swallowed every later one; the guard is now keyed on the landing.
// framer-motion's motion.div is stubbed to fire onAnimationComplete on mount
// so the completion path runs synchronously under act.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

const mounts = vi.hoisted(() => ({ count: 0 }));
vi.mock('framer-motion', () => {
  function MotionDivStub({ onAnimationComplete, children, ...rest }) {
    useEffect(() => {
      mounts.count += 1;
      onAnimationComplete?.();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <div data-wash="1" {...Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith('aria') || k === 'style'))}>{children}</div>;
  }
  return { motion: { div: MotionDivStub } };
});

import LandingWash from './LandingWash';
import { useLandingTransition } from './landing';
import { fade, instant } from '../../theme/motion';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
beforeEach(() => {
  mounts.count = 0;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (landingKey, reducedMotion = false) => act(() => {
  root.render(<LandingWash landingKey={landingKey} index={0} count={7} reducedMotion={reducedMotion} />);
});

describe('LandingWash — one wash per check', () => {
  it('nothing before the first landing', () => {
    render(null);
    expect(mounts.count).toBe(0);
    expect(container.querySelector('[data-wash]')).toBeNull();
  });

  it('plays for each new landing key, and unmounts itself when the fade completes', () => {
    render(null);
    render('2026-09-01T17:02:00.000Z');
    expect(mounts.count).toBe(1);
    expect(container.querySelector('[data-wash]')).toBeNull(); // completed → gone
    render('2026-09-01T17:17:00.000Z');
    expect(mounts.count).toBe(2);
    render('2026-09-01T17:32:00.000Z');
    expect(mounts.count).toBe(3);
  });

  it('does not replay a landing it has already completed on a re-render with the same key', () => {
    render('2026-09-01T17:02:00.000Z');
    render('2026-09-01T17:02:00.000Z');
    render('2026-09-01T17:02:00.000Z');
    expect(mounts.count).toBe(1);
  });

  it('never plays under reduced motion', () => {
    render('2026-09-01T17:02:00.000Z', true);
    render('2026-09-01T17:17:00.000Z', true);
    expect(mounts.count).toBe(0);
  });
});

describe('useLandingTransition — reduced motion is the instant token, with no delay (T6)', () => {
  function Probe({ delayMs, reducedMotion }) {
    seenTransitions.push(useLandingTransition(delayMs, reducedMotion));
    return null;
  }
  let seenTransitions;
  beforeEach(() => { seenTransitions = []; });

  it('normal motion: the fade token plus the row delay in seconds', () => {
    act(() => { root.render(<Probe delayMs={360} reducedMotion={false} />); });
    expect(seenTransitions[0]).toEqual({ ...fade, delay: 0.36 });
  });

  it('reduced motion: exactly the instant token — no delay, no duration', () => {
    act(() => { root.render(<Probe delayMs={360} reducedMotion={true} />); });
    expect(seenTransitions[0]).toBe(instant);
  });
});
