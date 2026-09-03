// src/screens/battleView/scopeTape.test.js
//
// A2.3 (D-73) — the piece scope: three rules, one per kind, and the one
// property that makes the door honest.
//
// THE PROPERTY: `n` IS THE LENGTH OF THE LIST THE TAP OPENS. Not a second
// count that agrees today — the same call, so it cannot stop agreeing
// (BUILD_RULES §9). Several rows below assert exactly that identity, because
// it is the thing a well-meaning refactor would break first.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  scopeTape,
  countMentions,
  tapeItemNamesSymbol,
  messageNamesSymbol,
  tradeNamesSymbol,
  checkNamesSymbol,
  mergeRecordedTape,
  TAPE_MESSAGE,
} from './scopeTape';
import { buildTape, TAPE_KIND, collapseQuietChecks } from './buildTape';
import { deriveChatMessages } from '../../components/Agent/deriveChatMessages';

const T = (hhmm) => `2026-09-01T${hhmm}:00.000Z`;
const ROSTER = new Set(['NVDA', 'SLB', 'MU', 'MOS', 'GILD']);

const EXCHANGES = [
  // agent-initiated: no user half at all
  { userMessage: null, agentResponse: 'Opening with NVDA in the star slot.', messageType: 'first_message', timestamp: T('13:31') },
  { userMessage: 'how is SLB doing?', agentResponse: 'SLB is holding its bid.', timestamp: T('15:31') },
  { userMessage: 'anything on the bench?', agentResponse: 'Nothing to report.', timestamp: T('16:31') },
];

const TRADES = [{
  symbolOut: 'GILD', symbolIn: 'MOS', tier: 'core', lockedPoints: 8.04,
  swappedOutAt: T('17:31'), source: 'haiku',
  rationale: 'GILD has stalled at the 200-day. MOS is breaking out.',
}];

const EVALUATIONS = [
  {
    evalId: 'e1', timestamp: T('18:31'), decision: 'HOLD', downgraded: false,
    rationale: 'NVDA is extending. The rest of the book is quiet.',
    scores: { active: 12, banked: 40 },
  },
  {
    evalId: 'e2', timestamp: T('18:46'), decision: 'HOLD', downgraded: false,
    rationale: 'Nothing to do here. SLB is the only name near a tier.',
    scores: { active: 12, banked: 40 },
  },
];

const tape = buildTape({
  trades: TRADES, statusFeed: [], evaluations: EVALUATIONS, receipts: {}, chatExchanges: EXCHANGES,
});
const stream = mergeRecordedTape(deriveChatMessages(EXCHANGES), tape);

describe('the three rules, one per kind', () => {
  it('a MESSAGE names a piece under the detector — the same scan the chat underlines with', () => {
    expect(messageNamesSymbol({ text: 'SLB is holding its bid.' }, 'SLB', ROSTER)).toBe(true);
    expect(messageNamesSymbol({ text: 'SLB is holding its bid.' }, 'NVDA', ROSTER)).toBe(false);
    // …the roster is what makes a word a symbol.
    expect(messageNamesSymbol({ text: 'SLB is holding.' }, 'SLB', new Set())).toBe(false);
    // …and a directive's own text is part of what its message says.
    expect(messageNamesSymbol({ text: 'Got it.', directive: { text: 'protect NVDA' } }, 'NVDA', ROSTER)).toBe(true);
  });

  it('a TRADE names a piece by the PAIR, either side, never by its motive', () => {
    const [trade] = tape.filter((e) => e._type === TAPE_KIND.TRADE);
    expect(tradeNamesSymbol(trade, 'GILD')).toBe(true);
    expect(tradeNamesSymbol(trade, 'MOS')).toBe(true);
    expect(tradeNamesSymbol(trade, 'NVDA')).toBe(false);
    // The motive names the 200-day and both symbols; matching on it would
    // count a rotation as being about every name it mentions.
    expect(tradeNamesSymbol({ symbolOut: 'A', symbolIn: 'B', motive: 'NVDA led today.' }, 'NVDA')).toBe(false);
  });

  it('a CHECK names a piece when its EXCERPT does — what the card shows, not the paragraph', () => {
    const [first, second] = tape.filter((e) => e._type === TAPE_KIND.CHECK);
    expect(checkNamesSymbol(first, 'NVDA')).toBe(true);
    expect(checkNamesSymbol(second, 'SLB')).toBe(false); // SLB is in the SECOND sentence
    expect(second.firstSentence).toBe('Nothing to do here.');
    expect(second.rationale).toContain('SLB');
  });

  it('a COLLAPSED RUN never scopes — it shows no text, so it names no piece', () => {
    const run = collapseQuietChecks(tape.filter((e) => e._type === TAPE_KIND.CHECK))
      .find((e) => e._type === TAPE_KIND.CHECK_RUN);
    // (the two checks differ in what they'd render, so they do not fold —
    //  build one directly to hold the rule regardless)
    expect(run ?? { _type: TAPE_KIND.CHECK_RUN, count: 2 }).toBeTruthy();
    expect(tapeItemNamesSymbol({ _type: TAPE_KIND.CHECK_RUN, count: 3 }, 'NVDA', ROSTER)).toBe(false);
  });

  it('an item of an UNKNOWN kind answers false rather than guessing', () => {
    expect(tapeItemNamesSymbol({ _type: 'somethingLater', text: 'NVDA' }, 'NVDA', ROSTER)).toBe(false);
    expect(tapeItemNamesSymbol(null, 'NVDA', ROSTER)).toBe(false);
    expect(tapeItemNamesSymbol({ _type: 'message', text: 'NVDA' }, null, ROSTER)).toBe(false);
  });
});

describe('the scoped stream, and the number on the door', () => {
  it('scopes to one piece across all three kinds', () => {
    const nvda = scopeTape(stream, 'NVDA', ROSTER);
    // the opener names NVDA; so does the 18:31 check
    expect(nvda.map((i) => i._type)).toEqual(['message', TAPE_KIND.CHECK]);

    const slb = scopeTape(stream, 'SLB', ROSTER);
    // the user's question and the agent's reply, both
    expect(slb).toHaveLength(2);
    expect(slb.every((i) => i._type === 'message')).toBe(true);

    const gild = scopeTape(stream, 'GILD', ROSTER);
    expect(gild.map((i) => i._type)).toEqual([TAPE_KIND.TRADE]);
  });

  it('THE PROPERTY — `n` is the length of the list the tap opens, for every piece', () => {
    for (const symbol of ['NVDA', 'SLB', 'MU', 'MOS', 'GILD']) {
      expect(countMentions(stream, symbol, ROSTER)).toBe(scopeTape(stream, symbol, ROSTER).length);
    }
  });

  it('ZERO is a real answer, and the whole tape is what a null scope shows', () => {
    expect(countMentions(stream, 'MU', ROSTER)).toBe(0);
    expect(scopeTape(stream, 'MU', ROSTER)).toEqual([]);
    expect(scopeTape(stream, null, ROSTER)).toBe(stream);
    expect(countMentions(stream, null, ROSTER)).toBe(stream.length);
  });

  it('an agent-initiated exchange contributes ONE entry, not two', () => {
    // The opener has a null userMessage; counting a user half nobody typed
    // would read `In the chat · 2` where the player wrote nothing.
    expect(scopeTape(stream, 'NVDA', ROSTER).filter((i) => i.role === 'user')).toEqual([]);
    expect(deriveChatMessages([EXCHANGES[0]])).toHaveLength(1);
    expect(deriveChatMessages([EXCHANGES[1]])).toHaveLength(2);
  });

  it('preserves the stream\'s order and its items, unmodified', () => {
    const scoped = scopeTape(stream, 'SLB', ROSTER);
    // The two halves of one exchange share its timestamp, so the order that
    // matters here is the stable one: the user asked, the agent answered.
    expect(scoped[0].timestamp.getTime()).toBeLessThanOrEqual(scoped[1].timestamp.getTime());
    expect(scoped.map((i) => i.role)).toEqual(['user', 'agent']);
    for (const item of scoped) expect(stream).toContain(item);
  });

  it('a malformed stream is empty, never a throw', () => {
    for (const bad of [null, undefined, 'nope', 42, {}]) {
      expect(scopeTape(bad, 'NVDA', ROSTER)).toEqual([]);
      expect(countMentions(bad, 'NVDA', ROSTER)).toBe(0);
    }
  });
});

describe('mergeRecordedTape — one concat, one sort', () => {
  it('orders every kind on its own timestamp', () => {
    const times = stream.map((i) => i.timestamp.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('carries the messages AND the cards, and nothing else', () => {
    expect(stream).toHaveLength(deriveChatMessages(EXCHANGES).length + tape.length);
  });

  it('TRIPWIRE — the message `_type` is the one the chat\'s own merge stamps', () => {
    // The predicate dispatches on it; a mismatch would make every message
    // silently unscopeable while every card still filtered.
    const chat = readFileSync(new URL('../../components/Agent/AgentChat.jsx', import.meta.url), 'utf8');
    expect(chat).toContain("_type: 'message'");
    expect(TAPE_MESSAGE).toBe('message');
  });

  it('an empty input on either side is not an error', () => {
    expect(mergeRecordedTape([], [])).toEqual([]);
    expect(mergeRecordedTape(null, null)).toEqual([]);
    expect(mergeRecordedTape(deriveChatMessages(EXCHANGES), null)).toHaveLength(5);
  });
});
