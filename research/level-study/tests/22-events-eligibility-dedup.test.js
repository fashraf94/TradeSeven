// Session-4 tests 11–13 + A4 — eligibility, warmup, cross-level dedup, point-in-time anchor.
// Geometry is config-derived (S4.1) via geom().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectEvents } from '../lib/events.js';
import { session5m, fiveMinMap, mkFamily, snap, regSession, mkRegistry, geom } from './_synthetic-intraday.js';

const SYM = 'TST';
const g = geom(100, 1);

// Map snapshotId -> firstTradableDate across a registry (integrity cross-check for test 11).
function firstTradableById(registry) {
  const m = new Map();
  for (const s of registry.sessions) for (const snp of s.snapshots) m.set(snp.snapshotId, snp.firstTradableDate);
  return m;
}

test('11 — no event references a level with firstTradableDate > eventDate', () => {
  const fid = 'TST_fam000001';
  const fam = mkFamily(fid, { anchor: 100, roleState: 'support' });
  const sessions = [
    // Snapshot exists on 07-10 but is not tradable until 07-14 (availability lag).
    regSession('2023-07-10', [snap(fid, '2023-07-10', { anchor: 100, firstTradableDate: '2023-07-14' })], { unit: 1 }),
    regSession('2023-07-14', [snap(fid, '2023-07-14', { anchor: 100, firstTradableDate: '2023-07-14' })], { unit: 1 }),
  ];
  const registry = mkRegistry(SYM, [fam], sessions, {});
  const fiveMinByDate = fiveMinMap([
    session5m('2023-07-10', [g.aboveSeed, g.inside, g.inside]), // premature touch — suppressed
    session5m('2023-07-14', [g.aboveSeed, g.inside]),           // now tradable → event
  ]);
  const r = detectEvents({ symbol: SYM, registry, fiveMinByDate });
  assert.equal(r.events.length, 1, 'the premature touch is suppressed; the tradable one fires');
  assert.equal(r.events[0].eventDate, '2023-07-14');
  const ftd = firstTradableById(registry);
  for (const e of r.events) assert.ok(ftd.get(e.levelSnapshotId) <= e.eventDate, 'firstTradableDate ≤ eventDate for every event');
});

test('12 — no event falls on a warmup session', () => {
  const fid = 'TST_fam000001';
  const fam = mkFamily(fid, { anchor: 100, roleState: 'support', bornDate: '2023-06-01' });
  const sessions = [
    regSession('2023-07-07', [snap(fid, '2023-07-07', { anchor: 100 })], { unit: 1 }), // warmup (< studyStart)
    regSession('2023-07-10', [snap(fid, '2023-07-10', { anchor: 100 })], { unit: 1 }), // study
  ];
  const registry = mkRegistry(SYM, [fam], sessions, { studyStart: '2023-07-10' });
  const fiveMinByDate = fiveMinMap([
    session5m('2023-07-07', [g.aboveSeed, g.inside, g.inside]), // a touch on a warmup day — must not fire
    session5m('2023-07-10', [g.aboveSeed, g.inside]),           // study-window touch → event
  ]);
  const r = detectEvents({ symbol: SYM, registry, fiveMinByDate, studyStart: '2023-07-10' });
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].eventDate, '2023-07-10');
  assert.ok(r.events.every((e) => e.eventDate >= '2023-07-10'), 'no event on a warmup session');
});

test('13 — cross-level dedup: tier → nearest → elder; shadowed family’s episode still advances', () => {
  const A = 'TST_fam000001'; // anchor 100.0, tier F1 (lower)
  const B = 'TST_fam000002'; // anchor 100.2, tier F2 (higher) — within dedupIntersectU·u of A
  const famA = mkFamily(A, { anchor: 100.0, roleState: 'support' });
  const famB = mkFamily(B, { anchor: 100.2, roleState: 'support' });
  const sessions = [regSession('2023-07-10', [
    snap(A, '2023-07-10', { anchor: 100.0, tier: 'F1' }),
    snap(B, '2023-07-10', { anchor: 100.2, centroid: 100.2, tier: 'F2' }),
  ], { unit: 1 })];
  const registry = mkRegistry(SYM, [famA, famB], sessions, {});
  // 100.1 enters BOTH zones (A [99,101], B [99.2,101.2]); exit above both (104); re-enter.
  const fiveMinByDate = fiveMinMap([session5m('2023-07-10', [104, 100.1, 104, 100.1])]);
  const r = detectEvents({ symbol: SYM, registry, fiveMinByDate });
  assert.equal(r.events.length, 1, 'a simultaneous double-touch yields ONE event');
  assert.equal(r.events[0].levelFamilyId, B, 'higher tier (F2) wins the touch');
  assert.deepEqual(r.events[0].shadowedFamilyIds, [A], 'the losing zone is recorded as shadowed');
  assert.equal(r.shadowed, 1, 'the shadowed family opened a (silent) episode');
  // A never emits: the re-entry on bar 4 is a probe of A’s advanced (silent) episode, not a new event.
});

test('A4 — the zone at D uses the prior anchor stamp (anchorAsOfD reads strictly < D)', () => {
  const fid = 'TST_fam000001';
  const fam = mkFamily(fid, { anchor: 100, roleState: 'support' });
  const sessions = [
    regSession('2023-07-10', [snap(fid, '2023-07-10', { anchor: 100 })], { unit: 1 }),        // prior stamp: 100
    regSession('2023-07-11', [snap(fid, '2023-07-11', { anchor: 105, centroid: 105 })], { unit: 1 }), // D's own stamp would move the zone to ~105
  ];
  const registry = mkRegistry(SYM, [fam], sessions, {});
  const fiveMinByDate = fiveMinMap([
    session5m('2023-07-10', [g.aboveSeed, g.aboveSeed, g.aboveSeed]), // no touch; just sets the prior close above
    session5m('2023-07-11', [g.aboveSeed, g.inside]),                 // touches the zone centred on the PRIOR anchor (100), not 105
  ]);
  const r = detectEvents({ symbol: SYM, registry, fiveMinByDate });
  assert.equal(r.events.length, 1, 'the touch lands on the prior-anchor zone (had D used its own 105 stamp, 100 would miss)');
  assert.ok(Math.abs(r.events[0].zoneLow - g.zLo) < 1e-9 && Math.abs(r.events[0].zoneHigh - g.zHi) < 1e-9,
    `zone is anchored on the prior stamp: [${r.events[0].zoneLow}, ${r.events[0].zoneHigh}] (expect [${g.zLo}, ${g.zHi}])`);
});
