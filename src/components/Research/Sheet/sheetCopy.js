// src/components/Research/Sheet/sheetCopy.js
//
// Research Modal Build C — EVERY STRING the sheet puts on screen (spec
// docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md §4.4). The components and
// the pack builder render copy from here and nowhere else, so
// sheetCopy.honesty.test.js can scan all of it — this source and every
// rendered template — for the forbidden terms ("the agent held off", "will
// bank", "stop at $X", "what it read", and any stop or target price).
//
// PLAIN WORDS (R-14): record kinds and states render with plain labels; ledger
// vocabulary stays in the data. Every number a template prints is handed to it
// by the caller from one source (BUILD_RULES §9); no template computes.
//
// NODE-CLEAN: the server (api/_utils/researchAsk.js, through packs.js) renders
// the same item facts the player saw, so this module imports nothing that
// needs a browser.

import { priceText } from '../priceFormat.js';

export const money = (price, decimals) => `$${priceText(price, decimals)}`;
const pct1 = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;
const abs1 = (v) => `${Math.abs(v).toFixed(1)}%`;
const share = (w) => `${Math.round(w * 100)}%`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * The playbook questions (R-10; QF-1, QF-5). The ids are packs.js QUESTION_IDS. QF-5 kept the
 * stored id `better_than_stalled` (chat.js writes it on every exchange) and changed only its words.
 * "Take profit" is the player's question — the sheet never says the agent takes it (QF-9).
 */
export const QUESTION_TEXT = Object.freeze({
  catch_up: 'Does this help us catch up?',
  protect_lead: 'Does this protect the lead?',
  better_than_stalled: 'Is this better than our weakest holding?',
  weakest_spot: 'Is this our weakest spot?',
  take_profit: 'Should we take profit?',
});

/** A rungs-from-entry reading as printed (QF-2): one decimal, a sign, never "−0.0". The rank is decided on this number. */
export const rungsShownOf = (v) => {
  const r = Number(Number(v).toFixed(1));
  return r === 0 ? 0 : r;
};
export const rungsText = (shown) => (shown === 0 ? '0.0' : `${shown > 0 ? '+' : '−'}${Math.abs(shown).toFixed(1)}`);
const signed = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;
const ordinal = (n) => {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th');
  return `${n}${s}`;
};

/** An archetype factor in plain words (archetypeScoring.js ARCHETYPE_WEIGHTS keys). */
export const FACTOR_WORDS = Object.freeze({
  technicalScore: 'the technical trend',
  baggerBombFit: 'BaggerBomb fit',
  atrPercentile: 'volatility',
  fundamentalScore: 'fundamentals',
  inverseComposite: 'names the platform scores low',
  sectorDiversity: 'sector spread',
});

/** A check's risk verdict (agentRiskManager.js evaluateRiskAction actions) in plain words. */
export const RISK_WORDS = Object.freeze({
  HOLD: 'hold',
  LOCK: 'hold — close to the next rung',
  // An EXIT: the cron swaps it out (agent-evaluate.js riskSwaps) — review A13.
  TRAIL_STOP: 'swap it out — its trailing stop tripped',
  SWAP_OUT: 'swap it out',
  EMERGENCY_SWAP: 'swap it out — near a bust',
});
/** The reason a SWAP_OUT names, in plain words. */
export const RISK_REASON_WORDS = Object.freeze({
  vwap_failure: 'under VWAP',
  stagnation: 'stalled',
});

/**
 * A check's regime word in plain words: tickStamps.js stamps stockRegimes[sym],
 * which agentRegimeClassifier.js classifyStockRegime writes as one of these four.
 * Any other word is left out of the item (never guessed at).
 */
export const REGIME_WORDS = Object.freeze({
  choppy: 'choppy',
  distressed: 'distressed',
  directional_expansion: 'a widening trend',
  directional_contraction: 'a narrowing trend',
});

export const SHEET_COPY = Object.freeze({
  // ── The pack's label (BC-4) and the section heads ──
  weighs: (arch) => `What ${arch} weighs`,
  askAbout: (sym) => `Ask about ${sym}`,
  askAboutRight: 'see the evidence first · free',
  orAsk: 'Or ask',
  packFree: 'free · no message spent',
  packAsked: 'asked · 1 message',
  packEmpty: (arch) => `Nothing on the record bears on this for ${arch} yet.`,
  backToQuestions: 'Back to the questions',
  pinTag: '● on the chart',
  voiceMore: 'Show the whole sentence',

  // ── The stance line (Layer 0, BC-9, BC-15) ──
  stanceHolding: 'Holding',
  stanceHoldingSince: (when) => `Holding since ${when}`,
  stanceEntry: (price, d) => `entry ${money(price, d)}`,
  stanceMove: (movePct) => pct1(movePct),
  stanceBanked: (points) => `+${points} banked`,
  stanceBench: (time) => `On the bench · flagged at ${time}`,
  stanceUnexamined: 'Not examined in this game',
  // FQ-2 (2026-11-08): a name a check examined, not held now.
  stanceLooked: (time) => `Looked at ${time} · not held now`,
  stanceIdeaUnexamined: 'In this game’s idea · not examined',
  stanceIdea: (date) => `In this game’s idea · since ${date}`,
  ideaOpen: 'Tap to read the whole idea',
  ideaClose: 'Show less',

  // ── The latest sentence (BC-3) ──
  voiceDecided: 'What it decided',
  voiceCalled: 'What it called',
  voiceFlagged: 'What it flagged',
  voiceNothing: 'From the record',
  voiceWho: (arch, time) => `${arch} · ${time}`,
  checkedNothingSaid: (time, sym) => `Checked at ${time} · nothing said about ${sym}`,
  // FQ-5 (2026-11-08): an exit flag, quoted in its own words — never a bench flag.
  voiceFlaggedExit: (time) => `What it flagged · exit · ${time}`,
  lastLookedAt: (time) => `Last looked at ${time}`,
  notLooked: (arch) => `${arch} hasn’t looked at this one`,

  // ── The tucked row (BC-14) ──
  about: 'About',
  aboutClose: 'Hide',

  // ── The action row (R-4′, BC-7, BC-12) ──
  askPick: (arch) => `Ask ${arch} · pick a question first`,
  askQuestion: (arch, q) => `Ask ${arch}: ${q.charAt(0).toLowerCase()}${q.slice(1)}`,
  askCost: (left) => `· 1 message · ${left} left`,
  askOut: 'No messages left this game',
  askAsked: (arch) => `Asked ${arch} · the answer is below`,
  askSending: (arch) => `${arch} is answering…`,
  toCockpit: '→ Cockpit',
  askMessage: (question, sym) => `${question} — ${sym}`,

  // ── The reply card (Layer 2, BC-7) ──
  replyEyebrow: 'Its answer',
  replyFrom: 'from: the items above',
  replySpent: '1 message spent',
  replyOneExchange: 'one exchange · shown here and in chat',
  replyFiled: '✓ filed to chat',
  replyFiling: 'filing to chat…',
  replyDirective: (text) => `It filed an instruction: “${text}”`,
  failNotCharged: (arch) => `${arch} didn’t answer. No message was used.`,
  failNotChargedOut: 'No messages left this game. No message was used.',
  failNotChargedClosed: 'This game isn’t taking questions now. No message was used.',
  failUnknown: 'Something went wrong. Check chat before asking again — a message may have been used.',

  // ── Pack items (BC-4, BC-5, BC-6, BC-10, BC-11) — one template per record or config value ──
  // catch up
  // ladder.js toGo's displayed numbers: the % with two decimals, as Bomb mode prints it.
  rungDistance: (points, price, d, gap, gapPct) => `Next rung +${points} at ${money(price, d)} · ${money(gap, d)} (${gapPct.toFixed(2)}%) to go`,
  moveSinceEntry: (movePct, entry, d, when) => `${pct1(movePct)} since entry at ${money(entry, d)}${when ? ` (${when})` : ''}`,
  checkRead: (time, parts) => `The ${time} check saw ${parts.join(' · ')}`,
  // tickStamps.js: `chg` is the position's change FROM ENTRY (not the session's),
  // and `atrX` is that change in the scorer's own unit — the first rung is 1.00×.
  checkReadFromEntry: (chg) => `${pct1(chg)} from entry`,
  // "−" (U+2212) as the rest of the sheet prints it, the sign taken from the printed value (never "−0.00").
  checkReadAtr: (atrX) => `${atrX < 0 && Number(Math.abs(atrX).toFixed(2)) > 0 ? '−' : ''}${Math.abs(atrX).toFixed(2)}× a rung step (the first rung is 1.00×)`,
  checkReadNr7: 'its tightest range in 7 days',
  rule: (arch, f1, w1, f2, w2) => (f2
    ? `${arch} ranks names by ${FACTOR_WORDS[f1]} first (${share(w1)} of its ranking), then ${FACTOR_WORDS[f2]} (${share(w2)})`
    : `${arch} ranks names by ${FACTOR_WORDS[f1]} first (${share(w1)} of its ranking)`),
  standingTrail: (you, them) => `You trail ${you} – ${them}`,
  standingLead: (you, them) => `You lead ${you} – ${them}`,
  standingTied: (you, them) => `Tied ${you} – ${them}`,
  // protect the lead
  riskVerdict: (time, words) => `Risk check at ${time}: ${words}`,
  riskLever: (arch, preset, bust, ticks, band, trail) => `${arch} on ${preset}: swaps out ${bust} ATR below entry, or after ${plural(ticks, 'check', 'checks')} in a row under VWAP ending ${band}% below; past +${trail} ATR, a dip under its 5-min average sells it`,
  banked: (points, next) => (points > 0
    ? `+${points} banked at the checks${next ? ` · ${next}` : ''}`
    : `Nothing banked yet${next ? ` · ${next}` : ''}`),
  nextCheckAt: (label) => `next check ${label}`,
  checkRunning: (time) => `the ${time} check is running`,
  drawdown: (offPct, high, d, when, since) => `${abs1(offPct)} off its high since ${since} (${money(high, d)}, ${when})`,
  atHighLive: (live, d, since) => `At its high since ${since}: ${money(live, d)} live`,
  // better than what's stalled
  stalled: (arch, ticks, names) => (names.length
    ? `Stalled by ${arch}’s own count (${ticks} quiet checks): ${names.join(', ')}`
    : `None of its names has reached ${ticks} quiet checks`),
  noRotation: (arch) => `${arch} doesn’t rotate out of quiet names`,
  incumbent: (sym, n, arch, ticks) => `${sym} is the name it would replace · ${plural(n, 'quiet check', 'quiet checks')} in a row; ${arch} counts a name stalled at ${ticks}`,
  incumbentNoRotation: (sym) => `${sym} is the name it would replace`,
  rungCompare: (rows) => `At the last check: ${rows.join(' · ')}`,
  rungCompareRow: (sym, gap, d, points) => `${sym} ${money(gap, d)} from +${points}`,
  rungCompareTop: (sym) => `${sym} past its top rung`,
  rankScores: (arch, rows, asOf) => `${arch}’s ranking: ${rows.join(' · ')}${asOf ? ` (rankings as of ${asOf})` : ''}`,
  rankRow: (sym, score) => `${sym} ${Math.round(score)}`,
  benchSignal: (time, summary) => `Flagged at ${time}: ${summary}`,
  // QF-2 — a held measured stock's place in the book, in rungs from entry at the last check.
  // `rows` are rungsText strings; `others` the held names not on the measured ladder (never ranked).
  // `pending`: held measured stocks the check could not score (review A3) — named, so the count is never short.
  bookRank: (sym, rungs, rank, n, lowSym, lowRungs, time, others, pending) => `${rank === 1
    ? (n === 1 ? `${sym} is ${rungs} rungs from entry, your only stock on the ladder` : `${sym} is ${rungs} rungs from entry, the lowest of your ${n} stocks`)
    : `${sym} is ${rungs} rungs from entry, the ${rank === n ? 'highest' : `${ordinal(rank)} lowest`} of your ${n} stocks; the lowest is ${lowSym} at ${lowRungs}`}${time ? ` · at the ${time} check` : ''}${pending.length ? ` · no check yet: ${pending.join(', ')}` : ''}${others.length ? ` · not on the ladder: ${others.join(', ')}` : ''}`,
  // QF-3 — how long the opened name has been quiet, against the archetype's rotation rule.
  quietTicks: (sym, n, arch, ticks) => `${sym}: ${plural(n, 'quiet check', 'quiet checks')} in a row; ${arch} counts a name stalled at ${ticks}`,
  // QF-3 / QF-4 — the best available bench name by the archetype's ranking, with its rung size (BS-4's ATR reading).
  benchAlternative: (arch, sym, score, rank, n, atr, asOf) => `Best on the bench by ${arch}’s ranking: ${sym} ${Math.round(score)} (#${rank} of ${n})${atr ? ` · estimated rung size: ATR reading ${atr}` : ''}${asOf ? ` (rankings as of ${asOf})` : ''}`,
  // QF-4 — what a swap-out at the last check's price would have locked (QF-0: the gain part and every
  // crossed rung, at the exit price). The real lock uses the swap's own later quote, so the item names the check.
  lockNow: (time, price, d, total, gain, banked, hit) => `Swapped out at the ${time} check’s ${money(price, d)}, it would lock ${signed(total)}: ${signed(gain)} from the gain, ${signed(banked)} banked${hit ? `, ${signed(hit)} from downside rungs` : ''}`,
  // QF-4 — what holding risks: the way back to entry and to the next downside rung (ladder.js toGoDown), displayed values.
  rungDown: (entry, d, entryGap, entryPct, down) => `${entryGap > 0
    ? `${money(entryGap, d)} (${entryPct.toFixed(2)}%) down to entry at ${money(entry, d)}`
    : `At or below entry (${money(entry, d)})`}${down
    ? (down.gap > 0
      ? ` · ${money(down.gap, d)} (${down.pct.toFixed(2)}%) down to the next downside rung, ${down.label} (${signed(down.points)}) at ${money(down.price, d)}`
      : ` · at or under the next downside rung, ${down.label} (${signed(down.points)}) at ${money(down.price, d)}`)
    : ''}`,
  // QF-1 — a held position the measured ladder does not score (a legacy stock, crypto).
  notOnLadder: (sym) => `${sym} isn’t on the measured ladder, so only the standing questions apply.`,
  // QF-1, ruling 2 (2026-11-13) — a held measured stock with no committed context yet (just after a swap):
  // the next check's time from Build A's clock; none (no slot left) → the line without it.
  bookPending: (checkTime) => (checkTime ? `Your book is ranked at the next check (${checkTime})` : 'Your book is ranked at the next check'),
  // loop items
  idea: (statement) => `This game’s idea: “${statement}”`,
  toldIt: (text) => `“${text}”`,

  // ── Item source labels (§3.2 source.label) ──
  srcCheck: (time) => `the ${time} check`,
  srcPosition: 'the battle record',
  srcLive: 'live price vs entry',
  srcLiveRung: 'live price vs the next rung',
  srcLiveDown: 'live price vs entry and the next downside rung',
  srcCall: 'its call in the cockpit',
  srcChart: (date) => `from the chart, as of ${date}`,
  srcConfig: (arch) => `${arch}’s config`,
  srcPreset: 'its risk setting',
  srcStanding: 'the scoreboard',
  srcCounter: 'its stall counter',
  srcRankings: 'the platform rankings',
  srcIdea: 'this game’s idea',
  srcToldIt: (time, huddle) => `What you told it · ${time}${huddle ? ' · from this morning’s huddle' : ''}`,

  // ── Chart pins (BC-8) ──
  pinEntry: (when) => `Entry · ${when}`,
  pinCall: (when) => `Called · ${when}`,
  pinAnswer: (when) => `You answered · ${when}`,
  pinCheck: (when) => `What it decided · ${when}`,
  pinFlag: (when) => `What it flagged · ${when}`,
  lineEntry: (price, d) => `entry ${money(price, d)}`,
  lineIdeaLive: (side, price, d) => `live ${side} ${money(price, d)}`,
  lineIdeaWrong: (side, price, d) => `wrong ${side} ${money(price, d)}`,
  // BC2-5 — the next rung each way on Battle, at 💣's displayed price (ladder.rungShown).
  lineRungUp: (points, price, d) => `next rung +${points} · ${money(price, d)}`,
  lineRungDown: (label, points, price, d) => `${label} ${signed(points)} · ${money(price, d)}`,
  // A tapped item's own pin, when no record pin sits at its instant or price (review D5).
  pinAt: (when) => `This item · ${when}`,
  pinLine: (word, price, d) => (word ? `${word} · ${money(price, d)}` : money(price, d)),
});

/**
 * The two-view shell (Amendment C; spec docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md
 * SB-13) — every string the shell adds: the header's pills, the Analysis view's
 * blocks, the tab strip, What's moving, the Ranks label and the browse row. The
 * agent's name is always handed in (the sheet context's agentName), never written here.
 */
export const SHELL_COPY = Object.freeze({
  // ── The header control (H1, R-27) ──
  viewsLabel: 'View',
  viewAnalysis: 'Analysis',
  viewChart: 'Chart',
  viewBomb: '💣',
  viewBombLabel: 'Bomb mode',
  headerBack: 'Back',
  headerClose: 'Close',
  // ── What it decided (R-23): the player's agent name, then the archetype; the time of a quoted line ──
  voiceLabel: (agent, arch, time) => [agent, arch, time].filter((s) => typeof s === 'string' && s).join(' · '),
  // The quote's time, set after the name and archetype in its own span (it is never ellipsized).
  voiceTime: (time) => ` · ${time}`,
  // ── The action row away from the Analysis view, where the Ask's answer card is ──
  askAskedOnAnalysis: (who) => `Asked ${who} · the answer is on Analysis`,
  // ── A pack item with a place on the chart ──
  seeOnChart: 'see on chart ›',
  // ── The Chart view's own states (today's chart box, in the shell's skin) ──
  chartUnavailable: 'Chart data unavailable',
  chartRetry: 'Retry',
  // ── The Battle pill (BC2-1 – BC2-4): the battle's own sessions in intraday bars ──
  timeBattle: 'Battle',
  battleUnavailable: 'The battle’s intraday bars are unavailable',
  battleEmpty: 'No battle bars yet: its first session hasn’t traded',
  // 1D and 1W: a day's record merged into one marker, with its count; its chip opens Battle.
  dayCount: (weekday, count) => `${weekday} · ${count}`,
  dayChip: (count, weekday) => `${count} on ${weekday} · Battle ›`,
  dayChipsLabel: 'The record by day',
  // ── The Wall St · About line (R-27's quiet line; the analyst consensus, labelled) ──
  wallSt: (rating, n) => `Wall St ${rating} · ${n} ${n === 1 ? 'analyst' : 'analysts'}`,
  wallStNone: 'Wall St · no coverage',
  aboutName: (name) => `About ${name}`,
  aboutHide: 'Hide',
  // ── Browse: today's five preset questions, folded into one row (SQ-3) ──
  browseAsk: 'Ask about this stock',
  // ── The tab strip (SB-7) ──
  tabsLabel: 'Analysis sections',
  tabMoving: 'What’s moving',
  tabRanks: 'Ranks',
  tabSmartMoney: 'Smart Money',
  tabSector: 'Sector',
  // ── What's moving: loaded on the player's tap, never on open (no request on open) ──
  movingTitle: (name, change) => `Why is ${name} ${change || 'moving'}?`,
  // The day's change as the header prints it: two decimals (one source, one precision — §9).
  movingChange: (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%`,
  movingLookUp: 'Look it up',
  movingFrom: 'from the wire and the day’s bar',
  movingFoot: (who) => (who ? `From the wire and the day’s bar · not ${who}’s view` : 'From the wire and the day’s bar'),
  // ── The Ranks label (R-32): the group the rank is within, the rank, the day of the reading ──
  ranksLabel: (group, kind, day) => (day ? `${group} · ${kind} rank · ${day}` : `${group} · ${kind} rank`),
  ranksAllStocks: 'All stocks',
  ranksFundamental: 'fundamental',
  ranksTechnical: 'technical',
});

/** What a tapped item's price IS, for its own line's title (never the item's source label). */
export const PIN_LINE_WORDS = Object.freeze({
  rung_distance: 'next rung',
  banked: 'top banked rung',
  rung_down: 'next downside rung',
  drawdown: 'the high',
  idea: 'the idea’s level',
});

