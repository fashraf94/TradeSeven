// @vitest-environment jsdom
// src/screens/battleView/useIntradayView.jsdom.test.jsx — contract §8.1 (client) / §9.1.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ getDoc: vi.fn(), flag: { value: false }, docs: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...segs) => ({ path: segs.join('/') }),
  getDoc: (ref) => mocks.getDoc(ref),
}));
vi.mock('../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), get INTRADAY_DIAGNOSTIC_ENABLED() { return mocks.flag.value; } }));

const { useIntradayView } = await import('./useIntradayView.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function Probe({ open, battleId, evaluation, onView }) {
  const view = useIntradayView({ open, battleId, evaluation });
  onView(view);
  return null;
}
async function mount(props) {
  const host = document.createElement('div');
  const root = createRoot(host);
  await act(async () => { root.render(<Probe {...props} />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 15)); });
  return root;
}
const entry = (over = {}) => ({ evalId: 'eval_3', intradayViewRef: 'eval_3', ...over });

beforeEach(() => {
  mocks.getDoc.mockReset();
  mocks.getDoc.mockImplementation(async (ref) => { const d = mocks.docs[ref.path]; return { exists: () => d != null, data: () => d }; });
  mocks.docs = { 'agentBattles/b1/intradayViews/eval_3': { evalId: 'eval_3', symbols: { SLB: {} } } };
});

describe('useIntradayView — one get on open, never a subscription', () => {
  it('flag off: fetches nothing and returns null even when the entry points at a view', async () => {
    mocks.flag.value = false;
    const seen = [];
    await mount({ open: true, battleId: 'b1', evaluation: entry(), onView: (v) => seen.push(v) });
    expect(mocks.getDoc).not.toHaveBeenCalled();
    expect(seen.every((v) => v === null)).toBe(true);
  });
  it('flag on: one get when open and intradayViewRef === evalId; the document is used only when ITS evalId matches', async () => {
    mocks.flag.value = true;
    const seen = [];
    await mount({ open: true, battleId: 'b1', evaluation: entry(), onView: (v) => seen.push(v) });
    expect(mocks.getDoc).toHaveBeenCalledTimes(1);
    expect(mocks.getDoc.mock.calls[0][0].path).toBe('agentBattles/b1/intradayViews/eval_3');
    expect(seen.at(-1)?.evalId).toBe('eval_3');
  });
  it('a fetched document whose evalId does not match is discarded; a mismatched pointer or a closed panel fetches nothing', async () => {
    mocks.flag.value = true;
    mocks.docs['agentBattles/b1/intradayViews/eval_3'] = { evalId: 'eval_2', symbols: {} };
    const seen = [];
    await mount({ open: true, battleId: 'b1', evaluation: entry(), onView: (v) => seen.push(v) });
    expect(mocks.getDoc).toHaveBeenCalledTimes(1);
    expect(seen.every((v) => v === null)).toBe(true);
    mocks.getDoc.mockClear();
    await mount({ open: true, battleId: 'b1', evaluation: entry({ intradayViewRef: 'eval_2' }), onView: () => {} });
    await mount({ open: false, battleId: 'b1', evaluation: entry(), onView: () => {} });
    await mount({ open: true, battleId: 'b1', evaluation: entry({ intradayViewRef: null }), onView: () => {} });
    expect(mocks.getDoc).not.toHaveBeenCalled();
  });
});
