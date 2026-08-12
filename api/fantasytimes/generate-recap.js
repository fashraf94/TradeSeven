// api/fantasytimes/generate-recap.js
// Doug's Earnings Recap — generates quick recaps after earnings results drop.
// Cron: four evening firings (20-23 UTC, the after-hours window) plus ONE
// morning firing (~13:00 UTC, pre-market ET) that recaps the prior ET
// session's AMC reports once their actuals post (Recap Restoration R-B2 —
// the fifth firing was re-aimed from 0 UTC, whose UTC-date query hit the
// wrong trading day).

import { getGenerationConfig } from '../_utils/wireGenerationConfig.js';
import { wireModelCall } from '../_utils/wireModelCall.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { isMarketHolidayToday } from '../_utils/marketHolidayCheck.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { TICKERS } from '../_utils/stockIntelligenceData.js';
import { getEarningsResult } from '../earnings/_helpers/getEarningsResult.js';
import {
  DOUG_RECAP_SYSTEM_PROMPT,
  PUBLISH_EARNINGS_RECAP_TOOL,
  REPORTER_PROFILES,
} from '../_utils/fantasyTimesPrompts.js';
import { getDefaultVisual, shouldOverrideVisual, callArtDirector } from '../_utils/fantasyTimesVisuals.js';
import { getClaimsForReporter, formatClaimsForPrompt } from '../_utils/ingestedClaims.js';
import { appendEarningsResult } from '../_utils/fantasyTimesConsensus.js';
import { getWireFlags } from '../_utils/wireFlags.js';
import { extendToolWithAgentFacts, buildAgentFactsInstruction } from '../_utils/wireSchemaExtension.js';
import {
  resolveWireMarketDate,
  deriveMarketDate,
  assertMaintainedYear,
} from '../_utils/wireCalendar.js';
import { getPreviousTradingDay } from '../_utils/marketSchedule.js';
import { translateTiming } from '../_utils/fetchEarningsCalendarEODHD.js';
import { etMinutesOfDay } from '../_utils/fetchEconomicEventsEODHD.js';
import { assessEpsPlausibility } from '../_utils/econPrintVerifier.js';
import { publishStoryWithWire } from '../_utils/wireWriteThrough.js';
import { buildContinuityContext } from '../_utils/wireContinuity.js';
import { recordWireSample } from '../_utils/wireMetrics.js';

export const config = { maxDuration: 60 };

// ── Recap surprise/outcome, derived from the PRINTED operands (§9) ─────────
// The displayed EPS surprise and beat/miss outcome are derived from the SAME
// epsActual / epsEstimate the recap prints — the /calendar/earnings operands —
// never from the EODHD /fundamentals feed (getEarningsResult), whose
// surprisePercent/outcome are for a possibly-different quarter and split from
// the printed EPS. §9 display-agreement: a shown number decomposes into its
// shown terms.
//
// The formula and the degrade boundaries are byte-for-byte the editorial
// adapter's STRICT eps_surprise_pct recomputation (api/_utils/
// wireEditorialAdapters.js: '(epsActual − epsEstimate) / |epsEstimate| × 100';
// non-number operand or estimate === 0 → NOT_VERIFIABLE), so the number Doug
// prints is the number the STRICT slot re-derives and verifies — a feed
// disagreement can no longer score VERIFIED_WRONG on a plumbing split.
export const RECAP_SURPRISE_UNVERIFIABLE = 'N/A';
export const RECAP_OUTCOME_UNVERIFIABLE = 'unconfirmed';

export function deriveRecapSurprise(epsActual, epsEstimate) {
  const a = typeof epsActual === 'number' && Number.isFinite(epsActual) ? epsActual : null;
  const e = typeof epsEstimate === 'number' && Number.isFinite(epsEstimate) ? epsEstimate : null;

  // Degrade exactly where the STRICT adapter does: a non-number operand
  // (missing_operand) or a zero estimate (zero_denominator). Never throws — a
  // null-estimate recap yields NOT_VERIFIABLE, not a fabricated beat/miss.
  if (a === null || e === null || e === 0) {
    return {
      verifiable: false,
      surprisePercent: null,
      surprise: RECAP_SURPRISE_UNVERIFIABLE,
      outcome: RECAP_OUTCOME_UNVERIFIABLE,
    };
  }

  const surprisePercent = ((a - e) / Math.abs(e)) * 100;
  // |e| > 0 ⇒ sign(surprisePercent) === sign(a − e): outcome FOLLOWS the
  // computed surprise (beat / miss / meet), never a foreign feed's sign.
  const outcome = a > e ? 'beat' : a < e ? 'miss' : 'meet';
  const sign = surprisePercent > 0 ? '+' : '';
  return {
    verifiable: true,
    surprisePercent,
    surprise: `${sign}${surprisePercent.toFixed(1)}%`,
    outcome,
  };
}

// ── Recap throughput (founder-tunable, Doug universe-expansion, Aug 2026) ──
// The pre-expansion recap wrote at most ONE story per firing; with the widened
// earnings universe (~66 names) a peak-season day puts more tracked reporters
// on the calendar than the five daily firings can cover, and every un-recapped
// name is a lost story (and lost S5 editorial-floor material). We now write up
// to RECAP_MAX_STORIES_PER_FIRING per firing, bounded across the ET trading day
// by RECAP_DAILY_STORY_CEILING (the founder-visible knob). Candidates are
// ordered surprise-first, so when a ceiling binds the DROPPED names are the
// least newsworthy — the property the founder ruled must be preserved.
export const RECAP_DAILY_STORY_CEILING = 12;   // max recaps published per ET trading day
export const RECAP_MAX_STORIES_PER_FIRING = 4; // per-invocation bound (maxDuration:60 safety)

// Newsworthiness sort key: larger |EPS surprise %| ranks first; an
// unverifiable surprise (null estimate / zero denominator) sorts last.
export function recapNewsworthiness(candidate) {
  const { verifiable, surprisePercent } = deriveRecapSurprise(candidate.epsActual, candidate.epsEstimate);
  return verifiable ? Math.abs(surprisePercent) : -1;
}

const LOG_PREFIX = '[FantasyTimes:Doug:Recap]';

function logInfo(msg, data = null) {
  const ts = new Date().toISOString();
  console.log(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

function logError(msg, data = null) {
  const ts = new Date().toISOString();
  console.error(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

/**
 * Fetch real-time price from EODHD for a single symbol.
 */
async function fetchRealTimePrice(symbol) {
  try {
    const url = `https://eodhd.com/api/real-time/${symbol}.US?api_token=${process.env.EODHD_API_KEY}&fmt=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      symbol,
      price: Number(data.close) || 0,
      changePercent: Number(data.change_p) || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch earnings rows for an ET-date window [fromET, toET], inclusive.
 * ET-anchored per ruling R-B2(i) — the old UTC `todayStr` shortcut queried
 * the wrong ET trading day on the late-UTC firing.
 */
async function fetchEarningsWindow(fromET, toET) {
  const url = `https://eodhd.com/api/calendar/earnings?api_token=${process.env.EODHD_API_KEY}&fmt=json&from=${fromET}&to=${toET}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`EODHD responded ${res.status}`);
  const data = await res.json();
  return data.earnings || [];
}

/**
 * F2 (ruling R-B5): the price-operand label is a deterministic function of
 * (beforeAfterMarket, session-relation-to-reportDate, pre-open). An AMC
 * report drops AFTER the session close, so the same-day session move is the
 * into-earnings (pre-reaction) move and must never be phrased as a reaction
 * to the news; the morning-after fire may call it an early reaction ONLY
 * once the new session has opened — before 9:30 ET the real-time quote may
 * still reflect the prior close (review finding H1), so pre-open labels
 * carry an explicit do-not-attribute instruction instead.
 */
function describeSessionMove(timing, isPriorSessionReport, isPreOpen) {
  if (isPreOpen) {
    return 'Pre-open quote (the new session has not opened — the figure may reflect the prior close; do NOT attribute it to the report)';
  }
  if (timing === 'AMC') {
    return isPriorSessionReport
      ? 'Early reaction session move (first session after the report)'
      : "Into-earnings session move (pre-reaction — the report drops after today's close)";
  }
  if (timing === 'BMO') {
    return isPriorSessionReport
      ? 'Post-report session move (session after the pre-open report)'
      : 'Session move since the pre-open report (early reaction)';
  }
  return 'Session move (report timing unconfirmed — do not attribute it to the report)';
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  // --- Cron/Admin Authentication ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (isMarketHolidayToday()) {
    return res.status(200).json({ skipped: true, reason: 'Market holiday' });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!process.env.CLAUDE_API_KEY) {
    return res.status(500).json({ success: false, error: 'AI service not configured' });
  }

  if (!process.env.EODHD_API_KEY) {
    return res.status(500).json({ success: false, error: 'Market data service not configured' });
  }

  try {
    const db = getFirebaseAdmin();
    const wireInstant = new Date();
    const todayET = deriveMarketDate(wireInstant);

    // Recap Restoration (rulings R-B2): the re-aimed ~13:00 UTC slot is the
    // MORNING fire — its window is [prior ET session, today], so prior-day
    // AMC reports (whose actual EPS posts overnight) and same-day BMO are
    // both in view. Evening fires keep [today, today]. Mode derives from
    // the ET clock, not the cron slot (DST-robust); assertMaintainedYear
    // closes the walker's 2028 silent-mislabel gap on this path.
    const isMorningFire = etMinutesOfDay(wireInstant) < 12 * 60;
    assertMaintainedYear(todayET);
    const fromET = isMorningFire ? getPreviousTradingDay(todayET) : todayET;
    logInfo(`Starting earnings recap check window=${fromET}..${todayET} mode=${isMorningFire ? 'morning' : 'evening'}`);

    // The one fetch_failed site (R-B6): an EODHD outage is distinguishable
    // from a quiet window by construction.
    let earningsRaw;
    try {
      earningsRaw = await fetchEarningsWindow(fromET, todayET);
    } catch (err) {
      logError(`outcome=fetch_failed fetched=0 tracked=0 error=${err.message}`);
      return res.status(200).json({
        success: false, skipped: true, code: 'fetch_failed',
        reason: 'EODHD earnings calendar fetch failed',
      });
    }

    // Filter to tracked symbols with released results; carry the report
    // timing (R-B5) through the single translateTiming vocabulary.
    const tickerSet = new Set(TICKERS.map((t) => t.toUpperCase()));
    const trackedResults = earningsRaw
      .filter((e) => {
        const code = (e.code || '').replace('.US', '').toUpperCase();
        // EODHD /calendar/earnings names the reported EPS `actual` and the
        // consensus `estimate` — the field names this reader ORIGINALLY got
        // wrong (`actual_eps`/`eps_estimate`), which zeroed the intersection
        // on every firing (fetched=N tracked=0) and kept S5 structurally
        // silent even after the R-B2 morning window landed. Confirmed by
        // capture (2026-07-31: 9-key schema — actual/estimate present, zero
        // actual_eps/eps_estimate). `?? e.actual_eps` is a defensive fallback
        // matching the ingest-earnings.js:127 house pattern; `??` (not `||`)
        // preserves a legitimate 0.00 EPS.
        const epsActual = e.actual ?? e.actual_eps;
        // report_date must be a real date string: it is the C8 referent —
        // an undefined value would make the dedup query throw in real
        // Firestore and write an undefined referentDate (review finding L2).
        return tickerSet.has(code)
          && typeof e.report_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.report_date)
          && epsActual !== null && epsActual !== undefined;
      })
      .map((e) => {
        const symbol = (e.code || '').replace('.US', '').toUpperCase();
        return {
          symbol,
          // /calendar/earnings carries no `name` field either — fall back to
          // the symbol so the prompt never renders an empty "Company:".
          companyName: e.name || symbol,
          reportDate: e.report_date,
          epsActual: e.actual ?? e.actual_eps,
          epsEstimate: e.estimate ?? e.eps_estimate,
          timing: translateTiming(e.before_after_market),
        };
      });

    // The single per-firing outcome line (F1 dual count + taxonomy, R-B6).
    const counts = { fetched: earningsRaw.length, tracked: trackedResults.length };
    const skip = (code, reason) => {
      logInfo(`outcome=${code} fetched=${counts.fetched} tracked=${counts.tracked}`);
      return res.status(200).json({ success: true, skipped: true, code, reason });
    };

    if (trackedResults.length === 0) {
      return skip('empty_window', 'No tracked earnings results in window');
    }

    // C8(a)/(b) + R-B4: referent dedup BEFORE the model call. Identity =
    // (symbol, reportDate); referentDate is a top-level story field (never
    // inside dataSnapshot — C1 freeze). Non-superseded = published and not
    // stamped wireSuperseded. Window overlap (morning re-sees yesterday's
    // evening coverage; unknown-timing rows eligible in both windows)
    // resolves to exactly one story here — zero model calls on a hit.
    const referentDates = [...new Set(trackedResults.map((e) => e.reportDate))];
    const existingDocs = [];
    for (const d of referentDates) {
      const snap = await db
        .collection('fantasyTimesStories')
        .where('type', '==', 'earnings_recap')
        .where('referentDate', '==', d)
        .limit(50)
        .get();
      existingDocs.push(...snap.docs);
    }
    const covered = new Set(
      existingDocs
        .map((doc) => doc.data())
        .filter((s) => s.status === 'published' && !s.wireSuperseded)
        .map((s) => `${s.primaryTicker}:${s.referentDate}`)
    );

    // Surprise-first: the most newsworthy uncovered names fill the day's
    // slots, so when a ceiling binds the dropped stories are the least
    // newsworthy (founder ruling). Ranked by |EPS surprise %| — see
    // recapNewsworthiness.
    const ranked = [...trackedResults].sort((a, b) => recapNewsworthiness(b) - recapNewsworthiness(a));

    // Daily ceiling, accumulated across the day's firings. Every firing for one
    // ET trading day publishes on the SAME UTC date (13/20/21/22/23 UTC ≈
    // 09:00–19:00 ET), so counting recaps with publishedAt >= 00:00 UTC(today)
    // is exactly "recaps already published today". Degrades OPEN on a count
    // failure (falls back to the per-firing bound), never closed.
    const todayStartUTC = new Date(Date.UTC(
      wireInstant.getUTCFullYear(), wireInstant.getUTCMonth(), wireInstant.getUTCDate(),
    ));
    let publishedToday = 0;
    try {
      const todaySnap = await db
        .collection('fantasyTimesStories')
        .where('type', '==', 'earnings_recap')
        .where('publishedAt', '>=', todayStartUTC)
        .limit(RECAP_DAILY_STORY_CEILING + 1)
        .get();
      // .docs.length (not .size) — equivalent on a real QuerySnapshot and also
      // works against the lightweight test doubles.
      publishedToday = todaySnap.docs.length;
    } catch (err) {
      logError('Daily-ceiling count failed; using per-firing bound only', { error: err.message });
    }
    const firingBudget = Math.min(
      Math.max(0, RECAP_DAILY_STORY_CEILING - publishedToday),
      RECAP_MAX_STORIES_PER_FIRING,
    );
    if (firingBudget === 0) {
      return skip('daily_ceiling', `Daily recap ceiling reached (${publishedToday}/${RECAP_DAILY_STORY_CEILING})`);
    }

    // The per-candidate generation block below is kept BYTE-IDENTICAL to the
    // pre-expansion single-story path (it retains the 4-space indent it had
    // when it lived directly under `try`), so this diff shows only the
    // control-flow change — the loop wrapper plus the two return→continue /
    // return→collect edits — rather than a 220-line reindent of live
    // generation logic. Each iteration publishes at most one recap; `written`
    // collects the successes and the single per-firing outcome line + response
    // are emitted after the loop.
    const written = [];
    let heldCount = 0;
    let attempts = 0;
    for (const earning of ranked) {
      // Bound MODEL-CALL ATTEMPTS, not just successes: each attempt below is a
      // Haiku round-trip, so gating on attempts (rather than written.length)
      // keeps a run of soft failures from blowing maxDuration:60.
      if (attempts >= firingBudget) break;
      if (covered.has(`${earning.symbol}:${earning.reportDate}`)) continue;
      const gate = assessEpsPlausibility(earning.epsActual, earning.epsEstimate);
      if (gate.hold) {
        heldCount += 1;
        logError(
          `operand_implausible symbol=${earning.symbol} reportDate=${earning.reportDate} ` +
          `reason=${gate.reason} detail="${gate.detail}"`,
        );
        continue;
      }
      // Claim it for THIS firing so a duplicate calendar row can't double-write;
      // an unpublished candidate (soft skip or hard error below) is left for a
      // later firing (whose covered set is rebuilt from Firestore).
      covered.add(`${earning.symbol}:${earning.reportDate}`);
      attempts += 1;

    // Per-candidate isolation: a hard error (wireModelCall / publishStoryWithWire
    // / recordWireSample) must NOT abort the firing or void the outcome line for
    // stories already published this firing — log it and move to the next
    // candidate, exactly like the soft no-tool_use skip.
    try {
    logInfo(`Generating recap for ${earning.symbol}`);

    // Get detailed earnings result
    let earningsDetail = null;
    try {
      // Pass reportDate so the 7-day matcher (getEarningsResult.js:298-305)
      // returns the RECAPPED quarter's fundamentals row, not entries[0] (the
      // most recent history row). Used only for supplementary context below
      // (priceMove / magnitude / revenue) — never the printed surprise/outcome.
      earningsDetail = await getEarningsResult(earning.symbol, earning.reportDate);
    } catch (e) {
      logError(`getEarningsResult failed for ${earning.symbol}`, { error: e.message });
    }

    // Fetch the current-session price move. For an AMC name on report day
    // this is the INTO-EARNINGS (pre-reaction) session — the report drops
    // after the close — so it is NOT a reaction to the news (F2/R-B5; the
    // previous "current price reaction" comment here was itself the
    // mislabel the ruling ordered fixed).
    const priceData = await fetchRealTimePrice(earning.symbol);
    const isPriorSessionReport = earning.reportDate < todayET;
    const isPreOpen = etMinutesOfDay(wireInstant) < 9 * 60 + 30;
    const sessionMoveLabel = describeSessionMove(earning.timing, isPriorSessionReport, isPreOpen);

    // Check if Doug published a preview for this symbol
    let previewReference = '';
    try {
      const previewQuery = await db
        .collection('fantasyTimesStories')
        .where('reporter', '==', 'doug')
        .where('type', '==', 'earnings_preview')
        .where('primaryTicker', '==', earning.symbol)
        .orderBy('publishedAt', 'desc')
        .limit(1)
        .get();

      if (!previewQuery.empty) {
        const previewData = previewQuery.docs[0].data();
        previewReference = `\n\nDOUG'S PREVIEW (published earlier):\nHeadline: ${previewData.headline}\nKey points: ${previewData.body?.slice(0, 300) || 'N/A'}`;
      }
    } catch (e) {
      logError('Preview query failed, continuing without', { error: e.message });
    }

    // Surprise + outcome are derived from the SAME operands the recap prints
    // (the calendar epsActual/epsEstimate), matching the STRICT adapter's
    // recomputation — NOT from earningsDetail (the /fundamentals feed), whose
    // surprisePercent/outcome are for a possibly-different quarter and split
    // from the printed EPS. This is the fix for the recap surprise split
    // (diagnosis Part 4): the AMD case showed a +6.7% beat next to a −80%
    // surprise because the two came from different feeds with no date match.
    const { surprise, outcome } = deriveRecapSurprise(earning.epsActual, earning.epsEstimate);

    let userMessage = [
      `EARNINGS RESULT: ${earning.symbol}`,
      `Company: ${earning.companyName}`,
      `Report Date: ${earning.reportDate}`,
      '',
      'THE NUMBERS:',
      `EPS Actual: ${earning.epsActual}`,
      `EPS Estimate: ${earning.epsEstimate || 'N/A'}`,
      `Outcome: ${outcome.toUpperCase()}`,
      `Surprise: ${surprise}`,
      `Report timing: ${earning.timing || 'unconfirmed'}${isPriorSessionReport ? ' (reported the prior session)' : ' (reports today)'}`,
      earningsDetail?.priceMove ? `Post-earnings reaction move (close-to-next-close): ${earningsDetail.priceMove >= 0 ? '+' : ''}${earningsDetail.priceMove.toFixed(1)}%` : '',
      priceData ? `${sessionMoveLabel}: $${priceData.price.toFixed(2)} (${priceData.changePercent >= 0 ? '+' : ''}${priceData.changePercent.toFixed(2)}%)` : '',
      previewReference,
      '',
      `Write an earnings recap for ${earning.symbol}. Use the publish_earnings_recap tool.`,
    ]
      .filter((line) => line !== '')
      .join('\n');

    // Enrich with ingested claims (if available)
    let claimsContext = '';
    try {
      const claims = await getClaimsForReporter('doug', { ticker: earning.symbol, source: 'earnings_call', limit: 8 });
      claimsContext = formatClaimsForPrompt(claims);
    } catch (e) {
      logError('Claims fetch failed for doug:', e.message);
    }
    if (claimsContext) {
      userMessage += `\n\nEARNINGS CALL INSIGHTS (from transcript analysis):\n${claimsContext}`;
    }

    // ── FantasyTimes Wire (Spec V1.5 §4.5/§4.8) ────────────────────────
    // wireInstant was established at the top of the handler (B5:
    // pre-model-call); the receipt bucket stays firing-scoped (C8).
    const wireFlags = getWireFlags();
    const marketDate = resolveWireMarketDate(wireInstant);
    const wireInstruction = wireFlags.writesEnabled
      ? buildAgentFactsInstruction('doug', { pinEventType: 'earnings_recap' })
      : '';
    let continuityBlock = '';
    if (wireFlags.continuityEnabled) {
      try {
        continuityBlock = (await buildContinuityContext(db, { reporter: 'doug', marketDate })) || '';
      } catch (err) {
        logError('Continuity block failed (non-blocking)', { error: err.message });
      }
    }

    // Params from the frozen execution object; wireModelCall is the sole
    // transport (P11 / R4-B2).
    const executionConfig = getGenerationConfig('doug_earnings_recap', wireFlags);
    logInfo('Calling Claude API for recap...', { model: executionConfig.model });
    const wireT0 = Date.now();

    const { response, generationConfig } = await wireModelCall(executionConfig, {
      system: DOUG_RECAP_SYSTEM_PROMPT + wireInstruction + continuityBlock,
      tools: [wireFlags.writesEnabled
        ? extendToolWithAgentFacts(PUBLISH_EARNINGS_RECAP_TOOL, 'doug', { pinEventType: 'earnings_recap' })
        : PUBLISH_EARNINGS_RECAP_TOOL],
      tool_choice: { type: 'tool', name: 'publish_earnings_recap' },
      messages: [{ role: 'user', content: userMessage }],
    });

    const toolBlock = response.content.find((block) => block.type === 'tool_use');
    if (!toolBlock || !toolBlock.input) {
      // Skip this candidate, keep the firing going for the rest of the budget.
      logError('No tool_use block in recap response', { symbol: earning.symbol });
      continue;
    }

    const storyData = toolBlock.input;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REPORTER_PROFILES.doug.expiryHours * 60 * 60 * 1000);

    const storyDoc = {
      reporter: 'doug',
      reporterName: REPORTER_PROFILES.doug.name,
      reporterBeat: REPORTER_PROFILES.doug.beat,
      type: 'earnings_recap',
      headline: String(storyData.headline || '').slice(0, 120),
      subheadline: String(storyData.subheadline || '').slice(0, 200),
      body: String(storyData.body || ''),
      tickers: [earning.symbol],
      primaryTicker: earning.symbol,
      sector: 'Earnings',
      themes: Array.isArray(storyData.themes) ? storyData.themes : [],
      sentiment: storyData.sentiment || 'neutral',
      urgency: 'timely',
      recommended_action: storyData.recommended_action || 'EARNINGSGAME',
      // C8(a)/R-B4 identity component (top-level, never in dataSnapshot)
      // + R-B5 timing metadata for downstream honest labeling.
      referentDate: earning.reportDate,
      beforeAfterMarket: earning.timing || null,
      dataSnapshot: {
        symbol: earning.symbol,
        epsActual: earning.epsActual,
        epsEstimate: earning.epsEstimate,
        outcome,
        surprise,
        priceMove: earningsDetail?.priceMove || null,
        magnitude: earningsDetail?.magnitude || null,
      },
      newsContext: [],
      generatedBy: REPORTER_PROFILES.doug.model,
      batchId: null,
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

    // agentFacts stays in a PRIVATE local — never on storyDoc (§4.5 step 1).
    const { storyRef: docRef, wire: wireResult } = await publishStoryWithWire(db, {
      storyDoc,
      rawAgentFacts: wireFlags.writesEnabled ? toolBlock.input.agentFacts : null,
      stopReason: response.stop_reason,
      reporter: 'doug',
      seam: 'doug_earnings_recap',
      primaryTicker: earning.symbol,
      triggerRef: `${earning.symbol}:${earning.reportDate}`,
      marketDate,
      generationConfig,
      now: wireInstant,
    });
    // Close the measured window immediately: nothing between the
    // publish and this line may be metrics I/O.
    const genPublishMs = Date.now() - wireT0;
    // Count the story the moment it is persisted, so a later non-critical step
    // (metrics / consensus / art-director) throwing cannot un-count it or drop
    // it from the response.
    written.push({ storyId: docRef.id, symbol: earning.symbol, outcome, headline: storyDoc.headline });
    // Per-story line (plain — NOT the `outcome=` taxonomy, which stays one per
    // firing; the firing-level outcome line is emitted after the loop).
    logInfo(`Recap published symbol=${earning.symbol} storyId=${docRef.id}`, {
      outcome,
      headline: storyDoc.headline,
    });

    if (wireFlags.metricsEnabled) {
      // generate_publish is captured BEFORE any metrics I/O so the
      // instrument never appears inside the window it measures (§6.1 p95).
      await recordWireSample(db, { seam: 'doug_earnings_recap', metric: 'generate_publish', ms: genPublishMs, marketDate });
      if (Number.isFinite(wireResult?.wireMs)) {
        await recordWireSample(db, { seam: 'doug_earnings_recap', metric: 'wire_path', ms: wireResult.wireMs, marketDate });
      }
    }

    // Write earnings result to consensus. R-B3: the FINAL-LOCK §3 join
    // stands — the bucket key is the locked UTC expression, evaluated on
    // the SAME instant as the story's publishedAt (`now`), so the adapter
    // join off publishedAt lands on this doc by construction, including
    // across UTC midnight. Never re-key to the event date (C8(c) superseded).
    try {
      const consensusDate = now.toISOString().split('T')[0];
      await appendEarningsResult(consensusDate, earning.symbol, {
        result: outcome,
        epsActual: earning.epsActual,
        epsEstimate: earning.epsEstimate,
        revenueActual: earningsDetail?.revenue || null,
        revenueEstimate: earningsDetail?.revenueEstimate || null,
      });
    } catch (err) {
      console.error('[CONSENSUS] Failed to append earnings result:', err.message);
    }

    // Art Director override for edge-case story types
    if (shouldOverrideVisual(storyDoc.reporter, storyDoc.type)) {
      await callArtDirector(storyDoc, docRef.id, db);
    }
    } catch (err) {
      // The story (if any) was pushed to `written` right after persist, so an
      // error here is post-publish side-effect noise. Log and move on — never
      // abort the firing or void the outcome line for the stories already
      // written this firing.
      logError('Recap candidate failed (continuing)', { symbol: earning.symbol, error: err.message });
      continue;
    }
    }

    // The single per-firing outcome line (F1 dual count + taxonomy, R-B6): one
    // `outcome=` per firing, now carrying the story count.
    if (written.length === 0) {
      if (heldCount > 0) {
        return skip('operand_implausible', `${heldCount} candidate(s) held by the plausibility gate`);
      }
      return skip('already_written', 'All earnings results already covered');
    }
    logInfo(`outcome=wrote fetched=${counts.fetched} tracked=${counts.tracked} stories=${written.length}`);
    return res.status(200).json({
      success: true,
      count: written.length,
      stories: written,
    });
  } catch (error) {
    logError('Recap generation failed', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ success: false, error: 'Earnings recap generation failed' });
  }
}
