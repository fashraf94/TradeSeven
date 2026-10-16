// src/components/CommandCenter/hub/selectors/ownership.test.js
//
// Command Center hub, slice S2a — request ownership (spec V1.2 §5.3,
// correction C2): captureIdentity and isCurrent at every async boundary §11.3
// "Ownership C2" names, A → B → A, and the epochs.

import { describe, expect, it } from 'vitest';
import { A, B, C2_BOUNDARIES, TARGET } from '../../__fixtures__/attemptFixtures';
import { captureIdentity, isCurrent, signedIn, validEpoch, validUid } from './ownership';

const auth = (uid, authEpoch) => ({ signedIn: true, uid, authEpoch });

describe('captureIdentity', () => {
  it('captures uid, auth epoch, attempt epoch and target, frozen', () => {
    const c = captureIdentity(auth(A, 4), TARGET, 9);
    expect(c).toEqual({ capturedUid: A, authEpoch: 4, attemptEpoch: 9, targetAgentId: TARGET });
    expect(Object.isFrozen(c)).toBe(true);
  });

  it('captures nothing without a signed-in identity or a valid epoch', () => {
    for (const a of [null, undefined, { signedIn: false }, { signedIn: true, uid: '', authEpoch: 1 }, { signedIn: true, uid: A }, { signedIn: 'yes', uid: A, authEpoch: 1 }]) {
      expect(captureIdentity(a, TARGET, 1)).toBeNull();
    }
    for (const e of [-1, 1.5, Number.NaN, '1', null]) expect(captureIdentity(auth(A, 1), TARGET, e)).toBeNull();
  });

  it('a missing target is captured as none, never reconstructed from the uid (spec §3)', () => {
    expect(captureIdentity(auth(A, 1), '', 1).targetAgentId).toBeNull();
    expect(captureIdentity(auth(A, 1), undefined, 1).targetAgentId).toBeNull();
  });
});

describe('isCurrent — both the auth identity/epoch and the attempt epoch must still match', () => {
  const captured = captureIdentity(auth(A, 2), TARGET, 5);

  it('true only when all three match', () => {
    expect(isCurrent(captured, auth(A, 2), 5)).toBe(true);
  });

  it.each([
    ['another uid', auth(B, 2), 5],
    ['the same uid at a new auth epoch', auth(A, 3), 5],
    ['a new attempt epoch', auth(A, 2), 6],
    ['signed out', { signedIn: false }, 5],
    ['no auth', null, 5],
    ['no attempt epoch', auth(A, 2), undefined],
  ])('false on %s', (_name, a, epoch) => {
    expect(isCurrent(captured, a, epoch)).toBe(false);
  });

  it('false for no capture or a malformed one', () => {
    for (const c of [null, undefined, {}, { ...captured, capturedUid: '' }, { ...captured, authEpoch: -1 }, { ...captured, attemptEpoch: 1.5 }]) {
      expect(isCurrent(c, auth(A, 2), 5)).toBe(false);
    }
  });

  it('A → B → A: returning to the same uid carries a fresh auth epoch, so the old request never revives', () => {
    // A signs in (epoch 1) and starts a request; B signs in (epoch 2); A returns (epoch 3).
    const old = captureIdentity(auth(A, 1), TARGET, 1);
    expect(isCurrent(old, auth(B, 2), 1)).toBe(false);
    expect(isCurrent(old, auth(A, 3), 1)).toBe(false);
    // uid equality alone is never enough, whatever the attempt epoch says.
    expect(isCurrent(old, auth(A, 3), 2)).toBe(false);
  });
});

describe('spec §11.3 "Ownership C2" — the predicate S2b asks at every async boundary', () => {
  it('names the boundaries §5.3 and §11.3 list', () => {
    for (const b of ['token acquisition', 'clone ensure', 'deploy POST', 'target-resolved callback', 'App handoff', 'optimistic append', 'stash', 'navigation', 'ceremony notification', 'result display', 'verification', 'Enter battle']) {
      expect(C2_BOUNDARIES).toContain(b);
    }
  });

  it.each(C2_BOUNDARIES.map((b, i) => [b, i]))('a uid change before "%s" makes it and every later boundary stale; none before it', (_boundary, at) => {
    const captured = captureIdentity(auth(A, 1), TARGET, 1);
    const states = C2_BOUNDARIES.map((_, i) => (i < at ? auth(A, 1) : auth(B, 2)));
    const verdicts = states.map((current) => isCurrent(captured, current, 1));
    expect(verdicts).toEqual(C2_BOUNDARIES.map((_, i) => i < at));
  });

  it('an attempt invalidation (a new attempt epoch) is stale at every boundary too, the identity unchanged', () => {
    const captured = captureIdentity(auth(A, 1), TARGET, 1);
    for (let i = 0; i < C2_BOUNDARIES.length; i += 1) expect(isCurrent(captured, auth(A, 1), 2)).toBe(false);
  });
});

describe('the small predicates', () => {
  it('validUid, validEpoch, signedIn', () => {
    expect([validUid('u'), validUid(''), validUid(null), validUid(3)]).toEqual([true, false, false, false]);
    expect([validEpoch(0), validEpoch(7), validEpoch(-1), validEpoch(1.5), validEpoch('1')]).toEqual([true, true, false, false, false]);
    expect([signedIn(auth(A, 0)), signedIn({ signedIn: false }), signedIn(null), signedIn({ signedIn: true, uid: A, authEpoch: -2 })]).toEqual([true, false, false, false]);
  });
});
