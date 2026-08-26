// scripts/calibration/motive-baseline-summary.test.js
// R9 evidence pull — unit tests for the pure helpers and the concurrency-
// normalized aggregate. No Firestore: the DB code is guarded behind the CLI
// entrypoint, so importing this module touches no firebase-admin (the
// export-agent-battles convention). These lock the BATTLE-DAY denominator math
// the founder asked for — a rate, not a count — since the script can't be run
// against production from CI.
import { describe, it, expect } from 'vitest';
import {
  parseArgs, modeKey, toMs, etDate, isMarketOpenDateStr, eachMarketDate, aggregate,
} from './motive-baseline-summary.js';

// A fixed "today" so the active-battle denominator is deterministic.
// 2026-08-28 is a Friday (ET); noon UTC keeps the ET calendar date.
const NOW_MS = Date.parse('2026-08-28T16:00:00Z');

describe('parseArgs', () => {
  it('defaults and honors flags incl. --trailing', () => {
    expect(parseArgs(['n', 's'])).toMatchObject({ since: '2026-08-19', status: 'all', trailing: 5, until: null });
    const f = parseArgs(['n', 's', '--since', '2026-08-01', '--until', '2026-08-20', '--status', 'active', '--trailing', '3', '--json', 'o.json']);
    expect(f).toMatchObject({ since: '2026-08-01', until: '2026-08-20', status: 'active', trailing: 3, json: 'o.json' });
  });
  it('--trailing falls back to 5 on invalid or <1', () => {
    expect(parseArgs(['n', 's', '--trailing', 'x']).trailing).toBe(5);
    expect(parseArgs(['n', 's', '--trailing', '0']).trailing).toBe(5);
    expect(parseArgs(['n', 's', '--trailing', '3']).trailing).toBe(3);
  });
});

describe('modeKey (engine discriminator, not a string literal)', () => {
  it('flat6 for the tournament mode, casual for the agent mode and legacy/absent', () => {
    expect(modeKey('baggerbomb_tournament')).toBe('flat6');
    expect(modeKey('baggerbomb_agent')).toBe('casual');
    expect(modeKey(undefined)).toBe('casual'); // resolveModeConfig defaults to tiered
    expect(modeKey('something_odd')).toBe('casual');
  });
});

describe('toMs / etDate', () => {
  it('coerces ISO, epoch, and Firestore Timestamp shapes', () => {
    const iso = '2026-08-20T13:30:00.000Z';
    expect(toMs(iso)).toBe(Date.parse(iso));
    expect(toMs(Date.parse(iso))).toBe(Date.parse(iso));
    expect(toMs({ toDate: () => new Date(iso) })).toBe(Date.parse(iso));
    expect(toMs({ toMillis: () => 123 })).toBe(123);
    expect(toMs({ _seconds: 1000, _nanoseconds: 0 })).toBe(1_000_000);
    expect(Number.isNaN(toMs(null))).toBe(true);
    expect(Number.isNaN(toMs('nonsense'))).toBe(true);
  });
  it('etDate renders the America/New_York calendar date (TZ-independent)', () => {
    // 01:30 UTC on the 20th is 21:30 ET on the 19th — the ET date is the 19th.
    expect(etDate('2026-08-20T01:30:00.000Z')).toBe('2026-08-19');
    // 13:30 UTC is 09:30 ET, same date.
    expect(etDate('2026-08-20T13:30:00.000Z')).toBe('2026-08-20');
    expect(etDate(null)).toBeNull();
  });
});

describe('trading-date calendar (weekend + NYSE holiday)', () => {
  it('excludes weekends and Labor Day 2026 (Sep 7), includes ordinary weekdays', () => {
    expect(isMarketOpenDateStr('2026-08-19')).toBe(true);  // Wed
    expect(isMarketOpenDateStr('2026-08-22')).toBe(false); // Sat
    expect(isMarketOpenDateStr('2026-08-23')).toBe(false); // Sun
    expect(isMarketOpenDateStr('2026-09-07')).toBe(false); // Labor Day holiday
    expect(isMarketOpenDateStr('2026-09-08')).toBe(true);  // Tue after
    expect(isMarketOpenDateStr(null)).toBe(false);
  });
  it('eachMarketDate enumerates inclusive market days and skips the weekend', () => {
    // Fri 8/21 → Mon 8/24 inclusive: 8/22 (Sat) and 8/23 (Sun) dropped.
    expect([...eachMarketDate('2026-08-21', '2026-08-24')]).toEqual(['2026-08-21', '2026-08-24']);
    // Inverted / empty ranges yield nothing.
    expect([...eachMarketDate('2026-08-24', '2026-08-21')]).toEqual([]);
    expect([...eachMarketDate(null, '2026-08-24')]).toEqual([]);
  });
});

describe('aggregate — battle-day denominator + concurrency-normalized rate', () => {
  const flags = { since: '2026-08-24', until: '2026-08-28', status: 'all', trailing: 5 };
  // Window Mon 8/24 → Fri 8/28 = 5 trading days, no holiday.

  it('counts distinct battle × trading-date pairs, not calendar days, and splits by mode', () => {
    const docs = [
      // A flat6 battle active the whole window (Mon activated, still active) →
      // 5 battle-days, all flat6.
      { gameMode: 'baggerbomb_tournament', activatedAt: '2026-08-24T13:30:00Z', completedAt: null, trades: [] },
      // A casual battle completed Wednesday (Mon–Wed) → 3 battle-days, casual.
      { gameMode: 'baggerbomb_agent', activatedAt: '2026-08-24T13:30:00Z', completedAt: '2026-08-26T20:00:00Z', trades: [] },
    ];
    const agg = aggregate(docs, flags, NOW_MS);
    expect(agg.rate.windowTradingDays).toBe(5);
    expect(agg.rate.battleDays.total).toBe(8);            // 5 + 3, NOT 5 calendar days
    expect(agg.rate.battleDays.byMode).toEqual({ flat6: 5, casual: 3 });
    expect(agg.rate.battlesActiveInWindow).toBe(2);
    expect(agg.rate.battlesUnresolvedSpan).toBe(0);
  });

  it('an active battle is counted only through today ET, not to a future expiry', () => {
    // "today" = Fri 8/28; a battle expiring next week must not book future days.
    const docs = [{
      gameMode: 'baggerbomb_tournament',
      activatedAt: '2026-08-24T13:30:00Z',
      completedAt: null,
      expiresAt: '2026-09-04T20:00:00Z',
      trades: [],
    }];
    const agg = aggregate(docs, { ...flags, until: null }, NOW_MS); // until defaults to today ET
    expect(agg.window.until).toBe('2026-08-28');
    expect(agg.rate.battleDays.total).toBe(5); // Mon–Fri this week only
  });

  it('divides swaps by battle-days into a stable per-battle-day rate, split by mode', () => {
    const swap = (day, reason, motive) => ({
      exitReason: reason, swappedOutAt: `2026-08-${day}T18:00:00Z`,
      ...(motive === undefined ? {} : { swapMotive: motive }),
    });
    const docs = [
      // flat6: 5 battle-days, 2 model swaps (one profit_take) + 1 stop.
      {
        gameMode: 'baggerbomb_tournament', activatedAt: '2026-08-24T13:30:00Z', completedAt: null,
        trades: [swap('25', 'haiku_decision', 'momentum_rotation'), swap('27', 'haiku_decision', 'profit_take'), swap('26', 'stop_loss', null)],
      },
      // casual: 5 battle-days, 1 model swap.
      {
        gameMode: 'baggerbomb_agent', activatedAt: '2026-08-24T13:30:00Z', completedAt: null,
        trades: [swap('24', 'haiku_decision', 'upgrade')],
      },
    ];
    const agg = aggregate(docs, flags, NOW_MS);
    expect(agg.rate.battleDays.byMode).toEqual({ flat6: 5, casual: 5 });
    expect(agg.rate.swapsByMode.flat6).toEqual({ total: 3, model: 2 });
    expect(agg.rate.swapsByMode.casual).toEqual({ total: 1, model: 1 });
    expect(agg.modelSwaps.total).toBe(3);
    expect(agg.modelSwaps.byMotive.profit_take).toBe(1);
    // 3 model swaps / 10 battle-days = 0.300 per battle-day.
    expect((agg.modelSwaps.total / agg.rate.battleDays.total).toFixed(3)).toBe('0.300');
  });

  it('trailing table reports per-day model-swap rate for drift, and off-market crypto swaps are separated', () => {
    // Widen the window to include a weekend (Sat 8/22) so the off-market swap
    // is IN the window but on a non-market date.
    const wideFlags = { since: '2026-08-21', until: '2026-08-28', status: 'all', trailing: 3 };
    const docs = [{
      gameMode: 'baggerbomb_agent', activatedAt: '2026-08-20T13:30:00Z', completedAt: null,
      trades: [
        { exitReason: 'haiku_decision', swappedOutAt: '2026-08-28T18:00:00Z', swapMotive: 'defensive_cut' }, // Fri, on-market
        { exitReason: 'haiku_decision', swappedOutAt: '2026-08-22T18:00:00Z', swapMotive: 'profit_take' },    // Sat — off-market (crypto)
      ],
    }];
    const agg = aggregate(docs, wideFlags, NOW_MS);
    // Off-market Saturday swap: counted in the numerator, flagged, not in per-day.
    expect(agg.rate.offMarketSwaps).toBe(1);
    expect(agg.swapsInWindow).toBe(2);
    expect(agg.modelSwaps.total).toBe(2);
    // Trailing 3 market days = 8/26, 8/27, 8/28; the on-market model swap is 8/28.
    const t = agg.rate.trailing;
    expect(t.dates).toEqual(['2026-08-26', '2026-08-27', '2026-08-28']);
    const fri = t.perDay.find((r) => r.date === '2026-08-28');
    expect(fri).toMatchObject({ battleDays: 1, modelSwaps: 1 }); // 1.000 model/bd
    expect(t.aggregate.model).toBe(1);       // only the Friday swap is a trailing market-day model swap
    expect(t.aggregate.battleDays).toBe(3);  // battle active all three trailing days
  });

  it('a battle with no activatedAt/createdAt is flagged, not silently counted', () => {
    const docs = [{ gameMode: 'baggerbomb_tournament', trades: [] }];
    const agg = aggregate(docs, flags, NOW_MS);
    expect(agg.rate.battlesUnresolvedSpan).toBe(1);
    expect(agg.rate.battleDays.total).toBe(0);
  });
});
