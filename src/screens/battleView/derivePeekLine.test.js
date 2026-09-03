// src/screens/battleView/derivePeekLine.test.js
//
// A2.4 (D-74) — the newest thing that happened, in one line.
//
// The seed's four examples are the four rows at the top; the rest hold the
// properties that make the line trustworthy: it folds exactly as the stream
// does (so the strip and the stream cannot name one moment two ways), it names
// a CHECK by its slot and a TRADE by its instant (D-83), it never truncates
// the string itself, and an entry with nothing to say is walked past rather
// than shown as a blank strip.

import { describe, it, expect } from 'vitest';
import { derivePeekLine, peekLineFor } from './derivePeekLine';
import { buildTape, TAPE_KIND, collapseQuietChecks } from './buildTape';
import { mergeRecordedTape } from './scopeTape';
import { deriveChatMessages } from '../../components/Agent/deriveChatMessages';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

const T = (hhmm) => `2026-09-01T${hhmm}:00.000Z`;

const TRADE = {
  symbolOut: 'GILD', symbolIn: 'MOS', tier: 'core', lockedPoints: 8.04,
  swappedOutAt: T('17:31'), source: 'haiku', rationale: 'A rotation of the core slot.',
};
const HELD = {
  evalId: 'e1', timestamp: T('19:46'), decision: 'HOLD', downgraded: false,
  rationale: 'The book is holding its shape.', scores: { active: 1, banked: 40 },
};
const DIRECTIVE_EXCHANGE = {
  userMessage: 'widen it', agentResponse: 'Understood.', hasDirective: true,
  directive: { text: 'Widen the spread', directiveThreadId: 't-1' },
  directiveThreadId: 't-1', timestamp: T('19:50'),
};

const entriesOf = (over = {}) => buildTape({
  trades: [], statusFeed: [], evaluations: [], receipts: {}, chatExchanges: [], ...over,
});

describe('the seed\'s four lines', () => {
  it('a DIRECTIVE reads `Filed 3:50 PM · Widen the spread`', () => {
    const [, agent] = deriveChatMessages([DIRECTIVE_EXCHANGE]);
    expect(peekLineFor({ ...agent, _type: 'message' })).toBe('Filed 3:50 PM · Widen the spread');
  });

  it('a CHECK reads `3:45 PM · Held` — its SLOT, not its instant (D-83)', () => {
    const [check] = entriesOf({ evaluations: [{ ...HELD, timestamp: '2026-09-01T19:46:07.000Z' }] });
    expect(peekLineFor(check)).toBe('3:45 PM · Held');
  });

  it('a TRADE reads `1:31 PM · GILD → MOS` — its exact minute, because a swap executes at one', () => {
    const [trade] = entriesOf({ trades: [TRADE] });
    expect(peekLineFor(trade)).toBe('1:31 PM · GILD → MOS');
    expect(peekLineFor(trade)).toBe(COPY.tradeLine(trade.at, 'GILD', 'MOS'));
  });

  it('a FOLDED RUN reads `{t} · {n} checks · no change`', () => {
    expect(peekLineFor({ _type: TAPE_KIND.CHECK_RUN, at: T('19:31'), count: 3 }))
      .toBe('3:30 PM · 3 checks · no change');
  });

  it('a plain MESSAGE reads `{t} · {the speaker\'s own words}`', () => {
    const [user, agent] = deriveChatMessages([
      { userMessage: 'hold the energy slot', agentResponse: 'Holding it.', timestamp: T('19:52') },
    ]);
    expect(peekLineFor({ ...user, _type: 'message' })).toBe('3:52 PM · hold the energy slot');
    expect(peekLineFor({ ...agent, _type: 'message' })).toBe('3:52 PM · Holding it.');
  });
});

describe('the properties', () => {
  const stream = () => mergeRecordedTape(
    deriveChatMessages([DIRECTIVE_EXCHANGE]),
    buildTape({
      trades: [TRADE], statusFeed: [],
      // …both checks BEFORE the directive, so the directive is the newest.
      evaluations: [{ ...HELD, timestamp: T('18:46') }, { ...HELD, evalId: 'e2', timestamp: T('19:01') }],
      receipts: {}, chatExchanges: [DIRECTIVE_EXCHANGE],
    }),
  );

  it('is the NEWEST entry of the stream, whichever kind that is', () => {
    // The directive at 3:50 PM is the last thing on this tape…
    expect(derivePeekLine(stream())).toBe('Filed 3:50 PM · Widen the spread');
    // …and a check landing after it takes the line.
    const later = mergeRecordedTape(
      deriveChatMessages([DIRECTIVE_EXCHANGE]),
      buildTape({ trades: [], statusFeed: [], evaluations: [{ ...HELD, timestamp: T('20:01') }], receipts: {}, chatExchanges: [DIRECTIVE_EXCHANGE] }),
    );
    expect(derivePeekLine(later)).toBe('4:00 PM · Held');
  });

  it('FOLDS exactly as the stream does — a run reads as a run, not as its last check', () => {
    const quiet = buildTape({
      trades: [], statusFeed: [],
      evaluations: [HELD, { ...HELD, evalId: 'e2', timestamp: T('20:01') }],
      receipts: {}, chatExchanges: [],
    });
    const merged = mergeRecordedTape([], quiet);
    // The two checks fold into one line in the stream…
    const folded = collapseQuietChecks(merged);
    expect(folded).toHaveLength(1);
    expect(folded[0]._type).toBe(TAPE_KIND.CHECK_RUN);
    // …and the strip says the same thing, not `4:01 PM · Held`.
    expect(derivePeekLine(merged)).toBe('3:45 PM · 2 checks · no change');
  });

  it('walks BACKWARDS past an entry with nothing to say', () => {
    const merged = mergeRecordedTape(
      [{ id: 'm1', role: 'agent', text: 'The book is set.', timestamp: new Date(T('19:00')).getTime() }],
      // an exchange whose response never landed, newer than the message
      [{ _type: 'message', id: 'm2', role: 'agent', text: null, timestamp: new Date(T('20:00')) }],
    );
    expect(derivePeekLine(merged)).toBe('3:00 PM · The book is set.');
  });

  it('is null on an empty tape, and never throws on a malformed one', () => {
    expect(derivePeekLine([])).toBeNull();
    expect(derivePeekLine(null)).toBeNull();
    expect(derivePeekLine('nope')).toBeNull();
    expect(peekLineFor(null)).toBeNull();
    expect(peekLineFor({ _type: 'somethingLater' })).toBeNull();
    expect(peekLineFor({ _type: 'message', text: '   ' })).toBeNull();
  });

  it('NEVER truncates the string — the strip clips it at the reader\'s width', () => {
    const long = 'x'.repeat(400);
    const [agent] = deriveChatMessages([{ userMessage: null, agentResponse: long, messageType: 'first_message', timestamp: T('19:52') }]);
    const out = peekLineFor({ ...agent, _type: 'message' });
    expect(out).toContain(long);
    expect(out).not.toContain('…');
    expect(out).not.toContain('...');
  });
});
