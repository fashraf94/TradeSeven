// api/_utils/fantasyTimesConsensus.js
// FantasyTimes Newsroom Consensus Layer — shared editorial truth across all 5 reporters.
// One Firestore document per trading day at fantasyTimesConsensus/{date}.
// Specialists write (Alex, Doug, Neta); generalists read (Kai, Kim).

import { getFirebaseAdmin } from './firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { getPreviousTradingDay } from './marketSchedule.js';
import { ALL_TICKERS } from './rankingConfig.js';
import { getMarketContextBlock } from './fantasyTimesPrompts.js';

const LOG_PREFIX = '[CONSENSUS]';

function log(msg) {
  console.log(`${new Date().toISOString()} ${LOG_PREFIX} ${msg}`);
}

// ═══════════════════════════════════════════════════════════════
// seedConsensus — Initialize the day's consensus document
// ═══════════════════════════════════════════════════════════════

export async function seedConsensus(date) {
  const db = getFirebaseAdmin();
  const API_KEY = process.env.EODHD_API_KEY;

  // Fetch today's earnings calendar from EODHD
  let reportingToday = [];
  let reportedYesterdayAfterClose = [];
  let reportingThisWeek = [];

  if (API_KEY) {
    try {
      // Today's earnings
      const todayResp = await fetch(
        `https://eodhd.com/api/calendar/earnings?api_token=${API_KEY}&fmt=json&from=${date}&to=${date}`
      );
      if (todayResp.ok) {
        const todayData = await todayResp.json();
        const earnings = todayData?.earnings || todayData;
        if (Array.isArray(earnings)) {
          reportingToday = earnings
            .map(e => e.code?.split('.')[0] || e.ticker || e.symbol)
            .filter(Boolean);
        }
      }

      // Yesterday after-close earnings
      const prevDay = getPreviousTradingDay(date);
      const prevResp = await fetch(
        `https://eodhd.com/api/calendar/earnings?api_token=${API_KEY}&fmt=json&from=${prevDay}&to=${prevDay}`
      );
      if (prevResp.ok) {
        const prevData = await prevResp.json();
        const prevEarnings = prevData?.earnings || prevData;
        if (Array.isArray(prevEarnings)) {
          reportedYesterdayAfterClose = prevEarnings
            .filter(e => {
              const rt = (e.report_time || e.reportTime || e.time || '').toLowerCase();
              return rt === 'amc' || rt === 'after market close' || rt === 'after_market_close';
            })
            .map(e => e.code?.split('.')[0] || e.ticker || e.symbol)
            .filter(Boolean);
        }
      }

      // This week's earnings (3-day lookahead)
      const weekEnd = new Date(date);
      weekEnd.setDate(weekEnd.getDate() + 5);
      const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`;
      const weekResp = await fetch(
        `https://eodhd.com/api/calendar/earnings?api_token=${API_KEY}&fmt=json&from=${date}&to=${weekEndStr}`
      );
      if (weekResp.ok) {
        const weekData = await weekResp.json();
        const weekEarnings = weekData?.earnings || weekData;
        if (Array.isArray(weekEarnings)) {
          reportingThisWeek = weekEarnings
            .map(e => e.code?.split('.')[0] || e.ticker || e.symbol)
            .filter(Boolean);
        }
      }
    } catch (err) {
      log(`Earnings calendar fetch failed: ${err.message}`);
    }
  }

  // Deduplicate ticker arrays
  reportingToday = [...new Set(reportingToday)];
  reportedYesterdayAfterClose = [...new Set(reportedYesterdayAfterClose)];
  reportingThisWeek = [...new Set(reportingThisWeek)];

  // Write consensus document.
  //
  // `{ merge: true }` deep-merges MAPS but REPLACES arrays wholesale. That is
  // why `catalysts: {}`, `sectors: {}` and `earnings.results: {}` are safe (an
  // empty map writes no leaf, so existing entries survive) while a bare
  // `economics` array was NOT: every event `appendEconomics()` had arrayUnion'd
  // since the previous tick was destroyed by the next seed (Step 0, PR #682).
  //
  // Phase 2 N4 removed the orphaned economic-calendar reader that used to
  // sit above (its source collection has no producer anywhere in the repo —
  // the populating cron is retired; P2-19's census names the token), so the
  // seed now NEVER writes `economics` at all: `appendEconomics()` (Neta's
  // post-publish writer) is the field's SOLE producer, and a seed tick is
  // additive for it by construction.
  //
  // Stakes: this document is an editorial adapter operand source under Phase 2
  // Spec V1.3 D-P2-8 — `economics[].actual`/`.expected` is Phase 3 gate
  // evidence, not just story context.
  const payload = {
    date,
    earnings: {
      reportingToday,
      reportedYesterdayAfterClose,
      reportingThisWeek,
      results: {},
    },
    catalysts: {},
    sectors: {},
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await db.collection('fantasyTimesConsensus').doc(date).set(payload, { merge: true });

  log(`Seeded consensus for ${date}: ${reportingToday.length} earnings today, ${reportedYesterdayAfterClose.length} yesterday after-close, ${reportingThisWeek.length} this week`);
}

// ═══════════════════════════════════════════════════════════════
// appendCatalyst — Upsert a catalyst entry (Map-based, keyed by ticker)
// ═══════════════════════════════════════════════════════════════

export async function appendCatalyst(date, ticker, data) {
  try {
    const db = getFirebaseAdmin();
    await db.collection('fantasyTimesConsensus').doc(date).set({
      catalysts: {
        [ticker]: {
          ...data,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    log(`Catalyst upserted: ${ticker} ${data.direction} ${data.percentChange}% (${data.confidence})`);
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to upsert catalyst ${ticker}:`, err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// appendEconomics — Append an economic event (additive via arrayUnion)
// ═══════════════════════════════════════════════════════════════

export async function appendEconomics(date, eventData) {
  try {
    const db = getFirebaseAdmin();
    await db.collection('fantasyTimesConsensus').doc(date).update({
      economics: FieldValue.arrayUnion(eventData),
      updatedAt: FieldValue.serverTimestamp(),
    });

    log(`Economics appended: ${eventData.event}`);
  } catch (err) {
    // If doc doesn't exist yet, create it with the event
    if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
      const db = getFirebaseAdmin();
      await db.collection('fantasyTimesConsensus').doc(date).set({
        economics: [eventData],
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      log(`Economics appended (created doc): ${eventData.event}`);
    } else {
      console.error(`${LOG_PREFIX} Failed to append economics:`, err.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// appendEarningsResult — Merge actual earnings results (Doug)
// ═══════════════════════════════════════════════════════════════

export async function appendEarningsResult(date, ticker, resultData) {
  try {
    const db = getFirebaseAdmin();
    await db.collection('fantasyTimesConsensus').doc(date).set({
      earnings: {
        results: {
          [ticker]: {
            ...resultData,
            updatedAt: FieldValue.serverTimestamp(),
          },
        },
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    log(`Earnings result: ${ticker} ${resultData.result}`);
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to append earnings result ${ticker}:`, err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// buildConsensusBlock — Build time-aware prompt injection string
// ═══════════════════════════════════════════════════════════════

function rankCatalysts(catalysts) {
  const entries = Object.entries(catalysts || {}).map(([ticker, data]) => ({
    ticker,
    ...data,
  }));

  if (entries.length === 0) return [];

  // Two-factor ranking: significance (0.6) + ATR multiple percentile (0.4)
  const sorted = [...entries].sort((a, b) =>
    Math.abs(b.atrMultiple || 0) - Math.abs(a.atrMultiple || 0)
  );

  const ranked = entries.map(entry => {
    const significanceWeight = ALL_TICKERS.includes(entry.ticker) ? 1.0 : 0.3;

    const atrRank = sorted.findIndex(e => e.ticker === entry.ticker);
    const atrPercentile = sorted.length > 1
      ? 1 - (atrRank / (sorted.length - 1))
      : 1;

    const score = significanceWeight * 0.6 + atrPercentile * 0.4;

    return { ...entry, score };
  });

  ranked.sort((a, b) => b.score - a.score);

  return ranked.slice(0, 10);
}

export async function buildConsensusBlock(date, period) {
  try {
    const db = getFirebaseAdmin();
    const doc = await db.collection('fantasyTimesConsensus').doc(date).get();
    if (!doc.exists) return '';

    const data = doc.data();
    const catalysts = data.catalysts || {};
    const economics = data.economics || [];
    const earnings = data.earnings || {};
    const earningsValidList = [
      ...(earnings.reportingToday || []),
      ...(earnings.reportedYesterdayAfterClose || []),
    ];

    // Rank catalysts
    const top10 = rankCatalysts(catalysts);

    // Format sections
    const catalystBlock = top10.length > 0
      ? top10.map(c => `- ${c.ticker} ${c.direction} ${c.percentChange}%: ${c.catalyst} [${c.confidence}]`).join('\n')
      : 'None yet';

    const econBlock = economics.length > 0
      ? economics.map(e => `- ${e.event}: Expected ${e.expected ?? 'N/A'}, Actual ${e.actual ?? 'pending'} — ${e.impact || 'TBD'}`).join('\n')
      : 'None';

    const earningsValidBlock = `Today: ${earningsValidList.length > 0
      ? (earnings.reportingToday || []).join(', ') || 'None'
      : 'None'}\nYesterday after-close: ${(earnings.reportedYesterdayAfterClose || []).join(', ') || 'None'}`;

    // Get market context for premarket data and sector data
    const { block: marketBlock, data: marketData } = await getMarketContextBlock();

    // Build premarket data section from Index Intelligence
    let premarketSection = '';
    if (marketData) {
      const spy = marketData.spy;
      const qqq = marketData.qqq;
      const dia = marketData.dia;
      const iwm = marketData.iwm;
      const fmtIdx = (idx, name) => {
        if (!idx) return `${name}: N/A`;
        const pct = idx.changePercent != null ? `${idx.changePercent >= 0 ? '+' : ''}${idx.changePercent.toFixed(2)}%` : 'N/A';
        return `${name}: ${idx.price ?? 'N/A'} (${pct})`;
      };
      premarketSection = `${fmtIdx(spy, 'SPY')} | ${fmtIdx(qqq, 'QQQ')} | ${fmtIdx(dia, 'DIA')} | ${fmtIdx(iwm, 'IWM')}\nMarket Regime: ${marketData.regime ?? 'unknown'}`;
    }

    // Sector data from Index Intelligence
    let sectorSection = '';
    if (marketData?.sectorSnapshot?.length > 0) {
      sectorSection = marketData.sectorSnapshot
        .map(s => `  ${s.sector} (${s.etf}): ${s.changePercent != null ? (s.changePercent > 0 ? '+' : '') + s.changePercent.toFixed(2) + '%' : 'N/A'}`)
        .join('\n');
      if (marketData.topSectorToday) {
        sectorSection += `\n  Top: ${marketData.topSectorToday} (${marketData.topSectorChange != null ? (marketData.topSectorChange > 0 ? '+' : '') + marketData.topSectorChange.toFixed(2) + '%' : ''})`;
      }
      if (marketData.worstSectorToday) {
        sectorSection += `\n  Worst: ${marketData.worstSectorToday} (${marketData.worstSectorChange != null ? (marketData.worstSectorChange > 0 ? '+' : '') + marketData.worstSectorChange.toFixed(2) + '%' : ''})`;
      }
    } else {
      sectorSection = 'No sector data available';
    }

    // Build time-aware block
    let block = '';

    if (period === 'pre_market') {
      block = `=== NEWSROOM CONSENSUS (Morning) ===

PREMARKET DATA:
${premarketSection || 'No premarket data available'}

ECONOMICS TODAY:
${econBlock}

EARNINGS VALID (you may attribute moves to earnings ONLY for these tickers):
${earningsValidBlock}

CONFIRMED CATALYSTS (from other reporters — align with these):
${catalystBlock}

=== END CONSENSUS ===`;
    } else if (period === 'midday') {
      block = `=== NEWSROOM CONSENSUS (Midday) ===

CONFIRMED CATALYSTS (from other reporters — lead with these):
${catalystBlock}

SECTOR DATA:
${sectorSection}

ECONOMICS TODAY:
${econBlock}

EARNINGS VALID (you may attribute moves to earnings ONLY for these tickers):
${earningsValidBlock}

=== END CONSENSUS ===`;
    } else if (period === 'post_close') {
      block = `=== NEWSROOM CONSENSUS (Afternoon) ===

SECTOR DATA (lead with sector framing):
${sectorSection}

CONFIRMED CATALYSTS (use as concrete examples):
${catalystBlock}

EARNINGS VALID (you may attribute moves to earnings ONLY for these tickers):
${earningsValidBlock}

ECONOMICS TODAY (background context):
${econBlock}

=== END CONSENSUS ===`;
    }

    log(`Built ${period} block: ${Object.keys(catalysts).length} catalysts (${top10.length} injected), ${economics.length} econ events, ${earningsValidList.length} earnings valid`);

    return block;
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to build consensus block:`, err.message);
    return '';
  }
}

// ═══════════════════════════════════════════════════════════════
// checkEarningsAttribution — Deterministic publish interceptor
// ═══════════════════════════════════════════════════════════════

export function checkEarningsAttribution(storyBody, earningsValidList) {
  if (!storyBody || !earningsValidList) {
    return { passed: true, violations: [] };
  }

  const earningsRegex = /\b(earnings|EPS|Q[1-4]\s+(results|report|beat|miss)|guidance|revenue\s+(beat|miss))\b/gi;
  const matches = [];
  let match;

  while ((match = earningsRegex.exec(storyBody)) !== null) {
    matches.push({ index: match.index, text: match[0] });
  }

  if (matches.length === 0) {
    return { passed: true, violations: [] };
  }

  // Extract ticker symbols near each earnings mention (within 100 chars)
  const tickerRegex = /\b([A-Z]{1,5})\b/g;
  const mentionedTickers = new Set();

  for (const m of matches) {
    const start = Math.max(0, m.index - 100);
    const end = Math.min(storyBody.length, m.index + m.text.length + 100);
    const surrounding = storyBody.substring(start, end);

    let tickerMatch;
    while ((tickerMatch = tickerRegex.exec(surrounding)) !== null) {
      const candidate = tickerMatch[1];
      // Filter out common English words that look like tickers
      const commonWords = ['THE', 'AND', 'FOR', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'HAS', 'ITS', 'LET', 'SAY', 'SHE', 'TOO', 'USE', 'HIM', 'HOW', 'MAN', 'NEW', 'NOW', 'OLD', 'SEE', 'WAY', 'WHO', 'DID', 'GET', 'HIS', 'MAY', 'EPS', 'ETF', 'IPO', 'GDP', 'CPI', 'PPI', 'PCE', 'FED'];
      if (!commonWords.includes(candidate) && candidate.length >= 1) {
        mentionedTickers.add(candidate);
      }
    }
    tickerRegex.lastIndex = 0;
  }

  // Cross-reference against valid list
  const validSet = new Set(earningsValidList.map(t => t.toUpperCase()));
  const violations = [...mentionedTickers].filter(t => !validSet.has(t));

  // Only flag violations for tickers that are plausibly being attributed to earnings
  // (tickers that actually appear in the story's ticker context)
  const actualViolations = violations.filter(t => {
    // Check if this ticker is being attributed to earnings, not just mentioned nearby
    return ALL_TICKERS.includes(t) || storyBody.includes(t);
  });

  const passed = actualViolations.length === 0;

  log(`Earnings check: ${passed ? 'PASSED' : 'BLOCKED — ' + actualViolations.join(', ')}`);

  return { passed, violations: actualViolations };
}
