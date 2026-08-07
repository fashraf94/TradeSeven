// src/data/archetypeDefaultTraits.composition.test.js
//
// Composition PR 3.5 — the trait-channel CI invariants (founder trait
// rulings, Aug 6 2026; ledger row B4-TRAIT). Two of the three ruled rows
// live here; the third (trait-hosted tensions RENDER their advisories) is
// the end-to-end row in compositionAdvisoryRender.activation.test.js.
//
//   (a) no default trait hosts a rule graded core_conflict or deferred for
//       its OWN archetype — the born-with set can never seed an illegal pair
//   (b) every default trait's seeded params, at EVERY strength, sit inside
//       the archetype's own adjudicated domains — the born-with ladder can
//       never seed an out-of-domain value. This row was authored RED against
//       the pre-repair ladders (analyst tv-10 subtle/moderate, analyst mb-01
//       moderate/dominant, momentum_chaser tv-01 dominant — five rungs) and
//       went green when the ratified re-authoring landed (same branch, next
//       commit) — the fail-then-green history is the mutation proof.
//
// Both rows judge through THE kernel (compositionEnforcement imports — never
// hand-copied predicates; the PR-3 review F5 lesson).

import { describe, it, expect } from 'vitest';
import { ARCHETYPE_DEFAULT_TRAITS, TRAIT_BY_ID } from './traitLibrary.js';
import { getCandidateCompatCell, RESERVED_ARCHETYPES } from './archetypeCompatibilityCandidate.js';
import { resolveNarrowedDomains, domainAdmits } from '../../api/_utils/compositionEnforcement.js';

const STRENGTHS = ['subtle', 'moderate', 'dominant'];

function eachHostedRule(fn) {
  for (const [archetype, traitIds] of Object.entries(ARCHETYPE_DEFAULT_TRAITS)) {
    if (RESERVED_ARCHETYPES.includes(archetype)) continue; // no candidate column (diversifier)
    for (const traitId of traitIds) {
      const trait = TRAIT_BY_ID[traitId];
      expect(trait, `${archetype} default set names unknown trait ${traitId}`).toBeTruthy();
      for (const ruleId of trait.ruleIds || []) {
        fn({ archetype, traitId, trait, ruleId, cell: getCandidateCompatCell(ruleId, archetype) });
      }
    }
  }
}

describe('default-trait composition invariants (B4-TRAIT)', () => {
  it('(a) no default trait hosts core_conflict or deferred for its OWN archetype', () => {
    const offenders = [];
    eachHostedRule(({ archetype, traitId, ruleId, cell }) => {
      if (cell && (cell.state === 'core_conflict' || cell.state === 'deferred')) {
        offenders.push(`${archetype}/${traitId}/${ruleId}: ${cell.state}`);
      }
    });
    expect(offenders).toEqual([]);
  });

  it('(b) every default trait ladder seeds IN-DOMAIN params at every strength (own-archetype narrowed domains)', () => {
    const offenders = [];
    eachHostedRule(({ archetype, traitId, trait, ruleId, cell }) => {
      if (!cell?.narrowedParams) return;
      for (const strength of STRENGTHS) {
        const seeds = trait.strengthProfiles?.[strength]?.[ruleId];
        if (!seeds || typeof seeds !== 'object') continue;
        const { domains, ambiguous } = resolveNarrowedDomains(cell.narrowedParams, Object.keys(seeds));
        if (ambiguous) {
          offenders.push(`${archetype}/${traitId}/${ruleId}@${strength}: ambiguous_domain_binding`);
          continue;
        }
        for (const [param, domain] of Object.entries(domains)) {
          if (!(param in seeds) || seeds[param] === null || seeds[param] === undefined) continue;
          if (!domainAdmits(domain, seeds[param])) {
            offenders.push(`${archetype}/${traitId}/${ruleId}@${strength}: ${param}=${JSON.stringify(seeds[param])} outside ${JSON.stringify(domain)}`);
          }
        }
      }
    });
    expect(offenders, 'a default trait ladder seeds an out-of-domain value — re-author the profile (never widen the domain, never clamp: founder ruling of record)').toEqual([]);
  });

  it('(b-monotone) the three re-authored ladders stay strictly monotone in their trait direction', () => {
    // The repair preserved each ladder's expressive direction; a future edit
    // that flattens or reverses a rung fails here, not in a founder review.
    const minutes = STRENGTHS.map((s) => TRAIT_BY_ID['trait-patient-holder'].strengthProfiles[s]['mb-01'].minutes);
    const fund = STRENGTHS.map((s) => TRAIT_BY_ID['trait-dual-conviction'].strengthProfiles[s]['tv-10'].fund_score);
    const stretched = STRENGTHS.map((s) => TRAIT_BY_ID['trait-trend-rider'].strengthProfiles[s]['tv-01'].stretched);
    expect(minutes[0]).toBeLessThan(minutes[1]);
    expect(minutes[1]).toBeLessThan(minutes[2]);       // patience RISES with strength
    expect(fund[0]).toBeLessThan(fund[1]);
    expect(fund[1]).toBeLessThan(fund[2]);             // the fundamental bar RISES with strength
    expect(stretched[0]).toBeGreaterThan(stretched[1]);
    expect(stretched[1]).toBeGreaterThan(stretched[2]); // late-extension caution TIGHTENS (falls) with strength
  });
});
