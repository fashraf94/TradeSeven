// src/components/League/battleArena/arenaBeatDiff.js
//
// League Battle View V2 — the live engine's "what's new" selector (Phase 3, pure +
// node-clean). In PREVIEW the engine loops fixture beats on a timer; in LIVE mode
// the beats come from deriveBeats over real data, and we must surface only the
// FRESHEST unseen beat once, when it changes — never loop, never replay a backlog.
//
// A real beat has no server id, so we key it by content. `deriveBeats` returns
// most-recent-first, so beats[0] is the newest; we fire it iff its key differs
// from the last one we showed.

/** A deterministic, content-derived key for a beat (kind + star + text). */
export function beatKey(beat) {
  if (!beat) return '';
  return `${beat.kind}:${beat.star ?? ''}:${beat.text ?? ''}`;
}

/**
 * The newest beat not yet seen, or null if the freshest beat is the one we last
 * showed. Only the single freshest beat is surfaced — the climb/stars (the scores
 * of record) update regardless of beats, so a missed older beat never loses data.
 * @param {Object[]} beats most-recent-first (deriveBeats output)
 * @param {string|null} lastSeenKey the key of the beat we last fired
 * @returns {{ beat: Object, key: string } | null}
 */
export function nextUnseenBeat(beats, lastSeenKey) {
  const newest = Array.isArray(beats) && beats.length ? beats[0] : null;
  if (!newest) return null;
  const key = beatKey(newest);
  if (key === lastSeenKey) return null;
  return { beat: newest, key };
}
