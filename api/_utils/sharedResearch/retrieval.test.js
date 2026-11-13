// api/_utils/sharedResearch/retrieval.test.js
//
// Shared Research B1 — the retrieval adapter (spec §6.5). The search is a seam:
// no network here.

import { describe, it, expect } from 'vitest';
import { retrieve, exaBodyOf, itemsOf, queryOf, costOf, RETRIEVAL_TIMEOUT_MS } from './retrieval.js';
import { EXCLUDED_DOMAINS } from '../exaCatalystFetch.js';

describe('the Exa body (spec §6.5)', () => {
  it('auto search, five results, highlights only, the mover layer\'s excluded domains', () => {
    expect(exaBodyOf({ query: 'q' })).toEqual({
      query: 'q', type: 'auto', numResults: 5,
      contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 }, text: false },
      excludeDomains: [...EXCLUDED_DOMAINS],
    });
  });
  it('the query: the focus or the question, the direction, up to three names', () => {
    expect(queryOf({ question: 'Q?', symbols: ['A', 'B', 'C', 'D'] })).toBe('Q? — A B C');
    expect(queryOf({ question: 'Q?', focus: 'ETN switchgear', direction: 'look at orders' })).toBe('ETN switchgear — look at orders');
  });
});

describe('items', () => {
  it('numbered in rank order; a non-http(s) url or one past 1,024 characters is dropped', () => {
    const items = itemsOf([
      { url: 'ftp://x.example/a', title: 'ftp' },
      { url: 'https://www.reuters.com/a', title: 'A', publishedDate: '2026-11-05T12:00:00.000Z', highlights: ['h1', 'h2', 'h3'] },
      { url: `https://x.example/${'p'.repeat(1100)}`, title: 'long' },
      { url: 'https://example.org/b', publishedDate: 'not a date' },
    ]);
    expect(items).toEqual([
      { index: 0, url: 'https://www.reuters.com/a', title: 'A', host: 'reuters.com', publishedDate: '2026-11-05T12:00:00.000Z', highlights: ['h1', 'h2'] },
      { index: 1, url: 'https://example.org/b', title: 'example.org', host: 'example.org', publishedDate: null, highlights: [] },
    ]);
  });
  it('Exa\'s own cost figure', () => {
    expect(costOf({ total: 0.005 })).toBe(0.005);
    expect(costOf(null)).toBeNull();
  });
});

describe('retrieve never throws', () => {
  it('answers items, cost, elapsed and the read time', async () => {
    let seen = null;
    const out = await retrieve({ question: 'Q?', search: async (body, opts) => { seen = { body, opts }; return { results: [{ url: 'https://a.example/x', title: 'X' }], costDollars: { total: 0.01 } }; }, now: () => Date.parse('2026-11-12T15:00:00.000Z') });
    expect(seen.opts).toEqual({ timeoutMs: RETRIEVAL_TIMEOUT_MS });
    expect(out).toMatchObject({ costDollars: 0.01, elapsedMs: 0, readAt: '2026-11-12T15:00:00.000Z' });
    expect(out.items).toHaveLength(1);
  });
  it('a failed or timed-out search answers { error } (the step proceeds without retrieval)', async () => {
    expect(await retrieve({ question: 'Q?', search: async () => { throw new Error('Exa timeout'); } })).toMatchObject({ error: 'retrieval_timeout' });
    expect(await retrieve({ question: 'Q?', search: async () => { throw new Error('EXA_API_KEY not configured'); } })).toMatchObject({ error: 'retrieval_failed' });
  });
});
