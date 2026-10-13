#!/usr/bin/env node
// Provider GETs only. Local evidence output; no project or catalog writes.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readEnvironment, collectProviderSymbol } from './collect-threshold-export.js';
import { hashValue } from '../api/_utils/measuredStockThreshold.js';
import { PUBLICATION_RULE, PUBLICATION_RULE_HASH } from './threshold-publication-qualification.js';
import { STOCK_INDUSTRIES } from '../api/_utils/rankingConfig.js';
export async function collectIdentity(symbol, { key, fetcher = fetch, clock = () => new Date().toISOString() }) {
  const providerSymbol = symbol + '.US';
  const url = new URL(`https://eodhd.com/api/fundamentals/${providerSymbol}`);
  url.searchParams.set('api_token', key); url.searchParams.set('fmt', 'json'); url.searchParams.set('filter', 'General');
  try {
    const response = await fetcher(url, { method: 'GET', signal: AbortSignal.timeout(20000) });
    if (!response.ok) return { symbol, providerSymbol, status: 'unavailable', reason: `provider_http_${response.status}` };
    const general = await response.json();
    if (!general || typeof general.Code !== 'string' || typeof general.Name !== 'string') return { symbol, providerSymbol, status: 'unavailable', reason: 'provider_identity_shape' };
    // Known ticker reuse: the unchanged Media catalog predates Banzai's PARA adoption.
    const qualificationIssues = symbol === 'PARA' && STOCK_INDUSTRIES.PARA === 'Media' && /Banzai|Parabolic/i.test(general.Name) ? ['provider_identity_unresolved'] : [];
    return { symbol, providerSymbol, status: 'observed', capturedAt: clock(), endpoint: 'fundamentals/General', general, qualificationIssues };
  } catch { return { symbol, providerSymbol, status: 'unavailable', reason: 'provider_identity_transport' }; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), flags = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--input', '--env-file', '--out', '--aliases', '--qualification-out'].includes(args[i]) || !args[i + 1] || flags[args[i]]) throw new Error('arguments');
      flags[args[i]] = args[i + 1];
    }
    if (!flags['--input'] || !flags['--env-file'] || !flags['--out']) throw new Error('arguments');
    const exported = JSON.parse(fs.readFileSync(flags['--input'], 'utf8'));
    const env = readEnvironment(flags['--env-file']);
    const key = env.EODHD_API_KEY || process.env.EODHD_API_KEY;
    if (!key) throw new Error('configuration');
    const aliases = flags['--aliases']?.split(',') || [];
    const symbols = [...new Set([...exported.universe.filter(r => r.eligible).map(r => r.symbol), ...aliases])];
    if (symbols.some(s => !/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(s))) throw new Error('arguments');
    const startedAt = new Date().toISOString(), identities = [];
    for (let i = 0; i < symbols.length; i += 8) identities.push(...await Promise.all(symbols.slice(i, i + 8).map(symbol => collectIdentity(symbol, { key }))));
    const aliasSnapshots = [];
    for (const symbol of aliases) aliasSnapshots.push({ symbol, ...await collectProviderSymbol(symbol, { key, expectedSession: exported.expectedSession }) });
    const result = { schemaVersion: 1, startedAt, endedAt: new Date().toISOString(), expectedSession: exported.expectedSession, universeId: exported.universeId, identities, aliasSnapshots, productionMappingsChanged: false };
    fs.mkdirSync(path.dirname(path.resolve(flags['--out'])), { recursive: true });
    fs.writeFileSync(flags['--out'], JSON.stringify(result, null, 2) + '\n');
    if (flags['--qualification-out']) {
      const qualification = { schemaVersion: 1, observedAt: result.endedAt, exportHash: hashValue(exported), ruleId: PUBLICATION_RULE.id, ruleHash: PUBLICATION_RULE_HASH, identities, identityCaptureHash: hashValue(result), authority: 'local_closeout_analysis_owner_policy_approval_pending' };
      fs.mkdirSync(path.dirname(path.resolve(flags['--qualification-out'])), { recursive: true });
      fs.writeFileSync(flags['--qualification-out'], JSON.stringify(qualification, null, 2) + '\n');
    }
    console.log(JSON.stringify({ total: identities.length, observed: identities.filter(r => r.status === 'observed').length, aliasSnapshots: aliasSnapshots.length, out: flags['--out'] }));
  } catch { console.error('identity_collection_failed_arguments_configuration_or_local_io'); process.exitCode = 1; }
}
