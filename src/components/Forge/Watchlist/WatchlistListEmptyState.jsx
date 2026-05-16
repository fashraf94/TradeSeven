// src/components/Forge/Watchlist/WatchlistListEmptyState.jsx
//
// Sprint 6 Phase 4D — D5 empty state for the "My Watchlists" tab. Single CTA
// that routes the user to the Discover tab, where the Drop-a-Signal entry
// point lives.

import React from 'react';
import { Bookmark, Sparkles } from 'lucide-react';

export default function WatchlistListEmptyState({ tokens, onDropSignal }) {
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
        Drop a signal to get started — build a curated watchlist from any article, tweet, or
        transcript.
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
    </div>
  );
}
