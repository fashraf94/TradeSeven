// scripts/n1-expire-forming-mon0845.js
//
// N1 MITIGATION — explicit, one-group retirement of a Mon 08:45 slot pod that is
// still FORMING (MUTATING; founder-executed AFTER reading the pre-check). It
// transitions exactly ONE group `forming -> expired` and touches nothing else:
// no sweep, no other doc, no rank, no banking record.
//
// WHY THIS EXISTS. With this PR deployed, a disabled slot's FORMING group can no
// longer fire (findDueSlotGroups skips it), so it is already harmless — it just
// sits in `forming` forever. This script is for the founder who would rather
// retire it cleanly than leave it parked, e.g. after telling its claimants. It
// is deliberately NOT run by anything automatic.
//
// SAFETY — it refuses unless ALL of these hold, checked before any write:
//   - the group exists;
//   - status === 'forming'          (a pod that already fired is NEVER touched);
//   - isLiveDraft === true          (never a regular ranked group);
//   - slotId === 'mon-0845'         (never another slot's pod).
// And it writes ONLY with an explicit --apply. Without it, this is a dry run
// that prints exactly what it would do.
//
// `forming -> expired` is a legal transition (tournamentGroupService.js
// LEGAL_TRANSITIONS) and `transitionStatus` re-asserts it INSIDE its
// transaction, so a pod that advanced between the read below and the commit
// cannot be silently retro-expired into an illegal state.
//
// RUN ORDER (do not skip step 1):
//   1. node scripts/n1-stranded-precheck.js          # read-only; decide
//   2. node scripts/n1-expire-forming-mon0845.js <groupId>           # dry run
//   3. node scripts/n1-expire-forming-mon0845.js <groupId> --apply   # writes
//
// Needs the serverless creds (FIREBASE_PROJECT_ID / _CLIENT_EMAIL /
// _PRIVATE_KEY). Locally those come from .env.local in the repo root, loaded by
// ./loadLocalEnv.js. Run from the repo root.

// MUST be imported before firebaseAdmin.js — loads .env.local as a side effect.
import { requireFirebaseCreds } from './loadLocalEnv.js';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';
import { transitionStatus } from '../api/_utils/tournamentGroupService.js';
import { GROUP_STATUS, TOURNAMENT_GROUPS_COLLECTION } from '../src/constants/leagueTournament.js';

const EXPECTED_SLOT_ID = 'mon-0845';

const groupId = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const apply = process.argv.includes('--apply');

if (!groupId) {
  console.error('Usage: node scripts/n1-expire-forming-mon0845.js <groupId> [--apply]');
  console.error('  Omit --apply for a dry run. Run scripts/n1-stranded-precheck.js first.');
  process.exit(1);
}

// Fail with a one-line instruction rather than firebase-admin's opaque
// `app/invalid-credential` stack trace. Checked before any Firestore contact.
requireFirebaseCreds();

function refuse(reason, detail) {
  console.error('');
  console.error(`REFUSED: ${reason}`);
  if (detail) console.error(`  ${detail}`);
  console.error('  Nothing was written.');
  process.exit(2);
}

async function main() {
  const db = getFirebaseAdmin();
  const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId).get();

  console.log('==============================================================');
  console.log(`N1 EXPIRE ${apply ? 'APPLY' : 'DRY-RUN'} — ${TOURNAMENT_GROUPS_COLLECTION}/${groupId}`);
  console.log('==============================================================');

  if (!snap.exists) refuse('group not found', `${TOURNAMENT_GROUPS_COLLECTION}/${groupId}`);

  const g = snap.data();
  const members = g.groupMembers || [];
  const seatNames = g.seatNames || {};

  console.log(`  status           : ${g.status}`);
  console.log(`  isLiveDraft      : ${g.isLiveDraft === true}`);
  console.log(`  slotId           : ${g.slotId ?? '(none)'}`);
  console.log(`  isDev            : ${g.isDev === true}`);
  console.log(`  scheduledDraftAt : ${g.scheduledDraftAt ?? '(none)'}`);
  console.log(`  updatedAt        : ${g.updatedAt ?? '(none)'}`);
  console.log(`  seats (${members.length}):`);
  for (const id of members) console.log(`    ${id}  name=${seatNames[id] ?? '(none)'}`);
  console.log('');

  // ---- the three refusals, before any write ----
  if (g.status !== GROUP_STATUS.FORMING) {
    refuse(`status is '${g.status}', not '${GROUP_STATUS.FORMING}'`,
      'This script only retires a pod that never fired. A pod past FORMING is live history — leave it alone.');
  }
  if (g.isLiveDraft !== true) {
    refuse('not a live-draft slot group (isLiveDraft !== true)',
      'Refusing to touch a regular ranked group.');
  }
  if (g.slotId !== EXPECTED_SLOT_ID) {
    refuse(`slotId is '${g.slotId ?? '(none)'}', not '${EXPECTED_SLOT_ID}'`,
      'This script is scoped to the N1 slot only.');
  }

  console.log(`  WILL DO: transition status '${GROUP_STATUS.FORMING}' -> '${GROUP_STATUS.EXPIRED}' on this ONE group.`);
  console.log('  WILL NOT: touch any other group, any rank doc, any banking record, or any seat.');
  console.log(`  EFFECT  : the ${members.length} claimant(s) above lose this parked seat; the pod is terminal.`);
  console.log('');

  if (!apply) {
    console.log('DRY-RUN: nothing written. Re-run with --apply to perform the transition.');
    return;
  }

  const nowIso = new Date().toISOString();
  const to = await transitionStatus(db, groupId, GROUP_STATUS.EXPIRED, nowIso);
  console.log(`EXPIRED. status is now '${to}' (at ${nowIso}). The pod is terminal and can never fire.`);
}

main().then(() => process.exit(0)).catch((err) => {
  // An `illegal transition` here means the pod moved between the read and the
  // commit — the transaction refused it rather than retro-expiring a live pod.
  console.error('n1 expire failed:', err.message || err);
  console.error('If this says "illegal transition", the pod advanced mid-run and was NOT modified.');
  process.exit(3);
});
