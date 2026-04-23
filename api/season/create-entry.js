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
import { buildTradingCalendar, DEFAULT_SESSION_UNIVERSE } from '../_utils/seasonCalendar.js';
import { FORGE_RULE_TEMPLATES } from '../../src/data/forgeKnowledgeBase.js';
import { FieldValue } from 'firebase-admin/firestore';
import { logStrategyConfig } from '../_utils/shadowLogger.js';
import { createHash } from 'crypto';

// Phase 3 — variable duration
const VALID_DURATIONS_DAYS = [5, 10, 15, 20];
const DEFAULT_DURATION_DAYS = 20;
const VALID_ENTRY_MODES = new Set(['solo', 'tournament']);

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

// Maximum number of simultaneously-active seasonEntries per user. When
// a user has N < MAX_CONCURRENT_ACTIVE_ENTRIES entries in status=ACTIVE
// they may launch a new experiment. Once at the cap, create-entry returns
// 409 until at least one entry completes.
const MAX_CONCURRENT_ACTIVE_ENTRIES = 5;

// Maps the wire-format entrySource string onto the creationSource.method
// enum surfaced on the entry doc. Keeps the two fields aligned without
// forcing callers to send both.
// Deterministic ID for a user's solo season in a given day + duration.
// Multiple retries on the same day with the same duration produce the
// same season doc (idempotent creation); same-day launches with different
// durations produce separate seasons.
function buildSoloSeasonId(userId, startDate, durationDays) {
  const hash = createHash('sha256')
    .update(`${userId}|${startDate}|${durationDays}`)
    .digest('hex')
    .slice(0, 12);
  return `solo-${hash}`;
}

// Construct the private season doc that a solo entry joins. Shape mirrors
// what downstream readers expect from shared tournament seasons, so no
// pipeline change is needed for solo to work end-to-end.
function buildSoloSeasonDoc({ seasonId, userId, startDate, durationDays, durationWeeks }) {
  const { tradingCalendar, weeks } = buildTradingCalendar({
    startDate,
    durationDays,
    includeFinalPitStop: true,  // solo: reuse pit stop as end-of-session debrief
  });
  const nowIso = new Date().toISOString();
  return {
    seasonId,
    ownerId: userId,
    mode: 'solo',
    status: SEASON_STATUS.ACTIVE,
    durationDays,
    durationWeeks,
    tradingCalendar,
    weeks,
    totalWeeks: durationWeeks,
    currentTradingDay: 0,
    currentWeek: 0,
    benchmark: { spyStartPrice: 0, spyCurrentPrice: 0, spyReturn: 0, dailyReturns: [] },
    spyStartPrice: 0,
    universe: DEFAULT_SESSION_UNIVERSE,
    macroEvents: [],
    missedDays: {},
    entryCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function entrySourceToCreationMethod(entrySource) {
  switch (entrySource) {
    case 'workshop':
      return 'workshop';
    case 'refinement_pair':
      return 'refine';
    default:
      return 'manual';
  }
}

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
function buildEntryDoc(user, seasonId, season, agentId, bundleId, bundle, bundleRules, originMeta, lifecycle) {
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

    // Phase 3 — variable duration / mode
    //   mode: 'solo' runs on a per-user private season built at create time
    //         with a calendar matching durationDays. 'tournament' joins a
    //         shared multi-user season (legacy behavior).
    //   durationDays: 5 | 10 | 15 | 20 — source of truth for session length.
    //   durationWeeks: derived (durationDays / 5) — convenience for readers.
    // Old entries without these fields are read as {solo, 20, 4} via the
    // same fallback pattern Phase 1 and Phase 2 used.
    mode: lifecycle.mode,
    durationDays: lifecycle.durationDays,
    durationWeeks: lifecycle.durationWeeks,

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

    // Structured creation provenance. Mirrors the flat fields above but
    // shaped for the Forge card UI and future analytics groupings
    // (manual vs workshop vs refine).
    creationSource: {
      method: entrySourceToCreationMethod(originMeta?.entrySource),
      collectionUsed: originMeta?.sourceCollection || null,
      sourceExperimentId: originMeta?.sourceExperimentId || null,
      timestamp: FieldValue.serverTimestamp(),
    },

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
    seasonId: bodySeasonId,
    agentId,
    bundleId,
    // Phase 3 — variable duration / mode
    mode: bodyMode,
    durationDays: bodyDurationDays,
    // Phase 6 — optional origin metadata (training data capture).
    // None of these affect launch logic; they are persisted on the
    // entry doc and forwarded to the strategy_configs shadow stream.
    sourceExperimentId,
    entrySource,
    sourceCollection,
    dimensionValues,
  } = req.body || {};

  const mode = VALID_ENTRY_MODES.has(bodyMode) ? bodyMode : 'solo';

  // Solo: durationDays is user-controlled, defaults to 20, must be in the
  // valid enum when explicitly provided. Tournament: always 20, silently
  // overriding any user-supplied value (Phase 4 UI may send both naively).
  let durationDays;
  if (mode === 'tournament') {
    durationDays = DEFAULT_DURATION_DAYS;
  } else if (bodyDurationDays === undefined || bodyDurationDays === null) {
    durationDays = DEFAULT_DURATION_DAYS;
  } else if (VALID_DURATIONS_DAYS.includes(bodyDurationDays)) {
    durationDays = bodyDurationDays;
  } else {
    return res.status(400).json({
      error: 'invalid_duration',
      message: `durationDays must be one of ${VALID_DURATIONS_DAYS.join(', ')}.`,
    });
  }
  const durationWeeks = durationDays / 5;
  const lifecycle = { mode, durationDays, durationWeeks };

  // Tournament flow requires an existing seasonId on the body; solo mode
  // creates a per-user private season below, so seasonId is optional there.
  if (
    typeof agentId !== 'string' || !agentId ||
    typeof bundleId !== 'string' || !bundleId
  ) {
    return res
      .status(400)
      .json({ error: 'Missing or invalid agentId or bundleId' });
  }
  if (mode === 'tournament' && (typeof bodySeasonId !== 'string' || !bodySeasonId)) {
    return res
      .status(400)
      .json({ error: 'Missing or invalid seasonId (required for tournament entries)' });
  }
  if (mode === 'solo' && bodySeasonId && typeof bodySeasonId !== 'string') {
    return res
      .status(400)
      .json({ error: 'Invalid seasonId' });
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
    // ─── 5. Load or create season ──────────────────────────────
    // Solo entries get a per-user private season with a synthetic trading
    // calendar sized to durationDays. Tournament entries join an existing
    // shared season doc (unchanged legacy flow).
    let seasonId;
    let seasonRef;
    let season;
    let seasonJustCreated = false;

    if (mode === 'solo') {
      // Private season doc, keyed by a deterministic ID so retries produce
      // the same doc rather than leaking seasons on each attempt.
      const soloStart = new Date().toISOString().slice(0, 10);
      seasonId = buildSoloSeasonId(user.uid, soloStart, durationDays);
      seasonRef = db.collection('seasons').doc(seasonId);
      const existing = await seasonRef.get();
      if (existing.exists) {
        season = existing.data();
      } else {
        season = buildSoloSeasonDoc({
          seasonId,
          userId: user.uid,
          startDate: soloStart,
          durationDays,
          durationWeeks,
        });
        await seasonRef.set(season);
        seasonJustCreated = true;
      }
    } else {
      seasonId = bodySeasonId;
      seasonRef = db.collection('seasons').doc(seasonId);
      const seasonSnap = await seasonRef.get();
      if (!seasonSnap.exists) {
        return res.status(404).json({ error: 'Season not found' });
      }
      season = seasonSnap.data();
      if (
        season.status !== SEASON_STATUS.UPCOMING &&
        season.status !== SEASON_STATUS.ACTIVE
      ) {
        return res
          .status(400)
          .json({ error: `Season is ${season.status}; cannot join` });
      }
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
      originMeta,
      lifecycle
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

      // Cap concurrent active experiments per user. Counts all
      // live entries (ACTIVE + PENDING) across every season so the
      // same user can't exceed the limit whether their entries are
      // already running or still queued against an upcoming season.
      // Reads happen inside the transaction so two simultaneous POSTs
      // can't both slip past the limit.
      const activeQuery = db
        .collection('seasonEntries')
        .where('userId', '==', user.uid)
        .where('status', 'in', [ENTRY_STATUS.ACTIVE, ENTRY_STATUS.PENDING])
        .limit(MAX_CONCURRENT_ACTIVE_ENTRIES);
      const activeSnap = await txn.get(activeQuery);
      if (activeSnap.size >= MAX_CONCURRENT_ACTIVE_ENTRIES) {
        const err = new Error(
          `Maximum ${MAX_CONCURRENT_ACTIVE_ENTRIES} concurrent experiments — complete one to start another.`
        );
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
