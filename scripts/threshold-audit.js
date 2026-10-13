#!/usr/bin/env node
// Local export auditor. No database, credentials, network, scoring or application imports.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { measureStock, candidatePolicyEffects, candidateRoundHalfEven, instant, hashValue } from '../api/_utils/measuredStockThreshold.js';
import { independentReference } from './threshold-audit-reference.js';
import { validateQualification, qualifyInputs, qualifyPublication, PUBLICATION_RULE } from './threshold-publication-qualification.js';
export const REFERENCE_TOLERANCE = Object.freeze({ absolute: 1e-10, relative: 1e-12 });
export const matchesReference = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= REFERENCE_TOLERANCE.absolute + REFERENCE_TOLERANCE.relative * Math.max(Math.abs(a), Math.abs(b));
const differences = (value, reference) => ({ signedDifference: value - reference, absoluteDifference: Math.abs(value - reference), relativeDifferencePct: reference === 0 ? (value === 0 ? 0 : null) : Math.abs((value - reference) / reference) * 100 });
function compareStored(stored, measurement) {
  if (!Array.isArray(stored) || !stored.length) return [{ status: 'unavailable', reason: 'persisted_values_not_exported' }];
  return stored.map(item => {
    if (item?.valuePct == null) return { mode: item?.mode ?? null, status: 'unavailable', reason: 'stored_value_missing' };
    if (!item || typeof item.valuePct !== 'number' || !Number.isFinite(item.valuePct) || item.valuePct < 0) return { mode: item?.mode ?? null, status: 'invalid', reason: 'invalid_stored_value' };
    if (measurement.measuredPct === undefined) return { ...item, status: 'unavailable', reason: 'measurement_inputs_unavailable' };
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
export function auditExport(exported, { qualification = null } = {}) {
  if (exported?.schemaVersion !== 1 || instant(exported.exportedAt) === null || typeof exported.environment !== 'string' || !exported.environment || typeof exported.universeId !== 'string' || !exported.universeId || !Array.isArray(exported.universe)) throw new TypeError('Invalid export manifest');
  validateQualification(exported, qualification);
  const seen = new Set();
  for (const row of exported.universe) {
    if (!row || typeof row.symbol !== 'string' || !/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(row.symbol) || typeof row.eligible !== 'boolean' || seen.has(row.symbol)) throw new TypeError('Invalid/duplicate universe membership');
    if (!row.eligible && (typeof row.exclusionReason !== 'string' || !row.exclusionReason)) throw new TypeError('Excluded symbol requires a reason');
    seen.add(row.symbol);
  }
  const priority = symbol => { const index = ['UNP', 'HUM', 'ACN'].indexOf(symbol); return index < 0 ? 3 : index; };
  const rows = [...exported.universe].sort((a, b) => priority(a.symbol) - priority(b.symbol) || a.symbol.localeCompare(b.symbol)).map(row => {
    if (!row.eligible) return { symbol: row.symbol, bucket: 'excluded', reason: row.exclusionReason, arithmetic: { status: 'excluded' }, inputs: { status: 'excluded' }, publication: { status: 'excluded' }, persisted: { status: 'excluded' }, measurementQualification: 'excluded' };
    const measurement = row.snapshot ? measureStock({ symbol: row.symbol, providerSymbol: row.providerSymbol, expectedSourceSession: exported.expectedSession, asOf: exported.exportedAt, snapshot: row.snapshot, finalization: row.finalization }) : { status: 'unavailable', reason: row.collectionError || 'raw_snapshot_missing' };
    const qualificationIssues = row.qualificationIssues ?? [];
    if (!Array.isArray(qualificationIssues) || qualificationIssues.some(issue => !['provider_identity_unresolved', 'corporate_action_continuity_unresolved'].includes(issue))) throw new TypeError('Invalid qualification issues');
    const result = { symbol: row.symbol, providerSymbol: row.providerSymbol, expectedSession: exported.expectedSession, measurement, qualificationIssues, identityEvidence: row.identityEvidence ?? null, rankingEvidence: row.ranking ?? null, corporateActionEvidence: row.corporateActionEvidence ?? null };
    const hasMeasurement = measurement.measuredPct !== undefined;
    const reference = hasMeasurement ? independentReference(row.snapshot.rows, exported.expectedSession) : null;
    const referenceMatched = hasMeasurement && matchesReference(reference.atr14Dollars, measurement.atr14Dollars) && matchesReference(reference.measuredPct, measurement.measuredPct) && JSON.stringify(reference.orderedDates) === JSON.stringify(measurement.orderedBars.map(b => b.date));
    const arithmetic = { status: hasMeasurement ? referenceMatched ? 'matched' : 'failed' : measurement.status === 'invalid' ? 'failed' : 'unavailable', reason: hasMeasurement ? referenceMatched ? null : 'independent_reference_mismatch' : measurement.reason };
    const inputs = qualifyInputs(row, measurement, qualification);
    const publication = qualifyPublication(row, exported, qualification, measurement);
    const comparisons = compareStored(row.stored, measurement);
    const persisted = { status: comparisons.some(c => ['invalid', 'mismatch'].includes(c.status)) ? 'failed' : comparisons.every(c => c.status === 'matched_measurement_receipt') ? 'matched' : 'unavailable', reasons: [...new Set(comparisons.filter(c => c.status !== 'matched_measurement_receipt').map(c => c.reason))] };
    const qualified = arithmetic.status === 'matched' && inputs.status === 'qualified' && publication.status === 'qualified_under_proposed_rule';
    const measurementQualification = qualified ? 'qualified_under_proposed_rule' : 'unqualified';
    // Compatibility bucket prioritizes failures; the four independent milestones remain authoritative.
    const bucket = arithmetic.status === 'failed' || persisted.status === 'failed' ? 'failed' : qualified ? 'passed' : 'unavailable';
    const reason = persisted.status === 'failed' ? 'persisted_comparison_failed' : arithmetic.status === 'failed' ? arithmetic.reason : qualified ? 'measurement_qualified_under_proposed_rule_owner_approval_pending' : inputs.reasons[0] || publication.reason;
    return { ...result, bucket, reason, arithmetic, inputs, publication, persisted, measurementQualification, reference, referenceMatched, referenceDifferences: hasMeasurement ? differences(measurement.measuredPct, reference.measuredPct) : null, comparisons, candidate: hasMeasurement ? { ...candidatePolicyEffects(measurement.measuredPct), unboundedQuantizedPct: candidateRoundHalfEven(measurement.measuredPct) } : null, evidenceClass: exported.environment === 'synthetic_fixture' ? 'synthetic_control' : 'observed_export_arithmetic' };
  });
  const counts = { total: rows.length, eligible: rows.filter(r => r.bucket !== 'excluded').length, passed: 0, failed: 0, unavailable: 0, excluded: 0 };
  for (const row of rows) counts[row.bucket]++;
  if (counts.total !== counts.passed + counts.failed + counts.unavailable + counts.excluded || counts.eligible !== counts.passed + counts.failed + counts.unavailable) throw new Error('Counts do not reconcile');
  const measured = rows.filter(row => row.measurementQualification === 'qualified_under_proposed_rule');
  const provisional = rows.filter(row => row.referenceMatched && !row.qualificationIssues.length);
  const values = measured.map(row => row.measurement.measuredPct).sort((a, b) => a - b);
  const percentile = q => values.length ? values[Math.ceil(q * values.length) - 1] : null;
  const middle = Math.floor(values.length / 2);
  const median = values.length ? values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2 : null;
  const affected = kind => measured.filter(row => row.candidate[kind]).map(row => ({ symbol: row.symbol, measuredPct: row.measurement.measuredPct, boundedPct: row.candidate.boundedPct, qualification: row.measurementQualification }));
  const stageCounts = key => rows.reduce((counts, row) => { const status = row[key].status; counts[status] = (counts[status] || 0) + 1; return counts; }, {});
  return { schemaVersion: 2, environment: exported.environment, exportedAt: exported.exportedAt, qualificationObservedAt: qualification?.observedAt ?? null, qualificationHash: qualification ? hashValue(qualification) : null, deployedCommit: exported.deployedCommit ?? null, universeId: exported.universeId, exportHash: hashValue(exported), expectedSession: exported.expectedSession, counts, milestones: { arithmetic: stageCounts('arithmetic'), inputs: stageCounts('inputs'), publication: stageCounts('publication'), persisted: stageCounts('persisted'), measurementQualifiedUnderProposedRule: measured.length, measurementQualifiedUnderApprovedRule: 0 }, publicationRule: PUBLICATION_RULE, referenceTolerance: REFERENCE_TOLERANCE, rows, distribution: { scope: 'qualified_under_explicit_proposed_rule_owner_approval_pending', quantiles: 'median_middle_pair_average_p95_nearest_rank', arithmeticValidCount: rows.filter(r => r.referenceMatched).length, boundsUsableArithmeticCount: provisional.length, qualifiedCount: measured.length, qualifiedSymbols: measured.map(r => r.symbol), provisionalRows: rows.filter(r => r.bucket !== 'excluded' && r.measurementQualification === 'unqualified').map(r => ({ symbol: r.symbol, measuredPct: r.measurement.measuredPct ?? null, inputReasons: r.inputs.reasons, publicationReason: r.publication.reason })), boundsExcluded: rows.filter(r => r.referenceMatched && r.qualificationIssues.length).map(r => ({ symbol: r.symbol, measuredPct: r.measurement.measuredPct, reasons: r.qualificationIssues })), attestedValidCount: provisional.filter(r => r.measurement.status === 'valid').length, min: values[0] ?? null, median, p95: percentile(0.95), max: values.at(-1) ?? null, floorAffected: affected('floorChanged'), capAffected: affected('capChanged'), floorAffectedFrequency: measured.length ? affected('floorChanged').length / measured.length : null, capAffectedFrequency: measured.length ? affected('capChanged').length / measured.length : null, provisionalArithmetic: { count: provisional.length, floorAffected: provisional.filter(r => r.candidate.floorChanged).map(r => ({ symbol: r.symbol, measuredPct: r.measurement.measuredPct })), capAffected: provisional.filter(r => r.candidate.capChanged).map(r => ({ symbol: r.symbol, measuredPct: r.measurement.measuredPct })) } }, boundsRecommendation: 'D3_OPEN_preserve_measured_magnitude_pending_gameplay_evidence_and_owner_decision', productionScoringCertified: false };
}
export function formatAudit(report) {
  const { counts: c, distribution: d } = report;
  const lines = ['# BaggerBomb measured threshold numerical audit', '', `Environment: ${report.environment}. Expected source session: ${report.expectedSession}.`, '', '| Total | Eligible | Passed under proposed rule | Failed in any comparison | Unavailable | Excluded |', '| --- | --- | --- | --- | --- | --- |', `| ${c.total} | ${c.eligible} | ${c.passed} | ${c.failed} | ${c.unavailable} | ${c.excluded} |`, '', 'Schema V2 separates arithmetic, input qualification, publication qualification and persisted comparisons. Passed means measurement qualified under the explicit proposed rule; owner approval remains pending. A persisted failure takes precedence in the compatibility bucket and stays visible independently. Missing future receipts and legacy method differences do not block measurement qualification. Production scoring certification is false.', '', '| Milestone | Counts over full universe |', '| --- | --- |', ...['arithmetic', 'inputs', 'publication', 'persisted'].map(k => `| ${k} | ${JSON.stringify(report.milestones[k])} |`), '', `Independent arithmetic: ${d.arithmeticValidCount}; measurement qualified under proposed rule: ${d.qualifiedCount}; approved-rule measurements: 0. Qualified unbounded range: ${d.min ?? 'unavailable'}% to ${d.max ?? 'unavailable'}%; median ${d.median ?? 'unavailable'}%; p95 ${d.p95 ?? 'unavailable'}%.`, '', `Candidate 1% floor changes ${d.floorAffected.length}/${d.qualifiedCount}; candidate 15% cap changes ${d.capAffected.length}/${d.qualifiedCount}. D3 remains open. Provisional rows are excluded from these statistics and retained below.`, '', '| Symbol | Bucket | Arithmetic | Inputs | Publication | Persisted | ATR14 dollars | Unbounded percent | Reason |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  const cell = v => String(v ?? 'unavailable').replace(/[|\r\n]/g, ' ');
  for (const row of report.rows) lines.push(`| ${cell(row.symbol)} | ${row.bucket} | ${row.arithmetic.status} | ${row.inputs.status} | ${row.publication.status} | ${row.persisted.status} | ${cell(row.measurement?.atr14Dollars)} | ${cell(row.measurement?.measuredPct)} | ${cell(row.reason)} |`);
  lines.push('', 'Unqualified/provisional rows and reasons:');
  for (const row of d.provisionalRows) lines.push(`- ${row.symbol}: ${row.inputReasons.join(', ')}; publication: ${row.publicationReason}.`);
  for (const [label, affected] of [['Floor', d.floorAffected], ['Cap', d.capAffected]]) { lines.push('', `${label} affected symbols and raw percentages:`); for (const row of affected) lines.push(`- ${row.symbol}: ${row.measuredPct}% (${row.qualification}).`); }
  return lines.join('\n') + '\n';
}
export function writeAudit(report, directory) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'threshold-audit.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(directory, 'threshold-audit.md'), formatAudit(report));
  const fields = ['symbol', 'bucket', 'reason', 'arithmeticStatus', 'inputStatus', 'publicationStatus', 'persistedStatus', 'measurementQualification', 'sourceSession', 'expectedSession', 'atr14Dollars', 'measuredPct', 'boundedPct', 'quantizedPct', 'storedMode', 'storedSide', 'storedKind', 'storedValuePct', 'absoluteDifference', 'relativeDifferencePct', 'comparisonStatus'];
  const csvRows = report.rows.flatMap(r => (r.comparisons || [{}]).map(c => [r.symbol, r.bucket, r.reason, r.arithmetic.status, r.inputs.status, r.publication.status, r.persisted.status, r.measurementQualification, r.measurement?.sourceSession, r.expectedSession, r.measurement?.atr14Dollars, r.measurement?.measuredPct, r.candidate?.boundedPct, r.candidate?.quantizedPct, c.mode, c.side, c.kind, c.valuePct, c.absoluteDifference, c.relativeDifferencePct, c.status]));
  const csv = [fields, ...csvRows].map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
  fs.writeFileSync(path.join(directory, 'threshold-audit.csv'), csv);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (![4, 6].includes(args.length) || args[0] !== '--input' || args[2] !== '--out' || (args.length === 6 && args[4] !== '--qualification')) throw new TypeError('Usage: node scripts/threshold-audit.js --input snapshot.json --out output-directory [--qualification qualification.json]');
    const qualification = args.length === 6 ? JSON.parse(fs.readFileSync(args[5], 'utf8')) : null;
    const report = auditExport(JSON.parse(fs.readFileSync(args[1], 'utf8')), { qualification });
    writeAudit(report, args[3]); console.log(JSON.stringify({ counts: report.counts, milestones: report.milestones, qualifiedCount: report.distribution.qualifiedCount, productionScoringCertified: false }));
    if (report.counts.failed) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
