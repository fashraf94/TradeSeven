const C2_TECHNICAL_COMPATIBILITY = {

  // C2-1
  'tech-rsi-oversold': {
    momentum_chaser: { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'prioritizing sub-threshold RSI is weakness-buying, the kernel\'s core refusal; full domain (even 45 targets the weak half)', notes: [] },
    contrarian:       { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed quality admission precedes the reversal preference; oversold status never substitutes for the standard', displayReason: null, notes: [] },
  },

  // C2-2
  'tech-rsi-overbought': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-17'], narrowedParams: { strictMode: { allow: [false] }, threshold: { min: 70, max: 85 } }, advisory: 'the agent is instructed that chart extension is assessed through band-fit ranking, never excluded by an RSI ceiling', displayReason: null, notes: [] },
    contrarian:       { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:            { state: 'tension', rulingIds: ['R-18'], narrowedParams: { strictMode: { allow: [false] }, threshold: { min: 70, max: 85 } }, advisory: 'the agent is instructed the deprioritization is a late-extension caution, never an exclusion of live movers', displayReason: null, notes: [] },
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  // C2-3
  'tech-bollinger-squeeze': {
    momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:            { state: 'tension', rulingIds: ['R-30'], narrowedParams: null, advisory: 'the agent is instructed to pair the flag with realized expansion or volume evidence before entry weight', displayReason: null, notes: [] },
    guardian:         { state: 'tension', rulingIds: ['R-26'], narrowedParams: null, advisory: 'the agent is instructed the flag never outranks the volatility and downside screens', displayReason: null, notes: [] },
    analyst:          { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed that quality admission precedes the squeeze preference; compression status never substitutes for the standard', displayReason: null, notes: [] },
  },

  // C2-4
  'tech-moving-average-trend': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'tension', rulingIds: ['R-23'], narrowedParams: { period: { allow: [20, 50] }, requireAlignment: { allow: [false] } }, advisory: 'the agent is instructed the reclaim is turn confirmation, never a substitute for dislocation and the recovery thesis', displayReason: null, notes: [] },
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed quality admission remains the primary standard; the technical condition is timing discipline applied to qualified names', displayReason: null, notes: [] },
  },

  // C2-5
  'tech-macd-bullish': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'tension', rulingIds: ['R-19'], narrowedParams: { macdDirection: { allow: ['bullish crossover'] }, rsiFloor: { min: 40, max: 50 } }, advisory: 'the agent is instructed to treat the crossover as the kernel\'s own turn confirmation, subordinate to dislocation and recovery', displayReason: null, notes: [] },
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  // C2-6
  'tech-volume-surge': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  // C2-7
  'tech-relative-strength': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'a name-level RS requirement with an avoid-laggards clause inverts counter-indicative selection; laggards ARE the universe. Both domain values fire it', notes: [] },
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  // C2-8
  'tech-avoid-declining': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'tension', rulingIds: ['R-24'], narrowedParams: { period: { allow: [50] } }, advisory: null, displayReason: null, notes: [] }, // NO "Guidance (advisory)" sentence authored — see report §4
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed quality admission remains the primary standard; the technical condition is timing discipline applied to qualified names', displayReason: null, notes: [] },
  },

  // C2-9
  't-11': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'the floor clause excludes the weak-RS class wholesale; at floor=0 the gate vanishes but the preference still inverts selection — and R1-8 narrowing to {floor: 0} would leave a pure strength preference that remains the chase; conflict across the meaningful domain', notes: [] },
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the floor is instructed as a timing caution, never an admission verdict; paramBounds lean (non-binding): floor ≤ 8 keeps the veto shallow', displayReason: null, notes: [] }, // non-binding lean, NOT a binding narrowedParams
  },

  // C2-10
  't-12': {
    momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:            { state: 'tension', rulingIds: ['R-16'], narrowedParams: null, advisory: 'the agent is instructed the setup is a volatility-expansion bet whose holding period inside compression contradicts live-vol selection — pair with expansion confirmation', displayReason: null, notes: [] },
    guardian:         { state: 'tension', rulingIds: ['R-27'], narrowedParams: null, advisory: 'the agent is instructed the prioritization never outranks the volatility and downside screens', displayReason: null, notes: [] },
    analyst:          { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed quality admission precedes the compression preference; band width never substitutes for the standard', displayReason: null, notes: [] },
  },

  // C2-11
  't-13': {
    momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  // C2-12
  't-14': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'tension', rulingIds: ['R-15'], narrowedParams: null, advisory: 'the rule constrains if the agent ever acts on a breakout; it creates no pressure to seek them', displayReason: null, notes: [] },
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  // C2-13
  't-15': {
    momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:            { state: 'tension', rulingIds: ['R-31'], narrowedParams: null, advisory: 'the agent is instructed the flag is an expansion bet — pair with realized movement before entry weight', displayReason: null, notes: [] },
    guardian:         { state: 'tension', rulingIds: ['R-28'], narrowedParams: null, advisory: 'the agent is instructed the NR7 flag never outranks the volatility and downside screens', displayReason: null, notes: [] },
    analyst:          { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed quality admission precedes the compression preference; a technical score never substitutes for the standard', displayReason: null, notes: [] }, // + separate non-binding lean: score ≥ 70
  },

  // C2-14
  't-16': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'tension', rulingIds: ['R-25'], narrowedParams: { count: { allow: ['2of3'] } }, advisory: 'the agent is instructed the confluence confirms an early turn and never substitutes for dislocation or the recovery thesis', displayReason: null, notes: [] },
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed quality admission remains the primary standard; the technical condition is timing discipline applied to qualified names', displayReason: null, notes: [] },
  },

  // C2-15
  'tv-01': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-33'], narrowedParams: { stretched: { min: 75, max: 85 } }, advisory: 'the agent is instructed the band is a late-extension caution inside a strength preference', displayReason: null, notes: [] },
    contrarian:       { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'the weak-leg deprioritization inverts washout selection at every setting', notes: [] },
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed quality admission precedes the momentum-zone preference; an RSI band never substitutes for the standard', displayReason: null, notes: [] },
  },

  // C2-16
  'tv-02': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'favor-growing-histogram is name-level momentum preference; the deceleration response then exits on fading strength — chase in, chase out', notes: [] },
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'tension', rulingIds: ['R-22'], narrowedParams: { action: { allow: ['hold but monitor'] } }, advisory: 'the agent is instructed that histogram deceleration informs observation; the protective exits alone decide action', displayReason: null, notes: [] },
    analyst:          { state: 'tension', rulingIds: ['R-21'], narrowedParams: { action: { allow: ['reduce tier', 'hold but monitor'] } }, advisory: 'the agent is instructed chart deceleration is never a thesis verdict', displayReason: null, notes: [] },
  },

  // C2-17
  'tv-03': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: '"the pullback in a confirmed uptrend is a buying opportunity" is chase doctrine stated outright; stronger than C2-4\'s gate, which at least only filters', notes: [] },
    degen:            { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'patience is instructed to yield to the vol-decay exit discipline; paramBounds lean (non-binding): minutes ≤ 120', displayReason: null, notes: [] }, // minutes ≤ 120 is a non-binding lean, not a narrowed domain
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  },

  // C2-18
  'tv-05': {
    momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'tension', rulingIds: ['R-20'], narrowedParams: { direction: { allow: ['turning positive'] } }, advisory: 'the agent is instructed to treat "turning positive" as the kernel\'s own stabilization evidence', displayReason: null, notes: [] },
    degen:            { state: 'tension', rulingIds: ['R-32'], narrowedParams: null, advisory: 'the agent is instructed to require realized expansion or volume evidence before entry weight; direction confirmation alone is not movement', displayReason: null, notes: [] },
    guardian:         { state: 'tension', rulingIds: ['R-29'], narrowedParams: null, advisory: null, displayReason: null, notes: [] }, // NO "Guidance (advisory)" sentence authored (prose: "flag-not-mandate") — see report §4
    analyst:          { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed quality admission precedes the squeeze preference; compression status never substitutes for the standard', displayReason: null, notes: [] },
  },

  // C2-19
  'tv-06': {
    momentum_chaser: { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'bottom-fishing at the lower band is weakness-buying across the domain', notes: [] },
    contrarian:       { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed quality admission precedes the reversion preference; band position never substitutes for the standard', displayReason: null, notes: [] },
  },

  // C2-20
  'tv-11': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'preferring names at their highs is the inverse of the universe', notes: [] },
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:          { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed quality admission precedes the proximity preference; price-level momentum never substitutes for the standard', displayReason: null, notes: [] },
  },

  // C2-21
  'tv-13': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:       { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'spike-chasing the leading movers', notes: [] },
    degen:            { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:         { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'the template\'s "overrides other technical signals" plus a Star-minimum lets tape outrank the quality and volatility layers and set the book\'s core; override language is the CP conflict rule\'s named trigger. Full domain (the Core arm still installs the override)', notes: [] },
    analyst:          { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'same override mechanism against the FI ordering: tape sets the core with zero quality input', notes: [] },
  },

};
