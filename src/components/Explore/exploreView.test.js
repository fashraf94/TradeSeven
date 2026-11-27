// src/components/Explore/exploreView.test.js
//
// Explore Build 1 — THE PURE VIEW (build prompt K-6, K-7, K-12; spec §3.5, §3.7, §5.1, §5.3).
//   K-6  each drop reason; an unknown basis is drawn as "No source yet"; a dropped record is never drawn in part
//   K-7  the read's answer → loading/ready/gated/failed; the form table; every count is the read's field; the
//        question's limit is Explore's own number, pinned EQUAL to the server's (OBSERVATION_MAX, the value the
//        route's `questionOf` checks an opening question against)
//   K-12 story matching over the loaded stories

import { describe, expect, it } from 'vitest';
import {
  BASES, EXPLORE_RECORD_KIND as OWN_RECORD_KIND, FORMS, QUESTION_MAX, RESEARCH, STORY_ID, atLimitOf, frontPageOf, formOf, itemFor, questionIdFor,
  researchViewOf, sheetItemOf, stateOf, storyMatchesOf, storyOf, topicsOf,
} from './exploreView';
import { OBSERVATION_MAX, cleanPlayerText } from '../../../api/_utils/sharedResearch/session.js';
import { QUESTION_MAX_LEN } from '../../../api/_utils/researchRecords/model.js';
import { EXPLORE_RECORD_KIND } from '../../constants/sharedResearch';
import { SAMPLE_AI, SAMPLE_TAP, SAMPLE_UTILITIES, SAMPLE_STORIES, previewStoryOf } from './__fixtures__/stories';
import reads from './__fixtures__/exploreReads.json';

const unsampled = (r) => { const { sample: _s, ...rest } = r; return rest; };
const AI = unsampled(SAMPLE_AI);
const ok = (body) => ({ ok: true, status: 200, body, retryAfterS: null, gated: false, network: false });

describe('K-7: the question limit is the server\'s, restated', () => {
  it('QUESTION_MAX equals OBSERVATION_MAX (the route checks an opening question with cleanPlayerText(raw, OBSERVATION_MAX)) and the record\'s limit', () => {
    expect(QUESTION_MAX).toBe(OBSERVATION_MAX);
    expect(QUESTION_MAX).toBe(QUESTION_MAX_LEN);
    expect(cleanPlayerText('x'.repeat(QUESTION_MAX), OBSERVATION_MAX)).not.toBeNull();
    expect(cleanPlayerText('x'.repeat(QUESTION_MAX + 1), OBSERVATION_MAX)).toBeNull();
  });
  it('the record kind is the server\'s, restated (src/constants/sharedResearch.js EXPLORE_RECORD_KIND)', () => {
    expect(OWN_RECORD_KIND).toBe(EXPLORE_RECORD_KIND);
  });
  it('the story id rule is the route\'s (B6a §1.2)', () => {
    expect(STORY_ID.source).toBe('^[A-Za-z0-9_-]{1,200}$');
  });
});

describe('K-6: one stories document → the reader\'s view, or null', () => {
  it('a published story with a question is drawn; its fields are the record\'s', () => {
    const v = storyOf(AI.id, AI);
    expect(v).toMatchObject({ id: AI.id, version: 2, lead: 'story', title: AI.title, reporter: { name: 'Kim', beat: AI.reporter.beat }, publishedAt: AI.publishedAt, sample: false });
    expect(v.questions.map((q) => q.id)).toEqual(['q-chips', 'q-power']);
    expect(v.connections.map((c) => c.basis)).toEqual(['source_cited', 'reporters_reading', 'no_source_yet']);
    expect(v.sources.map((s) => s.dated)).toEqual(['Aug 2026', 'Sep 2026', 'May 2026']);
  });
  it.each([
    ['a blank title', { title: '   ' }],
    ['no title', { title: undefined }],
    ['no question', { questions: [] }],
    ['only blank questions', { questions: [{ id: 'q', text: '  ', featured: true }] }],
    ['a version that is not a whole number', { version: 1.5 }],
    ['a negative version', { version: -1 }],
    ['no version', { version: undefined }],
    ['a version as text', { version: '2' }],
    ['sample: true', { sample: true }],
    ['any sample mark but false', { sample: 'yes' }],
    ['a draft', { status: 'draft' }],
    ['no status', { status: undefined }],
  ])('dropped: %s', (_n, over) => {
    expect(storyOf(AI.id, { ...AI, ...over })).toBeNull();
  });
  it.each([['an id with a slash', 'a/b'], ['an id with a space', 'a b'], ['an empty id', ''], ['an id of 201 characters', 'x'.repeat(201)], ['a dot', 'a.b']])('dropped: %s', (_n, id) => {
    expect(storyOf(id, AI)).toBeNull();
  });
  it('an id of 200 characters, letters, digits, _ and - is kept', () => {
    expect(storyOf(`${'a'.repeat(198)}_-`, AI)).not.toBeNull();
  });
  it('an unknown basis is drawn as no_source_yet; the three are kept as given', () => {
    const v = storyOf(AI.id, { ...AI, connections: [...AI.connections, { who: 'Cooling', what: 'x', basis: 'supported' }, { who: 'Racks', what: 'y' }] });
    expect(v.connections.map((c) => c.basis)).toEqual(['source_cited', 'reporters_reading', 'no_source_yet', 'no_source_yet', 'no_source_yet']);
    expect(BASES).toEqual(['source_cited', 'reporters_reading', 'no_source_yet']);
  });
  it('a source link is kept only when it is http(s)', () => {
    const v = storyOf(AI.id, { ...AI, sources: [{ id: 'a', name: 'A', url: 'https://x.test/a' }, { id: 'b', name: 'B', url: 'javascript:alert(1)' }, { id: 'c', name: 'C', url: 'ftp://x' }] });
    expect(v.sources.map((s) => s.url)).toEqual(['https://x.test/a', null, null]);
  });
  it('a Firestore timestamp publishedAt reads as ISO', () => {
    const v = storyOf(AI.id, { ...AI, publishedAt: { toDate: () => new Date('2026-11-20T14:00:00.000Z') } });
    expect(v.publishedAt).toBe('2026-11-20T14:00:00.000Z');
  });
  it('the collection path never marks a view as a sample; only the fixture preview does', () => {
    expect(storyOf(AI.id, AI).sample).toBe(false);
    expect(SAMPLE_STORIES.every((s) => s.sample === true)).toBe(true);
    expect(previewStoryOf(AI)).toBeNull(); // a record without the mark is not a sample: the preview draws nothing
  });
});

describe('K-7: the read → the page\'s view', () => {
  it('a 200 with quota and items is ready; items keyed by story id, the first kept', () => {
    const v = researchViewOf(ok(reads.progress));
    expect(v.status).toBe(RESEARCH.READY);
    expect(v.quota).toEqual({ investigationsToday: 1, perDay: 3 });
    expect(itemFor(v, 'sample-ai-buildout').open).toMatchObject({ filled: 1, parts: 6, stepsLeft: 8 });
  });
  it('gated is the service\'s own flag (a 404 disabled)', () => {
    expect(researchViewOf({ ok: false, status: 404, body: { error: 'disabled' }, gated: true, network: false }).status).toBe(RESEARCH.GATED);
  });
  it.each([
    ['a 401', { ok: false, status: 401, body: { error: 'unauthorized' }, gated: false }],
    ['a 429', { ok: false, status: 429, body: { error: 'rate_limited' }, gated: false }],
    ['no answer', { ok: false, status: 0, body: null, gated: false, network: true }],
    ['a 404 that is not disabled', { ok: false, status: 404, body: { error: 'not_found' }, gated: false }],
    ['a 200 without quota', ok({ items: [] })],
    ['a 200 without items', ok({ quota: reads.none.quota })],
    ['a 200 whose perDay is not a count', ok({ quota: { investigationsToday: 0, perDay: '3' }, items: [] })],
    ['nothing at all', null],
  ])('failed: %s', (_n, answer) => {
    expect(researchViewOf(answer).status).toBe(RESEARCH.FAILED);
  });
  it('an item of another kind, or with neither open nor last, is not held', () => {
    const v = researchViewOf(ok({ quota: reads.none.quota, items: [
      { itemRef: { recordKind: 'fantasyTimesStories', recordId: 'x' }, open: reads.progress.items[0].open, last: null },
      { itemRef: { recordKind: EXPLORE_RECORD_KIND, recordId: 'y' }, open: null, last: null },
    ] }));
    expect(v.items).toEqual([]);
  });
});

describe('K-7: the form, by story', () => {
  const view = (name) => researchViewOf(ok(reads[name]));
  it.each([
    ['loading', { status: RESEARCH.LOADING }, FORMS.LOADING],
    ['gated', { status: RESEARCH.GATED }, FORMS.D],
    ['failed', { status: RESEARCH.FAILED }, FORMS.E],
    ['no item for the story', 'none', FORMS.A],
    ['an open investigation', 'progress', FORMS.B],
    ['a ledger (no card)', 'ledger', FORMS.B],
    ['a saved thesis', 'saved', FORMS.C],
    ['a concluded one', 'concluded', FORMS.C],
    ['open and an earlier concluded: the open decides', 'both', FORMS.B],
  ])('%s → %s', (_n, research, form) => {
    expect(formOf(typeof research === 'string' ? view(research) : research, 'sample-ai-buildout')).toBe(form);
  });
  it('another story with no item is form A even when one story is open', () => {
    expect(formOf(view('progress'), 'sample-tap-to-pay')).toBe(FORMS.A);
  });
  it('the limit is the read\'s two counts compared, and nothing else', () => {
    expect(atLimitOf(view('limit').quota)).toBe(true);
    expect(atLimitOf(view('progress').quota)).toBe(false);
    expect(atLimitOf({ investigationsToday: 4, perDay: 5 })).toBe(false);
    expect(atLimitOf({ investigationsToday: 5, perDay: 5 })).toBe(true);
    expect(atLimitOf(null)).toBe(false);
  });
});

describe('K-7: the state line carries the read\'s numbers untouched (spec §3.7)', () => {
  const view = (name) => researchViewOf(ok(reads[name]));
  it('open: filled, parts, stepsLeft as read; a ledger: filled null', () => {
    expect(stateOf({ item: itemFor(view('progress'), 'sample-ai-buildout') })).toEqual({ kind: 'open', filled: 1, parts: 6, stepsLeft: 8 });
    expect(stateOf({ item: itemFor(view('ledger'), 'sample-ai-buildout') })).toMatchObject({ kind: 'open', filled: null });
    // planted numbers that no rule would compute: shown as given
    expect(stateOf({ item: { open: { filled: 4, parts: 7, stepsLeft: 13 } } })).toEqual({ kind: 'open', filled: 4, parts: 7, stepsLeft: 13 });
  });
  it('saved and concluded, with the read\'s time; a bookmark alone; nothing', () => {
    expect(stateOf({ item: itemFor(view('saved'), 'sample-ai-buildout') })).toMatchObject({ kind: 'saved', at: reads.saved.items[0].last.at });
    expect(stateOf({ item: itemFor(view('concluded'), 'sample-ai-buildout') })).toMatchObject({ kind: 'concluded' });
    expect(stateOf({ item: null, bookmarked: true })).toEqual({ kind: 'bookmarked' });
    expect(stateOf({ item: null })).toBeNull();
  });
  it('the open investigation decides over a bookmark and over an earlier finished one', () => {
    expect(stateOf({ item: itemFor(view('both'), 'sample-ai-buildout'), bookmarked: true }).kind).toBe('open');
  });
});

describe('the home and the sheet item', () => {
  it('Build 2 (B-3, B-4, B-5): the newest overview is the hero; a product-led one a tile; the rest one card each, on its first featured question; topics only from the cards', () => {
    const page = frontPageOf(SAMPLE_STORIES);
    expect(`${page.hero.story.id}:${page.hero.question.id}`).toBe('sample-ai-buildout:q-chips');
    expect(page.tiles.map((s) => s.id)).toEqual(['sample-tap-to-pay']);
    expect(page.cards.map((c) => `${c.story.id}:${c.question.id}`)).toEqual(['sample-utility-load:q-earn']);
    expect(topicsOf(page.cards)).toEqual(['Energy grid']);
  });
  it('a story opens on the asked question, else its first featured', () => {
    const s = SAMPLE_STORIES[0];
    expect(questionIdFor(s, 'q-power')).toBe('q-power');
    expect(questionIdFor(s, 'nope')).toBe('q-chips');
    expect(questionIdFor(s)).toBe('q-chips');
  });
  it('Work this idea hands the sheet the spec\'s item: the story, the question as edited, reason null', () => {
    const s = SAMPLE_STORIES[0];
    expect(sheetItemOf(s, '  My own question  ')).toEqual({
      itemRef: { recordKind: 'exploreStories', recordId: 'sample-ai-buildout' }, headline: s.title, reporterName: 'Kim',
      beat: s.reporter.beat, publishedAt: s.publishedAt, context: s.deck, question: '  My own question  ', reason: null,
    });
  });
});

describe('K-12: story matching (spec §3.3)', () => {
  const ids = (text) => storyMatchesOf(SAMPLE_STORIES, text).map((r) => `${r.story.id}:${r.questionId}`);
  it('a question\'s own words open on that question', () => {
    expect(ids('power-equipment')).toEqual(['sample-ai-buildout:q-power']);
  });
  it('the title, deck, topics, product name and tickers match the story, opening its first featured question', () => {
    expect(ids('beyond the chips')).toEqual(['sample-ai-buildout:q-chips']);
    expect(ids('Payments')).toEqual(['sample-tap-to-pay:q-tap']);
    expect(ids('tap to pay')).toEqual(['sample-tap-to-pay:q-tap']);
    expect(ids('nvda')).toEqual(['sample-ai-buildout:q-chips']);
    expect(ids('DUK')).toEqual(['sample-utility-load:q-earn']);
  });
  it('"power" names the AI story\'s power question and the utilities story', () => {
    expect(ids('power')).toEqual(['sample-ai-buildout:q-power', 'sample-utility-load:q-earn']);
  });
  it('nothing for nonsense or blank', () => {
    expect(ids('qqzzxx')).toEqual([]);
    expect(ids('   ')).toEqual([]);
  });
  it('the three sample records are the spec\'s shape, each marked a sample', () => {
    for (const r of [SAMPLE_AI, SAMPLE_TAP, SAMPLE_UTILITIES]) {
      expect(r.sample).toBe(true);
      expect(Object.keys(r)).toEqual(expect.arrayContaining(['id', 'version', 'status', 'publishedAt', 'lead', 'title', 'deck', 'reporter', 'evidenceSpan', 'body', 'parts', 'openQuestion', 'connections', 'sources', 'questions', 'topics', 'tickers', 'sample']));
    }
    expect(SAMPLE_TAP).toMatchObject({ lead: 'product', productName: 'Tap to pay' });
    expect(SAMPLE_UTILITIES.questions.filter((q) => q.featured)).toHaveLength(2);
  });
});
