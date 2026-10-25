import policyV2 from '../../docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_V2_20261015.json' with { type: 'json' };
import { canonicalContentHash } from './canonicalHash.js';
import { STOCK_MODEL, sameModel } from '../../src/utils/stockThresholdModel.js';
const freeze = o => { Object.values(o).forEach(v => { if (v && typeof v === 'object') freeze(v); }); return Object.freeze(o); };
export const APPROVED_STOCK_POLICY = freeze(policyV2.policy);
if (APPROVED_STOCK_POLICY.modelId !== STOCK_MODEL.modelId || APPROVED_STOCK_POLICY.publicationRule.id !== STOCK_MODEL.publicationRuleId || canonicalContentHash(APPROVED_STOCK_POLICY) !== STOCK_MODEL.policyHash || canonicalContentHash(APPROVED_STOCK_POLICY.publicationRule) !== STOCK_MODEL.publicationRuleHash) throw new Error('Registered stock policy content changed');
// The v2 approval (docs/approvals/BAGGERBOMB_STOCK_THRESHOLDS_V2_PILOT_20261015.md):
// the allowlist pilot (Rulings 1–16) and the broad release (BR-1–BR-4, Oct 25, 2026).
// approvedAt is the receipt of the prompt carrying Rulings 6–16; creation before it is
// refused. The broad release changes who is admitted, not the model: the hashes stay.
export const STOCK_APPROVAL = freeze({ ...STOCK_MODEL, version: 2, approvedAt: '2026-10-15T20:23:45Z', decision: 'Owner-approved v2: allowlist pilot (Rulings 1–16), broad release (BR-1–BR-4)', evidenceRef: 'docs/approvals/BAGGERBOMB_STOCK_THRESHOLDS_V2_PILOT_20261015.md', collectorId: 'eodhd_stock_server_collector_v1', activationAuthorized: true, activationScope: 'control_document_audience_allowlist_or_all' });
export function resolveStockApproval(model) { return sameModel(model) ? STOCK_APPROVAL : null; }
export const STOCK_ADMISSION_CONTROL_PATH = 'stockThresholdControl/admission';
// v2 Ruling 6 and BR-4: schema 2 carries the audience. Two audiences select:
// an allowlist with a non-empty list of non-empty owner ids (those owners only),
// and exactly `{ mode: 'all' }` (every owner; no other key, so an 'all' carrying
// leftover ids is closed). Any other mode, an old schema, a disabled or an
// unparseable document is closed, and closed means legacy.
export const STOCK_ADMISSION_CONTROL_SCHEMA = 2;
export const isAllAudience = audience => !!audience && typeof audience === 'object' && !Array.isArray(audience) && audience.mode === 'all' && Object.keys(audience).length === 1;
const isAllowlistAudience = audience => {
  const ids = audience?.ownerIds;
  return audience?.mode === 'allowlist' && Array.isArray(ids) && ids.length > 0 && ids.every(id => typeof id === 'string' && id.length > 0);
};
export function validStockAdmissionControl(control) {
  return control?.schemaVersion === STOCK_ADMISSION_CONTROL_SCHEMA && control.enabled === true && Number.isInteger(control.epoch) && control.epoch > 0 && resolveStockApproval(control.model) !== null
    && (isAllAudience(control.audience) || isAllowlistAudience(control.audience));
}
// v2 Rulings 5 and 14: the unit is the account (ownerId), never an agent. BR-4:
// the 'all' audience selects every owner, and still needs an owner id.
export function stockAdmissionSelects(control, ownerId) {
  return validStockAdmissionControl(control) && typeof ownerId === 'string' && ownerId.length > 0 && (isAllAudience(control.audience) || control.audience.ownerIds.includes(ownerId));
}
