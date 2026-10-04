// src/components/Agent/deriveChatMessages.cockpit.test.js
//
// Cockpit Build 2a (spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md §8.2; Build 1a spec
// docs/COCKPIT_BUILD1A_SPEC_V1_2.md:39 — "Build 2 adds the mode gate to the
// UI"): the client's mode gate is the server's own history-window rule, and
// the projection keeps where a filing came from so its card can say so.

import { describe, it, expect } from 'vitest';
import { deriveChatMessages, gateCockpitFilings } from './deriveChatMessages';
import { excludeCockpitFilings } from '../../../api/_utils/chatHistoryWindow.js';
import { buildCockpitExchange } from '../../../api/agent/call-response.js';

const ASK = { userMessage: 'How is the book?', agentResponse: 'Holding up.', timestamp: '2026-09-09T14:00:00.000Z', mode: 'battle' };
const CHIP = {
  userMessage: null, agentResponse: '', hasDirective: true, messageType: 'directive_filed', source: 'chip',
  directive: { text: 'Widen the spread', directiveThreadId: 't-chip' }, directiveThreadId: 't-chip', timestamp: '2026-09-09T14:10:00.000Z', mode: 'battle',
};
// The answer endpoint's own exchange builder — never a hand-copied shape.
const COCKPIT = buildCockpitExchange({
  record: { text: "Hold off on AMD until today's close", directiveThreadId: 't-cockpit', kind: 'call_hold' },
  directiveThreadId: 't-cockpit', createdAt: '2026-09-09T14:33:00.000Z', callId: 'b:eval_010:call:0',
});

describe('gateCockpitFilings — the client mode gate', () => {
  it('cockpit-on: the list is returned as it is (the same array)', () => {
    const list = [ASK, CHIP, COCKPIT];
    expect(gateCockpitFilings(list, true)).toBe(list);
  });

  it('not cockpit-on: cockpit filings are removed — exactly the server\'s window rule below \'on\'', () => {
    const list = [ASK, CHIP, COCKPIT];
    const gated = gateCockpitFilings(list, false);
    expect(gated).toEqual([ASK, CHIP]);
    expect(gated).toEqual(excludeCockpitFilings(list, 'off'));
  });

  it('with no cockpit filing in the list — every battle before the cockpit — the SAME array, whatever the gate says', () => {
    const list = [ASK, CHIP];
    expect(gateCockpitFilings(list, false)).toBe(list);
    expect(gateCockpitFilings(list, true)).toBe(list);
  });

  it('a non-array is passed through untouched', () => {
    expect(gateCockpitFilings(null, false)).toBeNull();
    expect(gateCockpitFilings(undefined, false)).toBeUndefined();
  });
});

describe('the projection keeps `source: \'cockpit\'` as _fromCockpit (D-A8)', () => {
  it('a cockpit filing\'s message carries _fromCockpit; no other message carries the key at all', () => {
    const messages = deriveChatMessages([ASK, CHIP, COCKPIT]);
    const cockpit = messages.filter((m) => m._fromCockpit === true);
    expect(cockpit).toHaveLength(1);
    expect(cockpit[0].directive.text).toBe("Hold off on AMD until today's close");
    for (const m of messages.filter((x) => x !== cockpit[0])) expect('_fromCockpit' in m).toBe(false);
  });

  it('a list without cockpit filings projects exactly as before (no new key anywhere)', () => {
    for (const m of deriveChatMessages([ASK, CHIP])) expect(Object.keys(m)).not.toContain('_fromCockpit');
  });
});
