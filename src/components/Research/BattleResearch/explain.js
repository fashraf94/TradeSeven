// src/components/Research/BattleResearch/explain.js
//
// Battle Research Slice 1 — WHAT THE AGENT SAYS, FROM THE FROZEN RESULT ALONE
// (spec docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md BRS-5, BRS-13, BRS-15 –
// BRS-20, §9). PURE and NODE-CLEAN: the templates' SELECTION from evidence; the
// words are battleResearchCopy.js's. Nothing here reads a clock, a store or a
// live price: a result's numbers are the numbers it froze, so the row, the
// explanation, the modal's research blocks and the draft print ONE string per
// reading (BUILD_RULES §9) — readings.moveText for a move (the printed number,
// readings.shownMove, decides every comparison too), atrReadingText for a rung,
// the sheet's rungsText for a holding, readings.whenText for a time (its day
// named when it is not the result's own).
//
// It never predicts, projects points, calls a stock good or bad, or mentions
// fit, overlap, momentum or SPY. A reading the result doesn't have is left
// out, never written as zero.

import { etClockAmPm, etWeekday, etDate } from '../BombMode/checkClock.js';
import { atrReadingText } from '../BombMode/bombCopy.js';
import { atrAsOfText } from '../BombMode/bombView.js';
import { rungsText } from '../Sheet/sheetCopy.js';
import { COMPANY_NAMES } from '../../../config/stockData.js';
import { allStaleOf, moveAvailability, moveText, whenText, checkWhen } from './readings.js';
import { incumbentOf, noWeakestReason, sectorOf, moveOf, rankOf, rungEstimateOf, timesOf, stockStatesOf, sessionOfResult, aboutOf, nextCheckTextOf, holdingEntryOfResult, serverNowOf } from './result.js';
import { BR_COPY, GROUP_LABEL, conditionWords, conditionLabel, orderLabel, eligibilityWhy, ordinal, clockRange, aheadWords } from './battleResearchCopy.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
/** The chat's length limit, composer and server alike (Phase 0 point 9: AgentChat.jsx:939, chatTextSanitize.js:26). */
export const CHAT_MAX_LENGTH = 2000;

/** The next check's time as a line can name it (result.nextCheckTextOf — one clock for the proposal and a result). */
export const nextCheckText = nextCheckTextOf;

/** A lock's time as a line names it: the clock on the reference instant's day, else the weekday too ("Thu 10:00 AM"). */
export function untilText(ms, refMs) {
  if (!finite(ms)) return null;
  return finite(refMs) && etDate(ms) === etDate(refMs) ? etClockAmPm(ms) : `${etWeekday(ms)} ${etClockAmPm(ms)}`;
}

// ── Names ──

/**
 * A company name (Phase 0 point 3): the persisted bench row's `name`, else the static
 * COMPANY_NAMES map (107 of the 228), else null — the ticker alone, never an invented name.
 */
export function companyNameOf(battle, symbol) {
  const bench = battle?.portfolio?.bench;
  const row = (Array.isArray(bench?.stocks) ? bench.stocks : []).find((s) => s?.symbol === symbol)
    ?? (bench?.crypto?.symbol === symbol ? bench.crypto : null);
  if (typeof row?.name === 'string' && row.name.trim() && row.name.trim() !== symbol) return row.name.trim();
  const fixed = COMPANY_NAMES[symbol];
  return typeof fixed === 'string' && fixed ? fixed : null;
}

// ── The proposal (BRS-5, BRS-6) ──

/**
 * The agent's proposal on open: the weakest holding with its check time and rungs from entry,
 * or why there is none — two cases that never share wording (BRS-6).
 * @returns {{ kind: 'weakest'|'awaiting'|'legacy'|'no_ladder', text: string, incumbent: object|null, weakestLine: string|null }}
 */
export function proposalOf(battle, nowMs) {
  const reason = noWeakestReason(battle);
  if (reason === null) {
    const inc = incumbentOf(battle);
    return { kind: 'weakest', incumbent: inc, weakestLine: null, text: BR_COPY.proposalWeakest(inc.symbol, checkWhen(inc.checkAtMs, nowMs) ?? 'last', rungsText(inc.rungsShown)) };
  }
  if (reason === 'awaiting') {
    const t = nextCheckTextOf(battle, nowMs);
    return { kind: 'awaiting', incumbent: null, text: BR_COPY.proposalAwaiting(t), weakestLine: BR_COPY.weakestUnavailable('awaiting', t) };
  }
  return { kind: reason, incumbent: null, text: reason === 'legacy' ? BR_COPY.proposalLegacy : BR_COPY.proposalNoLadder, weakestLine: BR_COPY.weakestUnavailable(reason) };
}

/** The move line the calendar gives while moves can't be ranked (BRS-5): the starter's and the toolbar's. */
export function moveLineOf(avail) {
  if (!avail || avail.on) return null;
  if (avail.reason === 'before_open') return BR_COPY.beforeOpenShort(avail.openText);
  if (avail.reason === 'waiting') return BR_COPY.waitingShort;
  return BR_COPY.closedShort(avail.next?.dayText ?? null, avail.next?.openText ?? null);
}

/** Today's-move availability of a frozen result (BRS-12: only once one of ITS stock quotes is ok). */
export const availabilityOf = (result) => moveAvailability({ states: stockStatesOf(result), session: sessionOfResult(result), takenAt: result.takenAt });

// ── One row's facts (§7) ──

/**
 * BRS-15 — a name's eligibility label, at the result's instant `refMs` (a lock names its day when it
 * is not that day's); with `nowMs`, a lock that has passed since says so.
 */
export function eligibilityLabel(elig, refMs = null, nowMs = null) {
  if (elig.ok) return { tone: 'ok', text: BR_COPY.canComeIn };
  if (elig.reason === 'pick_locked') {
    const t = untilText(elig.lockedUntil, refMs);
    if (t && finite(nowMs) && nowMs >= elig.lockedUntil) return { tone: 'locked', text: BR_COPY.lockedPassed(t) };
    return { tone: 'locked', text: t ? BR_COPY.lockedUntil(t) : BR_COPY.cantComeIn };
  }
  if (elig.reason === 'pick_not_on_bench') return { tone: 'no', text: BR_COPY.equippedOnly };
  if (elig.reason === 'pick_wrong_class') return { tone: 'no', text: BR_COPY.wrongClass };
  return { tone: 'no', text: BR_COPY.cantComeIn };
}

/** A member's eligibility against a holding: the frozen answer for THAT holding (review BR2-1), else the result's. */
export function eligibilityVs(member, holdingSymbol) {
  if (!member) return null;
  return holdingSymbol && member.vs && member.vs[holdingSymbol] ? member.vs[holdingSymbol] : member.eligibility;
}

/** The rank text (BRS-8): *Rank 12 of 228 · 1:01 PM ET*, with *older than usual* past the doc's expiry. */
export function rankText(result, symbol) {
  const r = rankOf(result, symbol);
  if (!Number.isInteger(r?.technicalRank)) return null;
  const t = timesOf(result);
  const N = result.rankings.totalTechStocks;
  return t.ranksAt ? BR_COPY.rank(r.technicalRank, N, t.ranksAt, t.ranksOlder) : BR_COPY.rankNoTime(r.technicalRank, N);
}

/** The ranks' time as a sentence names it: "1:01 PM ET", with "older than usual" when it is (BRS-8). */
function ranksAtWords(result) {
  const t = timesOf(result);
  return t.ranksAt ? `${t.ranksAt} ET${t.ranksOlder ? ', older than usual' : ''}` : null;
}

/** A candidate's rung (BRS-8): *Estimated rung size ≈4.1% · ATR reading · 1:01 PM ET* — 💣's own number and time formatter. */
export function rungText(result, symbol) {
  const r = rungEstimateOf(result, symbol);
  return r ? BR_COPY.rungEstimate(atrReadingText(r.pct), atrAsOfText(r.asOfMs, result.takenAt)) : null;
}

/** A holding's rung (BRS-8): *One rung is 3.2% · fixed at entry* (its receipt); none in a legacy-scored battle. */
export function holdingRungText(result, holding) {
  return result.measured && finite(holding?.scoringPct) ? BR_COPY.rungHolding(atrReadingText(holding.scoringPct)) : null;
}

/**
 * The difference chips against the incumbent (§7 third line): at most two, from the evidence,
 * neutral; none without evidence for it. Moves compare AS PRINTED (moveOf), and the move chip's
 * words are true in its direction (readings → aheadWords; review BR2-5).
 */
export function diffChipsOf(result, symbol) {
  const inc = result.incumbent;
  if (!inc) return [];
  const chips = [];
  const r = rankOf(result, symbol)?.technicalRank;
  const ri = rankOf(result, inc.symbol)?.technicalRank;
  if (Number.isInteger(r) && Number.isInteger(ri) && r < ri) chips.push(BR_COPY.diffRank(inc.symbol));
  const m = moveOf(result, symbol);
  const mi = moveOf(result, inc.symbol);
  if (m.ok && mi.ok && m.value > mi.value) chips.push(BR_COPY.diffMove(aheadWords(m.value, mi.value, inc.symbol)));
  return chips.slice(0, 2);
}

/**
 * One row's printed facts (§7): name, groups, eligibility; the rank and its time (the sector
 * rank first with a sector condition — BRS-11), today's move and its time or its state words, the
 * rung estimate, the sector; the difference chips on the weakest question.
 */
export function rowFactsOf(battle, result, symbol, { sectorActive = false, nowMs = null } = {}) {
  const member = result.membership.find((m) => m.symbol === symbol) ?? null;
  const rank = rankOf(result, symbol);
  const sector = sectorOf(result, symbol);
  const sectorRank = sectorActive && Number.isInteger(rank?.sectorTechnicalRank) && Number.isInteger(rank?.sectorTechnicalTotal) && sector
    ? BR_COPY.sectorRank(ordinal(rank.sectorTechnicalRank), rank.sectorTechnicalTotal, sector) : null;
  const q = result.quotes.rows[symbol];
  return {
    symbol,
    name: companyNameOf(battle, symbol),
    groups: member ? member.groups.map((g) => GROUP_LABEL[g]) : [],
    eligibility: member ? eligibilityLabel(member.eligibility, result.takenAt, serverNowOf(result, nowMs)) : null,
    rank: rankText(result, symbol),
    sectorRank,
    move: q ? q.words : null,
    moveState: q ? q.state : null,
    rung: rungText(result, symbol),
    sector,
    diffs: diffChipsOf(result, symbol),
  };
}

// ── The note line and the reference (BRS-8, §7) ──

export function groupLabelOf(view) {
  return view.group === 'union' ? BR_COPY.groupUnion : GROUP_LABEL[view.group];
}

/** All the names one step's group holds: placed, left out, not ranked (the note line's count). */
const groupCount = (outcome) => outcome.placed.length + outcome.removed.length + outcome.notAssessed.length + outcome.unranked.length;

/**
 * Why a name was set aside, not assessed: a sector condition on a name with no known sector says so
 * (refuter RF-6); anything else is its move's own state words (§4).
 */
export function notAssessedWords(result, item) {
  if (item?.conditionId === 'sector') return BR_COPY.sectorNotKnown;
  return result.quotes.rows[item?.symbol]?.words ?? item?.state ?? BR_COPY.notAssessed;
}

/** *Bench · 9 names · Ranks as of 1:01 PM ET · moves as of 1:42–1:44 PM ET*. */
export function noteLineOf(result, view, outcome) {
  const t = timesOf(result);
  return BR_COPY.note(groupLabelOf(view), groupCount(outcome), t.ranksAt, t.movesFrom, t.movesTo);
}

/** The reference line's words, and the hairline label above it when it falls inside the list. */
export function referenceOf(result, view, outcome) {
  const inc = result.incumbent;
  const ref = outcome.reference;
  if (!inc || !ref) return null;
  const order = view.order;
  const above = order.measure === 'today_move'
    ? (order.direction === 'worst_first' ? BR_COPY.aboveLineDown(inc.symbol) : BR_COPY.aboveLineUp(inc.symbol))
    : BR_COPY.aboveLineRank(inc.symbol);
  const noReadingWords = order.measure === 'today_move' ? (result.quotes.rows[inc.symbol]?.words ?? BR_COPY.notAssessed) : 'no technical rank';
  return {
    symbol: inc.symbol,
    text: BR_COPY.reference(inc.symbol, checkWhen(inc.checkAtMs, result.takenAt), finite(inc.rungsShown) ? rungsText(inc.rungsShown) : null),
    before: ref.before,
    noReading: ref.noReading ? BR_COPY.referenceNoReading(inc.symbol, noReadingWords) : null,
    // The hairline label only when the line falls INSIDE the list (names above it).
    above: !ref.noReading && ref.before !== (outcome.placed[0]?.symbol ?? null) ? above : null,
  };
}

// ── The explanation (BRS-16; §9) ──

/** The leader's eligibility clause (*, and it can come in now* …). */
function eligClause(result, symbol) {
  const m = result.membership.find((x) => x.symbol === symbol);
  if (!m) return '';
  if (m.eligibility.ok) return BR_COPY.eligNow;
  if (m.eligibility.reason === 'pick_locked' && finite(m.eligibility.lockedUntil)) return BR_COPY.eligLocked(untilText(m.eligibility.lockedUntil, result.takenAt));
  return BR_COPY.eligCant(eligibilityWhy(m.eligibility.reason));
}

const dirOf = (v) => (v > 0 ? BR_COPY.dirUp : v < 0 ? BR_COPY.dirDown : BR_COPY.dirFlat);
// The size of a printed move with its direction said in words ("up 0.3%"): the printed digits without a sign.
const absPct = (v) => moveText(Math.abs(v)).replace(/^\+/, '');
/** "up 2.0%" / "down 0.8%" / "flat at 0.0%" for a printed move. */
const dirMove = (v) => `${dirOf(v)} ${absPct(v)}`;
/** The quotes' own times as one range (review BR2-9). */
const quotesWhen = (result, symbols) => {
  const ms = symbols.map((s) => result.quotes.rows[s]?.priceAsOf).filter(finite);
  return ms.length ? clockRange(etClockAmPm(Math.min(...ms)), etClockAmPm(Math.max(...ms))) : null;
};

/** The session line while today's moves can't be ranked, and the all-stale line (§4, §9). */
function sessionLines(result) {
  const avail = availabilityOf(result);
  const lines = [];
  if (!avail.on) {
    if (avail.reason === 'before_open') lines.push(BR_COPY.beforeOpenLine(avail.openText, avail.refDay));
    else if (avail.reason === 'waiting') lines.push(BR_COPY.waitingLine);
    else lines.push(BR_COPY.closedLine(avail.next?.dayText ?? null, avail.next?.openText ?? null, avail.refDay));
  }
  const stockRows = aboutOf(result).filter((s) => !result.membership.find((m) => m.symbol === s)?.isCrypto).map((s) => result.quotes.rows[s]).filter(Boolean);
  const stale = allStaleOf(stockRows, result.quotes.snapshot);
  if (stale) lines.push(stale.cause === 'old_sweep' ? BR_COPY.allStaleSweep(stale.atText) : BR_COPY.allStaleQuotes(stale.atText));
  return { avail, lines };
}

/** The line a result with no weakest says on the weakest question (BRS-6: the two cases, never a shared wording). */
function weakestGoneLine(result) {
  const r = result.noWeakest?.reason ?? null;
  if (r === 'awaiting') return BR_COPY.proposalAwaiting(result.noWeakest.nextCheck ?? null);
  if (r === 'legacy') return BR_COPY.proposalLegacy;
  return BR_COPY.proposalNoLadder;
}

/**
 * The agent's explanation of one step (BRS-16): paragraphs, the first being the lead the phone's
 * bottom bar shows. Built from the frozen result and the step's outcome alone.
 */
export function explainOf(inv, result, step) {
  const { view, outcome } = step;
  const paras = [];
  const placed = outcome.placed;
  const lead = placed[0]?.symbol ?? null;
  const N = result.rankings.totalTechStocks;
  const ranksAt = ranksAtWords(result);
  const { lines: sessLines } = sessionLines(result);
  const leftOut = outcome.removed.length || outcome.notAssessed.length ? BR_COPY.explainLeftOut(outcome.removed.length, outcome.notAssessed.length) : null;
  const weakestQ = inv.question.id === 'weakest_alternatives';
  const inc = weakestQ ? result.incumbent : null;
  const byMove = view.order.measure === 'today_move';
  const leaderMove = (sym) => BR_COPY.explainLeaderMove(sym, dirMove(moveOf(result, sym).value), etClockAmPm(result.quotes.rows[sym].priceAsOf), eligClause(result, sym));

  if (inc) {
    const ri = rankOf(result, inc.symbol)?.technicalRank;
    const mi = moveOf(result, inc.symbol);
    const first = [];
    if (byMove && lead) {
      first.push(leaderMove(lead));
      if (mi.ok) first.push(BR_COPY.explainUpMore(placed.filter((p) => moveOf(result, p.symbol).value > mi.value).length, placed.length, inc.symbol));
      else first.push(BR_COPY.explainNoMove(inc.symbol));
    } else if (lead) {
      const ranked = placed.filter((p) => Number.isInteger(rankOf(result, p.symbol)?.technicalRank));
      const k = Number.isInteger(ri) ? ranked.filter((p) => rankOf(result, p.symbol).technicalRank < ri).length : 0;
      if (Number.isInteger(ri) && k === 0) first.push(BR_COPY.explainNoneOutrank(inc.symbol));
      else first.push(BR_COPY.explainOutrank(k, placed.length, inc.symbol, Number.isInteger(ri) ? ri : null, N));
      first.push(BR_COPY.explainLeader(lead, rankOf(result, lead).technicalRank, N, eligClause(result, lead), ranksAt));
    } else {
      first.push(BR_COPY.explainNoneLeft);
    }
    paras.push(first.join(' '));
    // Today's moves, the leader against the incumbent — each named, or said to be missing ONCE (review BR2-10).
    if (lead) {
      const ml = moveOf(result, lead);
      if (ml.ok && mi.ok) {
        paras.push(BR_COPY.explainMoves(lead, dirOf(ml.value), absPct(ml.value), inc.symbol, dirOf(mi.value), absPct(mi.value), quotesWhen(result, [lead, inc.symbol])));
      } else if (!byMove) {
        paras.push([!ml.ok ? lead : null, !mi.ok ? inc.symbol : null].filter(Boolean).map((s) => BR_COPY.explainNoMove(s)).join(' '));
      }
    }
    if (leftOut) paras.push(leftOut);
    paras.push(...sessLines);
    paras.push(BR_COPY.explainKeep(inc.symbol));
    return paras.filter(Boolean);
  }

  // Group questions — and the weakest question with no weakest at this result (it says why first).
  const group = groupLabelOf(view);
  const first = [];
  if (weakestQ) first.push(BR_COPY.explainWeakestGone(weakestGoneLine(result)));
  first.push(BR_COPY.explainGroup(groupCount(outcome), group === BR_COPY.groupUnion ? 'the bench and my agent watchlist' : `my ${group.toLowerCase()}`));
  if (lead) {
    if (byMove) first.push(leaderMove(lead));
    else first.push(BR_COPY.explainLeader(lead, rankOf(result, lead).technicalRank, N, eligClause(result, lead), ranksAt));
  } else if (outcome.removed.length || outcome.notAssessed.length) first.push(BR_COPY.explainNoneLeft);
  paras.push(first.join(' '));
  // ONE partition of the whole group the first line counts (refuter RF-3): every name lands in exactly one of
  // up, down, flat (prints 0.0), no reading, or crypto — the same counts in rank order and in move order.
  const crypto = new Set(outcome.unranked.filter((x) => x.reason === 'crypto').map((x) => x.symbol));
  const pool = [...placed.map((p) => p.symbol), ...outcome.removed.map((r) => r.symbol), ...outcome.notAssessed.map((r) => r.symbol), ...outcome.unranked.map((x) => x.symbol)].filter((s) => !crypto.has(s));
  const u = pool.filter((s) => moveOf(result, s).ok && moveOf(result, s).value > 0).length;
  const d = pool.filter((s) => moveOf(result, s).ok && moveOf(result, s).value < 0).length;
  const f = pool.filter((s) => moveOf(result, s).ok && moveOf(result, s).value === 0).length;
  const x = pool.filter((s) => !moveOf(result, s).ok).length;
  if (pool.length || crypto.size) paras.push(BR_COPY.explainGroupMoves(u, d, f, x, crypto.size, timesOf(result).movesTo));
  if (leftOut) paras.push(leftOut);
  paras.push(...sessLines);
  return paras.filter(Boolean);
}

// ── The banner after a refinement (BRS-13) ──

/**
 * What a refinement changed: the condition or the order, how many names are placed of the group's
 * assessable names, how many were removed, set aside (not assessed) or came back, which name moved and
 * WHY — ending that the readings are the same result and nothing was refreshed (review BR2-3). Null for
 * the question step and for a refresh (the refresh has its own report).
 */
export function bannerOf(inv, step) {
  if (!step || step.kind === 'question' || step.kind === 'refresh' || !step.parentStepId) return null;
  const parent = inv.steps.find((s) => s.stepId === step.parentStepId);
  if (!parent || parent.resultId !== step.resultId) return null;
  const result = inv.results[step.resultId];
  const end = BR_COPY.bannerEnd(etClockAmPm(result.takenAt));
  const added = step.view.conditions.find((c) => !parent.view.conditions.some((p) => p.id === c.id && p.value === c.value)) ?? null;
  const gone = parent.view.conditions.find((p) => !step.view.conditions.some((c) => c.id === p.id && c.value === p.value)) ?? null;
  let title;
  if (step.kind === 'order') title = BR_COPY.bannerOrder(step.view.order);
  else if (step.kind === 'group') title = BR_COPY.bannerGroup(step.view.group);
  else if (added && gone) title = BR_COPY.bannerReplaced(conditionWords(added), conditionWords(gone));
  else if (added) title = BR_COPY.bannerAdded(conditionWords(added));
  else if (gone) title = BR_COPY.bannerRemoved(conditionWords(gone));
  else title = BR_COPY.bannerNoMove;
  const o = step.outcome;
  // The note line's total — every name in the group, Not ranked included (refuter RF-7).
  const total = groupCount(o);
  const parts = [];
  if (step.kind === 'order') {
    // Which names came and went, and where (refuter RF-2, BR2-3): an order switch moves names between the
    // placed list, Not assessed (no usable move) and Not ranked (not in the rankings) — it never says
    // "the names are the same" when they are not.
    const wasPlaced = new Set(parent.outcome.placed.map((p) => p.symbol));
    const nowPlaced = new Set(o.placed.map((p) => p.symbol));
    const wasUnranked = new Set(parent.outcome.unranked.map((x) => x.symbol));
    const asideNow = new Set(o.notAssessed.map((x) => x.symbol));
    const unrankedNow = new Set(o.unranked.map((x) => x.symbol));
    const left = [...wasPlaced].filter((s) => !nowPlaced.has(s));
    const came = o.placed.map((p) => p.symbol).filter((s) => !wasPlaced.has(s));
    parts.push(BR_COPY.bannerOrderChanges({
      setAside: left.filter((s) => asideNow.has(s)).length,
      toUnranked: left.filter((s) => unrankedNow.has(s)).length,
      back: came.filter((s) => !wasUnranked.has(s)).length,
      fromUnranked: came.filter((s) => wasUnranked.has(s)).length,
    }));
  } else if (step.kind === 'group') {
    parts.push(BR_COPY.bannerLeft(o.placed.length, total));
  } else {
    const parentPlaced = parent.outcome.placed.map((p) => p.symbol);
    const was = new Map(parent.outcome.placed.map((p) => [p.symbol, p.position]));
    const nowPlaced = new Set(o.placed.map((p) => p.symbol));
    const removedSet = new Set(o.removed.map((r) => r.symbol));
    const asideSet = new Set(o.notAssessed.map((r) => r.symbol));
    const removedNow = parentPlaced.filter((s) => !nowPlaced.has(s) && removedSet.has(s));
    const asideNow = parentPlaced.filter((s) => !nowPlaced.has(s) && asideSet.has(s));
    const back = o.placed.filter((p) => !was.has(p.symbol)).map((p) => p.symbol);
    parts.push(BR_COPY.bannerLeft(o.placed.length, total));
    if (removedNow.length || asideNow.length || back.length) parts.push(BR_COPY.bannerCounts(removedNow.length, asideNow.length, back.length));
    const moved = o.placed.filter((p) => was.has(p.symbol) && was.get(p.symbol) !== p.position);
    if (moved.length) {
      const m = moved[0];
      const before = was.get(m.symbol);
      const measure = step.view.order.measure === 'today_move' ? BR_COPY.measureMove : BR_COPY.measureRank;
      if (m.position < before) {
        // Count exactly the names that were above it and are gone, by why they went.
        const above = parentPlaced.slice(0, before - 1);
        parts.push(BR_COPY.bannerMovedUp(m.symbol, m.position, before, above.filter((s) => removedNow.includes(s)).length, above.filter((s) => asideNow.includes(s)).length, measure));
      } else {
        parts.push(BR_COPY.bannerMovedDown(m.symbol, m.position, before, o.placed.slice(0, m.position - 1).filter((p) => back.includes(p.symbol)).length, measure));
      }
      if (moved.length > 1) parts.push(BR_COPY.bannerMovedMore(moved.length - 1));
    } else parts.push(BR_COPY.bannerNoMove);
  }
  parts.push(end);
  return { title, body: parts.join(' ') };
}

// ── The modal's research context (BRS-17, BRS-18, BRS-18a; §8) ──

/** The question's own measure on a row, with its time: rank, or today's move. */
function measureTextOf(result, view, symbol) {
  if (view.order.measure === 'today_move') return result.quotes.rows[symbol]?.words ?? null;
  return rankText(result, symbol);
}

/**
 * *For this question* (BRS-17 item 2): its place and measure, one line for it, one against —
 * each omitted when the evidence has none. And the finding (item 3): today's move with its basis
 * and time, offering *Use across this result* with the condition its own move matches (BRS-18a).
 */
export function researchRowOf(inv, result, step, symbol, { nowMs = null } = {}) {
  const { view, outcome } = step;
  const placed = outcome.placed.find((p) => p.symbol === symbol) ?? null;
  const removed = outcome.removed.find((r) => r.symbol === symbol) ?? null;
  const na = outcome.notAssessed.find((r) => r.symbol === symbol) ?? null;
  const unr = outcome.unranked.find((r) => r.symbol === symbol) ?? null;
  const measureText = measureTextOf(result, view, symbol);
  const where = removed ? `${BR_COPY.removedBy} (${removed.by.map((id) => conditionWords(id === 'sector' ? view.conditions.find((c) => c.id === 'sector') : { id })).join(', ')})`
    : na ? `${BR_COPY.notAssessed} (${notAssessedWords(result, na)})`
      : unr ? (unr.reason === 'crypto' ? BR_COPY.notRankedCrypto : BR_COPY.notRankedMissing) : null;
  const inc = result.incumbent;
  let support = null;
  let against = null;
  const r = rankOf(result, symbol)?.technicalRank;
  const ri = inc ? rankOf(result, inc.symbol)?.technicalRank : null;
  const m = moveOf(result, symbol);
  const mi = inc ? moveOf(result, inc.symbol) : null;
  const ranksAt = ranksAtWords(result);
  const rankWhen = ranksAt ? ` (ranks as of ${ranksAt})` : ' (rank time not recorded)';
  if (inc && Number.isInteger(r) && Number.isInteger(ri)) {
    if (r < ri) support = `Higher technical rank than ${inc.symbol}: ${r} against ${ri} of ${result.rankings.totalTechStocks}${rankWhen}.`;
    else against = `Lower technical rank than ${inc.symbol}: ${r} against ${ri} of ${result.rankings.totalTechStocks}${rankWhen}.`;
  } else if (!inc && Number.isInteger(r) && placed) {
    support = placed.position === 1 ? `Leads this result on ${view.order.measure === 'today_move' ? 'today’s move' : 'technical rank'}.` : null;
  }
  if (inc && m.ok && mi?.ok && m.value !== mi.value) {
    const line = `Today ${moveText(m.raw)} against ${inc.symbol}’s ${moveText(mi.raw)} (as of ${quotesWhen(result, [symbol, inc.symbol])}).`;
    if (m.value > mi.value && !support) support = line;
    else if (m.value < mi.value && !against) against = line;
  }
  const member = result.membership.find((x) => x.symbol === symbol);
  if (!against && member && !member.eligibility.ok) against = `${eligibilityLabel(member.eligibility, result.takenAt, serverNowOf(result, nowMs)).text}.`;
  // The finding: today's move, its basis and time; Use across only for up/down and only when not already active.
  const q = result.quotes.rows[symbol];
  let finding = null;
  if (q) {
    const matches = m.ok ? (m.value > 0 ? 'up_today' : m.value < 0 ? 'down_today' : null) : null;
    const active = view.conditions.some((c) => c.id === matches);
    finding = {
      text: m.ok ? BR_COPY.findingMove(moveText(m.raw), etClockAmPm(q.priceAsOf)) : BR_COPY.findingNoMove(q.words),
      conditionId: matches && !active ? matches : null,
      replaces: matches && !active ? (view.conditions.find((c) => c.id === (matches === 'up_today' ? 'down_today' : 'up_today'))?.id ?? null) : null,
    };
  }
  return {
    symbol,
    position: placed ? placed.position : null,
    placed: !!placed,
    of: outcome.placed.length,
    measureText: placed ? BR_COPY.placed(placed.position, outcome.placed.length, measureText ?? orderLabel(view.order)) : BR_COPY.notPlaced(where ?? BR_COPY.notAssessed),
    support,
    against,
    finding,
  };
}

/** The candidate's standing against ONE holding, for the evidence sentence (a lock names its time — review BR2-2). */
function evidenceElig(result, elig, nowMs) {
  if (!elig) return '';
  if (elig.ok) return BR_COPY.evidenceNow;
  if (elig.reason === 'pick_locked' && finite(elig.lockedUntil)) {
    const passed = finite(nowMs) && nowMs >= elig.lockedUntil;
    return passed ? BR_COPY.evidenceCant(BR_COPY.lockedPassed(untilText(elig.lockedUntil, result.takenAt)).toLowerCase()) : BR_COPY.evidenceLocked(untilText(elig.lockedUntil, result.takenAt));
  }
  return BR_COPY.evidenceCant(eligibilityWhy(elig.reason));
}

/**
 * BRS-18 — the comparison's rows, the candidate against the holding (the incumbent or a held
 * measured stock the player picked — the result's FROZEN holding and the candidate's eligibility
 * against IT), in the spec's order; each cell its reading with its time, or absent. The holding alone
 * gets the lock line (the scorer's own number at the last check).
 */
export function compareOf(result, view, symbol, holding, battle, { nowMs = null } = {}) {
  if (!holding) return null;
  const cell = (s) => ({
    measure: measureTextOf(result, view, s),
    rank: rankText(result, s),
    move: result.quotes.rows[s]?.words ?? null,
  });
  const c = cell(symbol);
  const h = cell(holding.symbol);
  const member = result.membership.find((x) => x.symbol === symbol);
  const elig = eligibilityVs(member, holding.symbol);
  // Row 1 is the question's own measure; the row it repeats (rank, or today's move) is not printed twice.
  const byMove = view.order.measure === 'today_move';
  const rows = [
    { key: 'measure', label: BR_COPY.compareRowMeasure, cand: c.measure, held: h.measure },
    { key: 'rank', label: BR_COPY.compareRowRank, cand: c.rank, held: h.rank, repeats: !byMove },
    { key: 'move', label: BR_COPY.compareRowMove, cand: c.move, held: h.move, repeats: byMove },
    { key: 'rung', label: BR_COPY.compareRowRung, cand: rungText(result, symbol), held: holdingRungText(result, holding) },
    {
      key: 'stands', label: BR_COPY.compareRowStands,
      cand: elig ? eligibilityLabel(elig, result.takenAt, serverNowOf(result, nowMs)).text : null,
      held: finite(holding.rungsShown) && finite(holding.checkAtMs) ? BR_COPY.compareHoldingStands(rungsText(holding.rungsShown), checkWhen(holding.checkAtMs, result.takenAt)) : null,
    },
    { key: 'sector', label: BR_COPY.compareRowSector, cand: sectorOf(result, symbol), held: sectorOf(result, holding.symbol) },
  ].filter((r) => !r.repeats && (r.cand || r.held)).map(({ repeats, ...r }) => r); // eslint-disable-line no-unused-vars
  const lock = holding.lockNow && finite(holding.lockNow.total) && finite(holding.lockNow.atMs)
    ? BR_COPY.compareLock(holding.symbol, checkWhen(holding.lockNow.atMs, result.takenAt), Math.round(holding.lockNow.total)) : null;
  // The tradeoff and what the evidence supports — only from rows where BOTH have a reading.
  const r = rankOf(result, symbol)?.technicalRank;
  const rh = rankOf(result, holding.symbol)?.technicalRank;
  const m = moveOf(result, symbol);
  const mh = moveOf(result, holding.symbol);
  const candWins = [];
  const heldWins = [];
  const measures = [];
  let shared = 0;
  if (Number.isInteger(r) && Number.isInteger(rh)) {
    shared += 1;
    if (r < rh) { candWins.push(BR_COPY.tradeoffRank(holding.symbol)); measures.push(BR_COPY.measuresRank); } else heldWins.push(BR_COPY.tradeoffRank(symbol));
  }
  if (m.ok && mh.ok) {
    shared += 1;
    if (m.value > mh.value) { candWins.push(BR_COPY.tradeoffMove(aheadWords(m.value, mh.value, holding.symbol))); measures.push(BR_COPY.measuresMove); } else if (mh.value > m.value) heldWins.push(BR_COPY.tradeoffMove(aheadWords(mh.value, m.value, symbol)));
  }
  const e = evidenceElig(result, elig, serverNowOf(result, nowMs));
  return {
    holding: holding.symbol,
    rows,
    lock,
    tradeoff: candWins.length || heldWins.length ? BR_COPY.tradeoff(symbol, holding.symbol, candWins, heldWins) : null,
    // No shared reading: say so, never a verdict from nothing (review BR2-11).
    evidence: shared ? BR_COPY.evidence(measures, symbol, holding.symbol, e) : BR_COPY.evidenceNone(symbol, holding.symbol, e),
    name: companyNameOf(battle, holding.symbol),
  };
}

// ── The draft (BRS-19) and the Ask about the result (BRS-20) ──

/** The header lines every draft carries: the question with the result's time, then the refinements and the order. */
function draftHead(inv, result, step) {
  const question = inv.question.id === 'weakest_alternatives' && result.incumbent ? BR_COPY.titleWeakest(result.incumbent.symbol) : inv.question.text;
  const lines = [BR_COPY.draftHead(question, etClockAmPm(result.takenAt))];
  const then = [];
  for (const c of step.view.conditions) then.push(conditionWords(c));
  const def = step.view.order.measure === 'technical_rank' ? null : step.view.order;
  if (def) then.push(orderLabel(def) === "Today's move, biggest gain first" ? "ordered by today's move" : `ordered by ${orderLabel(def).toLowerCase()}`);
  if (step.view.group !== 'union' && step.view.group !== (inv.question.id === 'rank_bench' ? 'bench' : inv.question.id === 'rank_agent_watchlist' ? 'agent_watchlist' : null)) then.push(`on ${GROUP_LABEL[step.view.group].toLowerCase()}`);
  if (then.length) lines.push(BR_COPY.draftThen(then));
  return lines;
}

/**
 * Fit the variants under a length (review BR2-8): the first that fits; the last variant is the
 * shortest WHOLE-LINE draft (the head and the closing question). If even that doesn't fit, '' — a
 * draft is never cut mid-reading, and the caller keeps what the player typed.
 */
export function fitDraft(variants, maxLength = CHAT_MAX_LENGTH) {
  return variants.find((v) => v.length <= maxLength) ?? '';
}

/**
 * BRS-19 — the draft for one candidate against the comparison holding (or none): the question, the
 * refinements and the order, both names' frozen readings WITH their times (rank, today's move, rung,
 * sector, where each stands), the closing question. A reading the result doesn't have is left out.
 * Returns { text, variants } — variants in the trim order (the sector line first, then the rung line,
 * then every reading line), so a caller that knows the room left picks the first that fits (fitDraft).
 */
export function draftOf(inv, result, step, symbol, holding = null, { nowMs = null } = {}) {
  const head = draftHead(inv, result, step);
  const h = holding?.symbol ?? null;
  const names = h ? [symbol, h] : [symbol];
  const ranksAt = ranksAtWords(result);
  const N = result.rankings.totalTechStocks;
  // The first rank printed carries "of N" (review BR2-15).
  let ofDone = false;
  const rankParts = names.map((s) => {
    const r = rankOf(result, s)?.technicalRank;
    if (!Number.isInteger(r)) return null;
    const txt = ofDone ? `${r}` : `${r} of ${N}`;
    ofDone = true;
    return h ? `${s} ${txt}` : txt;
  }).filter(Boolean);
  const okMoves = names.filter((s) => moveOf(result, s).ok);
  const moveParts = okMoves.map((s) => (h ? `${s} ${moveText(moveOf(result, s).raw)}` : moveText(moveOf(result, s).raw)));
  const asOf = okMoves.map((s) => result.quotes.rows[s].priceAsOf);
  const rungParts = [];
  const cr = rungEstimateOf(result, symbol);
  if (cr) { const est = BR_COPY.rungEstimateShort(atrReadingText(cr.pct), atrAsOfText(cr.asOfMs, result.takenAt)); rungParts.push(h ? `${symbol} ${est}` : est); }
  if (holding && result.measured && finite(holding.scoringPct)) rungParts.push(`${h} ${BR_COPY.rungFixedShort(atrReadingText(holding.scoringPct))}`);
  const sectorParts = names.map((s) => { const sec = sectorOf(result, s); return sec ? (h ? `${s} ${sec}` : sec) : null; }).filter(Boolean);
  const member = result.membership.find((x) => x.symbol === symbol);
  const elig = eligibilityVs(member, h);
  const stands = [];
  if (elig) {
    if (elig.ok) stands.push(BR_COPY.draftCandNow(symbol));
    else if (elig.reason === 'pick_locked' && finite(elig.lockedUntil)) {
      const t = untilText(elig.lockedUntil, result.takenAt);
      const sNow = serverNowOf(result, nowMs);
      stands.push(finite(sNow) && sNow >= elig.lockedUntil ? `${symbol}: ${BR_COPY.lockedPassed(t).toLowerCase()}.` : BR_COPY.draftCandLocked(symbol, t));
    } else stands.push(BR_COPY.draftCandCant(symbol, eligibilityWhy(elig.reason)));
  }
  if (holding && finite(holding.rungsShown) && finite(holding.checkAtMs)) stands.push(BR_COPY.draftHoldingStands(h, rungsText(holding.rungsShown), checkWhen(holding.checkAtMs, result.takenAt)));
  const rankLine = rankParts.length && ranksAt ? BR_COPY.draftRank(rankParts, ranksAt) : null;
  const moveLine = moveParts.length ? BR_COPY.draftMove(moveParts, etClockAmPm(Math.min(...asOf)), etClockAmPm(Math.max(...asOf))) : null;
  const rungLine = rungParts.length ? BR_COPY.draftRung(rungParts) : null;
  const sectorLine = sectorParts.length ? BR_COPY.draftSector(sectorParts) : null;
  const standsLine = stands.length ? BR_COPY.draftStands(stands) : null;
  const build = ({ sector = true, rung = true, readings = true } = {}) => [
    ...head,
    BR_COPY.draftVs(symbol, h),
    readings ? rankLine : null, readings ? moveLine : null, readings && rung ? rungLine : null, readings && sector ? sectorLine : null, readings ? standsLine : null,
    BR_COPY.draftClose(symbol, h),
  ].filter(Boolean).join('\n');
  const variants = [build(), build({ sector: false }), build({ sector: false, rung: false }), build({ readings: false })];
  return { text: fitDraft(variants), variants };
}

/**
 * BRS-20 — the Ask about the result: the same header lines, the readings' times, then one line per
 * TOP name — the first three PLACED names of the current refined result (never one left out, not
 * assessed or not ranked) — ending *What do you make of these?*
 */
export function askDraftOf(inv, result, step, { nowMs = null } = {}) {
  const head = draftHead(inv, result, step);
  const t = timesOf(result);
  const top = step.outcome.placed.slice(0, 3).map((p) => p.symbol);
  const line = (s) => {
    const parts = [s];
    const r = rankOf(result, s)?.technicalRank;
    // A rank prints only with its time (the time line above names it); none recorded, no rank (refuter BR2-7/14).
    if (Number.isInteger(r) && t.ranksAt) parts.push(`rank ${r}`);
    const m = moveOf(result, s);
    if (m.ok) parts.push(moveText(m.raw));
    const member = result.membership.find((x) => x.symbol === s);
    if (member) { const e = eligibilityLabel(member.eligibility, result.takenAt, serverNowOf(result, nowMs)).text; parts.push(e.charAt(0).toLowerCase() + e.slice(1)); }
    return BR_COPY.askLine(parts);
  };
  const timeLine = BR_COPY.askTimes(t.ranksAt ? `${t.ranksAt}${t.ranksOlder ? ' (older than usual)' : ''}` : null, t.movesFrom, t.movesTo);
  const body = [timeLine ? `(${timeLine})` : null, top.length ? BR_COPY.askTop : null, ...top.map(line)].filter(Boolean);
  const text = [...head, ...body, BR_COPY.askClose].join('\n');
  const variants = [text, [...head, BR_COPY.askClose].join('\n')];
  return { text: fitDraft(variants), variants, top };
}

export { conditionLabel, holdingEntryOfResult };
