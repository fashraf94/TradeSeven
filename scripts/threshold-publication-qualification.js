// Offline qualification under a PROPOSED rule. This cannot approve admissions.
import { expectedSessionAt, hashValue, instant, validDate } from '../api/_utils/measuredStockThreshold.js';
export const PUBLICATION_RULE = Object.freeze({
  id: 'eodhd_us_completed_session_observation_v1_proposed',
  status: 'proposed_owner_approval_pending',
  provider: 'EODHD', endpoint: 'eod', exchanges: ['NYSE', 'NASDAQ'],
  minimumMinutesAfterScheduledClose: 15,
  evidenceSource: 'https://eodhd.com/financial-apis/api-for-historical-data-and-volumes',
  snapshotRequirement: 'one_complete_response_with_all_fifteen_expected_sessions',
  revisionHandling: 'new_full_snapshot_new_input_receipt_existing_admissions_keep_frozen_receipt',
  attestationAuthority: 'owner_approved_server_collector_with_versioned_policy_and_input_hash',
  ohlcTolerance: 0,
});
export const PUBLICATION_RULE_HASH = hashValue(PUBLICATION_RULE);
export function validateQualification(exported, qualification) {
  if (qualification == null) return;
  if (qualification.schemaVersion !== 1 || qualification.exportHash !== hashValue(exported) || qualification.ruleId !== PUBLICATION_RULE.id || qualification.ruleHash !== PUBLICATION_RULE_HASH || instant(qualification.observedAt) === null || instant(qualification.observedAt) < instant(exported.exportedAt) || !Array.isArray(qualification.identities)) throw new TypeError('Invalid or unbound qualification evidence');
  const seen = new Set();
  for (const item of qualification.identities) {
    if (!item || typeof item.symbol !== 'string' || seen.has(item.symbol)) throw new TypeError('Invalid/duplicate identity evidence');
    if (!Array.isArray(item.qualificationIssues ?? []) || (item.qualificationIssues || []).some(issue => !['provider_identity_unresolved', 'corporate_action_continuity_unresolved'].includes(issue))) throw new TypeError('Invalid identity qualification issues');
    seen.add(item.symbol);
  }
}
export function qualifyInputs(row, measurement, qualification) {
  const issues = [...(row.qualificationIssues || [])];
  const identity = qualification?.identities.find(item => item.symbol === row.symbol);
  issues.push(...(identity?.qualificationIssues || []));
  const general = identity?.general;
  if (!identity) issues.push('provider_identity_evidence_missing');
  else if (identity.status !== 'observed' || identity.endpoint !== 'fundamentals/General' || identity.providerSymbol !== row.providerSymbol || general?.Code !== row.symbol || general?.Type !== 'Common Stock' || general?.CountryISO !== 'US' || typeof general?.Name !== 'string' || !general.Name || instant(identity.capturedAt) === null || instant(identity.capturedAt) > instant(qualification.observedAt)) issues.push('provider_identity_evidence_invalid');
  else if (general.IsDelisted !== false) issues.push('provider_security_not_current');
  if (measurement.measuredPct === undefined) issues.push(measurement.reason || 'measurement_inputs_unavailable');
  return { status: issues.length ? 'unqualified' : 'qualified', reasons: [...new Set(issues)], identity: identity ?? null, scope: 'provider_code_type_country_current_listing_and_explicit_catalog_conflicts; primary_exception_review_is_separate' };
}
export function qualifyPublication(row, exported, qualification, measurement) {
  const unqualified = reason => ({ status: 'unqualified', reason, ruleId: qualification?.ruleId ?? null, ruleApproved: false, admissionAuthorized: false });
  if (!qualification) return unqualified(row.finalization?.type === 'export_attestation' ? 'attested_only_provider_rule_unqualified' : 'publication_rule_evidence_missing');
  if (measurement.measuredPct === undefined) return unqualified('complete_session_window_missing_or_invalid');
  const snapshot = row.snapshot, provenance = snapshot?.provenance;
  const identity = qualification.identities.find(item => item.symbol === row.symbol);
  if (!PUBLICATION_RULE.exchanges.includes(identity?.general?.Exchange)) return unqualified('unsupported_exchange_publication_schedule');
  const capture = instant(snapshot?.capturedAt), expected = expectedSessionAt(snapshot?.capturedAt);
  if (capture === null || expected.status !== 'valid' || expected.sourceSession !== exported.expectedSession || capture < expected.closeMs + PUBLICATION_RULE.minimumMinutesAfterScheduledClose * 60000) return unqualified('publication_observation_before_accepted_window');
  if (provenance?.type !== 'provider_capture' || provenance.provider !== PUBLICATION_RULE.provider || provenance.endpoint !== PUBLICATION_RULE.endpoint || provenance.through !== exported.expectedSession || !validDate(provenance.from) || provenance.from > measurement.orderedBars[0].date || snapshot.fragments?.length) return unqualified('complete_provider_response_provenance_missing');
  if (snapshot.id !== hashValue({ providerSymbol: row.providerSymbol, capturedAt: snapshot.capturedAt, rows: snapshot.rows })) return unqualified('provider_capture_id_mismatch');
  if (row.finalization?.type !== 'provider_response_observation' || row.finalization.session !== exported.expectedSession || row.finalization.observedAt !== snapshot.capturedAt) return unqualified('response_observation_not_bound_to_snapshot');
  return { status: 'qualified_under_proposed_rule', reason: 'documented_publication_window_and_bound_complete_response_observation', ruleId: PUBLICATION_RULE.id, ruleHash: PUBLICATION_RULE_HASH, evidenceSource: PUBLICATION_RULE.evidenceSource, observedAt: snapshot.capturedAt, earliestObservationAt: new Date(expected.closeMs + 15 * 60000).toISOString(), ruleApproved: false, admissionAuthorized: false, revisionHandling: PUBLICATION_RULE.revisionHandling };
}
