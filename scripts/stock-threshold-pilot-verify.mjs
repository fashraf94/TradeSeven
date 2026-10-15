// scripts/stock-threshold-pilot-verify.mjs
//
// BaggerBomb stock thresholds v2 pilot — a READ-ONLY check of one live measured
// battle. For every position on both sides it prints the receipt (frozen
// measured %, fill and fill-quote time), the six exact targets (with their
// half-even cent summaries), the committed reward context and the points the
// canonical scorer gives that context; then each side's score agreement: the
// stored score against its own active and banked parts and the banked
// components, and — on a side that holds no crypto — the stored active score
// against the recomputed stock points (a side with crypto reports the crypto
// remainder, which the committed frame does not let this script recompute);
// then the committed-score validity check and a replay of every bound input.
//
// Nothing is written: only document reads. No provider call.
//
// USAGE (repo root; Admin credentials from .env.local via scripts/loadLocalEnv.js):
//   node scripts/stock-threshold-pilot-verify.mjs <battleId>

import { pathToFileURL } from 'node:url';
import {
  stockModelRoute, positions, isStock, committedStockContext, stockRewardContext, validCommittedStockScores, displayedStockScores, stockSummary, initialRewardHistory,
} from '../src/utils/stockThresholdModel.js';
import { calculateAssetScoreV3 } from '../src/utils/baggerBombUtils.js';
import { readCorrectedInputs } from '../api/_utils/stockThresholdAdmission.js';

const round2 = n => Math.round(n * 100) / 100;

/**
 * The six exact targets of a receipt, from the model itself: its fill quote
 * (same time, same price) against the lifetime's initial history — targets
 * depend on the receipt alone, never on how far the history has advanced.
 */
function receiptTargets(battle, p) {
  const r = p.asset.stockThresholdReceipt;
  if (!r?.fillQuote || !r.positionId) return null;
  const histories = battle.scoring?.stockRewardHistory || {};
  const view = { ...battle, scoring: { ...battle.scoring, stockRewardHistory: { ...histories, [p.side]: { ...(histories[p.side] || {}), [r.positionId]: initialRewardHistory(r) } } } };
  const c = stockRewardContext(view, p.asset, p.side, p.tier, p.slot, { price: r.fill, asOf: r.fillQuote.quoteAsOf, observedAt: r.fillQuote.observedAt });
  return c.status === 'valid' ? c.targets : null;
}

/** Pure: the report for a battle document (with `id`). `replay` is the input replay outcome. */
export function verifyBattle(battle, replay = { status: 'not_run' }) {
  const route = stockModelRoute(battle);
  const lines = [];
  const out = { battleId: battle.id, route: route.status, reason: route.reason ?? null, positions: [], sides: {}, valid: false, replay };
  lines.push(`battle ${battle.id}: ${battle.status} · route ${route.status}${route.reason ? ` (${route.reason})` : ''} · model ${battle.scoring?.stockThresholdModel?.modelId ?? '(none)'}`);
  if (route.status !== 'corrected') { lines.push('not a measured-model battle: nothing to verify'); return { ...out, lines }; }
  for (const p of positions(battle)) {
    const row = { side: p.side, tier: p.tier, slot: p.slot, symbol: p.asset.symbol, stock: isStock(p.asset) };
    if (!row.stock) { lines.push(`${p.side} ${p.tier}[${p.slot}] ${p.asset.symbol}: crypto (legacy scorer)`); out.positions.push(row); continue; }
    const r = p.asset.stockThresholdReceipt || {};
    const targets = receiptTargets(battle, p);
    const c = committedStockContext(battle, p.asset, p.side, p.tier, p.slot);
    const score = calculateAssetScoreV3({ ...p.asset, tier: p.tier }, null, {}, {}, null, c);
    Object.assign(row, { positionId: p.asset.positionId, receiptPct: r.scoringPctDecimal ?? null, fill: r.fill ?? null, fillQuoteAt: r.fillQuote?.quoteAsOf ?? null, enteredAt: r.enteredAt ?? null, sourceSession: r.sourceSession ?? null,
      targets: targets ? Object.fromEntries(targets.map(t => [t.key, t.target])) : null, context: c.status === 'valid' ? { currentPrice: c.currentPrice, quoteAt: c.quoteEvidence?.providerAsOf, multiplier: c.multiplier, crossedTiers: c.crossedTiers, nextTarget: c.nextTarget?.key ?? null, locked: c.proximity?.locked === true } : { status: c.status, reason: c.reason },
      points: score.totalPoints });
    out.positions.push(row);
    lines.push(`${p.side} ${p.tier}[${p.slot}] ${p.asset.symbol} · receipt ${row.receiptPct}% (session ${row.sourceSession}) · fill $${row.fill} quoted ${row.fillQuoteAt} · entered ${row.enteredAt}`);
    lines.push(`   targets ${targets ? targets.map(t => `${t.key} $${t.target} (~$${stockSummary(t.target)})`).join(' · ') : 'unavailable'}`);
    lines.push(`   committed ${c.status === 'valid' ? `$${c.currentPrice} @ ${c.quoteEvidence?.providerAsOf} · ${stockSummary(c.multiplier)}x · crossed [${c.crossedTiers.join('|')}] · next ${c.nextTarget?.key ?? 'none'}${c.proximity?.locked ? ' · LOCK' : ''}` : `unavailable (${c.reason})`} · points ${score.totalPoints ?? 'n/a'}`);
  }
  const ss = battle.scoreState || {};
  for (const side of ['agent', 'cpu']) {
    const stockPoints = out.positions.filter(p => p.side === side && p.stock).map(p => p.points);
    const stockActive = stockPoints.every(Number.isFinite) ? stockPoints.reduce((a, b) => a + b, 0) : null;
    const banked = Object.values(battle.scoring?.stockScoreComponents || {}).filter(c => c.side === side).reduce((a, c) => a + c.points, 0);
    const stored = side === 'agent' ? ss.currentScore : ss.opponentScore;
    const storedActive = side === 'agent' ? ss.activeScore : (Number.isFinite(stored) ? stored - banked : null);
    // Crypto keeps the legacy scorer on live prices, which the committed frame does
    // not store per asset: it is the remainder, reported, never recomputed here.
    const other = Number.isFinite(storedActive) && Number.isFinite(stockActive) ? round2(storedActive - stockActive) : null;
    // A side without crypto has no remainder to explain: its recomputed stock
    // points must equal the stored active score (review mutation lens S5).
    const holdsCrypto = out.positions.some(p => p.side === side && !p.stock);
    const agrees = Number.isFinite(stored) && Number.isFinite(stockActive)
      && (side === 'cpu' ? banked === 0 : ss.bankedScore === banked && round2(ss.activeScore + ss.bankedScore) === round2(stored))
      && (holdsCrypto || other === 0);
    out.sides[side] = { stored: stored ?? null, stockActive, cryptoRemainder: other, holdsCrypto, banked, agrees };
    lines.push(`${side}: stored ${stored ?? 'unavailable'} · stock positions recomputed ${stockActive ?? 'n/a'} · ${holdsCrypto ? `crypto remainder ${other ?? 'n/a'} (legacy scorer, not recomputed)` : `no crypto: remainder ${other ?? 'n/a'} must be 0`} · banked components ${banked} → ${agrees ? 'AGREES' : 'CHECK'}`);
  }
  out.valid = validCommittedStockScores(battle);
  const shown = displayedStockScores(battle);
  lines.push(`committed scores valid: ${out.valid} · shown to readers: ${shown.currentScore ?? '—'} vs ${shown.opponentScore ?? '—'} · inputs replay: ${replay.status}${replay.reason ? ` (${replay.reason})` : ''}`);
  return { ...out, lines };
}

export async function run(battleId, { db, log = console.log }) {
  if (typeof battleId !== 'string' || !battleId) throw new Error('usage: node scripts/stock-threshold-pilot-verify.mjs <battleId>');
  const snap = await db.collection('agentBattles').doc(battleId).get();
  if (!snap.exists) throw new Error(`agentBattles/${battleId} not found`);
  const battle = { id: battleId, ...snap.data() };
  let replay = { status: 'not_run' };
  if (stockModelRoute(battle).status === 'corrected') {
    try { await readCorrectedInputs({ get: ref => ref.get() }, db, battle); replay = { status: 'ok' }; } catch (err) { replay = { status: 'failed', reason: err?.reason || err?.message }; }
  }
  const report = verifyBattle(battle, replay);
  for (const line of report.lines) log(line);
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await import('./loadLocalEnv.js');
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  run(process.argv[2], { db: getFirebaseAdmin() }).catch(err => { console.error(err.message); process.exitCode = 1; });
}
