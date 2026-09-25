// api/backing/event.test.js
//
// POST /api/backing/event — Backing Beta PR 5, THE TELEMETRY SINK (spec V1.3
// §10, D-p; BUILD_RULES §5). The LIT suite; the darkness suite is the sibling
// backing-routes.dark.test.js.
//
// THE ROWS THIS FILE EXISTS FOR: the allowlist is CLOSED (stake_confirmed is
// refused — the stake endpoint writes it); the props vocabulary is closed;
// the write is awaited and the reply carries nothing a client could read.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the route's real import is the
// runtime guard for its api/ -> src/ imports. Never mock the constants.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ flag: true, uid: 'viewer-1' }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (!state.uid) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: state.uid, firebase: { sign_in_provider: 'password' } };
  },
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return state.flag; },
}));
let DB = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => DB.db }));

const { makeInMemoryDb } = await import('../_utils/__fixtures__/inMemoryFirestore.js');
const { default: handler } = await import('./event.js');
const { BACKING_EVENTS_COLLECTION, MAX_DWELL_MS, buildBackingEvent, stakeConfirmedEventId, validateBackingEventBody } = await import('../_utils/backingEvents.js');
const { BACKING_EVENT_ALLOWLIST } = await import('../../src/constants/backing.js');

const NOW = new Date('2026-09-23T14:00:00.000Z');
const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
async function post(body, { method = 'POST' } = {}) {
  const res = mkRes();
  await handler({ method, headers: {}, body }, res);
  return res;
}
const events = () => [...DB.store.entries()].filter(([p]) => p.startsWith(`${BACKING_EVENTS_COLLECTION}/`));

beforeEach(() => {
  state.flag = true; state.uid = 'viewer-1';
  DB = makeInMemoryDb({});
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('the pipeline, in order', () => {
  it('405s anything but POST; 401s BEFORE the flag; 404s while dark AFTER auth, touching nothing', async () => {
    expect((await post({ event: 'window_viewed' }, { method: 'GET' })).statusCode).toBe(405);
    state.uid = null;
    expect((await post({ event: 'window_viewed' })).statusCode).toBe(401);
    state.uid = 'viewer-1'; state.flag = false;
    const res = await post({ event: 'window_viewed' });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(DB.writeLog).toEqual([]);
    expect(DB.readLog).toEqual([]);
  });
});

describe('the allowlist is CLOSED, the props vocabulary is CLOSED', () => {
  it('records each allowlisted event as the §6 document, from the token\'s uid, awaited, and answers recorded: true and nothing else', async () => {
    const bodies = {
      window_viewed: { event: 'window_viewed', props: { weekKey: '2026-W40' } },
      team_card_opened: { event: 'team_card_opened', groupId: 'grp-1', props: { dwellMs: 4200, odUserId: 'od-a' } },
      stake_control_opened: { event: 'stake_control_opened', groupId: 'grp-1', props: { odUserId: 'od-a' } },
      your_backing_viewed: { event: 'your_backing_viewed', props: {} },
      results_viewed: { event: 'results_viewed', groupId: 'grp-2', props: { weekKey: '2026-W39' } },
    };
    expect(Object.keys(bodies).sort()).toEqual([...BACKING_EVENT_ALLOWLIST].sort());
    for (const [event, body] of Object.entries(bodies)) {
      const res = await post(body);
      expect(res.statusCode, event).toBe(200);
      expect(res.body).toEqual({ recorded: true });
    }
    expect(events()).toHaveLength(5);
    const card = events().find(([, d]) => d.event === 'team_card_opened');
    expect(card[0]).toMatch(/^backingEvents\/bev_team_card_opened_[0-9a-f-]{36}$/);
    expect(card[1]).toEqual({ userId: 'viewer-1', groupId: 'grp-1', event: 'team_card_opened', at: NOW.toISOString(), props: { dwellMs: 4200, odUserId: 'od-a' } });
    expect(events().find(([, d]) => d.event === 'window_viewed')[1]).toMatchObject({ groupId: null, props: { weekKey: '2026-W40' } });
    expect(DB.readLog).toEqual([]);
  });

  it('refuses stake_confirmed (the stake endpoint writes it), any name off the list, a bad groupId and a bad body — nothing written', async () => {
    for (const [body, error] of [
      [{ event: 'stake_confirmed', groupId: 'grp-1' }, 'unknown_event'],
      [{ event: 'clicked_thing' }, 'unknown_event'],
      [{}, 'unknown_event'],
      [{ event: 'results_viewed', groupId: 'a/b' }, 'invalid_group_id'],
      [{ event: 'results_viewed', groupId: 42 }, 'invalid_group_id'],
      [{ event: 'results_viewed', props: 'x' }, 'invalid_props'],
      [{ event: 'results_viewed', props: [] }, 'invalid_props'],
    ]) {
      const res = await post(body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toBe(error);
    }
    expect(DB.writeLog).toEqual([]);
  });

  it('the prop vocabulary: an unknown key, an out-of-range dwell, a missing required dwell and a mistyped week are refused', async () => {
    for (const body of [
      { event: 'team_card_opened', props: { dwellMs: 10, mood: 'happy' } },
      { event: 'team_card_opened', props: { dwellMs: -1 } },
      { event: 'team_card_opened', props: { dwellMs: MAX_DWELL_MS + 1 } },
      { event: 'team_card_opened', props: { dwellMs: 12.5 } },
      { event: 'team_card_opened', props: { odUserId: 'od-a' } },
      { event: 'window_viewed', props: { weekKey: 'week 40' } },
      { event: 'window_viewed', props: { dwellMs: 10 } },
      { event: 'results_viewed', props: { userId: 'someone' } },
    ]) {
      const res = await post(body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toBe('invalid_props');
    }
    expect(DB.writeLog).toEqual([]);
    expect(await post({ event: 'team_card_opened', props: { dwellMs: MAX_DWELL_MS } }).then((r) => r.statusCode)).toBe(200);
    expect(await post({ event: 'team_card_opened', props: { dwellMs: 0 } }).then((r) => r.statusCode)).toBe(200);
  });

  it('accepts a JSON STRING body and refuses malformed JSON', async () => {
    expect((await post(JSON.stringify({ event: 'window_viewed' }))).statusCode).toBe(200);
    const res = await post('{not json');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('a failing write is a 500 with a generic body — the client fires and forgets, the server never pretends', async () => {
    DB.db.collection = () => ({ doc: () => ({ set: async () => { throw new Error('sink down'); } }) });
    const res = await post({ event: 'window_viewed' });
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'server_error', message: 'Could not record the event.' });
  });
});

describe('the pure pieces', () => {
  it('validateBackingEventBody answers the same shape the route does; stakeConfirmedEventId is keyed by its source id (the request\'s debit key since D-ag); buildBackingEvent copies props', () => {
    expect(validateBackingEventBody({ event: 'window_viewed' })).toEqual({ ok: true, event: 'window_viewed', groupId: null, props: {} });
    expect(validateBackingEventBody(null)).toMatchObject({ ok: false, error: 'unknown_event' });
    expect(validateBackingEventBody({ event: 'team_card_opened', groupId: 'g', props: { dwellMs: 1 } })).toEqual({ ok: true, event: 'team_card_opened', groupId: 'g', props: { dwellMs: 1 } });
    expect(stakeConfirmedEventId('stk_abc')).toBe('stake_confirmed:stk_abc');
    const props = { a: 1 };
    const doc = buildBackingEvent({ userId: 'u', event: 'x', props, now: NOW });
    props.a = 2;
    expect(doc).toEqual({ userId: 'u', groupId: null, event: 'x', at: NOW.toISOString(), props: { a: 1 } });
  });
});

// ============================================================================
// THE ACTIVATION PR — a SMOKE session's clicks are marked dev, at a dev-prefixed id.
describe('the founder smoke override (the activation PR): a smoke session\'s events carry the dev marker', () => {
  const lit = () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('BACKING_SMOKE_ENABLED', 'true');
    vi.stubEnv('BACKING_SMOKE_UIDS', `other-1, ${state.uid}`);
  };
  afterEach(() => { vi.unstubAllEnvs(); });

  it('dark flag, lit preview, allowlisted uid: the event is recorded at a `dev:` id with `isDev: true` — the funnel never reads it as the beta\'s', async () => {
    state.flag = false;
    lit();
    const res = await post({ event: 'window_viewed', groupId: 'grp-1', props: { weekKey: '2026-W40' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ recorded: true });
    const written = events();
    expect(written).toHaveLength(1);
    const [path, doc] = written[0];
    expect(path).toMatch(/^backingEvents\/dev:bev_window_viewed_/);
    expect(doc).toMatchObject({ userId: state.uid, groupId: 'grp-1', event: 'window_viewed', isDev: true, props: { weekKey: '2026-W40' } });
  });

  it('the decision is the TOKEN\'s uid: a foreign uid in the body changes nothing — still the `dev:` id, still `isDev`, recorded under the token\'s uid (LIGHT-1)', async () => {
    state.flag = false;
    lit();
    const res = await post({ event: 'window_viewed', groupId: 'grp-1', props: { weekKey: '2026-W40' }, uid: 'someone-else', userId: 'someone-else' });
    expect(res.statusCode).toBe(200);
    const [path, doc] = events()[0];
    expect(path).toMatch(/^backingEvents\/dev:bev_window_viewed_/);
    expect(doc).toMatchObject({ userId: state.uid, isDev: true });
    // …and a NON-allowlisted token carrying the allowlisted uid in its body is dark.
    DB.writeLog.length = 0;
    const founder = state.uid;
    state.uid = 'someone-else';
    const dark = await post({ event: 'window_viewed', groupId: 'grp-1', props: { weekKey: '2026-W40' }, uid: founder, userId: founder });
    expect(dark.statusCode).toBe(404);
    expect(DB.writeLog).toEqual([]);
  });

  it('a LIT non-smoke caller (the flag on) is unchanged: a plain id, no `isDev` key', async () => {
    state.flag = true;
    lit();
    state.uid = 'someone-else';
    await post({ event: 'window_viewed', groupId: 'grp-1', props: { weekKey: '2026-W40' } });
    const [path, doc] = events()[0];
    expect(path).toMatch(/^backingEvents\/bev_window_viewed_/);
    expect(doc).not.toHaveProperty('isDev');
  });

  it('the SAME uid and env in PRODUCTION: 404 and nothing written', async () => {
    state.flag = false;
    lit();
    vi.stubEnv('VERCEL_ENV', 'production');
    const res = await post({ event: 'window_viewed', props: {} });
    expect(res.statusCode).toBe(404);
    expect(DB.writeLog).toEqual([]);
  });
});
