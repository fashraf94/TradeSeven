// api/_utils/wireEditorialSampling.test.js
// Phase 2 N3.2 — deterministic sampling. Matrix rows:
//   P2-33 — ISO-week no-spill: a NYSE-holiday week reviews 4 sessions from
//           ITS OWN ISO week; nothing back-fills from the prior week.
//   P2-10 — stratification or `insufficient`: a coverage mandate that
//           cannot fit inside the ceiling is INSUFFICIENT, never a
//           silently dropped stratum.
//   P2-35 — activeReporters DERIVED from the allowlist keys, pinned at 5:
//           a sixth reporter fails CI here instead of silently resizing
//           the editorial mandate.
// Plus the N3.2 determinism contract (seeded hash-ranking: same inputs →
// same sample, frame ORDER-independent; different seed → different
// selection) and the coverage mandate (every produced stratum sampled;
// index_move always included when produced).

import { describe, it, expect } from 'vitest';
import {
  isoWeekOf,
  isoWeekDates,
  editorialSessionsFor,
  deriveEditorialFrame,
  sampleEditorialFrame,
  buildEditorialManifest,
  frameFingerprint,
  EDITORIAL_SAMPLE_CEILING,
} from './wireEditorialSampling.js';
import {
  WIRE_ACTIVE_REPORTERS,
  REPORTER_EVENT_ALLOWLIST,
  WIRE_SCHEMA_VERSION,
  WIRE_DIGEST_RENDERER_VERSION,
} from './wireContracts.js';

// ── P2-35: the derived activeReporters assertion ──────────────────────────
describe('P2-35 — activeReporters is derived and pinned', () => {
  it('WIRE_ACTIVE_REPORTERS = the allowlist keys, exactly 5', () => {
    expect(WIRE_ACTIVE_REPORTERS).toEqual(Object.keys(REPORTER_EVENT_ALLOWLIST));
    // Amendment C: a sixth reporter must fail HERE (a reviewed editorial-
    // sizing decision), never silently resize minimumSize at runtime.
    expect(WIRE_ACTIVE_REPORTERS).toHaveLength(5);
  });

  it('minimumSize derives 3 × 5 = 15 for any ordinary produced-type count', () => {
    const frame = [entry('a1', 'alex', 'market_mover', '2026-07-27')];
    const s = sampleEditorialFrame(frame, { isoWeek: '2026-W31' });
    expect(s.minimumSize).toBe(15);
  });
});

// ── ISO week machinery + P2-33 ─────────────────────────────────────────────
describe('ISO week derivation (Amendment E)', () => {
  it('a Sunday belongs to the ISO week whose Mon–Fri just passed', () => {
    // Sunday Aug 2 2026 reviews W31 (Mon Jul 27 – Fri Jul 31).
    expect(isoWeekOf('2026-08-02')).toBe('2026-W31');
    expect(isoWeekDates('2026-08-02')).toEqual([
      '2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30',
      '2026-07-31', '2026-08-01', '2026-08-02',
    ]);
  });

  it('year-boundary weeks resolve to the Thursday-owning ISO year', () => {
    // Jan 1 2027 is a Friday → its ISO week is 2026-W53 (Thursday Dec 31 2026).
    expect(isoWeekOf('2027-01-01')).toBe('2026-W53');
    expect(isoWeekOf('2026-01-01')).toBe('2026-W01'); // Thu Jan 1 2026
  });

  it('P2-33: the July-4th week yields exactly its own 4 sessions — no spill from W26', () => {
    // 2026-W27 = Mon Jun 29 – Sun Jul 5; Fri Jul 3 is the observed holiday.
    const sessions = editorialSessionsFor('2026-07-05'); // the Sunday slot
    expect(sessions).toEqual(['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02']);
    // The A6 fault this row guards: a fixed-count backward walk would have
    // pulled Fri Jun 26 (W26) in as a fifth session and double-counted it
    // across two periods.
    expect(sessions).not.toContain('2026-06-26');
    expect(sessions).toHaveLength(4);
  });

  it('an ordinary week yields 5 sessions', () => {
    expect(editorialSessionsFor('2026-08-02')).toHaveLength(5);
  });
});

// ── Frame derivation ───────────────────────────────────────────────────────
const stampedEntry = (storyId, reporter, eventType, over = {}) => ({
  storyId, reporter, headline: 'H', publishedAt: `${over.date ?? '2026-07-27'}T18:00:00Z`,
  validatorVersion: '1.6.0', quarantined: over.quarantined ?? false,
  generationConfig: { generationVersion: 8, continuityEnabled: false },
  agentFacts: {
    eventType, tickers: over.tickers ?? [], digest: `${storyId} digest.`,
    schemaVersion: over.schemaVersion === undefined ? WIRE_SCHEMA_VERSION : over.schemaVersion,
    digestRendererVersion: WIRE_DIGEST_RENDERER_VERSION,
    validatorVersion: '1.6.0', chainId: storyId,
  },
});

function entry(storyId, reporter, eventType, marketDate) {
  return { storyId, reporter, eventType, marketDate, publishedAt: `${marketDate}T18:00:00Z` };
}

describe('deriveEditorialFrame', () => {
  it('collects renderable entries across sessions; quarantined and guard-failing entries never enter the frame', () => {
    const days = new Map([
      ['2026-07-27', { entries: [
        stampedEntry('s1', 'kai', 'index_move'),
        stampedEntry('sQ', 'kai', 'index_move', { quarantined: true }),
        stampedEntry('sU', 'alex', 'market_mover', { schemaVersion: 'wire-9.9' }),
      ] }],
      ['2026-07-28', { entries: [stampedEntry('s2', 'doug', 'earnings_recap')] }],
    ]);
    const frame = deriveEditorialFrame(days, ['2026-07-27', '2026-07-28', '2026-07-29']);
    expect(frame.map((f) => f.storyId)).toEqual(['s1', 's2']);
    expect(frame[0]).toMatchObject({ reporter: 'kai', eventType: 'index_move', marketDate: '2026-07-27' });
  });
});

// ── Deterministic sampling ─────────────────────────────────────────────────
const WEEK = { isoWeek: '2026-W31' };

/** A realistic 28-item week: kai 10 (5 index_move), alex 8, neta 4, doug 4, kim 2. */
function bigFrame() {
  const f = [];
  for (let i = 0; i < 5; i++) f.push(entry(`kai-im-${i}`, 'kai', 'index_move', '2026-07-27'));
  for (let i = 0; i < 5; i++) f.push(entry(`kai-tb-${i}`, 'kai', 'technical_break', '2026-07-28'));
  for (let i = 0; i < 8; i++) f.push(entry(`alex-${i}`, 'alex', 'market_mover', '2026-07-29'));
  for (let i = 0; i < 4; i++) f.push(entry(`neta-${i}`, 'neta', 'econ_print', '2026-07-30'));
  for (let i = 0; i < 4; i++) f.push(entry(`doug-${i}`, 'doug', 'earnings_recap', '2026-07-31'));
  for (let i = 0; i < 2; i++) f.push(entry(`kim-${i}`, 'kim', 'sector_rotation', '2026-07-31'));
  return f;
}

describe('sampleEditorialFrame — determinism (N3.2 seed contract)', () => {
  it('same inputs → identical sample; frame ARRAY ORDER is irrelevant', () => {
    const a = sampleEditorialFrame(bigFrame(), WEEK);
    const shuffled = [...bigFrame()].reverse();
    const b = sampleEditorialFrame(shuffled, WEEK);
    expect(a.sample.map((s) => s.storyId)).toEqual(b.sample.map((s) => s.storyId));
    expect(a.status).toBe('ok');
  });

  it('a different isoWeek (the seed) selects a different fill set', () => {
    const a = sampleEditorialFrame(bigFrame(), { isoWeek: '2026-W31' });
    const b = sampleEditorialFrame(bigFrame(), { isoWeek: '2026-W32' });
    expect(a.sample.map((s) => s.storyId)).not.toEqual(b.sample.map((s) => s.storyId));
  });

  it('a different reviewVersion reseeds too', () => {
    const a = sampleEditorialFrame(bigFrame(), { ...WEEK, reviewVersion: '1.0.0' });
    const b = sampleEditorialFrame(bigFrame(), { ...WEEK, reviewVersion: '2.0.0' });
    expect(a.sample.map((s) => s.storyId)).not.toEqual(b.sample.map((s) => s.storyId));
  });
});

describe('sampleEditorialFrame — coverage mandate', () => {
  it('every produced stratum is represented; index_move present whenever produced', () => {
    const s = sampleEditorialFrame(bigFrame(), WEEK);
    const sampledStrata = new Set(s.sample.map((x) => `${x.reporter}|${x.eventType}`));
    expect([...sampledStrata].sort()).toEqual(s.strata);
    expect(s.sample.some((x) => x.eventType === 'index_move')).toBe(true);
    // minimumSize 15 honored under the 20 ceiling on a 28-item frame.
    expect(s.sample.length).toBe(15);
    expect(s.sample.length).toBeLessThanOrEqual(EDITORIAL_SAMPLE_CEILING);
  });

  it('a frame smaller than minimumSize samples the WHOLE frame (sufficiency is the floor’s job at verdict time)', () => {
    const frame = [
      entry('a', 'alex', 'market_mover', '2026-07-27'),
      entry('b', 'kai', 'index_move', '2026-07-28'),
    ];
    const s = sampleEditorialFrame(frame, WEEK);
    expect(s.status).toBe('ok');
    expect(s.sample.map((x) => x.storyId).sort()).toEqual(['a', 'b']);
  });

  it('an empty frame samples nothing, status ok (the floor will rule)', () => {
    const s = sampleEditorialFrame([], WEEK);
    expect(s.status).toBe('ok');
    expect(s.sample).toEqual([]);
  });
});

describe('P2-10 — over-ceiling coverage → insufficient, never a dropped stratum', () => {
  it('more produced strata than the ceiling admits → insufficient with an empty sample', () => {
    // 5 strata under an injected ceiling of 4 (the vocabulary cannot produce
    // >20 strata today — the ceiling parameter is the P2-10 test surface).
    const frame = [
      entry('s1', 'kai', 'index_move', '2026-07-27'),
      entry('s2', 'kai', 'technical_break', '2026-07-27'),
      entry('s3', 'alex', 'market_mover', '2026-07-28'),
      entry('s4', 'neta', 'econ_print', '2026-07-29'),
      entry('s5', 'doug', 'earnings_recap', '2026-07-30'),
    ];
    const s = sampleEditorialFrame(frame, { ...WEEK, ceiling: 4 });
    expect(s.status).toBe('insufficient');
    expect(s.reason).toMatch(/strata \(5\) exceed the sample ceiling \(4\)/);
    // The A6 fault this row kills: dropping the lowest-priority stratum to
    // fit would have produced a 4-story sample here.
    expect(s.sample).toEqual([]);
  });

  it('a minimumSize mandate above the ceiling → insufficient (the Amendment C growth scenario)', () => {
    const seven = ['kai', 'alex', 'neta', 'doug', 'kim', 'vera', 'zed'];
    const s = sampleEditorialFrame(bigFrame(), { ...WEEK, activeReporters: seven });
    expect(s.status).toBe('insufficient');
    expect(s.reason).toMatch(/minimumSize \(21\) exceeds the sample ceiling \(20\)/);
    expect(s.sample).toEqual([]);
  });
});

describe('manifest (F-M8) — replay surface, not a re-derivation invitation', () => {
  it('records seed, order-independent frame fingerprint, strata, and the verbatim sample', () => {
    const frame = bigFrame();
    const s = sampleEditorialFrame(frame, WEEK);
    const m = buildEditorialManifest(frame, s, WEEK);
    expect(m.seed).toEqual({ isoWeek: '2026-W31', reviewVersion: '1.0.0' });
    expect(m.frameSize).toBe(28);
    expect(m.sample).toHaveLength(15);
    expect(m.samplingStatus).toBe('ok');
    expect(m.frameFingerprint).toBe(frameFingerprint([...frame].reverse()));
    // Frame growth changes the fingerprint — the signal a resume REPORTS
    // (P2-9) while still replaying the persisted sample verbatim.
    const grown = [...frame, entry('late-replay', 'doug', 'earnings_recap', '2026-07-28')];
    expect(frameFingerprint(grown)).not.toBe(m.frameFingerprint);
  });
});
