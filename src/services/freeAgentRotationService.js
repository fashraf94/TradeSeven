// freeAgentRotationService.js — V4 Free Agent pool generation and rotation
// Manages the 4-ticker free agent bar that rotates every 90 min (market) or 3 hours (after hours)

import { STOCKS, CRYPTO } from '../data/assets';
import { FREE_AGENT_CONFIG, getFreeAgentConfig } from '../constants/battleTimingV4';
import { CRYPTO_POOL_SYMBOLS } from '../constants/cryptoPool';
import { doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';

// ============================================
// POOL GENERATION
// ============================================

/**
 * Shuffle array (Fisher-Yates)
 * @param {Array} arr
 * @returns {Array} New shuffled array
 */
function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate a free agent pool of 4 tickers
 *
 * Free agents CAN duplicate roster stocks (this is allowed by design).
 *
 * @param {number} rotationCount - Current rotation number (used for crypto inclusion)
 * @param {'mixed' | 'crypto_only'} mode - 'mixed' during market hours, 'crypto_only' after hours
 * @returns {Array<{ symbol: string, name: string, isCrypto: boolean, appearedAt: string }>}
 */
export function generateFreeAgentPool(rotationCount = 0, mode = 'mixed') {
  const poolSize = FREE_AGENT_CONFIG.POOL_SIZE;
  const now = new Date().toISOString();

  // V5: Free agent bar is STOCKS ONLY — crypto is always available in the Swap Market crypto pool
  // Filter out: symbols with dots (API issues), all crypto symbols, and CASH
  const eligibleStocks = STOCKS.filter(s =>
    !s.symbol.includes('.') &&
    !CRYPTO_POOL_SYMBOLS.has(s.symbol) &&
    s.symbol !== 'CASH'
  );

  if (mode === 'crypto_only') {
    // After hours: still show stocks in V5 (crypto pool is always available separately)
    // Fall through to stock generation below
  }

  // All 4 are stocks
  const shuffledStocks = shuffleArray(eligibleStocks);
  const pool = [];
  for (let i = 0; i < Math.min(poolSize, shuffledStocks.length); i++) {
    pool.push({
      symbol: shuffledStocks[i].symbol,
      name: shuffledStocks[i].name,
      isCrypto: false,
      appearedAt: now,
    });
  }

  return shuffleArray(pool);
}

// ============================================
// ROTATION LOGIC
// ============================================

/**
 * Check if free agents should rotate based on nextRotationAt timestamp
 * @param {string} nextRotationAt - ISO timestamp of next rotation
 * @returns {boolean}
 */
export function shouldRotate(nextRotationAt) {
  if (!nextRotationAt) return true;
  return new Date() >= new Date(nextRotationAt);
}

/**
 * Calculate seconds remaining until next rotation
 * @param {string} nextRotationAt - ISO timestamp
 * @returns {number} Seconds remaining (0 if past due)
 */
export function getRotationCountdown(nextRotationAt) {
  if (!nextRotationAt) return 0;
  const diff = new Date(nextRotationAt) - new Date();
  return Math.max(0, Math.floor(diff / 1000));
}

/**
 * Execute a free agent rotation on a battle
 * Uses Firestore transaction to prevent race conditions
 *
 * @param {string} battleId - Battle document ID
 * @returns {Promise<Array>} New free agent pool
 */
export async function rotateFreeAgents(battleId) {
  try {
    const battleRef = doc(db, 'battles', battleId);

    const newPool = await runTransaction(db, async (transaction) => {
      const battleSnap = await transaction.get(battleRef);
      if (!battleSnap.exists()) {
        throw new Error('Battle not found');
      }

      const battleData = battleSnap.data();
      const freeAgents = battleData.freeAgents || {};

      // Check if rotation is actually needed (prevent double-rotation)
      if (freeAgents.nextRotationAt && new Date() < new Date(freeAgents.nextRotationAt)) {
        return freeAgents.current || [];
      }

      // Get current mode based on time of day
      const config = getFreeAgentConfig();
      const rotationCount = (freeAgents.rotationCount || 0) + 1;

      // Generate new pool
      const newAgents = generateFreeAgentPool(rotationCount, config.mode);

      // Archive current pool
      const rotationRecord = {
        agents: freeAgents.current || [],
        rotatedAt: new Date().toISOString(),
        rotationNumber: rotationCount,
        mode: config.mode,
      };

      const rotationHistory = [...(freeAgents.rotationHistory || [])];
      rotationHistory.push(rotationRecord);

      // Keep only last 20 rotation records to prevent unbounded growth
      if (rotationHistory.length > 20) {
        rotationHistory.splice(0, rotationHistory.length - 20);
      }

      // Calculate next rotation time
      const nextRotationAt = new Date(Date.now() + config.rotationMs).toISOString();

      transaction.update(battleRef, {
        'freeAgents.current': newAgents,
        'freeAgents.nextRotationAt': nextRotationAt,
        'freeAgents.rotationCount': rotationCount,
        'freeAgents.rotationHistory': rotationHistory,
        updatedAt: new Date().toISOString(),
      });

      return newAgents;
    });

    return newPool;
  } catch (error) {
    console.error('❌ Error rotating free agents:', error);
    throw error;
  }
}

/**
 * Generate initial free agents for a new battle
 * @returns {{ current: Array, rotationIntervalMs: number, nextRotationAt: string, rotationCount: number, rotationHistory: Array }}
 */
export function createInitialFreeAgents() {
  const config = getFreeAgentConfig();
  const pool = generateFreeAgentPool(0, config.mode);
  const nextRotationAt = new Date(Date.now() + config.rotationMs).toISOString();

  return {
    current: pool,
    rotationIntervalMs: config.rotationMs,
    nextRotationAt,
    rotationCount: 0,
    rotationHistory: [],
  };
}
