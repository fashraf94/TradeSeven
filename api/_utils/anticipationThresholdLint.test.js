// api/_utils/anticipationThresholdLint.test.js
//
// THE THRESHOLD LINT — the pure module (rows A-1, A-2).
//
// The fixtures are the FOUR SEP 14 THRESHOLDS VERBATIM, quoted from
// docs/audits/20260915_PHASE0_SIGNAL_LANGUAGE.md §5 ("Reading the four quoted
// thresholds against the table") — the only in-tree record of those sentences;
// the battle doc itself is in Firestore, not the repo. The present-signals map
// is reconstructed from that tick's own record: `vwapDev: null` on every held
// name (the freshness gate closed on every check), QCOM on the BENCH and CRWD
// HELD after the swap.
//
// Every row shows its guard failing under the defect it names. The mutation
// block is the BUILD_RULES §2 "a row that cannot fail is not a guard" check,
// run against the REAL matcher with one vocabulary row deleted — never against
// a copy of the matching logic.

import { describe, it, expect } from 'vitest';
import {
  SIGNAL_NAMES,
  NEVER_PRESENT_SIGNALS,
  THRESHOLD_SIGNAL_VOCABULARY,
  buildPresentSignals,
  lintThreshold,
  namedSignals,
} from './anticipationThresholdLint.js';

// ---------------------------------------------------------------------------
// The Sep 14 tick, reconstructed
// ---------------------------------------------------------------------------

const HELD = ['CRWD', 'NVDA'];
const BENCH = ['QCOM'];

/**
 * The tick as the record has it: the intraday map EMPTY (every held name's
 * `evidence[sym].vwapDev` is null, so no held symbol passed the freshness
 * gate), rankings rows present for the held names, a full bench technical doc
 * for QCOM.
 */
function sep14Tick(overrides = {}) {
  return buildPresentSignals({
    momentumData: {
      vwap: {},                                  // the gate published nothing
      regimes: { CRWD: 'choppy', NVDA: 'directional_expansion' },
    },
    rankingsMap: {
      CRWD: { bBandwidthPercentile: 34, nr7Flag: false, levels: { nearestResistance: 181.62 } },
      NVDA: { bBandwidthPercentile: 15, nr7Flag: true },
      QCOM: { levels: { nearestSupport: 171.4, nearestResistance: 181.62 } },
    },
    techScoresMap: {
      QCOM: {
        bbPercentB: 0.62,
        volumeProfile: { tier: 'high', ratio: 1.34 },
        factors: { rsi: 71, macdAboveSignal: true, rsPercentile: 78 },
      },
    },
    heldSymbols: HELD,
    benchSymbols: BENCH,
    ...overrides,
  });
}

// The four sentences, verbatim from Phase 0 §5.
const SEP14 = {
  vwapAndRsi: "holds above the daily VWAP and the RSI pulls back below 75, I'd consider rotating it into Core",
  vwapAndMacd5m: 'QCOM holds above the daily VWAP and the 5-minute MACD shows a positive histogram signal (S12), and RSI pulls back below 75 (S10)',
  levelsAndRvol: 'QCOM breaks above 181.62 resistance and RVOL sustains above 1.2x',
  atr: 'CRWD falls below -0.5x ATR (approximately -$118.72)',
};

// ---------------------------------------------------------------------------
// A-1 — lintThreshold against the four Sep 14 thresholds
// ---------------------------------------------------------------------------

describe('A-1 — the four Sep 14 thresholds (Phase 0 §5), against that tick\'s own present-signals map', () => {
  it('#1 "holds above the daily VWAP and the RSI pulls back below 75" (QCOM, BENCH) → absent: [VWAP] — RSI IS present for a bench name', () => {
    const present = sep14Tick();
    expect(present.get('QCOM').has(SIGNAL_NAMES.RSI)).toBe(true);
    expect(lintThreshold({ threshold: SEP14.vwapAndRsi, symbol: 'QCOM', present }))
      .toEqual({ ok: false, absent: ['VWAP'] });
  });

  it('#2 "…and the 5-minute MACD shows a positive histogram signal (S12)…" (QCOM, BENCH) → absent: [VWAP, MACD_5M]', () => {
    const present = sep14Tick();
    // the daily MACD cross IS rendered for a bench name — the 5-minute
    // histogram is a different signal, and is on no path at all
    expect(present.get('QCOM').has(SIGNAL_NAMES.MACD_CROSS)).toBe(true);
    expect(lintThreshold({ threshold: SEP14.vwapAndMacd5m, symbol: 'QCOM', present }))
      .toEqual({ ok: false, absent: ['VWAP', 'MACD_5M'] });
  });

  it('#3 "breaks above 181.62 resistance and RVOL sustains above 1.2x" (QCOM, BENCH) → ok: levels and RVOL are both rendered for bench', () => {
    const present = sep14Tick();
    expect(present.get('QCOM').has(SIGNAL_NAMES.RVOL)).toBe(true);
    expect(lintThreshold({ threshold: SEP14.levelsAndRvol, symbol: 'QCOM', present })).toEqual({ ok: true });
  });

  it('#4 "falls below -0.5x ATR (approximately -$118.72)" (CRWD, HELD) → ok: the ATR multiple is on every held row', () => {
    const present = sep14Tick();
    expect(present.get('CRWD').has(SIGNAL_NAMES.ATR)).toBe(true);
    expect(lintThreshold({ threshold: SEP14.atr, symbol: 'CRWD', present })).toEqual({ ok: true });
  });

  it('THE CLASS ASYMMETRY: the same RSI sentence against a HELD symbol → absent: [VWAP, RSI]', () => {
    const present = sep14Tick();
    // techScoresMap is consumed only by the bench block, so a held name has no
    // RSI at all — the "rotate it into Core" case in Phase 0 §5.
    expect(present.get('CRWD').has(SIGNAL_NAMES.RSI)).toBe(false);
    expect(lintThreshold({ threshold: SEP14.vwapAndRsi, symbol: 'CRWD', present }))
      .toEqual({ ok: false, absent: ['VWAP', 'RSI'] });
  });

  it('and RSI alone against a HELD symbol → absent: [RSI]', () => {
    const present = sep14Tick();
    expect(lintThreshold({ threshold: 'the RSI pulls back below 75', symbol: 'CRWD', present }))
      .toEqual({ ok: false, absent: ['RSI'] });
  });

  it('VWAP is accepted for a held name on a tick the gate DID open — the lint reads this tick, not a policy', () => {
    const present = buildPresentSignals({
      momentumData: { vwap: { CRWD: { vwapDeviation: 0.42 } } },
      heldSymbols: HELD,
      benchSymbols: BENCH,
    });
    expect(lintThreshold({ threshold: 'If CRWD holds above the daily VWAP', symbol: 'CRWD', present })).toEqual({ ok: true });
    // …and still absent for the bench name, where the intraday fetch never looked
    expect(lintThreshold({ threshold: 'If QCOM holds above the daily VWAP', symbol: 'QCOM', present }))
      .toEqual({ ok: false, absent: ['VWAP'] });
  });

  it('a symbol the tick rendered nothing for has an empty set — every named signal is absent', () => {
    const present = sep14Tick();
    expect(present.has('ZZZZ')).toBe(false);
    expect(lintThreshold({ threshold: SEP14.vwapAndRsi, symbol: 'ZZZZ', present }))
      .toEqual({ ok: false, absent: ['VWAP', 'RSI'] });
  });

  it('a candidate that promises nothing cannot promise falsely (null / empty / non-string thresholds are ok)', () => {
    const present = sep14Tick();
    for (const threshold of [null, undefined, '', 42, {}]) {
      expect(lintThreshold({ threshold, symbol: 'CRWD', present })).toEqual({ ok: true });
    }
    // a specific, checkable sentence that names no vocabulary signal is ok too
    expect(lintThreshold({ threshold: 'If it closes red for two straight checks', symbol: 'CRWD', present })).toEqual({ ok: true });
  });

  it('REJECT, NEVER REWRITE: the lint returns a verdict and a list — it never returns a threshold', () => {
    const present = sep14Tick();
    const verdict = lintThreshold({ threshold: SEP14.vwapAndMacd5m, symbol: 'QCOM', present });
    expect(Object.keys(verdict).sort()).toEqual(['absent', 'ok']);
    expect(JSON.stringify(verdict)).not.toContain('VWAP and the 5-minute');
  });

  it('the 5-minute rows take precedence over the general ones — "(not 5-minute)" is encoded as match order', () => {
    expect(namedSignals('the 5-minute MACD shows a positive histogram signal')).toEqual(['MACD_5M']);
    expect(namedSignals('if the 5-min RSI crosses 50')).toEqual(['RSI_5M']);
    expect(namedSignals('if it reclaims the 5-minute VWAP')).toEqual(['VWAP_5M']);
    // the daily forms still resolve to the daily signals
    expect(namedSignals('if MACD crosses above its signal line')).toEqual(['MACD_CROSS']);
    expect(namedSignals('if RSI clears 50')).toEqual(['RSI']);
    expect(namedSignals('if it holds the daily VWAP')).toEqual(['VWAP']);
    // both forms in one sentence: both named, in declaration order
    expect(namedSignals('above the daily VWAP and below the 5-minute VWAP')).toEqual(['VWAP', 'VWAP_5M']);
  });

  it('`absent` is emitted in the vocabulary\'s declaration order and is deduped', () => {
    const present = sep14Tick();
    const out = lintThreshold({
      threshold: 'VWAP holds, RVOL sustains, the RSI pulls back, VWAP again, and the 5-minute MACD turns',
      symbol: 'CRWD',
      present,
    });
    expect(out.absent).toEqual(['VWAP', 'MACD_5M', 'RVOL', 'RSI']);
  });

  it('matching is case-insensitive', () => {
    expect(namedSignals('holds above the daily vwap')).toEqual(['VWAP']);
    expect(namedSignals('if rvol sustains')).toEqual(['RVOL']);
    expect(namedSignals('if RSPERCENTILE clears 80')).toEqual(['RS_PERCENTILE']);
  });
});

// ---------------------------------------------------------------------------
// A-1 mutation check — every vocabulary row must be killable
// ---------------------------------------------------------------------------

// One fixture per row: a sentence that is RED today BECAUSE of that row, and
// that goes wrongly GREEN when only that row is deleted. `class` picks the
// symbol whose present set makes the mutant green.
const ROW_KILLERS = [
  { signal: 'VWAP', symbol: 'QCOM', threshold: 'holds above the daily VWAP' },
  { signal: 'MACD_5M', symbol: 'QCOM', threshold: 'the 5-minute MACD shows a positive histogram signal' },
  { signal: 'RSI_5M', symbol: 'QCOM', threshold: 'if the 5-minute RSI crosses back above 50' },
  { signal: 'VWAP_5M', symbol: 'CRWD', threshold: 'if it reclaims the 5-minute VWAP' },
  { signal: 'RVOL', symbol: 'CRWD', threshold: 'and RVOL sustains above 1.2x' },
  { signal: 'RSI', symbol: 'CRWD', threshold: 'the RSI pulls back below 75' },
  { signal: 'SMA_20_LEVEL', symbol: 'CRWD', threshold: 'If it holds above the 20-day on the next test' },
  { signal: 'MACD_CROSS', symbol: 'CRWD', threshold: 'if MACD crosses above its signal line' },
  { signal: 'BB_PCT_B', symbol: 'CRWD', threshold: 'if %B pushes above 0.8' },
  { signal: 'RS_PERCENTILE', symbol: 'CRWD', threshold: 'if rsPercentile clears 80' },
];

describe('A-1 mutation — deleting any single vocabulary row makes its fixture go wrongly green', () => {
  it('the killer table covers every shipped row, one for one', () => {
    expect(ROW_KILLERS.map((k) => k.signal)).toEqual(THRESHOLD_SIGNAL_VOCABULARY.map((r) => r.signal));
  });

  for (const killer of ROW_KILLERS) {
    it(`${killer.signal}: red today, green with the row deleted`, () => {
      // The VWAP_5M killer needs the held name to HAVE a VWAP reading, so that
      // deleting the 5-minute row lets the general VWAP row pass it.
      const present = killer.signal === 'VWAP_5M'
        ? sep14Tick({ momentumData: { vwap: { CRWD: { vwapDeviation: 0.42 } }, regimes: {} } })
        : sep14Tick();

      expect(lintThreshold({ threshold: killer.threshold, symbol: killer.symbol, present }))
        .toEqual({ ok: false, absent: [killer.signal] });

      const mutant = THRESHOLD_SIGNAL_VOCABULARY.filter((r) => r.signal !== killer.signal);
      expect(mutant).toHaveLength(THRESHOLD_SIGNAL_VOCABULARY.length - 1);
      expect(lintThreshold({ threshold: killer.threshold, symbol: killer.symbol, present, vocabulary: mutant }))
        .toEqual({ ok: true });
    });
  }
});

// ---------------------------------------------------------------------------
// A-2 — buildPresentSignals against Phase 0 §5's table
// ---------------------------------------------------------------------------

/** One held symbol carrying every held-class reading, and one carrying none. */
function heldFixture() {
  return buildPresentSignals({
    momentumData: {
      vwap: { FULL: { vwapDeviation: 0.42 } },
      regimes: { FULL: 'directional_expansion' },
    },
    rankingsMap: {
      FULL: { bBandwidthPercentile: 15, nr7Flag: true, levels: { nearestResistance: 200 } },
    },
    techScoresMap: {
      // present on the doc and DELIBERATELY IGNORED for a held name — the
      // prompt's bench block is the only consumer of techScoresMap.
      FULL: { bbPercentB: 0.7, volumeProfile: { ratio: 2.1 }, factors: { rsi: 60, macdAboveSignal: true, rsPercentile: 90 } },
      BARE: { bbPercentB: 0.7, volumeProfile: { ratio: 2.1 }, factors: { rsi: 60, macdAboveSignal: true, rsPercentile: 90 } },
    },
    heldSymbols: ['FULL', 'BARE'],
    benchSymbols: [],
  });
}

/** One bench symbol carrying every bench-class reading, and one carrying none. */
function benchFixture() {
  return buildPresentSignals({
    momentumData: {
      // a VWAP entry for a bench symbol cannot happen (the intraday fetch is
      // held-only) — planted here to prove the builder ignores it anyway
      vwap: { FULL: { vwapDeviation: 0.42 } },
      regimes: { FULL: 'choppy' },
    },
    rankingsMap: { FULL: { bBandwidthPercentile: 15, nr7Flag: true, levels: { nearestSupport: 100 } } },
    techScoresMap: {
      FULL: { bbPercentB: 0.7, volumeProfile: { tier: 'high', ratio: 2.1 }, factors: { rsi: 60, macdAboveSignal: true, rsPercentile: 90 } },
      BARE: { factors: {} },
    },
    heldSymbols: [],
    benchSymbols: ['FULL', 'BARE'],
  });
}

describe('A-2 — buildPresentSignals: one row per signal per class (Phase 0 §5)', () => {
  it('HELD, everything present: ATR, VWAP, BB_WIDTH, NR7, LEVELS, REGIME — and NEVER a bench-only signal', () => {
    const set = heldFixture().get('FULL');
    expect([...set].sort()).toEqual(['ATR', 'BB_WIDTH', 'LEVELS', 'NR7', 'REGIME', 'VWAP']);
    for (const s of ['RSI', 'MACD_CROSS', 'RVOL', 'BB_PCT_B', 'RS_PERCENTILE']) {
      expect(set.has(s), `${s} must never be present for a held name`).toBe(false);
    }
  });

  it('HELD, nothing present: ATR alone — the ATR Mult column is on every held row unconditionally', () => {
    expect([...heldFixture().get('BARE')]).toEqual(['ATR']);
  });

  it('HELD: VWAP rides `vwapDeviation != null`, the same test the momentum snapshot renders on', () => {
    const noDev = buildPresentSignals({ momentumData: { vwap: { S: { vwap: 101.2, vwapDeviation: null } } }, heldSymbols: ['S'] });
    expect(noDev.get('S').has('VWAP')).toBe(false);
    const zeroDev = buildPresentSignals({ momentumData: { vwap: { S: { vwapDeviation: 0 } } }, heldSymbols: ['S'] });
    expect(zeroDev.get('S').has('VWAP')).toBe(true); // 0 is a reading
  });

  it('HELD: NR7 rides the field being CARRIED — `false` is a measurement, not an absence', () => {
    const p = buildPresentSignals({ rankingsMap: { S: { nr7Flag: false } }, heldSymbols: ['S'] });
    expect(p.get('S').has('NR7')).toBe(true);
    const none = buildPresentSignals({ rankingsMap: { S: {} }, heldSymbols: ['S'] });
    expect(none.get('S').has('NR7')).toBe(false);
  });

  it('BENCH, everything present: RSI, MACD_CROSS, BB_PCT_B, RVOL, RS_PERCENTILE, LEVELS — and NEVER VWAP', () => {
    const set = benchFixture().get('FULL');
    expect([...set].sort()).toEqual(['BB_PCT_B', 'LEVELS', 'MACD_CROSS', 'RSI', 'RS_PERCENTILE', 'RVOL']);
    expect(set.has('VWAP'), 'the intraday fetch is held-only — VWAP never renders for a bench name').toBe(false);
    expect(set.has('ATR'), 'the ATR Mult column is a held-row cell').toBe(false);
  });

  it('BENCH, nothing present: the empty set', () => {
    expect([...benchFixture().get('BARE')]).toEqual([]);
  });

  it('BENCH: each field gates its own signal, one at a time', () => {
    const only = (tech) => [...buildPresentSignals({ techScoresMap: { S: tech }, benchSymbols: ['S'] }).get('S')];
    expect(only({ factors: { rsi: 60 } })).toEqual(['RSI']);
    expect(only({ factors: { macdAboveSignal: false } })).toEqual(['MACD_CROSS']); // false is a reading
    expect(only({ bbPercentB: 0 })).toEqual(['BB_PCT_B']);                          // 0 is a reading
    expect(only({ volumeProfile: { tier: 'high' } })).toEqual([]);                  // a tier is not a ratio
    expect(only({ volumeProfile: { ratio: 1.2 } })).toEqual(['RVOL']);
    expect(only({ factors: { rsPercentile: 0 } })).toEqual(['RS_PERCENTILE']);
    // THE COMMIT C PREREQUISITE: a null rsPercentile is an ABSENCE. With the
    // `?? 50` placeholder still in place this row read `RS_PERCENTILE` present
    // for a symbol that has no measurement.
    expect(only({ factors: { rsPercentile: null } })).toEqual([]);
  });

  it('a symbol in BOTH lists is held — the held read is what the decider sees for a position it owns', () => {
    const p = buildPresentSignals({
      techScoresMap: { S: { factors: { rsi: 60, rsPercentile: 90 } } },
      heldSymbols: ['S'],
      benchSymbols: ['S'],
    });
    expect([...p.get('S')]).toEqual(['ATR']);
    expect(p.size).toBe(1);
  });

  it('THE NEVER-PRESENT FOUR are absent for every symbol under every input', () => {
    const maps = [
      sep14Tick(),
      heldFixture(),
      benchFixture(),
      // the maximal input: every field on every doc, both classes
      buildPresentSignals({
        momentumData: { vwap: { A: { vwapDeviation: 1 }, B: { vwapDeviation: 1 } }, regimes: { A: 'choppy', B: 'choppy' } },
        rankingsMap: { A: { bBandwidthPercentile: 1, nr7Flag: true, levels: {} }, B: { bBandwidthPercentile: 1, nr7Flag: true, levels: {} } },
        techScoresMap: {
          A: { bbPercentB: 1, volumeProfile: { ratio: 1 }, factors: { rsi: 1, macdAboveSignal: true, rsPercentile: 1 } },
          B: { bbPercentB: 1, volumeProfile: { ratio: 1 }, factors: { rsi: 1, macdAboveSignal: true, rsPercentile: 1 } },
        },
        heldSymbols: ['A'],
        benchSymbols: ['B'],
      }),
    ];
    expect(NEVER_PRESENT_SIGNALS).toEqual(['MACD_5M', 'RSI_5M', 'VWAP_5M', 'SMA_20_LEVEL']);
    for (const map of maps) {
      for (const [sym, set] of map) {
        for (const never of NEVER_PRESENT_SIGNALS) {
          expect(set.has(never), `${never} must never be present (${sym})`).toBe(false);
        }
      }
    }
  });

  it('is total on junk input — no throw, an empty map', () => {
    expect(buildPresentSignals()).toEqual(new Map());
    expect(buildPresentSignals({})).toEqual(new Map());
    expect(buildPresentSignals({ heldSymbols: null, benchSymbols: 'QCOM' })).toEqual(new Map());
    const p = buildPresentSignals({ heldSymbols: ['A', 'A', '', null, 7], benchSymbols: ['A'] });
    expect([...p.keys()]).toEqual(['A']);
  });

  it('is a pure read — it mutates nothing it is handed', () => {
    const momentumData = { vwap: { A: { vwapDeviation: 1 } }, regimes: { A: 'choppy' } };
    const before = JSON.stringify(momentumData);
    buildPresentSignals({ momentumData, heldSymbols: ['A'] });
    expect(JSON.stringify(momentumData)).toBe(before);
  });
});
