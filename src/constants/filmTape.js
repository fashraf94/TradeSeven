// src/constants/filmTape.js
//
// Film Room Build A — THE TAPE: the vocabulary every tape reader and writer
// shares (spec docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md §3–§6).
//
// ZERO imports, by the agentGameModes.js precedent: the server writer
// (api/_utils/filmTape/), the export script and — in A2 — the screen all read
// the same words and the same number-class declaration, so a label and its
// number can never come from two sources (BUILD_RULES §9). Node-clean and
// browser-clean by construction; api/ imports it under the §4 import rule.

/** The document version (spec §4). */
export const TAPE_VERSION = 2;

/** `agentBattles/{battleId}/tape/{etDate}` and `…/tape/{etDate}/series/{symbol}` (BA-1). */
export const TAPE_SUBCOLLECTION = 'tape';
export const SERIES_SUBCOLLECTION = 'series';

/** BA-16 — the call-record contract the copied fields are defined by. */
export const CALL_CONTRACT_VERSION = 'V1.4';

// ── BA-21: the four provenance classes. There is no fifth. ──────────────────
export const PROVENANCE_CLASSES = Object.freeze(['recorded', 'derived', 'rebuilt', 'market']);

/** The label the screen and the export print beside a number of each class. */
export const PROVENANCE_LABELS = Object.freeze({
  recorded: 'recorded',
  derived: 'derived from recorded values',
  rebuilt: "rebuilt from 1-minute bars at the battle's check times",
  market: 'market data · EODHD 1-minute bars, aggregated',
});

// ── BA-20: coverage ─────────────────────────────────────────────────────────
export const COVERAGE_STATUSES = Object.freeze(['complete', 'partial', 'unavailable']);
/** Rank for the monotone merge: a later run never reports less than it holds. */
export const COVERAGE_RANK = Object.freeze({ unavailable: 0, partial: 1, complete: 2 });
export const COVERAGE_SECTIONS = Object.freeze([
  'checks', 'actions', 'directives', 'plans', 'calls', 'rationale', 'evidence', 'replay', 'series',
]);
/** The two sections only the candle pass writes (BA-19). */
export const CANDLE_COVERAGE_SECTIONS = Object.freeze(['replay', 'series']);

// ── BA-8: check states ──────────────────────────────────────────────────────
// A tick-backed check takes its capture `exitReason`, except that a
// budget-skipped model call reads `budget_skipped` (its tick exits `completed`).
// `deferred` comes from agentEvalRuns; `no_record` is a minted tickSeq with no
// document. "Capture absent" is a DAY state (passes.close.capture), not a row.
export const CHECK_STATES = Object.freeze([
  'completed', 'no_trigger', 'budget_skipped', 'deferred', 'gameplan_pending', 'gameplan_created',
  'proposal_pending', 'degraded_quotes', 'cpu_passive', 'tick_error', 'no_record', 'unknown',
]);

/** The tick exits that are also check states, verbatim (captureConfig.js EXIT_REASONS). */
export const TICK_EXIT_STATES = Object.freeze([
  'degraded_quotes', 'cpu_passive', 'proposal_pending', 'gameplan_pending', 'gameplan_created',
  'no_trigger', 'completed', 'tick_error',
]);

/** Rows that record no check the battle actually ran. */
export const NON_CHECK_STATES = Object.freeze(['deferred', 'no_record']);

// ── BA-9: the directive card ────────────────────────────────────────────────
export const CARD_STATES = Object.freeze(['committed', 'no_change', 'not_filed']);
/** archetypeGate.status values that read as one "no change" bucket (answers doc §B2). */
export const NO_CHANGE_GATE_STATUSES = Object.freeze(['no_change', 'no_proposal', 'invalid_id']);

// ── BA-6: who made the exit, by the line that fired (design note §4.3) ──────
// A fixed table from the recorded exitReason. An exitReason not in it is
// `unrecorded` — never guessed from the source or the prose.
export const EXIT_MECHANISMS = Object.freeze({
  bust_avoidance: 'platform_risk_manager',
  vwap_failure: 'platform_risk_manager',
  stepped_trail: 'platform_risk_manager',
  stagnation: 'archetype_rotation',
  guardrail_stopLoss: 'guardrail',
  guardrail_trailingStop: 'guardrail',
  guardrail_profitTarget: 'guardrail',
  gameplan_rotation: 'gameplan_meeting',
  haiku_decision: 'agent_decision',
});

// ── The candle pass (spec §6) ───────────────────────────────────────────────
// BA-32: terminal candle work has statuses of its own — `expired` (the
// 10-session retry window elapsed while it waited) and `exhausted` (the third
// attempt did not succeed), each keeping its reason — and `failed` means
// retryable only. No candle query ever selects a terminal status.
export const CANDLE_PASS_STATUSES = Object.freeze(['pending', 'written', 'partial', 'failed', 'expired', 'exhausted', 'skipped']);
/** The non-terminal statuses: the only ones any candle query selects (the sweep and the selection, BA-32). */
export const CANDLE_SELECTABLE_STATUSES = Object.freeze(['pending', 'partial', 'failed']);
/** BA-32 — no candle pass will run for a tape in one of these again. */
export const CANDLE_TERMINAL_STATUSES = Object.freeze(['expired', 'exhausted']);
export const CANDLE_MAX_ATTEMPTS = 3;
/** "up to 10 trading days old" — the only retry path there is. */
export const CANDLE_RETRY_WINDOW_SESSIONS = 10;
export const CANDLE_SOURCES = Object.freeze(['eodhd_1m', 'shared_cache']);
/** BA-13 — the market comparables, stored beside every tape. */
export const MARKET_COMPARABLES = Object.freeze(['SPY', 'RSP']);
/** Deep-dive bar width (BA-12). */
export const SERIES_INTERVAL = '10m';
export const SERIES_ROLES = Object.freeze(['held', 'sold', 'plan', 'market', 'sector']);

// ── The two schedules (vercel.json) — the hub helper reads the close pass's ─
// UTC `15 2 * * 2-6`: 22:15 EDT / 21:15 EST, the SAME ET date as the session.
export const CLOSE_PASS_SCHEDULE_UTC = '15 2 * * 2-6';
export const CLOSE_PASS_UTC_HOUR = 2;
export const CLOSE_PASS_UTC_MINUTE = 15;
/** The pass may take its full maxDuration; `pending` is honest until then. */
export const CLOSE_PASS_MAX_DURATION_S = 300;
// UTC `0 11 * * 2-6`: 07:00 EDT / 06:00 EST, the morning after the session.
export const CANDLE_PASS_SCHEDULE_UTC = '0 11 * * 2-6';
export const CANDLE_PASS_UTC_HOUR = 11;

/** BA-17 — the one piece of metadata the hub may learn. */
export const REVIEW_AVAILABILITY = Object.freeze(['ready', 'pending', 'unavailable']);
/** The existing Film Room route: the App screen id (src/App.jsx `screen === 'filmRoom'`). */
export const FILM_ROOM_ROUTE = 'filmRoom';

// ── BA-21: the number-class declaration (one convention, used everywhere) ───
//
// A SECTION-LEVEL DECLARATION, stored verbatim on every tape document as
// `numberClasses` (and on every series document as its own), so a reader with
// no code still labels every number from the document itself. Keys are field
// paths: `[]` stands for any array element, `*` for any map key (a symbol).
// The export script and the tests walk EVERY numeric leaf of a document and
// resolve it here; a number that resolves to nothing — or to two classes — is
// a bug, and the tests fail on it.
//
// The rule for mixed arithmetic: from recorded values alone → `derived`; from
// bars alone → `market`; from bars and recorded values together (a scored
// replay, a reconciliation) → `rebuilt`.
export const TAPE_NUMBER_CLASSES = Object.freeze({
  // the tape's own bookkeeping
  tapeVersion: 'recorded',
  runCount: 'derived',
  dayNumber: 'derived',
  // A tickSeq is the platform's MINTED identifier — recorded wherever it
  // appears, a `no_record` row and the gap lists included: that a minted number
  // has no record is the row's STATE, never the number's class (review
  // L1-F9a / L4-F8 — one number, one class).
  'passes.close.tickSeqRange[]': 'recorded',
  'passes.close.gaps[]': 'recorded',
  'passes.close.unattributedGaps[]': 'recorded',
  'passes.close.sources.*': 'derived',
  'passes.candles.attempts': 'derived',
  // BA-26: minted checks whose record of what they read or produced is absent
  // — a count of recorded identifiers, stored on the sections that read them
  'coverage.*.unknownChecks': 'derived',
  // BA-4 — the score
  'score.lastCheck.tickSeq': 'recorded',
  'score.lastCheck.active': 'recorded',
  'score.lastCheck.banked': 'recorded',
  'score.lastCheck.total': 'recorded',
  'score.lastCheck.opponent': 'recorded',
  'score.lastCheck.bankedBadgePoints': 'recorded',
  'score.firstCheck.tickSeq': 'recorded',
  'score.firstCheck.total': 'recorded',
  'score.dayChange.value': 'derived',
  'score.dayChange.reference': 'recorded',
  'battle.final.total': 'recorded',
  'battle.final.opponent': 'recorded',
  // checks
  'checks[].tickSeq': 'recorded',
  'checks[].scores.active': 'recorded',
  'checks[].scores.banked': 'recorded',
  'checks[].scores.total': 'recorded',
  'checks[].tickMs': 'recorded',
  'checks[].guardrail.deployedCount': 'recorded',
  'checks[].evidence.*.px': 'recorded',
  'checks[].evidence.*.chg': 'recorded',
  'checks[].evidence.*.atrX': 'recorded',
  'checks[].evidence.*.vwapDev': 'recorded',
  'checks[].evidence.*.bbPct': 'recorded',
  // actions (close pass)
  'actions[].tickSeq': 'recorded',
  'actions[].slotIndex': 'recorded',
  'actions[].entryPrice': 'recorded',
  'actions[].exitPrice': 'recorded',
  'actions[].lockedPoints': 'recorded',
  'actions[].lockedGainPct': 'recorded',
  'actions[].inBasis.price': 'recorded',
  'actions[].holdingMs': 'derived',
  'actions[].subsequentTradesInSlot': 'derived',
  'actions[].replayInputs.ghost.entryPrice': 'recorded',
  'actions[].replayInputs.ghost.atr': 'recorded',
  'actions[].replayInputs.ghost.thresholdHistory.maxMultiplier': 'recorded',
  'actions[].replayInputs.ghost.thresholdHistory.minMultiplier': 'recorded',
  // A copy of a recorded entry price; which precedence applied is the string
  // `basis` beside it (review L1-F9b, refuted: recorded stands).
  'actions[].replayInputs.ghost.thresholdBaseline.value': 'recorded',
  'actions[].replayInputs.bought.entryPrice': 'recorded',
  'actions[].replayInputs.bought.atr': 'recorded',
  // Exactly what the executor's swap write sets for the incoming symbol
  // (agentSwapExecution.js:307-311), and the fill it bought at — platform
  // writes (review L1-F9b, refuted: recorded stands).
  'actions[].replayInputs.bought.thresholdHistory.maxMultiplier': 'recorded',
  'actions[].replayInputs.bought.thresholdHistory.minMultiplier': 'recorded',
  'actions[].replayInputs.bought.thresholdBaseline.value': 'recorded',
  // actions (candle pass — BA-11)
  'actions[].replay.ghost.atSwap': 'rebuilt',
  'actions[].replay.ghost.atClose': 'rebuilt',
  'actions[].replay.ghost.series[].tickSeq': 'recorded',
  'actions[].replay.ghost.series[].points': 'rebuilt',
  'actions[].replay.bought.atClose': 'rebuilt',
  'actions[].replay.bought.series[].tickSeq': 'recorded',
  'actions[].replay.bought.series[].points': 'rebuilt',
  'actions[].replay.holdPath[].tickSeq': 'recorded',
  'actions[].replay.holdPath[].points': 'rebuilt',
  'actions[].replay.swapPath[].tickSeq': 'recorded',
  'actions[].replay.swapPath[].points': 'rebuilt',
  'actions[].replay.gapPoints': 'rebuilt',
  'actions[].replay.lockedPoints': 'recorded',
  'actions[].replay.subsequentTradesInSlot': 'derived',
  'actions[].replay.reconciliation.closedLegDelta': 'rebuilt',
  'actions[].replay.reconciliation.boughtVsEvidence.tickSeq': 'recorded',
  'actions[].replay.reconciliation.boughtVsEvidence.recordedPx': 'recorded',
  'actions[].replay.reconciliation.boughtVsEvidence.recordedChg': 'recorded',
  'actions[].replay.reconciliation.boughtVsEvidence.rebuiltPx': 'market',
  'actions[].replay.reconciliation.boughtVsEvidence.rebuiltChg': 'rebuilt',
  'actions[].replay.reconciliation.boughtVsEvidence.pxDelta': 'rebuilt',
  'actions[].replay.reconciliation.boughtVsEvidence.chgDelta': 'rebuilt',
  'actions[].replay.marketChangeAfter.*': 'market',
  'actions[].replay.sectorChangeAfter.*': 'market',
  // directives
  'directives[].canonicalTextVersion': 'recorded',
  'directives[].heard.tickSeq': 'recorded',
  'directives[].after.checks': 'derived',
  'directives[].after.holds': 'derived',
  'directives[].after.swaps': 'derived',
  // plans
  'plans[].tickSeq': 'recorded',
  'plans[].price.atPlan.value': 'market',
  'plans[].price.atClose.value': 'market',
  // calls (BA-16 — epoch-ms instants as the call record stores them)
  'calls[].mintedAt': 'recorded',
  'calls[].expiresAt': 'recorded',
  'calls[].resolvedAt': 'recorded',
  'calls[].horizon.expiresAt': 'recorded',
  'calls[].hypothesisRef.hypothesisVersion': 'recorded',
  // rationale
  'rationale[].tickSeq': 'recorded',
});

/** The same declaration for `tape/{etDate}/series/{symbol}`. */
export const SERIES_NUMBER_CLASSES = Object.freeze({
  tapeVersion: 'recorded',
  'sessionOpen.value': 'market',
  'bars[].o': 'market',
  'bars[].h': 'market',
  'bars[].l': 'market',
  'bars[].c': 'market',
  'bars[].v': 'market',
  'bars[].n': 'market',
  // BA-34: the 1-minute bars a 10-minute bar was built from — what a retry's merge compares
  'bars[].m': 'market',
  'atChecks[].tickSeq': 'recorded',
  'atChecks[].price': 'market',
});

const splitDeclared = (key) => key.replace(/\[\]/g, '.[]').split('.').filter(Boolean);

/**
 * The class of the number at `segments` (a concrete path: strings for object
 * keys, integers for array indices) under `declaration`, or null when none
 * matches. More than one match is reported as null too — a number is labelled
 * by exactly one class or it is a bug.
 *
 * @param {Record<string,string>} declaration
 * @param {(string|number)[]} segments
 * @returns {string|null}
 */
export function classOfNumber(declaration, segments) {
  const concrete = segments.map((s) => (typeof s === 'number' ? '[]' : String(s)));
  const hits = [];
  for (const [key, cls] of Object.entries(declaration || {})) {
    const declared = splitDeclared(key);
    if (declared.length !== concrete.length) continue;
    let ok = true;
    for (let i = 0; i < declared.length; i += 1) {
      const d = declared[i];
      const c = concrete[i];
      if (d === c) continue;
      if (d === '*' && c !== '[]') continue;
      ok = false;
      break;
    }
    if (ok) hits.push(cls);
  }
  return hits.length === 1 && PROVENANCE_CLASSES.includes(hits[0]) ? hits[0] : null;
}

/**
 * Every finite number in `doc`, with its concrete path and its class from the
 * declaration (null when unclassified). Pure; walks plain objects and arrays.
 *
 * @returns {{ path: (string|number)[], value: number, cls: string|null }[]}
 */
export function numbersWithClasses(doc, declaration, { skipKeys = ['numberClasses'] } = {}) {
  const out = [];
  const walk = (node, path) => {
    if (typeof node === 'number') {
      if (Number.isFinite(node)) out.push({ path, value: node, cls: classOfNumber(declaration, path) });
      return;
    }
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, [...path, i])); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (path.length === 0 && skipKeys.includes(k)) continue;
        walk(v, [...path, k]);
      }
    }
  };
  walk(doc, []);
  return out;
}

/** `a.b[3].c` from a concrete segment list — for messages and the export. */
export function formatNumberPath(segments) {
  return segments.reduce((acc, s) => (typeof s === 'number' ? `${acc}[${s}]` : (acc ? `${acc}.${s}` : String(s))), '');
}
