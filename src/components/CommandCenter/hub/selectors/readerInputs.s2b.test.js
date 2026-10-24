// src/components/CommandCenter/hub/selectors/readerInputs.s2b.test.js
//
// Command Center slice S2b (ruling R-S2b-2) — attemptInputsOf: the deploy
// provider's half of the selector's inputs, from its context snapshot. The
// attempt and the hold records as they are; the owner + target cooldown (the
// attempt's resolved target, else the ranked agent's own id; nobody's when
// signed out); this render's clock; and `modalOpen`, the hub's sheets OR the
// provider's own ceremony or due-idea screen. No snapshot, nothing.

import { describe, it, expect } from 'vitest';
import { attemptInputsOf } from './readerInputs';
import { ATTEMPT_ACTION_TYPES as T, attemptReducer, initialAttemptState } from './attemptReducer';

const auth = { signedIn: true, uid: 'uid-A', authEpoch: 1 };
const withCooldown = (state, target, ms) => attemptReducer(state, { type: T.COOLDOWN_EVIDENCE, ownerUid: 'uid-A', authEpoch: 1, targetAgentId: target, lastDeployedAtMs: ms });
const snap = (state, overlayOpen = false) => ({ state, overlayOpen });

describe('attemptInputsOf', () => {
  it('no snapshot (no provider): nothing, so S3\'s inputs stand as they were', () => {
    expect(attemptInputsOf(null, { auth })).toBeNull();
    expect(attemptInputsOf({}, { auth })).toBeNull();
  });

  it('the records as they are, and this render\'s clock', () => {
    const state = attemptReducer(initialAttemptState({ uid: 'uid-A', authEpoch: 1 }), { type: T.HOLD_CLAIMED, auth, controlId: 'card', holdToken: 't', holdEpoch: 1 });
    const out = attemptInputsOf(snap(state), { auth, agentId: 'agent-a', now: 42 });
    expect(out.attempt).toBeNull();
    expect(out.hold).toBe(state.hold);
    expect(out.now).toBe(42);
  });

  it('modalOpen: the hub\'s sheets, or the provider\'s own overlay', () => {
    const state = initialAttemptState({ uid: 'uid-A', authEpoch: 1 });
    expect(attemptInputsOf(snap(state), { auth }).modalOpen).toBe(false);
    expect(attemptInputsOf(snap(state), { auth, hubModalOpen: true }).modalOpen).toBe(true);
    expect(attemptInputsOf(snap(state, true), { auth }).modalOpen).toBe(true);
  });

  it('the cooldown: the ranked agent\'s with no attempt; another target\'s bound does not apply to it', () => {
    const state = withCooldown(initialAttemptState({ uid: 'uid-A', authEpoch: 1 }), 'agent-a', 1000);
    expect(attemptInputsOf(snap(state), { auth, agentId: 'agent-a' }).cooldown).toEqual({ ownerUid: 'uid-A', targetAgentId: 'agent-a', cooldownUntil: 121000 });
    expect(attemptInputsOf(snap(state), { auth, agentId: 'agent-b' }).cooldown.cooldownUntil).toBeNull();
  });

  it('the cooldown follows the attempt\'s resolved target (the casual clone), not the ranked id', () => {
    let state = initialAttemptState({ uid: 'uid-A', authEpoch: 1 });
    state = attemptReducer(state, { type: T.BEGIN, attemptId: 'a1', auth, targetAgentId: 'agent-a', startedAt: 1 });
    state = attemptReducer(state, { type: T.TARGET_RESOLVED, attemptId: 'a1', attemptEpoch: state.attempt.attemptEpoch, targetAgentId: 'clone-a' });
    state = withCooldown(state, 'clone-a', 5000);
    expect(attemptInputsOf(snap(state), { auth, agentId: 'agent-a' }).cooldown).toMatchObject({ targetAgentId: 'clone-a', cooldownUntil: 125000 });
  });

  it('signed out or unresolved: no owner, so no cooldown', () => {
    const state = withCooldown(initialAttemptState({ uid: 'uid-A', authEpoch: 1 }), 'agent-a', 1000);
    expect(attemptInputsOf(snap(state), { auth: { signedIn: false }, agentId: 'agent-a' }).cooldown).toBeNull();
    expect(attemptInputsOf(snap(state), { auth: null, agentId: 'agent-a' }).cooldown).toBeNull();
  });
});
