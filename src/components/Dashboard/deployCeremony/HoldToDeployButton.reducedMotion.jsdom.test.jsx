// @vitest-environment jsdom
//
// src/components/Dashboard/deployCeremony/HoldToDeployButton.reducedMotion.jsdom.test.jsx
//
// Command Center repair R2, ruling R-R2-9 (defect D7) — under OS reduced
// motion the hold's fill and glow drain instantly. framer-motion reads the OS
// setting once and caches it, so useReducedMotion is mocked for this whole
// file (precedent ceremonyExisting.reducedMotion.test.jsx). The motion-allowed
// half — the shipped 250 ms drain, unchanged — is a parity row in
// src/hooks/useHoldToDeploy.r2.jsdom.test.jsx.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('framer-motion', async (importOriginal) => ({ ...(await importOriginal()), useReducedMotion: () => true }));
vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isDeploySkyCouplingOn: () => true,
}));

import HoldToDeployButton from './HoldToDeployButton';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const T0 = 1_800_000_000_000;
let frames;
let nowMs;
let container;
let root;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  frames = [];
  nowMs = T0;
  vi.stubGlobal('requestAnimationFrame', (cb) => { frames.push(cb); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const render = (ui) => act(() => { root.render(ui); });
const button = () => container.querySelector('button');
const fire = (type) => act(() => { button().dispatchEvent(new Event(type, { bubbles: true })); });
const step = (ms) => act(() => {
  nowMs = T0 + ms;
  const due = frames;
  frames = [];
  for (const cb of due) cb(nowMs);
});

describe('D7 — under prefers-reduced-motion the hold drains instantly', () => {
  it('filled: the fill has no transition at rest, while charging, or as it drains after a release', () => {
    render(<HoldToDeployButton label="Deploy" onComplete={() => {}} />);
    const fill = () => button().querySelector('span[aria-hidden]');
    expect(fill().style.transition).toBe('none');
    fire('pointerdown');
    step(600);
    expect(fill().style.transition).toBe('none');
    fire('pointerup');
    expect(fill().style.width).toBe('0%');
    expect(fill().style.transition).toBe('none');
  });

  it('filled: the charge glow has no transition either', () => {
    render(<HoldToDeployButton label="Deploy" onComplete={() => {}} />);
    fire('pointerdown');
    step(600);
    fire('pointerup');
    expect(button().style.transition).toBe('');
  });

  it('muted: the progress rule drains instantly', () => {
    render(<HoldToDeployButton variant="muted" label="Deploy without previewing" onComplete={() => {}} />);
    const rule = () => button().querySelector('span[aria-hidden] > span');
    fire('pointerdown');
    step(600);
    fire('pointerup');
    expect(rule().style.transition).toBe('none');
  });

  it('the hold itself is unchanged: the same 1300 ms charge and 450 ms beat', () => {
    const onComplete = vi.fn();
    render(<HoldToDeployButton label="Deploy" onComplete={onComplete} />);
    fire('pointerdown');
    step(1299);
    expect(button().textContent).toBe('Deploy');
    step(1300);
    expect(button().textContent).toBe('Locked in');
    act(() => { vi.advanceTimersByTime(450); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
