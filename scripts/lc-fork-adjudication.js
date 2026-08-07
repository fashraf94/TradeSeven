// scripts/lc-fork-adjudication.js
//
// L-C UNFREEZE GATE — credentialed READ-ONLY pass. Closes preconditions #2/#3
// (no poisoned cohort in BATTLE; day-5-carried status) AND prints the evidence
// that adjudicates the scoring-anomaly FORK-1 vs FORK-2, so the founder can
// decide from the output whether a §7 scoring-model fix must land before the
// TOURNAMENT_ADVANCEMENT_FROZEN flip.
//
// It runs the anomaly audit's A1 decomposition (from the unmerged branch
// claude/league-scoring-anomaly-v6b19j — DISCOVERY_PHASE0 §A1 and
// PHASE0_5_LIVE §R1.2–R1.4), scoped to Firestore-only reads: it deliberately
// OMITS the phase-0.5 R1.6 EODHD hand-recompute (that needs an EODHD key and is
// not the fork discriminator). Every number printed is read from Firestore; the
// script asserts NO verdict — it prints the evidence and the pre-registered fork
// rule, and the founder adjudicates.
//
// STRICTLY READ-ONLY: performs only .get() reads. No writes, no flag changes,
// no fence contact, does not import voidGroup or any writer.
//   Safety re-audit before running (should match ONLY this header comment):
//     grep -nE '\.(set|update|delete|add|create)\(|runTransaction|FieldValue' scripts/lc-fork-adjudication.js
//
// ENV VARS (same creds as the serverless functions / the void pre-check — locally
// from .env.local in the repo root, loaded by ./loadLocalEnv.js as a side effect):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY     (PEM, literal \n escapes tolerated)
//   (NO EODHD_API_KEY needed — this pass reads Firestore only.)
//
// USAGE (from the repo root):
//   node scripts/lc-fork-adjudication.js
// Optional overrides (env):
//   VOIDED_GROUP_ID=<id>   Part-B voided cohort (default lds_wed-1900_2026-07-22)
//   COMPLETE_LIMIT=<n>     cap the number of COMPLETE groups decomposed in Part B
//                          (default: all; a cap is logged loudly, never silent)
//   INCLUDE_DEV=1          include isDev groups in the enumerations (default off)

// MUST be imported before firebaseAdmin.js — loads .env.local as a side effect.
import { requireFirebaseCreds } from './loadLocalEnv.js';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';
import { fetchEligibleGroupsByStatus } from '../api/_utils/tournamentGroupService.js';
import {
  GROUP_STATUS,
  TOURNAMENT_GAME_MODE,
  WEEK_DAYS_REQUIRED,
  computeComposite,
  isFinalSnapshotDegraded,
} from '../src/constants/leagueTournament.js';

const VOIDED_GROUP_ID = process.env.VOIDED_GROUP_ID || 'lds_wed-1900_2026-07-22';
const COMPLETE_LIMIT = process.env.COMPLETE_LIMIT ? Number(process.env.COMPLETE_LIMIT) : null;
const INCLUDE_DEV = process.env.INCLUDE_DEV === '1';

// Fail with a one-line instruction rather than firebase-admin's opaque
// `app/invalid-credential` stack trace.
requireFirebaseCreds();

// ---- small formatting helpers (no I/O) ----
const n2 = (v) => (Number.isFinite(v) ? (Math.round(v * 100) / 100).toString() : '-');
const pad = (s, w) => String(s).padEnd(w);
const padL = (s, w) => String(s).padStart(w);

function dayNumbersOf(dailyScores) {
  return Object.keys(dailyScores || {})
    .map((k) => /^day(\d+)$/.exec(k))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

function recordedDateRange(dailyScores) {
  const dates = Object.keys(dailyScores || {})
    .filter((k) => /^day\d+$/.test(k))
    .map((k) => dailyScores[k]?.recordedDate)
    .filter((d) => typeof d === 'string' && d.length > 0)
    .sort();
  return { min: dates[0] || null, max: dates[dates.length - 1] || null, count: dates.length };
}

/**
 * Read every agentBattle stamped with this groupId, applying the SAME filters
 * fetchGroupAgentScores (tournamentBanking.js:61-88) applies when it computes
 * the stored `agentPoints` — TOURNAMENT_GAME_MODE only, non-empty string
 * ownerId, finite currentScore — so the per-seat agentPoints reproduced here
 * matches what banking summed into dailyScores. Selects the fuller field set the
 * A1 decomposition needs (whole scoreState + trades), which fetchGroupAgentScores
 * does not read. READ-ONLY.
 */
async function readGroupAgentBattles(db, groupId) {
  const snap = await db.collection('agentBattles')
    .where('groupId', '==', groupId)
    .select('gameMode', 'ownerId', 'status', 'createdAt', 'scoreState', 'trades')
    .get();
  const bySeat = {};
  const rejected = [];
  snap.forEach((doc) => {
    const b = doc.data();
    // Mirror fetchGroupAgentScores' joint-stamp safety: a groupId without the
    // tournament gameMode is malformed and is NOT counted into agentPoints.
    if (b.gameMode !== TOURNAMENT_GAME_MODE) { rejected.push({ id: doc.id, why: `gameMode=${b.gameMode}` }); return; }
    if (typeof b.ownerId !== 'string' || b.ownerId.length === 0) { rejected.push({ id: doc.id, why: 'empty ownerId' }); return; }
    const ss = b.scoreState || {};
    const trades = Array.isArray(b.trades) ? b.trades : [];
    const lockedSum = trades.reduce((a, t) => a + (Number.isFinite(t?.lockedPoints) ? t.lockedPoints : 0), 0);
    const breakdown = ss.bankedBadgePoints?.breakdown || {};
    (bySeat[b.ownerId] ||= []).push({
      id: doc.id,
      status: b.status,
      createdAt: b.createdAt,
      activeScore: ss.activeScore,
      currentScore: ss.currentScore,
      bankedScore: ss.bankedScore,
      badgeTotal: ss.bankedBadgePoints?.total,
      breakdown,        // { day{N}: { points, badges, recordedAt } }
      tradeCount: trades.length,
      lockedSum,
      trades,
    });
  });
  return { bySeat, rejected };
}

/**
 * Aggregate a seat's per-day badge increments across ALL its battle docs,
 * keyed by the AGENT-battle day index (bankedBadgePoints.breakdown.day{N},
 * where N = the battle's own trading day — NOT necessarily the group's
 * dailyScores day index; the two are derived independently). Returns the
 * sorted day list with per-day points and the ≤5 / ≥6 split — the FORK
 * discriminator.
 */
function badgeByDay(docs) {
  const perDay = {};
  for (const d of docs) {
    for (const [k, v] of Object.entries(d.breakdown || {})) {
      const m = /^day(\d+)$/.exec(k);
      if (!m) continue;
      const dn = Number(m[1]);
      perDay[dn] = (perDay[dn] || 0) + (Number.isFinite(v?.points) ? v.points : 0);
    }
  }
  const days = Object.keys(perDay).map(Number).sort((a, b) => a - b);
  let inWeek = 0;
  let beyond = 0;
  for (const dn of days) {
    if (dn <= WEEK_DAYS_REQUIRED) inWeek += perDay[dn];
    else beyond += perDay[dn];
  }
  return { perDay, days, inWeek, beyond };
}

function printGroupHeader(id, g) {
  const dayNs = dayNumbersOf(g.dailyScores);
  const latest = dayNs.length ? dayNs[dayNs.length - 1] : 0;
  const rd = recordedDateRange(g.dailyScores);
  console.log(`  status            : ${g.status}`);
  console.log(`  isTraining        : ${g.isTraining === true}   isDev: ${g.isDev === true}`);
  console.log(`  baselinePolicy    : ${g.baselinePolicy ?? '(none)'}`);
  console.log(`  createdAt         : ${g.createdAt ?? '(none)'}`);
  if (g.status === GROUP_STATUS.VOIDED) {
    console.log(`  voidedAt/reason   : ${g.voidedAt ?? '(none)'} / ${g.voidedReason ?? '(none)'}`);
  }
  console.log(`  day keys present  : ${dayNs.length ? dayNs.map((d) => `day${d}`).join(', ') : '(none)'}`);
  console.log(`  recordedDate rng  : ${rd.min ?? '(none)'} .. ${rd.max ?? '(none)'}  (${rd.count} dated day(s))`);
  console.log(`  latest dayN       : ${latest}  (WEEK_DAYS_REQUIRED = ${WEEK_DAYS_REQUIRED}${latest > WEEK_DAYS_REQUIRED ? `; ${latest - WEEK_DAYS_REQUIRED} extra day(s) — zombie` : ''})`);
  console.log(`  isFinalSnapshotDegraded : ${isFinalSnapshotDegraded(g)}  (day-5-carried ⇒ paused pending manual review)`);
}

/** Part B — full A1 decomposition + per-day badge trajectory for ONE group. */
async function decomposeGroup(db, id, g) {
  console.log('');
  console.log('--------------------------------------------------------------');
  console.log(`GROUP  tournamentGroups/${id}`);
  console.log('--------------------------------------------------------------');
  printGroupHeader(id, g);

  const dailyScores = g.dailyScores || {};
  const dayNs = dayNumbersOf(dailyScores);
  const finalDayN = dayNs.length ? dayNs[dayNs.length - 1] : 0;

  // Seat identity = union of the roster, the closeScores keys, and the battle
  // owners — so a foreign/mis-stamped seat surfaces rather than being dropped.
  const playerUids = (g.players || []).map((p) => p?.odUserId).filter(Boolean);
  const { bySeat, rejected } = await readGroupAgentBattles(db, id);
  const csKeys = {}; // plain-object set — avoids a Set mutation method that would trip the read-only self-audit grep
  for (const dn of dayNs) for (const k of Object.keys(dailyScores[`day${dn}`]?.closeScores || {})) csKeys[k] = true;
  const seats = Array.from(new Set([...playerUids, ...Object.keys(csKeys), ...Object.keys(bySeat)]));

  if (rejected.length) {
    console.log(`  NOTE: ${rejected.length} agentBattle doc(s) stamped with this groupId were REJECTED from agentPoints (mirrors fetchGroupAgentScores):`);
    for (const r of rejected) console.log(`        ${r.id}: ${r.why}`);
  }

  // ---- Group-side per-day trajectory (per day, per seat, the agent-layer score) ----
  console.log('');
  console.log('  [B.1] GROUP-SIDE per-day trajectory  (dailyScores.day{N}.closeScores) — group day index = banking max+1');
  console.log(`        ${pad('day', 6)}${pad('recordedDate', 14)}${pad('seat', 30)}${padL('agentPts', 11)}${padL('userPts', 11)}${padL('composite', 12)}  carried`);
  for (const dn of dayNs) {
    const entry = dailyScores[`day${dn}`] || {};
    const cs = entry.closeScores || {};
    const carriedDay = entry.agentScoresCarried === true;
    for (const seat of seats) {
      const e = cs[seat];
      if (!e) continue;
      console.log(`        ${pad(`day${dn}`, 6)}${pad(entry.recordedDate ?? '-', 14)}${pad(seat, 30)}${padL(n2(e.agentPoints), 11)}${padL(n2(e.totalPoints), 11)}${padL(n2(e.compositePoints), 12)}  ${carriedDay ? 'CARRIED' : ''}`);
    }
  }

  // ---- Agent-battle A1 decomposition + doc census ----
  console.log('');
  console.log('  [B.2] A1 DECOMPOSITION  (agentBattles where groupId==id; agentPoints = Σ currentScore)');
  console.log('        currentScore identity per doc = activeScore + Σ trades[].lockedPoints + bankedBadgePoints.total');
  console.log(`        ${pad('seat', 30)}${padL('#docs', 6)}${padL('agentPts', 11)}${padL('Σbadge', 11)}${padL('Σlocked', 11)}${padL('Σactive', 11)}${padL('resid', 9)}   |  ${padL('1.5·user', 10)}${padL('composite', 12)}  term`);
  const finalCs = dailyScores[`day${finalDayN}`]?.closeScores || {};
  for (const seat of seats) {
    const docs = bySeat[seat] || [];
    const agentPts = docs.reduce((a, d) => a + (Number.isFinite(d.currentScore) ? d.currentScore : 0), 0);
    const sBadge = docs.reduce((a, d) => a + (Number.isFinite(d.badgeTotal) ? d.badgeTotal : 0), 0);
    const sLocked = docs.reduce((a, d) => a + d.lockedSum, 0);
    const sActive = docs.reduce((a, d) => a + (Number.isFinite(d.activeScore) ? d.activeScore : 0), 0);
    const resid = agentPts - (sActive + sLocked + sBadge); // ≠0 ⇒ identity break (a finding)
    const fe = finalCs[seat] || {};
    const userTerm = Number.isFinite(fe.totalPoints) ? computeComposite(0, fe.totalPoints) : NaN; // 1.5·user
    const composite = fe.compositePoints;
    // Which term carries the agent mass?
    const mags = [['badge', Math.abs(sBadge)], ['locked', Math.abs(sLocked)], ['active', Math.abs(sActive)]].sort((a, b) => b[1] - a[1]);
    const term = docs.length ? mags[0][0] : '(no battles)';
    console.log(`        ${pad(seat, 30)}${padL(docs.length, 6)}${padL(n2(agentPts), 11)}${padL(n2(sBadge), 11)}${padL(n2(sLocked), 11)}${padL(n2(sActive), 11)}${padL(n2(resid), 9)}   |  ${padL(n2(userTerm), 10)}${padL(n2(composite), 12)}  ${term}`);
  }

  // ---- Per-doc census (fork adjudicator: #docs/seat vs banked-day count) ----
  console.log('');
  console.log(`  [B.3] DOC CENSUS per seat  (banked-day count = ${finalDayN}; #docs ≫ that ⇒ long window ⇒ FORK-1 shape)`);
  for (const seat of seats) {
    const docs = bySeat[seat] || [];
    console.log(`        ${seat}  — ${docs.length} doc(s)`);
    for (const d of docs) {
      console.log(`          ${pad(d.id, 24)} status=${pad(d.status ?? '-', 10)} created=${pad(d.createdAt ?? '-', 26)} current=${padL(n2(d.currentScore), 10)} active=${padL(n2(d.activeScore), 9)} badgeTot=${padL(n2(d.badgeTotal), 9)} trades=${padL(d.tradeCount, 3)} Σlocked=${padL(n2(d.lockedSum), 9)}`);
    }
  }

  // ---- THE DISCRIMINATOR: per-seat badge increments by AGENT day index ----
  console.log('');
  console.log('  [B.4] BADGE-BY-DAY  (bankedBadgePoints.breakdown.day{N}.points, summed across a seat\'s docs)');
  console.log(`        AGENT day index — independent of the group day index above. Split at day ${WEEK_DAYS_REQUIRED}:`);
  console.log('        inflation confined to days ≥6 ⇒ FORK-1 (broken window, closed by void + Guard-1 clamp);');
  console.log('        inflation already present in days 1–5 ⇒ FORK-2 (real scoring-model defect).');
  for (const seat of seats) {
    const docs = bySeat[seat] || [];
    if (!docs.length) continue;
    const { perDay, days, inWeek, beyond } = badgeByDay(docs);
    const cells = days.map((dn) => `day${dn}=${n2(perDay[dn])}`).join('  ');
    console.log(`        ${seat}`);
    console.log(`          per-day: ${cells || '(no badge breakdown recorded)'}`);
    console.log(`          Σ days 1–${WEEK_DAYS_REQUIRED} = ${n2(inWeek)}   |   Σ days ${WEEK_DAYS_REQUIRED + 1}+ = ${n2(beyond)}   ⇒  days-≥6 share of |badge| = ${(() => {
      const denom = Math.abs(inWeek) + Math.abs(beyond);
      return denom > 0 ? `${Math.round((Math.abs(beyond) / denom) * 100)}%` : 'n/a';
    })()}`);
  }
}

async function main() {
  const db = getFirebaseAdmin();

  console.log('==============================================================');
  console.log('L-C UNFREEZE GATE — credentialed READ-ONLY pass');
  console.log('Part A: preconditions #2/#3   |   Part B: FORK-1/FORK-2 evidence');
  console.log('READ-ONLY: only .get() reads. No writes, no flag changes.');
  console.log('==============================================================');

  // =============================== PART A ===============================
  // Precondition #2 (no poisoned cohort remains in BATTLE) + #3 (day-5-carried
  // status at flip). VOIDED ≠ BATTLE, so the known zombie lds_wed-1900_2026-07-22
  // must NOT appear here — its absence is the L-A void doing its job.
  console.log('');
  console.log('### PART A — status==BATTLE enumeration (EXPECTED EMPTY) #######');
  const battleGroups = await fetchEligibleGroupsByStatus(db, GROUP_STATUS.BATTLE, {
    includeDev: INCLUDE_DEV,
    excludeTraining: true,
  });
  if (battleGroups.length === 0) {
    console.log('  (empty)  ✓ precondition #2 MET — no ranked group in BATTLE.');
    console.log('           ✓ precondition #3 vacuous — no BATTLE group can be day-5-carried at flip.');
  } else {
    console.log(`  ${battleGroups.length} BATTLE group(s) present — precondition #2 NOT vacuous; inspect each:`);
    console.log(`  ${pad('id', 30)}${pad('createdAt', 26)}${pad('recordedDate min..max', 26)}  degraded(day-5-carried)`);
    for (const g of battleGroups) {
      const rd = recordedDateRange(g.dailyScores);
      const degraded = isFinalSnapshotDegraded(g);
      console.log(`  ${pad(g.id, 30)}${pad(g.createdAt ?? '-', 26)}${pad(`${rd.min ?? '-'} .. ${rd.max ?? '-'}`, 26)}  ${degraded ? 'YES — pause pending manual review (#3)' : 'no'}`);
    }
    console.log('  → precondition #2 requires each of these to predate NO scoring fix / be void-eligible.');
    console.log('  → precondition #3: any "YES" above blocks the flip until manually cleared.');
  }

  // =============================== PART B ===============================
  // Fork evidence: the voided cohort (read by id — VOIDED, so it won't appear in
  // Part A) plus every COMPLETE non-training group.
  console.log('');
  console.log('### PART B — FORK-1/FORK-2 evidence (A1 decomposition) #########');

  const targets = [];

  // The voided cohort, read directly by id.
  const vSnap = await db.collection('tournamentGroups').doc(VOIDED_GROUP_ID).get();
  if (vSnap.exists) {
    targets.push({ id: VOIDED_GROUP_ID, g: vSnap.data(), tag: 'VOIDED cohort (the zombie)' });
  } else {
    console.log(`  NOTE: voided cohort tournamentGroups/${VOIDED_GROUP_ID} NOT FOUND (id changed?). Set VOIDED_GROUP_ID=... to override.`);
  }

  // Every COMPLETE non-training group (the blast-radius sample).
  let completeGroups = await fetchEligibleGroupsByStatus(db, GROUP_STATUS.COMPLETE, {
    includeDev: INCLUDE_DEV,
    excludeTraining: true,
  });
  const totalComplete = completeGroups.length;
  if (COMPLETE_LIMIT != null && completeGroups.length > COMPLETE_LIMIT) {
    console.log(`  NOTE: ${totalComplete} COMPLETE non-training group(s) found; COMPLETE_LIMIT=${COMPLETE_LIMIT} — decomposing the first ${COMPLETE_LIMIT}, OMITTING ${totalComplete - COMPLETE_LIMIT}. (Unset COMPLETE_LIMIT to see all.)`);
    completeGroups = completeGroups.slice(0, COMPLETE_LIMIT);
  } else {
    console.log(`  ${totalComplete} COMPLETE non-training group(s) found — decomposing all.`);
  }
  for (const g of completeGroups) targets.push({ id: g.id, g, tag: 'COMPLETE non-training' });

  for (const t of targets) {
    console.log('');
    console.log(`>>> ${t.tag}`);
    await decomposeGroup(db, t.id, t.g);
  }

  // ---- Cross-group day-index ceiling (Phase 0.5 RUN 2 tail) ----
  console.log('');
  console.log('--------------------------------------------------------------');
  console.log('  Max dailyScores day index across the Part-B target set:');
  let maxDayIdx = 0;
  let maxDayGroup = null;
  for (const t of targets) {
    const ns = dayNumbersOf(t.g.dailyScores);
    const top = ns.length ? ns[ns.length - 1] : 0;
    if (top > maxDayIdx) { maxDayIdx = top; maxDayGroup = t.id; }
  }
  console.log(`    max = day${maxDayIdx}${maxDayGroup ? ` (${maxDayGroup})` : ''}   (any > ${WEEK_DAYS_REQUIRED} is a zombie shape)`);

  console.log('');
  console.log('==============================================================');
  console.log('FORK RULE (pre-registered — the founder adjudicates from above):');
  console.log(`  FORK-1 (broken window): #docs/seat ≫ banked-day count, badge mass concentrated in days ≥${WEEK_DAYS_REQUIRED + 1},`);
  console.log('          per-day increments each within a one-day envelope, agentPts ≈ composite.');
  console.log('          ⇒ closed by the L-A void + L-B Guard-1 clamp; §7 reduces to "confirm no model change."');
  console.log(`  FORK-2 (real defect): badge inflation already inside days 1–${WEEK_DAYS_REQUIRED}, or #docs/seat ≈ banked-day count`);
  console.log('          with magnitudes exceeding a one-week envelope, or a non-zero "resid" (identity break),');
  console.log('          or any lockedPoints that cannot reconcile against its stored entry/exit prices.');
  console.log('          ⇒ a scoring-model fix must land BEFORE any unfreeze.');
  console.log('  If the assembled agentPts/composite do not reproduce the displayed orbs at all — that mismatch');
  console.log('  is itself the finding: stop and report it.');
  console.log('==============================================================');
  console.log('READ-ONLY pass complete. No document was modified.');
}

main().then(() => process.exit(0)).catch((err) => { console.error('adjudication pass failed:', err); process.exit(3); });
