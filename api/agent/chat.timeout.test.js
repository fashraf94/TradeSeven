// api/agent/chat.timeout.test.js
//
// The turn timing budget, pinned. Added Sep 3 2026 (voice-timeout incident).
//
// These numbers are a SYSTEM, not independent settings: the model call must
// finish inside the turn deadline, the deadline must still leave room for the
// directive gate's repair AND the awaited Firestore writes, and all of it must
// fit inside the platform's maxDuration.
// Moving one without the others either strands budget (the incident: a 15s
// timeout inside a 24s deadline cut Gemma off with ~9s unused) or overruns the
// function — which is worse, because a platform kill is a bare gateway 504 with
// no shadow log and no honest client string.
//
// Imported from the handler, never re-declared here: a test that restates a
// constant guards nothing.

import { describe, it, expect } from 'vitest';
import { config, GEMMA_TIMEOUT_MS, TURN_DEADLINE_MS } from './chat.js';

const MAX_DURATION_MS = config.maxDuration * 1000;

// The two figures the budget invariant depends on, declared once so the rows
// below cannot drift apart.
//   MIN_REPAIR_MS — directiveGate.js: below this much remaining, the Phase E1
//   repair is skipped outright.
//   HANDLER_OVERHEAD_ALLOWANCE_MS — the design allowance for everything before
//   the voice call: auth (verifyIdToken, a network round trip) plus 4 sequential
//   Firestore round trips, 6 on the League ask path.
const MIN_REPAIR_MS = 1_500;
const HANDLER_OVERHEAD_ALLOWANCE_MS = 3_000;

describe('agent/chat — turn timing budget', () => {
  it('pins the three values', () => {
    expect(config.maxDuration).toBe(30);
    expect(GEMMA_TIMEOUT_MS).toBe(19_000);
    expect(TURN_DEADLINE_MS).toBe(24_000);
  });

  it('the voice call must be able to finish inside the turn deadline', () => {
    // Strict: at equality the call could consume the whole deadline and leave
    // the directive gate and the writes with nothing.
    expect(GEMMA_TIMEOUT_MS).toBeLessThan(TURN_DEADLINE_MS);
  });

  it('the turn deadline leaves at least 5s inside maxDuration for the awaited writes', () => {
    // chat.js stamps turnStartMs at invocation and hands the gate
    // turnStartMs + TURN_DEADLINE_MS; everything after the gate — the battle-doc
    // update and the budget charge — is awaited and must fit in what is left.
    expect(MAX_DURATION_MS - TURN_DEADLINE_MS).toBeGreaterThanOrEqual(5_000);
  });

  it('rejects the 25s the sibling Gemma callers use', () => {
    // forge/workshop-chat, forge/watchlist-analysis, screener/chat,
    // forge/watchlist-dialogue and forge/expand-signal all use 25s, and all of
    // them have exactly ONE model call. This handler has a second (the Phase E1
    // directive gate) behind the same deadline, so 25s here would let the first
    // call alone outlive TURN_DEADLINE_MS. The divergence is deliberate; this row
    // is what stops a future "make it consistent with the siblings" edit.
    expect(GEMMA_TIMEOUT_MS).not.toBe(25_000);
    expect(GEMMA_TIMEOUT_MS + 1_000).toBeLessThanOrEqual(TURN_DEADLINE_MS);
  });

  it('the whole turn fits: overhead + voice call + a directive-gate repair <= the deadline', () => {
    // THE budget invariant, and the row that would have caught the 20s raise.
    // directiveGate.js skips the repair outright when less than MIN_REPAIR_MS
    // remains to the deadline, so all three have to fit at once:
    //
    //   overhead (3.0s) + GEMMA_TIMEOUT_MS + MIN_REPAIR_MS (1.5s) <= 24.0s
    //
    //   at 15s  →  19.5s   held
    //   at 20s  →  24.5s   OVER by 500ms — the repair was silently un-budgeted
    //                      on any turn with a slow first call, so hasDirective
    //                      could flip true→false on identical model output
    //                      purely from timing, failing silently as a canned
    //                      no-change line
    //   at 19s  →  23.5s   held, with 500ms to spare
    //
    // This is the row that makes the three constants a system rather than three
    // settings: it fails on any future raise that forgets the second model call.
    expect(HANDLER_OVERHEAD_ALLOWANCE_MS + GEMMA_TIMEOUT_MS + MIN_REPAIR_MS)
      .toBeLessThanOrEqual(TURN_DEADLINE_MS);
  });

  it('the repair window the 19s cap leaves is real, not nominal', () => {
    // The repair survives while
    //   prologue + firstCallLatency <= TURN_DEADLINE_MS - MIN_REPAIR_MS.
    // Overhead tolerated after a worst-case first call: 7.6s at 15s, 2.6s at
    // 20s (below the 3.0s design allowance — the defect), 3.5s at 19s.
    const latestFirstCallCompletion = TURN_DEADLINE_MS - MIN_REPAIR_MS;
    expect(latestFirstCallCompletion).toBe(22_500);
    const overheadTolerated = latestFirstCallCompletion - GEMMA_TIMEOUT_MS;
    expect(overheadTolerated).toBe(3_500);
    // The point of the ruling: the tolerated overhead must clear the allowance
    // the handler is actually designed around, not merely be positive.
    expect(overheadTolerated).toBeGreaterThanOrEqual(HANDLER_OVERHEAD_ALLOWANCE_MS);
  });
});
