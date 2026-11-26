// api/_utils/practiceField/agentRun.js
//
// Practice Field build B2 (T1b + T1d, launch scope) — THE AGENT'S CHECK AT THE CLOSE (PF-3, PF-4, B2-1 to B2-7).
//
// WHEN. Once a session, at the close window, AFTER the book's close for the session has committed (`lastCloseKey` is the
// session and its close row is on the window ledger, on time), for every ACTIVE idea book, only while
// PRACTICE_FIELD_AGENT_ENABLED is on. Early-close sessions too: the close sweep runs after every session's close. A draining
// or paused book drafts nothing and is not checked (account-level pause stops new drafting and spend).
// THE ORDER (build B4, ruling B4-8): the books are visited in an order of the session's own (agentPassOrder) — the same on
// every fire of that session, different from one session to the next — so a fire that runs out of time does not leave the
// same books unchecked every day. Nothing else about a desk's check depends on it.
//
// WHO. Two desks (B2-7), one after the other under the book's one lease — the second sizes its drafts from the treasury the
// first left: the Shadow desk (medium, long), then the archetype desk (short). A desk with NO WORK — no open idea of its
// own and no empty slot of its own it may still draft this session — makes NO call; it writes `source: 'no_work'`.
//
// ONE CALL PER DESK PER SESSION, ITS SPEND RESERVED AND SETTLED (spend.js). Each attempt:
//   1. RESERVE the most the call can cost (agentConfig.js: input bytes + allowance, `max_tokens`; no cache write, no server
//      tool), under its own operation `agent:{session}:{desk}#{n}`, bound to the model, the book and the request (the
//      purpose names the desk; the op records the model and ceilings; the close row records the request's input hash) — in
//      one transaction with the attempt recorded `reserved` on the close row;
//   2. CALL through the Mandate engine's seam (callMandateModelDirect — called, never edited), with this module's own
//      timeout;
//   3. SETTLE what it cost (modelPriceTable.js priceUsage over the reported usage), or — no readable usage: a transport
//      error, a timeout, or a reply whose usage is missing or unreadable (B2-A04; readableUsage) — `unpriced`, charged its
//      whole reservation, never $0; in the same transaction the attempt's outcome and, when
//      the answer validates (agentTool.js), THE ANSWER ITSELF, stored on the close row before anything acts on it.
// ONE RETRY, on a transport error only, reserved as attempt #2. An answer that does not validate is not retried.
// A REPLAY NEVER CALLS TWICE: a stored answer is acted on again (every action is idempotent); a desk part that is done is
// left alone; an attempt found `reserved` with no settlement (the process died mid-call — the call may have been billed)
// is settled unpriced and the desk falls back to code, with no further call.
//
// THE CODE FALLBACK (§1). If the call fails, or its answer does not validate, or the spend refuses it, or the prompt is over
// its ceiling, the desk's note is code-built — "The agent could not complete today's check; nothing changed." — with its
// reason; no draft, no action.
//
// WHAT THE ANSWER DOES (B2-1, B2-3; agentTool.js validated it): `hold` changes nothing; `exit` settles the idea early at this
// close (managerExit.js) — its settlement sale fills at the next session's first window; drafts go through code's admission,
// sized by code, at this close's snapshot and with server time (agentDrafting.js).
//
// THE NOTES LIVE ON THE SESSION'S CLOSE ROW (B2-6): `mandates/{bookId}/windows/{session}_close`, field `agent`, which the owner
// can already read — `agent.desks.{shadow|archetype}`: the desk's note, each idea's action and reason and what came of it,
// the drafts considered and why each was or was not admitted, the slots' refill attempts, the source (`model`,
// `code_fallback` or `no_work`), every attempt with its reservation and charge, and the manifest (what went in, never the
// text). No rules or index change.
//
// THE ROW'S WINDOW-LEVEL SUMMARY (Astra B2-A03). Every write of a desk's part — each in a transaction that read the row —
// also rewrites the row's `modelCalled`, `outcome` and `agent.summary`, DERIVED (never incremented) from both desks' parts
// as the row then holds them (agentWindowSummaryOf): an earlier desk's work stands when the next records none, a paid
// fallback reads apart from an executed proposal, and a replay that writes the same parts writes the same summary.
//
// NOTHING HERE READS THE DEPLOYED TRADING AGENT (its prompts, memory, consolidation) and nothing here reaches it: the desk's
// identity is the fixed Shadow brief or the epoch's frozen archetype identity (agentIsolation.imports.test.js).

import { createHash } from 'node:crypto';
import { callMandateModelDirect } from '../mandateModelCall.js';
import { acquireLease, releaseLease } from '../mandateLease.js';
import { MANDATE_SWEEP_PAGE_SIZE } from '../mandateConfig.js';
import { IDEA_BOOK_KIND, isIdeaBook } from '../mandateBookKind.js';
import { priceUsage } from '../modelPriceTable.js';
import { reserveSpend, settleSpend, incurredChargeNanos } from './spend.js';
import { practiceFieldAgentOn, practiceFieldAgentThesesOn } from './mode.js';
import { OPEN_IDEA_STATUSES, IDEA_STATUS } from './constants.js';
import { pendingSaleOf } from './settlement.js';
import {
  PRACTICE_FIELD_AGENT_MODEL, AGENT_MAX_OUTPUT_TOKENS, AGENT_MAX_INPUT_TOKENS, AGENT_CALL_TIMEOUT_MS, AGENT_MAX_ATTEMPTS,
  CODE_FALLBACK_NOTE, AGENT_NOTE_SOURCE, DESKS, deskOfIdea,
} from './agentConfig.js';
import { extractAgentToolInput, validateAgentAnswer } from './agentTool.js';
import { assembleAgentRequest, archetypeIdentityOf, shadowIdentity } from './agentPrompt.js';
import { candidatesOf, namesTakenByBook, readPriorNotes, readSavedTheses } from './agentSources.js';
import { draftSlots, draftOpIdOf, DRAFT_OUTCOME } from './agentDrafting.js';
import { ideaIdFor } from './admission.js';
import { exitIdeaByManager, EXIT_OUTCOME } from './managerExit.js';
import { epochRefOf } from './ideaBook.js';
import { windowsRefOf, closeCodeActed, WINDOW_OUTCOME } from './windowLedger.js';
import { windowRowId, CLOSE_WINDOW, nextSessionDate } from './windows.js';

const LOG_PREFIX = '[PracticeFieldAgent]';
/** The close row's `agent` block's own version (its own family). */
export const AGENT_CLOSE_ROW_VERSION = 1;
/** The seat the call is made from: the model and `max_tokens` only (no temperature — Sonnet 5.5 refuses one). */
export const AGENT_MODEL_SEAT = Object.freeze({ provider: 'anthropic', model: PRACTICE_FIELD_AGENT_MODEL, params: Object.freeze({ maxTokens: AGENT_MAX_OUTPUT_TOKENS }) });
/** The time a call needs left in the fire's budget before it is started (the timeout and a margin for its writes). */
export const AGENT_CALL_MARGIN_MS = 15_000;
/** The order the desks run in (the second sizes from the treasury the first left). */
export const DESK_ORDER = Object.freeze(['shadow', 'archetype']);

/** The production transport: the Mandate engine's model seam, called (never edited). Returns the raw response. */
export async function seamTransport({ modelSeat, content }) {
  const out = await callMandateModelDirect(modelSeat, content);
  return out.response;
}

/** The transport with this module's own timeout. A timeout is a transport error. */
export async function callWithTimeout(transport, request, timeoutMs = AGENT_CALL_TIMEOUT_MS) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`the call took longer than ${timeoutMs} ms`);
      err.code = 'agent_call_timeout';
      reject(err);
    }, timeoutMs);
  });
  try {
    return await Promise.race([transport(request), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const opIdOf = (session, desk, n) => `agent:${session}:${desk}#${n}`;
const closeRowRefOf = (bookRef, session) => windowsRefOf(bookRef).doc(windowRowId(session, CLOSE_WINDOW));

/**
 * B2-A03 — THE CLOSE ROW'S WINDOW-LEVEL SUMMARY, derived from the row's code block and BOTH desks' parts (`desks`: the parts
 * as the row will hold them after this write). Pure.
 *   modelCalled   some desk recorded an attempt (its `attempts`, the same source as the call counts — refuter F2: a desk's
 *                 own `calledModel` can be written false by a later fire's fallback while it carries a paid attempt);
 *   outcome       model_action (an exit settled or a draft admitted from a model answer) › model_fallback (a desk paid for a
 *                 call and fell back to code) › code_action (code acted at the close) › model_no_change (called; nothing
 *                 executed) › no_model_action. The summary keeps what the one word cannot: the calls per desk, the exits
 *                 and admissions, the desks whose paid call fell back, and whether code acted.
 */
export function agentWindowSummaryOf(row, desks) {
  const calls = {};
  const paidFallbacks = [];
  let modelCalled = false;
  let exits = 0;
  let admissions = 0;
  for (const desk of DESK_ORDER) {
    const p = desks?.[desk];
    if (!p) continue;
    const attempts = Array.isArray(p.attempts) ? p.attempts.length : 0;
    calls[desk] = attempts;
    if (attempts > 0) modelCalled = true;
    if (p.source === AGENT_NOTE_SOURCE.MODEL) {
      exits += (p.actions || []).filter((a) => a?.outcome === EXIT_OUTCOME.SETTLED).length;
      admissions += (p.considered || []).filter((c) => c?.outcome === DRAFT_OUTCOME.ADMITTED).length;
    }
    if (p.source === AGENT_NOTE_SOURCE.CODE_FALLBACK && attempts > 0) paidFallbacks.push(desk);
  }
  const codeActed = closeCodeActed(row?.code);
  let outcome = WINDOW_OUTCOME.NO_MODEL_ACTION;
  if (exits + admissions > 0) outcome = WINDOW_OUTCOME.MODEL_ACTION;
  else if (paidFallbacks.length > 0) outcome = WINDOW_OUTCOME.MODEL_FALLBACK;
  else if (codeActed) outcome = WINDOW_OUTCOME.CODE_ACTION;
  else if (modelCalled) outcome = WINDOW_OUTCOME.MODEL_NO_CHANGE;
  const callsTotal = Object.values(calls).reduce((n, c) => n + c, 0);
  return { modelCalled, outcome, summary: { calls, callsTotal, exits, admissions, paidFallbacks, codeActed } };
}

/** A desk's part as the close row's write (B2-A03: with the window-level summary, from the row this transaction read). */
const partPatch = (desk, part, rowData) => {
  const s = agentWindowSummaryOf(rowData, { ...(rowData?.agent?.desks || {}), [desk]: part });
  return {
    [`agent.desks.${desk}`]: part, 'agent.version': AGENT_CLOSE_ROW_VERSION, 'agent.model': PRACTICE_FIELD_AGENT_MODEL,
    'agent.summary': s.summary, modelCalled: s.modelCalled, outcome: s.outcome,
  };
};

/** The sessions from after `session` through `due` (the idea's review), or null when the walk leaves the calendar. */
function sessionsLeft(session, due) {
  if (typeof due !== 'string') return null;
  let n = 0;
  for (let s = session; s !== null && s < due && n < 400; s = nextSessionDate(s)) n += 1;
  return n;
}

/**
 * Why a book's desks make no call at all, or null. Shared contract V2 §3.2: "Paused stops drafting and model spend" —
 * so a paused book, or one winding down, is not checked by either desk (code still sells at its lines and settles).
 */
export function bookSpendStop(book) {
  if (book?.drafting === 'paused') return 'drafting_paused';
  if (book?.windDown) return 'wind_down';
  return null;
}

/**
 * Can the desk act on this idea at all? Only one `holding`, with no sale pending on any holding and no result: an idea not
 * yet entered, one selling at a line, or one settling would ignore an exit (§4), so it is context, never work.
 */
export const actionableIdea = (i) => i?.status === IDEA_STATUS.HOLDING && i.result == null
  && !Object.values(i.ledger?.holdings || {}).some((h) => pendingSaleOf(h) != null);

/**
 * What a desk owns on the book right now. Pure. Its WORK is an idea it can act on (actionableIdea) or an empty slot it may
 * draft; its other open ideas are shown as context. A book whose spend is stopped gives no desk any work.
 */
export function deskWorkOf(book, ideas, desk, { spentSlots = new Set() } = {}) {
  const deskIdeas = ideas.filter((i) => OPEN_IDEA_STATUSES.includes(i.status) && deskOfIdea(i) === desk && actionableIdea(i));
  const stopped = book.status !== 'active' || bookSpendStop(book) !== null;
  const emptySlots = stopped ? [] : DESKS[desk].slots.filter((s) => (book.slots?.[s] ?? null) === null && !spentSlots.has(s));
  return { deskIdeas: stopped ? [] : deskIdeas, emptySlots, hasWork: !stopped && (deskIdeas.length > 0 || emptySlots.length > 0), stoppedBy: stopped ? (bookSpendStop(book) ?? 'book_not_active') : null };
}

/**
 * Is a transport error worth the one retry? A timeout, a network error (no HTTP status), or an HTTP 408, 409, 429 or 5xx —
 * what may pass on a second try. A 4xx that says the request itself is wrong (400, 401, 403, 404, 413, 422…) is not
 * retried: it would fail the same way, and cost a second reservation.
 */
export function retryableTransportError(err) {
  if (err?.code === 'agent_call_timeout') return true;
  const status = Number(err?.status);
  if (!Number.isInteger(status)) return true;
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

/** Review B-3: the saved theses' labels the prompt carried (T1…Tn, trimmed from the end), and no other. Pure. */
export function thesisRefsKept(refs, keptCount) {
  return Object.fromEntries(Object.entries(refs || {}).filter(([label]) => /^T\d+$/.test(label) && Number(label.slice(1)) <= keptCount));
}

/**
 * B2-A04: is a reply's usage READABLE — an object whose input and output counts are whole numbers (input above zero: every
 * call sends a prompt), with any cache count present a whole number too? A reply whose usage is missing or unreadable is
 * charged its whole reservation (`unpriced`), never priced from zeros. Its answer is still acted on: only the charge changes.
 * Pure.
 */
export function readableUsage(u) {
  const count = (v) => Number.isInteger(v) && v >= 0;
  const optional = (v) => v === undefined || v === null || count(v);
  return u !== null && typeof u === 'object' && !Array.isArray(u)
    && count(u.input_tokens) && u.input_tokens > 0 && count(u.output_tokens)
    && optional(u.cache_read_input_tokens) && optional(u.cache_creation_input_tokens);
}

/** The usage figures kept on an attempt. */
const usageOf = (u) => (u && typeof u === 'object' ? {
  inputTokens: Number(u.input_tokens) || 0, outputTokens: Number(u.output_tokens) || 0,
  cacheReadTokens: Number(u.cache_read_input_tokens) || 0, cacheWriteTokens: Number(u.cache_creation_input_tokens) || 0,
} : null);

/**
 * ONE DESK'S CHECK of one book at one session's close (see the header). The caller holds the book's lease.
 *
 * @returns {Promise<{ desk: string, status: string, calls: number, source?: string, reason?: string }>}
 *   `status`: 'done' | 'already_done' | 'deferred' (not enough of the fire's time left; the next close fire serves it) |
 *             'skipped' (the session's close is not this book's last, or its close row is not there)
 */
export async function runDeskCheck(db, bookRef, { session, desk, transport = seamTransport, clock = () => new Date(), deadlineMs = Infinity, timeoutMs = AGENT_CALL_TIMEOUT_MS }) {
  const rowRef = closeRowRefOf(bookRef, session);
  const bookSnap = await bookRef.get();
  if (!bookSnap.exists || !isIdeaBook(bookSnap.data())) return { desk, status: 'skipped', calls: 0, reason: 'not_an_idea_book' };
  let book = bookSnap.data();
  if (book.status !== 'active') return { desk, status: 'skipped', calls: 0, reason: 'book_not_active' };
  if (book.execState?.lastCloseKey !== session) return { desk, status: 'skipped', calls: 0, reason: 'session_not_closed' };
  const rowSnap = await rowRef.get();
  const row = rowSnap.exists ? rowSnap.data() : null;
  // The check follows the session's own close, on time: a caught-up session is past (B2 reading R-2).
  if (!row || row.kind !== 'close' || row.valued !== true || row.caughtUpAt != null) return { desk, status: 'skipped', calls: 0, reason: 'no_on_time_close_row' };
  const prior = row.agent?.desks?.[desk] ?? null;

  const readIdeas = async (b) => {
    const out = [];
    for (const id of b.openIdeaIds || []) {
      const snap = await bookRef.collection('ideas').doc(id).get();
      if (snap.exists) out.push(snap.data());
    }
    return out;
  };
  const writePart = async (part) => {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(rowRef);
      if (!snap.exists) throw new Error('the close row is gone');
      tx.update(rowRef, partPatch(desk, part, snap.data()));
    });
  };

  // ── A desk already done: only a slot whose drafts wait on a transient refusal is tried again (no call). ──
  if (prior?.status === 'done') {
    const waiting = Object.entries(prior.refill || {}).filter(([, r]) => r?.spent === false && r?.attempted === true).map(([s]) => s);
    if (prior.source !== AGENT_NOTE_SOURCE.MODEL || waiting.length === 0 || !prior.answer) return { desk, status: 'already_done', calls: 0 };
    const ideas = await readIdeas(book);
    // A waiting slot that is still empty — or already held by THIS session's own draft (a retry that admitted and then died
    // before its write: replayed, so the record says admitted).
    const draftable = slotsToDraftNow(book, ideas, { bookId: bookRef.id, session, desk, answer: prior.answer, spentSlots: new Set() });
    const stillEmpty = waiting.filter((s) => draftable.includes(s));
    if (stillEmpty.length === 0) return { desk, status: 'already_done', calls: 0 };
    const drafted = await draftFromAnswer(db, bookRef, { book, ideas, session, desk, answer: prior.answer, slotsToDraft: stillEmpty, thesisRefs: prior.thesisRefs || {}, clock, snapshotKey: closeSnapshotKeyOf(row, session) });
    const refill = { ...prior.refill, ...drafted.refill };
    const considered = [...(prior.considered || []).filter((c) => !stillEmpty.includes(c.slot)), ...drafted.considered.filter((c) => stillEmpty.includes(c.slot))];
    await writePart({ ...prior, refill, considered, retriedAt: clock().toISOString() });
    return { desk, status: 'done', calls: 0, source: prior.source, reason: 'drafts_retried' };
  }

  const ideas = await readIdeas(book);
  const spentSlots = new Set(Object.entries(prior?.refill || {}).filter(([, r]) => r?.spent === true).map(([s]) => s));
  const work = deskWorkOf(book, ideas, desk, { spentSlots });
  const startedAt = prior?.startedAt ?? clock().toISOString();
  const base = {
    desk, deskName: DESKS[desk].name, slots: [...DESKS[desk].slots], startedAt,
    work: { openIdeaIds: work.deskIdeas.map((i) => i.ideaId), emptySlots: [...work.emptySlots] },
  };
  const fallback = async (reason, extra = {}) => {
    const part = {
      ...base, ...(prior || {}), ...extra, status: 'done', completedAt: clock().toISOString(), source: AGENT_NOTE_SOURCE.CODE_FALLBACK,
      note: CODE_FALLBACK_NOTE, fallbackReason: reason, actions: [], considered: [], refill: {},
      work: base.work,
    };
    delete part.answer;
    await writePart(part);
    return { desk, status: 'done', calls: extra.callsThisFire ?? 0, source: AGENT_NOTE_SOURCE.CODE_FALLBACK, reason };
  };

  if (!prior && !work.hasWork) {
    await writePart({ ...base, status: 'done', completedAt: clock().toISOString(), calledModel: false, source: AGENT_NOTE_SOURCE.NO_WORK, note: null, fallbackReason: null, stoppedBy: work.stoppedBy, actions: [], considered: [], refill: {}, attempts: [], manifest: null });
    return { desk, status: 'done', calls: 0, source: AGENT_NOTE_SOURCE.NO_WORK };
  }

  // ── A crash mid-call: the reservation stands with no settlement — the call may have been billed. Settle it unpriced
  //    (its whole reservation) and fall back; never call again (a replay never calls twice). ──
  const attempts = [...(prior?.attempts || [])];
  const open = attempts.find((a) => a.state === 'reserved');
  if (open && !prior?.answer) {
    await db.runTransaction(async (tx) => {
      const b = await tx.get(bookRef);
      const r = await tx.get(rowRef);
      const settled = await settleSpend(tx, b, { opId: open.opId, unpriced: true }, { nowIso: clock().toISOString() });
      const cur = r.data()?.agent?.desks?.[desk] ?? prior;
      const nextAttempts = (cur.attempts || []).map((a) => (a.opId === open.opId ? { ...a, state: 'settled', outcome: 'interrupted', unpriced: true, chargedUsd: settled.chargedUsd ?? a.maxChargeUsd, settledAt: clock().toISOString() } : a));
      tx.update(rowRef, partPatch(desk, { ...cur, attempts: nextAttempts }, r.data()));
    });
    const after = (await rowRef.get()).data()?.agent?.desks?.[desk] ?? {};
    return fallback('interrupted_call', { attempts: after.attempts, calledModel: true, manifest: after.manifest ?? null });
  }

  // ── The stored answer, if an earlier fire already got one: act on it again (every action is idempotent). ──
  let answer = prior?.answer ?? null;
  let manifest = prior?.manifest ?? null;
  let thesisRefs = prior?.thesisRefs ?? {};
  let thesesSkipped = prior?.thesesSkipped ?? [];
  let callsThisFire = 0;

  if (!answer) {
    // Review A-2: a book paused (or winding down) after an earlier fire left this desk mid-way spends nothing more.
    if (work.stoppedBy) return fallback(`spend_stopped:${work.stoppedBy}`, { attempts, calledModel: attempts.length > 0 });
    // Review A-1: what an attempt SETTLED decides, whether or not the fallback written after it survived. An answer that did
    // not validate, a call refused outright, or a call cut short by a crash is never followed by another call.
    const final = attempts.find((a) => a.state === 'settled' && (a.outcome === 'invalid_answer' || a.outcome === 'interrupted' || (a.outcome === 'transport_error' && a.retryable === false)));
    if (final) return fallback(final.outcome === 'invalid_answer' ? `answer_invalid:${final.invalidReason ?? 'unknown'}` : (final.outcome === 'interrupted' ? 'interrupted_call' : 'transport_refused'), { attempts, calledModel: true });
    if (attempts.length >= AGENT_MAX_ATTEMPTS) return fallback('attempts_spent', { attempts, calledModel: attempts.length > 0 });
    // The prompt's inputs, each bounded and read-only.
    const epochSnap = await epochRefOf(bookRef, book).get();
    const identity = desk === 'shadow' ? shadowIdentity() : archetypeIdentityOf(epochSnap.exists ? epochSnap.data() : null);
    if (!identity) return fallback('identity_unavailable', { attempts, calledModel: false });
    const snapshotKey = closeSnapshotKeyOf(row, session);
    const closeCandidates = await closeCandidatesOf(db, { snapshotKey, session, book, ideas });
    const candidates = work.emptySlots.length > 0 ? closeCandidates : [];
    // Review B-1: a slot is offered for drafting only when this close priced a candidate. Without one (the close snapshot
    // was built without the universe), drafting would be a paid call with nothing to draft from: the slot is not offered,
    // its attempt stays unspent, and the next close drafts it. A desk left with nothing else to do makes no call.
    const offeredSlots = candidates.length > 0 ? work.emptySlots : [];
    if (work.deskIdeas.length === 0 && offeredSlots.length === 0 && attempts.length === 0) {
      await writePart({ ...base, status: 'done', completedAt: clock().toISOString(), calledModel: false, source: AGENT_NOTE_SOURCE.NO_WORK, note: null, fallbackReason: null, stoppedBy: null, draftingSkipped: 'no_candidates', actions: [], considered: [], refill: {}, attempts: [], manifest: null });
      return { desk, status: 'done', calls: 0, source: AGENT_NOTE_SOURCE.NO_WORK, reason: 'no_candidates' };
    }
    let theses = null;
    if (desk === 'shadow' && DESKS.shadow.readsTheses && practiceFieldAgentThesesOn() && offeredSlots.length > 0) {
      // Fenced: a failed read of the saved theses costs the desk its theses, never its check.
      try {
        const read = await readSavedTheses(db, { uid: book.userId });
        theses = read.theses;
        thesisRefs = read.refs;
        thesesSkipped = read.skipped;
      } catch (err) {
        console.error(`${LOG_PREFIX} ${bookRef.id} ${session} the saved theses could not be read — the Shadow desk drafts without them: ${err.message}`);
        thesesSkipped = [{ listId: null, reason: 'theses_read_failed' }];
      }
    }
    const priorNotes = await readPriorNotes(bookRef, { session, desk });
    const rowsOf = async (list) => {
      const out = [];
      for (const idea of list) {
        const r = await bookRef.collection('ideas').doc(idea.ideaId).collection('rows').doc(session).get();
        out.push({ idea, row: r.exists ? r.data() : null, sessionsLeft: sessionsLeft(session, idea.contract?.schedule?.dueSession) });
      }
      return out;
    };
    const deskIdeas = await rowsOf(work.deskIdeas);
    const deskIdeaIds = new Set(work.deskIdeas.map((i) => i.ideaId));
    const otherIdeas = await rowsOf(ideas.filter((i) => OPEN_IDEA_STATUSES.includes(i.status) && !deskIdeaIds.has(i.ideaId)));
    const assembled = assembleAgentRequest({
      desk, identity, session, snapshotKey, book, deskIdeas, otherIdeas, emptySlots: offeredSlots, priorNotes, candidates, theses,
    });
    if (!assembled.ok) return fallback(assembled.code, { attempts, calledModel: false });
    // Review B-3: a label the prompt dropped (the ceiling trims theses from the end) no longer resolves to a saved list.
    if (theses !== null) thesisRefs = thesisRefsKept(thesisRefs, assembled.manifest.counts.theses);
    manifest = { ...assembled.manifest, offeredSlots, ...(theses !== null ? { thesesSkipped } : {}) };

    for (let n = attempts.length + 1; n <= AGENT_MAX_ATTEMPTS; n += 1) {
      if (clock().getTime() + timeoutMs + AGENT_CALL_MARGIN_MS > deadlineMs) {
        // Not enough of the fire's time left for a call: the next close fire serves this desk. Nothing was reserved.
        if (attempts.length > 0) await writePart({ ...base, ...(prior || {}), status: 'in_progress', attempts, manifest, thesisRefs, thesesSkipped });
        return { desk, status: 'deferred', calls: callsThisFire };
      }
      const opId = opIdOf(session, desk, n);
      const reservedAt = clock().toISOString();
      const reserved = await db.runTransaction(async (tx) => {
        const b = await tx.get(bookRef);
        const r = await tx.get(rowRef);
        const res = await reserveSpend(tx, b, {
          modelId: PRACTICE_FIELD_AGENT_MODEL, maxInputTokens: AGENT_MAX_INPUT_TOKENS, maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS,
          cacheTtl: 'none', serverTools: [], purpose: `practice_field_agent:${desk}`, opId, nowIso: reservedAt,
        });
        if (!res.ok) return res;
        const cur = r.data()?.agent?.desks?.[desk] ?? null;
        if (res.idempotentReplay) {
          // Refuter R-1: the transaction RE-RAN after its own commit landed (an ambiguous commit is retried by the SDK).
          // The row it read holds THIS attempt, reserved at this instant, under this fire's lease: the reservation is
          // ours, and the call goes ahead under it.
          const mine = (cur?.attempts || []).find((a) => a.opId === opId);
          if (res.state === 'reserved' && mine?.state === 'reserved' && mine.reservedAt === reservedAt) return { ...res, ownCommit: true };
          // Review A-7: otherwise the close row lost the operation's record. Never call under it. A reservation still open
          // is settled at its maximum (it may have been billed), and the attempt is written back, so nothing is stranded.
          const s = res.state === 'reserved' ? await settleSpend(tx, b, { opId, unpriced: true }, { nowIso: reservedAt }) : null;
          const lost = {
            n, opId, state: 'settled', reservedAt: mine?.reservedAt ?? null, maxChargeUsd: res.maxChargeUsd, inputHash: manifest.inputHash,
            outcome: 'interrupted', recordLost: true, unpriced: true, chargedUsd: s?.chargedUsd ?? null, settledAt: reservedAt,
          };
          const kept = (cur?.attempts || []).filter((a) => a.opId !== opId);
          tx.update(rowRef, partPatch(desk, { ...base, ...(cur || {}), status: 'in_progress', calledModel: true, attempts: [...kept, lost], manifest, thesisRefs, thesesSkipped }, r.data()));
          return { ...res, lostAttempt: lost, attemptsNow: [...kept, lost] };
        }
        const attempt = { n, opId, state: 'reserved', reservedAt, maxChargeUsd: res.maxChargeUsd, inputHash: manifest.inputHash, outcome: null };
        tx.update(rowRef, partPatch(desk, {
          ...base, ...(cur || {}), status: 'in_progress', calledModel: true, attempts: [...attempts, attempt], manifest, thesisRefs, thesesSkipped,
        }, r.data()));
        return res;
      });
      if (!reserved.ok) return fallback(`spend_refused:${reserved.code}`, { attempts, calledModel: attempts.length > 0, manifest });
      // Review A-7: an operation the close row lost the record of is never called under again; its attempt is kept.
      if (reserved.lostAttempt) return fallback('attempt_already_reserved', { attempts: reserved.attemptsNow, calledModel: true, manifest });
      attempts.push({ n, opId, state: 'reserved', reservedAt, maxChargeUsd: reserved.maxChargeUsd, inputHash: manifest.inputHash, outcome: null });

      let response = null;
      let transportError = null;
      callsThisFire += 1;
      try {
        response = await callWithTimeout(transport, { modelSeat: AGENT_MODEL_SEAT, content: assembled.content }, timeoutMs);
      } catch (err) {
        transportError = err;
      }
      // What it cost: the reported usage, priced; no usage (an error, a timeout, an unreadable answer) is unpriced.
      const usage = response && readableUsage(response.usage) ? usageOf(response.usage) : null;
      const priced = usage ? priceUsage(PRACTICE_FIELD_AGENT_MODEL, response.usage) : null;
      const unpriced = !(priced && priced.priced === true && Number.isFinite(priced.estUsd));
      let outcome;
      let validated = null;
      let invalidReason = null;
      if (transportError) outcome = 'transport_error';
      else {
        const extracted = extractAgentToolInput(response);
        const check = extracted.ok ? validateAgentAnswer(extracted.input, { openIdeaIds: work.deskIdeas.map((i) => i.ideaId) }) : { ok: false, reason: extracted.reason };
        if (check.ok) { validated = check.answer; outcome = 'answered'; } else { invalidReason = check.reason; outcome = 'invalid_answer'; }
      }
      const settledAt = clock().toISOString();
      const settledAttempt = await db.runTransaction(async (tx) => {
        const b = await tx.get(bookRef);
        const r = await tx.get(rowRef);
        const s = await settleSpend(tx, b, unpriced ? { opId, unpriced: true } : { opId, actualUsd: priced.estUsd }, { nowIso: settledAt });
        const done = {
          n, opId, state: 'settled', reservedAt, maxChargeUsd: reserved.maxChargeUsd, inputHash: manifest.inputHash, outcome, settledAt,
          chargedUsd: s.chargedUsd ?? null, unpriced, usage,
          ...(response && usage === null ? { usageUnreadable: true } : {}),
          ...(transportError ? { error: String(transportError.code || transportError.name || 'error').slice(0, 60), httpStatus: Number.isInteger(Number(transportError.status)) ? Number(transportError.status) : null, retryable: retryableTransportError(transportError) } : {}),
          ...(invalidReason ? { invalidReason: String(invalidReason).slice(0, 120) } : {}),
          ...(response?.stop_reason ? { stopReason: String(response.stop_reason).slice(0, 40) } : {}),
        };
        const cur = r.data()?.agent?.desks?.[desk] ?? {};
        const nextAttempts = (cur.attempts || []).map((a) => (a.opId === opId ? done : a));
        tx.update(rowRef, partPatch(desk, { ...cur, attempts: nextAttempts, ...(validated ? { answer: validated } : {}) }, r.data()));
        return done;
      });
      attempts[attempts.length - 1] = settledAttempt;
      if (validated) { answer = validated; break; }
      if (transportError && retryableTransportError(transportError) && n < AGENT_MAX_ATTEMPTS) continue; // one retry, on a retryable transport error only
      return fallback(transportError ? (retryableTransportError(transportError) ? 'transport_failed' : 'transport_refused') : `answer_invalid:${invalidReason}`, { attempts, calledModel: true, manifest, callsThisFire });
    }
    if (!answer) return fallback('transport_failed', { attempts, calledModel: true, manifest, callsThisFire });
  }

  // ── Act on the stored answer. Each step is idempotent: a replay of this session records the same outcomes. ──
  book = (await bookRef.get()).data();
  const nowIdeas = await readIdeas(book);
  const actions = [];
  for (const a of answer.actions) {
    if (a.action === 'hold') { actions.push({ ...a, outcome: 'held' }); continue; }
    try {
      const res = await exitIdeaByManager(db, bookRef, { ideaId: a.ideaId, session, desk, reason: a.reason, nowIso: clock().toISOString() });
      actions.push({ ...a, outcome: res.ok ? res.outcome : `refused:${res.code}` });
    } catch (err) {
      console.error(`${LOG_PREFIX} ${bookRef.id} ${session} ${desk} exit of ${a.ideaId} failed: ${err.message}`);
      actions.push({ ...a, outcome: 'refused:error' });
    }
  }
  const after = (await bookRef.get()).data();
  const drafted = await draftFromAnswer(db, bookRef, {
    book: after, ideas: nowIdeas, session, desk, answer, thesisRefs, clock, snapshotKey: closeSnapshotKeyOf(row, session),
    // Only the slots the prompt offered (manifest.offeredSlots — review B-1): one not offered keeps its attempt for the next close.
    slotsToDraft: slotsToDraftNow(after, nowIdeas, { bookId: bookRef.id, session, desk, answer, spentSlots }).filter((s) => (manifest?.offeredSlots ?? []).includes(s)),
  });
  // What the desk's attempts were charged, summed in whole nano-dollars (each charge is one, as spend.js wrote it).
  const chargedNanos = attempts.reduce((sum, at) => sum + (Number.isFinite(at.chargedUsd) ? incurredChargeNanos(at.chargedUsd) : 0), 0);
  const tokens = attempts.reduce((acc, at) => ({
    inputTokens: acc.inputTokens + (at.usage?.inputTokens || 0), outputTokens: acc.outputTokens + (at.usage?.outputTokens || 0),
  }), { inputTokens: 0, outputTokens: 0 });
  await writePart({
    ...base, status: 'done', completedAt: clock().toISOString(), calledModel: true, source: AGENT_NOTE_SOURCE.MODEL,
    note: answer.bookNote, fallbackReason: null, answer, actions, considered: drafted.considered, refill: drafted.refill,
    attempts, manifest: manifest ? { ...manifest, ...tokens, chargedUsd: chargedNanos / 1e9 } : null, thesisRefs, thesesSkipped,
  });
  return { desk, status: 'done', calls: callsThisFire, source: AGENT_NOTE_SOURCE.MODEL };
}

/**
 * The slots a desk drafts from its answer now: its empty slots (refill attempt unspent), and — on a REPLAY after a crash
 * between an admission and the part's write — any of its slots already held by THIS session's own draft (the idea its
 * deterministic operation made), so the replay records that draft as admitted (agentDrafting.js finds the idea by its id)
 * instead of refusing it for a slot that is no longer empty. Pure.
 */
export function slotsToDraftNow(book, ideas, { bookId, session, desk, answer, spentSlots }) {
  const empty = deskWorkOf(book, ideas, desk, { spentSlots }).emptySlots;
  const ownToday = (answer?.drafts || [])
    .filter((d) => DESKS[desk].slots.includes(d.slot) && (book.slots?.[d.slot] ?? null) === ideaIdFor(bookId, draftOpIdOf({ session, desk, slot: d.slot, index: d.index })))
    .map((d) => d.slot);
  return [...new Set([...empty, ...ownToday])];
}

/** The close snapshot a desk's check reads: the one its close row names (the session's `_close` snapshot). */
const closeSnapshotKeyOf = (row, session) => row?.closeSnapshotKey ?? `${session}_close`;

/**
 * B2-A01 — THE ONE CANDIDATE SELECTOR of a desk's check: this close's candidates (agentSources.js candidatesOf, which keeps
 * only a name marked with THIS session's close). The prompt's list and drafting's check both read it, over the same snapshot.
 */
async function closeCandidatesOf(db, { snapshotKey, session, book, ideas }) {
  const snap = await db.collection('mandateUniverseSnapshots').doc(snapshotKey).get();
  return snap.exists ? candidatesOf(snap.data(), namesTakenByBook(book, ideas), { session }) : [];
}

/** The drafting of a desk's empty slots from its stored answer (agentDrafting.js), with this close's candidates. */
async function draftFromAnswer(db, bookRef, { book, ideas, session, desk, answer, slotsToDraft, thesisRefs, clock, snapshotKey }) {
  if (slotsToDraft.length === 0 || answer.drafts.length === 0) {
    const considered = answer.drafts.map((d) => ({ index: d.index, slot: d.slot, names: d.names, thesis: d.thesis, comparison: d.comparison, lines: d.lines, source: d.source, outcome: 'refused', refusals: [{ code: DESKS[desk].slots.includes(d.slot) ? 'slot_not_empty' : 'slot_not_this_desks', slot: d.slot }] }));
    return { considered, refill: {} };
  }
  const candidates = await closeCandidatesOf(db, { snapshotKey, session, book, ideas });
  return draftSlots(db, {
    desk, bookId: bookRef.id, session, drafts: answer.drafts, slotsToDraft, candidateSymbols: new Set(candidates.map((c) => c.symbol)), snapshotKey, thesisRefs, clock,
  });
}

/** The sweep's presence answer that means "no idea book at all" (sweep.js readIdeaBookPresence). */
const noIdeaBook = (presence) => presence?.known === true && presence.ideaBooks === false;

/**
 * Build B4 (ruling B4-8) — THE PASS'S ORDER: the books sorted by the SHA-256 of (the session, the book's id), ties (none in
 * practice) by the id. Deterministic for a session — a replay, or the next fire in the window, visits them the same way and
 * picks up where the last left off — and different from one session to the next, so a fire that runs out of time does not
 * leave the same books unchecked every day. Every book given is visited once. No clock, no randomness. Pure.
 */
export function agentPassOrder(docs, session) {
  const keyed = (docs || []).map((d) => ({ d, k: createHash('sha256').update(`${session}\u0000${d.id}`, 'utf8').digest('hex') }));
  keyed.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : (a.d.id < b.d.id ? -1 : a.d.id > b.d.id ? 1 : 0)));
  return keyed.map((x) => x.d);
}

/**
 * THE AGENT PASS of one close fire: for every ACTIVE idea book whose close for `date` has committed, each desk's check, under
 * the book's lease. Nothing is read unless the agent is on. Fenced: one book's failure is counted, never thrown.
 *
 * @returns {Promise<{ books: number, checked: number, calls: number, fallbacks: number, deferred: number, errors: number, leaseSkips: number }>}
 */
export async function runIdeaBookAgentPass(db, {
  date, now = new Date(), ownerToken, presence, deadlineMs = Infinity, transport = seamTransport, clock = () => new Date(), timeoutMs = AGENT_CALL_TIMEOUT_MS,
}) {
  const out = { books: 0, checked: 0, calls: 0, fallbacks: 0, deferred: 0, errors: 0, leaseSkips: 0 };
  if (!practiceFieldAgentOn()) return out; // off: not even the query
  if (noIdeaBook(presence)) return out;
  const page = await db.collection('mandates').where('status', '==', 'active').where('kind', '==', IDEA_BOOK_KIND).limit(MANDATE_SWEEP_PAGE_SIZE).get();
  // Build B4 (B4-8): the page (25, above the founder cap of 12: every active book) in this session's own order.
  for (const docSnap of agentPassOrder(page.docs, date)) {
    if (docSnap.data().execState?.lastCloseKey !== date) continue; // its close for the date has not committed
    out.books += 1;
    const bookRef = docSnap.ref;
    let lease = null;
    try {
      lease = await acquireLease(db, bookRef, ownerToken, { now });
      if (!lease.acquired) { out.leaseSkips += 1; continue; }
      let checked = false;
      for (const desk of DESK_ORDER) {
        // A fence per desk: one desk's failure is counted and never costs the other desk its check.
        let res;
        try {
          res = await runDeskCheck(db, bookRef, { session: date, desk, transport, clock, deadlineMs, timeoutMs });
        } catch (err) {
          out.errors += 1;
          console.error(`${LOG_PREFIX} ${bookRef.id} ${desk} desk failed for ${date}: ${err.message}`);
          continue;
        }
        out.calls += res.calls;
        if (res.status === 'done' && res.reason !== 'drafts_retried') checked = true;
        if (res.source === AGENT_NOTE_SOURCE.CODE_FALLBACK && res.status === 'done') out.fallbacks += 1;
        if (res.status === 'deferred') { out.deferred += 1; break; }
      }
      if (checked) out.checked += 1;
    } catch (err) {
      out.errors += 1;
      console.error(`${LOG_PREFIX} ${bookRef.id} agent pass failed for ${date}: ${err.message}`);
    } finally {
      if (lease?.acquired) await releaseLease(db, bookRef, ownerToken).catch(() => {});
    }
  }
  return out;
}

