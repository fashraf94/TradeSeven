// src/components/Research/Sheet/useSheetView.js
//
// Research Modal Build C — THE SHEET'S STATE (spec
// docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md §1, §3.1, BC-3, BC-7,
// BC-8, BC-11, BC-13). The modal calls it on every render; with `on` false it
// returns null and does nothing: no clock, no subscription, no read, no request
// (the mode-off goldens hold that).
//
// What it reads (no new store, no new price request — §3):
//   the battle document     the screen's own subscription, handed through
//                           sheetContext.battle (no second listener);
//   the calls               the screen's cockpit reader when it holds one
//                           (sheetContext.calls), else ONE listener of the same
//                           shape (useCalls), opened only while the sheet is on;
//   the chart's daily bars  the modal's own 1D series (the last one seen for this
//                           symbol is kept, so a 1W switch does not drop a fact);
//   the rankings            indexIntelligence/stockRankings — the doc in
//                           sheetContext.rankings when the screen holds one, else
//                           ONE read for the modal's life, only when the stalled
//                           question first opens (the doc is the platform's, the
//                           same for every stock; a read in flight is never thrown
//                           away by leaving the question).
// The Ask is the only request it makes: one POST /api/agent/chat, one message.
//
// THE ASK'S STATE is kept PER STOCK (sheetKey) and shown only under the
// question it answered: a late response for one stock never touches another's
// (review B6), an answer never shows under a different question (B5), one Ask
// is in flight per stock (a synchronous guard — a double tap sends one POST),
// and a question already asked (sending or answered) is not offered again for
// the same message until the player picks another question (D1).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCalls } from '../../../hooks/useCockpitRecords.js';
import { fetchWithAuth } from '../../../utils/fetchWithAuth.js';
import { BATTLE_CHAT_BUDGET } from '../../../../api/_utils/directiveFiling.js';
import { readToken } from '../../../theme/cssTokens.js';
import { etDate } from '../BombMode/checkClock.js';
import { priceDecimals } from '../priceFormat.js';
import { buildPacks, stanceOf, recordPinsOf, questionOrder, QUESTION_IDS, whenLabel } from './packs.js';
import { latestLineOf } from './latestLine.js';
import { SHEET_COPY, QUESTION_TEXT, PIN_LINE_WORDS } from './sheetCopy.js';

const TICK_MS = 30_000;
const NO_CALLS = Object.freeze([]);
/** Statuses chat.js returns BEFORE its one write (the exchange and the charge, one update): nothing was charged. */
export const NOT_CHARGED_STATUSES = Object.freeze([400, 401, 403, 404, 405, 429, 502, 504]);

/**
 * Was nothing charged? Only when chat.js ITSELF answered before its one write: a
 * not-charged status AND its JSON body with an `error` string (every such return
 * carries one). A platform 502/504 with no JSON body — a kill after the write —
 * is 'unknown' (review B7).
 */
export function chargedOf(status, body) {
  return status !== null && NOT_CHARGED_STATUSES.includes(status) && typeof body?.error === 'string' ? 'none' : 'unknown';
}

/** One read of the rankings doc (the Ranks tab's own read, CompeteTab.jsx). */
async function readRankings() {
  const [{ db }, fs] = await Promise.all([import('../../../firebase/config'), import('firebase/firestore')]);
  const snap = await fs.getDoc(fs.doc(db, 'indexIntelligence', 'stockRankings'));
  return snap.exists() ? snap.data() : null;
}

const sessionDay = (ms, crypto) => (crypto ? new Date(ms).toISOString().slice(0, 10) : etDate(ms));
const PIN_TOKEN = Object.freeze({ entry: 'ink-2', call: 'gold', answer: 'purple', check: 'teal', pin: 'amber' });
const LINE_TOKEN = Object.freeze({ entry: 'ink-2', idea_live: 'pos', idea_wrong: 'neg', pin: 'amber' });

/**
 * @param {object} p
 * @param {boolean} p.on            the sheet is on for this mount (sheetContext passed, mode on)
 * @param {object}  p.context       sheetContext
 * @param {string}  p.symbol        the displayed symbol
 * @param {boolean} p.isOriginal    the displayed symbol is the one the mount opened
 * @param {number}  p.live          the price the modal shows (BUILD_RULES §9: the stance and the items use it)
 * @param {Array}   p.rawData       the chart's raw series (newest-first) — daily on 1D
 * @param {string}  p.timeframe     the chart's timeframe
 * @param {boolean} p.isCrypto
 * @param {boolean} p.analysisActive the Analysis tab (the sheet) is the one showing
 */
export default function useSheetView({ on, context, symbol, isOriginal, live, rawData, timeframe, isCrypto = false, analysisActive = false }) {
  const ctx = on && context && typeof context === 'object' ? context : null;
  const battle = ctx?.battle ?? null;
  const battleId = typeof ctx?.battleId === 'string' ? ctx.battleId : null;
  const incumbent = isOriginal && typeof ctx?.incumbent === 'string' && ctx.incumbent ? ctx.incumbent : null;
  // The row's identity as primitives: the screen builds sheetContext anew on every render.
  const rowPosKey = isOriginal && typeof ctx?.row?.posKey === 'string' ? ctx.row.posKey : null;
  const rowPositionId = isOriginal && typeof ctx?.row?.positionId === 'string' ? ctx.row.positionId : null;
  const standing = ctx?.standing ?? null;
  const standingKey = standing ? `${standing.player}|${standing.opponent}|${standing.digits ?? ''}|${standing.you ?? ''}|${standing.them ?? ''}|${standing.lead ?? ''}` : '';
  const directive = ctx?.directive ?? null;

  const liveRef = useRef(true);
  useEffect(() => { liveRef.current = true; return () => { liveRef.current = false; }; }, []);

  // ── The clock (the banked item's next check; the pins' "today") ──
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!ctx) return undefined;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [!!ctx]); // eslint-disable-line react-hooks/exhaustive-deps -- the clock runs exactly while the sheet is on

  // ── The calls: the screen's reader when it holds one, else one of our own while on ──
  const screenCalls = Array.isArray(ctx?.calls) ? ctx.calls : null;
  const ownCalls = useCalls(battleId, !!ctx && screenCalls === null);
  const calls = screenCalls ?? (Array.isArray(ownCalls.value) ? ownCalls.value : NO_CALLS);

  // ── The chart's daily bars, kept per symbol across a 1W switch ──
  const dailyRef = useRef({ symbol: null, bars: null });
  if (ctx && timeframe === '1D' && Array.isArray(rawData) && rawData.length) dailyRef.current = { symbol, bars: rawData };
  const dailyBars = dailyRef.current.symbol === symbol ? dailyRef.current.bars : null;

  // ── The question, the item the player tapped, and the Ask ──
  const sheetKey = ctx ? `${battleId}|${symbol}|${incumbent ?? ''}` : null;
  const [ui, setUi] = useState({ key: null, question: null, activeItem: null });
  const [asks, setAsks] = useState({}); // sheetKey → { status, questionId, … }
  const inFlightRef = useRef(new Set()); // sheetKeys with a POST in flight (synchronous: a double tap sends one)
  if (ui.key !== sheetKey) {
    // A new opening (or a new symbol): BC-11's door opens on the stalled question.
    setUi({ key: sheetKey, question: incumbent ? 'better_than_stalled' : null, activeItem: null });
  }
  const question = ui.key === sheetKey ? ui.question : (incumbent ? 'better_than_stalled' : null);
  const activeItem = ui.key === sheetKey ? ui.activeItem : null;

  // ── The rankings: the doc the screen hands over when it holds one, else one read when the stalled question first opens ──
  const screenRankings = ctx?.rankings && typeof ctx.rankings === 'object' ? ctx.rankings : null;
  const [rankings, setRankings] = useState({ done: false, doc: null });
  const rankingsAsked = useRef(false);
  const wantRankings = !!ctx && !screenRankings && question === 'better_than_stalled';
  useEffect(() => {
    if (!wantRankings || rankingsAsked.current) return;
    rankingsAsked.current = true; // one read for the modal's life; leaving the question never discards it (review N2)
    readRankings()
      .then((doc) => { if (liveRef.current) setRankings({ done: true, doc }); })
      .catch(() => { if (liveRef.current) setRankings({ done: true, doc: null }); });
  }, [wantRankings]);

  // ── The model ──
  const model = useMemo(() => {
    if (!ctx || !battle || typeof symbol !== 'string' || !symbol) return null;
    const row = { posKey: rowPosKey, positionId: rowPositionId };
    const args = {
      battle, symbol, nowMs, row, live, dailyBars, battleId,
      rankings: screenRankings ?? rankings.doc,
      standing,
      directive,
      incumbent,
    };
    const built = buildPacks(args);
    const stance = stanceOf(args);
    const latest = latestLineOf({ battle, symbol, held: stance.holding.held, calls });
    const pins = recordPinsOf({ battle, symbol, nowMs, row, calls });
    return { ...built, stance, latest, pins, order: questionOrder(standing) };
    // standing reaches it through standingKey; ctx itself is new every render.
  }, [!!ctx, battle, symbol, nowMs, rowPosKey, rowPositionId, live, dailyBars, battleId, rankings, screenRankings, sheetKey, incumbent, calls, standingKey, directive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── The chart's pins (BC-8): one label open — the tapped item's pin, else the latest marker ──
  const pack = model && question ? model.packs[question] : null;
  const tapped = pack && Number.isInteger(activeItem) ? pack.items[activeItem] ?? null : null;
  const chart = useMemo(() => {
    if (!model) return null;
    const markers = model.pins.markers.map((m) => ({ ...m, day: sessionDay(m.atMs, isCrypto), token: PIN_TOKEN[m.kind] }));
    const lines = model.pins.lines.map((l) => ({ ...l, token: LINE_TOKEN[l.kind] }));
    let open = markers.length ? { type: 'marker', id: markers[markers.length - 1].id } : null;
    if (tapped?.pin?.type === 'time') {
      // The record marker AT that instant (the entry, the check, the call), never another on
      // the same day; none → a pin of the item's own, labelled with its time (review D5a).
      const ms = Date.parse(tapped.pin.value);
      const hit = markers.find((m) => m.atMs === ms);
      if (hit) open = { type: 'marker', id: hit.id };
      else { markers.push({ id: 'pin', kind: 'pin', atMs: ms, day: sessionDay(ms, isCrypto), token: PIN_TOKEN.pin, label: SHEET_COPY.pinAt(whenLabel(ms)) }); open = { type: 'marker', id: 'pin' }; }
    } else if (tapped?.pin?.type === 'price') {
      const hit = lines.find((l) => Math.abs(l.price - tapped.pin.value) < 1e-9);
      if (hit) open = { type: 'line', id: hit.id };
      else {
        // A line of the item's own, named for what the price IS — never the item's source label (review D5b).
        const p = tapped.pin.value;
        lines.push({ id: 'pin', kind: 'pin', price: p, label: SHEET_COPY.pinLine(PIN_LINE_WORDS[tapped.kind] ?? null, p, priceDecimals(p)), group: 'pin', token: LINE_TOKEN.pin });
        open = { type: 'line', id: 'pin' };
      }
    }
    const color = (token) => { try { return readToken(token) || undefined; } catch { return undefined; } };
    return {
      markers: markers.map((m) => ({ id: m.id, day: m.day, color: color(m.token), ...(open?.type === 'marker' && open.id === m.id ? { text: m.label } : {}) })),
      priceLines: lines.map((l) => ({ id: l.id, price: l.price, group: l.group, color: color(l.token), emphasis: open?.type === 'line' && open.id === l.id, title: open?.type === 'line' && open.id === l.id ? l.label : '' })),
      open,
    };
  }, [model, tapped, isCrypto]);

  // ── The budget (BC-7): the per-battle chat 10, from the battle's own counter ──
  const used = Number.isFinite(battle?.chatBudgetUsed) ? battle.chatBudgetUsed : 0;
  const left = Math.max(0, BATTLE_CHAT_BUDGET.limit - used);
  const own = sheetKey ? asks[sheetKey] ?? null : null;
  const answering = own?.status === 'sending';
  // This question already asked on this opening (its answer is below): not offered again (D1).
  const askedThis = !!own && own.questionId === question && (own.status === 'sending' || own.status === 'answered');
  const canAsk = !!model && !!question && left > 0 && battle?.status === 'active' && !answering && !askedThis && typeof ctx?.agentId === 'string' && !!battleId;

  const ask = useCallback(async () => {
    if (!canAsk || !pack || !sheetKey || inFlightRef.current.has(sheetKey)) return;
    const q = question;
    const key = sheetKey;
    inFlightRef.current.add(key);
    const settle = (state) => setAsks((all) => ({ ...all, [key]: state }));
    settle({ status: 'sending', questionId: q });
    let res = null;
    let body = null;
    try {
      res = await fetchWithAuth('/api/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          agentId: ctx.agentId,
          battleId,
          message: SHEET_COPY.askMessage(QUESTION_TEXT[q], symbol),
          researchAsk: { symbol, questionId: q, items: pack.items },
        }),
      });
      body = await res.json().catch(() => null);
    } catch {
      res = null;
    }
    inFlightRef.current.delete(key);
    if (!liveRef.current) return;
    if (res && res.ok && body && typeof body.agentMessage === 'string') {
      settle({
        status: 'answered', questionId: q,
        reply: body.agentMessage,
        exchangeId: typeof body.exchangeId === 'string' ? body.exchangeId : null,
        directive: body.hasDirective === true && typeof body.directive?.text === 'string' ? body.directive.text : null,
        atMs: Date.now(),
      });
      return;
    }
    const status = res ? res.status : null;
    const why = status === 403 && body?.error === 'chat_budget_exceeded' ? 'out'
      : ((status === 400 && (body?.error === 'battle_not_active' || body?.error === 'research_ask_battle_only')) || (status === 403 && body?.error === 'research_ask_off')) ? 'closed' : 'error';
    settle({ status: 'failed', questionId: q, charged: chargedOf(status, body), why });
  }, [canAsk, pack, question, sheetKey, ctx, battleId, symbol]);

  const pickQuestion = useCallback((q) => {
    if (!QUESTION_IDS.includes(q)) return;
    setUi({ key: sheetKey, question: q, activeItem: null });
  }, [sheetKey]);
  const backToQuestions = useCallback(() => setUi({ key: sheetKey, question: null, activeItem: null }), [sheetKey]);
  const tapItem = useCallback((i) => setUi((u) => ({ ...u, key: sheetKey, activeItem: u.activeItem === i ? null : i })), [sheetKey]);

  if (!ctx || !model) return null;
  // The reply shows only under the question it answered (review B5).
  const reply = own && own.questionId === question ? own : { status: 'idle' };
  const filed = reply.status === 'answered' && !!reply.exchangeId
    && (Array.isArray(battle?.chatExchanges) ? battle.chatExchanges : []).some((e) => e?.exchangeId === reply.exchangeId);
  return {
    symbol,
    archetype: model.lens.label,
    agentName: typeof ctx.agentName === 'string' && ctx.agentName ? ctx.agentName : null,
    stance: model.stance,
    latest: model.latest,
    latestWho: model.latest.atMs ? SHEET_COPY.voiceWho(model.lens.label, whenLabel(model.latest.atMs)) : null,
    latestTime: model.latest.atMs ? whenLabel(model.latest.atMs) : null,
    order: model.order,
    question,
    pack,
    activeItem,
    chart: analysisActive ? chart : null,
    // Which pins the chart draws on this timeframe (StockChart: dots on 1D only; lines on 1D and 1W; none on 💣) — D12.
    pinsShown: { time: timeframe === '1D', price: timeframe === '1D' || timeframe === '1W' },
    budget: { left, limit: BATTLE_CHAT_BUDGET.limit },
    canAsk,
    answering,
    askedThis,
    reply,
    filed,
    cockpit: typeof ctx.onOpenCockpit === 'function' ? ctx.onOpenCockpit : null,
    ask,
    pickQuestion,
    backToQuestions,
    tapItem,
  };
}
