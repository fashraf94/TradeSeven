// src/components/CommandCenter/baggerBombPageModel.js
//
// League hide (direction note BB-1; founder rulings Q1–Q6, Nov 15, 2026) — the BaggerBomb page's pure derivations. The page
// (BaggerBombPage.jsx) reads the hub's own readers (hub/useHubReaders.js) and shows four parts; this module says what each
// part is made of, from the readers' output and nothing else (BUILD_RULES §9: one source for what is shown):
//
//   - the games section with the league's rows taken out (a row's `kind` is the hub's own classification,
//     utils/commandCenterLiveBattles.js: a group id makes a row 'ranked'; everything else is 'baggerbomb'). The hub's own
//     list is untouched: ranked rows stay there, as history (ruling Q2);
//   - the live BaggerBomb rows, with no fallback to "the first live game" (the hub's strip falls back to `live[0]`; this
//     page must never present a league game as the BaggerBomb game);
//   - the finished BaggerBomb rows, newest first, the page's few and then every one the window holds;
//   - the agent's record, from the stored stats the hub's agent read already holds (wins, losses, games played).
//
// Pure: no clock, no I/O, no React, no flag.

import { BATTLE_TYPE_BAGGERBOMB } from '../../utils/commandCenterLiveBattles';
import { PHONE_COMPLETED_LIMIT, liveGamesOf, splitGames } from './hub/hubModel';

/** How many finished games the page lists before "History" (the phone Overview's own count, spec §8.2). */
export const PAGE_COMPLETED_LIMIT = PHONE_COMPLETED_LIMIT;

/** A BaggerBomb row: not a league one. */
export const isBaggerBombRow = (row) => Boolean(row) && row.kind === BATTLE_TYPE_BAGGERBOMB;

/**
 * The hub's games section with every league row taken out, live and finished. The section's other fields (status, the
 * poll's age, the window's age, the next permitted read) are kept as they are, so every note the hub says is said here too.
 */
export function baggerBombGames(games) {
  if (!games || typeof games !== 'object') return games;
  return Object.freeze({
    ...games,
    live: Array.isArray(games.live) ? Object.freeze(games.live.filter(isBaggerBombRow)) : games.live,
    rows: Array.isArray(games.rows) ? Object.freeze(games.rows.filter(isBaggerBombRow)) : games.rows,
  });
}

/** The live BaggerBomb rows of a games section (already league-free if it came through baggerBombGames). */
export const liveBaggerBombRows = (games) => liveGamesOf(games).filter(isBaggerBombRow);

/** The finished BaggerBomb rows: the window's own order (newest first). */
export const finishedBaggerBombRows = (games) => splitGames(games).completed.filter(isBaggerBombRow);

/**
 * The page's few finished rows, and whether there are more behind "History". `allGames` is the hub's section BEFORE the league
 * rows came out: `otherKind` is how many of its finished games the filter took out, so a window that holds only games of the
 * other kind can say so instead of "no finished games" (the hub reads ten games, newest first, before any filter: a player's
 * latest ten may all be league games while older BaggerBomb games exist).
 */
export function pageFinished(games, allGames = games) {
  const all = finishedBaggerBombRows(games);
  const everything = splitGames(allGames).completed.length;
  return { shown: all.slice(0, PAGE_COMPLETED_LIMIT), total: all.length, more: all.length > PAGE_COMPLETED_LIMIT, otherKind: Math.max(0, everything - all.length) };
}

const isCount = (n) => Number.isSafeInteger(n) && n >= 0;

export const RECORD_STATUS = Object.freeze({ LOADING: 'loading', UNAVAILABLE: 'unavailable', READY: 'ready' });

/**
 * The agent's record from its stored stats: wins, losses and games played. `agentRead` is the hub readers' `agent`
 * ({ status, agent }). Wins and losses must both be counts or the record is unavailable (totals are never made up, as the
 * hub's own career line: hub/selectors/loadout.js deriveCareer). Games played is shown only when it is stored as a count.
 */
export function baggerBombRecord(agentRead) {
  const loading = !agentRead || agentRead.status === 'loading';
  const agent = agentRead && agentRead.status === 'ready' ? agentRead.agent : null;
  if (!agent || typeof agent !== 'object') return Object.freeze({ status: loading ? RECORD_STATUS.LOADING : RECORD_STATUS.UNAVAILABLE });
  const stats = agent.stats && typeof agent.stats === 'object' ? agent.stats : null;
  if (!stats || !isCount(stats.wins) || !isCount(stats.losses)) return Object.freeze({ status: RECORD_STATUS.UNAVAILABLE });
  return Object.freeze({
    status: RECORD_STATUS.READY,
    wins: stats.wins,
    losses: stats.losses,
    // Draws only when stored as a count above zero (Q-C): a record with none says nothing about them.
    draws: isCount(stats.draws) && stats.draws > 0 ? stats.draws : null,
    gamesPlayed: isCount(stats.gamesPlayed) ? stats.gamesPlayed : null,
  });
}

/** The history sheet's career figure ({ status, record }), from the same stored stats the record part shows. */
export function careerOf(record) {
  // The sheet's figure agrees with the record part beside it (BUILD_RULES §9): draws are in it when the record shows them.
  if (record.status === RECORD_STATUS.READY) return Object.freeze({ status: 'ready', record: `${record.wins}W-${record.losses}L${record.draws !== null ? `-${record.draws}D` : ''}` });
  return Object.freeze({ status: record.status === RECORD_STATUS.LOADING ? 'loading' : 'unavailable' });
}
