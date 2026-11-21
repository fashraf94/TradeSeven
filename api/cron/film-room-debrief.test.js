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

const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const CRON = { headers: { 'x-vercel-cron': '1' } };
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
    expect(res.body).toMatchObject({ etDate: '2026-09-23', written: 1 });
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
});
