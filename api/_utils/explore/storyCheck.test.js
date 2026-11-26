// api/_utils/explore/storyCheck.test.js
//
// Explore publish step — THE CHECK (build prompt K-2, K-4, K-7; the Work an idea chat's additions of Nov 25).
//
// DEPENDENCY GUARD (BUILD_RULES §4). This file imports storyCheck.js, which imports the page's own
// src/components/Explore/exploreView.js (storyOf, STORY_ID, BASES). That import IS the runtime guard: it explodes in
// this Node environment if a browser dependency ever enters exploreView.js's graph. It must never be mocked. The
// first row also reads the page module's source and pins that it imports nothing.
//
// What the rows hold:
//   • the two pilot records (the content chat's note, Appendix, word for word) pass, together, for a draft and for a
//     publish;
//   • a row for every K-4 rule, each from a pilot record with exactly one thing broken, naming the field it refuses;
//   • K-7's whole-number-token rule, and the two formulas with their input checks, and the stored-measure list taken
//     as an argument.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkStories, pageDropReasonsOf, linkedIdsOf, currencyOf, LEVELS } from './storyCheck.js';
import { figureInExcerpt, numberTokensOf, wordsIn, authorRecordOf, contentHashOf, FORMULAS } from './storyRecord.js';
import { storyOf } from '../../../src/components/Explore/exploreView.js';
import { ALL_TICKERS, RETIRED_STOCKS } from '../rankingConfig.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OV = 'ai-buildout';
const DP = 'dominion-data-centers';
const pilotText = (id) => readFileSync(path.join(HERE, '__fixtures__', 'pilot', `${id}.json`), 'utf8');
const pilot = (id) => JSON.parse(pilotText(id));
const NOW = new Date('2026-11-25T15:00:00.000Z');

/** Both pilots, with `mutate(overview, deep)` applied first; checked as a set. */
function checkPair(mutate = () => {}, opts = {}) {
  const ov = pilot(OV);
  const dp = pilot(DP);
  const ids = mutate(ov, dp) ?? {};
  return checkStories([{ id: ids.ov ?? OV, raw: ov }, { id: ids.dp ?? DP, raw: dp }], { now: NOW, ...opts });
}
const refusedOf = (result, id) => result.stories.find((s) => s.id === id).findings.filter((f) => f.level === LEVELS.REFUSED).map((f) => [f.rule, f.field]);
const notedOf = (result, id) => result.stories.find((s) => s.id === id).findings.filter((f) => f.level === LEVELS.NOTED);
const words = (n) => Array.from({ length: n }, () => 'word').join(' ');
const cloud = (ov) => ov.questions[0];
const unusedTickers = (n, used) => ALL_TICKERS.filter((t) => !used.includes(t)).slice(0, n);

describe('the page\'s own rules are the one source (K-2)', () => {
  it('exploreView.js imports nothing: it is Node-clean by construction (the import above is the runtime guard)', () => {
    const src = readFileSync(path.join(HERE, '..', '..', '..', 'src', 'components', 'Explore', 'exploreView.js'), 'utf8');
    expect(src.match(/^\s*import\s/m)).toBeNull();
    expect(src).not.toMatch(/\brequire\(|\bimport\(/);
  });

  it('a draft file is asked about as it would be once published: status and date are the step\'s, never the file\'s', () => {
    const dp = pilot(DP);
    expect(storyOf(DP, dp)).toBeNull(); // as it sits: a draft with a placeholder date
    const r = checkStories([{ id: DP, raw: { ...dp, status: 'retracted', publishedAt: 'whenever' } }, { id: OV, raw: pilot(OV) }], { now: NOW });
    expect(r.refused).toBe(false);
  });

  it.each([
    ['an id outside the page\'s rule', 'bad id!', (d) => d, ['id']],
    ['`sample` true', DP, (d) => ({ ...d, sample: true }), ['sample']],
    ['a blank title', DP, (d) => ({ ...d, title: '   ' }), ['title']],
    ['a version that is not a whole number', DP, (d) => ({ ...d, version: 1.5 }), ['version']],
    ['a negative version', DP, (d) => ({ ...d, version: -1 }), ['version']],
    ['no question with text', DP, (d) => ({ ...d, questions: d.questions.map((q) => ({ ...q, text: ' ' })) }), ['questions']],
    ['two reasons at once', DP, (d) => ({ ...d, title: '', version: 'one' }), ['title', 'version']],
    ['none', DP, (d) => d, []],
  ])('pageDropReasonsOf names each reason storyOf drops a record for, by asking storyOf: %s', (_, id, change, parts) => {
    const published = { ...change(pilot(DP)), status: 'published', publishedAt: NOW };
    expect(pageDropReasonsOf(id, published).map((r) => r.part)).toEqual(parts);
    expect(storyOf(id, published) === null).toBe(parts.length > 0);
  });
});

describe('the pilot records (the note\'s Appendix, word for word)', () => {
  it('are the note\'s two JSON blocks, byte for byte', () => {
    const note = readFileSync(path.join(HERE, '..', '..', '..', 'docs', 'design', 'explore', '20261125_NOTE_STORY_RECORD_V1_4.md'), 'utf8').replace(/\r\n/g, '\n');
    const blocks = [...note.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => m[1]);
    expect(blocks).toHaveLength(2);
    expect(pilotText(OV).replace(/\r\n/g, '\n')).toBe(`${blocks[0]}\n`);
    expect(pilotText(DP).replace(/\r\n/g, '\n')).toBe(`${blocks[1]}\n`);
    expect('sample' in pilot(OV) || 'sample' in pilot(DP)).toBe(false);
  });

  it.each([['any'], ['published']])('pass check together (links: %s), with only the stored keys noted', (linkMode) => {
    const r = checkPair(() => {}, { linkMode });
    expect(r.refused).toBe(false);
    expect(notedOf(r, OV).map((f) => [f.rule, f.field])).toEqual([
      ['K-4(l)', 'questions[0].measures[1].storedKey'],
      ['K-4(l)', 'questions[0].measures[2].storedKey'],
    ]);
    expect(notedOf(r, DP)).toEqual([]);
    expect(wordsIn(pilot(OV).body)).toBe(136);
    expect(wordsIn(pilot(DP).body)).toBe(261);
  });
});

/** [rule letter, what is broken, which story, mutate(ov, dp), the refusals expected on that story]. */
const K4_ROWS = [
  // (a) anything storyOf drops
  ['a', 'a blank title', DP, (ov, dp) => { dp.title = ''; }, [['K-4(a)', 'title']]],
  ['a', 'a version that is not a whole number', OV, (ov) => { ov.version = 5.5; }, [['K-4(a)', 'version']]],
  ['a', 'no question with text', DP, (ov, dp) => { dp.questions.forEach((q) => { q.text = ''; }); }, [['K-4(a)', 'questions']]],
  ['a', 'a document id the page does not accept', 'dominion data centers', () => ({ dp: 'dominion data centers' }), [['K-4(a)', 'id'], ['K-4(e)', 'parent.connectionId']]],
  // (b) sample, of any value
  ['b', '`sample: true`', DP, (ov, dp) => { dp.sample = true; }, [['K-4(b)', 'sample']]],
  ['b', '`sample: false` (the page would draw it)', DP, (ov, dp) => { dp.sample = false; }, [['K-4(b)', 'sample']]],
  // (c) kind
  ['c', 'kind missing', DP, (ov, dp) => { delete dp.kind; }, [['K-4(c)', 'kind']]],
  ['c', 'kind outside the two', OV, (ov) => { ov.kind = 'feature'; }, [['K-4(c)', 'kind']]],
  // (d) the body over its limit, over all paragraphs
  ['d', 'an overview\'s body at 151 words', OV, (ov) => { ov.body.push(words(151 - 136)); }, [['K-4(d)', 'body']]],
  ['d', 'a deep story\'s body at 301 words', DP, (ov, dp) => { dp.body.push(words(301 - 261)); }, [['K-4(d)', 'body']]],
  // (e) links
  ['e', 'a deep story without a parent', DP, (ov, dp) => { delete dp.parent; }, [['K-4(e)', 'parent']]],
  ['e', 'a parent that names no existing overview', DP, (ov, dp) => { dp.parent.storyId = 'no-such-story'; }, [['K-4(e)', 'parent.storyId']]],
  ['e', 'a parent that names a story that is not an overview', DP, (ov, dp) => { dp.parent.storyId = DP; }, [['K-4(e)', 'parent.storyId']]],
  ['e', 'a parent that names no connection of the overview', DP, (ov, dp) => { dp.parent.connectionId = 'grid'; }, [['K-4(e)', 'parent.connectionId']]],
  ['e', 'a parent connection whose leadsToStory does not name this story', DP, (ov) => { delete ov.connections[4].leadsToStory; }, [['K-4(e)', 'parent.connectionId']]],
  ['e', 'an overview\'s leadsToStory that names no existing story', OV, (ov) => { ov.connections[0].leadsToStory = 'nvidia-data-center'; }, [['K-4(e)', 'connections[chips].leadsToStory']]],
  ['e', 'an overview\'s leadsToStory that names an overview', OV, (ov) => { ov.connections[1].leadsToStory = OV; }, [['K-4(e)', 'connections[cloud].leadsToStory']]],
  // (f) tickers
  ['f', 'a ticker outside ALL_TICKERS', DP, (ov, dp) => { dp.tickers[9] = 'ZZZZ'; }, [['K-4(f)', 'tickers[9]']]],
  ['f', 'a retired ticker', DP, (ov, dp) => { dp.tickers[9] = Object.keys(RETIRED_STOCKS)[0]; }, [['K-4(f)', 'tickers[9]']]],
  ['f', 'eleven tickers', DP, (ov, dp) => { dp.tickers.push(unusedTickers(1, dp.tickers)[0]); }, [['K-4(f)', 'tickers']]],
  ['f', 'an `about` symbol outside ALL_TICKERS', DP, (ov, dp) => { dp.about[0].symbol = 'DOM'; }, [['K-4(f)', 'about[0].symbol']]],
  ['f', 'a lead symbol outside ALL_TICKERS', DP, (ov, dp) => { dp.connections[3].leads[0].symbol = 'GE-V'; }, [['K-4(f)', 'connections[3].leads[0].symbol']]],
  ['f', 'a group symbol outside ALL_TICKERS (its lead and cell renamed with it)', OV, (ov) => {
    ov.connections[1].leads[4].symbol = 'CRWV2'; cloud(ov).group[3].symbol = 'CRWV2'; cloud(ov).measures[0].cells[3].symbol = 'CRWV2';
  }, [['K-4(f)', 'connections[1].leads[4].symbol'], ['K-4(f)', 'questions[0].group[3].symbol']]],
  // (g) connections
  ['g', 'a connection without an id', OV, (ov) => { delete ov.connections[2].id; }, [['K-4(g)', 'connections[2].id']]],
  ['g', 'a repeated connection id', OV, (ov) => { ov.connections[3].id = 'networking'; }, [['K-4(g)', 'connections[3].id']]],
  ['g', 'a basis outside the three', OV, (ov) => { ov.connections[0].basis = 'supported'; }, [['K-4(g)', 'connections[0].basis']]],
  ['g', 'a blank unknown', DP, (ov, dp) => { dp.connections[1].unknown = ' '; }, [['K-4(g)', 'connections[1].unknown']]],
  ['g', 'a blank whereToLook', DP, (ov, dp) => { delete dp.connections[2].whereToLook; }, [['K-4(g)', 'connections[2].whereToLook']]],
  ['g', '"Source cited" with no sourceIds', OV, (ov) => { ov.connections[0].sourceIds = []; }, [['K-4(g)', 'connections[0].sourceIds']]],
  ['g', 'no unsourced connection at all', OV, (ov) => {
    for (const i of [2, 3]) { ov.connections[i].basis = 'source_cited'; ov.connections[i].sourceIds = ['s1']; }
  }, [['K-4(g)', 'connections']]],
  // (h) sources
  ['h', 'a connection\'s sourceId that names no source', DP, (ov, dp) => { dp.connections[0].sourceIds.push('s9'); }, [['K-4(h)', 'connections[0].sourceIds[3]']]],
  ['h', 'a cell\'s sourceId that names no source', OV, (ov) => { cloud(ov).measures[0].cells[0].sourceId = 's9'; }, [['K-4(h)', 'questions[0].measures[0].cells[0].sourceId']]],
  ['h', 'an input\'s sourceId that names no source', OV, (ov) => { cloud(ov).measures[0].cells[3].inputs[1].sourceId = 's8'; }, [['K-4(h)', 'questions[0].measures[0].cells[3].inputs[1].sourceId']]],
  ['h', 'a source with no url', DP, (ov, dp) => { delete dp.sources[4].url; }, [['K-4(h)', 'sources[4].url']]],
  ['h', 'a source whose url is not https', DP, (ov, dp) => { dp.sources[3].url = dp.sources[3].url.replace('https:', 'http:'); }, [['K-4(h)', 'sources[3].url']]],
  // (i) questions
  ['i', 'two featured questions', DP, (ov, dp) => { dp.questions[1].featured = true; }, [['K-4(i)', 'questions']]],
  ['i', 'no featured question', DP, (ov, dp) => { dp.questions[0].featured = false; }, [['K-4(i)', 'questions']]],
  ['i', 'a fromConnection that names no connection', DP, (ov, dp) => { dp.questions[2].fromConnection = 'on-site'; }, [['K-4(i)', 'questions[2].fromConnection']]],
  ['i', 'a shape outside the six', DP, (ov, dp) => { dp.questions[1].shape = 'why'; }, [['K-4(i)', 'questions[1].shape']]],
  // (j) a broad question
  ['j', 'a group of two', OV, (ov) => { cloud(ov).group.splice(2, 2); cloud(ov).measures[0].cells.splice(2, 2); }, [['K-4(j)', 'questions[0].group']]],
  ['j', 'a group of nine', OV, (ov) => {
    const extra = unusedTickers(5, [...ov.tickers, ...ov.connections.flatMap((c) => c.leads.map((l) => l.symbol))]);
    for (const s of extra) {
      ov.connections[1].leads.push({ symbol: s, name: s });
      cloud(ov).group.push({ symbol: s, name: s });
      cloud(ov).measures[0].cells.push({ symbol: s, value: 48, unit: 'percent', period: 'Quarter ended Sep 30, 2026', sourceId: 's4', excerpt: 'Azure revenue increased 48%' });
    }
  }, [['K-4(j)', 'questions[0].group']]],
  ['j', 'a group company that is not a lead of the question\'s connection', OV, (ov) => {
    cloud(ov).group[0].symbol = 'NVDA'; cloud(ov).measures[0].cells[0].symbol = 'NVDA';
  }, [['K-4(j)', 'questions[0].group[0].symbol']]],
  ['j', 'two measures', OV, (ov) => { cloud(ov).measures.splice(0, 1); }, [['K-4(j)', 'questions[0].measures']]],
  ['j', 'six measures', OV, (ov) => { cloud(ov).measures.push(...['a', 'b', 'c'].map((k) => ({ kind: 'stored', storedKey: `k${k}` }))); }, [['K-4(j)', 'questions[0].measures']]],
  ['j', 'one stored measure', OV, (ov) => { cloud(ov).measures[2] = JSON.parse(JSON.stringify(cloud(ov).measures[0])); }, [['K-4(j)', 'questions[0].measures']]],
  ['j', 'a reported measure without a cell for a group company', OV, (ov) => { cloud(ov).measures[0].cells.splice(1, 1); }, [['K-4(j)', 'questions[0].measures[0].cells']]],
  ['j', 'a cell for a company outside the group', OV, (ov) => {
    cloud(ov).measures[0].cells.push({ symbol: 'GOOGL', value: 48, unit: 'percent', period: 'Quarter ended Sep 30, 2026', sourceId: 's4', excerpt: 'Azure revenue increased 48%' });
  }, [['K-4(j)', 'questions[0].measures[0].cells[4].symbol']]],
  // (k) cells (K-7 is the stated figure's own rule)
  ['k', 'a stated cell whose figure is not inside its excerpt', OV, (ov) => { cloud(ov).measures[0].cells[0].value = 49; }, [['K-7', 'questions[0].measures[0].cells[0].value']]],
  ['k', 'an input whose figure is not inside its excerpt', OV, (ov) => { cloud(ov).measures[0].cells[3].inputs[0].value = 3662; }, [['K-7', 'questions[0].measures[0].cells[3].inputs[0].value']]],
  ['k', 'an unknown formula', OV, (ov) => { cloud(ov).measures[0].cells[3].formula = 'difference'; }, [['K-4(k)', 'questions[0].measures[0].cells[3].formula']]],
  ['k', 'the wrong number of inputs', OV, (ov) => { cloud(ov).measures[0].cells[3].inputs.pop(); }, [['K-4(k)', 'questions[0].measures[0].cells[3].inputs']]],
  // (l) storedKey
  ['l', 'a blank storedKey', OV, (ov) => { cloud(ov).measures[1].storedKey = ''; }, [['K-4(l)', 'questions[0].measures[1].storedKey']]],
];

describe('every K-4 rule refuses, each from a pilot record with exactly one thing broken', () => {
  it.each(K4_ROWS)('K-4(%s): %s', (_, __, story, mutate, expected) => {
    const r = checkPair(mutate);
    expect(r.refused).toBe(true);
    expect(refusedOf(r, story)).toEqual(expected);
    // the finding names the field and the rule, with a message in words
    const f = r.stories.find((s) => s.id === story).findings.find((x) => x.level === LEVELS.REFUSED);
    expect(f.message.length).toBeGreaterThan(10);
  });

  it('every rule letter of K-4 has a row', () => {
    expect([...new Set(K4_ROWS.map((r) => r[0]))].sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);
  });

  it('at the limits exactly, nothing is refused: 150 and 300 words, ten tickers, three and eight companies, three and five measures', () => {
    expect(checkPair((ov, dp) => { ov.body.push(words(14)); dp.body.push(words(39)); }).refused).toBe(false);
    expect(checkPair((ov) => { cloud(ov).measures.push({ kind: 'stored', storedKey: 'peRatio' }, { kind: 'stored', storedKey: 'grossMargin' }); }).refused).toBe(false);
    expect(checkPair((ov) => { cloud(ov).group.splice(3, 1); cloud(ov).measures[0].cells.splice(3, 1); }).refused).toBe(false);
  });

  it('a lead\'s symbol may be null for an unlisted company', () => {
    const r = checkPair((ov, dp) => { dp.connections[4].leads.push({ symbol: null, name: 'A private fuel-cell maker' }); });
    expect(r.refused).toBe(false);
  });

  it('a deep story checked alone reads its parent from the collection; a publish counts only a published parent', () => {
    const dp = pilot(DP);
    expect(linkedIdsOf([{ id: DP, raw: dp }])).toEqual([OV]);
    const asDraft = new Map([[OV, { ...pilot(OV), status: 'draft' }]]);
    expect(checkStories([{ id: DP, raw: dp }], { now: NOW, others: asDraft, linkMode: 'any' }).refused).toBe(false);
    const pub = checkStories([{ id: DP, raw: dp }], { now: NOW, others: asDraft, linkMode: 'published' });
    expect(refusedOf(pub, DP)).toEqual([['K-4(e)', 'parent.storyId']]);
    expect(pub.stories[0].findings[0].message).toMatch(/publish them together/);
    const asPublished = new Map([[OV, { ...pilot(OV), status: 'published' }]]);
    expect(checkStories([{ id: DP, raw: dp }], { now: NOW, others: asPublished, linkMode: 'published' }).refused).toBe(false);
  });

  it('two files naming one document id are refused', () => {
    const r = checkStories([{ id: DP, raw: pilot(DP) }, { id: DP, raw: pilot(DP) }, { id: OV, raw: pilot(OV) }], { now: NOW });
    expect(r.stories[0].findings[0]).toMatchObject({ level: 'refused', rule: 'K-9', field: 'id' });
  });
});

describe('K-7: the figure inside its own quote, as a whole number token', () => {
  it.each([
    [48, 'Azure revenue increased 48%', true],
    [3661, 'Revenue $ 3,661 $ 1,365', true],
    [1365, 'Revenue $ 3,661 $ 1,365', true],
    [51.4, 'were $51.4 billion for the three months', true],
    [121, 'Q1 Cloud Infra (IaaS) Revenue up 121% in USD', true],
    [0.8138, 'a fixed exchange ratio of 0.8138 shares', true],
    [48, 'revenue increased 148%', false],
    [48, 'revenue increased 48.5%', false],
    [848, 'revenue of 4,848', false],
    [4, 'revenue of 4,848', false],
    [51.4, 'were $51.40 billion', false],
    [1, 'Q1 Cloud Infra revenue', false],
    [2027, 'in FY2027', false],
    [18, 'closing in 12-18 months', true],
    [-110, 'Net loss (110)', true],
    [-5, 'margin fell -5%', true],
    [5, 'margin fell -5%', false],
    [-5, 'margin fell 5%', false],
    [Number.NaN, 'NaN', false],
    ['48', 'Azure revenue increased 48%', false],
  ])('%s in %j → %s', (value, excerpt, expected) => {
    expect(figureInExcerpt(value, excerpt)).toBe(expected);
  });

  it('reads only whole tokens', () => {
    expect(numberTokensOf('$ 3,661 $ 1,365 and 12,3456').map((t) => t.digits)).toEqual(['3661', '1365']);
  });
});

describe('the two formulas (the Work an idea chat, Nov 25): checked, never computed', () => {
  const crwv = (ov) => cloud(ov).measures[0].cells[3];
  const ratio = (ov) => {
    const c = crwv(ov);
    c.formula = 'ratio';
    c.inputs[1].period = c.inputs[0].period;
  };
  it('the list is exactly growth_from_year_ago and ratio', () => {
    expect(Object.keys(FORMULAS)).toEqual(['growth_from_year_ago', 'ratio']);
  });
  it.each([
    ['growth_from_year_ago, as the pilot writes it', () => {}, []],
    ['growth_from_year_ago in two units', (ov) => { crwv(ov).inputs[1].unit = 'USD thousands'; }, [['K-4(k)', 'questions[0].measures[0].cells[3].inputs']]],
    ['growth_from_year_ago over one period', (ov) => { crwv(ov).inputs[1].period = crwv(ov).inputs[0].period; }, [['K-4(k)', 'questions[0].measures[0].cells[3].inputs']]],
    ['growth_from_year_ago with a year-ago figure of zero', (ov) => { Object.assign(crwv(ov).inputs[1], { value: 0, excerpt: 'Revenue $ 3,661 $ 0' }); }, [['K-4(k)', 'questions[0].measures[0].cells[3].inputs[1].value']]],
    ['ratio, same period, same currency', ratio, []],
    ['ratio over two periods', (ov) => { ratio(ov); crwv(ov).inputs[1].period = 'Quarter ended Sep 30, 2025'; }, [['K-4(k)', 'questions[0].measures[0].cells[3].inputs']]],
    ['ratio across two currencies', (ov) => { ratio(ov); crwv(ov).inputs[1].unit = 'EUR millions'; }, [['K-4(k)', 'questions[0].measures[0].cells[3].inputs']]],
    ['ratio of units with no currency', (ov) => { ratio(ov); crwv(ov).inputs[0].unit = 'GW'; crwv(ov).inputs[1].unit = 'GW'; }, [['K-4(k)', 'questions[0].measures[0].cells[3].inputs']]],
    ['ratio with a denominator of zero', (ov) => { ratio(ov); Object.assign(crwv(ov).inputs[1], { value: 0, excerpt: 'Revenue $ 3,661 $ 0' }); }, [['K-4(k)', 'questions[0].measures[0].cells[3].inputs[1].value']]],
    ['a computed cell carrying its result', (ov) => { crwv(ov).value = 168.2; }, [['K-4(k)', 'questions[0].measures[0].cells[3].value']]],
  ])('%s', (_, mutate, expected) => {
    expect(refusedOf(checkPair(mutate), OV)).toEqual(expected);
  });
  it('a unit names its currency first', () => {
    expect([currencyOf('USD millions'), currencyOf('USD'), currencyOf('percent'), currencyOf('USDX'), currencyOf(null)]).toEqual(['USD', 'USD', null, null, null]);
  });
});

describe('the stored-measure list is an argument (src/constants/compareMeasures.js is not on main yet)', () => {
  it('without the list each key is noted as not checked, and nothing is refused', () => {
    const r = checkPair();
    expect(r.refused).toBe(false);
    expect(notedOf(r, OV).filter((f) => f.rule === 'K-4(l)').map((f) => f.message)).toEqual([
      'not checked: the list is not built yet (src/constants/compareMeasures.js)',
      'not checked: the list is not built yet (src/constants/compareMeasures.js)',
    ]);
  });
  it('with the list, a key not on it is refused, and a key on it passes without a note', () => {
    const partial = checkPair(() => {}, { storedKeys: ['revenueGrowthYOY'] });
    expect(refusedOf(partial, OV)).toEqual([['K-4(l)', 'questions[0].measures[2].storedKey']]);
    const full = checkPair(() => {}, { storedKeys: new Set(['revenueGrowthYOY', 'fcfMargin']) });
    expect(full.refused).toBe(false);
    expect(notedOf(full, OV).filter((f) => f.rule === 'K-4(l)')).toEqual([]);
  });
});

describe('the author\'s values for the step\'s own fields', () => {
  it('are removed before anything reads the record, and noted when a match result arrived', () => {
    const ov = pilot(OV);
    ov.sources[0].match = { by: 'machine', readAt: '2026-11-01T00:00:00Z', documentDate: null, textHash: 'x', rule: 1 };
    cloud(ov).measures[0].cells[0].matched = true;
    cloud(ov).measures[0].cells[3].inputs[0].matched = true;
    const { record, discarded } = authorRecordOf(ov);
    expect(discarded).toEqual(['status', 'publishedAt', 'sources[0].match', 'questions[0].measures[0].cells[0].matched', 'questions[0].measures[0].cells[3].inputs[0].matched']);
    expect(JSON.stringify(record)).not.toMatch(/"match"|"matched"|"status"|"publishedAt"/);
    expect(ov.sources[0].match.by).toBe('machine'); // the input is never changed
    const r = checkStories([{ id: OV, raw: ov }, { id: DP, raw: pilot(DP) }], { now: NOW });
    expect(notedOf(r, OV).filter((f) => f.rule === 'K-11')).toHaveLength(1);
    expect(r.stories[0].record.sources[0].match).toBeUndefined();
  });
  it('the content hash ignores them: a record with match results and the same record without are the same content', () => {
    const ov = pilot(OV);
    const withResults = JSON.parse(JSON.stringify(ov));
    withResults.sources.forEach((s) => { s.match = { by: 'read', readAt: null, documentDate: null, textHash: null, rule: 1 }; });
    cloud(withResults).measures[0].cells[0].matched = false;
    withResults.status = 'published';
    withResults.revisedAt = 'later';
    expect(contentHashOf(withResults)).toBe(contentHashOf(ov));
    expect(contentHashOf({ ...ov, deck: `${ov.deck} ` })).not.toBe(contentHashOf(ov));
  });
});
