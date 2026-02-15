// api/health.js — Lightweight health check endpoint for monitoring
// GET /api/health → JSON status report with service checks
//
// Checks: EODHD API, Firebase Firestore, Claude API key, memory cache
// Each external check has a 3-second timeout via AbortController

import { applySecurityMiddleware } from './_utils/security.js';
import { setCacheHeaders, getCacheSize } from './_utils/serverCache.js';

const CHECK_TIMEOUT_MS = 3000;

// ==================== INDIVIDUAL CHECKS ====================

async function checkEodhd() {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    return { status: 'missing', note: 'EODHD_API_KEY not configured' };
  }

  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const url = `https://eodhd.com/api/real-time/AAPL.US?api_token=${apiKey}&fmt=json`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      return { status: 'error', latency: Date.now() - start, note: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const hasPrice = data?.close > 0 || data?.previousClose > 0;

    return {
      status: hasPrice ? 'ok' : 'error',
      latency: Date.now() - start,
      note: 'AAPL price check',
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { status: 'timeout', latency: Date.now() - start, note: 'Exceeded 3s timeout' };
    }
    return { status: 'error', latency: Date.now() - start, note: 'Connection failed' };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkFirebase() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return { status: 'missing', note: 'Firebase Admin env vars not configured' };
  }

  const start = Date.now();

  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    }

    const db = getFirestore();

    // Read one document from economicCalendar with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS)
    );
    const queryPromise = db.collection('economicCalendar').limit(1).get();

    const snapshot = await Promise.race([queryPromise, timeoutPromise]);

    return {
      status: 'ok',
      latency: Date.now() - start,
      note: `Read economicCalendar (${snapshot.size} doc${snapshot.size !== 1 ? 's' : ''})`,
    };
  } catch (err) {
    if (err.message === 'timeout') {
      return { status: 'timeout', latency: Date.now() - start, note: 'Exceeded 3s timeout' };
    }
    return { status: 'error', latency: Date.now() - start, note: 'Firestore read failed' };
  }
}

function checkClaude() {
  const hasKey = !!process.env.CLAUDE_API_KEY;
  return {
    status: hasKey ? 'ok' : 'missing',
    note: hasKey ? 'API key present' : 'CLAUDE_API_KEY not configured',
  };
}

function checkCache() {
  return {
    memoryEntries: getCacheSize(),
    maxEntries: 500,
  };
}

// ==================== HANDLER ====================

export default async function handler(req, res) {
  // Security middleware (CORS, headers, rate limit: 10/min)
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CDN cache for 30 seconds
  setCacheHeaders(res, 30);

  // Run external checks in parallel
  const [eodhdResult, firebaseResult] = await Promise.allSettled([
    checkEodhd(),
    checkFirebase(),
  ]);

  const checks = {
    eodhd: eodhdResult.status === 'fulfilled' ? eodhdResult.value : { status: 'error', note: 'Check threw unexpectedly' },
    firebase: firebaseResult.status === 'fulfilled' ? firebaseResult.value : { status: 'error', note: 'Check threw unexpectedly' },
    claude: checkClaude(),
    cache: checkCache(),
  };

  // Determine overall status
  const checkStatuses = [checks.eodhd.status, checks.firebase.status, checks.claude.status];
  const allOk = checkStatuses.every(s => s === 'ok');

  return res.status(200).json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    environment: {
      region: process.env.VERCEL_REGION || 'unknown',
      nodeVersion: process.versions.node,
    },
  });
}
