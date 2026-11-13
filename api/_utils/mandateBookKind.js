// api/_utils/mandateBookKind.js
//
// THE BOOK-KIND DISCRIMINANT (Practice Field T1a-1; shared contract V2 §3; Astra V6 C6-07, V5 B2). The Mandate
// engine's `mandates/{id}` collection now holds two product kinds:
//
//   quarterly  — the Spec 1 book. EVERY book written before this build has no `kind` field and is quarterly; so is
//                one that says `kind: 'quarterly'`. Its behaviour is unchanged.
//   idea_book  — the Practice Field's book (`kind: 'idea_book'`). No quarter, no rollover, no escape, no model
//                eval through the quarterly pipeline, no quarterly close.
//
// ISOLATION IS UNCONDITIONAL. Every quarterly path asks this module and steps over an idea book whatever
// PRACTICE_FIELD_MODE says: the flag decides whether the Practice Field's OWN passes run, never whether a quarterly
// path may touch an idea book. Zero imports, pure — safe on every engine path.

export const IDEA_BOOK_KIND = 'idea_book';
export const QUARTERLY_KIND = 'quarterly';

/** Is this book document an idea book? Anything else — including a legacy book with no `kind` — is quarterly. */
export function isIdeaBook(book) {
  return book !== null && typeof book === 'object' && book.kind === IDEA_BOOK_KIND;
}

/** The book's kind, by the rule above. */
export function bookKindOf(book) {
  return isIdeaBook(book) ? IDEA_BOOK_KIND : QUARTERLY_KIND;
}

/** The typed reason a quarterly path gives for stepping over an idea book. */
export const NOT_QUARTERLY = 'not_quarterly';

/**
 * Split an active-book query's documents by kind for the shared snapshot build.
 *
 * `ideaBooksLive` is whether the Practice Field's own passes run this fire (its mode is not 'off'). With it false
 * an idea book is INVISIBLE to the acquisition decision: it contributes no held ticker and does not count as an
 * active book, because nothing would read the data. With no idea book present the result's `visibleDocs` is the
 * input, in order, so a quarterly-only fire is exactly today's.
 *
 * @param {Array<{ data: () => object }>} docs
 * @returns {{ visibleDocs: Array, quarterlyCount: number, ideaCount: number, hiddenIdeaCount: number }}
 */
export function splitActiveBooks(docs, { ideaBooksLive = false } = {}) {
  const visibleDocs = [];
  let quarterlyCount = 0;
  let ideaCount = 0;
  let hiddenIdeaCount = 0;
  for (const d of docs || []) {
    if (isIdeaBook(d.data())) {
      if (ideaBooksLive) { ideaCount += 1; visibleDocs.push(d); } else hiddenIdeaCount += 1;
    } else {
      quarterlyCount += 1;
      visibleDocs.push(d);
    }
  }
  return { visibleDocs, quarterlyCount, ideaCount, hiddenIdeaCount };
}
