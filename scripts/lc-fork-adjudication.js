// scripts/lc-fork-adjudication.js
//
// L-C UNFREEZE GATE — credentialed READ-ONLY pass (v2, corrected). Closes
// preconditions #2/#3 (no poisoned cohort in BATTLE; day-5-carried status) AND
// prints the evidence that adjudicates the scoring-anomaly FORK-1 vs FORK-2.
//
// WHY v2 (the correction): v1 measured `bankedBadgePoints.breakdown`, which is
// STRUCTURALLY ZERO here. AGENT_BATTLE_DURATION_MODE = 'fullday'
// (api/_utils/agentBattleService.js:31): each SEAT gets ONE agentBattle doc per
// TRADING DAY, and on a fullday doc `bankedBadgePoints` stays {total:0} — badge
// (bonus) points are computed LIVE into `activeScore`, never banked. So v1
// returned "nothing measured", not "no inflation found". This pass measures the
// bonus where it actually lives:
//   agent-evaluate.js:852  activeScore = Σ heldSymbols (basePoints + bonusPoints)
//   agent-evaluate.js:853  bankedScore = Σ trades[].lockedPoints  (swap churn)
//   agent-evaluate.js:860  currentScore = activeScore + bankedScore + bankedBadgePoints(0)
//   baggerBombUtils.js:587 basePoints = priceChange*10*tierMultiplier   (price-dependent)
//   baggerBombUtils.js:613 bonusPoints = calculatePoints(getBadgesFromHistory(history))
// Per symbol the doc persists ONLY `thresholdHistory.<symbol> = score.history`
// (agent-evaluate.js:884-885) — the {maxMultiplier,minMultiplier} the eval used.
// So:
//   • per-symbol BONUS  → RE-DERIVABLE, no price refetch: getBadgesFromHistoryServer
//     (agentScoring.js:77) → calculatePointsServer (agentScoring.js:92, THRESHOLD_POINTS).
//   • per-doc aggregate BASE = activeScore − Σ(bonus over held symbols).
//   • per-symbol BASE       → NOT RECOVERABLE from persisted data (needs priceChange,
//     i.e. prices — a historical OHLCV refetch, which is a FORBIDDEN pattern). Reported
//     as such, never approximated.
// The day axis is the doc's scored session date (timing.tradingDays[0], NOT the
// UTC createdAt write-stamp — agentBattleService.js:102), split at the group's
// intended 5-day window: the first WEEK_DAYS_REQUIRED distinct trading dates =
// in-envelope, the rest = beyond. Dates are unambiguous; a "day{N}" index is not used.
//
// STRICTLY READ-ONLY: performs only .get() reads. No writes, no flag changes,
// no fence contact (it READS the calibration-fenced agentScoring.js — permitted;
// it never edits it). Does not import voidGroup or any writer.
//   Safety re-audit before running (should match ONLY this header comment):
//     grep -nE '\.(set|update|delete|add|create)\(|runTransaction|FieldValue' scripts/lc-fork-adjudication.js
//
// ENV VARS (same creds as the serverless functions / the void pre-check — locally
// from .env.local in the repo root, loaded by ./loadLocalEnv.js as a side effect):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY     (PEM, literal \n escapes tolerated)
//   (NO EODHD_API_KEY — Firestore only; no price/OHLCV refetch anywhere.)
//
// USAGE (from the repo root):
//   node scripts/lc-fork-adjudication.js
// Optional overrides (env):
//   VOIDED_GROUP_ID=<id>   Part-B voided cohort (default lds_wed-1900_2026-07-22)
//   COMPLETE_LIMIT=<n>     cap the COMPLETE groups decomposed in Part B (default all; a cap is logged)
//   INCLUDE_DEV=1          include isDev groups in the enumerations (default off)
//   ENVELOPE_DAYS=<n>      in-envelope trading-date count (default WEEK_DAYS_REQUIRED=5)

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
// Badge/bonus re-derivation from persisted thresholdHistory — READ-ONLY use of
// the calibration-fenced scorer (import/call permitted; never edited).
import {
  getBadgesFromHistoryServer,
  calculatePointsServer,
  flattenPortfolioServer,
} from '../api/_utils/agentScoring.js';

const VOIDED_GROUP_ID = process.env.VOIDED_GROUP_ID || 'lds_wed-1900_2026-07-22';
const COMPLETE_LIMIT = process.env.COMPLETE_LIMIT ? Number(process.env.COMPLETE_LIMIT) : null;
const INCLUDE_DEV = process.env.INCLUDE_DEV === '1';
const ENVELOPE_DAYS = process.env.ENVELOPE_DAYS ? Number(process.env.ENVELOPE_DAYS) : WEEK_DAYS_REQUIRED;

// Fail with a one-line instruction rather than firebase-admin's opaque
// `app/invalid-credential` stack trace.
requireFirebaseCreds();

// ---- small formatting helpers (no I/O) ----
const n2 = (v) => (Number.isFinite(v) ? (Math.round(v * 100) / 100).toString() : '-');
const pad = (s, w) => String(s).padEnd(w);
const padL = (s, w) => String(s).padStart(w);
const dateOf = (iso) => (typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : '(no-date)');

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

/** Per-symbol BONUS re-derived from a persisted thresholdHistory entry — the
 *  exact chain the eval used (getBadgesFromHistoryServer → calculatePointsServer),
 *  no prices. Returns { badges, bonus }. */
function bonusFromHistory(historyEntry) {
  const badges = getBadgesFromHistoryServer(historyEntry || {});
  return { badges, bonus: calculatePointsServer(badges) };
}

/**
 * Read every agentBattle stamped with this groupId, applying the SAME filters
 * fetchGroupAgentScores (tournamentBanking.js:61-88) applies for the stored
 * agentPoints — TOURNAMENT_GAME_MODE only, non-empty ownerId, finite
 * currentScore. Selects the fuller field set the corrected decomposition needs
 * (whole scoreState + trades + portfolio + thresholdHistory). READ-ONLY.
 */
async function readGroupAgentBattles(db, groupId) {
  const snap = await db.collection('agentBattles')
    .where('groupId', '==', groupId)
    .select('gameMode', 'ownerId', 'status', 'createdAt', 'timing', 'isCpu', 'scoreState', 'trades', 'portfolio', 'thresholdHistory')
    .get();
  const bySeat = {};
  const rejected = [];
  snap.forEach((doc) => {
    const b = doc.data();
    if (b.gameMode !== TOURNAMENT_GAME_MODE) { rejected.push({ id: doc.id, why: `gameMode=${b.gameMode}` }); return; }
    if (typeof b.ownerId !== 'string' || b.ownerId.length === 0) { rejected.push({ id: doc.id, why: 'empty ownerId' }); return; }
    const ss = b.scoreState || {};
    const trades = Array.isArray(b.trades) ? b.trades : [];
    const lockedSum = trades.reduce((a, t) => a + (Number.isFinite(t?.lockedPoints) ? t.lockedPoints : 0), 0);
    const th = b.thresholdHistory || {};

    // GUARD 1 (refute lane — the one that would silently corrupt base): the
    // multi-day nightly reset (agent-daily-scores.js:139-181) zeroes
    // thresholdHistory to {max:0,min:0,badges:[],dailyThresholds:{}} and relocates
    // the bonus into bankedBadgePoints. If it EVER touched a fullday doc, this
    // decomposition would recover Σbonus≈0 while activeScore still embeds the bonus
    // — misattributing ALL bonus to base. Its signatures: a non-zero
    // bankedBadgePoints.total, or a badges/dailyThresholds sub-key on ANY
    // thresholdHistory entry. Must be false on every clean fullday doc — a tripwire,
    // not an expectation. A flagged doc's base/bonus split is NOT trustworthy.
    const badgeTotal = ss.bankedBadgePoints?.total;
    let resetHistorySig = false;
    for (const sym of Object.keys(th)) {
      const e = th[sym];
      if (e && (Array.isArray(e.badges) || (e.dailyThresholds && typeof e.dailyThresholds === 'object' && Object.keys(e.dailyThresholds).length > 0))) { resetHistorySig = true; break; }
    }
    const bankedReset = (Number.isFinite(badgeTotal) && badgeTotal !== 0) || resetHistorySig;

    // Bonus lives in activeScore over the HELD symbols (agent-evaluate.js:852).
    // Re-derive per held symbol from the persisted thresholdHistory; aggregate
    // base = activeScore − Σbonus_held. (Swapped-out legs are in trades/lockedSum,
    // not activeScore, and their base/bonus is not separable — noted below.)
    const held = flattenPortfolioServer(b.portfolio).map((a) => a?.symbol).filter(Boolean);
    const perSymbolBonus = [];
    let bonusHeld = 0;
    for (const sym of held) {
      const { badges, bonus } = bonusFromHistory(th[sym]);
      bonusHeld += bonus;
      perSymbolBonus.push({ sym, bonus, badges });
    }
    const activeScore = Number.isFinite(ss.activeScore) ? ss.activeScore : null;
    const baseHeld = activeScore != null ? activeScore - bonusHeld : null; // aggregate base (held)

    // Date axis = timing.tradingDays[0] — the scored session (agentBattleService.js:102,
    // = computeFullDayExpiry.targetDateStr), DST/holiday/weekend-safe. createdAt is a UTC
    // write-stamp that can land on a different calendar day for evening-ET creations.
    const td = b.timing?.tradingDays?.[0];
    const tradingDate = (typeof td === 'string' && td.length >= 10) ? td.slice(0, 10) : dateOf(b.createdAt);

    (bySeat[b.ownerId] ||= []).push({
      id: doc.id,
      status: b.status,
      createdAt: b.createdAt,
      date: tradingDate,               // bucket axis: the scored trading session
      createdDate: dateOf(b.createdAt), // shown only when it diverges from the trading date
      isCpu: b.isCpu === true || /^cpu[-_]/i.test(b.ownerId),
      activeScore,
      currentScore: ss.currentScore,
      bankedScore: ss.bankedScore, // = Σ trades[].lockedPoints (agent-evaluate.js:853)
      badgeTotal: ss.bankedBadgePoints?.total, // 0 by design on fullday (the v1 zero)
      bankedReset, // GUARD 1 tripwire — true ⇒ base/bonus split NOT trustworthy for this doc
      heldSymbols: held,
      perSymbolBonus,
      bonusHeld,
      baseHeld,
      tradeCount: trades.length,
      lockedSum,
      trades,
    });
  });
  // Stable per-seat ordering by date (each doc = one trading day).
  for (const seat of Object.keys(bySeat)) bySeat[seat].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { bySeat, rejected };
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

/** Part B — corrected base/bonus decomposition (bonus re-derived) for ONE group. */
async function decomposeGroup(db, id, g) {
  console.log('');
  console.log('--------------------------------------------------------------');
  console.log(`GROUP  tournamentGroups/${id}`);
  console.log('--------------------------------------------------------------');
  printGroupHeader(id, g);

  const dailyScores = g.dailyScores || {};
  const dayNs = dayNumbersOf(dailyScores);
  const finalDayN = dayNs.length ? dayNs[dayNs.length - 1] : 0;

  const playerUids = (g.players || []).map((p) => p?.odUserId).filter(Boolean);
  const { bySeat, rejected } = await readGroupAgentBattles(db, id);
  const csKeys = {}; // plain-object set — avoids a Set mutation method that would trip the read-only self-audit grep
  for (const dn of dayNs) for (const k of Object.keys(dailyScores[`day${dn}`]?.closeScores || {})) csKeys[k] = true;
  const seats = Array.from(new Set([...playerUids, ...Object.keys(csKeys), ...Object.keys(bySeat)]));

  if (rejected.length) {
    console.log(`  NOTE: ${rejected.length} agentBattle doc(s) stamped with this groupId were REJECTED from agentPoints (mirrors fetchGroupAgentScores):`);
    for (const r of rejected) console.log(`        ${r.id}: ${r.why}`);
  }

  // Group-relative envelope: the first ENVELOPE_DAYS distinct doc-dates across ALL
  // seats = the intended trading window; later dates = beyond. Dates, not indices.
  const allDates = Array.from(new Set(seats.flatMap((s) => (bySeat[s] || []).map((d) => d.date)))).filter((d) => d !== '(no-date)').sort();
  const inEnvelopeDates = new Set(allDates.slice(0, ENVELOPE_DAYS));
  const beyondDates = allDates.slice(ENVELOPE_DAYS);
  console.log('');
  console.log(`  Doc-date axis (timing.tradingDays[0]): ${allDates.length} distinct trading date(s): ${allDates.join(', ') || '(none)'}`);
  console.log(`  in-envelope (first ${ENVELOPE_DAYS}): ${allDates.slice(0, ENVELOPE_DAYS).join(', ') || '(none)'}`);
  console.log(`  beyond              : ${beyondDates.join(', ') || '(none)'}`);

  // GUARD 1 status — should be zero on a clean fullday cohort. A non-zero count means
  // the multi-day reset touched a doc; that doc's base/bonus split is NOT trustworthy.
  const contaminated = seats.flatMap((s) => (bySeat[s] || []).filter((d) => d.bankedReset).map((d) => `${s}/${d.date}/${d.id}`));
  if (contaminated.length === 0) {
    console.log(`  GUARD 1 (banking/reset): CLEAN — all ${seats.reduce((a, s) => a + (bySeat[s] || []).length, 0)} doc(s) have bankedBadgePoints.total=0 and no reset signature → base/bonus split valid.`);
  } else {
    console.log(`  GUARD 1 (banking/reset): ⚠ ${contaminated.length} doc(s) show a reset signature (bankedBadgePoints.total≠0 or badges/dailyThresholds sub-key) — base/bonus split UNTRUSTWORTHY for: ${contaminated.join(', ')}`);
  }

  // ---- [B.1] group-side per-day trajectory (unchanged — group dailyScores) ----
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

  // ---- [B.2] corrected A1 decomposition (agent side, summed over the seat's docs) ----
  console.log('');
  console.log('  [B.2] A1 DECOMPOSITION  (agentBattles where groupId==id; agentPts = Σ currentScore over the seat\'s day-docs)');
  console.log('        currentScore = activeScore + bankedScore(Σlocked) + bankedBadge(0 fullday);  activeScore = Σheld(base+bonus)');
  console.log('        bonus RE-DERIVED from thresholdHistory (no prices);  base = activeScore − Σbonus (aggregate; per-symbol base unrecoverable)');
  console.log(`        ${pad('seat', 30)}${padL('#docs', 6)}${padL('agentPts', 10)}${padL('Σactive', 10)}${padL('Σbase', 10)}${padL('Σbonus', 10)}${padL('Σlocked', 10)}${padL('badge', 7)}  |${padL('1.5·user', 10)}${padL('composite', 11)}  mass`);
  const finalCs = dailyScores[`day${finalDayN}`]?.closeScores || {};
  for (const seat of seats) {
    const docs = bySeat[seat] || [];
    const agentPts = docs.reduce((a, d) => a + (Number.isFinite(d.currentScore) ? d.currentScore : 0), 0);
    const sActive = docs.reduce((a, d) => a + (Number.isFinite(d.activeScore) ? d.activeScore : 0), 0);
    const sBonus = docs.reduce((a, d) => a + d.bonusHeld, 0);
    const sBase = docs.reduce((a, d) => a + (Number.isFinite(d.baseHeld) ? d.baseHeld : 0), 0);
    const sLocked = docs.reduce((a, d) => a + d.lockedSum, 0);
    const sBadge = docs.reduce((a, d) => a + (Number.isFinite(d.badgeTotal) ? d.badgeTotal : 0), 0);
    const fe = finalCs[seat] || {};
    const userTerm = Number.isFinite(fe.totalPoints) ? computeComposite(0, fe.totalPoints) : NaN; // 1.5·user
    const composite = fe.compositePoints;
    const mags = [['base', Math.abs(sBase)], ['bonus', Math.abs(sBonus)], ['locked', Math.abs(sLocked)]].sort((a, b) => b[1] - a[1]);
    const mass = docs.length ? mags[0][0] : '(no battles)';
    console.log(`        ${pad(seat, 30)}${padL(docs.length, 6)}${padL(n2(agentPts), 10)}${padL(n2(sActive), 10)}${padL(n2(sBase), 10)}${padL(n2(sBonus), 10)}${padL(n2(sLocked), 10)}${padL(n2(sBadge), 7)}  |${padL(n2(userTerm), 10)}${padL(n2(composite), 11)}  ${mass}`);
  }

  // ---- [B.3] per-doc (per-day) census ----
  console.log('');
  console.log('  [B.3] PER-DOC (per trading day) census — each doc = one fullday battle');
  for (const seat of seats) {
    const docs = bySeat[seat] || [];
    console.log(`        ${seat}${docs[0]?.isCpu ? '  [CPU]' : ''}  — ${docs.length} doc(s)`);
    for (const d of docs) {
      const createdNote = d.createdDate !== d.date ? ` (created ${d.createdDate})` : '';
      const resetNote = d.bankedReset ? ' ⚠RESET(split-untrustworthy)' : '';
      console.log(`          ${pad(d.date, 11)} ${pad(d.id, 22)} active=${padL(n2(d.activeScore), 9)} base=${padL(n2(d.baseHeld), 9)} bonus=${padL(n2(d.bonusHeld), 8)} locked=${padL(n2(d.lockedSum), 9)} current=${padL(n2(d.currentScore), 9)} trades=${padL(d.tradeCount, 3)}${createdNote}${resetNote}`);
    }
  }

  // ---- [B.4] THE DISCRIMINATOR: bonus by DATE, in-envelope vs beyond ----
  console.log('');
  console.log('  [B.4] BONUS-BY-DATE  (re-derived bonus per held symbol, summed per day; split at the intended window)');
  console.log('        bonus mass confined to BEYOND dates ⇒ FORK-1 (broken window); bonus already large IN-ENVELOPE ⇒ FORK-2 (real defect).');
  for (const seat of seats) {
    const docs = bySeat[seat] || [];
    if (!docs.length) continue;
    let inEnv = 0;
    let beyond = 0;
    console.log(`        ${seat}${docs[0]?.isCpu ? '  [CPU]' : ''}`);
    for (const d of docs) {
      const where = inEnvelopeDates.has(d.date) ? 'in-env' : 'beyond';
      if (where === 'in-env') inEnv += d.bonusHeld; else beyond += d.bonusHeld;
      const syms = d.perSymbolBonus.filter((s) => s.bonus !== 0).map((s) => `${s.sym}:${n2(s.bonus)}(${s.badges.join('/') || '-'})`).join(' ');
      console.log(`          ${pad(d.date, 11)} ${pad(where, 7)} bonus=${padL(n2(d.bonusHeld), 8)}${d.bankedReset ? ' ⚠RESET' : ''}   ${syms || '(no badges)'}`);
    }
    const denom = Math.abs(inEnv) + Math.abs(beyond);
    const beyondShare = denom > 0 ? `${Math.round((Math.abs(beyond) / denom) * 100)}%` : 'n/a';
    console.log(`          Σ in-envelope bonus = ${n2(inEnv)}   |   Σ beyond bonus = ${n2(beyond)}   ⇒  beyond share of |bonus| = ${beyondShare}`);
  }

  // ---- CPU-inaction detector (filed pre-launch finding; surfaced from data) ----
  const zeroTradeCpu = seats.filter((s) => {
    const docs = bySeat[s] || [];
    return docs.length && docs[0].isCpu && docs.every((d) => d.tradeCount === 0 && d.lockedSum === 0);
  });
  if (zeroTradeCpu.length) {
    console.log('');
    console.log('  [FINDING · competitive balance] CPU seats with 0 trades / 0 swap-churn across ALL docs:');
    for (const s of zeroTradeCpu) {
      const docs = bySeat[s];
      const stand = docs.reduce((a, d) => a + (Number.isFinite(d.currentScore) ? d.currentScore : 0), 0);
      console.log(`          ${s}: ${docs.length} docs, Σlocked=0, standing on pure activeScore = ${n2(stand)} (never pays swap penalties — inaction as dominant strategy). See docs/audits/20260807_PRELAUNCH_FINDING_CPU_INACTION.md`);
    }
  }
}

async function main() {
  const db = getFirebaseAdmin();

  console.log('==============================================================');
  console.log('L-C UNFREEZE GATE — credentialed READ-ONLY pass (v2, corrected)');
  console.log('Part A: preconditions #2/#3   |   Part B: FORK-1/FORK-2 evidence (base vs BONUS)');
  console.log('READ-ONLY: only .get() reads. No writes, no flag changes, no OHLCV refetch.');
  console.log('==============================================================');

  // =============================== PART A ===============================
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
  console.log('');
  console.log('### PART B — FORK-1/FORK-2 evidence (base vs BONUS decomposition) ####');

  const targets = [];
  const vSnap = await db.collection('tournamentGroups').doc(VOIDED_GROUP_ID).get();
  if (vSnap.exists) {
    targets.push({ id: VOIDED_GROUP_ID, g: vSnap.data(), tag: 'VOIDED cohort (the zombie)' });
  } else {
    console.log(`  NOTE: voided cohort tournamentGroups/${VOIDED_GROUP_ID} NOT FOUND (id changed?). Set VOIDED_GROUP_ID=... to override.`);
  }

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

  // n= for the sample the fork rests on.
  const nSample = targets.length;
  console.log(`  SAMPLE SIZE n=${nSample} group(s) decomposed (voided cohort + ${completeGroups.length} COMPLETE).`);
  if (completeGroups.length === 0) {
    console.log('  ⚠  n=1 caveat: ZERO COMPLETE non-training groups exist, so any fork conclusion rests on the SINGLE');
    console.log('     poisoned cohort. It is a case study, not a distribution — state that in the adjudication.');
  }

  for (const t of targets) {
    console.log('');
    console.log(`>>> ${t.tag}`);
    await decomposeGroup(db, t.id, t.g);
  }

  console.log('');
  console.log('==============================================================');
  console.log('FORK RULE (pre-registered — the founder adjudicates from above):');
  console.log('  FORK-1 (broken window): the bonus (badge) mass is concentrated in the BEYOND-envelope date docs;');
  console.log('          in-envelope per-day bonus stays within a normal one-day badge envelope. Agent mass is base/');
  console.log('          churn accumulating over a longer-than-5-day window. ⇒ closed by the L-A void + L-B Guard-1');
  console.log('          clamp (extra days can no longer be banked); §7 reduces to "confirm no model change."');
  console.log('  FORK-2 (real defect): bonus (badge) mass is ALREADY large inside the in-envelope dates (days 1–5),');
  console.log('          i.e. the badge model over-credits within a legitimate 5-day week. ⇒ a scoring-model fix must');
  console.log('          land BEFORE any unfreeze.');
  console.log('  Also watch: if the mass is in BASE (linear price move) or LOCKED (swap churn) rather than BONUS, the');
  console.log('          anomaly is not a badge defect at all — report which term carries it ([B.2] "mass" column).');
  console.log('  Recoverability: per-symbol BASE is not reconstructable from persisted data (needs prices — a');
  console.log('          forbidden OHLCV refetch); only per-doc aggregate base (activeScore − Σbonus) is shown.');
  console.log('  Validity: the split holds as of scoreState.lastScoredAt (thresholdHistory + activeScore co-written)');
  console.log('          and assumes THRESHOLD_POINTS/THRESHOLD_MULTIPLIERS unchanged since (agentScoring.js is fenced,');
  console.log('          so it holds for this cohort). GUARD 1 above must read CLEAN or any flagged doc\'s split is void.');
  console.log('  The script asserts NO verdict — evidence + rule only.');
  console.log('==============================================================');
  console.log('READ-ONLY pass complete. No document was modified.');
}

main().then(() => process.exit(0)).catch((err) => { console.error('adjudication pass failed:', err); process.exit(3); });
