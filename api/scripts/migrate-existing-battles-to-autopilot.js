#!/usr/bin/env node
// api/scripts/migrate-existing-battles-to-autopilot.js
// One-time migration: flips active agentBattles from executionMode='copilot'
// (or 'manual') to 'autopilot', and clears any in-flight pendingProposal.
//
// Context:
//   LAUNCH DECISION (2026-05-19) — auto-pilot only. Co-pilot and manual modes
//   are deferred post-launch and their interactive UI is archived. The default
//   for new battles has been changed in agentBattleService.js, but already-
//   running battles still carry executionMode='copilot' and (potentially) a
//   pendingProposal. This script normalizes them.
//
// Behavior:
//   - Only touches battles with status === 'active'. Concluded battles
//     ('completed') are historical records and are left untouched.
//   - Idempotent: battles already at executionMode='autopilot' are skipped.
//   - Clears pendingProposal to null on migrated battles (in-flight proposals
//     are abandoned since the new mode does not use them — the cron's launch
//     guard would clear them anyway on the next tick).
//   - Dry-run by default. Pass --execute to persist writes.
//
// Usage:
//   node --env-file=.env.local api/scripts/migrate-existing-battles-to-autopilot.js
//   node --env-file=.env.local api/scripts/migrate-existing-battles-to-autopilot.js --execute
//
// Requires env:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//
// See AUTHORITY_MODE_DISCOVERY_FINDINGS.md and AUTHORITY_MODE_POST_LAUNCH_BACKLOG.md.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';

const EXECUTE = process.argv.includes('--execute');
const MODE = EXECUTE ? 'EXECUTE' : 'DRY RUN';

async function migrateBattle(doc) {
  const battle = doc.data();
  const battleId = doc.id;
  const currentMode = battle.executionMode || null;
  const hasPendingProposal = battle.pendingProposal != null;

  if (currentMode === 'autopilot' && !hasPendingProposal) {
    return { battleId, skipped: true, reason: 'already autopilot, no pending proposal' };
  }

  const result = {
    battleId,
    ownerId: battle.ownerId || null,
    agentId: battle.agentId || null,
    fromMode: currentMode,
    hadPendingProposal: hasPendingProposal,
    skipped: false,
  };

  if (!EXECUTE) return result;

  const update = {
    executionMode: 'autopilot',
    pendingProposal: null,
    updatedAt: new Date().toISOString(),
  };

  await doc.ref.update(update);
  result.wrote = true;
  return result;
}

async function main() {
  console.log(`[migrate-existing-battles-to-autopilot] Mode: ${MODE}`);
  if (!EXECUTE) {
    console.log('[migrate-existing-battles-to-autopilot] Pass --execute to persist changes.\n');
  }

  const db = getFirebaseAdmin();
  const snap = await db.collection('agentBattles').where('status', '==', 'active').get();

  console.log(`[migrate-existing-battles-to-autopilot] Scanning ${snap.size} active battles...\n`);

  let scanned = 0;
  let migrated = 0;
  let skipped = 0;
  let errored = 0;
  let clearedProposals = 0;
  const fromModeCounts = {};

  for (const doc of snap.docs) {
    scanned += 1;
    try {
      const r = await migrateBattle(doc);
      if (r.skipped) {
        skipped += 1;
        continue;
      }
      migrated += 1;
      fromModeCounts[r.fromMode || '(unset)'] = (fromModeCounts[r.fromMode || '(unset)'] || 0) + 1;
      if (r.hadPendingProposal) clearedProposals += 1;

      const verb = EXECUTE ? 'migrated' : 'would migrate';
      const proposalNote = r.hadPendingProposal ? ' (had pending proposal — cleared)' : '';
      console.log(
        `  [${r.battleId}] owner=${r.ownerId || '(unknown)'} agent=${r.agentId || '(unknown)'} ` +
        `— ${verb} from '${r.fromMode || '(unset)'}' → 'autopilot'${proposalNote}`
      );
    } catch (err) {
      errored += 1;
      console.error(`  [${doc.id}] ERROR: ${err.message}`);
    }
  }

  console.log('\n[migrate-existing-battles-to-autopilot] Summary');
  console.log(`  Mode:                       ${MODE}`);
  console.log(`  Battles scanned:            ${scanned}`);
  console.log(`  Battles migrated:           ${migrated}${EXECUTE ? '' : ' (would migrate)'}`);
  console.log(`  Battles skipped:            ${skipped} (already autopilot, no pending proposal)`);
  console.log(`  Battles errored:            ${errored}`);
  console.log(`  Pending proposals cleared:  ${clearedProposals}${EXECUTE ? '' : ' (would clear)'}`);
  if (Object.keys(fromModeCounts).length > 0) {
    console.log(`  From-mode breakdown:`);
    for (const [mode, count] of Object.entries(fromModeCounts)) {
      console.log(`    ${mode.padEnd(12)} → ${count}`);
    }
  }

  if (!EXECUTE) {
    console.log('\n[migrate-existing-battles-to-autopilot] Dry run complete. Re-run with --execute to persist.');
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('[migrate-existing-battles-to-autopilot] Fatal:', err);
    process.exit(1);
  }
);
