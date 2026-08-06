// api/_utils/moverCandidates.test.js
// Alex Catalyst Confirmation mini-arc (spec V1.1) — F1 candidate lifecycle unit
// tests. Rows R1a (birth-suppression + consume idempotency under overlap),
// R1b (one terminal transition; reverted cannot re-confirm), R1c (confirmation
// predicate). Uses masteryMockDb for OPTIMISTIC-CONCURRENCY transactions so the
// CAS is proven against a real lost-race retry, not a serial stub.

import { describe, it, expect } from 'vitest';
import { makeMockDb } from './__fixtures__/masteryMockDb.js';
import {
  CANDIDATE_STATUS,
  candidateDocId,
  recordCandidate,
  consumeCandidate,
  tickPendingCandidate,
  listPendingCandidates,
  reSatisfiesTrigger,
} from './moverCandidates.js';

const DATE = '2026-08-06';
const SYM = 'GOOGL';
const path = `moverCandidates/${candidateDocId(DATE, SYM)}`;
const trigger = { changePct: -3.2, price: 180.1, atrMultiple: 1.5 };

describe('recordCandidate — birth-suppression (F1b / R1a birth half)', () => {
  it('creates a pending candidate, then suppresses a second creation for the same symbol', async () => {
    const db = makeMockDb();
    const a = await recordCandidate(db, { marketDate: DATE, symbol: SYM, triggerSnapshot: trigger });
    expect(a).toEqual({ created: true, reason: 'created' });
    expect(db.__dump(path).status).toBe(CANDIDATE_STATUS.PENDING);

    const b = await recordCandidate(db, { marketDate: DATE, symbol: SYM, triggerSnapshot: { changePct: -3.4 } });
    expect(b).toEqual({ created: false, reason: 'pending_exists' });
    // The snapshot is NOT overwritten while pending — the original T trigger stands.
    expect(db.__dump(path).triggerSnapshot.changePct).toBe(-3.2);
  });

  it('re-arms a TERMINAL candidate with a fresh snapshot (a later genuine re-trigger is a new lifecycle)', async () => {
    const db = makeMockDb();
    await recordCandidate(db, { marketDate: DATE, symbol: SYM, triggerSnapshot: trigger });
    await consumeCandidate(db, { marketDate: DATE, symbol: SYM, outcome: CANDIDATE_STATUS.REVERTED, reason: 'whipsaw_reverted' });
    const re = await recordCandidate(db, { marketDate: DATE, symbol: SYM, triggerSnapshot: { changePct: -4.0 } });
    expect(re).toEqual({ created: true, reason: 're_armed' });
    const doc = db.__dump(path);
    expect(doc.status).toBe(CANDIDATE_STATUS.PENDING);
    expect(doc.triggerSnapshot.changePct).toBe(-4.0);
    expect(doc.ticksSeen).toBe(0);
  });
});

describe('consumeCandidate — atomic CAS (R1a / R1b)', () => {
  it('flips pending -> confirmed exactly once; a repeat consume is a benign no-op', async () => {
    const db = makeMockDb();
    await recordCandidate(db, { marketDate: DATE, symbol: SYM, triggerSnapshot: trigger });

    const first = await consumeCandidate(db, { marketDate: DATE, symbol: SYM, outcome: CANDIDATE_STATUS.CONFIRMED });
    expect(first.won).toBe(true);
    expect(first.status).toBe(CANDIDATE_STATUS.CONFIRMED);

    const second = await consumeCandidate(db, { marketDate: DATE, symbol: SYM, outcome: CANDIDATE_STATUS.CONFIRMED });
    expect(second.won).toBe(false);
    expect(second.status).toBe(CANDIDATE_STATUS.CONFIRMED);
  });

  it('two OVERLAPPING consumers of one pending candidate yield EXACTLY ONE winner (R1a)', async () => {
    const db = makeMockDb();
    await recordCandidate(db, { marketDate: DATE, symbol: SYM, triggerSnapshot: trigger });

    // Force a deterministic interleave: consumer B runs fully inside consumer
    // A's pre-commit window, so A's commit hits a version conflict and retries
    // against B's committed (terminal) state.
    let bResult;
    db.__beforeCommit = async () => {
      bResult = await consumeCandidate(db, { marketDate: DATE, symbol: SYM, outcome: CANDIDATE_STATUS.CONFIRMED });
    };
    const aResult = await consumeCandidate(db, { marketDate: DATE, symbol: SYM, outcome: CANDIDATE_STATUS.CONFIRMED });

    const winners = [aResult.won, bResult.won].filter(Boolean);
    expect(winners).toHaveLength(1);
    expect(db.__dump(path).status).toBe(CANDIDATE_STATUS.CONFIRMED);
    expect(db.__dump(path).version).toBe(1); // exactly one terminal write
  });

  it('a REVERTED candidate can NEVER be re-confirmed at a later tick (R1b / C3)', async () => {
    const db = makeMockDb();
    await recordCandidate(db, { marketDate: DATE, symbol: SYM, triggerSnapshot: trigger });
    const rev = await consumeCandidate(db, { marketDate: DATE, symbol: SYM, outcome: CANDIDATE_STATUS.REVERTED, reason: 'whipsaw_reverted' });
    expect(rev.won).toBe(true);

    const reconfirm = await consumeCandidate(db, { marketDate: DATE, symbol: SYM, outcome: CANDIDATE_STATUS.CONFIRMED });
    expect(reconfirm.won).toBe(false);
    expect(reconfirm.status).toBe(CANDIDATE_STATUS.REVERTED);
    expect(db.__dump(path).status).toBe(CANDIDATE_STATUS.REVERTED);
  });

  it('rejects an invalid terminal outcome', async () => {
    const db = makeMockDb();
    await recordCandidate(db, { marketDate: DATE, symbol: SYM, triggerSnapshot: trigger });
    await expect(consumeCandidate(db, { marketDate: DATE, symbol: SYM, outcome: 'pending' }))
      .rejects.toThrow(/invalid terminal outcome/);
  });
});

describe('tickPendingCandidate — N-tick expiry (F1a)', () => {
  it('expires a pending candidate only after maxTicks skipped passes', async () => {
    const db = makeMockDb();
    await recordCandidate(db, { marketDate: DATE, symbol: SYM, triggerSnapshot: trigger });

    const t1 = await tickPendingCandidate(db, { marketDate: DATE, symbol: SYM, maxTicks: 2 });
    expect(t1).toMatchObject({ expired: false, ticksSeen: 1, status: CANDIDATE_STATUS.PENDING });

    const t2 = await tickPendingCandidate(db, { marketDate: DATE, symbol: SYM, maxTicks: 2 });
    expect(t2).toMatchObject({ expired: true, ticksSeen: 2, status: CANDIDATE_STATUS.EXPIRED });
    expect(db.__dump(path).terminalReason).toBe('candidate_expired');
  });

  it('never ticks a candidate that is already terminal', async () => {
    const db = makeMockDb();
    await recordCandidate(db, { marketDate: DATE, symbol: SYM, triggerSnapshot: trigger });
    await consumeCandidate(db, { marketDate: DATE, symbol: SYM, outcome: CANDIDATE_STATUS.CONFIRMED });
    const t = await tickPendingCandidate(db, { marketDate: DATE, symbol: SYM, maxTicks: 2 });
    expect(t.expired).toBe(false);
    expect(t.status).toBe(CANDIDATE_STATUS.CONFIRMED);
  });
});

describe('listPendingCandidates', () => {
  it('returns only pending candidates for the date', async () => {
    const db = makeMockDb();
    await recordCandidate(db, { marketDate: DATE, symbol: 'GOOGL', triggerSnapshot: trigger });
    await recordCandidate(db, { marketDate: DATE, symbol: 'AAPL', triggerSnapshot: { changePct: 3.5 } });
    await consumeCandidate(db, { marketDate: DATE, symbol: 'AAPL', outcome: CANDIDATE_STATUS.CONFIRMED });

    const pending = await listPendingCandidates(db, DATE);
    expect(pending.map((c) => c.symbol)).toEqual(['GOOGL']);
  });
});

describe('reSatisfiesTrigger — confirmation predicate (F1c / R1c)', () => {
  const th = 3; // MOVE_THRESHOLD_PCT
  it('confirms a fresh move still at/above threshold in the same direction', () => {
    expect(reSatisfiesTrigger(-3.1, { changePct: -3.2 }, th)).toBe(true);
    expect(reSatisfiesTrigger(4.0, { changePct: 3.5 }, th)).toBe(true);
  });
  it('SKIPS a partial revert that no longer clears the threshold (-3.0% -> -2.1%)', () => {
    expect(reSatisfiesTrigger(-2.1, { changePct: -3.0 }, th)).toBe(false);
  });
  it('SKIPS a direction flip (opposite move is its own new candidate)', () => {
    expect(reSatisfiesTrigger(3.4, { changePct: -3.2 }, th)).toBe(false);
  });
  it('handles missing/zero prior direction and non-finite input', () => {
    expect(reSatisfiesTrigger(-3.4, { changePct: 0 }, th)).toBe(true);
    expect(reSatisfiesTrigger(NaN, { changePct: -3.2 }, th)).toBe(false);
  });
});
