// src/components/Research/Sheet/sheetOpen.js
//
// Research Modal Build C — founder ruling FQ-9 (2026-11-08): where the modal
// OPENS when the sheet AND Bomb mode are both on.
//
// The mounts open on the sheet (§5 decision 1), with one exception: a MEASURED
// HELD stock that is inside the red-zone band when the modal opens — the market
// open, Build A's red-zone machine, the live price within RED_ZONE_ENTER_PCT
// (0.5 %) of the next unbanked upside rung — opens on 💣 in the red zone.
//
// Decided ONCE, at open (the modal holds the answer from its first render), from
// the price the screen already holds; with no price yet, the sheet. Never
// switched after open. PURE: Build A's own pieces only (buildLadder, toGo,
// sessionOpenAt, stepRedZone), so the 💣 view the modal opens on agrees with it.

import { buildLadder } from '../BombMode/bombView.js';
import { toGo } from '../BombMode/ladder.js';
import { sessionOpenAt } from '../BombMode/checkClock.js';
import { stepRedZone, RED_ZONE_INITIAL } from '../BombMode/redZone.js';
import { priceDecimals } from '../priceFormat.js';

const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * @param {object} p
 * @param {object|null} p.bombContext  the mount's Bomb mode contract ({ kind: 'agent', held, record } for a battle row)
 * @param {string} p.symbol            the stock the modal opens on
 * @param {number|null} p.live         the price the screen holds at open (none → false)
 * @param {number} p.nowMs             the instant of the open
 * @param {boolean} [p.isCrypto]       crypto never enters the red zone (BA-2)
 * @returns {boolean} true → open on 💣 (the Bomb tab), false → open on the sheet
 */
export function opensInRedZone({ bombContext, symbol, live, nowMs, isCrypto = false }) {
  if (!bombContext || typeof bombContext !== 'object' || bombContext.kind !== 'agent' || bombContext.held !== true) return false;
  const record = bombContext.record;
  if (!record || record.model !== 'measured' || isCrypto === true || !positive(live)) return false;
  const ladder = buildLadder({ context: bombContext, record, bombData: null, previousClose: null, threshold: null, symbol, nowMs });
  if (!ladder || ladder.status !== 'ok' || ladder.kind !== 'held') return false;
  const go = toGo(ladder, live, { decimals: priceDecimals(live) });
  if (!go) return false;
  const state = stepRedZone(RED_ZONE_INITIAL, {
    held: true,
    crypto: false,
    marketOpen: sessionOpenAt(nowMs),
    positionId: record.positionId ?? null,
    bankedUp: ladder.up.filter((r) => r.banked).map((r) => r.key),
    next: { key: go.rung.key, pct: go.pctShown },
  });
  return state.mode === 'approaching';
}
