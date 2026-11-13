// api/_utils/sharedResearch/opening.test.js
//
// Shared Research B1 — the deterministic opening (spec §4.2, §5.2, §8, §15 S-1).
// Every finding is built through the record model (buildFinding) here, so a
// shape the record refuses fails this file, not the route.

import { describe, it, expect } from 'vitest';
import { openingFindingsOf, namesInScopeOf, dropTextOf, dropTypeOf, estimatesFactOf, storedRowsOf } from './opening.js';
import { buildFinding } from '../researchRecords/model.js';

const NOW = '2026-11-12T15:00:00.000Z';
const EX = { exchangeId: '6f1c2b0e-8a7d-4c3b-9e21-0a5d4f3e2b1c', text: 'my words', at: NOW };
let n = 0;
const build = (raws) => raws.map((r) => buildFinding(r, { findingId: `f_30000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, nowIso: NOW }));
const STORED = {
  estimates: { computedAt: '2026-11-12T06:00:00.000Z', stocks: { NVDA: { forwardEstimates: { currentYear: { growth: '0.481' }, nextYear: { growth: '0.312', numAnalysts: '42' } } } } },
  claims: { NVDA: { count: 15, newest: '2026-11-05' }, AMD: { count: 0, newest: null } },
};
const STORY = { id: 'story-1', headline: 'Chip makers race to add capacity', reporterName: 'Kim', reporterBeat: 'Sector Strategist', publishedAt: '2026-11-12T13:00:00.000Z', primaryTicker: 'NVDA', tickers: ['NVDA', 'AMD', 'VRT', 'nvda'] };
const DROP = (input, parse = {}) => ({ input, parse: { topic: 'AI capex', dataPoints: ['NVDA revenue up 94% YoY', 'capex guide raised'], extractedText: 'OCR TEXT', impliedTickers: ['MSFT'], ...parse }, validation: { validated: [{ symbol: 'NVDA', sectorId: 'XLK' }] }, droppedAt: '2026-11-12T14:00:00.000Z' });

describe('the item (a FantasyTimes story)', () => {
  it('a coverage finding — reporter content, never Source-backed — then the stored facts for the names, then the next action', () => {
    const names = namesInScopeOf({ entryKind: 'item', story: STORY });
    expect(names).toEqual(['NVDA', 'AMD']); // VRT is not in the universe; nvda is NVDA once
    const fs = build(openingFindingsOf({ entryKind: 'item', story: STORY, names, stored: STORED, nowIso: NOW }));
    expect(fs[0]).toMatchObject({
      kind: 'coverage', symbol: 'NVDA', status: 'unverified', statusReason: 'reporter_content',
      source: { recordKind: 'fantasyTimesStories', recordId: 'story-1', label: 'FantasyTimes · Kim · Sector Strategist' }, at: '2026-11-12T13:00:00.000Z',
    });
    expect(fs.filter((f) => f.kind === 'earnings_fact').map((f) => [f.symbol, f.source.recordKind, f.status])).toEqual([
      ['NVDA', 'estimatesCache', 'verified'], ['NVDA', 'ingestedClaims', 'verified'],
    ]);
    expect(fs.find((f) => f.source.recordKind === 'ingestedClaims').fact).toContain('15 or more stored claims about NVDA');
    expect(fs.at(-1)).toMatchObject({ kind: 'next_action', statusReason: 'proposed', source: { recordKind: 'kb', recordId: 'baseline@v0' } });
    expect(fs.some((f) => f.status === 'verified' && f.kind === 'coverage')).toBe(false);
  });
  it('the estimates fact carries the cache\'s numbers and its date, never the write time', () => {
    expect(estimatesFactOf('NVDA', STORED.estimates.stocks.NVDA)).toBe('Analyst consensus growth for NVDA: 48.1% for the current fiscal year and 31.2% for the next (42 analysts on the next year).');
    expect(estimatesFactOf('AMD', {})).toBeNull();
  });
});

describe('the observation', () => {
  it('the player\'s words as "Your words" from their exchange; the framing\'s check is the next action', () => {
    const fs = build(openingFindingsOf({ entryKind: 'observation', playerExchange: EX, frame: { check: 'Who sells review tools.' }, names: [], stored: {}, nowIso: NOW }));
    expect(fs).toHaveLength(2);
    expect(fs[0]).toMatchObject({ kind: 'observation', fact: 'my words', statusReason: 'player_words', source: { recordKind: 'exchange', recordId: EX.exchangeId, label: 'Your words' } });
    expect(fs[1]).toMatchObject({ kind: 'next_action', fact: 'Who sells review tools.' });
  });
});

describe('§15 S-1 — the SignalDrop', () => {
  it('"Your drop" is the player\'s text; each dataPoint is a "From your drop" inference naming a validated symbol it states', () => {
    const drop = DROP({ type: 'text', text: 'NVDA is the AI capex winner', note: null });
    const names = namesInScopeOf({ entryKind: 'signaldrop', drop });
    expect(names).toEqual(['NVDA']); // impliedTickers are never names in scope
    const fs = build(openingFindingsOf({ entryKind: 'signaldrop', drop, playerExchange: EX, names, stored: STORED, nowIso: NOW }));
    expect(fs[0]).toMatchObject({ kind: 'observation', fact: 'NVDA is the AI capex winner', statusReason: 'player_drop', source: { label: 'Your drop · text' } });
    expect(fs.slice(1, 3).map((f) => [f.kind, f.statusReason, f.symbol, f.source.label])).toEqual([
      ['inference', 'from_drop', 'NVDA', 'From your drop'], ['inference', 'from_drop', null, 'From your drop'],
    ]);
    expect(JSON.stringify(fs)).not.toContain('OCR TEXT');
    expect(JSON.stringify(fs)).not.toContain('MSFT');
  });
  it('a url drop is the url then the note; an image is its note or "An image you dropped"', () => {
    expect(dropTextOf(DROP({ type: 'url', url: 'https://x.example/a', note: 'see the guide' }))).toBe('https://x.example/a · see the guide');
    expect(dropTextOf(DROP({ type: 'url', url: 'https://x.example/a', note: null }))).toBe('https://x.example/a');
    expect(dropTextOf(DROP({ type: 'image', imagePresent: true, note: 'the chart' }))).toBe('the chart');
    expect(dropTextOf(DROP({ type: 'image', imagePresent: true, note: null }))).toBe('An image you dropped');
    expect(dropTypeOf(DROP({ type: 'url' }))).toBe('link');
  });
  it('a bailout parse still opens: the drop is the player\'s words either way', () => {
    const drop = { ...DROP({ type: 'text', text: 'just vibes', note: null }, { dataPoints: [] }), shouldBailout: true, validation: { validated: [] } };
    const fs = build(openingFindingsOf({ entryKind: 'signaldrop', drop, playerExchange: EX, names: [], stored: {}, nowIso: NOW }));
    expect(fs.map((f) => f.kind)).toEqual(['observation', 'next_action']);
  });
});

describe('the unwritten projection (F14)', () => {
  it('rankings and peer rows per name, never findings', () => {
    expect(storedRowsOf(['NVDA'], { peers: { NVDA: { name: 'NVIDIA Corporation', sector: 'Technology', metrics: { pe: 40 } } } })).toEqual([
      { symbol: 'NVDA', name: 'NVIDIA Corporation', peer: { sector: 'Technology', metrics: { pe: 40 }, asOf: null }, ranking: null },
    ]);
  });
});
