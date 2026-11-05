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
// the §2 fact with its check time (acted → "acted at the HH:MM check", only
// from a check that heard the thread; heard → "heard at the HH:MM check"; a
// directive answer not yet confirmed → "not confirmed heard"). The third §2
// fact, no_matching_trade, lives in callEvents only and is NOT rendered here
// (review V2-G7); the only events this block reads are the two closing ones,
// below (Amendment G).
// ≤ 1,200 chars, whole-row truncation with "… n more"; priority: open rows,
// then history.
//
// Cockpit Build 2a (Amendment C-2; spec S-3): an upside call (`heldAtMint`)
// renders through `renderUpsideLine` — symbol, side, level, deadline, no
// action clause. The row never carried one (it holds no direction or intent),
// so an upside row's bytes equal the call line's for the same record
// (callsBlock.test.js pins the equality) — the model-visible block does not
// move by a byte.
//
// Cockpit Build 2b (Amendment D-4; spec S-4, S-12): two answer lines join the
// block — `answered: Bring in DHR` (a replace) and `answered: Go now, bring in
// DHR` (a go_now with a chosen name) — the name read from the DIRECTIVE
// RECORD (threads.js selectedPickOf), never from playerResponse. Every v1 row
// renders byte for byte as before (callsBlock.test.js). Fenced-class reviewed
// model-visible text (contract V1.4 §2; the 2b report's L2).
//
// Cockpit Build 2b follow-up (contract Amendment G; the 2b report's CB2-1 and
// CB2-2). G-1: a directive-answered row whose command no longer stands gains ONE
// segment after its §2 fact — `replaced by a later request at 13:46` (the
// `${thread}:superseded` event) or `retired at the 13:15 check: DLTR left the
// book` / `… came into the book another way` (the `${thread}:retired` event). The
// two events are read by id, in one batched get, inside the block's one deadline;
// a row with neither renders byte for byte as before; a failed or timed-out read
// degrades the whole block to null. G-2: a named answer's row whose directive
// record is not in the battle it was handed (the read race) re-reads the battle
// document ONCE, after the calls read and inside the same deadline, and renders
// from the fresh document; a failed re-read degrades the block to null. The three
// segment templates are the only new model-visible text.
//
// Model-visible prose: registered in PROMPT_CONTRIBUTING_MODULES.

import { withTimeout } from '../intraday/evaluatorHook.js';
import { renderCallLine, renderUpsideLine, isUpsideCall, checkLabel, fmtTimeEt, ANSWER_WORDS, answerWithPick, RETIRED_REASONS, RETIRED_REASON_TEXT } from './copy.js';
import { selectedPickOf, directiveRecordOf } from './threads.js';
import { callEventRef, eventIdOf } from './events.js';

export const CALLS_BLOCK_CHAR_CAP = 1_200;
export const CALLS_BLOCK_OPEN_LIMIT = 6;
export const CALLS_BLOCK_HISTORY_LIMIT = 5;
export const CALLS_BLOCK_TIMEOUT_MS = 1_500;
export const RESOLVED_STATES = Object.freeze(['hit', 'expired_unresolved', 'ended_with_battle']);
export const CALLS_BLOCK_HEADING = "CALLS ON THE RECORD (the trading process's called shots: open first, then the five newest resolved — an answer is a request filed to the process, never a trade it has made)";

const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
/** The answers whose directive can carry a chosen name (the pick; Build 2b's replace and named go_now). */
const NAMED_ANSWERS = Object.freeze(['pick', 'replace', 'go_now']);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** The directive thread a call's answer filed, or null (an ack, or an unanswered call, files none). */
const directiveThreadOf = (call) => {
  const pr = call?.playerResponse;
  return pr?.kind === 'directive' && nonEmpty(pr.directiveThreadId) ? pr.directiveThreadId : null;
};

/** The promptBuiltAt of a retained check, by its evalId. */
function promptBuiltAtOf(evaluations, evalId) {
  if (!nonEmpty(evalId) || !Array.isArray(evaluations)) return null;
  const e = evaluations.find((x) => x?.evalId === evalId);
  return nonEmpty(e?.promptBuiltAt) ? e.promptBuiltAt : null;
}

/** The §2 fact for one call, with its check time, or null when nothing is confirmed. */
export function renderCallFact(call, { evaluations = [] } = {}) {
  const pr = call?.playerResponse;
  if (pr?.kind !== 'directive') return null;
  // "Not confirmed heard" until a check that heard the thread is on record; "acted" only from a
  // heard check — a flip stamp from a check that never heard the answer (a trade predating it) is a
  // coincident action, not the §2 fact (review L5-9).
  if (!nonEmpty(pr.heardEvalId)) return 'not confirmed heard';
  const acted = call?.outcome?.actedEvalId;
  const actedBuiltAt = nonEmpty(acted) ? promptBuiltAtOf(evaluations, acted) : null;
  const filedMs = Date.parse(pr.filedAt ?? '');
  const actedMs = Date.parse(actedBuiltAt ?? '');
  const coincident = Number.isFinite(filedMs) && Number.isFinite(actedMs) && actedMs < filedMs;
  if (nonEmpty(acted) && !coincident) {
    const label = checkLabel(actedBuiltAt);
    return `acted${label ? ` at ${label}` : ''}`;
  }
  const label = checkLabel(promptBuiltAtOf(evaluations, pr.heardEvalId));
  return `heard${label ? ` at ${label}` : ''}`;
}

/**
 * The segment for a command that no longer stands (Amendment G, G-1), from its
 * two closing events as stored (`buildCallEvent`: `symbol` and `reason` ride at
 * the event's top level, `checkLabel` under `evidence`). The three templates:
 *   superseded                   → `replaced by a later request at {HH:MM}`
 *   retired, left the book       → `retired at {check}: {SYM} left the book`
 *   retired, came in another way → `retired at {check}: {SYM} came into the book another way`
 * `{HH:MM}` is the event's `at` on the 24-hour ET clock check labels use. Both
 * events present → the earlier by `at` (a tie goes to `superseded`). An event
 * that cannot fill its template (no usable `at`, an unknown reason, no symbol or
 * check label) yields no segment — no other wording is invented. Null with
 * neither.
 */
export function endedSegmentOf({ superseded = null, retired = null } = {}) {
  const candidates = [];
  const time = finite(superseded?.at) ? fmtTimeEt(superseded.at) : null;
  if (time) candidates.push({ at: superseded.at, text: `replaced by a later request at ${time}` });
  if (RETIRED_REASONS.includes(retired?.reason) && nonEmpty(retired.symbol) && nonEmpty(retired.evidence?.checkLabel)) {
    candidates.push({ at: finite(retired.at) ? retired.at : Infinity, text: `retired at ${retired.evidence.checkLabel}: ${retired.symbol} ${RETIRED_REASON_TEXT[retired.reason]}` });
  }
  if (candidates.length === 0) return null;
  return candidates.reduce((first, c) => (c.at < first.at ? c : first)).text;
}

/** One row: id · line · state · answer · fact · (when it no longer stands) segment. Null when the call cannot be rendered. */
export function renderCallsRow(call, { nowMs = Date.now(), evaluations = [], battle = null, events = null } = {}) {
  const line = isUpsideCall(call) ? renderUpsideLine(call, { nowMs }) : renderCallLine(call, { nowMs });
  if (!line || !nonEmpty(call?.callId)) return null;
  const parts = [call.callId, line, call.state ?? 'unknown'];
  const answer = call.playerResponse?.answer;
  // The selected pick lives in the directive's own record (spec §5), never on playerResponse (review L6-2 / L5-3).
  // Cockpit Build 2b (D-4): so does a chosen name — `answered: Bring in DHR` for a replace,
  // `answered: Go now, bring in DHR` for a named go_now; a go_now without one reads as before.
  const pick = NAMED_ANSWERS.includes(answer) ? selectedPickOf(battle, call.playerResponse?.directiveThreadId) : null;
  if (ANSWER_WORDS[answer]) parts.push(`answered: ${answerWithPick(answer, pick)}`);
  const fact = renderCallFact(call, { evaluations });
  if (fact) parts.push(fact);
  // Amendment G, G-1: `events` is a Map of directive thread → { superseded, retired } (readEndingEvents); absent → the row is as it was.
  const ended = endedSegmentOf(events?.get(directiveThreadOf(call)));
  if (ended) parts.push(ended);
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
export function buildCallsBlock({ open = [], history = [], awaiting = [] }, { nowMs = Date.now(), evaluations = [], battle = null, events = null } = {}) {
  const rows = [...open, ...awaiting, ...history].map((c) => renderCallsRow(c, { nowMs, evaluations, battle, events })).filter(Boolean);
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
export async function readCallsForBlock(db, battleId, { timeoutMs = CALLS_BLOCK_TIMEOUT_MS, deadlineMs = Date.now() + timeoutMs } = {}) {
  const calls = db.collection('agentBattles').doc(battleId).collection('calls');
  const bounded = (q, label) => withTimeout(q.get(), Math.max(1, deadlineMs - Date.now()), label);
  const [openPage, ...resolvedPages] = await Promise.all([
    bounded(calls.where('state', '==', 'open').orderBy('mintedAt', 'desc').limit(CALLS_BLOCK_OPEN_LIMIT), 'calls_block_open'),
    ...RESOLVED_STATES.map((s) => bounded(calls.where('state', '==', s).orderBy('mintedAt', 'desc').limit(CALLS_BLOCK_HISTORY_LIMIT), `calls_block_${s}`)),
  ]);
  const data = (page) => (page?.docs || []).map((d) => d.data());
  return { open: data(openPage), history: mergeHistory(resolvedPages.map(data)), awaiting: [] };
}

/**
 * The `superseded` and `retired` events of the given directive threads, by id, in
 * ONE batched get inside the block's deadline (Amendment G, G-1). A Map of thread
 * → { superseded, retired } (each the stored event or null). Throws on a failed
 * or timed-out read; the chat entry degrades to null. No threads → no read.
 */
export async function readEndingEvents(db, battleId, threadIds, { deadlineMs }) {
  if (threadIds.length === 0) return new Map();
  const refs = threadIds.flatMap((directiveThreadId) => [
    callEventRef(db, battleId, eventIdOf('superseded', { directiveThreadId })),
    callEventRef(db, battleId, eventIdOf('retired', { directiveThreadId })),
  ]);
  const snaps = await withTimeout(db.getAll(...refs), Math.max(1, deadlineMs - Date.now()), 'calls_block_events');
  if (!Array.isArray(snaps) || snaps.length !== refs.length) throw new Error('calls_block_events_short_read');
  const dataOf = (snap) => (snap?.exists ? snap.data() : null);
  return new Map(threadIds.map((id, i) => [id, { superseded: dataOf(snaps[2 * i]), retired: dataOf(snaps[2 * i + 1]) }]));
}

/**
 * Does a named answer's row find no directive record in the battle in hand
 * (Amendment G, G-2)? A record that is there, with or without a chosen name, is
 * not the race — a plain go_now reads bare — so only an ABSENT record asks for
 * the one re-read.
 */
export function needsBattleReread(calls, battle) {
  return calls.some((c) => {
    const thread = directiveThreadOf(c);
    return thread !== null && NAMED_ANSWERS.includes(c.playerResponse.answer) && directiveRecordOf(battle, thread) === null;
  });
}

/** The battle document, read once more inside the block's deadline. Throws when unread or gone (the block degrades to null). */
async function rereadBattle(db, battleId, { deadlineMs }) {
  const snap = await withTimeout(db.collection('agentBattles').doc(battleId).get(), Math.max(1, deadlineMs - Date.now()), 'calls_block_battle');
  if (!snap?.exists) throw new Error('calls_block_battle_missing');
  return snap.data();
}

/**
 * The chat route's one call: read and render, at resolved 'on' only; any failure → null (the turn continues).
 * ONE deadline covers the calls read, the closing-events read and the conditional battle re-read
 * (Amendment G); the two later reads start together once the calls are in hand.
 */
export async function buildCallsBlockForChat(db, battleId, battle, { callsMode, nowMs = Date.now(), timeoutMs = CALLS_BLOCK_TIMEOUT_MS } = {}) {
  if (callsMode !== 'on') return null;
  try {
    const deadlineMs = Date.now() + timeoutMs;
    const read = await readCallsForBlock(db, battleId, { deadlineMs });
    const calls = [...read.open, ...read.awaiting, ...read.history];
    const threadIds = [...new Set(calls.map(directiveThreadOf).filter(Boolean))];
    const [events, fresh] = await Promise.all([
      readEndingEvents(db, battleId, threadIds, { deadlineMs }),
      needsBattleReread(calls, battle) ? rereadBattle(db, battleId, { deadlineMs }) : Promise.resolve(null),
    ]);
    const doc = fresh ?? battle;
    return buildCallsBlock(read, { nowMs, evaluations: doc?.evaluations, battle: doc, events });
  } catch (err) {
    console.warn('[calls] chat calls block degraded to null:', err?.message || err);
    return null;
  }
}
