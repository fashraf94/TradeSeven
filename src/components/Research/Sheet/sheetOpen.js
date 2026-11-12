// src/components/Research/Sheet/sheetOpen.js
//
// Research Modal Build C — founder ruling FQ-9 (2026-11-08): where the modal
// OPENS when the sheet AND Bomb mode are both on.
//
// The mounts open on the sheet (§5 decision 1), with one exception: a MEASURED
// HELD stock that is inside a zone's band when the modal opens — the market
// open, Build A's zone machines, the live price within RED_ZONE_ENTER_PCT
// (0.5 %) of the next unbanked upside rung (the red zone) or, since the
// both-directions refinement (BD-5, 2026-11-10), of the next unhit downside
// rung (the Danger Zone) — opens on 💣 in that zone.
//
// Decided ONCE, at open (the modal holds the answer from its first render), from
// the price the screen already holds; with no price yet, the sheet. Never
// switched after open. PURE: Build A's own pieces only (buildLadder, toGo,
// toGoDown, sessionOpenAt, stepZones), so the 💣 view the modal opens on agrees with it.

import { buildLadder } from '../BombMode/bombView.js';
import { toGo, toGoDown } from '../BombMode/ladder.js';
import { sessionOpenAt } from '../BombMode/checkClock.js';
import { stepZones, ZONES_INITIAL } from '../BombMode/redZone.js';
import { priceDecimals } from '../priceFormat.js';

const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * @param {object} p
 * @param {object|null} p.bombContext  the mount's Bomb mode contract ({ kind: 'agent', held, record } for a battle row)
 * @param {string} p.symbol            the stock the modal opens on
 * @param {number|null} p.live         the price the screen holds at open (none → false)
 * @param {number} p.nowMs             the instant of the open
 * @param {boolean} [p.isCrypto]       crypto never enters a zone (BA-2)
 * @returns {boolean} true → open on 💣 (the Bomb tab), false → open on the sheet
 */
export function opensInRedZone({ bombContext, symbol, live, nowMs, isCrypto = false }) {
  if (!bombContext || typeof bombContext !== 'object' || bombContext.kind !== 'agent' || bombContext.held !== true) return false;
  const record = bombContext.record;
  if (!record || record.model !== 'measured' || isCrypto === true || !positive(live)) return false;
  const ladder = buildLadder({ context: bombContext, record, bombData: null, previousClose: null, threshold: null, symbol, nowMs });
  if (!ladder || ladder.status !== 'ok' || ladder.kind !== 'held') return false;
  const decimals = priceDecimals(live);
  const go = toGo(ladder, live, { decimals });
  const goDown = toGoDown(ladder, live, { decimals });
  if (!go && !goDown) return false;
  const state = stepZones(ZONES_INITIAL, {
    held: true,
    crypto: false,
    marketOpen: sessionOpenAt(nowMs),
    positionId: record.positionId ?? null,
    bankedUp: ladder.up.filter((r) => r.banked).map((r) => r.key),
    hitDown: ladder.down.filter((r) => r.hit).map((r) => r.key),
    next: go ? { key: go.rung.key, pct: go.pctShown } : null,
    nextDown: goDown ? { key: goDown.rung.key, pct: goDown.pctShown } : null,
  });
  return state.mode === 'approaching' || state.mode === 'danger';
}
