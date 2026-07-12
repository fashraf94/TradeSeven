// Session-4 tests 7–10 — dispositions & lineage interaction (parent §6.1, §3.4; S4 §5).
// Geometry is config-derived (S4.1) via geom().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectEvents } from '../lib/events.js';
import { session5m, fiveMinMap, mkFamily, snap, regSession, mkRegistry, geom } from './_synthetic-intraday.js';

const SYM = 'TST';
const g = geom(100, 1);

test('7 — gap-through the zone without trading in it → GAP_BREAK, excluded from the base set', () => {
  const fid = 'TST_fam000001';
  const dates = ['2023-07-10', '2023-07-11'];
  const fam = mkFamily(fid, { anchor: 100, roleState: 'support' });
  const sessions = dates.map((d) => regSession(d, [snap(fid, d, { anchor: 100 })], { unit: 1 }));
  const registry = mkRegistry(SYM, [fam], sessions, {});
  const fiveMinByDate = fiveMinMap([
    session5m('2023-07-10', [g.aboveSeed, g.aboveSeed, g.aboveSeed]), // sits above support (prior close above)
    session5m('2023-07-11', [g.gapBelow, g.gapBelow, g.gapBelow]),    // gaps down THROUGH support; never trades in the zone
  ]);
  const r = detectEvents({ symbol: SYM, registry, fiveMinByDate });
  assert.equal(r.events.length, 1, 'the gap is recorded');
  assert.equal(r.events[0].disposition, 'GAP_BREAK');
  assert.equal(r.dispositions.touch, 0, 'GAP_BREAK is excluded from the touch base-rate set');
  assert.equal(r.dispositions.GAP_BREAK, 1);
});

test('8 — episode in flight when the family is absorbed by a merge → transfers to survivor, no duplicate', () => {
  const A = 'TST_fam000001'; // survivor (elder), anchor 100 → zone [99,101]
  const B = 'TST_fam000002'; // absorbed, anchor 103 → zone [102,104] (clear of A's zone and >dedup radius)
  const dates = ['2023-07-10', '2023-07-11', '2023-07-12'];
  const famA = mkFamily(A, { anchor: 100, roleState: 'support' });
  const famB = mkFamily(B, { anchor: 103, roleState: 'support', status: 'merged', mergedInto: A, mergedDate: '2023-07-11' });
  const sessions = [
    regSession('2023-07-10', [snap(A, '2023-07-10', { anchor: 100 }), snap(B, '2023-07-10', { anchor: 103, centroid: 103 })], { unit: 1 }),
    regSession('2023-07-11', [snap(A, '2023-07-11', { anchor: 100 })], { unit: 1 }),
    regSession('2023-07-12', [snap(A, '2023-07-12', { anchor: 100 })], { unit: 1 }),
  ];
  const registry = mkRegistry(SYM, [famA, famB], sessions, {
    events: [{ type: 'merge', date: '2023-07-11', survivorId: A, absorbedId: B, survivorAnchor: 100, absorbedAnchor: 103 }],
  });
  const fiveMinByDate = fiveMinMap([
    session5m('2023-07-10', [106, 103, 103]),   // touches B only (above A's zone), opens under B
    session5m('2023-07-11', [100, 100, 100]),   // merge applied; episode now A's, camps in A's zone
    session5m('2023-07-12', [100, 100]),        // probes
  ]);
  const r = detectEvents({ symbol: SYM, registry, fiveMinByDate });
  assert.equal(r.events.length, 1, 'the transferred episode is a single event, not a duplicate');
  assert.equal(r.events[0].levelFamilyId, A, 'the event is re-attributed to the survivor');
});

test('9 — episode in flight when the family retires → RETIRED_MIDEPISODE, excluded', () => {
  const fid = 'TST_fam000001';
  const dates = ['2023-07-10', '2023-07-11'];
  const fam = mkFamily(fid, { anchor: 100, roleState: 'support', status: 'retired', retiredDate: '2023-07-11' });
  const sessions = dates.map((d) => regSession(d, [snap(fid, d, { anchor: 100 })], { unit: 1 }));
  const registry = mkRegistry(SYM, [fam], sessions, {
    events: [{ type: 'retirement', date: '2023-07-11', familyId: fid }],
  });
  const fiveMinByDate = fiveMinMap([
    session5m('2023-07-10', [g.aboveSeed, g.inside, g.inside]), // opens
    session5m('2023-07-11', [g.inside, g.inside]),             // retirement applied at session start → closes RETIRED
  ]);
  const r = detectEvents({ symbol: SYM, registry, fiveMinByDate });
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].disposition, 'RETIRED_MIDEPISODE');
  assert.equal(r.dispositions.touch, 0, 'RETIRED_MIDEPISODE is excluded from the touch base');
});

test('10 — retired/absorbed families generate no new episodes', () => {
  const fid = 'TST_fam000001';
  const dates = ['2023-07-10', '2023-07-11'];
  const fam = mkFamily(fid, { anchor: 100, roleState: 'support', status: 'retired', retiredDate: '2023-07-07' });
  const sessions = dates.map((d) => regSession(d, [snap(fid, d, { anchor: 100 })], { unit: 1 }));
  const registry = mkRegistry(SYM, [fam], sessions, {});
  const fiveMinByDate = fiveMinMap([
    session5m('2023-07-10', [g.aboveSeed, g.inside]), // correct-side approach…
    session5m('2023-07-11', [g.aboveSeed, g.inside]), // …again — but the family is terminal
  ]);
  const r = detectEvents({ symbol: SYM, registry, fiveMinByDate });
  assert.equal(r.events.length, 0, 'a terminal family opens no episodes');
});
