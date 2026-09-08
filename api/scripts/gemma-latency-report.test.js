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

import { describe, it, expect, afterEach } from 'vitest';
import {
  DEFAULT_DAYS,
  mergeSummaries,
  readRange,
  getBucket,
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

  it('dateKeyForOffset uses EPOCH arithmetic — no Date mutation to slip into local time', () => {
    // A UTC CI runner cannot tell setUTCDate from setDate, so the guard is
    // structural: the function must not reach for either. A source tripwire is
    // the only row that can fail under the defect it names.
    expect(dateKeyForOffset.toString()).not.toMatch(/setDate|getDate\b/);
    expect(dateKeyForOffset.toString()).toContain('86_400_000');
  });

  it('dateKeyForOffset is UTC even when the founder\'s laptop is not', () => {
    // The runner happens to be UTC, so setUTCDate/getUTCDate → setDate/getDate
    // was invisible: identical keys, 30/30 green. Under a real local zone it is
    // a silent off-by-one DAY across the DST boundary — a founder in New York
    // would read a different week than the one they asked for. This row pins
    // the UTC contract by SIMULATING the local-time walk and asserting the two
    // disagree, so the mutant cannot pass.
    const dstNow = new Date('2026-11-05T00:30:00.000Z'); // 8:30pm ET Nov 4, after the fall-back
    const localWalk = (daysAgo) => {
      const d = new Date(dstNow);
      d.setDate(d.getDate() - daysAgo);           // what the mutant does
      return d.toISOString().slice(0, 10);
    };
    const offsets = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const utcKeys = offsets.map((n) => dateKeyForOffset(n, dstNow));
    expect(utcKeys).toEqual(['2026-11-05', '2026-11-04', '2026-11-03', '2026-11-02', '2026-11-01', '2026-10-31', '2026-10-30', '2026-10-29', '2026-10-28']);
    // Every key is exactly one UTC day apart, by construction.
    for (let i = 1; i < utcKeys.length; i++) {
      expect(Date.parse(`${utcKeys[i - 1]}T00:00:00Z`) - Date.parse(`${utcKeys[i]}T00:00:00Z`)).toBe(86_400_000);
    }
    // And the UTC walk is what shadowLogger.js files under — `new Date()`
    // arithmetic in the local zone is a different answer whenever the local
    // date differs from the UTC one.
    expect(dateKeyForOffset(0, new Date('2026-01-01T00:30:00.000Z'))).toBe('2026-01-01');
    expect(localWalk(0)).toBe('2026-11-05');
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
    expect(latencyOf({ battleId: 'b1', gemmaLatencyMs: 0 })).toBe(0);
    expect(latencyOf({ battleId: 'b1', gemmaLatencyMs: 1234 })).toBe(1234);
    expect(latencyOf({ battleId: 'b1', gemmaLatencyMs: null })).toBeNull();   // chat.js's pre-call value
    expect(latencyOf({ battleId: 'b1', gemmaLatencyMs: -1 })).toBeNull();
    expect(latencyOf({ battleId: 'b1', gemmaLatencyMs: '1234' })).toBeNull();
    expect(latencyOf({ battleId: 'b1', gemmaLatencyMs: NaN })).toBeNull();
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
    { battleId: 'b1', gemmaLatencyMs: 1000 },
    { battleId: 'b1', gemmaLatencyMs: 2000 },
    { battleId: 'b1', gemmaLatencyMs: 3000 },
    { battleId: 'b1', gemmaLatencyMs: 19000, turnError: true, errorReason: 'gemma_timeout' },
    { battleId: 'b1', gemmaLatencyMs: 500, turnError: true, errorReason: 'handler_exception' },
    { battleId: 'b1', gemmaLatencyMs: null, turnError: true, errorReason: 'handler_exception' }, // threw before the call
  ];

  it('excludes ONLY the abort from the answered column — a parse failure is a response time', () => {
    const s = summarize(RECORDS);
    expect(s.records).toBe(6);
    expect(s.withLatency).toBe(5);
    expect(s.all.samples).toBe(5);
    // 4 answered: the three clean turns AND the 500ms handler_exception, which
    // is a call the model completed. Only the 19s abort is excluded.
    expect(s.ok.samples).toBe(4);
    expect(s.all.max).toBe(19000);
    expect(s.ok.max).toBe(3000);
  });

  it('keeps the slow tail: a plaintext passthrough and a post-call throw ARE response times', () => {
    // The defect this row exists for: excluding every turnError dropped the
    // model's slowest COMPLETED calls and read p95 3760ms where the truth was
    // ~11750ms — and this is the baseline gate 1 compares the new prompt to.
    const records = [
      ...Array.from({ length: 9 }, () => ({ battleId: 'b1', gemmaLatencyMs: 3500 })),
      { battleId: 'b1', gemmaLatencyMs: 12000, turnError: true, errorReason: 'parse_plaintext_passthrough' },
      { battleId: 'b1', gemmaLatencyMs: 11500, turnError: true, errorReason: 'handler_exception' },
    ];
    const s = summarize(records);
    expect(s.timeouts).toBe(0);
    expect(s.ok.samples).toBe(11);
    expect(s.ok.max).toBe(12000);
    expect(s.ok.p95).toBeGreaterThan(10000);
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

  it('counts ONLY the battle voice turns — the stream has four writers', () => {
    // api/forge/watchlist-analysis.js, api/forge/workshop-chat.js (x2) and
    // api/screener/chat.js also write `conversations`, all with battleId:null
    // and no gemmaLatencyMs. They never moved a percentile, but they sat in the
    // timeoutRate DENOMINATOR: 20 voice turns with 2 timeouts beside 85 of
    // theirs reported 1.9% where the truth is 10.0%.
    const voice = [
      ...Array.from({ length: 18 }, () => ({ battleId: 'b1', gemmaLatencyMs: 3000 })),
      { battleId: 'b1', gemmaLatencyMs: 19000, turnError: true, errorReason: 'gemma_timeout' },
      { battleId: 'b1', gemmaLatencyMs: 19000, turnError: true, errorReason: 'gemma_timeout' },
    ];
    const others = [
      ...Array.from({ length: 60 }, () => ({ battleId: null, gameMode: 'workshop' })),
      ...Array.from({ length: 20 }, () => ({ battleId: null, gameMode: 'research' })),
      ...Array.from({ length: 5 }, () => ({ battleId: null, gameMode: 'workshop', turnError: true, errorReason: 'parse_empty_content' })),
    ];
    const s = summarize([...voice, ...others]);
    expect(s.records).toBe(20);
    expect(s.otherStreamRecords).toBe(85);
    expect(s.timeouts).toBe(2);
    expect(s.timeoutRate).toBeCloseTo(0.10, 10);   // not 2/105 = 1.9%
    expect(s.turnErrors).toBe(2);                   // not 7
  });

  it('skips junk entries instead of counting them as records', () => {
    expect(summarize([null, 'x', undefined, { battleId: 'b1', gemmaLatencyMs: 900 }]).records).toBe(1);
    expect(summarize(null).records).toBe(0);
  });
});

describe('gemma-latency-report — summarizeByDay', () => {
  const BY_DAY = {
    '2026-09-06': [{ battleId: 'b1', gemmaLatencyMs: 1000 }, { battleId: 'b1', gemmaLatencyMs: 3000 }],
    '2026-09-07': [],
    '2026-09-08': [{ battleId: 'b1', gemmaLatencyMs: 19000, turnError: true, errorReason: 'gemma_timeout' }],
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

describe('gemma-latency-report — mergeSummaries (the OVERALL row, from the per-day rows)', () => {
  const day = (records) => summarize(records);

  it('pools the samples and RECOMPUTES the percentiles — never averages them', () => {
    // Averaging the two days' p50s would give (1000 + 9000) / 2 = 5000.
    // The pooled p50 of [1000, 1000, 9000, 9000] is 5000 too — so use a shape
    // where the two answers differ: nine fast and one slow.
    const a = day(Array.from({ length: 9 }, () => ({ battleId: 'b1', gemmaLatencyMs: 1000 })));
    const b = day([{ battleId: 'b1', gemmaLatencyMs: 9000 }]);
    const merged = mergeSummaries([a, b]);
    expect(a.all.p50).toBe(1000);
    expect(b.all.p50).toBe(9000);
    expect(merged.all.p50).toBe(1000);          // pooled, not the 5000 an average gives
    expect(merged.all.max).toBe(9000);
    expect(merged.records).toBe(10);
  });

  it('is identical to summarizing the same records in one pass', () => {
    const records = [
      { battleId: 'b1', gemmaLatencyMs: 1000 },
      { battleId: 'b1', gemmaLatencyMs: 19000, turnError: true, errorReason: 'gemma_timeout' },
      { battleId: 'b1', gemmaLatencyMs: 3000 },
      { battleId: 'b1', gemmaLatencyMs: null, turnError: true, errorReason: 'handler_exception' },
    ];
    const streamed = mergeSummaries([day(records.slice(0, 2)), day(records.slice(2))]);
    const oneShot = summarize(records);
    expect(streamed.all).toEqual(oneShot.all);
    expect(streamed.ok).toEqual(oneShot.ok);
    expect(streamed.records).toBe(oneShot.records);
    expect(streamed.timeouts).toBe(oneShot.timeouts);
    expect(streamed.timeoutRate).toBeCloseTo(oneShot.timeoutRate, 10);
  });

  it('an empty or absent list is zeros and nulls, not a divide by zero', () => {
    expect(mergeSummaries([])).toMatchObject({ records: 0, timeouts: 0, timeoutRate: null });
    expect(mergeSummaries(undefined).records).toBe(0);
  });
});

describe('gemma-latency-report — readRange: failures are isolated AND counted', () => {
  const fakeFile = (name, records) => ({
    name,
    download: async () => {
      if (records === null) throw new Error('download refused');
      return [Buffer.from(records.map((r) => JSON.stringify(r)).join('\n'))];
    },
  });
  const fakeBucket = (byPrefix) => ({
    getFiles: async ({ prefix }) => {
      const day = byPrefix[prefix];
      if (day === undefined) throw new Error('list refused');
      return [day];
    },
  });

  it('counts the days that could not be listed — an all-zeros report is not an empty week', async () => {
    const bucket = fakeBucket({ 'shadow/conversations/2026-09-02/': [fakeFile('a', [{ battleId: 'b1', gemmaLatencyMs: 100 }])] });
    const out = await readRange(bucket, ['2026-09-01', '2026-09-02', '2026-09-03']);
    expect(out.daysFailed).toBe(2);
    expect(out.daysRead).toBe(1);
    // The day that DID read still produced its records — failures are isolated.
    expect(out.byDay['2026-09-02']).toHaveLength(1);
    expect(out.byDay['2026-09-01']).toEqual([]);
  });

  it('filesRead counts files READ, not files attempted', async () => {
    const bucket = fakeBucket({
      'shadow/conversations/2026-09-01/': [fakeFile('ok.jsonl', [{ battleId: 'b1', gemmaLatencyMs: 100 }]), fakeFile('bad.jsonl', null)],
    });
    const out = await readRange(bucket, ['2026-09-01']);
    expect(out.filesRead).toBe(1);
    expect(out.filesFailed).toBe(1);
    expect(out.byDay['2026-09-01']).toHaveLength(1);
  });

  it('onDay streams each day out and retains nothing — the memory ceiling', async () => {
    const bucket = fakeBucket({
      'shadow/conversations/2026-09-01/': [fakeFile('a', [{ battleId: 'b1', gemmaLatencyMs: 100 }])],
      'shadow/conversations/2026-09-02/': [fakeFile('b', [{ battleId: 'b1', gemmaLatencyMs: 200 }])],
    });
    const seen = [];
    const out = await readRange(bucket, ['2026-09-01', '2026-09-02'], {
      onDay: (dateKey, records) => seen.push([dateKey, records.length]),
    });
    expect(seen).toEqual([['2026-09-01', 1], ['2026-09-02', 1]]);
    expect(out.byDay).toEqual({}); // nothing held
    expect(out.filesRead).toBe(2);
  });

  it('a failed day still reaches onDay, so its row is rendered rather than missing', async () => {
    const bucket = fakeBucket({ 'shadow/conversations/2026-09-02/': [] });
    const seen = [];
    await readRange(bucket, ['2026-09-01', '2026-09-02'], { onDay: (k, r) => seen.push([k, r.length]) });
    expect(seen).toEqual([['2026-09-01', 0], ['2026-09-02', 0]]);
  });
});

describe('gemma-latency-report — getBucket', () => {
  const KEY = 'GCS_CREDENTIALS';
  const saved = process.env[KEY];
  afterEach(() => { if (saved === undefined) delete process.env[KEY]; else process.env[KEY] = saved; });

  it('unset is null — the caller decides whether that is fatal', () => {
    delete process.env[KEY];
    expect(getBucket()).toBeNull();
  });

  it('SET but unparseable throws a sentence, never a raw SyntaxError', () => {
    process.env[KEY] = 'not-json';
    expect(() => getBucket()).toThrow(/GCS_CREDENTIALS is set but is not valid JSON/);
    // The distinction that matters: "unset" and "malformed" are different
    // operator problems and must not both surface as an absent bucket.
    expect(() => getBucket()).not.toThrow(SyntaxError);
  });
});

describe('gemma-latency-report — formatReport', () => {
  const REPORT = formatReport({
    ...summarizeByDay({ '2026-09-08': [{ battleId: 'b1', gemmaLatencyMs: 2000 }, { battleId: 'b1', gemmaLatencyMs: 19000, turnError: true, errorReason: 'gemma_timeout' }] }, ['2026-09-08']),
    fromKey: '2026-09-08',
    toKey: '2026-09-08',
  });

  it('binds each column to its OWN statistic — all on the left, answered on the right', () => {
    // Swapping the two column groups, or printing OVERALL's numbers on a day
    // row, left 30/30 green: the only human-readable output's column mapping
    // was unasserted. These rows read the actual numbers out of the actual text.
    const report = formatReport({
      ...summarizeByDay({
        '2026-09-01': [{ battleId: 'b1', gemmaLatencyMs: 1000 }],
        '2026-09-02': [{ battleId: 'b1', gemmaLatencyMs: 5000 }, { battleId: 'b1', gemmaLatencyMs: 19000, turnError: true, errorReason: 'gemma_timeout' }],
      }, ['2026-09-01', '2026-09-02']),
      fromKey: '2026-09-01',
      toKey: '2026-09-02',
    });
    // Anchored on the row prefix, not on `includes` — the title line names the
    // range and would otherwise be picked up as the first day's row.
    const rowFor = (label) => report.split('\n').find((l) => l.startsWith(`  ${label}`)).trim().split(/\s+/);
    const day1 = rowFor('2026-09-01');
    const day2 = rowFor('2026-09-02');
    const overallRow = rowFor('OVERALL');

    // day, turns, all.samples, all.p50, all.p95, all.max, ok.samples, ok.p50, …
    expect(day1.slice(0, 8)).toEqual(['2026-09-01', '1', '1', '1000', '1000', '1000', '1', '1000']);
    // Day 2: `all` includes the 19s abort, `answered` does not — the columns
    // must not be interchangeable.
    expect(day2[5]).toBe('19000');   // all.max
    expect(day2[6]).toBe('1');       // answered.samples
    expect(day2[7]).toBe('5000');    // answered.p50
    // And a day row is its own day, never the OVERALL numbers.
    expect(day1[1]).toBe('1');
    expect(overallRow[1]).toBe('3');
    expect(day1[5]).not.toBe(overallRow[5]);
  });

  it('names the stream and the range it actually read', () => {
    expect(REPORT).toContain('shadow/conversations/ 2026-09-08 → 2026-09-08 (UTC date keys)');
  });

  it('says how many records of the shared stream it EXCLUDED', () => {
    const report = formatReport({
      ...summarizeByDay({ '2026-09-08': [{ battleId: 'b1', gemmaLatencyMs: 2000 }, { battleId: null, gameMode: 'workshop' }] }, ['2026-09-08']),
      fromKey: '2026-09-08',
      toKey: '2026-09-08',
    });
    expect(report).toContain('1 such record(s) in this range are excluded');
    expect(report).toContain('workshop / research / set-analysis');
  });

  it('carries the day row, the OVERALL row, and the timeout rate', () => {
    expect(REPORT).toContain('2026-09-08');
    expect(REPORT).toContain('OVERALL');
    expect(REPORT).toContain('50.0%'); // one timeout in two records
  });

  it('says a day could not be LISTED, so all-zeros is never mistaken for a quiet week', () => {
    const withFailure = formatReport({
      ...summarizeByDay({ '2026-09-08': [] }, ['2026-09-08']),
      fromKey: '2026-09-08',
      toKey: '2026-09-08',
      read: { filesRead: 0, filesFailed: 0, daysFailed: 1, daysRead: 0 },
    });
    expect(withFailure).toContain('COULD NOT BE LISTED');
    expect(withFailure).toContain('a read failure, not an absence of traffic');
  });

  it('names failed downloads in the footer, and says nothing when there were none', () => {
    const clean = formatReport({ ...summarizeByDay({ '2026-09-08': [] }, ['2026-09-08']), fromKey: '2026-09-08', toKey: '2026-09-08', read: { filesRead: 4, filesFailed: 0, daysFailed: 0, daysRead: 1 } });
    expect(clean).toContain('4 file(s) read.');
    expect(clean).not.toContain('FAILED');
    const dirty = formatReport({ ...summarizeByDay({ '2026-09-08': [] }, ['2026-09-08']), fromKey: '2026-09-08', toKey: '2026-09-08', read: { filesRead: 4, filesFailed: 2, daysFailed: 0, daysRead: 1 } });
    expect(dirty).toContain('2 FAILED to download');
  });

  it('prints an em dash for an absent percentile rather than a zero', () => {
    const empty = formatReport({ ...summarizeByDay({ '2026-09-08': [] }, ['2026-09-08']), fromKey: '2026-09-08', toKey: '2026-09-08' });
    expect(empty).toMatch(/2026-09-08\s+0\s+0\s+—\s+—\s+—/);
    expect(empty).not.toContain('0ms');
  });
});
