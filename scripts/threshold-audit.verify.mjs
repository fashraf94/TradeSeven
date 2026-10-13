import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
// Unmocked production imports are the Node dependency-surface guard (BUILD_RULES §4).
import { measureStock, normalizeRawSnapshot, calculateMeasuredATR, candidateRoundHalfEven, candidatePolicyEffects, expectedSessionAt, validDate, instant, MEASUREMENT_POLICY } from '../api/_utils/measuredStockThreshold.js';
import { getPreviousSessionDate } from '../src/utils/marketCalendar.js';
import { calculateATR } from '../api/_utils/technicalCalculations.js';
import { independentReference } from './threshold-audit-reference.js';
import { auditExport, matchesReference, formatAudit, writeAudit } from './threshold-audit.js';
import { collectProviderSymbol, projectStoredBattle } from './collect-threshold-export.js';
import { calculateAssetScoreServer } from '../api/_utils/agentScoring.js';
import { evaluateRisk } from '../api/_utils/agentRiskManager.js';
import { resolveHurdleAtr } from '../api/_utils/hurdleAtr.js';
import { evaluateTriggers } from '../api/_utils/agentTriggerGate.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function dates(end = '2026-10-09') { const result = [end]; while (result.length < 15) result.unshift(getPreviousSessionDate(result[0])); return result; }
function input(symbol = 'UNP', range = 2) {
  return { symbol, providerSymbol: symbol + '.US', expectedSourceSession: '2026-10-09', asOf: '2026-10-09T21:00:00Z',
    snapshot: { id: 'synthetic-' + symbol, providerSymbol: symbol + '.US', capturedAt: '2026-10-09T20:30:00Z', basis: 'raw_ohlc_adjusted_close', rows: dates().map(date => ({ date, open: 100, high: 100 + range / 2, low: 100 - range / 2, close: 100, adjusted_close: 50 })), provenance: { type: 'synthetic' } },
    finalization: { type: 'export_attestation', session: '2026-10-09', final: true, observedAt: '2026-10-09T20:30:00Z', source: 'synthetic test attestation' } };
}
function checked(value) { const actual = measureStock(value); assert.equal(actual.status, 'valid', JSON.stringify(actual)); const ref = independentReference(value.snapshot.rows, value.expectedSourceSession); assert.ok(matchesReference(actual.atr14Dollars, ref.atr14Dollars)); assert.ok(matchesReference(actual.measuredPct, ref.measuredPct)); return actual; }
function exportRow(symbol, range = 2) { const value = input(symbol, range); return { symbol, eligible: true, providerSymbol: value.providerSymbol, snapshot: value.snapshot, finalization: value.finalization }; }
function receipt(row) { const m = measureStock({ ...row, expectedSourceSession: '2026-10-09', asOf: '2026-10-09T21:00:00Z' }); return { mode: 'test_measurement', kind: 'measurement_receipt', valuePct: m.measuredPct, atr14Dollars: m.atr14Dollars, sourceSession: m.sourceSession, policyHash: m.policyHash, inputHash: m.inputHash }; }
function exported(rows) { return { schemaVersion: 1, exportedAt: '2026-10-09T21:00:00Z', environment: 'synthetic_fixture', universeId: 'synthetic-universe', expectedSession: '2026-10-09', universe: rows }; }

test('Measured inputs matter; percentile is irrelevant', () => {
  const a = input(); a.atrPercentile = 0.94; const b = input('UNP', 8); b.atrPercentile = 0.94;
  assert.equal(checked(a).measuredPct, 2); assert.equal(checked(b).measuredPct, 8);
  const c = structuredClone(a); c.atrPercentile = 0; assert.equal(checked(c).measuredPct, 2);
  assert.equal(checked(a).scoringPct, null); assert.equal(MEASUREMENT_POLICY.bounds, 'unresolved');
});
test('Fifteen versus fourteen sessions, missing expected session and a gap', () => {
  checked(input());
  for (const index of [0, 7, 14]) { const value = input(); value.snapshot.rows.splice(index, 1); assert.equal(measureStock(value).reason, 'missing_sessions'); }
  const value = input(); value.snapshot.rows[0].date = getPreviousSessionDate(value.snapshot.rows[0].date); assert.equal(measureStock(value).reason, 'missing_sessions');
});
test('Valid zero volatility is preserved without a scoring default', () => {
  const actual = checked(input('ZERO', 0)); assert.equal(actual.measuredPct, 0); assert.equal(actual.zeroVolatility, true); assert.equal(actual.scoringPct, null);
  assert.equal(candidatePolicyEffects(0).boundedPct, 1); assert.equal(candidatePolicyEffects(0).scoringEligibility, 'unresolved_D3');
});
test('Known mixed-basis example is consistently normalized to two percent', () => {
  const value = input(); const actual = checked(value); assert.equal(actual.measuredPct, 2); assert.equal(actual.atr14Dollars, 1);
  const legacy = calculateATR(value.snapshot.rows.map(r => r.high).reverse(), value.snapshot.rows.map(r => r.low).reverse(), value.snapshot.rows.map(r => r.adjusted_close).reverse()); assert.equal(legacy.percent, 102);
  assert.equal(actual.orderedBars[0].factor, 0.5); assert.equal(actual.orderedBars[0].raw.high, 101);
});
test('Synthetic split and a revised complete adjusted snapshot', () => {
  const value = input(); value.snapshot.rows = value.snapshot.rows.map((row, i) => i < 10 ? row : { ...row, open: 50, high: 50.5, low: 49.5, close: 50 });
  const actual = checked(value); assert.equal(actual.measuredPct, 2);
  const revised = structuredClone(value); revised.snapshot.id = 'revised-full-window'; for (const row of revised.snapshot.rows) row.adjusted_close /= 2;
  const next = checked(revised); assert.ok(matchesReference(actual.measuredPct, next.measuredPct)); assert.ok(matchesReference(actual.atr14Dollars / 2, next.atr14Dollars)); assert.notEqual(actual.inputHash, next.inputHash);
});
test('Input ordering is explicit and input is never mutated', () => {
  const value = input(); const original = JSON.stringify(value); const forward = checked(value); const reversed = structuredClone(value); reversed.snapshot.rows.reverse();
  assert.equal(checked(reversed).inputHash, forward.inputHash); assert.equal(JSON.stringify(value), original);
  const refetched = structuredClone(value); refetched.snapshot.id = 'a-different-whole-snapshot'; assert.equal(checked(refetched).inputHash, forward.inputHash);
});
test('Duplicates, weekend insertions, malformed dates and fragments fail explicitly', () => {
  const duplicate = input(); duplicate.snapshot.rows.push({ ...duplicate.snapshot.rows[0] }); assert.equal(measureStock(duplicate).reason, 'duplicate_session');
  const weekend = input(); weekend.snapshot.rows.push({ ...weekend.snapshot.rows[0], date: '2026-10-03' }); assert.equal(measureStock(weekend).reason, 'non_exchange_session_in_window');
  for (const date of ['2026-02-30', '2026-13-01', 'not-a-date']) { const value = input(); value.snapshot.rows[0].date = date; assert.equal(measureStock(value).reason, 'invalid_session_date'); }
  for (const mutate of [v => { v.snapshot.fragments = ['old', 'new']; }, v => { v.snapshot.rows[0].snapshotId = 'different'; }]) { const value = input(); mutate(value); assert.equal(measureStock(value).reason, 'incompatible_fragments'); }
});
test('Strict numeric fields reject malformed and non-positive evidence', () => {
  for (const number of [null, '', true, '100junk', ' 100', '1e309', 0, -1, NaN, Infinity]) { const value = input(); value.snapshot.rows[3].high = number; assert.equal(measureStock(value).reason, 'invalid_price', String(number)); }
  const value = input(); for (const row of value.snapshot.rows) { row.close = '1e2'; row.open = '+100.0'; } checked(value);
  for (const mutate of [r => { r.high = 98; }, r => { r.open = 102; }, r => { r.close = 98; }]) { const value = input(); mutate(value.snapshot.rows[3]); assert.equal(measureStock(value).reason, 'incoherent_ohlc'); }
});
test('Normalization handles endpoint equality without a price tolerance', () => {
  const value = input(); for (const row of value.snapshot.rows) { row.open = row.high = row.close = 123.45; row.low = 122; row.adjusted_close = 97.321; } checked(value);
});
test('Forming rows cannot become historical scoring inputs', () => {
  const value = input(); value.asOf = '2026-10-12T15:00:00Z'; value.snapshot.capturedAt = '2026-10-12T14:30:00Z'; value.snapshot.rows.push({ date: '2026-10-12', open: null, high: null, low: null, close: null, adjusted_close: null });
  const actual = checked(value); assert.equal(actual.sourceSession, '2026-10-09'); assert.equal(actual.excludedBarCount, 1);
});
test('Calendar handles normal close, early close, holiday, weekend and DST', () => {
  const cases = [['2026-10-09T19:59:59Z', '2026-10-08'], ['2026-10-09T20:00:00Z', '2026-10-09'], ['2026-10-10T21:00:00Z', '2026-10-09'], ['2026-07-03T21:00:00Z', '2026-07-02'], ['2026-09-07T21:00:00Z', '2026-09-04'], ['2026-11-27T17:59:59Z', '2026-11-25'], ['2026-11-27T18:00:00Z', '2026-11-27'], ['2026-03-06T20:59:59Z', '2026-03-05'], ['2026-03-06T21:00:00Z', '2026-03-06'], ['2026-03-09T20:00:00Z', '2026-03-09']];
  for (const [asOf, expected] of cases) assert.equal(expectedSessionAt(asOf).sourceSession, expected);
  assert.equal(expectedSessionAt('2028-01-04T21:00:00Z').reason, 'calendar_missing');
  for (const date of ['2026-02-30', '2026-13-01']) assert.equal(validDate(date), false);
  for (const time of ['2026-10-09', '2026-10-09T24:00:00Z', '2026-10-09T20:60:00Z']) assert.equal(instant(time), null);
});
test('Expected session, provider identity and finality never derive from the last row', () => {
  const stale = input(); stale.expectedSourceSession = '2026-10-08'; assert.equal(measureStock(stale).reason, 'expected_session_mismatch');
  const wrong = input(); wrong.providerSymbol = 'HUM.US'; assert.equal(measureStock(wrong).reason, 'provider_symbol_mismatch');
  const future = input(); future.snapshot.capturedAt = '2026-10-10T00:00:00Z'; assert.equal(measureStock(future).reason, 'future_snapshot');
  for (const mutate of [f => { f.final = false; }, f => { f.observedAt = '2026-10-09T19:59:00Z'; }, f => { f.observedAt = '2026-10-10T00:00:00Z'; }]) { const value = input(); mutate(value.finalization); const actual = measureStock(value); assert.equal(actual.status, 'unavailable'); assert.equal(actual.reason, 'finalization_unproven'); assert.equal(actual.measuredPct, 2); }
});
test('Candidate half-even rounding is exact for decimal half cases and stays provisional', () => {
  for (const [value, expected] of [[1.005, 1], [1.015, 1.02], [2.675, 2.68], [2.685, 2.68], [-1.015, -1.02], [1e-8, 0], [1e308, 1e308]]) assert.equal(candidateRoundHalfEven(value), expected);
  for (const value of [NaN, Infinity]) assert.throws(() => candidateRoundHalfEven(value));
  assert.equal(candidatePolicyEffects(0.5).status, 'candidate_not_approved'); assert.equal(candidatePolicyEffects(20).capChanged, true);
});
test('Archived real AAPL split/dividend fixture provenance, completeness and independent arithmetic', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/threshold-audit-fixtures.json'), 'utf8'));
  const bytes = fs.readFileSync(path.join(root, manifest.sourceFile)); assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sourceSha256);
  const rows = JSON.parse(bytes);
  const results = [];
  for (const window of manifest.windows) {
    const selected = rows.filter(row => row.date >= window.sessions[0] && row.date <= window.expectedSourceSession); assert.deepEqual(selected.map(row => row.date), window.sessions);
    const normalized = normalizeRawSnapshot({ id: 'archived-' + window.name, providerSymbol: manifest.providerSymbol, capturedAt: '2026-07-10T00:00:00Z', basis: 'raw_ohlc_adjusted_close', rows: selected }); assert.equal(normalized.status, 'valid');
    const actual = calculateMeasuredATR(normalized.rows); assert.equal(actual.status, 'valid'); const ref = independentReference(selected, window.expectedSourceSession); assert.ok(matchesReference(actual.atr14Dollars, ref.atr14Dollars)); assert.ok(matchesReference(actual.measuredPct, ref.measuredPct));
    if (window.name.includes('split')) { const before = normalized.rows.find(r => r.date === '2020-08-28'); const after = normalized.rows.find(r => r.date === '2020-08-31'); assert.ok(Math.abs(after.factor / before.factor - 4) < 1e-5); }
    else { const before = normalized.rows.find(r => r.date === '2020-08-06'); const after = normalized.rows.find(r => r.date === '2020-08-07'); assert.ok(after.factor > before.factor); }
    results.push({ name: window.name, sourceSession: window.expectedSourceSession, ...actual, qualification: 'archived_normalization_and_arithmetic_only', provenanceSha256: manifest.sourceSha256 });
  }
  const output = process.env.THRESHOLD_VERIFICATION_OUT;
  if (output) { fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'historical-fixture-results.json'), JSON.stringify(results, null, 2) + '\n'); }
});
test('Audit classifications reconcile dynamically and do not qualify arbitrary final attestations', () => {
  const unp = exportRow('UNP'); unp.stored = [receipt(unp)];
  const hum = exportRow('HUM'); hum.stored = [{ mode: 'legacy_agent', kind: 'legacy_percentile_proxy', valuePct: 7.52, atrPercentile: 0.94 }];
  const bad = exportRow('BAD'); bad.snapshot.rows[0].high = null;
  const zero = exportRow('ZERO', 0); zero.stored = [receipt(zero)];
  const report = auditExport(exported([zero, { symbol: 'OFF', eligible: false, exclusionReason: 'configured_not_ranked' }, bad, { symbol: 'ACN', eligible: true, providerSymbol: 'ACN.US' }, hum, unp]));
  assert.deepEqual(report.counts, { total: 6, eligible: 5, passed: 0, failed: 1, unavailable: 4, excluded: 1 }); assert.deepEqual(report.rows.slice(0, 3).map(r => r.symbol), ['UNP', 'HUM', 'ACN']);
  assert.equal(report.rows[0].persisted.status, 'matched'); assert.equal(report.rows[0].publication.reason, 'attested_only_provider_rule_unqualified');
  assert.equal(report.rows[1].comparisons[0].status, 'legacy_reproduction_only'); assert.equal(report.distribution.provisionalArithmetic.floorAffected[0].symbol, 'ZERO'); assert.equal(report.productionScoringCertified, false);
  assert.equal(auditExport(exported([exportRow('ACN')])).counts.passed, 0);
  assert.throws(() => auditExport(exported([exportRow('ACN'), exportRow('ACN')])));
  assert.throws(() => auditExport(exported([{ symbol: 'ACN', eligible: false }])));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'threshold-audit-verify-')); try { writeAudit(report, dir); assert.ok(fs.readFileSync(path.join(dir, 'threshold-audit.md'), 'utf8').includes('D3 remains open')); assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'threshold-audit.json'))).counts.total, 6); assert.ok(formatAudit(report).includes('legacy')); } finally { for (const name of ['threshold-audit.json', 'threshold-audit.md', 'threshold-audit.csv']) fs.unlinkSync(path.join(dir, name)); fs.rmdirSync(dir); }
});
test('Audit reports cap effects, zero relative denominators, missing receipt identity and invalid stored values', () => {
  const cap = exportRow('CAP', 20); const zero = exportRow('ZERO', 0); zero.stored = [{ mode: 'legacy', kind: 'legacy_fixed', valuePct: 2.5 }];
  const report = auditExport(exported([cap, zero])); assert.equal(report.distribution.provisionalArithmetic.capAffected[0].symbol, 'CAP'); assert.equal(report.distribution.median, null); assert.equal(report.rows.find(r => r.symbol === 'ZERO').comparisons[0].relativeDifferencePct, null);
  for (const stored of [[{ kind: 'measurement_receipt', valuePct: 2 }], [{ kind: 'legacy', valuePct: null }]]) { const row = exportRow('UNP'); row.stored = stored; assert.equal(auditExport(exported([row])).counts.unavailable, 1); }
  const row = exportRow('UNP'); row.stored = [{ valuePct: -1 }]; assert.equal(auditExport(exported([row])).counts.failed, 1);
  const conflicted = exportRow('PARA', 20); conflicted.qualificationIssues = ['provider_identity_unresolved']; conflicted.stored = [receipt(conflicted)]; const conflictReport = auditExport(exported([conflicted])); assert.equal(conflictReport.counts.unavailable, 1); assert.equal(conflictReport.distribution.arithmeticValidCount, 1); assert.equal(conflictReport.distribution.boundsUsableArithmeticCount, 0); assert.equal(conflictReport.distribution.capAffected.length, 0); assert.equal(conflictReport.distribution.boundsExcluded[0].symbol, 'PARA');
});
test('Read-only collection uses GET, preserves two sides, and never records the key', async () => {
  const calls = []; const key = 'TEST_SECRET_NOT_A_REAL_KEY';
  const result = await collectProviderSymbol('UNP', { key, expectedSession: '2026-10-09', clock: () => '2026-10-09T20:30:00Z', fetcher: async (url, options) => { calls.push({ endpoint: url.pathname, method: options.method }); return { ok: true, json: async () => url.pathname.includes('/eod/') ? input().snapshot.rows : [] }; } });
  assert.equal(calls.length, 3); assert.ok(calls.every(c => c.method === 'GET')); assert.ok(!JSON.stringify(result).includes(key)); assert.equal(result.finalization.final, null);
  const battle = { portfolio: { star: [{ symbol: 'UNP', baseATR: 2, positionId: 'left-leg' }] }, opponent: { portfolio: { star: [{ symbol: 'UNP', baseATR: 3, positionId: 'right-leg' }] } }, scoring: { thresholds: { UNP: { threshold: 4 } } } };
  const projected = projectStoredBattle('battle', battle); assert.equal(projected.length, 4); assert.deepEqual(projected.filter(r => r.source === 'held_asset.baseATR').map(r => [r.side, r.positionId, r.valuePct]), [['agent', 'left-leg', 2], ['cpu', 'right-leg', 3]]);
  const source = fs.readFileSync(path.join(root, 'scripts/collect-threshold-export.js'), 'utf8').replaceAll('url.searchParams.set(', 'url.searchParams.queryParameter('); assert.ok(!/\.(?:set|update|delete|add)\s*\(/.test(source));
});
test('The independent reference has no import of production calculation or scoring', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/threshold-audit-reference.js'), 'utf8'); assert.ok(!/^import /m.test(source)); assert.ok(!source.includes('calculateMeasuredATR'));
  const measurement = fs.readFileSync(path.join(root, 'api/_utils/measuredStockThreshold.js'), 'utf8'); assert.ok(!/firebase|React|localStorage/.test(measurement));
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, 'src/utils/marketCalendar.js'), 'utf8').replace(/\r\n/g, '\n')).digest('hex'), MEASUREMENT_POLICY.calendarSourceSha256);
});
test('Separate calibrated inputs preserve emergency/stepped-trail/hurdle units; reward locks and wakes change', () => {
  const asset = { symbol: 'HUM', baseATR: 7.52, tier: 'support' };
  const oldScore = calculateAssetScoreServer(asset, -2);
  const corrected = calculateAssetScoreServer({ ...asset, baseATR: 2 }, -2);
  const risk = divisor => evaluateRisk(asset, 98, 100, divisor, null, {});
  assert.deepEqual(risk(asset.baseATR), risk(oldScore.baseATR)); assert.equal(risk(asset.baseATR).action, 'HOLD'); assert.equal(risk(corrected.baseATR).action, 'EMERGENCY_SWAP');
  const trailing = divisor => evaluateRisk(asset, 107.9, 100, divisor, { sma20_5m: 108 }, {});
  assert.deepEqual(trailing(asset.baseATR), trailing(oldScore.baseATR)); assert.equal(trailing(asset.baseATR).action, 'HOLD'); assert.equal(trailing(2).action, 'TRAIL_STOP');
  assert.equal(resolveHurdleAtr('HUM', new Map(), asset.baseATR).atr, 7.52);
  const lock = divisor => evaluateRisk(asset, 101.8, 100, divisor, null, {});
  assert.equal(lock(4).action, 'HOLD'); assert.equal(lock(2).action, 'LOCK');
  const battle = { evaluations: [{}], timing: { endsAt: new Date(Date.now() + 4 * 3600000).toISOString() }, portfolio: { bench: {} } };
  const oldWake = evaluateTriggers(battle, [oldScore], {}, [], {}, []);
  const newWake = evaluateTriggers(battle, [corrected], {}, [], {}, []);
  assert.equal(oldWake.triggers.some(t => t.type === 'price_drop'), false); assert.equal(newWake.triggers.some(t => t.type === 'price_drop'), true);
  const result = { baselineRiskAction: risk(asset.baseATR).action, separatedRiskAction: risk(oldScore.baseATR).action, unsafeDirectReplacementAction: risk(corrected.baseATR).action, baselineLock: lock(4).action, measuredLock: lock(2).action, baselineWake: oldWake.triggers, measuredWake: newWake.triggers, oldScore: oldScore.totalPoints, correctedScore: corrected.totalPoints, qualification: 'verification of preserved operands and known effects; no runtime adapter integrated' };
  if (process.env.THRESHOLD_VERIFICATION_OUT) fs.writeFileSync(path.join(process.env.THRESHOLD_VERIFICATION_OUT, 'consumer-preservation-results.json'), JSON.stringify(result, null, 2) + '\n');
});
test('Trailing guardrail keeps matching divisor/history; a measured peak cannot replace a calibrated peak', () => {
  const source = fs.readFileSync(path.join(root, 'api/_utils/agentGuardrails.js'), 'utf8');
  const extract = (name, dependencies = {}) => { const start = source.indexOf('function ' + name + '('); const end = source.indexOf('\n}', start); assert.ok(start >= 0 && end > start); return vm.runInNewContext('(' + source.slice(start, end + 2) + ')', dependencies); };
  const trailing = extract('computeTrailingDrawdownPct', { getEntryPrice: extract('getEntryPrice'), getCurrentPrice: extract('getCurrentPrice') });
  const position = { symbol: 'HUM', baseATR: 7.52, swapPrice: 100 };
  const legacy = { thresholdHistory: { HUM: { maxMultiplier: 1 } } };
  const separate = { ...legacy, scoring: { positionHistory: { 'new-leg': { maxMultiplier: 3.76 } } } };
  assert.equal(trailing(position, { HUM: { current: 104 } }, legacy), trailing(position, { HUM: { current: 104 } }, separate));
  assert.notEqual(trailing(position, { HUM: { current: 104 } }, legacy), trailing(position, { HUM: { current: 104 } }, { thresholdHistory: { HUM: { maxMultiplier: 3.76 } } }));
});
