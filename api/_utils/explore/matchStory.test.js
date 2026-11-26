// api/_utils/explore/matchStory.test.js
//
// Explore publish step — THE MATCH, AND WHAT IS RECORDED (build prompt K-6, K-8, K-12; the Work an idea chat's
// conditions and additions of Nov 25). No network: the real fetchDocument over a transport that answers from the
// committed documents (__fixtures__/docs/, written by makeDocs.mjs) through __fixtures__/fixtureFetch.js.
//
// What the rows hold:
//   • matching: a quote found; a quote one word off; the rule's quotes, dashes, non-breaking space and line break,
//     and nothing looser; case kept; a table row in HTML and in a PDF; text only inside a script (not found); a
//     redirect; a refusal; a time-out; an oversized document; a private address; an http link;
//   • recording: the author's match and matched never survive; by 'machine' only on a found source quote; a cell
//     matched while its source's quote is not, and the reverse; notReported without matched; documentDate never from
//     `dated`; rule 1 on every match; matched true only on a source whose readAt and textHash are both set;
//   • one fetch per distinct link per run; the summary.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchStories, matchBlockOf, excerptMatched, summaryOf, isUnmatched } from './matchStory.js';
import { checkStories } from './storyCheck.js';
import { RULE_VERSION, underRule, textHashOf } from './matchRule.js';
import { fixtureFetcher, allFoundRoutes, pageOf, TEST_CONTACT, docBytes } from './__fixtures__/fixtureFetch.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const pilot = (id) => JSON.parse(readFileSync(path.join(HERE, '__fixtures__', 'pilot', `${id}.json`), 'utf8'));
const NOW = new Date('2026-11-25T15:00:00.000Z');
const FETCHED_AT = '2026-11-25T16:00:00.000Z';

const R = 'https://ir.example.com/release';
const TABLE = 'https://ir.example.com/table.pdf';
const TEXT = 'https://pjm.example.org/forecast.pdf';
const SCRIPT = 'https://ir.example.com/script-only';
const ROUTES = {
  [R]: { file: 'release.html', type: 'text/html; charset=utf-8' },
  [TABLE]: { file: 'table.pdf', type: 'application/octet-stream' },
  [TEXT]: { file: 'text.pdf', type: 'application/pdf' },
  [SCRIPT]: { file: 'script-only.html', type: 'text/html' },
  'https://ir.example.com/old': { redirect: R },
  'https://ir.example.com/denied': { status: 403 },
  'https://ir.example.com/slow': { hang: true },
  'https://ir.example.com/huge.pdf': { body: Buffer.alloc(4096, 32), type: 'application/pdf' },
  'https://intranet.example.com/release': { file: 'release.html', type: 'text/html' },
  'http://ir.example.com/release': { file: 'release.html', type: 'text/html' },
};
const HOSTS = { 'intranet.example.com': '10.20.30.40' };

/** One story of these sources and cells (one broad question, one reported measure). */
const storyOf = (sources, cells = []) => ({
  id: 'test-story',
  record: { version: 1, sources, questions: [{ id: 'q', shape: 'who_leads', measures: [{ kind: 'reported', name: 'Growth', cells }] }] },
});
async function matchOne(sources, cells = [], opts = {}) {
  const fetched = [];
  const out = await matchStories([storyOf(sources, cells)], { contact: TEST_CONTACT, fetchDocument: fixtureFetcher(ROUTES, { hosts: HOSTS, fetched, maxBytes: 1024, timeoutMs: 150 }), ...opts });
  return { ...out.stories[0], fetched };
}
const src = (id, url, excerpt, extra = {}) => ({ id, name: id, url, excerpt, dated: 'Nov 2026', ...extra });

describe('matching, word for word', () => {
  it.each([
    ['a quote found', R, 'Cloud revenue increased 48%', 'machine'],
    ['the page\'s curly quotes, en dash and non-breaking space, quoted with straight ones and a hyphen', R, 'increased 48% - driven by "data center" demand, to $46.0 billion.', 'machine'],
    ['a sentence broken over two lines', R, 'investments in technical infrastructure, were $51.4 billion', 'machine'],
    ['a quote one word off', R, 'Cloud revenue increased 49%', 'read'],
    ['case changed', R, 'cloud revenue increased 48%', 'read'],
    ['nothing looser: a space inside a figure', R, 'Cloud revenue increased 48 %', 'read'],
    ['a hidden paragraph is not visible text', R, 'Hidden revenue figure of 99%', 'read'],
    ['a sentence that sits only in the page\'s script', R, 'Cloud revenue grew 77% in the quarter', 'read'],
    ['a table row in a page', R, 'Revenue $ 3,661 $ 1,365', 'machine'],
    ['a table row in a PDF served as an octet stream', TABLE, 'Revenue $ 3,661 $ 1,365', 'machine'],
    ['a PDF sentence over two lines', TEXT, 'Data center billing peak load as of August 2026 is 4.8 GW', 'machine'],
    ['a page whose text sits only inside a script', SCRIPT, 'Data Center revenue of $107.6 billion, up 110% from a year ago', 'read'],
  ])('%s → %s', async (_, url, excerpt, by) => {
    const m = await matchOne([src('s1', url, excerpt)]);
    expect(m.record.sources[0].match.by).toBe(by);
  });

  it('what each kind of document records: type, readAt, documentDate from its own metadata, textHash', async () => {
    const m = await matchOne([src('s1', R, 'Cloud revenue increased 48%'), src('s2', TEXT, 'is 4.8 GW'), src('s3', SCRIPT, 'Data Center'), src('s4', TABLE, 'Net loss (110)')]);
    expect(m.sources.map((r) => [r.type, r.by, r.readAt, r.documentDate])).toEqual([
      ['html', 'machine', FETCHED_AT, '2026-10-29T20:05:00.000Z'],
      ['pdf', 'machine', FETCHED_AT, '2026-09-29T12:30:12.000Z'],
      ['html', 'read', FETCHED_AT, '2026-11-04T00:00:00.000Z'],
      ['pdf', 'machine', FETCHED_AT, '2026-11-06T12:00:00.000Z'],
    ]);
    expect(m.record.sources[0].match.textHash).toMatch(/^[0-9a-f]{64}$/);
    expect(m.record.sources[2].match.textHash).toBeNull(); // no visible text
    expect(m.sources[2].reason).toBe('no text could be read from the page');
  });

  it('a redirect is followed and the final document matched', async () => {
    const m = await matchOne([src('s1', 'https://ir.example.com/old', 'Cloud revenue increased 48%')]);
    expect(m.sources[0]).toMatchObject({ by: 'machine', finalUrl: R, redirects: [R] });
  });

  it.each([
    ['a refusal', 'https://ir.example.com/denied', 'the server answered 403'],
    ['a time-out', 'https://ir.example.com/slow', 'no answer within 0.15 seconds'],
    ['an oversized document', 'https://ir.example.com/huge.pdf', 'the document is larger than the size limit'],
    ['a private address', 'https://intranet.example.com/release', 'intranet.example.com resolves to 10.20.30.40, which is not a public address'],
    ['an http link', 'http://ir.example.com/release', 'the link is not https (http)'],
  ])('%s: by \'read\', nothing recorded as read, the reason in the report', async (_, url, reason) => {
    const m = await matchOne([src('s1', url, 'Cloud revenue increased 48%')], [{ symbol: 'MSFT', value: 48, sourceId: 's1', excerpt: 'Cloud revenue increased 48%' }]);
    expect(m.record.sources[0].match).toEqual({ by: 'read', readAt: null, documentDate: null, textHash: null, rule: 1 });
    expect(m.sources[0].reason).toBe(reason);
    expect(m.record.questions[0].measures[0].cells[0].matched).toBe(false);
    expect(m.findings.map((f) => [f.level, f.field])).toEqual([['unmatched', 'sources[0]'], ['unmatched', 'questions[0].measures[0].cells[0].matched']]);
  });
});

describe('what is recorded', () => {
  it('the author\'s match and matched never survive: removed by the check, and never kept if handed in anyway', async () => {
    const dp = pilot('dominion-data-centers');
    dp.sources.forEach((s) => { s.match = { by: 'machine', readAt: '2026-01-01T00:00:00Z', documentDate: '2026-01-01T00:00:00Z', textHash: 'f'.repeat(64), rule: 1 }; });
    const checked = checkStories([{ id: 'dominion-data-centers', raw: dp }, { id: 'ai-buildout', raw: pilot('ai-buildout') }], { now: NOW });
    const routes = Object.fromEntries(dp.sources.map((s) => [s.url, { status: 403 }]));
    const out = await matchStories(checked.stories, { contact: TEST_CONTACT, fetchDocument: fixtureFetcher(routes) });
    for (const s of out.stories[0].record.sources) expect(s.match).toEqual({ by: 'read', readAt: null, documentDate: null, textHash: null, rule: 1 });
    // handed straight to the matcher, a record that still carries results: every one is replaced
    const handed = storyOf(
      [src('s1', 'https://ir.example.com/denied', 'x', { match: { by: 'machine', readAt: FETCHED_AT, documentDate: null, textHash: 'a', rule: 1 } })],
      [
        { symbol: 'MSFT', value: 48, sourceId: 's1', excerpt: 'Cloud revenue increased 48%', matched: true },
        { symbol: 'AMZN', formula: 'growth_from_year_ago', matched: true, inputs: [{ value: 1, sourceId: 's1', excerpt: 'x 1', matched: true }, { value: 2, sourceId: 's1', excerpt: 'x 2', matched: true }] },
        { symbol: 'ORCL', notReported: true, matched: true },
      ],
    );
    const again = (await matchStories([handed], { contact: TEST_CONTACT, fetchDocument: fixtureFetcher(ROUTES) })).stories[0].record;
    expect(again.sources[0].match.by).toBe('read');
    const [stated, computed, notReported] = again.questions[0].measures[0].cells;
    expect(stated.matched).toBe(false);
    expect('matched' in computed).toBe(false);
    expect(computed.inputs.map((i) => i.matched)).toEqual([false, false]);
    expect('matched' in notReported).toBe(false);
  });

  it('by \'machine\' only on a source whose own excerpt was found; a cell is matched on its own excerpt, either way round', async () => {
    const m = await matchOne(
      [src('s1', R, 'not in the page at all'), src('s2', TABLE, 'Revenue $ 3,661 $ 1,365')],
      [
        { symbol: 'MSFT', value: 48, unit: 'percent', period: 'Q', sourceId: 's1', excerpt: 'Cloud revenue increased 48%' }, // source s1's own quote not found, this one is
        { symbol: 'AMZN', value: 1365, unit: 'USD millions', period: 'Q', sourceId: 's2', excerpt: 'Revenue $ 1,365' }, // source s2's quote found, this one is not
      ],
    );
    expect(m.record.sources.map((s) => s.match.by)).toEqual(['read', 'machine']);
    expect(m.record.questions[0].measures[0].cells.map((c) => c.matched)).toEqual([true, false]);
  });

  it('a computed cell: each input matched on its own excerpt; the cell itself carries no matched and no result', async () => {
    const m = await matchOne([src('s7', TABLE, 'Revenue $ 3,661 $ 1,365')], [
      { symbol: 'CRWV', formula: 'growth_from_year_ago', inputs: [
        { value: 3661, unit: 'USD millions', period: 'Q3 2026', sourceId: 's7', excerpt: 'Revenue $ 3,661 $ 1,365' },
        { value: 1365, unit: 'USD millions', period: 'Q3 2025', sourceId: 's7', excerpt: 'Revenue $ 3,661 $ 1,366' },
      ] },
    ]);
    const cell = m.record.questions[0].measures[0].cells[0];
    expect(cell.inputs.map((i) => i.matched)).toEqual([true, false]);
    expect(Object.keys(cell).sort()).toEqual(['formula', 'inputs', 'symbol']);
    expect(m.figures[0]).toMatchObject({ kind: 'computed', sourced: false });
  });

  it('a notReported cell gets no matched, and is never counted as sourced', async () => {
    const m = await matchOne([src('s1', R, 'Cloud revenue increased 48%')], [{ symbol: 'ORCL', notReported: true }]);
    expect(m.record.questions[0].measures[0].cells[0]).toEqual({ symbol: 'ORCL', notReported: true });
    expect(m.summary).toEqual({ carried: 0, sourced: 0, notChecked: 0, notReported: 1 });
  });

  it('documentDate is never the author\'s `dated`: a page with no date of its own records null', async () => {
    const m = await matchOne([src('s1', 'https://ir.example.com/plain', 'Hello there', { dated: 'Nov 2026' })], [], {
      fetchDocument: fixtureFetcher({ 'https://ir.example.com/plain': { html: pageOf(['Hello there.']) } }),
    });
    expect(m.record.sources[0].match).toMatchObject({ by: 'machine', documentDate: null });
  });

  it('every match block carries the rule\'s version, whatever came of the fetch', async () => {
    const m = await matchOne(Object.keys(ROUTES).map((url, i) => src(`s${i}`, url, 'Cloud revenue increased 48%')));
    expect(m.record.sources.map((s) => s.match.rule)).toEqual(Object.keys(ROUTES).map(() => RULE_VERSION));
    expect(Object.keys(m.record.sources[0].match).sort()).toEqual(['by', 'documentDate', 'readAt', 'rule', 'textHash']);
  });

  it('INVARIANT: a cell or input is matched only on a source whose readAt and textHash are both set', async () => {
    const urls = Object.keys(ROUTES);
    const sources = urls.map((url, i) => src(`s${i}`, url, 'x'));
    const quotes = ['Cloud revenue increased 48%', 'Revenue $ 3,661 $ 1,365', 'Data Center revenue of $107.6 billion, up 110% from a year ago', 'is 4.8 GW'];
    const cells = urls.flatMap((_, i) => quotes.map((q) => ({ symbol: 'X', value: 48, sourceId: `s${i}`, excerpt: q })));
    const m = await matchOne(sources, cells);
    const byId = new Map(m.record.sources.map((s) => [s.id, s.match]));
    const matchedCells = m.record.questions[0].measures[0].cells.filter((c) => c.matched === true);
    expect(matchedCells.length).toBeGreaterThan(3);
    for (const c of m.record.questions[0].measures[0].cells) {
      if (c.matched) expect(Boolean(byId.get(c.sourceId).readAt && byId.get(c.sourceId).textHash)).toBe(true);
    }
    // and at the function itself: text without either is never a match
    const ruled = underRule('Cloud revenue increased 48%');
    const full = { ruled, readAt: FETCHED_AT, textHash: textHashOf(ruled) };
    expect(excerptMatched('Cloud revenue', full)).toBe(true);
    expect(excerptMatched('Cloud revenue', { ...full, readAt: null })).toBe(false);
    expect(excerptMatched('Cloud revenue', { ...full, textHash: null })).toBe(false);
    expect(matchBlockOf({ excerpt: 'Cloud revenue' }, { ...full, textHash: null }).by).toBe('read');
    expect(matchBlockOf({ excerpt: 'Cloud revenue' }, { ...full, readAt: null }).by).toBe('read');
  });
});

describe('one run', () => {
  it('fetches each distinct link once, however many sources and stories cite it', async () => {
    const fetched = [];
    const fetchDocument = fixtureFetcher(ROUTES, { fetched });
    const a = storyOf([src('s1', TABLE, 'Revenue $ 3,661 $ 1,365'), src('s2', TABLE, 'Net loss (110)'), src('s3', R, 'Cloud revenue increased 48%')]);
    const b = { ...storyOf([src('s1', TABLE, 'Revenue')]), id: 'other' };
    await matchStories([a, b], { contact: TEST_CONTACT, fetchDocument });
    expect(fetched.sort()).toEqual([R, TABLE].sort());
  });

  it('the summary: sourced, not checked, not reported; and K-8\'s unmatched', () => {
    expect(summaryOf([{ kind: 'stated', sourced: true }, { kind: 'computed', sourced: false }, { kind: 'notReported', sourced: false }])).toEqual({ carried: 2, sourced: 1, notChecked: 1, notReported: 1 });
    expect(isUnmatched({ findings: [{ level: 'noted' }] })).toBe(false);
    expect(isUnmatched({ findings: [{ level: 'unmatched' }] })).toBe(true);
  });

  it('the pilot records against pages holding every quote: every source by machine, every figure sourced', async () => {
    const records = [pilot('ai-buildout'), pilot('dominion-data-centers')];
    const checked = checkStories([{ id: 'ai-buildout', raw: records[0] }, { id: 'dominion-data-centers', raw: records[1] }], { now: NOW });
    const out = await matchStories(checked.stories, { contact: TEST_CONTACT, fetchDocument: fixtureFetcher(allFoundRoutes(records)) });
    expect(out.stories.map((s) => s.findings)).toEqual([[], []]);
    expect(out.stories[0].summary).toEqual({ carried: 4, sourced: 4, notChecked: 0, notReported: 0 });
    expect(out.links).toHaveLength(new Set(records.flatMap((r) => r.sources.map((s) => s.url))).size);
    expect(docBytes('table.pdf').subarray(0, 5).toString()).toBe('%PDF-');
  });
});
