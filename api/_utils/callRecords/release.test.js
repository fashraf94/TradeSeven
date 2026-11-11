// api/_utils/callRecords/release.test.js
//
// THE COCKPIT'S RELEASE SWITCH — the cohort, the bucket and the control view
// (build prompt BUILD_PROMPT_COCKPIT_RELEASE_SWITCH; docs/audits/
// 20261110_COCKPIT_RELEASE_READINESS.md §9, §10).
//
// Dependency-surface guard (BUILD_RULES §4): this file imports release.js
// UNMOCKED. release.js reaches src/constants/agentGameModes.js (and its one
// import, leagueTournament.js) and node:crypto: if a browser dependency ever
// enters that graph, this import explodes in the Node test environment. Never
// mock it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bucketOf, isInReleaseCohort, parseReleaseDocument, ensureReleaseView, getReleaseView, resetReleaseView,
  RELEASE_COLLECTION, RELEASE_DOC, RELEASE_BP_MAX, RELEASE_VIEW_TTL_MS, RELEASE_FAILURE_TTL_MS, RELEASE_VIEW_MAX_AGE_MS,
  RELEASE_READ_TIMEOUT_MS, RELEASE_EMPTY_VIEW, RELEASE_COHORT_GAME_MODE, RELEASE_STATUSES,
} from './release.js';
import { TIERED_GAME_MODE } from '../../../src/constants/agentGameModes.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const AGENT = 'baggerbomb_agent';
const LEAGUE = 'baggerbomb_tournament';
const viewOf = (shareBp, salt = 'salt-a', over = {}) => ({ status: 'ok', active: true, shareBp, salt, readAtMs: 1, ...over });
const battleOf = (ownerId, over = {}) => ({ id: `b-${ownerId}`, ownerId, gameMode: AGENT, status: 'active', ...over });
/** The first synthetic owner whose bucket under `salt` satisfies the predicate. */
function findOwner(salt, pred, from = 0) {
  for (let i = from; i < from + 300000; i += 1) { const id = `owner-${i}`; if (pred(bucketOf(id, salt))) return id; }
  throw new Error('no owner found');
}

describe('the bucket — uint32(first 4 bytes of sha256(ownerId + salt)) mod 10,000', () => {
  it('is exactly that formula (an independent computation from the hex digest)', () => {
    for (const [owner, salt] of [['owner-1', 'salt-a'], ['owner-2', 'salt-a'], ['uid-abc123', '2026-11'], ['', 'x']]) {
      const hex = createHash('sha256').update(owner + salt).digest('hex');
      expect(bucketOf(owner, salt)).toBe(parseInt(hex.slice(0, 8), 16) % 10000);
    }
  });

  it('golden vectors: the buckets are pinned (a change of formula, separator or byte order moves them)', () => {
    expect(bucketOf('owner-1', 'salt-a')).toBe(2512);
    expect(bucketOf('owner-1', 'salt-b')).toBe(4482);
    expect(bucketOf('owner-2', 'salt-a')).toBe(8527);
    expect(bucketOf('', 'x')).toBe(5986);
    expect(bucketOf('uid-abc123', '2026-11')).toBe(7321);
  });

  it('stability: the same owner and salt always land in the same bucket, in range, across calls', () => {
    for (let i = 0; i < 200; i += 1) {
      const id = `owner-${i}`;
      const a = bucketOf(id, 's');
      expect(bucketOf(id, 's')).toBe(a);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(RELEASE_BP_MAX);
      expect(Number.isInteger(a)).toBe(true);
    }
  });

  it('ownerId + salt is a plain concatenation (no separator): the split point does not matter', () => {
    expect(bucketOf('ab', 'c')).toBe(bucketOf('a', 'bc'));
  });

  it('spreads owners evenly enough to stage by share: 10,000 owners at 1,000 bp land within 1 % of 10 %', () => {
    let under = 0;
    for (let i = 0; i < 10000; i += 1) if (bucketOf(`o${i}`, 's') < 1000) under += 1;
    expect(under).toBe(1002);
  });

  it('a non-string owner or salt has no bucket', () => {
    for (const bad of [null, undefined, 7, {}, []]) { expect(bucketOf(bad, 's')).toBeNull(); expect(bucketOf('o', bad)).toBeNull(); }
  });
});

describe('the cohort — agent mode, a real owner, an active view, bucket < shareBp', () => {
  const salt = 'salt-a';
  const low = findOwner(salt, (b) => b === 0);
  const high = findOwner(salt, (b) => b === 9999);

  it('shareBp boundaries: 0 admits nobody; 1 admits bucket 0 only; 9999 admits all but bucket 9999; 10000 admits everyone', () => {
    expect(bucketOf(low, salt)).toBe(0);
    expect(bucketOf(high, salt)).toBe(9999);
    const mid = findOwner(salt, (b) => b === 5000);
    const at = (bp, owner) => isInReleaseCohort(battleOf(owner), viewOf(bp, salt));
    expect(at(0, low)).toBe(false);
    expect(at(0, mid)).toBe(false);
    expect(at(1, low)).toBe(true);
    expect(at(1, mid)).toBe(false);
    expect(at(9999, high)).toBe(false);
    expect(at(9999, mid)).toBe(true);
    expect(at(9999, low)).toBe(true);
    expect(at(10000, high)).toBe(true);
    expect(at(10000, mid)).toBe(true);
    expect(at(5000, mid)).toBe(false); // bucket 5000 is NOT < 5000
    expect(at(5001, mid)).toBe(true);
  });

  it('raising the share only adds owners: every owner in at a lower share is in at every higher one', () => {
    const owners = Array.from({ length: 400 }, (_, i) => `grow-${i}`);
    const members = (bp) => new Set(owners.filter((o) => isInReleaseCohort(battleOf(o), viewOf(bp, salt))));
    let prev = members(0);
    expect(prev.size).toBe(0);
    for (const bp of [1, 100, 500, 1000, 2500, 5000, 7500, 9999, 10000]) {
      const cur = members(bp);
      for (const o of prev) expect(cur.has(o), `${o} at ${bp}`).toBe(true);
      expect(cur.size).toBeGreaterThanOrEqual(prev.size);
      prev = cur;
    }
    expect(prev.size).toBe(owners.length);
  });

  it('a salt change re-draws: the same share admits a different set of owners', () => {
    const owners = Array.from({ length: 400 }, (_, i) => `redraw-${i}`);
    const set = (s) => new Set(owners.filter((o) => isInReleaseCohort(battleOf(o), viewOf(5000, s))));
    const a = set('salt-a');
    const b = set('salt-b');
    expect([...a].sort().join()).not.toBe([...b].sort().join());
    expect([...a].some((o) => !b.has(o))).toBe(true);
    expect([...b].some((o) => !a.has(o))).toBe(true);
    // and one owner's bucket moves with the salt
    expect(bucketOf('owner-1', 'salt-a')).not.toBe(bucketOf('owner-1', 'salt-b'));
  });

  it('League and every non-agent game mode, a CPU seat, and an empty or non-string owner are NEVER in the cohort — even at share 10000', () => {
    const v = viewOf(10000, salt);
    expect(isInReleaseCohort(battleOf('o1'), v)).toBe(true); // the control row: this battle IS admitted
    for (const gameMode of [LEAGUE, 'baggerbomb_other', '', null, undefined, 'BAGGERBOMB_AGENT']) {
      expect(isInReleaseCohort(battleOf('o1', { gameMode }), v), String(gameMode)).toBe(false);
    }
    expect(isInReleaseCohort(battleOf('o1', { isCpu: true }), v)).toBe(false);
    // a CPU seat by its owner id (League's cpu-{n} codec), whatever its isCpu flag says
    expect(isInReleaseCohort(battleOf('cpu-3'), v)).toBe(false);
    expect(isInReleaseCohort(battleOf('cpu-3', { isCpu: false }), v)).toBe(false);
    expect(isInReleaseCohort(battleOf('cpu3'), v)).toBe(true); // only the `cpu-` prefix is a seat
    expect(isInReleaseCohort(battleOf('o1', { isCpu: false }), v)).toBe(true);
    expect(isInReleaseCohort(battleOf('o1', { isCpu: undefined }), v)).toBe(true);
    for (const ownerId of ['', null, undefined, 42, {}, []]) expect(isInReleaseCohort(battleOf(ownerId), v), String(ownerId)).toBe(false);
    expect(isInReleaseCohort(null, v)).toBe(false);
    expect(isInReleaseCohort(undefined, v)).toBe(false);
    expect(isInReleaseCohort('battle', v)).toBe(false);
  });

  it('an inactive view admits nobody: disabled, absent, malformed, error, timeout, unread, and a view that is simply missing', () => {
    const owner = 'o1';
    for (const status of ['disabled', 'absent', 'malformed', 'error', 'timeout', 'unread']) {
      expect(isInReleaseCohort(battleOf(owner), viewOf(10000, salt, { status, active: false })), status).toBe(false);
    }
    expect(isInReleaseCohort(battleOf(owner), null)).toBe(false);
    expect(isInReleaseCohort(battleOf(owner), undefined)).toBe(false);
    expect(isInReleaseCohort(battleOf(owner), {})).toBe(false);
    expect(isInReleaseCohort(battleOf(owner), RELEASE_EMPTY_VIEW)).toBe(false);
    // `active` must be exactly true
    expect(isInReleaseCohort(battleOf(owner), viewOf(10000, salt, { active: 'yes' }))).toBe(false);
  });

  it('the cohort game mode is the tiered agent game mode, nothing else', () => {
    expect(RELEASE_COHORT_GAME_MODE).toBe(TIERED_GAME_MODE);
    expect(RELEASE_COHORT_GAME_MODE).toBe('baggerbomb_agent');
  });

  it('never throws on a hostile battle', () => {
    const hostile = { get gameMode() { throw new Error('x'); } };
    expect(() => isInReleaseCohort(hostile, viewOf(10000))).not.toThrow();
    expect(isInReleaseCohort(hostile, viewOf(10000))).toBe(false);
  });
});

describe('the control document — what a read means: { shareBp: integer 0–10000, disabled: boolean, salt: string }', () => {
  it('a well-formed, not-disabled document is the live view', () => {
    const v = parseReleaseDocument({ shareBp: 2500, disabled: false, salt: 'a' }, 77);
    expect(v).toMatchObject({ status: 'ok', active: true, shareBp: 2500, salt: 'a', readAtMs: 77 });
  });
  it('the bounds are inclusive: 0 and 10000 are well-formed', () => {
    expect(parseReleaseDocument({ shareBp: 0, disabled: false, salt: 'a' }).active).toBe(true);
    expect(parseReleaseDocument({ shareBp: 10000, disabled: false, salt: 'a' }).active).toBe(true);
  });
  it('disabled: true → empty (status disabled), whatever the share', () => {
    const v = parseReleaseDocument({ shareBp: 10000, disabled: true, salt: 'a' });
    expect(v).toMatchObject({ status: 'disabled', active: false });
  });
  it('a missing document is absent → empty', () => {
    expect(parseReleaseDocument(null)).toMatchObject({ status: 'absent', active: false });
    expect(parseReleaseDocument(undefined)).toMatchObject({ status: 'absent', active: false });
  });
  it('malformed → empty: a non-object, every wrong type or range of each of the three fields', () => {
    const ok = { shareBp: 100, disabled: false, salt: 's' };
    const bad = [
      'string', 42, true, [], [ok],
      { ...ok, shareBp: -1 }, { ...ok, shareBp: 10001 }, { ...ok, shareBp: 1.5 }, { ...ok, shareBp: '100' }, { ...ok, shareBp: NaN },
      { ...ok, shareBp: Infinity }, { ...ok, shareBp: null }, { disabled: false, salt: 's' },
      { ...ok, disabled: 'false' }, { ...ok, disabled: 0 }, { ...ok, disabled: null }, { shareBp: 100, salt: 's' },
      { ...ok, salt: 5 }, { ...ok, salt: null }, { shareBp: 100, disabled: false },
    ];
    for (const data of bad) {
      const v = parseReleaseDocument(data);
      expect(v.active, JSON.stringify(data)).toBe(false);
      expect(v.status, JSON.stringify(data)).toBe('malformed');
    }
  });
  it('an empty salt is a string and is accepted; unknown extra fields are ignored', () => {
    expect(parseReleaseDocument({ shareBp: 5, disabled: false, salt: '' }).active).toBe(true);
    expect(parseReleaseDocument({ shareBp: 5, disabled: false, salt: 'x', note: 'stage 1' }).active).toBe(true);
  });
  it('the place and the statuses', () => {
    expect(`${RELEASE_COLLECTION}/${RELEASE_DOC}`).toBe('cockpitConfig/release');
    expect(RELEASE_STATUSES).toEqual(['ok', 'disabled', 'absent', 'malformed', 'error', 'timeout', 'unread']);
    expect(RELEASE_BP_MAX).toBe(10000);
    expect(RELEASE_VIEW_TTL_MS).toBe(60000);
  });
});

// ---------------------------------------------------------------- the cached view

/** A fake Admin handle: every read of cockpitConfig/release is counted. */
function fakeDb({ data, exists = data !== undefined, throws = false, hang = false, delayMs = 0 } = {}) {
  const calls = { reads: [] };
  const db = {
    calls,
    set data(v) { data = v; },
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          calls.reads.push(`${name}/${id}`);
          if (hang) return new Promise(() => {});
          if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
          if (throws) throw new Error('firestore down');
          return { exists, data: () => data };
        },
      }),
    }),
  };
  return db;
}
const GOOD = { shareBp: 5000, disabled: false, salt: 'salt-a' };

describe('ensureReleaseView — one bounded read, cached, never throws, fails closed', () => {
  beforeEach(() => { resetReleaseView(); });
  afterEach(() => { resetReleaseView(); vi.useRealTimers(); });

  it('before any load the resolver reads the empty view', () => {
    expect(getReleaseView()).toBe(RELEASE_EMPTY_VIEW);
    expect(getReleaseView().active).toBe(false);
  });

  it('a present, well-formed document becomes the cached view the synchronous reader returns', async () => {
    const db = fakeDb({ data: GOOD });
    const v = await ensureReleaseView(db);
    expect(v).toMatchObject({ status: 'ok', active: true, shareBp: 5000, salt: 'salt-a' });
    expect(getReleaseView()).toMatchObject({ status: 'ok', active: true });
    expect(db.calls.reads).toEqual(['cockpitConfig/release']);
  });

  it('absent, malformed and disabled documents → an empty cohort', async () => {
    for (const [data, status] of [[undefined, 'absent'], [{ shareBp: 'x', disabled: false, salt: 's' }, 'malformed'], [{ ...GOOD, disabled: true }, 'disabled']]) {
      resetReleaseView();
      await ensureReleaseView(fakeDb({ data }));
      expect(getReleaseView()).toMatchObject({ status, active: false });
    }
  });

  it('a read ERROR → an empty cohort, not a throw; so is a read that throws synchronously and a db that is not a database', async () => {
    await expect(ensureReleaseView(fakeDb({ data: GOOD, throws: true }))).resolves.toMatchObject({ status: 'error', active: false });
    for (const db of [undefined, null, {}, { collection: () => { throw new Error('boom'); } }, { collection: () => ({ doc: () => { throw new Error('boom'); } }) }]) {
      resetReleaseView();
      await expect(ensureReleaseView(db)).resolves.toMatchObject({ active: false });
      expect(getReleaseView().active).toBe(false);
    }
  });

  it('a read that never answers → timeout within the bound, an empty cohort', async () => {
    const t0 = Date.now();
    const v = await ensureReleaseView(fakeDb({ hang: true }), { timeoutMs: 30 });
    expect(v).toMatchObject({ status: 'timeout', active: false });
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(RELEASE_READ_TIMEOUT_MS).toBe(1500); // the house precedent (callsBlock.js, sweep.js), not tighter
  });

  it('a slow read inside the bound still lands; one past it is a timeout', async () => {
    expect((await ensureReleaseView(fakeDb({ data: GOOD, delayMs: 5 }), { timeoutMs: 500 })).active).toBe(true);
    resetReleaseView();
    expect((await ensureReleaseView(fakeDb({ data: GOOD, delayMs: 200 }), { timeoutMs: 20 })).status).toBe('timeout');
  });

  it('the 60 s cache: a second ask inside the TTL does not read again; one after it does', async () => {
    const db = fakeDb({ data: GOOD });
    await ensureReleaseView(db, { nowMs: 1_000_000 });
    await ensureReleaseView(db, { nowMs: 1_000_000 + RELEASE_VIEW_TTL_MS - 1 });
    expect(db.calls.reads).toHaveLength(1);
    await ensureReleaseView(db, { nowMs: 1_000_000 + RELEASE_VIEW_TTL_MS });
    expect(db.calls.reads).toHaveLength(2);
  });

  it('the kill switch needs no redeploy: `disabled: true` is live on the first read after the TTL, and a re-enable the same way', async () => {
    const db = fakeDb({ data: GOOD });
    await ensureReleaseView(db, { nowMs: 5_000_000 });
    expect(getReleaseView({ nowMs: 5_000_000 }).active).toBe(true);
    db.data = { ...GOOD, disabled: true };
    await ensureReleaseView(db, { nowMs: 5_000_000 + RELEASE_VIEW_TTL_MS });
    expect(getReleaseView({ nowMs: 5_000_000 + RELEASE_VIEW_TTL_MS })).toMatchObject({ status: 'disabled', active: false });
    db.data = GOOD;
    await ensureReleaseView(db, { nowMs: 5_000_000 + 2 * RELEASE_VIEW_TTL_MS });
    expect(getReleaseView({ nowMs: 5_000_000 + 2 * RELEASE_VIEW_TTL_MS }).active).toBe(true);
  });

  it('concurrent request-path callers share ONE read', async () => {
    const db = fakeDb({ data: GOOD, delayMs: 10 });
    const views = await Promise.all([1, 2, 3, 4, 5].map(() => ensureReleaseView(db)));
    expect(db.calls.reads).toHaveLength(1);
    for (const v of views) expect(v.active).toBe(true);
  });

  it('force: true ALWAYS reads (the evaluator and the sweep, once per run), even inside the TTL — and refreshes the cache', async () => {
    const db = fakeDb({ data: GOOD });
    await ensureReleaseView(db, { nowMs: 9_000_000 });
    db.data = { ...GOOD, shareBp: 100 };
    const v = await ensureReleaseView(db, { force: true, nowMs: 9_000_001 });
    expect(db.calls.reads).toHaveLength(2);
    expect(v.shareBp).toBe(100);
    expect(getReleaseView({ nowMs: 9_000_001 }).shareBp).toBe(100);
  });

  it('a FAILED read is remembered for at most 15 s (never the full TTL): the next ask after that reads again', async () => {
    const db = fakeDb({ data: GOOD, throws: true });
    await ensureReleaseView(db, { nowMs: 2_000_000 });
    await ensureReleaseView(db, { nowMs: 2_000_000 + RELEASE_FAILURE_TTL_MS - 1 });
    expect(db.calls.reads).toHaveLength(1);
    await ensureReleaseView(db, { nowMs: 2_000_000 + RELEASE_FAILURE_TTL_MS });
    expect(db.calls.reads).toHaveLength(2);
    expect(RELEASE_FAILURE_TTL_MS).toBeLessThan(RELEASE_VIEW_TTL_MS);
  });

  it('the synchronous reader fails closed on an old view: past 10 minutes it is the empty view', async () => {
    const db = fakeDb({ data: GOOD });
    await ensureReleaseView(db, { nowMs: 3_000_000 });
    expect(getReleaseView({ nowMs: 3_000_000 + RELEASE_VIEW_MAX_AGE_MS }).active).toBe(true);
    expect(getReleaseView({ nowMs: 3_000_000 + RELEASE_VIEW_MAX_AGE_MS + 1 })).toBe(RELEASE_EMPTY_VIEW);
  });

  it('a late-rejecting read after a timeout is swallowed (no unhandled rejection)', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const db = { collection: () => ({ doc: () => ({ get: () => new Promise((_, rej) => setTimeout(() => rej(new Error('late')), 40)) }) }) };
    const v = await ensureReleaseView(db, { timeoutMs: 10 });
    expect(v.status).toBe('timeout');
    await new Promise((r) => setTimeout(r, 80));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe('the module is server-only and writes nothing', () => {
  const src = readFileSync(resolve(HERE, 'release.js'), 'utf8');
  it('no Firestore write, one `.get()`, and it does not create the control document', () => {
    // The one `.update(` is the sha256 hash's (in memory), not a Firestore write.
    expect(src.replace("createHash('sha256').update(", '')).not.toMatch(/\.(set|update|create|delete|add)\(|runTransaction|batch\(|FieldValue/);
    expect(src.match(/\.get\(\)/g)).toHaveLength(1);
  });
  it('no module under src/ imports it (it uses node:crypto)', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const root = resolve(HERE, '../../../src');
    const hits = [];
    (function walk(dir) {
      for (const name of readdirSync(dir)) {
        const p = resolve(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(js|jsx|mjs)$/.test(name) && !/\.test\./.test(name) && /from\s+['"][^'"]*callRecords\/(release|mode)\.js['"]/.test(readFileSync(p, 'utf8'))) hits.push(p);
      }
    })(root);
    expect(hits).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Review findings (docs/audits/20261110_COCKPIT_RELEASE_READINESS.md §10.9): the hardening each one earned.
describe('review hardening — out-of-order reads, guarded arguments, a trusted clock, an own-field document', () => {
  beforeEach(() => { resetReleaseView(); });
  afterEach(() => { resetReleaseView(); });
  /** A db whose read takes `delayMs` and returns `data`. */
  const slowDb = (data, delayMs) => ({ collection: () => ({ doc: () => ({ get: async () => { await new Promise((r) => setTimeout(r, delayMs)); return { exists: true, data: () => data }; } }) }) });

  it('RS-L1-1: a slow, earlier-started read that lands AFTER a newer one cannot undo it — a stale "ok" never overwrites a newer "disabled" (the kill switch)', async () => {
    const slowOk = ensureReleaseView(slowDb(GOOD, 120), { force: true, timeoutMs: 1000 });
    await new Promise((r) => setTimeout(r, 10));
    const fastDisabled = await ensureReleaseView(slowDb({ ...GOOD, disabled: true }, 5), { force: true, timeoutMs: 1000 });
    expect(fastDisabled.status).toBe('disabled');
    const late = await slowOk; // the older read finishes last
    expect(getReleaseView().status).toBe('disabled');
    expect(getReleaseView().active).toBe(false);
    expect(late.status).toBe('disabled'); // it reports the view that stands, not its own
  });

  it('RS-L1-1: the same for a non-forced reader overtaken by a forced one', async () => {
    const slow = ensureReleaseView(slowDb(GOOD, 120), { timeoutMs: 1000 });
    await new Promise((r) => setTimeout(r, 10));
    await ensureReleaseView(slowDb({ ...GOOD, disabled: true }, 5), { force: true, timeoutMs: 1000 });
    await slow;
    expect(getReleaseView().status).toBe('disabled');
  });

  it('RS-L1-3/4/9: a null, non-object or hostile options argument and a non-finite, non-number or absurd bound or TTL never throw or leak a rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const db = fakeDb({ data: GOOD });
    for (const opts of [null, undefined, 7, 'x', [], { ttlMs: 1n }, { ttlMs: Infinity }, { ttlMs: -5 }, { ttlMs: 1e15 }, { timeoutMs: NaN }, { timeoutMs: Infinity }, { timeoutMs: 2 ** 40 }, { nowMs: NaN }, { nowMs: null }, { nowMs: 'x' }]) {
      resetReleaseView();
      await expect(ensureReleaseView(db, opts), JSON.stringify(opts, (k, v) => (typeof v === 'bigint' ? 'big' : v))).resolves.toBeDefined();
    }
    await new Promise((r) => setTimeout(r, 20));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(() => getReleaseView(null)).not.toThrow();
    expect(() => getReleaseView(7)).not.toThrow();
  });

  it('RS-L1-6: a bad clock cannot make a stale view look fresh — a NaN/garbage nowMs reads the real clock; a view dated in the future is not trusted; a pinned TTL is clamped', async () => {
    const db = fakeDb({ data: GOOD });
    await ensureReleaseView(db, { nowMs: Date.now() - RELEASE_VIEW_MAX_AGE_MS - 1000 }); // a 10-minute-old view
    for (const nowMs of [NaN, null, 'x', {}, undefined]) expect(getReleaseView({ nowMs }).active, String(nowMs)).toBe(false);
    resetReleaseView();
    await ensureReleaseView(db, { nowMs: Date.now() + 3_600_000 }); // read "an hour from now": a clock stepped back since
    expect(getReleaseView().active).toBe(false);
    resetReleaseView();
    await ensureReleaseView(db, { ttlMs: 1e15 });
    expect(getReleaseView().active).toBe(true);
    // the TTL was clamped to the max age, so a non-forced ask after that reads again (it is never pinned)
    const reads = db.calls.reads.length;
    await ensureReleaseView(db, { nowMs: Date.now() + RELEASE_VIEW_MAX_AGE_MS + 1 });
    expect(db.calls.reads.length).toBe(reads + 1);
  });

  it('RS-L1-5: a document with inherited fields, or a throwing getter, is malformed — not "ok"', () => {
    const inherited = Object.create({ shareBp: 10000, disabled: false, salt: 'x' });
    expect(parseReleaseDocument(inherited)).toMatchObject({ status: 'malformed', active: false });
    const hostile = { get shareBp() { throw new Error('x'); }, disabled: false, salt: '' };
    expect(() => parseReleaseDocument(hostile)).not.toThrow();
    expect(parseReleaseDocument(hostile)).toMatchObject({ status: 'malformed', active: false });
    expect(parseReleaseDocument({ shareBp: 10000, disabled: false })).toMatchObject({ status: 'malformed' });
  });

  it('RS-L1-8: a hand-built view is not trusted by coercion — a string or infinite shareBp or a non-string salt admits nobody', () => {
    const owner = 'o1';
    expect(isInReleaseCohort(battleOf(owner), viewOf(10000))).toBe(true); // control
    for (const bad of [{ shareBp: '10000' }, { shareBp: Infinity }, { shareBp: NaN }, { shareBp: 1.5 }, { shareBp: -1 }, { shareBp: 10001 }, { salt: 5 }, { salt: undefined }]) {
      expect(isInReleaseCohort(battleOf(owner), { ...viewOf(10000), ...bad }), JSON.stringify(bad)).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RS-L2-1 / RS-L2-2 / RS-L1-2 / RS-L3-4: what a FAILED read costs a cohort battle, and how much of it is avoidable
// without breaking the founder's rule that a read error or timeout is an EMPTY cohort (fail closed).
describe('a failed read — the cost is bounded: a late landing corrects the cache, a forced read retries once, a failure leaves a line', () => {
  beforeEach(() => { resetReleaseView(); });
  afterEach(() => { resetReleaseView(); vi.restoreAllMocks(); });
  /** A db whose reads follow a script: each entry { delay, data | throws | hang }, in order, then the last repeats. */
  function scripted(steps) {
    let n = 0;
    const calls = [];
    return {
      calls,
      collection: () => ({ doc: () => ({ get: async () => {
        const s = steps[Math.min(n, steps.length - 1)]; n += 1; calls.push(s);
        if (s.hang) return new Promise(() => {});
        if (s.delay) await new Promise((r) => setTimeout(r, s.delay));
        if (s.throws) throw new Error('down');
        return { exists: s.data !== undefined, data: () => s.data };
      } }) }),
    };
  }

  it('a read that misses its bound reports timeout NOW (the caller is not held), then the late document REPLACES the failure — a cold instance\'s slow first RPC is not a 15 s outage', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = scripted([{ delay: 120, data: GOOD }]);
    const t0 = Date.now();
    const v = await ensureReleaseView(db, { timeoutMs: 20 });
    expect(Date.now() - t0).toBeLessThan(100);
    expect(v.status).toBe('timeout');
    expect(getReleaseView().active).toBe(false);
    await new Promise((r) => setTimeout(r, 200));
    expect(getReleaseView()).toMatchObject({ status: 'ok', active: true });
  });

  it('a late landing never overrides a newer read: a late "ok" cannot undo a newer "disabled"', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await ensureReleaseView(scripted([{ delay: 150, data: GOOD }]), { timeoutMs: 20 }); // timeout view standing; the real read in flight
    await ensureReleaseView(scripted([{ data: { ...GOOD, disabled: true } }]), { force: true });
    await new Promise((r) => setTimeout(r, 250));
    expect(getReleaseView().status).toBe('disabled');
  });

  it('a late FAILURE changes nothing (and is not an unhandled rejection)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const db = { collection: () => ({ doc: () => ({ get: () => new Promise((_, rej) => setTimeout(() => rej(new Error('late')), 60)) }) }) };
    await ensureReleaseView(db, { timeoutMs: 10 });
    await new Promise((r) => setTimeout(r, 120));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(getReleaseView().active).toBe(false);
  });

  it('a FORCED read (the evaluator, once per run) retries once on an error or a timeout — a single blip no longer empties the cohort for the whole run', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const first of [{ throws: true }, { hang: true }]) {
      resetReleaseView();
      const db = scripted([first, { data: GOOD }]);
      const v = await ensureReleaseView(db, { force: true, timeoutMs: 30 });
      expect(db.calls).toHaveLength(2);
      expect(v).toMatchObject({ status: 'ok', active: true });
    }
  });

  it('...but gives up after the one retry (fail closed), `retry: false` opts out (the sweep), and a non-forced request-path read never retries', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const down = scripted([{ throws: true }]);
    expect((await ensureReleaseView(down, { force: true })).status).toBe('error');
    expect(down.calls).toHaveLength(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[release] control view error'));
    resetReleaseView();
    const noRetry = scripted([{ throws: true }, { data: GOOD }]);
    expect((await ensureReleaseView(noRetry, { force: true, retry: false })).status).toBe('error');
    expect(noRetry.calls).toHaveLength(1);
    resetReleaseView();
    const request = scripted([{ throws: true }, { data: GOOD }]);
    expect((await ensureReleaseView(request)).status).toBe('error');
    expect(request.calls).toHaveLength(1);
  });

  it('an absent or disabled document is NOT a failure: no retry and no warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const absent = scripted([{ data: undefined }]);
    await ensureReleaseView(absent, { force: true });
    expect(absent.calls).toHaveLength(1);
    resetReleaseView();
    await ensureReleaseView(scripted([{ data: { ...GOOD, disabled: true } }]), { force: true });
    expect(warn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- review round 1, lens 4 (test integrity)

describe('lens 4 — fail-closed against an ACTIVE view, the default bound, the timeout TTL, force vs an in-flight read, the timer', () => {
  beforeEach(() => { resetReleaseView(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { resetReleaseView(); vi.useRealTimers(); vi.restoreAllMocks(); });
  /** Each read follows the next step ({ data | throws | hang | delay }); the last repeats. */
  function scripted(steps) {
    let n = 0;
    const calls = [];
    return {
      calls,
      collection: () => ({ doc: () => ({ get: async () => {
        const s = steps[Math.min(n, steps.length - 1)]; n += 1; calls.push(s);
        if (s.hang) return new Promise(() => {});
        if (s.delay) await new Promise((r) => setTimeout(r, s.delay));
        if (s.throws) throw new Error('down');
        return { exists: s.data !== undefined, data: () => s.data };
      } }) }),
    };
  }
  const T = 7_000_000;

  it('RS-L4-2: an ACTIVE view followed by an error, a hang, a deleted document or a Console typo is an EMPTY cohort — never kept (no fail-open until the 10-minute cut-off)', async () => {
    for (const [label, second] of [
      ['error', { throws: true }], ['hang', { hang: true }], ['deleted', { data: undefined }],
      ['typo', { data: { shareBp: '500', disabled: false, salt: 's' } }], ['disabled', { data: { ...GOOD, disabled: true } }],
    ]) {
      resetReleaseView();
      const db = scripted([{ data: GOOD }, second]);
      await ensureReleaseView(db, { nowMs: T });
      expect(getReleaseView({ nowMs: T }).active, `${label}: first`).toBe(true);
      await ensureReleaseView(db, { nowMs: T + RELEASE_VIEW_TTL_MS, timeoutMs: 20 });
      expect(getReleaseView({ nowMs: T + RELEASE_VIEW_TTL_MS }).active, label).toBe(false);
      expect(db.calls, label).toHaveLength(2);
    }
  });

  it('RS-L4-5: the DEFAULT bound is the 1,500 ms constant — a read that never answers is a timeout at about 1.5 s, not 60 s', async () => {
    vi.useFakeTimers();
    const p = ensureReleaseView(scripted([{ hang: true }]));
    let done = false;
    p.then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(RELEASE_READ_TIMEOUT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(done).toBe(true);
    expect(await p).toMatchObject({ status: 'timeout', active: false });
  });

  it('RS-L4-6 (R5): a TIMEOUT view is remembered for at most 15 s too, not the full 60 s', async () => {
    const db = scripted([{ hang: true }, { data: GOOD }]);
    await ensureReleaseView(db, { nowMs: T, timeoutMs: 10 });
    expect(db.calls).toHaveLength(1);
    await ensureReleaseView(db, { nowMs: T + RELEASE_FAILURE_TTL_MS - 1, timeoutMs: 10 });
    expect(db.calls).toHaveLength(1);
    await ensureReleaseView(db, { nowMs: T + RELEASE_FAILURE_TTL_MS, timeoutMs: 10 });
    expect(db.calls).toHaveLength(2);
    expect(getReleaseView({ nowMs: T + RELEASE_FAILURE_TTL_MS }).active).toBe(true);
  });

  it('RS-L4-6 (R6): a FORCED read never joins an in-flight non-forced one — it makes its own read', async () => {
    const db = scripted([{ delay: 30, data: GOOD }]);
    const slow = ensureReleaseView(db);
    const forced = ensureReleaseView(db, { force: true });
    await Promise.all([slow, forced]);
    expect(db.calls).toHaveLength(2);
  });

  it('RS-L4-6 (R7): the bound timer is cleared once the read settles — none is left armed (a CLI would linger for its whole bound)', async () => {
    vi.useFakeTimers();
    await ensureReleaseView(scripted([{ data: GOOD }]), { timeoutMs: 10_000 });
    expect(vi.getTimerCount()).toBe(0);
  });
});
