// AgentFilmRoom - Post-market review mode replacing the activity feed
// Shows: daily review, trade grading, bookmarked entries queue, raw log toggle

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Bookmark, ChevronDown, CheckCircle, FileText } from 'lucide-react';
import FilmRoomCard from './FilmRoomCard';
import TradeGradingCard from './TradeGradingCard';
import AgentActivityFeed from './AgentActivityFeed';
import { removeFeedBookmark } from '../../services/agentService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hexToRgba = (hex, alpha) => {
  if (!hex || hex.charAt(0) !== '#') return `rgba(150,150,150,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getEntryId = (entry, index) =>
  entry.evalId || entry.id || `${entry.timestamp || ''}_${index}`;

// ─── Bookmarked Entry Card ────────────────────────────────────────────────────

function BookmarkedEntryCard({ entry, battleId, tokens, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);

  const handleReviewed = useCallback(async () => {
    setDismissed(true);
    try {
      const entryId = entry.evalId || entry.id || `${entry.timestamp || ''}_0`;
      await removeFeedBookmark(battleId, entryId);
      onDismiss?.(entryId);
    } catch (err) {
      console.error('[FilmRoom] Failed to remove bookmark:', err.message);
      setDismissed(false);
    }
  }, [entry, battleId, onDismiss]);

  if (dismissed) return null;

  const actionLabel = entry.action || entry.type || 'Update';
  const timestamp = entry.timestamp
    ? new Date(entry.timestamp).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40 }}
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: tokens.bgCard || '#15171E',
        border: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: tokens.amber || '#f59e0b',
            marginBottom: 3,
          }}>
            {actionLabel}
            {entry.symbolOut && entry.symbolIn && (
              <span style={{ color: tokens.textMuted || '#94a3b8', marginLeft: 6 }}>
                {entry.symbolOut} → {entry.symbolIn}
              </span>
            )}
          </div>
          <p style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: tokens.textSecondary || '#cbd5e1',
            margin: 0,
          }}>
            {entry.message || entry.rationale || 'No details available'}
          </p>
          {timestamp && (
            <span style={{ fontSize: 10, color: tokens.textFaint || '#64748b', marginTop: 2 }}>
              {timestamp}
            </span>
          )}
        </div>
        <motion.button
          onClick={handleReviewed}
          whileTap={{ scale: 0.95 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            borderRadius: 8,
            border: `1px solid ${hexToRgba(tokens.teal || '#5eead4', 0.25)}`,
            background: hexToRgba(tokens.teal || '#5eead4', 0.06),
            color: tokens.teal || '#5eead4',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            fontFamily: 'inherit',
          }}
        >
          <CheckCircle size={12} />
          Reviewed
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, count, tokens }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '16px 16px 8px',
    }}>
      <Icon size={14} color={tokens.purple || '#a78bfa'} />
      <span style={{
        fontSize: 12,
        fontWeight: 700,
        color: tokens.textPrimary || '#e2e8f0',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {title}
      </span>
      {count != null && (
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: tokens.textFaint || '#64748b',
        }}>
          ({count})
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentFilmRoom({
  agentBattle,
  agentBattleId,
  statusFeed,
  feedBookmarks,
  tokens,
  onCitationTap,
}) {
  const [showRawLog, setShowRawLog] = useState(false);

  // Get the latest daily review
  const latestReview = useMemo(() => {
    const reviews = agentBattle?.dailyReviews;
    if (!reviews || reviews.length === 0) return null;
    return reviews[reviews.length - 1];
  }, [agentBattle?.dailyReviews]);

  // Resolve bookmarked entries from statusFeed
  const bookmarkedEntries = useMemo(() => {
    if (!feedBookmarks || feedBookmarks.length === 0 || !statusFeed) return [];
    const bookmarkSet = new Set(feedBookmarks);
    const matched = [];
    statusFeed.forEach((entry, index) => {
      const id = getEntryId(entry, index);
      if (bookmarkSet.has(id)) matched.push(entry);
    });
    return matched;
  }, [feedBookmarks, statusFeed]);

  const handleBookmarkDismiss = useCallback(() => {
    // State update handled by Firestore listener via useAgentBattle
  }, []);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      {/* Film Room header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '16px 16px 4px',
      }}>
        <Film size={16} color={tokens.purple || '#a78bfa'} />
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          color: tokens.purple || '#a78bfa',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Film Room
        </span>
      </div>
      <p style={{
        textAlign: 'center',
        fontSize: 11,
        color: tokens.textFaint || '#64748b',
        margin: '0 0 12px',
        padding: '0 16px',
      }}>
        Market closed — review today's performance
      </p>

      {/* Daily Review */}
      {latestReview && (
        <div style={{ padding: '0 12px 8px' }}>
          <FilmRoomCard
            battle={agentBattle}
            agentId={agentBattle?.agentId}
            tokens={tokens}
          />
        </div>
      )}

      {/* Trade Grading */}
      <div style={{ padding: '0 12px 8px' }}>
        <TradeGradingCard battle={agentBattle} tokens={tokens} />
      </div>

      {/* Bookmarked Entries */}
      {bookmarkedEntries.length > 0 && (
        <div>
          <SectionHeader
            icon={Bookmark}
            title="Review Queue"
            count={bookmarkedEntries.length}
            tokens={tokens}
          />
          <div style={{
            padding: '0 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <AnimatePresence>
              {bookmarkedEntries.map((entry, i) => (
                <BookmarkedEntryCard
                  key={getEntryId(entry, i)}
                  entry={entry}
                  battleId={agentBattleId}
                  tokens={tokens}
                  onDismiss={handleBookmarkDismiss}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Raw Log Toggle */}
      <div style={{ padding: '16px 16px 8px' }}>
        <button
          onClick={() => setShowRawLog(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: tokens.textFaint || '#64748b',
            fontSize: 11,
            fontWeight: 600,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          <FileText size={12} />
          <span>{showRawLog ? 'Hide' : 'View'} today's live log</span>
          <motion.span
            animate={{ rotate: showRawLog ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'inline-flex' }}
          >
            <ChevronDown size={12} />
          </motion.span>
        </button>
      </div>

      <AnimatePresence>
        {showRawLog && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ height: 400 }}>
              <AgentActivityFeed
                statusFeed={statusFeed}
                feedBookmarks={feedBookmarks}
                filterTicker={null}
                onClearFilter={() => {}}
                onBookmark={() => {}}
                onUnbookmark={() => {}}
                onChallenge={() => {}}
                onCitationTap={onCitationTap}
                battleId={agentBattleId}
                isAgentVsAgent={false}
                gameplanMeeting={null}
                tokens={tokens}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom padding */}
      <div style={{ height: 80 }} />
    </div>
  );
}
