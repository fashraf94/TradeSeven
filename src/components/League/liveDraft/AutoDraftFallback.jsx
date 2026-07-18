// src/components/League/liveDraft/AutoDraftFallback.jsx
//
// The Auto-draft fallback lane (Entry-Flow Consolidation P2) — the live
// single-shot entry (quickPlay: private lobby + CPU-padded group in one act),
// kept and demoted BELOW the slots in the League center. This forms a REAL
// non-training base-layer group (the server omits isTraining), so the copy
// never says "training". Same discipline as LiveDraftPicker: `tokens` is a
// prop (the caller maps PICKER_TOKENS or passes useTheme tokens), one action
// in flight, errors surfaced via mapLobbyError, success routes via onEntered.

import React, { useRef, useState } from 'react';
import { quickPlay, mapLobbyError } from '../../../services/tournamentLobbyActions';

export default function AutoDraftFallback({ tokens, displayName = null, onEntered = null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);

  const start = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await quickPlay(displayName ? { displayName } : {});
      if (onEntered) onEntered();
    } catch (e) {
      setError(mapLobbyError(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div style={{ background: tokens.bgCard, border: `1px dashed ${tokens.borderDivider}`, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Can&rsquo;t make a slot?</div>
          <div style={{ fontSize: 12, color: tokens.textMuted, lineHeight: 1.45 }}>
            Auto-draft — we draft your board Monday.
          </div>
        </div>
        <button
          onClick={start}
          disabled={busy}
          style={{ background: 'transparent', color: busy ? tokens.textFaint : tokens.teal, border: `1px solid ${busy ? tokens.borderDivider : tokens.teal}`, borderRadius: 9, padding: '9px 14px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
        >
          {busy ? 'Setting up…' : 'Auto-draft'}
        </button>
      </div>
      {error && (
        <div role="alert" style={{ color: '#ffd7de', background: '#3a1320', border: '1px solid #fb7185', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>{error}</div>
      )}
    </div>
  );
}
