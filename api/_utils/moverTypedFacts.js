// api/_utils/moverTypedFacts.js
// Alex Catalyst Confirmation mini-arc (spec V1.1) — C1(i) structural boundary.
//
// THE market_mover TYPED-FACT CONSTRUCTOR. Its signature accepts ONLY
// price/trigger scalars — NEVER the EXA/Sonar retrieval payload. So the arc's
// own doctrine holds by construction, not declaration: retrieval output cannot
// reach a Wire-consumed typed field because the constructor cannot receive it;
// retrieval merges into PROMPT assembly strictly DOWNSTREAM of this call.
//
// The companion import-graph test (moverTypedFacts.boundary.test.js) statically
// forbids this module from importing the retrieval seam (the EXA client, the
// Sonar/EODHD catalyst fetch, the validated-catalyst cache) — C1(ii), reusing
// the AgentSafeWireEntry boundary machinery. Keep this module import-clean of
// anything retrieval-shaped; that emptiness is the guarantee.

/**
 * Build the server-authored typed price snapshot the mover story carries
 * (dataSnapshot). Every field derives from a price/trigger scalar known BEFORE
 * the model call — no model output, no retrieval text.
 *
 * @param {object} o
 * @param {number} o.currentPrice
 * @param {number} o.priceChange
 * @param {number} o.percentChange
 * @param {number} o.atrMultiple
 * @param {string} [o.direction] — 'up' | 'down'; derived from the sign if absent
 * @returns {{ price:number, change:number, percentChange:number, atrMultiple:number, direction:string }}
 */
export function buildMoverDataSnapshot({ currentPrice, priceChange, percentChange, atrMultiple, direction }) {
  const pct = Number(percentChange);
  return {
    price: Number(currentPrice),
    change: Number(priceChange),
    percentChange: pct,
    atrMultiple: Number(atrMultiple),
    direction: direction || (pct >= 0 ? 'up' : 'down'),
  };
}
