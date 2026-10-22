// src/components/CommandCenter/hub/selectors/readerInputs.test.js
//
// Command Center hub, slice S3 (ruling R-S3-9) — the readers' results in the
// S2a selector's input shapes, and through the selector the states the hub
// shows: checking while unresolved, a real eligibility once the readers
// resolve, "Refreshing" only for an explicit refresh, never for the
// background run, and the owner's live documents only.

import { describe, expect, it } from 'vitest';
import { agentInputOf, authInputOf, completedInputOf, ownedLiveList, pollInputOf } from './readerInputs';
import { deriveHubDeployState } from './deployState';
import { HUB_S2A_DEPLOY_INPUTS } from '../hubModel';

const A = Object.freeze({ resolved: true, uid: 'uid-A', authEpoch: 2 });
const meta = (over = {}) => ({ epoch: 2, status: 'ready', ownerUid: 'uid-A', ownerEpoch: 2, lastSuccessfulAt: 1000, error: null, refreshing: false, ...over });
const BB = { id: 'bb_1', ownerId: 'uid-A', agentId: 'casual-agent-uid-A', status: 'active' };

describe('authInputOf', () => {
  it('unresolved → null (checks); resolved signed out → signedIn false; signed in → uid and epoch', () => {
    expect(authInputOf({ resolved: false, uid: null, authEpoch: 0 })).toBeNull();
    expect(authInputOf(null)).toBeNull();
    expect(authInputOf({ resolved: true, uid: null, authEpoch: 1 })).toEqual({ signedIn: false });
    expect(authInputOf(A)).toEqual({ signedIn: true, uid: 'uid-A', authEpoch: 2 });
  });
});

describe('agentInputOf', () => {
  it('the doc only when ready, the read\'s own owner, epoch and error', () => {
    expect(agentInputOf({ status: 'ready', agent: { id: 'a' }, ownerUid: 'uid-A', ownerEpoch: 2, readError: null }))
      .toEqual({ status: 'ready', agent: { id: 'a' }, ownerUid: 'uid-A', ownerEpoch: 2, error: null });
    const failure = new Error('x');
    expect(agentInputOf({ status: 'error', agent: { id: 'stale' }, ownerUid: 'uid-A', ownerEpoch: 2, readError: failure }))
      .toEqual({ status: 'error', agent: null, ownerUid: 'uid-A', ownerEpoch: 2, error: failure });
    expect(agentInputOf({ status: 'loading', agent: { id: 'stale' } })).toMatchObject({ status: 'loading', agent: null, ownerUid: null });
    expect(agentInputOf(undefined)).toMatchObject({ status: 'loading' });
  });
});

describe('pollInputOf — the current request\'s status', () => {
  it('the retained list with its owner and epoch; the latest settled status', () => {
    expect(pollInputOf(meta(), [BB], A)).toEqual({ status: 'ready', liveBattles: [BB], ownerUid: 'uid-A', ownerEpoch: 2, lastSuccessfulAt: 1000, error: null, refreshing: false });
    expect(pollInputOf(meta({ status: 'error', error: 'e' }), [BB], A)).toMatchObject({ status: 'error', liveBattles: [BB] });
  });

  it('an explicit refresh reads as the current request loading; nothing retained → no list', () => {
    expect(pollInputOf(meta({ refreshing: true, status: 'error' }), [BB], A)).toMatchObject({ status: 'loading', refreshing: true });
    expect(pollInputOf(meta({ ownerUid: null, ownerEpoch: null, status: 'loading' }), [], A)).toMatchObject({ status: 'loading', liveBattles: null });
  });

  it('metadata of another epoch (not reset yet) is loading, its owner still shown as that owner', () => {
    expect(pollInputOf(meta({ epoch: 1, ownerEpoch: 1 }), [BB], A)).toMatchObject({ status: 'loading', ownerUid: 'uid-A', ownerEpoch: 1 });
    expect(pollInputOf(undefined, [BB], A)).toMatchObject({ status: 'loading', liveBattles: null, ownerUid: null });
  });
});

describe('completedInputOf and ownedLiveList', () => {
  it('the window\'s rows only once read; never an empty list standing in for a failed read', () => {
    expect(completedInputOf({ status: 'ready', battles: [{ id: 'x' }], ownerUid: 'uid-A', ownerEpoch: 2 })).toEqual({ status: 'ready', rows: [{ id: 'x' }], ownerUid: 'uid-A', ownerEpoch: 2 });
    expect(completedInputOf({ status: 'error', battles: null, ownerUid: null, ownerEpoch: null })).toEqual({ status: 'error', rows: [], ownerUid: null, ownerEpoch: null });
  });

  it('the gate\'s owned set for the current identity: none for another owner or epoch', () => {
    const auth = authInputOf(A);
    const foreign = { ...BB, id: 'fx', ownerId: 'uid-B' };
    const training = { ...BB, id: 'tr', agentId: 'training-agent-g-uid-A' };
    expect(ownedLiveList(pollInputOf(meta(), [BB, foreign, training], A), auth).map((b) => b.id)).toEqual(['bb_1']);
    expect(ownedLiveList(pollInputOf(meta({ ownerEpoch: 1 }), [BB], A), auth)).toEqual([]);
    expect(ownedLiveList(pollInputOf(meta(), [BB], A), { signedIn: false })).toEqual([]);
  });
});

describe('through the S2a selector: real eligibility words, Refreshing only when asked', () => {
  const inputs = (over) => ({
    ...HUB_S2A_DEPLOY_INPUTS,
    auth: authInputOf(A),
    agent: agentInputOf({ status: 'ready', agent: { id: 'a', stats: { gamesPlayed: 3 } }, ownerUid: 'uid-A', ownerEpoch: 2 }),
    poll: pollInputOf(meta(), [], A),
    completed: completedInputOf({ status: 'ready', battles: [], ownerUid: 'uid-A', ownerEpoch: 2 }),
    concurrencyEnabled: true,
    ...over,
  });

  it('resolved readers leave checking: ready to deploy', () => {
    expect(deriveHubDeployState(inputs()).displayState).toBe('ready');
    expect(deriveHubDeployState(HUB_S2A_DEPLOY_INPUTS).displayState).toBe('checking');
  });

  it('the background run (settled ready, nothing explicit) is not a refresh; an explicit refresh is', () => {
    expect(deriveHubDeployState(inputs()).freshness.refreshing).toBe(false);
    expect(deriveHubDeployState(inputs({ poll: pollInputOf(meta({ refreshing: true }), [], A) })).freshness.refreshing).toBe(true);
  });

  it('a live BaggerBomb game in the retained list blocks; a first-poll failure is eligibility_error with the poll\'s Retry', () => {
    expect(deriveHubDeployState(inputs({ poll: pollInputOf(meta(), [BB], A) })).displayState).toBe('blocked');
    const failed = deriveHubDeployState(inputs({ poll: pollInputOf(meta({ status: 'error', ownerUid: null, ownerEpoch: null }), [], A) }));
    expect(failed).toMatchObject({ displayState: 'eligibility_error', retryAction: 'poll' });
  });

  it('metadata of an earlier epoch reads as switching account, never as this owner\'s', () => {
    expect(deriveHubDeployState(inputs({ poll: pollInputOf(meta({ epoch: 1, ownerEpoch: 1 }), [BB], A) })).displayState).toBe('account_transition');
  });
});
