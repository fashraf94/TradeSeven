// @vitest-environment jsdom
//
// Battle Research Slice 1 — the surface (BRS-2, BRS-5, BRS-13, BRS-16, BRS-20, §7) with the real store and
// a fake evidence read: the proposal and the four starters (What's moving off until one usable quote),
// a question to the board, a refinement and its banner, Undo, the reference line, opening a row, the Ask
// draft, Escape (the surface's own and, suspended under the modal, the modal's), focus in and back, the
// phone's bottom bar and history sheet, every tap ≥ 44 px and labelled no message cost.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../../../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('../../../firebase/authService', () => ({ getIdToken: async () => 'token-1' }));
vi.mock('framer-motion', async () => {
  const ReactMod = await import('react');
  const skip = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'layout']);
  const make = (tag) => ReactMod.forwardRef(function M(props, ref) { const d = {}; for (const [k, v] of Object.entries(props)) if (!skip.has(k)) d[k] = v; return ReactMod.createElement(tag, { ...d, ref }); });
  const cache = {};
  return { motion: new Proxy({}, { get: (_, t) => { cache[t] ??= make(String(t)); return cache[t]; } }), AnimatePresence: ({ children }) => children, useReducedMotion: () => false };
});

import useBattleResearch from './useBattleResearch.js';
import BattleResearchSurface from './BattleResearchSurface.jsx';
import { researchBattle, rankingsDoc, quotesBody, TAKEN_AT } from './__fixtures__/researchFixtures.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const MIN = 60_000;
let BATTLE;
let WIDE; // seven placed names on the weakest question (AMD, CRM, ADBE added to the agent watchlist)
const extraRow = (symbol, technicalRank) => ({ symbol, technicalRank, technicalScore: 90, sectorName: 'Technology', sectorTechnicalRank: 1, sectorTechnicalTotal: 21, techRaw: { atrPercent: 2 }, arch_scores: { momentum_chaser: 80 } });
const WIDE_DOC = () => ({ ...rankingsDoc(), stocks: [...rankingsDoc().stocks, extraRow('AMD', 20), extraRow('CRM', 55), extraRow('ADBE', 95)] });
beforeAll(async () => {
  BATTLE = await researchBattle();
  WIDE = await researchBattle();
  WIDE.watchlist = { ...WIDE.watchlist, hotBench: ['PLTR', 'MSFT', 'AMD', 'CRM', 'ADBE'] };
});

let container; let root; let calls; let fetches; let deferred;
const out = {};
const renders = { n: 0 };
const defer = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const bundle = (quotes = quotesBody(), doc = rankingsDoc()) => ({ quotesBody: { ...quotes, servedAt: TAKEN_AT }, rankingsDoc: doc, takenAt: TAKEN_AT, receivedAt: TAKEN_AT });

function Harness({ isDesktop = false, suspended = false, battle = BATTLE, quotes = null, doc = null, clock = null, answer = null, bottomInset, battleId = 'stock-battle' }) {
  renders.n += 1;
  const store = useBattleResearch({
    battleId, battle, agent: { agentName: 'shadow', archetype: 'momentum_chaser' },
    fetcher: async () => { fetches += 1; if (deferred) await deferred.promise; return answer ? answer() : bundle(quotes ?? quotesBody(), doc ?? rankingsDoc()); },
    clock: clock ?? (() => TAKEN_AT),
  });
  out.store = store;
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" data-this-turn-research="1" onClick={() => setOpen(true)}><span>Research</span></button>
      {open ? (
        <BattleResearchSurface
          open store={store} battle={battle} agentName="Shadow" voice="Shadow · Trend Follower"
          standing={{ you: '+70', them: '+60', opponent: 'CPU' }} isDesktop={isDesktop}
          onClose={() => { calls.push('close'); setOpen(false); }}
          onOpenRow={(s) => calls.push(`row:${s}`)}
          onAskAbout={(d) => calls.push({ ask: d.text })}
          suspended={suspended}
          onSuspendedEscape={() => calls.push('suspendedEscape')}
          restoreFocus={() => document.querySelector('[data-this-turn-research]')}
          {...(bottomInset !== undefined ? { bottomInset } : {})}
        />
      ) : null}
    </>
  );
}

const settle = async () => { for (let i = 0; i < 8; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const mount = async (props = {}) => {
  await act(async () => { root.render(<Harness {...props} />); });
  await settle();
};
// A fresh mount: a new store (the harness's own), as a reload would give.
const remount = async (props = {}) => {
  act(() => root.unmount());
  root = createRoot(container);
  await mount(props);
};
const q = (sel) => container.querySelector(sel);
const click = async (el) => { expect(el).toBeTruthy(); await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await settle(); };
const key = async (el, k) => { await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }); await settle(); };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(TAKEN_AT));
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); calls = []; fetches = 0; deferred = null;
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); });

describe('the opening (BRS-5)', () => {
  it('the agent proposes, the honesty line, the four starters (≥ 44 px), the top strip with the voice and the score pair', async () => {
    await mount();
    expect(q('[data-br-proposal="weakest"]').textContent).toContain('EQIX is our weakest holding at the 12:45 check, −0.4 rungs from entry.');
    expect(q('[data-br-proposal]').textContent).toContain('Shadow proposes');
    expect(q('[data-br-honesty]').textContent).toBe('A ranking doesn’t predict how the battle ends.');
    const starters = [...container.querySelectorAll('[data-br-starter]')];
    expect(starters.map((b) => b.getAttribute('data-br-starter'))).toEqual(['weakest_alternatives', 'rank_bench', 'rank_agent_watchlist', 'moving_today']);
    for (const b of starters) expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(q('[data-br-voice]').textContent).toBe('Shadow · Trend Follower');
    expect(q('[data-br-standing]').textContent).toBe('You +70 · CPU +60');
    expect(container.textContent).toContain('no message cost');
    expect(fetches).toBe(1); // the opening's one evidence read
  });
  it('the "as they stand" list (collapsed) holds the union by technical rank', async () => {
    await mount();
    expect(q('[data-br-as-they-stand-toggle] span').textContent).toBe('Your bench and watchlist as they stand · 4 names by technical rank');
  });
  it('What\'s moving is off until one usable quote has arrived — with the calendar\'s line', async () => {
    const weekend = { ...quotesBody(), quotes: Object.fromEntries(Object.entries(quotesBody().quotes).map(([k, v]) => [k, { ...v, sessionEtDate: '2026-10-13' }])) };
    await mount({ quotes: weekend });
    expect(q('[data-br-starter="moving_today"]').getAttribute('aria-disabled')).toBe('true');
    expect(q('[data-br-starter="moving_today"] [data-br-starter-line]').textContent).toBe('Waiting for today’s quotes');
    await remount();
    expect(q('[data-br-starter="moving_today"]').getAttribute('aria-disabled')).toBeNull();
  });
  it('no weakest: the weakest starter is off and says why (awaiting the first check)', async () => {
    const fresh = JSON.parse(JSON.stringify(BATTLE));
    fresh.scoring.stockRewardContexts.agent = {};
    await mount({ battle: fresh });
    expect(q('[data-br-starter="weakest_alternatives"]').getAttribute('aria-disabled')).toBe('true');
    expect(q('[data-br-starter="weakest_alternatives"] [data-br-starter-line]').textContent).toMatch(/^Our holdings are ranked at the next check/);
  });
});

describe('the board (§7)', () => {
  it('a question: the title names the holding, the note line, the reference line, the rows with their times, the caveat and the Ask', async () => {
    await mount({ isDesktop: true });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    expect(q('[data-br-title]').textContent).toBe('Compare alternatives to EQIX');
    expect(q('[data-br-note]').textContent).toBe('Bench and agent watchlist · 6 names · Ranks as of 1:01 PM ET · moves as of 1:42–1:44 PM ET');
    expect(q('[data-br-reference="EQIX"]').textContent).toContain('reference, not ranked');
    expect(q('[data-br-row="PLTR"] [data-br-row-facts]').textContent).toBe('Rank 5 of 228 · 1:01 PM ET · +0.3% · 1:43 PM · Estimated rung size ≈4.1% · ATR reading · 1:01 PM ET · Technology');
    expect(q('[data-br-caveat]').textContent).toContain('“Can come in now” means it can be picked now.');
    expect(q('[data-br-ask-about]').textContent).toContain('1 msg when sent');
    expect(q('[data-br-explain]').textContent).toContain('Keeping EQIX is a fair answer.');
  });
  it('a refinement: the banner says what changed and that nothing was refreshed; Undo goes back; nothing is read', async () => {
    await mount({ isDesktop: true });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    const reads = fetches;
    await click(q('[data-br-condition="eligible_now"]'));
    expect(q('[data-br-banner="refinement"]').textContent).toContain('Readings are the same 1:45 PM result. Nothing was refreshed.');
    expect(q('[data-br-then]').textContent).toBe('then: only names that can come in now');
    expect(q('[data-br-row="MSFT"] [data-br-was]')).toBeTruthy();
    await click(q('[data-br-undo]'));
    expect(q('[data-br-then]')).toBeNull();
    expect(fetches).toBe(reads);
  });
  it('a row opens the research modal through the screen\'s door', async () => {
    await mount({ isDesktop: true });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    await click(q('[data-br-row="PLTR"]'));
    expect(calls).toContain('row:PLTR');
  });
  it('Ask {Agent} about this result hands the screen the draft (nothing is sent here)', async () => {
    await mount({ isDesktop: true });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    await click(q('[data-br-ask-about]'));
    expect(calls.find((c) => c.ask)?.ask).toMatch(/^Research: "Compare alternatives to EQIX" \(result 1:45 PM ET\)/);
  });
  it('every board button is a tap target of at least 44 px', async () => {
    await mount({ isDesktop: false });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    const small = [...q('[data-br-board]').querySelectorAll('button')].filter((b) => parseInt(b.style.minHeight, 10) < 44);
    expect(small.map((b) => b.outerHTML.slice(0, 80))).toEqual([]);
  });
});

describe('focus and Escape (§7)', () => {
  it('focus goes into the surface; Escape closes it and focus returns to the Research pill', async () => {
    const pill = document.createElement('button');
    pill.setAttribute('data-this-turn-research', '1');
    document.body.appendChild(pill);
    pill.focus();
    await mount({ isDesktop: true });
    expect(q('[data-br-surface]').contains(document.activeElement)).toBe(true);
    await key(document.activeElement, 'Escape');
    expect(calls).toContain('close');
    expect(document.activeElement).toBe(pill);
    pill.remove();
  });
  it('focus returns to the pill even when the tap that opened the surface focused nothing (iOS Safari never focuses a tapped button)', async () => {
    document.activeElement?.blur?.();
    expect(document.activeElement).toBe(document.body);
    await mount({ isDesktop: false });
    expect(q('[data-br-surface]').contains(document.activeElement)).toBe(true);
    await key(document.activeElement, 'Escape');
    expect(calls).toContain('close');
    expect(document.activeElement).toBe(q('[data-this-turn-research]'));
  });
  it('suspended under the research modal: inert, and Escape closes ONLY the modal (the surface stays)', async () => {
    await mount({ isDesktop: true, suspended: true });
    expect(q('[data-br-layer]').hasAttribute('inert')).toBe(true);
    await key(document.body, 'Escape');
    expect(calls).toEqual(['suspendedEscape']);
    expect(q('[data-br-surface]')).toBeTruthy();
  });
});

describe('the phone (BRS-16)', () => {
  it('the explanation\'s first paragraph in the bottom bar, Read more · history opens the sheet; Escape closes the sheet first', async () => {
    await mount({ isDesktop: false });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    expect(q('[data-br-lead-bar]').textContent).toContain('Shadow · Trend Follower:');
    // Measured at 390 and 320 in Edge: the clamped two lines drew 39 px — the button holds 44 (§11).
    expect(parseInt(q('[data-br-lead]').style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(q('[data-br-agent-column]')).toBeNull();
    await click(q('[data-br-read-more]'));
    expect(q('[data-br-history-sheet] [data-br-agent-column]')).toBeTruthy();
    await key(q('[data-br-surface]'), 'Escape');
    expect(q('[data-br-history-sheet]')).toBeNull();
    expect(calls).not.toContain('close');
  });
});

// ── The review round on PR B (lenses 1 and 4): each row failed before the round's fix ──
// The placed rows only (the reference line carries data-br-row too).
const rowsOnBoard = () => [...container.querySelectorAll('[data-br-board] [data-br-list] [data-br-row]')].filter((r) => !r.closest('[data-br-reference]') && !r.hasAttribute('data-br-reference')).map((r) => r.getAttribute('data-br-row'));
const scrollBy = async (el, top) => { await act(async () => { el.scrollTop = top; el.dispatchEvent(new Event('scroll')); }); };

describe('review BL4-3 — scrolling re-renders nothing outside the surface', () => {
  it('30 scroll events, no render of the screen that owns the store', async () => {
    await mount({ isDesktop: false });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    const before = renders.n;
    for (let i = 1; i <= 30; i += 1) await scrollBy(q('[data-br-scroll]'), i * 10);
    expect(renders.n - before).toBe(0);
  });
});

describe('review BL4-2 / BL1-6 — Show all is kept per step, like the scroll', () => {
  it('across a close and the pill', async () => {
    await mount({ isDesktop: false, battle: WIDE, doc: WIDE_DOC() });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    expect(rowsOnBoard()).toHaveLength(5);
    await click(q('[data-br-show-all]'));
    expect(rowsOnBoard()).toHaveLength(7);
    await click(q('[data-br-close]'));
    await click(q('[data-this-turn-research]'));
    expect(rowsOnBoard()).toHaveLength(7);
  });
  it('across a step taken and undone (Use across → Undo from the modal returns to the same step)', async () => {
    await mount({ isDesktop: false, battle: WIDE, doc: WIDE_DOC() });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    await click(q('[data-br-show-all]'));
    await act(async () => { out.store.applyAcross('eligible_now'); });
    await settle();
    await act(async () => { out.store.undo(); });
    await settle();
    expect(rowsOnBoard()).toHaveLength(7);
  });
});

describe('review BL1-7 — the opening\'s one-minute reuse is the client\'s minute', () => {
  it('a server clock 5 minutes ahead never stretches it: reopened 61 s later, the opening reads again', async () => {
    await mount({ isDesktop: true, clock: () => Date.now(), answer: () => ({ ...bundle(), takenAt: TAKEN_AT + 5 * MIN, receivedAt: Date.now() }) });
    expect(fetches).toBe(1);
    await click(q('[data-br-close]'));
    vi.setSystemTime(new Date(TAKEN_AT + 61_000));
    await click(q('[data-this-turn-research]'));
    expect(fetches).toBe(2);
  });
});

describe('review BL1-2 — a row never opens while a Refresh is in flight', () => {
  it('the tap waits: no research modal can stand over a result that is about to change', async () => {
    await mount({ isDesktop: true, clock: () => Date.now() });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    vi.setSystemTime(new Date(TAKEN_AT + 61_000));
    deferred = defer();
    await act(async () => { out.store.refresh(); });
    await click(q('[data-br-row="PLTR"]'));
    expect(calls).not.toContain('row:PLTR');
    await act(async () => { deferred.resolve(); });
    await settle();
    deferred = null;
    await click(q('[data-br-row="PLTR"]'));
    expect(calls).toContain('row:PLTR');
  });
});

describe('review BL4-7 — the history sheet is a layer: focus in, the rest inert, focus back', () => {
  it('opens with focus inside, aria-modal, the board behind inert; closing returns focus to Read more', async () => {
    await mount({ isDesktop: false });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    await click(q('[data-br-read-more]'));
    const dialog = q('[data-br-history-sheet] [role="dialog"]');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(q('[data-br-scroll]').hasAttribute('inert')).toBe(true);
    expect(q('[data-br-lead-bar]').hasAttribute('inert')).toBe(true);
    expect(q('[data-br-top]').hasAttribute('inert')).toBe(true);
    await click(q('[data-br-sheet-close]'));
    expect(document.activeElement).toBe(q('[data-br-read-more]'));
    expect(q('[data-br-scroll]').hasAttribute('inert')).toBe(false);
  });
});

describe('review BL4-8 / BL4-11 — the "as they stand" list is a button that says it expands, and its hidden rows are not in the trap', () => {
  it('collapsed: no rows in the DOM, aria-expanded false; a Tab on the toggle (the last stop) wraps; expanded: the rows', async () => {
    await mount({ isDesktop: true });
    const toggle = q('[data-br-as-they-stand-toggle]');
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(q('[data-br-as-they-stand] [data-br-row]')).toBeNull();
    toggle.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act(async () => { toggle.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
    await click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(q('[data-br-as-they-stand] [data-br-row="PLTR"]')).toBeTruthy();
  });
});

describe('review BL4-12 / BL4-4 / BL4-9 — the phone layer: no scroll chaining, above the iOS toolbar, a top strip that wraps', () => {
  it('the scroll boxes contain their overscroll', async () => {
    await mount({ isDesktop: false });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    expect(q('[data-br-scroll]').style.overscrollBehavior).toBe('contain');
    await click(q('[data-br-read-more]'));
    expect(q('[data-br-history-sheet] [role="dialog"]').style.overscrollBehavior).toBe('contain');
  });
  it('the bottom bar and the history sheet pad the browser toolbar (the bench sheet\'s viewportInset)', async () => {
    await mount({ isDesktop: false, bottomInset: 34 });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    // jsdom (like a browser) folds the sum: calc(12px + 34px) reads calc(46px).
    expect(['calc(12px + 34px)', 'calc(46px)']).toContain(q('[data-br-lead-bar]').style.paddingBottom);
    await click(q('[data-br-read-more]'));
    expect(['calc(20px + 34px)', 'calc(54px)']).toContain(q('[data-br-history-sheet] [role="dialog"]').style.paddingBottom);
  });
  it('the top strip wraps rather than squeezing the title under a long score pair', async () => {
    await mount({ isDesktop: false });
    expect(q('[data-br-top-main]').style.flexWrap).toBe('wrap');
  });
});

describe('review BL1-5 — the surface open on the proposal across a change of battle reads the new battle\'s opening', () => {
  it('a second opening read, for the new battle', async () => {
    await mount({ isDesktop: true });
    expect(fetches).toBe(1);
    await act(async () => { root.render(<Harness isDesktop battleId="another-battle" />); });
    await settle();
    expect(fetches).toBe(2);
    expect(q('[data-br-as-they-stand-toggle]').textContent).not.toMatch(/loading|Loading/);
  });
});

describe('review BL2-3 — one clock: the board says a lock has passed when it passes, as the modal does', () => {
  it('a lock lapsing while the board stands turns to "since passed" without a step (after the Refresh countdown has stopped)', async () => {
    const soon = JSON.parse(JSON.stringify(BATTLE));
    soon.portfolio.bench.stocks = soon.portfolio.bench.stocks.map((x) => (x.symbol === 'NVDA' ? { ...x, cooldownUntil: new Date(TAKEN_AT + 62_000).toISOString() } : x));
    await mount({ isDesktop: true, battle: soon, clock: () => Date.now() });
    await click(q('[data-br-starter="rank_bench"]'));
    // A bounded wait for a condition (real time; only Date is faked) — never a fixed sleep a loaded runner can miss.
    const waitFor = async (cond, ms) => {
      const end = performance.now() + ms;
      while (!cond() && performance.now() < end) await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    };
    // Past the Refresh minute: the countdown's tick stops, so only the lock's own timer can turn the clock.
    vi.setSystemTime(new Date(TAKEN_AT + 61_000));
    await waitFor(() => !/Refresh in/.test(q('[data-br-refresh]').textContent), 8000);
    expect(q('[data-br-refresh]').textContent).not.toMatch(/Refresh in/);
    expect(q('[data-br-row="NVDA"]').textContent).not.toContain('since passed');
    vi.setSystemTime(new Date(TAKEN_AT + 63_000));
    await waitFor(() => q('[data-br-row="NVDA"]').textContent.includes('since passed'), 8000);
    expect(q('[data-br-row="NVDA"]').textContent).toContain('since passed');
  }, 25_000);
});

describe('review BL2-12 — the phone bar speaks in the same voice as the strip', () => {
  it('"{Agent} · {Archetype}:" before the explanation', async () => {
    await mount({ isDesktop: false });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    expect(q('[data-br-lead-bar] b').textContent).toBe('Shadow · Trend Follower: ');
  });
});

// ── The refuter's round on PR B's fixes (RB-1 – RB-6): each row failed before its fix ──
const FOCUSABLE_IN = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
describe('refuter RB-1 — Tab stays inside the history sheet (the inert board behind it is no stop)', () => {
  it('Shift+Tab on its first stop wraps to its last, Tab on its last wraps to its first', async () => {
    await mount({ isDesktop: false });
    await click(q('[data-br-starter="weakest_alternatives"]'));
    await click(q('[data-br-read-more]'));
    const dialog = q('[data-br-history-sheet] [role="dialog"]');
    const stops = [...dialog.querySelectorAll(FOCUSABLE_IN)];
    expect(stops.length).toBeGreaterThan(1);
    stops[0].focus();
    const back = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    await act(async () => { stops[0].dispatchEvent(back); });
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(stops.at(-1));
    const fwd = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act(async () => { stops.at(-1).dispatchEvent(fwd); });
    expect(fwd.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(stops[0]);
  });
});

describe('refuter RB-5 — the opening\'s list turns a lapsed lock to "since passed" too', () => {
  it('the opening arms the same lapse timer', async () => {
    const soon = JSON.parse(JSON.stringify(BATTLE));
    soon.portfolio.bench.stocks = soon.portfolio.bench.stocks.map((x) => (x.symbol === 'NVDA' ? { ...x, cooldownUntil: new Date(TAKEN_AT + 1000).toISOString() } : x));
    await mount({ isDesktop: true, battle: soon, clock: () => Date.now() });
    await click(q('[data-br-as-they-stand-toggle]'));
    const nvda = () => q('[data-br-as-they-stand] [data-br-row="NVDA"]').textContent;
    expect(nvda()).not.toContain('since passed');
    vi.setSystemTime(new Date(TAKEN_AT + 2000));
    const end = performance.now() + 6000;
    while (!nvda().includes('since passed') && performance.now() < end) await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    expect(nvda()).toContain('since passed');
  }, 15_000);
});
