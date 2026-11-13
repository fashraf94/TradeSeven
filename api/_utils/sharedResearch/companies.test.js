// api/_utils/sharedResearch/companies.test.js
//
// Shared Research B1 — companiesOf and the read projection (spec §6.7, §9
// Correction A, §15 S-5). The prototype promoted a company when stepsUsed
// crossed a number; here support is a fact of the record's CURRENT findings
// and the universe, and nothing else.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real, unmocked import of
// companies.js (and through it src/constants/sharedResearch.js) is the runtime
// guard for its import graph. Never mock it.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { companiesOf, projectionOf, resolveSymbol, splitRole, leadNameOf, etDaysBetween } from './companies.js';
import { dataCenterRecord, fid, shopPayRecord, SP_LINES, T3 } from './__fixtures__/records.js';

const SRC = readFileSync(fileURLToPath(new URL('./companies.js', import.meta.url)), 'utf8');
const NAMES = { ETN: 'Eaton Corporation plc' };

describe('Correction A — support is the record and the universe, never a step count', () => {
  it('after step 1 (d1–d3, an unresolved supplier): nothing supported, one lead — Northfield Thermal, identity unresolved', () => {
    const { supported, leads } = companiesOf(dataCenterRecord('step1'), { names: NAMES });
    expect(supported).toEqual([]);
    expect(leads).toEqual([{ name: 'Northfield Thermal', symbol: null, findingIds: [fid('dm1')], status: 'unavailable', statusReason: 'not_checked', unresolved: 'identity_unresolved' }]);
  });

  it('a refresh that adds no relationship leaves both lists exactly as they were, however many steps were used', () => {
    const before = companiesOf(dataCenterRecord('step1'), { names: NAMES });
    const refreshed = dataCenterRecord('refresh');
    for (const stepsUsed of [1, 2, 9, 10]) {
      expect(companiesOf({ ...refreshed, stepsUsed, exchanges: new Array(stepsUsed).fill({}) }, { names: NAMES })).toEqual(before);
    }
  });

  it('after d4 (a verified relationship, the symbol resolved): Eaton is supported with its role, evidence and eligibility', () => {
    const { supported, leads } = companiesOf(dataCenterRecord('d4'), { names: NAMES });
    expect(supported).toEqual([{
      symbol: 'ETN', name: 'Eaton Corporation plc', role: 'Supplier',
      relationship: 'Eaton sells switchgear and power distribution equipment to data-center builders.',
      relationshipFindingId: fid('d4'), evidence: [fid('d4')], openQuestion: null, claim: null, eligibility: 'eligible',
    }]);
    expect(leads.map((l) => l.name)).toEqual(['Northfield Thermal']);
  });

  it('d4 corrected by an unavailable finding: supported is empty again, and Eaton is a lead with the correction\'s status', () => {
    const { supported, leads } = companiesOf(dataCenterRecord('d4x'), { names: NAMES });
    expect(supported).toEqual([]);
    expect(leads.find((l) => l.symbol === 'ETN')).toMatchObject({ name: 'Eaton Corporation plc', status: 'unavailable', statusReason: 'single_source' });
  });

  it('a resolved company whose relationship is only unavailable is never supported, however many steps were used', () => {
    const corrected = dataCenterRecord('d4x'); // ETN's relationship corrected to unavailable
    for (const stepsUsed of [0, 1, 3, 9, 10]) {
      expect(companiesOf({ ...corrected, stepsUsed, stepBudget: 10 }, { names: NAMES }).supported).toEqual([]);
    }
  });

  it('a verified relationship whose symbol is NOT the company\'s supports nothing for another symbol; an unverified one supports nothing', () => {
    const r = dataCenterRecord('d4');
    const inferred = { ...r, findings: r.findings.map((f) => (f.findingId === fid('d4') ? { ...f, status: 'unverified', statusReason: 'inference' } : f)) };
    expect(companiesOf(inferred).supported).toEqual([]);
  });

  it('the function reads no step count, no exchange and no session field (source pin)', () => {
    const body = SRC.slice(SRC.indexOf('export function companiesOf'), SRC.indexOf('/** A finding as the client reads it'));
    expect(body).not.toMatch(/stepsUsed|exchanges|stepBudget|lastStep|session/);
  });
});

describe('symbols resolve inside the universe only', () => {
  it('upper-cases, hyphenates and refuses what the universe does not hold or has retired', () => {
    expect(resolveSymbol('etn')).toBe('ETN');
    expect(resolveSymbol(' brk.b ')).toBe('BRK-B');
    expect(resolveSymbol('VRT')).toBeNull(); // a real company, not in the game's universe
    expect(resolveSymbol('NOTATICKER')).toBeNull();
    expect(resolveSymbol(null)).toBeNull();
    expect(resolveSymbol('ETN', { has: () => true, retired: () => true })).toBeNull();
  });
});

describe('the role and a lead\'s name come from prefixes the server wrote', () => {
  it('splitRole reads only the closed role list; leadNameOf reads "{name}: "', () => {
    expect(splitRole('Supplier · Eaton sells gear.')).toEqual({ role: 'Supplier', rest: 'Eaton sells gear.' });
    expect(splitRole('Vendor · Eaton sells gear.')).toEqual({ role: null, rest: 'Vendor · Eaton sells gear.' });
    expect(leadNameOf('Northfield Thermal: supplies units.')).toBe('Northfield Thermal');
    expect(leadNameOf('No name here.')).toBeNull();
  });
});

describe('the read projection (spec §6.7; §15 S-5)', () => {
  it('current and superseded findings, the latest lines, the next action — no symbolKeys, no exchange id', () => {
    const r = shopPayRecord();
    const p = projectionOf(r, { lines: SP_LINES, nowIso: T3 });
    expect(p).not.toHaveProperty('symbolKeys');
    expect(p.findings.map((f) => f.findingId)).not.toContain(fid('p2'));
    expect(p.superseded.map((f) => f.findingId)).toEqual([fid('p2'), fid('p5')]);
    const ex = p.findings.find((f) => f.source.recordKind === 'exchange');
    expect(ex.source.recordId).toBeNull();
    expect(JSON.stringify(p)).not.toContain('6f1c2b0e-8a7d-4c3b-9e21-0a5d4f3e2b1c');
    expect(p.lines).toEqual(SP_LINES);
    expect(p.summary).toBeNull();
    expect(p.age).toBeNull();
  });
  it('age is whole ET calendar days since the summary', () => {
    expect(etDaysBetween('2026-11-10T15:00:00.000Z', '2026-11-12T15:00:00.000Z')).toBe(2);
    expect(etDaysBetween('2026-11-11T03:00:00.000Z', '2026-11-11T05:30:00.000Z')).toBe(1); // 10 PM → 12:30 AM ET
  });
});
