// api/agent/file-directive.js
//
// POST /api/agent/file-directive — THE DETERMINISTIC ROUTE (voice-layer
// grounding spec §6.1, R3/F2; the Sep 7 rulings 5 and 6; hazards 18 and 19;
// Phase 0 items 2 and 9). A directive chip files its allowlist id here, and
// `Files:` is true by mechanism: no model is called, the text is the
// server's canonical text for the server-derived archetype, and the receipt
// the client renders comes from the exchange this route writes — through the
// SAME exchange → deriveReceipts → receiptLine path the typed directive already
// uses (`Filed {time}` on the ExecutionCard; hazard 19: one "Filed", one path).
//
// Body: { agentId, battleId, adjustmentId, expectedDirectiveThreadId } — the
// last NULLABLE AND REQUIRED: the client's belief about the current directive
// (null = none). A stale belief is a `conflict`, never a silent overwrite.
//
// ONE TRANSACTION (M4; the P-1a/b/c requirement lands here first), re-reading
// and verifying, in order:
//   7. the route's flag — checked FIRST, before any read: the mutating route
//      is gated itself, not only the chip (404 at 'off' for this caller);
//   1. the authenticated owner (the uid from the token, never the body);
//   2. the battle is active;
//   3. the agent belongs to this battle — a check the chat route never made
//      (Phase 0 §5 item 4; discrepancy 15): this route carries it from the
//      start, and never copies chat.js's absence of it;
//   4. the current directive's thread id equals expectedDirectiveThreadId;
//   5. the adjustment id is permitted for the SERVER-DERIVED archetype
//      (getEffectiveArchetype: the battle's frozen snapshot, else the agent's)
//      — through the allowlist helpers directly (discrepancy 5: the gate's
//      internals are private and nothing new is exported from it);
//   6. the canonical text from getCanonicalText — server-side, never the
//      client's; the client may send `text` and it is ignored;
//   8. the budget, SERVER-DERIVED from the battle's game mode (ruling 6, D-105):
//      a League tournament battle charges the League `agentChatBudget` store
//      (its own collection; resolveBudgetDay inside the transaction, the
//      budget doc read AND written inside it — one cross-document
//      transaction); every other battle charges `chatBudgetUsed` on the battle
//      doc with an explicit in-transaction count. The client never picks a
//      budget. Spec §6.4: a filing charges one message — the scarce resource
//      is influence, not inference.
//
// TWO DECISIONS RECORDED (review R-20, R-39). (a) No review-mode gate: a
// directive filed after the close is in front of the process at the NEXT
// check, which is what a directive is; the chat route strips directives in
// REVIEW mode because the review is a different conversation, not because
// filing is invalid after the session — the battle must be active (check 2),
// nothing more. (b) The HTTP status is the client contract: both clients
// render the ruled line by status code (409 / 422 / 429 / other); the body's
// `status` word (FILING_STATUS) is the record's vocabulary, for logs and tests.
// Then it writes, in the same transaction: the directive to `battle.directive`
// (D-18 latest-wins; the shipped enforce-path shape via directiveFiling.js,
// never a parallel schema) and ONE audit exchange carrying `directiveThreadId`
// top-level AND inside `directive` (ruling 5, hazard 18 — the receipt reader
// looks at both), `adjustmentId`, `canonicalTextVersion`, `messageType:
// 'directive_filed'`, `source: 'chip'` and the top-level `groundingVersion: 1`
// marker (§3.4, M3). The response is sent AFTER the commit.
//
// A concurrent double-tap charges once: both taps read the same slot, the
// first commits, the second's commit fails on the changed battle doc, retries,
// reads the new thread id, and returns `conflict` — no second directive, no
// second charge.
//
// Fence (BUILD_RULES §1): no fenced file edited or called. The battle doc's
// shape is fenced as a concept — this route writes EXISTING keys only
// (`directive`, `chatExchanges`, `chatBudgetUsed`); the League counter lives in
// its own collection for exactly that reason (agentChatBudget.js header).
// §2.3 ratchet: this file is a new direct importer of archetypeAdjustments.js
// (the allowlist helpers the ruling names) and is recorded in
// archetypeImportBoundaryBaseline.json in the same commit.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { getVoiceGroundingMode } from '../../src/config/featureFlags.js';
import { isValidAdjustmentId, getCanonicalText, getCanonicalTextVersion } from '../../src/data/archetypeAdjustments.js';
import { getEffectiveArchetype } from '../_utils/directiveIdentity.js';
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';
import {
  resolveBudgetDay,
  agentChatBudgetDocId,
  AGENT_CHAT_BUDGET_COLLECTION,
  AGENT_CHAT_DAILY_LIMIT,
} from '../_utils/agentChatBudget.js';
import { toIso } from '../_utils/tournamentTime.js';
import { buildDirectiveRecord, buildDirectiveSlot, BATTLE_CHAT_BUDGET } from '../_utils/directiveFiling.js';
import { GROUNDING_VERSION } from '../_utils/voiceLayerGrounding.js';
import { DIRECTIVE_FILED_MESSAGE_TYPE } from '../../src/data/decisionRecord.js';

// A transaction over two docs and no model: a plain write endpoint's budget.
export const config = { maxDuration: 10 };

/** The five statuses the spec names (§6.1), as the response's `status`. */
export const FILING_STATUS = Object.freeze({
  FILED: 'filed',
  REPLACED_PRIOR: 'replaced-prior',
  REJECTED: 'rejected',
  CONFLICT: 'conflict',
  BUDGET_EXHAUSTED: 'budget-exhausted',
});

export const FILED_MESSAGE_TYPE = DIRECTIVE_FILED_MESSAGE_TYPE; // ONE name (decisionRecord.js): the clients and the narrator's history window key on it too
export const FILED_SOURCE = 'chip';

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const normalizeCount = (raw) => (Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0);

/**
 * The audit exchange (§6.1 as amended by hazards 18 and 19). Agent-initiated
 * (no user half), no narrator words — the ExecutionCard carries the directive
 * text and the receipt; the history window renders it from the directive
 * field (voiceLayerGrounding.js). Exported for its shape rows.
 */
export function buildFiledExchange({ record, directiveThreadId, createdAt, groupId = null }) {
  return {
    userMessage: null,
    agentResponse: '',
    scratchpad: null,
    hasDirective: true,
    directive: record,
    directiveThreadId,
    suggestedActions: null,
    elicitationTarget: FILED_MESSAGE_TYPE,
    timestamp: createdAt,
    mode: 'battle',
    messageType: FILED_MESSAGE_TYPE,
    source: FILED_SOURCE,
    groundingVersion: GROUNDING_VERSION,
    // Catalog #9 (Signal Capture Rider): tournament exchanges carry the group
    // (the chat route's joint-stamp contract: gameMode + groupId).
    ...(groupId ? { groupId } : {}),
  };
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  // Check 7 — the route's own flag, per caller, at call time. 'off' → the
  // route does not exist for this caller (spec §10: "the route 404s at 'off'").
  if (getVoiceGroundingMode(user.uid) === 'off') {
    return res.status(404).json({ error: 'not_found' });
  }

  const body = req.body || {};
  const { agentId, battleId, adjustmentId } = body;
  if (!nonEmpty(agentId) || !nonEmpty(battleId) || !nonEmpty(adjustmentId)) {
    return res.status(400).json({ error: 'agentId, battleId, and adjustmentId are required' });
  }
  // Nullable AND required: the key must be present; its value is null (no
  // current directive) or the thread id the client believes is current.
  if (!Object.prototype.hasOwnProperty.call(body, 'expectedDirectiveThreadId')) {
    return res.status(400).json({ error: 'expectedDirectiveThreadId is required (null when no directive is current)' });
  }
  const expectedDirectiveThreadId = body.expectedDirectiveThreadId;
  if (expectedDirectiveThreadId !== null && !nonEmpty(expectedDirectiveThreadId)) {
    return res.status(400).json({ error: 'expectedDirectiveThreadId must be null or a thread id' });
  }

  const db = getFirebaseAdmin();
  const battleRef = db.collection('agentBattles').doc(battleId);
  const agentRef = db.collection('agents').doc(agentId);

  try {
    const outcome = await db.runTransaction(async (tx) => {
      // ---- reads (all before any write — Firestore's transaction contract) ----
      const battleSnap = await tx.get(battleRef);
      if (!battleSnap.exists) return { kind: 'battle_not_found' };
      const battle = battleSnap.data();

      // Check 1 — the authenticated owner.
      if (battle.ownerId !== user.uid) return { kind: 'forbidden_owner' };
      // Check 2 — the battle is active.
      if (battle.status !== 'active') return { kind: 'battle_not_active' };
      // Check 3 — the agent belongs to this battle.
      if (battle.agentId !== agentId) return { kind: 'forbidden_agent' };
      // Check 4 — the client's belief about the current directive.
      const currentThreadId = typeof battle.directive?.directiveThreadId === 'string' && battle.directive.directiveThreadId
        ? battle.directive.directiveThreadId
        : null;
      if (currentThreadId !== expectedDirectiveThreadId) {
        return { kind: 'conflict', currentDirectiveThreadId: currentThreadId };
      }

      const agentSnap = await tx.get(agentRef);
      if (!agentSnap.exists) return { kind: 'agent_not_found' };
      const agent = agentSnap.data();

      // Check 5 — permitted for the SERVER-DERIVED archetype (no fallback: an
      // unknown archetype has no allowlist and files nothing).
      const archetype = getEffectiveArchetype(battle, agent);
      if (!archetype || !isValidAdjustmentId(archetype, adjustmentId)) {
        return { kind: 'rejected', archetype: archetype ?? null };
      }
      // Check 6 — the canonical text, server-side.
      const text = getCanonicalText(archetype, adjustmentId);
      if (!text) return { kind: 'rejected', archetype };

      // Check 8 — the budget, derived from the battle's game mode.
      const now = new Date();
      const isLeague = battle.gameMode === TOURNAMENT_GAME_MODE;
      let remaining = null;
      let commitBudget = () => {};
      let battleBudgetUpdate = {};
      if (isLeague) {
        // The League store: the group read derives the game day (the same
        // index the daily close writes); null = unkeyable → FAIL-OPEN, the
        // chat route's own contract (file for free, never a placeholder day).
        const key = await resolveBudgetDay(db, battle);
        if (key) {
          const budgetRef = db.collection(AGENT_CHAT_BUDGET_COLLECTION).doc(agentChatBudgetDocId(key.groupId, user.uid, key.dayN));
          const budgetSnap = await tx.get(budgetRef);
          const count = budgetSnap.exists ? normalizeCount(budgetSnap.data()?.count) : 0;
          if (count >= AGENT_CHAT_DAILY_LIMIT) return { kind: 'budget_exhausted' };
          const next = count + 1;
          remaining = Math.max(0, AGENT_CHAT_DAILY_LIMIT - next);
          commitBudget = () => tx.set(budgetRef, {
            groupId: key.groupId,
            uid: user.uid,
            dayN: key.dayN,
            count: next,
            updatedAt: toIso(now),
          }, { merge: true });
        }
      } else {
        const used = normalizeCount(battle[BATTLE_CHAT_BUDGET.field]);
        if (used >= BATTLE_CHAT_BUDGET.limit) return { kind: 'budget_exhausted' };
        remaining = Math.max(0, BATTLE_CHAT_BUDGET.limit - (used + 1));
        // An explicit count, not FieldValue.increment: the in-transaction
        // read is what makes the cap authoritative under a race.
        battleBudgetUpdate = { [BATTLE_CHAT_BUDGET.field]: used + 1 };
      }

      // ---- the write ----
      const directiveThreadId = randomUUID();
      const createdAt = now.toISOString();
      const normalized = {
        text,
        expiry: 'end_of_battle',
        adjustmentId,
        canonicalTextVersion: getCanonicalTextVersion(archetype, adjustmentId),
      };
      const slot = buildDirectiveSlot(normalized, directiveThreadId, createdAt);
      const exchange = buildFiledExchange({
        record: buildDirectiveRecord(normalized, directiveThreadId),
        directiveThreadId,
        createdAt,
        groupId: isLeague && battle.groupId ? battle.groupId : null,
      });

      tx.update(battleRef, {
        chatExchanges: FieldValue.arrayUnion(exchange),
        directive: slot,
        ...battleBudgetUpdate,
      });
      commitBudget();

      return {
        kind: 'filed',
        // `replaced-prior` whenever a directive WAS current — a legacy slot with
        // text but no thread id (pre-Phase-7) is replaced too, even though no
        // thread can be named for it (review R-19).
        status: (currentThreadId || nonEmpty(battle.directive?.text)) ? FILING_STATUS.REPLACED_PRIOR : FILING_STATUS.FILED,
        directive: slot,
        replacedDirectiveThreadId: currentThreadId,
        remaining,
      };
    });

    switch (outcome.kind) {
      case 'battle_not_found':
        return res.status(404).json({ error: 'Battle not found' });
      case 'agent_not_found':
        return res.status(404).json({ error: 'Agent not found' });
      case 'forbidden_owner':
        return res.status(403).json({ error: 'Not authorized to file in this battle' });
      case 'forbidden_agent':
        return res.status(403).json({ error: 'agent_battle_mismatch' });
      case 'battle_not_active':
        return res.status(400).json({ error: 'battle_not_active', message: 'This battle has ended.' });
      case 'conflict':
        return res.status(409).json({
          error: 'conflict',
          status: FILING_STATUS.CONFLICT,
          currentDirectiveThreadId: outcome.currentDirectiveThreadId,
        });
      case 'rejected':
        return res.status(422).json({ error: 'rejected', status: FILING_STATUS.REJECTED, reason: 'off_menu' });
      case 'budget_exhausted':
        return res.status(429).json({ error: 'budget_exhausted', status: FILING_STATUS.BUDGET_EXHAUSTED, remaining: 0 });
      case 'filed':
        // After the commit — never before (spec §6.3: the receipt is bound to
        // the write).
        return res.status(200).json({
          status: outcome.status,
          directive: outcome.directive,
          replacedDirectiveThreadId: outcome.replacedDirectiveThreadId,
          remaining: outcome.remaining,
        });
      default:
        return res.status(500).json({ error: 'Unexpected filing outcome' });
    }
  } catch (error) {
    console.error('[FileDirective] Error:', error?.message || error);
    return res.status(500).json({ error: 'Could not file the directive. Try again in a moment.' });
  }
}
