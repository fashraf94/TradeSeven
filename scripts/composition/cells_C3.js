// Batch C3 — FUNDAMENTAL FAMILY (V1.2). Columns fixed: momentum_chaser, contrarian, degen, guardian, analyst.
// Diversifier WITHDRAWN/held — excluded (not a column). 7 rule-slots × 5 = 35 coords; 29 authored + 6 deferred.
const C3_FUNDAMENTAL = {

  // C3-1 · fund-revenue-growth — prefer revenue growth above {pct}% (5–30)
  'fund-revenue-growth': {
    momentum_chaser: { state: 'neutral', rulingIds: ['R-4'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'neutral', rulingIds: [],       narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'tension', rulingIds: ['R-34'], narrowedParams: null, advisory: 'the agent is instructed to preserve volatility as the ranking basis; the growth preference may be considered only after volatility-qualified candidates are otherwise indistinguishable.', displayReason: null, notes: [] },
    guardian:        { state: 'neutral', rulingIds: [],       narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'native',  rulingIds: [],       narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  // C3-2 · fund-value-pe — prefer P/E below {level} (sector median / 20 / 15)
  'fund-value-pe': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-4'],  narrowedParams: null, advisory: 'the agent is instructed to apply the discount preference only among names already satisfying its trend criteria, and not to use the discount preference to admit a below-trend name.', displayReason: null, notes: [] },
    contrarian:      { state: 'native',  rulingIds: ['R-2'],  narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'tension', rulingIds: ['R-34'], narrowedParams: null, advisory: 'the agent is instructed to preserve volatility as the ranking basis; the valuation preference may be considered only after volatility-qualified candidates are otherwise indistinguishable.', displayReason: null, notes: [] },
    guardian:        { state: 'neutral', rulingIds: [],       narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'neutral', rulingIds: [],       narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  // C3-3 · fund-bank-pb — use P/B for banks; flag above {threshold} (1–3)
  'fund-bank-pb': {
    momentum_chaser: { state: 'neutral', rulingIds: [],       narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'neutral', rulingIds: [],       narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'tension', rulingIds: ['R-34'], narrowedParams: null, advisory: 'the agent is instructed to preserve volatility as the ranking basis; the bank-valuation preference may be considered only after volatility-qualified financials are otherwise indistinguishable.', displayReason: null, notes: [] },
    guardian:        { state: 'neutral', rulingIds: [],       narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'native',  rulingIds: [],       narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  // C3-4 · fund-market-cap — prefer {size} cap stocks (large / mid / small). All five stored cells were fallthrough.
  'fund-market-cap': {
    momentum_chaser: { state: 'neutral', rulingIds: [],               narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'neutral', rulingIds: [],               narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'tension', rulingIds: ['R-39'], narrowedParams: null, advisory: 'the agent is instructed to preserve volatility as the ranking basis; the size preference may be considered only after volatility-qualified candidates are otherwise indistinguishable.', displayReason: null, notes: [] }, // R-39 = verdict-carrier; R-34 cited only as "does not reach"; non-binding paramBounds lean (small,mid) NOT encoded
    guardian:        { state: 'neutral', rulingIds: [],               narrowedParams: null, advisory: null, displayReason: null, notes: [] }, // R1-F6: V1.0 tension WITHDRAWN
    analyst:         { state: 'neutral', rulingIds: [],               narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  // C3-5 · f-07 — prioritize beat rate ≥{beat_pct}% (50–100) + surprise magnitude {decile}
  'f-07': {
    momentum_chaser: { state: 'neutral', rulingIds: [],       narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'neutral', rulingIds: [],       narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'tension', rulingIds: ['R-35'], narrowedParams: null, advisory: 'the agent is instructed to preserve volatility as the ranking basis; the earnings-surprise preference may be considered only after volatility-qualified candidates are otherwise indistinguishable.', displayReason: null, notes: [] },
    guardian:        { state: 'neutral', rulingIds: [],       narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'native',  rulingIds: [],       narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  // C3-6 · f-12 — DEFERRED, NOT AUTHORED (R1-F1). All five cells withdrawn (inert `days` param). R-36 deferred/uncitable (maps to contrarian).
  'f-12': {
    momentum_chaser: { state: 'deferred', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'deferred', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] }, // assoc. R-36 — DEFERRED, UNCITABLE
    degen:           { state: 'deferred', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:        { state: 'deferred', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'deferred', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  // C3-7 · tv-10 — Star/Core tier requires fund ≥{fund_score} (40–85) AND tech ≥{tech_score} (40–80)
  'tv-10': {
    momentum_chaser: { state: 'tension',       rulingIds: ['R-37'],        narrowedParams: { fund_score: { min: 40, max: 55 } }, advisory: 'the agent is instructed that trend and momentum evidence governs tier placement and the fundamental floor operates only as a minimum sanity check, never as the ranking basis.', displayReason: null, notes: [] },
    contrarian:      { state: 'deferred',      rulingIds: [],              narrowedParams: null, advisory: null, displayReason: null, notes: [] }, // R2-F2; assoc. R-40 — DEFERRED, UNCITABLE (unverified technicalScore)
    degen:           { state: 'core_conflict', rulingIds: ['R-41'], narrowedParams: null, advisory: null, displayReason: 'a fundamental-score floor conditions tier eligibility, so company quality determines exposure — the SP kernel\'s named conflict (quality as a requirement), which R-34\'s preference doctrine does not reach.', notes: [] }, // R-41 = verdict-carrier; R-34 cited only as "does not reach"
    guardian:        { state: 'neutral',       rulingIds: [],              narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'tension',       rulingIds: ['R-38'],        narrowedParams: { fund_score: { min: 71, max: 85 } }, advisory: 'the agent is instructed the fundamental floor is the admission standard and the technical leg times entry within it — never the reverse.', displayReason: null, notes: [] },
  },

};
