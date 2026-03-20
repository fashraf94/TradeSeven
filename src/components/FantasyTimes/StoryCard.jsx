// src/components/FantasyTimes/StoryCard.jsx
// Story card for the FantasyTimes feed — supports hero, standard, and mover variants.

import React from 'react';
import { motion } from 'framer-motion';
import { REPORTER_COLORS, SENTIMENT_COLORS, FEED_TOKENS, getReporterGlow, getSentimentBorder } from '../../constants/reporterTheme';
import ReporterAvatar from './ReporterAvatar';
import StoryVisualSafe from './StoryVisualSafe';
import MoverSparkline from './visuals/MoverSparkline';
import { findStock } from '../../data/assets';
import { INDEX_REGISTRY } from '../../constants/indexRegistry';

/**
 * Format "time ago" from a publishedAt timestamp.
 */
function timeAgo(publishedAt) {
  if (!publishedAt) return '';
  const ms = publishedAt._seconds
    ? publishedAt._seconds * 1000
    : new Date(publishedAt).getTime();
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Variant-specific style tokens
const VARIANT_STYLES = {
  hero: {
    padding: FEED_TOKENS.paddingHero,
    boxShadow: `${FEED_TOKENS.obsidianShadow}, ${FEED_TOKENS.heroInnerGlow}`,
    headlineFontSize: 18,
    headlineFontWeight: 700,
    bodyFontSize: 13,
    visualSize: 'hero',
    bodyMarginTop: 10,
  },
  standard: {
    padding: FEED_TOKENS.paddingStandard,
    boxShadow: FEED_TOKENS.obsidianShadow,
    headlineFontSize: 15,
    headlineFontWeight: 600,
    bodyFontSize: 12,
    visualSize: 'compact',
    bodyMarginTop: 8,
  },
  mover: {
    padding: 14,
    boxShadow: FEED_TOKENS.obsidianShadow,
    headlineFontSize: 14,
    headlineFontWeight: 600,
    bodyFontSize: 12,
    visualSize: null,
    bodyMarginTop: 6,
    minHeight: 200,
  },
};

export default function StoryCard({
  story, onClick, activeBattleTickers = [], isMobile,
  isHero = false, isMover = false,
}) {
  const variant = isMover ? 'mover' : isHero ? 'hero' : 'standard';
  const styles = VARIANT_STYLES[variant];
  const reporter = REPORTER_COLORS[story.reporter];
  const reporterColor = reporter ? reporter.hex : '#5eead4';

  const primaryTicker = story.primaryTicker || (story.tickers && story.tickers[0]);
  const stockInfo = primaryTicker ? findStock(primaryTicker) : null;
  const indexInfo = primaryTicker ? INDEX_REGISTRY[primaryTicker] : null;
  const companyName = indexInfo?.name || stockInfo?.name || null;

  const priceChange = story.dataSnapshot?.percentChange
    || story.dataSnapshot?.avgIndexChange
    || (primaryTicker && story.dataSnapshot?.[primaryTicker.toLowerCase()]?.changePercent)
    || null;
  const isPositive = priceChange !== null ? priceChange >= 0 : true;

  const hasVisual = story.visualType && story.visualType !== 'none';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, type: 'spring', bounce: 0.3 }}
      onClick={onClick}
      style={{
        backgroundColor: FEED_TOKENS.bgCard,
        border: `1px solid ${FEED_TOKENS.bgCardBorder}`,
        borderLeft: getSentimentBorder(story.sentiment),
        borderRadius: FEED_TOKENS.cardRadius,
        boxShadow: styles.boxShadow,
        backgroundImage: getReporterGlow(story.reporter),
        padding: styles.padding,
        cursor: 'pointer',
        overflow: 'hidden',
        minHeight: styles.minHeight || 'auto',
        display: styles.minHeight ? 'flex' : undefined,
        flexDirection: styles.minHeight ? 'column' : undefined,
      }}
      whileHover={{ backgroundColor: '#1a1d27' }}
      whileTap={{ scale: 0.99 }}
    >
      {variant === 'mover' ? (
        <MoverLayout
          story={story}
          styles={styles}
          primaryTicker={primaryTicker}
          companyName={companyName}
          indexInfo={indexInfo}
          priceChange={priceChange}
          isPositive={isPositive}
          reporterColor={reporterColor}
        />
      ) : (
        <EditorialLayout
          story={story}
          styles={styles}
          variant={variant}
          reporterColor={reporterColor}
          hasVisual={hasVisual}
          activeBattleTickers={activeBattleTickers}
        />
      )}
    </motion.div>
  );
}

// Hero + Standard card layout
function EditorialLayout({ story, styles, variant, reporterColor, hasVisual, activeBattleTickers }) {
  const reporter = REPORTER_COLORS[story.reporter];
  const reporterName = reporter ? reporter.name : 'Reporter';
  const beat = reporter ? reporter.beat : '';

  return (
    <>
      {/* Header row: avatar + reporter name + beat + timestamp */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ReporterAvatar reporter={story.reporter} size={24} />
        <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>
          {reporterName}
        </span>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>·</span>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>{beat}</span>
        <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 'auto' }}>
          {timeAgo(story.publishedAt)}
        </span>
      </div>

      {/* Headline */}
      <div style={{
        color: '#e2e8f0',
        fontSize: styles.headlineFontSize,
        fontWeight: styles.headlineFontWeight,
        lineHeight: 1.3,
        marginTop: 8,
      }}>
        {story.headline}
      </div>

      {/* Visual container */}
      {styles.visualSize && hasVisual && (
        <div style={{
          marginTop: FEED_TOKENS.gapStandard,
          borderRadius: FEED_TOKENS.innerRadius,
          overflow: 'hidden',
        }}>
          <StoryVisualSafe
            visualType={story.visualType}
            visualConfig={story.visualConfig}
            size={styles.visualSize}
          />
        </div>
      )}

      {/* Visual fallback gradient for hero when no chart data */}
      {styles.visualSize && !hasVisual && variant === 'hero' && (
        <div style={{
          marginTop: FEED_TOKENS.gapStandard,
          height: 160,
          background: `linear-gradient(135deg, ${reporterColor}15, transparent)`,
          borderRadius: FEED_TOKENS.innerRadius,
        }} />
      )}

      {/* Body preview */}
      <div style={{
        color: '#94a3b8',
        fontSize: styles.bodyFontSize,
        fontWeight: 400,
        lineHeight: 1.5,
        marginTop: styles.bodyMarginTop,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {story.subheadline?.replace(/\*\*/g, '') || ''}
      </div>

      {/* CTA — ghost text link */}
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <span style={{
          color: reporterColor,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          Read Full Story →
        </span>
      </div>
    </>
  );
}

// Mover / ticker card layout
function MoverLayout({ story, styles, primaryTicker, companyName, indexInfo, priceChange, isPositive, reporterColor }) {
  const sentimentColor = isPositive ? SENTIMENT_COLORS.bullish : SENTIMENT_COLORS.bearish;
  const tickerColor = indexInfo ? indexInfo.color : sentimentColor;
  const changeText = priceChange !== null
    ? `${isPositive ? '+' : ''}${Number(priceChange).toFixed(2)}%`
    : null;
  const tickerDisplay = indexInfo
    ? `${indexInfo.name} (${primaryTicker})`
    : primaryTicker;

  return (
    <>
      {/* Ticker row: badge + sparkline */}
      {primaryTicker && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: tickerColor,
          }}>
            {tickerDisplay}{changeText ? ` (${changeText})` : ''}
          </span>
          <MoverSparkline isPositive={isPositive} width={60} height={24} />
        </div>
      )}

      {/* Headline */}
      <div style={{
        color: '#e2e8f0',
        fontSize: styles.headlineFontSize,
        fontWeight: styles.headlineFontWeight,
        lineHeight: 1.3,
        marginTop: 8,
      }}>
        {story.headline}
      </div>

      {/* Body preview */}
      <div style={{
        color: '#94a3b8',
        fontSize: styles.bodyFontSize,
        fontWeight: 400,
        lineHeight: 1.4,
        marginTop: styles.bodyMarginTop,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        flex: 1,
      }}>
        {story.subheadline?.replace(/\*\*/g, '') || ''}
      </div>

      {/* Reporter row — pinned to bottom via marginTop auto */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 'auto',
        paddingTop: 10,
      }}>
        <ReporterAvatar reporter={story.reporter} size={18} />
        <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 500 }}>
          {REPORTER_COLORS[story.reporter]?.name || 'Reporter'}
        </span>
      </div>
    </>
  );
}
