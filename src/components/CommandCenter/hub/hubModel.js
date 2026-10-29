// src/components/CommandCenter/hub/hubModel.js
//
// Command Center hub — the hub's section props (slice S1), and the deploy
// selector's input contract (slice S2a).
//
// S1: every section in the state spec V1.2 §3 defines for "no result has
// resolved". Every section is presentational and takes its data as a prop in
// the shape the spec names (§3, §7, §8: `{ status: 'loading' | 'ready' |
// 'error', … }`), so S3–S6 replace a value here with a reader's result without
// touching the layout. Nothing here is ever fabricated: no row, no count, no
// timer, no resolution. The layout fixtures (../__fixtures__/hubLayoutFixtures.js)
// fill the same shapes for tests only.
//
//   nextAction  { status, candidate: null | { key: 'openGame'|'review'|'deploy',
//                 id (the game's record id; null for deploy), title, why,
//                 detail?, cta } }                                     §8.2
//   games       { status, rows: [{ id, mode, opponent, live, clock?, preOpen?,
//                 detail, outcome?: { text, tone: 'pos'|'neg'|'draw'|'neutral' },
//                 review?: boolean }] }                                §3, §7
//               Slice S3 adds: status 'error' (a failed read, nothing
//               retained); stale, asOf, nextAttemptAt for a retained window
//               whose latest read failed; and per row kind ('ranked' |
//               'baggerbomb') and, on a completed row, reviewLine { state,
//               text, openable } (hub/gamesDisplay.js)                 §3, §6
//               and `live`: the poll's live rows, carried whatever the
//               window's status (liveGamesOf), with `liveResolved` (the
//               poll has answered for this owner)                      R-S3-8
//   deploy      deriveHubDeployState's result (selectors/deployState.js):
//               { displayState, canStart, gateBlocked, freshness: { asOf,
//                 stale, refreshing }, retryAction, reason, action,
//                 recovered, battleId, cooldownUntil, holdControlId,
//                 retryBlock }                                         §3.1 (S2a)
//               The hub root fills it from the selector (ruling R-S2A-3);
//               HUB_S1_SECTIONS carries no hand-written one.
//   loadout     { status: 'loading' | 'none' | 'error' | 'ready',       §2 (S5)
//                 identity?: { name }, archetype?: { name, approach },
//                 watchlist?: { state: 'none' | 'loading' | 'ready' |
//                   'unavailable' | 'error', id, name, symbols, count,
//                   idea: 'universe' | 'plain' | 'neutral' },
//                 adjustments?: { equipped, name, sub, door } | null,
//                 lockedInGame?, summary? }
//               hub/selectors/loadout.js deriveLoadout; `none` is a resolved
//               absence of the ranked agent, `error` its failed read (the
//               S3 merge, N-S5-6), `summary` the root's one-line
//               loadout (the area control's and the stage's words)
//   research    { status: 'gate_off' | 'disabled' | 'loading' | 'no_list' | 'no_idea' | 'unavailable' | 'error' | 'ready',   §8.1 (S6)
//                 listName?, summary?, idea?: { version, status, statusLabel, statement, timeFrame, savedOn,
//                 statusSince, reviewDue, research: [{ id, line, state }], count, honest }, stale?, asOf?, retryNotBefore? }
//               hub/researchView.js deriveResearch, from the idea reader's held answer (hub/useHubResearch.js)
//   deployingWith  { statement, count, version } | null             design note point 3 (S6)
//               hub/researchView.js deployingWithOf: the newest version's statement and the Loadout card's own count
//   activity    { status: 'loading' | 'error' | 'ready', rows: [{ id, kind,
//                 text, sub, at, ms, battleId? }] }                    §8.2 (S4)
//               hub/activityRows.js: a projection of the owner's records, newest
//               first; `battleId` on a game's row (it opens that game)
//   brief       { status: 'loading' | 'error' | 'missing' | 'ready',
//                 caption?, body?, collapsed? }                         §8.3 (S4)
//               hub/useHubBrief.js briefSectionOf; `collapsed` for a brief
//               two to five sessions old (DRB stale fix)
//   career      { status: 'loading' | 'ready' | 'unavailable', record? } §7 (S5)
//               record is `${wins}W-${losses}L` as stored, draws excluded;
//               absent or malformed operands read `unavailable`
//
// Partnership takes no prop: it is the reserved panel (§8.3), with no read.
//
// ── S2a: the deploy selector's inputs (spec §3, §3.1, §5.2–§5.4) ──────────
//
// The contract S3 (the readers) and S2b (the provider) build to. Every time is
// milliseconds since the epoch; every reader result names the owner and the
// auth epoch it was read for. `ownerUid: null` means "no result has resolved",
// never an account change.
//
//   auth        null (identity not resolved: checks, never "signed out")
//               | { signedIn: false }
//               | { signedIn: true, uid, authEpoch }   authEpoch +1 on every
//                                                       identity change      S2b
//   agent       { status: 'loading'|'ready'|'error', agent: null | the ranked
//                 agent doc (stats.gamesPlayed read for the first deploy),
//                 ownerUid, ownerEpoch, error }                       S3
//   poll        { status: the CURRENT request's 'loading'|'ready'|'error',
//                 liveBattles: the RETAINED successful list (battle docs with
//                   ownerId, agentId, groupId, status) or null before any success,
//                 ownerUid, ownerEpoch: the retained list's owner and epoch,
//                 lastSuccessfulAt, error, refreshing }               S3
//   completed   { status, rows, ownerUid, ownerEpoch } — the first-deployment
//                 candidate only                                      S3
//   attempt     the provider record (selectors/attemptVocabulary.js) or null S2b
//   hold        { controlId, holdToken, holdEpoch, phase: 'idle'|'charging'|
//                 'locked' } or null; the token is opaque here, and a hold
//                 with no valid epoch commits nothing                 S2b (R2)
//   cooldown    { ownerUid, targetAgentId, cooldownUntil } for the captured
//                 owner and resolved target — selectors/attemptReducer.js
//                 cooldownFor() — or null; a bound naming no owner, or
//                 another, applies to nobody                          S2b
//   now         the clock, for the cooldown only; null holds a cooldown S2b
//   concurrencyEnabled  CASUAL_CLONE_CONCURRENCY_ENABLED as the shells read it,
//                 at render; anything but true is the legacy any-live gate  S3
//   modalOpen   a sheet, the Forge or the ceremony is open: no control may
//                 start (the words do not change)                     S2b
//
// The attempt reducer's actions (selectors/attemptReducer.js) carry their own
// payloads, every id, time and token supplied by the caller. Before `begin`
// and `retry` the provider asks the selector — canCommit for a hold, canStart
// for a tap, the `retry` action for a Retry — which runs the §3.1 table with
// every reader, the cooldown included; the reducer re-checks only what it
// holds itself (the guard, the hold, a Retry's cooldown).
//   begin                 { attemptId, auth, targetAgentId, startedAt, controlId?, holdToken? }
//                           (a hold's token is admitted only once committed: locked)
//   targetResolved        { attemptId, attemptEpoch, targetAgentId }
//   serviceResult         { attemptId, attemptEpoch, result }   (the service's result, as returned)
//   reconciliationPending { attemptId, attemptEpoch }
//   reconciliationResult  { attemptId, attemptEpoch, status: 'found'|'clear'|'error',
//                           battle?: { id, ownerId }, admitted?: the recovery gates' verdict }
//   ceremonyPhase         { attemptId, attemptEpoch, phase, errorTone? }
//   dismiss               { attemptId, attemptEpoch, at }
//   retry                 { attemptId (new), priorAttemptId, priorAttemptEpoch, auth, now, startedAt }
//                           (a tap: no token; the prior attempt's own spent hold goes with it)
//   cooldownEvidence      { ownerUid, authEpoch, targetAgentId, lastDeployedAtMs?, retryAfterUntil? }
//   authChanged           { uid }        (null when signed out)
//   orphanCleaned         { attemptId, attemptEpoch }  (after S2b has run the orphan's local cleanup)
//   flagDisabled          {}
//   unmount               {}
// Slice S2b adds (ruling R-S2b-3), and gives authChanged the identity source's epoch:
//   authChanged           { uid, authEpoch? }  (authEpoch from services/authIdentity.js; at or
//                           below the current one is a stale report)
//   holdClaimed           { auth, controlId, holdToken, holdEpoch }  (after canStart and the slot)
//   holdCommitted         { auth, holdToken }  (after canCommit and the slot)
//   holdReleased          { holdToken }  (a cancelled charge, or a beat that deployed nothing)
//
// ── S2b: the provider (src/contexts/DeployAttemptContext.jsx) ──────────────
//
// The provider supplies attempt, hold, cooldown, now and its own overlay to
// the selector through the context's `inputs`; the hub adds the readers and
// its sheets' modalOpen (hub/useHubDeploy.js) and registers the result back,
// so the provider admits from the same table the hub shows.

export const HUB_S1_SECTIONS = Object.freeze({
  nextAction: Object.freeze({ status: 'loading', candidate: null }),
  games: Object.freeze({ status: 'loading', rows: Object.freeze([]) }),
  loadout: Object.freeze({ status: 'loading' }),
  research: Object.freeze({ status: 'loading' }),
  activity: Object.freeze({ status: 'loading', rows: Object.freeze([]) }),
  brief: Object.freeze({ status: 'loading' }),
  career: Object.freeze({ status: 'loading' }),
});

/**
 * S2a's deploy inputs: nothing has resolved — the identity, every reader, no
 * attempt, no hold, no cooldown, no clock (ruling R-S2A-3). The selector reads
 * them as `checking`, so nothing a user sees changes; S3 and S2b replace these
 * with real inputs.
 */
export const HUB_S2A_DEPLOY_INPUTS = Object.freeze({
  auth: null,
  agent: Object.freeze({ status: 'loading', agent: null, ownerUid: null, ownerEpoch: null, error: null }),
  poll: Object.freeze({ status: 'loading', liveBattles: null, ownerUid: null, ownerEpoch: null, lastSuccessfulAt: null, error: null, refreshing: false }),
  completed: Object.freeze({ status: 'loading', rows: Object.freeze([]), ownerUid: null, ownerEpoch: null }),
  attempt: null,
  hold: null,
  cooldown: null,
  now: null,
  concurrencyEnabled: null,
  modalOpen: false,
});

/** The rows a section may show, empty unless its read has resolved. */
export const readyRows = (section) => (section?.status === 'ready' && Array.isArray(section.rows) ? section.rows : []);

/** Live rows first, then completed (the design's GamesSection order). */
export function splitGames(games) {
  const rows = readyRows(games);
  return { live: rows.filter((g) => g.live), completed: rows.filter((g) => !g.live) };
}

/**
 * The live rows (slice S3, R-S3-8). On the connected hub they come as the section's own `live` list, from App's poll
 * (the list the gate reads), and show whatever the completed window's status: a block always has its row. A section
 * without one (the layout fixtures) keeps S1's rule: rows only once ready.
 */
export function liveGamesOf(games) {
  return Array.isArray(games?.live) ? games.live : splitGames(games).live;
}

/**
 * The live games, counted once (the S8 review's S8-2 and K-1; ruling R-S8F-7): `opened`, the games that have opened;
 * `waiting`, those deployed and waiting for the open (a row's `preOpen`); and `allEnding`, every opened game past its end
 * time (a row's `ending`, the "ending" its clock shows). The Games header and Shadow's status line both read this, so
 * neither calls a game live that the rows and the strip say is waiting, or "in progress" one the strip says is ending.
 */
export function liveCountsOf(games) {
  const live = liveGamesOf(games);
  const opened = live.filter((g) => !g.preOpen);
  return Object.freeze({
    opened: opened.length,
    waiting: live.length - opened.length,
    allEnding: opened.length > 0 && opened.every((g) => g.ending === true),
  });
}

/** Desktop and tablet Games show live rows plus at most two completed rows (spec §8.2). */
export const DESKTOP_COMPLETED_LIMIT = 2;
/** The phone Overview shows a short activity list (the design's limit 3). */
export const PHONE_ACTIVITY_LIMIT = 3;
/**
 * The side column's activity list: five rows, and "All activity · N" opens the rest (slice S4; founder ruling Q-S4-8, Oct 24, 2026).
 * The committed mock-up fixes no desktop count — its side column renders the whole fixture list (ff-side.jsx ActivitySection with no
 * `limit`; only the phone's Overview passes one, 3) — so the ruling's default stands.
 */
export const DESKTOP_ACTIVITY_LIMIT = 5;
/** The phone Overview shows at most three completed rows (spec §8.2; slice S3). */
export const PHONE_COMPLETED_LIMIT = 3;
/** The watchlist card draws this many names, then "+N more": a list can hold far more than a card can read. */
export const LOADOUT_SYMBOL_LIMIT = 24;
