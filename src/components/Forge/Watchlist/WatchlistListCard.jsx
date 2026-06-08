// src/components/Forge/Watchlist/WatchlistListCard.jsx
//
// Sprint 6 Phase 4D — one row in the "My Watchlists" tab. Shows the name (or
// an "Untitled watchlist" fallback), status badge, ticker count, "Updated X
// ago", a 2-line thesis preview, and up to the first six ticker chips.
//
// The card body opens the editor; the trash button stops propagation so it
// deletes without also opening the editor.

import React, { useState } from 'react';
import { Trash2, Bookmark, BarChart3 } from 'lucide-react';
import { timeAgo } from '../../../utils/timeAgo';
import { isWatchlistEquipped } from '../../../utils/watchlistEquipUI';
import TickerChip from './TickerChip';
import WatchlistStatusBadge from './WatchlistStatusBadge';

const CHIP_PREVIEW_LIMIT = 6;

// Equip/unequip is intentionally NOT surfaced here — the Forge marks components
// "ready"; equipping happens on the Home (EquipStation/EquipBench). The
// read-only "Equipped to" badge below is kept as a quiet "in use" indicator.
export default function WatchlistListCard({
  tokens,
  watchlist,
  agent,
  onOpen,
  onAnalyze,
  onDelete,
}) {
  const [hover, setHover] = useState(false);

  const tickers = Array.isArray(watchlist?.tickers) ? watchlist.tickers : [];
  const previewTickers = tickers.slice(0, CHIP_PREVIEW_LIMIT);
  const extraCount = tickers.length - previewTickers.length;

  const hasName = Boolean(watchlist?.name?.trim());
  const name = hasName ? watchlist.name.trim() : 'Untitled watchlist';
  const thesis = watchlist?.thesis?.trim();

  const isEquipped = isWatchlistEquipped(agent, watchlist?.watchlistId);

  const open = () => onOpen(watchlist.watchlistId);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: tokens.bgCard,
        border: `1px solid ${hover ? tokens.teal : tokens.borderDefault}`,
        borderRadius: 12,
        padding: 14,
        cursor: 'pointer',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Top row: name + badge + meta · trash */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 14,
                fontWeight: 600,
                color: hasName ? tokens.textPrimary : tokens.textMuted,
                fontStyle: hasName ? 'normal' : 'italic',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </span>
            <WatchlistStatusBadge tokens={tokens} status={watchlist?.status} />
            {isEquipped && agent && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  color: tokens.teal,
                  background: `${tokens.teal}1f`,
                  border: `1px solid ${tokens.teal}3d`,
                }}
              >
                <Bookmark size={10} />
                Equipped to: {agent.name}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: tokens.textFaint, marginTop: 4 }}>
            {tickers.length} {tickers.length === 1 ? 'ticker' : 'tickers'}
            {watchlist?.updatedAt ? ` · Updated ${timeAgo(watchlist.updatedAt)}` : ''}
          </div>
        </div>
        {onAnalyze && (
          <button
            type="button"
            aria-label="Analyze watchlist"
            onClick={(e) => {
              e.stopPropagation();
              onAnalyze(watchlist);
            }}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: tokens.teal,
              cursor: 'pointer',
            }}
          >
            <BarChart3 size={15} />
          </button>
        )}
        <button
          type="button"
          aria-label="Delete watchlist"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(watchlist);
          }}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: tokens.textFaint,
            cursor: 'pointer',
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Thesis preview — 2-line clamp; placeholder when empty */}
      <div
        style={{
          marginTop: 10,
          fontSize: 12,
          lineHeight: 1.5,
          color: thesis ? tokens.textSecondary : tokens.textFaint,
          fontStyle: thesis ? 'normal' : 'italic',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {thesis || 'No thesis yet'}
      </div>

      {/* First six ticker chips */}
      {previewTickers.length > 0 && (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
          }}
        >
          {previewTickers.map((t, i) => (
            <TickerChip key={`${t?.symbol || 'ticker'}-${i}`} symbol={t?.symbol} tokens={tokens} />
          ))}
          {extraCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: tokens.textFaint }}>
              +{extraCount} more
            </span>
          )}
        </div>
      )}

    </div>
  );
}
