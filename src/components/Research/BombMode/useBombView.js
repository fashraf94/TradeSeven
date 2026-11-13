// src/components/Research/BombMode/useBombView.js
//
// Research Modal Build A — the modal's Bomb mode state (spec §4.2–§4.4). Called
// by AssetResearchModal on every render; with `on` false it holds empty state,
// starts no timer and returns null, so the modal is today's modal.
//
// With `on`, it builds ONE view model the plot (Fuse / red zone / Danger Zone)
// and the sheet all draw from: the ladder (bombView.buildLadder), the distance
// to each side's next rung in displayed values (ladder.toGo / toGoDown), the
// lead side (ladder.stepLead, BD-2), the next-check clock (checkClock), the
// LIVE · SCORED chip (bombView.scoredChipText), both zone machines
// (redZone.stepZones: the red zone and, since BD-5, the Danger Zone) and the
// honest trace (bombView.traceParts: closed minute bars, then the quotes
// observed while the modal is open).
//
// A zone IS the hook's spectate view: entering either asks useResearchData for
// 'spectate' (the 1-minute series and its existing 15-second poll), leaving it
// for 'bomb' (the 30-minute series). No new request exists — the same two
// requests, triggered by the zone instead of the distance pill.

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildLadder, scoredChipText, sheetLine, traceParts, checkSlotOf } from './bombView.js';
import { toGo, toGoDown, stepLead } from './ladder.js';
import { checkClock, sessionOpenAt } from './checkClock.js';
import { stepZones, ZONES_INITIAL, isZoneMode } from './redZone.js';
import { priceDecimals } from '../priceFormat.js';

/** How long the banked moment holds the screen before the zone re-bases or leaves. */
export const BANKED_MOMENT_MS = 2400;
const OBSERVATIONS_CAP = 240;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** The zone side a lead is forced to (BD-2): the red zone leads up, the Danger Zone down. */
const zoneSide = (shown) => (shown === 'red' ? 'red' : shown === 'danger' ? 'danger' : null);

export default function useBombView({
  on = false, context = null, symbol = null, isOriginal = true, bombData = null, assetThreshold = null,
  fetchedThreshold = null, isCrypto = false, previousClose = null, live = null, timeframe = null, setTimeframe = null, bars = null,
  // BS-4: { status, pct, asOfMs } — handed by the modal ONLY for a non-held, non-crypto stock in a
  // battle scored by the measured ATR model (bombView.buildLadder's ATR arm); null everywhere else.
  atrReading = null,
} = {}) {
  const enabled = on === true && !!context && typeof symbol === 'string' && symbol.length > 0;
  const record = enabled && context.kind === 'agent' && isOriginal ? (context.record ?? null) : null;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [zones, setZones] = useState(ZONES_INITIAL);
  const [lead, setLead] = useState(null);
  const [momentDone, setMomentDone] = useState(null);
  const [bankedTimes, setBankedTimes] = useState({});
  const [hitTimes, setHitTimes] = useState({});
  const [observations, setObservations] = useState([]);
  const ghostRef = useRef({ symbol: null, bars: [] });

  // A new symbol starts clean: its own zones, its own lead, its own observations, its own banked and hit times.
  const [forSymbol, setForSymbol] = useState(symbol);
  if (forSymbol !== symbol) {
    setForSymbol(symbol);
    setZones(ZONES_INITIAL);
    setLead(null);
    setMomentDone(null);
    setBankedTimes({});
    setHitTimes({});
    setObservations([]);
  }
  // Review B1 (2026-11-11): another POSITION of the same symbol (sold and bought
  // again while the modal stays open) starts its own zone memory, lead and seen
  // times too — its banks and hits are its own checks. A null blip (one not-held
  // frame) is not a new position: the times the modal saw survive it. The quotes
  // observed (BA-6) are the symbol's, and stay.
  const positionNow = record?.positionId ?? null;
  const [forPosition, setForPosition] = useState(positionNow);
  if (positionNow !== null && forPosition !== positionNow) {
    setForPosition(positionNow);
    if (forPosition !== null) {
      setZones(ZONES_INITIAL);
      setLead(null);
      setMomentDone(null);
      setBankedTimes({});
      setHitTimes({});
    }
  }
  const rz = zones.red;

  const threshold = assetThreshold > 0 ? assetThreshold : fetchedThreshold > 0 ? fetchedThreshold : null;
  const atrStatus = atrReading ? atrReading.status ?? null : null;
  const atrPct = atrReading ? atrReading.pct ?? null : null;
  const atrAsOfMs = atrReading ? atrReading.asOfMs ?? null : null;
  const ladder = useMemo(() => (enabled
    ? buildLadder({ context, record, bombData, previousClose, threshold, symbol, nowMs, atrReading: atrStatus === null ? null : { status: atrStatus, pct: atrPct, asOfMs: atrAsOfMs } })
    : null), [enabled, context, record, bombData, previousClose, threshold, symbol, nowMs, atrStatus, atrPct, atrAsOfMs]);
  const decimals = finite(live) && live > 0 ? priceDecimals(live) : 2;
  const go = enabled && ladder ? toGo(ladder, live, { decimals }) : null;
  const goDown = enabled && ladder ? toGoDown(ladder, live, { decimals }) : null;
  const held = !!ladder && ladder.status === 'ok' && ladder.kind === 'held';
  // Review B2: a preview that becomes held (the agent buys the name the modal is
  // open on), or the reverse, is a new ladder: the lead takes a fresh first look.
  const [leadHeld, setLeadHeld] = useState(held);
  if (leadHeld !== held) {
    setLeadHeld(held);
    setLead(null);
  }
  const marketOpen = sessionOpenAt(nowMs);

  // The quotes observed while the modal is open (BA-6): one per change of the live price.
  useEffect(() => {
    if (!enabled || !(finite(live) && live > 0)) return;
    // A quote taken while the session is closed is the last trade restated, not a tick.
    if (isCrypto !== true && !sessionOpenAt(Date.now())) return;
    setObservations((list) => (list.length && list[list.length - 1].price === live ? list : [...list, { atMs: Date.now(), price: live }].slice(-OBSERVATIONS_CAP)));
  }, [enabled, live, isCrypto]);

  // The clock ticks every second in a zone on screen, every 15 s otherwise for a held name, never on a preview.
  const onBombView = timeframe === 'bomb' || timeframe === 'spectate';
  const period = !enabled || !held ? null : isZoneMode(zones.mode) && onBombView ? 1000 : 15000;
  useEffect(() => {
    if (period === null) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), period);
    return () => clearInterval(id);
  }, [period]);

  // One step of both zone machines, and of the lead, whenever an input changes.
  const bankedUp = held ? ladder.up.filter((r) => r.banked).map((r) => r.key) : [];
  const hitDown = held ? ladder.down.filter((r) => r.hit).map((r) => r.key) : [];
  const positionId = record?.positionId ?? null;
  const done = !!rz.moment && momentDone === `${positionId}:${rz.moment.key}`;
  const upBricks = go ? go.bricksExact : null;
  const downBricks = goDown ? goDown.bricksExact : null;
  const inputKey = JSON.stringify([enabled, held, isCrypto, marketOpen, positionId, bankedUp, hitDown,
    go ? [go.rung.key, go.pctShown] : null, goDown ? [goDown.rung.key, goDown.pctShown] : null, done, upBricks, downBricks]);
  useEffect(() => {
    if (!enabled) return;
    const next = stepZones(zones, {
      held, crypto: isCrypto === true, marketOpen, positionId, bankedUp, hitDown, momentDone: done,
      next: go ? { key: go.rung.key, pct: go.pctShown } : null,
      nextDown: goDown ? { key: goDown.rung.key, pct: goDown.pctShown } : null,
    });
    // BA-4: the check the record's latest score belongs to names a bank or a hit the modal SAW.
    const seenAtMs = () => checkSlotOf(record?.lastScoredAtMs, record?.battleExpiresAtMs)
      ?? checkSlotOf(record?.scored?.checkAtMs ?? record?.scored?.atMs) ?? null;
    if (next.red.moment && next.red.moment !== rz.moment) {
      const atMs = seenAtMs();
      setBankedTimes((t) => ({ ...t, ...Object.fromEntries(next.red.moment.keys.map((k) => [k, atMs])) }));
    }
    if (next.danger.freshHits.length) {
      const atMs = seenAtMs();
      setHitTimes((t) => ({ ...t, ...Object.fromEntries(next.danger.freshHits.map((k) => [k, atMs])) }));
    }
    if (JSON.stringify(next) !== JSON.stringify(zones) || next.red.moment !== rz.moment) setZones(next);
    const nextLead = stepLead(lead, { up: upBricks, down: downBricks, zone: zoneSide(next.shown) });
    if (nextLead !== lead) setLead(nextLead);
  }, [inputKey]); // eslint-disable-line react-hooks/exhaustive-deps -- every input is in inputKey; zones and lead are the committed state this render read

  // The banked moment's one beat, then the zone re-bases or leaves.
  const momentKey = rz.mode === 'banked' && rz.moment ? `${positionId}:${rz.moment.key}` : null; // the moment's highest tier names it
  useEffect(() => {
    if (!momentKey) return undefined;
    const id = setTimeout(() => setMomentDone(momentKey), BANKED_MOMENT_MS);
    return () => clearTimeout(id);
  }, [momentKey]);

  // The hook decides its 15-second poll when the spectate view OPENS (useResearchData
  // :475-479: never while the market is closed). A session that opens or closes
  // under an open zone re-opens the view, so the poll starts — or stops — with
  // it (one more read of each series, the same requests a tap would make).
  const openRef = useRef(marketOpen);
  useEffect(() => {
    const was = openRef.current;
    openRef.current = marketOpen;
    if (!enabled || was === marketOpen || timeframe !== 'spectate' || typeof setTimeframe !== 'function') return;
    setTimeframe('bomb');
  }, [enabled, marketOpen, timeframe, setTimeframe]);

  // The ghost is the 30-minute series; the trace is the 1-minute series — each
  // only from its own view (a stale view's bars are never relabelled).
  // Right after spectate → bomb the hook still holds the minute bars until the
  // 30-minute series arrives: the ghost keeps only bars spaced 30 minutes or more.
  const spacing = enabled && timeframe === 'bomb' && Array.isArray(bars) ? traceParts(bars, []).intervalMin : null;
  // (and at most an hour apart: the 1D chart's daily bars, still held while the
  // 30-minute series loads after 1D → 💣, are not 30-minute closes either — review B3).
  if (enabled && timeframe === 'bomb' && Array.isArray(bars) && (spacing === null || (spacing >= 30 && spacing <= 60))) ghostRef.current = { symbol, bars };
  const thirtySeen = enabled && ghostRef.current.symbol === symbol && ghostRef.current.bars.length > 0;

  // A zone is the hook's spectate view; the Fuse is its bomb view. The
  // switch waits for this symbol's 30-minute series: the hook's fallback for an
  // empty minute series is that series from its cache (useResearchData :335),
  // and a switch before it lands aborts the 30-minute request — a measured
  // position opened straight into a closed zone with no minute bars would
  // show "Chart data unavailable" (found on the way, 2026-11-07: review A8's row
  // re-run on a measured record).
  useEffect(() => {
    if (!enabled || typeof setTimeframe !== 'function' || (timeframe !== 'bomb' && timeframe !== 'spectate')) return;
    const want = isZoneMode(zones.mode) && (timeframe === 'spectate' || thirtySeen) ? 'spectate' : 'bomb';
    if (timeframe !== want) setTimeframe(want);
  }, [enabled, zones.mode, timeframe, setTimeframe, thirtySeen]);

  if (!enabled) return null;

  const ghost = ghostRef.current.symbol === symbol ? ghostRef.current.bars : [];
  const trace = traceParts(timeframe === 'spectate' ? bars : [], observations);
  const clock = held ? checkClock(nowMs, { battleExpiresAtMs: record?.battleExpiresAtMs, lastScoredAtMs: record?.lastScoredAtMs }) : null;
  const scored = held ? record?.scored ?? null : null;
  const mode = held ? zones.mode : 'fuse';
  const frozen = mode === 'closed' || mode === 'dangerClosed';
  const momentPoints = rz.moment && held ? ladder.up.filter((r) => rz.moment.keys.includes(r.key)).reduce((n, r) => n + r.points, 0) : 0;
  const moment = rz.moment && held ? { key: rz.moment.key, keys: rz.moment.keys, points: momentPoints, atMs: bankedTimes[rz.moment.key] ?? null, price: scored?.price ?? null } : null;
  // The lead the views draw: the committed one, or — before the first step has
  // committed — the first look's own answer, so no frame draws without a lead.
  const firstLead = lead ?? stepLead(null, { up: upBricks, down: downBricks, zone: held ? zoneSide(zones.shown) : null });
  // Review A8: a side with no next rung never leads — also for the one render before the
  // effect commits a lead the ladder has just made stale (the last rung on a side crossed).
  const shownLead = firstLead === 'up' && !go && goDown ? 'down' : firstLead === 'down' && !goDown && go ? 'up' : firstLead;
  return {
    ladder,
    go,
    goDown,
    lead: shownLead,
    live: finite(live) && live > 0 ? live : null,
    decimals,
    mode,
    nowMs,
    clock,
    ghost,
    trace,
    checkDots: held ? record?.checkDots ?? [] : [],
    bankedTimes,
    hitTimes,
    moment,
    details: held ? record?.details ?? null : null,
    redZoneScored: scoredChipText({ live, scored, decimals, always: true, frozen, nowMs }),
    sheetScored: scoredChipText({ live, scored, decimals, always: false, frozen: isCrypto !== true && !marketOpen, nowMs }),
    marketOpen: isCrypto === true || marketOpen,
    sheetLine: sheetLine({ ladder, clockLabel: clock && (clock.state === 'countdown' || clock.state === 'later') ? clock.label : null, checking: clock?.state === 'checking', bankedTimes, hitTimes, lead: shownLead, decimals, nowMs }),
  };
}
