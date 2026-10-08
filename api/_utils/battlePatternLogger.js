// api/_utils/battlePatternLogger.js
// Logs structured battle pattern records for Phase 2 earned trait detection.
// Pure data logging — no AI calls, no user-facing effects.
// Called once per battle at completion. Silent failure on errors.

import { getFirebaseAdmin } from './firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
// Integrity follow-up 2 (docs/audits/20261008_BUILD_INTEGRITY_FOLLOWUP_2.md):
// Part C (founder Q4) — the pattern records the mode that governed the battle,
// never its owner-writable `executionMode`; Part B — the owner-writable ledger
// and preset are read through type-checking readers (a malformed ledger used
// to make the whole record fail, silently).
import { LAUNCH_EXECUTION_MODE } from './executionAuthority.js';
import { battleLedgerOf } from './playerFieldReaders.js';
import { clientToken } from './executorMetadata.js';

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

// The mode that governed: every battle runs LAUNCH_EXECUTION_MODE from start
// to end (no server path changes it), so there are no changes to record. The
// battle's own `executionMode` — and any `mode_change` ledger entry — is
// owner-writable and governed nothing.
function extractExecutionMode() {
  return { start: LAUNCH_EXECUTION_MODE, changes: [] };
}

/** At most this many owner-written preset changes are logged per battle. */
const PRESET_CHANGES_MAX = 50;

function extractStrategyPreset(battle) {
  const start = clientToken(battle.strategyPreset) || 'balanced';
  const ledger = battleLedgerOf(battle.battleLedger);
  // The ledger is owner-written: each change keeps only capped strings (a
  // missing timestamp is null — `undefined` makes the Admin SDK reject the
  // whole record), and at most the last PRESET_CHANGES_MAX changes
  // (integrity follow-up 2, review K1-4).
  const changes = ledger
    .filter(e => e.type === 'preset_change')
    .slice(-PRESET_CHANGES_MAX)
    .map(e => ({
      timestamp: clientToken(e.timestamp),
      from: clientToken(e.fromPreset || e.details?.fromPreset) || null,
      to: clientToken(e.toPreset || e.details?.toPreset) || null,
    }));
  return { start, changes };
}

function countEngagement(battle) {
  const ledger = battleLedgerOf(battle.battleLedger);
  return ledger.length;
}

function binEngagement(count) {
  if (count <= 3) return 'low';
  if (count <= 8) return 'medium';
  return 'high';
}

function detectPresetSwitchPattern(battle) {
  const ledger = battleLedgerOf(battle.battleLedger);
  const presetChanges = ledger.filter(e => e.type === 'preset_change');

  if (presetChanges.length === 0) return null;
  if (presetChanges.length >= 2) return 'multiple-switches';

  // Single switch — classify by time of day
  const change = presetChanges[0];
  // A string only: an owner-written object can make `new Date(...)` throw (follow-up 2, Part B).
  const ts = typeof change.timestamp === 'string' && change.timestamp ? new Date(change.timestamp) : null;
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
