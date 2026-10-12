#!/usr/bin/env node
// Local export auditor. No database, credentials, network, scoring or application imports.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { measureStock, candidatePolicyEffects, candidateRoundHalfEven, instant, hashValue } from '../api/_utils/measuredStockThreshold.js';
import { independentReference } from './threshold-audit-reference.js';
export const REFERENCE_TOLERANCE = Object.freeze({ absolute: 1e-10, relative: 1e-12 });
export const matchesReference = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= REFERENCE_TOLERANCE.absolute + REFERENCE_TOLERANCE.relative * Math.max(Math.abs(a), Math.abs(b));
const differences = (value, reference) => ({ signedDifference: value - reference, absoluteDifference: Math.abs(value - reference), relativeDifferencePct: reference === 0 ? (value === 0 ? 0 : null) : Math.abs((value - reference) / reference) * 100 });
function compareStored(stored, measurement) {
  if (!Array.isArray(stored) || !stored.length) return [{ status: 'unavailable', reason: 'persisted_values_not_exported' }];
  return stored.map(item => {
    if (item?.valuePct == null) return { mode: item?.mode ?? null, status: 'unavailable', reason: 'stored_value_missing' };
    if (!item || typeof item.valuePct !== 'number' || !Number.isFinite(item.valuePct) || item.valuePct < 0) return { mode: item?.mode ?? null, status: 'invalid', reason: 'invalid_stored_value' };
    const result = { ...item, ...differences(item.valuePct, measurement.measuredPct) };
    if (item.kind === 'legacy_percentile_proxy') {
      const p = item.atrPercentile;
      const usable = typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1;
      return { ...result, status: usable && matchesReference(item.valuePct, (p || 0.5) * 8) ? 'legacy_reproduction_only' : 'unavailable', reason: usable ? 'legacy_is_not_measured_certification' : 'legacy_input_missing', reproducedProxyPct: usable ? (p || 0.5) * 8 : null };
    }
    if (item.kind !== 'measurement_receipt') return { ...result, status: 'method_difference', reason: 'other_or_legacy_contract' };
    if (item.policyHash !== measurement.policyHash || item.inputHash !== measurement.inputHash || item.sourceSession !== measurement.sourceSession) return { ...result, status: 'unavailable', reason: 'receipt_identity_mismatch' };
    if (!matchesReference(item.atr14Dollars, measurement.atr14Dollars)) return { ...result, status: 'mismatch', reason: 'receipt_atr_mismatch' };
    return { ...result, status: matchesReference(item.valuePct, measurement.measuredPct) ? 'matched_measurement_receipt' : 'mismatch', reason: 'measurement_comparison_only' };
  });
}
export function auditExport(exported) {
  if (exported?.schemaVersion !== 1 || instant(exported.exportedAt) === null || typeof exported.environment !== 'string' || !exported.environment || typeof exported.universeId !== 'string' || !exported.universeId || !Array.isArray(exported.universe)) throw new TypeError('Invalid export manifest');
  const seen = new Set();
  for (const row of exported.universe) {
    if (!row || typeof row.symbol !== 'string' || !/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(row.symbol) || typeof row.eligible !== 'boolean' || seen.has(row.symbol)) throw new TypeError('Invalid/duplicate universe membership');
    if (!row.eligible && (typeof row.exclusionReason !== 'string' || !row.exclusionReason)) throw new TypeError('Excluded symbol requires a reason');
    seen.add(row.symbol);
  }
  const priority = symbol => { const index = ['UNP', 'HUM', 'ACN'].indexOf(symbol); return index < 0 ? 3 : index; };
  const rows = [...exported.universe].sort((a, b) => priority(a.symbol) - priority(b.symbol) || a.symbol.localeCompare(b.symbol)).map(row => {
    if (!row.eligible) return { symbol: row.symbol, bucket: 'excluded', reason: row.exclusionReason };
    if (!row.snapshot) return { symbol: row.symbol, providerSymbol: row.providerSymbol, bucket: 'unavailable', reason: row.collectionError || 'raw_snapshot_missing' };
    const measurement = measureStock({ symbol: row.symbol, providerSymbol: row.providerSymbol, expectedSourceSession: exported.expectedSession, asOf: exported.exportedAt, snapshot: row.snapshot, finalization: row.finalization });
    const qualificationIssues = row.qualificationIssues ?? [];
    if (!Array.isArray(qualificationIssues) || qualificationIssues.some(issue => !['provider_identity_unresolved', 'corporate_action_continuity_unresolved'].includes(issue))) throw new TypeError('Invalid qualification issues');
    const result = { symbol: row.symbol, providerSymbol: row.providerSymbol, expectedSession: exported.expectedSession, measurement, qualificationIssues, identityEvidence: row.identityEvidence ?? null, rankingEvidence: row.ranking ?? null, corporateActionEvidence: row.corporateActionEvidence ?? null };
    if (measurement.measuredPct === undefined) return { ...result, bucket: measurement.status === 'invalid' ? 'failed' : 'unavailable', reason: measurement.reason };
    const reference = independentReference(row.snapshot.rows, exported.expectedSession);
    const referenceMatched = matchesReference(reference.atr14Dollars, measurement.atr14Dollars) && matchesReference(reference.measuredPct, measurement.measuredPct) && JSON.stringify(reference.orderedDates) === JSON.stringify(measurement.orderedBars.map(b => b.date));
    const comparisons = compareStored(row.stored, measurement);
    const bucket = !referenceMatched || comparisons.some(c => ['invalid', 'mismatch'].includes(c.status)) ? 'failed' : qualificationIssues.length || measurement.status !== 'valid' || comparisons.some(c => c.status !== 'matched_measurement_receipt') ? 'unavailable' : 'passed';
    return { ...result, bucket, reason: !referenceMatched ? 'independent_reference_mismatch' : bucket === 'failed' ? 'persisted_mismatch' : bucket === 'passed' ? 'measurement_receipt_reproduced_not_runtime_certification' : qualificationIssues[0] || measurement.reason || 'persisted_measured_comparison_unavailable', reference, referenceMatched, referenceDifferences: differences(measurement.measuredPct, reference.measuredPct), comparisons, candidate: { ...candidatePolicyEffects(measurement.measuredPct), unboundedQuantizedPct: candidateRoundHalfEven(measurement.measuredPct) }, evidenceClass: exported.environment === 'synthetic_fixture' ? 'synthetic_control' : 'observed_export_arithmetic' };
  });
  const counts = { total: rows.length, eligible: rows.filter(r => r.bucket !== 'excluded').length, passed: 0, failed: 0, unavailable: 0, excluded: 0 };
  for (const row of rows) counts[row.bucket]++;
  if (counts.total !== counts.passed + counts.failed + counts.unavailable + counts.excluded || counts.eligible !== counts.passed + counts.failed + counts.unavailable) throw new Error('Counts do not reconcile');
  const measured = rows.filter(row => row.referenceMatched && !row.qualificationIssues.length);
  const values = measured.map(row => row.measurement.measuredPct).sort((a, b) => a - b);
  const percentile = q => values.length ? values[Math.ceil(q * values.length) - 1] : null;
  const middle = Math.floor(values.length / 2);
  const median = values.length ? values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2 : null;
  const affected = kind => measured.filter(row => row.candidate[kind]).map(row => ({ symbol: row.symbol, measuredPct: row.measurement.measuredPct, boundedPct: row.candidate.boundedPct, qualification: row.measurement.status }));
  return { schemaVersion: 1, environment: exported.environment, exportedAt: exported.exportedAt, deployedCommit: exported.deployedCommit ?? null, universeId: exported.universeId, exportHash: hashValue(exported), expectedSession: exported.expectedSession, counts, referenceTolerance: REFERENCE_TOLERANCE, rows, distribution: { scope: 'independently_matched_complete_windows_including_unqualified_publication_excluding_explicit_identity_continuity_issues', quantiles: 'median_middle_pair_average_p95_nearest_rank', arithmeticValidCount: rows.filter(r => r.referenceMatched).length, boundsUsableArithmeticCount: measured.length, boundsExcluded: rows.filter(r => r.referenceMatched && r.qualificationIssues.length).map(r => ({ symbol: r.symbol, measuredPct: r.measurement.measuredPct, reasons: r.qualificationIssues })), attestedValidCount: measured.filter(r => r.measurement.status === 'valid').length, min: values[0] ?? null, median, p95: percentile(0.95), max: values.at(-1) ?? null, floorAffected: affected('floorChanged'), capAffected: affected('capChanged') }, boundsRecommendation: 'D3_OPEN_review_distribution_and_publication_precision_qualification_before_selecting_bounds', productionScoringCertified: false };
}
export function formatAudit(report) {
  const { counts: c, distribution: d } = report;
  const lines = ['# BaggerBomb measured threshold numerical audit', '', `Environment: ${report.environment}. Expected source session: ${report.expectedSession}.`, '', '| Total | Eligible | Passed | Failed | Unavailable | Excluded |', '| --- | --- | --- | --- | --- | --- |', `| ${c.total} | ${c.eligible} | ${c.passed} | ${c.failed} | ${c.unavailable} | ${c.excluded} |`, '', 'Passed means a valid attested measurement and exported measurement receipt reproduced. It does not certify production scoring. Absent persisted measurements, legacy proxies, other-mode contracts and unproven finality are unavailable comparisons.', '', `Independent arithmetic windows: ${d.arithmeticValidCount}; usable for provisional bounds comparison: ${d.boundsUsableArithmeticCount}; attested valid: ${d.attestedValidCount}. Bounds-comparison unbounded range: ${d.min ?? 'unknown'}% to ${d.max ?? 'unknown'}%; median ${d.median ?? 'unknown'}%; p95 ${d.p95 ?? 'unknown'}%.`, '', `Candidate 1% floor changes ${d.floorAffected.length} stocks; candidate 15% cap changes ${d.capAffected.length}. D3 remains open. Unqualified publication rows are explicitly included as provisional arithmetic, not certified measurements.`, '', ...d.boundsExcluded.map(r => `Bounds comparison excludes ${r.symbol} (${r.measuredPct}%): ${r.reasons.join(', ')}. It remains in the universe reconciliation and per-symbol table.`), '', '| Symbol | Classification | ATR14 dollars | Unbounded percent | Candidate bounded percent | Reason |', '| --- | --- | --- | --- | --- | --- |'];
  const cell = v => String(v ?? 'unavailable').replace(/[|\r\n]/g, ' ');
  for (const row of report.rows) lines.push(`| ${cell(row.symbol)} | ${row.bucket} | ${cell(row.measurement?.atr14Dollars)} | ${cell(row.measurement?.measuredPct)} | ${cell(row.candidate?.boundedPct)} | ${cell(row.reason)} |`);
  for (const [label, affected] of [['Floor', d.floorAffected], ['Cap', d.capAffected]]) { lines.push('', `${label} affected symbols and raw percentages:`); for (const row of affected) lines.push(`- ${row.symbol}: ${row.measuredPct}% (${row.qualification}).`); }
  return lines.join('\n') + '\n';
}
export function writeAudit(report, directory) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'threshold-audit.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(directory, 'threshold-audit.md'), formatAudit(report));
  const fields = ['symbol', 'bucket', 'reason', 'sourceSession', 'expectedSession', 'atr14Dollars', 'measuredPct', 'boundedPct', 'quantizedPct', 'storedMode', 'storedSide', 'storedKind', 'storedValuePct', 'absoluteDifference', 'relativeDifferencePct', 'comparisonStatus'];
  const csvRows = report.rows.flatMap(r => (r.comparisons || [{}]).map(c => [r.symbol, r.bucket, r.reason, r.measurement?.sourceSession, r.expectedSession, r.measurement?.atr14Dollars, r.measurement?.measuredPct, r.candidate?.boundedPct, r.candidate?.quantizedPct, c.mode, c.side, c.kind, c.valuePct, c.absoluteDifference, c.relativeDifferencePct, c.status]));
  const csv = [fields, ...csvRows].map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
  fs.writeFileSync(path.join(directory, 'threshold-audit.csv'), csv);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--input' || args[2] !== '--out') throw new TypeError('Usage: node scripts/threshold-audit.js --input snapshot.json --out output-directory');
    const report = auditExport(JSON.parse(fs.readFileSync(args[1], 'utf8')));
    writeAudit(report, args[3]); console.log(JSON.stringify({ counts: report.counts, distribution: report.distribution, productionScoringCertified: false }));
    if (report.counts.failed) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
