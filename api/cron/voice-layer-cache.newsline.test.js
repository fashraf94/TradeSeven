// api/cron/voice-layer-cache.newsline.test.js
// Phase 2 N1.2 — the newsLine packer, pure-function rows. Matrix:
//   P2-2  — whole-unit packing under the EXACT 240-code-unit ceiling:
//           two units if both fit whole · a unit exactly AT the ceiling is
//           emitted · 241 falls back to one unit · never slice.
//   P2-42 — length fail-closed: the constructed 363-char digest (the
//           discovery-measured renderer max) emits NO line, logged.
// Plus the ordering contract (newest first via date-group reverse) and the
// no-coverage → no-line rule.

import { describe, it, expect, vi } from 'vitest';
import { packNewsLine, buildNewsLinesForSymbols, NEWSLINE_MAX_LENGTH } from './voice-layer-cache.js';

const TODAY = '2026-07-24';
const PRIOR = '2026-07-23';

const item = (marketDate, digest, storyId = 'x') => ({
  marketDate,
  dto: { storyId, digest, eventType: 'earnings_recap', publishedAt: null, primaryTicker: 'NVDA', direction: null, magnitude: null, keyLevel: null, figures: null, qualifiers: null, subjectRef: null },
});

describe('packNewsLine — N1.2 locked rules', () => {
  it('no coverage → no line (null, never empty string)', () => {
    expect(packNewsLine([], TODAY)).toBeNull();
    expect(packNewsLine(null, TODAY)).toBeNull();
  });

  it('one digest → one prefixed unit', () => {
    expect(packNewsLine([item(TODAY, 'NVDA up 8%.')], TODAY)).toBe('Today: NVDA up 8%.');
    expect(packNewsLine([item(PRIOR, 'NVDA up 8%.')], TODAY)).toBe('Prior: NVDA up 8%.');
  });

  it('two digests that both fit whole → two units, newest first, joined', () => {
    const line = packNewsLine([item(TODAY, 'Newest today.'), item(PRIOR, 'Older prior.')], TODAY);
    expect(line).toBe('Today: Newest today. | Prior: Older prior.');
    expect(line.length).toBeLessThanOrEqual(NEWSLINE_MAX_LENGTH);
  });

  it('newest first WITHIN a day = persisted append order reversed (M9)', () => {
    // Same-day entries arrive chronological (append order); the packer must
    // lead with the LATER one.
    const line = packNewsLine([item(TODAY, 'Morning story.'), item(TODAY, 'Afternoon story.')], TODAY);
    expect(line).toBe('Today: Afternoon story. | Today: Morning story.');
  });

  it('P2-2 boundary: a two-unit line at EXACTLY 240 code units is emitted', () => {
    // unit1 = 'Today: ' (7) + d1 ; assembled = unit1 + ' | ' (3) + 'Prior: ' (7) + d2
    const d1 = 'A'.repeat(100);                 // unit1 = 107
    const d2 = 'B'.repeat(240 - 107 - 3 - 7);   // assembled = exactly 240
    const line = packNewsLine([item(TODAY, d1), item(PRIOR, d2)], TODAY);
    expect(line).not.toBeNull();
    expect(line.length).toBe(240);
  });

  it('P2-2 boundary: 241 does NOT emit two units — falls back to the newest alone (never sliced)', () => {
    const d1 = 'A'.repeat(100);
    const d2 = 'B'.repeat(240 - 107 - 3 - 7 + 1); // assembled = 241
    const line = packNewsLine([item(TODAY, d1), item(PRIOR, d2)], TODAY);
    expect(line).toBe(`Today: ${d1}`);
    expect(line.length).toBe(107);
  });

  it('P2-2 boundary: a single unit at EXACTLY the ceiling is emitted', () => {
    const d = 'C'.repeat(240 - 7); // 'Today: ' + d = 240
    const line = packNewsLine([item(TODAY, d)], TODAY);
    expect(line).toHaveLength(240);
  });

  it('P2-42: the 363-char digest (measured renderer max) → NO line, logged — never sliced, never over-ceiling', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const line = packNewsLine([item(TODAY, 'D'.repeat(363))], TODAY);
      expect(line).toBeNull();
      const logged = logSpy.mock.calls.map((c) => c.join(' ')).filter((m) => m.includes('over ceiling'));
      expect(logged).toHaveLength(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('over-ceiling NEWEST does not fall back to an older unit (recency is never misrepresented)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const line = packNewsLine([item(TODAY, 'E'.repeat(300)), item(PRIOR, 'Small older story.')], TODAY);
      expect(line).toBeNull();
    } finally {
      logSpy.mockRestore();
    }
  });

  it('ceiling counts UTF-16 code units (JS .length), not characters', () => {
    // '𝛀' is one astral character = TWO code units; 120 of them prefix-padded
    // crosses 240 in code units while staying under it in code points.
    const astral = '𝛀'.repeat(117); // 234 code units; 'Today: ' + 234 = 241
    const line = packNewsLine([item(TODAY, astral)], TODAY);
    expect(line).toBeNull(); // 241 code units → fail closed
    const smaller = '𝛀'.repeat(116); // 232 + 7 = 239 → emits
    expect(packNewsLine([item(TODAY, smaller)], TODAY)).not.toBeNull();
  });
});

describe('buildNewsLinesForSymbols', () => {
  const entry = (storyId, ticker, digest) => ({
    storyId, reporter: 'doug', headline: 'H', publishedAt: null, validatorVersion: '1.6.0', quarantined: false,
    generationConfig: null,
    agentFacts: { eventType: 'earnings_recap', tickers: [ticker], primaryTicker: ticker, digest, chainId: storyId },
  });
  const dayDoc = (entries) => ({
    bySymbol: entries.reduce((m, e) => {
      for (const t of e.agentFacts.tickers) (m[t] ??= []).push(e.storyId);
      return m;
    }, {}),
    entries,
  });

  it('covered symbols get lines; uncovered symbols get NO key; null days → empty map', () => {
    const days = new Map([[TODAY, dayDoc([entry('s1', 'AMD', 'AMD rallies 5%.')])]]);
    const map = buildNewsLinesForSymbols(days, [TODAY, PRIOR], new Set(['AMD', 'PLTR']), TODAY);
    expect(map).toEqual({ AMD: 'Today: AMD rallies 5%.' });
    expect('PLTR' in map).toBe(false);

    expect(buildNewsLinesForSymbols(null, [TODAY, PRIOR], new Set(['AMD']), TODAY)).toEqual({});
  });
});
