// api/_utils/tournamentAgentBoards.js
//
// P3a — agent board production (Spec §1.3 Monday sequence; Signal Capture
// rider #2 + the board-time half of rider #6). Per agent: one tool-forced
// Sonnet call ranks a 15–20-name draft board from the agent's context
// (archetype rankings, equipped watchlist, USER PICKS block), persisted
// AWAITED to tournamentGroups/{id}/agentBoards/{agentId}. The deploy-time
// half of rider #6 is P4-contract scope.
//
// DEGRADE POSTURE (founder-ratified at the P3 plan): any model/validation
// failure falls back to a deterministic archetype-ranking board — boards must
// ALWAYS exist before the agent draft. The fallback is the autopick spirit:
// top-of-archetype-ranking, marked `fallback: true` with the reason.
//
// PROMPT REUSE RULING (founder C-i, June 12, 2026): this is a NEW tournament
// prompt module. The fenced Sonnet strategy builders are NOT called — their
// GAME RULES text is tiered-mode framing (star 2x / core 1.5x / crypto),
// wrong for a flat-6 exclusive-market board ask. Reused by CALLING:
// `formatMarketCSV` (fenced agentPromptAssembly.js EXPORT — read-only call,
// never edited) and the non-fenced archetypeScoring exports. User-authored
// text (watchlist name/thesis) passes through the sanitizer PORT
// (tournamentPromptSanitizer.js — tripwire-locked against the fenced
// original; collapses to an import at P4 per the founder's contract item).
// Scoring numbers are deliberately QUALITATIVE in the prompt — flat6 badge
// economics belong to P4's fence entry, and this prompt must not pre-commit
// them.
//
// SYNTHETIC-AGENT AFFORDANCE (dev/preview only): a group member with no
// `agents` doc (the seeder's placeholder players) gets a synthetic identity
// (`dev-agent-{odUserId}`) and the deterministic fallback board, loudly
// logged. Production groups get real agents once registration exists; CPU
// players get real system-owned agents at P3b (founder Ruling B1). The P3b
// orchestrator must treat a synthetic board on a production group as a
// config error, not a feature.
//
// Imports the zero-import schema module from src/ under the revised June
// 2026 import rule (BUILD_RULES §4); the co-located test's real import of
// THIS module is the dependency-surface guard.

import {
  TOURNAMENT_GROUPS_COLLECTION,
  AGENT_BOARDS_SUBCOLLECTION,
  GROUP_STATUS,
  TOURNAMENT_TUNING,
} from '../../src/constants/leagueTournament.js';
import { formatMarketCSV } from './agentPromptAssembly.js';
import { computeArchetypeRankings, ARCHETYPE_TEMPERATURES, ARCHETYPE_CONSTRAINTS } from './archetypeScoring.js';
import { resolveEquippedWatchlist, extractTickerSymbols } from './watchlistEquip.js';
import { getOwnUserPicks } from './tournamentAgentLedger.js';
import { sanitizeRuleText } from './tournamentPromptSanitizer.js';

const LOG_PREFIX = '[TournamentBoards]';

// House default for the agent strategy pass (api/agent/decide.js:195).
export const AGENT_BOARD_MODEL = 'claude-sonnet-4-20250514';
export const AGENT_BOARD_MAX_TOKENS = 2000;

// Stance lines are model-authored playback copy — cap defensively.
const STANCE_MAX_CHARS = 280;
const RATIONALE_MAX_CHARS = 200;

export const BOARDS_SENTINEL_PREFIX = '__produce_agent_boards:';

function sentinel(code, detail) {
  const err = new Error(BOARDS_SENTINEL_PREFIX + code);
  err.detail = detail;
  return err;
}

function toIso(now) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

// ==================== TOOL SCHEMA ====================

export const AGENT_BOARD_TOOL = {
  name: 'submit_board',
  description: 'Submit your ranked draft board for the tournament agent draft.',
  input_schema: {
    type: 'object',
    properties: {
      board: {
        type: 'array',
        description:
          'Your ranked draft board: 15-20 stock tickers from the universe, most-wanted FIRST. '
          + 'At the draft your agent always takes your highest-ranked still-available name, so rank order is everything.',
        items: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Ticker exactly as shown in the STOCK UNIVERSE table' },
            rationale: { type: 'string', description: 'One line: why this name, this week' },
          },
          required: ['symbol', 'rationale'],
        },
      },
      userPicksReaction: {
        type: 'array',
        description:
          "One stance line per USER PICK: your read on your player's call and whether you want the double-down "
          + '(ranking it on your board is how you pursue it).',
        items: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            stance: { type: 'string', description: 'One line: agree/disagree, and whether you intend to draft it yourself' },
          },
          required: ['symbol', 'stance'],
        },
      },
    },
    required: ['board', 'userPicksReaction'],
  },
};

// ==================== PROMPTS ====================

/**
 * Tournament board system prompt. Flat-6 exclusive-market framing — scoring
 * stays qualitative (no point values: flat6 badge economics are P4's to set).
 */
export function buildBoardSystemPrompt(marketCSV, archetype) {
  const constraint = archetype && ARCHETYPE_CONSTRAINTS[archetype]
    ? `\nARCHETYPE STRATEGY CONSTRAINT:\n${ARCHETYPE_CONSTRAINTS[archetype]}\n\nThe ARCH column in the stock data below is pre-computed for your archetype. Higher scores = better fit for your strategy. Use it as your primary sorting signal.`
    : '';

  return `You are the strategic analyst for a FantasyTrades League Tournament agent. The agent draft runs soon; your job is to rank its draft board.

TOURNAMENT RULES (these differ from the casual game):
- Four agents in the group each draft 6 stocks, snake order, from one shared market. Drafted names are EXCLUSIVE among the agents: once a rival takes a name, you cannot hold it this round.
- Your board IS your draft strategy: each turn, your agent automatically takes your highest-ranked still-available name. Rank order is everything — there are no live decisions at the draft.
- Scoring is FLAT per stock (no conviction tiers). ATR-threshold bonus and bust mechanics apply per name. Long-only. Stocks only — no crypto.
- THE DOUBLE-DOWN: your player has committed three user-layer picks of their own (listed in the user message). You MAY rank and draft those same names — alignment doubles the player's exposure and is the game's only leverage play. Rival agents can never take your player's picks, and you can never take a rival player's picks.
${constraint}

STOCK UNIVERSE (TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT|ARCH):
${marketCSV}`;
}

/**
 * Agent-specific user prompt. `userPicks` = [{symbol, direction}] (the own
 * player's committed picks — validated symbols/enums, never free text).
 * `equippedWatchlist` = {name, thesis, tickers} or null; name/thesis are
 * user-authored and pass through the sanitizer port; tickers are
 * regex-validated (the decide.js:109 pattern).
 */
export function buildBoardUserPrompt(agent, { userPicks = [], equippedWatchlist = null } = {}) {
  const parts = [];

  const archetype = agent?.archetype
    ? agent.archetype.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
    : 'Unknown';
  parts.push(`AGENT IDENTITY:\nName: ${agent?.name || 'Agent'} | Archetype: ${archetype}`);
  if (agent?.personality?.traits?.length > 0) {
    parts.push(`Traits: ${agent.personality.traits.join(', ')}`);
  }

  if (agent?.consolidatedInsight) {
    parts.push(`STRATEGIC WISDOM (from ${agent.evolutionCycle || 0} evolution cycles):\n${agent.consolidatedInsight}`);
  }

  if (userPicks.length > 0) {
    const lines = userPicks.map(p => `- ${p.symbol} (${p.direction})`);
    parts.push(
      'USER PICKS (your player\'s committed user-layer picks):\n'
      + `${lines.join('\n')}\n`
      + 'React to each in userPicksReaction: do you share the conviction, and do you want the double-down? '
      + 'If you want a name, RANK IT on your board — the reaction line alone drafts nothing.'
    );
  }

  if (equippedWatchlist) {
    const tickerList = (Array.isArray(equippedWatchlist.tickers) ? equippedWatchlist.tickers : [])
      .filter((t) => typeof t === 'string' && /^[A-Z0-9.-]{1,12}$/.test(t));
    if (tickerList.length > 0) {
      const safeName = sanitizeRuleText(equippedWatchlist.name) || 'Untitled watchlist';
      const safeThesis = equippedWatchlist.thesis ? sanitizeRuleText(equippedWatchlist.thesis) : '';
      const lines = [
        'USER-EQUIPPED WATCHLIST',
        `The user has personally equipped a watchlist titled "${safeName}". They want these`,
        'tickers given priority consideration on your board:',
        tickerList.join(', '),
      ];
      if (safeThesis) lines.push(`Thesis: "${safeThesis}"`);
      lines.push(
        '',
        'These are user-prioritized opportunities, not mandates — rank a watchlist ticker high only where it is genuinely competitive.'
      );
      parts.push(lines.join('\n'));
    }
  }

  parts.push('Rank your draft board of 15-20 tickers now using the submit_board tool.');

  return parts.join('\n\n');
}

// ==================== NORMALIZATION / FALLBACK (pure) ====================

/**
 * Deterministic fallback board: the top of the agent's archetype ranking
 * (the autopick spirit). `rankedSymbols` must already be archetype-ordered.
 */
export function buildFallbackBoard(rankedSymbols, depth = TOURNAMENT_TUNING.BOARD_DEPTH_MAX) {
  return (rankedSymbols || []).slice(0, depth);
}

/**
 * Normalize a submit_board tool result into the persisted shape. Pure, never
 * throws: model output is untrusted and this function always yields a usable
 * board (uppercase, deduped, universe-validated, capped at BOARD_DEPTH_MAX,
 * padded from the archetype ranking up to BOARD_DEPTH_MIN). Stance lines are
 * kept only for the player's actual picks, deduped, length-capped.
 *
 * Returns { board, rationale, userPicksStance, invalidDropped, padded }.
 */
export function normalizeBoardSubmission(input, { validSymbols, fallbackRanking = [], userPickSymbols = new Set() } = {}) {
  const { BOARD_DEPTH_MIN, BOARD_DEPTH_MAX } = TOURNAMENT_TUNING;
  const board = [];
  const rationale = {};
  const seen = new Set();
  let invalidDropped = 0;

  for (const item of Array.isArray(input?.board) ? input.board : []) {
    if (board.length >= BOARD_DEPTH_MAX) break;
    const symbol = typeof item?.symbol === 'string' ? item.symbol.trim().toUpperCase() : '';
    if (!symbol || seen.has(symbol)) continue;
    if (!validSymbols?.has(symbol)) {
      invalidDropped++;
      continue;
    }
    seen.add(symbol);
    board.push(symbol);
    if (typeof item.rationale === 'string' && item.rationale.trim()) {
      rationale[symbol] = item.rationale.trim().slice(0, RATIONALE_MAX_CHARS);
    }
  }

  const padded = [];
  for (const symbol of fallbackRanking) {
    if (board.length >= BOARD_DEPTH_MIN) break;
    if (seen.has(symbol) || !validSymbols?.has(symbol)) continue;
    seen.add(symbol);
    board.push(symbol);
    padded.push(symbol);
    rationale[symbol] = 'Archetype-ranking fill (board came back short).';
  }

  const userPicksStance = [];
  const stanceSeen = new Set();
  for (const item of Array.isArray(input?.userPicksReaction) ? input.userPicksReaction : []) {
    const symbol = typeof item?.symbol === 'string' ? item.symbol.trim().toUpperCase() : '';
    if (!symbol || stanceSeen.has(symbol) || !userPickSymbols.has(symbol)) continue;
    if (typeof item.stance !== 'string' || !item.stance.trim()) continue;
    stanceSeen.add(symbol);
    userPicksStance.push({ symbol, stance: item.stance.trim().slice(0, STANCE_MAX_CHARS) });
  }

  return { board, rationale, userPicksStance, invalidDropped, padded };
}

/**
 * The agentBoards/{agentId} document (rider #2 shape + rider #6 board-time
 * half). `userPicksAtBoardTime` snapshots the picks the stance lines refer
 * to, so the P5 playback surface never needs a cross-doc time join.
 */
export function buildAgentBoardDoc({
  agentId, odUserId, archetype, group, board, rationale = {}, userPicksStance = [],
  userPicks = [], fallback, fallbackReason = null, padded = [], invalidDropped = 0,
  model = null, synthetic = false, now,
}) {
  return {
    agentId,
    odUserId,
    archetype,
    board,
    rationale,
    userPicksStance,
    userPicksAtBoardTime: userPicks,
    roundNumber: group.roundNumber,
    ...(group.bracketGameId != null
      ? { bracketGameId: group.bracketGameId }
      : { baseLayerWeek: group.baseLayerWeek }),
    fallback,
    ...(fallbackReason ? { fallbackReason } : {}),
    ...(padded.length > 0 ? { padded } : {}),
    ...(invalidDropped > 0 ? { invalidDropped } : {}),
    model,
    ...(synthetic ? { synthetic: true } : {}),
    producedAt: toIso(now),
  };
}

// ==================== AGENT RESOLUTION ====================

/**
 * Map each group member to their agent (the client prefill precedent:
 * src/services/tournamentGroupService.js assembleBoardPrefill — agents where
 * ownerId == uid, limit 1). A member with NO agent gets a SYNTHETIC identity
 * and will receive the deterministic fallback board — dev/preview affordance
 * only (see the module header); logged loudly every time.
 */
export async function resolveGroupAgents(db, group) {
  const out = [];
  for (const odUserId of group.groupMembers || []) {
    const snap = await db.collection('agents').where('ownerId', '==', odUserId).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      out.push({ odUserId, agentId: doc.id, agent: { id: doc.id, ...doc.data() }, synthetic: false });
    } else {
      console.warn(`${LOG_PREFIX} member ${odUserId} has no agent doc — SYNTHETIC identity (dev/preview affordance; production groups must have real agents)`);
      out.push({ odUserId, agentId: `dev-agent-${odUserId}`, agent: null, synthetic: true });
    }
  }
  return out;
}

// ==================== PRODUCTION ====================

/**
 * One agent's board via the Sonnet call; ANY failure (API error, tool miss,
 * degenerate board) degrades to the deterministic fallback — this function
 * always returns a usable board. `rankedStocks` must be archetype-ordered.
 */
export async function produceBoardForAgent({
  anthropic, agent, archetype, rankedStocks, validSymbols, userPicks, equippedWatchlist,
}) {
  const fallbackRanking = rankedStocks.map(s => s.symbol);
  const userPickSymbols = new Set(userPicks.map(p => p.symbol));
  try {
    const temps = ARCHETYPE_TEMPERATURES[archetype] || ARCHETYPE_TEMPERATURES.analyst;
    const response = await anthropic.messages.create({
      model: AGENT_BOARD_MODEL,
      max_tokens: AGENT_BOARD_MAX_TOKENS,
      temperature: temps.sonnet,
      system: buildBoardSystemPrompt(formatMarketCSV(rankedStocks), archetype),
      messages: [{ role: 'user', content: buildBoardUserPrompt(agent, { userPicks, equippedWatchlist }) }],
      tools: [AGENT_BOARD_TOOL],
      tool_choice: { type: 'tool', name: 'submit_board' },
    });

    const toolUse = response.content.find((c) => c.type === 'tool_use');
    if (!toolUse) throw new Error('Sonnet did not use the submit_board tool');

    const normalized = normalizeBoardSubmission(toolUse.input, { validSymbols, fallbackRanking, userPickSymbols });
    if (normalized.board.length < TOURNAMENT_TUNING.BOARD_DEPTH_MIN) {
      throw new Error(`normalized board has ${normalized.board.length} names (< ${TOURNAMENT_TUNING.BOARD_DEPTH_MIN}) even after padding`);
    }
    return { ...normalized, fallback: false, fallbackReason: null, model: AGENT_BOARD_MODEL };
  } catch (err) {
    console.error(`${LOG_PREFIX} board call FAILED for agent ${agent?.id || agent?.name || 'unknown'} — falling back to archetype ranking:`, err.message);
    return {
      board: buildFallbackBoard(fallbackRanking),
      rationale: {},
      userPicksStance: [],
      invalidDropped: 0,
      padded: [],
      fallback: true,
      fallbackReason: err.message,
      model: null,
    };
  }
}

/**
 * Produce + persist all four agent boards for a group. Idempotent: members
 * whose board doc already exists are skipped unless `force`. Each board
 * write is AWAITED (rider #2); one member's failure never blocks the rest
 * (the banking-loop posture) — but a missing board WILL stop the agent
 * draft, which guards on boards_missing.
 */
export async function produceGroupBoards(db, group, { anthropic, now = new Date(), force = false } = {}) {
  if (!group) throw sentinel('group_not_found');
  if (group.status !== GROUP_STATUS.BATTLE) throw sentinel('not_battle', `status is '${group.status}'`);

  const rankingsDoc = await db.collection('indexIntelligence').doc('stockRankings').get();
  const stocks = rankingsDoc.exists ? rankingsDoc.data().stocks : null;
  if (!Array.isArray(stocks) || stocks.length < TOURNAMENT_TUNING.BOARD_DEPTH_MIN) {
    throw sentinel('universe_unavailable', `stockRankings yielded ${stocks?.length ?? 0} names`);
  }
  const validSymbols = new Set(stocks.map(s => s.symbol));

  const boardsCol = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(group.id).collection(AGENT_BOARDS_SUBCOLLECTION);
  const existingSnap = await boardsCol.get();
  const existingByUser = new Set();
  existingSnap.forEach(doc => {
    const odUserId = doc.data()?.odUserId;
    if (odUserId) existingByUser.add(odUserId);
  });

  const members = await resolveGroupAgents(db, group);
  const summary = { produced: 0, skipped: 0, fallbacks: 0, errors: 0, boards: [] };

  for (const { odUserId, agentId, agent, synthetic } of members) {
    if (existingByUser.has(odUserId) && !force) {
      summary.skipped++;
      continue;
    }

    try {
      const archetype = agent?.archetype || 'analyst';
      const rankedStocks = computeArchetypeRankings(stocks, archetype);
      const userPicks = getOwnUserPicks(group, odUserId);

      // Equipped watchlist — the decide.js degrade posture: any failure
      // (missing, uncommitted, read error) silently means "no equip".
      let equippedWatchlist = null;
      if (agent?.equippedWatchlistId) {
        try {
          const wlSnap = await db.collection('watchlists').doc(agent.equippedWatchlistId).get();
          const resolved = resolveEquippedWatchlist(wlSnap.exists ? wlSnap.data() : null);
          if (resolved) {
            equippedWatchlist = {
              name: resolved.name,
              thesis: resolved.thesis,
              tickers: extractTickerSymbols(resolved.tickers),
            };
          }
        } catch (wlErr) {
          console.warn(`${LOG_PREFIX} equipped watchlist read failed for agent ${agentId} — degrading to no equip:`, wlErr.message);
        }
      }

      const result = synthetic
        ? {
            board: buildFallbackBoard(rankedStocks.map(s => s.symbol)),
            rationale: {},
            userPicksStance: [],
            invalidDropped: 0,
            padded: [],
            fallback: true,
            fallbackReason: 'synthetic_agent',
            model: null,
          }
        : await produceBoardForAgent({ anthropic, agent, archetype, rankedStocks, validSymbols, userPicks, equippedWatchlist });

      const doc = buildAgentBoardDoc({
        agentId, odUserId, archetype, group, now,
        board: result.board,
        rationale: result.rationale,
        userPicksStance: result.userPicksStance,
        userPicks,
        fallback: result.fallback,
        fallbackReason: result.fallbackReason,
        padded: result.padded,
        invalidDropped: result.invalidDropped,
        model: result.model,
        synthetic,
      });

      // Rider #2: awaited in-request write — never fire-and-forget.
      await boardsCol.doc(agentId).set(doc);

      summary.produced++;
      if (result.fallback) summary.fallbacks++;
      summary.boards.push({ agentId, odUserId, fallback: result.fallback, top3: result.board.slice(0, 3), stances: result.userPicksStance.length });
      console.log(`${LOG_PREFIX} board persisted for ${agentId} (${odUserId})${result.fallback ? ` [FALLBACK: ${result.fallbackReason}]` : ''}`);
    } catch (err) {
      console.error(`${LOG_PREFIX} board production FAILED for member ${odUserId} (agent ${agentId}):`, err.message);
      summary.errors++;
    }
  }

  return summary;
}
