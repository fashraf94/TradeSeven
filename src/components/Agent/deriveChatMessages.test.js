// src/components/Agent/deriveChatMessages.test.js
//
// A2.3 — the message derivation, lifted out of AgentChat's `serverMessages`
// memo so the screen's `In the chat · {n}` counts the same list the chat
// renders.
//
// The lift's own docstring used to say "the chat golden is the proof". It is
// not, for two of the rules it highlights (review L3-F2's sibling finding):
// the golden fixture's first exchange is an `auto_debrief`, so the
// `__REVIEW_START__` sentinel is never the conjunct that fires, and every
// non-last exchange carries `suggestedActions: null`. Neither string appears
// anywhere else in the suite. They are pinned here.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { deriveChatMessages } from './deriveChatMessages';

afterEach(() => vi.useRealTimers());

const AT = '2026-09-01T15:31:00.000Z';
const ms = new Date(AT).getTime();

describe('deriveChatMessages — two halves, or one', () => {
  it('a user-initiated exchange is TWO messages, the user first', () => {
    const out = deriveChatMessages([{ userMessage: 'hi', agentResponse: 'hello', timestamp: AT }]);
    expect(out.map((m) => m.role)).toEqual(['user', 'agent']);
    expect(out.map((m) => m.text)).toEqual(['hi', 'hello']);
    expect(out.map((m) => m.id)).toEqual(['exchange-0-user', 'exchange-0-agent']);
    expect(out.every((m) => m.timestamp === ms && m._serverIndex === 0)).toBe(true);
  });

  it('an AGENT-INITIATED exchange suppresses its user half — nobody typed it', () => {
    // `In the chat · 2` where the player wrote once is the error this prevents.
    for (const ex of [
      { messageType: 'first_message', userMessage: 'seed', agentResponse: 'Opening the book.', timestamp: AT },
      { messageType: 'trade_narration', userMessage: 'x', agentResponse: 'Rotated.', timestamp: AT },
      { messageType: 'anticipation', userMessage: 'x', agentResponse: 'Watching a level.', timestamp: AT },
      { isAutoDebrief: true, userMessage: 'x', agentResponse: 'The day in review.', timestamp: AT },
      { userMessage: null, agentResponse: 'No user half at all.', timestamp: AT },
    ]) {
      const out = deriveChatMessages([ex]);
      expect(out).toHaveLength(1);
      expect(out[0].role).toBe('agent');
    }
  });

  it('the LEGACY `__REVIEW_START__` sentinel is suppressed too', () => {
    // The golden cannot see this: its first exchange is an auto_debrief, so
    // the first conjunct fires before the sentinel is ever reached.
    const out = deriveChatMessages([{ userMessage: '__REVIEW_START__', agentResponse: 'Review.', timestamp: AT }]);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe('agent');
    // …and a user-initiated exchange that merely CONTAINS it is not suppressed.
    expect(deriveChatMessages([{ userMessage: 'about __REVIEW_START__', agentResponse: 'ok', timestamp: AT }])).toHaveLength(2);
  });

  it('`suggestedActions` ride the LAST exchange only', () => {
    // The golden cannot see this either: every non-last exchange in its
    // fixture already has `suggestedActions: null`.
    const acts = ['Sell it', 'Hold'];
    const out = deriveChatMessages([
      { userMessage: 'a', agentResponse: 'one', suggestedActions: acts, timestamp: AT },
      { userMessage: 'b', agentResponse: 'two', suggestedActions: acts, timestamp: AT },
    ]);
    const agents = out.filter((m) => m.role === 'agent');
    expect(agents[0].suggestedActions).toBeNull();
    expect(agents[1].suggestedActions).toBe(acts);
  });

  it('a directive is carried as text + thread id, and collapses to null without both', () => {
    const withDirective = deriveChatMessages([{
      userMessage: 'lock it', agentResponse: 'Filed.', hasDirective: true,
      directive: { text: 'Protect the lead', directiveThreadId: 't-1', extra: 'never carried' }, timestamp: AT,
    }]).find((m) => m.role === 'agent');
    expect(withDirective.hasDirective).toBe(true);
    expect(withDirective.directive).toEqual({ text: 'Protect the lead', directiveThreadId: 't-1' });

    const flagOnly = deriveChatMessages([{ userMessage: 'x', agentResponse: 'y', hasDirective: true, timestamp: AT }])
      .find((m) => m.role === 'agent');
    expect(flagOnly.directive).toBeNull();
  });

  it('the timestamp union, and the `Date.now()` fallback of last resort', () => {
    expect(deriveChatMessages([{ userMessage: 'a', agentResponse: 'b', timestamp: { toMillis: () => 42 } }])[0].timestamp).toBe(42);
    expect(deriveChatMessages([{ userMessage: 'a', agentResponse: 'b', timestamp: AT }])[0].timestamp).toBe(ms);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T17:00:00.000Z'));
    const now = Date.now();
    for (const timestamp of [undefined, null, 'not a date', 0]) {
      expect(deriveChatMessages([{ userMessage: 'a', agentResponse: 'b', timestamp }])[0].timestamp).toBe(now);
    }
  });

  it('the other carried fields, and the defaults', () => {
    const [agent] = deriveChatMessages([{ userMessage: null, agentResponse: 'x', messageType: 'first_message', timestamp: AT }]);
    expect(agent.mode).toBe('battle');
    expect(agent.scratchpad).toBeNull();
    expect(agent.isAutoDebrief).toBe(false);
    expect(agent.messageType).toBe('first_message');
    const [withMode] = deriveChatMessages([{ userMessage: null, agentResponse: 'x', messageType: 'first_message', mode: 'review', scratchpad: 'MSFT (potential_exit)', timestamp: AT }]);
    expect(withMode.mode).toBe('review');
    expect(withMode.scratchpad).toBe('MSFT (potential_exit)');
  });

  it('nothing in, nothing out', () => {
    expect(deriveChatMessages(null)).toEqual([]);
    expect(deriveChatMessages([])).toEqual([]);
    expect(deriveChatMessages(undefined)).toEqual([]);
  });
});
