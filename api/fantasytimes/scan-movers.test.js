// api/fantasytimes/scan-movers.test.js
// Alex Catalyst Confirmation mini-arc (spec V1.1) — F1 two-tick acceptance.
// Drives runMoverScan tick-by-tick against masteryMockDb with an injected
// story writer + dedup probe, so the model/retrieval is never touched.
//   R1  — trigger at T records a candidate, NO story, NO writer call; same
//         symbol still moving at T+1 → exactly one story.
//   R1a — sustained mover across N ticks → one candidate, one writer call;
//         a dedup hit at T+1 issues ZERO writer (retrieval) calls.
//   R1c/R2 — a partial revert / whipsaw below threshold at T+1 → no story,
//         whipsaw_reverted; the candidate terminates reverted.
//   R3  — the writer receives the T+1 snapshot operands, never T's.

import { describe, it, expect, vi } from 'vitest';
import { makeMockDb } from '../_utils/__fixtures__/masteryMockDb.js';
import { runMoverScan, MOVE_THRESHOLD_PCT } from './scan-movers.js';
import { candidateDocId, CANDIDATE_STATUS } from '../_utils/moverCandidates.js';

const DATE = '2026-08-06';
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
const scan = (db, world, quotes) => runMoverScan(db, {
  db, quotes, marketDate: DATE,
  generateStory: world.generateStory,
  hasRecentStory: world.hasRecentStory,
  now: new Date('2026-08-06T15:00:00Z'),
});

describe('R1 — two-tick confirmation', () => {
  it('tick T records a candidate and writes NO story; tick T+1 writes exactly one', async () => {
    const db = makeMockDb();
    const world = makeWorld();

    const t1 = await scan(db, world, [q('GOOGL', -3.2, 195.5, 201.9)]);
    expect(t1.candidatesRecorded).toBe(1);
    expect(t1.storiesGenerated).toBe(0);
    expect(world.generateStory).not.toHaveBeenCalled();
    expect(db.__dump(candPath('GOOGL')).status).toBe(CANDIDATE_STATUS.PENDING);

    const t2 = await scan(db, world, [q('GOOGL', -3.1, 196.0, 202.3)]);
    expect(t2.confirmed).toBe(1);
    expect(t2.storiesGenerated).toBe(1);
    expect(world.generateStory).toHaveBeenCalledTimes(1);
    expect(db.__dump(candPath('GOOGL')).status).toBe(CANDIDATE_STATUS.CONFIRMED);
  });
});

describe('R3 — fresh operands: the writer sees the T+1 snapshot, never T', () => {
  it('percentChange + price come from the T+1 quote', async () => {
    const db = makeMockDb();
    const world = makeWorld();
    await scan(db, world, [q('GOOGL', -3.2, 195.5, 201.9)]);           // T
    await scan(db, world, [q('GOOGL', -3.05, 196.4, 202.0)]);          // T+1
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
    const t1 = await scan(db, world, [q('AAPL', 3.5, 210, 203)]);   // arm
    const t2 = await scan(db, world, [q('AAPL', 3.6, 211, 203)]);   // confirm + write
    const t3 = await scan(db, world, [q('AAPL', 3.4, 210.5, 203)]); // dedup-suppressed

    expect(t1.candidatesRecorded + t2.candidatesRecorded + t3.candidatesRecorded).toBe(1);
    expect(world.generateStory).toHaveBeenCalledTimes(1);
    expect(t3.candidatesRecorded).toBe(0); // birth-suppressed by the existing story
  });

  it('a dedup hit at T+1 issues ZERO writer/retrieval calls', async () => {
    const db = makeMockDb();
    const world = makeWorld({ covered: ['NVDA'] });        // a story already exists
    await scan(db, world, [q('NVDA', 4.0, 500, 480)]);      // T: birth-suppressed → no candidate
    // Force a pending candidate to exist anyway, then confirm into a dedup hit:
    const db2 = makeMockDb();
    const world2 = makeWorld();
    await scan(db2, world2, [q('NVDA', 4.0, 500, 480)]);    // arm (no story yet)
    world2.covered.add('NVDA');                             // a story lands out-of-band
    const t2 = await scan(db2, world2, [q('NVDA', 4.1, 505, 480)]);
    expect(t2.dedupSkipped).toBe(1);
    expect(world2.generateStory).not.toHaveBeenCalled();   // zero retrieval on dedup hit
    expect(db2.__dump(candPath('NVDA')).status).toBe(CANDIDATE_STATUS.CONFIRMED);
  });
});

describe('R2 / R1c — whipsaw + partial revert terminate as reverted, no story', () => {
  it('a move that mean-reverts below threshold at T+1 writes no story (whipsaw_reverted)', async () => {
    const db = makeMockDb();
    const world = makeWorld();
    await scan(db, world, [q('TSLA', -3.4, 240, 249)]);    // arm
    const t2 = await scan(db, world, [q('TSLA', -1.0, 246, 249)]); // reverted
    expect(t2.reverted).toBe(1);
    expect(t2.storiesGenerated).toBe(0);
    expect(world.generateStory).not.toHaveBeenCalled();
    expect(db.__dump(candPath('TSLA')).status).toBe(CANDIDATE_STATUS.REVERTED);
  });

  it('a partial revert still nonzero but below threshold (-3.4% -> -2.1%) skips (R1c)', async () => {
    const db = makeMockDb();
    const world = makeWorld();
    await scan(db, world, [q('META', -3.4, 300, 310)]);
    const t2 = await scan(db, world, [q('META', -2.1, 303, 310)]);
    expect(t2.reverted).toBe(1);
    expect(world.generateStory).not.toHaveBeenCalled();
  });
});

describe('threshold export', () => {
  it('MOVE_THRESHOLD_PCT is 3', () => expect(MOVE_THRESHOLD_PCT).toBe(3));
});
