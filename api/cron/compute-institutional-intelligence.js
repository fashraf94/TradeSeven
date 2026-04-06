// api/cron/compute-institutional-intelligence.js
// Weekly cron: computes institutional intelligence for the full stock universe.
//
// Schedule: "0 1 * * 1" and "0 2 * * 1" (dual UTC hours for DST coverage)
// Runs Sunday ~9 PM ET. Idempotent — running twice overwrites the same Firestore docs.
//
// Cost: ~269 stocks x 10 API calls = ~2690 EODHD calls per run (cached after first run)
// Writes: ~269 per-stock docs + 1 aggregate doc = ~270 Firestore writes

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getCachedHolders } from '../_utils/marketDataCache.js';
import { ALL_TICKERS, TICKER_TO_SECTOR } from '../_utils/rankingConfig.js';
import {
  enrichHolder,
  computeSummary,
  getArchetype,
  generateStorylines,
  generateHeroHeadline,
  generateHeroInsights,
  computeSectorDrivers,
  generateSectorAnalysis,
  computeUnderTheRadar,
} from '../_utils/institutionalIntelligence.js';

const LOG_PREFIX = '[InstitutionalIntelligence]';

// ───────────────────────────────────────────────
// Logging
// ───────────────────────────────────────────────

function log(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.log(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.log(`${ts} ${LOG_PREFIX} ${message}`);
}

// ───────────────────────────────────────────────
// Firebase Admin
// ───────────────────────────────────────────────

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

// ───────────────────────────────────────────────
// Main Handler
// ───────────────────────────────────────────────

export default async function handler(req, res) {
  // Step 1 — Auth Check
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers['authorization'];
  const isSecretAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && !isSecretAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  log(`Starting institutional intelligence computation for ${ALL_TICKERS.length} stocks`);

  const db = getFirebaseAdmin();
  const results = { processed: 0, skipped: 0, errors: 0 };

  // Cross-stock aggregation accumulators
  const allInstitutions = {};      // institution name -> { stocksHeld, topPositions[] }
  const biggestBuys = [];
  const biggestSells = [];
  const sectorFlows = {};
  const strongAccumulation = [];
  const strongDistribution = [];
  const stockHoldingsMap = {};       // symbol -> { institutions, summary, sector }

  // Process each stock sequentially (avoid rate limiting)
  for (const symbol of ALL_TICKERS) {
    try {
      // Timeout guard: 110s max (Vercel 120s limit)
      if (Date.now() - startTime > 110000) {
        log(`Timeout approaching at ${results.processed} stocks. Stopping.`);
        break;
      }

      const holders = await getCachedHolders(symbol);

      if (!holders || (!holders.Institutions?.length && !holders.Funds?.length)) {
        log(`No holders data for ${symbol}, skipping`);
        results.skipped++;
        continue;
      }

      // Enrich holders
      const institutions = holders.Institutions.slice(0, 20).map(enrichHolder);
      const funds = holders.Funds.slice(0, 20).map(enrichHolder);

      // Compute summary
      const summary = computeSummary(holders.Institutions, holders.Funds);

      // Write per-stock document
      await db.collection('institutionalHoldings').doc(symbol).set({
        symbol,
        institutions,
        funds,
        summary,
        sector: TICKER_TO_SECTOR[symbol] || null,
        updatedAt: new Date(),
      });

      results.processed++;

      // Accumulate per-stock data for storyline generation
      stockHoldingsMap[symbol] = {
        institutions,
        summary,
        sector: TICKER_TO_SECTOR[symbol] || null,
      };

      // ── Accumulate cross-stock aggregations ──

      // Track institutions across stocks
      for (const inst of institutions) {
        if (inst.archetype === 'index_passive') continue;
        if (!allInstitutions[inst.name]) {
          allInstitutions[inst.name] = {
            name: inst.name,
            archetype: inst.archetype,
            stocksHeld: 0,
            positions: [],
          };
        }
        allInstitutions[inst.name].stocksHeld++;
        allInstitutions[inst.name].positions.push({
          symbol,
          totalAssetsPct: inst.totalAssetsPct,
          changePct: inst.changePct,
          signal: inst.signal,
        });
      }

      // Track biggest movers (by % change)
      for (const inst of institutions) {
        if (inst.archetype === 'index_passive') continue;
        // Data quality: skip extreme % changes (splits, entity errors)
        if (Math.abs(inst.changePct) > 999) continue;
        // Materiality: skip positions too small to be meaningful
        if (inst.totalAssetsPct < 0.5) continue;

        if (inst.changePct > 20) {
          biggestBuys.push({
            symbol,
            institution: inst.name,
            archetype: inst.archetype,
            changeShares: inst.change,
            changePct: inst.changePct,
          });
        }
        if (inst.changePct < -20) {
          biggestSells.push({
            symbol,
            institution: inst.name,
            archetype: inst.archetype,
            changeShares: inst.change,
            changePct: inst.changePct,
          });
        }
      }

      // Track sector flows
      const sector = TICKER_TO_SECTOR[symbol];
      if (sector) {
        if (!sectorFlows[sector]) {
          sectorFlows[sector] = { netBuyers: 0, netSellers: 0 };
        }
        if (summary.buyersCount > summary.sellersCount) {
          sectorFlows[sector].netBuyers++;
        } else if (summary.sellersCount > summary.buyersCount) {
          sectorFlows[sector].netSellers++;
        }
      }

      // Track conviction extremes
      if (summary.conviction === 'strong_accumulation') {
        strongAccumulation.push(symbol);
      }
      if (summary.conviction === 'strong_distribution') {
        strongDistribution.push(symbol);
      }

      // Small delay between stocks to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));

    } catch (err) {
      log(`Error processing ${symbol}: ${err.message}`);
      results.errors++;
    }
  }

  // ── Write aggregate document ──

  // Rank institutions by stock coverage
  const topInstitutions = Object.values(allInstitutions)
    .sort((a, b) => b.stocksHeld - a.stocksHeld)
    .slice(0, 20)
    .map(inst => ({
      name: inst.name,
      archetype: inst.archetype,
      stocksHeld: inst.stocksHeld,
      // Backward compat: array of symbol strings (used by frontend)
      topPositions: inst.positions.slice(0, 5).map(p => p.symbol),
      // Top 5 by portfolio weight (conviction), not insertion order
      topConviction: inst.positions
        .sort((a, b) => b.totalAssetsPct - a.totalAssetsPct)
        .slice(0, 5)
        .map(p => ({ symbol: p.symbol, weight: Math.round(p.totalAssetsPct * 100) / 100 })),
      // Biggest add and biggest cut
      biggestAdd: inst.positions
        .filter(p => p.changePct > 0 && p.changePct < 999)
        .sort((a, b) => b.changePct - a.changePct)[0] || null,
      biggestCut: inst.positions
        .filter(p => p.changePct < 0)
        .sort((a, b) => a.changePct - b.changePct)[0] || null,
    }));

  // Derive sector sentiment
  for (const [sector, flows] of Object.entries(sectorFlows)) {
    const total = flows.netBuyers + flows.netSellers;
    if (total === 0) {
      flows.sentiment = 'neutral';
    } else if (flows.netBuyers / total >= 0.65) {
      flows.sentiment = 'bullish';
    } else if (flows.netSellers / total >= 0.65) {
      flows.sentiment = 'bearish';
    } else {
      flows.sentiment = 'neutral';
    }
  }

  // Generate narrative and driver fields from accumulated data
  const storylines = generateStorylines(stockHoldingsMap);
  const heroHeadline = generateHeroHeadline(sectorFlows);
  const sectorDrivers = computeSectorDrivers(stockHoldingsMap);

  // NEW: Multiple hero insights (replaces single heroHeadline for frontend v2)
  const heroInsights = generateHeroInsights({
    sectorFlows,
    strongAccumulation,
    strongDistribution,
    storylines,
    topInstitutions: Object.values(allInstitutions)
      .sort((a, b) => b.stocksHeld - a.stocksHeld)
      .slice(0, 20),
    stocksProcessed: results.processed,
  });

  // NEW: Sector analysis text
  const sectorAnalysis = generateSectorAnalysis(sectorFlows, sectorDrivers);

  // NEW: Under the radar stocks
  const underTheRadar = computeUnderTheRadar(stockHoldingsMap);

  // NEW: Pre-computed institution portfolios (top 20 only)
  const institutionPortfolios = {};
  for (const [name, inst] of Object.entries(allInstitutions)) {
    const isTop20 = topInstitutions.some(t => t.name === name);
    if (!isTop20) continue;

    institutionPortfolios[name] = {
      archetype: inst.archetype,
      stocksHeld: inst.stocksHeld,
      positions: inst.positions
        .sort((a, b) => b.totalAssetsPct - a.totalAssetsPct)
        .map(p => ({
          symbol: p.symbol,
          weight: Math.round(p.totalAssetsPct * 100) / 100,
          changePct: Math.round(p.changePct * 100) / 100,
          signal: p.signal,
        })),
    };
  }

  await db.collection('institutionalAggregates').doc('latest').set({
    updatedAt: new Date(),
    topInstitutions,
    biggestBuys: biggestBuys
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 15),
    biggestSells: biggestSells
      .sort((a, b) => a.changePct - b.changePct)
      .slice(0, 15),
    strongAccumulation,
    strongDistribution,
    sectorFlows,
    storylines,
    heroHeadline,
    sectorDrivers,
    heroInsights,
    sectorAnalysis,
    underTheRadar,
    institutionPortfolios,
    stocksProcessed: results.processed,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`Complete: ${results.processed} processed, ${results.skipped} skipped, ${results.errors} errors in ${elapsed}s`);

  return res.status(200).json({
    success: true,
    ...results,
    elapsed: `${elapsed}s`,
  });
}

export const config = {
  maxDuration: 120, // 2 minutes for ~269 stocks
};
