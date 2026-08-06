// Batch C5 — TIER_STRATEGY FAMILY (V1.2). Columns: momentum_chaser, contrarian, degen, guardian, analyst.
// (Diversifier WITHDRAWN — excluded.)

'ts-01': {
  momentum_chaser: { state: 'tension', rulingIds: ['R-68'], narrowedParams: null, advisory: 'the agent is instructed the cap limits multiplier exposure on unusually volatile names and never removes them from selection or ranking', displayReason: null, notes: [] },
  contrarian: { state: 'tension', rulingIds: ['R-103'], narrowedParams: null, advisory: 'the agent is instructed that dislocation and recovery determine what it owns, and the volatility cap limits only the multiplier carried by an unusually expanded name', displayReason: null, notes: [] },
  degen: { state: 'tension', rulingIds: ['R-69'], narrowedParams: null, advisory: 'the agent is instructed volatility remains its selection and ranking basis, and the cap governs only how much multiplier one expanded name carries', displayReason: null, notes: [] },
  guardian: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  analyst: { state: 'tension', rulingIds: ['R-85'], narrowedParams: null, advisory: 'the agent is instructed quality determines conviction, and the volatility cap adjusts exposure only within that quality-led ordering', displayReason: null, notes: [] },
},

'ts-02': {
  momentum_chaser: { state: 'native', rulingIds: ['R-70'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian: { state: 'tension', rulingIds: ['R-71'], narrowedParams: null, advisory: 'the agent is instructed the gate governs Star placement only, dislocated names remain fully selectable at lower tiers, and a name reclaiming VWAP on a confirmed turn becomes Star-eligible on its own merits', displayReason: null, notes: [] },
  degen: { state: 'tension', rulingIds: ['R-86'], narrowedParams: null, advisory: 'the agent is instructed realized volatility remains the primary tier-ranking axis, and the technical gate constrains placement without re-ranking its candidates', displayReason: null, notes: [] },
  guardian: { state: 'tension', rulingIds: ['R-87'], narrowedParams: null, advisory: 'the agent is instructed its volatility and quality screens govern how much exposure a name may carry, and the technical gate orders only names those screens have cleared', displayReason: null, notes: [] },
  analyst: { state: 'tension', rulingIds: ['R-72'], narrowedParams: null, advisory: 'the agent is instructed quality admission determines which names may hold Star, and the technical conditions time that placement among admitted names', displayReason: null, notes: [] },
},

'ts-03': {
  momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  degen: { state: 'tension', rulingIds: ['R-88'], narrowedParams: null, advisory: 'the agent is instructed realized volatility remains the primary tier-ranking axis, and the near-threshold restriction is a transient pause in placement rather than a re-ranking', displayReason: null, notes: [] },
  guardian: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  analyst: { state: 'tension', rulingIds: ['R-89'], narrowedParams: null, advisory: 'the agent is instructed quality determines conviction, and the near-threshold restriction adjusts exposure only within that ordering', displayReason: null, notes: [] },
},

'ts-04': {
  momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian: { state: 'tension', rulingIds: ['R-73'], narrowedParams: null, advisory: 'the agent is instructed dislocation and recovery evidence govern which names it holds, and velocity-driven tier swaps never change what it buys', displayReason: null, notes: [] },
  degen: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  guardian: { state: 'tension', rulingIds: ['R-90'], narrowedParams: null, advisory: 'the agent is instructed that tier reassignment on short-horizon performance changes exposure only, that no position leaves the book through this rule, and that its protective exits alone decide closures', displayReason: null, notes: [] },
  analyst: { state: 'tension', rulingIds: ['R-74'], narrowedParams: null, advisory: 'the agent is instructed its highest-conviction slot reflects its strongest quality thesis, and short-horizon performance never re-ranks that judgment', displayReason: null, notes: [] },
},

'ts-05': {
  momentum_chaser: { state: 'tension', rulingIds: ['R-75'], narrowedParams: { min: 75, max: 85 }, advisory: 'the agent is instructed extension in a confirmed trend is evidence of strength, and the demotion applies only at the stretched end of the range', displayReason: null, notes: [] },
  contrarian: { state: 'tension', rulingIds: ['R-104'], narrowedParams: null, advisory: 'the agent is instructed that overbought demotion is consistent with its posture, and that the replacement Star remains governed by dislocation and recovery evidence rather than current name strength', displayReason: null, notes: [] },
  degen: { state: 'tension', rulingIds: ['R-91'], narrowedParams: null, advisory: 'the agent is instructed a banked bonus does not end a live move, and realized volatility remains the primary tier-ranking axis', displayReason: null, notes: [] },
  guardian: { state: 'tension', rulingIds: ['R-76'], narrowedParams: { min: 75, max: 85 }, advisory: 'the agent is instructed multiplier reduction after a banked gain is a protective posture applied only at genuinely stretched readings, never a substitute for its risk-line exits', displayReason: null, notes: [] },
  analyst: { state: 'tension', rulingIds: ['R-92'], narrowedParams: null, advisory: 'the agent is instructed quality determines conviction, and the RSI trigger adjusts exposure only within that quality-led ordering', displayReason: null, notes: [] },
},

'ts-06': {
  momentum_chaser: { state: 'native', rulingIds: ['R-105'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian: { state: 'tension', rulingIds: ['R-93'], narrowedParams: null, advisory: 'the agent is instructed dislocation and recovery evidence govern which names it holds, and activity-driven tier promotion never changes what it buys', displayReason: null, notes: [] },
  degen: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  guardian: { state: 'tension', rulingIds: ['R-77'], narrowedParams: null, advisory: 'the agent is instructed a quiet holding is not a failing one, and any promoted replacement still faces its volatility and quality screens', displayReason: null, notes: [] },
  analyst: { state: 'tension', rulingIds: ['R-94'], narrowedParams: null, advisory: 'the agent is instructed quality determines conviction, and activity adjusts exposure only within that quality-led ordering', displayReason: null, notes: [] },
},

'ts-07': {
  momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian: { state: 'tension', rulingIds: ['R-106'], narrowedParams: null, advisory: 'the agent is instructed that the defined stop remains its thesis-failure line, and that threshold-based demotion is a temporary exposure adjustment that does not alter the recovery thesis', displayReason: null, notes: [] },
  degen: { state: 'tension', rulingIds: ['R-78'], narrowedParams: null, advisory: 'the agent is instructed its stop discipline alone governs risk, and reducing the multiplier on an adverse move is a defensive layer it does not otherwise apply', displayReason: null, notes: [] },
  guardian: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  analyst: { state: 'tension', rulingIds: ['R-95'], narrowedParams: null, advisory: 'the agent is instructed quality determines conviction, and threshold proximity adjusts exposure only within that quality-led ordering', displayReason: null, notes: [] },
},

'ts-08': {
  momentum_chaser: { state: 'native', rulingIds: ['R-107'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian: { state: 'tension', rulingIds: ['R-80'], narrowedParams: null, advisory: 'the agent is instructed a divergence print adjusts multiplier exposure only, and the dislocation and recovery thesis continues to govern whether the name is held', displayReason: null, notes: [] },
  degen: { state: 'tension', rulingIds: ['R-96'], narrowedParams: null, advisory: 'the agent is instructed realized volatility remains the primary tier-ranking axis, and a divergence print does not re-rank its conviction', displayReason: null, notes: [] },
  guardian: { state: 'tension', rulingIds: ['R-79'], narrowedParams: { allow: ['Core'] }, advisory: 'the agent is instructed a divergence print informs a single step of multiplier reduction, and its protective exits alone decide whether the position closes', displayReason: null, notes: [] },
  analyst: { state: 'tension', rulingIds: ['R-97'], narrowedParams: null, advisory: 'the agent is instructed quality determines conviction, and a divergence print adjusts exposure only within that quality-led ordering', displayReason: null, notes: [] },
},

'ts-09': {
  momentum_chaser: { state: 'tension', rulingIds: ['R-81'], narrowedParams: null, advisory: 'the agent is instructed the early restriction defers multiplier placement rather than changing selection, and trend evidence governs the promotion when the window ends', displayReason: null, notes: [] },
  contrarian: { state: 'tension', rulingIds: ['R-98'], narrowedParams: null, advisory: 'the agent is instructed dislocation and recovery evidence govern which names it holds, and early performance never changes what it buys', displayReason: null, notes: [] },
  degen: { state: 'tension', rulingIds: ['R-99'], narrowedParams: null, advisory: 'the agent is instructed realized volatility remains the primary tier-ranking axis, and the early cap defers rather than re-ranks', displayReason: null, notes: [] },
  guardian: { state: 'tension', rulingIds: ['R-100'], narrowedParams: null, advisory: 'the agent is instructed early restraint is consistent with its posture, and the post-window promotion remains subordinate to its quality, volatility and protection screens', displayReason: null, notes: [] },
  analyst: { state: 'tension', rulingIds: ['R-101'], narrowedParams: null, advisory: 'the agent is instructed quality determines conviction, and early performance adjusts exposure only within that quality-led ordering', displayReason: null, notes: [] },
},

'tv-12': {
  momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian: { state: 'tension', rulingIds: ['R-84'], narrowedParams: { min: 30, max: 40 }, advisory: 'the agent is instructed the factor count governs multiplier placement only, and dislocation and recovery evidence continue to govern what it holds', displayReason: null, notes: [] },
  degen: { state: 'tension', rulingIds: ['R-102'], narrowedParams: null, advisory: 'the agent is instructed realized volatility remains the primary tier-ranking axis, and the factor count orders only names that ranking has qualified', displayReason: null, notes: [] },
  guardian: { state: 'tension', rulingIds: ['R-82'], narrowedParams: null, advisory: 'the agent is instructed its volatility and quality screens govern how much exposure a name may carry, and the factor count orders only names those screens have cleared', displayReason: null, notes: [] },
  analyst: { state: 'tension', rulingIds: ['R-83'], narrowedParams: null, advisory: 'the agent is instructed quality admission determines which names may hold Star or Core, and the factor count orders only within that admitted set', displayReason: null, notes: [] },
},
