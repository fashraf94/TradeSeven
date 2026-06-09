// src/components/Forge/Watchlist/columnHelp.test.js
//
// Pure-data guard for the Column Help map (repo convention: cohortRowsView.test.js,
// filterWatchlistsByStatus.test.js). Ensures every data column has help text and
// the three forward columns keep the "analyst consensus, not our forecast" framing.

import { describe, it, expect } from 'vitest';
import { COLUMN_HELP } from './columnHelp';

// The full set of sortable data-column keys (T1/T2/T3) — symbol/sectorName are
// intentionally non-interactive and excluded from the help map.
const DATA_COLUMN_KEYS = [
  'return1M', 'return3M', 'momentumScore', 'sma200_position', 'atrPercentile',
  'trailingPE', 'debtToEquity', 'revenueGrowthYOY', 'profitMarginTTM', 'marketCap',
  'consensusGrowthNextYear', 'emsPercentile', 'estimateSpread',
];

const STREET_KEYS = ['consensusGrowthNextYear', 'emsPercentile', 'estimateSpread'];

describe('COLUMN_HELP', () => {
  it('has a non-empty label + description for every data column', () => {
    for (const key of DATA_COLUMN_KEYS) {
      const entry = COLUMN_HELP[key];
      expect(entry, `missing help for "${key}"`).toBeDefined();
      expect(typeof entry.label).toBe('string');
      expect(entry.label.trim().length).toBeGreaterThan(0);
      expect(typeof entry.description).toBe('string');
      expect(entry.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('does not include the self-explanatory symbol/sector columns', () => {
    expect(COLUMN_HELP).not.toHaveProperty('symbol');
    expect(COLUMN_HELP).not.toHaveProperty('sectorName');
  });

  it('frames the Street consensus columns as analyst estimates (honesty line)', () => {
    for (const key of STREET_KEYS) {
      expect(COLUMN_HELP[key].label).toMatch(/Street/);
      expect(COLUMN_HELP[key].description.toLowerCase()).toMatch(/analyst|street|consensus/);
    }
    // The consensus-growth column must explicitly disclaim it's not our prediction.
    expect(COLUMN_HELP.consensusGrowthNextYear.description.toLowerCase()).toContain('not a prediction');
  });

  it('reflects the corrected field semantics (quarterly rev growth, net margin)', () => {
    expect(COLUMN_HELP.revenueGrowthYOY.description.toLowerCase()).toContain('quarter');
    expect(COLUMN_HELP.profitMarginTTM.description.toLowerCase()).toContain('net');
  });
});
