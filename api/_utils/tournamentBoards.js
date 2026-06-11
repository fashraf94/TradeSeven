// api/_utils/tournamentBoards.js
//
// League Tournament — pure board-commit core (validation, delta, rider-#1
// doc assembly). Lives in _utils so every producer of a board doc — the
// commit-board endpoint today, the dev seeder, the P3 orchestrator later —
// assembles the identical rider shape through one function. Endpoints stay
// transport-only.
//
// Throws sentinel errors prefixed BOARD_SENTINEL_PREFIX; the HTTP mapping
// belongs to the endpoint (api/tournament/commit-board.js).

import { getPlayer } from './tournamentGroupService.js';
import {
  GROUP_STATUS,
  TOURNAMENT_TUNING,
} from '../../src/constants/leagueTournament.js';

export const BOARD_SENTINEL_PREFIX = '__commit_board:';

function sentinel(code, detail) {
  const err = new Error(BOARD_SENTINEL_PREFIX + code);
  err.detail = detail;
  return err;
}

/** Uppercase/trim string symbols; throws the supplied sentinel code on non-strings. */
function normalizeSymbols(values, code) {
  if (!Array.isArray(values)) throw sentinel(code, 'expected an array of symbols');
  return values.map((value) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw sentinel(code, 'symbols must be non-empty strings');
    }
    return value.trim().toUpperCase();
  });
}

/**
 * Per-name board-vs-prefill delta (rider #1 field). Pure.
 * kept = same rank as suggested; reordered = present in both at a different
 * rank; removed = suggested but cut; added = on the board, not suggested.
 * Ranks are 0-based board/prefill indexes.
 */
export function computeBoardDelta(prefillAsSuggested, board) {
  const prefillRank = new Map(prefillAsSuggested.map((s, i) => [s, i]));
  const boardRank = new Map(board.map((s, i) => [s, i]));
  const delta = [];
  for (const [symbol, rank] of boardRank) {
    if (!prefillRank.has(symbol)) {
      delta.push({ symbol, status: 'added', prefillRank: null, boardRank: rank });
    } else if (prefillRank.get(symbol) === rank) {
      delta.push({ symbol, status: 'kept', prefillRank: rank, boardRank: rank });
    } else {
      delta.push({ symbol, status: 'reordered', prefillRank: prefillRank.get(symbol), boardRank: rank });
    }
  }
  for (const [symbol, rank] of prefillRank) {
    if (!boardRank.has(symbol)) {
      delta.push({ symbol, status: 'removed', prefillRank: rank, boardRank: null });
    }
  }
  return delta;
}

/**
 * Validates a board submission against the group and assembles the
 * boards/{odUserId} document (rider event #1 shape, Addendum A §4 row 1).
 */
export function buildBoardCommit({ group, odUserId, board, prefillAsSuggested, now }) {
  if (!group) throw sentinel('group_not_found');
  if (!getPlayer(group, odUserId)) throw sentinel('not_member');
  if (group.status !== GROUP_STATUS.FORMING) throw sentinel('not_forming');

  const normalizedBoard = normalizeSymbols(board, 'invalid_board');
  const { BOARD_DEPTH_MIN, BOARD_DEPTH_MAX } = TOURNAMENT_TUNING;
  if (normalizedBoard.length < BOARD_DEPTH_MIN || normalizedBoard.length > BOARD_DEPTH_MAX) {
    throw sentinel('invalid_board', `board must rank ${BOARD_DEPTH_MIN}-${BOARD_DEPTH_MAX} names (got ${normalizedBoard.length})`);
  }
  if (new Set(normalizedBoard).size !== normalizedBoard.length) {
    throw sentinel('invalid_board', 'board contains duplicate symbols');
  }
  const pool = new Set(group.userPool || []);
  const offPool = normalizedBoard.filter(s => !pool.has(s));
  if (offPool.length > 0) {
    throw sentinel('invalid_board', `not in the group's draftable pool: ${offPool.join(', ')}`);
  }

  // The prefill snapshot is stored as suggested (deduped) — it is the
  // reference the delta is computed against, not a ranked submission.
  const normalizedPrefill = [...new Set(normalizeSymbols(prefillAsSuggested ?? [], 'invalid_board'))];

  return {
    odUserId,
    board: normalizedBoard,
    prefillAsSuggested: normalizedPrefill,
    delta: computeBoardDelta(normalizedPrefill, normalizedBoard),
    roundNumber: group.roundNumber,
    ...(group.bracketGameId != null
      ? { bracketGameId: group.bracketGameId }
      : { baseLayerWeek: group.baseLayerWeek }),
    committedAt: now,
  };
}
