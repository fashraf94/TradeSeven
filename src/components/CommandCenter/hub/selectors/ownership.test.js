// src/components/CommandCenter/hub/selectors/ownership.test.js
//
// Command Center hub, slice S2a — request ownership (spec V1.2 §5.3,
// correction C2): captureIdentity and isCurrent at every async boundary §11.3
// "Ownership C2" names, A → B → A, and the epochs.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { A, B, C2_BOUNDARIES, C2_CASES, TARGET } from '../../__fixtures__/attemptFixtures';
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

// What these rows are (S2a review A1-6, A2-7): the PREDICATE S2b will ask at
// each async boundary of spec §5.3. S2a binds no boundary to code — there is no
// provider, service call or App handoff here yet — so a row per boundary proves
// the answer S2b will get there, under each way the request can go stale. The
// §11.3 "Ownership C2" items S2a does exercise live in other rows: "preserve
// owner and real id" and "late target callback" in attemptReducer.test.js
// (serviceResult; targetResolved and cooldown evidence), "A → B → A" here and in
// the reducer's sequences, "new account readiness independent" in the reducer's
// orphan-cleanup sequences. "No old append / stash / navigation", "server
// battle remains" and the App-side checks are S2b's and R1's: they need the
// provider, the bridge and the service, which S2a does not build.
describe('spec §11.3 "Ownership C2" — the predicate S2b asks at each async boundary of §5.3', () => {
  it('names the boundaries §5.3 and §11.3 list', () => {
    for (const b of ['token acquisition', 'clone ensure', 'deploy POST', 'target-resolved callback', 'App handoff', 'optimistic append', 'stash', 'navigation', 'ceremony notification', 'result display', 'verification', 'Enter battle']) {
      expect(C2_BOUNDARIES).toContain(b);
    }
  });

  it.each(C2_BOUNDARIES)('at "%s": current while nothing moved; stale after another uid, after A → B → A (same uid, new auth epoch), after an invalidation', () => {
    const captured = captureIdentity(auth(A, 1), TARGET, 1);
    expect(isCurrent(captured, auth(A, 1), 1)).toBe(true);
    expect(isCurrent(captured, auth(B, 2), 1)).toBe(false);
    expect(isCurrent(captured, auth(A, 3), 1)).toBe(false);
    expect(isCurrent(captured, auth(A, 1), 2)).toBe(false);
    expect(isCurrent(captured, { signedIn: false }, 1)).toBe(false);
  });

  it('every §11.3 C2 case is named, and each is either exercised by a row that exists or deferred with its owner', () => {
    expect(Object.keys(C2_CASES)).toEqual([
      'change uid during token / clone / POST / body / handoff / verification / Enter', 'A → B → A', 'late target callback',
      'preserve owner and real id', 'no old append / stash / navigation / result', 'server battle remains', 'new account readiness independent',
    ]);
    const hubDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    for (const [name, where] of Object.entries(C2_CASES)) {
      expect(Boolean(where.rows) || Boolean(where.deferredTo), name).toBe(true);
      if (!where.rows) continue;
      const source = readFileSync(path.join(hubDir, where.file), 'utf8');
      for (const title of where.rows) expect(source.includes(title.replace(/'/g, "\\'")) || source.includes(title), `${name}: ${title}`).toBe(true);
    }
  });

  it('a change at one boundary leaves every later boundary stale: the epochs never move back', () => {
    const captured = captureIdentity(auth(A, 1), TARGET, 1);
    for (let at = 0; at < C2_BOUNDARIES.length; at += 1) {
      const verdicts = C2_BOUNDARIES.map((_, i) => isCurrent(captured, i < at ? auth(A, 1) : auth(A, 2), 1));
      expect(verdicts).toEqual(C2_BOUNDARIES.map((_, i) => i < at));
    }
  });
});


describe('the small predicates', () => {
  it('validUid, validEpoch, signedIn', () => {
    expect([validUid('u'), validUid(''), validUid(null), validUid(3)]).toEqual([true, false, false, false]);
    expect([validEpoch(0), validEpoch(7), validEpoch(-1), validEpoch(1.5), validEpoch('1')]).toEqual([true, true, false, false, false]);
    expect([signedIn(auth(A, 0)), signedIn({ signedIn: false }), signedIn(null), signedIn({ signedIn: true, uid: A, authEpoch: -2 })]).toEqual([true, false, false, false]);
  });
});
