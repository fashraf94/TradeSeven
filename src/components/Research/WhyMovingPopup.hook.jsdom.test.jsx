// @vitest-environment jsdom
//
// The "Why is it moving?" popup after its fetch moved into useWhyMoving, the
// hook the two-view shell's What's moving tab shares (spec
// docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-7): the popup still asks only
// while open, with the same body, caches per symbol, and renders the same body
// in each state; the hook asks nothing while inactive.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const net = vi.hoisted(() => ({ posts: [], answer: null }));
vi.mock('../../utils/fetchWithAuth', () => ({
  fetchWithAuth: async (u, o) => { net.posts.push([String(u), JSON.parse(o.body)]); return net.answer(); },
}));

import WhyMovingPopup, { useWhyMoving, whyMovingChangeText } from './WhyMovingPopup.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container, root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  net.posts.length = 0;
  net.answer = async () => ({ json: async () => ({ success: true, data: { catalyst: 'Demand rose.', catalystType: 'news', citations: ['https://www.reuters.com/a'] } }) });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); }); };
const PROPS = { symbol: 'AAPL', name: 'Apple Inc', change: 1.234, price: 103.2, open: 101, high: 104.1, low: 100.6, close: 103.2 };

describe('WhyMovingPopup over useWhyMoving', () => {
  it('closed: no request, nothing shown; open: ONE POST with the popup\'s body, then its content; reopened: the cache, no second POST', async () => {
    await act(async () => { root.render(<WhyMovingPopup {...PROPS} isOpen={false} onClose={() => {}} />); });
    await flush();
    expect(net.posts).toEqual([]);
    expect(document.body.textContent).not.toContain('Why is');
    await act(async () => { root.render(<WhyMovingPopup {...PROPS} isOpen onClose={() => {}} />); });
    await flush();
    expect(net.posts).toEqual([['/api/why-moving', { symbol: 'AAPL', name: 'Apple Inc', change: 1.234, price: 103.2, open: 101, high: 104.1, low: 100.6, close: 103.2 }]]);
    expect(document.body.textContent).toContain('Why is Apple Inc +1.2%?');
    expect(document.body.textContent).toContain('Demand rose.');
    expect(document.body.textContent).toContain('reuters.com');
    await act(async () => { root.render(<WhyMovingPopup {...PROPS} isOpen={false} onClose={() => {}} />); });
    await flush();
    await act(async () => { root.render(<WhyMovingPopup {...PROPS} isOpen onClose={() => {}} />); });
    await flush();
    expect(net.posts).toHaveLength(1);
  });
  it('a failed answer shows the retry, and the retry asks again', async () => {
    net.answer = async () => ({ json: async () => ({ success: false, error: 'down' }) });
    await act(async () => { root.render(<WhyMovingPopup {...PROPS} isOpen onClose={() => {}} />); });
    await flush();
    expect(document.body.textContent).toContain("Couldn't fetch explanation right now.");
    const retry = [...document.body.querySelectorAll('button')].find((b) => b.textContent === 'Retry');
    await act(async () => { retry.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await flush();
    expect(net.posts).toHaveLength(2);
  });
});

describe('useWhyMoving, inactive', () => {
  function Probe({ active, out }) { out.value = useWhyMoving({ ...PROPS, active }); return null; }
  it('asks nothing until active; then one request', async () => {
    const out = {};
    await act(async () => { root.render(<Probe active={false} out={out} />); });
    await flush();
    expect(net.posts).toEqual([]);
    expect(out.value.state).toBe('idle');
    await act(async () => { root.render(<Probe active out={out} />); });
    await flush();
    expect(net.posts).toHaveLength(1);
    expect(out.value.state).toBe('success');
  });
  it('the change text: one decimal, a plus for gains, nothing without a finite change', () => {
    expect([whyMovingChangeText(2.17), whyMovingChangeText(-1.44), whyMovingChangeText(undefined)]).toEqual(['+2.2%', '-1.4%', '']);
  });
});
