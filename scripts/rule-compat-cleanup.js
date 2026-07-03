// scripts/rule-compat-cleanup.js
//
// WS1 Phase 4 — the ONE-TIME pre-launch rule-compat cleanup (Flash decision:
// demote hard core_conflict rules to soft, reversible record kept — never
// delete). All decisions live in the PURE core (api/_utils/ruleCompatCleanup.js,
// fixture-tested); this runner only fetches, executes the plan, and reports.
//
// USAGE (from project root):
//   node scripts/rule-compat-cleanup.js                  # DRY-RUN (default): scan + report, ZERO writes
//   node scripts/rule-compat-cleanup.js --agent <id>     # dry-run one agent
//   node scripts/rule-compat-cleanup.js --out <path>     # report file path (default ./compat-cleanup-report-<runId>.json)
//   node scripts/rule-compat-cleanup.js --live --yes     # LIVE run — Flash's command only (spec §7); --yes is required
//
// ENV: FIREBASE_ADMIN_CREDENTIALS in .env.local (the seed-discover-themes.js
// convention). Reads are needed in BOTH modes, so admin init always runs.
//
// SCOPE + SAFETY (spec §7 + the Phase 4 GO additions):
//   * Scans ALL agents — training clones INCLUDED (isTrainingClone). Skips-and-
//     reports: agents with an active battle; clones whose tournament group is
//     in status 'battle'; agents with no archetype.
//   * Never touches battle.* documents (frozen snapshots are score-of-record).
//   * Soft core_conflict rules are UNTOUCHED — counted in the census only.
//   * Idempotent: a re-run over already-demoted state plans zero writes.
//   * Live mode: every write is recorded to compatCleanupLog/{runId} (summary)
//     + its `entries` subcollection (one reversal record per action), AND the
//     JSON report file is written in both modes.
//   * activeRules is re-derived through the EXISTING projection
//     (projectActiveRules) after each agent's writes — never hand-edited.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { analyzeAgentCompat, buildCleanupReport, SEEDED_TRAIT_FIX } from '../api/_utils/ruleCompatCleanup.js';
import { projectActiveRules } from '../api/_utils/projectActiveRules.js';
import { buildSeedPlan } from '../src/data/traitEquip.js';
import { GROUP_STATUS, TOURNAMENT_GROUPS_COLLECTION } from '../src/constants/leagueTournament.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');

function die(msg) {
  console.error(`\nFATAL: ${msg}`);
  process.exit(1);
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function parseArgs(argv) {
  const flags = { live: false, yes: false, agent: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') flags.live = true;
    else if (a === '--yes') flags.yes = true;
    else if (a === '--agent') flags.agent = argv[++i];
    else if (a === '--out') flags.out = argv[++i];
    else die(`Unknown flag: ${a}`);
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv);
  const mode = flags.live ? 'live' : 'dry-run';
  if (flags.live && !flags.yes) {
    die("--live requires --yes. The live run is Flash's command only (WS1 spec §7); the dry-run is the default.");
  }

  const nowIso = new Date().toISOString();
  const runId = `compat-cleanup-${nowIso.replace(/[:.]/g, '-')}`;
  console.log(`\n[rule-compat-cleanup] mode=${mode} runId=${runId}`);

  // ── firebase-admin (reads are needed in both modes) ──
  const env = parseEnvFile(path.join(PROJECT_ROOT, '.env.local'));
  const creds = env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!creds) die('FIREBASE_ADMIN_CREDENTIALS not found in .env.local or the environment');
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(creds);
  } catch (err) {
    die(`FIREBASE_ADMIN_CREDENTIALS is not valid JSON: ${err.message}`);
  }
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  console.log(`firebase-admin initialized for project: ${serviceAccount.project_id}`);

  // ── fetch agents (clones included) + their subcollections ──
  const agentsSnap = flags.agent
    ? await db.collection('agents').doc(flags.agent).get().then((d) => ({ docs: d.exists ? [d] : [] }))
    : await db.collection('agents').get();
  console.log(`agents fetched: ${agentsSnap.docs.length}`);

  // Clone group statuses (one read per distinct group).
  const cloneGroupIds = [...new Set(
    agentsSnap.docs.map((d) => d.data()).filter((a) => a.isTrainingClone === true && a.groupId).map((a) => a.groupId)
  )];
  const groupStatusById = {};
  for (const gid of cloneGroupIds) {
    const g = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(gid).get();
    groupStatusById[gid] = g.exists ? g.data().status || null : null;
  }
  if (cloneGroupIds.length) {
    console.log(`training-clone groups checked: ${cloneGroupIds.length} (active battles: ${Object.values(groupStatusById).filter((s) => s === GROUP_STATUS.BATTLE).length})`);
  }

  // ── analyze (pure core) ──
  const analyses = [];
  for (const agentDoc of agentsSnap.docs) {
    const agent = { id: agentDoc.id, ...agentDoc.data() };
    const [rulesSnap, bundlesSnap] = await Promise.all([
      agentDoc.ref.collection('rules').get(),
      agentDoc.ref.collection('bundles').get(),
    ]);
    const ruleDocs = rulesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const bundleDocs = bundlesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    analyses.push({
      analysis: analyzeAgentCompat({ agent, ruleDocs, bundleDocs, groupStatusById }),
      agentRef: agentDoc.ref,
      agent,
    });
  }

  const report = buildCleanupReport({
    analyses: analyses.map((a) => a.analysis),
    runId,
    mode,
    generatedAt: nowIso,
  });

  // ── live execution (Flash's command only) ──
  if (flags.live) {
    const logRunRef = db.collection('compatCleanupLog').doc(runId);
    await logRunRef.set({ runId, startedAt: nowIso, mode: 'live', status: 'running', totals: report.totals });
    let entrySeq = 0;
    const logEntry = async (payload) => {
      entrySeq += 1;
      await logRunRef.collection('entries').doc(String(entrySeq).padStart(5, '0')).set({
        ...payload, scriptRunId: runId, appliedAt: new Date().toISOString(),
      });
    };

    for (const { analysis, agentRef, agent } of analyses) {
      const writeOps = analysis.plan.filter((op) => op.op !== 'report_only_trait_conflict');
      if (analysis.skipped || writeOps.length === 0) continue;
      console.log(`\n[live] ${analysis.agentId} (${analysis.archetype}) — ${writeOps.length} op(s)`);

      for (const op of writeOps) {
        if (op.op === 'demote_bundle_override') {
          await agentRef.collection('bundles').doc(op.bundleId).update({
            [`ruleHardness.${op.ruleDocId}`]: op.action === 'delete' ? FieldValue.delete() : 'soft',
            updatedAt: new Date().toISOString(),
          });
          await logEntry({ agentId: analysis.agentId, ...op, previousHardness: op.previousValue });
        } else if (op.op === 'swap_seeded_trait') {
          // The §3 seed fix, in the reseed-safe order: create the replacement
          // trait's docs → swap the trait layer → soft-delete the old docs.
          const { ruleSpecs, equippedTraits: newEntries } = buildSeedPlan([op.addTraitId], 'moderate');
          const createdIds = [];
          for (const spec of ruleSpecs) {
            const ref = await agentRef.collection('rules').add({
              ...spec,
              visibility: 'private', isRefined: false, isDeleted: false, bundleIds: [],
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            });
            createdIds.push(ref.id);
          }
          const keptEntries = (agent.equippedTraits || []).filter((t) => t && t.traitId !== op.removeTraitId);
          await agentRef.update({ equippedTraits: [...keptEntries, ...newEntries], updatedAt: new Date().toISOString() });
          for (const docId of op.softDeleteRuleDocIds) {
            await agentRef.collection('rules').doc(docId).update({ isDeleted: true, updatedAt: new Date().toISOString() });
          }
          await logEntry({ agentId: analysis.agentId, ...op, createdRuleDocIds: createdIds });
        } else if (op.op === 'reproject_active_rules') {
          // Re-derive through the EXISTING projection from FRESH post-write docs.
          const [rulesSnap, bundlesSnap, agentSnap] = await Promise.all([
            agentRef.collection('rules').get(),
            agentRef.collection('bundles').get(),
            agentRef.get(),
          ]);
          const projected = projectActiveRules(
            agentSnap.data().equippedTraits || [],
            rulesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
            bundlesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          );
          await agentRef.update({ activeRules: projected, updatedAt: new Date().toISOString() });
          await logEntry({ agentId: analysis.agentId, op: 'reproject_active_rules', ruleCount: projected.length });
        }
      }
    }
    await logRunRef.update({ status: 'complete', completedAt: new Date().toISOString(), entryCount: entrySeq });
    console.log(`\n[live] complete — ${entrySeq} reversal record(s) under compatCleanupLog/${runId}/entries`);
  }

  // ── report file (both modes) ──
  const outPath = flags.out || path.join(process.cwd(), `compat-cleanup-report-${runId}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n[report] ${outPath}`);
  console.log(JSON.stringify({ totals: report.totals, census: report.census }, null, 2));
  if (mode === 'dry-run') {
    console.log('\nDRY-RUN complete — zero writes performed. Live run: --live --yes (Flash only, spec §7).');
  }
  // Sanity echo of the sanctioned trait fix so a live reviewer sees it.
  console.log(`\nseeded-trait fix in effect: ${SEEDED_TRAIT_FIX.archetype}: ${SEEDED_TRAIT_FIX.removeTraitId} → ${SEEDED_TRAIT_FIX.addTraitId}`);
}

main().catch((err) => die(err.stack || err.message));
