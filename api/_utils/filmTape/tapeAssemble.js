// api/_utils/filmTape/tapeAssemble.js
//
// Film Room tape — THE ASSEMBLER (spec §4, BA-3 … BA-22). PURE: it takes what
// the reads returned (tapeSources.js) and returns the close pass's document for
// one battle-day. No Firestore, no clock (the instant is handed in), no flag.
//
// It writes nothing the platform did not write. Every value is copied from a
// named field, joined on a named key, or computed from recorded values by the
// arithmetic stated beside it; every section carries its coverage (BA-20) and
// every number its class through the document's `numberClasses` declaration
// (BA-21, src/constants/filmTape.js). A fact the platform does not record is
// null with the reason in the section's coverage note — never inferred (§8).

import { TICKER_TO_SECTOR } from '../rankingConfig.js';
import { isCryptoSymbol } from '../marketDataCache.js';
import {
  TAPE_VERSION, TAPE_NUMBER_CLASSES, TICK_EXIT_STATES, NON_CHECK_STATES, NO_CHANGE_GATE_STATUSES,
  EXIT_MECHANISMS, MARKET_COMPARABLES, CALL_CONTRACT_VERSION,
} from '../../../src/constants/filmTape.js';
import { toMs, inDay, etDateOf, etDayBounds, sessionFor, previousSession, withinCandleWindow } from './tapeTime.js';

/** `evaluations[]` is `slice(-150)` (api/cron/agent-evaluate.js:4257). */
export const EVALUATIONS_CAP = 150;
/** `trades[]` is `slice(-50)` in the fenced executor (api/_utils/agentSwapExecution.js:354). */
export const TRADES_CAP = 50;
/**
 * BA-26 amended — the sources a read can be LIMITED by, named as the caveat
 * `unresolved_dependency` names them when a limit meets changed dependencies.
 */
export const LIMIT_SOURCES = Object.freeze({
  runs: 'run records (unreadable)',
  receipts: 'learning receipts (unreadable)',
  calls: 'call records (unreadable)',
  declarations: 'declaration records (unreadable)',
  evaluationsCap: `evaluations[] (at its ${EVALUATIONS_CAP}-entry cap)`,
  tradesCap: `trades[] (at its ${TRADES_CAP}-entry cap)`,
});
/** Bound on any sequence-number walk, so a corrupt counter cannot run away. */
const MAX_SEQ_SPAN = 5000;

/**
 * The two rationale strings the PLATFORM writes when no model result exists
 * (api/cron/agent-evaluate.js:3931-3934). They are not the agent's words, so
 * BA-22's attribution ("the agent's words at the time") can never be applied
 * to them: such entries are not copied into `rationale[]`.
 */
export const PLATFORM_RATIONALE_TEXTS = Object.freeze([
  'Evaluation skipped — cron budget too low to start Haiku call. Defaulting to HOLD.',
  'Haiku call failed — defaulting to HOLD',
]);

/**
 * Prefixes of platform-written text the deterministic guardrail layer puts in
 * an entry's rationale / hypothesis when it forces a SWAP over the model's
 * answer (agent-evaluate.js:3222-3223 — `haikuError` stays null there): not
 * the agent's words either (review L1-F2).
 */
export const PLATFORM_RATIONALE_PREFIXES = Object.freeze([
  'Guardrail override (',
  'Hypothesis: deterministic guardrail enforcement',
]);

const platformWritten = (text) => text !== null
  && (PLATFORM_RATIONALE_TEXTS.includes(text) || PLATFORM_RATIONALE_PREFIXES.some((p) => text.startsWith(p)));

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** A positive price, or null (0 is the executor's no-entry sentinel). */
const pos = (v) => (num(v) !== null && v > 0 ? v : null);
const str = (v) => (typeof v === 'string' && v ? v : null);
const round2 = (v) => (v === null ? null : Math.round(v * 100) / 100);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * A coverage object (BA-20). A close-pass section also carries `caveats` —
 * the reasons that are facts about the day's record (a gap, an unknown check,
 * a truncated list), which every later merge keeps (BA-26) — and, where it
 * reads checks' evaluation entries, `unknownChecks`.
 */
export function coverageOf(status, { span = null, sources = [], note = null, caveats = null, unknownChecks = null } = {}) {
  return {
    status, span, sources: [...sources], preservedFrom: null, note,
    ...(caveats ? { caveats: [...caveats] } : {}),
    ...(unknownChecks !== null ? { unknownChecks } : {}),
  };
}

function spanOf(instants) {
  const ms = instants.map(toMs).filter((v) => v !== null).sort((a, b) => a - b);
  if (!ms.length) return null;
  return { from: new Date(ms[0]).toISOString(), to: new Date(ms[ms.length - 1]).toISOString() };
}

// ── the evaluation entries of the day ──────────────────────────────────────

/**
 * The day's entries, and whether any of them can have been EVICTED: the array
 * is at its cap and its oldest surviving entry is not before the day, so the
 * day's first entries may have fallen off (BA-20).
 */
export function dayEntries(battle, bounds) {
  const all = (Array.isArray(battle?.evaluations) ? battle.evaluations : []).filter(isObj);
  const day = all.filter((e) => inDay(e.timestamp, bounds));
  const capped = all.length >= EVALUATIONS_CAP;
  const oldestMs = all.length ? toMs(all[0].timestamp) : null;
  const evictionPossible = capped && (oldestMs === null || oldestMs >= bounds.startMs);
  return { all, day, capped, evictionPossible };
}

function dayTrades(battle, bounds) {
  const all = (Array.isArray(battle?.trades) ? battle.trades : []).filter(isObj);
  const day = all.filter((t) => inDay(t.swappedOutAt, bounds));
  const oldestMs = all.length ? toMs(all[0].swappedOutAt) : null;
  const evictionPossible = all.length >= TRADES_CAP && (oldestMs === null || oldestMs >= bounds.startMs);
  return { all, day, evictionPossible };
}

// ── checks (BA-7, BA-8) ────────────────────────────────────────────────────

/** Only the stamp's eight fields, by name (tickStamps.js composeEvidenceStamp). */
function copyEvidence(evidence) {
  if (!isObj(evidence)) return null;
  const out = {};
  for (const [sym, v] of Object.entries(evidence)) {
    if (!isObj(v)) continue;
    out[sym] = {
      px: num(v.px), chg: num(v.chg), atrX: num(v.atrX), vwapDev: num(v.vwapDev), bbPct: num(v.bbPct),
      nr7: typeof v.nr7 === 'boolean' ? v.nr7 : null,
      regime: str(v.regime),
      risk: isObj(v.risk) && str(v.risk.action) ? { action: v.risk.action, ...(str(v.risk.reason) ? { reason: v.risk.reason } : {}) } : null,
    };
  }
  return Object.keys(out).length ? out : null;
}

/** BA-7: the recorded per-symbol verdicts, or null — "No risk decision recorded". */
function riskOf(tick) {
  const verdicts = tick?.risk?.verdicts;
  if (!isObj(verdicts)) return null;
  const out = {};
  for (const [sym, v] of Object.entries(verdicts)) {
    if (!isObj(v) || !str(v.action)) continue;
    out[sym] = { action: v.action, reason: str(v.reason) };
  }
  return Object.keys(out).length ? out : null;
}

const guardrailOf = (tick) => (isObj(tick?.guardrail)
  ? { evaluated: tick.guardrail.evaluated === true, deployedCount: num(tick.guardrail.deployedCount) }
  : null);

function decisionOf(tick) {
  const d = tick?.decision;
  if (!isObj(d) || (d.original == null && d.final == null)) return null;
  return { original: str(d.original), final: str(d.final), holdKind: str(d.holdKind) };
}

const scoresOf = (s) => (isObj(s) && num(s.total) !== null
  ? { active: num(s.active), banked: num(s.banked), total: num(s.total) }
  : null);

/** BA-8 — a tick-backed check's state. */
export function tickState(tick, entry) {
  if (tick?.model?.failureClass === 'budget_skipped' || entry?.haikuError?.failureClass === 'budget_skipped') return 'budget_skipped';
  return TICK_EXIT_STATES.includes(tick?.exitReason) ? tick.exitReason : 'unknown';
}

const blankRow = () => ({
  tickSeq: null, tickId: null, evalId: null, runId: null, at: null, state: null, exitReason: null, stageReached: null,
  risk: null, guardrail: null, decision: null, scores: null, tickMs: null, evidence: null, evidenceAt: null,
});

function tickRow(tick, entry, battleId) {
  const evidence = copyEvidence(entry?.evidence);
  return {
    ...blankRow(),
    key: `seq:${tick.tickSeq}`,
    rowSource: 'tick',
    tickSeq: tick.tickSeq,
    tickId: str(tick.tickId) ?? `${battleId}:${tick.tickSeq}`,
    evalId: str(tick.evalId),
    at: str(tick.capturedAt),
    state: tickState(tick, entry),
    exitReason: str(tick.exitReason),
    stageReached: str(tick.stageReached),
    risk: riskOf(tick),
    guardrail: guardrailOf(tick),
    decision: decisionOf(tick),
    scores: scoresOf(tick.scores),
    tickMs: num(entry?.tickMs),
    evidence,
    evidenceAt: evidence ? str(entry?.promptBuiltAt) : null,
  };
}

function entryRow(entry) {
  const evidence = copyEvidence(entry.evidence);
  return {
    ...blankRow(),
    key: str(entry.evalId) ? `eval:${entry.evalId}` : `eval-ts:${entry.timestamp}`,
    rowSource: 'entry',
    evalId: str(entry.evalId),
    at: str(entry.timestamp),
    // An entry is composed only on the full path (the early exits write none),
    // so a check known only by its entry either completed or was budget-skipped.
    state: entry.haikuError?.failureClass === 'budget_skipped' ? 'budget_skipped' : 'completed',
    decision: str(entry.decision) ? { original: null, final: entry.decision, holdKind: str(entry.holdKind) } : null,
    scores: scoresOf(entry.scores),
    tickMs: num(entry.tickMs),
    evidence,
    evidenceAt: evidence ? str(entry.promptBuiltAt) : null,
  };
}

function deferredRow(run) {
  return {
    ...blankRow(),
    key: `run:${run.runId}`,
    rowSource: 'run',
    runId: run.runId,
    // The run record keeps no deferral instant; "that run's time" is its start.
    at: str(run.startedAt) ?? str(run.runId),
    state: 'deferred',
  };
}

function gapRow(seq, battleId) {
  return { ...blankRow(), key: `seq:${seq}`, rowSource: 'gap', tickSeq: seq, tickId: `${battleId}:${seq}`, state: 'no_record' };
}

/**
 * Order check rows: sequence-bearing rows by tickSeq (a gap sits right after
 * the record before it, since its own time is unknown), the rest by time.
 */
/**
 * A check whose capture failed but whose evaluation entry survives is ONE
 * check (review L1-Q1): when exactly one missing sequence number and exactly
 * one entry-only row fall between the same two recorded ticks, the entry row
 * stands for it and no separate `no_record` row is added. The number stays in
 * passes.close.gaps — its tick record is still missing.
 */
export function absorbedGap(seq, { dayTicks, entryOnly }) {
  const before = dayTicks.filter((t) => t.tickSeq < seq).at(-1) ?? null;
  const after = dayTicks.find((t) => t.tickSeq > seq) ?? null;
  const lo = before ? toMs(before.capturedAt) : -Infinity;
  const hi = after ? toMs(after.capturedAt) : Infinity;
  const loSeq = before ? before.tickSeq : -Infinity;
  const hiSeq = after ? after.tickSeq : Infinity;
  const gapsBetween = hiSeq - loSeq - 1;
  const entriesBetween = entryOnly.filter((r) => { const ms = toMs(r.at); return ms !== null && ms > lo && ms < hi; }).length;
  return gapsBetween === 1 && entriesBetween === 1;
}

export function orderChecks(rows) {
  const keyed = [];
  let lastMs = -Infinity;
  for (const r of rows.filter((x) => Number.isFinite(x.tickSeq)).sort((a, b) => a.tickSeq - b.tickSeq)) {
    const ms = toMs(r.at);
    if (ms !== null) lastMs = ms;
    keyed.push({ r, ms: ms ?? lastMs, tie: r.tickSeq });
  }
  for (const r of rows.filter((x) => !Number.isFinite(x.tickSeq))) keyed.push({ r, ms: toMs(r.at) ?? Infinity, tie: Infinity });
  keyed.sort((a, b) => {
    if (a.ms !== b.ms) return a.ms < b.ms ? -1 : 1;
    if (a.tie !== b.tie) return a.tie < b.tie ? -1 : 1;
    return a.r.key < b.r.key ? -1 : a.r.key > b.r.key ? 1 : 0;
  });
  return keyed.map((k) => k.r);
}

/**
 * Minted tickSeqs with no document, split into those that are this day's
 * (interior, and edges the record can place) and those whose day the surviving
 * records cannot establish (BA-20: bounds never claim beyond the survivors).
 */
export function gapAnalysis({ seqs, prevSeq, nextSeq, mintedMax, earlierSessionExists, laterSessionStarted }) {
  const sorted = [...new Set(seqs.filter(Number.isInteger))].sort((a, b) => a - b);
  const have = new Set(sorted);
  const range = (lo, hi) => {
    const out = [];
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi < lo || hi - lo > MAX_SEQ_SPAN) return out;
    for (let s = lo; s <= hi; s += 1) out.push(s);
    return out;
  };
  const interior = sorted.length ? range(sorted[0], sorted[sorted.length - 1]).filter((s) => !have.has(s)) : [];
  const lo = (Number.isInteger(prevSeq) ? prevSeq : 0) + 1;
  const hi = Number.isInteger(nextSeq) ? nextSeq - 1 : (Number.isInteger(mintedMax) ? mintedMax : null);
  const leadingOwned = !earlierSessionExists && !Number.isInteger(prevSeq);
  const trailingOwned = !Number.isInteger(nextSeq) && !laterSessionStarted;
  let leading = [];
  let trailing = [];
  if (sorted.length) {
    leading = range(lo, sorted[0] - 1);
    trailing = hi === null ? [] : range(sorted[sorted.length - 1] + 1, hi);
  } else if (hi !== null) {
    // No record at all for the day: the whole stretch between the neighbours.
    const all = range(lo, hi);
    return leadingOwned && trailingOwned
      ? { attributed: all, unattributed: [] }
      : { attributed: [], unattributed: all };
  }
  return {
    attributed: [...interior, ...(leadingOwned ? leading : []), ...(trailingOwned ? trailing : [])].sort((a, b) => a - b),
    unattributed: [...(leadingOwned ? [] : leading), ...(trailingOwned ? [] : trailing)].sort((a, b) => a - b),
  };
}

// ── actions (BA-5, BA-6, BA-11 inputs) ─────────────────────────────────────

/** The join key every source shares: (swappedOutAt, symbolOut, symbolIn). */
export const swapKey = (at, out, inn) => `swap:${at}|${out}|${inn}`;

/**
 * The ghost leg's threshold baseline from recorded facts (build report §1.2):
 * the evaluator scores against `swapPrice`, else the activation day's starting
 * price, else the Guard-2-validated previousClose — which nothing records.
 */
export function ghostBaseline({ receipt, entryPrice, swappedOutAt, activatedAt }) {
  const gr = receipt?.guardrailReplay;
  if (num(entryPrice) === null || num(entryPrice) <= 0) return { value: null, basis: null, source: null };
  if (gr && gr.outgoingSwappedInDay != null) {
    // swappedInDay and swapPrice are set together at swap-in and deleted
    // together by the nightly reset (agent-daily-scores.js:152-165): a
    // surviving swappedInDay means swapPrice was live, and entry = swapPrice.
    return { value: entryPrice, basis: 'swap_price', source: 'receipt.guardrailReplay.outgoingSwappedInDay' };
  }
  const swapDay = etDateOf(swappedOutAt);
  const activationDay = etDateOf(activatedAt);
  if (receipt && swapDay && activationDay && swapDay === activationDay) {
    // The evaluator's own isActivationDay test (agent-evaluate.js:1085-1088):
    // with no swapPrice, entry = startingPrice, and the baseline is the same.
    return { value: entryPrice, basis: 'starting_price', source: 'battle.activatedAt (activation day)' };
  }
  return { value: null, basis: 'previous_close', source: null };
}

function historyOf(h) {
  if (!isObj(h) || num(h.maxMultiplier) === null || num(h.minMultiplier) === null) return null;
  return { maxMultiplier: h.maxMultiplier, minMultiplier: h.minMultiplier };
}

/** Both legs' scorer inputs, from their persistent sources; a leg is null when any input has none. */
export function buildReplayInputs({ row, receipt, trade, battle }) {
  const gr = receipt?.guardrailReplay || null;
  const tier = str(trade?.tier) ?? str(receipt?.resolvedTier);
  const tierSource = str(trade?.tier) ? 'trades.tier' : (str(receipt?.resolvedTier) ? 'receipt.resolvedTier' : null);
  const direction = str(trade?.direction);

  const ghostEntry = row.entryPrice;
  const baseline = ghostBaseline({ receipt, entryPrice: ghostEntry, swappedOutAt: row.at, activatedAt: battle?.activatedAt });
  const ghost = {
    entryPrice: ghostEntry,
    atr: num(gr?.outgoingBaseATR),
    tier,
    direction,
    thresholdHistory: historyOf(gr?.thresholdHistory),
    thresholdBaseline: baseline.basis ? { value: baseline.value, basis: baseline.basis } : null,
    sources: {
      entryPrice: row.entryPriceSource,
      atr: num(gr?.outgoingBaseATR) !== null ? 'receipt.guardrailReplay.outgoingBaseATR' : null,
      tier: tierSource,
      thresholdHistory: historyOf(gr?.thresholdHistory) ? 'receipt.guardrailReplay.thresholdHistory' : null,
      thresholdBaseline: baseline.source,
    },
  };
  const ghostMissing = [];
  if (ghost.entryPrice === null) ghostMissing.push('ghost.entryPrice');
  if (ghost.atr === null) ghostMissing.push('ghost.atr');
  if (ghost.tier === null) ghostMissing.push('ghost.tier');
  if (ghost.thresholdHistory === null) ghostMissing.push('ghost.thresholdHistory');
  if (ghost.thresholdBaseline === null || ghost.thresholdBaseline.value === null) ghostMissing.push('ghost.thresholdBaseline');

  // The bought name's fill: the receipt's entryMark, else the tick action's
  // entryPrice — both are incomingAsset.swapPrice (learningSchemas.js:141;
  // agent-evaluate.js:2027 and the five sibling capture sites).
  const boughtEntry = row.inBasis?.price ?? null;
  const bought = {
    entryPrice: boughtEntry,
    atr: num(receipt?.entryATR),
    tier,
    direction: null,
    // The executor resets the incoming symbol's history at the swap
    // (agentSwapExecution.js:307-311) — a platform write, not a default.
    thresholdHistory: { maxMultiplier: 0, minMultiplier: 0 },
    thresholdBaseline: boughtEntry !== null ? { value: boughtEntry, basis: 'swap_price' } : null,
    sources: {
      entryPrice: row.inBasisSource ?? null,
      atr: num(receipt?.entryATR) !== null ? `receipt.entryATR (${str(receipt?.entryAtrSource) ?? 'source unrecorded'})` : null,
      tier: tierSource,
      thresholdHistory: 'executor reset at the swap (agentSwapExecution.js:307-311)',
      thresholdBaseline: boughtEntry !== null ? `${row.inBasisSource} (the swap price)` : null,
    },
  };
  const boughtMissing = [];
  if (bought.entryPrice === null) boughtMissing.push('bought.entryPrice');
  if (bought.atr === null) boughtMissing.push('bought.atr');
  if (bought.tier === null) boughtMissing.push('bought.tier');

  return {
    replayInputs: { ghost: ghostMissing.length ? null : ghost, bought: boughtMissing.length ? null : bought },
    replayMissing: [...ghostMissing, ...boughtMissing],
  };
}

export function buildActions({ battle, bounds, dayTicks, trades, receiptsDay }) {
  const byKey = new Map();
  const touch = (key, at, out, inn) => {
    if (!byKey.has(key)) byKey.set(key, { key, at, symbolOut: out, symbolIn: inn, action: null, tick: null, trade: null, receipt: null });
    return byKey.get(key);
  };
  for (const tick of dayTicks) {
    for (const a of Array.isArray(tick.actions) ? tick.actions : []) {
      if (!isObj(a) || !str(a.swappedOutAt) || !inDay(a.swappedOutAt, bounds)) continue;
      const slot = touch(swapKey(a.swappedOutAt, a.symbolOut, a.symbolIn), a.swappedOutAt, a.symbolOut, a.symbolIn);
      if (!slot.action) { slot.action = a; slot.tick = tick; }
    }
  }
  for (const t of trades.day) {
    const slot = touch(swapKey(t.swappedOutAt, t.symbolOut, t.symbolIn), t.swappedOutAt, t.symbolOut, t.symbolIn);
    if (!slot.trade) slot.trade = t;
  }
  for (const r of receiptsDay) {
    const slot = touch(swapKey(r.timestamp, r.symbolOut, r.symbolIn), r.timestamp, r.symbolOut, r.symbolIn);
    if (!slot.receipt) slot.receipt = r;
  }

  const rows = [];
  for (const s of byKey.values()) {
    const { action, tick, trade, receipt } = s;
    const exitReason = str(action?.exitReason) ?? str(trade?.exitReason) ?? str(receipt?.exitReason);
    // The SOLD position's own entry: the trade keeps it (closedTrade.entryPrice,
    // agentSwapExecution.js:191-193), the receipt copies it (outgoingEntryPrice).
    // NEVER ticks.actions[].entryPrice — every capture site writes the BOUGHT
    // name's fill there (`entryPrice: …incomingAsset?.swapPrice`,
    // agent-evaluate.js:2027 and siblings). 0 is the executor's no-entry
    // sentinel: absent, never a price.
    const entryPrice = pos(trade?.entryPrice) ?? pos(receipt?.guardrailReplay?.outgoingEntryPrice);
    const entryPriceSource = pos(trade?.entryPrice) !== null ? 'trades.entryPrice'
      : pos(receipt?.guardrailReplay?.outgoingEntryPrice) !== null ? 'receipt.guardrailReplay.outgoingEntryPrice' : null;
    // The BOUGHT name's fill (incomingAsset.swapPrice): the receipt's entryMark,
    // else the tick action's entryPrice (the permanent record).
    const inPrice = pos(receipt?.entryMark) ?? pos(action?.entryPrice);
    const inBasisSource = pos(receipt?.entryMark) !== null ? 'receipt.entryMark'
      : pos(action?.entryPrice) !== null ? 'ticks.actions.entryPrice (incomingAsset.swapPrice)' : null;
    const entryInstant = receipt ? (toMs(receipt.guardrailReplay?.outgoingSwappedInAt) ?? toMs(battle?.activatedAt)) : null;
    const row = {
      key: s.key,
      rowSource: action ? 'tick' : (trade ? 'trade' : 'receipt'),
      actionId: str(action?.actionId),
      tickSeq: Number.isInteger(tick?.tickSeq) ? tick.tickSeq : null,
      at: s.at,
      source: str(action?.source) ?? str(trade?.source) ?? str(receipt?.source),
      exitReason,
      mechanism: EXIT_MECHANISMS[exitReason] ?? 'unrecorded',
      symbolOut: str(s.symbolOut),
      symbolIn: str(s.symbolIn),
      tier: str(trade?.tier) ?? str(receipt?.resolvedTier),
      slotIndex: num(trade?.slotIndex) ?? num(receipt?.resolvedSlotIndex),
      entryPrice,
      exitPrice: num(trade?.exitPrice),
      lockedPoints: num(action?.lockedPoints) ?? num(trade?.lockedPoints),
      lockedGainPct: num(trade?.lockedGainPct),
      inBasis: inPrice !== null ? { price: inPrice, at: s.at } : null,
      // Derived: the swap instant minus the position's recorded entry instant
      // (the receipt keeps it; the trade loses it — 0B §3-B2).
      holdingMs: entryInstant !== null && toMs(s.at) !== null ? toMs(s.at) - entryInstant : null,
      holdingBasis: receipt ? (toMs(receipt.guardrailReplay?.outgoingSwappedInAt) !== null ? 'swapped_in_at' : 'battle_activated_at') : null,
      committed: action ? action.committed === true : null,
      tradeMatched: Boolean(trade),
      receiptMatched: Boolean(receipt),
      subsequentTradesInSlot: null,
      replayInputs: null,
      replayMissing: [],
      replayReason: null,
      replay: null,
    };
    const crypto = trade?.isCrypto === true || isCryptoSymbol(row.symbolOut) || isCryptoSymbol(row.symbolIn);
    if (crypto) {
      row.replayReason = 'crypto_not_supported';
    } else {
      const { replayInputs, replayMissing } = buildReplayInputs({ row: { ...row, entryPriceSource, inBasisSource }, receipt, trade, battle });
      row.replayInputs = replayInputs;
      row.replayMissing = replayMissing;
    }
    rows.push(row);
  }
  rows.sort((a, b) => (toMs(a.at) ?? 0) - (toMs(b.at) ?? 0) || (a.key < b.key ? -1 : 1));
  for (const row of rows) {
    if (row.tier === null || row.slotIndex === null) continue;
    row.subsequentTradesInSlot = rows.filter((o) => o !== row && o.tier === row.tier && o.slotIndex === row.slotIndex && (toMs(o.at) ?? 0) > (toMs(row.at) ?? 0)).length;
  }
  return rows;
}

// ── directives (BA-9) ──────────────────────────────────────────────────────

function cardStateOf(exchange) {
  const status = str(exchange.archetypeGate?.status);
  // A committed gate filed a directive only when the exchange carries its
  // record — OBSERVE mode and a withheld turn store `committed` with
  // `directive: null` (chat.js:855-857, :937-938): nothing was filed.
  if (status === 'committed') return isObj(exchange.directive) ? 'committed' : 'not_filed';
  if (!exchange.archetypeGate && str(exchange.directiveThreadId) && isObj(exchange.directive)) return 'committed';
  if (NO_CHANGE_GATE_STATUSES.includes(status)) return 'no_change';
  // fit_mismatch — and any status this build does not know — filed nothing.
  return 'not_filed';
}

/**
 * BA-9 — what followed a filing, up to `endMs` (the next committed filing or
 * the day's end): counts of checks, holds and swaps — sequence only, never
 * compliance. Shared by the assembler and the merge (which recounts from the
 * merged rows when it kept rows the new read lacked — review L1-F8).
 */
export function afterOf({ filedAt, endMs, checkRows, actionRows }) {
  const filedMs = toMs(filedAt);
  const inWindow = (at) => { const ms = toMs(at); return ms !== null && filedMs !== null && ms > filedMs && ms < endMs; };
  const followed = (checkRows || []).filter((r) => !NON_CHECK_STATES.includes(r.state) && inWindow(r.at));
  return {
    checks: followed.length,
    holds: followed.filter((r) => r.decision?.final === 'HOLD').length,
    swaps: (actionRows || []).filter((a) => inWindow(a.at)).length,
  };
}

/**
 * The exchanges a day's directive cards come from (review L1-F4): the ET day,
 * reaching back on the battle's FIRST trading day to its activation (a fullday
 * battle deployed after hours is active — and takes directives — the evening
 * before its session), and on a later day to the end of the previous trading
 * day (a weekend filing belongs to the next session). The windows partition
 * time, so every card lands on exactly one tape.
 */
export function directiveWindow({ battle, etDate, bounds }) {
  const days = Array.isArray(battle?.timing?.tradingDays) ? battle.timing.tradingDays : null;
  const i = days ? days.indexOf(etDate) : -1;
  if (i === 0) {
    const act = toMs(battle?.activatedAt) ?? toMs(battle?.createdAt);
    return { startMs: act !== null ? Math.min(act, bounds.startMs) : bounds.startMs, endMs: bounds.endMs };
  }
  if (i > 0) return { startMs: Math.min(etDayBounds(days[i - 1]).endMs, bounds.startMs), endMs: bounds.endMs };
  return { startMs: bounds.startMs, endMs: bounds.endMs };
}

export function buildDirectives({ battle, bounds, entriesAll, dayTicks, checkRows, actionRows, tickSeqByEvalId, window = null }) {
  const win = window ?? { startMs: bounds.startMs, endMs: bounds.endMs };
  const inWin = (at) => { const ms = toMs(at); return ms !== null && ms >= win.startMs && ms < win.endMs; };
  const exchanges = (Array.isArray(battle?.chatExchanges) ? battle.chatExchanges : [])
    .filter((x) => isObj(x) && str(x.timestamp))
    .sort((a, b) => (toMs(a.timestamp) ?? 0) - (toMs(b.timestamp) ?? 0));
  const committedAll = exchanges.filter((x) => cardStateOf(x) === 'committed' && (x.archetypeGate || str(x.directiveThreadId)));
  const dayCards = exchanges.filter((x) => inWin(x.timestamp) && str(x.userMessage) && (isObj(x.archetypeGate) || str(x.directiveThreadId)));
  const entriesByTime = [...entriesAll].sort((a, b) => (toMs(a.timestamp) ?? 0) - (toMs(b.timestamp) ?? 0));
  const ticksBySeq = [...dayTicks].sort((a, b) => a.tickSeq - b.tickSeq);

  return dayCards.map((x) => {
    const cardState = cardStateOf(x);
    const gate = isObj(x.archetypeGate) ? x.archetypeGate : null;
    const committed = cardState === 'committed';
    const threadId = committed ? str(x.directiveThreadId) : null;
    const filedAt = x.timestamp;
    const filedMs = toMs(filedAt);

    // "No change": name the retained directive ONLY from the previous committed
    // exchange's filed text, else "none in force" (null).
    let retained = null;
    if (cardState === 'no_change') {
      const prev = committedAll.filter((c) => (toMs(c.timestamp) ?? 0) < filedMs).pop();
      retained = prev ? str(prev.directive?.text) : null;
    }

    // Heard: the EARLIER of the first entry after the filing stamped with this
    // thread and no suppression, and the first tick whose controls say the
    // same — an evicted first entry never lets a later one win (review L1-F7).
    let heard = null;
    if (threadId) {
      const e = entriesByTime.find((en) => (toMs(en.timestamp) ?? -1) >= filedMs
        && en.heard?.directiveThreadId === threadId && en.heard?.suppressed === null);
      const t = ticksBySeq.find((tk) => (toMs(tk.capturedAt) ?? -1) >= filedMs
        && tk.controls?.directiveThreadId === threadId && tk.controls?.directiveSuppressed === null);
      const found = [
        e ? { at: e.timestamp, tickSeq: tickSeqByEvalId.get(e.evalId) ?? null, source: 'entry' } : null,
        t ? { at: t.capturedAt, tickSeq: t.tickSeq, source: 'tick' } : null,
      ].filter(Boolean).sort((a, b) => (toMs(a.at) ?? 0) - (toMs(b.at) ?? 0));
      heard = found[0] ?? null;
    }

    // After: counts of what followed, up to the next committed filing or the
    // day's end — sequence only, never compliance (BA-9).
    const nextCommitted = committedAll.find((c) => (toMs(c.timestamp) ?? 0) > filedMs);
    const endMs = Math.min(bounds.endMs, nextCommitted ? toMs(nextCommitted.timestamp) : Infinity);

    return {
      key: threadId ?? `exchange:${filedAt}`,
      threadId,
      filedAt,
      expiry: committed ? str(x.directive?.expiry) : null,
      playerText: str(x.userMessage),
      canonicalText: committed ? str(x.directive?.text) : null,
      adjustmentId: committed ? str(x.directive?.adjustmentId) : null,
      canonicalTextVersion: committed ? num(x.directive?.canonicalTextVersion) : null,
      gateStatus: str(gate?.status),
      classification: str(gate?.classification),
      cardState,
      retainedDirectiveText: retained,
      agentReply: str(x.agentResponse),
      // Derived from the gate's typed fields, never from the reply's words: the
      // reply was composed around an adjustment the gate did not file.
      agentReplyDiffers: !committed && str(gate?.selectedAdjustmentId) !== null,
      heard,
      after: afterOf({ filedAt, endMs, checkRows, actionRows }),
    };
  });
}

// ── plans, rationale, calls (BA-10, BA-22, BA-16) ──────────────────────────

export function buildPlans({ entriesDay, tickByEvalId }) {
  const rows = [];
  for (const e of entriesDay) {
    if (!Array.isArray(e.candidates)) continue;
    const tick = tickByEvalId.get(e.evalId) || null;
    e.candidates.forEach((c, i) => {
      if (!isObj(c) || !str(c.symbol)) return;
      rows.push({
        key: `${str(e.evalId) ?? e.timestamp}:${i}`,
        evalId: str(e.evalId),
        tickSeq: Number.isInteger(tick?.tickSeq) ? tick.tickSeq : null,
        // The entry's own time (BA-10) — when the model wrote the plan, just
        // after it returned; the tick's capturedAt comes later, after narration
        // and dispatch (review L1-Q4). The plan's price is sampled here.
        at: str(e.timestamp) ?? str(tick?.capturedAt),
        symbol: c.symbol,
        direction: str(c.direction),
        signalSummary: str(c.signalSummary),
        threshold: str(c.threshold),
        signalSource: str(c.signalSource),
        price: null,
      });
    });
  }
  return rows;
}

export function buildRationale({ entriesDay, tickByEvalId }) {
  const rows = [];
  let platformAuthored = 0;
  for (const e of entriesDay) {
    const rationale = str(e.rationale);
    const hypothesis = str(e.hypothesis);
    if (!rationale && !hypothesis) continue;
    if (e.haikuError || platformWritten(rationale) || platformWritten(hypothesis)) { platformAuthored += 1; continue; }
    const tick = tickByEvalId.get(e.evalId) || null;
    rows.push({
      key: str(e.evalId) ?? `ts:${e.timestamp}`,
      evalId: str(e.evalId),
      tickSeq: Number.isInteger(tick?.tickSeq) ? tick.tickSeq : null,
      at: str(e.timestamp),
      rationale,
      hypothesis,
      holdKind: str(e.holdKind),
    });
  }
  return { rows, platformAuthored };
}

function copyHypothesisRef(ref) {
  if (!isObj(ref)) return null;
  const out = {};
  for (const k of ['watchlistId', 'hypothesisVersion', 'equippedConfigHash']) if (ref[k] !== undefined) out[k] = ref[k];
  return Object.keys(out).length ? out : null;
}

export function buildCalls({ calls, bounds, nowIso, callRecordsMode }) {
  const rows = [];
  for (const c of calls) {
    if (!isObj(c) || !str(c.callId)) continue;
    const state = str(c.state);
    const minted = inDay(c.mintedAt, bounds);
    const resolved = state !== null && state !== 'open' && inDay(c.stateChangedAt, bounds);
    if (!minted && !resolved) continue;
    rows.push({
      key: c.callId,
      callId: c.callId,
      kind: str(c.kind),
      origin: str(c.origin),
      horizon: isObj(c.horizon) ? { phrase: str(c.horizon.phrase), expiresAt: num(c.horizon.expiresAt), basis: str(c.horizon.basis) } : null,
      mintedAt: num(c.mintedAt),
      expiresAt: num(c.horizon?.expiresAt),
      // OBSERVED at copiedAt — not a reconstruction of the day (BA-16).
      state,
      // The record has no resolvedAt: for a non-open state its stateChangedAt is when it left `open`.
      resolvedAt: state !== null && state !== 'open' ? num(c.stateChangedAt) : null,
      evidence: { tickId: str(c.evidence?.tickId), priceAsOf: str(c.evidence?.priceAsOf) },
      hypothesisRef: copyHypothesisRef(c.hypothesisRef),
      symbol: str(c.symbol),
      direction: str(c.direction),
      copiedAt: nowIso,
      contractVersion: CALL_CONTRACT_VERSION,
      tapeWriteMode: str(callRecordsMode),
      // Only if the record itself carries its minting mode — it does not at
      // V1.4 (build report §1.3), so this is null, never inferred.
      recordMode: str(c.recordMode),
    });
  }
  return rows.sort((a, b) => (a.mintedAt ?? 0) - (b.mintedAt ?? 0) || (a.key < b.key ? -1 : 1));
}

// ── score and battle (BA-4) ────────────────────────────────────────────────

export function buildScore({ battle, etDate, tickRowsScored, rawTickBySeq, entryRowsScored, priorTape }) {
  // Every admitted check with scores: its tick row, or — when capture missed
  // it — its entry row (review L1-F5: a later entry-only check is the day's
  // last admitted check even when earlier checks have tick records).
  const scored = [...tickRowsScored, ...entryRowsScored]
    .sort((a, b) => ((toMs(a.at) ?? 0) - (toMs(b.at) ?? 0)) || ((a.tickSeq ?? 0) - (b.tickSeq ?? 0)));
  let lastCheck = null;
  let firstCheck = null;
  if (scored.length) {
    const last = scored[scored.length - 1];
    const first = scored[0];
    const raw = Number.isInteger(last.tickSeq) ? rawTickBySeq.get(last.tickSeq) : null;
    lastCheck = {
      at: last.at, tickSeq: last.tickSeq, active: last.scores.active, banked: last.scores.banked, total: last.scores.total,
      opponent: num(raw?.scores?.opponent), bankedBadgePoints: num(raw?.scores?.bankedBadgePoints),
    };
    firstCheck = { at: first.at, tickSeq: first.tickSeq, total: first.scores.total };
  }
  const days = Array.isArray(battle?.timing?.tradingDays) ? battle.timing.tradingDays : null;
  const isFirstDay = days ? days[0] === etDate : false;
  const priorDay = days ? (days[days.indexOf(etDate) - 1] ?? null) : previousSession(etDate);
  let dayChange = { value: null, basis: 'unavailable', reference: null };
  if (lastCheck && isFirstDay) {
    // createAgentBattle writes scoreState.currentScore: 0 (agentBattleService.js).
    dayChange = { value: round2(lastCheck.total - 0), basis: 'battle_start', reference: 0 };
  } else if (lastCheck && priorDay && priorTape?.etDate === priorDay && num(priorTape?.score?.lastCheck?.total) !== null) {
    const ref = priorTape.score.lastCheck.total;
    dayChange = { value: round2(lastCheck.total - ref), basis: 'prior_day_tape', reference: ref, referenceEtDate: priorDay };
  }
  return { lastCheck, firstCheck, dayChange };
}

export function buildBattleBlock({ battle, resolveResult }) {
  const status = str(battle?.status);
  const completed = status === 'completed';
  const stored = ['win', 'loss', 'draw'].includes(battle?.result) ? battle.result : null;
  let result;
  if (stored) result = { value: stored, basis: 'stored' };
  else if (completed) result = { value: resolveResult ? resolveResult(battle) : null, basis: 'derived' };
  else result = { value: null, basis: 'not_completed' };
  return {
    status,
    completedAt: str(battle?.completedAt),
    final: completed
      ? { total: num(battle?.scoreState?.currentScore), opponent: num(battle?.scoreState?.opponentScore), at: str(battle?.completedAt) }
      : null,
    result,
  };
}

// ── the whole document ─────────────────────────────────────────────────────

const statusFrom = (reasons, hasRows) => (reasons.length ? (hasRows ? 'partial' : 'unavailable') : 'complete');

const SLOT_MS = 15 * 60_000;
const ET_HHMM = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * The evaluator's market-hours slots on `etDate` (every 15 min from the open,
 * before the close) that the battle was live for and that left NO run record.
 * Every run past the market-hours gate writes one, and a run killed at the
 * platform ceiling leaves none — "a missing market-hours slot is the signal of
 * a killed run" (agent-evaluate.js:241-247). Its checks may be missing or its
 * deferrals unlisted, so the checks section cannot claim completeness
 * (review L1-F12).
 */
export function missingRunSlots({ etDate, runs, battle, nowMs }) {
  const s = sessionFor(etDate);
  if (!s?.isTradingDay) return [];
  const from = Math.max(s.openMs, toMs(battle?.activatedAt) ?? s.openMs);
  const to = Math.min(s.closeMs, toMs(battle?.completedAt) ?? Infinity, nowMs);
  const covered = new Set(runs.map((r) => toMs(r?.startedAt))
    .filter((ms) => ms !== null && ms >= s.openMs && ms < s.closeMs)
    .map((ms) => Math.floor((ms - s.openMs) / SLOT_MS)));
  const out = [];
  for (let k = 0, t = s.openMs; t < s.closeMs; k += 1, t += SLOT_MS) {
    if (t < from || t > to) continue;
    if (!covered.has(k)) out.push(t);
  }
  return out;
}

/**
 * Assemble the close pass's document for one battle-day. The candle-owned
 * fields (actions[].replay, plans[].price, passes.candles, coverage.replay,
 * coverage.series) are INITIALIZED here and never overwritten by the merge.
 */
export function assembleTape({
  battle, etDate, bounds, nowMs,
  ticksRead, runsRead, receiptsRead, callsRead, declarationsRead,
  intradayViewsPresent = null, priorTape = null, callRecordsMode = null, resolveResult = null,
}) {
  const nowIso = new Date(nowMs).toISOString();
  const battleId = battle.id;
  const days = Array.isArray(battle?.timing?.tradingDays) ? battle.timing.tradingDays.filter((d) => typeof d === 'string') : null;
  const entries = dayEntries(battle, bounds);
  const trades = dayTrades(battle, bounds);
  const dayTicks = [...(ticksRead.ticks || [])].filter((t) => Number.isInteger(t?.tickSeq)).sort((a, b) => a.tickSeq - b.tickSeq);
  const entryByEvalId = new Map(entries.all.filter((e) => str(e.evalId)).map((e) => [e.evalId, e]));
  const tickByEvalId = new Map(dayTicks.filter((t) => str(t.evalId)).map((t) => [t.evalId, t]));
  const tickSeqByEvalId = new Map([...tickByEvalId.entries()].map(([k, t]) => [k, t.tickSeq]));
  const rawTickBySeq = new Map(dayTicks.map((t) => [t.tickSeq, t]));

  // ---- checks
  const tickRows = dayTicks.map((t) => tickRow(t, t.evalId ? entryByEvalId.get(t.evalId) : null, battleId));
  const entryOnly = entries.day.filter((e) => !(str(e.evalId) && tickByEvalId.has(e.evalId))).map(entryRow);
  const runs = runsRead.ok ? runsRead.runs : [];
  const deferredRuns = runs.filter((r) => Array.isArray(r.deferredBattleIds) && r.deferredBattleIds.includes(battleId));
  const deferralsTruncated = runs.some((r) => num(r.deferredTruncated) !== null && r.deferredTruncated > 0);
  const nowSessionStarted = (d) => { const s = sessionFor(d); return Boolean(s?.isTradingDay && s.openMs <= nowMs); };
  const gaps = gapAnalysis({
    seqs: dayTicks.map((t) => t.tickSeq),
    prevSeq: ticksRead.prevSeq,
    nextSeq: ticksRead.nextSeq,
    mintedMax: num(battle?.cronState?.tickSeq),
    earlierSessionExists: days ? days.some((d) => d < etDate) : true,
    laterSessionStarted: days ? days.some((d) => d > etDate && nowSessionStarted(d)) : true,
  });
  const checks = orderChecks([
    ...tickRows,
    ...entryOnly,
    ...deferredRuns.map(deferredRow),
    ...gaps.attributed.filter((s) => !rawTickBySeq.has(s) && !absorbedGap(s, { dayTicks, entryOnly })).map((s) => gapRow(s, battleId)),
  ]);
  const capture = dayTicks.length === 0 ? 'absent'
    : (gaps.attributed.length || gaps.unattributed.length || entryOnly.length ? 'partial' : 'present');

  // ---- actions, directives, plans, rationale, calls
  const receiptsDay = (receiptsRead.receipts || []).filter((r) => isObj(r) && inDay(r.timestamp, bounds));
  const actions = buildActions({ battle, bounds, dayTicks, trades, receiptsDay });
  const cardWindow = directiveWindow({ battle, etDate, bounds });
  const directives = buildDirectives({ battle, bounds, entriesAll: entries.all, dayTicks, checkRows: checks, actionRows: actions, tickSeqByEvalId, window: cardWindow });
  const plans = buildPlans({ entriesDay: entries.day, tickByEvalId });
  const rationale = buildRationale({ entriesDay: entries.day, tickByEvalId });
  const calls = callsRead.ok ? buildCalls({ calls: callsRead.calls, bounds, nowIso, callRecordsMode }) : [];

  // ---- comparables (BA-13): TICKER_TO_SECTOR, never the stored sector string
  const heldSymbols = new Set();
  for (const t of dayTicks) {
    for (const s of Object.keys(isObj(t.risk?.verdicts) ? t.risk.verdicts : {})) heldSymbols.add(s);
    for (const s of Array.isArray(t.manifest?.evidenceKeys) ? t.manifest.evidenceKeys : []) if (str(s)) heldSymbols.add(s);
  }
  for (const e of entries.day) for (const s of Object.keys(isObj(e.evidence) ? e.evidence : {})) heldSymbols.add(s);
  if (days && days[0] === etDate) {
    for (const tier of ['star', 'core', 'support']) {
      for (const a of Array.isArray(battle?.agentContext?.initialPortfolio?.[tier]) ? battle.agentContext.initialPortfolio[tier] : []) if (str(a?.symbol)) heldSymbols.add(a.symbol);
    }
  }
  for (const a of actions) { if (a.symbolOut) heldSymbols.add(a.symbolOut); if (a.symbolIn) heldSymbols.add(a.symbolIn); }
  const planned = new Set(plans.map((p) => p.symbol));
  const sectors = {};
  for (const sym of [...heldSymbols, ...planned].sort()) {
    if (isCryptoSymbol(sym)) continue;
    sectors[sym] = TICKER_TO_SECTOR[sym] ?? null;
  }

  // ---- score and battle
  const score = buildScore({
    battle, etDate,
    tickRowsScored: tickRows.filter((r) => r.scores),
    rawTickBySeq,
    entryRowsScored: entryOnly.filter((r) => r.scores),
    priorTape,
  });

  // ---- coverage (BA-20, BA-26) — computed from what this read could see.
  // Every reason is a CAVEAT, a fact about the day's record (a gap, a check
  // whose entry is lost, a truncated list, an absent declarations record),
  // or a LIMIT of this read (a source unreadable, an array at its cap). Both
  // lower this read's status; only caveats are kept on the section
  // (`caveats`) and survive every later merge (tapeMerge.js) — a limit is
  // what preserved facts make up for (BA-19), but only for dependencies the
  // stored coverage already covered (BA-26 amended): each limit names its
  // SOURCE, and the sources this read was limited by go to the merge in
  // `readLimits` — never stored — so a limit met while the section's
  // dependencies changed becomes the caveat `unresolved_dependency`.
  const caveat = (text) => ({ text, caveat: true });
  const limit = (text, source) => ({ text, caveat: false, source });
  const texts = (rs) => rs.map((r) => r.text);
  const caveatsOf = (rs) => rs.filter((r) => r.caveat).map((r) => r.text);
  const limitsOf = (rs) => [...new Set(rs.filter((r) => !r.caveat).map((r) => r.source))];

  // A tick that names an evalId whose entry is absent: EVICTED when the array
  // is at its cap and the check predates its oldest surviving entry (a limit
  // of this read — an earlier run may hold it); otherwise LOST — nothing could
  // have evicted it, so what it recorded is unknown (BA-26).
  const oldestEntryMs = entries.all.length ? toMs(entries.all[0].timestamp) : null;
  const noEntry = dayTicks.filter((t) => str(t.evalId) && !entryByEvalId.has(t.evalId));
  const evictedEntries = noEntry.filter((t) => entries.capped && oldestEntryMs !== null && (toMs(t.capturedAt) ?? Infinity) < oldestEntryMs).length;
  const lostEntries = noEntry.length - evictedEntries;
  // A minted check with no tick record and no entry standing for it (the
  // `no_record` rows, and the minted numbers whose day cannot be placed).
  const unknownGaps = checks.filter((r) => r.state === 'no_record').length + gaps.unattributed.length;
  const unknownChecks = unknownGaps + lostEntries;
  const knownChecks = checks.filter((r) => !NON_CHECK_STATES.includes(r.state)).length;

  const entryReasons = [];
  if (entries.evictionPossible) entryReasons.push(limit(`evaluations[] is at its ${EVALUATIONS_CAP}-entry cap and its oldest surviving entry is not before this day — the day's first entries may have been evicted`, LIMIT_SOURCES.evaluationsCap));
  if (evictedEntries) entryReasons.push(limit(`${evictedEntries} check(s) recorded an evalId whose evaluation entry is absent (evicted: older than the oldest surviving entry)`, LIMIT_SOURCES.evaluationsCap));
  if (lostEntries) entryReasons.push(caveat(`${lostEntries} check(s) recorded an evalId whose evaluation entry is absent`));
  const unknownReason = (what) => (unknownChecks
    ? [caveat(`${unknownChecks} minted check(s) of this day have no record of what they read or produced (no tick record, or an evaluation entry that is absent) — ${what} unknown for them`)]
    : []);
  const checksSpan = spanOf(checks.map((r) => r.at));

  const checkReasons = [];
  if (capture === 'absent') checkReasons.push(caveat('capture absent: no tick records for this battle-day — checks shown from evaluation entries only'));
  if (gaps.attributed.length) checkReasons.push(caveat(`${gaps.attributed.length} minted check(s) of this day have no record (tickSeq ${gaps.attributed.join(', ')})`));
  if (gaps.unattributed.length) checkReasons.push(caveat(`${gaps.unattributed.length} minted check(s) adjacent to this day have no record and their day cannot be established (tickSeq ${gaps.unattributed.join(', ')})`));
  if (entryOnly.length && capture !== 'absent') checkReasons.push(caveat(`${entryOnly.length} evaluation entr(y/ies) have no tick record; their sequence numbers are among the gaps`));
  if (!runsRead.ok) checkReasons.push(limit(`run records unreadable (${runsRead.error}) — deferrals unknown`, LIMIT_SOURCES.runs));
  else if (!runs.length) checkReasons.push(caveat('no evaluation-run records exist for this day — deferrals cannot be listed'));
  else {
    const missingSlots = missingRunSlots({ etDate, runs, battle, nowMs });
    if (missingSlots.length) {
      checkReasons.push(caveat(`no run record for ${missingSlots.length} evaluator slot(s) (${missingSlots.map((t) => ET_HHMM.format(new Date(t))).join(', ')} ET) — a check in them may be missing or its deferral unlisted`));
    }
  }
  if (deferralsTruncated) checkReasons.push(caveat('a run record\'s deferred list was truncated — deferrals past its first 200 ids are not listed (deferralsTruncated)'));
  if (lostEntries) checkReasons.push(caveat('tickMs unavailable where the entry is absent'));
  else if (entryReasons.length) checkReasons.push(limit('tickMs unavailable where the entry is absent', LIMIT_SOURCES.evaluationsCap));
  const coverage = {
    checks: coverageOf(statusFrom(checkReasons, checks.length > 0), {
      span: checksSpan, sources: ['ticks', 'agentEvalRuns', ...(entries.day.length ? ['evaluations'] : [])], note: texts(checkReasons).join('; ') || null,
      caveats: caveatsOf(checkReasons),
    }),
  };

  const actionReasons = [];
  const actionsProvable = (capture === 'present') || !trades.evictionPossible;
  if (!actionsProvable) actionReasons.push(limit('capture is incomplete for this day and trades[] is at its 50-entry cap — a swap on an unrecorded check may be missing', LIMIT_SOURCES.tradesCap));
  if (!receiptsRead.ok) actionReasons.push(limit(`learning receipts unreadable (${receiptsRead.error}) — replay inputs and holding times unavailable`, LIMIT_SOURCES.receipts));
  coverage.actions = coverageOf(statusFrom(actionReasons, actions.length > 0 || actionsProvable), {
    span: spanOf(actions.map((a) => a.at)), sources: ['ticks.actions', 'trades', 'learningReceipts'], note: texts(actionReasons).join('; ') || null,
    caveats: caveatsOf(actionReasons),
  });

  const heardReasons = [];
  if (entries.evictionPossible && capture !== 'present') heardReasons.push(limit('evaluation entries may be evicted and capture is incomplete — a heard stamp may be missing', LIMIT_SOURCES.evaluationsCap));
  heardReasons.push(...unknownReason('a heard stamp, and the checks after a filing, are'));
  const earlyCards = directives.filter((d) => (toMs(d.filedAt) ?? bounds.startMs) < bounds.startMs).length;
  const directiveNotes = earlyCards ? [`${earlyCards} card(s) filed before this ET day (after the battle's activation or the previous trading day) are shown here`] : [];
  coverage.directives = coverageOf(statusFrom(heardReasons, true), {
    span: spanOf(directives.map((d) => d.filedAt)), sources: ['chatExchanges', 'evaluations.heard', 'ticks.controls'], note: [...texts(heardReasons), ...directiveNotes].join('; ') || null,
    caveats: caveatsOf(heardReasons), unknownChecks,
  });

  const entrySpan = spanOf(entries.day.map((e) => e.timestamp));
  const planReasons = [...entryReasons, ...unknownReason('plans they recorded are')];
  coverage.plans = coverageOf(statusFrom(planReasons, entries.day.length > 0), {
    span: entrySpan, sources: ['evaluations.candidates'], note: texts(planReasons).join('; ') || null,
    caveats: caveatsOf(planReasons), unknownChecks,
  });
  const rationaleReasons = [...entryReasons, ...unknownReason('rationale they recorded is')];
  const rationaleNote = [...texts(rationaleReasons), ...(rationale.platformAuthored ? [`${rationale.platformAuthored} entr(y/ies) carried platform-written text (a placeholder or a guardrail override), not the agent's words — not copied`] : [])];
  coverage.rationale = coverageOf(statusFrom(rationaleReasons, entries.day.length > 0), {
    span: entrySpan, sources: ['evaluations'], note: rationaleNote.join('; ') || null,
    caveats: caveatsOf(rationaleReasons), unknownChecks,
  });
  const evidenceReasons = [...entryReasons, ...unknownReason('evidence stamps they recorded are')];
  coverage.evidence = coverageOf(statusFrom(evidenceReasons, entries.day.length > 0), {
    span: spanOf(checks.filter((r) => r.evidence).map((r) => r.evidenceAt ?? r.at)), sources: ['evaluations.evidence'], note: texts(evidenceReasons).join('; ') || null,
    caveats: caveatsOf(evidenceReasons), unknownChecks,
  });

  const callReasons = [];
  const expected = entries.day.filter((e) => e.declarationsPhase === 'expected' && str(e.evalId)).map((e) => e.evalId);
  const phased = entries.day.some((e) => e.declarationsPhase === 'none' || e.declarationsPhase === 'expected');
  if (!callsRead.ok) callReasons.push(limit(`call records unreadable (${callsRead.error})`, LIMIT_SOURCES.calls));
  const callNotes = [];
  if (callsRead.ok && !calls.length && !entries.evictionPossible) {
    // Facts, not reasons — and only what was observed (BA-26): never a
    // categorical claim about a day whose checks are not all known.
    if (!entries.day.length && !noEntry.length) {
      callNotes.push(`no model check recorded among the ${knownChecks} known check(s)${unknownGaps ? `; ${unknownGaps} check(s) have no record` : ''}`);
    } else if (entries.day.length && !phased) callNotes.push('no evaluation entry of this day carries a declarations phase');
  }
  if (entries.evictionPossible) callReasons.push(limit('declaration phases unknown for evicted entries', LIMIT_SOURCES.evaluationsCap));
  if (declarationsRead && !declarationsRead.ok) callReasons.push(limit(`declaration records unreadable (${declarationsRead.error})`, LIMIT_SOURCES.declarations));
  else if (declarationsRead) {
    const absent = expected.filter((id) => !declarationsRead.present.has(id));
    if (absent.length) callReasons.push(caveat(`${absent.length} check(s) expected a declarations record that is absent (failed or unconfirmed — contract §2.1)`));
  }
  if (lostEntries) callReasons.push(caveat(`${lostEntries} check(s) recorded an evalId whose evaluation entry is absent — whether they expected a declarations record is unknown`));
  callReasons.push(...unknownReason('their declarations phase, and so an absent declarations record, is'));
  coverage.calls = coverageOf(statusFrom(callReasons, calls.length > 0), {
    span: spanOf(calls.map((c) => c.mintedAt)), sources: ['calls', 'declarations'],
    note: [...texts(callReasons), ...callNotes, 'state as observed at copiedAt, not a reconstruction of the day'].join('; '),
    caveats: caveatsOf(callReasons), unknownChecks,
  });

  const within = withinCandleWindow(etDate, nowMs);
  const candleNote = within ? 'awaiting the candle pass' : 'no candle pass is scheduled for this day (outside the 10-trading-day window)';
  coverage.replay = coverageOf('unavailable', { note: candleNote });
  coverage.series = coverageOf('unavailable', { note: candleNote });

  const seqs = dayTicks.map((t) => t.tickSeq);
  return {
    tapeVersion: TAPE_VERSION,
    battleId,
    ownerId: str(battle.ownerId),
    agentId: str(battle.agentId),
    archetype: str(battle.agentContext?.archetype),
    gameMode: str(battle.gameMode),
    etDate,
    dayNumber: days && days.includes(etDate) ? days.indexOf(etDate) + 1 : null,
    isFinalDay: days ? days[days.length - 1] === etDate : null,
    battleStatusAtWrite: str(battle.status),
    writtenAt: nowIso,
    firstWrittenAt: nowIso,
    runCount: 1,
    passes: {
      close: {
        status: 'written',
        writtenAt: nowIso,
        capture,
        tickSeqRange: seqs.length ? [seqs[0], seqs[seqs.length - 1]] : null,
        gaps: gaps.attributed,
        unattributedGaps: gaps.unattributed,
        deferralsTruncated,
        ticksReadMethod: ticksRead.method ?? null,
        sources: {
          ticks: dayTicks.length,
          evaluations: entries.day.length,
          receipts: receiptsDay.length,
          trades: trades.day.length,
          calls: calls.length,
          runs: runs.length,
          declarations: declarationsRead?.ok ? declarationsRead.present.size : 0,
        },
        lastError: null,
      },
      candles: {
        status: within ? 'pending' : 'skipped',
        writtenAt: null,
        attempts: 0,
        reason: within ? null : 'outside_candle_window',
        source: null,
        symbolsRequested: [],
        symbolsMissing: [],
      },
    },
    coverage,
    score,
    battle: buildBattleBlock({ battle, resolveResult }),
    checks,
    actions,
    directives,
    plans,
    calls,
    rationale: rationale.rows,
    comparables: { market: [...MARKET_COMPARABLES], sectors },
    diagnostics: { intradayViews: intradayViewsPresent === true ? 'present' : (intradayViewsPresent === false ? 'absent' : 'unknown') },
    numberClasses: TAPE_NUMBER_CLASSES,
    // BA-26 amended: the sources this read was limited by, per section — for
    // the merge only; tapeMerge.js strips it before anything is written.
    readLimits: {
      checks: limitsOf(checkReasons), actions: limitsOf(actionReasons), directives: limitsOf(heardReasons),
      plans: limitsOf(planReasons), rationale: limitsOf(rationaleReasons), evidence: limitsOf(evidenceReasons), calls: limitsOf(callReasons),
    },
  };
}

/** BA-3 — a flat6/tournament battle's document: its pass status and nothing else. */
export function assembleSkippedModeTape({ battle, etDate, nowMs }) {
  const nowIso = new Date(nowMs).toISOString();
  return {
    tapeVersion: TAPE_VERSION,
    battleId: battle.id,
    ownerId: str(battle.ownerId),
    agentId: str(battle.agentId),
    gameMode: str(battle.gameMode),
    etDate,
    writtenAt: nowIso,
    firstWrittenAt: nowIso,
    runCount: 1,
    passes: {
      close: { status: 'skipped_mode', writtenAt: nowIso, reason: 'mode_not_supported', lastError: null },
      candles: { status: 'skipped', writtenAt: null, attempts: 0, reason: 'skipped_mode', source: null, symbolsRequested: [], symbolsMissing: [] },
    },
    numberClasses: TAPE_NUMBER_CLASSES,
  };
}
