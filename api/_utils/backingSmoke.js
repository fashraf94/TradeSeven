// api/_utils/backingSmoke.js
//
// Backing activation — THE FOUNDER SMOKE OVERRIDE (spec V1.3 §11 gate 4, as
// consolidated by Amendment A §A7 gate 4; the PR 4 review record's SEAL-2 /
// DOM-NOTE-2 — "both halves belong to the activation PR"). ONE server decision,
// read by every backing and eligibility door:
//
//   backingLitFor(uid)     = BACKING_BETA_ENABLED            || smokeOverrideFor(uid)
//   eligibilityLitFor(uid) = ELIGIBILITY_ATTESTATION_ENABLED || smokeOverrideFor(uid)
//
// and the override is true ONLY when ALL of these hold, each read at CALL time:
//   · the deployment is a Vercel PREVIEW — `VERCEL_ENV === 'preview'`. In
//     production (`VERCEL_ENV === 'production'`), in `development`, and when
//     the variable is unset (local vitest, a bare node process) the override is
//     ignored entirely, whatever the other two variables say;
//   · `BACKING_SMOKE_ENABLED === 'true'` — the literal string;
//   · the caller's VERIFIED uid — the token's, never a body or query field —
//     is in `BACKING_SMOKE_UIDS`, a comma-separated allowlist.
// Otherwise every function here answers exactly what the code flag says —
// `false` today — so for everyone else, everywhere, the backing layer is
// byte-identical to the flag-off build.
//
// THE FLAGS THEMSELVES ARE NOT TOUCHED. Both stay `false` in featureFlags.js
// and are read here at call time (a hermetic featureFlags mock governs every
// suite; never a module-scope derivation). THE TWO FLIP TRIPWIRES CANNOT FIRE
// FROM THIS OVERRIDE: eligibilityFlags.test.js keys its counsel-copy check on
// the CONSTANT (`if (!ELIGIBILITY_ATTESTATION_ENABLED) return;`) and the
// flag-pin guard scans `export const X_ENABLED = true|false` — neither reads an
// environment variable, and this module writes none. They guard the CODE flip;
// this is not one.
//
// WHY THE SERVER DECIDES: the client never learns it is on a preview from its
// own hostname (the `?preview=backing` fixture page does, for fixtures with no
// writes; this path carries real ones). The client asks GET /api/backing/lit,
// which answers `backingLitFor(uid)` for the caller's own verified uid.
//
// SMOKE TRAFFIC LIVES IN THE DEV NAMESPACE ONLY: the pod list shows a smoke
// user `isDev` pods and nothing else, the stake route refuses a smoke stake on
// anything but an `isDev` pod, and the telemetry sink marks a smoke session's
// events `isDev`. `smokeOverrideFor` is the one predicate those three read.
//
// DELETED IN THE FLIP COMMIT, with the two env vars removed from Vercel — the
// `?fuseHero=1` / `?battleViewController=1` precedent (flagPinGuard.test.js):
// flip, pin and override travel together.

import { BACKING_BETA_ENABLED, ELIGIBILITY_ATTESTATION_ENABLED } from '../../src/config/featureFlags.js';

/** The three environment variables, named once. */
export const SMOKE_ENV = Object.freeze({
  DEPLOYMENT: 'VERCEL_ENV',
  ENABLED: 'BACKING_SMOKE_ENABLED',
  UIDS: 'BACKING_SMOKE_UIDS',
});

/** The one `VERCEL_ENV` value the override honours. */
export const PREVIEW_DEPLOYMENT = 'preview';

/** The allowlist, parsed: split on commas, trimmed, non-empty, de-duplicated. Pure. */
export function smokeAllowlist(env = process.env) {
  const raw = env?.[SMOKE_ENV.UIDS];
  if (typeof raw !== 'string') return [];
  return [...new Set(raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0))];
}

/** Is this deployment a Vercel preview? Strictly `VERCEL_ENV === 'preview'` — nothing else counts. */
export function isPreviewDeployment(env = process.env) {
  return env?.[SMOKE_ENV.DEPLOYMENT] === PREVIEW_DEPLOYMENT;
}

/**
 * Is `uid` a smoke user on THIS deployment? The three conditions in order,
 * each read at call time. Never true in production, whatever the env holds.
 */
export function smokeOverrideFor(uid, env = process.env) {
  if (!isPreviewDeployment(env)) return false;
  if (env?.[SMOKE_ENV.ENABLED] !== 'true') return false;
  if (typeof uid !== 'string' || uid.length === 0) return false;
  return smokeAllowlist(env).includes(uid);
}

/** The backing layer, for this caller: the code flag, or the smoke override. */
export function backingLitFor(uid, env = process.env) {
  // `=== true`, as the client hook reads it (useBackingLit.js): one semantics
  // for the flag on both sides (LIGHT-R-2, the activation review record).
  return BACKING_BETA_ENABLED === true || smokeOverrideFor(uid, env);
}

/** The attestation door, for this caller: the code flag, or the smoke override. */
export function eligibilityLitFor(uid, env = process.env) {
  return ELIGIBILITY_ATTESTATION_ENABLED === true || smokeOverrideFor(uid, env);
}
