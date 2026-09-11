// api/_utils/gcsCredentials.js
//
// ONE loader for the Google Cloud Storage service-account credential, shared by
// every reader/writer of the shadow stream: shadowLogger.js (the writer) and the
// two scripts that read it back (gemma-latency-report.js, and
// voice-grounding-harness.js through that module's `getBucket`).
//
// THREE ACCEPTED FORMS, tried in this order:
//   1. GCS_CREDENTIALS      — the service-account JSON itself.
//   2. GCS_CREDENTIALS      — that same JSON, base64-encoded (one line, no
//                             quoting or newline-escaping pain in a shell,
//                             a CI secret, or a Vercel env var).
//   3. GCS_CREDENTIALS_FILE — a path to the service-account JSON file. Relative
//                             paths resolve against the process's cwd (Node's
//                             own `readFileSync` rule). `.gcs-credentials.json`
//                             is already gitignored (.gitignore:69).
//
// Form 1 is tried FIRST and returned verbatim, so a deployment whose
// GCS_CREDENTIALS is valid JSON loads exactly the object it loads today —
// the base64 and file forms are reachable only once that parse has failed
// (or GCS_CREDENTIALS is unset). That ordering is the no-behaviour-change
// guarantee, not an accident.
//
// UNSET (neither variable) is NOT an error: it returns null and the caller
// decides whether that is fatal — shadowLogger disables itself, the scripts
// exit 1. SET-BUT-UNLOADABLE throws one sentence naming all three forms:
// "unset" and "misconfigured" are different operator problems and must never
// look the same (the rule gemma-latency-report.js's original getBucket
// established, now enforced for all three consumers).

import { readFileSync } from 'node:fs';

export const CREDENTIALS_ENV = 'GCS_CREDENTIALS';
export const CREDENTIALS_FILE_ENV = 'GCS_CREDENTIALS_FILE';

/**
 * The one-line sentence every consumer surfaces when nothing parses. Exported
 * so tests assert the SHIPPED string rather than a copy of it that can drift.
 */
export const ACCEPTED_FORMS_MESSAGE =
  `Could not load GCS credentials — set one of: ${CREDENTIALS_ENV} to the service-account JSON, `
  + `${CREDENTIALS_ENV} to that JSON base64-encoded, or ${CREDENTIALS_FILE_ENV} to a path to the `
  + 'service-account JSON file';

/** A service account is a JSON object — never an array, a number, or null. */
function isCredentialObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Form 2. `Buffer.from(s, 'base64')` is LENIENT — it silently drops characters
 * outside the base64 alphabet rather than throwing — so an unrelated string can
 * decode to bytes that happen to parse as JSON. Requiring an OBJECT is what
 * keeps that leniency from accepting garbage as a credential; the raw-JSON form
 * above needs no such check because it is never reached by accident.
 */
function parseBase64(value) {
  let decoded;
  try {
    decoded = Buffer.from(value.trim(), 'base64').toString('utf8');
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(decoded);
    return isCredentialObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the service-account credential from the environment.
 *
 * @param {Record<string, string|undefined>} [env] defaults to `process.env`.
 * @returns {object|null} the parsed credential, or null when NEITHER variable
 *   is set (the caller decides whether that is fatal).
 * @throws {Error} one line naming all three accepted forms, plus the concrete
 *   reason each configured form failed, when at least one is set and none parses.
 */
export function loadGcsCredentials(env = process.env) {
  const inline = env[CREDENTIALS_ENV];
  const filePath = typeof env[CREDENTIALS_FILE_ENV] === 'string'
    ? env[CREDENTIALS_FILE_ENV].trim()
    : '';

  // Emptiness is judged exactly as the call sites judged it before this module
  // existed (`if (!creds)`): '' is unset, and a whitespace-only value is SET —
  // it falls through to the error below rather than being silently ignored.
  if (!inline && !filePath) return null;

  const reasons = [];

  if (inline) {
    try {
      return JSON.parse(inline); // FORM 1 — byte-for-byte today's behaviour.
    } catch {
      const fromBase64 = parseBase64(inline); // FORM 2.
      if (fromBase64) return fromBase64;
      reasons.push(`${CREDENTIALS_ENV} is neither valid JSON nor base64-encoded JSON`);
    }
  }

  if (filePath) {
    let contents; // FORM 3.
    try {
      contents = readFileSync(filePath, 'utf8');
    } catch (err) {
      reasons.push(`${CREDENTIALS_FILE_ENV} "${filePath}" could not be read (${err?.message || err})`);
      contents = null;
    }
    if (contents !== null) {
      try {
        return JSON.parse(contents);
      } catch {
        reasons.push(`${CREDENTIALS_FILE_ENV} "${filePath}" does not contain valid JSON`);
      }
    }
  }

  throw new Error(`${ACCEPTED_FORMS_MESSAGE} (${reasons.join('; ')})`);
}
