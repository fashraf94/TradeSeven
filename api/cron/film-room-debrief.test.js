// api/cron/film-room-debrief.test.js
//
// Film Room D2 item 5 — THE CRON HANDLER (D2 spec §7): cron auth, the gate read at CALL time ('off' answers before the
// Firestore handle is even taken), then the pass with the run's clock and budget; an error answered without its message.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const flags = vi.hoisted(() => ({ debrief: 'allowlist' }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_DEBRIEF_MODE() { return flags.debrief; },
}));

import handler, { config } from './film-room-debrief.js';
import { publicSummaryOf, PUBLIC_SUMMARY_KEYS } from '../_utils/filmRoom/debriefPass.js';

const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
// Amendment F DF-7: a scheduled run carries the bearer (Vercel sends it when CRON_SECRET is set); the header alone no
// longer admits — so the rows below that need an admitted request send the bearer
const CRON = { headers: { 'x-vercel-cron': '1', authorization: 'Bearer cron-secret-for-test' } };
const SECRET_BEFORE = process.env.CRON_SECRET;
beforeEach(() => { flags.debrief = 'allowlist'; process.env.CRON_SECRET = 'cron-secret-for-test'; });
afterEach(() => { if (SECRET_BEFORE === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = SECRET_BEFORE; });

describe('the handler', () => {
  it('maxDuration 300', () => { expect(config).toEqual({ maxDuration: 300 }); });
  it('no cron header and no bearer secret: 401, nothing taken, nothing run', async () => {
    const getDb = vi.fn(); const pass = vi.fn();
    const res = mkRes();
    await handler({ headers: {} }, res, { getDb, pass });
    expect([res.statusCode, getDb.mock.calls.length, pass.mock.calls.length]).toEqual([401, 0, 0]);
    const res2 = mkRes();
    await handler({ headers: { authorization: 'Bearer wrong' } }, res2, { getDb, pass });
    expect(res2.statusCode).toBe(401);
  });
  it("'off', read at call time: 200 { skipped: true } before the Firestore handle is taken — no pass", async () => {
    flags.debrief = 'off';
    const getDb = vi.fn(); const pass = vi.fn();
    const res = mkRes();
    await handler(CRON, res, { getDb, pass });
    expect([res.statusCode, res.body, getDb.mock.calls.length, pass.mock.calls.length]).toEqual([200, { skipped: true, reason: 'off' }, 0, 0]);
  });
  it("an unknown mode is 'off'", async () => {
    flags.debrief = 'sometimes';
    const pass = vi.fn();
    const res = mkRes();
    await handler(CRON, res, { getDb: vi.fn(), pass });
    expect([res.body, pass.mock.calls.length]).toEqual([{ skipped: true, reason: 'off' }, 0]);
  });
  it("'allowlist' (and the bearer secret): the pass, with the db, the mode, the run's start and the 300 s budget", async () => {
    const db = { name: 'db' };
    const pass = vi.fn(async () => ({ etDate: '2026-09-23', written: 1 }));
    const res = mkRes();
    await handler({ headers: { authorization: 'Bearer cron-secret-for-test' } }, res, { getDb: () => db, pass });
    expect(res.statusCode).toBe(200);
    // Amendment F DF-6: the body is the public projection — counts and the cost, the pinned keys; nothing else of the summary
    expect(res.body).toEqual(publicSummaryOf({ written: 1 }));
    expect(Object.keys(res.body)).toEqual([...PUBLIC_SUMMARY_KEYS]);
    expect('etDate' in res.body).toBe(false);
    const args = pass.mock.calls[0][0];
    expect([args.db, args.mode, args.budgetMs, Number.isFinite(args.startMs)]).toEqual([db, 'allowlist', 300_000, true]);
  });
  it('an error: 500 with a fixed body; the log names its kind and code — never its message (which can carry a path and an id)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const pass = async () => { throw Object.assign(new Error('NOT_FOUND agentBattles/b-secret-id/tape/2026-09-23'), { code: 5 }); };
      const res = mkRes();
      await handler(CRON, res, { getDb: () => ({}), pass });
      expect([res.statusCode, res.body]).toEqual([500, { error: 'debrief_pass_failed' }]);
      const printed = err.mock.calls.flat().join(" ");
      expect(printed).not.toContain('b-secret-id');
      expect(printed).toContain('"code":5');
    } finally { err.mockRestore(); }
  });
  it('Amendment F DF-7: a missing secret, a missing header, a wrong header, the cron header alone — each 401 before the gate: no database, no pass, not even with the words off', async () => {
    const tried = async (req, secret) => {
      if (secret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = secret;
      const getDb = vi.fn(); const pass = vi.fn();
      const res = mkRes();
      await handler(req, res, { getDb, pass });
      return [res.statusCode, res.body, getDb.mock.calls.length, pass.mock.calls.length];
    };
    const refused = [401, { error: 'Unauthorized' }, 0, 0];
    expect(await tried({ headers: { authorization: 'Bearer undefined' } }, undefined), 'no secret').toEqual(refused);
    expect(await tried({ headers: { authorization: 'Bearer ' } }, ''), 'an empty secret').toEqual(refused);
    expect(await tried({ headers: {} }, 'cron-secret-for-test'), 'no header').toEqual(refused);
    expect(await tried({ headers: { authorization: 'Bearer wrong' } }, 'cron-secret-for-test'), 'a wrong header').toEqual(refused);
    expect(await tried({ headers: { authorization: 'cron-secret-for-test' } }, 'cron-secret-for-test'), 'no "Bearer "').toEqual(refused);
    expect(await tried({ headers: { 'x-vercel-cron': '1' } }, 'cron-secret-for-test'), 'the cron header alone').toEqual(refused);
    flags.debrief = 'off';
    expect(await tried({ headers: { 'x-vercel-cron': '1' } }, 'cron-secret-for-test'), 'the header alone, words off').toEqual(refused);
  });
  it('DF-7: the bearer alone admits', async () => {
    const pass = vi.fn(async () => ({ written: 0 }));
    const res = mkRes();
    await handler({ headers: { authorization: 'Bearer cron-secret-for-test' } }, res, { getDb: () => ({}), pass });
    expect([res.statusCode, pass.mock.calls.length]).toEqual([200, 1]);
  });
  it('DF-6: the error\'s kind is one of a fixed set — a thrown value whose name carries a path prints "Error"', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const pass = async () => { throw Object.assign(new Error('x'), { name: 'agentBattles/b-secret-id' }); };
      await handler(CRON, mkRes(), { getDb: () => ({}), pass });
      const printed = err.mock.calls.flat().join(' ');
      expect(printed).not.toContain('b-secret-id');
      expect(printed).toContain('"kind":"Error"');
    } finally { err.mockRestore(); }
  });
});
