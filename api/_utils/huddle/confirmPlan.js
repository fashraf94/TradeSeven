// api/_utils/huddle/confirmPlan.js
//
// Huddle S1 — CONFIRM AND SKIP (spec V1.1 §6 as replaced by Amendment A §A1; Amendment
// C V1.2 §C15). One transaction each over the huddle record (and, for confirm, the
// player's ranked agent read and the queue row's reconcile mark). Confirm's
// applications run AFTER its commit, each its own B1 transaction (applyPlan.js).
//
// CONFIRM `{ etDate, baseRevision, replacement }`:
//   1. the plan is proposed (or confirmed, for a reconfirm — below); its revision equals
//      baseRevision, else 409 with the stored `current` and `revision`; the session has
//      not closed, else 410 and a proposed plan is marked `expired`;
//   2. `replacement` is validated (planTemplates.validatePlan) against the record's own
//      session context and the player's EQUIPPED archetype — the ranked agent's
//      `archetype` (the `agents` doc with this ownerId that is neither a training nor a
//      casual clone, the exclusion of src/services/agentService.js:20-34), the field the
//      deploy freezes into agentContext.archetype (agentBattleService.js:193). If
//      validation drops or transforms anything, nothing is confirmed: the normalized
//      result becomes the new `current` with a new `revision`, and the answer is 422
//      `{ current, revision, drops, transforms, dissent }` (the sheet previews it);
//   3. an archetype without a dissent row is 422 `archetype_unsupported`, an empty plan
//      422 `empty_plan`, a rendering over 500 characters 422 `rendered_too_long` — each
//      with nothing written; otherwise the confirmation is FROZEN and APPENDED to
//      `plan.confirmations[]` (`plan.confirmed` is the newest), `status = 'confirmed'`,
//      `measurement.confirmedAt` set once.
// RECONFIRM (C15): an already-confirmed plan is accepted only when the equipped archetype
// differs from the newest confirmation's; it runs steps 2–3 under the current archetype
// and appends. Otherwise the confirmed state is returned unchanged (idempotent, A1).
//
// SKIP `{ etDate }`: a proposed plan becomes `skipped`, `measurement.skippedAt`.

import { huddleDayRef, queueRowRef, PLAN_STATUS, RECORD_STATUS } from './records.js';
import {
  validatePlan, validationChanged, revisionOf, renderPlan, renderedTooLong, renderedTextHashOf, isEmptyPlan,
} from './planTemplates.js';
import { isArchetypeSupported } from './dissentTable.js';

export const CONFIRM_REFUSALS = Object.freeze({
  NOT_FOUND: 'not_found',
  NOT_READY: 'not_ready',
  NOT_PROPOSED: 'not_proposed',
  REVISION_MISMATCH: 'revision_mismatch',
  SESSION_CLOSED: 'session_closed',
  VALIDATION_CHANGED: 'validation_changed',
  ARCHETYPE_UNSUPPORTED: 'archetype_unsupported',
  EMPTY_PLAN: 'empty_plan',
  RENDERED_TOO_LONG: 'rendered_too_long',
});

/** The ranked agent among the owner's agent docs (clones excluded), or null. */
export function rankedAgentOf(docs) {
  const found = (docs || []).find((d) => {
    const data = typeof d?.data === 'function' ? d.data() : d;
    return data && data.isTrainingClone !== true && data.isCasualClone !== true;
  });
  if (!found) return null;
  return typeof found.data === 'function' ? { id: found.id, ...found.data() } : found;
}

/** The validation context the record froze at generation (plan.context): universe, closes, events. */
export function contextOfRecord(record, archetype) {
  const c = record?.plan?.context || {};
  return {
    universe: new Set(Array.isArray(c.universe) ? c.universe : []),
    closes: new Map(Object.entries(c.closes || {})),
    events: {
      eligible: new Map((Array.isArray(c.eligibleEvents) ? c.eligibleEvents : []).map((e) => [e.eventId, e])),
      untimedIds: new Set(Array.isArray(c.untimedEventIds) ? c.untimedEventIds : []),
    },
    archetype,
  };
}

export const eventLabelsOf = (record) => new Map((record?.plan?.context?.eligibleEvents || []).map((e) => [e.eventId, e.label]));

const iso = (ms) => new Date(ms).toISOString();

/**
 * @returns {Promise<{ kind: 'confirmed'|'already_confirmed'|'refused', status?: number, code?: string, body?: object }>}
 */
export async function confirmPlan(db, { uid, etDate, baseRevision, replacement, nowMs = Date.now() }) {
  const dayRef = huddleDayRef(db, uid, etDate);
  const agentsQuery = db.collection('agents').where('ownerId', '==', uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(dayRef);
    const agentsSnap = await tx.get(agentsQuery);
    if (!snap.exists) return { kind: 'refused', status: 404, code: CONFIRM_REFUSALS.NOT_FOUND };
    const record = snap.data();
    if (record.status !== RECORD_STATUS.READY || !record.plan) return { kind: 'refused', status: 409, code: CONFIRM_REFUSALS.NOT_READY };
    const plan = record.plan;
    const agent = rankedAgentOf(agentsSnap.docs);
    const archetype = typeof agent?.archetype === 'string' ? agent.archetype : null;
    const closeMs = record.session?.closeMs;
    const open = typeof closeMs === 'number' && Number.isFinite(closeMs) && nowMs < closeMs;

    const newest = Array.isArray(plan.confirmations) && plan.confirmations.length > 0 ? plan.confirmations[plan.confirmations.length - 1] : null;
    const reconfirm = plan.status === PLAN_STATUS.CONFIRMED && newest && newest.archetype !== archetype;
    if (plan.status === PLAN_STATUS.CONFIRMED && !reconfirm) {
      return { kind: 'already_confirmed', body: { revision: plan.revision, archetype: newest?.archetype ?? null } };
    }
    if (plan.status !== PLAN_STATUS.PROPOSED && !reconfirm) {
      return { kind: 'refused', status: plan.status === PLAN_STATUS.EXPIRED ? 410 : 409, code: CONFIRM_REFUSALS.NOT_PROPOSED, body: { planStatus: plan.status } };
    }
    if (!open) {
      if (plan.status === PLAN_STATUS.PROPOSED) tx.update(dayRef, { 'plan.status': PLAN_STATUS.EXPIRED, 'plan.expiredAt': iso(nowMs), updatedAt: iso(nowMs) });
      return { kind: 'refused', status: 410, code: CONFIRM_REFUSALS.SESSION_CLOSED };
    }
    if (baseRevision !== plan.revision) {
      return { kind: 'refused', status: 409, code: CONFIRM_REFUSALS.REVISION_MISMATCH, body: { current: plan.current, revision: plan.revision } };
    }

    const v = validatePlan(replacement, contextOfRecord(record, archetype));
    const nextRevision = revisionOf(v.current);
    const edited = nextRevision !== plan.revision;
    if (validationChanged(v)) {
      tx.update(dayRef, {
        'plan.current': v.current,
        'plan.revision': nextRevision,
        'plan.dissent': v.dissent,
        'plan.editCount': (Number.isInteger(plan.editCount) ? plan.editCount : 0) + (edited ? 1 : 0),
        'measurement.editCount': (Number.isInteger(record.measurement?.editCount) ? record.measurement.editCount : 0) + (edited ? 1 : 0),
        updatedAt: iso(nowMs),
      });
      return {
        kind: 'refused', status: 422, code: CONFIRM_REFUSALS.VALIDATION_CHANGED,
        body: { current: v.current, revision: nextRevision, drops: v.drops, transforms: v.transforms, dissent: v.dissent, archetype },
      };
    }
    if (!isArchetypeSupported(archetype)) return { kind: 'refused', status: 422, code: CONFIRM_REFUSALS.ARCHETYPE_UNSUPPORTED, body: { archetype } };
    if (isEmptyPlan(v.current)) return { kind: 'refused', status: 422, code: CONFIRM_REFUSALS.EMPTY_PLAN };
    const renderedText = renderPlan(v.current, { etDate, eventLabels: eventLabelsOf(record) });
    if (renderedTooLong(renderedText)) return { kind: 'refused', status: 422, code: CONFIRM_REFUSALS.RENDERED_TOO_LONG, body: { length: renderedText.length } };

    const confirmation = {
      current: v.current, revision: nextRevision, archetype, renderedText, renderedTextHash: renderedTextHashOf(renderedText), confirmedAt: iso(nowMs),
    };
    const confirmations = [...(Array.isArray(plan.confirmations) ? plan.confirmations : []), confirmation];
    tx.update(dayRef, {
      'plan.status': PLAN_STATUS.CONFIRMED,
      'plan.current': v.current,
      'plan.revision': nextRevision,
      'plan.dissent': v.dissent,
      'plan.confirmations': confirmations,
      'plan.confirmed': confirmation,
      ...(edited ? { 'plan.editCount': (Number.isInteger(plan.editCount) ? plan.editCount : 0) + 1, 'measurement.editCount': (Number.isInteger(record.measurement?.editCount) ? record.measurement.editCount : 0) + 1 } : {}),
      ...(record.measurement?.confirmedAt ? {} : { 'measurement.confirmedAt': iso(nowMs) }),
      updatedAt: iso(nowMs),
    });
    // the queue row marks the day for the worker's reconcile pass (equality query, no composite: Q-W3)
    tx.set(queueRowRef(db, uid, etDate), { reconcile: true, updatedAt: iso(nowMs) }, { merge: true });
    return { kind: 'confirmed', body: { revision: nextRevision, archetype, reconfirm: !!reconfirm } };
  });
}

/** SKIP: a proposed plan becomes skipped (V1.1 §6). */
export async function skipPlan(db, { uid, etDate, nowMs = Date.now() }) {
  const dayRef = huddleDayRef(db, uid, etDate);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(dayRef);
    if (!snap.exists) return { kind: 'refused', status: 404, code: CONFIRM_REFUSALS.NOT_FOUND };
    const record = snap.data();
    const plan = record.plan;
    if (record.status !== RECORD_STATUS.READY || !plan) return { kind: 'refused', status: 409, code: CONFIRM_REFUSALS.NOT_READY };
    if (plan.status === PLAN_STATUS.SKIPPED) return { kind: 'already_skipped' };
    if (plan.status !== PLAN_STATUS.PROPOSED) return { kind: 'refused', status: plan.status === PLAN_STATUS.EXPIRED ? 410 : 409, code: CONFIRM_REFUSALS.NOT_PROPOSED, body: { planStatus: plan.status } };
    const closeMs = record.session?.closeMs;
    if (!(typeof closeMs === 'number' && nowMs < closeMs)) {
      tx.update(dayRef, { 'plan.status': PLAN_STATUS.EXPIRED, 'plan.expiredAt': iso(nowMs), updatedAt: iso(nowMs) });
      return { kind: 'refused', status: 410, code: CONFIRM_REFUSALS.SESSION_CLOSED };
    }
    tx.update(dayRef, { 'plan.status': PLAN_STATUS.SKIPPED, 'plan.skippedAt': iso(nowMs), 'measurement.skippedAt': iso(nowMs), updatedAt: iso(nowMs) });
    return { kind: 'skipped' };
  });
}
