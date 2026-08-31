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
import { findReviewPendingBattles, processBattleReview, releaseReviewPending, REVIEW_PENDING_LIMIT } from './agent-batch-review.js';

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

describe('the drain releases the queue on EVERY terminal path', () => {
  // THE BUG THIS EXISTS FOR. An earlier version cleared reviewPending only in
  // the review write, so a queue-sourced battle that SKIPPED kept the flag
  // forever. The queue is limit-5, so five stuck battles permanently starve the
  // drain and no battle ever gets a debrief again — strictly worse than the
  // bug P-6 was written to fix. These rows exercise the skip paths for real
  // rather than asserting on source text.
  const todayEt = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  /** Records update() calls against agentBattles/{id}. */
  function updateSpy() {
    const updates = [];
    const db = {
      collection: () => ({
        doc: (id) => ({
          update: async (payload) => { updates.push({ id, payload }); },
        }),
      }),
    };
    return { db, updates };
  }

  const reviewedToday = () => ({
    id: 'battle-late',
    status: 'completed',
    reviewPending: true,
    timing: { tradingDays: [todayEt()] },
    dailyReviews: [{ date: todayEt() }],
  });

  it('already_reviewed: a queue-sourced battle is released, not left stuck', async () => {
    const { db, updates } = updateSpy();
    const result = await processBattleReview(db, reviewedToday(), { clearReviewPending: true });
    expect(result).toEqual({ status: 'skipped', reason: 'already_reviewed' });
    expect(updates).toEqual([{ id: 'battle-late', payload: { reviewPending: false } }]);
  });

  it('no_activity: a queue-sourced battle with no trades or evals is released too', async () => {
    const { db, updates } = updateSpy();
    const battle = {
      id: 'battle-quiet', status: 'completed', reviewPending: true,
      timing: { tradingDays: [todayEt()] }, dailyReviews: [], trades: [], evaluations: [],
    };
    const result = await processBattleReview(db, battle, { clearReviewPending: true });
    expect(result).toEqual({ status: 'skipped', reason: 'no_activity' });
    expect(updates).toEqual([{ id: 'battle-quiet', payload: { reviewPending: false } }]);
  });

  it('an ACTIVE battle that skips is NOT written to — it never carried the flag', async () => {
    const { db, updates } = updateSpy();
    await processBattleReview(db, reviewedToday(), { clearReviewPending: false });
    expect(updates).toEqual([]);
  });

  it('a completed battle already debriefed on its OWN last day is not reviewed again', async () => {
    // THE DUPLICATE-DEBRIEF DEFECT. A battle reviewed while still active on day
    // D, completing overnight, used to find no review dated D+1 and be reviewed
    // a SECOND time — a duplicate debrief, a duplicate statusFeed beat, and a
    // duplicate lesson arrayUnion'd onto the agent doc, which feeds prompt
    // assembly. A completed battle dedupes against its own completion day.
    const { db, updates } = updateSpy();
    const battle = {
      id: 'battle-yesterday',
      status: 'completed',
      reviewPending: true,
      completedAt: '2026-09-01T23:30:00.000Z',      // Tue 7:30 PM ET
      timing: { tradingDays: [todayEt()] },
      dailyReviews: [{ date: '2026-09-01' }],        // already debriefed for Tue
    };
    const result = await processBattleReview(db, battle, { clearReviewPending: true });
    expect(result).toEqual({ status: 'skipped', reason: 'already_reviewed' });
    // ...and it still leaves the queue.
    expect(updates).toEqual([{ id: 'battle-yesterday', payload: { reviewPending: false } }]);
  });

  it('an ACTIVE battle still dedupes against TODAY, not a completion date it lacks', async () => {
    const { db } = updateSpy();
    const battle = {
      id: 'battle-active', status: 'active',
      timing: { tradingDays: [todayEt()] },
      dailyReviews: [{ date: todayEt() }],
    };
    const result = await processBattleReview(db, battle, { clearReviewPending: false });
    expect(result).toEqual({ status: 'skipped', reason: 'already_reviewed' });
  });

  it('releasing is non-fatal: a failed clear leaves the battle queued for the next run', async () => {
    const db = { collection: () => ({ doc: () => ({ update: async () => { throw new Error('boom'); } }) }) };
    // Must not throw — a thrown error here would abort the whole cron run.
    await expect(releaseReviewPending(db, 'b1')).resolves.toBeUndefined();
  });
});

describe('the queue is scheduled to survive the handler\'s time budget', () => {
  // One review can cost ~30s of a 60s maxDuration (Haiku 15s + Gemma debrief
  // 15s), so whatever is last in the work list may never run.
  it('the pending queue is processed BEFORE the active list', () => {
    const source = readSource('agent-batch-review.js');
    const loop = blockAfter(source, 'const work = [];', 'const deadline');
    expect(loop.indexOf('of pending'), 'the queue must be pushed first')
      .toBeLessThan(loop.indexOf('of battles'));
  });

  it('new reviews stop starting near the budget rather than being killed mid-write', () => {
    const source = readSource('agent-batch-review.js');
    expect(source).toContain('TIME_BUDGET_MS');
    expect(source).toContain('if (Date.now() > deadline)');
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
    // A NEW field, not a repurposing of pendingReflection (which has its own
    // consumer draining it every 15 minutes), and CPU-gated the same way so a
    // passive tournament CPU battle is never parked in a queue it can only
    // ever be skipped out of.
    expect(payload).toContain('reviewPending: disposition.pendingReflection');
    expect(payload).toContain('pendingReflection: disposition.pendingReflection');
  });
});
