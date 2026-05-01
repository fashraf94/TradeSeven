/**
 * Sector content for the Discover tab Sectors rail.
 *
 * Two-sources-of-truth pattern (mirrors Sprint 1's themesDkb.js):
 *  - Firestore `discoverSectors` collection holds the registry: which sectors
 *    are visible, in what default order, status flags. See seed-discover-sectors.js.
 *  - This file holds the editorial content: regime tag, lead/lag phrase, body
 *    paragraph, linked themes for cross-link to the Themes grid.
 *
 * Keys are SPDR sector ETF tickers. Lookup by ticker, not by Firestore docId.
 *
 * If you edit content here, no re-seed is needed — the modal reads this
 * file directly. Firestore reseeding is only required if you change the
 * registry shape (status, displayOrder, etc).
 */

export const SECTOR_CONTENT = {
  XLK: {
    name: 'Technology',
    regimeTag: 'Cost of Capital / Risk-On Anchor',
    leadLag: 'First sector to crack on rate fear, first to recover on relief',
    body: 'Tech leads when capital flows freely. As the longest-duration equity sector in the index, XLK is mathematically more sensitive to discount rates than anywhere else — when 10-year yields rise, multiples here compress fastest. But the deeper truth is simpler: as long as risk appetite is on, growth tech is the market’s primary leader.',
    linkedThemes: [
      'theme_ai_infrastructure_buildout',
      'theme_cybersecurity_buildout',
      'theme_dollar_strength_regimes',
    ],
  },

  XLV: {
    name: 'Healthcare',
    regimeTag: 'Defensive Duration + Headline Risk',
    leadLag: 'Outperforms when growth decelerates; vulnerable to political news cycles',
    body: 'Healthcare reflects two macro forces and one political one: defensive flight-to-safety when growth wobbles, long-duration biotech innovation that competes with rates, and a permanent overhang from drug pricing policy. The sector outperforms when the curve flattens — but is uniquely exposed to political headlines, with regime breaks tied to drug-pricing news regardless of which party is in charge. Watch the dollar for the rest: 50%+ of pharma revenue is international.',
    linkedThemes: [
      'theme_aging_demographics',
      'theme_dollar_strength_regimes',
    ],
  },

  XLF: {
    name: 'Financials',
    regimeTag: 'Credit Cycle + Global Growth',
    leadLag: 'Banks lead on curve steepening; capital markets lead on global risk appetite',
    body: 'Financials are not one trade. Big banks (JPM, BAC) ride net interest margin and the yield curve; investment banks (GS, MS) ride deal flow and global risk appetite; payments (V, MA) ride consumer transaction volume; insurers ride yield levels and underwriting cycles. The sector outperforms when growth, credit, and global activity align — and breaks down when any one of those legs gives out.',
    linkedThemes: [
      'theme_housing_cycle',
      'theme_dollar_strength_regimes',
      'theme_consumer_bifurcation',
    ],
  },

  XLE: {
    name: 'Energy',
    regimeTag: 'Inflation Hedge',
    leadLag: 'Leads in inflationary regimes, lags during demand collapses',
    body: 'Energy is the equity market’s most direct inflation hedge — it loads positively on breakeven inflation harder than any other sector. Unlike the rest of the index, XLE is short-duration: high dividends and aggressive buybacks make it less sensitive to rising discount rates, which is why it often holds up when growth sectors crack. Watch the dollar and oil supply: a strong USD compresses margins, while geopolitical supply shocks can decouple the sector entirely from the broader market.',
    linkedThemes: [
      'theme_energy_transition',
      'theme_dollar_strength_regimes',
      'theme_ai_infrastructure_buildout',
    ],
  },

  XLI: {
    name: 'Industrials',
    regimeTag: 'Cycle',
    leadLag: 'Tracks copper and global PMIs; leads early-cycle, lags late-cycle',
    body: 'Industrials are the barometer of the physical economy and capital expenditure cycle. The sector tracks copper closely — a healthy XLI/CPER correlation means manufacturing demand is real, not just narrative. The traditional "rate-sensitive cyclical" frame is breaking down as AI-infrastructure capex (grids, cooling, electrical) re-rates names like Eaton and GE Vernova into growth stocks; watch the dollar for the international revenue translation that still drives 40-60% of conglomerate earnings.',
    linkedThemes: [
      'theme_reshoring',
      'theme_ai_infrastructure_buildout',
      'theme_energy_transition',
      'theme_dollar_strength_regimes',
    ],
  },

  XLY: {
    name: 'Consumer Discretionary',
    regimeTag: 'Risk-On',
    leadLag: 'High-beta proxy for liquidity and consumer credit',
    body: 'Discretionary leads when consumer credit is cheap, the dollar is soft, and risk appetite is high. The sector has lengthened its duration dramatically as Amazon and Tesla have come to dominate the cap-weighted index — XLY now trades more like a tech proxy than a traditional cyclical, with valuations highly sensitive to real rates. Oil acts as a regressive tax: when energy prices spike, discretionary spending compresses fastest.',
    linkedThemes: [
      'theme_consumer_bifurcation',
      'theme_housing_cycle',
      'theme_dollar_strength_regimes',
    ],
  },

  XLP: {
    name: 'Consumer Staples',
    regimeTag: 'Defensive Bond Proxy',
    leadLag: 'Outperforms when yields fall and recession fears rise',
    body: 'Staples are the cleanest bond proxy in the equity market — stable dividends and inelastic demand make the sector trade on duration more than fundamentals. XLP outperforms when 10-year yields fall and risk appetite contracts; it lags when growth accelerates and capital rotates into cyclicals. Watch the dollar and input costs: staples giants like PG and KO derive 40%+ of revenue internationally, so currency translation and commodity inflation drive most of the margin variability.',
    linkedThemes: [
      'theme_consumer_bifurcation',
      'theme_dollar_strength_regimes',
      'theme_aging_demographics',
    ],
  },

  XLU: {
    name: 'Utilities',
    regimeTag: 'Rates Proxy → AI Power',
    leadLag: 'Leads when yields fall; now also leads on data-center power demand',
    body: 'Utilities have historically been the purest equity-duration play in the index — when 10-year yields fall, XLU rallies on dividend-yield arbitrage. The story is changing: AI-driven power demand has re-rated the sector from defensive bond proxy to growth-infrastructure, with merchant nuclear (CEG, VST) leading the move. Now XLU outperforms on both rate cuts and data-center capex, a regime that hasn’t existed in modern markets.',
    linkedThemes: [
      'theme_ai_infrastructure_buildout',
      'theme_energy_transition',
    ],
  },

  XLB: {
    name: 'Materials',
    regimeTag: 'Global Cycle → Strategic Materials',
    leadLag: 'Tracks copper and Chinese demand; broadening to uranium, rare earths, precious metals',
    body: 'Materials reflect the global industrial cycle in physical form. Copper remains the cleanest signal of manufacturing health, with China demand mediating roughly half of that relationship — but the sector is broadening: uranium and gold/silver have moved into primary relevance, and rare-earth plays like MP are becoming essential to advanced manufacturing and defense. XLB increasingly reflects which materials the next economy actually needs.',
    linkedThemes: [
      'theme_ai_infrastructure_buildout',
      'theme_energy_transition',
      'theme_reshoring',
      'theme_dollar_strength_regimes',
    ],
  },

  XLRE: {
    name: 'Real Estate',
    regimeTag: 'Rates + Credit',
    leadLag: 'Most rate-sensitive sector in the index; lags during tightening cycles',
    body: 'Real estate is the equity market’s purest interest-rate trade — REITs are legally required to distribute 90% of taxable income, so they compete directly with Treasuries for yield-seeking capital. When 10-year yields rise, cap rates expand and property valuations contract; the 2022-2024 correlation with rates was the strongest on record. Watch credit spreads alongside rates: REITs depend on the revolving door of debt markets, and widening spreads compound the rate damage.',
    linkedThemes: [
      'theme_housing_cycle',
      'theme_aging_demographics',
      'theme_ai_infrastructure_buildout',
    ],
  },

  XLC: {
    name: 'Communication Services',
    regimeTag: 'Concentrated Growth (Not Really Telecom)',
    leadLag: 'Tracks META and GOOGL more than macro; behaves like tech, not communications',
    body: 'Communication Services is the most misnamed sector in the index. Despite the "telecom" framing, XLC is functionally a 3-stock concentrated growth fund — META and the two classes of GOOGL are nearly half the weight, with telecom legacy names (T, VZ) playing a minority role. The sector behaves like long-duration tech: rate-sensitive, dollar-headwind-exposed via international ad-revenue, and increasingly correlated with Bitcoin as a high-beta liquidity proxy.',
    linkedThemes: [
      'theme_ai_infrastructure_buildout',
      'theme_dollar_strength_regimes',
      'theme_cybersecurity_buildout',
    ],
  },
};

/**
 * Returns the content block for a given sector ticker.
 * Returns null if ticker is not in our 11-sector universe.
 */
export function getSectorContent(ticker) {
  if (!ticker || typeof ticker !== 'string') return null;
  return SECTOR_CONTENT[ticker.toUpperCase()] || null;
}

/**
 * Returns all 11 sector tickers in canonical order.
 * Use this only when you need a deterministic ordering independent of
 * Firestore's displayOrder (e.g., for seed scripts or audits).
 * For UI display, read displayOrder from Firestore — it's the source of truth.
 */
export const CANONICAL_SECTOR_ORDER = [
  'XLK', 'XLV', 'XLF', 'XLE', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC',
];
