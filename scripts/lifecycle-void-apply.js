// scripts/lifecycle-void-apply.js
//
// L-A VOID APPLICATION (MUTATING - one-off, founder-executed AFTER the pre-check
// + explicit approval). Voids ONE poisoned/zombie BATTLE group via the tested
// voidGroup primitive. It does NOT sweep - it touches exactly the one group id
// you pass. NON-destructive: only the status flips to 'voided' + markers are
// written; the per-day dailyScores (incl. the true Day-5 snapshot) are untouched.
//
// SAFETY:
//   - Requires --confirm; without it, it DRY-RUNS (prints intent, writes nothing).
//   - Requires --expectedUpdatedAt='<value>' copied from the pre-check output.
//     This is voidGroup's MANDATORY optimistic-lock pin: if the group moved since
//     the pre-check, voidGroup SKIPS (no stale mutation).
//   - expectedStatus defaults to 'battle' (override with --expectedStatus=).
//
// Needs the serverless creds (FIREBASE_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY).
// Locally those come from .env.local in the repo root, loaded by
// ./loadLocalEnv.js. From the repo root:
//   node scripts/lifecycle-void-apply.js <groupId> --expectedUpdatedAt='<iso>' --confirm

// MUST be imported before firebaseAdmin.js — loads .env.local as a side effect.
import { requireFirebaseCreds } from './loadLocalEnv.js';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';
import { voidGroup } from '../api/_utils/tournamentGroupService.js';

function argVal(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return null;
  // Strip one layer of MATCHED surrounding quotes, defensively — a value pasted
  // verbatim from the pre-check must pin cleanly whether or not it carried quotes
  // (guards the "quoted value -> always version_changed" foot-gun).
  return hit.slice(prefix.length).replace(/^(['"])([\s\S]*)\1$/, '$2');
}
const groupId = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const confirm = process.argv.includes('--confirm');
const expectedUpdatedAt = argVal('expectedUpdatedAt');
const expectedStatus = argVal('expectedStatus') || 'battle';
const reason = argVal('reason') || 'poisoned_cohort_l_a';
const by = argVal('by') || 'founder_manual';

if (!groupId || !expectedUpdatedAt) {
  console.error("Usage: node scripts/lifecycle-void-apply.js <groupId> --expectedUpdatedAt='<iso from pre-check>' [--expectedStatus=battle] [--reason=...] [--by=...] --confirm");
  process.exit(1);
}

// Fail with a one-line instruction rather than firebase-admin's opaque
// `app/invalid-credential` stack trace. Checked before any Firestore contact,
// so a credential problem can never leave a half-applied void.
requireFirebaseCreds();

async function main() {
  const db = getFirebaseAdmin();
  const now = new Date().toISOString();
  console.log(`VOID ${confirm ? 'APPLY' : 'DRY-RUN'} - tournamentGroups/${groupId}`);
  console.log(`  expectedStatus=${expectedStatus} expectedUpdatedAt=${expectedUpdatedAt} reason=${reason} by=${by}`);
  if (!confirm) {
    console.log('DRY-RUN: nothing written. Re-run with --confirm to apply the void.');
    return;
  }
  const res = await voidGroup(db, groupId, { reason, by, now, expectedStatus, expectedUpdatedAt });
  console.log('result:', JSON.stringify(res));
  if (res.voided) {
    console.log('VOIDED. The group left BATTLE - banking + advancement now skip it, and the Day-5 record is intact.');
  } else {
    console.log(`NOT voided (reason: ${res.reason}). No mutation applied - re-run the pre-check; the doc likely moved.`);
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error('void apply failed:', err); process.exit(3); });
