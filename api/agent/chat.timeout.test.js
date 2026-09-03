// api/agent/chat.timeout.test.js
//
// The turn timing budget, pinned. Added Sep 3 2026 (voice-timeout incident).
//
// These three numbers are a SYSTEM, not three independent settings: the model
// call must finish inside the turn deadline, and the turn deadline must leave
// room for the awaited Firestore writes inside the platform's maxDuration.
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

describe('agent/chat — turn timing budget', () => {
  it('pins the three values', () => {
    expect(config.maxDuration).toBe(30);
    expect(GEMMA_TIMEOUT_MS).toBe(20_000);
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

  it('leaves the handler its own pre-call overhead inside the deadline', () => {
    // Before the voice call the handler does auth (verifyIdToken, a network
    // round trip) plus five sequential Firestore reads and one parallel batch.
    // Budgeting ~3s for that, the first call must still land inside the deadline.
    const HANDLER_OVERHEAD_ALLOWANCE_MS = 3_000;
    expect(HANDLER_OVERHEAD_ALLOWANCE_MS + GEMMA_TIMEOUT_MS).toBeLessThanOrEqual(TURN_DEADLINE_MS);
  });
});
