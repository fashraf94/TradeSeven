const C4_ALLOCATION = {

  'alloc-sector-cap': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-61'], narrowedParams: { min: 40, max: 80 }, advisory: 'the agent is instructed that the cap limits how much a leading sector may hold, not whether leading sectors are preferred.', displayReason: null, notes: ['equal_weight_scope'] },
    contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:        { state: 'native',  rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  'alloc-sector-minimum': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-50'], narrowedParams: { allow: [10] }, advisory: 'the agent is instructed that the sector floor is a minimum obligation, and that within and beyond it, selection follows sector and name strength.', displayReason: null, notes: ['equal_weight_scope'] },
    contrarian:      { state: 'tension', rulingIds: ['R-62'], narrowedParams: null, advisory: 'the agent is instructed that the sector floor never lowers its dislocation and recovery requirements; if no name in the sector qualifies, the floor goes unmet.', displayReason: null, notes: [] },
    degen:           { state: 'tension', rulingIds: ['R-51'], narrowedParams: null, advisory: 'the agent is instructed that the sector obligation is a minimum, and realized volatility ranking governs which names fill it and everything beyond it.', displayReason: null, notes: [] },
    guardian:        { state: 'tension', rulingIds: ['R-52'], narrowedParams: { min: 10, max: 30 }, advisory: 'the agent is instructed that the sector floor never overrides its spread and concentration protections; where they conflict, the protective limit governs.', displayReason: null, notes: ['equal_weight_scope'] },
    analyst:         { state: 'tension', rulingIds: ['R-53'], narrowedParams: null, advisory: 'the agent is instructed that the quality admission standard is never lowered to satisfy a sector floor; if no name in the sector qualifies, the floor goes unmet.', displayReason: null, notes: [] },
  },

  'alloc-tier-preference': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-54'], narrowedParams: { allow: ['high momentum', 'high RS', 'high volume'] }, advisory: 'the agent is instructed that the Star slot expresses its highest-conviction trend evidence.', displayReason: null, notes: [] },
    contrarian:      { state: 'tension', rulingIds: ['R-2'],  narrowedParams: { allow: ['undervalued'] }, advisory: 'the agent is instructed that valuation identifies the candidate pool, and that dislocation and recovery evidence still decide the Star pick within it.', displayReason: null, notes: [] },
    degen:           { state: 'tension', rulingIds: ['R-55'], narrowedParams: { allow: ['high momentum', 'high RS', 'high volume'] }, advisory: 'the agent is instructed that volatility governs the Star pick within the admitted attributes.', displayReason: null, notes: [] },
    guardian:        { state: 'tension', rulingIds: ['R-56'], narrowedParams: null, advisory: 'the agent is instructed that Star placement never widens its protective limits, and that a name failing its volatility or quality screens is not eligible for the slot regardless of attribute rank.', displayReason: null, notes: [] },
    analyst:         { state: 'tension', rulingIds: ['R-57'], narrowedParams: { allow: ['undervalued', 'positive earnings surprise'] }, advisory: 'the agent is instructed that quality admission precedes Star selection and the attribute orders only qualified names.', displayReason: null, notes: [] },
  },

  'alloc-even-spread': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-48'], narrowedParams: { allow: ['light', 'moderate'] }, advisory: 'the agent is instructed that even distribution is a preference applied among sectors it has already ranked by strength.', displayReason: null, notes: [] },
    contrarian:      { state: 'tension', rulingIds: ['R-63'], narrowedParams: { allow: ['light', 'moderate'] }, advisory: 'the agent is instructed to apply the distribution preference only after its dislocation and recovery criteria have ranked the candidates.', displayReason: null, notes: [] },
    degen:           { state: 'tension', rulingIds: ['R-64'], narrowedParams: { allow: ['light', 'moderate'] }, advisory: 'the agent is instructed to apply the distribution preference only after volatility ranking has ordered the candidates.', displayReason: null, notes: [] },
    guardian:        { state: 'native',  rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'tension', rulingIds: ['R-65'], narrowedParams: { allow: ['light', 'moderate'] }, advisory: 'the agent is instructed that quality admission precedes distribution, and an unfilled sector is preferable to a below-standard name.', displayReason: null, notes: [] },
  },

  'a-05': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-42'], narrowedParams: null, advisory: 'the agent is instructed to fill the anchor slots with the strongest names available within the low-volatility band rather than treating the band as the selection reason.', displayReason: null, notes: [] },
    contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'core_conflict', rulingIds: ['R-43'], narrowedParams: null, advisory: null, displayReason: 'anchors min=1 is un-zeroable, so every in-domain setting requires low-volatility holdings as a selection criterion — the SP kernel\'s named conflict, not a preference; no narrowing exists.', notes: [] },
    guardian:        { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'rockets min=1 mandates at least one high-ATR holding at every setting; the volatility refusal admits no narrowing.', notes: [] },
    analyst:         { state: 'tension', rulingIds: ['R-44'], narrowedParams: null, advisory: 'the agent is instructed that quality admission applies to every slot including the barbell legs, and that a volatility bucket is a shape target, never an admission basis.', displayReason: null, notes: [] },
  },

  'a-06': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'an absolute RS floor excludes the laggard universe wholesale at every setting; the tier gate compounds it.', notes: [] },
    degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:        { state: 'tension', rulingIds: ['R-45'], narrowedParams: null, advisory: 'the agent is instructed that its protective screens govern tier eligibility, and relative strength orders only names that already pass them.', displayReason: null, notes: [] },
    analyst:         { state: 'tension', rulingIds: ['R-46'], narrowedParams: null, advisory: 'the agent is instructed that quality admission determines which names may hold Star or Core, and relative strength orders only within that admitted set.', displayReason: null, notes: [] },
  },

  'a-07': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-47'], narrowedParams: null, advisory: 'the agent is instructed to fill the quality-floor slots with the strongest trending names that clear the floor, and that the cap on growth names limits count, never the trend basis of selection.', displayReason: null, notes: [] },
    contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'a mandated minimum cohort clearing a fundamental floor (up to 90/100) is quality as a requirement determining book composition — the R-41 gate line; the growth ceiling independently caps the volatility cohort; no narrowing.', notes: [] },
    guardian:        { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  'a-08': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-66'], narrowedParams: null, advisory: 'the agent is instructed that actual sector and name trend evidence governs, and sentiment may tilt only among sectors that evidence already supports.', displayReason: null, notes: [] },
    contrarian:      { state: 'tension', rulingIds: ['R-3'], narrowedParams: null, advisory: 'the agent is instructed that within favored sectors, name selection remains dislocation-led.', displayReason: null, notes: [] },
    degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  'a-09': {
    momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:        { state: 'tension', rulingIds: ['R-58'], narrowedParams: null, advisory: 'the agent is instructed that bench candidates face its volatility and quality screens before promotion, and that a bench slot is not a commitment to swap.', displayReason: null, notes: [] },
    analyst:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  'tv-14': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'core_conflict', rulingIds: ['R-3'], narrowedParams: null, advisory: null, displayReason: '\'select the leading stock\' is name-level chase; unlike a-08\'s sector-only tilt, this rule reaches into name selection, which is the kernel\'s core refusal.', notes: [] },
    degen:           { state: 'tension', rulingIds: ['R-67'], narrowedParams: null, advisory: 'the agent is instructed that relative strength may order only names its volatility ranking has already qualified.', displayReason: null, notes: [] },
    guardian:        { state: 'tension', rulingIds: ['R-59'], narrowedParams: null, advisory: 'the agent is instructed that sector rotation adjusts new allocation rather than forcing exits, and that existing positions leave only through its protective exits.', displayReason: null, notes: [] },
    analyst:         { state: 'tension', rulingIds: ['R-60'], narrowedParams: null, advisory: 'the agent is instructed that quality admission precedes name selection within a favored sector, and relative strength orders only admitted names.', displayReason: null, notes: [] },
  },

};
