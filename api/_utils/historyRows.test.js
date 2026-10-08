// api/_utils/historyRows.test.js — F3 (integrity build): the base of every history row.

import { describe, it, expect } from 'vitest';
import { HISTORY_OUTCOME_KEYS, LAUNCH_GUARD_RECORD_KEYS, proposalHistoryBase, launchGuardRecord, meetingHistoryBase } from './historyRows.js';

const PLANTED = Object.fromEntries(HISTORY_OUTCOME_KEYS.map((k) => [k, `planted-${k}`]));

describe('HISTORY_OUTCOME_KEYS', () => {
  it('names SV3\'s three and every other outcome field the server writes or a reader treats as a result', () => {
    expect(HISTORY_OUTCOME_KEYS).toEqual(expect.arrayContaining([
      'executionFailed', 'executionRefusal', 'verification', 'legRefusals', 'systemNote',
      'scoreAtResolution', 'scoreAtVeto', 'vetoedAtPrice', 'vetoedAtTimestamp', 'counterfactualPoints', 'outcomePoints', 'lockedPoints',
    ]));
    expect(Object.isFrozen(HISTORY_OUTCOME_KEYS)).toBe(true);
  });
});

describe('proposalHistoryBase', () => {
  it('drops every outcome field and keeps the record\'s own fields in their order', () => {
    const rec = { proposalId: 'p', symbolOut: 'KO', ...PLANTED, symbolIn: 'AMD', resolution: 'approved', resolvedAt: 't', resolvedBy: 'u', userReason: 'why' };
    const out = proposalHistoryBase(rec);
    expect(Object.keys(out)).toEqual(['proposalId', 'symbolOut', 'symbolIn', 'resolution', 'resolvedAt', 'resolvedBy', 'userReason']);
    expect(rec.executionFailed).toBe('planted-executionFailed'); // the input is not mutated
  });

  it('a record without outcome fields comes back equal', () => {
    const rec = { proposalId: 'p', snapshot: null, evaluationMetadata: { a: 1 } };
    expect(proposalHistoryBase(rec)).toEqual(rec);
  });

  it('a record that is not a plain object contributes nothing — a spread string never becomes one field per character (review I1-3)', () => {
    for (const v of [null, undefined, 5, 'x', 'A'.repeat(30000), ['a', 'b'], true]) expect(proposalHistoryBase(v)).toEqual({});
    expect(Object.keys({ ...proposalHistoryBase('A'.repeat(30000)), resolution: 'auto_executed' })).toEqual(['resolution']);
  });
});

describe('meetingHistoryBase', () => {
  it('drops outcome fields on the meeting AND on each leg', () => {
    const out = meetingHistoryBase({ id: 'gpm', status: 'approved', ...PLANTED, suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'r', swappedInAt: null, ...PLANTED }] });
    expect(out).toEqual({ id: 'gpm', status: 'approved', suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'r', swappedInAt: null }] });
  });

  it('a clean meeting comes back equal (key order kept); odd shapes pass through', () => {
    const m = { id: 'gpm', diagnosis: 'd', suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'r' }], status: 'rejected' };
    expect(JSON.stringify(meetingHistoryBase(m))).toBe(JSON.stringify(m));
    expect(meetingHistoryBase({ id: 'x', suggestedSwaps: 3 })).toEqual({ id: 'x', suggestedSwaps: 3 });
    expect(meetingHistoryBase({ id: 'x', suggestedSwaps: ['leg-as-text', null] })).toEqual({ id: 'x', suggestedSwaps: ['leg-as-text', null] });
    for (const v of [null, 'M'.repeat(1000), [1], 7]) expect(meetingHistoryBase(v)).toEqual({});
  });
});

describe('launchGuardRecord — the launch-guard row keeps only what the proposal named (review I1-3 / I1-4)', () => {
  it('the named identity strings, capped, in a fixed order — never ids, metadata, the slot, numbers, text or outcomes', () => {
    const planted = {
      evaluationMetadata: { evaluationId: 'eval_003', lockedPoints: 9999 }, evalId: 'eval_003', snapshot: { rsi: 99 }, tier: 'star', slotIndex: 0,
      rationale: 'R'.repeat(900000), conviction: 99, scoreAtProposal: 9999, ...PLANTED,
      expiresAt: '2026-09-09T23:00:00.000Z', mode: 'copilot', symbolIn: 'AMD', symbolOut: 'KO', proposalId: 'p'.repeat(500), createdAt: 7,
    };
    const out = launchGuardRecord(planted);
    expect(Object.keys(out)).toEqual(LAUNCH_GUARD_RECORD_KEYS);
    expect(out).toEqual({ proposalId: 'p'.repeat(64), symbolOut: 'KO', symbolIn: 'AMD', mode: 'copilot', createdAt: null, expiresAt: '2026-09-09T23:00:00.000Z' });
    expect(JSON.stringify(out).length).toBeLessThan(400);
  });

  it('absent keys stay absent; a non-object contributes nothing', () => {
    expect(launchGuardRecord({ symbolOut: 'KO' })).toEqual({ symbolOut: 'KO' });
    for (const v of [null, 'A'.repeat(1000), ['a'], 3]) expect(launchGuardRecord(v)).toEqual({});
  });
});

// ── I5 (mutation lens) proposed rows ─────────────────────────────────────────
describe('I5 — mutation-lens rows', () => {
  it('I5-E: the outcome list is pinned whole; a planted closedTrade never rides on a proposal or meeting row', () => {
    expect([...HISTORY_OUTCOME_KEYS].sort()).toEqual([
      'executionFailed', 'executionRefusal', 'verification', 'legRefusals', 'systemNote', 'scoreAtResolution', 'scoreAtVeto',
      'vetoedAtPrice', 'vetoedAtTimestamp', 'counterfactualPoints', 'outcomePoints', 'lockedPoints', 'closedTrade',
      // Integrity follow-up 2: the meeting's held legs (Part A) and the retry-safe markers (Part D).
      'heldLegs', 'heldLegCount', 'executionOutcome', 'executionLanded', 'refusalReason',
    ].sort());
    expect(proposalHistoryBase({ proposalId: 'p', closedTrade: { lockedPoints: 9999 } })).toEqual({ proposalId: 'p' });
    expect(meetingHistoryBase({ id: 'm', suggestedSwaps: [{ symbolOut: 'KO', closedTrade: { lockedPoints: 9999 } }] })).toEqual({ id: 'm', suggestedSwaps: [{ symbolOut: 'KO' }] });
  });

  it('follow-up 2: a planted held-leg record or retry-safe marker never rides on a meeting row, its legs or a proposal row', () => {
    const planted = { heldLegs: [{ reason: 'planted' }], heldLegCount: 9999, executionOutcome: 'unknown', executionLanded: 'confirmed_after_error', refusalReason: 'planted' };
    expect(meetingHistoryBase({ id: 'm', ...planted, suggestedSwaps: [{ symbolOut: 'KO', ...planted }] })).toEqual({ id: 'm', suggestedSwaps: [{ symbolOut: 'KO' }] });
    expect(proposalHistoryBase({ proposalId: 'p', ...planted })).toEqual({ proposalId: 'p' });
  });
});
