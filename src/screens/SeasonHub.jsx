// src/screens/SeasonHub.jsx
//
// Season Hub — browse active, upcoming, and past seasons.
//
// Loads all seasons + the user's seasonEntries on mount, categorizes
// them into { active, upcoming, past }, and renders three sections.
// Navigation to the dashboard / entry modal / review is done via
// callback props so the Hub stays decoupled from App.jsx's screen
// naming (C-2c wires those callbacks).
//
// Props:
//   user               - current user object (requires .uid)
//   onBack             - back button callback
//   onViewDashboard    - (season, entry) => void — active card CTA
//   onJoinSeason       - (season) => void       — upcoming card CTA
//   onReviewSeason     - (season, entry) => void — past card CTA

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { HOLO_COLORS } from '../constants/holoTheme';
import HoloCard from '../components/shared/HoloCard';

const TROPHY_GOLD = '#F0C75E';
const POSITIVE = '#34D399';
const NEGATIVE = '#EF4444';

// ─── Helpers ─────────────────────────────────────────────────

function categorizeSeasons(seasons, entries) {
  const entryMap = new Map(entries.map((e) => [e.seasonId, e]));

  const active = seasons
    .filter((s) => s.status === 'active' && entryMap.has(s.id))
    .map((s) => ({ ...s, entry: entryMap.get(s.id) }));

  // "Upcoming" = literally upcoming OR active-but-user-hasn't-joined
  const upcoming = seasons.filter(
    (s) =>
      s.status === 'upcoming' ||
      (s.status === 'active' && !entryMap.has(s.id))
  );

  const past = seasons
    .filter((s) => s.status === 'completed' && entryMap.has(s.id))
    .map((s) => ({ ...s, entry: entryMap.get(s.id) }));

  return { active, upcoming, past };
}

function formatDaysUntil(startDateStr) {
  if (!startDateStr) return null;
  const start = new Date(startDateStr);
  if (Number.isNaN(start.getTime())) return null;
  const now = Date.now();
  const diffMs = start.getTime() - now;
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Starting now';
  if (days === 1) return 'Starts in 1 day';
  return `Starts in ${days} days`;
}

function formatPct(value, withSign = true) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const prefix = withSign && value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

function getPitStopOpen(season, entry) {
  if (!entry) return false;
  return Boolean(entry.isPitStopOpen || season?.isPitStopWeekend);
}

// ─── Sub-components ──────────────────────────────────────────

function ActiveSeasonHero({ season, entry, onViewDashboard }) {
  const alpha = entry.seasonState?.alphaVsSpy ?? 0;
  const totalReturn = entry.portfolio?.totalReturn ?? 0;
  const week = entry.seasonState?.currentWeek || 1;
  const totalWeeks = Array.isArray(season.weeks) ? season.weeks.length : 4;
  const ruleCount = entry.algorithm?.ruleCount ?? (entry.algorithm?.rules?.length || 0);
  const tradingStyle = entry.algorithm?.tradingStyle || entry.algorithm?.description || 'Custom';
  const rank = entry.seasonState?.rank;
  const totalEntries = season.entryCount;
  const isPitStopOpen = getPitStopOpen(season, entry);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <HoloCard
        variant="elevated"
        size="lg"
        style={{
          borderTop: `3px solid ${TROPHY_GOLD}`,
          borderRadius: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '12px',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 700,
                color: HOLO_COLORS.textPrimary,
              }}
            >
              {season.name || 'Current Experiment'}
            </h2>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '13px',
                color: HOLO_COLORS.textSecondary,
              }}
            >
              Week {week} of {totalWeeks} • {ruleCount} rules • {tradingStyle}
            </p>
          </div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: TROPHY_GOLD,
              padding: '4px 8px',
              border: `1px solid ${TROPHY_GOLD}`,
              borderRadius: '4px',
            }}
          >
            Active
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            margin: '16px 0',
            padding: '12px 0',
            borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
            borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
          }}
        >
          <StatBlock label="Alpha" value={formatPct(alpha)} color={alpha >= 0 ? POSITIVE : NEGATIVE} />
          <StatBlock
            label="Return"
            value={formatPct(totalReturn)}
            color={totalReturn >= 0 ? POSITIVE : NEGATIVE}
          />
          <StatBlock
            label="Rank"
            value={rank ? `#${rank}${totalEntries ? ` of ${totalEntries}` : ''}` : '—'}
            color={HOLO_COLORS.textPrimary}
          />
        </div>

        <motion.button
          onClick={() => onViewDashboard && onViewDashboard(season, entry)}
          animate={
            isPitStopOpen ? { opacity: [1, 0.7, 1] } : { opacity: 1 }
          }
          transition={
            isPitStopOpen
              ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0 }
          }
          style={{
            width: '100%',
            padding: '12px 16px',
            background: isPitStopOpen ? TROPHY_GOLD : HOLO_COLORS.primary,
            color: '#0d1117',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {isPitStopOpen ? 'Weekly Review Open' : 'View Dashboard'}
        </motion.button>
      </HoloCard>
    </motion.div>
  );
}

function StatBlock({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: '11px',
          color: HOLO_COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color,
          marginTop: '4px',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function UpcomingSeasonCard({ season, index, onJoinSeason }) {
  const countdown = formatDaysUntil(season.startDate);
  const universeSize = Array.isArray(season.universe) ? season.universe.length : null;
  const entryCount = season.entryCount || 0;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1 * index }}
    >
      <HoloCard variant="default" size="lg">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '8px',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: HOLO_COLORS.textPrimary,
            }}
          >
            {season.name || 'Upcoming Experiment'}
          </h3>
          {countdown && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: HOLO_COLORS.textSecondary,
                padding: '3px 8px',
                background: HOLO_COLORS.bgElevated,
                border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                borderRadius: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              {countdown}
            </span>
          )}
        </div>

        <p
          style={{
            margin: '4px 0 12px',
            fontSize: '13px',
            color: HOLO_COLORS.textSecondary,
          }}
        >
          {universeSize ? `${universeSize} stocks` : 'Universe TBD'}
          {entryCount ? ` • ${entryCount} traders joined` : ''}
        </p>

        <button
          onClick={() => onJoinSeason && onJoinSeason(season)}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: 'transparent',
            color: HOLO_COLORS.primary,
            border: `1px solid ${HOLO_COLORS.primary}`,
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Launch Experiment
        </button>
      </HoloCard>
    </motion.div>
  );
}

function PastSeasonCard({ season, index, onReviewSeason }) {
  const entry = season.entry;
  const alpha = entry?.seasonState?.alphaVsSpy ?? 0;
  const rank = entry?.seasonState?.finalRank || entry?.seasonState?.rank;

  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 10, opacity: 0 }}
      transition={{ duration: 0.3, delay: 0.05 * index }}
    >
      <HoloCard variant="default" size="md">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: HOLO_COLORS.textPrimary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {season.name || 'Past Experiment'}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: HOLO_COLORS.textMuted,
                marginTop: '2px',
              }}
            >
              Alpha: <span style={{ color: alpha >= 0 ? POSITIVE : NEGATIVE, fontWeight: 600 }}>
                {formatPct(alpha)}
              </span>
              {rank ? ` • Rank #${rank}` : ''}
            </div>
          </div>
          <button
            onClick={() => onReviewSeason && onReviewSeason(season, entry)}
            style={{
              padding: '6px 14px',
              background: 'transparent',
              color: HOLO_COLORS.primary,
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Review
          </button>
        </div>
      </HoloCard>
    </motion.div>
  );
}

function SectionHeader({ children }) {
  return (
    <h2
      style={{
        fontSize: '13px',
        fontWeight: 600,
        color: HOLO_COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        margin: '24px 0 12px',
      }}
    >
      {children}
    </h2>
  );
}

function EmptyNotice({ children }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '24px',
        background: HOLO_COLORS.bgElevated,
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderRadius: '12px',
        color: HOLO_COLORS.textMuted,
        fontSize: '13px',
      }}
    >
      {children}
    </div>
  );
}

// ─── Main screen ─────────────────────────────────────────────

const SeasonHub = ({ user, onBack, onViewDashboard, onJoinSeason, onReviewSeason }) => {
  const [seasons, setSeasons] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pastExpanded, setPastExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const seasonsSnap = await getDocs(collection(db, 'seasons'));
        const entriesSnap = await getDocs(
          query(collection(db, 'seasonEntries'), where('userId', '==', user.uid))
        );
        if (cancelled) return;
        setSeasons(seasonsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setEntries(entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        if (cancelled) return;
        console.error('[SeasonHub] Failed to load seasons:', err);
        setError(err.message || 'Failed to load seasons');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const { active, upcoming, past } = useMemo(
    () => categorizeSeasons(seasons, entries),
    [seasons, entries]
  );

  return (
    <div
      style={{
        maxWidth: '100vw',
        width: '100%',
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        background: HOLO_COLORS.bgCard,
        overflowX: 'hidden',
      }}
    >
      {/* Sticky header */}
      <div
        style={{
          background: HOLO_COLORS.bgElevated,
          borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
          padding: '16px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: HOLO_COLORS.primary,
              fontSize: '14px',
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: HOLO_COLORS.textPrimary,
              margin: 0,
            }}
          >
            Proving Ground
          </h1>
          <div style={{ width: '60px' }} />
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '16px',
          paddingBottom: '120px',
        }}
      >
        {loading && (
          <div
            style={{
              textAlign: 'center',
              padding: '40px',
              color: HOLO_COLORS.textMuted,
              fontSize: '14px',
            }}
          >
            Loading seasons...
          </div>
        )}

        {!loading && error && (
          <EmptyNotice>{error}</EmptyNotice>
        )}

        {!loading && !error && (
          <>
            {/* Active section */}
            <SectionHeader>Active Experiment</SectionHeader>
            {active.length === 0 ? (
              <EmptyNotice>
                No active experiment. Launch an upcoming experiment to compete!
              </EmptyNotice>
            ) : (
              active.map((s) => (
                <div key={s.id} style={{ marginBottom: '12px' }}>
                  <ActiveSeasonHero
                    season={s}
                    entry={s.entry}
                    onViewDashboard={onViewDashboard}
                  />
                </div>
              ))
            )}

            {/* Upcoming section */}
            <SectionHeader>Upcoming Experiments</SectionHeader>
            {upcoming.length === 0 ? (
              <EmptyNotice>
                No upcoming experiments yet. Check back soon!
              </EmptyNotice>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {upcoming.map((s, i) => (
                  <UpcomingSeasonCard
                    key={s.id}
                    season={s}
                    index={i}
                    onJoinSeason={onJoinSeason}
                  />
                ))}
              </div>
            )}

            {/* Past section — collapsible, hidden when empty */}
            {past.length > 0 && (
              <>
                <button
                  onClick={() => setPastExpanded((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'transparent',
                    border: 'none',
                    padding: '24px 0 12px',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    stroke={HOLO_COLORS.textSecondary}
                    viewBox="0 0 24 24"
                    strokeWidth="2.5"
                    style={{
                      transform: pastExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: HOLO_COLORS.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Past Experiments ({past.length})
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {pastExpanded && (
                    <motion.div
                      key="past-list"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {past.map((s, i) => (
                          <PastSeasonCard
                            key={s.id}
                            season={s}
                            index={i}
                            onReviewSeason={onReviewSeason}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SeasonHub;
