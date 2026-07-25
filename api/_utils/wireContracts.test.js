// api/_utils/wireContracts.test.js
// Contract-table integrity + the public-surface strip (§4.3 / F2-3).

import { describe, it, expect } from 'vitest';
import {
  EVENT_CONTRACTS,
  EVENT_TYPES,
  REPORTER_EVENT_ALLOWLIST,
  SHARED_FIGURE_BASES,
  WIRE_STORY_STATE_FIELDS,
  stripWireState,
  figureBasesFor,
} from './wireContracts.js';

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
});

describe('stripWireState — the public-surface guard', () => {
  const storyWithWireState = () => ({
    headline: 'NVDA beats',
    body: 'prose',
    tickers: ['NVDA'],
    wireValidation: { outcome: 'rejected', codes: ['R2_DIRECTIVE_FIELD'], validatorVersion: '1.5.0' },
    wirePending: true,
    wireConflict: 'envelope_missing',
    wireReplayAttempts: 3,
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
