// src/components/CommandCenter/hub/useHubBrief.test.js
//
// Command Center hub, slice S4 (ruling R-S4-4; spec V1.2 §3, §8.3) — the brief section from the existing hook's result: every
// caption and state the spec names, in the spec's words, from the document's own record. The fetch time is never a publication
// time, and there is no sources count.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The pure half only: the hook module reads Firebase's config at load, and the hook itself is driven in useHubBrief.jsdom.test.jsx.
vi.mock('../../../hooks/useDailyRegimeBrief', () => ({ default: () => ({}) }));

import { HUB_COPY as COPY } from './hubCopy';
import { formatHubTime } from './hubDate';
import { briefCaption, briefSectionOf } from './useHubBrief';

const GENERATED = Date.UTC(2026, 9, 7, 9, 30); // 5:30 AM ET
const stamp = (ms) => ({ seconds: Math.floor(ms / 1000), nanoseconds: 0 });
const drb = (over = {}) => ({ dailyBrief: 'Heavy macro week.', forDate: '2026-10-07', generatedAt: stamp(GENERATED), isStale: false, loading: false, error: null, ...over });
const GEN = COPY.brief.generated(COPY.time.et(formatHubTime(GENERATED)));

describe('the states (spec §3: loading is not absence, absence is not failure)', () => {
  it('loading while the read, or its retry, is out', () => {
    expect(briefSectionOf(drb({ loading: true }))).toEqual({ status: 'loading' });
    expect(briefSectionOf(drb({ loading: true, dailyBrief: null }))).toEqual({ status: 'loading' });
    expect(briefSectionOf(null)).toEqual({ status: 'loading' });
  });

  it('failed once the hook\'s one retry has failed too — whatever an earlier read left behind', () => {
    expect(briefSectionOf(drb({ error: 'unavailable', dailyBrief: null }))).toEqual({ status: 'error' });
    expect(briefSectionOf(drb({ error: 'unavailable' }))).toEqual({ status: 'error' });
  });

  it('missing when the read answered with no brief: no document, an empty one, or one that is not text', () => {
    for (const dailyBrief of [null, '', '   ', undefined, 42, { text: 'x' }, ['x']]) {
      expect(briefSectionOf(drb({ dailyBrief })), JSON.stringify(dailyBrief)).toEqual({ status: 'missing' });
    }
  });

  it('ready with the body and its caption', () => {
    expect(briefSectionOf(drb())).toEqual({ status: 'ready', body: 'Heavy macro week.', caption: `Brief for Wed Oct 7${COPY.sep}${GEN}` });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(briefSectionOf(drb()))).toBe(true);
    expect(Object.isFrozen(briefSectionOf(drb({ loading: true })))).toBe(true);
  });
});

describe('the caption (spec §8.3): the brief\'s own record, never the fetch time', () => {
  it('forDate → "Brief for {date}"', () => {
    expect(briefCaption({ forDate: '2026-10-07', generatedAt: null, isStale: false })).toBe('Brief for Wed Oct 7');
  });

  it('a recorded generatedAt → "Generated {time ET}", only when the document returned one', () => {
    expect(GEN).toMatch(/^Generated 5:30\s?AM ET$/);
    expect(briefCaption({ forDate: '2026-10-07', generatedAt: stamp(GENERATED), isStale: false })).toBe(`Brief for Wed Oct 7${COPY.sep}${GEN}`);
    for (const none of [null, undefined, '', 'yesterday', {}, NaN]) {
      expect(briefCaption({ forDate: '2026-10-07', generatedAt: none, isStale: false }), String(none)).toBe('Brief for Wed Oct 7');
    }
  });

  it('stale → "Last session\'s brief · for {date}" in place of "Brief for {date}"', () => {
    expect(briefCaption({ forDate: '2026-10-02', generatedAt: null, isStale: true })).toBe("Last session's brief · for Fri Oct 2");
    expect(briefCaption({ forDate: '2026-10-02', generatedAt: null, isStale: true })).not.toContain('Brief for');
    expect(briefCaption({ forDate: '2026-10-02', generatedAt: stamp(GENERATED), isStale: true })).toBe(`Last session's brief · for Fri Oct 2${COPY.sep}${GEN}`);
  });

  it('only stale === true is stale: a missing flag reads current', () => {
    expect(briefCaption({ forDate: '2026-10-02', generatedAt: null })).toBe('Brief for Fri Oct 2');
    expect(briefCaption({ forDate: '2026-10-02', generatedAt: null, isStale: 'yes' })).toBe('Brief for Fri Oct 2');
  });

  it('no date the document supports means no date caption — and with nothing recorded, no caption at all', () => {
    expect(briefCaption({ forDate: null, generatedAt: null, isStale: false })).toBe('');
    expect(briefCaption({ forDate: 'not a date', generatedAt: null, isStale: false })).toBe('');
    expect(briefCaption({ forDate: null, generatedAt: stamp(GENERATED), isStale: false })).toBe(GEN);
    expect(briefSectionOf(drb({ forDate: null, generatedAt: null }))).toEqual({ status: 'ready', body: 'Heavy macro week.' });
  });

  describe('the page\'s clock never reaches it', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });
    it('the same document gives the same caption at any time the page reads it', () => {
      vi.setSystemTime(Date.UTC(2026, 9, 7, 13, 0));
      const morning = briefSectionOf(drb({ generatedAt: null })).caption;
      vi.setSystemTime(Date.UTC(2026, 9, 9, 23, 59));
      const later = briefSectionOf(drb({ generatedAt: null })).caption;
      expect(later).toBe(morning);
      expect(morning).toBe('Brief for Wed Oct 7');
    });
  });

  it('builds no sources count: the section carries a body and a caption and nothing else', () => {
    const ready = briefSectionOf({ ...drb(), sourceFailures: ['a', 'b'], sources: 4 });
    expect(Object.keys(ready).sort()).toEqual(['body', 'caption', 'status']);
    expect(JSON.stringify(ready)).not.toMatch(/source/i);
  });
});

describe('the spec\'s own words', () => {
  it('"No brief available", "Couldn\'t load the brief · Retry", "Brief for {date}", "Generated {time ET}", "Last session\'s brief · for {date}"', () => {
    expect(COPY.brief.missing).toBe('No brief available');
    expect(`${COPY.brief.failed}${COPY.sep}${COPY.brief.retry}`).toBe("Couldn't load the brief · Retry");
    expect(COPY.brief.forDate('Wed Oct 7')).toBe('Brief for Wed Oct 7');
    expect(COPY.brief.generated('5:30 AM ET')).toBe('Generated 5:30 AM ET');
    expect(COPY.brief.stale('Wed Oct 7')).toBe("Last session's brief · for Wed Oct 7");
  });
});
