// api/_utils/compositionCandidateApply.js
//
// Composition PR 4 — the CANDIDATE-NAMESPACE APPLY WRITER, extracted from
// scripts/composition/migration-scan.js so the namespace belt is UNIT-PROVEN
// (Sol re-review #8): the mutation row drives this writer with a redirecting
// store and asserts the run aborts BEFORE any Firestore write lands outside
// `compositionCandidateState/*`.
//
// Write discipline (design note §2 / review P6): overlay ENTRIES first (M12
// injective base64url ids), the RUN DOC last — the run doc is the completion
// sentinel, so an interrupted apply leaves entries without a run doc, never
// a run doc overstating them. Every ref is path-asserted before its write
// (the #5/#8 belt): live/base/protected stores are structurally out of the
// write set AND belt-checked at runtime — a future edit that widens the
// write set fails LOUD here, not in review.

import { entryDocId } from './compositionStateResolver.js';

export const CANDIDATE_APPLY_COLLECTION = 'compositionCandidateState';
const BATCH_SIZE = 400;

/** The #8 belt: an apply ref outside the candidate namespace aborts the run. */
export function assertCandidatePath(ref) {
  if (!String(ref?.path).startsWith(`${CANDIDATE_APPLY_COLLECTION}/`)) {
    throw new Error(`apply write outside the candidate namespace: ${ref?.path} (the --during-close belt — nothing but ${CANDIDATE_APPLY_COLLECTION}/* is ever in the write set)`);
  }
}

/**
 * Write the candidate overlay: entries first (batched), run doc last.
 * Callers hold the epoch authorization (assertWriteEpochOpen or the
 * --during-close closed-window claim) — this writer only writes.
 *
 * @returns {Promise<{entryCount: number}>}
 */
export async function applyCandidateEntries(db, { runId, entries, runDoc }) {
  const runRef = db.collection(CANDIDATE_APPLY_COLLECTION).doc(runId);
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const e of entries.slice(i, i + BATCH_SIZE)) {
      const entryRef = runRef.collection('entries').doc(entryDocId(e.entryKey));
      assertCandidatePath(entryRef); // BEFORE the write is even staged
      batch.set(entryRef, e); // M12: injective base64url id
    }
    await batch.commit();
  }
  assertCandidatePath(runRef);
  await runRef.set(runDoc);
  return { entryCount: entries.length };
}
