// api/_utils/wireExemplars.test.js
// N2 exemplars — the embedded set and its render. The centerpiece is the
// N2.1 gate re-run as a PERMANENT regression: every embedded companion is
// re-validated through the shipping validator -> digest renderer, reproducing
// wireWriteThrough's persistedFacts construction, so an edit that breaks an
// exemplar (or a validator/renderer change that would) fails CI. "A candidate
// that cannot produce a clean dual output is not an exemplar" — enforced.

import { describe, it, expect } from 'vitest';
import { validateAgentFacts, normalizeWireTicker, isInWireUniverse } from './wireValidator.js';
import { renderWireDigest } from './wireDigest.js';
import { EVENT_CONTRACTS, WIRE_OUTCOMES, TICKER_MAX_LENGTH } from './wireContracts.js';
import { WIRE_EXEMPLARS, WIRE_EXEMPLAR_VERSION, renderExemplarBlock } from './wireExemplars.js';

describe('the embedded set (partial embed per the July 29 ruling)', () => {
  it('version is the first set', () => {
    expect(WIRE_EXEMPLAR_VERSION).toBe(1);
  });

  it('alex 4, kai 3, doug 4; kim / neta / doug-recap deferred (absent)', () => {
    expect(WIRE_EXEMPLARS.alex).toHaveLength(4);
    expect(WIRE_EXEMPLARS.kai).toHaveLength(3);
    expect(WIRE_EXEMPLARS.doug).toHaveLength(4);
    expect(WIRE_EXEMPLARS.kim).toBeUndefined();
    expect(WIRE_EXEMPLARS.neta).toBeUndefined();
    // total embedded = 11
    const total = Object.values(WIRE_EXEMPLARS).reduce((n, l) => n + l.length, 0);
    expect(total).toBe(11);
  });

  it('every alex exemplar is market_mover with a signed pct magnitude', () => {
    for (const ex of WIRE_EXEMPLARS.alex) {
      expect(ex.eventType).toBe('market_mover');
      expect(ex.agentFacts.magnitude.basis).toBe('price_vs_prior_close');
      expect(ex.agentFacts.magnitude.unit).toBe('pct');
      // direction sign agrees with the magnitude sign
      const up = ex.agentFacts.magnitude.value >= 0;
      expect(ex.agentFacts.direction).toBe(up ? 'up' : 'down');
    }
  });

  it('kai exemplars carry a real subjectRef spread (NDX survives, not a degenerate all-SPX set)', () => {
    for (const ex of WIRE_EXEMPLARS.kai) {
      expect(ex.eventType).toBe('index_move');
      expect(ex.agentFacts.tickers).toEqual([]); // cardinality-0
      expect(ex.agentFacts.subjectRef).toBeTruthy();
    }
    const subs = new Set(WIRE_EXEMPLARS.kai.map((e) => e.agentFacts.subjectRef));
    expect(subs.has('NDX')).toBe(true); // the non-default teaching case
    expect(subs.size).toBeGreaterThan(1);
  });

  it('every doug exemplar is a head-only earnings_preview with NO direction (forbidden on previews) and no invented numbers', () => {
    for (const ex of WIRE_EXEMPLARS.doug) {
      expect(ex.eventType).toBe('earnings_preview');
      expect(ex.agentFacts.direction).toBeUndefined();
      expect(ex.agentFacts.magnitude).toBeUndefined();
      expect(Object.keys(ex.agentFacts).sort()).toEqual(['eventType', 'tickers']);
    }
  });

  it('every entry records provenance (source storyId + primaryTicker key)', () => {
    for (const list of Object.values(WIRE_EXEMPLARS)) {
      for (const ex of list) {
        expect(typeof ex.storyId).toBe('string');
        expect(ex.storyId.length).toBeGreaterThan(0);
        expect('primaryTicker' in ex).toBe(true); // may be null (kai market-wide)
      }
    }
  });
});

describe('N2.1 gate as regression: each companion re-validates + renders clean', () => {
  const cases = Object.entries(WIRE_EXEMPLARS).flatMap(([reporter, list]) =>
    list.map((ex) => ({ reporter, ex })),
  );

  for (const { reporter, ex } of cases) {
    it(`${reporter} ${ex.storyId} (${ex.eventType}) → clean dual output`, () => {
      const v = validateAgentFacts({
        rawAgentFacts: ex.agentFacts,
        reporter,
        stopReason: 'tool_use',
        primaryTickerRaw: ex.primaryTicker ?? null,
      });
      // validation must PASS or SALVAGE (a designed benign correction) — never
      // REJECT/TRUNCATE.
      expect([WIRE_OUTCOMES.PASSED, WIRE_OUTCOMES.SALVAGED]).toContain(v.outcome);
      expect(v.facts).toBeTruthy();

      // reproduce wireWriteThrough persistedFacts subjectRef/primaryTicker
      // resolution, then render the digest exactly as production would.
      const candidatePrimary = ex.primaryTicker ? normalizeWireTicker(ex.primaryTicker) : null;
      const normalizedPrimary =
        candidatePrimary && candidatePrimary.length <= TICKER_MAX_LENGTH && isInWireUniverse(candidatePrimary)
          ? candidatePrimary
          : null;
      const contract = EVENT_CONTRACTS[v.facts.eventType] || {};
      const resolvedSubjectRef = contract.subjectRef === 'server' ? null : (v.facts.subjectRef ?? null);
      const digest = renderWireDigest({ ...v.facts, subjectRef: resolvedSubjectRef, primaryTicker: normalizedPrimary });

      expect(typeof digest).toBe('string');
      expect(digest.length).toBeGreaterThan(0);
      expect(digest).not.toMatch(/undefined|NaN|null/);
    });
  }
});

describe('renderExemplarBlock', () => {
  it('returns "" for a reporter with no exemplars (deferred), so callers concatenate unconditionally', () => {
    expect(renderExemplarBlock('kim')).toBe('');
    expect(renderExemplarBlock('neta', { pinEventType: 'econ_print' })).toBe('');
    expect(renderExemplarBlock('neta', { pinEventType: 'econ_preview' })).toBe('');
  });

  it('a pinned seam renders only its own eventType', () => {
    const preview = renderExemplarBlock('doug', { pinEventType: 'earnings_preview' });
    expect(preview).toContain('AAPL');
    expect(preview).toContain('earnings_preview');
    // the recap row is deferred — nothing renders for it
    expect(renderExemplarBlock('doug', { pinEventType: 'earnings_recap' })).toBe('');
  });

  it('leading newline, no trailing newline, situation + agentFacts JSON present', () => {
    const block = renderExemplarBlock('alex');
    expect(block.startsWith('\n')).toBe(true);
    expect(block.endsWith('\n')).toBe(false);
    expect(block).toContain('EXAMPLES');
    expect(block).toContain('AMD');
    expect(block).toContain('"basis":"price_vs_prior_close"');
  });

  it('carries no directive vocabulary (agentFacts is machine-only)', () => {
    for (const reporter of ['alex', 'kai', 'doug']) {
      const block = renderExemplarBlock(reporter);
      expect(block).not.toMatch(/recommended_action|sentiment/);
    }
  });
});
