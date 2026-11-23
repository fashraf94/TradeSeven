// api/_utils/practiceField/agentDrafting.js
//
// Practice Field build B2 — DRAFTING (§2; rulings B2-2, B2-3, B2-4, B2-7). What a desk's validated answer drafted becomes,
// slot by slot. Code admits; the agent never sets money.
//
// ONLY AN EMPTY SLOT OF THE DESK, ONCE A SESSION. A slot is drafted only when it is empty and its refill attempt is
// unspent this session (B6: one refill attempt per slot per session; at most three drafts a call). For each such slot the
// desk's drafts for it are tried IN THE AGENT'S ORDER and at most one is admitted; the rest are `not_chosen`.
//
// EACH DRAFT, before admission:
//   • its slot is one of the desk's (`slot_not_this_desks`) and is a slot being drafted (`slot_not_empty`);
//   • its source resolves: the price list — its reference is THIS close's snapshot; a saved thesis — its label is one the
//     desk was given (the saved theses' sub-switch on, the Shadow desk only), resolved to the saved list's id
//     (`thesis_source_unknown`);
//   • every name is a candidate: a stock the house universe carries, priced in this close's snapshot, not held or pending
//     in another idea of the book (`name_not_a_candidate`);
//   • it becomes a contract through normalizeIdeaContract (author `agent`; origin `market_scan` with the snapshot, or
//     `research` with the saved list — B2-4; the desk frozen with it — B2-7), refused outside B3 or B5 by its codes;
//   • SIZED BY CODE (B2-3): a read-only probe (admission.js previewAdmission) reads the slot's permitted maximum under the
//     rails and the cash floor at this instant, and the draft is admitted (admitIdea) with exactly that capital — at THIS
//     close's snapshot (admission's mark set after the close: the session's `${date}_close`) and with SERVER time
//     (carried condition, Astra T2C).
//
// THE REFILL ATTEMPT. A slot's attempt is spent once a draft for it reached admission with any answer but these two —
// `close_owed` and `admission_marks_unavailable` (a held name's mark or its corporate-action data at this instant: the
// ex-dividend case among them) — which say nothing about the draft (carried condition, Astra T1a-2b-2 review). Such a
// refusal leaves the attempt UNSPENT: the slot's drafts are kept on the close row, and the next fire of the same close
// window tries them again — with no model call.
//
// IDEMPOTENT. Each draft's admission is a deterministic operation (`agent:{session}:{desk}:{slot}:d{index}`): a replay
// finds the idea it already made (by its id, before any probe — a second probe would size against a treasury the first
// admission already moved) and records it admitted.

import { admitIdea, previewAdmission, ideaIdFor } from './admission.js';
import { normSymbol } from './symbols.js';
import { DESKS } from './agentConfig.js';

/** The refusals that leave a slot's refill attempt unspent (they say nothing about the draft). */
export const TRANSIENT_ADMISSION_CODES = new Set(['close_owed', 'admission_marks_unavailable']);

/** A draft's outcome on the considered list. */
export const DRAFT_OUTCOME = Object.freeze({ ADMITTED: 'admitted', REFUSED: 'refused', NOT_CHOSEN: 'not_chosen', WAITING: 'waiting' });

/** The deterministic operation of one draft's admission. */
export const draftOpIdOf = ({ session, desk, slot, index }) => `agent:${session}:${desk}:${slot}:d${index}`;

/** A refusal as the close row keeps it: its code and a small, bounded detail. */
const refusalRecord = (r) => {
  const keep = {};
  for (const k of ['symbol', 'slot', 'constraint', 'reason', 'session', 'limitUsd', 'requestedUsd', 'min', 'max', 'distancePct', 'ideaId', 'status']) {
    if (r?.[k] !== undefined && r[k] !== null && typeof r[k] !== 'object') keep[k] = r[k];
  }
  if (Array.isArray(r?.symbols)) keep.symbols = r.symbols.slice(0, 8);
  return { code: String(r?.code ?? 'unknown'), ...keep };
};

/** The draft as the considered list shows it (its own words and what it asked for; never money it did not set). */
const consideredOf = (d) => ({
  index: d.index, slot: d.slot, names: d.names, thesis: d.thesis, comparison: d.comparison, lines: d.lines, source: d.source,
});

/** The raw contract a draft becomes, before sizing. Pure. */
export function draftContractOf(draft, { desk, source, capitalUsd }) {
  return {
    thesis: { text: draft.thesis, author: 'agent' },
    slot: draft.slot,
    names: draft.names,
    comparison: draft.comparison,
    lines: draft.lines,
    capitalUsd,
    origin: { kind: source.kind, initiatedBy: 'agent' },
    sources: [{ kind: source.kind, ref: source.ref }],
    desk,
  };
}

/** The placeholder capital the sizing probe is evaluated with (it decides no capital limit; see previewAdmission). */
const PROBE_CAPITAL_USD = 1000;

/**
 * Draft a desk's empty slots from its validated answer.
 *
 * @param {object} args
 * @param {'shadow'|'archetype'} args.desk
 * @param {string} args.bookId
 * @param {string} args.session
 * @param {Array<object>} args.drafts          the validated answer's drafts, in the agent's order
 * @param {string[]} args.slotsToDraft         the desk's empty slots whose refill attempt is unspent this session
 * @param {Set<string>} args.candidateSymbols  this close's candidate names (agentSources.js candidatesOf)
 * @param {string} args.snapshotKey            this close's snapshot (the price list's source reference)
 * @param {Object<string,string>} args.thesisRefs  label → saved list id (empty when theses are not a source)
 * @param {() => Date} args.clock              server time
 * @returns {Promise<{ considered: Array<object>, refill: Object<string, object> }>}
 */
export async function draftSlots(db, { desk, bookId, session, drafts, slotsToDraft, candidateSymbols, snapshotKey, thesisRefs = {}, clock = () => new Date() }) {
  const deskSlots = DESKS[desk].slots;
  const considered = [];
  const refill = {};
  const done = new Set();
  for (const slot of slotsToDraft) refill[slot] = { attempted: false, spent: false, admittedIdeaId: null, waitingOn: null };

  for (const d of drafts) {
    const entry = consideredOf(d);
    const refuse = (refusals) => { considered.push({ ...entry, outcome: DRAFT_OUTCOME.REFUSED, refusals: refusals.map(refusalRecord) }); };
    if (!deskSlots.includes(d.slot)) { refuse([{ code: 'slot_not_this_desks', slot: d.slot }]); continue; }
    if (!Object.hasOwn(refill, d.slot)) { refuse([{ code: 'slot_not_empty', slot: d.slot }]); continue; }
    if (done.has(d.slot)) { considered.push({ ...entry, outcome: DRAFT_OUTCOME.NOT_CHOSEN, refusals: [] }); continue; }
    // The source.
    let source;
    if (d.source.kind === 'saved_thesis') {
      const listId = d.source.thesisRef ? thesisRefs[d.source.thesisRef] : undefined;
      if (typeof listId !== 'string') { refuse([{ code: 'thesis_source_unknown' }]); continue; }
      source = { kind: 'research', ref: listId };
    } else source = { kind: 'market_scan', ref: snapshotKey };
    // Every name a candidate of this close.
    const notCandidates = d.names.filter((n) => !candidateSymbols.has(normSymbol(n)));
    if (notCandidates.length > 0) { refuse(notCandidates.map((symbol) => ({ code: 'name_not_a_candidate', symbol }))); continue; }

    const opId = draftOpIdOf({ session, desk, slot: d.slot, index: d.index });
    const ideaId = ideaIdFor(bookId, opId);
    // A replay finds the idea it already made: admitted, before any probe.
    const existing = await db.collection('mandates').doc(bookId).collection('ideas').doc(ideaId).get();
    if (existing.exists) {
      considered.push({ ...entry, outcome: DRAFT_OUTCOME.ADMITTED, refusals: [], ideaId, capitalUsd: existing.data()?.contract?.capitalUsd ?? null, idempotentReplay: true });
      refill[d.slot] = { attempted: true, spent: true, admittedIdeaId: ideaId, waitingOn: null };
      done.add(d.slot);
      continue;
    }
    // Sized by code: the probe reads the permitted maximum at this instant, then admission runs with exactly it.
    const nowIso = clock().toISOString();
    const probe = await previewAdmission(db, { bookId, contract: draftContractOf(d, { desk, source, capitalUsd: PROBE_CAPITAL_USD }), opId, nowIso });
    let answer;
    if (!probe.shapeOk || !probe.ok) answer = { ok: false, refusals: probe.refusals, binding: probe.binding };
    else if (!(probe.permittedMaxUsd > 0)) answer = { ok: false, refusals: [{ code: 'no_capital_headroom' }], binding: probe.binding };
    else {
      answer = await admitIdea(db, { bookId, contract: draftContractOf(d, { desk, source, capitalUsd: probe.permittedMaxUsd }), opId, nowIso: clock().toISOString() });
    }
    refill[d.slot] = { ...refill[d.slot], attempted: true };
    if (answer.ok) {
      considered.push({ ...entry, outcome: DRAFT_OUTCOME.ADMITTED, refusals: [], ideaId: answer.ideaId, capitalUsd: probe.permittedMaxUsd, binding: (answer.binding || []).map((b) => b.constraint) });
      refill[d.slot] = { attempted: true, spent: true, admittedIdeaId: answer.ideaId, waitingOn: null };
      done.add(d.slot);
      continue;
    }
    const codes = (answer.refusals || []).map((r) => r?.code);
    // A refusal that says nothing about the draft (close_owed; a held name's marks or corporate-action data — the
    // ex-dividend case) leaves the attempt unspent: the slot's drafts wait for the next fire, with no model call.
    if (codes.length > 0 && codes.every((c) => TRANSIENT_ADMISSION_CODES.has(c))) {
      considered.push({ ...entry, outcome: DRAFT_OUTCOME.WAITING, refusals: (answer.refusals || []).map(refusalRecord) });
      refill[d.slot] = { attempted: true, spent: false, admittedIdeaId: null, waitingOn: [...new Set(codes)] };
      done.add(d.slot);
      continue;
    }
    refuse(answer.refusals?.length ? answer.refusals : [{ code: 'refused' }]);
    refill[d.slot] = { attempted: true, spent: true, admittedIdeaId: null, waitingOn: null };
  }
  return { considered, refill };
}
