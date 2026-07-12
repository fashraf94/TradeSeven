// Session-4 tests 1–6 — the INDEPENDENCE core (parent §6.1, S4 §5). Geometry is config-derived
// (S4.1): support family anchor 100, unit 1 → zone [anchor ± zoneHalfWidthU·u]; a full-1.0× close
// needs closeSeparationU·u beyond the boundary. Prices come from geom() landmarks, not literals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectEvents } from '../lib/events.js';
import { session5m, fiveMinMap, mkFamily, snap, regSession, mkRegistry, geom } from './_synthetic-intraday.js';

const SYM = 'TST';
const FID = 'TST_fam000001';
const g = geom(100, 1);

// One support family, one snapshot per session (constant anchor 100), unit 1.
function scenario(dates, paths, opts = {}) {
  const anchor = opts.anchor != null ? opts.anchor : 100;
  const fam = mkFamily(FID, { anchor, roleState: opts.roleState || 'support' });
  const sessions = dates.map((d) => regSession(d, [snap(FID, d, {
    anchor, tier: opts.tier || 'F1', firstTradableDate: opts.firstTradableDate || d,
  })], { unit: 1, atr: 4, refClose: 100 }));
  const registry = mkRegistry(SYM, [fam], sessions, { events: opts.events || [] });
  const fiveMinByDate = fiveMinMap(dates.map((d, i) => session5m(d, paths[i])));
  return detectEvents({ symbol: SYM, stratum: 'high_beta', registry, fiveMinByDate });
}

test('1 — five intraday probes of one level in one session → exactly 1 event', () => {
  // 5 in/out cycles; each excursion is a shallow probe (≪ closeSeparationU) so it never closes.
  const path = [g.aboveSeed, g.inside, g.probeAbove, g.inside, g.probeAbove, g.inside, g.probeAbove, g.inside, g.probeAbove, g.inside, g.probeAbove];
  const r = scenario(['2023-07-10'], [path]);
  assert.equal(r.events.length, 1, 'exactly one event for five same-session probes');
  assert.equal(r.events[0].disposition, 'touch');
  assert.equal(r.events[0].side, 'support');
  assert.equal(r.events[0].sequenceIndex, 0);
  assert.ok(r.events[0].probeCountInEpisode >= 4, `probes ${r.events[0].probeCountInEpisode} (≥4)`);
  assert.ok(r.rejected >= 4, `independence filter rejected ${r.rejected} re-entries (≥4)`);
});

test('2 — a five-session camp inside the zone → exactly 1 event (no day-4 re-event)', () => {
  const open = [g.aboveSeed, g.inside, g.inside + 0.05, g.inside + 0.1, g.inside]; // opens from above then camps
  const camp = [g.inside, g.inside + 0.1, g.inside - 0.1, g.inside + 0.05, g.inside];
  const dates = ['2023-07-10', '2023-07-11', '2023-07-12', '2023-07-13', '2023-07-14'];
  const r = scenario(dates, [open, camp, camp, camp, camp]);
  assert.equal(r.events.length, 1, 'a continuous multi-session camp is ONE event');
  assert.equal(r.events[0].disposition, 'touch');
  assert.equal(r.dispositions.RETIRED_MIDEPISODE, 0);
});

test('3 — separation by 0.9× then re-approach → NO new event', () => {
  const s1 = [g.aboveSeed, g.inside, g.sepShortAbove];   // separated 0.9× (< close threshold)
  const s2 = [g.sepShortAbove, g.sepShortAbove, g.sepShortAbove]; // full session outside, distance still short
  const s3 = [g.sepShortAbove, g.inside];                // re-approach
  const r = scenario(['2023-07-10', '2023-07-11', '2023-07-12'], [s1, s2, s3]);
  assert.equal(r.events.length, 1, '0.9× separation does not close the episode → no new event');
});

test('4 — separation by 1.0× but re-approach the same session → NO new event', () => {
  const s1 = [g.aboveSeed, g.inside, g.sepFullAbove, g.inside]; // distance met but re-enters same session
  const r = scenario(['2023-07-10'], [s1]);
  assert.equal(r.events.length, 1, 'distance without a full session outside → no close → no new event');
});

test('5 — separation ≥1.0× + ≥1 full session outside + fresh approach → 1 new event, seq increments', () => {
  const s1 = [g.aboveSeed, g.inside, g.sepBeyondAbove];   // open ev0, separate > 1.0×
  const s2 = [g.sepBeyondAbove, g.sepBeyondAbove, g.sepBeyondAbove]; // one full session outside → close
  const s3 = [g.sepBeyondAbove, g.inside];               // fresh approach from above → ev1
  const r = scenario(['2023-07-10', '2023-07-11', '2023-07-12'], [s1, s2, s3]);
  assert.equal(r.events.length, 2, 'a true re-arm produces a second independent event');
  assert.equal(r.events[0].sequenceIndex, 0);
  assert.equal(r.events[1].sequenceIndex, r.events[0].sequenceIndex + 1, 'sequenceIndex increments');
});

test('6 — approach from the wrong side (support from below) → NO event', () => {
  const s1 = [g.belowSeed, g.zLo - 0.1, g.inside]; // rises INTO support from below — not a valid support test
  const r = scenario(['2023-07-10'], [s1]);
  assert.equal(r.events.length, 0, 'support opens only from above');
});
