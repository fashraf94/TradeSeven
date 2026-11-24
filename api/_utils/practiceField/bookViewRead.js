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
// THE READS, every one bounded (at most 1 + 1 + I + 1 + 2·I + 1 + 1 + 1 + 20·(1 + P) + 1 + 1 documents, I the book's open and
// slotted ideas — at most six — and P a packet's receipt parts):
//   1. the claim, then the book;
//   2. the ideas its slots and open set name, each once;
//   3. the book's two latest rows (`dailyRows`, ordered by `date`, two);
//   4. each filled idea's row at the last close and at the close before it (two documents by id);
//   5. the last close's window row (`windows/{session}_close`: the agent's notes, calls and drafts);
//   6. History: the book's finished ideas, newest first, at most 20 — ONE single field, `liquidation.completedSession`,
//      a range (`> ''`) and an order on it alone (every resulted idea carries it; an idea without it — open, cancelled — is
//      not in the range), served by the automatic single-field index, so no index is added — and each one's result packet and its
//      receipt parts, checked before anything of the result is shown (B2 §8);
//   7. the book's first entered idea (`entry.sessionDate` > '', ordered on that field alone, limit 1) and its row at that session:
//      SPY's close there, for "SPY since open" (B3-6).

import { isIdeaBook } from '../mandateBookKind.js';
import { getArchetypeDefinition } from '../archetypeRegistry.js';
import { evidenceRefOf, EVIDENCE_PACKET } from './evidence.js';
import { buildBookView, HISTORY_LIMIT } from './bookView.js';

/** The statuses of a book the screen shows (bookStore.js: the close serves both). */
const OPEN_BOOK_STATUSES = Object.freeze(['active', 'draining']);
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

/** A finished idea's result packet and its receipt parts (by the ids the packet records). */
async function packetOf(ideaRef) {
  const packet = dataOf(await evidenceRefOf(ideaRef, EVIDENCE_PACKET.RESULT).get());
  const parts = {};
  const recorded = Array.isArray(packet?.corporateActions?.parts) ? packet.corporateActions.parts : [];
  for (const p of recorded) {
    if (typeof p?.id !== 'string' || p.id.length === 0) continue;
    parts[p.id] = dataOf(await evidenceRefOf(ideaRef, p.id).get());
  }
  return { packet, parts };
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

  // 2. The ideas the slots and the open set name.
  const ids = [...new Set([...(book.openIdeaIds || []), ...Object.values(book.slots || {})].filter((v) => typeof v === 'string' && v.length > 0))];
  const ideas = [];
  for (const id of ids) {
    const idea = dataOf(await ideasRef.doc(id).get());
    if (idea) ideas.push({ ...idea, ideaId: id });
  }

  // 3. The book's two latest rows.
  const dailySnap = await bookRef.collection('dailyRows').orderBy('date', 'desc').limit(2).get();
  const daily = dailySnap.docs.map((d) => d.data()).filter((r) => isPlain(r) && isDate(r.date));
  const dailyRows = { last: daily[0] ?? null, prev: daily[1] ?? null };
  const session = isDate(book.execState?.lastCloseKey) ? book.execState.lastCloseKey : (dailyRows.last?.date ?? null);
  const prevSession = dailyRows.prev?.date ?? null;

  // 4. Each filled idea's row at the last close and at the close before it.
  const rows = new Map();
  for (const idea of ideas) {
    if (!idea.entry?.sessionDate || session === null) continue;
    const rowsRef = ideasRef.doc(idea.ideaId).collection('rows');
    const last = dataOf(await rowsRef.doc(session).get());
    const prev = prevSession !== null && prevSession >= idea.entry.sessionDate ? dataOf(await rowsRef.doc(prevSession).get()) : null;
    rows.set(idea.ideaId, { last, prev });
  }

  // 5. The last close's window row.
  const closeRow = session !== null ? dataOf(await bookRef.collection('windows').doc(`${session}_close`).get()) : null;

  // 6. History.
  const finishedSnap = await ideasRef.where('liquidation.completedSession', '>', '').orderBy('liquidation.completedSession', 'desc').limit(HISTORY_LIMIT).get();
  const finished = [];
  for (const d of finishedSnap.docs) {
    const idea = { ...d.data(), ideaId: d.id };
    if (idea.status !== 'resulted' || !isDate(idea.liquidation?.completedSession)) continue;
    finished.push({ idea, ...(await packetOf(ideasRef.doc(d.id))) });
  }

  // 7. The book's first entered idea and its row at that session.
  let firstEntry = null;
  const firstSnap = await ideasRef.where('entry.sessionDate', '>', '').orderBy('entry.sessionDate', 'asc').limit(1).get();
  const firstDoc = firstSnap.docs[0] ?? null;
  const firstSession = firstDoc?.data()?.entry?.sessionDate ?? null;
  if (firstDoc && isDate(firstSession)) {
    firstEntry = { session: firstSession, row: dataOf(await ideasRef.doc(firstDoc.id).collection('rows').doc(firstSession).get()) };
  }

  let archetypeName = null;
  try { archetypeName = getArchetypeDefinition(book.archetypeCodeId)?.displayName ?? null; } catch { archetypeName = null; }

  return { book: buildBookView({ book, ideas, rows, dailyRows, closeRow, finished, firstEntry, agentOn, archetypeName }) };
}
