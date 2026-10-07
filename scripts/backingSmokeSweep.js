// scripts/backingSmokeSweep.js
//
// The founder smoke's ONE agent sweep (the backing QA rounds 1–3 build, item
// E; its review record, R4-6 / R5-1): the `agents` documents a run's `cleanup`
// may consider — the run's RECORDED ids (`run.agentIds`, the manifest's or the
// live marker's) and, as the belt, every `agents` document OWNED by one of the
// run's synthetic seat uids (`run.seatUids`; a seat uid is minted per run, so
// the owner query names nothing but this run's). READS ONLY: nothing here
// deletes — the script passes each target through the pure cleanup verdict
// (scripts/backingSmokeLib.js devTargetVerdict: the smoke marker AND an owner
// among the run's seats) and refuses the whole run on the first miss.
//
// Kept OUT of backingSmokeLib.js on purpose: that module is pure over plain
// objects and holds no Firestore handle; this one takes the handle, so the
// script's cleanup and the suite (scripts/backingSmokeLib.test.js, on the
// in-memory Firestore) drive the SAME function — a sweep the script ran but
// the suite re-implemented was a row that could not fail under the defect it
// named (BUILD_RULES §2).

/** The literal collection — the protected-store scan reads it; this module writes nothing. */
const AGENTS_COLLECTION = 'agents';

/**
 * path → `{ ref, data }` for every agent document the run may sweep: the
 * recorded ids that still exist, then the owner query, de-duplicated by path.
 * A run with no recorded ids (a pre-build manifest) is still swept by owner;
 * a run with no seat uids is swept by id alone; a run with neither yields none.
 */
export async function agentSweepTargets(db, run) {
  const out = {};
  const col = db.collection(AGENTS_COLLECTION);
  for (const id of Array.isArray(run?.agentIds) ? run.agentIds : []) {
    if (typeof id !== 'string' || id.length === 0 || id.includes('/')) continue;
    const ref = col.doc(id);
    const snap = await ref.get();
    if (snap.exists) out[ref.path] = { ref, data: snap.data() };
  }
  const seatUids = (Array.isArray(run?.seatUids) ? run.seatUids : []).filter((u) => typeof u === 'string' && u.length > 0);
  if (seatUids.length > 0) {
    const owned = await col.where('ownerId', 'in', seatUids).get();
    owned.forEach((d) => {
      // The ref is rebuilt from the id (`col.doc`) so the path reads the same on the Admin SDK and on the in-memory harness.
      const ref = col.doc(d.id);
      if (!out[ref.path]) out[ref.path] = { ref, data: d.data() };
    });
  }
  return out;
}
