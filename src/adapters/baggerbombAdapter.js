/**
 * BaggerBomb state adapter — v1 (Command Center Sync, Pass 1).
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE (framework §3, spec §5 rule 1):
 * shell components read battle state ONLY through an adapter. No Dashboard
 * component reads `agentBattles`, `voiceLayerCache`, or `agents` document
 * fields directly. Only the BaggerBomb adapter exists today; the abstraction
 * is validated when the league adapter maps into it (Pass 3), so the schema
 * is PROVISIONAL (framework §3.2) and every consumer must treat a field it
 * does not need as optional.
 *
 * PURE. No fetching, no clock, no I/O. The App-level 120s poll fetches, calls
 * getMarketState() once per cycle, and passes both in. `now` and `marketState`
 * are parameters precisely so the phase matrix is testable against fixtures —
 * src/utils/marketSchedule.js's getMarketState() is zero-arity and reads the
 * wall clock, so injecting its RESULT is what makes weekend / holiday /
 * early-close cases reachable in a test without mocking the module
 * (PASS1_PHASE0_STOP_RULINGS_AND_GO.md §3).
 *
 * All timestamps are normalized to ISO strings at this boundary. The battle
 * doc uses ISO strings; the voiceLayerCache doc's `updatedAt` is a Firestore
 * serverTimestamp (api/cron/voice-layer-cache.js:816). Consumers should never
 * have to know which is which.
 */

import { classifyBattleType, battleTypeLabel } from '../utils/commandCenterLiveBattles';
// The cron's slot width, from the module that FLOORS to it — one constant, so
// the gate below and the label it protects cannot drift apart (D-83, §9).
// `deskCopy` is a leaf: it imports nothing, so there is no cycle.
import { SLOT_MS } from '../components/Dashboard/desk/deskCopy';

export const PHASE = Object.freeze({
  PRE_OPEN: 'PRE_OPEN',
  LIVE: 'LIVE',
  LIVE_CLOSED: 'LIVE_CLOSED',
  POST_CLOSE: 'POST_CLOSE',
});

/** Eval cadence, mirroring agentContext.evaluationInterval (15 min, RTH). */
const EVAL_INTERVAL_MS = 15 * 60 * 1000;

/** How stale the proximity cache may be during LIVE before we stop showing it. */
export const PROXIMITY_STALE_MS = 30 * 60 * 1000;

/** How many proximity rows the Desk shows (spec §8). */
const PROXIMITY_LIMIT = 3;

/**
 * Normalize the Firestore-Timestamp / ISO-string / Date / epoch union to an
 * ISO string. Mirrors the precedent at api/agent/chat.js:115-119.
 * @returns {string|null}
 */
export function toIso(raw) {
  if (raw == null) return null;
  let ms = null;
  if (typeof raw === 'string') {
    const parsed = new Date(raw).getTime();
    ms = Number.isNaN(parsed) ? null : parsed;
  } else if (raw instanceof Date) {
    ms = raw.getTime();
  } else if (typeof raw === 'number') {
    ms = raw;
  } else if (typeof raw.toMillis === 'function') {
    ms = raw.toMillis();
  } else if (typeof raw.seconds === 'number') {
    ms = raw.seconds * 1000;
  }
  if (ms == null || Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

/** Epoch millis for the same union, or null. Exported for the Battle View's derivers. */
export function toMillis(raw) {
  const iso = toIso(raw);
  return iso == null ? null : new Date(iso).getTime();
}

/**
 * Read the ET wall-clock fields off a Date produced by
 * src/utils/marketSchedule.js.
 *
 * THIS IS NOT AN INSTANT AND MUST NOT BE TREATED AS ONE. getMarketState()
 * builds nextOpenTime / nextCloseTime from getETDate() (marketSchedule.js:76),
 * which re-parses a toLocaleString('en-US', {timeZone:'America/New_York'})
 * string in the BROWSER's zone. The resulting Date's LOCAL FIELDS are the ET
 * wall clock, but its epoch is shifted by (browserOffset − etOffset).
 * CommandDashboard.jsx:203 already documents this for its own use.
 *
 * Taking .getTime() and formatting it back through Intl/America/New_York — as
 * an earlier version of this adapter did — double-converts and produces a
 * wrong time for every viewer outside ET. Measured at the real instant
 * 2026-09-14T22:00:00Z, whose true next open is Tue 9:30 AM ET:
 *   America/New_York  -> "Tue 9:30 AM ET"   (correct)
 *   UTC               -> "Tue 5:30 AM ET"
 *   America/Los_Angeles -> "Tue 12:30 PM ET"
 *   Asia/Tokyo        -> "Mon 8:30 PM ET"   (wrong DAY, and in the past)
 *
 * So the wall-clock fields are carried structurally and formatted from the
 * fields, never from the epoch.
 *
 * @returns {{weekdayIndex:number, hour:number, minute:number}|null}
 */
export function etWallClock(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return { weekdayIndex: date.getDay(), hour: date.getHours(), minute: date.getMinutes() };
}

/** Minutes-since-ET-midnight for a wall-clock field set. */
const wallClockMinutes = (wc) => (wc ? wc.hour * 60 + wc.minute : null);

/**
 * Minutes-since-ET-midnight for a TRUE instant. Safe to use Intl here, because
 * the input really is an instant (unlike the marketSchedule Dates above).
 */
function etMinutesOfInstant(ms) {
  if (ms == null) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/**
 * The ET CALENDAR DAY of a true instant, as `YYYY-M-D`, in the same shape the
 * wall-clock market-state Dates yield from their local fields. Intl is correct
 * for an instant; the wall clock's fields are read directly. Mixing the two
 * clocks is the timezone defect this module already guards against, so both
 * sides of any comparison must be built the way its own producer builds them.
 */
function etDayOfInstant(ms) {
  if (ms == null) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date(ms));
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return y && m && d ? `${Number(y)}-${Number(m)}-${Number(d)}` : null;
}

/**
 * Derive the phase (framework §4). Never stored — always derived.
 *
 * PRE_OPEN's marker is `scoreState.evaluationCount`, NOT a statusFeed entry.
 * The spec originally said "first statusFeed eval entry", but no eval-sourced
 * statusFeed entry exists: agent-evaluate.js writes eight `source:` values and
 * none marks an evaluation, and a quiet HOLD tick appends nothing at all. The
 * evaluation counter is written every cycle (agent-evaluate.js:2723), so it is
 * the honest marker (PASS1_PHASE0_STOP_RULINGS_AND_GO.md §7, framework C-3).
 */
export function derivePhase(battle, marketState) {
  if (battle?.status === 'completed') return PHASE.POST_CLOSE;
  if (marketState?.state === 'OPEN') return PHASE.LIVE;

  const evaluationCount = battle?.scoreState?.evaluationCount;
  const lastScoredAt = battle?.scoreState?.lastScoredAt;
  const hasEvaluated = Boolean(evaluationCount) || lastScoredAt != null;
  return hasEvaluated ? PHASE.LIVE_CLOSED : PHASE.PRE_OPEN;
}

/**
 * Flatten the portfolio into a book. Crypto lives inside support[2], not as a
 * separate field (agentBattleService.js:39-40 note), so flattening the three
 * tiers covers it.
 *
 * `pnlPct` is deliberately ABSENT in v1: no live price reaches a pure adapter,
 * and the cache's `changePercent` is the feed's daily change, not P&L from
 * entry. Rendering one as the other is the display-disagreement bug class
 * (BUILD_RULES §9). It returns in Pass 2 with a sourced design.
 */
function buildBook(battle) {
  const portfolio = battle?.portfolio;
  if (!portfolio) return [];
  const startingPrices = portfolio.startingPrices || {};
  const activatedAt = toIso(battle.activatedAt);

  const tiers = [
    ['star', portfolio.star],
    ['core', portfolio.core],
    ['support', portfolio.support],
  ];

  const book = [];
  for (const [tier, positions] of tiers) {
    if (!Array.isArray(positions)) continue;
    for (const p of positions) {
      if (!p || !p.symbol) continue;
      book.push({
        symbol: p.symbol,
        tier,
        entry: p.swapPrice ?? startingPrices[p.symbol] ?? null,
        // A position that was never swapped carries no swappedInAt, so it has
        // been held since the battle activated.
        heldSince: toIso(p.swappedInAt) ?? activatedAt,
      });
    }
  }
  return book;
}

/**
 * Pull the proximity rows out of the cache doc.
 *
 * `thresholdProximity` is absent (not null) when baseATR <= 0 or the effective
 * threshold change is non-finite, and `redZone` inside it can be null when the
 * position is not approaching a scoring threshold. Either way the position is
 * simply omitted — never a placeholder row (spec §8 empty-state rule).
 */
function buildScoreProximity(portfolioBriefs) {
  if (!Array.isArray(portfolioBriefs)) return [];

  const rows = [];
  for (const brief of portfolioBriefs) {
    const tp = brief?.thresholdProximity;
    const redZone = tp?.redZone;
    if (!tp || !redZone) continue;
    if (typeof tp.currentMultiplier !== 'number' || !Number.isFinite(tp.currentMultiplier)) continue;
    if (typeof redZone.targetMultiple !== 'number') continue;

    rows.push({
      symbol: brief.symbol,
      currentMultiplier: tp.currentMultiplier,
      targetMultiple: redZone.targetMultiple,
      // The direction WORD comes from the data, never from sign math in the
      // UI (spec §8) — and note redZone.direction is the non-null one;
      // swapLock.direction may be null.
      direction: redZone.direction,
      zoneProgressPercent: redZone.zoneProgressPercent,
      distance: Math.abs(redZone.targetMultiple - tp.currentMultiplier),
    });
  }

  return rows
    .sort((a, b) => a.distance - b.distance)
    .slice(0, PROXIMITY_LIMIT);
}

/**
 * Locked positions only. `swapLock` is an OBJECT
 * ({locked, direction, distancePercent, message}) returned by
 * isSwapLocked(), not a boolean, and it is always present whenever
 * thresholdProximity is — so `locked === true` is the real filter.
 */
function buildSwapLock(portfolioBriefs) {
  if (!Array.isArray(portfolioBriefs)) return [];
  const rows = [];
  for (const brief of portfolioBriefs) {
    const lock = brief?.thresholdProximity?.swapLock;
    if (!lock || lock.locked !== true) continue;
    rows.push({
      symbol: brief.symbol,
      locked: true,
      direction: lock.direction ?? null,
      distancePercent: lock.distancePercent ?? null,
      message: lock.message ?? null,
    });
  }
  return rows;
}

/**
 * The most recent statusFeed entry, verbatim. No paraphrase (framework C1) —
 * the message is engine text and is carried through untouched.
 */
function buildStatusFeedLatest(battle) {
  const feed = battle?.statusFeed;
  if (!Array.isArray(feed) || feed.length === 0) return null;
  const latest = feed[feed.length - 1];
  if (!latest) return null;
  return {
    message: latest.message ?? null,
    timestamp: toIso(latest.timestamp),
    action: latest.action ?? latest.type ?? null,
  };
}

/** How far back a feed entry can be and still surface as a live alert. */
const ALERT_WINDOW_MS = 60 * 60 * 1000;

/**
 * The feed slice the breakthrough-alert visual may treat as NEW.
 *
 * BreakthroughAlerts keeps a mount-scoped dedupe set and shows each admitted
 * entry for 60 seconds. Inside AgentChat that is fine — the panel mounts when a
 * battle opens. On the Dashboard it mounts every time the user lands there, so
 * an unfiltered feed replays an hours-old gameplan_meeting as a freshly-arrived
 * alert on every visit. Bounding the window to an hour keeps the alert channel
 * meaning "this just happened", which is the only reading that makes a
 * 60-second TTL honest.
 *
 * The Desk's own feed LINE is unbounded and still shows the latest entry
 * whatever its age — that one is stamped, so it makes no freshness claim.
 */
function buildAlertFeed(battle, now) {
  const feed = battle?.statusFeed;
  if (!Array.isArray(feed)) return [];
  const nowMs = toMillis(now);
  if (nowMs == null) return [];
  return feed.filter((entry) => {
    const ts = toMillis(entry?.timestamp);
    return ts != null && nowMs - ts <= ALERT_WINDOW_MS;
  });
}

/**
 * When the next check is DUE — the last check + 15 minutes, inside the
 * session — regardless of whether that instant has already passed.
 *
 * Exported for the Battle View turn line (Phase A, D-62): the late state
 * `Last check 12:47 PM · next was due ~1:02 PM` needs the un-nulled candidate
 * that `nextDecisionAt` deliberately withholds once it is in the past. This
 * is the ONE derivation of "next" — the Desk's `nextDecisionAt` below consumes
 * it, so the two surfaces cannot disagree about the number (BUILD_RULES §9);
 * deriving `+15 min` a second time in the turn line was the hazard.
 *
 * Returns a TRUE ISO instant, or null when nothing has been checked yet or
 * when the candidate would land at/after the session close (there is no due
 * check inside this session, so nothing can be late either).
 */
export function deriveDueAt(lastCheckedAt, marketState) {
  const lastMs = toMillis(lastCheckedAt);
  if (lastMs == null) return null;

  const candidate = lastMs + EVAL_INTERVAL_MS;

  // Clamp to the session close. Both sides are compared as ET minutes-past-
  // midnight: the candidate is a true instant (Intl is correct for it), the
  // close is a wall clock (its fields are read directly). Comparing their
  // epochs — as an earlier version did — mixed the two clocks.
  const closeMinutes = wallClockMinutes(etWallClock(marketState?.nextCloseTime));
  const candidateMinutes = etMinutesOfInstant(candidate);
  if (closeMinutes != null && candidateMinutes != null && candidateMinutes >= closeMinutes) {
    return null;
  }
  return new Date(candidate).toISOString();
}

/**
 * Whether the check that just landed is the LAST one of THIS session (D-71).
 *
 * Two conjuncts, and the second is not optional (A2 review L1-F1):
 *
 *   1. `deriveDueAt()` returns null during LIVE — the +15 min candidate lands
 *      at or after the session close, so no further check is scheduled today.
 *      A starved cron BEFORE the close still has a non-null `dueAt` (it is
 *      late, not finished), so those two states cannot be confused.
 *   2. The check happened TODAY. The clamp inside deriveDueAt compares ET
 *      minutes-past-midnight on both sides and is deliberately blind to the
 *      DATE — correct for its own job, and wrong for this one: on day 2 of a
 *      multi-day battle, yesterday's 3:50 PM check also clamps to null, and
 *      without this conjunct both surfaces would open the morning claiming
 *      `Checked 3:50 PM · last check today` about YESTERDAY while a full
 *      session of checks was still to come.
 *
 * "Today" is the ET calendar day of the session close the market state names
 * — not the viewer's local day, and not `Date.now()`: the close is the
 * session this line is describing, and it is the same wall clock the clamp
 * already reads.
 *
 * ONE derivation, exposed as one adapter field, because both the Desk and the
 * Battle View turn line render from it: testing the null in two places is how
 * two surfaces start disagreeing about the same fact (BUILD_RULES §9).
 */
export function deriveLastCheckOfSession(phase, lastCheckedAt, marketState) {
  if (phase !== PHASE.LIVE) return false;
  if (!lastCheckedAt) return false;
  if (deriveDueAt(lastCheckedAt, marketState) !== null) return false;

  // The session's own day, from the wall-clock close the clamp uses. With no
  // market state there is no session to be the last check of.
  const close = marketState?.nextCloseTime;
  if (!close || typeof close.getFullYear !== 'function') return false;
  const sessionDay = `${close.getFullYear()}-${close.getMonth() + 1}-${close.getDate()}`;
  return etDayOfInstant(toMillis(lastCheckedAt)) === sessionDay;
}

/**
 * When the agent next checks, during LIVE only.
 *
 * Returns a TRUE ISO instant or null. Off-hours the answer is the next market
 * open, which is a wall clock rather than an instant and is carried separately
 * as `nextOpenEt` — mixing the two in one field was the timezone defect.
 *
 * Null when nothing has been checked yet (the Desk says a check is coming
 * rather than inventing a time), and null when the computed next check is
 * already in the past — a starved cron must not produce a "next ~" that has
 * been and gone. The candidate itself comes from deriveDueAt() above; this
 * function only adds the phase gate and the "already past" withholding, so
 * its output is unchanged by the Phase A extraction (the Desk goldens stand).
 */
function deriveNextDecisionAt(phase, lastCheckedAt, marketState, now) {
  if (phase !== PHASE.LIVE) return null;

  const dueAt = deriveDueAt(lastCheckedAt, marketState);
  if (dueAt == null) return null;

  const nowMs = toMillis(now);
  const dueMs = toMillis(dueAt);
  // WITHHOLD ON THE INSTANT THE LABEL WILL SHOW, NOT THE ONE COMPUTED HERE
  // (review RA-F1). Since D-83 the posture strings render `next ~` as the
  // CRON SLOT — `next ~12:45 PM` for a candidate of 12:48 — because 12:45 is
  // when the cron fires and 12:48 is only when a 3-minute-late check would
  // land. The slot is the earlier of the two, so gating on the raw candidate
  // left the label naming a time that had already gone by for exactly as long
  // as the last check was late: `next ~12:45 PM` still on screen at 12:47,
  // which is the starved-cron misreading this function's own rule exists to
  // prevent. `δ` of every fifteen minutes, and the repo's own LIVE fixture is
  // an instance of it.
  //
  // The RETURNED value is still the exact candidate: `nextDecisionAt` is an
  // instant that other code compares against, and the LABEL/INSTANT split is
  // the whole of D-83's second half. Only the gate moved.
  //
  // STRICTLY past, not "at or past": a slot is a fifteen-minute bucket and the
  // cron fires at its START, so `next ~1:00 PM` is true AT 1:00 and false from
  // 1:00:01. The raw candidate had no such distinction — it was one instant —
  // which is why the old gate could use `<=`.
  if (nowMs != null && Math.floor(dueMs / SLOT_MS) * SLOT_MS < nowMs) return null;
  return dueAt;
}

/**
 * The adapter for THIS battle, or null.
 *
 * Both shells render a Manage card per live battle but build only ONE adapter
 * (for the battle the Desk describes). Handing that adapter to every card would
 * let a second concurrent battle — a casual clone beside a ranked battle, live
 * today under CASUAL_CLONE_CONCURRENCY_ENABLED — borrow the first battle's
 * phase and claim the market is closed when its own is open.
 *
 * Extracted from an inline ternary in both shells so it can be tested. The
 * inline version was guarded only by a test that compared the component to
 * itself and could not fail.
 */
export function syncForBattle(sync, battleId) {
  if (!sync || !battleId) return null;
  return sync.game?.id === battleId ? sync : null;
}

/**
 * Is this completed battle still owed its debrief?
 *
 * The "review doc" is `battle.dailyReviews[]` — the array
 * api/cron/agent-batch-review.js appends to and dedupes on. It rides the battle
 * doc the 120s poll already carries, so the POST_CLOSE card needs no new read.
 *
 * Exported from the adapter rather than derived in a component: knowing that
 * `dailyReviews` is where a debrief lands is document knowledge, and this
 * module is the one place allowed to hold it (spec §5 rule 1).
 *
 * @returns {boolean} true only for a completed battle with no review yet
 */
export function deriveDebriefPending(battle) {
  if (!battle || battle.status !== 'completed') return false;
  const reviews = battle.dailyReviews;
  return !Array.isArray(reviews) || reviews.length === 0;
}

/**
 * Build the adapter object.
 *
 * @param {object|null} battle   agentBattles doc ({id, ...data}) from the 120s poll
 * @param {object|null} voiceLayerCacheDoc  voiceLayerCache/{battleId} doc, or null
 * @param {object|null} agent    agents doc (for loadout)
 * @param {Date|string|number} now  injected clock — staleness is measured against it
 * @param {object|null} marketState result of getMarketState(), passed in by the caller
 * @returns {object|null} null when there is no battle to describe
 */
export function buildBaggerbombAdapter(battle, voiceLayerCacheDoc, agent, now, marketState) {
  if (!battle) return null;

  const phase = derivePhase(battle, marketState);
  const briefs = voiceLayerCacheDoc?.portfolioBriefs;

  // lastCheckedAt is the scoring stamp, written on every eval cycle
  // (agent-evaluate.js:881) — not a statusFeed timestamp, which only exists
  // for notable events and is absent on a quiet HOLD tick.
  const lastCheckedAt = toIso(battle?.scoreState?.lastScoredAt);

  const proximityAsOf = toIso(voiceLayerCacheDoc?.updatedAt);
  const nowMs = toMillis(now);
  const asOfMs = toMillis(proximityAsOf);

  // Staleness gates the LIVE phase ONLY. During open market, numbers computed
  // half an hour ago and presented as current are the lie. Once the market is
  // closed the prices are frozen with it, so the last computed proximity is
  // legitimately current-as-of-close — the as-of stamp carries the honesty
  // instead (PASS1_PHASE0_STOP_RULINGS_AND_GO.md §6).
  const proximityStale = phase === PHASE.LIVE
    && (asOfMs == null || nowMs == null || (nowMs - asOfMs) > PROXIMITY_STALE_MS);

  const scoreProximity = proximityStale ? [] : buildScoreProximity(briefs);
  const swapLock = proximityStale ? [] : buildSwapLock(briefs);

  return {
    // Derived, never constant. `type`/`label` were hardcoded to 'baggerbomb' /
    // 'BaggerBomb', which was a lie whenever the Desk was handed a ranked
    // battle — and before F-1 it could be, because the shells selected by
    // index and sortLiveBattles puts ranked first. Both now come from the SAME
    // classifyBattleType the Manage card labels from (ManageStation.jsx), so
    // the Desk's eyebrow and the card beneath it cannot disagree about which
    // game is on screen (BUILD_RULES §9).
    game: {
      id: battle.id ?? null,
      type: classifyBattleType(battle),
      label: battleTypeLabel(battle),
      // For the Desk's eyebrow: the Desk says which battle it describes rather
      // than borrowing the identity of whatever card happens to sit under it.
      agentName: battle?.agentContext?.agentName ?? agent?.name ?? null,
    },

    phase,

    // Same derivation ManageStation.jsx:32-33 already uses, so the Desk and
    // the Manage rail cannot disagree about the score (BUILD_RULES §9).
    score: {
      current: battle?.scoreState?.currentScore ?? null,
      tradeCount: battle?.scoreState?.tradeCount ?? (battle?.trades?.length || 0),
    },

    book: buildBook(battle),
    scoreProximity,
    swapLock,

    lastCheckedAt,
    // A true ISO instant, LIVE only (last check + 15 min, inside the session).
    nextDecisionAt: deriveNextDecisionAt(phase, lastCheckedAt, marketState, now),
    // Whether that check was the last one of the session (D-71). Both surfaces
    // consume THIS field rather than re-deriving the null — see the helper.
    lastCheckOfSession: deriveLastCheckOfSession(phase, lastCheckedAt, marketState),
    // The next market open as ET WALL-CLOCK FIELDS, never an epoch — see
    // etWallClock() above for why the distinction is load-bearing.
    nextOpenEt: etWallClock(marketState?.nextOpenTime),

    // Whether the proximity block may render at all, and what it is current
    // as of. `proximityAsOf` is non-null even when stale so a caller can say
    // WHY it is withholding.
    proximityStale,
    proximityAsOf,

    statusFeedLatest: buildStatusFeedLatest(battle),
    // The whole feed, carried through the boundary because the breakthrough
    // alert visual takes the array. Without this a shell would have to hand
    // AgentDesk `battle.statusFeed` directly, which is exactly the direct
    // document read the pass exists to prevent (spec §5 rule 1).
    statusFeed: buildAlertFeed(battle, now),

    loadout: {
      archetype: agent?.archetype ?? battle?.agentContext?.archetype ?? null,
      watchlistLabel: battle?.agentContext?.equippedWatchlist?.name ?? null,
      // Never was a stored field — EquipBench.jsx:88 and EquipStation.jsx:110
      // each derive it locally from the same expression. The adapter is the
      // third derivation site; Pass 2 can consolidate them.
      benchLocked: Boolean(agent?.activeBattleId),
    },
  };
}

export default buildBaggerbombAdapter;
