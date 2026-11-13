// src/components/Research/BombMode/selectBombRecord.js
//
// Research Modal Build A — THE RECORD SELECTOR (spec
// docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md §3.1–§3.4, §4.2).
//
// PURE: selectBombRecord(battle, symbol, nowMs) reads ONE agent-battle
// document the screen already holds and returns what Bomb mode draws for a
// position the PLAYER'S AGENT holds — or null (not held by the agent: the
// modal then draws a labelled preview, BA-1). No request, no store, no clock
// read (the caller hands `nowMs`). The battle screen calls it only when Bomb
// mode resolves on (§4.2).
//
// What it returns, by model:
//   measured (a stock on a stamped battle — the same test the screen's held
//     research uses, stockModelRoute(battle).status !== 'legacy' && isStock):
//     the rungs are NOT re-derived here — the modal's own `bombData.measured`
//     (AssetResearchModal.jsx :308–313, the committed context's exact targets
//     and crossed tiers) is the ladder (spec §3.1 "Reuse it"). The record adds
//     the entry instant (since BD-9, 2026-11-10: the fill quote's provider time,
//     `stockThresholdReceipt.fillQuote.quoteAsOf`; Build A read `enteredAt`),
//     the scored price below, and the levels table's Details facts (BD-6).
//   legacy: the three inputs of the server's rung-test baseline — swapPrice,
//     the activation-day starting price, and whether today IS the activation
//     day — plus the threshold the scorer divides by and today's high/low
//     multipliers. The precedence itself is applied ONCE, by the server's own
//     shared resolver (api/_utils/baselineValidation.js
//     resolveThresholdBaseline, which "Mirrors agent-evaluate.js's inline
//     precedence + Guard 2 exactly"), in ladder.js legacyLadder — never copied.
//     RULING 2026-11-07 (§0.4(a), rule (i)): the views draw NO held ladder for
//     a legacy record — bombView.buildLadder gives it the preview, said as
//     held. The record is still built here: it is what tells the views the
//     agent holds the name (and which position). legacyLadder is unreachable
//     from the views until the 'on' cleanup deletes it, unless a legacy-aware
//     ladder is ruled later.
//
// THE SERVER LINES this mirrors (api/cron/agent-evaluate.js, read at d503dd07):
//   :1241–1244  activationDateET = firstTradingDayOf(battle) ?? ET date of
//               activatedAt ?? today; isActivationDay = todayET === it
//   :1266       entryPrice = swapPrice || startingPrices[sym] || 0 (base points only)
//   :1301–1302  thresholdBaseline = swapPrice
//                 || (isActivationDay ? (startingPrices[sym] || previousClose) : previousClose)
//               (previousClose through Guard 2 first, :1281–1296)
//   api/_utils/agentScoring.js :227  baseATR = asset.baseATR || 2.5  (the threshold)
//   api/_utils/agentScoring.js :78–89 badges: maxMultiplier >= THRESHOLD_MULTIPLIERS[tier]
//
// THE SCORED PRICE (spec §3.2) — the price the latest check's rung test read:
//   measured  scoring.stockRewardContexts.agent.{positionId}.currentPrice at
//             .quoteEvidence.providerAsOf — stockThresholdModel.js
//             stockRewardContext sets `currentPrice: quote.price` from the same
//             quote whose `high = max(h.high, quote.price)` decides crossedTiers.
//   legacy    cronState.lastTickPrice[SYM] at cronState.lastTickTimestamp[SYM] —
//             agent-evaluate.js :1937–1968 stores updateStagnationCounter's
//             `lastTickPrice: currentPrice`, where currentPrice =
//             prices[SYM].current, the same map entry the rung test read at
//             :1265 (`prices` is built at :1176–1186 and only extended for new
//             hot-bench names at :1665). The timestamp is the risk loop's wall
//             clock (`nowMs`, :1874), not the provider's quote time.

import { stockModelRoute, isStock, instantMs, committedStockContext } from '../../../utils/stockThresholdModel.js';
import { firstTradingDayOf, etDateOf } from '../../../utils/tieredFirstTradingDay.js';
import { battleExpiryMs } from '../../../../api/_utils/callRecords/horizon.js';

const TIERS = ['star', 'core', 'support'];
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const positive = (v) => finite(v) && v > 0;

/**
 * The Battle View's bombContext for one opened row (spec §4.2): the agent's
 * record when the row IS the agent's position, else a preview (record null).
 * The row is identified by what the mount knows: the gated held view's
 * `posKey` ('player|cpu:tier:slot'), else the opened asset's `positionId`.
 * When it knows neither (the shipped path on an unstamped battle) and the CPU
 * also holds the ticker, the row cannot be told apart from the CPU's, so it is
 * a preview — never the agent's ladder on the CPU's row.
 */
export function agentBombContext(battle, symbol, nowMs, { battleId = null, posKey = null, positionId = null } = {}) {
  let record = selectBombRecord(battle, symbol, nowMs);
  if (record && typeof posKey === 'string') {
    if (posKey !== `player:${record.tier}:${record.slot}`) record = null;
  } else if (record && typeof positionId === 'string' && positionId) {
    if (positionId !== record.positionId) record = null;
  } else if (record) {
    const cpu = battle?.opponent?.portfolio;
    if (TIERS.some((t) => (Array.isArray(cpu?.[t]) ? cpu[t] : []).some((a) => a?.symbol === symbol))) record = null;
  }
  // BS-4: the battle's stock model ('corrected' = scored by the measured ATR model; 'legacy';
  // 'unavailable'), so the modal can tell a measured battle's non-held preview (the ATR reading)
  // from a legacy one's (the screen's own threshold, which is that scorer's number).
  return { kind: 'agent', battleId, held: record !== null, record, stockModel: stockModelRoute(battle).status };
}

/** An instant the record may hold as an ISO string, epoch ms or a Timestamp-like; null otherwise. */
export function recordMs(v) {
  if (finite(v)) return v;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (v && typeof v.toMillis === 'function') { try { const ms = v.toMillis(); return finite(ms) ? ms : null; } catch { return null; } }
  return null;
}

/** The agent's own position holding `symbol` (first in star → core → support order), or null. */
export function agentPositionOf(battle, symbol) {
  const p = battle?.portfolio;
  for (const tier of TIERS) {
    const list = Array.isArray(p?.[tier]) ? p[tier] : [];
    for (let slot = 0; slot < list.length; slot += 1) {
      const asset = list[slot];
      if (asset && asset.symbol === symbol) return { asset, tier, slot };
    }
  }
  return null;
}

/**
 * Is today (the ET date of `nowMs`) the battle's activation day? The server's
 * rule (agent-evaluate.js :1241–1244): the battle's first trading day when its
 * list names one, else the ET date of `activatedAt`, else today.
 */
export function isActivationDayAt(battle, nowMs) {
  const today = etDateOf(nowMs);
  if (today === null) return false;
  const first = firstTradingDayOf(battle);
  if (first !== null) return today === first;
  const activatedMs = recordMs(battle?.activatedAt);
  const activation = activatedMs !== null ? etDateOf(activatedMs) : null;
  return today === (activation ?? today);
}

/** Check dots (spec §3.4): evaluations[].evidence[SYM].px at each entry's timestamp, since entry, where present. */
export function checkDotsOf(battle, symbol, sinceMs) {
  const evals = Array.isArray(battle?.evaluations) ? battle.evaluations : [];
  const dots = [];
  for (const e of evals) {
    const px = e?.evidence?.[symbol]?.px;
    const atMs = recordMs(e?.timestamp);
    if (!positive(px) || atMs === null) continue;
    if (finite(sinceMs) && atMs < sinceMs) continue;
    dots.push({ atMs, px });
  }
  return dots.sort((a, b) => a.atMs - b.atMs);
}

/**
 * @param {object} battle  an agent-battle document (the screen's own snapshot)
 * @param {string} symbol
 * @param {number} nowMs
 * @returns {object|null}  null when the player's agent does not hold `symbol`
 */
export function selectBombRecord(battle, symbol, nowMs) {
  if (!battle || typeof battle !== 'object' || typeof symbol !== 'string' || !symbol || !finite(nowMs)) return null;
  // BA-1: a held ladder needs a LIVE agent battle — a finished one has no check left to bank at.
  if (battle.status != null && battle.status !== 'active') return null;
  const held = agentPositionOf(battle, symbol);
  if (!held) return null;
  const { asset, tier, slot } = held;
  const expiresMs = battleExpiryMs(battle);
  const lastScoredMs = recordMs(battle.scoreState?.lastScoredAt);
  const common = {
    symbol,
    tier,
    slot,
    positionId: typeof asset.positionId === 'string' ? asset.positionId : null,
    battleExpiresAtMs: Number.isFinite(expiresMs) ? expiresMs : null,
    lastScoredAtMs: lastScoredMs,
  };
  // The agent is long-only (BUILD_RULES §7); a short has no upside ladder here.
  if (asset.direction === 'short') return { ...common, model: 'unsupported', reason: 'short_position', checkDots: [] };

  const route = stockModelRoute(battle).status;
  // A stamp the reader cannot accept: the scorer skips the WHOLE battle
  // (agent-evaluate.js :914-915; the nightly run errors at agent-daily-scores.js
  // :71), so no check will come for any name on it, crypto included — no ladder,
  // no clock, no promise (as enrichHeldPosition treats every asset on that route).
  if (route === 'unavailable') return { ...common, model: 'unsupported', reason: 'unsupported_stock_model', checkDots: [] };
  if (route === 'corrected' && isStock(asset)) {
    const receipt = asset.stockThresholdReceipt || null;
    // BD-9 (refinement 2026-11-10): the entry instant is the fill quote's
    // provider time — where the server starts the reward history (v2 Ruling 1,
    // stockThresholdModel.js initialRewardHistory: observedAt = fillQuote.quoteAsOf)
    // — not the wall-clock commit (enteredAt). An overnight entry shows the
    // price's real time (Mon 4:05 PM, not Mon 10:21 PM); during the session the
    // two are ~16 minutes apart on EODHD's quotes (build report §1.2). The
    // baseline label, the ghost line's entry split and the check dots all take it.
    const entryAtMs = instantMs(receipt?.fillQuote?.quoteAsOf);
    const context = common.positionId ? battle.scoring?.stockRewardContexts?.agent?.[common.positionId] : null;
    const scoredAtMs = context?.status === 'valid' ? instantMs(context.quoteEvidence?.providerAsOf) : null;
    // BD-8: the moment the check READ the quote (quoteEvidence.observedAt) — the
    // instant that names the check; the provider time above can be ~16 minutes older.
    const checkAtMs = context?.status === 'valid' ? instantMs(context.quoteEvidence?.observedAt) : null;
    const scored = context?.status === 'valid' && positive(context.currentPrice) && scoredAtMs !== null
      ? { price: context.currentPrice, atMs: scoredAtMs, ...(checkAtMs !== null ? { checkAtMs } : {}), source: 'stockRewardContexts' }
      : null;
    // The ladder: the SAME committed context the modal's bombData.measured is
    // built from (the screen's enrichHeldPosition → committedStockContext;
    // AssetResearchModal.jsx measuredBombKey), in bombData.measured's own
    // shape — read from this live document, because the modal freezes its
    // asset at open for a same-symbol update on the shipped path, so its
    // bombData would miss a check that lands while it is open. Nothing is
    // re-derived: the targets and crossed tiers are the context's.
    const committed = committedStockContext(battle, asset, 'agent', tier, slot);
    const measured = committed.status === 'valid'
      // BP-3: the frozen scoringPct rides along, so a rung's % is the rule's % (k × it)
      // — the same number Details prints from scoringPctDecimal (one committed context).
      ? { measured: true, baselinePrice: committed.fill, scoringPct: committed.scoringPct, targets: committed.targets.map((t) => ({ key: t.key, price: t.target })), crossedTiers: [...committed.crossedTiers] }
      : null;
    // BD-6: the levels table's collapsed Details — StockRewardDetails' facts,
    // carried unchanged from the same committed context (nothing re-derived).
    const details = committed.status === 'valid'
      ? {
        scoringPctDecimal: committed.scoringPctDecimal,
        targets: committed.targets.map((t) => ({ key: t.key, label: t.label, target: t.target })),
        currentPrice: committed.currentPrice,
        providerAsOf: committed.quoteEvidence?.providerAsOf ?? null,
        positionId: committed.positionId,
        receiptHash: committed.receiptHash,
        inputRef: committed.inputRef,
        modelId: committed.modelId,
      }
      : null;
    return {
      ...common,
      model: 'measured',
      entry: { price: positive(receipt?.fill) ? receipt.fill : null, atMs: entryAtMs },
      measured,
      scored: measured ? scored : null,
      ...(details ? { details } : {}),
      checkDots: checkDotsOf(battle, symbol, entryAtMs),
    };
  }

  const history = battle.thresholdHistory?.[symbol] || {};
  const lastTickPrice = battle.cronState?.lastTickPrice?.[symbol];
  const lastTickMs = recordMs(battle.cronState?.lastTickTimestamp?.[symbol]);
  const entryAtMs = recordMs(asset.swappedInAt) ?? recordMs(battle.activatedAt);
  return {
    ...common,
    model: 'legacy',
    // The rung-test baseline's inputs (agent-evaluate.js :1301–1302); ladder.js
    // applies the precedence through the server's resolveThresholdBaseline.
    baselineInputs: {
      swapPrice: positive(asset.swapPrice) ? asset.swapPrice : null,
      startingPrice: positive(battle.portfolio?.startingPrices?.[symbol]) ? battle.portfolio.startingPrices[symbol] : null,
      isActivationDay: isActivationDayAt(battle, nowMs),
    },
    // agentScoring.js :227 — the scorer's threshold (multiples of this % move).
    threshold: positive(asset.baseATR) ? asset.baseATR : 2.5,
    isCrypto: !isStock(asset),
    history: {
      maxMultiplier: finite(history.maxMultiplier) ? history.maxMultiplier : 0,
      minMultiplier: finite(history.minMultiplier) ? history.minMultiplier : 0,
    },
    entryAtMs,
    scored: positive(lastTickPrice) && lastTickMs !== null ? { price: lastTickPrice, atMs: lastTickMs, source: 'lastTickPrice' } : null,
    checkDots: checkDotsOf(battle, symbol, entryAtMs),
  };
}
