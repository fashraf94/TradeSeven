// src/utils/leagueFormat.js
//
// League Battle View V2 — number formatters (Phase 1, pure + node-clean, zero
// imports). The ONE home for how the battle view prints a points / score value.
//
// POINTS, NEVER PERCENT (the spec's hard rule): neither formatter ever appends
// a `%`. Two shapes because the data has two shapes:
//   • fmtPoints — SIGNED INTEGER, for badge points / banked / per-pick points.
//     The canonical scorer already Math.rounds totalPoints/bankedScore, so these
//     are integers (e.g. BaggerBomb +15, Bust -10).
//   • fmtScore  — SIGNED ONE-DECIMAL, for composite / climb altitude / player
//     score / split. These are fractional (round2, e.g. 47.2) and MUST keep the
//     decimal — 47.2 rendering as 47 on the hero is the bug we're avoiding.
//
// These are also the intended single home a later, SEPARATE fix to the
// LeagueParts `Score`/`CountScore` percent-leak should adopt (fmtScore is the
// drop-in) — but that fix is out of this phase's scope; this module does not
// touch LeagueParts.

/**
 * Signed integer points, no percent. `'+15'`, `'-10'`, `'0'`.
 * Non-finite → `'0'`. Negative zero collapses to `'0'` (never `'-0'`).
 * @param {number} n
 * @returns {string}
 */
export function fmtPoints(n) {
  if (!Number.isFinite(n)) return '0';
  const r = Math.round(n);
  if (r > 0) return `+${r}`;
  if (r < 0) return `${r}`; // toString carries the minus sign
  return '0';
}

/**
 * Signed one-decimal score, no percent. `'+47.2'`, `'-1.2'`, `'0.0'`.
 * Non-finite → `'0.0'`. Values that round to zero (incl. `-0.04`) collapse to
 * `'0.0'` (never `'-0.0'`).
 * @param {number} n
 * @returns {string}
 */
export function fmtScore(n) {
  if (!Number.isFinite(n)) return '0.0';
  const r = Math.round(n * 10) / 10; // clean multiple of 0.1, so toFixed is exact
  if (r > 0) return `+${r.toFixed(1)}`;
  if (r < 0) return `${r.toFixed(1)}`; // toFixed carries the minus sign
  return '0.0';
}
