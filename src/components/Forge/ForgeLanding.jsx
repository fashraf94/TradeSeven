// src/components/Forge/ForgeLanding.jsx
//
// ForgeLanding — the Strategy Laboratory front door for the Forge tab.
//
// The page tells a story in four chapters keyed off the user's progression:
//
//   State 1 — `new`:       no experiments, no deployed strategy
//   State 2 — `testing`:   an experiment is running in the Proving Ground
//   State 3 — `results`:   latest experiment is completed, nothing deployed
//   State 4 — `deployed`:  agent.deployedStrategy is live in the arena
//
// Three design threads connect the four states:
//   1. Mini radar chart in states 2–4 gives the strategy a visual identity
//   2. Agent card below each view adapts its tone to the current chapter
//   3. Exactly one primary CTA per state (teal/trophy-gold button); secondary
//      actions are always text links, never competing buttons
//
// The "Advanced" tab still renders ForgeScreen full-bleed; that path is
// unchanged — only the Laboratory view has been redesigned.

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hammer,
  Beaker,
  ArrowRight,
} from 'lucide-react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import ForgeScreen from './ForgeScreen';
import WorkshopChat from './WorkshopChat';

// ── Design tokens (kept in sync with the rest of the Forge palette) ─────
const TROPHY_GOLD = '#F0C75E';
const TEAL = '#5EEAD4';
const POSITIVE = '#34D399';
const NEGATIVE = '#EF4444';
const WARNING = '#F59E0B';
const PAGE_BG = '#0D0E12';
const CARD_BG = '#15171E';
const SURFACE_BG = '#1C1A27';
const TEXT_PRIMARY = '#F1F5F9';
const TEXT_SECONDARY = '#8B949E';
const TEXT_MUTED = '#6E7681';
const BORDER_SUBTLE = '#21262D';

// ── Helpers ─────────────────────────────────────────────────────────────

function formatPct(value, withSign = true) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const prefix = withSign && value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

function isPitStopOpen(season, entry) {
  if (!entry) return false;
  return Boolean(entry.isPitStopOpen || season?.isPitStopWeekend);
}

// v1 grade formula — pending Forge Score integration. Mapped from alpha:
//   A ≥ +5%, B ≥ +2%, C ≥ 0%, D ≥ -3%, F < -3%
function computeGrade(alpha) {
  if (typeof alpha !== 'number' || Number.isNaN(alpha)) return null;
  if (alpha >= 5) return 'A';
  if (alpha >= 2) return 'B';
  if (alpha >= 0) return 'C';
  if (alpha >= -3) return 'D';
  return 'F';
}

function gradeColor(grade) {
  if (grade === 'A' || grade === 'B') return POSITIVE;
  if (grade === 'C') return WARNING;
  return NEGATIVE;
}

// State detection — priority order: deployed > testing > results > new.
function getLandingState({ activeExperiment, completedExperiments, deployedStrategy }) {
  if (deployedStrategy) return 'deployed';
  if (activeExperiment) return 'testing';
  if (completedExperiments?.length > 0) return 'results';
  return 'new';
}

// ── Shell: tabs header ──────────────────────────────────────────────────

function TabPill({ tabs, activeTab, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: SURFACE_BG,
        border: `1px solid ${BORDER_SUBTLE}`,
        borderRadius: 10,
        position: 'relative',
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              position: 'relative',
              background: 'transparent',
              border: 'none',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: active ? '#0D0E12' : TEXT_SECONDARY,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              zIndex: 1,
              transition: 'color 0.2s ease',
            }}
          >
            {active && (
              <motion.div
                layoutId="forge-tab-pill"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: TROPHY_GOLD,
                  borderRadius: 8,
                  zIndex: -1,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            {tab.Icon ? <tab.Icon size={14} /> : null}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Placeholder views (filled in Phases 2–5) ────────────────────────────

function NewUserHero(/* props wired in Phase 2 */) {
  return (
    <div style={{ padding: 24, color: TEXT_MUTED, fontSize: 13 }}>
      {/* Phase 2 fills this in */}
      New user hero — coming in Phase 2.
    </div>
  );
}

function TestingView(/* props wired in Phase 3 */) {
  return (
    <div style={{ padding: 24, color: TEXT_MUTED, fontSize: 13 }}>
      {/* Phase 3 fills this in */}
      Testing view — coming in Phase 3.
    </div>
  );
}

function ResultsView(/* props wired in Phase 4 */) {
  return (
    <div style={{ padding: 24, color: TEXT_MUTED, fontSize: 13 }}>
      {/* Phase 4 fills this in */}
      Results view — coming in Phase 4.
    </div>
  );
}

function DeployedView(/* props wired in Phase 5 */) {
  return (
    <div style={{ padding: 24, color: TEXT_MUTED, fontSize: 13 }}>
      {/* Phase 5 fills this in */}
      Deployed view — coming in Phase 5.
    </div>
  );
}

function AgentCard(/* props wired in Phase 6 */) {
  return (
    <div style={{ padding: 14, marginTop: 16, color: TEXT_MUTED, fontSize: 13 }}>
      {/* Phase 6 fills this in */}
      Agent card — coming in Phase 6.
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export default function ForgeLanding({
  // ForgeScreen pass-through props
  isMobile,
  onClose,
  user,
  onNavigateToSeasonHub,
  // Active experiment state (from App.jsx). `activeSeasonEntry` is the
  // currently-focused entry (used for the daily briefing panel and as
  // the fallback when only one experiment is live). `activeSeasonEntries`
  // is the full list — up to MAX_CONCURRENT entries.
  activeSeason,
  activeSeasonEntry,
  activeSeasonEntries = [],
  activeSeasonsById = {},
  // Agent
  agent,
  // Season navigation callbacks
  onViewDashboard,
  onJoinSeason,
  onReviewSeason,
}) {
  const [view, setView] = useState('laboratory');
  const [seasons, setSeasons] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyLog, setDailyLog] = useState(null);
  const [dailyLogLoading, setDailyLogLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [workshopOpen, setWorkshopOpen] = useState(false);

  // Fetch all seasons + user's entries
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const seasonsSnap = await getDocs(collection(db, 'seasons'));
        const entriesSnap = await getDocs(
          query(collection(db, 'seasonEntries'), where('userId', '==', user.uid))
        );
        if (cancelled) return;
        setSeasons(seasonsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setEntries(entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        if (!cancelled) console.error('[ForgeLanding] Failed to load seasons:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // Fetch the most recent dailyLog for the active experiment (used by State 2)
  useEffect(() => {
    let cancelled = false;
    async function loadDailyLog() {
      if (!activeSeasonEntry?.id) {
        setDailyLog(null);
        return;
      }
      setDailyLogLoading(true);
      try {
        const currentDay =
          activeSeasonEntry?.seasonState?.currentDay ??
          activeSeason?.currentDay ??
          0;
        const candidates = [currentDay, currentDay - 1].filter((d) => d >= 0);
        let found = null;
        for (const dayNum of candidates) {
          const ref = doc(
            db,
            'seasonEntries',
            activeSeasonEntry.id,
            'dailyLogs',
            String(dayNum)
          );
          const snap = await getDoc(ref);
          if (cancelled) return;
          if (snap.exists()) {
            found = { id: snap.id, ...snap.data() };
            break;
          }
        }
        if (!cancelled) setDailyLog(found);
      } catch (err) {
        if (!cancelled) {
          console.error('[ForgeLanding] Failed to load dailyLog:', err);
          setDailyLog(null);
        }
      } finally {
        if (!cancelled) setDailyLogLoading(false);
      }
    }
    loadDailyLog();
    return () => {
      cancelled = true;
    };
  }, [activeSeasonEntry?.id, activeSeasonEntry?.seasonState?.currentDay, activeSeason?.currentDay]);

  // Build categorized experiment lists: completed (for State 3 / past-rows)
  // and the next upcoming season (for launch callbacks).
  const { past, nextUpcoming } = useMemo(() => {
    const entryMap = new Map(entries.map((e) => [e.seasonId, e]));
    const pastList = seasons
      .filter((s) => s.status === 'completed' && entryMap.has(s.id))
      .map((s) => ({ ...s, entry: entryMap.get(s.id) }));
    // Sort completed with most-recent first — SeasonEntry.completedAt if
    // present, otherwise fall back to the season's end/start date.
    pastList.sort((a, b) => {
      const aT = a.entry?.completedAt
        ? new Date(a.entry.completedAt).getTime()
        : a.endDate
        ? new Date(a.endDate).getTime()
        : 0;
      const bT = b.entry?.completedAt
        ? new Date(b.entry.completedAt).getTime()
        : b.endDate
        ? new Date(b.endDate).getTime()
        : 0;
      return bT - aT;
    });
    const upcomingList = seasons.filter(
      (s) => s.status === 'upcoming' || s.status === 'active'
    );
    upcomingList.sort((a, b) => {
      const aT = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const bT = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      return aT - bT;
    });
    return { past: pastList, nextUpcoming: upcomingList[0] || null };
  }, [seasons, entries]);

  // Users can run up to MAX_CONCURRENT_EXPERIMENTS simultaneously (the server
  // enforces the same cap in api/season/create-entry.js).
  const MAX_CONCURRENT_EXPERIMENTS = 5;
  const activeEntriesList = useMemo(() => {
    if (Array.isArray(activeSeasonEntries) && activeSeasonEntries.length > 0) {
      return activeSeasonEntries;
    }
    if (activeSeasonEntry) return [activeSeasonEntry];
    return [];
  }, [activeSeasonEntries, activeSeasonEntry]);
  const atLaunchCap = activeEntriesList.length >= MAX_CONCURRENT_EXPERIMENTS;
  const tradingDay =
    activeSeasonEntry?.seasonState?.currentDay ??
    activeSeason?.currentDay ??
    dailyLog?.day ??
    0;

  // ── State detection inputs ─────────────────────────────────────────
  //
  // `activeExperiment` is the focused active entry (fallback to first).
  // `completedExperiments` is the sorted `past` list — latest first.
  // `deployedStrategy` lives on the agent doc (see deployStrategyService).
  // A deployed strategy whose bundle the user manually unequipped in the
  // Advanced tab is treated as not-deployed, matching prior card logic.
  const deployedStrategy = useMemo(() => {
    const ds = agent?.deployedStrategy || null;
    if (!ds || !ds.bundleId) return null;
    const equipped = Array.isArray(agent?.equippedBundleIds)
      ? agent.equippedBundleIds
      : [];
    if (!equipped.includes(ds.bundleId)) return null;
    return ds;
  }, [agent?.deployedStrategy, agent?.equippedBundleIds]);

  const activeExperiment = useMemo(() => {
    if (activeEntriesList.length === 0) return null;
    const focused =
      activeEntriesList.find((e) => e.id === activeSeasonEntry?.id) ||
      activeEntriesList[0];
    const season =
      activeSeasonsById[focused.seasonId] ||
      (activeSeason && activeSeason.id === focused.seasonId ? activeSeason : null);
    return { entry: focused, season };
  }, [activeEntriesList, activeSeasonEntry?.id, activeSeason, activeSeasonsById]);

  const latestCompleted = past[0] || null;

  const landingState = getLandingState({
    activeExperiment,
    completedExperiments: past,
    deployedStrategy,
  });

  // ── Callbacks ──────────────────────────────────────────────────────

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast((prev) => (prev === msg ? null : prev)), 2500);
  };

  const handleBuildStrategy = () => {
    // Workshop Mode — conversational strategy development
    if (!agent?.id) {
      showToast('Create an agent first to use Workshop Mode');
      return;
    }
    if (atLaunchCap) {
      showToast(
        `Maximum ${MAX_CONCURRENT_EXPERIMENTS} concurrent experiments — complete one to start another.`
      );
      return;
    }
    if (!nextUpcoming) {
      showToast('No upcoming experiment to deploy to — check back soon');
      return;
    }
    setWorkshopOpen(true);
  };

  const handleWorkshopCompiled = (result) => {
    setWorkshopOpen(false);
    if (nextUpcoming && onJoinSeason) {
      onJoinSeason(nextUpcoming, {
        initialDimensionValues: result.dimensionValues,
        initialStep: 1,
        workshopThesisId: result.thesisId,
        workshopConfidence: result.confidence,
        workshopMappingNotes: result.mappingNotes,
        workshopWarnings: result.warnings,
      });
    } else {
      showToast('Strategy compiled — but no experiment to deploy to');
    }
  };

  const handleConfigureManually = (opts) => {
    if (atLaunchCap) {
      showToast(
        `Maximum ${MAX_CONCURRENT_EXPERIMENTS} concurrent experiments — complete one to start another.`
      );
      return;
    }
    if (nextUpcoming && onJoinSeason) {
      onJoinSeason(nextUpcoming, opts);
    } else {
      showToast('No upcoming experiments available');
    }
  };

  // ── Advanced view: render ForgeScreen full-bleed ──────────────────
  if (view === 'advanced') {
    return (
      <ForgeScreen
        isMobile={isMobile}
        onClose={onClose}
        user={user}
        onNavigateToSeasonHub={onNavigateToSeasonHub}
        laboratoryOnBack={() => setView('laboratory')}
      />
    );
  }

  // ── Laboratory view ───────────────────────────────────────────────
  const TABS = [
    { id: 'laboratory', label: 'Laboratory', Icon: Beaker },
    { id: 'advanced', label: 'Advanced', Icon: Hammer },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: PAGE_BG,
        color: TEXT_PRIMARY,
        paddingBottom: 80,
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 16px 12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 4,
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: TEXT_MUTED,
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
            }}
          >
            <Hammer size={20} color={TROPHY_GOLD} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: TEXT_PRIMARY,
                lineHeight: 1.2,
              }}
            >
              The Forge
            </h1>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: TROPHY_GOLD,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginTop: 2,
              }}
            >
              Strategy Laboratory
            </div>
          </div>
        </div>
      </div>

      {/* Pill tab bar */}
      <div style={{ padding: '0 16px 16px' }}>
        <TabPill tabs={TABS} activeTab={view} onChange={setView} />
      </div>

      <div style={{ padding: '0 16px', maxWidth: 480, margin: '0 auto' }}>
        {/* ── State-branched body ────────────────────────────────── */}
        {landingState === 'new' && (
          <NewUserHero
            onBuildStrategy={handleBuildStrategy}
            onConfigureManually={handleConfigureManually}
          />
        )}

        {landingState === 'testing' && activeExperiment && (
          <TestingView
            season={activeExperiment.season}
            entry={activeExperiment.entry}
            dailyLog={dailyLog}
            dailyLogLoading={dailyLogLoading}
            tradingDay={tradingDay}
            onViewDashboard={onViewDashboard}
          />
        )}

        {landingState === 'results' && latestCompleted && (
          <ResultsView
            season={latestCompleted}
            entry={latestCompleted.entry}
            past={past}
            onDeploy={() => onViewDashboard && onViewDashboard(latestCompleted, latestCompleted.entry)}
            onRefine={() =>
              handleConfigureManually({
                initialDimensionValues: latestCompleted.entry?.algorithm?.dimensionValues,
                initialStep: 1,
                sourceExperimentId: latestCompleted.entry?.id,
              })
            }
            onReviewReport={() => onReviewSeason && onReviewSeason(latestCompleted, latestCompleted.entry)}
          />
        )}

        {landingState === 'deployed' && (
          <DeployedView
            user={user}
            agent={agent}
            deployedStrategy={deployedStrategy}
            activeExperiment={activeExperiment}
            onOpenCommandCenter={() => onNavigateToSeasonHub && onNavigateToSeasonHub()}
            onStartNewExperiment={() => handleConfigureManually()}
            onViewActiveDashboard={() =>
              activeExperiment &&
              onViewDashboard &&
              onViewDashboard(activeExperiment.season, activeExperiment.entry)
            }
          />
        )}

        {/* ── Agent card — always present, voice adapts to state ── */}
        <AgentCard
          state={landingState}
          agent={agent}
          experiment={activeExperiment?.entry || latestCompleted?.entry}
          deployedStrategy={deployedStrategy}
        />

        {loading && landingState === 'new' && (
          // Tiny courtesy indicator for first-time users while seasons load;
          // everything else renders immediately from props.
          <div style={{ fontSize: 11, color: TEXT_MUTED, textAlign: 'center', marginTop: 12 }}>
            Loading…
          </div>
        )}
      </div>

      {/* Workshop Mode — conversational strategy development */}
      <WorkshopChat
        isOpen={workshopOpen}
        onClose={() => setWorkshopOpen(false)}
        user={user}
        agent={agent}
        onCompiled={handleWorkshopCompiled}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed',
              bottom: 96,
              left: '50%',
              transform: 'translateX(-50%)',
              background: SURFACE_BG,
              border: `1px solid ${TROPHY_GOLD}`,
              color: TEXT_PRIMARY,
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              zIndex: 1000,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              pointerEvents: 'none',
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Re-export helpers so views built in later phases can share them without
// import churn. `dimensionToRadarScore` comes from the shared util and isn't
// re-exported here — import it directly from `src/utils/dimensionRadarScore`.
export {
  TROPHY_GOLD,
  TEAL,
  POSITIVE,
  NEGATIVE,
  WARNING,
  CARD_BG,
  SURFACE_BG,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  BORDER_SUBTLE,
  formatPct,
  isPitStopOpen,
  computeGrade,
  gradeColor,
  getLandingState,
};
