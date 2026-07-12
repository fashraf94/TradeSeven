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
import { readAgentStars, readUserStars, readDroppedPickLedger } from '../../../utils/leagueStarMeter';
import { isFlat6ActivationDay } from '../../../utils/flat6BattleEnrichment';
import { deriveBeats } from '../../../utils/leagueBeats';
import { getClaimWindowDisplay } from '../../../utils/tournamentSurfaces';
import {
  getLatestDayEntry, getWeeklyComposite, rankByScores, WEEK_DAYS_REQUIRED, TOURNAMENT_TUNING, BASELINE_POLICY,
  GROUP_STATUS, computeComposite,
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

  // ── canonical-open policy (Spec §1.1) — read the STAMP, not a flag. Drives the
  // user-layer settlement states (pending/estimated/official/void). Legacy /
  // absent-stamp rounds → false → settleState null → render exactly as today. ──
  const canonicalPolicy = group?.baselinePolicy === BASELINE_POLICY.CANONICAL_OPEN;
  const latestDay = getLatestDayEntry(group);
  // `dayBanked`: today's ET date already has a banked snapshot → an open captured
  // leg reads `official` (not `estimated`). Pure w.r.t. the injected `now`.
  const todayEt = now != null
    ? new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    : null;
  const dayBanked = !!(todayEt && latestDay?.entry?.recordedDate === todayEt);

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
    ? readUserStars(myPlayer, quotesFromPrices(priceCtx?.effectivePrices, myPlayer), { canonicalPolicy, dayBanked })
    : [];
  // Layer-level pending marker (Spec Deliverable 3) — canonical rounds only;
  // legacy stars carry settleState null so this is 0 (no marker) as today.
  const userPending = userStars.filter((s) => s?.settleState === 'pending').length;

  // ── live YOUR-seat composite (Branch 1) — the orb's banked source (the climb
  // series / getWeeklyComposite) is the cumulative daily-CLOSE composite: 0
  // before the first close, frozen intraday. Recompose it LIVE for your OWN seat
  // from the SAME live star rows the dock renders, so the altitude the orb shows
  // agrees with those cells by construction (§9 — one source, one tick). Two
  // accounting asymmetries are handled deliberately:
  //   • agent battles are fullday/daily docs (AGENT_BATTLE_DURATION_MODE), so
  //     `agentStars` is TODAY's layer only — add the prior days' BANKED cumulative
  //     agent (closeScores.agentPoints, the very value every other orb reads) so
  //     the estimate settles to the banked composite at close, not with a per-day
  //     jump.
  //   • user legs persist across the week, so `userStars` is already cumulative.
  // Gated tightly so it can only ever ADD today's layer once, and only where the
  // founder scoped it (Branch 1):
  //   • mode==='training' — training only. Ranked stays banked (its sealed-rival
  //     cut line + stakes make a live-vs-banked mixed climb a separate call).
  //   • status BATTLE, not-yet-banked today, a real (owner-only) battle present.
  //   • now present AND the battle was ACTIVATED today — so a stale prior-day doc
  //     (the pre-deploy morning window, before today's fullday doc lands) can't
  //     add its already-banked agent layer a second time. Anything failing these
  //     falls through to the banked series (the live→final settle; CPU/lobby stay
  //     banked). k lives in computeComposite (never re-derived).
  const youOrbLive = mode === 'training'
    && group?.status === GROUP_STATUS.BATTLE
    && !dayBanked
    && !!battle
    && now != null
    && isFlat6ActivationDay(battle, now);
  const sumPoints = (rows) => rows.reduce((acc, s) => acc + (Number.isFinite(s?.points) ? s.points : 0), 0);
  const bankedAgentRaw = latestDay?.entry?.closeScores?.[uid]?.agentPoints;
  const priorBankedAgent = Number.isFinite(bankedAgentRaw) ? bankedAgentRaw : 0;
  const youLiveScore = youOrbLive
    ? computeComposite(priorBankedAgent + sumPoints(agentStars), sumPoints(userStars))
    : null;

  // ── DEPARTED-POSITION POINTS (Phase 1 — the §9 precondition, DISPLAY ONLY) ──
  // Two banked sources leave the live star grid but the banked close still
  // counts them, so the shipped orb under-reports until close. Surface them —
  // settled/past-tense — so Phase 2 can add them to the orb with every term on
  // screen. This block is ADDITIVE: it never touches youLiveScore/agentStars/
  // userStars/the orb. Gated on `youOrbLive` — the SAME condition under which
  // the live orb runs — so (a) the surfaced sums correspond exactly to what the
  // Phase-2 live term will add (§9), and (b) ranked/banked/pre-deploy/non-
  // training render byte-identical (both fields null → no chip).
  //   • agent: Σ trades[].lockedPoints — the subbed-out positions' realized
  //     points. trades[] is TODAY's fresh daily doc (Phase-0 A1), so no cross-
  //     day double-count and no swapDay filter is needed.
  //   • user: Σ droppedPicks banked (via readDroppedPickLedger → scorePick). A
  //     SAME-DAY drop's final leg banks post-close, so it shows as a pending
  //     bank (no number), bounded to the drop day (A3 founder ruling).
  let agentDeparted = null;
  let userDeparted = null;
  if (youOrbLive) {
    const swapItems = (Array.isArray(battle?.trades) ? battle.trades : [])
      .filter((t) => t && (t.symbolOut || t.symbolIn))
      .map((t) => ({
        out: t.symbolOut ?? null,
        in: t.symbolIn ?? null,
        pts: Number.isFinite(t.lockedPoints) ? t.lockedPoints : 0,
        day: Number.isFinite(t.swapDay) ? t.swapDay : null,
      }));
    if (swapItems.length > 0) {
      agentDeparted = { total: swapItems.reduce((a, s) => a + s.pts, 0), items: swapItems };
    }
    const dropItems = readDroppedPickLedger(myPlayer);
    if (dropItems.length > 0) {
      userDeparted = {
        total: dropItems.reduce((a, d) => a + (Number.isFinite(d.banked) ? d.banked : 0), 0),
        pendingCount: dropItems.filter((d) => d.pending).length,
        items: dropItems,
      };
    }
  }

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
    // Phase-5 close-only claim disable (Deliverable 4): a canonical round is
    // close-only, so when the wire is shut BECAUSE the market is open
    // (reason 'market_hours') the control shows a specific "claims open after
    // close" state (consuming the Phase-4 server contract), not a bare disable.
    // Legacy rounds carry canonical:false → the claim UI is unchanged.
    canonical: canonicalPolicy,
    reason: win.reason ?? null,
  };

  // ── youRank at the last banked index (REUSE rankByScores; never 0). When the
  // orb runs live for your seat, your RANK must move with it — the same live
  // score ClimbArena's `at` ranks you by — so the crown/altitude and the voice/
  // ask standing ("protect the lead" vs "catch up") agree by construction (§9);
  // rivals stay on their banked series exactly as the orbs do. ──
  const lastIdx = liveDayIdx(climb);
  const ids = seats.map((s) => s.id);
  const scoresAtLast = {};
  for (const id of ids) {
    scoresAtLast[id] = (id === uid && youLiveScore != null)
      ? youLiveScore
      : (climb[id]?.[lastIdx] ?? 0);
  }
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
    youLiveScore, // Branch 1: your live intraday composite for the orb (null = banked)
    agentDeparted, // Phase 1: subbed-out agent points (Σ trades lockedPoints) — null off-gate
    userDeparted, // Phase 1: dropped-pick banked points + pending same-day drops — null off-gate
    agentStars,
    userStars,
    userPending, // canonical-round count of picks awaiting the open (Deliverable 3)
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
