// Session-4.1 — episode-geometry unit guard. The Addendum §6.1/§6.2 thresholds are in ATR; the
// engine stores them as multiples of the distanceUnit u (u = atrMultiple·ATR unclamped). These
// tests assert the ATR EQUIVALENT of each threshold, so a future redefinition of u (a change to
// atrMultiple) or a revert to the S4 4×-too-tight miscalibration is caught immediately. They also
// assert the role-flip threshold is DECOUPLED from the episode zone (S4.1 §2b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import CONFIG from '../config.js';
import { episodeZone } from '../lib/events.js';

const EP = CONFIG.episode;
const ATR_MULT = CONFIG.levels.geometry.distanceUnit.atrMultiple; // u = clamp(atrMult·ATR, …); 0.25
const ROLE = CONFIG.levels.lineage.roleMachine;

test('episode thresholds have the Addendum §6.1/§6.2 ATR equivalents (0.25 / 1.0 / 0.5 ATR)', () => {
  // ATR-equivalent of a threshold stored as thresholdU·u = thresholdU · atrMultiple · ATR (unclamped).
  assert.equal(EP.zoneHalfWidthU * ATR_MULT, 0.25, 'zone half-width = 0.25·ATR (Addendum §6.1)');
  assert.equal(EP.closeSeparationU * ATR_MULT, 1.0, 'episode-close separation = 1.0·ATR (Addendum §6.1)');
  assert.equal(EP.crossLevelDedup.dedupIntersectU * ATR_MULT, 0.5, 'cross-level dedup radius = 0.5·ATR (Addendum §6.2)');
});

test('episode thresholds are the corrected (S4.1) u-multiples, not the S4 4×-too-tight values', () => {
  assert.equal(EP.zoneHalfWidthU, 1.0, 'S4.1: 1.0·u (was 0.25·u)');
  assert.equal(EP.closeSeparationU, 4.0, 'S4.1: 4.0·u (was 1.0·u)');
  assert.equal(EP.crossLevelDedup.dedupIntersectU, 2.0, 'S4.1: 2.0·u (was 0.5·u)');
});

test('episodeZone reads the config half-width and scales with u (no hardcoded literal)', () => {
  const z1 = episodeZone(100, 1);
  assert.ok(Math.abs(z1.zoneLow - (100 - EP.zoneHalfWidthU)) < 1e-12 && Math.abs(z1.zoneHigh - (100 + EP.zoneHalfWidthU)) < 1e-12,
    'zone = anchor ± zoneHalfWidthU·u at u=1');
  const z2 = episodeZone(100, 2);
  assert.ok(Math.abs(z2.zoneLow - (100 - 2 * EP.zoneHalfWidthU)) < 1e-12 && Math.abs(z2.zoneHigh - (100 + 2 * EP.zoneHalfWidthU)) < 1e-12,
    'the half-width scales with u — proves the constant is read, not hardcoded');
});

test('the role-flip threshold (0.5·u) is DECOUPLED from the episode zone (S4.1 §2b)', () => {
  const flipThresholdU = ROLE.zoneHalfWidthUnits + ROLE.flipBeyondOppositeBoundaryUnits;
  assert.equal(flipThresholdU, 0.5, 'role-flip threshold pinned at 0.5·u (measured & accepted at S3.5)');
  assert.notEqual(ROLE.zoneHalfWidthUnits, EP.zoneHalfWidthU,
    'the role zone half-width (0.25·u) must NOT track the episode zone half-width (1.0·u) — decoupled');
});
