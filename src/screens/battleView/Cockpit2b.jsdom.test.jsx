// @vitest-environment jsdom
//
// src/screens/battleView/Cockpit2b.jsdom.test.jsx
//
// Cockpit Build 2b — THE V5 SCREEN, MOUNTED (spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md §5, §6, §11 "Client"). Driven by the REAL
// model (buildCockpitFeed with v2, cockpit2bModel) over record fixtures, and
// the REAL answer flow (useCockpit2bAnswer) over a fake submit: the meter at
// 7/1/0, the Now card's sentences and §6.2 buttons, the step before and after
// Confirm exit, "Exit instead" with a name, with "Let Shadow choose" and
// Cancel, the replace confirmation for a cockpit command and from a 409, the
// strip's expand and Spotlight, the day line, Earlier collapsed.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Cockpit2b, { COCKPIT2B_TOP_ROW_PX } from './Cockpit2b';
import { buildCockpitFeed, monitoringRow } from './cockpitModel';
import { liveCommandOf } from './cockpit2bModel';
import { useCockpit2bAnswer } from './useCockpit2bAnswer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const T = (iso) => Date.parse(iso);
/** Wed Oct 21 2026, 1:20 PM ET. */
const NOW = T('2026-10-21T17:20:00.000Z');
const CLOSE = T('2026-10-21T20:00:00.000Z');
const at = (hhmmEt) => { const [h, m] = hhmmEt.split(':').map(Number); return T(`2026-10-21T${String(h + 4).padStart(2, '0')}:${String(m).padStart(2, '0')}:20.000Z`); };
const iso = (ms) => new Date(ms).toISOString();
const EVALS = [{ evalId: 'eval_020', promptBuiltAt: iso(at('12:00')), evidence: { VLO: { px: 161.22 }, AMD: { px: 158.1 }, ZS: { px: 301.5 } } }];

let seq = 0;
const call = (over = {}) => {
  seq += 1;
  const minted = over.mintedAt ?? at('12:00') + 40_000;
  return {
    callId: `b:eval_020:call:${String(seq).padStart(3, '0')}`, kind: 'confirmation', battleId: 'b', evalId: 'eval_020', evalSeq: 20, mintedAt: minted, mintedMode: 'on',
    symbol: 'VLO', direction: 'exit', heldAtMint: false, slot: 'core', counterpart: null, counterpartRaw: null,
    condition: { side: 'below', level: 158.4 }, horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' },
    defaultAction: 'act', said: 'x', saidOk: true, evidence: { tickId: null, availability: 'off', priceAsOf: iso(minted - 40_000) },
    state: 'open', stateChangedAt: minted, stateSource: 'mint', playerResponse: null, directiveThreadId: null, outcome: null,
    replacementOptions: [{ symbol: 'MPC', source: 'agent' }, { symbol: 'XOM', source: 'bench' }, { symbol: 'PSX', source: 'bench' }],
    invalidatedReason: null,
    ...over,
  };
};
const minted = (hhmm) => ({ mintedAt: at(hhmm) + 40_000, evidence: { tickId: null, availability: 'off', priceAsOf: iso(at(hhmm)) } });
const entryAct = (over = {}) => call({ kind: 'called_shot', symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 163.5 }, replacementOptions: null, ...over });
const holdShot = (over = {}) => call({ kind: 'called_shot', symbol: 'ZS', slot: 'star', defaultAction: 'hold', condition: { side: 'below', level: 290 }, ...over });
const BATTLE = Object.freeze({
  directive: null,
  portfolio: {
    star: [{ symbol: 'ZS' }], core: [{ symbol: 'VLO' }, { symbol: 'KO' }], support: [{ symbol: 'AMD' }],
    bench: { stocks: [{ symbol: 'XOM' }, { symbol: 'PSX', cooldownUntil: iso(CLOSE) }] },
  },
  watchlist: { hotBench: ['MPC'] },
});
/** A live cockpit command on `c` (the slot the endpoint writes). */
const commandOn = (c, text = 'Hold ZS through today\'s close.') => {
  const thread = `th-${c.callId}`;
  c.playerResponse = { answer: 'hold', kind: 'directive', directiveThreadId: thread, callId: c.callId, filedAt: iso(at('13:05')), heardEvalId: null };
  c.directiveThreadId = thread;
  return { family: 'call', text, expiry: 'until_ms', expiresAtMs: CLOSE, directiveThreadId: thread, callId: c.callId, kind: 'call_hold', action: { direction: c.direction, symbol: c.symbol, slot: c.slot } };
};
const cockpitFilings = (n) => Array.from({ length: n }, (_, i) => ({ source: 'cockpit', hasDirective: true, directiveThreadId: `x${i}` }));

function Harness({ calls, battle = BATTLE, rawExchanges = [], submit, onOpenSheet = () => {}, onOpenBench = () => {}, phone = false, agent = 'Shadow', monitoring = null }) {
  const live = liveCommandOf({ directive: battle?.directive ?? null, nowMs: NOW });
  const flow = useCockpit2bAnswer({ submit, live, calls });
  const feed = buildCockpitFeed({ calls, events: [], evaluations: EVALS, directive: battle?.directive ?? null, nowMs: NOW, v2: true, exchanges: rawExchanges, nextDecisionAt: iso(at('13:30')) });
  return (
    <Cockpit2b
      feed={feed}
      records={{ calls, events: [], rawExchanges, battle, evaluations: EVALS }}
      agent={agent}
      monitoring={monitoring}
      nowMs={NOW}
      phone={phone}
      vintage="Prices as of the 12:00 PM check · next ~1:30 PM"
      nextDecisionAt={iso(at('13:30'))}
      flow={flow}
      onOpenSheet={onOpenSheet}
      onOpenBench={onOpenBench}
    />
  );
}

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
const render = (props) => act(() => { root.render(<Harness {...props} />); });
const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }); };
const q = (sel) => container.querySelector(sel);
const qa = (sel) => [...container.querySelectorAll(sel)];
const ok = () => vi.fn(async () => ({ status: 200, body: {} }));

describe('§5.1 the commands meter', () => {
  it('seven dots, filled = left, "· {n} left", the aria label — at 7, 1 and 0', () => {
    for (const [used, left, text] of [[0, 7, '· 7 left'], [6, 1, '· 1 left'], [7, 0, 'No commands left']]) {
      render({ calls: [entryAct()], rawExchanges: cockpitFilings(used), submit: ok() });
      const meter = q('[data-cockpit-meter]');
      expect(meter.getAttribute('data-cockpit-meter')).toBe(String(left));
      expect(meter.getAttribute('aria-label')).toBe(`${left} of 7 commands left`);
      expect(qa('[data-cockpit-meter-dot="left"]')).toHaveLength(left);
      expect(qa('[data-cockpit-meter-dot]')).toHaveLength(7);
      expect(meter.textContent).toBe(text);
    }
  });
});

describe('§5.2 the Now card and §6.2 its buttons', () => {
  it('the plan, the silence line and the facts line; agreeing free, the override one bullet with "· 1 command"', () => {
    render({ calls: [entryAct()], submit: ok() });
    const now = q('[data-cockpit-now]');
    expect(now.querySelector('[data-cockpit-plan]').textContent).toBe('Shadow plans to bring in AMD for KO if it goes above $163.50 by today\'s close. If you say nothing, it brings it in.');
    expect(now.querySelector('[data-cockpit-facts-line]').textContent).toBe('by today\'s close · AMD $158.10 · as of the 12:00 PM check');
    const [agree, override] = qa('[data-cockpit-now] [data-cockpit-answer]');
    expect(agree.textContent).toBe('Go if it triggers');
    expect(agree.querySelector('[data-cockpit-bullet]')).toBeNull();
    expect(override.textContent).toBe('Hold off');
    expect(override.querySelector('[data-cockpit-bullet]')).not.toBeNull();
    expect(override.getAttribute('aria-label')).toBe('Hold off · 1 command');
  });

  it('a tap sends the answer through the flow — no optimistic state', async () => {
    const submit = ok();
    render({ calls: [entryAct()], submit });
    await click(q('[data-cockpit-now] [data-cockpit-answer="hold"]'));
    expect(submit).toHaveBeenCalledWith(expect.any(String), 'hold', { pickSymbol: null, confirmReplace: false });
  });

  it('nothing qualifies → the quiet line', () => {
    render({ calls: [], submit: ok() });
    expect(q('[data-cockpit-quiet]').textContent).toBe('Nothing needs you · Shadow\'s next check ~1:30 PM');
  });
});

describe('§5.3 Who comes in? — before and after Confirm exit (V5-6)', () => {
  it('on the card: the groups, a chip files replace with the name; locked chips wait', async () => {
    const submit = ok();
    const vlo = call();
    render({ calls: [vlo], submit });
    expect(q('[data-cockpit-step="on_card"]')).not.toBeNull();
    expect(qa('[data-cockpit-step-group]').map((g) => g.getAttribute('data-cockpit-step-group'))).toEqual(['agent', 'bench']);
    const psx = q('[data-cockpit-option="PSX"]');
    expect(psx.getAttribute('aria-disabled')).toBe('true');
    expect(psx.textContent).toContain('locked');
    await click(psx);
    expect(submit).not.toHaveBeenCalled();
    await click(q('[data-cockpit-option="XOM"]'));
    expect(submit).toHaveBeenCalledWith(vlo.callId, 'replace', { pickSymbol: 'XOM', confirmReplace: false });
  });

  it('after Confirm exit the card is held as the Now card with its step and Done; Done releases it', async () => {
    const submit = ok();
    const vlo = call();
    const amd = entryAct({ ...minted('12:45') });
    render({ calls: [vlo, amd], submit });
    await click(q('[data-cockpit-now] [data-cockpit-answer="go"]'));
    expect(submit).toHaveBeenCalledWith(vlo.callId, 'go', { pickSymbol: null, confirmReplace: false });
    // The listener delivers the acknowledgment.
    vlo.playerResponse = { answer: 'go', kind: 'ack', callId: vlo.callId, filedAt: iso(at('13:06')) };
    render({ calls: [{ ...vlo }, amd], submit });
    expect(q('[data-cockpit-now]').getAttribute('data-cockpit-now')).toBe(vlo.callId);
    expect(q('[data-cockpit-step="on_card"]')).not.toBeNull();
    await click(q('[data-cockpit-step-done]'));
    expect(q('[data-cockpit-now]').getAttribute('data-cockpit-now')).toBe(amd.callId);
  });

  it('"Exit instead" (exit + hold, no counterpart) opens the step before filing; a name files go_now with it; Cancel closes', async () => {
    const submit = ok();
    const zs = holdShot();
    render({ calls: [zs], submit });
    expect(q('[data-cockpit-step]')).toBeNull();
    await click(q('[data-cockpit-answer="go_now"]'));
    expect(submit).not.toHaveBeenCalled();
    expect(q('[data-cockpit-step="after_exit_instead"]')).not.toBeNull();
    expect(q('[data-cockpit-answer]')).toBeNull(); // the step stands in place of the buttons
    await click(q('[data-cockpit-step-cancel]'));
    expect(q('[data-cockpit-step]')).toBeNull();
    await click(q('[data-cockpit-answer="go_now"]'));
    await click(q('[data-cockpit-option="XOM"]'));
    expect(submit).toHaveBeenLastCalledWith(zs.callId, 'go_now', { pickSymbol: 'XOM', confirmReplace: false });
  });

  it('"Let Shadow choose" files go_now with no name', async () => {
    const submit = ok();
    const zs = holdShot();
    render({ calls: [zs], submit });
    await click(q('[data-cockpit-answer="go_now"]'));
    expect(q('[data-cockpit-let-choose]').textContent).toBe('Let Shadow choose');
    await click(q('[data-cockpit-let-choose]'));
    expect(submit).toHaveBeenCalledWith(zs.callId, 'go_now', { pickSymbol: null, confirmReplace: false });
  });

  it('"Browse the bench →" asks the screen to open the sheet, scoped to the call and its step', async () => {
    const onOpenBench = vi.fn();
    const vlo = call();
    render({ calls: [vlo], submit: ok(), onOpenBench });
    await click(q('[data-cockpit-browse]'));
    expect(onOpenBench).toHaveBeenCalledWith({ callId: vlo.callId, step: 'on_card', cardKey: vlo.callId });
  });
});

describe('§6.3 the replace confirmation', () => {
  it('an override while a cockpit command is live on ANOTHER call asks first; Keep sends nothing; Replace sends confirmReplace', async () => {
    const submit = ok();
    const zs = holdShot({ ...minted('11:30') });
    const directive = commandOn(zs);
    const amd = entryAct();
    render({ calls: [zs, amd], battle: { ...BATTLE, directive }, submit });
    await click(q('[data-cockpit-now] [data-cockpit-answer="hold"]'));
    expect(submit).not.toHaveBeenCalled();
    expect(q('[data-cockpit-replace-confirm]').textContent).toContain('This replaces your command on ZS — "Hold ZS through today\'s close.". Shadow stops hearing it at its next check.');
    await click(q('[data-cockpit-keep]'));
    expect(q('[data-cockpit-replace-confirm]')).toBeNull();
    expect(submit).not.toHaveBeenCalled();
    await click(q('[data-cockpit-now] [data-cockpit-answer="hold"]'));
    await click(q('[data-cockpit-replace]'));
    expect(submit).toHaveBeenCalledWith(amd.callId, 'hold', { pickSymbol: null, confirmReplace: true });
  });

  it('agreeing never asks — an acknowledgment touches no command', async () => {
    const submit = ok();
    const zs = holdShot({ ...minted('11:30') });
    const directive = commandOn(zs);
    const amd = entryAct();
    render({ calls: [zs, amd], battle: { ...BATTLE, directive }, submit });
    await click(q('[data-cockpit-now] [data-cockpit-answer="go"]'));
    expect(submit).toHaveBeenCalledWith(amd.callId, 'go', { pickSymbol: null, confirmReplace: false });
    expect(q('[data-cockpit-replace-confirm]')).toBeNull();
  });

  it('a 409 replace_unconfirmed (a chat directive) opens the same prompt from currentText', async () => {
    const submit = vi.fn(async () => ({ status: 409, body: { error: 'refused', reason: 'replace_unconfirmed', currentDirectiveThreadId: 't1', currentText: 'Sell AMD at the open', currentCallId: null } }));
    render({ calls: [entryAct()], submit });
    await click(q('[data-cockpit-now] [data-cockpit-answer="hold"]'));
    expect(q('[data-cockpit-replace-confirm]').textContent).toContain('This replaces your chat instruction — "Sell AMD at the open". Shadow stops hearing it at its next check.');
  });
});

describe('§5.4 Also live, §5.5 the day line, §5.6 Earlier', () => {
  it('review L7 C20 — a spotlight dropped as stale stays dropped when its card later comes back as a new ask', async () => {
    const vlo = call();
    const zs = holdShot({ ...minted('12:45') });
    render({ calls: [vlo, zs], submit: ok() });
    await click(q(`[data-cockpit-chip="${zs.callId}"]`));
    await click(q(`[data-cockpit-spotlight="${zs.callId}"]`));
    expect(q('[data-cockpit-now]').getAttribute('data-cockpit-now')).toBe(zs.callId);
    // ZS answered by a command that has since left the slot: the card no longer needs you.
    const answered = { ...zs, playerResponse: { answer: 'go_now', kind: 'directive', directiveThreadId: 'th-gone', callId: zs.callId, filedAt: iso(at('13:05')), heardEvalId: null }, directiveThreadId: 'th-gone' };
    render({ calls: [vlo, answered], submit: ok() });
    expect(q('[data-cockpit-now]').getAttribute('data-cockpit-now')).toBe(vlo.callId);
    // Restated outside the answer's coverage ($295 vs $290): a new ask on the SAME card key — the old spotlight is gone.
    const restated = holdShot({ ...minted('13:15'), condition: { side: 'below', level: 295 } });
    render({ calls: [vlo, answered, restated], submit: ok() });
    expect(q('[data-cockpit-now]').getAttribute('data-cockpit-now')).toBe(vlo.callId);
  });

  it('review L7 C21 — the opened step is keyed by the CALL it opened on: on a two-call card it stays open', async () => {
    const first = holdShot({ ...minted('12:00') });
    const second = holdShot({ ...minted('12:45') });
    render({ calls: [first, second], submit: ok() });
    expect(q('[data-cockpit-now]').getAttribute('data-cockpit-now')).toBe(first.callId); // the card's key: its oldest call
    await click(q('[data-cockpit-answer="go_now"]'));
    expect(q('[data-cockpit-step="after_exit_instead"]')).not.toBeNull();
  });

  it('a chip expands in place to the card; "Spotlight →" makes it the Now card', async () => {
    const vlo = call();
    const amd = entryAct({ ...minted('12:45') });
    render({ calls: [vlo, amd], submit: ok() });
    expect(q('[data-cockpit-now]').getAttribute('data-cockpit-now')).toBe(vlo.callId);
    const chip = q(`[data-cockpit-chip="${amd.callId}"]`);
    expect(chip.textContent).toBe('AMD↑163.50 · enter');
    await click(chip);
    expect(q('[data-cockpit-chip-expanded]')).not.toBeNull();
    await click(q(`[data-cockpit-spotlight="${amd.callId}"]`));
    expect(q('[data-cockpit-now]').getAttribute('data-cockpit-now')).toBe(amd.callId);
  });

  it('the day line counts the records; Earlier is collapsed with its count and opens on tap', async () => {
    const done = holdShot({ state: 'expired_unresolved', stateChangedAt: at('13:00') });
    render({ calls: [entryAct(), done], submit: ok() });
    expect(q('[data-cockpit-day-line]').textContent).toBe('Today · 2 calls · 0 hit · 1 expired · you answered 0');
    expect(q('[data-cockpit-earlier-row]')).toBeNull();
    const toggle = q('[data-cockpit-earlier-toggle]');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toContain('1');
    await click(toggle);
    expect(q('[data-cockpit-earlier-row]').textContent).toBe('ZS ↓ 290 · Expired · by today\'s close');
  });
});

// ---------------------------------------------------------------------------
// The review's fix round (CB4-4, CB4-8, CB5-2, CB5-3).
describe('review fixes — the V5 screen', () => {
  const focusOn = (el) => act(() => { el.focus(); });
  const active = () => document.activeElement;

  it('CB5-2: focus never falls to <body> — chip expand/collapse, Exit instead, Cancel, Spotlight', async () => {
    const vlo = call();
    const zs = holdShot({ ...minted('12:45'), replacementOptions: [{ symbol: 'XOM', source: 'bench' }] });
    render({ calls: [vlo, zs], submit: ok() });
    const chip = q(`[data-cockpit-chip="${zs.callId}"]`);
    focusOn(chip);
    await click(chip);
    expect(active().getAttribute('data-cockpit-chip-toggle')).toBe('1');
    expect(active().getAttribute('aria-expanded')).toBe('true');
    await click(active()); // collapse
    expect(active().getAttribute('data-cockpit-chip')).toBe(zs.callId);
    await click(active()); // expand again
    await click(q(`[data-cockpit-card="${zs.callId}"] [data-cockpit-answer="go_now"]`)); // Exit instead → the step
    expect(q(`[data-cockpit-card="${zs.callId}"] [data-cockpit-step]`).contains(active())).toBe(true);
    await click(q(`[data-cockpit-card="${zs.callId}"] [data-cockpit-step-cancel]`));
    expect(active().getAttribute('data-cockpit-answer')).toBe('go_now');
    await click(q(`[data-cockpit-spotlight="${zs.callId}"]`));
    expect(active().getAttribute('data-cockpit-tile-open')).toBe('1');
    expect(q('[data-cockpit-now]').contains(active())).toBe(true);
    expect(active()).not.toBe(document.body);
  });

  it('CB5-2 / CB4-4: the confirmation takes focus on Replace; Keep returns it to the pressed control; in flight both wait', async () => {
    let release;
    const submit = vi.fn(() => new Promise((r) => { release = r; }));
    const zs = holdShot({ ...minted('11:30') });
    const directive = commandOn(zs);
    const amd = entryAct();
    render({ calls: [zs, amd], battle: { ...BATTLE, directive }, submit });
    await click(q('[data-cockpit-now] [data-cockpit-answer="hold"]'));
    expect(active().getAttribute('data-cockpit-replace')).toBe('1');
    await click(q('[data-cockpit-keep]'));
    expect(active().getAttribute('data-cockpit-answer')).toBe('hold');
    await click(q('[data-cockpit-now] [data-cockpit-answer="hold"]'));
    await click(q('[data-cockpit-replace]'));
    expect(submit).toHaveBeenCalledWith(amd.callId, 'hold', { pickSymbol: null, confirmReplace: true });
    // The flow's own submit is in flight; the screen passes `pending` — here the harness does not, so assert the component contract directly.
    await act(async () => { release({ status: 200, body: {} }); });
  });

  it('CB4-4: ReplaceConfirm in flight reads "Sending…" and both buttons wait', async () => {
    const { ReplaceConfirm } = await import('./Cockpit2b');
    const onReplace = vi.fn();
    const onKeep = vi.fn();
    act(() => { root.render(<ReplaceConfirm line="This replaces your command on ZS — &quot;x&quot;." sending onReplace={onReplace} onKeep={onKeep} />); });
    expect(q('[data-cockpit-replace]').textContent).toBe('Sending…');
    expect(q('[data-cockpit-replace]').getAttribute('aria-disabled')).toBe('true');
    expect(q('[data-cockpit-keep]').getAttribute('aria-disabled')).toBe('true');
    await click(q('[data-cockpit-keep]'));
    await click(q('[data-cockpit-replace]'));
    expect(onKeep).not.toHaveBeenCalled();
    expect(onReplace).not.toHaveBeenCalled();
  });

  it('CB4-8: Earlier shows ten, then "Show all · {n}", which asks the screen', async () => {
    const onShowAllEarlier = vi.fn();
    const done = Array.from({ length: 12 }, (_, i) => holdShot({ symbol: `D${i}`, state: 'expired_unresolved', stateChangedAt: at('13:00') + i }));
    const feed = buildCockpitFeed({ calls: done, events: [], evaluations: EVALS, directive: null, nowMs: NOW, v2: true });
    act(() => { root.render(<Cockpit2b feed={feed} records={{ calls: done }} agent="Shadow" nowMs={NOW} flow={{ request: vi.fn(), confirm: null, heldKey: null }} onShowAllEarlier={onShowAllEarlier} />); });
    await click(q('[data-cockpit-earlier-toggle]'));
    expect(qa('[data-cockpit-earlier-row]')).toHaveLength(10);
    expect(q('[data-cockpit-show-all]').textContent).toBe('Show all · 12');
    await click(q('[data-cockpit-show-all]'));
    expect(onShowAllEarlier).toHaveBeenCalled();
  });

  it('CB5-3: the expanded chip cannot grow past the strip (min-width 0, border-box at 100%)', async () => {
    const vlo = call();
    const amd = entryAct({ ...minted('12:45') });
    render({ calls: [vlo, amd], submit: ok() });
    await click(q(`[data-cockpit-chip="${amd.callId}"]`));
    const s = q('[data-cockpit-chip-expanded]').style;
    expect([s.minWidth, s.maxWidth, s.boxSizing]).toEqual(['0px', '100%', 'border-box']);
  });
});

describe('before review: the pinned top row, and the agent\'s name', () => {
  it('the top row (vintage + meter) pins at the top of the scroll, above the NOW and Monitoring headers, which pin just below it — desktop and phone', () => {
    for (const phone of [false, true]) {
      render({ calls: [call(), entryAct({ ...minted('12:45') })], submit: ok(), phone, monitoring: monitoringRow({ symbols: ['JPM'], evalId: 'eval_020' }, EVALS) });
      const top = q('[data-cockpit-top-row]');
      expect(q('[data-cockpit-feed="2b"]').firstElementChild).toBe(top);
      expect(top.contains(q('[data-cockpit-meter]'))).toBe(true);
      expect([top.style.position, top.style.top, top.style.height, top.style.boxSizing]).toEqual(['sticky', '0px', `${COCKPIT2B_TOP_ROW_PX}px`, 'border-box']);
      expect(top.style.background).not.toBe(''); // the scrolled cards do not show through it
      for (const key of ['now', 'monitoring']) {
        const h = q(`[data-cockpit-group="${key}"]`);
        expect([h.style.position, h.style.top], key).toEqual(['sticky', `${COCKPIT2B_TOP_ROW_PX}px`]);
        expect(Number(top.style.zIndex), key).toBeGreaterThan(Number(h.style.zIndex));
      }
    }
  });

  it('a name stored lowercase renders with its first letter capitalized', () => {
    render({ calls: [call()], submit: ok(), agent: 'shadow' });
    expect(container.textContent).toContain('Shadow plans to exit VLO');
    expect(container.textContent).toContain('From Shadow\'s lists');
    expect(container.textContent).not.toMatch(/\bshadow\b/);
  });
});
