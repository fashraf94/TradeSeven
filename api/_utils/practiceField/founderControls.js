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
// IDEMPOTENT ON A CLIENT `requestKey`. create_book and admit_fixture pass it as their operation id: the book's and
// the idea's ids are derived from it, so a replay finds what it made. pause, resume and wind_down record each request
// at `mandates/{bookId}/controlOps/{requestKey}` (create-once, server-only) in the transaction that applies it: a
// replay answers what the first request answered and changes nothing — so a pause replayed after a resume does not
// pause the book again. One key for two different actions is refused `request_key_conflict`.

import { createIdeaBook } from './ideaBook.js';
import { admitIdea } from './admission.js';
import { practiceFieldMode } from './mode.js';
import { isIdeaBook } from '../mandateBookKind.js';
import { isCloneAgentId } from '../../../src/constants/leagueTournament.js';

/** The actions, in the build prompt's order. */
export const FOUNDER_ACTIONS = Object.freeze(['create_book', 'admit_fixture', 'pause', 'resume', 'wind_down']);
/** A fixture's origin, forced on every admitted contract (Amendment C §6: `founder_fixture` needs no source). */
export const FOUNDER_FIXTURE_ORIGIN = Object.freeze({ kind: 'founder_fixture', initiatedBy: 'agent' });
/** A request key: also a document id under the book, so a safe, bounded token. */
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

async function createBook(db, { uid, requestKey, body, nowIso }) {
  const found = await rankedAgentFor(db, uid, body?.agentId);
  if (found.error) return found.error;
  const archetypeCodeId = typeof found.agent.data.archetype === 'string' ? found.agent.data.archetype : null;
  const res = await createIdeaBook(db, { uid, attributionAgentId: found.agent.id, archetypeCodeId, opId: requestKey, nowIso });
  if (res.ok) return reply(res.idempotentReplay ? 200 : 201, { ok: true, action: 'create_book', bookId: res.bookId, epochId: res.epochId, attributionAgentId: found.agent.id, archetypeCodeId, idempotentReplay: res.idempotentReplay });
  const status = { open_book_exists: 409, founder_cap_reached: 409, op_id_conflict: 409, mode_not_admitted: 403 }[res.code] ?? 400;
  return reply(status, { ok: false, error: res.code, ...(res.bookId ? { bookId: res.bookId } : {}) });
}

async function admitFixture(db, { uid, requestKey, body, nowIso }) {
  if (!isPlain(body?.contract)) return reply(400, { ok: false, error: 'contract_required' });
  const own = await ownBookOf(db, uid);
  if (own.error) return own.error;
  // The origin is the server's: a fixture is a founder fixture whatever the body says.
  const contract = { ...body.contract, origin: { ...FOUNDER_FIXTURE_ORIGIN } };
  const res = await admitIdea(db, { bookId: own.bookId, contract, opId: requestKey, nowIso });
  if (res.ok) {
    return reply(res.idempotentReplay ? 200 : 201, {
      ok: true, action: 'admit_fixture', bookId: own.bookId, ideaId: res.ideaId, status: res.status ?? null, idempotentReplay: res.idempotentReplay,
      startSession: res.startSession, dueSession: res.dueSession, permittedMaxUsd: res.permittedMaxUsd, binding: res.binding,
    });
  }
  const conflict = (res.refusals || []).some((r) => r.code === 'op_id_conflict');
  return reply(conflict ? 409 : 422, { ok: false, error: conflict ? 'op_id_conflict' : 'admission_refused', refusals: res.refusals, permittedMaxUsd: res.permittedMaxUsd ?? null, binding: res.binding ?? [] });
}

/** What pause, resume and wind_down do to a book as read. Pure. @returns {{ patch: object|null, outcome: string, error?: string }} */
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

async function applyControl(db, { uid, action, requestKey, nowIso }) {
  const own = await ownBookOf(db, uid);
  if (own.error) return own.error;
  const bookRef = db.collection('mandates').doc(own.bookId);
  const opRef = bookRef.collection('controlOps').doc(requestKey);
  const claimRef = db.collection('practiceFieldBooks').doc(uid);
  return db.runTransaction(async (tx) => {
    const bookSnap = await tx.get(bookRef);
    const opSnap = await tx.get(opRef);
    const claimSnap = await tx.get(claimRef);
    if (opSnap.exists) {
      const prior = opSnap.data();
      if (prior.action !== action) return reply(409, { ok: false, error: 'request_key_conflict', action: prior.action });
      return reply(200, { ...prior.response, idempotentReplay: true });
    }
    const book = bookSnap.exists ? bookSnap.data() : null;
    if (!book || !isIdeaBook(book) || book.userId !== uid) return reply(404, { error: 'no_open_book' });
    const plan = planControl(action, book, { requestKey, uid, nowIso });
    if (plan.error) return reply(409, { ok: false, error: plan.error, status: book.status ?? null });
    const after = { status: plan.patch?.status ?? book.status, drafting: plan.patch?.drafting ?? book.drafting ?? null };
    const response = { ok: true, action, bookId: own.bookId, outcome: plan.outcome, status: after.status, drafting: after.drafting, idempotentReplay: false };
    // The request, recorded once — a replay answers it and changes nothing.
    tx.create(opRef, {
      action, requestKey, uid, at: nowIso, outcome: plan.outcome,
      before: { status: book.status ?? null, drafting: book.drafting ?? null }, after, response,
    });
    if (plan.patch) tx.update(bookRef, plan.patch);
    // wind_down moves the owner's claim's status with the book's (bookStore.js), in the same transaction.
    if (plan.patch?.status === 'draining' && claimSnap.exists && claimSnap.data()?.bookId === own.bookId) {
      tx.update(claimRef, { status: 'draining', updatedAt: nowIso });
    }
    return reply(200, response);
  });
}

/**
 * Run one founder action for an AUTHORIZED caller (the endpoint checks isPracticeFieldFounder first; this checks it
 * again, so no path reaches a write without it). `uid` is the verified token's; `body` is the request body, from
 * which only `action`, `requestKey`, `agentId` and `contract` are read.
 *
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function runFounderAction(db, { uid, body = {}, nowIso }) {
  if (!isPracticeFieldFounder(uid)) return reply(403, { error: 'forbidden' });
  const action = body?.action;
  if (!FOUNDER_ACTIONS.includes(action)) return reply(400, { error: 'unknown_action', actions: FOUNDER_ACTIONS });
  const requestKey = body?.requestKey;
  if (typeof requestKey !== 'string' || !REQUEST_KEY.test(requestKey)) return reply(400, { error: 'request_key_invalid' });
  if (action === 'create_book') return createBook(db, { uid, requestKey, body, nowIso });
  if (action === 'admit_fixture') return admitFixture(db, { uid, requestKey, body, nowIso });
  return applyControl(db, { uid, action, requestKey, nowIso });
}
