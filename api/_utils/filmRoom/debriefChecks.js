// api/_utils/filmRoom/debriefChecks.js
//
// Film Room D2 — THE CHECKS (D2 spec §5; DW-4, DW-5). Pure. They run on the model's output against the day's digest:
// each line passes EVERY check or is DROPPED, with the reason code of the first check it fails, in the table's order —
//   1 label        the item names a label in the digest, and no earlier item named it
//   2 shape        the text is a string of 1 to 160 code points after trimming, with no line break and at most two
//                  sentence ends — counted by Unicode property (Amendment F DF-4: \p{Sentence_Terminal}, with the
//                  ellipsis; a run of terminals counts once); and (DF-5) no link (a URL or `www.`), no email-like
//                  token, no `<` or `>`
//   3 digit        no digit (any numeric character: a full-width or another script's digit, a fraction, a numeral)
//   4 number_word  no number word: the cardinals zero to twenty and their tens, hundred, thousand, million, billion,
//                  dozen, single, half, double, triple, twice, and the ordinals first to tenth — whole words, any case,
//                  with their inflections (sixes, dozens, halves, doubled, tripling). Each occurrence judged on its
//                  own (Amendment F DF-8, narrowing Amendment E DE-7): "one" passes only after "this", "that" or "no",
//                  before punctuation, the line's end or a word of a fixed list, in a line with no other number word
//   5 symbol       every token of two to five capitals that is a symbol in the app's directory (the symbol directory's
//                  tickers, api/_utils/rankingConfig.js TICKER_TO_SECTOR, and the crypto list) is that swap's sold or
//                  bought symbol, or appears in its quotations — `before` and `atSwap` (DF-9)
//   6 identifier   no identifier: THE inventory the pass hands in (dayDigest.js knownIdsOf — the battle, owner and
//                  agent ids and every opaque reference the tape holds, Amendment F DF-3) and every ID_SHAPES shape
//                  (src/utils/promptBoundText.js — the same policy the digest's quotations pass)
//   7 forbidden    no word or phrase on the Film Room's forbidden list (filmRoomCopy.js FORBIDDEN_WORDS — ONE
//                  production constant, the prompt's too), matched whole and case-insensitively, inflections included;
//                  and (DF-5) no verdict pattern: an evaluative word within two words before trade, swap, call, move,
//                  decision, choice, exit or entry, or an outcome phrase (VERDICT_WORDS, VERDICT_NOUNS, OUTCOME_PHRASES)
//   8 maker        (DF-5) on a swap the agent did not make, no claim of its decision: "I" and a decision verb in any
//                  tense form, or "my call", "my choice" …, unless "not", "n't" or "no" falls within the three words
//                  before the claim
// THE CONTRACT (Amendment F DF-5, the founder's decision): every shown line passed every check — no more. A sentence can
// still read as a judgment without a listed word, and a company named in words or a ticker in lower case is a declared
// limit; the instruction and the first nights' reading carry the rest.
// Checks 2 to 8 read the text as its disguises would be taken off (promptBoundText.js unmaskedText: NFKC — a
// full-width digit or capital becomes ASCII — and the invisible characters removed), the same with its combining marks
// taken off and the apostrophe's look-alikes read as one (bareText, the fix round's review P-7), and the text as written.
// NOTHING IS REWRITTEN: a kept line is the model's text exactly, trimmed; a line that fails is dropped, never repaired
// and never asked again. An output that is not `{ lines: [...] }` has no lines: `parse` (the record is `failed`).

import { FORBIDDEN_WORDS, FILM_ROOM_COPY } from '../../../src/screens/filmRoomV2/filmRoomCopy.js';
import { holdsIdentifier, unmaskedText } from '../../../src/utils/promptBoundText.js';
import { TICKER_TO_SECTOR } from '../rankingConfig.js';
import { VALID_CRYPTO_SYMBOLS } from '../agentCryptoAssets.js';
import { DEBRIEF_LINE_MAX } from './debriefPrompt.js';

/** The checks, in order, by their reason codes (§5). */
export const CHECK_REASONS = Object.freeze(['label', 'shape', 'digit', 'number_word', 'symbol', 'identifier', 'forbidden', 'maker']);
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
 * A forbidden word's forms (the review's P4): the word, its plurals, its "-ed" and "-ing" (bested), and for a word ending
 * in "e" its "-d" and "-ing" (graded, grading); and the same verdicts' other forms, listed: mistaken, proved, validates,
 * supports, should've …
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
  // "-ed" and "-ing" on every word (the refuter's N2: bested, besting, lessoned), and for a word ending in "e" its "-d"
  // and "-ing" (graded, grading)
  const out = [w, `${w}s`, `${w}es`, `${w}ed`, `${w}ing`, ...(FORBIDDEN_FORMS[w] || [])];
  if (w.endsWith('e')) out.push(`${w}d`, `${w.slice(0, -1)}ing`);
  return out;
}
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole words, any case: no letter or digit on either side. A phrase's spaces match any run of spaces or hyphens and dashes (P4). */
const wholeWords = (forms) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${forms.map((f) => escape(f).replace(/ /g, '[\\s\\-\\u2010-\\u2015]+')).join('|')})(?![\\p{L}\\p{N}])`, 'iu');
const NUMBER_WORD_ALL = new RegExp(wholeWords(NUMBER_WORDS.flatMap(numberFormsOf)).source, 'giu');
const FORBIDDEN = wholeWords(FORBIDDEN_WORDS.flatMap(forbiddenFormsOf));

/**
 * Amendment F DF-8 (narrowing Amendment E DE-7): "one" is no quantity in "This one wasn't my call" — so "one" passes
 * when all three hold: "this", "that" or "no" comes directly before it; directly after it comes punctuation, the end of
 * the line, or a word of ONE_FOLLOWERS; and the line holds no other number word. Each occurrence is judged on its own.
 */
export const ONE_FOLLOWERS = Object.freeze(['was', "wasn't", 'is', "isn't", 'has', "hasn't", 'had', "hadn't", 'did', "didn't", 'went', 'came', 'moved', 'stayed', 'held', 'got', 'felt', 'looked']);
const ONE_BEFORE = /(?:^|[^\p{L}\p{N}'’])(?:this|that|no)\s+$/iu;
// a follower's apostrophe in either form (wasn't, wasn’t); the longer forms first, and never the start of a longer word
// punctuation counts only where it ENDS the word — "one-share", "one/share" give a quantity (the review's P-4); a
// contraction's "'s" ("that one's mine") is the pronoun's
const ONE_AFTER = new RegExp(`^(?:$|['’]s(?![\\p{L}\\p{N}])|\\p{P}(?![\\p{L}\\p{N}])|\\s+(?:${[...ONE_FOLLOWERS].sort((a, b) => b.length - a.length).map((w) => escape(w).replace("'", "['’]")).join('|')})(?![\\p{L}\\p{N}'’]))`, 'iu');
/** Check 4 over one representation: every number-word occurrence fails it but a pronoun "one" alone in its line (DF-8). */
function holdsNumberWord(text) {
  const found = [...text.matchAll(NUMBER_WORD_ALL)];
  if (!found.length) return false;
  if (found.length > 1) return true;   // the line holds another number word: no "one" in it passes
  const [m] = found;
  const pronoun = m[0].toLowerCase() === 'one' && ONE_BEFORE.test(text.slice(0, m.index)) && ONE_AFTER.test(text.slice(m.index + m[0].length));
  return !pronoun;
}

/**
 * Amendment F DF-5 — check 7's verdict patterns: an evaluative word within two words before a decision noun ("an
 * excellent trade", "the right call", "a smart little move"), and the outcome phrases. Each word whole, any case; a
 * phrase's space any run of spaces, hyphens or dashes.
 */
export const VERDICT_WORDS = Object.freeze(['good', 'great', 'excellent', 'smart', 'wise', 'clever', 'solid', 'strong', 'right', 'bad', 'poor', 'terrible', 'wrong', 'weak', 'dumb', 'costly']);
export const VERDICT_NOUNS = Object.freeze(['trade', 'swap', 'call', 'move', 'decision', 'choice', 'exit', 'entry']);
export const OUTCOME_PHRASES = Object.freeze(['paid off', 'worked out', 'backfired', 'cost me', 'cost us', 'helped me', 'helped us', 'hurt me', 'hurt us', 'nailed it', 'blew it']);
// between the words: any run of spaces and punctuation ("a good, clean move" — the review's P-3); the one word between
// them may be hyphenated ("a good well-timed move")
const JOIN = '[\\s\\p{P}\\p{S}]+';   // symbols too ("a good 👍 move" — the refuter's round)
const nounForms = VERDICT_NOUNS.flatMap((n) => [n, n === 'entry' ? 'entries' : (n === 'choice' ? 'choices' : `${n}s`)]);
const VERDICT_PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])(?:${VERDICT_WORDS.join('|')})(?:${JOIN}[\\p{L}\\p{N}'’]+(?:[\\-\\u2010-\\u2015][\\p{L}\\p{N}'’]+)*)?${JOIN}(?:${nounForms.join('|')})(?![\\p{L}\\p{N}])`, 'iu');
const OUTCOME = wholeWords(OUTCOME_PHRASES);

/**
 * Amendment F DF-5 — check 8, `maker`: on a swap the agent did not make, the agent claims no decision — "I" and one of
 * DECISION_VERBS in any tense form (made, chose, decided, picked, sold, bought, swapped, moved, rotated, exited, traded),
 * or "my" and one of MY_DECISIONS. "I" may carry its contraction (I've, I'd, I'll, I'm) and up to three bridging words
 * between it and the verb — CLAIM_BRIDGE or any "-ly" word ("I have sold", "I have been selling", "I would have
 * already sold", "I quickly sold", "I alone chose"); "my" may take one word before its noun ("my own call", "my final
 * decision"). A claim is not a claim when "not", "n't" or "no" falls within the three words before it IN ITS OWN CLAUSE
 * ("This one wasn't my call"; but "It wasn't close. I chose CRWD." is a claim — the review's P-5: a window that ends
 * at . ; : ! ? , or a dash only drops more). A denial inside the verb phrase ("I didn't sell", "I did not sell") is no
 * claim at all: the bridge holds no negative.
 */
export const DECISION_VERBS = Object.freeze({
  make: ['make', 'makes', 'made', 'making'], choose: ['choose', 'chooses', 'chose', 'chosen', 'choosing'],
  decide: ['decide', 'decides', 'decided', 'deciding'], pick: ['pick', 'picks', 'picked', 'picking'],
  sell: ['sell', 'sells', 'sold', 'selling'], buy: ['buy', 'buys', 'bought', 'buying'],
  swap: ['swap', 'swaps', 'swapped', 'swapping'], move: ['move', 'moves', 'moved', 'moving'],
  rotate: ['rotate', 'rotates', 'rotated', 'rotating'], exit: ['exit', 'exits', 'exited', 'exiting'],
  trade: ['trade', 'trades', 'traded', 'trading'],
});
export const MY_DECISIONS = Object.freeze(['call', 'choice', 'decision', 'pick', 'move', 'trade']);
// the refuter's round: "I'll be selling", "I'd've sold", "I still sold", "I, too, sold" — contractions twice, four
// bridging words, a comma between them
export const CLAIM_BRIDGE = Object.freeze(['am', 'was', 'have', 'has', 'had', 'been', 'be', 'being', 'will', 'shall', 'would', 'did', 'do', 'just', 'then', 'also', 'already', 'finally', 'myself', 'alone', 'now', 'still', 'later', 'soon', 'even', 'instead', 'too']);
const I_CLAIM = new RegExp(`(?<![\\p{L}\\p{N}'’])i(?:['’](?:m|ve|d|ll|re)){0,2}(?:[\\s,]+(?:${CLAIM_BRIDGE.join('|')}|\\p{L}+ly)){0,4},?\\s+(?:${Object.values(DECISION_VERBS).flat().join('|')})(?![\\p{L}\\p{N}])`, 'giu');
const MY_CLAIM = new RegExp(`(?<![\\p{L}\\p{N}])my(?:\\s+[\\p{L}'’\\-]+)?\\s+(?:${MY_DECISIONS.map((w) => `${w}s?`).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
const NEGATION = /^(?:not|no|.*n['’]t)$/iu;
/** Where a clause ends, for the negation window: . ; : ! ? … , or a dash. */
const CLAUSE_END = /[.;:!?…,‐-―]/u;
/** Does `text` hold a claim of the decision — one not negated within the three words before it, in its own clause? */
function claimsDecision(text) {
  for (const re of [I_CLAIM, MY_CLAIM]) {
    for (const m of text.matchAll(re)) {
      const head = text.slice(0, m.index);
      let cut = -1;
      for (let i = head.length - 1; i >= 0; i -= 1) if (CLAUSE_END.test(head[i])) { cut = i; break; }
      const before = head.slice(cut + 1).split(/\s+/u).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’]+$/gu, '')).filter(Boolean).slice(-3);
      if (!before.some((w) => NEGATION.test(w))) return true;
    }
  }
  return false;
}
/** The maker words of the agent's own swap (the digest's maker field, copy table): check 8 reads every other maker. */
const AGENT_MAKER = FILM_ROOM_COPY.debrief.makers.agent;

/**
 * Amendment F DF-5 — check 2's links, emails and markup: a URL — any scheme and "://" (spaces around its parts too), or
 * a web, file, script, data or mail scheme and its colon alone ("https:evil.io", "data:text/html" — the review's P-9) —
 * or "www."; an email-like token (a word, "@", a word); "<" or ">".
 */
const LINK = /(?<![\p{L}\p{N}])(?:[a-z][a-z0-9+.-]*\s*:\s*\/\s*\/|(?:https?|wss?|ftp|file|data|javascript|mailto)\s*:)|(?<![\p{L}\p{N}])www\./iu;
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+/u;
const MARKUP = /[<>]/u;
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
 * §5 check 2: the sentence ends — Amendment F DF-4 (Astra's F4): by Unicode property, \p{Sentence_Terminal} (. ! ? and
 * every script's and form's terminal: the Arabic question mark, the ideographic full stop, ‼, ‽ …), with the ellipsis
 * (which the property leaves out) as before. A RUN of terminals counts once, whitespace between them included ("?!",
 * "? !", ". . ."). EVERY run counts, whatever follows it (the fix round's review, P-1: a dash, an emoji or a mark glued
 * after a terminal hides no end), but for the exemptions DF-4 keeps: a run of periods directly before a letter or a
 * digit ends a sentence only before a CAPITAL, and not after a single letter or an abbreviation ("U.S", "e.g",
 * "node.js", "3.5" go on); an ellipsis inside the text, the sentence going on in lower case ("I waited… then sold");
 * the period of a common abbreviation (vs., U.S.).
 */
const TERM = '[\\p{Sentence_Terminal}…]';
const TERMINAL_RUN = new RegExp(`${TERM}(?:\\s*${TERM})*`, 'gu');
const ABBREVIATIONS = new Set(['vs', 'etc', 'e.g', 'i.e', 'mr', 'mrs', 'ms', 'dr', 'inc', 'corp', 'co', 'jr', 'sr', 'st', 'u.s', 'u.k', 'a.m', 'p.m', 'approx', 'est']);
function sentenceEndsOf(text) {
  let n = 0;
  const end = text.trimEnd().length;
  for (const m of text.matchAll(TERMINAL_RUN)) {
    const run = m[0].replace(/\s+/gu, '');
    const after = text.slice(m.index + m[0].length);
    const atEnd = m.index + m[0].length >= end;
    const word = text.slice(0, m.index).split(/\s/).pop();
    // directly before a letter or a digit: a run of periods ends a sentence only before a capital, and never after a
    // single letter or an abbreviation
    if (/^[\p{L}\p{N}]/u.test(after) && /^\.+$/u.test(run) && (!/^\p{Lu}/u.test(after) || [...word.replace(/[^\p{L}]/gu, '')].length < 2 || ABBREVIATIONS.has(word.toLowerCase()))) continue;
    // an ellipsis inside the text, the sentence going on in lower case ("I waited… then sold"); before a capital it ends
    // one (the refuter's N1: "went quiet… I let it go… AAPL had the pull…" is three)
    const next = after.trimStart().charAt(0);
    if (!atEnd && /^(?:…+|\.{2,})$/u.test(run) && /\p{Ll}/u.test(next)) continue;
    if (run === '.' && ABBREVIATIONS.has(word.toLowerCase())) continue;
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

/** The symbols a swap's line may name: its own two, and every capital token in its quotations — `before` and `atSwap` (DF-9). */
function allowedSymbolsOf(swap) {
  const out = new Set([swap?.sold, swap?.bought].filter((s) => typeof s === 'string' && s));
  for (const said of [swap?.before, swap?.atSwap]) {
    for (const k of ['rationale', 'hypothesis']) if (typeof said?.[k] === 'string') for (const t of capitalTokens(unmaskedText(said[k]))) out.add(t);
  }
  return out;
}

/**
 * The fix round's review (P-7): a third representation the checks read — the unmasked text with its combining marks
 * taken off (NFD, \p{M} removed: "fïve", "NVDÁ", "bėst" read as "five", "NVDA", "best") and the apostrophe's look-alikes
 * (‘ ‛ ′ ‵ ` ´ ʼ) read as one — folded on the text as written, before NFKC turns "´" into a space and a mark.
 * Checked only, never shown: a kept line is still the model's text exactly.
 */
const bareText = (text) => unmaskedText(String(text).replace(/[‘‛′‵`´ʼ]/gu, '\'')).normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');

/** The first check a trimmed text fails (checks 2 to 8), or null when it passes them all. */
export function failingCheckOf(text, swap, knownIds = []) {
  if (typeof text !== 'string') return 'shape';
  const n = codePoints(text);
  if (n < 1 || n > DEBRIEF_LINE_MAX || LINE_BREAK.test(text)) return 'shape';
  if (INVISIBLE_OR_CONTROL.test(text) || !ANY_LETTER.test(text) || NON_LATIN_LETTER.test(text)) return 'shape';
  const plain = unmaskedText(text);
  const bare = bareText(text);
  const reps = [text, plain, bare];
  const both = (re) => reps.some((r) => re.test(r));
  if (Math.max(...reps.map(sentenceEndsOf)) > MAX_SENTENCE_ENDS) return 'shape';
  if (both(LINK) || both(EMAIL) || both(MARKUP)) return 'shape';
  if (both(DIGIT)) return 'digit';
  if (reps.some(holdsNumberWord)) return 'number_word';
  const allowed = allowedSymbolsOf(swap);
  for (const t of new Set(reps.flatMap(capitalTokens))) if (DIRECTORY_SYMBOLS.has(t) && !allowed.has(t)) return 'symbol';
  if (holdsIdentifier(text, knownIds)) return 'identifier';
  if (both(FORBIDDEN) || both(VERDICT_PATTERN) || both(OUTCOME)) return 'forbidden';
  if (swap?.maker !== AGENT_MAKER && reps.some(claimsDecision)) return 'maker';
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
