// api/_utils/practiceField/__testsupport__/agentFixtures.js
//
// Practice Field build B2 — the agent's test support: a FAKE TRANSPORT for every model call (no real model, Firestore or
// vendor call is made by any test), scripted answers, and one whole session of a book run as production runs it — the
// three windows (catch-up, sales, entries), the close, then the agent pass at the close.

import { runIdeaBookAgentPass } from '../agentRun.js';
import { AGENT_TOOL_NAME } from '../agentTool.js';
import { runIdeaBookEvalPass } from '../sweep.js';
import { storeTickSnapshot, closeOn, closeNowOf, tickOf, slotNowOf } from './fixtures.js';

/** The stocks every fixture close prices (a slice of the house universe across sectors) and the funds the ideas need. */
export const CANDIDATE_PRICES = Object.freeze({
  AAPL: 230, MSFT: 420, NVDA: 140, AMZN: 200, META: 560, GOOGL: 175, XOM: 115, CVX: 155, KO: 63, PEP: 165,
  WMT: 85, HD: 400, UNH: 520, JNJ: 155, JPM: 220, BAC: 42, GS: 520,
});
export const FUND_PRICES = Object.freeze({ XLF: 48, XLK: 230, XLE: 92, SPY: 590 });

/** A session's quotes: every candidate and fund, each moved by `drift` (a fraction; e.g. 0.01 is +1%) and per-symbol `moves`. */
export function quotesOn({ drift = 0, moves = {} } = {}) {
  const out = {};
  for (const [s, p] of Object.entries({ ...CANDIDATE_PRICES, ...FUND_PRICES })) out[s] = Number((p * (1 + drift + (moves[s] || 0))).toFixed(2));
  return out;
}

/** The founder's hand-entered medium idea (the live book's): JPM, BAC and GS against XLF. */
export function foundersMediumIdea(overrides = {}) {
  return {
    thesis: { text: 'Large US banks re-rate as net interest income holds up while credit stays clean.', author: 'founder_fixture' },
    slot: 'medium',
    names: ['JPM', 'BAC', 'GS'],
    comparison: { type: 'sector_fund', symbols: ['XLF'] },
    lines: [{ symbol: 'JPM', distancePct: 0.1 }, { symbol: 'BAC', distancePct: 0.1 }, { symbol: 'GS', distancePct: 0.1 }],
    capitalUsd: 30000,
    origin: { kind: 'founder_fixture', initiatedBy: 'agent' },
    sources: [],
    ...overrides,
  };
}

/**
 * Which desk a request is for, by the slots its system text gives it (build B6: the text names no desk — ruling B6-1).
 * Exactly one of the two lines, or null.
 */
export function deskOfRequest(request) {
  const text = request?.content?.system?.[0]?.text ?? '';
  const shadow = /^Your slots: medium and long\. /m.test(text);
  const archetype = /^Your slots: short\. /m.test(text);
  if (shadow === archetype) return null;
  return shadow ? 'shadow' : 'archetype';
}

/** The section of the request's message under a heading, as lines. */
export function sectionOf(request, heading) {
  const msg = request?.content?.messages?.[0]?.content ?? '';
  const start = msg.indexOf(`## ${heading}`);
  if (start < 0) return [];
  const rest = msg.slice(start).split('\n').slice(1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end < 0 ? rest : rest.slice(0, end)).filter((l) => l.trim().length > 0);
}

/** The desk's own open idea ids, as the request lists them. */
export function openIdeaIdsOf(request) {
  return sectionOf(request, 'Your open ideas').map((l) => /^- (idea_[0-9a-f]+) ·/.exec(l)?.[1]).filter(Boolean);
}

/** The desk's empty slots, as the request lists them. */
export function emptySlotsOf(request) {
  return sectionOf(request, 'Your empty slots to draft for').map((l) => /^- (short|medium|long) /.exec(l)?.[1]).filter(Boolean);
}

/** A model response that calls the tool once with `input`, with its usage. */
export function toolResponse(input, { inputTokens = 6000, outputTokens = 1800, stopReason = 'tool_use', extraBlocks = [] } = {}) {
  return {
    id: 'msg_fixture', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', stop_reason: stopReason,
    content: [{ type: 'thinking', thinking: '', signature: 'sig' }, ...extraBlocks, { type: 'tool_use', id: 'toolu_1', name: AGENT_TOOL_NAME, input }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  };
}

/** A transport error, as the SDK or the timeout throws one. */
export function transportError(code = 'agent_call_timeout') {
  const err = new Error(`fixture transport error: ${code}`);
  err.code = code;
  return err;
}

/** A plain answer for a request: hold every open idea, note it, and the given drafts. */
export function holdAll(request, { note = 'Holding steady; nothing material changed.', drafts = [] } = {}) {
  return {
    bookNote: note,
    actions: openIdeaIdsOf(request).map((ideaId) => ({ ideaId, action: 'hold', reason: 'The thesis still holds against its comparison.' })),
    drafts,
  };
}

/** A draft in the tool's own shape. */
export function draft({ slot, names, comparison = { type: 'same_stock_held' }, distance, thesis, source = { kind: 'price_list' } }) {
  const d = distance ?? { short: 0.05, medium: 0.1, long: 0.15 }[slot];
  return {
    slot, thesis: thesis ?? `${names.join(' and ')} should outrun their comparison over the slot.`, names, comparison,
    lines: names.map((symbol) => ({ symbol, distancePct: d })), source,
  };
}

/**
 * A fake transport: every call recorded (its desk, its request, the answer given), the answer the script returns —
 * a response, or a thrown error. `script(ctx)` gets `{ desk, request, n, openIdeaIds, emptySlots }`.
 */
export function fakeTransport(script) {
  const calls = [];
  const transport = async (request) => {
    const desk = deskOfRequest(request);
    const ctx = { desk, request, n: calls.length + 1, openIdeaIds: openIdeaIdsOf(request), emptySlots: emptySlotsOf(request) };
    const entry = { desk, request, answered: null, threw: null };
    calls.push(entry);
    const out = await script(ctx);
    if (out instanceof Error) { entry.threw = out.code ?? out.message; throw out; }
    entry.answered = out;
    return out;
  };
  return { transport, calls };
}

/** The instant the agent runs at a session's close: after the close (fixtures close 25 minutes after the bell). */
export const agentNowOf = (date) => new Date(closeNowOf(date).getTime() + 5 * 60_000);

/**
 * One whole session of a book, as the engine's cron runs it: the idea-book EVAL PASS at each of the three windows (each
 * with that session's quotes; its lease, stamp and window-ledger row), the close, then the agent pass at the close with
 * the given transport. Returns `{ windows, close, agent }`.
 */
export async function runSession(db, bookId, date, { quotes, transport, slots = ['open30', 'midday', 'preClose'], clock } = {}) {
  const windows = [];
  for (const slot of slots) {
    await storeTickSnapshot(db, date, slot, quotes);
    windows.push(await runIdeaBookEvalPass(db, { tick: tickOf(date, slot), now: slotNowOf(date, slot), ownerToken: `fixture-${date}-${slot}` }));
  }
  const close = await closeOn(db, bookId, date, quotes);
  const now = agentNowOf(date);
  const agent = await runIdeaBookAgentPass(db, { date, now, ownerToken: `fixture-${date}`, transport, clock: clock ?? (() => now) });
  return { windows, close, agent };
}

/** The desk parts on a session's close row. */
export function deskPartsOf(db, bookId, date) {
  return db._get(`mandates/${bookId}/windows/${date}_close`)?.agent?.desks ?? null;
}
