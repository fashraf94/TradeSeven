// api/_utils/masterySettlement.seam.test.js
//
// §9 seam: while masteryConfig/backfillPending exists, live paying receipts
// stamp levelProvisional: true (the Training Report suppresses their level
// ceremony permanently); with the marker absent the key is ABSENT — the
// steady-state receipt shape is byte-identical to pre-P4.

import { describe, it, expect } from 'vitest';
import { runAwardTransaction } from './masterySettlement.js';
import { makeMockDb } from './__fixtures__/masteryMockDb.js';

const NOW = '2026-07-21T20:00:00.000Z';
const BATTLE = {
  ownerId: 'u1',
  agentId: 'agent-1',
  isCpu: false,
  status: 'completed',
  completedAt: NOW,
  gameMode: 'baggerbomb_agent',
  createdAt: '2026-07-21T13:00:00.000Z',
  agentContext: { archetype: 'guardian' },
  masteryEligibility: { eligible: true, epochId: 1, stampedAt: NOW },
  masterySlot: { date: '2026-07-21', rank: 1, rateBand: 1.0, assignedAt: NOW },
  scoreState: { currentScore: 12.5, opponentScore: 3.1 },
};

async function award(withMarker) {
  const db = makeMockDb({
    'agentBattles/b1': BATTLE,
    ...(withMarker ? { 'masteryConfig/backfillPending': { at: NOW } } : {}),
  });
  const out = await runAwardTransaction(db, 'b1', { nowIso: NOW });
  return { out, receipt: db.__dump('agentBattles/b1').masteryAward };
}

describe('§9 seam marker → levelProvisional', () => {
  it('marker present: the paying receipt stamps levelProvisional: true', async () => {
    const { out, receipt } = await award(true);
    expect(out.outcome).toBe('awarded');
    expect(receipt.levelProvisional).toBe(true);
  });

  it('marker absent: the key is ABSENT (steady-state receipt shape unchanged)', async () => {
    const { out, receipt } = await award(false);
    expect(out.outcome).toBe('awarded');
    expect('levelProvisional' in receipt).toBe(false);
  });
});
