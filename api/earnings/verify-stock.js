/**
 * Earnings Verification Service
 * Uses Claude API with web search to verify EODHD earnings data
 *
 * GET /api/earnings/verify-stock?symbol=UAL&quarters=12
 *
 * Returns verified earnings data with confidence scores
 */

import Anthropic from '@anthropic-ai/sdk';
import { applySecurityMiddleware } from '../_utils/security.js';

// Initialize Anthropic client lazily
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });
  }
  return anthropicClient;
}

export default async function handler(req, res) {
  // Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol, quarters = 12, forceRefresh = false } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol required' });
  }

  if (!process.env.CLAUDE_API_KEY) {
    console.error('[verify-stock] CLAUDE_API_KEY not configured');
    return res.status(500).json({ error: 'Claude API key not configured' });
  }

  const upperSymbol = symbol.toUpperCase();

  try {
    console.log(`[verify-stock] Starting verification for ${upperSymbol}, ${quarters} quarters`);

    // Step 1: Check Firebase cache first
    const cached = await getCachedVerification(upperSymbol);
    if (cached && forceRefresh !== 'true') {
      const cachedQuarters = cached.quarters || [];
      const recentlyVerified = cachedQuarters.filter(q => {
        const verifiedAt = new Date(q.verifiedAt);
        const daysSinceVerification = (Date.now() - verifiedAt) / (1000 * 60 * 60 * 24);
        return daysSinceVerification < 30; // Cache valid for 30 days
      });

      if (recentlyVerified.length >= parseInt(quarters)) {
        console.log(`[verify-stock] ${upperSymbol}: Using cached verification (${recentlyVerified.length} quarters)`);
        return res.status(200).json({
          success: true,
          source: 'cache',
          data: cached
        });
      }
    }

    // Step 2: Fetch EODHD data for comparison
    const eodhResponse = await fetch(
      `${getBaseUrl(req)}/api/stocks/earnings-history?symbol=${upperSymbol}`
    );
    const eodhData = await eodhResponse.json();

    if (!eodhData.success || !eodhData.data?.reactions) {
      return res.status(404).json({
        error: 'Could not fetch EODHD data for comparison',
        eodhResponse: eodhData
      });
    }

    const eodhReactions = eodhData.data.reactions.slice(0, parseInt(quarters));

    // Step 3: Verify each quarter with Claude web search
    const verifiedQuarters = [];
    const mismatches = [];
    const anthropic = getAnthropicClient();

    for (const quarter of eodhReactions) {
      const verification = await verifyQuarterWithClaude(
        upperSymbol,
        quarter,
        anthropic
      );

      verifiedQuarters.push(verification);

      if (verification.mismatch) {
        mismatches.push(verification);
      }

      // Rate limiting - wait 2 seconds between calls to avoid rate limits
      await sleep(2000);
    }

    // Step 4: Build verified result
    const verifiedResult = {
      symbol: upperSymbol,
      verifiedAt: new Date().toISOString(),
      quartersVerified: verifiedQuarters.length,
      mismatches: mismatches.length,
      quarters: verifiedQuarters,
      summary: {
        eodhBeatRate: calculateBeatRate(eodhReactions, 'eodh'),
        verifiedBeatRate: calculateBeatRate(verifiedQuarters, 'verified'),
        beatRateMatch: Math.abs(
          calculateBeatRate(eodhReactions, 'eodh') -
          calculateBeatRate(verifiedQuarters, 'verified')
        ) < 5 // Within 5% is considered a match
      }
    };

    // Step 5: Cache in Firebase
    await cacheVerification(upperSymbol, verifiedResult);

    console.log(`[verify-stock] ${upperSymbol}: Verification complete. ` +
      `EODH: ${verifiedResult.summary.eodhBeatRate}%, ` +
      `Verified: ${verifiedResult.summary.verifiedBeatRate}%, ` +
      `Mismatches: ${mismatches.length}`);

    return res.status(200).json({
      success: true,
      source: 'fresh',
      data: verifiedResult
    });

  } catch (error) {
    console.error(`[verify-stock] Error verifying ${upperSymbol}:`, error);
    return res.status(500).json({
      error: 'Verification failed',
      message: error.message
    });
  }
}

/**
 * Verify a single quarter's earnings using Claude with web search
 */
async function verifyQuarterWithClaude(symbol, eodhQuarter, anthropic) {
  const { reportDate, epsActual, epsEstimate, surprisePercent, didBeat, fiscalQuarter, fiscalYear } = eodhQuarter;

  const quarterLabel = fiscalQuarter && fiscalYear
    ? `Q${fiscalQuarter} ${fiscalYear}`
    : reportDate;

  const prompt = `Search the web to verify this earnings report:

Company: ${symbol}
Quarter: ${quarterLabel}
Report Date: ${reportDate}

I need to verify:
1. Did ${symbol} BEAT or MISS earnings expectations for ${quarterLabel}?
2. What was the reported EPS (earnings per share)?
3. What was the consensus estimate EPS?

Please search for "${symbol} ${quarterLabel} earnings results" or "${symbol} earnings ${reportDate}" and provide:
- beat_or_miss: "beat" or "miss" or "meet" (exactly one of these words)
- reported_eps: the actual EPS number (just the number, e.g., 2.95)
- consensus_estimate: the expected EPS number (just the number, e.g., 3.08)
- confidence: "high", "medium", or "low" based on how many sources confirm this
- source: the primary source you found (e.g., "Reuters", "CNBC", "company press release")

Respond in this exact JSON format:
{
  "beat_or_miss": "beat",
  "reported_eps": 2.95,
  "consensus_estimate": 2.80,
  "confidence": "high",
  "source": "Reuters"
}

If you cannot find reliable information, respond with:
{
  "beat_or_miss": "unknown",
  "reported_eps": null,
  "consensus_estimate": null,
  "confidence": "none",
  "source": "not found"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search'
      }],
      messages: [{ role: 'user', content: prompt }]
    });

    // Extract text from response - handle different content block types
    let responseText = '';

    for (const block of response.content) {
      if (block.type === 'text') {
        responseText += block.text;
      }
    }

    console.log(`[verify-stock] ${symbol} ${quarterLabel}: Raw response length: ${responseText.length}`);

    // Try to find JSON in the response
    let webResult;

    // First try: Look for JSON block with beat_or_miss
    const jsonMatch = responseText.match(/\{[\s\S]*?"beat_or_miss"[\s\S]*?\}/);

    if (jsonMatch) {
      try {
        webResult = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.warn(`[verify-stock] ${symbol} ${quarterLabel}: JSON parse failed:`, parseError.message);
      }
    }

    // Fallback: Extract beat/miss from natural language
    if (!webResult) {
      const lowerText = responseText.toLowerCase();

      let beatOrMiss = 'unknown';
      if ((lowerText.includes('beat') && lowerText.includes('expectations')) ||
          (lowerText.includes('beat') && lowerText.includes('estimates')) ||
          lowerText.includes('topped') || lowerText.includes('exceeded')) {
        beatOrMiss = 'beat';
      } else if ((lowerText.includes('miss') && lowerText.includes('expectations')) ||
                 (lowerText.includes('miss') && lowerText.includes('estimates')) ||
                 lowerText.includes('fell short') || lowerText.includes('disappointed')) {
        beatOrMiss = 'miss';
      } else if (lowerText.includes('met expectations') || lowerText.includes('in line')) {
        beatOrMiss = 'meet';
      }

      // Try to extract EPS numbers
      const epsPattern = /\$?([\d.]+)\s*(?:eps|per share|actual)/i;
      const estimatePattern = /estimate[sd]?\s*(?:of|at|was)?\s*\$?([\d.]+)/i;

      const epsMatch = responseText.match(epsPattern);
      const estimateMatch = responseText.match(estimatePattern);

      webResult = {
        beat_or_miss: beatOrMiss,
        reported_eps: epsMatch ? parseFloat(epsMatch[1]) : null,
        consensus_estimate: estimateMatch ? parseFloat(estimateMatch[1]) : null,
        confidence: beatOrMiss !== 'unknown' ? 'medium' : 'low',
        source: 'web search (parsed)'
      };

      console.log(`[verify-stock] ${symbol} ${quarterLabel}: Fallback parsing - ${beatOrMiss}`);
    }

    // Compare with EODHD data
    const eodhSaysBeat = didBeat === true;
    const webSaysBeat = webResult.beat_or_miss === 'beat';
    const webSaysMiss = webResult.beat_or_miss === 'miss';

    const mismatch = (eodhSaysBeat && webSaysMiss) || (!eodhSaysBeat && webSaysBeat);

    return {
      reportDate,
      fiscalQuarter,
      fiscalYear,
      quarterLabel,
      eodh: {
        epsActual,
        epsEstimate,
        surprisePercent,
        didBeat
      },
      webSearch: {
        beatOrMiss: webResult.beat_or_miss,
        reportedEps: webResult.reported_eps,
        consensusEstimate: webResult.consensus_estimate,
        confidence: webResult.confidence,
        source: webResult.source
      },
      verified: {
        didBeat: webResult.beat_or_miss === 'beat',
        didMiss: webResult.beat_or_miss === 'miss',
        didMeet: webResult.beat_or_miss === 'meet',
        confidence: webResult.confidence
      },
      mismatch,
      mismatchDetails: mismatch ? {
        eodhSays: eodhSaysBeat ? 'BEAT' : 'MISS',
        webSays: webResult.beat_or_miss.toUpperCase(),
        eodhEstimate: epsEstimate,
        webEstimate: webResult.consensus_estimate
      } : null,
      verifiedAt: new Date().toISOString()
    };

  } catch (error) {
    // Check for rate limit error
    if (error.message && (error.message.includes('rate_limit') || error.message.includes('429'))) {
      console.warn(`[verify-stock] ${symbol} ${quarterLabel}: Rate limited, waiting 60 seconds...`);
      await sleep(60000); // Wait 60 seconds before continuing
    }

    console.error(`[verify-stock] ${symbol} ${quarterLabel}: Claude API error:`, error.message);
    return {
      ...eodhQuarter,
      verified: false,
      verificationError: error.message?.substring(0, 200) || 'Unknown error',
      verifiedAt: new Date().toISOString()
    };
  }
}

/**
 * Calculate beat rate from quarters array
 */
function calculateBeatRate(quarters, source) {
  if (!quarters || quarters.length === 0) return 0;

  let beats = 0;
  let total = 0;

  quarters.forEach(q => {
    if (source === 'eodh') {
      if (q.didBeat !== undefined) {
        total++;
        if (q.didBeat) beats++;
      }
    } else if (source === 'verified') {
      if (q.verified?.didBeat !== undefined || q.webSearch?.beatOrMiss) {
        total++;
        if (q.verified?.didBeat || q.webSearch?.beatOrMiss === 'beat') beats++;
      }
    }
  });

  return total > 0 ? Math.round((beats / total) * 100) : 0;
}

/**
 * Firebase cache functions
 */
async function getCachedVerification(symbol) {
  // Use Firebase Admin if available, otherwise return null
  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');

    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    const db = getFirestore();
    const doc = await db.collection('earningsVerification').doc(symbol).get();

    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.warn('[verify-stock] Firebase cache not available:', error.message);
    return null;
  }
}

async function cacheVerification(symbol, data) {
  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();

    await db.collection('earningsVerification').doc(symbol).set(data, { merge: true });
    console.log(`[verify-stock] Cached verification for ${symbol}`);
  } catch (error) {
    console.warn('[verify-stock] Failed to cache verification:', error.message);
  }
}

function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
