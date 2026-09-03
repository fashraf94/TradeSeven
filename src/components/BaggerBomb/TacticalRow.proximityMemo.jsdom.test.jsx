// @vitest-environment jsdom
//
// src/components/BaggerBomb/TacticalRow.proximityMemo.jsdom.test.jsx
//
// A4 review, refuter C: the A2 lift memoised the row's proximity on the asset
// OBJECT's identity, where the shipped label memoised on its primitives — so
// a caller re-rendering with the SAME object mutated in place would have seen
// the row's % move while the proximity text stayed (the §9 display-
// disagreement class). No in-repo caller mutates an asset; the contract is
// kept equal to the shipped one anyway, and this row is the guard: the same
// object, mutated, re-rendered → the label follows the number, on both sides
// and on the standalone side.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TacticalRow, { AssetSide } from './TacticalRow';

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

const asset = (priceChange) => ({
  symbol: 'AAPL', priceChange, baseATR: 2.5, history: { maxMultiplier: 0, minMultiplier: 0 }, points: 0, badges: [],
});
const labels = () => [...container.querySelectorAll('div')].map((d) => d.textContent).filter((t) => /% to Bagger/.test(t)).slice(-2);

describe('the row proximity follows the VALUES, not the object identity', () => {
  it('the same asset objects mutated in place re-render with the new distance on both sides', () => {
    const left = asset(0.5);
    const right = asset(0.5);
    act(() => { root.render(<TacticalRow leftAsset={left} rightAsset={right} tier="star" />); });
    expect(container.textContent).toContain('💣 2.0% to Bagger');
    expect(container.textContent).not.toContain('1.0% to Bagger');
    left.priceChange = 1.5;
    right.priceChange = 1.5;
    act(() => { root.render(<TacticalRow leftAsset={left} rightAsset={right} tier="star" />); });
    expect((container.textContent.match(/💣 1\.0% to Bagger/g) || []).length).toBe(2);
    expect(container.textContent).not.toContain('2.0% to Bagger');
  });

  it('the standalone side too', () => {
    const one = asset(0.5);
    act(() => { root.render(<AssetSide asset={one} />); });
    expect(container.textContent).toContain('💣 2.0% to Bagger');
    one.priceChange = 1.5;
    act(() => { root.render(<AssetSide asset={one} />); });
    expect(container.textContent).toContain('💣 1.0% to Bagger');
  });

  it('a fresh object (every in-repo caller) updates as before', () => {
    act(() => { root.render(<TacticalRow leftAsset={asset(0.5)} rightAsset={null} tier="star" />); });
    expect(container.textContent).toContain('💣 2.0% to Bagger');
    act(() => { root.render(<TacticalRow leftAsset={asset(1.5)} rightAsset={null} tier="star" />); });
    expect(container.textContent).toContain('💣 1.0% to Bagger');
  });
});
