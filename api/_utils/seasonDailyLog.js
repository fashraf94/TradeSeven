/**
 * Season Daily Log Builder
 *
 * Assembles the per-entry, per-day transparency document written to
 * `seasonEntries/{entryId}/dailyLogs/{tradingDay}`. Captures every rule
 * evaluation, every vote, every filter result, and every trade executed
 * on a given trading day.
 *
 * Pure function — no Firestore access. Consumers (crons) pass in the
 * EvaluationContext, the PipelineResult, and the SettlementResult; they
 * receive the finished log document ready to write.
 *
 * The document is written once per entry per day and treated as read-only
 * after creation. It is read by users reviewing historical daily activity.
 */

// ─── Main Export ──────────────────────────────────────────────

/**
 * Builds a daily log document from pipeline and settlement results.
 *
 * @param {Object} ctx - EvaluationContext (from seasonEvalContext.js)
 * @param {Object} pipelineResult - Output from executePipeline()
 * @param {Object} settlementResult - Output from settleDay()
 * @returns {Object} Daily log document for the dailyLogs subcollection
 */
export function buildDailyLog(ctx, pipelineResult, settlementResult) {
  const strategyMods = [...(pipelineResult?.strategyOverrides?.activeModReasons || [])];

  const exitEvaluations = transformExitEvaluations(
    pipelineResult?.exitActions?.evaluations,
    pipelineResult?.exitActions?.sells,
  );

  const rebalanceEvaluations = [...(pipelineResult?.rebalanceActions?.evaluations || [])];

  const entryScan = {
    triggered: !pipelineResult?.entryActions?.blocked,
    blocked: !!pipelineResult?.entryActions?.blocked,
    blockReason: pipelineResult?.entryActions?.reason ?? null,
    cashAvailable: computeCashAvailable(ctx?.portfolio?.cash, settlementResult?.trades),
    candidatesEvaluated: pipelineResult?.entryActions?.candidatesEvaluated ?? 0,
    candidatesPassed: pipelineResult?.entryActions?.candidatesPassed ?? 0,
    filterResults: transformFilterResults(pipelineResult?.entryActions?.filterResults),
    selected: extractSelected(settlementResult?.trades),
  };

  const trades = [...(settlementResult?.trades || [])];
  const endOfDayPortfolio = buildEndOfDayPortfolio(settlementResult?.portfolio);

  return {
    day: ctx?.tradingDay ?? 0,
    date: ctx?.today ?? null,
    strategyMods,
    exitEvaluations,
    rebalanceEvaluations,
    entryScan,
    trades,
    endOfDayPortfolio,
    haikuCalls: [],
    createdAt: Date.now(),
  };
}

// ─── Internal Helpers ─────────────────────────────────────────

/**
 * Transforms exit evaluations from { [ticker]: votes[] } into a per-ticker
 * array with final decision, trigger rule, and vote counts.
 *
 * Every ticker that appears in `sells` is present in the evaluations map,
 * so a single Map lookup on `sells` is enough to derive finalDecision and
 * the triggering rule. Whether the sell came from a hard override or a soft
 * majority is already baked into `sells`; we don't re-run resolution here.
 */
function transformExitEvaluations(evaluationsByTicker, sells) {
  if (!evaluationsByTicker) return [];

  const sellByTicker = new Map();
  for (const s of (sells || [])) {
    if (s?.ticker) sellByTicker.set(s.ticker, s);
  }

  const out = [];
  for (const [ticker, votes] of Object.entries(evaluationsByTicker)) {
    const voteList = Array.isArray(votes) ? votes : [];
    const sellRec = sellByTicker.get(ticker) || null;

    let sellCount = 0;
    let holdCount = 0;
    for (const v of voteList) {
      if (v?.action === 'SELL') sellCount++;
      else if (v?.action === 'HOLD') holdCount++;
    }

    out.push({
      ticker,
      results: voteList.map(v => ({
        ruleId: v?.ruleId ?? null,
        action: v?.action ?? null,
        priority: v?.priority ?? null,
        reason: v?.reason ?? null,
      })),
      finalDecision: sellRec ? 'SELL' : 'HOLD',
      trigger: sellRec?.triggerRule ?? null,
      votes: { sell: sellCount, hold: holdCount },
    });
  }
  return out;
}

/**
 * Transforms filter results from { [ticker]: {results, passed, score} } into
 * an array capped at ~10 entries. Includes all passing candidates (sorted by
 * score desc), then fills remaining slots with the top narrowly-failing
 * candidates (sorted by number of passed rules desc).
 *
 * Note: `shortlistBonus` is NOT populated here because the pipeline only
 * attaches it to `entryActions.buys`. Consumers that need it can join against
 * the buys list separately.
 */
function transformFilterResults(byTicker, { maxResults = 10 } = {}) {
  if (!byTicker) return [];

  const rows = Object.entries(byTicker).map(([ticker, fr]) => {
    const results = Array.isArray(fr?.results) ? fr.results : [];
    const passedCount = results.filter(r => r?.pass).length;
    return {
      ticker,
      results,
      passedAll: !!fr?.passed,
      passedCount,
      score: fr?.score ?? null,
    };
  });

  const passing = rows
    .filter(r => r.passedAll)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (passing.length >= maxResults) {
    return passing.slice(0, maxResults).map(stripInternal);
  }

  const slotsLeft = maxResults - passing.length;
  const failing = rows
    .filter(r => !r.passedAll)
    .sort((a, b) => b.passedCount - a.passedCount)
    .slice(0, slotsLeft);

  return [...passing, ...failing].map(stripInternal);
}

/**
 * Strips the internal `passedCount` helper field from a filter row so the
 * returned shape matches the spec: { ticker, results, passedAll, score }.
 */
function stripInternal({ passedCount, ...rest }) {
  return rest;
}

/**
 * Extracts buy trades from the settlement trade list into a compact
 * "selected" array for the entry scan section.
 */
function extractSelected(trades) {
  if (!Array.isArray(trades)) return [];
  return trades
    .filter(t => t?.type === 'BUY')
    .map(t => ({
      ticker: t.ticker,
      weight: t.weight ?? null,
      entryPrice: t.price ?? null,
      reason: t.reason ?? null,
    }));
}

/**
 * Computes the cash available to the entry scan phase. Mirrors how
 * seasonPipeline.js derives `availableCash`: pre-trade cash plus SELL
 * proceeds (since sells run before buys in settlement order).
 */
function computeCashAvailable(ctxCash, trades) {
  const base = ctxCash ?? 0;
  if (!Array.isArray(trades)) return base;
  let sellProceeds = 0;
  for (const t of trades) {
    if (t?.type === 'SELL') sellProceeds += t.value || 0;
  }
  return base + sellProceeds;
}

/**
 * Builds the end-of-day portfolio summary from the settlement's portfolio
 * snapshot. Kept minimal — callers wanting full position detail can read
 * the entry doc directly.
 */
function buildEndOfDayPortfolio(portfolio) {
  if (!portfolio) {
    return { totalValue: 0, totalReturn: 0, cashPct: 0, positionCount: 0 };
  }
  return {
    totalValue: portfolio.totalValue ?? 0,
    totalReturn: portfolio.totalReturn ?? 0,
    cashPct: portfolio.cashPct ?? 0,
    positionCount: portfolio.positionCount ?? 0,
  };
}
