// api/_utils/exaCatalystFetch.test.js
// Alex Catalyst Confirmation mini-arc (spec V1.1) — F2 (downgraded) acceptance.
//   Channel tagging (founder addition #2): concrete trigger-day-dated →
//     [ATTRIBUTION]; off-day / undated → [CONTEXT]; mirror host → dropped.
//   Date-laundering guard: an off-window claimed date never reaches attribution.
//   R4 degrade: an EXA API error → empty channels, NEVER throws (the Sonar path
//     survives); both empty → the honest no-catalyst framing renders.
//
// We mock global.fetch (not the module) so the real generic exaClient transport
// runs — auth header, error handling, cost passthrough are all exercised.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchExaCatalystChannels,
  buildRetrievalChannels,
  renderRetrievalChannelsBlock,
  hostOf,
  EXCLUDED_DOMAINS,
} from './exaCatalystFetch.js';

const DATE = '2026-07-31';
const realFetch = global.fetch;
const okJson = (obj) => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) });

beforeEach(() => { process.env.EXA_API_KEY = 'test-key'; });
afterEach(() => { global.fetch = realFetch; vi.restoreAllMocks(); });

describe('fetchExaCatalystChannels — tagging + guards', () => {
  it('tags a concrete trigger-day-dated result as ATTRIBUTION and off-day/undated as CONTEXT', async () => {
    global.fetch = vi.fn().mockResolvedValue(okJson({
      results: [
        { title: 'Alphabet exec steps down', url: 'https://reuters.com/a', publishedDate: '2026-07-31T14:00:00Z', highlights: ['Leadership change confirmed.'] },
        { title: 'Old antitrust piece', url: 'https://theverge.com/b', publishedDate: '2025-09-12T00:00:00Z', text: 'Stale.' },
        { title: 'Undated blog', url: 'https://example.com/c', publishedDate: null, text: 'No date.' },
      ],
      costDollars: { total: 0.007 },
    }));
    const ch = await fetchExaCatalystChannels({ symbol: 'GOOGL', companyName: 'Alphabet', direction: 'down', marketDate: DATE });
    expect(ch.degraded).toBe(false);
    expect(ch.attribution.map((x) => x.host)).toEqual(['reuters.com']);
    expect(ch.context.map((x) => x.host).sort()).toEqual(['example.com', 'theverge.com']);
    expect(ch.costDollars).toEqual({ total: 0.007 });
  });

  it('sends the x-api-key header (generic exaClient transport)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ results: [], costDollars: null }));
    global.fetch = fetchMock;
    await fetchExaCatalystChannels({ symbol: 'GOOGL', companyName: 'Alphabet', direction: 'down', marketDate: DATE });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.exa.ai/search');
    expect(opts.headers['x-api-key']).toBe('test-key');
    expect(opts.headers.Authorization).toBeUndefined(); // NOT Bearer
    const body = JSON.parse(opts.body);
    expect(body.startPublishedDate).toBe('2026-07-31T00:00:00.000Z');
    expect(body.endPublishedDate).toBe('2026-07-31T23:59:59.999Z');
    expect(body.excludeDomains).toEqual(EXCLUDED_DOMAINS);
  });

  it('DROPS excluded mirror/clone hosts even when the claimed date is in-window (date-laundering guard)', async () => {
    global.fetch = vi.fn().mockResolvedValue(okJson({
      results: [
        { title: 'Laundered stale story', url: `https://${EXCLUDED_DOMAINS[0]}/x`, publishedDate: '2026-07-31T09:00:00Z', text: 'Sept 2025 content, July 2026 stamp.' },
        { title: 'Real one', url: 'https://bloomberg.com/y', publishedDate: '2026-07-31T15:00:00Z', highlights: ['Real.'] },
      ],
      costDollars: null,
    }));
    const ch = await fetchExaCatalystChannels({ symbol: 'GOOGL', companyName: 'Alphabet', direction: 'down', marketDate: DATE });
    const allHosts = [...ch.attribution, ...ch.context].map((x) => x.host);
    expect(allHosts).not.toContain(EXCLUDED_DOMAINS[0]);
    expect(ch.attribution.map((x) => x.host)).toEqual(['bloomberg.com']);
  });

  it('R4 degrade: an EXA API error yields empty channels and NEVER throws', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' });
    const ch = await fetchExaCatalystChannels({ symbol: 'GOOGL', companyName: 'Alphabet', direction: 'down', marketDate: DATE });
    expect(ch.degraded).toBe(true);
    expect(ch.attribution).toEqual([]);
    expect(ch.context).toEqual([]);
  });
});

describe('buildRetrievalChannels — confidence-gated Sonar + EXA merge', () => {
  it('a HIGH-confidence validated catalyst is attribution-grade; low/undefined is context', () => {
    const hi = buildRetrievalChannels({ validatedCatalyst: 'DeepMind founder named chairman', validatedConfidence: 'high' });
    expect(hi.attribution).toHaveLength(1);
    expect(hi.context).toHaveLength(0);

    const lo = buildRetrievalChannels({ validatedCatalyst: 'vague macro chatter', validatedConfidence: 'low' });
    expect(lo.attribution).toHaveLength(0);
    expect(lo.context).toHaveLength(1);
  });

  it('merges EXA channels alongside the validated catalyst', () => {
    const ch = buildRetrievalChannels({
      validatedCatalyst: 'corroborated event',
      validatedConfidence: 'high',
      exaChannels: { attribution: [{ source: 'exa', snippet: 'exa dated' }], context: [{ source: 'exa', snippet: 'exa color' }] },
    });
    expect(ch.attribution).toHaveLength(2);
    expect(ch.context).toHaveLength(1);
  });
});

describe('renderRetrievalChannelsBlock — the tags are the structural signal', () => {
  it('empty attribution renders the honest no-catalyst framing (C2 expected outcome)', () => {
    const block = renderRetrievalChannelsBlock({ attribution: [], context: [{ source: 'sonar', snippet: 'background' }] });
    expect(block).toContain('[ATTRIBUTION] — none');
    expect(block).toContain('no clear catalyst identified');
    expect(block).toContain('[CONTEXT]');
  });

  it('renders attribution items under the binding [ATTRIBUTION] tag', () => {
    const block = renderRetrievalChannelsBlock({
      attribution: [{ source: 'exa', title: 'Exec change', snippet: 'confirmed', url: 'https://reuters.com/a', host: 'reuters.com', publishedDate: '2026-07-31' }],
      context: [],
    });
    expect(block).toContain('[ATTRIBUTION] — concrete');
    expect(block).toContain('Exec change');
    expect(block).toContain('reuters.com');
    expect(block).toContain('[CONTEXT] — none');
  });
});

describe('hostOf', () => {
  it('normalizes host, stripping www', () => {
    expect(hostOf('https://www.Reuters.com/path')).toBe('reuters.com');
    expect(hostOf('not a url')).toBe('');
  });
});
