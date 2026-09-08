#!/usr/bin/env node
// api/scripts/gemma-latency-report.js
//
// THE p50/p95 READER (voice-layer grounding spec §12 — "the p50/p95 reader
// script (before gate 1)"; Sol pass one F9 / C-9: shadow old-prompt latency is
// not the new prompt's latency, and the live figure was never aggregated).
//
// Reads the `shadow/conversations/` stream for a date range and reports the
// distribution of `gemmaLatencyMs` — the FIRST voice call's wall-clock, stamped
// on every conversation record whether the turn succeeded, timed out or threw
// (api/agent/chat.js:556-573) — plus the timeout count, per UTC day and overall.
//
// This is the SHIPPED-prompt reader. It answers "what is the voice turn's
// latency today", which is the baseline gate 1's paired harness
// (voice-grounding-harness.js) measures the NEW prompt against. It never sends
// a prompt and never calls a model.
//
// Two distributions are reported side by side, deliberately: `all` (every
// record carrying a latency) and `ok` (the records that did not error). A
// timed-out turn's latency is the abort budget, not the model's response time —
// mixing them hides both numbers. gemmaClient.js:96 states the same intent for
// its per-attempt log line ("so a successful p95 can be separated from a
// timed-out one").
//
// Usage:
//   node --env-file=.env.local api/scripts/gemma-latency-report.js [options]
//
//   --days N               the last N UTC days, inclusive of today (default 7)
//   --from YYYY-MM-DD      range start (UTC date key), inclusive
//   --to   YYYY-MM-DD      range end   (UTC date key), inclusive; defaults to today
//   --json                 emit the machine-readable summary instead of the table
//
//   --from/--to and --days are mutually exclusive.
//
// Requires env:
//   GCS_CREDENTIALS (JSON-stringified service account, same as shadowLogger.js)
//
// Exit codes: 0 on a completed read; 1 on a usage error or missing credentials.
//
// The list-and-download plumbing follows sample-voice-layer-terms.js. The
// percentile math is NOT re-implemented here: `quantile` is imported from the
// measurement harness (BUILD_RULES §4 — never a local copy of shared math);
// `latencyPercentiles` and the summarizers below are pure and unit-tested in
// gemma-latency-report.test.js.

import { Storage } from '@google-cloud/storage';
import { pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';
// The one quantile implementation in the tree (linear interpolation, pure,
// null on an empty sample). Imported, never copied.
import { quantile } from '../_utils/learning/measureCorpus.js';

export const BUCKET_NAME = 'fantasytrades';
export const PROJECT_ID = 'macro-nuance-474602-f5';
/** The stream shadowLogger.js's `logConversation` writes to. */
export const STREAM = 'conversations';
/** chat.js's catch block files this on an AbortError turn (`isAbort`). */
export const TIMEOUT_ERROR_REASON = 'gemma_timeout';
export const DEFAULT_DAYS = 7;

// ==================== PURE — dates ====================

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The UTC date key shadowLogger.js files a record under. */
export function utcDateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/** True for a well-formed, real UTC date key (`2026-02-30` is not one). */
export function isDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms) && utcDateKey(ms) === value;
}

/**
 * `daysAgo` days before `now`, as a UTC date key.
 *
 * EPOCH arithmetic over the UTC day key, not `Date` mutation. `setUTCDate`
 * would be correct too — but `setDate`/`getDate` is one keystroke away and
 * behaves IDENTICALLY on a UTC machine, so a local-time slip is invisible to
 * every test a UTC CI runner can run, and shows up only as a silent off-by-one
 * DAY on a founder's laptop across a DST boundary. Removing the mutable-Date
 * step removes the mutation class rather than trying to guard it, and it is the
 * same `+= 86_400_000` walk `dateKeysInRange` already uses (BUILD_RULES §9 —
 * one way to move a day, not two).
 */
export function dateKeyForOffset(daysAgo, now = new Date()) {
  const startOfDayUtc = Date.parse(`${utcDateKey(now)}T00:00:00.000Z`);
  return utcDateKey(startOfDayUtc - daysAgo * 86_400_000);
}

/** Every UTC date key from `fromKey` to `toKey` inclusive, ascending. Empty when reversed. */
export function dateKeysInRange(fromKey, toKey) {
  if (!isDateKey(fromKey) || !isDateKey(toKey)) return [];
  const keys = [];
  let cursor = Date.parse(`${fromKey}T00:00:00.000Z`);
  const end = Date.parse(`${toKey}T00:00:00.000Z`);
  while (cursor <= end) {
    keys.push(utcDateKey(cursor));
    cursor += 86_400_000;
  }
  return keys;
}

/**
 * Parse argv (the flags only — argv[0]/argv[1] are the caller's to strip).
 * Throws an Error whose message is the usage complaint; the CLI prints it.
 */
export function parseArgs(argv, now = new Date()) {
  const opts = { days: null, from: null, to: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') { opts.json = true; continue; }
    if (arg === '--days' || arg === '--from' || arg === '--to') {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} requires a value`);
      opts[arg.slice(2)] = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (opts.days !== null && (opts.from !== null || opts.to !== null)) {
    throw new Error('--days cannot be combined with --from/--to');
  }

  if (opts.from !== null || opts.to !== null) {
    const toKey = opts.to ?? utcDateKey(now);
    const fromKey = opts.from ?? toKey;
    if (!isDateKey(fromKey)) throw new Error(`--from must be a YYYY-MM-DD date: ${fromKey}`);
    if (!isDateKey(toKey)) throw new Error(`--to must be a YYYY-MM-DD date: ${toKey}`);
    if (fromKey > toKey) throw new Error(`--from (${fromKey}) is after --to (${toKey})`);
    return { fromKey, toKey, json: opts.json };
  }

  const days = opts.days === null ? DEFAULT_DAYS : Number(opts.days);
  if (!Number.isInteger(days) || days < 1) throw new Error(`--days must be a positive integer: ${opts.days}`);
  const toKey = utcDateKey(now);
  return { fromKey: dateKeyForOffset(days - 1, now), toKey, json: opts.json };
}

// ==================== PURE — the record's three facts ====================

/** The stamped call latency, or null when the record carries none. */
export function latencyOf(record) {
  const ms = record?.gemmaLatencyMs;
  return typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 ? ms : null;
}

/** chat.js files `turnError: true` on the parse-failure and catch paths. */
export function isTurnError(record) {
  return record?.turnError === true;
}

/**
 * IS THIS A VOICE TURN? The `conversations` stream has FOUR writers, not one:
 * api/agent/chat.js (the battle voice turn — three call sites) plus
 * api/forge/watchlist-analysis.js (`gameMode:'set_analysis'`),
 * api/forge/workshop-chat.js (`'workshop'`, two sites) and
 * api/screener/chat.js (`'research'`). The other three stamp no
 * `gemmaLatencyMs`, so they never moved a percentile — but they landed in
 * `records`, in `turnErrors`, and in the DENOMINATOR of `timeoutRate`, which
 * is the headline number the timeout change is judged on. A day with 20 voice
 * turns (2 timed out) and 85 workshop/research turns reported 1.9% where the
 * truth was 10.0%, and the error grows silently with unrelated product traffic.
 *
 * The discriminator is `battleId`: chat.js is the only writer that sets a real
 * one; the other three hard-code `battleId: null`
 * (watchlist-analysis.js:573, workshop-chat.js:447/593, screener/chat.js:401).
 * Everything the excluded records would have contributed is reported as
 * `otherStreamRecords` rather than dropped in silence.
 */
export function isVoiceTurnRecord(record) {
  return typeof record?.battleId === 'string' && record.battleId.length > 0;
}

/** The abort turn — the 504, `errorReason: 'gemma_timeout'`. */
export function isTimeout(record) {
  return record?.errorReason === TIMEOUT_ERROR_REASON;
}

// ==================== PURE — the distribution ====================

const round = (v) => (v === null ? null : Math.round(v));

/**
 * p50 / p95 / max over a latency sample. Nulls (and non-finite values) are
 * dropped by `quantile`; an empty sample reports nulls rather than zeros — a
 * zero would read as "0 ms", which is a measurement, not an absence.
 */
export function latencyPercentiles(values) {
  const xs = (Array.isArray(values) ? values : []).filter((v) => typeof v === 'number' && Number.isFinite(v));
  return {
    samples: xs.length,
    p50: round(quantile(xs, 0.5)),
    p95: round(quantile(xs, 0.95)),
    max: xs.length ? Math.max(...xs) : null,
  };
}

/**
 * One bucket's summary, over the VOICE TURNS only (isVoiceTurnRecord).
 *
 * `all` spans every voice turn carrying a latency. `answered` excludes ONLY the
 * aborts: a timed-out turn's `gemmaLatencyMs` is the abort budget, not a
 * response time. It deliberately KEEPS the other errored turns — chat.js files
 * `turnError: true` on the parse-failure path (the model answered in full, just
 * not in JSON: chat.js:592-613) and on the catch path for a throw AFTER a
 * successful call (`handler_exception`, chat.js:879-901), and both of those
 * ARE the model's own response time, typically the slow tail. Excluding them
 * (the first cut of this file did) read p95 3,760 ms where the truth was
 * ~11,750 ms — and this is the baseline gate 1's harness is compared against,
 * so the whole comparison would inherit the error.
 */
export function summarize(records) {
  const raw = Array.isArray(records) ? records.filter((r) => r && typeof r === 'object') : [];
  const list = raw.filter(isVoiceTurnRecord);
  const all = [];
  const ok = [];
  let timeouts = 0;
  let turnErrors = 0;
  for (const record of list) {
    if (isTimeout(record)) timeouts++;
    if (isTurnError(record)) turnErrors++;
    const ms = latencyOf(record);
    if (ms === null) continue;
    all.push(ms);
    if (!isTimeout(record)) ok.push(ms);
  }
  return {
    records: list.length,
    otherStreamRecords: raw.length - list.length,
    withLatency: all.length,
    all: latencyPercentiles(all),
    ok: latencyPercentiles(ok),
    timeouts,
    timeoutRate: list.length ? timeouts / list.length : null,
    turnErrors,
    // The raw millisecond samples, kept so the OVERALL row can be recomputed
    // from the per-day summaries instead of from a second pass over every
    // record — numbers, not the ~52 KB records they came from.
    samples: { all, ok },
  };
}

/** The header the `ok` column carries, so its meaning cannot drift from its label. */
export const ANSWERED_LABEL = 'latency(answered)';

/**
 * The OVERALL row, from the per-day summaries. Percentiles are recomputed over
 * the pooled samples — never averaged, which is not what a percentile is.
 */
export function mergeSummaries(summaries) {
  const list = (Array.isArray(summaries) ? summaries : []).filter(Boolean);
  const all = list.flatMap((s) => s.samples?.all || []);
  const ok = list.flatMap((s) => s.samples?.ok || []);
  const records = list.reduce((n, s) => n + s.records, 0);
  const timeouts = list.reduce((n, s) => n + s.timeouts, 0);
  return {
    records,
    otherStreamRecords: list.reduce((n, s) => n + (s.otherStreamRecords || 0), 0),
    withLatency: all.length,
    all: latencyPercentiles(all),
    ok: latencyPercentiles(ok),
    timeouts,
    timeoutRate: records ? timeouts / records : null,
    turnErrors: list.reduce((n, s) => n + s.turnErrors, 0),
    samples: { all, ok },
  };
}

/**
 * Per-day summaries plus the overall one, from a `dateKey → records[]` map.
 * Every key in `dateKeys` gets a row, including the days that logged nothing —
 * a silent day is a fact about the read, not a row to drop.
 */
export function summarizeByDay(byDay, dateKeys) {
  const keys = Array.isArray(dateKeys) ? dateKeys : Object.keys(byDay || {}).sort();
  const perDay = keys.map((dateKey) => ({ dateKey, ...summarize(byDay?.[dateKey] || []) }));
  return { perDay, overall: mergeSummaries(perDay) };
}

// ==================== PURE — the report ====================

const cell = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);
const pct = (rate) => (rate === null || rate === undefined ? '—' : `${(rate * 100).toFixed(1)}%`);

/** The console table. `formatReport(summarizeByDay(...))`. */
export function formatReport({ perDay, overall, fromKey, toKey, read = null }) {
  const lines = [];
  lines.push(`gemma_latency — shadow/${STREAM}/ ${fromKey} → ${toKey} (UTC date keys)`);
  lines.push('');
  lines.push(`  day          turns  latency(all)  p50     p95     max     ${ANSWERED_LABEL}  p50     p95     max     timeouts`);
  const row = (label, s) => {
    lines.push([
      `  ${label.padEnd(11)}`,
      String(s.records).padStart(5),
      String(s.all.samples).padStart(14),
      cell(s.all.p50).padStart(7),
      cell(s.all.p95).padStart(7),
      cell(s.all.max).padStart(7),
      String(s.ok.samples).padStart(ANSWERED_LABEL.length + 2),
      cell(s.ok.p50).padStart(7),
      cell(s.ok.p95).padStart(7),
      cell(s.ok.max).padStart(7),
      `${String(s.timeouts).padStart(9)} (${pct(s.timeoutRate)})`,
    ].join(''));
  };
  // Each row is rendered from its OWN summary; `perDay.map` rather than a loop
  // that could reach for `overall` by accident.
  for (const day of perDay) row(day.dateKey, day);
  lines.push('');
  row('OVERALL', overall);
  lines.push('');
  lines.push('  turns        = the battle voice turns (api/agent/chat.js). The `conversations` stream also');
  lines.push('                 carries workshop / research / set-analysis turns from three other endpoints;');
  lines.push(`                 ${overall.otherStreamRecords ?? 0} such record(s) in this range are excluded from every figure above.`);
  lines.push('  latency(all) = every voice turn carrying gemmaLatencyMs, timed-out turns included.');
  lines.push(`  ${ANSWERED_LABEL} = the turns the model actually answered — aborts excluded, parse failures and`);
  lines.push('                 post-call exceptions KEPT, because those are response times too (and the slow tail).');
  lines.push('  Milliseconds. Percentiles are linear-interpolation quantiles (measureCorpus.js).');
  if (read) {
    lines.push('');
    lines.push(`  ${read.filesRead} file(s) read${read.filesFailed ? `, ${read.filesFailed} FAILED to download` : ''}.`);
    if (read.daysFailed) {
      lines.push(`  ${read.daysFailed} of ${read.daysFailed + read.daysRead} day(s) COULD NOT BE LISTED — their rows above are a read failure, not an absence of traffic.`);
    }
  }
  return lines.join('\n');
}

// ==================== IMPURE — the read ====================

/**
 * The bucket, or null when GCS_CREDENTIALS is unset. A credential that is SET
 * but not parseable throws with a sentence rather than a raw SyntaxError stack
 * — "unset" and "malformed" are different operator problems and must not look
 * the same.
 */
export function getBucket() {
  const creds = process.env.GCS_CREDENTIALS;
  if (!creds) return null;
  let credentials;
  try {
    credentials = JSON.parse(creds);
  } catch {
    throw new Error('GCS_CREDENTIALS is set but is not valid JSON — it must be the JSON-stringified service account (same as shadowLogger.js)');
  }
  const storage = new Storage({ projectId: PROJECT_ID, credentials });
  return storage.bucket(BUCKET_NAME);
}

export async function listDayFiles(bucket, dateKey, stream = STREAM) {
  const [files] = await bucket.getFiles({ prefix: `shadow/${stream}/${dateKey}/` });
  return files;
}

export async function downloadJsonl(file) {
  const [buf] = await file.download();
  return buf.toString('utf8').split('\n').filter(Boolean).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Read every record in the range, keyed by UTC day. A per-day listing failure
 * and a per-file download failure are both isolated — the other days and files
 * still produce their rows — but they are COUNTED and returned, because a read
 * where every day failed is otherwise byte-identical to a range with no
 * traffic: all zeros, and the p50 this script exists to produce silently
 * absent rather than flagged.
 *
 * `onDay(dateKey, records)` streams each day out as it lands. When supplied,
 * the records are NOT retained — a paired shadow record carries both assembled
 * prompts (~52 KB), so a busy week is a gigabyte held to keep a summary.
 *
 * @returns {{byDay:object, filesRead:number, filesFailed:number, daysFailed:number, daysRead:number}}
 */
export async function readRange(bucket, dateKeys, { stream = STREAM, onProgress, onDay } = {}) {
  const byDay = {};
  let filesRead = 0;
  let filesFailed = 0;
  let daysFailed = 0;
  for (const dateKey of dateKeys) {
    const dayRecords = [];
    if (!onDay) byDay[dateKey] = dayRecords;
    let files;
    try {
      files = await listDayFiles(bucket, dateKey, stream);
    } catch (err) {
      daysFailed++;
      console.error(`[gemma-latency-report] list ${stream}/${dateKey} failed: ${err.message}`);
      if (onDay) onDay(dateKey, dayRecords);
      continue;
    }
    for (const file of files) {
      try {
        const records = await downloadJsonl(file);
        // Counted AFTER the await: a file that failed to download was attempted,
        // not read, and `filesRead` is what a reader checks coverage against.
        filesRead++;
        dayRecords.push(...records);
      } catch (err) {
        filesFailed++;
        console.error(`[gemma-latency-report] download ${file.name} failed: ${err.message}`);
      }
    }
    if (onDay) onDay(dateKey, dayRecords);
    if (onProgress) onProgress(dateKey, dayRecords.length);
  }
  return { byDay, filesRead, filesFailed, daysFailed, daysRead: dateKeys.length - daysFailed };
}

async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(`[gemma-latency-report] ${err.message}`);
    console.error('Usage: node --env-file=.env.local api/scripts/gemma-latency-report.js [--days N | --from YYYY-MM-DD [--to YYYY-MM-DD]] [--json]');
    process.exitCode = 1;
    return;
  }

  let bucket;
  try {
    bucket = getBucket();
  } catch (err) {
    // A malformed credential is an operator problem with a fix; it gets the
    // sentence, not a stack.
    console.error(`[gemma-latency-report] ${err.message}`);
    process.exitCode = 1;
    return;
  }
  if (!bucket) {
    console.error('[gemma-latency-report] GCS_CREDENTIALS not set — cannot read the shadow stream');
    process.exitCode = 1;
    return;
  }

  const dateKeys = dateKeysInRange(args.fromKey, args.toKey);
  if (!args.json) {
    console.log(`\n[gemma-latency-report] reading ${dateKeys.length} day(s) from gs://${BUCKET_NAME}/shadow/${STREAM}/\n`);
  }
  // Streamed: each day is summarized and released rather than held to the end
  // of the range (readRange's `onDay` contract).
  const perDay = [];
  const read = await readRange(bucket, dateKeys, {
    onDay: (dateKey, records) => perDay.push({ dateKey, ...summarize(records) }),
  });
  const overall = mergeSummaries(perDay);

  if (args.json) {
    console.log(JSON.stringify({
      from: args.fromKey,
      to: args.toKey,
      filesRead: read.filesRead,
      filesFailed: read.filesFailed,
      daysFailed: read.daysFailed,
      daysRead: read.daysRead,
      perDay,
      overall,
    }, null, 2));
  } else {
    console.log(formatReport({ perDay, overall, fromKey: args.fromKey, toKey: args.toKey, read }));
    console.log('');
  }

  // A read where EVERY day failed is not a completed read. Zeros that came
  // from a broken credential must not exit 0 beside zeros that came from a
  // quiet week — a consumer redirecting --json to a file sees only the numbers.
  if (read.daysFailed > 0 && read.daysRead === 0) {
    console.error(`[gemma-latency-report] READ FAILED: none of the ${read.daysFailed} day(s) could be listed. The figures above are empty because nothing was read.`);
    process.exitCode = 1;
  }
}

// Only when RUN — importing this module (the unit test, the paired harness)
// must never start a read.
// realpath BOTH sides: Node realpaths the ESM main module for `import.meta.url`
// but leaves `process.argv[1]` as the caller spelled it, so any symlinked
// component — the script, a `~/bin` shim, a repo under a symlinked home,
// macOS's /tmp → /private/tmp — makes the equality false and the CLI exit 0
// having silently done nothing. A no-op that looks like a clean run is the
// worst failure a founder-run gate can have.
const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return import.meta.url === pathToFileURL(entry).href;
  }
})();
if (invokedDirectly) {
  main().catch((err) => {
    console.error('[gemma-latency-report] fatal:', err);
    process.exitCode = 1;
  });
}
