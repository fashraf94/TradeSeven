// scripts/census-setup-evidence-sweep.mjs
//
// The chart's evidence, PR B — THE DAY-AFTER CHECK (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md §5.7):
// what the daily sweep left for one trading session, run the morning after its first full trading day.
// It prints:
//   - how many of the 228 ranked stocks have a record for the session;
//   - the split of verdicts: valid by pattern, invalid by reason, unknown by what is missing, refused
//     by reason;
//   - the provider requests the sweep counted (its state document);
//   - how long the sweep took (its runs, and first run → the run that found every name final).
//
// READ-ONLY BY CONSTRUCTION. runSweepCensus receives a RESTRICTED READER (one field-masked getAll and
// one field-masked get), never the database handle: the handle exists only inside main(), which wraps
// it. The static imports are the store's pure key and session modules, the rule set, the ranked list
// and the sweep's constants — never the store's index, acquire or store modules, the sweep or its
// state. census-setup-evidence-sweep.test.js pins the imports, the reader's members, and a write-verb
// grep over this file.
//
// AGGREGATES ONLY. Text and JSON carry counts, closed-list labels, the session date and instants:
// no symbol, no price, no document id. A label read from a record is printed only when it is on its
// list; anything else as `other`. A failed read is counted as failed, never as absent.
//
// CREDENTIALS — env only, loaded LAZILY inside main(): scripts/loadLocalEnv.js (.env.local →
// process.env) and api/_utils/firebaseAdmin.js. The founder runs it; a build session never runs it
// against production.
//
// USAGE (repo root):
//   node scripts/census-setup-evidence-sweep.mjs [--session YYYY-MM-DD] [--json out.json]

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { snapshotIdOf } from '../api/_utils/setupEvidence/key.js';
import { lastCompletedSessionAt } from '../api/_utils/setupEvidence/sessionAt.js';
import { describeRuleSet } from '../api/_utils/setupEvaluator/thresholds.js';
import { ALL_TICKERS } from '../api/_utils/rankingConfig.js';
import { RETRYABLE_REASONS, STATE_COLLECTION, STATE_SCHEMA_VERSION, STORE_SNAPSHOT_SCHEMA_VERSION } from '../api/_utils/setupEvidenceSweep/constants.js';

const RECORD_FIELDS = Object.freeze(['schemaVersion', 'key.session', 'key.symbol', 'status', 'capturedAt', 'entry.verdict', 'entry.reason', 'entry.pattern', 'entry.missing']);
const STATE_FIELDS_READ = Object.freeze(['schemaVersion', 'session', 'providerRequests', 'runs', 'firstRunAt', 'lastRunAt', 'completedAt', 'runMs', 'latest']);
const FACTS = Object.freeze(['C', 'SMA_fast', 'SMA_slow', 'SMA_slow_5ago', 'swingHigh', 'swingLow', 'ATR', 'V', 'V_avg']);
const PATTERNS = Object.freeze(['breakout', 'pullback_resume']);
const INVALID_REASONS = Object.freeze(['regime', 'extended', 'no_setup']);
const UNKNOWN_REASONS = Object.freeze(['missing_fact', 'insufficient_history', 'missing_bar', 'unordered_bars', 'basis_discontinuity', 'calendar_missing', 'asOf_in_future', 'asOf_not_a_session', 'unsupported_symbol_class']);
const SESSION_RE = /^\d{4}-\d{2}-\d{2}$/;
const BATCH = 100;

const bump = (obj, key, n = 1) => { obj[key] = (obj[key] || 0) + n; };
const onList = (v, list) => (list.includes(v) ? v : 'other');
const isoOrNull = (v) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : null);
const countOrNull = (v) => (Number.isInteger(v) && v >= 0 ? v : null);

export const errorClassOf = (err) => {
  const name = /^[A-Z][A-Za-z]{0,30}$/.test(String(err?.name)) ? err.name : 'Error';
  const raw = err?.code === undefined || err?.code === null ? 'none' : String(err.code);
  return `${name}/${/^(\d{1,3}|[a-z][a-z-]{0,29}|none)$/.test(raw) ? raw : 'other'}`;
};

/** THE RESTRICTED READER: the only Firestore surface the census sees. Two field-masked reads; nothing else. */
export function restrictedReader(db) {
  const snapOf = (s) => ({ exists: s.exists, data: s.exists ? s.data() : null });
  return Object.freeze({
    get: async (path, fields) => snapOf((await db.getAll(db.doc(path), { fieldMask: [...fields] }))[0]),
    getAll: async (paths, fields) => (paths.length ? (await db.getAll(...paths.map((p) => db.doc(p)), { fieldMask: [...fields] })).map(snapOf) : []),
  });
}

function emptyResult(session, at) {
  return {
    session,
    at,
    universe: 0,
    records: { found: 0, absent: 0, readFailed: 0, unreadable: 0, measured: 0, refused: 0 },
    verdicts: {
      valid: { total: 0, byPattern: {} },
      invalid: { total: 0, byReason: {} },
      unknown: { total: 0, byReason: {}, byMissingFact: {} },
      refused: { total: 0, byReason: {} },
    },
    captured: { first: null, last: null },
    sweep: { state: 'absent', providerRequests: null, runs: null, firstRunAt: null, lastRunAt: null, completedAt: null, minutesFirstRunToComplete: null, runSeconds: null, latest: null },
    errors: {},
  };
}

/**
 * The census for one session. Reads: the session's state document (one get), and one record per ranked
 * stock (getAll in batches of 100), every read field-masked.
 * @param {ReturnType<typeof restrictedReader>} reader
 * @param {{ session?: string, nowMs?: number, symbols?: string[] }} [opts]
 */
export async function runSweepCensus(reader, { session, nowMs = Date.now(), symbols = ALL_TICKERS } = {}) {
  let s = session;
  if (s === undefined) {
    const cal = lastCompletedSessionAt(nowMs);
    if (!cal.ok) throw new Error('census: the calendar cannot name the last completed session; pass --session');
    s = cal.session;
  }
  if (!SESSION_RE.test(s)) throw new Error('census: --session must be YYYY-MM-DD');
  const R = emptyResult(s, new Date(nowMs).toISOString());
  const ruleSet = describeRuleSet();
  const order = [...new Set(symbols)].sort();
  R.universe = order.length;

  // The sweep's state document.
  try {
    const st = await reader.get(`${STATE_COLLECTION}/${s}`, STATE_FIELDS_READ);
    if (st.exists) {
      const d = st.data ?? {};
      const ok = d.schemaVersion === STATE_SCHEMA_VERSION && d.session === s;
      R.sweep.state = ok ? 'read' : 'unreadable';
      if (ok) {
        R.sweep.providerRequests = countOrNull(d.providerRequests);
        R.sweep.runs = countOrNull(d.runs);
        R.sweep.firstRunAt = isoOrNull(d.firstRunAt);
        R.sweep.lastRunAt = isoOrNull(d.lastRunAt);
        R.sweep.completedAt = isoOrNull(d.completedAt);
        R.sweep.runSeconds = countOrNull(d.runMs) === null ? null : Math.round(d.runMs / 1000);
        if (R.sweep.firstRunAt && R.sweep.completedAt) R.sweep.minutesFirstRunToComplete = Math.round((Date.parse(R.sweep.completedAt) - Date.parse(R.sweep.firstRunAt)) / 60_000);
        const l = d.latest && typeof d.latest === 'object' ? d.latest : null;
        R.sweep.latest = l ? {
          startedAt: isoOrNull(l.startedAt),
          names: countOrNull(l.names),
          final: { measured: countOrNull(l.final?.measured), refused: countOrNull(l.final?.refused) },
          pending: countOrNull(l.pending),
          retryable: Object.fromEntries(Object.entries(l.retryable && typeof l.retryable === 'object' ? l.retryable : {}).map(([k, n]) => [onList(k, RETRYABLE_REASONS), countOrNull(n)])),
        } : null;
      }
    }
  } catch (err) {
    R.sweep.state = 'read_failed';
    bump(R.errors, errorClassOf(err));
  }

  // One record per ranked stock, by its id: a batch whose read fails is counted as failed, never as absent.
  const keyed = order.map((symbol) => ({ symbol, path: `setupEvidence/${snapshotIdOf({ session: s, symbol, ruleSet })}` }));
  for (let i = 0; i < keyed.length; i += BATCH) {
    const batch = keyed.slice(i, i + BATCH);
    let snaps;
    try {
      snaps = await reader.getAll(batch.map((k) => k.path), RECORD_FIELDS);
    } catch (err) {
      R.records.readFailed += batch.length;
      bump(R.errors, errorClassOf(err));
      continue;
    }
    batch.forEach((k, j) => tally(R, k, snaps[j], s));
  }
  return R;
}

function tally(R, k, snap, session) {
  if (!snap || !snap.exists) { R.records.absent += 1; return; }
  const d = snap.data ?? {};
  if (d.schemaVersion !== STORE_SNAPSHOT_SCHEMA_VERSION || d.key?.session !== session || d.key?.symbol !== k.symbol || (d.status !== 'ok' && d.status !== 'refused')) {
    R.records.unreadable += 1;
    return;
  }
  R.records.found += 1;
  const at = isoOrNull(d.capturedAt);
  if (at) {
    if (!R.captured.first || at < R.captured.first) R.captured.first = at;
    if (!R.captured.last || at > R.captured.last) R.captured.last = at;
  }
  const e = d.entry ?? {};
  if (d.status === 'refused') {
    R.records.refused += 1;
    R.verdicts.refused.total += 1;
    bump(R.verdicts.refused.byReason, onList(e.reason, UNKNOWN_REASONS));
    return;
  }
  R.records.measured += 1;
  if (e.verdict === 'valid') {
    R.verdicts.valid.total += 1;
    bump(R.verdicts.valid.byPattern, onList(e.pattern, PATTERNS));
  } else if (e.verdict === 'invalid') {
    R.verdicts.invalid.total += 1;
    bump(R.verdicts.invalid.byReason, onList(e.reason, INVALID_REASONS));
  } else {
    R.verdicts.unknown.total += 1;
    bump(R.verdicts.unknown.byReason, onList(e.reason, UNKNOWN_REASONS));
    for (const fact of Array.isArray(e.missing) ? e.missing : []) bump(R.verdicts.unknown.byMissingFact, onList(fact, FACTS));
  }
}

const fmt = (obj) => (Object.keys(obj).length ? Object.entries(obj).sort().map(([k, n]) => `${k} ${n}`).join(', ') : 'none');

/** The plain-text report. Aggregates only. */
export function renderText(R) {
  const v = R.verdicts;
  return [
    `Setup-evidence sweep census — session ${R.session} (read ${R.at})`,
    `Records: ${R.records.found} of ${R.universe} ranked stocks (measured ${R.records.measured}, refused ${R.records.refused}); absent ${R.records.absent}; unreadable ${R.records.unreadable}; read failed ${R.records.readFailed}`,
    `  valid ${v.valid.total} by pattern: ${fmt(v.valid.byPattern)}`,
    `  invalid ${v.invalid.total} by reason: ${fmt(v.invalid.byReason)}`,
    `  unknown ${v.unknown.total} by reason: ${fmt(v.unknown.byReason)}; missing facts: ${fmt(v.unknown.byMissingFact)}`,
    `  refused ${v.refused.total} by reason: ${fmt(v.refused.byReason)}`,
    `  captured: first ${R.captured.first ?? 'none'}, last ${R.captured.last ?? 'none'}`,
    `Sweep state: ${R.sweep.state}; provider requests counted ${R.sweep.providerRequests ?? 'none'} (cap 400); runs ${R.sweep.runs ?? 'none'}; run time ${R.sweep.runSeconds ?? 'none'} s`,
    `  first run ${R.sweep.firstRunAt ?? 'none'}; every name final ${R.sweep.completedAt ?? 'not yet'}${R.sweep.minutesFirstRunToComplete === null ? '' : ` (${R.sweep.minutesFirstRunToComplete} min after the first run)`}`,
    `  latest run ${R.sweep.latest?.startedAt ?? 'none'}: names ${R.sweep.latest?.names ?? 'none'}, pending ${R.sweep.latest?.pending ?? 'none'}, retryable ${R.sweep.latest ? fmt(R.sweep.latest.retryable) : 'none'}`,
    `Errors: ${fmt(R.errors)}`,
  ].join('\n');
}

export function parseArgs(argv) {
  const out = { session: undefined, jsonPath: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--session') out.session = argv[++i];
    else if (argv[i] === '--json') out.jsonPath = argv[++i];
    else throw new Error('census: unknown argument (use --session YYYY-MM-DD, --json <file>)');
  }
  return out;
}

export const fatalLine = (err) => `census failed: ${errorClassOf(err)}`;

/** Every output channel goes through here. */
export async function censusMain({ argv, reader, writeFile = writeFileSync, log = console.log, nowMs }) {
  const args = parseArgs(argv);
  const R = await runSweepCensus(reader, { session: args.session, ...(nowMs === undefined ? {} : { nowMs }) });
  if (args.jsonPath) writeFile(args.jsonPath, `${JSON.stringify(R, null, 2)}\n`);
  log(renderText(R));
  return R;
}

async function main() {
  await import('./loadLocalEnv.js');
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  await censusMain({ argv: process.argv.slice(2), reader: restrictedReader(getFirebaseAdmin()) });
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) main().catch((err) => { console.error(fatalLine(err)); process.exit(1); });
