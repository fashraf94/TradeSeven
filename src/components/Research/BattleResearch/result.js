// src/components/Research/BattleResearch/result.js
//
// Battle Research Slice 1 — ONE RESULT, FROZEN, AND ITS ORDERINGS (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md BRS-6 – BRS-15, §6). PURE and
// NODE-CLEAN (Slice 2's server re-runs it): every instant is an argument.
//
// buildResult freezes six things at the instant the evidence arrived
// (`takenAt`): the group membership, each name's readings, eligibility at
// takenAt, the incumbent, the rankings subset and the quote states (§4 —
// classified once, the median computed once before any condition). Nothing
// later reorders it: outcomeOf re-runs an order and conditions over the SAME
// frozen evidence and reads nothing.
//
// THE ORDER (BRS-11): technical rank, best first; or today's move, biggest gain
// first (Biggest drop first toggles), ties to technical rank then the symbol.
// Only an `ok` move takes part in move ordering and move conditions; any other
// state is NOT ASSESSED (set apart, never flat, never "removed"). Up, down and
// zero are decided on the raw sign — the sign pctText prints — so a move of
// exactly 0 fails both "up today" and "down today" (a fail, not "not assessed").
// Universe rank is the order across mixed sectors; with a sector condition the
// rows print the sector rank first (a label, not a second sort). No blended
// score exists here.
//
// THE REFERENCE (BRS-6): the incumbent is an unranked reference line, placed
// where its own value falls in the active order, never numbered; with no
// reading for the active measure it is not placed, and says so.
//
// Positions are within the result (#1 of 9 placed); the universe rank is a
// separate number with its own label — rank, fit and eligibility are never merged.

import { bookOf, weakestOf, rankedBook, unscoredOf, bookCheckMs, lockNowOf } from '../Sheet/book.js';
import { stockModelRoute } from '../../../utils/stockThresholdModel.js';
import { TICKER_TO_SECTOR, STOCK_UNIVERSE } from '../../../../api/_utils/rankingConfig.js';
import { etClockAmPm } from '../BombMode/checkClock.js';
import { atrReadingOf } from '../BombMode/atrReading.js';
import { sessionAt, classifyMove, medianAsOfOf } from './readings.js';
import { membershipOf, inGroup } from './groups.js';
import { BR_COPY } from './battleResearchCopy.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

/** An instant as epoch ms: a number, a Firestore Timestamp (toMillis / seconds), or an ISO string. */
export function msOf(v) {
  if (finite(v)) return v;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (v && typeof v.toMillis === 'function') { try { const ms = v.toMillis(); return finite(ms) ? ms : null; } catch { return null; } }
  if (v && finite(v.seconds)) return v.seconds * 1000 + (finite(v.nanoseconds) ? Math.floor(v.nanoseconds / 1e6) : 0);
  if (v && finite(v._seconds)) return v._seconds * 1000;
  return null;
}

// ── The incumbent (BRS-6): weakestOf's choice at that moment, never another pick ──

/**
 * The weakest held measured stock as the result freezes it — book.js's own choice (QF-2) with
 * its check time, its receipt's rung size and what a swap-out would lock (lockNowOf, the scorer's
 * own number at the last check). Null with no weakest.
 */
export function incumbentOf(battle) {
  const w = weakestOf(bookOf(battle));
  if (!w) return null;
  return {
    symbol: w.symbol,
    positionId: w.positionId,
    tier: w.tier,
    slot: w.slot,
    rungsShown: w.rungsShown,
    checkAtMs: w.checkAtMs ?? null,
    scoringPct: finite(w.context?.scoringPct) ? w.context.scoringPct : null,
    lockNow: lockNowOf(w),
  };
}

/**
 * Why there is no weakest holding (BRS-6), as two cases that never share wording:
 *   'awaiting'   a measured battle whose measured stocks have no committed context yet
 *   'legacy'     a legacy-scored battle
 *   'no_ladder'  a measured battle whose book holds no stock on the ladder (crypto only, or none)
 * null when there IS a weakest.
 */
export function noWeakestReason(battle) {
  if (stockModelRoute(battle).status !== 'corrected') return 'legacy';
  const book = bookOf(battle);
  if (rankedBook(book).length) return null;
  return unscoredOf(book).length ? 'awaiting' : 'no_ladder';
}

/** The held measured stocks a comparison can pick (BRS-18), weakest first (QF-2's rank). */
export function holdingsForCompare(battle) {
  return rankedBook(bookOf(battle)).map((e) => ({ symbol: e.symbol, positionId: e.positionId }));
}

/** The last check the ranked book reads (the result keeps it, so a newer check is a notice). */
export function bookCheckOf(battle) {
  return bookCheckMs(rankedBook(bookOf(battle)));
}

/** A held measured stock as a comparison column freezes it (incumbentOf's shape), by symbol. */
export function holdingEntryOf(battle, symbol) {
  const e = rankedBook(bookOf(battle)).find((x) => x.symbol === symbol);
  if (!e) return null;
  return {
    symbol: e.symbol, positionId: e.positionId, tier: e.tier, slot: e.slot, rungsShown: e.rungsShown,
    checkAtMs: e.checkAtMs ?? null, scoringPct: finite(e.context?.scoringPct) ? e.context.scoringPct : null, lockNow: lockNowOf(e),
  };
}

// ── Building one result ──

/** The rankings rows a result keeps: the battle's names (membership + the incumbent). */
function rankingsSubset(doc, symbols) {
  const rows = {};
  const stocks = Array.isArray(doc?.stocks) ? doc.stocks : [];
  const want = new Set(symbols);
  for (const s of stocks) {
    if (!s || !want.has(s.symbol)) continue;
    rows[s.symbol] = {
      technicalRank: Number.isInteger(s.technicalRank) ? s.technicalRank : null,
      sectorTechnicalRank: Number.isInteger(s.sectorTechnicalRank) ? s.sectorTechnicalRank : null,
      sectorTechnicalTotal: Number.isInteger(s.sectorTechnicalTotal) ? s.sectorTechnicalTotal : null,
      technicalScore: finite(s.technicalScore) ? s.technicalScore : null,
      atrPercent: finite(s.techRaw?.atrPercent) ? s.techRaw.atrPercent : null,
      sectorName: nonEmpty(s.sectorName) ? s.sectorName : null,
      // The research sheet's packs read the archetype scores of the battle's own names (packs.js
      // rankScoresItem); an older result hands the modal this subset, so they ride along.
      ...(s.arch_scores && typeof s.arch_scores === 'object' ? { archScores: { ...s.arch_scores } } : {}),
    };
  }
  return {
    computedAt: msOf(doc?.computedAt),
    expiresAt: msOf(doc?.expiresAt),
    mode: typeof doc?.mode === 'string' ? doc.mode : null,
    totalTechStocks: Number.isInteger(doc?.totalTechStocks) ? doc.totalTechStocks : null,
    rows,
  };
}

/** A route quote, copied (never derived). */
function copyQuote(q) {
  if (!q || typeof q !== 'object') return null;
  return {
    price: finite(q.price) ? q.price : null,
    previousClose: finite(q.previousClose) ? q.previousClose : null,
    changePercent: finite(q.changePercent) ? q.changePercent : null,
    priceAsOf: finite(q.priceAsOf) ? q.priceAsOf : null,
    sessionEtDate: typeof q.sessionEtDate === 'string' ? q.sessionEtDate : null,
    collectionStalled: q.collectionStalled === true,
    ...(q.isFallback === true ? { isFallback: true } : {}),
  };
}

/**
 * BRS-14 — freeze one result. Pure.
 * @param {object} p
 * @param {object} p.battle        the battle document at takenAt (the screen's own subscription)
 * @param {object|null} p.incumbent the question's incumbent as of this result (incumbentOf), or null
 * @param {object|null} p.rankingsDoc indexIntelligence/stockRankings (Timestamps or ms)
 * @param {object|null} p.quotesBody the route's body ({ servedAt, snapshot, quotes })
 * @param {number} p.takenAt       the instant the evidence arrived
 * @param {number} p.index         1-based, for the label (Result 2 · 2:05 PM)
 * @param {string} p.resultId
 */
export function buildResult({ battle, incumbent = null, rankingsDoc, quotesBody, takenAt, index = 1, resultId }) {
  const { membership, excluded } = membershipOf(battle, { out: incumbent?.symbol ?? null, slot: incumbent?.tier ?? null, atMs: takenAt });
  const symbols = [...membership.map((m) => m.symbol), ...(incumbent ? [incumbent.symbol] : [])];
  const snapshot = quotesBody?.snapshot && typeof quotesBody.snapshot === 'object'
    ? { sweepId: typeof quotesBody.snapshot.sweepId === 'string' ? quotesBody.snapshot.sweepId : null, sweepAt: msOf(quotesBody.snapshot.sweepAt), lastSuccessfulSweepAt: msOf(quotesBody.snapshot.lastSuccessfulSweepAt) }
    : null;
  const session = sessionAt(takenAt);
  const cryptoOf = (s) => (incumbent && s === incumbent.symbol ? false : membership.find((m) => m.symbol === s)?.isCrypto === true);
  const copied = {};
  for (const s of symbols) copied[s] = snapshot ? copyQuote(quotesBody?.quotes?.[s]) : null;
  // §4: the median ONCE, over the whole membership plus the incumbent, before any condition.
  const medianAsOf = medianAsOfOf(symbols.map((s) => ({ quote: copied[s], isCrypto: cryptoOf(s) })), { session, snapshot, takenAt });
  const rows = {};
  for (const s of symbols) {
    const c = classifyMove({ quote: copied[s], isCrypto: cryptoOf(s), session, medianAsOf, snapshot, takenAt });
    rows[s] = { ...(copied[s] ?? { price: null, previousClose: null, changePercent: null, priceAsOf: null, sessionEtDate: null }), state: c.state, cause: c.cause, words: c.words };
  }
  return {
    resultId,
    label: BR_COPY.resultLabel(index, etClockAmPm(takenAt)),
    index,
    takenAt,
    membership,
    excluded,
    rankings: rankingsSubset(rankingsDoc, symbols),
    quotes: { snapshot: snapshot ? { sweepId: snapshot.sweepId, sweepAt: snapshot.sweepAt } : null, medianAsOf, rows },
    incumbent: incumbent ? { ...incumbent, lockNow: incumbent.lockNow ? { ...incumbent.lockNow } : null } : null,
    // The ranked book's last check at takenAt: a newer one is a notice, never a reorder.
    bookCheckMs: bookCheckOf(battle),
    // BRS-8: the rung — measured battles only (a legacy-scored battle shows none).
    measured: stockModelRoute(battle).status === 'corrected',
  };
}

// ── Readings of one frozen result ──

/** The session the result was taken in (pure — from takenAt). */
export const sessionOfResult = (result) => sessionAt(result.takenAt);

/** A name's sector: the rankings row's sectorName, else the static map (rankingConfig). */
export function sectorOf(result, symbol) {
  const row = result.rankings.rows[symbol];
  if (row?.sectorName) return row.sectorName;
  const id = TICKER_TO_SECTOR[symbol];
  return id && STOCK_UNIVERSE[id]?.name ? STOCK_UNIVERSE[id].name : null;
}

/** A name's frozen move: { ok, value (raw %), row }. */
export function moveOf(result, symbol) {
  const row = result.quotes.rows[symbol] ?? null;
  return { ok: row?.state === 'ok', value: row?.state === 'ok' ? row.changePercent : null, row };
}

/** A name's frozen rank row, or null. */
export const rankOf = (result, symbol) => result.rankings.rows[symbol] ?? null;

/**
 * A candidate's rung estimate (BRS-8): atrReadingOf on the row's atrPercent with the rankings
 * doc's time, at takenAt (BS-4's freshness) — { pct, asOfMs } or null. Measured battles only.
 */
export function rungEstimateOf(result, symbol) {
  if (!result.measured) return null;
  const row = result.rankings.rows[symbol];
  if (!row) return null;
  const r = atrReadingOf({ atrPercent: row.atrPercent, updatedAt: result.rankings.computedAt }, result.takenAt);
  return r.pct === null ? null : r;
}

/** The result's reading times (BRS-8 note line): ranks at computedAt; moves from–to over the ok quotes used. */
export function timesOf(result) {
  const asOf = Object.values(result.quotes.rows).filter((r) => r.state === 'ok' && finite(r.priceAsOf)).map((r) => r.priceAsOf);
  const ranksAtMs = result.rankings.computedAt;
  return {
    ranksAtMs,
    ranksAt: finite(ranksAtMs) ? etClockAmPm(ranksAtMs) : null,
    // BRS-8: past the doc's expiresAt the rank label reads "older than usual".
    ranksOlder: finite(result.rankings.expiresAt) && result.takenAt > result.rankings.expiresAt,
    movesFromMs: asOf.length ? Math.min(...asOf) : null,
    movesToMs: asOf.length ? Math.max(...asOf) : null,
    movesFrom: asOf.length ? etClockAmPm(Math.min(...asOf)) : null,
    movesTo: asOf.length ? etClockAmPm(Math.max(...asOf)) : null,
    takenAt: etClockAmPm(result.takenAt),
  };
}

/** The frozen states of the result's STOCK quotes (crypto is never a move — BRS-9). */
export function stockStatesOf(result) {
  return Object.entries(result.quotes.rows).filter(([s]) => !result.membership.find((m) => m.symbol === s)?.isCrypto).map(([, r]) => r.state);
}

/** The sectors present among a group's ranked names, for the one-at-a-time sector condition (BRS-12). */
export function sectorsPresent(result, group) {
  const seen = [];
  for (const m of result.membership) {
    if (!inGroup(m, group) || m.isCrypto || !result.rankings.rows[m.symbol]) continue;
    const s = sectorOf(result, m.symbol);
    if (s && !seen.includes(s)) seen.push(s);
  }
  return seen.sort((a, b) => a.localeCompare(b));
}

// ── The outcome of one view over a frozen result (BRS-11 – BRS-13) ──

/** One condition on one member: 'pass' | 'fail' | 'na' (not assessed). */
export function testCondition(result, member, cond) {
  if (cond.id === 'eligible_now') return member.eligibility.ok ? 'pass' : 'fail';
  if (cond.id === 'up_today' || cond.id === 'down_today') {
    const m = moveOf(result, member.symbol);
    if (!m.ok) return 'na';
    return (cond.id === 'up_today' ? m.value > 0 : m.value < 0) ? 'pass' : 'fail';
  }
  if (cond.id === 'sector') {
    const s = sectorOf(result, member.symbol);
    if (!s) return 'na';
    return s === cond.value ? 'pass' : 'fail';
  }
  return 'pass';
}

const DEFAULT_ORDER = Object.freeze({ measure: 'technical_rank', direction: 'best_first' });

/**
 * The comparator for the active order (BRS-11), over members with a reading for it.
 * Move ties go to technical rank, then the symbol.
 */
function comparatorOf(result, order) {
  const rank = (s) => result.rankings.rows[s]?.technicalRank ?? Number.MAX_SAFE_INTEGER;
  const bySym = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  if (order.measure === 'today_move') {
    const sign = order.direction === 'worst_first' ? 1 : -1;
    return (a, b) => (sign * (moveOf(result, a).value - moveOf(result, b).value)) || (rank(a) - rank(b)) || bySym(a, b);
  }
  return (a, b) => (rank(a) - rank(b)) || bySym(a, b);
}

/** A member's value under the active measure, or null without a reading for it. */
function valueUnder(result, symbol, order) {
  if (order.measure === 'today_move') return moveOf(result, symbol).value;
  const r = result.rankings.rows[symbol]?.technicalRank;
  return Number.isInteger(r) ? r : null;
}

/**
 * Where the reference line sits (BRS-6): before the first placed name it does NOT trail. On rank,
 * names above out-rank it; on today's move (gain first), names above are up more; drop first,
 * names above are down more. An equal value never sits above the line. No reading: not placed.
 */
export function placeReference(result, placed, order, incumbent) {
  if (!incumbent) return null;
  const mine = valueUnder(result, incumbent.symbol, order);
  if (mine === null) return { symbol: incumbent.symbol, before: null, noReading: true };
  const outranks = (s) => {
    const v = valueUnder(result, s, order);
    if (order.measure === 'today_move') return order.direction === 'worst_first' ? v < mine : v > mine;
    return v < mine;
  };
  const first = placed.find((p) => !outranks(p.symbol));
  return { symbol: incumbent.symbol, before: first ? first.symbol : null, noReading: false };
}

/**
 * The outcome of a view (§6 `outcome`): placed (positions within the result), the reference, the
 * names removed by a condition, the names not assessed, and the unranked. Applies every condition
 * and the order to the result's WHOLE frozen group (BRS-12), never to the rows on screen.
 * @param {object} result
 * @param {{ group: 'bench'|'agent_watchlist'|'union', order: object, conditions: object[] }} view
 * @param {{ prev?: object|null }} [opts]  the previous step's outcome on the SAME result (for "was #3")
 */
export function outcomeOf(result, view, { prev = null } = {}) {
  const order = view?.order ?? DEFAULT_ORDER;
  const conditions = Array.isArray(view?.conditions) ? view.conditions : [];
  const unranked = [];
  const removed = [];
  const notAssessed = [];
  const passing = [];
  for (const m of result.membership) {
    if (!inGroup(m, view?.group ?? 'union')) continue;
    if (m.isCrypto) { unranked.push({ symbol: m.symbol, reason: 'crypto' }); continue; }
    if (!result.rankings.rows[m.symbol] || !Number.isInteger(result.rankings.rows[m.symbol].technicalRank)) { unranked.push({ symbol: m.symbol, reason: 'not_in_rankings' }); continue; }
    const fails = [];
    let cannot = null;
    for (const c of conditions) {
      const r = testCondition(result, m, c);
      if (r === 'fail') fails.push(c.id);
      else if (r === 'na' && cannot === null) cannot = c.id;
    }
    if (fails.length) { removed.push({ symbol: m.symbol, by: fails }); continue; }
    if (cannot !== null) { notAssessed.push({ symbol: m.symbol, conditionId: cannot, state: result.quotes.rows[m.symbol]?.state ?? 'missing' }); continue; }
    if (order.measure === 'today_move' && !moveOf(result, m.symbol).ok) {
      notAssessed.push({ symbol: m.symbol, conditionId: 'order', state: result.quotes.rows[m.symbol]?.state ?? 'missing' });
      continue;
    }
    passing.push(m.symbol);
  }
  passing.sort(comparatorOf(result, order));
  const before = new Map((prev?.placed ?? []).map((p) => [p.symbol, p.position]));
  const placed = passing.map((symbol, i) => {
    const was = before.get(symbol);
    return { symbol, position: i + 1, ...(was !== undefined && was !== i + 1 ? { wasPosition: was } : {}) };
  });
  return { placed, reference: placeReference(result, placed, order, result.incumbent), removed, notAssessed, unranked };
}

/**
 * BRS-18a — what a condition would do to the result's WHOLE frozen group, with the other active
 * conditions: { remain, fail, notAssessed }. `replaces` drops the condition it would replace.
 */
export function conditionCounts(result, view, cond, { replaces = null } = {}) {
  const others = (view.conditions ?? []).filter((c) => c.id !== cond.id && c.id !== replaces);
  const out = outcomeOf(result, { ...view, conditions: [...others, cond] });
  return {
    remain: out.placed.length,
    // The names THIS condition fails (a name another active condition already removes is not counted twice).
    fail: out.removed.filter((r) => r.by.includes(cond.id)).length,
    notAssessed: out.notAssessed.length,
  };
}
