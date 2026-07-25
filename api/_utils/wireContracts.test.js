// api/_utils/wireContracts.test.js
// Contract-table integrity + the public-surface strip (§4.3 / F2-3) +
// V1.6 row modes (directionBases, subjectRef ownership, econ subject map).

import { describe, it, expect } from 'vitest';
import {
  EVENT_CONTRACTS,
  EVENT_TYPES,
  REPORTER_EVENT_ALLOWLIST,
  SHARED_FIGURE_BASES,
  WIRE_STORY_STATE_FIELDS,
  ECON_SUBJECT_REFS,
  INDEX_SUBJECTS,
  ETF_TO_INDEX,
  econSubjectRefForSlug,
  stripWireState,
  figureBasesFor,
} from './wireContracts.js';
import { canonicalizeEconEvent } from './wireIdentity.js';

describe('contract table integrity', () => {
  it('every reporter-allowlisted eventType has a contract row', () => {
    for (const [reporter, types] of Object.entries(REPORTER_EVENT_ALLOWLIST)) {
      for (const t of types) {
        expect(EVENT_CONTRACTS[t], `${reporter} → ${t}`).toBeDefined();
      }
    }
  });

  it('every contract row is reachable by exactly one reporter', () => {
    const owners = {};
    for (const [reporter, types] of Object.entries(REPORTER_EVENT_ALLOWLIST)) {
      for (const t of types) (owners[t] ||= []).push(reporter);
    }
    for (const t of EVENT_TYPES) {
      expect(owners[t], `${t} has no reporter`).toBeDefined();
      expect(owners[t].length, `${t} claimed by ${owners[t]}`).toBe(1);
    }
  });

  it('every row declares a well-formed cardinality, family and basis set', () => {
    for (const [type, row] of Object.entries(EVENT_CONTRACTS)) {
      const [min, max] = row.tickers;
      expect(min, type).toBeLessThanOrEqual(max);
      expect(min, type).toBeGreaterThanOrEqual(0);
      expect(row.family, type).toBeTruthy();
      expect(row.magnitudeBases.length, type).toBeGreaterThan(0);
      expect(['optional', 'forbidden']).toContain(row.direction);
      // A zero-ticker contract must be able to name its own subject.
      if (max === 0) expect(row.zeroTickerSubject, type).toBeTruthy();
    }
  });

  it('figureBasesFor is the row bases plus the shared set', () => {
    for (const type of EVENT_TYPES) {
      const bases = figureBasesFor(type);
      for (const b of EVENT_CONTRACTS[type].magnitudeBases) expect(bases).toContain(b);
      for (const b of SHARED_FIGURE_BASES) expect(bases).toContain(b);
      expect(new Set(bases).size).toBe(bases.length); // no duplicates
    }
  });

  it('directionBases (V1.6 A3): every row declares one; members are row-legal bases; forbidden-direction rows are empty, optional rows are not', () => {
    for (const [type, row] of Object.entries(EVENT_CONTRACTS)) {
      expect(Array.isArray(row.directionBases), type).toBe(true);
      const legal = figureBasesFor(type);
      for (const b of row.directionBases) expect(legal, `${type}:${b}`).toContain(b);
      if (row.direction === 'forbidden') {
        // A preview has no direction, so no basis can share its subject.
        expect(row.directionBases, type).toEqual([]);
      } else {
        // An optional-direction row with an empty list would silently turn
        // the sign rule OFF for that row — table truth, locked here.
        expect(row.directionBases.length, type).toBeGreaterThan(0);
      }
    }
  });

  it('subjectRef ownership (V1.6 A2): index_move is model_required, Neta rows are server, everything else is unset', () => {
    for (const [type, row] of Object.entries(EVENT_CONTRACTS)) {
      if (type === 'index_move') expect(row.subjectRef).toBe('model_required');
      else if (type === 'econ_print' || type === 'econ_preview') expect(row.subjectRef).toBe('server');
      else expect(row.subjectRef, type).toBeUndefined();
    }
  });

  it('ETF_TO_INDEX maps only into INDEX_SUBJECTS and never maps an index to itself', () => {
    for (const [etf, index] of Object.entries(ETF_TO_INDEX)) {
      expect(INDEX_SUBJECTS).toContain(index);
      expect(INDEX_SUBJECTS).not.toContain(etf);
    }
  });
});

describe('econ subjectRef map (V1.6 A2) — composed with key canonicalization', () => {
  it('every mapped slug is a canonical slug the canonicalizer can produce', () => {
    // The map is keyed by canonicalizeEconEvent OUTPUT; a typo'd key here
    // would silently null-stamp every story for that release.
    for (const slug of Object.keys(ECON_SUBJECT_REFS)) {
      expect(canonicalizeEconEvent(slug)).toBe(slug);
    }
  });

  it('live-alias round trips: alias → slug → subject', () => {
    expect(econSubjectRefForSlug(canonicalizeEconEvent('CPI (YoY)'))).toBe('CPI');
    expect(econSubjectRefForSlug(canonicalizeEconEvent('Non-Farm Payrolls'))).toBe('NFP');
    expect(econSubjectRefForSlug(canonicalizeEconEvent('Initial Jobless Claims'))).toBe('JOBLESS_CLAIMS');
    // The ism_svc-before-ism_mfg ordering carries through to the stamp.
    expect(econSubjectRefForSlug(canonicalizeEconEvent('ISM Non-Manufacturing PMI'))).toBe('ISM_SVC');
    expect(econSubjectRefForSlug(canonicalizeEconEvent('ISM Manufacturing PMI'))).toBe('ISM_MFG');
  });

  it('slugs outside the closed subject set degrade to null — known canonical or not', () => {
    expect(econSubjectRefForSlug(canonicalizeEconEvent('University of Michigan Consumer Sentiment'))).toBeNull(); // canonical slug 'umich', outside V1.6 set
    expect(econSubjectRefForSlug(canonicalizeEconEvent('Quits Rate Report'))).toBeNull(); // degraded slug
    expect(econSubjectRefForSlug(null)).toBeNull();
  });
});

describe('stripWireState — the public-surface guard', () => {
  const storyWithWireState = () => ({
    headline: 'NVDA beats',
    body: 'prose',
    tickers: ['NVDA'],
    wireValidation: { outcome: 'rejected', codes: ['R2_DIRECTIVE_FIELD'], validatorVersion: '1.6.0' },
    wirePending: true,
    wireConflict: 'envelope_missing',
    wireReplayAttempts: 3,
    wireSuperseded: true, // D9 stamp (V1.6 A1) — must strip like the rest
  });

  it('removes every declared pipeline-state field and nothing else', () => {
    const stripped = stripWireState(storyWithWireState());
    for (const field of WIRE_STORY_STATE_FIELDS) {
      expect(stripped[field], field).toBeUndefined();
    }
    expect(stripped).toEqual({ headline: 'NVDA beats', body: 'prose', tickers: ['NVDA'] });
  });

  it('does not mutate the input document', () => {
    const original = storyWithWireState();
    stripWireState(original);
    expect(original.wirePending).toBe(true);
  });

  it('no wire* key survives — the internal taxonomy never reaches a public response', () => {
    const stripped = stripWireState(storyWithWireState());
    expect(Object.keys(stripped).filter((k) => k.startsWith('wire'))).toEqual([]);
    expect(JSON.stringify(stripped)).not.toContain('R2_DIRECTIVE_FIELD');
    expect(JSON.stringify(stripped)).not.toContain('envelope_missing');
  });

  it('is a no-op for a pre-Wire story document', () => {
    const plain = { headline: 'h', body: 'b' };
    expect(stripWireState(plain)).toEqual(plain);
  });
});
