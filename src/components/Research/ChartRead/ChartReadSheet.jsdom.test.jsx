// @vitest-environment jsdom
//
// The Chart view's read — THE SHEET ON ITS OWN (SH-4; spec docs/specs/CHART_READ_SPEC_V1.md): with reduced motion it
// appears in place (no rise); without it, it rises from 24 px below. Mutation Q5 of the build's battery (the
// reduced-motion arm) survived the modal rows; this row is its guard in jsdom (the real-browser row is the other).

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../useTechnicalScore.js', () => ({ default: () => ({ data: null, loading: false, error: null }) }));

import { bodyFor } from './__fixtures__/chartReadRecords.js';
import ChartReadSheet from './ChartReadSheet.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
let body;
beforeAll(async () => { body = await bodyFor('VALID_PULLBACK', { session: '2026-11-17' }); });
let root;
let container;
afterEach(() => { act(() => root.unmount()); container.remove(); });
const mount = (reducedMotion) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<ChartReadSheet body={body} symbol="ABC" litKey={null} onRow={() => {}} expanded={false} onExpand={() => {}} onClose={() => {}} viewRef={{ current: null }} reducedMotion={reducedMotion} />); });
  return container.querySelector('[data-chart-read-sheet]');
};

describe('the sheet\'s entrance', () => {
  it('reduced motion: it appears in place — no offset, fully opaque, at its first frame', () => {
    const el = mount(true);
    expect(el.style.transform === '' || el.style.transform === 'none').toBe(true);
    expect(el.style.opacity === '' || el.style.opacity === '1').toBe(true);
  });
  it('without it: it starts 24 px below and transparent, then rises', () => {
    const el = mount(false);
    expect(el.style.transform).toContain('24px');
    expect(el.style.opacity).toBe('0');
  });
});
