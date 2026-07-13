// research/level-study/tests/30-warmup-5m.test.js
//
// S5.6 §3 — THE 5-MINUTE WARMUP.
//
// The bug: the RVOL baseline needs 20 trailing sessions of 5-MINUTE data, but the 5m fetch began
// exactly at studyStart. The DAILY warmup existed; the 5m warmup was never built. Events in the
// first 20 study sessions nulled rvol_approach at 72.6% (vs 30.6% elsewhere) — 189 events (2.2%)
// lost to a pure data artifact.
//
// The fix: fetch 5m from 30 TRADING sessions before studyStart, tag those bars `warmup5m: true`,
// and admit them on EXACTLY ONE path — the RVOL/volume baseline walk.
//
// These tests pin the two hard rules the fix must not violate:
//   §3-a  an event on study-session-1 has a NON-NULL RVOL (the baseline is now populated);
//   §3-b  NO event may be detected on a 5m-warmup session;
// plus the isolation guarantee that makes "baselines ONLY" true rather than merely intended:
//   §3-c  poison every warmup bar → every other feature is byte-identical.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import CONFIG from '../config.js';
import { normalizeDaily, normalizeFiveMin, fiveMinWarmupStart } from '../lib/normalize.js';
import { assembleEventFeatures } from '../lib/features.js';
import { detectEvents } from '../lib/events.js';
import { mkEventFixture, poison5mBar } from './_synthetic-features.js';
import { session5m, fiveMinMap, mkFamily, snap, regSession, mkRegistry } from './_synthetic-intraday.js';

const STUDY_START = CONFIG.range.studyStart;   // 2023-07-10
const WARMUP_N = CONFIG.fetch.intradayWarmupSessions; // 30

// ── §3-0: the fetch range is derived from the real trading calendar ──────────

test('fiveMinWarmupStart lands exactly intradayWarmupSessions trading sessions before studyStart', () => {
  // A daily calendar that straddles studyStart. Only the TRADING sessions present in the bars
  // count — that is the whole point of deriving the date instead of subtracting calendar days.
  const dates = [];
  for (let d = new Date('2023-04-03T00:00:00Z'); d < new Date('2023-08-01T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) dates.push(d.toISOString().slice(0, 10)); // weekdays only
  }
  const bars = dates.map((date) => ({ date }));
  const start = fiveMinWarmupStart(bars);

  const pre = dates.filter((d) => d < STUDY_START);
  assert.equal(start, pre[pre.length - WARMUP_N], `must be the ${WARMUP_N}th session before ${STUDY_START}`);
  assert.ok(start < STUDY_START, 'warmup start precedes studyStart');
  // Exactly 30 sessions of warmup — not 29, not 31.
  assert.equal(pre.filter((d) => d >= start).length, WARMUP_N);
  // And it is NOT the naive calendar-day guess (30 sessions ≈ 44 calendar days, holiday-dependent).
  assert.ok(WARMUP_N >= 20, 'warmup must exceed the 20 sessions RVOL actually needs (margin)');
});

test('fiveMinWarmupStart degrades safely when a symbol has less pre-study history than the warmup', () => {
  const bars = [{ date: '2023-07-05' }, { date: '2023-07-06' }, { date: '2023-07-07' }, { date: '2023-07-11' }];
  const start = fiveMinWarmupStart(bars);
  assert.equal(start, '2023-07-05', 'falls back to the earliest daily bar; never returns a post-studyStart date');
  assert.ok(start < STUDY_START);
  assert.equal(fiveMinWarmupStart([]), CONFIG.fetch.intradayFetchStart, 'no pre-study history → study window only');
});

// ── §3-tag: warmup5m is a date fact, on bars and on sessions ─────────────────

test('normalizeFiveMin tags warmup5m strictly by date < studyStart (bars and sessions)', () => {
  const mkRaw = (etDate, etMin) => ({
    timestamp: Math.floor(Date.parse(`${etDate}T${String(Math.floor(etMin / 60)).padStart(2, '0')}:${String(etMin % 60).padStart(2, '0')}:00Z`) / 1000),
    open: 100, high: 100.1, low: 99.9, close: 100, volume: 1000,
  });
  // EODHD epochs are UTC; 09:30 ET in EDT = 13:30 UTC.
  const raw = [];
  for (const d of ['2023-06-30', '2023-07-10', '2023-07-11']) for (let et = 810; et <= 830; et += 5) raw.push(mkRaw(d, et));
  const daily = normalizeDaily(['2023-06-30', '2023-07-10', '2023-07-11'].map((date) => ({
    date, open: 100, high: 101, low: 99, close: 100, adjusted_close: 100, volume: 1e6,
  })));
  const { bars, sessions } = normalizeFiveMin(raw, daily.byDate);

  for (const b of bars) assert.equal(b.warmup5m, b.etDate < STUDY_START, `${b.etDate}: warmup5m must be (date < ${STUDY_START})`);
  for (const s of sessions) assert.equal(s.warmup5m, s.etDate < STUDY_START, `${s.etDate}: session warmup5m`);

  const warm = sessions.filter((s) => s.warmup5m).map((s) => s.etDate);
  const study = sessions.filter((s) => !s.warmup5m).map((s) => s.etDate);
  assert.deepEqual(warm, ['2023-06-30'], 'the pre-studyStart session is warmup5m');
  assert.deepEqual(study, ['2023-07-10', '2023-07-11'], 'studyStart itself is NOT warmup (the window is inclusive)');
});

// ── §3-a: THE HEADLINE — study-session-1 now has a non-null RVOL ─────────────

test('§3-a an event on study-session-1 has a NON-NULL rvol_approach (the warmup populates the baseline)', () => {
  // The event sits on the FIRST study session: every one of its 20 baseline sessions is a warmup5m
  // session. Pre-fix this was the 72.6%-null case; post-fix the baseline is full.
  const fx = mkEventFixture({ baselineDays: 25, touchEtMin: 720 });

  // Split the fixture's own 5m calendar at the event date: the event is study-session-1, so every
  // earlier 5m session is warmup. (The fixture's dates are synthetic; the split is what matters.)
  const eventDate = fx.D;
  const warmupDates = fx.sessionDates.filter((d) => d < eventDate);
  const studyDates = fx.sessionDates.filter((d) => d >= eventDate);
  assert.equal(studyDates.length, 1, 'the event is on study-session-1 — there is no earlier study session');
  assert.ok(warmupDates.length >= 20, 'and its whole baseline lives in the warmup');

  // PRE-S5.6 world: the warmup 5m was never FETCHED, so those sessions are absent from the map
  // entirely. The baseline walk finds 0 prior sessions → rvol null. This is the bug, reproduced.
  const noWarmupMap = new Map([...fx.fiveMinByDate].filter(([d]) => d >= eventDate));
  const before = assembleEventFeatures({
    event: fx.event, series: fx.series, fiveMinByDate: noWarmupMap, sessionDates: studyDates,
  });
  assert.equal(before.features.pre_touch.rvol_approach, null, 'PRE-FIX: no 5m warmup fetched → baseline empty → rvol null');
  assert.equal(before.features.pre_touch.rvol_bucket, null, 'and the bucket cascades to null');

  // POST-S5.6: the warmup sessions ARE in the map. sessionDates stays study-only (a feature must
  // never see a warmup bar), but the baseline calendar is derived from the map inside
  // assembleEventFeatures — so the baseline fills and rvol is a real number.
  const after = assembleEventFeatures({
    event: fx.event, series: fx.series, fiveMinByDate: fx.fiveMinByDate, sessionDates: studyDates,
  });
  const rvol = after.features.pre_touch.rvol_approach;
  assert.notEqual(rvol, null, 'POST-FIX: the 5m warmup populates the 20-session baseline → rvol is NON-NULL');
  assert.ok(Number.isFinite(rvol) && rvol > 0, `rvol must be a finite positive number (got ${rvol})`);
  assert.notEqual(after.features.pre_touch.rvol_bucket, null, 'and the bucket is populated');
});

// ── §3-c: the isolation guarantee — warmup feeds BASELINES ONLY ──────────────

test('§3-c warmup5m bars feed RVOL/volume baselines ONLY — poisoning them changes nothing else', () => {
  // The strongest statement of the hard rule. Poison EVERY warmup bar (×1000 price, ×1e6 volume).
  // If any feature other than the volume baselines reads a warmup bar, its value moves. Assert
  // every other feature is byte-identical, and that rvol is the ONLY thing that reacts.
  const fx = mkEventFixture({ baselineDays: 25, touchEtMin: 720 });
  const eventDate = fx.D;
  const warmupDates = fx.sessionDates.filter((d) => d < eventDate);
  const studyDates = fx.sessionDates.filter((d) => d >= eventDate);

  const args = {
    event: fx.event, series: fx.series, fiveMinByDate: fx.fiveMinByDate, sessionDates: studyDates,
  };
  const clean = assembleEventFeatures(args);

  const poisonedMap = new Map(fx.fiveMinByDate);
  for (const d of warmupDates) {
    const s = poisonedMap.get(d);
    poisonedMap.set(d, { ...s, regular: s.regular.map(poison5mBar), sessionCloseAdj: s.sessionCloseAdj * 1000 });
  }
  const dirty = assembleEventFeatures({ ...args, fiveMinByDate: poisonedMap });

  const VOLUME_SENSITIVE = new Set(['rvol_approach', 'rvol_bucket']);
  for (const [k, v] of Object.entries(clean.features.pre_touch)) {
    if (VOLUME_SENSITIVE.has(k)) continue;
    assert.deepEqual(dirty.features.pre_touch[k], v, `LEAK: pre_touch.${k} moved when only warmup5m bars were poisoned — a non-baseline feature is reading the warmup`);
  }
  for (const [k, v] of Object.entries(clean.features.post_touch)) {
    assert.deepEqual(dirty.features.post_touch[k], v, `LEAK: post_touch.${k} read a warmup5m bar`);
  }
  // Sanity: the poison IS reaching the baseline path — otherwise the test above proves nothing.
  assert.notEqual(clean.features.pre_touch.rvol_approach, dirty.features.pre_touch.rvol_approach,
    'the ×1e6 volume poison must move rvol — if it does not, the baseline never saw the warmup and this test is vacuous');
});

test('gap_context / the approach seed never read a warmup5m session (prev-close stays study-scoped)', () => {
  // prevCloseAdj seeds gap_context. On study-session-1 it must remain NULL — reading the last
  // warmup session's close would be a feature consuming a warmup bar (S5.6 §3 hard rule).
  const fx = mkEventFixture({ baselineDays: 25, touchEtMin: 720 });
  const studyDates = fx.sessionDates.filter((d) => d >= fx.D);
  const out = assembleEventFeatures({
    event: fx.event, series: fx.series, fiveMinByDate: fx.fiveMinByDate, sessionDates: studyDates,
  });
  assert.equal(out.features.pre_touch.gap_context, null,
    'study-session-1 has no PRIOR STUDY session → gap_context stays null even though warmup 5m exists');
});

// ── §3-b: NO event may be detected on a 5m-warmup session ────────────────────

test('§3-b no event is detected on any warmup5m session (the registry gate)', () => {
  // The registry is daily-derived and emits the study window only, so warmup5m dates are never
  // iterated. Give the detector 5m sessions on BOTH sides of studyStart and assert every emitted
  // event lands on a study session.
  const fam = mkFamily('TST_fam000001', { anchor: 100, bornDate: '2023-05-01' });
  const warmDates = ['2023-06-28', '2023-06-29', '2023-06-30'];
  const studyDates = ['2023-07-10', '2023-07-11', '2023-07-12'];

  // A price path that dives into the zone on every session — warmup sessions would fire events if
  // they were ever reachable.
  const touchPath = () => { const p = []; for (let et = 570; et <= 955; et += 5) p.push(et === 720 ? 100 : 103); return p; };
  const sessions5m = [...warmDates, ...studyDates].map((d) => {
    const s = session5m(d, touchPath());
    return { ...s, warmup5m: d < STUDY_START };
  });
  const fiveMinByDate = fiveMinMap(sessions5m);

  // The registry contains ONLY study sessions (that is the invariant under test).
  const registry = mkRegistry('TST', [fam], studyDates.map((d) => regSession(d, [snap('TST_fam000001', d)])));
  const { events } = detectEvents({ symbol: 'TST', registry, fiveMinByDate, studyStart: STUDY_START });

  assert.ok(events.length > 0, 'the fixture must actually produce events, or the assertion below is vacuous');
  for (const ev of events) {
    assert.ok(ev.eventDate >= STUDY_START, `event ${ev.eventId} dated ${ev.eventDate} is before studyStart ${STUDY_START}`);
    assert.equal(fiveMinByDate.get(ev.eventDate).warmup5m, false, `event ${ev.eventId} landed on a warmup5m session`);
  }
  for (const d of warmDates) assert.equal(events.some((e) => e.eventDate === d), false, `an event was emitted on warmup session ${d}`);
});

test('§3-b a warmup5m session reaching the detector is FATAL, never silent', () => {
  // Belt-and-braces: if the daily registry window and the 5m warmup window ever drift apart, the
  // detector must explode rather than silently emit a pre-study event (an invisible lookahead).
  const fam = mkFamily('TST_fam000001', { anchor: 100, bornDate: '2023-05-01' });
  const warmDate = '2023-06-30';
  const path = () => { const p = []; for (let et = 570; et <= 955; et += 5) p.push(et === 720 ? 100 : 103); return p; };
  const fiveMinByDate = fiveMinMap([{ ...session5m(warmDate, path()), warmup5m: true }]);

  // A CORRUPT registry: it emits a warmup-dated session. This must never happen — and if it does,
  // we want the loud failure, not the artifact.
  const registry = mkRegistry('TST', [fam], [regSession(warmDate, [snap('TST_fam000001', warmDate)])], { studyStart: '2023-01-01' });

  assert.throws(
    () => detectEvents({ symbol: 'TST', registry, fiveMinByDate, studyStart: '2023-01-01' }),
    /WARMUP5M_EVENT_SESSION/,
    'a warmup5m session that reaches event detection must throw, not emit',
  );
});
