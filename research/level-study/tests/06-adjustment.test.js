// Test #6 — Split-factor application (A1): around the NVDA 10-for-1 split (eff. 2024-06-10), the
// adjusted 5m auction print matches the daily adjusted basis within 0.1%, and the RAW 5m jumps
// ~10× across the split boundary while the ADJUSTED series stays continuous.
// FIXTURE-BASED: runs off the committed NVDA split + daily fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import CONFIG from '../config.js';
import { normalizeDaily, normalizeFiveMin, adjustmentCheck } from '../lib/normalize.js';
import { loadFixture } from './_helpers.js';

const TOL = CONFIG.adjustment.crossGrainInvariant.tolerancePct; // 0.1
const { byDate } = normalizeDaily(loadFixture('daily/NVDA_eod_2018-01-01_2026-07-10.json'));
const { sessions } = normalizeFiveMin(loadFixture('split-adjacent/NVDA_5m_2024-06-05_2024-06-14.json'), byDate, null);

test(`adjustment: NVDA split-window adjusted 5m auction ≈ daily adjusted_close ≤ ${TOL}%`, () => {
  const rows = adjustmentCheck(sessions, byDate);
  assert.ok(rows.length >= 6, `split-window auctioned sessions: ${rows.length}`);
  const fails = rows.filter((r) => !r.pass);
  assert.equal(fails.length, 0, `adjustment failures: ${fails.map((f) => `${f.date} ${f.diffPct.toFixed(4)}%`).join(', ')}`);
});

test('adjustment: RAW auction jumps ~10× across the split; ADJUSTED stays continuous', () => {
  const pre = sessions.find((s) => s.etDate === '2024-06-07');   // last pre-split session
  const post = sessions.find((s) => s.etDate === '2024-06-10');  // first post-split session
  assert.ok(pre && post && pre.auctionClose && post.auctionClose, 'missing split-boundary sessions');

  const rawRatio = pre.auctionClose / post.auctionClose;         // ~1208.88 / ~121.79 ≈ 9.9
  assert.ok(rawRatio > 9 && rawRatio < 11, `raw ratio ${rawRatio.toFixed(3)} (expected ~10× — split not visible in raw)`);

  const adjRatio = pre.auctionCloseAdj / post.auctionCloseAdj;   // both on today's basis ≈ 1
  assert.ok(adjRatio > 0.9 && adjRatio < 1.15, `adjusted ratio ${adjRatio.toFixed(4)} (expected ~1 — factor did not neutralize the split)`);
});
