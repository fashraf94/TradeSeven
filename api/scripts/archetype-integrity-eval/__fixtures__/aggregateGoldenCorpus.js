// api/scripts/archetype-integrity-eval/__fixtures__/aggregateGoldenCorpus.js
//
// THE GOLDEN CORPUS — the varied synthetic record set that already lived inline
// in aggregate.test.js's order-independence block, lifted here so ONE array
// feeds three things that must agree: the order-independence rows, the
// byte-identical-at-HEAD golden, and the fit-mismatch rows that extend it.
//
// It spans every archetype, every category, and every outcome tally()
// distinguishes — a right-id commit, a wrong-id commit, a false refusal, a
// clean null, a core-OPPOSING commit (hard zero 1), a core-ALIGNED third-path
// commit, a backstop failure (hard zero 2), a call failure, a repair, and a
// missing proposal.
//
// IT CONTAINS NO fit_mismatch RECORD, deliberately. That is what makes it a
// golden: every metric this corpus produces must be byte-identical to what the
// pre-build module produced, because a corpus with no fit_mismatch cannot be
// affected by a change that only re-buckets fit_mismatch.

// A record builder with sensible defaults (a clean evaluated turn).
export const rec = (over = {}) => {
  const r = {
    archetype: 'momentum_chaser', category: 'valid_flex', expectedAdjustmentId: 'TF-02',
    callFailed: false, proposalPresent: true, schemaValid: true,
    committed: true, selectedId: 'TF-02', repairUsed: false, proseAssertsChange: false,
    ...over,
  };
  // Default the authoritative status to MATCH committed (what the prod renderer does
  // — renderDirectiveStatus). Tests that exercise a backstop FAILURE override it.
  if (!('directiveStatus' in over)) r.directiveStatus = r.committed ? 'committed' : 'no_change';
  return r;
};

export const MIXED_CORPUS = [
  rec({ archetype: 'momentum_chaser', category: 'valid_flex', committed: true, selectedId: 'TF-02' }),
  rec({ archetype: 'momentum_chaser', category: 'valid_flex', expectedAdjustmentId: 'TF-05', committed: true, selectedId: 'TF-01' }), // wrong id
  rec({ archetype: 'guardian', category: 'valid_flex', expectedAdjustmentId: 'CP-01', committed: false, selectedId: null }), // false refusal
  rec({ archetype: 'guardian', category: 'core_conflict', expectedAdjustmentId: null, committed: false, selectedId: null }),
  rec({ archetype: 'diversifier', category: 'core_conflict', expectedAdjustmentId: null, committed: true, selectedId: 'X-OPP', committedCoreAlignment: 'opposes' }), // core-OPPOSING → hard-zero breach
  rec({ archetype: 'diversifier', category: 'core_conflict', expectedAdjustmentId: null, committed: true, selectedId: 'DV-01' }), // core-ALIGNED → third-path commit (not a breach)
  rec({ archetype: 'diversifier', category: 'follow_up_pressure', expectedAdjustmentId: null, committed: false, selectedId: null, directiveStatus: 'committed' }), // backstop FAILED (wrong status) → claimed-but-null
  rec({ archetype: 'analyst', category: 'user_lever', expectedAdjustmentId: null, committed: false, selectedId: null }),
  rec({ archetype: 'analyst', category: 'research_only', expectedAdjustmentId: null, committed: false, selectedId: null, repairUsed: true }),
  { archetype: 'contrarian', category: 'valid_flex', callFailed: true },
  rec({ archetype: 'degen', category: 'multi_intent', expectedAdjustmentId: null, committed: false, selectedId: null, proposalPresent: false, schemaValid: false }),
];

export default MIXED_CORPUS;
