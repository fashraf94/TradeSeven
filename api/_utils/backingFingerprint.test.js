// api/_utils/backingFingerprint.test.js
//
// Backing Beta PR 2, carry-in E1 — the stake fingerprint (spec V1.3 §6, §8).
//
// The property under test is "NEVER RAW, AND NOT A LOOKUP KEY": the stored
// digest must not be derivable from the IP alone, or "hashed" is a word rather
// than a protection. The salt rows below are what make that assertion mean
// something, and the unsalted fallback is asserted to be LOUD rather than
// silent — a production deploy that reached it would be storing weaker data
// than the module claims.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  __resetSaltWarning, clientIpOf, fingerprintOf, hashFingerprint, resolveSalt,
} from './backingFingerprint.js';

const ENV = ['BACKING_FINGERPRINT_SALT', 'CRON_SECRET'];
const saved = {};

beforeEach(() => {
  for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; }
  __resetSaltWarning();
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

describe('the salt, in precedence order', () => {
  it('1. uses BACKING_FINGERPRINT_SALT when an operator sets one', () => {
    process.env.BACKING_FINGERPRINT_SALT = 'the-dedicated-knob';
    process.env.CRON_SECRET = 'should-not-be-used';
    expect(resolveSalt()).toBe('the-dedicated-knob');
  });

  it('2. otherwise DERIVES from CRON_SECRET, with key separation', () => {
    process.env.CRON_SECRET = 'cron-secret-value';
    const salt = resolveSalt();
    // The derived salt is NOT the secret: a leaked fingerprint doc must not be a
    // step toward the cron secret.
    expect(salt).not.toBe('cron-secret-value');
    expect(salt).not.toContain('cron-secret-value');
    expect(salt).toMatch(/^[0-9a-f]{64}$/);
    // And it is separated by a fixed label, not a bare hash of the secret.
    expect(salt).not.toBe(createHash('sha256').update('cron-secret-value').digest('hex'));
  });

  it('3. otherwise falls back, and says so ONCE rather than silently', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = resolveSalt();
    const b = resolveSalt();
    expect(a).toBe(b);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/de-identified, not keyed/);
  });

  it('is resolved at CALL time, so a rotation takes effect without a redeploy', () => {
    process.env.BACKING_FINGERPRINT_SALT = 'first';
    const before = hashFingerprint('203.0.113.9');
    process.env.BACKING_FINGERPRINT_SALT = 'second';
    expect(hashFingerprint('203.0.113.9')).not.toBe(before);
  });
});

describe('hashFingerprint — a digest, never the value', () => {
  beforeEach(() => { process.env.BACKING_FINGERPRINT_SALT = 'test-salt'; });

  it('is a 64-char hex sha256 that is NOT the bare hash of the input', () => {
    const digest = hashFingerprint('203.0.113.9');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    // THE ROW THAT MATTERS: an unsalted sha256 of an IPv4 address is reversible
    // by brute force over the whole address space. The salt is what stops the
    // stored value being a lookup key.
    expect(digest).not.toBe(createHash('sha256').update('203.0.113.9').digest('hex'));
  });

  it('is deterministic for one salt and distinct across inputs', () => {
    expect(hashFingerprint('a')).toBe(hashFingerprint('a'));
    expect(hashFingerprint('a')).not.toBe(hashFingerprint('b'));
  });

  it('`salted: false` is the plain content hash the stake ID needs', () => {
    expect(hashFingerprint('x', { salted: false }))
      .toBe(createHash('sha256').update('x').digest('hex'));
    // ...and it does not move when the salt does, which is the whole point: a
    // rotated salt must not mint a second stake document for one requestId.
    const before = hashFingerprint('x', { salted: false });
    process.env.BACKING_FINGERPRINT_SALT = 'rotated';
    expect(hashFingerprint('x', { salted: false })).toBe(before);
  });

  it('a non-string input hashes the empty string rather than throwing', () => {
    for (const bad of [undefined, null, 42, {}]) {
      expect(hashFingerprint(bad)).toBe(hashFingerprint(''));
    }
  });
});

describe('clientIpOf — the rate limiter\'s own precedence (§9: one answer)', () => {
  it('takes the FIRST hop of x-forwarded-for, trimmed', () => {
    expect(clientIpOf({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1, 10.0.0.2' } })).toBe('203.0.113.9');
    expect(clientIpOf({ headers: { 'x-forwarded-for': '  203.0.113.9  ' } })).toBe('203.0.113.9');
  });

  it('falls back to x-real-ip, then the socket, then the `unknown` sentinel', () => {
    expect(clientIpOf({ headers: { 'x-real-ip': '198.51.100.4' } })).toBe('198.51.100.4');
    expect(clientIpOf({ headers: {}, socket: { remoteAddress: '192.0.2.7' } })).toBe('192.0.2.7');
    expect(clientIpOf({ headers: {} })).toBe('unknown');
    expect(clientIpOf(undefined)).toBe('unknown');
  });
});

describe('fingerprintOf — the §6 pair, fixed shape', () => {
  beforeEach(() => { process.env.BACKING_FINGERPRINT_SALT = 'test-salt'; });

  it('carries exactly ipHash and uaHash, both digests', () => {
    const fp = fingerprintOf({ headers: { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Mozilla/5.0' } });
    expect(Object.keys(fp).sort()).toEqual(['ipHash', 'uaHash']);
    expect(fp.ipHash).toBe(hashFingerprint('203.0.113.9'));
    expect(fp.uaHash).toBe(hashFingerprint('Mozilla/5.0'));
    // Neither raw value appears anywhere in what would be stored.
    expect(JSON.stringify(fp)).not.toContain('203.0.113.9');
    expect(JSON.stringify(fp)).not.toContain('Mozilla');
  });

  it('a MISSING header hashes its sentinel — the shape is fixed, never partial', () => {
    const fp = fingerprintOf({ headers: {} });
    expect(Object.keys(fp).sort()).toEqual(['ipHash', 'uaHash']);
    expect(fp.uaHash).toBe(hashFingerprint('unknown'));
  });

  it('two different requests from one client share an ipHash — that is what it is for', () => {
    const a = fingerprintOf({ headers: { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'A' } });
    const b = fingerprintOf({ headers: { 'x-forwarded-for': '203.0.113.9', 'user-agent': 'B' } });
    expect(a.ipHash).toBe(b.ipHash);
    expect(a.uaHash).not.toBe(b.uaHash);
  });
});
