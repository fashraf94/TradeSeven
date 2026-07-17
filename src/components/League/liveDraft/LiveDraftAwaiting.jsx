// src/components/League/liveDraft/LiveDraftAwaiting.jsx
//
// Competitive Live Draft (Phase 4) — the AWAITING_OPEN holding state. After a
// slot pod's draft completes it waits for the next Monday open (its
// battleStartWeek anchor); this is the honest "you're set, nothing to do" glimpse
// shown in the ranked host. Pure: `tokens` (the League useTheme tokens) is a prop.

import React from 'react';

/** 'YYYY-MM-DD' → "Monday, Jul 20" (the pod's first-trading-day anchor; usually a
 *  Monday, a Tuesday on a holiday-Monday week). UTC-noon parse → no TZ drift. */
function fmtAnchorDay(etDate) {
  if (typeof etDate !== 'string') return 'the next open';
  const [y, m, d] = etDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function LiveDraftAwaiting({ group, tokens, currentUserId }) {
  const anchor = group?.battleStartWeek?.anchorEtDate || group?.startAnchor?.anchorEtDate;
  const mine = (group?.players || []).find((p) => p.odUserId === currentUserId)?.picks || [];
  const picks = mine.map((pk) => (typeof pk === 'string' ? pk : pk?.symbol)).filter(Boolean);

  return (
    <div style={{ background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>Your pod is set</div>
      <p style={{ color: tokens.textMuted, marginTop: 8, lineHeight: 1.55, fontSize: 14 }}>
        Your draft is locked in. Trading starts <b style={{ color: tokens.textPrimary }}>{fmtAnchorDay(anchor)}</b> at the 9:30 open — nothing to do until then.
      </p>
      {picks.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
          {picks.map((s) => (
            <span key={s} style={{ background: tokens.bgApp, border: `1px solid ${tokens.borderDivider}`, borderRadius: 8, padding: '6px 12px', fontWeight: 700 }}>{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}
