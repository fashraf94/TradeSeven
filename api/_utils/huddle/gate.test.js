// api/_utils/huddle/gate.test.js
//
// Huddle — the server's gate (Amendment A §A10; Amendment E §E7): the flag, and the Huddle's own fail-closed cohort.
// Cohort unset, empty, outside and inside, under the flag on and off. The flag is held by a getter mock so each row
// sets it, whatever the shipped value.

import { describe, it, expect, vi } from 'vitest';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('../../../src/config/huddleFlags.js', () => ({ get DRB_HUDDLE_ENABLED() { return flag.on; } }));

const { isHuddleOn, isHuddleLive, huddleAdmits, huddleCohortOf, COHORT_ENV } = await import('./gate.js');

const env = (raw) => (raw === undefined ? {} : { [COHORT_ENV]: raw });

describe('the cohort (E7): HUDDLE_PLAYER_UIDS, failing closed', () => {
  it('is named HUDDLE_PLAYER_UIDS, the Huddle\'s own (never the cockpit allowlist)', () => {
    expect(COHORT_ENV).toBe('HUDDLE_PLAYER_UIDS');
  });

  it('UNSET is the empty set: no one', () => {
    expect([...huddleCohortOf(env(undefined))]).toEqual([]);
    expect([...huddleCohortOf({ [COHORT_ENV]: 42 })]).toEqual([]);
    expect([...huddleCohortOf(null)]).toEqual([]);
  });

  it('EMPTY or blank is the empty set: no one', () => {
    for (const raw of ['', '   ', ',', ' , , ']) expect([...huddleCohortOf(env(raw))], JSON.stringify(raw)).toEqual([]);
  });

  it('a list is trimmed and de-duplicated', () => {
    expect([...huddleCohortOf(env(' a , b,a ,, c '))].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('isHuddleLive: on for anyone = the flag on AND a non-empty cohort', () => {
  it('flag on: unset and empty are NOT live; one uid is', () => {
    flag.on = true;
    expect(isHuddleLive(env(undefined))).toBe(false);
    expect(isHuddleLive(env(''))).toBe(false);
    expect(isHuddleLive(env(' , '))).toBe(false);
    expect(isHuddleLive(env('u1'))).toBe(true);
  });

  it('flag off: never live, whatever the cohort', () => {
    flag.on = false;
    expect(isHuddleOn()).toBe(false);
    expect(isHuddleLive(env('u1,u2'))).toBe(false);
    flag.on = true;
  });

  it('only exactly `true` is on', () => {
    flag.on = 'true';
    expect(isHuddleOn()).toBe(false);
    expect(isHuddleLive(env('u1'))).toBe(false);
    flag.on = true;
  });
});

describe('huddleAdmits: on for this player', () => {
  it('cohort unset or empty: nobody is admitted', () => {
    flag.on = true;
    expect(huddleAdmits('u1', env(undefined))).toBe(false);
    expect(huddleAdmits('u1', env(''))).toBe(false);
  });

  it('OUTSIDE: a uid not in the cohort is not admitted; INSIDE: one in it is', () => {
    flag.on = true;
    expect(huddleAdmits('u3', env('u1,u2'))).toBe(false);
    expect(huddleAdmits('u2', env('u1, u2'))).toBe(true);
  });

  it('a missing, empty or non-string uid is never admitted, even against a cohort that holds an empty entry', () => {
    flag.on = true;
    for (const uid of [undefined, null, '', 7, {}]) expect(huddleAdmits(uid, env('u1,,u2'))).toBe(false);
  });

  it('flag off: nobody, even inside the cohort', () => {
    flag.on = false;
    expect(huddleAdmits('u1', env('u1'))).toBe(false);
    flag.on = true;
  });

  it('reads the env on every call (the founder sets it in Vercel; the next invocation obeys)', () => {
    flag.on = true;
    const live = { [COHORT_ENV]: '' };
    expect(huddleAdmits('u1', live)).toBe(false);
    live[COHORT_ENV] = 'u1';
    expect(huddleAdmits('u1', live)).toBe(true);
  });
});
