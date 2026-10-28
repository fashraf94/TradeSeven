// api/_utils/setupEvaluator/volumePolicy.js
//
// Measured Trend Evidence, slice 1 (P3) — the ONE volume usability policy
// (V3 build prompt §6.3, resolution point 1), shared by the daily-bars adapter
// (which classifies every bar it returns) and the Trend Follower evaluator
// (which reads V and V_avg through the same rule). Tests and the replay report
// quote these reasons and no other.
//
// A volume observation is usable only when it is a finite number greater than
// zero. Null, zero, negative and non-finite values are unusable, each with its
// reason. The value itself is never altered here: the adapter preserves what
// the source said and this function only classifies it.
//
// Pure module: no imports, no clock, no I/O.

export const VOLUME_UNUSABLE_REASONS = Object.freeze(['null', 'zero', 'negative', 'non_finite']);

/**
 * @param {unknown} value the volume as supplied (a number, null, or anything else)
 * @returns {{ usable: boolean, reason: null | 'null' | 'zero' | 'negative' | 'non_finite' }}
 */
export function classifyVolume(value) {
  if (value === null || value === undefined) return { usable: false, reason: 'null' };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { usable: false, reason: 'non_finite' };
  if (value === 0) return { usable: false, reason: 'zero' };
  if (value < 0) return { usable: false, reason: 'negative' };
  return { usable: true, reason: null };
}
