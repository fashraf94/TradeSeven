// api/scripts/gemma-latency-report.test.js
//
// The p50/p95 reader's PURE half (spec §12). The GCS read is not exercised
// here — the module's importable surface is; a script whose arithmetic is only
// ever run against production data is a script whose arithmetic is unproven.
//
// Dependency-surface guard (BUILD_RULES §4): this file's import of the module
// under test is the runtime guard that its imports stay Node-clean — it pulls
// `quantile` out of api/_utils/learning/measureCorpus.js rather than restating
// the percentile math. Never mock it.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DAYS,
  TIMEOUT_ERROR_REASON,
  utcDateKey,
  isDateKey,
  dateKeyForOffset,
  dateKeysInRange,
  parseArgs,
  latencyOf,
  isTurnError,
  isTimeout,
  latencyPercentiles,
  summarize,
  summarizeByDay,
  formatReport,
} from './gemma-latency-report.js';

const NOW = new Date('2026-09-08T15:47:00.000Z'); // Tue Sep 8 2026

describe('gemma-latency-report — UTC date keys', () => {
  it('utcDateKey slices the same key shadowLogger.js files under', () => {
    expect(utcDateKey('2026-09-08T23:59:59.999Z')).toBe('2026-09-08');
    expect(utcDateKey('2026-09-09T00:00:00.000Z')).toBe('2026-09-09');
  });

  it('isDateKey rejects a well-shaped but unreal date', () => {
    expect(isDateKey('2026-09-08')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false); // shape ok, date not
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('20260908')).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });

  it('dateKeyForOffset walks back in UTC days, across a month boundary', () => {
    expect(dateKeyForOffset(0, NOW)).toBe('2026-09-08');
    expect(dateKeyForOffset(8, NOW)).toBe('2026-08-31');
  });

  it('dateKeysInRange is inclusive at both ends, ascending', () => {
    expect(dateKeysInRange('2026-09-06', '2026-09-08')).toEqual(['2026-09-06', '2026-09-07', '2026-09-08']);
    expect(dateKeysInRange('2026-09-08', '2026-09-08')).toEqual(['2026-09-08']);
  });

  it('dateKeysInRange spans a month boundary without arithmetic drift', () => {
    expect(dateKeysInRange('2026-08-30', '2026-09-02')).toEqual(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']);
  });

  it('dateKeysInRange is empty when reversed or malformed', () => {
    expect(dateKeysInRange('2026-09-08', '2026-09-06')).toEqual([]);
    expect(dateKeysInRange('nonsense', '2026-09-06')).toEqual([]);
  });
});

describe('gemma-latency-report — parseArgs', () => {
  it('defaults to the last DEFAULT_DAYS days, inclusive of today', () => {
    const args = parseArgs([], NOW);
    expect(args.toKey).toBe('2026-09-08');
    expect(args.fromKey).toBe('2026-09-02'); // 7 days inclusive → today-6
    expect(dateKeysInRange(args.fromKey, args.toKey)).toHaveLength(DEFAULT_DAYS);
    expect(args.json).toBe(false);
  });

  it('--days N takes the last N days inclusive of today', () => {
    expect(parseArgs(['--days', '3'], NOW)).toEqual({ fromKey: '2026-09-06', toKey: '2026-09-08', json: false });
  });

  it('--from/--to bound the range explicitly; --to defaults to today', () => {
    expect(parseArgs(['--from', '2026-09-01', '--to', '2026-09-03'], NOW))
      .toEqual({ fromKey: '2026-09-01', toKey: '2026-09-03', json: false });
    expect(parseArgs(['--from', '2026-09-01'], NOW))
      .toEqual({ fromKey: '2026-09-01', toKey: '2026-09-08', json: false });
  });

  it('--json is a flag, not a value', () => {
    expect(parseArgs(['--days', '2', '--json'], NOW).json).toBe(true);
  });

  it('rejects the usage errors rather than reading a silently wrong range', () => {
    expect(() => parseArgs(['--days', '3', '--from', '2026-09-01'], NOW)).toThrow(/cannot be combined/);
    expect(() => parseArgs(['--days', '0'], NOW)).toThrow(/positive integer/);
    expect(() => parseArgs(['--days', 'seven'], NOW)).toThrow(/positive integer/);
    expect(() => parseArgs(['--from', '2026-02-30'], NOW)).toThrow(/--from must be/);
    expect(() => parseArgs(['--from', '2026-09-08', '--to', '2026-09-01'], NOW)).toThrow(/is after/);
    expect(() => parseArgs(['--days'], NOW)).toThrow(/requires a value/);
    expect(() => parseArgs(['--week', '2'], NOW)).toThrow(/Unknown argument/);
  });
});

describe('gemma-latency-report — the record\'s three facts', () => {
  it('latencyOf accepts a finite non-negative stamp and nothing else', () => {
    expect(latencyOf({ gemmaLatencyMs: 0 })).toBe(0);
    expect(latencyOf({ gemmaLatencyMs: 1234 })).toBe(1234);
    expect(latencyOf({ gemmaLatencyMs: null })).toBeNull();   // chat.js's pre-call value
    expect(latencyOf({ gemmaLatencyMs: -1 })).toBeNull();
    expect(latencyOf({ gemmaLatencyMs: '1234' })).toBeNull();
    expect(latencyOf({ gemmaLatencyMs: NaN })).toBeNull();
    expect(latencyOf({})).toBeNull();
    expect(latencyOf(null)).toBeNull();
  });

  it('isTimeout keys on the reason chat.js\'s catch block files for an abort', () => {
    expect(TIMEOUT_ERROR_REASON).toBe('gemma_timeout');
    expect(isTimeout({ turnError: true, errorReason: 'gemma_timeout' })).toBe(true);
    expect(isTimeout({ turnError: true, errorReason: 'handler_exception' })).toBe(false);
    expect(isTimeout({ turnError: true, errorReason: 'parse_plaintext_passthrough' })).toBe(false);
    expect(isTimeout({})).toBe(false);
  });

  it('isTurnError spans every errored turn, not only the timeout', () => {
    expect(isTurnError({ turnError: true, errorReason: 'handler_exception' })).toBe(true);
    expect(isTurnError({ turnError: false })).toBe(false);
    expect(isTurnError({})).toBe(false);
  });
});

describe('gemma-latency-report — latencyPercentiles', () => {
  it('an empty sample reports nulls, never zeros', () => {
    expect(latencyPercentiles([])).toEqual({ samples: 0, p50: null, p95: null, max: null });
  });

  it('one sample is its own p50, p95 and max', () => {
    expect(latencyPercentiles([4200])).toEqual({ samples: 1, p50: 4200, p95: 4200, max: 4200 });
  });

  it('p50 interpolates an even-length sample; p95 interpolates near the top', () => {
    // 1..10: p50 = between 5 and 6 = 5.5 → 6 (rounded); p95 = 9.55 → 10 at index 8.55
    const xs = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
    expect(latencyPercentiles(xs)).toEqual({ samples: 10, p50: 5500, p95: 9550, max: 10000 });
  });

  it('order does not matter — the sample is sorted before it is read', () => {
    const asc = latencyPercentiles([100, 200, 300, 400, 500]);
    const shuffled = latencyPercentiles([300, 500, 100, 400, 200]);
    expect(shuffled).toEqual(asc);
    expect(asc).toEqual({ samples: 5, p50: 300, p95: 480, max: 500 });
  });

  it('non-numeric and non-finite entries are dropped, not counted', () => {
    expect(latencyPercentiles([100, null, '200', NaN, Infinity, 300])).toEqual({ samples: 2, p50: 200, p95: 290, max: 300 });
  });

  it('a non-array input is an empty sample, not a throw', () => {
    expect(latencyPercentiles(undefined)).toEqual({ samples: 0, p50: null, p95: null, max: null });
  });
});

describe('gemma-latency-report — summarize', () => {
  const RECORDS = [
    { gemmaLatencyMs: 1000 },
    { gemmaLatencyMs: 2000 },
    { gemmaLatencyMs: 3000 },
    { gemmaLatencyMs: 19000, turnError: true, errorReason: 'gemma_timeout' },
    { gemmaLatencyMs: 500, turnError: true, errorReason: 'handler_exception' },
    { gemmaLatencyMs: null, turnError: true, errorReason: 'handler_exception' }, // threw before the call
  ];

  it('separates the errored turns from the model\'s own response time', () => {
    const s = summarize(RECORDS);
    expect(s.records).toBe(6);
    expect(s.withLatency).toBe(5);
    expect(s.all.samples).toBe(5);
    expect(s.ok.samples).toBe(3);
    // The abort budget is in `all` and out of `ok` — the whole point of the split.
    expect(s.all.max).toBe(19000);
    expect(s.ok.max).toBe(3000);
    expect(s.ok.p50).toBe(2000);
  });

  it('counts the timeouts and the wider turn-error set separately', () => {
    const s = summarize(RECORDS);
    expect(s.timeouts).toBe(1);
    expect(s.turnErrors).toBe(3);
    expect(s.timeoutRate).toBeCloseTo(1 / 6, 10);
  });

  it('an empty day reports zero records and a null rate, not a divide by zero', () => {
    const s = summarize([]);
    expect(s).toMatchObject({ records: 0, withLatency: 0, timeouts: 0, turnErrors: 0, timeoutRate: null });
    expect(s.all).toEqual({ samples: 0, p50: null, p95: null, max: null });
  });

  it('skips junk entries instead of counting them as records', () => {
    expect(summarize([null, 'x', undefined, { gemmaLatencyMs: 900 }]).records).toBe(1);
    expect(summarize(null).records).toBe(0);
  });
});

describe('gemma-latency-report — summarizeByDay', () => {
  const BY_DAY = {
    '2026-09-06': [{ gemmaLatencyMs: 1000 }, { gemmaLatencyMs: 3000 }],
    '2026-09-07': [],
    '2026-09-08': [{ gemmaLatencyMs: 19000, turnError: true, errorReason: 'gemma_timeout' }],
  };
  const KEYS = ['2026-09-06', '2026-09-07', '2026-09-08'];

  it('emits a row per requested day, silent days included', () => {
    const { perDay } = summarizeByDay(BY_DAY, KEYS);
    expect(perDay.map((d) => d.dateKey)).toEqual(KEYS);
    expect(perDay[1]).toMatchObject({ records: 0, timeouts: 0 });
  });

  it('overall aggregates the days rather than averaging their percentiles', () => {
    const { overall } = summarizeByDay(BY_DAY, KEYS);
    expect(overall.records).toBe(3);
    expect(overall.all.samples).toBe(3);
    expect(overall.all.max).toBe(19000);
    expect(overall.ok.samples).toBe(2);
    expect(overall.ok.p50).toBe(2000); // the two ok turns, interpolated
    expect(overall.timeouts).toBe(1);
  });

  it('falls back to the map\'s own sorted keys when none are supplied', () => {
    const { perDay } = summarizeByDay(BY_DAY);
    expect(perDay.map((d) => d.dateKey)).toEqual(KEYS);
  });
});

describe('gemma-latency-report — formatReport', () => {
  const REPORT = formatReport({
    ...summarizeByDay({ '2026-09-08': [{ gemmaLatencyMs: 2000 }, { gemmaLatencyMs: 19000, turnError: true, errorReason: 'gemma_timeout' }] }, ['2026-09-08']),
    fromKey: '2026-09-08',
    toKey: '2026-09-08',
  });

  it('names the stream and the range it actually read', () => {
    expect(REPORT).toContain('shadow/conversations/ 2026-09-08 → 2026-09-08 (UTC date keys)');
  });

  it('carries the day row, the OVERALL row, and the timeout rate', () => {
    expect(REPORT).toContain('2026-09-08');
    expect(REPORT).toContain('OVERALL');
    expect(REPORT).toContain('50.0%'); // one timeout in two records
  });

  it('prints an em dash for an absent percentile rather than a zero', () => {
    const empty = formatReport({ ...summarizeByDay({ '2026-09-08': [] }, ['2026-09-08']), fromKey: '2026-09-08', toKey: '2026-09-08' });
    expect(empty).toMatch(/2026-09-08\s+0\s+0\s+—\s+—\s+—/);
    expect(empty).not.toContain('0ms');
  });
});
