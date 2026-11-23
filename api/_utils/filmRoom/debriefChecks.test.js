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
    { label: 's1', time: '12:45 PM', maker: 'the stall rule', sold: 'MSFT', bought: 'CRWD', atSwap: { saidBy: 'the agent', at: '12:45 PM', rationale: 'The rule took MSFT; PLTR is still the one I wait on.' } },
    { label: 's2', time: '2:00 PM', maker: 'your agent', sold: 'DE', bought: 'PLTR' },
  ],
};
const KNOWN = ['b-sep23-fixture', 'owner-1', 'agent-1', 'battleQuxAlpha', 'ownerBravoKilo'];
const run = (lines) => checkDebriefLines({ lines }, DIGEST, { knownIds: KNOWN });
/** One line for s1: kept (null) or the reason it was dropped. */
const verdict = (text, swap = 's1') => { const r = run([{ swap, text }]); return r.lines.length ? null : r.dropped[0].reason; };

describe('the table (§5, with Amendment F DF-5\'s check 8): eight checks, in order', () => {
  it('the reason codes, in the table\'s order', () => {
    expect(CHECK_REASONS).toEqual(['label', 'shape', 'digit', 'number_word', 'symbol', 'identifier', 'forbidden', 'maker']);
  });
  it('a clean line passes every check and is kept exactly, trimmed', () => {
    const r = run([{ swap: 's1', text: "  That wasn't my call. MSFT had stopped moving.  " }]);
    expect(r).toEqual({ ok: true, lines: [{ label: 's1', text: "That wasn't my call. MSFT had stopped moving." }], dropped: [] });
  });
  it("Amendment E DE-7 as Amendment F DF-8 narrows it (the build report's Q-7): the spec's own §0 example — \"This one wasn't my call. MSFT had stopped moving.\" — passes", () => {
    expect(verdict("This one wasn't my call. MSFT had stopped moving.")).toBeNull();
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
    for (const t of ['It chose CRWD vs. MSFT. The stall made the call.', 'Late in the U.S. session. It moved to CRWD.', 'I waited… then sold MSFT. It had stalled.', 'I waited... then sold MSFT. It had stalled.']) expect(verdict(t), t).toBeNull();
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

describe('Amendment F DF-4 (Astra\'s F4): sentence ends by Unicode property — a run counts once', () => {
  it('three ends of any script\'s terminal — the Arabic question mark, the Urdu full stop, the interrobang — `shape`; with or without a space after each', () => {
    for (const t of ['It moved؟ I watched؟ I waited؟', 'It moved؟I watched؟I waited؟', 'It moved۔ I watched۔ I waited۔', 'It moved‽ I watched‽ I waited‽', 'It moved？I watched？I waited？']) expect(verdict(t), t).toBe('shape');
    expect(verdict('It moved؟ I watched.')).toBeNull();   // two
  });
  it('a run of terminals is one end — together or with spaces between', () => {
    for (const t of ['Wait?! Then go.', 'Wait? ! Then go.', 'Wait?? Then go.', 'Wait . . . then go. Fine.']) expect(verdict(t), t).toBeNull();
  });
  it('a period directly before a capital ends a sentence — but never after a single letter or an abbreviation; before a lower-case letter, never', () => {
    expect(verdict('Done.Then sold.Then waited.')).toBe('shape');
    for (const t of ['U.S. names held. Fine.', 'e.g. this held. Fine.', 'The rule held, vs.Then nothing. Fine.', 'It ran on node.js here. Fine.']) expect(verdict(t), t).toBeNull();
  });
  it('the ellipsis still counts (the property leaves it out): before a capital it ends one, inside before lower case it does not', () => {
    expect(verdict('It went quiet… I let it go… It held…')).toBe('shape');
    expect(verdict('I waited… then it held. Fine.')).toBeNull();
  });
});

describe('Amendment F DF-5 — check 2: no link, no email-like token, no markup', () => {
  it('a URL with any scheme, or "www.": `shape`', () => {
    for (const t of ['See https://example.com today.', 'See http://example.com today.', 'See ftp://example.com today.', 'Read www.example.com now.', 'Read WWW.EXAMPLE.COM now.', 'Read ｗｗｗ.example.com now.']) expect(verdict(t, 's2'), t).toBe('shape');
  });
  it('an email-like token: `shape`', () => {
    for (const t of ['Mail me at a@b.co please.', 'Write to desk@trading.example today.']) expect(verdict(t, 's2'), t).toBe('shape');
  });
  it('a "<" or ">" — as written or full-width: `shape`', () => {
    for (const t of ['PLTR <b>held</b>.', 'PLTR > DE today.', 'PLTR ＜ held.', 'PLTR ﹥ held.']) expect(verdict(t, 's2'), t).toBe('shape');
  });
  it('a period in an ordinary word and an at-sign alone are no link', () => {
    for (const t of ['PLTR held at the open.', 'I sold DE @ the open.']) expect(verdict(t, 's2'), t).toBeNull();
  });
});

describe('Amendment F DF-5 — check 7\'s verdict patterns (`forbidden`), on the agent\'s own swap so no other check fires', () => {
  it('each evaluative word within two words before a decision noun', () => {
    for (const t of [
      'That was a good trade.', 'A great swap for PLTR.', 'An excellent call on PLTR.', 'A smart move into PLTR.', 'A wise decision on DE.', 'A clever choice, PLTR.',
      'A solid exit from DE.', 'A strong entry into PLTR.', 'The right call on PLTR.', 'A bad trade, DE out.', 'A poor swap for PLTR.', 'A terrible call on DE.',
      'The wrong move on DE.', 'A weak exit from DE.', 'A dumb trade on DE.', 'A costly swap, DE out.',
    ]) expect(verdict(t, 's2'), t).toBe('forbidden');
  });
  it('each decision noun, singular and plural; one word between them; any case and full-width', () => {
    for (const t of ['Good trades on PLTR.', 'Good swaps here.', 'Good calls here.', 'Good moves here.', 'Good decisions here.', 'Good choices here.', 'Good exits here.', 'Good entries here.', 'A smart little move.', 'A GOOD TRADE.', 'Ａ ｇｏｏｄ trade.', 'A good-trade day.']) expect(verdict(t, 's2'), t).toBe('forbidden');
  });
  it('each outcome phrase', () => {
    for (const t of ['It paid off.', 'It worked out.', 'It backfired.', 'It cost me.', 'It cost us.', 'It helped me.', 'It helped us.', 'It hurt me.', 'It hurt us.', 'I nailed it.', 'I blew it.']) expect(verdict(t, 's2'), t).toBe('forbidden');
  });
  it('not a verdict: two words between, no decision noun, or the noun first', () => {
    for (const t of ['PLTR held strong into the move.', 'A good while later PLTR moved.', 'The trade went through at the open.', 'Right after the check, DE went out.']) expect(verdict(t, 's2'), t).toBeNull();
  });
});

describe('Amendment F DF-5 — check 8 `maker`: on a swap the agent did not make, no claim of its decision', () => {
  it('"I" and each decision verb, in each tense form', () => {
    for (const t of [
      'I make the calls here.', 'I made the swap.', 'I am making room.', 'I chose CRWD.', 'I have chosen CRWD.', 'I choose CRWD.', 'I decided on CRWD.', 'I decide it now.', 'I picked CRWD.', 'I pick CRWD.',
      'I sold MSFT.', 'I sell MSFT here.', 'I was selling MSFT.', 'I bought CRWD.', 'I buy CRWD.', 'I swapped MSFT out.', 'I swap MSFT out.', 'I moved to CRWD.', 'I rotated into CRWD.',
      'I exited MSFT.', 'I traded MSFT away.', 'I am trading MSFT away.',
    ]) expect(verdict(t, 's1'), t).toBe('maker');
  });
  it('"I" with its contraction or up to two bridging words, in either apostrophe', () => {
    for (const t of ["I've sold MSFT.", 'I’ve sold MSFT.', "I'd already sold MSFT.", 'I had already chosen CRWD.', 'I did sell MSFT.', 'I just sold MSFT.', 'i sold MSFT.']) expect(verdict(t, 's1'), t).toBe('maker');
  });
  it('"my" and each decision noun', () => {
    for (const t of ['My call held.', 'It was my choice.', 'It was my decision.', 'CRWD was my pick.', 'It was my move.', 'It was my trade.', 'Those were my calls.']) expect(verdict(t, 's1'), t).toBe('maker');
  });
  it('a claim with "not", "n\'t" or "no" within the three words before it is no claim — the spec\'s example passes', () => {
    for (const t of ["This one wasn't my call.", 'This one wasn’t my call.', 'It was not my call.', 'Not that I sold MSFT.', "Don't think I sold MSFT."]) expect(verdict(t, 's1'), t).toBeNull();
  });
  it('a denial inside the verb phrase is no claim; the rule\'s decision, said as the rule\'s, passes', () => {
    for (const t of ["I didn't sell MSFT.", 'I did not sell MSFT.', 'The rule sold MSFT, my plan waited.', 'I watched the rule take MSFT.']) expect(verdict(t, 's1'), t).toBeNull();
  });
  it('a negation four words back does not reach the claim', () => {
    expect(verdict('Not at all the rule: I sold MSFT.', 's1')).toBe('maker');
  });
  it('on the agent\'s own swap a claim is the truth: kept', () => {
    for (const t of ['I sold DE for PLTR.', 'It was my call.', 'I chose PLTR.']) expect(verdict(t, 's2'), t).toBeNull();
  });
  it('every maker that is not the agent is read — the risk rule, the guardrail, the meeting, one not recorded', () => {
    for (const maker of ['the risk rule', 'the guardrail', 'the gameplan meeting', 'a maker not recorded']) {
      const r = checkDebriefLines({ lines: [{ swap: 's1', text: 'I sold MSFT.' }] }, { swaps: [{ label: 's1', maker, sold: 'MSFT', bought: 'CRWD' }] });
      expect(r.dropped, maker).toEqual([{ label: 's1', reason: 'maker' }]);
    }
  });
});

describe('Amendment F DF-8 (narrowing Amendment E DE-7): "one" — per occurrence', () => {
  it('the ruling\'s three: "This one wasn\'t my call." passes; "I kept that one share." and "This one wasn\'t my call; one of them was." are dropped', () => {
    expect(verdict("This one wasn't my call.")).toBeNull();
    expect(verdict('I kept that one share.', 's2')).toBe('number_word');
    expect(verdict("This one wasn't my call; one of them was.")).toBe('number_word');
  });
  it('after "this", "that" or "no", before punctuation, the end or a listed word: passes', () => {
    for (const t of ['That one held.', 'No one moved.', 'This one.', 'That one, though.', 'This one was quick.', 'That one got away.', 'This one felt slow.', 'That one looked flat.', 'This one stayed put.', 'That one came back.', 'This one went out.', 'No one held it.', 'This one isn’t mine.', 'That one hadn’t moved.', 'This one did nothing.', 'That one has gone.']) expect(verdict(t, 's2'), t).toBeNull();
  });
  it('every other "one" is a count: dropped', () => {
    for (const t of ['The one swap I chose.', 'One of my swaps.', 'Only one held.', 'That one share held.', 'This one stock held.', 'One held.', 'Those ones held.', 'No one moved first.', 'This one was mine; that one was not.']) expect(verdict(t, 's2'), t).toBe('number_word');
  });
  it('the line is kept exactly — the exception rewrites nothing', () => {
    expect(run([{ swap: 's1', text: "  This one wasn't my call.  " }]).lines).toEqual([{ label: 's1', text: "This one wasn't my call." }]);
  });
});

describe('DF-9 — check 5 reads `before` and `atSwap`; `after` is gone', () => {
  const digestOf = (said) => ({ swaps: [{ label: 's1', maker: 'your agent', sold: 'DE', bought: 'PLTR', ...said }] });
  const one = (said, text) => { const r = checkDebriefLines({ lines: [{ swap: 's1', text }] }, digestOf(said)); return r.lines.length ? null : r.dropped[0].reason; };
  it('a symbol found only in `atSwap`: kept; only in `before`: kept', () => {
    expect(one({ atSwap: { rationale: 'PANW sits at its level.' } }, 'PANW is next.')).toBeNull();
    expect(one({ before: { hypothesis: 'PANW is next in line.' } }, 'PANW is next.')).toBeNull();
  });
  it('a symbol only in a field named `after` no longer permits it: dropped', () => {
    expect(one({ after: { rationale: 'PANW sits at its level.' } }, 'PANW is next.')).toBe('symbol');
  });
});

describe('Amendment F DF-5 — the declared limits: the contract is the checks, not a semantic guarantee', () => {
  it('a ticker in lower case and a company named in words pass check 5 (Astra\'s F5, declared)', () => {
    for (const t of ['I watched nvda.', 'Nvidia ran instead.']) expect(verdict(t, 's1'), t).toBeNull();
  });
});

describe('the fix round\'s review, the player lens (P-1 to P-9): each case its own row, written literally', () => {
  it('P-1 (DF-4): every terminal run counts whatever follows it — a dash, a star, an emoji, a bracket, a mark or an opening quote glued after it hides no end', () => {
    for (const t of ['MSFT stalled.— The rule sold it.— CRWD came in.—', 'MSFT stalled.* The rule sold it.* CRWD came in.*', 'MSFT stalled.🙂 The rule sold it.🙂 CRWD came in.🙂', 'MSFT stalled.】 The rule sold it.】 CRWD came in.】', 'MSFT stalled.( The rule sold it.( CRWD came in.(', 'MSFT stalled.\u0301 The rule sold it.\u0301 CRWD came in.', 'MSFT stalled!“The rule sold it!” CRWD came in!', 'It went well. It was quiet.~ Then CRWD.']) expect(verdict(t), t).toBe('shape');
  });
  it('P-1: DF-4\'s exemptions still hold — an abbreviation, a period inside a word or a number, an inner ellipsis', () => {
    for (const t of ['U.S. names held. Fine.', 'It ran on node.js here. Fine.', 'I waited… then it held. Fine.', "This one wasn't my call. MSFT had stopped moving."]) expect(verdict(t), t).toBeNull();
  });
  it('P-2 and P-6 (DF-5 check 8): any tense form — up to three bridging words, an "-ly" word, "alone"; "my" with one word before its noun', () => {
    for (const t of ['I have been selling MSFT.', 'I would have already sold MSFT.', 'I will have sold MSFT.', 'I quickly sold MSFT.', 'I alone chose CRWD.', 'I then quickly sold MSFT.', 'It was my own call.', 'It was my final decision.']) expect(verdict(t), t).toBe('maker');
  });
  it('P-5 (check 8): the negation window ends at its clause — a "not", "n\'t" or "no" in another clause, or before a comma, is no denial', () => {
    for (const t of ["It wasn't close. I chose CRWD.", 'Not gonna lie, I sold MSFT.', "Don't worry, I chose CRWD.", 'No question, my call.', 'No, my call came later.', "Can't lie: I sold MSFT."]) expect(verdict(t), t).toBe('maker');
    for (const t of ["This one wasn't my call.", 'It was not my call.', 'Not that I sold MSFT.']) expect(verdict(t), t).toBeNull();
  });
  it('P-7: the apostrophe\'s look-alikes in a contraction — "I′ve", "I‘ve", "I`ve sold" — are a claim', () => {
    for (const t of ['I′ve sold MSFT.', 'I‘ve sold MSFT.', 'I`ve sold MSFT.']) expect(verdict(t), t).toBe('maker');
  });
  it('P-3 (DF-5 check 7): the words between may hold punctuation, and the one word between may be hyphenated', () => {
    for (const t of ['A good, clean move.', 'A good well-timed move.', 'A great — quick — swap.']) expect(verdict(t, 's2'), t).toBe('forbidden');
    expect(verdict('PLTR held strong into the move.', 's2')).toBeNull();
  });
  it('P-4 (DF-8): punctuation after "one" counts only where it ends the word — "one-share" is a quantity; "one\'s" is the pronoun\'s', () => {
    for (const t of ['I kept that one-share lot.', 'I kept that one–share lot.', 'I kept that one/share lot.']) expect(verdict(t, 's2'), t).toBe('number_word');
    for (const t of ['That one’s a share.', "That one's done.", 'I kept that one.']) expect(verdict(t, 's2'), t).toBeNull();
  });
  it('P-7: a combining mark hides no number word, symbol, verdict or claim — the checks also read the text with its marks taken off', () => {
    expect(verdict('MSFT stalled fïve times.')).toBe('number_word');
    expect(verdict('I watched NVDÁ instead.')).toBe('symbol');
    for (const t of ['It was the bėst exit.', 'A göod trade.', 'You should′ve sold.']) expect(verdict(t, 's2'), t).toBe('forbidden');
    expect(verdict('I s\u0301old MSFT.')).toBe('maker');
    // the kept line is the model's text exactly — the third reading is checked, never stored
    expect(run([{ swap: 's2', text: 'Café PLTR held.' }]).lines).toEqual([{ label: 's2', text: 'Café PLTR held.' }]);
  });
  it('P-9 (DF-5 check 2): a URL by a web, file, script, data or mail scheme and its colon alone, or with spaces around "://"; an email-like token without a dot', () => {
    for (const t of ['See https:/evil.io for more.', 'See https:evil.io for more.', 'See data:text/html,hi for more.', 'See https ://evil.io for more.', 'Run javascript:alert now.', 'Mail bob@evilcorp for more.']) expect(verdict(t, 's2'), t).toBe('shape');
    for (const t of ['I sold DE @ the open.', 'PLTR held at the open.']) expect(verdict(t, 's2'), t).toBeNull();
  });
});
