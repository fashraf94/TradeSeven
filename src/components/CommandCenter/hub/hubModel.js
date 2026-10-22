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
//   loadout     { status, archetype?: { name, approach },
//                 watchlist?: { name, symbols }, summary?,
//                 lockedInGame? }                                      §2 (S5)
//   research    { status }                                             §8.1 (S6)
//   activity    { status, rows: [{ id, kind, text, sub, at }] }        §8.2 (S4)
//   brief       { status, caption?, body? }                            §8.3 (S4)
//   career      { status, record? }                                    §7 (S5)
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

/** Desktop and tablet Games show live rows plus at most two completed rows (spec §8.2). */
export const DESKTOP_COMPLETED_LIMIT = 2;
/** The phone Overview shows a short activity list (the design's limit 3). */
export const PHONE_ACTIVITY_LIMIT = 3;
/** The phone Overview shows at most three completed rows (spec §8.2; slice S3). */
export const PHONE_COMPLETED_LIMIT = 3;
