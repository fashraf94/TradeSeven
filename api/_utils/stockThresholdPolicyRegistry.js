import candidate from '../../docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_CANDIDATE_V1_20261012.json' with { type: 'json' };
import { canonicalContentHash } from './canonicalHash.js';
import { STOCK_MODEL, sameModel } from '../../src/utils/stockThresholdModel.js';
const freeze = o => { Object.values(o).forEach(v => { if (v && typeof v === 'object') freeze(v); }); return Object.freeze(o); };
export const APPROVED_STOCK_POLICY = freeze(candidate.policy);
if (APPROVED_STOCK_POLICY.publicationRule.id !== STOCK_MODEL.publicationRuleId || canonicalContentHash(APPROVED_STOCK_POLICY) !== STOCK_MODEL.policyHash || canonicalContentHash(APPROVED_STOCK_POLICY.publicationRule) !== STOCK_MODEL.publicationRuleHash) throw new Error('Registered stock policy content changed');
export const STOCK_APPROVAL = freeze({ ...STOCK_MODEL, version: 1, approvedAt: '2026-10-13T23:31:49Z', decision: 'Owner-approved dormant implementation V1', evidenceRef: 'docs/approvals/BAGGERBOMB_STOCK_THRESHOLDS_ADOPTION_20261013.md', collectorId: 'eodhd_stock_server_collector_v1', activationAuthorized: false });
export function resolveStockApproval(model) { return sameModel(model) ? STOCK_APPROVAL : null; }
export const STOCK_ADMISSION_CONTROL_PATH = 'stockThresholdControl/admission';
export function validStockAdmissionControl(control) {
  return control?.schemaVersion === 1 && control.enabled === true && Number.isInteger(control.epoch) && control.epoch > 0 && resolveStockApproval(control.model) !== null;
}
