// src/components/CommandCenter/hub/loadSharedResearch.test.js
//
// Command Center core spec V1.2, Amendment E V1.1 §3.2 — the research loader, the hub graph's second load-time edge: its one
// import() is requested once per page (the promise is kept) and reset on failure, so a retry starts a fresh import — the
// agent form engine's loader pattern (AgentForm/loadEngine.js). The body module is a stand-in (vi.doMock per row); the real
// body is never loaded here.

import { afterEach, describe, expect, it, vi } from 'vitest';

const BODY = '../../SharedResearch/SharedResearchSheetBody.jsx';
function StubBody() { return null; }

afterEach(() => {
  vi.doUnmock(BODY);
  vi.resetModules();
});

describe('loadSharedResearch', () => {
  it('one import per page: every call answers the same kept promise, which resolves to the body module', async () => {
    vi.resetModules();
    const evaluations = { n: 0 };
    vi.doMock(BODY, () => { evaluations.n += 1; return { default: StubBody }; });
    const { loadSharedResearch } = await import('./loadSharedResearch');
    const first = loadSharedResearch();
    expect(loadSharedResearch()).toBe(first);
    const module = await first;
    expect(module.default).toBe(StubBody);
    expect(loadSharedResearch()).toBe(first);
    expect(evaluations.n).toBe(1);
  });

  it('a failed import is not kept: the next call is a NEW import, and it loads', async () => {
    vi.resetModules();
    vi.doMock(BODY, () => { throw new Error('chunk failed'); });
    const { loadSharedResearch } = await import('./loadSharedResearch');
    const failed = loadSharedResearch();
    let rejected = false;
    await failed.catch(() => { rejected = true; });
    expect(rejected).toBe(true);
    vi.doMock(BODY, () => ({ default: StubBody }));
    const fresh = loadSharedResearch();
    // a kept failure would hand back the same rejected promise
    expect(fresh === failed).toBe(false);
    const module = await fresh;
    expect(module.default).toBe(StubBody);
    expect(loadSharedResearch()).toBe(fresh);
  });
});
