// src/components/Explore/exploreView.build2.test.js
//
// Explore Build 2 — THE READER AND THE PAGE'S PURE VIEW (spec docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md
// §3, §4.2, §5; build prompt K-3, K-4, K-5, K-6, K-7, K-12, K-13, K-15, K-16, K-19).
//   K-3   the two pilot records read field by field; nothing carried for comparing reaches the view (a walk of every
//         key at every depth); no new reason to drop a record; leads, groups and the old shape
//   K-15  which sources are listed: the pilot overview lists three and leaves four out
//   K-5   the read's last.question, last.statement and agent
//   K-12  the shelf from the read alone
//   K-13  the front page's split
//   K-6/7 the counts, the doors, the way up, the stories a page needs by id
//   K-16  the sheet's item carries the question's id
//   K-19  the pilot fixtures parse equal to the publish step's

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BROAD_MIN, KINDS, LATEST_MAX, LINKED_READS_MAX, RESEARCH, SHELF_FINISHED_MAX, STORIES_READ, agentFor, countsOf, chainSubjectOf, doorOf,
  figureOnlySourceIdsOf, frontPageOf, leadAssetOf, linkedIdsOf, parentOf, researchViewOf, sheetItemOf, shelfOf, storiesByIdOf, storyMatchesOf, storyOf,
} from './exploreView';
import {
  KIT_STORIES, OLD_SHAPE_RECORD, OLD_SHAPE_STORY, PILOT_DEEP, PILOT_OVERVIEW, PILOT_RECORDS, SAMPLE_STORIES, asPublishedPilot, previewStoryOf,
} from './__fixtures__/stories';
import reads from './__fixtures__/exploreReads.json';

const HERE = dirname(fileURLToPath(import.meta.url));
const OV = asPublishedPilot('ai-buildout');
const DP = asPublishedPilot('dominion-data-centers');
const [S_AI, S_TAP, S_UTIL] = SAMPLE_STORIES;
const ok = (body) => ({ ok: true, status: 200, body, retryAfterS: null, gated: false, network: false });
const clone = (x) => JSON.parse(JSON.stringify(x));

/** K-3's list: what is carried for comparing (or written by the publish step) and must never reach the view. */
export const NEVER_IN_VIEW = Object.freeze(['cells', 'value', 'formula', 'inputs', 'benchmark', 'wrongIfSeed', 'watch', 'match', 'matched', 'storedKey']);
/** Every key at every depth of a value, with its path. */
export function keysOf(value, path = '$', out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => keysOf(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { out.push([k, `${path}.${k}`]); keysOf(v, `${path}.${k}`, out); }
  return out;
}
const forbiddenIn = (view) => keysOf(view).filter(([k]) => NEVER_IN_VIEW.includes(k)).map(([, p]) => p);

describe('K-3: the pilot overview, field by field', () => {
  const v = storyOf('ai-buildout', OV);
  it('is drawn, as an overview, from its subject', () => {
    expect(v).toMatchObject({ id: 'ai-buildout', version: 5, kind: KINDS.OVERVIEW, lead: 'story', subject: 'AI buildout', parent: null, about: [], sample: false });
    expect(chainSubjectOf(v)).toBe('AI buildout');
    expect(v.title).toBe(OV.title);
    expect(v.body).toEqual(OV.body);
  });
  it('its connections: ids, bases, the three-part gap, leads as { symbol, name } in the story\'s order, and one door', () => {
    expect(v.connections.map((c) => [c.id, c.basis, c.leadsToStory])).toEqual([
      ['chips', 'source_cited', null], ['cloud', 'source_cited', null], ['networking', 'reporters_reading', null], ['landlords', 'no_source_yet', null], ['power', 'source_cited', 'dominion-data-centers'],
    ]);
    const chips = v.connections[0];
    expect(chips.leads).toEqual([{ symbol: 'NVDA', name: 'NVIDIA' }, { symbol: 'AMD', name: 'AMD' }, { symbol: 'AVGO', name: 'Broadcom' }, { symbol: 'MU', name: 'Micron' }]);
    expect(chips).toMatchObject({ known: OV.connections[0].known, unknown: OV.connections[0].unknown, whereToLook: OV.connections[0].whereToLook });
    // a blank Known reads as none (the page says "Nothing sourced yet.")
    expect(v.connections[2].known).toBeNull();
    expect(v.connections[2].unknown).toBe(OV.connections[2].unknown);
    expect(v.connections.map((c) => c.ref)).toEqual(['chips', 'cloud', 'networking', 'landlords', 'power']);
  });
  it('its question: broad, on the cloud branch, its group in the story\'s order, its reported measure\'s name only', () => {
    expect(v.questions).toHaveLength(1);
    expect(v.questions[0]).toMatchObject({ id: 'cloud-leaders', featured: true, fromConnection: 'cloud', broad: true, measureNames: ['Cloud growth'] });
    expect(v.questions[0].group).toEqual([{ symbol: 'MSFT', name: 'Microsoft' }, { symbol: 'AMZN', name: 'Amazon' }, { symbol: 'ORCL', name: 'Oracle' }, { symbol: 'CRWV', name: 'CoreWeave' }]);
  });
  it('K-15 (§5.3): three sources listed — the ones a connection cites — and the four only a figure names left out', () => {
    expect([...figureOnlySourceIdsOf(OV)].sort()).toEqual(['s4', 's5', 's6', 's7']);
    expect(v.sources.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(v.sources.map((s) => s.name)).toEqual(OV.sources.slice(0, 3).map((s) => s.name));
  });
  it('the rule is exact: a source no connection and no figure names is listed; one a figure AND a connection name is listed', () => {
    const rec = clone(OV);
    rec.sources.push({ id: 's8', name: 'Named by nothing', dated: 'Nov 2026' });
    rec.connections[1].sourceIds.push('s4');
    expect(storyOf('ai-buildout', rec).sources.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4', 's8']);
    // a computed cell's inputs name a source too
    expect(figureOnlySourceIdsOf(rec).has('s7')).toBe(true);
    expect(figureOnlySourceIdsOf({ questions: [{ measures: [{ cells: [{ inputs: [{ sourceId: 'x' }] }] }] }] })).toEqual(new Set(['x']));
  });
});

describe('K-3: the pilot deep story, field by field', () => {
  const v = storyOf('dominion-data-centers', DP);
  it('is a deep story about Dominion, under the AI buildout\'s power connection', () => {
    expect(v).toMatchObject({ kind: KINDS.DEEP, subject: "Dominion's data centers", parent: { storyId: 'ai-buildout', connectionId: 'power' }, about: [{ symbol: 'D', name: 'Dominion Energy' }] });
  });
  it('its three questions are specific, each on its branch; its five sources are all listed', () => {
    expect(v.questions.map((q) => [q.id, q.fromConnection, q.broad, q.group.length])).toEqual([['paper-to-meter', 'customers', false, 0], ['minimums', 'regulator', false, 0], ['own-power', 'onsite', false, 0]]);
    expect(v.sources.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4', 's5']);
    expect(v.connections.find((c) => c.id === 'regulator').leads).toEqual([]);
  });
  it('about keeps the record\'s order (never sorted: review H-5)', () => {
    const v2 = storyOf('d', { ...DP, about: [{ symbol: 'NEE', name: 'NextEra Energy' }, { symbol: 'D', name: 'Dominion Energy' }] });
    expect(v2.about.map((c) => c.symbol)).toEqual(['NEE', 'D']);
  });
  it('a parent and about are a deep story\'s only: an overview carrying them reads none', () => {
    const v2 = storyOf('ai-buildout', { ...OV, parent: { storyId: 'x', connectionId: 'y' }, about: [{ symbol: 'D', name: 'Dominion Energy' }] });
    expect(v2.parent).toBeNull();
    expect(v2.about).toEqual([]);
  });
});

describe('K-3: nothing carried for comparing reaches the view', () => {
  it('the view of each pilot holds none of the ten keys, at any depth', () => {
    expect(forbiddenIn(storyOf('ai-buildout', OV))).toEqual([]);
    expect(forbiddenIn(storyOf('dominion-data-centers', DP))).toEqual([]);
  });
  it('…and none of the figures: no cell\'s excerpt, no cell\'s number, no benchmark', () => {
    const text = JSON.stringify(storyOf('ai-buildout', OV));
    for (const s of ['Azure revenue increased 48%', 'AWS segment sales', 'Cloud Infra (IaaS)', 'Revenue $ 3,661', 'XLK', 'growth_from_year_ago', 'revenueGrowthYOY', 'fcfMargin', 'trail the benchmark']) expect(text).not.toContain(s);
  });
  it('a record carrying the publish step\'s match blocks keeps them out too', () => {
    const rec = clone(OV);
    rec.sources[0].match = { by: 'machine', readAt: '2026-11-25T00:00:00Z', documentDate: null, textHash: 'h' };
    rec.questions[0].measures[0].cells[0].matched = true;
    rec.connections[0].value = 3;
    expect(forbiddenIn(storyOf('ai-buildout', rec))).toEqual([]);
  });
  it('the walk bites (planted): a view that carried the question\'s measures, a source\'s match, or a cell value is caught', () => {
    const view = storyOf('ai-buildout', OV);
    expect(forbiddenIn({ ...view, questions: [{ ...view.questions[0], measures: OV.questions[0].measures }] }).length).toBeGreaterThan(0);
    expect(forbiddenIn({ ...view, sources: [{ ...view.sources[0], match: {} }] })).toEqual(['$.sources[0].match']);
    expect(forbiddenIn({ a: [{ b: { value: 1 } }] })).toEqual(['$.a[0].b.value']);
  });
});

describe('K-3: no new reason to drop a record', () => {
  it.each([
    ['an unknown kind', { kind: 'feature' }],
    ['a kind that is not text', { kind: 5 }],
    ['a subject that is not text', { subject: { x: 1 } }],
    ['a parent of the wrong shape', { kind: 'deep', parent: 'ai-buildout' }],
    ['a parent naming a bad id', { kind: 'deep', parent: { storyId: 'a/b', connectionId: 'power' } }],
    ['about that is not a list', { kind: 'deep', about: 'Dominion' }],
    ['connections with a malformed gap, door and leads', { connections: [{ who: 'X', id: 7, known: 9, unknown: [], whereToLook: {}, leadsToStory: 'a b', leads: [null, 3, {}, { symbol: 'nvda' }] }] }],
    ['questions with a malformed branch, group and measures', { questions: [{ id: 'q', text: 'Q?', fromConnection: [], group: 'MSFT', measures: 'x' }] }],
  ])('%s: still drawn, the field left out', (_n, over) => {
    const v = storyOf('ai-buildout', { ...OV, ...over });
    expect(v).not.toBeNull();
  });
  it('the malformed fields read as nothing', () => {
    expect(storyOf('ai-buildout', { ...OV, kind: 'feature' }).kind).toBe(KINDS.OVERVIEW);
    expect(storyOf('d', { ...DP, parent: { storyId: 'a/b', connectionId: 'power' } }).parent).toBeNull();
    const c = storyOf('ai-buildout', { ...OV, connections: [{ who: 'X', id: 7, known: 9, leadsToStory: 'a b', leads: [null, 3, {}, { symbol: 'nvda' }, 'Plain text lead'] }] }).connections[0];
    expect(c).toMatchObject({ id: null, ref: 'c0', known: null, leadsToStory: null });
    expect(c.leads).toEqual([{ symbol: null, name: 'Plain text lead' }]);
    const q = storyOf('ai-buildout', { ...OV, questions: [{ id: 'q', text: 'Q?', fromConnection: [], group: 'MSFT', measures: 'x' }] }).questions[0];
    expect(q).toMatchObject({ fromConnection: null, group: [], broad: false, measureNames: [] });
  });
  it('the reasons are Build 1\'s, unchanged: a draft, a sample, a blank title, a bad version, no question, a bad id', () => {
    for (const over of [{ status: 'draft' }, { sample: true }, { title: ' ' }, { version: 1.5 }, { questions: [] }]) expect(storyOf('ai-buildout', { ...OV, ...over })).toBeNull();
    expect(storyOf('bad id', OV)).toBeNull();
    expect(storyOf('ai-buildout', PILOT_RECORDS['ai-buildout'])).toBeNull(); // as it sits: a draft with a placeholder date
  });
});

describe('K-3, K-11: companies — a symbol makes a button, plain text stays plain', () => {
  const lead = (leads) => storyOf('ai-buildout', { ...OV, connections: [{ who: 'X', leads }] }).connections[0].leads;
  it('{ symbol, name } as given; a symbol alone names itself; a name alone is plain text; old text is plain text', () => {
    expect(lead([{ symbol: 'CRWV', name: 'CoreWeave' }, { symbol: 'BRK.B' }, { name: 'KSTL (sample company)' }, 'NVDA'])).toEqual([
      { symbol: 'CRWV', name: 'CoreWeave' }, { symbol: 'BRK.B', name: 'BRK.B' }, { symbol: null, name: 'KSTL (sample company)' }, { symbol: null, name: 'NVDA' },
    ]);
  });
  it('a broad question names at least three companies; two is specific', () => {
    expect(BROAD_MIN).toBe(3);
    const q = (n) => storyOf('ai-buildout', { ...OV, questions: [{ ...OV.questions[0], group: OV.questions[0].group.slice(0, n) }] }).questions[0].broad;
    expect([q(4), q(3), q(2), q(0)]).toEqual([true, true, false, false]);
  });
  it('the group keeps the story\'s order, never sorted', () => {
    const shuffled = ['ORCL', 'AMZN', 'CRWV', 'MSFT'].map((s) => OV.questions[0].group.find((g) => g.symbol === s));
    expect(storyOf('ai-buildout', { ...OV, questions: [{ ...OV.questions[0], group: shuffled }] }).questions[0].group.map((g) => g.symbol)).toEqual(['ORCL', 'AMZN', 'CRWV', 'MSFT']);
  });
  it('a lead opens the research page on RankingsView\'s object (RankingsView.jsx:111)', () => {
    expect(leadAssetOf({ symbol: 'CRWV', name: 'CoreWeave' })).toEqual({ symbol: 'CRWV', name: 'CoreWeave', sector: '', price: 0, percentChange: 0, change: 0 });
    const rankings = readFileSync(resolve(HERE, '../Search/RankingsView.jsx'), 'utf8');
    const keys = /onOpenResearch\(\{([\s\S]*?)\}\);/.exec(rankings)[1].match(/\b(\w+):/g).map((k) => k.slice(0, -1));
    expect(Object.keys(leadAssetOf({ symbol: 'X', name: 'Y' }))).toEqual(keys);
  });
});

describe('the old shape still reads (Amendment B §4.3)', () => {
  it('leads as text, no kind, no subject, no gap: an overview with plain-text leads and nothing in the gap', () => {
    expect(OLD_SHAPE_RECORD.kind).toBeUndefined();
    expect(OLD_SHAPE_STORY).toMatchObject({ kind: KINDS.OVERVIEW, subject: null, sample: true });
    expect(OLD_SHAPE_STORY.connections[0].leads).toEqual([{ symbol: null, name: 'KSTL (sample company)' }, { symbol: null, name: 'HLDN (sample company)' }]);
    expect(OLD_SHAPE_STORY.connections[0]).toMatchObject({ id: null, known: null, unknown: null, whereToLook: null, leadsToStory: null });
    expect(OLD_SHAPE_STORY.questions.every((q) => q.fromConnection === null && q.group.length === 0)).toBe(true);
    expect(previewStoryOf(OLD_SHAPE_RECORD)).toEqual(OLD_SHAPE_STORY);
  });
});

describe('K-5: the read\'s new fields (B6c §1.1)', () => {
  it('agent: id, name and the equipped list\'s name — null when the read names none, or a malformed one', () => {
    expect(agentFor(researchViewOf(ok(reads.progress)))).toEqual({ id: 'agent-1', name: 'Atlas', equippedListName: 'Grid builders' });
    expect(agentFor(researchViewOf(ok(reads.none)))).toBeNull();
    for (const agent of [{ id: '' }, { id: 7 }, 'agent-1', [], { name: 'Atlas' }]) expect(agentFor(researchViewOf(ok({ ...reads.none, agent })))).toBeNull();
    expect(agentFor(researchViewOf(ok({ ...reads.none, agent: { id: 'a', name: '  ', equippedList: null } })))).toEqual({ id: 'a', name: null, equippedListName: null });
    expect(agentFor({ status: RESEARCH.GATED })).toBeNull();
  });
  it('last.question and last.statement, each null when the read gives none', () => {
    const v = researchViewOf(ok(reads.returning));
    expect(v.byStory.get('ai-buildout').last).toMatchObject({ ended: 'saved', question: PILOT_OVERVIEW.questions[0].text, statement: expect.stringMatching(/^My theme is AI cloud growth/) });
    expect(researchViewOf(ok(reads.savedBare)).byStory.get('sample-ai-buildout').last).toMatchObject({ question: null, statement: null });
    expect(researchViewOf(ok(reads.concluded)).byStory.get('sample-ai-buildout').last).toMatchObject({ ended: 'concluded', statement: null });
  });
});

describe('K-12: the shelf, from the read alone', () => {
  it('every open investigation in the read\'s order, then the newest finished ones; the counts are the read\'s own lists', () => {
    const s = shelfOf(researchViewOf(ok(reads.returning)));
    expect(s.open.map((it) => it.storyId)).toEqual(['sample-utility-load']);
    expect(s.finished.map((it) => it.storyId)).toEqual(['ai-buildout']);
    expect([s.openCount, s.finishedCount]).toEqual([1, 1]);
  });
  it('at most three finished, newest first by the read\'s `at`; a story open and finished is in both lists', () => {
    const last = (n, at) => ({ itemRef: { recordKind: 'exploreStories', recordId: `s${n}` }, itemVersion: 1, open: null, last: { sessionId: `x${n}`, ended: 'saved', at, question: `Q${n}`, statement: null } });
    const both = { ...last(9, '2026-11-21T09:00:00.000Z'), open: { sessionId: 'o9', question: 'Open', lastTurnAt: null, filled: 0, parts: 6, stepsLeft: 10, findingsCount: 1 } };
    const s = shelfOf(researchViewOf(ok({ ...reads.none, items: [last(1, '2026-11-21T01:00:00.000Z'), last(2, '2026-11-21T05:00:00.000Z'), last(3, '2026-11-21T03:00:00.000Z'), last(4, '2026-11-21T04:00:00.000Z'), both] })));
    expect(SHELF_FINISHED_MAX).toBe(3);
    expect(s.finished.map((it) => it.storyId)).toEqual(['s9', 's2', 's4']);
    expect(s.open.map((it) => it.storyId)).toEqual(['s9']);
    expect([s.openCount, s.finishedCount]).toEqual([1, 5]);
  });
  it('nothing for a read that is not ready', () => {
    for (const r of [{ status: RESEARCH.LOADING }, { status: RESEARCH.GATED }, { status: RESEARCH.FAILED }, null]) expect(shelfOf(r)).toBeNull();
  });
});

describe('K-13: the front page\'s split (B-3, B-4, B-5)', () => {
  it('the kit: the pilot overview is the hero; tap-to-pay a tile; the AI and utilities overviews cards; the deep story in Latest', () => {
    const p = frontPageOf(KIT_STORIES);
    expect([p.hero.story.id, p.hero.question.id]).toEqual(['ai-buildout', 'cloud-leaders']);
    expect(p.tiles.map((s) => s.id)).toEqual([S_TAP.id]);
    expect(p.cards.map((c) => [c.story.id, c.question.id])).toEqual([[S_AI.id, 'q-chips'], [S_UTIL.id, 'q-earn']]);
    expect(p.latest.map((s) => s.id)).toEqual(['dominion-data-centers']);
  });
  it('a story is in one place: the hero is not a card, a tile is not a card, a deep story only in Latest', () => {
    const p = frontPageOf(KIT_STORIES);
    const placed = [p.hero.story.id, ...p.tiles.map((s) => s.id), ...p.cards.map((c) => c.story.id), ...p.latest.map((s) => s.id)];
    expect(new Set(placed).size).toBe(placed.length);
    expect(placed.sort()).toEqual(KIT_STORIES.map((s) => s.id).sort());
  });
  it('the hero is the newest overview even when it is product-led; Latest keeps the three newest deep stories', () => {
    expect(frontPageOf([S_TAP, S_AI]).hero.story.id).toBe(S_TAP.id);
    const deep = (n) => ({ ...PILOT_DEEP, id: `deep-${n}` });
    expect(LATEST_MAX).toBe(3);
    expect(frontPageOf([deep(1), deep(2), PILOT_OVERVIEW, deep(3), deep(4)]).latest.map((s) => s.id)).toEqual(['deep-1', 'deep-2', 'deep-3']);
    expect(frontPageOf([PILOT_DEEP]).hero).toBeNull();
    expect(frontPageOf([PILOT_OVERVIEW, S_AI]).tiles).toEqual([]);
  });
});

describe('K-6, K-7: the counts, the doors, the way up, and what a page reads by id', () => {
  const byId = storiesByIdOf(KIT_STORIES);
  it('the count line\'s numbers come from the connections\' basis', () => {
    // basis alone: a Known on a reading, a blank Known on a cited source, and the sources listed count for nothing (review H-2)
    expect(countsOf({ connections: [{ basis: 'reporters_reading', known: 'A line' }, { basis: 'source_cited', known: null }, { basis: 'no_source_yet', known: 'x' }], sources: [1, 2, 3, 4] })).toEqual({ n: 3, sourced: 1, unchecked: 2 });
    expect(countsOf(PILOT_OVERVIEW)).toEqual({ n: 5, sourced: 3, unchecked: 2 });
    expect(countsOf(PILOT_DEEP)).toEqual({ n: 5, sourced: 3, unchecked: 2 });
    expect(countsOf(S_UTIL)).toEqual({ n: 2, sourced: 1, unchecked: 1 });
  });
  it('a door only for a deep story at hand: not for a missing one, not for an overview, never to itself', () => {
    const power = PILOT_OVERVIEW.connections.find((c) => c.id === 'power');
    expect(doorOf(power, byId)).toBe(PILOT_DEEP);
    expect(doorOf(power, storiesByIdOf(SAMPLE_STORIES))).toBeNull();
    expect(doorOf({ leadsToStory: S_AI.id }, byId)).toBeNull();
    expect(doorOf({ leadsToStory: 'dominion-data-centers' }, byId, 'dominion-data-centers')).toBeNull();
    expect(PILOT_OVERVIEW.connections.filter((c) => doorOf(c, byId)).map((c) => c.id)).toEqual(['power']);
  });
  it('the way up: the overview and the connection, or nothing when either cannot be read', () => {
    expect(parentOf(PILOT_DEEP, byId)).toEqual({ overview: PILOT_OVERVIEW, connection: PILOT_OVERVIEW.connections[4] });
    expect(parentOf(PILOT_DEEP, storiesByIdOf([PILOT_DEEP]))).toBeNull();
    expect(parentOf({ ...PILOT_DEEP, parent: { storyId: 'ai-buildout', connectionId: 'grid' } }, byId)).toBeNull();
    expect(parentOf({ ...PILOT_DEEP, parent: { storyId: 'dominion-data-centers', connectionId: 'power' } }, byId)).toBeNull();
    expect(parentOf(PILOT_OVERVIEW, byId)).toBeNull();
  });
  it('a page reads by id only what it lacks: a deep story its parent first, then the doors; an overview its doors; never twice', () => {
    expect(LINKED_READS_MAX).toBe(6);
    expect(STORIES_READ).toBe(40);
    expect(linkedIdsOf(PILOT_DEEP, storiesByIdOf([PILOT_DEEP]))).toEqual(['ai-buildout']);
    expect(linkedIdsOf(PILOT_OVERVIEW, storiesByIdOf([PILOT_OVERVIEW]))).toEqual(['dominion-data-centers']);
    expect(linkedIdsOf(PILOT_OVERVIEW, byId)).toEqual([]);
    expect(linkedIdsOf(PILOT_OVERVIEW, storiesByIdOf([PILOT_OVERVIEW]), new Set(['dominion-data-centers']))).toEqual([]);
    const linked = new Map([['ai-buildout', PILOT_OVERVIEW], ['gone', null]]);
    expect(storiesByIdOf([PILOT_DEEP], linked).has('gone')).toBe(false);
    expect(linkedIdsOf(PILOT_DEEP, storiesByIdOf([PILOT_DEEP], linked))).toEqual([]); // the parent's only door is this story
  });
});

describe('K-16, K-17: the sheet\'s item and search', () => {
  it('Work this idea hands the chosen question\'s id; without one the item is Build 1\'s', () => {
    expect(sheetItemOf(PILOT_DEEP, 'How fast?', 'minimums')).toMatchObject({ itemRef: { recordKind: 'exploreStories', recordId: 'dominion-data-centers' }, question: 'How fast?', questionId: 'minimums' });
    expect('questionId' in sheetItemOf(PILOT_DEEP, 'How fast?')).toBe(false);
  });
  it('search covers both kinds: "Dominion" names the deep story; the subject names the overview', () => {
    // its three questions each name Dominion: one row per question, all on the deep story
    expect(storyMatchesOf(KIT_STORIES, 'Dominion').map((r) => `${r.story.id}:${r.questionId}`)).toEqual(['dominion-data-centers:paper-to-meter', 'dominion-data-centers:minimums', 'dominion-data-centers:own-power']);
    expect(storyMatchesOf(KIT_STORIES, 'AI buildout').map((r) => r.story.id)).toContain('ai-buildout');
  });
});

describe('K-19: the pilot fixtures are the publish step\'s, parse for parse', () => {
  it.each([['ai-buildout'], ['dominion-data-centers']])('%s', (id) => {
    const page = JSON.parse(readFileSync(resolve(HERE, '__fixtures__', 'pilot', `${id}.json`), 'utf8'));
    const publish = JSON.parse(readFileSync(resolve(HERE, '../../../api/_utils/explore/__fixtures__/pilot', `${id}.json`), 'utf8'));
    expect(page).toEqual(publish);
    expect('sample' in page).toBe(false);
  });
});
