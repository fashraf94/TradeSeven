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

/** A word's inflected forms: -s, -es, -d, -ed, -ing, and for a word ending in "e" the "e" dropped (doubled, tripling); half → halves, halved, halving. */
function formsOf(word) {
  const out = [word, `${word}s`, `${word}es`, `${word}d`, `${word}ed`, `${word}ing`];
  if (word.endsWith('e')) out.push(`${word.slice(0, -1)}ed`, `${word.slice(0, -1)}ing`);
  if (word === 'half') out.push('halves', 'halved', 'halving');
  return out;
}
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole words, any case: no letter or digit on either side. A phrase's spaces match any run of whitespace. */
const wholeWords = (words) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.flatMap((w) => formsOf(w)).map((f) => escape(f).replace(/ /g, '\\s+')).join('|')})(?![\\p{L}\\p{N}])`, 'iu');
const NUMBER_WORD = wholeWords(NUMBER_WORDS);
const FORBIDDEN = wholeWords(FORBIDDEN_WORDS);
/** §5 check 3: any numeric character, in any script. */
const DIGIT = /\p{N}/u;
/** §5 check 2: a line break of any kind. */
const LINE_BREAK = /[\n\r\u0085\u2028\u2029\v\f]/;
/** §5 check 2: a sentence end — a run of . ! ? … (closing quotes and brackets after it) at a space or the text's end. */
const SENTENCE_END = /[.!?…]+["'”’)\]]*(?=\s|$)/gu;

/** The app's symbol directory: the stock tickers (the symbol directory, rankingConfig.js) and the crypto list. */
export const DIRECTORY_SYMBOLS = Object.freeze(new Set([...Object.keys(TICKER_TO_SECTOR), ...VALID_CRYPTO_SYMBOLS]));

const codePoints = (s) => [...s].length;
/** The tokens of two to five capitals — whole runs of capitals, no letter or digit on either side. */
const capitalTokens = (text) => text.match(/(?<![\p{L}\p{N}])[A-Z]{2,5}(?![\p{L}\p{N}])/gu) || [];

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
  if (n < 1 || n > DEBRIEF_LINE_MAX || LINE_BREAK.test(text) || (text.match(SENTENCE_END) || []).length > MAX_SENTENCE_ENDS) return 'shape';
  const plain = unmaskedText(text);
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
