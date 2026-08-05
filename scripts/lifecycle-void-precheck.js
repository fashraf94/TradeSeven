// scripts/lifecycle-void-precheck.js
//
// L-A READ-ONLY pre-check for the poisoned-cohort VOID (League Lifecycle
// Remediation). Reads ONE tournamentGroups doc and reports exactly what is
// needed to approve the void: current status, baseLayerWeek, the day count (is
// it past day 5?), and proof the TRUE Day-5 snapshot is intact — plus the
// { expectedStatus, expectedUpdatedAt } pins that voidGroup REQUIRES, so a doc
// that moves between this pre-check and the void is SKIPPED, never stale-mutated.
//
// STRICTLY READ-ONLY: performs no writes; does not import voidGroup.
//
// Run in an environment with the same creds as the serverless functions
// (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY):
//   node scripts/lifecycle-void-precheck.js <groupId>

import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';
import { WEEK_DAYS_REQUIRED } from '../src/constants/leagueTournament.js';

const groupId = process.argv[2];
if (!groupId) {
  console.error('Usage: node scripts/lifecycle-void-precheck.js <groupId>');
  process.exit(1);
}

function dayNumbersOf(dailyScores) {
  return Object.keys(dailyScores || {})
    .map((k) => /^day(\d+)$/.exec(k))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

async function main() {
  const db = getFirebaseAdmin();
  const snap = await db.collection('tournamentGroups').doc(groupId).get();
  if (!snap.exists) {
    console.error(`NOT FOUND: tournamentGroups/${groupId}`);
    process.exit(2);
  }
  const g = snap.data();
  const dayNs = dayNumbersOf(g.dailyScores);
  const latestDay = dayNs.length ? dayNs[dayNs.length - 1] : 0;
  const day5 = g.dailyScores?.[`day${WEEK_DAYS_REQUIRED}`] || null;
  const members = g.groupMembers || [];

  console.log('==============================================================');
  console.log(`L-A VOID PRE-CHECK (READ-ONLY) - tournamentGroups/${groupId}`);
  console.log('==============================================================');
  console.log(`status            : ${g.status}`);
  console.log(`isTraining        : ${g.isTraining === true}`);
  console.log(`baseLayerWeek     : ${g.baseLayerWeek ?? '(none)'}`);
  console.log(`bracketGameId     : ${g.bracketGameId ?? '(none)'}`);
  console.log(`roundNumber       : ${g.roundNumber ?? '(none)'}`);
  console.log(`groupMembers      : ${members.length} [${members.join(', ')}]`);
  console.log(`createdAt         : ${g.createdAt ?? '(none)'}`);
  console.log(`updatedAt         : ${g.updatedAt ?? '(none)'}`);
  console.log('');
  console.log(`day keys present  : ${dayNs.length ? dayNs.map((n) => `day${n}`).join(', ') : '(none)'}`);
  console.log(`latest dayN       : ${latestDay}  (WEEK_DAYS_REQUIRED = ${WEEK_DAYS_REQUIRED})`);
  console.log(`past day 5?       : ${latestDay > WEEK_DAYS_REQUIRED ? `YES - banked ${latestDay - WEEK_DAYS_REQUIRED} extra day(s) (zombie)` : 'no'}`);
  console.log('');
  console.log(`-- Day-${WEEK_DAYS_REQUIRED} snapshot integrity (the record settlement must honor) --`);
  if (!day5) {
    console.log(`  day${WEEK_DAYS_REQUIRED}: MISSING - investigate before voiding (true Day-5 record not found)`);
  } else {
    console.log(`  day${WEEK_DAYS_REQUIRED}.recordedDate : ${day5.recordedDate ?? '(none)'}`);
    const cs = day5.closeScores || {};
    console.log(`  day${WEEK_DAYS_REQUIRED}.closeScores  : ${Object.keys(cs).length} member entr(y|ies)`);
    for (const uid of members) {
      const e = cs[uid];
      if (!e) { console.log(`    ${uid}: (no entry)`); continue; }
      console.log(`    ${uid}: composite=${e.compositePoints ?? '-'} total=${e.totalPoints ?? '-'} agent=${e.agentPoints ?? '-'} picks=${Array.isArray(e.picks) ? e.picks.length : '-'}`);
    }
  }
  console.log('');
  const updatedAtRaw = g.updatedAt ?? '';
  console.log('-- MANDATORY pins for the apply step (values are RAW - do not add quotes) --');
  console.log(`  expectedStatus    : ${g.status}`);
  console.log(`  expectedUpdatedAt : ${updatedAtRaw || '(none)'}`);
  console.log('');
  console.log('  Apply command (run ONLY after founder approval; omit --confirm for a dry-run preview):');
  console.log(`    node scripts/lifecycle-void-apply.js ${groupId} --expectedStatus='${g.status}' --expectedUpdatedAt='${updatedAtRaw}' --confirm`);
  console.log('');
  console.log('  NOTE: nightly banking bumps this group\'s updatedAt every night (~21:15 UTC) while it');
  console.log('  is still in BATTLE. Run the apply the SAME UTC day as this pre-check. If a bank lands');
  console.log('  in between, the void SAFELY SKIPS (version_changed) - just re-run this pre-check for a');
  console.log('  fresh expectedUpdatedAt and re-apply. It never stale-mutates.');
  console.log('');
  console.log('READ-ONLY pre-check complete. No document was modified.');
}

main().then(() => process.exit(0)).catch((err) => { console.error('pre-check failed:', err); process.exit(3); });
