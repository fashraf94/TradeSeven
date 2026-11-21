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
