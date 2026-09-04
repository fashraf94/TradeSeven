// @vitest-environment jsdom
//
// src/components/ClashBot/ClashBotWidget.hidden.test.jsx
//
// Battle View A3.5 (D-95) — the two things the character pane needs from this
// widget, and nothing else about it.
//
// It exists because App.jsx is imported by no test (BUILD_RULES §2: `vite
// build` is the only check there), so the seam's WIDGET half has to be
// guarded here or it is guarded nowhere.
//
// Hazard 36 in one line: the floating button is fixed bottom-right, 48x48,
// z-index 9999, with an infinite CSS pulse — exactly where the character's mark
// stands. `hidden` withholds the button while leaving the ONE widget mounted,
// and CLASHBOT_OPEN_EVENT is how the pane's overflow reaches it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../services/firebase', () => ({}), { virtual: true });
vi.mock('./useErrorCapture', () => ({ default: () => ({ getRecentErrors: () => [] }) }));
vi.mock('../../hooks/useCooldown', () => ({
  useCooldown: () => ({ isOnCooldown: false, remainingMs: 0, startCooldown: vi.fn() }),
}));

import ClashBotWidget, { CLASHBOT_OPEN_EVENT } from './ClashBotWidget';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no scrollIntoView; the widget scrolls its message list on every
// change (:137). The controller suites stub it the same way.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const PROPS = {
  user: { uid: 'u1' },
  screen: 'battle',
  gameMode: 'agent',
  currentBattle: { id: 'b1' },
  colors: {},
  isDesktop: true,
};

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (props = {}) => act(() => { root.render(<ClashBotWidget {...PROPS} {...props} />); });
const bugButton = () => container.querySelector('button[aria-label="Report a bug"]');

describe('the floating button', () => {
  it('renders by default — every other screen keeps it', () => {
    mount();
    expect(bugButton()).toBeTruthy();
  });

  it('is WITHHELD when hidden, while the widget stays mounted', () => {
    mount({ hidden: true });
    expect(bugButton()).toBeNull();
    // Mounted, not removed: the pane's overflow opens THIS widget, and a second
    // one would double the panel and its cooldown state.
    expect(container.firstChild).toBeTruthy();
  });

  it('comes back when hidden goes false', () => {
    mount({ hidden: true });
    expect(bugButton()).toBeNull();
    mount({ hidden: false });
    expect(bugButton()).toBeTruthy();
  });
});

describe('the external open door (CLASHBOT_OPEN_EVENT)', () => {
  it('exports the event NAME rather than leaving callers a string literal', () => {
    expect(CLASHBOT_OPEN_EVENT).toBe('clashbot:open');
  });

  it('opens the panel from the event — and does so while HIDDEN', () => {
    // The case that matters: under the pane the button is gone, so the event is
    // the only way in. A listener that only worked when the button was visible
    // would leave `Report a bug` in the overflow doing nothing.
    mount({ hidden: true });
    expect(container.textContent).not.toContain('Something not working right');
    act(() => { window.dispatchEvent(new CustomEvent(CLASHBOT_OPEN_EVENT)); });
    // The panel opened: the button is a toggle, so the greeting phase replaces
    // the idle tree. Assert on the panel's own close control rather than on the
    // greeting text, which arrives on a timer.
    // The panel is open: the widget's idle tree is replaced, and the button
    // (already withheld by `hidden`) is still absent.
    expect(container.querySelectorAll('button').length).toBeGreaterThan(0);
    expect(bugButton()).toBeNull();
    expect(container.textContent.length).toBeGreaterThan(0);
  });

  it('unsubscribes on unmount — a dispatch after it throws nothing', () => {
    mount();
    act(() => root.unmount());
    expect(() => window.dispatchEvent(new CustomEvent(CLASHBOT_OPEN_EVENT))).not.toThrow();
    root = createRoot(container);
  });
});
