import policyV2 from '../../docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_V2_20261015.json' with { type: 'json' };
import { canonicalContentHash } from './canonicalHash.js';
import { STOCK_MODEL, sameModel } from '../../src/utils/stockThresholdModel.js';
const freeze = o => { Object.values(o).forEach(v => { if (v && typeof v === 'object') freeze(v); }); return Object.freeze(o); };
export const APPROVED_STOCK_POLICY = freeze(policyV2.policy);
if (APPROVED_STOCK_POLICY.modelId !== STOCK_MODEL.modelId || APPROVED_STOCK_POLICY.publicationRule.id !== STOCK_MODEL.publicationRuleId || canonicalContentHash(APPROVED_STOCK_POLICY) !== STOCK_MODEL.policyHash || canonicalContentHash(APPROVED_STOCK_POLICY.publicationRule) !== STOCK_MODEL.publicationRuleHash) throw new Error('Registered stock policy content changed');
// The v2 allowlist pilot approval (docs/approvals/BAGGERBOMB_STOCK_THRESHOLDS_V2_PILOT_20261015.md).
// approvedAt is the receipt of the prompt carrying Rulings 6–16; creation before it is refused.
export const STOCK_APPROVAL = freeze({ ...STOCK_MODEL, version: 1, approvedAt: '2026-10-15T20:23:45Z', decision: 'Owner-approved v2 allowlist pilot (Rulings 1–16)', evidenceRef: 'docs/approvals/BAGGERBOMB_STOCK_THRESHOLDS_V2_PILOT_20261015.md', collectorId: 'eodhd_stock_server_collector_v1', activationAuthorized: true, activationScope: 'control_document_allowlist_pilot' });
export function resolveStockApproval(model) { return sameModel(model) ? STOCK_APPROVAL : null; }
export const STOCK_ADMISSION_CONTROL_PATH = 'stockThresholdControl/admission';
// v2 Ruling 6: schema 2 carries the audience. Only allowlist mode with a non-empty
// list of owner ids selects; any other mode (a future 'all' included), an old
// schema, a disabled or an unparseable document is closed, and closed means legacy.
export const STOCK_ADMISSION_CONTROL_SCHEMA = 2;
export function validStockAdmissionControl(control) {
  const ids = control?.audience?.ownerIds;
  return control?.schemaVersion === STOCK_ADMISSION_CONTROL_SCHEMA && control.enabled === true && Number.isInteger(control.epoch) && control.epoch > 0 && resolveStockApproval(control.model) !== null
    && control.audience?.mode === 'allowlist' && Array.isArray(ids) && ids.length > 0 && ids.every(id => typeof id === 'string' && id.length > 0);
}
// v2 Rulings 5 and 14: the pilot unit is the account (ownerId), never an agent.
export function stockAdmissionSelects(control, ownerId) {
  return validStockAdmissionControl(control) && typeof ownerId === 'string' && ownerId.length > 0 && control.audience.ownerIds.includes(ownerId);
}
