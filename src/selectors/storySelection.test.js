// src/selectors/storySelection.test.js
//
// Command Center core spec V1.2, Amendment E V1.1 §2.2 (built in Part 2) — the story selector's rows: the eligible types
// (each excluded type is a row), the required fields, expiry at `nowMs`, newest first, at most five, the beat's question and
// the default for an unknown beat, no reason and a general selection without interests, and the item's exact shape (the
// sheet's `item`, B2 report §10, checked against the body's own fixture story).

import { describe, expect, it } from 'vitest';
import { DEFAULT_BEAT_QUESTION, questionForBeat } from '../constants/sharedResearch';
import { storyOf } from '../components/SharedResearch/__fixtures__/srKit';
import { ELIGIBLE_STORY_TYPES, STORY_LIMIT, STORY_RECORD_KIND, selectStories } from './storySelection';

const NOW = Date.UTC(2026, 10, 14, 15, 0);
const iso = (ms) => new Date(ms).toISOString();
const HOUR = 3600 * 1000;

/** A feed story as /api/fantasytimes/feed answers it (api/fantasytimes/feed.js: id, the document's fields, ISO times). */
const story = (id, over = {}) => ({
  id,
  reporter: 'alex',
  reporterName: 'Alex Rivera',
  reporterBeat: 'Stock Spotlight',
  type: 'market_mover',
  status: 'published',
  headline: `Headline ${id}`,
  subheadline: `Subheadline ${id}`,
  tickers: ['NVDA'],
  primaryTicker: 'NVDA',
  sector: 'Technology',
  themes: ['AI'],
  publishedAt: iso(NOW - HOUR),
  expiresAt: iso(NOW + 6 * HOUR),
  ...over,
});
const ids = (out) => out.items.map((item) => item.itemRef.recordId);

describe('eligible types (Level 0; ruling F-4)', () => {
  it('the five types, in the amendment\'s order', () => {
    expect(ELIGIBLE_STORY_TYPES).toEqual(['market_mover', 'macro_alert', 'earnings_recap', 'sector_column', 'econ_recap']);
    expect(Object.isFrozen(ELIGIBLE_STORY_TYPES)).toBe(true);
  });

  // A literal list, not ELIGIBLE_STORY_TYPES: a type dropped from the constant must fail its row, not remove it.
  it.each(['market_mover', 'macro_alert', 'earnings_recap', 'sector_column', 'econ_recap'])('%s is offered', (type) => {
    expect(ids(selectStories({ stories: [story('a', { type })], nowMs: NOW }))).toEqual(['a']);
  });

  it.each([
    ['market_pulse', 'no question to investigate'],
    ['deepdive', 'hidden by convention'],
    ['earnings_preview', 'the event has not happened'],
    ['econ_preview', 'the event has not happened'],
    ['unknown_kind', 'a type the selector does not know'],
    [undefined, 'no type at all'],
  ])('%s is left out (%s)', (type) => {
    expect(selectStories({ stories: [story('a', { type })], nowMs: NOW }).items).toEqual([]);
  });
});

describe('the required fields', () => {
  it.each([
    ['an empty headline', { headline: '' }],
    ['a blank headline', { headline: '   ' }],
    ['no headline', { headline: undefined }],
    ['an unreadable publishedAt', { publishedAt: 'not a date' }],
    ['no publishedAt', { publishedAt: undefined }],
    ['an unreadable expiresAt', { expiresAt: 'soon' }],
    ['no expiresAt', { expiresAt: undefined }],
    ['no id', { id: undefined }],
    ['a blank id', { id: '' }],
  ])('%s: left out', (_what, over) => {
    expect(selectStories({ stories: [story('a', over)], nowMs: NOW }).items).toEqual([]);
  });

  it('an expired story is dropped, judged at nowMs: expiresAt equal to now is expired, a millisecond later is not', () => {
    expect(selectStories({ stories: [story('a', { expiresAt: iso(NOW - 1) })], nowMs: NOW }).items).toEqual([]);
    expect(selectStories({ stories: [story('a', { expiresAt: iso(NOW) })], nowMs: NOW }).items).toEqual([]);
    expect(ids(selectStories({ stories: [story('a', { expiresAt: iso(NOW + 1) })], nowMs: NOW }))).toEqual(['a']);
  });

  it('a story held since an earlier read is dropped once its own expiry passes, with no new read', () => {
    const held = [story('a', { expiresAt: iso(NOW + HOUR) })];
    expect(ids(selectStories({ stories: held, nowMs: NOW }))).toEqual(['a']);
    expect(selectStories({ stories: held, nowMs: NOW + HOUR }).items).toEqual([]);
  });

  it('anything that is not a story is skipped, and a missing list is no list', () => {
    expect(ids(selectStories({ stories: [null, 3, 'x', story('a')], nowMs: NOW }))).toEqual(['a']);
    expect(selectStories({ stories: null, nowMs: NOW })).toEqual({ items: [], general: true });
    expect(selectStories({ stories: undefined, nowMs: NOW })).toEqual({ items: [], general: true });
  });
});

describe('order and size', () => {
  it('newest first by publishedAt, whatever order the feed sent', () => {
    const stories = [story('old', { publishedAt: iso(NOW - 5 * HOUR) }), story('new', { publishedAt: iso(NOW - HOUR) }), story('mid', { publishedAt: iso(NOW - 3 * HOUR) })];
    expect(ids(selectStories({ stories, nowMs: NOW }))).toEqual(['new', 'mid', 'old']);
  });

  it('at most five: the five newest', () => {
    const stories = Array.from({ length: 8 }, (_, i) => story(`s${i}`, { publishedAt: iso(NOW - (i + 1) * HOUR) }));
    expect(STORY_LIMIT).toBe(5);
    expect(ids(selectStories({ stories, nowMs: NOW }))).toEqual(['s0', 's1', 's2', 's3', 's4']);
  });

  it('the cut comes after the filter: an ineligible story never takes one of the five places', () => {
    const stories = [
      story('pulse', { type: 'market_pulse', publishedAt: iso(NOW - 10 * 60000) }),
      ...Array.from({ length: 5 }, (_, i) => story(`s${i}`, { publishedAt: iso(NOW - (i + 1) * HOUR) })),
    ];
    expect(ids(selectStories({ stories, nowMs: NOW }))).toEqual(['s0', 's1', 's2', 's3', 's4']);
  });

  it('equal times are ordered by id, so the selection is stable', () => {
    const at = iso(NOW - HOUR);
    expect(ids(selectStories({ stories: [story('b', { publishedAt: at }), story('a', { publishedAt: at })], nowMs: NOW }))).toEqual(['a', 'b']);
  });
});

describe('the question', () => {
  it.each(['Market Pulse', 'Stock Spotlight', 'Economics Desk', 'Earnings Analyst', 'Sector Strategist'])('the beat %s takes its own question', (beat) => {
    const [item] = selectStories({ stories: [story('a', { reporterBeat: beat })], nowMs: NOW }).items;
    expect(item.question).toBe(questionForBeat(beat));
    expect(item.question).not.toBe(DEFAULT_BEAT_QUESTION);
  });

  it.each([['an unknown beat', 'Thematic & Industry Research'], ['no beat', undefined], ['a beat that names an Object key', 'toString']])('%s takes the default question', (_what, beat) => {
    const [item] = selectStories({ stories: [story('a', { reporterBeat: beat })], nowMs: NOW }).items;
    expect(item.question).toBe(DEFAULT_BEAT_QUESTION);
  });
});

describe('no interests in Part 2: a general selection, no reason', () => {
  it('interests null (the default): general is true and every reason is null', () => {
    const out = selectStories({ stories: [story('a'), story('b', { publishedAt: iso(NOW - 2 * HOUR) })], nowMs: NOW });
    expect(out.general).toBe(true);
    expect(out.items.map((item) => item.reason)).toEqual([null, null]);
  });

  it('even an interests record matches nothing until O3 builds the match: no reason is invented', () => {
    const out = selectStories({ stories: [story('a', { sector: 'Technology', themes: ['AI'] })], nowMs: NOW, interests: { explore: ['Technology'], know: ['AI'], typed: 'AI chips' } });
    expect(out.general).toBe(true);
    expect(out.items[0].reason).toBeNull();
  });
});

describe('the item\'s exact shape (the sheet\'s `item`, B2 report §10)', () => {
  it('every field, from the feed\'s own field names', () => {
    const published = NOW - 2 * HOUR;
    const [item] = selectStories({ stories: [story('st_1', { publishedAt: iso(published), reporterName: 'Neta Cohen', reporterBeat: 'Economics Desk', subheadline: 'Rates held.' })], nowMs: NOW }).items;
    expect(item).toEqual({
      itemRef: { recordKind: 'fantasyTimesStories', recordId: 'st_1' },
      headline: 'Headline st_1',
      reporterName: 'Neta Cohen',
      beat: 'Economics Desk',
      publishedAt: iso(published),
      context: 'Rates held.',
      question: questionForBeat('Economics Desk'),
      reason: null,
    });
    expect(STORY_RECORD_KIND).toBe('fantasyTimesStories');
    expect(Object.isFrozen(item)).toBe(true);
  });

  it('the same keys as the body\'s fixture story (srKit storyOf), the shape its stories[] and item are built on', () => {
    const [item] = selectStories({ stories: [story('a')], nowMs: NOW }).items;
    expect(Object.keys(item).sort()).toEqual(Object.keys(storyOf()).sort());
    expect(Object.keys(item.itemRef).sort()).toEqual(Object.keys(storyOf().itemRef).sort());
  });

  it('no subheadline: context is null; publishedAt is written as an ISO instant whatever form it came in', () => {
    const [item] = selectStories({ stories: [story('a', { subheadline: undefined, publishedAt: NOW - HOUR })], nowMs: NOW }).items;
    expect(item.context).toBeNull();
    expect(item.publishedAt).toBe(iso(NOW - HOUR));
  });

  it('the selection never changes the stories it was given', () => {
    const stories = [story('a'), story('b', { publishedAt: iso(NOW - 3 * HOUR) })];
    const before = JSON.stringify(stories);
    selectStories({ stories, nowMs: NOW });
    expect(JSON.stringify(stories)).toBe(before);
  });
});
