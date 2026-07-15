// Test #3 — Hourly alignment + DST proof (parent §4.4; S2 prompt §4). Self-built 9:30-anchored
// hourly bars: first opens 09:30 ET, last closes 16:00 ET — proven on BOTH a June (EDT) and a
// January (EST) sample, where the same ET session maps to different UTC windows.
// FIXTURE-BASED: runs off committed fixtures only (no fetched data required).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDaily, normalizeFiveMin } from '../lib/normalize.js';
import { etParts } from '../lib/session-time.js';
import { loadFixture } from './_helpers.js';

const { byDate } = normalizeDaily(loadFixture('daily/AAPL_eod_2018-01-01_2026-07-10.json'));

function fullDaySessions(fixtureRel) {
  const { sessions } = normalizeFiveMin(loadFixture(fixtureRel), byDate, null);
  return sessions.filter((s) => s.isFullDay);
}

function assertAnchoring(sessions, expectedTz) {
  assert.ok(sessions.length >= 15, `${expectedTz}: only ${sessions.length} full-day sessions`);
  for (const s of sessions) {
    assert.equal(s.tzAbbrev, expectedTz, `${s.etDate}: tz ${s.tzAbbrev}, expected ${expectedTz}`);
    assert.equal(s.hourly.length, 7, `${s.etDate}: ${s.hourly.length} hourly bars (expected 7)`);
    assert.equal(s.hourly[0].openEtMinutes, 570, `${s.etDate}: first hourly opens at ${s.hourly[0].openEtMinutes} (expected 570 = 09:30 ET)`);
    assert.equal(s.hourly[s.hourly.length - 1].closeEtMinutes, 960, `${s.etDate}: last hourly closes at ${s.hourly[s.hourly.length - 1].closeEtMinutes} (expected 960 = 16:00 ET)`);
  }
}

test('hourly alignment — June (EDT): 9:30 → 16:00 ET, 7 bars/session', () => {
  assertAnchoring(fullDaySessions('sample-5m/AAPL_5m_2026-06.json'), 'EDT');
});

test('hourly alignment — January (EST): identical ET anchoring', () => {
  assertAnchoring(fullDaySessions('sample-5m/AAPL_5m_2026-01.json'), 'EST');
});

test('DST proof: same 09:30/16:00 ET maps to different UTC hours (EDT 13/20 vs EST 14/21)', () => {
  const rawJune = loadFixture('sample-5m/AAPL_5m_2026-06.json');
  const rawJan = loadFixture('sample-5m/AAPL_5m_2026-01.json');
  const utcHourAt = (raw, etMin) => {
    const bar = raw.find((b) => etParts(b.timestamp).etMinutes === etMin);
    return bar ? new Date(bar.timestamp * 1000).getUTCHours() : null;
  };
  // 09:30 ET
  assert.equal(utcHourAt(rawJune, 570), 13, 'June 09:30 ET should be 13:30 UTC (EDT, UTC−4)');
  assert.equal(utcHourAt(rawJan, 570), 14, 'January 09:30 ET should be 14:30 UTC (EST, UTC−5)');
  // 16:00 ET auction print
  assert.equal(utcHourAt(rawJune, 960), 20, 'June 16:00 ET should be 20:00 UTC (EDT)');
  assert.equal(utcHourAt(rawJan, 960), 21, 'January 16:00 ET should be 21:00 UTC (EST)');
});
