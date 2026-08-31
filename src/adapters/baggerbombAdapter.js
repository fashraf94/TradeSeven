/**
 * BaggerBomb state adapter — v1 (Command Center Sync, Pass 1).
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE (framework §3, spec §5 rule 1):
 * shell components read battle state ONLY through an adapter. No Dashboard
 * component reads `agentBattles`, `voiceLayerCache`, or `agents` document
 * fields directly. Only the BaggerBomb adapter exists today; the abstraction
 * is validated when the league adapter maps into it (Pass 3), so the schema
 * is PROVISIONAL (framework §3.2) and every consumer must treat a field it
 * does not need as optional.
 *
 * PURE. No fetching, no clock, no I/O. The App-level 120s poll fetches, calls
 * getMarketState() once per cycle, and passes both in. `now` and `marketState`
 * are parameters precisely so the phase matrix is testable against fixtures —
 * src/utils/marketSchedule.js's getMarketState() is zero-arity and reads the
 * wall clock, so injecting its RESULT is what makes weekend / holiday /
 * early-close cases reachable in a test without mocking the module
 * (PASS1_PHASE0_STOP_RULINGS_AND_GO.md §3).
 *
 * All timestamps are normalized to ISO strings at this boundary. The battle
 * doc uses ISO strings; the voiceLayerCache doc's `updatedAt` is a Firestore
 * serverTimestamp (api/cron/voice-layer-cache.js:816). Consumers should never
 * have to know which is which.
 */

export const PHASE = Object.freeze({
  PRE_OPEN: 'PRE_OPEN',
  LIVE: 'LIVE',
  LIVE_CLOSED: 'LIVE_CLOSED',
  POST_CLOSE: 'POST_CLOSE',
});

/** Eval cadence, mirroring agentContext.evaluationInterval (15 min, RTH). */
const EVAL_INTERVAL_MS = 15 * 60 * 1000;

/** How stale the proximity cache may be during LIVE before we stop showing it. */
export const PROXIMITY_STALE_MS = 30 * 60 * 1000;

/** How many proximity rows the Desk shows (spec §8). */
const PROXIMITY_LIMIT = 3;

/**
 * Normalize the Firestore-Timestamp / ISO-string / Date / epoch union to an
 * ISO string. Mirrors the precedent at api/agent/chat.js:115-119.
 * @returns {string|null}
 */
export function toIso(raw) {
  if (raw == null) return null;
  let ms = null;
  if (typeof raw === 'string') {
    const parsed = new Date(raw).getTime();
    ms = Number.isNaN(parsed) ? null : parsed;
  } else if (raw instanceof Date) {
    ms = raw.getTime();
  } else if (typeof raw === 'number') {
    ms = raw;
  } else if (typeof raw.toMillis === 'function') {
    ms = raw.toMillis();
  } else if (typeof raw.seconds === 'number') {
    ms = raw.seconds * 1000;
  }
  if (ms == null || Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function toMillis(raw) {
  const iso = toIso(raw);
  return iso == null ? null : new Date(iso).getTime();
}

/**
 * Derive the phase (framework §4). Never stored — always derived.
 *
 * PRE_OPEN's marker is `scoreState.evaluationCount`, NOT a statusFeed entry.
 * The spec originally said "first statusFeed eval entry", but no eval-sourced
 * statusFeed entry exists: agent-evaluate.js writes eight `source:` values and
 * none marks an evaluation, and a quiet HOLD tick appends nothing at all. The
 * evaluation counter is written every cycle (agent-evaluate.js:2723), so it is
 * the honest marker (PASS1_PHASE0_STOP_RULINGS_AND_GO.md §7, framework C-3).
 */
export function derivePhase(battle, marketState) {
  if (battle?.status === 'completed') return PHASE.POST_CLOSE;
  if (marketState?.state === 'OPEN') return PHASE.LIVE;

  const evaluationCount = battle?.scoreState?.evaluationCount;
  const lastScoredAt = battle?.scoreState?.lastScoredAt;
  const hasEvaluated = Boolean(evaluationCount) || lastScoredAt != null;
  return hasEvaluated ? PHASE.LIVE_CLOSED : PHASE.PRE_OPEN;
}

/**
 * Flatten the portfolio into a book. Crypto lives inside support[2], not as a
 * separate field (agentBattleService.js:39-40 note), so flattening the three
 * tiers covers it.
 *
 * `pnlPct` is deliberately ABSENT in v1: no live price reaches a pure adapter,
 * and the cache's `changePercent` is the feed's daily change, not P&L from
 * entry. Rendering one as the other is the display-disagreement bug class
 * (BUILD_RULES §9). It returns in Pass 2 with a sourced design.
 */
function buildBook(battle) {
  const portfolio = battle?.portfolio;
  if (!portfolio) return [];
  const startingPrices = portfolio.startingPrices || {};
  const activatedAt = toIso(battle.activatedAt);

  const tiers = [
    ['star', portfolio.star],
    ['core', portfolio.core],
    ['support', portfolio.support],
  ];

  const book = [];
  for (const [tier, positions] of tiers) {
    if (!Array.isArray(positions)) continue;
    for (const p of positions) {
      if (!p || !p.symbol) continue;
      book.push({
        symbol: p.symbol,
        tier,
        entry: p.swapPrice ?? startingPrices[p.symbol] ?? null,
        // A position that was never swapped carries no swappedInAt, so it has
        // been held since the battle activated.
        heldSince: toIso(p.swappedInAt) ?? activatedAt,
      });
    }
  }
  return book;
}

/**
 * Pull the proximity rows out of the cache doc.
 *
 * `thresholdProximity` is absent (not null) when baseATR <= 0 or the effective
 * threshold change is non-finite, and `redZone` inside it can be null when the
 * position is not approaching a scoring threshold. Either way the position is
 * simply omitted — never a placeholder row (spec §8 empty-state rule).
 */
function buildScoreProximity(portfolioBriefs) {
  if (!Array.isArray(portfolioBriefs)) return [];

  const rows = [];
  for (const brief of portfolioBriefs) {
    const tp = brief?.thresholdProximity;
    const redZone = tp?.redZone;
    if (!tp || !redZone) continue;
    if (typeof tp.currentMultiplier !== 'number' || !Number.isFinite(tp.currentMultiplier)) continue;
    if (typeof redZone.targetMultiple !== 'number') continue;

    rows.push({
      symbol: brief.symbol,
      currentMultiplier: tp.currentMultiplier,
      targetMultiple: redZone.targetMultiple,
      // The direction WORD comes from the data, never from sign math in the
      // UI (spec §8) — and note redZone.direction is the non-null one;
      // swapLock.direction may be null.
      direction: redZone.direction,
      zoneProgressPercent: redZone.zoneProgressPercent,
      distance: Math.abs(redZone.targetMultiple - tp.currentMultiplier),
    });
  }

  return rows
    .sort((a, b) => a.distance - b.distance)
    .slice(0, PROXIMITY_LIMIT);
}

/**
 * Locked positions only. `swapLock` is an OBJECT
 * ({locked, direction, distancePercent, message}) returned by
 * isSwapLocked(), not a boolean, and it is always present whenever
 * thresholdProximity is — so `locked === true` is the real filter.
 */
function buildSwapLock(portfolioBriefs) {
  if (!Array.isArray(portfolioBriefs)) return [];
  const rows = [];
  for (const brief of portfolioBriefs) {
    const lock = brief?.thresholdProximity?.swapLock;
    if (!lock || lock.locked !== true) continue;
    rows.push({
      symbol: brief.symbol,
      locked: true,
      direction: lock.direction ?? null,
      distancePercent: lock.distancePercent ?? null,
      message: lock.message ?? null,
    });
  }
  return rows;
}

/**
 * The most recent statusFeed entry, verbatim. No paraphrase (framework C1) —
 * the message is engine text and is carried through untouched.
 */
function buildStatusFeedLatest(battle) {
  const feed = battle?.statusFeed;
  if (!Array.isArray(feed) || feed.length === 0) return null;
  const latest = feed[feed.length - 1];
  if (!latest) return null;
  return {
    message: latest.message ?? null,
    timestamp: toIso(latest.timestamp),
    action: latest.action ?? latest.type ?? null,
  };
}

/**
 * When the agent next checks.
 *
 * During LIVE: last check + 15 min, unless that lands past the close, in which
 * case it is the next open. Off-hours: the next open. Evals are hard-gated to
 * RTH (agent-evaluate.js:284-286), so there is no honest intermediate answer.
 *
 * Returns null when nothing has been checked yet — the Desk renders
 * "First check coming up" rather than a fabricated time (spec §8).
 */
function deriveNextDecisionAt(phase, lastCheckedAt, marketState) {
  const nextOpen = toIso(marketState?.nextOpenTime);

  if (phase === PHASE.POST_CLOSE) return null;
  if (phase !== PHASE.LIVE) return nextOpen;

  const lastMs = toMillis(lastCheckedAt);
  if (lastMs == null) return null;

  const candidate = lastMs + EVAL_INTERVAL_MS;
  const closeMs = toMillis(marketState?.nextCloseTime);
  if (closeMs != null && candidate >= closeMs) return nextOpen;
  return new Date(candidate).toISOString();
}

/**
 * Build the adapter object.
 *
 * @param {object|null} battle   agentBattles doc ({id, ...data}) from the 120s poll
 * @param {object|null} voiceLayerCacheDoc  voiceLayerCache/{battleId} doc, or null
 * @param {object|null} agent    agents doc (for loadout)
 * @param {Date|string|number} now  injected clock — staleness is measured against it
 * @param {object|null} marketState result of getMarketState(), passed in by the caller
 * @returns {object|null} null when there is no battle to describe
 */
export function buildBaggerbombAdapter(battle, voiceLayerCacheDoc, agent, now, marketState) {
  if (!battle) return null;

  const phase = derivePhase(battle, marketState);
  const briefs = voiceLayerCacheDoc?.portfolioBriefs;

  // lastCheckedAt is the scoring stamp, written on every eval cycle
  // (agent-evaluate.js:881) — not a statusFeed timestamp, which only exists
  // for notable events and is absent on a quiet HOLD tick.
  const lastCheckedAt = toIso(battle?.scoreState?.lastScoredAt);

  const proximityAsOf = toIso(voiceLayerCacheDoc?.updatedAt);
  const nowMs = toMillis(now);
  const asOfMs = toMillis(proximityAsOf);

  // Staleness gates the LIVE phase ONLY. During open market, numbers computed
  // half an hour ago and presented as current are the lie. Once the market is
  // closed the prices are frozen with it, so the last computed proximity is
  // legitimately current-as-of-close — the as-of stamp carries the honesty
  // instead (PASS1_PHASE0_STOP_RULINGS_AND_GO.md §6).
  const proximityStale = phase === PHASE.LIVE
    && (asOfMs == null || nowMs == null || (nowMs - asOfMs) > PROXIMITY_STALE_MS);

  const scoreProximity = proximityStale ? [] : buildScoreProximity(briefs);
  const swapLock = proximityStale ? [] : buildSwapLock(briefs);

  return {
    game: {
      id: battle.id ?? null,
      type: 'baggerbomb',
      label: 'BaggerBomb',
    },

    phase,

    // Same derivation ManageStation.jsx:32-33 already uses, so the Desk and
    // the Manage rail cannot disagree about the score (BUILD_RULES §9).
    score: {
      current: battle?.scoreState?.currentScore ?? null,
      tradeCount: battle?.scoreState?.tradeCount ?? (battle?.trades?.length || 0),
    },

    book: buildBook(battle),
    scoreProximity,
    swapLock,

    lastCheckedAt,
    nextDecisionAt: deriveNextDecisionAt(phase, lastCheckedAt, marketState),

    // Whether the proximity block may render at all, and what it is current
    // as of. `proximityAsOf` is non-null even when stale so a caller can say
    // WHY it is withholding.
    proximityStale,
    proximityAsOf,

    statusFeedLatest: buildStatusFeedLatest(battle),

    loadout: {
      archetype: agent?.archetype ?? battle?.agentContext?.archetype ?? null,
      watchlistLabel: battle?.agentContext?.equippedWatchlist?.name ?? null,
      // Never was a stored field — EquipBench.jsx:88 and EquipStation.jsx:110
      // each derive it locally from the same expression. The adapter is the
      // third derivation site; Pass 2 can consolidate them.
      benchLocked: Boolean(agent?.activeBattleId),
    },
  };
}

export default buildBaggerbombAdapter;
