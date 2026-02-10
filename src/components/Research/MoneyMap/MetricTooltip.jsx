// /src/components/Research/MoneyMap/MetricTooltip.jsx

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ===========================================
// TOOLTIP CONTENT
// Educational explanations for every tappable metric
// ===========================================
const TOOLTIPS = {
  breadth: {
    title: 'Breadth (Participation Rate)',
    text: "What percentage of stocks in this sector are actually going up? Higher = healthier. Think of it like a team sport — are all the players contributing, or just a few stars carrying everyone?",
  },
  leadership: {
    title: 'Leadership Score',
    text: "Are the biggest, most important companies in this sector doing well? When the leaders are healthy, the sector has a strong backbone.",
  },
  weightedLeadership: {
    title: 'Weighted Leadership',
    text: "Same as Leadership Score, but weighted by how important each stock is to the sector. If the #1 stock is lagging, this score drops a lot more than if the #5 stock is.",
  },
  quadrant: {
    title: 'Momentum Quadrant',
    text: "Where is this sector in its rotation cycle? 'Market Leaders' are strong and getting stronger. 'Cooling Off' means still strong but slowing down. 'Underdogs' are weak. 'Comeback Kids' are starting to recover.",
  },
  momentumScore: {
    title: 'Momentum Score',
    text: "A single number from -10 (weakest) to +10 (strongest) that captures both how a sector is performing relative to the market AND whether it's speeding up or slowing down.",
  },
  ma50: {
    title: '50-Day Moving Average',
    text: "Is this sector above or below its average price over the last ~2 months? Above = short-term momentum is positive. Below = the recent trend is down.",
  },
  ma200: {
    title: '200-Day Moving Average',
    text: "Is this sector above or below its average price over the last ~10 months? This is the big-picture trend that takes longer to change.",
  },
  regime: {
    title: 'Market Regime',
    text: "The overall 'weather' of the stock market right now. Is the market in growth mode (sunny), cautious mode (cloudy), or fear mode (stormy)? This is determined by which types of sectors are leading.",
  },
  breadthDirection: {
    title: 'Breadth Direction',
    text: "Is participation getting better (\u2191), getting worse (\u2193), or staying about the same (\u2192) compared to last week? The direction often matters more than the number itself.",
  },
  confidenceGauge: {
    title: 'Risk Appetite',
    text: "Are investors putting money into growth-oriented sectors (cyclicals) or safety-oriented sectors (defensives)? Higher percentage = more appetite for risk and growth.",
  },
  gildedCage: {
    title: 'Gilded Cage Warning',
    text: "This sector's Leadership Score looks healthy, but most stocks are actually in downtrends. The gains are concentrated in just a few mega-cap stocks \u2014 a setup that has historically been fragile and prone to sudden corrections.",
  },
  bellwether: {
    title: 'Bellwether Stock',
    text: "A sector's most important company \u2014 the one whose health tends to predict where the whole sector is heading. When a bellwether breaks its trend, the rest of the sector often follows within 2-3 weeks.",
  },
  baggerbomb: {
    title: 'BaggerBomb Stats',
    text: "Of the stocks making big moves in this sector, how many went up (breakouts) vs down (busts)? A high hit rate means more explosive winners.",
  },
};

/**
 * MetricTooltip — Bottom-sheet educational overlay
 *
 * Slides up from bottom with a dark backdrop when a user taps
 * on any underlined metric label. Tap backdrop or "Got it" to dismiss.
 *
 * @param {string|null}  metric   - Key into TOOLTIPS (e.g. 'breadth', 'regime')
 * @param {boolean}      isOpen   - Whether the sheet is visible
 * @param {function}     onClose  - Callback to dismiss
 */
const MetricTooltip = ({ metric, isOpen, onClose }) => {
  const tooltip = metric ? TOOLTIPS[metric] : null;

  return (
    <AnimatePresence>
      {isOpen && tooltip && (
        <>
          {/* Backdrop */}
          <motion.div
            key="tooltip-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
            }}
          />

          {/* Bottom Sheet */}
          <motion.div
            key="tooltip-sheet"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#1c2128',
              borderRadius: '16px 16px 0 0',
              padding: '20px',
              zIndex: 1001,
              maxHeight: '60vh',
              overflowY: 'auto',
            }}
          >
            {/* Drag Handle */}
            <div style={{
              width: '40px',
              height: '4px',
              borderRadius: '2px',
              background: '#30363d',
              margin: '0 auto 16px',
            }} />

            {/* Title */}
            <h3 style={{
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '700',
              margin: '0 0 12px',
            }}>
              {tooltip.title}
            </h3>

            {/* Explanation */}
            <p style={{
              color: '#e6edf3',
              fontSize: '14px',
              lineHeight: 1.6,
              margin: '0 0 20px',
            }}>
              {tooltip.text}
            </p>

            {/* Dismiss Button */}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#00d9ff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '8px 0',
                width: '100%',
                textAlign: 'center',
              }}
            >
              Got it
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MetricTooltip;
