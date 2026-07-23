// api/_utils/deployCeremonyExcerpt.js
//
// Pure, dependency-free excerpt selector for the Deploy Ceremony deployProgress
// telemetry (DEPLOY_CEREMONY_SPEC_V1 §5 / Amendment A §4.6 / A.2 §5).
//
// HONESTY RULE (A.2 §5, revised): "verbatim substring" is necessary but NOT
// sufficient — a word-boundary cut can invert meaning while every character is
// authentic ("avoiding semis unless breadth confirms" → "avoiding semis"). So
// the excerpt must be a verbatim contiguous PREFIX that TERMINATES AT A SENTENCE
// BOUNDARY (. ! ?). When no sentence boundary falls within the cap we return
// null — truthful degradation beats a misleading prefix. The return is always an
// exact prefix of the input (brief.startsWith(result) holds for every non-null
// result), never rewritten, never with an appended ellipsis: the client renders
// a truncation indicator when briefExcerpt.length < strategyBrief.length (A.2
// §5.3), so continuation is signalled without altering the stored artifact.
//
// Residual limit stated plainly (A.2 §5): even a sentence-complete prefix can
// mislead if a LATER sentence qualifies it. Perfect fidelity is not available in
// an excerpt; sentence-completeness + a raised cap + a client truncation
// indicator is the honest available maximum.
//
// Imports nothing (never a fenced module); unit-testable in isolation.

// ~400 chars so 2–3 complete sentences of the ~200-word brief typically fit
// (A.2 §5.2 — the old 220 cap forced the mid-sentence cuts the removed
// word-boundary fallback was papering over). Re-calibrate against D-7's live
// sample when it arrives.
const MAX_EXCERPT_CHARS = 400;

/**
 * Drop a single trailing UNPAIRED UTF-16 surrogate so a code-unit slice can
 * never emit a replacement char (�) that appears nowhere in the brief (A.2 §5.4).
 * A properly paired surrogate (emoji, etc.) is left intact. Exported for tests.
 *
 * @param {string} s
 * @returns {string}
 */
export function stripLoneSurrogate(s) {
  if (typeof s !== 'string' || s.length === 0) return s;
  const last = s.charCodeAt(s.length - 1);
  // Trailing HIGH surrogate can never be paired (nothing follows it).
  if (last >= 0xd800 && last <= 0xdbff) return s.slice(0, -1);
  // Trailing LOW surrogate is paired only if the preceding unit is a high one.
  if (last >= 0xdc00 && last <= 0xdfff) {
    const prev = s.length >= 2 ? s.charCodeAt(s.length - 2) : -1;
    if (prev < 0xd800 || prev > 0xdbff) return s.slice(0, -1);
  }
  return s;
}

/**
 * Select a verbatim, sentence-terminated PREFIX of a strategy brief.
 *
 * @param {unknown} brief    The full strategyBrief string (any type tolerated).
 * @param {number} [maxChars] Soft length cap; defaults to ~400.
 * @returns {string|null} A prefix of `brief` ending at a sentence boundary (or
 *   the whole brief when it fits), or null when the input is not a non-empty
 *   string OR no sentence boundary falls within the cap.
 */
export function selectBriefExcerpt(brief, maxChars = MAX_EXCERPT_CHARS) {
  if (typeof brief !== 'string') return null;
  if (brief.trim().length === 0) return null;

  // Whole brief already within the cap — return it verbatim (a prefix of itself;
  // nothing is omitted, so no truncation can mislead). No leading trim: the
  // result must satisfy brief.startsWith(result); the client trims for display.
  if (brief.length <= maxChars) return brief;

  // Otherwise the excerpt must terminate at a sentence boundary within the cap.
  // A.2 §5.1: NO word-boundary fallback — when no boundary fits, return null.
  const window = brief.slice(0, maxChars);
  let boundary = -1;
  for (let i = 0; i < window.length; i++) {
    const ch = window[i];
    if (ch === '.' || ch === '!' || ch === '?') {
      // Look at the next char in the FULL brief (not the window) so a boundary
      // at the window edge is judged correctly, and a decimal ("3.5") or a
      // mid-token dot is skipped because its next char is not whitespace.
      const next = brief[i + 1];
      if (next === undefined || /\s/.test(next)) boundary = i;
    }
  }
  if (boundary < 0) return null;
  return stripLoneSurrogate(brief.slice(0, boundary + 1));
}

export default selectBriefExcerpt;
