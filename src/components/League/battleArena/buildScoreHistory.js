// src/components/League/battleArena/buildScoreHistory.js
//
// League Score History — THE recap bridge (pure + node-clean; its co-located
// test's import IS the dependency-surface guard). Given a completed-or-live
// group + the caller's OWN daily-chained agentBattles docs, it assembles the two
// pieces this arc ships:
//
//   • Level 1 — the per-day COMPOSITE timeline for YOU. A pure read of
//     dailyScores.dayN.closeScores[uid].compositePoints via buildClimbSeries
//     (the SAME series the climb is drawn from; never re-summed across days).
//     Survives the bank by definition — it is a read over banked snapshots.
//
//   • Swaps — the per-day agent SWAP ledger across the whole battle. Today's
//     code fetches every day's agentBattles doc then discards all but the
//     current one (pickCurrentTournamentBattle); this stops discarding and walks
//     the chain. Each day's subtotal comes through buildSwapLedger, so the
//     CURRENT day's subtotal equals the live strip's SWAPS term by construction
//     (BUILD_RULES §9). No new persistence.
//
// HONESTY (the spec's honesty requirement): per-symbol agent BASE for a prior
// day is NOT persisted (aggregate only) and cannot be recovered without a
// forbidden OHLCV refetch — so this module never fabricates it. `baseUnavailable`
// carries that fact to the view, which labels it rather than approximating.

import { buildClimbSeries, climbSeriesPhase } from '../leagueClimbAdapter';
import { pickCurrentTournamentBattle } from '../../../constants/leagueTournament';
import { buildSwapLedger } from './leagueSwapLedger';

/** Ascending day numbers from a group's dailyScores keys (day1, day2, …). */
function ascendingDayNumbers(group) {
  const ds = group?.dailyScores || {};
  return Object.keys(ds)
    .map((k) => /^day(\d+)$/.exec(k))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

/**
 * ET-recordedDate → tournament dayN, from the group's dailyScores. This is what
 * lets the swap ledger share the SAME day axis as the Level 1 timeline: both key
 * off the group's banked dayN, not a parallel chain ordinal. Each banked day
 * entry carries recordedDate (the ET trading date, tournamentBanking.js), and
 * each daily agentBattles doc carries timing.tradingDays (its ET trading date),
 * so a doc maps to its banked dayN by date.
 */
function recordedDateToDay(group) {
  const ds = group?.dailyScores || {};
  const out = {};
  for (const key of Object.keys(ds)) {
    const m = /^day(\d+)$/.exec(key);
    const rd = ds[key]?.recordedDate;
    if (m && typeof rd === 'string' && rd) out[rd] = Number(m[1]);
  }
  return out;
}

/** A daily agentBattles doc's ET trading date (the day it closed). */
function docTradingDate(doc) {
  const td = doc?.timing?.tradingDays;
  return Array.isArray(td) && td.length ? td[td.length - 1] : null;
}

/**
 * Assemble the Level 1 timeline + swap ledger for one player.
 *
 * @param {Object} args
 * @param {Object} args.group        a tournamentGroups doc (dailyScores, status, players)
 * @param {Object[]} args.battleChain the caller's OWN daily-chained agentBattles docs
 * @param {string} args.uid          the caller's odUserId
 * @returns {{
 *   phase: 'awaiting'|'live'|'complete',
 *   timeline: Array<{ day:number|null, composite:number, delta:number|null }>,
 *   swapDays: Array<{ day:number, isCurrent:boolean, items:Object[], subtotal:number }>,
 *   swapTotal: number,
 *   currentSwapSubtotal: number,
 *   swapCount: number,
 *   baseUnavailable: true
 * }}
 */
export function buildScoreHistory({ group = null, battleChain = [], uid = null } = {}) {
  // ── Level 1: the per-day composite timeline (REUSE buildClimbSeries) ──
  const series = (uid && buildClimbSeries(group, { metric: 'composite' })[uid]) || [];
  const dayNums = ascendingDayNumbers(group);
  const timeline = series.map((composite, i) => ({
    day: Number.isFinite(dayNums[i]) ? dayNums[i] : null,
    composite,
    delta: i > 0 ? composite - series[i - 1] : null,
  }));

  // ── Swaps: walk the WHOLE chain (not just the current day). Order by createdAt
  //    (daily docs are created in trading-day order; ISO strings compare
  //    chronologically), assign a 1-based battle-day label, then keep only days
  //    that actually had a swap. The current doc — the SAME one the live strip
  //    reads — is picked via pickCurrentTournamentBattle so its subtotal
  //    reconciles with the strip's SWAPS term (§9). ──
  const chain = (battleChain || []).filter(Boolean);
  const ordered = [...chain].sort(
    (a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')),
  );
  const current = pickCurrentTournamentBattle(chain);
  const currentId = current?.id ?? null;
  // Day labels come from the group's banked dayN (via recordedDate), so the swap
  // ledger and the Level 1 timeline never print two different DAY numbers for the
  // same day. Only when a doc can't be mapped (a chain gap / an unstamped doc —
  // the rare degrade) do we fall back to the createdAt-ordered position.
  const dateToDay = recordedDateToDay(group);
  const swapDays = ordered
    .map((doc, i) => {
      const ledger = buildSwapLedger(doc?.trades);
      const mapped = dateToDay[docTradingDate(doc)];
      return {
        day: Number.isFinite(mapped) ? mapped : i + 1,
        dayIsOrdinalFallback: !Number.isFinite(mapped),
        isCurrent: currentId != null && doc?.id === currentId,
        items: ledger.items,
        subtotal: ledger.total,
      };
    })
    .filter((d) => d.items.length > 0);
  const swapTotal = swapDays.reduce((a, d) => a + d.subtotal, 0);
  const swapCount = swapDays.reduce((a, d) => a + d.items.length, 0);
  // The current-day subtotal is read from the SAME doc the strip reads (not from
  // swapDays, which may have filtered a zero-swap current day) — one source.
  const currentSwapSubtotal = buildSwapLedger(current?.trades).total;

  return {
    phase: climbSeriesPhase(group),
    timeline,
    swapDays,
    swapTotal,
    currentSwapSubtotal,
    swapCount,
    // Per-symbol agent base for prior days is not persisted (aggregate only);
    // the view labels this rather than approximating (spec honesty requirement).
    baseUnavailable: true,
  };
}
