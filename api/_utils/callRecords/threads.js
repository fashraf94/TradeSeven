// api/_utils/callRecords/threads.js
//
// Cockpit Build 1a — THREAD HELPERS shared by publication (the `declared`
// event's prompt-inclusion fact, spec §11), the flips (the answer-expired
// line, spec §6) and the heard writer (spec §7). Pure, zero imports — so
// publish.js and flip.js can read a thread's record without importing the
// heard writer (which imports them).

const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** An UNSUPPRESSED heard stamp's thread (prompt inclusion, nothing more), or null. */
export function heardThreadOf(heard) {
  return isPlainObject(heard) && nonEmpty(heard.directiveThreadId) && heard.suppressed === null ? heard.directiveThreadId : null;
}

/**
 * The directive record filed under a thread: the parent's slot when it is
 * that thread, else the thread exchange's own record (durable after the slot
 * is replaced). Null when the thread is unknown here.
 */
export function directiveRecordOf(parent, directiveThreadId) {
  if (!nonEmpty(directiveThreadId)) return null;
  if (parent?.directive?.directiveThreadId === directiveThreadId) return parent.directive;
  const list = Array.isArray(parent?.chatExchanges) ? parent.chatExchanges : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const ex = list[i];
    if (ex?.directiveThreadId === directiveThreadId && isPlainObject(ex.directive)) return ex.directive;
  }
  return null;
}

/** The selected pick a thread filed (its record's own action), or null. */
export function selectedPickOf(parent, directiveThreadId) {
  const pick = directiveRecordOf(parent, directiveThreadId)?.action?.pickSymbol;
  return nonEmpty(pick) ? pick : null;
}
