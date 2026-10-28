// scripts/experiments/tf-setup-corpus-replay.test.js
//
// Measured Trend Evidence, slice 1 (P3) — V3 build prompt §9.7: the replay's
// pure helpers on synthetic records. HERMETIC: no file under the home
// directory is read, no fetch, no key. The script's main() does not run on
// import.

import '../../api/_utils/__fixtures__/pinTimezoneUtc.js';
import { describe, it, expect } from 'vitest';
import {
  CALL_CAP, FROM_PAD_DAYS, MIN_JOINED_ROWS, RECEIPT_COUNT, SYMBOL_RE, isRealDate,
  verifyCaptureFields, selectPopulation, asOfFor, redactRow, planFor, makeCounter, eodUrl, redactEodhd,
  pickReceipts, joinScorer, summarize, renderReport, verdictClass, hashBattleId,
} from './tf-setup-corpus-replay.mjs';

const rec = (over = {}, decision = {}) => ({
  k: 'b1/b1:3', battleId: 'b1', tickId: 'b1:3', archetype: 'momentum_chaser', owner: 'OWNER-NEVER-READ', ownerClass: 'non_cpu', etDate: '2026-10-13', woken: true,
  decision: { original: 'SWAP', final: 'HOLD', originalSymbolOut: 'GOOGL', originalSymbolIn: 'MU', finalSymbolOut: null, finalSymbolIn: null, ...decision },
  ...over,
});

describe('the capture\'s fields are re-verified before the path is defined', () => {
  it('accepts the verified shape: etDate the only time field, tickId = <battleId>:<seq>', () => {
    const v = verifyCaptureFields([rec(), rec({ battleId: 'b2', tickId: 'b2:0' })]);
    expect(v).toMatchObject({ ok: true, problems: [], timeFields: ['etDate'], records: 2 });
    expect(v.keys).toContain('decision');
  });
  it('refuses a second time-shaped field, a tickId outside its battle, an impossible date, or a missing decision field', () => {
    expect(verifyCaptureFields([rec({ capturedAt: '2026-10-13T14:00:00Z' })]).problems.join(' ')).toMatch(/time-shaped fields are \["capturedAt","etDate"\]/);
    expect(verifyCaptureFields([rec({ tickId: 'other:3' })]).problems.join(' ')).toMatch(/tickId that is not <battleId>:<seq>/);
    expect(verifyCaptureFields([rec({ etDate: '2026-02-30' })]).problems.join(' ')).toMatch(/not a real calendar date/); // review TE2-9
    expect(verifyCaptureFields([rec({}, { finalSymbolIn: undefined })]).ok).toBe(true); // present as a key, even undefined → in
    const { finalSymbolIn, ...noKey } = rec().decision;
    void finalSymbolIn;
    expect(verifyCaptureFields([rec({ decision: noKey })]).problems.join(' ')).toMatch(/lack a decision field/);
    expect(verifyCaptureFields([]).ok).toBe(false);
  });
  it('isRealDate round-trips the calendar', () => {
    expect(isRealDate('2026-02-28')).toBe(true);
    expect(isRealDate('2026-02-30')).toBe(false);
    expect(isRealDate('2026-13-01')).toBe(false);
    expect(isRealDate('garbage')).toBe(false);
    expect(asOfFor('2026-02-30')).toBeNull();
  });
});

describe('the population filter (V3 §10): one row per moment', () => {
  it('keeps the Trend Follower\'s woken non-CPU checks with a SWAP, and nothing else', () => {
    const { rows, counts } = selectPopulation([
      rec(),                                             // proposed only
      rec({ ownerClass: 'cpu' }),                        // CPU: out
      rec({ woken: false }),                             // not woken: out
      rec({ archetype: 'contrarian' }),                  // another archetype: out
      rec({ battleId: 'b2', tickId: 'b2:1' }, { original: 'HOLD', originalSymbolIn: null, originalSymbolOut: null }), // HOLD: woken, no row
      rec({ battleId: 'b3', tickId: 'b3:1' }, { original: 'SWAP', originalSymbolIn: null }),                         // SWAP without a symbol: no row
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ battleId: 'b1', tickId: 'b1:3', tickSeq: '3', kind: 'proposed', symbolIn: 'MU', symbolOut: 'GOOGL', etDate: '2026-10-13', asOf: '2026-10-12', malformedSymbol: false });
    expect(counts).toMatchObject({ tfRecords: 4, woken: 3, proposed: 1, executed: 0, coincide: 0, rowsProposedOnly: 1, rowsExecutedOnly: 0, rowsBoth: 0, battles: 3, distinctIn: 1, distinctOut: 1, malformedSymbols: 0, perMonth: { '2026-10': 3 } });
  });
  it('a proposed and an executed swap that differ are two labelled rows; a coinciding pair is ONE row of kind both (review TE5-1)', () => {
    const differ = rec({}, { final: 'SWAP', finalSymbolOut: 'GOOGL', finalSymbolIn: 'amd' });
    const same = rec({ battleId: 'b2', tickId: 'b2:4' }, { final: 'SWAP', finalSymbolOut: 'GOOGL', finalSymbolIn: 'MU' });
    const { rows, counts } = selectPopulation([differ, same]);
    expect(rows.map((r) => [r.battleId, r.kind, r.symbolIn])).toEqual([['b1', 'proposed', 'MU'], ['b1', 'executed', 'AMD'], ['b2', 'both', 'MU']]);
    expect(counts).toMatchObject({ proposed: 2, executed: 2, coincide: 1, rowsProposedOnly: 1, rowsExecutedOnly: 1, rowsBoth: 1, distinctIn: 2 });
  });
  it('never carries the owner, and the capture instant is date-only', () => {
    const { rows } = selectPopulation([rec()]);
    expect(JSON.stringify(rows)).not.toMatch(/OWNER-NEVER-READ|owner/);
    expect(rows[0].decisionInstant).toEqual({ etDate: '2026-10-13', precision: 'date' });
    expect(rows[0].evidenceClass).toEqual({ decision: 'contemporaneous', bars: 'later_reconstruction', verdict: 'derived' });
    expect(Object.keys(rows[0]).filter((k) => /At$|time|instant/i.test(k))).toEqual(['decisionInstant']);
  });
  it('a symbol that could not be a file name or a URL segment is flagged, listed and never planned (review TE4-3)', () => {
    expect(SYMBOL_RE.test('BRK.B')).toBe(true);
    expect(SYMBOL_RE.test('../../X')).toBe(false);
    const { rows, counts, malformedSymbols } = selectPopulation([rec({}, { originalSymbolIn: '../../evil' })]);
    expect(rows[0]).toMatchObject({ symbolIn: '../../EVIL', malformedSymbol: true });
    expect(counts.malformedSymbols).toBe(1);
    expect(malformedSymbols).toEqual(['../../EVIL']);
    const plan = planFor(rows);
    expect(plan.pairs.map((p) => p.symbol)).toEqual(['GOOGL']);
    expect(plan.malformedSkipped).toEqual(['../../EVIL']);
  });
});

describe('the information cutoff: asOf is the previous session, never the check\'s own', () => {
  it('a Monday check reads Friday; the day after a holiday reads the session before it; outside the calendar is null', () => {
    expect(asOfFor('2026-10-13')).toBe('2026-10-12');
    expect(asOfFor('2026-10-12')).toBe('2026-10-09');
    expect(asOfFor('2026-09-08')).toBe('2026-09-04'); // Labor Day 7 Sep
    expect(asOfFor('2026-09-22')).toBe('2026-09-21');
    expect(asOfFor('2025-10-13')).toBeNull();
  });
  it('a row whose etDate has no previous session in the calendar is planned as calendar_missing, not evaluated', () => {
    const { rows } = selectPopulation([rec({ etDate: '2026-01-02' })]);
    expect(rows[0].asOf).toBeNull();
    const plan = planFor(rows);
    expect(plan.pairs).toEqual([]);
    expect(plan.calendarMissing).toEqual([{ etDate: '2026-01-02', kind: 'proposed', symbolIn: 'MU' }]);
  });
});

describe('redaction', () => {
  it('drops battleId and tickId, keeps the hashed battle id and the tick seq', () => {
    const { rows } = selectPopulation([rec()]);
    const red = redactRow(rows[0]);
    expect(red).not.toHaveProperty('battleId');
    expect(red).not.toHaveProperty('tickId');
    expect(red).not.toHaveProperty('owner');
    expect(red.battleHash).toBe(hashBattleId('b1'));
    expect(red.battleHash).toMatch(/^[0-9a-f]{12}$/);
    expect(red.tickSeq).toBe('3');
  });
});

describe('the plan: one counted EODHD call per distinct equity symbol', () => {
  it('pairs by (symbol, asOf, role), symbols deduplicated across ins and outs, crypto skipped, the window padded by 130 days', () => {
    const { rows } = selectPopulation([
      rec(),
      rec({ battleId: 'b2', tickId: 'b2:1', etDate: '2026-09-22' }, { originalSymbolOut: 'BTC', originalSymbolIn: 'MU' }),
      rec({ battleId: 'b3', tickId: 'b3:1', etDate: '2026-09-22' }, { originalSymbolOut: 'MU', originalSymbolIn: 'AMD' }),
    ]);
    const plan = planFor(rows);
    expect(plan.pairs.map((p) => `${p.symbol}|${p.asOf}|${p.role}`)).toEqual(['AMD|2026-09-21|entry', 'MU|2026-09-21|entry', 'MU|2026-09-21|holding', 'GOOGL|2026-10-12|holding', 'MU|2026-10-12|entry']);
    expect(plan.symbols).toEqual(['AMD', 'GOOGL', 'MU']);
    expect(plan.calls).toBe(3);
    expect(plan.cryptoSkipped).toEqual(['BTC']);
    expect(plan.from).toBe('2026-05-14');
    expect(plan.to).toBe('2026-10-12');
    expect(FROM_PAD_DAYS).toBe(130);
  });
  it('the EOD URL carries period=d, order=d, from and to, and the key is redacted from any log line, as a parameter and as a bare value', () => {
    const { eod, url } = eodUrl('BRK.B', 'SECRET-KEY-VALUE', '2026-05-14', '2026-10-12');
    expect(eod).toBe('BRK-B.US');
    expect(url).toBe('https://eodhd.com/api/eod/BRK-B.US?api_token=SECRET-KEY-VALUE&fmt=json&period=d&order=d&from=2026-05-14&to=2026-10-12');
    expect(redactEodhd(`fetch failed ${url}`)).not.toMatch(/SECRET-KEY-VALUE/);
    expect(redactEodhd(url)).toMatch(/api_token=\[REDACTED\]&fmt=json/);
    expect(redactEodhd('bare SECRET-KEY-VALUE in a message', 'SECRET-KEY-VALUE')).toBe('bare [REDACTED] in a message'); // review TE4-7
  });
  it('the call-cap guard refuses the 61st request before it is made and records every request it lets through', () => {
    expect(CALL_CAP).toBe(60);
    const state = { calls: 0, log: [] };
    let persisted = 0;
    const counter = makeCounter(state, CALL_CAP, () => { persisted += 1; });
    const taken = [];
    for (let i = 1; i <= 61; i++) taken.push(counter.take(`S${i}`));
    expect(taken.filter(Boolean)).toHaveLength(60);
    expect(taken[60]).toBe(false);
    expect(state.calls).toBe(60);
    expect(state.log).toHaveLength(60);
    expect(state.log[59].symbol).toBe('S60');
    expect(persisted).toBe(60);
    expect(counter.used).toBe(60);
  });
});

// ---------------------------------------------------------------- evaluated rows for the report helpers

const entryRecord = ({ verdict, reason = null, pattern = null, regime = 'uptrend', missing = [] }) => ({
  verdict, reason, pattern, regime, missing,
  patterns: { breakout: 'failed', pullback_resume: verdict === 'valid' ? 'satisfied' : 'failed' },
  factsUsed: Object.fromEntries(['C', 'SMA_fast', 'SMA_slow', 'SMA_slow_5ago', 'swingHigh', 'swingLow', 'ATR', 'V', 'V_avg'].map((k) => [k, { value: 1 }])),
  checks: [{ id: 'extension', lhs: 1, op: '<=', rhs: 2, result: true }],
  evidence: { volume: { bar0: { usable: true }, avg: { value: 1, barsUsable: 20, unusable: [] } }, adjustment: { metadata: 'present', missingDates: [] } },
});
// `owner` is planted on every row so a leak into summary.json or report.md would be caught by its value; the real rows never carry one.
const row = (symbol, asOf, entry, over = {}) => ({ battleId: `B${symbol}${asOf}`, tickId: `B${symbol}${asOf}:1`, tickSeq: '1', etDate: asOf, kind: 'proposed', symbol, symbolIn: symbol, symbolOut: 'OUT', asOf, entry, holding: { chartLeg: 'unknown', reasons: [] }, checks: { splitCheck: 'heuristic_ok' }, owner: 'OWNER-NEVER-READ', ...over });

describe('receipt selection', () => {
  it('takes the earliest check per verdict class, classes in sorted order, round-robin until ten, no duplicates', () => {
    const rows = [
      row('B', '2026-10-05', entryRecord({ verdict: 'valid', pattern: 'breakout' })),
      row('A', '2026-10-01', entryRecord({ verdict: 'valid', pattern: 'breakout' })),
      row('C', '2026-09-22', entryRecord({ verdict: 'invalid', reason: 'regime', regime: 'no_trend' })),
      row('D', '2026-09-23', entryRecord({ verdict: 'invalid', reason: 'regime', regime: 'no_trend' })),
      row('E', '2026-09-24', entryRecord({ verdict: 'unknown', reason: 'missing_fact', missing: ['V'] })),
      row('F', '2026-09-21', entryRecord({ verdict: 'invalid', reason: 'extended' })),
      row('F', '2026-09-21', entryRecord({ verdict: 'invalid', reason: 'extended' }), { kind: 'executed' }),
    ];
    const picked = pickReceipts(rows, RECEIPT_COUNT).map((r) => `${verdictClass(r.entry)}:${r.symbol}@${r.asOf}`);
    expect(picked).toEqual([
      'invalid/extended:F@2026-09-21', 'invalid/regime:C@2026-09-22', 'unknown/missing_fact:E@2026-09-24', 'valid/breakout:A@2026-10-01',
      'invalid/regime:D@2026-09-23', 'valid/breakout:B@2026-10-05',
    ]);
    expect(pickReceipts(rows, 3)).toHaveLength(3);
    expect(RECEIPT_COUNT).toBe(10);
  });
});

describe('the join to the Oct 14 scorer', () => {
  const rows = [
    row('MU', '2026-10-12', entryRecord({ verdict: 'valid', pattern: 'breakout' }), { battleId: 'b1', tickId: 'b1:3', symbolOut: 'GOOGL' }),
    row('AMD', '2026-10-12', entryRecord({ verdict: 'invalid', reason: 'regime' }), { battleId: 'b2', tickId: 'b2:1', symbolOut: 'PANW' }),
    row('V', '2026-10-12', entryRecord({ verdict: 'invalid', reason: 'regime' }), { battleId: 'b3', tickId: 'b3:1', symbolOut: 'PANW' }),
  ];
  const scorer = {
    controlRows: [
      { k: 'b1__b1:3', call: 'SWAP:GOOGL>MU', primary: { points: { status: 'scored', delta: 5 } } },
      { k: 'b2__b2:1', call: 'SWAP:PANW>AMD', primary: { points: { status: 'scored', delta: -1 } } },
      { k: 'b3__b3:1', call: 'SWAP:PANW>OTHER', primary: { points: { status: 'scored', delta: -9 } } }, // a different swap: no join
    ],
    controlMainRows: [{ k: 'b9__b9:1', call: 'SWAP:X>Y', primary: { points: { status: 'not_scored' } } }],
  };
  it('joins by battleId + tickId + the swap\'s call; beat / lost / tied with the ±1 tie; insufficient below 20 moments', () => {
    const j = joinScorer(rows, scorer);
    expect(j).toEqual({ available: true, joined: 2, byClass: { 'invalid/regime': { beat: 0, lost: 0, tied: 1 }, 'valid/breakout': { beat: 1, lost: 0, tied: 0 } }, sufficient: false });
    expect(MIN_JOINED_ROWS).toBe(20);
  });
  it('counts a moment once even if two rows share the tick and the call (review TE5-1)', () => {
    const dup = [...rows, { ...rows[0], kind: 'executed' }];
    expect(joinScorer(dup, scorer).joined).toBe(2);
  });
  it('is unavailable without a results file, and says so', () => {
    expect(joinScorer(rows, null)).toEqual({ available: false, joined: 0, byClass: {} });
  });
});

describe('the summary and the report carry counts only, with plan- and report-time provenance', () => {
  const prov = { head: 'abc', dirty: false, scriptSha256: 'ff'.repeat(32), moduleSha256: { thresholds: 'aa'.repeat(32) } };
  const manifest = {
    runId: 'tfs-20261028T120000', ...prov, provenance: { plan: prov, evaluate: prov },
    ruleSet: { setupVersion: 'tf-setup-v1', thresholdsHash: '26f3f411b566', semanticsId: 'tf-setup-v1/sem-1' },
    capture: { file: 'records.json', records: 3, sha256: 'cc'.repeat(32), timeFields: ['etDate'], keys: ['archetype', 'battleId', 'k', 'owner', 'ownerClass', 'tickId'] },
    runInstant: '2026-10-28T12:00:00.000Z', eodhd: { cap: 60, calls: 2, failures: { ZZZ: 'HTTP 502' } },
  };
  const rows = [
    row('MU', '2026-10-12', entryRecord({ verdict: 'valid', pattern: 'breakout' }), { battleId: 'SECRET-BATTLE-ID', tickId: 'SECRET-BATTLE-ID:3' }),
    row('AMD', '2026-10-12', entryRecord({ verdict: 'unknown', reason: 'missing_bar', regime: 'unknown', missing: ['C'] }), { battleId: 'SECRET-BATTLE-ID-2', tickId: 'SECRET-BATTLE-ID-2:1', kind: 'both' }),
  ];
  const pairs = [
    { symbol: 'MU', asOf: '2026-10-12', role: 'entry', rows: 1, mapperDropped: 1, result: { verdict: 'valid' } },
    { symbol: 'AMD', asOf: '2026-10-12', role: 'entry', rows: 1, mapperDropped: 0, result: { verdict: 'unknown' } },
    { symbol: 'OUT', asOf: '2026-10-12', role: 'holding', rows: 2, mapperDropped: 2, result: { chartLeg: 'unknown' } },
  ];
  const counts = { tfRecords: 3, woken: 2, battles: 2, proposed: 2, executed: 1, coincide: 1, rowsProposedOnly: 1, rowsExecutedOnly: 0, rowsBoth: 1, distinctIn: 2, distinctOut: 1, malformedSymbols: 0, perMonth: { '2026-10': 2 } };
  const plan = { symbols: ['AMD', 'MU', 'OUT'], cryptoSkipped: [], malformedSkipped: [], calendarMissing: [] };
  it('summarize: verdict, regime, pattern, holding and data-unknown counts over distinct pairs; provenance plan/evaluate/report; the capture\'s key names stay in the manifest', () => {
    const s = summarize({ rows, pairs, counts, plan, join: { available: false, joined: 0, byClass: {} }, manifest, reportProvenance: prov });
    expect(s.verdicts).toEqual({ 'unknown/missing_bar': 1, 'valid/breakout': 1 });
    expect(s.validByPattern).toEqual({ breakout: 1 });
    expect(s.unknownByReason).toEqual({ missing_bar: 1 });
    expect(s.regimes).toEqual({ unknown: 1, uptrend: 1 });
    expect(s.missingFacts).toEqual({ C: 1 });
    expect(s.holding.chartLeg).toEqual({ unknown: 2 });
    expect(s.dataUnknown).toMatchObject({ unknown: 1, attempted: 2, share: 0.5, limit: 0.25, aboveLimit: true });
    expect(s.receipts).toHaveLength(2);
    expect(s.coverage).toMatchObject({ woken: 2, rows: 2, kinds: { both: 1, proposed: 1 }, entryEvaluations: 2, holdingEvaluations: 2, pairs: 3, symbols: 3 });
    expect(s.eodhd).toMatchObject({ calls: 2, unfetched: 1, mapperDropped: 3 });
    expect(s.provenance).toMatchObject({ plan: prov, evaluate: prov, report: prov, drift: false });
    expect(s.provenance.capture).toEqual({ file: 'records.json', records: 3, sha256: 'cc'.repeat(32), timeFields: ['etDate'] });
    expect(JSON.stringify(s)).not.toMatch(/SECRET-BATTLE-ID|OWNER-NEVER-READ|"owner"|"keys"/);
  });
  it('a report produced at another head, script or on a dirty or unknown tree carries drift: true (review TE4-1)', () => {
    const base = { rows, pairs, counts, plan, join: { available: false, joined: 0, byClass: {} }, manifest };
    expect(summarize({ ...base, reportProvenance: { ...prov, head: 'def' } }).provenance.drift).toBe(true);
    expect(summarize({ ...base, reportProvenance: { ...prov, scriptSha256: '00'.repeat(32) } }).provenance.drift).toBe(true);
    expect(summarize({ ...base, reportProvenance: { ...prov, dirty: true } }).provenance.drift).toBe(true);
    expect(summarize({ ...base, reportProvenance: { ...prov, dirty: null } }).provenance.drift).toBe(true);
    expect(summarize({ ...base, reportProvenance: prov }).provenance.drift).toBe(false);
    // plan AND report on the same dirty tree agree with each other and are still drift: a dirty tree never passes as clean (mutant M45)
    const dirtyProv = { ...prov, dirty: true };
    const dirtyManifest = { ...manifest, dirty: true, provenance: { plan: dirtyProv, evaluate: dirtyProv } };
    expect(summarize({ ...base, manifest: dirtyManifest, reportProvenance: dirtyProv }).provenance.drift).toBe(true);
    const unknownProv = { ...prov, dirty: null };
    expect(summarize({ ...base, manifest: { ...manifest, provenance: { plan: unknownProv, evaluate: unknownProv } }, reportProvenance: unknownProv }).provenance.drift).toBe(true);
  });
  it('renderReport: the sections, the distinct-pairs statement, the join line, the provenance lines, no raw id', () => {
    const s = summarize({ rows, pairs, counts, plan, join: { available: true, joined: 2, byClass: { 'valid/breakout': { beat: 1, lost: 1, tied: 0 } }, sufficient: false }, manifest, reportProvenance: prov });
    const md = renderReport(s);
    for (const h of ['## Provenance', '## Coverage', '## EODHD', '## Entry verdicts', '## Holding', '## Data-unknown share', '## Receipts', '## Join to the Oct 14 scorer', '## Reconstruction limits']) expect(md).toContain(h);
    expect(md).toMatch(/distinct equity \(symbol, asOf\) entry pairs: 1 unknown of 2 attempted = \*\*50\.0%\*\* \(limit one quarter: \*\*ABOVE/);
    expect(md).toContain('coverage insufficient for any behavioral statement');
    expect(md).toContain('### Receipt 1: AMD as of 2026-10-12 — unknown(missing_bar), regime unknown');
    expect(md).toContain('- plan: HEAD `abc` (clean)');
    expect(md).toContain('- report: HEAD `abc` (clean)');
    expect(md).toContain('plan and report provenance agree; the tree was clean');
    expect(md).toContain('unfetched symbols 1 ({"ZZZ":"HTTP 502"})');
    expect(md).toContain('rows dropped by mapDailyRows before the adapter 3');
    expect(md).not.toMatch(/SECRET-BATTLE-ID|OWNER-NEVER-READ|DRIFT/);
    const drifted = renderReport(summarize({ rows, pairs, counts, plan, join: { available: false, joined: 0, byClass: {} }, manifest, reportProvenance: { ...prov, head: 'def', dirty: null } }));
    expect(drifted).toContain('**DRIFT:');
    expect(drifted).toContain('- report: HEAD `def` (tree state unknown)');
    expect(drifted).toContain('join unavailable');
  });
});
