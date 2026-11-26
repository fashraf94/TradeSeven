// api/_utils/explore/storyRecord.js
//
// Explore publish step — THE STORY RECORD, as this step reads it (editorial standard V1.4 §9; the content chat's note
// of Nov 25 §3; build prompt K-4, K-7, K-11). Pure, no I/O.
//
//   authorRecordOf      the author's record with every field THIS STEP writes removed first (K-11): `status`,
//                       `publishedAt`, `revisedAt` on the story; `match` on each source; `matched` on each cell and each
//                       input. Whatever values arrived in the file are discarded here, before anything else reads it.
//   contentHashOf       the hash of the author's content (the record as authorRecordOf leaves it): the version rule's
//                       "same content" (K-11).
//   measureCellsOf      every cell of every reported measure of every question, with its place in the record.
//   cellKindOf          'stated' | 'computed' | 'notReported'.
//   figureInExcerpt     K-7: is the value written in its own excerpt, as a whole number token?
//   wordsIn             the body's word count (K-4(d)).

import { canonicalContentHash } from '../canonicalHash.js';
import { underRule } from './matchRule.js';

export const KINDS = Object.freeze(['overview', 'deep']);
/** Body words at most, by kind (standard V1.4 §2; the note §3 replaces the kickoff's "about 200"). */
export const WORD_LIMITS = Object.freeze({ overview: 150, deep: 300 });
/** The broad question's shape, and the five specific ones (standard §6). */
export const BROAD_SHAPE = 'who_leads';
export const SHAPES = Object.freeze([BROAD_SHAPE, 'how_much', 'when', 'who_keeps_profit', 'what_replaces', 'who_depends']);
export const MEASURE_KINDS = Object.freeze(['stored', 'reported']);
/**
 * The two named formulas a computed cell may carry, and what each checks (the Work an idea chat, Nov 25). This step
 * checks the inputs and never computes a result: the research server does the arithmetic.
 */
export const FORMULAS = Object.freeze({
  growth_from_year_ago: Object.freeze({ inputs: Object.freeze(['current', 'yearAgo']) }),
  ratio: Object.freeze({ inputs: Object.freeze(['numerator', 'denominator']) }),
});
export const LIMITS = Object.freeze({
  TICKERS_MAX: 10,
  GROUP_MIN: 3,
  GROUP_MAX: 8,
  MEASURES_MIN: 3,
  MEASURES_MAX: 5,
  STORED_MIN: 2,
});

/** The fields this step writes (K-11). The author's values for them never survive. */
export const STEP_STORY_FIELDS = Object.freeze(['status', 'publishedAt', 'revisedAt']);

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** Every reported measure's cells, each with where it sits: `{ q, m, c, question, measure, cell, field }`. */
export function measureCellsOf(record) {
  const out = [];
  const questions = Array.isArray(record?.questions) ? record.questions : [];
  questions.forEach((question, q) => {
    const measures = Array.isArray(question?.measures) ? question.measures : [];
    measures.forEach((measure, m) => {
      if (!isPlain(measure) || measure.kind !== 'reported') return;
      const cells = Array.isArray(measure.cells) ? measure.cells : [];
      cells.forEach((cell, c) => out.push({ q, m, c, question, measure, cell, field: `questions[${q}].measures[${m}].cells[${c}]` }));
    });
  });
  return out;
}

/** A cell's kind: a `notReported: true` cell; a computed one (it names a `formula`); otherwise a stated one. */
export function cellKindOf(cell) {
  if (isPlain(cell) && cell.notReported === true) return 'notReported';
  if (isPlain(cell) && Object.hasOwn(cell, 'formula')) return 'computed';
  return 'stated';
}

/** The keys of a match result, wherever they sit: only this step writes them (K-11, the STOP list). */
export const MATCH_KEYS = Object.freeze(['match', 'matched']);

/**
 * The author's record, with the step's own fields removed (K-11): returns `{ record, discarded }`, `discarded` naming
 * each field that arrived with a value. `status`, `publishedAt` and `revisedAt` are the story's own; a `match` or
 * `matched` key is removed WHEREVER it sits, at any depth (review H1/A1: a result in a place this step never writes
 * is still a result the author wrote). The input is never changed.
 */
export function authorRecordOf(raw) {
  const record = clone(raw);
  const discarded = [];
  if (!isPlain(record)) return { record, discarded };
  for (const f of STEP_STORY_FIELDS) {
    if (Object.hasOwn(record, f)) { discarded.push(f); delete record[f]; }
  }
  const walk = (node, at) => {
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${at}[${i}]`)); return; }
    if (!isPlain(node)) return;
    for (const key of Object.keys(node)) {
      const field = at ? `${at}.${key}` : key;
      if (MATCH_KEYS.includes(key)) { discarded.push(field); delete node[key]; continue; }
      walk(node[key], field);
    }
  };
  walk(record, '');
  return { record, discarded };
}

/** The hash of the author's content: the record with every step field removed (the version rule, K-11). */
export const contentHashOf = (raw) => canonicalContentHash(authorRecordOf(raw).record);

/**
 * Words in the body: every whitespace-separated token holding a letter or a digit, over all paragraphs. A body
 * written as one string is counted too (review A8): its words would otherwise escape the limit.
 */
export function wordsIn(body) {
  const paragraphs = typeof body === 'string' ? [body] : Array.isArray(body) ? body.filter((p) => typeof p === 'string') : [];
  return paragraphs.reduce((n, p) => n + p.split(/\s+/u).filter((t) => /[\p{L}\p{N}]/u.test(t)).length, 0);
}

/** Signs written before a figure, built from their code points (this file holds no invisible byte). */
const MINUS_SIGNS = `-${String.fromCodePoint(0x2212, 0x2013)}`;
const CURRENCY_SIGNS = `$${String.fromCodePoint(0x20ac, 0xa3, 0xa5)}`;
const FRACTION_SLASHES = `/${String.fromCodePoint(0x2044)}`;

/**
 * The number tokens of a text, each as written with its thousands separators removed: "3,661" → "3661",
 * "51.4" → "51.4", "48%" → "48". A token is a maximal number: never part of a longer one ("148", "48.5", "4,848"),
 * a comma counts as a thousands separator only between groups of three digits, and digits glued to a letter before
 * them are a label, not a number ("Q1", "FY2027"). Digits right after a decimal point are a fraction, never a number
 * of their own (".5%" holds no 5), and digits before a fraction slash belong to a fraction ("51/2" — and "5½", which
 * the rule's NFKC writes with a fraction slash — hold no 51): the refuter's own findings 1 and 2. `negative` is true
 * when the token is written as negative: a hyphen, minus sign or en dash directly before it, or before its currency
 * sign, that does not follow a letter or digit (so "12-18" is a range), or accounting parentheses around it, a
 * currency sign inside them included ("($110)"): the refuter's finding 3.
 */
export function numberTokensOf(text) {
  const s = typeof text === 'string' ? text.normalize('NFKC') : '';
  const out = [];
  const re = /(?<![\p{L}\d.]|\d,)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?!\d|[.,]\d)/gu;
  for (const m of s.matchAll(re)) {
    const end = m.index + m[0].length;
    if (s[end] && FRACTION_SLASHES.includes(s[end]) && /\d/.test(s[end + 1] ?? '')) continue; // the top of a fraction
    let p = m.index - 1;
    if (s[p] && CURRENCY_SIGNS.includes(s[p])) p -= 1; // a currency sign between the sign and the digits
    const before = s[p] ?? '';
    const before2 = s[p - 1] ?? '';
    const negative = (before !== '' && MINUS_SIGNS.includes(before) && !/[\p{L}\p{N}]/u.test(before2)) || (before === '(' && s[end] === ')');
    out.push({ digits: `${m[1].replace(/,/g, '')}${m[2] ?? ''}`, negative });
  }
  return out;
}

/**
 * SQ-7: a token's digits without the zeros that END its decimal part, and without a decimal point left bare: "46.0"
 * and "46.00" → "46", "0.80" → "0.8"; a token with no decimal point is unchanged ("460" stays "460").
 */
const withoutDecimalZeros = (digits) => (digits.includes('.') ? digits.replace(/0+$/, '').replace(/\.$/, '') : digits);

/**
 * K-7: is `value` written inside `excerpt` as a whole number token — as written, with thousands separators, or with
 * the decimals given (48 in "48%", 3661 in "3,661", 51.4 in "51.4 billion") — and not as part of a longer number?
 * A negative value must be written as negative. The founder's ruling SQ-7 (Nov 26): a token that differs from the
 * value ONLY by trailing zeros after its decimal point is the same figure (46 in "$46.0", 0.8 in "0.80", 51.4 in
 * "51.40"); nothing else loosens ("460", "46.01" and "4.05" are other numbers). Checked on the author's text alone,
 * read under the word-for-word rule — the very string the matcher looks for (review H3: a dash or a soft hyphen the
 * rule changes cannot make the check and the match read two figures).
 */
export function figureInExcerpt(value, excerpt) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  const digits = String(Math.abs(value));
  if (!/^\d+(\.\d+)?$/.test(digits)) return false; // an exponent form ("5e-7") is never written in a report
  return numberTokensOf(underRule(excerpt)).some((t) => withoutDecimalZeros(t.digits) === digits && t.negative === (value < 0));
}
