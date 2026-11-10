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
// Build A2 (per-game loadouts; rulings D1, FD-1, FD-3): with PER_GAME_LOADOUT_ENABLED on, the body's `loadout` picks
// whose book this equip sets. 'league' (or absent, today's behaviour) writes the ranked record as today, refused while
// the League week holds the loadout and snapshotting the BaggerBomb slot first when it is absent; 'baggerbomb' writes
// the slot's book only, with no battle lock (the next deploy carries it). Flag off, the field is ignored.
import { PER_GAME_LOADOUT_ENABLED } from '../../src/config/perGameLoadoutFlags.js';
import { LOADOUT_KINDS, baggerbombLoadoutOf, bookFrom, bookIdOf, loadoutKindOf } from '../../src/constants/perGameLoadout.js';
import {
  LEAGUE_LOCKED, baggerbombSlotWith, isRankedAgentDoc, leagueLockedBody, leagueLockedError, materializeOnLeagueWrite,
  readLeagueLockInTx, slotUpdate,
} from '../_utils/perGameLoadout.js';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__equip_watchlist:';
const SENTINEL_TO_HTTP = Object.freeze({
  epoch_closed:     [409, 'epoch_closed',     'Configuration writes are briefly paused for a system identity update. Try again in a few minutes.'],
  agent_not_found:     [404, 'agent_not_found',     'Agent not found.'],
  forbidden:           [403, 'forbidden',           'Not authorized for this resource.'],
  battle_active:       [409, 'battle_active',       'Cannot equip a watchlist while the agent has an active battle.'],
  watchlist_not_found: [404, 'watchlist_not_found', 'Watchlist not found.'],
  not_committed:       [400, 'not_committed',       'A watchlist must be committed before it can be equipped.'],
  // Build A2: a loadout lives on the player's ranked record, never on a clone (reachable only with the flag on).
  not_ranked_agent:    [409, 'not_ranked_agent',    'A loadout is set on your agent, not on a game copy of it.'],
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

/** The watchlist checks every equip makes: exists, not soft-deleted, the caller's, committed. Returns its data. */
function equippableWatchlist(watchlistSnap, uid) {
  if (!watchlistSnap.exists) throw new Error(SENTINEL_PREFIX + 'watchlist_not_found');
  const watchlist = watchlistSnap.data();
  if (watchlist.deletedAt) throw new Error(SENTINEL_PREFIX + 'watchlist_not_found');
  if (watchlist.userId !== uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
  if (watchlist.status !== 'committed') throw new Error(SENTINEL_PREFIX + 'not_committed');
  return watchlist;
}

/**
 * Build A2, `loadout: 'baggerbomb'` (FD-1): the BaggerBomb slot's book, and nothing else — the same watchlist checks,
 * no battle lock (a running game keeps the book it deployed with; the next deploy's resync carries this one), the
 * ranked record's own watchlist fields and settingsRev untouched. While the slot is absent it is snapshotted from the
 * ranked fields with this book in place. Idempotent: the BaggerBomb book is already this list → 200, no write, no log.
 */
async function equipBaggerbombBook({ res, user, db, agentRef, watchlistRef, agentId, watchlistId, nowIso }) {
  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      const agentSnap = await tx.get(agentRef);
      await validateWriteEpochInTx(tx, db, { sentinel: SENTINEL_PREFIX, actor: user.uid }); // #4: probe-window admission
      const watchlistSnap = await tx.get(watchlistRef);
      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      if (!isRankedAgentDoc(agent)) throw new Error(SENTINEL_PREFIX + 'not_ranked_agent');
      const watchlist = equippableWatchlist(watchlistSnap, user.uid);
      const current = baggerbombLoadoutOf(agent).book;
      if (bookIdOf(current) === watchlistId) return { idempotent: true, name: current.name ?? null };
      const book = bookFrom(watchlistId, watchlist.name || '');
      tx.update(agentRef, { ...slotUpdate(agent, baggerbombSlotWith(agent, { book })), updatedAt: nowIso });
      return { idempotent: false, name: book.name };
    });
  } catch (txErr) {
    const mapped = sentinelResponse(txErr);
    if (mapped) return res.status(mapped[0]).json(mapped[1]);
    console.error('[Phase5B1] equip-watchlist baggerbomb loadout error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not equip watchlist.' });
  }
  if (!txResult.idempotent) {
    waitUntil(
      logSignalDrops({
        stage: 'watchlist_equip',
        userId: user.uid,
        agentId,
        loadout: LOADOUT_KINDS.BAGGERBOMB,
        watchlistId,
        equippedWatchlistName: txResult.name,
        loggedAt: nowIso,
      }).catch(() => {}),
    );
  }
  console.log(`[Phase5B1] equip-watchlist: agent ${agentId} baggerbomb book → ${watchlistId} (idempotent=${txResult.idempotent})`);
  return res.status(200).json({
    agentId,
    equippedWatchlistId: watchlistId,
    equippedWatchlistName: txResult.name,
    idempotent: txResult.idempotent,
    loadout: LOADOUT_KINDS.BAGGERBOMB,
  });
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

  // Build A2: whose book this equip sets. Flag off, always the League loadout's (the field is not read).
  const loadout = PER_GAME_LOADOUT_ENABLED ? loadoutKindOf(req.body?.loadout) : LOADOUT_KINDS.LEAGUE;
  if (loadout === null) {
    return res.status(400).json({ error: 'invalid_loadout', message: 'loadout must be "baggerbomb" or "league".' });
  }

  const db = getFirebaseAdmin();
  const agentRef = db.collection('agents').doc(agentId);
  const watchlistRef = db.collection('watchlists').doc(watchlistId);
  const nowIso = new Date().toISOString();

  if (loadout === LOADOUT_KINDS.BAGGERBOMB) {
    return equipBaggerbombBook({ res, user, db, agentRef, watchlistRef, agentId, watchlistId, nowIso });
  }

  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      // All reads before the write (Firestore transaction rule).
      const agentSnap = await tx.get(agentRef);
      // Composition write-epoch fence (design note §3): read-phase validation —
      // zero I/O while dark; a closed epoch 409s with nothing written (A41).
      await validateWriteEpochInTx(tx, db, { sentinel: SENTINEL_PREFIX, actor: user.uid }); // #4: probe-window admission
      const watchlistSnap = await tx.get(watchlistRef);

      // Agent must exist, belong to the caller, and be battle-free.
      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      // Build A2, FD-3: the League book locks with the archetype for the week (a read; flag off, none).
      if (PER_GAME_LOADOUT_ENABLED) {
        const lock = await readLeagueLockInTx(tx, db, user.uid);
        if (lock.locked) throw leagueLockedError(SENTINEL_PREFIX, lock);
      }
      if (agent.activeBattleId) throw new Error(SENTINEL_PREFIX + 'battle_active');

      // Watchlist must exist, belong to the caller, and be committed.
      // A soft-deleted watchlist reads as gone (mirrors the watchlist endpoints).
      const watchlist = equippableWatchlist(watchlistSnap, user.uid);

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
      return {
        idempotent: false,
        equippedWatchlistId: watchlistId,
        equippedWatchlistName,
        equippedAt: nowIso,
        compilePreviews,
      };
    });
  } catch (txErr) {
    const mapped = sentinelResponse(txErr);
    if (mapped) return res.status(mapped[0]).json(mapped[1]);
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
