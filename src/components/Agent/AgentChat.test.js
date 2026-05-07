import { describe, it, expect, vi } from 'vitest';

// Neutralize module-load side effects so we can import the named
// `filterUnansweredProposals` export from AgentChat.jsx without booting
// Firebase. Mirrors SectorRail.test.js's mock pattern.
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
}));
vi.mock('../../firebase/config', () => ({
  auth: {},
  db: {},
  default: {},
}));
vi.mock('../../services/agentService', () => ({
  submitDailyGrades: vi.fn(),
}));

import { filterUnansweredProposals } from './AgentChat';

describe('filterUnansweredProposals', () => {
  it('Test 1: includes proposals with resolution === "lapsed"', () => {
    const result = filterUnansweredProposals([
      { resolution: 'lapsed', symbolOut: 'AAPL', symbolIn: 'MSFT' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].symbolOut).toBe('AAPL');
    expect(result[0].symbolIn).toBe('MSFT');
  });

  it('Test 2: excludes proposals with resolution === "vetoed" (a veto IS a response)', () => {
    const result = filterUnansweredProposals([
      { resolution: 'vetoed', symbolOut: 'NVDA', symbolIn: 'AMD' },
    ]);
    expect(result).toHaveLength(0);
  });

  it('Test 3: excludes proposals with resolution === "auto_executed"', () => {
    const result = filterUnansweredProposals([
      { resolution: 'auto_executed', symbolOut: 'TSLA', symbolIn: 'F' },
    ]);
    expect(result).toHaveLength(0);
  });

  it('Test 4: excludes proposals with no resolution (still pending)', () => {
    const result = filterUnansweredProposals([
      { symbolOut: 'GOOG', symbolIn: 'META' },
    ]);
    expect(result).toHaveLength(0);
  });

  it('Test 5: regression guard — entry with status:"expired" and resolution:"auto_executed" is excluded', () => {
    // The original buggy code matched on `status === 'expired'` and would have
    // included this entry. The fixed filter checks only `resolution`, sees
    // 'auto_executed', and correctly excludes it.
    const result = filterUnansweredProposals([
      {
        status: 'expired',
        resolution: 'auto_executed',
        symbolOut: 'COIN',
        symbolIn: 'HOOD',
      },
    ]);
    expect(result).toHaveLength(0);
  });

  it('Test 6: mixed dataset returns only the lapsed entry', () => {
    const result = filterUnansweredProposals([
      { resolution: 'lapsed',        symbolOut: 'AAPL', symbolIn: 'MSFT' },
      { resolution: 'vetoed',        symbolOut: 'NVDA', symbolIn: 'AMD'  },
      { resolution: 'auto_executed', symbolOut: 'TSLA', symbolIn: 'F'    },
      {                              symbolOut: 'GOOG', symbolIn: 'META' },
      null,
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].symbolOut).toBe('AAPL');
    expect(result[0].symbolIn).toBe('MSFT');
    expect(result[0].resolution).toBe('lapsed');
  });

  it('Test 7: non-array input returns empty array', () => {
    expect(filterUnansweredProposals(undefined)).toEqual([]);
    expect(filterUnansweredProposals(null)).toEqual([]);
    expect(filterUnansweredProposals('not an array')).toEqual([]);
    expect(filterUnansweredProposals({})).toEqual([]);
  });
});
