// api/agent/unequip-watchlist.js
//
// Phase 5B1 — POST /api/agent/unequip-watchlist. Clears the agent's equipped
// watchlist (equippedWatchlistId / Name / At → null).
//
// Idempotent: unequipping when nothing is equipped is a 200 no-op with no
// shadow log (V-10). Blocked while the agent has an active battle, mirroring
// the equip endpoint and the equipBundle activeBattleId guard.
//
// Pattern reference: api/forge/watchlists/[id]/uncommit.js (transaction body,
// sentinel error map, shadow-log fire-and-forget).

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
// Build A2 (per-game loadouts; rulings D1, FD-1, FD-3): with PER_GAME_LOADOUT_ENABLED on, the body's `loadout` picks
// whose book this clears. 'league' (or absent, today's behaviour) clears the ranked record's as today, refused while
// the League week holds the loadout and snapshotting the BaggerBomb slot first when it is absent; 'baggerbomb' clears
// the slot's book only ("No book · open market"; the next deploy ranks the whole universe), with no battle lock.
import { PER_GAME_LOADOUT_ENABLED } from '../../src/config/perGameLoadoutFlags.js';
import { LOADOUT_KINDS, baggerbombLoadoutOf, bookFrom, bookIdOf, loadoutKindOf } from '../../src/constants/perGameLoadout.js';
import {
  LEAGUE_LOCKED, baggerbombSlotWith, isRankedAgentDoc, leagueLockedBody, leagueLockedError, materializeOnLeagueWrite,
  readLeagueLockInTx, slotUpdate,
} from '../_utils/perGameLoadout.js';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__unequip_watchlist:';
const SENTINEL_TO_HTTP = Object.freeze({
  epoch_closed:     [409, 'epoch_closed',     'Configuration writes are briefly paused for a system identity update. Try again in a few minutes.'],
  agent_not_found: [404, 'agent_not_found', 'Agent not found.'],
  forbidden:       [403, 'forbidden',       'Not authorized for this agent.'],
  battle_active:   [409, 'battle_active',   'Cannot unequip a watchlist while the agent has an active battle.'],
  // Build A2: a loadout lives on the player's ranked record, never on a clone (reachable only with the flag on).
  not_ranked_agent: [409, 'not_ranked_agent', 'A loadout is set on your agent, not on a game copy of it.'],
});

/** A sentinel thrown in a transaction, as its HTTP answer; null for anything else. */
function sentinelResponse(txErr) {
  if (typeof txErr?.message === 'string' && txErr.message.startsWith(SENTINEL_PREFIX)) {
    const code = txErr.message.slice(SENTINEL_PREFIX.length);
    if (PER_GAME_LOADOUT_ENABLED && code === LEAGUE_LOCKED) return [409, leagueLockedBody(txErr.lock)];
    const mapped = SENTINEL_TO_HTTP[code];
    if (mapped) {
      const [statusCode, errorKey, humanCopy] = mapped;
      return [statusCode, { error: errorKey, message: humanCopy }];
    }
  }
  return null;
}

/**
 * Build A2, `loadout: 'baggerbomb'`: the BaggerBomb slot's book cleared, and nothing else; no battle lock, the ranked
 * record untouched. Idempotent: no BaggerBomb book → 200, no write, no log.
 */
async function unequipBaggerbombBook({ res, user, db, agentRef, agentId, nowIso }) {
  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      const agentSnap = await tx.get(agentRef);
      await validateWriteEpochInTx(tx, db, { sentinel: SENTINEL_PREFIX, actor: user.uid }); // #4: probe-window admission
      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      if (!isRankedAgentDoc(agent)) throw new Error(SENTINEL_PREFIX + 'not_ranked_agent');
      if (bookIdOf(baggerbombLoadoutOf(agent).book) === null) return { idempotent: true };
      tx.update(agentRef, { ...slotUpdate(agent, baggerbombSlotWith(agent, { book: bookFrom(null) })), updatedAt: nowIso });
      return { idempotent: false };
    });
  } catch (txErr) {
    const mapped = sentinelResponse(txErr);
    if (mapped) return res.status(mapped[0]).json(mapped[1]);
    console.error('[Phase5B1] unequip-watchlist baggerbomb loadout error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not unequip watchlist.' });
  }
  if (!txResult.idempotent) {
    waitUntil(
      logSignalDrops({ stage: 'watchlist_unequip', userId: user.uid, agentId, loadout: LOADOUT_KINDS.BAGGERBOMB, loggedAt: nowIso }).catch(() => {}),
    );
  }
  console.log(`[Phase5B1] unequip-watchlist: agent ${agentId} baggerbomb book cleared (idempotent=${txResult.idempotent})`);
  return res.status(200).json({ agentId, equippedWatchlistId: null, idempotent: txResult.idempotent, loadout: LOADOUT_KINDS.BAGGERBOMB });
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { agentId } = req.body || {};
  if (!isValidForgeId(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      message: `agentId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }

  // Build A2: whose book this clears. Flag off, always the League loadout's (the field is not read).
  const loadout = PER_GAME_LOADOUT_ENABLED ? loadoutKindOf(req.body?.loadout) : LOADOUT_KINDS.LEAGUE;
  if (loadout === null) {
    return res.status(400).json({ error: 'invalid_loadout', message: 'loadout must be "baggerbomb" or "league".' });
  }

  const db = getFirebaseAdmin();
  const agentRef = db.collection('agents').doc(agentId);
  const nowIso = new Date().toISOString();

  if (loadout === LOADOUT_KINDS.BAGGERBOMB) {
    return unequipBaggerbombBook({ res, user, db, agentRef, agentId, nowIso });
  }

  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      const agentSnap = await tx.get(agentRef);
      // Composition write-epoch fence (design note §3): read-phase validation —
      // zero I/O while dark; a closed epoch 409s with nothing written (A41).
      await validateWriteEpochInTx(tx, db, { sentinel: SENTINEL_PREFIX, actor: user.uid }); // #4: probe-window admission
      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      // Build A2, FD-3: the League book locks with the archetype for the week (a read; flag off, none).
      if (PER_GAME_LOADOUT_ENABLED) {
        const lock = await readLeagueLockInTx(tx, db, user.uid);
        if (lock.locked) throw leagueLockedError(SENTINEL_PREFIX, lock);
      }
      if (agent.activeBattleId) throw new Error(SENTINEL_PREFIX + 'battle_active');

      // Idempotent: nothing equipped → 200 no-op, no write.
      if (!agent.equippedWatchlistId) {
        return { idempotent: true };
      }

      // P2.4a compile reads (dark no-op): must precede the first tx write.
      const compileInputs = await prepareCompileInputs(tx, {
        agentRef,
        db, // Sol review #11: record-scoped candidate selection
        nextEquippedBundleIds: agent.equippedBundleIds || [],
        enabled: COMPILER_ENABLED,
      });
      // settingsRev rides structurally (Release 2 changelog #7).
      txUpdateAgentSettings(tx, agentRef, {
        equippedWatchlistId: null,
        equippedWatchlistName: null,
        equippedAt: null,
        updatedAt: nowIso,
        // Build A2 (materialize on first write): the BaggerBomb slot, snapshotted from the pre-change fields.
        ...(PER_GAME_LOADOUT_ENABLED ? materializeOnLeagueWrite(agent) : {}),
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
      return { idempotent: false, compilePreviews };
    });
  } catch (txErr) {
    const mapped = sentinelResponse(txErr);
    if (mapped) return res.status(mapped[0]).json(mapped[1]);
    console.error('[Phase5B1] unequip-watchlist error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not unequip watchlist.' });
  }

  // Shadow log only on a real state change (no log on idempotent no-op).
  if (!txResult.idempotent) {
    waitUntil(
      logSignalDrops({
        stage: 'watchlist_unequip',
        userId: user.uid,
        agentId,
        loggedAt: nowIso,
      }).catch(() => {}),
    );
  }

  console.log(
    `[Phase5B1] unequip-watchlist: agent ${agentId} (idempotent=${txResult.idempotent})`,
  );

  // compilePreviews is ADDITIVE and appears only under COMPILER_ENABLED (P2.4a).
  return res.status(200).json({
    agentId,
    equippedWatchlistId: null,
    idempotent: txResult.idempotent,
    ...(txResult.compilePreviews ? { compilePreviews: txResult.compilePreviews } : {}),
  });
}
