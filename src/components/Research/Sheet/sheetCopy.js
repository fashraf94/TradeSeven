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

/** The three playbook questions (R-10), in the design's order. The ids are packs.js QUESTION_IDS. */
export const QUESTION_TEXT = Object.freeze({
  catch_up: 'Does this help us catch up?',
  protect_lead: 'Does this protect the lead?',
  better_than_stalled: 'Is this better than what’s stalled?',
});

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
  checkReadAtr: (atrX) => `${atrX.toFixed(2)}× a rung step (the first rung is 1.00×)`,
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
  // loop items
  idea: (statement) => `This game’s idea: “${statement}”`,
  toldIt: (text) => `“${text}”`,

  // ── Item source labels (§3.2 source.label) ──
  srcCheck: (time) => `the ${time} check`,
  srcPosition: 'the battle record',
  srcLive: 'live price vs entry',
  srcLiveRung: 'live price vs the next rung',
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
  // A tapped item's own pin, when no record pin sits at its instant or price (review D5).
  pinAt: (when) => `This item · ${when}`,
  pinLine: (word, price, d) => (word ? `${word} · ${money(price, d)}` : money(price, d)),
});

/** What a tapped item's price IS, for its own line's title (never the item's source label). */
export const PIN_LINE_WORDS = Object.freeze({
  rung_distance: 'next rung',
  banked: 'top banked rung',
  drawdown: 'the high',
  idea: 'the idea’s level',
});

