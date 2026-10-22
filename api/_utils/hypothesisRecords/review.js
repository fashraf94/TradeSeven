// api/_utils/hypothesisRecords/review.js
//
// Pilot P1c — THE REVIEW'S EVIDENCE (founder ruling E2, 16 Oct 2026; pilot spec
// Amendment E; table C V1.2). A deployed idea that reached its review gets a
// card: how the names of the list it rode in did against the market over the
// idea's window, which battles carried it, and the honest line that the agent
// does not act on ideas yet. Served by GET
// /api/forge/watchlists/{id}/hypothesis-versions/{n}/review (owner-only,
// behind the record slice's gate).
//
// WHEN: a version that was deployed (`firstDeployedAt`) and whose window has
// closed — status `review_due`, `retired` after a deploy, or `invalidated`
// (P3/P4 will write it).
//
// THE WINDOW (as built; the report's "review window rule"):
//   start = the CLOSE of the regular session before the anchor session — the
//           anchor is the session containing the first deploy, else the next
//           one (horizon.js anchorSessionOf), so the start is the last close
//           before the idea went live;
//   end   = timed (reviewDueAt set): the close of the due session, reviewDueAt
//           itself; battle-end (reviewDueAt null — an `unspecified` idea, or a
//           B5 clock fault): the close of the session the LAST carrying
//           battle's final moment fell in (sessionAtOrBefore) — the battle's
//           end is the earlier of its completedAt and its expiresAt (a battle
//           the deploy path completes as expired is completed late, after its
//           real end), and it must be over (any status but 'active', or past
//           its expiresAt — the review pass's own rule);
//   closed when the end close has passed. A window whose end does not follow
//   its start (a battle that ended before the idea's first session) is EMPTY:
//   no name is priced over it.
//
// THE NAMES: the frozen snapshot of the FIRST carrying battle
// (`agentContext.equippedWatchlist.tickers`, never the live list). Versions
// activated before P1c carry no `deployedBattleIds`; their record names only
// `lastDeployedBattleId` — the LAST carrying battle — which then stands in as
// the first (stated in the build report). A battle counts only when it is the
// owner's and really carried THIS version beside a snapshot of the same list
// (deployedListOf's rule).
//
// THE EVIDENCE, computed ONCE and stored on the version as `reviewEvidence`
// { computedAt, source: 'eodhd_daily', window, names[], list, market } —
// outside contentHash and LIFECYCLE_FIELDS, like reviewClockFault — and
// served from there afterwards (a second request makes ZERO market-data
// calls). Daily closes come from the feed the market-data authority's daily
// window reads — EODHD's `/eod/` endpoint and its row mapping
// (marketDataCache.js fetchDailyOHLCV / mapDailyRows: the split- and
// dividend-adjusted close) — fetched for the WINDOW'S OWN DATES
// (fetchWindowDaily, one call per symbol): getStockAnalysisData's daily
// window reaches only 90 calendar days back, short of a long-term window
// (review L2-2 / L4-2), and its shared `SYMBOL_daily` cache document is one
// window by contract, so the review neither widens it nor writes it. Each
// name: its start close, end close and change %, or `unavailable` with a
// typed reason — never null. A close is stored as shown (roundClose) and the
// change % is derived from the stored closes. The list's change is the
// equal-weight mean of the names that have one; SPY's change over the same
// window is the market. Every stored percentage is rounded to 2 decimals and
// the route's difference is computed from those stored numbers (BUILD_RULES §9).
//
// THE BUDGET: at most REVIEW_CALL_BUDGET (11) market-data calls per version,
// per lifetime — 10 names and SPY; a name past the tenth is `unavailable`
// ('budget'). A one-time CLAIM, written in a transaction before any call,
// keeps two requests from computing twice; a claim older than its lease with
// no evidence (a request that died mid-way) is finalized as unavailable with
// no further call, so the budget holds even then. The computation waits
// REVIEW_SETTLE_MS (3 h) after the window's end close, so the last close is in
// the daily feed; until then the route answers without evidence
// (`evidence: null, pending: 'awaiting_close'`).

import { mapDailyRows, getCleanSymbol, formatEODHDSymbol, isCryptoSymbol } from '../marketDataCache.js';
import { anchorSessionOf, previousSessionOf, sessionAtOrBefore, etDateOfInstant, HorizonClockError } from './horizon.js';
import { battleIsOver } from './reviewPass.js';
import { carryingBattleIdsOf } from './model.js';
import { HypothesisRouteError, watchlistRefOf, versionRefOf } from './store.js';
// The card's one predicate and its honest line live in the shared vocabulary (the Forge reads the same).
import { REVIEW_HONEST_LINE, REVIEWABLE_STATUSES, reviewableVersion } from '../../../src/constants/hypothesisRecords.js';

export { REVIEWABLE_STATUSES, reviewableVersion };

export const REVIEW_EVIDENCE_FIELD = 'reviewEvidence';
export const REVIEW_EVIDENCE_CLAIM_FIELD = 'reviewEvidenceClaim';
export const REVIEW_EVIDENCE_SOURCE = 'eodhd_daily';
export const REVIEW_MARKET_SYMBOL = 'SPY';
/** Market-data calls per version, per lifetime: the names plus the market. */
export const REVIEW_CALL_BUDGET = 11;
export const REVIEW_NAMES_MAX = REVIEW_CALL_BUDGET - 1;
/** A claim older than this with no evidence belongs to a request that died. */
export const REVIEW_CLAIM_LEASE_MS = 120_000;
/** The wait after the window's end close before its closes are read (the daily feed settles). */
export const REVIEW_SETTLE_MS = 3 * 60 * 60_000;
const EODHD_API_BASE = 'https://eodhd.com/api';

const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const round2 = (x) => Math.round(x * 100) / 100;
const msOf = (v) => {
  if (v && typeof v.toDate === 'function') return v.toDate().getTime();
  return typeof v === 'string' ? Date.parse(v) : NaN;
};
const iso = (ms) => new Date(ms).toISOString();
const fail = (status, code, extra) => new HypothesisRouteError(status, code, code, extra);

/**
 * A carrying battle as the review may use it: the owner's, carrying THIS
 * version beside a snapshot of the same list; else null. Pure.
 */
export function carryingBattleOf(battle, { uid, version }) {
  const sibling = battle?.agentContext?.equippedHypothesis;
  const frozen = battle?.agentContext?.equippedWatchlist;
  if (!isPlainObject(battle) || battle.ownerId !== uid || !isPlainObject(sibling) || !isPlainObject(frozen)) return null;
  if (sibling.watchlistId !== version.watchlistId || sibling.hypothesisVersion !== version.version || frozen.watchlistId !== version.watchlistId) return null;
  return battle;
}

/** A battle's end: the earlier of completedAt and expiresAt, once it is over (reviewPass.js battleIsOver — the one rule). Pure. */
export function battleEndMsOf(battle, nowMs) {
  if (!battleIsOver(battle, nowMs)) return null;
  const ends = [msOf(battle?.expiresAt), msOf(battle?.completedAt)].filter(Number.isFinite);
  return ends.length ? Math.min(...ends) : null;
}

/**
 * THE WINDOW (the rule above). Pure.
 *
 * @returns {{ closed: true, window: { kind: 'timed'|'battle_end', start: {etDate, closeAt}, end: {etDate, closeAt}, empty: boolean } }
 *   | { closed: false, reason: string }}
 */
export function reviewWindowOf({ version, lastBattle, nowMs }) {
  const firstMs = Date.parse(version?.firstDeployedAt);
  if (!Number.isFinite(firstMs)) return { closed: false, reason: 'no_first_deploy' };
  let start;
  let end;
  let kind;
  try {
    const anchor = anchorSessionOf(firstMs);
    const before = previousSessionOf(anchor.etDate);
    start = { etDate: before.etDate, closeMs: before.closeMs };
    if (version.reviewDueAt != null) {
      kind = 'timed';
      const dueMs = Date.parse(version.reviewDueAt);
      if (!Number.isFinite(dueMs)) return { closed: false, reason: 'due_unreadable' };
      end = { etDate: etDateOfInstant(dueMs), closeMs: dueMs };
    } else {
      kind = 'battle_end';
      const endedMs = lastBattle ? battleEndMsOf(lastBattle, nowMs) : null;
      if (endedMs === null) return { closed: false, reason: lastBattle ? 'battle_running' : 'battle_unknown' };
      const s = sessionAtOrBefore(endedMs);
      end = { etDate: s.etDate, closeMs: s.closeMs };
    }
  } catch (err) {
    if (err instanceof HorizonClockError) return { closed: false, reason: err.code };
    throw err;
  }
  if (nowMs < end.closeMs) return { closed: false, reason: 'window_open' };
  return {
    closed: true,
    window: {
      kind,
      start: { etDate: start.etDate, closeAt: iso(start.closeMs) },
      end: { etDate: end.etDate, closeAt: iso(end.closeMs) },
      empty: end.closeMs <= start.closeMs,
    },
  };
}

/** The frozen names a battle carried (its snapshot's tickers): strings, upper-case, each once, in order. Pure. */
export function frozenNamesOf(battle) {
  const tickers = battle?.agentContext?.equippedWatchlist?.tickers;
  const out = [];
  for (const t of Array.isArray(tickers) ? tickers : []) {
    const s = typeof t === 'string' ? t.trim().toUpperCase() : '';
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

const closeOn = (rows, etDate) => {
  const row = (Array.isArray(rows) ? rows : []).find((r) => r?.date === etDate);
  const c = row ? row.close : undefined;
  return typeof c === 'number' && Number.isFinite(c) && c > 0 ? c : null;
};

/**
 * A close as the card stores and shows it: 2 decimals from $1 up, else 4
 * significant figures (a sub-dollar name never reads 0.00). The change % is
 * derived from these stored closes, so it is the change of the closes shown
 * (BUILD_RULES §9; review L4-11). Pure.
 */
export function roundClose(x) {
  return x >= 1 ? round2(x) : Number(x.toPrecision(4));
}

/** One symbol over the window, from its fetched daily rows (or the fetch's failure). Pure. */
function priced(symbol, fetched, window) {
  if (fetched.error) return { symbol, status: 'unavailable', reason: 'fetch_failed' };
  const rows = fetched.rows;
  if (!Array.isArray(rows) || rows.length === 0) return { symbol, status: 'unavailable', reason: 'no_data' };
  const start = closeOn(rows, window.start.etDate);
  const end = closeOn(rows, window.end.etDate);
  if (start === null) return { symbol, status: 'unavailable', reason: 'no_start_close' };
  if (end === null) return { symbol, status: 'unavailable', reason: 'no_end_close' };
  const startClose = roundClose(start);
  const endClose = roundClose(end);
  return { symbol, status: 'ok', startClose, endClose, changePct: round2((endClose / startClose - 1) * 100) };
}

/**
 * ONE market-data call: a symbol's daily rows over [from, to] — EODHD's
 * `/eod/` endpoint and the row mapping the daily window uses
 * (marketDataCache.js fetchDailyOHLCV / mapDailyRows), bounded by the
 * window's own dates. Writes no cache. Throws on a failed fetch (the
 * symbol's `fetch_failed`); the key never leaves this function.
 */
export async function fetchWindowDaily(symbol, { from, to }) {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) throw new Error('EODHD_API_KEY not configured');
  const eodSymbol = formatEODHDSymbol(getCleanSymbol(symbol), isCryptoSymbol(symbol));
  const url = `${EODHD_API_BASE}/eod/${encodeURIComponent(eodSymbol)}?api_token=${apiKey}&fmt=json&period=d&order=a&from=${from}&to=${to}`;
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error('EODHD daily request failed');
  }
  if (!response.ok) throw new Error(`EODHD daily responded with ${response.status}`);
  const data = await response.json();
  return Array.isArray(data) ? mapDailyRows(data).rows : [];
}

/** The market-data calls the evidence will make: none for an empty window, else the counted names and the market. Pure. */
export function plannedCallsOf({ window, names }) {
  return window.empty ? 0 : Math.min(names.length, REVIEW_NAMES_MAX) + 1;
}

/**
 * Compute the evidence over a closed window: at most REVIEW_NAMES_MAX names
 * and the market, one market-data call each, in parallel, each for the
 * window's own dates. Never throws for a symbol (a failed fetch is that
 * symbol's `unavailable`). An empty window makes no call: every name, the
 * list and the market are unavailable for that reason.
 *
 * @returns {Promise<{ evidence: object, calls: number }>}
 */
export async function computeReviewEvidence({ window, names, nowMs, fetchDaily = fetchWindowDaily }) {
  const unpriceable = window.empty ? 'empty_window' : null;
  const counted = unpriceable ? [] : names.slice(0, REVIEW_NAMES_MAX);
  const symbols = unpriceable ? [] : [...counted, REVIEW_MARKET_SYMBOL];
  const fetched = await Promise.all(symbols.map(async (symbol) => {
    try {
      return { rows: await fetchDaily(symbol, { from: window.start.etDate, to: window.end.etDate }) };
    } catch (err) {
      return { error: String(err?.message || err).slice(0, 200) };
    }
  }));
  const bySymbol = new Map(symbols.map((s, i) => [s, fetched[i]]));
  const nameRows = names.map((symbol, i) => {
    if (unpriceable) return { symbol, status: 'unavailable', reason: unpriceable };
    if (i >= REVIEW_NAMES_MAX) return { symbol, status: 'unavailable', reason: 'budget' };
    return priced(symbol, bySymbol.get(symbol), window);
  });
  const ok = nameRows.filter((r) => r.status === 'ok');
  const list = ok.length > 0
    ? { status: 'ok', changePct: round2(ok.reduce((sum, r) => sum + r.changePct, 0) / ok.length), counted: ok.length, total: names.length }
    : { status: 'unavailable', reason: names.length === 0 ? 'no_frozen_list' : (unpriceable ?? 'no_name_priced'), counted: 0, total: names.length };
  const marketRow = unpriceable
    ? { symbol: REVIEW_MARKET_SYMBOL, status: 'unavailable', reason: unpriceable }
    : priced(REVIEW_MARKET_SYMBOL, bySymbol.get(REVIEW_MARKET_SYMBOL), window);
  return {
    calls: symbols.length,
    evidence: {
      computedAt: iso(nowMs),
      source: REVIEW_EVIDENCE_SOURCE,
      window,
      names: nameRows,
      list,
      market: marketRow,
    },
  };
}

/** The evidence a request that died mid-way leaves: every name and the market unavailable — no call is made for it. */
function interruptedEvidence({ window, names, nowMs }) {
  return {
    computedAt: iso(nowMs),
    source: REVIEW_EVIDENCE_SOURCE,
    window,
    names: names.map((symbol) => ({ symbol, status: 'unavailable', reason: 'interrupted' })),
    list: { status: 'unavailable', reason: 'interrupted', counted: 0, total: names.length },
    market: { symbol: REVIEW_MARKET_SYMBOL, status: 'unavailable', reason: 'interrupted' },
  };
}

/** The difference the card shows: list minus market, from the two STORED numbers (BUILD_RULES §9). Pure. */
export function differenceOf(evidence) {
  const l = evidence?.list;
  const m = evidence?.market;
  return l?.status === 'ok' && m?.status === 'ok' ? round2(l.changePct - m.changePct) : null;
}

/** The owner's version, read in one transaction with its parent (403 / 404 as the store's routes answer). */
async function ownedVersion(db, { uid, watchlistId, version }) {
  return db.runTransaction(async (tx) => {
    const parentSnap = await tx.get(watchlistRefOf(db, watchlistId));
    if (!parentSnap?.exists) throw fail(404, 'not_found');
    const parent = parentSnap.data();
    if (parent.userId !== uid) throw fail(403, 'forbidden');
    if (parent.deletedAt) throw fail(404, 'not_found');
    const snap = await tx.get(versionRefOf(db, watchlistId, version));
    if (!snap?.exists) throw fail(404, 'version_not_found');
    return snap.data();
  }, { readOnly: true });
}

/**
 * THE REVIEW for one version (the route's body). Reads the version, its
 * carrying battles (one getAll), the window; then serves the stored evidence,
 * or claims, computes and stores it once.
 *
 * @returns {Promise<object>} the route's answer (without watchlistId)
 */
export async function readReview(db, { uid, watchlistId, version, nowMs, fetchDaily = fetchWindowDaily }) {
  const v = await ownedVersion(db, { uid, watchlistId, version });
  if (!reviewableVersion(v)) throw fail(409, 'review_unavailable', { status: v.status ?? null });

  const ids = carryingBattleIdsOf(v);
  const battleRef = (id) => db.collection('agentBattles').doc(id);
  const carrying = (snap) => carryingBattleOf(snap?.exists ? snap.data() : null, { uid, version: v });
  // The window first (review L2-11): a timed window reads no battle and a battle-end window only the last one,
  // so a window still open is answered before the carrying battles are read.
  const lastAlone = v.reviewDueAt == null && ids.length ? carrying(await battleRef(ids[ids.length - 1]).get()) : null;
  const verdict = reviewWindowOf({ version: v, lastBattle: lastAlone, nowMs });
  if (!verdict.closed) throw fail(409, 'review_window_open', { reason: verdict.reason });
  const snaps = ids.length ? await db.getAll(...ids.map(battleRef)) : [];
  const battles = ids.map((id, i) => ({ id, battle: carrying(snaps[i]) }));
  const first = battles[0]?.battle ?? null;
  const { window } = verdict;
  const names = frozenNamesOf(first);
  const agentName = typeof first?.agentContext?.agentName === 'string' && first.agentContext.agentName.trim() ? first.agentContext.agentName : null;
  const listName = typeof first?.agentContext?.equippedWatchlist?.name === 'string' && first.agentContext.equippedWatchlist.name.trim()
    ? first.agentContext.equippedWatchlist.name : null;

  let evidence = isPlainObject(v[REVIEW_EVIDENCE_FIELD]) ? v[REVIEW_EVIDENCE_FIELD] : null;
  let pending = null;
  if (!evidence) {
    if (nowMs < Date.parse(window.end.closeAt) + REVIEW_SETTLE_MS) {
      pending = 'awaiting_close';
    } else {
      const claim = await claimEvidence(db, { watchlistId, version, nowMs, window, names });
      if (claim.evidence) evidence = claim.evidence;
      else if (!claim.claimed) pending = 'computing';
      else {
        const { evidence: computed } = await computeReviewEvidence({ window, names, nowMs, fetchDaily });
        evidence = await storeEvidence(db, { watchlistId, version, claimedAt: claim.claimedAt, evidence: computed });
      }
    }
  }

  return {
    version,
    status: v.status,
    window,
    battles: battles.map(({ id, battle }) => ({
      battleId: id,
      createdAt: battle && typeof battle.createdAt === 'string' ? battle.createdAt : null,
      endedAt: battle && battleEndMsOf(battle, nowMs) !== null ? iso(battleEndMsOf(battle, nowMs)) : null,
      voided: battle?.completionReason === 'voided',
      known: battle !== null,
    })),
    // The FROZEN list's name (the first carrying battle's snapshot) — the card's label for the list, never the live name.
    listName,
    agentName,
    honestLine: agentName ? REVIEW_HONEST_LINE.split('[AGENT]').join(agentName) : null,
    evidence: evidence ?? null,
    // Why there is no evidence yet: the window's last close is settling, or another request is computing it.
    pending: evidence ? null : pending,
    difference: evidence ? differenceOf(evidence) : null,
  };
}

/**
 * The one-time claim: ONE transaction with a fresh read. Evidence stored →
 * it. A live claim → nothing (another request is computing). A stale claim
 * with no evidence → the interrupted evidence is stored now, no call. Else
 * the claim is written (`reviewEvidenceClaim: { claimedAt, calls }`).
 */
async function claimEvidence(db, { watchlistId, version, nowMs, window, names }) {
  const ref = versionRefOf(db, watchlistId, version);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const fresh = snap?.exists ? snap.data() : null;
    if (!fresh) throw fail(404, 'version_not_found');
    if (isPlainObject(fresh[REVIEW_EVIDENCE_FIELD])) return { evidence: fresh[REVIEW_EVIDENCE_FIELD] };
    const prior = fresh[REVIEW_EVIDENCE_CLAIM_FIELD];
    if (isPlainObject(prior)) {
      const age = nowMs - Date.parse(prior.claimedAt);
      if (Number.isFinite(age) && age < REVIEW_CLAIM_LEASE_MS) return { claimed: false };
      const evidence = interruptedEvidence({ window, names, nowMs });
      tx.update(ref, { [REVIEW_EVIDENCE_FIELD]: evidence });
      return { evidence };
    }
    const claimedAt = iso(nowMs);
    const calls = plannedCallsOf({ window, names });
    tx.update(ref, { [REVIEW_EVIDENCE_CLAIM_FIELD]: { claimedAt, calls } });
    return { claimed: true, claimedAt };
  });
}

/** Store the computed evidence once: ONE transaction; evidence already there (written first) wins. */
async function storeEvidence(db, { watchlistId, version, claimedAt, evidence }) {
  const ref = versionRefOf(db, watchlistId, version);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const fresh = snap?.exists ? snap.data() : null;
    if (!fresh) throw fail(404, 'version_not_found');
    if (isPlainObject(fresh[REVIEW_EVIDENCE_FIELD])) return fresh[REVIEW_EVIDENCE_FIELD];
    if (fresh[REVIEW_EVIDENCE_CLAIM_FIELD]?.claimedAt !== claimedAt) return evidence; // not our claim: answer, store nothing
    tx.update(ref, { [REVIEW_EVIDENCE_FIELD]: evidence });
    return evidence;
  });
}
