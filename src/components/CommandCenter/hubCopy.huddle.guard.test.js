// src/components/CommandCenter/hubCopy.huddle.guard.test.js
//
// Huddle S1 — the Huddle's hub words (Huddle spec Amendment C V1.2 §C8, §C14; Command Center spec V1.2 Amendment D §D6;
// docs/design/SHADOW_VOICE_RULES_V1.md §3). hubCopy.guard.test.js already holds the whole table, this block included, to the
// no-learning list, the numeral rule and the pairing fence, UNLOOSENED (C14). This file adds the voice rules' own forbidden
// terms over the block, pins the words the receipts map to, and checks that a status never promises a clock time or an outcome.

import { describe, it, expect } from 'vitest';
import { HUB_COPY } from './hub/hubCopy';
import { FORBIDDEN_SCRIPT_PATTERNS } from '../../../api/_utils/huddle/scriptPrompt.js';

const H = HUB_COPY.huddle;
/** Every string the block can produce: its literals, and each function called with placeholder arguments. */
function strings(node, out = []) {
  if (typeof node === 'string') out.push(node);
  else if (typeof node === 'function') {
    const sample = node('ARG0', { ARG0: 'ARG1' });
    if (typeof sample === 'string') out.push(sample);
    for (const kind of ['HOLD', 'TRIM', 'WATCH', 'CHASE', 'FADE', 'NO_ADDS_BEFORE', 'NO_SWAPS_TODAY', 'CUT_IF_BELOW', 'NO_CHASE_ABOVE']) {
      const item = node({ kind, ticker: 'ARGT', level: 48, eventId: 'e' }, { e: 'the ARGE data' });
      if (typeof item === 'string' && item) out.push(item);
    }
  } else if (node && typeof node === 'object') for (const v of Object.values(node)) strings(v, out);
  return out;
}
const ALL = [...new Set(strings(H))].filter(Boolean);

describe('the Huddle block of hubCopy.js', () => {
  it('is not empty, and is read whole (the sampler reaches every function)', () => {
    expect(ALL.length).toBeGreaterThan(60);
    expect(ALL).toContain('Hold ARGT');
    expect(ALL).toContain("Don't chase ARGT above 48.00");
  });

  it('trips none of the voice rules\' forbidden patterns that apply to words on the hub (no clock promise, no guarantee, no "will", no "has seen", no volume)', () => {
    const applicable = ['clock_930', 'agent_clock', 'guarantee', 'will_do', 'has_seen', 'premarket_number', 'rvol', 'volume_number', 'nothing_happened'];
    const hits = ALL.flatMap((s) => applicable.filter((name) => FORBIDDEN_SCRIPT_PATTERNS[name].test(s)).map((name) => `${name}: ${s}`));
    expect(hits).toEqual([]);
  });

  it('claims nothing about learning, and never pairs the plan with an idea (C14)', () => {
    expect(ALL.filter((s) => /\b(learn|improv|smart|evolv|grow|remember|unlock|intelligen|earned|tier)\w*/i.test(s))).toEqual([]);
    expect(ALL.filter((s) => /\bidea/i.test(s))).toEqual([]);
  });

  it('writes no number of its own: a duration, a time and a level all come from data (C14 numeral rule)', () => {
    const literalDigits = ALL.filter((s) => s !== "Don't chase ARGT above 48.00").flatMap((s) => s.replace(/ARG\w+/g, '').replace(/\b48\.00\b/g, '').match(/\d/g) || []);
    expect(literalDigits).toEqual([]);
  });

  it('a Partnership game plan is a session\'s trading control, never a preference (AR-10)', () => {
    expect(H.partnershipNote).toBe('A game plan is a trading instruction for one session. It never stands as a preference.');
  });

  it('the receipt words, pinned (spec §6.4, A §A4, C §C3, §C7, §C15)', () => {
    expect({ ...H.battle, heard: H.battle.heard('T'), noLongerCurrentSince: H.battle.noLongerCurrentSince('T') }).toEqual({
      filed: "Filed · waiting for your agent's next read",
      firstRead: "Waiting for your agent's first read",
      heard: 'Read by your agent at T',
      noLongerCurrent: 'No longer current',
      noLongerCurrentSince: 'No longer current since T',
      retired: 'Retired at the close',
      liveCall: 'Waiting on your cockpit call',
      inactive: 'Waiting for the game to be live',
      retry: 'Waiting to file',
      staleApproach: 'Confirmed under a different approach · Reconfirm',
      otherSession: "Not this session's game",
      newerInstruction: 'Your newer instruction stands',
      unsupported: "Not filed for this game's archetype",
      expired: 'Expired at the close',
    });
    expect([H.readyTitle, H.open, H.deployReconfirm, H.deployReconfirmDoor]).toEqual(['Huddle ready', 'Open huddle', 'Your game plan was confirmed under a different approach.', 'Reconfirm']);
  });

  it('the forbidden patterns bite on planted hub strings', () => {
    for (const planted of ['Your agent will buy at 9:30.', 'Guaranteed to work.', 'Your agent has seen your plan.']) {
      expect(Object.values(FORBIDDEN_SCRIPT_PATTERNS).some((re) => re.test(planted)), planted).toBe(true);
    }
  });
});
