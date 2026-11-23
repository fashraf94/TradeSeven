// src/components/Search/companyMatch.js
//
// The Search page's company matcher, moved out of SearchOverlay.jsx unchanged so that
// SearchOverlay and Explore's search (src/components/Explore/ExploreSearch.jsx) import the
// same one (Explore Build 1 spec §3.3, build prompt K-12): never a second copy.

import { STOCKS } from '../../data/assets';

/** The companies a typed query names: symbol or name contains it, case-insensitive, at most 20, in list order. */
export function matchCompanies(query) {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  return STOCKS.filter(s =>
    s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
  ).slice(0, 20);
}

/** The asset AssetResearchModal opens on: a matched stock, with its live price when the page holds one. */
export function researchAssetOf(stock, priceMap) {
  const priceInfo = priceMap[stock.symbol] || {};
  return {
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    price: priceInfo.price || 0,
    percentChange: priceInfo.percentChange || 0,
    change: priceInfo.change || 0,
  };
}
