// Node-clean persisted dispatch and reward facts. Admission flags are intentionally
// absent: a saved game retains its model after rollback of new admissions.
import { BAGGER_TIERS, BUST_TIERS } from '../constants/baggerBombScoring.js';

// v2 (docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_V2_20261015.json). v1 is
// retired, not kept: no v1 battle exists, and a v1 stamp now resolves unavailable.
export const STOCK_MODEL = Object.freeze({
  modelId: 'stock_measured_atr14_fullday_v2',
  publicationRuleId: 'eodhd_us_completed_session_observation_v1',
  policyHash: '22a815985037ddba74526973237817f233e38fd97cb1b1cff5f33e7af345050b',
  publicationRuleHash: '3ad8e14b203acd660faba9b8ec7e78c7dcb9f312741ec04cd062bcf79741a85f',
  approvedPolicyRef: 'owner_baggerbomb_stock_thresholds_v2_20261015@v1',
});
export const unavailable = reason => ({ status: 'unavailable', reason });
export const finite = n => typeof n === 'number' && Number.isFinite(n);
export const positive = n => finite(n) && n > 0;
export function instantMs(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s) || Number(s.slice(11, 13)) > 23 || Number(s.slice(14, 16)) > 59 || Number(s.slice(17, 19)) > 59) return null;
  const date = new Date(s.slice(0, 10) + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s.slice(0, 10) && Number.isFinite(Date.parse(s)) ? Date.parse(s) : null;
}
export const isStock = a => a?.isCrypto !== true && !/\.CC$/i.test(a?.symbol || '');
export const sameModel = s => !!s && Object.entries(STOCK_MODEL).every(([k, v]) => s[k] === v);
export const stockContent = o => JSON.stringify((function sorted(v) { return Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v; })(o));
export const receiptContent = r => stockContent(Object.fromEntries(Object.entries(r || {}).filter(([k]) => k !== 'receiptHash')));
export function stockModelRoute(battle) {
  if (!Object.hasOwn(battle?.scoring || {}, 'stockThresholdModel')) return { status: 'legacy' };
  const stamp = battle.scoring.stockThresholdModel;
  if (!sameModel(stamp) || instantMs(stamp.admittedAt) === null) return unavailable('unsupported_stock_model');
  if (battle.gameMode !== 'baggerbomb_agent' || battle.duration !== 'fullday' || !battle.opponent?.portfolio) return unavailable('unsupported_stock_scope');
  return { status: 'corrected', model: stamp };
}
export function positions(battle) {
  return ['agent', 'cpu'].flatMap(side => {
    const p = side === 'agent' ? battle.portfolio : battle.opponent?.portfolio;
    return ['star', 'core', 'support'].flatMap(tier => (p?.[tier] || []).map((asset, slot) => ({ side, tier, slot, asset })).filter(p => p.asset));
  });
}
export function rosterToken(battle) {
  return JSON.stringify([battle.scoring?.stockThresholdModel, battle.scoring?.stockRosterVersion,
    positions(battle).map(({ side, tier, slot, asset }) => [side, tier, slot, asset.symbol, asset.positionId, asset.slotVersion, asset.stockThresholdReceipt?.receiptHash])]);
}
export function validateStockReceipt(battle, asset, side, tier, slot) {
  const route = stockModelRoute(battle);
  if (route.status !== 'corrected') return unavailable(route.reason || 'stock_model_required');
  const r = asset?.stockThresholdReceipt;
  if (!sameModel(r) || r.battleId !== battle.id || r.side !== side || r.tier !== tier || r.slot !== slot || r.symbol !== asset.symbol || r.positionId !== asset.positionId || r.slotVersion !== asset.slotVersion || !Number.isInteger(asset.slotVersion) || asset.slotVersion < 1 || !r.positionId || asset.direction === 'short') return unavailable('receipt_binding_mismatch');
  if (!positive(r.fill) || !positive(r.scoringPct) || !positive(r.measuredPct) || !positive(r.atr14Dollars) || !/^\d+\.\d{6}$/.test(r.scoringPctDecimal || '') || Number(r.scoringPctDecimal) !== r.scoringPct || instantMs(r.enteredAt) === null || instantMs(r.snapshotCapturedAt) === null || !/^[a-f0-9]{64}$/.test(r.inputHash || '') || !/^[a-f0-9]{64}$/.test(r.receiptHash || '') || r.inputRef !== `stockThresholdInputs/${r.snapshotId}` || !r.securityId || !r.sourceSession) return unavailable('invalid_stock_receipt');
  const q = r.fillQuote;
  if (!q || q.provider !== 'EODHD' || q.source !== 'real-time' || q.validation !== 'accepted_original_quote' || q.price !== r.fill || instantMs(q.quoteAsOf) === null || instantMs(q.observedAt) === null || instantMs(q.quoteAsOf) > instantMs(q.observedAt) || instantMs(q.observedAt) > instantMs(r.enteredAt)) return unavailable('invalid_fill_evidence');
  return { status: 'valid', receipt: r };
}
// v2 Ruling 1: a lifetime's reward history starts at its fill quote's provider
// time, not the wall-clock commit (enteredAt stays the upper bound above).
export function initialRewardHistory(r) {
  return { positionId: r.positionId, side: r.side, receiptHash: r.receiptHash, high: r.fill, low: r.fill, observedAt: r.fillQuote.quoteAsOf, crossedTiers: [] };
}
// Current, dated quotes after the fill quote only. Whole-session high/low values do
// not prove when a level was touched and therefore cannot grant a lifetime badge.
// v2 Ruling 1: a quote strictly later than the fill quote's provider time is valid;
// one at the same provider time is valid only at exactly the fill price.
export function stockRewardContext(battle, asset, side, tier, slot, quote) {
  const checked = validateStockReceipt(battle, asset, side, tier, slot);
  if (checked.status !== 'valid') return checked;
  const r = checked.receipt;
  const h = battle.scoring.stockRewardHistory?.[side]?.[r.positionId];
  if (!h || h.positionId !== r.positionId || h.side !== side || h.receiptHash !== r.receiptHash || !positive(h.high) || !positive(h.low) || h.high < h.low || instantMs(h.observedAt) === null || instantMs(h.observedAt) < instantMs(r.fillQuote.quoteAsOf)) return unavailable('invalid_reward_history');
  const asOf = instantMs(quote?.asOf), fillAsOf = instantMs(r.fillQuote.quoteAsOf);
  if (!positive(quote?.price) || asOf === null || instantMs(quote.observedAt) === null || asOf > instantMs(quote.observedAt) || asOf < fillAsOf || asOf < instantMs(h.observedAt)) return unavailable('missing_post_entry_quote');
  if (asOf === fillAsOf && quote.price !== r.fill) return unavailable('fill_time_price_conflict');
  const high = Math.max(h.high, quote.price), low = Math.min(h.low, quote.price);
  const targets = [...BAGGER_TIERS.map(t => ({ ...t, k: t.multiplier })), ...BUST_TIERS.map(t => ({ ...t, k: -t.multiplier }))].map(t => ({ ...t, target: r.fill * (1 + t.k * r.scoringPct / 100) }));
  if (targets.some(t => !finite(t.target))) return unavailable('target_overflow');
  const crossedTiers = targets.filter(t => t.k > 0 ? high >= t.target : low <= t.target).map(t => t.key);
  if (!Array.isArray(h.crossedTiers) || h.crossedTiers.some(k => !crossedTiers.includes(k))) return unavailable('inconsistent_reward_history');
  const multiplier = ((quote.price - r.fill) / r.fill * 100) / r.scoringPct;
  const maxMultiplier = ((high - r.fill) / r.fill * 100) / r.scoringPct;
  const minMultiplier = ((low - r.fill) / r.fill * 100) / r.scoringPct;
  const nextTarget = targets.find(t => t.k > 0 && !crossedTiers.includes(t.key)) || null;
  const distance = nextTarget ? (nextTarget.target - quote.price) / (r.fill * r.scoringPct / 100) : null;
  const proximity = nextTarget ? { ...nextTarget, distance, locked: quote.price < nextTarget.target && distance > 0 && distance <= 0.2, progress: Math.max(0, Math.min(1, (quote.price - r.fill) / (nextTarget.target - r.fill))) } : null;
  const nextPenalty = targets.find(t => t.k < 0 && !crossedTiers.includes(t.key)) || null;
  const penaltyDistance = nextPenalty ? (quote.price - nextPenalty.target) / (r.fill * r.scoringPct / 100) : null;
  const penaltyProximity = nextPenalty ? { ...nextPenalty, distance: penaltyDistance, approaching: quote.price > nextPenalty.target && penaltyDistance > 0 && penaltyDistance <= 0.2 } : null;
  return { status: 'valid', modelId: r.modelId, policyHash: r.policyHash, positionId: r.positionId, receiptHash: r.receiptHash, receiptContent: receiptContent(r), inputRef: r.inputRef, fill: r.fill, scoringPct: r.scoringPct, scoringPctDecimal: r.scoringPctDecimal, currentPrice: quote.price, multiplier, targets, crossedTiers, nextTarget, nextPenalty, penaltyProximity, proximity,
    quoteEvidence: { kind: asOf === fillAsOf ? 'fill_quote' : 'post_fill_quote', providerAsOf: quote.asOf, observedAt: quote.observedAt },
    history: { ...h, high, low, observedAt: quote.asOf, crossedTiers, maxMultiplier, minMultiplier } };
}
export function committedStockContext(battle, asset, side, tier, slot) {
  const c = battle?.scoring?.stockRewardContexts?.[side]?.[asset?.positionId];
  if (!c || c.status !== 'valid' || c.positionId !== asset.positionId || c.receiptHash !== asset.stockThresholdReceipt?.receiptHash) return unavailable(c?.reason || 'awaiting_bound_committed_context');
  if (battle.scoreState?.stockScoreEvidence?.contextContent !== committedContextContent(battle)) return unavailable('committed_context_content_mismatch');
  if (c.receiptContent !== receiptContent(asset.stockThresholdReceipt)) return unavailable('committed_receipt_content_mismatch');
  if (stockContent(c.history) !== stockContent(battle.scoring.stockRewardHistory?.[side]?.[asset.positionId]) || c.currentPrice > c.history.high || c.currentPrice < c.history.low) return unavailable('committed_context_history_mismatch');
  return stockRewardContext(battle, asset, side, tier, slot, { price: c.currentPrice, asOf: c.quoteEvidence?.providerAsOf, observedAt: c.quoteEvidence?.observedAt });
}
export const committedContextContent = battle => stockContent(positions(battle).filter(p => isStock(p.asset)).map(p => [p.side, p.asset.positionId, battle.scoring.stockRewardContexts?.[p.side]?.[p.asset.positionId] || null]));
export function validCommittedStockScores(battle) {
  const e = battle?.scoreState?.stockScoreEvidence;
  return stockModelRoute(battle).status === 'corrected' && e?.status === 'valid' && sameModel(e.model) && e.rosterToken === rosterToken(battle) && e.scoreVersion === battle.scoring.stockScoreVersion && finite(battle.scoreState.currentScore) && finite(battle.scoreState.opponentScore) && e.currentScore === battle.scoreState.currentScore && e.opponentScore === battle.scoreState.opponentScore && e.componentContent === stockContent(battle.scoring.stockScoreComponents || {}) && e.contextContent === committedContextContent(battle) && instantMs(e.at) !== null && positions(battle).every(p => !isStock(p.asset) || committedStockContext(battle, p.asset, p.side, p.tier, p.slot).status === 'valid');
}
// v2 Ruling 15: the Why proximity for a measured-model row — the context's own
// proximity plus the legacy line's shape ("💣 1.2% to BaggerBomb", "MAX" once
// every bonus tier is earned), from the committed context only (§9).
export function measuredProximity(context) {
  if (!context || context.status !== 'valid') return null;
  if (!context.nextTarget) {
    const top = context.targets.find(t => t.key === 'tenBagger');
    return { ...(context.proximity || {}), text: `${top?.emoji ? `${top.emoji} ` : ''}MAX` };
  }
  const pct = (context.nextTarget.target - context.currentPrice) / context.currentPrice * 100;
  return { ...context.proximity, text: `${context.nextTarget.emoji} ${stockSummary(pct, 1)}% to ${context.nextTarget.label}` };
}
// v2 Ruling 4: an expired measured-model battle without a valid final frame
// completes with this context and no result.
export const STOCK_RESULT_UNAVAILABLE = 'corrected_score_unavailable';
// v2 Ruling 16: the scores a reader may show. A legacy battle's stored
// scoreState is returned as is. A measured-model battle shows only validly
// committed scores, and never for a result-unavailable completion; otherwise
// both scores are null — shown as "—" or "unavailable", never 0.
export function displayedStockScores(battle) {
  if (stockModelRoute(battle).status === 'legacy') return battle?.scoreState || {};
  if (battle?.completionContext === STOCK_RESULT_UNAVAILABLE || !validCommittedStockScores(battle)) return { ...(battle?.scoreState || {}), currentScore: null, opponentScore: null };
  return battle.scoreState;
}
// Exact decimal half-even is presentation only. Award comparisons never call it.
export function stockSummary(n, decimals = 2) {
  if (!finite(n)) return 'unavailable';
  const negative = n < 0;
  const [m, e = '0'] = Math.abs(n).toString().split('e');
  const f = (m.split('.')[1] || '').length;
  const digits = BigInt(m.replace('.', ''));
  const shift = Number(e) - f + decimals;
  let rounded;
  if (shift >= 0) rounded = digits * 10n ** BigInt(shift);
  else {
    const d = 10n ** BigInt(-shift);
    rounded = digits / d;
    if ((digits % d) * 2n > d || ((digits % d) * 2n === d && rounded % 2n === 1n)) rounded++;
  }
  const s = rounded.toString().padStart(decimals + 1, '0');
  return `${negative ? '-' : ''}${s.slice(0, -decimals)}.${s.slice(-decimals)}`;
}
