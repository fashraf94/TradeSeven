#!/usr/bin/env node
// scripts/experiments/setup-payoff/fetchLong.mjs
//
// Setup payoff check — THE ONE OPTIONAL FETCH (prompt rule 5). Allowed because the frequency run's stored series are
// 228 rows, well under about 560 sessions. EODHD daily bars, ONE LONG SERIES PER SYMBOL, the frequency run's own 241
// symbols (its plan.json), through the request function its fetch used (api/_utils/eodhdDailyWindow.js
// fetchDailyPayload, newest first). Range DEFINITIONS.fetch: 2024-11-01 to 2026-11-17, so the long window (every
// 2026 session the calendar can evaluate) has the store's 130-day request window and Part D its 120 trailing sessions.
//
// HARD CAP 260 requests, counted in this run's own requests.json, each place written to disk BEFORE its request. A
// failure is counted and not retried here. A symbol already on disk costs nothing. Refuses to start inside a trading
// session's hours and checks the hours before every request. One fetch per run folder (an exclusive lock). The key is
// parsed in place from the main checkout's .env.local into this process only, never printed.
//
// USAGE: node scripts/experiments/setup-payoff/fetchLong.mjs [--run <dir>] [--env <.env.local>] [--plan-only]

import { closeSync, existsSync, openSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnvFile } from '../../calibration/export-agent-battles.js';
import { fetchDailyPayload } from '../../../api/_utils/eodhdDailyWindow.js';
import { toEtParts } from '../../../api/_utils/marketDataCache.js';
import { getSessionForDate } from '../../../api/_utils/marketSchedule.js';
import { argOf, DEFINITIONS, die, FREQ_RUN, readJson, runDirOf, writeJson, writeVerbGrep } from './lib.mjs';

const DEFAULT_ENV = 'C:/Users/fashr/portfolio-duel/.env.local';
const TIMEOUT_MS = 30_000;
const CONCURRENCY = 4;
const { cap: CAP, from: FROM, to: TO } = DEFINITIONS.fetch;

function insideMarketHours(nowMs) {
  const day = getSessionForDate(toEtParts(new Date(nowMs)).dateStr);
  return Boolean(day?.isTradingDay && nowMs >= day.openMs && nowMs < day.closeMs);
}

async function main() {
  writeVerbGrep();
  const argv = process.argv;
  const runDir = runDirOf(argv);
  if (insideMarketHours(Date.now())) die('inside a trading session\'s hours: run outside market hours');
  const plan = readJson(path.join(FREQ_RUN, 'plan.json'));
  const symbols = plan.all;
  const counterFile = path.join(runDir, 'requests.json');
  const counter = existsSync(counterFile) ? readJson(counterFile) : { cap: CAP, made: 0, from: FROM, to: TO, symbols: symbols.length, log: [] };
  if (counter.from !== FROM || counter.to !== TO) die(`the counter is for ${counter.from}..${counter.to}, this run asks ${FROM}..${TO}`);
  const todo = symbols.filter((s) => !existsSync(path.join(runDir, 'bars', `${s}.json`)));
  console.log(`plan: ${symbols.length} symbols (the frequency run's plan); on disk ${symbols.length - todo.length}; to fetch ${todo.length}; made so far ${counter.made} of ${CAP}; range ${FROM}..${TO}`);
  if (counter.made + todo.length > CAP) die(`the plan needs ${counter.made + todo.length} requests, above the cap of ${CAP}`);
  if (argv.includes('--plan-only')) return;

  const env = parseEnvFile(argOf(argv, '--env') || DEFAULT_ENV);
  if (!env.EODHD_API_KEY) die('EODHD_API_KEY is not in the env file');
  process.env.EODHD_API_KEY = env.EODHD_API_KEY;

  const lockFile = path.join(runDir, 'requests.lock');
  let lock;
  try { lock = openSync(lockFile, 'wx'); } catch { die(`another fetch holds ${lockFile}`); }
  let next = 0;
  let stoppedForHours = false;
  const worker = async () => {
    while (next < todo.length) {
      if (insideMarketHours(Date.now())) { stoppedForHours = true; return; }
      if (counter.made >= CAP) return;
      const symbol = todo[next];
      next += 1;
      counter.made += 1;
      const entry = { n: counter.made, symbol, requestedAt: new Date().toISOString(), outcome: 'in_flight' };
      counter.log.push(entry);
      writeJson(counterFile, counter); // the place is taken on disk before the request
      try {
        const payload = await fetchDailyPayload(symbol, { from: FROM, to: TO, order: 'd', timeoutMs: TIMEOUT_MS });
        const receivedAt = new Date().toISOString();
        entry.outcome = Array.isArray(payload) ? `rows:${payload.length}` : 'non_array';
        if (Array.isArray(payload)) writeJson(path.join(runDir, 'bars', `${symbol}.json`), { symbol, from: FROM, to: TO, requestedAt: entry.requestedAt, receivedAt, payload });
      } catch (err) {
        entry.outcome = `failed:${String(err?.message || 'error').slice(0, 60)}`;
      }
      writeJson(counterFile, counter);
    }
  };
  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } finally {
    closeSync(lock);
    unlinkSync(lockFile);
  }
  const failed = counter.log.filter((e) => e.outcome.startsWith('failed') || e.outcome === 'non_array').length;
  console.log(`requests made: ${counter.made} of ${CAP}; failed or non-array: ${failed}${stoppedForHours ? '; stopped: the session opened' : ''}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => die(err?.stack || err?.message));
}
