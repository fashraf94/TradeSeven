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
//                           ONE read for the modal's life, only when a question
//                           that reads it first opens (the doc is the platform's, the
//                           same for every stock; a read in flight is never thrown
//                           away by leaving the question).
// The Ask is the only request it makes: one POST /api/agent/chat, one message.
//
// THE QUESTION SET (QF-1, Nov 13, 2026) is packs.questionSetOf's, decided once per
// opening (sheetKey) from the record at open and kept for that opening: a tick, a
// check landing or the price crossing entry never switches it (the FQ-9 rule).
// QF-8: the agent's name goes through the cockpit's agentNameOf (Shadow, never shadow).
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
import { buildPacks, stanceOf, recordPinsOf, questionSetOf, whenLabel, itemKeyOf } from './packs.js';
import { agentNameOf } from '../../../screens/battleView/agentName.js';
import { latestLineOf } from './latestLine.js';
import { SHEET_COPY, SHELL_COPY, QUESTION_TEXT, PIN_LINE_WORDS } from './sheetCopy.js';
import { battleSpecOf, dayMarkersOf, rungLinesOf, weekdayOfDay } from './battleChart.js';

const TICK_MS = 30_000;
const NO_CALLS = Object.freeze([]);
/** The questions whose packs read the rankings doc (the stalled compare's scores; QF-3 / QF-4's bench alternative). */
export const RANKINGS_QUESTIONS = Object.freeze(['better_than_stalled', 'weakest_spot', 'take_profit']);
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
const LINE_TOKEN = Object.freeze({ entry: 'ink-2', idea_live: 'pos', idea_wrong: 'neg', pin: 'amber', rung_up: 'gold', rung_down: 'neg' });

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
  // `activeItem` holds the open item's KEY (packs.itemKeyOf), never its slot (BS-2).
  const [ui, setUi] = useState({ key: null, question: null, activeItem: null });
  const [asks, setAsks] = useState({}); // sheetKey → { status, questionId, … }
  const inFlightRef = useRef(new Set()); // sheetKeys with a POST in flight (synchronous: a double tap sends one)
  if (ui.key !== sheetKey) {
    // A new opening (or a new symbol): BC-11's door opens on the stalled question.
    setUi({ key: sheetKey, question: incumbent ? 'better_than_stalled' : null, activeItem: null });
  }
  const question = ui.key === sheetKey ? ui.question : (incumbent ? 'better_than_stalled' : null);
  const activeKey = ui.key === sheetKey ? ui.activeItem : null;

  // ── The rankings: the doc the screen hands over when it holds one, else one read when a question whose pack
  // reads it (RANKINGS_QUESTIONS: the stalled compare; QF-3 / QF-4's bench alternative) first opens ──
  const screenRankings = ctx?.rankings && typeof ctx.rankings === 'object' ? ctx.rankings : null;
  const [rankings, setRankings] = useState({ done: false, doc: null });
  const rankingsAsked = useRef(false);

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
    return { ...built, stance, latest, pins, args };
    // standing reaches it through standingKey; ctx itself is new every render.
  }, [!!ctx, battle, symbol, nowMs, rowPosKey, rowPositionId, live, dailyBars, battleId, rankings, screenRankings, sheetKey, incumbent, calls, standingKey, directive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── QF-1: the question set, decided ONCE per opening (sheetKey) from the record at open, then kept —
  // a tick, a check landing or a lead change never switches it while the modal is open (the FQ-9 rule).
  // One entry PER sheetKey (review B1): navigating away inside the modal and back finds the set decided
  // at that row's first opening, never a re-decision from the record of the moment.
  const [frozen, setFrozen] = useState({});
  const kept = sheetKey ? frozen[sheetKey] ?? null : null;
  const set = kept ?? (model ? questionSetOf(model.args) : null);
  if (model && set && sheetKey && !kept) setFrozen((all) => (all[sheetKey] ? all : { ...all, [sheetKey]: set }));
  // A question the set does not hold is never shown (a stale pick across an opening).
  const shownQuestion = question && set?.questions.includes(question) ? question : null;

  // The rankings read: when a question that reads it is SHOWN (review B3 — never for a pre-set question
  // the row's set does not hold).
  const wantRankings = !!ctx && !screenRankings && RANKINGS_QUESTIONS.includes(shownQuestion);
  useEffect(() => {
    if (!wantRankings || rankingsAsked.current) return;
    rankingsAsked.current = true; // one read for the modal's life; leaving the question never discards it (review N2)
    readRankings()
      .then((doc) => { if (liveRef.current) setRankings({ done: true, doc }); })
      .catch(() => { if (liveRef.current) setRankings({ done: true, doc: null }); });
  }, [wantRankings]);

  // ── The chart's pins (BC-8): one label open — the tapped item's pin, else the latest marker ──
  const pack = model && shownQuestion ? model.packs[shownQuestion] : null;
  // BS-2 (shell report §12 A8): the open item is found by its key in TODAY's pack. One that has left
  // the pack (a tick reshuffled it out) closes — the caption never moves to the item now in its slot —
  // and it stays closed if it comes back: reopening it is a new tap.
  const activeIndex = pack && typeof activeKey === 'string' ? pack.items.findIndex((it) => itemKeyOf(it) === activeKey) : -1;
  if (pack && typeof activeKey === 'string' && activeIndex < 0) setUi((u) => (u.key === sheetKey && u.activeItem === activeKey ? { ...u, activeItem: null } : u));
  const activeItem = activeIndex >= 0 ? activeIndex : null;
  const tapped = activeIndex >= 0 ? pack.items[activeIndex] : null;
  // ── BC2-1 / BC2-2: the Battle pill's spec — the battle's sessions up to today and the bar size ──
  const onBattle = timeframe === 'battle';
  const battleSpec = useMemo(() => (ctx && battle ? battleSpecOf(battle, nowMs) : null), [!!ctx, battle, nowMs ? Math.floor(nowMs / 3_600_000) : 0]); // eslint-disable-line react-hooks/exhaustive-deps -- the sessions move by the day
  // BC2-3's day merge (and its chips) come with the Battle pill: the stock the battle opened, a battle naming its sessions.
  const dayMerge = !!battleSpec && isOriginal && !isCrypto;
  const chart = useMemo(() => {
    if (!model) return null;
    const markers = model.pins.markers.map((m) => ({ ...m, day: sessionDay(m.atMs, isCrypto), token: PIN_TOKEN[m.kind] }));
    // BC2-5: Battle draws the next rung each way (a held measured stock's ladder only).
    const rungs = onBattle ? rungLinesOf(model.holding?.ladder ?? null, live) : [];
    const lines = [...model.pins.lines, ...rungs].map((l) => ({ ...l, token: LINE_TOKEN[l.kind] }));
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
    const isOpen = (m) => open?.type === 'marker' && open.id === m.id;
    // BC2-3: on Battle every marker by its INSTANT (StockChart puts it on the bar holding it); on 1D and
    // 1W a day's markers merge into one, with its count — the open marker's day carries the caption.
    const byDay = dayMarkersOf(markers);
    const openDay = markers.find(isOpen)?.day ?? null;
    const dayMarkers = byDay.map((g) => {
      const latest = markers.find((m) => m.id === g.latestId);
      // A tapped item's pin captions ITS marker (review D5a, never another on that day); otherwise the day's count.
      const text = g.day === openDay ? (g.count > 1 && tapped?.pin?.type !== 'time' ? SHELL_COPY.dayCount(weekdayOfDay(g.day) ?? g.day, g.count) : markers.find(isOpen).label) : null;
      return { id: `day:${g.day}`, day: g.day, color: color(latest?.token), ...(text ? { text } : {}) };
    });
    return {
      // With no Battle pill (a battle that names no sessions) 1D keeps Build C's one dot per record item.
      markers: onBattle || !dayMerge
        ? markers.map((m) => ({ id: m.id, day: m.day, ...(onBattle ? { atMs: m.atMs } : {}), color: color(m.token), ...(isOpen(m) ? { text: m.label } : {}) }))
        : dayMarkers,
      // The chips under the 1D / 1W chart: a day's count, a tap opens Battle (BC2-3).
      days: byDay.map((g) => ({ day: g.day, count: g.count, label: SHELL_COPY.dayChip(g.count, weekdayOfDay(g.day) ?? g.day) })),
      priceLines: lines.map((l) => ({
        id: l.id, price: l.price, group: l.group, color: color(l.token), emphasis: open?.type === 'line' && open.id === l.id,
        // The rung lines always name their rung (the line is the point of BC2-5); the others only when open (D8).
        title: open?.type === 'line' && open.id === l.id ? l.label : l.group === 'rung' ? l.label : '',
      })),
      open,
    };
  }, [model, tapped, isCrypto, onBattle, live, dayMerge]);

  // ── The budget (BC-7): the per-battle chat 10, from the battle's own counter ──
  const used = Number.isFinite(battle?.chatBudgetUsed) ? battle.chatBudgetUsed : 0;
  const left = Math.max(0, BATTLE_CHAT_BUDGET.limit - used);
  const own = sheetKey ? asks[sheetKey] ?? null : null;
  const answering = own?.status === 'sending';
  // This question already asked on this opening (its answer is below): not offered again (D1).
  const askedThis = !!own && own.questionId === shownQuestion && (own.status === 'sending' || own.status === 'answered');
  const canAsk = !!model && !!shownQuestion && left > 0 && battle?.status === 'active' && !answering && !askedThis && typeof ctx?.agentId === 'string' && !!battleId;

  const ask = useCallback(async () => {
    if (!canAsk || !pack || !sheetKey || inFlightRef.current.has(sheetKey)) return;
    const q = shownQuestion;
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
  }, [canAsk, pack, shownQuestion, sheetKey, ctx, battleId, symbol]);

  const setQuestions = set?.questions ?? null;
  const pickQuestion = useCallback((q) => {
    if (!Array.isArray(setQuestions) || !setQuestions.includes(q)) return;
    setUi({ key: sheetKey, question: q, activeItem: null });
  }, [sheetKey, setQuestions]);
  const backToQuestions = useCallback(() => setUi({ key: sheetKey, question: null, activeItem: null }), [sheetKey]);
  // A tap on slot i opens (or closes) the item IN that slot now, held by its key.
  const tapItem = useCallback((i) => {
    const it = pack && Number.isInteger(i) ? pack.items[i] : null;
    if (!it) return;
    const k = itemKeyOf(it);
    setUi((u) => ({ ...u, key: sheetKey, activeItem: u.activeItem === k ? null : k }));
  }, [sheetKey, pack]);

  if (!ctx || !model || !set) return null;
  // The reply shows only under the question it answered (review B5).
  const reply = own && own.questionId === shownQuestion ? own : { status: 'idle' };
  const filed = reply.status === 'answered' && !!reply.exchangeId
    && (Array.isArray(battle?.chatExchanges) ? battle.chatExchanges : []).some((e) => e?.exchangeId === reply.exchangeId);
  return {
    symbol,
    archetype: model.lens.label,
    // QF-8: the cockpit's rule (cockpit2bModel.agentNameOf) — *Shadow*, never *shadow*. No name → null,
    // and the sheet names the archetype (R-23), never agentNameOf's "Your Agent".
    agentName: typeof ctx.agentName === 'string' && ctx.agentName.trim() ? agentNameOf(ctx.agentName) : null,
    stance: model.stance,
    latest: model.latest,
    latestWho: model.latest.atMs ? SHEET_COPY.voiceWho(model.lens.label, whenLabel(model.latest.atMs)) : null,
    latestTime: model.latest.atMs ? whenLabel(model.latest.atMs) : null,
    order: set.questions,
    notOnLadder: set.notOnLadder,
    // QF-1, ruling 2: no committed context at open — the time the book is ranked, decided with the set.
    bookPending: set.bookPending ?? null,
    question: shownQuestion,
    pack,
    activeItem,
    chart: analysisActive ? chart : null,
    // Which pins the chart draws on this timeframe (StockChart: dots and lines on 1D, 1W and Battle; none on 💣) — D12, BC2-3.
    pinsShown: { time: timeframe === '1D' || onBattle || (timeframe === '1W' && dayMerge), price: timeframe === '1D' || timeframe === '1W' || onBattle },
    // BC2-1: the Battle pill — on the stock the battle opened only (a name reached by navigation inside the
    // modal has no record on the battle's sessions — PR 2 review B3); null: no pill.
    battle: isOriginal && !isCrypto ? battleSpec : null,
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
