// api/_utils/teamPitch.js
//
// Backing Beta PR 4 — THE SCOUTING PITCH (design brief rev2 §2, rev3 §3):
// one sentence in the player's own words, shown on their team card above
// their agent's approach. The collection name lives here, with its writer's
// helpers, the PR 0 precedent (ELIGIBILITY_COLLECTION sits in eligibility.js).
//
// `teamPitches/{uid}` `{ text, updatedAt }` is SERVER-WRITTEN ONLY — the one
// writer is POST /api/team/pitch (api/team/pitch.js); the rules block is
// authed-read, `write: if false`. It deliberately does NOT live on
// `users/{uid}`: that document is owner-writable, so a pitch there would be a
// client-asserted string the server never validated (the eligibility / career-
// rank precedent — BUILD_RULES §9 applied to copy). Authed-read, not owner-
// read, because the pitch is a PUBLIC line on the card: the team-card
// projection reads it for any seat and the profile editor reads the owner's.
//
// `normalizePitch` is the ONE validator (§9 — one source): trimmed, 1–140
// characters, control characters stripped, no newlines; an empty result
// CLEARS the pitch (the route writes `text: ''` rather than deleting, so the
// overwrite is idempotent and the doc's `updatedAt` records the clear). Pure.

import { PITCH_MAX_LEN } from '../../src/constants/teamPitch.js';

/** The collection; the doc id is the player's Firebase Auth uid. */
export const TEAM_PITCHES_COLLECTION = 'teamPitches';

// Re-exported so the route's suite and any api/ reader name one source.
export { PITCH_MAX_LEN };

/**
 * Validate and normalize a submitted pitch.
 *
 * Newline-class control characters (LF, CR, tab, vertical tab, form feed)
 * become a single space so a pasted two-line pitch keeps its word boundary;
 * every other control character is removed outright; whitespace runs collapse;
 * the result is trimmed. An empty result is a CLEAR, not a refusal.
 *
 * @param {unknown} value the request body's `text`
 * @returns {{ok: true, text: string}|{ok: false, error: string, message: string}}
 */
export function normalizePitch(value) {
  if (typeof value !== 'string') {
    return { ok: false, error: 'invalid_text', message: 'text must be a string.' };
  }
  const text = value
    .replace(/[\n\r\t\v\f]/g, ' ')
    // eslint-disable-next-line no-control-regex -- the point of the rule is to strip these code points
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > PITCH_MAX_LEN) {
    return { ok: false, error: 'too_long', message: `A pitch is at most ${PITCH_MAX_LEN} characters.` };
  }
  return { ok: true, text };
}

/** The document the route writes — exactly these two fields. */
export function buildPitchDoc(text, now = new Date()) {
  return { text, updatedAt: new Date(now).toISOString() };
}

/** The `teamPitches/{uid}` reference. */
export function pitchRef(db, uid) {
  return db.collection(TEAM_PITCHES_COLLECTION).doc(uid);
}

/**
 * The player's pitch text, or null when none is written (or it was cleared).
 * A plain read; a missing or non-string uid is null without a read.
 */
export async function readPitch(db, uid) {
  if (typeof uid !== 'string' || uid.length === 0) return null;
  const snap = await pitchRef(db, uid).get();
  if (!snap.exists) return null;
  const text = snap.data()?.text;
  return typeof text === 'string' && text.length > 0 ? text : null;
}
