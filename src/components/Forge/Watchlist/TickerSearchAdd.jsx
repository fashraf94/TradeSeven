// src/components/Forge/Watchlist/TickerSearchAdd.jsx
//
// Sprint 6 Phase 4B — manual ticker-add control. An autocomplete over the
// ranking universe (symbol + industry search). Selecting a result hands the
// symbol up to the editor, which builds the full ticker entry.

import React, { useState, useMemo } from 'react';
import { Search, Plus } from 'lucide-react';
import { searchUniverse } from './tickerSearchMatch';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const MAX_RESULTS = 8;

export default function TickerSearchAdd({ tokens, existingSymbols, atCap, onAdd }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const results = useMemo(
    () => searchUniverse(query, { excludeSymbols: existingSymbols, atCap }).slice(0, MAX_RESULTS),
    [query, existingSymbols, atCap],
  );

  if (atCap) {
    return (
      <div style={{ fontSize: 13, color: tokens.textMuted }}>
        This watchlist is full (40 tickers). Remove one to add another.
      </div>
    );
  }

  const showResults = focused && query.trim().length > 0;

  function handlePick(symbol) {
    onAdd(symbol);
    setQuery('');
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderRadius: 8,
          background: tokens.bgCard,
          border: `1px solid ${tokens.borderInput}`,
        }}
      >
        <Search size={14} color={tokens.textFaint} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Add a ticker — search by symbol or industry"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: tokens.textPrimary,
            fontSize: 13,
          }}
        />
      </div>
      {showResults && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: 260,
            overflowY: 'auto',
            borderRadius: 8,
            background: tokens.bgCard,
            border: `1px solid ${tokens.borderDefault}`,
            boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: tokens.textMuted }}>
              No matches in our coverage universe.
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.symbol}
                type="button"
                // mousedown fires before the input's blur, so the pick lands.
                onMouseDown={(e) => {
                  e.preventDefault();
                  handlePick(r.symbol);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `1px solid ${tokens.borderDivider}`,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 12, color: tokens.teal }}>
                  {r.symbol}
                </span>
                <span style={{ fontSize: 11, color: tokens.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.industry || r.sectorName}
                </span>
                <Plus size={13} color={tokens.textFaint} style={{ marginLeft: 'auto', flexShrink: 0 }} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
