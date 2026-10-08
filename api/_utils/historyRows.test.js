// api/_utils/historyRows.test.js — F3 (integrity build): the base of every history row.

import { describe, it, expect } from 'vitest';
import { HISTORY_OUTCOME_KEYS, proposalHistoryBase, meetingHistoryBase } from './historyRows.js';

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

  it('a record without outcome fields comes back equal; a non-object comes back as it is', () => {
    const rec = { proposalId: 'p', snapshot: null, evaluationMetadata: { a: 1 } };
    expect(proposalHistoryBase(rec)).toEqual(rec);
    for (const v of [null, undefined, 5, 'x']) expect(proposalHistoryBase(v)).toBe(v);
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
    expect(meetingHistoryBase(null)).toBeNull();
  });
});
