// src/components/Tournament/myTournament/myTournamentSeed.js
//
// "My Tournament" — the minimal-real SEED derivation (Build Spec correction #1).
//
// The seed is the user's LIVE 1-based position among HUMANS ONLY in the
// base-layer field. It reuses the seasonal leaderboard's existing ordering
// (points desc — already training-filtered at write time) and excludes CPUs.
// Displayed as "N of M" (M = the human field count).
//
// V1 live seed — it recomputes with standings on every read; this is acceptable
// for V1 and becomes the FROZEN bracket seed once a real seeding system exists.
// Pure (no Firestore, no React) so the derivation is unit-tested directly.

/**
 * Humans-only field position from a seasonal leaderboard doc's `entries`.
 *
 * @param {Object|undefined} entries - the leaderboard `entries`, an object map
 *   keyed by odUserId → { odUserId, isCpu?, points, ... } (the LeaderboardCard
 *   read shape). Missing `points` sort as 0 — the same comparator the
 *   leaderboard surface renders with (Display-agreement: one ordering).
 * @param {string|undefined} uid - the viewer's odUserId.
 * @returns {{ n: number, m: number } | null} the viewer's 1-based position `n`
 *   among `m` humans, or `null` when the field is empty or the user isn't ranked
 *   yet (→ honest empty, never a fabricated seed).
 */
export function deriveSeed(entries, uid) {
  if (!uid) return null;
  const humans = Object.values(entries || {})
    .filter((e) => e && e.isCpu !== true)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0)); // JS sort is stable → equal points keep field order
  const idx = humans.findIndex((e) => e.odUserId === uid);
  if (idx < 0) return null;
  return { n: idx + 1, m: humans.length };
}
