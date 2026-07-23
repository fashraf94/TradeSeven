// api/_utils/expiryPreviewToken.js
//
// Training-Pod P0 R3 (review B1) — a signed, short-lived PREVIEW TOKEN that
// enforces the dry-run → apply boundary on the founder-gated stuck-pod cleanup.
// A dry-run mints a token digesting the exact run parameters (cutoff + threshold
// + includeDev) AND the exact matched pod ids; `apply:true` must present a valid,
// UNEXPIRED token whose params match the apply request. A blind apply is therefore
// impossible — the operator must first observe the census a token was minted for,
// and the applied population is bound to that token's ids.
//
// HMAC-SHA256 over the base64url payload, keyed by the same admin secret the
// endpoint authenticates with. Pure + secret-injected so it is unit-testable.

import crypto from 'node:crypto';

export const PREVIEW_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

function b64url(str) { return Buffer.from(str).toString('base64url'); }

/** Canonical, order-stable param signature — the fields apply must match exactly. */
function paramKey({ cutoffIso, thresholdMs, includeDev }) {
  return JSON.stringify({ cutoffIso: cutoffIso ?? null, thresholdMs, includeDev: includeDev === true });
}

/**
 * Mint a preview token. `ids` is the matched-pod id list (deduped + sorted inside).
 * `expMs` is the absolute expiry instant (ms). Returns the token string.
 */
export function signPreviewToken({ cutoffIso, thresholdMs, includeDev, ids, expMs }, secret) {
  if (!secret) throw new Error('signPreviewToken: secret required');
  const payload = {
    p: paramKey({ cutoffIso, thresholdMs, includeDev }),
    ids: [...new Set(Array.isArray(ids) ? ids : [])].sort(),
    exp: expMs,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/**
 * Verify a preview token against the apply request's params + the current instant.
 * Constant-time signature check. Returns `{ valid, reason?, ids? }`; reasons:
 * `malformed` | `bad_signature` | `expired` | `param_mismatch`.
 */
export function verifyPreviewToken(token, { cutoffIso, thresholdMs, includeDev, nowMs }, secret) {
  if (!secret) throw new Error('verifyPreviewToken: secret required');
  if (typeof token !== 'string' || token.indexOf('.') < 1) return { valid: false, reason: 'malformed' };
  const dot = token.indexOf('.');
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false, reason: 'bad_signature' };
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return { valid: false, reason: 'malformed' }; }
  if (typeof payload.exp !== 'number' || nowMs > payload.exp) return { valid: false, reason: 'expired' };
  if (payload.p !== paramKey({ cutoffIso, thresholdMs, includeDev })) return { valid: false, reason: 'param_mismatch' };
  return { valid: true, ids: Array.isArray(payload.ids) ? payload.ids : [] };
}
