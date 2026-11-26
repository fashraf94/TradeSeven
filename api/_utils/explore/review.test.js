// api/_utils/explore/review.test.js
//
// Explore publish step — THE REVIEW ROUND'S ROWS (build prompt K-15; build report §11). One row (or a few) per
// confirmed finding of the three lenses, each named by its finding: H = honesty, A = agreement, S = safety. Characters
// the word-for-word rule changes are built from their code points, so this file holds no invisible byte.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { checkStories, currencyOf, LEVELS } from './storyCheck.js';
import { authorRecordOf, contentHashOf, wordsIn } from './storyRecord.js';
import { quoteIn, underRule } from './matchRule.js';
import { matchStories, dateCheckOf } from './matchStory.js';
import { documentDateOf, pdfDateOf, extractText } from './extractText.js';
import { fixtureFetcher, pageOf, TEST_CONTACT } from './__fixtures__/fixtureFetch.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OV = 'ai-buildout';
const DP = 'dominion-data-centers';
const pilot = (id) => JSON.parse(readFileSync(path.join(HERE, '__fixtures__', 'pilot', `${id}.json`), 'utf8'));
const NOW = new Date('2026-11-25T15:00:00.000Z');
const ch = (cp) => String.fromCodePoint(cp);
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

function checkPair(mutate = () => {}, opts = {}) {
  const ov = pilot(OV);
  const dp = pilot(DP);
  mutate(ov, dp);
  return checkStories([{ id: OV, raw: ov }, { id: DP, raw: dp }], { now: NOW, ...opts });
}
const refusedOf = (r, id) => r.stories.find((s) => s.id === id).findings.filter((f) => f.level === LEVELS.REFUSED).map((f) => [f.rule, f.field]);
const notedOf = (r, id) => r.stories.find((s) => s.id === id).findings.filter((f) => f.level === LEVELS.NOTED).map((f) => [f.rule, f.field]);
const cloud = (ov) => ov.questions[0];

/** One story of these sources and cells, matched against `routes`. */
async function matchOne(sources, cells, routes) {
  const story = { id: 't', record: { version: 1, sources, questions: [{ id: 'q', shape: 'who_leads', measures: [{ kind: 'reported', name: 'm', cells }] }] } };
  return (await matchStories([story], { contact: TEST_CONTACT, fetchDocument: fixtureFetcher(routes) })).stories[0];
}
const URL_A = 'https://ir.example.com/a';

describe('H1 / A1 — a match result the author wrote never survives, wherever it sits', () => {
  it('every `match` and `matched` key is removed at any depth, and each is named', () => {
    const ov = pilot(OV);
    ov.match = { by: 'machine', readAt: '2026-01-01T00:00:00Z', textHash: 'f'.repeat(64), rule: 1 };
    ov.sources[0].matched = true;
    ov.connections[0].match = { by: 'machine' };
    ov.questions[0].matched = true;
    cloud(ov).measures[0].cells[0].match = { by: 'machine' };
    cloud(ov).measures[0].cells[3].inputs[0].match = { by: 'machine' };
    cloud(ov).measures[1].matched = true;
    cloud(ov).measures[1].cells = [{ symbol: 'MSFT', matched: true }];
    const { record, discarded } = authorRecordOf(ov);
    expect([...discarded].sort()).toEqual([
      'status', 'publishedAt', 'connections[0].match', 'sources[0].matched', 'questions[0].measures[0].cells[0].match',
      'questions[0].measures[0].cells[3].inputs[0].match', 'questions[0].measures[1].matched', 'questions[0].measures[1].cells[0].matched',
      'questions[0].matched', 'match',
    ].sort());
    expect(JSON.stringify(record)).not.toMatch(/"match(ed)?"/);
    const r = checkStories([{ id: OV, raw: ov }, { id: DP, raw: pilot(DP) }], { now: NOW });
    expect(r.stories[0].findings.filter((f) => f.rule === 'K-11')).toHaveLength(1);
    expect(JSON.stringify(r.stories[0].record)).not.toMatch(/"match(ed)?"/);
  });
});

describe('H2 — a quote that cuts a number in the document is not found (rule 1)', () => {
  it.each([
    ['48% this quarter', 'grew 148% this quarter', false],
    ['48% this quarter', 'moved -48% this quarter', false],
    ['48% decline', `moved ${ch(0x2212)}48% decline`, false],
    ['Revenue was $3,661', 'Revenue was $3,661.4 million', false],
    ['Sales were 3', 'Sales were 3,661 units', false],
    ['Sales were 3,661', 'Sales were 3,661 units', true],
    ['48% here', 'grew 148% here and 48% here', true],
    ['18 months', 'closing in 12-18 months', true],
    ['2026 results', 'the Q3-2026 results', true],
    ['were $51.4', 'were $51.4.', true],
    ['were $51.4', 'were $51.45', false],
    ['48% this quarter', 'grew 48% this quarter', true],
  ])('%j in %j → %s', (quote, text, expected) => {
    expect(quoteIn(underRule(text), quote)).toBe(expected);
  });
});

describe('H3 — K-7 reads the excerpt under the same rule as the match', () => {
  it('a figure dash or em dash before the figure is a minus sign for the check, as it is for the match', () => {
    const r = checkPair((ov) => { Object.assign(cloud(ov).measures[0].cells[0], { excerpt: `Operating margin of ${ch(0x2012)}48%`, value: 48 }); });
    expect(refusedOf(r, OV)).toEqual([['K-7', 'questions[0].measures[0].cells[0].value']]);
    const ok = checkPair((ov) => { Object.assign(cloud(ov).measures[0].cells[0], { excerpt: `Operating margin of ${ch(0x2014)}48%`, value: -48 }); });
    expect(ok.refused).toBe(false);
  });
});

describe('H5 / A7 — two sources under one id are refused', () => {
  it('K-4(h), on the second', () => {
    const r = checkPair((ov) => { ov.sources.push({ ...ov.sources[3], url: 'https://example.com/other' }); });
    expect(refusedOf(r, OV)).toEqual([['K-4(h)', 'sources[7].id']]);
  });
});

describe('H6 — a footnote mark never joins the figure before it', () => {
  it('<sup> and <sub> are edges', async () => {
    const m = await matchOne([{ id: 's1', url: URL_A, excerpt: '$51.41 billion' }], [], { [URL_A]: { html: '<p>were $51.4<sup>1</sup> billion and H<sub>2</sub>O</p>' } });
    expect(m.record.sources[0].match.by).toBe('read');
    const m2 = await matchOne([{ id: 's1', url: URL_A, excerpt: '$51.4 1 billion' }], [], { [URL_A]: { html: '<p>were $51.4<sup>1</sup> billion</p>' } });
    expect(m2.record.sources[0].match.by).toBe('machine');
  });
});

describe('H7 — text the page hides itself is not visible text', () => {
  it.each([
    ['display none', '<p style="display: none">Hidden 48% figure</p>'],
    ['visibility hidden', '<div style="color:red;visibility:hidden">Hidden 48% figure</div>'],
    ['the hidden attribute', '<p hidden>Hidden 48% figure</p>'],
    ['a style element', '<style>Hidden 48% figure</style>'],
    ['a noscript block', '<noscript>Hidden 48% figure</noscript>'],
    ['a template', '<template>Hidden 48% figure</template>'],
    ['an iframe', '<iframe>Hidden 48% figure</iframe>'],
    ['an object', '<object>Hidden 48% figure</object>'],
    ['a script', '<script>var t = "Hidden 48% figure";</script>'],
  ])('%s', async (_, html) => {
    const m = await matchOne([{ id: 's1', url: URL_A, excerpt: 'Hidden 48% figure' }], [], { [URL_A]: { html: `<body><p>Visible text.</p>${html}</body>` } });
    expect(m.record.sources[0].match.by).toBe('read');
  });
  it('control: the same sentence, shown, is found', async () => {
    const m = await matchOne([{ id: 's1', url: URL_A, excerpt: 'Hidden 48% figure' }], [], { [URL_A]: { html: '<body><p>Hidden 48% figure</p></body>' } });
    expect(m.record.sources[0].match.by).toBe('machine');
  });
});

describe('H8 — what is recorded, pinned where no row pinned it', () => {
  it('textHash is the SHA-256 of the extracted text UNDER THE RULE', async () => {
    const m = await matchOne([{ id: 's1', url: URL_A, excerpt: 'a b' }], [], { [URL_A]: { html: `<body><p>a${ch(0xa0)}${ch(0xa0)}b</p></body>` } });
    expect(m.record.sources[0].match.textHash).toBe(sha('a b'));
  });
  it('any other type has no text: a plain-text page holding the quote is `read`', async () => {
    const m = await matchOne([{ id: 's1', url: URL_A, excerpt: 'Cloud revenue increased 48%' }], [], { [URL_A]: { body: 'Cloud revenue increased 48%', type: 'text/plain' } });
    expect(m.record.sources[0].match).toMatchObject({ by: 'read', textHash: null });
    expect(m.sources[0].reason).toMatch(/a type with no text here \(text\/plain\)/);
    expect((await extractText({ bytes: Buffer.from('<p>x</p>'), contentType: 'application/json' })).text).toBeNull();
  });
});

describe('H9 — a document\'s own date never depends on this machine\'s time zone', () => {
  it.each([
    ['2026-10-29T20:05:00Z', '2026-10-29T20:05:00.000Z'],
    ['2026-10-29T20:05:00-04:00', '2026-10-30T00:05:00.000Z'],
    ['2026-10-29T20:05:00+0530', '2026-10-29T14:35:00.000Z'],
    ['2026-10-29T20:05:00', '2026-10-29'],
    ['2026-10-29', '2026-10-29'],
    ['October 29, 2026', null],
    ['2026-02-30', null],
    ['', null],
  ])('%j → %j', (raw, expected) => {
    expect(documentDateOf(raw)).toBe(expected);
  });
  it.each([
    ["D:20260929083012-04'00'", '2026-09-29T12:30:12.000Z'],
    ['D:20261106120000Z', '2026-11-06T12:00:00.000Z'],
    ['D:20261106120000', '2026-11-06'],
    ['D:20261106', '2026-11-06'],
    ['D:2026', null],
    ['D:202611', null],
  ])('PDF %j → %j', (raw, expected) => {
    expect(pdfDateOf(raw)).toBe(expected);
  });
});

describe('A2 — groups and measures are counted as companies and measures, not entries', () => {
  it.each([
    ['a company named twice', (ov) => { cloud(ov).group[3] = { symbol: 'MSFT', name: 'Microsoft' }; cloud(ov).measures[0].cells.splice(3, 1); }, [['K-4(j)', 'questions[0].group[3].symbol']]],
    ['a stored key twice', (ov) => { cloud(ov).measures[2].storedKey = 'revenueGrowthYOY'; }, [['K-4(j)', 'questions[0].measures'], ['K-4(j)', 'questions[0].measures[2].storedKey']]],
    ['a measure of neither kind', (ov) => { cloud(ov).measures.push({ kind: 'computed-later' }); }, [['K-4(j)', 'questions[0].measures[3].kind']]],
  ])('%s is refused', (_, mutate, expected) => {
    expect(refusedOf(checkPair(mutate), OV)).toEqual(expected);
  });
});

describe('A3 — a specific question\'s group is ticker-checked too', () => {
  it('K-4(f)', () => {
    const r = checkPair((ov, dp) => { dp.questions[1].group = [{ symbol: 'ZZZZ', name: 'Nobody' }]; });
    expect(refusedOf(r, DP)).toEqual([['K-4(f)', 'questions[1].group[0].symbol']]);
  });
});

describe('A5 — an id is the address, exactly as written', () => {
  it('a connection id with spaces at its ends is not the id a question names without them', () => {
    const r = checkPair((ov) => { ov.connections[1].id = ' cloud '; });
    expect(refusedOf(r, OV)).toEqual([['K-4(i)', 'questions[0].fromConnection']]);
  });
});

describe('A6 — a computed cell carries no result under any name', () => {
  it('K-4(k), on the extra key', () => {
    const r = checkPair((ov) => { cloud(ov).measures[0].cells[3].growth = 168.2; });
    expect(refusedOf(r, OV)).toEqual([['K-4(k)', 'questions[0].measures[0].cells[3].growth']]);
  });
});

describe('A8 — a body written as one string is counted', () => {
  it('K-4(d)', () => {
    expect(wordsIn('one two three')).toBe(3);
    const r = checkPair((ov, dp) => { dp.body = Array.from({ length: 301 }, () => 'word').join(' '); });
    expect(refusedOf(r, DP)).toEqual([['K-4(d)', 'body']]);
  });
});

describe('A10 / A11 — a currency named by a sign or a word; periods and units compared trimmed', () => {
  it.each([
    ['USD millions', 'USD'], ['$ millions', 'USD'], ['US dollars, millions', 'USD'], ['U.S. dollars', 'USD'],
    ['euros', 'EUR'], ['GBP thousands', 'GBP'], ['percent', null], ['GW', null], ['dollar-cost', 'USD'],
  ])('%j → %j', (unit, code) => { expect(currencyOf(unit)).toBe(code); });
  it('a ratio in "US dollars, millions" over "$ millions", one period with a stray space', () => {
    const r = checkPair((ov) => {
      const c = cloud(ov).measures[0].cells[3];
      c.formula = 'ratio';
      c.inputs[0].unit = 'US dollars, millions';
      c.inputs[1].unit = '$ millions';
      c.inputs[1].period = `${c.inputs[0].period} `;
    });
    expect(r.refused).toBe(false);
  });
});

describe('A12 — an empty door reads "not written yet"', () => {
  it.each([[null], ['']])('leadsToStory %j is not refused', (v) => {
    expect(checkPair((ov) => { ov.connections[0].leadsToStory = v; }).refused).toBe(false);
  });
});

describe('A15 — "exactly one featured" is counted on what the page draws', () => {
  it('the one featured question with no text leaves no card: refused', () => {
    const r = checkPair((ov, dp) => { dp.questions[0].text = ' '; });
    expect(refusedOf(r, DP)).toEqual([['K-4(i)', 'questions']]);
  });
});

describe('A16, A20, A22, A23 — the notes the lens asked for', () => {
  it('a labelled-unsourced connection that cites a source; a cited connection with no "Known"; the banned words; a long question', () => {
    const r = checkPair((ov, dp) => {
      dp.connections[4].sourceIds = ['s1'];
      dp.connections[0].known = '';
      dp.deck = 'Verified by the regulator.';
      dp.questions[1].text = `${'How much '.repeat(14)}?`;
    });
    expect(r.refused).toBe(false);
    expect(notedOf(r, DP)).toEqual([
      ['standard §5', 'connections[0].known'],
      ['standard §4', 'connections[4].sourceIds'],
      ['standard §6 rule 7', 'questions[1].text'],
      ['standard §4', 'deck'],
    ]);
  });
  it('a question id with a space is kept by the page: no note', () => {
    const r = checkPair((ov, dp) => { dp.questions[1].id = 'min payments'; });
    expect(notedOf(r, DP)).toEqual([]);
  });
  it('the date check: the document\'s own month and year against `dated`', () => {
    expect(dateCheckOf('Oct 2026', '2026-10-29T00:26:35.000Z')).toBeNull();
    expect(dateCheckOf('Nov 2025', '2025-11-25')).toBeNull();
    expect(dateCheckOf('Sep 2026', '2026-10-29')).toBe('the document\'s own date is 2026-10-29; `dated` says "Sep 2026"');
    expect(dateCheckOf('Sep 2026', null)).toBe('no date was found in the document itself: check `dated` by hand');
  });
  it('the source row carries the author\'s `dated` beside the document\'s own date', async () => {
    const m = await matchOne([{ id: 's1', url: URL_A, excerpt: 'Hello', dated: 'Oct 2026' }], [], { [URL_A]: { html: pageOf(['Hello.'], { date: '2026-10-29T20:05:00Z' }) } });
    expect(m.sources[0]).toMatchObject({ dated: 'Oct 2026', documentDate: '2026-10-29T20:05:00.000Z' });
    expect(m.findings).toEqual([]);
  });
});

describe('the content hash still ignores every match result, wherever it sits', () => {
  it('(H1 and the version rule together)', () => {
    const ov = pilot(OV);
    const withResults = JSON.parse(JSON.stringify(ov));
    withResults.connections[0].match = { by: 'machine' };
    cloud(withResults).measures[1].matched = true;
    expect(contentHashOf(withResults)).toBe(contentHashOf(ov));
  });
});
