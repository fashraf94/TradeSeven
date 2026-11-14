// src/data/practiceFieldSectorBridge.js
//
// THE SECTOR-VOCABULARY BRIDGE (Phase 0 audit Q6: the house universe says "Healthcare", the Mandate says "Health
// Care", the browser keeps a third list). ONE versioned mapping from the house universe's sector names
// (api/_utils/rankingConfig.js STOCK_UNIVERSE[*].name) to the Mandate's sector vocabulary
// (api/_utils/mandateCandidateUniverse.js). DATA ONLY, ZERO IMPORTS. Neither source list is changed.
//
// An idea book classifies EVERY stock through this bridge and nothing else: the admission-time sector cap, the
// sector stamped on a position at entry and a sector fund's `represents` all speak the Mandate vocabulary, so
// existing exposure and a new idea are always summed in one vocabulary. practiceFieldSectorBridge.test.js binds
// every key to the house universe and every value to the Mandate's list, in both directions.

export const PRACTICE_FIELD_SECTOR_BRIDGE_VERSION = 1;

export const PRACTICE_FIELD_SECTOR_BRIDGE = Object.freeze({
  'Technology': 'Technology',
  'Healthcare': 'Health Care',
  'Financials': 'Financials',
  'Energy': 'Energy',
  'Consumer Discretionary': 'Consumer Discretionary',
  'Consumer Staples': 'Consumer Staples',
  'Industrials': 'Industrials',
  'Materials': 'Materials',
  'Utilities': 'Utilities',
  'Real Estate': 'Real Estate',
  'Communication Services': 'Communication Services',
});
