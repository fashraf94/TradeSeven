import { randomUUID } from 'node:crypto';
import * as flags from '../../src/config/featureFlags.js';
import { STOCK_MODEL, stockModelRoute, positions, isStock, rosterToken, initialRewardHistory, stockRewardContext, finite, positive, instantMs, validateStockReceipt, validCommittedStockScores, stockContent, committedContextContent } from '../../src/utils/stockThresholdModel.js';
import { candidateRoundHalfEven, measureStock } from './measuredStockThreshold.js';
import { canonicalContentHash } from './canonicalHash.js';
import { resolveStockApproval, STOCK_APPROVAL, STOCK_ADMISSION_CONTROL_PATH, validStockAdmissionControl, stockAdmissionSelects } from './stockThresholdPolicyRegistry.js';
import { collectStockObservation, qualifyStockObservation, refuseStock, StockThresholdRefusal } from './stockThresholdMeasurementProvider.js';
import { calculateAssetScoreServer } from './agentScoring.js';
import { getSessionForDate } from '../../src/utils/marketCalendar.js';

export const stockAdmissionEnabled = () => Object.hasOwn(flags, 'STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED') && flags.STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED === true;
export function effectiveStockPercentage(measuredPct) {
  if (!finite(measuredPct) || measuredPct <= 0) refuseStock('zero_or_invalid_volatility');
  const scoringPct = candidateRoundHalfEven(measuredPct, 6);
  if (!positive(scoringPct)) refuseStock('quantized_zero');
  const [m, e = '0'] = scoringPct.toString().split('e');
  const parts = m.split('.'), digits = parts.join('');
  const point = parts[0].length + Number(e);
  const expanded = point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? `${digits}${'0'.repeat(point - digits.length)}` : `${digits.slice(0, point)}.${digits.slice(point)}`;
  const [whole, fraction = ''] = expanded.split('.');
  const scoringPctDecimal = `${whole}.${fraction.padEnd(6, '0')}`;
  if (!/^\d+\.\d{6}$/.test(scoringPctDecimal) || Number(scoringPctDecimal) !== scoringPct) refuseStock('percentage_representation_failed');
  return { scoringPct, scoringPctDecimal };
}
const serializable = o => JSON.parse(JSON.stringify(o));
export function bindStockReceipt(observation, { battleId, side, tier, slot, positionId, slotVersion, enteredAt }) {
  qualifyStockObservation(observation, enteredAt);
  const m = observation.measurement;
  const r = { ...STOCK_MODEL, battleId, side, tier, slot, positionId, slotVersion, symbol: m.symbol, securityId: observation.securityId,
    snapshotId: observation.snapshot.id, inputRef: `stockThresholdInputs/${observation.snapshot.id}`, inputHash: m.inputHash, snapshotHash: observation.snapshotHash, snapshotCapturedAt: observation.snapshot.capturedAt, sourceSession: m.sourceSession,
    atr14Dollars: m.atr14Dollars, measuredPct: m.measuredPct, ...effectiveStockPercentage(m.measuredPct), fill: observation.fillQuote.price, fillQuote: observation.fillQuote, enteredAt };
  return { ...r, receiptHash: canonicalContentHash(r) };
}
function inputDoc(o) { return serializable({ ...o, attestation: { ...STOCK_APPROVAL, observedAt: o.snapshot.capturedAt }, observationHash: canonicalContentHash(serializable(o)) }); }
async function readEligibility(tx, db, symbols) {
  const snap = await tx.get(db.collection('indexIntelligence').doc('stockRankings'));
  const ranked = new Set((snap.data()?.stocks || []).map(s => s.symbol));
  if (!snap.exists || symbols.some(s => !ranked.has(s))) refuseStock('current_ranked_membership_missing');
}
// v2 Ruling 2: corrected creation is refused from 45 minutes before the calendar
// close (15:15 ET; 12:15 ET on early-close days), measured at the creation's
// began instant against the session's own closeMs, never a clock literal. A code
// constant recorded in the pilot approval document, deliberately not hashed.
export const STOCK_LATE_START_CUTOFF_MINUTES = 45;
const etDateOf = ms => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ms);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
export function lateStartRefusal(began) {
  const ms = instantMs(began);
  if (ms === null) return 'invalid_creation_instant';
  const session = getSessionForDate(etDateOf(ms));
  if (!session) return 'calendar_missing';
  return session.isTradingDay && ms >= session.closeMs - STOCK_LATE_START_CUTOFF_MINUTES * 60000 && ms < session.closeMs ? 'late_start_cutoff' : null;
}
// v2 Ruling 6: the control document is the only on-switch. A missing, unreadable,
// disabled, unparseable or old-schema control, or one whose allowlist does not name
// this owner, keeps today's legacy creation with no measurement read (null). Only a
// selected (allowlisted) creation can be refused, and every refusal is retriable.
export async function prepareStockCreation(battleDoc, { db, collector = collectStockObservation, now = () => new Date() } = {}) {
  if (!stockAdmissionEnabled()) return null;
  if (battleDoc.gameMode !== 'baggerbomb_agent' || battleDoc.duration !== 'fullday' || !battleDoc.opponent?.portfolio) return null;
  if (!db) return null;
  let control = null;
  try { const controlSnap = await db.doc(STOCK_ADMISSION_CONTROL_PATH).get(); control = controlSnap.exists ? controlSnap.data() : null; } catch { return null; }
  if (!stockAdmissionSelects(control, battleDoc.ownerId)) return null;
  const late = lateStartRefusal(now().toISOString());
  if (late) refuseStock(late);
  const observations = [];
  try {
    for (const p of positions(battleDoc)) {
      if (isStock(p.asset) && !positive(p.asset.baseATR)) refuseStock('calibrated_unit_missing');
      if (isStock(p.asset) && p.asset.direction != null && p.asset.direction !== 'long') refuseStock('unsupported_stock_direction');
      if (isStock(p.asset)) observations.push({ ...p, observation: await collector(p.asset.symbol, p.asset.baseATR), positionId: randomUUID() });
    }
  } catch (error) {
    // A selected creation's unexpected error stays a scoped retriable refusal
    // that keeps its cause (review K3-6), now that selection is per battle.
    if (error?.name === 'StockThresholdRefusal') throw error;
    throw Object.assign(new StockThresholdRefusal('corrected_creation_failed'), { cause: error });
  }
  return { observations, model: { ...STOCK_MODEL }, selected: true, control };
}
// Decorate the executed composition fence rather than duplicating its checks.
// All additional reads precede its descriptor/hypothesis reads and writes.
export function stockCreationDb(db, prepared, now = () => new Date()) {
  const confirm = () => {
    if (!stockAdmissionEnabled() || !resolveStockApproval(prepared.model)) refuseStock('creation_selection_changed');
    prepared.observations.forEach(p => qualifyStockObservation(p.observation, now().toISOString()));
  };
  const qualify = async (tx, battleDoc, ref) => {
    if (!stockAdmissionEnabled() || !resolveStockApproval(prepared.model)) refuseStock('creation_selection_changed');
    const liveControl = (await tx.get(db.doc(STOCK_ADMISSION_CONTROL_PATH))).data();
    if (!validStockAdmissionControl(liveControl) || stockContent(liveControl) !== stockContent(prepared.control)) refuseStock('creation_selection_changed');
    const at = now().toISOString();
    if (instantMs(at) < instantMs(STOCK_APPROVAL.approvedAt)) refuseStock('approval_not_effective');
    await readEligibility(tx, db, prepared.observations.map(p => p.asset.symbol));
    battleDoc.scoring.stockThresholdModel = { ...prepared.model, admittedAt: at };
    battleDoc.scoring.stockRosterVersion = 1;
    battleDoc.scoring.stockScoreVersion = 0;
    battleDoc.scoring.stockRewardHistory = { agent: {}, cpu: {} };
    battleDoc.scoring.stockRiskHistory = { agent: {}, cpu: {} };
    battleDoc.scoring.stockScoreComponents = {};
    for (const p of positions(battleDoc)) {
      p.asset.positionId ||= randomUUID();
      p.asset.slotVersion = 1;
    }
    for (const p of prepared.observations) {
      const receipt = bindStockReceipt(p.observation, { battleId: ref.id, side: p.side, tier: p.tier, slot: p.slot, positionId: p.positionId, slotVersion: 1, enteredAt: at });
      const portfolio = p.side === 'agent' ? battleDoc.portfolio : battleDoc.opponent.portfolio;
      const a = portfolio[p.tier][p.slot];
      Object.assign(a, { positionId: p.positionId, slotVersion: 1, stockThresholdReceipt: receipt, swapPrice: receipt.fill, swappedInAt: at });
      // Each side's receipt is authoritative even when a compatibility map has
      // only one symbol key. Never read this map for corrected stock fills.
      if (p.side === 'agent') battleDoc.portfolio.startingPrices[a.symbol] = receipt.fill;
      battleDoc.scoring.stockRewardHistory[p.side][p.positionId] = initialRewardHistory(receipt);
      battleDoc.scoring.stockRiskHistory[p.side][p.positionId] = { maxMultiplier: 0, minMultiplier: 0, positionId: p.positionId };
    }
    battleDoc.scoreState.currentScore = null;
    battleDoc.scoreState.opponentScore = null;
    battleDoc.scoreState.stockScoreEvidence = { status: 'unavailable', reason: 'awaiting_first_committed_score' };
  };
  const appendInputs = tx => { for (const p of prepared.observations) tx.create(db.doc(`stockThresholdInputs/${p.observation.snapshot.id}`), inputDoc(p.observation)); };
  return new Proxy(db, { get(target, key) {
    if (key === 'runTransaction') return callback => target.runTransaction(async tx => {
      let preparedDoc = null;
      // The ref is allocated by the original fence before entering this callback.
      // Wrap create to identify it, but qualify before the original callback reads.
      // The original document is available on prepared (set by creation service).
      const ref = prepared.ref;
      await qualify(tx, prepared.battleDoc, ref);
      const result = await callback(new Proxy(tx, { get(t, k) {
        if (k === 'create') return (r, doc) => {
          if (r.path?.startsWith('agentBattles/') || r.id === ref.id) {
            confirm();
            preparedDoc = doc;
          }
          return t.create(r, doc);
        };
        return typeof t[k] === 'function' ? t[k].bind(t) : t[k];
      } }));
      if (!preparedDoc) refuseStock('missing_atomic_battle_create');
      appendInputs(tx); return result;
    });
    if (key === 'collection') return name => {
      const c = target.collection(name);
      if (name !== 'agentBattles') return c;
      return new Proxy(c, { get(t, k) {
        if (k === 'doc') return (...args) => { const r = t.doc(...args); prepared.ref = r; return r; };
        if (k === 'add') return async doc => { const ref = t.doc(); prepared.ref = ref; await target.runTransaction(async tx => { await qualify(tx, doc, ref); confirm(); tx.create(ref, doc); appendInputs(tx); }); return ref; };
        return typeof t[k] === 'function' ? t[k].bind(t) : t[k];
      } });
    };
    return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
  } });
}
// v2 Ruling 9: with strictClose, only a real provider `close` values the position;
// the shared quote path's previousClose stand-in (marketDataCache.js) is unavailable.
export function decisionQuote(price, observedAt, { strictClose = false } = {}) {
  const timestamp = typeof price?.timestamp === 'number' && finite(price.timestamp) ? new Date(price.timestamp * 1000).toISOString() : price?.timestamp;
  return { price: price?.fallback === true || (strictClose && price?.previousCloseStandIn === true) ? null : price?.current, asOf: timestamp, observedAt };
}
// A quote at or after the fill quote values the position (v2 Ruling 1). Branch A:
// when this tick's dated quote predates the fill quote (the position was entered
// after the tick fetched its prices, including a recovered landed trade), the
// position is valued at its own receipt fill: same provider time, same price.
// An exit never stands in (review R1).
export function scoreCorrectedPosition(battle, asset, side, prices, observedAt, { fillStandIn = true } = {}) {
  const p = positions(battle).find(p => p.side === side && p.asset.positionId === asset.positionId);
  const r = asset.stockThresholdReceipt;
  const quote = decisionQuote(prices[asset.symbol], observedAt, { strictClose: true });
  let context = p ? stockRewardContext(battle, asset, side, p.tier, p.slot, quote) : { status: 'unavailable', reason: 'missing_position_identity' };
  const tickAsOf = instantMs(quote.asOf), fillAsOf = instantMs(r?.fillQuote?.quoteAsOf);
  if (fillStandIn && p && context.reason === 'missing_post_entry_quote' && positive(quote.price) && tickAsOf !== null && fillAsOf !== null && tickAsOf < fillAsOf)
    context = stockRewardContext(battle, asset, side, p.tier, p.slot, { price: r.fill, asOf: r.fillQuote.quoteAsOf, observedAt: r.fillQuote.observedAt });
  return { ...calculateAssetScoreServer(asset, null, {}, {}, null, context), positionId: asset.positionId, side };
}
export function correctedScorePatch(battle, agentScores, cpuScores, at) {
  const all = [...agentScores, ...cpuScores];
  const components = Object.values(battle.scoring.stockScoreComponents || {});
  const ok = agentScores.length === positions(battle).filter(p => p.side === 'agent').length && cpuScores.length === positions(battle).filter(p => p.side === 'cpu').length && all.every(s => finite(s.totalPoints)) && components.every(c => finite(c.points) && c.positionId && c.status === 'closed' && c.componentHash === canonicalContentHash(Object.fromEntries(Object.entries(c).filter(([k]) => k !== 'componentHash'))));
  const active = ok ? agentScores.reduce((n, s) => n + s.totalPoints, 0) : null;
  const banked = ok ? components.filter(c => c.side === 'agent').reduce((n, c) => n + c.points, 0) : null;
  const cpu = ok ? cpuScores.reduce((n, s) => n + s.totalPoints, 0) + components.filter(c => c.side === 'cpu').reduce((n, c) => n + c.points, 0) : null;
  const patch = { 'scoreState.activeScore': active, 'scoreState.bankedScore': banked, 'scoreState.currentScore': ok ? active + banked : null, 'scoreState.opponentScore': cpu, 'scoreState.lastScoredAt': at,
    'scoring.stockScoreVersion': battle.scoring.stockScoreVersion + 1,
    'scoreState.stockScoreEvidence': { status: ok ? 'valid' : 'unavailable', reason: ok ? null : 'incomplete_corrected_score', model: battle.scoring.stockThresholdModel, rosterToken: rosterToken(battle), scoreVersion: battle.scoring.stockScoreVersion + 1, currentScore: ok ? active + banked : null, opponentScore: cpu, componentContent: stockContent(battle.scoring.stockScoreComponents || {}), at } };
  all.forEach(s => {
    const c = s.rewardContext;
    if (c?.status === 'unavailable') {
      const p = positions(battle).find(p => p.side === s.side && p.asset.positionId === s.positionId);
      if (p) patch[`scoring.stockRewardContexts.${p.side}.${p.asset.positionId}`] = { ...c, positionId: p.asset.positionId, receiptHash: p.asset.stockThresholdReceipt?.receiptHash || null };
    }
    if (c?.status === 'valid') {
      const p = positions(battle).find(p => p.asset.positionId === c.positionId);
      patch[`scoring.stockRewardHistory.${p.side}.${c.positionId}`] = c.history;
      patch[`scoring.stockRewardContexts.${p.side}.${c.positionId}`] = c;
      const change = q => (q - c.fill) / c.fill * 100 / p.asset.baseATR;
      patch[`scoring.stockRiskHistory.${p.side}.${c.positionId}`] = { positionId: c.positionId, maxMultiplier: change(c.history.high), minMultiplier: change(c.history.low) };
    }
  });
  const view = { ...battle, scoring: { ...battle.scoring, stockRewardContexts: { agent: { ...battle.scoring.stockRewardContexts?.agent }, cpu: { ...battle.scoring.stockRewardContexts?.cpu } } } };
  for (const [key, value] of Object.entries(patch)) if (key.startsWith('scoring.stockRewardContexts.')) { const [, , side, id] = key.split('.'); view.scoring.stockRewardContexts[side][id] = value; }
  patch['scoreState.stockScoreEvidence'].contextContent = committedContextContent(view);
  return patch;
}
export async function readCorrectedInputs(tx, db, battle) {
  if (stockModelRoute(battle).status !== 'corrected' || !resolveStockApproval(battle.scoring.stockThresholdModel)) refuseStock('unsupported_stock_model');
  for (const p of positions(battle).filter(p => isStock(p.asset))) {
    const checked = validateStockReceipt(battle, p.asset, p.side, p.tier, p.slot);
    if (checked.status !== 'valid') refuseStock(checked.reason);
    const r = checked.receipt, { receiptHash, ...body } = r;
    if (canonicalContentHash(body) !== receiptHash) refuseStock('receipt_hash_mismatch');
    const input = await tx.get(db.doc(r.inputRef));
    if (!input.exists) refuseStock('immutable_input_missing');
    const o = input.data();
    const { attestation, observationHash, ...observation } = o;
    if (observationHash !== canonicalContentHash(observation) || o.securityId !== r.securityId || o.general?.Code !== r.symbol || o.general?.IsDelisted !== false || o.snapshot?.id !== r.snapshotId || o.measurement?.symbol !== r.symbol || canonicalContentHash(o.fillQuote) !== canonicalContentHash(r.fillQuote) || attestation?.observedAt !== r.snapshotCapturedAt) refuseStock('immutable_observation_corrupt');
    if (o.snapshotHash !== canonicalContentHash(o.snapshot) || o.snapshotHash !== r.snapshotHash || o.attestation?.collectorId !== STOCK_APPROVAL.collectorId || !resolveStockApproval(o.attestation)) refuseStock('immutable_input_corrupt');
    const replay = measureStock({ symbol: r.symbol, providerSymbol: o.snapshot.providerSymbol, expectedSourceSession: r.sourceSession, asOf: r.snapshotCapturedAt, snapshot: o.snapshot });
    if (replay.measurementArithmetic !== 'valid' || replay.inputHash !== r.inputHash || replay.measuredPct !== r.measuredPct || replay.atr14Dollars !== r.atr14Dollars || effectiveStockPercentage(replay.measuredPct).scoringPctDecimal !== r.scoringPctDecimal) refuseStock('measurement_replay_mismatch');
  }
}
export async function commitCorrectedScore(db, ref, expected, patch, onCommitted) {
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref), live = { id: ref.id, ...snap.data() };
    if (!snap.exists || live.status !== 'active' || rosterToken(live) !== rosterToken(expected) || live.scoring.stockScoreVersion !== expected.scoring.stockScoreVersion) refuseStock('stale_score_frame');
    await readCorrectedInputs(tx, db, live);
    tx.update(ref, patch);
    return { patch, rosterToken: rosterToken(live) };
  }).then(result => {
    onCommitted?.(result);
    for (const [key, value] of Object.entries(result.patch)) if (key.startsWith('scoreState.') || key.startsWith('scoring.stock')) {
      const parts = key.split('.'); let target = expected;
      for (const part of parts.slice(0, -1)) target = target[part] ||= {};
      target[parts.at(-1)] = value;
    }
    return result;
  });
}
export function validCorrectedCompletion(battle) {
  const e = battle.scoreState?.stockScoreEvidence;
  return validCommittedStockScores(battle) && resolveStockApproval(e.model) !== null;
}
export async function executeCorrectedStockSwap(db, battleId, expected, tier, slot, benchAsset, prices, currentDay, metadata = {}, snapshot = null, opts = {}) {
  const clock = opts.now || (() => new Date());
  const pre = expected.portfolio?.[tier]?.[slot];
  if (isStock(benchAsset) && benchAsset.direction != null && benchAsset.direction !== 'long') refuseStock('unsupported_stock_direction');
  if (opts.expectedOut && (opts.expectedOut.symbol !== pre?.symbol || (Object.hasOwn(opts.expectedOut, 'swappedInAt') && opts.expectedOut.swappedInAt !== (pre?.swappedInAt ?? null)))) refuseStock('stale_swap_belief');
  if (stockModelRoute(expected).status !== 'corrected' || !pre?.positionId) refuseStock('unsupported_or_missing_position');
  const incomingId = randomUUID();
  const observation = isStock(benchAsset) ? await (opts.collector || collectStockObservation)(benchAsset.symbol, benchAsset.baseATR) : null;
  const ref = db.collection('agentBattles').doc(battleId);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref), live = { id: battleId, ...snap.data() };
    const out = live.portfolio?.[tier]?.[slot];
    if (!snap.exists || live.status !== 'active' || rosterToken(live) !== rosterToken(expected) || live.scoring.stockScoreVersion !== expected.scoring.stockScoreVersion || out?.positionId !== pre.positionId) refuseStock('stale_swap_position');
    if (!out || benchAsset.symbol === out.symbol || positions(live).some(p => p.side === 'agent' && p.asset.symbol === benchAsset.symbol)) refuseStock('duplicate_swap_symbol');
    await readCorrectedInputs(tx, db, live);
    if (observation) await readEligibility(tx, db, [benchAsset.symbol]);
    const at = clock().toISOString();
    const inReceipt = observation ? bindStockReceipt(observation, { battleId, side: 'agent', tier, slot, positionId: incomingId, slotVersion: out.slotVersion + 1, enteredAt: at }) : null;
    const outQuote = decisionQuote(prices[out.symbol], at, { strictClose: isStock(out) });
    if (!positive(outQuote.price) || instantMs(outQuote.asOf) === null || instantMs(outQuote.asOf) > instantMs(at)) refuseStock('missing_exit_quote');
    const entry = out.stockThresholdReceipt?.fill ?? out.swapPrice ?? live.portfolio.startingPrices?.[out.symbol];
    // v2 Ruling 8: the outgoing crypto entry must be a positive price, never a 0 or missing basis.
    if (!isStock(out) && !positive(entry)) refuseStock('missing_outgoing_entry');
    const score = isStock(out) ? scoreCorrectedPosition(live, { ...out, tier }, 'agent', prices, at, { fillStandIn: false }) : calculateAssetScoreServer({ ...out, tier, tierMultiplier: out.tierMultiplier }, (outQuote.price - entry) / entry * 100, live.thresholdHistory?.[out.symbol] || {});
    if (!finite(score.totalPoints)) refuseStock(score.reason || 'missing_outgoing_score');
    // v2 Ruling 1: an exit needs a quote strictly later than the fill quote.
    if (isStock(out) && !(instantMs(score.rewardContext.quoteEvidence.providerAsOf) > instantMs(out.stockThresholdReceipt.fillQuote.quoteAsOf))) refuseStock('exit_quote_not_after_fill');
    // One accepted exit: the scored stock context's dated quote, else the typed crypto quote.
    const exit = isStock(out) ? { price: score.rewardContext.currentPrice, asOf: score.rewardContext.quoteEvidence.providerAsOf } : { price: outQuote.price, asOf: outQuote.asOf };
    // v2 Ruling 8: an incoming crypto fill from the stale adjusted-close fallback is refused.
    if (!inReceipt && prices[benchAsset.symbol]?.fallback === true) refuseStock('fallback_incoming_fill');
    const fill = inReceipt?.fill ?? prices[benchAsset.symbol]?.current;
    if (!positive(fill)) refuseStock('missing_incoming_fill');
    const incomingAsset = { symbol: benchAsset.symbol, name: benchAsset.name || benchAsset.symbol, isCrypto: !isStock(benchAsset), baseATR: live.scoring.thresholds?.[benchAsset.symbol]?.threshold || benchAsset.baseATR || (benchAsset.isCrypto ? 5 : 2.5), swapPrice: fill, swappedInAt: at, swappedInDay: currentDay, positionId: incomingId, slotVersion: out.slotVersion + 1, ...(inReceipt ? { stockThresholdReceipt: inReceipt } : {}), ...(benchAsset.isCrypto && benchAsset.direction ? { direction: benchAsset.direction } : {}) };
    const closedTrade = { ...metadata, symbolOut: out.symbol, symbolIn: incomingAsset.symbol, name: out.name || out.symbol, tier, slotIndex: slot, entryPrice: entry, exitPrice: exit.price, lockedPoints: score.totalPoints, lockedGainPct: score.priceChange, swappedOutAt: at, swapDay: currentDay, isCrypto: out.isCrypto || false, direction: out.direction || null, snapshot,
      stockThresholdModel: live.scoring.stockThresholdModel, outgoingPositionId: out.positionId, incomingPositionId: incomingId, outgoingReceipt: out.stockThresholdReceipt || null, incomingReceipt: inReceipt, rewardContext: score.rewardContext || null,
      // The calibrated history the trailing guardrail read for this lifetime;
      // capture keeps it here, not in the symbol-keyed legacy field (review K1-7).
      outgoingRiskHistory: isStock(out) ? live.scoring.stockRiskHistory?.agent?.[out.positionId] ?? null : null };
    const components = { ...live.scoring.stockScoreComponents };
    if (components[out.positionId]) refuseStock('already_banked_position');
    components[out.positionId] = { status: 'closed', positionId: out.positionId, side: 'agent', points: score.totalPoints, receiptHash: out.stockThresholdReceipt?.receiptHash || null, exitPrice: exit.price, exitQuoteAsOf: exit.asOf, closedAt: at };
    components[out.positionId].componentHash = canonicalContentHash(components[out.positionId]);
    const nextTier = [...live.portfolio[tier]]; nextTier[slot] = incomingAsset;
    const outgoingBench = { symbol: out.symbol, name: out.name || out.symbol, isCrypto: out.isCrypto || false, baseATR: out.baseATR, direction: out.direction || null, cooldownUntil: new Date(clock().getTime() + 86400000).toISOString() };
    const benchStocks = (live.portfolio.bench?.stocks || []).filter(a => a.symbol !== incomingAsset.symbol && a.symbol !== out.symbol);
    if (isStock(out)) benchStocks.push(outgoingBench);
    const update = { [`portfolio.${tier}`]: nextTier, 'portfolio.bench.stocks': benchStocks, 'portfolio.bench.crypto': !isStock(out) ? outgoingBench : live.portfolio.bench?.crypto?.symbol === incomingAsset.symbol ? null : live.portfolio.bench?.crypto || null,
      'scoring.stockRosterVersion': live.scoring.stockRosterVersion + 1, 'scoring.stockScoreComponents': components, trades: [...(live.trades || []), closedTrade].slice(-50), 'scoreState.tradeCount': (live.scoreState.tradeCount || 0) + 1, 'scoreState.stockScoreEvidence': { status: 'unavailable', reason: 'roster_changed_awaiting_score' }, 'scoreState.currentScore': null, 'scoreState.opponentScore': null, updatedAt: at };
    // Typed crypto keeps the legacy entry reset: a re-entry never inherits a
    // former lifetime's threshold history (review K2-3). The whole map, as the
    // legacy writer does: a dotted path would split a `.CC` symbol.
    if (!isStock(benchAsset)) update.thresholdHistory = { ...(live.thresholdHistory || {}), [incomingAsset.symbol]: { maxMultiplier: 0, minMultiplier: 0, badges: [] } };
    if (inReceipt) {
      update[`scoring.stockRewardHistory.agent.${incomingId}`] = initialRewardHistory(inReceipt);
      update[`scoring.stockRiskHistory.agent.${incomingId}`] = { positionId: incomingId, maxMultiplier: 0, minMultiplier: 0 };
      tx.create(db.doc(inReceipt.inputRef), inputDoc(observation));
    }
    if (score.rewardContext) update[`scoring.stockRewardHistory.agent.${out.positionId}`] = score.history;
    tx.update(ref, update);
    return { closedTrade, incomingAsset, stockThresholdModel: live.scoring.stockThresholdModel, rosterVersion: update['scoring.stockRosterVersion'], scoreState: { currentScore: null, opponentScore: null, stockScoreEvidence: update['scoreState.stockScoreEvidence'] } };
  });
}
// Checkpoints retain component ownership; no second bonus component is credited.
export async function checkpointCorrectedDaily(db, ref, expected, dayKey, at) {
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref), live = { id: ref.id, ...snap.data() };
    if (!snap.exists || live.status !== 'active' || stockModelRoute(live).status !== 'corrected' || rosterToken(live) !== rosterToken(expected)) refuseStock('stale_daily_frame');
    if (live.scoreState.dailyScores?.[dayKey]?.recorded) return { status: 'skipped', reason: 'already_recorded' };
    if (!validCorrectedCompletion(live)) refuseStock('missing_committed_daily_score');
    await readCorrectedInputs(tx, db, live);
    tx.update(ref, { [`scoreState.dailyScores.${dayKey}`]: { recorded: true, at, currentScore: live.scoreState.currentScore, opponentScore: live.scoreState.opponentScore, stockScoreEvidence: live.scoreState.stockScoreEvidence, componentOwnership: 'lifetime_not_additive' }, 'timing.lastDailyResetAt': at });
    return { status: 'recorded' };
  });
}
export async function refreshCorrectedRoster(ref, battle) {
  const snap = await ref.get(), live = { id: ref.id, ...snap.data() };
  if (!snap.exists || stockModelRoute(live).status !== 'corrected') refuseStock('corrected_roster_refresh_failed');
  for (const k of ['portfolio', 'opponent', 'scoring', 'scoreState', 'trades']) battle[k] = live[k];
}
