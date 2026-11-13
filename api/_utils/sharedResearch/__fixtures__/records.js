// api/_utils/sharedResearch/__fixtures__/records.js
//
// Shared Research record fixtures, built through the research model's own
// writers (buildRecord, buildFinding, findingAppendPatch, summaryRevisionPatch):
//
//   the DATA-CENTER case (spec §9 Correction A, §6.11 companies.test.js): the
//   prototype's case translated to records and to the game universe — step 1
//   writes d1–d3 and an unresolved supplier (dm1, Northfield Thermal, a
//   company with no symbol); a refresh adds no relationship; d4 verifies
//   Eaton's (ETN) supplier relationship; d4x corrects d4 to unavailable.
//
//   the SHOP PAY case (spec §9 Correction C, §6.11 adoptPreview.test.js): the
//   62% source p3; p2 and p5 corrected by p2r and p5r; a complication p4;
//   a second supported company (AAPL) to deselect.
//
// The companies and figures are fixture text, not market facts.

import {
  buildRecord, buildFinding, findingAppendPatch, summaryRevisionPatch, manualFunnel, emptyTelemetry, HOST_COLLECTIONS,
} from '../../researchRecords/model.js';

export const OWNER = 'u-sr-1';
export const SESSION_ID = '0b6f3c1e-1d2a-4e5f-8a9b-1c2d3e4f5a6b';
export const RECORD_ID = `sr_${SESSION_ID}`;
export const EXCHANGE_ID = '6f1c2b0e-8a7d-4c3b-9e21-0a5d4f3e2b1c';
export const T0 = '2026-11-10T14:00:00.000Z';
export const T1 = '2026-11-10T15:00:00.000Z';
export const T2 = '2026-11-11T15:00:00.000Z';
export const T3 = '2026-11-12T15:00:00.000Z';
/** A finding id from a short name: deterministic, valid (f_ + v4 uuid). */
export const fid = (name) => {
  const hex = [...name].map((c) => c.charCodeAt(0).toString(16)).join('').padEnd(12, '0').slice(0, 12);
  return `f_00000000-0000-4000-8000-${hex}`;
};

export function baseRecord({ question, sessionId = SESSION_ID, uid = OWNER, createdAt = T0 } = {}) {
  return buildRecord({
    researchWorkId: `sr_${sessionId}`, userId: uid, origin: 'shared_research', host: { collection: HOST_COLLECTIONS.shared_research, id: sessionId },
    createdAt, question, funnel: manualFunnel(), budget: null, telemetry: emptyTelemetry(),
  });
}

const retrieval = (url, label) => ({ recordKind: 'retrieval', recordId: url, label, url });
const exchange = (label) => ({ recordKind: 'exchange', recordId: EXCHANGE_ID, label });

/** Append findings, each `[name, raw]`, at `nowIso`. */
export function withFindings(record, entries, nowIso) {
  let r = record;
  for (const [name, raw] of entries) r = { ...r, ...findingAppendPatch(r, buildFinding(raw, { findingId: fid(name), nowIso }), { nowIso }) };
  return r;
}
export function withSummary(record, { text, basedOn, nowIso }) {
  return { ...record, ...summaryRevisionPatch(record, { text, basedOn: basedOn.map(fid) }, { nowIso }) };
}

// ── the data-center case (Correction A) ───────────────────────────────────────

export const DC_QUESTION = 'Data-center builders say power and cooling equipment, not chips, now sets the pace of new capacity. Which company earns from it?';
export const DC_STEP1 = [
  ['d1', { kind: 'coverage', symbol: null, fact: 'Lead times for data-center switchgear and transformers stretched past a year in 2026.', source: retrieval('https://example.com/dc-power', 'example.com · Power gear lead times stretch'), at: '2026-11-03T00:00:00.000Z', asOf: '2026-11-03T00:00:00.000Z', status: 'verified', statusReason: null }],
  ['d2', { kind: 'product', symbol: null, fact: 'Coolant distribution units are sold by several equipment makers.', source: retrieval('https://example.com/cdu', 'example.com · Coolant distribution units'), at: '2026-11-02T00:00:00.000Z', asOf: '2026-11-02T00:00:00.000Z', status: 'verified', statusReason: null }],
  ['d3', { kind: 'inference', symbol: null, fact: 'Equipment makers with power and cooling lines may earn from the delay.', source: exchange('Inferred in this step'), at: T1, asOf: null, status: 'unverified', statusReason: 'inference' }],
  ['dm1', { kind: 'relationship', symbol: null, fact: 'Supplier · Northfield Thermal: supplies coolant distribution units to hyperscale builders.', source: exchange('Not yet checked'), at: T1, asOf: null, status: 'unavailable', statusReason: 'not_checked' }],
];
export const DC_REFRESH = [
  ['r1', { kind: 'coverage', symbol: null, fact: 'A second report repeats the lead-time figure for switchgear.', source: retrieval('https://example.org/repeat', 'example.org · Switchgear lead times'), at: '2026-11-09T00:00:00.000Z', asOf: '2026-11-09T00:00:00.000Z', status: 'verified', statusReason: null }],
];
export const DC_D4 = [
  ['d4', { kind: 'relationship', symbol: 'ETN', fact: 'Supplier · Eaton sells switchgear and power distribution equipment to data-center builders.', source: retrieval('https://example.com/etn-dc', 'example.com · Eaton data-center orders'), at: '2026-11-05T00:00:00.000Z', asOf: '2026-11-05T00:00:00.000Z', status: 'verified', statusReason: null }],
];
export const DC_D4X = [
  ['d4x', { kind: 'relationship', symbol: 'ETN', fact: "Supplier · The only source for Eaton's data-center sales is the company's own release.", source: exchange('Not yet checked'), at: T3, asOf: null, status: 'unavailable', statusReason: 'single_source', supersedes: fid('d4') }],
];

/** The data-center record at a stage: 'step1' · 'refresh' · 'd4' · 'd4x'. */
export function dataCenterRecord(stage) {
  let r = withFindings(baseRecord({ question: DC_QUESTION }), DC_STEP1, T1);
  if (stage === 'step1') return r;
  r = withFindings(r, DC_REFRESH, T2);
  if (stage === 'refresh') return r;
  r = withFindings(r, DC_D4, T2);
  if (stage === 'd4') return r;
  return withFindings(r, DC_D4X, T3);
}

// ── the Shop Pay case (Correction C) ─────────────────────────────────────────

export const SP_QUESTION = 'Faster checkout is spreading across online stores; which company earns from it?';
export function shopPayRecord() {
  let r = baseRecord({ question: SP_QUESTION });
  r = withFindings(r, [
    ['p1', { kind: 'relationship', symbol: 'SHOP', fact: 'Product owner · Shopify owns Shop Pay, its accelerated checkout.', source: retrieval('https://example.com/shop-pay', 'example.com · Shop Pay'), at: '2026-11-01T00:00:00.000Z', asOf: '2026-11-01T00:00:00.000Z', status: 'verified', statusReason: null }],
    ['p2', { kind: 'earnings_fact', symbol: 'SHOP', fact: 'Shop Pay processed $20 billion of gross merchandise volume in the quarter.', source: retrieval('https://example.com/q3', 'example.com · Shopify Q3'), at: '2026-10-30T00:00:00.000Z', asOf: '2026-10-30T00:00:00.000Z', status: 'verified', statusReason: null }],
    ['p3', { kind: 'earnings_fact', symbol: 'SHOP', fact: "Shop Pay's volume grew 62% from a year earlier.", source: retrieval('https://example.com/q3-letter', 'example.com · Shopify letter'), at: '2026-10-30T00:00:00.000Z', asOf: '2026-10-30T00:00:00.000Z', status: 'verified', statusReason: null }],
    ['p4', { kind: 'inference', symbol: null, fact: 'A rival wallet may take share at the same checkouts.', source: exchange('Inferred in this step'), at: T1, asOf: null, status: 'unverified', statusReason: 'inference' }],
    ['p5', { kind: 'relationship', symbol: 'SHOP', fact: "Product owner · Shop Pay's fee revenue for Shopify is not broken out.", source: exchange('Not yet checked'), at: T1, asOf: null, status: 'unavailable', statusReason: 'not_disclosed' }],
    ['a1', { kind: 'relationship', symbol: 'AAPL', fact: 'Competitor · Apple Pay competes with Shop Pay at online checkout.', source: retrieval('https://example.com/apple-pay', 'example.com · Apple Pay'), at: '2026-10-28T00:00:00.000Z', asOf: '2026-10-28T00:00:00.000Z', status: 'verified', statusReason: null }],
  ], T1);
  r = withFindings(r, [
    ['p2r', { kind: 'earnings_fact', symbol: 'SHOP', fact: 'Shop Pay processed $21 billion of gross merchandise volume in the quarter.', source: retrieval('https://example.com/q3-corrected', 'example.com · Shopify Q3, corrected'), at: '2026-10-30T00:00:00.000Z', asOf: '2026-10-30T00:00:00.000Z', status: 'verified', statusReason: null, supersedes: fid('p2') }],
    ['p5r', { kind: 'relationship', symbol: 'SHOP', fact: "Product owner · The size of Shop Pay's fee revenue for Shopify is not disclosed.", source: exchange('Not yet checked'), at: T2, asOf: null, status: 'unavailable', statusReason: 'not_disclosed', supersedes: fid('p5') }],
    ['ic', { kind: 'idea', symbol: 'SHOP', fact: "Shopify earns from faster checkout through Shop Pay, whose volume grew 62% from a year earlier. The size of its fee revenue is not disclosed.", source: exchange('Proposed claim'), at: T2, asOf: null, status: 'unverified', statusReason: 'proposed_claim' }],
  ], T2);
  return r;
}
/** The Shop Pay case's latest lines (stored on the partner exchange): the complication p4, the missing link p5 (since corrected). */
export const SP_LINES = Object.freeze({ support: fid('p3'), complication: fid('p4'), missing: fid('p5') });
export const SP_NAMES = Object.freeze({ SHOP: 'Shopify Inc.', AAPL: 'Apple Inc.' });
