// src/components/League/liveDraft/LiveDraftGlimpse.jsx
//
// Competitive Live Draft (Phase 4) — the lobby glimpse for a FORMING slot pod the
// user has claimed: the seats so far (humans by name, the rest "Open · fills with
// CPU at draft"), a live countdown to the fire instant, and a leave-seat
// affordance. Shown in the ranked host between claiming and the draft firing.
// Pure presentational: `tokens` + `onLeave` are props.

import React, { useState, useEffect } from 'react';
import { GROUP_SIZE } from '../../../constants/leagueTournament';

function useCountdown(targetIso) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetIso) return undefined;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [targetIso]);
  if (!targetIso) return '—';
  const s = Math.max(0, Math.floor((new Date(targetIso).getTime() - now) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

export default function LiveDraftGlimpse({ group, tokens, currentUserId, onLeave, leaving = false }) {
  const countdown = useCountdown(group?.scheduledDraftAt);
  const seatNames = group?.seatNames || {};
  const humans = group?.groupMembers || [];
  const openCount = Math.max(0, GROUP_SIZE - humans.length);

  const seatRow = (key, name, right, accent) => (
    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: accent ? tokens.bgApp : 'transparent', border: `1px ${accent ? 'solid' : 'dashed'} ${tokens.borderDivider}`, borderRadius: 10, padding: '10px 12px' }}>
      <span style={{ fontWeight: accent ? 700 : 500, color: accent ? (name === 'You' ? tokens.medalGold : tokens.textPrimary) : tokens.textFaint }}>{name}</span>
      <span style={{ fontSize: 12, color: tokens.textFaint }}>{right}</span>
    </div>
  );

  return (
    <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 14, padding: 20 }}>
      {/* The countdown is the HERO (founder ruling, Entry-Flow P2): the claim
          payoff reads as arrival + anticipation, so the live tick to the fire
          instant is the most prominent element, not a caption. */}
      <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>Your slot is set</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: tokens.teal, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 8 }}>
        Draft in {countdown}
      </div>
      <p style={{ color: tokens.textMuted, fontSize: 13, marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
        The live draft fires at slot time. Empty seats fill with CPUs — a slot with at least one human always drafts.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {humans.map((id) => seatRow(id, id === currentUserId ? 'You' : (seatNames[id] || 'Rival'), 'ready', true))}
        {Array.from({ length: openCount }).map((_, i) => seatRow(`open-${i}`, 'Open', 'fills with CPU at draft', false))}
      </div>

      {onLeave && (
        <button onClick={leaving ? undefined : onLeave} disabled={leaving}
          style={{ marginTop: 14, width: '100%', background: 'transparent', color: tokens.textMuted, border: `1px solid ${tokens.borderDivider}`, borderRadius: 10, padding: '10px', fontWeight: 600, cursor: leaving ? 'default' : 'pointer' }}>
          {leaving ? 'Leaving…' : 'Leave this slot'}
        </button>
      )}
    </div>
  );
}
