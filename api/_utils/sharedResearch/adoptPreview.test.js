// api/_utils/sharedResearch/adoptPreview.test.js
//
// Shared Research B1 — the adoption preview and its assertion check (spec §6.6,
// §9 Correction C). The prototype carried a static list: it dropped the 62%
// source and kept the corrected ids. Here the carried set is built from the
// exact selected names' current findings.

import { describe, it, expect } from 'vitest';
import {
  adoptPreviewOf, carriedFor, assertAssertionsSupported, AssertionError, previewRevOf, sameRev, isPreviewRev, coreNameOf, namesCompany, currentIdOf,
} from './adoptPreview.js';
import { companiesOf } from './companies.js';
import { shopPayRecord, SP_LINES, SP_NAMES, fid } from './__fixtures__/records.js';

const record = shopPayRecord();
const companies = companiesOf(record, { names: SP_NAMES });
const shop = companies.supported.find((c) => c.symbol === 'SHOP');
const apple = companies.supported.find((c) => c.symbol === 'AAPL');
const refusal = (fn) => { try { fn(); return null; } catch (e) { return e instanceof AssertionError ? { code: e.code, detail: e.detail } : e; } };

describe('Correction C — the carried set', () => {
  it("the draft's 62% sentence carries p3, the 62% source", () => {
    const preview = adoptPreviewOf(record, { companies, lines: SP_LINES });
    const s = preview.companies.find((c) => c.symbol === 'SHOP');
    expect(s.fragment).toContain('62%');
    expect(s.carried).toContain(fid('p3'));
  });

  it('p2r and p5r replace p2 and p5; the corrected ids never travel', () => {
    const carried = carriedFor(record, { supported: companies.supported, lines: SP_LINES, symbols: ['SHOP'] });
    expect(carried).toEqual([fid('ic'), fid('p1'), fid('p3'), fid('p2r'), fid('p5r'), fid('p4')]);
    expect(carried).not.toContain(fid('p2'));
    expect(carried).not.toContain(fid('p5'));
  });

  it('the missing-link line named p5 before its correction: it resolves forward to p5r', () => {
    expect(currentIdOf(record, fid('p5'))).toBe(fid('p5r'));
    expect(currentIdOf(record, fid('p3'))).toBe(fid('p3'));
  });

  it('a selection carries only its own names: Apple alone does not carry Shopify\'s figures', () => {
    const carried = carriedFor(record, { supported: companies.supported, lines: SP_LINES, symbols: ['AAPL'] });
    expect(carried).toEqual([fid('a1'), fid('p4'), fid('p5r')]);
  });

  it('the preview revision (spec §16 FQ-7) is an opaque token over summary.rev, findings.length and each company\'s carried ids', () => {
    const rev = previewRevOf(record, { companies, lines: SP_LINES });
    expect(rev).toMatch(/^pr1\.[0-9a-f]{32}$/);
    expect(isPreviewRev(rev)).toBe(true);
    expect(previewRevOf(record, { companies, lines: { ...SP_LINES } })).toBe(rev);
    expect(adoptPreviewOf(record, { companies, lines: SP_LINES }).previewRev).toBe(rev);
    expect(sameRev(rev, rev)).toBe(true);
    // the summary revision alone moved
    expect(previewRevOf({ ...record, summary: { text: 'Shopify earns from faster checkout.', basedOn: [fid('p1')], rev: 1 } }, { companies, lines: SP_LINES })).not.toBe(rev);
    // the findings count alone moved (a finding no company carries)
    const p4 = record.findings.find((f) => f.findingId === fid('p4'));
    expect(previewRevOf({ ...record, findings: [...record.findings, { ...p4, findingId: fid('zz') }] }, { companies, lines: SP_LINES })).not.toBe(rev);
    // a line moving between two facts the union already holds: the union is unchanged, Shopify's own set is not
    const linesA = { support: null, complication: fid('p1'), missing: fid('p5') };
    const linesB = { support: null, complication: fid('a1'), missing: fid('p5') };
    const all = companies.supported.map((c) => c.symbol);
    expect(carriedFor(record, { supported: companies.supported, lines: linesA, symbols: all }))
      .toEqual(carriedFor(record, { supported: companies.supported, lines: linesB, symbols: all }));
    expect(previewRevOf(record, { companies, lines: linesA })).not.toBe(previewRevOf(record, { companies, lines: linesB }));
    // an echoed object (the old shape), null, a made-up token or a recased one is never the same
    for (const echo of [{ summaryRev: 0, findingsCount: record.findings.length }, null, `pr1.${'0'.repeat(32)}`, rev.toUpperCase()]) expect(sameRev(rev, echo)).toBe(false);
  });

  it('no preview without a supported company, nor on a closed record', () => {
    expect(adoptPreviewOf(record, { companies: { supported: [], leads: [] }, lines: SP_LINES })).toBeNull();
    expect(adoptPreviewOf({ ...record, state: 'completed' }, { companies, lines: SP_LINES })).toBeNull();
  });
});

describe('the assertion check (spec §6.6)', () => {
  const carried = carriedFor(record, { supported: companies.supported, lines: SP_LINES, symbols: ['SHOP'] });
  const ok = (statement) => refusal(() => assertAssertionsSupported(statement, { record, carried, selected: [shop], deselected: [apple] }));

  it('the unedited draft passes', () => {
    const draft = adoptPreviewOf(record, { companies, lines: SP_LINES }).companies.find((c) => c.symbol === 'SHOP').fragment;
    expect(ok(draft)).toBeNull();
  });
  it('an edited statement with "71%" is refused unsupported_assertion, naming the token', () => {
    expect(ok('Shopify earns from faster checkout: Shop Pay volume grew 71% from a year earlier.')).toEqual({ code: 'unsupported_assertion', detail: '71' });
  });
  it('a number only the proposed claim states does not support itself', () => {
    const claimOnly = { ...record, findings: record.findings.map((f) => (f.findingId === fid('p3') ? { ...f, fact: "Shop Pay's volume grew strongly." } : f)) };
    expect(refusal(() => assertAssertionsSupported('Shopify: Shop Pay volume grew 62%.', { record: claimOnly, carried, selected: [shop], deselected: [] })))
      .toEqual({ code: 'unsupported_assertion', detail: '62' });
  });
  it('spec §16 FQ-5: a number only a carried inference (the complication line) states is refused; the verified 62% passes', () => {
    const inferred = { ...record, findings: record.findings.map((f) => (f.findingId === fid('p4') ? { ...f, fact: 'A rival wallet may take 30% of those checkouts.' } : f)) };
    const c = carriedFor(inferred, { supported: companies.supported, lines: SP_LINES, symbols: ['SHOP'] });
    expect(c).toContain(fid('p4'));
    const check = (statement) => refusal(() => assertAssertionsSupported(statement, { record: inferred, carried: c, selected: [shop], deselected: [] }));
    expect(check('Shopify: Shop Pay volume grew 62%, and a rival wallet may take 30% of those checkouts.')).toEqual({ code: 'unsupported_assertion', detail: '30' });
    expect(check('Shopify: Shop Pay volume grew 62% from a year earlier.')).toBeNull();
  });
  it('a deselected name still in the statement is refused names_not_supported', () => {
    expect(ok('Shopify and Apple both earn from faster checkout; Shop Pay volume grew 62%.')).toEqual({ code: 'names_not_supported', detail: { deselected: 'AAPL' } });
  });
  it('a selected company the statement does not name is refused', () => {
    expect(ok('Faster checkout earns money; volume grew 62%.')).toEqual({ code: 'names_not_supported', detail: { missing: 'SHOP' } });
  });
});

describe('names', () => {
  it('the core of a company name', () => {
    expect(coreNameOf('Shopify Inc.')).toBe('Shopify');
    expect(coreNameOf('Eaton Corporation plc')).toBe('Eaton');
    expect(coreNameOf('The Coca-Cola Company')).toBe('Coca-Cola');
  });
  it('a company is named by its core name or its symbol as a word', () => {
    expect(namesCompany('Shopify earns', { symbol: 'SHOP', name: 'Shopify Inc.' })).toBe(true);
    expect(namesCompany('SHOP earns', { symbol: 'SHOP', name: 'Shopify Inc.' })).toBe(true);
    expect(namesCompany('Shopping earns', { symbol: 'SHOP', name: 'Shopify Inc.' })).toBe(false);
  });
});
