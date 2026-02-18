// api/_utils/supplyChainLookup.js
// Supply chain intelligence lookup utilities for the Stock Intelligence Agent.
// Imports static data from src/data/supplyChainIntelligence.js and provides
// fast lookup functions for prompt injection and API response enrichment.

import {
  COMPANY_INTELLIGENCE,
  INVESTMENT_THEMES,
  WHAT_IF_SCENARIOS,
  PRODUCT_TEARDOWNS,
  TICKER_TO_PRODUCTS,
} from '../../src/data/supplyChainIntelligence.js';

// ============================================
// EXPLICIT TICKER ALIAS MAP
// Maps alternate identifiers to canonical keys in COMPANY_INTELLIGENCE.
// Some companies don't have standard exchange tickers (e.g., SK Hynix is
// a Korean ADR without a clean US ticker). This map ensures they can be
// found by any reasonable identifier.
// ============================================

const TICKER_ALIASES = {
  // SK Hynix — no US ticker, stored as SK_HYNIX in COMPANY_INTELLIGENCE
  'SK HYNIX': 'SK_HYNIX',
  'SKHYNIX':  'SK_HYNIX',
  'SK-HYNIX': 'SK_HYNIX',
  '000660':   'SK_HYNIX',   // Korean stock code
  '000660.KS': 'SK_HYNIX',  // Yahoo Finance format

  // Foxconn — OTC ticker is obscure
  'FOXCONN':  'HNHPF',
  'HON HAI':  'HNHPF',
  'HONHAI':   'HNHPF',
  '2317.TW':  'HNHPF',      // Taiwan exchange ticker

  // Samsung — OTC ticker not commonly used
  'SAMSUNG':  'SSNLF',
  '005930':   'SSNLF',      // Korean stock code
  '005930.KS': 'SSNLF',

  // Common short names
  'TSMC':     'TSM',
  'QUALCOMM': 'QCOM',
  'BROADCOM': 'AVGO',
  'SKYWORKS': 'SWKS',
  'QORVO':    'QRVO',
  'CORNING':  'GLW',
  'APPLE':    'AAPL',
  'INTEL':    'INTC',
  'MICRON':   'MU',
  'MEDIATEK': '2454.TW',
  'SYNOPSYS': 'SNPS',
  'CADENCE':  'CDNS',
};

/**
 * Resolve a ticker string to its canonical key in COMPANY_INTELLIGENCE.
 * Tries: exact match → uppercase match → alias map → null
 */
function resolveTickerKey(ticker) {
  if (!ticker) return null;
  const upper = ticker.toUpperCase().trim();

  // Direct match
  if (COMPANY_INTELLIGENCE[upper]) return upper;

  // Alias lookup
  if (TICKER_ALIASES[upper]) return TICKER_ALIASES[upper];

  // Try with dots/dashes preserved (for foreign tickers like 2454.TW, 8035.T)
  if (COMPANY_INTELLIGENCE[ticker.trim()]) return ticker.trim();

  return null;
}

// ============================================
// THEME NAME → ID REVERSE MAP
// ============================================

const THEME_NAME_TO_ID = {};
for (const [id, theme] of Object.entries(INVESTMENT_THEMES)) {
  THEME_NAME_TO_ID[theme.name.toLowerCase()] = id;
  THEME_NAME_TO_ID[id.toLowerCase()] = id;
}

// ============================================
// SCENARIO NAME → ID REVERSE MAP
// ============================================

const SCENARIO_NAME_TO_ID = {};
for (const [id, scenario] of Object.entries(WHAT_IF_SCENARIOS)) {
  SCENARIO_NAME_TO_ID[scenario.name.toLowerCase()] = id;
  SCENARIO_NAME_TO_ID[id.toLowerCase()] = id;
}

// ============================================
// EXPORTS
// ============================================

/**
 * Get the full company intelligence object for a ticker.
 * Case-insensitive, supports aliases.
 * @param {string} ticker
 * @returns {object|null}
 */
export function getCompanyIntelligence(ticker) {
  const key = resolveTickerKey(ticker);
  return key ? COMPANY_INTELLIGENCE[key] : null;
}

/**
 * Get a formatted supply chain context string for prompt injection.
 * Kept under ~200 tokens for prompt efficiency.
 * @param {string} ticker
 * @returns {string|null}
 */
export function getSupplyChainContext(ticker) {
  const key = resolveTickerKey(ticker);
  if (!key) return null;

  const co = COMPANY_INTELLIGENCE[key];
  if (!co) return null;

  const lines = ['SUPPLY CHAIN INTELLIGENCE (Curated Data):'];

  // Company header
  const tierLabel = co.tier ? ` — Tier ${co.tier}` : '';
  const displayTicker = co.ticker || key;
  lines.push(`Company: ${co.shortName || co.name} (${displayTicker})${tierLabel}`);

  // Position + Moat
  if (co.position || co.moat) {
    const parts = [];
    if (co.position) parts.push(`Position: ${co.position.charAt(0).toUpperCase() + co.position.slice(1)}`);
    if (co.moat) parts.push(`Moat: ${co.moat}`);
    lines.push(parts.join(' | '));
  }

  // Products supplied (from reverse index)
  const products = TICKER_TO_PRODUCTS[key] || TICKER_TO_PRODUCTS[co.ticker];
  if (products && products.length > 0) {
    const productList = products.slice(0, 3).map(p => `${p.product} (${p.component})`).join(', ');
    lines.push(`Products Supplied: ${productList}`);
  }

  // Upstream suppliers (top 3 critical ones)
  if (co.upstreamSuppliers && co.upstreamSuppliers.length > 0) {
    const upList = co.upstreamSuppliers
      .filter(s => s.criticality === 'critical')
      .slice(0, 3)
      .map(s => `${s.ticker || 'N/A'} (${s.component} — ${s.criticality})`);
    if (upList.length > 0) lines.push(`Key Upstream: ${upList.join(', ')}`);
  }

  // Revenue concentration (top 3 customers)
  if (co.revenueConcentration && co.revenueConcentration.length > 0) {
    const topCustomers = co.revenueConcentration
      .filter(c => c.customer !== 'Other' && c.customer !== 'Calculated')
      .slice(0, 3)
      .map(c => `${c.customer} (${c.percentage}% revenue)`);
    if (topCustomers.length > 0) lines.push(`Key Downstream: ${topCustomers.join(', ')}`);
  } else if (co.downstreamNote) {
    lines.push(`Downstream: ${co.downstreamNote}`);
  }

  // Themes
  if (co.themes && co.themes.length > 0) {
    const themeNames = co.themes
      .map(t => INVESTMENT_THEMES[t]?.name || t)
      .slice(0, 4);
    lines.push(`Themes: ${themeNames.join(', ')}`);
  }

  // Vulnerabilities (top 2)
  if (co.vulnerabilities && co.vulnerabilities.length > 0) {
    lines.push(`Vulnerabilities: ${co.vulnerabilities.slice(0, 2).join(', ')}`);
  }

  // Scenario exposure (top 3)
  if (co.scenarioExposure && co.scenarioExposure.length > 0) {
    const scenarios = co.scenarioExposure
      .slice(0, 3)
      .map(s => {
        const scenario = WHAT_IF_SCENARIOS[s.scenarioId];
        const name = scenario?.name || s.scenarioId;
        return `${name} (${s.impact}${s.role === 'beneficiary' ? ', beneficiary' : ''})`;
      });
    lines.push(`Scenario Exposure: ${scenarios.join(', ')}`);
  }

  // Concentration risk
  if (co.concentrationNote) {
    lines.push(`Concentration Risk: ${co.concentrationRisk || 'unknown'} — ${co.concentrationNote}`);
  }

  return lines.join('\n');
}

/**
 * Get all companies associated with a theme.
 * @param {string} themeIdOrName — e.g., "ai_enabler" or "AI Enabler"
 * @returns {{ theme: object, companies: Array<{ticker: string, name: string, position: string}> } | null}
 */
export function getThemeCompanies(themeIdOrName) {
  if (!themeIdOrName) return null;

  const normalizedId = THEME_NAME_TO_ID[themeIdOrName.toLowerCase()]
    || themeIdOrName.toLowerCase().replace(/\s+/g, '_');

  const theme = INVESTMENT_THEMES[normalizedId];
  if (!theme) return null;

  // Gather companies from theme's company list
  const companies = [];
  for (const compKey of (theme.companies || [])) {
    const co = COMPANY_INTELLIGENCE[compKey];
    if (co) {
      companies.push({
        ticker: co.ticker || compKey,
        name: co.shortName || co.name,
        position: co.position || 'unknown',
      });
    }
  }

  // Also find companies that list this theme in their themes array
  for (const [key, co] of Object.entries(COMPANY_INTELLIGENCE)) {
    if (co.themes && co.themes.includes(normalizedId)) {
      const ticker = co.ticker || key;
      if (!companies.find(c => c.ticker === ticker)) {
        companies.push({
          ticker,
          name: co.shortName || co.name,
          position: co.position || 'unknown',
        });
      }
    }
  }

  return {
    theme: {
      name: theme.name,
      description: theme.description,
      investmentThesis: theme.investmentThesis,
    },
    companies,
  };
}

/**
 * Get the impact analysis for a what-if scenario.
 * @param {string} scenarioIdOrName — e.g., "taiwan-disruption" or "Taiwan Semiconductor Disruption"
 * @returns {{ scenario: object, affected: Array, beneficiaries: Array, implications: Array } | null}
 */
export function getScenarioImpact(scenarioIdOrName) {
  if (!scenarioIdOrName) return null;

  const normalizedId = SCENARIO_NAME_TO_ID[scenarioIdOrName.toLowerCase()]
    || scenarioIdOrName.toLowerCase().replace(/\s+/g, '-');

  const scenario = WHAT_IF_SCENARIOS[normalizedId];
  if (!scenario) return null;

  return {
    scenario: {
      name: scenario.name,
      description: scenario.description,
      probability: scenario.probability,
    },
    affected: scenario.affectedCompanies || [],
    beneficiaries: scenario.beneficiaries || [],
    implications: scenario.investmentImplications || [],
  };
}

/**
 * Get companies related to a given ticker through supply chain, themes, or products.
 * @param {string} ticker
 * @returns {Array<{ticker: string, name: string, relationship: string, via: string}>}
 */
export function getRelatedCompanies(ticker) {
  const key = resolveTickerKey(ticker);
  if (!key) return [];

  const co = COMPANY_INTELLIGENCE[key];
  if (!co) return [];

  const related = new Map(); // ticker → { ticker, name, relationship, via }
  const selfTicker = co.ticker || key;

  // (a) Upstream suppliers
  if (co.upstreamSuppliers) {
    for (const supplier of co.upstreamSuppliers) {
      if (supplier.ticker && supplier.ticker !== selfTicker) {
        related.set(supplier.ticker, {
          ticker: supplier.ticker,
          name: COMPANY_INTELLIGENCE[resolveTickerKey(supplier.ticker)]?.shortName || supplier.ticker,
          relationship: 'upstream supplier',
          via: supplier.component,
        });
      }
    }
  }

  // (b) Competitors
  if (co.competitors) {
    for (const comp of co.competitors) {
      if (comp.ticker && comp.ticker !== selfTicker && !related.has(comp.ticker)) {
        related.set(comp.ticker, {
          ticker: comp.ticker,
          name: COMPANY_INTELLIGENCE[resolveTickerKey(comp.ticker)]?.shortName || comp.ticker,
          relationship: 'competitor',
          via: comp.notes || comp.relationship,
        });
      }
    }
  }

  // (c) Same products — find other suppliers
  const myProducts = TICKER_TO_PRODUCTS[key] || TICKER_TO_PRODUCTS[co.ticker] || [];
  for (const prod of myProducts) {
    const teardown = PRODUCT_TEARDOWNS[prod.productId];
    if (!teardown) continue;
    for (const component of teardown.components) {
      const compTicker = component.supplierTicker;
      if (compTicker && compTicker !== selfTicker && !related.has(compTicker)) {
        related.set(compTicker, {
          ticker: compTicker,
          name: component.supplierName || compTicker,
          relationship: 'co-supplier',
          via: `Both supply ${teardown.name}`,
        });
      }
    }
  }

  // (d) Same themes — find other theme members
  if (co.themes) {
    for (const themeId of co.themes) {
      for (const [otherKey, otherCo] of Object.entries(COMPANY_INTELLIGENCE)) {
        const otherTicker = otherCo.ticker || otherKey;
        if (otherTicker === selfTicker || otherKey === key) continue;
        if (otherCo.themes && otherCo.themes.includes(themeId) && !related.has(otherTicker)) {
          const themeName = INVESTMENT_THEMES[themeId]?.name || themeId;
          related.set(otherTicker, {
            ticker: otherTicker,
            name: otherCo.shortName || otherCo.name,
            relationship: 'theme peer',
            via: `${themeName} theme`,
          });
        }
      }
    }
  }

  return Array.from(related.values());
}

/**
 * Check what supply chain data coverage exists for a ticker.
 * Used to populate meta.supplyChainCoverage in the API response.
 * @param {string} ticker
 * @returns {{ hasCompany: boolean, hasProducts: boolean, hasThemes: boolean, hasScenarios: boolean }}
 */
export function getSupplyChainCoverage(ticker) {
  const key = resolveTickerKey(ticker);
  if (!key) {
    return { hasCompany: false, hasProducts: false, hasThemes: false, hasScenarios: false };
  }

  const co = COMPANY_INTELLIGENCE[key];
  if (!co) {
    return { hasCompany: false, hasProducts: false, hasThemes: false, hasScenarios: false };
  }

  const products = TICKER_TO_PRODUCTS[key] || TICKER_TO_PRODUCTS[co.ticker] || [];

  return {
    hasCompany: true,
    hasProducts: products.length > 0,
    hasThemes: (co.themes && co.themes.length > 0) || false,
    hasScenarios: (co.scenarioExposure && co.scenarioExposure.length > 0) || false,
  };
}
