// src/screens/battleView/deriveHeard.test.js
//
// Phase B (B1 client half, seed §1 / §7). The import below IS the guard: this
// file imports the module it guards, so a browser dependency entering the
// graph explodes here in the Node env (BUILD_RULES §4). Never mock it.
//
// What these rows defend, in one line each: Heard is a stamp, not an
// inference; the newest check wins; a withheld directive is NOT Heard and
// never says why; and an unstamped thread makes no claim at all.

import { describe, it, expect } from 'vitest';
import { deriveHeard } from './deriveHeard';

const T1 = '2026-09-09T14:02:00.000Z';
const T2 = '2026-09-09T14:17:00.000Z';
const T3 = '2026-09-09T14:32:00.000Z';

const entry = (timestamp, heard) => ({ timestamp, ...(heard === undefined ? {} : { heard }) });

describe('deriveHeard — the stamp, and only the stamp', () => {
  it('a null suppression is Heard, stamped with the entry\'s own instant', () => {
    const out = deriveHeard([entry(T1, { directiveThreadId: 'thread-a', suppressed: null })]);
    expect(out).toEqual({ 'thread-a': { at: T1, heard: true } });
  });

  it('a suppressed directive is NOT Heard — and the reason never leaves the stamp', () => {
    for (const reason of ['malformed', 'mode_not_enforce', 'epoch_killed', 'unknown']) {
      const out = deriveHeard([entry(T1, { directiveThreadId: 'thread-a', suppressed: reason })]);
      expect(out['thread-a']).toEqual({ at: T1, heard: false });
      // The derivation carries no reason field at all, so no renderer can
      // reach one (Sol M-1 — the four words are telemetry, not copy).
      expect(JSON.stringify(out)).not.toContain(reason);
    }
  });

  it('LAST ENTRY PER THREAD WINS — heard at 14:02, withheld at 14:17 reads as withheld', () => {
    const out = deriveHeard([
      entry(T1, { directiveThreadId: 'thread-a', suppressed: null }),
      entry(T2, { directiveThreadId: 'thread-a', suppressed: 'epoch_killed' }),
    ]);
    expect(out['thread-a']).toEqual({ at: T2, heard: false });
  });

  it('and the other way round — withheld, then heard, reads as heard at the newer check', () => {
    const out = deriveHeard([
      entry(T1, { directiveThreadId: 'thread-a', suppressed: 'mode_not_enforce' }),
      entry(T2, { directiveThreadId: 'thread-a', suppressed: null }),
    ]);
    expect(out['thread-a']).toEqual({ at: T2, heard: true });
  });

  it('threads are independent — each keeps its own last entry', () => {
    const out = deriveHeard([
      entry(T1, { directiveThreadId: 'thread-a', suppressed: null }),
      entry(T2, { directiveThreadId: 'thread-b', suppressed: 'malformed' }),
      entry(T3, { directiveThreadId: 'thread-a', suppressed: null }),
    ]);
    expect(out).toEqual({
      'thread-a': { at: T3, heard: true },
      'thread-b': { at: T2, heard: false },
    });
  });
});

describe('absence is absence — no stamp, no claim (D-113, presence-gated)', () => {
  it('an entry with no `heard` key yields nothing — the pre-flip and budget_skipped case', () => {
    expect(deriveHeard([entry(T1), entry(T2)])).toEqual({});
  });

  it('THE MID-TICK FILING: a thread with no stamped entry is simply absent', () => {
    // The filing landed during the tick, so the cron stamped the OLDER thread.
    // The new thread gets no line until the next check stamps it.
    const out = deriveHeard([entry(T1, { directiveThreadId: 'thread-old', suppressed: null })]);
    expect(out['thread-new']).toBeUndefined();
    expect(out['thread-old']).toEqual({ at: T1, heard: true });
  });

  it('a non-array, an empty array, and null entries are all {}', () => {
    expect(deriveHeard(undefined)).toEqual({});
    expect(deriveHeard(null)).toEqual({});
    expect(deriveHeard([])).toEqual({});
    expect(deriveHeard([null, undefined, 42, 'x'])).toEqual({});
  });

  it('a stamp with no usable thread id is skipped, never keyed under a placeholder', () => {
    const out = deriveHeard([
      entry(T1, { directiveThreadId: '', suppressed: null }),
      entry(T2, { directiveThreadId: null, suppressed: null }),
      entry(T3, { suppressed: null }),
    ]);
    expect(out).toEqual({});
  });

  it('an UNRECOGNISED suppression shape makes NO claim — never a default "not heard"', () => {
    // "Not heard" is a claim too. The server writes null or a non-empty
    // string; anything else is a shape the composer cannot produce, and this
    // stays silent rather than asserting the negative.
    for (const bad of [undefined, 0, false, '', {}, []]) {
      const out = deriveHeard([entry(T1, { directiveThreadId: 'thread-a', suppressed: bad })]);
      expect(out).toEqual({});
    }
  });

  it('a missing timestamp still records the verdict, with a null slot', () => {
    const out = deriveHeard([{ heard: { directiveThreadId: 'thread-a', suppressed: null } }]);
    expect(out['thread-a']).toEqual({ at: null, heard: true });
  });
});
