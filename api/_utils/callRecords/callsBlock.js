// api/_utils/callRecords/callsBlock.js
//
// Cockpit Build 1a — THE CHAT CALLS BLOCK (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md
// §9; contract V1.4 §8 as amended by Amendment B §8; Astra B1R2-12). At
// RESOLVED 'on' only, chat's prologue reads the battle's calls in three
// bounded queries and renders one bounded block into the voice prompt; at
// off / shadow nothing is read and the prompt is byte-identical (the voice
// goldens).
//
//   open calls     — state == 'open', orderBy mintedAt DESC, limit 6
//                    (the NEW composite `calls: state ASC, mintedAt DESC`)
//   resolved       — state in { hit, expired_unresolved, ended_with_battle }
//                    as three queries on the same index, limit 5 each, merged
//                    by call id and cut to the five newest
//   awaiting       — the "hit awaiting an answer" class: EMPTY in 1a
//                    (reserved for 1b — the re-ask and second answers)
// Each row: the call id, the call line (copy.js), the state, the answer, and
// the §2 fact with its check time (acted → "exited X for Y at the HH:MM
// check"; heard → "heard at the HH:MM check"; a directive answer not yet
// confirmed → "not confirmed heard"). ≤ 1,200 chars, whole-row truncation
// with "… n more"; priority: open rows, then history.
//
// Model-visible prose: registered in PROMPT_CONTRIBUTING_MODULES.

import { withTimeout } from '../intraday/evaluatorHook.js';
import { renderCallLine, checkLabel, ANSWER_WORDS } from './copy.js';

export const CALLS_BLOCK_CHAR_CAP = 1_200;
export const CALLS_BLOCK_OPEN_LIMIT = 6;
export const CALLS_BLOCK_HISTORY_LIMIT = 5;
export const CALLS_BLOCK_TIMEOUT_MS = 1_500;
export const RESOLVED_STATES = Object.freeze(['hit', 'expired_unresolved', 'ended_with_battle']);
export const CALLS_BLOCK_HEADING = "CALLS ON THE RECORD (the trading process's called shots: open first, then the five newest resolved — an answer is a request filed to the process, never a trade it has made)";

const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** The promptBuiltAt of a retained check, by its evalId. */
function promptBuiltAtOf(evaluations, evalId) {
  if (!nonEmpty(evalId) || !Array.isArray(evaluations)) return null;
  const e = evaluations.find((x) => x?.evalId === evalId);
  return nonEmpty(e?.promptBuiltAt) ? e.promptBuiltAt : null;
}

/** The §2 fact for one call, with its check time, or null when nothing is confirmed. */
export function renderCallFact(call, { evaluations = [] } = {}) {
  const pr = call?.playerResponse;
  const acted = call?.outcome?.actedEvalId;
  if (nonEmpty(acted)) {
    const label = checkLabel(promptBuiltAtOf(evaluations, acted));
    return `acted${label ? ` at ${label}` : ''}`;
  }
  if (pr?.kind === 'directive') {
    if (nonEmpty(pr.heardEvalId)) {
      const label = checkLabel(promptBuiltAtOf(evaluations, pr.heardEvalId));
      return `heard${label ? ` at ${label}` : ''}`;
    }
    return 'not confirmed heard';
  }
  return null;
}

/** One row: id · line · state · answer · fact. Null when the call cannot be rendered. */
export function renderCallsRow(call, { nowMs = Date.now(), evaluations = [] } = {}) {
  const line = renderCallLine(call, { nowMs });
  if (!line || !nonEmpty(call?.callId)) return null;
  const parts = [call.callId, line, call.state ?? 'unknown'];
  const answer = call.playerResponse?.answer;
  if (ANSWER_WORDS[answer]) parts.push(`answered: ${ANSWER_WORDS[answer]}${answer === 'pick' && nonEmpty(call.playerResponse?.pickSymbol) ? ` ${call.playerResponse.pickSymbol}` : ''}`);
  const fact = renderCallFact(call, { evaluations });
  if (fact) parts.push(fact);
  return `- ${parts.join(' · ')}`;
}

/** Merge resolved pages by call id, newest first, cut to the history limit. */
export function mergeHistory(pages, limit = CALLS_BLOCK_HISTORY_LIMIT) {
  const byId = new Map();
  for (const page of pages) for (const c of page || []) if (nonEmpty(c?.callId) && !byId.has(c.callId)) byId.set(c.callId, c);
  return [...byId.values()].sort((a, b) => (finite(b.mintedAt) ? b.mintedAt : 0) - (finite(a.mintedAt) ? a.mintedAt : 0)).slice(0, limit);
}

/**
 * THE BLOCK from already-read calls. Open rows first, then history; whole-row
 * truncation under the cap with "… n more". Null when there is nothing to say.
 */
export function buildCallsBlock({ open = [], history = [], awaiting = [] }, { nowMs = Date.now(), evaluations = [] } = {}) {
  const rows = [...open, ...awaiting, ...history].map((c) => renderCallsRow(c, { nowMs, evaluations })).filter(Boolean);
  if (rows.length === 0) return null;
  const lines = [CALLS_BLOCK_HEADING];
  let length = CALLS_BLOCK_HEADING.length;
  let shown = 0;
  for (const row of rows) {
    const more = rows.length - shown - 1;
    const tail = more > 0 ? `\n… ${more} more`.length : 0;
    if (length + 1 + row.length + tail > CALLS_BLOCK_CHAR_CAP) break;
    lines.push(row);
    length += 1 + row.length;
    shown += 1;
  }
  if (shown === 0) return null;
  if (shown < rows.length) lines.push(`… ${rows.length - shown} more`);
  return lines.join('\n');
}

/**
 * The three bounded queries (the awaiting class reserved, empty). Throws on a
 * failed or timed-out read; the chat route degrades to null.
 */
export async function readCallsForBlock(db, battleId, { timeoutMs = CALLS_BLOCK_TIMEOUT_MS } = {}) {
  const calls = db.collection('agentBattles').doc(battleId).collection('calls');
  const deadline = Date.now() + timeoutMs;
  const bounded = (q, label) => withTimeout(q.get(), Math.max(1, deadline - Date.now()), label);
  const [openPage, ...resolvedPages] = await Promise.all([
    bounded(calls.where('state', '==', 'open').orderBy('mintedAt', 'desc').limit(CALLS_BLOCK_OPEN_LIMIT), 'calls_block_open'),
    ...RESOLVED_STATES.map((s) => bounded(calls.where('state', '==', s).orderBy('mintedAt', 'desc').limit(CALLS_BLOCK_HISTORY_LIMIT), `calls_block_${s}`)),
  ]);
  const data = (page) => (page?.docs || []).map((d) => d.data());
  return { open: data(openPage), history: mergeHistory(resolvedPages.map(data)), awaiting: [] };
}

/** The chat route's one call: read and render, at resolved 'on' only; any failure → null (the turn continues). */
export async function buildCallsBlockForChat(db, battleId, battle, { callsMode, nowMs = Date.now() } = {}) {
  if (callsMode !== 'on') return null;
  try {
    const read = await readCallsForBlock(db, battleId);
    return buildCallsBlock(read, { nowMs, evaluations: battle?.evaluations });
  } catch (err) {
    console.warn('[calls] chat calls block degraded to null:', err?.message || err);
    return null;
  }
}
