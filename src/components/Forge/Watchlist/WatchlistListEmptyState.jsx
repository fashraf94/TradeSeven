// src/components/Forge/Watchlist/WatchlistListEmptyState.jsx
//
// Sprint 6 Phase 4D — D5 empty state for the "My Watchlists" tab. Single CTA
// that routes the user to the Discover tab, where the Drop-a-Signal entry
// point lives.

import React from 'react';
import { Bookmark, BookmarkPlus, Sparkles } from 'lucide-react';

export default function WatchlistListEmptyState({ tokens, onDropSignal, onNewWatchlist, creating }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '56px 20px',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: tokens.bgIcon,
          marginBottom: 16,
        }}
      >
        <Bookmark size={24} color={tokens.teal} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: tokens.textPrimary, marginBottom: 6 }}>
        You haven&apos;t built any watchlists yet
      </div>
      <div
        style={{
          fontSize: 13,
          color: tokens.textMuted,
          lineHeight: 1.5,
          maxWidth: 320,
          marginBottom: 20,
        }}
      >
        Drop a signal to extract one automatically — or start one from scratch.
      </div>
      <button
        type="button"
        onClick={onDropSignal}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '11px 20px',
          borderRadius: 10,
          border: 'none',
          background: tokens.medalGold,
          color: tokens.bgApp,
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Sparkles size={15} />
        Drop a Signal
      </button>
      <button
        type="button"
        onClick={onNewWatchlist}
        disabled={creating}
        aria-label="Create a new watchlist from scratch"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 12,
          padding: '10px 18px',
          borderRadius: 10,
          border: `1px solid ${tokens.teal}`,
          background: 'transparent',
          color: tokens.teal,
          fontSize: 14,
          fontWeight: 600,
          cursor: creating ? 'not-allowed' : 'pointer',
          opacity: creating ? 0.5 : 1,
          fontFamily: 'inherit',
        }}
      >
        <BookmarkPlus size={15} />
        New Watchlist
      </button>
    </div>
  );
}
