// api/agent/call-response.js
//
// POST /api/agent/call-response — THE ANSWER ENDPOINT (Cockpit Build 1a spec
// docs/COCKPIT_BUILD1A_SPEC_V1_2.md §5; contract V1.4 §7 as amended by
// Amendment B §1, §2, §3, §5, §6, §11). Dark: at CALL_RECORDS_MODE 'off',
// and at 'on' for an owner off COCKPIT_ALLOWLIST_UIDS, it answers 404
// `cockpit_unavailable` after the parent read and BEFORE any call read.
//
// Body: { battleId, callId, answer, pickSymbol?, expectedDirectiveThreadId, confirmReplace? }
//   answer ∈ { go, hold, go_now, pick, agree, disagree } (+ replace with the 2b flag); ask / keep → 400 deferred
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
// COCKPIT BUILD 2b (contract Amendment D, D-1 / D-2 / D-4 / D-7; spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md S-5). Behind isCockpit2bOn(), read per
// request. With the flag OFF this endpoint behaves exactly as at HEAD for the
// budget, the pending check and the answers; its from-merge changes are D-7's
// `counterpart_unavailable` and, since the BaggerBomb cleanup (C3, Oct 2026), a
// pick judged by canComeIn instead of the universe, both at the eligibility step
// (callActions.js), and Amendment E's E-2 (step 6): a go / hold acknowledgment of
// an exit the parent holds in no tier is refused symbol_not_held, flag off or on.
// With the flag ON:
//   wire     `replace` is an answer and requires `pickSymbol`; `go_now` may
//            carry one; `confirmReplace` is an optional boolean; `pickSymbol`
//            on any other answer is 400 invalid_request. After the parent
//            read the chosen name is canonicalized through the battle's
//            universe (battleUniverse.js canonicalUniverseSymbol); a name
//            outside it is `pick_not_on_bench` at the eligibility step.
//   D-4      the one second answer: `replace` after the `go` acknowledgment —
//            THE ONE SANCTIONED REWRITE of playerResponse (it keeps the
//            acknowledgment in `after`; both `answered` events stand). No
//            other path rewrites a playerResponse (call-response.2b.test.js pins it).
//   D-2      the pending check becomes the CONFIRMATION check: a LIVE slot (a
//            call-family directive by the pending predicate, or an active,
//            unkilled, unsuppressed ordinary directive) without
//            `confirmReplace === true` → 409 refused `replace_unconfirmed`
//            with { currentDirectiveThreadId, currentText, currentCallId },
//            NOT persisted (no `refused` stamp). Confirmed, the filing goes
//            through the shared writer, which stamps the replacement.
//   D-1      the budget is the cockpit's own 7 commands, DERIVED from the
//            battle's own cockpit filings (callRecords/commands.js); the
//            endpoint no longer charges chatBudgetUsed; the league branch
//            is unchanged.
//
// THE ORDERED DECISION TABLE (spec §5; 2b S-5) — one transaction, all reads
// before any write, in this order:
//   1. authenticate; read the parent; ownerId === uid              → 403
//   2. resolveCallRecordsMode(parent) === 'on'                     → 404 (no call read)
//      2b (flag on) the chosen name canonicalized against the parent's universe
//   3. read the call; answerId = ${callId}:answer:${answer}:${pick}  → 400 unknown_call
//   4. IDENTICAL REPEAT (the answered event for this answerId exists beside a
//      playerResponse) → the stored response and event, 200 — no lifecycle,
//      belief, budget or pending check (a retry after a hit still succeeds)
//   5. a different existing answer                                → 409 already_answered
//      (flag on: `replace` passes when the playerResponse is the `go` ack — D-4)
//      then the pairing: illegal                                   → 400 illegal_answer
//      (flag on: a chosen name on a pairing that takes none, or none where one is required)
//   6. ACK rows: go on act-default / hold on hold-default need an OPEN call
//      inside its deadline; agree / disagree need a TERMINAL pick whose
//      outcome shows the agent's own choice — allowed whether the parent is
//      active or completed; write playerResponse{kind:'ack'} + the answered
//      event; no directive, no budget, no pending check          → 409 expired
//      Amendment E (E-2; flag off or on): an EXIT call whose stock the fresh parent holds in
//      no tier at all is answerable by nobody — a go / hold acknowledgment is
//      refused like a directive is, after the expired checks and before any
//      write                                                      → 400 ineligible_action
//                                                                    symbol_not_held
//   7. DIRECTIVE rows: the call open and inside its deadline, the parent
//      active, the belief current, the stored action eligible NOW (D-7: the
//      agent's own exit counterpart, and with the flag the chosen name), the
//      agent bound (as the chip), then
//        flag off: no OTHER call-family directive pending → 409 directive_pending
//                  (the ONLY refusal persisted, as `refused`); the budget
//                  (chatBudgetUsed / the league day)
//        flag on:  the D-2 confirmation check → 409 replace_unconfirmed (never
//                  persisted); the D-1 budget (7 commands / the league day)
//                                  → 409 expired / parent_not_active /
//      belief_mismatch / directive_pending | replace_unconfirmed / budget; 400
//      for an ineligible action
//   8. writes: the call's playerResponse{kind:'directive'} (flag on, a replace
//      after go keeps `after`) and top-level directiveThreadId; the directive
//      through the shared writer (slot + thread exchange with source
//      'cockpit'; flag off, + the chatBudgetUsed charge); the answered event;
//      pendingHeard += callId on the queue row — all in the one transaction,
//      then 200 with `remaining`.
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
// Cockpit Build 2a (spec S-4): the legality table's ONE home, shared with the
// cockpit's tiles — re-exported here under the names this route always had.
import { classifyAnswer, isUpsideCall, isExitNotHeld, ANSWERS_1A, DEFERRED_ANSWERS, wireAnswers, answerTakesPick, isGoAcknowledgment, ANSWER_REPLACE } from '../_utils/callRecords/answers.js';
import { directiveKindFor, isCallActionEligible, buildCallDirectivePlan } from '../_utils/callRecords/callActions.js';
import { answerIdOf, eventIdOf, callEventRef, buildCallEvent, createCallEvent } from '../_utils/callRecords/events.js';
import { renderAnsweredEvent } from '../_utils/callRecords/copy.js';
import { queueRef, enrollPendingHeard } from '../_utils/callRecords/queue.js';
import { cockpitCommandsUsed, COCKPIT_COMMANDS_LIMIT } from '../_utils/callRecords/commands.js';
import { isCallDirectivePendingAt, isCallDirective, isDirectiveActive } from '../_utils/directiveUtils.js';
import { deriveKilledDirectiveIds } from '../_utils/controlPromptRenderer.js';
import { buildDirectiveRecord, buildDirectiveSlot, BATTLE_CHAT_BUDGET } from '../_utils/directiveFiling.js';
import { fileDirectiveTransactional } from '../_utils/directiveWriter.js';
import { getEffectiveArchetype } from '../_utils/directiveIdentity.js';
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';
import { resolveBudgetDay, agentChatBudgetDocId, AGENT_CHAT_BUDGET_COLLECTION, AGENT_CHAT_DAILY_LIMIT } from '../_utils/agentChatBudget.js';
import { toIso } from '../_utils/tournamentTime.js';
import { GROUNDING_VERSION } from '../_utils/voiceLayerGrounding.js';
import { DIRECTIVE_FILED_MESSAGE_TYPE } from '../../src/data/decisionRecord.js';
import { COCKPIT_SOURCE } from '../_utils/chatHistoryWindow.js';
import { ARCHETYPE_INTEGRITY_MODE } from '../../src/config/featureFlags.js';
// Cockpit Build 2b (spec S-11): the 2b accessor, read per request (never module scope).
import { isCockpit2bOn } from '../../src/config/featureFlags.js';
import { canonicalUniverseSymbol } from '../../src/data/battleUniverse.js';

export const config = { maxDuration: 10 };

/** The six 1a answers and the two deferred to 1b — from the shared table (answers.js). */
export { ANSWERS_1A, DEFERRED_ANSWERS, classifyAnswer };
/** The 409 reasons (spec §5). Only `directive_pending` is ever persisted (Amendment B §5). */
export const REFUSAL_REASONS = Object.freeze(['directive_pending', 'already_answered', 'expired', 'belief_mismatch', 'budget', 'parent_not_active']);
/** Cockpit Build 2b (D-2): with the flag on, `replace_unconfirmed` (never persisted) stands where `directive_pending` stood. */
export const REFUSAL_REASONS_2B = Object.freeze([...REFUSAL_REASONS.filter((r) => r !== 'directive_pending'), 'replace_unconfirmed']);
/** The per-battle window (spec §5). */
export const CALL_RESPONSE_RATE_LIMIT = Object.freeze({ limit: 20, windowMs: 60_000 });

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const normalizeCount = (raw) => (Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0);

// ---- the per-battle rate window (process-local) ------------------------------
const windows = new Map();
/** Record one request against the key (`${uid}:${battleId}` — the owner's own window); true when the window is already full. */
export function battleRateLimited(key, nowMs = Date.now()) {
  const { limit, windowMs } = CALL_RESPONSE_RATE_LIMIT;
  const kept = (windows.get(key) || []).filter((t) => nowMs - t < windowMs);
  if (kept.length >= limit) { windows.set(key, kept); return true; }
  kept.push(nowMs);
  windows.set(key, kept);
  return false;
}
/** Tests only. */
export function resetCallResponseRateLimit() { windows.clear(); }

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

/**
 * D-2's LIVE test (2b S-5), the slot a confirmed replacement displaces: a
 * call-family slot by the endpoint's own pending predicate (its kill and
 * suppression inputs as today; the answered call's own slot exempt), or an
 * ordinary directive the next check would render — active by its own rule
 * (isDirectiveActive — it fails closed on a call-family slot, so it is asked
 * only of an ordinary one), its thread not killed, the integrity mode
 * 'enforce'. Returns the live slot, or null.
 */
export function liveSlotForReplace(parent, { nowMs, callId }) {
  const slot = parent?.directive ?? null;
  if (!slot || typeof slot !== 'object') return null;
  const killed = deriveKilledDirectiveIds(parent?.controlEpochLog);
  const suppressed = ARCHETYPE_INTEGRITY_MODE !== 'enforce';
  if (isCallDirective(slot)) {
    return isCallDirectivePendingAt({ directive: slot, mode: 'on', nowMs, killedIds: killed, thisCallId: callId, suppressed }) ? slot : null;
  }
  if (suppressed || !nonEmpty(slot.text) || !nonEmpty(slot.directiveThreadId)) return null;
  if (killed.includes(slot.directiveThreadId)) return null;
  return isDirectiveActive(slot, parent) ? slot : null;
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

  // Read ONCE per request (spec S-11: at call time, never module scope).
  const v2 = isCockpit2bOn() === true;

  // ---- the wire (spec §5; 2b S-5) ----
  const body = req.body || {};
  const { battleId, callId, answer } = body;
  if (!nonEmpty(battleId) || !nonEmpty(callId) || !nonEmpty(answer)) {
    return res.status(400).json({ error: 'invalid_request', message: 'battleId, callId and answer are required' });
  }
  if (DEFERRED_ANSWERS.includes(answer)) {
    return res.status(400).json({ error: 'deferred', answer, message: 'This answer is deferred to Build 1b.' });
  }
  const admitted = wireAnswers({ v2 });
  if (!admitted.includes(answer)) {
    return res.status(400).json({ error: 'invalid_request', message: `answer must be one of ${admitted.join(', ')}` });
  }
  if (!Object.prototype.hasOwnProperty.call(body, 'expectedDirectiveThreadId')) {
    return res.status(400).json({ error: 'invalid_request', message: 'expectedDirectiveThreadId is required (null when no directive is current)' });
  }
  const expectedDirectiveThreadId = body.expectedDirectiveThreadId;
  if (expectedDirectiveThreadId !== null && !nonEmpty(expectedDirectiveThreadId)) {
    return res.status(400).json({ error: 'invalid_request', message: 'expectedDirectiveThreadId must be null or a thread id' });
  }
  const rawPick = nonEmpty(body.pickSymbol) ? body.pickSymbol.trim().toUpperCase() : null;
  let pickSymbol = null;
  let chosenRaw = null;
  if (!v2) {
    // HEAD's wire: a pickSymbol rides a pick and is dropped on every other answer.
    pickSymbol = answer === 'pick' ? rawPick : null;
    if (answer === 'pick' && !pickSymbol) {
      return res.status(400).json({ error: 'invalid_request', message: 'pickSymbol is required for a pick' });
    }
  } else {
    const takesPick = answer === 'pick' || answer === ANSWER_REPLACE || answer === 'go_now';
    if (Object.prototype.hasOwnProperty.call(body, 'pickSymbol') && body.pickSymbol != null && !takesPick) {
      return res.status(400).json({ error: 'invalid_request', message: 'pickSymbol rides only pick, replace or go_now' });
    }
    if ((answer === 'pick' || answer === ANSWER_REPLACE) && !rawPick) {
      return res.status(400).json({ error: 'invalid_request', message: `pickSymbol is required for ${answer}` });
    }
    if (Object.prototype.hasOwnProperty.call(body, 'confirmReplace') && typeof body.confirmReplace !== 'boolean') {
      return res.status(400).json({ error: 'invalid_request', message: 'confirmReplace must be a boolean' });
    }
    if (answer === 'pick') pickSymbol = rawPick;
    else chosenRaw = rawPick;
  }
  const confirmReplace = v2 && body.confirmReplace === true;
  // Keyed on (uid, battle): a third party naming the battleId cannot spend the owner's window (review L1-1 / L6-4).
  if (battleRateLimited(`${user.uid}:${battleId}`)) {
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
      // ---- 2b. (flag on) the chosen name, in the battle's own spelling; outside the universe it is refused at step 7 ----
      const chosen = chosenRaw ? (canonicalUniverseSymbol(parent, chosenRaw) ?? chosenRaw) : null;
      const chosenOutsideUniverse = Boolean(chosenRaw) && !canonicalUniverseSymbol(parent, chosenRaw);
      // ---- 3. the call, the answer identity ----
      const callSnap = await tx.get(callRef);
      if (!callSnap.exists) return { kind: 'unknown_call' };
      const call = callSnap.data();
      const answerId = answerIdOf(callId, answer, pickSymbol ?? chosen);
      // ---- 4. an identical repeat: the committed response and event, nothing re-admitted ----
      const answeredRef = callEventRef(db, battleId, eventIdOf('answered', { callId, answerId }));
      const answeredSnap = await tx.get(answeredRef);
      if (call.playerResponse && answeredSnap.exists) {
        return { kind: 'repeat', playerResponse: call.playerResponse, directiveThreadId: call.directiveThreadId ?? null, event: answeredSnap.data() };
      }
      // ---- 5. a different answer already stands (D-4: the one second answer, replace after go) ----
      const secondAnswer = v2 && answer === ANSWER_REPLACE && isGoAcknowledgment(call.playerResponse);
      if (call.playerResponse && !secondAnswer) return refused('already_answered');

      const row = classifyAnswer(call, answer, { v2 });
      // Amendment C-2: an upside call (an entry on a name held at mint) accepts no answer at all.
      if (!row) return { kind: 'illegal_answer', reason: isUpsideCall(call) ? 'upside_call' : `${answer} is not an answer to this call` };
      if (v2) {
        // D-4: a chosen name rides only the pairings that take one (a pick's own rule is Build 1a's).
        const takes = answerTakesPick(call, answer, { v2 });
        if (answer !== 'pick' && chosen && !takes) return { kind: 'illegal_answer', reason: 'pickSymbol is not an answer to this call' };
        if (takes === 'required' && !(pickSymbol ?? chosen)) return { kind: 'illegal_answer', reason: 'pickSymbol is required for this call' };
      }
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
          // Amendment E (E-2): no acknowledgment of an exit the book no longer (or never) holds. Any tier — the same
          // test (answers.js isExitNotHeld) the cockpit's tiles ask; the directive rows' own slot-tier test is step 7's.
          if (isExitNotHeld(call, parent)) return { kind: 'ineligible_action', reason: 'symbol_not_held' };
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
      const kind = directiveKindFor(call, answer, { v2 });
      // D-7: a chosen name outside the battle's universe can never come in.
      if (chosenOutsideUniverse) return { kind: 'ineligible_action', reason: 'pick_not_on_bench' };
      const eligible = isCallActionEligible(kind, call, parent, { pickSymbol: pickSymbol ?? chosen, atMs: nowMs });
      if (!eligible.ok) return { kind: 'ineligible_action', reason: eligible.reason };
      // The battle's own agent (its agentId) and an effective archetype. The request carries no agentId
      // to bind against, so there is nothing to compare (review L4-10).
      const agentId = parent.agentId;
      if (!nonEmpty(agentId)) return { kind: 'agent_binding', reason: 'agent_not_found' };
      const agentSnap = await tx.get(db.collection('agents').doc(agentId));
      if (!agentSnap.exists) return { kind: 'agent_binding', reason: 'agent_not_found' };
      if (!getEffectiveArchetype(parent, agentSnap.data())) return { kind: 'agent_binding', reason: 'archetype_unknown' };
      if (v2) {
        // D-2: one live command — a new one REPLACES it, after one explicit confirmation. Never persisted.
        const live = liveSlotForReplace(parent, { nowMs, callId });
        if (live && !confirmReplace) {
          return refused('replace_unconfirmed', {
            currentDirectiveThreadId: live.directiveThreadId,
            currentText: live.text,
            currentCallId: nonEmpty(live.callId) ? live.callId : null,
          });
        }
      } else if (isCallDirectivePendingAt({ directive: parent.directive, mode: 'on', nowMs, killedIds: deriveKilledDirectiveIds(parent.controlEpochLog), thisCallId: callId, suppressed: ARCHETYPE_INTEGRITY_MODE !== 'enforce' })) {
        // No OTHER call-family directive pending in the slot (HEAD's one-at-a-time rule, flag off).
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
      } else if (v2) {
        // D-1: the cockpit's own 7, derived from the battle's own cockpit filings — no counter is written.
        const used = cockpitCommandsUsed(parent.chatExchanges);
        if (used >= COCKPIT_COMMANDS_LIMIT) return refused('budget');
        remaining = Math.max(0, COCKPIT_COMMANDS_LIMIT - (used + 1));
      } else {
        const used = normalizeCount(parent[BATTLE_CHAT_BUDGET.field]);
        if (used >= BATTLE_CHAT_BUDGET.limit) return refused('budget');
        remaining = Math.max(0, BATTLE_CHAT_BUDGET.limit - (used + 1));
        battleBudgetUpdate = { [BATTLE_CHAT_BUDGET.field]: used + 1 };
      }
      // The queue row (read before any write).
      const queueSnap = await tx.get(queueRef(db, battleId));

      // ---- 8. the writes ----
      const plan = buildCallDirectivePlan({ call, answer, pickSymbol: pickSymbol ?? chosen, nowMs, filedAt, v2 });
      if (!plan) return { kind: 'ineligible_action', reason: 'unrenderable' };
      const directiveThreadId = randomUUID();
      const slot = buildDirectiveSlot(plan.normalized, directiveThreadId, filedAt);
      const record = buildDirectiveRecord(plan.normalized, directiveThreadId);
      const exchange = buildCockpitExchange({ record, directiveThreadId, createdAt: filedAt, callId, groupId: isLeague && parent.groupId ? parent.groupId : null });
      // D-4 rev 2: the one sanctioned rewrite — a replace after the go acknowledgment keeps that ack in `after`.
      const after = secondAnswer ? { answer: call.playerResponse.answer, filedAt: call.playerResponse.filedAt ?? null } : null;
      const playerResponse = { answer, kind: 'directive', directiveThreadId, callId, filedAt, heardEvalId: null, ...(after ? { after } : {}) };
      tx.update(callRef, { playerResponse, directiveThreadId });
      await fileDirectiveTransactional(tx, battleRef, {
        db, battleId, arrayUnion: FieldValue.arrayUnion, exchange, filed: true,
        priorSlot: parent.directive ?? null, callsMode: 'on', fields: { directive: slot, ...battleBudgetUpdate },
      });
      commitBudget();
      const event = buildCallEvent({ kind: 'answered', at: nowMs, callIds: [callId], text: renderAnsweredEvent({ answer, pickSymbol: pickSymbol ?? chosen, canonicalText: plan.text }) });
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
