// api/_utils/practiceField/ideaBook.test.js
//
// Practice Field T1a-1 — the book, its epoch, its creation, the mode gate and the Film Room's two helpers (build
// prompt §2, rule 5; shared contract V2 §3, §3.1; Amendment B item 1).
//
// This file's import of mode.js is the dependency-surface guard for the api → src/config flag import
// (BUILD_RULES §4): never mocked. The mode is set with the tests-only setter.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  practiceFieldMode, practiceFieldLive, practiceFieldAdmits, setPracticeFieldModeForTests,
} from './mode.js';
import {
  buildIdeaBookDoc, buildIdeaBookEpochDoc, buildIdeaBookGateConfig, createIdeaBook, ideaBookIdFor,
  bookConfigSource,
} from './ideaBook.js';
import { bookForOwner, bookIsForAgent } from './bookStore.js';
import {
  bookForOwner as seamBookForOwner, bookIsForAgent as seamBookIsForAgent, PRACTICE_FIELD_SEAM_DEFAULTS,
} from '../filmRoom/practiceFieldSeam.js';
import { assertReconciled } from './reconcile.js';
import { markedEquityCents } from './ledger.js';
import { isSectorCapCorrected } from '../mandateSectorCap.js';
import { buildNewMandateDoc } from '../mandateSchema.js';
import { listArchetypeIds } from '../archetypeRegistry.js';
import { COCKPIT_ALLOWLIST_ENV } from '../callRecords/allowlist.js';
import { isIdeaBook, bookKindOf, splitActiveBooks } from '../mandateBookKind.js';
import { makeMandateFakeDb, etIso, DAYS } from './__testsupport__/fixtures.js';

const NOW = etIso(DAYS.admit, 9, 0);
const untouchable = new Proxy({}, { get() { throw new Error('the database was touched'); } });
const args = (over = {}) => ({ uid: 'owner-1', attributionAgentId: 'agent-ranked-1', archetypeCodeId: 'momentum_chaser', opId: 'create-1', nowIso: NOW, ...over });

let restoreMode;
let savedEnv;
beforeEach(() => { savedEnv = process.env[COCKPIT_ALLOWLIST_ENV]; restoreMode = setPracticeFieldModeForTests('on'); });
afterEach(() => {
  restoreMode();
  if (savedEnv === undefined) delete process.env[COCKPIT_ALLOWLIST_ENV]; else process.env[COCKPIT_ALLOWLIST_ENV] = savedEnv;
});

describe('the mode gate (rule 5)', () => {
  it('the SHIPPED value is off: nobody is admitted, nothing is live', () => {
    setPracticeFieldModeForTests(null);
    expect(practiceFieldMode()).toBe('off');
    expect(practiceFieldLive()).toBe(false);
    expect(practiceFieldAdmits('owner-1')).toBe(false);
  });

  it("'allowlist' admits only a uid the cockpit's server-side allowlist holds, read at call time", () => {
    setPracticeFieldModeForTests('allowlist');
    delete process.env[COCKPIT_ALLOWLIST_ENV];
    expect(practiceFieldLive()).toBe(true);
    expect(practiceFieldAdmits('owner-1')).toBe(false);
    process.env[COCKPIT_ALLOWLIST_ENV] = ' owner-2 , owner-1 ';
    expect(practiceFieldAdmits('owner-1')).toBe(true);
    expect(practiceFieldAdmits('owner-3')).toBe(false);
    process.env[COCKPIT_ALLOWLIST_ENV] = 'owner-2';
    expect(practiceFieldAdmits('owner-1')).toBe(false); // nothing was cached
  });

  it("'on' admits every non-empty uid; an unknown value reads as off", () => {
    expect(practiceFieldAdmits('anyone')).toBe(true);
    expect(practiceFieldAdmits('')).toBe(false);
    expect(practiceFieldAdmits(null)).toBe(false);
    setPracticeFieldModeForTests('yes');
    expect(practiceFieldMode()).toBe('off');
    expect(practiceFieldLive()).toBe(false);
  });

  it('the setter is for tests only: it throws outside the vitest runner and under NODE_ENV production', () => {
    const vitest = process.env.VITEST;
    const nodeEnv = process.env.NODE_ENV;
    try {
      delete process.env.VITEST;
      expect(() => setPracticeFieldModeForTests('on')).toThrow(/tests only/);
      process.env.VITEST = vitest;
      process.env.NODE_ENV = 'production';
      expect(() => setPracticeFieldModeForTests('on')).toThrow(/tests only/);
    } finally {
      process.env.VITEST = vitest;
      if (nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = nodeEnv;
    }
  });
});

describe("mode 'off' makes every Practice Field path a no-op, before any read", () => {
  it('creation, admission, release, the seam, the entry pass, one entry, the eval pass and the close all answer without touching the database', async () => {
    setPracticeFieldModeForTests(null); // the shipped value
    const { admitIdea, releaseIdea } = await import('./admission.js');
    const { enterIdea, runIdeaBookEntryPass } = await import('./entry.js');
    const { closeIdeaBook } = await import('./close.js');
    const { runIdeaBookEvalPass } = await import('./sweep.js');
    const ref = new Proxy({ id: 'b' }, { get(t, k) { if (k === 'id') return 'b'; throw new Error('the book reference was touched'); } });
    const tick = { date: DAYS.d1, slot: 'open30', tickKey: `${DAYS.d1}_open30` };
    expect(await createIdeaBook(untouchable, args())).toEqual({ ok: false, code: 'mode_not_admitted' });
    expect((await admitIdea(untouchable, { bookId: 'b', contract: {}, opId: 'o', nowIso: NOW })).refusals.map((r) => r.code)).toContain('mode_not_admitted');
    expect(await releaseIdea(untouchable, { bookId: 'b', ideaId: 'i', nowIso: NOW })).toEqual({ ok: false, code: 'mode_not_admitted' });
    expect(await bookForOwner(untouchable, { uid: 'owner-1', attributionAgentId: 'agent-ranked-1' })).toBeNull();
    expect(await enterIdea(untouchable, { bookRef: ref, ideaId: 'i', tick, snapshot: {}, nowIso: NOW })).toEqual({ outcome: 'practice_field_off' });
    expect(await runIdeaBookEntryPass(untouchable, { bookRef: ref, tick, snapshot: {} })).toEqual({ served: false, entered: 0, waiting: 0, cancelled: 0, errors: 0 });
    expect(await runIdeaBookEvalPass(untouchable, { tick, snapshot: {}, ownerToken: 't' })).toEqual({ books: 0, served: 0, entered: 0, waiting: 0, cancelled: 0, errors: 0, leaseSkips: 0 });
    expect(await closeIdeaBook(untouchable, ref, { date: DAYS.d1 })).toEqual({ closed: false, skipped: 'practice_field_off', alerts: [] });
  });
});

describe('the book-kind discriminant', () => {
  it('only `kind: idea_book` is an idea book; a legacy book with no kind, or kind quarterly, is quarterly', () => {
    expect(isIdeaBook({ kind: 'idea_book' })).toBe(true);
    for (const b of [{}, { kind: 'quarterly' }, { kind: 'branch_book' }, null, undefined, 'idea_book']) expect(isIdeaBook(b)).toBe(false);
    expect(bookKindOf({})).toBe('quarterly');
    expect(bookKindOf({ kind: 'idea_book' })).toBe('idea_book');
    const legacy = buildNewMandateDoc({ mandateId: 'm1', userId: 'u', archetype: 'analyst', managerAgentId: 'mgr', vintageRef: 'archetypeVintages/x', cadenceTier: 'fast', createdAt: new Date(), quarterStartAt: new Date(), nextRolloverAt: new Date(), escapeHatchEligibleUntil: new Date() });
    expect(Object.hasOwn(legacy, 'kind')).toBe(false); // the quarterly document keeps exactly its shape
    expect(isIdeaBook(legacy)).toBe(false);
  });

  it('splitActiveBooks: with no idea book the view is the input; an idea book is visible only while its passes are live', () => {
    const doc = (data) => ({ data: () => data });
    const q1 = doc({}); const q2 = doc({ kind: 'quarterly' }); const i1 = doc({ kind: 'idea_book' });
    expect(splitActiveBooks([q1, q2], { ideaBooksLive: true })).toEqual({ visibleDocs: [q1, q2], quarterlyCount: 2, ideaCount: 0, hiddenIdeaCount: 0 });
    expect(splitActiveBooks([q1, i1, q2], { ideaBooksLive: true })).toEqual({ visibleDocs: [q1, i1, q2], quarterlyCount: 2, ideaCount: 1, hiddenIdeaCount: 0 });
    expect(splitActiveBooks([q1, i1, q2], { ideaBooksLive: false })).toEqual({ visibleDocs: [q1, q2], quarterlyCount: 2, ideaCount: 0, hiddenIdeaCount: 1 });
    expect(splitActiveBooks([i1])).toEqual({ visibleDocs: [], quarterlyCount: 0, ideaCount: 0, hiddenIdeaCount: 1 });
  });
});

describe('the idea book document and its epoch', () => {
  const book = () => buildIdeaBookDoc({ bookId: 'b1', userId: 'owner-1', attributionAgentId: 'agent-ranked-1', archetypeCodeId: 'diversifier', epochId: 'epoch-0001', createdAt: new Date(NOW), createOpId: 'create-1' });

  it('is a $100,000 book of kind idea_book with the engine\'s blocks, its identity written once, and nothing reserved', () => {
    const b = book();
    expect(b).toMatchObject({
      kind: 'idea_book', userId: 'owner-1', status: 'active', revision: 0, attributionAgentId: 'agent-ranked-1',
      archetypeCodeId: 'diversifier', contractVersion: 2, slotsVersion: 1, fundsVersion: 1, sectorBridgeVersion: 1,
      currentEpochId: 'epoch-0001', drafting: 'on', windDown: null,
      treasury: { unreservedCash: 100000 }, slots: { short: null, medium: null, long: null }, openIdeaIds: [],
    });
    expect(b.portfolio).toMatchObject({ cash: 100000, positions: {}, totalValue: 100000, initialValue: 100000 });
    expect(Object.keys(b.health)).toContain('lastEvalSweepAt'); // the sweeps order by these: present, never missing
    expect(Object.keys(b.health)).toContain('lastCloseAttemptAt');
    expect(b.execState.lastCloseKey).toBeNull();
    expect(markedEquityCents(b.treasury.unreservedCash, []).equityCents).toBe(10000000); // the one R-19 basis (ledger.js)
    expect(() => assertReconciled(b, [])).not.toThrow();
  });

  it('the quarterly fields are ABSENT, not zero', () => {
    const b = book();
    for (const f of ['quarterIndex', 'quarterKey', 'nextRolloverAt', 'escapeHatchEligibleUntil', 'cadenceTier', 'vintageRef', 'quarterStartAt', 'managerAgentId', 'scoring']) {
      expect(Object.hasOwn(b, f), f).toBe(false);
    }
    // The portfolio keeps what the idea book maintains, and nothing it does not (review L1-10): no quarter lens, no
    // lifetime lens, no sector weights.
    expect(Object.keys(b.portfolio).sort()).toEqual(['cash', 'initialValue', 'positions', 'totalValue']);
  });

  it('the epoch freezes the gate limits through T0a\'s corrected translation, with the cash floor replaced by B2', () => {
    const e = buildIdeaBookEpochDoc({ bookId: 'b1', epochId: 'epoch-0001', archetypeCodeId: 'diversifier', openedAt: NOW });
    expect(e.gateConfig).toEqual({
      cashFloorPct: 0.10, maxPositions: 15, maxSinglePositionWeightPct: 0.35,
      sectorCapSlots: 2, sectorCapDenominator: 6, sectorConcentrationCap: 2 / 6, sectorCapConversionVersion: 1,
    });
    expect(isSectorCapCorrected(e.gateConfig)).toBe(true);
    expect(e.rails).toEqual({
      slotsVersion: 1, slotCapShare: { short: 0.2, medium: 0.3, long: 0.4 }, namesPerIdea: { min: 1, max: 4 },
      lineDistance: { short: { min: 0.03, max: 0.08 }, medium: { min: 0.06, max: 0.15 }, long: { min: 0.1, max: 0.25 } },
    });
    expect(e).toMatchObject({ frictionModelVersion: 'p3_cap_tier_v1', fundsVersion: 1, contractVersion: 2, configVersion: 1, openedAt: NOW });
    // Direction note ruling 13: this build assumes no number of checks.
    expect(e.windows).toBeNull();
    expect(e.settingsSnapshot).toBeNull();
    expect(e.model).toBeNull();
    expect(Object.hasOwn(e, 'cadenceTier')).toBe(false);
  });

  it('each archetype\'s translated sector cap: Diversifier and Capital Preserver 1/3, Speculator 2/3, the rest 1/2', () => {
    const caps = Object.fromEntries(listArchetypeIds().map((id) => [id, buildIdeaBookGateConfig(id).gateConfig.sectorCapSlots]));
    expect(caps).toEqual({ analyst: 3, guardian: 2, contrarian: 3, diversifier: 2, momentum_chaser: 3, degen: 4 });
    expect(() => buildIdeaBookGateConfig('nobody')).toThrow(/unknown archetype/);
  });

  it('a book resolves its config through the discriminant on kind — its own epoch, never archetypeVintages', () => {
    expect(bookConfigSource('b1', book())).toEqual({ kind: 'idea_book', configVersion: 1, path: 'mandates/b1/epochs/epoch-0001' });
    expect(bookConfigSource('m1', { vintageRef: 'archetypeVintages/analyst_abc' })).toEqual({ kind: 'quarterly', configVersion: null, path: 'archetypeVintages/analyst_abc' });
  });
});

describe('createIdeaBook', () => {
  it('writes the book, its epoch, the owner\'s claim and the registry in one transaction — and never userMeta', async () => {
    const db = makeMandateFakeDb();
    const res = await createIdeaBook(db, args());
    expect(res).toEqual({ ok: true, bookId: ideaBookIdFor('owner-1', 'create-1'), epochId: 'epoch-0001', idempotentReplay: false });
    expect([...db._store.keys()].sort()).toEqual([
      `mandates/${res.bookId}`, `mandates/${res.bookId}/epochs/epoch-0001`, 'practiceFieldBooks/_registry', 'practiceFieldBooks/owner-1',
    ]);
    expect(db._get('practiceFieldBooks/owner-1')).toEqual({
      bookId: res.bookId, epochId: 'epoch-0001', attributionAgentId: 'agent-ranked-1', archetypeCodeId: 'momentum_chaser',
      status: 'active', createOpId: 'create-1', createdAt: NOW, updatedAt: NOW,
    });
    expect(db._get('practiceFieldBooks/_registry')).toEqual({ openBooks: { [res.bookId]: 'owner-1' }, cap: 4, updatedAt: NOW });
    expect(db._get(`mandates/${res.bookId}`).createdAt).toEqual(new Date(NOW));
    expect(db._txAttempts()).toBe(1);
  });

  it('is idempotent on opId: a replay returns the same book and writes nothing', async () => {
    const db = makeMandateFakeDb();
    const first = await createIdeaBook(db, args());
    const versions = [...db._store.keys()].map((p) => [p, db._versionOf(p)]);
    const replay = await createIdeaBook(db, args({ nowIso: etIso(DAYS.d1, 9, 0) }));
    expect(replay).toEqual({ ok: true, bookId: first.bookId, epochId: 'epoch-0001', idempotentReplay: true });
    expect([...db._store.keys()].map((p) => [p, db._versionOf(p)])).toEqual(versions);
  });

  it('the same opId asking for a different book — another archetype, another agent — is a conflict, not a replay (review L1-3)', async () => {
    const db = makeMandateFakeDb();
    const first = await createIdeaBook(db, args());
    expect(await createIdeaBook(db, args({ archetypeCodeId: 'degen' }))).toEqual({ ok: false, code: 'op_id_conflict', bookId: first.bookId });
    expect(await createIdeaBook(db, args({ attributionAgentId: 'agent-other' }))).toEqual({ ok: false, code: 'op_id_conflict', bookId: first.bookId });
    expect(db._get(`mandates/${first.bookId}`)).toMatchObject({ archetypeCodeId: 'momentum_chaser', attributionAgentId: 'agent-ranked-1' });
  });

  it('refuses a second open book for the owner, an unknown archetype and a casual clone as the attribution agent', async () => {
    const db = makeMandateFakeDb();
    const first = await createIdeaBook(db, args());
    expect(await createIdeaBook(db, args({ opId: 'create-2' }))).toEqual({ ok: false, code: 'open_book_exists', bookId: first.bookId });
    expect(await createIdeaBook(db, args({ uid: 'owner-2', archetypeCodeId: 'nobody' }))).toEqual({ ok: false, code: 'unknown_archetype' });
    expect(await createIdeaBook(db, args({ uid: 'owner-2', attributionAgentId: 'casual-agent-owner-2' }))).toEqual({ ok: false, code: 'attribution_is_clone' });
    expect([...db._store.keys()].filter((p) => p.startsWith('mandates/') && !p.includes('/epochs/')).length).toBe(1);
  });

  it('the founder cap (B8): the fifth concurrent book is refused; two creators racing for the fourth place have one winner', async () => {
    const db = makeMandateFakeDb();
    for (const n of [1, 2, 3]) expect((await createIdeaBook(db, args({ uid: `owner-${n}`, opId: `c-${n}` }))).ok).toBe(true);
    // Owner 4 reads the registry at three books; owner 5 commits the fourth place before owner 4 does.
    db.setBarrier(async () => { expect((await createIdeaBook(db, args({ uid: 'owner-5', opId: 'c-5' }))).ok).toBe(true); });
    expect(await createIdeaBook(db, args({ uid: 'owner-4', opId: 'c-4' }))).toEqual({ ok: false, code: 'founder_cap_reached', openBooks: 4, cap: 4 });
    expect(Object.values(db._get('practiceFieldBooks/_registry').openBooks).sort()).toEqual(['owner-1', 'owner-2', 'owner-3', 'owner-5']);
    expect(db._get('practiceFieldBooks/owner-4')).toBeUndefined();
  });

  it("mode: 'off' refuses before any read; 'allowlist' refuses a uid that is not listed", async () => {
    setPracticeFieldModeForTests('off');
    expect(await createIdeaBook(untouchable, args())).toEqual({ ok: false, code: 'mode_not_admitted' });
    setPracticeFieldModeForTests('allowlist');
    process.env[COCKPIT_ALLOWLIST_ENV] = 'someone-else';
    expect(await createIdeaBook(untouchable, args())).toEqual({ ok: false, code: 'mode_not_admitted' });
    process.env[COCKPIT_ALLOWLIST_ENV] = 'owner-1';
    expect((await createIdeaBook(makeMandateFakeDb(), args())).ok).toBe(true);
  });

  it('requires its arguments', async () => {
    const db = makeMandateFakeDb();
    await expect(createIdeaBook(db, args({ uid: '' }))).rejects.toThrow(/required/);
    await expect(createIdeaBook(db, args({ opId: undefined }))).rejects.toThrow(/required/);
    await expect(createIdeaBook(db, args({ nowIso: '2026-11-13' }))).rejects.toThrow(/ISO instant/);
  });
});

describe('the Film Room\'s two helpers (Amendment B item 1) and the seam they are wired into', () => {
  it('the seam\'s defaults ARE the Practice Field\'s helpers', () => {
    expect(PRACTICE_FIELD_SEAM_DEFAULTS.bookForOwner).toBe(bookForOwner);
    expect(PRACTICE_FIELD_SEAM_DEFAULTS.bookIsForAgent).toBe(bookIsForAgent);
  });

  it("with the mode 'off', bookForOwner answers null WITHOUT A READ — the Film Room behaves exactly as before", async () => {
    setPracticeFieldModeForTests(null); // the shipped value
    expect(await bookForOwner(untouchable, { uid: 'owner-1', attributionAgentId: 'agent-ranked-1' })).toBeNull();
    expect(await seamBookForOwner(untouchable, { uid: 'owner-1', attributionAgentId: 'agent-ranked-1' })).toBeNull();
    setPracticeFieldModeForTests('allowlist');
    delete process.env[COCKPIT_ALLOWLIST_ENV];
    expect(await bookForOwner(untouchable, { uid: 'owner-1', attributionAgentId: 'agent-ranked-1' })).toBeNull();
  });

  it('returns { bookId, status } for the owner\'s open idea book of THAT attribution agent, in at most two reads: the claim, then the book it names (Astra T1A-04)', async () => {
    const db = makeMandateFakeDb();
    const { bookId } = await createIdeaBook(db, args());
    const reads = [];
    const counting = { collection: (c) => ({ doc: (id) => ({ get: async () => { reads.push(`${c}/${id}`); return db.collection(c).doc(id).get(); } }) }) };
    expect(await bookForOwner(counting, { uid: 'owner-1', attributionAgentId: 'agent-ranked-1' })).toEqual({ bookId, status: 'active' });
    expect(reads).toEqual(['practiceFieldBooks/owner-1', `mandates/${bookId}`]);
    // Another agent's claim is refused at the first read; no second read is spent on it.
    reads.length = 0;
    expect(await bookForOwner(counting, { uid: 'owner-1', attributionAgentId: 'another-agent' })).toBeNull();
    expect(reads).toEqual(['practiceFieldBooks/owner-1']);
    expect(await seamBookForOwner(db, { uid: 'owner-1', attributionAgentId: 'agent-ranked-1' })).toEqual({ bookId, status: 'active' });
    expect(await bookForOwner(db, { uid: 'owner-1', attributionAgentId: 'another-agent' })).toBeNull();
    expect(await bookForOwner(db, { uid: 'owner-2', attributionAgentId: 'agent-ranked-1' })).toBeNull();
    expect(await bookForOwner(db, { uid: 'owner-1' })).toBeNull();
  });

  describe('Astra T1A-04 — the claim is a pointer, never proof: only a real, open idea book of this owner and agent is returned', () => {
    const claimFor = (bookId, over = {}) => ({ bookId, epochId: 'epoch-0001', attributionAgentId: 'agent-ranked-1', archetypeCodeId: 'momentum_chaser', status: 'active', createOpId: 'create-1', ...over });
    const ideaBookDoc = (over = {}) => ({ kind: 'idea_book', userId: 'owner-1', attributionAgentId: 'agent-ranked-1', status: 'active', ...over });
    const ask = (db) => bookForOwner(db, { uid: 'owner-1', attributionAgentId: 'agent-ranked-1' });

    it('a claim pointing at a QUARTERLY book answers null (Astra\'s poisoned claim)', async () => {
      const db = makeMandateFakeDb({
        'practiceFieldBooks/owner-1': claimFor('quarterly'),
        'mandates/quarterly': { userId: 'owner-1', kind: 'quarterly', status: 'active', attributionAgentId: 'agent-ranked-1' },
      });
      expect(await ask(db)).toBeNull();
      // A legacy quarterly book with no `kind` at all is quarterly too.
      const legacy = makeMandateFakeDb({ 'practiceFieldBooks/owner-1': claimFor('q2'), 'mandates/q2': { userId: 'owner-1', status: 'active', attributionAgentId: 'agent-ranked-1' } });
      expect(await ask(legacy)).toBeNull();
    });

    it('a claim pointing at ANOTHER OWNER\'s idea book answers null', async () => {
      const db = makeMandateFakeDb({ 'practiceFieldBooks/owner-1': claimFor('pf_other'), 'mandates/pf_other': ideaBookDoc({ userId: 'owner-2' }) });
      expect(await ask(db)).toBeNull();
    });

    it('a claim pointing at a MISSING book answers null, without a throw', async () => {
      const db = makeMandateFakeDb({ 'practiceFieldBooks/owner-1': claimFor('pf_gone') });
      expect(await ask(db)).toBeNull();
    });

    it('a claim pointing at a CLOSED book answers null, though the claim still says active', async () => {
      const db = makeMandateFakeDb({ 'practiceFieldBooks/owner-1': claimFor('pf_1'), 'mandates/pf_1': ideaBookDoc({ status: 'closed' }) });
      expect(await ask(db)).toBeNull();
      for (const status of [undefined, null, '', 'paused', 'Active']) {
        const odd = makeMandateFakeDb({ 'practiceFieldBooks/owner-1': claimFor('pf_1'), 'mandates/pf_1': ideaBookDoc({ status }) });
        expect(await ask(odd), String(status)).toBeNull();
      }
    });

    it('a book whose OWN attribution agent is another\'s answers null, though the claim names this agent', async () => {
      const db = makeMandateFakeDb({ 'practiceFieldBooks/owner-1': claimFor('pf_1'), 'mandates/pf_1': ideaBookDoc({ attributionAgentId: 'agent-other' }) });
      expect(await ask(db)).toBeNull();
      const none = makeMandateFakeDb({ 'practiceFieldBooks/owner-1': claimFor('pf_1'), 'mandates/pf_1': ideaBookDoc({ attributionAgentId: undefined }) });
      expect(await ask(none)).toBeNull();
    });

    it('the status answered is the BOOK\'s own: a draining book answers `draining` (the Film Room then refuses book_not_open), whatever the claim says', async () => {
      const db = makeMandateFakeDb({ 'practiceFieldBooks/owner-1': claimFor('pf_1', { status: 'active' }), 'mandates/pf_1': ideaBookDoc({ status: 'draining' }) });
      expect(await ask(db)).toEqual({ bookId: 'pf_1', status: 'draining' });
      const stale = makeMandateFakeDb({ 'practiceFieldBooks/owner-1': claimFor('pf_1', { status: 'closed' }), 'mandates/pf_1': ideaBookDoc({ status: 'active' }) });
      expect(await ask(stale)).toEqual({ bookId: 'pf_1', status: 'active' });
    });

    it('a failed read of the BOOK reaches the seam as a throw, like a failed read of the claim', async () => {
      const db = makeMandateFakeDb({ 'practiceFieldBooks/owner-1': claimFor('pf_1') });
      const failingBook = { collection: (c) => ({ doc: (id) => ({ get: async () => { if (c === 'mandates') throw new Error('UNAVAILABLE'); return db.collection(c).doc(id).get(); } }) }) };
      await expect(bookForOwner(failingBook, { uid: 'owner-1', attributionAgentId: 'agent-ranked-1' })).rejects.toThrow('UNAVAILABLE');
      await expect(seamBookForOwner(failingBook, { uid: 'owner-1', attributionAgentId: 'agent-ranked-1' })).rejects.toThrow('UNAVAILABLE');
    });
  });

  it('a QUARTERLY book is never returned: the quarterly claim (userMeta.activeMandateId) is not this helper\'s', async () => {
    const db = makeMandateFakeDb({
      'userMeta/owner-1': { activeMandateId: 'quarterly-1' },
      'mandates/quarterly-1': { userId: 'owner-1', status: 'active', attributionAgentId: 'agent-ranked-1', archetype: 'analyst' },
    });
    expect(await bookForOwner(db, { uid: 'owner-1', attributionAgentId: 'agent-ranked-1' })).toBeNull();
  });

  it('a throw inside bookForOwner reaches the seam as a throw (the Film Room treats it as "no open book")', async () => {
    const failing = { collection: () => ({ doc: () => ({ get: async () => { throw new Error('UNAVAILABLE'); } }) }) };
    await expect(bookForOwner(failing, { uid: 'owner-1', attributionAgentId: 'agent-ranked-1' })).rejects.toThrow('UNAVAILABLE');
    await expect(seamBookForOwner(failing, { uid: 'owner-1', attributionAgentId: 'agent-ranked-1' })).rejects.toThrow('UNAVAILABLE');
  });

  it('bookIsForAgent is pure: true only for the book\'s own attribution agent; false for another agent, a missing field, a non-object', async () => {
    const db = makeMandateFakeDb();
    const { bookId } = await createIdeaBook(db, args());
    const book = db._get(`mandates/${bookId}`);
    expect(bookIsForAgent(book, 'agent-ranked-1')).toBe(true);
    expect(seamBookIsForAgent(book, 'agent-ranked-1')).toBe(true);
    expect(bookIsForAgent(book, 'another-agent')).toBe(false);
    expect(bookIsForAgent({ userId: 'owner-1' }, 'agent-ranked-1')).toBe(false);
    expect(bookIsForAgent({ attributionAgentId: '' }, '')).toBe(false);
    for (const notABook of [null, undefined, 'agent-ranked-1', 7]) expect(bookIsForAgent(notABook, 'agent-ranked-1')).toBe(false);
    // The book the Film Room re-reads in its own transaction passes every check it makes there.
    expect(book).toMatchObject({ userId: 'owner-1', kind: 'idea_book', status: 'active' });
  });
});
