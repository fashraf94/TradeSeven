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
//   node scripts/composition/migration-scan.js --apply --yes    # LIVE overlay write (founder-gated; open epoch)
//   node scripts/composition/migration-scan.js --apply --yes --during-close
//     # Sol review #5: the RUNBOOK STEP-3 form — the candidate-namespace
//     # apply EXPLICITLY AUTHORIZED while the live epoch is CLOSED (the
//     # post-watermark freeze). A dedicated inverse guard
//     # (assertClosedEpochCandidateWindow) replaces the open-epoch check;
//     # the general guard is untouched. Every write is path-asserted into
//     # compositionCandidateState/* — live/base/protected stores are
//     # structurally out of the write set AND belt-checked at runtime.
//
// Requires Firestore Admin credentials (FIREBASE_PROJECT_ID + service account
// env) — the report is written to scripts/composition/out/ and, at apply time,
// belongs in docs/audits/ per B4 (the apply output is a post-deployment audit
// artifact, never pre-committed).

// MUST be imported before firebaseAdmin.js — loads .env.local as a side effect
// and turns a missing credential into a one-line instruction instead of
// firebase-admin's opaque app/invalid-credential stack (its stated purpose;
// the lifecycle-void-precheck precedent).
import { requireFirebaseCreds } from '../loadLocalEnv.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFirebaseAdmin } from '../../api/_utils/firebaseAdmin.js';
import { planAgentMigration, scanResidualsAfterPlan } from '../../api/_utils/compositionMigration.js';
import { computeOverlayRunHash, computeOverlaySemanticHash, entryDocId } from '../../api/_utils/compositionStateResolver.js';
import { buildIdentityMigrationFeedEntries } from '../../api/_utils/identityMigrationFeed.js';
import { assertWriteEpochOpen, assertClosedEpochCandidateWindow } from '../../api/_utils/compositionWriteEpoch.js';
import { ARCHETYPE_IDENTITY_VERSION } from '../../api/_utils/archetypeVersionConstants.js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const YES = args.includes('--yes');
const DURING_CLOSE = args.includes('--during-close'); // Sol #5: the runbook step-3 closed-epoch authorization
const ONE_AGENT = args.includes('--agent') ? args[args.indexOf('--agent') + 1] : null;

// Explicit replacementMaps for enum narrowings (M4): founder-authored per
// param. FOUNDER RULING (Aug 6, 2026, D1 ratification): stays EMPTY — the 4
// enum narrowings in the ratified dry-run population (6 house/training agents)
// unequip per M4's reject-and-unequip arm; authoring replacement maps for dev
// agents is not worth the adjudication.
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
  // Fail with a one-line instruction rather than firebase-admin's opaque
  // `app/invalid-credential` stack trace (founder fold-in item 2).
  requireFirebaseCreds();
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
    // bounded conformance: the epoch guard runs per agent iteration (design §3).
    // #5: --during-close swaps in the INVERSE assertion (closed window), never a bypass.
    if (DURING_CLOSE) await assertClosedEpochCandidateWindow(db);
    else await assertWriteEpochOpen(db, { enabled: true }); // review P5: the migration ALWAYS checks, flag-independent
    const records = await fetchAgentRecords(db, agentDoc);
    if (!records.agent.archetype) continue;
    scanned += 1;
    const { entries, reports } = planAgentMigration({ ...records, replacementMaps: REPLACEMENT_MAPS, migrationRunId: runId });
    if (entries.length || reports.length) {
      perAgent.push({ agentId: agentDoc.id, archetype: records.agent.archetype, entries: entries.length, reports });
      allEntries.push(...entries);
      allReports.push(...reports);

      // A10 pre-verification: the resolved view must scan clean — through the
      // SHARED helper (founder fold-in item 1: the first dry-run rebuilt this
      // inline with raw pre-overlay ruleDocs, so its 9 residuals were phantoms
      // mapping 1:1 to planner entries; the battery now guards the helper).
      const residuals = scanResidualsAfterPlan({ ...records, entries });
      if (residuals.length) perAgent[perAgent.length - 1].RESIDUALS_AFTER_PLAN = residuals;
    }
  }

  // M12 hash split: semanticHash is runId-independent (two dry-runs over the
  // same fleet agree; the founder's pre-apply check), runHash pins this run.
  const semanticHash = computeOverlaySemanticHash(allEntries);
  const runHash = computeOverlayRunHash(allEntries);
  const overlayContentHash = runHash; // the §2 field name of record (= runHash)
  const affectedAgents = perAgent.filter((a) => a.entries > 0);
  const summary = {
    runId, mode: APPLY ? 'apply' : 'dry-run',
    scannedAgents: scanned,
    affectedAgents: affectedAgents.length,
    overlayEntries: allEntries.length,
    byAction: allEntries.reduce((m, e) => ((m[e.action] = (m[e.action] || 0) + 1), m), {}),
    reportClasses: allReports.reduce((m, r) => ((m[r.class] = (m[r.class] || 0) + 1), m), {}),
    overlayContentHash, semanticHash, runHash,
    activeIdentityVersion: ARCHETYPE_IDENTITY_VERSION + 1, // renamed from identityVersionTarget (B4 alignment, founder-confirmed clean rename)
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
  if (DURING_CLOSE) await assertClosedEpochCandidateWindow(db); // #5: the closed-window claim re-verified at the final pre-write check
  else await assertWriteEpochOpen(db, { enabled: true }); // review P5: the migration ALWAYS checks, flag-independent // final pre-write check
  const runRef = db.collection('compositionCandidateState').doc(runId);
  // #5 belt: every apply write must land in the candidate namespace — a
  // future edit that widens the write set fails LOUD here, not in review.
  const assertCandidatePath = (ref) => {
    if (!String(ref.path).startsWith('compositionCandidateState/')) {
      throw new Error(`apply write outside the candidate namespace: ${ref.path}`);
    }
  };
  const feedEntries = buildIdentityMigrationFeedEntries(allEntries, {
    nowIso: new Date().toISOString(), migrationRunId: runId,
  });
  // entries FIRST, run doc LAST — the run doc is the completion sentinel
  // (review P6, the trainingClone sentinel-order precedent): an interrupted
  // apply leaves entries without a run doc, never a run doc overstating them.
  for (let i = 0; i < allEntries.length; i += 400) {
    const batch = db.batch();
    for (const e of allEntries.slice(i, i + 400)) {
      const entryRef = runRef.collection('entries').doc(entryDocId(e.entryKey));
      assertCandidatePath(entryRef);
      batch.set(entryRef, e); // M12: injective base64url id
    }
    await batch.commit();
  }
  assertCandidatePath(runRef);
  await runRef.set({
    migrationRunId: runId, candidateStateId: runId,
    activeIdentityVersion: summary.activeIdentityVersion,
    overlayContentHash, semanticHash, runHash, entryCount: allEntries.length,
    createdAt: new Date().toISOString(), feedEntries,
  });
  console.log(`\nAPPLIED: ${allEntries.length} overlay entries → compositionCandidateState/${runId} (base records untouched).`);
}

main().catch((err) => { console.error('scan failed:', err); process.exit(1); });
