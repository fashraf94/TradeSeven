// src/components/League/battleArena/fuseGeometry.test.js
//
// The fuse board's pure core. The import loading clean in Node is the
// dependency-surface guard (BUILD_RULES §4 — never mocked): rankByScores is
// reached from src/constants/leagueTournament, not copied.
//
// The B2 rows drive the REAL appendTrailSnapshot from Phase 2 — the cut is
// tested against the actual accumulator's carry-forward, not a hand-built
// trail shape.

import { describe, it, expect } from 'vitest';
import {
  FH, fuseFrame, makeScale, catmullPath, spreadLabels, thinYLabels,
  etMinuteOfDay, sessionFraction, DAY_XLABELS, WEEK_XLABELS,
  latestTrailSnapshot, deriveCut, seatDaySeries, seatWeekSeries, weekTipF,
} from './fuseGeometry';
import { appendTrailSnapshot, emptyTrail } from './useSessionCompositeTrail';
import { rankByScores } from '../../../constants/leagueTournament';

const IDS = ['you', 'r1', 'r2', 'r3'];

// ── frame ───────────────────────────────────────────────────────────────────

describe('fuseFrame — fluid, TIPROOM reserved (R13 / acceptance 6)', () => {
  it('reserves the tip gutter at every width: plotR = max(padL+40, w − padR − TIPROOM)', () => {
    const wide = fuseFrame({ w: 1316, h: 420 });
    expect(wide.plotR).toBe(1316 - 24 - 156);
    // narrow desktop: the clamp floor engages rather than collapsing the plot
    const narrow = fuseFrame({ w: 200, h: 420 });
    expect(narrow.plotR).toBe(56 + 40);
    // compact uses the compact tokens
    const c = fuseFrame({ w: 374, h: 388, compact: true });
    expect(c.plotR).toBe(374 - 16 - 96);
    expect(c.LABEL_ROOM).toBe(FH.compact.LABEL_ROOM);
  });
});

// ── scale + basement (acceptance 4) ─────────────────────────────────────────

describe('makeScale — basement engages ONLY on !day && LO<0 && |LO| > 0.3·HI', () => {
  const GEO = { plotT: 42, floorY: 358 };

  it('day scope is always linear, even with a huge negative', () => {
    const s = makeScale({ values: [44, -575], day: true, ...GEO });
    expect(s.linear).toBe(true);
    expect(s.basement).toBe(0);
  });

  it('a trivial loss scales linearly through zero (−0.8 reads barely under water)', () => {
    const s = makeScale({ values: [44.5, -0.8], day: false, ...GEO });
    expect(s.linear).toBe(true);
    expect(s.basement).toBe(0);
  });

  it('the boundary is strict: |LO| exactly 0.3·HI does NOT engage', () => {
    const s = makeScale({ values: [100, -30], day: false, ...GEO });
    expect(s.basement).toBe(0);
    const s2 = makeScale({ values: [100, -30.01], day: false, ...GEO });
    expect(s2.basement).toBe(0.2);
    expect(s2.linear).toBe(false);
  });

  it('compressed mapping pins the three anchors: Y(HI)=plotT, Y(0)=zeroY, Y(LO)=floorY', () => {
    const s = makeScale({ values: [44, -575], day: false, ...GEO });
    expect(s.basement).toBe(0.2);
    expect(s.Y(44)).toBeCloseTo(GEO.plotT, 6);
    expect(s.Y(0)).toBeCloseTo(s.zeroY, 6);
    expect(s.Y(-575)).toBeCloseTo(GEO.floorY, 6);
    // and the basement band is exactly BASEMENT · spanY tall
    expect(GEO.floorY - s.zeroY).toBeCloseTo(0.2 * (GEO.floorY - GEO.plotT), 6);
  });

  it('linear mapping pins its endpoints too', () => {
    const s = makeScale({ values: [10, 4, -2], day: true, ...GEO });
    expect(s.Y(10)).toBeCloseTo(GEO.plotT, 6);
    expect(s.Y(-2)).toBeCloseTo(GEO.floorY, 6);
  });

  it('scales over ALL rendered values, not just tips (a mid-week peak cannot clip)', () => {
    // tips 5 and 3, but a path point at 12 — HI must cover 12
    const s = makeScale({ values: [5, 3, 12], day: false, ...GEO });
    expect(s.HI).toBe(12);
    expect(s.Y(12)).toBeGreaterThanOrEqual(GEO.plotT); // inside the plot
  });
});

// ── y labels (acceptance 5 — the three ranges named by the spec) ────────────

describe('thinYLabels — never overprints, priority order wins', () => {
  const GEO = { plotT: 42, floorY: 358 };
  const build = (values, day, cutRow) => {
    const s = makeScale({ values, day, ...GEO });
    const cands = [
      { v: s.HI, t: String(s.HI), y: s.Y(s.HI) },
      ...(cutRow != null ? [{ v: cutRow, t: 'CUT', y: s.Y(Math.min(cutRow, s.HI)) }] : []),
      { v: 0, t: day ? 'OPEN' : '0', y: s.Y(0) },
      ...(s.LO < 0 ? [{ v: s.LO, t: String(s.LO), y: s.Y(s.LO) }] : []),
    ];
    return thinYLabels(cands, 14);
  };

  for (const [label, values, day, cut] of [
    ['44.5', [44.5, 12, 3, -1], false, 40],
    ['−575', [44, -575, 10, 2], false, 30],
    ['44,000', [44000, 12000, 300, -900], false, 39000],
  ]) {
    it(`${label}: no two kept labels land within minGap`, () => {
      const kept = build(values, day, cut);
      expect(kept.length).toBeGreaterThan(0);
      for (let i = 0; i < kept.length; i++) {
        for (let j = i + 1; j < kept.length; j++) {
          expect(Math.abs(kept[i].y - kept[j].y), `${kept[i].t} vs ${kept[j].t}`).toBeGreaterThanOrEqual(14);
        }
      }
      // the top label always survives (first in priority)
      expect(kept[0].t).toBe(String(makeScale({ values, day, ...GEO }).HI));
    });
  }

  it('a CUT hugging the top drops (top has priority); zero survives', () => {
    const s = makeScale({ values: [100, -5], day: false, ...GEO });
    const kept = thinYLabels([
      { v: s.HI, t: 'top', y: s.Y(s.HI) },
      { v: 99, t: 'CUT', y: s.Y(99) },      // ~3px under the top
      { v: 0, t: '0', y: s.Y(0) },
    ], 14);
    expect(kept.map((k) => k.t)).toEqual(['top', '0']);
  });
});

// ── label spread (acceptance 7) ─────────────────────────────────────────────

describe('spreadLabels — anchors part, fuses stay', () => {
  it('four colliding seats de-collide to the minimum gap, inside bounds', () => {
    const y = spreadLabels(
      [{ id: 'a', y: 100 }, { id: 'b', y: 101 }, { id: 'c', y: 102 }, { id: 'd', y: 103 }],
      42, 62, 354,
    );
    const ys = ['a', 'b', 'c', 'd'].map((id) => y[id]).sort((p, q) => p - q);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(42);
    expect(ys[0]).toBeGreaterThanOrEqual(62);
    expect(ys[ys.length - 1]).toBeLessThanOrEqual(354);
  });

  it('non-colliding anchors are untouched (no gratuitous displacement)', () => {
    const y = spreadLabels([{ id: 'a', y: 80 }, { id: 'b', y: 200 }], 42, 62, 354);
    expect(y.a).toBe(80);
    expect(y.b).toBe(200);
  });
});

// ── path ────────────────────────────────────────────────────────────────────

describe('catmullPath', () => {
  it('passes through the endpoints exactly and emits cubic segments', () => {
    const d = catmullPath([{ x: 0, y: 10 }, { x: 50, y: 40 }, { x: 100, y: 20 }]);
    expect(d.startsWith('M0.0,10.0')).toBe(true);
    expect(d).toContain('C');
    expect(d.endsWith('100.0,20.0')).toBe(true);
  });
  it('degenerates cleanly: one point → a move, zero → empty', () => {
    expect(catmullPath([{ x: 3, y: 4 }])).toBe('M3.0,4.0');
    expect(catmullPath([])).toBe('');
  });
});

// ── the session clock ───────────────────────────────────────────────────────

describe('sessionFraction — x IS the clock (ET, Intl, never an offset)', () => {
  // 2026-08-26 is EDT (UTC−4): 9:30 ET = 13:30Z.
  const T = (hhmmZ) => Date.parse(`2026-08-26T${hhmmZ}:00Z`);
  it('pins open, close, and the three label times to their true fractions', () => {
    expect(sessionFraction(T('13:30'))).toBe(0);              // OPEN
    expect(sessionFraction(T('15:00'))).toBeCloseTo(90 / 390); // 11:00 ET
    expect(sessionFraction(T('16:30'))).toBeCloseTo(180 / 390); // 12:30 ET
    expect(sessionFraction(T('18:00'))).toBeCloseTo(270 / 390); // 14:00 ET
    expect(sessionFraction(T('20:00'))).toBe(1);              // CLOSE
  });
  it('clamps outside the session and tolerates garbage', () => {
    expect(sessionFraction(T('11:00'))).toBe(0);  // pre-open
    expect(sessionFraction(T('23:00'))).toBe(1);  // after hours
    expect(sessionFraction(NaN)).toBe(0);
  });
  it('the day x-labels sit at those same true fractions (not even slots)', () => {
    expect(DAY_XLABELS.map((l) => l.t)).toEqual(['OPEN', '11:00', '12:30', '14:00', 'CLOSE']);
    expect(DAY_XLABELS[1].f).toBeCloseTo(90 / 390);
    expect(WEEK_XLABELS.map((l) => l.t)).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI']);
    expect(WEEK_XLABELS.map((l) => l.f)).toEqual([0, 1 / 5, 2 / 5, 3 / 5, 4 / 5]);
  });
  it('etMinuteOfDay reads America/New_York regardless of host TZ', () => {
    expect(etMinuteOfDay(T('13:30'))).toBe(9 * 60 + 30);
  });
});

// ── the B2 cut ──────────────────────────────────────────────────────────────

describe('deriveCut — B2: one snapshot, server-identical ranking', () => {
  const BANKED = { you: 10, r1: 20, r2: 30, r3: 40 };

  it('empty/absent trail → the cut renders from the banked closes, never zero, never absent', () => {
    for (const trail of [undefined, null, emptyTrail(), emptyTrail({ ...BANKED })]) {
      const snap = latestTrailSnapshot(trail, IDS, BANKED);
      const cut = deriveCut(snap, IDS, 'you');
      expect(cut.cutTotal).toBe(30);            // 2nd place of the banked closes
      expect(cut.needToday).toBe(20);           // 30 − 10
      expect(cut.leaderId).toBe('r3');
      expect(cut.cutTotal).not.toBe(0);
    }
  });

  it('the cut is the 2nd-place value under the SAME rankByScores the server locks with', () => {
    const values = { you: 12, r1: 44, r2: 44, r3: 3 }; // tie at the top
    const snap = { values, hasSamples: true, t: 1 };
    const cut = deriveCut(snap, IDS, 'you');
    const ranking = rankByScores(values, IDS);   // the lockTopTwo input, verbatim
    expect(cut.ranked).toEqual(ranking);
    expect(cut.cutTotal).toBe(values[ranking[1]]);
  });

  it('B2 ACCEPTANCE: a dropped rival poll does not move the rendered cut', () => {
    // Three snapshots through the REAL accumulator; r2 (the 2nd-place seat,
    // the cut seat) is missing from the middle poll.
    const live = (m) => Object.fromEntries(IDS.map((id) => [id, m[id] != null]));
    let trail = emptyTrail({ ...BANKED });
    const s1 = { you: 15, r1: 22, r2: 31, r3: 41 };
    trail = appendTrailSnapshot(trail, { ids: IDS, scoresAtLast: s1, seatLive: live(s1), t: 1_000 });
    const cut1 = deriveCut(latestTrailSnapshot(trail, IDS, BANKED), IDS, 'you');

    // r2's poll drops — scoresAtLast FLOORS it to banked 30 (the seatAltitude
    // floor); seatLive says it is not a real reading. The trail carries 31.
    const s2 = { you: 16, r1: 23, r2: 30, r3: 42 };
    trail = appendTrailSnapshot(trail, {
      ids: IDS, scoresAtLast: s2, seatLive: { you: true, r1: true, r2: false, r3: true }, t: 61_000,
    });
    const cut2 = deriveCut(latestTrailSnapshot(trail, IDS, BANKED), IDS, 'you');

    const s3 = { you: 17, r1: 24, r2: 31, r3: 43 };
    trail = appendTrailSnapshot(trail, { ids: IDS, scoresAtLast: s3, seatLive: live(s3), t: 121_000 });
    const cut3 = deriveCut(latestTrailSnapshot(trail, IDS, BANKED), IDS, 'you');

    expect(cut1.cutTotal).toBe(31);
    expect(cut2.cutTotal).toBe(31);   // held — NOT the banked 30 flicker
    expect(cut3.cutTotal).toBe(31);
    expect(new Set([cut1.cutTotal, cut2.cutTotal, cut3.cutTotal].map(String)).size).toBe(1);
  });

  it('the prohibited parallel read WOULD flicker (the defect B2 exists to prevent)', () => {
    // Characterizes the hazard: scoresAtLast itself, read directly for the cut,
    // moves when r2's poll drops. If this stops failing-the-naive-way, B2's
    // rationale needs re-examination.
    const naiveCut2 = [...IDS].sort((a, b) => ({ you: 16, r1: 23, r2: 30, r3: 42 }[b] - { you: 16, r1: 23, r2: 30, r3: 42 }[a]))[1];
    expect({ you: 16, r1: 23, r2: 30, r3: 42 }[naiveCut2]).toBe(30); // ≠ the held 31
  });
});

// ── series builders ─────────────────────────────────────────────────────────

describe('seat series — real points only', () => {
  const T0 = Date.parse('2026-08-26T13:30:00Z'); // OPEN
  it('day: relative to seed, anchored level at the open', () => {
    const pts = seatDaySeries({
      samples: [{ t: T0 + 60_000, v: 12 }, { t: T0 + 120_000, v: 14 }],
      seed: 10,
    });
    expect(pts[0]).toEqual({ f: 0, v: 0 });
    expect(pts[1].v).toBe(2);
    expect(pts[2].v).toBe(4);
    expect(pts[1].f).toBeGreaterThan(0);
  });
  it('day: no samples → [] (the caller draws the flat spine + tip, R3 reload state)', () => {
    expect(seatDaySeries({ samples: [], seed: 10 })).toEqual([]);
    expect(seatDaySeries({ samples: undefined, seed: 10 })).toEqual([]);
  });
  it('week: anchored at the open, closes at (i+1)/5, live tip burns within its band', () => {
    const pts = seatWeekSeries({ closes: [5, 9], tipValue: 11, tipF: weekTipF(2, 0.5), live: true });
    expect(pts[0]).toEqual({ f: 0, v: 0 });          // Monday open — a real zero
    expect(pts[1]).toEqual({ f: 1 / 5, v: 5 });      // Mon close
    expect(pts[2]).toEqual({ f: 2 / 5, v: 9 });      // Tue close
    expect(pts[3].f).toBeCloseTo(2.5 / 5);           // Wed, half burned
    expect(pts[3].v).toBe(11);
    const fresh = seatWeekSeries({ closes: [], tipValue: 3, tipF: weekTipF(0, 0.4), live: true });
    expect(fresh[0]).toEqual({ f: 0, v: 0 });
    expect(fresh[1].f).toBeCloseTo(0.4 / 5);         // Monday burns inside ITS band (no degenerate Friday clamp)
    expect(fresh[1].v).toBe(3);
  });
  it('week complete: closes only, no tip appended; Friday close lands at f=1', () => {
    const pts = seatWeekSeries({ closes: [5, 9, 12, 13, 14], tipValue: 14, tipF: 1, live: false });
    expect(pts).toHaveLength(6);                     // open anchor + five closes
    expect(pts[5]).toEqual({ f: 1, v: 14 });
  });
});
