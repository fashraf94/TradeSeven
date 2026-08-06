// api/agent/reflect.claimConsolidation.test.js
//
// Ruling 1 — the consolidation milestone-claim that prevents the double-fire the
// RECORD redirect makes reachable (a casual settlement + a ranked reflection both
// landing on the same %5 gamesPlayed milestone on the shared parent counter).
//
// FLAG-OFF BEHAVIORAL EQUIVALENCE (the design distinction, founder-ruled): the
// requirement is provable flag-off behavioral equivalence, NOT literal
// byte-identity. When CASUAL_CLONE_CONCURRENCY_ENABLED is off, the trigger never
// calls claimConsolidationMilestone (wonMilestone = true unconditionally), so the
// agent doc NEVER gains a `lastConsolidatedGamesPlayed` field and the consolidation
// path is exactly the pre-ruling code — a guard inert when no casual clone can
// exist. This battery proves the claim's idempotency directly (the guarded path).

import { describe, it, expect } from 'vitest';
import { claimConsolidationMilestone } from './reflect.js';

// Minimal transactional mock: one agent doc, runTransaction with get/update.
function makeDb(initial = {}) {
  const store = { data: { ...initial } };
  const agentRef = { path: 'agents/parent-1' };
  const db = {
    runTransaction: async (fn) => fn({
      get: async () => ({ exists: true, data: () => ({ ...store.data }) }),
      update: (_ref, patch) => { store.data = { ...store.data, ...patch }; },
    }),
  };
  return { db, agentRef, store };
}

describe('claimConsolidationMilestone (ruling 1 — milestone idempotency)', () => {
  it('the FIRST claim at a milestone wins and stamps the marker', async () => {
    const { db, agentRef, store } = makeDb({ stats: { gamesPlayed: 5 } });
    const won = await claimConsolidationMilestone(db, agentRef, 5);
    expect(won).toBe(true);
    expect(store.data.lastConsolidatedGamesPlayed).toBe(5);
  });

  it('a DUPLICATE claim at the SAME milestone loses (prevents the double-fire)', async () => {
    const { db, agentRef, store } = makeDb({ stats: { gamesPlayed: 5 }, lastConsolidatedGamesPlayed: 5 });
    const won = await claimConsolidationMilestone(db, agentRef, 5);
    expect(won).toBe(false);                       // second reflection at gamesPlayed=5 skips
    expect(store.data.lastConsolidatedGamesPlayed).toBe(5); // unchanged
  });

  it('two reflections at the same milestone → exactly ONE consolidates (the double-fire scenario)', async () => {
    // Shared parent counter at a %5 milestone; a casual settlement + a ranked
    // reflection both reach the gate reading gamesPlayed = 5.
    const { db, agentRef } = makeDb({ stats: { gamesPlayed: 5 } });
    const first = await claimConsolidationMilestone(db, agentRef, 5);  // ranked reflection
    const second = await claimConsolidationMilestone(db, agentRef, 5); // casual forward
    expect([first, second]).toEqual([true, false]); // exactly one winner
  });

  it('a NEW milestone (gamesPlayed advanced) claims again', async () => {
    const { db, agentRef, store } = makeDb({ stats: { gamesPlayed: 10 }, lastConsolidatedGamesPlayed: 5 });
    const won = await claimConsolidationMilestone(db, agentRef, 10);
    expect(won).toBe(true);
    expect(store.data.lastConsolidatedGamesPlayed).toBe(10);
  });
});
