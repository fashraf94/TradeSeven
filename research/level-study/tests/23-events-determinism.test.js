// Session-4 test 14 + A3 — determinism (byte-identical runs) and the pinned approach-side rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectEvents } from '../lib/events.js';
import { canonical } from '../02-build-levels.js';
import { session5m, fiveMinMap, mkFamily, snap, regSession, mkRegistry } from './_synthetic-intraday.js';

const SYM = 'TST';

// A multi-family, multi-session scenario exercising open / probe / separation-close / re-arm / dedup.
function buildInputs() {
  const A = 'TST_fam000001'; // anchor 100.0, F1
  const B = 'TST_fam000002'; // anchor 100.2, F2 (dedup with A on a shared bar)
  const famA = mkFamily(A, { anchor: 100.0, roleState: 'support' });
  const famB = mkFamily(B, { anchor: 100.2, roleState: 'support' });
  const dates = ['2023-07-10', '2023-07-11', '2023-07-12', '2023-07-13'];
  const sessions = dates.map((d) => regSession(d, [
    snap(A, d, { anchor: 100.0, tier: 'F1' }),
    snap(B, d, { anchor: 100.2, centroid: 100.2, tier: 'F2' }),
  ], { unit: 1 }));
  const registry = mkRegistry(SYM, [famA, famB], sessions, {});
  const fiveMinByDate = fiveMinMap([
    session5m('2023-07-10', [101, 100.1, 100.1]),   // dedup double-touch (B wins, A shadowed)
    session5m('2023-07-11', [101.4, 101.4, 101.4]), // separate ≥1.0·u and a full session outside → both close
    session5m('2023-07-12', [101.4, 100.1, 100.1]), // fresh approach → re-arm (new events)
    session5m('2023-07-13', [100.1, 100.1]),        // camp
  ]);
  return { registry, fiveMinByDate };
}

test('14 — two identical runs produce byte-identical event sets', () => {
  const a = detectEvents({ symbol: SYM, ...buildInputs() });
  const b = detectEvents({ symbol: SYM, ...buildInputs() });
  assert.ok(a.events.length > 0, 'the scenario produced events');
  assert.equal(canonical(a.events), canonical(b.events), 'event sets are byte-identical across runs');
  assert.equal(canonical(a.dispositions), canonical(b.dispositions));
});

test('A3 — approach side = the most recent close before the touch bar; opens-inside uses the prior session close', () => {
  const fid = 'TST_fam000001';
  const build = (priorPath) => {
    const fam = mkFamily(fid, { anchor: 100, roleState: 'support' });
    const sessions = ['2023-07-10', '2023-07-11'].map((d) => regSession(d, [snap(fid, d, { anchor: 100 })], { unit: 1 }));
    const registry = mkRegistry(SYM, [fam], sessions, {});
    const fiveMinByDate = fiveMinMap([
      session5m('2023-07-10', priorPath),          // establishes the prior-session close
      session5m('2023-07-11', [100.0, 100.0, 100.0]), // session OPENS with the first bar already inside the zone
    ]);
    return detectEvents({ symbol: SYM, registry, fiveMinByDate });
  };
  // Prior close ABOVE the zone → opening inside is a valid support approach from above → opens.
  const above = build([101, 101, 101]);
  assert.equal(above.events.length, 1, 'opens-inside with prior close above → the prior close decides (above → opens)');
  assert.equal(above.events[0].eventDate, '2023-07-11');
  // Prior close BELOW the zone → opening inside is NOT a from-above approach → no open.
  const below = build([98, 98, 98]);
  assert.equal(below.events.length, 0, 'opens-inside with prior close below → wrong side → no open');
});
