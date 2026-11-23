// src/utils/filmRoomGate.debrief.test.js
//
// Film Room D2 item 1 — the client half of the WORDS gate (D2 spec §8; DW-9): the mode read at call time and failing
// closed, the pure per-owner resolution on the verdict the flow already holds, and when the front asks for a verdict at
// all. The screen's own rows (the words only where the flow and the debrief both resolve on; one read, and none with the
// words off) are FilmRoomFlow.words.*'s.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const flags = vi.hoisted(() => ({ debrief: 'off', throws: false }));
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_DEBRIEF_MODE() { if (flags.throws) throw new Error('hermetic mock omitted the name'); return flags.debrief; },
}));
vi.mock('firebase/auth', () => ({ getAuth: () => ({ currentUser: null }) }));

import { resolveFilmRoomDebriefMode, filmRoomDebriefOn, filmRoomFrontVerdictAsked, filmRoomFlowOn } from './filmRoomGate';

beforeEach(() => { flags.debrief = 'off'; flags.throws = false; });

describe('resolveFilmRoomDebriefMode — read at call time; unknown or unreadable → off', () => {
  it('off, allowlist and on resolve to themselves', () => {
    flags.debrief = 'off'; expect(resolveFilmRoomDebriefMode()).toBe('off');
    flags.debrief = 'allowlist'; expect(resolveFilmRoomDebriefMode()).toBe('allowlist');
    flags.debrief = 'on'; expect(resolveFilmRoomDebriefMode()).toBe('on');
  });
  it('an unknown value → off', () => {
    for (const v of ['ON', '', true, null, undefined, 'allow']) { flags.debrief = v; expect(resolveFilmRoomDebriefMode(), String(v)).toBe('off'); }
  });
  it('a mock that throws on the name → off', () => {
    flags.throws = true;
    expect(resolveFilmRoomDebriefMode()).toBe('off');
  });
});

describe('filmRoomDebriefOn — pure; the verdict the flow holds; undefined (pending) reads as off', () => {
  it("'on': on whatever the verdict", () => {
    expect(filmRoomDebriefOn('on', undefined)).toBe(true);
    expect(filmRoomDebriefOn('on', false)).toBe(true);
    expect(filmRoomDebriefOn('on', true)).toBe(true);
  });
  it("'allowlist': only a definite yes", () => {
    expect(filmRoomDebriefOn('allowlist', true)).toBe(true);
    expect(filmRoomDebriefOn('allowlist', false)).toBe(false);
    expect(filmRoomDebriefOn('allowlist', undefined)).toBe(false);
    expect(filmRoomDebriefOn('allowlist', 'true')).toBe(false);
    expect(filmRoomDebriefOn('allowlist', 1)).toBe(false);
  });
  it("'off' and anything unknown: never", () => {
    for (const v of [true, false, undefined]) {
      expect(filmRoomDebriefOn('off', v)).toBe(false);
      expect(filmRoomDebriefOn('nonsense', v)).toBe(false);
      expect(filmRoomDebriefOn(undefined, v)).toBe(false);
    }
  });
  it('the words show only where the flow AND the debrief resolve on — every pair of modes, every verdict', () => {
    const words = (flow, debrief, v) => filmRoomFlowOn(flow, v) && filmRoomDebriefOn(debrief, v);
    expect(words('allowlist', 'allowlist', true)).toBe(true);
    expect(words('allowlist', 'allowlist', undefined)).toBe(false);
    expect(words('allowlist', 'allowlist', false)).toBe(false);
    expect(words('on', 'allowlist', false)).toBe(false);
    expect(words('on', 'allowlist', true)).toBe(true);
    expect(words('allowlist', 'on', false)).toBe(false);
    expect(words('off', 'on', true)).toBe(false);
    expect(words('on', 'off', true)).toBe(false);
  });
});

describe('filmRoomFrontVerdictAsked — when the front asks for the verdict at all (through the one cached reader)', () => {
  it("the flow 'allowlist': asked (the front waits on it), whatever the words' mode", () => {
    for (const d of ['off', 'allowlist', 'on']) expect(filmRoomFrontVerdictAsked('allowlist', d), d).toBe(true);
  });
  it("the flow 'on': asked only while the words are 'allowlist'", () => {
    expect(filmRoomFrontVerdictAsked('on', 'allowlist')).toBe(true);
    expect(filmRoomFrontVerdictAsked('on', 'on')).toBe(false);
    expect(filmRoomFrontVerdictAsked('on', 'off')).toBe(false);
  });
  it("the flow 'off' (no front, no words) or unknown: never asked", () => {
    for (const d of ['off', 'allowlist', 'on']) {
      expect(filmRoomFrontVerdictAsked('off', d), d).toBe(false);
      expect(filmRoomFrontVerdictAsked('nonsense', d), d).toBe(false);
    }
  });
});
