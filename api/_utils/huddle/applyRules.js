// api/_utils/huddle/applyRules.js
//
// Huddle S1 — THE APPLY DECISION, pure (spec V1.1 §6.1 as amended by B §B1 and C §C15).
// Given a FRESH battle and a FRESH huddle record (read inside the B1 transaction by
// applyPlan.js), decide what happens to that battle:
//
//   1. identity from the battle, never the request: ownerId == uid; a bound agentId
//      (agentBattleBinding.js:48-52); not a CPU seat (`skipped_cpu`); the battle's
//      FROZEN agentContext.archetype has a dissent row (`archetype_unsupported`);
//   2. the battle is active (`retry_inactive`); its first trading day is the plan's
//      session (`skipped_session`); the session has not closed (`expired`);
//   3. C15: the newest confirmation whose archetype equals the battle's frozen one —
//      none is `stale_approach` (retryable: a later confirmation can still land);
//   4. at most once: a `written` receipt for (battleId, revision) is a no-op;
//   5. slot precedence: a LIVE cockpit command (the endpoint's own pending predicate,
//      directiveUtils.js:136-150, with the inputs call-response.js:204-210 feeds it) is
//      `retry_live_call`; any other directive created after this confirmation is
//      `skipped_newer_instruction` (a delayed application never overwrites a newer
//      player instruction, AR-8); an earlier ordinary directive is replaced (latest wins).
//
// Terminal dispositions stop re-application of THAT revision on that battle; retryable
// ones are re-attempted by the next caller (sweep, status read, worker) until the close.
// No chat budget is charged (V1.1 §6.1 step 5).
//
// ARCHETYPES IN PLAY (Amendment E §E1, replacing C15's one-archetype confirm): for a player on
// a session, the equipped archetype together with the frozen agentContext.archetype of every
// battle this module would file into — the owner's, not a CPU seat, active, and on this
// session (`battleInPlay`, the same checks decideApplication makes before it looks for a
// confirmation) — keeping only archetypes with a dissent row (one without gets no
// confirmation; its battles keep `archetype_unsupported`). Confirm files one confirmation per
// archetype in play; reconfirm files the missing ones; the status answer carries the missing
// list, so the hub's Reconfirm door is exactly this acceptance predicate (BUILD_RULES §9).

import { isCallDirectivePendingAt } from '../directiveUtils.js';
import { deriveKilledDirectiveIds } from '../controlPromptRenderer.js';
import { resolveCallRecordsMode } from '../callRecords/mode.js';
import { agentBelongsToBattle } from '../agentBattleBinding.js';
import { isArchetypeSupported } from './dissentTable.js';
import { planThreadIdOf, TEMPLATE_VERSION } from './planTemplates.js';
import { DIRECTIVE_FILED_MESSAGE_TYPE } from '../../../src/data/decisionRecord.js';
import { TOURNAMENT_GAME_MODE, TRAINING_CLONE_ID_PREFIX, CASUAL_CLONE_ID_PREFIX, isCpuUserId } from '../../../src/constants/leagueTournament.js';

export const DISPOSITIONS = Object.freeze({
  WRITTEN: 'written',
  SKIPPED_SESSION: 'skipped_session',
  SKIPPED_CPU: 'skipped_cpu',
  SKIPPED_NEWER_INSTRUCTION: 'skipped_newer_instruction',
  ARCHETYPE_UNSUPPORTED: 'archetype_unsupported',
  RETRY_LIVE_CALL: 'retry_live_call',
  RETRY_INACTIVE: 'retry_inactive',
  RETRY_ERROR: 'retry_error',
  STALE_APPROACH: 'stale_approach',
});
export const TERMINAL_DISPOSITIONS = Object.freeze(new Set([
  DISPOSITIONS.WRITTEN, DISPOSITIONS.SKIPPED_SESSION, DISPOSITIONS.SKIPPED_CPU,
  DISPOSITIONS.SKIPPED_NEWER_INSTRUCTION, DISPOSITIONS.ARCHETYPE_UNSUPPORTED,
]));
export const isTerminal = (d) => TERMINAL_DISPOSITIONS.has(d);

/** The marker the plan's chat-history row carries (the chip's `source: 'chip'` precedent). */
export const GAME_PLAN_SOURCE = 'game_plan';
export const WRITERS = Object.freeze(['confirm', 'sweep', 'reconcile']);

const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const ms = (iso) => {
  const t = typeof iso === 'string' ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
};

/** CPU seats are never filed (the cron's own marker, agent-evaluate.js:1463, and the seat's owner id). */
export function isCpuBattle(battle) {
  return battle?.isCpu === true || isCpuUserId(battle?.ownerId);
}

/** ranked agent · casual clone · training clone (spec V1.1 §2 R-15): every one the player owns gets a receipt. */
export function battleKindOf(battle) {
  const agentId = typeof battle?.agentId === 'string' ? battle.agentId : '';
  if (agentId.startsWith(TRAINING_CLONE_ID_PREFIX)) return 'training';
  if (agentId.startsWith(CASUAL_CLONE_ID_PREFIX)) return 'casual';
  if (battle?.gameMode === TOURNAMENT_GAME_MODE) return 'ranked';
  return 'casual';
}

/** The battle's frozen archetype (agentContext.archetype, agentBattleService.js:193, fenced, read only), or null. */
export function battleArchetypeOf(battle) {
  return typeof battle?.agentContext?.archetype === 'string' && battle.agentContext.archetype ? battle.agentContext.archetype : null;
}

/**
 * E1: would this module file a plan of (uid, etDate) into this battle? The owner's, not a CPU seat, its agent its own, active,
 * this session — decideApplication's checks before the archetype's (review HD-13: the agent check was missing).
 */
export function battleInPlay(battle, { uid, etDate }) {
  return !!battle && battle.ownerId === uid && !isCpuBattle(battle) && agentBelongsToBattle(battle, battle.agentId)
    && battle.status === 'active' && battle.timing?.tradingDays?.[0] === etDate;
}

/**
 * E1: the archetypes in play for a player on a session — the equipped archetype and every in-play battle's frozen one —
 * that have a dissent row, sorted, each with the count of its games; and the unsupported ones, apart.
 * @returns {{ inPlay: string[], games: Record<string, number>, unsupported: string[] }}
 */
export function archetypesInPlayOf({ equipped, battles, uid, etDate }) {
  const games = {};
  const unsupported = new Set();
  const note = (archetype, isGame) => {
    if (typeof archetype !== 'string' || !archetype) return;
    if (!isArchetypeSupported(archetype)) { unsupported.add(archetype); return; }
    games[archetype] = (games[archetype] ?? 0) + (isGame ? 1 : 0);
  };
  note(equipped, false);
  for (const b of Array.isArray(battles) ? battles : []) if (battleInPlay(b, { uid, etDate })) note(battleArchetypeOf(b), true);
  return { inPlay: Object.keys(games).sort(), games, unsupported: [...unsupported].sort() };
}

/** E1: the archetypes in play that have no confirmation on the plan yet (what a reconfirm would file). */
export function missingArchetypesOf(plan, inPlay) {
  const confirmed = new Set((Array.isArray(plan?.confirmations) ? plan.confirmations : []).map((c) => c?.archetype).filter(Boolean));
  return (Array.isArray(inPlay) ? inPlay : []).filter((a) => !confirmed.has(a));
}

/** C15: the newest confirmation made under `archetype`, or null. */
export function selectConfirmation(plan, archetype) {
  const list = Array.isArray(plan?.confirmations) ? plan.confirmations : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i] && list[i].archetype === archetype) return list[i];
  }
  return null;
}

/** The receipt of one battle for one revision. */
export function receiptOf(applications, battleId, revision) {
  return (Array.isArray(applications) ? applications : []).find((r) => r && r.battleId === battleId && r.revision === revision) || null;
}

/** The newest receipt of a battle (the one its status line reads). */
export function latestReceiptOf(applications, battleId) {
  let best = null;
  for (const r of Array.isArray(applications) ? applications : []) {
    if (!r || r.battleId !== battleId) continue;
    if (!best || (ms(r.at) ?? 0) >= (ms(best.at) ?? 0)) best = r;
  }
  return best;
}

/**
 * The receipt a battle's STATUS is read from (review L2-4): its newest receipt — unless the battle already holds a written
 * plan and the newer receipt belongs to a confirmation made under ANOTHER archetype. That confirmation can never reach this
 * battle (C15), so a retry or waiting receipt keyed by it must not hide the plan the battle holds.
 */
export function statusReceiptOf(applications, battleId, confirmations = []) {
  const newest = latestReceiptOf(applications, battleId);
  if (!newest || newest.disposition === DISPOSITIONS.WRITTEN) return newest;
  let written = null;
  for (const r of Array.isArray(applications) ? applications : []) {
    if (r && r.battleId === battleId && r.disposition === DISPOSITIONS.WRITTEN && (!written || (ms(r.at) ?? 0) >= (ms(written.at) ?? 0))) written = r;
  }
  if (!written) return newest;
  // E1: archetypes in play often share one revision (the same current when no dissent row fires), so a revision names a SET
  // of archetypes. The newer receipt hides the written one only when its revision has a confirmation under some archetype
  // and none under the battle's own (the receipt's `archetype`, the battle's frozen one): such a confirmation can never
  // reach this battle. A WRITTEN receipt has always carried its archetype (applyPlan stamps decision.archetype, S1 included:
  // review HR-HD-7); the archetype-less branch below is S1's rule, kept as a defence for a receipt without one.
  const list = Array.isArray(confirmations) ? confirmations : [];
  const archetypesOf = (rev) => new Set(list.filter((c) => c && c.revision === rev).map((c) => c.archetype));
  const own = typeof written.archetype === 'string' ? written.archetype : typeof newest.archetype === 'string' ? newest.archetype : null;
  if (own !== null) {
    const heldSet = archetypesOf(written.revision);
    const otherSet = archetypesOf(newest.revision);
    return heldSet.has(own) && otherSet.size > 0 && !otherSet.has(own) ? written : newest;
  }
  const archetypeOf = (rev) => list.find((c) => c && c.revision === rev)?.archetype ?? null;
  const held = archetypeOf(written.revision);
  const other = archetypeOf(newest.revision);
  return held !== null && other !== null && held !== other ? written : newest;
}

/** Upsert by (battleId, revision): a written receipt is never replaced; anything else is the latest attempt. */
export function upsertReceipt(applications, entry) {
  const list = Array.isArray(applications) ? [...applications] : [];
  const i = list.findIndex((r) => r && r.battleId === entry.battleId && r.revision === entry.revision);
  if (i === -1) return [...list, entry];
  if (list[i].disposition === DISPOSITIONS.WRITTEN) return list;
  list[i] = entry;
  return list;
}

/** Is a cockpit command in the slot still live (the answer endpoint's own predicate and inputs)? */
export function slotHoldsLiveCall(battle, { nowMs, integrityMode }) {
  return isCallDirectivePendingAt({
    directive: battle?.directive ?? null,
    mode: resolveCallRecordsMode(battle),
    nowMs,
    killedIds: deriveKilledDirectiveIds(battle?.controlEpochLog),
    thisCallId: null,
    suppressed: integrityMode !== 'enforce',
  });
}

/**
 * The decision for one battle. `record` is the fresh huddle record; `nowMs` one instant.
 *
 * @returns {{ disposition: string|null, outcome: string, confirmation?: object, archetype?: string|null }}
 *   disposition null ⇒ write nothing (not_confirmed, not_owner, missing, already_written, expired)
 */
export function decideApplication({ battle, uid, record, nowMs, integrityMode }) {
  const plan = record?.plan;
  if (!plan || plan.status !== 'confirmed' || !Array.isArray(plan.confirmations) || plan.confirmations.length === 0) {
    return { disposition: null, outcome: 'not_confirmed' };
  }
  if (!battle) return { disposition: null, outcome: 'battle_missing' };
  if (battle.ownerId !== uid) return { disposition: null, outcome: 'not_owner' };
  const closeMs = record?.session?.closeMs;
  if (typeof closeMs !== 'number' || !Number.isFinite(closeMs) || !(nowMs < closeMs)) return { disposition: null, outcome: 'expired' };
  const archetype = typeof battle.agentContext?.archetype === 'string' ? battle.agentContext.archetype : null;
  const newest = plan.confirmations[plan.confirmations.length - 1];

  if (isCpuBattle(battle)) return { disposition: DISPOSITIONS.SKIPPED_CPU, outcome: 'decided', confirmation: newest, archetype };
  if (!agentBelongsToBattle(battle, battle.agentId)) return { disposition: DISPOSITIONS.RETRY_ERROR, outcome: 'decided', confirmation: newest, archetype };
  if (!isArchetypeSupported(archetype)) return { disposition: DISPOSITIONS.ARCHETYPE_UNSUPPORTED, outcome: 'decided', confirmation: newest, archetype };
  if (battle.status !== 'active') return { disposition: DISPOSITIONS.RETRY_INACTIVE, outcome: 'decided', confirmation: newest, archetype };
  if (battle.timing?.tradingDays?.[0] !== record.session.etDate) return { disposition: DISPOSITIONS.SKIPPED_SESSION, outcome: 'decided', confirmation: newest, archetype };

  const confirmation = selectConfirmation(plan, archetype);
  if (!confirmation) return { disposition: DISPOSITIONS.STALE_APPROACH, outcome: 'decided', confirmation: newest, archetype };

  const prior = receiptOf(plan.applications, battle.id, confirmation.revision);
  if (prior && isTerminal(prior.disposition)) return { disposition: null, outcome: prior.disposition === DISPOSITIONS.WRITTEN ? 'already_written' : 'already_terminal', confirmation };

  if (slotHoldsLiveCall(battle, { nowMs, integrityMode })) return { disposition: DISPOSITIONS.RETRY_LIVE_CALL, outcome: 'decided', confirmation, archetype };
  const slot = battle.directive;
  const slotThread = nonEmpty(slot?.directiveThreadId) ? slot.directiveThreadId : null;
  const ownThread = planThreadIdOf({ uid, etDate: record.session.etDate, revision: confirmation.revision });
  if (slotThread !== ownThread && nonEmpty(slot?.text)) {
    const slotAt = ms(slot.createdAt);
    const confirmedAt = ms(confirmation.confirmedAt);
    if (slotAt !== null && confirmedAt !== null && slotAt > confirmedAt) {
      return { disposition: DISPOSITIONS.SKIPPED_NEWER_INSTRUCTION, outcome: 'decided', confirmation, archetype };
    }
  }
  return { disposition: DISPOSITIONS.WRITTEN, outcome: 'decided', confirmation, archetype };
}

/** The slot the plan files (spec V1.1 §4.5): existing keys only; the thread id carries the revision. */
export function buildPlanSlot({ uid, etDate, confirmation, createdAt }) {
  return {
    text: confirmation.renderedText,
    expiry: 'end_of_battle',
    directiveThreadId: planThreadIdOf({ uid, etDate, revision: confirmation.revision }),
    createdAt,
    textVersion: TEMPLATE_VERSION,
  };
}

/** The chat-history row the filing appends (agent-initiated, no user half; labelled as a game plan). */
export function buildPlanExchange({ slot, battle }) {
  return {
    userMessage: null,
    agentResponse: '',
    scratchpad: null,
    hasDirective: true,
    directive: { text: slot.text, expiry: slot.expiry, directiveThreadId: slot.directiveThreadId, textVersion: slot.textVersion },
    directiveThreadId: slot.directiveThreadId,
    suggestedActions: null,
    elicitationTarget: DIRECTIVE_FILED_MESSAGE_TYPE,
    timestamp: slot.createdAt,
    mode: 'battle',
    messageType: DIRECTIVE_FILED_MESSAGE_TYPE,
    source: GAME_PLAN_SOURCE,
    ...(battle?.gameMode === TOURNAMENT_GAME_MODE && nonEmpty(battle?.groupId) ? { groupId: battle.groupId } : {}),
  };
}
