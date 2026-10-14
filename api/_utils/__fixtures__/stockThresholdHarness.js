import { collectStockObservation } from '../stockThresholdMeasurementProvider.js';
import { getPreviousSessionDate } from '../../../src/utils/marketCalendar.js';
import { bindStockReceipt } from '../stockThresholdAdmission.js';
import { canonicalContentHash } from '../canonicalHash.js';
import { STOCK_MODEL, initialRewardHistory } from '../../../src/utils/stockThresholdModel.js';
export const STOCK_TEST_NOW = '2026-10-14T14:02:00.000Z';
export const stockTestClock = () => new Date(STOCK_TEST_NOW);
export function stockRows(session = '2026-10-13') {
  const dates = [session];
  for (let i = 0; i < 14; i++) dates.unshift(getPreviousSessionDate(dates[0]));
  return dates.map(date => ({ date, open: 100, high: 101, low: 99, close: 100, adjusted_close: 100, volume: 10000 }));
}
export async function stockObservation(symbol = 'AAPL', { price = 103.27, rows = stockRows(), clock = stockTestClock, changeResponse = x => x } = {}) {
  return collectStockObservation(symbol, 2.5, { now: clock, fetcher: async url => {
    const path = url.pathname;
    const value = path.includes('/eod/') ? rows : path.includes('/fundamentals/') ? { Code: symbol, CountryISO: 'US', Type: 'Common Stock', Exchange: 'NASDAQ', IsDelisted: false, ISIN: `US-${symbol}` } : { code: `${symbol}.US`, close: price, high: Math.max(200, price * 2), low: Math.min(1, price / 2), previousClose: 100, timestamp: Date.parse(clock().toISOString()) / 1000 };
    return { ok: true, json: async () => structuredClone(changeResponse(value, url)) };
  } });
}
export async function correctedStockBattle({ fill = 103.27, cpuFill = fill, cpuSymbol = 'AAPL', scoringPct = null } = {}) {
  const agentObs = await stockObservation('AAPL', { price: fill }), cpuObs = await stockObservation(cpuSymbol, { price: cpuFill });
  const battle = { id: 'stock-battle', agentId: 'agent', ownerId: 'owner', gameMode: 'baggerbomb_agent', duration: 'fullday', status: 'active', activatedAt: STOCK_TEST_NOW,
    portfolio: { star: [{ symbol: 'AAPL', baseATR: 2.5 }], core: [], support: [], bench: { stocks: [{ symbol: 'MSFT', baseATR: 3 }], crypto: null }, startingPrices: { AAPL: fill } },
    opponent: { portfolio: { star: [{ symbol: cpuSymbol, baseATR: 2.5 }], core: [], support: [] } },
    scoring: { stockThresholdModel: { ...STOCK_MODEL, admittedAt: STOCK_TEST_NOW }, stockRosterVersion: 1, stockScoreVersion: 0, thresholds: {}, stockRewardHistory: { agent: {}, cpu: {} }, stockRiskHistory: { agent: {}, cpu: {} }, stockScoreComponents: {} }, thresholdHistory: {}, trades: [], scoreState: { tradeCount: 0, dailyScores: {} } };
  const inputs = {};
  for (const [side, observation] of [['agent', agentObs], ['cpu', cpuObs]]) {
    const asset = (side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0];
    const r = bindStockReceipt(observation, { battleId: battle.id, side, tier: 'star', slot: 0, positionId: `position-${side}`, slotVersion: 1, enteredAt: STOCK_TEST_NOW });
    // Pure-boundary fixtures may override only their effective test percentage;
    // they are never used by an input-validation writer test.
    if (scoringPct !== null) { r.scoringPct = scoringPct; r.scoringPctDecimal = scoringPct.toFixed(6); }
    Object.assign(asset, { positionId: r.positionId, slotVersion: 1, stockThresholdReceipt: r, swapPrice: r.fill, swappedInAt: STOCK_TEST_NOW });
    battle.scoring.stockRewardHistory[side][r.positionId] = initialRewardHistory(r);
    battle.scoring.stockRiskHistory[side][r.positionId] = { positionId: r.positionId, maxMultiplier: 0, minMultiplier: 0 };
    const raw = JSON.parse(JSON.stringify(observation));
    inputs[r.inputRef] = { ...raw, observationHash: canonicalContentHash(raw), attestation: { ...STOCK_MODEL, collectorId: 'eodhd_stock_server_collector_v1', observedAt: r.snapshotCapturedAt } };
  }
  return { battle, inputs };
}
export function stockWriterDb(initial, { beforeCommit = null } = {}) {
  const store = new Map(Object.entries(initial).map(([p, d]) => [p, structuredClone(d)]));
  const versions = new Map(), writes = [], reads = [];
  let auto = 0, attempts = 0;
  const snapshot = p => ({ exists: store.has(p), id: p.split('/').at(-1), data: () => structuredClone(store.get(p)) });
  const apply = (doc, patch) => { for (const [path, v] of Object.entries(patch)) { const keys = path.split('.'); let d = doc; for (const k of keys.slice(0, -1)) d = d[k] ||= {}; d[keys.at(-1)] = structuredClone(v); } };
  const ref = path => ({ path, id: path.split('/').at(-1), get: async () => snapshot(path), update: async patch => { apply(store.get(path), patch); versions.set(path, (versions.get(path) || 0) + 1); writes.push(['update', path, patch]); } });
  const db = { doc: ref, collection: name => ({ doc: id => ref(`${name}/${id ?? `auto-${++auto}`}`), add: async doc => { const r = ref(`${name}/auto-${++auto}`); store.set(r.path, structuredClone(doc)); writes.push(['add', r.path, doc]); return r; } }), runTransaction: async fn => {
    for (let attempt = 0; attempt < 6; attempt++) {
      attempts++; const seen = new Map(), buffered = []; let wrote = false;
      const tx = { get: async r => { if (wrote) throw Error('read after write'); reads.push(r.path); seen.set(r.path, versions.get(r.path) || 0); return snapshot(r.path); },
        create: (r, doc) => { wrote = true; if (store.has(r.path)) throw Error('already exists'); buffered.push(['create', r.path, structuredClone(doc)]); },
        update: (r, patch) => { wrote = true; buffered.push(['update', r.path, structuredClone(patch)]); } };
      const result = await fn(tx);
      await beforeCommit?.({ attempt, store, versions, buffered });
      if ([...seen].some(([p, v]) => (versions.get(p) || 0) !== v)) continue;
      for (const [kind, p, data] of buffered) { if (kind === 'create') store.set(p, data); else apply(store.get(p), data); versions.set(p, (versions.get(p) || 0) + 1); writes.push([kind, p, data]); }
      return result;
    }
    throw Error('contention exhausted');
  } };
  return { db, store, writes, reads, versions, attempts: () => attempts };
}
