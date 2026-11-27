// @vitest-environment jsdom
//
// Explore Build 1 — THE SHEET HOST AND THE PINNED BAR, on their own (build prompt K-8, K-14; spec §3.4, §3.6, N-6).
//   K-8   the four ways in pass exactly the spec's props; the hub wrapper's three lines (loading; a failed load with
//         Try again, which starts a FRESH import; the same line for a body that throws); every other child of <body>
//         inert while open and exactly those released; focus to Close, back to the opener (else the fallback),
//         never scrolling; Escape closes only from inside the dialog; Tab stays inside
//   K-14  one IntersectionObserver on the panel's own button: the bar shows only while it is off screen, carries the
//         same action and the line, takes no Tab stop, sits above the phone's nav, appears without a transition
//         under reduced motion
//   the layers: the bar above BottomNav and below the Search overlay; the sheet above both and below the body's
//         SignalDrop modal

import React from 'react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const motionPrefs = vi.hoisted(() => ({ reduced: false }));
vi.mock('framer-motion', async (importOriginal) => ({ ...(await importOriginal()), useReducedMotion: () => motionPrefs.reduced }));
vi.mock('./loadSharedResearch', () => ({ loadSharedResearch: () => new Promise(() => {}) }));
vi.mock('../../firebase/config', () => ({ db: {} }));

const { createExploreSheetHost, bodyPropsOf, inertOthers } = await import('./ExploreSheetHost');
const { default: ExplorePinnedBar, onScreenOf } = await import('./ExplorePinnedBar');
const { EXPLORE_LAYERS } = await import('./exploreStyle');
const { EXPLORE_COPY: COPY } = await import('./exploreCopy');
const { SR_DROP_LAYER } = await import('../SharedResearch/sharedResearchStyle');
const { mount, flush, click, press, $, $$, until, deferred } = await import('./__fixtures__/exploreKit');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
/** A neighbouring source file's text (as the layers rows read theirs). */
const zOfText = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
let mounted = [];
const keep = (m) => { mounted.push(m); return m; };
afterEach(() => { for (const m of mounted) m.unmount(); mounted = []; document.body.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert')); });

function recordingBody() {
  const mounts = [];
  function Body(props) {
    React.useEffect(() => { mounts.push(props); }, []);
    return <div data-body-stand-in=""><button type="button" data-inner="">inner</button></div>;
  }
  return { mounts, module: { default: Body } };
}
const ENTRY = { id: 'opening-1', way: 'work', item: { itemRef: { recordKind: 'exploreStories', recordId: 'a' }, question: 'Q?' } };

describe('K-8: what each way in hands the body (spec §3.6\'s table)', () => {
  it.each([
    ['work', { id: 'o', way: 'work', item: ENTRY.item }, { mode: 'item', item: ENTRY.item, startNow: true }],
    ['continue', { id: 'o', way: 'continue', sessionId: 's-open' }, { mode: 'session', sessionId: 's-open' }],
    ['view', { id: 'o', way: 'view', sessionId: 's-last' }, { mode: 'session', sessionId: 's-last' }],
    ['words', { id: 'o', way: 'words', words: 'drones' }, { mode: 'start', words: 'drones' }],
  ])('%s', (_n, entry, props) => {
    expect(bodyPropsOf(entry)).toEqual(props);
  });
  it('startNow only on Work this idea', () => {
    expect(['continue', 'view', 'words'].map((way) => bodyPropsOf({ way, sessionId: 's', words: 'w' }).startNow)).toEqual([undefined, undefined, undefined]);
  });
});

describe('K-8: the host', () => {
  let opener;
  let fallback;
  beforeEach(() => {
    opener = document.createElement('button');
    opener.textContent = 'opener';
    fallback = document.createElement('h1');
    fallback.tabIndex = -1;
    document.body.append(opener, fallback);
    opener.focus();
    window.scrollTo = vi.fn();
  });
  afterEach(() => { opener.remove(); fallback.remove(); });

  it('loading line while the body loads; then the body, standalone, with the entry\'s props', async () => {
    const held = deferred();
    const body = recordingBody();
    const Host = createExploreSheetHost(() => held.promise);
    keep(mount(<Host entry={ENTRY} onClose={vi.fn()} opener={opener} fallbackFocus={() => fallback} />));
    expect($('[data-explore-sheet]').textContent).toContain(COPY.sheet.loading);
    held.resolve(body.module);
    await until(() => body.mounts.length === 1, 'the body');
    expect(body.mounts[0]).toMatchObject({ open: true, mode: 'item', startNow: true, stories: [], overlayStack: null, agentName: null, agentId: null, equippedListLabel: null, direction: null });
  });
  it('a failed load: the line (an alert) and Try again, which starts a FRESH import; a failed retry keeps the line', async () => {
    const body = recordingBody();
    const load = vi.fn().mockRejectedValueOnce(new Error('chunk')).mockRejectedValueOnce(new Error('chunk')).mockResolvedValue(body.module);
    const Host = createExploreSheetHost(load);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    keep(mount(<Host entry={ENTRY} onClose={vi.fn()} opener={opener} />));
    await until(() => $('[data-explore-sheet-load-failed]'), 'the failed line');
    spy.mockRestore();
    expect($('[data-explore-sheet-load-failed] [role="alert"]').textContent).toBe(COPY.sheet.loadFailed);
    click($('[data-explore-sheet-load-failed] button'));
    await until(() => load.mock.calls.length === 2 && $('[data-explore-sheet-load-failed]')?.dataset.exploreSheetLoadFailed === '', 'the failed retry');
    expect($('[data-explore-sheet-load-failed] [role="alert"]').textContent).toBe(COPY.sheet.loadFailed);
    click($('[data-explore-sheet-load-failed] button'));
    await until(() => body.mounts.length === 1, 'the body after a retry');
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('a body that throws while rendering: the same line', async () => {
    function Throws() { throw new Error('render'); }
    const Host = createExploreSheetHost(() => Promise.resolve({ default: Throws }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    keep(mount(<Host entry={ENTRY} onClose={vi.fn()} opener={opener} />));
    await until(() => $('[data-explore-sheet-load-failed]'), 'the failed line');
    expect($('[data-explore-sheet-load-failed]').textContent).toContain(COPY.sheet.loadFailed);
    spy.mockRestore();
  });
  it('the page inert while open — every other child of <body>, never the sheet — and exactly those released; an inert one stays inert', async () => {
    const already = document.createElement('div');
    already.setAttribute('inert', '');
    document.body.append(already);
    const body = recordingBody();
    const Host = createExploreSheetHost(() => Promise.resolve(body.module));
    const m = keep(mount(<Host entry={ENTRY} onClose={vi.fn()} opener={opener} />));
    await until(() => body.mounts.length === 1, 'the body');
    const overlay = $('[data-explore-sheet-overlay]');
    expect([...document.body.children].filter((el) => el !== overlay).every((el) => el.hasAttribute('inert'))).toBe(true);
    expect(overlay.hasAttribute('inert')).toBe(false);
    m.unmount();
    mounted = mounted.filter((x) => x !== m);
    expect(opener.hasAttribute('inert')).toBe(false);
    expect(already.hasAttribute('inert')).toBe(true);
    already.remove();
  });
  it('focus to Close on open; back to the opener on close, without a scroll; to the fallback when the opener is gone', async () => {
    const body = recordingBody();
    const Host = createExploreSheetHost(() => Promise.resolve(body.module));
    const m = keep(mount(<Host entry={ENTRY} onClose={vi.fn()} opener={opener} fallbackFocus={() => fallback} />));
    expect(document.activeElement).toBe($('[data-explore-sheet-close]'));
    m.unmount();
    mounted = mounted.filter((x) => x !== m);
    expect(document.activeElement).toBe(opener);
    expect(window.scrollTo).not.toHaveBeenCalled();
    const m2 = keep(mount(<Host entry={{ ...ENTRY, id: 'opening-2' }} onClose={vi.fn()} opener={opener} fallbackFocus={() => fallback} />));
    opener.remove();
    m2.unmount();
    mounted = mounted.filter((x) => x !== m2);
    expect(document.activeElement).toBe(fallback);
  });
  it('Escape closes from inside the dialog only; the backdrop closes; Tab from the last control wraps to the first', async () => {
    const body = recordingBody();
    const onClose = vi.fn();
    const Host = createExploreSheetHost(() => Promise.resolve(body.module));
    keep(mount(<Host entry={ENTRY} onClose={onClose} opener={opener} />));
    await until(() => body.mounts.length === 1, 'the body');
    const inner = $('[data-inner]');
    inner.focus();
    press(inner, 'Tab');
    expect(document.activeElement).toBe($('[data-explore-sheet-close]'));
    press(inner, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    click($('[data-explore-sheet-backdrop]'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it('a fresh body for each opening: a new entry remounts it, even where the host itself stays mounted', async () => {
    const body = recordingBody();
    const Host = createExploreSheetHost(() => Promise.resolve(body.module));
    const m = keep(mount(<Host entry={ENTRY} onClose={vi.fn()} opener={opener} />));
    await until(() => body.mounts.length === 1, 'the first body');
    m.rerender(<Host entry={{ id: 'opening-2', way: 'continue', sessionId: 's-open' }} onClose={vi.fn()} opener={opener} />);
    await until(() => body.mounts.length === 2, 'a second body');
    expect(body.mounts.map((p) => p.mode)).toEqual(['item', 'session']);
    expect(body.mounts[1].sessionId).toBe('s-open');
  });
  it('inertOthers releases only what it marked, once', () => {
    const a = document.createElement('div');
    document.body.append(a);
    const release = inertOthers(null);
    expect(a.hasAttribute('inert')).toBe(true);
    release();
    release();
    expect(a.hasAttribute('inert')).toBe(false);
    a.remove();
  });
});

describe('K-14: the pinned bar', () => {
  let observers;
  beforeEach(() => {
    observers = [];
    globalThis.IntersectionObserver = class {
      constructor(cb, options) { this.cb = cb; this.options = options; this.targets = []; observers.push(this); }
      observe(t) { this.targets.push(t); }
      disconnect() { this.disconnected = true; }
    };
    motionPrefs.reduced = false;
  });
  const fire = (isIntersecting, ratio) => { const o = observers.at(-1); o.cb([{ isIntersecting, intersectionRatio: ratio, target: o.targets[0] }]); };
  function Harness({ onAct, navBelow = true, withTarget = true }) {
    const ref = React.useRef(null);
    return (
      <div>
        {withTarget && <button ref={ref} type="button" data-panel-primary="">{COPY.panel.work}</button>}
        <ExplorePinnedBar targetRef={ref} targetKey="k" label={COPY.panel.work} line="Uses 1 of your 3 investigations today · 0 used" onAct={onAct} navBelow={navBelow} left={0} />
      </div>
    );
  }
  it('one observer on the panel\'s own button; hidden while it is fully on screen, shown while it is not', async () => {
    const onAct = vi.fn();
    keep(mount(<Harness onAct={onAct} />));
    await flush();
    expect(observers).toHaveLength(1);
    expect(observers[0].targets).toEqual([$('[data-panel-primary]')]);
    const { act } = await import('react');
    act(() => fire(true, 1));
    expect($('[data-explore-pinned-bar]')).toBeNull();
    act(() => fire(true, 0.5));
    expect($('[data-explore-pinned-bar]')).not.toBeNull();
    act(() => fire(false, 0));
    const bar = $('[data-explore-pinned-bar]');
    expect(bar.textContent).toContain(COPY.panel.work);
    expect(bar.textContent).toContain('Uses 1 of your 3 investigations today · 0 used');
    const action = $('[data-explore-bar-action]');
    expect(action.tabIndex).toBe(-1);
    expect(action.getAttribute('aria-hidden')).toBeNull();
    click(action);
    expect(onAct).toHaveBeenCalledTimes(1);
    act(() => fire(true, 1));
    expect($('[data-explore-pinned-bar]')).toBeNull();
  });
  it('above the phone\'s nav: the nav band counts as off screen, and the bar sits on top of it', async () => {
    keep(mount(<Harness onAct={vi.fn()} navBelow />));
    await flush();
    // BottomNav: height 64 px and a 1 px top border, content-box (the app ships no border-box): 65 px of band
    const navSrc = zOfText('../Navigation/BottomNav.jsx');
    expect(navSrc).toMatch(/height: '64px'/);
    expect(navSrc).toMatch(/borderTop: `1px solid/);
    expect(observers[0].options.rootMargin).toBe('0px 0px -65px 0px');
    const { act } = await import('react');
    act(() => fire(false, 0));
    // jsdom's style parser reorders env(); the browser rows measure the real box
    expect($('[data-explore-pinned-bar]').style.bottom).toMatch(/^calc\(65px \+ env\(.*safe-area-inset-bottom.*\)\)$/);
    expect(Number($('[data-explore-pinned-bar]').style.zIndex)).toBe(EXPLORE_LAYERS.bar);
  });
  it('no button, no bar (and no observer)', async () => {
    keep(mount(<Harness onAct={vi.fn()} withTarget={false} />));
    await flush();
    expect(observers).toHaveLength(0);
    expect($('[data-explore-pinned-bar]')).toBeNull();
  });
  it('reduced motion: it appears at once (no starting opacity); otherwise it fades in', async () => {
    const { act } = await import('react');
    motionPrefs.reduced = true;
    const m = keep(mount(<Harness onAct={vi.fn()} />));
    await flush();
    act(() => fire(false, 0));
    expect($('[data-explore-pinned-bar]').style.opacity).not.toBe('0');
    m.unmount();
    mounted = mounted.filter((x) => x !== m);
    motionPrefs.reduced = false;
    keep(mount(<Harness onAct={vi.fn()} />));
    await flush();
    act(() => fire(false, 0));
    expect($('[data-explore-pinned-bar]').style.opacity).toBe('0');
  });
  it('on screen means fully on screen', () => {
    expect(onScreenOf({ isIntersecting: true, intersectionRatio: 1 })).toBe(true);
    expect(onScreenOf({ isIntersecting: true, intersectionRatio: 0.6 })).toBe(false);
    expect(onScreenOf({ isIntersecting: false, intersectionRatio: 0 })).toBe(false);
    expect(onScreenOf(null)).toBe(false);
  });
});

describe('the layers', () => {
  const zOf = (file, re) => Number(re.exec(readFileSync(new URL(file, import.meta.url), 'utf8'))[1]);
  it('the bar above BottomNav (50) and below the Search overlay (100); the sheet above both and below the body\'s SignalDrop modal', () => {
    const nav = zOf('../Navigation/BottomNav.jsx', /zIndex: (\d+),\s*height: '64px'/);
    const overlay = zOf('../Search/SearchOverlay.jsx', /zIndex: (\d+),\s*background: tokens\.bgApp/);
    expect(nav).toBe(50);
    expect(overlay).toBe(100);
    expect(EXPLORE_LAYERS.bar).toBeGreaterThan(nav);
    expect(EXPLORE_LAYERS.bar).toBeLessThan(overlay);
    expect(EXPLORE_LAYERS.sheet).toBeGreaterThan(overlay);
    expect(EXPLORE_LAYERS.sheet).toBeLessThan(SR_DROP_LAYER);
  });
});

describe('F-1 (the fix prompt of Nov 27) — the failed load\'s Try again never drops focus to <body>', () => {
  let opener;
  beforeEach(() => {
    opener = document.createElement('button');
    opener.textContent = 'opener';
    document.body.append(opener);
    opener.focus();
    window.scrollTo = vi.fn();
  });
  afterEach(() => { opener.remove(); });

  it.each([['lands (the body draws)', 'body'], ['fails again', 'failed']])('a retry that %s: the sheet\'s own heading holds focus while the import is out and after it answers, never scrolling', async (_, end) => {
    const body = recordingBody();
    const held = deferred();
    const load = vi.fn().mockRejectedValueOnce(new Error('chunk')).mockImplementationOnce(() => held.promise);
    const Host = createExploreSheetHost(load);
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      keep(mount(<Host entry={ENTRY} onClose={vi.fn()} opener={opener} />));
      await until(() => $('[data-explore-sheet-load-failed]'), 'the failed line');
      const h = $('[data-explore-sheet] h2');
      const link = $('[data-explore-sheet-load-failed] button');
      link.focus();
      click(link);
      await flush();
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toBe(h);
      const i = focus.mock.contexts.lastIndexOf(h);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(focus.mock.calls[i]).toEqual([{ preventScroll: true }]);
      if (end === 'body') held.resolve(body.module);
      else held.reject(new Error('again'));
      await until(() => (end === 'body' ? body.mounts.length === 1 : $('[data-explore-sheet-load-failed]')?.dataset.exploreSheetLoadFailed === ''), 'the answer');
      expect(link.isConnected).toBe(end !== 'body');
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toBe(h);
      expect(h.isConnected).toBe(true);
    } finally {
      focus.mockRestore();
      quiet.mockRestore();
    }
  });
});

// keep the unused helper import honest
void $$;
