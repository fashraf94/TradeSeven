// src/screens/SeasonDashboard.jsx
//
// Season Dashboard — the screen a user lands on when they tap the
// ActiveSeasonBanner or the "View Dashboard" CTA in SeasonHub. Phase C-3a
// creates the shell: sticky header, tab bar, score hero, and pit-stop
// weekend banner. Later phases fill in the tabs:
//   - C-3b: performance chart + portfolio strip (Overview tab)
//   - C-3c: activity feed (Overview tab)
//   - C-5:  leaderboard, algorithm, day-by-day tabs
//
// Props:
//   user              - current user object
//   season            - the active season document (from App.jsx)
//   entry             - the user's active seasonEntry (from App.jsx)
//   onBack            - back button callback
//   onOpenPitStop     - pit stop CTA callback (placeholder until C-4)
//   onNavigateHub     - navigate to Season Hub (accepted for future overflow menu)

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { HOLO_COLORS } from '../constants/holoTheme';
import SeasonScoreHeader from '../components/Season/SeasonScoreHeader';
import SeasonPerformanceChart from '../components/Season/SeasonPerformanceChart';
import SeasonPortfolioStrip from '../components/Season/SeasonPortfolioStrip';
import SeasonActivityFeed from '../components/Season/SeasonActivityFeed';
import SeasonLeaderboard from '../components/Season/SeasonLeaderboard';
import { FORGE_CATEGORIES, FORGE_RULE_TEMPLATES } from '../data/forgeKnowledgeBase';

const TROPHY_GOLD = '#F0C75E';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'algorithm', label: 'My Algorithm' },
  { key: 'dayByDay', label: 'Day-by-Day' },
];

// ─── Helpers ─────────────────────────────────────────────────

function BackArrow() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function LockIcon({ open }) {
  // Inline SVG padlock — avoids cross-platform emoji rendering differences
  if (open) {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={TROPHY_GOLD}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Pit stop open"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={HOLO_COLORS.textMuted}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Pit stop closed"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function PlaceholderPanel({ children }) {
  return (
    <div
      style={{
        padding: 24,
        marginTop: 16,
        textAlign: 'center',
        color: HOLO_COLORS.textMuted,
        background: HOLO_COLORS.bgElevated,
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderRadius: 12,
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

// ─── My Algorithm tab ───────────────────────────────────────────

function AlgorithmPanel({ algorithm }) {
  const rules = Array.isArray(algorithm?.rules) ? algorithm.rules : [];
  const version = algorithm?.version || 1;
  const count = algorithm?.ruleCount ?? rules.length;

  if (rules.length === 0) {
    return (
      <PlaceholderPanel>
        No rules equipped. Refine your algorithm in the Forge to start trading.
      </PlaceholderPanel>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: HOLO_COLORS.textPrimary,
          }}
        >
          My Algorithm{' '}
          <span style={{ color: HOLO_COLORS.textMuted, fontSize: 13, fontWeight: 500 }}>
            v{version}
          </span>
        </h3>
        <span style={{ fontSize: 12, color: HOLO_COLORS.textMuted }}>
          {count} rule{count === 1 ? '' : 's'} equipped
        </span>
      </div>
      {rules.map((rule) => {
        const template = FORGE_RULE_TEMPLATES.find((t) => t.id === rule.ruleId);
        const name = template?.headline || rule.ruleId;
        const categoryId = template?.category || rule.category;
        const cat = FORGE_CATEGORIES.find((c) => c.id === categoryId);
        const catColor = cat?.color || HOLO_COLORS.textMuted;
        const catLabel = cat?.label || categoryId || '';
        const paramSummary = rule.params
          ? Object.entries(rule.params)
              .map(([k, v]) => `${k}: ${typeof v === 'number' ? v : JSON.stringify(v)}`)
              .join(' · ')
          : '';
        return (
          <div
            key={rule.ruleId}
            style={{
              background: HOLO_COLORS.bgElevated,
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              borderLeft: `3px solid ${catColor}`,
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: HOLO_COLORS.textPrimary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <span
                    style={{
                      color: HOLO_COLORS.textMuted,
                      marginRight: 8,
                      fontFamily: 'monospace',
                      fontSize: 11,
                    }}
                  >
                    {rule.ruleId}
                  </span>
                  {name}
                </div>
              </div>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 600,
                  background: `${catColor}1A`,
                  color: catColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  flexShrink: 0,
                }}
              >
                {catLabel}
              </span>
            </div>
            {paramSummary && (
              <div
                style={{
                  fontSize: 11,
                  color: HOLO_COLORS.textMuted,
                  marginTop: 6,
                  fontFamily: 'monospace',
                }}
              >
                {paramSummary}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Day-by-Day tab ─────────────────────────────────────────────

function DayByDayPanel({ snapshots }) {
  const POSITIVE = '#34D399';
  const NEGATIVE = '#EF4444';
  const MUTED = '#8B949E';
  const list = Array.isArray(snapshots) ? snapshots.slice().reverse() : [];

  if (list.length === 0) {
    return (
      <PlaceholderPanel>
        No trading days recorded yet. Day 1 snapshots post after the first evaluation.
      </PlaceholderPanel>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          fontSize: 11,
          color: HOLO_COLORS.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: 600,
          marginBottom: 10,
          paddingLeft: 4,
        }}
      >
        {list.length} Trading Day{list.length === 1 ? '' : 's'}
      </div>
      {list.map((snap) => {
        const dailyAlpha = typeof snap?.dailyAlpha === 'number' ? snap.dailyAlpha : null;
        const cumulativeAlpha = typeof snap?.alpha === 'number' ? snap.alpha : null;
        const trades = snap?.tradesExecuted ?? 0;
        const color =
          dailyAlpha == null
            ? HOLO_COLORS.textPrimary
            : dailyAlpha >= 0
            ? POSITIVE
            : NEGATIVE;
        return (
          <div
            key={snap?.day ?? snap?.date}
            style={{
              background: HOLO_COLORS.bgElevated,
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 44,
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Day
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: HOLO_COLORS.textPrimary,
                  lineHeight: 1.2,
                }}
              >
                {snap?.day ?? '—'}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: HOLO_COLORS.textPrimary, fontWeight: 600 }}>
                {snap?.date || ''}
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                {trades} trade{trades === 1 ? '' : 's'} ·{' '}
                {snap?.positionCount != null ? `${snap.positionCount} positions` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color,
                }}
              >
                {dailyAlpha != null
                  ? `${dailyAlpha >= 0 ? '+' : ''}${dailyAlpha.toFixed(2)}%`
                  : '—'}
              </div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
                cum{' '}
                {cumulativeAlpha != null
                  ? `${cumulativeAlpha >= 0 ? '+' : ''}${cumulativeAlpha.toFixed(2)}%`
                  : '—'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────

function SeasonDashboard({
  user, // eslint-disable-line no-unused-vars
  season,
  entry,
  onBack,
  onOpenPitStop,
  // eslint-disable-next-line no-unused-vars -- TODO C-3b: wire into overflow menu
  onNavigateHub,
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [leaderboard, setLeaderboard] = useState(null);

  // Self-load leaderboard doc for rank display. May not exist pre-Day-1 —
  // the snap.exists() guard handles that gracefully.
  useEffect(() => {
    if (!season?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'seasonLeaderboard', season.id));
        if (!cancelled && snap.exists()) {
          setLeaderboard(snap.data());
        }
      } catch (err) {
        console.error('[SeasonDashboard] Failed to load leaderboard:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [season?.id]);

  // Guard: missing season/entry. Normally App.jsx redirects to SeasonHub when
  // activeSeason is null, but render a minimal fallback here just in case.
  if (!season || !entry) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: HOLO_COLORS.bgCard,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          color: HOLO_COLORS.textMuted,
        }}
      >
        <div style={{ marginBottom: 16, fontSize: 14 }}>No active season.</div>
        <button
          onClick={onBack}
          style={{
            padding: '10px 20px',
            background: 'transparent',
            color: HOLO_COLORS.primary,
            border: `1px solid ${HOLO_COLORS.primary}`,
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>
    );
  }

  // Derived values for header + banner
  const isPitStopOpen = Boolean(
    entry.isPitStopOpen || season.isPitStopWeekend
  );
  const week = entry.seasonState?.currentWeek || season.currentWeek || 1;
  const totalWeeks = Array.isArray(season.weeks) ? season.weeks.length : 4;

  // Rank from leaderboard
  const myRankRow = leaderboard?.rankings?.find(
    (r) => r.entryId === entry.id
  );
  const rank = myRankRow?.rank ?? null;
  const totalParticipants = leaderboard?.stats?.participantCount ?? null;

  // Pre-Day-1 pending-construction state for Overview tab
  const isPending =
    (entry.dailySnapshots?.length ?? 0) === 0 &&
    (entry.portfolio?.positionCount ?? 0) === 0;

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
      {/* ─── Sticky header ─── */}
      <div
        style={{
          background: HOLO_COLORS.bgElevated,
          borderBottom: `1px solid ${
            isPitStopOpen ? TROPHY_GOLD : HOLO_COLORS.borderSubtle
          }`,
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
            gap: 12,
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
            <BackArrow />
            Back
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <h1
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: HOLO_COLORS.textPrimary,
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {season.name || 'Season'}
            </h1>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                background: HOLO_COLORS.bgDeep || '#0a0e14',
                border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                borderRadius: 10,
                color: HOLO_COLORS.textSecondary,
                whiteSpace: 'nowrap',
              }}
            >
              Week {week}/{totalWeeks}
            </span>
            <LockIcon open={isPitStopOpen} />
          </div>

          <div style={{ width: 60 }} />
        </div>
      </div>

      {/* ─── Body ─── */}
      <div
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '16px',
          paddingBottom: '120px',
        }}
      >
        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  position: 'relative',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  color: isActive
                    ? HOLO_COLORS.textPrimary
                    : HOLO_COLORS.textMuted,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="seasonDashboardTabUnderline"
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: -1,
                      height: 2,
                      background: TROPHY_GOLD,
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div style={{ marginTop: 20 }}>
          {activeTab === 'overview' && (
            <div>
              <SeasonScoreHeader
                entry={entry}
                season={season}
                rank={rank}
                totalParticipants={totalParticipants}
              />
              {isPending ? (
                <PlaceholderPanel>
                  Portfolio construction happens at market close on Day 1.
                  <br />
                  Your entry rules will scan the universe automatically.
                  <br />
                  Check back after 5 PM ET.
                </PlaceholderPanel>
              ) : (
                <>
                  <div style={{ marginTop: 16 }}>
                    <SeasonPerformanceChart
                      dailySnapshots={entry.dailySnapshots || []}
                    />
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <SeasonPortfolioStrip
                      positions={entry.portfolio?.positions || {}}
                      cash={entry.portfolio?.cash || 0}
                      cashPct={entry.portfolio?.cashPct || 0}
                    />
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <SeasonActivityFeed
                      recentActivity={entry.recentActivity || []}
                      dailySnapshots={entry.dailySnapshots || []}
                      onLoadDayDetail={() => setActiveTab('dayByDay')}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <SeasonLeaderboard
              leaderboard={leaderboard}
              currentEntryId={entry.id}
            />
          )}
          {activeTab === 'algorithm' && (
            <AlgorithmPanel algorithm={entry.algorithm} />
          )}
          {activeTab === 'dayByDay' && (
            <DayByDayPanel snapshots={entry.dailySnapshots} />
          )}
        </div>

        {/* Pit stop weekend banner — floats at the bottom of content,
            scrolls with the page (not fixed) */}
        {isPitStopOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            onClick={onOpenPitStop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (onOpenPitStop && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onOpenPitStop();
              }
            }}
            style={{
              marginTop: 20,
              padding: '14px 16px',
              border: `1px solid ${TROPHY_GOLD}`,
              borderRadius: 12,
              background: 'rgba(240, 199, 94, 0.08)',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <motion.span
              animate={{ opacity: [1, 0.6, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                color: TROPHY_GOLD,
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              🏁 Pit Stop Open — Review your week and tune your algorithm
            </motion.span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

SeasonDashboard.displayName = 'SeasonDashboard';

export default SeasonDashboard;
