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
// THE READS, every one bounded. One pass reads at most 2 + I + 3 + 2·I + 1 + 20·(1 + 1 + P) + 1 + 1 documents, that is
// 48 + 3·I + 20·P (review B3-A10: the sum was once stated one short; the fix round reads one more daily row, step 3); with
// the one re-read below (steps 1 to 3 again, at most 2 + I + 3 more), at most 53 + 4·I + 20·P in all. I counts the UNIQUE ideas the book's open set and slots name (at
// most six; an idea in both is read once), P a packet's receipt parts (at most RESULT_PARTS_READ_MAX; the engine's own
// bound makes three). Queries: 3, or 4 with the re-read. Reads that depend on nothing else run in parallel:
//   1. the claim, then the book;
//   2. the ideas its slots and open set name, each once;
//   3. the book's three latest rows (`dailyRows`, ordered by `date`, three). A CLOSE LANDING DURING THE READ (review B3-A04):
//      the close writes the book's `execState.lastCloseKey` and its `dailyRows/{session}` in ONE transaction (close.js),
//      so a book read before a close and its rows read after it disagree — the book names one session, the latest row
//      another. Then steps 1 to 3 are read ONCE more and the view is built from that second read only. Whatever it reads,
//      the row "before" is the latest row of a session strictly before the book's (here and in the view), never the
//      session's own. Three rows, not two, so that even when the second read disagrees too (a catch-up closes several
//      sessions in one call), the book's own row and the one strictly before it are both among them;
//   4. each filled idea's row at the last close and at the close before it (two documents by id);
//   5. the last close's window row (`windows/{session}_close`: the agent's notes, calls and drafts);
//   6. History: the book's finished ideas, newest first, at most 20 — ONE single field, `liquidation.completedSession`,
//      a range (`> ''`) and an order on it alone (every resulted idea carries it; an idea without it — open, cancelled — is
//      not in the range), served by the automatic single-field index, so no index is added — and each one's result packet,
//      then (only when the packet's own hash holds) its receipt parts; the view checks both, and that they are THIS idea's,
//      before anything of the result is shown (B2 §8);
//   7. the book's FIRST FILL (review B3-A03): the idea with the earliest stored `entry.filledAt` (`> ''`, ordered on that
//      field alone, limit 1 — the automatic single-field index, so no index is added) and its inception row
//      (`rows/inception`): SPY's quote at the book's first fill, for "SPY since open" (B3-6); that idea's entry session
//      names the label. `filledAt` is one writer's `Date#toISOString()` (entry.js), a fixed-width UTC string, so its
//      order is the order of the instants. (Ordering by the entry's session date took one idea of the first DAY, which
//      could be its second fill.)

import { isIdeaBook } from '../mandateBookKind.js';
import { getArchetypeDefinition } from '../archetypeRegistry.js';
import { evidenceRefOf, EVIDENCE_PACKET, verifyPacket } from './evidence.js';
import { buildBookView, HISTORY_LIMIT } from './bookView.js';

/** The statuses of a book the screen shows (bookStore.js: the close serves both). */
const OPEN_BOOK_STATUSES = Object.freeze(['active', 'draining']);
/** The most receipt parts read for one packet (evidence.js RESULT_RECEIPT_BOUND makes three); more reads as unchecked. */
export const RESULT_PARTS_READ_MAX = 8;
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const dataOf = (snap) => (snap && snap.exists ? snap.data() : null);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

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

/** Steps 1 to 3: the book, the ideas it names, and its three latest rows. Null when the caller has no open idea book. */
async function readBookAndRows(db, uid) {
  const own = await ownOpenBook(db, uid);
  if (!own) return null;
  const { bookId, book } = own;
  const bookRef = db.collection('mandates').doc(bookId);
  const ideasRef = bookRef.collection('ideas');
  const ids = [...new Set([...(book.openIdeaIds || []), ...Object.values(book.slots || {})].filter((v) => typeof v === 'string' && v.length > 0))];
  const [ideaSnaps, dailySnap] = await Promise.all([
    Promise.all(ids.map((id) => ideasRef.doc(id).get())),
    bookRef.collection('dailyRows').orderBy('date', 'desc').limit(3).get(),
  ]);
  const ideas = ids.map((id, i) => {
    const data = dataOf(ideaSnaps[i]);
    return data ? { ...data, ideaId: id } : null;
  }).filter(Boolean);
  const daily = dailySnap.docs.map((d) => d.data()).filter((r) => isPlain(r) && isDate(r.date));
  return { bookId, book, bookRef, ideasRef, ideas, daily };
}

/** Do the book and its latest row name the same session? (The close writes both in one transaction.) */
const agrees = (r) => (isDate(r.book.execState?.lastCloseKey) ? r.book.execState.lastCloseKey : null) === (r.daily[0]?.date ?? null);

/**
 * Everything the view needs, read once (or, when a close landed during the read, steps 1 to 3 twice: the header).
 * Returns `{ book: null }` when the caller has no open idea book; otherwise `{ book: <the view> }`.
 */
export async function readBookView(db, { uid, agentOn = false }) {
  let read = await readBookAndRows(db, uid);
  if (read && !agrees(read)) read = await readBookAndRows(db, uid);
  if (!read) return { book: null };
  const { bookId, book, bookRef, ideasRef, ideas, daily } = read;
  const session = isDate(book.execState?.lastCloseKey) ? book.execState.lastCloseKey : (daily[0]?.date ?? null);
  // The book's row at its session, and the latest row strictly before it (never the session's own: B3-A04).
  const dailyRows = {
    last: daily.find((r) => r.date === session) ?? null,
    prev: session === null ? null : (daily.find((r) => r.date < session) ?? null),
  };
  const prevSession = dailyRows.prev?.date ?? null;

  // 4. Each filled idea's rows; 5. the close row; 6. History; 7. the first entered idea — all at once.
  const rows = new Map();
  const rowsRead = Promise.all(ideas.filter((idea) => idea.entry?.sessionDate && session !== null).map(async (idea) => {
    const rowsRef = ideasRef.doc(idea.ideaId).collection('rows');
    const [lastSnap, prevSnap] = await Promise.all([
      rowsRef.doc(session).get(),
      prevSession !== null && prevSession >= idea.entry.sessionDate ? rowsRef.doc(prevSession).get() : null,
    ]);
    rows.set(idea.ideaId, { last: dataOf(lastSnap), prev: dataOf(prevSnap) });
  }));
  const closeRead = session !== null ? bookRef.collection('windows').doc(`${session}_close`).get().then(dataOf) : Promise.resolve(null);
  const historyRead = ideasRef.where('liquidation.completedSession', '>', '').orderBy('liquidation.completedSession', 'desc').limit(HISTORY_LIMIT).get()
    .then((snap) => {
      const done = snap.docs.map((d) => ({ ...d.data(), ideaId: d.id })).filter((idea) => idea.status === 'resulted' && isDate(idea.liquidation?.completedSession));
      return Promise.all(done.map(async (idea) => ({ idea, ...(await packetOf(ideasRef.doc(idea.ideaId))) })));
    });
  const firstRead = ideasRef.where('entry.filledAt', '>', '').orderBy('entry.filledAt', 'asc').limit(1).get()
    .then(async (snap) => {
      const firstDoc = snap.docs[0] ?? null;
      const firstSession = firstDoc?.data()?.entry?.sessionDate ?? null;
      if (!firstDoc || !isDate(firstSession)) return null;
      return { session: firstSession, inception: dataOf(await ideasRef.doc(firstDoc.id).collection('rows').doc('inception').get()) };
    });
  const [, closeRow, finished, firstEntry] = await Promise.all([rowsRead, closeRead, historyRead, firstRead]);

  let archetypeName = null;
  try { archetypeName = getArchetypeDefinition(book.archetypeCodeId)?.displayName ?? null; } catch { archetypeName = null; }

  return { book: buildBookView({ book: { ...book, bookId }, ideas, rows, dailyRows, closeRow, finished, firstEntry, agentOn, archetypeName }) };
}
