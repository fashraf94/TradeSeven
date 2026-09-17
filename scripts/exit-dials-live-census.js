// scripts/exit-dials-live-census.js
//
// Exit Dials Discovery V1 — Q5 READ-ONLY live-data census.
//
// Answers three questions the repo cannot answer:
//   A. Does any agent carry a persisted profitTarget / stopLoss in
//      deployedStrategy.guardrails? (i.e. deployed while the SeasonReview →
//      DeployToAgent → deployStrategyService path was still reachable)
//   B. Does any BATTLE carry those guardrails in its frozen
//      agentContext.deployedGuardrails snapshot? (that array, not the agent
//      doc, is what applyGuardrails actually fires on —
//      api/_utils/agentGuardrails.js:191, agentBattleService.js:190)
//   C. Has either executor ALREADY FIRED? Counts trades stamped
//      exitReason 'guardrail_profitTarget' / 'guardrail_stopLoss' /
//      'guardrail_trailingStop' (the closed enum at
//      api/_utils/learning/learningEnums.js:35-46).
//
// This closes the discovery's open caveat: if (A) or (B) is non-empty, the
// profit-target executor may already have had live input, and "zero
// profit-takes" has a second contributing cause beyond the orphaned writer.
//
// STRICTLY READ-ONLY: only .get() calls plus a local JSON report. Performs no
// Firestore writes and imports no writer.
//
// Needs the same creds as the serverless functions — FIREBASE_PROJECT_ID /
// FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY. Locally those come from
// .env.local in the repo root, loaded by ./loadLocalEnv.js (see that file for
// the exact .env.local format). This is the convention .env.example:40-42
// documents and the one api/_utils/firebaseAdmin.js:15-17 consumes; the
// FIREBASE_ADMIN_CREDENTIALS single-JSON-blob form used by some older scripts
// in this folder is deliberately NOT a second path here.
//
// USAGE (from the repo root):
//   node scripts/exit-dials-live-census.js
//   node scripts/exit-dials-live-census.js --out /tmp/exit-dials-census.json
//   node scripts/exit-dials-live-census.js --battle-limit 2000
//
// EXIT CODES: 0 ok · 4 credentials not ready (from requireFirebaseCreds) ·
//             1 unexpected failure.

// MUST be imported before firebaseAdmin.js — loads .env.local as a side effect.
import { requireFirebaseCreds, PROJECT_ROOT } from './loadLocalEnv.js';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';

import { writeFileSync } from 'node:fs';
import path from 'node:path';

const WATCHED_TYPES = ['profitTarget', 'stopLoss', 'trailingStop', 'maxSectorWeight', 'maxPosition'];
const WATCHED_EXIT_REASONS = ['guardrail_profitTarget', 'guardrail_stopLoss', 'guardrail_trailingStop'];

function die(msg) { console.error(`\nFATAL: ${msg}`); process.exit(1); }

// Fail with a one-line instruction rather than firebase-admin's opaque
// `app/invalid-credential` stack trace. Exits 4; never prints secret values.
requireFirebaseCreds();

/** Index a guardrails array the way applyGuardrails does: byType, keep-LAST. */
function indexByType(arr) {
  const byType = {};
  if (!Array.isArray(arr)) return byType;
  for (const g of arr) {
    if (g && typeof g.type === 'string') byType[g.type] = g;
  }
  return byType;
}

function summarizeGuardrails(arr) {
  const byType = indexByType(arr);
  const out = {};
  for (const t of WATCHED_TYPES) {
    if (byType[t]) {
      out[t] = {
        value: byType[t].value ?? null,
        unit: byType[t].unit ?? null,
        enforcement: byType[t].enforcement ?? null,
      };
    }
  }
  return {
    total: Array.isArray(arr) ? arr.length : 0,
    duplicateTypes: Array.isArray(arr)
      ? arr.map((g) => g?.type).filter((t, i, a) => t && a.indexOf(t) !== i)
      : [],
    watched: out,
  };
}

async function main() {
  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx > -1 ? process.argv[outIdx + 1]
    : path.join(PROJECT_ROOT, 'exit-dials-live-census-report.json');
  const limIdx = process.argv.indexOf('--battle-limit');
  const battleLimit = limIdx > -1 ? Number(process.argv[limIdx + 1]) : 0; // 0 = all

  const db = getFirebaseAdmin();

  // ── A. agents ─────────────────────────────────────────────────────────
  const agentsSnap = await db.collection('agents').get(); // READ-ONLY
  const agentStats = {
    scanned: 0,
    withDeployedStrategy: 0,
    withAnyGuardrail: 0,
    withProfitTarget: 0,
    withStopLoss: 0,
    withTrailingStop: 0,
  };
  const agentHits = [];

  for (const d of agentsSnap.docs) {
    const a = d.data();
    agentStats.scanned += 1;
    const ds = a.deployedStrategy;
    if (!ds) continue;
    agentStats.withDeployedStrategy += 1;
    const g = Array.isArray(ds.guardrails) ? ds.guardrails : [];
    if (g.length === 0) continue;
    agentStats.withAnyGuardrail += 1;
    const sum = summarizeGuardrails(g);
    if (sum.watched.profitTarget) agentStats.withProfitTarget += 1;
    if (sum.watched.stopLoss) agentStats.withStopLoss += 1;
    if (sum.watched.trailingStop) agentStats.withTrailingStop += 1;
    if (sum.watched.profitTarget || sum.watched.stopLoss || sum.watched.trailingStop) {
      agentHits.push({
        agentId: d.id,
        ownerId: a.ownerId ?? null,
        archetype: a.archetype ?? null,
        activeBattleId: a.activeBattleId ?? null,
        settingsRev: a.settingsRev ?? null,
        deployedAt: ds.deployedAt ?? null,
        strategyLastDeployedAt: a.strategyLastDeployedAt ?? null,
        schemaVersion: ds.schemaVersion ?? null,
        experimentId: ds.experimentId ?? null,
        sourceCollection: ds.sourceCollection ?? null,
        guardrails: sum,
      });
    }
  }

  // ── B + C. agentBattles ───────────────────────────────────────────────
  let battlesQuery = db.collection('agentBattles');
  if (battleLimit > 0) battlesQuery = battlesQuery.limit(battleLimit);
  const battlesSnap = await battlesQuery.get(); // READ-ONLY

  const battleStats = {
    scanned: 0,
    withFrozenGuardrails: 0,
    withProfitTarget: 0,
    withStopLoss: 0,
    withTrailingStop: 0,
    tradesScanned: 0,
  };
  const exitReasonCounts = {};
  const battleHits = [];
  const firedSamples = [];

  for (const d of battlesSnap.docs) {
    const b = d.data();
    battleStats.scanned += 1;

    const frozen = b.agentContext?.deployedGuardrails;
    const sum = summarizeGuardrails(frozen);
    const hasWatched = sum.watched.profitTarget || sum.watched.stopLoss || sum.watched.trailingStop;
    if (Array.isArray(frozen) && frozen.length > 0) {
      battleStats.withFrozenGuardrails += 1;
      if (sum.watched.profitTarget) battleStats.withProfitTarget += 1;
      if (sum.watched.stopLoss) battleStats.withStopLoss += 1;
      if (sum.watched.trailingStop) battleStats.withTrailingStop += 1;
    }

    // C. exitReason tally over trades[] (the top-level stamp — agentRiskManager.js:494).
    const trades = Array.isArray(b.trades) ? b.trades : [];
    battleStats.tradesScanned += trades.length;
    let watchedFiresHere = 0;
    for (const t of trades) {
      const reason = t?.exitReason || '(none)';
      exitReasonCounts[reason] = (exitReasonCounts[reason] || 0) + 1;
      if (WATCHED_EXIT_REASONS.includes(reason)) {
        watchedFiresHere += 1;
        if (firedSamples.length < 50) {
          firedSamples.push({
            battleId: d.id,
            agentId: b.agentId ?? null,
            gameMode: b.gameMode ?? null,
            status: b.status ?? null,
            exitReason: reason,
            symbolOut: t.symbolOut ?? null,
            symbolIn: t.symbolIn ?? null,
            timestamp: t.timestamp ?? null,
            frozenTargetPct: sum.watched.profitTarget?.value ?? null,
            frozenStopPct: sum.watched.stopLoss?.value ?? null,
          });
        }
      }
    }

    if (hasWatched || watchedFiresHere > 0) {
      battleHits.push({
        battleId: d.id,
        agentId: b.agentId ?? null,
        ownerId: b.ownerId ?? null,
        gameMode: b.gameMode ?? null,
        status: b.status ?? null,
        createdAt: b.createdAt ?? null,
        completedAt: b.completedAt ?? null,
        archetype: b.agentContext?.archetype ?? null,
        frozenGuardrails: sum,
        watchedGuardrailFires: watchedFiresHere,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    question: 'Exit Dials Discovery V1 — Q5 (persisted profitTarget / stopLoss + executor fires)',
    agents: { ...agentStats, hits: agentHits },
    battles: { ...battleStats, exitReasonCounts, hits: battleHits, firedSamples },
    verdict: {
      anyAgentCarriesProfitTarget: agentStats.withProfitTarget > 0,
      anyAgentCarriesStopLoss: agentStats.withStopLoss > 0,
      anyBattleFrozeProfitTarget: battleStats.withProfitTarget > 0,
      anyBattleFrozeStopLoss: battleStats.withStopLoss > 0,
      profitTargetExecutorHasFired: (exitReasonCounts.guardrail_profitTarget || 0) > 0,
      stopLossExecutorHasFired: (exitReasonCounts.guardrail_stopLoss || 0) > 0,
      trailingStopExecutorHasFired: (exitReasonCounts.guardrail_trailingStop || 0) > 0,
    },
  };

  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('\n===== EXIT DIALS — LIVE CENSUS (READ-ONLY) =====\n');
  console.log('AGENTS');
  console.log(`  scanned ................... ${agentStats.scanned}`);
  console.log(`  with deployedStrategy ..... ${agentStats.withDeployedStrategy}`);
  console.log(`  with >=1 guardrail ........ ${agentStats.withAnyGuardrail}`);
  console.log(`  carrying profitTarget ..... ${agentStats.withProfitTarget}`);
  console.log(`  carrying stopLoss ......... ${agentStats.withStopLoss}`);
  console.log(`  carrying trailingStop ..... ${agentStats.withTrailingStop}`);
  console.log('\nBATTLES');
  console.log(`  scanned ................... ${battleStats.scanned}`);
  console.log(`  with frozen guardrails .... ${battleStats.withFrozenGuardrails}`);
  console.log(`  froze profitTarget ........ ${battleStats.withProfitTarget}`);
  console.log(`  froze stopLoss ............ ${battleStats.withStopLoss}`);
  console.log(`  froze trailingStop ........ ${battleStats.withTrailingStop}`);
  console.log(`  trades scanned ............ ${battleStats.tradesScanned}`);
  console.log('\nEXIT REASON TALLY (all trades)');
  for (const [k, v] of Object.entries(exitReasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(28)} ${v}`);
  }
  console.log('\nVERDICT');
  for (const [k, v] of Object.entries(report.verdict)) {
    console.log(`  ${k.padEnd(34)} ${v ? 'YES' : 'no'}`);
  }
  console.log(`\nFull report → ${outPath}\n`);
}

main().catch((err) => die(err?.stack || err?.message || String(err)));
