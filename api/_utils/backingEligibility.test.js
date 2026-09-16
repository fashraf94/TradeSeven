// api/_utils/backingEligibility.test.js
//
// Backing Beta PR 2 — may this account back this seat? (spec V1.3 §8; Amendment
// A §A2 D-aa and §A3 D-ab, implemented here because PR 2 is `requireEligibility`'s
// first caller.)
//
// EVERY REFUSAL IS FALSIFIABLE AND EVERY ONE IS ORDERED. The order matters to
// the product — an anonymous caller must be told `account_required`, not sent to
// attest — so each row proves BOTH that the refusal fires and that it fires
// BEFORE the checks behind it, by leaving those checks in a state that would
// produce a different reason if they ran first.
//
// Runs against the shared in-memory Firestore stand-in; nothing about the module
// is mocked. DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import
// of api/_utils/backingEligibility.js is the runtime guard for its api/ -> src/
// import of src/constants/eligibility.js. Never mock it.

import { describe, it, expect } from 'vitest';
import { makeInMemoryDb } from './__fixtures__/inMemoryFirestore.js';
import {
  ANONYMOUS_SIGN_IN_PROVIDER,
  BACKING_INELIGIBLE,
  checkBackingEligibility,
  hasCompletedBattle,
  signInProviderOf,
} from './backingEligibility.js';
import { ELIGIBILITY_COLLECTION } from './eligibility.js';
import { TERMS_VERSION } from '../../src/constants/eligibility.js';

const UID = 'backer-1';
const GROUP = {
  id: 'grp-1',
  players: [
    { odUserId: 'od-a' },
    { odUserId: 'od-b' },
    { odUserId: 'cpu-1', isCpu: true },
  ],
};
const TOKEN = { uid: UID, firebase: { sign_in_provider: 'password' } };

const attestation = (over = {}) => ({
  adultAttestedAt: '2026-09-14T13:30:00.000Z',
  termsVersion: TERMS_VERSION,
  acceptedAt: '2026-09-14T13:30:00.000Z',
  source: 'backing_beta',
  ...over,
});

const battle = (over = {}) => ({
  ownerId: UID,
  status: 'completed',
  completedAt: '2026-09-01T20:00:00.000Z',
  gameMode: 'baggerbomb_tournament',
  ...over,
});

/** A world where everything passes — each row spoils exactly one thing. */
function eligibleWorld(over = {}) {
  return makeInMemoryDb({
    [`${ELIGIBILITY_COLLECTION}/${UID}`]: attestation(),
    'agentBattles/b1': battle(),
    ...over,
  });
}

const check = (db, over = {}) => checkBackingEligibility(db, {
  uid: UID, decodedToken: TOKEN, group: GROUP, teamOdUserId: 'od-a', ...over,
});

// ============================================================================
describe('the happy path is reachable — otherwise every row below passes vacuously', () => {
  it('admits an attested, non-anonymous, un-seated account with a completed battle', async () => {
    const { db } = eligibleWorld();
    expect(await check(db)).toEqual({ allowed: true, reason: null });
  });

  it('admits a stake on a CPU seat — CPU teams are backable where they are in the pool (§1)', async () => {
    const { db } = eligibleWorld();
    expect(await check(db, { teamOdUserId: 'cpu-1' })).toEqual({ allowed: true, reason: null });
  });
});

// ============================================================================
describe('1. account_required — anonymous accounts cannot back (D-ab)', () => {
  it('refuses the anonymous provider', async () => {
    const { db } = eligibleWorld();
    const out = await check(db, { decodedToken: { uid: UID, firebase: { sign_in_provider: ANONYMOUS_SIGN_IN_PROVIDER } } });
    expect(out).toEqual({ allowed: false, reason: BACKING_INELIGIBLE.ACCOUNT_REQUIRED });
  });

  it('fires BEFORE the attestation read — the caller is told the thing they can act on', async () => {
    // No attestation exists either, so a different order would answer
    // `eligibility_required` and send an anonymous account to a consent step it
    // cannot complete.
    const { db, readLog } = makeInMemoryDb({ 'agentBattles/b1': battle() });
    const out = await check(db, { decodedToken: { firebase: { sign_in_provider: 'anonymous' } } });
    expect(out.reason).toBe(BACKING_INELIGIBLE.ACCOUNT_REQUIRED);
    expect(readLog).toEqual([]);
  });

  it('reads the provider from the token, never from a body-shaped field', async () => {
    const { db } = eligibleWorld();
    // A caller-supplied `signInProvider` is not consulted; the verified claim is.
    const out = await check(db, {
      decodedToken: { uid: UID, firebase: { sign_in_provider: 'anonymous' }, signInProvider: 'password' },
    });
    expect(out.reason).toBe(BACKING_INELIGIBLE.ACCOUNT_REQUIRED);
  });

  it('signInProviderOf reads the nested claim, falls back to provider_id, else null', () => {
    expect(signInProviderOf({ firebase: { sign_in_provider: 'google.com' } })).toBe('google.com');
    expect(signInProviderOf({ provider_id: 'anonymous' })).toBe('anonymous');
    expect(signInProviderOf({ firebase: {} })).toBeNull();
    expect(signInProviderOf(null)).toBeNull();
    // The fallback is the guard: a token shape that moved the claim must not
    // turn an anonymous account into an unknown (and therefore admitted) one.
    expect(signInProviderOf({ provider_id: ANONYMOUS_SIGN_IN_PROVIDER })).toBe(ANONYMOUS_SIGN_IN_PROVIDER);
  });
});

// ============================================================================
describe('2. eligibility_required — the attestation, at the CURRENT terms (D-aa)', () => {
  it('refuses when no attestation exists', async () => {
    const { db } = makeInMemoryDb({ 'agentBattles/b1': battle() });
    expect(await check(db)).toEqual({ allowed: false, reason: BACKING_INELIGIBLE.ELIGIBILITY_REQUIRED });
  });

  it('refuses a STALE terms version — a revision forces re-attestation (D-aa)', async () => {
    const { db } = eligibleWorld({
      [`${ELIGIBILITY_COLLECTION}/${UID}`]: attestation({ termsVersion: 'beta-2026-08-draft' }),
    });
    expect(await check(db)).toEqual({ allowed: false, reason: BACKING_INELIGIBLE.ELIGIBILITY_REQUIRED });
  });

  it('a stale version is ABSENT, not a distinct refusal — PR 4 re-presents the terms either way', async () => {
    const { db: dbAbsent } = makeInMemoryDb({ 'agentBattles/b1': battle() });
    const { db: dbStale } = eligibleWorld({
      [`${ELIGIBILITY_COLLECTION}/${UID}`]: attestation({ termsVersion: 'older' }),
    });
    expect((await check(dbAbsent)).reason).toBe((await check(dbStale)).reason);
  });

  it('refuses a doc missing the field entirely, and one whose version differs only in case', async () => {
    for (const termsVersion of [undefined, null, '', TERMS_VERSION.toUpperCase(), ` ${TERMS_VERSION}`]) {
      const { db } = eligibleWorld({ [`${ELIGIBILITY_COLLECTION}/${UID}`]: attestation({ termsVersion }) });
      expect((await check(db)).reason).toBe(BACKING_INELIGIBLE.ELIGIBILITY_REQUIRED);
    }
  });

  it('fires BEFORE own-pod — an unattested seated user is asked to attest first', async () => {
    const seated = { ...GROUP, players: [...GROUP.players, { odUserId: UID }] };
    const { db } = makeInMemoryDb({ 'agentBattles/b1': battle() });
    expect((await check(db, { group: seated })).reason).toBe(BACKING_INELIGIBLE.ELIGIBILITY_REQUIRED);
  });
});

// ============================================================================
describe('3. own_pod — an account-level rule (§8)', () => {
  it('refuses a seated caller backing ANY seat, not merely their own', async () => {
    const seated = { ...GROUP, players: [...GROUP.players, { odUserId: UID }] };
    const { db } = eligibleWorld();
    for (const teamOdUserId of ['od-a', 'od-b', 'cpu-1', UID]) {
      expect((await check(db, { group: seated, teamOdUserId })).reason).toBe(BACKING_INELIGIBLE.OWN_POD);
    }
  });

  it('fires BEFORE seat-present — a seated caller naming a nonexistent seat is still own_pod', async () => {
    const seated = { ...GROUP, players: [{ odUserId: UID }] };
    const { db } = eligibleWorld();
    expect((await check(db, { group: seated, teamOdUserId: 'od-nobody' })).reason)
      .toBe(BACKING_INELIGIBLE.OWN_POD);
  });
});

// ============================================================================
describe('4. seat_not_present — the seat must be in players[] AT STAKE TIME (§1)', () => {
  it('refuses a seat that is not in the pod', async () => {
    const { db } = eligibleWorld();
    expect((await check(db, { teamOdUserId: 'od-zzz' })).reason).toBe(BACKING_INELIGIBLE.SEAT_NOT_PRESENT);
  });

  it('refuses a seat that has LEFT a slot pod since the list was rendered', async () => {
    const afterLeaving = { ...GROUP, players: [{ odUserId: 'od-b' }] };
    const { db } = eligibleWorld();
    expect((await check(db, { group: afterLeaving })).reason).toBe(BACKING_INELIGIBLE.SEAT_NOT_PRESENT);
  });

  it('fires BEFORE the completed-battle query — the cheaper refusal costs no read', async () => {
    const { db, readLog } = makeInMemoryDb({ [`${ELIGIBILITY_COLLECTION}/${UID}`]: attestation() });
    const before = readLog.length;
    expect((await check(db, { teamOdUserId: 'od-zzz' })).reason).toBe(BACKING_INELIGIBLE.SEAT_NOT_PRESENT);
    // Exactly one read happened: the attestation. The agentBattles query did not.
    expect(readLog.slice(before).map(([, p]) => p)).toEqual([`${ELIGIBILITY_COLLECTION}/${UID}`]);
  });
});

// ============================================================================
describe('5. no_completed_battle — the §8 speed bump, on the EXISTING index', () => {
  it('refuses an account with no completed battle', async () => {
    const { db } = makeInMemoryDb({ [`${ELIGIBILITY_COLLECTION}/${UID}`]: attestation() });
    expect((await check(db)).reason).toBe(BACKING_INELIGIBLE.NO_COMPLETED_BATTLE);
  });

  it('does not count an ACTIVE battle, nor another account\'s completed one', async () => {
    const { db } = makeInMemoryDb({
      [`${ELIGIBILITY_COLLECTION}/${UID}`]: attestation(),
      'agentBattles/b1': battle({ status: 'active' }),
      'agentBattles/b2': battle({ ownerId: 'someone-else' }),
    });
    expect((await check(db)).reason).toBe(BACKING_INELIGIBLE.NO_COMPLETED_BATTLE);
  });

  it('counts ONE completed battle of ANY game mode — the bump is about the account, not the mode', async () => {
    const { db } = makeInMemoryDb({
      [`${ELIGIBILITY_COLLECTION}/${UID}`]: attestation(),
      'agentBattles/b1': battle({ gameMode: 'baggerbomb' }),
    });
    expect(await check(db)).toEqual({ allowed: true, reason: null });
  });

  it('hasCompletedBattle is bounded to one document', async () => {
    const { db } = makeInMemoryDb({
      'agentBattles/b1': battle(), 'agentBattles/b2': battle(), 'agentBattles/b3': battle(),
    });
    expect(await hasCompletedBattle(db, UID)).toBe(true);
    expect(await hasCompletedBattle(db, 'nobody')).toBe(false);
  });

  it('a READ FAILURE throws — an outage must never read as "not eligible"', async () => {
    const { db } = eligibleWorld();
    const broken = {
      ...db,
      collection: (name) => (name === 'agentBattles'
        ? { where: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ get: async () => { throw new Error('backend unavailable'); } }) }) }) }) }
        : db.collection(name)),
    };
    await expect(check(broken)).rejects.toThrow('backend unavailable');
  });
});

// ============================================================================
describe('the reason vocabulary is stable — PR 4 maps copy to these strings', () => {
  it('pins every reason to its LITERAL and freezes the map', () => {
    expect(BACKING_INELIGIBLE).toEqual({
      ACCOUNT_REQUIRED: 'account_required',
      ELIGIBILITY_REQUIRED: 'eligibility_required',
      OWN_POD: 'own_pod',
      SEAT_NOT_PRESENT: 'seat_not_present',
      NO_COMPLETED_BATTLE: 'no_completed_battle',
    });
    expect(Object.isFrozen(BACKING_INELIGIBLE)).toBe(true);
  });

  it('`eligibility_required` is the SAME string PR 0 exported — one code, one 403', async () => {
    const { ELIGIBILITY_REQUIRED_CODE } = await import('./eligibility.js');
    expect(BACKING_INELIGIBLE.ELIGIBILITY_REQUIRED).toBe(ELIGIBILITY_REQUIRED_CODE);
  });

  it('carries NO UI text — copy is PR 4\'s, and counsel owns the attestation strings', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('./backingEligibility.js', import.meta.url), 'utf8');
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
    // Nothing sentence-shaped: every string literal in the code is a stable id.
    expect(code).not.toMatch(/'[A-Z][a-z]+ [a-z]+ [a-z]+/);
  });
});
