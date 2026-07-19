// src/services/leagueSignals.js
//
// Front-end signal-capture seam for the redesigned League surface — the events
// that ORIGINATE here: spectate-open, pod-tap, tab-switch (the follow-rail tap
// is itself a spectate-open; enter-tournament/enter-mode retired with the
// Pick-your-mode stub, Entry-Flow Consolidation P3). These are front-end
// NAVIGATION telemetry — reconciled against the catalog in
// docs/VISION_PROGRAM_POST_LAUNCH_PLACEMENT_ADDENDUM_A_JUN10_2026.md §4 and found
// to belong to NEITHER the §4 trading-signal catalog (board/flip/claim/…) nor any
// row in it; they ride the same gated seam but are a distinct family. Per the
// Signal Capture Rider (BUILD_RULES §5 / Implementation Spec §7), these surfaces
// must write events in a writer-readable shape (structured fields) from day one.
//
// CORPUS SAFETY (founder directive): persistence is gated on real-data + real-
// user context. While the surface is fixtures-backed (isFixtures===true) or no
// authenticated user is present, this LOGS ONLY and never persists — fixture /
// dev-preview interactions must never seed the post-launch signal corpus.
//
// When the read-model is wired (isFixtures===false) AND a real uid is present,
// events persist via an AWAITED write (or the queue-flag pattern) — NEVER
// fire-and-forget on the server. Event names/fields must first be reconciled
// against the catalog in
// docs/VISION_PROGRAM_POST_LAUNCH_PLACEMENT_ADDENDUM_A_JUN10_2026.md §4, and the
// persist call below wired to the confirmed endpoint, before the gate is opened.

export async function logLeagueSignal(event, payload = {}, ctx = {}) {
  const { isFixtures = true, uid = null } = ctx;
  const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

  // Corpus-safe gate: only persist for real data + a real signed-in user.
  if (isFixtures || !uid) {
    if (isDev) console.debug('[leagueSignal:log-only]', event, payload);
    return;
  }

  // Real persist path (enabled by the read-model follow-on). Awaited, never
  // fire-and-forget; the endpoint is wired against the §4 catalog at that time.
  try {
    // await persistLeagueSignal({ event, payload, uid, ts: Date.now() });
    if (isDev) console.debug('[leagueSignal]', event, payload);
  } catch (err) {
    // surface, don't swallow — but never let logging break the interaction
    console.error('[leagueSignal] write failed:', err && err.message);
  }
}
