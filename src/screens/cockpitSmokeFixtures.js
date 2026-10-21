// src/screens/cockpitSmokeFixtures.js
//
// SMOKE BRANCH ONLY — claude/cockpit-build2b-smoke, never merged (Cockpit
// Build 2b spec docs/COCKPIT_BUILD2B_SPEC_V1_0.md §12 "Smoke branch"). 2a's
// `?cockpitFixtures=1` fixture mode, extended for 2b.
//
// `?cockpitFixtures=<variant>` on the Battle View bypasses the status check
// and every reader and runs the cockpit on IN-MEMORY records — no Firestore
// read, no POST, no bench request. A small store stands in for the listener:
// an answer the scripted endpoint accepts writes the records the real endpoint
// would (the call's playerResponse, the slot, the cockpit exchange, the
// `answered` / `superseded` events), so the screen moves exactly as it does on
// a real battle — the meter counts down, a Confirm exit holds the card, a pick
// turns it into the command card with the filed step.
//
//   1        the Who comes in case leads (priority 1); the strip holds an entry
//            (2), a hold-default exit (3 — "Exit instead" opens the step), an
//            entry + hold, an upside call, a moved line, an agreement; Earlier
//            holds every resolved tag of §7.1, and four answered calls carry the
//            receipts (retired · replaced by your command · by chat · no match) —
//            their four filings leave the meter at 3
//   fresh    `1` without those four answered calls: the meter at 7
//   p2       the same without the priority-1 card → the entry leads
//   p3       neither (and the wait and the moved line resolved) → the hold-default
//            exit leads, its "Exit instead" step on the card
//   p4       no card above priority 4 (the wait and the moved line resolved):
//            your live command on a held name (+ a restatement under it:
//            "Following your call") → the command card leads; the composer line;
//            the teal board dot
//   heard    p4, heard at a check
//   quiet    no open call but an upside one → the quiet line
//   meter1   1 command left · meter0: none left (overrides read "No commands left")
//   command  `1` with a live cockpit command on another call → every override
//            asks the replace confirmation first
//   chat     `1` with a live CHAT directive → an override returns 409
//            replace_unconfirmed and the prompt opens from its text
//   filed    the priority-1 exit already answered with a pick (and no other
//            card above priority 4) → the command card with
//            "✓ {IN} comes in if {SYM} exits · filed"
//
// The bench sheet answers from fixture rows (both modes): available, a locked
// row, an unswappable (crypto) row and a no-price row. Board dots ride on the
// battle's OWN held symbols (the fixture calls use them), on both shells.

import { buildCallDirectivePlan } from '../../api/_utils/callRecords/callActions.js';
import { classifyAnswer, isGoAcknowledgment } from '../../api/_utils/callRecords/answers.js';

export const SMOKE_PARAM = 'cockpitFixtures';
const VARIANTS = new Set(['1', 'fresh', 'p2', 'p3', 'p4', 'heard', 'quiet', 'meter1', 'meter0', 'command', 'chat', 'filed']);

/** The smoke variant from the URL, or null (fixture mode off). Never throws. */
export function cockpitSmokeVariant() {
  try {
    const v = new URLSearchParams(window.location.search).get(SMOKE_PARAM);
    return VARIANTS.has(v) ? v : null;
  } catch {
    return null;
  }
}

const SLOT_MS = 15 * 60 * 1000;
const HOUR = 3_600_000;
const TIERS = ['star', 'core', 'support'];

/** The battle's own held, non-cash symbols in tier order (the board shows them), padded with fixture names. */
function heldOf(battle) {
  const out = [];
  for (const t of TIERS) for (const r of Array.isArray(battle?.portfolio?.[t]) ? battle.portfolio[t] : []) {
    if (r && typeof r.symbol === 'string' && r.symbol && !r.isCash && r.symbol !== 'CASH') out.push({ symbol: r.symbol, slot: t });
  }
  const pad = [{ symbol: 'KO', slot: 'support' }, { symbol: 'PG', slot: 'support' }, { symbol: 'JNJ', slot: 'core' }];
  while (out.length < 3) out.push(pad[out.length]);
  return out;
}

/**
 * @param {{ battleId: string, battle: object, evaluations: object[]|null, nowMs: number, variant: string }} p
 * @returns {{ get: () => object, subscribe: (fn) => () => void, post: Function, requestBench: Function }}
 */
export function createCockpitSmoke({ battleId, battle, evaluations, nowMs, variant }) {
  const slot = Math.floor(nowMs / SLOT_MS) * SLOT_MS;
  const at = (k) => slot - k * SLOT_MS + 20_000;
  const real = (Array.isArray(evaluations) ? evaluations : []).map((e) => e?.evalId).filter((id) => typeof id === 'string' && id);
  const evalIdOf = (k) => real[real.length - 1 - k] ?? `smoke-check-${k}`;
  const check = (k) => ({ evalId: evalIdOf(k), at: at(k) });
  const [c0, c1, c2, c3] = [check(3), check(2), check(1), check(0)];
  const live = { phrase: 'this_session', expiresAt: nowMs + 3 * HOUR, basis: 'this_session' };
  const [h0, h1, h2] = heldOf(battle);
  let n = 0;
  const call = (over = {}) => {
    n += 1;
    const c = over.check ?? c2;
    const { check: _c, ...rest } = over;
    return {
      callId: `${battleId}:smoke2b:call:${n}`, kind: 'called_shot', battleId, evalId: c.evalId, evalSeq: n,
      mintedAt: c.at + 40_000, mintedMode: 'on',
      symbol: 'AMD', direction: 'entry', heldAtMint: false, slot: 'support', counterpart: null, counterpartRaw: null,
      condition: { side: 'above', level: 100 }, horizon: live,
      defaultAction: 'act', said: null, saidOk: null,
      evidence: { tickId: `smoke-${n}`, availability: 'unresolved', priceAsOf: new Date(c.at).toISOString() },
      hypothesisRef: null, origin: 'declared',
      state: 'open', stateChangedAt: c.at + 40_000, stateSource: 'mint',
      playerResponse: null, directiveThreadId: null, outcome: null, refused: null,
      replacementOptions: null, invalidatedReason: null,
      ...rest,
    };
  };
  const ev = (callIds, kind, atMs, extra = {}) => ({ kind, at: atMs, callIds, text: '', evidence: {}, ...extra });
  const exchange = (directive, atMs) => ({
    userMessage: null, agentResponse: '', hasDirective: true, directive, directiveThreadId: directive.directiveThreadId,
    timestamp: new Date(atMs).toISOString(), mode: 'battle', messageType: 'directive_filed', source: 'cockpit', callId: directive.callId ?? null,
  });
  const fileOn = (c, answer, { pickSymbol = null, filedAtMs, heard = null } = {}) => {
    const filedAt = new Date(filedAtMs).toISOString();
    const plan = buildCallDirectivePlan({ call: c, answer, pickSymbol, nowMs, filedAt, v2: true });
    const thread = `smoke-thread-${c.callId}`;
    const directive = { ...plan.normalized, directiveThreadId: thread, createdAt: filedAt };
    c.playerResponse = { answer, kind: 'directive', directiveThreadId: thread, callId: c.callId, filedAt, heardEvalId: heard };
    c.directiveThreadId = thread;
    return directive;
  };

  // ---- the open cards
  const p1 = call({
    kind: 'confirmation', symbol: h0.symbol, slot: h0.slot, direction: 'exit', condition: { side: 'below', level: 158.4 }, check: c1,
    replacementOptions: [{ symbol: 'MPC', source: 'agent', rank: 6 }, { symbol: h1.symbol, source: 'agent', rank: null }, { symbol: 'XOM', source: 'bench', rank: 3 }, { symbol: 'PSX', source: 'bench', rank: 1 }],
  });
  const p2 = call({ symbol: 'AMD', counterpart: h2.symbol, slot: h2.slot, condition: { side: 'above', level: 163.5 }, check: c2 });
  const p3 = call({ symbol: h1.symbol, slot: h1.slot, direction: 'exit', defaultAction: 'hold', condition: { side: 'below', level: 290 }, check: c2, replacementOptions: [{ symbol: 'XOM', source: 'bench', rank: 3 }, { symbol: 'CVX', source: 'bench', rank: 5 }] });
  const wait = call({ symbol: 'NFLX', defaultAction: 'hold', condition: { side: 'above', level: 702 }, check: c3 });
  const upside = call({ symbol: h2.symbol, slot: h2.slot, heldAtMint: true, defaultAction: 'hold', condition: { side: 'above', level: 625 }, check: c2 });
  const movedA = call({ symbol: 'CRWD', defaultAction: 'hold', condition: { side: 'above', level: 360 }, check: c0 });
  const movedB = call({ symbol: 'CRWD', defaultAction: 'hold', condition: { side: 'above', level: 371 }, check: c2 });
  const agreed = call({ symbol: 'PEP', counterpart: h2.symbol, condition: { side: 'above', level: 171 }, check: c1 });
  agreed.playerResponse = { answer: 'go', kind: 'ack', callId: agreed.callId, filedAt: new Date(c1.at + 120_000).toISOString() };

  // ---- Earlier: every resolved row of §7.1 (and 2a's)
  const done = (over) => call({ check: c0, ...over });
  const hit = done({ symbol: 'WMT', state: 'hit', stateChangedAt: c1.at + 30_000 });
  const expired = done({ symbol: 'NKE', state: 'expired_unresolved', stateChangedAt: c2.at + 30_000, horizon: { phrase: 'next_check', expiresAt: c1.at, basis: 'next_check' } });
  const actedExpired = done({ symbol: 'V', state: 'expired_unresolved', stateChangedAt: c2.at + 30_000, outcome: { actedEvalId: c1.evalId } });
  const ended = done({ symbol: 'ZS', state: 'ended_with_battle', stateChangedAt: c2.at + 30_000 });
  const dropped = done({ symbol: 'DIS', state: 'invalidated', invalidatedReason: 'level_implausible' });
  const droppedBare = done({ symbol: 'SBUX', state: 'invalidated', invalidatedReason: null });

  // ---- receipts on open, answered calls: retired · replaced by your later command · by a chat instruction · no match
  const retired = call({ symbol: 'UBER', direction: 'exit', slot: 'support', defaultAction: 'hold', check: c0, condition: { side: 'below', level: 70 } });
  const retiredDirective = fileOn(retired, 'go_now', { filedAtMs: c0.at + 100_000 });
  const replacedMine = call({ symbol: 'SNAP', check: c0, condition: { side: 'above', level: 12 } });
  const replacedMineDirective = fileOn(replacedMine, 'hold', { filedAtMs: c0.at + 110_000 });
  const replacedChat = call({ symbol: 'LYFT', check: c0, condition: { side: 'above', level: 18 } });
  const replacedChatDirective = fileOn(replacedChat, 'hold', { filedAtMs: c0.at + 120_000 });
  const noMatch = call({ symbol: 'SNOW', check: c1, direction: 'exit', defaultAction: 'hold', condition: { side: 'below', level: 150 } });
  const noMatchDirective = fileOn(noMatch, 'go_now', { pickSymbol: 'XOM', filedAtMs: c1.at + 100_000, heard: c2.evalId });

  const receipts = variant !== 'fresh';
  const calls = [movedA, movedB, wait, upside, agreed, hit, expired, actedExpired, ended, dropped, droppedBare, ...(receipts ? [retired, replacedMine, replacedChat, noMatch] : [])];
  if (!['p2', 'p3', 'p4', 'heard', 'quiet'].includes(variant)) calls.push(p1);
  if (!['p3', 'p4', 'heard', 'quiet', 'filed'].includes(variant)) calls.push(p2);
  if (!['p4', 'heard', 'quiet', 'filed'].includes(variant)) calls.push(p3);
  // The hold-default called shots (the wait, the moved line) rank 3 on the Now card: the command variants resolve
  // them so the command card (4) leads, and the quiet one resolves the agreement too.
  if (['quiet', 'p3', 'p4', 'heard', 'filed'].includes(variant)) for (const c of [movedA, movedB, wait]) c.state = 'expired_unresolved';
  if (variant === 'quiet') agreed.state = 'expired_unresolved';

  const chatThread = 'smoke-chat-thread';
  const exchanges = [
    ...(receipts ? [
      exchange(retiredDirective, c0.at + 100_000),
      exchange(replacedMineDirective, c0.at + 110_000),
      exchange(replacedChatDirective, c0.at + 120_000),
      exchange(noMatchDirective, c1.at + 100_000),
    ] : []),
    { userMessage: 'sell into strength', agentResponse: 'Got it.', hasDirective: true, directive: { text: 'Sell into strength into the close', expiry: 'end_of_battle', directiveThreadId: chatThread }, directiveThreadId: chatThread, timestamp: new Date(c1.at + 200_000).toISOString(), mode: 'battle', source: 'chat' },
  ];
  const events = receipts ? [
    ev([retired.callId], 'retired', c1.at + 50_000, { symbol: 'UBER', reason: 'symbol_not_held' }),
    ev([replacedMine.callId], 'superseded', c1.at + 100_000, { supersededBy: noMatchDirective.directiveThreadId, supersededDirectiveThreadId: replacedMineDirective.directiveThreadId }),
    ev([replacedChat.callId], 'superseded', c1.at + 200_000, { supersededBy: chatThread, supersededDirectiveThreadId: replacedChatDirective.directiveThreadId }),
    ev([noMatch.callId], 'heard', c2.at + 60_000, { evidence: { evalId: c2.evalId, promptBuiltAt: new Date(c2.at).toISOString() } }),
    ev([noMatch.callId], 'no_matching_trade', c2.at + 60_000, { evidence: { evalId: c2.evalId, promptBuiltAt: new Date(c2.at).toISOString() } }),
    ev([actedExpired.callId], 'acted', c1.at + 60_000, { evidence: { evalId: c1.evalId, promptBuiltAt: new Date(c1.at).toISOString() } }),
  ] : [ev([actedExpired.callId], 'acted', c1.at + 60_000, { evidence: { evalId: c1.evalId, promptBuiltAt: new Date(c1.at).toISOString() } })];

  // ---- the slot, by variant
  let directive = null;
  if (variant === 'p4' || variant === 'heard') {
    // "Hold off" on an exit + act call is a COMMAND (call_hold, asking for the hold default); its restatement holds.
    const cmd = call({ kind: 'confirmation', symbol: h0.symbol, slot: h0.slot, direction: 'exit', defaultAction: 'act', condition: { side: 'below', level: 158.4 }, check: c1 });
    directive = fileOn(cmd, 'hold', { filedAtMs: c1.at + 150_000, heard: variant === 'heard' ? c2.evalId : null });
    const restated = call({ kind: 'confirmation', symbol: h0.symbol, slot: h0.slot, direction: 'exit', defaultAction: 'hold', condition: { side: 'below', level: 158.9 }, check: c3 });
    calls.push(cmd, restated);
    exchanges.push(exchange(directive, c1.at + 150_000));
    events.push(ev([restated.callId], 'declared', c3.at + 40_000, { promptDirectiveThreadId: directive.directiveThreadId }));
    if (variant === 'heard') events.push(ev([cmd.callId], 'heard', c2.at + 60_000, { evidence: { evalId: c2.evalId, promptBuiltAt: new Date(c2.at).toISOString() } }));
  } else if (variant === 'command') {
    const cmd = call({ symbol: h2.symbol, slot: h2.slot, direction: 'exit', defaultAction: 'act', counterpart: null, condition: { side: 'below', level: 88 }, check: c1 });
    directive = fileOn(cmd, 'hold', { filedAtMs: c1.at + 150_000 });
    calls.push(cmd);
    exchanges.push(exchange(directive, c1.at + 150_000));
  } else if (variant === 'chat') {
    directive = { text: 'Sell into strength into the close', expiry: 'end_of_battle', directiveThreadId: chatThread, createdAt: new Date(c1.at + 200_000).toISOString() };
  } else if (variant === 'filed') {
    directive = fileOn(p1, 'replace', { pickSymbol: 'XOM', filedAtMs: c2.at + 100_000 });
    exchanges.push(exchange(directive, c2.at + 100_000));
  }
  // The meter variants pad the cockpit filings already on record up to 6 (1 left) or 7 (none left).
  const already = exchanges.filter((e) => e.source === 'cockpit' && e.hasDirective === true).length;
  const spent = variant === 'meter1' ? Math.max(0, 6 - already) : (variant === 'meter0' ? Math.max(0, 7 - already) : 0);
  for (let i = 0; i < spent; i += 1) exchanges.unshift({ hasDirective: true, source: 'cockpit', directiveThreadId: `smoke-old-${i}`, directive: { kind: 'call_hold', text: 'earlier command', directiveThreadId: `smoke-old-${i}` }, timestamp: new Date(c0.at - (i + 1) * 60_000).toISOString() });

  const monitoring = { symbols: ['MPC', 'XOM', 'PLTR', 'ARM', 'COIN', 'HOOD'], evalId: c3.evalId, mintedAt: c3.at + 40_000 };
  // The bench the step and the sheet judge against: the battle's book, this bench, this hot bench.
  const bench = {
    stocks: [{ symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy' }, { symbol: 'CVX', name: 'Chevron', sector: 'Energy' }, { symbol: 'PSX', name: 'Phillips 66', sector: 'Energy', cooldownUntil: new Date(nowMs + 2 * HOUR).toISOString() }],
    crypto: { symbol: 'ETH.CC', isCrypto: true },
  };

  let state = { calls, events, monitoring, directive, chatExchanges: exchanges, bench, hotBench: ['MPC'] };
  const listeners = new Set();
  const set = (next) => { state = next; for (const fn of listeners) fn(); };
  const get = () => state;
  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

  // ---- the scripted endpoint: the real one's checks that the smoke needs, then the writes it would make
  const post = async ({ callId, answer, pickSymbol = null, confirmReplace = false }) => {
    await new Promise((r) => setTimeout(r, 600)); // long enough to see "Sending…"
    const c = state.calls.find((x) => x.callId === callId);
    if (!c) return { status: 400, body: { error: 'unknown_call' } };
    const row = classifyAnswer(c, answer, { v2: true });
    const second = answer === 'replace' && isGoAcknowledgment(c.playerResponse);
    if (c.playerResponse && !second) return { status: 409, body: { error: 'refused', reason: 'already_answered' } };
    const filedAtMs = Date.now();
    const calls2 = state.calls.map((x) => ({ ...x }));
    const c2 = calls2.find((x) => x.callId === callId);
    if (row === 'ack') {
      c2.playerResponse = { answer, kind: 'ack', callId, filedAt: new Date(filedAtMs).toISOString() };
      set({ ...state, calls: calls2, events: [...state.events, ev([callId], 'answered', filedAtMs)] });
      return { status: 200, body: { callId, playerResponse: c2.playerResponse } };
    }
    const used = state.chatExchanges.filter((e) => e.source === 'cockpit' && e.hasDirective === true).length;
    const slotLive = state.directive && state.directive.callId !== callId;
    if (slotLive && !confirmReplace) {
      return { status: 409, body: { error: 'refused', reason: 'replace_unconfirmed', currentDirectiveThreadId: state.directive.directiveThreadId, currentText: state.directive.text, currentCallId: state.directive.callId ?? null } };
    }
    if (used >= 7) return { status: 409, body: { error: 'refused', reason: 'budget' } };
    const after = second ? c2.playerResponse : null;
    const directive2 = fileOn(c2, answer, { pickSymbol, filedAtMs });
    if (after) c2.playerResponse = { ...c2.playerResponse, after };
    const events2 = [...state.events, ev([callId], 'answered', filedAtMs)];
    if (state.directive) {
      const prev = calls2.find((x) => x.directiveThreadId === state.directive.directiveThreadId);
      if (prev) events2.push(ev([prev.callId], 'superseded', filedAtMs, { supersededBy: directive2.directiveThreadId, supersededDirectiveThreadId: state.directive.directiveThreadId }));
    }
    set({ ...state, calls: calls2, events: events2, directive: directive2, chatExchanges: [...state.chatExchanges, exchange(directive2, filedAtMs)] });
    return { status: 200, body: { callId, playerResponse: c2.playerResponse, directiveThreadId: directive2.directiveThreadId, directive: directive2, remaining: 7 - used - 1 } };
  };

  // ---- the bench endpoint's rows (S-10's shape): available · locked · not_swappable · no_price
  const requestBench = async ({ callId = null } = {}) => {
    await new Promise((r) => setTimeout(r, 400));
    const scoped = Boolean(callId);
    const lockedUntil = bench.stocks[2].cooldownUntil;
    const rows = [
      { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', rank: 3, price: 112.4, changePct: 1.24, atrPct: 1.83, status: 'available', lockedUntil: null },
      { symbol: 'CVX', name: 'Chevron', sector: 'Energy', rank: 5, price: 150.2, changePct: -0.42, atrPct: 1.41, status: 'available', lockedUntil: null },
      { symbol: 'PSX', name: 'Phillips 66', sector: 'Energy', rank: 1, price: 140.1, changePct: 2.6, atrPct: 2.1, status: 'locked', lockedUntil },
      { symbol: 'MPC', name: null, sector: 'Energy', rank: 6, price: null, changePct: null, atrPct: 2.4, status: scoped ? 'no_price' : 'available', lockedUntil: null },
      ...(scoped ? [{ symbol: 'ETH.CC', name: null, sector: null, rank: null, price: 2600, changePct: 0.8, atrPct: 3.9, status: 'not_swappable', lockedUntil: null }] : []),
    ];
    return { status: 'ready', data: { asOf: new Date(c3.at).toISOString(), out: scoped ? { symbol: state.calls.find((x) => x.callId === callId)?.symbol ?? null, slot: null } : null, rows } };
  };

  return { get, subscribe, post, requestBench };
}
