// api/mandate/create.test.js
//
// §7 founder-gate authorization logic. The endpoint's HTTP wiring is exercised
// in the acceptance harness; here we lock the load-bearing security property:
// a flag alone is NOT authorization, and an allowlisted uid alone is not either.

import { describe, it, expect, afterEach } from 'vitest';
import { isFounderAuthorized, founderAllowlist } from './create.js';

describe('mandate/create — §7 founder authorization (both conditions required)', () => {
  it('grants only when the flag is ON and the uid is allowlisted', () => {
    expect(isFounderAuthorized('u1', true, ['u1', 'u2'])).toBe(true);
  });

  it('a flag alone is NOT authorization (flag on, uid not allowlisted)', () => {
    expect(isFounderAuthorized('u1', true, ['u2'])).toBe(false);
    expect(isFounderAuthorized('u1', true, [])).toBe(false);
  });

  it('an allowlisted uid alone is NOT authorization (flag off)', () => {
    expect(isFounderAuthorized('u1', false, ['u1'])).toBe(false);
  });

  it('degrades safely on a malformed allowlist', () => {
    expect(isFounderAuthorized('u1', true, null)).toBe(false);
    expect(isFounderAuthorized('u1', true, undefined)).toBe(false);
  });
});

describe('mandate/create — founderAllowlist (env-driven; fail-closed when unset)', () => {
  const prev = process.env.MANDATE_FOUNDER_UIDS;
  afterEach(() => {
    if (prev === undefined) delete process.env.MANDATE_FOUNDER_UIDS;
    else process.env.MANDATE_FOUNDER_UIDS = prev;
  });

  it('is empty (nobody is a founder) when the env var is unset', () => {
    delete process.env.MANDATE_FOUNDER_UIDS;
    expect(founderAllowlist()).toEqual([]);
  });

  it('parses a comma-separated list and trims whitespace', () => {
    process.env.MANDATE_FOUNDER_UIDS = ' uidA , uidB ,,uidC ';
    expect(founderAllowlist()).toEqual(['uidA', 'uidB', 'uidC']);
  });
});
