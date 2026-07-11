// Test #1 — Cross-grain invariant (A1 / parent §4.3): raw daily close ↔ 5m closing-auction
// print, same session, within 0.1%. ≥20 sessions per probe symbol, incl. the NVDA split window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import CONFIG from '../config.js';
import { crossGrainCheck } from '../lib/normalize.js';
import { PROBE, loadSessions, loadDaily, byDateOf } from './_helpers.js';

const TOL = CONFIG.adjustment.crossGrainInvariant.tolerancePct; // 0.1

for (const sym of PROBE) {
  test(`cross-grain: ${sym} raw daily close ↔ 5m auction print ≤ ${TOL}% (≥20 sessions)`, () => {
    const rows = crossGrainCheck(loadSessions(sym), byDateOf(loadDaily(sym)));
    assert.ok(rows.length >= 20, `${sym}: only ${rows.length} auctioned sessions (need ≥20)`);
    const fails = rows.filter((r) => !r.pass);
    const worst = fails.sort((a, b) => b.diffPct - a.diffPct)[0];
    assert.equal(fails.length, 0, `${sym}: ${fails.length}/${rows.length} exceed ${TOL}%${worst ? ` (worst ${worst.date} ${worst.diffPct.toFixed(4)}%)` : ''}`);
  });
}

test('cross-grain: NVDA split window (2024-06-05..14) is included and passes', () => {
  const sessions = loadSessions('NVDA').filter((s) => s.etDate >= '2024-06-05' && s.etDate <= '2024-06-14');
  const rows = crossGrainCheck(sessions, byDateOf(loadDaily('NVDA')));
  assert.ok(rows.length >= 6, `NVDA split window: ${rows.length} auctioned sessions checked`);
  assert.ok(rows.every((r) => r.pass), 'NVDA split window has cross-grain failures');
});
