// api/_utils/practiceField/bookStore.js
//
// Practice Field T1a-1 — THE FILM ROOM'S TWO BOOK HELPERS (Amendment A R1; Amendment B item 1; the Film Room's C1
// reply §1). Imported into api/_utils/filmRoom/practiceFieldSeam.js, where they replace the seam's defaults.
//
// IMPORT-LIGHT ON PURPOSE: the Film Room's card and counter routes load this module on every cold start, so it
// imports the mode gate and the zero-import book-kind test (mandateBookKind.js) and nothing else — no other engine
// module, no Film Room module (cardStore.js imports the seam; importing it back would be a cycle).
//
//   bookForOwner(db, { uid, attributionAgentId })  → { bookId, status } | null
//       AT MOST TWO READS, no side effects. First the owner's one-open-book claim, `practiceFieldBooks/{uid}`; then
//       (Astra T1A-04) THE BOOK IT NAMES, `mandates/{bookId}`. The claim is a pointer, never proof: the answer is
//       given only when that book exists, is an idea book (`kind: 'idea_book'`), belongs to this owner (`userId`), is
//       this attribution agent's (`attributionAgentId`, bookIsForAgent) and is still open (`active` or `draining`);
//       the `status` answered is the BOOK's own, never the claim's copy. So a stale or inconsistent claim — one that
//       names a quarterly book, another owner's book, a missing book or a closed one — answers null. Null too when
//       the mode does not admit the owner (WITHOUT A READ — at 'off' the Film Room behaves exactly as before this
//       build), when no claim is open, or when the claim is another agent's (one read). A failed read THROWS; the
//       Film Room treats a throw as "no open book".
//       The answer is still advisory: the Film Room re-reads `mandates/{bookId}` inside its own transaction and
//       requires `userId`, `kind: 'idea_book'`, `status: 'active'` and bookIsForAgent there, so a `draining` answer
//       is `book_not_open`. Every later writer of a book's status (T1a-2's drain and close) should still move the
//       claim's `status` in the same transaction; this helper no longer depends on it.
//
//   bookIsForAgent(bookDoc, attributionAgentId)  → boolean
//       Pure: true only when the book's `attributionAgentId` — written once, at creation — is that agent.

import { practiceFieldAdmits } from './mode.js';
import { isIdeaBook } from '../mandateBookKind.js';

/** The statuses of an idea book that is still open: the close serves both; only `active` takes a nomination. */
const OPEN_BOOK_STATUSES = Object.freeze(['active', 'draining']);

/** The owner's open idea book for that attribution agent, or null. */
export async function bookForOwner(db, { uid, attributionAgentId } = {}) {
  if (!practiceFieldAdmits(uid)) return null;
  if (typeof attributionAgentId !== 'string' || attributionAgentId.length === 0) return null;
  const snap = await db.collection('practiceFieldBooks').doc(uid).get();
  if (!snap.exists) return null;
  const claim = snap.data() || {};
  if (typeof claim.bookId !== 'string' || claim.bookId.length === 0) return null;
  if (claim.attributionAgentId !== attributionAgentId) return null;
  // Astra T1A-04: the book the claim names, read and checked — never the claim's word for it.
  const bookSnap = await db.collection('mandates').doc(claim.bookId).get();
  if (!bookSnap.exists) return null;
  const book = bookSnap.data();
  if (!isIdeaBook(book)) return null;
  if (book.userId !== uid) return null;
  if (!bookIsForAgent(book, attributionAgentId)) return null;
  if (!OPEN_BOOK_STATUSES.includes(book.status)) return null;
  return { bookId: claim.bookId, status: book.status };
}

/** Is this book document the attribution agent's? Pure; false for another agent, a missing field, a non-object. */
export function bookIsForAgent(bookDoc, attributionAgentId) {
  return bookDoc !== null
    && typeof bookDoc === 'object'
    && typeof bookDoc.attributionAgentId === 'string'
    && bookDoc.attributionAgentId.length > 0
    && bookDoc.attributionAgentId === attributionAgentId;
}
