// api/team/pitch.test.js
//
// POST /api/team/pitch — Backing Beta PR 4, the scouting-pitch writer. The
// ordered pipeline, each check falsifiable: method, auth, the flag, then EVERY
// validation arm of normalizePitch (a non-string, too long, control characters
// stripped, newlines folded, whitespace collapsed and trimmed, the empty clear),
// the exact write shape, idempotency, and that the uid is the TOKEN's.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the route's real import below is
// the runtime guard for its api/ -> src/ import (src/config/featureFlags.js).
// The darkness half lives in api/tournament/team-card.dark.test.js beside the
// other PR 4 route, mocked to an explicit false so it never moves with the flip.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const state = vi.hoisted(() => ({ flag: true, uid: 'owner-1' }));

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
const { default: handler } = await import('./pitch.js');
const { TEAM_PITCHES_COLLECTION, PITCH_MAX_LEN, normalizePitch, readPitch } = await import('../_utils/teamPitch.js');

const NOW = new Date('2026-09-22T14:00:00.000Z');

const mkRes = () => ({
  statusCode: null, body: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

async function post(body, method = 'POST') {
  const res = mkRes();
  await handler({ method, headers: {}, body }, res);
  return res;
}

beforeEach(() => {
  state.flag = true;
  state.uid = 'owner-1';
  DB = makeInMemoryDb({});
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('the pipeline, in order', () => {
  it('405s anything but POST', async () => {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      expect((await post({ text: 'x' }, method)).statusCode).toBe(405);
    }
  });

  it('401s without a caller, then 404s while the flag is dark — auth first', async () => {
    state.uid = null;
    for (const flag of [true, false]) {
      state.flag = flag;
      const res = await post({ text: 'x' });
      expect(res.statusCode).toBe(401);
    }
    state.uid = 'owner-1';
    state.flag = false;
    const res = await post({ text: 'x' });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(DB.writeLog).toEqual([]);
    expect(DB.readLog).toEqual([]);
  });
});

describe('the validation arms (api/_utils/teamPitch.js normalizePitch)', () => {
  it('a missing or non-string text is 400 invalid_text', async () => {
    for (const body of [{}, { text: 12 }, { text: ['a'] }, { text: null }, null, 'nope']) {
      const res = await post(body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toBe('invalid_text');
    }
    expect(DB.writeLog).toEqual([]);
  });

  it('141 characters is 400 too_long; 140 is accepted', async () => {
    const tooLong = 'a'.repeat(PITCH_MAX_LEN + 1);
    const res = await post({ text: tooLong });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('too_long');
    expect(DB.writeLog).toEqual([]);

    const exact = 'b'.repeat(PITCH_MAX_LEN);
    const ok = await post({ text: exact });
    expect(ok.statusCode).toBe(200);
    expect(ok.body.pitch.text).toBe(exact);
  });

  it('the length is judged AFTER trimming, so padding cannot push a pitch over', async () => {
    const padded = `   ${'c'.repeat(PITCH_MAX_LEN)}   `;
    const res = await post({ text: padded });
    expect(res.statusCode).toBe(200);
    expect(res.body.pitch.text).toBe('c'.repeat(PITCH_MAX_LEN));
  });

  it('control characters are stripped and newlines folded to one space', async () => {
    const res = await post({ text: 'Momentum,\nbut\r\n\tpatient.\u0000 I wait\u0007 for Tuesday.' });
    expect(res.statusCode).toBe(200);
    expect(res.body.pitch.text).toBe('Momentum, but patient. I wait for Tuesday.');
    expect(res.body.pitch.text).not.toMatch(/[\n\r\t]/);
  });

  it('whitespace runs collapse and the ends are trimmed', async () => {
    const res = await post({ text: '  Fade   the crowd,  size small.  ' });
    expect(res.body.pitch.text).toBe('Fade the crowd, size small.');
  });

  it('an empty (or whitespace-only) text CLEARS the pitch — written as an empty string, never a delete', async () => {
    await post({ text: 'A line to clear.' });
    expect(await readPitch(DB.db, 'owner-1')).toBe('A line to clear.');
    const res = await post({ text: '   \n  ' });
    expect(res.statusCode).toBe(200);
    expect(res.body.pitch).toEqual({ text: '', updatedAt: NOW.toISOString() });
    expect(DB.store.get('teamPitches/owner-1')).toEqual({ text: '', updatedAt: NOW.toISOString() });
    expect(await readPitch(DB.db, 'owner-1')).toBeNull();
    expect(DB.writeLog.filter(([op]) => op === 'delete')).toEqual([]);
  });

  it('normalizePitch is pure and answers the same for the route and any reader', () => {
    expect(normalizePitch('x')).toEqual({ ok: true, text: 'x' });
    expect(normalizePitch('')).toEqual({ ok: true, text: '' });
    expect(normalizePitch(undefined).ok).toBe(false);
    expect(normalizePitch('a'.repeat(141)).error).toBe('too_long');
  });
});

describe('the write', () => {
  it('is ONE whole-doc set to teamPitches/{uid} with exactly { text, updatedAt }', async () => {
    const res = await post({ text: 'Momentum, but patient.' });
    expect(res.statusCode).toBe(200);
    expect(DB.writeLog).toEqual([['set', 'teamPitches/owner-1']]);
    expect(DB.store.get('teamPitches/owner-1')).toEqual({
      text: 'Momentum, but patient.',
      updatedAt: NOW.toISOString(),
    });
    expect(res.body).toEqual({ ok: true, pitch: { text: 'Momentum, but patient.', updatedAt: NOW.toISOString() } });
  });

  it('is idempotent — the same body twice is the same document, and never touches users/{uid}', async () => {
    await post({ text: 'Same line.' });
    const first = structuredClone(DB.store.get('teamPitches/owner-1'));
    await post({ text: 'Same line.' });
    expect(DB.store.get('teamPitches/owner-1')).toEqual(first);
    expect(DB.writeLog.every(([, p]) => p === 'teamPitches/owner-1')).toBe(true);
    expect(DB.store.has('users/owner-1')).toBe(false);
  });

  it('the uid is the TOKEN\'s — a uid in the body is ignored', async () => {
    await post({ text: 'Mine.', uid: 'victim-2', userId: 'victim-2' });
    expect(DB.store.has('teamPitches/owner-1')).toBe(true);
    expect(DB.store.has('teamPitches/victim-2')).toBe(false);
  });

  it('overwrites a prior pitch in place', async () => {
    await post({ text: 'First.' });
    await post({ text: 'Second.' });
    expect(await readPitch(DB.db, 'owner-1')).toBe('Second.');
  });
});

describe('the route\'s literal collection matches the reader\'s constant (§9 — one name)', () => {
  it('writes to the literal the scanner resolves, and that literal IS TEAM_PITCHES_COLLECTION', () => {
    const src = readFileSync(path.join(REPO, 'api/team/pitch.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src).toContain(`db.collection('${TEAM_PITCHES_COLLECTION}').doc(user.uid).set(pitch)`);
    expect(TEAM_PITCHES_COLLECTION).toBe('teamPitches');
  });

  it('reads the flag at CALL time, after auth, in the house shape', () => {
    const src = readFileSync(path.join(REPO, 'api/team/pitch.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src).toContain('if (!BACKING_BETA_ENABLED) return res.status(404)');
    expect(src.indexOf('await requireAuth(')).toBeLessThan(src.indexOf('if (!BACKING_BETA_ENABLED)'));
  });
});
