// api/season/create-entry.js
//
// Creates a seasonEntries document when a user joins a season with a
// chosen agent + bundle. Firestore security rules block client-side
// creation (`allow create: if false` in firestore.rules:424), so every
// join must route through this endpoint.
//
// Request:  POST { seasonId, agentId, bundleId }
// Response: { success: true, entryId } | { error: string }
//
// Flow:
//   1. Security middleware + POST guard + requireAuth
//   2. Validate body
//   3. Load season, agent (ownerId check), bundle (forged/equipped)
//   4. Transform bundle.ruleSnapshots -> algorithm.rules[] by reading
//      each live rule doc to recover sourceRef (template id) + priority
//   5. Transaction:
//      - re-read season (verify status)
//      - dup-check query inside the txn (closes the race window)
//      - txn.set pre-allocated entry ref
//      - txn.update(season, { entryCount: FieldValue.increment(1) })
//   6. Return { success: true, entryId }
//
// See api/season/pit-stop-reply.js for the numbered-section pattern.
// See api/cron/season-pit-stop-manage.js:38-42 for the cross-boundary
// FORGE_RULE_TEMPLATES import pattern (api/ -> src/).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { buildRuleSchemaRegistry } from '../_utils/seasonValidation.js';
import { SEASON_CONFIG, SEASON_STATUS, ENTRY_STATUS } from '../_utils/seasonConfig.js';
import { FORGE_RULE_TEMPLATES } from '../../src/data/forgeKnowledgeBase.js';
import { FieldValue } from 'firebase-admin/firestore';
import { logStrategyConfig } from '../_utils/shadowLogger.js';
import { createHash } from 'crypto';

// Phase 6 — Shadow Logger Extension
// Accepted values for the optional entrySource field on the seasonEntries
// document. Used by the strategy_configs shadow stream to bucket training
// examples by creation path.
const ENTRY_SOURCES = new Set([
  'direct_join',
  'manual',
  'workshop',
  'refinement_pair',
]);

export const config = { maxDuration: 15 };

// Built once per cold start. Mirrors api/cron/season-pit-stop-manage.js:42.
const RULE_SCHEMA_REGISTRY = buildRuleSchemaRegistry(FORGE_RULE_TEMPLATES);

// Season rules implemented in seasonRuleRegistry.js use the prefixes
// se- (entry), sx- (exit), sr- (rebalance), ss- (strategy). Templates
// with modes: 'both' (tech-*, fund-*, etc.) are NOT implemented in the
// season engine and would silently no-op or crash at evaluation time,
// so we filter them out here rather than relying on mode alone.
const SEASON_RULE_ID_RE = /^s[exrs]-\d+$/;

/**
 * Transforms a bundle's ruleSnapshots into the algorithm.rules[] shape
 * the season cron expects. Reads each live rule doc to recover sourceRef
 * (template id) and priority — both absent from frozen snapshots.
 *
 * @returns {Promise<{ rules: Object[], skipped: string[] }>}
 */
async function buildBundleRules(db, agentId, bundle) {
  const snapshots = Array.isArray(bundle.ruleSnapshots) ? bundle.ruleSnapshots : [];
  if (snapshots.length === 0) {
    return { rules: [], skipped: ['bundle_empty'] };
  }

  const rulesCol = db.collection('agents').doc(agentId).collection('rules');
  const pairs = await Promise.all(
    snapshots.map((snap) =>
      rulesCol
        .doc(snap.id)
        .get()
        .then((ruleDocSnap) => [snap, ruleDocSnap])
    )
  );

  const rules = [];
  const skipped = [];
  for (const [snap, ruleDocSnap] of pairs) {
    if (!ruleDocSnap.exists) {
      skipped.push(`${snap.id}:missing`);
      continue;
    }
    const rule = ruleDocSnap.data();
    if (rule.isDeleted) {
      skipped.push(`${snap.id}:deleted`);
      continue;
    }
    const templateId = rule.sourceRef;
    if (!templateId || !SEASON_RULE_ID_RE.test(templateId)) {
      skipped.push(`${snap.id}:non-season`);
      continue;
    }
    const schema = RULE_SCHEMA_REGISTRY[templateId];
    if (!schema) {
      skipped.push(`${snap.id}:no-registry`);
      continue;
    }
    if (schema.modes !== 'season' && schema.modes !== 'both') {
      skipped.push(`${snap.id}:wrong-mode`);
      continue;
    }

    rules.push({
      ruleId: templateId,
      category: snap.category || schema.category || null,
      modes: schema.modes,
      priority: typeof rule.priority === 'number' ? rule.priority : 0,
      params: snap.paramValues || {},
      enabled: true,
    });
  }

  return { rules, skipped };
}

/**
 * Builds the full seasonEntries document. Pure function — no I/O.
 * Every field here has at least one reader in the season cron, pipeline,
 * settlement, leaderboard, or pit-stop-manage modules.
 */
function buildEntryDoc(user, seasonId, season, agentId, bundleId, bundle, bundleRules, originMeta) {
  const nowIso = new Date().toISOString();
  const startingCapital = SEASON_CONFIG.STARTING_CAPITAL;

  const displayId =
    'player-' + createHash('sha256').update(user.uid).digest('hex').slice(0, 6);
  const displayName =
    user.name ||
    (user.email ? user.email.split('@')[0] : null) ||
    'Trader';

  const entryStatus =
    season.status === SEASON_STATUS.ACTIVE
      ? ENTRY_STATUS.ACTIVE
      : ENTRY_STATUS.PENDING;

  return {
    // Identity
    seasonId,
    userId: user.uid,
    agentId,
    bundleId,
    displayId,
    displayName,
    entryType: 'human',
    status: entryStatus,
    isPitStopOpen: false,

    // Algorithm snapshot from the selected bundle
    algorithm: {
      version: 1,
      rules: bundleRules,
      ruleCount: bundleRules.length,
      lastModified: nowIso,
      tradingStyle: null,
      description: bundle.name || null,
    },

    // Phase 6 — origin metadata (shadow logger pickup). All optional.
    // sourceExperimentId links refinement pairs: Experiment A → Experiment B.
    entrySource: originMeta?.entrySource || 'direct_join',
    sourceExperimentId: originMeta?.sourceExperimentId || null,
    sourceCollection: originMeta?.sourceCollection || null,
    dimensionValuesAtLaunch: originMeta?.dimensionValues || null,

    // Portfolio — empty, populated by Day 1 cron
    portfolio: {
      cash: startingCapital,
      cashPct: 100,
      totalValue: startingCapital,
      initialValue: startingCapital,
      totalReturn: 0,
      highWaterMark: startingCapital,
      drawdownFromPeak: 0,
      positions: {},
      positionCount: 0,
      sectorWeights: {},
      initialSectorWeights: {},
    },

    // Season state — zeroed
    seasonState: {
      alphaVsSpy: 0,
      currentWeek: 0,
      currentTradingDay: 0,
      weeklyResults: [],
      weeklySectorReturns: {},
      userShortlist: [],
      shortlistWeek: 0,
      totalTradesExecuted: 0,
      totalRuleEvaluations: 0,
    },

    // Populated by cron
    dailySnapshots: [],
    recentActivity: [],
    rulePerformance: {},

    // Cron state — zeroed
    cronState: {
      lastEvaluatedDay: 0,
      lastEvaluatedAt: null,
      lastSettlementAt: null,
      lastAttemptedDay: 0,
      totalHaikuCalls: 0,
      totalTokensUsed: 0,
      missedDays: {},
      lastError: null,
    },

    createdAt: nowIso,
    updatedAt: nowIso,
    completedAt: null,
  };
}

export default async function handler(req, res) {
  // ─── 1. CORS + rate limit ────────────────────────────────────
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }

  // ─── 2. Method ───────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── 3. Firebase auth ────────────────────────────────────────
  const user = await requireAuth(req, res);
  if (!user) return;

  // ─── 4. Validate request body ────────────────────────────────
  const {
    seasonId,
    agentId,
    bundleId,
    // Phase 6 — optional origin metadata (training data capture).
    // None of these affect launch logic; they are persisted on the
    // entry doc and forwarded to the strategy_configs shadow stream.
    sourceExperimentId,
    entrySource,
    sourceCollection,
    dimensionValues,
  } = req.body || {};
  if (
    typeof seasonId !== 'string' || !seasonId ||
    typeof agentId !== 'string' || !agentId ||
    typeof bundleId !== 'string' || !bundleId
  ) {
    return res
      .status(400)
      .json({ error: 'Missing or invalid seasonId, agentId, or bundleId' });
  }

  // Coerce optional origin metadata — unknown / malformed inputs are
  // silently dropped rather than rejected (non-critical path).
  const originMeta = {
    entrySource:
      typeof entrySource === 'string' && ENTRY_SOURCES.has(entrySource)
        ? entrySource
        : 'direct_join',
    sourceExperimentId:
      typeof sourceExperimentId === 'string' && sourceExperimentId
        ? sourceExperimentId
        : null,
    sourceCollection:
      typeof sourceCollection === 'string' && sourceCollection
        ? sourceCollection
        : null,
    dimensionValues:
      dimensionValues && typeof dimensionValues === 'object'
        ? dimensionValues
        : null,
  };

  const db = getFirebaseAdmin();

  try {
    // ─── 5. Load season ────────────────────────────────────────
    const seasonRef = db.collection('seasons').doc(seasonId);
    const seasonSnap = await seasonRef.get();
    if (!seasonSnap.exists) {
      return res.status(404).json({ error: 'Season not found' });
    }
    const season = seasonSnap.data();
    if (
      season.status !== SEASON_STATUS.UPCOMING &&
      season.status !== SEASON_STATUS.ACTIVE
    ) {
      return res
        .status(400)
        .json({ error: `Season is ${season.status}; cannot join` });
    }

    // ─── 6. Load agent + ownership check ───────────────────────
    const agentRef = db.collection('agents').doc(agentId);
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const agent = agentSnap.data();
    if (agent.ownerId !== user.uid) {
      return res.status(403).json({ error: 'Not your agent' });
    }

    // ─── 7. Load bundle ────────────────────────────────────────
    const bundleRef = agentRef.collection('bundles').doc(bundleId);
    const bundleSnap = await bundleRef.get();
    if (!bundleSnap.exists) {
      return res.status(404).json({ error: 'Bundle not found' });
    }
    const bundle = bundleSnap.data();
    if (bundle.status !== 'forged' && bundle.status !== 'equipped') {
      return res
        .status(400)
        .json({ error: `Bundle must be forged or equipped (is ${bundle.status})` });
    }

    // ─── 8. Transform bundle → algorithm.rules[] ───────────────
    const { rules: bundleRules, skipped } = await buildBundleRules(db, agentId, bundle);
    if (bundleRules.length === 0) {
      return res.status(400).json({
        error: 'Bundle contains no season-compatible rules',
        skipped,
      });
    }

    // ─── 9. Pre-allocate entry ref + build doc ─────────────────
    const entryRef = db.collection('seasonEntries').doc();
    const entryDoc = buildEntryDoc(
      user,
      seasonId,
      season,
      agentId,
      bundleId,
      bundle,
      bundleRules,
      originMeta
    );

    // ─── 10. Transactional commit ──────────────────────────────
    // All slow reads (agent, bundle, rule docs, rule transform) happen
    // above the transaction so retries on contention stay cheap. Inside
    // the txn we only re-verify season state, close the duplicate-check
    // race, and atomically write the entry + bump entryCount.
    await db.runTransaction(async (txn) => {
      const freshSeasonSnap = await txn.get(seasonRef);
      if (!freshSeasonSnap.exists) {
        const err = new Error('Season not found');
        err.status = 404;
        throw err;
      }
      const freshSeason = freshSeasonSnap.data();
      if (
        freshSeason.status !== SEASON_STATUS.UPCOMING &&
        freshSeason.status !== SEASON_STATUS.ACTIVE
      ) {
        const err = new Error(`Season is ${freshSeason.status}; cannot join`);
        err.status = 400;
        throw err;
      }

      const dupQuery = db
        .collection('seasonEntries')
        .where('userId', '==', user.uid)
        .where('seasonId', '==', seasonId)
        .limit(1);
      const dupSnap = await txn.get(dupQuery);
      if (!dupSnap.empty) {
        const err = new Error('Already joined this season');
        err.status = 409;
        throw err;
      }

      txn.set(entryRef, entryDoc);
      txn.update(seasonRef, {
        entryCount: FieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      });
    });

    // ─── 11. Shadow log (fire-and-forget — NEVER block response) ──
    // Captures the full launch snapshot for Gemma training. Silent
    // failure — a GCS outage must not impact experiment creation.
    logStrategyConfig({
      userId: user.uid,
      agentId,
      seasonId,
      entryId: entryRef.id,
      bundleId,
      entrySource: originMeta.entrySource,
      sourceExperimentId: originMeta.sourceExperimentId,
      sourceCollection: originMeta.sourceCollection,
      dimensionValues: originMeta.dimensionValues,
      ruleCount: bundleRules.length,
      ruleIds: bundleRules.map((r) => r.ruleId),
      algorithmVersion: entryDoc.algorithm.version,
      bundleName: bundle.name || null,
      startingCapital: SEASON_CONFIG.STARTING_CAPITAL,
      createdAt: entryDoc.createdAt,
      schemaVersion: 1,
    }).catch(() => {});

    // ─── 12. Success ───────────────────────────────────────────
    return res.status(200).json({ success: true, entryId: entryRef.id });
  } catch (error) {
    if (error && typeof error.status === 'number') {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[SEASON] Create entry failed:', error);
    return res
      .status(500)
      .json({ success: false, error: error.message || 'Internal error' });
  }
}
