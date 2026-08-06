const C1_RISK_CELLS = {

  'risk-sector-diversification': {
    momentum_chaser: { state: 'tension', rulingIds: [], narrowedParams: { n: { allow: [2, 3] } }, advisory: 'the agent is instructed the spread floor never outranks leading-sector selection within it.', displayReason: null, notes: [] },
    contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:        { state: 'native',  rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  'risk-exit-atr-stop': {
    momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'native',  rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] }, // prose references R-7 as reasoning-ancestry only — excluded
    guardian:        { state: 'native',  rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] }, // prose references R-8 as reasoning-ancestry only — excluded
    analyst:         { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed the stop is capital protection, not a thesis verdict — an exited name whose quality case is intact remains a re-entry candidate.', displayReason: null, notes: [] },
  },

  'risk-avoid-declining-trend': {
    momentum_chaser: { state: 'native',  rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'tension', rulingIds: [], narrowedParams: { period: { allow: [50] } }, advisory: 'the agent is instructed the rule narrows entries to reclaim-confirmed turns; dislocation and recovery evidence still govern selection among them, and the kernel\'s broader turn evidence (divergence, basing) remains valid analysis even where this rule withholds entry.', displayReason: null, notes: [] },
    degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed quality admission remains the primary standard; the trend condition is timing discipline applied to qualified names.', displayReason: null, notes: [] },
  },

  'r-06': {
    momentum_chaser: { state: 'tension', rulingIds: [], narrowedParams: { max: { allow: [2, 3] } }, advisory: 'the agent is instructed the spread floor never outranks leading-sector selection within it.', displayReason: null, notes: [] }, // "Guidance as C1-1" — copied verbatim from risk-sector-diversification/momentum_chaser
    contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:        { state: 'native',  rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  'r-07': {
    momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  'r-08': {
    momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'tension', rulingIds: [], narrowedParams: { anchors: { allow: [1, 2] } }, advisory: 'the agent is instructed volatility selection governs within the barbell\'s shape.', displayReason: null, notes: [] },
    guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] }, // R1-F6 DOWNGRADED from stored native (finding id, not a ruling)
    analyst:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  'r-09': {
    momentum_chaser: { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed the defensive window is temporary and strength-ranking resumes on recovery.', displayReason: null, notes: [] },
    contrarian:      { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed the defensive window is temporary and strength-ranking resumes on recovery.', displayReason: null, notes: [] }, // "Guidance as above" — copied verbatim from r-09/momentum_chaser
    degen:           { state: 'core_conflict', rulingIds: ['R-14'], narrowedParams: null, advisory: null, displayReason: '"new swaps low-ATR only" is an eligibility gate requiring low-volatility candidates, and the SP rubric expressly makes low-volatility-as-selection-criterion a core conflict; temporary activation does not change the mechanism and no trigger depth reconciles it.', notes: [] },
    guardian:        { state: 'native',  rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'quality admission remains primary within the restricted set; the window is temporary.', displayReason: null, notes: [] },
  },

  'r-11': {
    momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  'r-12': {
    momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'tension', rulingIds: ['R-13'], narrowedParams: { sentiment: { allow: ['bearish'] } }, advisory: 'recently-washed sectors whose sentiment recovered to neutral are prime hunting grounds this rule still admits; the excluded freshest-washout zone is the honest cost, stated.', displayReason: null, notes: [] }, // R-11 cited as reasoning ancestry only — excluded
    degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

};
