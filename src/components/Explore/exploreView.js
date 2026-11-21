// src/components/Explore/exploreView.js
//
// Explore Build 1 — THE PAGE'S PURE VIEW (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md
// §3.7, §5; build prompt K-6, K-7, K-12). No I/O, no clock, no React.
//
// RENDER, NEVER DECIDE (BUILD_RULES §9, K-7). Every count the page shows is a field of the
// one research read (`GET ?list=explore`, B6a X-1): the cost line is the read's
// `quota.investigationsToday` and `quota.perDay`; the state line is the item's `open.filled`,
// `open.parts` and `open.stepsLeft`; whether a story has an investigation is whether the read
// holds an item for it. Nothing here counts, budgets or limits on its own.
//
//   researchViewOf   the service's answer → loading is the hook's; ready (quota, items by story),
//                    gated (the service's `gated`: a 404 disabled) or failed (anything else, N-9)
//   storyOf          one stories document → the reader's view (spec §5.1), or null: a dropped
//                    record is never drawn in part (K-6)
//   formOf           the panel's form for a story (spec §3.5): by the read's item for that story
//   stateOf          the card's state line (spec §3.7)
//   storyMatchesOf   search over the loaded stories (spec §3.3; companies are SearchOverlay's matcher)
//   sheetItemOf      the `item` the sheet is handed on Work this idea (spec §3.6's table)

import { EXPLORE_RECORD_KIND } from '../../constants/sharedResearch';

/** The route's id rule for a story (B6a §1.2): the document id, as `itemRef.recordId`. */
export const STORY_ID = /^[A-Za-z0-9_-]{1,200}$/;
/** The three bases a published connection may carry (E-1). Any other value is drawn as `no_source_yet` (K-6). */
export const BASES = Object.freeze(['source_cited', 'reporters_reading', 'no_source_yet']);
/**
 * The opening question's limit: Explore's own number, pinned EQUAL to the server's by test — the route's
 * `questionOf` checks it with cleanPlayerText(raw, OBSERVATION_MAX) (api/_utils/sharedResearch/session.js).
 */
export const QUESTION_MAX = 500;
/** Stories read per page mount, newest first (spec §5.3). */
export const STORIES_READ = 12;
/** Bookmarks per player — the client's cap (spec §5.2); the rules do not count. */
export const BOOKMARKS_MAX = 50;
/** A bookmark's stored title, at most (the rules block holds the same bound). */
export const BOOKMARK_TITLE_MAX = 200;

const textOf = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const textsOf = (v) => (Array.isArray(v) ? v.map(textOf).filter(Boolean) : []);
const isCount = (v) => Number.isSafeInteger(v) && v >= 0;
const countOr = (v, fallback = null) => (isCount(v) ? v : fallback);
const isSessionId = (v) => typeof v === 'string' && v.length > 0;

/** An instant (a Firestore Timestamp, a Date or an ISO string) as ISO, or null. */
export function isoOf(v) {
  try {
    const d = typeof v?.toDate === 'function' ? v.toDate() : v instanceof Date ? v : typeof v === 'string' ? new Date(v) : null;
    return d && Number.isFinite(d.getTime()) ? d.toISOString() : null;
  } catch {
    return null;
  }
}

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
/** "Nov 20, 2026" (Eastern), or null. */
export function dateOf(iso) {
  const ms = typeof iso === 'string' ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? DATE.format(new Date(ms)) : null;
}

// ── the research read ─────────────────────────────────────────────────────────

export const RESEARCH = Object.freeze({ LOADING: 'loading', READY: 'ready', GATED: 'gated', FAILED: 'failed' });

function openOf(raw) {
  if (!raw || typeof raw !== 'object' || !isSessionId(raw.sessionId)) return null;
  return {
    sessionId: raw.sessionId,
    question: textOf(raw.question),
    lastTurnAt: isoOf(raw.lastTurnAt),
    filled: countOr(raw.filled),
    parts: countOr(raw.parts),
    stepsLeft: countOr(raw.stepsLeft),
    findingsCount: countOr(raw.findingsCount),
  };
}
function lastOf(raw) {
  if (!raw || typeof raw !== 'object' || !isSessionId(raw.sessionId) || (raw.ended !== 'saved' && raw.ended !== 'concluded')) return null;
  return { sessionId: raw.sessionId, ended: raw.ended, at: isoOf(raw.at) };
}

/**
 * The service's answer as the page reads it (spec §5.3, N-8, N-9): `gated` is the service's own flag (a 404
 * disabled); a 200 whose body holds the quota's two counts and an items list is `ready`; anything else — a 401,
 * a 429, no answer, a body of another shape — is `failed`. Items are keyed by story id, the first (newest) kept.
 */
export function researchViewOf(answer) {
  if (answer?.gated === true) return { status: RESEARCH.GATED };
  const body = answer?.ok === true ? answer.body : null;
  const quota = body?.quota;
  if (!body || !Array.isArray(body.items) || !isCount(quota?.investigationsToday) || !isCount(quota?.perDay)) return { status: RESEARCH.FAILED };
  const byStory = new Map();
  for (const it of body.items) {
    const ref = it?.itemRef;
    if (ref?.recordKind !== EXPLORE_RECORD_KIND || typeof ref.recordId !== 'string' || !ref.recordId || byStory.has(ref.recordId)) continue;
    const item = { storyId: ref.recordId, itemVersion: countOr(it.itemVersion), open: openOf(it.open), last: lastOf(it.last) };
    if (item.open || item.last) byStory.set(item.storyId, item);
  }
  return {
    status: RESEARCH.READY,
    quota: { investigationsToday: quota.investigationsToday, perDay: quota.perDay },
    items: [...byStory.values()],
    byStory,
  };
}

/** The read's item for a story, or null (only a ready read holds items). */
export const itemFor = (research, storyId) => (research?.status === RESEARCH.READY ? research.byStory.get(storyId) ?? null : null);

/** The day's limit, from the read's two counts and nothing else. */
export const atLimitOf = (quota) => Boolean(quota) && quota.investigationsToday >= quota.perDay;

// ── one story ────────────────────────────────────────────────────────────────

function questionsOf(raw) {
  const seen = new Set();
  const out = [];
  (Array.isArray(raw) ? raw : []).forEach((q, i) => {
    const text = textOf(q?.text);
    if (!text) return;
    let id = typeof q.id === 'string' && q.id.trim() ? q.id.trim() : `q${i}`;
    if (seen.has(id)) id = `${id}~${i}`;
    seen.add(id);
    out.push({ id, text, angleLabel: textOf(q.angleLabel), unknown: textOf(q.unknown), featured: q.featured === true });
  });
  return out;
}
const isLink = (v) => typeof v === 'string' && /^https?:\/\/[^\s]+$/i.test(v);
function connectionsOf(raw) {
  return (Array.isArray(raw) ? raw : []).map((c) => {
    const who = textOf(c?.who);
    if (!who) return null;
    return { who, what: textOf(c.what), basis: BASES.includes(c.basis) ? c.basis : 'no_source_yet', basisLine: textOf(c.basisLine), leads: textsOf(c.leads) };
  }).filter(Boolean);
}
function sourcesOf(raw) {
  return (Array.isArray(raw) ? raw : []).map((s, i) => {
    const name = textOf(s?.name);
    if (!name) return null;
    return { id: textOf(s.id) ?? `s${i}`, name, kind: textOf(s.kind), dated: textOf(s.dated), excerpt: textOf(s.excerpt), url: isLink(s.url) ? s.url : null };
  }).filter(Boolean);
}
function partsOf(raw) {
  return (Array.isArray(raw) ? raw : []).map((p) => {
    const name = textOf(p?.name);
    return name ? { name, job: textOf(p.job), timing: textOf(p.timing) } : null;
  }).filter(Boolean);
}

/**
 * One `exploreStories` document as the reader draws it (spec §5.1), or null (K-6): an id outside the route's
 * rule, a record that carries `sample`, a status other than `published`, a blank title, a version that is not a
 * whole number ≥ 0, or no question. Never drawn in part. `sample` on the view is always false here: a sample is
 * drawn only by the fixture preview, which builds its own views (`__fixtures__`).
 */
export function storyOf(id, data) {
  if (typeof id !== 'string' || !STORY_ID.test(id)) return null;
  if (!data || typeof data !== 'object') return null;
  if (data.sample !== undefined && data.sample !== false) return null;
  if (data.status !== 'published') return null;
  const title = textOf(data.title);
  if (!title || !Number.isSafeInteger(data.version) || data.version < 0) return null;
  const questions = questionsOf(data.questions);
  if (questions.length === 0) return null;
  const reporter = data.reporter && typeof data.reporter === 'object' ? data.reporter : {};
  return {
    id,
    version: data.version,
    lead: data.lead === 'product' ? 'product' : 'story',
    productName: textOf(data.productName),
    title,
    deck: textOf(data.deck),
    reporter: { name: textOf(reporter.name), beat: textOf(reporter.beat) },
    publishedAt: isoOf(data.publishedAt),
    evidenceSpan: textOf(data.evidenceSpan),
    body: textsOf(data.body),
    parts: partsOf(data.parts),
    openQuestion: textOf(data.openQuestion),
    connections: connectionsOf(data.connections),
    sources: sourcesOf(data.sources),
    questions,
    topics: textsOf(data.topics),
    tickers: textsOf(data.tickers),
    sample: false,
  };
}

/** The question a story opens on: the given one if the story has it, else its first featured, else its first. */
export function questionIdFor(story, wanted = null) {
  if (wanted && story.questions.some((q) => q.id === wanted)) return wanted;
  return (story.questions.find((q) => q.featured) ?? story.questions[0]).id;
}

/** The home's cards (spec §3.2 item 4): one per featured question, stories newest first as read. */
export const featuredCardsOf = (stories) => stories.flatMap((story) => story.questions.filter((q) => q.featured).map((question) => ({ story, question })));

/** The topics that have a featured question (a topic with no story is not shown), in first-seen order. */
export const topicsOf = (stories) => [...new Set(featuredCardsOf(stories).flatMap((c) => c.story.topics))];

// ── the panel and the cards ──────────────────────────────────────────────────

export const FORMS = Object.freeze({ LOADING: 'loading', A: 'A', B: 'B', C: 'C', D: 'D', E: 'E' });

/**
 * The panel's form for a story (spec §3.5, K-7): gated → D, failed → E, loading → loading; ready → the read's
 * item for this story: `open` → B, else `last` → C, else A.
 */
export function formOf(research, storyId) {
  if (!research || research.status === RESEARCH.LOADING) return FORMS.LOADING;
  if (research.status === RESEARCH.GATED) return FORMS.D;
  if (research.status !== RESEARCH.READY) return FORMS.E;
  const item = itemFor(research, storyId);
  if (item?.open) return FORMS.B;
  if (item?.last) return FORMS.C;
  return FORMS.A;
}

/**
 * A story's state line (spec §3.7): the open investigation decides when there is one; else the last ended one;
 * else a bookmark; else none. `{ kind: 'open', filled, parts, stepsLeft }` carries the read's numbers untouched.
 */
export function stateOf({ item = null, bookmarked = false }) {
  if (item?.open) return { kind: 'open', filled: item.open.filled, parts: item.open.parts, stepsLeft: item.open.stepsLeft };
  if (item?.last) return { kind: item.last.ended, at: item.last.at };
  if (bookmarked) return { kind: 'bookmarked' };
  return null;
}

/** The sheet's `item` for Work this idea (spec §3.6): the story as the sheet's preview names it, the question as edited. */
export function sheetItemOf(story, question) {
  return {
    itemRef: { recordKind: EXPLORE_RECORD_KIND, recordId: story.id },
    headline: story.title,
    reporterName: story.reporter.name,
    beat: story.reporter.beat,
    publishedAt: story.publishedAt,
    context: story.deck,
    question,
    reason: null,
  };
}

// ── search (spec §3.3) ───────────────────────────────────────────────────────

const norm = (v) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * The stories and questions a search names: a question whose own text matches opens on that question; a story
 * whose title, deck, topics, product name or tickers match opens on its first featured question. One row each.
 */
export function storyMatchesOf(stories, raw) {
  const s = norm(raw);
  if (!s) return [];
  const rows = [];
  for (const story of stories) {
    const hits = story.questions.filter((q) => norm(q.text).includes(s));
    const storyHit = [story.title, story.deck, story.productName, ...story.topics, ...story.tickers].some((f) => f && norm(f).includes(s));
    if (hits.length) hits.forEach((q) => rows.push({ story, questionId: q.id, text: q.text }));
    else if (storyHit) {
      const id = questionIdFor(story);
      rows.push({ story, questionId: id, text: story.questions.find((q) => q.id === id).text });
    }
  }
  return rows;
}

/** The own-words row needs this many characters typed (spec §3.3). */
export const OWN_WORDS_MIN = 3;
