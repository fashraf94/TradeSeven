// api/_utils/agentScoring.consistency.test.js
//
// Tier 0 Item 4 — drift guard for the canonical/server duplication.
//
// detectRedZone and isSwapLocked are duplicated from src/utils/baggerBombUtils.js
// into api/_utils/agentScoring.js because server code (api/) cannot import from
// src/ in the Vercel serverless build. This test imports BOTH copies and asserts
// they produce identical output across a battery of inputs.
//
// IF YOU MODIFY EITHER COPY: update the other in lockstep, then run this test.
// IF THIS TEST FAILS: the duplication has drifted. Do not skip or weaken it —
// drift between the agent's view (server) and the user's view (UI) creates
// silent disagreements in the Voice Layer.

import { describe, it, expect } from 'vitest';
import {
  detectRedZone as canonicalDetectRedZone,
  isSwapLocked as canonicalIsSwapLocked,
} from '../../src/utils/baggerBombUtils.js';
import {
  detectRedZone as serverDetectRedZone,
  isSwapLocked as serverIsSwapLocked,
} from './agentScoring.js';

// ==================== detectRedZone ====================

const RED_ZONE_CASES = [
  // [label, currentMultiplier, existingBadges]
  ['outside zone, positive, no badges', 0.5, []],
  ['inside upside red zone, no badges', 0.85, []],
  ['inside doubleBagger zone with bagger earned', 1.20, ['bagger']],
  ['inside tenBagger zone with bagger+doubleBagger earned', 1.85, ['bagger', 'doubleBagger']],
  ['outside zone, negative, no badges', -0.5, []],
  ['inside downside zone, no badges', -0.85, []],
  ['inside meltdown zone with bust+crash earned', -1.85, ['bust', 'crash']],
  ['exactly at bagger threshold (1.0), no badges', 1.0, []],
  ['just past bagger (1.01), bagger already earned', 1.01, ['bagger']],
  ['exactly zero multiplier', 0, []],
  ['exactly at upside zone start (0.75)', 0.75, []],
  ['just below upside zone (0.74)', 0.74, []],
  ['exactly at downside zone start (-0.75)', -0.75, []],
  ['inside upside zone with all positive badges earned', 0.85, ['bagger', 'doubleBagger', 'tenBagger']],
  ['large positive multiplier (3.0), all badges', 3.0, ['bagger', 'doubleBagger', 'tenBagger']],
];

describe('detectRedZone — canonical vs server consistency', () => {
  RED_ZONE_CASES.forEach(([label, mult, badges]) => {
    it(label, () => {
      const canonical = canonicalDetectRedZone(mult, badges);
      const server = serverDetectRedZone(mult, badges);
      expect(server).toEqual(canonical);
    });
  });
});

// ==================== isSwapLocked ====================

const SWAP_LOCK_CASES = [
  // [label, currentMultiplier, baseATR]
  ['locked positive (close to bagger)', 0.85, 2.5],
  ['locked negative (close to bust)', -0.85, 2.5],
  ['not locked, positive far from bagger', 0.5, 2.5],
  ['not locked, negative far from bust', -0.5, 2.5],
  ['baseATR 0 returns unlocked', 0.85, 0],
  ['baseATR null returns unlocked', 0.85, null],
  ['baseATR negative returns unlocked', 0.85, -1],
  ['large positive multiplier past tenBagger', 3.0, 2.5],
  ['large negative multiplier past meltdown', -3.0, 2.5],
  ['locked at small baseATR', 0.99, 1.0],
  ['locked positive between bagger and doubleBagger', 1.45, 2.5],
];

describe('isSwapLocked — canonical vs server consistency', () => {
  SWAP_LOCK_CASES.forEach(([label, mult, atr]) => {
    it(label, () => {
      const canonical = canonicalIsSwapLocked(mult, atr);
      const server = serverIsSwapLocked(mult, atr);
      expect(server).toEqual(canonical);
    });
  });
});
