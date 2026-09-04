// src/screens/battleView/PaneTape.jsx
//
// A3.4 — TAPE (D-94).
//
// The shipped Game Tape's content, moved into the pane: trade cards, bookmarks,
// the activity log. The header link and the full-screen overlay stop being
// rendered under the pane flag, so `gameTapeOpen` stays false and its five
// consumers in the screen are inert without an edit.
//
// THE TRADE CARDS ARE THE CHAT'S OWN. `TradeCard` over the same `tapeEntries`
// the Chat section renders — the "same component" the seed names, and the
// reason a swap cannot read one way in the conversation and another here
// (§9). GameTapeView has its own `TradeRow` with its own arithmetic; that one
// stays where it is, for the flag-off page.
//
// THE FILTERS ARE DROPPED (the seed). GameTapeView's Time / P&L / Tier sort
// controls do not come across: the tape is a record, and a record read in
// chronological order needs no sort.
//
// BOOKMARKS KEEP THEIR SHIPPED CONTROL — a MOVED CLIENT WRITE, and the only
// write anywhere in A3. `removeFeedBookmark` is the same service call
// GameTapeView makes (:508-515); the resolution of a bookmark id back to a
// statusFeed entry is the same `getEntryId` rule, kept here rather than
// re-invented. The dot that used to sit on the header link becomes the COUNT
// on this section's header (the founder's ruling), and appears nowhere on the
// board.
//
// THE ACTIVITY LOG IS THE FEED'S OWN FEATURE. `AgentActivityFeed` as shipped,
// read-only, behind a toggle that is collapsed by default — exactly as
// GameTapeView mounts it. D-88's "unread never reads the raw feed" is about the
// COUNT, which is tape-sourced; the log itself IS the feed, and showing it here
// is showing it for what it is.

import React, { useCallback, useMemo, useState } from 'react';
import { Bookmark, X } from 'lucide-react';
import AgentActivityFeed from '../../components/Agent/AgentActivityFeed';
import { addFeedBookmark, removeFeedBookmark } from '../../services/agentService';
import { cssVar } from '../../theme/cssTokens';
import { TAPE_KIND } from './buildTape';
import { TradeCard } from './TapeCards';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

const mono = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontVariantNumeric: 'tabular-nums',
};

const heading = {
  ...mono,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: cssVar('text-muted'),
};

const empty = { ...mono, fontSize: 11, color: cssVar('text-muted') };

/**
 * A bookmark id, exactly as GameTapeView derives it (:33-34). Kept identical on
 * purpose: the ids in `feedBookmarks` were WRITTEN by that rule, so a second
 * rule here would resolve a saved bookmark to nothing.
 */
const entryIdOf = (entry, index) => entry?.evalId || entry?.id || `${entry?.timestamp || ''}_${index}`;

export default function PaneTape({
  battleId = null,
  tapeEntries = null,
  statusFeed = null,
  feedBookmarks = null,
  tokens = {},
}) {
  const [showLog, setShowLog] = useState(false);

  const trades = useMemo(() => (Array.isArray(tapeEntries)
    ? tapeEntries.filter((e) => e?._type === TAPE_KIND.TRADE)
    : []), [tapeEntries]);

  const bookmarked = useMemo(() => {
    const ids = Array.isArray(feedBookmarks) ? feedBookmarks : [];
    const feed = Array.isArray(statusFeed) ? statusFeed : [];
    if (ids.length === 0 || feed.length === 0) return [];
    const set = new Set(ids);
    const matched = [];
    feed.forEach((entry, index) => {
      const id = entryIdOf(entry, index);
      if (set.has(id)) matched.push({ id, entry });
    });
    return matched.reverse(); // newest first, as the shipped view orders them
  }, [feedBookmarks, statusFeed]);

  const onBookmark = useCallback(async (entryId) => {
    // THE ADD HALF (review lens 5 F3). The first draft moved only `remove` and
    // passed `onBookmark={undefined}`, which left AgentActivityFeed rendering
    // its `Add bookmark` control wired to nothing — so under the pane a player
    // could not add a bookmark anywhere, while looking at the button for it.
    // Ruling #12 and D-94 both say "add / remove".
    if (!battleId || !entryId) return;
    try {
      await addFeedBookmark(battleId, entryId);
    } catch (err) {
      console.error('[PaneTape] addFeedBookmark failed:', err?.message || err);
    }
  }, [battleId]);

  const onUnbookmark = useCallback(async (entryId) => {
    if (!battleId || !entryId) return;
    try {
      await removeFeedBookmark(battleId, entryId);
    } catch (err) {
      // The shipped handler's own posture: a failed bookmark write is logged
      // and never surfaced as a claim about the battle.
      console.error('[PaneTape] removeFeedBookmark failed:', err?.message || err);
    }
  }, [battleId]);

  return (
    <div
      data-pane-tape="1"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '12px 0 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ ...heading, padding: '0 14px' }}>{COPY.tapeTrades}</div>
        {trades.length === 0 ? (
          <div data-tape-no-trades="1" style={{ ...empty, padding: '0 14px' }}>{COPY.tapeNoTrades}</div>
        ) : (
          trades.map((entry) => <TradeCard key={entry.id} entry={entry} />)
        )}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 14px' }}>
        <div data-tape-bookmarks-count={bookmarked.length} style={heading}>
          {COPY.tapeBookmarks(bookmarked.length)}
        </div>
        {bookmarked.length === 0 ? (
          <div style={empty}>{COPY.tapeNoBookmarks}</div>
        ) : (
          bookmarked.map(({ id, entry }) => (
            <div
              key={id}
              data-tape-bookmark={id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                paddingLeft: 10,
                borderLeft: `2px solid ${cssVar('teal')}`,
              }}
            >
              <Bookmark size={11} style={{ color: cssVar('teal'), flexShrink: 0, marginTop: 3 }} />
              {/* THE SHIPPED READING (review lens 1 F9). GameTapeView resolves a
                  bookmarked entry as `message ‖ rationale ‖ 'No details
                  available'` (:413); the first draft invented
                  `message ‖ text ‖ action`, which rendered a legal swap — whose
                  feed entry carries no message — as the bare machinery word
                  `swap`. One bookmark must not read two ways. */}
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.4, color: cssVar('text-secondary') }}>
                {entry?.message || entry?.rationale || COPY.tapeBookmarkNoDetail}
              </span>
              <button
                type="button"
                aria-label={COPY.tapeUnbookmark}
                onClick={() => onUnbookmark(id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: cssVar('text-muted'),
                  cursor: 'pointer',
                  padding: 0,
                  minWidth: 24,
                  minHeight: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ ...heading, padding: '0 14px' }}>{COPY.tapeActivityLog}</div>
        <div style={{ padding: '0 14px' }}>
          <button
            type="button"
            data-tape-log-toggle={showLog ? 'open' : 'closed'}
            aria-expanded={showLog ? 'true' : 'false'}
            onClick={() => setShowLog((v) => !v)}
            style={{
              border: `1px solid rgba(var(--ft-scrim-rgb), 0.12)`,
              background: 'transparent',
              borderRadius: 6,
              color: cssVar('text-secondary'),
              cursor: 'pointer',
              padding: '5px 10px',
              minHeight: 30,
            }}
          >
            {/* index.css forces every button to 16px !important (hazard 48). */}
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
              {showLog ? COPY.tapeActivityHide : COPY.tapeActivityShow}
            </span>
          </button>
        </div>
        {showLog && (
          <AgentActivityFeed
            statusFeed={Array.isArray(statusFeed) ? statusFeed : []}
            feedBookmarks={Array.isArray(feedBookmarks) ? feedBookmarks : []}
            onBookmark={onBookmark}
            onUnbookmark={onUnbookmark}
            onChallenge={undefined}
            battleId={battleId}
            tokens={tokens}
            readOnly
          />
        )}
      </section>
    </div>
  );
}
