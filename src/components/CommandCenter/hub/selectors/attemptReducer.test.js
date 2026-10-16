// src/components/CommandCenter/hub/selectors/attemptReducer.test.js
//
// Command Center hub, slice S2a — the attempt reducer (spec V1.2 §5.2–§5.4):
// every action's rule, the sequences the prompt names (fast refusal then a
// late losing completion; A → B → A; dismissed uncertainty still blocking
// begin and retry; recovered vs existing; another account inheriting neither
// countdown nor guard; orphan cleanup; retry incrementing the epoch exactly
// once), and one sequence per spec §11.3 "Vocabulary C3" case.

import { describe, expect, it } from 'vitest';
import { DUE_DEPLOY_LINE } from '../../../../constants/hypothesisRecords';
import { A, B, C3_CASES, LEGACY_RESULTS, REAL_ID, T0, TARGET, TYPED_RESULTS } from '../../__fixtures__/attemptFixtures';
import {
  ATTEMPT_ACTION_TYPES as T, DEPLOY_COOLDOWN_MS, attemptReducer, cooldownFor, cooldownUntilFrom, initialAttemptState,
} from './attemptReducer';
import { deriveHubDeployState } from './deployState';

// ── a small driver ──────────────────────────────────────────────────────────
const run = (state, ...actions) => actions.reduce((s, a) => attemptReducer(s, a), state);
const authOf = (s) => ({ signedIn: true, uid: s.authUid, authEpoch: s.authEpoch });
const signedInAs = (uid = A) => initialAttemptState({ uid });
const begin = (s, attemptId = 'a1', over = {}) => attemptReducer(s, { type: T.BEGIN, attemptId, auth: authOf(s), targetAgentId: TARGET, startedAt: T0, ...over });
const tag = (s) => ({ attemptId: s.attempt.attemptId, attemptEpoch: s.attempt.attemptEpoch });
const result = (s, r, tagged = tag(s)) => attemptReducer(s, { type: T.SERVICE_RESULT, ...tagged, result: r });
const dismiss = (s, tagged = tag(s), at = T0 + 1000) => attemptReducer(s, { type: T.DISMISS, ...tagged, at });
const retry = (s, attemptId, now, over = {}) => attemptReducer(s, {
  type: T.RETRY, attemptId, priorAttemptId: s.attempt?.attemptId, priorAttemptEpoch: s.attempt?.attemptEpoch, auth: authOf(s), now, startedAt: now, ...over,
});
const pending = (s, tagged = tag(s)) => attemptReducer(s, { type: T.RECONCILIATION_PENDING, ...tagged });
const reconciled = (s, status, over = {}, tagged = tag(s)) => attemptReducer(s, { type: T.RECONCILIATION_RESULT, ...tagged, status, ...over });
const evidence = (s, over = {}) => attemptReducer(s, { type: T.COOLDOWN_EVIDENCE, ownerUid: s.authUid, authEpoch: s.authEpoch, targetAgentId: TARGET, ...over });

const REFUSED = TYPED_RESULTS['refused after a POST (a typed 429)'].result;
const REVIEW_DUE = LEGACY_RESULTS['JSON 409 hypothesis_review_due (agentDeploy.js:172-177) — the one typed refusal today'].result;
const CREATED = TYPED_RESULTS['created with a real id'].result;
const EXISTING = TYPED_RESULTS['existing_battle with a valid existingBattleId'].result;
const HANDOFF = TYPED_RESULTS['handoff_failed after a real created id: provider created, real id kept, legacy failure kept'].result;
const UNTYPED = LEGACY_RESULTS['success with a real id (agentDeploy.js:227) — never a creation without its type'].result;

/** The selector over the reducer's state, with every reader ready and nothing live. */
const deployFrom = (s, over = {}) => deriveHubDeployState({
  auth: s.authUid ? authOf(s) : { signedIn: false },
  agent: { status: 'ready', agent: { id: 'agent', stats: { gamesPlayed: 3 } }, ownerUid: s.authUid, ownerEpoch: s.authEpoch },
  poll: { status: 'ready', liveBattles: [], lastSuccessfulAt: T0, ownerUid: s.authUid, ownerEpoch: s.authEpoch },
  completed: null,
  attempt: s.attempt,
  hold: s.hold,
  cooldown: s.attempt ? cooldownFor(s, s.attempt.capturedUid, s.attempt.targetAgentId) : cooldownFor(s, s.authUid, TARGET),
  now: T0,
  concurrencyEnabled: true,
  modalOpen: false,
  ...over,
});

describe('the initial state and the cooldown helpers', () => {
  it('starts with no attempt, no hold, no cooldown, epochs at zero', () => {
    expect(signedInAs()).toEqual({ authUid: A, authEpoch: 0, attemptEpoch: 0, attempt: null, hold: null, cooldowns: {}, flagDisabled: false, revoked: false });
    expect(initialAttemptState().authUid).toBeNull();
    expect(initialAttemptState({ uid: '' }).authUid).toBeNull();
  });

  it('cooldownUntil is the latest of Retry-After and the recorded lastDeployedAt + 120 s; no evidence, no countdown', () => {
    expect(cooldownUntilFrom({ lastDeployedAtMs: T0 })).toBe(T0 + 120000);
    expect(cooldownUntilFrom({ retryAfterUntil: T0 + 5000 })).toBe(T0 + 5000);
    expect(cooldownUntilFrom({ lastDeployedAtMs: T0, retryAfterUntil: T0 + 300000 })).toBe(T0 + 300000);
    expect(cooldownUntilFrom({ lastDeployedAtMs: T0, retryAfterUntil: T0 + 1 })).toBe(T0 + 120000);
    for (const e of [{}, undefined, { lastDeployedAtMs: '2026-10-14T14:00:00Z' }, { lastDeployedAtMs: Number.NaN }, { retryAfterUntil: null }]) {
      expect(cooldownUntilFrom(e)).toBeNull();
    }
    expect(DEPLOY_COOLDOWN_MS).toBe(120000);
  });

  it('cooldownFor reads only the named owner and target', () => {
    const s = evidence(signedInAs(), { lastDeployedAtMs: T0 });
    expect(cooldownFor(s, A, TARGET)).toEqual({ ownerUid: A, targetAgentId: TARGET, cooldownUntil: T0 + 120000 });
    expect(cooldownFor(s, B, TARGET).cooldownUntil).toBeNull();
    expect(cooldownFor(s, A, 'agent-ranked').cooldownUntil).toBeNull();
    expect(cooldownFor(null, A, TARGET).cooldownUntil).toBeNull();
  });
});

describe('begin', () => {
  it('accepted: a new attempt id, the captured identity, attemptEpoch + 1, phase submitting', () => {
    const s = begin(signedInAs());
    expect(s.attemptEpoch).toBe(1);
    expect(s.attempt).toMatchObject({
      attemptId: 'a1', capturedUid: A, authEpoch: 0, attemptEpoch: 1, targetAgentId: TARGET, startedAt: T0,
      phase: 'submitting', result: null, ceremonyPhase: null, errorTone: null, acknowledgedAt: null, cooldownUntil: null,
      reconciliationStatus: 'not_checked', resolution: null,
    });
    expect(Object.keys(s.attempt).sort()).toEqual([
      'acknowledgedAt', 'attemptEpoch', 'attemptId', 'authEpoch', 'capturedUid', 'ceremonyPhase', 'cooldownUntil', 'errorTone',
      'phase', 'reconciliationStatus', 'resolution', 'result', 'startedAt', 'targetAgentId',
    ]);
    expect(Object.isFrozen(s.attempt)).toBe(true);
  });

  it('a same-tick repeat is refused by the reducer too: the same state comes back', () => {
    const s = begin(signedInAs());
    expect(begin(s, 'a2')).toBe(s);
  });

  it.each(['submitting', 'created', 'existing', 'refused', 'uncertain'])('refused while an unacknowledged %s attempt exists', (phase) => {
    const s = begin(signedInAs());
    const withPhase = { ...s, attempt: { ...s.attempt, phase } };
    expect(begin(withPhase, 'a2')).toBe(withPhase);
  });

  it('refused while an orphan awaits cleanup, and accepted once it is cleaned', () => {
    const orphaned = attemptReducer(begin(signedInAs()), { type: T.AUTH_CHANGED, uid: A });
    expect(orphaned.attempt.phase).toBe('orphaned');
    expect(begin(orphaned, 'a2')).toBe(orphaned);
    const cleaned = attemptReducer(orphaned, { type: T.ORPHAN_CLEANED, attemptId: 'a1' });
    expect(cleaned.attempt).toBeNull();
    expect(begin(cleaned, 'a2').attempt.phase).toBe('submitting');
  });

  it('a hold owned by another control refuses it; the holder\'s own token is let through', () => {
    const s = { ...signedInAs(), hold: { controlId: 'strip', holdToken: 'tok', holdEpoch: 1, phase: 'locked' } };
    expect(begin(s, 'a1', { controlId: 'card', holdToken: 'tok2' })).toBe(s);
    expect(begin(s, 'a1')).toBe(s);
    expect(begin(s, 'a1', { controlId: 'strip', holdToken: 'tok' }).attempt.phase).toBe('submitting');
    // An idle hold blocks nothing.
    const idle = { ...s, hold: { ...s.hold, phase: 'idle' } };
    expect(begin(idle, 'a1').attempt.phase).toBe('submitting');
  });

  it.each([
    ['signed out', (s) => ({ signedIn: false })],
    ['another uid', (s) => ({ ...authOf(s), uid: B })],
    ['a stale auth epoch', (s) => ({ ...authOf(s), authEpoch: s.authEpoch - 1 })],
  ])('refused when the payload\'s identity is not current: %s', (_name, make) => {
    const s = attemptReducer(signedInAs(), { type: T.AUTH_CHANGED, uid: A });
    expect(begin(s, 'a1', { auth: make(s) })).toBe(s);
  });

  it('refused with no attempt id, a reused one, or no target', () => {
    const s = signedInAs();
    expect(begin(s, '')).toBe(s);
    expect(begin(s, 'a1', { targetAgentId: '' })).toBe(s);
    expect(begin(s, 'a1', { targetAgentId: null })).toBe(s);
    const done = dismiss(result(begin(s), CREATED));
    expect(begin(done, 'a1')).toBe(done);
  });

  it('after an acknowledged terminal a new begin is accepted', () => {
    const done = dismiss(result(begin(signedInAs()), CREATED));
    expect(done.attempt.phase).toBe('idle');
    const next = begin(done, 'a2');
    expect(next.attempt.attemptId).toBe('a2');
    expect(next.attemptEpoch).toBe(2);
  });
});

describe('serviceResult', () => {
  it('translates by §5.2 and stores the real server id, never stamping the current uid', () => {
    const s = result(begin(signedInAs()), CREATED);
    expect(s.attempt).toMatchObject({ phase: 'created', ceremonyPhase: 'theater', capturedUid: A });
    expect(s.attempt.result).toMatchObject({ kind: 'created', battleId: REAL_ID });
  });

  it('is ignored unless current: another attempt id, another epoch, or after an account change', () => {
    const s = begin(signedInAs());
    expect(result(s, CREATED, { attemptId: 'other', attemptEpoch: 1 })).toBe(s);
    expect(result(s, CREATED, { attemptId: 'a1', attemptEpoch: 7 })).toBe(s);
    const switched = attemptReducer(s, { type: T.AUTH_CHANGED, uid: B });
    expect(result(switched, CREATED, { attemptId: 'a1', attemptEpoch: 1 })).toBe(switched);
  });

  it('only once: a second result for the same request is a late loser', () => {
    const s = result(begin(signedInAs()), REFUSED);
    expect(result(s, CREATED)).toBe(s);
  });

  it('an untyped success is uncertain, never created (ruling R-S2A-2)', () => {
    expect(result(begin(signedInAs()), UNTYPED).attempt.phase).toBe('uncertain');
  });

  it('the 409 review-due refusal is refused with its line, and its action is the Forge', () => {
    const s = result(begin(signedInAs()), REVIEW_DUE);
    expect(s.attempt.phase).toBe('refused');
    expect(s.attempt.result.line).toBe(DUE_DEPLOY_LINE);
    expect(deployFrom(s)).toMatchObject({ displayState: 'failed', reason: DUE_DEPLOY_LINE, action: 'openForgeReview' });
  });
});

describe('targetResolved and cooldown evidence', () => {
  it('a current target-resolved callback moves the record to the resolved target and picks up its cooldown', () => {
    let s = evidence(signedInAs(), { targetAgentId: 'casual-agent-a2', lastDeployedAtMs: T0 });
    s = begin(s, 'a1', { targetAgentId: 'agent-ranked' });
    s = attemptReducer(s, { type: T.TARGET_RESOLVED, ...tag(s), targetAgentId: 'casual-agent-a2' });
    expect(s.attempt.targetAgentId).toBe('casual-agent-a2');
    expect(s.attempt.cooldownUntil).toBe(T0 + 120000);
  });

  it('a late target callback (stale tag, account change, after the result) changes nothing', () => {
    const s = begin(signedInAs());
    const late = { type: T.TARGET_RESOLVED, attemptId: 'a1', attemptEpoch: 1, targetAgentId: 'casual-agent-x' };
    const switched = attemptReducer(s, { type: T.AUTH_CHANGED, uid: B });
    expect(attemptReducer(switched, late)).toBe(switched);
    const settled = result(s, REFUSED);
    expect(attemptReducer(settled, late)).toBe(settled);
    expect(attemptReducer(s, { ...late, attemptEpoch: 2 })).toBe(s);
  });

  it('evidence is accepted only for the current owner and epoch, and a known bound is never lowered', () => {
    let s = evidence(signedInAs(), { lastDeployedAtMs: T0 });
    expect(cooldownFor(s, A, TARGET).cooldownUntil).toBe(T0 + 120000);
    expect(evidence(s, { lastDeployedAtMs: T0 - 60000 })).toBe(s);
    s = evidence(s, { retryAfterUntil: T0 + 600000 });
    expect(cooldownFor(s, A, TARGET).cooldownUntil).toBe(T0 + 600000);
    expect(evidence(s, { ownerUid: B, lastDeployedAtMs: T0 + 1 })).toBe(s);
    expect(evidence(s, { authEpoch: s.authEpoch + 1, lastDeployedAtMs: T0 + 1 })).toBe(s);
    expect(evidence(s, { targetAgentId: '', lastDeployedAtMs: T0 + 1 })).toBe(s);
    expect(evidence(s, {})).toBe(s);
  });

  it('POST issuance is not a cooldown, and a preflight refusal imposes none', () => {
    const s = result(begin(signedInAs()), TYPED_RESULTS['refused before any POST (a typed preflight refusal)'].result);
    expect(s.cooldowns).toEqual({});
    expect(s.attempt.cooldownUntil).toBeNull();
    expect(s.attempt.result.postIssued).toBe(false);
    const posted = result(begin(signedInAs()), REFUSED);
    expect(posted.cooldowns).toEqual({});
  });
});

describe('reconciliation (§5.2, §5.4)', () => {
  const uncertainState = () => result(begin(signedInAs()), UNTYPED);

  it('pending → clear / error; found → existing or recovered', () => {
    const p = pending(uncertainState());
    expect(p.attempt.reconciliationStatus).toBe('pending');
    expect(reconciled(p, 'clear').attempt).toMatchObject({ phase: 'uncertain', reconciliationStatus: 'clear' });
    expect(reconciled(p, 'error').attempt).toMatchObject({ phase: 'uncertain', reconciliationStatus: 'error' });
  });

  it('a result without a pending check, or for a non-uncertain attempt, is ignored', () => {
    const u = uncertainState();
    expect(reconciled(u, 'clear')).toBe(u);
    const c = result(begin(signedInAs()), CREATED);
    expect(pending(c)).toBe(c);
    const p = pending(u);
    expect(pending(p)).toBe(p);
    expect(reconciled(p, 'bogus')).toBe(p);
  });

  it('a found battle that is missing, unreal or foreign is unavailable: the attempt stays uncertain', () => {
    const p = pending(uncertainState());
    for (const battle of [undefined, null, { id: '' }, { id: 'bt_x', ownerId: B }, { id: 'bt_x' }]) {
      const s = reconciled(p, 'found', { battle, admitted: true });
      expect(s.attempt.phase).toBe('uncertain');
      expect(s.attempt.reconciliationStatus).toBe('error');
    }
  });

  it('a check may run again after an error or a clear', () => {
    const errored = reconciled(pending(uncertainState()), 'error');
    expect(pending(errored).attempt.reconciliationStatus).toBe('pending');
  });
});

describe('ceremonyPhase', () => {
  it('carries the attempt\'s identity: a stale notification cannot change a later attempt', () => {
    const first = dismiss(result(begin(signedInAs()), REFUSED));
    const second = begin(first, 'a2');
    const stale = attemptReducer(second, { type: T.CEREMONY_PHASE, attemptId: 'a1', attemptEpoch: 1, phase: 'reveal' });
    expect(stale).toBe(second);
    const current = attemptReducer(second, { type: T.CEREMONY_PHASE, ...tag(second), phase: 'verifying' });
    expect(current.attempt.ceremonyPhase).toBe('verifying');
  });

  it('only the vocabulary\'s phases and tones are taken; an acknowledged attempt takes none', () => {
    const s = result(begin(signedInAs()), UNTYPED);
    expect(attemptReducer(s, { type: T.CEREMONY_PHASE, ...tag(s), phase: 'confirmed' })).toBe(s);
    expect(attemptReducer(s, { type: T.CEREMONY_PHASE, ...tag(s), phase: 'error', errorTone: 'loud' }).attempt.errorTone).toBeNull();
    expect(attemptReducer(s, { type: T.CEREMONY_PHASE, ...tag(s), phase: 'error', errorTone: 'confirmed' }).attempt.errorTone).toBe('confirmed');
    const done = dismiss(result(begin(signedInAs()), CREATED));
    expect(attemptReducer(done, { type: T.CEREMONY_PHASE, ...tag(done), phase: 'reveal' })).toBe(done);
  });
});

describe('dismiss (§5.4)', () => {
  it.each([['created', CREATED], ['existing', EXISTING], ['refused', REFUSED]])('%s: acknowledged and idle at once, the ceremony closed, a committed hold released', (_name, r) => {
    let s = result(begin(signedInAs()), r);
    s = { ...s, hold: { controlId: 'card', holdToken: 't', holdEpoch: 1, phase: 'locked' } };
    const d = dismiss(s);
    expect(d.attempt).toMatchObject({ phase: 'idle', ceremonyPhase: 'closed', acknowledgedAt: T0 + 1000 });
    expect(d.hold).toBeNull();
  });

  it('a submitting attempt cannot be dismissed, and a stale dismissal releases nothing', () => {
    const s = begin(signedInAs());
    expect(dismiss(s)).toBe(s);
    const r = result(s, REFUSED);
    expect(dismiss(r, { attemptId: 'a1', attemptEpoch: 9 })).toBe(r);
  });
});

describe('retry (§5.4)', () => {
  it('from refused: replaces the prior terminal atomically and increments the epoch exactly once', () => {
    const r = result(begin(signedInAs()), REFUSED);
    const next = retry(r, 'a2', T0 + 1);
    expect(next.attemptEpoch).toBe(r.attemptEpoch + 1);
    expect(next.attempt).toMatchObject({ attemptId: 'a2', phase: 'submitting', attemptEpoch: r.attemptEpoch + 1, targetAgentId: TARGET, capturedUid: A });
    // At most one new request: a second retry from the new submitting record is refused.
    expect(retry(next, 'a3', T0 + 2)).toBe(next);
    expect(begin(next, 'a3')).toBe(next);
  });

  it('waits for the owner + target cooldown; without a clock it cannot see the bound pass', () => {
    let r = result(begin(signedInAs()), REFUSED);
    r = evidence(r, { lastDeployedAtMs: T0 });
    expect(retry(r, 'a2', T0 + 119999)).toBe(r);
    expect(retry(r, 'a2', null)).toBe(r);
    expect(retry(r, 'a2', T0 + 120000).attempt.attemptId).toBe('a2');
  });

  it('refused from submitting, created, existing, idle and an uncertain attempt not yet reconciled clear', () => {
    const s = begin(signedInAs());
    expect(retry(s, 'a2', T0)).toBe(s);
    for (const r of [CREATED, EXISTING]) {
      const t = result(begin(signedInAs()), r);
      expect(retry(t, 'a2', T0)).toBe(t);
    }
    const idle = dismiss(result(begin(signedInAs()), REFUSED));
    expect(retry(idle, 'a2', T0)).toBe(idle);
    const u = result(begin(signedInAs()), UNTYPED);
    for (const step of [(x) => x, pending, (x) => reconciled(pending(x), 'error')]) {
      const v = step(u);
      expect(retry(v, 'a2', T0)).toBe(v);
    }
  });

  it('from uncertain with an owned clear result: allowed once the cooldown is satisfied', () => {
    const clear = reconciled(pending(result(begin(signedInAs()), UNTYPED)), 'clear');
    expect(retry(clear, 'a2', T0).attempt).toMatchObject({ attemptId: 'a2', phase: 'submitting' });
  });

  it('a review-due refusal\'s primary action is the Forge; a Retry is explicit, never a reaffirm, and posts at most once', () => {
    const r = result(begin(signedInAs()), REVIEW_DUE);
    expect(deployFrom(r).action).toBe('openForgeReview');
    // The reducer has no reaffirm, retire or bypass action at all.
    expect(Object.values(T).filter((t) => /reaffirm|retire|bypass|review/i.test(t))).toEqual([]);
    const next = retry(r, 'a2', T0 + 1);
    expect(next.attemptEpoch).toBe(r.attemptEpoch + 1);
  });

  it('refused with a stale prior tag, another identity, a disabled flag, a reused id or another control\'s hold', () => {
    const r = result(begin(signedInAs()), REFUSED);
    expect(retry(r, 'a2', T0, { priorAttemptEpoch: 9 })).toBe(r);
    expect(retry(r, 'a2', T0, { priorAttemptId: 'zz' })).toBe(r);
    expect(retry(r, 'a2', T0, { auth: { signedIn: true, uid: B, authEpoch: 0 } })).toBe(r);
    expect(retry(r, 'a1', T0)).toBe(r);
    const off = attemptReducer(r, { type: T.FLAG_DISABLED });
    expect(retry(off, 'a2', T0)).toBe(off);
    const held = { ...r, hold: { controlId: 'strip', holdToken: 'tok', holdEpoch: 1, phase: 'charging' } };
    expect(retry(held, 'a2', T0)).toBe(held);
  });
});

describe('authChanged, orphan cleanup, flagDisabled, unmount (§4, §5.3, §5.4)', () => {
  it('an account change orphans the unresolved attempt, clears the hold, and bumps both epochs — even A → A', () => {
    let s = begin(signedInAs());
    s = { ...s, hold: { controlId: 'card', holdToken: 't', holdEpoch: 1, phase: 'locked' } };
    const changed = attemptReducer(s, { type: T.AUTH_CHANGED, uid: B });
    expect(changed).toMatchObject({ authUid: B, authEpoch: 1, attemptEpoch: 2, hold: null });
    expect(changed.attempt).toMatchObject({ phase: 'orphaned', ceremonyPhase: 'closed', capturedUid: A });
    expect(attemptReducer(signedInAs(), { type: T.AUTH_CHANGED, uid: A }).authEpoch).toBe(1);
    expect(attemptReducer(signedInAs(), { type: T.AUTH_CHANGED, uid: null }).authUid).toBeNull();
  });

  it('an acknowledged attempt simply goes; cleanup removes only the named orphan', () => {
    const done = dismiss(result(begin(signedInAs()), CREATED));
    expect(attemptReducer(done, { type: T.AUTH_CHANGED, uid: B }).attempt).toBeNull();
    const orphaned = attemptReducer(begin(signedInAs()), { type: T.AUTH_CHANGED, uid: B });
    expect(attemptReducer(orphaned, { type: T.ORPHAN_CLEANED, attemptId: 'zz' })).toBe(orphaned);
    expect(attemptReducer(orphaned, { type: T.ORPHAN_CLEANED, attemptId: 'a1' }).attempt).toBeNull();
  });

  it('flagDisabled cancels a charging hold and refuses new attempts; a committed request keeps its record through resolution', () => {
    const charging = { ...signedInAs(), hold: { controlId: 'card', holdToken: 't', holdEpoch: 1, phase: 'charging' } };
    const off = attemptReducer(charging, { type: T.FLAG_DISABLED });
    expect(off).toMatchObject({ flagDisabled: true, hold: null });
    expect(begin(off, 'a1')).toBe(off);
    let s = { ...begin(signedInAs()), hold: { controlId: 'card', holdToken: 't', holdEpoch: 1, phase: 'locked' } };
    s = attemptReducer(s, { type: T.FLAG_DISABLED });
    expect(s.hold.phase).toBe('locked');
    expect(s.attempt.phase).toBe('submitting');
    expect(result(s, CREATED).attempt.phase).toBe('created');
    expect(attemptReducer(off, { type: T.FLAG_DISABLED })).toBe(off);
  });

  it('unmount revokes every context: no later action, result or cleanup revives anything', () => {
    const s = begin(signedInAs());
    const gone = attemptReducer(s, { type: T.UNMOUNT });
    expect(gone).toMatchObject({ revoked: true, hold: null, attemptEpoch: 2 });
    expect(gone.attempt.phase).toBe('orphaned');
    for (const a of [
      { type: T.SERVICE_RESULT, attemptId: 'a1', attemptEpoch: 1, result: CREATED },
      { type: T.SERVICE_RESULT, attemptId: 'a1', attemptEpoch: 2, result: CREATED },
      { type: T.BEGIN, attemptId: 'a9', auth: authOf(gone), targetAgentId: TARGET },
      { type: T.AUTH_CHANGED, uid: B },
      { type: T.ORPHAN_CLEANED, attemptId: 'a1' },
      { type: T.CEREMONY_PHASE, attemptId: 'a1', attemptEpoch: 1, phase: 'reveal' },
    ]) expect(attemptReducer(gone, a)).toBe(gone);
  });

  it('a typed orphaned outcome is an invalidation: the epoch moves, so no later callback of that request is current', () => {
    const s = begin(signedInAs());
    const old = tag(s);
    const o = result(s, TYPED_RESULTS['orphaned: a local ownership disposition'].result);
    expect(o.attempt.phase).toBe('orphaned');
    expect(o.attemptEpoch).toBe(s.attemptEpoch + 1);
    expect(attemptReducer(o, { type: T.CEREMONY_PHASE, ...old, phase: 'reveal' })).toBe(o);
    expect(dismiss(o, old)).toBe(o);
    expect(deployFrom(o).displayState).toBe('account_transition');
    expect(attemptReducer(o, { type: T.ORPHAN_CLEANED, attemptId: 'a1' }).attempt).toBeNull();
  });

  it('an orphaned record takes no ceremony report, even one tagged with its own (stale) identity', () => {
    const s = begin(signedInAs());
    const orphanedInPlace = { ...s, attempt: { ...s.attempt, phase: 'orphaned' } };
    expect(attemptReducer(orphanedInPlace, { type: T.CEREMONY_PHASE, ...tag(s), phase: 'reveal' })).toBe(orphanedInPlace);
  });

  it('unknown actions and junk change nothing', () => {
    const s = signedInAs();
    for (const a of [null, undefined, 'begin', {}, { type: 'toString' }, { type: 'constructor' }, { type: 'confirmed' }]) expect(attemptReducer(s, a)).toBe(s);
    expect(attemptReducer(null, { type: T.BEGIN })).toBeNull();
  });
});

describe('the sequences the prompt names (§5)', () => {
  it('fast refusal, then a late losing completion: the loser changes nothing, the guard is released only by acknowledgment', () => {
    let s = result(begin(signedInAs()), REFUSED);
    const firstTag = tag(s);
    // The late completion for the same request.
    expect(result(s, CREATED, firstTag)).toBe(s);
    s = dismiss(s);
    s = begin(s, 'a2');
    // Late callbacks of the first request cannot touch the second: result, ceremony, dismiss, reconciliation.
    expect(result(s, CREATED, firstTag)).toBe(s);
    expect(attemptReducer(s, { type: T.CEREMONY_PHASE, ...firstTag, phase: 'reveal' })).toBe(s);
    expect(dismiss(s, firstTag)).toBe(s);
    expect(reconciled(s, 'clear', {}, firstTag)).toBe(s);
    expect(s.attempt.phase).toBe('submitting');
  });

  it('A → B → A: nothing of the first A request survives, and the second A starts fresh', () => {
    let s = begin(signedInAs(A));
    const old = tag(s);
    s = attemptReducer(s, { type: T.AUTH_CHANGED, uid: B });
    s = attemptReducer(s, { type: T.ORPHAN_CLEANED, attemptId: 'a1' });
    s = attemptReducer(s, { type: T.AUTH_CHANGED, uid: A });
    expect(s.authUid).toBe(A);
    expect(s.authEpoch).toBe(2);
    expect(s.attempt).toBeNull();
    // The original promise resolves now: ignored.
    expect(result(s, CREATED, old)).toBe(s);
    // A's own new request is accepted at the new epochs.
    const fresh = begin(s, 'a2');
    expect(fresh.attempt).toMatchObject({ capturedUid: A, authEpoch: 2, attemptEpoch: 4 });
    expect(result(fresh, CREATED, old)).toBe(fresh);
  });

  it('dismissed uncertainty still blocks begin and retry until reconciliation resolves', () => {
    let s = result(begin(signedInAs()), UNTYPED);
    s = dismiss(s);
    expect(s.attempt).toMatchObject({ phase: 'uncertain', ceremonyPhase: 'closed', acknowledgedAt: null });
    expect(begin(s, 'a2')).toBe(s);
    expect(retry(s, 'a2', T0)).toBe(s);
    expect(deployFrom(s)).toMatchObject({ displayState: 'uncertain', canStart: false, action: 'checkDeployment' });
    s = reconciled(pending(s), 'clear');
    expect(deployFrom(s).action).toBe('retry');
    // Acknowledged once clear: idle, and the selector computes eligibility again.
    s = dismiss(s);
    expect(s.attempt.phase).toBe('idle');
    expect(deployFrom(s).displayState).toBe('ready');
  });

  it('recovered vs existing: admitted → created + recovered (Battle confirmed); not admitted → existing', () => {
    const p = pending(result(begin(signedInAs()), UNTYPED));
    const recovered = reconciled(p, 'found', { battle: { id: 'bt_found', ownerId: A }, admitted: true });
    expect(recovered.attempt).toMatchObject({ phase: 'created', reconciliationStatus: 'found', resolution: { kind: 'recovered', battleId: 'bt_found' } });
    expect(deployFrom(recovered)).toMatchObject({ displayState: 'confirmed', recovered: true, battleId: 'bt_found' });
    const existing = reconciled(p, 'found', { battle: { id: 'bt_found', ownerId: A }, admitted: false });
    expect(existing.attempt).toMatchObject({ phase: 'existing', resolution: { kind: 'found_existing', battleId: 'bt_found' } });
    expect(deployFrom(existing)).toMatchObject({ displayState: 'existing', action: 'openGame', battleId: 'bt_found' });
  });

  it('another account inherits neither the countdown nor the guard', () => {
    let s = evidence(result(begin(signedInAs(A)), UNTYPED), { lastDeployedAtMs: T0 });
    s = attemptReducer(s, { type: T.AUTH_CHANGED, uid: B });
    // B sees A's orphan as a transition until cleanup...
    expect(deployFrom(s).displayState).toBe('account_transition');
    s = attemptReducer(s, { type: T.ORPHAN_CLEANED, attemptId: 'a1' });
    // ...then its own readiness, with no countdown: A's bound stays A's.
    expect(cooldownFor(s, B, TARGET).cooldownUntil).toBeNull();
    expect(deployFrom(s)).toMatchObject({ displayState: 'ready', canStart: true });
    expect(begin(s, 'b1').attempt).toMatchObject({ capturedUid: B, phase: 'submitting' });
    // Nor does another target of the same owner.
    expect(cooldownFor(s, A, 'agent-ranked').cooldownUntil).toBeNull();
  });

  it('orphan cleanup: the old owner\'s result never displays, and the new account does not wait for the old promise', () => {
    let s = begin(signedInAs(A));
    const old = tag(s);
    s = attemptReducer(s, { type: T.AUTH_CHANGED, uid: B });
    expect(deployFrom(s).displayState).toBe('account_transition');
    s = attemptReducer(s, { type: T.ORPHAN_CLEANED, attemptId: 'a1' });
    const b = begin(s, 'b1');
    expect(b.attempt.capturedUid).toBe(B);
    // A's promise settles late: it cannot release or replace B's guard.
    expect(result(b, REFUSED, old)).toBe(b);
    expect(dismiss(b, old)).toBe(b);
  });

  it('retry increments the attempt epoch exactly once per accepted retry', () => {
    let s = result(begin(signedInAs()), REFUSED);
    const epochs = [s.attemptEpoch];
    for (const id of ['a2', 'a3', 'a4']) {
      s = retry(s, id, T0);
      epochs.push(s.attemptEpoch);
      s = result(s, REFUSED);
    }
    expect(epochs).toEqual([1, 2, 3, 4]);
  });
});

describe('spec §11.3 "Vocabulary C3" — one sequence per case', () => {
  const sequences = {
    'every service outcome and ceremony phase maps by §5.2': () => {
      for (const { result: r, phase } of [...Object.values(TYPED_RESULTS), ...Object.values(LEGACY_RESULTS)]) {
        expect(result(begin(signedInAs()), r).attempt.phase).toBe(phase);
      }
      const s = result(begin(signedInAs()), CREATED);
      for (const [ceremony, word] of [['theater', 'finishing'], ['verifying', 'verifying'], ['reveal', 'confirmed'], ['closed', 'confirmed']]) {
        expect(deployFrom(attemptReducer(s, { type: T.CEREMONY_PHASE, ...tag(s), phase: ceremony })).displayState).toBe(word);
      }
    },
    'handoff_failed retains the real id and the legacy failure': () => {
      const s = result(begin(signedInAs()), HANDOFF);
      expect(s.attempt.phase).toBe('created');
      expect(s.attempt.result.battleId).toBe(REAL_ID);
      expect(s.attempt.result.evidence).toMatchObject({ success: false, error: 'deploy_handoff' });
      expect(deployFrom(s).displayState).toBe('verifying');
      // No second POST: neither begin nor retry is admitted from it.
      expect(begin(s, 'a2')).toBe(s);
      expect(retry(s, 'a2', T0)).toBe(s);
    },
    'dismissing a known terminal is immediate, with the owner + target cooldown kept apart': () => {
      let s = evidence(result(begin(signedInAs()), CREATED), { lastDeployedAtMs: T0 });
      s = dismiss(s);
      expect(s.attempt.phase).toBe('idle');
      expect(cooldownFor(s, A, TARGET).cooldownUntil).toBe(T0 + 120000);
      expect(deployFrom(s)).toMatchObject({ displayState: 'cooldown', cooldownUntil: T0 + 120000 });
      expect(deployFrom(s, { now: T0 + 120000 }).displayState).toBe('ready');
    },
    'dismissed uncertainty still blocks a fresh hold, tap or POST Retry until explicit reconciliation': () => {
      let s = dismiss(result(begin(signedInAs()), UNTYPED));
      expect(begin(s, 'tap')).toBe(s);
      expect(retry(s, 'retry', T0)).toBe(s);
      // A hold cannot commit either: canStart is false while the attempt stands.
      expect(deployFrom(s).canStart).toBe(false);
      s = reconciled(pending(s), 'clear');
      expect(retry(s, 'retry', T0).attempt.attemptId).toBe('retry');
    },
    'a failed check stays uncertain': () => {
      const s = reconciled(pending(result(begin(signedInAs()), UNTYPED)), 'error');
      expect(s.attempt).toMatchObject({ phase: 'uncertain', reconciliationStatus: 'error' });
      expect(deployFrom(s)).toMatchObject({ displayState: 'uncertain', action: 'checkDeployment' });
    },
    'an admitted recovered resolution confirms while the original service evidence remains': () => {
      const u = result(begin(signedInAs()), UNTYPED);
      const s = reconciled(pending(u), 'found', { battle: { id: 'bt_found', ownerId: A }, admitted: true });
      expect(s.attempt.result).toBe(u.attempt.result);
      expect(s.attempt.result.kind).toBe('untyped');
      expect(s.attempt.resolution.evidence).toBe(u.attempt.result);
      expect(deployFrom(s)).toMatchObject({ displayState: 'confirmed', recovered: true });
    },
    'an owned battle outside the recovery gates is existing': () => {
      const s = reconciled(pending(result(begin(signedInAs()), UNTYPED)), 'found', { battle: { id: 'bt_live', ownerId: A } });
      expect(s.attempt.phase).toBe('existing');
      expect(deployFrom(s).recovered).toBe(false);
    },
    'another account or target inherits neither countdown nor guard': () => {
      let s = evidence(signedInAs(A), { lastDeployedAtMs: T0 });
      expect(cooldownFor(s, A, 'casual-agent-other').cooldownUntil).toBeNull();
      s = attemptReducer(s, { type: T.AUTH_CHANGED, uid: B });
      expect(cooldownFor(s, B, TARGET).cooldownUntil).toBeNull();
      expect(begin(s, 'b1').attempt.cooldownUntil).toBeNull();
    },
    'a fast refusal and a late losing completion': () => {
      const s = result(begin(signedInAs()), REFUSED);
      expect(result(s, CREATED)).toBe(s);
      expect(s.attempt.phase).toBe('refused');
    },
    'orphan cleanup': () => {
      const s = attemptReducer(begin(signedInAs()), { type: T.AUTH_CHANGED, uid: B });
      expect(s.attempt.phase).toBe('orphaned');
      expect(attemptReducer(s, { type: T.ORPHAN_CLEANED, attemptId: 'a1' }).attempt).toBeNull();
    },
    'no selector uses a stored confirmed or failed phase': () => {
      // The reducer never stores one: walk every reachable phase.
      const phases = new Set();
      for (const { result: r } of [...Object.values(TYPED_RESULTS), ...Object.values(LEGACY_RESULTS)]) {
        let s = result(begin(signedInAs()), r);
        phases.add(s.attempt.phase);
        s = dismiss(s);
        if (s.attempt) phases.add(s.attempt.phase);
      }
      for (const word of ['confirmed', 'failed', 'finishing', 'verifying']) expect([...phases]).not.toContain(word);
    },
  };

  it('has a sequence for every named case, and no other', () => {
    expect(Object.keys(sequences)).toEqual([...C3_CASES]);
  });

  it.each([...C3_CASES])('%s', (name) => {
    sequences[name]();
  });
});
