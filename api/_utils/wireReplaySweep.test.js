// api/_utils/wireReplaySweep.test.js
// Reconciliation sweep acceptance (Spec V1.5 §9 / §4.7): kill-after-batch
// replay for every outcome class, envelope_missing alarm (expectation ZERO
// elsewhere), receipt-hit clearing, conflict termination, orphan drain,
// and budget deferral.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFirestoreFake } from './__fixtures__/wireFirestoreFake.js';

const flagState = { metricsEnabled: false, writesEnabled: true, continuityEnabled: false };
vi.mock('./wireFlags.js', () => ({
  getWireFlags: () => ({ ...flagState }),
}));

const { publishStoryWithWire } = await import('./wireWriteThrough.js');
const { runWireReplaySweep } = await import('./wireReplaySweep.js');
const { WIRE_CONFLICTS, WIRE_OUTCOMES } = await import('./wireContracts.js');
const { computePayloadHash } = await import('./wireIdentity.js');

/** The NORMALIZED facts the validator produces for goodFacts() — the exact
 *  value publishStoryWithWire hashes. Built here independently of the code
 *  under test so the receipt-match assertion is not circular. */
const normalizedGoodFacts = () => ({
  eventType: 'earnings_recap',
  tickers: ['NVDA'],
  direction: 'up',
  magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' },
  keyLevel: null,
  figures: [],
  qualifiers: [],
});

const MARKET_DATE = '2026-07-24';
const NOW = new Date('2026-07-24T18:00:00Z');
const LATER = new Date('2026-07-24T19:30:00Z'); // > orphan age past NOW

const storyDoc = (over = {}) => ({
  reporter: 'doug', type: 'earnings_recap', headline: 'h', body: 'b',
  tickers: ['NVDA'], primaryTicker: 'NVDA', publishedAt: NOW, status: 'published',
  ...over,
});
const goodFacts = () => ({
  eventType: 'earnings_recap', tickers: ['NVDA'], direction: 'up',
  magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' },
});

/** Stamp story+envelope but skip the transaction — the "killed after the
 *  batch" state every replay test starts from. */
const stampOnly = (db, { facts = goodFacts(), stopReason = 'tool_use', triggerRef, primaryTicker = 'NVDA' }) =>
  publishStoryWithWire(db, {
    storyDoc: storyDoc(),
    rawAgentFacts: facts,
    stopReason,
    reporter: 'doug',
    seam: 'doug_earnings_recap',
    primaryTicker,
    triggerRef,
    marketDate: MARKET_DATE,
    now: NOW,
    deferTransaction: true,
  });

let db;
beforeEach(() => {
  db = createFirestoreFake();
  flagState.writesEnabled = true;
});

describe('uniform replay (F2-1) — the sweep lands the correct artifact class', () => {
  it('PASS replay → full entry; REJECT replay → receipt+stats only; QUARANTINE replay → flagged entry', async () => {
    const pass = await stampOnly(db, { triggerRef: 'p1' });
    const rej = await stampOnly(db, { facts: { ...goodFacts(), tradeBias: 'x' }, triggerRef: 'r1' });
    const quar = await stampOnly(db, { facts: { ...goodFacts(), tickers: ['ZZZOFF'] }, triggerRef: 'q1', primaryTicker: 'ZZZOFF' });
    const trunc = await stampOnly(db, { stopReason: 'max_tokens', triggerRef: 't1' });

    const summary = await runWireReplaySweep(db, { now: LATER });
    expect(summary.replayed).toBe(4);
    expect(summary.envelopeMissing).toBe(0); // F2-1: zero across the whole matrix
    expect(summary.failed).toBe(0);

    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.validationStats.attempted).toBe(4);
    expect(day.validationStats.passed).toBe(1);
    expect(day.validationStats.rejected).toBe(1);
    expect(day.validationStats.quarantined).toBe(1);
    expect(day.validationStats.truncated).toBe(1);
    expect(day.validationStats.envelopeMissing).toBe(0);
    // entries: pass + quarantine only
    expect(day.entries.map((e) => e.storyId).sort()).toEqual(
      [pass.storyRef.id, quar.storyRef.id].sort()
    );
    expect(Object.keys(day.receipts)).toHaveLength(4);

    // every story cleaned up; every envelope gone
    for (const r of [pass, rej, quar, trunc]) {
      expect((await r.storyRef.get()).data().wirePending).toBe(false);
      expect((await db.collection('fantasyTimesWireEnvelopes').doc(r.storyRef.id).get()).exists).toBe(false);
    }
  });

  it('replayed REJECT still counts — the §6.1 gate cannot lose rejects (F2-1)', async () => {
    await stampOnly(db, { facts: { ...goodFacts(), sentiment: 'bullish' }, triggerRef: 'rejonly' });
    await runWireReplaySweep(db, { now: LATER });
    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.validationStats.rejected).toBe(1);
    expect(day.entries).toHaveLength(0);
  });
});

describe('envelope_missing — the unambiguous alarm', () => {
  it('pending story with no envelope → wireConflict, flag cleared, counter incremented', async () => {
    const { storyRef } = await stampOnly(db, { triggerRef: 'em1' });
    // Simulate the impossible: envelope vanished without cleanup.
    await db.collection('fantasyTimesWireEnvelopes').doc(storyRef.id).delete();

    const summary = await runWireReplaySweep(db, { now: LATER });
    expect(summary.envelopeMissing).toBe(1);

    const story = (await storyRef.get()).data();
    expect(story.wirePending).toBe(false);
    expect(story.wireConflict).toBe(WIRE_CONFLICTS.ENVELOPE_MISSING);

    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.validationStats.envelopeMissing).toBe(1);
    expect(day.validationStats.attempted).toBe(0); // nothing replayed
  });
});

describe('receipt paths', () => {
  it('post-commit race (receipt exists, same story+hash) → receipt hit IS success', async () => {
    // Full inline publish (committed), then artificially restore the pending
    // state — the crash-between-txn-and-cleanup shape.
    const { storyRef, wire } = await publishStoryWithWire(db, {
      storyDoc: storyDoc(), rawAgentFacts: goodFacts(), stopReason: 'tool_use',
      reporter: 'doug', seam: 'doug_earnings_recap', primaryTicker: 'NVDA',
      triggerRef: 'race', marketDate: MARKET_DATE, now: NOW,
    });
    expect(wire.txStatus).toBe('committed');
    // restore pending + envelope as if cleanup died
    await storyRef.update({ wirePending: true });
    await db.collection('fantasyTimesWireEnvelopes').doc(storyRef.id).set({
      storyId: storyRef.id, seam: 'doug_earnings_recap', reporter: 'doug',
      // Hash computed INDEPENDENTLY from the facts (not read back out of the
      // doc under test) so this asserts the real F2-2 contract rather than
      // a tautology.
      idempotencyKey: wire.idempotencyKey, payloadHash: computePayloadHash(normalizedGoodFacts()),
      marketDate: MARKET_DATE, outcome: WIRE_OUTCOMES.PASSED,
      modelAgentFacts: goodFacts(), validatorResult: { codes: [], reasons: [], offUniverseTickers: [], preStripTickerCount: 1, quarantined: false, validatorVersion: '1.5.0' },
      primaryTicker: 'NVDA', headline: 'h', publishedAt: NOW, createdAt: NOW,
    });

    const summary = await runWireReplaySweep(db, { now: LATER });
    expect(summary.receiptHits).toBe(1);
    expect((await storyRef.get()).data().wirePending).toBe(false);
    const day = await dayData();
    expect(day.entries).toHaveLength(1); // no duplicate entry
    expect(day.validationStats.attempted).toBe(1); // no re-increment
  });

  it('receipt with a different hash → conflict class, terminated, no retry loop', async () => {
    const { storyRef, wire } = await publishStoryWithWire(db, {
      storyDoc: storyDoc(), rawAgentFacts: goodFacts(), stopReason: 'tool_use',
      reporter: 'doug', seam: 'doug_earnings_recap', primaryTicker: 'NVDA',
      triggerRef: 'clash', marketDate: MARKET_DATE, now: NOW,
    });
    await storyRef.update({ wirePending: true });
    await db.collection('fantasyTimesWireEnvelopes').doc(storyRef.id).set({
      storyId: storyRef.id, seam: 'doug_earnings_recap', reporter: 'doug',
      idempotencyKey: wire.idempotencyKey, payloadHash: 'deadbeef', // ≠ stored
      marketDate: MARKET_DATE, outcome: WIRE_OUTCOMES.PASSED,
      modelAgentFacts: goodFacts(), validatorResult: { codes: [], reasons: [], offUniverseTickers: [], preStripTickerCount: 1, quarantined: false, validatorVersion: '1.5.0' },
      primaryTicker: 'NVDA', headline: 'h', publishedAt: NOW, createdAt: NOW,
    });

    const summary = await runWireReplaySweep(db, { now: LATER });
    expect(summary.conflicts).toBe(1);
    const story = (await storyRef.get()).data();
    expect(story.wirePending).toBe(false);
    expect(story.wireConflict).toBe(WIRE_CONFLICTS.HASH_MISMATCH);
    expect((await dayData()).validationStats.idempotencyConflicts).toBe(1);

    // terminated: a second sweep finds nothing pending
    const again = await runWireReplaySweep(db, { now: LATER });
    expect(again.scanned).toBe(0);
  });

  it('sweep-side DST double-fire variant (F2-10): second story with the same key → story_mismatch conflict', async () => {
    // Both fires stamped (killed before their transactions); same key.
    const first = await stampOnly(db, { triggerRef: 'dst' });
    const second = await stampOnly(db, { triggerRef: 'dst' });

    const summary = await runWireReplaySweep(db, { now: LATER });
    expect(summary.replayed).toBe(1);
    expect(summary.conflicts).toBe(1);

    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.entries).toHaveLength(1); // no duplicate entry
    expect(day.validationStats.attempted).toBe(1); // no stat re-increment
    expect(day.validationStats.idempotencyConflicts).toBe(1);
    expect(day.receipts['doug_earnings_recap:dst:2026-07-24'].storyId).toBe(first.storyRef.id);
    expect((await second.storyRef.get()).data().wireConflict).toBe(WIRE_CONFLICTS.STORY_MISMATCH);
  });
});

describe('exactly-once terminal actions + poison-pill cap', () => {
  it('a story that is no longer pending is skipped, not re-counted (TOCTOU)', async () => {
    const { storyRef } = await stampOnly(db, { triggerRef: 'toctou' });
    await db.collection('fantasyTimesWireEnvelopes').doc(storyRef.id).delete();
    // The inline path completed between the sweep's query and the envelope
    // read — wirePending is already false.
    await storyRef.update({ wirePending: false });

    const summary = await runWireReplaySweep(db, { now: LATER });
    // The query itself no longer matches, so nothing is scanned at all;
    // and critically no alarm is raised and no counter moves.
    expect(summary.envelopeMissing).toBe(0);
    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day?.validationStats?.envelopeMissing || 0).toBe(0);
  });

  it('envelopeMissing is counted exactly once even if the sweep runs repeatedly', async () => {
    const { storyRef } = await stampOnly(db, { triggerRef: 'once' });
    await db.collection('fantasyTimesWireEnvelopes').doc(storyRef.id).delete();

    const first = await runWireReplaySweep(db, { now: LATER });
    const second = await runWireReplaySweep(db, { now: LATER });
    expect(first.envelopeMissing).toBe(1);
    expect(second.envelopeMissing).toBe(0); // terminal — not re-scanned
    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.validationStats.envelopeMissing).toBe(1);
  });

  it('a permanently failing story is terminated as replay_exhausted, not retried forever', async () => {
    const { storyRef } = await stampOnly(db, { triggerRef: 'poison' });
    // Simulate prior failed attempts having accumulated.
    await storyRef.update({ wireReplayAttempts: 5 });

    const summary = await runWireReplaySweep(db, { now: LATER, maxAttempts: 5 });
    expect(summary.exhausted).toBe(1);

    const story = (await storyRef.get()).data();
    expect(story.wirePending).toBe(false);
    expect(story.wireConflict).toBe(WIRE_CONFLICTS.REPLAY_EXHAUSTED);
    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.validationStats.replayExhausted).toBe(1);

    // and it no longer occupies the head of the queue
    const again = await runWireReplaySweep(db, { now: LATER, maxAttempts: 5 });
    expect(again.scanned).toBe(0);
  });

  it('a failing replay records an attempt so the cap can eventually bind', async () => {
    const { storyRef } = await stampOnly(db, { triggerRef: 'failing' });
    // Corrupt the envelope so the shared transaction throws on it.
    await db.collection('fantasyTimesWireEnvelopes').doc(storyRef.id).set({
      storyId: storyRef.id, outcome: 'passed', marketDate: 'not-a-date',
      idempotencyKey: 'k', payloadHash: 'h', modelAgentFacts: null,
      validatorResult: { codes: [], reasons: [] }, createdAt: NOW,
    });
    const summary = await runWireReplaySweep(db, { now: LATER });
    expect(summary.failed).toBe(1);
    expect((await storyRef.get()).data().wireReplayAttempts).toBe(1);
    expect((await storyRef.get()).data().wirePending).toBe(true); // still queued
  });
});

describe('orphan drain + budget', () => {
  it('deletes an aged envelope whose story is no longer pending; keeps a fresh one', async () => {
    const { storyRef } = await stampOnly(db, { triggerRef: 'orphan' });
    await storyRef.update({ wirePending: false }); // story moved on; envelope stranded

    const fresh = await stampOnly(db, { triggerRef: 'fresh' });
    await fresh.storyRef.update({ wirePending: false });
    // fresh envelope createdAt == NOW; sweep at NOW+5min < 30min orphan age
    const early = await runWireReplaySweep(db, { now: new Date(NOW.getTime() + 5 * 60 * 1000) });
    expect(early.orphansDeleted).toBe(0);

    const summary = await runWireReplaySweep(db, { now: LATER }); // 90min later
    expect(summary.orphansDeleted).toBe(2);
    expect((await db.collection('fantasyTimesWireEnvelopes').doc(storyRef.id).get()).exists).toBe(false);
  });

  it('defers items past the time budget instead of overrunning', async () => {
    await stampOnly(db, { triggerRef: 'b1' });
    await stampOnly(db, { triggerRef: 'b2' });
    const summary = await runWireReplaySweep(db, { now: LATER, timeBudgetMs: -1 });
    expect(summary.deferred).toBeGreaterThan(0);
    expect(summary.replayed).toBe(0);
  });
});

async function dayData() {
  return (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
}
