/**
 * Validated Catalyst Cache
 *
 * Cross-validates Sonar against EODHD headlines before accepting a catalyst.
 * Caches validated catalysts in Firestore keyed by date (expires at midnight ET).
 * Both Alex (generate-mover) and the Why button read from this shared cache.
 *
 * Flow:
 *   1. getValidatedCatalyst(symbol)          — check cache first
 *   2. validateAndCacheCatalyst(symbol, ...)  — run dual-source validation + cache
 *   3. flushExpiredCatalysts()                — pre-market cleanup
 */

import { getFirebaseAdmin } from './firebaseAdmin.js';
import { fetchTickerCatalysts } from './sonarCatalystFetch.js';

const LOG_PREFIX = '[ValidatedCatalyst]';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to',
  'for', 'of', 'and', 'or', 'but', 'with', 'by', 'from', 'as', 'its',
  'that', 'this', 'has', 'had', 'have', 'will', 'be', 'been', 'stock',
  'stocks', 'shares', 'today', 'after', 'says', 'report', 'reports',
  'new', 'could', 'may', 'also', 'about', 'more', 'than', 'into',
  // Question words: EODHD mover headlines are dominated by "Why X Stock Is …"
  // phrasing and our own catalyst query (sonarCatalystFetch.js) is "Why is …
  // today?" — so these recur >=3x and the dominant-keyword gate latches onto
  // them, computing confidence off pure filler (Aug 10 "keyword=why" defect).
  'why', 'how', 'what', 'when', 'where', 'who', 'which', 'whose',
  // Generic price-motion fillers: describe the move we already know about,
  // never the catalyst.
  'moving', 'move', 'moves', 'moved', 'higher', 'lower', 'down',
]);

// ─── Keyword extraction ─────────────────────────────────────────────────────

// Exported so the stopword contract is directly testable (A6 C3).
export function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function buildFrequencyMap(keywords) {
  const freq = {};
  for (const k of keywords) {
    freq[k] = (freq[k] || 0) + 1;
  }
  return freq;
}

// ─── Date helpers ───────────────────────────────────────────────────────────

function getTodayDateStr() {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayDateStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getMidnightET() {
  const now = new Date();
  // Determine ET offset: EDT (UTC-4) Mar–Nov, EST (UTC-5) Nov–Mar
  const month = now.getUTCMonth(); // 0-indexed
  const isDST = month >= 2 && month <= 10; // March (2) through November (10)
  const etOffsetHours = isDST ? 4 : 5;

  // Next midnight ET = next day 00:00 ET = next day at etOffsetHours UTC
  const midnight = new Date(now);
  midnight.setUTCHours(etOffsetHours, 0, 0, 0);
  // If we're already past midnight ET today, advance to tomorrow
  if (midnight <= now) {
    midnight.setUTCDate(midnight.getUTCDate() + 1);
  }
  return midnight;
}

// ─── EODHD direct fetch (for cross-validation, separate from fallback) ──────

async function fetchEodhdHeadlinesForValidation(symbol) {
  try {
    const url = `https://eodhd.com/api/news?s=${symbol}.US&limit=10&api_token=${process.env.EODHD_API_KEY}&fmt=json`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    const articles = (data || []).slice(0, 10);
    const fresh = articles.filter(n => {
      const pubDate = n.date ? new Date(n.date).getTime() : 0;
      return pubDate >= cutoff;
    });
    return fresh.map(n => n.title || n.headline).filter(Boolean);
  } catch (e) {
    console.warn(`${LOG_PREFIX} EODHD validation fetch failed for ${symbol}:`, e.message);
    return [];
  }
}

// ─── Exported functions ─────────────────────────────────────────────────────

/**
 * Check the validated catalyst cache for a symbol (today's date).
 * @param {string} symbol - Ticker symbol (uppercase)
 * @returns {Promise<object|null>} Cached catalyst object or null
 */
export async function getValidatedCatalyst(symbol) {
  try {
    const db = getFirebaseAdmin();
    const dateStr = getTodayDateStr();
    const doc = await db.collection('validatedCatalysts').doc(dateStr).get();
    if (!doc.exists) return null;

    const entry = doc.data()?.catalysts?.[symbol.toUpperCase()];
    if (!entry) return null;

    console.log(`${LOG_PREFIX} Cache hit for ${symbol}: ${entry.source} (${entry.confidence})`);
    return entry;
  } catch (err) {
    console.warn(`${LOG_PREFIX} Cache read failed for ${symbol}:`, err.message);
    return null;
  }
}

/**
 * Run dual-source cross-validation and cache the result.
 *
 * 1. Fetch Sonar catalyst via fetchTickerCatalysts (Sonar primary, EODHD fallback)
 * 2. Fetch EODHD headlines directly (for cross-validation)
 * 3. Extract keywords from both, compute agreement score
 * 4. Cache validated result in Firestore
 *
 * @param {string} symbol
 * @param {string} companyName
 * @param {string} direction - "up" or "down"
 * @param {number} percentChange
 * @returns {Promise<{ catalyst: string, confidence: string, source: string, agreementScore: number, sonarKeywords: string[], headlineKeywords: {keyword: string, count: number}[] }>}
 */
export async function validateAndCacheCatalyst(symbol, companyName, direction, percentChange) {
  const upperSymbol = symbol.toUpperCase();

  // Step 1: Fetch both sources in parallel
  const [sonarResult, eodhdHeadlines] = await Promise.all([
    fetchTickerCatalysts(upperSymbol, companyName, percentChange, direction),
    fetchEodhdHeadlinesForValidation(upperSymbol),
  ]);

  const sonarText = sonarResult.catalysts || '';
  const sonarKeywords = extractKeywords(sonarText);

  // Step 2: Build keyword frequency map from EODHD headlines
  const headlineText = eodhdHeadlines.join(' ');
  const headlineKeywords = extractKeywords(headlineText);
  const headlineFreq = buildFrequencyMap(headlineKeywords);

  // Step 3: Compute agreement score
  const corroborated = sonarKeywords.filter(k => (headlineFreq[k] || 0) >= 2);
  const agreementScore = corroborated.length / Math.max(sonarKeywords.length, 1);

  // Step 4: Decision logic
  let catalyst;
  let confidence;
  let source;

  if (sonarText && agreementScore >= 0.3) {
    // Sonar narrative corroborated by EODHD headlines
    catalyst = sonarText;
    confidence = 'high';
    source = 'sonar_corroborated';
    console.log(`${LOG_PREFIX} ${upperSymbol}: Sonar corroborated (score=${agreementScore.toFixed(2)}, corroborated=[${corroborated.slice(0, 5).join(', ')}])`);
  } else {
    // Check if EODHD has a dominant keyword cluster
    const sortedFreq = Object.entries(headlineFreq).sort((a, b) => b[1] - a[1]);
    const dominantKeyword = sortedFreq.length > 0 && sortedFreq[0][1] >= 3 ? sortedFreq[0] : null;

    if (!sonarText && dominantKeyword) {
      // Sonar failed entirely, but EODHD has a clear signal — use top headline
      catalyst = eodhdHeadlines[0] || 'No specific catalyst identified.';
      confidence = 'medium';
      source = 'eodhd_dominant';
      console.log(`${LOG_PREFIX} ${upperSymbol}: EODHD dominant (keyword="${dominantKeyword[0]}", freq=${dominantKeyword[1]})`);
    } else if (sonarText) {
      // Sonar has content but low agreement — use it with low confidence
      catalyst = sonarText;
      confidence = 'low';
      source = 'sonar_uncorroborated';
      console.log(`${LOG_PREFIX} ${upperSymbol}: Sonar uncorroborated (score=${agreementScore.toFixed(2)})`);
    } else {
      // Neither source has useful data
      catalyst = 'No specific catalyst identified from available sources.';
      confidence = 'low';
      source = 'none';
      console.log(`${LOG_PREFIX} ${upperSymbol}: No catalyst data from either source`);
    }
  }

  // Step 5: Cache in Firestore
  const dateStr = getTodayDateStr();
  // Array-of-objects, NOT Object.entries() tuples: Firestore forbids an array
  // whose elements are themselves arrays ("invalid nested entity"), which
  // rejected the whole cache write and forced every mover to re-fetch uncached.
  const sortedHeadlineKeywords = Object.entries(headlineFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({ keyword, count }));

  const validatedEntry = {
    catalyst,
    confidence,
    source,
    agreementScore,
    sonarKeywords: sonarKeywords.slice(0, 10),
    headlineKeywords: sortedHeadlineKeywords,
    direction,
    percentChange,
    validatedAt: new Date().toISOString(),
    expiresAt: getMidnightET(),
  };

  try {
    const db = getFirebaseAdmin();
    await db.collection('validatedCatalysts').doc(dateStr).set({
      catalysts: { [upperSymbol]: validatedEntry },
    }, { merge: true });
    console.log(`${LOG_PREFIX} Cached ${upperSymbol} → ${source} (${confidence})`);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Cache write failed for ${upperSymbol}:`, err.message);
  }

  return validatedEntry;
}

/**
 * Delete yesterday's validated catalyst document from Firestore.
 * Called during pre-market warmup.
 */
export async function flushExpiredCatalysts() {
  try {
    const db = getFirebaseAdmin();
    const yesterday = getYesterdayDateStr();
    await db.collection('validatedCatalysts').doc(yesterday).delete();
    console.log(`${LOG_PREFIX} Flushed expired catalyst cache for ${yesterday}`);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Flush failed:`, err.message);
  }
}
