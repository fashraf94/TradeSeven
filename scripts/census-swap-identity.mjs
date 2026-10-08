// scripts/census-swap-identity.mjs
//
// Pilot P6 — the swap identity CENSUS (G01). Plan of record:
// docs/audits/20261007_PHASE0_PILOT_P6_SWAP_IDENTITY.md §6.3 (the join table)
// and docs/audits/20261007_BUILD_PILOT_P6_SWAP_IDENTITY.md (how and when to run
// it: before the off → shadow flip, then as the shadow read before
// shadow → enforce).
//
// TWO READS OF THE SAME RETAINED RECORDS:
//   1. THE BELIEF CENSUS (any mode, no build needed): over every retained
//      `trades[]` row, the symbol the deciding caller BELIEVED it was selling
//      against the symbol the executor actually COMMITTED (`trades[].symbolOut`).
//      The belief is already on the record (Phase 0 §6.3):
//        risk        `trades[].evaluationId = risk_<reason>_<SYM>_<ms>`
//        suppression `trades[].evaluationId = guardrail_<type>_<SYM>_<ms>`
//        meeting     `trades[].evaluationId = gameplan_<OUT>_<IN>_<ms>`
//        model       `evaluations[].symbolOut` of the SWAP entry with the row's
//                    evalId AND incoming symbol (evalIds repeat on battles
//                    older than the Sep 21 evaluation counter)
//        proposal    the same join on a PROPOSAL entry, else
//                    `proposalHistory[].symbolOut` by its evaluationMetadata.evaluationId
//      A row whose belief cannot be joined (an evaluation that aged out of the
//      150-entry cap) is counted as `unknown`, never as a match; one whose join
//      finds conflicting beliefs is `ambiguous`, never a mismatch.
//   2. THE SHADOW READ (once SWAP_IDENTITY_MODE ≠ 'off'): every
//      `trades[].verification` the executor wrote, by caller × verdict × basis;
//      a verification whose `battleStatus` is not exactly 'active' (null — a
//      missing status — included: the executor fails closed) is counted apart
//      as "enforce would refuse: battle_not_active", never under its verdict —
//      enforce refuses it before the identity comparison, so a matching
//      identity on an ended battle is not a clean match (integrity build, Part C);
//      a cross-check that the executor's verdict agrees with the symbol
//      comparison above; and the refusals the callers recorded at 'enforce'
//      (evaluation `executionRefusal`, proposal / meeting history rows, feed
//      beats), plus the honest-record markers (`executionFailed`,
//      `auto_execution_failed`). A `verification` the executor did not write
//      (wrong mode or id — e.g. planted through a client-written proposal) is
//      counted apart as invalid, never as a verdict.
//
// RETENTION: `trades[]` keeps the last 50 rows per battle, `evaluations[]` the
// last 150, `proposalHistory[]` the last 50, the feed the last 100 beats — so
// the census covers a retained window, not all history. The report prints each
// battle's trade and evaluation windows. Run it at least weekly during the
// shadow period.
//
// READ-ONLY BY CONSTRUCTION. The Firestore calls in this file are `.select()`,
// `.get()` and `getAll()` reads only. There is no `set`, `update`, `delete`,
// `create`, `add`, `commit`, `runTransaction`, `batch`, `bulkWriter` or
// `recursiveDelete` call — scripts/census-swap-identity.test.js pins every
// member call in this file to a reviewed allowlist. The only files it writes
// are the local report named by --out and the JSON named by --json.
//
// CREDENTIALS — the existing loaders only, loaded LAZILY inside main() so that
// importing this module (the test does) reads no environment and touches no
// SDK: scripts/loadLocalEnv.js (.env.local → process.env) +
// api/_utils/firebaseAdmin.js getFirebaseAdmin(). The founder runs it; a build
// session never runs it against production.
//
// USAGE (repo root):
//   node scripts/census-swap-identity.mjs [--since=<ISO>] [--out <report.md>] [--json <data.json>]
//     --since=<ISO>  (or `--since <ISO>`) count only what happened at/after this
//                    instant (e.g. the shadow flip's production deploy): trades
//                    by swappedOutAt, entries and beats by timestamp, history
//                    rows by resolvedAt (else createdAt); battles that expired
//                    before it are not read. Omitted: every retained row.

import { writeFileSync } from 'node:fs';

// ---------------------------------------------------------------- constants

export const CALLERS = Object.freeze(['risk', 'model', 'proposal', 'suppression', 'meeting', 'unknown']);
export const VERDICTS = Object.freeze(['match', 'mismatch', 'not_checked']);
const PROPOSAL_MODES = new Set(['copilot', 'manual']);

// ---------------------------------------------------------------- pure helpers

export function toMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

/**
 * The caller and belief a trade row's own evaluationId carries (the three
 * callers that mint a structured id), or null for an evaluation id.
 */
export function beliefFromEvaluationId(evaluationId) {
  if (typeof evaluationId !== 'string') return null;
  let m = /^risk_(.+)_([^_]+)_(\d+)$/.exec(evaluationId);
  if (m) return { caller: 'risk', belief: m[2] };
  m = /^guardrail_(.+)_([^_]+)_(\d+)$/.exec(evaluationId);
  if (m) return { caller: 'suppression', belief: m[2] };
  m = /^gameplan_([^_]+)_([^_]+)_(\d+)$/.exec(evaluationId);
  if (m) return { caller: 'meeting', belief: m[1] };
  return null;
}

/**
 * The caller and belief behind one retained trade row:
 * `{ caller, belief, ambiguous }` — belief null when it cannot be joined
 * (never guessed). An evaluation id is NOT unique on every battle (battles
 * that passed 150 entries before `evalSeq`, Sep 21, repeat `eval_151`), so a
 * model or proposal row joins the entries that share its id AND its incoming
 * symbol AND decided SWAP or PROPOSAL; more than one such entry with
 * different beliefs → ambiguous (counted apart, never as a mismatch). The
 * caller comes from the joined entry's decision (PROPOSAL → proposal), not
 * the trade's entryMode, which a co-pilot battle's model swaps also carry
 * (review S4-2).
 */
export function beliefOfTrade(trade, battle) {
  const structured = beliefFromEvaluationId(trade?.evaluationId);
  if (structured) return { ...structured, ambiguous: false };
  const fallbackCaller = PROPOSAL_MODES.has(trade?.entryMode) ? 'proposal' : (typeof trade?.evaluationId === 'string' ? 'model' : 'unknown');
  if (typeof trade?.evaluationId !== 'string') return { caller: fallbackCaller, belief: null, ambiguous: false };
  const joined = (Array.isArray(battle?.evaluations) ? battle.evaluations : []).filter((e) => e?.evalId === trade.evaluationId
    && (e.decision === 'SWAP' || e.decision === 'PROPOSAL')
    && e.symbolIn === trade.symbolIn
    && typeof e.symbolOut === 'string' && e.symbolOut);
  const beliefs = [...new Set(joined.map((e) => e.symbolOut))];
  if (beliefs.length > 1) return { caller: fallbackCaller, belief: null, ambiguous: true };
  if (beliefs.length === 1) return { caller: joined[0].decision === 'PROPOSAL' ? 'proposal' : 'model', belief: beliefs[0], ambiguous: false };
  // A launch-guard clear never executed (integrity build, review I1-4): its row
  // carries a client-written proposal's ids and symbols, so it is no belief.
  // Integrity follow-up 2 (Q2): the guard's rows now resolve
  // 'launch_guard_cleared' (older rows keep 'auto_executed' with the note) —
  // either marker excludes the row.
  const proposals = (Array.isArray(battle?.proposalHistory) ? battle.proposalHistory : [])
    .filter((p) => p?.systemNote !== 'launch_guard_clear' && p?.resolution !== 'launch_guard_cleared')
    .filter((p) => (p?.evaluationMetadata?.evaluationId === trade.evaluationId || p?.evalId === trade.evaluationId)
      && p.symbolIn === trade.symbolIn && typeof p.symbolOut === 'string' && p.symbolOut);
  const proposalBeliefs = [...new Set(proposals.map((p) => p.symbolOut))];
  if (proposalBeliefs.length > 1) return { caller: 'proposal', belief: null, ambiguous: true };
  if (proposalBeliefs.length === 1) return { caller: 'proposal', belief: proposalBeliefs[0], ambiguous: false };
  return { caller: fallbackCaller, belief: null, ambiguous: false };
}

/**
 * Is this a verification the executor wrote? Its mode is shadow or enforce
 * and its id is the one the executor derives from the row's own evaluation id
 * (null when the row has none). Anything else — e.g. an object an owner
 * planted in a proposal's evaluationMetadata, which the executor spreads into
 * the row and does not replace at 'off' — is counted apart as invalid, never
 * as a verdict (review S3-3).
 */
export function isExecutorVerification(v, trade, battleId) {
  if (!v || typeof v !== 'object' || (v.mode !== 'shadow' && v.mode !== 'enforce')) return false;
  const evaluationId = trade?.evaluationId;
  const expectedId = typeof evaluationId === 'string' && evaluationId ? `${battleId}:${evaluationId}:verify` : null;
  return v.verificationId === expectedId;
}

const emptyCallerRow = () => ({
  trades: 0, beliefKnown: 0, beliefUnknown: 0, beliefAmbiguous: 0, mismatches: 0,
  verification: { present: 0, match: 0, mismatch: 0, not_checked: 0, other: 0, battle_not_active: 0, symbol_and_entry: 0, symbol_only: 0, invalid: 0 },
});

/** When a history row happened: its resolution, else its creation. */
const rowMs = (row) => toMs(row?.resolvedAt) ?? toMs(row?.createdAt);

/**
 * The census over a set of battles (`{ [battleId]: battleDoc }` or a Map).
 * Pure: no I/O, no clock.
 */
export function computeSwapIdentityCensus(battles, { sinceMs = null } = {}) {
  const entries = battles instanceof Map ? [...battles.entries()] : Object.entries(battles || {});
  const byCaller = Object.fromEntries(CALLERS.map((c) => [c, emptyCallerRow()]));
  const mismatches = [];
  const disagreements = [];
  const verificationMismatches = [];
  const battleNotActive = [];
  const windows = [];
  const invalidVerifications = [];
  const refusals = { entries: {}, proposalHistory: {}, meetingLegs: {}, feedBeats: {} };
  const honest = { proposalExecutionFailed: 0, autoExecutionFailed: 0 };
  // Integrity follow-up 2 (Part D; review K3-9): the retry-safe markers, per
  // channel — how often an executor throw was read back as landed
  // (`executionLanded`), could not be read (`executionOutcome: 'unknown'`),
  // or — on a meeting leg — confirmed as no trade (`executionFailed`) or not
  // attempted after an unreadable one (`executionOutcome: 'not_run'`); and the
  // meeting legs the server's copy held (Part A).
  const retrySafe = {
    outcomeUnknown: { entries: 0, feedBeats: 0, proposalHistory: 0, meetingLegs: 0 },
    landedAfterError: { entries: 0, feedBeats: 0, proposalHistory: 0, meetingLegs: 0 },
    autoExecutionUnknown: 0, meetingLegExecutionFailed: 0, meetingLegNotRun: 0, heldMeetingLegs: 0,
  };
  const markers = (record, channel) => {
    if (record?.executionOutcome === 'unknown') retrySafe.outcomeUnknown[channel] += 1;
    if (typeof record?.executionLanded === 'string') retrySafe.landedAfterError[channel] += 1;
  };
  const modesSeen = {};
  let tradeRows = 0;

  const inc = (obj, key) => { obj[key] = (obj[key] || 0) + 1; };
  const counted = (ms) => sinceMs == null || (ms != null && ms >= sinceMs);

  for (const [battleId, battle] of entries) {
    const trades = Array.isArray(battle?.trades) ? battle.trades : [];
    const times = trades.map((t) => toMs(t?.swappedOutAt)).filter((ms) => ms != null);
    const evals = Array.isArray(battle?.evaluations) ? battle.evaluations : [];
    const evalTimes = evals.map((e) => toMs(e?.timestamp)).filter((ms) => ms != null);
    const iso = (list, pick) => (list.length ? new Date(pick(...list)).toISOString() : null);
    if (trades.length || evals.length) {
      windows.push({
        battleId,
        rows: trades.length, from: iso(times, Math.min), to: iso(times, Math.max),
        evaluations: evals.length, evaluationsFrom: iso(evalTimes, Math.min),
      });
    }

    for (const trade of trades) {
      if (!counted(toMs(trade?.swappedOutAt))) continue;
      tradeRows += 1;
      const { caller, belief, ambiguous } = beliefOfTrade(trade, battle);
      const row = byCaller[caller] || byCaller.unknown;
      row.trades += 1;
      const committed = trade?.symbolOut ?? null;
      if (ambiguous) row.beliefAmbiguous += 1;
      else if (belief == null) row.beliefUnknown += 1;
      else {
        row.beliefKnown += 1;
        if (belief !== committed) {
          row.mismatches += 1;
          mismatches.push({ battleId, caller, evaluationId: trade.evaluationId ?? null, believed: belief, committed, swappedOutAt: trade.swappedOutAt ?? null });
        }
      }
      const v = trade?.verification;
      if (v != null && !isExecutorVerification(v, trade, battleId)) {
        row.verification.invalid += 1;
        invalidVerifications.push({ battleId, caller, evaluationId: trade.evaluationId ?? null, verificationId: v?.verificationId ?? null, mode: v?.mode ?? null });
      } else if (v) {
        row.verification.present += 1;
        // Enforce refuses a battle that is not exactly 'active' BEFORE it compares
        // the identity (refusalOf: battle_not_active outranks a mismatch), so such
        // a row is counted apart, whatever its verdict — never as a clean match.
        if (v.battleStatus !== 'active') {
          row.verification.battle_not_active += 1;
          battleNotActive.push({ battleId, caller, verificationId: v.verificationId ?? null, battleStatus: v.battleStatus ?? null, verdict: v.verdict ?? null });
        } else if (VERDICTS.includes(v.verdict)) row.verification[v.verdict] += 1; else row.verification.other += 1;
        if (v.basis === 'symbol_and_entry' || v.basis === 'symbol_only') row.verification[v.basis] += 1;
        inc(modesSeen, String(v.mode));
        if (v.verdict === 'mismatch' && v.battleStatus === 'active') verificationMismatches.push({ battleId, caller, verificationId: v.verificationId ?? null, expected: v.expected ?? null, found: v.found ?? null, basis: v.basis ?? null });
        // The executor's verdict must agree with the symbol comparison: a
        // symbol that differs can never be a `match` (a disagreement is a bug).
        if (belief != null && belief !== committed && v.verdict === 'match') {
          disagreements.push({ battleId, caller, verificationId: v.verificationId ?? null, believed: belief, committed, verdict: v.verdict });
        }
      }
    }

    for (const e of Array.isArray(battle?.evaluations) ? battle.evaluations : []) {
      if (e?.executionRefusal && counted(toMs(e.timestamp))) inc(refusals.entries, String(e.executionRefusal.reason));
      if (counted(toMs(e?.timestamp))) markers(e, 'entries');
    }
    for (const p of Array.isArray(battle?.proposalHistory) ? battle.proposalHistory : []) {
      if (!counted(rowMs(p))) continue;
      if (p?.executionRefusal) inc(refusals.proposalHistory, String(p.executionRefusal.reason));
      if (p?.executionFailed === true) honest.proposalExecutionFailed += 1;
      if (p?.resolution === 'auto_execution_failed') honest.autoExecutionFailed += 1;
      if (p?.resolution === 'auto_execution_unknown') retrySafe.autoExecutionUnknown += 1;
      markers(p, 'proposalHistory');
    }
    for (const m of Array.isArray(battle?.gameplanMeetingHistory) ? battle.gameplanMeetingHistory : []) {
      if (!counted(rowMs(m))) continue;
      for (const leg of Array.isArray(m?.legRefusals) ? m.legRefusals : []) inc(refusals.meetingLegs, `${leg?.reason}${leg?.verification ? '' : ' (departed)'}`);
      for (const leg of Array.isArray(m?.suggestedSwaps) ? m.suggestedSwaps : []) {
        if (leg?.executionFailed === true) retrySafe.meetingLegExecutionFailed += 1;
        if (leg?.executionOutcome === 'not_run') retrySafe.meetingLegNotRun += 1;
        markers(leg, 'meetingLegs');
      }
      if (typeof m?.heldLegCount === 'number' && m.heldLegCount > 0 && m.heldLegCount < Infinity) retrySafe.heldMeetingLegs += m.heldLegCount; // (no member call: the read-only allowlist)
    }
    for (const beat of Array.isArray(battle?.statusFeed) ? battle.statusFeed : []) {
      if (beat?.refusalReason && counted(toMs(beat.timestamp))) inc(refusals.feedBeats, `${beat.source}:${beat.refusalReason}`);
      if (counted(toMs(beat?.timestamp))) markers(beat, 'feedBeats');
    }
  }

  return { battles: entries.length, tradeRows, byCaller, mismatches, verificationMismatches, battleNotActive, disagreements, invalidVerifications, refusals, honest, retrySafe, modesSeen, windows, sinceMs };
}

/** The census as a Markdown report. */
export function renderCensus(result, { readAt = null } = {}) {
  const L = [];
  const p = (s = '') => L.push(s);
  // Cells are escaped: a value read off a battle can carry a pipe or a newline (review I1-9).
  const esc = (v) => String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const tbl = (head, rows) => { p(`| ${head.join(' | ')} |`); p(`|${head.map(() => '---').join('|')}|`); for (const r of rows) p(`| ${r.map(esc).join(' | ')} |`); };
  p('# Swap identity census (Pilot P6, G01)');
  p();
  p(`Read at: ${readAt ?? 'n/a'} · battles read: ${result.battles} · trade rows counted: ${result.tradeRows}${result.sinceMs != null ? ` · since ${new Date(result.sinceMs).toISOString()}` : ' · every retained row'}`);
  p();
  p('## 1. Believed vs committed outgoing symbol (any mode)');
  p();
  tbl(['Caller', 'Trades', 'Belief joined', 'Belief unknown', 'Belief ambiguous', 'Believed ≠ committed'],
    CALLERS.map((c) => { const r = result.byCaller[c]; return [c, String(r.trades), String(r.beliefKnown), String(r.beliefUnknown), String(r.beliefAmbiguous), String(r.mismatches)]; }));
  p();
  p('*Belief unknown*: the row\'s evaluation (or proposal) has aged out of the battle\'s retained entries, so its belief cannot be read — never counted as a match. *Belief ambiguous*: more than one retained entry shares the row\'s evaluation id and incoming symbol with different beliefs (battles older than the Sep 21 evaluation counter repeat ids) — never counted as a mismatch.');
  p();
  if (result.mismatches.length) {
    tbl(['Battle', 'Caller', 'evaluationId', 'Believed', 'Committed', 'swappedOutAt'],
      result.mismatches.map((m) => [m.battleId, m.caller, String(m.evaluationId), m.believed, String(m.committed), String(m.swappedOutAt)]));
    p();
  } else {
    p('No retained row committed a different outgoing symbol than its caller believed.');
    p();
  }
  p('## 2. `trades[].verification` (shadow / enforce)');
  p();
  tbl(['Caller', 'Rows with verification', 'match', 'mismatch', 'not_checked', 'enforce would refuse: battle_not_active', 'symbol_and_entry', 'symbol_only', 'invalid (not the executor\'s)'],
    CALLERS.map((c) => { const v = result.byCaller[c].verification; return [c, String(v.present), String(v.match), String(v.mismatch), String(v.not_checked), String(v.battle_not_active), String(v.symbol_and_entry), String(v.symbol_only), String(v.invalid)]; }));
  p();
  p('*match / mismatch / not_checked* count verifications on a battle whose `battleStatus` was exactly `active`. Any other status — a missing one included — is counted under *battle_not_active*, whatever its verdict: at enforce the executor refuses such a swap before it compares the identity, so a matching identity on an ended battle is not a clean match.');
  p();
  if (result.battleNotActive.length) {
    tbl(['Battle', 'Caller', 'verificationId', 'battleStatus', 'Verdict (not counted)'],
      result.battleNotActive.map((x) => [x.battleId, x.caller, String(x.verificationId), String(x.battleStatus), String(x.verdict)]));
    p();
  }
  if (result.invalidVerifications.length) {
    p('Rows carrying a `verification` the executor did not write (wrong mode or id — e.g. planted through a client-written proposal). Excluded from every count above:');
    p();
    tbl(['Battle', 'Caller', 'evaluationId', 'verificationId', 'mode'],
      result.invalidVerifications.map((x) => [x.battleId, x.caller, String(x.evaluationId), String(x.verificationId), String(x.mode)]));
    p();
  }
  p(`Modes seen on rows: ${Object.keys(result.modesSeen).length ? Object.entries(result.modesSeen).map(([k, n]) => `${k} ${n}`).join(', ') : 'none (SWAP_IDENTITY_MODE off for every retained row)'}`);
  p();
  p(`Verdict disagrees with the symbol comparison (must be 0): **${result.disagreements.length}**`);
  p();
  if (result.verificationMismatches.length) {
    tbl(['Battle', 'Caller', 'verificationId', 'Expected', 'Found', 'Basis'],
      result.verificationMismatches.map((m) => [m.battleId, m.caller, String(m.verificationId), JSON.stringify(m.expected), JSON.stringify(m.found), String(m.basis)]));
    p();
  }
  p('## 3. Refusals recorded (enforce) and the honest-record markers');
  p();
  const kv = (obj) => (Object.keys(obj).length ? Object.entries(obj).map(([k, n]) => `${k} ${n}`).join(', ') : 'none');
  tbl(['Channel', 'Count by reason'], [
    ['evaluation `executionRefusal`', kv(result.refusals.entries)],
    ['proposal history `executionRefusal`', kv(result.refusals.proposalHistory)],
    ['meeting history `legRefusals`', kv(result.refusals.meetingLegs)],
    ['feed beats `refusalReason`', kv(result.refusals.feedBeats)],
    ['proposal history `executionFailed`', String(result.honest.proposalExecutionFailed)],
    ["proposal history `resolution: 'auto_execution_failed'`", String(result.honest.autoExecutionFailed)],
  ]);
  p();
  p('### 3b. Retry-safe records (integrity follow-up 2, Part D) and held meeting legs (Part A)');
  p();
  p('An executor call that threw is read back before anything is recorded: `executionLanded` marks a trade that landed but whose incoming position was already gone; `executionOutcome: \'unknown\'` marks a read-back that failed (no line either way); a meeting leg `executionFailed` is a confirmed no-trade, and `executionOutcome: \'not_run\'` a leg not attempted because the book could not be read after an earlier leg of unknown outcome. Watch these through the shadow period: each is an executor throw the enforce flip will meet.');
  p();
  const ch = (o) => `evaluations ${o.entries}, feed beats ${o.feedBeats}, proposal history ${o.proposalHistory}, meeting legs ${o.meetingLegs}`;
  tbl(['Marker', 'Count'], [
    ["`executionOutcome: 'unknown'`", ch(result.retrySafe.outcomeUnknown)],
    ['`executionLanded`', ch(result.retrySafe.landedAfterError)],
    ["proposal history `resolution: 'auto_execution_unknown'`", String(result.retrySafe.autoExecutionUnknown)],
    ['meeting legs `executionFailed`', String(result.retrySafe.meetingLegExecutionFailed)],
    ["meeting legs `executionOutcome: 'not_run'`", String(result.retrySafe.meetingLegNotRun)],
    ['meeting legs held (`heldLegCount`)', String(result.retrySafe.heldMeetingLegs)],
  ]);
  p();
  p('## 4. Retained windows');
  p();
  p('Every count above covers what the battle documents still hold: `trades[]` keeps the last 50 rows, `evaluations[]` the last 150 entries, `proposalHistory[]` the last 50 rows, and the feed the last 100 beats; `gameplanMeetingHistory[]` is not capped. A trade older than its battle\'s oldest retained evaluation reads *belief unknown*.');
  p();
  tbl(['Battle', 'Trade rows', 'Trades from', 'Trades to', 'Evaluations', 'Evaluations from'],
    result.windows.map((w) => [w.battleId, String(w.rows), String(w.from), String(w.to), String(w.evaluations), String(w.evaluationsFrom)]));
  return L.join('\n');
}

// ---------------------------------------------------------------- the read

/**
 * Read every battle in scope through a READ-ONLY reader and compute the
 * census. `reader` is `{ listBattles(): [{id, status, expiresAt}], readBattles(ids): Map }`.
 */
export async function runCensus(reader, { sinceMs = null } = {}) {
  const index = await reader.listBattles();
  const ids = index.filter((b) => sinceMs == null || b.status === 'active' || toMs(b.expiresAt) == null || toMs(b.expiresAt) >= sinceMs).map((b) => b.id);
  const battles = await reader.readBattles(ids);
  return computeSwapIdentityCensus(battles, { sinceMs });
}

/** The Firestore reader main() uses — reads only. */
export function firestoreReader(db) {
  return {
    async listBattles() {
      const snap = await db.collection('agentBattles').select('status', 'expiresAt').get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async readBattles(ids) {
      const pairs = [];
      for (let i = 0; i < ids.length; i += 50) {
        const refs = ids.slice(i, i + 50).map((id) => db.collection('agentBattles').doc(id));
        for (const snap of await db.getAll(...refs)) if (snap.exists) pairs.push([snap.id, snap.data()]);
      }
      return new Map(pairs);
    },
  };
}

export function parseArgs(argv) {
  const argOf = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  // `--since=<ISO>` or `--since <ISO>` — never silently ignored (review S4-6).
  const inline = argv.find((a) => a.startsWith('--since='));
  const sinceText = inline ? inline.slice('--since='.length) : (argv.includes('--since') ? argOf('--since') : null);
  if ((inline || argv.includes('--since')) && !sinceText) throw new Error('--since needs an ISO instant');
  const sinceMs = sinceText != null ? Date.parse(sinceText) : null;
  if (sinceText != null && !Number.isFinite(sinceMs)) throw new Error(`--since needs an ISO instant, got "${sinceText}"`);
  return { outPath: argOf('--out'), jsonPath: argOf('--json'), sinceMs };
}

async function main() {
  const { outPath, jsonPath, sinceMs } = parseArgs(process.argv.slice(2));
  await import('./loadLocalEnv.js');
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  const readAt = new Date().toISOString();
  const result = await runCensus(firestoreReader(getFirebaseAdmin()), { sinceMs });
  const md = renderCensus(result, { readAt });
  if (outPath) writeFileSync(outPath, md + '\n');
  else console.log(md);
  if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ readAt, ...result }, null, 2));
  console.error(`[census-swap-identity] battles=${result.battles} rows=${result.tradeRows} believed≠committed=${result.mismatches.length} verification-mismatch=${result.verificationMismatches.length} disagreements=${result.disagreements.length}`);
  if (result.disagreements.length) process.exitCode = 2;
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) main().catch((err) => { console.error(err); process.exit(1); });
