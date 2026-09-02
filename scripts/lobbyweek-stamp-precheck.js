// scripts/lobbyweek-stamp-precheck.js
//
// D-LOBBYWEEK READ-ONLY production scan. Answers Phase 0 Q5: which live
// tournamentGroups docs carry a FORMATION-week baseLayerWeek stamp instead of
// the BATTLE week they actually play, so the founder can decide whether a
// one-off correction is needed ALONGSIDE the code fix.
//
// STRICTLY READ-ONLY: performs no writes; imports no mutator. Mirrors the
// scripts/lifecycle-void-precheck.js + scripts/calibration/motive-baseline-summary.js
// pattern (loadLocalEnv side-effect import, requireFirebaseCreds, getFirebaseAdmin).
//
// WHAT IT DOES. Walks tournamentGroups and, for every LOBBY/QUICKPLAY-shaped
// group (has baseLayerWeek, NOT a slot pod [isLiveDraft !== true], NOT a bracket
// pod [id not a bracket game / has baseLayerWeek not bracketGameId]), recomputes
// the CORRECT battle-week key the fix would have stamped —
//   deriveBaseLayerWeek(deriveBattleStartWeek(createdAt))
// — using the SAME canonical helpers the write side uses (imported from
// liveDraftFormation.js; NEVER a second copy — BUILD_RULES §4), and flags any
// doc whose stored baseLayerWeek DISAGREES. It also prints the day-key evidence
// (day1.recordedDate) so the founder can see, empirically, which week the pod
// actually banked — the ground truth a derivation can only approximate for a
// pod that lingered in FORMING across a Monday.
//
// This decides whether a one-off correction is needed. It does NOT write one.
// Per the brief: do not author a migration until the founder has seen this output.
//
// Needs the same creds as the serverless functions — FIREBASE_PROJECT_ID /
// FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY. Locally those come from
// .env.local in the repo root, loaded by ./loadLocalEnv.js. From the repo root:
//
//   node scripts/lobbyweek-stamp-precheck.js               # all statuses
//   node scripts/lobbyweek-stamp-precheck.js --mismatched  # only the mis-stamped
//   node scripts/lobbyweek-stamp-precheck.js --active      # FORMING/DRAFTING/AWAITING_OPEN/BATTLE only
//   node scripts/lobbyweek-stamp-precheck.js --json out.json
//
// PLACEMENT: this file must live in scripts/ so its relative imports resolve
// (./loadLocalEnv.js, ../api/_utils/firebaseAdmin.js, ../api/_utils/liveDraftFormation.js).

// Explicit node: builtin import so the file lints clean under the repo's
// browser-default eslint env (the motive-baseline-summary.js pattern).
import process from 'node:process';
// MUST be imported before firebaseAdmin.js — loads .env.local as a side effect.
import { requireFirebaseCreds } from './loadLocalEnv.js';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';
// Reuse the CANONICAL write-side computation — do not re-derive (BUILD_RULES §4:
// the read/write drift this defect belongs to was caused by a second definition).
import { deriveBattleStartWeek, deriveBaseLayerWeek, LIVE_DRAFT_GROUP_ID_PREFIX } from '../api/_utils/liveDraftFormation.js';
import { GROUP_STATUS } from '../src/constants/leagueTournament.js';

const ACTIVE = new Set([
  GROUP_STATUS.FORMING, GROUP_STATUS.DRAFTING, GROUP_STATUS.AWAITING_OPEN, GROUP_STATUS.BATTLE,
]);

const argv = process.argv.slice(2);
const onlyMismatched = argv.includes('--mismatched');
const onlyActive = argv.includes('--active');
const jsonIdx = argv.indexOf('--json');
const jsonPath = jsonIdx >= 0 ? argv[jsonIdx + 1] : null;

requireFirebaseCreds();

// A slot pod is the ONE correct writer (isLiveDraft:true, id prefix `lds_`). A
// bracket pod carries bracketGameId, not baseLayerWeek. Everything else with a
// baseLayerWeek came through the lobby/quickPlay/training/dev-seed path — the
// mis-stamping surface.
function isLobbyShaped(id, g) {
  if (typeof g.baseLayerWeek !== 'string' || g.baseLayerWeek.length === 0) return false; // bracket pod / no week
  if (g.isLiveDraft === true) return false;                                              // slot pod (correct)
  if (typeof id === 'string' && id.startsWith(LIVE_DRAFT_GROUP_ID_PREFIX)) return false;  // slot pod by id, belt-and-braces
  return true;
}

function day1RecordedDate(dailyScores) {
  return dailyScores?.day1?.recordedDate ?? null;
}

function dayKeys(dailyScores) {
  return Object.keys(dailyScores || {})
    .map((k) => /^day(\d+)$/.exec(k))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b)
    .map((n) => `day${n}`);
}

async function main() {
  const db = getFirebaseAdmin();
  const snap = await db.collection('tournamentGroups').get();

  const rows = [];
  let scanned = 0;
  snap.forEach((doc) => {
    scanned++;
    const g = doc.data();
    if (!isLobbyShaped(doc.id, g)) return;
    if (onlyActive && !ACTIVE.has(g.status)) return;

    // The correct battle-week key the fix would stamp, from the formation instant.
    // createdAt is the ISO formation instant on the group doc.
    let derivedBattleWeek = '(uncomputable — no createdAt)';
    if (typeof g.createdAt === 'string' && g.createdAt.length > 0) {
      try {
        derivedBattleWeek = deriveBaseLayerWeek(deriveBattleStartWeek(g.createdAt));
      } catch (err) {
        derivedBattleWeek = `(error: ${err.message})`;
      }
    }
    const stored = g.baseLayerWeek;
    const mismatch = derivedBattleWeek !== stored && !derivedBattleWeek.startsWith('(');

    rows.push({
      id: doc.id,
      baseLayerWeek: stored,
      derivedBattleWeek,
      mismatch,
      isLiveDraft: g.isLiveDraft === true,
      isTraining: g.isTraining === true,
      isDev: g.isDev === true,
      status: g.status ?? null,
      createdAt: g.createdAt ?? null,
      members: (g.groupMembers || []).length,
      dayKeys: dayKeys(g.dailyScores),
      day1RecordedDate: day1RecordedDate(g.dailyScores),
    });
  });

  const shown = onlyMismatched ? rows.filter((r) => r.mismatch) : rows;
  shown.sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));

  console.log('==============================================================');
  console.log('D-LOBBYWEEK STAMP PRE-CHECK (READ-ONLY) — tournamentGroups');
  console.log('==============================================================');
  console.log(`docs scanned          : ${scanned}`);
  console.log(`lobby/quickPlay-shaped : ${rows.length}`);
  console.log(`  of which MIS-STAMPED : ${rows.filter((r) => r.mismatch).length}  (stored baseLayerWeek != derived battle week)`);
  console.log(`  training (excluded from THE FIELD) : ${rows.filter((r) => r.isTraining).length}`);
  console.log(`  isDev  (excluded from production)  : ${rows.filter((r) => r.isDev).length}`);
  console.log(`filter                : ${onlyMismatched ? '--mismatched ' : ''}${onlyActive ? '--active' : '(all statuses)'}`);
  console.log('');

  for (const r of shown) {
    console.log(`-- tournamentGroups/${r.id} ${r.mismatch ? '  *** MIS-STAMPED ***' : ''}`);
    console.log(`   status            : ${r.status}`);
    console.log(`   baseLayerWeek     : ${r.baseLayerWeek}   (STORED)`);
    console.log(`   derivedBattleWeek : ${r.derivedBattleWeek}   (what the fix would stamp, from createdAt)`);
    console.log(`   isTraining        : ${r.isTraining}   isDev: ${r.isDev}   isLiveDraft: ${r.isLiveDraft}`);
    console.log(`   createdAt         : ${r.createdAt}`);
    console.log(`   members           : ${r.members}`);
    console.log(`   day keys          : ${r.dayKeys.length ? r.dayKeys.join(', ') : '(none banked yet)'}`);
    console.log(`   day1.recordedDate : ${r.day1RecordedDate ?? '(none)'}   <- empirical: the ET date it FIRST banked (its real play week)`);
    console.log('');
  }

  console.log('INTERPRETATION');
  console.log('  * A MIS-STAMPED row with an ACTIVE status (FORMING/DRAFTING/AWAITING_OPEN/BATTLE) is the');
  console.log('    urgent case: it is (or will be) absent from THE FIELD for the week it actually plays.');
  console.log('  * Compare derivedBattleWeek against day1.recordedDate: if a pod lingered in FORMING across a');
  console.log('    Monday, its true play week is what it banked, which the createdAt derivation may under-shoot.');
  console.log('  * training / isDev rows are informational — excluded from THE FIELD and the leaderboard.');
  console.log('');

  if (jsonPath) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(jsonPath, JSON.stringify({ scanned, rows }, null, 2));
    console.log(`Wrote ${rows.length} rows to ${jsonPath}`);
  }

  console.log('READ-ONLY pre-check complete. No document was modified.');
}

main().then(() => process.exit(0)).catch((err) => { console.error('pre-check failed:', err); process.exit(3); });
