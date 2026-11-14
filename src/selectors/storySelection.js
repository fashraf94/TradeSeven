// src/selectors/storySelection.js
//
// Command Center core spec V1.2, Amendment E V1.1 §2.2 — THE STORY SELECTOR. It decides which FantasyTimes stories the hub
// hands the Shared Research sheet as its Recent stories (built in Part 2, the hub research door) and, from onboarding O3,
// which story the For-you card shows. One definition for both. It is pure: no React, no read, no model, no network. Its
// stories come from the hub's stories reader (src/hooks/useHubStories.js, which calls fetchFeed()), and nothing here reads
// them again.
//
// It lives outside src/components/CommandCenter/ and imports nothing from there: the hub's mount guard admits no edge from
// another src/ file into the hub directory. It is a permitted terminal of the hub's import walk.
//
//   selectStories({ stories, nowMs, interests = null }) → { items, general }
//
//   1. Eligible types (Level 0; ruling F-4): market_mover, macro_alert, earnings_recap, sector_column, econ_recap.
//      Left out: market_pulse (no question to investigate), deepdive (hidden by convention), and the two previews,
//      earnings_preview and econ_preview (the event has not happened). This narrows the Shared Research spec §8's
//      `type != 'deepdive'`; the selector is the hub's.
//   2. Required: a non-empty headline, a readable publishedAt, and expiresAt after nowMs. The feed already filters
//      `status == 'published'` and `expiresAt > now` at its own read; the selector judges expiry again at `nowMs`, so a
//      story held since an earlier read never outlives its own expiry.
//   3. The match is O3's (it needs onboarding W1's interests record). In Part 2 no story matches: `general` is true and
//      every `reason` is null. matchedIds() below is the seam O3 fills.
//   4. Order: matched stories newest first, then the rest newest first (equal times by id). At most five.
//   5. Each item has the sheet's `item` shape (B2 report §10):
//      { itemRef: { recordKind: 'fantasyTimesStories', recordId }, headline, reporterName, beat, publishedAt (ISO),
//        context, question, reason }. `question` is the beat's (src/constants/sharedResearch.js questionForBeat, merged
//      with B1), the default for an unknown beat.

import { questionForBeat } from '../constants/sharedResearch';

/** The story types a Level 0 investigation can start from (ruling F-4), in the amendment's order. */
export const ELIGIBLE_STORY_TYPES = Object.freeze(['market_mover', 'macro_alert', 'earnings_recap', 'sector_column', 'econ_recap']);
/** How many stories the selection offers. */
export const STORY_LIMIT = 5;
/** The record kind every item's itemRef names (spec §8: the same id Huddle S1 uses as `newsId`). */
export const STORY_RECORD_KIND = 'fantasyTimesStories';

const nonEmpty = (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** ms since the epoch for an ISO string, a Date or a finite number; null for anything else. */
function msOf(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/** A story the selection can offer, with its publication time, or null. */
function candidateOf(story, nowMs) {
  if (!story || typeof story !== 'object') return null;
  const id = nonEmpty(story.id);
  if (!id || !ELIGIBLE_STORY_TYPES.includes(story.type)) return null;
  const headline = nonEmpty(story.headline);
  const publishedMs = msOf(story.publishedAt);
  const expiresMs = msOf(story.expiresAt);
  if (!headline || publishedMs === null || expiresMs === null || !(expiresMs > nowMs)) return null;
  return { id, story, headline, publishedMs };
}

/**
 * O3's seam (needs W1): the ids of the stories whose `sector`, or one of whose `themes`, equals a value mapped from one of
 * the player's chips. Typed text is never matched. Until O3 builds it, no story matches.
 */
function matchedIds() {
  return new Set();
}

const newestFirst = (a, b) => (b.publishedMs - a.publishedMs) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The sheet's item for one candidate (B2 report §10). `reason` is O3's, for a real match only. */
function itemOf({ id, story, headline, publishedMs }) {
  return Object.freeze({
    itemRef: Object.freeze({ recordKind: STORY_RECORD_KIND, recordId: id }),
    headline,
    reporterName: nonEmpty(story.reporterName),
    beat: nonEmpty(story.reporterBeat),
    publishedAt: new Date(publishedMs).toISOString(),
    context: nonEmpty(story.subheadline),
    question: questionForBeat(story.reporterBeat),
    reason: null,
  });
}

/**
 * @param {object}   p
 * @param {object[]} p.stories          the feed's stories, as fetchFeed() answers them
 * @param {number}   p.nowMs            the clock expiry is judged at
 * @param {object|null} [p.interests]   onboarding W1's interests record (O3); null in Part 2
 * @returns {{ items: object[], general: boolean }}
 */
export function selectStories({ stories, nowMs, interests = null }) {
  const now = typeof nowMs === 'number' && Number.isFinite(nowMs) ? nowMs : Date.now();
  const candidates = (Array.isArray(stories) ? stories : []).map((story) => candidateOf(story, now)).filter(Boolean);
  const matched = matchedIds(candidates, interests);
  const first = candidates.filter((c) => matched.has(c.id)).sort(newestFirst);
  const rest = candidates.filter((c) => !matched.has(c.id)).sort(newestFirst);
  const items = [...first, ...rest].slice(0, STORY_LIMIT).map(itemOf);
  return Object.freeze({ items: Object.freeze(items), general: first.length === 0 });
}
