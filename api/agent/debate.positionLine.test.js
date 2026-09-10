// api/agent/debate.positionLine.test.js
//
// The POSITION DATA line, null-honest — the other half of debate.js's prompt.
//
// `composeTechnicalSnapshot` already refuses to print a reading the platform
// never computed. The line above it did not: `Entry: $${entryPrice || 'N/A'}`
// and `Current: $${currentPrice || 'N/A'}` rendered `Entry: $N/A` /
// `Current: $N/A`, and `P&L: N/A%` with them. That is the placeholder family
// this arc removes everywhere — a stand-in that looks like a field with a
// value, in a prompt whose system half asks the agent to defend the position
// "with specific data" and whose response schema requires `citedIndicators`.
//
// Every row here asserts BOTH halves: the clause is gone, and the reading that
// IS present still reads exactly as it did.
//
// This file's un-mocked import of debate.js is also the BUILD_RULES §4
// dependency-surface guard for that module's import graph — it must never be
// mocked.

import { describe, it, expect } from 'vitest';
import { composePositionLine } from './debate.js';

const FULL = { symbol: 'NVDA', tier: 'star', entryPrice: 120.5, currentPrice: 138.25 };

describe('a complete position reads exactly as it always did', () => {
  it('all five clauses, in order, with the shipped formatting', () => {
    expect(composePositionLine(FULL))
      .toBe('Symbol: NVDA | Tier: star | Entry: $120.5 | Current: $138.25 | P&L: 14.73%');
  });

  it('a loss keeps its sign, to two places', () => {
    expect(composePositionLine({ ...FULL, currentPrice: 96.4 }))
      .toContain('P&L: -20.00%');
  });
});

describe('a missing reading contributes NO clause', () => {
  it('no entry price: the Entry clause is absent, not "N/A"', () => {
    const line = composePositionLine({ ...FULL, entryPrice: null });
    expect(line).toBe('Symbol: NVDA | Tier: star | Current: $138.25');
    expect(line).not.toContain('N/A');
    expect(line).not.toContain('Entry');
  });

  it('no quote: the Current clause is absent, not "N/A"', () => {
    const line = composePositionLine({ ...FULL, currentPrice: null });
    expect(line).toBe('Symbol: NVDA | Tier: star | Entry: $120.5');
    expect(line).not.toContain('N/A');
    expect(line).not.toContain('Current');
  });

  it('the P&L goes with them — it is derived from exactly those two numbers', () => {
    for (const missing of [{ entryPrice: null }, { currentPrice: null }, { entryPrice: null, currentPrice: null }]) {
      const line = composePositionLine({ ...FULL, ...missing });
      expect(line).not.toContain('P&L');
      expect(line).not.toContain('N/A');
    }
  });

  it('neither reading: the line is symbol and tier, and still a real line', () => {
    expect(composePositionLine({ ...FULL, entryPrice: null, currentPrice: null }))
      .toBe('Symbol: NVDA | Tier: star');
  });
});

describe('nothing that is not a price is rendered as one', () => {
  it('undefined, NaN, 0 and a negative are all absences — never a printed value', () => {
    for (const bad of [undefined, null, NaN, 0, -12, Infinity]) {
      const line = composePositionLine({ ...FULL, entryPrice: bad, currentPrice: bad });
      expect(line).toBe('Symbol: NVDA | Tier: star');
    }
  });

  it('a string price is not silently coerced', () => {
    const line = composePositionLine({ ...FULL, currentPrice: '138.25' });
    expect(line).not.toContain('Current');
  });

  it('a zero entry never produces an Infinity or NaN P&L', () => {
    const line = composePositionLine({ ...FULL, entryPrice: 0 });
    expect(line).not.toMatch(/Infinity|NaN/);
    expect(line).toBe('Symbol: NVDA | Tier: star | Current: $138.25');
  });

  it('the literal "undefined" never reaches the prompt', () => {
    for (const args of [
      { ...FULL, entryPrice: undefined },
      { ...FULL, currentPrice: undefined },
      { ...FULL, entryPrice: undefined, currentPrice: undefined },
    ]) {
      expect(composePositionLine(args)).not.toContain('undefined');
    }
  });
});

describe('the shipped renderer is what these rows are measured against', () => {
  // The line as debate.js built it before this change. Kept here so the two
  // claims — "identical when everything is present" and "no placeholder when
  // it is not" — are checked against the real thing rather than a paraphrase.
  function shipped({ symbol, tier, entryPrice, currentPrice }) {
    const pnlPct = entryPrice && currentPrice
      ? (((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2)
      : 'N/A';
    return `Symbol: ${symbol} | Tier: ${tier} | Entry: $${entryPrice || 'N/A'}`
      + ` | Current: $${currentPrice || 'N/A'} | P&L: ${pnlPct}%`;
  }

  it('byte-identical for a complete position', () => {
    expect(composePositionLine(FULL)).toBe(shipped(FULL));
  });

  it('and the shipped one really did print the placeholders — this is the defect', () => {
    const gap = { ...FULL, entryPrice: null, currentPrice: null };
    expect(shipped(gap)).toContain('Entry: $N/A');
    expect(shipped(gap)).toContain('Current: $N/A');
    expect(shipped(gap)).toContain('P&L: N/A%');
    expect(composePositionLine(gap)).not.toContain('N/A');
  });
});
