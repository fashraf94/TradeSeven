// src/components/TechnicalAnalysis/TechnicalResearchCard.jsx
// Entry point card for Technical Research on the Research landing page

import React from 'react';
import { motion } from 'framer-motion';

const TechnicalResearchCard = ({
  onAnalyzeStock,
  onMyPatterns,
  onInsights,
  activePatternCount = 0,
  confirmationRate = null,
  colors = {}
}) => {
  // Use passed colors or defaults
  const c = {
    cyan: colors.cyan || '#00ffff',
    green: colors.green || '#10b981',
    bgCard: colors.bgCard || '#0d1117',
    ...colors
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      style={{
        position: 'relative',
        borderRadius: '16px',
        padding: '2px',
        background: `linear-gradient(135deg, rgba(0, 255, 255, 0.3), rgba(0, 255, 255, 0.1), rgba(16, 185, 129, 0.2))`,
        boxShadow: '0 0 30px rgba(0, 255, 255, 0.1)',
        overflow: 'hidden',
        marginBottom: '20px',
      }}
    >
      {/* Gradient border effect */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '16px',
        padding: '2px',
        background: 'linear-gradient(135deg, #00ffff, #10b981)',
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        opacity: 0.5,
      }} />

      {/* Card content */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(145deg, rgba(13, 17, 23, 0.95), rgba(22, 27, 34, 0.98))',
        borderRadius: '14px',
        padding: '24px',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: '56px',
          height: '56px',
          margin: '0 auto 16px',
          background: 'rgba(0, 255, 255, 0.1)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)',
        }}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00ffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="5" r="3" />
            <line x1="12" y1="8" x2="12" y2="14" />
            <line x1="8" y1="14" x2="16" y2="14" />
            <line x1="8" y1="14" x2="8" y2="20" />
            <line x1="16" y1="14" x2="16" y2="20" />
            <line x1="5" y1="20" x2="19" y2="20" />
          </svg>
        </div>

        {/* Title */}
        <h3 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#ffffff',
          margin: '0 0 8px 0',
          letterSpacing: '1px',
        }}>
          TECHNICAL RESEARCH
          <span style={{ color: '#00ffff', fontWeight: '400' }}> &rarr;</span>
        </h3>

        {/* Subtitle */}
        <p style={{
          fontSize: '14px',
          color: 'rgba(255, 255, 255, 0.6)',
          margin: '0 0 20px 0',
        }}>
          AI pattern detection &bull; Track &amp; learn
        </p>

        {/* Stats row (if available) */}
        {(activePatternCount > 0 || confirmationRate !== null) && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '24px',
            marginBottom: '20px',
            padding: '12px 0',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            {activePatternCount > 0 && (
              <span style={{ fontSize: '13px' }}>
                <span style={{ color: '#00ffff', fontWeight: '600' }}>{activePatternCount}</span>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}> active</span>
              </span>
            )}
            {confirmationRate !== null && (
              <span style={{ fontSize: '13px' }}>
                <span style={{ color: '#00ffff', fontWeight: '600' }}>{confirmationRate}%</span>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}> confirmed</span>
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          <motion.button
            onClick={onAnalyzeStock}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#00ffff',
              background: 'rgba(0, 255, 255, 0.08)',
              border: '1px solid rgba(0, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            whileHover={{ backgroundColor: 'rgba(0, 255, 255, 0.15)' }}
            whileTap={{ scale: 0.98 }}
          >
            Analyze Stock
          </motion.button>

          <motion.button
            onClick={onMyPatterns}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#00ffff',
              background: 'rgba(0, 255, 255, 0.08)',
              border: '1px solid rgba(0, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            whileHover={{ backgroundColor: 'rgba(0, 255, 255, 0.15)' }}
            whileTap={{ scale: 0.98 }}
          >
            My Patterns
            {activePatternCount > 0 && (
              <span style={{
                background: '#00ffff',
                color: '#0a0e14',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 6px',
                borderRadius: '10px',
                minWidth: '18px',
              }}>{activePatternCount}</span>
            )}
          </motion.button>

          <motion.button
            onClick={onInsights}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#00ffff',
              background: 'rgba(0, 255, 255, 0.08)',
              border: '1px solid rgba(0, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            whileHover={{ backgroundColor: 'rgba(0, 255, 255, 0.15)' }}
            whileTap={{ scale: 0.98 }}
          >
            Insights
          </motion.button>
        </div>
      </div>

      {/* Floating particles */}
      <div style={{
        position: 'absolute',
        width: '4px',
        height: '4px',
        background: '#00ffff',
        borderRadius: '50%',
        top: '20%',
        right: '15%',
        opacity: 0.5,
      }} />
      <div style={{
        position: 'absolute',
        width: '3px',
        height: '3px',
        background: '#10b981',
        borderRadius: '50%',
        top: '60%',
        left: '10%',
        opacity: 0.4,
      }} />
    </motion.div>
  );
};

export default TechnicalResearchCard;
