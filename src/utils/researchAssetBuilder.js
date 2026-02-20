// researchAssetBuilder.js — Normalizes asset data into the shape expected by AssetResearchModal.
// Replaces duplicated inline object-building patterns across:
//   BaggerBombBattleView, FreeAgentBar, TopPerformersModal, FreeAgencyMobile, FreeAgencyDesktop, CommandConsole

/** Default threshold when no volatility data is available */
export const DEFAULT_THRESHOLD = 2.5;

/**
 * Look up a value in a map, trying the symbol as-is then uppercased.
 * Handles the common case where some data stores use mixed-case keys.
 */
function lookup(map, symbol) {
  if (!map || !symbol) return undefined;
  return map[symbol] ?? map[symbol.toUpperCase()];
}

/**
 * Build a normalised research-asset object for AssetResearchModal.
 *
 * @param {Object} asset        – The raw asset/agent object (symbol, name, price, …)
 * @param {Object} [options]
 * @param {Object} [options.livePrices]       – { SYMBOL: { price, percentChange } } or { SYMBOL: number }
 * @param {Object} [options.thresholds]       – { SYMBOL: { threshold, baseATR?, … } }
 * @param {Object} [options.openPrices]       – { SYMBOL: number } (locked/starting prices)
 * @param {Object} [options.startingPrices]   – Fallback starting prices (battle.state.startingPrices)
 * @param {number|null} [options.percentChange] – Override percent change (pre-computed)
 * @param {boolean} [options.useDefaultThreshold] – If true, fall back to DEFAULT_THRESHOLD (default: false → null)
 * @returns {Object} Normalised asset for AssetResearchModal
 */
export function buildResearchAsset(asset, options = {}) {
  const {
    livePrices = {},
    thresholds = {},
    openPrices = {},
    startingPrices = {},
    percentChange,
    useDefaultThreshold = false,
  } = options;

  const sym = asset.symbol;

  // --- Price resolution ---
  // Handles: livePrices map, currentPrice (Snake Draft/standings), price (BaggerBomb),
  //          latestPrice, close, lastPrice (various API shapes)
  const liveEntry = lookup(livePrices, sym);
  const livePrice = typeof liveEntry === 'object' ? liveEntry?.price : liveEntry;
  const price = livePrice
    || asset.currentPrice
    || asset.price
    || asset.latestPrice
    || asset.close
    || asset.lastPrice
    || 0;

  // --- Percent change resolution ---
  // Handles: explicit override, livePrices percentChange, priceChange, gain (Snake Draft),
  //          percentChange, dailyChange (FreeAgency), gainPercent, changePercent
  const livePct = typeof liveEntry === 'object' ? liveEntry?.percentChange : undefined;
  const pctChange = percentChange
    ?? livePct
    ?? asset.priceChange
    ?? asset.gain
    ?? asset.percentChange
    ?? asset.dailyChange
    ?? asset.gainPercent
    ?? asset.changePercent
    ?? null;

  // --- Threshold resolution ---
  const thresholdEntry = lookup(thresholds, sym);
  const threshold = thresholdEntry?.threshold
    || asset.baseATR
    || asset.threshold
    || (useDefaultThreshold ? DEFAULT_THRESHOLD : null);

  // --- Locked / baseline price resolution ---
  // Handles: openPrices map, startingPrices map, lockedPrice (draft-time),
  //          baselinePrice (Snake Draft previousClose), previousClose, startPrice
  const lockedPrice = lookup(openPrices, sym)
    || lookup(startingPrices, sym)
    || asset.lockedPrice
    || asset.baselinePrice
    || asset.previousClose
    || asset.startPrice
    || null;

  // --- Computed percent change fallback ---
  // When no explicit percent change data is provided but both price and lockedPrice
  // are available (e.g. EventFeed "View Chart" in BaggerBomb), compute it.
  const finalPctChange = (pctChange == null && price > 0 && lockedPrice > 0)
    ? ((price - lockedPrice) / lockedPrice) * 100
    : (pctChange ?? 0);

  // --- Core fields ---
  const result = {
    symbol: sym,
    name: asset.name || sym,
    price,
    percentChange: finalPctChange,
    threshold,
    lockedPrice,
  };

  // --- Pass-through optional fields when present ---
  if (asset.sector !== undefined) result.sector = asset.sector;
  if (asset.category !== undefined) result.category = asset.category;
  if (asset.isCrypto !== undefined) result.isCrypto = asset.isCrypto;
  if (asset.currentPrice !== undefined) result.currentPrice = asset.currentPrice;

  // BaggerBomb scoring data (TopPerformersModal passes these)
  if (asset.baggerBombs !== undefined) result.baggerBombs = asset.baggerBombs;
  if (asset.busts !== undefined) result.busts = asset.busts;
  if (asset.basePoints !== undefined) result.basePoints = asset.basePoints;
  if (asset.baggerBombPoints !== undefined) result.baggerBombPoints = asset.baggerBombPoints;
  if (asset.bustPoints !== undefined) result.bustPoints = asset.bustPoints;
  if (asset.totalScore !== undefined) result.totalScore = asset.totalScore;
  if (asset.gain !== undefined) result.gain = asset.gain;

  return result;
}
