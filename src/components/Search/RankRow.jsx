import React from 'react';
import { motion } from 'framer-motion';
import { resolveSectorInfo } from '../../utils/sectorUtils';

const GRADIENT_MAP = {
  composite: 'linear-gradient(90deg, rgba(94,234,212,0.6), rgba(16,185,129,0.9))',
  fundamental: 'linear-gradient(90deg, rgba(245,158,11,0.5), rgba(245,158,11,0.9))',
  technical: 'linear-gradient(90deg, rgba(168,85,250,0.5), rgba(168,85,250,0.9))',
  baggerBomb: 'linear-gradient(90deg, rgba(239,68,68,0.5), rgba(249,115,22,0.9))',
  snakeDraft: 'linear-gradient(90deg, rgba(20,184,166,0.5), rgba(16,185,129,0.9))',
  earningsGame: 'linear-gradient(90deg, rgba(245,158,11,0.4), rgba(234,179,8,0.9))',
};

const SCORE_COLOR_MAP = {
  composite: '#5eead4',
  fundamental: '#f59e0b',
  technical: '#A78BFA',
  baggerBomb: '#ef4444',
  snakeDraft: '#14b8a6',
  earningsGame: '#eab308',
};

const SCORE_KEY_MAP = {
  composite: 'compositeScore',
  fundamental: 'fundamentalScore',
  technical: 'technicalScore',
  baggerBomb: 'baggerBombFit',
  snakeDraft: 'snakeDraftFit',
  earningsGame: 'earningsGameFit',
};

const RankRow = ({ stock, rank, type, maxScore, onTap }) => {
  const sectorInfo = resolveSectorInfo(stock);
  const scoreKey = SCORE_KEY_MAP[type] || 'compositeScore';
  const score = stock[scoreKey] || 0;
  const barWidth = maxScore > 0 ? Math.max(5, (score / maxScore) * 100) : 5;
  const gradient = GRADIENT_MAP[type] || GRADIENT_MAP.composite;
  const scoreColor = SCORE_COLOR_MAP[type] || '#5eead4';

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => onTap?.(stock)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 8px',
        cursor: 'pointer',
        borderBottom: '0.5px solid rgba(255,255,255,0.04)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(94,234,212,0.03)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Rank number */}
      <span style={{
        width: '24px',
        textAlign: 'right',
        fontSize: '12px',
        fontWeight: 700,
        color: 'rgba(255,255,255,0.4)',
        flexShrink: 0,
      }}>
        {rank}
      </span>

      {/* Ticker */}
      <span style={{
        width: '48px',
        fontSize: '14px',
        fontWeight: 700,
        color: '#ffffff',
        flexShrink: 0,
      }}>
        {stock.symbol}
      </span>

      {/* Sector pill */}
      <span style={{
        fontSize: '10px',
        color: sectorInfo.color,
        background: `${sectorInfo.color}15`,
        borderLeft: `2px solid ${sectorInfo.color}`,
        padding: '2px 6px',
        borderRadius: '0 4px 4px 0',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        maxWidth: '80px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {sectorInfo.name}
      </span>

      {/* Progress bar */}
      <div style={{
        flex: 1,
        height: '5px',
        borderRadius: '3px',
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
        minWidth: '40px',
      }}>
        <div style={{
          height: '100%',
          borderRadius: '3px',
          width: `${barWidth}%`,
          background: gradient,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Score */}
      <span style={{
        width: '28px',
        textAlign: 'right',
        fontSize: '13px',
        fontWeight: 700,
        color: scoreColor,
        flexShrink: 0,
      }}>
        {Math.round(score)}
      </span>
    </motion.div>
  );
};

export default RankRow;
