// src/components/League/battleArena/useArenaPriceContext.js
//
// League Battle View V2 — the arena's live PRICE CONTEXT (Phase 3). Assembles the
// { effectivePrices, previousClosePrices, isActivationDay } the Phase-1 meter
// readers consume, for an arbitrary symbol list (the arena needs the agent's six
// ∪ your three — a superset of Flat6's six).
//
// ORIGIN / DO-NOT-DRIFT: this is a deliberate PARALLEL of the price assembly in
// src/components/Tournament/Flat6BattleView.jsx:114-165 (useWebSocketPrices + a
// 60s REST poll + effectivePrices merge + isFlat6ActivationDay). It is price
// PLUMBING, not scoring — copied rather than extracted into a shared hook so the
// LIVE Flat6BattleView screen stays byte-UNTOUCHED (the Phase-3 prime directive:
// flag-off must be byte-identical, and Flat6 is rendered flag-on AND flag-off).
// Keep the two in sync; this copy is meant to DISSOLVE once the arena replaces
// Flat6BattleView everywhere and the shared hook can be lifted with no live-screen
// blast radius.

import React from 'react';
import { useWebSocketPrices } from '../../../hooks/useWebSocketPrices';
import { stockAPI } from '../../../services/eodhdAPI';
import { isFlat6ActivationDay } from '../../../utils/flat6BattleEnrichment';

const PRICE_POLL_MS = 60000; // mirrors Flat6BattleView's PRICE_POLL_INTERVAL

/**
 * @param {string[]} symbols a STABLE (content-keyed) symbol array — see useArenaModel
 * @param {Object|null} battle the flat6 battle (for the activation-day baseline gate)
 * @returns {{ effectivePrices, previousClosePrices, isActivationDay, pricesLoaded }}
 */
export function useArenaPriceContext(symbols, battle) {
  const { prices: wsPrices } = useWebSocketPrices(symbols, { enabled: symbols.length > 0 });
  const [currentPrices, setCurrentPrices] = React.useState({});
  const [previousClosePrices, setPreviousClosePrices] = React.useState({});

  const fetchPrices = React.useCallback(async () => {
    if (symbols.length === 0) return;
    try {
      const data = await stockAPI.getMultipleStockPrices(symbols);
      const prices = {};
      const prevCloses = {};
      Object.entries(data || {}).forEach(([sym, d]) => {
        if (d?.price) prices[sym] = d.price;
        if (d?.previousClose) prevCloses[sym] = d.previousClose;
      });
      if (Object.keys(prices).length) setCurrentPrices((p) => ({ ...p, ...prices }));
      if (Object.keys(prevCloses).length) setPreviousClosePrices((p) => ({ ...p, ...prevCloses }));
    } catch (err) {
      console.warn('[useArenaPriceContext] price fetch failed:', err?.message || err);
    }
  }, [symbols]);

  React.useEffect(() => {
    if (symbols.length === 0) return undefined;
    fetchPrices();
    const id = setInterval(fetchPrices, PRICE_POLL_MS);
    return () => clearInterval(id);
  }, [fetchPrices, symbols.length]);

  // No WS data → return currentPrices unchanged (stable identity, no needless
  // scorer recompute on empty flushes) — the live-screen posture.
  const effectivePrices = React.useMemo(() => {
    if (!wsPrices || Object.keys(wsPrices).length === 0) return currentPrices;
    return { ...currentPrices, ...wsPrices };
  }, [currentPrices, wsPrices]);
  const pricesLoaded = Object.keys(effectivePrices).length > 0;
  const isActivationDay = isFlat6ActivationDay(battle, Date.now());

  return React.useMemo(
    () => ({ effectivePrices, previousClosePrices, isActivationDay, pricesLoaded }),
    [effectivePrices, previousClosePrices, isActivationDay, pricesLoaded],
  );
}
