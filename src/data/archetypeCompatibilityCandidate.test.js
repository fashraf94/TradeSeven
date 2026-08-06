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

// Strict Domain validator (§1): {allow:[...]} | {minOnly:number} | {min?,max? numbers}.
// Guards numeric bounds and exact key shape so a corrupted domain actually fails
// (BUILD_RULES §2 — a guard that cannot fail is not a guard).
function isDomain(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  if ('allow' in v) return keys.length === 1 && Array.isArray(v.allow);
  if ('minOnly' in v) return keys.length === 1 && typeof v.minOnly === 'number';
  if (keys.length > 0 && keys.every((k) => k === 'min' || k === 'max')) {
    return (!('min' in v) || typeof v.min === 'number') && (!('max' in v) || typeof v.max === 'number');
  }
  return false;
}
// narrowedParams: null | a bare Domain | a NON-EMPTY param-keyed map of Domains.
function validNarrowed(np) {
  if (np === null) return true;
  if (!np || typeof np !== 'object' || Array.isArray(np)) return false;
  if (isDomain(np)) return true;
  const keys = Object.keys(np);
  return keys.length > 0 && keys.every((k) => isDomain(np[k]));
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
      expect(validNarrowed(c.narrowedParams), `${r}/${a} narrowedParams ${JSON.stringify(c.narrowedParams)}`).toBe(true);
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

  it('the INDEPENDENT per-batch ledger tallies sum to the registry distribution (M9)', () => {
    // ledgerBatchTallies are hand-transcribed from each ledger's own tally line —
    // the genuinely independent side. Asserting their sum against the
    // registry-derived byState is what makes anti-circularity real for the state
    // claim (a generator miscount corrupts byState but NOT these constants).
    const sum = { native: 0, neutral: 0, tension: 0, core_conflict: 0, deferred: 0 };
    for (const t of Object.values(MANIFEST.ledgerBatchTallies)) for (const k of Object.keys(sum)) sum[k] += t[k];
    expect(sum).toEqual(byState);
  });

  it('the advisory gap is CLOSED — every tension cell carries a verbatim advisory', () => {
    // The 35 C7 + 2 C2 gap cells were filled from the committed C7 V1.0 extract
    // (docs/archetype-program/…); manifest.knownAdvisoryGap is now empty. A
    // regrown gap (e.g. a new tension cell without guidance) fails here.
    expect(MANIFEST.knownAdvisoryGap).toEqual([]);
    const tensionNulls = allCells().filter(([, , c]) => c.state === 'tension' && (c.advisory === null || c.advisory === ''));
    expect(tensionNulls.map(([r, a]) => `${r}/${a}`)).toEqual([]);
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
  it('toCompilerCompatCell maps each authored cell to the candidate→compiler cell shape', () => {
    for (const [, , c] of allCells()) {
      const out = toCompilerCompatCell(c);
      expect(out.via).toBe('authored'); // explicit — never 'fallthrough'/absence (A-4)
      if (c.state === 'tension') expect(out.treatment).toBe('advisoryDowngrade');
      if (c.state === 'core_conflict') expect(out.tensionReason).toBe(c.displayReason);
      expect(out.advisory).toBe(c.advisory ?? null); // forward field for PR-3 compiled-field work
    }
  });

  it("'deferred' passes through as a NET-NEW compiler state (not yet in the compiler vocabulary — PR 3)", () => {
    // The shipped compiler (compileBuild.js:196-204) maps only
    // neutral/native/tension/core_conflict; a 'deferred' cell would raise
    // unknown_compat_state. The adapter faithfully carries 'deferred'; wiring it
    // into the compiler is PR-3 work per the closure sheet.
    const deferred = allCells().filter(([, , c]) => c.state === 'deferred');
    expect(deferred.length).toBe(11);
    for (const [, , c] of deferred) expect(toCompilerCompatCell(c).state).toBe('deferred');
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

describe('candidate registry — A11: the valueParamKey binding table (PR 3)', () => {
  // The PR-1 transcription flattened param-KEYED ledger notation into bare
  // domains, which classified ambiguous on multi-param rules (the six dry-run
  // needsBinding rows). PR 3 RESTORES the ledger keys — these are transcribed
  // values of record, not authored bindings. Sources: ADJUDICATION_RULINGS_V1.md
  // (R-61 {pct∈[40,80]}, R-50 {pct∈{10}}, R-52 {pct∈[10,30]}, R-84
  // {rsi_low∈[30,40]}, R-132/133/134 {pct∈[25,50]}) and CELL_BATCH_C7_FINAL_V1.md
  // (R-159 "{final ≥ 1.0} survives as sign-based", R-7 {atr∈[0.25,0.4]},
  // R-8 {atr∈[0.2,0.4]}).
  const LEDGER_BINDINGS = [
    ['alloc-sector-cap', 'momentum_chaser', { pct: { min: 40, max: 80 } }],       // R-61
    ['alloc-sector-minimum', 'momentum_chaser', { pct: { allow: [10] } }],        // R-50
    ['alloc-sector-minimum', 'guardian', { pct: { min: 10, max: 30 } }],          // R-52
    ['gs-02', 'guardian', { final: { minOnly: 1 } }],                             // R-159
    ['mb-11', 'momentum_chaser', { pct: { min: 25, max: 50 } }],                  // R-132
    ['mb-11', 'guardian', { pct: { min: 25, max: 50 } }],                         // R-133
    ['mb-11', 'analyst', { pct: { min: 25, max: 50 } }],                          // R-134
    ['th-05', 'degen', { atr: { min: 0.25, max: 0.4 } }],                         // R-7
    ['th-05', 'guardian', { atr: { min: 0.2, max: 0.4 } }],                       // R-8
    ['tv-12', 'contrarian', { rsi_low: { min: 30, max: 40 } }],                   // R-84
  ];

  it('each of the ten formerly-ambiguous cells carries its ledger-exact param-keyed binding', () => {
    for (const [ruleId, archetype, expected] of LEDGER_BINDINGS) {
      expect(getCandidateCompatCell(ruleId, archetype).narrowedParams, `${ruleId}/${archetype}`).toEqual(expected);
    }
    // ...and every bound key names a REAL param of the rule's corpus template.
    const paramKeysOf = (ruleId) => {
      const t = FORGE_RULE_TEMPLATES.find((x) => x.id === ruleId);
      const keys = new Set();
      for (const ft of t?.forgeTemplates || []) for (const k of Object.keys(ft?.params || {})) keys.add(k);
      return keys;
    };
    for (const [ruleId, , expected] of LEDGER_BINDINGS) {
      for (const key of Object.keys(expected)) {
        expect(paramKeysOf(ruleId).has(key), `${ruleId} binds unknown param ${key}`).toBe(true);
      }
    }
  });

  it('needsBinding is ZERO by construction: no cell carries a bare domain on a multi-param rule', async () => {
    // A bare domain (a domain object not keyed by param) binds deterministically
    // only when the rule has exactly one template param. On a multi-param rule it
    // classifies ambiguous_domain_binding — the migration's needsBinding class.
    // After the A11 restoration this set is empty, and this row keeps it empty:
    // a future transcription that drops a param key fails CI here, not in a
    // founder dry-run.
    //
    // Review F5 (test-integrity lens): the bare-domain predicate is the
    // KERNEL's OWN isDomain — imported, not hand-copied — so a future domain
    // shape added to the kernel cannot drift this invariant into a false
    // pass on exactly the class it exists to keep empty.
    const { isDomain: isBareDomain } = await import('../../api/_utils/compositionEnforcement.js');
    const offenders = [];
    for (const [r, a, c] of allCells()) {
      if (!c.narrowedParams || !isBareDomain(c.narrowedParams)) continue;
      const t = FORGE_RULE_TEMPLATES.find((x) => x.id === r);
      const keys = new Set();
      for (const ft of t?.forgeTemplates || []) for (const k of Object.keys(ft?.params || {})) keys.add(k);
      if (keys.size > 1) offenders.push(`${r}/${a} params=[${[...keys].join(',')}]`);
    }
    expect(offenders).toEqual([]);
  });
});
