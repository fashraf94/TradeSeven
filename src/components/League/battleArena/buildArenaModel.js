// src/components/League/battleArena/buildArenaModel.js
//
// League Battle View V2 — THE REAL-DATA BRIDGE (Phase 3, pure + node-clean). The
// single place where the live tournament docs (group, your flat6 battle, the live
// price context, your claims, seat names) become the arena's existing prop shapes.
// Every field traces to a REUSED Phase-1 adapter or a canonical leagueTournament /
// leagueAdapter helper — Phase 3 adds NO scoring math (BUILD_RULES §4). Scoring is
// reached only via readAgentStars/readUserStars (→ calculateAssetScoreV3), never
// copied; none of the 8 fenced api/ files is touched.
//
// OWNER-ONLY (founder ruling): only YOUR battle is read (your six + your three).
// Rivals on the climb stay WHAT-only sealed — their stars, books and archetypes
// are never fetched here (buildSeat gets battle=null for rivals → arch omitted).
//
// PURE: given its inputs (incl. an injected `now` inside priceCtx) it is
// referentially transparent and unit-tested. Effects/subscriptions/timers live in
// useArenaModel; this module is the testable transform, and its co-located test's
// import IS the dependency-surface guard (loads clean in Node — never mocked).

import { buildSeat, seatColor } from '../leagueAdapter';
import { buildClimbSeries } from '../leagueClimbAdapter';
import { readAgentStars, readUserStars } from '../../../utils/leagueStarMeter';
import { deriveBeats } from '../../../utils/leagueBeats';
import { getClaimWindowDisplay } from '../../../utils/tournamentSurfaces';
import {
  getLatestDayEntry, getWeeklyComposite, rankByScores, WEEK_DAYS_REQUIRED, TOURNAMENT_TUNING,
} from '../../../constants/leagueTournament';
import { statusFeedToVoice } from './statusFeedToVoice';
import { LEAGUE_AGENT_CHAT_ENABLED } from '../../../config/featureFlags';

// The strategy chips (founder starter set) for the two-way ask. Each chip's text
// IS the message sent to the agent (cost 1, same budget + honesty path as free-text)
// — so the shape is { q } (no canned answer; the stub's { q, a } echo is gone under
// the flag). The last slot is standing-aware: chosen from youRank client-side (a swap,
// not a new fetch). Empty when the flag is off → today's stub (no chips).
const STRATEGY_CHIPS = [
  "What's your plan from here?",
  'Where are we winning and losing right now?',
  'How do my three picks compare to your six?',
  'What would you change about our lineup?',
  'What are you watching for the rest of the battle?',
];

/** The ask chips incl. the standing-aware slot. youRank 1-4 (1-2 = advancing). */
export function buildAskChips(youRank) {
  const standing = youRank <= 2
    ? 'How do we protect the lead?'
    : "We're down — how do we catch up?";
  return [...STRATEGY_CHIPS, standing].map((q) => ({ q }));
}

// YOUR presence is teal — the locked design/fixture invariant. Inlined as the
// literal (== leagueTokens LX.energy / CMD.teal) so this module imports NO
// leagueTokens (which transitively pulls the browser-side commandUI) and stays
// node-clean for its test — the same discipline leagueAdapter documents.
const YOU_COLOR = '#5EEAD4';

/** The last banked day index of a climb series (awaiting/empty → 0). */
export function liveDayIdx(climb) {
  let maxLen = 0;
  for (const id of Object.keys(climb || {})) maxLen = Math.max(maxLen, (climb[id]?.length) || 0);
  return Math.max(0, maxLen - 1);
}

/** effectivePrices {[sym]:number} + your picks → readUserStars' {[sym]:{current}}. */
function quotesFromPrices(effectivePrices, myPlayer) {
  const out = {};
  for (const pick of myPlayer?.picks || []) {
    const sym = pick?.symbol;
    if (sym && Number.isFinite(effectivePrices?.[sym])) out[sym] = { current: effectivePrices[sym] };
  }
  return out;
}

/**
 * @param {Object} args
 * @param {Object} args.group   tournamentGroups doc (players, dailyScores, feed, userPool, status)
 * @param {Object|null} args.battle  YOUR flat6 agentBattles doc (null pre-deploy)
 * @param {Object} args.priceCtx { effectivePrices, previousClosePrices, now, isActivationDay }
 * @param {Object[]} args.claims  the claims subcollection rows
 * @param {Object<string,string>} args.displayNames  {odUserId: humanName}
 * @param {string|null} args.uid
 * @param {'training'|'ranked'} args.mode
 * @param {Object} args.prevStarStates  {you:StarRow[], agent:StarRow[]} from the prior tick
 * @param {Object|null} args.compositeContext  {composite, userPoints} from the host
 * @returns {Object} the arena's prop model (+ starStates for the next tick's prev)
 */
export function buildArenaModel({
  group, battle = null, priceCtx = {}, claims = [], displayNames = {},
  uid = null, mode = 'ranked', prevStarStates = {}, compositeContext = null,
} = {}) {
  const players = group?.players || [];
  const youId = uid;
  const myPlayer = players.find((p) => p?.odUserId === uid) || null;
  const now = Number.isFinite(priceCtx?.now) ? priceCtx.now : null;

  // ── seats (REUSE buildSeat; remap to the 7-field arena shape; YOU forced teal) ──
  // Orb identity — each seat a DISTINCT hue so the four read apart on the climb.
  // YOU's teal is RESERVED; rivals draw from the SAME seatColor source (not a new
  // palette) with cpu=false so CPU rivals get individual hues instead of the one
  // shared violet. seatColor's palette happens to include YOUR teal, and ids can
  // collide — so a hash that lands on YOUR teal or an already-taken rival hue is
  // re-rolled with a salt through the SAME util until it's free. Result: no rival
  // ever wears your teal, and the rivals stay mutually distinct.
  const takenColors = new Set([YOU_COLOR]);
  const rivalHue = (id) => {
    let c = seatColor(id, false);
    for (let salt = 1; takenColors.has(c) && salt <= 16; salt += 1) c = seatColor(`${id}#${salt}`, false);
    takenColors.add(c);
    return c;
  };
  const seats = players.map((p) => {
    const s = buildSeat({
      odUserId: p.odUserId,
      isCpu: p.isCpu === true,
      score: getWeeklyComposite(group, p.odUserId),
      picks: p.picks,
      battle: p.odUserId === uid ? battle : null, // archetype only from YOUR battle
      names: displayNames,
      uid,
    });
    const isCpuSeat = s.kind === 'cpu';
    // Name fallback — NEVER the raw odUserId. A CPU keeps its id-derived seat
    // label (cpuSeatName, which also carries the CPU's archetype); a human seat
    // resolves via displayNames and falls back to a clean 'Player' placeholder
    // when it can't resolve — the raw key would overflow the lane and mean
    // nothing, and the name is now the mobile climb's primary identifier.
    const name = isCpuSeat ? s.name : (displayNames[p.odUserId] || 'Player');
    return {
      id: s.id,
      name,
      kind: s.kind === 'human' && s.you ? 'you' : s.kind, // arena uses 'you'|'cpu'|'human'
      you: s.you,
      // owner is the snapshot's secondary identifier — resolved name for a human
      // rival, omitted for you/CPU (as before); never the raw key.
      owner: isCpuSeat || s.you ? undefined : (displayNames[p.odUserId] || undefined),
      // YOU stays teal (the locked invariant); rivals get a distinct, non-teal
      // hue from rivalHue (above).
      color: s.you ? YOU_COLOR : rivalHue(s.id),
      arch: s.archName, // the label (rivals → undefined; never fabricated — owner-only)
    };
  });
  const youSeat = seats.find((s) => s.you) || null;
  const archName = youSeat?.arch || 'Your agent';

  // ── climb (REUSE buildClimbSeries — exact {[id]: number[]}) ──
  const climb = buildClimbSeries(group, { metric: 'composite' });

  // ── stars (REUSE the Phase-1 meter readers) ──
  const agentStars = battle ? readAgentStars(battle, priceCtx) : [];
  const userStars = myPlayer
    ? readUserStars(myPlayer, quotesFromPrices(priceCtx?.effectivePrices, myPlayer), {})
    : [];

  // ── beats (REUSE deriveBeats; only YOUR stars are knowable — rivals sealed) ──
  const starStates = { you: userStars, agent: agentStars };
  const seatNames = Object.fromEntries(seats.map((s) => [s.id, s.name]));
  seatNames.you = 'You';
  seatNames.agent = archName;
  const beats = deriveBeats({
    series: climb,
    feed: group?.feed || [],
    trades: battle?.trades || [],
    claims,
    starStates,
    prevStarStates,
    seatNames,
    uid,
  });

  // ── voice (statusFeed → lane; read-only this phase) ──
  const voice = statusFeedToVoice(battle, now, archName);

  // ── pod (day from dailyScores; bell countdowns deferred → null = no live tick) ──
  const pod = {
    day: getLatestDayEntry(group)?.dayN || 0,
    days: WEEK_DAYS_REQUIRED,
    watchers: Number.isFinite(group?.watchers) ? group.watchers : null,
    toOpen: null,
    nextClose: null,
  };

  // ── wire (claim window: display-only, server-authoritative) ──
  const win = getClaimWindowDisplay(now != null ? new Date(now) : undefined);
  const myPending = (claims || []).filter((c) => c?.odUserId === uid && c?.status === 'pending').length;
  const wire = {
    open: !!win.isOpen,
    closes: win.isOpen && Number.isFinite(win.countdownMinutes) ? win.countdownMinutes * 60 : null,
    claimsUsed: myPending,
    claimsTotal: TOURNAMENT_TUNING.CLAIM_PENDING_CAP_PER_CYCLE,
  };

  // ── youRank at the last banked index (REUSE rankByScores; never 0) ──
  const lastIdx = liveDayIdx(climb);
  const ids = seats.map((s) => s.id);
  const scoresAtLast = {};
  for (const id of ids) scoresAtLast[id] = climb[id]?.[lastIdx] ?? 0;
  const ranked = rankByScores(scoresAtLast, ids);
  const yIdx = ranked.indexOf(uid);
  const youRank = yIdx >= 0 ? yIdx + 1 : ranked.length;

  // ── the claim sheet's inputs (canonical: add from userPool MINUS held) ──
  const heldSymbols = new Set((myPlayer?.picks || []).map((p) => p?.symbol).filter(Boolean));
  const poolNames = (group?.userPool || []).filter((s) => !heldSymbols.has(s));
  const myPicks = (myPlayer?.picks || []).map((p) => ({ symbol: p?.symbol })).filter((p) => p.symbol);

  return {
    seats,
    climb,
    youId,
    agentStars,
    userStars,
    beats,
    voice,
    pod,
    wire,
    youRank,
    headline: 'mult',
    compositeContext,
    mode,
    claim: { picks: myPicks, poolNames, claimsUsed: myPending, claimsTotal: TOURNAMENT_TUNING.CLAIM_PENDING_CAP_PER_CYCLE, open: !!win.isOpen },
    agentMove: null, // the "swapped X → Y" chip is derived from trades in a fast-follow
    // Two-way ask (flag-gated). Off → [] (today's stub: no chips, decorative box).
    // On → the strategy chips + the standing-aware slot. battleId/agentId carry the
    // live-battle identity the ask POST needs (null in the fixtures/preview path).
    ask: LEAGUE_AGENT_CHAT_ENABLED ? buildAskChips(youRank) : [],
    battleId: battle?.id ?? null,
    agentId: battle?.agentId ?? null,
    starStates, // returned so the hook can feed it as prevStarStates next tick
  };
}
