// src/components/Research/BattleResearch/battleResearchCopy.js
//
// Battle Research Slice 1 — EVERY STRING (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md §9; the founder's plain-terms
// style). PURE, NODE-CLEAN, ZERO IMPORTS: templates take finished pieces (a
// pctText, a clock time) from the caller — no template computes or rounds a
// number (BUILD_RULES §9), so a number on screen and in a sentence is one string.
//
// HONESTY (§9, BRS-16; battleResearchCopy.honesty.test.js sweeps every output):
// no "will", "should buy" or "likely"; nothing called live; no fit, overlap,
// momentum or SPY; no points in a candidate line (the one points figure is the
// holding's lockNowOf line in the comparison, the scorer's own number); every
// number carries its time. A reading the result doesn't have is left out,
// never written as zero.

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Two clock times as one range: "1:42–1:44 PM" (one half named once), "11:58 AM–12:02 PM", or one time. */
export function clockRange(from, to) {
  if (!from) return to ?? null;
  if (!to || from === to) return from;
  const half = (s) => (/ (AM|PM)$/.exec(s) || [])[1] ?? null;
  return half(from) && half(from) === half(to) ? `${from.replace(/ (AM|PM)$/, '')}–${to}` : `${from}–${to}`;
}
/** A points figure with its sign, the sheet's way (sheetCopy signed): +50, −6, +0. */
export const signedPts = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;

/**
 * How one name's printed move stands against another's, in words that are true in every direction
 * (review BR2-5): only for a > b (both the PRINTED numbers, readings.shownMove).
 *   a > 0          "up more today than X"
 *   a = 0 > b      "flat today while X is down"
 *   a < 0          "down less today than X"
 */
export function aheadWords(a, b, other) {
  if (a > 0) return `up more today than ${other}`;
  if (a === 0) return `flat today while ${other} is down`;
  return `down less today than ${other}`;
}
const join = (parts) => parts.filter(Boolean).join(' · ');

/** The four questions (BRS-5) — stored ids are §6's. */
export const QUESTION_IDS = Object.freeze(['weakest_alternatives', 'rank_bench', 'rank_agent_watchlist', 'moving_today']);
export const STARTER_TEXT = Object.freeze({
  weakest_alternatives: 'Find alternatives to our weakest holding',
  rank_bench: 'Rank my bench',
  rank_agent_watchlist: 'Rank my agent watchlist',
  moving_today: "What's moving today on my bench and watchlist?",
});

/** The group words: on screen "Bench" and "Agent watchlist", never "Watchlist" alone (BRS-4). */
export const GROUP_LABEL = Object.freeze({ bench: 'Bench', agent_watchlist: 'Agent watchlist' });
const GROUP_WORDS = Object.freeze({ bench: 'my bench', agent_watchlist: 'my agent watchlist' });

/** The prepared conditions (BRS-12), as a chip and as a step's wording. */
export const CONDITION_LABEL = Object.freeze({
  eligible_now: 'Only names that can come in now',
  up_today: 'Only names up today',
  down_today: 'Only names down today',
});
const CONDITION_WORDS = Object.freeze({
  eligible_now: 'only names that can come in now',
  up_today: 'up today',
  down_today: 'down today',
});
export const conditionLabel = (c) => (c.id === 'sector' ? `Only ${c.value}` : CONDITION_LABEL[c.id] ?? c.id);
export const conditionWords = (c) => (c.id === 'sector' ? `only ${c.value}` : CONDITION_WORDS[c.id] ?? c.id);

/** The order (BRS-11). */
export const orderLabel = (order) => (order.measure === 'today_move'
  ? (order.direction === 'worst_first' ? "Today's move, biggest drop first" : "Today's move, biggest gain first")
  : 'Technical rank');
const orderWords = (order) => (order.measure === 'today_move'
  ? (order.direction === 'worst_first' ? "ordered by today's move, biggest drop first" : "ordered by today's move")
  : 'ordered by technical rank');

export const BR_COPY = Object.freeze({
  // ── The surface's frame ──
  title: 'Research',
  close: 'Close research',
  voiceLabel: (agent, archetype) => (agent && archetype ? `${agent} · ${archetype}` : agent || archetype || ''),
  proposesEyebrow: (agent) => `${agent} proposes`,
  honesty: 'A ranking doesn’t predict how the battle ends.',
  noCost: 'no message cost',
  refineHead: 'Refine this result · no message cost',

  // ── The proposal (BRS-5, BRS-6) ──
  proposalWeakest: (inc, checkTime, rungs) => `${inc} is our weakest holding at the ${checkTime} check, ${rungs} rungs from entry. I can line up the bench and my watchlist against it by technical rank, with today’s move beside each name.`,
  proposalAwaiting: (time) => (time
    ? `Our holdings are ranked at the next check (${time}). Until then I can rank the bench or my watchlist.`
    : 'Our holdings are ranked at the next check. Until then I can rank the bench or my watchlist.'),
  proposalLegacy: 'This battle doesn’t score holdings in rungs, so there’s no weakest holding to compare against. I can rank the bench or my watchlist instead.',
  proposalNoLadder: 'Our book holds no stock on the measured ladder. I can rank the bench or my watchlist instead.',
  // The weakest starter's own line when there is no weakest (it stays visible, disabled).
  weakestUnavailable: (reason, time) => (reason === 'awaiting'
    ? (time ? `Our holdings are ranked at the next check (${time})` : 'Our holdings are ranked at the next check')
    : reason === 'legacy' ? 'This battle doesn’t score holdings in rungs' : 'Our book holds no stock on the measured ladder'),
  asTheyStand: (n) => `Your bench and watchlist as they stand · ${plural(n, 'name', 'names')} by technical rank`,
  asTheyStandLoading: 'Reading the bench and watchlist…',
  asTheyStandFailed: 'Couldn’t read the bench and watchlist just now.',

  // ── Move availability (BRS-5, BRS-12; §9) ──
  beforeOpenShort: (open) => `Today’s session opens at ${open} ET`,
  waitingShort: 'Waiting for today’s quotes',
  closedShort: (day, open) => (day ? `Market closed · next session ${day} · ${open} ET` : 'Market closed'),
  beforeOpenLine: (open, day) => `Today’s session opens at ${open} ET.${day ? ` I’m showing ${day}’s moves for reference and don’t rank by them.` : ''}`,
  waitingLine: 'Waiting for today’s quotes. I’ll rank by today’s move once they arrive.',
  closedLine: (next, open, day) => `${next ? `Market closed. The next session is ${next} at ${open} ET.` : 'Market closed.'}${day ? ` I’m showing ${day}’s moves for reference.` : ''}`,
  allStaleSweep: (t) => `Today’s moves are unavailable: the last price sweep was at ${t}.`,
  allStaleQuotes: (t) => `Today’s moves are unavailable: no quote has moved since ${t}.`,

  // ── The result's title and note line (BRS-6, BRS-8) ──
  titleWeakest: (inc) => `Compare alternatives to ${inc}`,
  then: (words) => `then: ${words}`,
  thenReplacing: (added, replaced) => `then: ${added}, in place of ${replaced}`,
  thenRemoved: (words) => `then: without ${words}`,
  thenOrder: (order) => `then: ${orderWords(order)}`,
  thenGroup: (group) => `then: the same question on ${GROUP_WORDS[group] ?? group}`,
  thenRefresh: (label) => `then: refreshed · ${label}`,
  thenUseAcross: (words) => `then: ${words}, from a stock’s finding`,
  note: (group, n, ranksAt, movesFrom, movesTo) => join([
    `${group} · ${plural(n, 'name', 'names')}`,
    ranksAt ? `Ranks as of ${ranksAt} ET` : null,
    movesFrom ? `moves as of ${clockRange(movesFrom, movesTo)} ET` : null,
  ]),
  groupUnion: 'Bench and agent watchlist',
  resultLabel: (n, t) => `Result ${n} · ${t}`,
  resultOf: (label) => label,

  // ── A row (§7) ──
  rank: (r, n, t, older) => `Rank ${r} of ${n} · ${t} ET${older ? ' · older than usual' : ''}`,
  rankNoTime: (r, n) => `Rank ${r} of ${n} · time not recorded`,
  sectorRank: (ordinal, n, sector) => `${ordinal} of ${n} in ${sector}`,
  rungEstimate: (pctText, t) => `Estimated rung size ≈${pctText} · ATR reading · ${t} ET`,
  rungHolding: (pctText) => `One rung is ${pctText} · fixed at entry`,
  position: (p) => `#${p}`,
  was: (p) => `was #${p}`,
  held: 'held',
  diffRank: (inc) => `Higher rank than ${inc}`,
  diffMove: (words) => words.charAt(0).toUpperCase() + words.slice(1),

  // ── Eligibility (BRS-15) ──
  canComeIn: 'Can come in now',
  lockedUntil: (t) => `Locked until ${t}`,
  lockedPassed: (t) => `Locked until ${t} at this result · since passed`,
  equippedOnly: 'Can’t come in · on the equipped list only',
  wrongClass: 'Can’t come in · a crypto can’t replace a stock',
  cantComeIn: 'Can’t come in',
  caveat: '“Can come in now” means it can be picked now. A swap still checks the sector limit, tournament rules, a fresh quote and your commands left.',

  // ── The reference line (§7) ──
  reference: (inc, checkTime, rungs) => join([`${inc} · held`, checkTime ? `our weakest at the ${checkTime} check` : 'our weakest', rungs !== null && rungs !== undefined ? `${rungs} rungs from entry` : null, 'reference, not ranked']),
  referenceNoReading: (inc, words) => `${inc} has no reading for this order (${words}), so it isn’t placed in the list.`,
  aboveLineRank: (inc) => `Names above this line out-rank ${inc} on technical rank`,
  aboveLineUp: (inc) => `Names above this line are ahead of ${inc} on today’s move`,
  aboveLineDown: (inc) => `Names above this line are behind ${inc} on today’s move`,

  // ── The board's sections (§7) ──
  showAll: (n) => `Show all ${n}`,
  showFewer: 'Show fewer',
  leftOut: 'Left out',
  removedBy: 'removed by a condition',
  notAssessed: 'not assessed',
  notRanked: 'Not ranked',
  notRankedCrypto: 'crypto · not compared here',
  notRankedMissing: 'not in the platform rankings',
  emptyPlaced: 'No name is left in this result. Undo or remove a condition to bring names back.',
  emptyGroup: (group) => `${group} is empty in this battle right now.`,
  askAbout: (agent) => `Ask ${agent} about this result`,
  askCost: '1 msg when sent',

  // ── The toolbar (§7) ──
  orderRank: 'Technical rank',
  orderMove: 'Today’s move',
  orderDropFirst: 'Biggest drop first',
  undo: 'Undo',
  previous: 'Previous step',
  startOver: 'Start a different question',
  sameOnOther: (group) => `Same question on ${GROUP_WORDS[group] ?? group}`,
  refresh: 'Refresh',
  refreshIn: (mmss) => `Refresh in ${mmss}`,
  refreshing: 'Refreshing…',
  tryAgain: 'Try again',
  readMore: 'Read more · history',
  history: 'History',
  historyCapped: (n) => `${plural(n, 'older step', 'older steps')} left the history (it keeps 40).`,
  investigationsCapped: 'The oldest question left this session’s history (it keeps 10).',
  earlierQuestions: 'Earlier questions this session',

  // ── Fetch failures (BRS-14) ──
  fetching: (q) => `Working on “${q}”…`,
  firstFetchFailed: (why) => `Couldn’t get the readings: ${why}. Nothing has changed.`,
  refreshFailed: (why, t) => `Couldn’t refresh: ${why}. Your ${t} result is unchanged.`,
  whyQuotes: 'the price read didn’t answer',
  whyRankings: 'the rankings read didn’t answer',
  whyOff: 'Battle Research isn’t available for this battle right now',

  // ── The banner after a refinement (BRS-13) ──
  bannerAdded: (words) => `Condition added: ${words}`,
  bannerReplaced: (added, replaced) => `Condition replaced: ${added}, in place of ${replaced}`,
  bannerRemoved: (words) => `Condition removed: ${words}`,
  bannerOrder: (order) => `Ordering changed: ${orderLabel(order).toLowerCase()}`,
  bannerGroup: (group) => `Group switched: ${GROUP_LABEL[group] ?? group}`,
  bannerLeft: (n, of) => `${n} of ${plural(of, 'name', 'names')} placed.`,
  bannerCounts: (removed, setAside, back) => join([
    removed ? `${removed} removed` : null,
    setAside ? `${setAside} set aside, not assessed` : null,
    back ? `${back} came back` : null,
  ]) + '.',
  bannerMovedUp: (sym, now, was, removed, setAside, measure) => `${sym} is now #${now}, was #${was}, because ${[
    removed ? (removed === 1 ? 'a name above it was removed' : `${removed} names above it were removed`) : null,
    setAside ? (setAside === 1 ? 'a name above it was set aside, not assessed' : `${setAside} names above it were set aside, not assessed`) : null,
  ].filter(Boolean).join(' and ')}. Its ${measure} is unchanged.`,
  bannerMovedDown: (sym, now, was, back, measure) => `${sym} is now #${now}, was #${was}, because ${back === 1 ? 'a name came back above it' : `${back} names came back above it`}. Its ${measure} is unchanged.`,
  bannerMovedMore: (n) => `${plural(n, 'more name', 'more names')} closed up the same way.`,
  bannerOrderBody: 'Positions changed because the ordering changed. The names and their readings are the same.',
  bannerOrderSetAside: (n) => `Positions changed because the ordering changed. ${n === 1 ? 'One name has' : `${n} names have`} no usable move today and ${n === 1 ? 'is' : 'are'} set aside; no reading changed.`,
  bannerNoMove: 'No remaining name changed position.',
  bannerEnd: (t) => `Readings are the same ${t} result. Nothing was refreshed.`,
  measureRank: 'rank',
  measureMove: 'move',

  // ── Refresh (BRS-14) ──
  refreshedTitle: (label) => `${label}`,
  refreshedBody: (moved, inn, out) => join([
    moved ? `${plural(moved, 'name', 'names')} changed position` : 'No name changed position',
    inn ? `${inn} in` : null,
    out ? `${out} out` : null,
  ]) + '.',
  refreshedWeakest: (inc, was) => `${inc} is now our weakest; this result compares with it (was ${was}).`,

  // ── Notices (BRS-14): one quiet line with Refresh ──
  noticeNewCheckWeakest: (t, now, inc) => `A newer check at ${t}: ${now} is now our weakest. This result still compares with ${inc}.`,
  noticeNewCheck: (t, label) => `A newer check at ${t}. This result is still the ${label} one.`,
  noticeLeftBook: (inc, t) => (t ? `${inc} left the book at ${t}.` : `${inc} left the book after this result.`),
  noticeLists: (which, c, t) => `${which === 'bench' ? 'The bench' : which === 'agent_watchlist' ? 'My watchlist' : 'The bench and my watchlist'} changed${t ? ` at ${t}` : ' since this result'} (${[`${c.inn} in`, `${c.out} out`, c.eligibility ? `${c.eligibility} can or can’t come in now` : null].filter(Boolean).join(', ')}).`,

  // ── The explanation (BRS-16; §9) ──
  explainOutrank: (k, n, inc, ri, N) => (ri !== null
    ? `${k} of ${plural(n, 'name', 'names')} out-rank ${inc} (rank ${ri} of ${N}).`
    : `${inc} has no technical rank in this result.`),
  explainNoneOutrank: (inc) => `Nothing on the bench or my watchlist out-ranks ${inc} on technical rank.`,
  explainLeader: (lead, rank, N, elig, t) => `${lead} leads at rank ${rank} of ${N}${elig}${t ? ` (ranks as of ${t})` : ' (rank time not recorded)'}.`,
  explainLeaderMove: (lead, move, t, elig) => `${lead} leads on today’s move, ${move} as of ${t}${elig}.`,
  eligNow: ', and it can come in now',
  eligLocked: (t) => `, but it’s locked until ${t}`,
  eligCant: (why) => `, but it can’t come in: ${why}`,
  explainMoves: (lead, leadDir, leadMove, inc, incDir, incMove, t) => `Today ${lead} is ${leadDir} ${leadMove} and ${inc} is ${incDir} ${incMove} (as of ${t}).`,
  explainNoMove: (sym) => `I don’t have today’s move for ${sym} yet.`,
  explainUpMore: (k, n, inc) => `${k} of ${plural(n, 'name', 'names')} are ahead of ${inc} on today’s move.`,
  explainKeep: (inc) => `None of this says how either would score from here. Keeping ${inc} is a fair answer.`,
  explainGroup: (n, group) => `${plural(n, 'name', 'names')} on ${group}.`,
  explainWeakestGone: (line) => line,
  explainGroupMoves: (u, d, x, t) => `${u} ${u === 1 ? 'is' : 'are'} up today, ${d} down, ${x} without a reading yet${t ? ` (as of ${t})` : ''}.`,
  explainLeftOut: (removed, notAssessed) => join([
    removed ? `${plural(removed, 'name', 'names')} removed by a condition` : null,
    notAssessed ? `${plural(notAssessed, 'name', 'names')} not assessed` : null,
  ]) + '.',
  explainNoneLeft: 'No name is left after these conditions.',
  dirUp: 'up',
  dirDown: 'down',
  dirFlat: 'flat at',

  // ── The modal's research blocks (BRS-17, BRS-18, BRS-18a) ──
  backToRanking: '‹ Back to ranking',
  forThisQuestion: 'For this question',
  placed: (p, n, measure) => `#${p} of ${n} placed · ${measure}`,
  notPlaced: (where) => `Not placed in this result · ${where}`,
  forLine: (text) => text,
  againstLine: (text) => text,
  finding: 'The finding',
  findingMove: (move, t) => `Today’s move ${move} · regular session · as of ${t}`,
  findingNoMove: (words) => `Today’s move · ${words}`,
  acrossLabel: 'Use across this result',
  acrossConfirm: (words, replaced, remain, fail, notAssessed) => `Keep names ${words}${replaced ? ` (in place of ${replaced})` : ''} · ${remain} would remain · ${fail} fail · ${notAssessed} not assessed`,
  apply: 'Apply',
  cancel: 'Cancel',
  applied: (remain) => `${remain} remain`,
  viewUpdated: 'View updated ranking',
  leftResult: (sym, move, words) => `${sym} is ${move} today, so “${words}” leaves it out of this result.`,
  leftResultNoMove: (sym, words) => `${sym} has no reading for today’s move, so “${words}” leaves it out of this result.`,
  compareWith: (inc) => `Compare with ${inc}`,
  compareWithHolding: 'Compare with a holding',
  compareRowMeasure: 'This question’s measure',
  compareRowRank: 'Technical rank',
  compareRowMove: 'Today’s move',
  compareRowRung: 'One rung',
  compareRowStands: 'Where it stands',
  compareRowSector: 'Sector',
  compareHoldingStands: (r, t) => `${r} rungs from entry at the ${t} check`,
  compareLock: (inc, t, total) => `Swapping ${inc} out at the ${t} check’s price locks ${signedPts(total)} pts`,
  tradeoff: (cand, inc, candWins, incWins) => `${cand} ${candWins.length ? candWins.join(' and ') : 'leads on nothing here'}; ${inc} ${incWins.length ? incWins.join(' and ') : 'leads on nothing here'}.`,
  tradeoffRank: (other) => `out-ranks ${other}`,
  tradeoffMove: (words) => `is ${words}`,
  evidence: (measures, cand, inc, elig) => (measures.length
    ? `On ${measures.join(' and ')}, ${cand} is ahead of ${inc}${elig}. None of this says how it would score from here.`
    : `On these readings, ${cand} isn’t ahead of ${inc}${elig}. None of this says how it would score from here.`),
  evidenceNow: '. It can come in now',
  evidenceCant: (why) => `. It can’t come in now: ${why}`,
  evidenceLocked: (t) => `. It’s locked until ${t}`,
  evidenceNone: (cand, inc, elig) => `${cand} and ${inc} share no reading to compare here${elig}. None of this says how it would score from here.`,
  measuresRank: 'technical rank',
  measuresMove: 'today’s move',
  draftFor: (agent) => `Draft it for ${agent}`,
  draftDoor: (agent) => `Draft it for ${agent} →`,
  nothingSent: 'Nothing is sent',
  ranksLine: (t) => `All stocks · technical rank · ${t} ET`,
  pickHolding: 'Compare with',
  // The incumbent item's source label in state 2 (Phase 0 point 6): the bench door names "its call in
  // the cockpit"; an incumbent that came from research names the question instead.
  srcResearch: 'your research question',

  // ── The draft (BRS-19) and the Ask (BRS-20) — one line per fact, every reading with its time ──
  draftHead: (question, t) => `Research: "${question}" (result ${t} ET)`,
  draftThen: (parts) => `Then: ${parts.join(' · ')}`,
  draftVs: (cand, inc) => (inc ? `${cand} vs ${inc}:` : `${cand}:`),
  draftRank: (parts, t) => `• Rank: ${parts.join(', ')} (ranks ${t})`,
  draftMove: (parts, from, to) => `• Today: ${parts.join(', ')} (${from === to ? `quote ${from}` : `quotes ${clockRange(from, to)}`} ET)`,
  draftRung: (parts) => `• Rung: ${parts.join(', ')}`,
  draftSector: (parts) => `• Sector: ${parts.join(', ')}`,
  draftStands: (parts) => `• ${parts.join(' ')}`,
  draftCandNow: (cand) => `${cand} can come in now.`,
  draftCandLocked: (cand, t) => `${cand} is locked until ${t}.`,
  draftCandCant: (cand, why) => `${cand} can’t come in: ${why}.`,
  draftHoldingStands: (inc, r, t) => `${inc} is ${r} rungs from entry at the ${t} check.`,
  draftClose: (cand, inc) => (inc ? `Should ${cand} replace ${inc}?` : `What do you make of ${cand}?`),
  askTimes: (ranksAt, from, to) => join([ranksAt ? `ranks ${ranksAt} ET` : null, from ? `quotes ${clockRange(from, to)} ET` : null]),
  askTop: 'Top names:',
  askLine: (parts) => `• ${parts.join(' · ')}`,
  askClose: 'What do you make of these?',
  rungEstimateShort: (pctText, t) => `≈${pctText} (estimate, ATR reading ${t} ET)`,
  rungFixedShort: (pctText) => `${pctText} (fixed at entry)`,
});

/** Why a name can't come in (BRS-15), in plain words. */
export function eligibilityWhy(reason) {
  if (reason === 'pick_not_on_bench') return 'on the equipped list only';
  if (reason === 'pick_wrong_class') return 'a crypto can’t replace a stock';
  if (reason === 'pick_already_held') return 'already held';
  if (reason === 'pick_is_symbol') return 'it is the holding itself';
  if (reason === 'pick_locked') return 'locked';
  return 'not on the swap’s lists';
}

/** "1st", "2nd", "3rd", "11th". */
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
