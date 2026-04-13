// src/screens/PitStopScreen.jsx
//
// Pit Stop — the weekly ritual screen for Season mode. Every Saturday the
// cron opens a `seasonEntries/{id}/pitStops/{week}` doc with `status: 'open'`
// and `debrief: null`. The user lands here to review the AI-generated debrief,
// chat with their agent, tune rules, add to their shortlist, and lock in
// changes by Sunday night.
//
// Phase C-4a (this file): screen shell, sticky header, debrief section with
// lazy generation + skeleton loader. Completed / empty / error states.
//
// Phase C-4b (follow-up): conversation, action cards (suggestedChanges),
// shortlist, and sticky lock-in bar — placeholder comment blocks below.
//
// Props:
//   user   - current user object (unused in C-4a; reserved for C-4b auth UX)
//   season - the active season document
//   entry  - the user's active seasonEntry document
//   onBack - back button callback

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { HOLO_COLORS } from '../constants/holoTheme';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import PitStopConversation from '../components/Season/PitStopConversation';
import PitStopShortlist from '../components/Season/PitStopShortlist';
import PitStopChanges from '../components/Season/PitStopChanges';
import PitStopLockInBar from '../components/Season/PitStopLockInBar';

const TROPHY_GOLD = '#F0C75E';

// ─── Small inline SVG helpers ────────────────────────────────

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

// ─── Sticky header ────────────────────────────────────────────

function StickyHeader({ onBack, week, totalWeeks }) {
  return (
    <div
      style={{
        background: HOLO_COLORS.bgElevated,
        borderBottom: `1px solid ${TROPHY_GOLD}`,
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
              letterSpacing: 0.3,
            }}
          >
            Weekly Review
          </h1>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 8px',
              background: HOLO_COLORS.bgDeep,
              border: `1px solid ${TROPHY_GOLD}`,
              borderRadius: 10,
              color: TROPHY_GOLD,
              whiteSpace: 'nowrap',
            }}
          >
            Week {week}
            {totalWeeks ? `/${totalWeeks}` : ''}
          </span>
        </div>

        <div style={{ width: 60 }} />
      </div>
    </div>
  );
}

// ─── Debrief skeleton loader ─────────────────────────────────

function DebriefSkeleton() {
  const lines = [
    { width: '85%', delay: 0 },
    { width: '70%', delay: 0.2 },
    { width: '90%', delay: 0.4 },
    { width: '60%', delay: 0.6 },
    { width: '75%', delay: 0.8 },
    { width: '80%', delay: 1.0 },
  ];

  return (
    <div>
      <span
        style={{
          fontSize: 12,
          color: HOLO_COLORS.textMuted,
          marginBottom: 10,
          display: 'block',
          fontStyle: 'italic',
        }}
      >
        Agent is reviewing your week...
      </span>
      {lines.map((line, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: line.delay, duration: 0.2 }}
          style={{
            height: 12,
            width: line.width,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 6,
            marginBottom: 8,
          }}
        />
      ))}
    </div>
  );
}

// ─── Ticker pill ─────────────────────────────────────────────

function HighlightPill({ highlight }) {
  const isWin = highlight.type === 'win';
  const bg = isWin ? 'rgba(0, 255, 136, 0.12)' : 'rgba(255, 51, 102, 0.12)';
  const border = isWin ? 'rgba(0, 255, 136, 0.35)' : 'rgba(255, 51, 102, 0.35)';
  const color = isWin ? HOLO_COLORS.green : HOLO_COLORS.red;

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: '8px 12px',
        minWidth: 0,
        flex: '1 1 140px',
        maxWidth: 220,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color,
          marginBottom: 2,
          letterSpacing: 0.3,
        }}
      >
        {highlight.ticker || '—'}
      </div>
      <div
        style={{
          fontSize: 11,
          color: HOLO_COLORS.textSecondary,
          lineHeight: 1.35,
          whiteSpace: 'normal',
        }}
      >
        {highlight.detail}
      </div>
    </div>
  );
}

// ─── Debrief card ────────────────────────────────────────────

function DebriefSectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: TROPHY_GOLD,
        marginTop: 16,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function DebriefCard({ debrief, agentName, week, loading }) {
  const avatarLetter = (agentName || 'A').trim().charAt(0).toUpperCase() || 'A';

  return (
    <div
      style={{
        background: HOLO_COLORS.bgElevated,
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderLeft: `3px solid ${TROPHY_GOLD}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${TROPHY_GOLD}, #b9892c)`,
            color: '#1a1200',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 800,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {avatarLetter}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: HOLO_COLORS.textPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {agentName || 'Your Agent'}
          </span>
          <span
            style={{
              fontSize: 11,
              color: HOLO_COLORS.textMuted,
            }}
          >
            Week {week} debrief
          </span>
        </div>
      </div>

      {/* Loading skeleton or debrief body */}
      {loading || !debrief ? (
        <DebriefSkeleton />
      ) : (
        <>
          {/* Summary / narrative */}
          {debrief.summary && (
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: HOLO_COLORS.textPrimary,
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}
            >
              {debrief.summary}
            </p>
          )}

          {/* Highlights */}
          {Array.isArray(debrief.highlights) && debrief.highlights.length > 0 && (
            <>
              <DebriefSectionLabel>Highlights</DebriefSectionLabel>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {debrief.highlights.map((h, i) => (
                  <HighlightPill key={`${h.ticker || 'x'}-${i}`} highlight={h} />
                ))}
              </div>
            </>
          )}

          {/* Rule Insights */}
          {Array.isArray(debrief.ruleInsights) && debrief.ruleInsights.length > 0 && (
            <>
              <DebriefSectionLabel>Rule Insights</DebriefSectionLabel>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {debrief.ruleInsights.map((r, i) => (
                  <li
                    key={`${r.ruleId || 'rule'}-${i}`}
                    style={{
                      fontSize: 12,
                      color: HOLO_COLORS.textSecondary,
                      lineHeight: 1.5,
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                    }}
                  >
                    <span
                      style={{
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: 11,
                        color: HOLO_COLORS.primary,
                        background: 'rgba(0, 217, 255, 0.08)',
                        border: `1px solid rgba(0, 217, 255, 0.25)`,
                        borderRadius: 4,
                        padding: '1px 6px',
                        flexShrink: 0,
                      }}
                    >
                      {r.ruleId || '—'}
                    </span>
                    <span>{r.insight}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Upcoming Events */}
          {Array.isArray(debrief.upcomingEvents) && debrief.upcomingEvents.length > 0 && (
            <>
              <DebriefSectionLabel>Upcoming Events</DebriefSectionLabel>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {debrief.upcomingEvents.map((ev, i) => (
                  <li
                    key={`${ev.type || 'ev'}-${i}`}
                    style={{
                      fontSize: 12,
                      color: HOLO_COLORS.textSecondary,
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: HOLO_COLORS.textPrimary, fontWeight: 600 }}>
                      {ev.date ? `${ev.date} · ` : ''}
                      {ev.type}
                    </span>
                    {ev.note ? ` — ${ev.note}` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Completed banner ────────────────────────────────────────

function CompletedBanner({ pitStop }) {
  const validated = Array.isArray(pitStop.validatedChanges)
    ? pitStop.validatedChanges.length
    : 0;
  const rejected = Array.isArray(pitStop.rejectedChanges)
    ? pitStop.rejectedChanges.length
    : 0;

  return (
    <div
      style={{
        background: 'rgba(16, 185, 129, 0.1)',
        border: `1px solid rgba(16, 185, 129, 0.35)`,
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: HOLO_COLORS.greenMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
      >
        Weekly review completed — changes applied
      </span>
      <span
        style={{
          fontSize: 11,
          color: HOLO_COLORS.textSecondary,
        }}
      >
        {validated} applied · {rejected} rejected
      </span>
    </div>
  );
}

// ─── Empty / error states ────────────────────────────────────

function CenteredState({ title, message, children }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: HOLO_COLORS.textPrimary,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: HOLO_COLORS.textSecondary,
          maxWidth: 340,
          lineHeight: 1.5,
        }}
      >
        {message}
      </div>
      {children}
    </div>
  );
}

function NoPitStopState() {
  return (
    <CenteredState
      title="No weekly review available"
      message="Your next weekly review window opens over the weekend. Check back Saturday morning for your weekly debrief."
    />
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <CenteredState
      title="Something went wrong"
      message={message || 'We couldn\'t load your weekly review. Please try again.'}
    >
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 4,
            padding: '10px 18px',
            background: HOLO_COLORS.primary,
            color: '#0a0e14',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      )}
    </CenteredState>
  );
}

// ─── Main screen ─────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars -- `user` reserved for C-4b auth UX
export default function PitStopScreen({ user, season, entry, onBack }) {
  const currentWeek = entry?.seasonState?.currentWeek || season?.currentWeek || 1;
  const totalWeeks = season?.totalWeeks || season?.weekCount || null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [pitStop, setPitStop] = useState(null);
  const [debrief, setDebrief] = useState(null);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [debriefError, setDebriefError] = useState(null);
  const [agentName, setAgentName] = useState(null);
  // Bump to force a re-run of the load effect after a retry.
  const [reloadKey, setReloadKey] = useState(0);

  // Re-read the pitStop doc without the full loading cycle. Child components
  // (conversation, shortlist, changes) call this after their own writes so
  // the screen reflects the latest server-enriched state. Keeping
  // `loading`/`debrief` untouched prevents the screen from flashing back to
  // the skeleton between writes.
  const refreshPitStop = useCallback(async () => {
    if (!entry?.id) return;
    try {
      const pitStopRef = doc(
        db,
        'seasonEntries',
        entry.id,
        'pitStops',
        String(currentWeek),
      );
      const snap = await getDoc(pitStopRef);
      if (!snap.exists()) return;
      const next = { id: snap.id, ...snap.data() };
      setPitStop(next);
      if (next.debrief) {
        setDebrief(next.debrief);
      }
    } catch (err) {
      console.error('[PitStopScreen] refresh failed', err);
    }
  }, [entry?.id, currentWeek]);

  // Generate debrief via API (lazy path for uncached pit stops).
  const generateDebrief = useCallback(async () => {
    if (!entry?.id) return;
    setDebriefLoading(true);
    setDebriefError(null);
    try {
      const response = await fetchWithAuth('/api/season/generate-debrief', {
        method: 'POST',
        body: JSON.stringify({ entryId: entry.id, week: currentWeek }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      setDebrief(data.debrief);
    } catch (err) {
      console.error('[PitStopScreen] generateDebrief failed', err);
      setDebriefError(err.message || 'Failed to generate debrief');
    } finally {
      setDebriefLoading(false);
    }
  }, [entry?.id, currentWeek]);

  // Load the pitStop doc (and optional agent doc for the bubble header).
  useEffect(() => {
    let cancelled = false;
    if (!entry?.id) return;

    async function load() {
      setLoading(true);
      setLoadError(null);
      setDebrief(null);
      setDebriefError(null);
      try {
        const pitStopRef = doc(
          db,
          'seasonEntries',
          entry.id,
          'pitStops',
          String(currentWeek),
        );
        const pitStopSnap = await getDoc(pitStopRef);

        if (cancelled) return;

        if (!pitStopSnap.exists()) {
          setPitStop(null);
          setLoading(false);
          return;
        }

        const pitStopData = { id: pitStopSnap.id, ...pitStopSnap.data() };
        setPitStop(pitStopData);

        if (pitStopData.debrief) {
          setDebrief(pitStopData.debrief);
        }

        setLoading(false);

        // Fetch agent name for the debrief bubble (best-effort).
        if (entry.agentId) {
          try {
            const agentSnap = await getDoc(doc(db, 'agents', entry.agentId));
            if (!cancelled && agentSnap.exists()) {
              const agentData = agentSnap.data();
              setAgentName(agentData.name || null);
            }
          } catch (agentErr) {
            console.warn('[PitStopScreen] agent fetch failed', agentErr);
          }
        }

        // Lazy-generate debrief when the pit stop is open but uncached.
        if (
          !cancelled &&
          !pitStopData.debrief &&
          pitStopData.status === 'open'
        ) {
          generateDebrief();
        }
      } catch (err) {
        console.error('[PitStopScreen] load failed', err);
        if (!cancelled) {
          setLoadError(err.message || 'Failed to load pit stop');
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // generateDebrief is intentionally omitted — it's stable for the lifetime
    // of this screen and re-creating it would re-run the loader on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id, currentWeek, reloadKey]);

  // ─── Render ────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: '100vh',
        background: HOLO_COLORS.bgCard,
        overflowX: 'hidden',
      }}
    >
      <StickyHeader onBack={onBack} week={currentWeek} totalWeeks={totalWeeks} />

      <div
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '16px',
          paddingBottom: '120px',
        }}
      >
        {loading && (
          <DebriefCard
            debrief={null}
            agentName={agentName}
            week={currentWeek}
            loading
          />
        )}

        {!loading && loadError && (
          <ErrorState
            message={loadError}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        )}

        {!loading && !loadError && !pitStop && <NoPitStopState />}

        {!loading && !loadError && pitStop && (
          <>
            {pitStop.status === 'completed' && <CompletedBanner pitStop={pitStop} />}

            {/* Debrief bubble — shows skeleton while fetching, error card on failure */}
            {debriefError ? (
              <ErrorState message={debriefError} onRetry={generateDebrief} />
            ) : (
              <DebriefCard
                debrief={debrief}
                agentName={agentName}
                week={currentWeek}
                loading={debriefLoading || (!debrief && pitStop.status === 'open')}
              />
            )}

            {/* Algorithm changes — open pit stops only */}
            {pitStop.status === 'open' && (
              <PitStopChanges
                entryId={entry.id}
                week={currentWeek}
                changes={pitStop.changes || []}
                algorithmRules={entry.algorithm?.rules || []}
                isOpen
                onRefreshPitStop={refreshPitStop}
              />
            )}

            {/* Conversation — rendered for both open and completed (read-only when closed) */}
            <PitStopConversation
              entryId={entry.id}
              week={currentWeek}
              conversation={pitStop.conversation || []}
              conversationCount={pitStop.conversationCount || 0}
              isOpen={pitStop.status === 'open'}
              onRefreshPitStop={refreshPitStop}
            />

            {/* Shortlist — open pit stops only */}
            {pitStop.status === 'open' && (
              <PitStopShortlist
                entryId={entry.id}
                week={currentWeek}
                universe={season?.universe || []}
                currentShortlist={pitStop.shortlist || []}
                currentPositions={entry.portfolio?.positions || {}}
                isOpen
                onRefreshPitStop={refreshPitStop}
              />
            )}

            {/* Lock-in bar — open pit stops only, sits at end of content */}
            {pitStop.status === 'open' && (
              <PitStopLockInBar
                week={currentWeek}
                entryId={entry.id}
                changes={pitStop.changes || []}
                shortlist={pitStop.shortlist || []}
                onLockIn={onBack}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
