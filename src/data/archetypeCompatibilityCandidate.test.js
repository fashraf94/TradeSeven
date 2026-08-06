// src/data/archetypeCompatibilityCandidate.test.js
//
// Composition Build (PR 1) — the candidate-registry completeness check (spec §3):
// a transcription-integrity check over the adjudicated five-archetype universe
// (every coordinate explicit). This is NOT the Phase 2 activation gate and does
// not exercise it. It also pins the §1 cell schema, the §9 manifest
// (anti-circularity M9: expected values transcribed from the ledgers, asserted
// against the registry), the tracked advisory gap, the §7b legacy-vs-candidate
// diff (A30), and the adapter. No production identity chain is touched (A22).
//
// The test's import of the candidate module IS the BUILD_RULES §4
// dependency-surface guard — never mock it.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  CANDIDATE_COMPAT_CELLS, INCLUDED_ARCHETYPES, RESERVED_ARCHETYPES,
  CANDIDATE_COMPAT_STATES, CANDIDATE_CELL_NOTE_TOKENS, CELL_SCHEMA_VERSION,
  getCandidateCompatCell, toCompilerCompatCell, buildRulingIndex,
} from './archetypeCompatibilityCandidate.js';
import { getRuleCompatInfo } from './archetypeRuleCompatibility.js';
import { isSupported } from './ruleSupportStatus.js';
import { FORGE_RULE_TEMPLATES } from './forgeKnowledgeBase.js';
import { canonicalContentHash } from '../../api/_utils/canonicalHash.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = JSON.parse(readFileSync(resolve(HERE, 'archetypeCompatibilityCandidate.manifest.json'), 'utf8'));

const ARCH = INCLUDED_ARCHETYPES;
const RULE_IDS = Object.keys(CANDIDATE_COMPAT_CELLS).sort();
const allCells = () => RULE_IDS.flatMap((r) => ARCH.map((a) => [r, a, CANDIDATE_COMPAT_CELLS[r][a]]));

function isDomain(v) {
  if (!v || typeof v !== 'object') return false;
  if ('allow' in v) return Array.isArray(v.allow);
  if ('minOnly' in v) return typeof v.minOnly === 'number';
  if ('min' in v || 'max' in v) return Object.keys(v).every((k) => k === 'min' || k === 'max');
  return false;
}
const isSorted = (a) => a.every((v, i) => i === 0 || String(a[i - 1]) <= String(v));

describe('candidate registry — completeness (spec §3)', () => {
  it('covers exactly the offerable rules × launch archetypes, every coordinate explicit', () => {
    const offerable = FORGE_RULE_TEMPLATES.filter((t) => isSupported(t.id)).map((t) => t.id).sort();
    expect(RULE_IDS).toEqual(offerable);                    // registry rules == ruleSupportStatus offerable
    expect(RULE_IDS).toEqual([...MANIFEST.includedRules].sort()); // == the checked-in locked list (M6 drift lock)
    for (const r of RULE_IDS) {
      expect(Object.keys(CANDIDATE_COMPAT_CELLS[r]).sort()).toEqual([...ARCH].sort()); // all 5, no more/less
    }
  });

  it('has the launch/reserved archetype sets of record', () => {
    expect(INCLUDED_ARCHETYPES).toEqual(['momentum_chaser', 'contrarian', 'degen', 'guardian', 'analyst']);
    expect(RESERVED_ARCHETYPES).toEqual(['diversifier']);
    expect(CELL_SCHEMA_VERSION).toBe(1);
  });
});

describe('candidate registry — §1 cell schema', () => {
  it('every cell is schema-valid; displayReason required iff core_conflict; set-like arrays sorted', () => {
    for (const [r, a, c] of allCells()) {
      expect(CANDIDATE_COMPAT_STATES, `${r}/${a}`).toContain(c.state);
      expect(Array.isArray(c.rulingIds)).toBe(true);
      expect(isSorted(c.rulingIds), `${r}/${a} rulingIds sorted`).toBe(true);
      expect(c.narrowedParams === null || typeof c.narrowedParams === 'object').toBe(true);
      if (c.narrowedParams !== null) {
        const ok = isDomain(c.narrowedParams) || Object.values(c.narrowedParams).every(isDomain);
        expect(ok, `${r}/${a} narrowedParams`).toBe(true);
      }
      expect(Array.isArray(c.notes)).toBe(true);
      expect(isSorted(c.notes), `${r}/${a} notes sorted`).toBe(true);
      for (const n of c.notes) expect(CANDIDATE_CELL_NOTE_TOKENS, `${r}/${a} note`).toContain(n);
      // core_conflict MUST carry a displayReason (spec §1 / B7); non-cc must not
      if (c.state === 'core_conflict') expect(typeof c.displayReason, `${r}/${a} cc needs displayReason`).toBe('string');
      else expect(c.displayReason, `${r}/${a} non-cc displayReason`).toBeNull();
    }
  });

  it('advisory is present for every tension cell EXCEPT the tracked known gap', () => {
    const gap = new Set(MANIFEST.knownAdvisoryGap.map((g) => `${g.ruleId}|${g.archetype}`));
    const observedGap = new Set();
    for (const [r, a, c] of allCells()) {
      if (c.state !== 'tension') continue;
      if (c.advisory === null || c.advisory === '') observedGap.add(`${r}|${a}`);
      else expect(typeof c.advisory).toBe('string');
    }
    // the observed advisory gap must equal the manifest's tracked gap exactly:
    // a NEW missing advisory fails; a filled known gap fails until the manifest updates.
    expect([...observedGap].sort()).toEqual([...gap].sort());
  });
});

describe('candidate registry — §9 manifest (anti-circularity M9) + drift lock', () => {
  const byState = { native: 0, neutral: 0, tension: 0, core_conflict: 0, deferred: 0 };
  for (const [, , c] of allCells()) byState[c.state]++;

  it('registry state distribution equals the ledger-transcribed manifest tallies', () => {
    expect(byState).toEqual(MANIFEST.registryByState);
    const t = MANIFEST.ledgerTotals;
    expect(t.native + t.neutral + t.tension + t.core_conflict).toBe(t.authored); // 464 authored
    expect(t.authored + t.deferred).toBe(RULE_IDS.length * ARCH.length);         // 475 coordinates
    for (const k of ['native', 'neutral', 'tension', 'core_conflict', 'deferred']) expect(byState[k]).toBe(t[k]);
  });

  it('the manifest content hash is stable (recompute == stored)', () => {
    const { manifestHash, ...body } = MANIFEST;
    expect(canonicalContentHash(body)).toBe(manifestHash);
  });
});

describe('candidate registry — §7b legacy-vs-candidate diff (A30)', () => {
  const ccCorrections = [], ccRelaxations = [];
  for (const [r, a, c] of allCells()) {
    const leg = getRuleCompatInfo(r, a).state;
    if (c.state === 'core_conflict' && leg !== 'core_conflict') ccCorrections.push({ ruleId: r, archetype: a, legacy: leg });
    if (c.state !== 'core_conflict' && leg === 'core_conflict') ccRelaxations.push({ ruleId: r, archetype: a, candidate: c.state });
  }
  const key = (x) => x.ruleId + x.archetype;
  ccCorrections.sort((x, y) => key(x).localeCompare(key(y)));
  ccRelaxations.sort((x, y) => key(x).localeCompare(key(y)));

  it('the CC-correction + relaxation sets equal the locked diff (drift fails CI)', () => {
    expect(ccCorrections).toEqual(MANIFEST.diff.ccCorrections);
    expect(ccRelaxations).toEqual(MANIFEST.diff.ccRelaxations);
  });
});

describe('candidate registry — adapter + rulingIndex', () => {
  it('toCompilerCompatCell yields the compiler contract; via is never fallthrough', () => {
    for (const [, , c] of allCells()) {
      const out = toCompilerCompatCell(c);
      expect(out.via).toBe('authored');
      expect(out.via).not.toBe('fallthrough'); // explicit — never absence (A-4)
      if (c.state === 'tension') expect(out.treatment).toBe('advisoryDowngrade');
      if (c.state === 'core_conflict') expect(out.tensionReason).toBe(c.displayReason);
    }
  });

  it('getCandidateCompatCell resolves authored coordinates and null otherwise', () => {
    expect(getCandidateCompatCell('r-09', 'degen').state).toBe('core_conflict');
    expect(getCandidateCompatCell('does-not-exist', 'degen')).toBeNull();
    expect(getCandidateCompatCell('r-09', 'diversifier')).toBeNull(); // reserved, no cell
  });

  it('buildRulingIndex maps each ruling id to the coordinates that cite it', () => {
    const idx = buildRulingIndex();
    expect(idx['R-14']).toEqual([{ ruleId: 'r-09', archetype: 'degen' }]);
    expect(idx['R-13']).toEqual([{ ruleId: 'r-12', archetype: 'contrarian' }]);
  });
});
