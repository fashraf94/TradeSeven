// src/components/Forge/Watchlist/WatchlistEditor.jsx
//
// Sprint 6 Phase 4B (B1) — read-only watchlist editor surface. Loads a
// watchlist by id and renders its anatomy (thesis, conditions, notes) plus
// its tickers grouped by sector / industry.
//
// B2 layers on auto-save, manual ticker add, slide-to-delete, and the
// commit / edit-unlock ceremonies. B1 ships the surface read-only so the
// load + grouping + display path can be reviewed in isolation.

import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { getWatchlist } from '../../../services/forgeWatchlistService';
import { groupWatchlistTickers } from './groupWatchlistTickers';
import SectionLabel from './SectionLabel';
import OffUniverseSection from './OffUniverseSection';
import TickerChip from './TickerChip';

const TICKER_CAP = 40;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export default function WatchlistEditor({ watchlistId, onClose }) {
  const { tokens } = useTheme();
  const [loadState, setLoadState] = useState('loading'); // loading | error | loaded
  const [watchlist, setWatchlist] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    setErrorMessage('');
    getWatchlist(watchlistId)
      .then((wl) => {
        if (cancelled) return;
        setWatchlist(wl);
        setLoadState('loaded');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err?.message || 'Could not load this watchlist.');
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [watchlistId]);

  return (
    <div style={{ minHeight: '100vh', background: tokens.bgApp, color: tokens.textPrimary }}>
      <EditorHeader tokens={tokens} watchlist={watchlist} onClose={onClose} />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 80px' }}>
        {loadState === 'loading' && <CenterNote tokens={tokens}>Loading watchlist…</CenterNote>}
        {loadState === 'error' && (
          <CenterNote tokens={tokens}>
            <div style={{ marginBottom: 12 }}>{errorMessage}</div>
            <BackButton tokens={tokens} onClick={onClose}>
              Back
            </BackButton>
          </CenterNote>
        )}
        {loadState === 'loaded' && watchlist && <WatchlistBody tokens={tokens} watchlist={watchlist} />}
      </div>
    </div>
  );
}

function EditorHeader({ tokens, watchlist, onClose }) {
  const name = (watchlist?.name || '').trim() || 'Untitled watchlist';
  const tickerCount = Array.isArray(watchlist?.tickers) ? watchlist.tickers.length : 0;
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 20px',
        background: tokens.bgCard,
        borderBottom: `1px solid ${tokens.borderDivider}`,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close watchlist editor"
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          cursor: 'pointer',
          background: tokens.bgIcon,
          border: `1px solid ${tokens.borderInput}`,
          color: tokens.textPrimary,
        }}
      >
        <ArrowLeft size={16} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: tokens.textWhite,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {watchlist ? name : 'Watchlist'}
        </div>
      </div>
      {watchlist && <StatusBadge tokens={tokens} status={watchlist.status} />}
      {watchlist && (
        <div style={{ fontSize: 12, fontWeight: 700, color: tokens.textMuted, fontFamily: MONO }}>
          {tickerCount} / {TICKER_CAP}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ tokens, status }) {
  const committed = status === 'committed';
  return (
    <span
      style={{
        padding: '3px 9px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        background: tokens.bgIcon,
        border: `1px solid ${committed ? tokens.teal : tokens.borderPurple}`,
        color: committed ? tokens.teal : tokens.purpleText,
      }}
    >
      {committed ? 'Committed' : 'Draft'}
    </span>
  );
}

function WatchlistBody({ tokens, watchlist }) {
  const grouped = groupWatchlistTickers(watchlist.tickers);
  const thesis = (watchlist.thesis || '').trim();
  const notes = (watchlist.notes || '').trim();
  const activation = Array.isArray(watchlist.activationConditions)
    ? watchlist.activationConditions
    : [];
  const invalidation = Array.isArray(watchlist.invalidationConditions)
    ? watchlist.invalidationConditions
    : [];
  const tickerCount = Array.isArray(watchlist.tickers) ? watchlist.tickers.length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {thesis && (
        <div>
          <SectionLabel tokens={tokens}>Thesis</SectionLabel>
          <p style={prose(tokens)}>{thesis}</p>
        </div>
      )}
      {activation.length > 0 && (
        <div>
          <SectionLabel tokens={tokens}>Activation conditions</SectionLabel>
          <ConditionList tokens={tokens} items={activation} />
        </div>
      )}
      {invalidation.length > 0 && (
        <div>
          <SectionLabel tokens={tokens}>Invalidation conditions</SectionLabel>
          <ConditionList tokens={tokens} items={invalidation} />
        </div>
      )}
      <div>
        <SectionLabel tokens={tokens}>Tickers ({tickerCount})</SectionLabel>
        {tickerCount === 0 ? (
          <p style={prose(tokens)}>No tickers in this watchlist yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {grouped.sectors.map((sector) => (
              <SectorGroup key={sector.sectorId} tokens={tokens} sector={sector} />
            ))}
          </div>
        )}
      </div>
      {notes && (
        <div>
          <SectionLabel tokens={tokens}>Notes</SectionLabel>
          <p style={prose(tokens)}>{notes}</p>
        </div>
      )}
      {grouped.offUniverse.length > 0 && (
        <OffUniverseSection
          unsupported={grouped.offUniverse.map((t) => t.symbol)}
          tokens={tokens}
          copyVariant="editor"
        />
      )}
    </div>
  );
}

function SectorGroup({ tokens, sector }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: tokens.textWhite, marginBottom: 4 }}>
        {sector.name} <span style={{ color: tokens.textFaint }}>({sector.count})</span>
      </div>
      {sector.etfGroup.length > 0 && (
        <TickerSubGroup tokens={tokens} label="Sector ETF" tickers={sector.etfGroup} />
      )}
      {sector.industryGroups.map((ig) => (
        <TickerSubGroup key={ig.industry} tokens={tokens} label={ig.industry} tickers={ig.tickers} />
      ))}
    </div>
  );
}

function TickerSubGroup({ tokens, label, tickers }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          color: tokens.textFaint,
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tickers.map((t) => (
          <TickerChip key={t.symbol} symbol={t.symbol} type={t.type} tokens={tokens} />
        ))}
      </div>
    </div>
  );
}

function ConditionList({ tokens, items }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((c, i) => (
        <li key={i} style={{ fontSize: 14, lineHeight: 1.5, color: tokens.textSecondary }}>
          {c}
        </li>
      ))}
    </ul>
  );
}

function CenterNote({ tokens, children }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        minHeight: '40vh',
        color: tokens.textMuted,
        fontSize: 14,
      }}
    >
      {children}
    </div>
  );
}

function BackButton({ tokens, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        cursor: 'pointer',
        background: tokens.bgIcon,
        border: `1px solid ${tokens.borderInput}`,
        color: tokens.textPrimary,
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {children}
    </button>
  );
}

function prose(tokens) {
  return { margin: 0, fontSize: 14, lineHeight: 1.6, color: tokens.textSecondary };
}
