// api/_utils/practiceField/managerExit.js
//
// Practice Field build B2 — THE MANAGER'S EXIT (ruling B2-1: "`exit` settles the idea early, through the existing
// settlement sale, with the reason `manager_exit`"; §4: "queues the idea's early settlement for the next session's first
// eligible window, through the settlement path"; PF-3: code carries the action out at the next session's first window).
//
// THE PATH, REUSED WHOLE. A due session settles an idea in two steps: its close writes the ENDPOINT (the idea's value at
// that close, the result, every holding marked for the one settlement sale, the idea `settled`), and the next session's
// first window SELLS (exits.js: the settlement sale, origin `settlement`; when the last holding fills, the cash returns,
// the slot frees and the idea is `resulted`). The agent judges at a close, after that close has committed, so the exit
// writes the endpoint OF THAT CLOSE — the close the agent judged — in a transaction of its own, by the close's own step
// (close.js settleIdeaAtEndpoint, with `kind: 'manager_exit'` and the reason on each holding's settlement record) and the
// close's own evidence reads (close.js readIdeaEvidenceRows; evidence.js buildResultEvidence). The sale is then the
// settlement sale every settled idea gets, at the first window after the exit: the next session's first. Nothing sells
// here and no money moves: the book's cash, positions and revision are untouched (the reconciliation proves it).
//
// THE VALUATIONS ARE THE CLOSE'S OWN. The close stored the idea's row for the session (`ideas/{id}/rows/{session}`) with
// every mark it used on all three ledgers — price, quality, source, vendor time — and the ledgers it left are on the
// idea. The endpoint is built from exactly those: the same marks, the same holdings, the same cost tiers, so it is the
// endpoint the close itself would have written had that session been the due one (a differential row pins it).
//
// GUARDS, every read before any write:
//   • the book is an open idea book whose last close IS the session (`execState.lastCloseKey`), and no window of a later
//     session has been served (`lastIdeaTickKey`) — a stale exit is refused `session_moved_on`;
//   • the idea is this desk's, `holding`, with no pending sale on any holding, no result, and the session before its due
//     one; an idea already selling (at a line, or settling) or not yet entered IGNORES the exit (§4), with the reason;
//   • its row for the session exists, was observed and written on time (no `caughtUpAt`), and marks every holding;
//   • the book reconciles as read and as it will be written; the idea document is measured (the close's size alert).
// A replay (the idea already carries this session's exit) answers what it did and writes nothing.

import { isIdeaBook } from '../mandateBookKind.js';
import { roundUsd } from '../mandateRounding.js';
import { IDEA_STATUS } from './constants.js';
import { assertReconciled } from './reconcile.js';
import { ENDPOINT_KIND, pendingSaleOf } from './settlement.js';
import { settleIdeaAtEndpoint, readIdeaEvidenceRows, ideaDocSizeAlert } from './close.js';
import { buildResultEvidence, evidenceRefOf, EVIDENCE_PACKET, firestoreDocumentBytes } from './evidence.js';
import { nextSessionDate } from './windows.js';
import { deskOfIdea, MANAGER_EXIT_REASON } from './agentConfig.js';

/** What came of an exit request. `exit_settled`: the endpoint is written and the settlement sale is queued. */
export const EXIT_OUTCOME = Object.freeze({
  SETTLED: 'exit_settled',
  IGNORED_SELLING: 'ignored_already_selling',
  IGNORED_SETTLING: 'ignored_already_settling',
  IGNORED_NOT_ENTERED: 'ignored_not_entered',
});

const markOf = (m) => ({ mark: m.mark, quality: m.quality, markSource: m.markSource, vendorTimeIso: m.vendorTimeIso ?? null });

/**
 * One ledger's valuation at the close, rebuilt from the marks the close stored on the idea's row: every holding must have
 * its mark there. `markedHoldingsValue` is the close's own rounding (ledger.js valueLedger: Σ shares × mark, rounded once).
 * Pure.
 * @returns {object|null}  null when a holding has no stored mark
 */
export function valuationFromRowMarks(ledger, marks) {
  const holdings = ledger?.holdings || {};
  const out = {};
  let raw = 0;
  for (const [sym, h] of Object.entries(holdings)) {
    const m = marks?.[sym];
    if (!m || !Number.isFinite(m.mark)) return null;
    out[sym] = markOf(m);
    raw += (Number(h.shares) || 0) * m.mark;
  }
  return { marks: out, markedHoldingsValue: roundUsd(raw) };
}

/**
 * Settle an idea early at the close the manager judged (see the header).
 *
 * @param {object} args
 * @param {string} args.ideaId
 * @param {string} args.session        the session whose close the agent judged (the book's last close)
 * @param {'shadow'|'archetype'} args.desk  the desk asking: it may exit only its own ideas
 * @param {string} args.reason         the agent's one-line reason (validated, ≤ 280 code points)
 * @param {string} args.nowIso         server time: the decision instant — the settlement sale fills at the first window after it
 * @returns {Promise<{ ok: true, outcome: string, idempotentReplay?: boolean, endpointValueUsd?: number }
 *                   | { ok: false, code: string }>}
 */
export async function exitIdeaByManager(db, bookRef, { ideaId, session, desk, reason, nowIso }) {
  const ideaRef = bookRef.collection('ideas').doc(ideaId);
  return db.runTransaction(async (tx) => {
    const bookSnap = await tx.get(bookRef);
    if (!bookSnap.exists || !isIdeaBook(bookSnap.data())) return { ok: false, code: 'book_not_found' };
    const book = bookSnap.data();
    if (book.status !== 'active') return { ok: false, code: 'book_not_active' };
    const ideaSnap = await tx.get(ideaRef);
    if (!ideaSnap.exists) return { ok: false, code: 'idea_not_found' };
    const idea = ideaSnap.data();
    if (deskOfIdea(idea) !== desk) return { ok: false, code: 'not_this_desks_idea' };
    // A replay of this session's exit: what it did, nothing written.
    if (idea.managerExit?.session === session) return { ok: true, outcome: EXIT_OUTCOME.SETTLED, idempotentReplay: true };
    if (book.execState?.lastCloseKey !== session) return { ok: false, code: 'session_moved_on' };
    const lastTick = typeof book.execState?.lastIdeaTickKey === 'string' ? book.execState.lastIdeaTickKey.slice(0, 10) : null;
    if (lastTick !== null && lastTick > session) return { ok: false, code: 'session_moved_on' };
    // §4: an idea already selling — at a line, or settling — or not yet entered ignores the exit.
    if (idea.result != null || idea.status === IDEA_STATUS.SETTLED || idea.status === IDEA_STATUS.RESULTED) return { ok: true, outcome: EXIT_OUTCOME.IGNORED_SETTLING };
    if (idea.status === IDEA_STATUS.ACCEPTED || idea.status === IDEA_STATUS.ENTERING) return { ok: true, outcome: EXIT_OUTCOME.IGNORED_NOT_ENTERED };
    const holdings = Object.values(idea.ledger?.holdings || {});
    if (idea.status === IDEA_STATUS.LINE_HIT_EXIT_PENDING || holdings.some((h) => pendingSaleOf(h) != null)) return { ok: true, outcome: EXIT_OUTCOME.IGNORED_SELLING };
    if (idea.status !== IDEA_STATUS.HOLDING || holdings.length === 0) return { ok: false, code: 'idea_not_holding' };
    if (!(session < idea.contract.schedule.dueSession)) return { ok: true, outcome: EXIT_OUTCOME.IGNORED_SETTLING };
    // The close's own row for the session: observed, on time, every holding marked.
    const rowSnap = await tx.get(ideaRef.collection('rows').doc(session));
    const row = rowSnap.exists ? rowSnap.data() : null;
    if (!row || row.rowKind !== 'valuation' || row.date !== session || row.observed !== true || row.caughtUpAt != null) return { ok: false, code: 'close_row_unusable' };
    const valuations = {
      idea: valuationFromRowMarks(idea.ledger, row.marks),
      comparison: valuationFromRowMarks(idea.comparisonLedger, row.comparisonMarks),
      spy: valuationFromRowMarks(idea.spyLedger, row.spyMarks),
    };
    if (!valuations.idea || !valuations.comparison || !valuations.spy) return { ok: false, code: 'close_row_unusable' };
    const endpointSnap = await tx.get(ideaRef.collection('rows').doc('endpoint'));
    if (endpointSnap.exists) return { ok: false, code: 'endpoint_exists' };
    const read = await readIdeaEvidenceRows(tx, bookRef, ideaId, { entered: idea.entry?.sessionDate ?? null, before: nextSessionDate(session) });
    const others = [];
    for (const id of book.openIdeaIds || []) {
      if (id === ideaId) continue;
      const snap = await tx.get(bookRef.collection('ideas').doc(id));
      if (snap.exists) others.push(snap.data());
    }
    // Reject, never repair (Astra T1A-02).
    assertReconciled(book, [...others, idea]);

    const settled = settleIdeaAtEndpoint(idea, {
      valuations, date: session, kind: ENDPOINT_KIND.MANAGER_EXIT, observed: true, caughtUp: false,
      snapshotMeta: { key: row.closeSnapshotKey ?? null, builtAt: row.closeSnapshotBuiltAt ?? null }, nowIso, reason: MANAGER_EXIT_REASON,
    });
    const exit = { session, desk, reason, decidedAt: nowIso };
    const nextIdea = { ...settled.nextIdea, result: { ...settled.nextIdea.result, managerExit: exit }, managerExit: exit };
    const { packet, parts } = buildResultEvidence({ bookId: bookRef.id, idea: nextIdea, endpointRow: settled.endpointRow, inception: read.inception, closeRows: read.rows, nowIso });
    assertReconciled(book, [...others, nextIdea]);
    const sizeAlert = ideaDocSizeAlert(bookRef.id, ideaId, firestoreDocumentBytes(`mandates/${bookRef.id}/ideas/${ideaId}`, nextIdea));
    if (sizeAlert !== null) console.error(`[PracticeFieldAgent] ${sizeAlert}`);

    tx.set(ideaRef, nextIdea);
    tx.create(ideaRef.collection('rows').doc('endpoint'), settled.endpointRow);
    tx.create(evidenceRefOf(ideaRef, EVIDENCE_PACKET.RESULT), packet);
    for (const part of parts) tx.create(evidenceRefOf(ideaRef, part.id), part.doc);
    return { ok: true, outcome: EXIT_OUTCOME.SETTLED, idempotentReplay: false, endpointValueUsd: settled.endpointRow.idea.valueUsd };
  });
}
