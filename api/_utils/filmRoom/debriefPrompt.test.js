// api/_utils/filmRoom/debriefPrompt.test.js
//
// Film Room D2 item 3 — THE PROMPT (D2 spec §3, §4): the system text states §4's rules and names the writer by its
// archetype's display name only; the user text is the digest's canonical JSON — the bytes its hash is taken over; the
// schema names the digest's labels and closes every object, with no constraint structured outputs refuse.

import { describe, it, expect } from 'vitest';
import { buildDebriefPrompt, debriefSystemText, debriefSchema, DEBRIEF_LINE_MAX } from './debriefPrompt.js';
import { canonicalDigestJson, digestHashOf } from './dayDigest.js';
import { FORBIDDEN_WORDS } from '../../../src/screens/filmRoomV2/filmRoomCopy.js';
import { SPEC_FORBIDDEN_WORDS } from '../../../src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx';

const DIGEST = {
  day: { final: true, result: 'win', finals: { you: '−47', cpu: '−93' } },
  archetype: 'Momentum',
  swaps: [
    { label: 's1', time: '12:45 PM', maker: 'the stall rule', sold: 'MSFT', bought: 'CRWD', soldAt: '498.79' },
    { label: 's2', time: '2:00 PM', maker: 'your agent', sold: 'DE', bought: 'PLTR', before: { saidBy: 'the agent, in its own recorded words at the time', at: '1:45 PM', rationale: 'PLTR is pressing.' } },
  ],
};

describe('the system text (§3, §4)', () => {
  const sys = debriefSystemText(DIGEST);
  it('names the writer by its archetype\'s display name — and with none, simply "the agent"', () => {
    expect(sys).toContain('You are the Momentum agent');
    expect(debriefSystemText({ ...DIGEST, archetype: null })).toContain('You are the agent:');
  });
  it('states every rule §4 lists', () => {
    for (const s of [
      'At most one line per swap, about that swap only', 'first person', 'to your own player',
      'At most two short sentences, in plain words', `under ${DEBRIEF_LINE_MAX} characters`,
      'Say what happened and why, from your own recorded words', 'For a swap you did not make, say plainly who made it',
      'No numbers of any kind: no digits, no number words, no ordinals',
      "Name no symbol except the swap's own and those in its recorded words",
      'No verdict', 'give no grade', 'draw no lesson', 'never claim that anything was proven',
      'When there is nothing true to add about a swap, write no line for it',
    ]) expect(sys, s).toContain(s);
  });
  it('lists the forbidden words — the production constant the checks enforce, equal to the harness\'s pinned list', () => {
    expect(FORBIDDEN_WORDS).toEqual(SPEC_FORBIDDEN_WORDS);
    expect(sys).toContain(`Never use these words or phrases: ${FORBIDDEN_WORDS.join(', ')}.`);
  });
  it('holds nothing of the day but the archetype\'s name: no symbol, no time, no words — those are the user text\'s', () => {
    for (const s of ['MSFT', 'CRWD', '12:45', 'PLTR is pressing', '498.79', 'Quinzel']) expect(sys.includes(s), s).toBe(false);
  });
});

describe('the user text: the digest as its canonical JSON', () => {
  it('is exactly the bytes the digest\'s hash is taken over', () => {
    const { user } = buildDebriefPrompt(DIGEST);
    expect(user).toBe(canonicalDigestJson(DIGEST));
    expect(JSON.parse(user)).toEqual(DIGEST);
    expect(digestHashOf(JSON.parse(user))).toBe(digestHashOf(DIGEST));
  });
});

describe('the output schema (§3)', () => {
  it('{ lines: [{ swap: one of the digest\'s labels, text }] } — every object closed, both fields required', () => {
    expect(debriefSchema(DIGEST)).toEqual({
      type: 'object',
      properties: { lines: { type: 'array', items: { type: 'object', properties: { swap: { type: 'string', enum: ['s1', 's2'] }, text: { type: 'string' } }, required: ['swap', 'text'], additionalProperties: false } } },
      required: ['lines'],
      additionalProperties: false,
    });
  });
  it('holds no constraint structured outputs refuse (no counts, no lengths, no bounds)', () => {
    const json = JSON.stringify(debriefSchema(DIGEST));
    for (const k of ['maxItems', 'minItems', 'uniqueItems', 'maxLength', 'minLength', 'minimum', 'maximum', 'pattern']) expect(json.includes(k), k).toBe(false);
  });
  it('a digest with no swap names no label (the pass never calls for it)', () => {
    expect(debriefSchema({ ...DIGEST, swaps: [] }).properties.lines.items.properties.swap.enum).toEqual([]);
  });
});
