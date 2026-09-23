// src/constants/teamPitch.js
//
// Backing Beta PR 4 — the scouting pitch's one tunable: its length. ZERO
// IMPORTS by rule (the backing.js / eligibility.js precedent): both the server
// validator (api/_utils/teamPitch.js normalizePitch, under the revised June
// 2026 import rule — BUILD_RULES §4) and the two client editors (the card's
// inline editor and the profile home) read THIS value, so the textarea's
// maxLength and the endpoint's refusal cannot drift (§9 display-agreement
// applied to a limit). Copy lives with the surfaces; the collection name lives
// with its writer.

/** One sentence, at most 140 characters (design brief rev2 §2). */
export const PITCH_MAX_LEN = 140;
