// Test #19 (S3.5 §3 / §9.10, §9.11, §9.9) — Geometry invariants, the bounded-diameter
// theorem, and weekly-pivot calendar edges.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import CONFIG, { validateGeometry } from '../config.js';
import { normalizeDaily } from '../lib/normalize.js';
import { distanceUnit } from '../lib/level-sources.js';
import { runLevels } from '../02-build-levels.js';
import { loadFixture } from './_helpers.js';
import { synthBars, weekdayDates, flat } from './_synthetic.js';

const GEO = CONFIG.levels.geometry;

// ── §9.10: config ordering invariants throw ───────────────────────────────────
test('geometry invariants: the shipped config passes; each ordering violation throws', () => {
  assert.doesNotThrow(() => validateGeometry(GEO));
  const base = () => JSON.parse(JSON.stringify({ distanceUnit: GEO.distanceUnit, multiples: GEO.multiples }));

  const cases = [
    ['kCluster > kConfluence', (g) => { g.multiples.kCluster = g.multiples.kConfluence + 0.1; }],
    ['kConfluence ≥ kMatch', (g) => { g.multiples.kConfluence = g.multiples.kMatch; }],
    ['kMerge ≥ kMatch', (g) => { g.multiples.kMerge = g.multiples.kMatch; }],
    ['kSplit ≤ kMatch', (g) => { g.multiples.kSplit = g.multiples.kMatch; }],
    ['kConfluence ≥ kMerge (merge reachability)', (g) => { g.multiples.kConfluence = g.multiples.kMerge; }],
    ['floorPct > capPct', (g) => { g.distanceUnit.floorPct = g.distanceUnit.capPct + 1; }],
    ['atrMultiple ≤ 0', (g) => { g.distanceUnit.atrMultiple = 0; }],
  ];
  for (const [name, mutate] of cases) {
    const g = base();
    mutate(g);
    assert.throws(() => validateGeometry(g), /geometry invariant violated/, `must throw: ${name}`);
  }
});

// ── distance unit: clamp behavior ─────────────────────────────────────────────
test('distanceUnit: ATR-scaled between the floor and the load-bearing cap', () => {
  const price = 100;
  const floor = (GEO.distanceUnit.floorPct / 100) * price;
  const cap = (GEO.distanceUnit.capPct / 100) * price;
  assert.equal(distanceUnit(0.4, price), floor, 'tiny ATR → floor');
  assert.equal(distanceUnit(null, price), floor, 'null ATR degrades to the floor');
  assert.equal(distanceUnit(100, price), cap, 'extreme ATR → cap (distinct structures stay distinct)');
  const mid = distanceUnit(4, price); // 0.25×4 = 1.0 within [0.5, 1.5]
  assert.ok(Math.abs(mid - 1.0) < 1e-12, 'mid-range ATR scales linearly');
});

// ── §9.11: bounded-diameter theorem ───────────────────────────────────────────
test('bounded-diameter theorem: no snapshot diameter ever reaches the split threshold (real fixture)', () => {
  const { bars } = normalizeDaily(loadFixture('daily/TSLA_eod_2018-01-01_2026-07-10.json'));
  const res = runLevels(bars, { symbol: 'TSLA', endDate: '2024-03-28' });
  assert.ok(res.sessions.length >= 100);
  let checked = 0;
  for (const s of res.sessions) {
    for (const snap of s.snapshots) {
      const prices = snap.members.map((m) => m.price);
      const span = Math.max(...prices) - Math.min(...prices);
      assert.ok(span <= GEO.multiples.kConfluence * s.unit + 1e-9,
        `${s.date}: snapshot diameter ${span} exceeds the kConfluence bound`);
      assert.ok(span < GEO.multiples.kSplit * s.unit,
        `${s.date}: a single snapshot reached the split threshold — the LS3-08 theorem is broken`);
      checked += 1;
    }
  }
  assert.ok(checked > 1000, `theorem checked on ${checked} snapshots`);
});

// ── §9.9: weekly pivots on calendar edges ─────────────────────────────────────
test('weekly pivots: tradable from the week\'s first trading session (normal Monday week)', () => {
  const bars = synthBars(flat(100, 30), { h: 0.4 }); // starts Monday 2024-01-01
  const res = runLevels(bars, { symbol: 'WKN', startDate: bars[15].date });
  for (const s of res.sessions) {
    const weekly = s.snapshots.flatMap((x) => x.members).filter((m) => m.method === 'weekly_pivots');
    assert.ok(weekly.length > 0, `${s.date}: weekly pivots missing`);
    for (const m of weekly) {
      assert.ok(m.firstTradableDate <= s.date, `${s.date}: weekly pivot not tradable on its session`);
      assert.equal(m.firstKnownDate, m.firstTradableDate, 'weekly pivots: known == tradable (S3.5 tradability amendment)');
    }
  }
  // On a Monday session, the weekly pivot is brand new: firstKnown == that Monday.
  const monday = res.sessions.find((s) => new Date(`${s.date}T00:00:00Z`).getUTCDay() === 1);
  assert.ok(monday, 'need a Monday session');
  const wk = monday.snapshots.flatMap((x) => x.members).find((m) => m.method === 'weekly_pivots');
  assert.equal(wk.firstKnownDate, monday.date, 'a Monday opens its week');
});

test('weekly pivots: a Monday-holiday week keys off its first ACTUAL trading session (Tuesday)', () => {
  // Weekday calendar with one Monday removed (a market holiday); enough prior bars for
  // the ATR warmup so the holiday week falls inside the emitted window.
  const holidayMonday = '2024-01-08';
  const dates = weekdayDates('2023-12-18', 25).filter((d) => d !== holidayMonday);
  const bars = synthBars(flat(100, dates.length), { h: 0.4, dates });
  const tuesday = '2024-01-09';
  const res = runLevels(bars, { symbol: 'WKH', startDate: '2024-01-04' });

  const tues = res.sessions.find((s) => s.date === tuesday);
  assert.ok(tues, 'Tuesday session missing');
  const weekly = tues.snapshots.flatMap((x) => x.members).filter((m) => m.method === 'weekly_pivots');
  assert.ok(weekly.length > 0, 'weekly pivots must exist in the holiday week');
  for (const m of weekly) {
    assert.equal(m.firstKnownDate, tuesday, 'the holiday week is first known on its first actual trading day');
    assert.equal(m.firstTradableDate, tuesday, 'and tradable that same session');
    assert.ok(m.formationDate < holidayMonday, 'formed from the prior completed week');
  }
  // The Wednesday of the holiday week inherits Tuesday as firstKnown.
  const wed = res.sessions.find((s) => s.date === '2024-01-10');
  const wkWed = wed.snapshots.flatMap((x) => x.members).find((m) => m.method === 'weekly_pivots');
  assert.equal(wkWed.firstKnownDate, tuesday);
});
