// src/components/CommandCenter/hub/deployDisplay.rulings.test.js
//
// Command Center slice S2b — the founder's rulings on the S2b report's
// questions, in the hub's vocabulary and display table:
//
//   Q-S2b-2  every definitive refusal's state word is "Deployment refused"
//            (before: "Deployment failed"), on every surface that shows it;
//   Q-S2b-4  a refusal no ceremony shows offers "Dismiss" on the strip and the
//            card, beside its own action; never an uncertain attempt, never a
//            refusal an open ceremony shows.

import { describe, it, expect } from 'vitest';
import { deployDisplay, DISPLAY_ACTIONS } from './deployDisplay';
import { HUB_COPY as COPY } from './hubCopy';
import {
  ATTEMPT_PHASES, CEREMONY_PHASES, RECONCILIATION, RESULT_KINDS, displayForAttempt,
} from './selectors/attemptVocabulary';
import { DEPLOY_IN_PROGRESS_LINE } from '../../../constants/deployOutcomes';
import { DUE_DEPLOY_LINE } from '../../../constants/hypothesisRecords';

const LOADOUT = 'Equipped · 10 names';
const DISMISS = Object.freeze({ kind: 'dismiss', label: 'Dismiss' });
const refused = (over = {}) => ({ phase: ATTEMPT_PHASES.REFUSED, ceremonyPhase: CEREMONY_PHASES.ERROR, result: { kind: RESULT_KINDS.REFUSED, line: null }, ...over });

describe('Q-S2b-2 — the hub\'s word for a definitive refusal, each surface before and after', () => {
  it('a plain refusal: the status, the strip\'s first line, the card\'s line and its control all read "Deployment refused", never "Deployment failed"', () => {
    const d = deployDisplay({ displayState: 'failed', reason: '', action: DISPLAY_ACTIONS.RETRY });
    const surfaces = { status: d.status, stripLine1: d.stripLine1, cardLine: d.cardLine.text, cardHoldLabel: d.cardHoldLabel };
    expect(surfaces).toEqual({ status: 'Deployment refused', stripLine1: 'Deployment refused', cardLine: 'Deployment refused', cardHoldLabel: 'Deployment refused' });
    for (const [where, text] of Object.entries(surfaces)) expect(text, where).not.toBe('Deployment failed');
  });

  it('the in-progress refusal: "Deployment refused" on line one, its own line unchanged on line two and the card', () => {
    const d = deployDisplay({ displayState: 'failed', reason: DEPLOY_IN_PROGRESS_LINE, action: DISPLAY_ACTIONS.RETRY });
    expect(d.stripLine1).toBe('Deployment refused');
    expect(d.stripLine2(LOADOUT)).toBe('A deploy is already in progress');
    expect(d.cardLine.text).toBe('A deploy is already in progress');
    expect(d.cardHoldLabel).toBe('Deployment refused');
  });

  it('the review-due refusal says the same word everywhere now (S3\'s strip word was already "Deployment refused")', () => {
    const d = deployDisplay({ displayState: 'failed', reason: DUE_DEPLOY_LINE, action: DISPLAY_ACTIONS.OPEN_FORGE_REVIEW });
    expect([d.status, d.stripLine1, d.cardHoldLabel]).toEqual(['Deployment refused', 'Deployment refused', 'Deployment refused']);
    expect(d.cardLine.text).toBe(DUE_DEPLOY_LINE);
  });

  it('the copy table: the refusal word, and the uncertain word unchanged', () => {
    expect(COPY.deploy.states.failed).toBe('Deployment refused');
    expect(COPY.deploy.states.uncertain).toBe('Couldn’t confirm the deploy');
  });
});

describe('Q-S2b-4 — Dismiss for a refusal no ceremony shows', () => {
  it('the vocabulary: a refusal whose ceremony is closed may be dismissed; one an open ceremony shows may not', () => {
    expect(displayForAttempt(refused({ ceremonyPhase: CEREMONY_PHASES.CLOSED }))).toMatchObject({ displayState: 'failed', action: 'retry', dismiss: true });
    expect(displayForAttempt(refused({ ceremonyPhase: CEREMONY_PHASES.ERROR }))).toMatchObject({ displayState: 'failed', action: 'retry', dismiss: false });
    const due = refused({ ceremonyPhase: CEREMONY_PHASES.CLOSED, result: { kind: RESULT_KINDS.REVIEW_DUE, line: DUE_DEPLOY_LINE } });
    expect(displayForAttempt(due)).toMatchObject({ action: 'openForgeReview', dismiss: true });
  });

  it('the vocabulary: never an uncertain attempt, closed or not, checked or not', () => {
    for (const reconciliationStatus of [RECONCILIATION.NOT_CHECKED, RECONCILIATION.PENDING, RECONCILIATION.ERROR, RECONCILIATION.CLEAR]) {
      for (const ceremonyPhase of [CEREMONY_PHASES.CLOSED, CEREMONY_PHASES.ERROR]) {
        const shown = displayForAttempt({ phase: ATTEMPT_PHASES.UNCERTAIN, ceremonyPhase, reconciliationStatus, result: {} });
        expect(shown.dismiss, `${reconciliationStatus} ${ceremonyPhase}`).toBeUndefined();
      }
    }
    for (const phase of [ATTEMPT_PHASES.CREATED, ATTEMPT_PHASES.EXISTING]) {
      expect(displayForAttempt({ phase, ceremonyPhase: CEREMONY_PHASES.CLOSED, result: { battleId: 'battle-1' } }).dismiss, phase).toBeUndefined();
    }
  });

  it('the display: Dismiss beside the refusal\'s own action, on the strip and on the card', () => {
    const d = deployDisplay({ displayState: 'failed', reason: '', action: DISPLAY_ACTIONS.RETRY, dismiss: true });
    expect(d.strip.action).toEqual({ kind: 'retry', label: 'Retry' });
    expect(d.strip.dismiss).toEqual(DISMISS);
    expect(d.cardLine).toEqual({ icon: 'info', text: 'Deployment refused', action: { kind: 'retry', label: 'Retry' }, dismiss: DISMISS });
    const withheld = deployDisplay({ displayState: 'failed', reason: '', action: null, dismiss: true, retryBlock: { displayState: 'cooldown', cooldownUntil: Date.UTC(2026, 9, 14, 14, 41) } });
    expect(withheld.strip.action).toBeNull();
    expect(withheld.strip.dismiss).toEqual(DISMISS);
    const due = deployDisplay({ displayState: 'failed', reason: DUE_DEPLOY_LINE, action: DISPLAY_ACTIONS.OPEN_FORGE_REVIEW, dismiss: true });
    expect(due.strip.dismiss).toEqual(DISMISS);
    expect(due.cardLine.dismiss).toEqual(DISMISS);
  });

  it('the display: no Dismiss without the selector\'s say-so, and never on any other state, even if one were claimed', () => {
    expect(deployDisplay({ displayState: 'failed', reason: '', action: DISPLAY_ACTIONS.RETRY }).strip).not.toHaveProperty('dismiss');
    expect(deployDisplay({ displayState: 'failed', reason: '', action: DISPLAY_ACTIONS.RETRY, dismiss: 'yes' }).strip).not.toHaveProperty('dismiss');
    for (const displayState of ['uncertain', 'existing', 'confirmed', 'submitting', 'verifying', 'finishing', 'ready', 'checking', 'cooldown']) {
      const d = deployDisplay({ displayState, dismiss: true, canStart: true, cooldownUntil: Date.UTC(2026, 9, 14, 14, 41), action: displayState === 'uncertain' ? 'checkDeployment' : null });
      expect(d.strip, displayState).not.toHaveProperty('dismiss');
      if (d.cardLine) expect(d.cardLine, displayState).not.toHaveProperty('dismiss');
    }
  });

  it('the label is the copy table\'s, and the action is its own kind, never one an attempt already has', () => {
    expect(COPY.deploy.dismiss).toBe('Dismiss');
    expect(DISPLAY_ACTIONS.DISMISS).toBe('dismiss');
    const others = Object.entries(DISPLAY_ACTIONS).filter(([k]) => k !== 'DISMISS').map(([, v]) => v);
    expect(others).not.toContain('dismiss');
  });
});
