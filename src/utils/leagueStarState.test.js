// src/utils/leagueStarState.test.js
import { describe, it, expect } from 'vitest';
import { deriveStarState, deriveSettleState, SETTLE_STATE } from './leagueStarState';
import { CAPTURE_STATE, BASELINE_SOURCE } from '../constants/leagueTournament';

describe('deriveStarState — design states from the canonical ladders', () => {
  it('hit: a crossed bagger badge', () => {
    expect(deriveStarState({ multiplier: 1.05, badges: ['bagger'] })).toBe('hit');
  });
  it('hit: multiplier ≥ 1.0 even before the badge is recorded (boundary)', () => {
    expect(deriveStarState({ multiplier: 1.0, badges: [] })).toBe('hit');
  });
  it('busted: a crossed bust badge', () => {
    expect(deriveStarState({ multiplier: -1.1, badges: ['bust'] })).toBe('busted');
  });
  it('busted: multiplier ≤ -1.0 even before the badge (boundary)', () => {
    expect(deriveStarState({ multiplier: -1.0, badges: [] })).toBe('busted');
  });
  it('edge: positive red zone, no badge yet (75% to BaggerBomb)', () => {
    expect(deriveStarState({ multiplier: 0.85, badges: [] })).toBe('edge');
    expect(deriveStarState({ multiplier: 0.75, badges: [] })).toBe('edge'); // zone-start inclusive
  });
  it('danger: negative red zone, no badge yet (75% to Bust)', () => {
    expect(deriveStarState({ multiplier: -0.85, badges: [] })).toBe('danger');
  });
  it('heating: positive drift below the edge zone', () => {
    expect(deriveStarState({ multiplier: 0.4, badges: [] })).toBe('heating');
  });
  it('quiet: flat, and small negative wobble (not yet danger)', () => {
    expect(deriveStarState({ multiplier: 0, badges: [] })).toBe('quiet');
    expect(deriveStarState({ multiplier: -0.5, badges: [] })).toBe('quiet');
  });

  it('STICKY: crossed-then-reverted stays hit (badge present, multiplier back to 0.9)', () => {
    expect(deriveStarState({ multiplier: 0.9, badges: ['bagger'] })).toBe('hit');
  });

  it('NO RE-NEGATION: a short whose price fell yields a positive scorer multiplier → hit', () => {
    // calculateAssetScoreV3 already negated for the short; we receive +1.2 and must NOT flip it back.
    expect(deriveStarState({ multiplier: 1.2, badges: ['bagger'], direction: 'short' })).toBe('hit');
    expect(deriveStarState({ multiplier: 0.85, badges: [], direction: 'short' })).toBe('edge');
  });

  it('busted wins over a stale bagger when both badges are present (down-move is louder)', () => {
    expect(deriveStarState({ multiplier: 0.5, badges: ['bagger', 'bust'] })).toBe('busted');
  });

  it('busted via the multiplier FLOOR even with only a stale bagger badge (a popped star crashing)', () => {
    // No bust badge yet — the mult ≤ -1.0 clause must drive this, not the bagger badge.
    expect(deriveStarState({ multiplier: -1.5, badges: ['bagger'] })).toBe('busted');
  });

  it('defaults: missing/garbage input → quiet, never throws', () => {
    expect(deriveStarState()).toBe('quiet');
    expect(deriveStarState({ multiplier: NaN, badges: null })).toBe('quiet');
  });
});

// ── Phase 5 — the canonical-open SETTLEMENT axis (orthogonal to disposition) ──
describe('deriveSettleState — canonical-open settlement states', () => {
  const pick = (leg) => ({ symbol: 'NVDA', legs: [leg] });
  const openLeg = (over = {}) => ({ direction: 'long', baselinePrice: 100, thresholdHistory: [], ...over });
  const canon = { canonicalPolicy: true };

  it('LEGACY / absent policy → null (renders exactly as today, no new states)', () => {
    expect(deriveSettleState(pick(openLeg()), { canonicalPolicy: false })).toBeNull();
    expect(deriveSettleState(pick(openLeg({ captureState: CAPTURE_STATE.CAPTURED })))).toBeNull(); // default off
    // even a NO_ELIGIBLE_OPEN leg stays null under legacy — no void treatment
    expect(deriveSettleState(pick(openLeg({ baselinePrice: null, captureState: CAPTURE_STATE.NO_ELIGIBLE_OPEN })), { canonicalPolicy: false })).toBeNull();
  });

  it('PENDING: an open null-baseline leg (PENDING_OPEN or fresh) is awaiting the open', () => {
    expect(deriveSettleState(pick(openLeg({ baselinePrice: null, captureState: CAPTURE_STATE.PENDING_OPEN })), canon)).toBe(SETTLE_STATE.PENDING);
    expect(deriveSettleState(pick(openLeg({ baselinePrice: null, captureState: null })), canon)).toBe(SETTLE_STATE.PENDING);
    expect(deriveSettleState(pick(openLeg({ baselinePrice: null, baselineSource: BASELINE_SOURCE.CLAIM_EXECUTION })), canon)).toBe(SETTLE_STATE.PENDING);
  });

  it('VOID: a NO_ELIGIBLE_OPEN leg is terminal (wins over any baseline/day state)', () => {
    expect(deriveSettleState(pick(openLeg({ baselinePrice: null, captureState: CAPTURE_STATE.NO_ELIGIBLE_OPEN })), canon)).toBe(SETTLE_STATE.VOID);
    // even day-banked, a void stays void
    expect(deriveSettleState(pick(openLeg({ baselinePrice: null, captureState: CAPTURE_STATE.NO_ELIGIBLE_OPEN })), { canonicalPolicy: true, dayBanked: true })).toBe(SETTLE_STATE.VOID);
  });

  it('ESTIMATED: a captured open leg, today not yet banked, is the live provisional read', () => {
    expect(deriveSettleState(pick(openLeg({ captureState: CAPTURE_STATE.CAPTURED })), canon)).toBe(SETTLE_STATE.ESTIMATED);
    // an in-hours flip (real flip-price baseline, no captureState) is also live → estimated
    expect(deriveSettleState(pick(openLeg({ baselinePrice: 105, baselineSource: BASELINE_SOURCE.FLIP_MARKET_OPEN })), canon)).toBe(SETTLE_STATE.ESTIMATED);
  });

  it('OFFICIAL: a captured open leg flips to official once TODAY is banked', () => {
    expect(deriveSettleState(pick(openLeg({ captureState: CAPTURE_STATE.CAPTURED })), { canonicalPolicy: true, dayBanked: true })).toBe(SETTLE_STATE.OFFICIAL);
  });

  it('OFFICIAL: a fully-closed leg (no open leg) is official regardless of day-banked', () => {
    const closed = openLeg({ closedAt: '2026-06-10T20:00:00Z', bankedScore: 30, captureState: CAPTURE_STATE.CAPTURED });
    expect(deriveSettleState(pick(closed), canon)).toBe(SETTLE_STATE.OFFICIAL);
    expect(deriveSettleState(pick(closed), { canonicalPolicy: true, dayBanked: false })).toBe(SETTLE_STATE.OFFICIAL);
  });

  it('reads the LAST (live) leg of a flipped pick', () => {
    const flipped = { symbol: 'NVDA', legs: [
      { ...openLeg({ baselinePrice: 100, closedAt: 'T1', bankedScore: -5 }) },     // old closed leg
      openLeg({ baselinePrice: null, captureState: CAPTURE_STATE.PENDING_OPEN }),  // new live leg, pending
    ] };
    expect(deriveSettleState(flipped, canon)).toBe(SETTLE_STATE.PENDING);
  });

  it('empty / missing legs → null (never throws)', () => {
    expect(deriveSettleState({ legs: [] }, canon)).toBeNull();
    expect(deriveSettleState(null, canon)).toBeNull();
    expect(deriveSettleState(undefined)).toBeNull();
  });
});
