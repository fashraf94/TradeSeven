// @vitest-environment jsdom
//
// src/components/Agent/AgentChat.fitMismatch.jsdom.test.jsx
//
// E-1 — a `fit_mismatch` turn, mounted.
//
// The gate's new deliberate null (directiveGate.js) is a null-write like every
// other: `hasDirective: false`, `directive: null`, and an `archetypeGate`
// record whose status happens to read `fit_mismatch`. The point of this file is
// that the CLIENT needs no knowledge of the new status to render it correctly —
// the no-change line comes from the persisted exchange's shape (§6.3:
// grounded + the gate ran + no directive), not from a status string the client
// would have to learn. A client that special-cased statuses would have shipped
// a blank turn on the day this flag flips.
//
// SCOPE, STATED HONESTLY (§2 review findings D4 / D6). `groundingVersion` is
// stamped by chat.js ONLY when the grounded prompt was sent, so the fixture
// below — a fit_mismatch WITH the grounding marker — is producible only when
// VOICE_GROUNDING_MODE is at 'canary'/'on' AND this flag is lit. That pairing
// is the D-3 hazard the build says must never be lit together.
//
// So the four positive rows describe the turn as it will look AFTER the
// grounding walk closes D-3 — worth pinning, because that is where this
// mechanism is headed and the client must already be right for it — while the
// UNGROUNDED row at the bottom is the shape TODAY's sanctioned flip actually
// produces, and the answer there is that nothing renders. Both are real; only
// the second is reachable under the flip the build recommends.
//
// The fixture is otherwise exactly what api/agent/chat.js writes, including the
// three always-on forensics keys, which an earlier draft omitted while claiming
// production fidelity.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: { getIdToken: async () => 'token-1' } })),
}));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('../../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
vi.mock('./LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

import AgentChat from './AgentChat';
import { NO_CHANGE_STATUS_LINE } from '../../data/decisionRecord';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
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
  vi.unstubAllGlobals();
});

const BASE = {
  battleId: 'ab-1', agentId: 'agent-1', agentName: 'Vega',
  chatExchanges: [], battleStatus: 'active', statusFeed: [], trades: [],
  knownTickers: new Set(), chatBudgetUsed: 2,
};
const render = (props = {}) => act(() => { root.render(<AgentChat {...BASE} {...props} />); });

const SP05 = 'Spread across more names (diversify the chaos)';

// The Sep 14 turn as chat.js would persist it once the flag is on: the reply
// the model wrote, no directive, and the gate record carrying the refusal.
const FIT_MISMATCH_EXCHANGE = {
  userMessage: 'Swap Core for Support (Full Defense)',
  agentResponse: "that's the lean I'm carrying now — trading Core momentum for a heavy Support floor",
  scratchpad: null,
  hasDirective: false,
  directive: null,
  directiveThreadId: null,
  suggestedActions: null,
  elicitationTarget: 'risk_appetite',
  timestamp: '2026-09-14T15:05:00.000Z',
  mode: 'battle',
  archetypeGate: {
    classification: 'in_archetype',
    selectedAdjustmentId: 'SP-05',
    status: 'fit_mismatch',
    repairUsed: false,
    // Always-on (commit D). Present on every gate record chat.js writes, so a
    // fixture claiming production fidelity must carry them even though no
    // client surface reads them.
    originalUserAsk: 'Swap Core for Support (Full Defense)',
    counterOfferText: null,
    rejectionReason: null,
    fitCheck: { expected: SP05, quoted: false },
  },
  groundingVersion: 1,
};

describe('E-1 — a fit_mismatch exchange, mounted (GROUNDED: the post-D-3 shape)', () => {
  it('renders the code-owned no-change line', () => {
    render({ chatExchanges: [FIT_MISMATCH_EXCHANGE] });
    expect(container.querySelector('[data-directive-status="no_change"]')?.textContent)
      .toBe(NO_CHANGE_STATUS_LINE);
  });

  it('renders NO Filed receipt and no directive card', () => {
    render({ chatExchanges: [FIT_MISMATCH_EXCHANGE] });
    expect(container.textContent).not.toContain('Filed');
    // The sentence that was NOT filed must not appear anywhere on screen —
    // rendering `fitCheck.expected` would put the un-filed directive on the
    // card, which is the incident with extra steps.
    expect(container.textContent).not.toContain(SP05);
  });

  it('still renders the character\'s own words (the reply is never stripped)', () => {
    render({ chatExchanges: [FIT_MISMATCH_EXCHANGE] });
    expect(container.textContent).toContain('trading Core momentum for a heavy Support floor');
  });

  it('the This-turn strip stays quiet: nothing on this exchange claims a directive', () => {
    // The strip renders the BATTLE SLOT's directive, and a fit_mismatch turn
    // writes no slot. Asserted at the source the strip reads: the exchange
    // carries no directive, no thread id, and hasDirective false.
    expect(FIT_MISMATCH_EXCHANGE.hasDirective).toBe(false);
    expect(FIT_MISMATCH_EXCHANGE.directive).toBeNull();
    expect(FIT_MISMATCH_EXCHANGE.directiveThreadId).toBeNull();
    render({ chatExchanges: [FIT_MISMATCH_EXCHANGE] });
    expect(container.querySelector('[data-directive-status="committed"]')).toBeNull();
  });

  it('MUTATION CHECK — the same turn WITH a directive renders the card and no no-change line', () => {
    // If this row rendered identically, the rows above would be asserting
    // nothing about the fit_mismatch shape in particular.
    render({
      chatExchanges: [{
        ...FIT_MISMATCH_EXCHANGE,
        hasDirective: true,
        directive: { text: SP05, expiry: 'end_of_battle', directiveThreadId: 't-1', adjustmentId: 'SP-05', canonicalTextVersion: 1 },
        directiveThreadId: 't-1',
        archetypeGate: { classification: 'in_archetype', selectedAdjustmentId: 'SP-05', status: 'committed', repairUsed: false },
      }],
    });
    expect(container.querySelector('[data-directive-status="no_change"]')).toBeNull();
    expect(container.textContent).toContain(SP05);
  });

  it('THE SHAPE TODAY\'S FLIP PRODUCES: an ungrounded fit_mismatch renders no status line', () => {
    // This is the row that covers the sanctioned flip (fit check alone, at
    // VOICE_GROUNDING_MODE 'shadow'), and its answer is that the player sees
    // NOTHING — no card, and no "no change" line either, because §6.3 gates
    // that line on the grounding marker. The server still writes null and the
    // record still holds the refusal; only the on-screen honesty is missing.
    // Pre-existing §6.3 design, not introduced here, and stated at the gate
    // (directiveGate.js) rather than left to be discovered.
    const { groundingVersion, ...ungrounded } = FIT_MISMATCH_EXCHANGE;
    expect(groundingVersion).toBe(1);
    render({ chatExchanges: [ungrounded] });
    expect(container.querySelector('[data-directive-status]')).toBeNull();
    expect(container.textContent).not.toContain(SP05);
  });
});
