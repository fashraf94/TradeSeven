// api/eligibility/attest.test.js
//
// POST /api/eligibility/attest — Backing Beta PR 0 (spec V1.3 §12 PR 0, D-z).
//
// The ordered pipeline, each check falsifiable: method, auth, the flag, the
// body, the one transaction. The write shape is asserted EXACTLY, the second
// call is proved to write nothing, and the race — two first taps — runs on the
// research.test.js harness: `runTransaction` runs the body, buffers its
// writes, and, when a row injects a competing write between the read and the
// commit, discards the buffer and RE-RUNS the body against the changed doc,
// the way the real client retries on contention.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the route's real import below is
// the runtime guard for its api/ -> src/ imports (src/constants/eligibility.js,
// src/config/featureFlags.js) — it explodes in this Node test env if a
// browser-only dep ever enters that graph. Never mock the constants module.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const read = (rel) => readFileSync(path.join(REPO, rel), 'utf8');

const state = vi.hoisted(() => ({
  flag: true,
  uid: 'owner-1',
  docs: {},
  reads: 0,
  attempts: 0,
  committed: [],
  injectBeforeCommit: null,
  txThrows: null,
}));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (!state.uid) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: state.uid };
  },
}));
// The flag is settable per row; everything else in the module is the real thing.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get ELIGIBILITY_ATTESTATION_ENABLED() { return state.flag; },
}));

function snap(col, id) {
  state.reads += 1;
  const data = state.docs[`${col}/${id}`];
  return { exists: data !== undefined, id, data: () => (data === undefined ? undefined : { ...data }) };
}
const db = {
  collection: (col) => ({ doc: (id) => ({ __col: col, __id: id, get: async () => snap(col, id) }) }),
  runTransaction: async (fn) => {
    if (state.txThrows) throw state.txThrows;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      state.attempts += 1;
      const buffer = [];
      const tx = {
        get: async (ref) => {
          if (buffer.length > 0) throw new Error('transaction read after write');
          return snap(ref.__col, ref.__id);
        },
        set: (ref, data, opts) => buffer.push({ path: `${ref.__col}/${ref.__id}`, data, opts }),
        update: () => { throw new Error('the route never updates — a whole-doc set or nothing'); },
      };
      const result = await fn(tx);
      if (state.injectBeforeCommit && attempt === 1) {
        state.injectBeforeCommit();
        state.injectBeforeCommit = null;
        continue; // contention: discard the buffer, re-run the body
      }
      for (const w of buffer) { state.docs[w.path] = { ...w.data }; state.committed.push(w); }
      return result;
    }
    throw new Error('transaction contention exhausted');
  },
};
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => db }));

const { default: handler, buildAttestation, ATTESTATION_SOURCE } = await import('./attest.js');
const { TERMS_VERSION, ATTESTATION_COPY } = await import('../../src/constants/eligibility.js');
const { ELIGIBILITY_COLLECTION } = await import('../_utils/eligibility.js');

const mkRes = () => ({
  statusCode: null,
  body: null,
  committedAtReply: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; this.committedAtReply = state.committed.length; return this; },
});
const post = async (body, method = 'POST') => {
  const res = mkRes();
  await handler({ method, headers: {}, body }, res);
  return res;
};
const VALID = Object.freeze({ adultAttested: true, termsVersion: TERMS_VERSION });
const T0 = new Date('2026-09-14T13:30:00.000Z');
const EXPECTED_AT_T0 = Object.freeze({
  adultAttestedAt: '2026-09-14T13:30:00.000Z',
  termsVersion: TERMS_VERSION,
  acceptedAt: '2026-09-14T13:30:00.000Z',
  source: 'backing_beta',
});

beforeEach(() => {
  state.flag = true;
  state.uid = 'owner-1';
  state.docs = {};
  state.reads = 0;
  state.attempts = 0;
  state.committed = [];
  state.injectBeforeCommit = null;
  state.txThrows = null;
  // Date only — the route's timestamps come from `new Date()`; nothing here
  // needs faked timers, and faking them would stall the awaited transaction.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('the pipeline, in order', () => {
  it('405s anything but POST, before auth', async () => {
    state.uid = null;
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const res = await post(VALID, method);
      expect(res.statusCode).toBe(405);
      expect(res.body).toEqual({ error: 'Method not allowed' });
    }
    expect(state.reads).toBe(0);
  });

  it('401s without a caller — BEFORE the flag, so an anonymous caller learns nothing about it', async () => {
    state.uid = null;
    for (const flag of [true, false]) {
      state.flag = flag;
      expect((await post(VALID)).statusCode).toBe(401);
    }
    expect(state.reads).toBe(0);
    expect(state.attempts).toBe(0);
  });

  it('404s while the flag is dark, after auth — the darkness suite proves the rest', async () => {
    state.flag = false;
    const res = await post(VALID);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(state.reads).toBe(0);
    expect(state.attempts).toBe(0);
  });
});

describe('the body — each refusal a plain reason, nothing read, no transaction opened', () => {
  it('400s when adultAttested is anything but boolean true', async () => {
    for (const adultAttested of [undefined, null, false, 'true', 1, 'yes', {}, []]) {
      const res = await post({ ...VALID, adultAttested });
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'adultAttested must be true' });
    }
    expect(state.reads).toBe(0);
    expect(state.attempts).toBe(0);
  });

  it('400s when termsVersion is missing, stale, or not the exact string', async () => {
    for (const termsVersion of [undefined, null, '', 'beta-2026-08-draft', TERMS_VERSION.toUpperCase(), ` ${TERMS_VERSION}`, `${TERMS_VERSION} `, 1, [TERMS_VERSION]]) {
      const res = await post({ ...VALID, termsVersion });
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: `termsVersion must be ${TERMS_VERSION}` });
    }
    expect(state.reads).toBe(0);
    expect(state.attempts).toBe(0);
  });

  it('400s an absent or non-object body with the adultAttested reason (the first check)', async () => {
    for (const body of [undefined, null, 'adultAttested=true', 42, true]) {
      const res = await post(body);
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'adultAttested must be true' });
    }
    expect(state.attempts).toBe(0);
  });

  it('checks adultAttested before termsVersion — a body wrong on both is refused for the first', async () => {
    const res = await post({ adultAttested: false, termsVersion: 'nope' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'adultAttested must be true' });
  });
});

describe('the first call — the exact write', () => {
  it('writes eligibility/{uid} with exactly the four §6 fields and answers with the doc', async () => {
    const res = await post(VALID);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ eligible: true, attestation: EXPECTED_AT_T0 });
    expect(state.committed).toHaveLength(1);
    expect(state.committed[0].path).toBe('eligibility/owner-1');
    expect(state.committed[0].data).toEqual(EXPECTED_AT_T0);
    expect(Object.keys(state.committed[0].data).sort()).toEqual(['acceptedAt', 'adultAttestedAt', 'source', 'termsVersion']);
    // Whole-doc set, no merge — the doc IS the attestation.
    expect(state.committed[0].opts).toBeUndefined();
    expect(state.docs['eligibility/owner-1']).toEqual(EXPECTED_AT_T0);
  });

  it('both timestamps are the same instant — one request, one affirmation of both statements', async () => {
    const { attestation } = (await post(VALID)).body;
    expect(attestation.adultAttestedAt).toBe(attestation.acceptedAt);
    expect(attestation.adultAttestedAt).toBe(T0.toISOString());
  });

  it('the uid comes from the token, never the body', async () => {
    const res = await post({ ...VALID, uid: 'someone-else', userId: 'someone-else' });
    expect(res.statusCode).toBe(200);
    expect(state.committed).toHaveLength(1);
    expect(state.committed[0].path).toBe('eligibility/owner-1');
    expect(state.docs['eligibility/someone-else']).toBeUndefined();
  });

  it('the write is AWAITED — the reply is sent only after the commit landed (BUILD_RULES §5)', async () => {
    const res = await post(VALID);
    expect(res.statusCode).toBe(200);
    expect(res.committedAtReply).toBe(1);
  });

  it('opens exactly one transaction and reads the doc inside it — no read outside', async () => {
    await post(VALID);
    expect(state.attempts).toBe(1);
    expect(state.reads).toBe(1);
  });

  it('ignores extra body fields — nothing the client sends reaches the doc', async () => {
    await post({ ...VALID, source: 'client', adultAttestedAt: '1999-01-01T00:00:00.000Z', acceptedAt: 'x', extra: true });
    expect(state.committed[0].data).toEqual(EXPECTED_AT_T0);
  });

  it("writes where the helper reads — the ref is the helper's eligibilityRef, and the collection is eligibility", () => {
    const src = read('api/eligibility/attest.js');
    expect(src).toContain("import { eligibilityRef } from '../_utils/eligibility.js';");
    expect(src).toContain('const ref = eligibilityRef(db, user.uid);');
    expect(ELIGIBILITY_COLLECTION).toBe('eligibility');
    // ONE tx.set and no other write verb — the count the scanner allowlist pins.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code.match(/tx\.set\(/g)).toHaveLength(1);
    expect(code).not.toMatch(/tx\.(update|create|delete)\(|\.(update|create|delete|add)\(/);
  });
});

describe('the second call — idempotent, no write, no timestamp bump', () => {
  it('returns the existing doc unchanged and writes nothing', async () => {
    const first = await post(VALID);
    vi.setSystemTime(new Date('2026-09-20T09:00:00.000Z')); // a week later
    const second = await post(VALID);
    expect(second.statusCode).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(second.body.attestation.acceptedAt).toBe(T0.toISOString());
    expect(second.body.attestation.adultAttestedAt).toBe(T0.toISOString());
    expect(state.committed).toHaveLength(1); // the first call's write, and only that
    expect(state.docs['eligibility/owner-1']).toEqual(first.body.attestation);
  });

  it('returns a pre-existing doc as-is — even one recorded under an older terms version', async () => {
    const older = { adultAttestedAt: '2026-08-01T00:00:00.000Z', termsVersion: 'beta-2026-08-draft', acceptedAt: '2026-08-01T00:00:00.000Z', source: 'backing_beta' };
    state.docs['eligibility/owner-1'] = { ...older };
    const res = await post(VALID);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ eligible: true, attestation: older });
    expect(state.committed).toHaveLength(0);
    expect(state.attempts).toBe(1);
  });
});

describe('the race — two first taps', () => {
  it("a concurrent first writer wins; this request re-runs, writes nothing, and returns the winner's doc", async () => {
    const winner = { adultAttestedAt: '2026-09-14T13:29:59.000Z', termsVersion: TERMS_VERSION, acceptedAt: '2026-09-14T13:29:59.000Z', source: 'backing_beta' };
    state.injectBeforeCommit = () => { state.docs['eligibility/owner-1'] = { ...winner }; };
    const res = await post(VALID);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ eligible: true, attestation: winner });
    expect(state.attempts).toBe(2);           // read → contention → re-run
    expect(state.committed).toHaveLength(0);  // the loser's buffered set was discarded, never committed
    expect(state.docs['eligibility/owner-1']).toEqual(winner); // the timestamp of record survives
  });
});

describe('failure', () => {
  it('500s when the transaction throws, with a plain reason and no doc', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    state.txThrows = new Error('UNAVAILABLE');
    const res = await post(VALID);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Attestation failed' });
    expect(state.docs['eligibility/owner-1']).toBeUndefined();
    expect(state.committed).toHaveLength(0);
  });
});

describe('buildAttestation — the shape, exported for the record', () => {
  it('both timestamps are the same instant, the source is backing_beta', () => {
    const now = new Date('2026-09-14T13:30:00.000Z');
    expect(buildAttestation({ termsVersion: TERMS_VERSION, now })).toEqual({
      adultAttestedAt: '2026-09-14T13:30:00.000Z',
      termsVersion: TERMS_VERSION,
      acceptedAt: '2026-09-14T13:30:00.000Z',
      source: ATTESTATION_SOURCE,
    });
    expect(ATTESTATION_SOURCE).toBe('backing_beta');
  });

  it('the constants module the route validates against is the real one (dependency-surface guard)', () => {
    expect(TERMS_VERSION).toBe('beta-2026-09-draft');
    expect(Object.keys(ATTESTATION_COPY).sort()).toEqual(['adult', 'terms']);
  });
});
