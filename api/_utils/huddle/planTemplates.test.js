// api/_utils/huddle/planTemplates.test.js
//
// Huddle S1 — the template family plan.v1 (spec V1.1 §4, §9 unit list; A §A1; C §C2,
// §C11, §C15): every drop reason, the event-id formatters, the 500-char rejection,
// hash stability, dissent per archetype and fail-closed, rendering and narration.

import { describe, it, expect } from 'vitest';
import {
  validatePlan, validationChanged, revisionOf, renderPlan, renderedTooLong, renderedTextHashOf,
  narratePlan, planThreadIdOf, isPlanThreadId, isEmptyPlan, checkLevelFormat, levelInBand, formatLevel,
  DROP_REASONS, TRANSFORM_REASONS, HUDDLE_ORIGIN, RENDERED_MAX_CHARS, MAX_STANCES, MAX_LINES,
} from './planTemplates.js';
import { buildSessionEvents, macroEventOf, earningsEventOf, parseEtClock } from './events.js';
import { canonicalContentHash } from '../canonicalHash.js';

const ET = '2026-11-09';
const EVENTS = buildSessionEvents({
  etDate: ET,
  macroEvents: [
    { date: ET, day: 'Monday', time: '10:00 AM ET', category: 'ISM Manufacturing', impact: 'high', event: 'ISM Manufacturing PMI' },
    { date: ET, day: 'Monday', time: 'TBD', category: 'CPI', impact: 'high', event: 'CPI' },
    { date: '2026-11-10', day: 'Tuesday', time: '8:30 AM ET', category: 'CPI', impact: 'high', event: 'CPI (October)' },
  ],
  earnings: [
    { symbol: 'AAA', reportDate: ET, timing: 'amc', period: '2026-09-30', currency: 'USD', epsActual: null, epsEstimate: 1.2 },
    { symbol: 'BBB', reportDate: ET, timing: null, period: '2026-09-30', currency: 'USD', epsActual: null, epsEstimate: null },
  ],
});
const CTX = {
  universe: new Set(['AAA', 'BBB', 'CCC', 'DDD', 'BRK.B']),
  closes: new Map([['AAA', 50], ['BBB', 40], ['CCC', 100], ['DDD', null], ['BRK.B', 500]]),
  events: EVENTS,
  archetype: 'analyst',
};
const reasonsOf = (v) => v.drops.map((d) => `${d.kind}#${d.index}:${d.reason}`);

describe('event ids are built by code from the structured objects (V1.1 §4.3; C §C11)', () => {
  it('macro: macro:{kind}:{etDate}:{HHmm} with a fixed label; an untimed one has no id', () => {
    expect(macroEventOf({ date: ET, time: '10:00 AM ET', category: 'ISM Manufacturing' })).toMatchObject({
      eventId: `macro:ism_manufacturing:${ET}:1000`, label: 'the 10:00 AM ET ISM manufacturing data', timed: true,
    });
    expect(macroEventOf({ date: ET, time: '2:00 PM ET', category: 'FOMC' }).eventId).toBe(`macro:fomc:${ET}:1400`);
    expect(macroEventOf({ date: ET, time: '12:00 PM ET', category: 'GDP' }).eventId).toBe(`macro:gdp:${ET}:1200`);
    expect(macroEventOf({ date: ET, time: 'TBD', category: 'CPI' })).toMatchObject({ eventId: null, timed: false });
    // a category with no fixed words is no event at all (never a model label)
    expect(macroEventOf({ date: ET, time: '8:30 AM ET', category: 'Something New' })).toBeNull();
    expect(parseEtClock('13:00 PM ET')).toBeNull();
  });

  it('earnings: earn:{SYMBOL}:{report_date}:{bmo|amc}; no BMO/AMC label is untimed and has no id', () => {
    expect(earningsEventOf({ symbol: 'AAA', reportDate: ET, timing: 'amc' })).toMatchObject({ eventId: `earn:AAA:${ET}:amc`, label: "AAA's report after the close" });
    expect(earningsEventOf({ symbol: 'AAA', reportDate: ET, timing: 'bmo' }).label).toBe("AAA's report before the open");
    expect(earningsEventOf({ symbol: 'BBB', reportDate: ET, timing: null })).toMatchObject({ eventId: null, timed: false });
  });

  it('the eligible set holds only this session\'s timed events', () => {
    expect([...EVENTS.eligible.keys()].sort()).toEqual([`earn:AAA:${ET}:amc`, `macro:ism_manufacturing:${ET}:1000`]);
    expect(EVENTS.strip.map((e) => e.etDate).every((d) => d === ET)).toBe(true);
  });
});

describe('validatePlan — every drop reason (V1.1 §4.3)', () => {
  it('a clean proposal validates with zero changes and carries the huddle origin on every item (C §C2)', () => {
    const v = validatePlan({
      stances: [{ kind: 'HOLD', ticker: 'AAA' }, { kind: 'FADE', ticker: 'CCC', level: 110 }, { kind: 'WATCH', ticker: 'BRK.B' }],
      lines: [{ kind: 'NO_ADDS_BEFORE', eventId: `macro:ism_manufacturing:${ET}:1000` }, { kind: 'CUT_IF_BELOW', ticker: 'BBB', level: 36.5 }],
    }, CTX);
    expect(v.drops).toEqual([]);
    // a validated item re-validates unchanged (the 422 preview round trip)
    const again = validatePlan(v.current, CTX);
    expect(validationChanged(again)).toBe(false);
    expect(again.current).toEqual(v.current);
    for (const item of [...v.current.stances, ...v.current.lines]) expect(item.origin).toEqual(HUDDLE_ORIGIN);
  });

  it.each([
    ['not an object', 'x', DROP_REASONS.NOT_OBJECT],
    ['unknown kind', { kind: 'BUY', ticker: 'AAA' }, DROP_REASONS.UNKNOWN_KIND],
    ['unknown key (closed schema)', { kind: 'HOLD', ticker: 'AAA', note: 'because' }, DROP_REASONS.UNKNOWN_KEY],
    ['a level on a stance that takes none', { kind: 'HOLD', ticker: 'AAA', level: 50 }, DROP_REASONS.UNKNOWN_KEY],
    ['ticker syntax', { kind: 'HOLD', ticker: 'aapl' }, DROP_REASONS.TICKER_SYNTAX],
    ['ticker not in the universe', { kind: 'HOLD', ticker: 'ZZZ' }, DROP_REASONS.TICKER_NOT_IN_UNIVERSE],
    ['level format (three decimals)', { kind: 'CHASE', ticker: 'AAA', level: 50.123 }, DROP_REASONS.LEVEL_FORMAT],
    ['level format (negative)', { kind: 'CHASE', ticker: 'AAA', level: -5 }, DROP_REASONS.LEVEL_FORMAT],
    ['level format (a string)', { kind: 'FADE', ticker: 'AAA', level: '48' }, DROP_REASONS.LEVEL_FORMAT],
    ['level out of range (+25 %)', { kind: 'CHASE', ticker: 'AAA', level: 62.6 }, DROP_REASONS.LEVEL_OUT_OF_RANGE],
    ['level with no reference close', { kind: 'CHASE', ticker: 'DDD', level: 10 }, DROP_REASONS.LEVEL_NO_REFERENCE],
  ])('stance: %s', (_name, item, reason) => {
    const v = validatePlan({ stances: [item], lines: [] }, CTX);
    expect(reasonsOf(v)).toEqual([`stance#0:${reason}`]);
    expect(v.current.stances).toEqual([]);
  });

  it.each([
    ['event unknown', { kind: 'NO_ADDS_BEFORE', eventId: 'macro:cpi:2026-11-10:0830' }, DROP_REASONS.EVENT_UNKNOWN],
    ['event a model label', { kind: 'NO_ADDS_BEFORE', eventId: 'the CPI print' }, DROP_REASONS.EVENT_UNKNOWN],
    ['event untimed', { kind: 'NO_ADDS_BEFORE', eventId: `earn:BBB:${ET}:amc` }, DROP_REASONS.EVENT_UNTIMED],
    ['line level required', { kind: 'CUT_IF_BELOW', ticker: 'BBB' }, DROP_REASONS.LEVEL_FORMAT],
    ['line level out of range (−25 %)', { kind: 'NO_CHASE_ABOVE', ticker: 'BBB', level: 29.99 }, DROP_REASONS.LEVEL_OUT_OF_RANGE],
    ['line ticker not in universe', { kind: 'CUT_IF_BELOW', ticker: 'ZZZ', level: 10 }, DROP_REASONS.TICKER_NOT_IN_UNIVERSE],
    ['unknown key on a line', { kind: 'NO_SWAPS_TODAY', text: 'no swaps, really' }, DROP_REASONS.UNKNOWN_KEY],
  ])('line: %s', (_name, item, reason) => {
    const v = validatePlan({ stances: [], lines: [item] }, CTX);
    expect(reasonsOf(v)).toEqual([`line#0:${reason}`]);
  });

  it('duplicates by ticker collapse to the first; counts are enforced (≤ 3 stances, ≤ 2 lines)', () => {
    const v = validatePlan({
      stances: [{ kind: 'HOLD', ticker: 'AAA' }, { kind: 'TRIM', ticker: 'AAA' }, { kind: 'HOLD', ticker: 'BBB' }, { kind: 'HOLD', ticker: 'CCC' }, { kind: 'HOLD', ticker: 'BRK.B' }],
      lines: [{ kind: 'NO_SWAPS_TODAY' }, { kind: 'NO_SWAPS_TODAY' }, { kind: 'CUT_IF_BELOW', ticker: 'BBB', level: 38 }, { kind: 'NO_CHASE_ABOVE', ticker: 'AAA', level: 55 }],
    }, CTX);
    expect(v.current.stances.map((s) => `${s.kind} ${s.ticker}`)).toEqual(['HOLD AAA', 'HOLD BBB', 'HOLD CCC']);
    expect(v.current.stances).toHaveLength(MAX_STANCES);
    expect(v.current.lines).toHaveLength(MAX_LINES);
    expect(reasonsOf(v)).toEqual(['stance#1:duplicate', 'stance#4:count_exceeded', 'line#1:duplicate', 'line#3:count_exceeded']);
  });

  it('a level of 48 is 48.00 and unchanged; a foreign origin is a transform (so confirm previews it)', () => {
    expect(checkLevelFormat(48)).toEqual({ ok: true, value: 48 });
    expect(checkLevelFormat(48.1)).toEqual({ ok: true, value: 48.1 });
    expect(formatLevel(48)).toBe('48.00');
    expect(levelInBand(62.5, 50)).toBe(true);
    expect(levelInBand(37.5, 50)).toBe(true);
    expect(levelInBand(37.49, 50)).toBe(false);
    const v = validatePlan({ stances: [{ kind: 'HOLD', ticker: 'AAA', origin: { kind: 'research', recordKind: 'researchWork', recordId: 'r1' } }], lines: [] }, CTX);
    expect(v.transforms).toEqual([{ kind: 'stance', index: 0, reason: TRANSFORM_REASONS.ORIGIN_NORMALIZED }]);
    expect(v.current.stances[0].origin).toEqual(HUDDLE_ORIGIN);
    expect(validationChanged(v)).toBe(true);
  });
});

describe('dissent per archetype and fail-closed (V1.1 §4.3; C §C15)', () => {
  it('Contrarian: CHASE becomes WATCH, its level dropped, recorded in dissent[] and as a transform', () => {
    const v = validatePlan({ stances: [{ kind: 'CHASE', ticker: 'AAA', level: 52 }, { kind: 'HOLD', ticker: 'BBB' }], lines: [] }, { ...CTX, archetype: 'contrarian' });
    expect(v.current.stances[0]).toEqual({ kind: 'WATCH', ticker: 'AAA', origin: HUDDLE_ORIGIN });
    expect(v.dissent).toEqual([expect.objectContaining({ index: 0, kind: 'stance', archetype: 'contrarian', from: 'CHASE', to: 'WATCH', ticker: 'AAA' })]);
    expect(v.transforms.map((t) => t.reason)).toEqual(['dissent']);
    expect(v.archetypeSupported).toBe(true);
  });

  it('Trend Follower: FADE becomes WATCH; CHASE passes', () => {
    const v = validatePlan({ stances: [{ kind: 'FADE', ticker: 'AAA', level: 52 }, { kind: 'CHASE', ticker: 'CCC' }], lines: [] }, { ...CTX, archetype: 'momentum_chaser' });
    expect(v.current.stances.map((s) => s.kind)).toEqual(['WATCH', 'CHASE']);
  });

  it('an archetype with no row fails closed: no transform, archetypeSupported false', () => {
    for (const archetype of ['unknown', null, 'constructor', '']) {
      const v = validatePlan({ stances: [{ kind: 'CHASE', ticker: 'AAA' }], lines: [] }, { ...CTX, archetype });
      expect(v.archetypeSupported, String(archetype)).toBe(false);
      expect(v.current.stances[0].kind).toBe('CHASE');
    }
  });

  it('a change of archetype transforms an item that validated under the old one (the reconfirm 422)', () => {
    const underAnalyst = validatePlan({ stances: [{ kind: 'FADE', ticker: 'AAA', level: 52 }], lines: [] }, CTX);
    expect(validationChanged(underAnalyst)).toBe(false);
    const underTrend = validatePlan(underAnalyst.current, { ...CTX, archetype: 'momentum_chaser' });
    expect(validationChanged(underTrend)).toBe(true);
  });
});

describe('rendering, the 500-char rule, the hashes and the thread id (V1.1 §4.4, §4.5)', () => {
  const current = validatePlan({
    stances: [{ kind: 'FADE', ticker: 'AAA', level: 48 }, { kind: 'HOLD', ticker: 'BBB' }, { kind: 'WATCH', ticker: 'CCC' }],
    lines: [{ kind: 'NO_ADDS_BEFORE', eventId: `macro:ism_manufacturing:${ET}:1000` }, { kind: 'CUT_IF_BELOW', ticker: 'BBB', level: 42 }],
  }, CTX).current;
  const eventLabels = new Map([...EVENTS.eligible].map(([id, e]) => [id, e.label]));

  it('renders the fixed sentences with validated values only, and no time of day but the event\'s own', () => {
    expect(renderPlan(current, { etDate: ET, eventLabels })).toBe([
      `GAME PLAN for ${ET}, confirmed by the player.`,
      'Stances: FADE AAA above 48.00; HOLD BBB; WATCH CCC.',
      'Lines: no adds before the 10:00 AM ET ISM manufacturing data; cut BBB if it trades below 42.00.',
      "These are the player's instructions for this session. Apply them within your archetype's method.",
    ].join('\n'));
  });

  it('rejects a rendering over 500 characters, and only then', () => {
    const text = renderPlan(current, { etDate: ET, eventLabels });
    expect(renderedTooLong(text)).toBe(false);
    expect(renderedTooLong('x'.repeat(RENDERED_MAX_CHARS))).toBe(false);
    expect(renderedTooLong('x'.repeat(RENDERED_MAX_CHARS + 1))).toBe(true);
  });

  it('the revision is stable across key order and changes on any edit; the text hash is the cron\'s own hash', () => {
    const reordered = { lines: current.lines.map((l) => Object.fromEntries(Object.entries(l).reverse())), stances: current.stances };
    expect(revisionOf(reordered)).toBe(revisionOf(current));
    expect(revisionOf({ ...current, stances: current.stances.slice(1) })).not.toBe(revisionOf(current));
    expect(revisionOf(current)).toMatch(/^[0-9a-f]{64}$/);
    const text = renderPlan(current, { etDate: ET, eventLabels });
    expect(renderedTextHashOf(text)).toBe(canonicalContentHash(text));
  });

  it('the thread id carries uid, session and revision (no new battle key)', () => {
    const id = planThreadIdOf({ uid: 'u1', etDate: ET, revision: 'abc' });
    expect(id).toBe(`plan:u1:${ET}:abc`);
    expect(isPlanThreadId(id)).toBe(true);
    expect(isPlanThreadId('5b0c-uuid')).toBe(false);
  });

  it('the plan beat is narrated by code, never mentions confirming, and an empty plan stands pat', () => {
    const said = narratePlan(current, { eventLabels });
    expect(said).toBe("Here's what I'd carry in today: fade AAA above 48.00; hold BBB; watch CCC. Two lines: no adds before the 10:00 AM ET ISM manufacturing data; cut BBB if it trades below 42.00.");
    expect(said).not.toMatch(/confirm/i);
    expect(isEmptyPlan({ stances: [], lines: [] })).toBe(true);
    expect(narratePlan({ stances: [], lines: [] }, { eventLabels })).not.toMatch(/confirm/i);
  });
});
