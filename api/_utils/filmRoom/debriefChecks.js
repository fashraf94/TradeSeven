// api/_utils/filmRoom/debriefChecks.js
//
// Film Room D2 — THE CHECKS (D2 spec §5; DW-4, DW-5). Pure. They run on the model's output against the day's digest:
// each line passes EVERY check or is DROPPED, with the reason code of the first check it fails, in the table's order —
//   1 label        the item names a label in the digest, and no earlier item named it
//   2 shape        the text is a string of 1 to 160 code points after trimming, with no line break and at most two
//                  sentence ends
//   3 digit        no digit (any numeric character: a full-width or another script's digit, a fraction, a numeral)
//   4 number_word  no number word: the cardinals zero to twenty and their tens, hundred, thousand, million, billion,
//                  dozen, single, half, double, triple, twice, and the ordinals first to tenth — whole words, any case,
//                  with their inflections (sixes, dozens, halves, doubled, tripling)
//   5 symbol       every token of two to five capitals that is a symbol in the app's directory (the symbol directory's
//                  tickers, api/_utils/rankingConfig.js TICKER_TO_SECTOR, and the crypto list) is that swap's sold or
//                  bought symbol, or appears in its quotations
//   6 identifier   no identifier: the exact ids the pass knows (battle, owner, agent) and every ID_SHAPES shape
//                  (src/utils/promptBoundText.js — the same policy the digest's quotations pass)
//   7 forbidden    no word or phrase on the Film Room's forbidden list (filmRoomCopy.js FORBIDDEN_WORDS — ONE
//                  production constant, the prompt's too), matched whole and case-insensitively, inflections included
// Checks 3 to 7 read the text as its disguises would be taken off (promptBoundText.js unmaskedText: NFKC — a
// full-width digit or capital becomes ASCII — and the invisible characters removed), and the text as written.
// NOTHING IS REWRITTEN: a kept line is the model's text exactly, trimmed; a line that fails is dropped, never repaired
// and never asked again. An output that is not `{ lines: [...] }` has no lines: `parse` (the record is `failed`).

import { FORBIDDEN_WORDS } from '../../../src/screens/filmRoomV2/filmRoomCopy.js';
import { holdsIdentifier, unmaskedText } from '../../../src/utils/promptBoundText.js';
import { TICKER_TO_SECTOR } from '../rankingConfig.js';
import { VALID_CRYPTO_SYMBOLS } from '../agentCryptoAssets.js';
import { DEBRIEF_LINE_MAX } from './debriefPrompt.js';

/** The checks, in order, by their reason codes (§5). */
export const CHECK_REASONS = Object.freeze(['label', 'shape', 'digit', 'number_word', 'symbol', 'identifier', 'forbidden']);
/** §5 check 2: at most two sentence ends. */
export const MAX_SENTENCE_ENDS = 2;

/** §5 check 4: the number words — the spec's list, literally. */
const CARDINALS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TENS = ['thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
export const NUMBER_WORDS = Object.freeze([...CARDINALS, ...TENS, 'hundred', 'thousand', 'million', 'billion', 'dozen', 'single', 'half', 'double', 'triple', 'twice', ...ORDINALS]);

/**
 * A number word's forms (the review's P3, P5): the word; its plurals (-s, -es; a "-y" word's "-ies": twenties, forties);
 * its ordinals (-th: eleventh, hundredth; a "-y" word's "-ieth": twentieth; twelfth); "-fold" and "-ly" (twofold,
 * firstly); and for a word ending in "e", "-d" and "-ing" (doubled, tripling) — never a bare "-d" or "-ed" that makes
 * another word ("ten" + "d" is "tend"). half → halves, halved, halving; forty's common misspelling, fourty.
 */
function numberFormsOf(w) {
  const out = [w, `${w}s`, `${w}es`, `${w}th`, `${w}ths`, `${w}fold`, `${w}ly`];
  if (w.endsWith('y')) { const s = w.slice(0, -1); out.push(`${s}ies`, `${s}ieth`, `${s}ieths`); }
  if (w.endsWith('e')) out.push(`${w}d`, `${w.slice(0, -1)}ing`);
  if (w === 'half') out.push('halves', 'halved', 'halving');
  if (w === 'twelve') out.push('twelfth', 'twelfths');
  if (w === 'forty') out.push('fourty', 'fourties', 'fourtieth');
  return out;
}
/**
 * A forbidden word's forms (the review's P4): the word, its plurals, and for a word ending in "e" its "-d" and "-ing"
 * (graded, grading); and the same verdicts' other forms, listed: mistaken, proved, validates, supports, should've …
 * ("support" alone stays allowed — it is the market's own word for a price level).
 */
const FORBIDDEN_FORMS = Object.freeze({
  mistake: ['mistaken', 'mistakenly'],
  proven: ['prove', 'proves', 'proved', 'proving'],
  validated: ['validate', 'validates', 'validating', 'validation'],
  supported: ['supports', 'supporting'],
  'should have': ["should've", 'should’ve', 'shoulda'],
});
function forbiddenFormsOf(w) {
  const out = [w, `${w}s`, `${w}es`, ...(FORBIDDEN_FORMS[w] || [])];
  if (w.endsWith('e')) out.push(`${w}d`, `${w.slice(0, -1)}ing`);
  return out;
}
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole words, any case: no letter or digit on either side. A phrase's spaces match any run of spaces or hyphens and dashes (P4). */
const wholeWords = (forms) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${forms.map((f) => escape(f).replace(/ /g, '[\\s\\-\\u2010-\\u2015]+')).join('|')})(?![\\p{L}\\p{N}])`, 'iu');
const NUMBER_WORD = wholeWords(NUMBER_WORDS.flatMap(numberFormsOf));
const FORBIDDEN = wholeWords(FORBIDDEN_WORDS.flatMap(forbiddenFormsOf));
/** §5 check 3: any numeric character, in any script. */
const DIGIT = /\p{N}/u;
/** §5 check 2: a line break of any kind. */
const LINE_BREAK = new RegExp('[\\n\\r\\u0085\\u2028\\u2029\\v\\f]');
/**
 * §5 check 2 — the review's P1 and P7: a line the player would not read as written is no shape a line may have — an
 * invisible or a direction-control character (any format character, any default-ignorable code point: a right-to-left
 * override reverses what the checks read), no visible letter at all, or a letter outside the Latin script (a Cyrillic
 * or Greek look-alike passes for a Latin one).
 */
const INVISIBLE_OR_CONTROL = /[\p{Cf}\p{Default_Ignorable_Code_Point}]/u;
const ANY_LETTER = /\p{L}/u;
const NON_LATIN_LETTER = /(?![\p{Script=Latin}])\p{L}/u;
/**
 * §5 check 2: the sentence ends (the review's P5, P6) — a run of terminal punctuation, in any of its forms (. ! ? and
 * their full-width, ideographic and doubled forms), closing quotes and brackets after it, at a space or the text's end.
 * Not an end: an ellipsis inside the text ("I waited… then sold"), or the period of a common abbreviation (vs., U.S.).
 */
const TERMINAL_RUN = /[.!?。！？．｡‼⁇⁈⁉﹒﹖﹗…]+["'”’»›」』)\]]*(?=\s|$)/gu;
const ABBREVIATIONS = new Set(['vs', 'etc', 'e.g', 'i.e', 'mr', 'mrs', 'ms', 'dr', 'inc', 'corp', 'co', 'jr', 'sr', 'st', 'u.s', 'u.k', 'a.m', 'p.m', 'approx', 'est']);
function sentenceEndsOf(text) {
  let n = 0;
  const end = text.trimEnd().length;
  for (const m of text.matchAll(TERMINAL_RUN)) {
    const run = m[0].replace(/["'”’»›」』)\]]+$/, '');
    const atEnd = m.index + m[0].length >= end;
    if (!atEnd && /^(?:…+|\.{2,})$/.test(run)) continue;   // an ellipsis inside the text
    if (run === '.') {
      const word = text.slice(0, m.index).split(/\s/).pop().toLowerCase();
      if (ABBREVIATIONS.has(word)) continue;
    }
    n += 1;
  }
  return n;
}

/** The app's symbol directory: the stock tickers (the symbol directory, rankingConfig.js) and the crypto list. */
export const DIRECTORY_SYMBOLS = Object.freeze(new Set([...Object.keys(TICKER_TO_SECTOR), ...VALID_CRYPTO_SYMBOLS]));

const codePoints = (s) => [...s].length;
/**
 * The tokens of two to five capitals — whole runs of capitals, no letter or digit on either side — read as the symbol
 * directory writes one (the review's P8): with its class suffix ("BRK-B": both "BRK-B" and "BRK" are read) and through
 * a plural or possessive "s" ("the NVDAs", "NVDA's").
 */
function capitalTokens(text) {
  const out = [];
  for (const m of text.matchAll(/(?<![\p{L}\p{N}])([A-Z]{1,5})([.-][A-Z]{1,2})?(?:['’]?s)?(?![\p{L}\p{N}])/gu)) {
    if (m[1].length >= 2) out.push(m[1]);
    if (m[2]) out.push(`${m[1]}${m[2]}`, `${m[1]}${m[2].replace('.', '-')}`, `${m[1]}${m[2].replace('-', '.')}`);
  }
  return out;
}

/** The symbols a swap's line may name: its own two, and every capital token in its quotations. */
function allowedSymbolsOf(swap) {
  const out = new Set([swap?.sold, swap?.bought].filter((s) => typeof s === 'string' && s));
  for (const said of [swap?.before, swap?.after]) {
    for (const k of ['rationale', 'hypothesis']) if (typeof said?.[k] === 'string') for (const t of capitalTokens(unmaskedText(said[k]))) out.add(t);
  }
  return out;
}

/** The first check a trimmed text fails (checks 2 to 7), or null when it passes them all. */
export function failingCheckOf(text, swap, knownIds = []) {
  if (typeof text !== 'string') return 'shape';
  const n = codePoints(text);
  if (n < 1 || n > DEBRIEF_LINE_MAX || LINE_BREAK.test(text)) return 'shape';
  if (INVISIBLE_OR_CONTROL.test(text) || !ANY_LETTER.test(text) || NON_LATIN_LETTER.test(text)) return 'shape';
  const plain = unmaskedText(text);
  if (Math.max(sentenceEndsOf(text), sentenceEndsOf(plain)) > MAX_SENTENCE_ENDS) return 'shape';
  const both = (re) => re.test(text) || re.test(plain);
  if (both(DIGIT)) return 'digit';
  if (both(NUMBER_WORD)) return 'number_word';
  const allowed = allowedSymbolsOf(swap);
  for (const t of new Set([...capitalTokens(text), ...capitalTokens(plain)])) if (DIRECTORY_SYMBOLS.has(t) && !allowed.has(t)) return 'symbol';
  if (holdsIdentifier(text, knownIds)) return 'identifier';
  if (both(FORBIDDEN)) return 'forbidden';
  return null;
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The checks over one answer (§5).
 * @param {object} output    the model's parsed answer
 * @param {object} digest    the day's digest (its swaps, by label)
 * @param {{ knownIds?: string[] }} [opts]  the exact ids the pass knows (battle, owner, agent)
 * @returns {{ ok: true, lines: {label: string, text: string}[], dropped: {label: string|null, reason: string}[] } | { ok: false, reason: 'parse', lines: [], dropped: [] }}
 */
export function checkDebriefLines(output, digest, { knownIds = [] } = {}) {
  if (!isObj(output) || !Array.isArray(output.lines) || Object.keys(output).some((k) => k !== 'lines')) return { ok: false, reason: 'parse', lines: [], dropped: [] };
  const byLabel = new Map((Array.isArray(digest?.swaps) ? digest.swaps : []).map((s) => [s.label, s]));
  const named = new Set();
  const lines = [];
  const dropped = [];
  for (const item of output.lines) {
    const swapLabel = isObj(item) && typeof item.swap === 'string' ? item.swap : null;
    // a label the digest does not hold is never stored (the model's text in that field could hold anything)
    const label = swapLabel !== null && byLabel.has(swapLabel) ? swapLabel : null;
    if (label === null || named.has(label)) { dropped.push({ label, reason: 'label' }); continue; }
    named.add(label);
    const extra = Object.keys(item).some((k) => k !== 'swap' && k !== 'text');
    const text = typeof item.text === 'string' ? item.text.trim() : null;
    const reason = extra ? 'shape' : failingCheckOf(text, byLabel.get(label), knownIds);
    if (reason) { dropped.push({ label, reason }); continue; }
    lines.push({ label, text });
  }
  return { ok: true, lines, dropped };
}
