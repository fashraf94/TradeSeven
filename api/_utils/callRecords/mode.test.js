// api/_utils/callRecords/mode.test.js
//
// Cockpit Build 0 — mode resolution fails CLOSED, and the calls context is the
// spec §3.3 shape. The live value is pinned in src/config/callRecordsFlags.test.js;
// here the flag is driven through a getter so every state (and a broken one)
// can be proven without touching the source.

import { describe, it, expect, vi, afterEach } from 'vitest';

const flag = vi.hoisted(() => ({ value: 'off', throws: false }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    get CALL_RECORDS_MODE() {
      if (flag.throws) throw new Error('[vitest] No "CALL_RECORDS_MODE" export is defined on the mock');
      return flag.value;
    },
  };
});

const { resolveCallRecordsMode, callsActive, createCallsContext, CALLS_MODE_OFF } = await import('./mode.js');

afterEach(() => { flag.value = 'off'; flag.throws = false; });

describe('resolveCallRecordsMode — once per check, fail closed', () => {
  it('returns each walked state as itself', () => {
    for (const mode of ['off', 'shadow', 'on']) {
      flag.value = mode;
      expect(resolveCallRecordsMode()).toBe(mode);
    }
  });

  it("an unknown value resolves to 'off' (fail closed), never to a guess", () => {
    for (const bogus of ['SHADOW', 'enabled', '', null, undefined, true, 1]) {
      flag.value = bogus;
      expect(resolveCallRecordsMode(), String(bogus)).toBe('off');
    }
  });

  it("a mock that omits the name (access throws) resolves to 'off' and does not throw", () => {
    flag.throws = true;
    expect(() => resolveCallRecordsMode()).not.toThrow();
    expect(resolveCallRecordsMode()).toBe(CALLS_MODE_OFF);
  });

  it("only 'shadow' and 'on' are active", () => {
    expect(callsActive('off')).toBe(false);
    expect(callsActive('shadow')).toBe(true);
    expect(callsActive('on')).toBe(true);
    expect(callsActive('bogus')).toBe(false);
  });
});

describe('createCallsContext — the spec §3.3 shape', () => {
  it('carries the resolved mode and the invocation clock, and starts empty', () => {
    const ctx = createCallsContext({ mode: 'shadow', handlerStartMs: 1234 });
    expect(ctx).toEqual({
      mode: 'shadow',
      handlerStartMs: 1234,
      fetchedQuotes: {},
      observation: null,
      evalIdentity: null,
      executorResult: null,
      exit: null,
      diag: {},
      declarations: null,
      universe: null,
    });
  });

  it('each call is a fresh object (request-local, never shared between checks)', () => {
    const a = createCallsContext({ mode: 'on', handlerStartMs: 1 });
    const b = createCallsContext({ mode: 'on', handlerStartMs: 1 });
    expect(a).not.toBe(b);
    expect(a.fetchedQuotes).not.toBe(b.fetchedQuotes);
    expect(a.diag).not.toBe(b.diag);
  });
});
