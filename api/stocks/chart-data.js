// Vercel Serverless Function — Chart Data (cached OHLCV for story charts)
//
// GET /api/stocks/chart-data?symbol=AAPL&days=90
//
// Three-layer cache:
//   L1: Vercel CDN edge (s-maxage=300, 5 min)
//   L2: In-memory Map on warm serverless instance (5 min)
//   L3: Firestore "marketDataCache" collection (4 hours)
// EODHD is only hit once per ticker per 4 hours.

import { applySecurityMiddleware } from '../_utils/security.js';
import { getFromCache, setInCache, setCacheHeaders } from '../_utils/serverCache.js';
import { normalizeSymbolForEODHD } from '../_utils/symbolNormalize.js';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const EODHD_BASE = 'https://eodhd.com/api';
const FIRESTORE_COLLECTION = 'marketDataCache';
const FIRESTORE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MEMORY_TTL_S = 300; // 5 minutes

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 60, windowMs: 60000 } })) {
    return;
  }

  const { symbol: rawSymbol, days: rawDays } = req.query;

  if (!rawSymbol) {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  const API_KEY = process.env.EODHD_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API not configured' });
  }

  const symbol = rawSymbol.toUpperCase().replace(/\.US$/, '');
  const days = Math.min(Math.max(parseInt(rawDays, 10) || 90, 1), 365);
  const memCacheKey = `chart_${symbol}_${days}d`;
  const firestoreDocKey = `${symbol}_chart_${days}d`;

  // L1: In-memory cache (survives warm instances)
  const memoryCached = getFromCache(memCacheKey);
  if (memoryCached) {
    setCacheHeaders(res, 300, 600);
    return res.status(200).json(memoryCached);
  }

  try {
    const db = getFirebaseAdmin();

    // L2: Firestore cache (persistent across cold starts)
    const doc = await db.collection(FIRESTORE_COLLECTION).doc(firestoreDocKey).get();
    if (doc.exists) {
      const cached = doc.data();
      const cachedAt = cached.cachedAt?.toDate ? cached.cachedAt.toDate() : new Date(cached.cachedAt);
      const age = Date.now() - cachedAt.getTime();

      if (age < FIRESTORE_TTL_MS) {
        const response = { success: true, symbol, count: cached.data.length, data: cached.data };
        setInCache(memCacheKey, response, MEMORY_TTL_S);
        setCacheHeaders(res, 300, 600);
        return res.status(200).json(response);
      }
    }

    // L3: Fetch from EODHD (cache miss)
    const from = getDateDaysAgo(days);
    const normalizedSymbol = normalizeSymbolForEODHD(symbol);
    const url = `${EODHD_BASE}/eod/${normalizedSymbol}.US?api_token=${API_KEY}&fmt=json&period=d&order=d&from=${from}`;

    console.log(`[chart-data] Fetching ${days}d OHLCV for ${symbol}`);
    const eohdResponse = await fetch(url);

    if (!eohdResponse.ok) {
      console.error(`[chart-data] EODHD error ${eohdResponse.status} for ${symbol}`);
      return res.status(502).json({ success: false, error: 'EODHD API error' });
    }

    const raw = await eohdResponse.json();
    if (!Array.isArray(raw) || raw.length === 0) {
      return res.status(200).json({ success: true, symbol, count: 0, data: [] });
    }

    const data = raw.map(d => ({
      date: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.adjusted_close || d.close,
      volume: d.volume,
    }));

    // Write to Firestore L2
    await db.collection(FIRESTORE_COLLECTION).doc(firestoreDocKey).set({
      data,
      cachedAt: new Date(),
      ttlType: 'chart',
      ttlMs: FIRESTORE_TTL_MS,
      expiresAt: new Date(Date.now() + FIRESTORE_TTL_MS),
    }).catch(err => console.error(`[chart-data] Firestore write error:`, err.message));

    const response = { success: true, symbol, count: data.length, data };

    // Write to L1 memory
    setInCache(memCacheKey, response, MEMORY_TTL_S);

    // Set CDN headers (L0)
    setCacheHeaders(res, 300, 600);
    return res.status(200).json(response);
  } catch (err) {
    console.error(`[chart-data] Error for ${symbol}:`, err.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch chart data' });
  }
}
