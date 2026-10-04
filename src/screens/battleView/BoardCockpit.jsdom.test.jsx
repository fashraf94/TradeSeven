// @vitest-environment jsdom
//
// src/screens/battleView/BoardCockpit.jsdom.test.jsx
//
// Cockpit Build 2a — THE PHONE'S BOARD · COCKPIT (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md §6; rulings R2A-3, R2A-4): the switch (a
// tablist with roving tabindex and arrow keys, "Board" and "Cockpit · {n}"
// with no count at 0, a sliding thumb on the existing `smooth` token, instant
// under reduced motion) and the track (native scroll-snap, a tap on the switch
// scrolls it — `smooth`, or `auto` under reduced motion — and a swipe moves
// the switch; the off-screen screen stays mounted but inert).
//
// framer-motion is a recording pass-through (see CockpitSheet.jsdom.test.jsx):
// reduced motion is a PROP here, so there is no module latch to fight.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('framer-motion', async () => {
  const ReactMod = await import('react');
  const pass = (tag) => ReactMod.forwardRef(({ initial, animate, exit, transition, layoutId, ...rest }, ref) => ReactMod.createElement(tag, {
    ref,
    ...rest,
    'data-motion-transition': JSON.stringify(transition ?? null),
    ...(layoutId ? { 'data-motion-layout-id': layoutId } : {}),
  }));
  return { motion: { div: pass('div'), span: pass('span') }, AnimatePresence: ({ children }) => children };
});

import { CockpitSwitch, BoardCockpitTrack, PHONE_SCREEN, TRACK_SETTLE_IDLE_MS } from './BoardCockpit';
import { motionToken } from '../../theme/motion';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

const q = (sel) => container.querySelector(sel);
const qa = (sel) => [...container.querySelectorAll(sel)];
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
const key = (el, k) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });

describe('the switch — "Board" · "Cockpit · {n}"', () => {
  const renderSwitch = (props) => act(() => { root.render(<CockpitSwitch screen={PHONE_SCREEN.BOARD} onSelect={() => {}} {...props} />); });

  it('each tab is at least 36 px tall (review L5-10)', () => {
    renderSwitch({});
    expect(qa('[role="tab"]').every((t) => parseInt(t.style.minHeight, 10) >= 36)).toBe(true);
  });

  it('labels: Board, and Cockpit with the Needs-you count — no count at 0', () => {
    renderSwitch({ needsYou: 3 });
    expect(qa('[role="tab"]').map((t) => t.textContent)).toEqual(['Board', 'Cockpit · 3']);
    renderSwitch({ needsYou: 0 });
    expect(qa('[role="tab"]').map((t) => t.textContent)).toEqual(['Board', 'Cockpit']);
  });

  it('a tablist with roving tabindex; Board is selected by default', () => {
    renderSwitch({});
    expect(q('[role="tablist"]').getAttribute('aria-label')).toBe('Board or cockpit');
    const [board, cockpit] = qa('[role="tab"]');
    expect(board.getAttribute('aria-selected')).toBe('true');
    expect(board.tabIndex).toBe(0);
    expect(cockpit.getAttribute('aria-selected')).toBe('false');
    expect(cockpit.tabIndex).toBe(-1);
    // Each tab controls the track's panel of the same screen (the track renders those ids).
    expect(board.getAttribute('aria-controls')).toBe('board-cockpit-panel-board');
    expect(cockpit.getAttribute('aria-controls')).toBe('board-cockpit-panel-cockpit');
  });

  it('arrow keys, Home and End select and move focus with the selection', () => {
    const onSelect = vi.fn();
    renderSwitch({ onSelect });
    key(q('[role="tablist"]'), 'ArrowRight');
    expect(onSelect).toHaveBeenLastCalledWith('cockpit');
    renderSwitch({ onSelect, screen: PHONE_SCREEN.COCKPIT });
    key(q('[role="tablist"]'), 'ArrowLeft');
    expect(onSelect).toHaveBeenLastCalledWith('board');
    key(q('[role="tablist"]'), 'Home');
    expect(onSelect).toHaveBeenLastCalledWith('board');
    key(q('[role="tablist"]'), 'End');
    expect(onSelect).toHaveBeenLastCalledWith('cockpit');
    expect(document.activeElement?.getAttribute('data-board-cockpit-tab')).toBe('cockpit');
  });

  it('a tap selects', () => {
    const onSelect = vi.fn();
    renderSwitch({ onSelect });
    click(q('[data-board-cockpit-tab="cockpit"]'));
    expect(onSelect).toHaveBeenCalledWith('cockpit');
  });

  it('the thumb is ONE layoutId on the selected tab, on `smooth`; instant under reduced motion', () => {
    renderSwitch({ screen: PHONE_SCREEN.COCKPIT });
    const thumbs = qa('[data-board-cockpit-thumb]');
    expect(thumbs).toHaveLength(1);
    expect(thumbs[0].closest('[role="tab"]').getAttribute('data-board-cockpit-tab')).toBe('cockpit');
    expect(thumbs[0].getAttribute('data-motion-layout-id')).toBe('board-cockpit-thumb');
    expect(JSON.parse(thumbs[0].getAttribute('data-motion-transition'))).toEqual(JSON.parse(JSON.stringify(motionToken('smooth'))));
    renderSwitch({ screen: PHONE_SCREEN.COCKPIT, reducedMotion: true });
    expect(JSON.parse(q('[data-board-cockpit-thumb]').getAttribute('data-motion-transition'))).toEqual(JSON.parse(JSON.stringify(motionToken('smooth', { reducedMotion: true }))));
  });
});

describe('the track — native scroll-snap; the switch scrolls it, a swipe moves the switch', () => {
  const renderTrack = (props) => act(() => {
    root.render(<BoardCockpitTrack screen={PHONE_SCREEN.BOARD} onScreen={() => {}} board={<div data-b="1">board</div>} cockpit={<div data-c="1">cockpit</div>} {...props} />);
  });
  const sized = () => {
    const track = q('[data-board-cockpit-track]');
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 400 });
    track.scrollTo = vi.fn();
    return track;
  };

  it('two full-width screens on one horizontal track with x-mandatory snap', () => {
    renderTrack({});
    const track = q('[data-board-cockpit-track]');
    expect(track.style.scrollSnapType).toBe('x mandatory');
    expect(track.style.overflowX).toBe('auto');
    const panels = qa('[role="tabpanel"]');
    expect(panels.map((p) => p.getAttribute('data-board-cockpit-panel'))).toEqual(['board', 'cockpit']);
    expect(panels.every((p) => p.style.scrollSnapAlign === 'start' && p.style.overflowY === 'auto')).toBe(true);
    expect(panels[0].getAttribute('aria-labelledby')).toBe('board-cockpit-tab-board');
  });

  it('the screen not selected stays mounted but inert and hidden from assistive tech', () => {
    renderTrack({});
    const [board, cockpit] = qa('[role="tabpanel"]');
    expect(board.hasAttribute('inert')).toBe(false);
    expect(cockpit.hasAttribute('inert')).toBe(true);
    expect(cockpit.getAttribute('aria-hidden')).toBe('true');
    expect(q('[data-c]')).toBeTruthy();
  });

  it('selecting Cockpit on the switch scrolls the track to it — smooth', () => {
    renderTrack({});
    const track = sized();
    renderTrack({ screen: PHONE_SCREEN.COCKPIT });
    expect(track.scrollTo).toHaveBeenCalledWith({ left: 400, behavior: 'smooth' });
  });

  it('…and instantly (`auto`) under reduced motion', () => {
    renderTrack({ reducedMotion: true });
    const track = sized();
    renderTrack({ screen: PHONE_SCREEN.COCKPIT, reducedMotion: true });
    expect(track.scrollTo).toHaveBeenCalledWith({ left: 400, behavior: 'auto' });
  });

  const scrollTo = (track, left) => act(() => { track.scrollLeft = left; track.dispatchEvent(new Event('scroll', { bubbles: true })); });
  const settleBy = (track, how) => act(() => {
    if (how === 'scrollend') track.dispatchEvent(new Event('scrollend'));
    else vi.advanceTimersByTime(TRACK_SETTLE_IDLE_MS + 1);
  });

  it('a swipe moves the switch only when the track SETTLES — on scrollend, or after the idle where the browser has none (review L5-2)', () => {
    vi.useFakeTimers();
    try {
      for (const how of ['scrollend', 'idle']) {
        const onScreen = vi.fn();
        renderTrack({ onScreen, screen: PHONE_SCREEN.BOARD });
        const track = sized();
        scrollTo(track, 390);
        expect(onScreen).not.toHaveBeenCalled(); // never mid-gesture
        settleBy(track, how);
        expect(onScreen).toHaveBeenCalledWith('cockpit');
        expect(track.scrollTo).not.toHaveBeenCalled(); // a settled swipe is never answered with a programmatic scroll
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('a hesitant drag past halfway that comes back never flips the selection', () => {
    vi.useFakeTimers();
    try {
      const onScreen = vi.fn();
      renderTrack({ onScreen });
      const track = sized();
      scrollTo(track, 250); // past halfway, finger still down
      scrollTo(track, 100);
      scrollTo(track, 0); // released back on Board
      settleBy(track, 'idle');
      expect(onScreen).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a switch-driven scroll that the player interrupts back to Board ends with Board selected — the selection names what shows', () => {
    vi.useFakeTimers();
    try {
      const onScreen = vi.fn();
      renderTrack({ onScreen });
      const track = sized();
      renderTrack({ onScreen, screen: PHONE_SCREEN.COCKPIT }); // the switch asked for Cockpit
      expect(track.scrollTo).toHaveBeenCalledWith({ left: 400, behavior: 'smooth' });
      scrollTo(track, 120); // mid-flight, then the player drags back
      scrollTo(track, 0);
      settleBy(track, 'scrollend');
      expect(onScreen).toHaveBeenCalledWith('board');
      // An arrival that lands where the selection already is changes nothing.
      onScreen.mockClear();
      renderTrack({ onScreen, screen: PHONE_SCREEN.COCKPIT });
      scrollTo(track, 400);
      settleBy(track, 'scrollend');
      expect(onScreen).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('the FIRST position is set without animation (a remount on Cockpit never glides)', () => {
    const proto = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const scrollToSpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return 400; } });
    HTMLElement.prototype.scrollTo = scrollToSpy;
    try {
      renderTrack({ screen: PHONE_SCREEN.COCKPIT });
      expect(scrollToSpy).toHaveBeenCalledWith({ left: 400, behavior: 'auto' });
      scrollToSpy.mockClear();
      q('[data-board-cockpit-track]').scrollLeft = 400; // the browser arrived
      renderTrack({ screen: PHONE_SCREEN.BOARD });
      expect(scrollToSpy).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' });
    } finally {
      if (proto) Object.defineProperty(HTMLElement.prototype, 'clientWidth', proto);
      delete HTMLElement.prototype.scrollTo;
    }
  });

  it('while the sheet is open the cockpit screen\'s scroller holds still (declaratively); the board screen is untouched', () => {
    renderTrack({ lockCockpit: true });
    expect(q('[data-board-cockpit-panel="cockpit"]').style.overflowY).toBe('hidden');
    expect(q('[data-board-cockpit-panel="board"]').style.overflowY).toBe('auto');
    renderTrack({ lockCockpit: false });
    expect(q('[data-board-cockpit-panel="cockpit"]').style.overflowY).toBe('auto');
  });

  it('the cockpit screen hands its scroller to the screen (the sheet locks it)', () => {
    const cockpitScrollRef = { current: null };
    renderTrack({ cockpitScrollRef });
    expect(cockpitScrollRef.current?.getAttribute('data-board-cockpit-panel')).toBe('cockpit');
  });
});
