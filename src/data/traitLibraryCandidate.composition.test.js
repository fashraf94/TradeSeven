// src/data/traitLibraryCandidate.composition.test.js
//
// Composition PR 4 — cargo item 6 (the candidate default-traits object) +
// the A24 arms available BEFORE the activation-record wiring:
//
//   1. the substitution CLOSES item 6: no hidden/deprecated rule remains in
//      any candidate default set — proven against the same predicate that
//      still finds EXACTLY the five known offenders in the LIVE object (the
//      RED control: a predicate that cannot see the live offenders could not
//      certify the candidate);
//   2. the founder's substitution POLICY holds: every replacement rule is
//      supported + offerable and NATIVE for its host archetype
//      (candidate-registry-native for guardian; STORED-map-native for the
//      reserved diversifier column — the ruling's clause 1);
//   3. the B4-TRAIT invariants extend over the CANDIDATE composition:
//      (a) no candidate default trait hosts core_conflict/deferred for its
//      own archetype; (b) every candidate ladder seeds in-domain at every
//      strength wherever cells exist (kernel-imported predicates); ladders
//      stay inside template ranges and monotone in each trait's semantic
//      direction;
//   4. A24, structural arm: the candidate object is UNREACHABLE from every
//      birth path — no production module outside the registry composition
//      layer imports it, and the LIVE read surface returns the LIVE library
//      objects BY REFERENCE (the candidate cannot leak into a birth);
//   5. A24, candidate arm: the version-parameterized composition at
//      v{candidate} carries the substituted values.
//
// The A24 BOTH-SIDES birth test (record absent → old values; record selects
// candidate → substituted values) lands with the activation-record service
// (same PR, batch 4) — this file pins everything provable without it.
//
// SUBSTITUTION PROPOSALS (built in-branch, tabled for founder ratification
// at merge — the 3.5 ladder pattern): see traitLibraryCandidate.js header.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

import { TRAIT_BY_ID, ARCHETYPE_DEFAULT_TRAITS } from './traitLibrary.js';
import {
  CANDIDATE_TRAIT_DEFINITIONS,
  CANDIDATE_ARCHETYPE_DEFAULT_TRAITS,
  getCandidateTraitById,
} from './traitLibraryCandidate.js';
import { getCandidateCompatCell, RESERVED_ARCHETYPES } from './archetypeCompatibilityCandidate.js';
import { getRuleCompatInfo } from './archetypeRuleCompatibility.js';
import { isSupported, getSupportStatus } from './ruleSupportStatus.js';
import { FORGE_RULE_TEMPLATES } from './forgeKnowledgeBase.js';
import { resolveNarrowedDomains, domainAdmits } from '../../api/_utils/compositionEnforcement.js';
import {
  getArchetypeDefinition, ARCHETYPE_IDENTITY_VERSION, CANDIDATE_IDENTITY_VERSION,
} from '../../api/_utils/archetypeRegistry.js';

const STRENGTHS = ['subtle', 'moderate', 'dominant'];

const templateOf = (ruleId) => FORGE_RULE_TEMPLATES.find((t) => t.id === ruleId);
const templateParam = (ruleId, key) => {
  for (const ft of templateOf(ruleId)?.forgeTemplates || []) {
    if (ft?.params?.[key]) return ft.params[key];
  }
  return null;
};

function eachDefaultRule(defaultsMap, traitOf, fn) {
  for (const [archetype, traitIds] of Object.entries(defaultsMap)) {
    for (const traitId of traitIds) {
      const trait = traitOf(traitId);
      expect(trait, `${archetype} names unknown trait ${traitId}`).toBeTruthy();
      for (const ruleId of trait.ruleIds || []) fn({ archetype, traitId, trait, ruleId });
    }
  }
}

describe('cargo item 6 — the substitution CLOSES the non-offerable-seed class', () => {
  it('RED control: the LIVE object seeds exactly SEVEN non-offerable hosts — item 6 named five; the same predicate finds two more (the scope finding)', () => {
    const offenders = [];
    eachDefaultRule(ARCHETYPE_DEFAULT_TRAITS, (id) => TRAIT_BY_ID[id], ({ archetype, ruleId }) => {
      if (!isSupported(ruleId)) offenders.push(`${archetype}/${ruleId}:${getSupportStatus(ruleId)}`);
    });
    expect(offenders.sort()).toEqual([
      'contrarian/tv-07:hidden_absent_substrate',           // BEYOND item 6 (scope finding)
      'diversifier/gs-05:hidden_absent_substrate',
      'diversifier/gs-06:hidden_absent_substrate',
      'diversifier/mb-05:hidden_absent_substrate',
      'diversifier/tv-04:hidden_absent_substrate',
      'guardian/risk-single-stock-limit:deprecated',
      'momentum_chaser/t-09:hidden_absent_substrate',       // BEYOND item 6 (scope finding)
    ]);
  });

  it('the CANDIDATE object seeds ZERO non-offerable rules across all six archetypes (same predicate — item 6 satisfied)', () => {
    const offenders = [];
    eachDefaultRule(CANDIDATE_ARCHETYPE_DEFAULT_TRAITS, getCandidateTraitById, ({ archetype, ruleId }) => {
      if (!isSupported(ruleId)) offenders.push(`${archetype}/${ruleId}:${getSupportStatus(ruleId)}`);
    });
    expect(offenders).toEqual([]);
  });
});

describe('the substitution POLICY (founder ruling, Aug 7 2026)', () => {
  it('every included-archetype replacement is CANDIDATE-registry-NATIVE (clause 1, cells exist)', () => {
    expect(getCandidateCompatCell('alloc-sector-cap', 'guardian').state).toBe('native');
    expect(getCandidateCompatCell('tv-08', 'momentum_chaser').state).toBe('native');
    expect(getCandidateCompatCell('fund-value-pe', 'contrarian').state).toBe('native');
  });

  it('every diversifier replacement rule is STORED-map-NATIVE (clause 1, reserved column — the stored map governs)', () => {
    for (const traitId of ['trait-crowding-sentinel', 'trait-balanced-optionality']) {
      for (const ruleId of CANDIDATE_TRAIT_DEFINITIONS[traitId].ruleIds) {
        expect(getRuleCompatInfo(ruleId, 'diversifier')?.state, `${traitId}/${ruleId}`).toBe('native');
      }
    }
  });

  it('never seed hidden/deprecated (clause 3): each replaced rule really was non-offerable, each replacement really is offerable', () => {
    for (const gone of ['tv-04', 'mb-05', 'gs-05', 'gs-06', 'risk-single-stock-limit', 't-09', 'tv-07']) {
      expect(isSupported(gone), `${gone} should be non-offerable`).toBe(false);
    }
    for (const traitId of Object.keys(CANDIDATE_TRAIT_DEFINITIONS)) {
      for (const ruleId of CANDIDATE_TRAIT_DEFINITIONS[traitId].ruleIds) {
        expect(isSupported(ruleId), `${traitId}/${ruleId}`).toBe(true);
      }
    }
  });
});

describe('B4-TRAIT invariants over the CANDIDATE composition', () => {
  it('(a) no candidate default trait hosts core_conflict/deferred for its own archetype', () => {
    const offenders = [];
    eachDefaultRule(CANDIDATE_ARCHETYPE_DEFAULT_TRAITS, getCandidateTraitById, ({ archetype, traitId, ruleId }) => {
      if (RESERVED_ARCHETYPES.includes(archetype)) return; // no candidate column
      const cell = getCandidateCompatCell(ruleId, archetype);
      if (cell && (cell.state === 'core_conflict' || cell.state === 'deferred')) {
        offenders.push(`${archetype}/${traitId}/${ruleId}: ${cell.state}`);
      }
    });
    expect(offenders).toEqual([]);
  });

  it('(b) every candidate ladder seeds IN-DOMAIN at every strength wherever cells exist (kernel predicates, rendered value = seeded ?? template default)', () => {
    const offenders = [];
    eachDefaultRule(CANDIDATE_ARCHETYPE_DEFAULT_TRAITS, getCandidateTraitById, ({ archetype, traitId, trait, ruleId }) => {
      if (RESERVED_ARCHETYPES.includes(archetype)) return;
      const cell = getCandidateCompatCell(ruleId, archetype);
      if (!cell?.narrowedParams) return;
      const paramKeys = [...new Set((templateOf(ruleId)?.forgeTemplates || []).flatMap((ft) => Object.keys(ft?.params || {})))];
      const { domains } = resolveNarrowedDomains(cell.narrowedParams, paramKeys);
      for (const strength of STRENGTHS) {
        const seeds = trait.strengthProfiles?.[strength]?.[ruleId] || {};
        for (const [param, domain] of Object.entries(domains)) {
          const rendered = seeds[param] ?? templateParam(ruleId, param)?.default;
          if (rendered !== undefined && !domainAdmits(domain, rendered)) {
            offenders.push(`${archetype}/${traitId}/${ruleId}.${param}@${strength}=${rendered}`);
          }
        }
      }
    });
    expect(offenders).toEqual([]);
  });

  it('the three authored ladders stay inside their TEMPLATE ranges and monotone in the trait semantic direction', () => {
    const anchor = CANDIDATE_TRAIT_DEFINITIONS['trait-steady-anchor'].strengthProfiles;
    const capLadder = STRENGTHS.map((s) => anchor[s]['alloc-sector-cap'].pct);
    expect(capLadder).toEqual([45, 35, 25]); // strictly tightening
    const capSpec = templateParam('alloc-sector-cap', 'pct');
    for (const v of capLadder) { expect(v).toBeGreaterThanOrEqual(capSpec.min); expect(v).toBeLessThanOrEqual(capSpec.max); }

    const sentinel = CANDIDATE_TRAIT_DEFINITIONS['trait-crowding-sentinel'].strengthProfiles;
    expect(STRENGTHS.map((s) => sentinel[s]['i-05'].max)).toEqual([3, 2, 1]); // strictly tightening, floor of the template range
    expect(STRENGTHS.map((s) => sentinel[s]['r-07'].max)).toEqual([2, 1, 1]); // tightening, clamped by the template floor (min 1)
    for (const [rule, key] of [['i-05', 'max'], ['r-07', 'max']]) {
      const spec = templateParam(rule, key);
      for (const s of STRENGTHS) {
        const v = sentinel[s][rule][key];
        expect(v).toBeGreaterThanOrEqual(spec.min); expect(v).toBeLessThanOrEqual(spec.max);
      }
    }

    const optionality = CANDIDATE_TRAIT_DEFINITIONS['trait-balanced-optionality'].strengthProfiles;
    expect(STRENGTHS.map((s) => optionality[s]['a-09'].complement)).toEqual([1, 2, 3]); // strictly widening bench coverage
    expect(STRENGTHS.map((s) => optionality[s]['a-09'].high_upside)).toEqual([0, 1, 2]);
    expect(STRENGTHS.map((s) => optionality[s]['alloc-even-spread'].conviction)).toEqual(['light', 'moderate', 'strong']);

    // The two BEYOND-item-6 ladders (scope finding): stricter with strength,
    // inside template ranges; unchanged sibling rules carry live values
    // verbatim (incl. the 3.5-repaired tv-01 rungs).
    const rider = CANDIDATE_TRAIT_DEFINITIONS['trait-trend-rider'].strengthProfiles;
    expect(STRENGTHS.map((s) => rider[s]['tv-08'].score)).toEqual([55, 60, 65]);
    expect(STRENGTHS.map((s) => rider[s]['tv-08'].vol)).toEqual([1, 0.8, 0.6]);
    expect(STRENGTHS.map((s) => rider[s]['tv-08'].minutes)).toEqual([60, 90, 120]);
    for (const [key, spec] of [['score', templateParam('tv-08', 'score')], ['vol', templateParam('tv-08', 'vol')], ['minutes', templateParam('tv-08', 'minutes')]]) {
      for (const s2 of STRENGTHS) {
        const v = rider[s2]['tv-08'][key];
        expect(v).toBeGreaterThanOrEqual(spec.min); expect(v).toBeLessThanOrEqual(spec.max);
      }
    }
    expect(rider.dominant['tv-01']).toEqual({ low: 55, high: 65, weak: 45, stretched: 75 }); // 3.5-repaired rung, verbatim

    const hunter = CANDIDATE_TRAIT_DEFINITIONS['trait-bargain-hunter'].strengthProfiles;
    expect(STRENGTHS.map((s) => hunter[s]['fund-value-pe'].level)).toEqual(['sector median', '20', '15']);
    const levelOptions = templateParam('fund-value-pe', 'level').options.map((o) => o.value);
    for (const s2 of STRENGTHS) expect(levelOptions).toContain(hunter[s2]['fund-value-pe'].level);
    expect(hunter.dominant['tech-rsi-oversold']).toEqual({ threshold: 25 }); // live rung, verbatim
  });
});

describe('A24 — structural + candidate arms (the record-gated both-sides birth test lands with the activation service)', () => {
  it('STRUCTURAL: no production module outside the registry composition layer imports the candidate object', () => {
    const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const ALLOWED = new Set(['api/_utils/archetypeRegistry.js', 'src/data/traitLibraryCandidate.js']);
    const hits = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(full); continue; }
        if (!/\.(js|jsx)$/.test(entry.name) || /\.test\.(js|jsx)$/.test(entry.name)) continue;
        const rel = relative(REPO, full);
        if (ALLOWED.has(rel)) continue;
        if (/from\s+['"][^'"]*traitLibraryCandidate(?:\.js)?['"]/.test(readFileSync(full, 'utf8'))) hits.push(rel);
      }
    };
    walk(join(REPO, 'api'));
    walk(join(REPO, 'src'));
    expect(hits, 'the candidate defaults object gained a production importer — A24 requires it unreachable from every birth path until the activation record selects it').toEqual([]);
  });

  it('LIVE read surface returns the LIVE library objects BY REFERENCE — the candidate cannot leak into a birth', () => {
    const live = getArchetypeDefinition('guardian');
    expect(live.identityVersion).toBe(ARCHETYPE_IDENTITY_VERSION);
    for (const [i, id] of live.defaultTraitIds.entries()) {
      expect(live.defaultTraits[i]).toBe(TRAIT_BY_ID[id]); // identity, not equality
    }
    expect(live.defaultTraits.find((t) => t.id === 'trait-steady-anchor').ruleIds).toContain('risk-single-stock-limit');
  });

  it('CANDIDATE arm: v(live+1) carries the substituted values — and ONLY a version-parameterized call reaches them', () => {
    const g3 = getArchetypeDefinition('guardian', { identityVersion: CANDIDATE_IDENTITY_VERSION });
    const anchor3 = g3.defaultTraits.find((t) => t.id === 'trait-steady-anchor');
    expect(anchor3.ruleIds).toEqual(['risk-sector-diversification', 'alloc-sector-cap', 'alloc-even-spread']);
    expect(anchor3.strengthProfiles.dominant['alloc-sector-cap']).toEqual({ sector: 'any single', pct: 25 });
    const d3 = getArchetypeDefinition('diversifier', { identityVersion: CANDIDATE_IDENTITY_VERSION });
    expect(d3.defaultTraitIds).toEqual(['trait-crowding-sentinel', 'trait-sector-rotator', 'trait-balanced-optionality']);
  });
});
