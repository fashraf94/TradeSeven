// src/components/Forge/Watchlist/SaveStateIndicator.jsx
//
// Sprint 6 Phase 4B — the 3-state auto-save badge. Renders nothing while
// idle; shows "Saving…", then "Saved" (which fades after 2s), or a
// persistent "Couldn't save" with a retry button.

import React from 'react';
import { Check, AlertCircle } from 'lucide-react';

const badge = (color) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
  fontWeight: 700,
  color,
});

export default function SaveStateIndicator({ tokens, saveState, onRetry }) {
  if (saveState === 'idle') return null;

  if (saveState === 'saving') {
    return <span style={badge(tokens.textMuted)}>Saving…</span>;
  }

  if (saveState === 'saved') {
    return (
      <span style={badge(tokens.emerald)}>
        <Check size={13} />
        Saved
      </span>
    );
  }

  return (
    <span style={badge(tokens.red)}>
      <AlertCircle size={13} />
      Couldn't save
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginLeft: 2,
          padding: '2px 8px',
          borderRadius: 6,
          cursor: 'pointer',
          background: 'transparent',
          border: `1px solid ${tokens.red}`,
          color: tokens.red,
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        Retry
      </button>
    </span>
  );
}
