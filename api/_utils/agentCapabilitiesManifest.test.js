// api/_utils/agentCapabilitiesManifest.test.js
//
// Phase B tests. The import of ./agentCapabilitiesManifest.js (and, transitively,
// the leagueTournament constants) IS the BUILD_RULES §4 dependency-surface guard
// — it runs in the Node (vitest) env and explodes if a browser-only dep enters
// the graph. NEVER mock the module.

import { describe, it, expect } from 'vitest';
import buildCapabilitiesManifestDefault, {
  buildCapabilitiesManifest,
} from './agentCapabilitiesManifest.js';
import {
  TOURNAMENT_GAME_MODE,
  GROUP_STATUS,
  TOURNAMENT_TUNING,
} from '../../src/constants/leagueTournament.js';

const ET = '2026-06-25';
const STANDARD_BATTLE = { gameMode: 'baggerbomb' };
const TOURNAMENT_BATTLE = { gameMode: TOURNAMENT_GAME_MODE };

// Helper: a tournament group context (the non-fenced shape Phase E will assemble).
const groupCtx = (over = {}) => ({
  status: GROUP_STATUS.BATTLE,
  userPicks: [
    { flipCountToday: 2, flipCountDate: ET }, // used 2 → 3 remaining
    { flipCountToday: 0, flipCountDate: ET }, // used 0 → 5 remaining (best)
  ],
  pendingClaimCount: 1, // 3 - 1 = 2 remaining
  claimWindowOpen: true,
  etDate: ET,
  ...over,
});

const HARDCODED_FALSE = ['user_can_hedge', 'options_enabled', 'sector_hedges_enabled'];

describe('agentCapabilitiesManifest — tournament (BATTLE, levers live)', () => {
  it('grants short (flip) + claims with numeric remaining derived from the real caps', () => {
    const m = buildCapabilitiesManifest({ battle: TOURNAMENT_BATTLE, group: groupCtx() });
    expect(m.user_can_short).toBe(true);
    expect(m.user_can_make_claims).toBe(true);
    // best remaining across picks = FLIP_CAP_PER_DAY - 0 = 5
    expect(m.flipsRemaining).toBe(TOURNAMENT_TUNING.FLIP_CAP_PER_DAY);
    // CLAIM_PENDING_CAP_PER_CYCLE - 1 pending = 2
    expect(m.claimsRemaining).toBe(TOURNAMENT_TUNING.CLAIM_PENDING_CAP_PER_CYCLE - 1);
  });

  it('a stale flipCountDate resets the per-pick counter (ET-midnight reset)', () => {
    const m = buildCapabilitiesManifest({
      battle: TOURNAMENT_BATTLE,
      group: groupCtx({ userPicks: [{ flipCountToday: 5, flipCountDate: '2026-06-24' }] }),
    });
    expect(m.flipsRemaining).toBe(TOURNAMENT_TUNING.FLIP_CAP_PER_DAY); // yesterday's 5 ignored
    expect(m.user_can_short).toBe(true);
  });

  it('exhausted flips on every pick → cannot short, flipsRemaining 0', () => {
    const m = buildCapabilitiesManifest({
      battle: TOURNAMENT_BATTLE,
      group: groupCtx({
        userPicks: [
          { flipCountToday: 5, flipCountDate: ET },
          { flipCountToday: 5, flipCountDate: ET },
        ],
      }),
    });
    expect(m.flipsRemaining).toBe(0);
    expect(m.user_can_short).toBe(false);
  });

  it('closed ET claim window → cannot claim even with budget left', () => {
    const m = buildCapabilitiesManifest({
      battle: TOURNAMENT_BATTLE,
      group: groupCtx({ claimWindowOpen: false }),
    });
    expect(m.claimsRemaining).toBe(2);
    expect(m.user_can_make_claims).toBe(false);
  });

  it('claim budget exhausted → cannot claim, claimsRemaining 0', () => {
    const m = buildCapabilitiesManifest({
      battle: TOURNAMENT_BATTLE,
      group: groupCtx({ pendingClaimCount: TOURNAMENT_TUNING.CLAIM_PENDING_CAP_PER_CYCLE }),
    });
    expect(m.claimsRemaining).toBe(0);
    expect(m.user_can_make_claims).toBe(false);
  });

  it('tournament but not in BATTLE status → no user actions (still no fenced read)', () => {
    const m = buildCapabilitiesManifest({
      battle: TOURNAMENT_BATTLE,
      group: groupCtx({ status: GROUP_STATUS.FORMING ?? 'forming' }),
    });
    expect(m.user_can_short).toBe(false);
    expect(m.user_can_make_claims).toBe(false);
  });

  it('tournament gameMode but no group assembled → falls through to all-false', () => {
    const m = buildCapabilitiesManifest({ battle: TOURNAMENT_BATTLE, group: null });
    expect(m.user_can_short).toBe(false);
    expect(m.user_can_make_claims).toBe(false);
    expect(m.flipsRemaining).toBeNull();
    expect(m.claimsRemaining).toBeNull();
  });
});

describe('agentCapabilitiesManifest — standard battle (no trade lever)', () => {
  it('all user-action flags false and remaining-counts null', () => {
    const m = buildCapabilitiesManifest({ battle: STANDARD_BATTLE, group: undefined });
    expect(m.user_can_short).toBe(false);
    expect(m.user_can_make_claims).toBe(false);
    expect(m.flipsRemaining).toBeNull();
    expect(m.claimsRemaining).toBeNull();
  });

  it('handles missing args without throwing', () => {
    expect(() => buildCapabilitiesManifest()).not.toThrow();
    const m = buildCapabilitiesManifest();
    expect(m.user_can_short).toBe(false);
    expect(m.flipsRemaining).toBeNull();
  });
});

describe('agentCapabilitiesManifest — permanently-false levers (both modes)', () => {
  it('hedge / options / sector-hedges are hardcoded false in tournament AND standard', () => {
    const t = buildCapabilitiesManifest({ battle: TOURNAMENT_BATTLE, group: groupCtx() });
    const s = buildCapabilitiesManifest({ battle: STANDARD_BATTLE });
    for (const lever of HARDCODED_FALSE) {
      expect(t[lever]).toBe(false);
      expect(s[lever]).toBe(false);
    }
  });

  it('default export is the same function', () => {
    expect(buildCapabilitiesManifestDefault).toBe(buildCapabilitiesManifest);
  });
});
