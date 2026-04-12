// src/components/Season/DailyBriefingCard.jsx
//
// Daily Briefing Card — template-based natural-language summary of the most
// recent daily evaluation. Generated from structured dailyLog fields; no AI
// call required.
//
// Reads: seasonEntries/{entryId}/dailyLogs/{tradingDay}
// Fields used: trades[], entryScan.selected[], exitEvaluations[],
//              endOfDayPortfolio, haikuCalls[]
//
// Props:
//   entry        - The activeSeasonEntry document (provides currentAlpha fallback)
//   dailyLog     - The most recent dailyLog document (fetched by parent)
//   tradingDay   - Current trading day number (for header)
//   loading      - Parent-controlled loading flag (optional)

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';

const TROPHY_GOLD = '#F0C75E';
const POSITIVE = '#34D399';
const NEGATIVE = '#EF4444';
const CARD_BG = '#15171E';
const TEXT_PRIMARY = '#F1F5F9';
const TEXT_SECONDARY = '#8B949E';
const TEXT_MUTED = '#6E7681';
const BORDER_SUBTLE = '#21262D';

function formatPct(value, withSign = true) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const prefix = withSign && value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

/**
 * Builds a 2–3 sentence natural-language briefing from dailyLog + entry.
 * Returns { headline, detail, tradeList } — headline is shown in collapsed
 * state, detail is revealed when expanded.
 */
function buildBriefing(dailyLog, entry, tradingDay) {
  const day = dailyLog?.day ?? tradingDay ?? 0;
  const trades = Array.isArray(dailyLog?.trades) ? dailyLog.trades : [];
  const buys = trades.filter((t) => t?.type === 'BUY');
  const sells = trades.filter((t) => t?.type === 'SELL');
  const totalReturn = dailyLog?.endOfDayPortfolio?.totalReturn;
  const alpha = entry?.seasonState?.alphaVsSpy;
  const positionCount = dailyLog?.endOfDayPortfolio?.positionCount;

  // Find notable "holds" — exit evaluations that voted but final decision was HOLD
  const notableHolds = Array.isArray(dailyLog?.exitEvaluations)
    ? dailyLog.exitEvaluations
        .filter((e) => e?.finalDecision === 'HOLD' && (e?.votes?.sell ?? 0) > 0)
        .slice(0, 2)
    : [];

  // ── Headline (first sentence) ──────────────────────────────
  let headline;
  if (buys.length === 0 && sells.length === 0) {
    headline = notableHolds.length
      ? `Your algorithm held ${positionCount || 'all'} positions through today's market.`
      : 'Your algorithm made no trades today — all positions held steady.';
  } else if (buys.length > 0 && sells.length > 0) {
    const buyTickers = buys.slice(0, 3).map((t) => t.ticker).join(', ');
    headline = `${sells.length} ${sells.length === 1 ? 'exit' : 'exits'} and ${buys.length} new ${buys.length === 1 ? 'entry' : 'entries'} (${buyTickers}).`;
  } else if (buys.length > 0) {
    const buyTickers = buys.slice(0, 3).map((t) => t.ticker).join(', ');
    headline = `${buys.length} new ${buys.length === 1 ? 'entry' : 'entries'} triggered (${buyTickers}).`;
  } else {
    const sellTickers = sells.slice(0, 3).map((t) => t.ticker).join(', ');
    headline = `${sells.length} ${sells.length === 1 ? 'exit' : 'exits'} executed (${sellTickers}).`;
  }

  // ── Detail sentences ───────────────────────────────────────
  const detailParts = [];

  if (notableHolds.length > 0) {
    const holdTickers = notableHolds.map((h) => h.ticker).join(', ');
    const anyTrigger = notableHolds.find((h) => h?.trigger);
    if (anyTrigger) {
      detailParts.push(`Held ${holdTickers} despite sell votes — trigger rule ${anyTrigger.trigger} kept position open.`);
    } else {
      detailParts.push(`Held ${holdTickers} through conflicting signals.`);
    }
  }

  if (dailyLog?.entryScan?.blocked && dailyLog.entryScan.blockReason) {
    detailParts.push(`Entry scan blocked: ${dailyLog.entryScan.blockReason}.`);
  } else if (dailyLog?.entryScan?.candidatesEvaluated > 0) {
    detailParts.push(`Evaluated ${dailyLog.entryScan.candidatesEvaluated} candidates — ${dailyLog.entryScan.candidatesPassed} passed filters.`);
  }

  if (Array.isArray(dailyLog?.haikuCalls) && dailyLog.haikuCalls.length > 0) {
    const call = dailyLog.haikuCalls[0];
    if (call?.type === 'black_swan') {
      detailParts.push(`Haiku intervention: ${call.assessment || 'market volatility detected'}.`);
    }
  }

  // Alpha line always closes the detail
  const alphaLine = `Current alpha: ${formatPct(alpha)}${typeof totalReturn === 'number' ? ` • Daily return: ${formatPct(totalReturn)}` : ''}.`;

  return {
    day,
    headline,
    detail: detailParts.join(' '),
    alphaLine,
    trades,
    alpha,
    totalReturn,
  };
}

export default function DailyBriefingCard({ entry, dailyLog, tradingDay, loading = false }) {
  const [expanded, setExpanded] = useState(false);

  const briefing = useMemo(
    () => (dailyLog ? buildBriefing(dailyLog, entry, tradingDay) : null),
    [dailyLog, entry, tradingDay]
  );

  // Empty / waiting state — active experiment but Day 1 hasn't evaluated yet
  if (!loading && !dailyLog) {
    return (
      <div
        style={{
          background: CARD_BG,
          borderLeft: `2px solid ${TROPHY_GOLD}`,
          borderRadius: 10,
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Newspaper size={18} color={TROPHY_GOLD} />
        <div style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
          Waiting for first evaluation — your algorithm will run at market close today.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          background: CARD_BG,
          borderLeft: `2px solid ${TROPHY_GOLD}`,
          borderRadius: 10,
          padding: 14,
          color: TEXT_MUTED,
          fontSize: 13,
        }}
      >
        Loading briefing…
      </div>
    );
  }

  const alphaColor =
    typeof briefing.alpha === 'number'
      ? briefing.alpha >= 0
        ? POSITIVE
        : NEGATIVE
      : TEXT_SECONDARY;

  return (
    <div
      style={{
        background: CARD_BG,
        borderLeft: `2px solid ${TROPHY_GOLD}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 14,
          cursor: 'pointer',
          textAlign: 'left',
          color: TEXT_PRIMARY,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Newspaper size={16} color={TROPHY_GOLD} />
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: TROPHY_GOLD,
              flex: 1,
            }}
          >
            Day {briefing.day} Briefing
          </div>
          {typeof briefing.alpha === 'number' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontWeight: 700,
                color: alphaColor,
              }}
            >
              {briefing.alpha >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {formatPct(briefing.alpha)}
            </div>
          )}
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex' }}
          >
            <ChevronDown size={16} color={TEXT_MUTED} />
          </motion.div>
        </div>
        <div style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
          {briefing.headline}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="briefing-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '0 14px 14px',
                borderTop: `1px solid ${BORDER_SUBTLE}`,
                marginTop: 4,
                paddingTop: 12,
              }}
            >
              {briefing.detail && (
                <div
                  style={{
                    fontSize: 13,
                    color: TEXT_SECONDARY,
                    lineHeight: 1.55,
                    marginBottom: 10,
                  }}
                >
                  {briefing.detail}
                </div>
              )}
              <div
                style={{
                  fontSize: 12,
                  color: TEXT_MUTED,
                  lineHeight: 1.5,
                  marginBottom: briefing.trades.length > 0 ? 12 : 0,
                }}
              >
                {briefing.alphaLine}
              </div>

              {briefing.trades.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: TEXT_MUTED,
                      marginBottom: 6,
                    }}
                  >
                    Today&apos;s Trades
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {briefing.trades.slice(0, 6).map((t, i) => (
                      <div
                        key={`${t.ticker}-${i}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          color: TEXT_SECONDARY,
                          padding: '4px 8px',
                          background: 'rgba(255,255,255,0.02)',
                          borderRadius: 6,
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: t.type === 'BUY' ? POSITIVE : NEGATIVE,
                              minWidth: 28,
                            }}
                          >
                            {t.type}
                          </span>
                          <span style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>{t.ticker}</span>
                        </span>
                        {t.reason && (
                          <span
                            style={{
                              fontSize: 11,
                              color: TEXT_MUTED,
                              marginLeft: 8,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 160,
                            }}
                          >
                            {t.reason}
                          </span>
                        )}
                      </div>
                    ))}
                    {briefing.trades.length > 6 && (
                      <div style={{ fontSize: 11, color: TEXT_MUTED, paddingLeft: 8 }}>
                        +{briefing.trades.length - 6} more…
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
