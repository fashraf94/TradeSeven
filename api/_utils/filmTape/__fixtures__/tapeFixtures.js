// api/_utils/filmTape/__fixtures__/tapeFixtures.js
//
// Fixture battle-days for the tape suites (build prompt Stage A):
//   capturedDay     — a captured day with swaps, plans, a directive (three
//                     card states), a deferral, a gap, a degraded check
//   noTriggerDay    — a no_trigger-heavy day, clean capture, no deferral
//   budgetDay       — a budget_skipped day (platform placeholder rationale)
//   completedDay    — a completed single-day battle
//   multiDay        — a five-day battle whose evaluations[] sits at 150
//   skippedModeDay  — a flat6/tournament battle (BA-3)
//   preCaptureDay   — a day before the capture flip: no ticks, entries + trades
//
// FAITHFUL BY CONSTRUCTION where the platform's composer is pure: every tick
// document is produced by the capture writer's own composer
// (buildCaptureDocuments over a createTickCaptureContext), which runs the
// permanent-record allowlist — `makeTick` asserts NOTHING was rejected, so a
// fixture field the real record could not carry fails here. The evidence,
// candidates and heard stamps come from tickStamps.js's own composers. Shapes
// with no pure composer in reach (the entry envelope, trades, receipts, run
// records, calls, chat exchanges) follow the writers cited in the build
// report §1.3.

import { createTickCaptureContext } from '../../tickCapture/captureContext.js';
import { buildCaptureDocuments, resolveBodyHolder } from '../../tickCapture/captureWriter.js';
import { resolveCaptureSchema } from '../../tickCapture/captureConfig.js';
import { composeEvidenceStamp, composeCandidatesStamp, deriveHeardStamp } from '../../tickStamps.js';

export const OWNER = 'owner-1';
export const AGENT = 'agent-1';
const iso = (ms) => new Date(ms).toISOString();
const at = (date, hhmmss) => Date.parse(`${date}T${hhmmss}.000Z`);

/** A permanent tick document, composed by the capture writer itself. */
export async function makeTick({
  battleId, tickSeq, capturedAtMs, exitReason, stages, evalId = null, day = '1',
  scores = null, verdicts = null, decision = null, actions = [], controls = null,
  modelFailureClass = null, guardrail = null, evidenceKeys = [], symbols = [],
}) {
  const ctx = createTickCaptureContext({ battleId, tickSeq, agentId: AGENT, ownerId: OWNER, gameMode: 'baggerbomb_agent', enabled: true, startedAtMs: capturedAtMs - 20_000 });
  ctx.schema(resolveCaptureSchema({ callsEnabled: true }));
  ctx.universe({ heldSymbols: symbols, benchSymbols: [], candidateSymbols: [] });
  for (const s of stages) ctx.stage(s);
  ctx.exit(exitReason);
  if (evalId) ctx.identify({ evalId, day, battlePhase: 'midday' });
  if (scores) ctx.scores(scores);
  if (verdicts) ctx.risk({ verdicts, evaluatedCount: Object.keys(verdicts).length, lockedCount: 0, forcedExitCount: Object.values(verdicts).filter((v) => v.action !== 'HOLD').length });
  if (decision) ctx.decision(decision);
  if (modelFailureClass) ctx.model({ outcome: 'failed', failureClass: modelFailureClass, attempted: false });
  if (guardrail) ctx.guardrail(guardrail);
  for (const a of actions) ctx.action({ kind: 'swap', committed: true, ...a });
  if (controls) ctx.controls(controls);
  if (evidenceKeys.length) ctx.manifest({ evidenceKeys });
  const bodyFacts = await resolveBodyHolder(null);
  const { permanent, rejected } = buildCaptureDocuments(ctx.state, { nowMs: capturedAtMs, bodyFacts });
  if (rejected.length) throw new Error(`fixture tick ${battleId}:${tickSeq} had rejected fields: ${JSON.stringify(rejected)}`);
  return permanent;
}

const STAGES_TO = {
  degraded_quotes: ['quotes_checked'],
  no_trigger: ['quotes_checked', 'scores_marked', 'risk_evaluated', 'proposal_handled', 'gameplan_handled', 'trigger_evaluated'],
  gameplan_pending: ['quotes_checked', 'scores_marked', 'risk_evaluated', 'proposal_handled', 'gameplan_handled'],
  completed: ['quotes_checked', 'scores_marked', 'risk_evaluated', 'proposal_handled', 'gameplan_handled', 'trigger_evaluated', 'prompt_built', 'model_returned', 'decision_resolved', 'finalized'],
};

function evidenceFor(held, pxBase = 100) {
  return composeEvidenceStamp({
    assetScores: held.map((s, i) => ({ symbol: s, priceChange: 0.5 + i, multiplier: 0.2 + i / 10 })),
    prices: Object.fromEntries(held.map((s, i) => [s, { current: pxBase + i }])),
    momentumData: {
      vwap: Object.fromEntries(held.map((s) => [s, { vwapDeviation: 0.31 }])),
      rankings: Object.fromEntries(held.map((s) => [s, { bBandwidthPercentile: 42, nr7Flag: false }])),
    },
    stockRegimes: Object.fromEntries(held.map((s) => [s, 'trending'])),
    riskStatus: Object.fromEntries(held.map((s) => [s, { action: 'HOLD' }])),
  });
}

/** An evaluation entry in the evaluator's envelope (agent-evaluate.js:3922-3991). */
function makeEntry({ evalId, timestampMs, decision = 'HOLD', total = 0, held = [], candidates = null, heardThread = null, budgetSkipped = false, rationale = 'Momentum intact; holding.', declarationsPhase = undefined, symbolOut = null, symbolIn = null }) {
  const promptBuiltAt = budgetSkipped ? null : iso(timestampMs - 8_000);
  const e = {
    evalId,
    timestamp: iso(timestampMs),
    day: 1,
    battlePhase: 'midday',
    decision,
    symbolOut,
    symbolIn,
    rationale: budgetSkipped ? 'Evaluation skipped — cron budget too low to start Haiku call. Defaulting to HOLD.' : rationale,
    hypothesis: budgetSkipped ? null : 'Trend continuation through the close.',
    scores: { active: total, banked: 0, total },
    haikuError: budgetSkipped ? { failureClass: 'budget_skipped', message: 'budget', timestamp: iso(timestampMs), evalId } : null,
    promptBuiltAt,
    buildMs: budgetSkipped ? null : 900,
    callMs: budgetSkipped ? null : 4200,
    tickMs: 6100,
    holdKind: budgetSkipped ? 'default_failure' : null,
    guardrailFault: null,
    // the model's echo fields — present on every entry, never the basis of Heard
    ignoredDirectiveIds: [],
    directiveThreadId: null,
  };
  if (!budgetSkipped && held.length) Object.assign(e, { evidence: evidenceFor(held) });
  if (!budgetSkipped && heardThread) e.heard = deriveHeardStamp({ directive: { effective: { directiveThreadId: heardThread } } });
  if (!budgetSkipped && candidates) { const c = composeCandidatesStamp(candidates); if (c) e.candidates = c; }
  if (declarationsPhase !== undefined) e.declarationsPhase = declarationsPhase;
  return e;
}

function tradeOf({ out, inn, tier, slotIndex, entryPrice, exitPrice, lockedPoints, lockedGainPct, swappedOutAt, source, exitReason, isCrypto = false }) {
  return { symbolOut: out, symbolIn: inn, name: out, tier, slotIndex, entryPrice, exitPrice, lockedPoints, lockedGainPct, swappedOutAt, swapDay: 1, isCrypto, direction: null, id: `trade_x`, source, exitReason, snapshot: null };
}

function receiptOf({ battleId, out, inn, tier, slotIndex, swappedOutAt, source, exitReason, outgoingEntryPrice, outgoingBaseATR, thresholdHistory, entryMark, entryATR, outgoingSwappedInAt = null, outgoingSwappedInDay = null, seq }) {
  return {
    schemaVersion: 1, capturedAt: swappedOutAt, evidenceClass: 'live_agent', archetype: 'speculator',
    agentId: AGENT, battleId, battleDay: 1, timestamp: swappedOutAt, receiptSeq: seq,
    symbolIn: inn, symbolOut: out, source, exitReason, haikuSwapReason: null,
    resolvedTier: tier, resolvedSlotIndex: slotIndex,
    entryMark, entryATR, entryAtrSource: 'scored_threshold',
    guardrailReplay: { outgoingEntryPrice, outgoingBaseATR, highWaterMark: null, trailActivation: null, trailStepLevel: null, thresholdHistory, outgoingSwappedInAt, outgoingSwappedInDay },
  };
}

function battleDoc(over) {
  return {
    ownerId: OWNER, agentId: AGENT, status: 'active', gameMode: 'baggerbomb_agent',
    duration: 'fullday', createdAt: '2026-09-24T12:00:00.000Z', activatedAt: '2026-09-24T12:00:00.000Z', completedAt: null,
    timing: { tradingDays: ['2026-09-24'], currentTradingDay: 1, timezone: 'America/New_York' },
    agentContext: { archetype: 'speculator', initialPortfolio: { star: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }], core: [{ symbol: 'NVDA' }, { symbol: 'AMD' }], support: [{ symbol: 'KO' }, { symbol: 'PEP' }, { symbol: 'BTC', isCrypto: true }] } },
    portfolio: { startingPrices: { AAPL: 230, MSFT: 420, NVDA: 120, AMD: 150, KO: 70, PEP: 170, BTC: 60000 } },
    scoreState: { currentScore: 0, activeScore: 0, bankedScore: 0, opponentScore: 0, bankedBadgePoints: { total: 0 }, tradeCount: 0 },
    cronState: { tickSeq: 0 },
    evaluations: [], trades: [], chatExchanges: [], statusFeed: [], dailyReviews: [],
    ...over,
  };
}

/** Put a battle-day into a store map (paths → documents). */
export function seedDay(store, { battleId, battle, ticks = [], receipts = [], calls = [], declarations = [], runs = [] }) {
  store[`agentBattles/${battleId}`] = battle;
  for (const t of ticks) store[`agentBattles/${battleId}/ticks/${t.tickId}`] = t;
  for (const r of receipts) store[`learningReceipts/${battleId}/receipts/${AGENT}_seq${r.receiptSeq}`] = r;
  for (const c of calls) store[`agentBattles/${battleId}/calls/${c.callId}`] = c;
  for (const id of declarations) store[`agentBattles/${battleId}/declarations/${id}`] = { battleId, evalId: id, calledShots: [], watching: ['NFLX'], playerAsk: null, fork: null, minted: [] };
  for (const r of runs) store[`agentEvalRuns/${r.startedAt}`] = r;
  return store;
}

const HELD = ['AAPL', 'MSFT', 'NVDA', 'AMD', 'KO', 'PEP'];
const verdictsFor = (held, over = {}) => ({ ...Object.fromEntries(held.map((s) => [s, { action: 'HOLD', reason: null }])), ...over });
const scoresAt = (total, opponent = 10) => ({ active: total - 5, banked: 5, total, opponent, bankedBadgePoints: 0 });

/**
 * THE MAIN FIXTURE — 2026-09-24 (Thursday; session 13:30Z–20:00Z).
 * Checks every 15 minutes from 13:30Z; the 15:00Z slot was DEFERRED by the run
 * that started then; seq 13 was minted and never captured (a gap).
 */
export async function capturedDay({ battleId = 'b-captured' } = {}) {
  const D = '2026-09-24';
  const slots = [];
  for (let m = 13 * 60 + 30; m <= 19 * 60 + 45; m += 15) slots.push(m);
  const tickSlots = slots.filter((m) => m !== 15 * 60); // 15:00Z deferred
  const held0 = [...HELD];
  const ticks = [];
  const evaluations = [];
  let seq = 0;
  let heldNow = [...held0];
  const swapRisk = { at: iso(at(D, '14:30:10')), out: 'AMD', inn: 'TSLA' };
  const swapModel = { at: iso(at(D, '16:15:05')), out: 'MSFT', inn: 'NFLX' };
  for (const m of tickSlots) {
    seq += 1;
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const capturedAtMs = at(D, `${hh}:${mm}:20`);
    const total = 10 + seq;
    if (seq === 13) continue; // minted, never captured
    let kind = 'no_trigger';
    if ([5, 6, 11, 12, 16].includes(seq)) kind = 'completed';
    if (seq === 10) kind = 'budget';
    if (seq === 20) kind = 'gameplan_pending';
    if (seq === 21) kind = 'degraded_quotes';
    const evalId = ['completed', 'budget'].includes(kind) ? `${battleId}:e${seq}` : null;
    const actions = [];
    if (seq === 5) actions.push({ source: 'risk_manager', exitReason: 'bust_avoidance', symbolOut: swapRisk.out, symbolIn: swapRisk.inn, swappedOutAt: swapRisk.at, lockedPoints: -12.5, entryPrice: 150 });
    if (seq === 12) actions.push({ source: 'haiku', exitReason: 'haiku_decision', symbolOut: swapModel.out, symbolIn: swapModel.inn, swappedOutAt: swapModel.at, lockedPoints: 8.25, entryPrice: 420 });
    const symbols = [...new Set([...heldNow, 'TSLA', 'NFLX'])];
    const tick = await makeTick({
      battleId, tickSeq: seq, capturedAtMs,
      exitReason: kind === 'budget' ? 'completed' : kind,
      stages: STAGES_TO[kind === 'budget' ? 'completed' : kind],
      evalId,
      scores: kind === 'degraded_quotes' ? null : scoresAt(total),
      verdicts: kind === 'degraded_quotes' ? null : verdictsFor(heldNow, seq === 5 ? { AMD: { action: 'EMERGENCY_SWAP', reason: 'bust_avoidance' } } : {}),
      decision: kind === 'completed' ? { original: seq === 12 ? 'SWAP' : 'HOLD', final: seq === 12 ? 'SWAP' : 'HOLD', holdKind: null } : (kind === 'budget' ? { final: 'HOLD', holdKind: 'default_failure' } : null),
      modelFailureClass: kind === 'budget' ? 'budget_skipped' : null,
      guardrail: kind === 'degraded_quotes' ? null : { evaluated: false, deployedCount: 0 },
      actions,
      controls: seq >= 6 && kind === 'completed' ? { rendered: 'resolved', directiveThreadId: 'th-1', directiveSuppressed: null } : null,
      evidenceKeys: kind === 'completed' ? heldNow : [],
      symbols,
    });
    ticks.push(tick);
    if (evalId) {
      evaluations.push(makeEntry({
        evalId, timestampMs: capturedAtMs - 5_000, total, held: heldNow,
        decision: seq === 12 ? 'SWAP' : 'HOLD',
        symbolOut: seq === 12 ? 'MSFT' : null, symbolIn: seq === 12 ? 'NFLX' : null,
        budgetSkipped: kind === 'budget',
        heardThread: seq >= 6 ? 'th-1' : null,
        candidates: seq === 11 ? [
          { symbol: 'NFLX', direction: 'potential_entry', signalSummary: 'Breaking out on volume', threshold: 'If it holds above 700 into the close, rotate in.', signalSource: 'breakout' },
          { symbol: 'KO', direction: 'potential_exit', signalSummary: 'Stalling', threshold: 'If it loses the morning low, exit.' },
        ] : null,
        declarationsPhase: seq === 11 ? 'expected' : 'none',
      }));
    }
    if (seq === 5) heldNow = heldNow.map((s) => (s === 'AMD' ? 'TSLA' : s));
    if (seq === 12) heldNow = heldNow.map((s) => (s === 'MSFT' ? 'NFLX' : s));
  }
  const battle = battleDoc({
    cronState: { tickSeq: seq },
    evaluations,
    trades: [
      tradeOf({ out: 'AMD', inn: 'TSLA', tier: 'core', slotIndex: 1, entryPrice: 150, exitPrice: 144.2, lockedPoints: -12.5, lockedGainPct: -3.867, swappedOutAt: swapRisk.at, source: 'risk_manager', exitReason: 'bust_avoidance' }),
      tradeOf({ out: 'MSFT', inn: 'NFLX', tier: 'star', slotIndex: 1, entryPrice: 420, exitPrice: 423.1, lockedPoints: 8.25, lockedGainPct: 0.738, swappedOutAt: swapModel.at, source: 'haiku', exitReason: 'haiku_decision' }),
    ],
    chatExchanges: [
      {
        userMessage: 'Be patient with the winners today.', agentResponse: 'Understood — I will hold winners through minor pullbacks.',
        hasDirective: true, directiveThreadId: 'th-1',
        directive: { text: 'Hold winners through minor pullbacks.', expiry: 'end_of_battle', directiveThreadId: 'th-1', adjustmentId: 'SP-hold-winners', canonicalTextVersion: 2 },
        timestamp: iso(at(D, '14:38:00')), mode: 'battle',
        archetypeGate: { classification: 'in_archetype', selectedAdjustmentId: 'SP-hold-winners', status: 'committed', repairUsed: false, originalUserAsk: 'PARAPHRASE-OF-PLAYER-1', counterOfferText: null, rejectionReason: null },
      },
      {
        userMessage: 'Sell everything right now.', agentResponse: 'That runs against how I trade; I will keep my plan.',
        hasDirective: false, directiveThreadId: null, directive: null,
        timestamp: iso(at(D, '16:30:00')), mode: 'battle',
        archetypeGate: { classification: 'core_conflict', selectedAdjustmentId: null, status: 'no_change', repairUsed: false, originalUserAsk: 'PARAPHRASE-OF-PLAYER-2', counterOfferText: 'COUNTER-OFFER-TEXT', rejectionReason: 'REJECTION-REASON-TEXT' },
      },
      {
        userMessage: 'Tilt into chips.', agentResponse: 'Done — I have filed a chip tilt.',
        hasDirective: false, directiveThreadId: null, directive: null,
        timestamp: iso(at(D, '17:10:00')), mode: 'battle',
        archetypeGate: { classification: 'in_archetype', selectedAdjustmentId: 'SP-chip-tilt', status: 'fit_mismatch', repairUsed: false, originalUserAsk: 'PARAPHRASE-OF-PLAYER-3', counterOfferText: null, rejectionReason: null, fitCheck: { expected: 'Tilt toward semiconductors.', quoted: false } },
      },
      { userMessage: null, agentResponse: 'Watching NFLX for a breakout.', messageType: 'anticipation', anticipationSource: 'haiku', timestamp: iso(at(D, '16:00:00')), mode: 'battle' },
    ],
  });
  const receipts = [
    receiptOf({ battleId, out: 'AMD', inn: 'TSLA', tier: 'core', slotIndex: 1, swappedOutAt: swapRisk.at, source: 'risk_manager', exitReason: 'bust_avoidance', outgoingEntryPrice: 150, outgoingBaseATR: 3.1, thresholdHistory: { maxMultiplier: 0.4, minMultiplier: -1.2, badges: [] }, entryMark: 240, entryATR: 4.2, seq: 1 }),
    receiptOf({ battleId, out: 'MSFT', inn: 'NFLX', tier: 'star', slotIndex: 1, swappedOutAt: swapModel.at, source: 'haiku', exitReason: 'haiku_decision', outgoingEntryPrice: 420, outgoingBaseATR: 2.2, thresholdHistory: { maxMultiplier: 0.35, minMultiplier: -0.1, badges: [] }, entryMark: 700, entryATR: 3.3, seq: 2 }),
  ];
  const calls = [
    {
      callId: `${battleId}:${battleId}:e11:call:0`, kind: 'called_shot', battleId, evalId: `${battleId}:e11`, evalSeq: 11,
      mintedAt: at(D, '16:00:25'), symbol: 'NFLX', direction: 'entry', slot: 'star', counterpart: 'MSFT',
      condition: { side: 'above', level: 700 }, horizon: { phrase: 'this_session', expiresAt: at(D, '20:00:00'), basis: 'session_close' },
      defaultAction: 'act', said: 'SAID-TEXT-NEVER-COPIED', evidence: { tickId: `${battleId}:11`, availability: 'unresolved', priceAsOf: iso(at(D, '16:00:12')) },
      hypothesisRef: null, origin: 'agent_initiative', state: 'hit', stateChangedAt: at(D, '16:15:20'), stateSource: 'check',
      playerResponse: null, directiveThreadId: null, outcome: null, refused: null,
    },
    {
      callId: `${battleId}:old:call:0`, kind: 'called_shot', battleId, evalId: 'old', evalSeq: 1,
      mintedAt: at('2026-09-23', '16:00:00'), symbol: 'KO', direction: 'exit', horizon: { phrase: 'this_session', expiresAt: at('2026-09-23', '20:00:00'), basis: 'session_close' },
      evidence: { tickId: null, availability: 'off', priceAsOf: null }, hypothesisRef: null, origin: 'agent_initiative', state: 'expired_unresolved', stateChangedAt: at('2026-09-23', '20:00:00'), stateSource: 'sweep',
    },
  ];
  const runs = [
    { startedAt: iso(at(D, '15:00:00')), endedAt: iso(at(D, '15:04:50')), wallMs: 290000, budgetMs: 290000, battlesTotal: 40, evaluated: 30, lockSkipped: 0, deferred: 10, deferredBattleIds: ['b-other', battleId], deferredTruncated: 0, triggered: 12, modelCalls: 12, budgetSkipped: 0 },
    { startedAt: iso(at(D, '18:00:00')), endedAt: iso(at(D, '18:04:10')), wallMs: 250000, budgetMs: 290000, battlesTotal: 400, evaluated: 150, lockSkipped: 0, deferred: 250, deferredBattleIds: Array.from({ length: 200 }, (_, i) => `b-many-${i}`), deferredTruncated: 50, triggered: 40, modelCalls: 40, budgetSkipped: 0 },
  ];
  return { battleId, etDate: D, battle, ticks, receipts, calls, declarations: [`${battleId}:e11`], runs, swapRisk, swapModel };
}

/** A no_trigger-heavy day: 26 clean checks, one wake, no deferral, no gap. */
export async function noTriggerDay({ battleId = 'b-quiet' } = {}) {
  const D = '2026-09-24';
  const ticks = [];
  const evaluations = [];
  let seq = 0;
  for (let m = 13 * 60 + 30; m <= 19 * 60 + 45; m += 15) {
    seq += 1;
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const capturedAtMs = at(D, `${hh}:${mm}:20`);
    const wake = seq === 9;
    const evalId = wake ? `${battleId}:e${seq}` : null;
    ticks.push(await makeTick({
      battleId, tickSeq: seq, capturedAtMs, exitReason: wake ? 'completed' : 'no_trigger', stages: STAGES_TO[wake ? 'completed' : 'no_trigger'],
      evalId, scores: scoresAt(20 + seq), verdicts: verdictsFor(HELD), decision: wake ? { original: 'HOLD', final: 'HOLD' } : null,
      guardrail: { evaluated: false, deployedCount: 0 }, evidenceKeys: wake ? HELD : [], symbols: HELD,
    }));
    if (wake) evaluations.push(makeEntry({ evalId, timestampMs: capturedAtMs - 5_000, total: 20 + seq, held: HELD, declarationsPhase: 'none' }));
  }
  const battle = battleDoc({ cronState: { tickSeq: seq }, evaluations });
  const runs = [{ startedAt: iso(at(D, '13:30:00')), endedAt: iso(at(D, '13:31:00')), wallMs: 60000, budgetMs: 290000, battlesTotal: 5, evaluated: 5, lockSkipped: 0, deferred: 0, deferredBattleIds: [], deferredTruncated: 0, triggered: 1, modelCalls: 1, budgetSkipped: 0 }];
  return { battleId, etDate: D, battle, ticks, receipts: [], calls: [], declarations: [], runs };
}

/** A budget_skipped day: every wake was skipped for budget. */
export async function budgetDay({ battleId = 'b-budget' } = {}) {
  const D = '2026-09-24';
  const ticks = [];
  const evaluations = [];
  for (let seq = 1; seq <= 6; seq += 1) {
    const capturedAtMs = at(D, '13:30:20') + (seq - 1) * 15 * 60_000;
    const skipped = seq % 2 === 0;
    const evalId = skipped ? `${battleId}:e${seq}` : null;
    ticks.push(await makeTick({
      battleId, tickSeq: seq, capturedAtMs, exitReason: skipped ? 'completed' : 'no_trigger', stages: STAGES_TO[skipped ? 'completed' : 'no_trigger'],
      evalId, scores: scoresAt(5), verdicts: verdictsFor(HELD), decision: skipped ? { final: 'HOLD', holdKind: 'default_failure' } : null,
      modelFailureClass: skipped ? 'budget_skipped' : null, guardrail: { evaluated: false, deployedCount: 0 }, symbols: HELD,
    }));
    if (skipped) evaluations.push(makeEntry({ evalId, timestampMs: capturedAtMs - 5_000, total: 5, held: HELD, budgetSkipped: true }));
  }
  const battle = battleDoc({ cronState: { tickSeq: 6 }, evaluations });
  const runs = [{ startedAt: iso(at(D, '13:30:00')), endedAt: iso(at(D, '13:35:00')), wallMs: 290000, budgetMs: 290000, battlesTotal: 90, evaluated: 90, lockSkipped: 0, deferred: 0, deferredBattleIds: [], deferredTruncated: 0, triggered: 30, modelCalls: 10, budgetSkipped: 20 }];
  return { battleId, etDate: D, battle, ticks, receipts: [], calls: [], declarations: [], runs };
}

/** A completed single-day battle (fullday): completion at 16:05 ET, a win. */
export async function completedDay({ battleId = 'b-done' } = {}) {
  const base = await noTriggerDay({ battleId });
  base.battle.status = 'completed';
  base.battle.completedAt = '2026-09-24T20:05:00.000Z';
  base.battle.reviewPending = true;
  base.battle.scoreState = { ...base.battle.scoreState, currentScore: 46, opponentScore: 36, activeScore: 41, bankedScore: 5 };
  return base;
}

/**
 * A five-day battle, 40 checks a day (every 9 minutes from 13:30Z), whose
 * evaluations[] sits at its 150 cap: 200 entries were written, `slice(-150)`
 * keeps the last 150, so day 1 (2026-09-21) has ticks but no surviving entry
 * and day 2's first ten entries are gone. `full: true` keeps all 200 — the
 * state the close pass saw on the night of each day.
 */
export async function multiDay({ battleId = 'b-multi', full = false } = {}) {
  const days = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'];
  const ticks = [];
  const all = [];
  let seq = 0;
  for (const D of days) {
    for (let i = 0; i < 40; i += 1) {
      seq += 1;
      const capturedAtMs = at(D, '13:30:20') + i * 9 * 60_000;
      const evalId = `${battleId}:e${seq}`;
      ticks.push(await makeTick({
        battleId, tickSeq: seq, capturedAtMs, exitReason: 'completed', stages: STAGES_TO.completed, evalId,
        scores: scoresAt(30 + seq / 10), verdicts: verdictsFor(HELD), decision: { original: 'HOLD', final: 'HOLD' },
        guardrail: { evaluated: false, deployedCount: 0 }, evidenceKeys: HELD, symbols: [...HELD, 'NFLX'],
      }));
      all.push(makeEntry({
        evalId, timestampMs: capturedAtMs - 5_000, total: 30 + seq / 10, held: HELD,
        candidates: i === 3 ? [{ symbol: 'NFLX', direction: 'potential_entry', signalSummary: 'Base forming', threshold: 'Above 705 on volume.' }] : null,
        rationale: `Reasoning at ${D} #${i}.`,
      }));
    }
  }
  const evaluations = full ? all : all.slice(-150);
  const battle = battleDoc({
    duration: '5d', createdAt: '2026-09-21T12:00:00.000Z', activatedAt: '2026-09-21T12:00:00.000Z',
    timing: { tradingDays: days, currentTradingDay: 5, timezone: 'America/New_York' },
    cronState: { tickSeq: seq }, evaluations,
  });
  const runs = days.map((D) => ({ startedAt: iso(at(D, '13:30:00')), endedAt: iso(at(D, '13:34:00')), wallMs: 240000, budgetMs: 290000, battlesTotal: 3, evaluated: 3, lockSkipped: 0, deferred: 0, deferredBattleIds: [], deferredTruncated: 0, triggered: 3, modelCalls: 3, budgetSkipped: 0 }));
  return { battleId, days, battle, ticks, all, receipts: [], calls: [], declarations: [], runs };
}

/** A flat6/tournament battle (BA-3): skipped_mode and nothing else. */
export async function skippedModeDay({ battleId = 'b-flat6' } = {}) {
  const base = await noTriggerDay({ battleId });
  base.battle.gameMode = 'baggerbomb_tournament';
  base.battle.groupId = 'group-1';
  return base;
}

/** A day before the capture flip: no tick records at all; entries and a trade survive. */
export function preCaptureDay({ battleId = 'b-pre' } = {}) {
  const D = '2026-09-18';
  const evaluations = [
    makeEntry({ evalId: `${battleId}:e1`, timestampMs: at(D, '13:45:15'), total: 12, held: HELD }),
    makeEntry({ evalId: `${battleId}:e2`, timestampMs: at(D, '15:15:15'), total: 14, held: HELD, candidates: [{ symbol: 'NFLX', direction: 'potential_entry', signalSummary: 'x', threshold: 'y' }] }),
  ];
  const battle = battleDoc({
    createdAt: '2026-09-18T12:00:00.000Z', activatedAt: '2026-09-18T12:00:00.000Z',
    timing: { tradingDays: [D], currentTradingDay: 1, timezone: 'America/New_York' },
    evaluations,
    trades: [tradeOf({ out: 'KO', inn: 'NFLX', tier: 'support', slotIndex: 0, entryPrice: 70, exitPrice: 69.5, lockedPoints: -0.71, lockedGainPct: -0.714, swappedOutAt: iso(at(D, '15:15:02')), source: 'haiku', exitReason: 'haiku_decision' })],
  });
  return { battleId, etDate: D, battle, ticks: [], receipts: [], calls: [], declarations: [], runs: [] };
}
