// api/_utils/backingFingerprint.js
//
// Backing Beta PR 2, carry-in E1 — THE STAKE FINGERPRINT (spec V1.3 §6 the
// stake's `fingerprint` {ipHash, uaHash} and `excluded`, §8 detective controls).
//
// WHAT THIS IS FOR, STATED AT ITS REAL WORTH. §8 lists the fingerprint under
// DETECTIVE controls, beside the sentence "no linked-identity infrastructure
// exists in the platform, and none is built here". It feeds the admin Sybil
// watch (§10) — a report, not a product surface — and the `excluded` flag lets
// an admin drop a stake from stats and social counts WITHOUT touching settlement
// math. It is not an identity, it is not proof of anything, and nothing in the
// product reads it.
//
// NEVER RAW (E1). The IP and the User-Agent are hashed here and the raw values
// never reach Firestore. The hash is SALTED with a server-side secret so the
// stored digest is not a lookup key: an unsalted SHA-256 of an IPv4 address is
// reversible by brute force over 2^32 candidates in seconds, which would make
// "hashed" a word rather than a property.
//
// THE SALT, and its honest limits. In order:
//   1. `BACKING_FINGERPRINT_SALT` if an operator sets one — the dedicated knob,
//      and the only one that gives this its own key.
//   2. otherwise a label-separated derivation from `CRON_SECRET`, which every
//      deployed environment already holds (BUILD_RULES §6 — the in-repo
//      service-to-service secret pattern). Key separation is by the constant
//      label below, so the digest cannot be used as an oracle for the secret.
//   3. otherwise an in-repo constant, and the digest is then de-identification
//      only, NOT a keyed MAC — a brute-force reversal of an IP becomes possible
//      again. This is the dev/test path. It is logged ONCE per process rather
//      than silently, because a production deploy that reached it would be
//      storing weaker data than this file claims.
// PR 2 ADDS NO ENVIRONMENT VARIABLE and requires none: step 1 is an optional
// hardening a runbook step can take later, step 2 is what production actually
// uses today.
//
// TWO LIMITS THAT BIND, stated because a module that lists only the comfortable
// ones is worse than one that lists none:
//   · THE IP INPUT IS CLIENT-SUPPLIED. `clientIpOf` takes the first
//     `x-forwarded-for` hop, the same rule the rate limiter uses. If the
//     platform APPENDS to that header rather than overwriting it, a caller
//     chooses their own `ipHash` and the §8 Sybil watch is defeated with one
//     header. This is not a control against a motivated actor; it is a research
//     signal (§8 says exactly that: "a report, not a product surface"). A
//     platform-verified client-IP field would be the hardening, and belongs with
//     the Sybil-watch task in PR 5, not here.
//   · A `CRON_SECRET` ROTATION SILENTLY RE-KEYS every later fingerprint, so
//     digests either side of a rotation never compare equal and the watch goes
//     blind for the accounts it spans. Setting `BACKING_FINGERPRINT_SALT`
//     explicitly is what decouples the two lifetimes. (The STAKE ID is immune —
//     it is the unsalted hash, see `hashFingerprint`'s `salted: false`.)
//
// PURE AND SYNCHRONOUS, so the stake transaction can call it without a read and
// the tests can assert the digest without a running service.

import { createHash } from 'node:crypto';

/** Key separation: the salt derived from CRON_SECRET is derived FOR this use. */
const SALT_LABEL = 'fantasytrades/backing-beta/fingerprint/v1';

/** The step-3 fallback. Not a secret; see the header on what it costs. */
const UNSALTED_FALLBACK = 'backing-beta-unsalted-fallback';

let warnedUnsalted = false;

/**
 * The server-side salt, resolved at CALL time (never at module load): a test
 * that sets the env var must see it, and a serverless instance must not cache a
 * value from before a secret rotation.
 */
export function resolveSalt() {
  const explicit = process.env.BACKING_FINGERPRINT_SALT;
  if (typeof explicit === 'string' && explicit.length > 0) return explicit;
  const cron = process.env.CRON_SECRET;
  if (typeof cron === 'string' && cron.length > 0) {
    return createHash('sha256').update(`${SALT_LABEL}\n${cron}`).digest('hex');
  }
  if (!warnedUnsalted) {
    warnedUnsalted = true;
    console.warn('[backingFingerprint] no BACKING_FINGERPRINT_SALT or CRON_SECRET — fingerprints are de-identified, not keyed');
  }
  return UNSALTED_FALLBACK;
}

/** Test seam: forget that the unsalted warning has been emitted. */
export function __resetSaltWarning() {
  warnedUnsalted = false;
}

/**
 * The stored digest of one fingerprint component.
 *
 * @param {string} value the raw IP or User-Agent. Never stored.
 * @param {{salted?: boolean}} [opts] `salted: false` makes this a plain content
 *   hash — used for the stake's DETERMINISTIC document id, which must be stable
 *   across a secret rotation (a rotated salt would otherwise mint a second
 *   document for the same `requestId` and break §8's idempotency guarantee).
 * @returns {string} a lowercase hex sha256 digest.
 */
export function hashFingerprint(value, { salted = true } = {}) {
  const input = typeof value === 'string' ? value : '';
  const h = createHash('sha256');
  if (salted) h.update(`${resolveSalt()}\n`);
  return h.update(input).digest('hex');
}

/**
 * The client IP, by the same header precedence the rate limiter already uses
 * (api/_utils/rateLimit.js) — one answer to "who is this request from", not two
 * that could disagree (BUILD_RULES §9).
 */
export function clientIpOf(req) {
  return (
    req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || req?.headers?.['x-real-ip']
    || req?.socket?.remoteAddress
    || 'unknown'
  );
}

/**
 * The `{ ipHash, uaHash }` pair the sealed `private/meta` doc stores (§6).
 * An absent header hashes its sentinel rather than being omitted, so the doc's
 * shape is fixed and a missing value is not mistaken for a missing write.
 */
export function fingerprintOf(req) {
  return {
    ipHash: hashFingerprint(clientIpOf(req)),
    uaHash: hashFingerprint(req?.headers?.['user-agent'] ?? 'unknown'),
  };
}
