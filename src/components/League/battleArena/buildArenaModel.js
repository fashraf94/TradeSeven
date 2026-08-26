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

import { buildSeat, seatColor, archetypeLabel } from '../leagueAdapter';
import { buildClimbSeries } from '../leagueClimbAdapter';
import { buildSwapLedger } from './leagueSwapLedger';
import { readAgentStars, readUserStars, readDroppedPickLedger } from '../../../utils/leagueStarMeter';
import { resolveBaseATR } from '../../../../api/_utils/tournamentUserScoring.js';
import { isFlat6ActivationDay } from '../../../utils/flat6BattleEnrichment';
import { deriveBeats } from '../../../utils/leagueBeats';
import { getClaimWindowDisplay } from '../../../utils/tournamentSurfaces';
import {
  getLatestDayEntry, getWeeklyComposite, rankByScores, WEEK_DAYS_REQUIRED, TOURNAMENT_TUNING, BASELINE_POLICY,
  GROUP_STATUS, computeComposite, deriveCurrentTradingDay, cpuNFromUserId, cpuArchetypeForN,
} from '../../../constants/leagueTournament';
import { statusFeedToVoice } from './statusFeedToVoice';
import { seatAltitude, seatHasLiveSample } from './seatAltitude';
import { LEAGUE_AGENT_CHAT_ENABLED, LEAGUE_LIVE_ORB_ENABLED, LEAGUE_SCORE_HISTORY_ON } from '../../../config/featureFlags';

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

// DEV-ONLY diagnostic state: battle ids already warned by the §9 badge-zero
// tripwire, so it fires ONCE per battle instead of every price tick (a warning
// that fires constantly gets tuned out). Confined to the DEV console.warn path —
// it never gates the RETURN value, so the transform stays referentially
// transparent w.r.t. its output.
const _warnedBadgeLeakBattles = new Set();

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
  spectatedBattles = null,
  liveComposites = null,
} = {}) {
  const players = group?.players || [];
  const youId = uid;
  const myPlayer = players.find((p) => p?.odUserId === uid) || null;
  const now = Number.isFinite(priceCtx?.now) ? priceCtx.now : null;

  // ── Live all-seats orb (Phase B, Option X) — gated as ONE unit by the flag.
  // OFF → rivalLive null (rivals stay on the banked series, byte-identical to
  // today) and the your-seat live gate below stays training-only. ON → rivals'
  // per-seat endpoint composites feed the climb AND your seat may go live in
  // ranked too. YOUR seat is never sourced from `liveComposites` (Option X — the
  // seatAltitude resolver ignores the map for youId); it rides youLiveScore. ──
  const liveOrbOn = LEAGUE_LIVE_ORB_ENABLED;
  const rivalLive = liveOrbOn && liveComposites && typeof liveComposites === 'object'
    ? liveComposites
    : null;

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
    const banked = getWeeklyComposite(group, p.odUserId);
    // Rival seat score SOURCE swap (Option X): when the live orb is on, a rival's
    // seat.score comes from the endpoint live composite (rivalLive), so its
    // leaderboard-style number agrees with its live altitude on the climb. YOUR
    // seat is untouched — it keeps the banked getWeeklyComposite here; your live
    // number is youLiveScore (the orb), never the endpoint. Off-gate → banked.
    const rivalScore = p.odUserId !== uid && rivalLive && Number.isFinite(rivalLive[p.odUserId])
      ? rivalLive[p.odUserId]
      : banked;
    const s = buildSeat({
      odUserId: p.odUserId,
      isCpu: p.isCpu === true,
      score: rivalScore,
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
    const cpuN = isCpuSeat ? cpuNFromUserId(p.odUserId) : null;
    const archId = (s.you ? (battle?.agentContext?.archetype || null) : null)
      ?? (cpuN != null ? cpuArchetypeForN(cpuN) : null)
      ?? (spectatedBattles?.[p.odUserId]?.agentContext?.archetype || null);
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
      // ── Phase 4 (R12): the seat carries the STABLE CODE-ID, resolved from
      // TWO sources — never fabricated:
      //   YOU        → your own battle's agentContext (via buildSeat, as before)
      //   CPU rival  → the deterministic id→archetype map (cpuArchetypeForN)
      //   HUMAN rival→ the server-side spectator projection (archetype is in
      //                PUBLIC_AGENT_CONTEXT — tournamentBattleView.js), polled
      //                by useSpectatedTournamentBattles only while the fuse
      //                gate is on
      // Unresolved → null: the tip renders the generic mech (neutral
      // disposition), never a crash. The LABEL derives from the id via the
      // adapter's archetypeLabel — itself backed by the canonical display map
      // (the arena's former duplicated map is retired; the adapter is the ONE
      // Spec-2.3-recorded importer of the display table for this surface).
      archId,
      arch: s.archName ?? (archId ? archetypeLabel(archId) : undefined), // the label (yours from your battle; rivals via archId when known)
      // The seat's CURRENT composite (Option X rival-source swap): a rival's is the
      // endpoint live composite when the orb is on (rivalScore, above), else banked;
      // YOUR seat is the banked getWeeklyComposite (untouched — your live number is
      // youLiveScore). Coherent with the climb altitude (both go live together).
      score: s.score,
    };
  });
  const youSeat = seats.find((s) => s.you) || null;
  const archName = youSeat?.arch || 'Your agent';

  // ── climb (REUSE buildClimbSeries — exact {[id]: number[]}) ──
  const climb = buildClimbSeries(group, { metric: 'composite' });

  // ── stars (REUSE the Phase-1 meter readers) ──
  const agentStars = battle ? readAgentStars(battle, priceCtx) : [];
  // User-layer ATR basis (Phase 2.5 — closes R1). Score held picks against the SAME
  // per-symbol percentile ATR banking uses (resolveBaseATR over stockRankings),
  // NOT the port-contract preview default (2.5/5.0), so the live star cells + orb
  // match each surface's own banked score of record. Applied to BOTH training and
  // ranked (founder Amendment 1 — pre-launch, 0 ranked players; ranked was showing
  // the same 1.6–3× overstated preview against its own banked composite). The
  // scoring FORMULA is IMPORTED (resolveBaseATR), never re-derived — one formula, no
  // drift. When the rankings doc is unavailable client-side (atrPercentiles null),
  // resolveBaseATR returns null → atrBySymbol stays empty → readUserStar falls back
  // to the port-contract ATR, matching banking's own null path; cryptoSymbols keeps
  // the crypto 5.0 fallback there (banking uses isCryptoSymbol → 5.0). A held name
  // missing from the ~255-symbol universe resolves to 4.0 ((undefined‖0.5)×8),
  // exactly as banking would — NOT the 2.5 default (fallback parity is the point).
  const userAtrPercentiles = priceCtx?.atrPercentiles ?? null;
  const heldSymbolList = (myPlayer?.picks || []).map((p) => p?.symbol).filter(Boolean);
  const userAtrBySymbol = {};
  for (const sym of heldSymbolList) {
    const a = resolveBaseATR(sym, userAtrPercentiles);
    if (Number.isFinite(a)) userAtrBySymbol[sym] = a;
  }
  // Crypto detection for the degraded-null fallback (mirrors isCryptoSymbol's .CC
  // convention; the VALID_CRYPTO_SYMBOLS known-list edge is a double-degraded rarity).
  const userCryptoSymbols = new Set(heldSymbolList.filter((s) => /\.CC$/i.test(s)));
  const userStars = myPlayer
    ? readUserStars(
      myPlayer,
      quotesFromPrices(priceCtx?.effectivePrices, myPlayer),
      { atrBySymbol: userAtrBySymbol, cryptoSymbols: userCryptoSymbols, canonicalPolicy, dayBanked },
    )
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
  //     `agentStars` is TODAY's HOLDINGS only — add the prior days' BANKED cumulative
  //     agent (closeScores.agentPoints, the very value every other orb reads) AND
  //     today's swap-realized points (agentDeparted.total, Σ today's trades) so the
  //     estimate settles to the banked composite at close, not with a per-day jump.
  //   • user legs persist across the week, so `userStars` is cumulative for HELD
  //     picks — add dropped picks' banked points (userDeparted.total) so Σuser is
  //     the true cumulative week (held + dropped), matching what banking counts.
  // Gated tightly so it can only ever ADD today's layer once, and only where the
  // founder scoped it (Branch 1):
  //   • mode: training ALWAYS (today), plus RANKED when the live-orb flag is on
  //     (Phase B relax). Ranked previously stayed banked because a live-you vs
  //     banked-rivals climb was a §9 half-measure; the flag now brings rivals live
  //     too (rivalLive), so ranked can go live coherently — as ONE unit with the
  //     rival source. Flag off → training-only, byte-identical to today.
  //   • status BATTLE, not-yet-banked today, a real (owner-only) battle present.
  //   • now present AND the battle was ACTIVATED today — so a stale prior-day doc
  //     (the pre-deploy morning window, before today's fullday doc lands) can't
  //     add its already-banked agent layer a second time. Anything failing these
  //     falls through to the banked series (the live→final settle; CPU/lobby stay
  //     banked). k lives in computeComposite (never re-derived).
  const modeAllowsLive = mode === 'training' || (liveOrbOn && mode === 'ranked');
  const youOrbLive = modeAllowsLive
    && group?.status === GROUP_STATUS.BATTLE
    && !dayBanked
    && !!battle
    && now != null
    && isFlat6ActivationDay(battle, now);
  const sumPoints = (rows) => rows.reduce((acc, s) => acc + (Number.isFinite(s?.points) ? s.points : 0), 0);
  const bankedAgentRaw = latestDay?.entry?.closeScores?.[uid]?.agentPoints;
  const priorBankedAgent = Number.isFinite(bankedAgentRaw) ? bankedAgentRaw : 0;

  // ── DEPARTED-POSITION POINTS — surfaced in Phase 1, ADDED to the orb in Phase 2.
  // Two banked sources leave the live star grid but the banked close still counts
  // them; the shipped orb under-reported them until close (the §9-blocked settle-
  // step). They're computed HERE (before youLiveScore) so the orb can add exactly
  // the numbers the Phase-1 chips display — same objects → §9 identity by
  // construction. Gated on `youOrbLive` so ranked/banked/pre-deploy/non-training
  // stay byte-identical (both fields null → no chip, no orb change).
  //   • agent: Σ TODAY's trades[].lockedPoints (subbed-out realized points).
  //     trades[] is today's fresh daily doc (Checkpoint A1: fullday, tradingDays=
  //     [today], swapDay always 1), so it's today-only — no cross-day double-count
  //     with priorBankedAgent, no swapDay filter.
  //   • user: Σ droppedPicks banked (readDroppedPickLedger → scorePick). A SAME-DAY
  //     drop's final leg banks post-close → contributes 0 here and shows as a
  //     pending bank in the ledger (the announced A3 residual — never added live).
  let agentDeparted = null;
  let userDeparted = null;
  if (youOrbLive) {
    // §9: the SWAPS term comes through buildSwapLedger — the SAME function the
    // Film Room recap sums per day — so the live strip and the recap's current-
    // day subtotal are one number by construction. agentDeparted keeps its
    // {out,in,pts} item shape (DepartedLedger + the co-located test read exactly
    // those); the recap consumes the richer ledger via buildScoreHistory.
    const swapLedger = buildSwapLedger(battle?.trades);
    if (swapLedger.items.length > 0) {
      agentDeparted = {
        total: swapLedger.total,
        items: swapLedger.items.map((s) => ({ out: s.out, in: s.in, pts: s.pts })),
      };
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

  // ── §9 badge-zero invariant (Checkpoint A4 = (b) incidentally zero) ──
  // The agent today-term below is activeScore(live) + Σ today's swaps and
  // DELIBERATELY OMITS scoreState.bankedBadgePoints, which is 0 on a live fullday
  // doc: the doc completes (~4-5pm ET) BEFORE the post-close badge cron
  // (agent-daily-scores, ~8:45pm ET, status=='active' only), and each morning's
  // fresh doc inits {total:0} with no carry-forward. IF AGENT_BATTLE_DURATION_MODE
  // ever reverts to multi-day, docs persist and badges bank into a LIVE doc → this
  // term under-counts vs the banked close → a silent agent-half settle-step.
  // RULE (§9): a non-zero live bankedBadgePoints must be SURFACED in the arena (a
  // third departed source) BEFORE being added to the orb — never silently folded.
  const liveBadgeTotal = battle?.scoreState?.bankedBadgePoints?.total;
  if (youOrbLive && Number.isFinite(liveBadgeTotal) && liveBadgeTotal !== 0 && import.meta.env?.DEV) {
    const badgeKey = battle?.id ?? 'unknown';
    if (!_warnedBadgeLeakBattles.has(badgeKey)) {
      _warnedBadgeLeakBattles.add(badgeKey);
      console.warn(`[buildArenaModel] live bankedBadgePoints=${liveBadgeTotal} ≠ 0 on battle ${badgeKey} — the orb agent-term omits it (Checkpoint A4). Surface it in the arena before adding to the orb, or the agent half will under-count vs the banked close. (This assumes fullday daily docs — see the AGENT_BATTLE_DURATION_MODE tripwire test.)`);
    }
  }

  // ── live YOUR-seat composite (Branch 1 — Phase 2: swap/drop-accurate) ──
  //   youLiveScore = computeComposite(
  //     priorBankedAgent + liveAgentScore_today,        // agent half
  //     Σ(held picks live) + Σ(dropped picks banked),   // user half   (k=1.5 inside)
  //   )
  //   liveAgentScore_today = sumPoints(agentStars) [activeScore, LIVE prices]
  //                          + agentDeparted.total  [Σ today's trades lockedPoints].
  // Both added terms ARE the exact numbers the Phase-1 chips render (the same
  // agentDeparted/userDeparted objects) → §9 identity by construction, no parallel
  // source. Prior days' swaps ride once in priorBankedAgent (Checkpoint A1); same-
  // day pending drops contribute 0 (the announced A3 residual). Every #572 guard is
  // preserved: youOrbLive (training-only, activation-day/today-only, not-yet-banked,
  // real battle), the NaN priorBankedAgent guard, and youRank ranks by youLiveScore
  // (below) so the standing chip can't disagree with the orb. At close, dayBanked
  // flips → youLiveScore null → the orb hands off to compositePoints. Residual
  // bookkeeping — all three named (founder ruling), so no hidden settle-step:
  //   • R1 — CLOSED (Phase 2.5): held picks now score against the percentile ATR
  //     banking uses (userAtrBySymbol, above), not the 2.5/5.0 preview — the
  //     systematic 1.6–3× basis error is gone.
  //   • R2 — the same-day dropped final leg (A3): contributes 0 live, banks at
  //     close; announced in the ledger ("banks at close · —"). The ONLY announced
  //     residual.
  //   • R3 — intraday ATR-version drift: the client reads stockRankings on a 10-min
  //     cache (converging to banking's close version), so the held-pick multiplier
  //     can move when the ATR VERSION refreshes even if the price hasn't. Small,
  //     converges at close, NOT systematic — deliberately UNSMOOTHED (smoothing
  //     would reintroduce display-vs-bank drift).
  //   • plus the trivial last-live-tick vs official-close-print price convergence.
  // The departed points themselves hand off with NO jump (swaps = fixed lockedPoints;
  // dropped = stored leg.bankedScore).
  const swapBanked = agentDeparted?.total ?? 0;
  const droppedBanked = userDeparted?.total ?? 0;
  // Compute the two live sums ONCE so youLiveScore and the decomposition below are
  // byte-identical (agentSide + userLayer === youLiveScore, exactly — Ruling A).
  const agentLiveSum = sumPoints(agentStars);
  const userLiveSum = sumPoints(userStars);
  const youLiveScore = youOrbLive
    ? computeComposite(
      priorBankedAgent + agentLiveSum + swapBanked,
      userLiveSum + droppedBanked,
    )
    : null;

  // ── decomposition (Phase B Decomposition, Ruling A) — the LAYER-grouped
  // reconciliation of the live orb, gated as ONE unit with the live-orb flag.
  // Grouped by LAYER, not six loose addends: the ×1.5 lands on the COMBINED user
  // half and youLiveScore is an unrounded float, so a flat term sum would miss by
  // 0.5× the user terms. agentSide (×1) + userLayer (×1.5 applied) === orb exactly
  // (the same ops computeComposite runs). Null off-gate → no strip, cards stay
  // 'mult' (byte-identical to today). Your seat only — rivals sealed. ──
  const decompLive = liveOrbOn && youOrbLive && youLiveScore != null;
  const decomposition = decompLive
    ? {
      k: TOURNAMENT_TUNING.USER_LAYER_K, // 1.5 — the user-layer weighting, shown on the strip
      bankedPrior: priorBankedAgent,     // term 1 — banked-prior agent (aggregate, ×1)
      six: agentLiveSum,                 // term 2 — Σ your six today live (×1)
      swaps: swapBanked,                 // term 3 — swaps today (aggregate, ×1)
      three: userLiveSum,                // term 4 — Σ your three today live (pre-×1.5)
      dropped: droppedBanked,            // term 5 — dropped-pick banked (aggregate, pre-×1.5)
      agentSide: priorBankedAgent + agentLiveSum + swapBanked,                    // ×1 layer subtotal
      userLayerRaw: userLiveSum + droppedBanked,                                   // user half, pre-weight
      userLayer: TOURNAMENT_TUNING.USER_LAYER_K * (userLiveSum + droppedBanked),   // ×1.5 layer subtotal
      orb: youLiveScore,                 // agentSide + userLayer === orb, exactly
    }
    : null;

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
  // Day index (founder ruling, Score-History axis reconciliation): the header,
  // the recap timeline, and the swap ledger must stop being three derivations of
  // the same word. FLAG-ON, the header reads the 1-based TRADING-DAY index
  // (deriveCurrentTradingDay — the same index the recap's current-day label and
  // the claim window use), so an in-progress day reads "Day 1", never "Day 0".
  // FLAG-OFF, it stays the banked-day count exactly as today (byte-identical).
  const pod = {
    day: (LEAGUE_SCORE_HISTORY_ON && todayEt)
      ? deriveCurrentTradingDay(group, todayEt)
      : (getLatestDayEntry(group)?.dayN || 0),
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

  // ── youRank at the last banked index (REUSE rankByScores; never 0). Every seat
  // resolves its CURRENT altitude through the SAME seatAltitude ruler ClimbArena's
  // `at` uses (B3 lockstep): YOU → youLiveScore (per-tick client path), a RIVAL →
  // its endpoint live composite (rivalLive) when the orb is live, else the banked
  // series. So the crown/altitude and the voice/ask standing ("protect the lead"
  // vs "catch up") agree with the climb by construction (§9). Off-gate → rivalLive
  // null → rivals stay banked exactly as the orbs do. The co-located B3 test fails
  // if this and `at` ever resolve a seat differently. ──
  const lastIdx = liveDayIdx(climb);
  const ids = seats.map((s) => s.id);
  const scoresAtLast = {};
  // Phase 2 sampling inputs, gathered in the SAME loop off the SAME resolver so
  // the session trail can never sample a different ruler than the crown and the
  // cut (§9). `seatBanked` is the trail's SEED (each seat's last banked close);
  // `seatLive` says whether THIS tick carries a real reading, which is what lets
  // the trail carry a seat forward instead of re-appending the banked floor.
  const seatBanked = {};
  const seatLive = {};
  for (const id of ids) {
    const banked = climb[id]?.[lastIdx] ?? 0;
    scoresAtLast[id] = seatAltitude(id, {
      youId: uid, youLiveScore, liveComposites: rivalLive, banked,
    });
    seatBanked[id] = banked;
    seatLive[id] = seatHasLiveSample(id, { youId: uid, youLiveScore, liveComposites: rivalLive });
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
    liveComposites: rivalLive, // Phase B (Option X): rivals' per-seat endpoint composites — null off-gate; ClimbArena's `at` reads it (seatAltitude)
    decomposition, // Phase B Decomposition: the layer-grouped orb reconciliation — null off-gate (flag/live)
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
    // ── Phase 2 / Phase 3 sampling + cut inputs (Amendment A3.1 / A4) ──
    // scoresAtLast: every seat's CURRENT altitude on ONE basis — the session
    //   trail samples it, and Phase 3's cut is scoresAtLast[ranked[1]]. NEVER
    //   derive either from seats[].score, which is mixed-basis when the orb is
    //   on (a rival carries its live endpoint composite while YOUR seat keeps
    //   the banked getWeeklyComposite).
    // seatLive:   per seat, whether this tick carried a real reading.
    // seatBanked: per seat, the last banked close — the trail's seed.
    scoresAtLast,
    seatLive,
    seatBanked,
    // Points-led cards (Rulings B/C) flip on WITH the decomposition — the six and
    // three lead with star.points. Off-gate → 'mult' (today, byte-identical).
    headline: decompLive ? 'pts' : 'mult',
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
