// @vitest-environment jsdom
//
// src/components/CommandCenter/SharedResearchSheet.jsdom.test.jsx
//
// Command Center core spec V1.2, Amendment E V1.1 §3.2 — the Shared Research sheet's wrapper, over a body loader each row
// controls (createSharedResearchSheet(load); the default export binds hub/loadSharedResearch.js): the loading line, then the
// body; a rejected load shows its line, and Try again starts a FRESH load and swaps the body in only once it has loaded; the
// HubSheet it renders (720 wide, the hub's three strings); and the props it hands the body (amendment §3.2's table), the hub's
// own overlay stack among them.

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSharedResearchSheet } from './SharedResearchSheet';
import { HubOverlayProvider, useHubOverlays } from './hub/HubOverlays';
import { HUB_COPY as COPY } from './hub/hubCopy';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const probe = vi.hoisted(() => ({ props: null, renders: 0, stack: null }));
function StubBody(props) {
  probe.props = props;
  probe.renders += 1;
  return <div data-stub-body={props.mode}><button type="button" data-stub-inner="">inner</button></div>;
}
const BODY_MODULE = Object.freeze({ default: StubBody });
function Thrower() { throw new Error('the body broke'); }

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const flush = () => act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });

function StackProbe() { probe.stack = useHubOverlays(); return null; }

let host;
let root;
let errorSpy;
beforeEach(() => {
  probe.props = null;
  probe.renders = 0;
  probe.stack = null;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  // React reports the rejected lazy and the thrown body on the console; the rows read the screen, not the log.
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  act(() => { root.unmount(); });
  host.remove();
  errorSpy.mockRestore();
});

const PROPS = Object.freeze({
  entry: { mode: 'start' },
  stories: [{ itemRef: { recordKind: 'fantasyTimesStories', recordId: 'st_1' }, headline: 'H', reporterName: 'R', beat: 'Stock Spotlight', publishedAt: '2026-11-14T13:00:00.000Z', context: null, question: 'Q', reason: null }],
  agentName: 'Atlas',
  agentId: 'agent-a',
  equippedListLabel: 'Grid builders',
  gated: false,
  onClose: () => {},
});
function render(Sheet, props = {}) {
  act(() => { root.render(<HubOverlayProvider><StackProbe /><Sheet {...PROPS} {...props} /></HubOverlayProvider>); });
}
const dialog = () => document.querySelector('[role="dialog"]');
const failedLine = () => document.querySelector('[data-hub-research-load-failed]');
const tryAgain = () => [...(failedLine()?.querySelectorAll('button') ?? [])].find((b) => b.textContent === COPY.research.door.tryAgain) ?? null;
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });

describe('the lazy body: loading, then the body (amendment §3.2)', () => {
  it('nothing is loaded until the sheet renders; then one load, the loading line, then the body', async () => {
    const d = deferred();
    const load = vi.fn(() => d.promise);
    const Sheet = createSharedResearchSheet(load);
    expect(load).not.toHaveBeenCalled();
    render(Sheet);
    expect(load).toHaveBeenCalledTimes(1);
    expect(dialog().textContent).toContain(COPY.research.loading);
    expect(dialog().querySelector('[data-hub-loading]')).not.toBeNull();
    expect(document.querySelector('[data-stub-body]')).toBeNull();
    await act(async () => { d.resolve(BODY_MODULE); });
    await flush();
    expect(document.querySelector('[data-stub-body]')).not.toBeNull();
    expect(dialog().querySelector('[data-hub-loading]')).toBeNull();
  });

  it('a second open of a sheet whose body has loaded renders the body at once, with no second load', async () => {
    const load = vi.fn(async () => BODY_MODULE);
    const Sheet = createSharedResearchSheet(load);
    render(Sheet);
    await flush();
    act(() => { root.render(<HubOverlayProvider><div /></HubOverlayProvider>); });
    render(Sheet);
    expect(document.querySelector('[data-stub-body]')).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('a failed load, and Try again (the gate\'s retry pattern)', () => {
  it('a rejected load shows "Couldn\'t open Shared Research" with Try again, and no body', async () => {
    const load = vi.fn(async () => { throw new Error('chunk failed'); });
    const Sheet = createSharedResearchSheet(load);
    render(Sheet);
    await flush();
    expect(failedLine()).not.toBeNull();
    expect(failedLine().textContent).toContain(COPY.research.door.loadFailed);
    expect(tryAgain()).not.toBeNull();
    expect(document.querySelector('[data-stub-body]')).toBeNull();
  });

  it('Try again starts a FRESH load and swaps the body in once it has loaded', async () => {
    const d = deferred();
    const load = vi.fn().mockRejectedValueOnce(new Error('chunk failed')).mockReturnValueOnce(d.promise);
    const Sheet = createSharedResearchSheet(load);
    render(Sheet);
    await flush();
    click(tryAgain());
    expect(load).toHaveBeenCalledTimes(2);
    // while the fresh load is out the line stays: nothing is swapped in before it has loaded
    expect(failedLine()).not.toBeNull();
    await act(async () => { d.resolve(BODY_MODULE); });
    await flush();
    expect(failedLine()).toBeNull();
    expect(document.querySelector('[data-stub-body]')).not.toBeNull();
  });

  it('a failed retry leaves the line as it was; a later Try again loads again', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('one')).mockRejectedValueOnce(new Error('two')).mockResolvedValueOnce(BODY_MODULE);
    const Sheet = createSharedResearchSheet(load);
    render(Sheet);
    await flush();
    click(tryAgain());
    await flush();
    expect(failedLine()).not.toBeNull();
    click(tryAgain());
    await flush();
    expect(load).toHaveBeenCalledTimes(3);
    expect(document.querySelector('[data-stub-body]')).not.toBeNull();
  });

  it('presses while a retry is out share it: one fresh load', async () => {
    const d = deferred();
    const load = vi.fn().mockRejectedValueOnce(new Error('chunk failed')).mockReturnValueOnce(d.promise);
    const Sheet = createSharedResearchSheet(load);
    render(Sheet);
    await flush();
    click(tryAgain());
    click(tryAgain());
    click(tryAgain());
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => { d.resolve(BODY_MODULE); });
    await flush();
    expect(document.querySelector('[data-stub-body]')).not.toBeNull();
  });

  it('while a retry is out, Try again stays (so it keeps focus) with aria-disabled and the loading line beside it; a failed retry clears both (review C6)', async () => {
    const d = deferred();
    const load = vi.fn().mockRejectedValueOnce(new Error('chunk failed')).mockReturnValueOnce(d.promise);
    const Sheet = createSharedResearchSheet(load);
    render(Sheet);
    await flush();
    expect(tryAgain().getAttribute('aria-disabled')).toBeNull();
    tryAgain().focus();
    click(tryAgain());
    expect(failedLine().getAttribute('data-hub-research-load-failed')).toBe('retrying');
    expect(tryAgain().getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(tryAgain());
    expect(failedLine().querySelector('[data-hub-loading]').textContent).toContain(COPY.research.loading);
    await act(async () => { d.reject(new Error('still failing')); });
    await flush();
    expect(tryAgain().getAttribute('aria-disabled')).toBeNull();
    expect(failedLine().querySelector('[data-hub-loading]')).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('a body that throws while rendering shows the same line, inside the sheet', async () => {
    const Sheet = createSharedResearchSheet(async () => ({ default: Thrower }));
    render(Sheet);
    await flush();
    expect(dialog()).not.toBeNull();
    expect(failedLine()).not.toBeNull();
  });
});

describe('the sheet and the props it hands the body (amendment §3.2\'s table)', () => {
  it('a HubSheet 720 wide on the wide compositions, with the hub\'s title, eyebrow and label', async () => {
    const Sheet = createSharedResearchSheet(async () => BODY_MODULE);
    render(Sheet);
    await flush();
    expect(dialog().getAttribute('aria-label')).toBe(COPY.research.workLabel);
    expect(dialog().querySelector('h2').textContent).toBe(COPY.research.workTitle);
    expect(dialog().textContent).toContain(COPY.research.workEyebrow);
    expect(dialog().style.maxWidth).toBe('720px');
    expect(dialog().getAttribute('data-hub-sheet')).toBe('dialog');
    expect([COPY.research.workTitle, COPY.research.workEyebrow, COPY.research.workLabel]).toEqual(['Work an idea', 'Shared Research', 'Shared Research · work an idea']);
  });

  it('mode start: open, the start mode, no item, no direction, no session, the stories, the agent, the list, gated false, the hub\'s overlay stack', async () => {
    const Sheet = createSharedResearchSheet(async () => BODY_MODULE);
    const onClose = vi.fn();
    render(Sheet, { onClose });
    await flush();
    const p = probe.props;
    expect(p).toMatchObject({ open: true, mode: 'start', item: null, direction: null, sessionId: null, agentName: 'Atlas', agentId: 'agent-a', equippedListLabel: 'Grid builders', gated: false, phone: false });
    expect(p.stories).toEqual(PROPS.stories);
    expect(p.onClose).toBe(onClose);
    expect(p.overlayStack).toBe(probe.stack);
    expect(typeof p.overlayStack.open).toBe('function');
  });

  it('mode session: the session id; the phone: a bottom sheet, phone handed on', async () => {
    const Sheet = createSharedResearchSheet(async () => BODY_MODULE);
    render(Sheet, { entry: { mode: 'session', sessionId: 'sess-9' }, phone: true });
    await flush();
    expect(probe.props).toMatchObject({ mode: 'session', sessionId: 'sess-9', phone: true });
    expect(dialog().getAttribute('data-hub-sheet')).toBe('bottom');
  });

  it('no entry reads as the start view; stories that are not a list are []', async () => {
    const Sheet = createSharedResearchSheet(async () => BODY_MODULE);
    render(Sheet, { entry: null, stories: null });
    await flush();
    expect(probe.props).toMatchObject({ mode: 'start', sessionId: null, stories: [] });
  });

  it('a start entry never carries a session id to the body', async () => {
    const Sheet = createSharedResearchSheet(async () => BODY_MODULE);
    render(Sheet, { entry: { mode: 'start', sessionId: 'stray' } });
    await flush();
    expect(probe.props.sessionId).toBeNull();
  });
});
