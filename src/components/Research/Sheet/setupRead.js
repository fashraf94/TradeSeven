// src/components/Research/Sheet/setupRead.js
//
// The chart's evidence — THE CLIENT READ (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md §4.6).
// One call to GET /api/research/setup-read for one symbol, returning one of the three
// answers as the server sent it. No screen and no caller in this build: the Chart view's
// read (the next build) is its first caller. It reads the body, checks its shape against
// the contract, and passes it on unchanged; it derives nothing.
//
//   resolves  { answer: 'measured' | 'refused' | 'absent', symbol, servedAt, sessionsTried, read }
//   rejects   { status, error }  — 404 chart_read_unavailable (the flag), 400 (the symbol),
//             429, 5xx, a network failure (status 0, 'network'), or a body outside the
//             contract (status 200, 'malformed_body'). Never an answer it did not receive.

import { fetchWithAuth } from '../../../utils/fetchWithAuth.js';
import { SETUP_READ_ANSWERS, SETUP_READ_BODY_KEYS, SETUP_READ_FIELDS } from './setupReadContract.js';

export const SETUP_READ_PATH = '/api/research/setup-read';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const sameKeys = (obj, keys) => isObject(obj) && Object.keys(obj).length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(obj, k));

/** Is this body one the contract allows? Pure. */
export function setupReadBodyOk(body) {
  if (!sameKeys(body, SETUP_READ_BODY_KEYS) || !SETUP_READ_ANSWERS.includes(body.answer)) return false;
  if (typeof body.symbol !== 'string' || !Array.isArray(body.sessionsTried)) return false;
  return body.answer === 'absent' ? body.read === null : sameKeys(body.read, SETUP_READ_FIELDS);
}

/** One symbol's stored setup record, as the route answers it. */
export async function fetchSetupRead(symbol) {
  let res;
  try {
    res = await fetchWithAuth(`${SETUP_READ_PATH}?symbol=${encodeURIComponent(String(symbol ?? ''))}`);
  } catch {
    throw { status: 0, error: 'network' };
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, error: isObject(body) && typeof body.error === 'string' ? body.error : 'request_failed' };
  if (!setupReadBodyOk(body)) throw { status: res.status, error: 'malformed_body' };
  return body;
}
