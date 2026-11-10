// api/_utils/huddle/confirmPlan.js
//
// Huddle — CONFIRM AND SKIP (spec V1.1 §6 as replaced by Amendment A §A1; Amendment E §E1, which replaces Amendment C
// V1.2 §C15's confirm and reconfirm bullets and supersedes Fable's ruling R-18). One transaction each over the huddle
// record (and, for confirm, the player's ranked agent read and the queue row's reconcile mark). Confirm's applications run
// AFTER its commit, each its own B1 transaction (applyPlan.js).
//
// ONE CONFIRM COVERS EVERY ARCHETYPE IN PLAY (E1). The archetypes in play are the EQUIPPED archetype — the ranked agent's
// `archetype` (the `agents` doc with this ownerId that is neither a training nor a casual clone, the exclusion of
// src/services/agentService.js:20-34), read inside the transaction — and the frozen agentContext.archetype of every battle
// the apply module would file into this session (applyRules.archetypesInPlayOf: the owner's, not a CPU seat, active, this
// session), keeping only archetypes with a dissent row. The battles are read just BEFORE the transaction, not inside it:
// a battle's archetype is frozen at deploy and never changes, and the evaluator writes those documents every check, so a
// transaction over them would contend for nothing it needs (a game deployed between that read and the commit is filed
// by the next reconfirm, its line showing the door).
//
// CONFIRM `{ etDate, baseRevision, replacement, acknowledged? }`:
//   1. the plan is proposed (or confirmed, for a reconfirm — below); its revision equals baseRevision, else 409 with the
//      stored `current` and `revision`; the session has not closed, else 410 and a proposed plan is marked `expired`;
//   2. the VALUES of `replacement` are validated once, archetype-neutral (planTemplates.validatePlan with no archetype).
//      A drop or a normalized value is A §A1's 422 `validation_changed`: the normalized result becomes the new `current`
//      with a new `revision`, and the answer carries the drops, the transforms and the per-archetype previews below;
//   3. then ONCE PER ARCHETYPE IN PLAY, that archetype's dissent row over the validated values. If any row changes any
//      item, the confirm is a 422 `validation_changed` PREVIEW carrying, per affected archetype, its name, its games, the
//      revision it would file and the changed items ("For your Diversifier game: Fade CCI becomes Watch CCI"); the
//      player's edit (if any) is kept as the new `current`. The second confirm carries `acknowledged: { [archetype]:
//      revision }`: A §A1's baseRevision rule, per archetype — only an acknowledged revision EQUAL to the one recomputed
//      now commits; anything else (a newer edit, a game deployed since) is answered with the fresh preview;
//   4. no archetype in play with a dissent row is 422 `archetype_unsupported`, an empty plan 422 `empty_plan`, any
//      archetype's rendering over 500 characters 422 `rendered_too_long` — each with nothing written; otherwise ONE
//      confirmation per archetype in play `{ current, revision, archetype, renderedText, renderedTextHash, confirmedAt }`
//      is APPENDED to `plan.confirmations[]`, all in this one transaction; `plan.confirmed` is the equipped archetype's
//      (else the newest), for readers; `status = 'confirmed'`; `measurement.confirmedAt` set once.
// RECONFIRM (E1): an already-confirmed plan is accepted only when an archetype in play has no confirmation (a game deployed
// after confirming under another archetype; an archetype switch). It files the confirmed plan as it stands — the
// replacement must be that plan, unchanged, else 409 — under the MISSING archetypes only, through steps 3–4 (their
// previews included). Otherwise the confirmed state is returned unchanged (idempotent, A1). Apply is unchanged: a battle
// takes the newest confirmation under its own frozen archetype (applyRules.selectConfirmation), none → `stale_approach`.
//
// SKIP `{ etDate }`: a proposed plan becomes `skipped`, `measurement.skippedAt`.

import { huddleDayRef, queueRowRef, PLAN_STATUS, RECORD_STATUS } from './records.js';
import {
  validatePlan, validationChanged, revisionOf, renderPlan, renderedTooLong, renderedTextHashOf, isEmptyPlan,
} from './planTemplates.js';
import { archetypesInPlayOf, missingArchetypesOf } from './applyRules.js';
import { archetypeNameOf } from './archetypeWords.js';

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
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The owner's active battles (the apply module's own query, equality filters only: Q-A1, no composite). */
export async function readActiveBattles(db, uid) {
  const snap = await db.collection('agentBattles').where('ownerId', '==', uid).where('status', '==', 'active').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** The acknowledgements a request may carry: archetype → revision, strings only (anything else is none). */
export function acknowledgementsOf(raw) {
  if (!isPlainObject(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) if (typeof k === 'string' && typeof v === 'string' && k.length <= 64 && v.length <= 128) out[k] = v;
  return out;
}

/**
 * Each target archetype's dissent row over the validated values (pure): its current, revision, dissent and whether the
 * row changed anything — the E1 preview's material.
 */
export function perArchetypeOf(record, current, targets) {
  return targets.map((archetype) => {
    const va = validatePlan(current, contextOfRecord(record, archetype));
    return { archetype, current: va.current, revision: revisionOf(va.current), dissent: va.dissent, changed: va.transforms.length > 0 || va.drops.length > 0 };
  });
}

/** The E1 preview of the archetypes whose row changes an item: what the plan card shows ("For your Diversifier game: …"). */
export function previewsOf(per, games) {
  return per.filter((p) => p.changed).map((p) => ({
    archetype: p.archetype,
    archetypeName: archetypeNameOf(p.archetype),
    games: games?.[p.archetype] ?? 0,
    revision: p.revision,
    changes: p.dissent.map(({ index, kind, from, to, ticker, reason }) => ({ index, kind, from, to, ticker, reason })),
  }));
}

/**
 * @param {{ uid, etDate, baseRevision, replacement, acknowledged?, nowMs?, battles? }} p  `battles` (the owner's active
 *   battles) may be handed in; otherwise read here, before the transaction
 * @returns {Promise<{ kind: 'confirmed'|'already_confirmed'|'refused', status?: number, code?: string, body?: object }>}
 */
export async function confirmPlan(db, { uid, etDate, baseRevision, replacement, acknowledged = null, nowMs = Date.now(), battles = null }) {
  const dayRef = huddleDayRef(db, uid, etDate);
  const agentsQuery = db.collection('agents').where('ownerId', '==', uid);
  const games = Array.isArray(battles) ? battles : await readActiveBattles(db, uid);
  const ack = acknowledgementsOf(acknowledged);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(dayRef);
    const agentsSnap = await tx.get(agentsQuery);
    if (!snap.exists) return { kind: 'refused', status: 404, code: CONFIRM_REFUSALS.NOT_FOUND };
    const record = snap.data();
    if (record.status !== RECORD_STATUS.READY || !record.plan) return { kind: 'refused', status: 409, code: CONFIRM_REFUSALS.NOT_READY };
    const plan = record.plan;
    const agent = rankedAgentOf(agentsSnap.docs);
    const equipped = typeof agent?.archetype === 'string' ? agent.archetype : null;
    const sessionDate = typeof record.session?.etDate === 'string' ? record.session.etDate : etDate;
    const play = archetypesInPlayOf({ equipped, battles: games, uid, etDate: sessionDate });
    const missing = missingArchetypesOf(plan, play.inPlay);
    const closeMs = record.session?.closeMs;
    const open = typeof closeMs === 'number' && Number.isFinite(closeMs) && nowMs < closeMs;

    const reconfirm = plan.status === PLAN_STATUS.CONFIRMED;
    if (reconfirm && missing.length === 0) {
      return { kind: 'already_confirmed', body: { revision: plan.revision, archetypes: (plan.confirmations || []).map((c) => c.archetype) } };
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

    // ---- the values, once, archetype-neutral ----
    const v = validatePlan(replacement, contextOfRecord(record, null));
    const nextRevision = revisionOf(v.current);
    const edited = nextRevision !== plan.revision;
    // a reconfirm files the confirmed plan as it stands: no edit rides on it
    if (reconfirm && (validationChanged(v) || edited)) {
      return { kind: 'refused', status: 409, code: CONFIRM_REFUSALS.REVISION_MISMATCH, body: { current: plan.current, revision: plan.revision } };
    }
    const targets = reconfirm ? missing : play.inPlay;
    const per = perArchetypeOf(record, v.current, targets);
    const previews = previewsOf(per, play.games);
    const editFields = edited ? {
      'plan.editCount': (Number.isInteger(plan.editCount) ? plan.editCount : 0) + 1,
      'measurement.editCount': (Number.isInteger(record.measurement?.editCount) ? record.measurement.editCount : 0) + 1,
    } : {};

    if (validationChanged(v)) {
      // A §A1: a drop or a normalized value — the normalized plan becomes current; the player sees exactly what would file
      tx.update(dayRef, { 'plan.current': v.current, 'plan.revision': nextRevision, ...editFields, updatedAt: iso(nowMs) });
      return {
        kind: 'refused', status: 422, code: CONFIRM_REFUSALS.VALIDATION_CHANGED,
        body: { current: v.current, revision: nextRevision, drops: v.drops, transforms: v.transforms, dissent: per.flatMap((p) => p.dissent), previews, archetype: equipped },
      };
    }
    if (targets.length === 0) return { kind: 'refused', status: 422, code: CONFIRM_REFUSALS.ARCHETYPE_UNSUPPORTED, body: { archetype: equipped, unsupported: play.unsupported } };
    if (isEmptyPlan(v.current)) return { kind: 'refused', status: 422, code: CONFIRM_REFUSALS.EMPTY_PLAN };

    // ---- E1: one preview per archetype whose row changes an item, until acknowledged at exactly this revision ----
    const unacknowledged = per.filter((p) => p.changed && ack[p.archetype] !== p.revision);
    if (unacknowledged.length > 0) {
      if (edited) tx.update(dayRef, { 'plan.current': v.current, 'plan.revision': nextRevision, ...editFields, updatedAt: iso(nowMs) });
      return {
        kind: 'refused', status: 422, code: CONFIRM_REFUSALS.VALIDATION_CHANGED,
        body: { current: v.current, revision: nextRevision, drops: [], transforms: [], dissent: per.flatMap((p) => p.dissent), previews, archetype: equipped },
      };
    }

    const eventLabels = eventLabelsOf(record);
    const rendered = per.map((p) => ({ ...p, renderedText: renderPlan(p.current, { etDate, eventLabels }) }));
    const tooLong = rendered.find((p) => renderedTooLong(p.renderedText));
    if (tooLong) return { kind: 'refused', status: 422, code: CONFIRM_REFUSALS.RENDERED_TOO_LONG, body: { length: tooLong.renderedText.length, archetype: tooLong.archetype } };

    const at = iso(nowMs);
    const appended = rendered.map((p) => ({
      current: p.current, revision: p.revision, archetype: p.archetype, renderedText: p.renderedText, renderedTextHash: renderedTextHashOf(p.renderedText), confirmedAt: at,
    }));
    const confirmations = [...(Array.isArray(plan.confirmations) ? plan.confirmations : []), ...appended];
    const confirmed = appended.find((c) => c.archetype === equipped) ?? appended[appended.length - 1];
    const dissent = per.flatMap((p) => p.dissent);
    tx.update(dayRef, {
      'plan.status': PLAN_STATUS.CONFIRMED,
      'plan.confirmations': confirmations,
      'plan.confirmed': confirmed,
      ...(reconfirm ? { 'plan.dissent': [...(Array.isArray(plan.dissent) ? plan.dissent : []), ...dissent] } : {
        'plan.current': v.current,
        'plan.revision': nextRevision,
        'plan.dissent': dissent,
        ...editFields,
        ...(record.measurement?.confirmedAt ? {} : { 'measurement.confirmedAt': at }),
      }),
      updatedAt: at,
    });
    // the queue row marks the day for the worker's reconcile pass (equality query, no composite: Q-W3)
    tx.set(queueRowRef(db, uid, etDate), { reconcile: true, updatedAt: at }, { merge: true });
    return { kind: 'confirmed', body: { revision: reconfirm ? plan.revision : nextRevision, archetypes: appended.map((c) => c.archetype), reconfirm } };
  });
}

/**
 * E1: what the hub's Reconfirm door reads — the archetypes in play now and those without a confirmation — through the same
 * function confirm accepts a reconfirm by (BUILD_RULES §9: the door is the server's own predicate). Reads the owner's
 * agents and active battles; only for a confirmed plan whose session is still open (otherwise nothing is missing).
 * @returns {Promise<{ inPlay: string[], missing: string[] } | null>}
 */
export async function reconfirmStateOf(db, { uid, record, nowMs = Date.now() }) {
  const plan = record?.plan;
  const closeMs = record?.session?.closeMs;
  if (!plan || plan.status !== PLAN_STATUS.CONFIRMED || !(typeof closeMs === 'number' && nowMs < closeMs)) return null;
  const [agentsSnap, battles] = await Promise.all([db.collection('agents').where('ownerId', '==', uid).get(), readActiveBattles(db, uid)]);
  const agent = rankedAgentOf(agentsSnap.docs);
  const equipped = typeof agent?.archetype === 'string' ? agent.archetype : null;
  const play = archetypesInPlayOf({ equipped, battles, uid, etDate: record.session?.etDate ?? record.etDate });
  return { inPlay: play.inPlay, missing: missingArchetypesOf(plan, play.inPlay) };
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
