// src/components/Research/BombMode/useBombView.js
//
// Research Modal Build A — the modal's Bomb mode state (spec §4.2–§4.4). Called
// by AssetResearchModal on every render; with `on` false it holds empty state,
// starts no timer and returns null, so the modal is today's modal.
//
// With `on`, it builds ONE view model the plot (Fuse / red zone) and the sheet
// both draw from: the ladder (bombView.buildLadder), the distance to the next
// rung in displayed values (ladder.toGo), the next-check clock (checkClock),
// the LIVE · SCORED chip (bombView.scoredChipText), the red-zone machine
// (redZone.stepRedZone) and the honest trace (bombView.traceParts: closed
// minute bars, then the quotes observed while the modal is open).
//
// The red zone IS the hook's spectate view: entering it asks useResearchData
// for 'spectate' (the 1-minute series and its existing 15-second poll),
// leaving it for 'bomb' (the 30-minute series). No new request exists — the
// same two requests, triggered by the zone instead of the distance pill.

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildLadder, scoredChipText, sheetLine, traceParts, checkSlotOf } from './bombView.js';
import { toGo } from './ladder.js';
import { checkClock, sessionOpenAt } from './checkClock.js';
import { stepRedZone, RED_ZONE_INITIAL, isRedZoneMode } from './redZone.js';
import { priceDecimals } from '../priceFormat.js';

/** How long the banked moment holds the screen before the zone re-bases or leaves. */
export const BANKED_MOMENT_MS = 2400;
const OBSERVATIONS_CAP = 240;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

export default function useBombView({
  on = false, context = null, symbol = null, isOriginal = true, bombData = null, assetThreshold = null,
  fetchedThreshold = null, isCrypto = false, previousClose = null, live = null, timeframe = null, setTimeframe = null, bars = null,
} = {}) {
  const enabled = on === true && !!context && typeof symbol === 'string' && symbol.length > 0;
  const record = enabled && context.kind === 'agent' && isOriginal ? (context.record ?? null) : null;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [rz, setRz] = useState(RED_ZONE_INITIAL);
  const [momentDone, setMomentDone] = useState(null);
  const [bankedTimes, setBankedTimes] = useState({});
  const [observations, setObservations] = useState([]);
  const ghostRef = useRef({ symbol: null, bars: [] });

  // A new symbol starts clean: its own zone, its own observations, its own banked times.
  const [forSymbol, setForSymbol] = useState(symbol);
  if (forSymbol !== symbol) {
    setForSymbol(symbol);
    setRz(RED_ZONE_INITIAL);
    setMomentDone(null);
    setBankedTimes({});
    setObservations([]);
  }

  const threshold = assetThreshold > 0 ? assetThreshold : fetchedThreshold > 0 ? fetchedThreshold : null;
  const ladder = useMemo(() => (enabled
    ? buildLadder({ context, record, bombData, previousClose, threshold, symbol, nowMs })
    : null), [enabled, context, record, bombData, previousClose, threshold, symbol, nowMs]);
  const decimals = finite(live) && live > 0 ? priceDecimals(live) : 2;
  const go = enabled && ladder ? toGo(ladder, live, { decimals }) : null;
  const held = !!ladder && ladder.status === 'ok' && ladder.kind === 'held';
  const marketOpen = sessionOpenAt(nowMs);

  // The quotes observed while the modal is open (BA-6): one per change of the live price.
  useEffect(() => {
    if (!enabled || !(finite(live) && live > 0)) return;
    // A quote taken while the session is closed is the last trade restated, not a tick.
    if (isCrypto !== true && !sessionOpenAt(Date.now())) return;
    setObservations((list) => (list.length && list[list.length - 1].price === live ? list : [...list, { atMs: Date.now(), price: live }].slice(-OBSERVATIONS_CAP)));
  }, [enabled, live, isCrypto]);

  // The clock ticks every second in the red zone, every 15 s on a held Fuse, never on a preview.
  const period = !enabled || !held ? null : isRedZoneMode(rz.mode) ? 1000 : 15000;
  useEffect(() => {
    if (period === null) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), period);
    return () => clearInterval(id);
  }, [period]);

  // One step of the red-zone machine whenever an input changes.
  const bankedUp = held ? ladder.up.filter((r) => r.banked).map((r) => r.key) : [];
  const positionId = record?.positionId ?? null;
  const done = !!rz.moment && momentDone === `${positionId}:${rz.moment.key}`;
  const inputKey = JSON.stringify([enabled, held, isCrypto, marketOpen, positionId, bankedUp, go ? [go.rung.key, go.pctShown] : null, done]);
  useEffect(() => {
    if (!enabled) return;
    const next = stepRedZone(rz, {
      held, crypto: isCrypto === true, marketOpen, positionId, bankedUp, next: go ? { key: go.rung.key, pct: go.pctShown } : null, momentDone: done,
    });
    if (next.moment && next.moment !== rz.moment) {
      // BA-4: the modal SAW this rung bank — the check is the one the record's latest score belongs to.
      const atMs = checkSlotOf(record?.lastScoredAtMs, record?.battleExpiresAtMs) ?? record?.scored?.atMs ?? null;
      setBankedTimes((t) => ({ ...t, [next.moment.key]: atMs }));
    }
    const same = next.mode === rz.mode && next.rungKey === rz.rungKey && next.moment === rz.moment
      && JSON.stringify(next.seenBanked) === JSON.stringify(rz.seenBanked) && next.played.length === rz.played.length;
    if (!same) setRz(next);
  }, [inputKey]); // eslint-disable-line react-hooks/exhaustive-deps -- every input is in inputKey; rz is the committed state this render read

  // The banked moment's one beat, then the zone re-bases or leaves.
  const momentKey = rz.mode === 'banked' && rz.moment ? `${positionId}:${rz.moment.key}` : null;
  useEffect(() => {
    if (!momentKey) return undefined;
    const id = setTimeout(() => setMomentDone(momentKey), BANKED_MOMENT_MS);
    return () => clearTimeout(id);
  }, [momentKey]);

  // The red zone is the hook's spectate view; the Fuse is its bomb view.
  useEffect(() => {
    if (!enabled || typeof setTimeframe !== 'function' || (timeframe !== 'bomb' && timeframe !== 'spectate')) return;
    const want = isRedZoneMode(rz.mode) ? 'spectate' : 'bomb';
    if (timeframe !== want) setTimeframe(want);
  }, [enabled, rz.mode, timeframe, setTimeframe]);

  if (!enabled) return null;

  // The ghost is the 30-minute series; the trace is the 1-minute series — each
  // only from its own view (a stale view's bars are never relabelled).
  if (timeframe === 'bomb' && Array.isArray(bars)) ghostRef.current = { symbol, bars };
  const ghost = ghostRef.current.symbol === symbol ? ghostRef.current.bars : [];
  const trace = traceParts(timeframe === 'spectate' ? bars : [], observations);
  const clock = held ? checkClock(nowMs, { battleExpiresAtMs: record?.battleExpiresAtMs, lastScoredAtMs: record?.lastScoredAtMs }) : null;
  const scored = held ? record?.scored ?? null : null;
  const frozen = rz.mode === 'closed';
  const moment = rz.moment && held ? { key: rz.moment.key, atMs: bankedTimes[rz.moment.key] ?? null, price: scored?.price ?? null } : null;
  return {
    ladder,
    go,
    live: finite(live) && live > 0 ? live : null,
    decimals,
    mode: held ? rz.mode : 'fuse',
    nowMs,
    clock,
    ghost,
    trace,
    checkDots: held ? record?.checkDots ?? [] : [],
    bankedTimes,
    moment,
    redZoneScored: scoredChipText({ live, scored, decimals, always: true, frozen, nowMs }),
    sheetScored: scoredChipText({ live, scored, decimals, always: false, frozen: isCrypto !== true && !marketOpen, nowMs }),
    marketOpen: isCrypto === true || marketOpen,
    sheetLine: sheetLine({ ladder, clockLabel: clock && (clock.state === 'countdown' || clock.state === 'later') ? clock.label : null, checking: clock?.state === 'checking', bankedTimes, decimals }),
  };
}
