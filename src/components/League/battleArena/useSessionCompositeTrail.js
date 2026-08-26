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
// ── SEED HELD OUTSIDE THE BUFFER ────────────────────────────────────────────
// The seed (each seat's last banked close) is a SEPARATE field, never buffer
// element zero. The rolling buffer drops oldest at capacity; a seed stored
// inside it would be the first thing evicted, and a long session would silently
// lose its anchor to the banked value. `seeds` is structurally un-evictable.

import React from 'react';

/** One sample per seat per minute — matches both upstream cadences. */
export const TRAIL_SAMPLE_MS = 60 * 1000;

/** Per-seat rolling cap: a full session at 60s with headroom (~8h). Drops oldest. */
export const TRAIL_CAPACITY = 480;

/** The empty trail — a seeded trail with no samples yet (the reload state). */
export function emptyTrail(seeds = {}) {
  return { seeds, samples: {}, ticks: 0 };
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
export function appendTrailSnapshot(prev, { ids, scoresAtLast, seatLive, t, capacity = TRAIL_CAPACITY }) {
  const isLive = (id) => seatLive?.[id] === true && Number.isFinite(scoresAtLast?.[id]);

  // A3.3 — a tick with no real reading anywhere appends NOTHING. This is the
  // off-gate (`null`) and failed-fetch (`{}`) case: the trail must not extend
  // past the newest real sample, and must never append a zero. Returning `prev`
  // by reference also means no re-render.
  if (!ids.some(isLive)) return prev;

  const samples = {};
  for (const id of ids) {
    const arr = prev.samples[id] || [];
    let v;
    if (isLive(id)) {
      v = scoresAtLast[id];
    } else {
      // Carry the last OBSERVED value forward (A3.2): the newest sample, else
      // the seed. Never scoresAtLast (the banked floor), never 0.
      const last = arr.length ? arr[arr.length - 1].v : prev.seeds[id];
      if (!Number.isFinite(last)) { samples[id] = arr; continue; } // nothing observed yet — append nothing rather than invent
      v = last;
    }
    // Roll at capacity: drop oldest, keep the window's tail. The SEED is not in
    // here and is therefore never evicted.
    const next = arr.length >= capacity ? arr.slice(arr.length - capacity + 1) : arr.slice();
    next.push({ t, v });
    samples[id] = next;
  }
  return { seeds: prev.seeds, samples, ticks: prev.ticks + 1 };
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
 * @returns {{ seeds: Object, samples: Object, ticks: number }}
 */
export function useSessionCompositeTrail({
  ids, scoresAtLast, seatLive, seatBanked,
  enabled, intervalMs = TRAIL_SAMPLE_MS, capacity = TRAIL_CAPACITY, nowFn,
}) {
  const [trail, setTrail] = React.useState(() => emptyTrail());

  // The timer must read the NEWEST upstream values without re-subscribing on
  // every render — a fresh interval per render would reset the shared clock and
  // resynchronise it to React, defeating the point.
  const latest = React.useRef({ ids, scoresAtLast, seatLive, capacity, nowFn });
  latest.current = { ids, scoresAtLast, seatLive, capacity, nowFn };

  // Seeds are adopted once per seat-set, OUTSIDE the rolling buffer. Keyed by the
  // seat ids so a genuine seat-set change (a new pod) re-seeds and clears, while
  // a fresh-but-equal object identity each render does not.
  const seedKey = (ids || []).join(',');
  React.useEffect(() => {
    setTrail(emptyTrail(seedKey ? { ...seatBanked } : {}));
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
        ids: cur.ids, scoresAtLast: cur.scoresAtLast, seatLive: cur.seatLive, t, capacity: cur.capacity,
      }));
    };
    const iv = setInterval(tick, intervalMs);
    return () => clearInterval(iv);
  }, [enabled, seedKey, intervalMs]);

  return trail;
}
