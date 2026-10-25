// src/components/CommandCenter/hub/shadowBloom.js
//
// Command Center hub, slice S7 — when Shadow answers with the response bloom
// (spec V1.2 §10; ruling R-S7-3). Two triggers, and only these:
//
//   - a new area selection: the hub counts each selection that CHANGED the
//     area (`areaEvent`, a number that only goes up). Re-selecting the current
//     area, a read, a refresh, a sheet opening and a switch of browser tab are
//     not selections and never move it;
//   - an attempt's created terminal: the deploy display word `confirmed` (an
//     explicit creation or a recovered one), once per attempt id. An existing,
//     refused or uncertain terminal never counts, and a terminal that was
//     already there when Shadow mounted is the past, not an event.
//
// Pure: it decides from what it is given and holds nothing. ShadowCanvas keeps
// the memo in state and steps it while rendering.

/** What Shadow knew at mount: nothing it sees then is an event. */
export function seedBloom({ areaEvent = 0, createdAttemptId = null } = {}) {
  return Object.freeze({ areaEvent, seen: createdAttemptId ?? null, key: 0 });
}

/**
 * The next memo, or the same object when nothing happened. `key` goes up by one per response, however many
 * triggers arrived in the same step.
 */
export function stepBloom(memo, { areaEvent = 0, createdAttemptId = null } = {}) {
  // Object.is, so a counter that is NaN still settles (a render-phase step must converge; review B-9).
  const selected = !Object.is(areaEvent, memo.areaEvent);
  const created = typeof createdAttemptId === 'string' && createdAttemptId !== '' && createdAttemptId !== memo.seen;
  if (!selected && !created) return memo;
  return Object.freeze({
    areaEvent,
    seen: created ? createdAttemptId : memo.seen,
    key: memo.key + 1,
  });
}
