// src/components/Season/PitStopShortlist.jsx
//
// Pit Stop shortlist section — lets the user queue up to 3 tickers for next
// week's entry scan. Writes go directly to the pitStop doc's `shortlist`
// field as the user adds/removes chips (no "save" button). The Sunday cron
// validates the list server-side against `season.universe` and the current
// portfolio at lock-in.
//
// Props:
//   entryId            - seasonEntry doc id
//   week               - pit stop week number
//   universe           - season.universe (string[] of tickers)
//   currentShortlist   - pitStop.shortlist[] from parent
//   currentPositions   - entry.portfolio.positions (object keyed by ticker)
//   isOpen             - true when pitStop.status === 'open'
//   onRefreshPitStop   - async () => void; parent refreshes after writes
//
// Read-only mode (isOpen=false): chips are static, no search, no remove.

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { HOLO_COLORS } from '../../constants/holoTheme';

const TROPHY_GOLD = '#F0C75E';
const MAX_SHORTLIST = 3;
const MAX_DROPDOWN_RESULTS = 5;

export default function PitStopShortlist({
  entryId,
  week,
  universe,
  currentShortlist,
  currentPositions,
  isOpen,
  onRefreshPitStop,
}) {
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

  // Memoise the normalised shortlist so downstream hooks get a stable
  // reference — `currentShortlist` can be undefined during the first render.
  const shortlist = useMemo(
    () => (Array.isArray(currentShortlist) ? currentShortlist : []),
    [currentShortlist],
  );
  const atCap = shortlist.length >= MAX_SHORTLIST;

  const heldSet = useMemo(() => {
    const tickers = currentPositions ? Object.keys(currentPositions) : [];
    return new Set(tickers.map((t) => String(t).toUpperCase()));
  }, [currentPositions]);

  const shortlistSet = useMemo(
    () => new Set(shortlist.map((t) => String(t).toUpperCase())),
    [shortlist],
  );

  // Filter universe by query, excluding already-held and already-shortlisted.
  const matches = useMemo(() => {
    if (!query.trim()) return [];
    if (!Array.isArray(universe)) return [];
    const q = query.trim().toUpperCase();
    const out = [];
    for (const ticker of universe) {
      const t = String(ticker).toUpperCase();
      if (!t.includes(q)) continue;
      if (heldSet.has(t)) continue;
      if (shortlistSet.has(t)) continue;
      out.push(t);
      if (out.length >= MAX_DROPDOWN_RESULTS) break;
    }
    return out;
  }, [query, universe, heldSet, shortlistSet]);

  // Click-outside to close dropdown.
  useEffect(() => {
    function onDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const writeShortlist = async (nextList) => {
    setSaving(true);
    setError(null);
    try {
      const pitStopRef = doc(
        db,
        'seasonEntries',
        entryId,
        'pitStops',
        String(week),
      );
      await updateDoc(pitStopRef, {
        shortlist: nextList,
        updatedAt: new Date().toISOString(),
      });
      if (onRefreshPitStop) {
        await onRefreshPitStop();
      }
    } catch (err) {
      console.error('[PitStopShortlist] write failed', err);
      setError(err.message || 'Failed to update shortlist');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (ticker) => {
    if (atCap) return;
    const t = String(ticker).toUpperCase();
    if (shortlistSet.has(t)) return;
    const next = [...shortlist, t];
    setQuery('');
    setShowDropdown(false);
    await writeShortlist(next);
  };

  const handleRemove = async (ticker) => {
    const next = shortlist.filter((t) => t !== ticker);
    await writeShortlist(next);
  };

  return (
    <section
      ref={containerRef}
      style={{
        background: HOLO_COLORS.bgElevated,
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1,
            color: TROPHY_GOLD,
          }}
        >
          Stock Shortlist
        </span>
        <span
          style={{
            fontSize: 11,
            color: HOLO_COLORS.textSecondary,
          }}
        >
          {shortlist.length} / {MAX_SHORTLIST}
        </span>
      </div>

      <p
        style={{
          fontSize: 12,
          color: HOLO_COLORS.textSecondary,
          lineHeight: 1.5,
          margin: '0 0 12px 0',
        }}
      >
        {isOpen
          ? `Suggest up to ${MAX_SHORTLIST} tickers for next week\u2019s entry scan. Your agent will prioritise these when rules allow.`
          : 'Stocks queued for next week at lock-in.'}
      </p>

      {/* Search input (open mode only, not at cap) */}
      {isOpen && !atCap && (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search universe (e.g. AAPL)..."
            disabled={saving}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#1C1A27',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: '10px 14px',
              color: HOLO_COLORS.textPrimary,
              fontSize: 13,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />

          {/* Dropdown */}
          {showDropdown && query.trim() && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                background: '#15171E',
                border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                borderRadius: 10,
                overflow: 'hidden',
                zIndex: 20,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              {matches.length === 0 ? (
                <div
                  style={{
                    padding: '10px 14px',
                    fontSize: 12,
                    color: HOLO_COLORS.textMuted,
                    fontStyle: 'italic',
                  }}
                >
                  No matches in this season\u2019s universe
                </div>
              ) : (
                matches.map((ticker) => (
                  <button
                    key={ticker}
                    onClick={() => handleAdd(ticker)}
                    disabled={saving}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 14px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
                      color: HOLO_COLORS.textPrimary,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      letterSpacing: 0.3,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(240, 199, 94, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {ticker}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* At-cap notice */}
      {isOpen && atCap && (
        <div
          style={{
            fontSize: 11,
            color: HOLO_COLORS.textMuted,
            fontStyle: 'italic',
            marginBottom: 12,
          }}
        >
          Shortlist is full. Remove a chip to add another.
        </div>
      )}

      {/* Chip list */}
      {shortlist.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: HOLO_COLORS.textMuted,
            fontStyle: 'italic',
          }}
        >
          No stocks shortlisted yet.
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {shortlist.map((ticker) => (
            <div
              key={ticker}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(240, 199, 94, 0.1)',
                border: `1px solid rgba(240, 199, 94, 0.4)`,
                borderRadius: 10,
                padding: isOpen ? '6px 6px 6px 12px' : '8px 12px',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: TROPHY_GOLD,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  letterSpacing: 0.3,
                }}
              >
                {ticker}
              </span>
              {isOpen && (
                <button
                  onClick={() => handleRemove(ticker)}
                  disabled={saving}
                  aria-label={`Remove ${ticker}`}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    color: HOLO_COLORS.textPrimary,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: 11,
            color: HOLO_COLORS.red,
            marginTop: 10,
          }}
        >
          {error}
        </div>
      )}
    </section>
  );
}
