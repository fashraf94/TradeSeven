// src/components/Dashboard/ScoutingBoardSheet.jsx
//
// Command Center Scouting Board (V1) — the "See what it's eyeing" pre-deploy
// preview. A thin, self-fetching wrapper around the EquipSheet shell (portal +
// motion + dock). It reads the read-only GET /api/agent/scouting-board endpoint
// and renders the top-10 archetype-ranked board + the equipped watchlist as a
// distinct group. Deploy is taken FROM the board via the parent's onDeploy (the
// SAME deployAgent path) — this component never imports the deploy service.
//
// Honesty: the header label comes from the endpoint's `archetypeLabel` (the
// canonical getArchetypeLabel), NOT the client archetypeDisplay map (which is
// pending a separate rename and could disagree with the equip card). A null
// sectorName / chip / score renders nothing — never a fabricated value.

import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Star } from 'lucide-react';
import EquipSheet from './EquipSheet';
import { CMD, alpha, readableOn, Mono, Eyebrow, ErrorBanner } from './commandUI';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

// A ranked / in-universe row: symbol · (★ if equipped) · chip · sector · score.
function BoardRow({ row, accent, showStar }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', marginBottom: 6,
      borderRadius: 12, background: CMD.surface, border: `1px solid ${CMD.hair}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: CMD.ink }}>{row.symbol}</span>
          {showStar && row.inWatchlist && (
            <Star size={12} color={accent} fill={accent} aria-label="in your watchlist" />
          )}
          {row.chip && (
            <span style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: accent, background: alpha(accent, 0.12), border: `1px solid ${alpha(accent, 0.3)}`,
              padding: '2px 7px', borderRadius: 20,
            }}>
              {row.chip.label}
            </span>
          )}
        </div>
        {row.sectorName && (
          <div style={{ fontSize: 11.5, color: CMD.ink2, marginTop: 2 }}>{row.sectorName}</div>
        )}
      </div>
      {typeof row.archetypeScore === 'number' && (
        <Mono style={{ fontSize: 13, fontWeight: 700, color: CMD.ink }}>{row.archetypeScore.toFixed(1)}</Mono>
      )}
    </div>
  );
}

// Off-universe watchlist row — symbol only, dashed so a scoreless row reads as
// intentional, never as a broken/hidden score.
function OffUniverseRow({ row }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', marginBottom: 6,
      borderRadius: 12, background: 'transparent', border: `1px dashed ${CMD.hair2}`,
    }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: CMD.ink2 }}>{row.symbol}</span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          height: 46, marginBottom: 6, borderRadius: 12,
          background: CMD.surface, border: `1px solid ${CMD.hair}`, opacity: 0.45,
        }} />
      ))}
    </div>
  );
}

export default function ScoutingBoardSheet({
  open, onClose, dock = 'bottom', agent, accent,
  deploying, deployDisabled, isLive, onDeploy,
}) {
  const archetype = agent?.archetype || null;
  const watchlistId = agent?.equippedWatchlistId || null;
  const live = isLive != null ? isLive : Boolean(agent?.activeBattleId);

  const [state, setState] = useState({ status: 'idle', data: null, error: null });

  const load = useCallback((signal) => {
    // No agent/archetype yet (e.g. the sheet is opened during agent load): show a
    // benign empty state, never a perpetual skeleton.
    if (!archetype) { setState({ status: 'empty', data: null, error: null }); return; }
    setState({ status: 'loading', data: null, error: null });
    const params = new URLSearchParams({ archetype });
    if (watchlistId) params.set('watchlistId', watchlistId);
    fetchWithAuth(`/api/agent/scouting-board?${params.toString()}`)
      .then(async (r) => { if (!r.ok) throw new Error(`board_${r.status}`); return r.json(); })
      .then((data) => {
        if (signal?.cancelled) return;
        setState({ status: data.empty ? 'empty' : 'ready', data, error: null });
      })
      .catch((e) => { if (!signal?.cancelled) setState({ status: 'error', data: null, error: e.message }); });
  }, [archetype, watchlistId]);

  // Re-fetch on open, and whenever the loadout levers (archetype / equipped
  // watchlist) change — both are battle-locked, subscription-driven writes, so
  // the board reflects the same state deploy would use.
  useEffect(() => {
    if (!open) return undefined;
    const signal = { cancelled: false };
    load(signal);
    return () => { signal.cancelled = true; };
  }, [open, load]);

  const data = state.data;
  const label = data?.archetypeLabel || null; // endpoint-canonical label only
  const title = label ? `What ${label} is eyeing` : 'Scouting the board';
  const subtitle =
    state.status === 'loading' ? 'Reading the board…'
      : (state.status === 'ready' && data?.asOf) ? "Ranked from today's read"
        : undefined;

  const deployBusy = deployDisabled || deploying;
  const footer = (
    <button
      type="button"
      onClick={async () => { const r = await onDeploy?.(); if (r?.success) onClose?.(); }}
      disabled={deployBusy}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: 12, borderRadius: 12, border: 'none', cursor: deployBusy ? 'default' : 'pointer',
        fontFamily: 'inherit', background: accent, color: readableOn(accent), fontWeight: 700,
        fontSize: 13.5, opacity: deployBusy ? 0.55 : 1,
      }}
    >
      <Zap size={16} color={readableOn(accent)} fill={readableOn(accent)} />
      <span>{deploying ? 'Deploying…' : live ? 'Battle in progress' : 'Deploy this agent'}</span>
    </button>
  );

  let body;
  if (state.status === 'idle' || state.status === 'loading') {
    body = <SkeletonRows />;
  } else if (state.status === 'error') {
    body = (
      <div style={{ padding: '4px 2px' }}>
        <ErrorBanner>Couldn’t load the board just now.</ErrorBanner>
        <button
          type="button"
          onClick={() => load()}
          style={{
            marginTop: 10, width: '100%', padding: '10px', borderRadius: 12, cursor: 'pointer',
            fontFamily: 'inherit', background: 'transparent', border: `1px solid ${CMD.hair2}`,
            color: CMD.ink, fontWeight: 600, fontSize: 13,
          }}
        >
          Try again
        </button>
      </div>
    );
  } else {
    // ready | empty
    const wl = data?.watchlist || { inUniverse: [], offUniverse: [] };
    const isEmpty = state.status === 'empty';
    const hasWatchlist = (wl.inUniverse?.length || 0) + (wl.offUniverse?.length || 0) > 0;
    body = (
      <div>
        {isEmpty ? (
          // Distinct empty framing (adjustment #4): the board hasn't run, the
          // user's names weren't "excluded".
          <div style={{ padding: '16px 8px', color: CMD.ink2, fontSize: 13, lineHeight: 1.5 }}>
            Today’s ranked board isn’t in yet — it lands each morning before the open. Check back shortly.
          </div>
        ) : (
          <>
            {label && <Eyebrow style={{ marginBottom: 8 }}>{`In ${label}'s wheelhouse today`}</Eyebrow>}
            {(data?.ranked || []).map((row) => (
              <BoardRow key={row.symbol} row={row} accent={accent} showStar />
            ))}
          </>
        )}

        {hasWatchlist && (
          <div style={{ marginTop: isEmpty ? 4 : 14 }}>
            <Eyebrow style={{ marginBottom: 8 }}>From your watchlist</Eyebrow>
            {(wl.inUniverse || []).map((row) => (
              <BoardRow key={row.symbol} row={row} accent={accent} showStar={false} />
            ))}
            {(wl.offUniverse || []).length > 0 && (
              <>
                <div style={{ fontSize: 11, color: CMD.ink3, margin: '6px 2px 8px' }}>
                  {isEmpty
                    ? "in your watchlist · today’s ranked board hasn’t run yet"
                    : "in your watchlist · outside today’s ranked universe"}
                </div>
                {wl.offUniverse.map((row) => <OffUniverseRow key={row.symbol} row={row} />)}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <EquipSheet
      open={open}
      onClose={onClose}
      dock={dock}
      accent={accent}
      title={title}
      subtitle={subtitle}
      footer={footer}
    >
      {body}
    </EquipSheet>
  );
}
