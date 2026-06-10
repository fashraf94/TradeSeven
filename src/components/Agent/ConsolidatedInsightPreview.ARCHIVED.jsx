import React from 'react';
import { motion } from 'framer-motion';
import { Target, ArrowRight } from 'lucide-react';
import HoloCard from '../shared/HoloCard';

const TEAL = '#5EEAD4';
const INSIGHTS_THRESHOLD = 5;
const TRUNCATE_AT = 150;

const SectionHeader = ({ label }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  }}>
    <div style={{
      width: 3,
      height: 16,
      background: `linear-gradient(180deg, ${TEAL}, #A855F7)`,
      borderRadius: 2,
    }} />
    <Target size={14} color="#8B949E" />
    <span style={{
      fontSize: 13,
      fontWeight: 700,
      color: '#8B949E',
      textTransform: 'uppercase',
      letterSpacing: '1.5px',
    }}>
      {label}
    </span>
  </div>
);

const ConsolidatedInsightPreview = ({ consolidatedInsight, gamesPlayed = 0, onViewFull }) => {
  const hasInsight = Boolean(consolidatedInsight);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    >
      <SectionHeader label="Agent Insight" />

      <HoloCard variant="default" size="lg" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {hasInsight ? (
          <>
            <p style={{
              fontSize: 13,
              color: '#E6EDF3',
              lineHeight: 1.6,
              margin: 0,
            }}>
              {consolidatedInsight.length > TRUNCATE_AT
                ? `${consolidatedInsight.slice(0, TRUNCATE_AT).trim()}…`
                : consolidatedInsight}
            </p>
            <button
              type="button"
              onClick={onViewFull}
              disabled={!onViewFull}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 0',
                border: 'none',
                background: 'transparent',
                color: TEAL,
                fontSize: 13,
                fontWeight: 700,
                cursor: onViewFull ? 'pointer' : 'default',
                alignSelf: 'flex-start',
                fontFamily: 'inherit',
              }}
            >
              View full insight <ArrowRight size={14} />
            </button>
          </>
        ) : (
          <>
            <div style={{
              fontSize: 13,
              color: '#E6EDF3',
              lineHeight: 1.5,
            }}>
              {Math.min(gamesPlayed, INSIGHTS_THRESHOLD)}/{INSIGHTS_THRESHOLD} games until first strategic insight
            </div>
            <div style={{
              width: '100%',
              height: 4,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min((gamesPlayed / INSIGHTS_THRESHOLD) * 100, 100)}%`,
                height: '100%',
                borderRadius: 2,
                background: `linear-gradient(90deg, ${TEAL}, #A855F7)`,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{
              fontSize: 11,
              color: '#8B949E',
              lineHeight: 1.5,
            }}>
              Play more games to help your agent consolidate lessons into a strategic insight.
            </div>
          </>
        )}
      </HoloCard>
    </motion.div>
  );
};

export default ConsolidatedInsightPreview;
