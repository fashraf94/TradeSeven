// ============ PART 1 · GAME_STATE (8 rules) ============

'gs-01': { // EARLY-phase swap freeze (release: per-name drop {atr})
  momentum_chaser: { state: 'tension', rulingIds: ['R-155'], narrowedParams: null, advisory: null, displayReason: null, notes: [] }, // advisory inherited from C7 V1.0, not quoted here
  contrarian:      { state: 'tension', rulingIds: ['R-195'], narrowedParams: null, advisory: '…the early freeze suppresses ordinary churn, and a thesis completed by the crowd\'s return is exited the moment the phase ends.', displayReason: null, notes: ['c21_discretionary'] },
  degen:           { state: 'tension', rulingIds: ['R-156'], narrowedParams: null, advisory: null, displayReason: null, notes: [] }, // V1.0 advisory, not quoted here
  guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['c21_discretionary'] },
  analyst:         { state: 'tension', rulingIds: ['R-196'], narrowedParams: null, advisory: '…the freeze defers rotation, and a clear quality upgrade is acted on when the phase ends.', displayReason: null, notes: [] },
},

'gs-02': { // phase-scaled stop ×{early}/{mid}/{late}/{final} — PROSE-ONLY
  momentum_chaser: { state: 'tension', rulingIds: ['R-157'], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] }, // R-157 amended, bound withdrawn (F4); V1.0 advisory not quoted
  contrarian:      { state: 'tension', rulingIds: ['R-158'], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] }, // R-158 amended, bound withdrawn (F4)
  degen:           { state: 'core_conflict', rulingIds: ['R-193'], narrowedParams: null, advisory: null, displayReason: 'The unconditional EARLY clock-multiplier (1.5–3×) widens the stop on losers by the clock — the core refusal (never widen the stop to stay in a loser) fires on the first conflicting arm; the later tightening does not cure it.', notes: ['prose_only'] },
  guardian:        { state: 'tension', rulingIds: ['R-159'], narrowedParams: { minOnly: 1.0 }, advisory: null, displayReason: null, notes: ['prose_only'] }, // {final ≥ 1.0} survives as sign-based (F4); V1.0 advisory not quoted
  analyst:         { state: 'tension', rulingIds: ['R-194'], narrowedParams: null, advisory: '…a clock-scaled stop changes tolerance only, and the business case remains the sole basis for a thesis exit.', displayReason: null, notes: ['prose_only'] },
},

'gs-03': { // hurdle −{pct}% per phase transition — prose-only
  momentum_chaser: { state: 'tension', rulingIds: ['R-197'], narrowedParams: null, advisory: '…its confirmation requirement does not fall at phase transitions; a reduced hurdle changes urgency, not evidence.', displayReason: null, notes: ['prose_only'] },
  contrarian:      { state: 'tension', rulingIds: ['R-198'], narrowedParams: null, advisory: '…a decaying hurdle never substitutes for a recovery thesis.', displayReason: null, notes: ['prose_only'] },
  degen:           { state: 'native', rulingIds: ['R-199'], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] },
  guardian:        { state: 'tension', rulingIds: ['R-160'], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] }, // R-160 amended, no narrowing (F4)
  analyst:         { state: 'tension', rulingIds: ['R-161'], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] }, // R-161 amended, no narrowing (F4)
},

'gs-07': { // offensive-swap lock at +{ceiling} pts (Crash exception)
  momentum_chaser: { state: 'tension', rulingIds: ['R-162'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian:      { state: 'tension', rulingIds: ['R-200'], narrowedParams: null, advisory: '…the lead lock defers activity, and a thesis completed by the crowd\'s return is exited when it lifts.', displayReason: null, notes: [] },
  degen:           { state: 'tension', rulingIds: ['R-163'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  guardian:        { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] }, // stored native
  analyst:         { state: 'tension', rulingIds: ['R-164'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
},

'gs-08': { // hurdle ×{mult} after {thresholds} banked — prose-only
  momentum_chaser: { state: 'tension', rulingIds: ['R-165'], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] },
  contrarian:      { state: 'tension', rulingIds: ['R-201'], narrowedParams: null, advisory: '…a scoring streak is not a reason to hold past the crowd\'s return.', displayReason: null, notes: ['prose_only'] },
  degen:           { state: 'tension', rulingIds: ['R-202'], narrowedParams: null, advisory: '…a hot book does not slow its rotation; a decayed move is rotated regardless of the streak.', displayReason: null, notes: ['prose_only'] },
  guardian:        { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] }, // stored native
  analyst:         { state: 'tension', rulingIds: ['R-166'], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] },
},

'gs-09': { // force-eject worst performer after {cycles} negative cycles
  momentum_chaser: { state: 'tension', rulingIds: ['R-203'], narrowedParams: null, advisory: '…a portfolio losing streak is not the two-leg test; a position with chart and sector intact is not ejected on the streak.', displayReason: null, notes: [] },
  contrarian:      { state: 'core_conflict', rulingIds: ['R-167'], narrowedParams: null, advisory: null, displayReason: 'A portfolio-streak trigger overrides the name-level stop and ejects the freshest dislocation before its pre-declared line — a mandated pre-stop exit.', notes: ['c21_discretionary'] },
  degen:           { state: 'tension', rulingIds: ['R-204'], narrowedParams: null, advisory: '…its survival floor and movement-death discipline alone govern exits; a portfolio streak prompts review, not ejection.', displayReason: null, notes: [] },
  guardian:        { state: 'tension', rulingIds: ['R-168'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  analyst:         { state: 'tension', rulingIds: ['R-169'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
},

'gs-10': { // prohibit swap-in above +{atr} intraday
  momentum_chaser: { state: 'tension', rulingIds: ['R-170'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian:      { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] }, // stored native
  degen:           { state: 'tension', rulingIds: ['R-171'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  guardian:        { state: 'native', rulingIds: ['R-205'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  analyst:         { state: 'native', rulingIds: ['R-206'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
},

'gs-12': { // endgame hold within {pct}% of a threshold, "regardless of other signals"
  momentum_chaser: { state: 'tension', rulingIds: ['R-172'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian:      { state: 'tension', rulingIds: ['R-207'], narrowedParams: null, advisory: '…the endgame hold pursues a threshold, and the crowd\'s return remains its exit signal.', displayReason: null, notes: [] },
  degen:           { state: 'tension', rulingIds: ['R-208'], narrowedParams: null, advisory: '…a decayed move is rotated even inside the endgame window.', displayReason: null, notes: [] },
  guardian:        { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'Instructs disregarding all discretionary protect-first evidence in favor of score — the additional refusal the identity forbids.', notes: [] }, // stored, ratified
  analyst:         { state: 'tension', rulingIds: ['R-173'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
},

// ============ PART 2 · THRESHOLD (8 rules) ============

'th-01': { // post-threshold trail {atr}×{mult} until {drawdown} — 3-axis domain
  momentum_chaser: { state: 'tension', rulingIds: ['R-209'], narrowedParams: null, advisory: '…the trail protects a banked gain and must not exit a position whose chart and sector evidence both hold.', displayReason: null, notes: [] },
  contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  degen:           { state: 'tension', rulingIds: ['R-210'], narrowedParams: null, advisory: '…the trail sits outside the ride\'s ordinary swing; a banked threshold does not end a live move.', displayReason: null, notes: [] },
  guardian:        { state: 'tension', rulingIds: ['R-174'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  analyst:         { state: 'tension', rulingIds: ['R-211'], narrowedParams: null, advisory: '…the trail protects gains and never substitutes for the business case.', displayReason: null, notes: [] },
},

'th-04': { // widen trail +{atr} after {threshold} — PROSE-ONLY
  momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] },
  contrarian:      { state: 'tension', rulingIds: ['R-177'], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] },
  degen:           { state: 'native', rulingIds: ['R-175'], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] }, // RATIFIED
  guardian:        { state: 'tension', rulingIds: ['R-6'], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] }, // cites R-6, rationale amended
  analyst:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] }, // stored
},

'th-05': { // tighten trail to {atr} after a threshold, {tier} scope — PROSE-ONLY
  momentum_chaser: { state: 'tension', rulingIds: ['R-178'], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] }, // R-178 amended, bound withdrawn (F4)
  contrarian:      { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] }, // stored native
  degen:           { state: 'tension', rulingIds: ['R-7'], narrowedParams: { min: 0.25, max: 0.4 }, advisory: null, displayReason: null, notes: ['prose_only'] }, // {atr ∈ [0.25,0.4]}
  guardian:        { state: 'tension', rulingIds: ['R-8'], narrowedParams: { min: 0.2, max: 0.4 }, advisory: null, displayReason: null, notes: ['prose_only'] }, // {atr ∈ [0.2,0.4]}
  analyst:         { state: 'tension', rulingIds: ['R-181'], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] },
},

'th-07': { // weight negative-threshold proximity ×{mult} in exits
  momentum_chaser: { state: 'tension', rulingIds: ['R-212'], narrowedParams: null, advisory: '…threshold proximity informs urgency and never overrides the two-leg holding judgment.', displayReason: null, notes: [] },
  contrarian:      { state: 'tension', rulingIds: ['R-213'], narrowedParams: null, advisory: '…its pre-declared stop remains the only line that ends the thesis; threshold weighting never advances an exit ahead of it.', displayReason: null, notes: [] },
  degen:           { state: 'tension', rulingIds: ['R-214'], narrowedParams: null, advisory: '…its stop discipline alone governs risk; scoring proximity is not a volatility judgment.', displayReason: null, notes: [] },
  guardian:        { state: 'native', rulingIds: ['R-182'], narrowedParams: null, advisory: null, displayReason: null, notes: [] }, // RATIFIED
  analyst:         { state: 'tension', rulingIds: ['R-215'], narrowedParams: null, advisory: '…the business case decides exits; scoring proximity adjusts timing only.', displayReason: null, notes: [] },
},

'th-08': { // release the hold when near-threshold + stalled {minutes}
  momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  guardian:        { state: 'tension', rulingIds: ['R-183'], narrowedParams: null, advisory: null, displayReason: null, notes: [] }, // R-183 amended, no narrowing (F4)
  analyst:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
},

'th-09': { // exempt {exempt_tiers} from hard-breach ejection
  momentum_chaser: { state: 'tension', rulingIds: ['R-184'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  degen:           { state: 'tension', rulingIds: ['R-216'], narrowedParams: null, advisory: '…a tier exemption defers a discretionary ejection, and a decayed move is still rotated.', displayReason: null, notes: [] },
  guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['c21_discretionary'] },
  analyst:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
},

'th-10': { // posture: Harvest / Hunt / Balanced
  momentum_chaser: { state: 'tension', rulingIds: ['R-185'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian:      { state: 'tension', rulingIds: ['R-217'], narrowedParams: null, advisory: '…the Hunt posture sets ambition; the crowd\'s return remains the exit signal regardless of milestones.', displayReason: null, notes: [] },
  degen:           { state: 'tension', rulingIds: ['R-186'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  guardian:        { state: 'tension', rulingIds: ['R-187'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  analyst:         { state: 'tension', rulingIds: ['R-188'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
},

'tv-15': { // after {threshold}: swap out within {evals}, replace with HIGHEST-ATR bullish bench candidate
  momentum_chaser: { state: 'tension', rulingIds: ['R-189'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian:      { state: 'core_conflict', rulingIds: ['R-190'], narrowedParams: null, advisory: null, displayReason: 'Compound — a forced post-threshold harvest plus a re-entry gate (highest-ATR, RSI > threshold, above VWAP) that a washed-out dislocated name fails by construction.', notes: [] },
  degen:           { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] }, // stored, on restored highest-ATR replacement leg
  guardian:        { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'A forced milestone harvest plus mandated rotation into the highest-ATR mover forces both a non-defensive exit and maximum-volatility re-entry — against capital protection.', notes: [] }, // stored; reason derived
  analyst:         { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'A scoring-milestone harvest recycles the book on ATR and momentum, overriding the intact business thesis that governs the identity\'s exits.', notes: [] }, // stored; reason derived
},

// ============ PART 3 · INSTITUTIONAL (9 rules; i-10 deferred) ============
// Every authored institutional cell carries board_blind + weight_only_construction (family constraints stamped).

'i-01': { // accumulation preference [SIG-030] — "soft preference"
  momentum_chaser: { state: 'tension', rulingIds: ['R-218'], narrowedParams: null, advisory: '…trend evidence governs selection; institutional accumulation orders only names that evidence already supports.', displayReason: null, notes: ['board_blind','weight_only_construction'] },
  contrarian:      { state: 'tension', rulingIds: ['R-219'], narrowedParams: null, advisory: '…dislocation and recovery evidence govern selection; absent accumulation never disqualifies a washout.', displayReason: null, notes: ['board_blind','weight_only_construction'] },
  degen:           { state: 'tension', rulingIds: ['R-220'], narrowedParams: null, advisory: '…realized volatility ranks candidates; accumulation is secondary context.', displayReason: null, notes: ['board_blind','weight_only_construction'] },
  guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction'] },
  analyst:         { state: 'tension', rulingIds: ['R-228'], narrowedParams: null, advisory: '…quality admission determines candidates; accumulation corroborates and never substitutes.', displayReason: null, notes: ['board_blind','weight_only_construction'] },
},

'i-02': { // distribution exclusion [SIG-030/031] — "Hard filter… Level 1"
  momentum_chaser: { state: 'tension', rulingIds: ['R-221'], narrowedParams: null, advisory: '…trend evidence governs; where the exclusion would remove a trend-qualified candidate, it surfaces the conflict rather than silently re-ranking.', displayReason: null, notes: ['board_blind','weight_only_construction'] },
  contrarian:      { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'A hard exclusion of distributed (crowd-leaving) names removes the identity\'s entry condition at name level — an identity collision under the post-shortlist exclusion contract.', notes: ['board_blind','weight_only_construction','c21_discretionary'] }, // stored
  degen:           { state: 'tension', rulingIds: ['R-222'], narrowedParams: null, advisory: '…realized volatility ranks candidates; where the exclusion would remove the highest-volatility candidate, it surfaces the conflict.', displayReason: null, notes: ['board_blind','weight_only_construction'] },
  guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction'] },
  analyst:         { state: 'tension', rulingIds: ['R-229'], narrowedParams: null, advisory: '…distribution is negative context; the business case decides admission.', displayReason: null, notes: ['board_blind','weight_only_construction'] },
},

'i-03': { // fresh-positions preference [SIG-031] — "≥{count} top-20 holders initiated a new position this quarter"
  momentum_chaser: { state: 'tension', rulingIds: ['R-232'], narrowedParams: null, advisory: '…trend evidence governs; fresh institutional positions order only names that evidence supports.', displayReason: null, notes: ['board_blind','weight_only_construction'] },
  contrarian:      { state: 'tension', rulingIds: ['R-233'], narrowedParams: null, advisory: '…dislocation and recovery evidence govern; absent fresh positions never disqualify a washout.', displayReason: null, notes: ['board_blind','weight_only_construction'] },
  degen:           { state: 'tension', rulingIds: ['R-234'], narrowedParams: null, advisory: '…realized volatility ranks candidates; fresh-position counts are secondary context.', displayReason: null, notes: ['board_blind','weight_only_construction'] },
  guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction'] },
  analyst:         { state: 'tension', rulingIds: ['R-235'], narrowedParams: null, advisory: '…quality admission determines candidates; consensus discovery corroborates and never substitutes.', displayReason: null, notes: ['board_blind','weight_only_construction'] },
},

'i-05': { // shared-active-holder cap [SIG-033] — "no more than {max} names sharing a top-3 ACTIVE holder"
  momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction'] },
  contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction'] },
  degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction'] },
  guardian:        { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction'] }, // ratified per F14, stored (no R-id)
  analyst:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction'] },
},

'i-06': { // hedge-fund-crowding targets [SIG-032/033]
  momentum_chaser: { state: 'tension', rulingIds: ['R-223'], narrowedParams: null, advisory: '…crowding is context; price and technical evidence decide selection.', displayReason: null, notes: ['board_blind','weight_only_construction'] },
  contrarian:      { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'Targeting hedge-fund-crowded names buys into the crowd — the direct inverse of the identity\'s crowd-left entry condition.', notes: ['board_blind','weight_only_construction'] }, // stored; reason derived
  degen:           { state: 'tension', rulingIds: ['R-231'], narrowedParams: null, advisory: '…realized name-level volatility remains its primary ranking basis, and hedge-fund crowding may influence ordering only among otherwise volatility-qualified candidates.', displayReason: null, notes: ['board_blind','weight_only_construction'] },
  guardian:        { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'Selecting hedge-fund-crowded names concentrates into correlated, crowd-exposed positions — against the identity\'s spread-for-safety diversification.', notes: ['board_blind','weight_only_construction'] }, // stored; reason derived
  analyst:         { state: 'tension', rulingIds: ['R-191'], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction'] }, // R-191 pre-existing; advisory not quoted here
},

'i-07': { // sector institutional flow [SIG-034] — "ensures picks are in sectors where institutional capital is flowing"
  momentum_chaser: { state: 'tension', rulingIds: ['R-224'], narrowedParams: null, advisory: '…actual sector and name trend evidence governs; institutional sector flow tilts only among sectors that evidence supports.', displayReason: null, notes: ['board_blind','weight_only_construction','c21_discretionary'] },
  contrarian:      { state: 'tension', rulingIds: ['R-11'], narrowedParams: { allow: ['neutral'] }, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction','c21_discretionary'] }, // R-11 standing; {sentiment ∈ {neutral}}; advisory not quoted here
  degen:           { state: 'tension', rulingIds: ['R-225'], narrowedParams: null, advisory: '…realized volatility ranks candidates within the rule\'s admitted sector set, and it surfaces the identity conflict whenever the sector exclusion removes the global volatility leader.', displayReason: null, notes: ['board_blind','weight_only_construction','c21_discretionary'] },
  guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction'] },
  analyst:         { state: 'tension', rulingIds: ['R-226'], narrowedParams: null, advisory: '…quality admission precedes the sector tilt; no name is excluded before its quality case is read.', displayReason: null, notes: ['board_blind','weight_only_construction','c21_discretionary'] },
},

'i-08': { // 13F recency weighting [SIG-030 snapshot] — weight-not-admit; computeFreshness DEAD; prose-only
  momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction','prose_only'] },
  contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction','prose_only'] },
  degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction','prose_only'] },
  guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction','prose_only'] },
  analyst:         { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction','prose_only'] },
},

'i-09': { // fast-money-skew preference [SIG-032 transient class] — parameterless
  momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction'] }, // stored
  contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction'] }, // stored
  degen:           { state: 'tension', rulingIds: ['R-227'], narrowedParams: null, advisory: '…realized volatility — its own measured axis — ranks candidates; holder-type skew is corroboration only.', displayReason: null, notes: ['board_blind','weight_only_construction'] },
  guardian:        { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'Preferring fast-money (transient) holder skew tilts toward the least-stable, highest-turnover ownership — against the identity\'s stability-first posture.', notes: ['board_blind','weight_only_construction'] }, // stored; reason derived
  analyst:         { state: 'tension', rulingIds: ['R-10'], narrowedParams: null, advisory: null, displayReason: null, notes: ['board_blind','weight_only_construction'] }, // cites R-10 as it stands; advisory not quoted here
},

'i-10': { // holder-count growth over {quarters} — DEFERRED (R-230)
  momentum_chaser: { state: 'deferred', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  contrarian:      { state: 'deferred', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  degen:           { state: 'deferred', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  guardian:        { state: 'deferred', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
  analyst:         { state: 'deferred', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
},
