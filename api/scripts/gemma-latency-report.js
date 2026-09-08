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

/** `daysAgo` days before `now`, as a UTC date key. */
export function dateKeyForOffset(daysAgo, now = new Date()) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return utcDateKey(d);
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
 * One bucket's summary. `all` spans every record carrying a latency; `ok`
 * excludes the errored turns (a timeout's latency is the abort budget).
 */
export function summarize(records) {
  const list = Array.isArray(records) ? records.filter((r) => r && typeof r === 'object') : [];
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
    if (!isTurnError(record)) ok.push(ms);
  }
  return {
    records: list.length,
    withLatency: all.length,
    all: latencyPercentiles(all),
    ok: latencyPercentiles(ok),
    timeouts,
    timeoutRate: list.length ? timeouts / list.length : null,
    turnErrors,
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
  const overall = summarize(keys.flatMap((k) => byDay?.[k] || []));
  return { perDay, overall };
}

// ==================== PURE — the report ====================

const cell = (v, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);
const pct = (rate) => (rate === null || rate === undefined ? '—' : `${(rate * 100).toFixed(1)}%`);

/** The console table. `formatReport(summarizeByDay(...))`. */
export function formatReport({ perDay, overall, fromKey, toKey }) {
  const lines = [];
  lines.push(`gemma_latency — shadow/${STREAM}/ ${fromKey} → ${toKey} (UTC date keys)`);
  lines.push('');
  lines.push('  day          records  latency(all)  p50     p95     max     latency(ok)  p50     p95     max     timeouts');
  const row = (label, s) => {
    lines.push([
      `  ${label.padEnd(11)}`,
      String(s.records).padStart(7),
      String(s.all.samples).padStart(14),
      cell(s.all.p50).padStart(7),
      cell(s.all.p95).padStart(7),
      cell(s.all.max).padStart(7),
      String(s.ok.samples).padStart(13),
      cell(s.ok.p50).padStart(7),
      cell(s.ok.p95).padStart(7),
      cell(s.ok.max).padStart(7),
      `${String(s.timeouts).padStart(9)} (${pct(s.timeoutRate)})`,
    ].join(''));
  };
  for (const day of perDay) row(day.dateKey, day);
  lines.push('');
  row('OVERALL', overall);
  lines.push('');
  lines.push('  latency(all) = every record carrying gemmaLatencyMs, timed-out turns included.');
  lines.push('  latency(ok)  = the turns that did not error — the model\'s own response time.');
  lines.push('  Milliseconds. Percentiles are linear-interpolation quantiles (measureCorpus.js).');
  return lines.join('\n');
}

// ==================== IMPURE — the read ====================

export function getBucket() {
  const creds = process.env.GCS_CREDENTIALS;
  if (!creds) return null;
  const storage = new Storage({ projectId: PROJECT_ID, credentials: JSON.parse(creds) });
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

/** Read every record in the range, keyed by UTC day. Per-day read failures are reported, never fatal. */
export async function readRange(bucket, dateKeys, { stream = STREAM, onProgress } = {}) {
  const byDay = {};
  let filesRead = 0;
  for (const dateKey of dateKeys) {
    byDay[dateKey] = [];
    let files;
    try {
      files = await listDayFiles(bucket, dateKey, stream);
    } catch (err) {
      console.error(`[gemma-latency-report] list ${stream}/${dateKey} failed: ${err.message}`);
      continue;
    }
    for (const file of files) {
      filesRead++;
      try {
        byDay[dateKey].push(...await downloadJsonl(file));
      } catch (err) {
        console.error(`[gemma-latency-report] download ${file.name} failed: ${err.message}`);
      }
    }
    if (onProgress) onProgress(dateKey, byDay[dateKey].length);
  }
  return { byDay, filesRead };
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

  const bucket = getBucket();
  if (!bucket) {
    console.error('[gemma-latency-report] GCS_CREDENTIALS not set — cannot read the shadow stream');
    process.exitCode = 1;
    return;
  }

  const dateKeys = dateKeysInRange(args.fromKey, args.toKey);
  if (!args.json) {
    console.log(`\n[gemma-latency-report] reading ${dateKeys.length} day(s) from gs://${BUCKET_NAME}/shadow/${STREAM}/\n`);
  }
  const { byDay, filesRead } = await readRange(bucket, dateKeys);
  const { perDay, overall } = summarizeByDay(byDay, dateKeys);

  if (args.json) {
    console.log(JSON.stringify({ from: args.fromKey, to: args.toKey, filesRead, perDay, overall }, null, 2));
    return;
  }
  console.log(formatReport({ perDay, overall, fromKey: args.fromKey, toKey: args.toKey }));
  console.log(`\n  ${filesRead} file(s) read.\n`);
}

// Only when RUN — importing this module (the unit test, the paired harness)
// must never start a read.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error('[gemma-latency-report] fatal:', err);
    process.exitCode = 1;
  });
}
