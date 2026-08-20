#!/usr/bin/env node
// scripts/calibration/motive-baseline-summary.js
//
// Tier-1 swapMotive baseline summary — the R9 evidence pull (Exit-Behavior
// Rebalance: the pre-treatment motive baseline that informs the rollback
// trigger's N at the Asks 1+3 flip).
//
// READ ONLY. Walks agentBattles' trades[] and aggregates, over MODEL swaps
// (exitReason === 'haiku_decision'):
//   - the declared-motive distribution (defensive_cut / profit_take /
//     momentum_rotation / upgrade),
//   - the profit_take attempt rate under the current prohibition,
//   - the undeclared rate (swapMotive === null — asked, not answered) and the
//     legacy rate (field absent — predates Tier 1),
// plus the deterministic-reason split for context (stops/risk/gameplan swaps
// carry no motive by design).
//
// Run exactly like export-agent-battles (the void pre-check pattern):
//   node scripts/calibration/motive-baseline-summary.js --since 2026-08-19
// Credentials: FIREBASE_ADMIN_CREDENTIALS in .env.local or the environment.
// Flags: --since YYYY-MM-DD (swappedOutAt lower bound, default 2026-08-19 —
//        the Ask 3 merge date), --until YYYY-MM-DD, --status active|completed|all
//        (default all), --json out.json (optional file dump).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
// The SAME env parser the void pre-check uses — not a re-implementation
// (it strips both quote styles; a copied narrower variant broke
// single-quoted FIREBASE_ADMIN_CREDENTIALS in review).
import { parseEnvFile } from './export-agent-battles.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '../..');

const die = (msg) => { console.error(`ERROR: ${msg}`); process.exit(1); };

function parseArgs(argv) {
  const flags = { since: '2026-08-19', until: null, status: 'all', json: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--since') flags.since = argv[++i];
    else if (argv[i] === '--until') flags.until = argv[++i];
    else if (argv[i] === '--status') flags.status = argv[++i];
    else if (argv[i] === '--json') flags.json = argv[++i];
  }
  return flags;
}

const MOTIVES = ['defensive_cut', 'profit_take', 'momentum_rotation', 'upgrade'];
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : '—');

async function main() {
  const flags = parseArgs(process.argv);
  const env = parseEnvFile(path.join(PROJECT_ROOT, '.env.local'));
  const creds = env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!creds) die('FIREBASE_ADMIN_CREDENTIALS not found in .env.local or the environment');
  let serviceAccount;
  try { serviceAccount = JSON.parse(creds); } catch (err) { die(`FIREBASE_ADMIN_CREDENTIALS is not valid JSON: ${err.message}`); }

  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  console.log(`firebase-admin initialized for project: ${serviceAccount.project_id} (READ ONLY)`);

  // Single-field filter at most (no composite index); the date window is
  // applied client-side on trades[].swappedOutAt — mirrors export-agent-battles.
  let q = db.collection('agentBattles');
  if (flags.status && flags.status !== 'all') q = q.where('status', '==', flags.status);
  const snap = await q.get();
  console.log(`battles scanned: ${snap.size}; window: ${flags.since} → ${flags.until || 'now'}`);

  const sinceMs = Date.parse(`${flags.since}T00:00:00Z`);
  const untilMs = flags.until ? Date.parse(`${flags.until}T23:59:59Z`) : Infinity;

  const agg = {
    window: { since: flags.since, until: flags.until },
    battlesScanned: snap.size,
    swapsInWindow: 0,
    modelSwaps: { total: 0, byMotive: Object.fromEntries(MOTIVES.map(m => [m, 0])), undeclaredNull: 0, legacyAbsent: 0 },
    deterministicSwaps: { total: 0, byExitReason: {}, withNonNullMotive: 0 }, // the F3 pre-flip contamination check
    otherOrUnknownReason: { total: 0, byExitReason: {} },
  };

  for (const doc of snap.docs) {
    const data = doc.data();
    const trades = Array.isArray(data.trades) ? data.trades : [];
    for (const t of trades) {
      const ts = Date.parse(t?.swappedOutAt);
      if (Number.isNaN(ts) || ts < sinceMs || ts > untilMs) continue;
      agg.swapsInWindow += 1;
      const reason = t?.exitReason;
      if (reason === 'haiku_decision') {
        agg.modelSwaps.total += 1;
        if (!('swapMotive' in t)) agg.modelSwaps.legacyAbsent += 1;
        else if (t.swapMotive === null) agg.modelSwaps.undeclaredNull += 1;
        else if (MOTIVES.includes(t.swapMotive)) agg.modelSwaps.byMotive[t.swapMotive] += 1;
        else agg.modelSwaps.byMotive[String(t.swapMotive)] = (agg.modelSwaps.byMotive[String(t.swapMotive)] || 0) + 1;
      } else if (typeof reason === 'string') {
        agg.deterministicSwaps.total += 1;
        agg.deterministicSwaps.byExitReason[reason] = (agg.deterministicSwaps.byExitReason[reason] || 0) + 1;
        if ('swapMotive' in t && t.swapMotive != null) agg.deterministicSwaps.withNonNullMotive += 1;
      } else {
        agg.otherOrUnknownReason.total += 1;
        const key = reason == null ? '(missing)' : String(reason);
        agg.otherOrUnknownReason.byExitReason[key] = (agg.otherOrUnknownReason.byExitReason[key] || 0) + 1;
      }
    }
  }

  const m = agg.modelSwaps;
  const declared = MOTIVES.reduce((a, k) => a + m.byMotive[k], 0);
  console.log('\n================ TIER-1 MOTIVE BASELINE (pre-treatment, R9) ================');
  console.log(`swaps in window: ${agg.swapsInWindow} (model ${m.total} | deterministic ${agg.deterministicSwaps.total} | other ${agg.otherOrUnknownReason.total})`);
  console.log('\nMODEL swaps (exitReason = haiku_decision):');
  for (const k of MOTIVES) console.log(`  ${k.padEnd(18)} ${String(m.byMotive[k]).padStart(5)}  (${pct(m.byMotive[k], m.total)})`);
  // Non-enum motive strings (validator escapes, pre-enum experiments): print
  // them too — an invisible bucket would make the rows silently not sum to
  // the model total, and this pull informs the R9 trigger decision.
  const nonEnum = Object.keys(m.byMotive).filter((k) => !MOTIVES.includes(k));
  for (const k of nonEnum) console.log(`  ${`OFF-ENUM ${k}`.padEnd(18)} ${String(m.byMotive[k]).padStart(5)}  (${pct(m.byMotive[k], m.total)})  ← not a Tier-1 enum value`);
  console.log(`  ${'undeclared (null)'.padEnd(18)} ${String(m.undeclaredNull).padStart(5)}  (${pct(m.undeclaredNull, m.total)})  ← asked, not answered`);
  console.log(`  ${'legacy (absent)'.padEnd(18)} ${String(m.legacyAbsent).padStart(5)}  (${pct(m.legacyAbsent, m.total)})  ← predates Tier 1`);
  console.log(`\n  profit_take attempt rate under the prohibition: ${pct(m.byMotive.profit_take, m.total)} of model swaps (${pct(m.byMotive.profit_take, declared || 1)} of declared)`);
  console.log('\nDETERMINISTIC swaps by reason (no motive by design):');
  for (const [k, v] of Object.entries(agg.deterministicSwaps.byExitReason).sort()) console.log(`  ${k.padEnd(24)} ${v}`);
  console.log(`  stale non-null motive on deterministic swaps (the F3 pre-flip contamination count): ${agg.deterministicSwaps.withNonNullMotive}`);
  if (agg.otherOrUnknownReason.total) {
    console.log('\nOTHER/unknown exitReason rows:');
    for (const [k, v] of Object.entries(agg.otherOrUnknownReason.byExitReason).sort()) console.log(`  ${k.padEnd(24)} ${v}`);
  }

  if (flags.json) {
    writeFileSync(flags.json, JSON.stringify(agg, null, 2) + '\n');
    console.log(`\nJSON written: ${flags.json}`);
  }
}

main().catch((err) => die(err.stack || String(err)));
