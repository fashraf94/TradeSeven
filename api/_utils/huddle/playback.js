// api/_utils/huddle/playback.js
//
// Huddle S1 — the playback token and the byte ranges (spec V1.1 §6, Astra AR-7).
//
// TOKEN. Native <audio> cannot send an Authorization header, so the audio route is the
// documented exception to owner auth. The owner-authenticated issuance route mints a
// fresh random token, returns its plaintext ONCE, and stores only its SHA-256:
//   token     = `${etDate}.${43 base64url characters}` (256 random bits; the ET date
//               says which day's index to look in, and is no secret)
//   record    huddles/{uid}/days/{etDate}.playback = { tokenHash, issuedAt, expiresAt }
//   index     huddleRuns/{etDate}.playback.{tokenHash} = { uid, expiresAt }
// Issuance ROTATES: the previous hash leaves the index in the same transaction. The audio
// route resolves hash → uid through the index, then re-checks the record's own hash and
// expiry, so a token is good only while it is the record's current one. Tokens are never
// logged (the route logs neither the path nor the token).
//
// RANGES. `Range: bytes=a-b | a- | -n` (one range); anything unsatisfiable is a 416 with
// `Content-Range: bytes */size`; no Range header is a 200 of the whole object.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { huddleDayRef, huddleRunRef, isEtDate, RECORD_STATUS } from './records.js';

export const PLAYBACK_TTL_MS = 20 * 60_000;
const TOKEN_RE = /^(\d{4}-\d{2}-\d{2})\.([A-Za-z0-9_-]{43})$/;

export const tokenHashOf = (token) => createHash('sha256').update(String(token), 'utf8').digest('hex');

/** The ET date a token names, or null for anything that is not a token's shape. */
export function parsePlaybackToken(token) {
  const m = typeof token === 'string' ? TOKEN_RE.exec(token) : null;
  return m && isEtDate(m[1]) ? { etDate: m[1] } : null;
}

export function mintPlaybackToken(etDate) {
  return `${etDate}.${randomBytes(32).toString('base64url')}`;
}

const sameHash = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length
  && timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));

/**
 * Issue (and rotate) the owner's token for one day's record.
 * @returns {Promise<{ kind: 'issued', token: string, expiresAt: string } | { kind: 'refused', status: number, code: string }>}
 */
export async function issuePlaybackToken(db, { uid, etDate, nowMs = Date.now() }) {
  const dayRef = huddleDayRef(db, uid, etDate);
  const runRef = huddleRunRef(db, etDate);
  const token = mintPlaybackToken(etDate);
  const tokenHash = tokenHashOf(token);
  const expiresAt = new Date(nowMs + PLAYBACK_TTL_MS).toISOString();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(dayRef);
    if (!snap.exists) return { kind: 'refused', status: 404, code: 'not_found' };
    const record = snap.data();
    if (record.status !== RECORD_STATUS.READY || typeof record.audio?.gcsPath !== 'string') return { kind: 'refused', status: 409, code: 'no_audio' };
    const previous = record.playback?.tokenHash;
    tx.update(dayRef, { playback: { tokenHash, issuedAt: new Date(nowMs).toISOString(), expiresAt }, updatedAt: new Date(nowMs).toISOString() });
    const index = { [tokenHash]: { uid, expiresAt } };
    if (typeof previous === 'string' && previous && previous !== tokenHash) index[previous] = FieldValue.delete();
    tx.set(runRef, { playback: index }, { merge: true });
    return { kind: 'issued', token, expiresAt };
  });
}

/**
 * Resolve a presented token to the record's audio, or a refusal. Reads the day's index,
 * then the record; both must agree, and the token must not have expired.
 * @returns {Promise<{ kind: 'ok', gcsPath: string, durationMs: number|null } | { kind: 'refused', status: number }>}
 */
export async function resolvePlaybackToken(db, { token, nowMs = Date.now() }) {
  const parsed = parsePlaybackToken(token);
  if (!parsed) return { kind: 'refused', status: 404 };
  const hash = tokenHashOf(token);
  const runSnap = await huddleRunRef(db, parsed.etDate).get();
  const entry = runSnap.exists ? runSnap.data()?.playback?.[hash] : null;
  if (!entry || typeof entry.uid !== 'string') return { kind: 'refused', status: 404 };
  const recSnap = await huddleDayRef(db, entry.uid, parsed.etDate).get();
  const record = recSnap.exists ? recSnap.data() : null;
  if (!record || !sameHash(record.playback?.tokenHash, hash)) return { kind: 'refused', status: 404 };
  const exp = Date.parse(record.playback?.expiresAt);
  if (!Number.isFinite(exp) || nowMs >= exp) return { kind: 'refused', status: 410 };
  if (typeof record.audio?.gcsPath !== 'string') return { kind: 'refused', status: 404 };
  return { kind: 'ok', gcsPath: record.audio.gcsPath, durationMs: record.audio.durationMs ?? null };
}

/**
 * Parse one byte range against the object's size.
 * @returns {{ kind: 'full' } | { kind: 'partial', start: number, end: number } | { kind: 'unsatisfiable' }}
 */
export function parseRange(header, size) {
  if (header === undefined || header === null || header === '') return { kind: 'full' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m || (m[1] === '' && m[2] === '') || !(size > 0)) return { kind: 'unsatisfiable' };
  let start;
  let end;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (!(suffix > 0)) return { kind: 'unsatisfiable' };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return { kind: 'unsatisfiable' };
  return { kind: 'partial', start, end };
}
