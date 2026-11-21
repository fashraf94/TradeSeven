// src/screens/filmRoomV2/filmRoomFlow.d2carried.test.js
//
// Film Room D2, part 2 — D1's carried fixes in the front's MODEL (filmRoomFlow.js), each a row that FAILED at
// `56220130` (main with #1102, run in an LF git archive before any code change; build report
// docs/audits/20261122_BUILD_FILM_ROOM_D2_WORDS.md), beside its controls (said so in their names):
//   DC-1 (Build D Amendment C)  a final day also needs a completed battle
//   DC-8 (Amendment C)          ties at the low are decided on displayed hundredths, checks and the final alike
//   DD-4 (Amendment D; Astra's N5)  the grouping compares the clamped elapsed-time separation with 44 px EXACTLY, by
//                               integer cross-products, before any coordinate is computed — the chart widths 329, 330
//                               and 331 (the viewport rows 369, 370 and 371 run in Chromium: the report's browser checks)

import { describe, it, expect } from 'vitest';
import { flowOf, lowOf, isFinalDayOf, readsAsFinal, groupPins, choosePins, domainOf, FLOW_PIN_TOUCH } from './filmRoomFlow.js';
import { sep23Tape, clone, battleOf } from './__fixtures__/filmRoomHarness';

const D = sep23Tape.etDate;

describe('DC-1 — a final day also needs a completed battle (Amendment C)', () => {
  it('DC-1: isFinalDay true with the battle block ACTIVE reads as any other day — its date, the last check, no final point', () => {
    const t = clone(sep23Tape);
    t.battle.status = 'active';
    expect(isFinalDayOf(t, battleOf(sep23Tape))).toBe(false);
    expect(readsAsFinal(t, battleOf(sep23Tape))).toBe(false);
    const f = flowOf(t, { battle: battleOf(sep23Tape) });
    expect(f.heading.kind).toBe('date');
    expect([f.key.you.path.join('.'), f.key.you.value]).toEqual(['score.lastCheck.total', -47]);
    expect(f.lines.you.points.some((p) => p.final)).toBe(false);
  });
  it('DC-1: no battle block at all beside isFinalDay true — any other day', () => {
    const t = clone(sep23Tape);
    delete t.battle;
    expect(isFinalDayOf(t)).toBe(false);
  });
  it('DC-1\'s control (passes at both heads): isFinalDay true on a COMPLETED battle is final — "Won by 46"', () => {
    expect(isFinalDayOf(sep23Tape)).toBe(true);
    expect(flowOf(sep23Tape, { battle: battleOf(sep23Tape) }).heading).toMatchObject({ kind: 'won', margin: { text: '46' } });
  });
});

describe('DC-8 — ties at the low on displayed hundredths (Amendment C; BUILD_RULES §9)', () => {
  const day = (totals, { final = null } = {}) => {
    const t = clone(sep23Tape);
    t.checks = totals.map((v, i) => ({ at: new Date(Date.parse('2026-09-23T14:00:00.000Z') + i * 900_000).toISOString(), tickSeq: i + 1, state: 'completed', scores: { total: v, opponent: -1 } }));
    if (final === null) { t.battle.status = 'active'; t.isFinalDay = false; } else t.battle.final.total = final;
    return t;
  };
  it('DC-8: two checks whose raw values differ below a hundredth and DISPLAY equal — the earliest is the low', () => {
    // −5.001 and −5.004 both display "−5"; the later one is lower by its raw value
    const low = lowOf(day([1, -5.001, 3, -5.004, 2]));
    expect([low.index, low.clock, low.eligible]).toEqual([1, '10:15 AM', true]);
  });
  it('DC-8\'s control (passes at both heads): the lower raw value FIRST — the earliest still (it is also the raw minimum)', () => {
    expect(lowOf(day([1, -5.004, 3, -5.001, 2])).index).toBe(1);
  });
  it('DC-8\'s control (passes at both heads): values that display apart — the lower displayed value wins wherever it is', () => {
    expect(lowOf(day([1, -5, 3, -5.01, 2])).index).toBe(3);
  });
  it('DC-8\'s control (passes at both heads): a final that displays equal to the low, above it by its raw value — the line ends at the low: no mark', () => {
    expect(lowOf(day([1, -5.004, 3, 2], { final: -5.001 })).eligible).toBe(false);
  });
});

// Astra's N5: the regular Sep 23 session (9:30 to 4:00, 390 minutes), just two directives, at 9:35 and 10:35 ET — the
// first member five minutes from the axis's origin. At a 330 px chart (a 370 px viewport) the drawable span is 286 px
// and the two centres are 60 × 286 / 390 = 44 px apart EXACTLY: two groups (FL-4: a new group at equality).
function twoDirectives() {
  const t = clone(sep23Tape);
  t.actions = [];
  t.directives = [
    { ...clone(sep23Tape.directives[0]), filedAt: '2026-09-23T13:35:00.000Z' },
    { ...clone(sep23Tape.directives[1]), filedAt: '2026-09-23T14:35:00.000Z' },
  ];
  return t;
}

describe('DD-4 — exact grouping (Amendment D; Astra\'s N5)', () => {
  const groupsAt = (width, t = twoDirectives()) => groupPins(flowOf(t, { battle: battleOf(sep23Tape) }).pins, width).map((g) => g.members.map((m) => m.n));
  it('the fixture is what N5 names: the regular session, the two directives five and sixty-five minutes after the open', () => {
    const t = twoDirectives();
    const d = domainOf(t);
    expect(d.endMs - d.startMs).toBe(390 * 60_000);
    expect(choosePins(t).pins.map((p) => (p.t - d.startMs) / 60_000)).toEqual([5, 65]);
  });
  it('DD-4: a 330 px chart — the two centres exactly 44 px apart — two groups, two stops', () => {
    expect(groupsAt(330)).toEqual([[1], [2]]);
  });
  it('DD-4\'s controls (pass at both heads): 329 px — 43.85 px apart — one group; 331 px — 44.15 px — two', () => {
    expect(groupsAt(329)).toEqual([[1, 2]]);
    expect(groupsAt(331)).toEqual([[1], [2]]);
  });
  it('DD-4: the decision is the integer cross-product — every width from 280 to 1440 agrees with the exact rational oracle', () => {
    const t = twoDirectives();
    const flow = flowOf(t, { battle: battleOf(sep23Tape) });
    const d = flow.domain;
    const span = d.endMs - d.startMs;
    const sep = flow.pins[1].t - flow.pins[0].t;
    for (let w = 280; w <= 1440; w += 1) {
      // closer than 44 px ⇔ sep × (w − 44) < 44 × span — BigInt, so no float can round it
      const merged = BigInt(sep) * BigInt(w - FLOW_PIN_TOUCH) < BigInt(FLOW_PIN_TOUCH) * BigInt(span);
      expect(groupPins(flow.pins, w).length, `width ${w}`).toBe(merged ? 1 : 2);
    }
  });
  it('DD-4\'s control (passes at both heads): a pin before the open or after the close is clamped to its edge BEFORE the separation is taken', () => {
    const t = twoDirectives();
    t.directives[0].filedAt = '2026-09-22T23:00:00.000Z';   // the evening before: the open's edge (DA-2)
    t.directives[1].filedAt = '2026-09-23T14:30:00.000Z';   // sixty minutes after the open
    expect(groupsAt(330, t)).toEqual([[1], [2]]);           // 60 × 286 / 390 = 44 exactly, measured from the edge
    expect(groupsAt(329, t)).toEqual([[1, 2]]);
  });
});
