// src/components/SharedResearch/sharedResearchView.js
//
// Shared Research — WHAT THE SHEET SHOWS, pure (spec §7.1 sharedResearchView,
// §7.3; B2 build prompt K-6, K-7). Every function here reads the server's
// answer and formats it; none decides a fact the server owns:
//   - a finding's label is findingLabelOf(kind, status, statusReason), the one
//     table both sides read (src/constants/sharedResearch.js);
//   - companies, their support and their evidence are the server's `companies`
//     (Correction A); nothing here groups findings into companies;
//   - the adoption draft is the server's per-company `fragment`s, joined in the
//     preview's order for the names picked (Correction C); the carried sets are
//     the server's per-company `carried` lists, never merged here.
// The one mirror of server logic is namesCompanyView: the client's stray-name
// check, which blocks Save on a deselected company still named. The server's
// own check (namesCompany) is authoritative; a parity table pins the two equal
// (sharedResearchView.test.js).

import { findingLabelOf, STATUS_REASON_LABELS, STATUS_REASON_FALLBACK, AGE_DAYS, RELATIONSHIP_ROLES, ROLE_SEPARATOR } from '../../constants/sharedResearch';

export const UNDATED_SUFFIX = ' · undated';
const ET = 'America/New_York';
const DAY_FMT = new Intl.DateTimeFormat('en-US', { timeZone: ET, month: 'short', day: 'numeric', year: 'numeric' });
const WHEN_FMT = new Intl.DateTimeFormat('en-US', { timeZone: ET, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
/** A FACT's day is a calendar day the server holds as midnight UTC (stepSchema modelDayOf, opening's claim dates) and reads as the UTC day (heldDatesOf): shown in UTC, never shifted into the evening before (review a1). */
const FACT_DAY_FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

const ms = (iso) => (typeof iso === 'string' ? Date.parse(iso) : NaN);
/** "Nov 12, 2026" (Eastern), or null for a value that is not an instant. */
export const formatDay = (iso) => (Number.isFinite(ms(iso)) ? DAY_FMT.format(new Date(ms(iso))) : null);
/** "Nov 12, 3:00 PM ET" (Eastern, marked as the hub marks it), or null. */
export const formatWhen = (iso) => (Number.isFinite(ms(iso)) ? `${WHEN_FMT.format(new Date(ms(iso)))} ET` : null);
/** A finding's own day (its `at`, its `asOf`): the server's UTC calendar day. */
export const formatFactDay = (iso) => (Number.isFinite(ms(iso)) ? FACT_DAY_FMT.format(new Date(ms(iso))) : null);

/** The agent's name as the sheet says it: the prop, else "your agent" (R6). */
export const agentNameOf = (agentName, fallback) => (typeof agentName === 'string' && agentName.trim() ? agentName.trim() : fallback);

// ── findings ───────────────────────────────────────────────────────────────────

/** The label a finding wears — the shared rule, nothing else (BUILD_RULES §9). */
export const labelOf = (f) => findingLabelOf({ kind: f?.kind, status: f?.status, statusReason: f?.statusReason });

/** The colour token a finding's tag wears, by what its label says. */
export function toneOf(f) {
  if (f?.status === 'verified') return 'teal';
  if (f?.status === 'unavailable') return 'copper';
  if (f?.kind === 'observation' || f?.statusReason === 'from_drop') return 'purple';
  return 'gold';
}

/** An unavailable finding's reason, in words. */
export const reasonLabelOf = (statusReason) => (Object.hasOwn(STATUS_REASON_LABELS, statusReason ?? '') ? STATUS_REASON_LABELS[statusReason] : STATUS_REASON_FALLBACK);

/** Did the server date this fact by the read, not by the fact (spec §15 S-2 b)? Its label says so. */
export const isUndated = (f) => typeof f?.source?.label === 'string' && f.source.label.endsWith(UNDATED_SUFFIX);

/** The source's label without the undated marker (the marker becomes the date line instead). */
export const sourceLabelOf = (f) => {
  const label = typeof f?.source?.label === 'string' ? f.source.label : '';
  return isUndated(f) ? label.slice(0, -UNDATED_SUFFIX.length) : label;
};

/** A source link the sheet may open: http(s) only. */
export function safeUrlOf(f) {
  const url = f?.source?.url;
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * The date line of a finding (K-6 g). A Source-backed fact shows its own date and, when the source gives one,
 * "published {asOf}". When the server had no date for the fact itself it dated it by the publication (`at` = `asOf`,
 * stepSchema retrievalDatesOf): that day is shown as "published {date}" alone, never as the fact's own (review a2).
 * A fact the server dated by the read (" · undated") shows "Undated · read {date}". Other findings carry no date line.
 * Days are the server's UTC calendar days (formatFactDay).
 * @returns {{ kind: 'undated'|'dated'|'published', text: string, published: string|null } | null}
 */
export function dateLineOf(f) {
  if (isUndated(f)) {
    const read = formatFactDay(f.at);
    return read ? { kind: 'undated', text: read, published: null } : null;
  }
  if (f?.status !== 'verified') return null;
  const day = formatFactDay(f.at);
  if (!day) return null;
  const published = formatFactDay(f.asOf);
  if (published && f.asOf === f.at) return { kind: 'published', text: published, published };
  return { kind: 'dated', text: day, published };
}

/** A next action's fact, "{label} — {purpose}", split; a fact without the dash is all label. */
export function splitNext(fact) {
  const s = typeof fact === 'string' ? fact : '';
  const i = s.indexOf(' — ');
  return i > 0 ? { label: s.slice(0, i), purpose: s.slice(i + 3) } : { label: s, purpose: null };
}

/**
 * A relationship fact without its role prefix ('{Role} · {fact}', the closed list the server writes — companies.js
 * splitRole, mirrored and pinned): for a line that already shows the company's role beside it.
 */
export function withoutRole(fact) {
  const f = typeof fact === 'string' ? fact : '';
  const i = f.indexOf(ROLE_SEPARATOR);
  return i > 0 && RELATIONSHIP_ROLES.includes(f.slice(0, i)) ? f.slice(i + ROLE_SEPARATOR.length) : f;
}

/** Every finding of the projection by id: the current ones and the superseded ones. */
export function findingsById(record) {
  const map = new Map();
  for (const f of [...(record?.superseded ?? []), ...(record?.findings ?? [])]) if (f?.findingId) map.set(f.findingId, f);
  return map;
}

/** The four lines (spec §6.7): the latest step's refs resolved to the findings they name, and the next action. */
export function linesOf(record) {
  const byId = findingsById(record);
  const ref = (id) => (id ? byId.get(id) ?? null : null);
  const l = record?.lines ?? {};
  const next = record?.nextAction ?? null;
  return {
    support: ref(l.support), complication: ref(l.complication), missing: ref(l.missing),
    next: next && next.statusReason !== 'no_next_step' ? next : null,
  };
}

/** The finding the investigation started from: the story, the player's words, or the drop (with its claims). */
export function startingPointOf(record) {
  const current = record?.findings ?? [];
  const story = current.find((f) => f.kind === 'coverage' && f.statusReason === 'reporter_content') ?? null;
  const words = current.find((f) => f.kind === 'observation') ?? null;
  const claims = current.filter((f) => f.statusReason === 'from_drop');
  return { story, words, claims };
}

/** The evidence list: every current finding but the next action (shown as a line of its own). */
export const evidenceOf = (record) => (record?.findings ?? []).filter((f) => f.kind !== 'next_action');

// ── the session ───────────────────────────────────────────────────────────────

/** What the investigation is now: framing, open, saved, concluded or discarded. */
export function stateOf(session, record) {
  if (!record) return session?.status === 'framing' ? 'framing' : session?.status ?? null;
  if (record.state === 'open') return 'open';
  if (record.state === 'abandoned') return 'abandoned';
  if (record.terminalReason === 'saved_to_list') return 'saved';
  return 'completed';
}

/** Steps left in this investigation's budget. */
export const remainingOf = (session) => Math.max(0, (session?.stepBudget ?? 0) - (session?.stepsUsed ?? 0));

/** The latest partner reply (a step's), as the server stored it — a replaced reply included (K-6 d). */
export function partnerReplyOf(session) {
  const exs = Array.isArray(session?.exchanges) ? session.exchanges : [];
  for (let i = exs.length - 1; i >= 0; i--) if (exs[i]?.who === 'partner' && exs[i].kind === 'step') return exs[i];
  return null;
}

/** The player's direction exchange for a step (to re-send its words on Try again). */
export function directionOfStep(session, stepId) {
  const exs = Array.isArray(session?.exchanges) ? session.exchanges : [];
  return exs.find((e) => e?.who === 'player' && e.kind === 'direction' && e.stepId === stepId)?.text ?? null;
}

/** The player's own starting words, for "Start a new investigation" from an observation. */
export function observationTextOf(session) {
  if (typeof session?.entry?.observation === 'string' && session.entry.observation) return session.entry.observation;
  const exs = Array.isArray(session?.exchanges) ? session.exchanges : [];
  return exs.find((e) => e?.who === 'player' && e.kind === 'observation')?.text ?? '';
}

/** Is the summary old enough to offer Refresh (routine 8)? `age` is the server's count of ET days. */
export const isAged = (record) => Number.isSafeInteger(record?.age) && record.age > AGE_DAYS;

/** The quota lines that show before any request (spec §5.3; ruling P-5): which ceiling is already reached. */
export function quotaStateOf(quota) {
  const q = quota ?? {};
  const reached = (n, max) => Number.isSafeInteger(n) && Number.isSafeInteger(max) && max > 0 && n >= max;
  return {
    dailyLimit: reached(q.investigationsToday, q.perDay),
    framingLimit: reached(q.framingsToday, q.framingsPerDay),
    stepLimit: reached(q.stepsToday, q.stepsPerDay),
  };
}

/** Stories older than this read as a stale selection (spec §7.2). */
export const STALE_STORIES_MS = 48 * 3600 * 1000;
/** The newest story's time when every story is older than 48 h, else null. */
export function staleStoriesAt(stories, nowMs) {
  const times = (Array.isArray(stories) ? stories : []).map((s) => ms(s?.publishedAt)).filter(Number.isFinite);
  if (!times.length) return null;
  const newest = Math.max(...times);
  return nowMs - newest > STALE_STORIES_MS ? new Date(newest).toISOString() : null;
}

// ── adoption (Correction C) ─────────────────────────────────────────────────────

/** The idea's statement, at most — the record model's STATEMENT_MAX_LEN (api/_utils/hypothesisRecords/model.js), pinned equal by test. */
export const STATEMENT_MAX = 1000;

/** The adoptable companies of the server's preview, in its order. */
export const adoptableOf = (preview) => (preview?.companies ?? []).filter((c) => c.adoptable);

/** The draft for the names picked: the server's fragments, in the preview's order, joined — no request (K-7). */
export function draftOf(preview, symbols) {
  const picked = new Set(symbols);
  return (preview?.companies ?? []).filter((c) => picked.has(c.symbol)).map((c) => c.fragment).join(' ');
}

/** The server's carried ids for each name picked, per company, as the preview lists them (never merged here). */
export function carriedByCompanyOf(preview, symbols) {
  const picked = new Set(symbols);
  return (preview?.companies ?? []).filter((c) => picked.has(c.symbol)).map((c) => ({ symbol: c.symbol, name: c.name, carried: [...c.carried] }));
}

/** Words too common in company names to identify one — the server's list (companies.js GENERIC_NAME_WORDS), pinned equal by test. */
export const GENERIC_NAME_WORDS = Object.freeze([
  'international', 'holdings', 'holding', 'group', 'systems', 'technologies', 'technology', 'platforms', 'financial', 'corporation',
  'company', 'energy', 'services', 'global', 'american', 'general', 'bank', 'industries', 'capital', 'partners', 'brands',
  'therapeutics', 'pharmaceuticals', 'communications', 'resources', 'solutions', 'networks', 'motors', 'entertainment', 'chase',
]);
const GENERIC = new Set(GENERIC_NAME_WORDS);
const escapeName = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordIn = (t, w) => new RegExp(`(^|[^A-Za-z0-9])${escapeName(w)}([^A-Za-z0-9]|$)`, 'i').test(t);
/** The core of a company's name — the server's coreNameOf, mirrored (parity pinned). */
export function coreNameView(name) {
  let s = String(name ?? '').trim().replace(/^the\s+/i, '');
  const SUFFIX = /(?:[\s,]+(?:inc\.?|incorporated|corp\.?|corporation|co\.?|company|ltd\.?|limited|plc|holdings?|group|n\.?v\.?|s\.?a\.?|ag|se|class\s+[a-c]|\(the\))|\s*&|\s+and|\.com)$/i;
  for (let i = 0; i < 6 && SUFFIX.test(s); i++) s = s.replace(SUFFIX, '').trim();
  return s;
}
/** Does the text name the company? — the server's namesCompany, mirrored (parity pinned); the server decides. */
export function namesCompanyView(text, { symbol, name }) {
  const t = String(text ?? '');
  if (typeof symbol === 'string' && symbol.length >= 3 && new RegExp(`(^|[^A-Za-z0-9-])${escapeName(symbol)}([^A-Za-z0-9-]|$)`).test(t)) return true;
  const core = coreNameView(name);
  if (core.length < 2 || core === symbol) return false;
  if (wordIn(t, core)) return true;
  return core.split(/[\s,]+/).filter((w) => w.length >= 4 && !GENERIC.has(w.toLowerCase())).some((w) => wordIn(t, w));
}

/** The supported companies the statement still names although they are not picked — Save is blocked while any is. */
export function strayNamesOf(statement, preview, symbols) {
  const picked = new Set(symbols);
  return (preview?.companies ?? []).filter((c) => !picked.has(c.symbol) && namesCompanyView(statement, c)).map((c) => c.name);
}
