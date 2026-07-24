// api/_utils/wireIdentity.test.js
// Idempotency keys, the Neta canonicalizer, and the F2-2 hash contract:
// permuted key order → identical hash; degradation is deterministic.

import { describe, it, expect } from 'vitest';
import {
  buildIdempotencyKey,
  canonicalizeEconEvent,
  canonicalSerialize,
  computePayloadHash,
} from './wireIdentity.js';

describe('buildIdempotencyKey', () => {
  it('joins seam:triggerRef:marketDate and requires all three', () => {
    expect(buildIdempotencyKey('kai_pulse', 'pre_market', '2026-07-24'))
      .toBe('kai_pulse:pre_market:2026-07-24');
    expect(() => buildIdempotencyKey('kai_pulse', '', '2026-07-24')).toThrow();
  });
});

describe('canonicalizeEconEvent — Neta alias convergence + degradation (§9)', () => {
  it('known Tier-1 aliases converge on one slug', () => {
    expect(canonicalizeEconEvent('CPI (YoY)')).toBe('cpi');
    expect(canonicalizeEconEvent('Consumer Price Index')).toBe('cpi');
    expect(canonicalizeEconEvent('CPI')).toBe('cpi');
    expect(canonicalizeEconEvent('Non-Farm Payrolls')).toBe('nfp');
    expect(canonicalizeEconEvent('Nonfarm Payrolls (NFP)')).toBe('nfp');
    expect(canonicalizeEconEvent('Employment Situation Report')).toBe('nfp');
    expect(canonicalizeEconEvent('FOMC Rate Decision')).toBe('fomc');
    expect(canonicalizeEconEvent('Fed Funds Target Decision')).toBe('fomc');
    expect(canonicalizeEconEvent('Initial Jobless Claims')).toBe('claims');
    expect(canonicalizeEconEvent('ISM Manufacturing PMI')).toBe('ism_mfg');
    expect(canonicalizeEconEvent('University of Michigan Consumer Sentiment')).toBe('umich');
  });

  it('unknown names degrade to a deterministic slug (same input → same slug)', () => {
    const a = canonicalizeEconEvent('Philadelphia Fed Manufacturing Index');
    const b = canonicalizeEconEvent('Philadelphia  Fed – Manufacturing Index!');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-z0-9_]+$/);
    expect(canonicalizeEconEvent('')).toBe('unknown');
    expect(canonicalizeEconEvent(null)).toBe('unknown');
  });
});

describe('payloadHash — F2-2 canonicalization contract', () => {
  const factsA = {
    eventType: 'earnings_recap',
    tickers: ['NVDA'],
    direction: 'up',
    magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' },
    keyLevel: { price: 148.5, type: 'prior_high' },
    figures: [{ value: 5.2, unit: 'pct', basis: 'gap_vs_prior_close' }],
    qualifiers: ['guidance_raised'],
  };
  // Same content, keys permuted at every depth.
  const factsB = {
    qualifiers: ['guidance_raised'],
    figures: [{ basis: 'gap_vs_prior_close', value: 5.2, unit: 'pct' }],
    keyLevel: { type: 'prior_high', price: 148.5 },
    magnitude: { basis: 'eps_vs_consensus', unit: 'pct', value: 8.2 },
    direction: 'up',
    tickers: ['NVDA'],
    eventType: 'earnings_recap',
  };

  it('identical facts with permuted key order hash identically', () => {
    expect(computePayloadHash(factsA)).toBe(computePayloadHash(factsB));
    expect(canonicalSerialize(factsA)).toBe(canonicalSerialize(factsB));
  });

  it('array ORDER is meaningful and changes the hash', () => {
    const twoFigsA = { ...factsA, figures: [{ value: 1, unit: 'pct', basis: 'gap_vs_prior_close' }, { value: 2, unit: 'pct', basis: 'gap_vs_prior_close' }] };
    const twoFigsB = { ...factsA, figures: [...twoFigsA.figures].reverse() };
    expect(computePayloadHash(twoFigsA)).not.toBe(computePayloadHash(twoFigsB));
  });

  it('content changes change the hash; null hashes stably', () => {
    expect(computePayloadHash(factsA)).not.toBe(
      computePayloadHash({ ...factsA, magnitude: { ...factsA.magnitude, value: 8.3 } })
    );
    expect(computePayloadHash(null)).toBe(computePayloadHash(undefined));
    expect(computePayloadHash(null)).toMatch(/^[0-9a-f]{64}$/);
  });
});
