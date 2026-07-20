// api/agent/set-tempo-dial.js
//
// Release 2 (Fenced Customization Bundle V1.1) — POST /api/agent/set-tempo-dial
// (spec Phase 1 item 3). Writes the agent's DESIRED tempo
// (agent.dials.tempo ∈ measured|standard|aggressive; absent = default
// standard). Desired ≠ effective: the clamp layer (tempoDialClamp.js)
// resolves what a battle actually runs, failing closed to standard whenever
// the dial is off or the band table's version binding breaks — always
// visibly, via the provenance object.
//
// DARK-INERT: 404s while TEMPO_DIAL_ENABLED is false (the scouting-board
// pattern). Battle-locked (dial state is snapshot-frozen at battle
// creation). settingsRev increment on every real write (spec changelog #7).
//
// An EXPLICIT 'standard' is stored (not deleted): the clamp's
// selectionSource distinguishes user_dial-standard from default-standard —
// a PR-b blocking test.
//
// Pattern reference: api/agent/equip-lean.js / equip-watchlist.js.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { txUpdateAgentSettings } from '../_utils/agentSettingsTx.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
import { TEMPO_DIAL_ENABLED } from '../../src/config/featureFlags.js';
import { VALID_TEMPO_VALUES } from '../_utils/tempoDialBands.js';
// Mastery P2 (spec §6 L2): the dial-position gate — SETTING 'aggressive'
// requires per-archetype mastery level ≥ 2 under enforcement. Equipped
// state grandfathers by construction: the idempotent same-value branch
// returns BEFORE this gate, and the tick-time clamp (tempoDialClamp.js)
// never consults levels. Leaving aggressive below L2 is one-way until L2
// (documented spec §6 behavior). Dark (enforcement off): no profile read —
// byte-identical.
import { MASTERY_ENFORCEMENT_ENABLED } from '../_utils/masteryConfig.js';
import { masteryProfileRef, archetypeLevelFromProfile, dialAggressiveAllowed } from '../_utils/masteryEnforcement.js';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__set_tempo_dial:';
const SENTINEL_TO_HTTP = Object.freeze({
  agent_not_found: [404, 'agent_not_found', 'Agent not found.'],
  forbidden:       [403, 'forbidden',       'Not authorized for this resource.'],
  battle_active:   [409, 'battle_active',   'Cannot change the tempo dial while the agent has an active battle.'],
  dial_locked:     [403, 'dial_locked',     'The aggressive position unlocks at mastery level 2 for this archetype.'],
});

export default async function handler(req, res) {
  // DARK-INERT gate: the surface does not exist while the flag is off.
  if (!TEMPO_DIAL_ENABLED) {
    return res.status(404).json({ error: 'not_found' });
  }
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { agentId, tempo } = req.body || {};
  if (!isValidForgeId(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      message: `agentId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (!VALID_TEMPO_VALUES.includes(tempo)) {
    return res.status(400).json({
      error: 'invalid_tempo',
      message: `tempo must be one of: ${VALID_TEMPO_VALUES.join(', ')}.`,
    });
  }

  const db = getFirebaseAdmin();
  const agentRef = db.collection('agents').doc(agentId);
  const nowIso = new Date().toISOString();

  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      const agentSnap = await tx.get(agentRef);
      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      if (agent.activeBattleId) throw new Error(SENTINEL_PREFIX + 'battle_active');

      // Idempotent: already at this tempo → 200 no-op, no write. Ordering is
      // load-bearing (grandfathering): a grandfathered aggressive dial
      // re-asserting itself no-ops here and never reaches the gate below.
      if (agent.dials?.tempo === tempo) {
        return { idempotent: true, previousTempo: tempo };
      }

      // Mastery P2 dial gate (§6 L2) — gates SETTING aggressive only; the
      // profile read (spec §7: regardless of XP state; missing ⇒ level 1)
      // precedes the write below.
      if (MASTERY_ENFORCEMENT_ENABLED && tempo === 'aggressive') {
        const profileSnap = await tx.get(masteryProfileRef(db, user.uid));
        const level = archetypeLevelFromProfile(profileSnap.exists ? profileSnap.data() : null, agent.archetype);
        if (!dialAggressiveAllowed(level)) {
          throw new Error(SENTINEL_PREFIX + 'dial_locked');
        }
      }

      const previousTempo = agent.dials?.tempo ?? null;
      // settingsRev rides structurally (Release 2 changelog #7).
      txUpdateAgentSettings(tx, agentRef, {
        // Dotted path: merges into dials without clobbering future siblings.
        'dials.tempo': tempo,
        updatedAt: nowIso,
      });
      return { idempotent: false, previousTempo };
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
    console.error('[set-tempo-dial] error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not set the tempo dial.' });
  }

  if (!txResult.idempotent) {
    waitUntil(
      logSignalDrops({
        stage: 'tempo_dial_set',
        userId: user.uid,
        agentId,
        tempo,
        previousTempo: txResult.previousTempo,
        loggedAt: nowIso,
      }).catch(() => {}),
    );
  }

  console.log(`[set-tempo-dial] agent ${agentId} → ${tempo} (idempotent=${txResult.idempotent})`);

  return res.status(200).json({
    agentId,
    tempo,
    idempotent: txResult.idempotent,
  });
}
