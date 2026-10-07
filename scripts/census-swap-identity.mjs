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
//        model       `evaluations[].symbolOut` where evalId = trades[].evaluationId
//        proposal    the same join (entryMode copilot/manual), else
//                    `proposalHistory[].symbolOut` by its evaluationMetadata.evaluationId
//      A row whose belief cannot be joined (an evaluation that aged out of the
//      150-entry cap) is counted as `unknown`, never as a match.
//   2. THE SHADOW READ (once SWAP_IDENTITY_MODE ≠ 'off'): every
//      `trades[].verification` the executor wrote, by caller × verdict × basis;
//      a cross-check that the executor's verdict agrees with the symbol
//      comparison above; and the refusals the callers recorded at 'enforce'
//      (evaluation `executionRefusal`, proposal / meeting history rows, feed
//      beats), plus the honest-record markers (`executionFailed`,
//      `auto_execution_failed`).
//
// RETENTION: `trades[]` keeps the last 50 rows per battle and `evaluations[]`
// the last 150, so the census covers a retained window, not all history — the
// report prints each window. Run it at least weekly during the shadow period.
//
// READ-ONLY BY CONSTRUCTION. The Firestore calls in this file are `.select()`,
// `.get()` and `getAll()` reads only. There is no `set`, `update`, `delete`,
// `create`, `runTransaction`, `batch` or `bulkWriter` call — grep it before
// running it (scripts/census-swap-identity.test.js does). The only files it
// writes are the local report named by --out and the JSON named by --json.
//
// CREDENTIALS — the existing loaders only, loaded LAZILY inside main() so that
// importing this module (the test does) reads no environment and touches no
// SDK: scripts/loadLocalEnv.js (.env.local → process.env) +
// api/_utils/firebaseAdmin.js getFirebaseAdmin(). The founder runs it; a build
// session never runs it against production.
//
// USAGE (repo root):
//   node scripts/census-swap-identity.mjs [--since=<ISO>] [--out <report.md>] [--json <data.json>]
//     --since=<ISO>  count only trades committed at/after this instant (e.g. the
//                    shadow flip's production deploy); battles that expired
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
 * The caller and belief behind one retained trade row: `{ caller, belief }`,
 * belief null when it cannot be joined (never guessed).
 */
export function beliefOfTrade(trade, battle) {
  const structured = beliefFromEvaluationId(trade?.evaluationId);
  if (structured) return structured;
  const caller = PROPOSAL_MODES.has(trade?.entryMode) ? 'proposal' : (typeof trade?.evaluationId === 'string' ? 'model' : 'unknown');
  if (typeof trade?.evaluationId !== 'string') return { caller, belief: null };
  const entry = (Array.isArray(battle?.evaluations) ? battle.evaluations : []).find((e) => e?.evalId === trade.evaluationId);
  if (entry && typeof entry.symbolOut === 'string' && entry.symbolOut) return { caller, belief: entry.symbolOut };
  const proposal = (Array.isArray(battle?.proposalHistory) ? battle.proposalHistory : [])
    .find((p) => p?.evaluationMetadata?.evaluationId === trade.evaluationId || p?.evalId === trade.evaluationId);
  if (proposal && typeof proposal.symbolOut === 'string' && proposal.symbolOut) return { caller: 'proposal', belief: proposal.symbolOut };
  return { caller, belief: null };
}

const emptyCallerRow = () => ({
  trades: 0, beliefKnown: 0, beliefUnknown: 0, mismatches: 0,
  verification: { present: 0, match: 0, mismatch: 0, not_checked: 0, other: 0, symbol_and_entry: 0, symbol_only: 0 },
});

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
  const windows = [];
  const refusals = { entries: {}, proposalHistory: {}, meetingLegs: {}, feedBeats: {} };
  const honest = { proposalExecutionFailed: 0, autoExecutionFailed: 0 };
  const modesSeen = {};
  let tradeRows = 0;

  const inc = (obj, key) => { obj[key] = (obj[key] || 0) + 1; };
  const counted = (ms) => sinceMs == null || (ms != null && ms >= sinceMs);

  for (const [battleId, battle] of entries) {
    const trades = Array.isArray(battle?.trades) ? battle.trades : [];
    const times = trades.map((t) => toMs(t?.swappedOutAt)).filter((ms) => ms != null);
    if (trades.length) windows.push({ battleId, rows: trades.length, from: times.length ? new Date(Math.min(...times)).toISOString() : null, to: times.length ? new Date(Math.max(...times)).toISOString() : null });

    for (const trade of trades) {
      if (!counted(toMs(trade?.swappedOutAt))) continue;
      tradeRows += 1;
      const { caller, belief } = beliefOfTrade(trade, battle);
      const row = byCaller[caller] || byCaller.unknown;
      row.trades += 1;
      const committed = trade?.symbolOut ?? null;
      if (belief == null) row.beliefUnknown += 1;
      else {
        row.beliefKnown += 1;
        if (belief !== committed) {
          row.mismatches += 1;
          mismatches.push({ battleId, caller, evaluationId: trade.evaluationId ?? null, believed: belief, committed, swappedOutAt: trade.swappedOutAt ?? null });
        }
      }
      const v = trade?.verification;
      if (v && typeof v === 'object') {
        row.verification.present += 1;
        if (VERDICTS.includes(v.verdict)) row.verification[v.verdict] += 1; else row.verification.other += 1;
        if (v.basis === 'symbol_and_entry' || v.basis === 'symbol_only') row.verification[v.basis] += 1;
        inc(modesSeen, String(v.mode));
        if (v.verdict === 'mismatch') verificationMismatches.push({ battleId, caller, verificationId: v.verificationId ?? null, expected: v.expected ?? null, found: v.found ?? null, basis: v.basis ?? null });
        // The executor's verdict must agree with the symbol comparison: a
        // symbol that differs can never be a `match` (a disagreement is a bug).
        if (belief != null && belief !== committed && v.verdict === 'match') {
          disagreements.push({ battleId, caller, verificationId: v.verificationId ?? null, believed: belief, committed, verdict: v.verdict });
        }
      }
    }

    for (const e of Array.isArray(battle?.evaluations) ? battle.evaluations : []) {
      if (e?.executionRefusal && counted(toMs(e.timestamp))) inc(refusals.entries, String(e.executionRefusal.reason));
    }
    for (const p of Array.isArray(battle?.proposalHistory) ? battle.proposalHistory : []) {
      if (p?.executionRefusal) inc(refusals.proposalHistory, String(p.executionRefusal.reason));
      if (p?.executionFailed === true) honest.proposalExecutionFailed += 1;
      if (p?.resolution === 'auto_execution_failed') honest.autoExecutionFailed += 1;
    }
    for (const m of Array.isArray(battle?.gameplanMeetingHistory) ? battle.gameplanMeetingHistory : []) {
      for (const leg of Array.isArray(m?.legRefusals) ? m.legRefusals : []) inc(refusals.meetingLegs, `${leg?.reason}${leg?.verification ? '' : ' (departed)'}`);
    }
    for (const beat of Array.isArray(battle?.statusFeed) ? battle.statusFeed : []) {
      if (beat?.refusalReason && counted(toMs(beat.timestamp))) inc(refusals.feedBeats, `${beat.source}:${beat.refusalReason}`);
    }
  }

  return { battles: entries.length, tradeRows, byCaller, mismatches, verificationMismatches, disagreements, refusals, honest, modesSeen, windows, sinceMs };
}

/** The census as a Markdown report. */
export function renderCensus(result, { readAt = null } = {}) {
  const L = [];
  const p = (s = '') => L.push(s);
  const tbl = (head, rows) => { p(`| ${head.join(' | ')} |`); p(`|${head.map(() => '---').join('|')}|`); for (const r of rows) p(`| ${r.join(' | ')} |`); };
  p('# Swap identity census (Pilot P6, G01)');
  p();
  p(`Read at: ${readAt ?? 'n/a'} · battles read: ${result.battles} · trade rows counted: ${result.tradeRows}${result.sinceMs != null ? ` · since ${new Date(result.sinceMs).toISOString()}` : ' · every retained row'}`);
  p();
  p('## 1. Believed vs committed outgoing symbol (any mode)');
  p();
  tbl(['Caller', 'Trades', 'Belief joined', 'Belief unknown', 'Believed ≠ committed'],
    CALLERS.map((c) => { const r = result.byCaller[c]; return [c, String(r.trades), String(r.beliefKnown), String(r.beliefUnknown), String(r.mismatches)]; }));
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
  tbl(['Caller', 'Rows with verification', 'match', 'mismatch', 'not_checked', 'symbol_and_entry', 'symbol_only'],
    CALLERS.map((c) => { const v = result.byCaller[c].verification; return [c, String(v.present), String(v.match), String(v.mismatch), String(v.not_checked), String(v.symbol_and_entry), String(v.symbol_only)]; }));
  p();
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
  p('## 4. Retained windows (trades[] keeps the last 50 rows per battle)');
  p();
  tbl(['Battle', 'Rows', 'From', 'To'], result.windows.map((w) => [w.battleId, String(w.rows), String(w.from), String(w.to)]));
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
  const sinceArg = argv.find((a) => a.startsWith('--since='));
  const sinceMs = sinceArg ? Date.parse(sinceArg.slice('--since='.length)) : null;
  if (sinceArg && !Number.isFinite(sinceMs)) throw new Error(`--since needs an ISO instant, got "${sinceArg}"`);
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
