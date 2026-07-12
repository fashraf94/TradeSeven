// api/_utils/learning/detectorClassifiers.test.js
import { describe, it, expect } from 'vitest';
import {
  classifyD1, classifyD1DrAbstain, drNullReason, classifyD2, classifyD3Predicate,
  D1_CLASSES, D1_DR_NULL_REASONS, D2_CLASSES, D2_FAMILY_STATES, D3_COUNTING_SCOPES,
} from './detectorClassifiers.js';

// ════════════════════════════ D1 (ANNEX A2) ════════════════════════════
describe('classifyD1 — extension state', () => {
  const d1 = (pB, dR, d52) => classifyD1({ bbPercentB: pB, distanceToResistancePct: dR, distTo52wkHigh: d52 }).class;

  it('EXTENDED via ≥2 extended markers', () => {
    // pB≥0.95 (extended) + dR≤1.0 (extended); d52 neutral (1.0)
    expect(d1(0.96, 0.5, 1.0)).toBe(D1_CLASSES.EXTENDED);
  });

  it('EXTENDED via the severe marker alone (pB ≥ 1.00), even against 2 room markers', () => {
    // pB=1.00 severe; dR=4 (room), d52=3 (room). Disjointness: severe wins, no precedence rule.
    const r = classifyD1({ bbPercentB: 1.0, distanceToResistancePct: 4, distTo52wkHigh: 3 });
    expect(r.class).toBe(D1_CLASSES.EXTENDED);
    expect(r.severe).toBe(true);
    expect(r.roomMarkers).toBe(2); // room markers present but ROOM cannot fire (≥1 extended marker exists)
  });

  it('ROOM via ≥2 room markers AND zero extended markers', () => {
    // pB=0.80 (room), dR=4 (room), d52=3 (room) → 3 room, 0 extended
    expect(d1(0.80, 4, 3)).toBe(D1_CLASSES.ROOM);
    // exactly 2 room, 0 extended, third neutral
    expect(d1(0.80, 4, 1.0)).toBe(D1_CLASSES.ROOM); // d52=1.0 neither (not ≤0.5, not ≥2)
  });

  it('INDETERMINATE with 1 extended + 1 room', () => {
    // pB=0.96 (extended), dR=4 (room), d52=1.0 (neutral) → 1 extended, 1 room
    expect(d1(0.96, 4, 1.0)).toBe(D1_CLASSES.INDETERMINATE);
  });

  it('INDETERMINATE with a single extended marker', () => {
    expect(d1(0.96, 2.0, 1.0)).toBe(D1_CLASSES.INDETERMINATE); // dR=2 neutral, d52=1 neutral
  });

  it('UNSCORABLE if any of pB, dR, d52 is null', () => {
    expect(d1(null, 0.5, 0.5)).toBe(D1_CLASSES.UNSCORABLE);
    expect(d1(0.96, null, 0.5)).toBe(D1_CLASSES.UNSCORABLE);
    expect(d1(0.96, 0.5, null)).toBe(D1_CLASSES.UNSCORABLE);
  });

  it('UNSCORABLE (fail closed) on NaN / ±Infinity — never coerced to 0', () => {
    expect(d1(NaN, 0.5, 0.5)).toBe(D1_CLASSES.UNSCORABLE);
    expect(d1(Infinity, 0.5, 0.5)).toBe(D1_CLASSES.UNSCORABLE);
    expect(d1(0.96, -Infinity, 0.5)).toBe(D1_CLASSES.UNSCORABLE);
    // Proof it isn't coerced to 0: 0 for all would be ROOM (pB≤0.85, dR... 0≤1 extended). NaN must NOT behave like 0.
    expect(d1('x', 0.5, 0.5)).toBe(D1_CLASSES.UNSCORABLE); // wrong type → corrupt → UNSCORABLE
  });

  it('boundary operators are inclusive — exact equality satisfies (full precision)', () => {
    // pB=0.95 fires extended; dR=1.0 fires extended → 2 extended → EXTENDED
    expect(d1(0.95, 1.0, 5)).toBe(D1_CLASSES.EXTENDED);
    // pB=0.85 fires room; dR=3.0 fires room; d52=2.0 fires room → 3 room, 0 extended → ROOM
    expect(d1(0.85, 3.0, 2.0)).toBe(D1_CLASSES.ROOM);
    // pB=1.00 exactly → severe → EXTENDED
    expect(classifyD1({ bbPercentB: 1.0, distanceToResistancePct: 5, distTo52wkHigh: 5 }).severe).toBe(true);
    // d52=0.5 exactly fires the extended marker
    expect(d1(0.90, 2.0, 0.5)).toBe(D1_CLASSES.INDETERMINATE); // 1 extended (d52), nothing else
  });
});

// ════════════════════ D1 dR-abstain variant (Phase A.5) ════════════════════
describe('classifyD1DrAbstain — null dR abstains (measurement, not adoption)', () => {
  const abstain = (pB, dR, d52) => classifyD1DrAbstain({ bbPercentB: pB, distanceToResistancePct: dR, distTo52wkHigh: d52 }).class;
  const specced = (pB, dR, d52) => classifyD1({ bbPercentB: pB, distanceToResistancePct: dR, distTo52wkHigh: d52 }).class;

  it('dR present → identical to the as-specced classifier (delegates)', () => {
    // Sweep a range of present-dR inputs; abstain must equal as-specced exactly.
    for (const pB of [0.5, 0.86, 0.96, 1.01]) {
      for (const dR of [0.5, 1.0, 2.0, 3.0, 5.0]) {
        for (const d52 of [0.4, 1.0, 2.0, 6.0]) {
          expect(abstain(pB, dR, d52), `${pB}/${dR}/${d52}`).toBe(specced(pB, dR, d52));
        }
      }
    }
  });

  it('dR null + both remaining extended markers fire → EXTENDED (2-of-2)', () => {
    expect(abstain(0.96, null, 0.4)).toBe(D1_CLASSES.EXTENDED);
  });

  it('THE ASYMMETRY: dR null + only one remaining extended → INDETERMINATE (as-specced with a firing dR would be EXTENDED)', () => {
    // pB extended, d52 neutral. As-specced with dR=0.5 (extended) → 2 markers → EXTENDED.
    expect(specced(0.96, 0.5, 1.0)).toBe(D1_CLASSES.EXTENDED);
    // Abstain drops the dR marker → only 1 extended → INDETERMINATE. This is the
    // lower-evidence-bar concern the measurement exists to expose (M3).
    expect(abstain(0.96, null, 1.0)).toBe(D1_CLASSES.INDETERMINATE);
  });

  it('dR null + severe (pB ≥ 1.00) → EXTENDED (severe path unaffected by dR)', () => {
    expect(abstain(1.0, null, 5.0)).toBe(D1_CLASSES.EXTENDED);
  });

  it('dR null + both remaining room markers, zero extended → ROOM', () => {
    expect(abstain(0.80, null, 3.0)).toBe(D1_CLASSES.ROOM);
  });

  it('dR null + only one remaining room marker → INDETERMINATE', () => {
    expect(abstain(0.80, null, 1.0)).toBe(D1_CLASSES.INDETERMINATE); // d52=1.0 neither
  });

  it('dR CORRUPT (NaN/±∞) still → UNSCORABLE in abstain mode (abstain forgives null ONLY)', () => {
    expect(abstain(0.96, NaN, 0.4)).toBe(D1_CLASSES.UNSCORABLE);
    expect(abstain(0.96, Infinity, 0.4)).toBe(D1_CLASSES.UNSCORABLE);
    expect(abstain(0.96, 'x', 0.4)).toBe(D1_CLASSES.UNSCORABLE);
  });

  it('pB or d52 null/corrupt still → UNSCORABLE even with dR abstained', () => {
    expect(abstain(null, null, 0.4)).toBe(D1_CLASSES.UNSCORABLE);
    expect(abstain(0.96, null, null)).toBe(D1_CLASSES.UNSCORABLE);
    expect(abstain(NaN, null, 0.4)).toBe(D1_CLASSES.UNSCORABLE);
  });
});

describe('drNullReason — blue-sky vs ambiguous (the partial split)', () => {
  it('dR present → present (regardless of support)', () => {
    expect(drNullReason({ distanceToResistancePct: 2.0, nearestSupport: null })).toBe(D1_DR_NULL_REASONS.PRESENT);
    expect(drNullReason({ distanceToResistancePct: 0, nearestSupport: 150 })).toBe(D1_DR_NULL_REASONS.PRESENT);
  });

  it('dR null + support present → blue_sky (structure exists, nothing overhead)', () => {
    expect(drNullReason({ distanceToResistancePct: null, nearestSupport: 173.75 })).toBe(D1_DR_NULL_REASONS.BLUE_SKY);
  });

  it('dR null + no support → ambiguous (the irreducible O1/O2/O4 region)', () => {
    expect(drNullReason({ distanceToResistancePct: null, nearestSupport: null })).toBe(D1_DR_NULL_REASONS.AMBIGUOUS);
    expect(drNullReason({ distanceToResistancePct: null, nearestSupport: undefined })).toBe(D1_DR_NULL_REASONS.AMBIGUOUS);
  });

  it('never throws on malformed input', () => {
    expect(() => drNullReason()).not.toThrow();
    expect(drNullReason()).toBe(D1_DR_NULL_REASONS.AMBIGUOUS);
  });
});

// ════════════════════════════ D2 (ANNEX A3) ════════════════════════════
describe('classifyD2 — volume/momentum confirmation, three-state families', () => {
  const d2 = (o) => classifyD2(o);

  it('CONFIRMED = volume PASS + momentum PASS', () => {
    const r = d2({ volumeRatio: 2.0, upDayVolRatio: 0.9, macdAboveSignal: true });
    expect(r.class).toBe(D2_CLASSES.CONFIRMED);
    expect(r.volume).toBe(D2_FAMILY_STATES.PASS);
    expect(r.momentum).toBe(D2_FAMILY_STATES.PASS);
  });

  it('UNCONFIRMED = volume FAIL + momentum FAIL (every member present, none passes)', () => {
    const r = d2({ volumeRatio: 1.0, upDayVolRatio: 1.0, macdAboveSignal: false });
    expect(r.class).toBe(D2_CLASSES.UNCONFIRMED);
    expect(r.volume).toBe(D2_FAMILY_STATES.FAIL);
    expect(r.momentum).toBe(D2_FAMILY_STATES.FAIL);
  });

  it('INDETERMINATE = (PASS, FAIL) and (FAIL, PASS)', () => {
    expect(d2({ volumeRatio: 2.0, upDayVolRatio: 1.0, macdAboveSignal: false }).class).toBe(D2_CLASSES.INDETERMINATE);
    expect(d2({ volumeRatio: 1.0, upDayVolRatio: 1.0, macdAboveSignal: true }).class).toBe(D2_CLASSES.INDETERMINATE);
  });

  it('volume PASS when one member is null but the observed member passes', () => {
    const r = d2({ volumeRatio: null, upDayVolRatio: 1.5, macdAboveSignal: true });
    expect(r.volume).toBe(D2_FAMILY_STATES.PASS);
    expect(r.class).toBe(D2_CLASSES.CONFIRMED);
  });

  it('volume UNKNOWN when a member is null and the observed member fails → UNSCORABLE', () => {
    const r = d2({ volumeRatio: null, upDayVolRatio: 1.0, macdAboveSignal: true });
    expect(r.volume).toBe(D2_FAMILY_STATES.UNKNOWN);
    expect(r.class).toBe(D2_CLASSES.UNSCORABLE);
  });

  it('momentum UNKNOWN (macd null) → UNSCORABLE regardless of volume', () => {
    expect(d2({ volumeRatio: 2.0, upDayVolRatio: 2.0, macdAboveSignal: null }).class).toBe(D2_CLASSES.UNSCORABLE);
    expect(d2({ volumeRatio: 1.0, upDayVolRatio: 1.0, macdAboveSignal: null }).class).toBe(D2_CLASSES.UNSCORABLE);
  });

  it('both volume members null → volume UNKNOWN → UNSCORABLE', () => {
    expect(d2({ volumeRatio: null, upDayVolRatio: null, macdAboveSignal: true }).class).toBe(D2_CLASSES.UNSCORABLE);
  });

  it('fail closed (UNSCORABLE) on NaN/±∞/wrong-type inputs — never coerced', () => {
    expect(d2({ volumeRatio: NaN, upDayVolRatio: 1.0, macdAboveSignal: true }).class).toBe(D2_CLASSES.UNSCORABLE);
    expect(d2({ volumeRatio: 2.0, upDayVolRatio: Infinity, macdAboveSignal: true }).class).toBe(D2_CLASSES.UNSCORABLE);
    expect(d2({ volumeRatio: 2.0, upDayVolRatio: 2.0, macdAboveSignal: 'yes' }).class).toBe(D2_CLASSES.UNSCORABLE);
  });

  it('macdFreshBullishCross is a STRENGTH TIER on a passing momentum vote — never a vote', () => {
    const base = { volumeRatio: 2.0, upDayVolRatio: 0.9, macdAboveSignal: true };
    const without = d2({ ...base, macdFreshBullishCross: false });
    const withFresh = d2({ ...base, macdFreshBullishCross: true });
    // Class identical — strength never changes classification.
    expect(withFresh.class).toBe(without.class);
    expect(withFresh.momentumStrength).toBe('fresh_bullish_cross');
    expect(without.momentumStrength).toBeNull();
    // Fresh cross on a FAILING momentum vote is NOT a vote and yields no strength.
    const momFail = d2({ volumeRatio: 2.0, upDayVolRatio: 0.9, macdAboveSignal: false, macdFreshBullishCross: true });
    expect(momFail.momentumStrength).toBeNull();
    expect(momFail.class).toBe(D2_CLASSES.INDETERMINATE); // vol PASS, mom FAIL
  });

  it('boundary operators inclusive: ratio=1.5 and upDayVolRatio=1.2 pass', () => {
    expect(d2({ volumeRatio: 1.5, upDayVolRatio: 0.9, macdAboveSignal: true }).volume).toBe(D2_FAMILY_STATES.PASS);
    expect(d2({ volumeRatio: 1.0, upDayVolRatio: 1.2, macdAboveSignal: true }).volume).toBe(D2_FAMILY_STATES.PASS);
  });

  describe('intraday volume.ratio is a placeholder → relabeled MISSING (bar-basis fix)', () => {
    it('intraday: volume family resolves off upDayVolRatio alone; the ~1.0 ratio is ignored', () => {
      // upDay passes → PASS regardless of the placeholder value.
      expect(d2({ dataMode: 'intraday', volumeRatio: 1.0, upDayVolRatio: 1.5, macdAboveSignal: true }))
        .toMatchObject({ volume: D2_FAMILY_STATES.PASS, class: D2_CLASSES.CONFIRMED });
      // upDay fails → the missing member could have flipped it → UNKNOWN → UNSCORABLE.
      expect(d2({ dataMode: 'intraday', volumeRatio: 1.0, upDayVolRatio: 1.0, macdAboveSignal: true }))
        .toMatchObject({ volume: D2_FAMILY_STATES.UNKNOWN, class: D2_CLASSES.UNSCORABLE });
      // upDay null → both volume members missing → UNKNOWN → UNSCORABLE.
      expect(d2({ dataMode: 'intraday', volumeRatio: 1.0, upDayVolRatio: null, macdAboveSignal: true }))
        .toMatchObject({ volume: D2_FAMILY_STATES.UNKNOWN, class: D2_CLASSES.UNSCORABLE });
    });

    it('intraday: even a nominally-passing volume.ratio (≥1.5) is ignored (it is not a real observation)', () => {
      // A stray ≥1.5 placeholder must not manufacture a volume PASS either.
      const r = d2({ dataMode: 'intraday', volumeRatio: 2.0, upDayVolRatio: 1.0, macdAboveSignal: true });
      expect(r.volume).toBe(D2_FAMILY_STATES.UNKNOWN); // upDay fails, ratio missing → UNKNOWN
      expect(r.class).toBe(D2_CLASSES.UNSCORABLE);
    });

    it('pre-market and unlabeled inputs are UNCHANGED (regression guard)', () => {
      const base = { volumeRatio: 1.0, upDayVolRatio: 1.0, macdAboveSignal: false };
      expect(d2({ ...base, dataMode: 'premarket' }).volume).toBe(D2_FAMILY_STATES.FAIL);
      expect(d2(base).volume).toBe(D2_FAMILY_STATES.FAIL); // no dataMode → observed, as before
      // A non-intraday label other than premarket also leaves it observed.
      expect(d2({ ...base, dataMode: 'unknown' }).volume).toBe(D2_FAMILY_STATES.FAIL);
    });
  });
});

// ════════════════════════════ D3 (ANNEX A4) ════════════════════════════
describe('classifyD3Predicate — chop AND churn-state opportunity', () => {
  const AGENT = 'agent-1';
  const BATTLE = 'battle-1';
  const W = 30 * 60 * 1000; // 30 min — an INJECTED value for tests; the real W is uncalibrated.

  function swap(ts, seq, exitReason = 'haiku_decision', over = {}) {
    return { agentId: AGENT, battleId: BATTLE, timestamp: ts, receiptSeq: seq, exitReason, ...over };
  }

  const decision = { agentId: AGENT, battleId: BATTLE, timestamp: 1_000_000, receiptSeq: 100 };

  it('chop iff outgoing regime === choppy', () => {
    const base = { decision, priorSwaps: [], windowMs: W };
    expect(classifyD3Predicate({ ...base, outgoingRegime: 'choppy' }).chop).toBe(true);
    expect(classifyD3Predicate({ ...base, outgoingRegime: 'directional_expansion' }).chop).toBe(false);
    expect(classifyD3Predicate({ ...base, outgoingRegime: null }).chop).toBe(false);
  });

  it('churn qualifies iff ≥2 prior allowlisted discretionary swaps in (t−W, t)', () => {
    const priorSwaps = [
      swap(1_000_000 - 5 * 60 * 1000, 98), // in window
      swap(1_000_000 - 10 * 60 * 1000, 97), // in window
    ];
    const r = classifyD3Predicate({ outgoingRegime: 'choppy', decision, priorSwaps, windowMs: W });
    expect(r.churnCount).toBe(2);
    expect(r.churnState).toBe(true);
    expect(r.opportunity).toBe(true); // chop AND churn
  });

  it('opportunity is chop AND churn — chop without churn is NOT an opportunity', () => {
    const one = [swap(1_000_000 - 5 * 60 * 1000, 98)];
    const r = classifyD3Predicate({ outgoingRegime: 'choppy', decision, priorSwaps: one, windowMs: W });
    expect(r.churnState).toBe(false);
    expect(r.opportunity).toBe(false);
  });

  it('only ALLOWLISTED discretionary (haiku_decision) swaps count — guardrail_* excluded', () => {
    const priorSwaps = [
      swap(1_000_000 - 1 * 60 * 1000, 99, 'guardrail_stopLoss'),
      swap(1_000_000 - 2 * 60 * 1000, 98, 'guardrail_trailingStop'),
      swap(1_000_000 - 3 * 60 * 1000, 97, 'stagnation'),
      swap(1_000_000 - 4 * 60 * 1000, 96, 'haiku_decision'), // the only one that counts
    ];
    const r = classifyD3Predicate({ outgoingRegime: 'choppy', decision, priorSwaps, windowMs: W });
    expect(r.churnCount).toBe(1);
  });

  it('fail closed: an out-of-enum exitReason in priorSwaps does not count', () => {
    const priorSwaps = [swap(1_000_000 - 60_000, 99, 'HAIKU_DECISION'), swap(1_000_000 - 61_000, 98, 'unknown')];
    expect(classifyD3Predicate({ outgoingRegime: 'choppy', decision, priorSwaps, windowMs: W }).churnCount).toBe(0);
  });

  it('lower bound is OPEN at (t − W): a swap exactly at t−W is excluded', () => {
    const atEdge = [swap(1_000_000 - W, 98), swap(1_000_000 - W + 1, 97)];
    expect(classifyD3Predicate({ outgoingRegime: 'choppy', decision, priorSwaps: atEdge, windowMs: W }).churnCount).toBe(1);
  });

  it('ties: same timestamp counts only when receiptSeq is strictly prior', () => {
    const sameTs = [
      swap(1_000_000, 99), // same instant, earlier seq → counts (strictly prior)
      swap(1_000_000, 100), // same instant, same seq → NOT strictly prior → excluded
      swap(1_000_000, 101), // same instant, later seq → excluded
    ];
    expect(classifyD3Predicate({ outgoingRegime: 'choppy', decision, priorSwaps: sameTs, windowMs: W }).churnCount).toBe(1);
  });

  it('a swap strictly AFTER the decision is never counted', () => {
    const future = [swap(1_000_000 + 60_000, 101), swap(1_000_000 - 60_000, 99)];
    expect(classifyD3Predicate({ outgoingRegime: 'choppy', decision, priorSwaps: future, windowMs: W }).churnCount).toBe(1);
  });

  it('counting scope: SAME_AGENT_SAME_BATTLE (default) excludes other battles', () => {
    const priorSwaps = [
      swap(1_000_000 - 60_000, 99, 'haiku_decision', { battleId: 'other-battle' }),
      swap(1_000_000 - 61_000, 98, 'haiku_decision', { battleId: 'other-battle' }),
    ];
    const r = classifyD3Predicate({ outgoingRegime: 'choppy', decision, priorSwaps, windowMs: W });
    expect(r.churnCount).toBe(0);
    expect(r.countingScope).toBe(D3_COUNTING_SCOPES.SAME_AGENT_SAME_BATTLE);
  });

  it('counting scope: SAME_AGENT_GLOBAL counts across battles (open contract, injected)', () => {
    const priorSwaps = [
      swap(1_000_000 - 60_000, 99, 'haiku_decision', { battleId: 'other-battle' }),
      swap(1_000_000 - 61_000, 98, 'haiku_decision', { battleId: 'another-battle' }),
    ];
    const r = classifyD3Predicate({
      outgoingRegime: 'choppy', decision, priorSwaps, windowMs: W,
      countingScope: D3_COUNTING_SCOPES.SAME_AGENT_GLOBAL,
    });
    expect(r.churnCount).toBe(2);
  });

  it('always excludes other AGENTS (both scopes)', () => {
    const priorSwaps = [
      swap(1_000_000 - 60_000, 99, 'haiku_decision', { agentId: 'agent-2' }),
      swap(1_000_000 - 61_000, 98, 'haiku_decision', { agentId: 'agent-2' }),
    ];
    expect(classifyD3Predicate({
      outgoingRegime: 'choppy', decision, priorSwaps, windowMs: W,
      countingScope: D3_COUNTING_SCOPES.SAME_AGENT_GLOBAL,
    }).churnCount).toBe(0);
  });

  it('W is REQUIRED and injected — throws when absent or non-positive (never hardcoded/derived)', () => {
    expect(() => classifyD3Predicate({ outgoingRegime: 'choppy', decision, priorSwaps: [] })).toThrow(/windowMs/);
    expect(() => classifyD3Predicate({ outgoingRegime: 'choppy', decision, priorSwaps: [], windowMs: 0 })).toThrow(/windowMs/);
    expect(() => classifyD3Predicate({ outgoingRegime: 'choppy', decision, priorSwaps: [], windowMs: -1 })).toThrow(/windowMs/);
    expect(() => classifyD3Predicate({ outgoingRegime: 'choppy', decision, priorSwaps: [], windowMs: NaN })).toThrow(/windowMs/);
  });

  it('rejects an unknown counting scope', () => {
    expect(() => classifyD3Predicate({ outgoingRegime: 'choppy', decision, priorSwaps: [], windowMs: W, countingScope: 'global' }))
      .toThrow(/countingScope/);
  });

  it('returns a class label + components, never a number-from-labels (scope line)', () => {
    const r = classifyD3Predicate({ outgoingRegime: 'choppy', decision, priorSwaps: [], windowMs: W });
    expect(Object.keys(r).sort()).toEqual(['chop', 'churnCount', 'churnState', 'countingScope', 'opportunity', 'windowMs'].sort());
    expect(typeof r.opportunity).toBe('boolean'); // a label, not a regret/estimate
  });
});
