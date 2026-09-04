// @vitest-environment jsdom
//
// src/screens/battleView/useBaggerMoment.test.jsx
//
// A3.6 (D-97) — the bagger moment's SESSION STATE: the seed, the two lifetimes,
// the timer.
//
// WHY THIS FILE EXISTS (review lens 2, F5). Every other hook in this directory
// has one — useCharacterPane, useChatSheet, useContentStable, useLandingKey,
// useCoarseNow — and this one did not. The pure half got
// deriveBaggerMoment.test.js; the half that owns WHEN the seed is taken and
// how long each half of the moment lives got nothing. That is the half that
// carried the review's P1: the seed was being taken against a doc that had not
// arrived, so every already-banked piece announced itself as a fresh crossing
// on every load. Two lenses found it independently and no shipped row could
// have, because every SCREEN harness mocks useAgentBattle with the doc already
// present and `loading: false`.
//
// So the first describe below is the ordering the screen actually has, tested
// at the hook rather than through the screen: the first render has no doc.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useBaggerMoment, BAGGER_BURST_MS } from './useBaggerMoment';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let api;

function Probe({ enabled = true, battle = null, book = [], paneOpen = false }) {
  api = useBaggerMoment(enabled, battle, book, { paneOpen });
  return null;
}

const render = (props) => act(() => { root.render(<Probe {...props} />); });
const doc = (history) => ({ thresholdHistory: history });
const book = (...symbols) => symbols.map((symbol) => ({ symbol }));
const burstOf = () => [...api.burst].sort();

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('THE SEED WAITS FOR A DOC — the review\'s P1', () => {
  it('a first render with NO doc announces nothing, and does not consume the seed', () => {
    // The screen's real ordering: this hook is called above the `loading` early
    // return (hooks are unconditional), so its first run sees
    // `{battle: null, loading: true}` — while the BOOK is already full, because
    // playerPortfolioSource falls back to the prop's portfolio.
    render({ battle: null, book: book('NVDA') });
    expect(burstOf()).toEqual([]);
    expect(api.bubbleSymbol).toBeNull();

    // …and now the subscription resolves, carrying a peak banked hours ago.
    // Before the fix this render announced it: seed 0 vs now 1.6.
    render({ battle: doc({ NVDA: { maxMultiplier: 1.6 } }), book: book('NVDA') });
    expect(burstOf()).toEqual([]);
    expect(api.bubbleSymbol).toBeNull();
  });

  it('…and the piece can still cross AFTERWARDS, once', () => {
    // The fix must not buy silence by never firing.
    render({ battle: null, book: book('NVDA') });
    render({ battle: doc({ NVDA: { maxMultiplier: 0.8 } }), book: book('NVDA') });
    expect(burstOf()).toEqual([]);
    render({ battle: doc({ NVDA: { maxMultiplier: 1.2 } }), book: book('NVDA') });
    expect(burstOf()).toEqual(['NVDA']);
    expect(api.bubbleSymbol).toBe('NVDA');
  });

  it('an EMPTY first book is the same door, and is also shut', () => {
    // The other ordering: the doc lands before the portfolio resolves. An
    // unseen symbol enters at 0 by design (the swapped-in case), so a seed
    // taken over an empty book would announce every piece that arrived after.
    render({ battle: null, book: [] });
    render({ battle: doc({ AAPL: { maxMultiplier: 2.1 } }), book: [] });
    render({ battle: doc({ AAPL: { maxMultiplier: 2.1 } }), book: book('AAPL') });
    expect(burstOf()).toEqual([]);
  });

  it('a doc present on the FIRST render seeds silently, as it always did', () => {
    render({ battle: doc({ NVDA: { maxMultiplier: 1.6 } }), book: book('NVDA') });
    expect(burstOf()).toEqual([]);
  });
});

describe('the two lifetimes', () => {
  const cross = () => {
    render({ battle: doc({ NVDA: { maxMultiplier: 0.5 } }), book: book('NVDA') });
    render({ battle: doc({ NVDA: { maxMultiplier: 1.4 } }), book: book('NVDA') });
  };

  it('the BURST ends on its own; the BUBBLE waits to be read', () => {
    cross();
    expect(burstOf()).toEqual(['NVDA']);
    expect(api.bubbleSymbol).toBe('NVDA');
    act(() => { vi.advanceTimersByTime(BAGGER_BURST_MS + 1); });
    expect(burstOf()).toEqual([]);
    // The bubble is not motion — it is the character telling you, and it stays.
    expect(api.bubbleSymbol).toBe('NVDA');
  });

  it('opening the pane clears the bubble — the same act that clears the count', () => {
    cross();
    expect(api.bubbleSymbol).toBe('NVDA');
    render({ battle: doc({ NVDA: { maxMultiplier: 1.4 } }), book: book('NVDA'), paneOpen: true });
    expect(api.bubbleSymbol).toBeNull();
  });

  it('a crossing WHILE the pane is open never sets a bubble to find on collapse', () => {
    // The gate the review found unguarded (lens 1 F4). The mark is not on the
    // board while the pane is open, so a bubble set then is invisible — and the
    // clearing effect only runs when `paneOpen` CHANGES, so it would sit there
    // waiting to appear on the next collapse, describing a crossing the player
    // was already looking at the row for.
    render({ battle: doc({ NVDA: { maxMultiplier: 0.5 } }), book: book('NVDA'), paneOpen: true });
    render({ battle: doc({ NVDA: { maxMultiplier: 1.4 } }), book: book('NVDA'), paneOpen: true });
    expect(burstOf()).toEqual(['NVDA']);          // the row still bursts
    expect(api.bubbleSymbol).toBeNull();
    // …and collapsing does not surface it.
    render({ battle: doc({ NVDA: { maxMultiplier: 1.4 } }), book: book('NVDA'), paneOpen: false });
    expect(api.bubbleSymbol).toBeNull();
  });
});

describe('two crossings inside one window', () => {
  it('the second JOINS the first — it does not cut its burst short', () => {
    // The review (lens 1 F5 / lens 2 F2) found the first shape replacing the
    // set, so a crossing landing 100ms into the window ended the first symbol's
    // wash immediately — the opposite of what the timer's own comment claimed.
    render({ battle: doc({ AAA: { maxMultiplier: 0.2 }, BBB: { maxMultiplier: 0.2 } }), book: book('AAA', 'BBB') });
    render({ battle: doc({ AAA: { maxMultiplier: 1.3 }, BBB: { maxMultiplier: 0.2 } }), book: book('AAA', 'BBB') });
    expect(burstOf()).toEqual(['AAA']);
    act(() => { vi.advanceTimersByTime(100); });
    render({ battle: doc({ AAA: { maxMultiplier: 1.3 }, BBB: { maxMultiplier: 1.1 } }), book: book('AAA', 'BBB') });
    expect(burstOf()).toEqual(['AAA', 'BBB']);
  });
});

describe('the flag, and the timer', () => {
  it('disabled, nothing is watched — and re-enabling SEEDS rather than compares', () => {
    render({ enabled: false, battle: doc({ NVDA: { maxMultiplier: 0.2 } }), book: book('NVDA') });
    expect(burstOf()).toEqual([]);
    // Re-enabled against a doc that has crossed in the meantime: this is a seed,
    // not a crossing. A map remembered from another lifetime would announce it.
    render({ enabled: true, battle: doc({ NVDA: { maxMultiplier: 1.9 } }), book: book('NVDA') });
    expect(burstOf()).toEqual([]);
    expect(api.bubbleSymbol).toBeNull();
  });

  it('the timer does not fire into an unmounted tree', () => {
    render({ battle: doc({ NVDA: { maxMultiplier: 0.5 } }), book: book('NVDA') });
    render({ battle: doc({ NVDA: { maxMultiplier: 1.4 } }), book: book('NVDA') });
    expect(burstOf()).toEqual(['NVDA']);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => root.unmount());
    act(() => { vi.advanceTimersByTime(BAGGER_BURST_MS * 3); });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    // The afterEach unmount must stay legal.
    root = createRoot(container);
  });

  it('`burst` is a STABLE empty set when nothing is bursting', () => {
    // A fresh Set() every render would make every consumer's memo miss.
    render({ battle: doc({ NVDA: { maxMultiplier: 0.5 } }), book: book('NVDA') });
    const first = api.burst;
    render({ battle: doc({ NVDA: { maxMultiplier: 0.6 } }), book: book('NVDA') });
    expect(api.burst).toBe(first);
    expect(api.burst.size).toBe(0);
  });
});
