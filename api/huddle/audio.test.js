// api/huddle/audio.test.js
//
// Huddle S1 — the audio route (spec V1.1 §6 audio row, §9 "audio route (206, 416,
// expiry, rotation)"), flag on, on in-memory stand-ins for Firestore and storage.
// The playback index → record → expiry chain is the real module (playback.js).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

vi.mock('../../src/config/huddleFlags.js', () => ({ DRB_HUDDLE_ENABLED: true }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => { throw new Error('the test passes its own db'); }, getFirebaseAuth: () => ({}) }));

const { default: handler } = await import('./audio/[token].js');
const { parseRange, tokenHashOf, mintPlaybackToken, parsePlaybackToken, PLAYBACK_TTL_MS } = await import('../_utils/huddle/playback.js');

const ET = '2026-11-09';
const UID = 'owner1';
const NOW = Date.parse('2026-11-09T14:00:00.000Z');

function fakeDb(docs) {
  const doc = (path) => ({
    collection: (c) => ({ doc: (d) => doc(`${path}/${c}/${d}`) }),
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
  });
  return { collection: (c) => ({ doc: (d) => doc(`${c}/${d}`) }) };
}

function setup({ expiresAt = new Date(NOW + PLAYBACK_TTL_MS).toISOString(), indexHash, recordHash } = {}) {
  const token = mintPlaybackToken(ET);
  const hash = tokenHashOf(token);
  const docs = new Map([
    [`huddleRuns/${ET}`, { playback: { [indexHash ?? hash]: { uid: UID, expiresAt } } }],
    [`huddles/${UID}/days/${ET}`, { status: 'ready', audio: { gcsPath: `huddle/${UID}/${ET}/1/audio.mp3`, durationMs: 70_000 }, playback: { tokenHash: recordHash ?? hash, expiresAt } }],
  ]);
  return { token, db: fakeDb(docs) };
}

class FakeStream extends EventEmitter {
  constructor() { super(); this.destroyed = false; this.piped = null; }
  pipe(dest) { this.piped = dest; return dest; }
  destroy() { this.destroyed = true; }
}

function fakeReqRes(token, range) {
  const req = new EventEmitter();
  Object.assign(req, { method: 'GET', headers: range ? { range } : {}, query: { token } });
  const res = { statusCode: null, body: null, headers: {}, headersSent: false, ended: false };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; res.headersSent = true; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = () => { res.ended = true; return res; };
  return { req, res };
}

const SIZE = 1000;
let stream;
let opened;
const deps = (db) => ({
  db,
  audioSizeOf: async () => SIZE,
  openAudioStream: (path, r) => { opened = { path, ...r }; stream = new FakeStream(); return stream; },
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  stream = null;
  opened = null;
});

describe('parseRange', () => {
  it('full, partial, open-ended, suffix and unsatisfiable', () => {
    expect(parseRange(undefined, SIZE)).toEqual({ kind: 'full' });
    expect(parseRange('bytes=0-99', SIZE)).toEqual({ kind: 'partial', start: 0, end: 99 });
    expect(parseRange('bytes=900-', SIZE)).toEqual({ kind: 'partial', start: 900, end: 999 });
    expect(parseRange('bytes=-100', SIZE)).toEqual({ kind: 'partial', start: 900, end: 999 });
    expect(parseRange('bytes=0-5000', SIZE)).toEqual({ kind: 'partial', start: 0, end: 999 });
    for (const bad of ['bytes=1000-', 'bytes=50-10', 'bytes=-0', 'bytes=-', 'items=0-1', 'bytes=0-1,5-9']) {
      expect(parseRange(bad, SIZE), bad).toEqual({ kind: 'unsatisfiable' });
    }
  });

  it('a token is `{etDate}.{43 base64url}`; anything else is not one', () => {
    expect(parsePlaybackToken(mintPlaybackToken(ET))).toEqual({ etDate: ET });
    expect(parsePlaybackToken('2026-11-09.short')).toBeNull();
    expect(parsePlaybackToken('../../etc')).toBeNull();
  });
});

describe('GET /api/huddle/audio/{token}', () => {
  it('a Range request is a 206 with Content-Range, Accept-Ranges and private, no-store', async () => {
    const { token, db } = setup();
    const { req, res } = fakeReqRes(token, 'bytes=100-199');
    await handler(req, res, deps(db));
    expect(res.statusCode).toBe(206);
    expect(res.headers).toMatchObject({ 'Content-Range': 'bytes 100-199/1000', 'Accept-Ranges': 'bytes', 'Content-Length': '100', 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store' });
    expect(opened).toMatchObject({ start: 100, end: 199 });
    expect(stream.piped).toBe(res);
  });

  it('no Range is a 200 of the whole object', async () => {
    const { token, db } = setup();
    const { req, res } = fakeReqRes(token);
    await handler(req, res, deps(db));
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Length']).toBe('1000');
    expect(res.headers['Content-Range']).toBeUndefined();
  });

  it('an unsatisfiable range is a 416 with bytes */size and no stream', async () => {
    const { token, db } = setup();
    const { req, res } = fakeReqRes(token, 'bytes=5000-6000');
    await handler(req, res, deps(db));
    expect(res.statusCode).toBe(416);
    expect(res.headers['Content-Range']).toBe('bytes */1000');
    expect(opened).toBeNull();
  });

  it('an expired token is a 410; a rotated (no longer current) token is a 404; an unknown one is a 404', async () => {
    const expired = setup({ expiresAt: new Date(NOW - 1).toISOString() });
    let rr = fakeReqRes(expired.token);
    await handler(rr.req, rr.res, deps(expired.db));
    expect(rr.res.statusCode).toBe(410);

    const rotated = setup({ recordHash: 'f'.repeat(64) });
    rr = fakeReqRes(rotated.token);
    await handler(rr.req, rr.res, deps(rotated.db));
    expect(rr.res.statusCode).toBe(404);

    const unknown = setup({ indexHash: 'e'.repeat(64) });
    rr = fakeReqRes(unknown.token);
    await handler(rr.req, rr.res, deps(unknown.db));
    expect(rr.res.statusCode).toBe(404);
    expect(opened).toBeNull();
  });

  it('a client disconnect destroys the storage stream', async () => {
    const { token, db } = setup();
    const { req, res } = fakeReqRes(token, 'bytes=0-');
    await handler(req, res, deps(db));
    expect(stream.destroyed).toBe(false);
    req.emit('close');
    expect(stream.destroyed).toBe(true);
  });
});
