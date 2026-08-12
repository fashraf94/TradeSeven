// api/_utils/mandateCalendar.test.js
import { describe, it, expect } from 'vitest';
import {
  isTradingDayStr,
  sessionCloseInstant,
  addMonthsET,
  computeNextRolloverAt,
} from './mandateCalendar.js';
import { MANDATE_QUARTER_MONTHS } from './mandateConfig.js';

// ET parts of an instant, for DST-independent assertions.
function etParts(instant) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(instant).map((x) => [x.type, x.value]),
  );
  return { y: +p.year, mo: +p.month, d: +p.day, hh: +p.hour % 24, mm: +p.minute };
}

describe('mandateCalendar — session close instants (DST-safe, §3.1 / §5.3)', () => {
  it('a regular summer (EDT) close is 16:00 ET = 20:00 UTC', () => {
    // 2026-08-12 is a Wednesday, a trading day, in EDT (UTC-4).
    const close = sessionCloseInstant('2026-08-12');
    expect(close).not.toBeNull();
    expect(close.getUTCHours()).toBe(20); // 16:00 EDT
    expect(etParts(close)).toMatchObject({ y: 2026, mo: 8, d: 12, hh: 16, mm: 0 });
  });

  it('a regular winter (EST) close is 16:00 ET = 21:00 UTC (DST handled)', () => {
    // 2026-12-15 is a Tuesday, in EST (UTC-5).
    const close = sessionCloseInstant('2026-12-15');
    expect(close.getUTCHours()).toBe(21); // 16:00 EST
    expect(etParts(close)).toMatchObject({ hh: 16, mm: 0 });
  });

  it('an early-close day closes at 13:00 ET (day after Thanksgiving 2026)', () => {
    // 2026-11-27 (Fri) is in the NYSE early-close list; EST → 13:00 = 18:00 UTC.
    const close = sessionCloseInstant('2026-11-27');
    expect(close.getUTCHours()).toBe(18);
    expect(etParts(close)).toMatchObject({ hh: 13, mm: 0 });
  });

  it('a holiday and a weekend are not trading days → sessionCloseInstant is null (fail-closed)', () => {
    expect(isTradingDayStr('2026-11-26')).toBe(false); // Thanksgiving
    expect(sessionCloseInstant('2026-11-26')).toBeNull();
    expect(isTradingDayStr('2026-08-15')).toBe(false); // Saturday
    expect(sessionCloseInstant('2026-08-15')).toBeNull();
  });
});

describe('mandateCalendar — addMonthsET (ET wall-clock, clamped)', () => {
  it('adds whole months preserving the day of month', () => {
    const out = addMonthsET(new Date('2026-08-12T12:00:00Z'), 3);
    expect(etParts(out)).toMatchObject({ y: 2026, mo: 11, d: 12 });
  });

  it('clamps the day to the target month length (Nov 30 + 3mo → Feb 28 2027)', () => {
    // 2026-11-30 17:00 EST = 22:00 UTC; +3mo → Feb (2027 not a leap year → 28).
    const out = addMonthsET(new Date('2026-11-30T22:00:00Z'), 3);
    expect(etParts(out)).toMatchObject({ y: 2027, mo: 2, d: 28 });
  });
});

describe('mandateCalendar — computeNextRolloverAt (§5.3 / I4)', () => {
  it('returns the FIRST session close on or after createdAt + 3 months', () => {
    const createdAt = new Date('2026-08-12T12:00:00Z');
    const baseMs = addMonthsET(createdAt, MANDATE_QUARTER_MONTHS).getTime();
    const { at, dateStr, beyondHorizon } = computeNextRolloverAt(createdAt);

    expect(at).toBeInstanceOf(Date);
    expect(isTradingDayStr(dateStr)).toBe(true); // lands on a trading day
    expect(at.getTime()).toBe(sessionCloseInstant(dateStr).getTime()); // it IS that session's close
    expect(at.getTime()).toBeGreaterThanOrEqual(baseMs); // on-or-after the 3-month mark
    expect(beyondHorizon).toBe(false); // Nov 2026 is inside the maintained calendar
    // The boundary is the first eligible session — within a week of the mark
    // (weekend/holiday skips only).
    expect(dateStr >= '2026-11-12').toBe(true);
    expect(dateStr <= '2026-11-19').toBe(true);
  });

  it('no earlier trading-day close between the mark and the boundary was skipped', () => {
    const createdAt = new Date('2026-08-12T12:00:00Z');
    const baseMs = addMonthsET(createdAt, MANDATE_QUARTER_MONTHS).getTime();
    const { dateStr } = computeNextRolloverAt(createdAt);
    // Every trading day strictly before the boundary date must have a close < base.
    const [by, bm, bd] = dateStr.split('-').map(Number);
    for (let back = 1; back <= 5; back++) {
      const probe = new Date(Date.UTC(by, bm - 1, bd - back));
      const ds = `${probe.getUTCFullYear()}-${String(probe.getUTCMonth() + 1).padStart(2, '0')}-${String(probe.getUTCDate()).padStart(2, '0')}`;
      const close = sessionCloseInstant(ds);
      if (close) expect(close.getTime()).toBeLessThan(baseMs);
    }
  });

  it('throws on an invalid createdAt (fail-closed)', () => {
    expect(() => computeNextRolloverAt('not-a-date')).toThrow();
  });
});
