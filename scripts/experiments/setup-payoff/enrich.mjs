#!/usr/bin/env node
// scripts/experiments/setup-payoff/enrich.mjs
//
// Setup payoff check — THE FREQUENCY RUN'S REPLAY, RE-RUN TO KEEP ITS CHECK VALUES (prompt rule 3). The frequency
// run's replay.json keeps a compact record per (symbol, session) that drops ATR, SMA_fast, swingHigh and the pattern
// assessments, which Parts A and B need. This step re-runs that run's own module (../setup-frequency/storeReplay.mjs:
// replayOne and compactOf, the store's pure chain and classifier) and keeps, beside the compact record, the record's
// own facts and checks. No pattern is reimplemented here.
//
//   --source stored   the frequency run's bars, its 120 sessions, every symbol of its plan. Each compact record must
//                     equal replay.json's, field for field (Step 0); a difference is written out and the run fails.
//   --source fetched  this run's long fetch, every 2026 session the calendar can evaluate up to 17 Nov 2026.
//
// Sharded by symbol (--shard k --of n) so several processes can share the work; each writes its own file.
//
// USAGE: node scripts/experiments/setup-payoff/enrich.mjs --source stored|fetched [--shard k --of n] [--run <dir>]

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compactOf, replayOne } from '../setup-frequency/storeReplay.mjs';
import { argOf, DEFINITIONS, die, FREQ_RUN, readJson, runDirOf, sessionsBack, writeJson, writeVerbGrep } from './lib.mjs';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The compact record plus what Parts A and B read: the record's own facts and check results. */
export function enrichedOf(out) {
  const c = compactOf(out);
  const e = out.entry;
  const f = e.factsUsed || {};
  const ext = Array.isArray(e.checks) ? e.checks.find((k) => k.id === 'extension') : null;
  return {
    ...c,
    pb: e.patterns?.breakout ?? null,
    pr: e.patterns?.pullback_resume ?? null,
    F: num(f.SMA_fast?.value),
    A: num(f.ATR?.value),
    H: num(f.swingHigh?.value),
    x: ext ? ext.result : null,
    n55: Array.isArray(out.evidence?.bars) && out.evidence.bars.length > 0 ? out.evidence.bars[out.evidence.bars.length - 1].date : null,
  };
}

const COMPACT_FIELDS = ['v', 'r', 'p', 'ps', 'rg', 'm', 'ok', 'rf', 'rfDate', 'd', 'dr', 'C', 'extLimit', 'dropped'];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function main() {
  writeVerbGrep();
  const argv = process.argv;
  const runDir = runDirOf(argv);
  const source = argOf(argv, '--source');
  if (source !== 'stored' && source !== 'fetched') die('--source stored|fetched');
  const shard = Number(argOf(argv, '--shard') ?? 0);
  const of = Number(argOf(argv, '--of') ?? 1);
  const plan = readJson(path.join(FREQ_RUN, 'plan.json'));
  const symbols = plan.all.filter((_, i) => i % of === shard);
  const stored = source === 'stored' ? readJson(path.join(FREQ_RUN, 'replay.json')) : null;
  const sessions = source === 'stored' ? stored.window.sessions : sessionsBack(DEFINITIONS.window.lastSession, DEFINITIONS.window.longMax);
  const barsDir = source === 'stored' ? path.join(FREQ_RUN, 'bars') : path.join(runDir, 'bars');

  const bySymbol = {};
  const mismatches = [];
  let compared = 0;
  for (const symbol of symbols) {
    const file = readJson(path.join(barsDir, `${symbol}.json`));
    if (!Array.isArray(file.payload)) die(`${symbol}: the payload is not an array`);
    bySymbol[symbol] = {};
    for (const session of sessions) {
      const rec = enrichedOf(replayOne({ series: file.payload, symbol, session, fetchedAt: file.receivedAt }));
      bySymbol[symbol][session] = rec;
      if (stored) {
        compared += 1;
        const want = stored.bySymbol[symbol]?.[session];
        const differing = COMPACT_FIELDS.filter((k) => !same(rec[k], want?.[k]));
        if (differing.length > 0) mismatches.push({ symbol, session, differing });
      }
    }
  }
  const outFile = path.join(runDir, 'enriched', `${source}-${shard}-of-${of}.json`);
  writeJson(outFile, { source, sessions, symbols, compared, mismatches, bySymbol });
  console.log(`${source} shard ${shard}/${of}: ${symbols.length} symbols x ${sessions.length} sessions${stored ? `; compact equal to replay.json on ${compared - mismatches.length} of ${compared}` : ''}`);
  if (mismatches.length > 0) die(`${mismatches.length} records differ from the frequency run's replay.json (first: ${JSON.stringify(mismatches[0])})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => die(err?.stack || err?.message));
}
