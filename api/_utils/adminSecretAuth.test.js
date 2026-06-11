// api/_utils/adminSecretAuth.test.js
//
// The shared admin/cron secret gate, plus the P1b pure variant
// (isAdminSecretValid) that user-authed endpoints use to honor admin-only
// OPTIONAL flags: an invalid or absent secret must silently disable the
// flag — never write a response, never 401 a normal user.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { isAdminSecretValid, requireAdminSecret } from './adminSecretAuth.js';

const SECRET = 'test-admin-secret';

function makeRes() {
  const res = { statusCode: null, payload: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.payload = payload; return res; };
  return res;
}

afterEach(() => vi.unstubAllEnvs());

describe('isAdminSecretValid (pure — no response writes)', () => {
  it('accepts the secret via header or Bearer token', () => {
    vi.stubEnv('ADMIN_SECRET', SECRET);
    expect(isAdminSecretValid({ headers: { 'x-admin-secret': SECRET } })).toBe(true);
    expect(isAdminSecretValid({ headers: { authorization: `Bearer ${SECRET}` } })).toBe(true);
  });

  it('NEVER accepts a query-param secret — this variant runs on user-facing routes and URLs land in request logs', () => {
    vi.stubEnv('ADMIN_SECRET', SECRET);
    expect(isAdminSecretValid({ headers: {}, query: { secret: SECRET } })).toBe(false);
  });

  it('rejects a wrong or missing secret', () => {
    vi.stubEnv('ADMIN_SECRET', SECRET);
    expect(isAdminSecretValid({ headers: { 'x-admin-secret': 'nope' } })).toBe(false);
    expect(isAdminSecretValid({ headers: {} })).toBe(false);
  });

  it('falls back to CRON_SECRET, and is false when neither is configured', () => {
    vi.stubEnv('ADMIN_SECRET', '');
    vi.stubEnv('CRON_SECRET', SECRET);
    expect(isAdminSecretValid({ headers: { 'x-admin-secret': SECRET } })).toBe(true);

    vi.stubEnv('CRON_SECRET', '');
    expect(isAdminSecretValid({ headers: { 'x-admin-secret': SECRET } })).toBe(false);
  });
});

describe('requireAdminSecret (response-writing gate)', () => {
  it('returns true and writes nothing on a valid secret', () => {
    vi.stubEnv('ADMIN_SECRET', SECRET);
    const res = makeRes();
    expect(requireAdminSecret({ headers: { 'x-admin-secret': SECRET } }, res)).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it('admin-only endpoints still accept ?secret= (legacy pattern of record)', () => {
    vi.stubEnv('ADMIN_SECRET', SECRET);
    const res = makeRes();
    expect(requireAdminSecret({ headers: {}, query: { secret: SECRET } }, res)).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it('writes 401 and returns false on a bad secret', () => {
    vi.stubEnv('ADMIN_SECRET', SECRET);
    const res = makeRes();
    expect(requireAdminSecret({ headers: {} }, res)).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('writes 500 and returns false when the server has no secret configured', () => {
    vi.stubEnv('ADMIN_SECRET', '');
    vi.stubEnv('CRON_SECRET', '');
    const res = makeRes();
    expect(requireAdminSecret({ headers: { 'x-admin-secret': SECRET } }, res)).toBe(false);
    expect(res.statusCode).toBe(500);
  });
});
