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
// THE READS, every one bounded — at most 2 + I + 2 + 2·I + 1 + 20·(1 + 1 + P) + 1 + 1 documents, that is 46 + 3·I + 20·P:
// I the book's open and slotted ideas (at most six), P a packet's receipt parts (at most RESULT_PARTS_READ_MAX; the engine's
// own bound makes three). Reads that depend on nothing else run in parallel:
//   1. the claim, then the book;
//   2. the ideas its slots and open set name, each once;
//   3. the book's two latest rows (`dailyRows`, ordered by `date`, two);
//   4. each filled idea's row at the last close and at the close before it (two documents by id);
//   5. the last close's window row (`windows/{session}_close`: the agent's notes, calls and drafts);
//   6. History: the book's finished ideas, newest first, at most 20 — ONE single field, `liquidation.completedSession`,
//      a range (`> ''`) and an order on it alone (every resulted idea carries it; an idea without it — open, cancelled — is
//      not in the range), served by the automatic single-field index, so no index is added — and each one's result packet,
//      then (only when the packet's own hash holds) its receipt parts; the view checks both, and that they are THIS idea's,
//      before anything of the result is shown (B2 §8);
//   7. the book's first entered idea (`entry.sessionDate` > '', ordered on that field alone, limit 1) and its inception row
//      (`rows/inception`): SPY's quote at the book's first fill, for "SPY since open" (B3-6).

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

/**
 * Everything the view needs, read once. Returns `{ book: null }` when the caller has no open idea book; otherwise
 * `{ book: <the view> }`.
 */
export async function readBookView(db, { uid, agentOn = false }) {
  const own = await ownOpenBook(db, uid);
  if (!own) return { book: null };
  const { bookId, book } = own;
  const bookRef = db.collection('mandates').doc(bookId);
  const ideasRef = bookRef.collection('ideas');

  // 2. The ideas the slots and the open set name; 3. the book's two latest rows.
  const ids = [...new Set([...(book.openIdeaIds || []), ...Object.values(book.slots || {})].filter((v) => typeof v === 'string' && v.length > 0))];
  const [ideaSnaps, dailySnap] = await Promise.all([
    Promise.all(ids.map((id) => ideasRef.doc(id).get())),
    bookRef.collection('dailyRows').orderBy('date', 'desc').limit(2).get(),
  ]);
  const ideas = ids.map((id, i) => {
    const data = dataOf(ideaSnaps[i]);
    return data ? { ...data, ideaId: id } : null;
  }).filter(Boolean);
  const daily = dailySnap.docs.map((d) => d.data()).filter((r) => isPlain(r) && isDate(r.date));
  const dailyRows = { last: daily[0] ?? null, prev: daily[1] ?? null };
  const session = isDate(book.execState?.lastCloseKey) ? book.execState.lastCloseKey : (dailyRows.last?.date ?? null);
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
  const firstRead = ideasRef.where('entry.sessionDate', '>', '').orderBy('entry.sessionDate', 'asc').limit(1).get()
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
