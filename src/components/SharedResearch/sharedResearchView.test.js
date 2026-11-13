// Shared Research B2 — the pure view helpers (sharedResearchView.js). The one mirror
// of server logic, the stray-name check, is pinned to the server's namesCompany and
// its generic-word list (api/_utils/sharedResearch/companies.js) by a parity table:
// the server stays authoritative; the client only blocks Save where both agree.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  namesCompanyView, coreNameView, GENERIC_NAME_WORDS, STATEMENT_MAX, labelOf, dateLineOf, splitNext, quotaStateOf, staleStoriesAt,
  draftOf, strayNamesOf, linesOf, isUndated, sourceLabelOf, safeUrlOf, stateOf, carriedByCompanyOf, adoptableOf,
} from './sharedResearchView';
import { namesCompany, coreNameOf } from '../../../api/_utils/sharedResearch/companies.js';
import { findingLabelOf } from '../../constants/sharedResearch';
import { STATEMENT_MAX_LEN } from '../../../api/_utils/hypothesisRecords/model.js';
import answers from './__fixtures__/answers.json';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('the stray-name mirror equals the server\'s check (K-7: the server is authoritative)', () => {
  const COMPANIES = [
    { symbol: 'SHOP', name: 'Shopify Inc.' }, { symbol: 'AAPL', name: 'Apple Inc.' }, { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.' }, { symbol: 'KO', name: 'The Coca-Cola Company' }, { symbol: 'DIS', name: 'The Walt Disney Company' },
    { symbol: 'META', name: 'Meta Platforms, Inc.' }, { symbol: 'C', name: 'Citigroup Inc.' }, { symbol: 'ETN', name: 'Eaton Corporation plc' },
    { symbol: 'GEV', name: 'GE Vernova Inc.' }, { symbol: 'V', name: 'Visa Inc. Class A' },
  ];
  const TEXTS = [
    'Shopify earns from Shop Pay.', 'Apple Pay competes.', 'AAPL is named.', 'Amazon sells it.', 'JPMorgan Chase lends.', 'Coca-Cola bottles.',
    'Disney parks.', 'Meta ads.', 'Platforms are everywhere.', 'Series C funding.', 'Eaton supplies switchgear.', 'GE Vernova turbines.',
    'Visa processes cards.', 'A visa to travel.', 'The company grew.', 'shopify in lower case', 'Shopify’s Shop Pay', 'KO', 'no names here',
  ];
  it('namesCompanyView(text, company) === namesCompany(text, company) on every pair', () => {
    for (const c of COMPANIES) for (const t of TEXTS) expect(namesCompanyView(t, c), `${c.symbol} / ${t}`).toBe(namesCompany(t, c));
  });
  it('coreNameView === coreNameOf', () => {
    for (const c of COMPANIES) expect(coreNameView(c.name)).toBe(coreNameOf(c.name));
  });
  it('the generic-word list is the server\'s, word for word', () => {
    const src = readFileSync(resolve(HERE, '../../../api/_utils/sharedResearch/companies.js'), 'utf8');
    const block = /const GENERIC_NAME_WORDS = new Set\(\[([\s\S]*?)\]\);/.exec(src)[1];
    expect([...block.matchAll(/'([a-z]+)'/g)].map((m) => m[1])).toEqual([...GENERIC_NAME_WORDS]);
  });
});

describe('labels and dates come from the server\'s fields only (BUILD_RULES §9; K-6 g, h)', () => {
  const findings = answers.getStepped.body.record.findings;
  it('labelOf is findingLabelOf, the one shared table', () => {
    for (const f of [...findings, ...answers.openDrop.body.record.findings, ...answers.openStory.body.record.findings]) expect(labelOf(f)).toBe(findingLabelOf(f));
  });
  it('an undated fact: "undated", dated by the read; its label without the marker', () => {
    const u = findings.find(isUndated);
    expect(dateLineOf(u)).toEqual({ kind: 'undated', text: 'Nov 12, 2026', published: null });
    expect(sourceLabelOf(u).endsWith(' · undated')).toBe(false);
  });
  it('a dated Source-backed fact: its own date and the published date', () => {
    const d = findings.find((f) => f.status === 'verified' && f.asOf && !isUndated(f));
    expect(dateLineOf(d).kind).toBe('dated');
    expect(dateLineOf(d).published).toMatch(/2026/);
  });
  it('an inference carries no date line (its `at` is when it was said, not a fact\'s date)', () => {
    expect(dateLineOf(findings.find((f) => f.kind === 'inference'))).toBeNull();
  });
  it('only http(s) source links are opened', () => {
    expect(safeUrlOf({ source: { url: 'https://example.com/a' } })).toBe('https://example.com/a');
    expect(safeUrlOf({ source: { url: 'javascript:alert(1)' } })).toBeNull();
    expect(safeUrlOf({ source: {} })).toBeNull();
  });
});

describe('the rest of the view', () => {
  it('splitNext: "label — purpose"; a fact without the dash is all label', () => {
    expect(splitNext('Find the filing — it is the weakest link')).toEqual({ label: 'Find the filing', purpose: 'it is the weakest link' });
    expect(splitNext('Find the primary source behind your drop.')).toEqual({ label: 'Find the primary source behind your drop.', purpose: null });
  });
  it('quotaStateOf: a ceiling reached, from the quota numbers', () => {
    expect(quotaStateOf(answers.listDailyLimit.body.quota)).toEqual({ dailyLimit: true, framingLimit: false, stepLimit: false });
    expect(quotaStateOf(answers.listFramingLimit.body.quota).framingLimit).toBe(true);
    expect(quotaStateOf(answers.listStepLimit.body.quota).stepLimit).toBe(true);
    expect(quotaStateOf(null)).toEqual({ dailyLimit: false, framingLimit: false, stepLimit: false });
  });
  it('staleStoriesAt: only when every story is older than 48 h', () => {
    const s = [{ publishedAt: '2026-11-11T13:30:00.000Z' }, { publishedAt: '2026-11-10T13:30:00.000Z' }];
    expect(staleStoriesAt(s, Date.parse('2026-11-12T13:00:00.000Z'))).toBeNull();
    expect(staleStoriesAt(s, Date.parse('2026-11-14T13:31:00.000Z'))).toBe('2026-11-11T13:30:00.000Z');
    expect(staleStoriesAt([], Date.now())).toBeNull();
  });
  it('draftOf: the picked fragments in the preview\'s order; strayNamesOf: a deselected company still named', () => {
    const p = answers.getShopPay.body.adoptPreview;
    expect(draftOf(p, p.companies.map((c) => c.symbol))).toBe(p.draft);
    const shop = p.companies.find((c) => c.symbol === 'SHOP');
    expect(draftOf(p, ['SHOP'])).toBe(shop.fragment);
    expect(strayNamesOf(`${shop.fragment} Apple Pay too.`, p, ['SHOP'])).toEqual(['Apple Inc.']);
    expect(strayNamesOf(shop.fragment, p, ['SHOP'])).toEqual([]);
  });
  it('carriedByCompanyOf: the server\'s per-company lists, as sent — never merged', () => {
    const p = answers.getShopPay.body.adoptPreview;
    const out = carriedByCompanyOf(p, ['AAPL', 'SHOP']);
    expect(out.map((c) => c.carried)).toEqual(p.companies.filter((c) => ['AAPL', 'SHOP'].includes(c.symbol)).map((c) => c.carried));
    expect(adoptableOf(p).every((c) => c.adoptable)).toBe(true);
  });
  it('the statement limit is the record model\'s', () => {
    expect(STATEMENT_MAX).toBe(STATEMENT_MAX_LEN);
  });
  it('linesOf resolves the refs to the findings they name, current or superseded', () => {
    const r = answers.getShopPay.body.record;
    const l = linesOf(r);
    expect(l.support.findingId).toBe(r.lines.support);
    expect(l.missing.findingId).toBe(r.lines.missing); // p5, since superseded by p5r: still named, read from `superseded`
  });
  it('stateOf: open, saved, concluded', () => {
    expect(stateOf(answers.getStepped.body.session, answers.getStepped.body.record)).toBe('open');
    expect(stateOf(answers.getShopPaySaved.body.session, answers.getShopPaySaved.body.record)).toBe('saved');
    expect(stateOf(answers.getConcluded.body.session, answers.getConcluded.body.record)).toBe('completed');
  });
});
