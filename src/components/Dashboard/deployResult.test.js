// src/components/Dashboard/deployResult.test.js
//
// Command Center repair R1 (ruling R-R1-2) — the one mapping both Command
// dashboards apply to a deployAgent result. `existing_battle` → the ceremony's
// `existing` status; `created` and every other outcome map exactly as the
// shells' inline ternary did before R1, which is copied below verbatim as the
// parity reference.

import { describe, it, expect } from 'vitest';
import { deployResultFor, isExistingBattleResult, isOrphanedResult } from './deployResult';
import { HYPOTHESIS_NOTICES } from '../../constants/hypothesisRecords';

// A refusal that carries the server's own player line (agentDeploy.js stockAdmissionLine's fallback).
const STOCK_LINE = 'Measured scoring could not start this battle just now. Try again in a minute.';

// CommandDashboard.jsx / CommandDashboardDesktop.jsx at main 078fe895, the
// setDeployResult argument, verbatim.
const PRE_R1_MAPPING = (result) => (result?.success
  ? { status: 'success', agentBattleId: result.agentBattleId }
  : {
      status: 'error', error: result?.error, details: result?.details,
      httpStatus: result?.httpStatus ?? null,
      postIssued: result?.postIssued === true,
      battleId: result?.battleId ?? null,
    });

// One of each result agentDeploy.js returns (agentDeploy.outcomes.test.js pins them).
const RESULTS = {
  created: { outcome: 'created', success: true, agentBattleId: 'battle-new' },
  'refused (no agent)': { outcome: 'refused', success: false, postIssued: false, error: 'no-agent' },
  'refused (auth required)': { outcome: 'refused', success: false, postIssued: false, error: 'auth-required' },
  // Pilot P1c (ruling E1): the review-due 409 is no longer sent or typed by the service; a refusal with the server's line is the stock admission's.
  'refused (stock admission)': {
    outcome: 'refused', success: false, status: 503, postIssued: true, httpStatus: 503,
    error: 'Stock admission unavailable', details: STOCK_LINE, errorPhase: undefined,
  },
  'refused (cooldown)': { outcome: 'refused', reason: 'cooldown', success: false, status: 429, postIssued: true, httpStatus: 429, error: 'Please wait 2 minutes between deploys' },
  'uncertain (network)': { outcome: 'uncertain', success: false, postIssued: true, httpStatus: null, error: 'deploy_network', details: 'Failed to fetch' },
  'uncertain (500)': { outcome: 'uncertain', success: false, status: 500, postIssued: true, httpStatus: 500, error: 'Failed to generate portfolio', details: 'x', errorPhase: 'post_decision' },
  'uncertain (malformed 200)': { outcome: 'uncertain', success: false, status: 200, postIssued: true, httpStatus: 200, battleId: null, error: 'deploy_no_battle_id', details: 'd' },
  handoff_failed: { outcome: 'handoff_failed', success: false, status: 200, postIssued: true, httpStatus: 200, battleId: 'battle-new', error: 'deploy_handoff', details: 'boom' },
  'orphaned (before the POST)': { outcome: 'orphaned', success: false, postIssued: false },
  'orphaned (after the POST)': { outcome: 'orphaned', success: false, postIssued: true },
  'a shell catch': { success: false, error: 'threw', postIssued: false, httpStatus: null },
  'the shell default': { success: false },
};

describe('deployResultFor: created and every other outcome map exactly as before R1', () => {
  it.each(Object.entries(RESULTS))('%s → the pre-R1 mapping, field for field', (_label, result) => {
    expect(deployResultFor(result)).toEqual(PRE_R1_MAPPING(result));
  });

  it('created → success with the real id', () => {
    expect(deployResultFor(RESULTS.created)).toEqual({ status: 'success', agentBattleId: 'battle-new' });
  });

  it('a refusal keeps the server\'s line in details', () => {
    expect(deployResultFor(RESULTS['refused (stock admission)'])).toEqual({
      status: 'error', error: 'Stock admission unavailable', details: STOCK_LINE, httpStatus: 503, postIssued: true, battleId: null,
    });
  });
});

describe('Pilot P1c (founder ruling E1) — a created deploy that carried nothing because the idea is due', () => {
  it('created with hypothesisNotice review_due → success, the notice beside the real id (the ceremony\'s success screen reads it)', () => {
    expect(deployResultFor({ ...RESULTS.created, hypothesisNotice: HYPOTHESIS_NOTICES.reviewDue }))
      .toEqual({ status: 'success', agentBattleId: 'battle-new', hypothesisNotice: 'review_due' });
  });
  it('any other value, or none, → exactly the created mapping; a non-created result never carries it', () => {
    for (const v of [undefined, null, 'other', true]) {
      expect(deployResultFor({ ...RESULTS.created, hypothesisNotice: v })).toEqual({ status: 'success', agentBattleId: 'battle-new' });
    }
    const failed = deployResultFor({ ...RESULTS['uncertain (500)'], hypothesisNotice: 'review_due' });
    expect('hypothesisNotice' in failed).toBe(false);
    expect('hypothesisNotice' in deployResultFor({ ...RESULTS['refused (cooldown)'], hypothesisNotice: 'review_due' })).toBe(false);
  });
});

describe('isOrphanedResult: the shells close the ceremony on it (founder ruling Q2)', () => {
  it('true only for the orphaned outcome', () => {
    expect(isOrphanedResult(RESULTS['orphaned (before the POST)'])).toBe(true);
    expect(isOrphanedResult(RESULTS['orphaned (after the POST)'])).toBe(true);
    for (const [label, r] of Object.entries(RESULTS)) {
      if (!label.startsWith('orphaned')) expect(isOrphanedResult(r), label).toBe(false);
    }
    expect(isOrphanedResult({ outcome: 'existing_battle' })).toBe(false);
    expect(isOrphanedResult({ success: false, postIssued: true })).toBe(false);
    expect(isOrphanedResult(null)).toBe(false);
  });
});

describe('deployResultFor: the existing battle is its own status (R-R1-2)', () => {
  const EXISTING = { outcome: 'existing_battle', success: false, existingBattleId: 'battle-running', postIssued: true, httpStatus: 200 };

  it('existing_battle → existing, with the server\'s id, its status and postIssued', () => {
    expect(deployResultFor(EXISTING)).toEqual({ status: 'existing', existingBattleId: 'battle-running', httpStatus: 200, postIssued: true });
  });

  it('never success and never error: it is not a creation, and nothing failed', () => {
    const r = deployResultFor(EXISTING);
    expect(r.status).not.toBe('success');
    expect(r.status).not.toBe('error');
    expect(r).not.toHaveProperty('agentBattleId');
    expect(r).not.toHaveProperty('battleId');
  });

  it('isExistingBattleResult reads only the typed outcome', () => {
    expect(isExistingBattleResult(EXISTING)).toBe(true);
    for (const r of Object.values(RESULTS)) expect(isExistingBattleResult(r)).toBe(false);
    expect(isExistingBattleResult({ success: true, existingBattleId: 'battle-running' })).toBe(false);
    expect(isExistingBattleResult(null)).toBe(false);
  });
});
