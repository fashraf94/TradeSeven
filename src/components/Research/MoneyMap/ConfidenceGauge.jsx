// /src/components/Research/MoneyMap/ConfidenceGauge.jsx

import React from 'react';
import { motion } from 'framer-motion';

/**
 * ConfidenceGauge — Horizontal risk-appetite gauge
 * Shows the cyclical vs defensive balance on a 0-100 scale.
 * 0 = full defensive dominance, 50 = neutral, 100 = full cyclical dominance.
 *
 * @param {Object} props
 * @param {number} props.confidence - 0-100, where 50 is neutral
 */
const ConfidenceGauge = ({ confidence, onTooltip }) => {
  // Guard against bad input
  const safeConfidence = typeof confidence === 'number' && Number.isFinite(confidence)
    ? Math.max(0, Math.min(100, confidence))
    : 50;

  // Clamp visual position so dot never clips outside track edges
  const clampedPosition = Math.max(3, Math.min(97, safeConfidence));

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #21262d',
      borderRadius: '16px',
      padding: '20px',
    }}>
      {/* Header */}
      <div style={{
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: '600',
        marginBottom: '20px',
      }}>
        <span
          onClick={() => onTooltip?.('confidenceGauge')}
          style={{
            borderBottom: onTooltip ? '1px dashed #484f58' : 'none',
            cursor: onTooltip ? 'pointer' : 'default',
            paddingBottom: '1px',
          }}
        >RISK APPETITE</span>
      </div>

      {/* Gauge Area */}
      <div style={{
        position: 'relative',
        paddingTop: '28px',
      }}>
        {/* Percentage Label (animated with dot) */}
        <motion.div
          initial={{ left: '50%' }}
          animate={{ left: `${clampedPosition}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          style={{
            position: 'absolute',
            top: '0px',
            transform: 'translateX(-50%)',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: '700',
          }}
        >
          {safeConfidence}%
        </motion.div>

        {/* Track */}
        <div style={{
          position: 'relative',
          height: '4px',
          borderRadius: '9999px',
          background: `linear-gradient(to right,
            rgba(239, 68, 68, 0.08) 0%,
            rgba(239, 68, 68, 0.08) 15%,
            #30363d 25%,
            #30363d 75%,
            rgba(34, 197, 94, 0.08) 85%,
            rgba(34, 197, 94, 0.08) 100%
          )`,
        }}>
          {/* Dot */}
          <motion.div
            initial={{ left: '50%' }}
            animate={{ left: `${clampedPosition}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            style={{
              position: 'absolute',
              top: '50%',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#00d9ff',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 8px rgba(0, 217, 255, 0.6), 0 0 16px rgba(0, 217, 255, 0.3)',
            }}
          />
        </div>

        {/* End Labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '8px',
        }}>
          <span style={{
            color: '#8b949e',
            fontSize: '10px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Defensives
          </span>
          <span style={{
            color: '#8b949e',
            fontSize: '10px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Cyclicals
          </span>
        </div>
      </div>
    </div>
  );
};

export default ConfidenceGauge;
