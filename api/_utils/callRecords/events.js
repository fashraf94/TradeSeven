// api/_utils/callRecords/events.js
//
// Cockpit Build 1a — CALL EVENTS (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md §10;
// contract Amendment B §6). `agentBattles/{battleId}/callEvents/{eventId}`:
// every receipt, acknowledgment and player-facing line about a call lives
// here, merged into chat at render (Build 2). NOTHING here ever enters
// `chatExchanges[]`.
//
// DETERMINISTIC IDS — one per transition, so a retried transaction cannot
// write two and a reader can ask "did this transition commit?" by id:
//   ${evalId}:declared · ${callId}:answered:${answerId} · ${callId}:heard:${evalId}
//   ${callId}:acted:${evalId} · ${callId}:no_match:${evalId} · ${callId}:expired
//   ${callId}:ended · ${directiveThreadId}:superseded
//   answerId = ${callId}:answer:${answer}:${pickSymbol ?? ''}
//
// AN EVENT IS CREATED INSIDE THE TRANSACTION THAT COMMITS ITS TRANSITION
// (publication, the endpoint, the flip, the heard writer, the sweep) — a
// `create`, never a `set`: a failed transaction leaves no event, and an id
// that already exists is the transition that already committed. No outbox, no
// repair.
//
// Shape (§10): { kind, at, callIds, text, saidOk, evidence: { evalId, promptBuiltAt,
// checkLabel }, promptDirectiveThreadId? } — `at` in epoch ms (the calls'
// `mintedAt` convention); absent evidence is null, never undefined (Firestore
// rejects undefined). Pure except createCallEvent, which only buffers a write.

export const EVENTS_SUBCOLLECTION = 'callEvents';

export const CALL_EVENT_KINDS = Object.freeze([
  'declared', 'answered', 'heard', 'acted', 'no_matching_trade', 'expired', 'ended_with_battle', 'superseded',
]);

const nonEmpty = (v) => typeof v === 'string' && v.length > 0;

/** The immutable answer identity (Amendment B §6). */
export function answerIdOf(callId, answer, pickSymbol = null) {
  return `${callId}:answer:${answer}:${pickSymbol ?? ''}`;
}

/** The deterministic event id for a kind and its identifying parameters. Throws on an unknown kind or a missing parameter. */
export function eventIdOf(kind, p = {}) {
  const need = (k) => {
    if (!nonEmpty(p[k])) throw new Error(`callEvents: ${kind} needs ${k}`);
    return p[k];
  };
  switch (kind) {
    case 'declared': return `${need('evalId')}:declared`;
    case 'answered': return `${need('callId')}:answered:${need('answerId')}`;
    case 'heard': return `${need('callId')}:heard:${need('evalId')}`;
    case 'acted': return `${need('callId')}:acted:${need('evalId')}`;
    case 'no_matching_trade': return `${need('callId')}:no_match:${need('evalId')}`;
    case 'expired': return `${need('callId')}:expired`;
    case 'ended_with_battle': return `${need('callId')}:ended`;
    case 'superseded': return `${need('directiveThreadId')}:superseded`;
    default: throw new Error(`callEvents: unknown kind ${kind}`);
  }
}

/**
 * The event document (§10). `promptDirectiveThreadId` rides ONLY when the
 * caller passes a string (the `declared` event's prompt-inclusion fact — spec
 * §11); every other field is present, null when unknown.
 */
export function buildCallEvent({ kind, at, callIds, text, saidOk = null, evidence = {}, promptDirectiveThreadId, extra = {} }) {
  if (!CALL_EVENT_KINDS.includes(kind)) throw new Error(`callEvents: unknown kind ${kind}`);
  return {
    kind,
    at: typeof at === 'number' && Number.isFinite(at) ? at : null,
    callIds: Array.isArray(callIds) ? callIds.filter(nonEmpty) : [],
    text: nonEmpty(text) ? text : null,
    saidOk: typeof saidOk === 'boolean' ? saidOk : null,
    evidence: {
      evalId: nonEmpty(evidence?.evalId) ? evidence.evalId : null,
      promptBuiltAt: nonEmpty(evidence?.promptBuiltAt) ? evidence.promptBuiltAt : null,
      checkLabel: nonEmpty(evidence?.checkLabel) ? evidence.checkLabel : null,
    },
    ...(nonEmpty(promptDirectiveThreadId) ? { promptDirectiveThreadId } : {}),
    ...extra,
  };
}

/** The event document reference. */
export function callEventRef(db, battleId, eventId) {
  return db.collection('agentBattles').doc(battleId).collection(EVENTS_SUBCOLLECTION).doc(eventId);
}

/**
 * Buffer the event's CREATE on the transaction (or batch) committing its
 * transition. Returns the event id. Never a set: a retry that finds the id
 * present fails ALREADY_EXISTS — the transition already committed.
 */
export function createCallEvent(tx, db, battleId, { kind, idParams, event }) {
  const id = eventIdOf(kind, idParams);
  tx.create(callEventRef(db, battleId, id), event);
  return id;
}
