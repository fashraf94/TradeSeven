// api/_utils/wireValidator.test.js
// FantasyTimes Wire — validator acceptance (Spec V1.5 §9 / §4.2).
// Enum cases are DERIVED from wireContracts exports, never re-literal'd
// (the derived-not-literal contract pattern).

import { describe, it, expect } from 'vitest';
import { validateAgentFacts, normalizeWireTicker, isInWireUniverse } from './wireValidator.js';
import {
  EVENT_CONTRACTS,
  REPORTER_EVENT_ALLOWLIST,
  WIRE_CODES,
  WIRE_OUTCOMES,
  WIRE_VALIDATOR_VERSION,
  EVENT_TYPES,
  DIRECTIONS,
  UNITS,
  BASIS_UNITS,
} from './wireContracts.js';

const goodEarningsFacts = () => ({
  eventType: 'earnings_recap',
  tickers: ['NVDA'],
  direction: 'up',
  magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' },
  keyLevel: { price: 148.5, type: 'prior_high' },
  figures: [{ value: 5.2, unit: 'pct', basis: 'gap_vs_prior_close' }],
  qualifiers: ['guidance_raised'],
});

const run = (facts, { reporter = 'doug', stopReason = 'tool_use' } = {}) =>
  validateAgentFacts({ rawAgentFacts: facts, reporter, stopReason });

describe('wireValidator — projection (R1/R2)', () => {
  it('passes a fully valid payload', () => {
    const v = run(goodEarningsFacts());
    expect(v.outcome).toBe(WIRE_OUTCOMES.PASSED);
    expect(v.codes).toEqual([]);
    expect(v.facts.tickers).toEqual(['NVDA']);
    expect(v.validatorVersion).toBe(WIRE_VALIDATOR_VERSION);
    expect(v.projectionSucceeded).toBe(true);
  });

  it('REJECTS unknown top-level keys (smuggled tradeBias/confidence)', () => {
    const v = run({ ...goodEarningsFacts(), tradeBias: 'long', confidence: 0.9 });
    expect(v.outcome).toBe(WIRE_OUTCOMES.REJECTED);
    expect(v.codes).toContain(WIRE_CODES.R1_UNKNOWN_KEYS);
    expect(v.facts).toBeNull();
  });

  it('REJECTS unknown keys at DEPTH (inside magnitude / figures items)', () => {
    const deep = goodEarningsFacts();
    deep.magnitude.injected_directive = 'buy now';
    const v = run(deep);
    expect(v.outcome).toBe(WIRE_OUTCOMES.REJECTED);
    expect(v.codes).toContain(WIRE_CODES.R1_UNKNOWN_KEYS);

    const deepFig = goodEarningsFacts();
    deepFig.figures[0].note = 'x';
    const v2 = run(deepFig);
    expect(v2.codes).toContain(WIRE_CODES.R1_UNKNOWN_KEYS);
  });

  it('R2: recommended_action / sentiment present → REJECT with the named code', () => {
    for (const field of ['recommended_action', 'sentiment']) {
      const v = run({ ...goodEarningsFacts(), [field]: 'BAGGERBOMB' });
      expect(v.outcome).toBe(WIRE_OUTCOMES.REJECTED);
      expect(v.codes).toContain(WIRE_CODES.R2_DIRECTIVE_FIELD);
    }
  });

  it('REJECTS absent/non-object agentFacts', () => {
    expect(run(undefined).outcome).toBe(WIRE_OUTCOMES.REJECTED);
    expect(run(undefined).codes).toContain(WIRE_CODES.R4_MISSING);
    expect(run(null).codes).toContain(WIRE_CODES.R4_MISSING);
    expect(run([1]).codes).toContain(WIRE_CODES.R4_TYPE);
    expect(run(undefined).projectionSucceeded).toBe(false);
  });
});

describe('wireValidator — R3 reporter allowlists (derived from contracts)', () => {
  it('every reporter accepts exactly their allowlisted eventTypes', () => {
    for (const [reporter, allowed] of Object.entries(REPORTER_EVENT_ALLOWLIST)) {
      for (const eventType of EVENT_TYPES) {
        const contract = EVENT_CONTRACTS[eventType];
        const minimal = {
          eventType,
          tickers: contract.tickers[0] >= 1 ? ['NVDA'] : [],
        };
        const v = run(minimal, { reporter });
        if (allowed.includes(eventType)) {
          expect(v.codes, `${reporter}/${eventType}`).not.toContain(WIRE_CODES.R3_EVENTTYPE);
        } else {
          expect(v.outcome, `${reporter}/${eventType}`).toBe(WIRE_OUTCOMES.REJECTED);
          expect(v.codes).toContain(WIRE_CODES.R3_EVENTTYPE);
        }
      }
    }
  });

  it('unknown eventType string → R4_ENUM reject', () => {
    const v = run({ eventType: 'macro_alert', tickers: [] }, { reporter: 'alex' });
    expect(v.outcome).toBe(WIRE_OUTCOMES.REJECTED);
    expect(v.codes).toContain(WIRE_CODES.R4_ENUM);
  });
});

describe('wireValidator — R4 contract battery', () => {
  it('cardinality violations REJECT (pre-strip counts)', () => {
    // econ_print requires exactly 0 tickers
    const v = run({ eventType: 'econ_print', tickers: ['SPY'] }, { reporter: 'neta' });
    expect(v.outcome).toBe(WIRE_OUTCOMES.REJECTED);
    expect(v.codes).toContain(WIRE_CODES.R4_CARDINALITY);
    // market_mover requires exactly 1
    const v2 = run({ eventType: 'market_mover', tickers: [] }, { reporter: 'alex' });
    expect(v2.codes).toContain(WIRE_CODES.R4_CARDINALITY);
  });

  it('non-null direction on a preview eventType REJECTS', () => {
    const v = run(
      { eventType: 'econ_preview', tickers: [], direction: 'up' },
      { reporter: 'neta' }
    );
    expect(v.outcome).toBe(WIRE_OUTCOMES.REJECTED);
    expect(v.codes).toContain(WIRE_CODES.R4_DIRECTION_ON_PREVIEW);
  });

  it('sign inconsistency on a DIRECTION-SUBJECT basis REJECTS (A3)', () => {
    const facts = goodEarningsFacts();
    facts.direction = 'down';
    // price_vs_prior_close carries earnings_recap's direction subject (price)
    facts.magnitude = { value: 8.2, unit: 'pct', basis: 'price_vs_prior_close' };
    const v = run(facts);
    expect(v.outcome).toBe(WIRE_OUTCOMES.REJECTED);
    expect(v.codes).toContain(WIRE_CODES.R4_SIGN);
  });

  it('A3 narrow rule: "up despite an EPS miss" is LEGAL (eps basis ≠ direction subject)', () => {
    const facts = goodEarningsFacts();
    facts.direction = 'up';
    facts.magnitude = { value: -3.1, unit: 'pct', basis: 'eps_vs_consensus' };
    const v = run(facts);
    expect(v.codes).not.toContain(WIRE_CODES.R4_SIGN);
    expect(v.facts.magnitude.value).toBe(-3.1);
  });

  it('A3 figures[]: same-basis contradiction REJECTS; differing-basis reversal passes; null direction exempt', () => {
    // market_mover directionBases = [price_vs_prior_close]
    const base = () => ({
      eventType: 'market_mover', tickers: ['NVDA'], direction: 'up',
      magnitude: { value: 4.2, unit: 'pct', basis: 'price_vs_prior_close' },
    });

    const contradicting = base();
    contradicting.figures = [{ value: -2.0, unit: 'pct', basis: 'price_vs_prior_close' }];
    const v1 = run(contradicting, { reporter: 'alex' });
    expect(v1.outcome).toBe(WIRE_OUTCOMES.REJECTED);
    expect(v1.codes).toContain(WIRE_CODES.R4_SIGN);

    // Reversal narrative: direction up with a NEGATIVE gap figure — legal.
    const reversal = base();
    reversal.figures = [{ value: -6.0, unit: 'pct', basis: 'gap_vs_prior_close' }];
    const v2 = run(reversal, { reporter: 'alex' });
    expect(v2.codes).not.toContain(WIRE_CODES.R4_SIGN);
    expect(v2.outcome).toBe(WIRE_OUTCOMES.PASSED);

    // m5 exemption: no direction (this schema's flat/mixed representation
    // is null) → the check is vacuous even on a same-basis figure.
    const flat = base();
    flat.direction = null;
    flat.magnitude = null;
    flat.figures = [{ value: -2.0, unit: 'pct', basis: 'price_vs_prior_close' }];
    const v3 = run(flat, { reporter: 'alex' });
    expect(v3.codes).not.toContain(WIRE_CODES.R4_SIGN);
  });

  it('oversize figures/qualifiers arrays REJECT; oversize ticker REJECTS', () => {
    const overFig = goodEarningsFacts();
    overFig.figures = Array(5).fill({ value: 1, unit: 'pct', basis: 'gap_vs_prior_close' });
    expect(run(overFig).codes).toContain(WIRE_CODES.R4_OVERSIZE);

    const overQ = goodEarningsFacts();
    overQ.qualifiers = ['guidance_raised', 'guidance_lowered', 'dividend_raised', 'buyback_announced'];
    expect(run(overQ).codes).toContain(WIRE_CODES.R4_OVERSIZE);

    const longTicker = goodEarningsFacts();
    longTicker.tickers = ['A'.repeat(20)];
    expect(run(longTicker).codes).toContain(WIRE_CODES.R4_OVERSIZE);
  });

  it('non-finite numbers in optional fields salvage-drop (never persist NaN)', () => {
    const facts = goodEarningsFacts();
    facts.magnitude.value = Number.NaN;
    const v = run(facts);
    expect(v.outcome).toBe(WIRE_OUTCOMES.SALVAGED);
    expect(v.facts.magnitude).toBeNull();
  });
});

describe('wireValidator — S1 salvage', () => {
  it('malformed optional keyLevel drops; valid fields survive; outcome SALVAGED', () => {
    const facts = goodEarningsFacts();
    facts.keyLevel = { price: 'not-a-number', type: 'prior_high' };
    const v = run(facts);
    expect(v.outcome).toBe(WIRE_OUTCOMES.SALVAGED);
    expect(v.codes).toContain(WIRE_CODES.SALVAGE_KEYLEVEL);
    expect(v.facts.keyLevel).toBeNull();
    expect(v.facts.magnitude).toEqual(goodEarningsFacts().magnitude);
  });

  it('out-of-enum qualifier drops the item, keeps the rest', () => {
    const facts = goodEarningsFacts();
    facts.qualifiers = ['guidance_raised', 'to_the_moon'];
    const v = run(facts);
    expect(v.outcome).toBe(WIRE_OUTCOMES.SALVAGED);
    expect(v.codes).toContain(WIRE_CODES.SALVAGE_QUALIFIER);
    expect(v.facts.qualifiers).toEqual(['guidance_raised']);
  });

  it('invalid direction value on a non-preview salvage-drops to null', () => {
    const facts = goodEarningsFacts();
    facts.direction = 'sideways';
    const v = run(facts);
    expect(v.codes).toContain(WIRE_CODES.SALVAGE_DIRECTION);
    expect(v.facts.direction).toBeNull();
  });
});

describe('wireValidator — F1 normalization + F2 quarantine', () => {
  it('normalizes case and dot→hyphen (BRK.B → BRK-B, in-universe)', () => {
    expect(normalizeWireTicker('brk.b')).toBe('BRK-B');
    expect(isInWireUniverse('BRK-B')).toBe(true);
    const v = run({ ...goodEarningsFacts(), tickers: ['nvda'] });
    expect(v.facts.tickers).toEqual(['NVDA']);
  });

  it('off-universe tickers move to offUniverseTickers with F1 code', () => {
    const v = run({ ...goodEarningsFacts(), tickers: ['NVDA', 'ZZZOFF'] });
    expect(v.codes).toContain(WIRE_CODES.F1_OFFUNIVERSE);
    expect(v.offUniverseTickers).toEqual(['ZZZOFF']);
    expect(v.facts.tickers).toEqual(['NVDA']);
    expect(v.quarantined).toBe(false);
  });

  it('off-universe-ONLY company event → QUARANTINED', () => {
    const v = run({ ...goodEarningsFacts(), tickers: ['ZZZOFF'] });
    expect(v.outcome).toBe(WIRE_OUTCOMES.QUARANTINED);
    expect(v.codes).toContain(WIRE_CODES.F2_QUARANTINE);
    expect(v.quarantined).toBe(true);
    expect(v.preStripTickerCount).toBe(1); // pre-strip cardinality satisfied
  });
});

describe('wireValidator — subjectRef (V1.6 A2)', () => {
  const indexFacts = (subjectRef) => ({
    eventType: 'index_move',
    tickers: [],
    direction: 'down',
    magnitude: { value: -1.2, unit: 'pct', basis: 'index_vs_prior_close' },
    ...(subjectRef !== undefined ? { subjectRef } : {}),
  });

  it('index_move: missing subjectRef → R4 REJECT (required)', () => {
    const v = run(indexFacts(undefined), { reporter: 'kai' });
    expect(v.outcome).toBe(WIRE_OUTCOMES.REJECTED);
    expect(v.codes).toContain(WIRE_CODES.R4_MISSING);
  });

  it('index_move: out-of-enum subjectRef → R4 REJECT', () => {
    const v = run(indexFacts('SPY'), { reporter: 'kai' }); // ETF, not an index subject
    expect(v.outcome).toBe(WIRE_OUTCOMES.REJECTED);
    expect(v.codes).toContain(WIRE_CODES.R4_ENUM);
  });

  it('index_move: valid subjectRef passes and lands in facts', () => {
    const v = run(indexFacts('NDX'), { reporter: 'kai' });
    expect(v.outcome).toBe(WIRE_OUTCOMES.PASSED);
    expect(v.facts.subjectRef).toBe('NDX');
  });

  it('S1_SUBJECT_REMAPPED: primaryTicker SPY + subjectRef NDX → SPX (the A2 fixture)', () => {
    const v = validateAgentFacts({
      rawAgentFacts: indexFacts('NDX'),
      reporter: 'kai',
      stopReason: 'tool_use',
      primaryTickerRaw: 'SPY',
    });
    expect(v.outcome).toBe(WIRE_OUTCOMES.SALVAGED);
    expect(v.codes).toContain(WIRE_CODES.S1_SUBJECT_REMAPPED);
    expect(v.facts.subjectRef).toBe('SPX');
  });

  it('agreeing or unmappable primaryTicker leaves subjectRef as emitted', () => {
    const agree = validateAgentFacts({
      rawAgentFacts: indexFacts('SPX'), reporter: 'kai', stopReason: 'tool_use', primaryTickerRaw: 'SPY',
    });
    expect(agree.outcome).toBe(WIRE_OUTCOMES.PASSED);
    expect(agree.facts.subjectRef).toBe('SPX');

    const unmappable = validateAgentFacts({
      rawAgentFacts: indexFacts('VIX'), reporter: 'kai', stopReason: 'tool_use', primaryTickerRaw: 'NVDA',
    });
    expect(unmappable.codes).not.toContain(WIRE_CODES.S1_SUBJECT_REMAPPED);
    expect(unmappable.facts.subjectRef).toBe('VIX');
  });

  it('subjectRef on a non-index row → SALVAGE-drop (invalid optional field for that row)', () => {
    const v = run({
      eventType: 'technical_break', tickers: ['AAPL'], direction: 'up',
      magnitude: { value: 2.1, unit: 'pct', basis: 'price_vs_level' },
      subjectRef: 'SPX',
    }, { reporter: 'kai' });
    expect(v.outcome).toBe(WIRE_OUTCOMES.SALVAGED);
    expect(v.codes).toContain(WIRE_CODES.SALVAGE_SUBJECTREF);
    expect(v.facts.subjectRef).toBeNull();
  });
});

describe('wireValidator — R5 truncation', () => {
  it('stop_reason=max_tokens → outcome truncated regardless of payload', () => {
    const v = run(goodEarningsFacts(), { stopReason: 'max_tokens' });
    expect(v.outcome).toBe(WIRE_OUTCOMES.TRUNCATED);
    expect(v.codes).toContain(WIRE_CODES.R5_TRUNCATED);
    expect(v.facts).toBeNull();
  });
});

describe('wireValidator — derived-not-literal contract lock', () => {
  it('accepts every direction/unit the contract allows; drops units past the per-basis fence', () => {
    for (const direction of DIRECTIONS) {
      const facts = goodEarningsFacts();
      facts.direction = direction;
      facts.magnitude.value = direction === 'down' ? -8.2 : 8.2;
      expect(run(facts).codes).not.toContain(WIRE_CODES.SALVAGE_DIRECTION);
    }
    // Units are DERIVED from the contract, now per-basis (V1.7 BASIS_UNITS):
    // every unit the allowlist permits for eps_vs_consensus survives...
    for (const unit of BASIS_UNITS.eps_vs_consensus) {
      const facts = goodEarningsFacts();
      facts.magnitude = { value: 1, unit, basis: 'eps_vs_consensus' };
      expect(run(facts).facts.magnitude?.unit, unit).toBe(unit);
    }
    // ...a unit in UNITS but OUTSIDE the basis's set is a mislabel, salvage-
    // dropped (magnitude degrades away), distinctly coded...
    const offBasisUnit = UNITS.find((u) => !BASIS_UNITS.eps_vs_consensus.includes(u)); // e.g. 'pp'
    const mislabel = goodEarningsFacts();
    mislabel.magnitude = { value: 1, unit: offBasisUnit, basis: 'eps_vs_consensus' };
    const mv = run(mislabel);
    expect(mv.facts.magnitude).toBeNull();
    expect(mv.codes).toContain(WIRE_CODES.SALVAGE_UNIT_FOR_BASIS);
    // ...and a unit past the whole UNITS fence is shape-invalid.
    const bad = goodEarningsFacts();
    bad.magnitude = { value: 1, unit: 'furlongs', basis: 'eps_vs_consensus' };
    expect(run(bad).codes).toContain(WIRE_CODES.SALVAGE_MAGNITUDE);
  });
});

// ── A6: the figure-quality belt (V1.7) over the REAL 2026-08-19 defects ────
// SALVAGE-DROP, not hold: a figure is supplementary, so the story stays true
// without it; distinct codes so every drop is counted in validationStats.byRule.
describe('wireValidator — figure-quality belt (V1.7): unit allowlist · same-basis consistency · band', () => {
  // A market_mover (alex): magnitude + figures all on price_vs_prior_close.
  const mover = (magnitude, figures) => ({
    eventType: 'market_mover', tickers: ['MRK'], direction: 'up', magnitude, figures,
  });

  it('MRK: three price_vs_prior_close figures — count mislabel + 49% contradiction drop, the $ move stays', () => {
    const v = run(
      mover(
        { value: 9.41, unit: 'pct', basis: 'price_vs_prior_close' },
        [
          { value: 12.72, unit: 'usd', basis: 'price_vs_prior_close' }, // legit second unit — KEEP
          { value: 1137, unit: 'count', basis: 'price_vs_prior_close' }, // trial-readout mislabel — DROP
          { value: 49, unit: 'pct', basis: 'price_vs_prior_close' },     // contradicts the +9.41% anchor — DROP
        ]
      ),
      { reporter: 'alex' }
    );
    expect(v.outcome).toBe(WIRE_OUTCOMES.SALVAGED);
    expect(v.facts.magnitude).toEqual({ value: 9.41, unit: 'pct', basis: 'price_vs_prior_close' });
    expect(v.facts.figures).toEqual([{ value: 12.72, unit: 'usd', basis: 'price_vs_prior_close' }]);
    expect(v.codes).toContain(WIRE_CODES.SALVAGE_UNIT_FOR_BASIS);  // the 1137 count
    expect(v.codes).toContain(WIRE_CODES.SALVAGE_BASIS_CONFLICT);  // the 49 vs 9.41
  });

  // A volume_surge (kai): magnitude on volume_vs_avg, which is a MULTIPLE (x).
  const volume = (magnitude) => ({
    eventType: 'volume_surge', tickers: ['ZZZ'], direction: 'up', magnitude,
  });

  it('TSLA unit mislabel: volume_vs_avg in `count` drops the magnitude (degrades to a bare move)', () => {
    const v = run({ ...volume({ value: 19.52, unit: 'count', basis: 'volume_vs_avg' }), tickers: ['TSLA'] }, { reporter: 'kai' });
    expect(v.outcome).toBe(WIRE_OUTCOMES.SALVAGED);
    expect(v.facts.magnitude).toBeNull();
    expect(v.codes).toContain(WIRE_CODES.SALVAGE_UNIT_FOR_BASIS);
  });

  it('PFE: volume_vs_avg in the correct unit `x` passes clean (the other side of the mislabel)', () => {
    const v = run({ ...volume({ value: 26.03, unit: 'x', basis: 'volume_vs_avg' }), tickers: ['PFE'] }, { reporter: 'kai' });
    expect(v.outcome).toBe(WIRE_OUTCOMES.PASSED);
    expect(v.facts.magnitude).toEqual({ value: 26.03, unit: 'x', basis: 'volume_vs_avg' });
    expect(v.codes).toEqual([]);
  });

  it('a GENUINE 49% mover passes: magnitude agrees, so consistency and the loose band both hold fire', () => {
    const v = run(
      mover(
        { value: 49, unit: 'pct', basis: 'price_vs_prior_close' },
        [{ value: 49, unit: 'pct', basis: 'price_vs_prior_close' }] // agrees with the anchor
      ),
      { reporter: 'alex' }
    );
    expect(v.outcome).toBe(WIRE_OUTCOMES.PASSED);
    expect(v.facts.magnitude.value).toBe(49);
    expect(v.facts.figures).toHaveLength(1);
    expect(v.codes).toEqual([]);
  });

  it('the loose band is a backstop, not a plausibility judge: a physical-impossibility lone figure drops', () => {
    // No magnitude anchor, legal unit, but 4000% is a mis-map, not a mover.
    const v = run(
      { eventType: 'market_mover', tickers: ['MRK'], direction: 'up',
        figures: [{ value: 4000, unit: 'pct', basis: 'price_vs_prior_close' }] },
      { reporter: 'alex' }
    );
    expect(v.facts.figures).toEqual([]);
    expect(v.codes).toContain(WIRE_CODES.SALVAGE_IMPLAUSIBLE);
  });

  // ── documented limits (the tokens.guard / motion.guard precedent) ────────
  describe('documented limits', () => {
    it('is the TYPED channel only — a figure echoed in the story PROSE is the editorial advisory layer\'s job', () => {
      // The belt cleans agentFacts (the typed figures/magnitude the digest
      // renders). It neither receives nor emits the model's prose (headline /
      // subheadline / body / pullquote) — the projection whitelist excludes it —
      // so a stray "1137" in Alex's BODY is NOT scrubbed here. That hygiene
      // belongs to the editorial advisory pass (REGISTERED, not a validator gap).
      const v = run(goodEarningsFacts());
      expect(Object.keys(v.facts)).not.toContain('body');
      expect(Object.keys(v.facts)).not.toContain('headline');
    });
  });
});
