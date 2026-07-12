// Session-4 tests 7–10 — dispositions & lineage interaction (parent §6.1, §3.4; S4 §5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectEvents } from '../lib/events.js';
import { session5m, fiveMinMap, mkFamily, snap, regSession, mkRegistry } from './_synthetic-intraday.js';

const SYM = 'TST';

test('7 — gap-through the zone without trading in it → GAP_BREAK, excluded from the base set', () => {
  const fid = 'TST_fam000001';
  const dates = ['2023-07-10', '2023-07-11'];
  const fam = mkFamily(fid, { anchor: 100, roleState: 'support' });
  const sessions = dates.map((d) => regSession(d, [snap(fid, d, { anchor: 100 })], { unit: 1 }));
  const registry = mkRegistry(SYM, [fam], sessions, {});
  const fiveMinByDate = fiveMinMap([
    session5m('2023-07-10', [102, 102, 102]),   // sits above support (prior close above)
    session5m('2023-07-11', [98.5, 98.5, 98.5]), // gaps down THROUGH support; never trades in the zone
  ]);
  const r = detectEvents({ symbol: SYM, registry, fiveMinByDate });
  assert.equal(r.events.length, 1, 'the gap is recorded');
  assert.equal(r.events[0].disposition, 'GAP_BREAK');
  assert.equal(r.dispositions.touch, 0, 'GAP_BREAK is excluded from the touch base-rate set');
  assert.equal(r.dispositions.GAP_BREAK, 1);
});

test('8 — episode in flight when the family is absorbed by a merge → transfers to survivor, no duplicate', () => {
  const A = 'TST_fam000001'; // survivor (elder), anchor 100
  const B = 'TST_fam000002'; // absorbed, anchor 100.3
  const dates = ['2023-07-10', '2023-07-11', '2023-07-12'];
  const famA = mkFamily(A, { anchor: 100, roleState: 'support' });
  const famB = mkFamily(B, { anchor: 100.3, roleState: 'support', status: 'merged', mergedInto: A, mergedDate: '2023-07-11' });
  const sessions = [
    regSession('2023-07-10', [snap(A, '2023-07-10', { anchor: 100 }), snap(B, '2023-07-10', { anchor: 100.3, centroid: 100.3 })], { unit: 1 }),
    regSession('2023-07-11', [snap(A, '2023-07-11', { anchor: 100 })], { unit: 1 }),
    regSession('2023-07-12', [snap(A, '2023-07-12', { anchor: 100 })], { unit: 1 }),
  ];
  const registry = mkRegistry(SYM, [famA, famB], sessions, {
    events: [{ type: 'merge', date: '2023-07-11', survivorId: A, absorbedId: B, survivorAnchor: 100, absorbedAnchor: 100.3 }],
  });
  const fiveMinByDate = fiveMinMap([
    session5m('2023-07-10', [101, 100.3, 100.3]),   // touches B only (above A's zone), opens under B
    session5m('2023-07-11', [100.1, 100.1, 100.1]), // merge applied; episode now A's, camps in A's zone
    session5m('2023-07-12', [100.1, 100.0]),        // probes
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
    session5m('2023-07-10', [101, 100.0, 100.0]), // opens
    session5m('2023-07-11', [100.0, 100.0]),      // retirement applied at session start → closes RETIRED
  ]);
  const r = detectEvents({ symbol: SYM, registry, fiveMinByDate });
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].disposition, 'RETIRED_MIDEPISODE');
  assert.equal(r.dispositions.touch, 0, 'RETIRED_MIDEPISODE is excluded from the touch base');
});

test('10 — retired/absorbed families generate no new episodes', () => {
  const fid = 'TST_fam000001';
  const dates = ['2023-07-10', '2023-07-11'];
  // Family retired BEFORE the window opened → never a candidate.
  const fam = mkFamily(fid, { anchor: 100, roleState: 'support', status: 'retired', retiredDate: '2023-07-07' });
  const sessions = dates.map((d) => regSession(d, [snap(fid, d, { anchor: 100 })], { unit: 1 }));
  const registry = mkRegistry(SYM, [fam], sessions, {});
  const fiveMinByDate = fiveMinMap([
    session5m('2023-07-10', [101, 100.0]), // correct-side approach…
    session5m('2023-07-11', [101, 100.0]), // …again — but the family is terminal
  ]);
  const r = detectEvents({ symbol: SYM, registry, fiveMinByDate });
  assert.equal(r.events.length, 0, 'a terminal family opens no episodes');
});
