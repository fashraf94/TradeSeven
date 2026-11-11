// src/components/Research/BombMode/bombCopy.js
//
// Research Modal Build A — EVERY STRING Bomb mode puts on screen (spec §5
// honesty). The components render copy from here and nowhere else, so
// bombCopy.honesty.test.js can scan all of it (the rendered templates and this
// source) for the forbidden terms: the agent verbs of the Desk guard
// (deskHonesty.test.js), "the agent held", "will bank", and — on a preview —
// "entry" in any form.
//
// SCOREBOARD LANGUAGE ONLY: a rung banks at a scoring check; the copy says what
// the scoreboard needs, never what the agent will do.

import { priceText } from '../priceFormat.js';

export const money = (price, decimals) => `$${priceText(price, decimals)}`;
const signedPct = (pct, digits = 1) => `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(digits)}%`;
/**
 * A rung's move from the baseline (ladder.rungPct: from the DISPLAYED prices),
 * two decimals, signed — the ONE string the Fuse's titles, the bar and the
 * levels table print for a rung (BD-6, BUILD_RULES §9).
 */
export const rungPctText = (pct) => signedPct(pct, 2);
/** Downside points with the typographic minus: −10. */
const downPts = (points) => `−${Math.abs(points)}`;
/** A to-go %: two decimals under 1 % — the red zone's own precision, so the pill and the zone agree at the band — one decimal from 1 % up. */
const goPct = (pct) => (Math.abs(pct) < 1 ? Math.abs(pct).toFixed(2) : Math.abs(pct).toFixed(1));

export const BOMB_COPY = Object.freeze({
  // The Fuse
  ghostCaption: '30-min closes · dots = checks',
  baselineHeld: (price, d, when) => `Entry ${money(price, d)}${when ? ` · ${when}` : ''}`,
  baselineFromClose: (price, d) => `From yesterday's close ${money(price, d)}`,
  baselinePreview: (price, d) => `Yesterday's close ${money(price, d)}`,
  baselineV4: (price, d) => `Today's baseline ${money(price, d)}`,
  rungTitle: (label, pct) => `${label.toUpperCase()} · ${rungPctText(pct)}`,
  rungPoints: (points, banked) => `${points > 0 ? '+' : ''}${points}${banked ? ' ✓' : ''}`,
  bankedAt: (time) => `Banked · ${time}`,
  liveTag: 'live',
  livePct: (pct) => `${signedPct(pct)} · live`,
  lastPct: (pct) => `${signedPct(pct)} · last`,
  // The to-go pill and the rail's label (brick wording, spec §3.6)
  toGoBricks: (pct, bricks, points) => `${goPct(pct)}% · ${bricks} brick${bricks === 1 ? '' : 's'} to +${points}`,
  toGoPlain: (pct, points) => `${goPct(pct)}% to +${points}`,
  toGoAt: (points) => `At +${points} · a check decides`,
  toGoAtPreview: (points) => `At +${points}`,
  toGoWithLive: (base, live) => `${base} · live ${live}`,
  toGoWithLast: (base, last) => `${base} · last ${last}`,
  allBanked: 'Every rung banked',
  previewChip: 'Preview',
  // States without a ladder
  entryUnavailable: 'Entry unavailable',
  entryUnavailableWhy: "This position's scoring baseline isn't on the record yet, so no rung is drawn.",
  measuredUnavailable: 'Measured reward unavailable',
  measuredUnavailableWhy: "This position's measured score can't be confirmed right now. It updates on the next check.",
  previewUnavailable: 'No ladder yet',
  previewUnavailableWhy: "Yesterday's close or this stock's threshold hasn't loaded.",
  shortUnsupported: 'No upside ladder for a short position',
  modelUnavailable: 'Scoring model unavailable',
  modelUnavailableWhy: "This battle's scoring model can't be read here, so no rung is drawn.",
  // The red zone
  redZoneChip: 'Red zone',
  yourPosition: 'Your position',
  marketClosed: (time) => `Market closed · last tick ${time}`,
  marketClosedNoTick: 'Market closed',
  rungTag: (emoji, label, points, price, d) => `${emoji} ${label} · +${points} pts · ${money(price, d)}`,
  distanceSub: (points, pct) => `to +${points} · ${Math.abs(pct).toFixed(2)}%`,
  aboveSub: (points) => `over +${points} · scores only at a check`,
  floorLabel: (price, d, pct) => `Floor ${money(price, d)}${Number.isFinite(pct) ? ` · ${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%` : ''}`,
  floorBanked: (label, points) => `${label.toUpperCase()} · +${points} · banked ✓`,
  traceEnd: (interval, time) => `${interval} bars to ${time}`,
  traceInterval: (minutes) => (minutes === 1 ? '1-min' : `${minutes}-min`),
  traceObservations: 'Live quotes since you opened',
  noBars: 'No minute bars yet',
  bankedBig: (points) => `+${points}`,
  bankedLine: (time, price, d) => `Banked${time ? ` · ${time} check` : ''}${Number.isFinite(price) ? ` · ${money(price, d)}` : ''}`,
  // The clock and the chip
  nextCheck: 'Next check',
  nextCheckInline: (label) => `next check ${label}`,
  checking: 'checking…',
  noCheckLeft: 'No check left in this battle',
  scoredChip: (live, scored, at, d) => `live ${money(live, d)} · scored ${money(scored, d)} at ${at}`,
  lastTickChip: (live, scored, at, d) => `last ${money(live, d)} · scored ${money(scored, d)} at ${at}`,
  // The sheet: what has to happen (templates only — spec §4.3)
  sheetTitle: 'The ladder',
  whatHasToHappen: 'What has to happen',
  // (Build A's `needs` / `needsChecking` lines are retired: the held line is lead-aware since BD-4 — see below.)
  afterBank: (points, at, price, d) => `+${points} banked${at ? ` at the ${at} check` : ''}. Next: ${money(price, d)} at a check`,
  allRungsBanked: (points) => `+${points} banked · every rung is banked`,
  previewNeeds: (price, d) => `Preview · rungs if it entered at yesterday's close (${money(price, d)})`,
  // Ruling 2026-11-07 (§0.4(a), rule (i)): a position the agent holds whose
  // score is the legacy model's (legacy stocks, every crypto) draws the
  // preview's rungs, said plainly as held — never "entry price", never "will
  // bank", nothing lit as banked.
  heldPreviewNeeds: (price, d) => `Held · rungs shown from yesterday's close (${money(price, d)}) · this position's live ladder isn't shown here`,
  previewV4: (price, d) => `Preview · today's levels from today's baseline (${money(price, d)})`,
  sheetBankedSoFar: (points) => `+${points} banked`,

  // ── Refinement 2026-11-10: both directions (BD-1 – BD-8) ────────────────────
  // NAMING RULE: every DOWNSIDE template's key starts with `down` or `danger`, so
  // the honesty test enumerates them by construction (BD-10: a crossed downside
  // rung is "hit", never "banked"). Upside templates never start with either.
  //
  // The scored chip names the CHECK (BD-8): `at the 1:00 check`, or for an
  // earlier session `at Mon's 3:45 check`; with no slot, today's time.
  checkName: (time) => `the ${time} check`,
  checkNameDay: (day, time) => `${day}'s ${time} check`,
  // The to-go line, both sides (BD-3 pills, BD-4 bar): the lead in full, the
  // other short. Arrows say the side.
  upArrow: '↑',
  downArrow: '↓',
  toGoShort: (pct, bricks, points) => `${goPct(pct)}% · ${bricks} to +${points}`,
  downToGoBricks: (pct, bricks, label, points) => `${goPct(pct)}% · ${bricks} brick${bricks === 1 ? '' : 's'} to ${label} ${downPts(points)}`,
  downToGoBricksShort: (pct, bricks, points) => `${goPct(pct)}% · ${bricks} brick${bricks === 1 ? '' : 's'} to ${downPts(points)}`,
  downToGoPlain: (pct, label, points) => `${goPct(pct)}% to ${label} ${downPts(points)}`,
  downToGoShort: (pct, bricks, label, points) => `${goPct(pct)}% · ${bricks} to ${label} ${downPts(points)}`,
  downToGoAt: (label, points) => `At ${label} ${downPts(points)} · a check decides`,
  downToGoAtPreview: (label, points) => `At ${label} ${downPts(points)}`,
  downEveryRungHit: 'Every rung below hit',
  // The Fuse's downside rungs (BD-3)
  downPoints: (points) => downPts(points),
  downHitTitle: (label, time) => `${label.toUpperCase()} · HIT${time ? ` ${time}` : ''}`,
  // What has to happen, lead-aware (BD-4). Up leads: needsFor + downAt (+ the clock);
  // down leads: downIfAtCheck + upNeeds (+ the clock); after a hit: downHitAt + downNextBelow.
  needsFor: (price, d, points) => `Needs ${money(price, d)} at a check for +${points}`,
  upNeeds: (points, price, d) => `+${points} needs ${money(price, d)}`,
  downAt: (label, price, d) => `${label} at ${money(price, d)}`,
  downIfAtCheck: (label, points, price, d) => `${label} (${downPts(points)}) if it's at or below ${money(price, d)} at a check`,
  downHitAt: (label, points, check) => `${label} ${downPts(points)} hit${check ? ` at ${check}` : ''}`,
  downNextBelow: (label, price, d) => `next below: ${label} at ${money(price, d)}`,
  // The levels table under the bar (BD-6)
  levelsTitle: 'All levels',
  // Takes the rung's ALREADY-PRINTED % and price (bombView.rungFacts): the table re-formats nothing (§9).
  levelSub: (pctText, priceText) => `${pctText} · ${priceText}`,
  levelPoints: (points) => `+${points}`,
  levelBanked: (time) => `✓ banked${time ? ` ${time}` : ''}`,
  downLevelHit: (time) => `hit${time ? ` ${time}` : ''}`,
  levelNext: (bricks) => (Number.isFinite(bricks) ? `next · ${bricks} brick${bricks === 1 ? '' : 's'}` : 'next'),
  levelLive: (price, d, pct) => `Live ${money(price, d)} · ${signedPct(pct)}`,
  levelLast: (price, d, pct) => `Last ${money(price, d)} · ${signedPct(pct)}`,
  levelsPreview: 'Preview',
  // The collapsed Details for a measured position — StockRewardDetails' facts, moved unchanged
  detailsTitle: 'Details',
  detailsMeasured: (pctDecimal) => `Frozen measured %: ${pctDecimal}% (exact)`,
  detailsTarget: (label, target) => `${label}: exact $${target}`,
  detailsQuote: (price, asOf) => `Quote $${price} as of ${asOf}`,
  detailsPosition: (id) => `Position ${id}`,
  detailsReceipt: (hash) => `Receipt ${hash}`,
  detailsInput: (ref) => `Input ${ref}`,
  detailsModel: (id) => `Model ${id}`,
  detailsCents: 'Cents are rounded half-even for display only; awards use the exact targets.',
  // The Danger Zone (BD-5) — the red zone's layout, the downside rung as the goal
  dangerZoneChip: 'Danger zone',
  dangerRungTag: (emoji, label, points, price, d) => `${emoji} ${label} · ${downPts(points)} pts · ${money(price, d)}`,
  dangerDistanceSub: (label, points, pct) => `to ${label} ${downPts(points)} · ${Math.abs(pct).toFixed(2)}%`,
  dangerBelowSub: (label, points) => `at or below ${label} ${downPts(points)} · a check decides`,
  downHitLine: (label, points, check) => `${label} · ${downPts(points)} · hit${check ? ` at ${check}` : ''}`,
  // Battle View → Why? (BD-7)
  seeAllLevels: 'See all levels ›',
});
