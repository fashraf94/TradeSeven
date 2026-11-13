// api/_utils/sharedResearch/gate.test.js
//
// Shared Research B1 — the gate (spec §6.2, D-4). The mode × admission matrix;
// 'off' answers 404 before auth; an unknown value is 'off'; nothing throws.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ mode: 'off', allowlisted: new Set(), ideaOn: new Set(), user: { uid: 'u1' }, calls: [], throwOn: null }));
vi.mock('../../../src/config/sharedResearchFlags.js', () => ({
  SHARED_RESEARCH_MODES: Object.freeze(['off', 'allowlist', 'on']),
  get SHARED_RESEARCH_MODE() { if (state.throwOn === 'mode') throw new Error('boom'); return state.mode; },
}));
vi.mock('../callRecords/mode.js', () => ({ isCockpitOwnerAllowlisted: (uid) => { if (state.throwOn === 'allowlist') throw new Error('boom'); return state.allowlisted.has(uid); } }));
vi.mock('../hypothesisRecords/gate.js', () => ({ hypothesisRecordsOnFor: (uid) => state.ideaOn.has(uid) }));
vi.mock('../security.js', () => ({ applySecurityMiddleware: (req, res, opts) => { state.calls.push(['middleware', opts.rateLimit]); return false; } }));
vi.mock('../authMiddleware.js', () => ({ requireAuth: async (req, res) => { state.calls.push(['auth']); if (!state.user) { res.status(401).json({ error: 'unauthorized' }); return null; } return state.user; } }));

const { sharedResearchMode, sharedResearchOnFor, gateSharedResearchRoute, RATE_LIMITS, sendSharedResearchError, uidRateLimitHit, resetUidRateLimits } = await import('./gate.js');
const { copyFor } = await import('./copy.js');
const { HypothesisInputError } = await import('../hypothesisRecords/model.js');
const { ResearchRecordError } = await import('../researchRecords/model.js');
const { refuse } = await import('./session.js');

const res = () => { const r = { statusCode: null, body: null, headers: {} }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; return r; }; return r; };

beforeEach(() => {
  Object.assign(state, { mode: 'off', allowlisted: new Set(), ideaOn: new Set(), user: { uid: 'u1' }, calls: [], throwOn: null });
  resetUidRateLimits();
});

describe('the mode', () => {
  it('the walked states pass; an unknown value, or a read that throws, is off', () => {
    for (const m of ['off', 'allowlist', 'on']) { state.mode = m; expect(sharedResearchMode()).toBe(m); }
    state.mode = 'ON';
    expect(sharedResearchMode()).toBe('off');
    state.throwOn = 'mode';
    expect(sharedResearchMode()).toBe('off');
  });
});

describe('the admission matrix (D-4): the mode\'s admission AND idea-record admission', () => {
  const rows = [
    // mode, allowlisted, ideaOn, expected
    ['off', true, true, false],
    ['allowlist', false, true, false],
    ['allowlist', true, false, false],
    ['allowlist', true, true, true],
    ['on', false, false, false],
    ['on', false, true, true],
    ['nonsense', true, true, false],
  ];
  for (const [mode, allow, idea, want] of rows) {
    it(`mode ${mode}, allowlisted ${allow}, idea records ${idea} → ${want}`, () => {
      state.mode = mode;
      if (allow) state.allowlisted.add('u1');
      if (idea) state.ideaOn.add('u1');
      expect(sharedResearchOnFor('u1')).toBe(want);
    });
  }
  it('never throws: a bad uid, a throwing allowlist read', () => {
    state.mode = 'allowlist';
    expect(sharedResearchOnFor(undefined)).toBe(false);
    expect(sharedResearchOnFor('')).toBe(false);
    state.throwOn = 'allowlist';
    expect(sharedResearchOnFor('u1')).toBe(false);
  });
});

describe('the gate order (spec §6.2)', () => {
  it("'off': 404 disabled BEFORE auth — an unauthenticated caller gets the 404, not a 401", async () => {
    state.user = null;
    const r = res();
    expect(await gateSharedResearchRoute({ method: 'POST' }, r)).toBeNull();
    expect([r.statusCode, r.body]).toEqual([404, { error: 'disabled' }]);
    expect(state.calls.map((c) => c[0])).toEqual(['middleware']);
    expect(r.headers['Cache-Control']).toBe('no-store');
  });
  it('on for someone else: the caller gets the same 404 after auth, whatever the method', async () => {
    state.mode = 'allowlist';
    for (const method of ['GET', 'POST', 'DELETE']) {
      const r = res();
      expect(await gateSharedResearchRoute({ method }, r)).toBeNull();
      expect([r.statusCode, r.body]).toEqual([404, { error: 'disabled' }]);
    }
  });
  it('admitted: no token → 401; a method outside GET/POST → 405; else the user', async () => {
    state.mode = 'on';
    state.ideaOn.add('u1');
    const ok = res();
    expect(await gateSharedResearchRoute({ method: 'POST' }, ok)).toEqual({ user: { uid: 'u1' } });
    const del = res();
    expect(await gateSharedResearchRoute({ method: 'DELETE' }, del)).toBeNull();
    expect(del.statusCode).toBe(405);
    state.user = null;
    const anon = res();
    expect(await gateSharedResearchRoute({ method: 'POST' }, anon)).toBeNull();
    expect(anon.statusCode).toBe(401);
  });
  it('the rate limit: 10 POST, 30 GET a minute', async () => {
    await gateSharedResearchRoute({ method: 'GET' }, res());
    await gateSharedResearchRoute({ method: 'POST' }, res());
    expect(state.calls.filter((c) => c[0] === 'middleware').map((c) => c[1])).toEqual([RATE_LIMITS.GET, RATE_LIMITS.POST]);
    expect(RATE_LIMITS).toEqual({ GET: { limit: 30, windowMs: 60_000 }, POST: { limit: 10, windowMs: 60_000 } });
  });
});

describe('spec §16 FQ-8 — the per-uid, per-method limiter, after auth', () => {
  const gate = async (method, r = res()) => ({ out: await gateSharedResearchRoute({ method, headers: {} }, r), r });
  beforeEach(() => { state.mode = 'on'; state.ideaOn.add('u1'); state.ideaOn.add('u2'); });

  it('10 POST a minute for one player, then 429 rate_limited with Retry-After and its line; the IP guard still ran first on every request', async () => {
    for (let i = 0; i < 10; i++) expect((await gate('POST')).out).toEqual({ user: { uid: 'u1' } });
    const { out, r } = await gate('POST');
    expect(out).toBeNull();
    expect([r.statusCode, r.body]).toEqual([429, { error: 'rate_limited', message: copyFor('rate_limited') }]);
    expect(Number(r.headers['Retry-After'])).toBeGreaterThan(0);
    expect(state.calls.filter((c) => c[0] === 'middleware')).toHaveLength(11);
  });
  it('GETs have their own 30 and never spend the POST allowance; another player is not touched', async () => {
    for (let i = 0; i < 10; i++) await gate('POST');
    for (let i = 0; i < 30; i++) expect((await gate('GET')).out).not.toBeNull();
    expect((await gate('GET')).r.statusCode).toBe(429);
    state.user = { uid: 'u2' };
    expect((await gate('POST')).out).toEqual({ user: { uid: 'u2' } });
  });
  it('the window: a minute after its first request the count starts again', () => {
    const t = 1_000_000;
    for (let i = 0; i < 10; i++) expect(uidRateLimitHit('u9', 'POST', t + i).limited).toBe(false);
    expect(uidRateLimitHit('u9', 'POST', t + 10)).toEqual({ limited: true, retryAfterS: 60 });
    expect(uidRateLimitHit('u9', 'POST', t + 60_000).limited).toBe(false);
  });
  it('the order holds for a limited player: off → 404 before auth; not admitted → 404; never a 429 first', async () => {
    for (let i = 0; i < 11; i++) await gate('POST');
    state.mode = 'off';
    expect([(await gate('POST')).r.statusCode, (await gate('POST')).r.body]).toEqual([404, { error: 'disabled' }]);
    state.mode = 'on';
    state.ideaOn.delete('u1');
    expect((await gate('POST')).r.statusCode).toBe(404);
  });
});

describe('the error answer (the sendHypothesisError shape)', () => {
  it('a typed refusal → its status and line; the builder\'s refusal → 400 invalid_adoption with its code; a record code → passed through; anything else → 500', () => {
    const a = res();
    sendSharedResearchError(a, refuse(503, 'budget_paused'), 't');
    expect([a.statusCode, a.body.error, a.body.message]).toEqual([503, 'budget_paused', 'Research steps are paused for today — the daily research budget is used. Your investigation is kept; reading, saving an idea and closing still work.']);
    const b = res();
    sendSharedResearchError(b, new HypothesisInputError('too_many_evidence_refs'), 't');
    expect([b.statusCode, b.body.error, b.body.reason]).toEqual([400, 'invalid_adoption', 'too_many_evidence_refs']);
    const c = res();
    sendSharedResearchError(c, new ResearchRecordError('invalid_question'), 't');
    expect([c.statusCode, c.body.error]).toEqual([400, 'invalid_question']);
    const d = res();
    sendSharedResearchError(d, new Error('kaboom'), 't');
    expect([d.statusCode, d.body.error]).toEqual([500, 'server_error']);
  });
});
