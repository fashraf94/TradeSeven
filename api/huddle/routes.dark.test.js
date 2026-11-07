// api/huddle/routes.dark.test.js
//
// Huddle S1 — every /api/huddle/* route is a 404 while DRB_HUDDLE_ENABLED is off
// (Amendment A §A10), BEFORE any read, auth call or middleware: the Admin SDK and the
// auth verifier are stand-ins that fail the row if touched.

import { beforeAll, describe, it, expect, vi } from 'vitest';

const touched = [];
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => { touched.push('firestore'); throw new Error('read while dark'); },
  getFirebaseAuth: () => { touched.push('auth'); throw new Error('auth while dark'); },
}));

const ROUTES = {
  confirm: () => import('./confirm.js'),
  skip: () => import('./skip.js'),
  'playback-token': () => import('./playback-token.js'),
  'audio/[token]': () => import('./audio/[token].js'),
  status: () => import('./status.js'),
  event: () => import('./event.js'),
};

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = () => res;
  return res;
}

describe('Huddle routes, flag off (A §A10): 404 at once', () => {
  // The six route modules' cold imports (each pulls the security middleware and the Admin SDK wrapper) can take seconds under a
  // parallel suite; load them once here, under a hook timeout, so each row's budget covers only the behaviour (mutation lens:
  // the confirm row timed out at 5,020 ms in a batch).
  beforeAll(async () => { await Promise.all(Object.values(ROUTES).map((load) => load())); }, 60_000);

  it.each(Object.keys(ROUTES))('/api/huddle/%s answers 404 and touches nothing', async (name) => {
    const { default: handler } = await ROUTES[name]();
    for (const method of ['GET', 'POST', 'OPTIONS']) {
      const res = fakeRes();
      await handler({ method, headers: { authorization: 'Bearer x'.padEnd(40, 'x') }, query: { token: '2026-11-09.x', etDate: '2026-11-09' }, body: { etDate: '2026-11-09' } }, res);
      expect(res.statusCode, `${name} ${method}`).toBe(404);
      expect(res.body).toEqual({ error: 'not_found' });
    }
    expect(touched).toEqual([]);
  });

  it('there is no apply route for a client hook (C §C7)', async () => {
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(new URL('.', import.meta.url)).filter((f) => !f.includes('.test.'));
    expect(files.sort()).toEqual(['audio', 'confirm.js', 'event.js', 'playback-token.js', 'skip.js', 'status.js']);
  });
});
