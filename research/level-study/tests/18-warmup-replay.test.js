// Test #18 (S3.5 §4 / §9.7) — Warmup lineage replay.
// Lineage is one continuous state machine across the warmup: the first study session
// inherits TRUE bornDates, anchors, and counters via the study-start checkpoint; no
// warmup session is emitted into any study artifact; statistics aggregate only the
// study window; and elder status reflects real (pre-study) age, not first-study-day
// snapshot order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLevels, computeStats } from '../02-build-levels.js';
import { synthBars, zigzag, flat } from './_synthetic.js';

test('warmup replay: the study inherits true family identity through the checkpoint', () => {
  // Zone structure forms from bar ~8; the study window opens at bar 60 — the zones are
  // ~40 lineage sessions old by then.
  const closes = [...flat(100, 8), ...zigzag(100, 1.4, 30)];
  const bars = synthBars(closes, { h: 0.1 });
  const START = bars[60].date;
  const res = runLevels(bars, { symbol: 'WARM', startDate: START, enabledFamilies: ['structural'] });

  // Checkpoint exists and describes the inherited state.
  const cp = res.studyStartCheckpoint;
  assert.ok(cp, 'study-start checkpoint missing');
  assert.equal(cp.date, START);
  assert.ok(cp.warmupSessionsReplayed > 30, `expected a real warmup replay (got ${cp.warmupSessionsReplayed})`);
  assert.equal(cp.warmupFamilyCounts.live, 2, 'both zones must be live at study start');
  for (const f of cp.liveFamilies) {
    assert.ok(f.bornDate < START, 'checkpoint families carry TRUE (pre-study) bornDates');
    assert.ok(f.preStudyAgeSessions > 0);
    assert.ok(f.roleLog.length >= 1, 'role history rides through the checkpoint');
  }

  // Families are stamped, not left-censored.
  const fams = Object.values(res.families);
  for (const f of fams.filter((x) => x.bornDate < START)) {
    assert.equal(f.preStudy, true);
    assert.ok(f.preStudyAgeSessions > 0);
  }

  // No warmup session is emitted; the registry begins exactly at the study start.
  assert.equal(res.actualFirstSession, START);
  assert.ok(res.sessions.every((s) => s.date >= START), 'a warmup session leaked into the artifact');

  // The first study session's snapshots reference the INHERITED families.
  const inheritedIds = new Set(cp.liveFamilies.map((f) => f.familyId));
  const firstDay = res.sessions[0];
  assert.ok(firstDay.snapshots.length >= 1);
  for (const snap of firstDay.snapshots) {
    assert.ok(inheritedIds.has(snap.familyId), `${snap.snapshotId} not owned by an inherited family`);
  }

  // Warmup match history is state-building only: no study artifact references a warmup
  // snapshot (matchHistory cleared at the checkpoint — S35-C4).
  for (const f of fams) {
    assert.ok(f.matchHistory.every((h) => h.date >= START), `${f.familyId}: warmup matchHistory leaked past the checkpoint`);
  }

  // Aggregation never touches a warmup session: stats count study-window events only.
  const stats = computeStats(res);
  assert.equal(stats.registrySessions, res.sessions.length);
  assert.equal(stats.actualFirstSession, START);
  const warmupEventCount = res.events.filter((e) => e.date < START).length;
  const studyEventCount = res.events.filter((e) => e.date >= START).length;
  assert.equal(
    stats.events.merges + stats.events.splits + stats.events.retirements + stats.events.roleFlips,
    studyEventCount,
    `stats must aggregate exactly the study-window events (warmup genealogy: ${warmupEventCount})`);
});

test('warmup replay: elder status derives from real pre-study age, not first-study-day price order', () => {
  // The HIGHER-priced zone forms ~24 sessions before the lower one. Under S3 (no replay)
  // both would be "born" on the first study day and the LOWER-priced zone would win
  // eldership by ascending-price founding order; with replay, the higher zone is elder.
  const closes = [
    ...flat(100, 8),
    ...zigzag(101.5, 1.0, 6),   // bars 8..31: the HIGH zone forms first (troughs ~101.4)
    ...zigzag(98.0, 0.8, 24),   // bars 32..127: the LOW zone forms later (troughs ~97.9)
  ];
  const bars = synthBars(closes, { h: 0.1 });
  const START = bars[60].date;
  const res = runLevels(bars, { symbol: 'ELD', startDate: START, enabledFamilies: ['structural'] });

  const fams = Object.values(res.families).filter((f) => f.preStudy);
  assert.ok(fams.length >= 2, 'need at least the two warmup zones');
  const high = fams.filter((f) => f.anchor > 100).sort((a, b) => a.bornDate < b.bornDate ? -1 : 1)[0];
  const low = fams.filter((f) => f.anchor < 100).sort((a, b) => a.bornDate < b.bornDate ? -1 : 1)[0];
  assert.ok(high && low, 'both zones must exist');
  assert.ok(high.bornDate < low.bornDate, `the high zone must be genuinely elder (${high.bornDate} vs ${low.bornDate})`);
  assert.ok(high.familyId < low.familyId, 'founding ordinals must reflect replay order, not study-day price order');
});
