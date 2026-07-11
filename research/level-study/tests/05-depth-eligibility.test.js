// Test #5 — Depth-eligibility utility (R2): given any symbol list, assert ≥550 pre-study daily
// sessions and output PASS/FAIL. This is the tool the founder's universe freeze is swept with.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { depthEligibility, depthEligibilitySweep } from '../lib/depth-eligibility.js';
import { PROBE, loadDaily } from './_helpers.js';

test('depth eligibility (R2): all 14 probe symbols PASS ≥550 pre-study sessions', () => {
  const sweep = depthEligibilitySweep(PROBE.map((sym) => ({ symbol: sym, dailyBars: loadDaily(sym) })));
  for (const r of sweep) {
    console.log(`   ${r.verdict === 'PASS' ? 'PASS' : 'FAIL'} ${r.symbol.padEnd(5)} ${String(r.preStudySessions).padStart(5)} pre-study  margin ${r.margin >= 0 ? '+' : ''}${r.margin}  (first ${r.firstDailyBar})`);
  }
  const fails = sweep.filter((r) => r.verdict !== 'PASS');
  assert.equal(fails.length, 0, `FAIL: ${fails.map((r) => `${r.symbol}(${r.preStudySessions})`).join(', ')}`);
});

test('depth eligibility utility correctly FAILS a short-history symbol', () => {
  const dates = [];
  for (let i = 0; i < 100; i++) {
    const d = new Date(Date.UTC(2023, 0, 2));
    d.setUTCDate(d.getUTCDate() + i);
    dates.push({ date: d.toISOString().slice(0, 10) }); // 100 sessions, all before studyStart
  }
  const r = depthEligibility('FAKE_SHORT', dates);
  assert.equal(r.verdict, 'FAIL', `expected FAIL, got ${r.verdict} (${r.preStudySessions} pre-study)`);
  assert.ok(r.margin < 0);
});
