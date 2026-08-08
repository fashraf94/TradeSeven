// api/agent/equip-watchlist.js
//
// Phase 5B1 — POST /api/agent/equip-watchlist. Equips one committed watchlist
// to an agent. When that agent next deploys, decide.js folds the watchlist's
// tickers into the candidate pool (see api/_utils/watchlistEquip.js).
//
// Cardinality (E2): one agent equips one watchlist — equipping a different
// watchlist overwrites the previous equip. Equip is blocked while the agent
// has an active battle (E3 — the equip is locked at battle start), mirroring
// the equipBundle / deployExperimentToAgent activeBattleId guard.
//
// Idempotent: equipping the already-equipped watchlist is a 200 no-op with no
// shadow log (V-8). Atomic: agent + watchlist reads and the agent write happen
// in one transaction.
//
// Pattern reference: api/forge/watchlists/[id]/commit.js (transaction body,
// sentinel error map, shadow-log fire-and-forget). Delta: two-doc read
// (agents + watchlists), single-doc write (agents).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { txUpdateAgentSettings } from '../_utils/agentSettingsTx.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
import { waitUntil } from '@vercel/functions';
// Archetype Phase 2 (P2.4a): DARK equip-time compiler — both calls return
// null before any read/write while COMPILER_ENABLED=false (byte-identical).
import { COMPILER_ENABLED } from '../../src/config/featureFlags.js';
import { prepareCompileInputs, writeCompiledBuildsInTx } from '../_utils/compileOnSettingsChange.js';
import { validateWriteEpochInTx } from '../_utils/compositionWriteEpoch.js';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__equip_watchlist:';
const SENTINEL_TO_HTTP = Object.freeze({
  epoch_closed:     [409, 'epoch_closed',     'Configuration writes are briefly paused for a system identity update. Try again in a few minutes.'],
  agent_not_found:     [404, 'agent_not_found',     'Agent not found.'],
  forbidden:           [403, 'forbidden',           'Not authorized for this resource.'],
  battle_active:       [409, 'battle_active',       'Cannot equip a watchlist while the agent has an active battle.'],
  watchlist_not_found: [404, 'watchlist_not_found', 'Watchlist not found.'],
  not_committed:       [400, 'not_committed',       'A watchlist must be committed before it can be equipped.'],
});

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { agentId, watchlistId } = req.body || {};
  if (!isValidForgeId(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      message: `agentId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (!isValidForgeId(watchlistId)) {
    return res.status(400).json({
      error: 'invalid_watchlist_id',
      message: `watchlistId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }

  const db = getFirebaseAdmin();
  const agentRef = db.collection('agents').doc(agentId);
  const watchlistRef = db.collection('watchlists').doc(watchlistId);
  const nowIso = new Date().toISOString();

  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      // All reads before the write (Firestore transaction rule).
      const agentSnap = await tx.get(agentRef);
      // Composition write-epoch fence (design note §3): read-phase validation —
      // zero I/O while dark; a closed epoch 409s with nothing written (A41).
      await validateWriteEpochInTx(tx, db, { sentinel: SENTINEL_PREFIX });
      const watchlistSnap = await tx.get(watchlistRef);

      // Agent must exist, belong to the caller, and be battle-free.
      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      if (agent.activeBattleId) throw new Error(SENTINEL_PREFIX + 'battle_active');

      // Watchlist must exist, belong to the caller, and be committed.
      // A soft-deleted watchlist reads as gone (mirrors the watchlist endpoints).
      if (!watchlistSnap.exists) throw new Error(SENTINEL_PREFIX + 'watchlist_not_found');
      const watchlist = watchlistSnap.data();
      if (watchlist.deletedAt) throw new Error(SENTINEL_PREFIX + 'watchlist_not_found');
      if (watchlist.userId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      if (watchlist.status !== 'committed') throw new Error(SENTINEL_PREFIX + 'not_committed');

      // Idempotent: same watchlist already equipped → 200 no-op, no write.
      if (agent.equippedWatchlistId === watchlistId) {
        return {
          idempotent: true,
          equippedWatchlistId: watchlistId,
          equippedWatchlistName: agent.equippedWatchlistName ?? null,
          equippedAt: agent.equippedAt ?? null,
        };
      }

      const equippedWatchlistName = watchlist.name || '';
      // P2.4a compile reads (dark no-op): must precede the first tx write.
      const compileInputs = await prepareCompileInputs(tx, {
        agentRef,
        db, // Sol review #11: record-scoped candidate selection
        nextEquippedBundleIds: agent.equippedBundleIds || [],
        enabled: COMPILER_ENABLED,
      });
      // settingsRev rides structurally (Release 2 changelog #7).
      txUpdateAgentSettings(tx, agentRef, {
        equippedWatchlistId: watchlistId,
        equippedWatchlistName,
        equippedAt: nowIso,
        updatedAt: nowIso,
      });
      // P2.4a (dark no-op): compile rides the settingsRev increment above.
      const compilePreviews = writeCompiledBuildsInTx(tx, {
        agentRef,
        agentId,
        agent,
        nextState: {},
        bundles: compileInputs?.bundles,
        // PR 3.5: candidate-mode projection inputs (absent while dark)
        ruleDocs: compileInputs?.ruleDocs ?? null,
        allBundles: compileInputs?.allBundles ?? null,
        candidateMode: compileInputs?.candidateMode, // #11: the record's selection, never bare flag
        enabled: COMPILER_ENABLED,
        nowIso,
      });
      return {
        idempotent: false,
        equippedWatchlistId: watchlistId,
        equippedWatchlistName,
        equippedAt: nowIso,
        compilePreviews,
      };
    });
  } catch (txErr) {
    if (typeof txErr?.message === 'string' && txErr.message.startsWith(SENTINEL_PREFIX)) {
      const code = txErr.message.slice(SENTINEL_PREFIX.length);
      const mapped = SENTINEL_TO_HTTP[code];
      if (mapped) {
        const [statusCode, errorKey, humanCopy] = mapped;
        return res.status(statusCode).json({ error: errorKey, message: humanCopy });
      }
    }
    console.error('[Phase5B1] equip-watchlist error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not equip watchlist.' });
  }

  // Shadow log only on a real state change (V-8 — no log on idempotent no-op).
  if (!txResult.idempotent) {
    waitUntil(
      logSignalDrops({
        stage: 'watchlist_equip',
        userId: user.uid,
        agentId,
        watchlistId,
        equippedWatchlistName: txResult.equippedWatchlistName,
        equippedAt: txResult.equippedAt,
        loggedAt: nowIso,
      }).catch(() => {}),
    );
  }

  console.log(
    `[Phase5B1] equip-watchlist: agent ${agentId} → watchlist ${watchlistId} ` +
    `(idempotent=${txResult.idempotent})`,
  );

  // compilePreviews is ADDITIVE and appears only under COMPILER_ENABLED (P2.4a).
  return res.status(200).json({
    agentId,
    equippedWatchlistId: txResult.equippedWatchlistId,
    equippedWatchlistName: txResult.equippedWatchlistName,
    equippedAt: txResult.equippedAt,
    idempotent: txResult.idempotent,
    ...(txResult.compilePreviews ? { compilePreviews: txResult.compilePreviews } : {}),
  });
}
