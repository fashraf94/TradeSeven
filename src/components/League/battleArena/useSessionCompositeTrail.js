// src/components/League/battleArena/useSessionCompositeTrail.js
//
// Phase 2 — THE SESSION COMPOSITE TRAIL. The in-memory intraday spine behind the
// fuse board's TODAY axis. Colocated with useLiveComposites, whose cadence it
// deliberately does NOT ride (see THE SHARED CLOCK below).
//
// Phase 0.5 established there is no per-seat intraday series anywhere on the
// platform: only five daily closes plus an on-demand live scalar. R3 rules that
// the TODAY axis is reconstructed CLIENT-SIDE, per session, at zero backend cost.
//
// ── NO PERSISTENCE (R3, hard) ───────────────────────────────────────────────
// No Firestore write, no localStorage, no sessionStorage, no cron, no new
// collection, no new endpoint, no new network call of any kind. This module
// holds React state and a timer. Nothing else. A trail dies with its tab, and
// that is the accepted trade — the ENDPOINTS are server-truth, the path between
// them is cosmetic (R3's named tradeoff).
//
// ── NO FABRICATION (R3, hard) ───────────────────────────────────────────────
// `flSeries()` is not ported, adapted, or reimplemented. Nothing is interpolated
// between observations. The trail connects real samples only, and never extends
// past the newest real one: a tick on which NO seat has a live reading appends
// NOTHING (see anyLive below), so the line stops where the data stopped even as
// the clock keeps moving.
//
// CARRY-FORWARD IS NOT FABRICATION (A3.2). Where a seat's upstream has not
// ticked, that seat repeats its last OBSERVED value. That states the last known
// truth; it does not invent an unobserved one. Crucially it is NOT the same as
// re-reading `scoresAtLast`, which FLOORS to the banked close when a reading is
// missing — appending that would draw a seat diving from its live number back to
// its close, reading as a catastrophic loss rather than a missing sample. That
// is why the model hands us `seatLive` alongside the altitudes.
//
// ── THE SHARED CLOCK (A3.2) ─────────────────────────────────────────────────
// Four lines share one x-axis, but their upstreams do not share a clock:
//   • rivals  → useLiveComposites, its own ~60s setInterval (rivals ONLY — your
//               seat is never routed through the endpoint, by design);
//   • you     → youLiveScore, recomputed when buildArenaModel re-memos on
//               useArenaPriceContext's SEPARATE ~60s poll.
// Two independent intervals, mounted at different moments, therefore permanently
// out of phase. Appending per-seat as each upstream ticked would place seats at
// different x for the same instant — incoherent on a shared-clock board.
//
// So this hook runs ONE timer and appends a FOUR-SEAT SNAPSHOT at a single `t`,
// reading whatever each upstream last delivered. A regular output cadence over
// ragged inputs is the correct trade (A3.2).
//
// ── THE HEAD IS NOT A SAMPLE (§9) ───────────────────────────────────────────
// A regular output cadence is right for the LINE. It is wrong for the NUMBER.
// The tip value, the crown and the cut are statements about NOW, and sourcing
// them from the newest 60s sample put them up to a full interval behind the
// DecompositionStrip, which renders the model's current composite — two
// independently-timed sources for one quantity, which is exactly what §9
// forbids. At a fresh mount it was worse: setInterval does not fire at t=0, so
// for the first minute there was no sample at all and your seat read its seed
// (0.0 in Today) while the strip already showed the live number.
//
// So the trail carries a HEAD alongside its samples: the CURRENT value of every
// seat, resolved at render time. The head is not appended, never enters the
// buffer, and is not history — it is the present, and it is recomputed whenever
// the model is.
//
// Crucially the head uses the SAME per-seat policy as an appended sample
// (`resolveSeatValue` below, the one function both call): a seat with a real
// reading shows it, a seat without carries its last OBSERVED value forward. So
// the head can never re-introduce the banked-floor flicker B2 prohibits — a
// rival's failed fetch carries forward here exactly as it does in the buffer —
// and a head exists only when SOME seat is live, mirroring the `anyLive` guard,
// so the board still never draws past the newest real observation.
//
// ── SEED HELD OUTSIDE THE BUFFER ────────────────────────────────────────────
// The seed (each seat's last banked close) is a SEPARATE field, never buffer
// element zero. The rolling buffer drops oldest at capacity; a seed stored
// inside it would be the first thing evicted, and a long session would silently
// lose its anchor to the banked value. `seeds` is structurally un-evictable.

import React from 'react';
import { etDayKey } from './fuseGeometry';

/** One sample per seat per minute — matches both upstream cadences. */
export const TRAIL_SAMPLE_MS = 60 * 1000;

/** Per-seat rolling cap: a full session at 60s with headroom (~8h). Drops oldest. */
export const TRAIL_CAPACITY = 480;

/** The empty trail — a seeded trail with no samples yet (the reload state). */
export function emptyTrail(seeds = {}, dayKey = null) {
  return { seeds, samples: {}, ticks: 0, dayKey };
}

/**
 * Is this seat reporting a REAL reading right now?
 * The head and the appended sample must agree on this or they are two sources.
 */
export const seatIsLive = (id, scoresAtLast, seatLive) =>
  seatLive?.[id] === true && Number.isFinite(scoresAtLast?.[id]);

/**
 * THE ONE PER-SEAT POLICY (§9). `appendTrailSnapshot` and `trailHead` both
 * resolve a seat through THIS — a live seat shows its reading, a seat without
 * one carries its last OBSERVED value forward (newest sample, else the seed).
 * NEVER `scoresAtLast` on a non-live seat: that is the banked floor, and it is
 * what would draw a dropped poll as a dive back to the close (B2's flicker).
 *
 * @returns {number|null} null = nothing has ever been observed for this seat
 */
export function resolveSeatValue(id, { scoresAtLast, seatLive, samples, seeds }) {
  if (seatIsLive(id, scoresAtLast, seatLive)) return scoresAtLast[id];
  const arr = samples?.[id];
  const last = arr && arr.length ? arr[arr.length - 1].v : seeds?.[id];
  return Number.isFinite(last) ? last : null;
}

/**
 * THE HEAD — every seat's value RIGHT NOW, for the numbers rather than the line
 * (see THE HEAD IS NOT A SAMPLE above). Pure; `t` is injected.
 *
 * Returns null when no seat is live, which is the SAME `anyLive` guard the
 * append path uses: with nothing live there is no present to state, so the board
 * falls back to its newest real sample and the line stops where the data did.
 *
 * @param {Object} trail - the accumulated trail ({ samples, seeds })
 * @param {Object} args  - { ids, scoresAtLast, seatLive, t }
 * @returns {{t:number, values:Object<string,number>}|null}
 */
export function trailHead(trail, { ids, scoresAtLast, seatLive, t }) {
  if (!(ids || []).some((id) => seatIsLive(id, scoresAtLast, seatLive))) return null;
  const values = {};
  for (const id of ids) {
    const v = resolveSeatValue(id, {
      scoresAtLast, seatLive, samples: trail?.samples, seeds: trail?.seeds,
    });
    if (v != null) values[id] = v;
  }
  return { t, values };
}

/**
 * Append ONE shared-clock snapshot across ALL seats. Pure — no clock, no React;
 * `t` is injected so the caller owns time (and tests own it exactly).
 *
 * Returns `prev` BY REFERENCE when the tick appends nothing, so a caller can use
 * identity to skip a state update.
 *
 * @param {Object} prev - { seeds, samples, ticks }
 * @param {Object} args
 * @param {string[]} args.ids          - seat ids (the four seats, stable order)
 * @param {Object<string,number>} args.scoresAtLast - per-seat altitude, ONE basis
 * @param {Object<string,boolean>} args.seatLive    - per-seat: real reading this tick?
 * @param {number} args.t              - the shared-clock timestamp for this snapshot
 * @param {number} [args.capacity]
 * @returns {Object} the next trail (or `prev` unchanged)
 */
export function appendTrailSnapshot(prev, { ids, scoresAtLast, seatLive, t, capacity = TRAIL_CAPACITY, seeds = null }) {
  const isLive = (id) => seatIsLive(id, scoresAtLast, seatLive);

  // ── THE ET DAY BOUNDARY ──────────────────────────────────────────────────
  // This is a TODAY trail, and a battle spans a week: nothing stops a tab
  // sitting open past the close. Without this, overnight ticks keep appending,
  // sessionFraction (date-blind) clamps them all to f=0/f=1, and the next
  // morning's line backtracks across the board from yesterday's readings — with
  // the seed still yesterday's close, so "since the open" renders a multi-day
  // delta. On a new ET day the samples are dropped and the seed re-adopted from
  // the freshly banked close.
  const day = etDayKey(t);
  const rolled = prev.dayKey != null && day != null && day !== prev.dayKey;
  const base = rolled
    ? { seeds: seeds ? { ...seeds } : prev.seeds, samples: {}, ticks: 0, dayKey: day }
    : prev;

  // A3.3 — a tick with no real reading anywhere appends NOTHING. This is the
  // off-gate (`null`) and failed-fetch (`{}`) case: the trail must not extend
  // past the newest real sample, and must never append a zero. Returning `prev`
  // by reference also means no re-render.
  if (!ids.some(isLive)) return rolled ? base : prev;

  const samples = {};
  for (const id of ids) {
    const arr = base.samples[id] || [];
    // ONE policy, shared with the head: live → the reading; otherwise carry the
    // last OBSERVED value forward (never the banked floor, never 0).
    const v = resolveSeatValue(id, {
      scoresAtLast, seatLive, samples: base.samples, seeds: base.seeds,
    });
    if (v == null) { samples[id] = arr; continue; } // nothing observed yet — append nothing rather than invent
    // Roll at capacity: drop oldest, keep the window's tail. The SEED is not in
    // here and is therefore never evicted.
    const next = arr.length >= capacity ? arr.slice(arr.length - capacity + 1) : arr.slice();
    next.push({ t, v });
    samples[id] = next;
  }
  return { seeds: base.seeds, samples, ticks: base.ticks + 1, dayKey: day ?? base.dayKey };
}

/**
 * The React wrapper: one timer, latest-inputs-by-ref, no persistence.
 *
 * Inputs come from buildArenaModel (`scoresAtLast` / `seatLive` / `seatBanked`),
 * so the trail samples the SAME resolver the crown, rank and cut read — it can
 * never drift onto a second ruler (§9).
 *
 * @param {Object} args
 * @param {string[]} args.ids
 * @param {Object<string,number>} args.scoresAtLast
 * @param {Object<string,boolean>} args.seatLive
 * @param {Object<string,number>} args.seatBanked - seeds (last banked close per seat)
 * @param {boolean} args.enabled - accumulate only while the round is live AND the fuse is on
 * @param {number} [args.intervalMs]
 * @param {number} [args.capacity]
 * @param {() => number} [args.nowFn] - injectable clock (tests)
 * @returns {{ seeds: Object, samples: Object, ticks: number, head: Object|null }}
 */
export function useSessionCompositeTrail({
  ids, scoresAtLast, seatLive, seatBanked,
  enabled, intervalMs = TRAIL_SAMPLE_MS, capacity = TRAIL_CAPACITY, nowFn,
}) {
  const [trail, setTrail] = React.useState(() => emptyTrail());

  // The timer must read the NEWEST upstream values without re-subscribing on
  // every render — a fresh interval per render would reset the shared clock and
  // resynchronise it to React, defeating the point.
  const latest = React.useRef({ ids, scoresAtLast, seatLive, seatBanked, capacity, nowFn });
  latest.current = { ids, scoresAtLast, seatLive, seatBanked, capacity, nowFn };

  // Seeds are adopted once per seat-set, OUTSIDE the rolling buffer. Keyed by the
  // seat ids so a genuine seat-set change (a new pod) re-seeds and clears, while
  // a fresh-but-equal object identity each render does not.
  const seedKey = (ids || []).join(',');
  React.useEffect(() => {
    setTrail(emptyTrail(seedKey ? { ...seatBanked } : {}, etDayKey((nowFn || Date.now)())));
    // seatBanked is intentionally read at seat-set change only: the seed is the
    // banked CLOSE, which does not move intraday. Re-seeding on every banked
    // object identity would reset the trail each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  React.useEffect(() => {
    if (!enabled || !seedKey) return undefined;
    const tick = () => {
      const cur = latest.current;
      const t = (cur.nowFn || Date.now)();
      setTrail((prev) => appendTrailSnapshot(prev, {
        ids: cur.ids, scoresAtLast: cur.scoresAtLast, seatLive: cur.seatLive, t,
        capacity: cur.capacity, seeds: cur.seatBanked,
      }));
    };
    const iv = setInterval(tick, intervalMs);
    return () => clearInterval(iv);
  }, [enabled, seedKey, intervalMs]);

  // THE HEAD — recomputed with the MODEL, not with the timer, so the numbers the
  // board prints are the numbers the model currently holds (§9). Memoized on the
  // model's own objects (`scoresAtLast` / `seatLive` are rebuilt per model) plus
  // the trail, so a render that changes neither is free. Null while disabled:
  // with the fuse dark nothing accumulates AND nothing is resolved.
  const head = React.useMemo(
    () => (enabled
      ? trailHead(trail, { ids, scoresAtLast, seatLive, t: (nowFn || Date.now)() })
      : null),
    [enabled, trail, ids, scoresAtLast, seatLive, nowFn],
  );

  return React.useMemo(() => (head ? { ...trail, head } : trail), [trail, head]);
}
