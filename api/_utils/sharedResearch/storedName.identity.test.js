// api/_utils/sharedResearch/storedName.identity.test.js
//
// Company names, Build 3a (build prompt section 2, point 4): THE EFFECT OF THE STORED NAME, proved before anything is
// fixed. Work an idea decides which company a fact is about by comparing the name the partner wrote with the company's
// stored name, peerRankings/{symbol}.name, which the route reads with readNames (store.js). The rankings job has always
// stored the ticker there, so "NVIDIA" never matches NVDA's stored "NVDA": the fact loses its company, the company
// stays an unresolved lead, and it can never be supported or reach the thesis card.
//
// Each row runs the real path: a peerRankings document in the in-memory store, the real readNames, the real step
// validator (validateStepTurn) and the real companiesOf. Only the stored name differs between the rows of a pair.
// These rows pass before and after the fix; they document what the stored name decides. The last describe, added
// with the fix (build prompt section 3), runs the rankings job's own fundamentals path into this one: it failed on
// the unfixed code, where the stored name was always the ticker.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real, unmocked imports below are the runtime guard for these
// modules' graphs. Never mock them.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStepTurn } from './stepSchema.js';
import { companiesOf } from './companies.js';
import { readNames } from './store.js';
import { makeInMemoryDb } from '../__fixtures__/inMemoryFirestore.js';
import { dataCenterRecord } from './__fixtures__/records.js';
import { fetchSingleFundamental, extractMetrics } from '../../cron/compute-rankings.js';

const READ = '2026-11-27T15:00:00.000Z';
const NOW = '2026-11-27T15:00:05.000Z';
const PARTNER = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';
const ITEMS = [{ index: 0, url: 'https://n.example/gpu-orders', title: 'GPU orders', host: 'n.example', publishedDate: '2026-11-20T00:00:00.000Z' }];
let n = 0;
const ctx = (names) => ({
  record: dataCenterRecord('refresh'), items: ITEMS, readAt: READ, partnerExchangeId: PARTNER, partnerAt: NOW, nowIso: NOW,
  mintFindingId: () => `f_73000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, names,
});
const finding = (over = {}) => ({
  tempId: 't1', kind: 'relationship', fact: 'NVIDIA supplies the chips for the data-center build-out.', symbolCandidate: 'NVDA', companyName: 'NVIDIA',
  support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null, ...over,
});
const turn = (over = {}) => ({
  reply: 'NVIDIA supplies the chips for the data-center build-out.', findings: [finding()], summary: null,
  lines: { support: 't1', complication: null, missing: null }, nextAction: { label: 'Check how much of the build-out is chips', purpose: 'The share is the weakest link.' },
  companies: [{ companyName: 'NVIDIA', symbolCandidate: 'NVDA', role: 'Supplier', relationshipRef: 't1', openRef: null, claim: null }],
  ...over,
});

/** The names the route hands the validator: read by the real readNames from a stored peerRankings document. */
async function namesFromStore(symbol, storedName) {
  const { db } = makeInMemoryDb({ [`peerRankings/${symbol}`]: { ticker: symbol, name: storedName } });
  return readNames(db, [symbol]);
}
/** The record after the step's findings are appended, as companiesOf reads it. */
const recordWith = (findings) => ({ ...dataCenterRecord('refresh'), findings: [...dataCenterRecord('refresh').findings, ...findings] });
/** The leads this step's findings make (the fixture record has leads of its own). */
const leadsFrom = (leads, findings) => leads.filter((l) => l.findingIds.some((id) => findings.some((f) => f.findingId === id)));

describe('a fact naming "NVIDIA" with the symbol candidate NVDA, through the real step validator', () => {
  it('keeps NVDA when the stored name is "NVIDIA Corporation": a verified relationship, and NVIDIA is a supported company', async () => {
    const names = await namesFromStore('NVDA', 'NVIDIA Corporation');
    expect(names).toEqual({ NVDA: 'NVIDIA Corporation' });
    const out = validateStepTurn(turn(), ctx(names));
    expect(out.ok).toBe(true);
    expect(out.findings[0]).toMatchObject({ kind: 'relationship', symbol: 'NVDA', status: 'verified' });
    expect(out.notes.filter((x) => x.startsWith('identity_'))).toEqual([]);
    const { supported, leads } = companiesOf(recordWith(out.findings), { names });
    expect(supported.map((c) => [c.symbol, c.name])).toEqual([['NVDA', 'NVIDIA Corporation']]);
    expect(leadsFrom(leads, out.findings)).toEqual([]);
  });
  it('loses NVDA when the stored name is "NVDA" (identity_mismatch): the fact keeps no symbol, NVIDIA is only an unresolved lead', async () => {
    const names = await namesFromStore('NVDA', 'NVDA');
    expect(names).toEqual({ NVDA: 'NVDA' });
    const out = validateStepTurn(turn(), ctx(names));
    expect(out.ok).toBe(true);
    expect(out.findings[0]).toMatchObject({ kind: 'relationship', symbol: null });
    expect(out.notes).toContain('identity_mismatch:NVDA');
    const { supported, leads } = companiesOf(recordWith(out.findings), { names });
    expect(supported).toEqual([]);
    const mine = leadsFrom(leads, out.findings);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ symbol: null, unresolved: 'identity_unresolved' });
  });
});

describe('a fact that names no company keeps the symbol only when the fact names it (identity_unnamed)', () => {
  const unnamed = turn({
    findings: [finding({ kind: 'coverage', fact: 'Microsoft said Azure grew.', symbolCandidate: 'MSFT', companyName: null })],
    reply: 'Microsoft said Azure grew.', lines: { support: null, complication: null, missing: null }, companies: [],
  });
  it('"Microsoft said Azure grew" keeps MSFT when the stored name is "Microsoft Corporation"', async () => {
    const out = validateStepTurn(unnamed, ctx(await namesFromStore('MSFT', 'Microsoft Corporation')));
    expect(out.ok).toBe(true);
    expect(out.findings[0].symbol).toBe('MSFT');
    expect(out.notes.filter((x) => x.startsWith('identity_'))).toEqual([]);
  });
  it('and loses it when the stored name is "MSFT"', async () => {
    const out = validateStepTurn(unnamed, ctx(await namesFromStore('MSFT', 'MSFT')));
    expect(out.ok).toBe(true);
    expect(out.findings[0].symbol).toBeNull();
    expect(out.notes).toContain('identity_unnamed:MSFT');
  });
});

describe('why it passed unnoticed: a company whose common name is its ticker matches either way', () => {
  it.each([['AMD', 'Advanced Micro Devices, Inc.'], ['AMD', 'AMD']])('"AMD" keeps AMD when the stored name is %s / %s', async (symbol, storedName) => {
    const out = validateStepTurn(turn({
      findings: [finding({ fact: 'AMD supplies the chips for the data-center build-out.', symbolCandidate: 'AMD', companyName: 'AMD' })],
      reply: 'AMD supplies the chips for the data-center build-out.',
      companies: [{ companyName: 'AMD', symbolCandidate: 'AMD', role: 'Supplier', relationshipRef: 't1', openRef: null, claim: null }],
    }), ctx(await namesFromStore(symbol, storedName)));
    expect(out.ok).toBe(true);
    expect(out.findings[0].symbol).toBe('AMD');
  });
});

describe('the fix: the name the rankings job stores now carries the company, so the fact keeps it (build prompt section 3)', () => {
  // Read with LF line ends: a Windows checkout may hold CRLF.
  const RANKINGS_SRC = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'cron', 'compute-rankings.js'), 'utf8')
    .split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
  it('the rankings job stores its shaped name, else the ticker, in peerRankings/{symbol}.name and in every leaderboard row', () => {
    const LF = String.fromCharCode(10);
    expect(RANKINGS_SRC).toContain(`${LF}      name: stock.metrics?.name || stock.ticker,${LF}`);
    expect(RANKINGS_SRC).toContain(`${LF}    name: s.metrics.name || s.ticker,${LF}`);
  });
  it('a response carrying the top-level "General::Name" key: the stored name is "NVIDIA Corporation" and the NVIDIA fact keeps NVDA', async () => {
    const realFetch = globalThis.fetch;
    const realLog = console.log;
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ Highlights: {}, 'General::Name': 'NVIDIA Corporation' }) });
    console.log = () => {};
    let metrics;
    try {
      metrics = extractMetrics('NVDA', await fetchSingleFundamental('NVDA', 'TESTKEY'));
    } finally {
      globalThis.fetch = realFetch;
      console.log = realLog;
    }
    const stored = metrics?.name || 'NVDA'; // the expression the job stores, pinned by the row above
    expect(stored).toBe('NVIDIA Corporation');
    const out = validateStepTurn(turn(), ctx(await namesFromStore('NVDA', stored)));
    expect(out.findings[0]).toMatchObject({ kind: 'relationship', symbol: 'NVDA', status: 'verified' });
    expect(out.notes.filter((x) => x.startsWith('identity_'))).toEqual([]);
  });
});
