/**
 * Batch Verification Endpoint
 * Processes verification queue in batches with rate limiting and backoff
 *
 * GET /api/earnings/verify-batch?batch=1&limit=5
 *
 * Designed to run as multiple daily cron jobs spread across the day
 */

import Anthropic from '@anthropic-ai/sdk';
import { applySecurityMiddleware } from '../_utils/security.js';
import { BATCH_CONFIG } from '../../src/config/earningsConfig.js';

// Import batch constants from centralized config
const { BACKOFF_DELAYS, QUARTERS_PER_ITERATION, DEFAULT_STOCKS_PER_BATCH } = BATCH_CONFIG;

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
  // Security middleware - lower rate limit for cron
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { batch = 1, limit = DEFAULT_STOCKS_PER_BATCH } = req.query;

  // Auth check for cron
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isTestMode = req.query.testMode === 'true';

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (!isVercelCron && !isTestMode) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!process.env.CLAUDE_API_KEY) {
    console.error('[verify-batch] CLAUDE_API_KEY not configured');
    return res.status(500).json({ error: 'Claude API key not configured' });
  }

  try {
    console.log(`[verify-batch] Starting batch ${batch} with limit ${limit}`);

    const db = await getFirestore();
    const anthropic = getAnthropicClient();

    // Step 1: Get stocks from queue, prioritized by score and status
    // Process partial first (resume), then pending
    const stocksToVerify = [];

    // First, get partial verifications (in-progress)
    const partialSnapshot = await db.collection('verificationQueue')
      .where('status', 'in', ['partial', 'in_progress'])
      .orderBy('priority', 'desc')
      .limit(parseInt(limit))
      .get();

    partialSnapshot.forEach(doc => {
      stocksToVerify.push({ id: doc.id, ...doc.data() });
    });

    // Fill remaining slots with pending
    const remainingSlots = parseInt(limit) - stocksToVerify.length;
    if (remainingSlots > 0) {
      const pendingSnapshot = await db.collection('verificationQueue')
        .where('status', '==', 'pending')
        .orderBy('priority', 'desc')
        .limit(remainingSlots)
        .get();

      pendingSnapshot.forEach(doc => {
        stocksToVerify.push({ id: doc.id, ...doc.data() });
      });
    }

    if (stocksToVerify.length === 0) {
      console.log('[verify-batch] No stocks to verify in queue');
      return res.status(200).json({
        success: true,
        processed: 0,
        message: 'Queue is empty',
        nextBatch: null
      });
    }

    console.log(`[verify-batch] Processing ${stocksToVerify.length} stocks:`,
      stocksToVerify.map(s => `${s.symbol}(${s.quartersVerified}/${s.quartersTotal})`));

    // Step 2: Process each stock
    const results = [];
    let backoffLevel = 0;

    for (const queueEntry of stocksToVerify) {
      const symbol = queueEntry.symbol;
      const startQuarter = queueEntry.quartersVerified || 0;

      try {
        // Mark as in_progress
        await db.collection('verificationQueue').doc(symbol).update({
          status: 'in_progress',
          lastAttempt: new Date().toISOString()
        });

        // Get EODHD data for this stock
        const eodhResponse = await fetch(
          `${getBaseUrl(req)}/api/stocks/earnings-history?symbol=${symbol}`
        );
        const eodhData = await eodhResponse.json();

        if (!eodhData.success || !eodhData.data?.reactions) {
          console.warn(`[verify-batch] ${symbol}: No EODHD data available`);
          await db.collection('verificationQueue').doc(symbol).update({
            status: 'failed',
            errors: [...(queueEntry.errors || []), {
              error: 'No EODHD data',
              timestamp: new Date().toISOString()
            }]
          });
          results.push({ symbol, status: 'failed', reason: 'no_eodhd_data' });
          continue;
        }

        const eodhReactions = eodhData.data.reactions.slice(0, 12);
        const quartersToVerify = eodhReactions.slice(
          startQuarter,
          Math.min(startQuarter + QUARTERS_PER_ITERATION, eodhReactions.length)
        );

        console.log(`[verify-batch] ${symbol}: Verifying quarters ${startQuarter + 1} to ${startQuarter + quartersToVerify.length}`);

        // Get existing verified quarters (if resuming)
        let verifiedQuarters = [];
        const existingVerification = await db.collection('earningsVerification').doc(symbol).get();
        if (existingVerification.exists && existingVerification.data().quarters) {
          verifiedQuarters = existingVerification.data().quarters.slice(0, startQuarter);
        }

        // Verify each quarter with backoff
        for (const quarter of quartersToVerify) {
          const verification = await verifyQuarterWithBackoff(
            symbol,
            quarter,
            anthropic,
            backoffLevel,
            (newLevel) => { backoffLevel = newLevel; }
          );
          verifiedQuarters.push(verification);

          // Apply delay between calls
          await sleep(BACKOFF_DELAYS[backoffLevel]);
        }

        // Update queue and cache
        const newQuartersVerified = verifiedQuarters.length;
        const isComplete = newQuartersVerified >= eodhReactions.length;

        // Calculate stats
        const mismatches = verifiedQuarters.filter(q => q.mismatch).length;
        const verificationResult = {
          symbol,
          verifiedAt: new Date().toISOString(),
          quartersVerified: newQuartersVerified,
          quartersTotal: eodhReactions.length,
          mismatches,
          quarters: verifiedQuarters,
          summary: {
            eodhBeatRate: calculateBeatRate(eodhReactions, 'eodh'),
            verifiedBeatRate: calculateBeatRate(verifiedQuarters, 'verified'),
            beatRateMatch: Math.abs(
              calculateBeatRate(eodhReactions, 'eodh') -
              calculateBeatRate(verifiedQuarters, 'verified')
            ) < 5
          }
        };

        // Save verification to cache
        await db.collection('earningsVerification').doc(symbol).set(verificationResult, { merge: true });

        // Update queue status
        await db.collection('verificationQueue').doc(symbol).update({
          status: isComplete ? 'complete' : 'partial',
          quartersVerified: newQuartersVerified,
          lastAttempt: new Date().toISOString(),
          nextAttempt: isComplete ? null : new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
        });

        results.push({
          symbol,
          status: isComplete ? 'complete' : 'partial',
          quartersVerified: newQuartersVerified,
          quartersTotal: eodhReactions.length,
          mismatches
        });

        console.log(`[verify-batch] ${symbol}: ${isComplete ? 'Complete' : 'Partial'} - ` +
          `${newQuartersVerified}/${eodhReactions.length} quarters, ${mismatches} mismatches`);

      } catch (error) {
        console.error(`[verify-batch] ${symbol}: Error - ${error.message}`);

        // Update queue with error
        await db.collection('verificationQueue').doc(symbol).update({
          status: 'failed',
          errors: [...(queueEntry.errors || []).slice(-4), {
            error: error.message?.substring(0, 200) || 'Unknown error',
            timestamp: new Date().toISOString()
          }]
        });

        results.push({ symbol, status: 'failed', reason: error.message });
      }
    }

    // Step 3: Calculate next batch time
    const now = new Date();
    const nextBatchTime = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours

    // Get remaining queue stats
    const remainingPending = await db.collection('verificationQueue')
      .where('status', '==', 'pending')
      .count()
      .get();

    const remainingPartial = await db.collection('verificationQueue')
      .where('status', 'in', ['partial', 'in_progress'])
      .count()
      .get();

    const summary = {
      batch: parseInt(batch),
      processed: results.length,
      complete: results.filter(r => r.status === 'complete').length,
      partial: results.filter(r => r.status === 'partial').length,
      failed: results.filter(r => r.status === 'failed').length,
      queueRemaining: {
        pending: remainingPending.data().count,
        partial: remainingPartial.data().count
      }
    };

    console.log(`[verify-batch] Batch ${batch} complete:`, summary);

    return res.status(200).json({
      success: true,
      summary,
      results,
      nextBatch: nextBatchTime.toISOString(),
      completedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('[verify-batch] Batch failed:', error);
    return res.status(500).json({
      error: 'Batch verification failed',
      message: error.message
    });
  }
}

/**
 * Verify a single quarter with exponential backoff on rate limits
 */
async function verifyQuarterWithBackoff(symbol, quarter, anthropic, currentBackoff, setBackoff) {
  const { reportDate, epsActual, epsEstimate, surprisePercent, didBeat, fiscalQuarter, fiscalYear } = quarter;

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

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
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

      // Extract text from response
      let responseText = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }

      // Reduce backoff on success
      setBackoff(Math.max(0, currentBackoff - 1));

      // Parse response
      const webResult = parseVerificationResponse(responseText);

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
      attempts++;

      // Check for rate limit error
      if (error.message && (error.message.includes('rate_limit') || error.message.includes('429'))) {
        const newBackoff = Math.min(currentBackoff + 1, BACKOFF_DELAYS.length - 1);
        setBackoff(newBackoff);
        console.warn(`[verify-batch] ${symbol} ${quarterLabel}: Rate limited (attempt ${attempts}), backing off ${BACKOFF_DELAYS[newBackoff]}ms`);
        await sleep(BACKOFF_DELAYS[newBackoff]);
        continue;
      }

      // Other error
      if (attempts >= maxAttempts) {
        console.error(`[verify-batch] ${symbol} ${quarterLabel}: Failed after ${attempts} attempts - ${error.message}`);
        return {
          ...quarter,
          verified: false,
          verificationError: error.message?.substring(0, 200) || 'Unknown error',
          verifiedAt: new Date().toISOString()
        };
      }

      // Wait and retry
      await sleep(BACKOFF_DELAYS[Math.min(currentBackoff + 1, BACKOFF_DELAYS.length - 1)]);
    }
  }
}

/**
 * Parse verification response from Claude
 */
function parseVerificationResponse(responseText) {
  // Try to find JSON in the response
  const jsonMatch = responseText.match(/\{[\s\S]*?"beat_or_miss"[\s\S]*?\}/);

  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Fall through to natural language parsing
    }
  }

  // Fallback: Extract from natural language
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

  return {
    beat_or_miss: beatOrMiss,
    reported_eps: epsMatch ? parseFloat(epsMatch[1]) : null,
    consensus_estimate: estimateMatch ? parseFloat(estimateMatch[1]) : null,
    confidence: beatOrMiss !== 'unknown' ? 'medium' : 'low',
    source: 'web search (parsed)'
  };
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
 * Get base URL for internal API calls
 */
function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Firebase Admin initialization
 */
let firestoreInstance = null;

async function getFirestore() {
  if (firestoreInstance) return firestoreInstance;

  const { getFirestore: getFs } = await import('firebase-admin/firestore');
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

  firestoreInstance = getFs();
  return firestoreInstance;
}
