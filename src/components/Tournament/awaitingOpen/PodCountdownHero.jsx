// src/components/Tournament/awaitingOpen/PodCountdownHero.jsx
//
// Training Pod Draft V2 — Phase 2, L5. The hero countdown at the top of the
// awaiting-open pod, targeting the next MARKET OPEN when the five-day practice
// battle begins (pod.startAnchor.anchorIso — the persisted 09:30-ET next-open
// instant; trainingLifecycle.computeHandoffWrites). NOT the 4:00 PM ET claim
// wire — that stays inside the claims section.
//
// The pod's status flip is DATE-based and runs on the orchestrator morning
// sweep, which can land slightly BEFORE the 09:30 anchor. So a user sitting on
// the page across the boundary must never see a frozen 0:00 or a negative
// timer: at expiry the hero shows an "Opening…" state and holds it until
// subscribeGroup reports the BATTLE flip and the host swaps to the live view.

import React from 'react';
import { Timer, Zap } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useCountdown } from '../../../hooks/useCountdown';

const pad = (n) => String(n).padStart(2, '0');

function Segment({ tokens, value, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 54 }}>
      <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: tokens.textPrimary, fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        {value}
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: tokens.textFaint, marginTop: 6 }}>{label}</div>
    </div>
  );
}

export default function PodCountdownHero({ targetIso }) {
  const { tokens } = useTheme();
  // Interval ticks every second; onExpire not needed (the host swaps on the
  // group-status flip). With a null target the hook reports isExpired — which we
  // treat as "no target" below, not as an expiry.
  const { timeRemaining, isExpired } = useCountdown(targetIso || null, { interval: 1000 });

  const hasTarget = !!targetIso;
  const totalSec = Math.max(0, Math.floor(timeRemaining / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const opening = hasTarget && isExpired;

  const card = {
    position: 'relative', overflow: 'hidden', borderRadius: 16, padding: '20px 18px',
    background: `linear-gradient(160deg, ${tokens.teal}1f 0%, ${tokens.bgCard} 55%)`,
    border: `1px solid ${tokens.teal}3d`,
    display: 'flex', flexDirection: 'column', gap: 14,
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {opening ? <Zap size={15} color={tokens.teal} /> : <Timer size={15} color={tokens.teal} />}
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: tokens.teal }}>
          {opening ? 'Market opening' : 'Battle starts at the next open'}
        </span>
      </div>

      {!hasTarget ? (
        <div style={{ fontSize: 15, fontWeight: 700, color: tokens.textPrimary, lineHeight: 1.4 }}>
          Your five-day practice battle begins at the next market open.
        </div>
      ) : opening ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: tokens.textPrimary, letterSpacing: '-0.01em' }}>Opening…</div>
          <div style={{ fontSize: 12.5, color: tokens.textMuted, lineHeight: 1.45 }}>
            The market is opening — your pod goes live any moment. This view switches to the battle on its own.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          {days > 0 && <Segment tokens={tokens} value={String(days)} label={days === 1 ? 'day' : 'days'} />}
          <Segment tokens={tokens} value={pad(hours)} label="hrs" />
          <Segment tokens={tokens} value={pad(mins)} label="min" />
          <Segment tokens={tokens} value={pad(secs)} label="sec" />
        </div>
      )}

      {hasTarget && !opening && (
        <div style={{ fontSize: 12, color: tokens.textMuted, lineHeight: 1.45 }}>
          Locked in — your three picks and your agent are set. When the bell rings, the five-day run begins.
        </div>
      )}
    </div>
  );
}
