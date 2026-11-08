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
/** A to-go %: two decimals under 1 % — the red zone's own precision, so the pill and the zone agree at the band — one decimal from 1 % up. */
const goPct = (pct) => (Math.abs(pct) < 1 ? Math.abs(pct).toFixed(2) : Math.abs(pct).toFixed(1));

export const BOMB_COPY = Object.freeze({
  // The Fuse
  ghostCaption: '30-min closes · dots = checks',
  baselineHeld: (price, d, when) => `Entry ${money(price, d)}${when ? ` · ${when}` : ''}`,
  baselineFromClose: (price, d) => `From yesterday's close ${money(price, d)}`,
  baselinePreview: (price, d) => `Yesterday's close ${money(price, d)}`,
  baselineV4: (price, d) => `Today's baseline ${money(price, d)}`,
  belowCompressed: 'Below · compressed',
  rungTitle: (label, pct) => `${label.toUpperCase()} · ${signedPct(pct)}`,
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
  needs: (price, d, clockLabel) => `Needs ${money(price, d)} at a check${clockLabel ? ` · next check ${clockLabel}` : ''}`,
  needsChecking: (price, d) => `Needs ${money(price, d)} at a check · checking…`,
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
});
