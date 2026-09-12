// scripts/n1-stranded-precheck.js
//
// N1 READ-ONLY pre-check — "did any Mon 08:45 pod actually play a week with an
// empty agent layer?" (League Tournament arc; N1 discovery report, verdict
// CONFIRMED). Reads every `lds_mon-0845_<Monday>` occurrence since the
// LEAGUE_LIVE_DRAFT flip (2026-07-17) plus the upcoming Monday, and reports for
// each: whether it exists, its status, whether it is a dev pod, who claimed it,
// whether the five-part STRANDED SIGNATURE holds, and — for a stranded pod —
// the tournamentRanks docs that already took permanent RP from the half-composite.
//
// THE FIVE-PART SIGNATURE (N1 report §7). All five together confirm; any one
// alone is suggestive:
//   1. agentBattles where groupId == <id>            -> ZERO documents
//   2. tournamentGroups/<id>/agentBoards             -> EMPTY subcollection
//   3. tournamentGroups/<id>/streams/agentDraft      -> ABSENT (the doc the
//      Tue-Fri deploy catch-up needs; only Monday's pipeline writes it)
//   4. dailyScores day1..day5                        -> every agentPoints == 0
//      AND `agentScoresCarried` ABSENT on every day (the SILENT part: a carried
//      agent layer pauses the week, a never-created one does not)
//   5. tournamentOrchestrator/state.duties['<Monday>:monday_pipeline']
//      -> completedAt EARLIER than the pod's draft-resolution instant (the
//      marker was already set when the pod reached `battle`)
//
// STRICTLY READ-ONLY, and mechanically so: the Firestore handle is wrapped in a
// proxy that THROWS on set / update / delete / create / add / batch /
// runTransaction / commit. It imports no writer and no apply script.
//
// Needs the same creds as the serverless functions — FIREBASE_PROJECT_ID /
// FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY. Locally those come from
// .env.local in the repo root, loaded by ./loadLocalEnv.js (see that file for
// the exact .env.local format). From the repo root:
//   node scripts/n1-stranded-precheck.js
//   node scripts/n1-stranded-precheck.js --dates=2026-09-07,2026-09-14

// MUST be imported before firebaseAdmin.js — loads .env.local as a side effect.
import { requireFirebaseCreds } from './loadLocalEnv.js';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_RANKS_COLLECTION,
  AGENT_BOARDS_SUBCOLLECTION,
  STREAMS_SUBCOLLECTION,
  AGENT_DRAFT_STREAM_DOC_ID,
  USER_DRAFT_STREAM_DOC_ID,
  TOURNAMENT_GAME_MODE,
  WEEK_DAYS_REQUIRED,
  rankDocId,
} from '../src/constants/leagueTournament.js';

const SLOT_ID = 'mon-0845';
const GROUP_ID_PREFIX = 'lds_';

// The exposed Mondays: every Monday from the LEAGUE_LIVE_DRAFT flip (2026-07-17)
// through the upcoming one. Override with --dates= for a targeted re-check.
const DEFAULT_DATES = [
  '2026-07-20', '2026-07-27',
  '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31',
  '2026-09-07',
  '2026-09-14', // the upcoming Monday — the one this mitigation is racing
];

function argVal(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return null;
  return hit.slice(prefix.length).replace(/^(['"])([\s\S]*)\1$/, '$2');
}

const datesArg = argVal('dates');
const DATES = datesArg ? datesArg.split(',').map((d) => d.trim()).filter(Boolean) : DEFAULT_DATES;

// Fail with a one-line instruction rather than firebase-admin's opaque
// `app/invalid-credential` stack trace.
requireFirebaseCreds();

// ==================== THE READ-ONLY GUARANTEE ====================

const MUTATORS = new Set([
  'set', 'update', 'delete', 'create', 'add', 'commit',
  'batch', 'bulkWriter', 'runTransaction', 'recursiveDelete', 'withConverter',
]);

/** Wrap a Firestore handle so any mutating call THROWS instead of writing.
 *  Returned refs/queries are wrapped too, so the guarantee survives chaining.
 *  Promises are passed through unwrapped (a snapshot is already inert). */
function readOnly(target, path = 'db') {
  return new Proxy(target, {
    get(t, prop) {
      if (typeof prop === 'string' && MUTATORS.has(prop)) {
        throw new Error(`READ-ONLY VIOLATION: ${path}.${prop}() — n1-stranded-precheck must never write.`);
      }
      // No receiver: Firestore classes use private fields, and forwarding the
      // proxy as `this` to a getter would throw.
      const value = Reflect.get(t, prop);
      if (typeof value !== 'function') return value;
      return (...args) => {
        const result = value.apply(t, args);
        const chainable = result && typeof result === 'object' && typeof result.then !== 'function';
        return chainable ? readOnly(result, `${path}.${prop}`) : result;
      };
    },
  });
}

// ==================== READS ====================

function dayKeys() {
  return Array.from({ length: WEEK_DAYS_REQUIRED }, (_, i) => `day${i + 1}`);
}

/** Part 4: every banked day's agent half is a silent zero. */
function inspectDailyScores(dailyScores) {
  const present = dayKeys().filter((k) => dailyScores?.[k]);
  const carriedOn = present.filter((k) => dailyScores[k].agentScoresCarried === true);
  const agentPointsByDay = {};
  let allZero = present.length > 0;
  for (const k of present) {
    const cs = dailyScores[k].closeScores || {};
    const values = Object.values(cs).map((e) => e?.agentPoints);
    agentPointsByDay[k] = values;
    if (!values.length || values.some((v) => v !== 0)) allZero = false;
  }
  return {
    daysBanked: present.length,
    allAgentPointsZero: allZero,
    carriedDays: carriedOn,
    noCarryStamp: carriedOn.length === 0,
    agentPointsByDay,
  };
}

async function inspectGroup(db, etDate) {
  const groupId = `${GROUP_ID_PREFIX}${SLOT_ID}_${etDate}`;
  const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId).get();
  if (!snap.exists) return { etDate, groupId, exists: false };

  const g = snap.data();
  const ref = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);

  // (1) agent battles for this group
  const battlesSnap = await db.collection('agentBattles').where('groupId', '==', groupId).select('gameMode', 'ownerId').get();
  let battleCount = 0;
  let tournamentBattleCount = 0;
  battlesSnap.forEach((d) => {
    battleCount++;
    if (d.data().gameMode === TOURNAMENT_GAME_MODE) tournamentBattleCount++;
  });

  // (2) agent boards subcollection
  const boardsSnap = await ref.collection(AGENT_BOARDS_SUBCOLLECTION).get();

  // (3) the agent-draft stream (what the Tue-Fri catch-up needs)
  const agentStream = await ref.collection(STREAMS_SUBCOLLECTION).doc(AGENT_DRAFT_STREAM_DOC_ID).get();

  // the user-draft stream carries resolvedAt — the draft-completion instant,
  // which nightly banking never bumps (unlike the group's updatedAt).
  const userStream = await ref.collection(STREAMS_SUBCOLLECTION).doc(USER_DRAFT_STREAM_DOC_ID).get();
  const resolvedAt = userStream.exists ? (userStream.data().resolvedAt ?? null) : null;

  // (4) banked days
  const daily = inspectDailyScores(g.dailyScores);

  // (5) the Monday duty marker
  const stateSnap = await db.collection('tournamentOrchestrator').doc('state').get();
  const markerKey = `${etDate}:monday_pipeline`;
  const marker = stateSnap.exists ? (stateSnap.data().duties?.[markerKey] ?? null) : null;
  const markerBeforeResolve = marker?.completedAt && resolvedAt
    ? marker.completedAt < resolvedAt
    : null;

  const members = g.groupMembers || [];
  const seatNames = g.seatNames || {};
  const players = (g.players || []).map((p) => ({
    odUserId: p.odUserId,
    name: seatNames[p.odUserId] ?? null,
    isCpu: p.isCpu === true,
  }));

  const signature = {
    p1_noAgentBattles: tournamentBattleCount === 0,
    p2_noAgentBoards: boardsSnap.size === 0,
    p3_noAgentDraftStream: !agentStream.exists,
    p4_silentZeroAgentPoints: daily.daysBanked > 0 && daily.allAgentPointsZero && daily.noCarryStamp,
    p5_markerSetBeforeResolve: markerBeforeResolve === true,
  };
  const partsHeld = Object.values(signature).filter(Boolean).length;

  // Ranks are only meaningful once the week actually finalized.
  let ranks = [];
  if (partsHeld >= 3 && members.length) {
    ranks = await Promise.all(members.map(async (odUserId) => {
      const id = rankDocId(odUserId, { dev: g.isDev === true });
      const rs = await db.collection(TOURNAMENT_RANKS_COLLECTION).doc(id).get();
      if (!rs.exists) return { odUserId, rankDocId: id, exists: false };
      const applied = rs.data().appliedGroups?.[groupId] ?? null;
      return {
        odUserId,
        rankDocId: id,
        exists: true,
        applied: applied != null,
        weeklyComposite: applied?.weeklyComposite ?? null,
        placement: applied?.placement ?? null,
        delta: applied?.delta ?? null,
        rpAfter: applied?.rpAfter ?? null,
      };
    }));
  }

  return {
    etDate, groupId, exists: true,
    status: g.status ?? null,
    isDev: g.isDev === true,
    isLiveDraft: g.isLiveDraft === true,
    slotId: g.slotId ?? null,
    scheduledDraftAt: g.scheduledDraftAt ?? null,
    createdAt: g.createdAt ?? null,
    updatedAt: g.updatedAt ?? null,
    resolvedAt,
    members, players,
    battleCount, tournamentBattleCount,
    boardCount: boardsSnap.size,
    agentStreamExists: agentStream.exists,
    daily,
    markerKey,
    markerCompletedAt: marker?.completedAt ?? null,
    markerBeforeResolve,
    signature, partsHeld,
    ranks,
  };
}

// ==================== OUTPUT ====================

const YES = 'YES';
const NO = 'no';
const mark = (b) => (b === true ? YES : b === false ? NO : '?');
const pad = (s, n) => String(s ?? '').padEnd(n);

function printTable(rows) {
  console.log('');
  console.log('DATE        GROUP ID                       EXISTS STATUS       DEV  SEATS  SIGNATURE(1-5)  STRANDED');
  console.log('----------- ------------------------------ ------ ------------ ---- ------ --------------- --------');
  for (const r of rows) {
    if (!r.exists) {
      console.log(`${pad(r.etDate, 11)} ${pad(r.groupId, 30)} ${pad(NO, 6)} ${pad('-', 12)} ${pad('-', 4)} ${pad('-', 6)} ${pad('-', 15)} -`);
      continue;
    }
    const s = r.signature;
    const sig = [s.p1_noAgentBattles, s.p2_noAgentBoards, s.p3_noAgentDraftStream, s.p4_silentZeroAgentPoints, s.p5_markerSetBeforeResolve]
      .map((b) => (b ? '#' : '.')).join(' ');
    const stranded = r.partsHeld >= 3 ? `${r.partsHeld}/5 YES` : `${r.partsHeld}/5`;
    console.log(`${pad(r.etDate, 11)} ${pad(r.groupId, 30)} ${pad(YES, 6)} ${pad(r.status, 12)} ${pad(r.isDev ? YES : NO, 4)} ${pad(r.members.length, 6)} ${pad(sig, 15)} ${stranded}`);
  }
  console.log('');
  console.log('  SIGNATURE key ("#" = the stranded condition holds, "." = it does not):');
  console.log('    1 no agent battles   2 no agent boards   3 no agent-draft stream');
  console.log('    4 all banked agentPoints 0 with NO agentScoresCarried stamp (the silent part)');
  console.log('    5 Monday duty marker completed BEFORE the pod resolved its draft');
}

function printDetail(r) {
  console.log('');
  console.log('==============================================================');
  console.log(`${r.etDate}  tournamentGroups/${r.groupId}`);
  console.log('==============================================================');
  if (!r.exists) {
    console.log('  DOES NOT EXIST — nobody claimed this occurrence. No exposure.');
    return;
  }
  console.log(`  status            : ${r.status}`);
  console.log(`  isDev             : ${r.isDev}`);
  console.log(`  isLiveDraft       : ${r.isLiveDraft}   slotId: ${r.slotId}`);
  console.log(`  scheduledDraftAt  : ${r.scheduledDraftAt ?? '(none)'}`);
  console.log(`  createdAt         : ${r.createdAt ?? '(none)'}`);
  console.log(`  updatedAt         : ${r.updatedAt ?? '(none)'}  (nightly banking bumps this — not the flip time)`);
  console.log(`  draft resolvedAt  : ${r.resolvedAt ?? '(none)'}  (streams/${USER_DRAFT_STREAM_DOC_ID} — the real completion instant)`);
  console.log('');
  console.log(`  CLAIMANTS (${r.members.length} seat(s)):`);
  if (!r.players.length) console.log('    (none)');
  for (const p of r.players) {
    console.log(`    ${pad(p.odUserId, 30)} name=${p.name ?? '(none)'}${p.isCpu ? '  [CPU]' : '  [human]'}`);
  }
  console.log('');
  console.log('  FIVE-PART STRANDED SIGNATURE:');
  console.log(`    1. agent battles (tournament gameMode) : ${r.tournamentBattleCount} of ${r.battleCount} total  -> ${mark(r.signature.p1_noAgentBattles)}`);
  console.log(`    2. ${AGENT_BOARDS_SUBCOLLECTION} docs                     : ${r.boardCount}                     -> ${mark(r.signature.p2_noAgentBoards)}`);
  console.log(`    3. streams/${AGENT_DRAFT_STREAM_DOC_ID} present            : ${r.agentStreamExists}                 -> ${mark(r.signature.p3_noAgentDraftStream)}`);
  console.log(`    4. banked days                         : ${r.daily.daysBanked}; all agentPoints zero=${r.daily.allAgentPointsZero}; agentScoresCarried days=[${r.daily.carriedDays.join(', ') || 'none'}]  -> ${mark(r.signature.p4_silentZeroAgentPoints)}`);
  for (const [k, v] of Object.entries(r.daily.agentPointsByDay)) {
    console.log(`         ${k}.agentPoints = [${v.join(', ')}]`);
  }
  console.log(`    5. duty marker ${r.markerKey}`);
  console.log(`         completedAt = ${r.markerCompletedAt ?? '(no marker recorded)'}`);
  console.log(`         set before the pod resolved? ${mark(r.markerBeforeResolve)}  -> ${mark(r.signature.p5_markerSetBeforeResolve)}`);
  console.log('');
  console.log(`  VERDICT: ${r.partsHeld}/5 parts hold${r.partsHeld >= 3 ? ' — TREAT AS STRANDED' : ''}`);

  if (r.ranks.length) {
    console.log('');
    console.log(`  PERMANENT RANK EFFECT (${TOURNAMENT_RANKS_COLLECTION}; appliedGroups is ONCE-ONLY — this cannot be re-applied):`);
    for (const rk of r.ranks) {
      if (!rk.exists) { console.log(`    ${pad(rk.odUserId, 30)} no rank doc (${rk.rankDocId})`); continue; }
      if (!rk.applied) { console.log(`    ${pad(rk.odUserId, 30)} rank doc exists; this group NOT applied (week never finalized)`); continue; }
      console.log(`    ${pad(rk.odUserId, 30)} APPLIED  composite=${rk.weeklyComposite}  placement=${rk.placement}  delta=${rk.delta}  rpAfter=${rk.rpAfter}`);
    }
  }
}

async function main() {
  const db = readOnly(getFirebaseAdmin());

  console.log('==============================================================');
  console.log('N1 STRANDED PRE-CHECK (READ-ONLY) — Mon 08:45 slot pods');
  console.log('==============================================================');
  console.log(`slot          : ${SLOT_ID}`);
  console.log(`occurrences   : ${DATES.length} (${DATES[0]} .. ${DATES[DATES.length - 1]})`);
  console.log('writes        : IMPOSSIBLE — the Firestore handle throws on any mutator.');

  const rows = [];
  for (const etDate of DATES) rows.push(await inspectGroup(db, etDate));

  printTable(rows);
  for (const r of rows) printDetail(r);

  const existing = rows.filter((r) => r.exists);
  const stranded = existing.filter((r) => r.partsHeld >= 3);
  const humansAffected = new Set();
  const rpApplied = [];
  for (const r of stranded) {
    for (const p of r.players) if (!p.isCpu) humansAffected.add(p.odUserId);
    for (const rk of r.ranks) if (rk.applied) rpApplied.push({ group: r.groupId, ...rk });
  }

  console.log('');
  console.log('==============================================================');
  console.log('PLAIN-LANGUAGE SUMMARY');
  console.log('==============================================================');
  if (existing.length === 0) {
    console.log('No Mon 08:45 pod was ever created on any checked Monday.');
    console.log('Nobody has been affected by N1. The blast radius to date is ZERO —');
    console.log('the defect is real but latent, and this PR closes the door before it opens.');
  } else {
    console.log(`${existing.length} Mon 08:45 pod(s) exist across the checked Mondays.`);
    console.log(`${stranded.length} of them show the stranded signature (3 or more of the five parts).`);
    if (stranded.length) {
      console.log('');
      console.log('A stranded pod played its week with NO agent layer: it banked and scored on the');
      console.log('user half alone, and nothing flagged it. Affected pods:');
      for (const r of stranded) console.log(`  - ${r.groupId}  (status ${r.status}, ${r.members.length} seat(s), ${r.partsHeld}/5)`);
      console.log('');
      console.log(`Humans affected: ${humansAffected.size ? [...humansAffected].join(', ') : '(none — CPU-only pods)'}`);
      if (rpApplied.length) {
        console.log('');
        console.log('Career rank ALREADY MOVED on the half-composite for these seats. This is');
        console.log('permanent and cannot be re-applied automatically (appliedGroups is once-only)');
        console.log('— any correction is a deliberate founder decision:');
        for (const rk of rpApplied) console.log(`  - ${rk.odUserId}  ${rk.group}  delta=${rk.delta}  rpAfter=${rk.rpAfter}`);
      } else {
        console.log('');
        console.log('No rank has been applied for these pods yet — their week has not finalized.');
      }
    }
    const forming = existing.filter((r) => r.status === 'forming');
    if (forming.length) {
      console.log('');
      console.log('STILL FORMING (not yet fired — this is the one you can still act on):');
      for (const r of forming) {
        console.log(`  - ${r.groupId}  ${r.members.length} seat(s): ${r.players.map((p) => p.odUserId).join(', ') || '(none)'}`);
      }
      console.log('');
      console.log('  With this PR deployed, the fire cron SKIPS these (the slot is disabled), so');
      console.log('  they cannot enter the stranded path. They will simply sit in `forming`.');
      console.log('  To retire one explicitly (after deciding what to tell its claimants):');
      for (const r of forming) {
        console.log(`    node scripts/n1-expire-forming-mon0845.js ${r.groupId}            # dry run`);
        console.log(`    node scripts/n1-expire-forming-mon0845.js ${r.groupId} --apply    # writes`);
      }
    }
  }
  console.log('');
  console.log('READ-ONLY pre-check complete. No document was modified.');
}

main().then(() => process.exit(0)).catch((err) => { console.error('n1 pre-check failed:', err); process.exit(3); });
