// src/components/CommandCenter/hub/selectors/attemptReducer.s2b.test.js
//
// Command Center slice S2b (rulings R-S2b-2, R-S2b-3) — what S2b adds to S2a's
// reducer: the identity source's auth epoch (initialAttemptState, authChanged),
// and the hold record's three actions (claimed, committed, released), with a
// hold that admitted a request stamped so a late release cannot drop it. S2a's
// own rows (attemptReducer.test.js) are unchanged.

import { describe, it, expect } from 'vitest';
import { ATTEMPT_ACTION_TYPES as T, attemptReducer, initialAttemptState } from './attemptReducer';

const A = 'uid-A';
const B = 'uid-B';
const auth = (s) => ({ signedIn: true, uid: s.authUid, authEpoch: s.authEpoch });
const at = (uid, epoch) => initialAttemptState({ uid, authEpoch: epoch });
const claim = (s, over = {}) => attemptReducer(s, { type: T.HOLD_CLAIMED, auth: auth(s), controlId: 'card', holdToken: 't1', holdEpoch: 1, ...over });
const commit = (s, over = {}) => attemptReducer(s, { type: T.HOLD_COMMITTED, auth: auth(s), holdToken: 't1', ...over });
const begin = (s, over = {}) => attemptReducer(s, { type: T.BEGIN, attemptId: 'a1', auth: auth(s), targetAgentId: 'agent', startedAt: 1, controlId: 'card', holdToken: 't1', ...over });

describe('the identity source\'s epoch', () => {
  it('initialAttemptState starts at the given epoch; a missing or malformed one is 0', () => {
    expect(at(A, 4)).toMatchObject({ authUid: A, authEpoch: 4 });
    for (const bad of [undefined, -1, 1.5, '2', null]) expect(initialAttemptState({ uid: A, authEpoch: bad }).authEpoch, String(bad)).toBe(0);
  });

  it('authChanged takes the source\'s epoch; one at or below the current is a stale report and changes nothing', () => {
    const s = at(A, 1);
    const next = attemptReducer(s, { type: T.AUTH_CHANGED, uid: B, authEpoch: 3 });
    expect(next).toMatchObject({ authUid: B, authEpoch: 3, attemptEpoch: 1 });
    expect(attemptReducer(next, { type: T.AUTH_CHANGED, uid: A, authEpoch: 3 })).toBe(next);
    expect(attemptReducer(next, { type: T.AUTH_CHANGED, uid: A, authEpoch: 2 })).toBe(next);
    expect(attemptReducer(next, { type: T.AUTH_CHANGED, uid: A, authEpoch: 'x' })).toBe(next);
  });

  it('without an epoch, authChanged still counts one up (S2a\'s contract)', () => {
    expect(attemptReducer(at(A, 2), { type: T.AUTH_CHANGED, uid: B }).authEpoch).toBe(3);
  });
});

describe('the hold record (spec §5.5)', () => {
  it('claimed → charging; committed → locked; begin admits that hold only, and stamps it with the attempt', () => {
    const s = claim(at(A, 1));
    expect(s.hold).toEqual({ controlId: 'card', holdToken: 't1', holdEpoch: 1, phase: 'charging' });
    // Charging admits nothing: commitment, not charging, is the boundary.
    expect(begin(s)).toBe(s);
    const locked = commit(s);
    expect(locked.hold.phase).toBe('locked');
    const started = begin(locked);
    expect(started.attempt).toMatchObject({ attemptId: 'a1', phase: 'submitting' });
    expect(started.hold).toMatchObject({ phase: 'locked', attemptId: 'a1' });
  });

  it('one hold at a time; none while an attempt stands; none disabled; none for another identity or a malformed claim', () => {
    const held = claim(at(A, 1));
    expect(claim(held, { controlId: 'strip', holdToken: 't2' })).toBe(held);
    const started = begin(commit(held));
    expect(claim(started, { holdToken: 't3' })).toBe(started);
    const off = attemptReducer(at(A, 1), { type: T.FLAG_DISABLED });
    expect(claim(off)).toBe(off);
    const s = at(A, 1);
    expect(claim(s, { auth: { signedIn: true, uid: B, authEpoch: 1 } })).toBe(s);
    expect(claim(s, { auth: { signedIn: true, uid: A, authEpoch: 0 } })).toBe(s);
    for (const bad of [{ controlId: '' }, { holdToken: null }, { holdEpoch: -1 }, { holdEpoch: '1' }]) expect(claim(s, bad), JSON.stringify(bad)).toBe(s);
  });

  it('commit: only the charging hold, by its own token, for this identity, and not once disabled', () => {
    const s = claim(at(A, 1));
    expect(commit(s, { holdToken: 'other' })).toBe(s);
    expect(commit(s, { auth: { signedIn: true, uid: B, authEpoch: 1 } })).toBe(s);
    const off = attemptReducer(s, { type: T.FLAG_DISABLED });
    expect(off.hold).toBeNull(); // the disable cancelled the charge
    expect(commit(off)).toBe(off);
    const locked = commit(s);
    expect(commit(locked)).toBe(locked);
  });

  it('released: a charge, or a committed hold that started nothing, is cleared by its own token only', () => {
    const s = claim(at(A, 1));
    expect(attemptReducer(s, { type: T.HOLD_RELEASED, holdToken: 'other' })).toBe(s);
    expect(attemptReducer(s, { type: T.HOLD_RELEASED, holdToken: 't1' }).hold).toBeNull();
    const locked = commit(s);
    expect(attemptReducer(locked, { type: T.HOLD_RELEASED, holdToken: 't1' }).hold).toBeNull();
  });

  it('a hold that admitted a request belongs to it: a late release cannot drop it; the attempt\'s end does', () => {
    const started = begin(commit(claim(at(A, 1))));
    expect(attemptReducer(started, { type: T.HOLD_RELEASED, holdToken: 't1' })).toBe(started);
    const done = attemptReducer(started, { type: T.SERVICE_RESULT, attemptId: 'a1', attemptEpoch: started.attempt.attemptEpoch, result: { outcome: 'refused', success: false, postIssued: true, httpStatus: 400 } });
    const dismissed = attemptReducer(done, { type: T.DISMISS, attemptId: 'a1', attemptEpoch: done.attempt.attemptEpoch, at: 2 });
    expect(dismissed.hold).toBeNull();
  });

  it('an identity change clears any hold, at the source\'s epoch', () => {
    const s = commit(claim(at(A, 1)));
    expect(attemptReducer(s, { type: T.AUTH_CHANGED, uid: B, authEpoch: 2 })).toMatchObject({ hold: null, authEpoch: 2 });
  });
});

// ── Lens W5's reducer rows (S2b report §8) ──
describe('W5 — the reducer rows', () => {
  it('RD2 a claim is refused while an unacknowledged attempt stands, even with no hold in the record', () => {
    let s = initialAttemptState({ uid: 'uid-A', authEpoch: 1 });
    s = attemptReducer(s, { type: T.BEGIN, attemptId: 'a1', auth: auth(s), targetAgentId: 'agent', startedAt: 1 });
    s = attemptReducer(s, { type: T.SERVICE_RESULT, attemptId: 'a1', attemptEpoch: s.attempt.attemptEpoch, result: { outcome: 'uncertain', success: false, postIssued: true, httpStatus: null } });
    s = attemptReducer(s, { type: T.DISMISS, attemptId: 'a1', attemptEpoch: s.attempt.attemptEpoch, at: 2 });
    expect(s.attempt.phase).toBe('uncertain');
    expect(s.hold).toBeNull();
    const next = attemptReducer(s, { type: T.HOLD_CLAIMED, auth: auth(s), controlId: 'card', holdToken: 't1', holdEpoch: 1 });
    expect(next).toBe(s);
  });
  it('RD14 authChanged takes only a valid epoch: a string or a fraction is a stale report', () => {
    const s = initialAttemptState({ uid: 'uid-A', authEpoch: 1 });
    expect(attemptReducer(s, { type: T.AUTH_CHANGED, uid: 'uid-B', authEpoch: '5' })).toBe(s);
    expect(attemptReducer(s, { type: T.AUTH_CHANGED, uid: 'uid-B', authEpoch: 1.5 })).toBe(s);
  });
});
