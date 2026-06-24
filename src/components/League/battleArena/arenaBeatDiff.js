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
 * The freshest beat (scanning most-recent-first) whose key is NOT in `seen`, or
 * null if every beat has been seen.
 *
 * Why a seen-SET, not a last-key compare: deriveBeats floats lead changes and
 * star transitions to the TOP of the list with a sentinel (MAX) timestamp, so a
 * sticky beat (e.g. a lead change) can permanently occupy index 0. Comparing only
 * beats[0] to the last-seen key would then mask every newer event beat behind it
 * (they sit at index ≥1 and never surface). Scanning for the first UNSEEN beat
 * fixes that — newer beats deeper in the list still fire. One per tick is fine:
 * the surface shows a single beat at a time, and the climb/stars (the scores of
 * record) update regardless of which beat caption fires.
 * @param {Object[]} beats most-recent-first (deriveBeats output)
 * @param {Set<string>} seen keys already fired
 * @returns {{ beat: Object, key: string } | null}
 */
export function firstUnseenBeat(beats, seen) {
  if (!Array.isArray(beats) || !seen) return null;
  for (const b of beats) {
    const key = beatKey(b);
    if (!seen.has(key)) return { beat: b, key };
  }
  return null;
}
