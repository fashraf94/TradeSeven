// api/cron/agent-batch-review.reviewPending.test.js
//
// P-6 — debrief liveness (Pass 1 spec §3, PASS1_PHASE0_STOP_RULINGS_AND_GO §2).
//
// THE DEFECT. This cron fires at 20:25 and 21:25 UTC and, before this pass,
// only ever selected ACTIVE battles (findActiveAgentBattles). completeBattle
// can land around 20:00 UTC, so a fullday battle that expired just before the
// first run was already 'completed' when the query ran — and was never
// reviewed at all. The Dashboard's POST_CLOSE card would then show "debrief
// pending" forever. A pending card without this fix is a prettier way to
// display a broken pipeline, which is why the framework calls P-6 a LIVENESS
// prerequisite rather than a UI one.
//
// THE FIX. completeBattle stamps `reviewPending: true`; this cron drains it
// with a second, additive, single-field query and clears the flag in the same
// write that appends the review.
//
// WHY NOT REUSE pendingReflection. It sits in the very same completion payload
// and looks free, but it is a live work queue: process-pending-reflections
// runs every 15 minutes across 12 hours and clears it (:87-90), so it would
// almost always be false by the time this cron looked. It also carries a
// schema-presence invariant (agent-evaluate.js:4142 — the `undefined`
// discriminator at :4172 / :4510 depends on every cron completion writing it).
// Two consumers racing to clear one flag is a bug waiting for a slow night.
//
// WHY NOT A completedAt WINDOW. `status == 'completed' AND completedAt >= X`
// is served by none of the six agentBattles composite indexes, so it would
// need a schema deploy this pass does not budget. A single-field equality is
// auto-indexed.
//
// WHY NOT CHANGE findActiveAgentBattles. It lives in
// api/_utils/agentBattleService.js, which is §1-fenced (docs/BUILD_RULES.md:19).
// Widening it there would be fence contact; this query is local to the handler.
//
// This is the first test this 411-line handler has ever had, and it
// deliberately covers only the new predicate — retroactive coverage of the
// other 400 lines is not this pass's scope (ledgered in the rulings §10).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findReviewPendingBattles, REVIEW_PENDING_LIMIT } from './agent-batch-review.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const readSource = (f) => readFileSync(path.join(HERE, f), 'utf8');

/**
 * Slice a block starting at `from` and ending at the FIRST `to` that follows
 * it. Both marker strings occur more than once in these 4000-line handlers —
 * an earlier draft anchored on a bare indexOf and silently sliced an empty
 * string, which passed nothing and would have failed open.
 */
function blockAfter(source, from, to) {
  const start = source.indexOf(from);
  expect(start, `marker not found: ${from}`).toBeGreaterThan(-1);
  const end = source.indexOf(to, start);
  expect(end, `terminator not found after ${from}: ${to}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

/** Minimal Firestore-admin query-chain double that records what was asked for. */
function fakeDb(docs) {
  const calls = { collection: null, where: [], limit: null };
  const snapshot = {
    docs: docs.map((d) => ({ id: d.id, data: () => { const { id, ...rest } = d; return rest; } })),
  };
  const chain = {
    where: (field, op, value) => { calls.where.push([field, op, value]); return chain; },
    limit: (n) => { calls.limit = n; return chain; },
    get: async () => snapshot,
  };
  return {
    calls,
    db: { collection: (name) => { calls.collection = name; return chain; } },
  };
}

describe('findReviewPendingBattles — the predicate', () => {
  it('queries agentBattles on reviewPending == true', async () => {
    const { db, calls } = fakeDb([]);
    await findReviewPendingBattles(db);
    expect(calls.collection).toBe('agentBattles');
    expect(calls.where).toEqual([['reviewPending', '==', true]]);
  });

  it('is a SINGLE-field equality — no composite index required', async () => {
    const { db, calls } = fakeDb([]);
    await findReviewPendingBattles(db);
    // A second where() would make this a composite query, and none of the six
    // existing agentBattles indexes serves one on these fields.
    expect(calls.where).toHaveLength(1);
  });

  it('is bounded per run — a backlog drains across runs', async () => {
    const { db, calls } = fakeDb([]);
    await findReviewPendingBattles(db);
    expect(calls.limit).toBe(REVIEW_PENDING_LIMIT);
    expect(REVIEW_PENDING_LIMIT).toBeGreaterThan(0);
  });

  it('returns {id, ...data}, the shape processBattleReview expects', async () => {
    const { db } = fakeDb([
      { id: 'b1', status: 'completed', reviewPending: true, dailyReviews: [] },
    ]);
    const out = await findReviewPendingBattles(db);
    expect(out).toEqual([{ id: 'b1', status: 'completed', reviewPending: true, dailyReviews: [] }]);
  });

  it('returns [] on an empty queue — the steady state, not an error', async () => {
    const { db } = fakeDb([]);
    expect(await findReviewPendingBattles(db)).toEqual([]);
  });
});

describe('the selection actually catches the defect (fixture timestamps)', () => {
  // The scenario P-6 exists for: a fullday battle completes at 20:05 UTC,
  // AFTER the 20:25 run's active-battles query would have stopped seeing it as
  // active, and the old code had nothing else that would ever look at it.
  const COMPLETED_BETWEEN_RUNS = {
    id: 'battle-late',
    status: 'completed',
    completedAt: '2026-09-01T20:05:00.000Z',
    reviewPending: true,
    dailyReviews: [],
  };
  // Already debriefed on an earlier run — drained, must not be picked up again.
  const ALREADY_REVIEWED = {
    id: 'battle-done',
    status: 'completed',
    completedAt: '2026-08-31T20:05:00.000Z',
    reviewPending: false,
    dailyReviews: [{ date: '2026-08-31' }],
  };

  it('selects the battle that completed between runs', async () => {
    // The double returns whatever the query "matched"; the assertion that
    // matters is the predicate above. Here we prove the intended battle
    // satisfies it and the drained one does not.
    expect(COMPLETED_BETWEEN_RUNS.reviewPending).toBe(true);
    const { db } = fakeDb([COMPLETED_BETWEEN_RUNS]);
    const out = await findReviewPendingBattles(db);
    expect(out.map((b) => b.id)).toEqual(['battle-late']);
  });

  it('a drained battle no longer satisfies the predicate', () => {
    expect(ALREADY_REVIEWED.reviewPending).toBe(false);
  });

  it('the flag survives a crash between selection and review', () => {
    // The clear rides the SAME update as the review append, so there is no
    // window where a battle is out of the queue but un-reviewed. If the write
    // never lands, the flag is still true and the next run retries.
    const source = readSource('agent-batch-review.js');
    const updateBlock = blockAfter(
      source,
      'await battleRef.update({',
      'console.log(`${LOG_PREFIX} Battle ${battle.id}: Day',
    );
    expect(updateBlock).toContain('reviewPending: false');
    expect(updateBlock).toContain('dailyReviews:');
  });
});

describe('the fence is not touched', () => {
  it('the new selector is local to the handler, not a change to agentBattleService', () => {
    const source = readSource('agent-batch-review.js');
    // findActiveAgentBattles is still imported and still used unchanged; the
    // new query sits beside it.
    expect(source).toContain("import { findActiveAgentBattles } from '../_utils/agentBattleService.js'");
    expect(source).toContain('export async function findReviewPendingBattles(db)');
  });

  it('the active-battles path is untouched — the queue is additive', () => {
    const source = readSource('agent-batch-review.js');
    expect(source).toContain('const battles = await findActiveAgentBattles(db);');
  });
});

describe('completeBattle stamps the flag', () => {
  it('agent-evaluate writes reviewPending: true in the terminal payload', () => {
    // 'cronState.evaluatingAt' first appears ~4000 lines EARLIER in this file,
    // so the terminator has to be searched for from the payload onward.
    const payload = blockAfter(
      readSource('agent-evaluate.js'),
      'const updatePayload = {',
      "'cronState.evaluatingAt': null,",
    );
    expect(payload).toContain('reviewPending: true');
    // ...and it does NOT repurpose pendingReflection, which has its own consumer.
    expect(payload).toContain('pendingReflection: disposition.pendingReflection');
  });
});
