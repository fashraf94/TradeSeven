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

  it('sign inconsistency (direction=down, magnitude positive) REJECTS', () => {
    const facts = goodEarningsFacts();
    facts.direction = 'down';
    facts.magnitude.value = 8.2;
    const v = run(facts);
    expect(v.outcome).toBe(WIRE_OUTCOMES.REJECTED);
    expect(v.codes).toContain(WIRE_CODES.R4_SIGN);
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

describe('wireValidator — R5 truncation', () => {
  it('stop_reason=max_tokens → outcome truncated regardless of payload', () => {
    const v = run(goodEarningsFacts(), { stopReason: 'max_tokens' });
    expect(v.outcome).toBe(WIRE_OUTCOMES.TRUNCATED);
    expect(v.codes).toContain(WIRE_CODES.R5_TRUNCATED);
    expect(v.facts).toBeNull();
  });
});

describe('wireValidator — derived-not-literal contract lock', () => {
  it('accepts every direction/unit the contracts export, rejects one past the fence', () => {
    for (const direction of DIRECTIONS) {
      const facts = goodEarningsFacts();
      facts.direction = direction;
      facts.magnitude.value = direction === 'down' ? -8.2 : 8.2;
      expect(run(facts).codes).not.toContain(WIRE_CODES.SALVAGE_DIRECTION);
    }
    for (const unit of UNITS) {
      const facts = goodEarningsFacts();
      facts.magnitude = { value: 1, unit, basis: 'eps_vs_consensus' };
      expect(run(facts).facts.magnitude?.unit, unit).toBe(unit);
    }
    const bad = goodEarningsFacts();
    bad.magnitude = { value: 1, unit: 'furlongs', basis: 'eps_vs_consensus' };
    expect(run(bad).codes).toContain(WIRE_CODES.SALVAGE_MAGNITUDE);
  });
});
