// api/_utils/researchAskText.js
//
// Research Modal Build C — ONE LINE OF PACK TEXT (spec BC-7). Every string the
// RESEARCH ASK block renders inside its delimiters — a client item's words AND
// the server's own re-read items, whose text comes from stored records (an idea
// statement, a directive, a candidate's signal summary) — passes through here
// at parse time (researchAsk.js) and again at render time (voiceLayerPrompt.js
// renderResearchAskBlock), so no item can open a new line, close the tags or
// forge a numbered "[VERIFIED]" line.
//
// It COMPOSES the one chat sanitizer (chatTextSanitize.js — never a copy,
// BUILD_RULES §4): first every line terminator and control character that
// sanitizer leaves (U+2028, U+2029, U+0085, \v, \f and the rest of C0/C1)
// becomes a space, then sanitizeChatText strips \n \r \t < > { } as it always
// has, then the length cap.

import { sanitizeChatText } from './chatTextSanitize.js';

/** The caps the block renders at — the parse caps (packs.js FACT_MAX; researchAsk.js labels). */
export const PACK_FACT_MAX = 200;
export const PACK_LABEL_MAX = 120;

// C0 controls, DEL, C1 controls (incl. U+0085 NEL), U+2028 LINE SEPARATOR, U+2029 PARAGRAPH SEPARATOR.
const LINE_BREAKERS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

// Square brackets too: no item can print its own "[VERIFIED]" mark mid-line (review B2).
const clean = (raw) => sanitizeChatText(raw.replace(LINE_BREAKERS, ' ').replace(/[[\]]/g, '')).replace(/ {2,}/g, ' ');

/**
 * @param {*} raw
 * @param {number} max  the longest kept text
 * @returns {string|null} one clean line, or null when nothing is left or it runs over `max`
 */
export function packLine(raw, max) {
  if (typeof raw !== 'string') return null;
  const t = clean(raw);
  return t && t.length <= max ? t : null;
}

/** The same, clamped instead of refused (render time: a too-long line is cut, never dropped). */
export function packLineClamped(raw, max) {
  if (typeof raw !== 'string') return '';
  const t = clean(raw);
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}
