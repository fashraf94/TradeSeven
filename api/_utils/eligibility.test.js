// api/_utils/eligibility.test.js
//
// Backing Beta PR 0 — the eligibility read helper (spec V1.3 §6 / §12 PR 0).
// getEligibility: the doc or null. requireEligibility: the doc or a typed
// EligibilityRequiredError the backing endpoints map to 403 (PR 2).
//
// An in-memory Firestore fake (the agentChatBudget.test.js makeDb idiom): a
// docId → data store behind collection().doc().get(), recording every path
// touched so the tests can prove the helper reads `eligibility/{uid}` and
// nothing else.

import { describe, it, expect } from 'vitest';
import {
  ELIGIBILITY_COLLECTION,
  ELIGIBILITY_REQUIRED_CODE,
  EligibilityRequiredError,
  eligibilityRef,
  getEligibility,
  requireEligibility,
} from './eligibility.js';

function makeDb(initial = {}, { throwOnRead = null } = {}) {
  const store = new Map(Object.entries(initial));
  const reads = [];
  const db = {
    collection: (name) => ({
      doc: (id) => ({
        path: `${name}/${id}`,
        get: async () => {
          reads.push(`${name}/${id}`);
          if (throwOnRead) throw throwOnRead;
          const data = name === ELIGIBILITY_COLLECTION ? store.get(id) : undefined;
          return { exists: data !== undefined, data: () => data };
        },
      }),
    }),
  };
  return { db, reads };
}

const DOC = Object.freeze({
  adultAttestedAt: '2026-09-14T13:30:00.000Z',
  termsVersion: 'beta-2026-09-draft',
  acceptedAt: '2026-09-14T13:30:00.000Z',
  source: 'backing_beta',
});

describe('the collection and the ref', () => {
  it('the collection is eligibility and the doc id is the uid', () => {
    expect(ELIGIBILITY_COLLECTION).toBe('eligibility');
    const { db } = makeDb();
    expect(eligibilityRef(db, 'user-1').path).toBe('eligibility/user-1');
  });
});

describe('getEligibility', () => {
  it('returns null when the user has never attested', async () => {
    const { db, reads } = makeDb();
    expect(await getEligibility(db, 'user-1')).toBeNull();
    expect(reads).toEqual(['eligibility/user-1']);
  });

  it('returns the doc data when the attestation exists — one read, of that doc only', async () => {
    const { db, reads } = makeDb({ 'user-1': { ...DOC } });
    expect(await getEligibility(db, 'user-1')).toEqual(DOC);
    expect(reads).toEqual(['eligibility/user-1']);
  });

  it("reads the caller's doc, never another user's", async () => {
    const { db, reads } = makeDb({ 'user-1': { ...DOC } });
    expect(await getEligibility(db, 'user-2')).toBeNull();
    expect(reads).toEqual(['eligibility/user-2']);
  });

  it('returns null for a missing, empty or non-string uid without touching Firestore', async () => {
    const { db, reads } = makeDb({ 'user-1': { ...DOC } });
    for (const uid of [undefined, null, '', 42, {}, ['user-1']]) {
      expect(await getEligibility(db, uid)).toBeNull();
    }
    expect(reads).toEqual([]);
  });

  it('propagates a read failure — it never swallows an outage into "not eligible"', async () => {
    const { db } = makeDb({}, { throwOnRead: new Error('firestore down') });
    await expect(getEligibility(db, 'user-1')).rejects.toThrow('firestore down');
  });
});

describe('requireEligibility', () => {
  it('returns the doc when the attestation exists', async () => {
    const { db } = makeDb({ 'user-1': { ...DOC } });
    expect(await requireEligibility(db, 'user-1')).toEqual(DOC);
  });

  it('throws the typed error when it does not — the code and status the backing endpoints map to 403', async () => {
    const { db } = makeDb();
    let caught = null;
    try { await requireEligibility(db, 'user-1'); } catch (err) { caught = err; }
    expect(caught).toBeInstanceOf(EligibilityRequiredError);
    expect(caught).toBeInstanceOf(Error);
    expect(caught.name).toBe('EligibilityRequiredError');
    expect(caught.code).toBe(ELIGIBILITY_REQUIRED_CODE);
    expect(caught.code).toBe('eligibility_required');
    expect(caught.statusCode).toBe(403);
    expect(caught.uid).toBe('user-1');
    expect(caught.message).toBe('eligibility_required');
  });

  it('throws the typed error for a missing uid too (nothing to look up ⇒ not eligible)', async () => {
    const { db, reads } = makeDb();
    await expect(requireEligibility(db, undefined)).rejects.toBeInstanceOf(EligibilityRequiredError);
    expect(reads).toEqual([]);
  });

  it('a read failure is NOT the typed error — an outage must not read as "not eligible"', async () => {
    const { db } = makeDb({}, { throwOnRead: new Error('firestore down') });
    let caught = null;
    try { await requireEligibility(db, 'user-1'); } catch (err) { caught = err; }
    expect(caught).not.toBeInstanceOf(EligibilityRequiredError);
    expect(caught.message).toBe('firestore down');
  });
});
