// This module is the registered server collector. Serialized client/analyst
// objects cannot acquire its in-process authority brand.
import { randomUUID } from 'node:crypto';
import { canonicalContentHash } from './canonicalHash.js';
import { expectedSessionAt, measureStock, strictNumber, instant } from './measuredStockThreshold.js';
import { getPreviousSessionDate } from '../../src/utils/marketCalendar.js';
import { STOCK_APPROVAL, APPROVED_STOCK_POLICY } from './stockThresholdPolicyRegistry.js';
import { validateActivationPrice } from './baselineValidation.js';
const collected = new WeakSet();
const observationDigests = new WeakMap();
const observationDigest = o => canonicalContentHash(JSON.parse(JSON.stringify(o)));
export const isServerStockObservation = o => collected.has(o);
export class StockThresholdRefusal extends Error {
  constructor(reason) { super(`Stock threshold unavailable: ${reason}`); this.name = 'StockThresholdRefusal'; this.reason = reason; this.retriable = true; }
}
export const refuseStock = reason => { throw new StockThresholdRefusal(reason); };
export async function collectStockObservation(symbol, baseATR, { fetcher = fetch, now = () => new Date() } = {}) {
  if (!/^[A-Z][A-Z0-9.-]*$/.test(symbol || '') || APPROVED_STOCK_POLICY.currentCatalogExceptions.unavailableForCorrectedAdmission.includes(symbol) || ['HES', 'IPG', 'WBA'].includes(symbol)) refuseStock('catalog_unavailable');
  const began = now().toISOString();
  const expected = expectedSessionAt(began);
  if (expected.status !== 'valid') refuseStock(expected.reason);
  if (Date.parse(began) < expected.closeMs + 15 * 60000) refuseStock('publication_window_not_open');
  const key = process.env.EODHD_API_KEY;
  if (!key) refuseStock('provider_not_configured');
  let from = expected.sourceSession;
  for (let i = 0; i < 14; i++) from = getPreviousSessionDate(from);
  if (!from) refuseStock('calendar_missing');
  const providerSymbol = `${symbol}.US`;
  const request = { provider: 'EODHD', endpoint: 'eod', providerSymbol, from, to: expected.sourceSession, period: 'd', order: 'a' };
  const get = async (path, params = {}) => {
    const url = new URL(`https://eodhd.com/api/${path}`);
    url.search = new URLSearchParams({ api_token: key, fmt: 'json', ...params }).toString();
    try {
      const response = await fetcher(url, { method: 'GET', signal: AbortSignal.timeout(10000) });
      if (!response.ok) refuseStock('provider_failure');
      return await response.json();
    } catch (err) { if (err instanceof StockThresholdRefusal) throw err; refuseStock('provider_failure'); }
  };
  const rows = await get(`eod/${providerSymbol}`, { from, to: expected.sourceSession, period: 'd', order: 'a' });
  const capturedAt = now().toISOString();
  const general = await get(`fundamentals/${providerSymbol}`, { filter: 'General' });
  if (general?.Code !== symbol || general.IsDelisted !== false || !['NYSE', 'NASDAQ'].includes(general.Exchange) || general.Type !== 'Common Stock' || !['US', 'USA'].includes(general.CountryISO) || typeof general.ISIN !== 'string' || !general.ISIN) refuseStock('security_identity_unqualified');
  const snapshot = { id: randomUUID(), providerSymbol, capturedAt, basis: 'raw_ohlc_adjusted_close', rows };
  // Deliberately omit finalization. Stage 1's arbitrary final=true is never
  // fabricated; approved runtime authority qualifies the valid arithmetic.
  const measurement = measureStock({ symbol, providerSymbol, expectedSourceSession: expected.sourceSession, asOf: capturedAt, snapshot });
  if (measurement.measurementArithmetic !== 'valid') refuseStock(measurement.reason || 'invalid_measurement');
  const quoteRaw = await get(`real-time/${providerSymbol}`);
  const observedAt = now().toISOString();
  const price = strictNumber(quoteRaw?.close);
  const timestamp = strictNumber(quoteRaw?.timestamp);
  if (!(price > 0) || !(timestamp > 0) || timestamp * 1000 > Date.parse(observedAt) || (quoteRaw.code !== providerSymbol && quoteRaw.code !== symbol)) refuseStock('invalid_original_quote');
  if (timestamp * 1000 < expected.closeMs) refuseStock('quote_precedes_completed_source_session');
  const validation = validateActivationPrice({ current: price, high: strictNumber(quoteRaw.high), low: strictNumber(quoteRaw.low), fallback: false, previousClose: strictNumber(quoteRaw.previousClose), recentClose: strictNumber(rows?.at(-1)?.close), baseATR });
  if (validation.fired || validation.value !== price) refuseStock('fill_validation_refused');
  const fillQuote = { provider: 'EODHD', source: 'real-time', price, quoteAsOf: new Date(timestamp * 1000).toISOString(), observedAt, validation: 'accepted_original_quote', raw: quoteRaw };
  const observation = { schemaVersion: 1, collectorId: STOCK_APPROVAL.collectorId, approvedPolicyRef: STOCK_APPROVAL.approvedPolicyRef, policyHash: STOCK_APPROVAL.policyHash, publicationRuleHash: STOCK_APPROVAL.publicationRuleHash, request, snapshot, snapshotHash: canonicalContentHash(snapshot), general, securityId: `EODHD:${providerSymbol}:${general.ISIN}`, measurement, fillQuote };
  collected.add(observation);
  observationDigests.set(observation, observationDigest(observation));
  return observation;
}
export function qualifyStockObservation(observation, at) {
  if (!isServerStockObservation(observation)) refuseStock('untrusted_collector');
  const expected = expectedSessionAt(at);
  if (expected.status !== 'valid') refuseStock(expected.reason);
  if (observation.measurement.sourceSession !== expected.sourceSession) refuseStock('source_session_changed');
  if (instant(observation.snapshot.capturedAt) < expected.closeMs + 15 * 60000 || instant(observation.snapshot.capturedAt) > instant(at)) refuseStock('invalid_publication_observation');
  if (observation.snapshotHash !== canonicalContentHash(observation.snapshot)) refuseStock('snapshot_hash_mismatch');
  if (observationDigests.get(observation) !== observationDigest(observation)) refuseStock('observation_content_changed');
  if (instant(observation.fillQuote.observedAt) > instant(at)) refuseStock('future_fill_observation');
  if (instant(observation.fillQuote.quoteAsOf) < expected.closeMs) refuseStock('quote_precedes_completed_source_session');
  return observation;
}
