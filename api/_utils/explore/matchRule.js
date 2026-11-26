// api/_utils/explore/matchRule.js
//
// Explore publish step — THE WORD-FOR-WORD RULE (build prompt K-6; the Work an idea chat's conditions of Nov 25).
// Pure, no I/O. One rule, applied identically to the fetched text and to every quote, and to nothing else:
//
//   1. Unicode NFKC;
//   2. typographic quotes (U+2018–U+201F) to straight ones;
//   3. every dash (Unicode's dash punctuation) and minus sign (U+2212) to a hyphen;
//   4. soft hyphens (U+00AD) removed;
//   5. every run of whitespace, non-breaking included, to one space; the ends trimmed;
//   6. case kept.
//
// A quote matches when, under this rule, it is a substring of the text. No fuzzy matching, no stemming, no partial
// credit. RULE_VERSION is recorded on every match block (`match.rule`): a change of any step above is a new version.

import { createHash } from 'node:crypto';

/** The version of the rule above, written on every match this step records (the Work an idea chat, Nov 25). */
export const RULE_VERSION = 1;

const SINGLE_QUOTES = /[‘’‚‛]/g;
const DOUBLE_QUOTES = /[“”„‟]/g;
const DASHES = /[\p{Pd}−]/gu;
const SOFT_HYPHEN = /­/g;
const WHITESPACE = /\s+/gu;

/** A string under the rule (a non-string is the empty string). */
export function underRule(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(DASHES, '-')
    .replace(SOFT_HYPHEN, '')
    .replace(WHITESPACE, ' ')
    .trim();
}

/**
 * Is `quote` in `ruledText`? `ruledText` must already be under the rule (the text is put under it once per document);
 * the quote is put under it here. An empty quote is never found.
 */
export function quoteIn(ruledText, quote) {
  const q = underRule(quote);
  return q.length > 0 && typeof ruledText === 'string' && ruledText.includes(q);
}

/** The SHA-256 (hex) of a text already under the rule — `match.textHash`. */
export function textHashOf(ruledText) {
  return createHash('sha256').update(ruledText, 'utf8').digest('hex');
}
