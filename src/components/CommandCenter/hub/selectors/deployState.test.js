// src/components/CommandCenter/hub/selectors/deployState.test.js
//
// Command Center hub, slice S2a — deployment eligibility and display
// precedence (spec V1.2 §3.1, correction C1): one row per table row, the
// precedence rows, every §11.3 "Eligibility C1" case by name, gate parity with
// the shipped deriveDeployGate, canCommit, and the first-deployment candidate.

import { describe, expect, it } from 'vitest';
import { deriveDeployGate, DEPLOY_BLOCK_REASON } from '../../../../utils/commandCenterLiveBattles';
import {
  AS_OF, AUTH, BATTLES, C1_CASES, COOLDOWN, EPOCH, GATE_LISTS, HOLD, NOW, OTHER_UID, PRECEDENCE_ROWS, TABLE_ROWS, UID,
  agentReady, attemptFor, base, completedReady, pollInitial, pollReady,
} from '../../__fixtures__/deployStateFixtures';
import { canCommit, deriveHubDeployState, ELIGIBILITY_STATES, firstDeploymentCandidate, ownedLiveBattles } from './deployState';

describe('spec §3.1 — one row per table row, in the table\'s order', () => {
  it('the fixture covers all eleven rows, in order', () => {
    const rows = TABLE_ROWS.map((r) => r.row);
    expect([...new Set(rows)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(rows).toEqual([...rows].sort((a, b) => a - b));
  });

  it.each(TABLE_ROWS)('row $row — $name → $displayState (canStart $canStart)', ({ inputs, displayState, canStart }) => {
    const d = deriveHubDeployState(inputs);
    expect(d.displayState).toBe(displayState);
    expect(d.canStart).toBe(canStart);
  });

  it('row 10 and row 11 differ by the refreshing annotation and keep the retained as-of', () => {
    const refreshing = deriveHubDeployState(base({ poll: pollReady([], { status: 'loading' }) }));
    const ready = deriveHubDeployState(base());
    expect(refreshing.freshness).toEqual({ asOf: AS_OF, stale: false, refreshing: true });
    expect(ready.freshness).toEqual({ asOf: AS_OF, stale: false, refreshing: false });
    // A ready result that also flags a refresh in flight is the same annotation.
    expect(deriveHubDeployState(base({ poll: pollReady([], { refreshing: true }) })).freshness.refreshing).toBe(true);
  });

  it('every state the selector returns is in the vocabulary (the eligibility states or the §5.2 attempt words)', () => {
    const attemptWords = ['submitting', 'verifying', 'finishing', 'confirmed', 'existing', 'failed', 'uncertain'];
    for (const { inputs } of [...TABLE_ROWS, ...PRECEDENCE_ROWS]) {
      const { displayState } = deriveHubDeployState(inputs);
      expect([...Object.values(ELIGIBILITY_STATES), ...attemptWords]).toContain(displayState);
    }
  });
});

describe('spec §3.1 — precedence: when several rows match, the first wins', () => {
  it.each(PRECEDENCE_ROWS)('$name', ({ inputs, displayState }) => {
    expect(deriveHubDeployState(inputs).displayState).toBe(displayState);
    expect(deriveHubDeployState(inputs).canStart).toBe(displayState === 'ready_stale');
  });
});

describe('spec §11.3 "Eligibility C1" — every case, by name', () => {
  it.each(Object.entries(C1_CASES))('%s', (_name, { inputs, expect: want, firstDeployment }) => {
    const d = deriveHubDeployState(inputs);
    for (const [key, value] of Object.entries(want)) expect(d[key], key).toEqual(value);
    if (firstDeployment !== undefined) expect(firstDeploymentCandidate(inputs)).toBe(firstDeployment);
  });

  it('names every case §11.3 lists, the ranked-only one under both flag values', () => {
    const listed = [
      'Initial absent metadata', 'first failure', 'stale active BaggerBomb', 'stale clear', 'retained clear + refresh pending',
      'retained active + refresh pending', 'stale ranked-only, concurrency on', 'stale ranked-only, concurrency off',
      'actual account change clears old data', 'completed failure never yields the first-deploy suggestion',
    ];
    const names = Object.keys(C1_CASES);
    expect(names).toHaveLength(listed.length);
    for (const prefix of listed) expect(names.filter((n) => n.startsWith(prefix)), prefix).toHaveLength(1);
  });
});

describe('identity: unresolved is not signed out, and ownerUid null is not an account change (spec §3)', () => {
  it('an identity that has not resolved checks — it never reads "signed out" — and admits nothing', () => {
    for (const auth of [null, undefined, {}, { signedIn: null }, { signedIn: true }, { signedIn: true, uid: '', authEpoch: 1 }, { signedIn: true, uid: UID, authEpoch: -1 }, { signedIn: true, uid: UID, authEpoch: 1.5 }]) {
      const d = deriveHubDeployState(base({ auth }));
      expect(d.displayState, JSON.stringify(auth)).toBe('checking');
      expect(d.canStart).toBe(false);
    }
    expect(deriveHubDeployState(base({ auth: { signedIn: false } })).displayState).toBe('signed_out');
  });

  it('a reader whose ownerUid is null has not resolved: never a transition, whatever its epoch says', () => {
    const d = deriveHubDeployState(base({ poll: pollInitial({ ownerEpoch: 99 }), completed: { status: 'loading', rows: [], ownerUid: null, ownerEpoch: 7 } }));
    expect(d.displayState).toBe('checking');
  });

  it('a resolved result of the same uid at an older auth epoch is foreign (A → B → A)', () => {
    for (const reader of ['agent', 'poll', 'completed']) {
      const stale = { agent: agentReady({ ownerEpoch: EPOCH - 2 }), poll: pollReady([], { ownerEpoch: EPOCH - 2 }), completed: completedReady([], { ownerEpoch: EPOCH - 2 }) }[reader];
      expect(deriveHubDeployState(base({ [reader]: stale })).displayState, reader).toBe('account_transition');
    }
  });

  it('an attempt of another identity, or one the reducer has orphaned, is a transition and shows none of its result', () => {
    const foreignAttempt = attemptFor('refused', { capturedUid: OTHER_UID, result: { kind: 'refused', line: 'old owner\'s words' } });
    const d = deriveHubDeployState(base({ attempt: foreignAttempt }));
    expect(d.displayState).toBe('account_transition');
    expect(d.reason).toBeNull();
    expect(deriveHubDeployState(base({ attempt: attemptFor('orphaned') })).displayState).toBe('account_transition');
  });

  it('an acknowledged (idle) attempt shows nothing and blocks nothing', () => {
    expect(deriveHubDeployState(base({ attempt: attemptFor('idle', { acknowledgedAt: NOW - 1000 }) })).displayState).toBe('ready');
  });

  it('a record stored in a phase the vocabulary does not know — a display word, say — fails closed', () => {
    for (const phase of ['confirmed', 'failed', 'finishing', 'verifying', 'bogus']) {
      const d = deriveHubDeployState(base({ attempt: attemptFor(phase) }));
      expect(d.displayState, phase).toBe('checking');
      expect(d.canStart).toBe(false);
    }
  });
});

describe('the attempt row (§3.1 row 3, §5.2) — its own words, preserved', () => {
  it('refused: failed, the server\'s line unchanged as the reason, the action by kind', () => {
    const due = deriveHubDeployState(base({ attempt: attemptFor('refused', { result: { kind: 'review_due', line: 'Due line.' } }) }));
    expect(due).toMatchObject({ displayState: 'failed', reason: 'Due line.', action: 'openForgeReview', canStart: false });
    const other = deriveHubDeployState(base({ attempt: attemptFor('refused', { result: { kind: 'refused', line: null } }) }));
    expect(other).toMatchObject({ displayState: 'failed', reason: null, action: 'retry' });
  });

  it('created: finishing in theater, verifying during a check, then confirmed with Enter battle and the real id', () => {
    const at = (ceremonyPhase, extra = {}) => deriveHubDeployState(base({ attempt: attemptFor('created', { ceremonyPhase, result: { kind: 'created', battleId: 'bt_1' }, ...extra }) }));
    expect(at('theater')).toMatchObject({ displayState: 'finishing', action: null, battleId: 'bt_1' });
    expect(at('verifying')).toMatchObject({ displayState: 'verifying', action: null });
    expect(at('reveal')).toMatchObject({ displayState: 'confirmed', action: 'enterBattle', recovered: false, battleId: 'bt_1' });
    expect(at(null)).toMatchObject({ displayState: 'confirmed', recovered: false });
    const recovered = at('reveal', { resolution: { kind: 'recovered', battleId: 'bt_found' } });
    expect(recovered).toMatchObject({ displayState: 'confirmed', recovered: true, battleId: 'bt_found', action: 'enterBattle' });
  });

  it('existing: Open game on the existing battle\'s id; uncertain: Check deployment, nothing while pending, Retry once clear', () => {
    expect(deriveHubDeployState(base({ attempt: attemptFor('existing', { result: { kind: 'existing', battleId: 'bt_live' } }) })))
      .toMatchObject({ displayState: 'existing', action: 'openGame', battleId: 'bt_live' });
    const u = (reconciliationStatus) => deriveHubDeployState(base({ attempt: attemptFor('uncertain', { reconciliationStatus }) })).action;
    expect(u('not_checked')).toBe('checkDeployment');
    expect(u('error')).toBe('checkDeployment');
    expect(u('pending')).toBeNull();
    expect(u('clear')).toBe('retry');
  });

  it('submitting stays submitting over a newly seen live game, and the gate it would meet is still computed', () => {
    const d = deriveHubDeployState(base({ attempt: attemptFor('submitting'), poll: pollReady([BATTLES.baggerbomb]) }));
    expect(d.displayState).toBe('submitting');
    expect(d.gateBlocked).toBe(true);
    expect(d.canStart).toBe(false);
  });

  it('a hold denies every competing control and names its control; the words stay ready', () => {
    const d = deriveHubDeployState(base({ hold: HOLD }));
    expect(d).toMatchObject({ displayState: 'ready', canStart: false, holdControlId: 'deploy-card' });
    for (const phase of ['locked']) expect(deriveHubDeployState(base({ hold: { ...HOLD, phase } })).canStart).toBe(false);
    // An idle hold is no hold.
    expect(deriveHubDeployState(base({ hold: { ...HOLD, phase: 'idle' } })).canStart).toBe(true);
  });
});

describe('the cooldown row (§3.1 row 4, §5.4)', () => {
  it('holds until its bound, then releases; the bound is reported', () => {
    expect(deriveHubDeployState(base({ cooldown: COOLDOWN }))).toMatchObject({ displayState: 'cooldown', cooldownUntil: COOLDOWN.cooldownUntil, canStart: false });
    expect(deriveHubDeployState(base({ cooldown: COOLDOWN, now: COOLDOWN.cooldownUntil })).displayState).toBe('ready');
    expect(deriveHubDeployState(base({ cooldown: COOLDOWN, now: COOLDOWN.cooldownUntil - 1 })).displayState).toBe('cooldown');
  });

  it('without a clock a bound cannot be shown to have passed: it holds (fail closed)', () => {
    for (const now of [null, undefined, Number.NaN]) expect(deriveHubDeployState(base({ cooldown: COOLDOWN, now })).displayState).toBe('cooldown');
  });

  it('another owner\'s cooldown never applies; no bound means no countdown', () => {
    expect(deriveHubDeployState(base({ cooldown: { ...COOLDOWN, ownerUid: OTHER_UID } })).displayState).toBe('ready');
    for (const cooldownUntil of [null, undefined, Number.NaN, '2026-10-14T14:42:00Z']) {
      expect(deriveHubDeployState(base({ cooldown: { ...COOLDOWN, cooldownUntil } })).displayState).toBe('ready');
    }
  });
});

describe('the agent rows (§3.1 row 5)', () => {
  it('a ready result that names no owner has not resolved, and an unknown status is loading', () => {
    expect(deriveHubDeployState(base({ agent: { status: 'ready', agent: { id: 'x' }, ownerUid: null, ownerEpoch: null } })).displayState).toBe('loading_agent');
    expect(deriveHubDeployState(base({ agent: agentReady({ status: 'stale' }) })).displayState).toBe('loading_agent');
    expect(deriveHubDeployState(base({ agent: null })).displayState).toBe('loading_agent');
  });

  it('agent_error offers the agent read\'s Retry', () => {
    expect(deriveHubDeployState(base({ agent: agentReady({ status: 'error', agent: null }) })).retryAction).toBe('agent');
  });
});

describe('ownership filtering (§3): stored ownerId, training clones out, casual clones in', () => {
  it('keeps this owner\'s ranked, casual-clone and real-agent games; drops training clones, other owners and junk', () => {
    const list = [BATTLES.ranked, BATTLES.baggerbomb, BATTLES.training, BATTLES.foreign, BATTLES.realAgentBaggerBomb, null, 'x', { id: 'no-owner' }];
    expect(ownedLiveBattles(list, UID).map((b) => b.id)).toEqual(['rk_1', 'bb_1', 'bb_2']);
    expect(ownedLiveBattles(null, UID)).toEqual([]);
  });

  it('a live game with no ownerId (today\'s optimistic entry, App.jsx) is not this owner\'s', () => {
    const optimistic = { id: 'bt_new', agentId: `casual-agent-${UID}`, status: 'active', gameMode: null, groupId: null };
    expect(deriveHubDeployState(base({ poll: pollReady([optimistic]) })).gateBlocked).toBe(false);
  });

  it('a foreign BaggerBomb or a training pod never blocks this owner', () => {
    expect(deriveHubDeployState(base({ poll: pollReady([BATTLES.foreign, BATTLES.training]) })).displayState).toBe('ready');
  });
});

describe('gate parity with the shipped deriveDeployGate (prompt §5)', () => {
  const matrix = Object.entries(GATE_LISTS).flatMap(([name, list]) => [true, false].map((concurrencyEnabled) => ({ name, list, concurrencyEnabled })));

  it.each(matrix)('$name, concurrency $concurrencyEnabled: gateBlocked and reason equal the helper\'s on the same filtered list', ({ list, concurrencyEnabled }) => {
    const gate = deriveDeployGate({ liveBattles: ownedLiveBattles(list, UID), agent: null, concurrencyEnabled });
    for (const status of ['ready', 'loading', 'error']) {
      const d = deriveHubDeployState(base({ poll: pollReady(list, { status }), concurrencyEnabled }));
      expect(d.gateBlocked, status).toBe(gate.deployBlockedByLive);
      expect(d.reason, status).toBe(gate.deployBlockReason);
      expect(d.displayState === 'blocked', status).toBe(gate.deployBlockedByLive);
    }
  });

  it('the gate is computed independently of the poll\'s status, and never from agent.activeBattleId', () => {
    const clear = base({ agent: agentReady({ agent: { id: 'agent-a', activeBattleId: 'rk_1', stats: { gamesPlayed: 3 } } }) });
    expect(deriveHubDeployState(clear).displayState).toBe('ready');
    expect(deriveHubDeployState({ ...clear, poll: pollReady([BATTLES.baggerbomb], { status: 'error' }) }).gateBlocked).toBe(true);
  });

  it('a flag that is not true is the legacy any-live gate (fail closed)', () => {
    for (const concurrencyEnabled of [undefined, null, 'true', 1]) {
      expect(deriveHubDeployState(base({ poll: pollReady([BATTLES.ranked]), concurrencyEnabled })).displayState).toBe('blocked');
    }
    expect(deriveHubDeployState(base({ poll: pollReady([BATTLES.ranked]), concurrencyEnabled: true })).displayState).toBe('ready');
  });

  it('the helper\'s reason is the one the fixtures and the display carry', () => {
    expect(deriveHubDeployState(base({ poll: pollReady([BATTLES.baggerbomb]) })).reason).toBe(DEPLOY_BLOCK_REASON);
  });
});

describe('modalOpen (§3.1: competing controls are denied while a sheet, Forge or ceremony is open)', () => {
  it('denies canStart without changing the words', () => {
    for (const poll of [pollReady([]), pollReady([], { status: 'error' }), pollReady([], { status: 'loading' })]) {
      const open = deriveHubDeployState(base({ poll, modalOpen: true }));
      const closed = deriveHubDeployState(base({ poll }));
      expect(open.canStart).toBe(false);
      expect(closed.canStart).toBe(true);
      expect(open.displayState).toBe(closed.displayState);
    }
  });
});

describe('canCommit(holdToken, inputs) — the holding control\'s synchronous recheck (§3.1, §5.5)', () => {
  const holding = (over = {}) => base({ hold: HOLD, ...over });

  it('the matching token, still charging, passes where everything else is ready', () => {
    expect(canCommit('tok_1', holding())).toBe(true);
    expect(canCommit('tok_1', holding({ poll: pollReady([], { status: 'error' }) }))).toBe(true);
  });

  it('only that token: another, a missing one, or a hold that is not charging is denied', () => {
    expect(canCommit('tok_2', holding())).toBe(false);
    expect(canCommit(null, holding())).toBe(false);
    expect(canCommit(undefined, holding())).toBe(false);
    expect(canCommit('tok_1', base())).toBe(false);
    expect(canCommit('tok_1', holding({ hold: { ...HOLD, phase: 'locked' } }))).toBe(false);
    expect(canCommit('tok_1', holding({ hold: { ...HOLD, phase: 'idle' } }))).toBe(false);
    expect(canCommit('tok_1', holding({ hold: { ...HOLD, holdEpoch: -1 } }))).toBe(false);
  });

  it.each([
    ['actual auth signed out', { auth: { signedIn: false } }],
    ['auth changed: a new epoch, results of the old', { auth: { ...AUTH, authEpoch: EPOCH + 1 } }],
    ['agent loading', { agent: { status: 'loading', agent: null, ownerUid: null, ownerEpoch: null } }],
    ['agent absent', { agent: agentReady({ agent: null }) }],
    ['a modal opened', { modalOpen: true }],
    ['poll ownership lost: the list is another owner\'s', { poll: pollReady([], { ownerUid: OTHER_UID }) }],
    ['no successful owned poll', { poll: pollInitial() }],
    ['cooldown', { cooldown: COOLDOWN }],
    ['the retained gate now blocks', { poll: pollReady([BATTLES.baggerbomb]) }],
    ['another attempt is unacknowledged', { attempt: attemptFor('refused') }],
    ['an unresolved reconciliation', { attempt: attemptFor('uncertain', { reconciliationStatus: 'pending', ceremonyPhase: 'closed' }) }],
  ])('rechecks every other row: %s → denied', (_name, over) => {
    expect(canCommit('tok_1', holding(over))).toBe(false);
  });
});

describe('firstDeploymentCandidate (§3.1): a ready, EMPTY completed read for this owner, no live game, gamesPlayed exactly 0, canStart', () => {
  const first = (over = {}) => base({ agent: agentReady({ agent: { id: 'agent-a', stats: { gamesPlayed: 0 } } }), completed: completedReady([]), ...over });

  it('true only when every condition holds', () => {
    expect(firstDeploymentCandidate(first())).toBe(true);
  });

  it.each([
    ['the completed read is loading', { completed: { status: 'loading', rows: [], ownerUid: null, ownerEpoch: null } }],
    ['the completed read failed', { completed: completedReady([], { status: 'error' }) }],
    ['the completed read has a game', { completed: completedReady([{ id: 'done_1' }]) }],
    ['the completed read is another owner\'s', { completed: completedReady([], { ownerUid: OTHER_UID }) }],
    ['the completed rows are not a list', { completed: completedReady(null) }],
    ['a game is live (ranked, which does not block deploy)', { poll: pollReady([BATTLES.ranked]) }],
    ['gamesPlayed is missing', { agent: agentReady({ agent: { id: 'agent-a', stats: {} } }) }],
    ['stats are missing', { agent: agentReady({ agent: { id: 'agent-a' } }) }],
    ['gamesPlayed is a string zero', { agent: agentReady({ agent: { id: 'agent-a', stats: { gamesPlayed: '0' } } }) }],
    ['gamesPlayed is not finite', { agent: agentReady({ agent: { id: 'agent-a', stats: { gamesPlayed: Number.NaN } } }) }],
    ['gamesPlayed is 1', { agent: agentReady({ agent: { id: 'agent-a', stats: { gamesPlayed: 1 } } }) }],
    ['cannot start: a modal is open', { modalOpen: true }],
    ['cannot start: cooling down', { cooldown: COOLDOWN }],
    ['no successful owned poll', { poll: pollInitial() }],
    ['signed out', { auth: { signedIn: false } }],
  ])('false when %s', (_name, over) => {
    expect(firstDeploymentCandidate(first(over))).toBe(false);
  });
});

describe('purity of the result', () => {
  it('returns a frozen object and never mutates its inputs', () => {
    const inputs = base({ poll: pollReady([BATTLES.ranked, BATTLES.training]) });
    const before = JSON.stringify(inputs);
    const d = deriveHubDeployState(inputs);
    expect(Object.isFrozen(d)).toBe(true);
    expect(Object.isFrozen(d.freshness)).toBe(true);
    expect(JSON.stringify(inputs)).toBe(before);
  });

  it('is a function of its inputs: the same inputs give the same result', () => {
    const inputs = base({ poll: pollReady([BATTLES.baggerbomb], { status: 'error' }) });
    expect(deriveHubDeployState(inputs)).toEqual(deriveHubDeployState(inputs));
    expect(deriveHubDeployState(undefined).displayState).toBe('checking');
  });

  it('S2a\'s fixture times are what they say: NOW and the retained as-of', () => {
    expect(new Date(NOW).toISOString()).toBe('2026-10-14T14:40:00.000Z');
    expect(NOW - AS_OF).toBe(120000);
  });
});
