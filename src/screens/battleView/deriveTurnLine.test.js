// src/screens/battleView/deriveTurnLine.test.js
//
// Phase A (A1) — the turn line's five states, the late boundary at exactly
// the grace, the `>=` "decided" join, and the ET/UTC slot math across the
// March DST boundary. Every case is driven by an INJECTED `now` and an
// INJECTED `marketState` (the adapter's own testing contract), so weekend /
// pre-market / after-hours / early-close phases are reachable from fixtures.
//
// The test imports the module it guards (foundation §3: a test that
// re-implements its subject passes with the feature deleted).

import { describe, it, expect } from 'vitest';
import { DESK_COPY } from '../../components/Dashboard/desk/deskCopy';
import { PHASE, buildBaggerbombAdapter, deriveLastCheckOfSession } from '../../adapters/baggerbombAdapter';
import {
  deriveTurnLine,
  selectLatestDecision,
  isDecidedAt,
  LATE_GRACE_MS,
  TURN_STATE,
} from './deriveTurnLine';

// Market-state fixtures — LOCAL-field Dates, the shape getMarketState() really
// emits (see baggerbombAdapter.test.js for why the epoch of these is meaningless).
const MS = {
  open: {
    isOpen: true, state: 'OPEN',
    nextOpenTime: new Date(2026, 8, 2, 9, 30),
    nextCloseTime: new Date(2026, 8, 1, 16, 0),
    isEarlyClose: false,
  },
  preMarket: {
    isOpen: false, state: 'PRE_MARKET',
    nextOpenTime: new Date(2026, 8, 1, 9, 30),   // Tue 9:30 ET
    nextCloseTime: new Date(2026, 8, 1, 16, 0),
    isEarlyClose: false,
  },
  afterHours: {
    isOpen: false, state: 'CLOSED_AFTERHOURS',
    nextOpenTime: new Date(2026, 8, 2, 9, 30),   // Wed 9:30 ET
    nextCloseTime: new Date(2026, 8, 2, 16, 0),
    isEarlyClose: false,
  },
  weekend: {
    isOpen: false, state: 'CLOSED_WEEKEND',
    nextOpenTime: new Date(2026, 8, 7, 9, 30),   // Mon 9:30 ET
    nextCloseTime: new Date(2026, 8, 7, 16, 0),
    isEarlyClose: false,
  },
  // Standard time (EST, UTC−5): Fri 2026-03-06, two days before the DST switch.
  openEst: {
    isOpen: true, state: 'OPEN',
    nextOpenTime: new Date(2026, 2, 9, 9, 30),
    nextCloseTime: new Date(2026, 2, 6, 16, 0),
    isEarlyClose: false,
  },
  // Daylight time (EDT, UTC−4): Mon 2026-03-09, the first session after the switch.
  openEdt: {
    isOpen: true, state: 'OPEN',
    nextOpenTime: new Date(2026, 2, 10, 9, 30),
    nextCloseTime: new Date(2026, 2, 9, 16, 0),
    isEarlyClose: false,
  },
};

const LAST = '2026-09-01T16:47:00.000Z'; // 12:47 PM ET
const DUE = '2026-09-01T17:02:00.000Z';  // 1:02 PM ET
const NOW = '2026-09-01T17:00:00Z';      // 1:00 PM ET, mid-session

function makeBattle(over = {}) {
  return {
    id: 'battle-1',
    status: 'active',
    activatedAt: '2026-09-01T13:30:00.000Z',
    agentContext: { agentName: 'Aurora' },
    scoreState: { evaluationCount: 5, lastScoredAt: LAST },
    evaluations: [
      { evalId: 'eval_005', timestamp: '2026-09-01T16:47:02.000Z', decision: 'HOLD', rationale: 'Held.' },
    ],
    portfolio: { star: [{ symbol: 'SLB' }], core: [], support: [], startingPrices: { SLB: 34 } },
    ...over,
  };
}

describe('the five states — each string is DESK_COPY verbatim (one source, D-62)', () => {
  it('live → `Checked {t} · next ~{t}`', () => {
    const t = deriveTurnLine(makeBattle(), NOW, MS.open);
    expect(t.state).toBe(TURN_STATE.LIVE);
    expect(t.phase).toBe(PHASE.LIVE);
    expect(t.text).toBe('Checked 12:47 PM · next ~1:02 PM');
    expect(t.text).toBe(DESK_COPY.postureLive(LAST, DUE));
    expect(t.nextDecisionAt).toBe(DUE);
    expect(t.dueAt).toBe(DUE);
  });

  it('late → `Last check {t} · next was due ~{t}` (past tense, tilde kept)', () => {
    const t = deriveTurnLine(makeBattle(), '2026-09-01T17:07:00.001Z', MS.open);
    expect(t.state).toBe(TURN_STATE.LATE);
    expect(t.text).toBe('Last check 12:47 PM · next was due ~1:02 PM');
    expect(t.text).toBe(DESK_COPY.postureLate(LAST, DUE));
    // The adapter withholds a next that has been and gone; the late line reads
    // the exported due time instead of re-deriving +15 (hazard 19).
    expect(t.nextDecisionAt).toBeNull();
    expect(t.dueAt).toBe(DUE);
  });

  it('pre-open → `First check at 9:30 AM ET`', () => {
    const fresh = makeBattle({ scoreState: { evaluationCount: 0, lastScoredAt: null }, evaluations: [] });
    const t = deriveTurnLine(fresh, '2026-09-01T13:25:00Z', MS.preMarket);
    expect(t.state).toBe(TURN_STATE.PRE_OPEN);
    expect(t.text).toBe(DESK_COPY.posturePreOpen);
    expect(t.text).toBe('First check at 9:30 AM ET');
  });

  it('closed → `Market closed · last check {t} · next {day} {t}` — as-of AND resume, one sentence', () => {
    const b = makeBattle({ scoreState: { evaluationCount: 26, lastScoredAt: '2026-09-01T19:45:00.000Z' } });
    const t = deriveTurnLine(b, '2026-09-01T21:00:00Z', MS.afterHours);
    expect(t.state).toBe(TURN_STATE.CLOSED);
    expect(t.text).toBe('Market closed · last check 3:45 PM · next Wed 9:30 AM ET');
    expect(t.text).toBe(DESK_COPY.postureClosed(
      { weekdayIndex: 3, hour: 9, minute: 30 }, '2026-09-01T19:45:00.000Z',
    ));
  });

  it('closed over a weekend names the Monday open', () => {
    const t = deriveTurnLine(makeBattle(), '2026-09-05T15:00:00Z', MS.weekend);
    expect(t.state).toBe(TURN_STATE.CLOSED);
    expect(t.text).toBe('Market closed · last check 12:47 PM · next Mon 9:30 AM ET');
  });

  it('complete → `Battle complete`, whatever the market is doing', () => {
    const done = makeBattle({ status: 'completed' });
    expect(deriveTurnLine(done, NOW, MS.open).text).toBe(DESK_COPY.postureComplete);
    expect(deriveTurnLine(done, NOW, MS.open).state).toBe(TURN_STATE.COMPLETE);
    expect(deriveTurnLine(done, NOW, MS.weekend).text).toBe('Battle complete');
  });

  it('live with no eval yet → the Desk\'s own degrade, never a fabricated time', () => {
    const fresh = makeBattle({ scoreState: { evaluationCount: 0, lastScoredAt: null }, evaluations: [] });
    const t = deriveTurnLine(fresh, NOW, MS.open);
    expect(t.state).toBe(TURN_STATE.FIRST_CHECK);
    expect(t.text).toBe('First check coming up');
    expect(t.text).not.toMatch(/\d/);
  });

  it('null battle → null', () => {
    expect(deriveTurnLine(null, NOW, MS.open)).toBeNull();
  });
});

describe('the late boundary — exactly the grace is not yet late', () => {
  const dueMs = new Date(DUE).getTime();

  it('at exactly dueAt + grace the line is still live: `Checked {t}`, next withheld', () => {
    const t = deriveTurnLine(makeBattle(), new Date(dueMs + LATE_GRACE_MS).toISOString(), MS.open);
    expect(t.state).toBe(TURN_STATE.LIVE);
    expect(t.text).toBe('Checked 12:47 PM');
    expect(t.nextDecisionAt).toBeNull();
  });

  it('one millisecond past the grace it is late', () => {
    const t = deriveTurnLine(makeBattle(), new Date(dueMs + LATE_GRACE_MS + 1).toISOString(), MS.open);
    expect(t.state).toBe(TURN_STATE.LATE);
    expect(t.text).toBe('Last check 12:47 PM · next was due ~1:02 PM');
  });

  it('between due and grace the line degrades to `Checked {t}` — no promise, no alarm', () => {
    const t = deriveTurnLine(makeBattle(), new Date(dueMs + 60_000).toISOString(), MS.open);
    expect(t.state).toBe(TURN_STATE.LIVE);
    expect(t.text).toBe('Checked 12:47 PM');
  });

  it('a new lastScoredAt clears the late state', () => {
    const b = makeBattle({ scoreState: { evaluationCount: 6, lastScoredAt: '2026-09-01T17:03:00.000Z' } });
    const t = deriveTurnLine(b, new Date(dueMs + LATE_GRACE_MS + 1).toISOString(), MS.open);
    expect(t.state).toBe(TURN_STATE.LIVE);
    expect(t.text).toBe('Checked 1:03 PM · next ~1:18 PM');
  });

  it('a check whose next would land past the close is never late — there is no due check (D-71: it is the last of the session)', () => {
    // 15:50 ET + 15 = 16:05 ET, past the 16:00 close. No due instant exists
    // inside this session, so nothing can be late — and the line now SAYS so
    // rather than reading `Checked 3:50 PM` with the next silently withheld.
    const b = makeBattle({ scoreState: { evaluationCount: 25, lastScoredAt: '2026-09-01T19:50:00.000Z' } });
    const t = deriveTurnLine(b, '2026-09-01T19:59:59Z', MS.open);
    expect(t.state).toBe(TURN_STATE.LAST_OF_SESSION);
    expect(t.state).not.toBe(TURN_STATE.LATE);
    expect(t.text).toBe('Checked 3:50 PM · last check today');
    expect(t.dueAt).toBeNull();
  });
});

describe('D-71 — the last check of the session', () => {
  it('MUTATION ROW — a LIVE check with a due slot inside the session is NOT the last of the day', () => {
    // 13:03 ET + 15 = 13:18 ET, well inside the session: the ordinary live line.
    const b = makeBattle({ scoreState: { evaluationCount: 11, lastScoredAt: '2026-09-01T17:03:00.000Z' } });
    const t = deriveTurnLine(b, '2026-09-01T17:04:00Z', MS.open);
    expect(t.state).toBe(TURN_STATE.LIVE);
    expect(t.text).toBe('Checked 1:03 PM · next ~1:18 PM');
    expect(t.text).not.toContain('last check today');
  });

  it('a STARVED cron before the close is late, not finished — the two states cannot be confused', () => {
    // 13:03 ET + 15 = 13:18 ET; now is 13:40 ET, past the grace. dueAt is
    // NON-null (the slot exists and was missed), so lastCheckOfSession is false.
    const b = makeBattle({ scoreState: { evaluationCount: 11, lastScoredAt: '2026-09-01T17:03:00.000Z' } });
    const t = deriveTurnLine(b, '2026-09-01T17:40:00Z', MS.open);
    expect(t.state).toBe(TURN_STATE.LATE);
    expect(t.text).toBe('Last check 1:03 PM · next was due ~1:18 PM');
    expect(t.text).not.toContain('last check today');
  });

  it('with no check landed at all the line still says a check is coming — never `last check today`', () => {
    const b = makeBattle({ scoreState: { evaluationCount: 0, lastScoredAt: null } });
    const t = deriveTurnLine(b, '2026-09-01T19:59:59Z', MS.open);
    expect(t.state).toBe(TURN_STATE.FIRST_CHECK);
    expect(t.text).toBe('First check coming up');
  });

  it('the closed and complete phases keep their own sentences — D-71 is a LIVE state only', () => {
    const closed = makeBattle({ scoreState: { evaluationCount: 25, lastScoredAt: '2026-09-01T19:45:00.000Z' } });
    expect(deriveTurnLine(closed, '2026-09-01T22:00:00Z', MS.closed).text).not.toContain('last check today');
  });

  it('ONE SOURCE — the turn line reads the adapter field, so the Desk cannot disagree with it', () => {
    // BUILD_RULES §9: the same boolean the Desk renders from. If this module
    // re-derived the null the two surfaces could drift apart.
    const b = makeBattle({ scoreState: { evaluationCount: 25, lastScoredAt: '2026-09-01T19:50:00.000Z' } });
    const sync = buildBaggerbombAdapter(b, null, null, '2026-09-01T19:59:59Z', MS.open);
    expect(sync.lastCheckOfSession).toBe(true);
    expect(deriveLastCheckOfSession('LIVE', '2026-09-01T19:50:00.000Z', MS.open)).toBe(true);
    expect(deriveLastCheckOfSession('LIVE', '2026-09-01T17:03:00.000Z', MS.open)).toBe(false);
    expect(deriveLastCheckOfSession('LIVE', null, MS.open)).toBe(false);
    expect(deriveLastCheckOfSession('LIVE_CLOSED', '2026-09-01T19:50:00.000Z', MS.closed)).toBe(false);
    expect(deriveTurnLine(b, '2026-09-01T19:59:59Z', MS.open).text)
      .toBe(DESK_COPY.postureLastOfSession('2026-09-01T19:50:00.000Z'));
  });
});

describe('the ET/UTC slot math across the March DST boundary', () => {
  it('EST (UTC−5): a 3:40 PM check is due 3:55 PM; a 3:50 PM check has no due inside the session', () => {
    const early = makeBattle({ scoreState: { evaluationCount: 9, lastScoredAt: '2026-03-06T20:40:00.000Z' } }); // 15:40 EST
    const t1 = deriveTurnLine(early, '2026-03-06T20:41:00Z', MS.openEst);
    expect(t1.text).toBe('Checked 3:40 PM · next ~3:55 PM');
    expect(t1.dueAt).toBe('2026-03-06T20:55:00.000Z');

    const late = makeBattle({ scoreState: { evaluationCount: 9, lastScoredAt: '2026-03-06T20:50:00.000Z' } }); // 15:50 EST
    const t2 = deriveTurnLine(late, '2026-03-06T20:51:00Z', MS.openEst);
    expect(t2.text).toBe('Checked 3:50 PM · last check today');
    expect(t2.dueAt).toBeNull();
  });

  it('EDT (UTC−4): the same wall-clock checks, one UTC hour earlier, resolve identically', () => {
    const early = makeBattle({ scoreState: { evaluationCount: 9, lastScoredAt: '2026-03-09T19:40:00.000Z' } }); // 15:40 EDT
    const t1 = deriveTurnLine(early, '2026-03-09T19:41:00Z', MS.openEdt);
    expect(t1.text).toBe('Checked 3:40 PM · next ~3:55 PM');
    expect(t1.dueAt).toBe('2026-03-09T19:55:00.000Z');

    const late = makeBattle({ scoreState: { evaluationCount: 9, lastScoredAt: '2026-03-09T19:50:00.000Z' } }); // 15:50 EDT
    const t2 = deriveTurnLine(late, '2026-03-09T19:51:00Z', MS.openEdt);
    expect(t2.text).toBe('Checked 3:50 PM · last check today');
    expect(t2.dueAt).toBeNull();
  });

  it('the late state formats the due time in ET on both sides of the switch', () => {
    const est = makeBattle({ scoreState: { evaluationCount: 3, lastScoredAt: '2026-03-06T15:00:00.000Z' } }); // 10:00 EST
    expect(deriveTurnLine(est, '2026-03-06T15:30:00Z', MS.openEst).text)
      .toBe('Last check 10:00 AM · next was due ~10:15 AM');
    const edt = makeBattle({ scoreState: { evaluationCount: 3, lastScoredAt: '2026-03-09T14:00:00.000Z' } }); // 10:00 EDT
    expect(deriveTurnLine(edt, '2026-03-09T14:30:00Z', MS.openEdt).text)
      .toBe('Last check 10:00 AM · next was due ~10:15 AM');
  });
});

describe('"decided" is keyed to an evaluations[] entry, never to lastScoredAt alone (hazard 4)', () => {
  it('the join is `>=` — an entry stamped after the scoring stamp belongs to the check', () => {
    expect(isDecidedAt('2026-09-01T16:47:02.000Z', LAST)).toBe(true);
    expect(deriveTurnLine(makeBattle(), NOW, MS.open).decided).toBe(true);
    expect(deriveTurnLine(makeBattle(), NOW, MS.open).decision?.evalId).toBe('eval_005');
  });

  it('an entry EQUAL to the stamp counts (>=, never >)', () => {
    expect(isDecidedAt(LAST, LAST)).toBe(true);
  });

  it('an entry OLDER than the stamp is an early-return tick: checked, not decided', () => {
    const quiet = makeBattle({
      evaluations: [{ evalId: 'eval_004', timestamp: '2026-09-01T16:32:01.000Z', decision: 'HOLD' }],
    });
    expect(isDecidedAt('2026-09-01T16:32:01.000Z', LAST)).toBe(false);
    const t = deriveTurnLine(quiet, NOW, MS.open);
    expect(t.decided).toBe(false);
    expect(t.decision).toBeNull();
    // ...and the line still says the tick ran — that part is true.
    expect(t.text).toBe('Checked 12:47 PM · next ~1:02 PM');
  });

  it('no entries at all → not decided', () => {
    expect(selectLatestDecision(makeBattle({ evaluations: [] }))).toBeNull();
    expect(selectLatestDecision(makeBattle({ evaluations: undefined }))).toBeNull();
  });

  it('with no scoring stamp the latest entry stands on its own', () => {
    const b = makeBattle({ scoreState: { evaluationCount: 1, lastScoredAt: null } });
    expect(selectLatestDecision(b)?.evalId).toBe('eval_005');
  });

  it('a trailing malformed entry (no timestamp) is skipped, not treated as the decision', () => {
    const b = makeBattle({
      evaluations: [
        { evalId: 'eval_005', timestamp: '2026-09-01T16:47:02.000Z', decision: 'HOLD' },
        { evalId: 'eval_bad' },
      ],
    });
    expect(selectLatestDecision(b)?.evalId).toBe('eval_005');
  });

  it('Firestore-Timestamp-shaped entries join the same way', () => {
    const b = makeBattle({
      evaluations: [{ evalId: 'eval_005', timestamp: { seconds: Math.floor(new Date('2026-09-01T16:47:02.000Z').getTime() / 1000) }, decision: 'HOLD' }],
    });
    expect(selectLatestDecision(b)?.evalId).toBe('eval_005');
  });
});
