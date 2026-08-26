// src/components/League/battleArena/fuseGeometry.js
//
// Phase 3 — THE FUSE BOARD'S PURE CORE. Every number FuseHero draws is computed
// here: the fluid frame, the y-scale with its labelled basement, the label
// thinning and de-collision, the Catmull-Rom path, the ET session clock, and
// the B2 cut derivation. Node-clean, no React, no Date.now — time is always an
// argument, so every function is testable to the pixel.
//
// Authority: LEAGUE_BATTLEVIEW_ADJUDICATION_V1 (R8/R11/R13) + Branch A spec
// Phase 3 + Amendment B §B2. Where this file deviates from the prototype's
// formulas it says so inline, with the reason.

import { rankByScores } from '../../../constants/leagueTournament';

// ── the fluid frame (R13 — ratios and minimums, never a fixed stage) ────────

/** Geometry tokens per the Phase 3 table. TIPROOM is load-bearing: the reserved
 *  right gutter that keeps the tip head + value inside the hero at every width. */
export const FH = Object.freeze({
  desktop: Object.freeze({ padL: 56, padR: 24, padT: 42, padB: 34, LABEL_ROOM: 28, TIPROOM: 156, headGap: 42, yLabelGap: 14 }),
  compact: Object.freeze({ padL: 40, padR: 16, padT: 34, padB: 26, LABEL_ROOM: 22, TIPROOM: 96, headGap: 30, yLabelGap: 12 }),
});

export function fuseFrame({ w, h, compact = false }) {
  const g = compact ? FH.compact : FH.desktop;
  const plotT = g.padT;
  const plotB = h - g.padB;
  const floorY = plotB - g.LABEL_ROOM;
  // plotR = max(padL + 40, w − padR − TIPROOM) — the spec's exact clamp.
  const plotR = Math.max(g.padL + 40, w - g.padR - g.TIPROOM);
  return { ...g, plotT, plotB, floorY, plotR, spanY: floorY - plotT };
}

// ── the y-scale + basement compression (spec §Scales, week scope only) ──────

/**
 * Build the vertical scale over EVERY value the board will draw.
 *
 * DELIBERATE DEVIATION from the prototype (flagged per spec §0.4): the
 * prototype scales off the four TIP values only. Real series pass through
 * intermediate points that can exceed the current tips (a seat that peaked
 * Wednesday and gave it back), and a drawn point outside the plot is a clipped
 * lie. So `values` here is every rendered value — tips AND path points.
 *
 * Basement (week scope only): a genuine outlier compresses; a trivial loss
 * scales linearly through zero. The compression is ALWAYS labelled by the
 * caller (`basement > 0` ⇒ the BASEMENT · COMPRESSED tag) — an unlabelled
 * non-linear axis is a lie.
 */
export function makeScale({ values, day, plotT, floorY }) {
  const finite = (values || []).filter(Number.isFinite);
  const HI = Math.max(...finite, 0.1);
  const LO = Math.min(0, ...finite);
  const outlier = !day && LO < 0 && Math.abs(LO) > 0.3 * HI;
  const BASEMENT = outlier ? 0.2 : 0;
  const linear = day || !outlier;
  const spanY = floorY - plotT;
  const zeroY = linear
    ? floorY - ((0 - LO) / Math.max(0.1, HI - LO)) * spanY
    : floorY - BASEMENT * spanY;
  const Y = linear
    ? (p) => floorY - ((p - LO) / Math.max(0.1, HI - LO)) * spanY
    : (p) => (p >= 0 ? zeroY - (p / HI) * (zeroY - plotT) : zeroY + (p / LO) * (floorY - zeroY));
  return { HI, LO, basement: BASEMENT, linear, zeroY, Y };
}

// ── the smoothed fuse path (flPath is the sanctioned reference) ─────────────

/** Catmull-Rom → cubic Bézier through every point. Endpoints exact. */
export function catmullPath(pts) {
  if (!pts || pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)},${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}`
      + ` ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)},${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}`
      + ` ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

// ── label de-collision (flSpread is required behavior, ported) ──────────────

/** Push label ANCHORS apart at a minimum gap without moving the fuses. Returns
 *  {id: y}. Four seats will collide regularly; the caller draws the elbow
 *  connector whenever a head is displaced from its tip. */
export function spreadLabels(items, minGap, top, bottom) {
  if (!items || items.length === 0) return {};
  const out = [...items].sort((a, b) => a.y - b.y).map((it) => ({ ...it }));
  for (let i = 1; i < out.length; i++) {
    if (out[i].y - out[i - 1].y < minGap) out[i].y = out[i - 1].y + minGap;
  }
  const over = out[out.length - 1].y - bottom;
  if (over > 0) out.forEach((it) => { it.y -= over; });
  if (out[0].y < top) {
    const d = top - out[0].y;
    out.forEach((it) => { it.y += d; });
  }
  return Object.fromEntries(out.map((o) => [o.id, o.y]));
}

// ── y-label thinning (spec §Y labels — greedy, by priority) ─────────────────

/**
 * Greedy thinning in PRIORITY order — top, cut, zero/open, floor. `cands` MUST
 * arrive in that order; a candidate landing within `minGap` px of one already
 * kept is dropped. Holds at any data range (tested at 44.5, −575, 44,000).
 * @param {Array<{v:number,t:string,y:number}>} cands - priority-ordered, y precomputed
 */
export function thinYLabels(cands, minGap) {
  const kept = [];
  for (const g of cands || []) {
    if (!Number.isFinite(g.y)) continue;
    if (!kept.some((k) => Math.abs(k.y - g.y) < minGap)) kept.push(g);
  }
  return kept;
}

// ── the ET session clock (x IS the clock — real fractions, never even slots) ─

export const SESSION_OPEN_MIN = 9 * 60 + 30;  // 9:30 ET
export const SESSION_CLOSE_MIN = 16 * 60;     // 16:00 ET
export const SESSION_LEN_MIN = SESSION_CLOSE_MIN - SESSION_OPEN_MIN; // 390

/** Minute-of-day in America/New_York for an epoch ms — Intl, never a
 *  hand-rolled offset (BUILD_RULES §6 idiom). */
export function etMinuteOfDay(tMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(tMs));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/** The ET calendar day for an epoch ms — the trail's session identity. */
export function etDayKey(tMs) {
  if (!Number.isFinite(tMs)) return null;
  return new Date(tMs).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/** Fraction of the regular session elapsed at t, clamped to [0, 1]. (Early-close
 *  days render their shortened afternoon pinned at CLOSE — noted, accepted.) */
export function sessionFraction(tMs) {
  if (!Number.isFinite(tMs)) return 0;
  return Math.max(0, Math.min(1, (etMinuteOfDay(tMs) - SESSION_OPEN_MIN) / SESSION_LEN_MIN));
}

/** Day-scope x labels at their TRUE clock fractions (11:00 is 90 of 390 minutes
 *  in — the prototype's even slots would misplace them on a real clock axis). */
export const DAY_XLABELS = Object.freeze([
  Object.freeze({ t: 'OPEN', f: 0 }),
  Object.freeze({ t: '11:00', f: 90 / SESSION_LEN_MIN }),
  Object.freeze({ t: '12:30', f: 180 / SESSION_LEN_MIN }),
  Object.freeze({ t: '14:00', f: 270 / SESSION_LEN_MIN }),
  Object.freeze({ t: 'CLOSE', f: 1 }),
]);
/** Week-scope labels at their DAY-BAND starts: the week axis is five equal
 *  session bands, day d spanning [d/5, (d+1)/5] — day d's close lands at
 *  (d+1)/5 and the live tip burns at (d + sessionFraction)/5.
 *  DELIBERATE DEVIATION from the prototype's i/4 labels: its own week clock
 *  places closes at start-of-next-day slots and then CLAMPS Friday onto the
 *  FRI label (MAXN saturation) — scaffolding, not a technique. Equal bands
 *  give Friday a real session instead of a pin. */
export const WEEK_XLABELS = Object.freeze(
  ['MON', 'TUE', 'WED', 'THU', 'FRI'].map((t, i) => Object.freeze({ t, f: i / 5 })),
);
export const weekTipF = (bankedCount, dayFrac) =>
  Math.max(0, Math.min(1, (bankedCount + Math.max(0, Math.min(1, dayFrac))) / 5));

// ── the trail snapshot + the B2 cut ─────────────────────────────────────────

/**
 * The most recent four-seat snapshot in the trail (B2's ONE source). Every
 * append writes all seats at one shared t (A3.2), so the per-seat tails share a
 * timestamp by construction. Fallback ladder per seat, in order:
 *   newest sample → the trail's seed (last banked close) → `banked` → 0.
 * Empty/absent trail ⇒ the banked closes — the cut renders from the seeds on a
 * cold mount, never as zero and never as absent (B2 empty-trail case).
 */
export function latestTrailSnapshot(trail, ids, banked = {}) {
  const values = {};
  let hasSamples = false;
  let t = null;
  for (const id of ids || []) {
    const arr = trail?.samples?.[id];
    const last = arr && arr.length ? arr[arr.length - 1] : null;
    if (last && Number.isFinite(last.v)) {
      values[id] = last.v;
      hasSamples = true;
      t = t == null ? last.t : Math.max(t, last.t);
    } else if (Number.isFinite(trail?.seeds?.[id])) {
      values[id] = trail.seeds[id];
    } else {
      values[id] = Number.isFinite(banked?.[id]) ? banked[id] : 0;
    }
  }
  return { values, hasSamples, t };
}

/**
 * B2 — the cut, derived from ONE snapshot. `rankByScores` is the SAME function
 * the server's advancement lock uses (lockTopTwo, tournamentAdvancement.js:103-112,
 * `advancers: ranking.slice(0, 2)`), so the client cut inherits the server's
 * exact ranking and tie-break semantics: the cut is the 2nd-place value.
 *
 * PROHIBITED (B2): deriving any of this from a parallel `scoresAtLast` read —
 * scoresAtLast floors a dropped poll to the banked close, so a rival's failed
 * fetch would flicker the cut downward. The trail's carry-forward is the one
 * staleness policy.
 */
export function deriveCut(snapshot, ids, youId) {
  const ranked = rankByScores(snapshot.values, ids || []);
  const leaderId = ranked[0] ?? null;
  const cutTotal = Number.isFinite(snapshot.values[ranked[1]]) ? snapshot.values[ranked[1]] : 0;
  const you = Number.isFinite(snapshot.values[youId]) ? snapshot.values[youId] : 0;
  return { ranked, leaderId, cutTotal, needToday: cutTotal - you };
}

// ── seat series builders (real points only — nothing synthesized) ───────────

/**
 * Day scope: TODAY relative to the seat's seed (all level at the open — the
 * seed IS the open baseline, a real banked value). Points connect the open
 * anchor to the real samples; the path between mount times is the R3-accepted
 * cosmetic interpolation between server-truth endpoints. No samples ⇒ [] and
 * the caller draws the flat spine + live tip (the designed reload state).
 */
export function seatDaySeries({ samples, seed }) {
  const s0 = Number.isFinite(seed) ? seed : 0;
  const pts = [{ f: 0, v: 0 }];
  for (const s of samples || []) {
    if (!Number.isFinite(s?.v) || !Number.isFinite(s?.t)) continue;
    pts.push({ f: sessionFraction(s.t), v: s.v - s0 });
  }
  return pts.length > 1 ? pts : [];
}

/**
 * Week scope: the banked closes at their day slots, plus (while live) the tip
 * at today's clock position. No banked days yet ⇒ the week genuinely starts at
 * the start line — anchor {f:0, v:0} (real: composites are zero at the first
 * open), then the tip.
 */
export function seatWeekSeries({ closes, tipValue, tipF, live }) {
  // Always anchored at the week's open — composites genuinely start at zero
  // Monday morning, so {f:0, v:0} is a real point, not a synthesized one.
  const pts = [{ f: 0, v: 0 }];
  (closes || []).forEach((v, i) => {
    if (Number.isFinite(v)) pts.push({ f: Math.min(i + 1, 5) / 5, v });
  });
  if (live && Number.isFinite(tipValue) && Number.isFinite(tipF)) {
    const lastF = pts[pts.length - 1].f;
    pts.push({ f: Math.max(tipF, lastF), v: tipValue });
  }
  return pts;
}

// ── the NOW pill vs the header microcopy (D6 / E4) ─────────────────────────
//
// The pill is FUNCTIONAL and must sit at the burn's true x; the header is
// microcopy. So the HEADER yields — a clean disappearance, never a truncation
// or a fade to unreadable — and it returns the moment the pill clears (E4).
//
// Widths are estimated from monospace metrics rather than measured, so no ref
// or layout pass is needed and the rule stays pure and testable. The estimate
// is deliberately GENEROUS (it over-states the header's width), so the failure
// mode is yielding a few pixels early rather than colliding.

/** Monospace advance ≈ 0.6em; the League mono stack is a fixed-advance face. */
export const MONO_ADVANCE_EM = 0.6;

/** Rendered width of a mono run, including letter-spacing. */
export function monoWidth(text, fontSize, letterSpacingEm = 0) {
  return String(text || '').length * fontSize * (MONO_ADVANCE_EM + letterSpacingEm);
}

/**
 * Should the header microcopy yield to the NOW pill this frame?
 * @param {Object} a
 * @param {number} a.burnX        - the pill's centre x (the burn)
 * @param {string} a.headerText   - the microcopy actually rendered
 * @param {number} a.headerLeft   - its left inset
 * @param {number} a.headerSize   - its font size
 * @param {number} [a.headerTrack]- its letter-spacing in em
 * @param {number} [a.pillHalf]   - half the pill's width (NOW + padding)
 * @param {number} [a.gap]        - breathing room required between them
 */
export function headerYieldsToNow({
  burnX, headerText, headerLeft, headerSize, headerTrack = 0.16, pillHalf = 18, gap = 10,
}) {
  if (!Number.isFinite(burnX)) return false;
  const headerRight = headerLeft + monoWidth(headerText, headerSize, headerTrack);
  return (burnX - pillHalf) < (headerRight + gap);
}

// ── F1: a y-label must FIT ITS OWN GUTTER ───────────────────────────────────
//
// Acceptance #5 asserted labels never OVERPRINT each other, and passed while the
// board failed: at 44,000-scale the floor label `-22800.0` was too wide for the
// 45px gutter and WRAPPED mid-number, rendering as `-22800.` above `0`. A fit
// defect hid behind a collision test. Width-vs-gutter is now its own rule.
//
// Abbreviation is preferred over widening the gutter: a gutter sized for
// arbitrary magnitude would eat the plot, and the plot is the point.

/** The drawable width of the y-label gutter, matching the rendered box. */
export const yGutterWidth = (padL) => padL - 11;

/**
 * The widest faithful rendering of `value` that fits `gutter`, tried in order:
 * full → one-decimal abbreviated (k/M) → integer abbreviated. The last is
 * returned even if it overflows, so the caller always gets a single-line
 * string; in practice it fits every magnitude the board can reach.
 */
export function fitYLabel(value, { gutter, fontSize, signed = false }) {
  if (!Number.isFinite(value)) return '';
  const sign = signed && value > 0 ? '+' : '';
  const fits = (t) => monoWidth(t, fontSize) <= gutter;

  const full = `${sign}${value.toFixed(1)}`;
  if (fits(full)) return full;

  const a = Math.abs(value);
  const [scaled, suffix] = a >= 1e6 ? [value / 1e6, 'M'] : a >= 1e3 ? [value / 1e3, 'k'] : [value, ''];
  const one = `${sign}${scaled.toFixed(1)}${suffix}`;
  if (fits(one)) return one;
  return `${sign}${Math.round(scaled)}${suffix}`;
}

// ── F2: the NOW pill vs the scope toggle (the mirrored right-edge case) ─────
//
// E4 solved the LEFT edge by having the header yield — it is decorative. The
// right-edge obstacle is the scope toggle, which CANNOT yield: it is
// interactive, it is how scope is changed, and its hit area must stay live.
// So the PILL moves. See nowPillX.

/**
 * Left edge of the scope toggle, from the same mono metrics it renders with,
 * WIDENED by a safety factor.
 *
 * The factor is calibrated against observation, not invented: at F2's review the
 * pill read as "arguably touching" the toggle at maximum burn, where the
 * unfactored estimate said it cleared by ~5px. So the estimate under-states the
 * real control by at least that much — unsurprising, since the mono advance is
 * nominal, letter-spacing lands after the final glyph, and the shell adds
 * borders and padding the metrics do not see.
 *
 * The estimate must therefore err WIDE (toggle further left ⇒ pill keeps more
 * distance), the same direction-of-safety rule headerYieldsToNow uses. The cost
 * of erring is a pill that slides a few pixels early; the cost of erring the
 * other way is occluding a control the user must be able to hit.
 */
export const TOGGLE_WIDTH_SAFETY = 1.15;

export function scopeToggleLeft({ w, compact = false }) {
  const fontSize = compact ? 8.5 : 9.5;
  const padX = compact ? 8 : 11;
  const btn = (label) => monoWidth(label, fontSize, 0.06) + padX * 2 + 2; // +border
  const raw = btn('Today') + btn('The week') + 3 + 6 + 2;                 // gap + shell padding + shell border
  const rightInset = compact ? 10 : 16;
  return w - rightInset - raw * TOGGLE_WIDTH_SAFETY;
}

/**
 * Where the NOW pill's CENTRE actually goes.
 *
 * Normally the burn. Near the right edge it is clamped left so the pill's box
 * (plus a gap) stops short of the toggle — never occluding a control the user
 * must be able to hit. The displacement is bounded by pillHalf + gap, so the
 * pill stays adjacent to the burn rather than detaching from it; the tips' own
 * embers remain the precise NOW marker.
 */
export function nowPillX({ burnX, w, compact = false, pillHalf = 18, gap = 8 }) {
  if (!Number.isFinite(burnX)) return burnX;
  const limit = scopeToggleLeft({ w, compact }) - gap - pillHalf;
  return Math.min(burnX, limit);
}

// ── H3: THE ONE AXIS TRANSFORM ─────────────────────────────────────────────
//
// The cut line has been wrong three separate ways, every one of them plausible
// on screen, every one a different pair of quantities compared as if they were
// the same:
//   A4/B2  mixed basis   — live rival composites against a banked own-score
//   B2     floored value — a dropped poll reading as a genuine banked number
//   CR1    wrong axis    — a gap between TOTALS drawn on an axis of DELTAS
//
// Three fixes for one property. This is that property, as a single function:
// EVERY y on the board — each seat's curve, each seat's tip, the cut line, and
// the cut's own label — is a total put through THIS transform and nothing else.
// Week scope plots totals; Today plots each seat's move since its own open.
//
// Structural, not merely tested: there is one conversion, so a future fourth
// member of the family has to go out of its way to exist. The property test
// (fuseGeometry.test.js) asserts the cut sits exactly where YOUR seat would sit
// at total === cutTotal, in both scopes, over randomised inputs.
//
// NOTE, deliberately: in Today scope the cut is YOUR-seat-specific — it answers
// "what must I do today", and a rival with a different open baseline sits on a
// different delta for the same total. That is the design ("all level at the
// open"), not a defect, and it is why the invariant is stated against YOUR seat
// rather than against every seat.
export function toAxisValue(total, seed, day) {
  if (!Number.isFinite(total)) return 0;
  return day ? total - (Number.isFinite(seed) ? seed : 0) : total;
}

/** Where the cut line belongs on the axis: exactly where YOUR seat would be if
 *  your total were the cut. Same transform, same inputs — by construction. */
export function cutAxisLevel({ cutTotal, youSeed, day }) {
  return toAxisValue(cutTotal, youSeed, day);
}
