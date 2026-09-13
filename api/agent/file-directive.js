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
// and verifying, in order. SINCE B2 the transaction itself lives in
// `api/_utils/directiveTransaction.js` (spec §2) and the typed route files
// through the same one; this route's behaviour is unchanged — it selects
// `conflict: reject` and `budget: reject`, which is what it always did. Checks
// 5 and 6 stay in this file because the allowlist helpers are its import.
//   7. the route's flag — checked FIRST, before any read: the mutating route
//      is gated itself, not only the chip. It is live only for a caller the
//      accessor resolves to 'on' — the SAME resolution that mints the chips
//      (chat.js) — and 404s at every other resolution, 'shadow' included;
//   1. the authenticated owner (the uid from the token, never the body);
//   2. the battle is active;
//   3. the agent belongs to this battle (Phase 0 §5 item 4; discrepancy 15) —
//      the check this route carried from the start and the chat route did not.
//      It is now the SHARED `agentBelongsToBattle` (agentBattleBinding.js),
//      which chat.js and ensure-opener.js call too: one predicate, not three;
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
import { getVoiceGroundingMode } from '../../src/config/featureFlags.js';
import { isValidAdjustmentId, getCanonicalText, getCanonicalTextVersion } from '../../src/data/archetypeAdjustments.js';
import { getEffectiveArchetype } from '../_utils/directiveIdentity.js';
// The agent-belongs-to-this-battle predicate, now shared with the chat route
// and the lazy opener (agentBattleBinding.js) rather than inline here — and,
// since B2, re-checked INSIDE the transaction by directiveTransaction.js.
import { AGENT_BATTLE_MISMATCH } from '../_utils/agentBattleBinding.js';
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';
import { BATTLE_CHAT_BUDGET } from '../_utils/directiveFiling.js';
// B2 (PHASE_B_TICK_STAMPS_SPEC_V1.md §2): the transaction below USED to live in
// this file at :196-299. It now lives in the sibling both routes import, so the
// typed route files through the same preconditions, the same explicit
// in-transaction count and the same cross-document League charge. This route's
// behaviour is unchanged — it selects the two policies it always had.
import {
  runDirectiveTransaction,
  DIRECTIVE_CONFLICT_POLICY,
  DIRECTIVE_BUDGET_POLICY,
  DIRECTIVE_OUTCOME,
} from '../_utils/directiveTransaction.js';
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

  // Check 7 — the route's own flag, per caller, at call time. The route exists
  // only for a caller the accessor resolves to 'on'; every other resolution is
  // a 404, before any read.
  //
  // THE SAME RESOLUTION THAT MINTS THE CHIPS (BUILD_RULES §9). A chip is minted
  // only on a grounded turn — chat.js:409 `groundingMode === 'on' && mode ===
  // 'battle'` — so at 'off' and at 'shadow' no chip exists to file, and a route
  // that answered there was reachable by nothing the product mints. Binding the
  // gate to the same resolved value means the filing surface and the minting
  // surface cannot come alive at different steps of the walk. 'canary' never
  // reaches here as itself: getVoiceGroundingMode resolves it to 'on' for an
  // allowlisted uid and to 'shadow' for everyone else, so an allowlisted caller
  // — who does get chips — gets the route too, and nobody else does.
  //
  // (The earlier gate was `!== 'off'`, from spec §6.1's "the route's flag
  // (VOICE_GROUNDING_MODE ≠ 'off')", spec §10's "the route 404s at 'off'" and
  // D-104's "live when the mode ≠ 'off'". Founder ruling, this build: the route
  // follows the chips. Those three sites are records of the Sep 7 ruling and
  // are amended by the design chat, not from here — §6.1 is the one that states
  // the gate as a live contract and is reported for that amendment.)
  if (getVoiceGroundingMode(user.uid) !== 'on') {
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
    const outcome = await runDirectiveTransaction(db, {
      battleRef,
      agentRef,
      agentId,
      uid: user.uid,
      // Checks 1-4, 8 and the writes are the module's. This route keeps the two
      // policies it has always had: a stale belief is a `conflict` (the tap was
      // made against a screen that is no longer true, and no model was called,
      // so refusing costs nothing), and a spent budget is a refusal for the
      // same reason.
      expectedDirectiveThreadId,
      conflictPolicy: DIRECTIVE_CONFLICT_POLICY.REJECT,
      budgetPolicy: DIRECTIVE_BUDGET_POLICY.REJECT,
      // Checks 5 and 6 stay HERE, against the in-transaction battle and agent:
      // the allowlist helpers are this route's import (Spec §2.3), and the
      // canonical text is the server's, never the client's.
      resolveDirective: (battle, agent) => {
        const archetype = getEffectiveArchetype(battle, agent);
        if (!archetype || !isValidAdjustmentId(archetype, adjustmentId)) {
          return { rejected: { archetype: archetype ?? null } };
        }
        const text = getCanonicalText(archetype, adjustmentId);
        if (!text) return { rejected: { archetype } };
        return {
          normalized: {
            text,
            expiry: 'end_of_battle',
            adjustmentId,
            canonicalTextVersion: getCanonicalTextVersion(archetype, adjustmentId),
          },
        };
      },
      // Check 8's store, SERVER-DERIVED from the battle's game mode (ruling 6,
      // D-105) — the client never picks a budget.
      isLeagueBudget: (battle) => battle.gameMode === TOURNAMENT_GAME_MODE,
      battleBudget: BATTLE_CHAT_BUDGET,
      buildExchange: ({ battle, directiveRecord, directiveThreadId, createdAt }) => buildFiledExchange({
        record: directiveRecord,
        directiveThreadId,
        createdAt,
        groupId: battle.gameMode === TOURNAMENT_GAME_MODE && battle.groupId ? battle.groupId : null,
      }),
    });

    switch (outcome.kind) {
      case DIRECTIVE_OUTCOME.BATTLE_NOT_FOUND:
        return res.status(404).json({ error: 'Battle not found' });
      case DIRECTIVE_OUTCOME.AGENT_NOT_FOUND:
        return res.status(404).json({ error: 'Agent not found' });
      case DIRECTIVE_OUTCOME.FORBIDDEN_OWNER:
        return res.status(403).json({ error: 'Not authorized to file in this battle' });
      case DIRECTIVE_OUTCOME.FORBIDDEN_AGENT:
        return res.status(403).json({ error: AGENT_BATTLE_MISMATCH });
      case DIRECTIVE_OUTCOME.BATTLE_NOT_ACTIVE:
        return res.status(400).json({ error: 'battle_not_active', message: 'This battle has ended.' });
      case DIRECTIVE_OUTCOME.CONFLICT:
        return res.status(409).json({
          error: 'conflict',
          status: FILING_STATUS.CONFLICT,
          currentDirectiveThreadId: outcome.currentDirectiveThreadId,
        });
      case DIRECTIVE_OUTCOME.REJECTED:
        return res.status(422).json({ error: 'rejected', status: FILING_STATUS.REJECTED, reason: 'off_menu' });
      case DIRECTIVE_OUTCOME.BUDGET_EXHAUSTED:
        return res.status(429).json({ error: 'budget_exhausted', status: FILING_STATUS.BUDGET_EXHAUSTED, remaining: 0 });
      case DIRECTIVE_OUTCOME.FILED:
        // After the commit — never before (spec §6.3: the receipt is bound to
        // the write).
        return res.status(200).json({
          status: outcome.replacedPrior ? FILING_STATUS.REPLACED_PRIOR : FILING_STATUS.FILED,
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
