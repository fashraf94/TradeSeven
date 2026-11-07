// api/_utils/evidence/evidence.test.js
//
// Huddle S1 — the evidence layer (Amendment C V1.2 §C1, §C10, §C13). The EODHD news
// fetcher is tested against the COMMITTED capture and reads no key the capture lacks.

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { EODHD_NEWS_CAPTURE, OBSERVED_KEYS } from '../__fixtures__/eodhdNewsCapture.js';
import {
  parseEodhdNews, parseEodhdNewsItem, normalizeUrl, newsIdOf, fetchEodhdNews, isAboutSymbol, sourceKindOfHost, NEWS_DROP_REASONS,
} from './eodhdNews.js';
import { storiesForSymbol } from './fantasyTimesStories.js';
import { closeFromDailyRows, fetchLastClose } from './lastClose.js';
import { packItem, packItemIdOf, headlineItem, PACK_KINDS } from './packItem.js';
import { newsfilterStatus } from './newsfilter.js';

const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const NEWS_CODE = strip(readFileSync(new URL('./eodhdNews.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
const itemsOf = (sym) => EODHD_NEWS_CAPTURE.find((c) => c.symbol === sym).items;

describe('EODHD /news against the committed capture (C §C13)', () => {
  it('the capture is what its header says: 2 calls, 3 items each, exactly the 7 observed keys, no id, no source', () => {
    expect(EODHD_NEWS_CAPTURE.map((c) => [c.symbol, c.status, c.items.length])).toEqual([['AAPL', 200, 3], ['PFE', 200, 3]]);
    for (const c of EODHD_NEWS_CAPTURE) {
      for (const item of c.items) {
        expect(Object.keys(item).filter((k) => k !== 'contentLength').sort()).toEqual([...OBSERVED_KEYS].sort());
        expect(item).not.toHaveProperty('id');
        expect(item).not.toHaveProperty('source');
        expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/);
      }
    }
  });

  it('the fetcher reads only keys the capture shows (no phantom field names)', () => {
    // every vendor item is named `raw` in the parser (isAboutSymbol's `item` is the same vendor item)
    const read = [...new Set([...NEWS_CODE.matchAll(/\braw\??\.(\w+)/g), ...NEWS_CODE.matchAll(/(?<![.\w])item\??\.(\w+)/g)].map((m) => m[1]))].sort();
    expect(read).toEqual(['date', 'link', 'symbols', 'title']);
    for (const key of read) expect(OBSERVED_KEYS, key).toContain(key);
    // no `source` key is read off a vendor item (the payload has none)
    expect(NEWS_CODE).not.toMatch(/\b(?:raw|item)\??\.source\b/);
  });

  it('PFE: the one item about Pfizer is kept; the scoreboard and the Xeris item are not about it', () => {
    const { items, drops } = parseEodhdNews(itemsOf('PFE'), { symbol: 'PFE' });
    expect(items.map((i) => i.title)).toEqual(['Pfizer (PFE) Maps Out $650 Million Connecticut Center For Global Clinical Trials']);
    expect(drops.map((d) => d.reason)).toEqual([NEWS_DROP_REASONS.NOT_ABOUT_SYMBOL, NEWS_DROP_REASONS.NOT_ABOUT_SYMBOL]);
    const [item] = items;
    expect(item).toMatchObject({ sourceKind: 'coverage', source: 'finance.yahoo.com', eventTime: null, primaryReleaseUrl: null, publishedAt: '2026-11-06T23:09:01.000Z' });
    expect(item.newsId).toBe(newsIdOf(normalizeUrl(itemsOf('PFE')[2].link)));
    expect(item.newsId).toMatch(/^[0-9a-f]{16}$/);
  });

  it('AAPL: all three captured items are about other companies (MRVL, GIL, CSCO) and are dropped', () => {
    const { items, drops } = parseEodhdNews(itemsOf('AAPL'), { symbol: 'AAPL' });
    expect(items).toEqual([]);
    expect(drops).toHaveLength(3);
    // ...while the same items are kept for the company they are about
    expect(isAboutSymbol(itemsOf('AAPL')[0], 'MRVL')).toBe(true);
    // review L2-9: a one- or two-letter ticker is named only in a ticker form, never as a word
    const crowd = ['AI.US', 'NVDA.US', 'AMD.US'];
    expect(isAboutSymbol({ title: 'Why AI chip stocks fell: NVDA, AMD slide', symbols: crowd }, 'AI')).toBe(false);
    expect(isAboutSymbol({ title: 'A Look at the Market Today', symbols: ['A.US', 'MSFT.US', 'AAPL.US'] }, 'A')).toBe(false);
    expect(isAboutSymbol({ title: 'C3.ai (AI) beats estimates', symbols: crowd }, 'AI')).toBe(true);
    expect(isAboutSymbol({ title: 'Agilent (NYSE: A) raises guidance', symbols: ['A.US', 'MSFT.US', 'AAPL.US'] }, 'A')).toBe(true);
    expect(isAboutSymbol({ title: 'Is $AI a buy?', symbols: crowd }, 'AI')).toBe(true);
    // a longer ticker is still named as a word
    expect(isAboutSymbol({ title: 'NVDA slides on export news', symbols: crowd }, 'NVDA')).toBe(true);
  });

  it('publishedAt is the vendor date, never the fetch instant: no date → no_publication_time; no link → no_url', () => {
    const base = itemsOf('PFE')[2];
    expect(parseEodhdNewsItem({ ...base, date: undefined }, { symbol: 'PFE' })).toEqual({ drop: NEWS_DROP_REASONS.NO_PUBLICATION_TIME });
    expect(parseEodhdNewsItem({ ...base, link: undefined }, { symbol: 'PFE' })).toEqual({ drop: NEWS_DROP_REASONS.NO_URL });
    expect(parseEodhdNewsItem({ ...base, link: 'javascript:alert(1)' }, { symbol: 'PFE' })).toEqual({ drop: NEWS_DROP_REASONS.NO_URL });
    expect(parseEodhdNewsItem(base, { symbol: 'PFE', sinceMs: Date.parse('2026-11-07T00:00:00Z') })).toEqual({ drop: NEWS_DROP_REASONS.BEFORE_WINDOW });
  });

  it('the newsId is stable across fetches and ignores fragments and utm parameters', () => {
    expect(newsIdOf(normalizeUrl('https://Finance.Yahoo.com/x?id=1&utm_source=a#frag'))).toBe(newsIdOf(normalizeUrl('https://finance.yahoo.com/x?id=1')));
    expect(sourceKindOfHost('globenewswire.com')).toBe('press_wire');
    expect(sourceKindOfHost('finance.yahoo.com')).toBe('coverage');
  });

  it('the fetch: one call naming the US ticker, abortable, an error is a status (never "no news")', async () => {
    const seen = [];
    const ok = await fetchEodhdNews({ symbol: 'BRK.B', sinceMs: null, apiKey: 'k', fetchImpl: async (url) => { seen.push(url); return { ok: true, json: async () => itemsOf('PFE') }; } });
    expect(ok.status).toBe('ok');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('s=BRK-B.US');
    const failed = await fetchEodhdNews({ symbol: 'PFE', apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 503 }) });
    expect(failed).toMatchObject({ status: 'error', reason: 'http_503' });
    const aborted = await fetchEodhdNews({ symbol: 'PFE', apiKey: 'k', fetchImpl: async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; } });
    expect(aborted).toMatchObject({ status: 'error', reason: 'aborted' });
    expect((await fetchEodhdNews({ symbol: 'PFE', apiKey: '' })).status).toBe('skipped');
  });
});

describe('FantasyTimes stories (C §C1 fantasytimes_story)', () => {
  it('newsId is the story document id, publishedAt the story\'s own, no url; deep dives are skipped', () => {
    const ts = (iso) => ({ toDate: () => new Date(iso) });
    const items = storiesForSymbol([
      { id: 's1', tickers: ['AAA', 'BBB'], headline: 'AAA jumps', publishedAt: ts('2026-11-09T12:00:00Z'), type: 'mover' },
      { id: 's2', tickers: ['AAA'], headline: 'Deep dive', publishedAt: ts('2026-11-09T11:00:00Z'), type: 'deepdive' },
      { id: 's3', tickers: ['CCC'], headline: 'Other', publishedAt: ts('2026-11-09T10:00:00Z') },
    ], 'AAA');
    expect(items).toEqual([{ newsId: 's1', eventId: null, publishedAt: '2026-11-09T12:00:00.000Z', eventTime: null, sourceKind: 'fantasytimes_story', source: 'FantasyTimes', title: 'AAA jumps', url: null, primaryReleaseUrl: null }]);
  });
});

describe('last close (V1.1 §7 rule 3)', () => {
  const rows = [{ date: '2026-11-06', close: 101.2, rawClose: 101.25 }, { date: '2026-11-05', close: 99 }];
  it('the previous session\'s unadjusted close, said with its date', () => {
    expect(closeFromDailyRows(rows, '2026-11-06')).toEqual({ lastClose: 101.25, lastCloseAsOf: '2026-11-06', reason: null });
  });
  it('a newest bar older than the previous session is stale: no close (null, never zero)', () => {
    expect(closeFromDailyRows(rows, '2026-11-09')).toEqual({ lastClose: null, lastCloseAsOf: '2026-11-06', reason: 'stale_close' });
    expect(closeFromDailyRows([], '2026-11-09').lastClose).toBeNull();
  });

  it('review L2-5: the daily-bar read has its own deadline (the shared cache takes no signal): a hang is a timeout, never a stuck job', async () => {
    const r = await fetchLastClose({ symbol: 'AAA', previousEtDate: '2026-11-06', getData: () => new Promise(() => {}), timeoutMs: 20 });
    expect(r).toEqual({ lastClose: null, lastCloseAsOf: null, reason: 'timeout', status: 'error' });
  });
});

describe('the pack item (C §C10)', () => {
  it('a deterministic 12-hex id of kind|recordKind|recordId|at; a headline is an attribution', () => {
    const a = packItem({ kind: 'close', fact: 'AAA closed at 50.00 on 2026-11-06', recordKind: 'symbolDayEvidence.price', recordId: '2026-11-09_AAA', label: 'EODHD daily bars', at: '2026-11-06', asOf: '2026-11-06' });
    expect(a.id).toBe(packItemIdOf({ kind: 'close', recordKind: 'symbolDayEvidence.price', recordId: '2026-11-09_AAA', at: '2026-11-06' }));
    expect(a.id).toMatch(/^[0-9a-f]{12}$/);
    expect(Object.keys(a).sort()).toEqual(['asOf', 'at', 'fact', 'id', 'kind', 'reason', 'source', 'status']);
    const h = headlineItem({ newsId: 'n1', source: 'finance.yahoo.com', title: 'Pfizer maps out a center', publishedAt: '2026-11-06T23:09:01.000Z', sourceKind: 'coverage' });
    expect(h.fact).toBe('finance.yahoo.com reported: Pfizer maps out a center');
    expect(h.status).toBe('verified');
    expect(PACK_KINDS).toEqual(['close', 'headline', 'event', 'holding', 'agent_pick', 'opener', 'prior_plan', 'source_status']);
    expect(() => packItem({ kind: 'rumor', fact: 'x' })).toThrow();
  });
});

describe('newsfilter (optional; env name only)', () => {
  it('skipped without a key, and skipped with one until a capture exists', () => {
    expect(newsfilterStatus({})).toMatchObject({ status: 'skipped', reason: 'no_api_key' });
    expect(newsfilterStatus({ NEWSFILTER_API_KEY: 'x' })).toMatchObject({ status: 'skipped', reason: 'no_capture' });
  });
});
