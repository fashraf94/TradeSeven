// src/components/CommandCenter/hub/selectors/gameOutcome.test.js
//
// Command Center hub, slice S3 (ruling R-S3-7) — spec V1.2 §7's evidence
// table, row for row (§11.3 "Outcome C6"): no coercion into evidence, the
// verdict from the stored pair (zero, negative and close margins), the
// never-scored recorded draw as an explicit "No result", bare expiry and its
// repair, tournaments, and the result-unavailable completion.

import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { BANKED_CONTEXT, OUTCOME_KINDS as K, deriveGameOutcome, hasScoringEvidence, isRecordedTimestamp } from './gameOutcome';

const SCORED = Object.freeze({ lastScoredAt: '2026-10-20T19:58:00.000Z', evaluationCount: 41 });
const record = (over = {}) => ({
  status: 'completed',
  gameMode: 'baggerbomb_agent',
  completionContext: null,
  resultUnavailable: false,
  finalEvidence: true,
  scoreState: { ...SCORED, currentScore: 12.5, opponentScore: 3.25 },
  ...over,
});
const scores = (currentScore, opponentScore, extra = SCORED) => ({ ...extra, currentScore, opponentScore });

describe('scoring evidence: a recorded timestamp or a positive evaluation count, nothing coerced', () => {
  it.each([
    ['2026-10-20T19:58:00.000Z', true], ['2026-10-20T19:58:00Z', true], ['2026-10-20T15:58:00-04:00', true],
    [{ seconds: 1792512000, nanoseconds: 0 }, true],
    [null, false], [undefined, false], ['', false], ['yesterday', false], ['2026-10-20', false],
    ['2026-13-20T19:58:00Z', false], ['2026-10-20T25:00:00Z', false], ['1999-10-20T19:58:00Z', false],
    [0, false], [1792512000000, false], [{ seconds: 0 }, false], [{ seconds: 'x' }, false], [{}, false],
  ])('isRecordedTimestamp(%j) → %s', (value, expected) => {
    expect(isRecordedTimestamp(value)).toBe(expected);
  });

  it('a finite positive evaluation count is evidence; 0, negative, strings and non-finite are not', () => {
    expect(hasScoringEvidence({ evaluationCount: 1 })).toBe(true);
    for (const n of [0, -1, '3', NaN, Infinity, null]) expect(hasScoringEvidence({ evaluationCount: n }), String(n)).toBe(false);
    expect(hasScoringEvidence(null)).toBe(false);
  });
});

describe('the §7 table', () => {
  it('not completed: active, no verdict', () => {
    expect(deriveGameOutcome(record({ status: 'active' }))).toEqual({ kind: K.ACTIVE, mine: null, theirs: null });
  });

  it('final evidence, scored, both finite: the verdict compares the same stored pair', () => {
    expect(deriveGameOutcome(record())).toEqual({ kind: K.WON, mine: 12.5, theirs: 3.25 });
    expect(deriveGameOutcome(record({ scoreState: scores(3.25, 12.5) }))).toMatchObject({ kind: K.LOST });
    expect(deriveGameOutcome(record({ scoreState: scores(-8, -8) }))).toEqual({ kind: K.DRAW, mine: -8, theirs: -8 });
  });

  it('a positive score can lose and a negative score can win; zero is a genuine score when scored', () => {
    expect(deriveGameOutcome(record({ scoreState: scores(40.1, 52) })).kind).toBe(K.LOST);
    expect(deriveGameOutcome(record({ scoreState: scores(-3.5, -12) })).kind).toBe(K.WON);
    expect(deriveGameOutcome(record({ scoreState: scores(0, -0.01) })).kind).toBe(K.WON);
    expect(deriveGameOutcome(record({ scoreState: scores(0, 0) })).kind).toBe(K.DRAW);
  });

  it('a close margin keeps its stored precision: 10.04 beats 10.03', () => {
    expect(deriveGameOutcome(record({ scoreState: scores(10.04, 10.03) }))).toEqual({ kind: K.WON, mine: 10.04, theirs: 10.03 });
  });

  it('final evidence without a scored finite pair: "No result · no score was recorded"', () => {
    for (const s of [
      scores(12, 3, { lastScoredAt: null, evaluationCount: 0 }),
      scores(12, 3, { lastScoredAt: 'not a time', evaluationCount: 0 }),
      scores(12, null),
      scores('12', 3),
      scores(12, '3'),
      scores(NaN, 3),
      scores(12, Infinity),
      { ...SCORED, currentScore: 12 },
    ]) {
      expect(deriveGameOutcome(record({ scoreState: s })).kind, JSON.stringify(s)).toBe(K.NO_SCORE);
    }
  });

  it('THE INTENTIONAL F4 EXCEPTION: a never-scored completion the server records as a draw is "No result" here', () => {
    // currentScore 0 (the initializer), no opponentScore, null lastScoredAt, evaluationCount 0, the completion entry present.
    const neverScored = record({ scoreState: { currentScore: 0, evaluationCount: 0, lastScoredAt: null } });
    expect(deriveGameOutcome(neverScored)).toEqual({ kind: K.NO_SCORE, mine: null, theirs: null });
  });

  it('completed without final evidence, scored pair: "Ended · no final result recorded", no verdict', () => {
    expect(deriveGameOutcome(record({ finalEvidence: false }))).toEqual({ kind: K.ENDED, mine: 12.5, theirs: 3.25 });
  });

  it('completed without final evidence or scoring: "No result"', () => {
    expect(deriveGameOutcome(record({ finalEvidence: false, scoreState: scores(0, 0, { lastScoredAt: null, evaluationCount: 0 }) })).kind).toBe(K.NO_RESULT);
    expect(deriveGameOutcome(record({ finalEvidence: false, scoreState: undefined })).kind).toBe(K.NO_RESULT);
  });

  it('a bare expiry later repaired: recomputed from the refreshed record — a verdict once evidence and a scored pair exist, else No result', () => {
    const bare = record({ finalEvidence: false });
    expect(deriveGameOutcome(bare).kind).toBe(K.ENDED);
    expect(deriveGameOutcome({ ...bare, finalEvidence: true }).kind).toBe(K.WON);
    const neverScored = record({ finalEvidence: false, scoreState: { currentScore: 0, evaluationCount: 0, lastScoredAt: null } });
    expect(deriveGameOutcome(neverScored).kind).toBe(K.NO_RESULT);
    expect(deriveGameOutcome({ ...neverScored, finalEvidence: true }).kind).toBe(K.NO_SCORE);
  });

  it('tournament: banked with scoring and a finite current score → "Day banked · no W/L", never compared with an opponent', () => {
    const t = record({ gameMode: 'baggerbomb_tournament', completionContext: BANKED_CONTEXT, scoreState: scores(7.5, 99) });
    expect(deriveGameOutcome(t)).toEqual({ kind: K.BANKED, mine: 7.5, theirs: null });
    expect(deriveGameOutcome({ ...t, finalEvidence: false }).kind).toBe(K.BANKED);
  });

  it('tournament lacking the banked context or scoring evidence → "No result"', () => {
    const t = record({ gameMode: 'baggerbomb_tournament', completionContext: BANKED_CONTEXT });
    expect(deriveGameOutcome({ ...t, completionContext: null }).kind).toBe(K.NO_RESULT);
    expect(deriveGameOutcome({ ...t, scoreState: scores(7.5, 1, { lastScoredAt: null, evaluationCount: 0 }) }).kind).toBe(K.NO_RESULT);
    expect(deriveGameOutcome({ ...t, scoreState: { ...SCORED, currentScore: null } }).kind).toBe(K.NO_RESULT);
  });

  it('a completion whose result is unavailable is "No result", whatever its stored frame says', () => {
    expect(deriveGameOutcome(record({ resultUnavailable: true })).kind).toBe(K.NO_RESULT);
  });

  it('nothing at all is no verdict', () => {
    expect(deriveGameOutcome(null).kind).toBe(K.ACTIVE);
    expect(deriveGameOutcome({ status: 'completed' }).kind).toBe(K.NO_RESULT);
  });
});

describe('a recorded timestamp\'s calendar and clock are real (review T4-3, T4-5)', () => {
  it.each([
    // the last day of every month, and the leap rule: every 4th year, not every 100th, but every 400th
    '2026-01-31T00:00:00Z', '2026-02-28T23:59:59.999Z', '2026-03-31T00:00:00Z', '2026-04-30T00:00:00Z', '2026-05-31T00:00:00Z', '2026-06-30T00:00:00Z',
    '2026-07-31T00:00:00Z', '2026-08-31T00:00:00Z', '2026-09-30T00:00:00Z', '2026-10-31T00:00:00Z', '2026-11-30T00:00:00Z', '2026-12-31T23:59:59Z',
    '2024-02-29T00:00:00Z', '2000-02-29T00:00:00Z', '2400-02-29T00:00:00Z',
    // what the writers produce, and the fields' own limits
    '2026-10-20T19:58:00.000Z', '2026-10-20T19:58:00.123456Z', '2026-10-20T19:58:00.123456789Z', '2026-10-20T15:58:00-04:00',
    '2026-10-20T15:58:00+23:59', '2026-10-20T23:59:59Z', '2026-10-20T23:59:00Z',
  ])('%s is a recorded timestamp', (value) => {
    expect(isRecordedTimestamp(value)).toBe(true);
  });

  it.each([
    // a day the calendar does not have
    '2026-02-29T00:00:00Z', '2026-02-30T00:00:00Z', '2026-02-31T00:00:00Z', '2026-04-31T00:00:00Z', '2026-06-31T00:00:00Z', '2026-09-31T00:00:00Z',
    '2026-11-31T00:00:00Z', '2100-02-29T00:00:00Z', '2026-01-32T00:00:00Z', '2026-10-00T00:00:00Z',
    // the clock's own limits
    '2026-10-20T24:00:00Z', '2026-10-20T23:60:00Z', '2026-10-20T23:59:60Z',
    // offsets out of range, and a fraction beyond nanoseconds
    '2026-10-20T15:58:00+24:00', '2026-10-20T15:58:00+05:60', '2026-10-20T15:58:00-23:60', '2026-10-20T19:58:00.1234567891Z',
  ])('%s is not', (value) => {
    expect(isRecordedTimestamp(value)).toBe(false);
  });

  it('a Firestore timestamp is real seconds from 2000 to the SDK\'s limit, and real nanoseconds', () => {
    expect(isRecordedTimestamp(new Timestamp(1792512000, 999999999))).toBe(true);
    expect(isRecordedTimestamp({ seconds: 1792512000, nanoseconds: 5 })).toBe(true);
    expect(isRecordedTimestamp({ seconds: 1792512000 })).toBe(true);
    expect(isRecordedTimestamp({ seconds: 946684800, nanoseconds: 0 })).toBe(true);
    expect(isRecordedTimestamp({ seconds: 946684799, nanoseconds: 999999999 })).toBe(false);
    expect(isRecordedTimestamp({ seconds: 253402300799, nanoseconds: 999999999 })).toBe(true);
    for (const t of [{ seconds: 86400, nanoseconds: 0 }, { seconds: 1, nanoseconds: 0 }, { seconds: 1e20, nanoseconds: 0 }, { seconds: 253402300800, nanoseconds: 0 },
      { seconds: 1792512000, nanoseconds: -5 }, { seconds: 1792512000, nanoseconds: 1e9 }, { seconds: 1792512000, nanoseconds: NaN },
      { seconds: 1792512000, nanoseconds: '5' }, { seconds: '1792512000' }, { seconds: NaN }, { seconds: -1 }]) {
      expect(isRecordedTimestamp(t), JSON.stringify(t)).toBe(false);
    }
  });

  it('an impossible date alone is no scoring evidence; a finite positive count still is', () => {
    expect(hasScoringEvidence({ lastScoredAt: '2026-02-31T00:00:00Z' })).toBe(false);
    expect(hasScoringEvidence({ lastScoredAt: '2026-02-31T00:00:00Z', evaluationCount: 3 })).toBe(true);
  });
});
