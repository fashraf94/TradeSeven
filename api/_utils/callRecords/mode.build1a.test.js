// api/_utils/callRecords/mode.build1a.test.js
//
// Cockpit Build 1a — PER-BATTLE ACTIVATION and the in-memory CHECK CONTEXT
// (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md §3, §15.1 "composition (four rows +
// allowlist row + neighbor isolation)"; contract Amendment B §10). The live
// values are pinned in src/config/{callRecordsFlags,cockpitFlags}.test.js; here
// both flags are driven through getters so every state (and a broken one) is
// proven without touching the source.

import { describe, it, expect, vi, afterEach } from 'vitest';

const flag = vi.hoisted(() => ({ mode: 'off', allow: [], modeThrows: false, allowThrows: false }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    get CALL_RECORDS_MODE() {
      if (flag.modeThrows) throw new Error('[vitest] No "CALL_RECORDS_MODE" export is defined on the mock');
      return flag.mode;
    },
    get COCKPIT_ALLOWLIST_UIDS() {
      if (flag.allowThrows) throw new Error('[vitest] No "COCKPIT_ALLOWLIST_UIDS" export is defined on the mock');
      return flag.allow;
    },
  };
});

const {
  resolveCallRecordsMode, resolveGlobalCallRecordsMode, isCockpitOwnerAllowlisted, attachCheckContext, checkContextOf, createCallsContext, callsActive,
} = await import('./mode.js');

const ALLOWED = 'owner-allowed';
const OTHER = 'owner-other';
const battleOf = (ownerId, over = {}) => ({ id: `battle-${ownerId}`, ownerId, status: 'active', directive: null, ...over });

afterEach(() => { flag.mode = 'off'; flag.allow = []; flag.modeThrows = false; flag.allowThrows = false; });

describe('resolveCallRecordsMode(battle) — the composition rows (spec §3)', () => {
  it("global 'off' → 'off' for every battle, allowlisted or not", () => {
    flag.mode = 'off'; flag.allow = [ALLOWED];
    expect(resolveCallRecordsMode(battleOf(ALLOWED))).toBe('off');
    expect(resolveCallRecordsMode(battleOf(OTHER))).toBe('off');
  });

  it("global 'shadow' → 'shadow' for every battle; the allowlist is not consulted", () => {
    flag.mode = 'shadow'; flag.allow = [ALLOWED];
    expect(resolveCallRecordsMode(battleOf(ALLOWED))).toBe('shadow');
    expect(resolveCallRecordsMode(battleOf(OTHER))).toBe('shadow');
    flag.allowThrows = true; // even a broken allowlist cannot change a shadow resolution
    expect(resolveCallRecordsMode(battleOf(ALLOWED))).toBe('shadow');
  });

  it("global 'on' → 'on' iff the owner is allowlisted, else 'off' (per-owner off)", () => {
    flag.mode = 'on'; flag.allow = [ALLOWED];
    expect(resolveCallRecordsMode(battleOf(ALLOWED))).toBe('on');
    expect(resolveCallRecordsMode(battleOf(OTHER))).toBe('off');
  });

  it("the allowlist row: global 'on' with an EMPTY list resolves every battle 'off' (the shipped state)", () => {
    flag.mode = 'on'; flag.allow = [];
    expect(resolveCallRecordsMode(battleOf(ALLOWED))).toBe('off');
    expect(resolveCallRecordsMode(battleOf(OTHER))).toBe('off');
  });

  it("malformed → 'off': a non-array allowlist, a non-string / missing owner, a null battle, a throwing allowlist", () => {
    flag.mode = 'on';
    for (const bad of ['owner-allowed', { 0: ALLOWED }, null, undefined, 42]) {
      flag.allow = bad;
      expect(resolveCallRecordsMode(battleOf(ALLOWED)), `allowlist ${String(bad)}`).toBe('off');
    }
    flag.allow = [ALLOWED];
    for (const owner of [undefined, null, '', 7, { uid: ALLOWED }]) {
      expect(resolveCallRecordsMode(battleOf(owner)), `owner ${String(owner)}`).toBe('off');
    }
    expect(resolveCallRecordsMode(null)).toBe('off');
    flag.allowThrows = true;
    expect(() => resolveCallRecordsMode(battleOf(ALLOWED))).not.toThrow();
    expect(resolveCallRecordsMode(battleOf(ALLOWED))).toBe('off');
  });

  it("an unknown global value, or a mock that omits the name, resolves 'off' with or without a battle", () => {
    flag.allow = [ALLOWED];
    for (const bogus of ['ON', 'enabled', '', null, true]) {
      flag.mode = bogus;
      expect(resolveCallRecordsMode(battleOf(ALLOWED)), String(bogus)).toBe('off');
      expect(resolveCallRecordsMode(), String(bogus)).toBe('off');
    }
    flag.modeThrows = true;
    expect(resolveCallRecordsMode(battleOf(ALLOWED))).toBe('off');
    expect(resolveGlobalCallRecordsMode()).toBe('off');
  });

  it('WITHOUT a battle the resolver returns the GLOBAL value — the sweep\'s global gate', () => {
    flag.allow = [];
    for (const mode of ['off', 'shadow', 'on']) {
      flag.mode = mode;
      expect(resolveCallRecordsMode()).toBe(mode);
    }
  });

  it('isCockpitOwnerAllowlisted: exact string membership only', () => {
    flag.allow = [ALLOWED];
    expect(isCockpitOwnerAllowlisted(ALLOWED)).toBe(true);
    expect(isCockpitOwnerAllowlisted(ALLOWED.toUpperCase())).toBe(false);
    expect(isCockpitOwnerAllowlisted(` ${ALLOWED}`)).toBe(false);
    expect(isCockpitOwnerAllowlisted(OTHER)).toBe(false);
  });
});

describe('neighbor isolation — two battles in one run never share a resolution or a context', () => {
  it("an allowlisted battle resolves 'on' and its neighbor 'off', each from its own owner, in either order", () => {
    flag.mode = 'on'; flag.allow = [ALLOWED];
    const a = battleOf(ALLOWED);
    const b = battleOf(OTHER);
    const ctxA = createCallsContext({ mode: resolveCallRecordsMode(a), handlerStartMs: 1 });
    const ctxB = createCallsContext({ mode: resolveCallRecordsMode(b), handlerStartMs: 1 });
    attachCheckContext(a, { mode: ctxA.mode, nowMs: 1_000 });
    attachCheckContext(b, { mode: ctxB.mode, nowMs: 2_000 });
    expect([ctxA.mode, ctxB.mode]).toEqual(['on', 'off']);
    expect(callsActive(ctxA.mode)).toBe(true);
    expect(callsActive(ctxB.mode)).toBe(false);
    expect(checkContextOf(a)).toEqual({ mode: 'on', instantMs: 1_000 });
    expect(checkContextOf(b)).toEqual({ mode: 'off', instantMs: 2_000 });
    // The reverse order resolves the same.
    expect(resolveCallRecordsMode(b)).toBe('off');
    expect(resolveCallRecordsMode(a)).toBe('on');
  });
});

describe('attachCheckContext / checkContextOf — in memory, non-enumerable, never persisted', () => {
  it('attaches the mode and one finite instant; a reader without an attachment gets nulls (fails closed)', () => {
    const battle = battleOf(ALLOWED);
    expect(checkContextOf(battle)).toEqual({ mode: null, instantMs: null });
    expect(attachCheckContext(battle, { mode: 'on', nowMs: 123_456 })).toEqual({ mode: 'on', instantMs: 123_456 });
    expect(checkContextOf(battle)).toEqual({ mode: 'on', instantMs: 123_456 });
  });

  it('a non-finite instant is stored as null — the reader fails closed exactly as with no attachment', () => {
    for (const bad of [NaN, Infinity, -Infinity, '123', null, undefined]) {
      const battle = battleOf(ALLOWED);
      attachCheckContext(battle, { mode: 'on', nowMs: bad });
      expect(checkContextOf(battle), String(bad)).toEqual({ mode: 'on', instantMs: null });
    }
  });

  it('NEVER persisted: both keys are invisible to spread, JSON.stringify, Object.keys, structuredClone and Object.assign(copy, battle)', () => {
    const battle = battleOf(ALLOWED, { cronState: { evalSeq: 3 } });
    attachCheckContext(battle, { mode: 'on', nowMs: 1_000 });
    expect(Object.keys(battle)).not.toContain('__callsMode');
    expect(Object.keys(battle)).not.toContain('__checkInstantMs');
    expect(JSON.stringify(battle)).not.toMatch(/__callsMode|__checkInstantMs/);
    expect({ ...battle }).not.toHaveProperty('__callsMode');
    expect(structuredClone(battle)).not.toHaveProperty('__checkInstantMs');
    expect(Object.assign({}, battle)).not.toHaveProperty('__callsMode');
  });

  it("the cron's refresh — Object.assign(battle, freshDoc) — leaves both in place", () => {
    const battle = battleOf(ALLOWED, { cronState: { evalSeq: 3 } });
    attachCheckContext(battle, { mode: 'on', nowMs: 1_000 });
    Object.assign(battle, { cronState: { evalSeq: 4 }, directive: { text: 'x', directiveThreadId: 't' } });
    expect(checkContextOf(battle)).toEqual({ mode: 'on', instantMs: 1_000 });
    expect(battle.cronState.evalSeq).toBe(4);
  });

  it('a non-object battle is refused without throwing', () => {
    expect(attachCheckContext(null, { mode: 'on', nowMs: 1 })).toBeNull();
    expect(attachCheckContext(undefined, { mode: 'on', nowMs: 1 })).toBeNull();
    expect(checkContextOf(null)).toEqual({ mode: null, instantMs: null });
  });
});
