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
//   - the model route's own status beat on the same kind of check (C2): its
//     words, `action: 'hold'`, and — since this build — the entry's marker;
//   - a real failure (a line) and an ordinary exit, as controls.
// Each surface must render something true or nothing: never a blank card, a
// raw action word (`risk_swap_failed`, `HOLD`), "null" or "undefined".

import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../services/agentService', () => ({ addFeedBookmark: vi.fn(async () => {}), removeFeedBookmark: vi.fn(async () => {}) }));

const { default: AgentActivityFeed } = await import('./AgentActivityFeed');
const { default: GameTapeView } = await import('./GameTapeView');
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
// The public projection's copy of the risk loop's beat: the marker is stripped
// (api/_utils/tournamentBattleView.js PUBLIC_STATUSFEED), the shape is not.
const RISK_UNKNOWN_PUBLIC = Object.freeze({ timestamp: at(3), message: null, action: 'risk_swap_failed', regime: null, score: 3.2, symbolOut: 'XOM', symbolIn: 'CVX' });
const MODEL_STATUS = Object.freeze({
  timestamp: at(4), message: 'Rotating KO into AMD on the stronger tape.', action: 'hold', source: 'haiku', evalId: 'eval_044',
  symbolOut: null, symbolIn: null, citedRules: [], executionOutcome: 'unknown',
});
const REAL_FAILURE = Object.freeze({
  timestamp: at(5), message: 'Risk exit of MSFT failed: quote unavailable', action: 'risk_swap_failed', source: 'risk_manager', evalId: null,
  symbolOut: 'MSFT', symbolIn: 'AAPL', citedRules: [],
});
const EXIT = Object.freeze({
  timestamp: at(6), message: 'Risk exit: KO swapped for AMD.', action: 'swap_out', source: 'risk_manager', evalId: 'risk_x_1',
  symbolOut: 'KO', symbolIn: 'AMD', citedRules: [],
});
const FEED = [RISK_UNKNOWN, PASS_UNKNOWN, RISK_UNKNOWN_PUBLIC, MODEL_STATUS, REAL_FAILURE, EXIT];
const LINELESS = [RISK_UNKNOWN, PASS_UNKNOWN, RISK_UNKNOWN_PUBLIC];
/** The bookmark id every surface resolves a feed entry by (evalId, else id, else `${timestamp}_${index}`). */
const idOf = (entry) => entry.evalId || `${entry.timestamp}_${FEED.indexOf(entry)}`;

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
const FALSE = [/risk_swap_failed/i, /\bnull\b/, /\bundefined\b/];
const falseIn = (text) => FALSE.filter((re) => re.test(text));

describe('the activity log (AgentActivityFeed — PaneTape’s log, GameTapeView’s full log)', () => {
  it('a beat with no line of its own is not a card at all — owner shape and public shape; its neighbours still render', () => {
    mount(<AgentActivityFeed statusFeed={FEED} tokens={{}} readOnly />);
    expandAll();
    const text = container.textContent;
    // The controls render: the real failure's line, the ordinary exit, the model's own words.
    expect(text).toContain('Risk exit of MSFT failed: quote unavailable');
    expect(text).toContain('Risk exit: KO swapped for AMD.');
    expect(text).toContain('Rotating KO into AMD on the stronger tape.');
    // Exactly one `Update` card: the real failure (its action has no ruled label). Base rendered three
    // more — one per line-less beat — each with no body.
    expect(text.match(/Update/g)).toHaveLength(1);
    expect(falseIn(text)).toEqual([]);
  });

  it('only line-less beats go: with the three removed from the feed, the log renders the same', () => {
    mount(<AgentActivityFeed statusFeed={FEED} tokens={{}} readOnly />);
    expandAll();
    const withThem = container.textContent;
    act(() => { root.unmount(); });
    container.remove();
    mount(<AgentActivityFeed statusFeed={FEED.filter((e) => !LINELESS.includes(e))} tokens={{}} readOnly />);
    expandAll();
    expect(container.textContent).toBe(withThem);
  });
});

describe('the pane’s bookmarks (PaneTape) and the Game Tape’s (GameTapeView)', () => {
  it('PaneTape: a bookmarked line-less beat is no row — never `No details available` beside it', () => {
    mount(<PaneTape battleId="b1" statusFeed={FEED} feedBookmarks={FEED.map(idOf)} tapeEntries={[]} />);
    const count = container.querySelector('[data-tape-bookmarks-count]').getAttribute('data-tape-bookmarks-count');
    expect(Number(count)).toBe(FEED.length - LINELESS.length);
    for (const e of LINELESS) expect(container.querySelector(`[data-tape-bookmark="${idOf(e)}"]`)).toBeNull();
    expect(container.textContent).not.toContain('No details available');
    expect(container.textContent).toContain('Rotating KO into AMD on the stronger tape.');
    expect(falseIn(container.textContent)).toEqual([]);
  });

  it('GameTapeView: no row for a line-less beat, and a marked beat with words never heads itself with its action', () => {
    // (The real failure is left unbookmarked here: this row's own header prints any
    // unmarked beat's raw action, `risk_swap_failed` included — true of that beat, and
    // unchanged by this build.)
    const marks = [...LINELESS, MODEL_STATUS, EXIT].map(idOf);
    mount(<GameTapeView agentBattle={{ trades: [] }} agentBattleId="b1" statusFeed={FEED} feedBookmarks={marks} tokens={{}} />);
    const text = container.textContent;
    expect(text).not.toContain('No details available');
    expect(falseIn(text)).toEqual([]);
    // The model's status beat is still bookmarked — its words, under the neutral header, not `hold`.
    expect(text).toContain('Rotating KO into AMD on the stronger tape.');
    expect(text).not.toMatch(/\bhold\b/);
    // A control: an unmarked beat keeps its action header exactly as before.
    expect(text).toContain('swap_out');
  });
});
