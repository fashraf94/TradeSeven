// api/fantasytimes/scan-movers.test.js
// Alex Catalyst Confirmation mini-arc (spec V1.1) — F1 two-tick acceptance.
// Drives runMoverScan tick-by-tick against masteryMockDb with an injected
// story writer + dedup probe, so the model/retrieval is never touched.
//   R1  — trigger at T records a candidate, NO story; same symbol still moving
//         a full tick later → exactly one story.
//   R1a — sustained mover → one candidate, one writer call; a dedup hit at T+1
//         issues ZERO writer (retrieval) calls.
//   R1c/R2 — partial revert / whipsaw below threshold → reverted, no story.
//   R3  — the writer receives the T+1 snapshot operands, never T's.
//   Persistence guard — an overlapping invocation seconds after arming does NOT
//         confirm (the move must survive to a real next scan).

import { describe, it, expect, vi } from 'vitest';
import { makeMockDb } from '../_utils/__fixtures__/masteryMockDb.js';
import { runMoverScan, MOVE_THRESHOLD_PCT } from './scan-movers.js';
import { candidateDocId, CANDIDATE_STATUS } from '../_utils/moverCandidates.js';

const DATE = '2026-08-06';
// One scan pass per tick, 15 min apart (the real cadence).
const T0 = new Date('2026-08-06T14:00:00Z');
const T1 = new Date('2026-08-06T14:15:00Z');
const T2 = new Date('2026-08-06T14:30:00Z');
const T0b = new Date('2026-08-06T14:00:05Z'); // an overlapping invocation, 5s later

const q = (symbol, changeP, close, previousClose) => ({
  symbol, ok: true,
  data: { change_p: String(changeP), close: String(close), previousClose: String(previousClose) },
});
const candPath = (sym) => `moverCandidates/${candidateDocId(DATE, sym)}`;

// A world where generateStory "publishes" (marks the symbol covered) and
// hasRecentStory reads that same coverage set — the production dedup semantics.
function makeWorld(overrides = {}) {
  const covered = new Set(overrides.covered || []);
  const generateStory = vi.fn(async ({ symbol }) => {
    covered.add(symbol);
    return { success: true, headline: `${symbol} moves` };
  });
  const hasRecentStory = vi.fn(async (symbol) => covered.has(symbol));
  return { covered, generateStory, hasRecentStory };
}
const scan = (db, world, quotes, now) => runMoverScan(db, {
  quotes, marketDate: DATE,
  generateStory: world.generateStory,
  hasRecentStory: world.hasRecentStory,
  now,
});

describe('R1 — two-tick confirmation', () => {
  it('tick T records a candidate and writes NO story; the next tick writes exactly one', async () => {
    const db = makeMockDb();
    const world = makeWorld();

    const t1 = await scan(db, world, [q('GOOGL', -3.2, 195.5, 201.9)], T0);
    expect(t1.candidatesRecorded).toBe(1);
    expect(t1.storiesGenerated).toBe(0);
    expect(world.generateStory).not.toHaveBeenCalled();
    expect(db.__dump(candPath('GOOGL')).status).toBe(CANDIDATE_STATUS.PENDING);

    const t2 = await scan(db, world, [q('GOOGL', -3.1, 196.0, 202.3)], T1);
    expect(t2.confirmed).toBe(1);
    expect(t2.storiesGenerated).toBe(1);
    expect(world.generateStory).toHaveBeenCalledTimes(1);
    expect(db.__dump(candPath('GOOGL')).status).toBe(CANDIDATE_STATUS.CONFIRMED);
  });
});

describe('persistence guard — an overlapping same-tick invocation cannot confirm', () => {
  it('a candidate armed seconds ago is left pending, not confirmed', async () => {
    const db = makeMockDb();
    const world = makeWorld();
    await scan(db, world, [q('GOOGL', -3.2, 195.5, 201.9)], T0);         // arm
    const overlap = await scan(db, world, [q('GOOGL', -3.2, 195.5, 201.9)], T0b); // 5s later
    expect(overlap.confirmed).toBe(0);
    expect(world.generateStory).not.toHaveBeenCalled();
    expect(db.__dump(candPath('GOOGL')).status).toBe(CANDIDATE_STATUS.PENDING);

    // A real next tick still confirms.
    const t2 = await scan(db, world, [q('GOOGL', -3.1, 196.0, 202.3)], T1);
    expect(t2.confirmed).toBe(1);
    expect(world.generateStory).toHaveBeenCalledTimes(1);
  });
});

describe('R3 — fresh operands: the writer sees the T+1 snapshot, never T', () => {
  it('percentChange + price come from the T+1 quote', async () => {
    const db = makeMockDb();
    const world = makeWorld();
    await scan(db, world, [q('GOOGL', -3.2, 195.5, 201.9)], T0);           // T
    await scan(db, world, [q('GOOGL', -3.05, 196.4, 202.0)], T1);          // T+1
    expect(world.generateStory).toHaveBeenCalledTimes(1);
    const args = world.generateStory.mock.calls[0][0];
    expect(args.percentChange).toBe(-3.05);       // T+1, not -3.2
    expect(args.currentPrice).toBe(196.4);        // T+1 close
    expect(args.priceChange).toBeCloseTo(196.4 - 202.0, 5);
    expect(args.direction).toBe('down');
  });
});

describe('R1a — sustained mover: exactly one candidate, one story, one retrieval', () => {
  it('three ticks above threshold → 1 candidate armed, 1 story written', async () => {
    const db = makeMockDb();
    const world = makeWorld();
    const t1 = await scan(db, world, [q('AAPL', 3.5, 210, 203)], T0);   // arm
    const t2 = await scan(db, world, [q('AAPL', 3.6, 211, 203)], T1);   // confirm + write
    const t3 = await scan(db, world, [q('AAPL', 3.4, 210.5, 203)], T2); // dedup-suppressed

    expect(t1.candidatesRecorded + t2.candidatesRecorded + t3.candidatesRecorded).toBe(1);
    expect(world.generateStory).toHaveBeenCalledTimes(1);
    expect(t3.candidatesRecorded).toBe(0); // birth-suppressed by the existing story
  });

  it('a dedup hit at T+1 issues ZERO writer/retrieval calls', async () => {
    const db = makeMockDb();
    const world = makeWorld();
    await scan(db, world, [q('NVDA', 4.0, 500, 480)], T0);    // arm (no story yet)
    world.covered.add('NVDA');                                // a story lands out-of-band
    const t2 = await scan(db, world, [q('NVDA', 4.1, 505, 480)], T1);
    expect(t2.dedupSkipped).toBe(1);
    expect(world.generateStory).not.toHaveBeenCalled();       // zero retrieval on dedup hit
    expect(db.__dump(candPath('NVDA')).status).toBe(CANDIDATE_STATUS.CONFIRMED);
  });
});

describe('R2 / R1c — whipsaw + partial revert terminate as reverted, no story', () => {
  it('a move that mean-reverts below threshold at T+1 writes no story (whipsaw_reverted)', async () => {
    const db = makeMockDb();
    const world = makeWorld();
    await scan(db, world, [q('TSLA', -3.4, 240, 249)], T0);    // arm
    const t2 = await scan(db, world, [q('TSLA', -1.0, 246, 249)], T1); // reverted
    expect(t2.reverted).toBe(1);
    expect(t2.storiesGenerated).toBe(0);
    expect(world.generateStory).not.toHaveBeenCalled();
    expect(db.__dump(candPath('TSLA')).status).toBe(CANDIDATE_STATUS.REVERTED);
  });

  it('a partial revert still nonzero but below threshold (-3.4% -> -2.1%) skips (R1c)', async () => {
    const db = makeMockDb();
    const world = makeWorld();
    await scan(db, world, [q('META', -3.4, 300, 310)], T0);
    const t2 = await scan(db, world, [q('META', -2.1, 303, 310)], T1);
    expect(t2.reverted).toBe(1);
    expect(world.generateStory).not.toHaveBeenCalled();
  });
});

describe('fault isolation — one symbol error does not abort the whole tick', () => {
  it('a throwing dedup probe for one candidate still lets the others confirm', async () => {
    const db = makeMockDb();
    const world = makeWorld();
    await scan(db, world, [q('AAPL', 3.5, 210, 203), q('GOOGL', -3.5, 190, 200)], T0); // arm both

    // hasRecentStory throws for AAPL only (consumed first: mock sorts paths, AAPL<GOOGL).
    const boom = { ...world };
    boom.hasRecentStory = vi.fn(async (symbol) => {
      if (symbol === 'AAPL') throw new Error('DEADLINE_EXCEEDED');
      return false;
    });
    const t2 = await runMoverScan(db, {
      quotes: [q('AAPL', 3.5, 211, 203), q('GOOGL', -3.5, 189, 200)],
      marketDate: DATE, generateStory: boom.generateStory, hasRecentStory: boom.hasRecentStory, now: T1,
    });
    expect(t2.errors.some((e) => e.includes('AAPL'))).toBe(true);
    expect(t2.confirmed).toBe(1);                       // GOOGL still processed
    expect(boom.generateStory).toHaveBeenCalledTimes(1);
    expect(boom.generateStory.mock.calls[0][0].symbol).toBe('GOOGL');
  });
});

describe('C4 — moversDetected decomposes into visible buckets (§9 display-agreement)', () => {
  it('each detected mover lands in exactly one of candidatesRecorded / moverAlreadyStoried / moverAlreadyPending', async () => {
    const db = makeMockDb();
    const world = makeWorld({ covered: ['STORIED'] }); // STORIED already has a story today

    // Arm a pending candidate for PENDING at T0.
    await scan(db, world, [q('PENDING', 4.0, 100, 96)], T0);

    // An overlapping pass (5s later, too young to confirm): PENDING is still a
    // mover (candidate already armed -> already-pending), FRESH is a new mover
    // (-> recorded), STORIED is a mover already covered (-> birth-suppressed).
    const r = await scan(db, world, [
      q('PENDING', 4.1, 101, 96),
      q('FRESH', 5.0, 210, 200),
      q('STORIED', 6.0, 320, 300),
    ], T0b);

    expect(r.moversDetected).toBe(3);
    expect(r.candidatesRecorded).toBe(1);      // FRESH
    expect(r.moverAlreadyStoried).toBe(1);     // STORIED (pre-fix: silent bucket)
    expect(r.moverAlreadyPending).toBe(1);     // PENDING (pre-fix: silent bucket)
    expect(r.confirmed).toBe(0);               // PENDING too young; two-tick intact
    expect(r.storiesGenerated).toBe(0);

    // The invariant the founder's counters failed: moversDetected must
    // decompose into visible terms (no arm-errors in this scenario).
    expect(r.moversDetected).toBe(
      r.candidatesRecorded + r.moverAlreadyStoried + r.moverAlreadyPending,
    );
  });
});

describe('threshold export', () => {
  it('MOVE_THRESHOLD_PCT is 3', () => expect(MOVE_THRESHOLD_PCT).toBe(3));
});
