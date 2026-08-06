const C6_MID_BATTLE = {

  // C6-1 · mb-01 — refuse swaps before {minutes} (15–180) held; emergency exception
  'mb-01': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-108'], narrowedParams: { min: 15, max: 60 }, advisory: 'the agent is instructed the hold floor prevents same-tick churn, and that stalled positions rotate as soon as it lifts.', displayReason: null, notes: [] },
    contrarian:      { state: 'tension', rulingIds: ['R-109'], narrowedParams: null, advisory: 'the agent is instructed the floor prevents same-tick churn, and that a thesis completed by the crowd\'s return is still a reason to exit when it lifts.', displayReason: null, notes: [] },
    degen:           { state: 'tension', rulingIds: ['R-110'], narrowedParams: { min: 15, max: 60 }, advisory: 'the agent is instructed the floor delays rotation without changing what it rotates toward, and that volatility ranking resumes the moment it lifts.', displayReason: null, notes: [] },
    guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'tension', rulingIds: ['R-111'], narrowedParams: { min: 15, max: 60 }, advisory: 'the agent is instructed the hold floor governs timing only, and its quality judgment continues to determine what it holds.', displayReason: null, notes: [] },
  },

  // C6-2 · mb-03 — swap out flatliners (<{atr} over {minutes})
  'mb-03': {
    momentum_chaser: { state: 'native', rulingIds: ['R-112'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'core_conflict', rulingIds: ['R-113'], narrowedParams: null, advisory: null, displayReason: 'A forced exit on a movement clock reverses a doctrine whose evidence horizon is weeks and which explicitly accepts quiet while a thesis develops; the kernel denies this mechanism by name, and no carve-out or setting softens it.', notes: [] },
    degen:           { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:        { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'Mandatory clock-driven exits on price inactivity are the churn refusal in its purest form; the kernel\'s exits are event-driven, never scheduled.', notes: [] },
    analyst:         { state: 'tension', rulingIds: ['R-114'], narrowedParams: null, advisory: 'the agent is instructed that quiet price action is not thesis failure, and that its quality assessment decides whether a holding is still warranted.', displayReason: null, notes: [] },
  },

  // C6-3 · mb-04 — only swap if bench intraday performance exceeds active by {atr}
  'mb-04': {
    momentum_chaser: { state: 'native', rulingIds: ['R-115'], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'tension', rulingIds: ['R-116'], narrowedParams: null, advisory: 'the agent is instructed the hurdle asks for evidence the incoming name has begun to turn, not that it is already outperforming.', displayReason: null, notes: [] },
    degen:           { state: 'tension', rulingIds: ['R-117'], narrowedParams: null, advisory: 'the agent is instructed realized volatility remains its selection basis, and the hurdle sets a timing bar rather than re-ranking candidates.', displayReason: null, notes: [] },
    guardian:        { state: 'tension', rulingIds: ['R-138'], narrowedParams: null, advisory: 'the agent is instructed its quality and volatility screens determine which bench names are admissible, and the performance hurdle only times action among them.', displayReason: null, notes: [] },
    analyst:         { state: 'tension', rulingIds: ['R-118'], narrowedParams: null, advisory: 'the agent is instructed quality admission decides which bench names are candidates, and the performance hurdle only times the swap among them.', displayReason: null, notes: [] },
  },

  // C6-4 · mb-06 — multiply swap hurdle by tier (Star ×{star}, Core ×{core})  [PROSE-ONLY]
  'mb-06': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-139'], narrowedParams: null, advisory: 'the agent is instructed a stalled Star is still a stalled name, and tier resistance delays rotation without justifying a hold.', displayReason: null, notes: ['prose_only'] },
    contrarian:      { state: 'tension', rulingIds: ['R-140'], narrowedParams: null, advisory: 'the agent is instructed the crowd\'s return remains its exit signal, and a high tier is not a reason to stay past it.', displayReason: null, notes: ['prose_only', 'c21_discretionary'] },
    degen:           { state: 'tension', rulingIds: ['R-119'], narrowedParams: null, advisory: 'the agent is instructed that a stalled Star is still a stalled name, and that tier resistance delays rotation rather than justifying a hold.', displayReason: null, notes: ['prose_only'] },
    guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] },
    analyst:         { state: 'tension', rulingIds: ['R-141'], narrowedParams: null, advisory: 'the agent is instructed the quality case and its opportunity cost decide whether a holding is warranted, regardless of the tier it once earned.', displayReason: null, notes: ['prose_only'] },
  },

  // C6-5 · mb-07 — freeze non-emergency swaps for {freeze} after {swaps} in {window}
  'mb-07': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-120'], narrowedParams: null, advisory: 'the agent is instructed the breaker limits repeated churn within a window, not ordinary stall rotation.', displayReason: null, notes: [] },
    contrarian:      { state: 'tension', rulingIds: ['R-142'], narrowedParams: null, advisory: 'the agent is instructed the freeze limits repeated churn, and that a completed thesis is still exited when it lifts.', displayReason: null, notes: ['c21_discretionary'] },
    degen:           { state: 'tension', rulingIds: ['R-121'], narrowedParams: null, advisory: 'the agent is instructed the breaker caps repeated swapping in a window, and that volatility ranking resumes unchanged when it lifts.', displayReason: null, notes: [] },
    guardian:        { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'tension', rulingIds: ['R-143'], narrowedParams: null, advisory: 'the agent is instructed the freeze limits churn frequency and never overrides a clear quality upgrade once it lifts.', displayReason: null, notes: [] },
  },

  // C6-6 · mb-08 — do not swap any positive-P&L name until {threshold}  [C-21 discretionary]
  'mb-08': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-122'], narrowedParams: null, advisory: 'the agent is instructed the hold applies to profit-taking impatience, never to a position whose trend evidence has broken.', displayReason: null, notes: ['c21_discretionary'] },
    contrarian:      { state: 'tension', rulingIds: ['R-123'], narrowedParams: null, advisory: 'the agent is instructed the crowd\'s return remains its exit signal, and a scoring threshold is not a reason to hold a completed thesis.', displayReason: null, notes: ['c21_discretionary'] },
    degen:           { state: 'tension', rulingIds: ['R-124'], narrowedParams: null, advisory: 'the agent is instructed the hold serves a live ride, and that a decayed move is still rotated regardless of the scoring threshold.', displayReason: null, notes: ['c21_discretionary'] },
    guardian:        { state: 'tension', rulingIds: ['R-125'], narrowedParams: null, advisory: 'the agent is instructed its protective exits always govern regardless of this rule, and that the hold applies only to discretionary profit-taking.', displayReason: null, notes: ['c21_discretionary'] },
    analyst:         { state: 'tension', rulingIds: ['R-126'], narrowedParams: null, advisory: 'the agent is instructed that deterioration in the business case remains grounds to exit regardless of the position\'s score.', displayReason: null, notes: ['c21_discretionary'] },
  },

  // C6-7 · mb-09 — immediate eject below {atr} from entry, overriding all hold rules
  'mb-09': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-152'], narrowedParams: null, advisory: 'the agent is instructed the hard floor is capital protection rather than a replacement for its two-leg holding judgment, and that the floor must sit outside ordinary trend volatility.', displayReason: null, notes: [] },
    contrarian:      { state: 'tension', rulingIds: ['R-150'], narrowedParams: null, advisory: 'the agent is instructed the floor is the pre-declared thesis-failure line that licenses its patience above it, set wide enough that ordinary decline does not reach it.', displayReason: null, notes: [] },
    degen:           { state: 'tension', rulingIds: ['R-127'], narrowedParams: null, advisory: 'the agent is instructed the floor is its survival line, set wide enough that ordinary volatility does not reach it.', displayReason: null, notes: [] },
    guardian:        { state: 'tension', rulingIds: ['R-128'], narrowedParams: null, advisory: 'the agent is instructed the floor is a last-resort line set outside ordinary noise, and that its patience layers govern everything above it.', displayReason: null, notes: [] },
    analyst:         { state: 'tension', rulingIds: ['R-129'], narrowedParams: null, advisory: 'the agent is instructed the floor is capital protection rather than a thesis verdict, and an exited name whose quality case is intact remains a re-entry candidate.', displayReason: null, notes: [] },
  },

  // C6-8 · mb-10 — block swaps between {start} and {end} (midday); breaking-news exception
  'mb-10': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-130'], narrowedParams: null, advisory: 'the agent is instructed the window suppresses low-conviction midday churn, and that positions whose evidence has broken are rotated when it lifts.', displayReason: null, notes: [] },
    contrarian:      { state: 'tension', rulingIds: ['R-153'], narrowedParams: null, advisory: 'the agent is instructed the window suppresses ordinary midday activity, and that a completed thesis is exited as soon as it lifts.', displayReason: null, notes: [] },
    degen:           { state: 'tension', rulingIds: ['R-131'], narrowedParams: null, advisory: 'the agent is instructed the pause defers rotation without changing its volatility ranking, which resumes when the window lifts.', displayReason: null, notes: [] },
    guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['c21_discretionary'] },
    analyst:         { state: 'tension', rulingIds: ['R-154'], narrowedParams: null, advisory: 'the agent is instructed quality admission is unchanged by the window, and that a clear quality upgrade is acted on once it lifts.', displayReason: null, notes: [] },
  },

  // C6-9 · mb-11 — after {time}, lower swap hurdle by {pct}% and focus on MACD-divergence names  [PROSE-ONLY]
  'mb-11': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-132'], narrowedParams: { min: 25, max: 50 }, advisory: 'the agent is instructed a late-session hurdle reduction never lowers its confirmation requirement, and that divergence alone is not the strength evidence it acts on.', displayReason: null, notes: ['prose_only'] },
    contrarian:      { state: 'tension', rulingIds: ['R-144'], narrowedParams: null, advisory: 'the agent is instructed a lower late hurdle never substitutes for a recovery thesis, and divergence alone is not sufficient entry evidence.', displayReason: null, notes: ['prose_only'] },
    degen:           { state: 'tension', rulingIds: ['R-145'], narrowedParams: null, advisory: 'the agent is instructed realized volatility governs its candidate ranking, and the divergence focus narrows timing rather than selection.', displayReason: null, notes: ['prose_only'] },
    guardian:        { state: 'tension', rulingIds: ['R-133'], narrowedParams: { min: 25, max: 50 }, advisory: 'the agent is instructed its entry standard does not fall with the clock, and that a reduced hurdle never admits a name its screens would reject.', displayReason: null, notes: ['prose_only'] },
    analyst:         { state: 'tension', rulingIds: ['R-134'], narrowedParams: { min: 25, max: 50 }, advisory: 'the agent is instructed the quality standard is fixed regardless of the hour, and a lower hurdle changes timing rather than admission.', displayReason: null, notes: ['prose_only'] },
  },

  // C6-10 · mb-12 — swap hurdle decays {pct}%/hour after {start}  [PROSE-ONLY]
  'mb-12': {
    momentum_chaser: { state: 'tension', rulingIds: ['R-146'], narrowedParams: null, advisory: 'the agent is instructed its confirmation requirement does not decay with the session, and a lower hurdle changes urgency rather than evidence.', displayReason: null, notes: ['prose_only'] },
    contrarian:      { state: 'tension', rulingIds: ['R-147'], narrowedParams: null, advisory: 'the agent is instructed a decaying hurdle never substitutes for a recovery thesis.', displayReason: null, notes: ['prose_only'] },
    degen:           { state: 'native', rulingIds: ['R-148'], narrowedParams: null, advisory: null, displayReason: null, notes: ['prose_only'] },
    guardian:        { state: 'tension', rulingIds: ['R-135'], narrowedParams: null, advisory: 'the agent is instructed its entry standard does not decay with the session, and that its screens govern regardless of the hurdle\'s level.', displayReason: null, notes: ['prose_only'] },
    analyst:         { state: 'tension', rulingIds: ['R-136'], narrowedParams: null, advisory: 'the agent is instructed the quality standard is fixed regardless of the hour.', displayReason: null, notes: ['prose_only'] },
  },

  // C6-11 · mb-13 — delay action on news catalysts by {intervals} evaluations
  'mb-13': {
    momentum_chaser: { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    degen:           { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: ['c21_discretionary'] },
    analyst:         { state: 'tension', rulingIds: ['R-149'], narrowedParams: null, advisory: 'the agent is instructed the delay guards against reacting to unconfirmed headlines, and that a catalyst bearing on the business case is acted on once confirmed.', displayReason: null, notes: [] },
  },

  // C6-12 · mb-15 — force exit after {intervals} consecutive evals below daily VWAP, regardless of tier
  'mb-15': {
    momentum_chaser: { state: 'core_conflict', rulingIds: ['R-151'], narrowedParams: null, advisory: null, displayReason: 'The locked two-leg holding rule requires hold-and-surface when only one leg breaks; mb-15 forces an exit on one indicator regardless of whether the sector leg is intact, replacing the two-leg test with a one-condition exit, and no intervals setting supplies the missing leg.', notes: [] },
    contrarian:      { state: 'core_conflict', rulingIds: [], narrowedParams: null, advisory: null, displayReason: 'The rule names a below-VWAP position "the thesis is broken" and forces an exit regardless of tier and before the pre-declared stop, on the washed-out below-VWAP names the kernel buys, overriding the stop that licenses the archetype\'s patience.', notes: [] },
    degen:           { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed its stop discipline alone governs exits, and that a VWAP position is not a volatility judgment.', displayReason: null, notes: [] },
    guardian:        { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed its risk line decides exits, and that VWAP persistence informs rather than triggers.', displayReason: null, notes: [] },
    analyst:         { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed that chart position is never a thesis verdict, and that the business case decides whether the holding is still warranted.', displayReason: null, notes: [] },
  },

  // C6-13 · tv-08 — hold low-volume pullbacks in uptrends (score ≥{score}); swap only on rising down-volume, +{minutes} patience
  'tv-08': {
    momentum_chaser: { state: 'native', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    contrarian:      { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed the patience clause applies to names it holds, and that dislocation and recovery evidence continue to govern what it buys.', displayReason: null, notes: [] },
    degen:           { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed patience yields to its volatility-decay discipline, and that a low-volume pullback is still stalled movement.', displayReason: null, notes: [] },
    guardian:        { state: 'neutral', rulingIds: [], narrowedParams: null, advisory: null, displayReason: null, notes: [] },
    analyst:         { state: 'tension', rulingIds: [], narrowedParams: null, advisory: 'the agent is instructed the quality case decides whether a holding is warranted, and the technical clause times rather than justifies the hold.', displayReason: null, notes: [] },
  },

};
