// api/_utils/deployCeremonyExcerpt.js
//
// Pure, dependency-free excerpt selector for the Deploy Ceremony deployProgress
// telemetry (DEPLOY_CEREMONY_SPEC_V1 §5 / Amendment A §4.6).
//
// Returns a VERBATIM substring of the strategy brief — the first sentence(s) up
// to ~220 characters, cut at a sentence boundary where possible. It never
// rewrites, paraphrases, or appends characters (no trailing "…"): the result is
// always an exact contiguous substring of the input, or null. This is what lets
// the client typewriter it while honouring the §1/§9 honesty rule — what is
// shown is provably a slice of the stored strategyBrief.
//
// Imports nothing (never a fenced module), so it is unit-testable in isolation
// and safe to import from the fenced decide.js as the §11.2-blessed helper.

// ~220 chars per the excerpt rule; the brief tool contract is ~200 words, so a
// well-formed brief usually yields 2–3 whole sentences here.
const MAX_EXCERPT_CHARS = 220;
// Don't cut to a trivially short fragment on an early period (e.g. "U.S. ...").
const MIN_EXCERPT_CHARS = 40;

/**
 * Select a verbatim, sentence-bounded excerpt of a strategy brief.
 *
 * @param {unknown} brief    The full strategyBrief string (any type tolerated).
 * @param {number} [maxChars] Soft length cap; defaults to ~220.
 * @returns {string|null} A contiguous substring of `brief`, or null when the
 *   input is not a non-empty string.
 */
export function selectBriefExcerpt(brief, maxChars = MAX_EXCERPT_CHARS) {
  if (typeof brief !== 'string') return null;
  const trimmed = brief.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= maxChars) return trimmed;

  const window = trimmed.slice(0, maxChars);
  // The shortest acceptable excerpt. Fixed at ~40 for the real ~220 cap, but
  // scaled down for small custom caps so a legitimate first sentence is never
  // rejected as "too short".
  const minChars = Math.min(MIN_EXCERPT_CHARS, Math.floor(maxChars / 2));

  // Prefer the LAST sentence boundary (. ! ?) followed by whitespace or the
  // window end, so long as it is not a trivially short fragment. A period inside
  // a number ("3.5%") or abbreviation mid-token is skipped because its next char
  // is not whitespace.
  let boundary = -1;
  for (let i = 0; i < window.length; i++) {
    const ch = window[i];
    if (ch === '.' || ch === '!' || ch === '?') {
      const next = window[i + 1];
      if (next === undefined || /\s/.test(next)) {
        boundary = i; // index of the sentence-ending punctuation
      }
    }
  }
  if (boundary >= minChars - 1) {
    return trimmed.slice(0, boundary + 1).trim();
  }

  // No usable sentence boundary in range — fall back to the last word boundary
  // so we never cut mid-word. Still a verbatim substring.
  const lastSpace = window.lastIndexOf(' ');
  if (lastSpace >= minChars - 1) {
    return trimmed.slice(0, lastSpace).trim();
  }

  // Degenerate input (one very long token) — hard verbatim cut at the cap.
  return window.trim();
}

export default selectBriefExcerpt;
