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
//
// Explore Build 2 (docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md §3, §4, §5; build prompt K-3 to K-8, K-12,
// K-13, K-15, K-16) adds:
//   - the record's new optional fields to storyOf, and NOTHING it carries for comparing: no cell, value, formula,
//     input, benchmark, wrongIfSeed, watch, match, matched or storedKey is ever copied (a guard row walks the view).
//     Every reason storyOf returns null is Build 1's; a malformed new field is left out, never a reason to drop;
//   - which sources are listed (§5.3), decided once, from the record, inside storyOf;
//   - the read's last.question, last.statement and agent (B6c §1.1);
//   - the front page's split (frontPageOf), the shelf (shelfOf), the chain's counts (countsOf), and the hierarchy
//     (doorOf, parentOf, linkedIdsOf), each over stories already read.

/**
 * An Explore story's record kind and its collection, one name (B6a X-2). Explore's own copy of
 * src/constants/sharedResearch.js EXPLORE_RECORD_KIND, pinned EQUAL to it by exploreView.test.js: importing that module
 * here would pull it out of the hub's chunk into a shared one (the bundle diff, report §7).
 */
export const EXPLORE_RECORD_KIND = 'exploreStories';

/** The route's id rule for a story (B6a §1.2): the document id, as `itemRef.recordId`. */
export const STORY_ID = /^[A-Za-z0-9_-]{1,200}$/;
/** The three bases a published connection may carry (E-1). Any other value is drawn as `no_source_yet` (K-6). */
export const BASES = Object.freeze(['source_cited', 'reporters_reading', 'no_source_yet']);
/**
 * The opening question's limit: Explore's own number, pinned EQUAL to the server's by test — the route's
 * `questionOf` checks it with cleanPlayerText(raw, OBSERVATION_MAX) (api/_utils/sharedResearch/session.js).
 */
export const QUESTION_MAX = 500;
/** Stories read per page mount, newest first (spec §5.3; Amendment B §5.1 raised it from 12, K-4). */
export const STORIES_READ = 40;
/** At most this many stories read by id for one story page, when the stories read was not complete (Amendment B §5.1). */
export const LINKED_READS_MAX = 6;
/** The Latest deep stories row: the newest this many (Amendment B §4.1 item 6). */
export const LATEST_MAX = 3;
/** The shelf lists every open investigation, then this many finished ones, newest first (Amendment B §4.2; SQ-5). */
export const SHELF_FINISHED_MAX = 3;
/** A broad question names at least this many companies in its `group` (Amendment B §3). */
export const BROAD_MIN = 3;
/** The two kinds of story (Amendment B §3): `'deep'` is a deep story; any other `kind`, or none, is an overview. */
export const KINDS = Object.freeze({ OVERVIEW: 'overview', DEEP: 'deep' });
/** A symbol the page draws as a button that opens the stock's research page (K-11). Anything else is plain text. */
const SYMBOL = /^[A-Z0-9][A-Z0-9.-]{0,11}$/;
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
  // B6c X-8: the question it was opened with, and (saved only) the sentence the save recorded; each null when absent
  return { sessionId: raw.sessionId, ended: raw.ended, at: isoOf(raw.at), question: textOf(raw.question), statement: textOf(raw.statement) };
}
/**
 * B6c X-9: the player's ranked agent as the read names it, or null (no ranked agent, or a malformed one). The page
 * hands the sheet its id and name, and the equipped list's name; it reads nothing else of it (Amendment B §5.2).
 */
function agentOf(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id.trim()) return null;
  const list = raw.equippedList && typeof raw.equippedList === 'object' ? raw.equippedList : null;
  return { id: raw.id, name: textOf(raw.name), equippedListName: textOf(list?.name) };
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
    agent: agentOf(body.agent),
  };
}

/** The read's agent, or null (only a ready read names one). */
export const agentFor = (research) => (research?.status === RESEARCH.READY ? research.agent ?? null : null);

/**
 * The shelf, "Your theses" (Amendment B §4.2, K-12), from the read alone: every open investigation in the read's own
 * order, then the SHELF_FINISHED_MAX newest finished ones (by the read's `last.at`). A story with an open
 * investigation and an earlier finished one is in both lists: they are two theses. The two counts are the lengths of
 * the read's own lists (how many of each the read holds), never a number of the page's own.
 */
export function shelfOf(research) {
  if (research?.status !== RESEARCH.READY) return null;
  const open = research.items.filter((it) => it.open);
  const ended = research.items.filter((it) => it.last);
  const newestFirst = [...ended].sort((a, b) => (b.last.at ?? '').localeCompare(a.last.at ?? ''));
  return { open, finished: newestFirst.slice(0, SHELF_FINISHED_MAX), openCount: open.length, finishedCount: ended.length };
}

/** The read's item for a story, or null (only a ready read holds items). */
export const itemFor = (research, storyId) => (research?.status === RESEARCH.READY ? research.byStory.get(storyId) ?? null : null);

/** The day's limit, from the read's two counts and nothing else. */
export const atLimitOf = (quota) => Boolean(quota) && quota.investigationsToday >= quota.perDay;

// ── one story ────────────────────────────────────────────────────────────────

const listOf = (v) => (Array.isArray(v) ? v : []);

/**
 * A company as a lead, a group member or `about` names it (Amendment B §3, K-11): `{ symbol, name }`. A symbol of the
 * listed shape makes it a button (name falls back to the symbol); without one it is plain text, by its name. A lead
 * that is plain text (the old shape) is plain text. Anything else is left out. Never a figure, never reordered.
 */
function companyOf(raw) {
  if (typeof raw === 'string') {
    const text = textOf(raw);
    return text ? { symbol: null, name: text } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const symbol = typeof raw.symbol === 'string' && SYMBOL.test(raw.symbol.trim()) ? raw.symbol.trim() : null;
  const name = textOf(raw.name);
  if (symbol) return { symbol, name: name ?? symbol };
  return name ? { symbol: null, name } : null;
}
const companiesOf = (raw) => listOf(raw).map(companyOf).filter(Boolean);

/** A reported measure's own name, as a label (Amendment B §3; shown only when the compare switch is on, §6). */
const measureNamesOf = (raw) => listOf(raw).filter((m) => m && m.kind === 'reported').map((m) => textOf(m.name)).filter(Boolean);

function questionsOf(raw) {
  const seen = new Set();
  const out = [];
  listOf(raw).forEach((q, i) => {
    const text = textOf(q?.text);
    if (!text) return;
    let id = typeof q.id === 'string' && q.id.trim() ? q.id.trim() : `q${i}`;
    if (seen.has(id)) id = `${id}~${i}`;
    seen.add(id);
    const group = companiesOf(q.group);
    out.push({
      id, text, angleLabel: textOf(q.angleLabel), unknown: textOf(q.unknown), featured: q.featured === true,
      fromConnection: textOf(q.fromConnection), group, broad: group.length >= BROAD_MIN, measureNames: measureNamesOf(q.measures),
    });
  });
  return out;
}
const isLink = (v) => typeof v === 'string' && /^https?:\/\/[^\s]+$/i.test(v);
const storyIdOf = (v) => (typeof v === 'string' && STORY_ID.test(v) ? v : null);
function connectionsOf(raw) {
  const refs = new Set();
  return listOf(raw).map((c, i) => {
    const who = textOf(c?.who);
    if (!who) return null;
    const id = textOf(c.id);
    // `ref` names the branch on the page (its open state, its focus): the record's id, kept unique
    let ref = id ?? `c${i}`;
    if (refs.has(ref)) ref = `${ref}~${i}`;
    refs.add(ref);
    return {
      id, ref, who, what: textOf(c.what), basis: BASES.includes(c.basis) ? c.basis : 'no_source_yet', basisLine: textOf(c.basisLine),
      leads: companiesOf(c.leads), known: textOf(c.known), unknown: textOf(c.unknown), whereToLook: textOf(c.whereToLook),
      leadsToStory: storyIdOf(c.leadsToStory),
    };
  }).filter(Boolean);
}

/**
 * Amendment B §5.3 (B-10, K-15): the ids of the sources a figure the story carries names — a cell's own `sourceId`, or
 * one of its inputs' — and no connection does. Those sources exist only to back a figure, and are never listed. Read
 * from the record here, once; the figures themselves never reach the view. In the pilot overview: s4 to s7.
 */
export function figureOnlySourceIdsOf(record) {
  const byConnection = new Set();
  for (const c of listOf(record?.connections)) for (const id of listOf(c?.sourceIds)) if (typeof id === 'string') byConnection.add(id.trim());
  const byFigure = new Set();
  for (const q of listOf(record?.questions)) {
    for (const m of listOf(q?.measures)) {
      for (const cell of listOf(m?.cells)) {
        if (typeof cell?.sourceId === 'string') byFigure.add(cell.sourceId.trim());
        for (const input of listOf(cell?.inputs)) if (typeof input?.sourceId === 'string') byFigure.add(input.sourceId.trim());
      }
    }
  }
  return new Set([...byFigure].filter((id) => !byConnection.has(id)));
}
function sourcesOf(raw, unlisted) {
  return listOf(raw).map((s, i) => {
    const name = textOf(s?.name);
    if (!name) return null;
    const id = textOf(s.id) ?? `s${i}`;
    if (unlisted.has(id)) return null;
    return { id, name, kind: textOf(s.kind), dated: textOf(s.dated), excerpt: textOf(s.excerpt), url: isLink(s.url) ? s.url : null };
  }).filter(Boolean);
}
/** A deep story's way up, `{ storyId, connectionId }`, or null when either is not one the page can follow. */
function parentRefOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const storyId = storyIdOf(raw.storyId);
  const connectionId = textOf(raw.connectionId);
  return storyId && connectionId ? { storyId, connectionId } : null;
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
 *
 * Build 2 (K-3): those reasons are the only ones. `kind`, `subject`, `parent`, `about`, the connections' gap and door,
 * and the questions' branch, group and measure names are read when they hold, and left out when they do not.
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
  const kind = data.kind === KINDS.DEEP ? KINDS.DEEP : KINDS.OVERVIEW;
  return {
    id,
    version: data.version,
    kind,
    lead: data.lead === 'product' ? 'product' : 'story',
    productName: textOf(data.productName),
    subject: textOf(data.subject),
    parent: kind === KINDS.DEEP ? parentRefOf(data.parent) : null,
    about: kind === KINDS.DEEP ? companiesOf(data.about) : [],
    title,
    deck: textOf(data.deck),
    reporter: { name: textOf(reporter.name), beat: textOf(reporter.beat) },
    publishedAt: isoOf(data.publishedAt),
    evidenceSpan: textOf(data.evidenceSpan),
    body: textsOf(data.body),
    parts: partsOf(data.parts),
    openQuestion: textOf(data.openQuestion),
    connections: connectionsOf(data.connections),
    sources: sourcesOf(data.sources, figureOnlySourceIdsOf(data)),
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

/** A story's featured question (its first featured, else its first): the one its card, tile or hero leads with. */
export const featuredOf = (story) => story.questions.find((q) => q.featured) ?? story.questions[0];

/**
 * The front page's split of the stories read, newest first (Amendment B §4.1; B-3, B-4, B-5; K-13):
 *   hero    the newest overview, with its featured question
 *   tiles   every other product-led overview ("Start from something you use")
 *   cards   every other overview, one per story, with its featured question
 *   latest  the LATEST_MAX newest deep stories
 * A story is in exactly one place; a deep story is never a card, a tile or the hero.
 */
export function frontPageOf(stories) {
  const overviews = stories.filter((s) => s.kind !== KINDS.DEEP);
  const hero = overviews[0] ?? null;
  const rest = overviews.filter((s) => s !== hero);
  return {
    hero: hero ? { story: hero, question: featuredOf(hero) } : null,
    tiles: rest.filter((s) => s.lead === 'product'),
    cards: rest.filter((s) => s.lead !== 'product').map((story) => ({ story, question: featuredOf(story) })),
    latest: stories.filter((s) => s.kind === KINDS.DEEP).slice(0, LATEST_MAX),
  };
}

/** The cards' topics (a topic with no card is not shown), in first-seen order. */
export const topicsOf = (cards) => [...new Set(cards.flatMap((c) => c.story.topics))];

// ── the chain and the hierarchy (Amendment B §3, §4.3–§4.5; K-6, K-7) ─────────

/** The count line's three numbers (B-2), from the connections' `basis` and nothing else (K-6). */
export function countsOf(story) {
  const n = story.connections.length;
  const sourced = story.connections.filter((c) => c.basis === 'source_cited').length;
  return { n, sourced, unchecked: n - sourced };
}

/** Where the chain starts (Amendment B §3): the subject; a product-led story without one, its product; else none. */
export const chainSubjectOf = (story) => story.subject ?? (story.lead === 'product' ? story.productName : null);

/** The stories at hand by id: the stories read, and any read by id since (`linked`: id → view, or null for absent). */
export function storiesByIdOf(list, linked = null) {
  const byId = new Map();
  if (linked) for (const [id, v] of linked) if (v) byId.set(id, v);
  for (const s of list) byId.set(s.id, s);
  return byId;
}

/**
 * The deep story a connection's door opens, or null (K-7, Amendment B §4.5): drawn only when its target is a story
 * at hand that is a deep story (published and read). A missing, unreadable or wrong-kind target is no door.
 */
export function doorOf(connection, byId, selfId = null) {
  const target = connection?.leadsToStory ? byId.get(connection.leadsToStory) ?? null : null;
  return target && target.kind === KINDS.DEEP && target.id !== selfId ? target : null;
}

/** A deep story's way up: `{ overview, connection }`, or null when the parent cannot be read (Amendment B §4.4). */
export function parentOf(story, byId) {
  if (story?.kind !== KINDS.DEEP || !story.parent) return null;
  const overview = byId.get(story.parent.storyId) ?? null;
  if (!overview || overview.kind === KINDS.DEEP) return null;
  const connection = overview.connections.find((c) => c.id === story.parent.connectionId) ?? null;
  return connection ? { overview, connection } : null;
}

/**
 * The stories a story page needs and the stories at hand lack (Amendment B §5.1, K-4), in the order they are read:
 * a deep story's parent first; then the doors' targets (an overview's own; a deep story's own, and its parent's for
 * "Where next"). Ids already settled (`settled`: read, or known absent) are not asked for again.
 */
export function linkedIdsOf(story, byId, settled = new Set()) {
  const wanted = [];
  const want = (id) => { if (id && id !== story.id && !byId.has(id) && !settled.has(id) && !wanted.includes(id)) wanted.push(id); };
  if (story.kind === KINDS.DEEP && story.parent) want(story.parent.storyId);
  for (const c of story.connections) want(c.leadsToStory);
  const parent = parentOf(story, byId);
  if (parent) for (const c of parent.overview.connections) want(c.leadsToStory);
  return wanted;
}

/** The object the stock research page opens on for a company (RankingsView.jsx:111's shape, from `{ symbol, name }`). */
export const leadAssetOf = (company) => ({ symbol: company.symbol, name: company.name ?? company.symbol, sector: '', price: 0, percentChange: 0, change: 0 });

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

/** A Save toggle acts once the bookmarks are known, and not while this story's own write runs (review A-5). */
export const saveBusyOf = (bookmarks, storyId) => bookmarks?.status !== 'ready' || bookmarks.pending.includes(storyId);

/**
 * The sheet's `item` for Work this idea (spec §3.6): the story as the sheet's preview names it, the question as edited,
 * and (Amendment B §7, K-16) the chosen question's id in the story, which the sheet forwards in a later build.
 */
export function sheetItemOf(story, question, questionId = undefined) {
  return {
    itemRef: { recordKind: EXPLORE_RECORD_KIND, recordId: story.id },
    headline: story.title,
    reporterName: story.reporter.name,
    beat: story.reporter.beat,
    publishedAt: story.publishedAt,
    context: story.deck,
    question,
    reason: null,
    ...(typeof questionId === 'string' ? { questionId } : {}),
  };
}

// ── search (spec §3.3) ───────────────────────────────────────────────────────

const norm = (v) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * The stories and questions a search names: a question whose own text matches opens on that question; a story
 * whose title, deck, subject, topics, product name or tickers match opens on its first featured question. One row
 * each. Both kinds of story (Amendment B §4.6, K-17).
 */
export function storyMatchesOf(stories, raw) {
  const s = norm(raw);
  if (!s) return [];
  const rows = [];
  for (const story of stories) {
    const hits = story.questions.filter((q) => norm(q.text).includes(s));
    const storyHit = [story.title, story.deck, story.subject, story.productName, ...story.topics, ...story.tickers].some((f) => f && norm(f).includes(s));
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
