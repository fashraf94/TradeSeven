// api/agent/call-response.js
//
// POST /api/agent/call-response — THE ANSWER ENDPOINT (Cockpit Build 1a spec
// docs/COCKPIT_BUILD1A_SPEC_V1_2.md §5; contract V1.4 §7 as amended by
// Amendment B §1, §2, §3, §5, §6, §11). Dark: at CALL_RECORDS_MODE 'off',
// and at 'on' for an owner off COCKPIT_ALLOWLIST_UIDS, it answers 404
// `cockpit_unavailable` after the parent read and BEFORE any call read.
//
// Body: { battleId, callId, answer, pickSymbol?, expectedDirectiveThreadId }
//   answer ∈ { go, hold, go_now, pick, agree, disagree }; ask / keep → 400 deferred
//   expectedDirectiveThreadId: the client's belief about the current directive
//   (null = none) — nullable AND required, the chip's contract (file-directive.js)
//
// COACHING, NOT ENFORCEMENT (founder ruling, Oct 2): an answer that asks for
// something files a DIRECTIVE the agent reads at a later check (hold on an
// act-default call; go_now on a hold-default call; pick with a stored option);
// an answer that endorses the agent's own intent is an ACKNOWLEDGMENT (go on
// act-default; hold on hold-default; agree / disagree on a resolved pick that
// shows the agent's own choice) — recorded, uncharged, no directive. Nothing
// here trades, schedules a trade or vetoes one.
//
// THE ORDERED DECISION TABLE (spec §5) — one transaction, all reads before any
// write, in this order:
//   1. authenticate; read the parent; ownerId === uid              → 403
//   2. resolveCallRecordsMode(parent) === 'on'                     → 404 (no call read)
//   3. read the call; answerId = ${callId}:answer:${answer}:${pick}  → 400 unknown_call
//   4. IDENTICAL REPEAT (the answered event for this answerId exists beside a
//      playerResponse) → the stored response and event, 200 — no lifecycle,
//      belief, budget or pending check (a retry after a hit still succeeds)
//   5. a different existing answer                                → 409 already_answered
//   6. ACK rows: go on act-default / hold on hold-default need an OPEN call
//      inside its deadline; agree / disagree need a TERMINAL pick whose
//      outcome shows the agent's own choice — allowed whether the parent is
//      active or completed; write playerResponse{kind:'ack'} + the answered
//      event; no directive, no budget, no pending check          → 409 expired
//   7. DIRECTIVE rows: the call open and inside its deadline, the parent
//      active, the belief current, the stored action eligible NOW, the agent
//      bound (as the chip), no OTHER call-family directive pending, the
//      budget                      → 409 expired / parent_not_active /
//      belief_mismatch / directive_pending (the ONLY refusal persisted, as
//      `refused`) / budget; 400 for an ineligible action
//   8. writes: the call's playerResponse{kind:'directive'} and top-level
//      directiveThreadId; the directive through the shared writer (slot +
//      thread exchange with source 'cockpit' + the charge, one message); the
//      answered event; pendingHeard += callId on the queue row — all in the
//      one transaction, then 200.
//
// RATE LIMIT: the shared middleware's per-client limiter, plus a per-battle
// window (20 / 60 s) kept in this process (the flip index memo's precedent).
//
// Fence (BUILD_RULES §1): no fenced file edited or called. The battle doc's
// existing keys only (`directive`, `chatExchanges`, `chatBudgetUsed`); the
// call's `playerResponse` / `directiveThreadId` / `refused` are the contract's
// own fields; events live in their own subcollection.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { resolveCallRecordsMode } from '../_utils/callRecords/mode.js';
import { directiveKindFor, isCallActionEligible, buildCallDirectivePlan } from '../_utils/callRecords/callActions.js';
import { answerIdOf, eventIdOf, callEventRef, buildCallEvent, createCallEvent } from '../_utils/callRecords/events.js';
import { renderAnsweredEvent } from '../_utils/callRecords/copy.js';
import { queueRef, enrollPendingHeard } from '../_utils/callRecords/queue.js';
import { isCallDirectivePendingAt } from '../_utils/directiveUtils.js';
import { deriveKilledDirectiveIds } from '../_utils/controlPromptRenderer.js';
import { buildDirectiveRecord, buildDirectiveSlot, BATTLE_CHAT_BUDGET } from '../_utils/directiveFiling.js';
import { fileDirectiveTransactional } from '../_utils/directiveWriter.js';
import { getEffectiveArchetype } from '../_utils/directiveIdentity.js';
import { agentBelongsToBattle } from '../_utils/agentBattleBinding.js';
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';
import { resolveBudgetDay, agentChatBudgetDocId, AGENT_CHAT_BUDGET_COLLECTION, AGENT_CHAT_DAILY_LIMIT } from '../_utils/agentChatBudget.js';
import { toIso } from '../_utils/tournamentTime.js';
import { GROUNDING_VERSION } from '../_utils/voiceLayerGrounding.js';
import { DIRECTIVE_FILED_MESSAGE_TYPE } from '../../src/data/decisionRecord.js';
import { COCKPIT_SOURCE } from '../_utils/chatHistoryWindow.js';

export const config = { maxDuration: 10 };

/** The six 1a answers (Amendment B §1) and the two deferred to 1b (§2). */
export const ANSWERS_1A = Object.freeze(['go', 'hold', 'go_now', 'pick', 'agree', 'disagree']);
export const DEFERRED_ANSWERS = Object.freeze(['ask', 'keep']);
/** The 409 reasons (spec §5). Only `directive_pending` is ever persisted (Amendment B §5). */
export const REFUSAL_REASONS = Object.freeze(['directive_pending', 'already_answered', 'expired', 'belief_mismatch', 'budget', 'parent_not_active']);
/** The per-battle window (spec §5). */
export const CALL_RESPONSE_RATE_LIMIT = Object.freeze({ limit: 20, windowMs: 60_000 });

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const normalizeCount = (raw) => (Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0);

// ---- the per-battle rate window (process-local) ------------------------------
const windows = new Map();
/** Record one request against the battle; true when the window is already full. */
export function battleRateLimited(battleId, nowMs = Date.now()) {
  const { limit, windowMs } = CALL_RESPONSE_RATE_LIMIT;
  const kept = (windows.get(battleId) || []).filter((t) => nowMs - t < windowMs);
  if (kept.length >= limit) { windows.set(battleId, kept); return true; }
  kept.push(nowMs);
  windows.set(battleId, kept);
  return false;
}
/** Tests only. */
export function resetCallResponseRateLimit() { windows.clear(); }

/**
 * Which row an answer is for this call (Amendment B §1): 'directive', 'ack',
 * or null when the pairing is illegal in 1a.
 */
export function classifyAnswer(call, answer) {
  if (!call || typeof call !== 'object') return null;
  if (call.kind === 'pick') {
    if (answer === 'pick') return 'directive';
    if (answer === 'agree' || answer === 'disagree') return 'ack';
    return null;
  }
  if (call.defaultAction === 'act') {
    if (answer === 'go') return 'ack';
    if (answer === 'hold') return 'directive';
    return null;
  }
  if (call.defaultAction === 'hold') {
    if (answer === 'hold') return 'ack';
    if (answer === 'go_now') return 'directive';
    return null;
  }
  return null;
}

/**
 * The call directive's thread exchange — chip-shaped (file-directive.js
 * buildFiledExchange), with `source: 'cockpit'` and the call it answers.
 * Agent-initiated (no user half), no narrator words.
 */
export function buildCockpitExchange({ record, directiveThreadId, createdAt, callId, groupId = null }) {
  return {
    userMessage: null,
    agentResponse: '',
    scratchpad: null,
    hasDirective: true,
    directive: record,
    directiveThreadId,
    suggestedActions: null,
    elicitationTarget: DIRECTIVE_FILED_MESSAGE_TYPE,
    timestamp: createdAt,
    mode: 'battle',
    messageType: DIRECTIVE_FILED_MESSAGE_TYPE,
    source: COCKPIT_SOURCE,
    groundingVersion: GROUNDING_VERSION,
    callId,
    ...(groupId ? { groupId } : {}),
  };
}

const refused = (reason, extra = {}) => ({ kind: 'refused', reason, ...extra });

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: CALL_RESPONSE_RATE_LIMIT.limit, windowMs: CALL_RESPONSE_RATE_LIMIT.windowMs } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const user = await requireAuth(req, res);
  if (!user) return;

  // ---- the wire (spec §5) ----
  const body = req.body || {};
  const { battleId, callId, answer } = body;
  if (!nonEmpty(battleId) || !nonEmpty(callId) || !nonEmpty(answer)) {
    return res.status(400).json({ error: 'invalid_request', message: 'battleId, callId and answer are required' });
  }
  if (DEFERRED_ANSWERS.includes(answer)) {
    return res.status(400).json({ error: 'deferred', answer, message: 'This answer is deferred to Build 1b.' });
  }
  if (!ANSWERS_1A.includes(answer)) {
    return res.status(400).json({ error: 'invalid_request', message: `answer must be one of ${ANSWERS_1A.join(', ')}` });
  }
  if (!Object.prototype.hasOwnProperty.call(body, 'expectedDirectiveThreadId')) {
    return res.status(400).json({ error: 'invalid_request', message: 'expectedDirectiveThreadId is required (null when no directive is current)' });
  }
  const expectedDirectiveThreadId = body.expectedDirectiveThreadId;
  if (expectedDirectiveThreadId !== null && !nonEmpty(expectedDirectiveThreadId)) {
    return res.status(400).json({ error: 'invalid_request', message: 'expectedDirectiveThreadId must be null or a thread id' });
  }
  const pickSymbol = answer === 'pick' ? (nonEmpty(body.pickSymbol) ? body.pickSymbol.trim().toUpperCase() : null) : null;
  if (answer === 'pick' && !pickSymbol) {
    return res.status(400).json({ error: 'invalid_request', message: 'pickSymbol is required for a pick' });
  }
  if (battleRateLimited(battleId)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const db = getFirebaseAdmin();
  const battleRef = db.collection('agentBattles').doc(battleId);
  const callRef = battleRef.collection('calls').doc(callId);

  try {
    const outcome = await db.runTransaction(async (tx) => {
      // ---- 1. the parent, the owner ----
      const parentSnap = await tx.get(battleRef);
      if (!parentSnap.exists) return { kind: 'unavailable' };
      const parent = parentSnap.data();
      if (parent.ownerId !== user.uid) return { kind: 'forbidden' };
      // ---- 2. the resolved mode — 404 before any call read ----
      if (resolveCallRecordsMode(parent) !== 'on') return { kind: 'unavailable' };
      // ---- 3. the call, the answer identity ----
      const callSnap = await tx.get(callRef);
      if (!callSnap.exists) return { kind: 'unknown_call' };
      const call = callSnap.data();
      const answerId = answerIdOf(callId, answer, pickSymbol);
      // ---- 4. an identical repeat: the committed response and event, nothing re-admitted ----
      const answeredRef = callEventRef(db, battleId, eventIdOf('answered', { callId, answerId }));
      const answeredSnap = await tx.get(answeredRef);
      if (call.playerResponse && answeredSnap.exists) {
        return { kind: 'repeat', playerResponse: call.playerResponse, directiveThreadId: call.directiveThreadId ?? null, event: answeredSnap.data() };
      }
      // ---- 5. a different answer already stands ----
      if (call.playerResponse) return refused('already_answered');

      const row = classifyAnswer(call, answer);
      if (!row) return { kind: 'illegal_answer', reason: `${answer} is not an answer to this call` };
      const nowMs = Date.now();
      const filedAt = new Date(nowMs).toISOString();
      const deadline = call.horizon?.expiresAt;

      // ---- 6. acknowledgments ----
      if (row === 'ack') {
        if (answer === 'agree' || answer === 'disagree') {
          if (call.state === 'open') return { kind: 'illegal_answer', reason: 'pick_not_resolved' };
          if (!call.outcome?.actedEvalId) return { kind: 'illegal_answer', reason: 'pick_outcome_shows_no_choice' };
        } else {
          if (call.state !== 'open') return refused('expired');
          if (!finite(deadline) || deadline <= nowMs) return refused('expired');
        }
        const playerResponse = { answer, kind: 'ack', callId, filedAt };
        const event = buildCallEvent({ kind: 'answered', at: nowMs, callIds: [callId], text: renderAnsweredEvent({ answer }) });
        tx.update(callRef, { playerResponse });
        createCallEvent(tx, db, battleId, { kind: 'answered', idParams: { callId, answerId }, event });
        return { kind: 'acknowledged', playerResponse, directiveThreadId: call.directiveThreadId ?? null, event };
      }

      // ---- 7. directive rows: the guards, in order ----
      if (call.state !== 'open') return refused('expired');
      if (!finite(deadline) || deadline <= nowMs) return refused('expired');
      if (parent.status !== 'active') return refused('parent_not_active');
      const currentThreadId = nonEmpty(parent.directive?.directiveThreadId) ? parent.directive.directiveThreadId : null;
      if (currentThreadId !== expectedDirectiveThreadId) return refused('belief_mismatch', { currentDirectiveThreadId: currentThreadId });
      const kind = directiveKindFor(call, answer);
      const eligible = isCallActionEligible(kind, call, parent, { pickSymbol });
      if (!eligible.ok) return { kind: 'ineligible_action', reason: eligible.reason };
      // The agent binding, as the chip: the battle's own agent, an effective archetype.
      const agentId = parent.agentId;
      if (!agentBelongsToBattle(parent, agentId)) return { kind: 'agent_binding', reason: 'agent_battle_mismatch' };
      const agentSnap = await tx.get(db.collection('agents').doc(agentId));
      if (!agentSnap.exists) return { kind: 'agent_binding', reason: 'agent_not_found' };
      if (!getEffectiveArchetype(parent, agentSnap.data())) return { kind: 'agent_binding', reason: 'archetype_unknown' };
      // No OTHER call-family directive pending in the slot.
      if (isCallDirectivePendingAt({ directive: parent.directive, mode: 'on', nowMs, killedIds: deriveKilledDirectiveIds(parent.controlEpochLog), thisCallId: callId })) {
        const pending = parent.directive;
        const refusal = { at: filedAt, reason: 'directive_pending', pendingDirectiveThreadId: pending.directiveThreadId, ...(nonEmpty(pending.callId) ? { pendingCallId: pending.callId } : {}) };
        tx.update(callRef, { refused: refusal });
        return refused('directive_pending', { pendingDirectiveThreadId: pending.directiveThreadId, pendingCallId: pending.callId ?? null });
      }
      // The budget, server-derived from the game mode (the chip's rule).
      const isLeague = parent.gameMode === TOURNAMENT_GAME_MODE;
      let remaining = null;
      let commitBudget = () => {};
      let battleBudgetUpdate = {};
      if (isLeague) {
        const key = await resolveBudgetDay(db, parent);
        if (key) {
          const budgetRef = db.collection(AGENT_CHAT_BUDGET_COLLECTION).doc(agentChatBudgetDocId(key.groupId, user.uid, key.dayN));
          const budgetSnap = await tx.get(budgetRef);
          const count = budgetSnap.exists ? normalizeCount(budgetSnap.data()?.count) : 0;
          if (count >= AGENT_CHAT_DAILY_LIMIT) return refused('budget');
          const next = count + 1;
          remaining = Math.max(0, AGENT_CHAT_DAILY_LIMIT - next);
          commitBudget = () => tx.set(budgetRef, { groupId: key.groupId, uid: user.uid, dayN: key.dayN, count: next, updatedAt: toIso(new Date(nowMs)) }, { merge: true });
        }
      } else {
        const used = normalizeCount(parent[BATTLE_CHAT_BUDGET.field]);
        if (used >= BATTLE_CHAT_BUDGET.limit) return refused('budget');
        remaining = Math.max(0, BATTLE_CHAT_BUDGET.limit - (used + 1));
        battleBudgetUpdate = { [BATTLE_CHAT_BUDGET.field]: used + 1 };
      }
      // The queue row (read before any write).
      const queueSnap = await tx.get(queueRef(db, battleId));

      // ---- 8. the writes ----
      const plan = buildCallDirectivePlan({ call, answer, pickSymbol, nowMs, filedAt });
      if (!plan) return { kind: 'ineligible_action', reason: 'unrenderable' };
      const directiveThreadId = randomUUID();
      const slot = buildDirectiveSlot(plan.normalized, directiveThreadId, filedAt);
      const record = buildDirectiveRecord(plan.normalized, directiveThreadId);
      const exchange = buildCockpitExchange({ record, directiveThreadId, createdAt: filedAt, callId, groupId: isLeague && parent.groupId ? parent.groupId : null });
      const playerResponse = { answer, kind: 'directive', directiveThreadId, callId, filedAt, heardEvalId: null };
      tx.update(callRef, { playerResponse, directiveThreadId });
      await fileDirectiveTransactional(tx, battleRef, {
        db, battleId, arrayUnion: FieldValue.arrayUnion, exchange, filed: true,
        priorSlot: parent.directive ?? null, callsMode: 'on', fields: { directive: slot, ...battleBudgetUpdate },
      });
      commitBudget();
      const event = buildCallEvent({ kind: 'answered', at: nowMs, callIds: [callId], text: renderAnsweredEvent({ answer, pickSymbol, canonicalText: plan.text }) });
      createCallEvent(tx, db, battleId, { kind: 'answered', idParams: { callId, answerId }, event });
      enrollPendingHeard(tx, db, battleId, queueSnap.exists ? queueSnap.data() : null, callId, nowMs);
      return { kind: 'filed', playerResponse, directiveThreadId, event, remaining, directive: slot };
    });

    switch (outcome.kind) {
      case 'unavailable':
        return res.status(404).json({ error: 'cockpit_unavailable' });
      case 'forbidden':
        return res.status(403).json({ error: 'forbidden' });
      case 'unknown_call':
        return res.status(400).json({ error: 'unknown_call' });
      case 'illegal_answer':
        return res.status(400).json({ error: 'illegal_answer', reason: outcome.reason });
      case 'ineligible_action':
        return res.status(400).json({ error: 'ineligible_action', reason: outcome.reason });
      case 'agent_binding':
        return res.status(400).json({ error: 'agent_binding', reason: outcome.reason });
      case 'refused': {
        const { kind: _k, ...rest } = outcome;
        return res.status(409).json({ error: 'refused', ...rest });
      }
      case 'repeat':
        return res.status(200).json({ callId, playerResponse: outcome.playerResponse, directiveThreadId: outcome.directiveThreadId, event: outcome.event, repeat: true });
      case 'acknowledged':
        return res.status(200).json({ callId, playerResponse: outcome.playerResponse, directiveThreadId: outcome.directiveThreadId, event: outcome.event });
      case 'filed':
        // After the commit — never before (the chip's rule: the receipt is bound to the write).
        return res.status(200).json({ callId, playerResponse: outcome.playerResponse, directiveThreadId: outcome.directiveThreadId, event: outcome.event, directive: outcome.directive, remaining: outcome.remaining });
      default:
        return res.status(500).json({ error: 'Unexpected outcome' });
    }
  } catch (error) {
    console.error('[CallResponse] Error:', error?.message || error);
    return res.status(500).json({ error: 'Could not record the answer. Try again in a moment.' });
  }
}
