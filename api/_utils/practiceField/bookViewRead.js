// api/_utils/practiceField/bookViewRead.js
//
// Practice Field build B3 — THE SCREEN'S READS (ruling B3-1; B3 §2 "Reads only. Bound the reads"). The caller's own book,
// read through the Admin SDK, and nothing else: no write, no listener, no fetch, no model call. The uid is the verified
// token's (api/practice-field/book.js); nothing a request carries names a document here.
//
// THE OWNER'S BOOK, THROUGH ITS CLAIM AND CHECKED (the bookForOwner / ownBookOf pattern; Astra T1A-04): the claim
// `practiceFieldBooks/{uid}` names a book; the answer is that book only when it exists, is an idea book, is THIS uid's
// (`userId`) and is still open (`active` or `draining`). A stale, foreign or closed claim answers `{ book: null }`.
//
// ONE CONSISTENT BOOK (build B5, ruling B5-4; Astra's B3-C01 and the refuter's R5). An answer never mixes the book as one
// close left it with an idea, a row or a finished idea as another close left it. HOW A CLOSE COMMITS (close.js
// closeNextSession, its one transaction per session): the book's ideas, their rows of the session, their endpoint rows
// and result packets, the book's `dailyRows/{session}`, the close's window row and the book document itself — whose patch
// moves `execState.lastCloseKey` to the session and adds one to `revision` — all commit together. Every other write that
// moves money adds one to `revision` too, in the transaction that moves it (admission.js, entry.js's fill, exits.js's
// sales — the sale that finishes an idea and puts it in History among them). So the book's own CHANGE MARKS —
// `revision`, `execState.lastCloseKey` and `currentEpochId` — differ before and after any close or money move. A PASS reads
// the book first (with its claim), then everything else, and the book AGAIN last; when the two reads' marks agree, no close
// and no money move landed in between, and every read in between saw one book. THE AGENT'S PASS after a close (agentRun.js)
// moves none of the book's marks — no money moves — but writes the desks' calls on the close's window row, after any
// manager's exit it makes on an idea (managerExit.js); so that row is read FIRST too, before the ideas, and again last, and
// the pass settles only when it is unchanged (review A1: an exit read beside a call from before it, or the reverse, would
// show neither state). When either differs, the whole pass is read again, once. A second pass that disagrees too answers
// `{ tryAgain: true }`: the endpoint says "try again" (503), and the client shows its error state. (The other writes that
// do NOT move `revision` — a founder's ruling recorded on an idea (founderControls.js: posted only by the next close, which
// does move it; until then it can only add a hold), the pause and wind-down controls (no figure), an entry attempt's note
// (entry.js), a window's tick key (sweep.js) — change no figure the read pairs: build report §5.) A read-only transaction
// would give the same at one snapshot; the in-memory harness's transactions take references, not queries (build report §5).
//
// THE READS, every one bounded. One pass reads at most
//     2 + 1 + I + 3 + 1 + 1 + 2·I + 20·(1 + 1 + P) + 3 + 1 + 1 + 1 + 1  =  55 + 3·I + 20·P
// documents, by step: the claim and the book (2), the close row (1), the ideas (I), the daily rows (3), the epoch (1), the
// agent (1), the ideas' rows (2·I), History (20 ideas, 20 packets, 20·P parts), the rows of ideas finished since the close
// (3), the first fill and its inception (1 + 1), the book and the close row again (1 + 1). I counts the UNIQUE ideas the
// book's open set and slots name (at most six; an idea in both is read once), P a packet's receipt parts (at most
// RESULT_PARTS_READ_MAX; the engine's own bound makes three). Queries: 3. Two passes at most: 110 + 6·I + 40·P documents,
// 6 queries. (B3's one pass was 48 + 3·I + 20·P; B5 adds the epoch, the agent, the three rows and the second reads of the book
// and the close row.) Reads that depend on nothing else run in parallel:
//   1. the claim, then the book (its change marks, first), then the last close's window row (`windows/{session}_close`: the
//      agent's notes, calls and drafts — first too);
//   2. the ideas its slots and open set name, each once; and (B5) the epoch it runs under (`epochs/{currentEpochId}`: the
//      archetype and the shares, B5-1 and B5-2) and its attribution agent (`agents/{attributionAgentId}`: the given name,
//      B5-3 — used only when the agent's `ownerId` is the caller's uid);
//   3. the book's three latest rows (`dailyRows`, ordered by `date`, three): the book's own row and the latest row strictly
//      before it (here and in the view), never the session's own as its "previous" (review B3-A04);
//   4. each filled idea's row at the last close and at the close before it (two documents by id);
//   5. (the close row was read at step 1);
//   6. History: the book's finished ideas, newest first, at most 20 — ONE single field, `liquidation.completedSession`,
//      a range (`> ''`) and an order on it alone (every resulted idea carries it; an idea without it — open, cancelled — is
//      not in the range), served by the automatic single-field index, so no index is added — and each one's result packet,
//      then (only when the packet's own hash holds) its receipt parts; the view checks both, and that they are THIS idea's,
//      before anything of the result is shown (B2 §8). And (B5-2) for an idea finished SINCE the last close — it held its
//      positions there; at most one per slot, so three — its row of that close, for the split's use;
//   7. the book's FIRST FILL (review B3-A03): the idea with the earliest stored `entry.filledAt` (`> ''`, ordered on that
//      field alone, limit 1 — the automatic single-field index, so no index is added) and its inception row
//      (`rows/inception`): SPY's quote at the book's first fill, for "SPY since open" (B3-6); that idea's entry session
//      names the label. `filledAt` is one writer's `Date#toISOString()` (entry.js), a fixed-width UTC string, so its
//      order is the order of the instants;
//   8. the book and the close row again (their marks, last).

import { isIdeaBook } from '../mandateBookKind.js';
import { getArchetypeDefinition } from '../archetypeRegistry.js';
import { evidenceRefOf, EVIDENCE_PACKET, verifyPacket } from './evidence.js';
import { buildBookView, HISTORY_LIMIT } from './bookView.js';
import { PRACTICE_FIELD_SLOT_NAMES } from '../../../src/data/practiceFieldSlots.js';

/** The statuses of a book the screen shows (bookStore.js: the close serves both). */
const OPEN_BOOK_STATUSES = Object.freeze(['active', 'draining']);
/** The most receipt parts read for one packet (evidence.js RESULT_RECEIPT_BOUND makes three); more reads as unchecked. */
export const RESULT_PARTS_READ_MAX = 8;
/** B5-4: the most passes one answer reads; after that many that disagree, the answer is "try again". */
export const BOOK_READ_PASSES = 2;
/** B5-2: the most ideas finished since the last close whose row there is read — one per slot (each held a slot there). */
const FINISHED_SINCE_CLOSE_MAX = PRACTICE_FIELD_SLOT_NAMES.length;
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const dataOf = (snap) => (snap && snap.exists ? snap.data() : null);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
/** A stored document id this reader may follow: a non-empty string with no path separator. */
const isDocId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 1500 && !v.includes('/');

/** The caller's open idea book, checked, or null. Two reads at most. */
export async function ownOpenBook(db, uid) {
  if (typeof uid !== 'string' || uid.length === 0) return null;
  const claim = dataOf(await db.collection('practiceFieldBooks').doc(uid).get());
  const bookId = claim?.bookId;
  if (typeof bookId !== 'string' || bookId.length === 0) return null;
  const book = dataOf(await db.collection('mandates').doc(bookId).get());
  if (!book || !isIdeaBook(book) || book.userId !== uid || !OPEN_BOOK_STATUSES.includes(book.status)) return null;
  return { bookId, book };
}

/**
 * B5-4: the book's own change marks — what a close (and every money move) changes on the book, in the transaction that
 * changes everything else (the header). Two reads of the book with the same marks saw no close and no money move between them.
 */
export function bookChangeMarks(book) {
  return JSON.stringify([book?.revision ?? null, book?.execState?.lastCloseKey ?? null, book?.currentEpochId ?? null]);
}

/**
 * Review A1: the close row's mark — the whole row as stored, written with every map's keys in sorted order, so two reads of
 * an unchanged row give the same mark whatever order a read returns its fields in (a plain JSON string would differ on
 * key order alone, and every pass would then disagree). The agent's pass after a close writes its desks' parts here
 * (agentRun.js), after any manager exit it makes on an idea (managerExit.js), neither moving the book's marks; a row read
 * before the ideas and again last that is unchanged saw no part written between, so no exit was paired with the wrong call.
 */
export function closeRowMark(row) {
  return JSON.stringify(canonical(row ?? null));
}
/** A value with every plain map's keys sorted (a value with its own `toJSON`, such as a stored timestamp, by that). */
function canonical(v) {
  if (v === null || typeof v !== 'object') return v;
  if (typeof v.toJSON === 'function') return canonical(v.toJSON());
  if (Array.isArray(v)) return v.map(canonical);
  return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
}

/**
 * A finished idea's result packet and its receipt parts (by the ids the packet records) — the parts only when the packet's
 * own hash holds and it records no more than RESULT_PARTS_READ_MAX (otherwise none are read, and the view's check fails).
 */
async function packetOf(ideaRef) {
  const packet = dataOf(await evidenceRefOf(ideaRef, EVIDENCE_PACKET.RESULT).get());
  const recorded = Array.isArray(packet?.corporateActions?.parts) ? packet.corporateActions.parts : [];
  if (!verifyPacket(packet) || recorded.length > RESULT_PARTS_READ_MAX) return { packet, parts: {} };
  const ids = recorded.map((p) => p?.id).filter((id) => typeof id === 'string' && id.length > 0);
  const docs = await Promise.all(ids.map((id) => evidenceRefOf(ideaRef, id).get()));
  return { packet, parts: Object.fromEntries(ids.map((id, i) => [id, dataOf(docs[i])])) };
}

/** B5-1: the archetype the book runs under — its epoch's code id, named by the registry (null name when it is unknown). */
function archetypeOf(epoch) {
  const codeId = epoch?.archetypeCodeId;
  if (typeof codeId !== 'string' || codeId.length === 0) return null;
  let name = null;
  try { name = getArchetypeDefinition(codeId)?.displayName ?? null; } catch { name = null; }
  return { codeId, name: typeof name === 'string' && name.length > 0 ? name : null };
}

/**
 * ONE PASS (the header's steps 1 to 8). `{ book: null }` when the caller has no open idea book; `{ settled: false }` when the
 * book's change marks moved during the pass; otherwise the view's input, every part of it read between the book's two reads.
 */
async function readPass(db, uid) {
  // 1. The claim, then the book: its change marks, first.
  const own = await ownOpenBook(db, uid);
  if (!own) return { settled: true, input: null };
  const { bookId, book } = own;
  const bookRef = db.collection('mandates').doc(bookId);
  const ideasRef = bookRef.collection('ideas');
  // 1b. The last close's window row, first too (review A1): the agent's pass after a close writes its calls here and its
  // exits on the ideas without moving the book's marks, so this row is read before the ideas and again last.
  const closeKey = isDate(book.execState?.lastCloseKey) ? book.execState.lastCloseKey : null;
  const closeRef = closeKey !== null ? bookRef.collection('windows').doc(`${closeKey}_close`) : null;
  const closeFirst = closeRef !== null ? dataOf(await closeRef.get()) : null;

  // 2. The ideas, the epoch and the agent; 3. the three latest daily rows.
  const ids = [...new Set([...(book.openIdeaIds || []), ...Object.values(book.slots || {})].filter((v) => typeof v === 'string' && v.length > 0))];
  const [ideaSnaps, dailySnap, epochSnap, agentSnap] = await Promise.all([
    Promise.all(ids.map((id) => ideasRef.doc(id).get())),
    bookRef.collection('dailyRows').orderBy('date', 'desc').limit(3).get(),
    isDocId(book.currentEpochId) ? bookRef.collection('epochs').doc(book.currentEpochId).get() : null,
    isDocId(book.attributionAgentId) ? db.collection('agents').doc(book.attributionAgentId).get() : null,
  ]);
  const ideas = ids.map((id, i) => {
    const data = dataOf(ideaSnaps[i]);
    return data ? { ...data, ideaId: id } : null;
  }).filter(Boolean);
  const daily = dailySnap.docs.map((d) => d.data()).filter((r) => isPlain(r) && isDate(r.date));
  const epoch = dataOf(epochSnap);
  // B5-3: the agent's name only when the agent is the caller's own (nothing else of it is read into the view).
  const agent = dataOf(agentSnap);
  const agentName = isPlain(agent) && agent.ownerId === uid ? (agent.name ?? null) : null;

  const session = closeKey ?? (daily[0]?.date ?? null);
  // The book's row at its session, and the latest row strictly before it (never the session's own: B3-A04).
  const dailyRows = {
    last: daily.find((r) => r.date === session) ?? null,
    prev: session === null ? null : (daily.find((r) => r.date < session) ?? null),
  };
  const prevSession = dailyRows.prev?.date ?? null;

  // 4. Each filled idea's rows; 6. History; 7. the first entered idea — all at once (the close row: step 1).
  const rows = new Map();
  const rowsRead = Promise.all(ideas.filter((idea) => idea.entry?.sessionDate && session !== null).map(async (idea) => {
    const rowsRef = ideasRef.doc(idea.ideaId).collection('rows');
    const [lastSnap, prevSnap] = await Promise.all([
      rowsRef.doc(session).get(),
      prevSession !== null && prevSession >= idea.entry.sessionDate ? rowsRef.doc(prevSession).get() : null,
    ]);
    rows.set(idea.ideaId, { last: dataOf(lastSnap), prev: dataOf(prevSnap) });
  }));
  // (A book with no close key but a daily row — never written by the engine, which sets both in one transaction — reads its
  // close row here, as B3 did.)
  const closeRead = closeRef !== null ? Promise.resolve(closeFirst)
    : session !== null ? bookRef.collection('windows').doc(`${session}_close`).get().then(dataOf) : Promise.resolve(null);
  const historyRead = ideasRef.where('liquidation.completedSession', '>', '').orderBy('liquidation.completedSession', 'desc').limit(HISTORY_LIMIT).get()
    .then((snap) => {
      const done = snap.docs.map((d) => ({ ...d.data(), ideaId: d.id })).filter((idea) => idea.status === 'resulted' && isDate(idea.liquidation?.completedSession));
      // B5-2: an idea finished SINCE the last close held its positions there — its row of that close, for the split.
      const since = new Set(session === null ? [] : done
        .filter((idea) => idea.liquidation.completedSession > session && isDate(idea.entry?.sessionDate) && idea.entry.sessionDate <= session)
        .slice(0, FINISHED_SINCE_CLOSE_MAX).map((idea) => idea.ideaId));
      return Promise.all(done.map(async (idea) => {
        const ideaRef = ideasRef.doc(idea.ideaId);
        const [evidence, atClose] = await Promise.all([packetOf(ideaRef), since.has(idea.ideaId) ? ideaRef.collection('rows').doc(session).get().then(dataOf) : null]);
        return { idea, ...evidence, ...(since.has(idea.ideaId) ? { atClose } : {}) };
      }));
    });
  const firstRead = ideasRef.where('entry.filledAt', '>', '').orderBy('entry.filledAt', 'asc').limit(1).get()
    .then(async (snap) => {
      const firstDoc = snap.docs[0] ?? null;
      const firstSession = firstDoc?.data()?.entry?.sessionDate ?? null;
      if (!firstDoc || !isDate(firstSession)) return null;
      return { session: firstSession, inception: dataOf(await ideasRef.doc(firstDoc.id).collection('rows').doc('inception').get()) };
    });
  const [, closeRow, finished, firstEntry] = await Promise.all([rowsRead, closeRead, historyRead, firstRead]);

  // 8. The book again, and the close row again: their marks, last. Any close or money move since step 1 moved the book's; the
  // agent's pass at that close (its calls, its manager exits) moves the close row.
  const [againSnap, closeAgainSnap] = await Promise.all([bookRef.get(), closeRef !== null ? closeRef.get() : null]);
  if (bookChangeMarks(dataOf(againSnap)) !== bookChangeMarks(book)) return { settled: false };
  if (closeRef !== null && closeRowMark(dataOf(closeAgainSnap)) !== closeRowMark(closeFirst)) return { settled: false };

  return {
    settled: true,
    input: { book: { ...book, bookId }, ideas, rows, dailyRows, closeRow, finished, firstEntry, archetype: archetypeOf(epoch), epoch, agentName },
  };
}

/**
 * Everything the view needs, from ONE consistent read (the header): at most BOOK_READ_PASSES passes.
 * Returns `{ book: null }` when the caller has no open idea book; `{ book: <the view> }`; or `{ tryAgain: true }` when every
 * pass saw the book change under it.
 */
export async function readBookView(db, { uid, agentOn = false }) {
  for (let pass = 1; pass <= BOOK_READ_PASSES; pass += 1) {
    const read = await readPass(db, uid);
    if (!read.settled) continue;
    if (read.input === null) return { book: null };
    return { book: buildBookView({ ...read.input, agentOn }) };
  }
  return { tryAgain: true };
}
