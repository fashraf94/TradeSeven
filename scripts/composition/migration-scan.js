#!/usr/bin/env node
// scripts/composition/migration-scan.js
//
// Composition PR 2 — the §6 migration scanner/runner (Method B). DRY-RUN BY
// DEFAULT: reads every agent's rule-config stores, runs the PURE planner
// (api/_utils/compositionMigration.js — the same planner --apply uses, so
// dry-run selection == apply selection by construction, A8), and reports the
// affected-record count. NOTHING is written without --apply --yes, and even
// then ONLY the candidate namespace (compositionCandidateState/{runId} +
// entries — design note §2); no base record, agent doc, or battle doc is ever
// in the write set (A12/A36).
//
//   node scripts/composition/migration-scan.js                  # dry-run, full fleet
//   node scripts/composition/migration-scan.js --agent <id>     # dry-run one agent
//   node scripts/composition/migration-scan.js --apply --yes    # LIVE overlay write (founder-gated)
//
// Requires Firestore Admin credentials (FIREBASE_PROJECT_ID + service account
// env) — the report is written to scripts/composition/out/ and, at apply time,
// belongs in docs/audits/ per B4 (the apply output is a post-deployment audit
// artifact, never pre-committed).

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFirebaseAdmin } from '../../api/_utils/firebaseAdmin.js';
import { planAgentMigration, scanAgentForResiduals } from '../../api/_utils/compositionMigration.js';
import { resolveEffectiveConfig, computeOverlayContentHash } from '../../api/_utils/compositionStateResolver.js';
import { buildIdentityMigrationFeedEntries } from '../../api/_utils/identityMigrationFeed.js';
import { assertWriteEpochOpen } from '../../api/_utils/compositionWriteEpoch.js';
import { ARCHETYPE_IDENTITY_VERSION } from '../../api/_utils/archetypeVersionConstants.js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const YES = args.includes('--yes');
const ONE_AGENT = args.includes('--agent') ? args[args.indexOf('--agent') + 1] : null;

// Explicit replacementMaps for enum narrowings (M4): founder-authored per
// param; empty today — enums with >1 admitted value therefore classify
// reject-and-unequip, and the dry-run report shows exactly which.
const REPLACEMENT_MAPS = {};

async function fetchAgentRecords(db, agentDoc) {
  const agentRef = agentDoc.ref;
  const [rulesSnap, bundlesSnap] = await Promise.all([
    agentRef.collection('rules').get(),
    agentRef.collection('bundles').get(),
  ]);
  return {
    agent: { id: agentDoc.id, docPath: agentRef.path, ...agentDoc.data() },
    ruleDocs: rulesSnap.docs.map((d) => ({ id: d.id, docPath: d.ref.path, ...d.data() })),
    bundles: bundlesSnap.docs.map((d) => ({ id: d.id, docPath: d.ref.path, ...d.data() })),
  };
}

async function main() {
  const db = getFirebaseAdmin();
  const runId = `composition-migration-${new Date().toISOString().replace(/[:.]/g, '-')}`;

  const agentsSnap = ONE_AGENT
    ? [await db.collection('agents').doc(ONE_AGENT).get()].filter((d) => d.exists)
    : (await db.collection('agents').get()).docs;

  const allEntries = [];
  const allReports = [];
  const perAgent = [];
  let scanned = 0;

  for (const agentDoc of agentsSnap) {
    // bounded conformance: the epoch guard runs per agent iteration (design §3)
    await assertWriteEpochOpen(db, { enabled: true }); // review P5: the migration ALWAYS checks, flag-independent
    const records = await fetchAgentRecords(db, agentDoc);
    if (!records.agent.archetype) continue;
    scanned += 1;
    const { entries, reports } = planAgentMigration({ ...records, replacementMaps: REPLACEMENT_MAPS, migrationRunId: runId });
    if (entries.length || reports.length) {
      perAgent.push({ agentId: agentDoc.id, archetype: records.agent.archetype, entries: entries.length, reports });
      allEntries.push(...entries);
      allReports.push(...reports);

      // A10 pre-verification: the resolved view must scan clean.
      const baseDocs = { [records.agent.docPath]: records.agent };
      for (const b of records.bundles) baseDocs[b.docPath] = b;
      for (const r of records.ruleDocs) baseDocs[r.docPath] = r;
      const { effectiveDocs } = resolveEffectiveConfig({ baseDocs, overlayEntries: entries });
      const resolvedAgent = effectiveDocs[records.agent.docPath];
      const resolvedBundles = records.bundles.map((b) => effectiveDocs[b.docPath]);
      const residuals = scanAgentForResiduals({ agent: resolvedAgent, ruleDocs: records.ruleDocs, bundles: resolvedBundles });
      if (residuals.length) perAgent[perAgent.length - 1].RESIDUALS_AFTER_PLAN = residuals;
    }
  }

  const overlayContentHash = computeOverlayContentHash(allEntries);
  const affectedAgents = perAgent.filter((a) => a.entries > 0);
  const summary = {
    runId, mode: APPLY ? 'apply' : 'dry-run',
    scannedAgents: scanned,
    affectedAgents: affectedAgents.length,
    overlayEntries: allEntries.length,
    byAction: allEntries.reduce((m, e) => ((m[e.action] = (m[e.action] || 0) + 1), m), {}),
    reportClasses: allReports.reduce((m, r) => ((m[r.class] = (m[r.class] || 0) + 1), m), {}),
    overlayContentHash,
    identityVersionTarget: ARCHETYPE_IDENTITY_VERSION + 1,
  };

  const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
  mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, `${runId}.json`);
  writeFileSync(reportPath, JSON.stringify({ summary, perAgent, entries: allEntries, reports: allReports }, null, 2));

  console.log('\n=== COMPOSITION MIGRATION SCAN ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`report: ${reportPath}`);

  if (!APPLY) return;
  if (!YES) { console.error('\n--apply requires --yes (founder-gated).'); process.exit(2); }

  // ── APPLY: candidate namespace ONLY (Method B) ───────────────────────────
  await assertWriteEpochOpen(db, { enabled: true }); // review P5: the migration ALWAYS checks, flag-independent // final pre-write check
  const runRef = db.collection('compositionCandidateState').doc(runId);
  const feedEntries = buildIdentityMigrationFeedEntries(allEntries, {
    nowIso: new Date().toISOString(), migrationRunId: runId,
  });
  // entries FIRST, run doc LAST — the run doc is the completion sentinel
  // (review P6, the trainingClone sentinel-order precedent): an interrupted
  // apply leaves entries without a run doc, never a run doc overstating them.
  for (let i = 0; i < allEntries.length; i += 400) {
    const batch = db.batch();
    for (const e of allEntries.slice(i, i + 400)) {
      batch.set(runRef.collection('entries').doc(e.entryKey.replace(/\//g, '~')), e);
    }
    await batch.commit();
  }
  await runRef.set({
    migrationRunId: runId, candidateStateId: runId,
    identityVersionTarget: summary.identityVersionTarget,
    overlayContentHash, entryCount: allEntries.length,
    createdAt: new Date().toISOString(), feedEntries,
  });
  console.log(`\nAPPLIED: ${allEntries.length} overlay entries → compositionCandidateState/${runId} (base records untouched).`);
}

main().catch((err) => { console.error('scan failed:', err); process.exit(1); });
