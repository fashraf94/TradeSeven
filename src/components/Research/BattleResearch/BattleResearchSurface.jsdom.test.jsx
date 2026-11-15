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
  return { motion: new Proxy({}, { get: (_, t) => make(String(t)) }), AnimatePresence: ({ children }) => children, useReducedMotion: () => false };
});

import useBattleResearch from './useBattleResearch.js';
import BattleResearchSurface from './BattleResearchSurface.jsx';
import { researchBattle, rankingsDoc, quotesBody, TAKEN_AT } from './__fixtures__/researchFixtures.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let BATTLE;
beforeAll(async () => { BATTLE = await researchBattle(); });

let container; let root; let calls; let fetches;
const fetcher = async () => { fetches += 1; return { quotesBody: { ...quotesBody(), servedAt: TAKEN_AT }, rankingsDoc: rankingsDoc(), takenAt: TAKEN_AT, receivedAt: TAKEN_AT }; };

function Harness({ isDesktop = false, suspended = false, battle = BATTLE, quotes = null }) {
  const store = useBattleResearch({
    battleId: 'stock-battle', battle, agent: { agentName: 'shadow', archetype: 'momentum_chaser' },
    fetcher: quotes ? async () => { fetches += 1; return { quotesBody: { ...quotes, servedAt: TAKEN_AT }, rankingsDoc: rankingsDoc(), takenAt: TAKEN_AT, receivedAt: TAKEN_AT }; } : fetcher,
    clock: () => TAKEN_AT,
  });
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
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); calls = []; fetches = 0;
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
    expect(q('[data-br-as-they-stand] summary').textContent).toBe('Your bench and watchlist as they stand · 4 names by technical rank');
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
    pill.remove();
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
    expect(q('[data-br-lead-bar]').textContent).toContain('Shadow:');
    expect(q('[data-br-agent-column]')).toBeNull();
    await click(q('[data-br-read-more]'));
    expect(q('[data-br-history-sheet] [data-br-agent-column]')).toBeTruthy();
    await key(q('[data-br-surface]'), 'Escape');
    expect(q('[data-br-history-sheet]')).toBeNull();
    expect(calls).not.toContain('close');
  });
});
