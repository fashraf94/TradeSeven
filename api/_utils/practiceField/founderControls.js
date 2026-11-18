// api/_utils/practiceField/founderControls.js
//
// Practice Field T1a-2b-1 — THE FOUNDER'S CONTROLS (build prompt §6; shared contract V2 §3.2, §11; Amendment E13).
// One dispatcher behind one endpoint (api/practice-field/founder.js), by `action`:
//
//   create_book    createIdeaBook for the caller and THEIR RANKED AGENT, resolved here from the caller's own agents
//                  (`agents` where `ownerId == uid`, neither a training nor a casual clone). A body may name which of
//                  the caller's ranked agents (`agentId`); with none named there must be exactly one. The archetype is
//                  the agent's own. Never a body's uid, never another owner's agent.
//   admit_fixture  admitIdea on the caller's OWN open idea book (its claim, `practiceFieldBooks/{uid}`, and the book
//                  it names, checked to be the caller's), with the contract in the body and its origin forced to
//                  `{ kind: 'founder_fixture', initiatedBy: 'agent' }` — validated by admission's own checks.
//   pause, resume  the book's `drafting` to 'paused' / 'on' (contract §3.2). Nothing else changes and no clock moves:
//                  every code duty — valuation, sales, settlement, entries of ideas already admitted — goes on.
//   wind_down      the book `draining` (contract §3.2, §11; E13) with `windDown: { requestedAt, … }`, and the owner's
//                  claim's status with it, in one transaction: no new admission and no new entry; every code duty
//                  continues. The close that finds no open idea left closes the book (close.js, step 9).
//   resolve_hold   (T1a-2b-3, Amendment F-5) the founder's ruling on a corporate-action hold the data will never clear,
//                  on one open idea of the caller's OWN open book: `{ ideaId, kind, recordId, decision, ratio?, payload?,
//                  actionId? }` names the EXACT record — a gap-screen suspicion, a conflict or possible re-date, or a
//                  coverage gap — and the ruling (holdRulings.js planHoldRuling checks both). The ruling is written on the
//                  idea (`founderRulings`), with who, when, the request key and the record, in the transaction that
//                  records the request; the idea book's next observed close applies it once (holdRulings.js). Refused:
//                  a record that does not exist, one already resolved, one on a closed book. A stuck sale with no quote
//                  is not in scope (T5).
//
// AUTHORIZATION (as api/mandate/create.js): the uid is the verified token's, never the body's. BOTH are required:
//   1. PRACTICE_FIELD_MODE is not 'off' (mode.js, read at call time);
//   2. the uid is in the founder allowlist, READ AT CALL TIME from MANDATE_FOUNDER_UIDS — the SAME environment
//      variable the Mandate's founder endpoint reads (api/mandate/create.js founderAllowlist), reused so the founder
//      is one list. Unset or empty: nobody (fail closed).
// The caller is never told which condition failed. At 'allowlist' mode, createIdeaBook and admitIdea also require the
// owner on the cockpit's server-side allowlist (mode.js practiceFieldAdmits — COCKPIT allowlist, a second
// environment list); at 'on' they admit any owner.
//
// IDEMPOTENT ON A CLIENT `requestKey`, PER OWNER (review C1, C3, C4). Every action records its request at
// `practiceFieldBooks/{uid}/founderOps/{requestKey}` — server-only (no rule matches it) — with the action, a fingerprint
// of what the request asked, the TARGET it was resolved to at the first request (the book; for create_book the ranked
// agent and archetype), and once done, the response. A replay — however much later, whatever book the owner's claim
// names by then — answers the stored response (`idempotentReplay: true`) and changes nothing: a pause replayed after a
// resume does not pause again; a wind_down replayed after its book closed and a new one opened does not drain the new
// one; an admit_fixture replayed then admits nothing new. One key for another action, or for the same action asking
// something else, is refused `request_key_conflict`. pause, resume and wind_down record the request in the transaction
// that applies it. create_book and admit_fixture record it first (pending, with its target), then run the engine's own
// idempotent call (createIdeaBook / admitIdea, with the request key as their operation id), then store the response;
// a request interrupted between the two re-runs against its RECORDED target. A request refused before anything was
// recorded (no ranked agent, no open book, a missing contract) changes nothing and records nothing.

import { createIdeaBook } from './ideaBook.js';
import { admitIdea } from './admission.js';
import { practiceFieldMode } from './mode.js';
import { isIdeaBook } from '../mandateBookKind.js';
import { isCloneAgentId } from '../../../src/constants/leagueTournament.js';
import { canonicalContentHash } from '../canonicalHash.js';
import { planHoldRuling } from './holdRulings.js';

/** The actions, in the build prompt's order. */
export const FOUNDER_ACTIONS = Object.freeze(['create_book', 'admit_fixture', 'pause', 'resume', 'wind_down', 'resolve_hold']);
/** A fixture's origin, forced on every admitted contract (Amendment C §6: `founder_fixture` needs no source). */
export const FOUNDER_FIXTURE_ORIGIN = Object.freeze({ kind: 'founder_fixture', initiatedBy: 'agent' });
/** A request key: also a document id (under the owner's claim), so a safe, bounded token. */
const REQUEST_KEY = /^[A-Za-z0-9][A-Za-z0-9_\-:.]{0,199}$/;

/** The founder allowlist, read NOW from MANDATE_FOUNDER_UIDS (comma-separated). Unset or empty: nobody. */
export function founderAllowlist() {
  return (process.env.MANDATE_FOUNDER_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** Both conditions (see the header): the mode is not 'off', and the uid is on the founder allowlist. Never throws. */
export function isPracticeFieldFounder(uid) {
  if (typeof uid !== 'string' || uid.length === 0) return false;
  if (practiceFieldMode() === 'off') return false;
  return founderAllowlist().includes(uid);
}

const reply = (status, body) => ({ status, body });
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const dataOf = (snap) => (typeof snap?.data === 'function' ? snap.data() : snap?.data);

/** The caller's ranked agent: one of their own agents that is neither a training nor a casual clone. */
async function rankedAgentFor(db, uid, agentId) {
  const snap = await db.collection('agents').where('ownerId', '==', uid).get();
  const ranked = (snap.docs || []).map((d) => ({ id: d.id, data: dataOf(d) }))
    .filter((a) => isPlain(a.data) && a.data.ownerId === uid && a.data.isTrainingClone !== true && a.data.isCasualClone !== true && !isCloneAgentId(a.id));
  if (agentId !== undefined && agentId !== null) {
    const named = ranked.find((a) => a.id === agentId);
    return named ? { agent: named } : { error: reply(404, { error: 'ranked_agent_not_found' }) };
  }
  if (ranked.length === 0) return { error: reply(404, { error: 'ranked_agent_not_found' }) };
  if (ranked.length > 1) return { error: reply(409, { error: 'ranked_agent_ambiguous', agentIds: ranked.map((a) => a.id).sort() }) };
  return { agent: ranked[0] };
}

/** The caller's own open idea book: the claim names it, and the book itself is the caller's idea book. */
async function ownBookOf(db, uid) {
  const claimSnap = await db.collection('practiceFieldBooks').doc(uid).get();
  const claim = claimSnap.exists ? claimSnap.data() : null;
  if (!claim || typeof claim.bookId !== 'string' || claim.bookId.length === 0) return { error: reply(404, { error: 'no_open_book' }) };
  const bookSnap = await db.collection('mandates').doc(claim.bookId).get();
  const book = bookSnap.exists ? bookSnap.data() : null;
  if (!book || !isIdeaBook(book) || book.userId !== uid) return { error: reply(404, { error: 'no_open_book' }) };
  return { bookId: claim.bookId, book };
}

/** The owner's record of one request (see the header). The collection by its literal name, for the protected-store scan. */
const founderOpRefOf = (db, uid, requestKey) => db.collection('practiceFieldBooks').doc(uid).collection('founderOps').doc(requestKey);

/** What a request asked, for telling a replay from another request under the same key. */
export function founderRequestFingerprint(action, body) {
  return canonicalContentHash({
    action,
    agentId: action === 'create_book' ? (body?.agentId ?? null) : null,
    contract: action === 'admit_fixture' ? (body?.contract ?? null) : null,
    // resolve_hold (F-5): what it rules on and how — only for that action, so every other action's fingerprint is as it was.
    ...(action === 'resolve_hold' ? { resolve: resolveFieldsOf(body) } : {}),
  });
}

/** The fields of a resolve_hold body the ruling reads (and its fingerprint covers). */
function resolveFieldsOf(body) {
  return {
    ideaId: body?.ideaId ?? null, kind: body?.kind ?? null, recordId: body?.recordId ?? null, decision: body?.decision ?? null,
    ratio: body?.ratio ?? null, payload: body?.payload ?? null, actionId: body?.actionId ?? null,
  };
}

/**
 * resolve_hold (Amendment F-5): the request recorded, and the ruling written on the idea, in ONE transaction — every
 * read before any write. Refusals write nothing.
 */
async function applyResolveHold(db, { uid, requestKey, body, nowIso, fingerprint }) {
  const opRef = founderOpRefOf(db, uid, requestKey);
  const claimRef = db.collection('practiceFieldBooks').doc(uid);
  const fields = resolveFieldsOf(body);
  if (typeof fields.ideaId !== 'string' || fields.ideaId.length === 0 || fields.ideaId.length > 200 || fields.ideaId.includes('/')) return reply(400, { ok: false, error: 'idea_id_invalid' });
  return db.runTransaction(async (tx) => {
    const opSnap = await tx.get(opRef);
    if (opSnap.exists) return answerRecorded(opSnap.data(), { action: 'resolve_hold', fingerprint }) ?? reply(409, { ok: false, error: 'request_key_conflict', action: opSnap.data().action });
    const claimSnap = await tx.get(claimRef);
    const claim = claimSnap.exists ? claimSnap.data() : null;
    if (!claim || typeof claim.bookId !== 'string' || claim.bookId.length === 0) return reply(404, { error: 'no_open_book' });
    const bookId = claim.bookId;
    const bookRef = db.collection('mandates').doc(bookId);
    const bookSnap = await tx.get(bookRef);
    const book = bookSnap.exists ? bookSnap.data() : null;
    if (!book || !isIdeaBook(book) || book.userId !== uid) return reply(404, { error: 'no_open_book' });
    if (book.status === 'closed') return reply(409, { ok: false, error: 'book_closed', status: 'closed' });
    const ideaRef = bookRef.collection('ideas').doc(fields.ideaId);
    const ideaSnap = await tx.get(ideaRef);
    const idea = ideaSnap.exists ? ideaSnap.data() : null;
    if (!idea || !(book.openIdeaIds || []).includes(fields.ideaId)) return reply(404, { ok: false, error: 'record_not_found' });
    // A coverage-gap ruling that picks a backfill row reads THE stored backfill of the symbol (by its literal name).
    let backfill = null;
    if (fields.kind === 'coverage_gap' && fields.decision === 'row' && typeof fields.recordId === 'string') {
      const sym = fields.recordId.split('_').slice(-2, -1)[0];
      if (sym) {
        const snap = await tx.get(db.collection('practiceFieldCaBackfill').doc(sym));
        backfill = snap.exists ? snap.data() : null;
      }
    }
    const plan = planHoldRuling(idea, fields, { uid, requestKey, nowIso, backfill });
    if (plan.error) return reply(plan.status, { ok: false, error: plan.error });
    const response = reply(200, {
      ok: true, action: 'resolve_hold', bookId, ideaId: fields.ideaId, kind: plan.ruling.kind, recordId: plan.ruling.recordId,
      decision: plan.ruling.decision, appliesAt: 'next_observed_close', idempotentReplay: false,
    });
    tx.create(opRef, {
      action: 'resolve_hold', requestKey, uid, fingerprint, state: 'done', target: { bookId, ideaId: fields.ideaId }, createdAt: nowIso, completedAt: nowIso,
      outcome: 'ruling_recorded', ruling: plan.ruling, response,
    });
    tx.update(ideaRef, { founderRulings: [...(idea.founderRulings || []), plan.ruling] });
    return response;
  });
}

/** The answer to a request whose key is already recorded: a conflict, a replay of the stored response, or null (pending). */
function answerRecorded(prior, { action, fingerprint }) {
  if (prior.action !== action || prior.fingerprint !== fingerprint) {
    return reply(409, { ok: false, error: 'request_key_conflict', action: prior.action });
  }
  if (prior.state !== 'done' || !prior.response) return null;
  const { status, body } = prior.response;
  return reply(status >= 200 && status < 300 ? 200 : status, { ...body, idempotentReplay: true });
}

/**
 * create_book and admit_fixture: record the request (pending, with its target) — or find it — then run the engine's
 * idempotent call against the RECORDED target, then store the response.
 */
async function recordedRequest(db, { uid, action, requestKey, fingerprint, nowIso, resolveTarget, run }) {
  const opRef = founderOpRefOf(db, uid, requestKey);
  const first = await opRef.get();
  let target;
  if (first.exists) {
    const answered = answerRecorded(first.data(), { action, fingerprint });
    if (answered) return answered;
    target = first.data().target;
  } else {
    const resolved = await resolveTarget();
    if (resolved.error) return resolved.error; // refused before anything was recorded: nothing changed, nothing to replay
    const begun = await db.runTransaction(async (tx) => {
      const snap = await tx.get(opRef);
      if (snap.exists) {
        const answered = answerRecorded(snap.data(), { action, fingerprint });
        return answered ? { answered } : { target: snap.data().target };
      }
      tx.create(opRef, { action, requestKey, uid, fingerprint, state: 'pending', target: resolved.target, createdAt: nowIso });
      return { target: resolved.target };
    });
    if (begun.answered) return begun.answered;
    target = begun.target;
  }
  const response = await run(target);
  await opRef.update({ state: 'done', response, completedAt: nowIso });
  return response;
}

async function createBook(db, { uid, requestKey, body, nowIso, fingerprint }) {
  return recordedRequest(db, {
    uid, action: 'create_book', requestKey, fingerprint, nowIso,
    resolveTarget: async () => {
      const found = await rankedAgentFor(db, uid, body?.agentId);
      if (found.error) return found;
      const archetypeCodeId = typeof found.agent.data.archetype === 'string' ? found.agent.data.archetype : null;
      return { target: { attributionAgentId: found.agent.id, archetypeCodeId } };
    },
    run: async ({ attributionAgentId, archetypeCodeId }) => {
      const res = await createIdeaBook(db, { uid, attributionAgentId, archetypeCodeId, opId: requestKey, nowIso });
      if (res.ok) return reply(res.idempotentReplay ? 200 : 201, { ok: true, action: 'create_book', bookId: res.bookId, epochId: res.epochId, attributionAgentId, archetypeCodeId, idempotentReplay: res.idempotentReplay });
      const status = { open_book_exists: 409, founder_cap_reached: 409, op_id_conflict: 409, mode_not_admitted: 403 }[res.code] ?? 400;
      return reply(status, { ok: false, error: res.code, ...(res.bookId ? { bookId: res.bookId } : {}) });
    },
  });
}

async function admitFixture(db, { uid, requestKey, body, nowIso, fingerprint }) {
  if (!isPlain(body?.contract)) return reply(400, { ok: false, error: 'contract_required' });
  return recordedRequest(db, {
    uid, action: 'admit_fixture', requestKey, fingerprint, nowIso,
    resolveTarget: async () => {
      const own = await ownBookOf(db, uid);
      return own.error ? own : { target: { bookId: own.bookId } };
    },
    run: async ({ bookId }) => {
      // The origin is the server's: a fixture is a founder fixture whatever the body says.
      const contract = { ...body.contract, origin: { ...FOUNDER_FIXTURE_ORIGIN } };
      const res = await admitIdea(db, { bookId, contract, opId: requestKey, nowIso });
      if (res.ok) {
        return reply(res.idempotentReplay ? 200 : 201, {
          ok: true, action: 'admit_fixture', bookId, ideaId: res.ideaId, status: res.status ?? null, idempotentReplay: res.idempotentReplay,
          startSession: res.startSession, dueSession: res.dueSession, permittedMaxUsd: res.permittedMaxUsd, binding: res.binding,
        });
      }
      const conflict = (res.refusals || []).some((r) => r.code === 'op_id_conflict');
      return reply(conflict ? 409 : 422, { ok: false, error: conflict ? 'op_id_conflict' : 'admission_refused', refusals: res.refusals, permittedMaxUsd: res.permittedMaxUsd ?? null, binding: res.binding ?? [] });
    },
  });
}

/**
 * What pause, resume and wind_down do to a book as read. Pure. A book's status only moves forward: resume and pause
 * touch `drafting` alone, so a wound-down book stays draining (review C6).
 * @returns {{ patch: object|null, outcome: string, error?: string }}
 */
export function planControl(action, book, { requestKey, uid, nowIso }) {
  if (book.status !== 'active' && book.status !== 'draining') return { patch: null, outcome: 'refused', error: 'book_not_open' };
  if (action === 'pause' || action === 'resume') {
    const drafting = action === 'pause' ? 'paused' : 'on';
    if (book.drafting === drafting) return { patch: null, outcome: 'unchanged' };
    return { patch: { drafting }, outcome: action === 'pause' ? 'paused' : 'resumed' };
  }
  // wind_down
  if (book.status === 'draining') return { patch: null, outcome: 'already_draining' };
  return { patch: { status: 'draining', windDown: { requestedAt: nowIso, requestKey, requestedBy: uid } }, outcome: 'draining' };
}

/** pause, resume and wind_down: the request recorded in the transaction that applies it, every read before any write. */
async function applyControl(db, { uid, action, requestKey, nowIso, fingerprint }) {
  const opRef = founderOpRefOf(db, uid, requestKey);
  const claimRef = db.collection('practiceFieldBooks').doc(uid);
  return db.runTransaction(async (tx) => {
    const opSnap = await tx.get(opRef);
    if (opSnap.exists) return answerRecorded(opSnap.data(), { action, fingerprint }) ?? reply(409, { ok: false, error: 'request_key_conflict', action: opSnap.data().action });
    const claimSnap = await tx.get(claimRef);
    const claim = claimSnap.exists ? claimSnap.data() : null;
    if (!claim || typeof claim.bookId !== 'string' || claim.bookId.length === 0) return reply(404, { error: 'no_open_book' });
    const bookId = claim.bookId;
    const bookRef = db.collection('mandates').doc(bookId);
    const bookSnap = await tx.get(bookRef);
    const book = bookSnap.exists ? bookSnap.data() : null;
    if (!book || !isIdeaBook(book) || book.userId !== uid) return reply(404, { error: 'no_open_book' });
    const plan = planControl(action, book, { requestKey, uid, nowIso });
    if (plan.error) return reply(409, { ok: false, error: plan.error, status: book.status ?? null });
    const after = { status: plan.patch?.status ?? book.status, drafting: plan.patch?.drafting ?? book.drafting ?? null };
    const response = reply(200, { ok: true, action, bookId, outcome: plan.outcome, status: after.status, drafting: after.drafting, idempotentReplay: false });
    // The request, recorded once, with the book it acted on — a replay answers it and changes nothing.
    tx.create(opRef, {
      action, requestKey, uid, fingerprint, state: 'done', target: { bookId }, createdAt: nowIso, completedAt: nowIso,
      outcome: plan.outcome, before: { status: book.status ?? null, drafting: book.drafting ?? null }, after, response,
    });
    if (plan.patch) tx.update(bookRef, plan.patch);
    // wind_down moves the owner's claim's status with the book's (bookStore.js), in the same transaction.
    if (plan.patch?.status === 'draining' && claim.bookId === bookId) {
      tx.update(claimRef, { status: 'draining', updatedAt: nowIso });
    }
    return response;
  });
}

/**
 * Run one founder action for an AUTHORIZED caller (the endpoint checks isPracticeFieldFounder first; this checks it
 * again, so no path reaches a write without it). `uid` is the verified token's; `body` is the request body, from
 * which only `action`, `requestKey`, `agentId`, `contract` and resolve_hold's fields (resolveFieldsOf) are read.
 *
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function runFounderAction(db, { uid, body = {}, nowIso }) {
  if (!isPracticeFieldFounder(uid)) return reply(403, { error: 'forbidden' });
  const action = body?.action;
  if (!FOUNDER_ACTIONS.includes(action)) return reply(400, { error: 'unknown_action', actions: FOUNDER_ACTIONS });
  const requestKey = body?.requestKey;
  if (typeof requestKey !== 'string' || !REQUEST_KEY.test(requestKey)) return reply(400, { error: 'request_key_invalid' });
  const fingerprint = founderRequestFingerprint(action, body);
  if (action === 'create_book') return createBook(db, { uid, requestKey, body, nowIso, fingerprint });
  if (action === 'admit_fixture') return admitFixture(db, { uid, requestKey, body, nowIso, fingerprint });
  if (action === 'resolve_hold') return applyResolveHold(db, { uid, requestKey, body, nowIso, fingerprint });
  return applyControl(db, { uid, action, requestKey, nowIso, fingerprint });
}
