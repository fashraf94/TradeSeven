// @vitest-environment jsdom
//
// src/screens/battleView/useContentStable.test.jsx
//
// Review finding F3: under the flag the live doc's portfolio is a fresh object
// per snapshot, and the price-poll effect keyed on it restarted every time.
// Holding the source by content keeps its identity until a value changes.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import useContentStable, { contentKey } from './useContentStable';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let seen;

function Probe({ value }) {
  seen.push(useContentStable(value));
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  seen = [];
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (value) => act(() => { root.render(<Probe value={value} />); });

describe('useContentStable', () => {
  it('returns the SAME object for a fresh object with the same content (a Firestore re-snapshot)', () => {
    const a = { star: [{ symbol: 'AAPL' }], startingPrices: { AAPL: 150 } };
    render(a);
    render({ star: [{ symbol: 'AAPL' }], startingPrices: { AAPL: 150 } });
    expect(seen[1]).toBe(a);
  });

  it('moves to the new object when a value changes (a swap)', () => {
    const a = { star: [{ symbol: 'AAPL' }] };
    const b = { star: [{ symbol: 'SLB', swapPrice: 34.1 }] };
    render(a);
    render(b);
    expect(seen[1]).toBe(b);
  });

  it('null stays null; a later object is returned as is', () => {
    render(null);
    expect(seen[0]).toBeNull();
    const a = { star: [] };
    render(a);
    expect(seen[1]).toBe(a);
  });

  it('contentKey is stable for equal content and null-safe', () => {
    expect(contentKey({ a: 1 })).toBe(contentKey({ a: 1 }));
    expect(contentKey(null)).toBe('null');
    expect(contentKey(undefined)).toBe('null');
    const cyclic = {}; cyclic.self = cyclic;
    expect(contentKey(cyclic)).toBeNull();
  });
});
