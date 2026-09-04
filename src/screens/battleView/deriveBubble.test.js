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
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { TAPE_KIND } from './buildTape';
import { TAPE_MESSAGE } from './scopeTape';
import { LABEL_COLOR, TRADE_EYEBROW_COLOR, DIRECTIVE_EYEBROW_COLOR, SPEECH_EYEBROW_COLOR } from './TapeCards';
import { WHY_KIND } from './selectWhyState';

const AT = '2026-09-01T19:45:00.000Z';

const check = (over = {}) => ({
  _type: TAPE_KIND.CHECK,
  id: 'check-1',
  timestamp: new Date(AT),
  at: AT,
  kind: WHY_KIND.HELD,
  label: 'Held',
  firstSentence: 'The book is holding its own relative to the market.',
  rationale: 'The book is holding its own relative to the market. And more.',
  ...over,
});

const trade = (over = {}) => ({
  _type: TAPE_KIND.TRADE,
  id: 'trade-1',
  timestamp: new Date(AT),
  at: AT,
  symbolOut: 'GILD',
  symbolIn: 'MOS',
  tier: 'core',
  firstSentence: 'GILD rolled over; MOS leads materials.',
  ...over,
});

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
    expect(b.eyebrow).toBe(COPY.checkCardLabel(AT, 'Held'));
    expect(b.line).toBe(item.firstSentence);
    expect(b.isRecord).toBe(true);
  });

  it('a trade: the trade CARD\'s eyebrow, and its first sentence', () => {
    const item = trade();
    const b = bubbleFor(item);
    expect(b.eyebrow).toBe(COPY.tradeCardLine(AT, 'GILD', 'MOS', 'core'));
    expect(b.line).toBe(item.firstSentence);
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

  it('falls back to the peek line when a record\'s words moved elsewhere', () => {
    // A check whose rationale is carried by a trade card in the same tick has
    // firstSentence null (buildTape, review RB-F1). The label still says what
    // the tick decided, so the bubble says that rather than nothing.
    const b = bubbleFor(check({ firstSentence: null, rationale: null }));
    expect(b.line).toBeTruthy();
    expect(b.line).toContain('Held');
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
