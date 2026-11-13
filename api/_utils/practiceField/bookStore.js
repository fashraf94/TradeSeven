// api/_utils/practiceField/bookStore.js
//
// Practice Field T1a-1 — THE FILM ROOM'S TWO BOOK HELPERS (Amendment A R1; Amendment B item 1; the Film Room's C1
// reply §1). Imported into api/_utils/filmRoom/practiceFieldSeam.js, where they replace the seam's defaults.
//
// IMPORT-LIGHT ON PURPOSE: the Film Room's card and counter routes load this module on every cold start, so it
// imports the mode gate and nothing else — no engine module, no Film Room module (cardStore.js imports the seam;
// importing it back would be a cycle).
//
//   bookForOwner(db, { uid, attributionAgentId })  → { bookId, status } | null
//       ONE read, no side effects: the owner's one-open-book claim, `practiceFieldBooks/{uid}`. The claim is
//       written only by the idea book's own creation (ideaBook.js), in the transaction that writes the book, and it
//       carries the book's id, its status and its attribution agent — so the answer is an IDEA BOOK by
//       construction and never a quarterly book (the quarterly product's claim is userMeta.activeMandateId, which
//       nothing here reads). Null when the mode does not admit the owner (WITHOUT A READ — at 'off' the Film Room
//       behaves exactly as before this build), when no claim is open, or when the open book is another agent's.
//       A failed read THROWS; the Film Room treats a throw as "no open book".
//       The answer is advisory: the Film Room re-reads `mandates/{bookId}` inside its own transaction and requires
//       `userId`, `kind: 'idea_book'`, `status: 'active'` and bookIsForAgent there. Every later writer of a book's
//       status (T1a-2's drain and close) must move the claim's `status` in the same transaction.
//
//   bookIsForAgent(bookDoc, attributionAgentId)  → boolean
//       Pure: true only when the book's `attributionAgentId` — written once, at creation — is that agent.

import { practiceFieldAdmits } from './mode.js';

/** The owner's open idea book for that attribution agent, or null. */
export async function bookForOwner(db, { uid, attributionAgentId } = {}) {
  if (!practiceFieldAdmits(uid)) return null;
  if (typeof attributionAgentId !== 'string' || attributionAgentId.length === 0) return null;
  const snap = await db.collection('practiceFieldBooks').doc(uid).get();
  if (!snap.exists) return null;
  const claim = snap.data() || {};
  if (typeof claim.bookId !== 'string' || claim.bookId.length === 0) return null;
  if (claim.attributionAgentId !== attributionAgentId) return null;
  return { bookId: claim.bookId, status: typeof claim.status === 'string' ? claim.status : null };
}

/** Is this book document the attribution agent's? Pure; false for another agent, a missing field, a non-object. */
export function bookIsForAgent(bookDoc, attributionAgentId) {
  return bookDoc !== null
    && typeof bookDoc === 'object'
    && typeof bookDoc.attributionAgentId === 'string'
    && bookDoc.attributionAgentId.length > 0
    && bookDoc.attributionAgentId === attributionAgentId;
}
