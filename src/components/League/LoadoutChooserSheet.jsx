// src/components/League/LoadoutChooserSheet.jsx
//
// League Training Slice 5b-ii — the loadout chooser. A CONTROLLED spec-builder
// that lets a player pick a different archetype + watchlist for their no-stakes
// PRACTICE agent, instead of inheriting their ranked loadout.
//
// THE CORRECTNESS PROPERTY: this sheet NEVER writes the live ranked agent. The
// dashboard's ArchetypePicker / TraitsSheet / watchlist sheet commit-on-select
// (changeArchetype / equipWatchlist) against the live agent doc — reusing them
// here would mutate the user's ranked agent before a pod even forms. So this
// composes only the presentational ATOMS (ArchetypeCard, the watchlist row list,
// the EquipSheet shell) and writes to LOCAL draft state; the chosen spec is
// handed to the caller, which forms a pod with it (the server persists + applies
// it to the clone). Scope = Tier 1 (founder ruling): archetype + watchlist only.

import React, { useState, useEffect, useMemo } from 'react';
import EquipSheet from '../Dashboard/EquipSheet';
import { ArchetypeCard, ARCHETYPE_ORDER } from '../Dashboard/ArchetypePicker';
import { CMD, alpha, Mono, readableOn, ErrorBanner } from '../Dashboard/commandUI';
import { listWatchlists } from '../../services/forgeWatchlistService';
import { filterWatchlistsByStatus } from '../Forge/Watchlist/filterWatchlistsByStatus';

// Section eyebrow between the archetype grid and the watchlist list.
function SectionLabel({ children }) {
  return (
    <Mono style={{ display: 'block', fontSize: 9.5, letterSpacing: '0.16em', color: CMD.ink3, textTransform: 'uppercase', margin: '4px 2px 10px' }}>
      {children}
    </Mono>
  );
}

// A controlled watchlist row (mirrors the EquipSheet row style; sets draft state
// instead of calling equipWatchlist — never touches the live agent).
function WatchlistRow({ name, sub, selected, disabled, accent, onClick }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        all: 'unset', boxSizing: 'border-box', width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px', marginBottom: 7, borderRadius: 13, cursor: disabled ? 'default' : 'pointer',
        background: selected ? alpha(accent, 0.12) : CMD.surface,
        border: `1px solid ${selected ? alpha(accent, 0.4) : CMD.hair}`, opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: CMD.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        {sub && <div style={{ fontSize: 12, color: CMD.ink2, marginTop: 2 }}>{sub}</div>}
      </div>
      {selected && (
        <Mono style={{ fontSize: 9.5, letterSpacing: '0.12em', color: accent, textTransform: 'uppercase', flexShrink: 0 }}>Chosen</Mono>
      )}
    </button>
  );
}

/**
 * Props:
 *   open, onClose, accent
 *   currentArchetype / currentWatchlistId / currentWatchlistName  — read-only prefill from the ranked agent
 *   onStart({ archetype, equippedWatchlistId })  — caller forms the pod with this spec
 *   busy   — the form is in flight
 *   error  — a form error to surface in the sheet (the caller owns the async)
 */
export default function LoadoutChooserSheet({
  open, onClose, accent,
  currentArchetype = null, currentWatchlistId = null, currentWatchlistName = null,
  onStart, busy = false, error = null,
}) {
  const [archetype, setArchetype] = useState(currentArchetype || 'analyst');
  const [watchlistId, setWatchlistId] = useState(currentWatchlistId || null);
  const [committed, setCommitted] = useState([]);
  const [listLoaded, setListLoaded] = useState(false);

  // Re-seed the draft to the ranked prefill on each open (display-only; no write).
  useEffect(() => {
    if (!open) return;
    setArchetype(currentArchetype || 'analyst');
    setWatchlistId(currentWatchlistId || null);
  }, [open, currentArchetype, currentWatchlistId]);

  // Load the user's COMMITTED watchlists (the same gate the server enforces).
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setListLoaded(false);
    listWatchlists()
      .then((list) => { if (!cancelled) { setCommitted(filterWatchlistsByStatus(list, 'committed')); setListLoaded(true); } })
      .catch((err) => { if (!cancelled) { console.error('[LoadoutChooserSheet] watchlist load failed:', err); setListLoaded(true); } });
    return () => { cancelled = true; };
  }, [open]);

  // If the ranked agent's equipped watchlist isn't in the committed list (e.g.
  // since uncommitted), still show it as a selectable prefill row so the prefill
  // is honest rather than silently dropped.
  const watchlistRows = useMemo(() => {
    const rows = [{ id: '__none__', name: 'No watchlist', sub: 'Let the agent range the full board', value: null }];
    const seen = new Set();
    for (const w of committed) {
      rows.push({ id: w.watchlistId, name: w.name || 'Untitled watchlist', sub: `${(w.tickers || []).length} tickers`, value: w.watchlistId });
      seen.add(w.watchlistId);
    }
    if (currentWatchlistId && !seen.has(currentWatchlistId)) {
      rows.push({ id: currentWatchlistId, name: currentWatchlistName || 'Equipped watchlist', sub: 'your ranked agent’s watchlist', value: currentWatchlistId });
    }
    return rows;
  }, [committed, currentWatchlistId, currentWatchlistName]);

  const handleStart = () => {
    if (busy) return;
    onStart?.({ archetype, equippedWatchlistId: watchlistId });
  };

  const footer = (
    <div>
      {error && <ErrorBanner style={{ marginBottom: 10 }}>{error}</ErrorBanner>}
      <button
        type="button"
        onClick={handleStart}
        disabled={busy}
        style={{
          all: 'unset', boxSizing: 'border-box', width: '100%', textAlign: 'center',
          padding: '13px 14px', borderRadius: 12, fontSize: 14.5, fontWeight: 700,
          color: readableOn(accent), background: accent, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? 'Starting your pod…' : 'Start practice'}
      </button>
    </div>
  );

  return (
    <EquipSheet
      open={open}
      onClose={onClose}
      title="Customize your loadout"
      subtitle="Pick an archetype and watchlist for this practice agent. Your ranked agent stays exactly as it is."
      accent={accent}
      footer={footer}
    >
      <SectionLabel>Archetype</SectionLabel>
      {ARCHETYPE_ORDER.map((codeId) => (
        <ArchetypeCard
          key={codeId}
          codeId={codeId}
          selected={codeId === archetype}
          busy={false}
          disabled={busy}
          accent={accent}
          onClick={() => setArchetype(codeId)}
        />
      ))}

      <div style={{ height: 14 }} />
      <SectionLabel>Watchlist</SectionLabel>
      {!listLoaded ? (
        <div style={{ padding: '18px 8px', color: CMD.ink2, fontSize: 13 }}>Loading your watchlists…</div>
      ) : (
        watchlistRows.map((row) => (
          <WatchlistRow
            key={row.id}
            name={row.name}
            sub={row.sub}
            selected={row.value === watchlistId}
            disabled={busy}
            accent={accent}
            onClick={() => setWatchlistId(row.value)}
          />
        ))
      )}
    </EquipSheet>
  );
}
