// api/_utils/sharedResearch/copy.guard.test.js
//
// Shared Research B1 — the server's player-facing lines, guarded like hub copy
// (spec §6.1): the hub's banned list (hubCopy.guard.test.js) plus "Shadow",
// "confidence" and "%"; the pause line is the spec's own (§6.12 control 4).

import { describe, it, expect } from 'vitest';
import { SR_SERVER_COPY, copyFor } from './copy.js';

const BANNED = [
  /\blearn/i, /\bimprov/i, /\bintelligen/i, /\bsmart(er)?\b/i, /\bearned\b/i, /\btier\b/i, /getting better/i,
  /\bevolv/i, /\bgrow(s|th|ing)?\b/i, /since your last visit/i, /\blevel(s|led)? up\b/i, /\bunlock/i,
  /\bsources?\s*·\s*\d/i, /\bremembers?\b/i, /\bTester\b/, /\bsimulat/i, /\bprototype\b/i, /\billustrative\b/i,
  /\bShadow\b/, /confiden/i, /%/,
];

describe('the server copy', () => {
  it('no line matches a banned claim', () => {
    const hits = Object.entries(SR_SERVER_COPY).flatMap(([k, s]) => BANNED.filter((re) => re.test(s)).map((re) => `${k}: ${re.source}`));
    expect(hits).toEqual([]);
  });
  it('the pause line is the spec\'s, word for word', () => {
    expect(SR_SERVER_COPY.budget_paused).toBe('Research steps are paused for today — the daily research budget is used. Your investigation is kept; reading, saving an idea and closing still work.');
  });
  it('an unknown code reads the generic line', () => {
    expect(copyFor('nope')).toBe(SR_SERVER_COPY.server_error);
    expect(copyFor('toString')).toBe(SR_SERVER_COPY.server_error);
  });
});
