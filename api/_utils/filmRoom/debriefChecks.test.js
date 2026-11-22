// api/_utils/filmRoom/debriefChecks.test.js
//
// Film Room D2 item 4 — THE CHECKS (D2 spec §5; DW-4, DW-5). One row per check and reason code, at each bound and one
// over, against hostile model output. Every row's cases are written out literally — never generated from the
// production lists (a word dropped from a list must fail a row). A failing line is DROPPED, never repaired.

import { describe, it, expect } from 'vitest';
import { checkDebriefLines, CHECK_REASONS, NUMBER_WORDS, DIRECTORY_SYMBOLS, MAX_SENTENCE_ENDS } from './debriefChecks.js';
import { DEBRIEF_LINE_MAX } from './debriefPrompt.js';
import { FORBIDDEN_WORDS } from '../../../src/screens/filmRoomV2/filmRoomCopy.js';

const DIGEST = {
  day: { final: false },
  archetype: 'Momentum',
  swaps: [
    { label: 's1', time: '12:45 PM', maker: 'the stall rule', sold: 'MSFT', bought: 'CRWD', after: { saidBy: 'the agent', at: '12:45 PM', rationale: 'The rule took MSFT; PLTR is still the one I wait on.' } },
    { label: 's2', time: '2:00 PM', maker: 'your agent', sold: 'DE', bought: 'PLTR' },
  ],
};
const KNOWN = ['b-sep23-fixture', 'owner-1', 'agent-1', 'battleQuxAlpha', 'ownerBravoKilo'];
const run = (lines) => checkDebriefLines({ lines }, DIGEST, { knownIds: KNOWN });
/** One line for s1: kept (null) or the reason it was dropped. */
const verdict = (text, swap = 's1') => { const r = run([{ swap, text }]); return r.lines.length ? null : r.dropped[0].reason; };

describe('the table (§5): seven checks, in order', () => {
  it('the reason codes, in the table\'s order', () => {
    expect(CHECK_REASONS).toEqual(['label', 'shape', 'digit', 'number_word', 'symbol', 'identifier', 'forbidden']);
  });
  it('a clean line passes every check and is kept exactly, trimmed', () => {
    const r = run([{ swap: 's1', text: "  That wasn't my call. MSFT had stopped moving.  " }]);
    expect(r).toEqual({ ok: true, lines: [{ label: 's1', text: "That wasn't my call. MSFT had stopped moving." }], dropped: [] });
  });
  it("AS BUILT, A QUESTION: the spec's own §0 example — \"This one wasn't my call. MSFT had stopped moving.\" — is dropped by check 4 (`one` is a cardinal on §5's list; the report asks)", () => {
    expect(verdict("This one wasn't my call. MSFT had stopped moving.")).toBe('number_word');
  });
  it('a line failing two checks is dropped with the FIRST in the table\'s order', () => {
    expect(verdict('Best move at 4 PM.')).toBe('digit');
    expect(verdict('Two NVDA lessons.')).toBe('number_word');
    expect(verdict('NVDA was the best.')).toBe('symbol');
  });
});

describe('1 label — a label in the digest, and no earlier item named it', () => {
  it('a label the digest does not hold: dropped, and the model\'s text in that field is never stored', () => {
    expect(run([{ swap: 's9', text: 'Fine.' }]).dropped).toEqual([{ label: null, reason: 'label' }]);
    expect(run([{ swap: 'b-sep23-fixture', text: 'Fine.' }]).dropped).toEqual([{ label: null, reason: 'label' }]);
  });
  it('a label named twice: the first item is judged, the second dropped as `label` — even when the first was dropped', () => {
    expect(run([{ swap: 's1', text: 'Fine.' }, { swap: 's1', text: 'Also fine.' }])).toEqual({ ok: true, lines: [{ label: 's1', text: 'Fine.' }], dropped: [{ label: 's1', reason: 'label' }] });
    expect(run([{ swap: 's1', text: 'At 4.' }, { swap: 's1', text: 'Fine.' }]).dropped).toEqual([{ label: 's1', reason: 'digit' }, { label: 's1', reason: 'label' }]);
  });
  it('no swap field, a non-string swap, a non-object item: `label`', () => {
    expect(run([{ text: 'Fine.' }, { swap: 1, text: 'Fine.' }, 'Fine.', null]).dropped.map((d) => d.reason)).toEqual(['label', 'label', 'label', 'label']);
  });
});

describe('2 shape — 1 to 160 code points after trimming, no line break, at most two sentence ends', () => {
  it('the bound: 160 code points kept, 161 dropped — an astral character counts once; the trim comes first', () => {
    expect(DEBRIEF_LINE_MAX).toBe(160);
    expect(verdict('a'.repeat(160))).toBeNull();
    expect(verdict('a'.repeat(161))).toBe('shape');
    expect(verdict(`${'a'.repeat(159)}😀`)).toBeNull();
    expect(verdict(`${'a'.repeat(160)}😀`)).toBe('shape');
    expect(verdict(`   ${'a'.repeat(160)}   `)).toBeNull();
  });
  it('empty, or only spaces: dropped', () => {
    expect(verdict('')).toBe('shape');
    expect(verdict('   ')).toBe('shape');
    expect(verdict('a')).toBeNull();
  });
  it('a line break of any kind inside the text: dropped', () => {
    for (const br of ['\n', '\r', '\u2028', '\u2029', '\u0085']) expect(verdict(`Rule took it.${br}I waited.`), JSON.stringify(br)).toBe('shape');
    expect(verdict('Rule took it.\n')).toBeNull();   // trailing — trimmed away
  });
  it('sentence ends: two kept, three dropped; an ellipsis or "?!" is one end; a mid-word period is none', () => {
    expect(MAX_SENTENCE_ENDS).toBe(2);
    expect(verdict('The rule took it. I was waiting on PLTR.')).toBeNull();
    expect(verdict('The rule took it. I waited. Then it moved.')).toBe('shape');
    expect(verdict('The rule took it… I waited?!')).toBeNull();
    expect(verdict('Did it move? No. It sat.')).toBe('shape');
    expect(verdict('Out went MSFT, in came CRWD — the rule’s call.')).toBeNull();
  });
  it('a text that is not a string, or an item with a field beyond swap and text: `shape`', () => {
    expect(run([{ swap: 's1', text: 42 }]).dropped).toEqual([{ label: 's1', reason: 'shape' }]);
    expect(run([{ swap: 's1', text: 'Fine.', note: 'x' }]).dropped).toEqual([{ label: 's1', reason: 'shape' }]);
  });
});

describe('3 digit — no numeric character in any script', () => {
  it('an ASCII digit, a full-width digit, another script\'s digit, a fraction, a superscript, a numeral', () => {
    for (const t of ['It moved 4 points.', 'It moved ４ points.', 'It moved ٣ points.', 'Half: ½ of it.', 'Up x² there.', 'Chapter Ⅳ of it.']) expect(verdict(t), t).toBe('digit');
    expect(verdict('It moved some points.')).toBeNull();
  });
});

describe('4 number_word — no number word, no ordinal, whole words, any case, inflected', () => {
  it('every word on the spec\'s list (written out here) is dropped', () => {
    const SPEC = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
      'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million', 'billion', 'dozen', 'single', 'half', 'double', 'triple', 'twice',
      'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
    expect([...NUMBER_WORDS].sort()).toEqual([...SPEC].sort());
    for (const w of SPEC) expect(verdict(`It was ${w} of them.`), w).toBe('number_word');
  });
  it('any case, compounds and inflections: Twenty, twenty-one, dozens, halves, doubled, tripling, sixes, tens', () => {
    for (const t of ['Twenty went out.', 'It was twenty-one.', 'Dozens of checks.', 'Two halves.', 'It doubled.', 'Tripling it.', 'All sixes.', 'In the tens.']) expect(verdict(t), t).toBe('number_word');
  });
  it('a word that only CONTAINS one is kept: someone, often, tone, stone, tenure, money, weight', () => {
    for (const t of ['Someone else made it.', 'It often stalls.', 'The tone held.', 'A stone wall.', 'My tenure there.', 'The money moved.', 'Its weight shifted.']) expect(verdict(t), t).toBeNull();
  });
});

describe('5 symbol — a directory symbol only if it is the swap\'s own or in its quotations', () => {
  it('the directory holds the tickers and the crypto list', () => {
    for (const s of ['MSFT', 'CRWD', 'PLTR', 'NVDA', 'ETN', 'DE']) expect(DIRECTORY_SYMBOLS.has(s), s).toBe(true);
    expect(DIRECTORY_SYMBOLS.has('BTC')).toBe(true);
    expect(DIRECTORY_SYMBOLS.has('CPU')).toBe(false);
  });
  it('another directory symbol: dropped; the swap\'s own and one in its quotations: kept', () => {
    expect(verdict('NVDA ran instead.')).toBe('symbol');
    expect(verdict('The rule took MSFT for CRWD.')).toBeNull();
    expect(verdict('I was still waiting on PLTR.')).toBeNull();          // PLTR is in s1's quotation
    expect(verdict('I was still waiting on PLTR.', 's2')).toBeNull();    // s2 bought PLTR
    expect(verdict('MSFT had gone by then.', 's2')).toBe('symbol');      // not s2's, not in its words
    expect(verdict('BTC was not in it.')).toBe('symbol');
  });
  it('capitals that are no directory symbol pass (CPU, OK); a full-width symbol is read as ASCII', () => {
    expect(verdict('The CPU side was quiet. OK by me.')).toBeNull();
    expect(verdict('ＮＶＤＡ ran instead.')).toBe('symbol');
  });
});

describe('6 identifier — no id the pass knows, and no shape the platform mints', () => {
  // most ids hold a digit, and check 3 drops those first (the table's order); these rows reach check 6 with ids and
  // shapes that hold none
  it('an id holding a digit is dropped by `digit` first — the table\'s order', () => {
    expect(verdict('On b-sep23-fixture it held.')).toBe('digit');
    expect(verdict('See Ab3dEf7hIj9kLm1nOp5q there.')).toBe('digit');
  });
  it('an exact id the pass knows (the battle, the owner, the agent): dropped', () => {
    expect(verdict('On battleQuxAlpha it held.')).toBe('identifier');
    expect(verdict('Asked by ownerBravoKilo then.')).toBe('identifier');
  });
  it('a platform shape with no digit: a live-draft group, a prefixed hex, a base-36 fallback, a mandate manager', () => {
    for (const t of ['Group lds_slotA met.', 'Book pf_abcdefabcdefabcdef held.', 'Op op_abcdef_abcdefgh ran.', 'Manager mgr_momentum_abcdefabcdefabcd ran.']) expect(verdict(t), t).toBe('identifier');
  });
  it('an id split by an invisible character: dropped \u2014 by `shape` now, one check earlier (the review\'s P1: no line holds an invisible character)', () => {
    expect(verdict('On battle\u200BQuxAlpha it held.')).toBe('shape');
  });
  it('prose passes: no id, no shape', () => {
    expect(verdict('The rule took it while I waited.')).toBeNull();
  });
});

describe('7 forbidden — the Film Room\'s list, whole and case-insensitive', () => {
  it('the list is the one production constant, written out here as the spec lists it', () => {
    expect(FORBIDDEN_WORDS).toEqual(['biggest', 'best', 'worst', 'mistake', 'should have', 'missed', 'good trade', 'bad trade', 'lesson', 'grade', 'validated', 'proven', 'supported']);
  });
  it('each word or phrase, any case: dropped', () => {
    for (const t of ['The biggest move.', 'My BEST guess.', 'The worst call.', 'A mistake there.', 'I should have waited.', 'I missed it.', 'A good trade.', 'A bad trade.', 'A lesson here.', 'Grade it later.', 'It validated the plan.', 'It was proven.', 'The data supported it.']) expect(verdict(t), t).toBe('forbidden');
  });
  it('a phrase across any run of spaces, and inflections: should  have, lessons, mistakes, graded', () => {
    for (const t of ['I should  have held.', 'Some lessons.', 'No mistakes.', 'It graded out.']) expect(verdict(t), t).toBe('forbidden');
  });
  it('whole words only: bestow, gradient, unmissed-like strings that merely contain one are kept', () => {
    for (const t of ['It did not bestow much.', 'A steep gradient.', 'Upgrade the plan.']) expect(verdict(t), t).toBeNull();
  });
});

describe('the answer as a whole', () => {
  it('an answer that is not { lines: [...] }: parse — no lines, nothing dropped', () => {
    for (const o of [null, undefined, 'lines', [], {}, { lines: 'x' }, { lines: {} }, { lines: [], extra: 1 }]) {
      expect(checkDebriefLines(o, DIGEST, { knownIds: KNOWN }), JSON.stringify(o)).toEqual({ ok: false, reason: 'parse', lines: [], dropped: [] });
    }
  });
  it('an empty list: ok, no lines (the pass records `nothing`, `no_lines`)', () => {
    expect(run([])).toEqual({ ok: true, lines: [], dropped: [] });
  });
  it('NEVER REPAIRED: a dropped line leaves no trace of itself in what is kept', () => {
    const r = run([{ swap: 's1', text: 'Out at 4 PM, the best exit.' }, { swap: 's2', text: 'PLTR came in on my plan.' }]);
    expect(r.lines).toEqual([{ label: 's2', text: 'PLTR came in on my plan.' }]);
    expect(JSON.stringify(r)).not.toMatch(/exit|PM/);
  });
});

describe('the review round (§2 review, the player lens)', () => {
  it('P1: a direction override, an invisible character, or no visible letter — `shape` (the reversed line rendered "It was a bad trade")', () => {
    for (const t of ['I sold it. \u202Eedart dab a saw tI', 'I wanted \u202EADVN\u202C instead.', '\u200B', '\u2060', 'Fine\u00ADly done.', 'Left \u2066isolated\u2069 text.']) expect(verdict(t), JSON.stringify(t)).toBe('shape');
    expect(verdict('...')).toBe('shape');   // no letter at all
  });
  it('P7: a letter outside the Latin script — a Cyrillic or Greek look-alike — `shape`; accented Latin letters pass', () => {
    for (const t of ['The bеst exit.', 'A mistаke.', 'twо names.', 'ΝVDA ran.']) expect(verdict(t), t).toBe('shape');
    expect(verdict('A café pause, then MSFT went.')).toBeNull();
  });
  it('P3: the "-ies" plurals and the other ordinals and multiples — `number_word`', () => {
    for (const t of ['MSFT drifted into the forties.', 'It sat in the low twenties.', 'Up in the nineties.', 'Firstly, MSFT stalled.', 'A twofold move.', 'Fourty minutes.', 'In the twentieth minute.', 'The eleventh check.', 'A hundredth of it.', 'The twelfth check.']) expect(verdict(t), t).toBe('number_word');
  });
  it('P5: words that only look like a number word\'s form pass — "tend" is not "ten"', () => {
    for (const t of ['I tend to let a stall like MSFT go.', 'It often stalls.', 'A tender moment.']) expect(verdict(t), t).toBeNull();
  });
  it('P4: the verdict phrases in their other spellings and forms — `forbidden`; "support" alone (a price level) passes', () => {
    for (const t of ["I should've held MSFT.", 'I should’ve held MSFT.', 'I should-have held.', 'A good-trade there.', 'A bad—trade.', 'It was mistaken.', 'It proved out.', 'It validates the plan.', 'The tape supports it.']) expect(verdict(t), t).toBe('forbidden');
    expect(verdict('MSFT sat at support all morning.')).toBeNull();
  });
  it('P5: sentence ends — an abbreviation\'s period and an ellipsis inside the text are none', () => {
    for (const t of ['I chose CRWD vs. MSFT. The stall made the call.', 'Late in the U.S. session. I moved to CRWD.', 'I waited… then sold MSFT. It had stalled.', 'I waited... then sold MSFT. It had stalled.']) expect(verdict(t), t).toBeNull();
  });
  it('P6: terminal punctuation in its other forms counts — three such ends: `shape`', () => {
    for (const t of ['MSFT！ It stalled！ I bought CRWD！', 'MSFT。 It stalled。 I bought CRWD。', 'MSFT‼ It stalled‼ I bought CRWD‼', 'MSFT.» It stalled.» I bought CRWD.»']) expect(verdict(t), t).toBe('shape');
  });
  it('P8: a directory symbol with its class suffix, or with a plural or possessive "s" — `symbol`', () => {
    for (const t of ['BRK-B ran instead.', 'BRK.B ran instead.', 'The NVDAs ran.', "NVDA's run."]) expect(verdict(t), t).toBe('symbol');
    expect(verdict("MSFT's stall made the call.")).toBeNull();   // the swap's own, possessive
  });
});

describe('the review round (§2 review, the census lens)', () => {
  it('C1: a number word or a forbidden word in full-width letters is read with its disguise off — `number_word`, `forbidden`', () => {
    expect(verdict('MSFT went \uFF54\uFF57\uFF4F ways.')).toBe('number_word');
    expect(verdict('The \uFF42\uFF45\uFF53\uFF54 exit.')).toBe('forbidden');
    expect(verdict('A \uFF4D\uFF49\uFF53\uFF54\uFF41\uFF4B\uFF45, then MSFT.')).toBe('forbidden');
  });
});

describe("the refuter's round (§2 review)", () => {
  it('N1: an ellipsis before a capital ends a sentence — three such ends: `shape`; before a lower-case word it does not', () => {
    for (const t of ['MSFT went quiet\u2026 I let it go\u2026 CRWD had the pull\u2026 It ran.', 'MSFT went quiet... I let it go... CRWD had the pull... It ran.']) expect(verdict(t), t).toBe('shape');
    for (const t of ['I waited\u2026 then sold MSFT. It had stalled.', 'I waited... then sold MSFT. It had stalled.']) expect(verdict(t), t).toBeNull();
  });
  it('N2: a forbidden word with "-ed" or "-ing" is `forbidden` (bested, besting, lessoned)', () => {
    for (const t of ['CRWD bested MSFT all day.', 'CRWD was besting MSFT.', 'I was lessoned by MSFT.', 'MSFT kept worsting.']) expect(verdict(t), t).toBe('forbidden');
  });
});
