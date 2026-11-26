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
// A quote matches when, under this rule, it is a substring of the text — at a place where it does not cut a number:
// a quote that begins with a digit must not continue a number in the text before it (a digit, a decimal point or
// thousands comma after a digit, or a minus sign), and a quote that ends with a digit must not run on into one (a
// digit, or a decimal point or comma followed by a digit). So "48% this quarter" is not found in "grew 148% this
// quarter", nor in "-48% this quarter", and "Sales were 3" is not found in "Sales were 3,661". This is the Work an
// idea chat's own condition, "the figure sits inside its own matched excerpt, written as the table will show it",
// held where the excerpt sits in the document (review H2). No fuzzy matching, no stemming, no partial credit.
// RULE_VERSION is recorded on every match block (`match.rule`): a change of any step above is a new version.

import { createHash } from 'node:crypto';

/** The version of the rule above, written on every match this step records (the Work an idea chat, Nov 25). */
export const RULE_VERSION = 1;

const SINGLE_QUOTES = /[\u2018\u2019\u201A\u201B]/g;
const DOUBLE_QUOTES = /[\u201C\u201D\u201E\u201F]/g;
const DASHES = /[\p{Pd}\u2212]/gu;
const SOFT_HYPHEN = /\u00AD/g;
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

const DIGIT = /\d/;
/** The slash and the fraction slash (built from its code point: this file holds no look-alike byte). */
const FRACTION_SLASHES = `/${String.fromCodePoint(0x2044)}`;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
/** Does the text, just before index `i`, hold a number the quote's first digit would continue? */
function numberRunsInto(text, i) {
  const c1 = text[i - 1] ?? '';
  const c2 = text[i - 2] ?? '';
  if (DIGIT.test(c1) || c1 === '.') return true; // a digit, or a decimal point (".5%" holds no 5)
  if (c1 === ',' && DIGIT.test(c2)) return true;
  return c1 === '-' && !LETTER_OR_DIGIT.test(c2); // a minus sign, not the hyphen of "12-18" or "Q3-2026"
}
/** Does the text, from index `j`, carry on the number the quote's last digit ends (a fraction's slash included)? */
function numberRunsOn(text, j) {
  const c1 = text[j] ?? '';
  const c2 = text[j + 1] ?? '';
  return DIGIT.test(c1) || ((c1 === '.' || c1 === ',' || (c1 !== '' && FRACTION_SLASHES.includes(c1))) && DIGIT.test(c2));
}

/**
 * Is `quote` in `ruledText`? `ruledText` must already be under the rule (the text is put under it once per document);
 * the quote is put under it here. Found when SOME occurrence does not cut a number at either edge (see the header).
 * An empty quote is never found.
 */
export function quoteIn(ruledText, quote) {
  const q = underRule(quote);
  if (q.length === 0 || typeof ruledText !== 'string') return false;
  const startsWithDigit = DIGIT.test(q[0]);
  const endsWithDigit = DIGIT.test(q[q.length - 1]);
  for (let i = ruledText.indexOf(q); i >= 0; i = ruledText.indexOf(q, i + 1)) {
    if (startsWithDigit && numberRunsInto(ruledText, i)) continue;
    if (endsWithDigit && numberRunsOn(ruledText, i + q.length)) continue;
    return true;
  }
  return false;
}

/** The SHA-256 (hex) of a text already under the rule — `match.textHash`. */
export function textHashOf(ruledText) {
  return createHash('sha256').update(ruledText, 'utf8').digest('hex');
}
