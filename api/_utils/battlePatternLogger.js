// api/_utils/battlePatternLogger.js
// Logs structured battle pattern records for Phase 2 earned trait detection.
// Pure data logging — no AI calls, no user-facing effects.
// Called once per battle at completion. Silent failure on errors.

import { getFirebaseAdmin } from './firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Log a battle pattern record to the agent's battlePatterns subcollection.
 *
 * @param {string} agentId - The agent's Firestore document ID
 * @param {string} battleId - The battle's Firestore document ID
 * @param {Object} battle - The full agentBattles document at completion
 */
export async function logBattlePattern(agentId, battleId, battle) {
  try {
  const db = getFirebaseAdmin();

  // Fetch market context (optional — fail gracefully)
  let marketRegime = 'unknown';
  try {
    const mcDoc = await db.collection('indexIntelligence').doc('marketContext').get();
    if (mcDoc.exists) {
      marketRegime = mcDoc.data().regime || 'unknown';
    }
  } catch (err) {
    console.error('[BattlePatternLogger] Failed to fetch market context:', err.message);
  }

  const scoreState = battle?.scoreState || {};
  const currentScore = scoreState.currentScore || 0;
  const opponentScore = scoreState.opponentScore || 0;
  const result = currentScore > opponentScore ? 'win' : (currentScore < opponentScore ? 'loss' : 'draw');

  const engCount = countEngagement(battle);

  const pattern = {
    battleId,
    timestamp: FieldValue.serverTimestamp(),

    // Dimension 1: What rules were active
    activeRuleIds: extractActiveRuleIds(battle),
    bundleId: extractBundleId(battle),

    // Dimension 2: How the user operated
    executionMode: extractExecutionMode(battle),
    strategyPreset: extractStrategyPreset(battle),
    engagementCount: engCount,
    engagementBin: binEngagement(engCount),
    presetSwitchPattern: detectPresetSwitchPattern(battle),

    // Dimension 3: What happened
    result,
    totalScore: Math.round(currentScore * 100) / 100,
    thresholdHits: countThresholdHits(battle),
    penalties: countPenalties(battle),

    // Context
    marketRegime,
  };

  await db.collection('agents').doc(agentId)
    .collection('battlePatterns').doc(battleId)
    .set(pattern);

  } catch (err) {
    // Silent failure — data logging should never break battle flow
    console.error('[BattlePatternLogger] Failed to log pattern:', err.message);
  }
}

// ── Helpers ─────────────────────────────────────────────────

function extractActiveRuleIds(battle) {
  const rules = battle.agentContext?.activeRules;
  if (!Array.isArray(rules)) return [];
  return rules.map(r => r.id || r.sourceRef).filter(Boolean);
}

function extractBundleId(battle) {
  const bundles = battle.agentContext?.equippedBundleIds;
  if (Array.isArray(bundles) && bundles.length > 0) return bundles[0];
  return null;
}

function extractExecutionMode(battle) {
  const start = battle.executionMode || 'copilot';
  const ledger = battle.battleLedger || [];
  const changes = ledger
    .filter(e => e.type === 'mode_change')
    .map(e => ({
      timestamp: e.timestamp,
      from: e.fromMode || e.details?.fromMode || null,
      to: e.toMode || e.details?.toMode || null,
    }));
  return { start, changes };
}

function extractStrategyPreset(battle) {
  const start = battle.strategyPreset || 'balanced';
  const ledger = battle.battleLedger || [];
  const changes = ledger
    .filter(e => e.type === 'preset_change')
    .map(e => ({
      timestamp: e.timestamp,
      from: e.fromPreset || e.details?.fromPreset || null,
      to: e.toPreset || e.details?.toPreset || null,
    }));
  return { start, changes };
}

function countEngagement(battle) {
  const ledger = battle.battleLedger || [];
  return ledger.length;
}

function binEngagement(count) {
  if (count <= 3) return 'low';
  if (count <= 8) return 'medium';
  return 'high';
}

function detectPresetSwitchPattern(battle) {
  const ledger = battle.battleLedger || [];
  const presetChanges = ledger.filter(e => e.type === 'preset_change');

  if (presetChanges.length === 0) return null;
  if (presetChanges.length >= 2) return 'multiple-switches';

  // Single switch — classify by time of day
  const change = presetChanges[0];
  const ts = change.timestamp ? new Date(change.timestamp) : null;
  if (!ts || isNaN(ts.getTime())) return 'single-switch';

  // Convert to ET hour (approximate: UTC-4 for EDT, UTC-5 for EST)
  const utcHour = ts.getUTCHours();
  const etHour = (utcHour - 4 + 24) % 24;

  const toPreset = change.toPreset || change.details?.toPreset || '';
  const fromPreset = change.fromPreset || change.details?.fromPreset || '';

  const isDefensiveMove = toPreset === 'defensive' || fromPreset === 'aggressive';
  const isAggressiveMove = toPreset === 'aggressive' || fromPreset === 'defensive';

  if (isDefensiveMove && etHour >= 14) return 'aggressive-to-defensive-afternoon';
  if (isAggressiveMove && etHour < 11) return 'defensive-to-aggressive-morning';

  return 'single-switch';
}

function countThresholdHits(battle) {
  const history = battle.thresholdHistory || {};
  let bagger = 0;
  let double = 0;
  let triple = 0;

  for (const data of Object.values(history)) {
    const max = data.maxMultiplier || 0;
    if (max >= 1.0) bagger++;
    if (max >= 1.5) double++;
    if (max >= 2.0) triple++;
  }

  return { bagger, double, triple };
}

function countPenalties(battle) {
  const history = battle.thresholdHistory || {};
  let bust = 0;
  let crash = 0;
  let meltdown = 0;

  for (const data of Object.values(history)) {
    const min = data.minMultiplier || 0;
    if (min <= -1.0) bust++;
    if (min <= -1.5) crash++;
    if (min <= -2.0) meltdown++;
  }

  return { bust, crash, meltdown };
}

// TODO: Add retention cleanup cron
// Delete battlePatterns older than 90 days
// Can be a monthly manual run or a cron slot when available
// Pattern: query .where('timestamp', '<', ninetyDaysAgo).limit(100).delete()
