// api/cron/process-draft-claims.js
// Processes pending waiver claims for all active Snake Draft battles, and
// (merged 2026-07-04 from the retired pre-market-warmup cron, which shared
// this schedule) seeds the daily FantasyTimes consensus document.
// Target execution: 9:25 AM ET Mon-Fri — after the 9:24 AM ET client
// submission cutoff, before the 9:30 AM ET market open.
//
// Schedule: 25 13,14 * * 1-5 — fires at BOTH 13:25 and 14:25 UTC so that
// exactly one firing lands at 9:25 AM ET under both EDT and EST.
// getClaimProcessingWindow() gates the claims path to the 9:20-9:35 AM ET
// window; the off-DST firing exits early with a skipped response.
// claimSystem.lastProcessedDay makes processing idempotent per battle trading
// day. The consensus-seeding block self-gates on isPreMarketWindow().
//
// Processing flow:
//   1. Fetch all battle drafts with claimSystem.enabled
//   2. For each draft, get all pending claims
//   3. Process claims in waiver priority order (lowest daily scorer first)
//   4. After approval, that player moves to back of priority queue
//   5. If denied (stock taken), try their next-ranked claim immediately
//   6. Update rosters, free agent pools, and processing log

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
// P1b tournament claims branch. Benign module cycle: tournamentClaims
// imports this file's isAlreadyProcessedForDay (the guard is reused as-is);
// both sides export hoisted function declarations only.
import {
  fetchEligibleTournamentGroups,
  processClaimsForTournamentGroup,
} from '../_utils/tournamentClaims.js';
// Merged 2026-07-04 from the retired pre-market-warmup cron (shared the
// 25 13,14 schedule): FantasyTimes consensus seeding — the load-bearing half
// of that cron. seedConsensus/flushExpiredCatalysts are self-contained utils.
import { isPreMarketWindow, isTodayHoliday, formatDateString, getETDate } from '../_utils/marketSchedule.js';
import { seedConsensus } from '../_utils/fantasyTimesConsensus.js';
import { flushExpiredCatalysts } from '../_utils/validatedCatalystCache.js';

// ============================================
// LOGGING
// ============================================

const LOG_PREFIX = '[ClaimProcessingCron]';

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} ${LOG_PREFIX}`;
  if (data) {
    console[level](`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console[level](`${prefix} ${message}`);
  }
}

const logInfo = (message, data) => log('log', message, data);
const logWarn = (message, data) => log('warn', message, data);
const logError = (message, data) => log('error', message, data);

// ============================================
// FIREBASE ADMIN
// ============================================

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

// ============================================
// TIMEZONE & TRADING DAY HELPERS
// ============================================

const CLAIM_WINDOW_START_MIN = 9 * 60 + 20; // 9:20 AM ET
const MARKET_OPEN_MIN = 9 * 60 + 30;        // 9:30 AM ET
const CLAIM_WINDOW_END_MIN = 9 * 60 + 35;   // 9:35 AM ET (exclusive)

/**
 * DST-safe claim-window check. Converts a UTC instant to ET wall-clock via
 * Intl.DateTimeFormat parts (no offset math, no Date-string re-parsing).
 *
 * The cron fires at both 13:25 and 14:25 UTC; exactly one of those lands at
 * 9:25 AM ET in any season. This guard admits only the in-window firing.
 *
 * @param {Date} [now] - UTC instant; injectable for tests.
 * @returns {{ inWindow: boolean, isPastOpen: boolean, etTime: string }}
 *   inWindow:   9:20 <= t < 9:35 AM ET
 *   isPastOpen: t >= 9:30 AM ET — execution still uses the stale pre-open
 *               snapshot economics, but late landings should be visible
 *   etTime:     'HH:MM' ET, for logging
 */
export function getClaimProcessingWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hourCycle: 'h23', // not hour12:false — h24 ICU locales render midnight as "24"
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const etHour = Number(parts.find(p => p.type === 'hour').value);
  const etMinute = Number(parts.find(p => p.type === 'minute').value);
  const minutes = etHour * 60 + etMinute;
  return {
    inWindow: minutes >= CLAIM_WINDOW_START_MIN && minutes < CLAIM_WINDOW_END_MIN,
    isPastOpen: minutes >= MARKET_OPEN_MIN,
    etTime: `${String(etHour).padStart(2, '0')}:${String(etMinute).padStart(2, '0')}`,
  };
}

/**
 * Idempotency read for claimSystem.lastProcessedDay (written below after each
 * successful processing batch). claimSystem is initialized WITHOUT this field
 * (src/services/draftService.js:534-538, api/cron/snake-draft-autopick.js:323-327),
 * so it only exists once a day has been processed; the >= 1 carve-out is
 * defensive against future shape changes pre-setting it to 0 (day 0 = battle
 * not started, when no processing should be skipped on equality).
 *
 * @param {Object|undefined} claimSystem - draft.claimSystem
 * @param {number} currentDay - per-battle trading day (0-5)
 * @returns {boolean} true if this trading day was already processed
 */
export function isAlreadyProcessedForDay(claimSystem, currentDay) {
  return currentDay >= 1 && claimSystem?.lastProcessedDay === currentDay;
}

function getEasternTime() {
  const now = new Date();
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(etString);
}

// 2026 US Stock Market Holidays (NYSE/NASDAQ)
// Duplicated from src/utils/marketHolidays.js since serverless functions can't import from src/.
const US_MARKET_HOLIDAYS_2026 = [
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03',
  '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07',
  '2026-11-26', '2026-12-25',
];

function isMarketHoliday(dateStr) {
  return US_MARKET_HOLIDAYS_2026.includes(dateStr);
}

function formatDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isTradingDay() {
  const et = getEasternTime();
  const day = et.getDay();
  if (day < 1 || day > 5) return false;
  return !isMarketHoliday(formatDateStr(et));
}

// Duplicated from snake-draft-daily-scores.js — serverless can't share src/ imports
function getBattleStartDate(completionTime) {
  const completed = new Date(completionTime);
  const etString = completed.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etString);

  const dayOfWeek = et.getDay();
  const currentMinutes = et.getHours() * 60 + et.getMinutes();
  const marketOpenMinutes = 9 * 60 + 30;

  let startDate = new Date(et);

  const isNonTradingDay = (d) =>
    d.getDay() === 0 || d.getDay() === 6 || isMarketHoliday(formatDateStr(d));

  if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isMarketHoliday(formatDateStr(startDate))) {
    if (currentMinutes >= marketOpenMinutes) {
      startDate.setDate(startDate.getDate() + 1);
      while (isNonTradingDay(startDate)) {
        startDate.setDate(startDate.getDate() + 1);
      }
    }
  } else {
    while (isNonTradingDay(startDate)) {
      startDate.setDate(startDate.getDate() + 1);
    }
  }

  return formatDateStr(startDate);
}

function getCurrentTradingDay(battleStartTime, battleStartDate) {
  if (!battleStartTime && !battleStartDate) return 0;

  let startDay;
  if (battleStartDate) {
    startDay = new Date(battleStartDate + 'T12:00:00');
    startDay.setHours(0, 0, 0, 0);
  } else {
    const computedStartDate = getBattleStartDate(battleStartTime);
    startDay = new Date(computedStartDate + 'T12:00:00');
    startDay.setHours(0, 0, 0, 0);
  }

  const currentDay = new Date(getEasternTime());
  currentDay.setHours(0, 0, 0, 0);

  if (currentDay < startDay) return 0;

  let tradingDays = 0;
  const checkDate = new Date(startDay);
  while (checkDate <= currentDay && tradingDays < 6) {
    const dayOfWeek = checkDate.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && !isMarketHoliday(formatDateStr(checkDate))) {
      tradingDays++;
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }

  return Math.min(tradingDays, 5);
}

// ============================================
// WAIVER PRIORITY (INLINE FALLBACK)
// ============================================

/**
 * Calculate waiver priority for a draft.
 * Phase 3 will populate currentWaiverPriority from the daily scoring cron.
 * Until then, this inline fallback computes priority from dailyData.
 *
 * @param {Object} draft - Full draft document
 * @returns {string[]} Ordered array of odUserIds (lowest scorer = index 0 = first pick)
 */
function calculateWaiverPriority(draft) {
  const players = draft.players || [];
  if (players.length === 0) return [];

  // Use stored priority if available (populated by Phase 3)
  if (draft.claimSystem?.currentWaiverPriority?.length > 0) {
    return [...draft.claimSystem.currentWaiverPriority];
  }

  // Inline fallback: compute from dailyData
  const currentDay = getCurrentTradingDay(
    draft.battleStartTime || draft.createdAt,
    draft.battleStartDate
  );

  if (currentDay < 1) {
    // No scores yet — reverse draft order (last picker gets first waiver pick)
    return players.map(p => p.odUserId).reverse();
  }

  // Find the most recent day with recorded scores
  const dailyData = draft.dailyData || {};
  let scoreDayKey = null;
  for (let d = currentDay; d >= 1; d--) {
    if (dailyData[`day${d}`]?.closeScores) {
      scoreDayKey = `day${d}`;
      break;
    }
  }

  if (!scoreDayKey) {
    return players.map(p => p.odUserId).reverse();
  }

  const closeScores = dailyData[scoreDayKey].closeScores;
  const playerScores = players.map(p => ({
    odUserId: p.odUserId,
    dailyPoints: closeScores[p.odUserId]?.totalPoints || 0,
  }));

  // Sort ascending — lowest score = highest priority (index 0)
  playerScores.sort((a, b) => a.dailyPoints - b.dailyPoints);
  return playerScores.map(p => p.odUserId);
}

// ============================================
// CLAIM PROCESSING ALGORITHM
// ============================================

/**
 * Process all pending claims for a single draft.
 *
 * Algorithm (from spec section 3.4):
 *   1. Fetch all pending claims, group by user, sort each user's by rank
 *   2. Build processing queue ordered by waiver priority
 *   3. For each user in queue:
 *      - Try their highest-ranked pending claim
 *      - If addSymbol available AND dropSymbol on roster → APPROVE
 *        → Move user to END of queue (back of line)
 *      - If addSymbol taken → DENY ("claimed_by_higher_priority")
 *        → User stays at FRONT, try next-ranked claim immediately
 *      - If dropSymbol not on roster → DENY ("drop_not_on_roster")
 *        → Try next claim
 *   4. Write results to claim docs + draft processingLog + updated rosters
 */
async function processClaimsForDraft(db, draft) {
  const draftId = draft.id;

  // Per-battle trading day, computed once — used for the idempotency check
  // and reused for the processing log + lastProcessedDay write below.
  const currentDay = getCurrentTradingDay(
    draft.battleStartTime || draft.createdAt,
    draft.battleStartDate
  );

  if (isAlreadyProcessedForDay(draft.claimSystem, currentDay)) {
    logInfo(`Draft ${draftId}: claims already processed for day ${currentDay} — skipping`);
    return { status: 'already_processed', day: currentDay, processed: 0 };
  }

  const draftRef = db.collection('drafts').doc(draftId);
  const claimsRef = draftRef.collection('claims');

  // 1. Fetch all pending claims
  const pendingSnap = await claimsRef.where('status', '==', 'pending').get();

  if (pendingSnap.empty) {
    logInfo(`Draft ${draftId}: No pending claims`);
    return { status: 'no_claims', processed: 0 };
  }

  // Group claims by user, sort each user's claims by rank
  const claimsByUser = {};
  pendingSnap.forEach(doc => {
    const claim = { id: doc.id, ...doc.data() };
    if (!claimsByUser[claim.odUserId]) {
      claimsByUser[claim.odUserId] = [];
    }
    claimsByUser[claim.odUserId].push(claim);
  });

  // Sort each user's claims by rank (ascending — rank 1 = most wanted)
  for (const userId of Object.keys(claimsByUser)) {
    claimsByUser[userId].sort((a, b) => a.rank - b.rank);
  }

  // 2. Build processing queue ordered by waiver priority
  const waiverPriority = calculateWaiverPriority(draft);

  // Build queue: only include users who have pending claims
  // Users in priority list who have claims go first, in priority order.
  // Users with claims but NOT in priority list go at the end.
  const queue = [];
  const usersWithClaims = new Set(Object.keys(claimsByUser));

  for (const userId of waiverPriority) {
    if (usersWithClaims.has(userId)) {
      queue.push(userId);
      usersWithClaims.delete(userId);
    }
  }
  // Append any remaining users not in priority list
  for (const userId of usersWithClaims) {
    queue.push(userId);
  }

  // 3. Process claims
  // Track mutable state during processing
  const currentPlayers = JSON.parse(JSON.stringify(draft.players)); // Deep copy
  const currentFreeAgents = JSON.parse(JSON.stringify(draft.freeAgents || {}));
  const results = []; // { odUserId, claimId, dropSymbol, addSymbol, status, reason }

  // Track which claims each user has remaining (by index into their sorted list)
  const userClaimIndex = {};
  for (const userId of Object.keys(claimsByUser)) {
    userClaimIndex[userId] = 0;
  }

  // Process the queue — users rotate to back after approval
  let maxIterations = pendingSnap.size * 2; // Safety limit
  let iterations = 0;

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    const userId = queue.shift(); // Take first user from queue

    const userClaims = claimsByUser[userId];
    const claimIdx = userClaimIndex[userId];

    // No more claims for this user
    if (claimIdx >= userClaims.length) continue;

    const claim = userClaims[claimIdx];
    const player = currentPlayers.find(p => p.odUserId === userId);

    if (!player) {
      // Player not found in draft — skip all their claims
      results.push({
        odUserId: userId,
        claimId: claim.id,
        dropSymbol: claim.dropSymbol,
        addSymbol: claim.addSymbol,
        status: 'denied',
        reason: 'player_not_found',
      });
      userClaimIndex[userId] = userClaims.length; // Exhaust their claims
      continue;
    }

    // Check if dropSymbol is still on roster
    const dropIdx = player.picks.findIndex(s => s === claim.dropSymbol);
    if (dropIdx === -1) {
      // Drop asset no longer on roster — deny and try next claim
      results.push({
        odUserId: userId,
        claimId: claim.id,
        dropSymbol: claim.dropSymbol,
        addSymbol: claim.addSymbol,
        status: 'denied',
        reason: 'drop_not_on_roster',
      });
      userClaimIndex[userId] = claimIdx + 1;
      // Stay at front of queue — re-add to front
      queue.unshift(userId);
      continue;
    }

    const dropCategory = player.pickCategories[dropIdx];

    // Check if addSymbol is still in free agent pool
    const categoryPool = currentFreeAgents[claim.category] || [];
    const addAssetIdx = categoryPool.findIndex(a => a.symbol === claim.addSymbol);

    if (addAssetIdx === -1) {
      // Add asset no longer available — deny and try next claim
      results.push({
        odUserId: userId,
        claimId: claim.id,
        dropSymbol: claim.dropSymbol,
        addSymbol: claim.addSymbol,
        status: 'denied',
        reason: 'claimed_by_higher_priority',
      });
      userClaimIndex[userId] = claimIdx + 1;
      // Stay at front — re-add to front
      queue.unshift(userId);
      continue;
    }

    // APPROVE the claim
    const addAsset = categoryPool[addAssetIdx];

    // Update roster: replace dropSymbol with addSymbol
    player.picks[dropIdx] = claim.addSymbol;
    // pickCategories stays the same (category-locked swap)

    // Update free agent pool: remove added asset, add dropped asset
    currentFreeAgents[claim.category] = categoryPool.filter(a => a.symbol !== claim.addSymbol);
    currentFreeAgents[dropCategory] = currentFreeAgents[dropCategory] || [];
    currentFreeAgents[dropCategory].push({
      symbol: claim.dropSymbol,
      name: claim.dropSymbol, // May not have full name
      category: dropCategory,
    });

    results.push({
      odUserId: userId,
      claimId: claim.id,
      dropSymbol: claim.dropSymbol,
      addSymbol: claim.addSymbol,
      status: 'approved',
      reason: null,
    });

    userClaimIndex[userId] = claimIdx + 1;

    // Move user to BACK of queue (they may have another claim)
    if (claimIdx + 1 < userClaims.length) {
      queue.push(userId);
    }
  }

  // 4. Write results to Firestore
  const batch = db.batch();
  const processedAt = new Date().toISOString();

  // Update each claim document
  for (const result of results) {
    const claimDocRef = claimsRef.doc(result.claimId);
    batch.update(claimDocRef, {
      status: result.status,
      denialReason: result.reason || null,
      processedAt,
    });
  }

  // Build processing log entry
  const logEntry = {
    day: currentDay,
    processedAt,
    results: results.map(r => ({
      odUserId: r.odUserId,
      dropSymbol: r.dropSymbol,
      addSymbol: r.addSymbol,
      status: r.status,
      reason: r.reason,
    })),
  };

  // Update draft document with new rosters, free agents, and processing log
  const existingLog = draft.claimSystem?.processingLog || [];

  batch.update(draftRef, {
    players: currentPlayers,
    freeAgents: currentFreeAgents,
    'claimSystem.lastProcessedDay': currentDay,
    'claimSystem.processingLog': [...existingLog, logEntry],
  });

  await batch.commit();

  const approved = results.filter(r => r.status === 'approved').length;
  const denied = results.filter(r => r.status === 'denied').length;

  logInfo(`Draft ${draftId}: Processed ${results.length} claims — ${approved} approved, ${denied} denied`);

  return { status: 'processed', total: results.length, approved, denied };
}

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req, res) {
  // --- Cron/Admin Authentication ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  logInfo('Starting claim processing cron job');

  // --- FantasyTimes consensus seeding (merged from the retired
  // pre-market-warmup cron, which shared this 25 13,14 schedule). Independent
  // of claim processing and self-gated on the pre-market window, so it fires on
  // the same ~9:25 AM ET landing. Non-blocking: a failure here must never block
  // claim processing. The old cron's price-cache "warming" was dropped
  // deliberately — it wrote a per-serverless-instance in-memory cache invisible
  // to api/stocks/prices, keyed per-symbol vs that route's composite key, so it
  // never served a live read. (Behavior note: the old cron skipped consensus on
  // days with no active battles; seeding is now unconditional on pre-market
  // trading days — strictly more correct for the FantasyTimes readers.)
  if (isPreMarketWindow() && !isTodayHoliday()) {
    try {
      const todayStr = formatDateString(getETDate());
      await seedConsensus(todayStr);
      logInfo(`FantasyTimes consensus seeded for ${todayStr}`);
    } catch (err) {
      logWarn(`Consensus seed failed (non-blocking): ${err.message}`);
    }
    try {
      await flushExpiredCatalysts();
      logInfo('Flushed expired validated catalysts');
    } catch (err) {
      logWarn(`Catalyst cache flush failed (non-blocking): ${err.message}`);
    }
  }

  // DST guard: of the two daily firings (13:25 and 14:25 UTC), admit only
  // the one that lands in the 9:20-9:35 AM ET claim window.
  const win = getClaimProcessingWindow(new Date());
  if (!win.inWindow) {
    logInfo(`Outside 9:20-9:35 AM ET claim window (${win.etTime} ET) — skipping`);
    return res.status(200).json({
      skipped: true,
      reason: 'not_claim_window',
      etTime: win.etTime,
    });
  }
  if (win.isPastOpen) {
    logWarn(`Claim processing executing at/after the 9:30 AM ET open (${win.etTime} ET) — prices are the stale pre-open snapshot`);
  }

  // Check if it's a trading day
  if (!isTradingDay()) {
    logInfo('Skipping — not a trading day (weekend or market holiday)');
    return res.status(200).json({
      success: true,
      message: 'Skipped — market closed (weekend or holiday)',
      processed: 0,
    });
  }

  // Declared above the try so the outer catch can report it too — the
  // tournament branch's result must never be masked, even by a legacy throw.
  let tournament = { groups: 0, processed: 0, skipped: 0, errors: 0 };

  try {
    const db = getFirebaseAdmin();

    // P1b: tournament claims branch — rides this handler behind the SAME
    // window + trading-day guards above (zero new cron entries; eligibility
    // mirrors the legacy checks). It runs FIRST and is fully independent:
    // zero tournament groups is a clean no-op (the production state until
    // P3+), and a tournament failure must never block the legacy path — so
    // it carries its own catch.
    try {
      const groups = await fetchEligibleTournamentGroups(db);
      tournament.groups = groups.length;
      for (const group of groups) {
        try {
          const result = await processClaimsForTournamentGroup(db, group);
          if (result.status === 'processed') tournament.processed++;
          else tournament.skipped++;
        } catch (error) {
          logError(`Tournament group ${group.id} claims failed`, { error: error.message });
          tournament.errors++;
        }
      }
      if (tournament.groups > 0) logInfo('Tournament claims branch complete', tournament);
    } catch (error) {
      logError('Tournament claims branch failed', { error: error.message });
      tournament = { ...tournament, errors: tournament.errors + 1, failed: true };
    }

    // Query all active battle drafts
    // We check claimSystem.enabled in code since Firestore doesn't support
    // querying nested fields with inequality well in all cases
    const battlesSnapshot = await db.collection('drafts')
      .where('status', '==', 'battle')
      .get();

    // Filter for drafts with claimSystem enabled
    const drafts = [];
    battlesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.claimSystem?.enabled && data.players?.length === 4) {
        drafts.push({ id: doc.id, ...data });
      }
    });

    logInfo(`Found ${drafts.length} drafts with claim system enabled`);

    if (drafts.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No drafts with claim system enabled',
        processed: 0,
        tournament,
      });
    }

    // Process each draft sequentially (not in parallel) to avoid rate limiting
    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    for (const draft of drafts) {
      try {
        const result = await processClaimsForDraft(db, draft);
        if (result.status === 'processed') {
          results.processed++;
        } else {
          results.skipped++;
        }
        results.details.push({ draftId: draft.id, ...result });
      } catch (error) {
        logError(`Error processing draft ${draft.id}`, { error: error.message });
        results.errors++;
        results.details.push({ draftId: draft.id, status: 'error', error: error.message });
      }
    }

    const duration = Date.now() - startTime;
    logInfo('Cron job complete', { ...results, durationMs: duration });

    return res.status(200).json({
      success: true,
      ...results,
      tournament,
      durationMs: duration,
    });

  } catch (error) {
    logError('Cron job failed', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: error.message,
      tournament,
    });
  }
}
