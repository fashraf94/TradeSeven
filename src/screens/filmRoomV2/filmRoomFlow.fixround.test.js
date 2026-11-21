// src/screens/filmRoomV2/filmRoomFlow.fixround.test.js
//
// Film Room D1 fix round — the MODEL's rows (build report §11). Astra's D1 review
// (docs/audits/20261121_ASTRA_REVIEW_FILM_ROOM_D1_FLOW.md §1) findings as rows, each of which FAILED at the reviewed
// head 368dc113 (run in an LF git archive before any code change), and the rulings that closed them: Build D
// Amendment A (DA-4, DA-8, DA-9, DA-11, DA-15) and Amendment B (DB-1, DB-2, DB-6 – DB-9, DB-14).

import { describe, it, expect } from 'vitest';
import { flowOf, headingOf, keyOf, linesOf, isFinalDayOf, readsAsFinal } from './filmRoomFlow.js';
import sep23Tape from './__fixtures__/sep23.tape.json';

const clone = (v) => JSON.parse(JSON.stringify(v));
/** The battle document beside a tape (the harness's battleOf, without its React imports: this suite is Node). */
const battleOf = (tape, over = {}) => ({ id: tape.battleId, status: 'completed', completedAt: tape.battle?.completedAt ?? null, timing: { tradingDays: [tape.etDate] }, ...over });
const D = sep23Tape.etDate;
const D24 = '2026-09-24';
const ACTIVE = { status: 'active', completedAt: null, final: null, result: { value: null, basis: 'not_completed' }, completionMessage: null };
const finalEnds = (f) => [f.lines.you, f.lines.cpu].filter(Boolean).flatMap((l) => l.points.filter((p) => p.final));

describe('item 1 — F1: a margin needs both finals in the key (Amendment B DB-1)', () => {
  it('F1: a tape written before Build B1 (no score.opponentBasis) — the key shows no CPU entry, so the heading holds no margin', () => {
    const t = clone(sep23Tape);
    delete t.score.opponentBasis;
    const f = flowOf(t, { battle: battleOf(t) });
    expect(f.key.cpu).toBeNull();
    expect(f.heading.kind).toBe('won');
    expect(f.heading.margin ?? null).toBeNull();
  });
  it('an unknown basis: the result word alone; a loss and a draw likewise; the normal CPU battle keeps "Won by 46"', () => {
    const t = clone(sep23Tape);
    t.score.opponentBasis = 'mystery_basis';
    expect(headingOf(t)).toEqual({ kind: 'won', margin: null });
    t.battle.result.value = 'loss';
    expect(headingOf(t)).toEqual({ kind: 'lost', margin: null });
    t.battle.result.value = 'draw';
    expect(headingOf(t)).toEqual({ kind: 'draw' });
    expect(headingOf(sep23Tape)).toMatchObject({ kind: 'won', margin: { value: 46, text: '46', aggregate: 'difference(the two displayed final scores)', cls: 'derived' } });
  });
  it('the result recorded, the opponent\'s final not (the CPU basis, no value to show): the result word — never "Final {total}" (DB-1 over DA-9\'s note; question in §11)', () => {
    const t = clone(sep23Tape);
    t.battle.final.opponent = null;
    expect(keyOf(t).cpu).toBeNull();
    expect(headingOf(t)).toEqual({ kind: 'won', margin: null });
  });
});

describe('item 1 — F2: a day is final only on evidence (Amendment B DB-2)', () => {
  it('F2: isFinalDay null, a completion on the NEXT day, finals +80 / +20 — any other day: its date, the last check (−47), no final endpoint', () => {
    const t = clone(sep23Tape);
    t.isFinalDay = null;
    t.battle.completedAt = '2026-09-24T20:05:00.000Z';
    t.battle.final = { total: 80, opponent: 20, at: '2026-09-24T20:05:00.000Z' };
    const f = flowOf(t, { battle: battleOf(t, { timing: { tradingDays: [D, D24] } }) });
    expect(f.heading).toEqual({ kind: 'date', date: 'Wed, Sep 23, 2026' });
    expect([f.key.you.path.join('.'), f.key.you.value]).toEqual(['score.lastCheck.total', -47]);
    expect(f.lines.you.points.some((p) => p.final)).toBe(false);
  });
  it('the four readings: true is final; false and null are any other day', () => {
    const t = (v) => { const x = clone(sep23Tape); x.isFinalDay = v; return x; };
    expect([true, false, null].map((v) => isFinalDayOf(t(v), battleOf(sep23Tape)))).toEqual([true, false, null].map((v) => v === true));
    expect(['won', 'date', 'date']).toEqual([true, false, null].map((v) => flowOf(t(v), { battle: battleOf(sep23Tape) }).heading.kind));
    // DB-2's letter: `true` is the writer's reading of the validated timeline, whatever the copied battle block says
    // (the head also required `completed` — the report's §11 asks whether that should stay)
    const active = t(true); active.battle.status = 'active';
    expect(isFinalDayOf(active)).toBe(true);
  });
  it('NO isFinalDay field (a tape written before it): final only when the battle completed AND its validated final trading day is this date', () => {
    const legacy = (status = 'completed') => { const x = clone(sep23Tape); delete x.isFinalDay; x.battle.status = status; return x; };
    expect(isFinalDayOf(legacy(), battleOf(sep23Tape))).toBe(true);                                             // a genuine legacy final
    expect(flowOf(legacy(), { battle: battleOf(sep23Tape) }).heading).toMatchObject({ kind: 'won', margin: { text: '46' } });
    expect(isFinalDayOf(legacy(), battleOf(sep23Tape, { timing: { tradingDays: [D, D24] } }))).toBe(false);   // the battle's last day is later
    expect(isFinalDayOf(legacy(), battleOf(sep23Tape, { timing: { tradingDays: [D, '2026-09-26'] } }))).toBe(false);   // a timeline that does not validate (a Saturday)
    expect(isFinalDayOf(legacy(), battleOf(sep23Tape, { timing: undefined }))).toBe(false);                   // no timeline: no evidence
    expect(isFinalDayOf(legacy())).toBe(false);                                                               // no battle document
    expect(isFinalDayOf(legacy('active'), battleOf(sep23Tape))).toBe(false);                                  // not completed
    expect(flowOf(legacy(), { battle: battleOf(sep23Tape, { timing: { tradingDays: [D, D24] } }) }).heading.kind).toBe('date');
  });
});

describe('item 1 — DA-4: two finals that DISPLAY equal show no margin (as Astra qualified it, DB-14)', () => {
  const finals = (total, opponent, result = 'win') => { const t = clone(sep23Tape); t.battle.final.total = total; t.battle.final.opponent = opponent; t.battle.result.value = result; return t; };
  it('raw finals that round to one display (+10.001 / +10.004): "Won" / "Lost", no margin', () => {
    expect(headingOf(finals(10.001, 10.004))).toEqual({ kind: 'won', margin: null });
    expect(headingOf(finals(10.004, 10.001, 'loss'))).toEqual({ kind: 'lost', margin: null });
  });
  it('opposite signed rounded zeros (−0.004 / +0.004): both display 0 — no margin', () => {
    expect(headingOf(finals(-0.004, 0.004))).toEqual({ kind: 'won', margin: null });
    expect(headingOf(finals(0.004, -0.004, 'loss'))).toEqual({ kind: 'lost', margin: null });
  });
  it('a genuine draw: "Draw"; one hundredth apart: "Won by 0.01"', () => {
    expect(headingOf(finals(5, 5, 'draw'))).toEqual({ kind: 'draw' });
    expect(headingOf(finals(5.01, 5))).toMatchObject({ kind: 'won', margin: { text: '0.01', value: 0.01 } });
  });
});

describe('item 1 — DA-9: a final day with no recorded final total reads as any other day (one decision, DB-14)', () => {
  it('the player\'s final null, the CPU\'s final apart from its last check: the date, BOTH keys the last check\'s, no final endpoint on either line', () => {
    const t = clone(sep23Tape);
    t.battle.final.total = null;
    t.battle.final.opponent = -200;   // apart from the last check's −83
    const f = flowOf(t, { battle: battleOf(t) });
    expect(readsAsFinal(t, battleOf(t))).toBe(false);
    expect(f.heading).toEqual({ kind: 'date', date: 'Wed, Sep 23, 2026' });
    expect([f.key.you.path.join('.'), f.key.cpu.path.join('.'), f.key.cpu.value]).toEqual(['score.lastCheck.total', 'score.lastCheck.opponent', -83]);
    expect(finalEnds(f)).toEqual([]);
    expect(f.lines.cpu.points.at(-1)).toMatchObject({ v: -83, i: 22 });
  });
  it('the same with no checks at all: the date, no lines, no endpoint', () => {
    const t = clone(sep23Tape);
    t.battle.final.total = null;
    t.checks = [];
    const f = flowOf(t, { battle: battleOf(t) });
    expect(f.heading.kind).toBe('date');
    expect(finalEnds(f)).toEqual([]);
    expect(linesOf(t).you.runs).toEqual([]);
  });
  it('a recorded player final with no recorded result: "Final {total}" — with or without the opponent\'s final', () => {
    for (const opponent of [-93, null]) {
      const t = clone(sep23Tape);
      t.battle.result = { value: null, basis: 'unknown' };
      t.battle.final.opponent = opponent;
      expect(headingOf(t)).toEqual({ kind: 'final', total: { value: -47, cls: 'recorded', path: ['battle', 'final', 'total'] } });
    }
  });
  it('an active battle on its final trading day (isFinalDay true, no battle.final yet) reads as any other day', () => {
    const t = clone(sep23Tape);
    t.battle = clone(ACTIVE);
    const f = flowOf(t, { battle: battleOf(t, { status: 'active' }) });
    expect(f.heading.kind).toBe('date');
    expect(finalEnds(f)).toEqual([]);
  });
});
