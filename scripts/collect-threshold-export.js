#!/usr/bin/env node
// READ ONLY: Firestore get/select and provider GET. Writes a LOCAL export only.
// Credentials are read locally and never logged, serialized, or placed in output URLs.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ALL_TICKERS } from '../api/_utils/rankingConfig.js';
import { expectedSessionAt, hashValue } from '../api/_utils/measuredStockThreshold.js';
export function readEnvironment(file) {
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) { const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, ''); }
  return values;
}
const iso = value => value?.toDate?.().toISOString() ?? null;
export function projectStoredBattle(docId, battle) {
  const rows = [];
  for (const [side, portfolio] of [['agent', battle.portfolio], ['cpu', battle.opponent?.portfolio]]) {
    for (const tier of ['star', 'core', 'support']) for (const [slot, asset] of (portfolio?.[tier] || []).entries()) {
      if (!asset || asset.isCrypto || asset.isCash) continue;
      const common = { symbol: asset.symbol, mode: 'agent_battle', side, battleId: docId, tier, slot, positionId: asset.positionId ?? null, entryPrice: asset.swapPrice ?? portfolio.startingPrices?.[asset.symbol] ?? battle.portfolio?.startingPrices?.[asset.symbol] ?? null, entryAt: asset.swappedInAt ?? battle.activatedAt ?? battle.createdAt ?? null, entryQuoteAsOf: null };
      rows.push({ ...common, kind: 'legacy_frozen_threshold', valuePct: asset.baseATR ?? null, source: 'held_asset.baseATR', sourceSession: null });
      rows.push({ ...common, kind: 'symbol_projection', valuePct: battle.scoring?.thresholds?.[asset.symbol]?.threshold ?? null, source: 'scoring.thresholds', history: battle.thresholdHistory?.[asset.symbol] ?? null });
    }
  }
  return rows;
}
export async function collectProviderSymbol(symbol, { key, expectedSession, fetcher = fetch, clock = () => new Date().toISOString() }) {
  const providerSymbol = symbol + '.US';
  const from = new Date(Date.parse(expectedSession + 'T12:00:00Z') - 90 * 86400000).toISOString().slice(0, 10);
  const get = async endpoint => {
    const url = new URL(`https://eodhd.com/api/${endpoint}/${providerSymbol}`);
    for (const [name, value] of Object.entries({ from, to: expectedSession, fmt: 'json', api_token: key })) url.searchParams.set(name, value);
    const response = await fetcher(url, { method: 'GET', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`provider_${endpoint}_http_${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error(`provider_${endpoint}_shape`);
    return { data, observedAt: clock(), endpoint, from, through: expectedSession };
  };
  const replies = await Promise.allSettled(['eod', 'splits', 'div'].map(get));
  if (replies[0].status !== 'fulfilled') {
    const message = String(replies[0].reason?.message || '');
    const reason = /^provider_eod_(?:http_\d+|shape)$/.test(message) ? message : 'provider_eod_transport_unavailable';
    return { providerSymbol, collectionError: reason };
  }
  const eod = replies[0].value;
  const snapshot = { id: hashValue({ providerSymbol, capturedAt: eod.observedAt, rows: eod.data }), providerSymbol, capturedAt: eod.observedAt, basis: 'raw_ohlc_adjusted_close', rows: eod.data, provenance: { type: 'provider_capture', provider: 'EODHD', endpoint: 'eod', from, through: expectedSession } };
  const action = index => replies[index].status === 'fulfilled' ? replies[index].value : { status: 'unavailable', reason: 'provider_action_endpoint_unavailable' };
  // Observing a dated row is not an undocumented finalization guarantee.
  return { providerSymbol, snapshot, finalization: { type: 'provider_response_observation', session: expectedSession, final: null, observedAt: eod.observedAt, source: 'EODHD eod response; no explicit provider final flag' }, corporateActionEvidence: { splits: action(1), dividends: action(2) } };
}
export async function collectExport({ project, envFile, dependencies, out, symbols = null }) {
  const env = readEnvironment(envFile);
  const credentials = JSON.parse(env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS || '{}');
  if (!project || credentials.project_id !== project || env.VITE_FIREBASE_PROJECT_ID !== project) throw new Error('project_identity_mismatch');
  const key = env.EODHD_API_KEY || process.env.EODHD_API_KEY;
  if (!key) throw new Error('eodhd_key_missing');
  const { initializeApp, cert, deleteApp } = await import(pathToFileURL(path.join(dependencies, 'firebase-admin/lib/app/index.js')).href);
  const { initializeFirestore } = await import(pathToFileURL(path.join(dependencies, 'firebase-admin/lib/firestore/index.js')).href);
  const app = initializeApp({ credential: cert(credentials), projectId: project }, 'threshold-stage1-readonly');
  const db = initializeFirestore(app, { preferRest: true });
  let deadline;
  try {
    const [rankings, battles] = await Promise.race([Promise.all([
      db.collection('indexIntelligence').doc('stockRankings').get(),
      db.collection('agentBattles').where('status', '==', 'active').select('portfolio', 'opponent', 'scoring', 'thresholdHistory', 'timing', 'activatedAt', 'createdAt').get(),
    ]), new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('read_deadline_exceeded')), 25000); })]);
    clearTimeout(deadline);
    const stocks = rankings.data()?.stocks;
    if (!rankings.exists || !Array.isArray(stocks) || !stocks.length) throw new Error('rankings_unavailable');
    const startedAt = new Date().toISOString();
    const expected = expectedSessionAt(startedAt);
    if (expected.status !== 'valid') throw new Error('calendar_missing');
    const ranked = new Map(stocks.map(stock => [stock.symbol, stock]));
    const stored = battles.docs.flatMap(doc => projectStoredBattle(doc.id, doc.data()));
    const universeSymbols = [...new Set([...ALL_TICKERS, ...ranked.keys()])];
    if (symbols && symbols.some(symbol => !universeSymbols.includes(symbol))) throw new Error('requested_symbol_not_in_exported_universe');
    const order = s => { const i = ['UNP', 'HUM', 'ACN'].indexOf(s); return i < 0 ? 3 : i; };
    universeSymbols.sort((a, b) => order(a) - order(b) || a.localeCompare(b));
    const universe = [];
    for (const symbol of universeSymbols) {
      const stock = ranked.get(symbol);
      if (!stock || (symbols && !symbols.includes(symbol))) { universe.push({ symbol, eligible: false, exclusionReason: !stock ? 'not_in_exported_rankings' : 'outside_explicit_collection_subset' }); continue; }
      const observed = await collectProviderSymbol(symbol, { key, expectedSession: expected.sourceSession });
      universe.push({ symbol, eligible: true, ranking: { atrPercentile: stock.atrPercentile ?? null, techRaw: stock.techRaw ?? null }, ...observed, stored: stored.filter(row => row.symbol === symbol) });
      console.log(JSON.stringify({ symbol, collection: observed.snapshot ? 'captured' : 'unavailable' }));
    }
    const exportedAt = new Date().toISOString();
    if (expectedSessionAt(exportedAt).sourceSession !== expected.sourceSession) throw new Error('session_changed_during_collection');
    const result = { schemaVersion: 1, exportedAt, environment: project, deployedCommit: null, universeId: hashValue({ document: 'indexIntelligence/stockRankings', updateTime: iso(rankings.updateTime), stocks }), expectedSession: expected.sourceSession, universeDefinition: 'union of configured stocks and exported ranked membership; eligible means ranked membership within any explicit subset, not production admission certification', collection: { startedAt, rankingsReadTime: iso(rankings.readTime), rankingsUpdateTime: iso(rankings.updateTime), rankingsUpdatedAt: iso(rankings.data()?.updatedAt), activeAgentBattleCount: battles.size, activeAgentBattlesReadTime: iso(battles.readTime), scope: symbols ? 'explicit_subset' : 'full_exported_universe', requestedSymbols: symbols, otherModeStoredValues: 'not_collected', providerFinalization: 'unqualified_no_explicit_final_flag' }, universe };
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ project, expectedSession: expected.sourceSession, exportedUniverse: universe.length, collected: universe.filter(r => r.eligible).length, out }));
    return result;
  } finally { clearTimeout(deadline); await db.terminate(); await deleteApp(app); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const allowed = new Set(['--project', '--env-file', '--dependencies', '--out', '--symbols']);
  const flags = {};
  try {
    for (let i = 0; i < args.length; i += 2) { if (!allowed.has(args[i]) || !args[i + 1] || flags[args[i]]) throw new Error('invalid_arguments'); flags[args[i]] = args[i + 1]; }
    if (!['--project', '--env-file', '--dependencies', '--out'].every(k => flags[k])) throw new Error('missing_arguments');
    await collectExport({ project: flags['--project'], envFile: flags['--env-file'], dependencies: flags['--dependencies'], out: flags['--out'], symbols: flags['--symbols'] ? flags['--symbols'].split(',') : null });
  } catch (error) { console.error(JSON.stringify({ status: 'collection_failed', code: typeof error.code === 'number' ? error.code : error.message === 'read_deadline_exceeded' ? 'read_deadline_exceeded' : 'read_or_configuration_error' })); process.exitCode = 1; }
}
