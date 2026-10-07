// api/_utils/researchRecords/model.js
//
// Pilot P2 — THE RESEARCH RECORD (pilot spec
// docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md §3–§4; the P2
// build prompt's "The research record"). PURE: no I/O, no clock.
//
// One record per research run, at top-level `researchWork/{researchWorkId}`,
// server-written only, readable by its owner (`userId`). Its parts:
//
//   IDENTITY (write-once)  researchWorkId, userId, origin, host {collection, id}
//                          (null for manual), createdAt, schemaVersion
//   SUBJECT (set once)     watchlistId, hypothesisVersion — null until known;
//                          written together, at most once (subjectPatch)
//   FUNNEL                 stages {universeSize, matchedPreLimit, shortlisted,
//                          selectedForInvestigation, investigationsCompleted,
//                          eligible} — cumulative; a stage the host does not
//                          have is null, NEVER 0 (STAGES_BY_ORIGIN);
//                          symbols [{symbol, outcome, reason, offUniverse?,
//                          addedAtSave?}] ≤ SYMBOLS_MAX + symbolsTruncated
//   BUDGET                 {currency: 'persisted_messages', allotted, used}
//                          from the host's messageBudget / messagesUsed (null
//                          for manual: no host, no budget)
//   TELEMETRY              attempts, completions, failures, cancellations,
//                          elapsedMs (sum of measured model-call time),
//                          firstTurnAt, lastTurnAt, tokens {input, output} |
//                          'unknown'; the screener adds screens[] (per-turn values)
//   TERMINAL               state open | completed | abandoned | failed,
//                          terminalReason, endedAt
//
// THE ID IS DERIVED FROM THE HOST (researchWorkIdFor): `<prefix>_<host id>`.
// One host document can therefore never own two records, and a retried mint
// computes the same id and finds the record it already made.
//
// Tokens come only from what the provider returned (gemmaClient's opt-in
// `usage`); a turn whose usage is not known makes the total 'unknown' for
// good — never estimated, never a partial sum presented as a total.

import {
  RESEARCH_ORIGINS, RESEARCH_STATES, RESEARCH_TERMINAL_STATES, RESEARCH_STAGES, STAGES_BY_ORIGIN, SYMBOL_OUTCOMES,
  RESEARCH_EVIDENCE_KIND,
} from '../../../src/constants/researchRecords.js';

export {
  RESEARCH_ORIGINS, RESEARCH_STATES, RESEARCH_TERMINAL_STATES, RESEARCH_STAGES, STAGES_BY_ORIGIN, SYMBOL_OUTCOMES,
  RESEARCH_EVIDENCE_KIND,
};

export const RESEARCH_WORK_COLLECTION = 'researchWork';
export const RECORD_SCHEMA_VERSION = 1;
export const SYMBOLS_MAX = 100;
/** Per-turn screen entries kept on a screener record (its message budget is 30). */
export const SCREENS_MAX = 40;
/** A screen returns at most 25 stocks (screenStocks.js MAX_LIMIT); kept with headroom. */
export const SCREEN_SYMBOLS_MAX = 40;
export const BUDGET_CURRENCY = 'persisted_messages';
export const TOKENS_UNKNOWN = 'unknown';

/** The host collections, by origin family. */
export const HOST_COLLECTIONS = Object.freeze({
  dialogue: 'watchlistSessions',
  screener: 'researchSessions',
  analysis: 'analysisSessions',
});

const ID_PREFIX = Object.freeze({ watchlistSessions: 'ws', researchSessions: 'rs', analysisSessions: 'as', watchlists: 'wl' });
const HOST_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const RESEARCH_WORK_ID_RE = /^(ws|rs|as|wl)_[A-Za-z0-9_-]{1,128}$/;

/** Why a record ended. An abandoned record carries the host's OWN abandonReason ('user_close'). */
export const TERMINAL_REASONS = Object.freeze({ savedToList: 'saved_to_list', playerAuthored: 'player_authored' });

/**
 * A symbol's typed reason — taken from what the host records, never inventing
 * who decided: the dialogue stores `removed` with no actor, so the reason is
 * `removed`, not `player_removed`. A cancelled symbol carries the record's
 * terminal reason (the host's own).
 */
export const SYMBOL_REASONS = Object.freeze({
  savedToList: 'saved_to_list',
  removed: 'removed',
  notSaved: 'not_saved',
  offUniverse: 'off_universe',
});

/** What a model-call turn came to: persisted, failed, or completed at the model but discarded by the host (a lost concurrency check). */
export const TURN_KINDS = Object.freeze(['completion', 'failure', 'cancellation']);

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmptyString = (v) => typeof v === 'string' && v.length > 0;
const isCount = (v) => Number.isSafeInteger(v) && v >= 0;

// ── identity ────────────────────────────────────────────────────────────────

/**
 * The record id a host document owns. Manual research has no host session;
 * its record is keyed to the list it created (`watchlists`).
 * @param {{ collection: string, id: string }} host
 */
export function researchWorkIdFor({ collection, id } = {}) {
  const prefix = ID_PREFIX[collection];
  if (!prefix) throw new Error(`researchRecords: no record id scheme for host collection ${collection}`);
  if (typeof id !== 'string' || !HOST_ID_RE.test(id)) throw new Error('researchRecords: the host id is malformed');
  return `${prefix}_${id}`;
}

/** A well-formed research record id (what a host document may carry). */
export const isResearchWorkId = (v) => typeof v === 'string' && RESEARCH_WORK_ID_RE.test(v);

/** The evidence ref a hypothesis version uses to cite a research record. */
export function researchRefOf(researchWorkId) {
  if (!isResearchWorkId(researchWorkId)) throw new Error('researchRecords: not a research record id');
  return { kind: RESEARCH_EVIDENCE_KIND, id: researchWorkId };
}

/** The origin of a dialogue session (spec §2.8): the theme discriminant lives only on the session. */
export const dialogueOriginOf = (session) => (isPlainObject(session) && session.source === 'theme' ? 'theme' : 'signaldrop');

/** A list's current hypothesis version (the P1a pointer) when a record attaches to it, or null — never thrown on. */
export const currentVersionOfList = (watchlist) => (isPlainObject(watchlist)
  && Number.isSafeInteger(watchlist.currentHypothesisVersion) && watchlist.currentHypothesisVersion > 0
  ? watchlist.currentHypothesisVersion
  : null);

/** Is this stored record the caller's, and readable as a record at all? */
export const isOwnedRecord = (record, uid) => isPlainObject(record)
  && nonEmptyString(uid) && record.userId === uid
  && RESEARCH_STATES.includes(record.state) && RESEARCH_ORIGINS.includes(record.origin);

// ── symbols ─────────────────────────────────────────────────────────────────

/** A symbol as the hosts write it (trimmed, upper-cased); null when it is not one. */
export function normalizeSymbol(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase();
  return s ? s : null;
}

/** Distinct symbols, first-seen order — each symbol counts once per stage it reached. */
export function uniqueSymbols(list) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const s = normalizeSymbol(raw);
    if (s && !seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

const entry = (symbol, outcome, reason, flags = {}) => ({ symbol, outcome, reason, ...flags });

/** The stored cohort: at most SYMBOLS_MAX entries, and whether any were cut. Stage counts are taken from the FULL cohort. */
export function capSymbols(entries) {
  const list = Array.isArray(entries) ? entries : [];
  return { symbols: list.slice(0, SYMBOLS_MAX), symbolsTruncated: list.length > SYMBOLS_MAX };
}

/**
 * The six stages for an origin: each present stage a count, every absent stage
 * null. A present stage without a count is a programming error (throws) —
 * a stage is never silently defaulted.
 */
export function stagesFor(origin, values = {}) {
  const present = STAGES_BY_ORIGIN[origin];
  if (!present) throw new Error(`researchRecords: unknown origin ${origin}`);
  const out = {};
  for (const k of RESEARCH_STAGES) {
    if (!present.includes(k)) { out[k] = null; continue; }
    if (!isCount(values[k])) throw new Error(`researchRecords: stage ${k} needs a count for origin ${origin}`);
    out[k] = values[k];
  }
  return out;
}

// ── the per-origin funnels (each returns { stages, symbols }) ─────────────────

/**
 * SignalDrop / theme — the dialogue session's candidates. shortlisted = every
 * candidate proposed; selectedForInvestigation = candidates not removed;
 * eligible = symbols saved to the list (0 until a save). Outcomes: a removed
 * candidate → rejected / removed; at save → eligible / saved_to_list (or
 * rejected / not_saved for a kept candidate the save did not carry); at
 * abandonment → cancelled with the terminal reason; otherwise still open (null).
 *
 * @param {{ candidates: object[], saved?: string[]|null, terminalReason?: string|null }} p
 */
export function dialogueFunnel({ candidates, saved = null, terminalReason = null }) {
  const cohort = [];
  const seen = new Set();
  for (const c of Array.isArray(candidates) ? candidates : []) {
    const symbol = normalizeSymbol(c?.symbol);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    cohort.push({ symbol, removed: c.status === 'removed' });
  }
  const savedSet = Array.isArray(saved) ? new Set(uniqueSymbols(saved)) : null;
  const symbols = cohort.map(({ symbol, removed }) => {
    if (removed) return entry(symbol, 'rejected', SYMBOL_REASONS.removed);
    if (savedSet) return savedSet.has(symbol) ? entry(symbol, 'eligible', SYMBOL_REASONS.savedToList) : entry(symbol, 'rejected', SYMBOL_REASONS.notSaved);
    if (nonEmptyString(terminalReason)) return entry(symbol, 'cancelled', terminalReason);
    return entry(symbol, null, null);
  });
  return {
    stages: {
      shortlisted: cohort.length,
      selectedForInvestigation: cohort.filter((c) => !c.removed).length,
      eligible: symbols.filter((s) => s.outcome === 'eligible').length,
    },
    symbols,
  };
}

/**
 * One screened turn's values, kept in the screener record's telemetry.screens.
 * An industry roll-up screen returns industries, not stocks: its symbols are
 * not recorded and it never feeds the stock stages.
 */
export function screenEntryOf({ atIso, resultType, universeSize, matchCount, results }) {
  const stocks = resultType !== 'industries';
  const rows = Array.isArray(results) ? results : [];
  const symbols = stocks ? uniqueSymbols(rows.map((r) => r?.symbol)).slice(0, SCREEN_SYMBOLS_MAX) : [];
  return {
    at: atIso,
    resultType: stocks ? 'stocks' : 'industries',
    universeSize: isCount(universeSize) ? universeSize : null,
    matchedPreLimit: isCount(matchCount) ? matchCount : null,
    returned: stocks ? symbols.length : rows.length,
    symbols,
  };
}

/**
 * The stock screen whose results were saved, latest first among equals: a
 * screen that returned EXACTLY the saved symbols; else one that returned every
 * saved symbol (a superset — the save dropped some); else the one with the most
 * overlap (>0); else none. Exact before superset (review R1-5): a later, wider
 * screen the player never saw must not claim a save of an earlier one.
 */
export function savedScreenOf(screens, savedSymbols) {
  const stock = (Array.isArray(screens) ? screens : []).filter((s) => isPlainObject(s) && s.resultType === 'stocks' && Array.isArray(s.symbols));
  const saved = new Set(savedSymbols);
  const latest = (pred) => { for (let i = stock.length - 1; i >= 0; i--) if (pred(stock[i])) return stock[i]; return null; };
  const overlapOf = (s) => s.symbols.filter((sym) => saved.has(sym)).length;
  if (saved.size === 0) return null;
  const exact = latest((s) => overlapOf(s) === saved.size && new Set(s.symbols).size === saved.size);
  if (exact) return exact;
  const superset = latest((s) => overlapOf(s) === saved.size);
  if (superset) return superset;
  let best = null;
  let bestOverlap = 0;
  for (let i = stock.length - 1; i >= 0; i--) {
    const overlap = overlapOf(stock[i]);
    if (overlap > bestOverlap) { best = stock[i]; bestOverlap = overlap; }
  }
  return best;
}

/**
 * Screener — the record reflects ONE stock screen: while open, the latest; at
 * save, the screen whose results were saved (savedScreenOf). universeSize and
 * matchedPreLimit are that screen's own values; shortlisted = what it
 * returned; eligible = symbols saved to the list (0 until a save). Before any
 * stock screen ran, the screener stages are 0 (nothing screened yet). A saved
 * symbol the referenced screen did not return joins the cohort flagged
 * `addedAtSave` (it reached eligible without the screening stages).
 *
 * @param {{ screens: object[], saved?: string[]|null }} p
 */
export function screenerFunnel({ screens, saved = null }) {
  const savedSyms = Array.isArray(saved) ? uniqueSymbols(saved) : null;
  const stock = (Array.isArray(screens) ? screens : []).filter((s) => isPlainObject(s) && s.resultType === 'stocks' && Array.isArray(s.symbols));
  const ref = savedSyms ? savedScreenOf(stock, savedSyms) : (stock[stock.length - 1] || null);
  const returned = ref ? uniqueSymbols(ref.symbols) : [];
  const returnedSet = new Set(returned);
  const savedSet = savedSyms ? new Set(savedSyms) : null;
  const symbols = returned.map((symbol) => {
    if (!savedSet) return entry(symbol, null, null);
    return savedSet.has(symbol) ? entry(symbol, 'eligible', SYMBOL_REASONS.savedToList) : entry(symbol, 'rejected', SYMBOL_REASONS.notSaved);
  });
  for (const symbol of savedSyms || []) {
    if (!returnedSet.has(symbol)) symbols.push(entry(symbol, 'eligible', SYMBOL_REASONS.savedToList, { addedAtSave: true }));
  }
  return {
    stages: {
      // The referenced screen's own values, passed through as recorded — a
      // malformed one fails stagesFor (never silently 0, review R1-6). No
      // screen at all is 0: nothing recorded was screened.
      universeSize: ref ? ref.universeSize : 0,
      matchedPreLimit: ref ? ref.matchedPreLimit : 0,
      shortlisted: returned.length,
      eligible: savedSyms ? savedSyms.length : 0,
    },
    symbols,
  };
}

/**
 * Analysis — a session over a SAVED list, mapped from the cohort digest's own
 * counts (api/_utils/cohortDigest.js): selectedForInvestigation = the cohort
 * under analysis (digest.size), investigationsCompleted = the members the
 * digest had ranking data for (digest.covered). Off-universe members are
 * data_missing / off_universe, flagged `offUniverse`; the rest have no
 * decided outcome (the analysis decides no eligibility, and its session never
 * closes). No universe, match, shortlist or eligibility stage.
 *
 * CUMULATIVE over the session (review R1-8; spec §3 "each symbol counted once
 * per stage it reached within the declared research run"): given the record so
 * far (`prior`), a member stays in the cohort after the player drops it from
 * the list, and a member once covered stays covered — so no stage ever
 * decreases. At mint (no prior) this is exactly the digest's own counts.
 *
 * @param {{ symbols: string[], digest: { size: number, covered: number, offUniverse: string[] }, prior?: object|null }} p
 */
export function analysisFunnel({ symbols, digest, prior = null }) {
  const off = new Set(uniqueSymbols(digest?.offUniverse));
  const current = uniqueSymbols(symbols);
  if (!isPlainObject(prior)) {
    return {
      stages: {
        selectedForInvestigation: digest?.size,
        investigationsCompleted: digest?.covered,
      },
      symbols: current.map((symbol) => (off.has(symbol)
        ? entry(symbol, 'data_missing', SYMBOL_REASONS.offUniverse, { offUniverse: true })
        : entry(symbol, null, null))),
    };
  }
  const covered = new Map(); // symbol → reached investigationsCompleted in this run
  for (const e of Array.isArray(prior.symbols) ? prior.symbols : []) {
    const s = normalizeSymbol(e?.symbol);
    if (s && !covered.has(s)) covered.set(s, e.outcome !== 'data_missing');
  }
  for (const s of current) covered.set(s, covered.get(s) === true || !off.has(s));
  const order = [...covered.keys()];
  const coveredCount = order.filter((s) => covered.get(s)).length;
  const priorCount = (k) => (isCount(prior.stages?.[k]) ? prior.stages[k] : 0);
  return {
    stages: {
      // A truncated prior cohort cannot be re-counted from its stored list: the stage never decreases.
      selectedForInvestigation: Math.max(order.length, priorCount('selectedForInvestigation')),
      investigationsCompleted: Math.max(coveredCount, priorCount('investigationsCompleted')),
    },
    symbols: order.map((symbol) => (covered.get(symbol)
      ? entry(symbol, null, null)
      : entry(symbol, 'data_missing', SYMBOL_REASONS.offUniverse, { offUniverse: true }))),
  };
}

/** Manual — the player wrote the list: no stage exists, no cohort. */
export const manualFunnel = () => ({ stages: {}, symbols: [] });

// ── budget and telemetry ──────────────────────────────────────────────────────

/** The host's persisted-message budget (the spec §3 currency, named as such). */
export function budgetOf({ messageBudget, messagesUsed }) {
  if (!isCount(messageBudget) || !isCount(messagesUsed)) throw new Error('researchRecords: the host budget needs two counts');
  return { currency: BUDGET_CURRENCY, allotted: messageBudget, used: messagesUsed };
}

/** A fresh telemetry block. Zero calls made → zero tokens, exactly. */
export function emptyTelemetry({ screens = false } = {}) {
  const t = {
    attempts: 0, completions: 0, failures: 0, cancellations: 0, elapsedMs: 0,
    firstTurnAt: null, lastTurnAt: null, tokens: { input: 0, output: 0 },
  };
  if (screens) t.screens = [];
  return t;
}

/** Provider usage as the model client reports it ({input, output} counts), else null. */
export function usageOf(u) {
  return isPlainObject(u) && isCount(u.input) && isCount(u.output) ? { input: u.input, output: u.output } : null;
}

const knownTokens = (t) => (isPlainObject(t) && isCount(t.input) && isCount(t.output) ? t : null);

/**
 * One model-call turn folded into the telemetry. `elapsedMs` is the measured
 * model-call time; tokens stay a known sum only while every turn's usage was
 * supplied — one turn without it makes the total 'unknown' for good.
 */
export function applyTurn(telemetry, { kind, elapsedMs, usage = null, atIso, screen = null }) {
  if (!TURN_KINDS.includes(kind)) throw new Error(`researchRecords: unknown turn kind ${kind}`);
  if (!nonEmptyString(atIso)) throw new Error('researchRecords: a turn needs its time');
  const t = isPlainObject(telemetry) ? telemetry : emptyTelemetry();
  const count = (k) => (isCount(t[k]) ? t[k] : 0);
  const u = usageOf(usage);
  const prior = knownTokens(t.tokens);
  const out = {
    attempts: count('attempts') + 1,
    completions: count('completions') + (kind === 'completion' ? 1 : 0),
    failures: count('failures') + (kind === 'failure' ? 1 : 0),
    cancellations: count('cancellations') + (kind === 'cancellation' ? 1 : 0),
    elapsedMs: count('elapsedMs') + (Number.isFinite(elapsedMs) && elapsedMs > 0 ? Math.round(elapsedMs) : 0),
    // Interleaved turns can commit out of order: the first and last turn times
    // only ever widen (ISO-8601 UTC strings compare in time order) — review R2-5.
    firstTurnAt: nonEmptyString(t.firstTurnAt) && t.firstTurnAt < atIso ? t.firstTurnAt : atIso,
    lastTurnAt: nonEmptyString(t.lastTurnAt) && t.lastTurnAt > atIso ? t.lastTurnAt : atIso,
    tokens: prior && u ? { input: prior.input + u.input, output: prior.output + u.output } : TOKENS_UNKNOWN,
  };
  if (Array.isArray(t.screens) || screen) {
    const prev = Array.isArray(t.screens) ? t.screens : [];
    out.screens = screen ? [...prev, screen].slice(-SCREENS_MAX) : prev;
  }
  return out;
}

// ── the record and its patches ────────────────────────────────────────────────

/**
 * A complete new record. Validates identity and state; the funnel is shaped
 * by stagesFor (absent stages null) and capSymbols.
 */
export function buildRecord({
  researchWorkId, userId, origin, host, createdAt, watchlistId = null, hypothesisVersion = null,
  funnel, budget = null, telemetry, state = 'open', terminalReason = null, endedAt = null,
}) {
  if (!isResearchWorkId(researchWorkId) || !nonEmptyString(userId) || !nonEmptyString(createdAt)) {
    throw new Error('researchRecords: identity fields are required');
  }
  if (!RESEARCH_ORIGINS.includes(origin)) throw new Error(`researchRecords: unknown origin ${origin}`);
  if (origin === 'manual' ? host !== null : !(isPlainObject(host) && nonEmptyString(host.collection) && nonEmptyString(host.id))) {
    throw new Error('researchRecords: a host session is required (manual research has none)');
  }
  if (!RESEARCH_STATES.includes(state)) throw new Error(`researchRecords: unknown state ${state}`);
  if (!(watchlistId === null || nonEmptyString(watchlistId))) throw new Error('researchRecords: watchlistId must be a string or null');
  if (!(hypothesisVersion === null || (Number.isSafeInteger(hypothesisVersion) && hypothesisVersion > 0))) {
    throw new Error('researchRecords: hypothesisVersion must be a version number or null');
  }
  return {
    schemaVersion: RECORD_SCHEMA_VERSION,
    researchWorkId, userId, origin, host: host ? { collection: host.collection, id: host.id } : null, createdAt,
    watchlistId, hypothesisVersion,
    stages: stagesFor(origin, funnel.stages),
    ...capSymbols(funnel.symbols),
    budget,
    telemetry,
    state, terminalReason, endedAt,
    updatedAt: createdAt,
  };
}

/** The subject, set at most once: only while the record names no list yet. */
export function subjectPatch(record, { watchlistId, hypothesisVersion = null }) {
  if (!isPlainObject(record) || record.watchlistId != null || !nonEmptyString(watchlistId)) return {};
  return { watchlistId, hypothesisVersion: Number.isSafeInteger(hypothesisVersion) && hypothesisVersion > 0 ? hypothesisVersion : null };
}

/**
 * A successful (or failed, or cancelled) turn's patch: telemetry, the host's
 * budget when given, and the funnel. Only while the record is OPEN: a closed
 * record never moves — not its funnel, not its telemetry (review R1-1: a
 * screener session used after its save no longer runs the record's
 * `lastTurnAt` past its `endedAt`). Null for a closed record (no write).
 * `funnel` may be a function of the turn's new telemetry (the screener's
 * funnel is read from its screens, this turn's included).
 */
export function turnPatch(record, { kind, elapsedMs, usage = null, atIso, budget = null, funnel = null, screen = null }) {
  if (record?.state !== 'open') return null;
  const patch = { telemetry: applyTurn(record.telemetry, { kind, elapsedMs, usage, atIso, screen }), updatedAt: atIso };
  if (budget) patch.budget = budget;
  const f = typeof funnel === 'function' ? funnel(patch.telemetry) : funnel;
  if (f) {
    patch.stages = stagesFor(record.origin, f.stages);
    Object.assign(patch, capSymbols(f.symbols));
  }
  return patch;
}

/**
 * Close an open record (completed | abandoned | failed) with its final funnel
 * and, when the close attaches it to a list, its subject. A terminal record
 * never moves: null.
 */
export function closePatch(record, { state, terminalReason, atIso, funnel, subject = null }) {
  if (!isPlainObject(record) || record.state !== 'open') return null;
  if (!RESEARCH_TERMINAL_STATES.includes(state) || !nonEmptyString(terminalReason) || !nonEmptyString(atIso)) {
    throw new Error('researchRecords: a close needs a terminal state, a reason and a time');
  }
  return {
    state, terminalReason, endedAt: atIso, updatedAt: atIso,
    stages: stagesFor(record.origin, funnel.stages),
    ...capSymbols(funnel.symbols),
    ...(subject ? subjectPatch(record, subject) : {}),
  };
}

/**
 * What the Forge is shown of a record: identity, subject, funnel counts,
 * terminal — and how many model turns completed (`completions`), the only
 * telemetry the panel needs: a record no model turn completed (an analysis
 * view opened and left) is not "researched with your agent" (review R4-1 /
 * R1-3). Never the cohort, the budget or the rest of the telemetry.
 */
export function recordSummaryOf(record) {
  return {
    researchWorkId: record.researchWorkId,
    origin: record.origin,
    createdAt: record.createdAt,
    watchlistId: record.watchlistId ?? null,
    hypothesisVersion: record.hypothesisVersion ?? null,
    stages: Object.fromEntries(RESEARCH_STAGES.map((k) => [k, isCount(record.stages?.[k]) ? record.stages[k] : null])),
    completions: isCount(record.telemetry?.completions) ? record.telemetry.completions : 0,
    state: record.state,
    terminalReason: record.terminalReason ?? null,
    endedAt: record.endedAt ?? null,
  };
}
