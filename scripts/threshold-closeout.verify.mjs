import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPreviousSessionDate } from '../src/utils/marketCalendar.js';
import { hashValue, measureStock } from '../api/_utils/measuredStockThreshold.js';
import { auditExport, formatAudit } from './threshold-audit.js';
import { PUBLICATION_RULE, PUBLICATION_RULE_HASH } from './threshold-publication-qualification.js';
import { collectIdentity } from './collect-threshold-identities.js';
function row(symbol = 'UNP', range = 2) {
  const dates = ['2026-10-09']; while (dates.length < 15) dates.unshift(getPreviousSessionDate(dates[0]));
  const result = { symbol, eligible: true, providerSymbol: symbol + '.US', snapshot: { providerSymbol: symbol + '.US', capturedAt: '2026-10-09T20:30:00Z', basis: 'raw_ohlc_adjusted_close', rows: dates.map(date => ({ date, open: 100, high: 100 + range / 2, low: 100 - range / 2, close: 100, adjusted_close: 100 })), provenance: { type: 'provider_capture', provider: 'EODHD', endpoint: 'eod', from: dates[0], through: '2026-10-09' } }, finalization: { type: 'provider_response_observation', session: '2026-10-09', final: null, observedAt: '2026-10-09T20:30:00Z' }, stored: [] };
  result.snapshot.id = hashValue({ providerSymbol: result.providerSymbol, capturedAt: result.snapshot.capturedAt, rows: result.snapshot.rows }); return result;
}
function fixture(rows = [row()]) {
  const exported = { schemaVersion: 1, environment: 'synthetic_fixture', universeId: 'synthetic-universe', exportedAt: '2026-10-09T21:00:00Z', expectedSession: '2026-10-09', universe: rows };
  const qualification = { schemaVersion: 1, observedAt: '2026-10-09T21:00:00Z', exportHash: hashValue(exported), ruleId: PUBLICATION_RULE.id, ruleHash: PUBLICATION_RULE_HASH, identities: rows.filter(r => r.eligible).map(r => ({ symbol: r.symbol, providerSymbol: r.providerSymbol, endpoint: 'fundamentals/General', status: 'observed', capturedAt: '2026-10-09T20:45:00Z', general: { Code: r.symbol, Name: 'Synthetic issuer', Type: 'Common Stock', CountryISO: 'US', Exchange: 'NYSE', IsDelisted: false } })) };
  return { exported, qualification };
}
const run = f => auditExport(f.exported, { qualification: f.qualification });
const rebind = f => { f.qualification.exportHash = hashValue(f.exported); return f; };
function measuredReceipt(r) { const m = measureStock({ ...r, expectedSourceSession: '2026-10-09', asOf: '2026-10-09T21:00:00Z' }); return { kind: 'measurement_receipt', valuePct: m.measuredPct, atr14Dollars: m.atr14Dollars, inputHash: m.inputHash, policyHash: m.policyHash, sourceSession: m.sourceSession }; }
test('Missing corrected receipts do not block proposed-rule measurement qualification', () => {
  const report = run(fixture()); const r = report.rows[0];
  assert.equal(r.arithmetic.status, 'matched'); assert.equal(r.inputs.status, 'qualified'); assert.equal(r.publication.status, 'qualified_under_proposed_rule'); assert.equal(r.persisted.status, 'unavailable');
  assert.equal(r.measurement.status, 'unavailable'); assert.equal(r.measurementQualification, 'qualified_under_proposed_rule');
  assert.equal(report.counts.passed, 1); assert.equal(report.milestones.measurementQualifiedUnderApprovedRule, 0); assert.equal(report.productionScoringCertified, false); assert.equal(r.publication.ruleApproved, false); assert.equal(r.publication.admissionAuthorized, false);
});
test('Free text plus final=true stays unqualified even when the persisted receipt matches', () => {
  const r = row(); r.finalization = { type: 'export_attestation', session: '2026-10-09', final: true, source: 'arbitrary free text', observedAt: r.snapshot.capturedAt }; r.stored = [measuredReceipt(r)];
  const f = fixture([r]); const withRule = run(f); const noRule = auditExport(f.exported);
  for (const report of [withRule, noRule]) { assert.equal(report.rows[0].persisted.status, 'matched'); assert.equal(report.rows[0].publication.status, 'unqualified'); assert.equal(report.distribution.qualifiedCount, 0); }
  assert.equal(noRule.rows[0].publication.reason, 'attested_only_provider_rule_unqualified');
});
test('Stored failure stays visible beside qualified measurement or unavailable inputs', () => {
  const r = row(); r.stored = [{ ...measuredReceipt(r), valuePct: 99 }];
  const f = fixture([r]); let report = run(f);
  assert.equal(report.rows[0].measurementQualification, 'qualified_under_proposed_rule'); assert.equal(report.rows[0].persisted.status, 'failed'); assert.equal(report.counts.failed, 1); assert.equal(report.distribution.qualifiedCount, 1);
  f.exported.universe[0].qualificationIssues = ['provider_identity_unresolved']; report = run(rebind(f));
  assert.equal(report.rows[0].inputs.status, 'unqualified'); assert.equal(report.rows[0].persisted.status, 'failed'); assert.equal(report.counts.failed, 1); assert.ok(formatAudit(report).includes('persisted_comparison_failed'));
  f.exported.universe[0].snapshot.rows.pop(); f.exported.universe[0].stored = [{ valuePct: -1 }]; report = run(rebind(f)); assert.equal(report.rows[0].arithmetic.status, 'unavailable'); assert.equal(report.rows[0].persisted.status, 'failed');
});
test('Proposed publication requires documented exchange, full provenance and observation timing', () => {
  for (const mutate of [f => { f.qualification.identities[0].general.Exchange = 'PINK'; }, f => { f.exported.universe[0].snapshot.provenance.provider = 'other'; }, f => { f.exported.universe[0].snapshot.provenance.from = '2026-10-08'; }, f => { const r = f.exported.universe[0]; r.snapshot.capturedAt = r.finalization.observedAt = '2026-10-09T20:14:59Z'; }, f => { f.exported.universe[0].finalization.observedAt = '2026-10-09T20:31:00Z'; }, f => { f.exported.universe[0].snapshot.rows.pop(); }]) {
    const f = fixture(); mutate(f); const report = run(rebind(f)); assert.equal(report.rows[0].publication.status, 'unqualified'); assert.equal(report.distribution.qualifiedCount, 0);
  }
  const boundary = fixture(); const r = boundary.exported.universe[0]; r.snapshot.capturedAt = r.finalization.observedAt = '2026-10-09T20:15:00Z'; r.snapshot.id = hashValue({ providerSymbol: r.providerSymbol, capturedAt: r.snapshot.capturedAt, rows: r.snapshot.rows }); assert.equal(run(rebind(boundary)).distribution.qualifiedCount, 1);
  r.snapshot.id = 'forged'; assert.equal(run(rebind(boundary)).rows[0].publication.reason, 'provider_capture_id_mismatch');
});
test('Qualification evidence must bind the exact export and known rule; absent/current identity checks fail closed', () => {
  for (const mutate of [f => { f.qualification.exportHash = 'wrong'; }, f => { f.qualification.ruleHash = 'wrong'; }, f => { f.qualification.observedAt = '2026-10-09T20:00:00Z'; }, f => { f.qualification.identities.push(f.qualification.identities[0]); }]) { const f = fixture(); mutate(f); assert.throws(() => run(f)); }
  for (const mutate of [f => { f.qualification.identities = []; }, f => { f.qualification.identities[0].general.IsDelisted = true; }, f => { f.qualification.identities[0].general.Code = 'WRONG'; }, f => { f.qualification.identities[0].capturedAt = '2026-10-10T20:00:00Z'; }]) { const f = fixture(); mutate(f); assert.equal(run(f).rows[0].inputs.status, 'unqualified'); }
});
test('D3 statistics use only qualified rows and keep every exclusion in the universe', () => {
  const f = fixture([row('LOW', 0.5), row('MID', 2), row('HIGH', 20), row('PARA', 30), { symbol: 'OFF', eligible: false, exclusionReason: 'not_ranked' }]); f.exported.universe[3].qualificationIssues = ['provider_identity_unresolved'];
  const report = run(rebind(f)); const d = report.distribution;
  assert.equal(report.counts.total, 5); assert.equal(report.counts.eligible, 4); assert.equal(report.counts.excluded, 1); assert.equal(report.milestones.arithmetic.matched, 4); assert.equal(d.qualifiedCount, 3); assert.equal(d.median, 2); assert.equal(d.p95, 20); assert.equal(d.max, 20);
  assert.deepEqual(d.floorAffected.map(r => r.symbol), ['LOW']); assert.deepEqual(d.capAffected.map(r => r.symbol), ['HIGH']); assert.equal(d.floorAffectedFrequency, 1 / 3); assert.equal(d.provisionalRows[0].symbol, 'PARA');
});
test('Identity collection uses GET and sanitizes transport errors without leaking credentials', async () => {
  const key = 'SYNTHETIC_SECRET'; const methods = [];
  const result = await collectIdentity('UNP', { key, clock: () => '2026-10-09T21:00:00Z', fetcher: async (_, options) => { methods.push(options.method); return { ok: true, json: async () => ({ Code: 'UNP', Name: 'Synthetic issuer' }) }; } });
  assert.deepEqual(methods, ['GET']); assert.equal(result.status, 'observed'); assert.ok(!JSON.stringify(result).includes(key));
  const failed = await collectIdentity('UNP', { key, fetcher: async () => { throw new Error(key); } }); assert.equal(failed.reason, 'provider_identity_transport'); assert.ok(!JSON.stringify(failed).includes(key));
  const para = await collectIdentity('PARA', { key, clock: () => '2026-10-09T20:45:00Z', fetcher: async () => ({ ok: true, json: async () => ({ Code: 'PARA', Name: 'Banzai International, Inc.', Type: 'Common Stock', CountryISO: 'US', Exchange: 'NASDAQ', IsDelisted: false }) }) });
  assert.deepEqual(para.qualificationIssues, ['provider_identity_unresolved']);
  const f = fixture([row('PARA')]); f.qualification.identities = [para]; assert.equal(run(f).distribution.qualifiedCount, 0);
});
