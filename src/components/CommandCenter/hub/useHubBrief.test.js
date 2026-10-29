// src/components/CommandCenter/hub/useHubBrief.test.js
//
// Command Center hub, slice S4 (ruling R-S4-4; spec V1.2 §3, §8.3) — the brief section from the existing hook's result: every
// caption and state the spec names, in the spec's words, from the document's own record. The fetch time is never a publication
// time, and there is no sources count.
//
// DRB stale fix (founder ruling Oct 29 2026): the caption tells the brief's true age in trading sessions, from its `forDate`
// and the clock handed in as `nowMs` — "Last session's brief" at exactly one session, "{n} sessions old" with the body
// collapsed from two to five, "No brief available" past five — and "Generated" carries its day.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The pure half only: the hook module reads Firebase's config at load. The hook's retry (a click never reaches refetch as its isRetry
// argument) and the brief's states are driven through the hub in CommandCenterHub.s4.jsdom.test.jsx.
vi.mock('../../../hooks/useDailyRegimeBrief', () => ({ default: () => ({}) }));

import { HUB_COPY as COPY } from './hubCopy';
import { formatHubTime } from './hubDate';
import { formatHubWeekdayTime, marketSessionsSince } from './activityDates';
import { BRIEF_COLLAPSED_FROM, BRIEF_SHOWN_UP_TO, briefCaption, briefSectionOf } from './useHubBrief';

const GENERATED = Date.UTC(2026, 9, 7, 9, 30); // Wed Oct 7, 5:30 AM ET
const NOW = Date.UTC(2026, 9, 7, 15, 0); // Wed Oct 7, 11:00 AM ET
const stamp = (ms) => ({ seconds: Math.floor(ms / 1000), nanoseconds: 0 });
const drb = (over = {}) => ({ dailyBrief: 'Heavy macro week.', forDate: '2026-10-07', generatedAt: stamp(GENERATED), loading: false, error: null, ...over });
const GEN = COPY.brief.generated(COPY.time.et(formatHubWeekdayTime(GENERATED)));

describe('the states (spec §3: loading is not absence, absence is not failure)', () => {
  it('loading while the read, or its retry, is out', () => {
    expect(briefSectionOf(drb({ loading: true }), NOW)).toEqual({ status: 'loading' });
    expect(briefSectionOf(drb({ loading: true, dailyBrief: null }), NOW)).toEqual({ status: 'loading' });
    expect(briefSectionOf(null, NOW)).toEqual({ status: 'loading' });
  });

  it('failed once the hook\'s one retry has failed too — whatever an earlier read left behind', () => {
    expect(briefSectionOf(drb({ error: 'unavailable', dailyBrief: null }), NOW)).toEqual({ status: 'error' });
    expect(briefSectionOf(drb({ error: 'unavailable' }), NOW)).toEqual({ status: 'error' });
  });

  it('missing when the read answered with no brief: no document, an empty one, or one that is not text', () => {
    for (const dailyBrief of [null, '', '   ', undefined, 42, { text: 'x' }, ['x']]) {
      expect(briefSectionOf(drb({ dailyBrief }), NOW), JSON.stringify(dailyBrief)).toEqual({ status: 'missing' });
    }
  });

  it('ready with the body and its caption', () => {
    expect(briefSectionOf(drb(), NOW)).toEqual({ status: 'ready', body: 'Heavy macro week.', caption: `Brief for Wed Oct 7${COPY.sep}${GEN}` });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(briefSectionOf(drb(), NOW))).toBe(true);
    expect(Object.isFrozen(briefSectionOf(drb({ forDate: '2026-10-02' }), NOW))).toBe(true);
    expect(Object.isFrozen(briefSectionOf(drb({ loading: true }), NOW))).toBe(true);
  });
});

describe('the caption (spec §8.3): the brief\'s own record, never the fetch time', () => {
  it('forDate → "Brief for {date}"', () => {
    expect(briefCaption({ forDate: '2026-10-07', generatedAt: null }, NOW)).toBe('Brief for Wed Oct 7');
  });

  it('a recorded generatedAt → "Generated {day} {time ET}", only when the document returned one', () => {
    expect(GEN).toMatch(/^Generated Wed 5:30\s?AM ET$/);
    expect(GEN).toBe(`Generated Wed ${formatHubTime(GENERATED)} ET`);
    expect(briefCaption({ forDate: '2026-10-07', generatedAt: stamp(GENERATED) }, NOW)).toBe(`Brief for Wed Oct 7${COPY.sep}${GEN}`);
    for (const none of [null, undefined, '', 'yesterday', {}, NaN]) {
      expect(briefCaption({ forDate: '2026-10-07', generatedAt: none }, NOW), String(none)).toBe('Brief for Wed Oct 7');
    }
  });

  it('the day is the ET day of the generation time: 11:30 PM ET on Wednesday is "Wed", though UTC has reached Thursday', () => {
    const lateWed = Date.UTC(2026, 9, 8, 3, 30);
    expect(formatHubWeekdayTime(lateWed)).toMatch(/^Wed 11:30\s?PM$/);
    expect(formatHubWeekdayTime(NaN)).toBe('');
    expect(formatHubWeekdayTime(null)).toBe('');
  });

  it('no date the document supports means no date caption — and with nothing recorded, no caption at all', () => {
    expect(briefCaption({ forDate: null, generatedAt: null }, NOW)).toBe('');
    expect(briefCaption({ forDate: 'not a date', generatedAt: null }, NOW)).toBe('');
    expect(briefCaption({ forDate: null, generatedAt: stamp(GENERATED) }, NOW)).toBe(GEN);
    expect(briefSectionOf(drb({ forDate: null, generatedAt: null }), NOW)).toEqual({ status: 'ready', body: 'Heavy macro week.' });
  });

  it('builds no sources count: the section carries a body and a caption and nothing else', () => {
    const ready = briefSectionOf({ ...drb(), sourceFailures: ['a', 'b'], sources: 4 }, NOW);
    expect(Object.keys(ready).sort()).toEqual(['body', 'caption', 'status']);
    expect(JSON.stringify(ready)).not.toMatch(/source/i);
  });
});

describe('the brief\'s age in trading sessions (DRB stale fix, founder ruling Oct 29 2026)', () => {
  // The clock: Fri Oct 23 2026, 11:00 AM ET. Each row's forDate is a weekday that many sessions back.
  const FRI = Date.UTC(2026, 9, 23, 15, 0);
  const at = (forDate, nowMs = FRI) => briefSectionOf(drb({ forDate, generatedAt: null }), nowMs);

  it('the thresholds are the ruling\'s: collapsed from two sessions, shown up to five', () => {
    expect(BRIEF_COLLAPSED_FROM).toBe(2);
    expect(BRIEF_SHOWN_UP_TO).toBe(5);
  });

  it('age 0 — the brief\'s own day: "Brief for {date}", the body open, as before', () => {
    expect(at('2026-10-23')).toEqual({ status: 'ready', body: 'Heavy macro week.', caption: 'Brief for Fri Oct 23' });
  });

  it('age 1 — "Last session\'s brief · for {date}", and only at exactly one session', () => {
    expect(at('2026-10-22')).toEqual({ status: 'ready', body: 'Heavy macro week.', caption: "Last session's brief · for Thu Oct 22" });
  });

  it('age 2 to 5 — "Brief for {date} · {n} sessions old", the body collapsed', () => {
    expect(at('2026-10-21')).toEqual({ status: 'ready', body: 'Heavy macro week.', caption: 'Brief for Wed Oct 21 · 2 sessions old', collapsed: true });
    expect(at('2026-10-20')).toEqual({ status: 'ready', body: 'Heavy macro week.', caption: 'Brief for Tue Oct 20 · 3 sessions old', collapsed: true });
    expect(at('2026-10-16')).toEqual({ status: 'ready', body: 'Heavy macro week.', caption: 'Brief for Fri Oct 16 · 5 sessions old', collapsed: true });
    for (const forDate of ['2026-10-21', '2026-10-20', '2026-10-16']) expect(at(forDate).caption).not.toMatch(/Last session/);
  });

  it('age 6 and more — "No brief available": the body is not shown at all', () => {
    expect(at('2026-10-15')).toEqual({ status: 'missing' });
    expect(at('2026-09-01')).toEqual({ status: 'missing' });
  });

  it('the Wednesday of the stale report: Friday\'s brief is three sessions old, not "Last session\'s"', () => {
    const wed = Date.UTC(2026, 9, 28, 15, 0);
    expect(at('2026-10-23', wed)).toEqual({ status: 'ready', body: 'Heavy macro week.', caption: 'Brief for Fri Oct 23 · 3 sessions old', collapsed: true });
  });

  it('a weekend opens no session: Friday\'s brief is 0 sessions old on Saturday and Sunday, and 1 on Monday', () => {
    expect(marketSessionsSince('2026-10-23', Date.UTC(2026, 9, 24, 15, 0))).toBe(0);
    expect(marketSessionsSince('2026-10-23', Date.UTC(2026, 9, 25, 15, 0))).toBe(0);
    expect(marketSessionsSince('2026-10-23', Date.UTC(2026, 9, 26, 12, 0))).toBe(1);
    expect(at('2026-10-23', Date.UTC(2026, 9, 24, 15, 0)).caption).toBe('Brief for Fri Oct 23');
  });

  it('"today" is the ET date: at 11 PM ET on Friday (03:00 UTC Saturday) Thursday\'s brief is still one session old', () => {
    const fri11pmEt = Date.UTC(2026, 9, 24, 3, 0);
    expect(marketSessionsSince('2026-10-22', fri11pmEt)).toBe(1);
    expect(marketSessionsSince('2026-10-23', fri11pmEt)).toBe(0);
    // And just after midnight ET on Monday, Friday's brief is one session old, though UTC has been Monday for hours.
    expect(marketSessionsSince('2026-10-23', Date.UTC(2026, 9, 26, 4, 30))).toBe(1);
    expect(marketSessionsSince('2026-10-23', Date.UTC(2026, 9, 26, 3, 30))).toBe(0);
  });

  it('counts across whole weeks, and across the DST change (Nov 1 2026)', () => {
    expect(marketSessionsSince('2026-10-16', FRI)).toBe(5);
    expect(marketSessionsSince('2026-10-15', FRI)).toBe(6);
    expect(marketSessionsSince('2026-10-02', FRI)).toBe(15);
    expect(marketSessionsSince('2026-10-30', Date.UTC(2026, 10, 2, 15, 0))).toBe(1);
    expect(marketSessionsSince('2026-10-30', Date.UTC(2026, 10, 6, 15, 0))).toBe(5);
  });

  it('a date ahead of the clock is 0 sessions old; no real date or no usable clock is no age, and the brief reads as before', () => {
    expect(marketSessionsSince('2026-10-26', FRI)).toBe(0);
    for (const nowMs of [undefined, null, NaN, '1729695600000']) {
      expect(marketSessionsSince('2026-10-20', nowMs), String(nowMs)).toBeNull();
      expect(briefSectionOf(drb({ forDate: '2026-10-20', generatedAt: null }), nowMs)).toEqual({ status: 'ready', body: 'Heavy macro week.', caption: 'Brief for Tue Oct 20' });
    }
    for (const forDate of [null, '', 'not a date', '2026-02-30', '2026-13-01']) expect(marketSessionsSince(forDate, FRI), String(forDate)).toBeNull();
  });

  it('the hook\'s isStale is no longer read: the clock decides', () => {
    expect(at('2026-10-23')).toEqual(briefSectionOf(drb({ forDate: '2026-10-23', generatedAt: null, isStale: true }), FRI));
    expect(at('2026-10-22')).toEqual(briefSectionOf(drb({ forDate: '2026-10-22', generatedAt: null, isStale: false }), FRI));
  });

  describe('the clock is an argument: the page\'s own clock never reaches the pure half', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });
    it('the same document and the same nowMs give the same section at any time the page reads it', () => {
      vi.setSystemTime(Date.UTC(2026, 9, 7, 13, 0));
      const morning = briefSectionOf(drb({ generatedAt: null }), NOW);
      vi.setSystemTime(Date.UTC(2026, 10, 30, 23, 59));
      const later = briefSectionOf(drb({ generatedAt: null }), NOW);
      expect(later).toEqual(morning);
      expect(morning.caption).toBe('Brief for Wed Oct 7');
    });
  });
});

describe('the spec\'s own words', () => {
  it('"No brief available", "Couldn\'t load the brief · Retry", "Brief for {date}", "Generated {time ET}", "Last session\'s brief · for {date}", "{n} sessions old"', () => {
    expect(COPY.brief.missing).toBe('No brief available');
    expect(`${COPY.brief.failed}${COPY.sep}${COPY.brief.retry}`).toBe("Couldn't load the brief · Retry");
    expect(COPY.brief.forDate('Wed Oct 7')).toBe('Brief for Wed Oct 7');
    expect(COPY.brief.generated('Fri 8:30 AM ET')).toBe('Generated Fri 8:30 AM ET');
    expect(COPY.brief.stale('Wed Oct 7')).toBe("Last session's brief · for Wed Oct 7");
    expect(COPY.brief.aged('Fri Oct 23', 3)).toBe('Brief for Fri Oct 23 · 3 sessions old');
  });
});
