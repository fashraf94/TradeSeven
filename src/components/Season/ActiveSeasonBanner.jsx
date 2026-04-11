// src/components/Season/ActiveSeasonBanner.jsx
//
// Persistent sticky banner that appears above BottomNav across all tabs
// when the user has an active season. One tap navigates to the Season
// Dashboard. Wired in by App.jsx in phase C-2c.
//
// Props:
//   - season:          the season doc ({ currentWeek, weeks, ... })
//   - entry:           the user's seasonEntries doc ({ seasonState, ... })
//   - onTap:           callback invoked when the banner is tapped
//   - isPitStopOpen:   when true, swaps copy + runs an opacity pulse
//
// Renders null if season or entry is missing — safe to always mount.

import React from 'react';
import { motion } from 'framer-motion';

const TROPHY_GOLD = '#F0C75E';
const BG = '#15171E';
const BORDER = 'rgba(255,255,255,0.06)';
const TEXT = '#ffffff';
const POSITIVE = '#34D399';
const NEGATIVE = '#EF4444';

export default function ActiveSeasonBanner({ season, entry, onTap, isPitStopOpen }) {
  if (!season || !entry) return null;

  const alpha = entry.seasonState?.alphaVsSpy || 0;
  const week = entry.seasonState?.currentWeek || season.currentWeek || 1;
  const totalWeeks = Array.isArray(season.weeks) ? season.weeks.length : 4;

  const labelText = isPitStopOpen
    ? 'Pit Stop Open — Review your week'
    : `Season Active — Week ${week} of ${totalWeeks}`;

  const alphaText = `${alpha >= 0 ? '+' : ''}${alpha.toFixed(1)}% alpha`;
  const alphaColor = alpha >= 0 ? POSITIVE : NEGATIVE;

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', duration: 0.3 }}
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (onTap && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onTap();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: BG,
        borderTop: `1px solid ${BORDER}`,
        cursor: onTap ? 'pointer' : 'default',
        overflow: 'hidden',
      }}
    >
      {/* Trophy gold accent bar */}
      <div
        aria-hidden="true"
        style={{
          width: 4,
          alignSelf: 'stretch',
          background: TROPHY_GOLD,
        }}
      />

      <div
        style={{
          flex: 1,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <motion.span
          animate={isPitStopOpen ? { opacity: [1, 0.6, 1] } : { opacity: 1 }}
          transition={
            isPitStopOpen
              ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0 }
          }
          style={{
            fontSize: 13,
            color: TEXT,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {labelText}
        </motion.span>

        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: alphaColor,
            whiteSpace: 'nowrap',
          }}
        >
          {alphaText}
        </span>
      </div>
    </motion.div>
  );
}
