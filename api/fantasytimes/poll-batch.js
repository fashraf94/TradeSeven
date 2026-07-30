// api/fantasytimes/poll-batch.js
// Batch completion poller — checks fantasyTimesBatches for completed batches,
// retrieves results from Anthropic, writes stories to Firestore.
// Must complete in <10 seconds. No loops, no waiting.

import { wireBatchRetrieve, wireBatchResults } from '../_utils/wireModelCall.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { REPORTER_PROFILES } from '../_utils/fantasyTimesPrompts.js';
import { getDefaultVisual, shouldOverrideVisual, callArtDirector } from '../_utils/fantasyTimesVisuals.js';
import { getWireFlags } from '../_utils/wireFlags.js';
import { resolveWireMarketDate } from '../_utils/wireCalendar.js';
import { publishStoryWithWire } from '../_utils/wireWriteThrough.js';
import { recordWireSample } from '../_utils/wireMetrics.js';

export const config = { maxDuration: 10 };

const LOG_PREFIX = '[FantasyTimes:Doug:PollBatch]';

function logInfo(msg, data = null) {
  const ts = new Date().toISOString();
  console.log(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

function logError(msg, data = null) {
  const ts = new Date().toISOString();
  console.error(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 20, windowMs: 60000 } })) {
    return;
  }

  // --- Cron/Admin Authentication ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!process.env.CLAUDE_API_KEY) {
    return res.status(500).json({ success: false, error: 'AI service not configured' });
  }

  try {
    const db = getFirebaseAdmin();
    logInfo('Checking for pending batches...');

    // Query for processing batches
    const pendingQuery = await db
      .collection('fantasyTimesBatches')
      .where('status', '==', 'processing')
      .limit(5)
      .get();

    if (pendingQuery.empty) {
      logInfo('No pending batches');
      return res.status(200).json({ success: true, message: 'No pending batches' });
    }

    const results = [];

    for (const batchDoc of pendingQuery.docs) {
      const batchData = batchDoc.data();
      const batchId = batchData.batchId;
      logInfo(`Checking batch ${batchId}...`);

      try {
        // Check batch status with Anthropic (retrieval rides the wireModelCall
        // module so the P2-48 sole-importer invariant holds carve-out-free)
        const batchStatus = await wireBatchRetrieve(batchId);

        if (batchStatus.processing_status !== 'ended') {
          logInfo(`Batch ${batchId} still ${batchStatus.processing_status}, skipping`);
          results.push({ batchId, status: batchStatus.processing_status });
          continue;
        }

        logInfo(`Batch ${batchId} ended, processing results...`);

        // Stream results
        let storiesCreated = 0;
        let failures = 0;
        const errors = [];

        // N6 TDZ fix (P2-43, founder-authorized V1.3 §0): this stream was
        // `const results`, shadowing the accumulator at :66 — the status
        // push above then sat in its temporal dead zone (ReferenceError)
        // and the summary push below hit the stream instead (TypeError),
        // so every poll response reported errors. The adjudicating test
        // (pollBatch.handler.test.js) settled the review-vs-discovery
        // contradiction by experiment: observability-only — stories and
        // batch-doc updates always landed; only the response lied.
        const batchResults = await wireBatchResults(batchId);
        for await (const result of batchResults) {
          if (result.result.type === 'succeeded') {
            try {
              const toolBlock = result.result.message.content.find(
                (block) => block.type === 'tool_use'
              );
              if (!toolBlock || !toolBlock.input) {
                errors.push(`${result.custom_id}: No tool_use block`);
                failures++;
                continue;
              }

              const storyData = toolBlock.input;

              // Parse custom_id: earnings_preview_SYMBOL_DATE
              const parts = result.custom_id.split('_');
              const symbol = parts[2] || '';
              const reportDate = parts.slice(3).join('-') || '';

              const today = new Date().toISOString().slice(0, 10);
              if (reportDate < today) {
                logInfo(`Skipping stale preview ${result.custom_id} — report date ${reportDate} already passed`);
                continue;
              }

              const now = new Date();
              const expiresAt = new Date(
                now.getTime() + REPORTER_PROFILES.doug.expiryHours * 60 * 60 * 1000
              );

              const storyDoc = {
                reporter: 'doug',
                reporterName: REPORTER_PROFILES.doug.name,
                reporterBeat: REPORTER_PROFILES.doug.beat,
                type: 'earnings_preview',
                headline: String(storyData.headline || '').slice(0, 120),
                subheadline: String(storyData.subheadline || '').slice(0, 200),
                body: String(storyData.body || ''),
                tickers: [symbol],
                primaryTicker: symbol,
                sector: 'Earnings',
                themes: Array.isArray(storyData.themes) ? storyData.themes : [],
                sentiment: storyData.sentiment || 'neutral',
                urgency: 'timely',
                recommended_action: storyData.recommended_action || 'EARNINGSGAME',
                dataSnapshot: {
                  symbol,
                  reportDate,
                  epsEstimate: storyData.epsEstimate || null,
                  revenueEstimate: storyData.revenueEstimate || null,
                },
                newsContext: [],
                generatedBy: 'claude-sonnet-4-6',
                batchId: batchId,
                publishedAt: now,
                expiresAt: expiresAt,
                status: 'published',
              };

              // Stamp visual fields
              const { visualType, visualConfig } = getDefaultVisual(
                storyDoc.reporter, storyDoc.type, storyDoc.dataSnapshot, storyDoc.primaryTicker
              );
              storyDoc.visualType = visualType;
              storyDoc.visualConfig = visualConfig;

              // ── FantasyTimes Wire (Spec V1.5 §4.5/§4.7) ──────────────
              // Doug's DEFERRED path: this 10-second lambda stamps
              // story + envelope + wirePending via one batch and NEVER
              // transacts inline — the replay sweep lands the Wire
              // artifacts (≤15 min typical). marketDate comes from the
              // batch doc, stamped at submit (immutable across the async
              // boundary); fallbacks derive from submittedAt, then now.
              const wirePublishT0 = Date.now();
              const wireFlags = getWireFlags();
              // FLAG-STRADDLE GUARD: a batch submitted while writes were OFF
              // carries no agentFacts in its tool schema, so running the Wire
              // path over its results would reject every in-flight preview as
              // R4_MISSING and pollute the §6.1 gate for up to 24h after the
              // flip. `wireMarketDate` is written only when writes were on at
              // SUBMIT time, so its absence is exactly that signal.
              const submittedUnderWire = Boolean(batchData.wireMarketDate);
              // N0 (R4-B1): SUBMIT-time provenance read back off the batch
              // doc — never re-derived at poll. Absent on pre-N0 batch docs
              // (the straddle) -> nulls -> publishStoryWithWire falls back
              // to current constants, mirroring the wireMarketDate fallback.
              const wireGenerationConfig = batchData.wireGenerationConfig ?? null;
              const wireSchemaVersion = batchData.wireSchemaVersion ?? null;
              const wireMarketDate =
                batchData.wireMarketDate ||
                resolveWireMarketDate(batchData.submittedAt?.toDate?.() || batchData.submittedAt || new Date());
              if (wireFlags.writesEnabled && !submittedUnderWire) {
                logInfo(`Batch ${batchId} predates the Wire flip — publishing without the Wire path`);
              }
              const { storyRef: docRef } = submittedUnderWire
                ? await publishStoryWithWire(db, {
                  storyDoc,
                  rawAgentFacts: wireFlags.writesEnabled ? storyData.agentFacts : null,
                  stopReason: result.result.message.stop_reason || null,
                  reporter: 'doug',
                  seam: 'doug_earnings_preview',
                  primaryTicker: symbol,
                  triggerRef: `${symbol}:${reportDate}`,
                  marketDate: wireMarketDate,
                  generationConfig: wireGenerationConfig,
                  generationSchemaVersion: wireSchemaVersion,
                  deferTransaction: true,
                })
                : { storyRef: await db.collection('fantasyTimesStories').add(storyDoc) };
              storiesCreated++;
              logInfo(`Created preview for ${symbol}`, { headline: storyDoc.headline });

              // The deferred seam's generate_publish sample lives HERE — the
              // submit endpoint only enqueues. Fire-and-forget is forbidden
              // (BUILD_RULES §5), so it is awaited; recordWireSample contains
              // its own failures and never throws into the 10s budget.
              if (wireFlags.metricsEnabled) {
                await recordWireSample(db, {
                  seam: 'doug_earnings_preview',
                  metric: 'generate_publish',
                  ms: Date.now() - wirePublishT0,
                  marketDate: wireMarketDate,
                });
              }

              // Art Director override for edge-case story types
              if (shouldOverrideVisual(storyDoc.reporter, storyDoc.type)) {
                await callArtDirector(storyDoc, docRef.id, db);
              }
            } catch (writeErr) {
              errors.push(`${result.custom_id}: Write failed - ${writeErr.message}`);
              failures++;
            }
          } else {
            errors.push(
              `${result.custom_id}: ${result.result.type} - ${result.result.error?.message || 'Unknown error'}`
            );
            failures++;
          }
        }

        // Update batch document
        const finalStatus = failures > 0 && storiesCreated > 0
          ? 'completed_with_errors'
          : failures > 0
            ? 'failed'
            : 'completed';

        await batchDoc.ref.update({
          status: finalStatus,
          completedAt: new Date(),
          errors: errors.length > 0 ? errors : null,
        });

        logInfo(`Batch ${batchId} processed`, { storiesCreated, failures, status: finalStatus });
        results.push({ batchId, status: finalStatus, storiesCreated, failures });
      } catch (batchErr) {
        logError(`Error processing batch ${batchId}`, { error: batchErr.message });
        results.push({ batchId, error: batchErr.message });
      }
    }

    return res.status(200).json({ success: true, batches: results });
  } catch (error) {
    logError('Poll-batch failed', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ success: false, error: 'Batch polling failed' });
  }
}
