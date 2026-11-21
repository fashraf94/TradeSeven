// src/screens/filmRoomV2/filmRoomFlow.fixround.test.js
//
// Film Room D1 fix round — the MODEL's rows (build report §11). Astra's D1 review
// (docs/audits/20261121_ASTRA_REVIEW_FILM_ROOM_D1_FLOW.md §1) findings as rows, each of which FAILED at the reviewed
// head 368dc113 (run in an LF git archive before any code change), and the rulings that closed them: Build D
// Amendment A (DA-4, DA-8, DA-9, DA-11, DA-15) and Amendment B (DB-1, DB-2, DB-6 – DB-9, DB-14).

import { describe, it, expect } from 'vitest';
import { flowOf, headingOf, keyOf, linesOf, isFinalDayOf, readsAsFinal, layoutOf, panelOf, domainOf } from './filmRoomFlow.js';
import { sessionOf, etClock } from './filmRoomModel';
import sep23Tape from './__fixtures__/sep23.tape.json';

const clone = (v) => JSON.parse(JSON.stringify(v));
/** The battle document beside a tape (the harness's battleOf, without its React imports: this suite is Node). */
const battleOf = (tape, over = {}) => ({ id: tape.battleId, status: 'completed', completedAt: tape.battle?.completedAt ?? null, timing: { tradingDays: [tape.etDate] }, ...over });
const D = sep23Tape.etDate;
const D24 = '2026-09-24';
const ACTIVE = { status: 'active', completedAt: null, final: null, result: { value: null, basis: 'not_completed' }, completionMessage: null };
const finalEnds = (f) => [f.lines.you, f.lines.cpu].filter(Boolean).flatMap((l) => l.points.filter((p) => p.final));
const iso = (s) => `${D}T${s}:00.000Z`;
/** A check row of the fixture's shape at `at`, its scores `total` / `opponent` — or no scores block at all (null). */
const check = (seq, at, total, opponent = null) => ({ ...clone(sep23Tape.checks[0]), tickSeq: seq, tickId: `x:${seq}`, key: `seq:${seq}`, at, scores: total === null ? null : { active: total, banked: 0, total, opponent } });
const directive = (filedAt, k = 0) => ({ ...clone(sep23Tape.directives[k]), filedAt });
/** Run `read` under each time zone in turn; the zone restored after. Returns each zone's result and its UTC offset. */
function inZones(zones, read) {
  const was = process.env.TZ;
  const offset = () => new Date(Date.UTC(2026, 8, 23, 12)).getTimezoneOffset();
  try {
    return zones.map((z) => { process.env.TZ = z; return { offset: offset(), out: read() }; });
  } finally {
    if (was === undefined) delete process.env.TZ; else process.env.TZ = was;
  }
}

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

describe('item 2 — F6: strict instants only (DB-6)', () => {
  /** The review's saved document: a directive filed at a time with no zone, and one with an explicit Z. */
  const zoneless = () => {
    const t = clone(sep23Tape);
    t.actions = [];
    t.directives = [directive('2026-09-23T14:00', 0), directive('2026-09-23T16:00Z', 1)];
    return t;
  };
  it('F6: the directive with no zone is never placed — counted in "more"; the Z form beside it is placed, at noon ET', () => {
    const f = flowOf(zoneless(), { battle: battleOf(sep23Tape) });
    expect(f.pins.map((p) => `${p.src}:${p.index}`)).toEqual(['directive:1']);
    expect(f.more.value).toBe(1);
    expect(etClock('2026-09-23T16:00Z')).toBe('12:00 PM');
  });
  it('F6: the same bytes under TZ=UTC and TZ=America/Chicago — identical pins, numbers, clocks and groups', () => {
    const bytes = JSON.stringify(zoneless());
    const read = () => {
      const t = JSON.parse(bytes);
      const f = flowOf(t, { battle: battleOf(t) });
      const lay = layoutOf(f, 350, 150);
      return {
        pins: f.pins.map((p) => [p.src, p.index, p.n, p.frac, p.v]),
        more: f.more.value,
        clocks: f.pins.map((p) => panelOf(t, p).clock),
        groups: lay.groups.map((g) => g.members.map((x) => x.n)),
        axis: f.axis,
      };
    };
    const was = process.env.TZ;
    const offset = () => new Date(Date.UTC(2026, 8, 23, 12)).getTimezoneOffset();
    try {
      process.env.TZ = 'UTC';
      const o0 = offset();
      const a = read();
      process.env.TZ = 'America/Chicago';
      const o1 = offset();
      const b = read();
      expect([o0, o1]).toEqual([0, 300]);   // the control: the zone did change (CDT is UTC−5)
      expect(b).toEqual(a);
    } finally {
      if (was === undefined) delete process.env.TZ; else process.env.TZ = was;
    }
  });
});

describe('item 2 — F8: no time basis, no chart (DB-8)', () => {
  const D28 = '2028-03-15';   // a Wednesday past the calendar's maintained horizon (2027)
  const unknownDay = (checks, directives) => {
    const t = clone(sep23Tape);
    t.etDate = D28;
    t.isFinalDay = false;
    t.battle = clone(ACTIVE);
    t.checks = checks;
    t.actions = [];
    t.directives = directives;
    return t;
  };
  it('F8: one check at 10:15 AM ET on a date the calendar does not know — no domain, no axis, no pin; the directive counted in "more"', () => {
    expect(sessionOf(D28)).toBeNull();   // the control: the calendar does not know the date
    const t = unknownDay([check(1, '2028-03-15T14:15:00.000Z', 12, 3)], [directive('2028-03-15T15:00:00.000Z')]);
    const f = flowOf(t, { battle: battleOf(t) });
    expect(f.domain).toBeNull();
    expect(f.axis).toEqual([]);
    expect(f.pins).toEqual([]);
    expect(f.more.value).toBe(1);
  });
  it('F8: no checks, two directives three hours apart — never stacked at a fictitious origin: no pin, both counted', () => {
    const t = unknownDay([], [directive('2028-03-15T14:00:00.000Z', 0), directive('2028-03-15T17:00:00.000Z', 1)]);
    const f = flowOf(t, { battle: battleOf(t) });
    expect(f.pins).toEqual([]);
    expect(f.more.value).toBe(2);
  });
});

describe('item 2 — DB-6: every instant the front reads is strict', () => {
  it('the forms kept: Z with milliseconds, an offset, and minutes without seconds — each placed at the same instant', () => {
    for (const at of ['2026-09-23T16:00:00.000Z', '2026-09-23T12:00:00-04:00', '2026-09-23T16:00Z']) {
      const t = clone(sep23Tape);
      t.actions = [];
      t.directives = [directive(at)];
      const f = flowOf(t, { battle: battleOf(t) });
      expect(f.pins.map((p) => [p.t, p.frac]), at).toEqual([[Date.parse('2026-09-23T16:00:00.000Z'), 150 / 390]]);
      expect(panelOf(t, f.pins[0]).clock, at).toBe('12:00 PM');
    }
  });
  it('the refused forms — no zone, a date alone, an impossible clock, words — are never placed, each counted in "more"', () => {
    const t = clone(sep23Tape);
    t.actions = [];
    t.directives = ['2026-09-23T14:00', '2026-09-23T14:00:00', '2026-09-23', '2026-09-23T24:00:00Z', '9/23/2026 10:00 AM'].map((at) => directive(at));
    const f = flowOf(t, { battle: battleOf(t) });
    expect(f.pins).toEqual([]);
    expect(f.more.value).toBe(5);
  });
  it('a CHECK whose instant has no zone breaks its line (and is never the low); a SWAP whose instant has none is counted', () => {
    const t = clone(sep23Tape);
    t.checks[5].at = '2026-09-23T15:30:20';   // the writer's −41 at 11:30 AM, its zone lost
    t.actions[1].at = '2026-09-23T18:00:05';  // the agent's swap, its zone lost
    const f = flowOf(t, { battle: battleOf(t) });
    expect(f.lines.you.runs.map((r) => r.length)).toEqual([5, 18]);
    expect(f.pins.some((p) => p.src === 'action' && p.index === 1)).toBe(false);
    expect(f.more.value).toBe(1);   // the zoneless swap — the five placeable rows left are all chosen
  });
  it('the same bytes under TZ=UTC and TZ=America/Chicago, zoneless checks and swaps included — identical pins, lines, low, clocks and groups', () => {
    const t = clone(sep23Tape);
    t.checks[5].at = '2026-09-23T15:30:20';
    t.actions[1].at = '2026-09-23T18:00:05';
    t.directives[0].filedAt = '2026-09-23T17:40';
    const bytes = JSON.stringify(t);
    const read = () => {
      const x = JSON.parse(bytes);
      const f = flowOf(x, { battle: battleOf(x) });
      const lay = layoutOf(f, 350, 150, 'Low −92 · 1:30 PM');
      return { pins: f.pins.map((p) => [p.src, p.index, p.n, p.frac, p.v]), more: f.more.value, runs: f.lines.you.runs.map((r) => r.map((p) => [p.t, p.v])), low: f.low && [f.low.index, f.low.clock], clocks: f.pins.map((p) => panelOf(x, p).clock), groups: lay.groups.map((g) => g.members.map((p) => p.n)), axis: f.axis };
    };
    const [a, b] = inZones(['UTC', 'America/Chicago'], read);
    expect([a.offset, b.offset]).toEqual([0, 300]);
    expect(b.out).toEqual(a.out);
  });
});

describe('item 2 — DB-8: no time basis, no chart; with a session, the calendar\'s axis stands', () => {
  const D28 = '2028-03-15';
  const unknownDay = (checks, directives, final = false) => {
    const t = clone(sep23Tape);
    t.etDate = D28;
    t.isFinalDay = final;
    if (!final) t.battle = clone(ACTIVE);
    t.checks = checks;
    t.actions = [];
    t.directives = directives;
    return t;
  };
  const at28 = (hm) => `${D28}T${hm}:00.000Z`;
  it.each([
    ['zero checks', []],
    ['one check', [check(1, at28('14:15'), 12, 3)]],
    ['several checks at one instant', [check(1, at28('14:15'), 12, 3), check(2, at28('14:15'), 13, 3), check(3, at28('14:15'), null)]],
  ])('%s: no domain — with no events nothing counted, with two events both counted', (_, checks) => {
    const none = flowOf(unknownDay(clone(checks), []));
    expect([none.domain, none.axis, none.pins, none.more.value, none.legend]).toEqual([null, [], [], 0, []]);
    const two = flowOf(unknownDay(clone(checks), [directive(at28('15:00'), 0), directive(at28('18:00'), 1)]));
    expect([two.domain, two.pins, two.more.value]).toEqual([null, [], 2]);
  });
  it('two distinct strict instants are a time basis: the first check to the last; a zoneless one does not count toward two', () => {
    const t = unknownDay([check(1, at28('14:15'), 12, 3), check(2, at28('15:15'), 14, 3)], []);
    expect(domainOf(t)).toEqual({ startMs: Date.parse(at28('14:15')), endMs: Date.parse(at28('15:15')), session: false });
    t.checks[1].at = `${D28}T15:15:00`;
    expect(domainOf(t)).toBeNull();
  });
  it('the final day on a date the calendar does not know, one check: no chart, the key keeps the recorded finals, the heading its result', () => {
    const t = unknownDay([check(1, at28('14:15'), 12, 3)], [], true);
    const f = flowOf(t, { battle: battleOf(t) });
    expect(f.domain).toBeNull();
    expect([f.key.you.path.join('.'), f.key.you.value, f.key.cpu.value]).toEqual(['battle.final.total', -47, -93]);
    expect(f.heading).toMatchObject({ kind: 'won', margin: { text: '46' } });
    expect(finalEnds(f)).toEqual([]);
  });
  it('a known session with no checks at all: the calendar\'s axis, 9:30 AM to 4:00 PM, and the pins placed on it', () => {
    expect(sessionOf(D)).not.toBeNull();
    const t = clone(sep23Tape);
    t.checks = [];
    const f = flowOf(t, { battle: battleOf(t) });
    expect(f.axis).toEqual(['9:30 AM', '12:45 PM', '4:00 PM']);
    expect(f.pins).toHaveLength(5);
    expect(etClock(new Date(f.domain.endMs).toISOString())).toBe('4:00 PM');
  });
});
