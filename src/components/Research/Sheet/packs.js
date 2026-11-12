// src/components/Research/Sheet/packs.js
//
// Research Modal Build C — THE PACK BUILDER (spec
// docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md BC-4, BC-5, BC-6, BC-9,
// BC-10, BC-11, BC-15, §3.2–§3.4). PURE and NODE-CLEAN: the client builds the
// packs the player sees, and the server (api/_utils/researchAsk.js) re-runs the
// SAME builder over the battle document it read to mark which of an Ask's
// items it could re-derive (`verified`). One builder, never a copy
// (BUILD_RULES §4).
//
// Every item has the research record's finding shape (Research Record
// Extension contract §2) without `findingId` and `supersedes`:
//   { kind, symbol, fact, source: { recordKind, recordId, label }, at, asOf,
//     status, statusReason, pin }
// Packs are not stored. A candidate with nothing behind it is OMITTED, never
// shown as "n/a". Tapping a question calls this module and nothing else: no
// model, no request, no charge (R-15).
//
// THE ORDER (§3.3, R-15) is mechanical: each item kind maps to ONE factor
// (KIND_FACTOR below — the table of record); an item's position is the
// equipped archetype's weight on that factor (ARCHETYPE_WEIGHTS,
// archetypeScoring.js — read, never edited), ties broken by TIE_ORDER (facts
// before the archetype's own rule; the rule before the standing). Two factors
// are not ARCHETYPE_WEIGHTS keys:
//   'defensiveness'  protect-the-lead risk items (§3.3): the battle's preset's
//                    position between the most aggressive and the most
//                    defensive value of each risk lever across PRESET_CONFIGS
//                    (agentPresetConfig.js), averaged over the four levers —
//                    aggressive 0, balanced ≈ 0.33, defensive 1.
//   'archetypeTop'   the archetype's own ranking (`arch_scores`): its largest weight.
// The loop items (the idea, what you told it) carry no factor: they ride after
// the ordered items and are never cut; the ordered items fill the rest of the
// five places.
//
// THE PRESET is the one the check uses — presetKeyOf(battle.strategyPreset)
// (agent-evaluate.js :1163, through playerFieldReaders.js) — and the hftConfig
// is the cron's own composition (agent-evaluate.js :1909-1913):
// clampHftConfig({ hftConfig: resolveHftConfig(archetypeConfig, battle.gameMode),
// desiredTempo: desiredTempoOf(battle), dialEnabled: TEMPO_DIAL_ENABLED }), so
// the tempo dial moves the stall count here exactly as it does at the check.
// Never the archetype's defaultPreset.
//
// §2.3 IMPORT RATCHET: this module is the sheet's ONE direct importer of the
// legacy archetype tables (archetypeScoring, agentArchetypeConfig,
// archetypeDisplay); its path is in archetypeImportBoundaryBaseline.json.

import { ARCHETYPE_WEIGHTS } from '../../../../api/_utils/archetypeScoring.js';
import { ARCHETYPE_CONFIGS, getArchetypeConfig, resolveHftConfig } from '../../../../api/_utils/agentArchetypeConfig.js';
import { clampHftConfig, desiredTempoOf } from '../../../../api/_utils/tempoDialClamp.js';
import { TEMPO_DIAL_ENABLED } from '../../../config/featureFlags.js';
import { PRESET_CONFIGS, getPresetConfig } from '../../../../api/_utils/agentPresetConfig.js';
import { presetKeyOf } from '../../../../api/_utils/playerFieldReaders.js';
import { getArchetypeDisplayName } from '../../../data/archetypeDisplay.js';
import { agentBombContext, agentPositionOf, recordMs, selectBombRecord } from '../BombMode/selectBombRecord.js';
import { measuredLadder, toGo } from '../BombMode/ladder.js';
import { checkClock, etClock, etDate, etWeekday } from '../BombMode/checkClock.js';
import { priceDecimals } from '../priceFormat.js';
import { SHEET_COPY, RISK_WORDS, RISK_REASON_WORDS, REGIME_WORDS } from './sheetCopy.js';
import { benchCandidateOf, latestCheckOn, latestVoicedCheckOn, namesSymbol } from './latestLine.js';

// ── The closed vocabularies (the server validates an Ask against them) ──────

/** The three questions, in the design's order (R-10). */
export const QUESTION_IDS = Object.freeze(['catch_up', 'protect_lead', 'better_than_stalled']);

/** Every item kind a pack can hold. */
export const ITEM_KINDS = Object.freeze([
  'rung_distance', 'move_since_entry', 'check_read',
  'rule_trend', 'rule_fit', 'rule_volatility', 'rule_fundamentals', 'rule_contrarian', 'rule_sectors',
  'standing',
  'risk_lever', 'risk_verdict', 'banked', 'drawdown',
  'incumbent', 'stalled', 'rung_compare', 'rank_scores', 'bench_signal',
  'idea', 'told_it',
]);

/**
 * The record kinds an item's source can name. The contract's spelling where a
 * kind already exists there (`call`, `hypothesisVersion`, `stockRankings`);
 * the rest are the battle-document fields and configs the sheet reads.
 */
export const RECORD_KINDS = Object.freeze([
  'evaluation', 'position', 'cronState', 'scoreState', 'directive', 'call',
  'hypothesisVersion', 'stockRankings', 'archetypeConfig', 'presetConfig', 'chart',
]);

/** The item kinds each question draws on (§3.4); the loop items join every pack. */
export const PACK_CANDIDATES = Object.freeze({
  catch_up: Object.freeze(['rung_distance', 'move_since_entry', 'check_read', 'rule', 'standing']),
  protect_lead: Object.freeze(['risk_lever', 'risk_verdict', 'banked', 'drawdown', 'standing']),
  better_than_stalled: Object.freeze(['incumbent', 'stalled', 'rung_compare', 'rank_scores', 'bench_signal']),
});
export const LOOP_KINDS = Object.freeze(['idea', 'told_it']);
export const PACK_MAX = 5;

/** THE ORDERING TABLE (§3.3): each kind's factor. */
export const KIND_FACTOR = Object.freeze({
  rung_distance: 'baggerBombFit',
  move_since_entry: 'technicalScore',
  check_read: 'atrPercentile',
  rule_trend: 'technicalScore',
  rule_fit: 'baggerBombFit',
  rule_volatility: 'atrPercentile',
  rule_fundamentals: 'fundamentalScore',
  rule_contrarian: 'inverseComposite',
  rule_sectors: 'sectorDiversity',
  standing: null,
  risk_lever: 'defensiveness',
  risk_verdict: 'defensiveness',
  banked: 'baggerBombFit',
  drawdown: 'atrPercentile',
  incumbent: 'technicalScore',
  stalled: 'technicalScore',
  rung_compare: 'baggerBombFit',
  rank_scores: 'archetypeTop',
  bench_signal: 'atrPercentile',
  idea: 'loop',
  told_it: 'loop',
});

/** Ties: the stock's facts first, then the archetype's own rule, then the standing. */
export const TIE_ORDER = Object.freeze([
  'rung_distance', 'move_since_entry', 'check_read',
  'risk_lever', 'risk_verdict', 'banked', 'drawdown',
  'incumbent', 'stalled', 'rung_compare', 'bench_signal', 'rank_scores',
  'rule_trend', 'rule_fit', 'rule_volatility', 'rule_fundamentals', 'rule_contrarian', 'rule_sectors',
  'standing', 'idea', 'told_it',
]);

/** The rule kind that states each ARCHETYPE_WEIGHTS factor. */
export const RULE_KIND_OF = Object.freeze({
  technicalScore: 'rule_trend',
  baggerBombFit: 'rule_fit',
  atrPercentile: 'rule_volatility',
  fundamentalScore: 'rule_fundamentals',
  inverseComposite: 'rule_contrarian',
  sectorDiversity: 'rule_sectors',
});
const FACTOR_ORDER = Object.freeze(['technicalScore', 'baggerBombFit', 'atrPercentile', 'fundamentalScore', 'inverseComposite', 'sectorDiversity']);

/**
 * Which kinds the server can re-read from the battle document (BC-7, §4.3): its
 * items are `verified`; every other kind is the client's and stays
 * `unverified` with its reason.
 */
export const SERVER_KINDS = Object.freeze([
  'check_read', 'rule_trend', 'rule_fit', 'rule_volatility', 'rule_fundamentals', 'rule_contrarian', 'rule_sectors',
  'risk_lever', 'risk_verdict', 'banked', 'stalled', 'rung_compare', 'bench_signal', 'idea', 'told_it',
]);
/** Why a client-only kind is unverified. */
export const CLIENT_REASON = Object.freeze({
  rung_distance: 'live_quote',
  move_since_entry: 'live_quote',
  drawdown: 'from_chart',
  rank_scores: 'rankings_doc',
  standing: 'as_shown',
  // "{SYM} is the name it would replace" comes from the cockpit's open call, which is not
  // on the battle document the server re-reads (review A7/B3): never verified.
  incumbent: 'from_cockpit',
});
export const FACT_MAX = 200;
/** The huddle plan's directive thread prefix (Huddle S1 spec V1.1 §4.5; origin/claude/huddle-s1 planTemplates.js PLAN_THREAD_PREFIX). */
export const PLAN_THREAD_PREFIX = 'plan:';

// ── Small helpers ───────────────────────────────────────────────────────────

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const positive = (v) => finite(v) && v > 0;
const iso = (ms) => (finite(ms) ? new Date(ms).toISOString() : null);
const TIERS = ['star', 'core', 'support'];
/** "Tue 10/13" — the ET weekday and month/day of an instant. */
export function dayLabel(ms) {
  if (!finite(ms)) return null;
  const [, m, d] = etDate(ms).split('-');
  return `${etWeekday(ms)} ${Number(m)}/${Number(d)}`;
}
/** "Fri 1:15" — the ET weekday and clock of an instant. */
export function whenLabel(ms) {
  return finite(ms) ? `${etWeekday(ms)} ${etClock(ms)}` : null;
}
/** A fact never longer than FACT_MAX characters (a quoted text is cut with "…", never reworded). */
export function clampText(text, max) {
  const t = String(text ?? '').trim();
  return t.length <= max ? t : `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function makeItem({ kind, symbol, fact, recordKind, recordId, label, atMs = null, asOfMs = null, pin = null }) {
  const reason = CLIENT_REASON[kind] ?? null;
  return {
    kind,
    symbol,
    fact: clampText(fact, FACT_MAX),
    source: { recordKind, recordId: String(recordId ?? ''), label },
    at: iso(atMs),
    asOf: iso(asOfMs),
    status: reason ? 'unverified' : 'verified',
    statusReason: reason,
    pin,
  };
}
const pricePin = (v) => (positive(v) ? { type: 'price', value: v } : null);
const timePin = (ms) => (finite(ms) ? { type: 'time', value: iso(ms) } : null);

// ── The archetype's lens ────────────────────────────────────────────────────

const RISK_LEVERS = Object.freeze([
  // [lever, the direction a more defensive preset moves it]
  ['bustBuffer', 'up'],
  ['vwapFailureTicks', 'down'],
  ['vwapDeadBandPct', 'down'],
  ['trailStopATR', 'down'],
]);

/** The preset's defensiveness in [0, 1], from the risk levers of every preset (§3.3). */
export function defensivenessOf(presetKey) {
  const preset = PRESET_CONFIGS[presetKey];
  if (!preset) return 0;
  const parts = [];
  for (const [lever, dir] of RISK_LEVERS) {
    const values = Object.values(PRESET_CONFIGS).map((p) => p?.risk?.[lever]).filter(finite);
    const v = preset.risk?.[lever];
    if (!finite(v) || values.length < 2) continue;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    if (hi === lo) continue;
    parts.push(dir === 'up' ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo));
  }
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
}

/** The equipped archetype's lens, from the battle document (never a prop — Phase 0 §A). */
export function lensOf(battle) {
  const archetype = typeof battle?.agentContext?.archetype === 'string' ? battle.agentContext.archetype : null;
  const known = archetype !== null && Object.hasOwn(ARCHETYPE_CONFIGS, archetype);
  const weights = known && ARCHETYPE_WEIGHTS[archetype] ? { ...ARCHETYPE_WEIGHTS[archetype] } : {};
  // The cron's composition (agent-evaluate.js :1909-1913), the tempo dial included (review A1).
  const hft = known ? clampHftConfig({
    hftConfig: resolveHftConfig(getArchetypeConfig(archetype), battle?.gameMode),
    desiredTempo: desiredTempoOf(battle),
    dialEnabled: TEMPO_DIAL_ENABLED,
  }).hftConfig : null;
  const presetKey = presetKeyOf(battle?.strategyPreset);
  const preset = getPresetConfig(presetKey);
  return {
    archetype,
    known,
    label: getArchetypeDisplayName(archetype),
    weights,
    forcedRotation: hft?.forcedRotation ?? null,
    swapWindow: hft?.swapWindow ?? null,
    presetKey,
    preset,
    defensiveness: defensivenessOf(presetKey),
  };
}

/** An item kind's weight under a lens. */
export function weightOf(kind, lens) {
  const factor = KIND_FACTOR[kind];
  if (!factor || factor === 'loop') return 0;
  if (factor === 'defensiveness') return finite(lens?.defensiveness) ? lens.defensiveness : 0;
  if (factor === 'archetypeTop') return Math.max(0, ...Object.values(lens?.weights ?? {}).filter(finite));
  const w = lens?.weights?.[factor];
  return finite(w) ? w : 0;
}

/** Order a pack's items (§3.3) and cut it to PACK_MAX: the loop items are never cut. */
export function orderItems(items, lens) {
  const loop = items.filter((it) => KIND_FACTOR[it.kind] === 'loop');
  const ranked = items
    .filter((it) => KIND_FACTOR[it.kind] !== 'loop')
    .map((it) => ({ it, w: weightOf(it.kind, lens), t: TIE_ORDER.indexOf(it.kind) }))
    .sort((a, b) => (b.w - a.w) || (a.t - b.t))
    .map((x) => x.it);
  const room = Math.max(0, PACK_MAX - loop.length);
  return [...ranked.slice(0, room), ...loop.sort((a, b) => TIE_ORDER.indexOf(a.kind) - TIE_ORDER.indexOf(b.kind))];
}

// ── What the record holds for one symbol ────────────────────────────────────

/** The agent's position context for the opened row (Build A's selector; BC-15: measured only claims an entry). */
export function holdingOf(battle, symbol, nowMs, row = {}) {
  const ctx = agentBombContext(battle, symbol, nowMs, { posKey: row?.posKey ?? null, positionId: row?.positionId ?? null });
  const record = ctx.record;
  const measured = record?.model === 'measured' && record.measured ? record : null;
  const ladder = measured ? measuredLadder({ measured: measured.measured, entryAtMs: measured.entry?.atMs ?? null }) : null;
  return {
    held: ctx.held,
    record,
    measured,
    ladder: ladder && ladder.status === 'ok' ? ladder : null,
    entryPrice: measured && positive(measured.entry?.price) ? measured.entry.price : null,
    entryAtMs: measured ? (measured.entry?.atMs ?? null) : (record?.entryAtMs ?? null),
  };
}

/** The equipped idea, when it applies to this symbol (BC-9): on its frozen list or named in a condition. */
export function ideaOf(battle, symbol) {
  const h = battle?.agentContext?.equippedHypothesis;
  if (!h || typeof h !== 'object' || typeof h.statement !== 'string' || !h.statement.trim()) return null;
  const tickers = Array.isArray(battle?.agentContext?.equippedWatchlist?.tickers) ? battle.agentContext.equippedWatchlist.tickers : [];
  const onList = tickers.some((t) => (typeof t === 'string' ? t : t?.symbol) === symbol);
  const conditions = [
    ...(Array.isArray(h.activation) ? h.activation.map((c) => ({ ...c, role: 'live' })) : []),
    ...(Array.isArray(h.invalidation) ? h.invalidation.map((c) => ({ ...c, role: 'wrong' })) : []),
  ].filter((c) => c && c.symbol === symbol && positive(c.level) && (c.side === 'above' || c.side === 'below'));
  if (!onList && conditions.length === 0) return null;
  const deployMs = recordMs(battle?.agentContext?.equippedWatchlist?.snapshotAt) ?? recordMs(battle?.createdAt);
  return {
    statement: h.statement.trim(),
    recordId: `${h.watchlistId ?? ''}:v${h.hypothesisVersion ?? ''}`,
    deployMs,
    onList,
    conditions,
  };
}

/** The directive item's match (BC-10): the text names the symbol (token rule), or a call-family action names it. */
export function directiveFor(directive, symbol) {
  if (!directive || typeof directive !== 'object' || typeof directive.text !== 'string' || !directive.text.trim()) return null;
  if (typeof directive.directiveThreadId !== 'string' || !directive.directiveThreadId) return null;
  const byAction = directive.family === 'call' && directive.action?.symbol === symbol;
  if (!byAction && !namesSymbol(directive.text, symbol)) return null;
  return directive;
}

// ── The items ───────────────────────────────────────────────────────────────

function latestEvidence(battle, symbol) {
  const entry = latestCheckOn(battle, symbol);
  const ev = entry?.evidence?.[symbol];
  return ev && typeof ev === 'object' ? { entry, ev, atMs: recordMs(entry.timestamp) } : null;
}

/**
 * The standing AS THE HEADER SHOWS IT (BUILD_RULES §9, BC-13; review A6): the
 * screen hands its own digits (`you`, `them` — the header's formatScoreDisplay
 * text) and its own lead ('player' | 'cpu' | 'tie' — the precise pair's, which
 * the header tints and words by). Without them (a caller that passes only the
 * numbers), the lead is the precise pair's and the digits are rounded to
 * `digits` places. Unavailable → null.
 */
export function shownStanding(standing) {
  if (!standing) return null;
  if (typeof standing.you === 'string' && typeof standing.them === 'string' && ['player', 'cpu', 'tie'].includes(standing.lead)) {
    return { you: standing.you, them: standing.them, lead: standing.lead };
  }
  if (!finite(standing.player) || !finite(standing.opponent)) return null;
  const digits = finite(standing.digits) ? standing.digits : 0;
  const lead = standing.player > standing.opponent ? 'player' : standing.player < standing.opponent ? 'cpu' : 'tie';
  return { you: standing.player.toFixed(digits), them: standing.opponent.toFixed(digits), lead };
}

function standingItem({ standing, symbol, battleId }) {
  const shown = shownStanding(standing);
  if (!shown) return null;
  const { you, them, lead } = shown;
  const fact = lead === 'cpu' ? SHEET_COPY.standingTrail(you, them) : lead === 'player' ? SHEET_COPY.standingLead(you, them) : SHEET_COPY.standingTied(you, them);
  return makeItem({ kind: 'standing', symbol, fact, recordKind: 'scoreState', recordId: battleId, label: SHEET_COPY.srcStanding });
}

function ruleItem({ lens, symbol }) {
  if (!lens.known) return null;
  const ranked = FACTOR_ORDER.map((f) => [f, lens.weights[f]]).filter(([, w]) => positive(w)).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const [[f1, w1], second] = ranked;
  return makeItem({
    kind: RULE_KIND_OF[f1], symbol,
    fact: SHEET_COPY.rule(lens.label, f1, w1, second?.[0] ?? null, second?.[1] ?? null),
    recordKind: 'archetypeConfig', recordId: lens.archetype, label: SHEET_COPY.srcConfig(lens.label),
  });
}

function checkReadItem({ battle, symbol, holding }) {
  if (!holding.held) return null;
  const found = latestEvidence(battle, symbol);
  if (!found) return null;
  const { ev, entry, atMs } = found;
  const parts = [];
  if (typeof ev.regime === 'string' && REGIME_WORDS[ev.regime]) parts.push(REGIME_WORDS[ev.regime]);
  // BC-15: chg (from entry) and atrX (the scorer's rung unit) only on a measured position.
  if (holding.measured && finite(ev.chg)) parts.push(SHEET_COPY.checkReadFromEntry(ev.chg));
  if (holding.measured && finite(ev.atrX)) parts.push(SHEET_COPY.checkReadAtr(ev.atrX));
  if (ev.nr7 === true) parts.push(SHEET_COPY.checkReadNr7);
  if (!parts.length) return null;
  const time = whenLabel(atMs);
  return makeItem({
    kind: 'check_read', symbol, fact: SHEET_COPY.checkRead(time, parts),
    recordKind: 'evaluation', recordId: entry.evalId ?? atMs, label: SHEET_COPY.srcCheck(time), atMs, pin: timePin(atMs),
  });
}

function riskVerdictItem({ battle, symbol, holding }) {
  if (!holding.held) return null;
  const found = latestEvidence(battle, symbol);
  const action = found?.ev?.risk?.action;
  if (typeof action !== 'string' || !RISK_WORDS[action]) return null;
  const reason = action === 'SWAP_OUT' ? RISK_REASON_WORDS[found.ev.risk.reason] : null;
  const time = whenLabel(found.atMs);
  return makeItem({
    kind: 'risk_verdict', symbol, fact: SHEET_COPY.riskVerdict(time, reason ? `${RISK_WORDS[action]} (${reason})` : RISK_WORDS[action]),
    recordKind: 'evaluation', recordId: found.entry.evalId ?? found.atMs, label: SHEET_COPY.srcCheck(time), atMs: found.atMs, pin: timePin(found.atMs),
  });
}

function riskLeverItem({ lens, symbol }) {
  if (!lens.known) return null;
  const r = lens.preset?.risk ?? {};
  if (!finite(r.bustBuffer) || !finite(r.vwapFailureTicks) || !finite(r.trailStopATR)) return null;
  // The dead band as the risk manager reads it (agentRiskManager.js: `vwapDeadBandPct ?? 0.5`).
  const band = finite(r.vwapDeadBandPct) ? r.vwapDeadBandPct : 0.5;
  return makeItem({
    kind: 'risk_lever', symbol,
    fact: SHEET_COPY.riskLever(lens.label, lens.preset.label, Math.abs(r.bustBuffer).toFixed(2).replace(/0$/, ''), r.vwapFailureTicks, String(band), String(r.trailStopATR)),
    recordKind: 'presetConfig', recordId: lens.presetKey, label: SHEET_COPY.srcPreset,
  });
}

function rungDistanceItem({ holding, symbol, live }) {
  // Build A's toGo (ladder.js): the distance and the % from the DISPLAYED rung and live
  // price, so the sheet and Bomb mode print one number (BUILD_RULES §9; review A5).
  const go = toGo(holding.ladder, live);
  if (!go || !positive(go.rung?.price)) return null;
  if (!(go.distance > 0)) return null; // reached at the live price: it banks only at a check — the banked item says what has banked
  return makeItem({
    kind: 'rung_distance', symbol, fact: SHEET_COPY.rungDistance(go.rung.points, go.rungShown, go.decimals, go.distance, go.pctShown),
    // B1 (founder ruling 2026-11-11, pre-flip audit §10): the pin is the DISPLAYED rung price —
    // the one the fact prints — so the pin's line and the fact agree to the cent (BUILD_RULES §9).
    recordKind: 'position', recordId: holding.record.positionId ?? symbol, label: SHEET_COPY.srcLiveRung, pin: pricePin(go.rungShown),
  });
}

/** The move since entry, one number for the stance and the item (BUILD_RULES §9). */
export function moveSinceEntryPct(holding, live) {
  return positive(holding?.entryPrice) && positive(live) ? ((live - holding.entryPrice) / holding.entryPrice) * 100 : null;
}

function moveItem({ holding, symbol, live }) {
  const pct = moveSinceEntryPct(holding, live);
  if (pct === null) return null;
  const d = priceDecimals(holding.entryPrice);
  return makeItem({
    kind: 'move_since_entry', symbol, fact: SHEET_COPY.moveSinceEntry(pct, holding.entryPrice, d, dayLabel(holding.entryAtMs)),
    recordKind: 'position', recordId: holding.record.positionId ?? symbol, label: SHEET_COPY.srcLive, atMs: holding.entryAtMs, pin: timePin(holding.entryAtMs),
  });
}

function bankedItem({ holding, symbol, nowMs }) {
  if (!holding.ladder) return null;
  const clock = checkClock(nowMs, { battleExpiresAtMs: holding.record.battleExpiresAtMs ?? null, lastScoredAtMs: holding.record.lastScoredAtMs ?? null });
  // Build A's clock (horizon.js slots): a countdown names the slot's time, a later day its day and time.
  const next = clock.state === 'countdown' ? SHEET_COPY.nextCheckAt(etClock(clock.slotMs))
    : clock.state === 'later' ? SHEET_COPY.nextCheckAt(clock.label)
      : clock.state === 'checking' ? SHEET_COPY.checkRunning(etClock(clock.slotMs)) : null;
  const top = [...holding.ladder.up].reverse().find((r) => r.banked);
  return makeItem({
    kind: 'banked', symbol, fact: SHEET_COPY.banked(holding.ladder.bankedPoints, next),
    recordKind: 'position', recordId: holding.record.positionId ?? symbol, label: SHEET_COPY.srcPosition,
    asOfMs: holding.record.lastScoredAtMs ?? null, pin: pricePin(top?.price),
  });
}

/** Drawdown from the high since entry, from the chart's daily bars (newest- or oldest-first {date, high}). */
function drawdownItem({ holding, symbol, live, dailyBars }) {
  if (!positive(holding.entryPrice) || !finite(holding.entryAtMs) || !positive(live) || !Array.isArray(dailyBars) || !dailyBars.length) return null;
  const since = etDate(holding.entryAtMs);
  const rows = dailyBars.filter((b) => typeof b?.date === 'string' && b.date.slice(0, 10) >= since && positive(Number(b.high)));
  if (!rows.length) return null;
  let top = rows[0];
  for (const b of rows) if (Number(b.high) > Number(top.high)) top = b;
  const lastDate = dailyBars.map((b) => b?.date).filter((x) => typeof x === 'string').sort().at(-1)?.slice(0, 10) ?? null;
  const high = Number(top.high);
  const d = priceDecimals(live);
  // The daily bars start with the ENTRY DAY's whole bar (its high may come before the
  // fill), so the item names that day, never "since entry" (review A11).
  const sinceDay = dayLabel(holding.entryAtMs);
  const source = { recordKind: 'chart', recordId: `${symbol}:${lastDate ?? ''}`, label: SHEET_COPY.srcChart(lastDate ? dayLabel(Date.parse(`${lastDate}T16:00:00Z`)) : '') };
  // The live price at or above every bar's high: the high IS the live price — the
  // number the header shows — never an older bar's (review A11).
  if (live >= high) {
    return makeItem({ kind: 'drawdown', symbol, fact: SHEET_COPY.atHighLive(live, d, sinceDay), ...source, pin: pricePin(live) });
  }
  const topMs = Date.parse(`${top.date.slice(0, 10)}T16:00:00Z`);
  const off = ((high - live) / high) * 100;
  return makeItem({
    kind: 'drawdown', symbol, fact: SHEET_COPY.drawdown(off, high, d, dayLabel(topMs), sinceDay),
    ...source, atMs: topMs, pin: pricePin(high),
  });
}

const agentSymbols = (battle) => {
  const out = [];
  for (const tier of TIERS) for (const a of (Array.isArray(battle?.portfolio?.[tier]) ? battle.portfolio[tier] : [])) if (a && typeof a.symbol === 'string') out.push(a.symbol);
  return out;
};
const ticksOf = (battle, sym) => { const n = battle?.cronState?.stagnationTicks?.[sym]; return finite(n) ? n : 0; };

function stalledItem({ battle, lens, symbol }) {
  if (!lens.known) return null;
  const fr = lens.forcedRotation;
  const asOfMs = recordMs(battle?.scoreState?.lastScoredAt);
  if (!fr || fr.enabled !== true || !finite(fr.ticksThreshold)) {
    return makeItem({ kind: 'stalled', symbol, fact: SHEET_COPY.noRotation(lens.label), recordKind: 'archetypeConfig', recordId: lens.archetype, label: SHEET_COPY.srcConfig(lens.label) });
  }
  const names = agentSymbols(battle)
    .filter((s) => ticksOf(battle, s) >= fr.ticksThreshold)
    .map((s) => `${s} (${ticksOf(battle, s)})`);
  return makeItem({ kind: 'stalled', symbol, fact: SHEET_COPY.stalled(lens.label, fr.ticksThreshold, names), recordKind: 'cronState', recordId: 'stagnationTicks', label: SHEET_COPY.srcCounter, asOfMs });
}

function incumbentItem({ battle, lens, incumbent }) {
  if (typeof incumbent !== 'string' || !incumbent || !agentPositionOf(battle, incumbent)) return null;
  const fr = lens.forcedRotation;
  const on = lens.known && fr?.enabled === true && finite(fr.ticksThreshold);
  return makeItem({
    kind: 'incumbent', symbol: incumbent,
    fact: on ? SHEET_COPY.incumbent(incumbent, ticksOf(battle, incumbent), lens.label, fr.ticksThreshold) : SHEET_COPY.incumbentNoRotation(incumbent),
    recordKind: 'cronState', recordId: `stagnationTicks.${incumbent}`, label: SHEET_COPY.srcCall, asOfMs: recordMs(battle?.scoreState?.lastScoredAt),
  });
}

/** The scored distance to the next rung for one held measured name (the last check's price; BC-15: measured only). */
function scoredGapOf(battle, sym, nowMs) {
  const rec = selectBombRecord(battle, sym, nowMs);
  if (rec?.model !== 'measured' || !rec.measured || !rec.scored) return null;
  const ladder = measuredLadder({ measured: rec.measured, entryAtMs: rec.entry?.atMs ?? null });
  if (ladder.status !== 'ok') return null;
  if (!ladder.next) return { sym, positionId: rec.positionId, top: true, atMs: rec.scored.atMs };
  // Displayed values, as the rung-distance item and Bomb mode (ladder.js toGo; BUILD_RULES §9).
  const go = toGo(ladder, rec.scored.price);
  if (!go) return null;
  return { sym, positionId: rec.positionId, gap: Math.max(0, go.distance), points: ladder.next.points, decimals: go.decimals, atMs: rec.scored.atMs };
}

function rungCompareItem({ battle, lens, symbol, incumbent, nowMs }) {
  const fr = lens.forcedRotation;
  const stalled = fr?.enabled === true && finite(fr.ticksThreshold)
    ? agentSymbols(battle).filter((s) => s !== symbol && ticksOf(battle, s) >= fr.ticksThreshold)
    : [];
  const names = [symbol, ...(incumbent && incumbent !== symbol ? [incumbent] : []), ...stalled.filter((s) => s !== incumbent)];
  const rows = names.map((s) => scoredGapOf(battle, s, nowMs)).filter(Boolean);
  if (!rows.length) return null;
  const atMs = Math.max(...rows.map((r) => r.atMs).filter(finite));
  return makeItem({
    kind: 'rung_compare', symbol,
    fact: SHEET_COPY.rungCompare(rows.map((r) => (r.top ? SHEET_COPY.rungCompareTop(r.sym) : SHEET_COPY.rungCompareRow(r.sym, r.gap, r.decimals, r.points)))),
    recordKind: 'position', recordId: rows.map((r) => r.positionId ?? r.sym).join(','), label: SHEET_COPY.srcPosition, asOfMs: finite(atMs) ? atMs : null,
  });
}

/** The rankings doc's computedAt as epoch ms (a Firestore Timestamp, `{ seconds }`, or ms). */
const rankingsMs = (doc) => recordMs(doc?.computedAt) ?? (finite(doc?.computedAt?.seconds) ? doc.computedAt.seconds * 1000 : null);

function rankScoresItem({ battle, lens, symbol, incumbent, rankings }) {
  if (!lens.known || !rankings || !Array.isArray(rankings.stocks)) return null;
  const fr = lens.forcedRotation;
  const stalled = fr?.enabled === true && finite(fr.ticksThreshold) ? agentSymbols(battle).filter((s) => s !== symbol && ticksOf(battle, s) >= fr.ticksThreshold) : [];
  const names = [symbol, ...(incumbent && incumbent !== symbol ? [incumbent] : []), ...stalled.filter((s) => s !== incumbent)];
  const scoreOf = (s) => { const row = rankings.stocks.find((r) => r?.symbol === s); const v = row?.arch_scores?.[lens.archetype]; return finite(v) ? v : null; };
  if (scoreOf(symbol) === null) return null;
  const rows = names.filter((s) => scoreOf(s) !== null).map((s) => SHEET_COPY.rankRow(s, scoreOf(s)));
  const ms = rankingsMs(rankings);
  return makeItem({
    kind: 'rank_scores', symbol, fact: SHEET_COPY.rankScores(lens.label, rows, dayLabel(ms)),
    recordKind: 'stockRankings', recordId: 'stockRankings', label: SHEET_COPY.srcRankings, asOfMs: ms,
  });
}

function benchSignalItem({ battle, symbol, holding }) {
  if (holding.held) return null;
  const bench = benchCandidateOf(battle, symbol);
  const summary = bench?.candidate?.signalSummary;
  if (typeof summary !== 'string' || !summary.trim()) return null;
  const atMs = recordMs(bench.entry.timestamp);
  const time = whenLabel(atMs);
  return makeItem({
    kind: 'bench_signal', symbol, fact: SHEET_COPY.benchSignal(time, clampText(summary, FACT_MAX - 24)),
    recordKind: 'evaluation', recordId: bench.entry.evalId ?? atMs, label: SHEET_COPY.srcCheck(time), atMs, pin: timePin(atMs),
  });
}

function ideaItem({ battle, symbol }) {
  const idea = ideaOf(battle, symbol);
  if (!idea) return null;
  const level = idea.conditions[0]?.level ?? null;
  return makeItem({
    kind: 'idea', symbol, fact: SHEET_COPY.idea(clampText(idea.statement, FACT_MAX - 24)),
    recordKind: 'hypothesisVersion', recordId: idea.recordId, label: SHEET_COPY.srcIdea, atMs: idea.deployMs, pin: pricePin(level),
  });
}

function toldItItem({ directive, symbol }) {
  const d = directiveFor(directive, symbol);
  if (!d) return null;
  const atMs = recordMs(d.createdAt);
  return makeItem({
    kind: 'told_it', symbol, fact: SHEET_COPY.toldIt(clampText(d.text, FACT_MAX - 4)),
    recordKind: 'directive', recordId: d.directiveThreadId,
    label: SHEET_COPY.srcToldIt(whenLabel(atMs) ?? '', d.directiveThreadId.startsWith(PLAN_THREAD_PREFIX)), atMs,
  });
}

/**
 * Every candidate item for one stock, unordered, keyed by kind (a kind with
 * nothing behind it is absent).
 *
 * @param {object} p
 * @param {object} p.battle       the agent-battle document
 * @param {string} p.symbol
 * @param {number} p.nowMs
 * @param {object} [p.row]        the mount's row { posKey?, positionId? }
 * @param {number} [p.live]       the price the modal shows (client only)
 * @param {Array}  [p.dailyBars]  the chart's daily bars {date, high} (client only)
 * @param {object} [p.rankings]   indexIntelligence/stockRankings (client only)
 * @param {object} [p.standing]   { player, opponent, digits } as the Battle View shows it (client only)
 * @param {object} [p.directive]  the battle's active directive (the screen's; the server passes the stored slot)
 * @param {string} [p.incumbent]  BC-11: the held name a "Who comes in?" call would replace
 */
export function candidateItems(p) {
  const { battle, symbol, nowMs } = p;
  const lens = lensOf(battle);
  const holding = holdingOf(battle, symbol, nowMs, p.row);
  const args = { ...p, lens, holding, battleId: p.battleId ?? null };
  const list = [
    rungDistanceItem(args), moveItem(args), checkReadItem(args), ruleItem(args), standingItem(args),
    riskLeverItem(args), riskVerdictItem(args), bankedItem(args), drawdownItem(args),
    incumbentItem(args), stalledItem(args), rungCompareItem(args), rankScoresItem(args), benchSignalItem(args),
    ideaItem(args), toldItItem(args),
  ].filter(Boolean);
  return { lens, holding, items: list };
}

/** One question's pack: { questionId, label, items } (three to five where the record has them). */
export function packFor(questionId, built) {
  if (!QUESTION_IDS.includes(questionId)) return null;
  const allowed = new Set(PACK_CANDIDATES[questionId].flatMap((k) => (k === 'rule' ? Object.values(RULE_KIND_OF) : [k])));
  const items = built.items.filter((it) => allowed.has(it.kind) || LOOP_KINDS.includes(it.kind));
  return { questionId, label: SHEET_COPY.weighs(built.lens.label), items: orderItems(items, built.lens) };
}

/** All three packs. */
export function buildPacks(p) {
  const built = candidateItems(p);
  return { lens: built.lens, holding: built.holding, packs: Object.fromEntries(QUESTION_IDS.map((q) => [q, packFor(q, built)])) };
}

/**
 * BC-11: the held name a cockpit call would replace — an exit call's own symbol
 * ("Who comes in?": the agent takes it out, the bench names its replacement);
 * an entry call's counterpart (its filing checks the counterpart is held in the
 * call's slot tier). No call, another direction, or the opened name itself: none.
 */
export function incumbentOfCall(call, openedSymbol) {
  const name = call?.direction === 'exit' ? call.symbol : call?.direction === 'entry' ? call.counterpart : null;
  return typeof name === 'string' && name && name !== openedSymbol ? name : null;
}

// ── Layer 0: the stance and the question order ──────────────────────────────

/**
 * The stance line (BC-9, BC-15): chips, and the idea's statement when it applies.
 * @returns {{ kind, chips: Array<{ text, tone }>, idea: { label, statement }|null }}
 */
export function stanceOf({ battle, symbol, nowMs, row, live }) {
  const holding = holdingOf(battle, symbol, nowMs, row);
  const idea = ideaOf(battle, symbol);
  const chips = [];
  let kind;
  if (holding.held) {
    kind = holding.measured ? 'held_measured' : 'held';
    const since = dayLabel(holding.entryAtMs);
    chips.push({ text: since ? SHEET_COPY.stanceHoldingSince(since) : SHEET_COPY.stanceHolding, tone: 'green', dot: true });
    if (holding.measured && positive(holding.entryPrice)) {
      const pct = moveSinceEntryPct(holding, live);
      const entry = SHEET_COPY.stanceEntry(holding.entryPrice, priceDecimals(holding.entryPrice));
      chips.push({ text: pct === null ? entry : `${entry} · ${SHEET_COPY.stanceMove(pct)}`, tone: null });
      if (holding.ladder && holding.ladder.bankedPoints > 0) chips.push({ text: SHEET_COPY.stanceBanked(holding.ladder.bankedPoints), tone: 'green' });
    }
  } else {
    const bench = benchCandidateOf(battle, symbol);
    const looked = bench ? null : latestVoicedCheckOn(battle, symbol);
    if (bench) {
      kind = 'bench';
      chips.push({ text: SHEET_COPY.stanceBench(whenLabel(recordMs(bench.entry.timestamp)) ?? ''), tone: 'amber' });
    } else if (looked) {
      // FQ-2 (2026-11-08): a check examined it (sold since, or an older list) — never "Not examined".
      kind = 'looked';
      chips.push({ text: SHEET_COPY.stanceLooked(whenLabel(recordMs(looked.timestamp)) ?? ''), tone: null });
    } else if (idea?.onList) {
      kind = 'idea_unexamined';
      chips.push({ text: SHEET_COPY.stanceIdeaUnexamined, tone: null });
    } else {
      kind = 'unexamined';
      chips.push({ text: SHEET_COPY.stanceUnexamined, tone: null });
    }
  }
  const ideaChip = idea && kind !== 'idea_unexamined' ? SHEET_COPY.stanceIdea(dayLabel(idea.deployMs) ?? '') : null;
  if (ideaChip) chips.push({ text: ideaChip, tone: 'purple' });
  return { kind, chips, holding, idea: idea ? { statement: idea.statement, conditions: idea.conditions } : null };
}

/** BC-13: the questions in standing order (trailing → catch up first; leading → protect the lead first). */
export function questionOrder(standing) {
  // The header's own lead (shownStanding) — never a re-derivation from rounded digits (review A6).
  const shown = shownStanding(standing);
  if (shown?.lead === 'cpu') return ['catch_up', 'protect_lead', 'better_than_stalled'];
  if (shown?.lead === 'player') return ['protect_lead', 'catch_up', 'better_than_stalled'];
  return [...QUESTION_IDS];
}

// ── BC-8: the record's pins ─────────────────────────────────────────────────

/**
 * The record pinned to the chart: markers (instants — the caller snaps each to
 * its daily bar) and price lines.
 * @returns {{ markers: Array<{ id, kind, atMs, label }>, lines: Array<{ id, kind, price, label, group }> }}
 */
export function recordPinsOf({ battle, symbol, nowMs, row, calls }) {
  const holding = holdingOf(battle, symbol, nowMs, row);
  const markers = [];
  if (holding.measured && finite(holding.entryAtMs)) markers.push({ id: 'entry', kind: 'entry', atMs: holding.entryAtMs, label: SHEET_COPY.pinEntry(whenLabel(holding.entryAtMs)) });
  for (const c of (Array.isArray(calls) ? calls : [])) {
    if (!c || c.symbol !== symbol) continue;
    const id = String(c.callId ?? c.id ?? '');
    const minted = recordMs(c.mintedAt);
    if (finite(minted)) markers.push({ id: `call:${id}`, kind: 'call', atMs: minted, label: SHEET_COPY.pinCall(whenLabel(minted)) });
    const filed = recordMs(c.playerResponse?.filedAt);
    if (finite(filed)) markers.push({ id: `answer:${id}`, kind: 'answer', atMs: filed, label: SHEET_COPY.pinAnswer(whenLabel(filed)) });
  }
  // The check the voice line quotes (FQ-1): the latest that looked at the name and spoke.
  const check = latestVoicedCheckOn(battle, symbol);
  const checkMs = recordMs(check?.timestamp);
  // The pin says what that check did for THIS stock: a name it only flagged (on its
  // candidates list, not held, no evidence of its own) was flagged, never "decided".
  const onlyFlagged = !!check && !holding.held && !(check.evidence && typeof check.evidence === 'object' && check.evidence[symbol])
    && Array.isArray(check.candidates) && check.candidates.some((c) => c?.symbol === symbol);
  if (finite(checkMs)) markers.push({ id: `check:${check.evalId ?? checkMs}`, kind: 'check', atMs: checkMs, label: onlyFlagged ? SHEET_COPY.pinFlag(whenLabel(checkMs)) : SHEET_COPY.pinCheck(whenLabel(checkMs)) });
  markers.sort((a, b) => a.atMs - b.atMs);

  const lines = [];
  if (holding.measured && positive(holding.entryPrice)) {
    lines.push({ id: 'entry', kind: 'entry', price: holding.entryPrice, label: SHEET_COPY.lineEntry(holding.entryPrice, priceDecimals(holding.entryPrice)), group: 'record' });
  }
  const idea = ideaOf(battle, symbol);
  for (const [i, c] of (idea?.conditions ?? []).entries()) {
    const d = priceDecimals(c.level);
    lines.push({
      id: `idea:${i}`, kind: c.role === 'live' ? 'idea_live' : 'idea_wrong', price: c.level,
      label: c.role === 'live' ? SHEET_COPY.lineIdeaLive(c.side, c.level, d) : SHEET_COPY.lineIdeaWrong(c.side, c.level, d), group: 'idea',
    });
  }
  return { markers, lines };
}
