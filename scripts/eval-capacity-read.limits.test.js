// scripts/eval-capacity-read.limits.test.js
//
// Capacity Build 1, Part 4 — the read script's section L (the run records'
// `pool`, `anthropic` and `eodhd` blocks per session). Pure functions only; no
// Firestore. docs/audits/20261115_BUILD_EVAL_CAPACITY_1.md.

import { describe, it, expect } from 'vitest';
import { runRow, limitsOfRun, limitsRead, renderLimits } from './eval-capacity-read.mjs';

const block = (over = {}) => ({
  pool: { k: 1, startCutoffMs: 290_000, maxInFlight: 1, dispatched: 3 },
  anthropic: { requestsLimit: 50, inputTokensLimit: 50_000, outputTokensLimit: 10_000, minRequestsRemaining: 40, minInputTokensRemaining: 30_000, minOutputTokensRemaining: 9_000, responses429: 0 },
  eodhd: { requests: { eod: 40, realTime: 40, intraday: 7, other: 0 }, timeouts: 0, non2xx: { 429: 0, '5xx': 1, other: 0 } },
  ...over,
});
const record = (startedAt, evaluated, blocks = block()) => ({ startedAt, battlesTotal: evaluated, evaluated, modelCalls: 1, wallMs: 40_000, deferredBattleIds: ['never-printed'], ...blocks });

describe('limitsOfRun', () => {
  it('a record from before the build has no blocks → null', () => {
    expect(limitsOfRun({ startedAt: '2026-11-13T15:00:00.000Z', wallMs: 1 })).toBeNull();
    expect(runRow({ startedAt: '2026-11-13T15:00:00.000Z' }).limits).toBeNull();
  });
  it('reduces the blocks to numbers; null values stay null; no id is carried', () => {
    const out = limitsOfRun(record('2026-11-16T15:00:00.000Z', 1, block({ anthropic: { requestsLimit: null, responses429: 2 } })));
    expect(out.anthropic).toMatchObject({ requestsLimit: null, responses429: 2 });
    expect(out.eodhd).toEqual({ eod: 40, realTime: 40, intraday: 7, other: 0, timeouts: 0, s429: 0, s5xx: 1, sOther: 0 });
    expect(JSON.stringify(runRow(record('2026-11-16T15:00:00.000Z', 1)))).not.toContain('never-printed');
  });
});

describe('limitsRead — per session', () => {
  it('lowest limits, minimum remaining, summed 429s, requests per check, K and max in flight', () => {
    const rows = [
      runRow(record('2026-11-16T15:00:00.000Z', 2)),
      runRow(record('2026-11-16T15:15:00.000Z', 1, block({
        pool: { k: 2, startCutoffMs: 200_000, maxInFlight: 2, dispatched: 2 },
        anthropic: { requestsLimit: 45, inputTokensLimit: 50_000, outputTokensLimit: 10_000, minRequestsRemaining: 3, minInputTokensRemaining: 31_000, minOutputTokensRemaining: 8_000, responses429: 1 },
      }))),
      runRow({ startedAt: '2026-11-16T15:30:00.000Z', evaluated: 4 }), // before the build: ignored by L
    ];
    const out = limitsRead(rows, ['2026-11-16', '2026-11-17']);
    expect(out.runsWithBlocks).toBe(2);
    const d = out.perDay[0];
    expect(d).toMatchObject({
      runs: 2, kSeen: [1, 2], maxInFlight: 2, dispatched: 5,
      requestsLimit: 45, minRequestsRemaining: 3, minInputTokensRemaining: 30_000, minOutputTokensRemaining: 8_000, responses429: 1,
      eodhdRequests: 174, eodhdByEndpoint: { eod: 80, realTime: 80, intraday: 14, other: 0 },
      eodhdNon2xx: { 429: 0, '5xx': 2, other: 0 },
    });
    expect(d.eodhdPerCheck).toBe(174 / 3);
    expect(out.perDay[1]).toMatchObject({ runs: 0, eodhdPerCheck: null, requestsLimit: null });
  });
});

describe('timeouts not measured (the guard off) stay null — never a measured zero (review OB-1)', () => {
  it('a session whose runs all carry timeouts: null prints "—"; one measured run makes it a number', () => {
    const unmeasured = block({ eodhd: { requests: { eod: 1, realTime: 1, intraday: 0, other: 0 }, timeouts: null, non2xx: { 429: 0, '5xx': 0, other: 0 } } });
    const rows = [runRow(record('2026-11-16T15:00:00.000Z', 1, unmeasured))];
    expect(limitsOfRun(record('2026-11-16T15:00:00.000Z', 1, unmeasured)).eodhd.timeouts).toBeNull();
    const out = limitsRead(rows, ['2026-11-16']);
    expect(out.perDay[0].eodhdTimeouts).toBeNull();
    expect(renderLimits(out).join('\n')).toContain('| 2026-11-16 | 2 | 2 | 1 | 1 | 0 | 0 | — |');
    const measured = limitsRead([...rows, runRow(record('2026-11-16T15:15:00.000Z', 1))], ['2026-11-16']);
    expect(measured.perDay[0].eodhdTimeouts).toBe(0);
  });
});

describe('renderLimits', () => {
  it('says plainly when no record carries the blocks yet', () => {
    expect(renderLimits({ runsWithBlocks: 0, perDay: [] }).join('\n')).toContain('No run record in the window carries the blocks yet');
  });
  it('prints the two tables for sessions with blocks', () => {
    const rows = [runRow(record('2026-11-16T15:00:00.000Z', 2))];
    const text = renderLimits(limitsRead(rows, ['2026-11-16'])).join('\n');
    expect(text).toContain('| 2026-11-16 | 1 | 1 | 1 | 3 | 50 | 50,000 | 10,000 | 40 | 30,000 | 9,000 | 0 |');
    expect(text).toContain('| 2026-11-16 | 87 | 43.5 | 40 | 40 | 7 | 0 | 0 | 0 | 1 | 0 |');
  });
});
