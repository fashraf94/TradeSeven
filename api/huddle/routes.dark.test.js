// api/huddle/routes.dark.test.js
//
// Huddle — every /api/huddle/* route is a 404 while DRB_HUDDLE_ENABLED is off (Amendment A §A10), BEFORE any read, auth
// call or middleware: the Admin SDK and the auth verifier are stand-ins that fail the row if touched.
//
// Amendment E §E7 (FAIL CLOSED, build prompt hard rule 2): with the flag ON and the cohort HUDDLE_PLAYER_UIDS unset or
// empty, every route answers EXACTLY that flag-off 404 and touches nothing; and a signed-in uid OUTSIDE a non-empty
// cohort gets the same 404 body after its auth, before any Firestore read. The flag is held by a getter mock, so each
// describe sets the state it pins, whatever the shipped value.

import { afterEach, beforeAll, describe, it, expect, vi } from 'vitest';

const flag = vi.hoisted(() => ({ on: false }));
vi.mock('../../src/config/huddleFlags.js', () => ({ get DRB_HUDDLE_ENABLED() { return flag.on; } }));

const touched = [];
const authAs = vi.hoisted(() => ({ uid: null }));
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => { touched.push('firestore'); throw new Error('read while dark'); },
  getFirebaseAuth: () => { touched.push('auth'); throw new Error('auth while dark'); },
}));
// The outside-the-cohort rows sign in through a stand-in verifier; every other row must never reach it.
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async () => { touched.push('auth'); return authAs.uid ? { uid: authAs.uid } : null; },
}));

const ROUTES = {
  confirm: () => import('./confirm.js'),
  skip: () => import('./skip.js'),
  'playback-token': () => import('./playback-token.js'),
  'audio/[token]': () => import('./audio/[token].js'),
  status: () => import('./status.js'),
  event: () => import('./event.js'),
};
// The method each route admits (its own admitHuddleRoute call).
const METHOD = { confirm: 'POST', skip: 'POST', 'playback-token': 'POST', 'audio/[token]': 'GET', status: 'GET', event: 'POST' };

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.getHeader = (k) => res.headers[k];
  res.end = () => res;
  return res;
}
const reqOf = (method) => ({ method, headers: { authorization: 'Bearer x'.padEnd(40, 'x') }, query: { token: '2026-11-09.x', etDate: '2026-11-09' }, body: { etDate: '2026-11-09' }, socket: { remoteAddress: '127.0.0.1' } });

const COHORT_BEFORE = process.env.HUDDLE_PLAYER_UIDS;
afterEach(() => {
  touched.length = 0;
  authAs.uid = null;
  if (COHORT_BEFORE === undefined) delete process.env.HUDDLE_PLAYER_UIDS; else process.env.HUDDLE_PLAYER_UIDS = COHORT_BEFORE;
});

// The six route modules' cold imports (each pulls the security middleware and the Admin SDK wrapper) can take seconds under a
// parallel suite; load them once here, under a hook timeout, so each row's budget covers only the behaviour (mutation lens:
// the confirm row timed out at 5,020 ms in a batch).
beforeAll(async () => { await Promise.all(Object.values(ROUTES).map((load) => load())); }, 60_000);

async function expectFlagOffAnswer(name) {
  const { default: handler } = await ROUTES[name]();
  for (const method of ['GET', 'POST', 'OPTIONS']) {
    const res = fakeRes();
    await handler(reqOf(method), res);
    expect(res.statusCode, `${name} ${method}`).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
    expect(res.headers, `${name} ${method}: no middleware ran`).toEqual({});
  }
  expect(touched).toEqual([]);
}

describe('Huddle routes, flag off (A §A10): 404 at once', () => {
  it.each(Object.keys(ROUTES))('/api/huddle/%s answers 404 and touches nothing', async (name) => {
    flag.on = false;
    process.env.HUDDLE_PLAYER_UIDS = 'u1';
    await expectFlagOffAnswer(name);
  });

  it('there is no apply route for a client hook (C §C7)', async () => {
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(new URL('.', import.meta.url)).filter((f) => !f.includes('.test.'));
    expect(files.sort()).toEqual(['audio', 'confirm.js', 'event.js', 'playback-token.js', 'skip.js', 'status.js']);
  });
});

describe('E7 fail closed: flag ON, cohort UNSET or EMPTY — exactly the flag-off 404, touching nothing', () => {
  it.each(Object.keys(ROUTES))('/api/huddle/%s with HUDDLE_PLAYER_UIDS unset', async (name) => {
    flag.on = true;
    delete process.env.HUDDLE_PLAYER_UIDS;
    await expectFlagOffAnswer(name);
  });

  it.each(Object.keys(ROUTES))('/api/huddle/%s with HUDDLE_PLAYER_UIDS blank', async (name) => {
    flag.on = true;
    process.env.HUDDLE_PLAYER_UIDS = ' , ';
    await expectFlagOffAnswer(name);
  });
});

describe('E7: flag ON, a signed-in uid OUTSIDE the cohort — the flag-off 404 body, no Firestore read', () => {
  it.each(Object.keys(ROUTES).filter((n) => n !== 'audio/[token]'))('/api/huddle/%s', async (name) => {
    flag.on = true;
    process.env.HUDDLE_PLAYER_UIDS = 'u-inside';
    authAs.uid = 'u-outside';
    const { default: handler } = await ROUTES[name]();
    const res = fakeRes();
    await handler(reqOf(METHOD[name]), res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
    expect(touched).toEqual(['auth']);
  });

  it('control: the same request from a uid INSIDE the cohort is admitted (it goes on to read)', async () => {
    flag.on = true;
    process.env.HUDDLE_PLAYER_UIDS = 'u-inside';
    authAs.uid = 'u-inside';
    const { default: handler } = await ROUTES.status();
    // admitted, it goes on to its Firestore read: the stand-in Admin SDK throws there
    await expect(handler(reqOf('GET'), fakeRes())).rejects.toThrow('read while dark');
    expect(touched).toEqual(['auth', 'firestore']);
  });
});
