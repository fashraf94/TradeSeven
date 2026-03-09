// src/services/claimFreeAgencyService.js
// Claim-Based Free Agency System for Snake Draft
//
// Replaces FCFS free agency with a waiver-wire priority system:
// - Players submit ranked claims (drop X, pick up Y) after market close
// - Claims process at 9:25 AM ET next morning in priority order
// - Lowest daily scorer gets first pick (rubber-band mechanic)
// - After a claim is approved, that player moves to back of priority line

import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getCurrentTradingDay } from './snakeDraftDailyService';

// ============================================
// TIMEZONE HELPERS
// ============================================

const getEasternTime = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
};

// ============================================
// CLAIM WINDOW LOGIC
// ============================================

/**
 * Check if the claim submission window is currently open.
 *
 * Stocks & Crypto share the same window:
 *   Opens:  4:00 PM ET (16:00) — after market close
 *   Closes: 9:24 AM ET (09:24) — 1 minute before processing cron
 *
 * The window spans overnight, so it's open when:
 *   currentMinutes >= 960 (4 PM)  OR  currentMinutes <= 564 (9:24 AM)
 */
export const isClaimWindowOpen = (draft) => {
  const et = getEasternTime();
  const hour = et.getHours();
  const minute = et.getMinutes();
  const currentMinutes = hour * 60 + minute;

  const windowOpenMinutes = 16 * 60;       // 4:00 PM ET = 960
  const windowCloseMinutes = 9 * 60 + 24;  // 9:24 AM ET = 564

  // Day of week check: no claims on weekends
  const dayOfWeek = et.getDay(); // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  // On Friday after 4PM, the window does NOT open (no claims before Saturday)
  // because there's no processing on Saturday morning
  if (dayOfWeek === 5 && currentMinutes >= windowOpenMinutes) return false;

  // Block claims on Day 5 (last trading day) — no processing after battle ends
  if (draft) {
    const currentDay = getCurrentTradingDay(
      draft.battleStartTime || draft.createdAt,
      draft.battleStartDate
    );
    // After 4PM on Day 5, window should not open (battle ends after Day 5)
    if (currentDay >= 5) return false;
    // Before 9:24AM: we're in the morning portion of the overnight window.
    // This claim cycle was opened the previous evening (Day N-1 after close).
    // If the current day is Day 5 and it's morning, claims are still valid
    // because they were submitted for Day 5's processing.
  }

  // Overnight window: open after 4PM OR before 9:24AM
  return currentMinutes >= windowOpenMinutes || currentMinutes <= windowCloseMinutes;
};

/**
 * Get detailed claim window status for UI display.
 */
export const getClaimWindowStatus = (draft) => {
  const et = getEasternTime();
  const hour = et.getHours();
  const minute = et.getMinutes();
  const currentMinutes = hour * 60 + minute;

  const windowOpenMinutes = 16 * 60;       // 4:00 PM ET
  const windowCloseMinutes = 9 * 60 + 24;  // 9:24 AM ET
  const processingMinutes = 9 * 60 + 25;   // 9:25 AM ET

  const isOpen = isClaimWindowOpen(draft);

  // Calculate next processing time
  const nextProcessingAt = new Date(et);
  if (currentMinutes >= processingMinutes) {
    // Already past processing today — next is tomorrow
    nextProcessingAt.setDate(nextProcessingAt.getDate() + 1);
  }
  nextProcessingAt.setHours(9, 25, 0, 0);
  // Skip weekends
  while (nextProcessingAt.getDay() === 0 || nextProcessingAt.getDay() === 6) {
    nextProcessingAt.setDate(nextProcessingAt.getDate() + 1);
  }

  // Calculate next window open time
  const opensAt = new Date(et);
  if (currentMinutes >= windowOpenMinutes) {
    // Window is open now or already opened today — next open is tomorrow 4PM
    opensAt.setDate(opensAt.getDate() + 1);
  }
  opensAt.setHours(16, 0, 0, 0);

  // Calculate window close time (next 9:24 AM)
  const closesAt = new Date(et);
  if (currentMinutes > windowCloseMinutes) {
    // Past close today — next close is tomorrow morning
    closesAt.setDate(closesAt.getDate() + 1);
  }
  closesAt.setHours(9, 24, 0, 0);

  return {
    isOpen,
    opensAt,
    closesAt,
    nextProcessingAt,
  };
};

// ============================================
// WAIVER PRIORITY
// ============================================

/**
 * Calculate waiver priority from daily scores.
 * Lowest daily scorer gets priority index 0 (first pick).
 *
 * @param {Object} draft - The full draft document
 * @returns {string[]} Ordered array of odUserIds (lowest scorer first)
 */
export const calculateWaiverPriority = (draft) => {
  const players = draft.players || [];
  if (players.length === 0) return [];

  // Use stored priority if available
  if (draft.claimSystem?.currentWaiverPriority?.length > 0) {
    return draft.claimSystem.currentWaiverPriority;
  }

  // Determine current trading day
  const currentDay = getCurrentTradingDay(
    draft.battleStartTime || draft.createdAt,
    draft.battleStartDate
  );

  // If no trading days yet, use reverse draft order (last picker gets first waiver pick)
  if (currentDay < 1) {
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
};

// ============================================
// CLAIM SUBMISSION
// ============================================

/**
 * Submit a claim (drop X, pick up Y).
 *
 * Validates:
 * - Claim window is open
 * - Player is in the draft
 * - dropSymbol is on the player's roster
 * - addSymbol is in the free agent pool
 * - Category matches (drop category === add category)
 * - Player hasn't exceeded 2 pending claims for this cycle
 *
 * @returns {Object} The created claim document
 */
export const submitClaim = async (draftId, odUserId, username, dropSymbol, addSymbol, category, rank) => {
  // Fetch draft
  const draftRef = doc(db, 'drafts', draftId);
  const draftSnap = await getDoc(draftRef);

  if (!draftSnap.exists()) {
    throw new Error('Draft not found');
  }

  const draft = draftSnap.data();

  // Validate claim window
  if (!isClaimWindowOpen(draft)) {
    throw new Error('Claim window is closed');
  }

  // Find player
  const player = draft.players?.find(p => p.odUserId === odUserId);
  if (!player) {
    throw new Error('Player not found in draft');
  }

  // Validate dropSymbol is on roster
  const dropIndex = player.picks.findIndex(s => s === dropSymbol);
  if (dropIndex === -1) {
    throw new Error(`${dropSymbol} is not on your roster`);
  }

  // Validate category match
  const dropCategory = player.pickCategories[dropIndex];
  if (dropCategory !== category) {
    throw new Error(`Category mismatch: ${dropSymbol} is ${dropCategory}, not ${category}`);
  }

  // Validate addSymbol is a free agent in the same category
  const categoryFreeAgents = draft.freeAgents?.[category] || [];
  const addAsset = categoryFreeAgents.find(a => a.symbol === addSymbol);
  if (!addAsset) {
    throw new Error(`${addSymbol} is not available as a free agent in ${category}`);
  }

  // Calculate which trading day this claim is for (next morning's processing)
  const currentDay = getCurrentTradingDay(
    draft.battleStartTime || draft.createdAt,
    draft.battleStartDate
  );

  // Check if battle still has days remaining
  if (currentDay >= 5) {
    throw new Error('Battle is on its last day — no more claims allowed');
  }

  // forDay = the day this claim will process before (capped at 5)
  const forDay = Math.min(currentDay + 1, 5);

  // Check pending claim limit (max 2 per cycle)
  const claimsRef = collection(db, 'drafts', draftId, 'claims');
  const pendingQuery = query(
    claimsRef,
    where('odUserId', '==', odUserId),
    where('status', '==', 'pending'),
    where('forDay', '==', forDay)
  );
  const pendingSnap = await getDocs(pendingQuery);

  if (pendingSnap.size >= 2) {
    throw new Error('Claim limit reached (2 per cycle). Cancel an existing claim to submit a new one.');
  }

  // Check for duplicate claim (same drop+add combo)
  const isDuplicate = pendingSnap.docs.some(d => {
    const data = d.data();
    return data.dropSymbol === dropSymbol && data.addSymbol === addSymbol;
  });
  if (isDuplicate) {
    throw new Error('You already have a pending claim for this exact swap');
  }

  // Create claim document
  const claimData = {
    odUserId,
    username,
    dropSymbol,
    addSymbol,
    category,
    rank,
    status: 'pending',
    denialReason: null,
    processedAt: null,
    forDay,
    submittedAt: Timestamp.now(),
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(claimsRef, claimData);

  return {
    id: docRef.id,
    ...claimData,
  };
};

// ============================================
// CLAIM CANCELLATION
// ============================================

/**
 * Cancel a pending claim.
 */
export const cancelClaim = async (draftId, claimId, odUserId) => {
  const claimRef = doc(db, 'drafts', draftId, 'claims', claimId);
  const claimSnap = await getDoc(claimRef);

  if (!claimSnap.exists()) {
    throw new Error('Claim not found');
  }

  const claim = claimSnap.data();

  if (claim.odUserId !== odUserId) {
    throw new Error('You can only cancel your own claims');
  }

  if (claim.status !== 'pending') {
    throw new Error(`Cannot cancel a claim that is already ${claim.status}`);
  }

  await updateDoc(claimRef, {
    status: 'cancelled',
  });

  return { success: true };
};

// ============================================
// CLAIM QUERIES
// ============================================

/**
 * Get a user's pending claims for the current cycle, sorted by rank.
 */
export const getUserPendingClaims = async (draftId, odUserId) => {
  const claimsRef = collection(db, 'drafts', draftId, 'claims');
  const q = query(
    claimsRef,
    where('odUserId', '==', odUserId),
    where('status', '==', 'pending'),
    orderBy('rank', 'asc')
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Get all pending claims for a draft, grouped by user.
 */
export const getAllPendingClaims = async (draftId) => {
  const claimsRef = collection(db, 'drafts', draftId, 'claims');
  const q = query(
    claimsRef,
    where('status', '==', 'pending'),
    orderBy('rank', 'asc')
  );

  const snap = await getDocs(q);
  const claims = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Group by user
  const grouped = {};
  for (const claim of claims) {
    if (!grouped[claim.odUserId]) {
      grouped[claim.odUserId] = [];
    }
    grouped[claim.odUserId].push(claim);
  }

  return grouped;
};

/**
 * Get claim results for a specific day from the processing log.
 */
export const getClaimResults = async (draftId, dayNumber) => {
  const draftRef = doc(db, 'drafts', draftId);
  const draftSnap = await getDoc(draftRef);

  if (!draftSnap.exists()) return null;

  const draft = draftSnap.data();
  const log = draft.claimSystem?.processingLog || [];

  return log.find(entry => entry.day === dayNumber) || null;
};

/**
 * Get all claims for a draft (any status), for displaying history.
 */
export const getClaimHistory = async (draftId) => {
  const claimsRef = collection(db, 'drafts', draftId, 'claims');
  const q = query(claimsRef, orderBy('submittedAt', 'desc'));

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ============================================
// REAL-TIME SUBSCRIPTIONS
// ============================================

/**
 * Subscribe to claims for a draft (real-time updates).
 * Returns an unsubscribe function.
 */
export const subscribeToClaimsForDraft = (draftId, callback) => {
  const claimsRef = collection(db, 'drafts', draftId, 'claims');
  const q = query(claimsRef, orderBy('rank', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const claims = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(claims);
  }, (error) => {
    console.error('[ClaimFA] Subscription error:', error);
  });
};

// ============================================
// EXPORTS
// ============================================

export default {
  isClaimWindowOpen,
  getClaimWindowStatus,
  calculateWaiverPriority,
  submitClaim,
  cancelClaim,
  getUserPendingClaims,
  getAllPendingClaims,
  getClaimResults,
  getClaimHistory,
  subscribeToClaimsForDraft,
};
