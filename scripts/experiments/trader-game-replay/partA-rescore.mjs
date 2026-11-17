#!/usr/bin/env node
// scripts/experiments/trader-game-replay/partA-rescore.mjs
//
// Part A — bank on exit (rulings BB-14, Q20, Q21). Offline and deterministic:
// reads only the local export. It imports the REAL scorer and never copies its
// math (BUILD_RULES §4):
//   - calculateAssetScoreServer, flattenPortfolioServer  (api/_utils/agentScoring.js — fenced, CALLED only)
//   - stockRewardContext, initialRewardHistory, stockModelRoute, positions, isStock
//                                                        (src/utils/stockThresholdModel.js)
// The measured held-position score is the composition the cron uses
// (scoreCorrectedPosition, api/_utils/stockThresholdAdmission.js): a reward
// context from stockRewardContext, scored by calculateAssetScoreServer(asset,
// null, {}, {}, null, context). That module is not imported because it pulls in
// the live measurement provider.
//
// Two legs per position, one scorer call each:
//   stored   — the touch record as stored (the gate: must reproduce the stored score within 0.01)
//   rescored — Q20: the same call with the upside touch reset. Legacy: maxMultiplier 0, minMultiplier
//              kept. Measured: the history reset to the fill (initialRewardHistory), the stored low kept,
//              and the earned tiers trimmed to the stored penalty tiers; the context then re-derives
//              which bonus tiers the exit (or last scored) price clears.
//
// USAGE: node scripts/experiments/trader-game-replay/partA-rescore.mjs --in <export dir>

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { calculateAssetScoreServer, flattenPortfolioServer } from '../../../api/_utils/agentScoring.js';
import { stockRewardContext, initialRewardHistory, stockModelRoute, positions, isStock } from '../../../src/utils/stockThresholdModel.js';
import { BAGGER_TIERS, BUST_TIERS, THRESHOLD_POINTS } from '../../../src/constants/baggerBombScoring.js';
import { parseArgs, bundles, writeResult, etOf, round2, sum, mean, groupBy, mdTable, pct } from './replayLib.mjs';

const TOL = 0.01;
const C2_FIRST_DAY = '2026-10-28'; // the day-1 baseline follows timing.tradingDays[0] from here (commit "BaggerBomb cleanup C1+C2", 28 Oct 2026)
const BONUS_KEYS = new Set(BAGGER_TIERS.map((t) => t.key));
const PENALTY_KEYS = new Set(BUST_TIERS.map((t) => t.key));
const bonusOf = (badges) => sum((badges || []).filter((k) => BONUS_KEYS.has(k)).map((k) => THRESHOLD_POINTS[k]));
const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= TOL;

// ---------------------------------------------------------------- legacy legs

/** The touch record in either stored shape: live fields, or day 1 after the nightly reset. */
export function legacyHistory(th) {
  if (!th) return { maxMultiplier: 0, minMultiplier: 0, shape: 'none' };
  const live = (th.maxMultiplier || 0) !== 0 || (th.minMultiplier || 0) !== 0;
  const day1 = th.dailyThresholds?.day1;
  if (!live && day1) return { maxMultiplier: day1.maxMultiplier || 0, minMultiplier: day1.minMultiplier || 0, shape: 'day1' };
  return { maxMultiplier: th.maxMultiplier || 0, minMultiplier: th.minMultiplier || 0, shape: live ? 'live' : 'zero' };
}

/** Was `iso` on the battle's activation day, by the rule the cron ran at the time (agent-evaluate.js:1271). */
export function activationDayAt(battle, iso) {
  const day = etOf(iso)?.date;
  const first = battle.timing?.tradingDays?.[0];
  const activation = first && first >= C2_FIRST_DAY ? first : etOf(battle.activatedAt)?.date;
  return !!day && day === activation;
}

/**
 * One legacy position, both legs. Inputs mirror agent-evaluate.js:1296–1346 (held) and
 * agentSwapExecution.js:333–394 (sold): entry, threshold baseline, baseATR, tier, direction.
 * `baselineKnown` is false when the baseline was the previous close, which is not stored; the
 * entry then stands in for it and the position is marked.
 */
export function legacyLegs({ symbol, baseATR, tier, direction, entry, price, history, baselineKnown }) {
  const asset = { symbol, baseATR, tier, direction: direction || null };
  const change = ((price - entry) / entry) * 100;
  const stored = calculateAssetScoreServer(asset, change, { maxMultiplier: history.maxMultiplier, minMultiplier: history.minMultiplier }, {}, change);
  const rescored = calculateAssetScoreServer(asset, change, { maxMultiplier: 0, minMultiplier: history.minMultiplier }, {}, change);
  // With the true baseline unknown, any stored bonus is in doubt in either direction (review A1), not only
  // when the entry-based legs differ: such a position excludes its battle.
  return { stored: stored.totalPoints, rescored: rescored.totalPoints, storedBonus: bonusOf(stored.badges), rescoredBonus: bonusOf(rescored.badges), approx: !baselineKnown && bonusOf(stored.badges) > 0, baselineUnknown: !baselineKnown };
}

function legacyHeld(battle, asset, gaps) {
  const sym = asset.symbol;
  const swap = asset.swapPrice || asset.previousSwapPrice || null;
  const entry = swap || battle.portfolio?.startingPrices?.[sym] || 0;
  const price = battle.cronState?.lastTickPrice?.[sym];
  if (!(price > 0)) { gaps.push('no last price for a held position'); return null; }
  if (!(entry > 0)) { gaps.push('no entry price for a held position'); return null; }
  const baselineKnown = !!swap || activationDayAt(battle, battle.scoreState?.lastScoredAt);
  return { symbol: sym, kind: 'held', ...legacyLegs({ symbol: sym, baseATR: asset.baseATR, tier: asset.tier, direction: asset.direction, entry, price, history: legacyHistory(battle.thresholdHistory?.[sym]), baselineKnown }) };
}

/** Receipt ↔ trade: same outgoing symbol and the same instant; else the nearest within 60 s. */
export function joinReceipt(trade, receipts, used) {
  const same = receipts.filter((r) => !used.has(r) && r.symbolOut === trade.symbolOut);
  let hit = same.find((r) => r.timestamp === trade.swappedOutAt);
  if (!hit) hit = same.filter((r) => Math.abs(Date.parse(r.timestamp) - Date.parse(trade.swappedOutAt)) <= 60_000).sort((a, b) => Math.abs(Date.parse(a.timestamp) - Date.parse(trade.swappedOutAt)) - Math.abs(Date.parse(b.timestamp) - Date.parse(trade.swappedOutAt)))[0];
  if (hit) used.add(hit);
  return hit || null;
}

function legacySold(battle, trade, receipt, gaps) {
  const gr = receipt?.guardrailReplay;
  if (!gr) { gaps.push('a sale has no receipt (its touch record at the sale is not stored)'); return null; }
  if (!gr.thresholdHistory) { gaps.push('a sale receipt has no touch record'); return null; }
  const entry = gr.outgoingEntryPrice ?? trade.entryPrice;
  const baselineKnown = gr.outgoingSwappedInAt != null || activationDayAt(battle, trade.swappedOutAt);
  // The unit, in the executor's own precedence (agentSwapExecution.js:347–348); the receipt's copy stands in for the slot's.
  const unit = battle.scoring?.thresholds?.[trade.symbolOut]?.threshold || gr.outgoingBaseATR || 2.5;
  const legs = legacyLegs({ symbol: trade.symbolOut, baseATR: unit, tier: trade.tier, direction: trade.direction, entry, price: trade.exitPrice, history: { maxMultiplier: gr.thresholdHistory.maxMultiplier || 0, minMultiplier: gr.thresholdHistory.minMultiplier || 0 }, baselineKnown });
  return { symbol: trade.symbolOut, kind: 'sold', ...legs, storedLocked: trade.lockedPoints };
}

// -------------------------------------------------------------- measured legs

/** The reward context with `history` in place of the stored one (a clone; the battle is not changed). */
function contextWith(battle, asset, side, tier, slot, quote, history) {
  const hist = battle.scoring.stockRewardHistory || {};
  const clone = { ...battle, scoring: { ...battle.scoring, stockRewardHistory: { ...hist, [side]: { ...(hist[side] || {}), [asset.positionId]: history } } } };
  return stockRewardContext(clone, asset, side, tier, slot, quote);
}

export function measuredLegs(battle, asset, side, tier, slot, quote) {
  const stored = battle.scoring.stockRewardHistory?.[side]?.[asset.positionId];
  if (!stored) return { error: 'no stored reward history' };
  const reset = { ...initialRewardHistory(asset.stockThresholdReceipt), low: stored.low, crossedTiers: (stored.crossedTiers || []).filter((k) => PENALTY_KEYS.has(k)) };
  const a = { ...asset, tier };
  const s = calculateAssetScoreServer(a, null, {}, {}, null, contextWith(battle, asset, side, tier, slot, quote, stored));
  const r = calculateAssetScoreServer(a, null, {}, {}, null, contextWith(battle, asset, side, tier, slot, quote, reset));
  if (s.status !== 'valid') return { error: `stored context ${s.reason}` };
  if (r.status !== 'valid') return { error: `reset context ${r.reason}` };
  return { stored: s.totalPoints, rescored: r.totalPoints, storedBonus: bonusOf(s.badges), rescoredBonus: bonusOf(r.badges), approx: false };
}

const quoteOf = (c) => ({ price: c?.currentPrice, asOf: c?.quoteEvidence?.providerAsOf, observedAt: c?.quoteEvidence?.observedAt });

function measuredSide(battle, side, gaps, label) {
  const out = [];
  for (const p of positions(battle).filter((x) => x.side === side)) {
    if (!isStock(p.asset)) continue;
    const c = battle.scoring.stockRewardContexts?.[side]?.[p.asset.positionId];
    if (c?.status !== 'valid') { gaps.push(`${label}: last frame unavailable for a held position`); continue; }
    const legs = measuredLegs(battle, p.asset, side, p.tier, p.slot, quoteOf(c));
    if (legs.error) { gaps.push(`${label}: ${legs.error}`); continue; }
    // Each position's stored leg must equal the score of its committed frame (review A2): this checks the
    // CPU's stock legs on their own, where the battle total cannot (the CPU crypto slot has no stored price).
    const committed = calculateAssetScoreServer({ ...p.asset, tier: p.tier }, null, {}, {}, null, c).totalPoints;
    if (!near(legs.stored, committed)) { gaps.push(`${label}: a position does not match its committed frame`); continue; }
    out.push({ symbol: p.asset.symbol, kind: 'held', side, ...legs });
  }
  return out;
}

function measuredSold(battle, trade, gaps) {
  const r = trade.outgoingReceipt;
  if (!r || !trade.rewardContext) { gaps.push('measured sale without its receipt or exit context'); return null; }
  const asset = { symbol: r.symbol, positionId: r.positionId, slotVersion: r.slotVersion, stockThresholdReceipt: r, direction: trade.direction || null };
  const legs = measuredLegs(battle, asset, 'agent', r.tier, r.slot, quoteOf(trade.rewardContext));
  if (legs.error) { gaps.push(`measured sale: ${legs.error}`); return null; }
  return { symbol: r.symbol, kind: 'sold', side: 'agent', ...legs, storedLocked: battle.scoring.stockScoreComponents?.[r.positionId]?.points ?? trade.lockedPoints };
}

// ------------------------------------------------------------------ a battle

export function rescoreBattle(battle, receipts) {
  const route = stockModelRoute(battle).status;
  const ss = battle.scoreState || {};
  const gaps = [];
  const opponentNotes = [];
  if (!Number.isFinite(ss.currentScore) || !Number.isFinite(ss.opponentScore)) gaps.push('no final score');
  if (battle.timing?.lastDailyResetAt && ss.lastScoredAt && ss.lastScoredAt > battle.timing.lastDailyResetAt) gaps.push('final score written after the nightly reset');
  if ((battle.trades || []).length >= 50 || (ss.tradeCount ?? 0) !== (battle.trades || []).length) gaps.push('trade list incomplete');
  if (gaps.length) return { route, gaps, opponentNotes };

  const agent = [];
  const cpu = [];
  const used = new Set();
  const flat = flattenPortfolioServer(battle.portfolio);
  if (route === 'legacy') {
    for (const a of flat) { const r = legacyHeld(battle, a, gaps); if (r) agent.push(r); }
    for (const t of battle.trades || []) { const r = legacySold(battle, t, joinReceipt(t, receipts, used), gaps); if (r) agent.push(r); }
    opponentNotes.push('legacy CPU side: no stored last price per CPU position, so its score is not reproduced (not verified); it has no touch memory, so bank on exit cannot change it');
  } else if (route === 'corrected') {
    agent.push(...measuredSide(battle, 'agent', gaps, 'agent'));
    for (const a of flat.filter((x) => !isStock(x))) { const r = legacyHeld(battle, a, gaps); if (r) agent.push({ ...r, crypto: true }); }
    for (const t of battle.trades || []) {
      if (t.isCrypto) { const r = legacySold(battle, t, joinReceipt(t, receipts, used), gaps); if (r) agent.push({ ...r, crypto: true }); continue; }
      const r = measuredSold(battle, t, gaps); if (r) agent.push(r);
    }
    cpu.push(...measuredSide(battle, 'cpu', gaps, 'cpu'));
  } else gaps.push(`scoring route ${route}`);
  if (gaps.length) return { route, gaps, opponentNotes };

  // ---- the gate: active, banked, total; each sale against its stored locked points.
  const held = agent.filter((p) => p.kind === 'held');
  const sold = agent.filter((p) => p.kind === 'sold');
  const storedBanked = route === 'legacy' ? sum((battle.trades || []).map((t) => (Number.isFinite(t?.lockedPoints) ? t.lockedPoints : 0))) : sum(Object.values(battle.scoring.stockScoreComponents || {}).filter((c) => c.side === 'agent').map((c) => c.points));
  if (!near(sum(held.map((p) => p.stored)), ss.activeScore)) gaps.push('active score does not reproduce');
  if (sold.some((p) => !near(p.stored, p.storedLocked))) gaps.push('a sale\'s locked points do not reproduce');
  if (!near(storedBanked, ss.bankedScore)) gaps.push('banked score does not equal the stored sales');
  if (!near(ss.activeScore + ss.bankedScore, ss.currentScore)) gaps.push('active + banked does not equal the stored total');
  if (gaps.length) return { route, gaps, opponentNotes };
  if (agent.some((p) => p.approx)) return { route, gaps: ['touch baseline was the previous close (not stored) and a position holds a bonus'], opponentNotes };

  // ---- the opponent.
  let opponentRescored = ss.opponentScore;
  let opponentGate = 'not verified';
  if (route === 'corrected') {
    const cpuBanked = sum(Object.values(battle.scoring.stockScoreComponents || {}).filter((c) => c.side === 'cpu').map((c) => c.points));
    const residual = ss.opponentScore - sum(cpu.map((p) => p.stored)) - cpuBanked;
    const cpuCrypto = positions(battle).filter((p) => p.side === 'cpu' && !isStock(p.asset)).length;
    if (cpuCrypto === 0 && !near(residual, 0)) return { route, gaps: ['opponent score does not reproduce'], opponentNotes };
    opponentGate = cpuCrypto ? 'CPU stock positions match their committed frames; the CPU crypto slot (legacy scorer, no stored price) is the remainder, not verified' : 'reproduces';
    opponentRescored = sum(cpu.map((p) => p.rescored)) + cpuBanked + residual;
  }
  const agentRescored = sum(agent.map((p) => p.rescored));
  return { route, gaps, opponentNotes, opponentGate, agent, cpu, stored: ss.currentScore, rescored: agentRescored, opponentStored: ss.opponentScore, opponentRescored };
}

const winner = (a, o) => (a > o ? 'agent' : a < o ? 'cpu' : 'draw');

// ------------------------------------------------------------- the self-test

export function selftest(firstMeasured) {
  const fail = (m) => { throw new Error(`selftest: ${m}`); };
  // Legacy: peak 1.2 units, exit 0.8 → the +15 drops; exit 1.1 → unchanged.
  const base = { symbol: 'TEST', baseATR: 2, tier: 'star', direction: null, entry: 100, history: { maxMultiplier: 1.2, minMultiplier: 0 }, baselineKnown: true };
  const drop = legacyLegs({ ...base, price: 101.6 });
  if (drop.storedBonus !== 15 || drop.rescoredBonus !== 0 || drop.stored - drop.rescored !== 15) fail(`legacy planted drop ${JSON.stringify(drop)}`);
  const keep = legacyLegs({ ...base, price: 102.2 });
  if (keep.storedBonus !== 15 || keep.rescored !== keep.stored) fail(`legacy control ${JSON.stringify(keep)}`);
  // An unknown (previous-close) baseline with a stored bonus is flagged even when the legs agree (review A1/A6).
  if (!legacyLegs({ ...base, price: 102.2, baselineKnown: false }).approx || legacyLegs({ ...base, history: { maxMultiplier: 0.4, minMultiplier: 0 }, price: 100.4, baselineKnown: false }).approx) fail('previous-close guard');
  // Both stored shapes of the legacy touch record (review A6).
  const day1 = legacyHistory({ maxMultiplier: 0, minMultiplier: 0, dailyThresholds: { day1: { maxMultiplier: 1.2, minMultiplier: -0.3 } } });
  const live = legacyHistory({ maxMultiplier: 0.7, minMultiplier: -0.1 });
  if (day1.maxMultiplier !== 1.2 || day1.minMultiplier !== -0.3 || live.maxMultiplier !== 0.7 || live.shape !== 'live') fail('touch-record shapes');
  // Measured: plant a touch on a real stored position (real receipt, real validators).
  const p = positions(firstMeasured).find((x) => x.side === 'agent' && isStock(x.asset) && firstMeasured.scoring.stockRewardContexts?.agent?.[x.asset.positionId]?.status === 'valid');
  if (!p) fail('no measured position to plant on');
  const r = p.asset.stockThresholdReceipt;
  const c = firstMeasured.scoring.stockRewardContexts.agent[p.asset.positionId];
  const at = (u) => r.fill * (1 + (u * r.scoringPct) / 100);
  const plant = (exitUnits) => {
    const h = { ...firstMeasured.scoring.stockRewardHistory.agent[p.asset.positionId], high: at(1.2), low: Math.min(r.fill, at(exitUnits)), crossedTiers: ['bagger'] };
    const b = { ...firstMeasured, scoring: { ...firstMeasured.scoring, stockRewardHistory: { ...firstMeasured.scoring.stockRewardHistory, agent: { ...firstMeasured.scoring.stockRewardHistory.agent, [p.asset.positionId]: h } } } };
    return measuredLegs(b, p.asset, 'agent', p.tier, p.slot, { ...quoteOf(c), price: at(exitUnits) });
  };
  const mDrop = plant(0.8);
  if (mDrop.error || mDrop.storedBonus !== 15 || mDrop.rescoredBonus !== 0) fail(`measured planted drop ${JSON.stringify(mDrop)}`);
  const mKeep = plant(1.1);
  if (mKeep.error || mKeep.storedBonus !== 15 || mKeep.rescored !== mKeep.stored) fail(`measured control ${JSON.stringify(mKeep)}`);
  return 'selftest passed: legacy and measured planted drops lose +15; both controls unchanged; previous-close guard and both touch-record shapes hold';
}

// ---------------------------------------------------------------------- main

function main() {
  const flags = parseArgs(process.argv);
  const all = [...bundles(flags.in)];
  const firstMeasured = all.find((b) => stockModelRoute(b.battle).status === 'corrected')?.battle;
  console.log(selftest(firstMeasured));

  const rows = all.map(({ label, row, battle, receipts }) => ({ label, archetype: row.archetype, route: row.route, ...rescoreBattle(battle, receipts) }));
  const kept = rows.filter((r) => !r.gaps.length);
  const excluded = rows.filter((r) => r.gaps.length);
  for (const r of kept) {
    r.diff = r.rescored - r.stored;
    r.before = winner(r.stored, r.opponentStored);
    r.after = winner(r.rescored, r.opponentRescored);
    r.flip = r.before !== r.after;
    const ps = [...r.agent, ...r.cpu];
    r.bonusStored = sum(ps.map((p) => p.storedBonus));
    r.bonusLost = sum(ps.map((p) => p.storedBonus - p.rescoredBonus));
    r.agentBonusStored = sum(r.agent.map((p) => p.storedBonus));
    r.agentBonusLost = sum(r.agent.map((p) => p.storedBonus - p.rescoredBonus));
    r.cpuDiff = r.opponentRescored - r.opponentStored;
  }

  console.log(`\n## Part A — ${rows.length} completed battles; ${kept.length} pass the gate; ${excluded.length} excluded; ${kept.filter((r) => r.diff !== 0 || r.cpuDiff !== 0).length} change under bank on exit\n`);
  console.log('### Exclusions\n');
  console.log(mdTable(excluded, [['Battle', (r) => r.label], ['Archetype', (r) => r.archetype], ['Path', (r) => r.route], ['Reason', (r) => [...new Set(r.gaps)].join('; ')]]));
  console.log('\n### Per battle\n');
  console.log(mdTable(kept, [['Battle', (r) => r.label], ['Archetype', (r) => r.archetype], ['Path', (r) => r.route], ['Stored', (r) => r.stored], ['Rescored', (r) => r.rescored], ['Δ agent', (r) => r.diff], ['CPU stored', (r) => r.opponentStored], ['CPU rescored', (r) => r.opponentRescored], ['Winner before', (r) => r.before], ['Winner after', (r) => r.after], ['Opponent gate', (r) => r.opponentGate]]));
  const agg = (label, rs) => ({ label, n: rs.length, meanDiff: mean(rs.map((r) => r.diff)), meanCpuDiff: mean(rs.map((r) => r.cpuDiff)), flips: rs.filter((r) => r.flip).length, changed: rs.filter((r) => r.diff !== 0 || r.cpuDiff !== 0).length, share: pct(sum(rs.map((r) => r.bonusLost)), sum(rs.map((r) => r.bonusStored))), agentShare: pct(sum(rs.map((r) => r.agentBonusLost)), sum(rs.map((r) => r.agentBonusStored))) });
  const cols = [['Group', (a) => a.label], ['Battles', (a) => a.n], ['Changed', (a) => a.changed], ['Mean Δ agent', (a) => a.meanDiff], ['Mean Δ CPU', (a) => a.meanCpuDiff], ['Winner flips', (a) => a.flips], ['Banked bonus points lost, both sides', (a) => a.share], ['Agent side only', (a) => a.agentShare]];
  const byPath = groupBy(kept, (r) => r.route).map(([k, rs]) => agg(k, rs));
  const byArch = groupBy(kept, (r) => r.archetype).map(([k, rs]) => agg(k, rs));
  console.log('\n### By path\n');
  console.log(mdTable([...byPath, agg('all', kept)], cols));
  console.log('\n### By archetype\n');
  console.log(mdTable(byArch, cols));
  console.log('\n### Legacy flips (the CPU side has no touch memory and cannot lose points)\n');
  console.log(mdTable(kept.filter((r) => r.route === 'legacy' && r.flip), [['Battle', (r) => r.label], ['Stored', (r) => r.stored], ['Rescored', (r) => r.rescored], ['CPU', (r) => r.opponentStored], ['Before', (r) => r.before], ['After', (r) => r.after]]));
  const posLost = kept.flatMap((r) => [...r.agent, ...r.cpu].map((p) => ({ ...p, label: r.label }))).filter((p) => p.storedBonus !== p.rescoredBonus);
  const allPos = kept.flatMap((r) => [...r.agent, ...r.cpu]);
  const unknown = kept.filter((r) => r.agent.some((p) => p.baselineUnknown));
  console.log(`\nPositions rescored: ${allPos.length} (held ${allPos.filter((p) => p.kind === 'held').length}, sold ${allPos.filter((p) => p.kind === 'sold').length}; sold with a stored bonus ${allPos.filter((p) => p.kind === 'sold' && p.storedBonus > 0).length}). Positions whose touch baseline was the previous close (not stored; the entry stood in): ${allPos.filter((p) => p.baselineUnknown).length} in ${unknown.length} battles, holding ${sum(allPos.filter((p) => p.baselineUnknown).map((p) => p.storedBonus))} bonus points (a stored bonus there would have excluded the battle).`);
  console.log(`\nPositions that lose a bonus: ${posLost.length} (held to the end ${posLost.filter((p) => p.kind === 'held').length}, sold ${posLost.filter((p) => p.kind === 'sold').length}; CPU side ${posLost.filter((p) => p.side === 'cpu').length})`);
  writeResult(flags.in, 'partA.json', { rows, byPath, byArch });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
