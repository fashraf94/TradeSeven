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
  it('an id split by an invisible character is read with it taken off', () => {
    expect(verdict('On battle\u200BQuxAlpha it held.')).toBe('identifier');
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
