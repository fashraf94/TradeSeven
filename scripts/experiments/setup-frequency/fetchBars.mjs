#!/usr/bin/env node
// scripts/experiments/setup-frequency/fetchBars.mjs
//
// Setup frequency count — THE MARKET DATA (prompt §1 rule 6). EODHD daily bars only, ONE LONG SERIES PER SYMBOL,
// through the store's own request function (api/_utils/eodhdDailyWindow.js fetchDailyPayload, newest first), sliced
// locally into the store's windows by storeReplay.mjs. Never one request per session.
//
// THE PLAN comes first and is printed before any request: the 228 ranked stocks, SPY, the eleven sector funds, and
// every non-crypto name on a stored record, a battle list (book, bench, the trades' names) or an equipped list. A plan
// above the hard cap (400) is refused. Each request takes its place in the run's counter (requests.json), written to
// disk BEFORE the request is made; a failure is counted and not retried here (a re-run retries it, counted again).
// A symbol whose series is already on disk costs nothing. It refuses to run inside a trading session's hours.
//
// THE RANGE: from 160 calendar days before the window's first session (the store reads 130; the rest is slack) to
// the window's last session. The key is parsed in place from the main checkout's .env.local (--env) into this
// process only, never printed; the request function's errors never carry the URL.
//
// USAGE: node scripts/experiments/setup-frequency/fetchBars.mjs [--run <dir>] [--env <.env.local>] [--plan-only]

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnvFile } from '../../calibration/export-agent-battles.js';
import { fetchDailyPayload } from '../../../api/_utils/eodhdDailyWindow.js';
import { isCryptoSymbol, toEtParts } from '../../../api/_utils/marketDataCache.js';
import { getSessionForDate } from '../../../api/_utils/marketSchedule.js';
import { ALL_TICKERS } from '../../../api/_utils/rankingConfig.js';
import { lastCompletedSessionAt } from './storeReplay.mjs';
import { argOf, die, MARKET_SYMBOL, readJson, REQUEST_CAP, runDirOf, SECTOR_FUNDS, uniq, windowSessions, writeJson, writeVerbGrep } from './lib.mjs';

const DEFAULT_ENV = 'C:/Users/fashr/portfolio-duel/.env.local';
const LOOKBACK_DAYS = 160;
const TIMEOUT_MS = 30_000;
const CONCURRENCY = 4;
const SYMBOL_OK = /^[A-Z0-9]+(?:[-.][A-Z0-9]+)*$/;

/** The symbol set, in a fixed order: the universe, the market, the funds, then every other name the export carries. */
export function planSymbols(exp) {
  const extra = [];
  for (const r of exp.records || []) extra.push(r.symbol);
  for (const b of exp.battles || []) {
    if (b.league) continue;
    for (const a of [...b.book, ...b.bench]) if (!a.crypto) extra.push(a.symbol);
    for (const t of b.trades) if (!t.crypto) extra.push(t.in, t.out);
  }
  for (const l of exp.equipped || []) extra.push(...l.symbols);
  const fixed = [...ALL_TICKERS, MARKET_SYMBOL, ...SECTOR_FUNDS];
  const others = uniq(extra.filter((s) => typeof s === 'string' && SYMBOL_OK.test(s) && !isCryptoSymbol(s) && !fixed.includes(s))).sort();
  return { fixed, others, all: uniq([...fixed, ...others]) };
}

function assertOutsideMarketHours(nowMs) {
  const etDate = toEtParts(new Date(nowMs)).dateStr;
  const day = getSessionForDate(etDate);
  if (day?.isTradingDay && nowMs >= day.openMs && nowMs < day.closeMs) die(`inside the ${etDate} session's hours: run outside market hours`);
}

async function main() {
  writeVerbGrep();
  const argv = process.argv;
  const runDir = runDirOf(argv);
  const nowMs = Date.now();
  assertOutsideMarketHours(nowMs);
  const last = lastCompletedSessionAt(nowMs);
  if (!last.ok) die('the calendar cannot name the last completed session');
  const sessions = windowSessions(last.session);
  const from = new Date(Date.parse(`${sessions[0]}T12:00:00Z`) - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const to = sessions[sessions.length - 1];

  const exp = readJson(path.join(runDir, 'export.json'));
  const plan = planSymbols(exp);
  const counterFile = path.join(runDir, 'requests.json');
  const counter = existsSync(counterFile) ? readJson(counterFile) : { cap: REQUEST_CAP, made: 0, from, to, window: { first: sessions[0], last: to }, log: [] };
  if (counter.to !== to || counter.from !== from) die(`the run's counter is for ${counter.from}..${counter.to}, this run asks ${from}..${to}`);
  const todo = plan.all.filter((s) => !existsSync(path.join(runDir, 'bars', `${s}.json`)));
  console.log(`window ${sessions[0]} .. ${to} (${sessions.length} sessions); request range ${from} .. ${to}`);
  console.log(`plan: ${plan.all.length} symbols (${plan.fixed.length} universe + market + funds, ${plan.others.length} other list or record names); on disk ${plan.all.length - todo.length}; to fetch ${todo.length}; made so far ${counter.made} of ${REQUEST_CAP}`);
  writeJson(path.join(runDir, 'plan.json'), { from, to, window: { first: sessions[0], last: to }, ...plan });
  if (counter.made + todo.length > REQUEST_CAP) die(`the plan needs ${counter.made + todo.length} requests, above the cap of ${REQUEST_CAP}`);
  if (argv.includes('--plan-only')) return;

  const env = parseEnvFile(argOf(argv, '--env') || DEFAULT_ENV);
  if (!env.EODHD_API_KEY) die('EODHD_API_KEY is not in the env file');
  process.env.EODHD_API_KEY = env.EODHD_API_KEY;

  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const symbol = todo[next];
      next += 1;
      if (counter.made >= REQUEST_CAP) return;
      counter.made += 1;
      const entry = { n: counter.made, symbol, requestedAt: new Date().toISOString(), outcome: 'in_flight' };
      counter.log.push(entry);
      writeJson(counterFile, counter); // the place is taken on disk before the request
      try {
        const payload = await fetchDailyPayload(symbol, { from, to, order: 'd', timeoutMs: TIMEOUT_MS });
        const receivedAt = new Date().toISOString();
        entry.outcome = Array.isArray(payload) ? `rows:${payload.length}` : 'non_array';
        writeJson(path.join(runDir, 'bars', `${symbol}.json`), { symbol, from, to, requestedAt: entry.requestedAt, receivedAt, payload });
      } catch (err) {
        entry.outcome = `failed:${String(err?.message || 'error').slice(0, 60)}`;
      }
      writeJson(counterFile, counter);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const failed = counter.log.filter((e) => e.outcome.startsWith('failed') || e.outcome === 'non_array').length;
  console.log(`requests made: ${counter.made} of ${REQUEST_CAP}; failed or non-array: ${failed}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => die(err?.stack || err?.message));
}
