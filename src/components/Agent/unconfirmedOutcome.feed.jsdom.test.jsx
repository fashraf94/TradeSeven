// @vitest-environment jsdom
//
// src/components/Agent/unconfirmedOutcome.feed.jsdom.test.jsx
//
// Enforce readiness (8 Oct 2026) — acceptance 2 for the Battle View's FEED
// surfaces: table G (docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md, V1.4).
// Report: docs/audits/20261008_BUILD_ENFORCE_READINESS.md §2.
//
// The beats, each exactly as api/cron/agent-evaluate.js writes it:
//   - the risk loop's (C1) and the R11 pass's (C5) exit whose executor threw
//     and whose read-back failed: `action: 'risk_swap_failed'`, `message: null`,
//     `executionOutcome: 'unknown'` (integrity follow-up 2, Part D). Before this
//     build the activity log rendered it as an `Update` card with no body;
//   - the model route's two beats on the same kind of check (C2): its own
//     status line (`action: 'hold'`) and the guardrail's (`guardrail_forced_swap`,
//     "… Forcing exit → AMD.") — words written BEFORE the swap ran; since this
//     build each carries the entry's marker (reviews ER4-3 / ERV4-1);
//   - a real failure (a line) and an ordinary exit, as controls.
// Each surface must render something true or nothing: a marked beat renders
// NOTHING — never a blank card, a raw action word (`risk_swap_failed`, `HOLD`),
// pre-execution words, "null" or "undefined".

import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../services/agentService', () => ({ addFeedBookmark: vi.fn(async () => {}), removeFeedBookmark: vi.fn(async () => {}) }));

const { default: AgentActivityFeed } = await import('./AgentActivityFeed');
const { default: GameTapeView } = await import('./GameTapeView');
const { default: LiveActivityPanel } = await import('./LiveActivityPanel');
const { default: PaneTape } = await import('../../screens/battleView/PaneTape');

const T0 = '2026-09-09T15:00:00.000Z';
const at = (min) => new Date(Date.parse(T0) + min * 60000).toISOString();

const RISK_UNKNOWN = Object.freeze({
  timestamp: at(1), message: null, pvpContext: null, action: 'risk_swap_failed', regime: null, score: 3.2,
  citedRules: ['bust_avoidance'], triggeredBy: 'risk_bust_avoidance', source: 'risk_manager', evalId: null,
  symbolOut: 'KO', symbolIn: 'AMD', executionOutcome: 'unknown',
});
const PASS_UNKNOWN = Object.freeze({
  timestamp: at(2), message: null, pvpContext: null, action: 'risk_swap_failed', regime: null, score: 3.2,
  citedRules: ['guardrail_stopLoss'], triggeredBy: 'guardrail_stopLoss', source: 'guardrail', evalId: null,
  symbolOut: 'PG', symbolIn: 'NVDA', executionOutcome: 'unknown',
});
// A copy of the risk loop's beat that dropped the marker: recognised by its shape.
const RISK_UNKNOWN_STRIPPED = Object.freeze({ timestamp: at(3), message: null, action: 'risk_swap_failed', regime: null, score: 3.2, symbolOut: 'XOM', symbolIn: 'CVX' });
const MODEL_STATUS = Object.freeze({
  timestamp: at(4), message: 'Rotating KO into AMD on the stronger tape.', action: 'hold', source: 'haiku', evalId: 'eval_044',
  symbolOut: null, symbolIn: null, citedRules: [], executionOutcome: 'unknown',
});
const GUARDRAIL_BEAT = Object.freeze({
  timestamp: at(4.5), message: 'Guardrail override: stop-loss at 1% breached on KO (-3.12%). Forcing exit → AMD.', action: 'guardrail_forced_swap',
  triggeredBy: 'guardrail_stopLoss', source: 'guardrail', evalId: 'eval_045', symbolOut: 'KO', symbolIn: 'AMD', executionOutcome: 'unknown',
});
const REAL_FAILURE = Object.freeze({
  timestamp: at(5), message: 'Risk exit of MSFT failed: quote unavailable', action: 'risk_swap_failed', source: 'risk_manager', evalId: null,
  symbolOut: 'MSFT', symbolIn: 'AAPL', citedRules: [],
});
const EXIT = Object.freeze({
  timestamp: at(6), message: 'Risk exit: KO swapped for AMD.', action: 'swap_out', source: 'risk_manager', evalId: 'risk_x_1',
  symbolOut: 'KO', symbolIn: 'AMD', citedRules: [],
});
const FEED = [RISK_UNKNOWN, PASS_UNKNOWN, RISK_UNKNOWN_STRIPPED, MODEL_STATUS, GUARDRAIL_BEAT, REAL_FAILURE, EXIT];
const MARKED = [RISK_UNKNOWN, PASS_UNKNOWN, RISK_UNKNOWN_STRIPPED, MODEL_STATUS, GUARDRAIL_BEAT];
/** The bookmark id every surface resolves a feed entry by (evalId, else id, else `${timestamp}_${index}`). */
const idOf = (entry) => entry.evalId || `${entry.timestamp}_${FEED.indexOf(entry)}`;
/** Words only a marked beat carries — none may reach a screen. */
const MARKED_WORDS = [/Rotating KO into AMD/, /Forcing exit/, /risk_swap_failed/i, /\bnull\b/, /\bundefined\b/];
const markedIn = (text) => MARKED_WORDS.filter((re) => re.test(text));

let container = null;
let root = null;
function mount(element) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(element); });
  return container;
}
afterEach(() => {
  if (root) act(() => { root.unmount(); });
  if (container) container.remove();
  root = null;
  container = null;
});
const expandAll = () => {
  for (const b of [...container.querySelectorAll('button[aria-label*="grouped evaluations"]')]) {
    act(() => { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  }
};

describe('the activity log (AgentActivityFeed — PaneTape’s log, GameTapeView’s full log)', () => {
  it('a marked beat is not a card at all — line-less, shape-only, or worded; its neighbours still render', () => {
    mount(<AgentActivityFeed statusFeed={FEED} tokens={{}} readOnly />);
    expandAll();
    const text = container.textContent;
    // The controls render: the real failure's line and the ordinary exit.
    expect(text).toContain('Risk exit of MSFT failed: quote unavailable');
    expect(text).toContain('Risk exit: KO swapped for AMD.');
    // Exactly one `Update` card: the real failure (its action has no ruled label). Base rendered
    // three more with no body (the line-less beats) and the guardrail beat under it too.
    expect(text.match(/Update/g)).toHaveLength(1);
    expect(markedIn(text)).toEqual([]);
  });

  it('only marked beats go: with them removed from the feed, the log renders the same', () => {
    mount(<AgentActivityFeed statusFeed={FEED} tokens={{}} readOnly />);
    expandAll();
    const withThem = container.textContent;
    act(() => { root.unmount(); });
    container.remove();
    mount(<AgentActivityFeed statusFeed={FEED.filter((e) => !MARKED.includes(e))} tokens={{}} readOnly />);
    expandAll();
    expect(container.textContent).toBe(withThem);
  });
});

describe('the pane’s bookmarks (PaneTape) and the Game Tape’s (GameTapeView)', () => {
  it('PaneTape: a bookmarked marked beat is no row — never `No details available` or its words beside it', () => {
    mount(<PaneTape battleId="b1" statusFeed={FEED} feedBookmarks={FEED.map(idOf)} tapeEntries={[]} />);
    const count = container.querySelector('[data-tape-bookmarks-count]').getAttribute('data-tape-bookmarks-count');
    expect(Number(count)).toBe(FEED.length - MARKED.length);
    for (const e of MARKED) expect(container.querySelector(`[data-tape-bookmark="${idOf(e)}"]`)).toBeNull();
    expect(container.textContent).not.toContain('No details available');
    expect(container.textContent).toContain('Risk exit: KO swapped for AMD.');
    expect(markedIn(container.textContent)).toEqual([]);
  });

  it('GameTapeView: no row for a marked beat; an unmarked one keeps its row exactly as before', () => {
    const marks = [...MARKED, EXIT].map(idOf);
    mount(<GameTapeView agentBattle={{ trades: [] }} agentBattleId="b1" statusFeed={FEED} feedBookmarks={marks} tokens={{}} />);
    const text = container.textContent;
    expect(text).not.toContain('No details available');
    expect(markedIn(text)).toEqual([]);
    expect(text).not.toMatch(/\bhold\b|guardrail_forced_swap/);
    // The control: the unmarked exit keeps its action header and its line.
    expect(text).toContain('swap_out');
    expect(text).toContain('Risk exit: KO swapped for AMD.');
  });
});

describe('the pulse (LiveActivityPanel — dormant under the controller layout)', () => {
  it('a marked newest beat lends the pulse no words — it keeps the neutral `Agent is active.`', () => {
    // The pulse takes the newest beat BY TIMESTAMP.
    const newestMarked = { ...MODEL_STATUS, timestamp: at(9) };
    mount(<LiveActivityPanel statusFeed={[EXIT, newestMarked]} tokens={{}} />);
    expect(container.textContent).toContain('Agent is active.');
    expect(markedIn(container.textContent)).toEqual([]);
    act(() => { root.unmount(); });
    container.remove();
    // The control: an unmarked newest beat's words are the pulse, as before.
    mount(<LiveActivityPanel statusFeed={[MODEL_STATUS, EXIT]} tokens={{}} />);
    expect(container.textContent).toContain('Risk exit: KO swapped for AMD.');
  });
});
