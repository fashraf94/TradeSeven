// src/screens/battleView/deriveBubble.test.js
//
// A3.1 (D-98) — the bubble mirrors the tape, and composes nothing.
//
// The rows that matter: every string comes back IDENTICAL to the helper the
// stream renders (equality, not shape), the walk skips what has nothing to say
// and what the character did not say, and the colour comes from TapeCards'
// exported map rather than a second one.

import { describe, it, expect } from 'vitest';
import { deriveBubble, bubbleFor } from './deriveBubble';
import { buildTape } from './buildTape';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { TAPE_KIND } from './buildTape';
import { TAPE_MESSAGE } from './scopeTape';
import { LABEL_COLOR, TRADE_EYEBROW_COLOR, DIRECTIVE_EYEBROW_COLOR, SPEECH_EYEBROW_COLOR } from './TapeCards';
import { WHY_KIND } from './selectWhyState';

const AT = '2026-09-01T19:45:00.000Z';

// FIXTURES COME FROM THE REAL BUILDER (review lens 1 F2). The first draft
// hand-wrote these objects and gave a TRADE entry a `firstSentence` field —
// which buildTape has never emitted for a trade (it writes
// `motiveFirstSentence`, :146). The code read the field the fixture invented,
// so the row passed while the bubble was broken on every executed swap. Built
// from `buildTape`, a fixture cannot drift from the persisted shape again.
const buildCheck = (over = {}) => buildTape({
  trades: [],
  statusFeed: [],
  evaluations: [{
    evalId: 'e1',
    timestamp: AT,
    decision: 'HOLD',
    rationale: 'The book is holding its own relative to the market. And more.',
    ...over,
  }],
  receipts: null,
  chatExchanges: [],
})[0];

const buildTrade = (over = {}) => buildTape({
  trades: [{
    symbolOut: 'GILD',
    symbolIn: 'MOS',
    tier: 'core',
    swappedOutAt: AT,
    exitReason: 'haiku_decision',
    rationale: 'GILD rolled over; MOS leads materials. And more.',
    ...over,
  }],
  statusFeed: [],
  evaluations: [],
  receipts: null,
  chatExchanges: [],
})[0];

const check = (over = {}) => ({ ...buildCheck(), ...over });
const trade = (over = {}) => ({ ...buildTrade(), ...over });

const speech = (over = {}) => ({
  _type: TAPE_MESSAGE,
  id: 'exchange-0-agent',
  role: 'agent',
  timestamp: new Date(AT),
  text: 'I am holding the energy slot into the close.',
  messageType: 'anticipation',
  _hasUserHalf: false,
  _anticipationDirection: 'potential_entry',
  ...over,
});

describe('bubbleFor — every string is the stream\'s own', () => {
  it('a check: the check CARD\'s eyebrow, and the sentence the card shows', () => {
    const item = check();
    const b = bubbleFor(item);
    expect(b.eyebrow).toBe(COPY.checkCardLabel(AT, item.label));
    expect(item.firstSentence).toBeTruthy();          // the builder really wrote it
    expect(b.line).toBe(item.firstSentence);
    expect(b.isRecord).toBe(true);
  });

  it('a trade: the trade CARD\'s eyebrow, and the sentence THAT card shows', () => {
    const item = trade();
    // The field the builder actually emits — and the one TapeCards' TradeCard
    // renders (:231). `firstSentence` is a check's field and must not exist here.
    expect(item.motiveFirstSentence).toBe('GILD rolled over; MOS leads materials.');
    expect(item.firstSentence).toBeUndefined();
    const b = bubbleFor(item);
    expect(b.eyebrow).toBe(COPY.tradeCardLine(AT, 'GILD', 'MOS', 'core'));
    expect(b.line).toBe(item.motiveFirstSentence);
    // …and it is NOT the eyebrow said twice, which is what the fallback gave.
    expect(b.line).not.toBe(b.eyebrow);
  });

  it('a quiet run: the run LINE\'s own words, and NO invented kind word', () => {
    const b = bubbleFor({ _type: TAPE_KIND.CHECK_RUN, id: 'run-1', count: 3, at: AT });
    expect(b.eyebrow).toBeNull();
    expect(b.line).toBe(COPY.checksNoChange(3));
  });

  it('a directive: the ruled eyebrow and the receipt line (D-51)', () => {
    const item = speech({ hasDirective: true, directive: { text: 'Protect the lead' } });
    const b = bubbleFor(item);
    expect(b.eyebrow).toBe(COPY.directiveEyebrow);
    expect(b.line).toContain('Protect the lead');
    expect(b.line).toContain('Filed');
  });

  it('speech: the kind eyebrow from the same two fields the chat reads, and the words', () => {
    const item = speech();
    const b = bubbleFor(item);
    expect(b.eyebrow).toBe(COPY.tapeKindEyebrow('anticipation', false, 'potential_entry'));
    expect(b.eyebrow).toBe('Bench note');
    expect(b.line).toBe(item.text);
    expect(b.isRecord).toBe(false);
  });

  it('an unlabelled kind keeps its words and wears no eyebrow (the map\'s rule)', () => {
    // `auto_debrief` is deliberately absent from tapeKindEyebrow's map: an
    // unknown type renders NO eyebrow rather than a guessed one (D-86).
    const b = bubbleFor(speech({ messageType: 'auto_debrief' }));
    expect(b.eyebrow).toBeNull();
    expect(b.line).toBe('I am holding the energy slot into the close.');
  });

  it('STEPS PAST a record whose words moved elsewhere, never echoing its eyebrow', () => {
    // A check whose rationale is carried by a trade card in the same tick has
    // firstSentence null (buildTape, review RB-F1). The first draft fell back to
    // peekLineFor, which returns `{slot} · {label}` — the eyebrow again, printed
    // as the character's line (review lens 1 F3).
    expect(bubbleFor(check({ firstSentence: null, rationale: null }))).toBeNull();
    // …and the walk finds the entry that DOES have words.
    const b = deriveBubble([trade(), check({ id: 'silent', firstSentence: null, rationale: null })]);
    expect(b.line).toBe('GILD rolled over; MOS leads materials.');
  });
});

describe('bubbleFor — what it refuses to say', () => {
  it('never speaks the PLAYER\'s own words (brief §4.5)', () => {
    expect(bubbleFor(speech({ role: 'user', text: 'protect the lead' }))).toBeNull();
  });

  it('returns null for an answer that never landed', () => {
    expect(bubbleFor(speech({ text: '' }))).toBeNull();
    expect(bubbleFor(speech({ text: '   ' }))).toBeNull();
    expect(bubbleFor(speech({ text: null }))).toBeNull();
  });

  it('returns null for junk rather than throwing', () => {
    expect(bubbleFor(null)).toBeNull();
    expect(bubbleFor('nope')).toBeNull();
    expect(bubbleFor({ _type: 'somethingNew' })).toBeNull();
  });
});

describe('bubbleFor — the colour is the stream\'s colour (hazard 43)', () => {
  it('a check takes TapeCards\' own LABEL_COLOR for its kind', () => {
    expect(bubbleFor(check({ kind: WHY_KIND.HELD })).eyebrowColor).toBe(LABEL_COLOR[WHY_KIND.HELD]);
    expect(bubbleFor(check({ kind: WHY_KIND.SWAPPED })).eyebrowColor).toBe(LABEL_COLOR[WHY_KIND.SWAPPED]);
    expect(bubbleFor(check({ kind: WHY_KIND.DOWNGRADED })).eyebrowColor).toBe(LABEL_COLOR[WHY_KIND.DOWNGRADED]);
  });

  it('a kind with no entry in the map falls back to speech, never to undefined', () => {
    expect(bubbleFor(check({ kind: 'somethingNew' })).eyebrowColor).toBe(SPEECH_EYEBROW_COLOR);
  });

  it('a trade and a directive take theirs; speech takes the chat\'s own text-muted', () => {
    expect(bubbleFor(trade()).eyebrowColor).toBe(TRADE_EYEBROW_COLOR);
    expect(bubbleFor(speech({ hasDirective: true, directive: { text: 'x' } })).eyebrowColor).toBe(DIRECTIVE_EYEBROW_COLOR);
    expect(bubbleFor(speech()).eyebrowColor).toBe(SPEECH_EYEBROW_COLOR);
  });

  it('every colour is a token reference, never a hex', () => {
    for (const item of [check(), trade(), speech(), speech({ hasDirective: true, directive: { text: 'x' } })]) {
      expect(bubbleFor(item).eyebrowColor).toMatch(/^var\(--ft-/);
    }
  });
});

describe('deriveBubble — the newest thing the CHARACTER said', () => {
  it('takes the last entry, not the first', () => {
    const b = deriveBubble([check({ id: 'old' }), trade({ id: 'new' })]);
    expect(b.id).toBe('new');
  });

  it('walks backwards past the player\'s message to the character\'s', () => {
    const b = deriveBubble([
      speech({ id: 'said' }),
      speech({ id: 'mine', role: 'user', text: 'protect the lead' }),
    ]);
    expect(b.id).toBe('said');
  });

  it('walks past a silent entry rather than showing an empty bubble', () => {
    const b = deriveBubble([check({ id: 'has-words' }), speech({ id: 'silent', text: '' })]);
    expect(b.id).toBe('has-words');
  });

  it('is null on an empty or absent tape', () => {
    expect(deriveBubble([])).toBeNull();
    expect(deriveBubble(null)).toBeNull();
    expect(deriveBubble(undefined)).toBeNull();
  });

  it('is null when the tape holds nothing the character said', () => {
    expect(deriveBubble([speech({ role: 'user', text: 'hello' })])).toBeNull();
  });

  it('is a pure function of the list — the same list gives the same id', () => {
    // The one-shot fade keys on this id. If it moved between renders of an
    // unchanged tape, the bubble would re-animate on every re-render, which is
    // motion marking a STATE rather than an event (D-97).
    const items = [check(), trade()];
    expect(deriveBubble(items).id).toBe(deriveBubble(items).id);
  });
});

describe('Review lens 1 F1 — the bubble folds exactly as the stream does (§9)', () => {
  const quiet = (id, iso) => buildTape({
    trades: [], statusFeed: [],
    evaluations: [{ evalId: id, timestamp: iso, decision: 'HOLD', rationale: 'Holding into the close.' }],
    receipts: null, chatExchanges: [],
  })[0];

  const RUN = [
    quiet('q1', '2026-09-01T19:15:00.000Z'),
    quiet('q2', '2026-09-01T19:30:00.000Z'),
    quiet('q3', '2026-09-01T19:45:00.000Z'),
  ];

  it('a run of quiet checks reads as the RUN, not as its newest member', () => {
    // The defect: deriveBubble took the UNFOLDED tape while the stream and the
    // peek strip both fold. The stream said `3 checks · no change` and the
    // character named the newest check alone — one moment, two names.
    const b = deriveBubble(RUN);
    expect(b.line).toBe(COPY.checksNoChange(3));
    expect(b.eyebrow).toBeNull();
    expect(b.line).not.toContain('Holding into the close.');
  });

  it('a GROWING run is a new event — the key moves with the count (D-97)', () => {
    // A run's id is its FIRST member's, so without the count a fourth quiet
    // check would change the LINE from `3 checks` to `4 checks` with no fade:
    // motion missing an event.
    const three = deriveBubble(RUN);
    const four = deriveBubble([...RUN, quiet('q4', '2026-09-01T20:00:00.000Z')]);
    expect(four.line).toBe(COPY.checksNoChange(4));
    expect(four.id).not.toBe(three.id);
  });

  it('honours the pin the stream folds with (D-89)', () => {
    // A pinned check stands out of its run in the stream; the bubble must fold
    // the same way or the two disagree about the same three ticks.
    const b = deriveBubble(RUN, RUN[2].id);
    expect(b.line).toBe('Holding into the close.');
    expect(b.eyebrow).toBe(COPY.checkCardLabel(RUN[2].at, RUN[2].label));
  });
});
